import { faturamentoCancelado } from './situacao-faturamento'

/**
 * Agregações da aba Faturamento: resumo geral (cartões do topo) e agrupamento por competência
 * (uma faixa por mês, com total e pendências). Puro — sem React — pra ser testável.
 */
const NOMES_MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export interface FaturamentoResumivel {
  id: string
  competenciaAno: number | null
  competenciaMes: number | null
  valorExibido: string
  enviadoCliente: boolean | null
  enviadoGfp: boolean | null
  /** "Cancelado" fica fora das somas de valor (situacao-faturamento.ts). */
  situacao?: string | null
}

export interface ResumoFaturamentos {
  total: number
  /** Soma em decimal string ("1234.56") — pronta pro `formatarMoeda`. */
  valorTotal: string
  enviadoCliente: number
  enviadoGfp: number
}

/** Soma em centavos inteiros, pra não acumular erro de ponto flutuante. Valor ilegível conta 0. */
function somarValores(valores: string[]): string {
  const centavos = valores.reduce((acc, valor) => {
    const numero = Number(valor)
    return Number.isFinite(numero) ? acc + Math.round(numero * 100) : acc
  }, 0)
  return (centavos / 100).toFixed(2)
}

export function resumirFaturamentos(lista: FaturamentoResumivel[]): ResumoFaturamentos {
  return {
    total: lista.length,
    valorTotal: somarValores(lista.filter((item) => !faturamentoCancelado(item.situacao)).map((item) => item.valorExibido)),
    enviadoCliente: lista.filter((item) => item.enviadoCliente).length,
    enviadoGfp: lista.filter((item) => item.enviadoGfp).length,
  }
}

export interface GrupoCompetencia<T extends FaturamentoResumivel> {
  chave: string
  /** "Agosto de 2026" ou "Sem competência". */
  rotulo: string
  itens: T[]
  valorTotal: string
  /** Lançamentos do grupo com algum envio (cliente ou GFP) ainda pendente. */
  pendentes: number
}

/** Agrupa mantendo a ordem em que as competências aparecem na lista (a API já ordena). */
export function agruparPorCompetencia<T extends FaturamentoResumivel>(lista: T[]): GrupoCompetencia<T>[] {
  const grupos = new Map<string, GrupoCompetencia<T>>()
  for (const item of lista) {
    const temCompetencia = item.competenciaAno && item.competenciaMes
    const chave = temCompetencia ? `${item.competenciaAno}-${String(item.competenciaMes).padStart(2, '0')}` : 'sem-competencia'
    let grupo = grupos.get(chave)
    if (!grupo) {
      const mes = temCompetencia ? NOMES_MESES[(item.competenciaMes as number) - 1] : null
      grupo = {
        chave,
        rotulo: mes ? `${mes.charAt(0).toUpperCase()}${mes.slice(1)} de ${item.competenciaAno}` : 'Sem competência',
        itens: [],
        valorTotal: '0.00',
        pendentes: 0,
      }
      grupos.set(chave, grupo)
    }
    grupo.itens.push(item)
  }
  for (const grupo of grupos.values()) {
    grupo.valorTotal = somarValores(grupo.itens.filter((item) => !faturamentoCancelado(item.situacao)).map((item) => item.valorExibido))
    grupo.pendentes = grupo.itens.filter((item) => !item.enviadoCliente || !item.enviadoGfp).length
  }
  return [...grupos.values()]
}
