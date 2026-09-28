import { nomeCompetencia } from '@/lib/competencia'
import type { ArquivoRepositorio } from './tipos'

// Contrato e competência de um arquivo são derivados de onde ele é usado (spec §7.1) — o arquivo
// em si não guarda nenhum dos dois, e pode estar em vários contratos/competências.

export interface ContratoDoUso {
  id: string
  numeroTermo: string | null
}

type ComUsos = Pick<ArquivoRepositorio, 'usos'>

export function contratosDoArquivo(arquivo: ComUsos): ContratoDoUso[] {
  const vistos = new Map<string, ContratoDoUso>()
  for (const uso of arquivo.usos) if (uso.contrato && !vistos.has(uso.contrato.id)) vistos.set(uso.contrato.id, uso.contrato)
  return [...vistos.values()]
}

export function competenciasDoArquivo(arquivo: ComUsos): Array<{ ano: number; mes: number }> {
  const vistas = new Map<number, { ano: number; mes: number }>()
  for (const uso of arquivo.usos) if (uso.competencia) vistas.set(uso.competencia.ano * 100 + uso.competencia.mes, uso.competencia)
  return [...vistas.entries()].sort(([a], [b]) => b - a).map(([, c]) => c)
}

export function rotuloContratos(arquivo: ComUsos): string {
  const contratos = contratosDoArquivo(arquivo)
  return contratos.length ? contratos.map((c) => c.numeroTermo ?? '(sem número)').join(', ') : '—'
}

export function rotuloCompetencias(arquivo: ComUsos): string {
  const competencias = competenciasDoArquivo(arquivo)
  return competencias.length ? competencias.map((c) => nomeCompetencia(c.ano, c.mes)).join(', ') : '—'
}

export function opcoesDeContrato(arquivos: ComUsos[]): ContratoDoUso[] {
  const todos = new Map<string, ContratoDoUso>()
  for (const arquivo of arquivos) for (const c of contratosDoArquivo(arquivo)) todos.set(c.id, c)
  return [...todos.values()].sort((a, b) => {
    if (a.numeroTermo === null) return b.numeroTermo === null ? 0 : 1
    if (b.numeroTermo === null) return -1
    return a.numeroTermo.localeCompare(b.numeroTermo, 'pt-BR')
  })
}

/** Arquivo que veio do SharePoint e saiu de lá, mas ficou porque algo do VerAI ainda o usa
 *  (spec docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md §3.1). */
export function foraDoSharepoint(arquivo: Pick<ArquivoRepositorio, 'origem' | 'usos'>): boolean {
  return arquivo.origem === 'sharepoint' && !arquivo.usos.some((u) => u.tipo === 'sharepoint')
}

/** Coluna do histórico do contrato: PC/PA = `proposta`, TC/TA = `termo`. */
export type ColunaDoContrato = 'proposta' | 'termo'

const CATEGORIAS_DA_COLUNA: Record<ColunaDoContrato, string[]> = {
  proposta: ['PROPOSTA_COMERCIAL', 'PROPOSTA_ADITIVO'],
  termo: ['TERMO_CONTRATO', 'TERMO_ADITIVO'],
}

/** PC/PA ou TC/TA de um contrato: o arquivo está naquela coluna de alguma linha do histórico dele, ou
 *  é da categoria da coluna e está ligado a ele (ex.: na pasta do contrato no SharePoint). */
export function documentosDoContrato<T extends Pick<ArquivoRepositorio, 'categoria' | 'usos'>>(
  arquivos: T[],
  contratoId: string,
  coluna: ColunaDoContrato
): T[] {
  const daCategoria = (a: T) => CATEGORIAS_DA_COLUNA[coluna].includes(a.categoria)
  return arquivos.filter((a) => a.usos.some((u) => u.contrato?.id === contratoId && (u.coluna === coluna || daCategoria(a))))
}
