import type { Alerta } from '@/lib/relatorios-clientes/alertas'
import type { TotaisCarteira } from '@/lib/relatorios-clientes/painel-carteiras'
import type { SituacaoVencimento } from '@/lib/relatorios-clientes/vencimento'

// Formato dos registros que o VerAI entrega na API de plataforma (`/api/v1/*`). É contrato público:
// campo novo pode entrar; renomear/remover campo é versão nova (v2), nunca mudança em silêncio.
// Dinheiro sai como string decimal ("1234.56"), data só-dia como "AAAA-MM-DD".

export interface CarteiraIntegracao {
  /** Id da gerência no VerAI, ou "sem". */
  id: string
  nome: string
  sigla: string | null
  /** Chave comparável com o AIBertinho ("GRC4"); `null` se a sigla não é GRC/KAM. */
  chave: string | null
  gerentes: string[]
  totais: TotaisCarteira
}

export interface ClienteIntegracao {
  id: string
  nome: string
  sigla: string | null
  carteira: { nome: string; sigla: string | null; chave: string | null } | null
  totais: TotaisCarteira
  url: string
}

export type AvisoContrato = 'situacaoDesatualizada' | 'prorrogacaoEmAndamento' | 'semValor'

export interface ContratoIntegracao {
  id: string
  numero: string | null
  descricao: string | null
  situacao: string | null
  seiProdam: string | null
  seiCliente: string | null
  ativo: boolean
  rescindido: boolean
  vigenciaFim: string | null
  vencimento: SituacaoVencimento
  valorContratado: string | null
  faturado: string
  saldo: string | null
  percentualFaturado: string | null
  avisos: AvisoContrato[]
  url: string
}

export type AlertaIntegracao = Pick<Alerta, 'codigo' | 'nivel' | 'contrato' | 'titulo' | 'detalhe' | 'acao' | 'dias'>

export interface ClienteDetalheIntegracao extends ClienteIntegracao {
  contratos: ContratoIntegracao[]
  alertas: AlertaIntegracao[]
}

export interface PedidoLocalizacao {
  /** Como o AIBertinho escreve: "17/2025-SGM", "024/SIURB/25", "03/SP-REGULA/2022". */
  numero: string
  /** Sigla do cliente no AIBertinho — completa o órgão quando o número não traz ("002/2025-SMRI"). */
  cliente?: string | null
}

export type LocalizacaoIntegracao =
  | { numero: string; resultado: 'encontrado'; contrato: ContratoIntegracao & { cliente: { id: string; nome: string; sigla: string | null } } }
  | { numero: string; resultado: 'ambiguo'; candidatos: { id: string; numero: string | null; cliente: string | null }[] }
  | { numero: string; resultado: 'nenhum' | 'ilegivel' }
