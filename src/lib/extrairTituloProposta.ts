/**
 * Título amigável pra exibir no lugar do nome de arquivo bruto (que costuma
 * ser um PDF exportado com nome tipo UUID, sem significado pra quem usa o
 * sistema). Usa o primeiro heading `#` do Markdown consolidado — normalmente
 * a identificação da proposta ("Proposta Comercial: PC-SMUL-260806-910") —
 * e cai pro nome do arquivo só quando não há conteúdo ainda (proposta em
 * processamento) ou nenhum heading foi gerado.
 */
export function extrairTituloProposta(markdown: string | null | undefined, nomeArquivoFallback: string): string {
  const primeiroHeading = markdown?.match(/^#\s+(.+)$/m)?.[1]?.trim()
  return primeiroHeading || nomeArquivoFallback
}
