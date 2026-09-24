import type { CategoriaArquivo } from '@prisma/client'

// Regras de apresentação e classificação dos arquivos do repositório do cliente. Roda no navegador
// e no servidor — nada de import de servidor aqui.

export const CATEGORIAS: ReadonlyArray<{ valor: CategoriaArquivo; rotulo: string }> = [
  { valor: 'PROPOSTA_COMERCIAL', rotulo: 'Proposta comercial' },
  { valor: 'PROPOSTA_ADITIVO', rotulo: 'Proposta de aditivo' },
  { valor: 'TERMO_CONTRATO', rotulo: 'Termo de contrato' },
  { valor: 'TERMO_ADITIVO', rotulo: 'Termo aditivo' },
  { valor: 'MEDICAO', rotulo: 'Medição' },
  { valor: 'FATURA_NF', rotulo: 'Fatura / nota fiscal' },
  { valor: 'PLANILHA', rotulo: 'Planilha' },
  { valor: 'OFICIO_SEI', rotulo: 'Ofício / SEI' },
  { valor: 'PUBLICACAO_DOC', rotulo: 'Publicação no DOC' },
  { valor: 'RELATORIO_GERADO', rotulo: 'Relatório gerado' },
  { valor: 'OUTRO', rotulo: 'Outro' },
]

export function rotuloCategoria(categoria: CategoriaArquivo): string {
  return CATEGORIAS.find((c) => c.valor === categoria)?.rotulo ?? categoria
}

export function extensaoDe(nome: string): string {
  const partes = nome.split('.')
  return partes.length > 1 ? partes.pop()!.toLowerCase() : ''
}

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  zip: 'application/zip',
}

export function contentTypeDe(nome: string): string {
  return CONTENT_TYPES[extensaoDe(nome)] ?? 'application/octet-stream'
}

const PLANILHA = new Set(['xlsx', 'xls', 'csv'])

/** Sugestão pelo nome (spec §3.5) — o usuário sempre confirma. Prefixo PC/PA/TC/TA precisa de
 *  separador depois (`PC_`, `pa-`, `TC `), senão "pcsms.pdf" viraria proposta. */
export function sugerirCategoria(nome: string): CategoriaArquivo {
  const base = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const prefixo = /^(pc|pa|tc|ta)[_\-\s]/.exec(base)?.[1]
  if (prefixo === 'pc') return 'PROPOSTA_COMERCIAL'
  if (prefixo === 'pa') return 'PROPOSTA_ADITIVO'
  if (prefixo === 'tc') return 'TERMO_CONTRATO'
  if (prefixo === 'ta') return 'TERMO_ADITIVO'
  if (PLANILHA.has(extensaoDe(nome)) && /medi|levant/.test(base)) return 'MEDICAO'
  return 'OUTRO'
}

/** Categoria dos `Documento` antigos na migração (spec §3.7): planilha ou outro. */
export function categoriaDoDocumento(tipo: string): CategoriaArquivo {
  return PLANILHA.has(tipo.toLowerCase()) ? 'PLANILHA' : 'OUTRO'
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Um lugar onde o arquivo é usado. Contrato e competência do arquivo são SEMPRE derivados daqui
 *  (spec §7.1) — o `ArquivoCliente` não guarda nenhum dos dois. Fases 2–4 acrescentam tipos. */
export interface UsoArquivo {
  tipo: 'analise-documento'
  rotulo: string
  href: string
  /** Contrato a que este uso liga o arquivo; `null` quando o uso não é de contrato. */
  contrato: { id: string; numeroTermo: string | null } | null
  /** Competência deste uso; `null` quando não se aplica. */
  competencia: { ano: number; mes: number } | null
}
