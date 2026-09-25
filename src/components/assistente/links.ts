export type DestinoLink =
  | { tipo: 'sei'; numero: string }
  | { tipo: 'interno'; href: string }
  | { tipo: 'externo'; href: string }
  | { tipo: 'texto' }

const ORIGEM_NEUTRA = 'http://verai.invalido'

/** `href` começando com `/` deveria ser sempre relativo à origem atual — mas o parser de URL trata
 *  `\` como `/` em esquemas especiais, então "/\evil.com" vira "//evil.com" (protocol-relative) e
 *  troca de origem. Resolve contra uma base neutra e exige que a origem não mude. */
function mesmaOrigem(href: string): boolean {
  try {
    return new URL(href, ORIGEM_NEUTRA).origin === ORIGEM_NEUTRA
  } catch {
    return false
  }
}

/** Link vindo de texto gerado por IA: só três formas são aceitas; o resto vira texto puro. */
export function destinoDoLink(href: string | undefined): DestinoLink {
  if (!href) return { tipo: 'texto' }
  if (href.startsWith('sei:')) return { tipo: 'sei', numero: href.slice(4) }
  if (href.startsWith('/') && !href.startsWith('//') && mesmaOrigem(href)) return { tipo: 'interno', href }
  if (/^https:\/\//i.test(href)) return { tipo: 'externo', href }
  return { tipo: 'texto' }
}
