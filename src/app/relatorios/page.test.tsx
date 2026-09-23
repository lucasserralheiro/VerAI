import { fireEvent, render, screen, within } from '@testing-library/react'
import RelatoriosPage from './page'

const cliente = { id: 'c1', nome: 'Secretaria da Saúde', siglaLegado: 'SMS' }
const saldo = { valorItens: '1000', faturado: '250', saldo: '750', percentualFaturado: '25.00' }

const respostas: Record<string, unknown> = {
  '/api/relatorios/vencimentos': [
    {
      id: 'k1',
      numeroTermo: 'TC 001/2026',
      descricao: 'Link de dados',
      situacao: 'Ativo',
      dataVencimento: '2026-10-01T03:00:00.000Z',
      ativo: true,
      vencimento: { nivel: 'critico', dias: 8 },
      saldo,
      cliente,
    },
    {
      id: 'k2',
      numeroTermo: 'TC 099/2020',
      descricao: 'Antigo',
      situacao: 'Finalizado',
      dataVencimento: null,
      ativo: false,
      vencimento: { nivel: 'sem-data', dias: null },
      saldo,
      cliente,
    },
  ],
  '/api/relatorios/valor-total': [{ ...cliente, contratos: 2, contratosAtivos: 1, saldo }],
}

beforeEach(() => {
  global.fetch = jest.fn((url: RequestInfo | URL) => {
    const chave = String(url)
    const corpo = chave.startsWith('/api/relatorios/status-faturamento')
      ? [{ id: 'k1', numeroTermo: 'TC 001/2026', descricao: 'Link de dados', cliente, faturamentos: [] }]
      : respostas[chave]
    return Promise.resolve({ ok: true, json: () => Promise.resolve(corpo) })
  }) as jest.Mock
})

describe('RelatoriosPage', () => {
  it('abre em Vencimento mostrando só os contratos ativos, com opção de ver todos', async () => {
    render(<RelatoriosPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Relatórios' })).toBeInTheDocument()
    expect(await screen.findByText('TC 001/2026')).toBeInTheDocument()
    expect(screen.getByText('vence em 8d')).toBeInTheDocument()
    expect(screen.queryByText('TC 099/2020')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Só contratos ativos'))
    expect(screen.getByText('TC 099/2020')).toBeInTheDocument()
  })

  it('aba Valor total mostra saldo por cliente', async () => {
    render(<RelatoriosPage />)
    fireEvent.click(screen.getByRole('tab', { name: /Valor total/ }))
    const painel = await screen.findByRole('tabpanel', { name: 'Valor total por cliente' })
    expect(await within(painel).findByText(/R\$\s750,00/)).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/relatorios/valor-total')
  })

  it('aba Status do faturamento consulta o mês anterior e marca contrato sem faturamento', async () => {
    render(<RelatoriosPage />)
    fireEvent.click(screen.getByRole('tab', { name: /Status do faturamento/ }))
    expect(await screen.findByText('sem faturamento')).toBeInTheDocument()
    expect(screen.getByText('1 de 1 contratos sem faturamento lançado')).toBeInTheDocument()
    const hoje = new Date()
    const [ano, mes] = hoje.getMonth() === 0 ? [hoje.getFullYear() - 1, 12] : [hoje.getFullYear(), hoje.getMonth()]
    expect(global.fetch).toHaveBeenCalledWith(`/api/relatorios/status-faturamento?ano=${ano}&mes=${mes}`)
  })
})
