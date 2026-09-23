import { chaveExata, chaveNumerica } from './vincular-itens'

describe('chaveExata', () => {
  it('ignora caixa, acento, pontuação e zero à esquerda', () => {
    expect(chaveExata('031/SEME/2017')).toBe(chaveExata('31 / seme / 2017'))
    expect(chaveExata('TC 016/2026')).toBe('tc 16 2026')
  })
  it('devolve null pra texto vazio', () => {
    expect(chaveExata('  ')).toBeNull()
    expect(chaveExata(null)).toBeNull()
  })
})

describe('chaveNumerica', () => {
  it('exige número + ano', () => {
    expect(chaveNumerica('TC 016/2026')).toBe('16 2026')
    expect(chaveNumerica('7010202600096354')).toBeNull()
  })
})
