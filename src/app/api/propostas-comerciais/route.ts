import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { deleteUpload, getUpload } from '@/lib/storage'
import { putR2 } from '@/lib/r2'
import { chaveImagemProposta, urlImagemProposta } from '@/lib/propostas/imagens'
import { TIPOS_DE_ENVIO, chaveOriginalProposta, ehEnderecoDeEnvio } from '@/lib/propostas/envio'
import { converterPdfParaHtml } from '@/lib/extracao/pdfHtml'
import { converterParaHtmlDeterministico } from '@/lib/extracao'
import { escaparHtml } from '@/lib/extracao/escaparHtml'
import { reescreverComArquivoId } from '@/lib/ocr/marcadorOcrPendente'
import { podeVerCliente } from '@/lib/visibilidade'

/** Um arquivo já subido pra um caminho temporário no R2 (ver
 *  `/api/propostas-comerciais/envio`) — o navegador manda direto pro
 *  R2, sem passar pelo corpo desta requisição. Isso existe porque uma
 *  função serverless da Vercel rejeita (413) qualquer corpo de requisição
 *  acima de 4,5 MB — PDF de proposta real passa disso com frequência. */
interface ArquivoRecebido {
  nomeArquivo: string
  url: string
  /** Tamanho conhecido do navegador (antes do upload) — só pra exibição na
   *  lista de propostas; se ausente, usa o tamanho real do buffer baixado. */
  tamanhoBytes?: number
}

function arquivoRecebidoValido(v: unknown): v is ArquivoRecebido {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as ArquivoRecebido).nomeArquivo === 'string' &&
    typeof (v as ArquivoRecebido).url === 'string'
  )
}

/** Arquivo a converter, venha de onde vier: upload temporário (tela "Nova conversão") ou arquivo
 *  do repositório do cliente (aba Documentos, "Converter em Markdown"). Do repositório não se copia
 *  nem se apaga nada — `caminhoOriginal` aponta pro próprio blob e o `arquivoClienteId` vira uso. */
interface ArquivoAConverter {
  nomeArquivo: string
  url: string
  tamanhoBytes?: number
  arquivoClienteId?: string
}

const TIPOS_ACEITOS = ['pdf', 'xlsx', 'csv', 'docx'] as const
type TipoAceito = (typeof TIPOS_ACEITOS)[number]

function tipoDoArquivo(nome: string): TipoAceito | null {
  const ext = nome.toLowerCase().split('.').pop() ?? ''
  return (TIPOS_ACEITOS as readonly string[]).includes(ext) ? (ext as TipoAceito) : null
}

export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const status = request.nextUrl.searchParams.get('status')
  const filtros: Prisma.PropostaComercialWhereInput = {}
  if (status) filtros.status = status

  const propostas = await prisma.propostaComercial.findMany({
    where: filtros,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      nomeArquivo: true,
      tamanhoBytes: true,
      status: true,
      mensagemErro: true,
      createdAt: true,
      _count: { select: { arquivos: true } },
    },
  })

  return NextResponse.json(propostas)
}

export async function POST(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const corpo = (await request.json().catch(() => null)) as { arquivos?: unknown; arquivosCliente?: unknown } | null
  const bruto: unknown[] = Array.isArray(corpo?.arquivos) ? corpo.arquivos : []
  const idsDoCliente = Array.isArray(corpo?.arquivosCliente)
    ? corpo.arquivosCliente.filter((id): id is string => typeof id === 'string')
    : []

  const arquivosEnviados: ArquivoAConverter[] = bruto.filter(arquivoRecebidoValido)
  // Do navegador só entra o temporário do envio (`/api/propostas-comerciais/envio`) — esta rota lê e
  // depois APAGA o endereço recebido, então qualquer outro deixaria mexer em arquivo alheio do bucket.
  if (arquivosEnviados.some((a) => !ehEnderecoDeEnvio(a.url))) {
    return NextResponse.json({ error: 'endereço de envio inválido' }, { status: 400 })
  }
  if (idsDoCliente.length > 0) {
    const doCliente = await prisma.arquivoCliente.findMany({
      where: { id: { in: idsDoCliente }, removidoEm: null },
      select: { id: true, clienteId: true, nome: true, tamanhoBytes: true, urlBlob: true },
    })
    if (doCliente.length !== new Set(idsDoCliente).size) {
      return NextResponse.json({ error: 'arquivo não encontrado' }, { status: 404 })
    }
    for (const clienteId of new Set(doCliente.map((a) => a.clienteId))) {
      if (!(await podeVerCliente(usuario, clienteId))) {
        return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
      }
    }
    for (const a of doCliente) {
      arquivosEnviados.push({ nomeArquivo: a.nome, url: a.urlBlob, tamanhoBytes: a.tamanhoBytes, arquivoClienteId: a.id })
    }
  }

  if (arquivosEnviados.length === 0) {
    return NextResponse.json({ error: 'envie ao menos um arquivo' }, { status: 400 })
  }

  for (const arquivo of arquivosEnviados) {
    if (!tipoDoArquivo(arquivo.nomeArquivo)) {
      return NextResponse.json(
        {
          error: `tipo de arquivo não suportado: "${arquivo.nomeArquivo}" — aceitos: PDF, Excel (.xlsx/.csv) e Word (.docx)`,
        },
        { status: 400 }
      )
    }
  }

  const tamanhoBytesTotal = arquivosEnviados.reduce((acc, a) => acc + (a.tamanhoBytes ?? 0), 0)

  // A proposta nasce em rascunho com o nome do primeiro arquivo — o registro
  // de cada arquivo individual (buffer, extração) só é anexado depois de
  // criada, pra já ter o propostaId pro caminho de upload no storage.
  const proposta = await prisma.propostaComercial.create({
    data: {
      nomeArquivo: arquivosEnviados[0].nomeArquivo,
      tamanhoBytes: tamanhoBytesTotal,
      status: 'rascunho',
    },
  })

  // Conversão 100% determinística — sem IA. Cada arquivo vira HTML pelo
  // seu próprio conversor fiel (pdfHtml pro PDF, HTML sanitizado do
  // mammoth pro Word, tabela completa pra planilha); nenhum dado é
  // reescrito, resumido ou inventado, só reformatado.
  interface ArquivoConvertido {
    nomeArquivo: string
    html: string
  }
  const arquivosConvertidos: ArquivoConvertido[] = []
  let falhaConversao: string | null = null

  for (const [indice, arquivo] of arquivosEnviados.entries()) {
    const tipo = tipoDoArquivo(arquivo.nomeArquivo)!

    // O arquivo já está no R2 (envio direto do navegador — ver
    // `/api/propostas-comerciais/envio`), só num caminho TEMPORÁRIO.
    // Baixa daqui (servidor-a-servidor, sem o limite de 4,5 MB de corpo de
    // requisição da função serverless) pra rodar a conversão e grava o
    // original no caminho FINAL, ao lado das imagens da proposta.
    let buffer: Buffer
    try {
      buffer = await getUpload(arquivo.url)
    } catch (error) {
      falhaConversao = error instanceof Error ? error.message : String(error)
      continue
    }

    let url = arquivo.url
    if (!arquivo.arquivoClienteId) {
      try {
        url = await putR2(chaveOriginalProposta(proposta.id, indice, tipo), buffer, TIPOS_DE_ENVIO[tipo])
      } catch (error) {
        falhaConversao = error instanceof Error ? error.message : String(error)
        continue
      }
      // Best-effort: o temporário não deveria mais ser referenciado por
      // ninguém a partir daqui — se a limpeza falhar, não derruba o envio (só
      // sobra lixo em `tmp-uploads/`, sem afetar a proposta).
      await deleteUpload(arquivo.url).catch(() => {})
    }

    // A linha do arquivo é gravada ANTES de saber o HTML final, pra já ter o
    // `id` disponível — é ele que entra no marcador de OCR pendente (o
    // conversor só sabe o número da página, não o arquivoId).
    const arquivoRow = await prisma.propostaComercialArquivo.create({
      data: {
        propostaId: proposta.id,
        nomeArquivo: arquivo.nomeArquivo,
        tipo,
        tamanhoBytes: buffer.length,
        caminhoOriginal: url,
        conteudoExtraido: null,
        ordem: indice,
        arquivoClienteId: arquivo.arquivoClienteId ?? null,
      },
    })

    let html: string | null = null
    try {
      if (tipo === 'pdf') {
        const resultado = await converterPdfParaHtml(buffer, {
          // Diagrama, print de tela e tabela que veio como figura não
          // existem no texto do PDF: sem gravar a imagem e devolver a URL,
          // eles sumiriam do HTML sem deixar rastro. Vão pro R2 (privado), e o
          // `<img>` aponta pra rota do VerAI que lê de lá — ver `lib/propostas/imagens.ts`.
          salvarImagem: async (imagem) => {
            await putR2(chaveImagemProposta(proposta.id, indice, imagem.nomeArquivo), imagem.png, 'image/png')
            return urlImagemProposta(proposta.id, indice, imagem.nomeArquivo)
          },
        })
        html = resultado.paginasImagem.length > 0 ? reescreverComArquivoId(resultado.html, arquivoRow.id) : resultado.html
      } else {
        html = await converterParaHtmlDeterministico(buffer, tipo)
      }
      if (!html.trim()) {
        throw new Error(`não foi possível converter "${arquivo.nomeArquivo}" — arquivo sem conteúdo reconhecível`)
      }
    } catch (error) {
      falhaConversao = error instanceof Error ? error.message : String(error)
    }

    await prisma.propostaComercialArquivo.update({
      where: { id: arquivoRow.id },
      data: { conteudoExtraido: html },
    })

    if (html) {
      arquivosConvertidos.push({ nomeArquivo: arquivo.nomeArquivo, html })
    }
  }

  if (falhaConversao || arquivosConvertidos.length === 0) {
    const propostaComErro = await prisma.propostaComercial.update({
      where: { id: proposta.id },
      data: {
        status: 'erro',
        mensagemErro: falhaConversao ?? 'não foi possível converter nenhum arquivo enviado',
      },
    })
    return NextResponse.json(propostaComErro, { status: 201 })
  }

  // Um único arquivo vira o HTML final direto. Mais de um arquivo é só
  // concatenado, cada um sob seu próprio título com o nome original — nunca
  // mesclado, reescrito ou reorganizado por IA.
  const htmlFinal =
    arquivosConvertidos.length === 1
      ? arquivosConvertidos[0].html
      : arquivosConvertidos.map((a) => `<h2>${escaparHtml(a.nomeArquivo)}</h2>${a.html}`).join('<hr>')

  // Nome da coluna continua `conteudoMarkdown` nesta fase — o rename fica
  // pra fase de migração de banco (ver
  // docs/superpowers/specs/2026-09-14-html-nativo-ocr-proposta-comercial-design.md);
  // o conteúdo gravado aqui já é HTML.
  const propostaFinal = await prisma.propostaComercial.update({
    where: { id: proposta.id },
    data: { conteudoMarkdown: htmlFinal, status: 'rascunho' },
  })

  return NextResponse.json(propostaFinal, { status: 201 })
}
