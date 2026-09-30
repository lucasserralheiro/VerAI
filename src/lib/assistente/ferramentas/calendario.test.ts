/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/calendario/consultas', () => ({ proximosDoFaturamento: jest.fn(), calendarioDoAno: jest.fn() }))
import { calendarioDoAno, proximosDoFaturamento } from '@/lib/calendario/consultas'
import { calendarioFaturamento } from './calendario'

const ctx = { usuario: { id: 'u', nome: 'U', email: 'u@x', role: 'uploader' as const }, hoje: new Date('2026-09-30T12:00:00Z') }
const rodar = (e: unknown) => calendarioFaturamento.executar(calendarioFaturamento.entrada.parse(e), ctx)

it('sem mês: próximos prazos com tipo em palavras e dias', async () => {
  ;(proximosDoFaturamento as jest.Mock).mockResolvedValue([
    { inicio: '2026-10-05T00:00:00.000Z', fim: '2026-10-05T00:00:00.000Z', tipo: 'ENCERRAMENTO', descricao: 'Encerramento', emDias: 5, emDiasUteis: 3 },
  ])
  expect(await rodar({})).toEqual({
    proximos: [{ tipo: 'Encerramento do faturamento', descricao: 'Encerramento', inicio: '05/10/2026', fim: '05/10/2026', quando: 'em 5 dias', diasUteis: 3 }],
  })
  expect(proximosDoFaturamento).toHaveBeenCalledWith(5, ctx.hoje)
})

it('com mês: datas do mês (inclusive feriado); sem calendário do ano, diz', async () => {
  ;(calendarioDoAno as jest.Mock).mockResolvedValue({
    ano: 2026, calendario: { status: 'ok', avisos: [] },
    datas: [
      { inicio: '2026-11-02T00:00:00.000Z', fim: '2026-11-02T00:00:00.000Z', tipo: 'FERIADO', descricao: 'Finados' },
      { inicio: '2026-11-05T00:00:00.000Z', fim: '2026-11-06T00:00:00.000Z', tipo: 'EMISSAO_NFSE', descricao: 'Emissão' },
      { inicio: '2026-12-01T00:00:00.000Z', fim: '2026-12-01T00:00:00.000Z', tipo: 'ENCERRAMENTO', descricao: 'x' },
    ],
  })
  expect(await rodar({ mes: '2026-11' })).toEqual({
    mes: '11/2026', status: 'ok', avisos: [],
    datas: [
      { tipo: 'Feriado', descricao: 'Finados', inicio: '02/11/2026', fim: '02/11/2026' },
      { tipo: 'Emissão de NFS-e', descricao: 'Emissão', inicio: '05/11/2026', fim: '06/11/2026' },
    ],
  })
  ;(calendarioDoAno as jest.Mock).mockResolvedValue({ ano: 2026, calendario: null, datas: [] })
  expect(await rodar({ mes: '2027-01' })).toEqual({ erro: 'o calendário de faturamento de 2027 ainda não foi lido' })
})
