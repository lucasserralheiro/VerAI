/**
 * O que as rotas do ConfereAI devolvem sobre o cadastro dos clientes — compartilhado entre o
 * servidor (`src/lib/confere/cadastro.ts`) e a tela (`src/app/confere/`). Este arquivo vai para o
 * navegador: só tipos e formatação pura, sem importar nada do servidor.
 *
 * Desenho: docs/superpowers/specs/2026-09-25-confere-contrato-do-cadastro-design.md.
 */

export type TipoDaLinha = 'CONTRATO' | 'ADITIVO' | 'PRORROGACAO' | 'RESCISAO' | 'PROSPECCAO'

/** Aditivo do cadastro no multipart da geração: `aditivos=cadastro:<arquivoId>`. */
export const PREFIXO_DO_CADASTRO = 'cadastro:'

export interface Competencia {
  ano: number
  /** 1 a 12. */
  mes: number
}

export interface OrigemNoCadastro {
  tipo: TipoDaLinha
  numero: string | null
  /** "AAAA-MM-DD" — início da linha (ou a assinatura, ou a data da proposta). */
  inicio: string | null
}

export interface DocumentoDoCadastro {
  arquivoId: string
  nome: string
  /** `null` quando é uma proposta do cliente que não está em nenhuma linha do histórico. */
  origem: OrigemNoCadastro | null
}

export interface ResumoDoContrato {
  id: string
  clienteId: string
  clienteNome: string
  clienteSigla: string | null
  numeroTermo: string | null
  descricao: string | null
  /** "AAAA-MM-DD" — fim de vigência efetivo, do `consolidarContratos()`. */
  vigenciaFim: string | null
  ativo: boolean
}

export type CodigoDoAviso = 'aditivo-sem-pa' | 'termo-sem-data' | 'fora-da-vigencia' | 'sem-proposta'

export interface AvisoDoCadastro {
  codigo: CodigoDoAviso
  texto: string
}

export interface DecisaoDoCadastro {
  /** "Contrato inicial", "TA 04". */
  rotulo: string
  papel: 'base' | 'aditivo' | 'fora'
  /** Por que ficou fora; `null` para base e aditivo. */
  motivo: string | null
}

export interface DocumentosDoContrato {
  contrato: ResumoDoContrato
  competencia: Competencia & { lidaDaPlanilha: boolean }
  /** A proposta do campo Contrato; `null` quando o contrato não tem nenhuma no cadastro. */
  base: DocumentoDoCadastro | null
  /** Em ordem de aplicação. */
  aditivos: DocumentoDoCadastro[]
  /** Todas as propostas do contrato — e, quando ele não tem nenhuma, as soltas do cliente —, para
   *  "Trocar" e "+ Adicionar do cadastro". */
  alternativas: DocumentoDoCadastro[]
  decisoes: DecisaoDoCadastro[]
  avisos: AvisoDoCadastro[]
}

export interface LeituraDoLevantamento {
  /** O que a planilha escreveu depois de "conforme contrato :". */
  referencia: string | null
  /** O mês da "Data do Levantamento" — `null` quando a planilha não tem a data. */
  competencia: Competencia | null
}

export type RespostaDaIdentificacao =
  | { situacao: 'ilegivel'; mensagem: string }
  | { situacao: 'sem-referencia'; leitura: LeituraDoLevantamento }
  | { situacao: 'encontrado'; leitura: LeituraDoLevantamento; documentos: DocumentosDoContrato }
  | { situacao: 'ambiguo'; leitura: LeituraDoLevantamento; candidatos: ResumoDoContrato[] }
  | { situacao: 'nao-encontrado'; leitura: LeituraDoLevantamento; sugestoes: ResumoDoContrato[] }

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** `{ ano: 2026, mes: 7 }` → "julho/2026" — o formato da competência no relatório do Confere. */
export function nomeDaCompetencia({ ano, mes }: Competencia): string {
  return `${MESES[mes - 1]}/${ano}`
}

/** "2025-12-01" → "01/12/2025". */
export function dataIsoParaTexto(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}
