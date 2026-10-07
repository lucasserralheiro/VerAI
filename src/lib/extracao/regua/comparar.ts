import type { MetricasConversao } from './metricas'

/**
 * Antes × depois da régua da conversão, arquivo por arquivo. Puro: recebe as
 * duas rodadas (a base salva e a de agora) e diz o que cada arquivo ganhou ou
 * perdeu. O script `scripts/regua-conversao.ts` só lê disco e imprime.
 *
 * O pareamento é pelo sha256 do PDF — mesmo arquivo, byte a byte. PDF que
 * mudou na origem desde a base não é comparável e fica de fora (o script avisa).
 */
export interface MedidaArquivo {
  sha256: string
  /** Caminho absoluto, pra reler o MESMO arquivo na próxima rodada. */
  caminho: string
  /** Caminho relativo à pasta da biblioteca — o que aparece na tela. */
  nome: string
  gerador: string
  milissegundos: number
  /** Mensagem do erro quando a conversão quebrou ou estourou o tempo. */
  falha: string | null
  metricas: MetricasConversao | null
  /** sha256 do HTML: muda quando a saída muda, mesmo que nenhuma métrica mexa. */
  htmlSha256: string | null
}

type CampoNumerico = {
  [K in keyof MetricasConversao]: MetricasConversao[K] extends number ? K : never
}[keyof MetricasConversao]

export interface Indicador {
  campo: CampoNumerico
  rotulo: string
  /** `menor` = problema (quanto menos, melhor); `maior` = acerto. */
  sentido: 'menor' | 'maior'
  /** Peso na pontuação que ordena os piores arquivos. Número que some vale mais que palavra fora de ordem. */
  peso: number
}

/** A ordem é a de importância — é nela que o resumo imprime. */
export const INDICADORES: Indicador[] = [
  { campo: 'numerosPerdidos', rotulo: 'números perdidos', sentido: 'menor', peso: 10 },
  { campo: 'numerosSobrando', rotulo: 'números a mais', sentido: 'menor', peso: 10 },
  { campo: 'linhasAritmeticaQuebrada', rotulo: 'aritmética quebrada', sentido: 'menor', peso: 8 },
  { campo: 'precoNaoReconhecido', rotulo: 'preço não reconhecido', sentido: 'menor', peso: 8 },
  { campo: 'codigosGrudados', rotulo: 'código grudado', sentido: 'menor', peso: 4 },
  { campo: 'valoresSoltos', rotulo: 'valor solto', sentido: 'menor', peso: 4 },
  { campo: 'somasQuebradas', rotulo: 'soma quebrada', sentido: 'menor', peso: 4 },
  { campo: 'linhasIrregulares', rotulo: 'linhas irregulares', sentido: 'menor', peso: 2 },
  { campo: 'blocosGigantes', rotulo: 'blocos gigantes', sentido: 'menor', peso: 2 },
  { campo: 'prosaEmTabela', rotulo: 'prosa em tabela', sentido: 'menor', peso: 1 },
  { campo: 'molduraViradaTabela', rotulo: 'moldura ⇒ tabela', sentido: 'menor', peso: 1 },
  { campo: 'alertas', rotulo: 'alertas de texto', sentido: 'menor', peso: 1 },
  { campo: 'palavrasPerdidas', rotulo: 'palavras perdidas', sentido: 'menor', peso: 0.2 },
  { campo: 'palavrasSobrando', rotulo: 'palavras a mais', sentido: 'menor', peso: 0.2 },
  { campo: 'palavrasForaDeOrdem', rotulo: 'palavras fora de ordem', sentido: 'menor', peso: 0.1 },
  { campo: 'linhasAritmeticaOk', rotulo: 'aritmética ok', sentido: 'maior', peso: 0 },
  { campo: 'somasConferidas', rotulo: 'soma confere', sentido: 'maior', peso: 0 },
]

/** Falha de conversão pesa mais que qualquer defeito: o usuário não recebe nada. */
const PESO_FALHA = 1000

export type Situacao = 'piorou' | 'misto' | 'melhorou' | 'só o HTML mudou' | 'igual'

export interface Mudanca {
  rotulo: string
  antes: number | string
  agora: number | string
  melhor: boolean
}

export interface ComparacaoArquivo {
  nome: string
  gerador: string
  situacao: Situacao
  mudancas: Mudanca[]
}

export interface ResultadoComparacao {
  arquivos: ComparacaoArquivo[]
  /** Soma de cada indicador nos arquivos pareados, antes e agora. */
  totais: { rotulo: string; sentido: Indicador['sentido']; antes: number; agora: number }[]
  falhasAntes: number
  falhasAgora: number
  /** Da base, sem par agora (filtrado, apagado ou mudou na origem). */
  semPar: number
}

export function pontuacao(medida: MedidaArquivo): number {
  if (medida.falha || !medida.metricas) return PESO_FALHA
  const m = medida.metricas
  return INDICADORES.filter((i) => i.sentido === 'menor').reduce((soma, i) => soma + m[i.campo] * i.peso, 0)
}

/** Fração das palavras do PDF que chegaram ao HTML sem sumir nem sobrar. */
export function fidelidadePercentual(metricas: MetricasConversao): number {
  if (metricas.palavrasNoPdf === 0) return 1
  const erros = metricas.palavrasPerdidas + metricas.palavrasSobrando
  return Math.max(0, 1 - erros / metricas.palavrasNoPdf)
}

function compararArquivo(antes: MedidaArquivo, agora: MedidaArquivo): ComparacaoArquivo {
  const mudancas: Mudanca[] = []
  if (Boolean(antes.falha) !== Boolean(agora.falha)) {
    mudancas.push({
      rotulo: 'conversão',
      antes: antes.falha ? `falhou (${antes.falha})` : 'ok',
      agora: agora.falha ? `falhou (${agora.falha})` : 'ok',
      melhor: Boolean(antes.falha),
    })
  } else if (antes.metricas && agora.metricas) {
    for (const indicador of INDICADORES) {
      const a = antes.metricas[indicador.campo]
      const b = agora.metricas[indicador.campo]
      if (a === b) continue
      mudancas.push({ rotulo: indicador.rotulo, antes: a, agora: b, melhor: indicador.sentido === 'menor' ? b < a : b > a })
    }
  }

  const melhores = mudancas.filter((m) => m.melhor).length
  const piores = mudancas.length - melhores
  const situacao: Situacao =
    piores > 0 && melhores > 0
      ? 'misto'
      : piores > 0
        ? 'piorou'
        : melhores > 0
          ? 'melhorou'
          : antes.htmlSha256 !== agora.htmlSha256
            ? 'só o HTML mudou'
            : 'igual'
  return { nome: agora.nome, gerador: agora.gerador, situacao, mudancas }
}

export function compararRodadas(base: MedidaArquivo[], agora: MedidaArquivo[]): ResultadoComparacao {
  const basePorSha = new Map(base.map((m) => [m.sha256, m]))
  const pares = agora.flatMap((m) => {
    const anterior = basePorSha.get(m.sha256)
    return anterior ? [[anterior, m] as const] : []
  })

  const totais = INDICADORES.map((indicador) => {
    const soma = (lado: 0 | 1) => pares.reduce((n, par) => n + (par[lado].metricas?.[indicador.campo] ?? 0), 0)
    return { rotulo: indicador.rotulo, sentido: indicador.sentido, antes: soma(0), agora: soma(1) }
  })

  return {
    arquivos: pares.map(([a, b]) => compararArquivo(a, b)),
    totais,
    falhasAntes: pares.filter(([a]) => a.falha).length,
    falhasAgora: pares.filter(([, b]) => b.falha).length,
    semPar: base.length - pares.length,
  }
}

export interface ResumoGerador {
  gerador: string
  arquivos: number
  falhas: number
  /** Média da fidelidade de palavras dos arquivos que converteram. */
  fidelidade: number
  totais: Record<string, number>
  pontuacao: number
}

/** Onde trabalhar primeiro: defeito anda junto com o gerador do PDF. Ordenado pela pontuação. */
export function resumirPorGerador(medidas: MedidaArquivo[]): ResumoGerador[] {
  const grupos = new Map<string, MedidaArquivo[]>()
  for (const m of medidas) grupos.set(m.gerador, [...(grupos.get(m.gerador) ?? []), m])
  return [...grupos.entries()]
    .map(([gerador, lista]) => {
      const convertidos = lista.flatMap((m) => (m.metricas && !m.falha ? [m.metricas] : []))
      const totais: Record<string, number> = {}
      for (const i of INDICADORES) totais[i.rotulo] = convertidos.reduce((n, m) => n + m[i.campo], 0)
      return {
        gerador,
        arquivos: lista.length,
        falhas: lista.length - convertidos.length,
        fidelidade: convertidos.length
          ? convertidos.reduce((n, m) => n + fidelidadePercentual(m), 0) / convertidos.length
          : 0,
        totais,
        pontuacao: lista.reduce((n, m) => n + pontuacao(m), 0),
      }
    })
    .sort((a, b) => b.pontuacao - a.pontuacao)
}
