import type { LinkMpls, RelatorioLinks } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { diferencaDeLinks, type CategoriaLinks, type LinkSerializado, type RelatorioDoContrato, type RelatorioResumo } from './tipos'

// Consultas dos Links MPLS (spec docs/superpowers/specs/2026-09-29-links-mpls-design.md §6–8). Contagens e
// diferenças só de relatório conferido; permissão por cliente (`clienteIds` null = admin, vê também o que não
// casou com contrato).

const comp = (r: { ano: number; mes: number }) => `${r.ano}-${String(r.mes).padStart(2, '0')}`
const anterior = (c: string) => {
  const [a, m] = c.split('-').map(Number)
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`
}
const partes = (c: string) => {
  const [ano, mes] = c.split('-').map(Number)
  return { ano, mes }
}

export function serializarLink(l: LinkMpls): LinkSerializado {
  return {
    codigo: l.codigo,
    situacao: l.situacao === 'CANCELADO' ? 'CANCELADO' : 'ATIVO',
    kbps: l.kbps,
    redundancia: l.redundancia,
    dataAceite: l.dataAceite?.toISOString() ?? null,
    dataCancelamento: l.dataCancelamento?.toISOString() ?? null,
    entidade: l.entidade,
    endereco: [l.tipoLogradouro, l.endereco, l.numero].filter(Boolean).join(' ') || null,
  }
}

type ComLinks = RelatorioLinks & { links: LinkMpls[] }

/** Resumo de um relatório, com a diferença para o do mês anterior (mesmo contrato e categoria, ambos conferidos). */
export function resumir(r: ComLinks, antes: ComLinks | undefined, clienteNome: string | null): RelatorioResumo {
  const ativos = (x: ComLinks) => x.links.filter((l) => l.situacao === 'ATIVO')
  const dif = r.conferido && antes?.conferido ? diferencaDeLinks(ativos(r), ativos(antes)) : null
  return {
    id: r.id,
    arquivoId: r.arquivoId,
    competencia: comp(r),
    sigla: r.sigla,
    clienteId: r.clienteId,
    clienteNome,
    contratoId: r.contratoId,
    contratoTexto: r.contratoTexto,
    categoria: r.categoria as CategoriaLinks,
    ativos: r.conferido ? r.ativos : null,
    cancelados: r.conferido ? r.cancelados : null,
    conferido: r.conferido,
    avisos: Array.isArray(r.avisos) ? (r.avisos as string[]) : [],
    entraram: dif ? dif.entraram.length : null,
    sairam: dif ? dif.sairam.length : null,
  }
}

const doAnterior = (r: RelatorioLinks, anteriores: ComLinks[]) =>
  r.contratoId ? anteriores.find((a) => a.contratoId === r.contratoId && a.categoria === r.categoria) : undefined

async function nomesDosClientes(ids: (string | null)[]) {
  const validos = [...new Set(ids.filter((x): x is string => !!x))]
  return new Map((await prisma.cliente.findMany({ where: { id: { in: validos } }, select: { id: true, nome: true } })).map((c) => [c.id, c.nome]))
}

const filtroCliente = (clienteIds: string[] | null) => (clienteIds === null ? {} : { clienteId: { in: clienteIds } })

export async function listarLinks(filtro: {
  competencia?: string
  clienteIds: string[] | null
}): Promise<{ competencias: string[]; competencia: string | null; relatorios: RelatorioResumo[] }> {
  const competencias = (
    await prisma.relatorioLinks.findMany({
      where: filtroCliente(filtro.clienteIds),
      distinct: ['ano', 'mes'],
      select: { ano: true, mes: true },
      orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
    })
  ).map(comp)
  const competencia = filtro.competencia && competencias.includes(filtro.competencia) ? filtro.competencia : (competencias[0] ?? null)
  if (!competencia) return { competencias, competencia: null, relatorios: [] }
  const [doMes, doAnteriorMes] = await Promise.all(
    [competencia, anterior(competencia)].map((c) =>
      prisma.relatorioLinks.findMany({
        where: { ...partes(c), ...filtroCliente(filtro.clienteIds) },
        include: { links: { where: { situacao: 'ATIVO' }, orderBy: { posicao: 'asc' } } },
        orderBy: [{ sigla: 'asc' }, { categoria: 'asc' }],
      })
    )
  )
  const nomes = await nomesDosClientes(doMes.map((r) => r.clienteId))
  return {
    competencias,
    competencia,
    relatorios: doMes.map((r) => resumir(r, doAnterior(r, doAnteriorMes), r.clienteId ? (nomes.get(r.clienteId) ?? null) : null)),
  }
}

/** Série mês a mês do contrato (ativos por categoria, só conferidos) e os relatórios do mês pedido com os links. */
export async function linksDoContrato(
  contratoId: string,
  competencia?: string
): Promise<{ serie: { competencia: string; categoria: CategoriaLinks; ativos: number }[]; competencias: string[]; competencia: string | null; relatorios: RelatorioDoContrato[] }> {
  const todos = await prisma.relatorioLinks.findMany({
    where: { contratoId },
    select: { ano: true, mes: true, categoria: true, ativos: true, conferido: true },
    orderBy: [{ ano: 'asc' }, { mes: 'asc' }],
  })
  const competencias = [...new Set(todos.map(comp))].reverse()
  const escolhida = competencia && competencias.includes(competencia) ? competencia : (competencias[0] ?? null)
  const serie = todos.filter((r) => r.conferido && r.ativos !== null).map((r) => ({ competencia: comp(r), categoria: r.categoria as CategoriaLinks, ativos: r.ativos! }))
  if (!escolhida) return { serie, competencias, competencia: null, relatorios: [] }
  const [doMes, doAnteriorMes] = await Promise.all(
    [escolhida, anterior(escolhida)].map((c) =>
      prisma.relatorioLinks.findMany({ where: { contratoId, ...partes(c) }, include: { links: { orderBy: { posicao: 'asc' } } }, orderBy: { categoria: 'asc' } })
    )
  )
  const nomes = await nomesDosClientes(doMes.map((r) => r.clienteId))
  const relatorios = doMes.map((r) => {
    const antes = doAnterior(r, doAnteriorMes)
    const dif = r.conferido && antes?.conferido ? diferencaDeLinks(r.links.filter((l) => l.situacao === 'ATIVO'), antes.links.filter((l) => l.situacao === 'ATIVO')) : null
    return {
      ...resumir(r, antes, r.clienteId ? (nomes.get(r.clienteId) ?? null) : null),
      links: r.conferido ? r.links.map(serializarLink) : [],
      entraramLinks: dif ? dif.entraram.map(serializarLink) : [],
      sairamLinks: dif ? dif.sairam.map(serializarLink) : [],
    }
  })
  return { serie, competencias, competencia: escolhida, relatorios }
}

/** Resumo curto para o detalhe do contrato: ativos do mês mais recente conferido, por categoria. */
export async function resumoDosLinksDoContrato(contratoId: string): Promise<{ competencia: string; ativos: number; categorias: CategoriaLinks[] } | null> {
  const recentes = await prisma.relatorioLinks.findMany({
    where: { contratoId, conferido: true },
    select: { ano: true, mes: true, categoria: true, ativos: true },
    orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
  })
  if (recentes.length === 0) return null
  const c = comp(recentes[0])
  const doMes = recentes.filter((r) => comp(r) === c)
  return { competencia: c, ativos: doMes.reduce((s, r) => s + (r.ativos ?? 0), 0), categorias: doMes.map((r) => r.categoria as CategoriaLinks) }
}
