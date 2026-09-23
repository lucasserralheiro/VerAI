import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import {
  COLUNAS_PDF,
  nomeCombina,
  ordenarSugeridosPrimeiro,
  tipoPdfValido,
  type PdfExistente,
} from '@/lib/relatorios-clientes/pdfs-existentes'
import type { TipoPdfHistorico } from '@/lib/storage'
import { carregarHistoricoComAcesso } from '../../carregar'

type Contexto = { params: Promise<{ id: string }> }

const LIMITE = 500

/**
 * PDFs que já estão no sistema e podem ser usados na coluna PC/PA (`?tipo=proposta`) ou TC/TA
 * (`?tipo=termo`) desta linha do histórico, sem subir de novo do computador:
 *  - arquivos PDF da tela "Propostas comerciais";
 *  - PDFs já anexados em outras linhas de contrato do MESMO cliente (o acesso é checado pelo cliente
 *    da linha, então nada de outro cliente aparece aqui).
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

  const [arquivos, outrasLinhas] = await Promise.all([
    prisma.propostaComercialArquivo.findMany({
      where: { tipo: 'pdf' },
      orderBy: { createdAt: 'desc' },
      take: LIMITE,
      select: { id: true, propostaId: true, nomeArquivo: true, tamanhoBytes: true, createdAt: true },
    }),
    prisma.historicoContrato.findMany({
      where: {
        id: { not: id },
        contrato: { clienteId: linha.contrato.clienteId },
        OR: [{ propostaPdfUrl: { not: null } }, { termoPdfUrl: { not: null } }],
      },
      orderBy: { createdAt: 'desc' },
      take: LIMITE,
      select: {
        id: true,
        numero: true,
        proposta: true,
        propostaPdfUrl: true,
        propostaPdfNome: true,
        termoPdfUrl: true,
        termoPdfNome: true,
        contrato: { select: { numeroTermo: true } },
      },
    }),
  ])

  const itens: PdfExistente[] = arquivos.map((arquivo) => ({
    chave: `proposta-comercial:${arquivo.id}`,
    nome: arquivo.nomeArquivo,
    detalhe: `Propostas comerciais · enviado em ${formatarData(arquivo.createdAt.toISOString())}`,
    tamanhoBytes: arquivo.tamanhoBytes,
    verUrl: `/api/propostas-comerciais/${arquivo.propostaId}/arquivos/${arquivo.id}?modo=preview`,
    sugerido: nomeCombina(referencia, arquivo.nomeArquivo),
    origem: { origem: 'proposta-comercial', arquivoId: arquivo.id },
  }))

  for (const outra of outrasLinhas) {
    for (const coluna of ['proposta', 'termo'] as TipoPdfHistorico[]) {
      const { url, nome, rotulo } = COLUNAS_PDF[coluna]
      const endereco = outra[url]
      if (!endereco) continue
      const nomeArquivo = outra[nome] ?? `${rotulo}.pdf`
      const textoDaLinha = coluna === 'proposta' ? outra.proposta : outra.numero
      itens.push({
        chave: `historico:${outra.id}:${coluna}`,
        nome: nomeArquivo,
        detalhe: `Contrato ${outra.contrato.numeroTermo ?? 'sem nº'} · ${rotulo}${textoDaLinha ? ` de ${textoDaLinha}` : ''}`,
        tamanhoBytes: null,
        verUrl: endereco,
        sugerido: nomeCombina(referencia, nomeArquivo) || nomeCombina(referencia, textoDaLinha),
        origem: { origem: 'historico', linhaId: outra.id, coluna },
      })
    }
  }

  return NextResponse.json({ referencia, itens: ordenarSugeridosPrimeiro(itens) })
}
