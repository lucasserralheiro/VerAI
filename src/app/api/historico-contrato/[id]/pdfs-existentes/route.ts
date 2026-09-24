import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rotuloCategoria } from '@/lib/arquivos/tipos'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import { urlDoArquivo } from '@/lib/relatorios-clientes/anexos-historico'
import { nomeCombina, ordenarSugeridosPrimeiro, tipoPdfValido, type PdfExistente } from '@/lib/relatorios-clientes/pdfs-existentes'
import { carregarHistoricoComAcesso } from '../../carregar'

type Contexto = { params: Promise<{ id: string }> }

const LIMITE = 500

/**
 * PDFs que já estão no sistema e podem ser usados na coluna PC/PA (`?tipo=proposta`) ou TC/TA
 * (`?tipo=termo`) desta linha do histórico: os do repositório do cliente da linha (o acesso é checado
 * por esse cliente, então nada de outro cliente aparece) e os da tela "Propostas comerciais".
 * Os que combinam com o texto da linha (proposta / nº do termo) vêm marcados como `sugerido` e primeiro.
 */
export async function GET(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const tipo = request.nextUrl.searchParams.get('tipo')
  if (!tipoPdfValido(tipo)) return NextResponse.json({ error: 'tipo de anexo inválido' }, { status: 400 })

  const carregado = await carregarHistoricoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro
  const { linha } = carregado
  const referencia = tipo === 'proposta' ? linha.proposta : linha.numero

  const [doRepositorio, daTelaDePropostas] = await Promise.all([
    prisma.arquivoCliente.findMany({
      where: { clienteId: linha.contrato.clienteId, removidoEm: null, contentType: 'application/pdf' },
      orderBy: { createdAt: 'desc' },
      take: LIMITE,
      select: { id: true, nome: true, tamanhoBytes: true, categoria: true, origem: true, createdAt: true },
    }),
    prisma.propostaComercialArquivo.findMany({
      where: { tipo: 'pdf' },
      orderBy: { createdAt: 'desc' },
      take: LIMITE,
      select: { id: true, propostaId: true, nomeArquivo: true, tamanhoBytes: true, createdAt: true },
    }),
  ])

  const itens: PdfExistente[] = [
    ...doRepositorio.map((arquivo) => ({
      chave: `repositorio:${arquivo.id}`,
      nome: arquivo.nome,
      detalhe: `${rotuloCategoria(arquivo.categoria)} · ${arquivo.origem === 'sharepoint' ? 'SharePoint' : `enviado em ${formatarData(arquivo.createdAt.toISOString())}`}`,
      tamanhoBytes: arquivo.tamanhoBytes,
      verUrl: urlDoArquivo(arquivo.id),
      sugerido: nomeCombina(referencia, arquivo.nome),
      origem: { origem: 'repositorio' as const, arquivoId: arquivo.id },
    })),
    ...daTelaDePropostas.map((arquivo) => ({
      chave: `proposta-comercial:${arquivo.id}`,
      nome: arquivo.nomeArquivo,
      detalhe: `Propostas comerciais · enviado em ${formatarData(arquivo.createdAt.toISOString())}`,
      tamanhoBytes: arquivo.tamanhoBytes,
      verUrl: `/api/propostas-comerciais/${arquivo.propostaId}/arquivos/${arquivo.id}?modo=preview`,
      sugerido: nomeCombina(referencia, arquivo.nomeArquivo),
      origem: { origem: 'proposta-comercial' as const, arquivoId: arquivo.id },
    })),
  ]

  return NextResponse.json({ referencia, itens: ordenarSugeridosPrimeiro(itens) })
}
