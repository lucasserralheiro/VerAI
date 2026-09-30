import { render, screen } from '@testing-library/react'
import HistoricoReajustePage from './page'

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 'r1',
            nomeArquivo: 'itens.xlsx',
            tipoArquivo: 'xlsx',
            mesInicial: '2025-09',
            mesFinal: '2026-08',
            acumuladoPct: '3.55',
            fator: '1.035543',
            quantidadeValores: 12,
            usuario: 'Fulano',
            createdAt: '2026-09-30T15:00:00.000Z',
          },
        ]),
    })
  ) as unknown as typeof fetch
})

it('lista cada reajuste com período, acumulado e os dois downloads', async () => {
  render(<HistoricoReajustePage />)
  expect(await screen.findByText('itens.xlsx')).toBeInTheDocument()
  expect(screen.getByText('set/2025 a ago/2026')).toBeInTheDocument()
  expect(screen.getByText('3,55 %')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Original' })).toHaveAttribute('href', '/api/reajuste/r1/arquivo/original')
  expect(screen.getByRole('link', { name: 'Resultado' })).toHaveAttribute('href', '/api/reajuste/r1/arquivo/resultado')
})

it('lista vazia avisa', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
  render(<HistoricoReajustePage />)
  expect(await screen.findByText(/Nenhum reajuste ainda/)).toBeInTheDocument()
})
