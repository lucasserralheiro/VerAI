import type { ControleContrato, ControleContratoLinha } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { separarFaturado } from './meses'
import type { ControleSerializado, LinhaControle } from './tipos'

// Consultas dos Controles de Contratos (spec docs/superpowers/specs/2026-09-29-controles-de-contratos-design.md
// §6–7). Totais só dos conferidos (o leitor grava `null` quando a tabela não fecha).

const mesTexto = (c: { mesAno: number; mesMes: number }) => `${c.mesAno}-${String(c.mesMes).padStart(2, '0')}`
const texto = (d: { toString(): string } | null) => (d === null ? null : d.toString())
const centavos = (v: string) => Math.round(Number(v) * 100)

const moeda = (v: string) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Faturado "de verdade" = até o mês do controle (`separarFaturado`, spec §9); o resto da tabela vai à parte. */
export function serializarControle(c: ControleContrato & { linhas?: ControleContratoLinha[] }, clienteNome: string | null): ControleSerializado {
  const previsto = texto(c.previstoTotal)
  const faturadoDocumento = texto(c.faturadoTotal)
  const linhasFaturado = (c.linhas ?? []).filter((l) => l.tipo === 'faturado').sort((a, b) => a.posicao - b.posicao)
  const separado =
    faturadoDocumento === null
      ? null
      : separarFaturado(linhasFaturado.map((l) => ({ rotulo: l.rotulo, valor: l.valor.toString() })), mesTexto(c), c.vigenciaInicio)
  const faturado = separado?.ateOMes ?? null
  const avisos = Array.isArray(c.avisos) ? [...(c.avisos as string[])] : []
  if (separado && separado.ateOMes === null) {
    avisos.push('os meses da tabela do faturado não estão em ordem no documento — faturado até o mês não calculado; confira no PDF')
  }
  for (const rotulo of separado?.foraDeOrdem ?? []) avisos.push(`mês fora de ordem no documento: "${rotulo}" — contado pela posição na tabela`)
  if (separado && separado.semMes.length > 0) {
    const total = separado.semMes.reduce((s, l) => s + centavos(l.valor), 0) / 100
    avisos.push(`${moeda(total.toFixed(2))} em lançamento sem mês identificável (${separado.semMes.map((l) => l.rotulo).join(', ')}) ficam fora do faturado`)
  }
  const aFrente = separado?.aFrente.length
    ? { total: (separado.aFrente.reduce((s, l) => s + centavos(l.valor), 0) / 100).toFixed(2), periodos: separado.aFrente.map((l) => l.rotulo) }
    : null
  return {
    arquivoId: c.arquivoId,
    mes: mesTexto(c),
    sigla: c.sigla,
    contratoTexto: c.contratoTexto,
    contratoId: c.contratoId,
    clienteId: c.clienteId,
    clienteNome,
    termoTexto: c.termoTexto,
    vigenciaTexto: c.vigenciaTexto,
    vigenciaInicio: c.vigenciaInicio?.toISOString() ?? null,
    vigenciaFim: c.vigenciaFim?.toISOString() ?? null,
    previsto,
    faturado,
    faturadoDocumento,
    aFrente,
    saldoCalculado: previsto !== null && faturado !== null ? ((centavos(previsto) - centavos(faturado)) / 100).toFixed(2) : null,
    saldoDocumento: texto(c.saldoTotal),
    percentual: previsto !== null && faturado !== null && Number(previsto) > 0 ? Math.round((Number(faturado) / Number(previsto)) * 1000) / 10 : null,
    ultimoFaturado: separado?.ultimo ?? null,
    conferido: c.previstoConferido && c.faturadoConferido && faturado !== null,
    avisos,
  }
}

/** O controle do mês mais recente do contrato, com as linhas conferidas. */
export async function controleDoContrato(contratoId: string): Promise<{ controle: ControleSerializado; linhas: LinhaControle[] } | null> {
  const c = await prisma.controleContrato.findFirst({
    where: { contratoId },
    orderBy: [{ mesAno: 'desc' }, { mesMes: 'desc' }],
    include: { linhas: { orderBy: [{ tipo: 'asc' }, { posicao: 'asc' }] } },
  })
  if (!c) return null
  return {
    controle: serializarControle(c, null),
    linhas: c.linhas.map((l) => ({ tipo: l.tipo as LinhaControle['tipo'], rotulo: l.rotulo, valor: l.valor.toString() })),
  }
}

/** Todos os controles de um mês (padrão: o mais recente), só dos clientes permitidos (`null` = admin). */
export async function listarControles(filtro: {
  mes?: string
  clienteIds: string[] | null
}): Promise<{ meses: string[]; mes: string | null; controles: ControleSerializado[] }> {
  const meses = (
    await prisma.controleContrato.findMany({
      distinct: ['mesAno', 'mesMes'],
      select: { mesAno: true, mesMes: true },
      orderBy: [{ mesAno: 'desc' }, { mesMes: 'desc' }],
    })
  ).map(mesTexto)
  const mes = filtro.mes && meses.includes(filtro.mes) ? filtro.mes : (meses[0] ?? null)
  if (!mes) return { meses, mes: null, controles: [] }
  const [ano, m] = mes.split('-').map(Number)
  const lista = await prisma.controleContrato.findMany({
    where: { mesAno: ano, mesMes: m, ...(filtro.clienteIds === null ? {} : { clienteId: { in: filtro.clienteIds } }) },
    include: { linhas: { where: { tipo: 'faturado' }, orderBy: { posicao: 'asc' } } },
    orderBy: [{ sigla: 'asc' }, { contratoTexto: 'asc' }],
  })
  const ids = lista.map((c) => c.clienteId).filter((x): x is string => !!x)
  const clientes = new Map((await prisma.cliente.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } })).map((c) => [c.id, c.nome]))
  return { meses, mes, controles: lista.map((c) => serializarControle(c, c.clienteId ? (clientes.get(c.clienteId) ?? null) : null)) }
}
