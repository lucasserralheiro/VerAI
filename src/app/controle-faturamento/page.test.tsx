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
  avisos: [] as string[],
  aFrente: null as { total: string; periodos: string[] } | null,
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
    faturadoDocumento: '880',
    aFrente: { total: '50.00', periodos: ['set/26'] },
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
    faturadoDocumento: '120',
    avisos: ['vigência com datas trocadas no documento: 18/11/2026 à 17/11/2026'],
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
    faturadoDocumento: null,
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

it('faturado só até o mês do controle: o lançado à frente aparece à parte e fica fora da conta', async () => {
  render(<ControleFaturamentoPage />)
  await screen.findByText('CO 16/CGM/2024')
  expect(screen.getByText('Faturado até ago/2026 (conferidos)')).toBeInTheDocument()
  expect(screen.getByText('R$ 950,00')).toBeInTheDocument() // 830 + 120, sem os 50 à frente
  expect(screen.getByText('+ R$ 50,00 lançados para depois de ago/2026 em 1 contrato(s) — previsão, fora da conta')).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Faturado até ago/2026' })).toBeInTheDocument()
  const linhaCgm = screen.getByText('CO 16/CGM/2024').closest('tr')!
  expect(within(linhaCgm).getByText('+ R$ 50,00 à frente')).toHaveAttribute('title', expect.stringContaining('set/26'))
})

it('aviso do documento aparece na linha do contrato', async () => {
  render(<ControleFaturamentoPage />)
  await screen.findByText('CO 42/2024')
  const linhaSf = screen.getByText('CO 42/2024').closest('tr')!
  expect(within(linhaSf).getByRole('img', { name: /^1 aviso\(s\): vigência com datas trocadas/ })).toBeInTheDocument()
  const linhaCgm = screen.getByText('CO 16/CGM/2024').closest('tr')!
  expect(within(linhaCgm).queryByRole('img', { name: /aviso/ })).not.toBeInTheDocument()
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
