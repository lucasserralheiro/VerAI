import { agruparTermos, chaveDoTermo, resolverLinhas, type LinhaConhecida, type PastaDeTermo } from './identidade'

const pasta = (p: Partial<PastaDeTermo> & Pick<PastaDeTermo, 'pasta'>): PastaDeTermo => ({ tipo: 'ADITIVO', numero: null, arquivos: [`${p.pasta}/x.pdf`], hashes: [], ...p })
const linha = (l: Partial<LinhaConhecida> & Pick<LinhaConhecida, 'id'>): LinhaConhecida => ({ tipo: 'ADITIVO', numero: null, caminhos: [], pastaAntiga: null, hashes: [], ...l })
const resolver = (pastas: PastaDeTermo[], linhas: LinhaConhecida[]) => resolverLinhas(agruparTermos(pastas).grupos, linhas)

describe('chaveDoTermo', () => {
  it('contrato inicial é único; aditivo pelo número tolerante; sem número ou XX não tem chave', () => {
    expect(chaveDoTermo('CONTRATO', null)).toBe('CONTRATO')
    expect(chaveDoTermo('ADITIVO', 'TA 01')).toBe(chaveDoTermo('PRORROGACAO', 'TA 001'))
    expect(chaveDoTermo('ADITIVO', 'TA XX')).toBeNull()
    expect(chaveDoTermo('RESCISAO', null)).toBeNull()
  })
})

describe('agruparTermos', () => {
  it('mesma pasta em dois lugares com o mesmo PDF é um termo só (SMIT TC 52)', () => {
    const { grupos, avisos } = agruparTermos([
      pasta({ pasta: 'SMIT/Contratos Finalizados/TC 12/2) TA XX/1) TC 52 - Contrato Inicial', tipo: 'CONTRATO', hashes: ['h52'] }),
      pasta({ pasta: 'SMIT/TC 52/1) TC 52 - Contrato inicial', tipo: 'CONTRATO', hashes: ['h52', 'hpc'] }),
    ])
    expect(grupos).toHaveLength(1)
    expect(avisos).toEqual([])
  })
  it('mesmo número sem arquivo em comum: separados e com aviso (SMDHC com dois "TA 001")', () => {
    const { grupos, avisos } = agruparTermos([
      pasta({ pasta: 'SMDHC/TC 1/2) TA 001 - Transf titularidade', numero: 'TA 001', hashes: ['a'] }),
      pasta({ pasta: 'SMDHC/TC 1/5) TA 001 - Reajuste', numero: 'TA 001', hashes: ['b'] }),
    ])
    expect(grupos).toHaveLength(2)
    expect(avisos).toHaveLength(1)
  })
})

describe('resolverLinhas', () => {
  it('passo 2: mesmo caminho de arquivo já ligado à linha', () => {
    expect(resolver([pasta({ pasta: 'P/TA 01', numero: 'TA 01', arquivos: ['P/TA 01/novo.pdf', 'P/TA 01/a.pdf'] })], [linha({ id: 'L1', numero: 'TA 01', caminhos: ['P/TA 01/a.pdf'] })])).toEqual(['L1'])
  })
  it('passo 2: pasta gravada na chave antiga do importador', () => {
    expect(resolver([pasta({ pasta: 'P/3) TA XX - Redução', numero: 'TA XX' })], [linha({ id: 'L1', numero: 'TA XX', pastaAntiga: 'P/3) TA XX - Redução' })])).toEqual(['L1'])
  })
  it('passo 3: contrato movido para "Contratos Finalizados" — casa por tipo e número', () => {
    const r = resolver(
      [
        pasta({ pasta: 'X/Contratos Finalizados/TC 1/1) Inicial', tipo: 'CONTRATO' }),
        pasta({ pasta: 'X/Contratos Finalizados/TC 1/2) TA 01 - 12m', tipo: 'PRORROGACAO', numero: 'TA 01' }),
      ],
      [linha({ id: 'LC', tipo: 'CONTRATO' }), linha({ id: 'L1', tipo: 'ADITIVO', numero: 'TA 1' })]
    )
    expect(r).toEqual(['LC', 'L1'])
  })
  it('passo 4: "TA XX" renomeada para "TA 03" — casa pelo conteúdo', () => {
    expect(resolver([pasta({ pasta: 'P/4) TA 03 - Redução', numero: 'TA 03', hashes: ['h'] })], [linha({ id: 'LX', numero: 'TA XX', hashes: ['h'] })])).toEqual(['LX'])
  })
  it('PA repetido em TA 02 e TA 03: o número vem antes do conteúdo, TA 03 vira linha nova', () => {
    const r = resolver(
      [
        pasta({ pasta: 'P/3) TA 02', numero: 'TA 02', arquivos: ['P/3) TA 02/PA.pdf'], hashes: ['pa'] }),
        pasta({ pasta: 'P/4) TA 03', numero: 'TA 03', arquivos: ['P/4) TA 03/PA.pdf'], hashes: ['pa'] }),
      ],
      [linha({ id: 'L2', numero: 'TA 02', caminhos: ['P/3) TA 02/PA.pdf'], hashes: ['pa'] })]
    )
    expect(r).toEqual(['L2', null])
  })
  it('número que casa com duas linhas livres não resolve (fica nova — nunca chuta)', () => {
    expect(resolver([pasta({ pasta: 'P/TA 01', numero: 'TA 01' })], [linha({ id: 'A', numero: 'TA 01' }), linha({ id: 'B', numero: 'TA 1' })])).toEqual([null])
  })
  it('prospecção nunca é reivindicada', () => {
    expect(resolver([pasta({ pasta: 'P/TA 01', numero: 'TA 01' })], [linha({ id: 'P', tipo: 'PROSPECCAO', numero: 'TA 01' })])).toEqual([null])
  })
})
