import { situacaoVencimento } from './vencimento'

const hoje = new Date('2026-09-22T15:30:00.000Z')
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe('situacaoVencimento', () => {
  it('sem data → sem-data', () => {
    expect(situacaoVencimento(null, hoje)).toEqual({ nivel: 'sem-data', dias: null })
  })

  it('já passou → vencido, com dias negativos', () => {
    expect(situacaoVencimento(dia('2026-09-21'), hoje)).toEqual({ nivel: 'vencido', dias: -1 })
  })

  it('vence hoje → crítico com 0 dias (conta por dia de calendário, não por hora)', () => {
    expect(situacaoVencimento(dia('2026-09-22'), hoje)).toEqual({ nivel: 'critico', dias: 0 })
  })

  it('até 30 dias → crítico; até 90 → atenção; depois → ok', () => {
    expect(situacaoVencimento(dia('2026-10-22'), hoje)).toEqual({ nivel: 'critico', dias: 30 })
    expect(situacaoVencimento(dia('2026-10-23'), hoje)).toEqual({ nivel: 'atencao', dias: 31 })
    expect(situacaoVencimento(dia('2026-12-21'), hoje)).toEqual({ nivel: 'atencao', dias: 90 })
    expect(situacaoVencimento(dia('2026-12-22'), hoje)).toEqual({ nivel: 'ok', dias: 91 })
  })

  it('vencimento gravado às 03:00Z (meia-noite de Brasília, vindo do Access) conta como o mesmo dia', () => {
    expect(situacaoVencimento(new Date('2026-09-23T03:00:00.000Z'), hoje)).toEqual({ nivel: 'critico', dias: 1 })
  })
})
