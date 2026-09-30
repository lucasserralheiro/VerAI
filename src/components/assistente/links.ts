export type DestinoLink =
  | { tipo: 'sei'; numero: string }
  | { tipo: 'interno'; href: string }
  | { tipo: 'externo'; href: string }
  | { tipo: 'aviso' }
  | { tipo: 'texto' }

export const TIPOS_LINK = ['cliente', 'contrato', 'faturamento', 'demanda', 'documento', 'proposta', 'confere', 'fornecedor'] as const
export type TipoLink = (typeof TIPOS_LINK)[number]

/** Esquemas que o markdown da resposta precisa deixar passar (o `urlTransform` padrão os apaga). */
export const ESQUEMA_PROPRIO = new RegExp(`^(sei|aviso|${TIPOS_LINK.join('|')}):`)
/** Link curto que a IA escreve (`contrato:ID`) — economiza o `href` inteiro em cada linha de tabela. */
const LINK_CURTO = new RegExp(`^(${TIPOS_LINK.join('|')}):([A-Za-z0-9_-]{1,64})$`)

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

/** Link vindo de texto gerado por IA: só estas formas são aceitas; o resto vira texto puro. */
export function destinoDoLink(href: string | undefined): DestinoLink {
  if (!href) return { tipo: 'texto' }
  if (href === 'aviso:nao-confirmado') return { tipo: 'aviso' }
  if (href.startsWith('sei:')) return { tipo: 'sei', numero: href.slice(4) }
  const curto = LINK_CURTO.exec(href)
  if (curto) return { tipo: 'interno', href: `/ir/${curto[1]}/${curto[2]}` }
  if (ESQUEMA_PROPRIO.test(href)) return { tipo: 'texto' }
  if (href.startsWith('/') && !href.startsWith('//') && mesmaOrigem(href)) return { tipo: 'interno', href }
  if (/^https:\/\//i.test(href)) return { tipo: 'externo', href }
  return { tipo: 'texto' }
}
