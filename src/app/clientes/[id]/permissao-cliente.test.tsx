import { render, screen, waitFor } from '@testing-library/react'
import { FaixaSomenteLeitura, PermissaoClienteProvider, SeloCarteira, usePermissaoCliente } from './permissao-cliente'

function Estado() {
  const { carregando, podeEditar } = usePermissaoCliente()
  return <p>{`carregando=${carregando} podeEditar=${podeEditar}`}</p>
}

function montar(resposta: unknown) {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => resposta }) as unknown as typeof fetch
  return render(
    <PermissaoClienteProvider clienteId="c1">
      <FaixaSomenteLeitura />
      <SeloCarteira gerencia={null} />
      <Estado />
    </PermissaoClienteProvider>,
  )
}

describe('permissão do cliente', () => {
  it('cliente de uma gerência, sem permissão: faixa e selo', async () => {
    montar({ gerencia: { id: 'g1', nome: 'GCR' }, podeEditar: false })
    expect(await screen.findByText('Somente leitura: este cliente é da GCR.')).toBeInTheDocument()
    expect(screen.getByText('Carteira: GCR')).toBeInTheDocument()
  })

  it('sem gerência e sem permissão', async () => {
    montar({ gerencia: null, podeEditar: false })
    expect(
      await screen.findByText('Somente leitura: cliente sem gerência — só o administrador edita.'),
    ).toBeInTheDocument()
  })

  it('enquanto carrega, podeEditar é false e não há faixa', async () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch
    render(
      <PermissaoClienteProvider clienteId="c1">
        <FaixaSomenteLeitura />
        <Estado />
      </PermissaoClienteProvider>,
    )
    expect(screen.getByText('carregando=true podeEditar=false')).toBeInTheDocument()
    expect(screen.queryByText(/Somente leitura/)).toBeNull()
  })

  it('com permissão: sem faixa', async () => {
    montar({ gerencia: { id: 'g1', nome: 'GCR' }, podeEditar: true })
    await waitFor(() => expect(screen.getByText('carregando=false podeEditar=true')).toBeInTheDocument())
    expect(screen.queryByText(/Somente leitura/)).toBeNull()
  })

  it('sem provider, podeEditar é true', () => {
    render(<Estado />)
    expect(screen.getByText('carregando=false podeEditar=true')).toBeInTheDocument()
  })
})
