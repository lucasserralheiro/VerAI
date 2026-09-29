// Contrato e mês de um PDF de Controles de Contratos pelo caminho (spec 2026-09-29-controles-de-contratos
// §4.2–4.3). Chave = "nº ano" (a mesma parte numérica da chave do SharePoint "SIGLA|nº ano"); ano de 2 dígitos
// vira 4.

function numeroEAno(texto: string): string | null {
  const numeros = texto.split(/[^0-9]+/).filter(Boolean)
  if (numeros.length < 2) return null
  const numero = String(Number(numeros[0]))
  for (const n of numeros.slice(1)) {
    const valor = Number(n)
    if (n.length === 4 && valor >= 2000 && valor <= 2100) return `${numero} ${valor}`
    if (n.length === 2 && valor >= 10) return `${numero} ${2000 + valor}`
  }
  return null
}

/** "CGM - CO-16-CGM-2024 (Sust…) - 2026.08.pdf" → { sigla: "CGM", chave: "16 2024" }. */
export function contratoDoNome(nome: string): { sigla: string; chave: string | null } {
  const partes = nome.split(' - ')
  const sigla = (partes[0] ?? '').trim().toUpperCase()
  const resto = partes
    .slice(1)
    .join(' - ')
    .replace(/\s*-\s*\d{4}\.\d{2}\.pdf$/i, '')
    .replace(/\([^)]*\)/g, ' ')
  return { sigla, chave: numeroEAno(resto) }
}

/** Contrato do cabeçalho do PDF ("CO 16/CGM/2024") → "16 2024". */
export function chaveDoContratoTexto(texto: string | null): string | null {
  return texto ? numeroEAno(texto) : null
}

/** Pasta "08.2026" → agosto de 2026. */
export function mesDoCaminho(caminho: string): { ano: number; mes: number } | null {
  for (const parte of caminho.split('/')) {
    const m = /^(\d{2})\.(\d{4})$/.exec(parte.trim())
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return { ano: Number(m[2]), mes: Number(m[1]) }
  }
  return null
}
