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

/** Situação cadastrada diz "Ativo"/"Vigente" (sem palavra de encerramento). */
export function situacaoDizAtivo(situacao: string | null): boolean {
  return !!situacao && !ENCERRAMENTO.test(situacao) && SITUACAO_ATIVA.test(situacao)
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

/**
 * A linha do histórico já VALE? Decisão do usuário (23/09/2026), pela regra do contrato público: aditivo
 * e prorrogação só produzem efeito depois de assinados. Sem assinatura, é "em andamento" — não estende
 * prazo nem muda o valor. Evidência de assinatura: "Assinada em" preenchida, ou situação da linha
 * dizendo assinado/vigente/publicado. A linha CONTRATO vale sempre (o contrato existe — o cabeçalho é
 * a prova); prospecção e rescisão não estendem nada de qualquer jeito.
 */
export function linhaAssinada(linha: { tipo: string; data: Date | null; situacao?: string | null }): boolean {
  if (linha.tipo === 'CONTRATO') return true
  if (linha.data) return true
  const situacao = linha.situacao ?? ''
  return /assinad|vigent|publicad/i.test(situacao) && !/n[aã]o\s+assinad|pendente|elabora|cancel/i.test(situacao)
}

/** Maior vencimento entre o cabeçalho do contrato e as linhas do histórico que estendem o prazo
 *  (contrato; aditivo e prorrogação ASSINADOS — `linhaAssinada`). Prospecção (proposta não assinada),
 *  rescisão e aditivo/prorrogação ainda sem assinatura não estendem. É o "fim de vigência" de verdade —
 *  o cabeçalho do legado quase nunca é atualizado na prorrogação. */
export function vigenciaEfetiva(
  cadastro: Date | null,
  linhas: Array<{ tipo: string; dataVencimento: Date | null; data: Date | null; situacao?: string | null }>
): Date | null {
  let fim = cadastro
  for (const linha of linhas) {
    if (linha.tipo === 'PROSPECCAO' || linha.tipo === 'RESCISAO') continue
    if (!linhaAssinada(linha)) continue
    if (linha.dataVencimento && (!fim || linha.dataVencimento.getTime() > fim.getTime())) fim = linha.dataVencimento
  }
  return fim
}

/** Aditivo/prorrogação AINDA NÃO assinado que levaria o prazo além da vigência efetiva: aviso de
 *  "prorrogação em andamento" (não muda o prazo — `vigenciaEfetiva`). */
export function prorrogacaoEmAndamento(
  vigenciaFim: Date | null,
  linhas: Array<{ tipo: string; dataVencimento: Date | null; data: Date | null; situacao?: string | null }>
): boolean {
  return linhas.some(
    (linha) =>
      (linha.tipo === 'ADITIVO' || linha.tipo === 'PRORROGACAO') &&
      !linhaAssinada(linha) &&
      !!linha.dataVencimento &&
      (!vigenciaFim || linha.dataVencimento.getTime() > vigenciaFim.getTime())
  )
}
