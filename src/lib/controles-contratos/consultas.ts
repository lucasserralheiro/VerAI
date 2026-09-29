import type { ControleContrato, ControleContratoLinha } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { ControleSerializado, LinhaControle } from './tipos'

// Consultas dos Controles de Contratos (spec docs/superpowers/specs/2026-09-29-controles-de-contratos-design.md
// §6–7). Totais só dos conferidos (o leitor grava `null` quando a tabela não fecha).

const mesTexto = (c: { mesAno: number; mesMes: number }) => `${c.mesAno}-${String(c.mesMes).padStart(2, '0')}`
const texto = (d: { toString(): string } | null) => (d === null ? null : d.toString())
const centavos = (v: string) => Math.round(Number(v) * 100)

function serializar(c: ControleContrato & { linhas?: ControleContratoLinha[] }, clienteNome: string | null): ControleSerializado {
  const previsto = texto(c.previstoTotal)
  const faturado = texto(c.faturadoTotal)
  const faturados = (c.linhas ?? []).filter((l) => l.tipo === 'faturado' && Number(l.valor) !== 0)
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
    saldoCalculado: previsto !== null && faturado !== null ? ((centavos(previsto) - centavos(faturado)) / 100).toFixed(2) : null,
    saldoDocumento: texto(c.saldoTotal),
    percentual: previsto !== null && faturado !== null && Number(previsto) > 0 ? Math.round((Number(faturado) / Number(previsto)) * 1000) / 10 : null,
    ultimoFaturado: faturados.length > 0 ? faturados[faturados.length - 1].rotulo : null,
    conferido: c.previstoConferido && c.faturadoConferido,
    avisos: Array.isArray(c.avisos) ? (c.avisos as string[]) : [],
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
    controle: serializar(c, null),
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
  return { meses, mes, controles: lista.map((c) => serializar(c, c.clienteId ? (clientes.get(c.clienteId) ?? null) : null)) }
}
