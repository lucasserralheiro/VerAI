/** @jest-environment node */
jest.mock('ai', () => ({ generateObject: jest.fn() }))
jest.mock('@/lib/assistente/configuracao', () => ({ modeloDoAssistente: jest.fn(() => 'modelo-padrao') }))

import { generateObject } from 'ai'
import { INSTRUCAO_FICHA, lerComIa, montarTextoParaIa } from './ia'

const paginas = [
  { pagina: 1, texto: 'TERMO ADITIVO Nº 2. Objeto: sustentação.' },
  { pagina: 2, texto: 'A multa por atraso será de 0,5% ao dia sobre o valor da parcela.' },
]

beforeEach(() => jest.clearAllMocks())

it('pede só os campos que faltam, com a instrução fixa no system e o texto na mensagem', async () => {
  ;(generateObject as jest.Mock).mockResolvedValue({ object: { multas: null }, usage: { inputTokens: 900, outputTokens: 40 } })
  await lerComIa({ paginas, faltando: ['multas'], tipoLinha: 'ADITIVO', modelo: 'm' as never })
  const [chamada] = (generateObject as jest.Mock).mock.calls[0]
  expect(chamada.model).toBe('m')
  expect(chamada.system).toBe(INSTRUCAO_FICHA)
  expect(chamada.prompt).toContain('=== página 2 ===')
  expect(chamada.prompt).toContain('A multa por atraso')
  expect(Object.keys(chamada.schema.shape)).toEqual(['multas'])
})

it('só fica o campo que passa na verificação literal', async () => {
  ;(generateObject as jest.Mock).mockResolvedValue({
    object: {
      multas: { valor: '0,5% ao dia', pagina: 2, trecho: 'multa por atraso será de 0,5% ao dia' },
      garantia: { valor: 'caução de 5%', pagina: 2, trecho: 'garantia de 5% em caução' }, // inventado
      medicao: null,
    },
    usage: { inputTokens: 1000, outputTokens: 80 },
  })
  const r = await lerComIa({ paginas, faltando: ['multas', 'garantia', 'medicao'], tipoLinha: 'ADITIVO' })
  expect(r.campos).toEqual({ multas: { valor: '0,5% ao dia', pagina: 2, trecho: 'multa por atraso será de 0,5% ao dia', fonte: 'ia' } })
  expect(r.descartados).toEqual(['garantia'])
  expect(r.tokensEntrada).toBe(1000)
  expect(r.tokensSaida).toBe(80)
})

describe('montarTextoParaIa', () => {
  it('texto curto vai inteiro', () => {
    expect(montarTextoParaIa(paginas, ['multas'])).toBe('=== página 1 ===\nTERMO ADITIVO Nº 2. Objeto: sustentação.\n\n=== página 2 ===\nA multa por atraso será de 0,5% ao dia sobre o valor da parcela.')
  })

  it('acima de 60 mil caracteres: páginas 1 e 2 mais as páginas com as palavras dos campos que faltam', () => {
    const grandes = Array.from({ length: 30 }, (_, i) => ({ pagina: i + 1, texto: `${i === 20 ? 'Da multa moratória. ' : ''}${'x'.repeat(4000)}` }))
    const texto = montarTextoParaIa(grandes, ['multas'])
    expect(texto).toContain('=== página 1 ===')
    expect(texto).toContain('=== página 2 ===')
    expect(texto).toContain('=== página 21 ===')
    expect(texto).not.toContain('=== página 10 ===')
    expect(texto.length).toBeLessThanOrEqual(60_000)
  })
})
