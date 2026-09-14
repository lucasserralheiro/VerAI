/**
 * Título amigável pra exibir no lugar do nome de arquivo bruto (que costuma
 * ser um PDF exportado com nome tipo UUID, sem significado pra quem usa o
 * sistema).
 *
 * Prioridade:
 * 1. o heading que identifica a proposta ("Proposta Comercial: PC-SMUL-260806-910"),
 *    em qualquer nível de 1 a 3 — alguns PDFs saem com essa linha como `##`
 *    e o primeiro `#` é um título de seção ("TERMOS E CONDIÇÕES..."), que
 *    não identifica a proposta;
 * 2. o primeiro heading `#`;
 * 3. o nome do arquivo, quando não há conteúdo ainda ou nenhum heading.
 */
export function extrairTituloProposta(markdown: string | null | undefined, nomeArquivoFallback: string): string {
  if (!markdown) return nomeArquivoFallback

  const identificacao = markdown.match(/^#{1,3}\s+(Proposta Comercial\b.*)$/im)?.[1]
  if (identificacao) return limparHeading(identificacao) || nomeArquivoFallback

  const primeiroHeading = markdown.match(/^#\s+(.+)$/m)?.[1]
  return (primeiroHeading && limparHeading(primeiroHeading)) || nomeArquivoFallback
}

function limparHeading(texto: string): string {
  return texto
    .replace(/\*\*|__/g, '')
    .replace(/\s+#+\s*$/, '')
    .trim()
}
