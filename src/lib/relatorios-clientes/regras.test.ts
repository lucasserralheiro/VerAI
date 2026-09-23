import { competenciaValida, contratoAtivo, demandaAberta } from './regras'

const hoje = new Date('2026-09-23T15:00:00Z')

describe('contratoAtivo', () => {
  it.each(['Finalizado', 'Encerrado', 'rescindido', 'CANCELADO', 'Contrato encerrado em 2024'])(
    'situação "%s" não é ativa',
    (situacao) => {
      expect(contratoAtivo({ situacao, dataVencimento: new Date('2030-01-01T00:00:00Z') }, hoje)).toBe(false)
    }
  )

  it('vencimento que já passou não é ativo', () => {
    expect(contratoAtivo({ situacao: 'Ativo', dataVencimento: new Date('2026-09-22T03:00:00Z') }, hoje)).toBe(false)
  })

  it('vence hoje ainda é ativo', () => {
    expect(contratoAtivo({ situacao: 'Ativo', dataVencimento: new Date('2026-09-23T03:00:00Z') }, hoje)).toBe(true)
  })

  it('sem situação e sem vencimento conta como ativo (não há evidência de encerramento)', () => {
    expect(contratoAtivo({ situacao: null, dataVencimento: null }, hoje)).toBe(true)
  })
})

describe('demandaAberta', () => {
  it.each(['Concluído', 'concluida', 'Encerrada', 'Cancelado', 'Finalizado'])('"%s" está fechada', (situacao) => {
    expect(demandaAberta(situacao)).toBe(false)
  })

  it.each(['Em andamento', null, ''])('"%s" está aberta', (situacao) => {
    expect(demandaAberta(situacao)).toBe(true)
  })
})

describe('competenciaValida', () => {
  it('aceita ano 2000–2100 e mês 1–12', () => {
    expect(competenciaValida(2026, 9)).toBe(true)
  })

  it.each([
    [26, 3],
    [20252, 1],
    [2025, 88],
    [2025, 0],
    [null, 3],
    [2025, null],
  ])('rejeita %s/%s (lixo do import)', (ano, mes) => {
    expect(competenciaValida(ano, mes)).toBe(false)
  })
})
