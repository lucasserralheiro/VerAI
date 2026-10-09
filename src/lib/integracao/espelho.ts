import type { FonteExterna, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

import { chaveDaGerencia, siglaComparavel } from './chaves'

// O VerAI como CONSUMIDOR da API de plataforma de outros sistemas (FonteExterna — o AIBertinho é uma).
// Para cada recurso escolhido, lê `GET <url>/api/v1/<recurso>` com a chave que a fonte emitiu e guarda
// em EspelhoRegistro (origem = slug da fonte) uma cópia SOMENTE-LEITURA: regrava só o registro cujo hash
// mudou e apaga o que sumiu. Ninguém edita a cópia. Disparos: webhook da fonte (/api/v1/webhooks/:slug),
// passada de 15 min no carregamento da lista de clientes e cron diário. Nunca lança.
// Spec docs/superpowers/specs/2026-10-08-api-plataforma-design.md §6.

interface RegistroRemoto {
  id: string
  chaveCliente: string | null
  chaveGerencia: string | null
  hash: string
  dados: Record<string, unknown>
}

interface ListaRemota {
  hash: string
  total: number
  pagina: number
  paginas: number
  data: RegistroRemoto[]
}

export interface ResumoDoRecurso {
  fonte: string
  recurso: string
  resultado: 'igual' | 'atualizado' | 'sem-permissao' | 'erro'
  novos?: number
  mudados?: number
  removidos?: number
  erro?: string
}

const TEMPO_LIMITE_MS = 30_000
const POR_PAGINA = 1000
const LOTE = 500

type FonteParaLer = Pick<FonteExterna, 'slug' | 'url' | 'chave'>

class SemPermissao extends Error {}

async function buscarPagina(fonte: FonteParaLer, recurso: string, pagina: number): Promise<ListaRemota> {
  const base = fonte.url.replace(/\/$/, '')
  const resposta = await fetch(`${base}/api/v1/${encodeURIComponent(recurso)}?pagina=${pagina}&limite=${POR_PAGINA}`, {
    headers: { authorization: `Bearer ${fonte.chave}`, accept: 'application/json' },
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    cache: 'no-store',
  })
  if (resposta.status === 403) throw new SemPermissao(`a fonte não libera ${recurso} para a chave do VerAI`)
  if (!resposta.ok) throw new Error(`${recurso} p.${pagina}: HTTP ${resposta.status}`)
  const corpo = (await resposta.json()) as Partial<ListaRemota> & { objeto?: string }
  if (corpo.objeto !== 'lista' || !Array.isArray(corpo.data)) throw new Error(`${recurso}: resposta fora do formato da API v1`)
  return corpo as ListaRemota
}

/** Diferença entre o gravado e o que veio (função pura — testável sem banco). */
export function diferenca(
  existentes: { id: string; idOrigem: string; hash: string }[],
  registros: RegistroRemoto[]
): { novos: RegistroRemoto[]; mudados: { id: string; registro: RegistroRemoto }[]; removidos: string[] } {
  const porOrigem = new Map(existentes.map((e) => [e.idOrigem, e]))
  const vistos = new Set<string>()
  const novos: RegistroRemoto[] = []
  const mudados: { id: string; registro: RegistroRemoto }[] = []
  for (const r of registros) {
    if (vistos.has(r.id)) continue
    vistos.add(r.id)
    const e = porOrigem.get(r.id)
    if (!e) novos.push(r)
    else if (e.hash !== r.hash) mudados.push({ id: e.id, registro: r })
  }
  const removidos = existentes.filter((e) => !vistos.has(e.idOrigem)).map((e) => e.id)
  return { novos, mudados, removidos }
}

function lotes<T>(lista: T[]): T[][] {
  const saida: T[][] = []
  for (let i = 0; i < lista.length; i += LOTE) saida.push(lista.slice(i, i + LOTE))
  return saida
}

async function aplicar(origem: string, entidade: string, registros: RegistroRemoto[]) {
  const existentes = await prisma.espelhoRegistro.findMany({ where: { origem, entidade }, select: { id: true, idOrigem: true, hash: true } })
  const { novos, mudados, removidos } = diferenca(existentes, registros)
  const agora = new Date()
  const campos = (r: RegistroRemoto) => ({
    chaveCliente: r.chaveCliente,
    chaveGerencia: r.chaveGerencia,
    dados: r.dados as Prisma.InputJsonValue,
    hash: r.hash,
    atualizadoEm: agora,
  })
  await prisma.$transaction([
    ...lotes(removidos).map((ids) => prisma.espelhoRegistro.deleteMany({ where: { id: { in: ids } } })),
    ...lotes(novos).map((lote) =>
      prisma.espelhoRegistro.createMany({ data: lote.map((r) => ({ origem, entidade, idOrigem: r.id, ...campos(r) })), skipDuplicates: true })
    ),
    ...mudados.map((m) => prisma.espelhoRegistro.update({ where: { id: m.id }, data: campos(m.registro) })),
  ])
  return { novos: novos.length, mudados: mudados.length, removidos: removidos.length }
}

interface CamposDoEstado {
  hash?: string | null
  total?: number
  sincronizadoEm?: Date
  tentativaEm?: Date
  erro?: string | null
  publicadaNaOrigem?: boolean
}

async function gravarEstado(origem: string, entidade: string, dados: CamposDoEstado) {
  await prisma.espelhoEstado.upsert({
    where: { origem_entidade: { origem, entidade } },
    create: { origem, entidade, ...dados },
    update: dados,
  })
}

export async function sincronizarRecurso(fonte: FonteParaLer, recurso: string): Promise<ResumoDoRecurso> {
  const base = { fonte: fonte.slug, recurso }
  try {
    const estado = await prisma.espelhoEstado.findUnique({ where: { origem_entidade: { origem: fonte.slug, entidade: recurso } }, select: { hash: true } })
    await gravarEstado(fonte.slug, recurso, { tentativaEm: new Date() })
    const primeira = await buscarPagina(fonte, recurso, 1)
    if (estado?.hash && estado.hash === primeira.hash) {
      await gravarEstado(fonte.slug, recurso, { sincronizadoEm: new Date(), erro: null, publicadaNaOrigem: true })
      return { ...base, resultado: 'igual' }
    }
    const registros = [...primeira.data]
    for (let p = 2; p <= primeira.paginas; p++) {
      const pagina = await buscarPagina(fonte, recurso, p)
      // Mudou no meio da leitura: aplicar uma mistura de dois momentos seria pior que esperar a próxima.
      if (pagina.hash !== primeira.hash) throw new Error(`${recurso} mudou durante a leitura; fica para a próxima`)
      registros.push(...pagina.data)
    }
    const contagem = await aplicar(fonte.slug, recurso, registros)
    await gravarEstado(fonte.slug, recurso, { hash: primeira.hash, total: primeira.total, sincronizadoEm: new Date(), erro: null, publicadaNaOrigem: true })
    return { ...base, resultado: 'atualizado', ...contagem }
  } catch (erro) {
    if (erro instanceof SemPermissao) {
      // A fonte tirou o escopo da nossa chave: a cópia daquele recurso sai daqui também.
      await prisma.espelhoRegistro.deleteMany({ where: { origem: fonte.slug, entidade: recurso } }).catch(() => undefined)
      await gravarEstado(fonte.slug, recurso, { hash: null, total: 0, erro: null, publicadaNaOrigem: false, sincronizadoEm: new Date() }).catch(() => undefined)
      return { ...base, resultado: 'sem-permissao' }
    }
    const mensagem = erro instanceof Error ? erro.message : String(erro)
    console.warn('[integracao] espelho', fonte.slug, recurso, mensagem)
    await gravarEstado(fonte.slug, recurso, { erro: mensagem.slice(0, 500) }).catch(() => undefined)
    return { ...base, resultado: 'erro', erro: mensagem }
  }
}

/** Sincroniza uma fonte: os recursos pedidos (só os que ela tem configurados) ou todos os dela. */
export async function sincronizarFonte(fonte: FonteExterna, recursos?: string[]): Promise<ResumoDoRecurso[]> {
  const alvo = recursos?.length ? fonte.recursos.filter((r) => recursos.includes(r)) : fonte.recursos
  const resumo: ResumoDoRecurso[] = []
  for (const recurso of alvo) resumo.push(await sincronizarRecurso(fonte, recurso))
  return resumo
}

export async function sincronizarTodasAsFontes(): Promise<ResumoDoRecurso[]> {
  const fontes = await prisma.fonteExterna.findMany({ where: { ativa: true } })
  const resumo: ResumoDoRecurso[] = []
  for (const fonte of fontes) resumo.push(...(await sincronizarFonte(fonte)))
  return resumo
}

/** Rede de segurança: sincroniza o recurso de fonte ativa cuja última passada tem mais de `minutos`. Nunca lança. */
export async function sincronizarFontesSeVelhas(minutos = 15): Promise<void> {
  try {
    const fontes = await prisma.fonteExterna.findMany({ where: { ativa: true } })
    if (fontes.length === 0) return
    const estados = await prisma.espelhoEstado.findMany({
      where: { origem: { in: fontes.map((f) => f.slug) } },
      select: { origem: true, entidade: true, sincronizadoEm: true, tentativaEm: true },
    })
    const limite = Date.now() - minutos * 60_000
    for (const fonte of fontes) {
      const velhos = fonte.recursos.filter((recurso) => {
        const e = estados.find((x) => x.origem === fonte.slug && x.entidade === recurso)
        return Math.max(e?.sincronizadoEm?.getTime() ?? 0, e?.tentativaEm?.getTime() ?? 0) < limite
      })
      if (velhos.length) await sincronizarFonte(fonte, velhos)
    }
  } catch (erro) {
    console.warn('[integracao] espelho (passada periódica)', erro)
  }
}

/** Apaga a cópia de recursos de uma fonte (recurso desmarcado, fonte excluída). */
export async function apagarCopia(origem: string, recursos?: string[]) {
  const filtro = recursos ? { origem, entidade: { in: recursos } } : { origem }
  await prisma.$transaction([prisma.espelhoRegistro.deleteMany({ where: filtro }), prisma.espelhoEstado.deleteMany({ where: filtro })])
}

export async function estadoDaFonte(slug: string, recursos: string[]) {
  const estados = await prisma.espelhoEstado.findMany({ where: { origem: slug } })
  return recursos.map((recurso) => {
    const e = estados.find((x) => x.entidade === recurso)
    return {
      recurso,
      total: e?.total ?? 0,
      sincronizadoEm: e?.sincronizadoEm?.toISOString() ?? null,
      erro: e?.erro ?? null,
      liberadoPelaFonte: e ? e.publicadaNaOrigem : null,
    }
  })
}

function agrupar(linhas: { origem: string; entidade: string; dados: Prisma.JsonValue }[]) {
  const grupos: Record<string, Record<string, unknown[]>> = {}
  for (const l of linhas) ((grupos[l.origem] ??= {})[l.entidade] ??= []).push(l.dados)
  return grupos
}

/** Tudo o que as fontes externas sabem de UM cliente: `{ [fonte]: { [recurso]: dados[] } }`. Sem rede. */
export async function espelhoDoCliente(sigla: string) {
  const chave = siglaComparavel(sigla)
  if (!chave) return {}
  return agrupar(
    await prisma.espelhoRegistro.findMany({ where: { chaveCliente: chave }, orderBy: [{ entidade: 'asc' }, { idOrigem: 'asc' }], select: { origem: true, entidade: true, dados: true } })
  )
}

/** Tudo o que as fontes externas sabem de UMA gerência ("GRC-4", "grc4"...). */
export async function espelhoDaGerencia(gerencia: string) {
  const chave = chaveDaGerencia(gerencia)
  if (!chave) return {}
  return agrupar(
    await prisma.espelhoRegistro.findMany({ where: { chaveGerencia: chave }, orderBy: [{ entidade: 'asc' }, { idOrigem: 'asc' }], select: { origem: true, entidade: true, dados: true } })
  )
}
