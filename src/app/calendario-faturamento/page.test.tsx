import { act, fireEvent, render, screen, within } from '@testing-library/react'
import CalendarioFaturamentoPage from './page'

const d = (inicio: string, tipo: string, descricao = tipo, fim = inicio) => ({ inicio: `${inicio}T00:00:00.000Z`, fim: `${fim}T00:00:00.000Z`, tipo, descricao })
const calendario = (status: 'ok' | 'so-feriados') => ({
  anos: [2026],
  ano: 2026,
  anoAtualSemCalendario: false,
  calendario: { status, avisos: ['janeiro/2027: a grade do PDF está errada'], arquivoId: 'cal1', lidoEm: '2026-09-30T12:00:00Z' },
  datas:
    status === 'ok'
      ? [d('2026-10-01', 'EMISSAO_NFSE', 'Período', '2026-10-02'), d('2026-10-08', 'ENCERRAMENTO'), d('2026-10-12', 'FERIADO', 'Nossa Senhora Aparecida')]
      : [d('2026-10-12', 'FERIADO', 'Nossa Senhora Aparecida')],
})

function responder(status: 'ok' | 'so-feriados') {
  global.fetch = jest.fn((url: RequestInfo | URL) => {
    const u = String(url)
    const corpo = u.startsWith('/api/calendario-faturamento/proximos')
      ? { proximos: status === 'ok' ? [{ ...d('2026-10-08', 'ENCERRAMENTO'), emDias: 2, emDiasUteis: 2 }] : [] }
      : u.startsWith('/api/calendario-faturamento')
        ? calendario(status)
        : { atualizadoEm: null }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(corpo) })
  }) as jest.Mock
}

beforeAll(() => {
  jest.useFakeTimers({ now: new Date('2026-10-06T15:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask'] })
})
afterAll(() => jest.useRealTimers())

it('próximos prazos, mês com marcadores e feriado, lista do ano, aviso e PDF', async () => {
  responder('ok')
  await act(async () => render(<CalendarioFaturamentoPage />))
  const proximos = await screen.findByRole('region', { name: 'Próximos prazos' })
  expect(within(proximos).getByText('Encerramento do faturamento')).toBeInTheDocument()
  expect(within(proximos).getByText('em 2 dias')).toHaveClass('text-orange-dark')
  const mes = screen.getByRole('region', { name: 'Mês de outubro' })
  expect(within(mes).getByRole('button', { name: '12 de outubro: Nossa Senhora Aparecida' })).toBeInTheDocument()
  fireEvent.click(within(mes).getByRole('button', { name: '8 de outubro: Encerramento do faturamento' }))
  expect(within(mes).getAllByText('Encerramento do faturamento').length).toBeGreaterThan(0)
  expect(screen.getByText('janeiro/2027: a grade do PDF está errada')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Calendário oficial/ })).toHaveAttribute('href', '/api/biblioteca/cal1')
  const ano = screen.getByRole('region', { name: 'Prazos do ano' })
  expect(within(ano).getByText('01/10/2026 a 02/10/2026')).toBeInTheDocument()
})

it('sem prova: avisa e mostra só os feriados', async () => {
  responder('so-feriados')
  await act(async () => render(<CalendarioFaturamentoPage />))
  expect(await screen.findByText(/não puderam ser lidos com segurança/)).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Próximos prazos' })).not.toBeInTheDocument()
})
