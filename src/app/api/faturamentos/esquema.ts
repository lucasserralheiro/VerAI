import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  booleanoOpcional,
  dataOpcional,
  decimalObrigatorio,
  decimalOpcional,
  inteiroEntre,
  textoObrigatorio,
  textoOpcional,
} from '@/lib/relatorios-clientes/validacao'

// ---------------------------------------------------------------------------
// Faturamento (um lançamento por mês/contrato)
// ---------------------------------------------------------------------------

const camposFaturamento = {
  valor: decimalOpcional,
  situacao: textoOpcional,
  sei: textoOpcional,
  complementar: booleanoOpcional,
  observacao: textoOpcional,
  unidadeDestino: textoOpcional,
  enviadoCliente: booleanoOpcional,
  enviadoGfp: booleanoOpcional,
}

export const ANO = inteiroEntre(2000, 2100)
export const MES = inteiroEntre(1, 12)

/** POST em /api/clientes/[clienteId]/faturamentos: contrato e competência obrigatórios. */
export const esquemaNovoFaturamento = z.object({
  contratoId: textoObrigatorio,
  competenciaAno: ANO,
  competenciaMes: MES,
  ...camposFaturamento,
})

/** PATCH em /api/faturamentos/[id]: tudo opcional (o faturamento não muda de cliente). */
export const esquemaEdicaoFaturamento = z.object({
  contratoId: textoObrigatorio.optional(),
  competenciaAno: ANO.optional(),
  competenciaMes: MES.optional(),
  ...camposFaturamento,
})

export const ROTULOS_FATURAMENTO = {
  contratoId: 'Contrato',
  competenciaAno: 'Ano',
  competenciaMes: 'Mês',
  valor: 'Valor',
}

export const SELECT_FATURAMENTO = {
  id: true,
  clienteId: true,
  contratoId: true,
  competenciaAno: true,
  competenciaMes: true,
  valor: true,
  situacao: true,
  sei: true,
  complementar: true,
  observacao: true,
  unidadeDestino: true,
  enviadoCliente: true,
  enviadoGfp: true,
  pdfUrl: true,
  pdfNomeArquivo: true,
  contrato: { select: { id: true, numeroTermo: true } },
} satisfies Prisma.FaturamentoSelect

type FaturamentoSelecionado = Prisma.FaturamentoGetPayload<{ select: typeof SELECT_FATURAMENTO }>

export interface ResumoNotas {
  valorNotas: string
  servicos: string[]
}

const RESUMO_VAZIO: ResumoNotas = { valorNotas: '0', servicos: [] }

/** Soma das notas e serviços distintos de cada faturamento — um `groupBy` pra lista inteira. */
export async function resumoDasNotas(faturamentoIds: string[]): Promise<Map<string, ResumoNotas>> {
  const resumos = new Map<string, ResumoNotas>()
  if (faturamentoIds.length === 0) return resumos

  const grupos = await prisma.notaFiscal.groupBy({
    by: ['faturamentoId', 'servico'],
    where: { faturamentoId: { in: faturamentoIds } },
    _sum: { valor: true },
  })
  const somas = new Map<string, Prisma.Decimal>()
  for (const grupo of grupos) {
    const atual = somas.get(grupo.faturamentoId) ?? new Prisma.Decimal(0)
    somas.set(grupo.faturamentoId, atual.plus(grupo._sum.valor ?? 0))
    const resumo = resumos.get(grupo.faturamentoId) ?? { valorNotas: '0', servicos: [] }
    if (grupo.servico) resumo.servicos.push(grupo.servico)
    resumos.set(grupo.faturamentoId, resumo)
  }
  for (const [id, soma] of somas) resumos.get(id)!.valorNotas = soma.toString()
  for (const resumo of resumos.values()) resumo.servicos.sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return resumos
}

/** Valor exibido = `valor` do faturamento quando preenchido; senão a soma das notas (o import deixa
 *  `valor` nulo — a origem não tem essa coluna). */
export function serializarFaturamento(faturamento: FaturamentoSelecionado, resumo: ResumoNotas = RESUMO_VAZIO) {
  const valor = faturamento.valor?.toString() ?? null
  // Sem valor lançado e sem nenhuma nota fiscal: o legado simplesmente não tem esse dado (só 158
  // notas pra 635 lançamentos). A tela mostra "sem nota" em vez de um R$ 0,00 que pareceria real.
  const semNota = valor === null && resumo === RESUMO_VAZIO
  return { ...faturamento, valor, ...resumo, valorExibido: valor ?? resumo.valorNotas, semNota }
}

// ---------------------------------------------------------------------------
// Nota fiscal
// ---------------------------------------------------------------------------

const camposNota = {
  numero: textoOpcional,
  dataEmissao: dataOpcional,
  servico: textoOpcional,
  quantidade: decimalOpcional,
  complementar: booleanoOpcional,
}

export const esquemaNovaNota = z.object({ valor: decimalObrigatorio, ...camposNota })
export const esquemaEdicaoNota = z.object({ valor: decimalObrigatorio.optional(), ...camposNota })

export const ROTULOS_NOTA = {
  numero: 'Nº da nota',
  valor: 'Valor',
  dataEmissao: 'Data de emissão',
  servico: 'Serviço',
  quantidade: 'Quantidade',
}

export const SELECT_NOTA = {
  id: true,
  faturamentoId: true,
  numero: true,
  valor: true,
  dataEmissao: true,
  servico: true,
  quantidade: true,
  complementar: true,
} satisfies Prisma.NotaFiscalSelect

type NotaSelecionada = Prisma.NotaFiscalGetPayload<{ select: typeof SELECT_NOTA }>

export function serializarNota(nota: NotaSelecionada) {
  return { ...nota, valor: nota.valor?.toString() ?? null, quantidade: nota.quantidade?.toString() ?? null }
}
