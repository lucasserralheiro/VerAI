import { act, render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import ClienteCompetenciaPage from './page'

type MockOverrides = {
  documentos?: Array<Record<string, unknown>>
  analisesConsolidadas?: Array<Record<string, unknown>>
  analiseEvolucao?: Record<string, unknown> | null
}

export function mockFetchCompetencia(overrides: MockOverrides = {}) {
  const documentos = overrides.documentos ?? []
  const analisesConsolidadas = overrides.analisesConsolidadas ?? []
  const analiseEvolucao = overrides.analiseEvolucao ?? null

  global.fetch = jest.fn((url: RequestInfo | URL) => {
    const u = String(url)
    if (u === '/api/clientes/cliente-1') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'cliente-1', nome: 'Prefeitura X' }),
      }) as unknown as Promise<Response>
    }
    if (u.startsWith('/api/documentos?clienteId=cliente-1')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(documentos) }) as unknown as Promise<Response>
    }
    if (u === '/api/clientes/cliente-1/competencias/2026-08/analise-consolidada') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(analisesConsolidadas),
      }) as unknown as Promise<Response>
    }
    if (u === '/api/clientes/cliente-1/competencias/2026-08/analise-evolucao') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(analiseEvolucao) }) as unknown as Promise<Response>
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
        <ClienteCompetenciaPage params={Promise.resolve({ id: 'cliente-1', competencia: '2026-08' })} />
      </Suspense>
    )
  })
}

describe('ClienteCompetenciaPage', () => {
  it('mostra "Análise de Documentos" como raiz do breadcrumb, antes de Clientes e do cliente', async () => {
    mockFetchCompetencia()
    await renderPagina()
    await screen.findByRole('heading', { name: 'Agosto/2026' })

    expect(screen.getByText('Análise de Documentos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/clientes')
    expect(screen.getByRole('link', { name: 'Prefeitura X' })).toHaveAttribute('href', '/clientes/cliente-1')
  })
})
