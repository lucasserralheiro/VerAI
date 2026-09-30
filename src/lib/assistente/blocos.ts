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
  for (;;) {
    const ini = resto.search(/^:::geral\s*$/m)
    if (ini < 0) {
      empurrar('verai', resto)
      break
    }
    empurrar('verai', resto.slice(0, ini))
    const depois = resto.slice(ini).replace(/^:::geral\s*\n?/, '')
    const fim = depois.search(/^:::\s*$/m)
    if (fim < 0) {
      empurrar('geral', depois)
      break
    }
    empurrar('geral', depois.slice(0, fim))
    resto = depois.slice(fim).replace(/^:::\s*\n?/, '')
  }
  return blocos
}

export function tiposDaResposta(texto: string): ('verai' | 'geral' | 'recusa')[] {
  if (texto.trim().startsWith(RECUSA.slice(0, 50))) return ['recusa']
  return [...new Set(separarBlocos(texto).map((b) => b.tipo))]
}
