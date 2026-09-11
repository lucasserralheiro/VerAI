import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { buildImagemPath, buildUploadPath, putUpload } from '@/lib/storage'
import { converterPdfParaMarkdown } from '@/lib/extracao/pdfMarkdown'
import { converterParaMarkdownDeterministico } from '@/lib/extracao'
import { reescreverComArquivoId } from '@/lib/ocr/marcadorOcrPendente'

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

  const formData = await request.formData().catch(() => null)
  const arquivosEnviados = formData?.getAll('arquivos').filter((v): v is File => v instanceof File) ?? []

  if (arquivosEnviados.length === 0) {
    return NextResponse.json({ error: 'envie ao menos um arquivo' }, { status: 400 })
  }

  for (const arquivo of arquivosEnviados) {
    if (!tipoDoArquivo(arquivo.name)) {
      return NextResponse.json(
        { error: `tipo de arquivo não suportado: "${arquivo.name}" — aceitos: PDF, Excel (.xlsx/.csv) e Word (.docx)` },
        { status: 400 }
      )
    }
  }

  const tamanhoBytesTotal = arquivosEnviados.reduce((acc, a) => acc + a.size, 0)

  // A proposta nasce em rascunho com o nome do primeiro arquivo — o registro
  // de cada arquivo individual (buffer, extração) só é anexado depois de
  // criada, pra já ter o propostaId pro caminho de upload no storage.
  const proposta = await prisma.propostaComercial.create({
    data: {
      nomeArquivo: arquivosEnviados[0].name,
      tamanhoBytes: tamanhoBytesTotal,
      status: 'rascunho',
    },
  })

  // Conversão 100% determinística — sem IA. Cada arquivo vira Markdown pelo
  // seu próprio conversor fiel (pdfMarkdown pro PDF, HTML→Markdown do
  // mammoth pro Word, tabela completa pra planilha); nenhum dado é
  // reescrito, resumido ou inventado, só reformatado.
  interface ArquivoConvertido {
    nomeArquivo: string
    markdown: string
  }
  const arquivosConvertidos: ArquivoConvertido[] = []
  let falhaConversao: string | null = null

  for (const [indice, arquivo] of arquivosEnviados.entries()) {
    const tipo = tipoDoArquivo(arquivo.name)!
    const buffer = Buffer.from(await arquivo.arrayBuffer())
    const caminhoRelativo = buildUploadPath(`${proposta.id}/${indice}`, tipo)
    const url = await putUpload(caminhoRelativo, buffer)

    // A linha do arquivo é gravada ANTES de saber o Markdown final, pra já
    // ter o `id` disponível — é ele que entra no marcador `:::ocr-pendente`
    // (o conversor só sabe o número da página, não o arquivoId).
    const arquivoRow = await prisma.propostaComercialArquivo.create({
      data: {
        propostaId: proposta.id,
        nomeArquivo: arquivo.name,
        tipo,
        tamanhoBytes: buffer.length,
        caminhoOriginal: url,
        conteudoExtraido: null,
        ordem: indice,
      },
    })

    let markdown: string | null = null
    try {
      if (tipo === 'pdf') {
        const resultado = await converterPdfParaMarkdown(buffer, {
          // Diagrama, print de tela e tabela que veio como figura não
          // existem no texto do PDF: sem gravar a imagem e devolver a URL,
          // eles sumiriam do Markdown sem deixar rastro.
          salvarImagem: (imagem) =>
            putUpload(buildImagemPath(`${proposta.id}/${indice}`, imagem.nomeArquivo), imagem.png, 'image/png'),
        })
        markdown =
          resultado.paginasImagem.length > 0 ? reescreverComArquivoId(resultado.markdown, arquivoRow.id) : resultado.markdown
      } else {
        markdown = await converterParaMarkdownDeterministico(buffer, tipo)
      }
      if (!markdown.trim()) {
        throw new Error(`não foi possível converter "${arquivo.name}" — arquivo sem conteúdo reconhecível`)
      }
    } catch (error) {
      falhaConversao = error instanceof Error ? error.message : String(error)
    }

    await prisma.propostaComercialArquivo.update({
      where: { id: arquivoRow.id },
      data: { conteudoExtraido: markdown },
    })

    if (markdown) {
      arquivosConvertidos.push({ nomeArquivo: arquivo.name, markdown })
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

  // Um único arquivo vira o Markdown final direto. Mais de um arquivo é só
  // concatenado, cada um sob seu próprio título com o nome original — nunca
  // mesclado, reescrito ou reorganizado por IA.
  const markdownFinal =
    arquivosConvertidos.length === 1
      ? arquivosConvertidos[0].markdown
      : arquivosConvertidos.map((a) => `## ${a.nomeArquivo}\n\n${a.markdown}`).join('\n\n---\n\n')

  const propostaFinal = await prisma.propostaComercial.update({
    where: { id: proposta.id },
    data: { conteudoMarkdown: markdownFinal, status: 'rascunho' },
  })

  return NextResponse.json(propostaFinal, { status: 201 })
}
