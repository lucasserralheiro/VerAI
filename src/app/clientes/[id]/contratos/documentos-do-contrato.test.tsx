import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DocumentosDoContrato } from './documentos-do-contrato'

const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const k1 = { id: 'k1', numeroTermo: 'TC 012/2020' }
const base = {
  clienteId: 'c1',
  contentType: 'application/pdf',
  tamanhoBytes: 1000,
  sha256: 'x',
  origem: 'sharepoint',
  createdAt: '2026-09-25T00:00:00Z',
  enviadoPor: null,
  extensao: 'pdf',
}
const PC = {
  ...base,
  id: 'a1',
  categoria: 'PROPOSTA_COMERCIAL',
  nome: 'PC-COVISA.pdf',
  usos: [{ tipo: 'historico-contrato', rotulo: 'Contrato TC 012/2020 · PC/PA de Contrato', href: 'h', contrato: k1, competencia: null, coluna: 'proposta' }],
}
const PA = {
  ...base,
  id: 'a2',
  categoria: 'PROPOSTA_ADITIVO',
  nome: 'PA-COVISA-TA01.pdf',
  usos: [
    { tipo: 'historico-contrato', rotulo: 'Contrato TC 012/2020 · PC/PA de TA 01', href: 'h', contrato: k1, competencia: null, coluna: 'proposta' },
    { tipo: 'conversao-markdown', rotulo: 'Conversão em Markdown', href: '/propostas-comerciais/p9', contrato: null, competencia: null },
  ],
}
const TC = {
  ...base,
  id: 'a3',
  categoria: 'TERMO_CONTRATO',
  nome: 'TC-COVISA.pdf',
  usos: [{ tipo: 'historico-contrato', rotulo: 'Contrato TC 012/2020 · TC/TA de Contrato', href: 'h', contrato: k1, competencia: null, coluna: 'termo' }],
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = jest.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.close = jest.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
})

beforeEach(() => {
  push.mockReset()
  global.fetch = jest.fn(async (url: string) =>
    url === '/api/clientes/c1/arquivos'
      ? ({ ok: true, json: async () => ({ arquivos: [PC, PA, TC] }) } as Response)
      : ({ ok: true, json: async () => ({ id: 'p1' }) } as Response)
  ) as jest.Mock
})

const abrir = (coluna: 'proposta' | 'termo' = 'proposta') =>
  render(<DocumentosDoContrato clienteId="c1" contrato={k1} coluna={coluna} aoFechar={jest.fn()} />)

it('lista só as PC/PA do contrato, cada uma com o PDF', async () => {
  abrir()

  expect(await screen.findByText('PC-COVISA.pdf')).toBeInTheDocument()
  expect(screen.getByText('PA-COVISA-TA01.pdf')).toBeInTheDocument()
  expect(screen.queryByText('TC-COVISA.pdf')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Abrir PDF PC-COVISA.pdf' })).toHaveAttribute('href', '/api/arquivos/a1?modo=inline')
})

it('converter a escolhida manda o arquivo guardado para a conversão e abre o resultado', async () => {
  abrir()

  fireEvent.click(await screen.findByRole('button', { name: 'Converter PC-COVISA.pdf em Markdown' }))

  await waitFor(() => expect(push).toHaveBeenCalledWith('/propostas-comerciais/p1'))
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/propostas-comerciais',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ arquivosCliente: ['a1'] }) })
  )
})

it('já convertida: abre a conversão existente em vez de converter de novo', async () => {
  abrir()

  expect(await screen.findByRole('link', { name: 'Abrir PA-COVISA-TA01.pdf em Markdown' })).toHaveAttribute('href', '/propostas-comerciais/p9')
  expect(screen.queryByRole('button', { name: 'Converter PA-COVISA-TA01.pdf em Markdown' })).not.toBeInTheDocument()
})

it('contrato sem PC/PA diz isso', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ arquivos: [TC] }) })
  abrir()

  expect(await screen.findByText(/nenhuma PC\/PA/i)).toBeInTheDocument()
})

it('TC/TA: lista só os termos do contrato, com o título do TC/TA', async () => {
  abrir('termo')

  expect(await screen.findByText('TC-COVISA.pdf')).toBeInTheDocument()
  expect(screen.queryByText('PC-COVISA.pdf')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'TC/TA do TC 012/2020' })).toBeInTheDocument()
  expect(screen.getByText(/TC\/TA de Contrato/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Abrir PDF TC-COVISA.pdf' })).toHaveAttribute('href', '/api/arquivos/a3?modo=inline')
  expect(screen.getByRole('button', { name: 'Converter TC-COVISA.pdf em Markdown' })).toBeInTheDocument()
})

it('contrato sem TC/TA diz isso', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ arquivos: [PC] }) })
  abrir('termo')

  expect(await screen.findByText(/nenhum TC\/TA/i)).toBeInTheDocument()
})
