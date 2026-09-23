import { situacaoVencimento } from './vencimento'

// Regras de "ativo"/"aberto" dos relatórios cross-cliente e dos indicadores da ficha (Task 8). A
// situação é texto livre (valores reais no banco: contrato "Ativo"/"Finalizado"/vazio; demanda
// "Em andamento"/"Concluído"), então a regra procura palavras de encerramento em vez de comparar
// com uma lista fechada. `Contrato.vigente` não entra: veio `false` em todos os contratos do import.

const ENCERRAMENTO = /encerr|rescin|cancel|finaliz|conclu/i

/** Ativo = situação sem palavra de encerramento e vencimento que ainda não passou (sem data conta
 *  como não vencido). */
export function contratoAtivo(
  contrato: { situacao: string | null; dataVencimento: Date | null },
  hoje: Date
): boolean {
  if (contrato.situacao && ENCERRAMENTO.test(contrato.situacao)) return false
  return situacaoVencimento(contrato.dataVencimento, hoje).nivel !== 'vencido'
}

export function demandaAberta(situacao: string | null): boolean {
  return !situacao || !ENCERRAMENTO.test(situacao)
}

/** O import trouxe competências com lixo (ano 26, ano 20252, mês 88) — ficam fora de "último mês". */
export function competenciaValida(ano: number | null, mes: number | null): boolean {
  return ano !== null && mes !== null && ano >= 2000 && ano <= 2100 && mes >= 1 && mes <= 12
}
