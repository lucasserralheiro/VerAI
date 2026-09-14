/** Escapa `&`/`<`/`>` — todo texto BRUTO extraído do PDF/planilha passa por
 *  aqui antes de entrar em qualquer tag HTML montada pelo conversor. Nunca
 *  aplicar nas tags que o próprio código insere (senão a tag vira texto
 *  literal na tela). A ordem importa: `&` primeiro, senão um `&lt;` já
 *  literal do documento original viraria `&amp;lt;` em vez de continuar
 *  representando o caractere `<`. */
export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
