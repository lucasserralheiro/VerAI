import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AbaDocumentos } from './aba-documentos'

jest.mock('./documentos/envio-arquivos', () => ({ EnvioArquivos: () => null }))

const PROPOSTA = {
  id: 'a1',
  clienteId: 'c1',
  contratoId: 'k1',
  competenciaAno: null,
  competenciaMes: null,
  categoria: 'PROPOSTA_COMERCIAL',
  nome: 'PC_SMS_012.pdf',
  extensao: 'pdf',
  contentType: 'application/pdf',
  tamanhoBytes: 2048,
  sha256: 'a'.repeat(64),
  origem: 'upload',
  createdAt: '2026-09-20T12:00:00.000Z',
  enviadoPor: { nome: 'Ana' },
  contrato: { id: 'k1', numeroTermo: 'TC 012/2020' },
  usos: [],
}
const MEDICAO = {
  ...PROPOSTA,
  id: 'a2',
  contratoId: null,
  contrato: null,
  categoria: 'MEDICAO',
  nome: 'medicao-junho.xlsx',
  extensao: 'xlsx',
  competenciaAno: 2026,
  competenciaMes: 6,
  usos: [{ tipo: 'analise-documento', rotulo: 'Análise por IA · Junho/2026', href: '/clientes/c1/2026-06' }],
}

function resposta(ok: boolean, corpo: unknown) {
  return Promise.resolve({ ok, json: () => Promise.resolve(corpo) }) as unknown as Promise<Response>
}

function mockApi() {
  // Lista mutável: o DELETE tira o arquivo, e o recarregamento da aba já não o devolve.
  let lista = [PROPOSTA, MEDICAO]
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    const metodo = init?.method ?? 'GET'
    if (u === '/api/clientes/c1/arquivos')
      return resposta(true, { arquivos: lista, resumo: { total: lista.length, bytes: lista.length * 2048 } })
    if (u === '/api/clientes/c1/contratos') return resposta(true, [{ id: 'k1', numeroTermo: 'TC 012/2020' }])
    if (u === '/api/arquivos/a1' && metodo === 'DELETE') {
      lista = lista.filter((a) => a.id !== 'a1')
      return resposta(true, { ok: true })
    }
    if (u === '/api/arquivos/a1' && metodo === 'PATCH') return resposta(true, { ...PROPOSTA, categoria: 'TERMO_CONTRATO' })
    return resposta(false, { error: 'inesperado' })
  }) as jest.Mock
}

describe('AbaDocumentos', () => {
  beforeEach(mockApi)

  it('lista os arquivos do cliente com resumo, categoria, contrato e competência', async () => {
    render(<AbaDocumentos clienteId="c1" />)

    expect(await screen.findByText('PC_SMS_012.pdf')).toBeInTheDocument()
    expect(screen.getByText('2 arquivos · 4 KB')).toBeInTheDocument()
    const linha = screen.getByText('medicao-junho.xlsx').closest('tr')!
    expect(within(linha).getByText('Medição')).toBeInTheDocument()
    expect(within(linha).getByText('Junho/2026')).toBeInTheDocument()
    expect(within(screen.getByText('PC_SMS_012.pdf').closest('tr')!).getByText('TC 012/2020')).toBeInTheDocument()
  })

  it('filtra por categoria e por busca de nome', async () => {
    render(<AbaDocumentos clienteId="c1" />)
    await screen.findByText('PC_SMS_012.pdf')

    fireEvent.change(screen.getByLabelText('Filtrar por categoria'), { target: { value: 'MEDICAO' } })
    expect(screen.queryByText('PC_SMS_012.pdf')).not.toBeInTheDocument()
    expect(screen.getByText('medicao-junho.xlsx')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Filtrar por categoria'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Filtrar por competência'), { target: { value: '2026-06' } })
    expect(screen.queryByText('PC_SMS_012.pdf')).not.toBeInTheDocument()
    expect(screen.getByText('medicao-junho.xlsx')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Filtrar por competência'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Buscar por nome'), { target: { value: 'sms' } })
    expect(screen.getByText('PC_SMS_012.pdf')).toBeInTheDocument()
    expect(screen.queryByText('medicao-junho.xlsx')).not.toBeInTheDocument()
  })

  it('painel: pré-visualiza PDF, mostra onde é usado e bloqueia remover arquivo em uso', async () => {
    render(<AbaDocumentos clienteId="c1" />)
    fireEvent.click(await screen.findByText('medicao-junho.xlsx'))

    const painel = screen.getByRole('complementary', { name: 'medicao-junho.xlsx' })
    expect(within(painel).getByRole('link', { name: 'Análise por IA · Junho/2026' })).toHaveAttribute('href', '/clientes/c1/2026-06')
    expect(within(painel).getByRole('button', { name: 'Remover' })).toBeDisabled()
    expect(within(painel).getByRole('link', { name: 'Baixar' })).toHaveAttribute('href', '/api/arquivos/a2')

    fireEvent.click(screen.getByText('PC_SMS_012.pdf'))
    const painelPdf = screen.getByRole('complementary', { name: 'PC_SMS_012.pdf' })
    expect(within(painelPdf).getByTitle('Pré-visualização de PC_SMS_012.pdf')).toHaveAttribute(
      'src',
      '/api/arquivos/a1?modo=inline'
    )
  })

  it('nome do arquivo é um botão focável — abre o painel também por teclado', async () => {
    render(<AbaDocumentos clienteId="c1" />)
    await screen.findByText('PC_SMS_012.pdf')

    const botao = screen.getByRole('button', { name: 'PC_SMS_012.pdf' })
    fireEvent.click(botao)

    expect(screen.getByRole('complementary', { name: 'PC_SMS_012.pdf' })).toBeInTheDocument()
  })

  it('remove arquivo sem uso após confirmação inline', async () => {
    render(<AbaDocumentos clienteId="c1" />)
    fireEvent.click(await screen.findByText('PC_SMS_012.pdf'))
    const painel = screen.getByRole('complementary', { name: 'PC_SMS_012.pdf' })

    fireEvent.click(within(painel).getByRole('button', { name: 'Remover' }))
    fireEvent.click(within(painel).getByRole('button', { name: 'Sim' }))

    await waitFor(() => expect(screen.queryByText('PC_SMS_012.pdf')).not.toBeInTheDocument())
    expect(global.fetch).toHaveBeenCalledWith('/api/arquivos/a1', { method: 'DELETE' })
  })

  it('reclassifica pelo painel', async () => {
    render(<AbaDocumentos clienteId="c1" />)
    fireEvent.click(await screen.findByText('PC_SMS_012.pdf'))
    const painel = screen.getByRole('complementary', { name: 'PC_SMS_012.pdf' })

    fireEvent.change(within(painel).getByLabelText('Categoria'), { target: { value: 'TERMO_CONTRATO' } })
    fireEvent.click(within(painel).getByRole('button', { name: 'Salvar classificação' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/arquivos/a1',
        expect.objectContaining({ method: 'PATCH' })
      )
    )
    const corpo = JSON.parse(((global.fetch as jest.Mock).mock.calls.find(([, i]) => i?.method === 'PATCH')![1] as RequestInit).body as string)
    expect(corpo).toEqual({ categoria: 'TERMO_CONTRATO', contratoId: 'k1', competenciaAno: null, competenciaMes: null })
  })

  it('"Enviar arquivos" abre o envio', async () => {
    render(<AbaDocumentos clienteId="c1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar arquivos' }))
    expect(screen.queryByRole('button', { name: 'Enviar arquivos' })).not.toBeInTheDocument()
  })
})
