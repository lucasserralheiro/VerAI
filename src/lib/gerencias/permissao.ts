// Regra única de gerência e carteira (spec docs/superpowers/specs/2026-10-02-gerencias-carteira-clientes-design.md §3).
// Pura: quem consulta o banco é `podeEditarCliente` (visibilidade.ts) e o serviço de gerências.

export type PapelGerencia = 'manager' | 'usuario'
export const PAPEIS: readonly PapelGerencia[] = ['manager', 'usuario']

export interface Vinculo {
  gerenciaId: string
  papel: PapelGerencia
}

/** Fase A: quem tinha o cliente em `clientesPermitidos` continua editando até as carteiras estarem montadas. A
 *  Fase B (Task 15 do plano) apaga esta constante e o campo `liberadoNoModeloAntigo`. */
export const TRANSICAO_CLIENTES_PERMITIDOS = true

export function decidirEdicao(s: {
  ehAdmin: boolean
  membroDaGerenciaDoCliente: boolean
  liberadoNoModeloAntigo: boolean
}): boolean {
  if (s.ehAdmin || s.membroDaGerenciaDoCliente) return true
  return TRANSICAO_CLIENTES_PERMITIDOS && s.liberadoNoModeloAntigo
}

export function podeVerDetalheGerencia(ehAdmin: boolean, vinculos: Vinculo[], gerenciaId: string): boolean {
  return ehAdmin || vinculos.some((v) => v.gerenciaId === gerenciaId)
}

export type Decisao = { ok: true } | { ok: false; motivo: string }

/** `papelAtual` null = a pessoa ainda não está na equipe; `papelNovo` null = sai da equipe. */
export function decidirMudancaNaEquipe(s: {
  ehAdmin: boolean
  vinculos: Vinculo[]
  gerenciaId: string
  papelAtual: PapelGerencia | null
  papelNovo: PapelGerencia | null
}): Decisao {
  if (s.ehAdmin) return { ok: true }
  const ehManager = s.vinculos.some((v) => v.gerenciaId === s.gerenciaId && v.papel === 'manager')
  if (!ehManager) return { ok: false, motivo: 'Só o manager desta gerência ou o administrador mexe na equipe.' }
  if (s.papelAtual === 'manager' || s.papelNovo === 'manager') {
    return { ok: false, motivo: 'Só o administrador nomeia ou tira manager.' }
  }
  return { ok: true }
}
