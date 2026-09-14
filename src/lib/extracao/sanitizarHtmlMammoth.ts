const ATRIBUTOS_REMOVIDOS = /\s(?:id|class|style)="[^"]*"/g

/**
 * Sanitiza o HTML que o `mammoth` gera a partir de um `.docx` — remove só
 * atributos que o `mammoth` pode anexar (`id` de âncora de sumário, `class`
 * de estilo do Word) e que não servem pro documento final. Não reescreve tag
 * nenhuma: o subconjunto que o `mammoth` produz (h1-h6, p, strong/em, u, a,
 * ul/ol/li, table, br) já É o formato de saída deste módulo — não existe
 * mais "conversão pra outra sintaxe" aqui, só limpeza de atributo.
 */
export function sanitizarHtmlMammoth(html: string): string {
  return html.replace(ATRIBUTOS_REMOVIDOS, '')
}
