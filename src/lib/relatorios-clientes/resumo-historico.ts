import { linhaAssinada } from './regras'

/**
 * Resumo do histórico de um contrato pra listagem (aba Contratos): quantos aditivos/prorrogações,
 * o valor atual do contrato e o PDF de proposta (PC/PA) e de termo (TC/TA) mais recente.
 *
 * Valor atual: cada linha do histórico guarda o valor TOTAL do contrato naquele momento (no Access,
 * contrato 69.687.389,32 → aditivo 69.699.911,05 → ... → última prorrogação 68.071.931,88), não o
 * acréscimo. Então o valor atual é o da linha mais recente que tem valor — prospecção (proposta),
 * rescisão (acerto) e aditivo/prorrogação ainda não assinado ficam de fora. "Mais recente" = maior data de
 * assinatura, ou o início da vigência quando a linha não tem data de assinatura (assinatura provada pelo
 * controle do faturamento ou pela planilha de contratos — spec 2026-09-29-valor-vigencia-contratos); linha
 * sem nenhuma das duas perde pra qualquer linha datada e, entre sem data, vale a criada por último (a ordem
 * em que chegaram).
 */

export interface LinhaResumoHistorico {
  tipo: 'CONTRATO' | 'ADITIVO' | 'PRORROGACAO' | 'RESCISAO' | 'PROSPECCAO'
  data: Date | null
  /** Início da vigência da linha — ordena a linha assinada que não tem data de assinatura. */
  dataInicio?: Date | null
  createdAt: Date
  numero: string | null
  proposta: string | null
  /** `Decimal` do Prisma (ou string); só o `toString()` interessa. */
  valor: { toString(): string } | null
  /** Situação da linha — com `data`, diz se aditivo/prorrogação já foi assinado (`linhaAssinada`). */
  situacao?: string | null
  propostaPdfUrl: string | null
  propostaPdfNome: string | null
  termoPdfUrl: string | null
  termoPdfNome: string | null
}

export interface AnexoResumo {
  url: string
  nome: string | null
  /** Identificação da linha de onde veio (nº da proposta ou do termo) — vira o tooltip do ícone. */
  referencia: string | null
}

export interface ResumoHistorico {
  aditivos: number
  prorrogacoes: number
  /** Valor atual do contrato (string decimal, ex. "68071931.88") e de qual linha veio. */
  valorAtual: { valor: string; tipo: LinhaResumoHistorico['tipo']; data: string | null } | null
  proposta: AnexoResumo | null
  termo: AnexoResumo | null
}

function maisRecenteQue(a: LinhaResumoHistorico, b: LinhaResumoHistorico): boolean {
  const ta = (a.data ?? a.dataInicio)?.getTime() ?? -Infinity
  const tb = (b.data ?? b.dataInicio)?.getTime() ?? -Infinity
  if (ta !== tb) return ta > tb
  return a.createdAt.getTime() >= b.createdAt.getTime()
}

export function resumirHistorico(linhas: LinhaResumoHistorico[]): ResumoHistorico {
  let proposta: { linha: LinhaResumoHistorico } | null = null
  let termo: { linha: LinhaResumoHistorico } | null = null
  let valorAtual: { linha: LinhaResumoHistorico } | null = null
  let aditivos = 0
  let prorrogacoes = 0

  for (const linha of linhas) {
    if (linha.tipo === 'ADITIVO') aditivos++
    if (linha.tipo === 'PRORROGACAO') prorrogacoes++
    // Valor atual = o do último termo ASSINADO (contrato, aditivo, prorrogação). Prospecção é proposta;
    // rescisão guarda acerto (saldo, multa), não o valor do contrato; aditivo sem assinatura não vale
    // ainda (decisões do usuário, 23/09/2026).
    const contaParaValor = linha.tipo !== 'PROSPECCAO' && linha.tipo !== 'RESCISAO' && linhaAssinada(linha)
    if (linha.valor !== null && contaParaValor && (!valorAtual || maisRecenteQue(linha, valorAtual.linha))) {
      valorAtual = { linha }
    }
    if (linha.propostaPdfUrl && (!proposta || maisRecenteQue(linha, proposta.linha))) proposta = { linha }
    if (linha.termoPdfUrl && (!termo || maisRecenteQue(linha, termo.linha))) termo = { linha }
  }

  return {
    aditivos,
    prorrogacoes,
    valorAtual: valorAtual
      ? {
          valor: valorAtual.linha.valor!.toString(),
          tipo: valorAtual.linha.tipo,
          data: valorAtual.linha.data?.toISOString() ?? null,
        }
      : null,
    proposta: proposta
      ? { url: proposta.linha.propostaPdfUrl!, nome: proposta.linha.propostaPdfNome, referencia: proposta.linha.proposta }
      : null,
    termo: termo ? { url: termo.linha.termoPdfUrl!, nome: termo.linha.termoPdfNome, referencia: termo.linha.numero } : null,
  }
}
