import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildHistoricoContratoPdfPath, getUpload, putUpload } from '@/lib/storage'
import {
  COLUNAS_PDF,
  SELECAO_PDFS,
  TAMANHO_MAXIMO_PDF_BYTES,
  tipoPdfValido,
} from '@/lib/relatorios-clientes/pdfs-existentes'
import { carregarHistoricoComAcesso } from '../../../../carregar'

type Contexto = { params: Promise<{ id: string; tipo: string }> }

/** Corpo da requisição (mesmo formato de `OrigemPdf`, mas tolerante: vem de fora, então nada é garantido). */
type CorpoCopia = { origem?: unknown; arquivoId?: unknown; linhaId?: unknown; coluna?: unknown }

type Origem = { url: string; nome: string } | { erro: string; status: number }

/** Acha o PDF de origem (e confere que a linha de origem é do mesmo cliente da linha de destino). */
async function resolverOrigem(corpo: CorpoCopia | null, destinoId: string, tipo: string, clienteId: string): Promise<Origem> {
  if (corpo?.origem === 'proposta-comercial' && typeof corpo.arquivoId === 'string') {
    const arquivo = await prisma.propostaComercialArquivo.findFirst({
      where: { id: corpo.arquivoId, tipo: 'pdf' },
      select: { caminhoOriginal: true, nomeArquivo: true },
    })
    if (!arquivo) return { erro: 'PDF de origem não encontrado', status: 404 }
    return { url: arquivo.caminhoOriginal, nome: arquivo.nomeArquivo }
  }

  if (corpo?.origem === 'historico' && typeof corpo.linhaId === 'string' && tipoPdfValido(corpo.coluna)) {
    if (corpo.linhaId === destinoId && corpo.coluna === tipo) {
      return { erro: 'este já é o PDF desta linha', status: 400 }
    }
    const colunas = COLUNAS_PDF[corpo.coluna]
    const origem = await prisma.historicoContrato.findFirst({
      where: { id: corpo.linhaId, contrato: { clienteId } },
      select: SELECAO_PDFS,
    })
    const url = origem?.[colunas.url]
    if (!origem || !url) return { erro: 'PDF de origem não encontrado', status: 404 }
    return { url, nome: origem[colunas.nome] ?? `${colunas.rotulo}.pdf` }
  }

  return { erro: 'informe a origem do PDF (proposta-comercial ou historico)', status: 400 }
}

/** Usa um PDF que já está no sistema como PC/PA ou TC/TA desta linha: copia o arquivo pro caminho da
 *  linha (cópia independente — apagar de um lado não quebra o outro) e grava url/nome nas colunas. */
export async function POST(request: NextRequest, { params }: Contexto) {
  const { id, tipo } = await params
  if (!tipoPdfValido(tipo)) return NextResponse.json({ error: 'tipo de anexo inválido' }, { status: 404 })

  const carregado = await carregarHistoricoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const corpo = (await request.json().catch(() => null)) as CorpoCopia | null
  const origem = await resolverOrigem(corpo, id, tipo, carregado.linha.contrato.clienteId)
  if ('erro' in origem) return NextResponse.json({ error: origem.erro }, { status: origem.status })

  let buffer: Buffer
  try {
    buffer = await getUpload(origem.url)
  } catch {
    return NextResponse.json({ error: 'não consegui ler o PDF de origem no armazenamento' }, { status: 502 })
  }
  if (buffer.length > TAMANHO_MAXIMO_PDF_BYTES) {
    return NextResponse.json({ error: 'o PDF não pode passar de 15 MB' }, { status: 400 })
  }

  const url = await putUpload(buildHistoricoContratoPdfPath(id, tipo), buffer, 'application/pdf')
  const colunas = COLUNAS_PDF[tipo]
  const linha = await prisma.historicoContrato.update({
    where: { id },
    data: { [colunas.url]: url, [colunas.nome]: origem.nome },
    select: SELECAO_PDFS,
  })
  return NextResponse.json(linha)
}
