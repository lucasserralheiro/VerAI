/**
 * Número de processo SEI: formatação padrão e endereço pra abrir o processo.
 *
 * O número SEI da Prefeitura tem 16 dígitos e aparece em três grafias nos dados (com máscara
 * "6017.2024/0028323-7", só dígitos "7010202600096354", com espaços). A tela sempre mostra a
 * máscara; a busca e o vínculo comparam só os dígitos (`digitosDoSei`).
 *
 * O endereço vem, nesta ordem, de:
 *  1. um link cadastrado pra aquele processo (hoje só `Contrato.linkSei`);
 *  2. o modelo configurado em `NEXT_PUBLIC_SEI_URL_TEMPLATE` — ex.
 *     `https://sei.exemplo.gov.br/pesquisa?protocolo={numero}`, onde `{numero}` é o número com
 *     máscara e `{digitos}` só os dígitos;
 *  3. nenhum → `null` (o componente `SeiLink` então copia o número ao clicar).
 */

export function digitosDoSei(bruto: string | null | undefined): string {
  return (bruto ?? '').replace(/\D+/g, '')
}

/** Chave de um número SEI pra comparar/guardar link: os dígitos (mesma chave nas três grafias) ou,
 *  quando não é um número SEI de verdade (texto livre no campo), o texto minúsculo. */
export function chaveDoSei(bruto: string | null | undefined): string {
  const d = digitosDoSei(bruto)
  return d.length >= 10 ? d : (bruto ?? '').trim().toLowerCase()
}

/** "7010202600096354" → "7010.2026/0009635-4". Fora do padrão de 16 dígitos devolve o texto aparado. */
export function formatarSei(bruto: string | null | undefined): string {
  const texto = (bruto ?? '').trim()
  const d = digitosDoSei(texto)
  if (d.length !== 16) return texto
  return `${d.slice(0, 4)}.${d.slice(4, 8)}/${d.slice(8, 15)}-${d.slice(15)}`
}

export function urlDoSei(
  numero: string | null | undefined,
  linkCadastrado?: string | null,
  modelo: string | undefined = process.env.NEXT_PUBLIC_SEI_URL_TEMPLATE
): string | null {
  if (!numero?.trim()) return null
  const link = linkCadastrado?.trim()
  if (link) return link
  if (modelo && modelo.includes('{')) {
    return modelo
      .replaceAll('{numero}', encodeURIComponent(formatarSei(numero)))
      .replaceAll('{digitos}', encodeURIComponent(digitosDoSei(numero)))
  }
  return null
}
