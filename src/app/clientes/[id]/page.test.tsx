import { act, render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import ClienteDetalhePage from './page'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

export function mockFetch() {
  global.fetch = jest.fn((url: RequestInfo | URL) => {
    const u = String(url)
    if (u === '/api/clientes/cliente-1') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'cliente-1', nome: 'Prefeitura X' }),
      }) as unknown as Promise<Response>
    }
    if (u === '/api/documentos?clienteId=cliente-1') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) }) as unknown as Promise<Response>
    }
    if (u === '/api/auth/me') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'u1', role: 'usuario' }),
      }) as unknown as Promise<Response>
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(null) }) as unknown as Promise<Response>
  }) as jest.Mock
}

// A página usa `use(params)`, que suspende no primeiro render. Envolve num
// Suspense boundary local e espera dentro de `act` pra deixar o ciclo de
// suspensão/retomada do React terminar antes do teste seguir em frente.
export async function renderPagina() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <ClienteDetalhePage params={Promise.resolve({ id: 'cliente-1' })} />
      </Suspense>
    )
  })
}

describe('ClienteDetalhePage', () => {
  beforeEach(() => {
    mockFetch()
  })

  it('mostra "Análise de Documentos" como raiz do breadcrumb, antes de Clientes', async () => {
    await renderPagina()
    await screen.findByRole('heading', { name: 'Prefeitura X' })

    expect(screen.getByText('Análise de Documentos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/clientes')
  })
})
