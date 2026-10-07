export interface ClienteOpcao {
  id: string
  nome: string
}

export interface Usuario {
  id: string
  nome: string
  email: string
  role: string
  createdAt: string
  clientesPermitidos: ClienteOpcao[]
  gerencias?: Array<{ papel: string; gerencia: { nome: string } }>
}

export const PERFIS = [
  { valor: 'admin', rotulo: 'Admin', descricao: 'Vê e administra tudo, inclusive esta tela.' },
  { valor: 'responsavel', rotulo: 'Responsável', descricao: 'Trabalha nos clientes liberados para ele.' },
  { valor: 'uploader', rotulo: 'Uploader', descricao: 'Envia documentos dos clientes liberados.' },
] as const

export const ROTULO_PERFIL: Record<string, string> = Object.fromEntries(PERFIS.map((p) => [p.valor, p.rotulo]))

/** Pílula suave por perfil — o laranja sólido de antes gritava mais que o próprio nome. */
export const COR_PERFIL: Record<string, string> = {
  admin: 'bg-navy/10 text-navy ring-navy/15',
  responsavel: 'bg-orange/10 text-orange-dark ring-orange/25',
  uploader: 'bg-mid-grey/10 text-mid-grey ring-mid-grey/20',
}

export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

/** Busca sem caixa nem acento. */
export function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
