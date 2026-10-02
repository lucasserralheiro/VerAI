/**
 * Texto de documento ou de usuário que vai entrar numa linha de contexto/histórico do assistente:
 * uma linha só, sem `<` nem `>` (não recompõe `<<<FIM>>>`), sem espaços repetidos, com teto.
 */
export function textoSeguroDeLinha(texto: string, max: number): string {
  return texto.replace(/[\r\n]+/g, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').slice(0, max).trim()
}
