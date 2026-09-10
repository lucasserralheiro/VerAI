import {
  carregarPreferenciaFonte,
  salvarPreferenciaFonte,
  pilhaDaFonte,
  PREFERENCIA_PADRAO,
  OPCOES_FONTE,
} from './preferenciaFonteProposta'

const CHAVE_LOCALSTORAGE = 'verai:proposta:preferenciaFonte'

describe('preferenciaFonteProposta', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('sem nada salvo, carrega o padrão institucional (Aptos 12pt)', () => {
    expect(carregarPreferenciaFonte()).toEqual(PREFERENCIA_PADRAO)
  })

  it('salva e recarrega a mesma preferência (roundtrip)', () => {
    salvarPreferenciaFonte({ fonte: 'arial', tamanhoCorpo: 14 })
    expect(carregarPreferenciaFonte()).toEqual({ fonte: 'arial', tamanhoCorpo: 14 })
  })

  it('fonte inválida no localStorage cai pro padrão, mas mantém um tamanho válido', () => {
    window.localStorage.setItem(CHAVE_LOCALSTORAGE, JSON.stringify({ fonte: 'fonte-que-nao-existe', tamanhoCorpo: 16 }))
    expect(carregarPreferenciaFonte()).toEqual({ fonte: PREFERENCIA_PADRAO.fonte, tamanhoCorpo: 16 })
  })

  it('tamanho inválido no localStorage cai pro padrão, mas mantém uma fonte válida', () => {
    window.localStorage.setItem(CHAVE_LOCALSTORAGE, JSON.stringify({ fonte: 'verdana', tamanhoCorpo: 999 }))
    expect(carregarPreferenciaFonte()).toEqual({ fonte: 'verdana', tamanhoCorpo: PREFERENCIA_PADRAO.tamanhoCorpo })
  })

  it('JSON corrompido no localStorage não lança exceção e cai pro padrão', () => {
    window.localStorage.setItem(CHAVE_LOCALSTORAGE, '{isso nao e json valido')
    expect(() => carregarPreferenciaFonte()).not.toThrow()
    expect(carregarPreferenciaFonte()).toEqual(PREFERENCIA_PADRAO)
  })

  it('salvarPreferenciaFonte não lança mesmo se localStorage.setItem falhar (ex.: modo privado/quota)', () => {
    const setItemOriginal = window.localStorage.setItem
    window.localStorage.setItem = () => {
      throw new Error('quota estourada')
    }
    expect(() => salvarPreferenciaFonte({ fonte: 'arial', tamanhoCorpo: 12 })).not.toThrow()
    window.localStorage.setItem = setItemOriginal
  })

  it('pilhaDaFonte devolve a pilha CSS completa de uma fonte conhecida', () => {
    expect(pilhaDaFonte('arial').toLowerCase()).toContain('arial')
  })

  it('pilhaDaFonte de um valor desconhecido cai pra pilha padrão (Aptos)', () => {
    expect(pilhaDaFonte('fonte-inexistente')).toBe(OPCOES_FONTE[0].pilha)
  })
})
