import type { TemaManual } from '@/lib/assistente/manual/temas'
import type { ContratoConsolidado } from './contratos-consolidados'
import { formatarData, formatarMoeda } from './formatacao'
import { faturamentoCancelado } from './situacao-faturamento'

/**
 * Alertas da carteira — as regras de um analista experiente viram código, com custo zero de token
 * (spec docs/superpowers/specs/2026-09-25-assistente-senior-design.md §3). Fica ao lado do consolidado,
 * fora do assistente, para as telas poderem usar a mesma regra. Função pura; quem carrega do banco é
 * `alertas-banco.ts`. Ativo, vigência, valor e saldo vêm SÓ do consolidado.
 */

/** Limiares aprovados pelo usuário em 26/09/2026 (spec §10.1). Mudou o processo? Muda aqui. */
export const LIMIARES = {
  venceCriticoDias: 30,
  venceAtencaoDias: 90,
  saldoCriticoDias: 60,
  janelaCompetencias: 6,
  minimoCompetenciasComLancamento: 3,
  envioAtrasadoDias: 10,
  competenciasParaEnvio: 3,
  diaCobrancaCompetencia: 15,
} as const

export type CodigoAlerta =
  | 'vence-sem-prorrogacao'
  | 'prorrogacao-sem-assinatura'
  | 'situacao-desatualizada'
  | 'ativo-sem-valor'
  | 'faturado-acima-do-contratado'
  | 'saldo-acaba-antes-da-vigencia'
  | 'faturamento-nao-enviado'
  | 'competencia-sem-faturamento'
  | 'termo-sem-pdf'
  | 'termo-sem-texto'
  | `cadastro-${string}`

export type NivelAlerta = 'critico' | 'atencao' | 'info'

export interface Alerta {
  codigo: CodigoAlerta
  nivel: NivelAlerta
  clienteId: string
  cliente: string
  contratoId: string | null
  /** Número do termo. */
  contrato: string | null
  titulo: string
  /** Com os números e a conta. */
  detalhe: string
  /** Próximo passo. */
  acao: string
  temaManual: TemaManual | null
  /** Prazo em dias, para ordenar; `null` quando não há prazo. */
  dias: number | null
}

export interface FaturamentoAlerta {
  competenciaAno: number | null
  competenciaMes: number | null
  valor: string | null
  situacao: string | null
  enviadoCliente: boolean | null
  enviadoGfp: boolean | null
  createdAt: Date
}

export interface DadosAlerta {
  clienteId: string
  cliente: string
  contratoId: string
  contrato: string | null
  consolidado: Pick<
    ContratoConsolidado,
    'ativo' | 'rescindido' | 'vazio' | 'vigenciaFim' | 'vencimento' | 'situacaoDesatualizada' | 'prorrogacaoEmAndamento' | 'valorBase' | 'saldo'
  >
  faturamentos: FaturamentoAlerta[]
  termosAssinadosSemPdf: number
  termosSemTexto: number
}

const DIA_MS = 86_400_000
const MES_MEDIO_DIAS = 30.44

export function diaEmSaoPaulo(hoje: Date): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(hoje).split('-').map(Number)
  return { ano, mes, dia }
}

/** As `n` competências encerradas mais recentes, da mais nova para a mais antiga (a primeira é o mês
 *  anterior ao atual, no fuso de São Paulo). */
export function competenciasEncerradas(hoje: Date, n: number): { ano: number; mes: number }[] {
  const { ano, mes } = diaEmSaoPaulo(hoje)
  return Array.from({ length: n }, (_, i) => {
    const total = ano * 12 + (mes - 1) - (i + 1)
    return { ano: Math.floor(total / 12), mes: (total % 12) + 1 }
  })
}

const rotuloCompetencia = (c: { ano: number; mes: number }) => `${String(c.mes).padStart(2, '0')}/${c.ano}`
const mesmaCompetencia = (f: FaturamentoAlerta, c: { ano: number; mes: number }) => f.competenciaAno === c.ano && f.competenciaMes === c.mes
const valido = (f: FaturamentoAlerta) => !faturamentoCancelado(f.situacao)
const somaDa = (faturamentos: FaturamentoAlerta[], c: { ano: number; mes: number }) =>
  faturamentos.filter((f) => valido(f) && mesmaCompetencia(f, c)).reduce((s, f) => s + Number(f.valor ?? 0), 0)

export interface Projecao {
  /** Média mensal das competências com lançamento. */
  ritmo: number
  competencias: number
  de: { ano: number; mes: number }
  ate: { ano: number; mes: number }
  meses: number
  fim: Date
  antesDaVigencia: boolean
  critico: boolean
}

/**
 * Ritmo = soma da janela ÷ competências da janela COM lançamento (o atraso normal do último mês não
 * entra como zero). Menos de 3 com lançamento: sem projeção.
 */
export function projetarSaldo(entrada: { saldo: number; vigenciaFim: Date; faturamentos: FaturamentoAlerta[]; hoje: Date }): Projecao | null {
  const janela = competenciasEncerradas(entrada.hoje, LIMIARES.janelaCompetencias)
  const comLancamento = janela.map((c) => ({ c, soma: somaDa(entrada.faturamentos, c) })).filter((x) => x.soma > 0)
  if (comLancamento.length < LIMIARES.minimoCompetenciasComLancamento) return null
  const ritmo = comLancamento.reduce((s, x) => s + x.soma, 0) / comLancamento.length
  const meses = entrada.saldo / ritmo
  const fim = new Date(entrada.hoje.getTime() + meses * MES_MEDIO_DIAS * DIA_MS)
  return {
    ritmo,
    competencias: comLancamento.length,
    de: comLancamento[comLancamento.length - 1].c,
    ate: comLancamento[0].c,
    meses,
    fim,
    antesDaVigencia: fim.getTime() < entrada.vigenciaFim.getTime(),
    critico: meses * MES_MEDIO_DIAS <= LIMIARES.saldoCriticoDias,
  }
}

const mesAno = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
const data = (d: Date) => formatarData(d.toISOString())

export function alertasDoContrato(d: DadosAlerta, hoje: Date): Alerta[] {
  const k = d.consolidado
  if (k.vazio) return []
  const alertas: Alerta[] = []
  const novo = (a: Omit<Alerta, 'clienteId' | 'cliente' | 'contratoId' | 'contrato'>) =>
    alertas.push({ clienteId: d.clienteId, cliente: d.cliente, contratoId: d.contratoId, contrato: d.contrato, ...a })
  const dias = k.vencimento.dias
  const nivelPorPrazo = (n: number): NivelAlerta => (n <= LIMIARES.venceCriticoDias ? 'critico' : 'atencao')

  if (k.ativo && !k.rescindido && dias !== null && dias >= 0 && dias <= LIMIARES.venceAtencaoDias && !k.prorrogacaoEmAndamento) {
    novo({
      codigo: 'vence-sem-prorrogacao',
      nivel: nivelPorPrazo(dias),
      titulo: `Vence em ${dias} dias sem prorrogação`,
      detalhe: `Fim da vigência em ${k.vigenciaFim ? data(k.vigenciaFim) : '—'}, sem aditivo ou prorrogação no histórico.`,
      acao: 'Decidir entre prorrogar e contratar de novo e abrir o processo.',
      temaManual: 'prorrogacao',
      dias,
    })
  }
  if (k.prorrogacaoEmAndamento && !k.rescindido && dias !== null && dias <= LIMIARES.venceAtencaoDias) {
    const fim = k.vigenciaFim ? data(k.vigenciaFim) : null
    const venceu = dias < 0
    novo({
      codigo: 'prorrogacao-sem-assinatura',
      nivel: venceu ? 'critico' : nivelPorPrazo(dias),
      titulo: venceu ? `Venceu há ${-dias} dias com prorrogação sem assinatura` : `Prorrogação sem assinatura — vence em ${dias} dias`,
      detalhe: 'Há aditivo/prorrogação no histórico ainda sem assinatura; até assinar, não estende a vigência.',
      acao: venceu
        ? `Conferir se a prorrogação foi assinada e registrar a data de assinatura; sem ela o contrato está vencido desde ${fim ?? 'o fim da vigência'}.`
        : `Conseguir a assinatura antes de ${fim ?? 'o fim da vigência'}: sem ela a vigência não estende.`,
      temaManual: 'prorrogacao',
      dias,
    })
  }
  if (k.situacaoDesatualizada) {
    novo({
      codigo: 'situacao-desatualizada',
      nivel: 'atencao',
      titulo: 'Situação desatualizada no cadastro',
      detalhe: `A situação diz "Ativo", mas a vigência efetiva terminou em ${k.vigenciaFim ? data(k.vigenciaFim) : '—'}.`,
      acao: 'Atualizar a situação no cadastro ou registrar o termo assinado que prorrogou.',
      temaManual: null,
      dias: null,
    })
  }
  if (k.ativo && k.valorBase === null) {
    novo({
      codigo: 'ativo-sem-valor',
      nivel: 'atencao',
      titulo: 'Ativo sem valor cadastrado',
      detalhe: 'O contrato está ativo e não tem valor em nenhum termo assinado nem nos itens.',
      acao: 'Cadastrar o valor do último termo assinado; sem ele não há saldo nem %.',
      temaManual: null,
      dias: null,
    })
  }
  const saldo = k.saldo.saldo === null ? null : Number(k.saldo.saldo)
  if (saldo !== null && saldo < 0) {
    novo({
      codigo: 'faturado-acima-do-contratado',
      nivel: 'critico',
      titulo: 'Faturado acima do contratado',
      detalhe: `Faturado ${formatarMoeda(k.saldo.faturado)} para um valor de ${formatarMoeda(k.valorBase)}: ${formatarMoeda(-saldo)} acima.`,
      acao: 'Conferir os lançamentos e o valor contratado; avaliar aditivo.',
      temaManual: 'aditivo-valor',
      dias: null,
    })
  }
  if (k.ativo && k.valorBase !== null && saldo !== null && saldo > 0 && k.vigenciaFim && (dias === null || dias >= 0)) {
    const p = projetarSaldo({ saldo, vigenciaFim: k.vigenciaFim, faturamentos: d.faturamentos, hoje })
    if (p?.antesDaVigencia) {
      const diasSaldo = Math.round(p.meses * MES_MEDIO_DIAS)
      novo({
        codigo: 'saldo-acaba-antes-da-vigencia',
        nivel: p.critico ? 'critico' : 'atencao',
        titulo: 'Saldo acaba antes do fim da vigência',
        detalhe:
          `No ritmo de ${formatarMoeda(p.ritmo)}/mês (média de ${p.competencias} competências, ${rotuloCompetencia(p.de)}–${rotuloCompetencia(p.ate)}), ` +
          `o saldo de ${formatarMoeda(saldo)} dura ~${Math.round(p.meses)} ${Math.round(p.meses) === 1 ? 'mês' : 'meses'}, até ~${mesAno(p.fim)}, ` +
          `antes do fim da vigência (${data(k.vigenciaFim)}).`,
        acao: 'Avaliar aditivo de valor ou rever o ritmo de faturamento.',
        temaManual: 'aditivo-valor',
        dias: diasSaldo,
      })
    }
  }

  const recentes = competenciasEncerradas(hoje, LIMIARES.competenciasParaEnvio)
  const limiteEnvio = hoje.getTime() - LIMIARES.envioAtrasadoDias * DIA_MS
  const naoEnviados = d.faturamentos.filter(
    (f) => valido(f) && recentes.some((c) => mesmaCompetencia(f, c)) && f.createdAt.getTime() < limiteEnvio && (!f.enviadoCliente || !f.enviadoGfp)
  )
  if (naoEnviados.length > 0) {
    const onde = naoEnviados
      .map((f) => `${rotuloCompetencia({ ano: f.competenciaAno!, mes: f.competenciaMes! })} (${[!f.enviadoCliente && 'cliente', !f.enviadoGfp && 'GFP'].filter(Boolean).join(' e ')})`)
      .join(', ')
    novo({
      codigo: 'faturamento-nao-enviado',
      nivel: 'atencao',
      titulo: 'Faturamento não enviado',
      detalhe: `Lançado há mais de ${LIMIARES.envioAtrasadoDias} dias sem marcar o envio: ${onde}.`,
      acao: 'Enviar e marcar no faturamento.',
      temaManual: 'faturamento',
      dias: null,
    })
  }

  const [ultima, ...anteriores] = competenciasEncerradas(hoje, LIMIARES.janelaCompetencias + 1)
  const faturouAntes = anteriores.filter((c) => somaDa(d.faturamentos, c) > 0).length
  if (
    k.ativo &&
    diaEmSaoPaulo(hoje).dia >= LIMIARES.diaCobrancaCompetencia &&
    faturouAntes >= LIMIARES.minimoCompetenciasComLancamento &&
    !d.faturamentos.some((f) => valido(f) && mesmaCompetencia(f, ultima))
  ) {
    novo({
      codigo: 'competencia-sem-faturamento',
      nivel: 'atencao',
      titulo: `Competência ${rotuloCompetencia(ultima)} sem faturamento`,
      detalhe: `Faturou em ${faturouAntes} das ${anteriores.length} competências anteriores e não tem lançamento em ${rotuloCompetencia(ultima)}.`,
      acao: 'Lançar o faturamento da competência ou registrar o motivo.',
      temaManual: 'faturamento',
      dias: null,
    })
  }

  if (k.ativo && d.termosAssinadosSemPdf > 0) {
    novo({
      codigo: 'termo-sem-pdf',
      nivel: 'info',
      titulo: 'Termo assinado sem PDF',
      detalhe: `${d.termosAssinadosSemPdf} ${d.termosAssinadosSemPdf === 1 ? 'termo assinado' : 'termos assinados'} sem PDF`,
      acao: 'Anexar o termo na linha (ou conferir a pasta no SharePoint).',
      temaManual: null,
      dias: null,
    })
  }
  if (k.ativo && d.termosSemTexto > 0) {
    novo({
      codigo: 'termo-sem-texto',
      nivel: 'info',
      titulo: 'Termo escaneado (sem texto)',
      detalhe: `${d.termosSemTexto} ${d.termosSemTexto === 1 ? 'termo é imagem escaneada' : 'termos são imagens escaneadas'}: o assistente não lê.`,
      acao: 'Trocar pela versão digital do SEI, se houver.',
      temaManual: null,
      dias: null,
    })
  }
  return alertas
}

const PESO: Record<NivelAlerta, number> = { critico: 0, atencao: 1, info: 2 }

/** Nível, depois prazo (sem prazo por último), depois cliente. */
export function ordenarAlertas(alertas: Alerta[]): Alerta[] {
  return [...alertas].sort(
    (a, b) =>
      PESO[a.nivel] - PESO[b.nivel] ||
      (a.dias ?? Number.POSITIVE_INFINITY) - (b.dias ?? Number.POSITIVE_INFINITY) ||
      a.cliente.localeCompare(b.cliente, 'pt-BR')
  )
}
