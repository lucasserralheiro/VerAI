import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ListaArquivos } from './lista-arquivos'
import type { ArquivoRepositorio } from './tipos'

const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const arquivo: ArquivoRepositorio = {
  id: 'a1',
  clienteId: 'c1',
  categoria: 'PROPOSTA_COMERCIAL',
  nome: 'PC-PGM.pdf',
  extensao: 'pdf',
  contentType: 'application/pdf',
  tamanhoBytes: 1000,
  sha256: 'x',
  origem: 'sharepoint',
  createdAt: '2026-09-25T00:00:00Z',
  enviadoPor: null,
  usos: [],
}

const lista = (arquivos: ArquivoRepositorio[], aoSelecionar = jest.fn()) =>
  render(<ListaArquivos arquivos={arquivos} selecionadoId={null} aoSelecionar={aoSelecionar} />)

beforeEach(() => {
  push.mockReset()
  global.fetch = jest.fn()
})

it('o ícone da linha converte o arquivo direto, sem abrir o painel, e abre o resultado', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ id: 'p1' }) })
  const aoSelecionar = jest.fn()
  lista([arquivo], aoSelecionar)

  fireEvent.click(screen.getByRole('button', { name: 'Converter PC-PGM.pdf em Markdown' }))

  await waitFor(() => expect(push).toHaveBeenCalledWith('/propostas-comerciais/p1'))
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/propostas-comerciais',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ arquivosCliente: ['a1'] }) })
  )
  expect(aoSelecionar).not.toHaveBeenCalled()
})

it('falha na conversão aparece na lista e não navega', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({ error: 'acesso negado' }) })
  lista([arquivo])

  fireEvent.click(screen.getByRole('button', { name: 'Converter PC-PGM.pdf em Markdown' }))

  expect(await screen.findByText('acesso negado')).toBeInTheDocument()
  expect(push).not.toHaveBeenCalled()
})

it('já convertido: o ícone abre a conversão existente', () => {
  lista([
    {
      ...arquivo,
      usos: [{ tipo: 'conversao-markdown', rotulo: 'Conversão em Markdown', href: '/propostas-comerciais/p1', contrato: null, competencia: null }],
    },
  ])

  expect(screen.getByRole('link', { name: 'Abrir PC-PGM.pdf em Markdown' })).toHaveAttribute('href', '/propostas-comerciais/p1')
  expect(screen.queryByRole('button', { name: /converter/i })).not.toBeInTheDocument()
})

it('extensão que o conversor não aceita fica sem ícone', () => {
  lista([{ ...arquivo, nome: 'foto.png', extensao: 'png' }])

  expect(screen.queryByRole('button', { name: /converter/i })).not.toBeInTheDocument()
})
