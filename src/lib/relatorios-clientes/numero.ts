/**
 * UMA regra para transformar texto em valor decimal — usada pela tela (validação das rotas), pela
 * importação de planilha de itens e pelo importador do GRC-1. Antes eram três regras e o mesmo
 * "1.500" virava erro na tela, 1500 na planilha e 1,5 no importador.
 *
 * Aceita `"1.234,56"`, `"1234,56"`, `",5"`, `"1234.56"`, `"R$ 1.234,56"` e número JS; devolve a
 * string normalizada (`"1234.56"`) pronta pro `Decimal` do Prisma. Regras para texto:
 * - com vírgula: a vírgula é o decimal e os pontos são milhar (`"1.500,00"` → `"1500.00"`);
 * - sem vírgula e com vários pontos: todos são milhar (`"1.234.567"` → `"1234567"`);
 * - sem vírgula e com um único ponto seguido de exatamente 3 dígitos (`"1.500"`, `"0.125"`):
 *   **ambíguo** — em pt-BR é milhar, em notação de ponto é decimal —, então é recusado em vez de
 *   virar um erro silencioso de 1000×;
 * - sem vírgula e com um único ponto seguido de outra quantidade de dígitos: o ponto é o decimal.
 * Número JS nunca é ambíguo (`1234.567` fica `"1234.567"`). Negativo é recusado.
 */
export function normalizarDecimal(bruto: string | number): { valor: string } | { erro: string } {
  let texto = typeof bruto === 'number' ? String(bruto) : bruto.replace(/R\$/gi, '').replace(/\s/g, '')
  if (typeof bruto === 'string') {
    const pontos = (texto.match(/\./g) ?? []).length
    if (texto.includes(',')) {
      texto = texto.replace(/\./g, '').replace(',', '.')
    } else if (pontos > 1) {
      texto = texto.replace(/\./g, '')
    } else if (/\.\d{3}$/.test(texto)) {
      return { erro: 'valor ambíguo — use vírgula para decimais (ex.: 1.500,00)' }
    }
    if (texto.startsWith('.')) texto = `0${texto}`
  }
  if (!/^-?\d+(\.\d+)?$/.test(texto)) return { erro: 'valor numérico inválido' }
  if (texto.startsWith('-')) return { erro: 'valor não pode ser negativo' }
  return { valor: texto }
}
