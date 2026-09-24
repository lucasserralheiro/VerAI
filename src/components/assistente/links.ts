export type DestinoLink =
  | { tipo: 'sei'; numero: string }
  | { tipo: 'interno'; href: string }
  | { tipo: 'externo'; href: string }
  | { tipo: 'texto' }

/** Link vindo de texto gerado por IA: só três formas são aceitas; o resto vira texto puro. */
export function destinoDoLink(href: string | undefined): DestinoLink {
  if (!href) return { tipo: 'texto' }
  if (href.startsWith('sei:')) return { tipo: 'sei', numero: href.slice(4) }
  if (href.startsWith('/') && !href.startsWith('//')) return { tipo: 'interno', href }
  if (/^https:\/\//i.test(href)) return { tipo: 'externo', href }
  return { tipo: 'texto' }
}
