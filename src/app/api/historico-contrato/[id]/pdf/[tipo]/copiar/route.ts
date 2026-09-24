import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUpload } from '@/lib/storage'
import { registrarConteudo } from '@/lib/arquivos/registrar-conteudo'
import { SELECAO_ANEXOS, anexosDaLinha, categoriaDaColuna, dadosDaColuna } from '@/lib/relatorios-clientes/anexos-historico'
import { TAMANHO_MAXIMO_PDF_BYTES, tipoPdfValido } from '@/lib/relatorios-clientes/pdfs-existentes'
import { carregarHistoricoComAcesso } from '../../../../carregar'

type Contexto = { params: Promise<{ id: string; tipo: string }> }

/** Corpo da requisição (mesmo formato de `OrigemPdf`, mas tolerante: vem de fora, nada é garantido). */
type CorpoEscolha = { origem?: unknown; arquivoId?: unknown }

const ORIGEM_INVALIDA = 'informe a origem do PDF (repositorio ou proposta-comercial)'

/** Usa um PDF que já está no sistema como PC/PA ou TC/TA desta linha. Do repositório: a linha aponta
 *  pro mesmo arquivo. Da tela de propostas: o PDF entra no repositório do cliente e a linha aponta pra
 *  ele. Nos dois casos é anexo "à mão" — a sincronização com o SharePoint não o troca. */
export async function POST(request: NextRequest, { params }: Contexto) {
  const { id, tipo } = await params
  if (!tipoPdfValido(tipo)) return NextResponse.json({ error: 'tipo de anexo inválido' }, { status: 404 })

  const carregado = await carregarHistoricoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro
  const clienteId = carregado.linha.contrato.clienteId

  const corpo = (await request.json().catch(() => null)) as CorpoEscolha | null
  if (typeof corpo?.arquivoId !== 'string') return NextResponse.json({ error: ORIGEM_INVALIDA }, { status: 400 })

  let arquivoId: string
  if (corpo.origem === 'repositorio') {
    const doCliente = await prisma.arquivoCliente.findFirst({
      where: { id: corpo.arquivoId, clienteId, removidoEm: null, contentType: 'application/pdf' },
      select: { id: true },
    })
    if (!doCliente) return NextResponse.json({ error: 'PDF de origem não encontrado' }, { status: 404 })
    arquivoId = doCliente.id
  } else if (corpo.origem === 'proposta-comercial') {
    const origem = await prisma.propostaComercialArquivo.findFirst({
      where: { id: corpo.arquivoId, tipo: 'pdf' },
      select: { caminhoOriginal: true, nomeArquivo: true },
    })
    if (!origem) return NextResponse.json({ error: 'PDF de origem não encontrado' }, { status: 404 })
    let conteudo: Buffer
    try {
      conteudo = await getUpload(origem.caminhoOriginal)
    } catch {
      return NextResponse.json({ error: 'não consegui ler o PDF de origem no armazenamento' }, { status: 502 })
    }
    if (conteudo.length > TAMANHO_MAXIMO_PDF_BYTES) {
      return NextResponse.json({ error: 'o PDF não pode passar de 15 MB' }, { status: 400 })
    }
    arquivoId = (
      await registrarConteudo(prisma, {
        clienteId,
        nome: origem.nomeArquivo,
        conteudo,
        categoria: categoriaDaColuna(tipo, carregado.linha.tipo),
        origem: 'upload',
        enviadoPorId: carregado.usuario.id,
      })
    ).id
  } else {
    return NextResponse.json({ error: ORIGEM_INVALIDA }, { status: 400 })
  }

  const linha = await prisma.historicoContrato.update({
    where: { id },
    data: dadosDaColuna(tipo, arquivoId, false),
    select: SELECAO_ANEXOS,
  })
  return NextResponse.json(anexosDaLinha(linha))
}
