import type { PrismaClient } from '@prisma/client'
import { normalizarChave, siglaDaPasta, type ClientePorSigla, type MapaPastas } from '@/lib/arquivos/sharepoint/regras'

// Cliente de cada pasta da biblioteca ContratosReceita (spec 2026-09-24 §8.3, mantida pela spec
// lugar-certo): pela sigla — a própria pasta ou o mapa `pastas` de scripts/sharepoint-clientes.json.
// Cria o que falta com o nome oficial de `nomes`; corrige cliente cujo nome é só a sigla. Nunca casa
// por nome, e é o ÚNICO lugar da sincronização que cria cliente.

export interface ResultadoClientes {
  clientes: ClientePorSigla
  criados: string[]
  renomeados: string[]
  semNomeOficial: string[]
}

export async function garantirClientes(
  db: Pick<PrismaClient, 'cliente'>,
  p: { aplicar: boolean; pastas: string[]; mapa: MapaPastas; nomes: Record<string, string> }
): Promise<ResultadoClientes> {
  const existentes = await db.cliente.findMany({ where: { siglaLegado: { not: null } }, select: { id: true, nome: true, siglaLegado: true } })
  const clientes: ClientePorSigla = new Map(existentes.map((c) => [normalizarChave(c.siglaLegado!), { id: c.id, nome: c.nome }]))
  const nomesPorSigla = new Map(Object.entries(p.nomes).map(([s, n]) => [normalizarChave(s), n]))
  const r: ResultadoClientes = { clientes, criados: [], renomeados: [], semNomeOficial: [] }

  for (const pasta of [...new Set(p.pastas)].sort()) {
    const sigla = siglaDaPasta(pasta, p.mapa)
    if (sigla === null || clientes.has(sigla)) continue
    const nome = nomesPorSigla.get(sigla)
    if (!nome) r.semNomeOficial.push(sigla)
    r.criados.push(`${sigla} — ${nome ?? sigla}`)
    const id = p.aplicar
      ? (await db.cliente.create({ data: { nome: nome ?? sigla, siglaLegado: sigla }, select: { id: true } })).id
      : `simulado:${sigla}`
    clientes.set(sigla, { id, nome: nome ?? sigla })
  }

  for (const c of existentes) {
    const sigla = normalizarChave(c.siglaLegado!)
    const oficial = nomesPorSigla.get(sigla)
    if (oficial && normalizarChave(c.nome) === sigla) {
      r.renomeados.push(`${c.nome} → ${oficial}`)
      if (p.aplicar) await db.cliente.update({ where: { id: c.id }, data: { nome: oficial } })
    }
  }
  return r
}
