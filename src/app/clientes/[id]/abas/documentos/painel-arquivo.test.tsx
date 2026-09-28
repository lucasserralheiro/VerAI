import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PainelArquivo } from './painel-arquivo'
import type { ArquivoRepositorio } from './tipos'

const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const arquivo: ArquivoRepositorio = {
  id: 'a1',
  clienteId: 'c1',
  categoria: 'PROPOSTA_COMERCIAL',
  nome: 'PC-SPREGULA.pdf',
  extensao: 'pdf',
  contentType: 'application/pdf',
  tamanhoBytes: 1000,
  sha256: 'x',
  origem: 'sharepoint',
  createdAt: '2026-09-25T00:00:00Z',
  enviadoPor: null,
  usos: [],
}

const painel = (a: ArquivoRepositorio) =>
  render(<PainelArquivo arquivo={a} aoAtualizar={jest.fn()} aoRemover={jest.fn()} aoFechar={jest.fn()} />)

beforeEach(() => {
  push.mockReset()
  global.fetch = jest.fn()
})

it('converte o arquivo guardado pela rota da Proposta Comercial e abre o resultado', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ id: 'p1' }) })
  painel(arquivo)

  fireEvent.click(screen.getByRole('button', { name: /converter em markdown/i }))

  await waitFor(() => expect(push).toHaveBeenCalledWith('/propostas-comerciais/p1'))
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/propostas-comerciais',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ arquivosCliente: ['a1'] }) })
  )
})

it('falha na conversão mostra o erro e não navega', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({ error: 'acesso negado' }) })
  painel(arquivo)

  fireEvent.click(screen.getByRole('button', { name: /converter em markdown/i }))

  expect(await screen.findByText('acesso negado')).toBeInTheDocument()
  expect(push).not.toHaveBeenCalled()
})

it('já convertido: mostra o atalho para a conversão em vez de converter de novo', () => {
  painel({
    ...arquivo,
    usos: [
      { tipo: 'conversao-markdown', rotulo: 'Conversão em Markdown', href: '/propostas-comerciais/p1', contrato: null, competencia: null },
    ],
  })

  expect(screen.getByRole('link', { name: /abrir em markdown/i })).toHaveAttribute('href', '/propostas-comerciais/p1')
  expect(screen.queryByRole('button', { name: /converter em markdown/i })).not.toBeInTheDocument()
})

it('extensão que o conversor não aceita não mostra o botão', () => {
  painel({ ...arquivo, nome: 'foto.png', extensao: 'png' })

  expect(screen.queryByRole('button', { name: /converter em markdown/i })).not.toBeInTheDocument()
})
