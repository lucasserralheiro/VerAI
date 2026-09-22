const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** `1234.5` → `R$ 1.234,50`; `null`/não numérico → `—`. Aceita o `Decimal` serializado como string. */
export function formatarMoeda(valor: string | number | null): string {
  if (valor === null || (typeof valor === 'string' && valor.trim() === '')) return '—'
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return '—'
  // O Intl separa "R$" do número com espaço não quebrável; normaliza pra espaço comum.
  return moeda.format(numero).replace(/ /g, ' ')
}

/** ISO (`2026-09-22T00:00:00.000Z` ou `2026-09-22`) → `22/09/2026`, pelo dia em UTC; `null` → `—`. */
export function formatarData(iso: string | null): string {
  if (!iso) return '—'
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return '—'
  const dia = String(data.getUTCDate()).padStart(2, '0')
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${data.getUTCFullYear()}`
}
