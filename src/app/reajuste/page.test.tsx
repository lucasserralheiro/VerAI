import { render, screen, fireEvent, waitFor } from '@testing-library/react'
jest.mock('@/lib/envio-r2-navegador', () => ({
  enviarParaR2: jest.fn().mockResolvedValue('r2:tmp-uploads/0b8f4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b.pdf'),
}))
import ReajustePage from './page'

const MESES = [
  ['2025-09', '0.65'], ['2025-10', '0.27'], ['2025-11', '0.2'], ['2025-12', '0.32'], ['2026-01', '0.21'], ['2026-02', '0.25'],
  ['2026-03', '0.59'], ['2026-04', '0.4'], ['2026-05', '0.45'], ['2026-06', '0.18'], ['2026-07', '-0.03'], ['2026-08', '0.01'],
].map(([mes, variacao]) => ({ mes, variacao }))

const chamadas: Array<[string, unknown]> = []
beforeEach(() => {
  chamadas.length = 0
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    chamadas.push([String(url), init?.body ? JSON.parse(String(init.body)) : null])
    if (url === '/api/reajuste/indice') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ meses: MESES, atualizadoEm: null }) })
    }
    if (url === '/api/reajuste/leitura') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            tipo: 'texto',
            valores: [
              { indice: 0, pagina: 1, original: '10000.00', bruto: 'R$ 10.000,00', antes: 'valor mensal de', depois: 'por mês' },
              { indice: 1, pagina: 2, original: '50.00', bruto: '50,00', antes: 'multa de', depois: 'por dia' },
            ],
          }),
      })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'r1' }) })
  }) as unknown as typeof fetch
})

it('sugere os últimos 12 meses publicados com o acumulado', async () => {
  render(<ReajustePage />)
  expect(await screen.findByText(/3,55\s?%/)).toBeInTheDocument()
  expect(screen.getByText(/set\/2025 a ago\/2026/)).toBeInTheDocument()
})

it('envia PDF, mostra os valores com o corrigido, desmarca um e gera com o período escolhido', async () => {
  render(<ReajustePage />)
  await screen.findByText(/3,55\s?%/)
  const arquivo = new File(['%PDF'], 'proposta.pdf', { type: 'application/pdf' })
  fireEvent.change(screen.getByLabelText('Arquivo'), { target: { files: [arquivo] } })
  expect(await screen.findByText('R$ 10.000,00')).toBeInTheDocument()
  expect(screen.getByText('10.355,43')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('checkbox', { name: '50,00' }))
  fireEvent.change(screen.getByLabelText('Mês inicial'), { target: { value: '2026-07' } })
  fireEvent.click(screen.getByRole('button', { name: 'Gerar planilha' }))
  await waitFor(() => expect(chamadas.some(([u]) => u === '/api/reajuste')).toBe(true))
  const [, corpo] = chamadas.find(([u]) => u === '/api/reajuste')!
  expect(corpo).toEqual({
    endereco: 'r2:tmp-uploads/0b8f4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b.pdf',
    nomeArquivo: 'proposta.pdf',
    inicial: '2026-07',
    final: '2026-08',
    valores: [0],
  })
  expect(await screen.findByRole('link', { name: /Baixar resultado/ })).toHaveAttribute('href', '/api/reajuste/r1/arquivo/resultado')
})
