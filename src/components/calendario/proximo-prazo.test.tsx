import { render, screen } from '@testing-library/react'
import { ProximoPrazoFaturamento } from './proximo-prazo'

it('mostra o próximo prazo e leva ao calendário', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ proximos: [{ inicio: '2026-10-08T00:00:00.000Z', fim: '2026-10-08T00:00:00.000Z', tipo: 'ENCERRAMENTO', descricao: 'x', emDias: 9, emDiasUteis: 6 }] }) })
  ) as jest.Mock
  render(<ProximoPrazoFaturamento />)
  const link = await screen.findByRole('link', { name: /Próximo prazo do faturamento: encerramento do faturamento — 08\/10 \(em 9 dias\)/ })
  expect(link).toHaveAttribute('href', '/calendario-faturamento')
})

it('sem prazo lido: não aparece', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ proximos: [] }) })) as jest.Mock
  const { container } = render(<ProximoPrazoFaturamento />)
  await new Promise((r) => setTimeout(r, 0))
  expect(container).toBeEmptyDOMElement()
})
