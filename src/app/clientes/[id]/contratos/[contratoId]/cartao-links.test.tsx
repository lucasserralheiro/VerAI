import { render, screen } from '@testing-library/react'
import { CartaoLinks } from './cartao-links'

const responder = (ok: boolean, corpo: unknown) => {
  global.fetch = jest.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(corpo) })) as jest.Mock
}

it('mostra os ativos do mês mais recente e leva à tela do contrato', async () => {
  responder(true, { competencia: '2026-09', ativos: 12, categorias: ['SOLUCAO', 'SOCIAL'] })
  render(<CartaoLinks contratoId="k1" />)
  expect(await screen.findByText(/12 ativo\(s\) em set\/2026/)).toBeInTheDocument()
  expect(screen.getByText(/Solução, Social/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Ver links e evolução' })).toHaveAttribute('href', '/links-mpls/contrato/k1')
  expect(global.fetch).toHaveBeenCalledWith('/api/links-mpls/contrato/k1?resumo=1')
})

it('sem relatório de links: não aparece', async () => {
  responder(false, { error: 'sem relatório de links' })
  const { container } = render(<CartaoLinks contratoId="k1" />)
  await new Promise((r) => setTimeout(r, 0))
  expect(container).toBeEmptyDOMElement()
})
