// Três tipos de resposta (spec 2026-09-30-assistente-consultor §6). Sem import de servidor: a tela usa.

export const RECUSA =
  'Isso está fora do que o assistente do VerAI atende. Pergunte sobre clientes, contratos, faturamento, prazos, preços, reajuste, documentos ou dúvidas do trabalho.'
export const TITULO_GERAL = 'Não está nos documentos do VerAI · resposta da IA'
export const RODAPE_GERAL = 'Confira antes de usar.'
export const NAO_ENCONTREI = 'Não encontrei isso no VerAI.'

export type Bloco = { tipo: 'verai' | 'geral'; texto: string }

export function separarBlocos(texto: string): Bloco[] {
  const blocos: Bloco[] = []
  const empurrar = (tipo: Bloco['tipo'], t: string) => {
    const limpo = t.trim()
    if (limpo) blocos.push({ tipo, texto: limpo })
  }
  let resto = texto
  // Abertura: aceita indent e bullet, mas :::geral sem espaço entre
  // Fechamento: exatamente ::: em coluna 0
  const regexAbertura = /^[ \t]*(?:[-*][ \t]+)?:::geral[ \t]*$/m
  const regexFechamento = /^:::$/m

  for (;;) {
    const ini = resto.search(regexAbertura)
    if (ini < 0) {
      empurrar('verai', resto)
      break
    }
    empurrar('verai', resto.slice(0, ini))
    // Remove a linha de abertura
    const depois = resto.slice(ini).replace(regexAbertura, '')
    const fim = depois.search(regexFechamento)
    if (fim < 0) {
      empurrar('geral', depois)
      break
    }
    empurrar('geral', depois.slice(0, fim))
    resto = depois.slice(fim).replace(regexFechamento, '')
  }
  return blocos
}

export function tiposDaResposta(texto: string): ('verai' | 'geral' | 'recusa')[] {
  // Normalizar: remover **, >, aspas, espaços de início/fim
  let normalizado = texto.trim()
  normalizado = normalizado.replace(/^\*\*/, '').replace(/\*\*$/, '')
  normalizado = normalizado.replace(/^>+\s*/, '')
  normalizado = normalizado.replace(/^["'`]+/, '').replace(/["'`]+$/, '')
  normalizado = normalizado.trim()

  // Verificar se começa com a recusa completa
  if (normalizado.startsWith(RECUSA)) {
    // Remover a recusa e ver se sobrou conteúdo
    const resto = normalizado.slice(RECUSA.length).trim()
    if (!resto) {
      return ['recusa']
    }
    // Sobrou conteúdo: retornar recusa + tipos do resto
    const tiposResto = [...new Set(separarBlocos(resto).map((b) => b.tipo))]
    return ['recusa', ...tiposResto]
  }

  return [...new Set(separarBlocos(texto).map((b) => b.tipo))]
}
