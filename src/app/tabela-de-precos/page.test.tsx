import { fireEvent, render, screen, within } from '@testing-library/react'
import TabelaDePrecosPage from './page'

const tabela = {
  versao: '2026 v3.0',
  publicadaEm: '2026-09-21T00:00:00.000Z',
  totalItens: 3,
  divergencias: 1,
  lidaEm: '2026-09-29T13:00:00.000Z',
  vigente: true,
  arquivos: { planilha: 'ap', pdf: 'at', publicacao: 'apub', informativo: 'ai' },
}
const item = (codigo: string, descricao: string, grupo: string, secoes: string, extra = {}) => ({
  codigo,
  descricao,
  grupo,
  secoes,
  unidade: 'HORA/HOMEM',
  preco: '269',
  sobDemanda: false,
  precoTexto: null,
  conferencia: 'confere',
  precoNoPdf: '269',
  ...extra,
})
const itens = [
  item('10.050.00065.00', 'ANALISTA DE INFORMAÇÃO (COMPLEXIDADE 1)', 'A', 'A - SISTEMAS DE INFORMAÇÃO'),
  item('10.050.00070.00', 'ANALISTA - ADICIONAL DE SOBREAVISO', 'A', 'A - SISTEMAS DE INFORMAÇÃO', { preco: null, sobDemanda: true, precoNoPdf: null }),
  item('11.051.00012.00', 'CONSULTORIA TÉCNICA', 'B', 'B - SERVIÇOS DE REDES E CONECTIVIDADES', { preco: '369.41', precoNoPdf: '370', conferencia: 'diverge' }),
]

beforeEach(() => {
  global.fetch = jest.fn((url: RequestInfo | URL) => {
    const u = String(url)
    const corpo =
      u === '/api/tabela-precos/versoes'
        ? [{ versao: '2026 v3.0', publicadaEm: tabela.publicadaEm, totalItens: 3, vigente: true }]
        : u.startsWith('/api/tabela-precos')
          ? { tabela, itens }
          : { atualizadoEm: null }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(corpo) })
  }) as jest.Mock
  Object.assign(navigator, { clipboard: { writeText: jest.fn(() => Promise.resolve()) } })
})

it('mostra a versão, a publicação no DOC, o aviso do informativo e os serviços', async () => {
  render(<TabelaDePrecosPage />)
  expect(await screen.findByText('2026 v3.0')).toBeInTheDocument()
  expect(screen.getByText(/publicada no DOC em 21\/09\/2026/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /alterações depois da publicação/i })).toHaveAttribute('href', '/api/biblioteca/ai')
  expect(screen.getByRole('link', { name: 'Tabela oficial (PDF)' })).toHaveAttribute('href', '/api/biblioteca/at')
  expect(screen.getByText('R$ 269,00')).toBeInTheDocument()
  expect(screen.getByText('Sob demanda')).toBeInTheDocument()
})

it('busca sem acento e filtro por grupo', async () => {
  render(<TabelaDePrecosPage />)
  await screen.findByText('2026 v3.0')
  fireEvent.change(screen.getByRole('searchbox', { name: /buscar/i }), { target: { value: 'tecnica' } })
  expect(screen.queryByText(/ANALISTA DE/)).not.toBeInTheDocument()
  expect(screen.getByText('TÉCNICA')).toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox', { name: /buscar/i }), { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: /Sistemas de informação/ }))
  expect(screen.queryByText('CONSULTORIA TÉCNICA')).not.toBeInTheDocument()
})

it('preço que diverge do PDF mostra os dois valores', async () => {
  render(<TabelaDePrecosPage />)
  const linha = (await screen.findByText('CONSULTORIA TÉCNICA')).closest('li')!
  expect(within(linha).getByText('R$ 369,41')).toBeInTheDocument()
  expect(within(linha).getByText(/PDF publicado: R\$ 370,00/)).toBeInTheDocument()
})

it('clique no código copia', async () => {
  render(<TabelaDePrecosPage />)
  fireEvent.click(await screen.findByRole('button', { name: /copiar código 10\.050\.00065\.00/i }))
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('10.050.00065.00')
  expect(await screen.findByText('copiado')).toBeInTheDocument()
})

it('sem tabela lida: explica em vez de lista vazia', async () => {
  ;(global.fetch as jest.Mock).mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve(url === '/api/tabela-precos/versoes' ? [] : url.startsWith('/api/tabela-precos') ? { tabela: null, itens: [] } : { atualizadoEm: null }),
    })
  )
  render(<TabelaDePrecosPage />)
  expect(await screen.findByText(/ainda não foi lida da pasta do SharePoint/)).toBeInTheDocument()
})
