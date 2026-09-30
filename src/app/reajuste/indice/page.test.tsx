import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TabelaDoIndicePage from './page'

const MESES = [
  ['2025-08', '0.04'], ['2025-09', '0.65'], ['2025-10', '0.27'], ['2025-11', '0.2'], ['2025-12', '0.32'],
  ['2026-01', '0.21'], ['2026-02', '0.25'], ['2026-03', '0.59'], ['2026-04', '0.4'], ['2026-05', '0.45'],
  ['2026-06', '0.18'], ['2026-07', '-0.03'], ['2026-08', '0.01'],
].map(([mes, variacao]) => ({ mes, variacao }))

beforeEach(() => {
  global.fetch = jest.fn((_url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ novos: 1, confirmados: 12, divergentes: [{ mes: '2026-07', gravado: '-0.04', fonte: '-0.03' }] }),
      })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ meses: MESES, atualizadoEm: '2026-09-30T12:00:00.000Z' }) })
  }) as unknown as typeof fetch
})

it('mostra o mais recente em cima com o acumulado de 12 meses', async () => {
  render(<TabelaDoIndicePage />)
  await screen.findByText('ago/2026')
  const linhas = screen.getAllByRole('row')
  expect(linhas[1]).toHaveTextContent('ago/2026')
  expect(linhas[1]).toHaveTextContent('0,01')
  expect(linhas[1]).toHaveTextContent('3,55') // acumulado set/2025–ago/2026
  expect(linhas.at(-1)).toHaveTextContent('—') // ago/2025 não tem 12 meses anteriores
})

it('"Atualizar agora" mostra o resultado e as divergências', async () => {
  render(<TabelaDoIndicePage />)
  fireEvent.click(await screen.findByRole('button', { name: 'Atualizar agora' }))
  await waitFor(() => expect(screen.getByText(/1 mês novo/)).toBeInTheDocument())
  expect(screen.getByText(/jul\/2026: gravado/)).toBeInTheDocument()
})
