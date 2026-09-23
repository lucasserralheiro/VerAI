/**
 * Avisa a ficha do cliente que algo mudou (contrato, faturamento, demanda...) pra os cartões do
 * topo (contratos ativos, valor contratado, faturado, demandas) recalcularem na hora, sem F5.
 * Os números em si nunca são guardados: cada rota recalcula do banco a cada leitura — este aviso só
 * faz a tela pedir de novo.
 */
const EVENTO = 'verai:dados-do-cliente-mudaram'

export function avisarMudancaDeDados(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO))
}

/** Escuta o aviso (e a volta da aba/janela ao foco, que pode ter dado novo de outro usuário). Devolve a função de parar. */
export function aoMudarDados(callback: () => void): () => void {
  const aoVoltar = () => {
    if (document.visibilityState === 'visible') callback()
  }
  window.addEventListener(EVENTO, callback)
  document.addEventListener('visibilitychange', aoVoltar)
  return () => {
    window.removeEventListener(EVENTO, callback)
    document.removeEventListener('visibilitychange', aoVoltar)
  }
}
