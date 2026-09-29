import { decidirLinha, type EntradaLinha } from './decidir'

const d = (a: number, m: number, dia: number) => new Date(Date.UTC(a, m - 1, dia))
const vazia = { valor: null, dataInicio: null, dataVencimento: null, data: null, situacao: null }
const base = (extra: Partial<EntradaLinha> = {}): EntradaLinha => ({
  tipo: 'PRORROGACAO',
  atual: { ...vazia },
  ficha: null,
  fichaFim: null,
  proposta: null,
  planilha: null,
  controle: null,
  anterior: null,
  ...extra,
})
const PRORROGACAO = {
  valor: 'R$ 3.151.984,05',
  trecho: 'O valor total estimado do Contrato nª 068/SMDHC/2020, para o período ora prorrogado pelo presente Termo de aditamento, é de R$ 3.151.984,05 (Três milhões',
  pagina: 2,
}
const planilha = (valor: string | null, extra = {}) => ({ valor, inicio: d(2025, 11, 1), fim: d(2026, 10, 31), concluida: true, simples: true, linha: 245, ...extra })
const controle = (previsto: string, extra = {}) => ({ previsto, inicio: d(2025, 11, 1), fim: d(2026, 10, 31), mes: '2026-08', arquivoId: 'ab1', ...extra })

describe('valor', () => {
  it('termo + planilha iguais: grava com as duas provas', () => {
    const r = decidirLinha(base({ ficha: PRORROGACAO, planilha: planilha('3151984.05') }))
    expect(r.valor).toEqual({
      dado: '3151984.05',
      origem: 'TERMO+PLANILHA',
      prova: { pagina: 2, trecho: PRORROGACAO.trecho, provas: ['planilha'], planilhaLinha: 245 },
    })
  })

  it('termo + controle iguais: grava; controle diferente do termo não bloqueia, vira aviso', () => {
    expect(decidirLinha(base({ ficha: PRORROGACAO, controle: controle('3151984.05') })).valor?.origem).toBe('TERMO+CONTROLE')
    const r = decidirLinha(base({ ficha: PRORROGACAO, planilha: planilha('3151984.05'), controle: controle('3300000.00') }))
    expect(r.valor?.origem).toBe('TERMO+PLANILHA')
    expect(r.avisos).toContain('o faturamento usa R$ 3.300.000,00 (controle de ago/2026)')
  })

  it('termo sozinho (sem segunda prova): não grava, avisa', () => {
    const r = decidirLinha(base({ ficha: PRORROGACAO }))
    expect(r.valor).toBeUndefined()
    expect(r.avisos).toContain('valor lido do termo sem segunda prova: R$ 3.151.984,05')
  })

  it('planilha diferente do termo: contradição, não grava', () => {
    const r = decidirLinha(base({ ficha: PRORROGACAO, planilha: planilha('3000000.00') }))
    expect(r.valor).toBeUndefined()
    expect(r.avisos).toContain('a planilha de contratos diz R$ 3.000.000,00 e o termo R$ 3.151.984,05')
  })

  it('número e extenso diferentes no termo: nunca grava', () => {
    const r = decidirLinha(
      base({
        tipo: 'ADITIVO',
        ficha: { valor: 'R$ 97.181,62', trecho: 'o valor do contrato passa para R$ 97.181,62 (noventa e quatro mil e trezentos e trinta e seis reais e e dezoito centavos).', pagina: 1 },
        controle: controle('97181.62'),
      })
    )
    expect(r.valor).toBeUndefined()
    expect(r.avisos).toContain('número e extenso diferentes no termo (R$ 97.181,62)')
  })

  it('categoria que não é o valor do contrato (supressão) não grava', () => {
    const r = decidirLinha(base({ tipo: 'ADITIVO', ficha: { valor: 'R$ 72.032,85', trecho: 'VALOR TOTAL ESTIMADO DA SUPRESSÃO: R$ 72.032,85', pagina: 1 }, controle: controle('72032.85') }))
    expect(r.valor).toBeUndefined()
  })

  it('extenso igual é prova; contrato inicial também confere com a proposta', () => {
    const r = decidirLinha(
      base({
        tipo: 'CONTRATO',
        ficha: { valor: 'R$ 2.207.992,20', trecho: 'O valor estimado do contrato é de R$ 2.207.992,20 (dois milhões, duzentos e sete mil, novecentos e noventa e dois reais e vinte centavos)', pagina: 3 },
        proposta: '2207992.20',
      })
    )
    expect(r.valor?.origem).toBe('TERMO+EXTENSO+PROPOSTA')
  })

  it('aditivo "passa de X para Y" com X igual ao valor da linha anterior: prova da cadeia', () => {
    const r = decidirLinha(
      base({
        tipo: 'ADITIVO',
        ficha: { valor: 'R$ 6.488.055,34', trecho: 'passando o valor do contrato de R$ 5.808.984,99 para R$ 6.488.055,34 (seis', pagina: 1 },
        anterior: '5808984.99',
      })
    )
    expect(r.valor?.origem).toBe('TERMO+CADEIA')
  })

  it('termo escaneado (sem ficha): planilha e controle iguais gravam', () => {
    const r = decidirLinha(base({ planilha: planilha('88381.19'), controle: controle('88381.19') }))
    expect(r.valor).toMatchObject({ dado: '88381.19', origem: 'PLANILHA+CONTROLE' })
  })

  it('planilha de aditivo (diferença ou total, misturado) não é prova', () => {
    const r = decidirLinha(base({ ficha: PRORROGACAO, planilha: planilha('3151984.05', { simples: false }) }))
    expect(r.valor).toBeUndefined()
  })

  it('linha que já tem valor nunca é decidida', () => {
    expect(decidirLinha(base({ atual: { ...vazia, valor: '1.00' }, ficha: PRORROGACAO, planilha: planilha('3151984.05') })).valor).toBeUndefined()
  })
})

describe('vigência', () => {
  it('controle preenche só o fim — o início dele é o do contrato inteiro', () => {
    expect(decidirLinha(base({ controle: controle('1.00', { inicio: d(2023, 12, 15) }) })).vigencia).toEqual({
      dado: { inicio: null, fim: d(2026, 10, 31) },
      origem: 'CONTROLE',
      prova: { mes: '2026-08', arquivoId: 'ab1', gravouInicio: false },
    })
  })

  it('controle + planilha do mesmo termo com o mesmo fim: o início vem da planilha', () => {
    expect(decidirLinha(base({ controle: controle('1.00', { inicio: d(2023, 12, 15) }), planilha: planilha(null) })).vigencia).toEqual({
      dado: { inicio: d(2025, 11, 1), fim: d(2026, 10, 31) },
      origem: 'CONTROLE+PLANILHA',
      prova: { mes: '2026-08', arquivoId: 'ab1', planilhaLinha: 245, gravouInicio: true },
    })
  })

  it('início já preenchido fica; fim do termo igual reforça', () => {
    const r = decidirLinha(base({ atual: { ...vazia, dataInicio: d(2025, 10, 30) }, fichaFim: d(2026, 10, 31), controle: controle('1.00') }))
    expect(r.vigencia).toMatchObject({ dado: { inicio: null, fim: d(2026, 10, 31) }, origem: 'CONTROLE+TERMO' })
  })

  it('fim do termo diferente: não grava e avisa', () => {
    const r = decidirLinha(base({ fichaFim: d(2026, 9, 30), controle: controle('1.00') }))
    expect(r.vigencia).toBeUndefined()
    expect(r.avisos).toContain('o termo diz fim em 30/09/2026 e o controle do faturamento 31/10/2026')
  })

  it('controle e planilha do mesmo termo com fins diferentes: não grava e avisa; o termo igual ao controle desempata', () => {
    const r = decidirLinha(base({ controle: controle('1.00', { fim: d(2027, 1, 18) }), planilha: planilha(null, { fim: d(2027, 2, 18) }) }))
    expect(r.vigencia).toBeUndefined()
    expect(r.avisos).toContain('o controle do faturamento diz fim em 18/01/2027 e a planilha de contratos 18/02/2027')
    const comTermo = decidirLinha(base({ fichaFim: d(2027, 1, 18), controle: controle('1.00', { fim: d(2027, 1, 18) }), planilha: planilha(null, { fim: d(2027, 2, 18) }) }))
    expect(comTermo.vigencia).toMatchObject({ dado: { inicio: null, fim: d(2027, 1, 18) }, origem: 'CONTROLE+TERMO' })
  })

  it('sem controle, a planilha do mesmo termo preenche', () => {
    expect(decidirLinha(base({ planilha: planilha(null) })).vigencia?.origem).toBe('PLANILHA')
  })

  it('vigência fora do normal (fim antes do início, menos de 30 dias, mais de 10 anos): não grava e avisa', () => {
    const invertida = decidirLinha(base({ planilha: planilha(null, { inicio: d(2026, 1, 16), fim: d(2026, 1, 15) }) }))
    expect(invertida.vigencia).toBeUndefined()
    expect(invertida.avisos).toEqual(['a planilha de contratos dá vigência fora do normal (16/01/2026 a 15/01/2026) — confira'])
    expect(decidirLinha(base({ planilha: planilha(null, { inicio: d(2025, 11, 12), fim: d(2025, 11, 30) }) })).vigencia).toBeUndefined()
    // Prorrogação curta com o fim confirmado pelo termo é de verdade.
    const curta = decidirLinha(base({ fichaFim: d(2024, 12, 31), planilha: planilha(null, { inicio: d(2024, 12, 6), fim: d(2024, 12, 31) }) }))
    expect(curta.vigencia?.origem).toBe('PLANILHA+TERMO')
    // O início que já está na linha também vale para a conta.
    const r = decidirLinha(base({ atual: { ...vazia, dataInicio: d(2014, 1, 1) }, controle: controle('1.00') }))
    expect(r.vigencia).toBeUndefined()
    expect(r.avisos).toContain('o controle do faturamento dá vigência fora do normal (01/01/2014 a 31/10/2026) — confira')
  })

  it('fim já preenchido nunca é decidido', () => {
    expect(decidirLinha(base({ atual: { ...vazia, dataVencimento: d(2026, 1, 1) }, controle: controle('1.00') })).vigencia).toBeUndefined()
  })
})

describe('assinatura', () => {
  it('termo no controle do faturamento está valendo', () => {
    expect(decidirLinha(base({ controle: controle('1.00') })).assinatura).toEqual({
      dado: 'Assinado (controle do faturamento)',
      origem: 'CONTROLE',
      prova: { mes: '2026-08', arquivoId: 'ab1' },
    })
  })

  it('planilha "contratação concluída"; marcador "Em elaboração" conta como vazio', () => {
    const r = decidirLinha(base({ tipo: 'ADITIVO', atual: { ...vazia, situacao: 'Em elaboração' }, planilha: planilha(null) }))
    expect(r.assinatura).toMatchObject({ dado: 'Assinado (planilha: contratação concluída)', origem: 'PLANILHA' })
  })

  it('não mexe em contrato inicial, em linha com data de assinatura nem em situação preenchida', () => {
    expect(decidirLinha(base({ tipo: 'CONTRATO', controle: controle('1.00') })).assinatura).toBeUndefined()
    expect(decidirLinha(base({ atual: { ...vazia, data: d(2025, 1, 1) }, controle: controle('1.00') })).assinatura).toBeUndefined()
    expect(decidirLinha(base({ atual: { ...vazia, situacao: 'Cancelado (não efetivado)' }, controle: controle('1.00') })).assinatura).toBeUndefined()
  })
})
