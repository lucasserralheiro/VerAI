/**
 * Guardrail da revisão ortográfica da Proposta Comercial: compara o Markdown
 * original com o que a IA devolveu e rejeita qualquer coisa que vá além de
 * troca de palavra — mudança de número, de estrutura ou de contagem de linhas.
 * Devolve `null` quando é seguro aplicar, ou uma mensagem curta do problema.
 */
export function validarRevisaoPortugues(original: string, corrigido: string): string | null {
  const linhas = (s: string) => s.split('\n')
  const contaTitulos = (s: string) => linhas(s).filter((l) => /^\s*#{1,6}\s/.test(l)).length
  const contaLinhasTabela = (s: string) => linhas(s).filter((l) => l.includes('|')).length
  const contaItensLista = (s: string) => linhas(s).filter((l) => /^\s*([-*]|\d+\.)\s/.test(l)).length
  const digitosOrdenados = (s: string) => (s.match(/\d+/g) ?? []).slice().sort()

  if (linhas(original).length !== linhas(corrigido).length) {
    return 'a revisão alterou a quantidade de linhas do documento'
  }
  if (contaTitulos(original) !== contaTitulos(corrigido)) {
    return 'a revisão alterou os títulos do documento'
  }
  if (contaLinhasTabela(original) !== contaLinhasTabela(corrigido)) {
    return 'a revisão alterou as tabelas do documento'
  }
  if (contaItensLista(original) !== contaItensLista(corrigido)) {
    return 'a revisão alterou as listas do documento'
  }

  const digitosOriginal = digitosOrdenados(original)
  const digitosCorrigido = digitosOrdenados(corrigido)
  if (
    digitosOriginal.length !== digitosCorrigido.length ||
    digitosOriginal.some((valor, i) => valor !== digitosCorrigido[i])
  ) {
    return 'a revisão alterou números do documento'
  }

  return null
}
