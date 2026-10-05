// Tipos dos anexos do chat (spec 2026-10-02-assistente-anexos). Sem import de servidor: a tela usa.
export const FORMATOS_ANEXO = ['pdf', 'docx', 'xlsx', 'csv', 'txt', 'eml'] as const
export type FormatoAnexo = (typeof FORMATOS_ANEXO)[number]

export const TIPOS_MIME_ANEXO: Record<FormatoAnexo, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
  eml: 'message/rfc822',
}

/** Teto de cada anexo — o mesmo `TAMANHO_MAXIMO_ENVIO` de `propostas/envio.ts`, repetido aqui porque
 *  aquele arquivo importa `node:crypto` e não pode entrar no bundle da tela. */
export const TAMANHO_MAXIMO_ANEXO = 50 * 1024 * 1024

export function formatoDoNome(nome: string): FormatoAnexo | null {
  const ext = nome.toLowerCase().split('.').pop() ?? ''
  return (FORMATOS_ANEXO as readonly string[]).includes(ext) && nome.includes('.') ? (ext as FormatoAnexo) : null
}

export interface MensagemConversa { autor: string; quando: string | null; texto: string }

export interface ItemDocumento {
  codigo: string
  descricao: string
  quantidade: string | null
  unitario: string | null
  total: string | null
  /** Posição da linha na tabela (1-based), para a IA citar. */
  linha: number
}

export type TipoDocumento = 'proposta' | 'termo' | 'controle' | 'planilha' | 'oficio' | 'email' | 'conversa' | 'outro'

export interface FichaAnexo {
  tipo: TipoDocumento
  clienteId: string | null
  cliente: string | null
  contratoId: string | null
  contrato: string | null
  /** Linha do histórico que tem este MESMO arquivo como PC/PA ou TC/TA (pelo SHA-256), quando é uma só. */
  linhaHistoricoId?: string | null
  /** Só em termo: tipo da linha do histórico e identidade espécie + nº ("TA3", "TAP2", "TC0"). */
  tipoLinha?: 'CONTRATO' | 'ADITIVO' | 'PRORROGACAO' | 'RESCISAO'
  termo?: string | null
  campos: Record<string, { valor: string; pagina: number | null }>
  itens: number
  somaItens: string | null
  conversa: { participantes: string[]; inicio: string | null; fim: string | null; mensagens: number } | null
  anexosDoEmail: string[]
  sugestoes: string[]
  avisos: string[]
}
