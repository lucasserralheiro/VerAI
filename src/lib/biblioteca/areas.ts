// Áreas da biblioteca "Documentos" do SharePoint (spec
// docs/superpowers/specs/2026-09-29-biblioteca-documentos-prodam-design.md §5.3): a área sai do primeiro
// nível do caminho e decide o leitor e quem pode abrir o arquivo.

export const AREAS_BIBLIOTECA = ['TABELA_PRECOS', 'LINKS_MPLS', 'CALENDARIO', 'PLANILHA_CONTRATOS', 'CONTROLES_CONTRATOS', 'OUTRO'] as const
export type AreaBiblioteca = (typeof AREAS_BIBLIOTECA)[number]

export const BIBLIOTECA_DOCUMENTOS = 'DOCUMENTOS'

export function ehArea(texto: string): texto is AreaBiblioteca {
  return (AREAS_BIBLIOTECA as readonly string[]).includes(texto)
}

const semAcento = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()

/** Tolerante a caixa e acento; pasta desconhecida é `OUTRO` (guarda o arquivo, não lê). */
export function areaDoCaminho(caminho: string): AreaBiblioteca {
  const pasta = semAcento(caminho.split('/')[0] ?? '')
  if (/TABELA\s+DE\s+PRECOS/.test(pasta)) return 'TABELA_PRECOS'
  if (/FATURAMENTO\s+SERVICOS/.test(pasta)) {
    // Dentro do faturamento há duas coisas diferentes: os controles por contrato e os relatórios de links.
    return /^CONTROLES?\s+DE\s+CONTRATOS/.test(semAcento(caminho.split('/')[1] ?? '')) ? 'CONTROLES_CONTRATOS' : 'LINKS_MPLS'
  }
  if (/CALENDARIO/.test(pasta)) return 'CALENDARIO'
  if (/PLANILHA\s+DE\s+CONTRATOS/.test(pasta)) return 'PLANILHA_CONTRATOS'
  return 'OUTRO'
}

/** Pelo conteúdo: arquivo repetido não duplica e dev/produção (mesmo bucket) não colidem. */
export function chaveR2Biblioteca(sha256: string, extensao: string): string {
  return `biblioteca-documentos/${sha256}${extensao ? `.${extensao}` : ''}`
}

/** Preço e calendário são de todos. Links dependem do contrato lido (entrega dos links); até lá, só admin. */
const AREAS_PUBLICAS: readonly string[] = ['TABELA_PRECOS', 'CALENDARIO']

export function podeVerArea(role: string, area: string): boolean {
  return role === 'admin' || AREAS_PUBLICAS.includes(area)
}
