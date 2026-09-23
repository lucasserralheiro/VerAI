import { situacaoVencimento } from './vencimento'

// Regras de "ativo"/"aberto" dos relatórios cross-cliente e dos indicadores da ficha (Task 8). A
// situação é texto livre (valores reais no banco: contrato "Ativo"/"Finalizado"/vazio; demanda
// "Em andamento"/"Concluído"), então a regra procura palavras de encerramento em vez de comparar
// com uma lista fechada. `Contrato.vigente` não entra: veio `false` em todos os contratos do import.

const ENCERRAMENTO = /encerr|rescin|cancel|finaliz|conclu/i

const SITUACAO_ATIVA = /^\s*(ativ|vigent)/i

/** Ativo, nesta ordem:
 *  1. situação com palavra de encerramento → não;
 *  2. situação explicitamente "Ativo"/"Vigente" → SIM, mesmo com a data vencida: quem mantém o
 *     cadastro decidiu que o contrato segue de pé, e a data vencida aparece como ALERTA (semáforo e
 *     relatório de vencimentos), não some com o contrato das somas;
 *  3. sem situação: a data decide (vencimento que já passou → não; sem data → sim). */
export function contratoAtivo(
  contrato: { situacao: string | null; dataVencimento: Date | null },
  hoje: Date
): boolean {
  if (contrato.situacao && ENCERRAMENTO.test(contrato.situacao)) return false
  if (contrato.situacao && SITUACAO_ATIVA.test(contrato.situacao)) return true
  return situacaoVencimento(contrato.dataVencimento, hoje).nivel !== 'vencido'
}

/** Linha vazia do legado: sem número, descrição, SEI, datas, histórico, itens nem faturamento. Não é
 *  contrato — não conta em "ativos" nem entra nas somas (a tela marca como "cadastro vazio"). */
export function contratoVazio(contrato: {
  numeroTermo: string | null
  descricao: string | null
  seiCliente: string | null
  seiProdam: string | null
  dataInicio: Date | null
  dataVencimento: Date | null
  historico: number
  itens: number
  faturamentos: number
}): boolean {
  const texto = (v: string | null) => Boolean(v?.trim())
  return (
    !texto(contrato.numeroTermo) &&
    !texto(contrato.descricao) &&
    !texto(contrato.seiCliente) &&
    !texto(contrato.seiProdam) &&
    !contrato.dataInicio &&
    !contrato.dataVencimento &&
    contrato.historico === 0 &&
    contrato.itens === 0 &&
    contrato.faturamentos === 0
  )
}

export function demandaAberta(situacao: string | null): boolean {
  return !situacao || !ENCERRAMENTO.test(situacao)
}

/** O import trouxe competências com lixo (ano 26, ano 20252, mês 88) — ficam fora de "último mês". */
export function competenciaValida(ano: number | null, mes: number | null): boolean {
  return ano !== null && mes !== null && ano >= 2000 && ano <= 2100 && mes >= 1 && mes <= 12
}

/** Maior vencimento entre o cabeçalho do contrato e as linhas do histórico que estendem o prazo
 *  (aditivo, prorrogação, contrato). Prospecção (proposta não assinada) e rescisão não estendem. É o
 *  "fim de vigência" de verdade — o cabeçalho do legado quase nunca é atualizado na prorrogação. */
export function vigenciaEfetiva(
  cadastro: Date | null,
  linhas: Array<{ tipo: string; dataVencimento: Date | null }>
): Date | null {
  let fim = cadastro
  for (const linha of linhas) {
    if (linha.tipo === 'PROSPECCAO' || linha.tipo === 'RESCISAO') continue
    if (linha.dataVencimento && (!fim || linha.dataVencimento.getTime() > fim.getTime())) fim = linha.dataVencimento
  }
  return fim
}
