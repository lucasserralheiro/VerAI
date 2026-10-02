import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import AdminGerenciasPage from './page'

const gerencias = [
  { id: 'g1', nome: 'Gerência X', sigla: 'GX', ativa: true, clientes: 3, managers: ['Ana'] },
]
const soltos = [
  { id: 'c1', nome: 'Alfa', siglaLegado: 'ALF' },
  { id: 'c2', nome: 'Beta', siglaLegado: null },
]

function mockFetch() {
  const chamadas: { url: string; init?: RequestInit }[] = []
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    chamadas.push({ url, init })
    let corpo: unknown = {}
    if (url === '/api/admin/gerencias' && !init?.method) corpo = { gerencias, semGerencia: 46 }
    else if (url === '/api/admin/gerencias/sem-gerencia') corpo = soltos
    return { ok: true, status: 200, json: async () => corpo } as Response
  }) as unknown as typeof fetch
  return chamadas
}

describe('AdminGerenciasPage', () => {
  it('mostra o cartao de clientes sem gerencia', async () => {
    mockFetch()
    render(<AdminGerenciasPage />)
    expect(await screen.findByText('Clientes sem gerência (46)')).toBeInTheDocument()
  })

  it('cria gerencia com POST e recarrega', async () => {
    const chamadas = mockFetch()
    render(<AdminGerenciasPage />)
    await screen.findByText('Gerência X')
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Gerência Nova' } })
    fireEvent.click(screen.getByRole('button', { name: /Criar gerência/ }))
    await waitFor(() => {
      const post = chamadas.find((c) => c.init?.method === 'POST')
      expect(post?.url).toBe('/api/admin/gerencias')
      expect(JSON.parse(String(post?.init?.body))).toMatchObject({ nome: 'Gerência Nova' })
    })
    await waitFor(() => expect(chamadas.filter((c) => c.url === '/api/admin/gerencias' && !c.init?.method).length).toBe(2))
  })

  it('move dois clientes soltos para a gerencia escolhida', async () => {
    const chamadas = mockFetch()
    render(<AdminGerenciasPage />)
    fireEvent.click(await screen.findByText('Clientes sem gerência (46)'))
    fireEvent.click(await screen.findByLabelText('Selecionar Alfa'))
    fireEvent.click(screen.getByLabelText('Selecionar Beta'))
    fireEvent.change(screen.getByLabelText('Mover para'), { target: { value: 'g1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mover' }))
    await waitFor(() => {
      const post = chamadas.find((c) => c.url === '/api/admin/gerencias/carteira')
      expect(JSON.parse(String(post?.init?.body))).toEqual({ clienteIds: ['c1', 'c2'], gerenciaId: 'g1' })
    })
  })
})
