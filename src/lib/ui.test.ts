import { BTN_PRIMARY, BTN_OUTLINE, BTN_OUTLINE_SM, INPUT_BASE } from './ui'

describe('tokens de botão e input', () => {
  it('BTN_PRIMARY usa raio modesto, peso médio e nenhuma sombra', () => {
    expect(BTN_PRIMARY).toContain('rounded-xl')
    expect(BTN_PRIMARY).toContain('font-medium')
    expect(BTN_PRIMARY).not.toContain('font-semibold')
    expect(BTN_PRIMARY).not.toContain('shadow-xs')
  })

  it('BTN_OUTLINE usa raio modesto e nenhuma sombra', () => {
    expect(BTN_OUTLINE).toContain('rounded-xl')
    expect(BTN_OUTLINE).not.toContain('shadow-xs')
  })

  it('BTN_OUTLINE_SM usa raio modesto e nenhuma sombra', () => {
    expect(BTN_OUTLINE_SM).toContain('rounded-xl')
    expect(BTN_OUTLINE_SM).not.toContain('shadow-xs')
  })

  it('INPUT_BASE usa o mesmo raio modesto dos botões', () => {
    expect(INPUT_BASE).toContain('rounded-xl')
  })
})
