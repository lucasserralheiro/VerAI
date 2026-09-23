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
