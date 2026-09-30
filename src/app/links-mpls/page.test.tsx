import { fireEvent, render, screen, within } from '@testing-library/react'
import LinksMplsPage from './page'

const base = { competencia: '2026-09', avisos: [] as string[], cancelados: 0, entraram: null as number | null, sairam: null as number | null }
const relatorios = [
  { ...base, id: 'r1', arquivoId: 'a1', sigla: 'CGM', clienteId: 'c1', clienteNome: 'Controladoria', contratoId: 'k1', contratoTexto: '16/CGM/2024', categoria: 'SOLUCAO', ativos: 12, conferido: true, entraram: 2, sairam: 1 },
  { ...base, id: 'r2', arquivoId: 'a2', sigla: 'CGM', clienteId: 'c1', clienteNome: 'Controladoria', contratoId: 'k1', contratoTexto: '16/CGM/2024', categoria: 'SOCIAL', ativos: 5, conferido: true, avisos: ['título diz agosto/2026; a pasta é de setembro/2026'] },
  { ...base, id: 'r3', arquivoId: 'a3', sigla: 'SEGES', clienteId: null, clienteNome: null, contratoId: null, contratoTexto: '24/SEGES/2025', categoria: 'SOLUCAO', ativos: null, cancelados: null, conferido: false },
]

beforeEach(() => {
  global.fetch = jest.fn((url: RequestInfo | URL) =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(String(url).startsWith('/api/links-mpls') ? { competencias: ['2026-09', '2026-08'], competencia: '2026-09', relatorios } : { atualizadoEm: null }),
    })
  ) as jest.Mock
})

it('cartões só com os conferidos, variação, aviso na linha e não conferido sem número', async () => {
  render(<LinksMplsPage />)
  expect(await screen.findByText('Links ativos em set/2026')).toBeInTheDocument()
  expect(screen.getByText('17')).toBeInTheDocument()
  expect(screen.getByText('Solução 12 · Social 5')).toBeInTheDocument()
  expect(screen.getByText('1 com leitura não conferida — fora das contas')).toBeInTheDocument()
  const linhaSocial = screen.getAllByText('16/CGM/2024')[1].closest('tr')!
  expect(within(linhaSocial).getByRole('img', { name: /^1 aviso\(s\): título diz agosto/ })).toBeInTheDocument()
  const linhaSeges = screen.getByText('24/SEGES/2025').closest('tr')!
  expect(within(linhaSeges).getByText(/não conferida/)).toBeInTheDocument()
  expect(within(linhaSeges).getByText('sem contrato no VerAI')).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: '16/CGM/2024' })[0]).toHaveAttribute('href', '/links-mpls/contrato/k1?competencia=2026-09')
  expect(screen.getByText('▲2')).toBeInTheDocument()
})

it('filtra por categoria e troca a competência', async () => {
  render(<LinksMplsPage />)
  await screen.findByText('Links ativos em set/2026')
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'SOCIAL' } })
  expect(screen.getAllByText('16/CGM/2024')).toHaveLength(1)
  fireEvent.change(screen.getByLabelText('Competência'), { target: { value: '2026-08' } })
  expect(global.fetch).toHaveBeenLastCalledWith('/api/links-mpls?competencia=2026-08')
})
