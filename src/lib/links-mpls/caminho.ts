import type { CategoriaLinks } from './tipos'

// Competência, categoria e sigla de um relatório de links pelo caminho (spec 2026-09-29-links-mpls §4.1–4.2).
// Competência = a pasta do mês ("2026.09 - Relatórios de Setembro de 2026"); o nome do arquivo erra o mês.

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()

export function competenciaDoCaminho(caminho: string): { ano: number; mes: number } | null {
  for (const parte of caminho.split('/')) {
    const m = /^(\d{4})\.(\d{2})(?!\d)/.exec(parte.trim())
    if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { ano: Number(m[1]), mes: Number(m[2]) }
  }
  return null
}

/** As nove grafias reais da pasta ("Gerencimento de Links", "Links Sociais", "Links - Solução"…). */
export function categoriaDoCaminho(caminho: string): CategoriaLinks {
  const partes = caminho.split('/')
  const mes = partes.findIndex((p) => /^\d{4}\.\d{2}(?!\d)/.test(p.trim()))
  const pasta = semAcento(mes >= 0 ? (partes[mes + 1] ?? '') : '')
  if (mes < 0 || mes + 1 >= partes.length - 1) return 'OUTRA'
  if (/GEREN/.test(pasta)) return 'GERENCIAMENTO'
  if (/SOCIA/.test(pasta)) return 'SOCIAL'
  if (/SOLU/.test(pasta)) return 'SOLUCAO'
  return 'OUTRA'
}

/** "CGM 09-2026 - Links - TC 16-CGM -2024.pdf" → "CGM"; "SMSUB 09-2026- Links…" → "SMSUB". */
export function siglaDoArquivo(nome: string): string {
  return (nome.trim().split(/[\s]+/)[0] ?? '').replace(/-?\d{2}-\d{4}.*$/, '').toUpperCase()
}

/** Parte do contrato no nome do arquivo ("TC 16-CGM -2024", "TC001-SMSUB-COGEL-2026"). */
export function contratoDoArquivo(nome: string): string | null {
  return /\bT\.?C\.?\s*[\dSN][\s\S]*?(?=\.pdf$|\s*\(|$)/i.exec(nome)?.[0]?.trim() ?? null
}
