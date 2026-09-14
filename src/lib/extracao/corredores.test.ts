import { corredoresDoBloco } from './corredores'

describe('corredoresDoBloco', () => {
  it('acha um corredor que atravessa todas as linhas', () => {
    const linhas = [
      { itens: [{ x: 0, width: 40 }, { x: 100, width: 40 }] },
      { itens: [{ x: 0, width: 30 }, { x: 100, width: 30 }] },
    ]

    const corredores = corredoresDoBloco(linhas, 18)

    expect(corredores).toEqual([{ inicio: 40, fim: 100 }])
  })

  it('não acha corredor quando os vãos caem em X diferente a cada linha (parágrafo justificado)', () => {
    const linhas = [
      { itens: [{ x: 0, width: 12 }, { x: 40, width: 80 }] },
      { itens: [{ x: 0, width: 60 }, { x: 95, width: 10 }, { x: 125, width: 55 }] },
    ]

    expect(corredoresDoBloco(linhas, 18)).toEqual([])
  })

  it('exige confirmação em pelo menos 2 linhas — corredor que só aparece numa linha não conta', () => {
    const linhas = [
      { itens: [{ x: 0, width: 40 }, { x: 100, width: 40 }] },
      { itens: [{ x: 0, width: 140 }] },
    ]

    expect(corredoresDoBloco(linhas, 18)).toEqual([])
  })
})
