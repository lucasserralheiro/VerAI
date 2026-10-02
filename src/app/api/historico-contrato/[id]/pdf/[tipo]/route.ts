import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { registrarConteudo } from '@/lib/arquivos/registrar-conteudo'
import { SELECAO_ANEXOS, anexosDaLinha, categoriaDaColuna, dadosDaColuna } from '@/lib/relatorios-clientes/anexos-historico'
import { TAMANHO_MAXIMO_PDF_BYTES, tipoPdfValido as tipoValido } from '@/lib/relatorios-clientes/pdfs-existentes'
import { carregarHistoricoComAcesso } from '../../../carregar'

type Contexto = { params: Promise<{ id: string; tipo: string }> }

/** Anexa (ou substitui) o PDF de proposta/termo de uma linha do histórico: o arquivo entra no
 *  repositório do cliente (dedup por conteúdo) e a linha guarda a referência. Anexo feito aqui é
 *  "à mão" — a sincronização com o SharePoint nunca o troca (spec lugar-certo §3.4). */
export async function POST(request: NextRequest, { params }: Contexto) {
  const { id, tipo } = await params
  if (!tipoValido(tipo)) return NextResponse.json({ error: 'tipo de anexo inválido' }, { status: 404 })

  const carregado = await carregarHistoricoComAcesso(request, id, 'editar')
  if ('erro' in carregado) return carregado.erro

  const formData = await request.formData().catch(() => null)
  const arquivo = formData?.get('arquivo')
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: 'campo "arquivo" é obrigatório' }, { status: 400 })
  }
  if (!arquivo.name.toLowerCase().endsWith('.pdf') && arquivo.type !== 'application/pdf') {
    return NextResponse.json({ error: 'o arquivo precisa ser um PDF' }, { status: 400 })
  }
  if (arquivo.size > TAMANHO_MAXIMO_PDF_BYTES) {
    return NextResponse.json({ error: 'o PDF não pode passar de 15 MB' }, { status: 400 })
  }

  const { id: arquivoId } = await registrarConteudo(prisma, {
    clienteId: carregado.linha.contrato.clienteId,
    nome: arquivo.name,
    conteudo: Buffer.from(await arquivo.arrayBuffer()),
    categoria: categoriaDaColuna(tipo, carregado.linha.tipo),
    origem: 'upload',
    enviadoPorId: carregado.usuario.id,
  })

  const linha = await prisma.historicoContrato.update({
    where: { id },
    data: dadosDaColuna(tipo, arquivoId, false),
    select: SELECAO_ANEXOS,
  })
  return NextResponse.json(anexosDaLinha(linha))
}

/** Solta o PDF da linha. O arquivo continua no repositório do cliente (pode estar em outros lugares). */
export async function DELETE(request: NextRequest, { params }: Contexto) {
  const { id, tipo } = await params
  if (!tipoValido(tipo)) return NextResponse.json({ error: 'tipo de anexo inválido' }, { status: 404 })

  const carregado = await carregarHistoricoComAcesso(request, id, 'editar')
  if ('erro' in carregado) return carregado.erro

  const atual = await prisma.historicoContrato.findUnique({ where: { id }, select: { propostaArquivoId: true, termoArquivoId: true } })
  if (!(tipo === 'proposta' ? atual?.propostaArquivoId : atual?.termoArquivoId)) {
    return NextResponse.json({ error: 'esta linha não tem PDF anexado' }, { status: 404 })
  }

  const linha = await prisma.historicoContrato.update({
    where: { id },
    data: dadosDaColuna(tipo, null, false),
    select: SELECAO_ANEXOS,
  })
  return NextResponse.json(anexosDaLinha(linha))
}
