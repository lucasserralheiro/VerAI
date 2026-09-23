import { render, screen } from '@testing-library/react'
import { IndicadoresCliente } from './indicadores-cliente'

function mockFetch(ok: boolean, corpo: unknown) {
  global.fetch = jest.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(corpo) })) as jest.Mock
}

describe('IndicadoresCliente', () => {
  it('mostra os quatro cartões com os valores formatados', async () => {
    mockFetch(true, {
      contratosAtivos: 4,
      vencendoEm30Dias: 1,
      valorContratado: '1234.5',
      faturadoUltimoMes: { ano: 2026, mes: 8, valor: '150.75' },
      demandasAbertas: 5,
      abertasHaMaisDe30Dias: 2,
    })
    render(<IndicadoresCliente clienteId="c1" />)

    expect(await screen.findByText('Contratos ativos')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/clientes/c1/indicadores')
    expect(screen.getByText('1 vencendo em 30 dias')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s1\.234,50/)).toBeInTheDocument()
    expect(screen.getByText(/R\$\s150,75/)).toBeInTheDocument()
    expect(screen.getByText('agosto/2026')).toBeInTheDocument()
    expect(screen.getByText('2 há mais de 30 dias')).toBeInTheDocument()
  })

  it('sem faturamento mostra traço', async () => {
    mockFetch(true, {
      contratosAtivos: 0,
      vencendoEm30Dias: 0,
      valorContratado: '0',
      faturadoUltimoMes: null,
      demandasAbertas: 0,
      abertasHaMaisDe30Dias: 0,
    })
    render(<IndicadoresCliente clienteId="c1" />)
    expect(await screen.findByText('nenhum faturamento')).toBeInTheDocument()
  })

  it('falha na rota não mostra nada', async () => {
    mockFetch(false, { error: 'acesso negado' })
    const { container } = render(<IndicadoresCliente clienteId="c1" />)
    await Promise.resolve()
    expect(container).toBeEmptyDOMElement()
  })
})
