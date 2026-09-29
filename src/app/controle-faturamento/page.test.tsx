import { fireEvent, render, screen, within } from '@testing-library/react'
import ControleFaturamentoPage from './page'

const base = {
  mes: '2026-08',
  clienteId: 'c1',
  termoTexto: 'T.A. 02',
  vigenciaTexto: '15/10/2025 à 14/10/2026',
  vigenciaInicio: null,
  vigenciaFim: null,
  saldoDocumento: null,
  ultimoFaturado: 'AGO/2026',
  avisos: [],
}
const controles = [
  {
    ...base,
    arquivoId: 'a1',
    sigla: 'CGM',
    clienteNome: 'Controladoria',
    contratoTexto: 'CO 16/CGM/2024',
    contratoId: 'k1',
    previsto: '1000',
    faturado: '830',
    saldoCalculado: '170',
    percentual: 83,
    conferido: true,
  },
  {
    ...base,
    arquivoId: 'a2',
    sigla: 'SF',
    clienteNome: 'Fazenda',
    contratoTexto: 'CO 42/2024',
    contratoId: 'k2',
    previsto: '100',
    faturado: '120',
    saldoCalculado: '-20',
    percentual: 120,
    conferido: true,
  },
  {
    ...base,
    arquivoId: 'a3',
    sigla: 'XYZ',
    clienteNome: null,
    clienteId: null,
    contratoTexto: 'CO 9/2024',
    contratoId: null,
    previsto: null,
    faturado: null,
    saldoCalculado: null,
    percentual: null,
    conferido: false,
  },
]

beforeEach(() => {
  global.fetch = jest.fn((url: RequestInfo | URL) =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve(String(url).startsWith('/api/controle-faturamento') ? { meses: ['2026-08', '2026-07'], mes: '2026-08', controles } : { atualizadoEm: null }),
    })
  ) as jest.Mock
})

it('resumo, tabela com %, faturado acima do previsto e não conferido', async () => {
  render(<ControleFaturamentoPage />)
  expect(await screen.findByText('CO 16/CGM/2024')).toBeInTheDocument()
  expect(screen.getByText('3 contratos')).toBeInTheDocument()
  expect(screen.getByText('R$ 1.100,00')).toBeInTheDocument() // previsto dos conferidos
  expect(screen.getByText('83,0%')).toBeInTheDocument()
  expect(screen.getByText('120,0%')).toHaveClass('text-orange-dark')
  const linhaXyz = screen.getByText('CO 9/2024').closest('tr')!
  expect(within(linhaXyz).getByText(/não conferida/i)).toBeInTheDocument()
  expect(within(linhaXyz).getByText(/sem contrato no VerAI/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'CO 16/CGM/2024' })).toHaveAttribute('href', '/clientes/c1/contratos/k1')
})

it('troca o mês e busca', async () => {
  render(<ControleFaturamentoPage />)
  await screen.findByText('CO 16/CGM/2024')
  fireEvent.change(screen.getByRole('searchbox', { name: /buscar/i }), { target: { value: 'fazenda' } })
  expect(screen.queryByText('CO 16/CGM/2024')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText(/mês do controle/i), { target: { value: '2026-07' } })
  expect(global.fetch).toHaveBeenLastCalledWith('/api/controle-faturamento?mes=2026-07')
})

it('sem controle lido: explica', async () => {
  ;(global.fetch as jest.Mock).mockImplementation(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ meses: [], mes: null, controles: [] }) }))
  render(<ControleFaturamentoPage />)
  expect(await screen.findByText(/Nenhum controle lido ainda/)).toBeInTheDocument()
})
