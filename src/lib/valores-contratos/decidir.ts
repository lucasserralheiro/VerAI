import { valorBr } from '@/lib/controles-contratos/leitura'
import { nomeDoMes } from '@/lib/controles-contratos/tipos'
import { formatarData, formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import { aceitaCategoria, categoriaDoValor, numeroDoValor } from './categoria'
import { extensoDoTrecho } from './extenso'

// Decisão linha a linha (spec docs/superpowers/specs/2026-09-29-valor-vigencia-contratos-design.md §0 e §5):
// regra pura. Só decide campo VAZIO; grava só com prova; contradição nunca grava — vira aviso.

export interface EntradaLinha {
  tipo: string
  atual: { valor: string | null; dataInicio: Date | null; dataVencimento: Date | null; data: Date | null; situacao: string | null }
  /** Valor da ficha do termo (regra ou IA verificada literalmente). */
  ficha: { valor: string; trecho: string | null; pagina: number | null } | null
  fichaFim: Date | null
  /** Valor da ficha da proposta (PC), string decimal — prova do contrato inicial. */
  proposta: string | null
  /** Linha da planilha do MESMO termo. `simples` = contrato inicial ou prorrogação (aditivo mistura diferença e total). */
  planilha: { valor: string | null; inicio: Date | null; fim: Date | null; concluida: boolean; simples: boolean; linha: number } | null
  /** Controle do faturamento vigente (conferido) do MESMO termo. */
  controle: { previsto: string; inicio: Date | null; fim: Date | null; mes: string; arquivoId: string } | null
  /** Valor da linha assinada anterior — prova da cadeia "passa de X para Y". */
  anterior: string | null
}

export interface Gravacao<T> {
  dado: T
  origem: string
  prova: Record<string, unknown>
}

export interface DecisaoLinha {
  valor?: Gravacao<string>
  /** `inicio` null = não mexer no início (já preenchido ou desconhecido). */
  vigencia?: Gravacao<{ inicio: Date | null; fim: Date }>
  assinatura?: Gravacao<string>
  avisos: string[]
}

// Marcador que a importação do SharePoint grava enquanto o termo não está pronto (importar.ts) — conta como vazio.
const EM_ELABORACAO = 'Em elaboração'
// Vigência plausível de um termo: de 30 dias a 10 anos (limite dos serviços contínuos na Lei 14.133).
const DIAS_MINIMOS = 30
const DIAS_MAXIMOS = 3653

const centavos = (v: string) => Math.round(Number(v) * 100)
const iguais = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && centavos(a) === centavos(b)
const mesmoDia = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10)
const data = (d: Date) => formatarData(d.toISOString())

function decidirValor(e: EntradaLinha, avisos: string[]): Gravacao<string> | undefined {
  const numero = e.ficha ? numeroDoValor(e.ficha.valor) : null
  const lido = numero ? valorBr(numero) : null
  const planilhaValor = e.planilha?.simples ? e.planilha.valor : null
  let gravacao: Gravacao<string> | undefined

  if (e.ficha && lido && e.ficha.trecho && aceitaCategoria(e.tipo, categoriaDoValor(e.ficha.trecho, e.ficha.valor))) {
    const provas: string[] = []
    const contradicoes: string[] = []
    const extenso = extensoDoTrecho(e.ficha.trecho, e.ficha.valor)
    if (extenso === 'igual') provas.push('extenso')
    if (extenso === 'diferente') contradicoes.push(`número e extenso diferentes no termo (${formatarMoeda(lido)})`)
    if (planilhaValor) {
      if (iguais(planilhaValor, lido)) provas.push('planilha')
      else contradicoes.push(`a planilha de contratos diz ${formatarMoeda(planilhaValor)} e o termo ${formatarMoeda(lido)}`)
    }
    if (e.controle && iguais(e.controle.previsto, lido)) provas.push('controle')
    if (e.tipo === 'CONTRATO' && iguais(e.proposta, lido)) provas.push('proposta')
    const de = /passa(?:ndo)?\s+(?:o\s+valor\s+(?:\S+\s+){0,3})?de\s+R\s?\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i.exec(e.ficha.trecho)
    if (de && iguais(valorBr(de[1]), e.anterior)) provas.push('cadeia')

    if (contradicoes.length > 0) avisos.push(...contradicoes)
    else if (provas.length > 0) {
      gravacao = {
        dado: lido,
        origem: ['TERMO', ...provas.map((p) => p.toUpperCase())].join('+'),
        prova: {
          pagina: e.ficha.pagina,
          trecho: e.ficha.trecho,
          provas,
          ...(provas.includes('planilha') ? { planilhaLinha: e.planilha!.linha } : {}),
          ...(provas.includes('controle') ? { controleMes: e.controle!.mes, controleArquivoId: e.controle!.arquivoId } : {}),
        },
      }
    } else avisos.push(`valor lido do termo sem segunda prova: ${formatarMoeda(lido)}`)
  } else if (planilhaValor && e.controle && iguais(planilhaValor, e.controle.previsto)) {
    // Termo sem leitura (escaneado) ou sem categoria clara: contratos e faturamento dizendo o mesmo número.
    gravacao = {
      dado: planilhaValor,
      origem: 'PLANILHA+CONTROLE',
      prova: { planilhaLinha: e.planilha!.linha, controleMes: e.controle.mes, controleArquivoId: e.controle.arquivoId },
    }
  }

  const referencia = gravacao?.dado ?? lido
  if (e.controle && referencia && !iguais(e.controle.previsto, referencia)) {
    avisos.push(`o faturamento usa ${formatarMoeda(e.controle.previsto)} (controle de ${nomeDoMes(e.controle.mes)})`)
  }
  return gravacao
}

function decidirVigencia(e: EntradaLinha, avisos: string[]): Gravacao<{ inicio: Date | null; fim: Date }> | undefined {
  // O início do controle é o do contrato inteiro, não o do termo: com o controle, o início só vem da planilha do
  // mesmo termo quando ela confirma o fim.
  const planilhaConfirma = !!(e.controle?.fim && e.planilha?.fim && mesmoDia(e.planilha.fim, e.controle.fim))
  const fonte = e.controle?.fim
    ? {
        nome: planilhaConfirma ? 'CONTROLE+PLANILHA' : 'CONTROLE',
        rotulo: 'o controle do faturamento',
        inicio: planilhaConfirma ? e.planilha!.inicio : null,
        fim: e.controle.fim,
        prova: { mes: e.controle.mes, arquivoId: e.controle.arquivoId, ...(planilhaConfirma ? { planilhaLinha: e.planilha!.linha } : {}) },
      }
    : e.planilha?.fim
      ? { nome: 'PLANILHA', rotulo: 'a planilha de contratos', inicio: e.planilha.inicio, fim: e.planilha.fim, prova: { planilhaLinha: e.planilha.linha } }
      : null
  if (!fonte) return undefined
  if (e.fichaFim && !mesmoDia(e.fichaFim, fonte.fim)) {
    avisos.push(`o termo diz fim em ${data(e.fichaFim)} e ${fonte.rotulo} ${data(fonte.fim)}`)
    return undefined
  }
  // Erro de digitação da fonte (fim antes do início, 18 dias, 30 anos) nunca vira vigência. Prorrogação curta
  // existe ("até a nova contratação"): com o fim confirmado pelo termo, só o fim antes do início barra.
  const inicio = e.atual.dataInicio ?? fonte.inicio ?? e.controle?.inicio ?? null
  const dias = inicio ? (fonte.fim.getTime() - inicio.getTime()) / 86_400_000 : null
  const minimo = e.fichaFim ? 1 : DIAS_MINIMOS
  if (inicio && dias !== null && (dias < minimo || dias > DIAS_MAXIMOS)) {
    avisos.push(`${fonte.rotulo} dá vigência fora do normal (${data(inicio)} a ${data(fonte.fim)}) — confira`)
    return undefined
  }
  return {
    dado: { inicio: e.atual.dataInicio ? null : fonte.inicio, fim: fonte.fim },
    origem: e.fichaFim ? `${fonte.nome}+TERMO` : fonte.nome,
    prova: fonte.prova,
  }
}

function decidirAssinatura(e: EntradaLinha): Gravacao<string> | undefined {
  if (e.tipo !== 'ADITIVO' && e.tipo !== 'PRORROGACAO') return undefined
  const situacao = e.atual.situacao?.trim() ?? ''
  if (e.atual.data || (situacao !== '' && situacao !== EM_ELABORACAO)) return undefined
  if (e.controle) return { dado: 'Assinado (controle do faturamento)', origem: 'CONTROLE', prova: { mes: e.controle.mes, arquivoId: e.controle.arquivoId } }
  if (e.planilha?.concluida) return { dado: 'Assinado (planilha: contratação concluída)', origem: 'PLANILHA', prova: { planilhaLinha: e.planilha.linha } }
  return undefined
}

export function decidirLinha(e: EntradaLinha): DecisaoLinha {
  const avisos: string[] = []
  const r: DecisaoLinha = { avisos }
  if (e.atual.valor === null) {
    const valor = decidirValor(e, avisos)
    if (valor) r.valor = valor
  }
  if (e.atual.dataVencimento === null) {
    const vigencia = decidirVigencia(e, avisos)
    if (vigencia) r.vigencia = vigencia
  }
  const assinatura = decidirAssinatura(e)
  if (assinatura) r.assinatura = assinatura
  return r
}
