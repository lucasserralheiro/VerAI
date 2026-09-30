// Tipos do calendário de faturamento que vão ao navegador (spec 2026-09-29-calendario-faturamento-design.md §5–6).

export type TipoDataFaturamento =
  | 'EMISSAO_NFSE'
  | 'ENCERRAMENTO'
  | 'ENVIO_RELATORIO'
  | 'RECEBIMENTO_CONTRATOS'
  | 'RECEBIMENTO_PROCESSOS_SEI'
  | 'EXPEDIENTE_SUSPENSO'
  | 'FERIADO'
  | 'OUTRO'

export const ROTULO_TIPO: Record<TipoDataFaturamento, string> = {
  EMISSAO_NFSE: 'Emissão de NFS-e',
  ENCERRAMENTO: 'Encerramento do faturamento',
  ENVIO_RELATORIO: 'Envio do relatório de faturamento',
  RECEBIMENTO_CONTRATOS: 'Recebimento de contratos e aditamentos',
  RECEBIMENTO_PROCESSOS_SEI: 'Recebimento de processos SEI',
  EXPEDIENTE_SUSPENSO: 'Expediente suspenso',
  FERIADO: 'Feriado',
  OUTRO: 'Outro',
}

/** Prazos (o que entra em "Próximos prazos"): sem feriado nem expediente suspenso. */
export const PRAZOS: TipoDataFaturamento[] = ['EMISSAO_NFSE', 'ENCERRAMENTO', 'ENVIO_RELATORIO', 'RECEBIMENTO_CONTRATOS', 'RECEBIMENTO_PROCESSOS_SEI']

export interface DataSerializada {
  inicio: string
  fim: string
  tipo: TipoDataFaturamento
  descricao: string
}

export interface ProximoPrazo extends DataSerializada {
  /** Dias corridos até o início (0 = hoje). */
  emDias: number
  /** Dias úteis até o início (sem sábado, domingo e feriado do calendário). */
  emDiasUteis: number
}

const dia = (d: Date) => d.toISOString().slice(0, 10)

/** Data de hoje em Brasília (UTC−3), à meia-noite UTC — é como as datas do calendário são guardadas. */
export function hojeEmBrasilia(agora: Date = new Date()): Date {
  const local = new Date(agora.getTime() - 3 * 3_600_000)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()))
}

/** Próximos prazos a partir de hoje (inclusive, e o que ainda está em curso), com dias corridos e úteis. */
export function proximosPrazos(datas: DataSerializada[], hoje: Date, n = 3): ProximoPrazo[] {
  const feriados = new Set(datas.filter((d) => d.tipo === 'FERIADO' || d.tipo === 'EXPEDIENTE_SUSPENSO').map((d) => d.inicio.slice(0, 10)))
  const uteis = (ate: Date) => {
    let n = 0
    for (let t = hoje.getTime() + 86_400_000; t <= ate.getTime(); t += 86_400_000) {
      const x = new Date(t)
      if (x.getUTCDay() !== 0 && x.getUTCDay() !== 6 && !feriados.has(dia(x))) n++
    }
    return n
  }
  return datas
    .filter((d) => PRAZOS.includes(d.tipo) && new Date(d.fim).getTime() >= hoje.getTime())
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .slice(0, n)
    .map((d) => {
      const inicio = new Date(d.inicio)
      const emDias = Math.max(0, Math.round((inicio.getTime() - hoje.getTime()) / 86_400_000))
      return { ...d, emDias, emDiasUteis: emDias === 0 ? 0 : uteis(inicio) }
    })
}

export function quandoTexto(p: Pick<ProximoPrazo, 'emDias'>): string {
  return p.emDias === 0 ? 'hoje' : p.emDias === 1 ? 'amanhã' : `em ${p.emDias} dias`
}
