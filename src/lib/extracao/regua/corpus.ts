/**
 * Que arquivos entram na régua da conversão e como se agrupam.
 *
 * O corpus vem da biblioteca ContratosReceita do SharePoint (a mesma pasta do
 * OneDrive que a sincronização lê): toda pasta de termo guarda a proposta que
 * originou aquele termo — PC (proposta comercial) ou PA (proposta de aditivo),
 * de todos os clientes e de anos de geradores diferentes. É a amostra mais
 * próxima do que chega na tela "Nova conversão".
 */

/**
 * Nome de arquivo de proposta da PRODAM. Formatos vistos na biblioteca:
 *   "PC-ADESAMPA-240326-44 v3.0.pdf", "PA-CGM- 250912-127 v4.0.pdf",
 *   "Proposta PA-201210-154 v1.0.pdf", "SEI_147453498_Proposta_Comercial_934.pdf".
 * O PC/PA não pode vir colado em letra antes ("SPA-..."), e o termo
 * ("TC 073-2019 - TA 02.pdf") não entra.
 */
export function pareceProposta(nomeDoArquivo: string): boolean {
  const nome = nomeDoArquivo.normalize('NFC')
  if (!/\.pdf$/i.test(nome)) return false
  return /(?:^|[^A-Za-z])P[CA]\s*-\s*\S/i.test(nome) || /proposta/i.test(nome)
}

/**
 * Família do gerador, sem versão: "Microsoft® Word para Microsoft 365 /
 * Microsoft® Word para Microsoft 365" e "Acrobat PDFMaker 23 para Word / Adobe
 * PDF Library 23.1.175" viram um nome só por família. Versão separaria em
 * vinte grupos de um arquivo o que quebra do mesmo jeito.
 */
export function familiaDoGerador(creator?: string | null, producer?: string | null): string {
  const limpar = (texto: string | null | undefined) =>
    (texto ?? '')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\b(?:v(?:ersão|ersion)?\s*)?\d+(?:[.\-_]\d+)*\b/gi, ' ')
      .replace(/[;,]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  const partes = [...new Set([limpar(creator), limpar(producer)].filter(Boolean))]
  return partes.join(' / ') || '(sem metadado)'
}
