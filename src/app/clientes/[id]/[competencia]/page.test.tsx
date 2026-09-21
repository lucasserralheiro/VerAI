import { act, fireEvent, render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import ClienteCompetenciaPage from './page'

type MockOverrides = {
  documentos?: Array<Record<string, unknown>>
  analisesConsolidadas?: Array<Record<string, unknown>>
  analiseEvolucao?: Record<string, unknown> | null
  analiseMedicao?: Record<string, unknown> | null
}

export function mockFetchCompetencia(overrides: MockOverrides = {}) {
  const documentos = overrides.documentos ?? []
  const analisesConsolidadas = overrides.analisesConsolidadas ?? []
  const analiseEvolucao = overrides.analiseEvolucao ?? null
  const analiseMedicao = overrides.analiseMedicao ?? null

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
    if (u === '/api/clientes/cliente-1/competencias/2026-08/analise-medicao') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(analiseMedicao) }) as unknown as Promise<Response>
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
  it('mostra "Relatórios" como raiz do breadcrumb, antes de Clientes e do cliente', async () => {
    mockFetchCompetencia()
    await renderPagina()
    await screen.findByRole('heading', { name: 'Agosto/2026' })

    expect(screen.getByText('Relatórios')).toBeInTheDocument()
    expect(screen.queryByText('Análise de Documentos')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/clientes')
    expect(screen.getByRole('link', { name: 'Prefeitura X' })).toHaveAttribute('href', '/clientes/cliente-1')
  })

  it('usa o vocabulário "Relatório" nas abas em vez de "Análise"', async () => {
    mockFetchCompetencia({
      documentos: [
        {
          id: 'doc-1',
          nomeArquivo: 'a.xlsx',
          tipo: 'xlsx',
          status: 'concluido',
          createdAt: '2026-08-01T00:00:00Z',
          uploadedById: 'u1',
          uploadedBy: { nome: 'Ana' },
          analise: { id: 'an-1' },
        },
      ],
      analiseEvolucao: {
        id: 'ev-1',
        competenciaAnteriorAno: 2026,
        competenciaAnteriorMes: 7,
        metricasComparadas: [],
        resumo: 'Resumo',
        pontosAtencao: [],
        melhorias: [],
        createdAt: '2026-08-05T00:00:00Z',
      },
    })
    await renderPagina()
    await screen.findByRole('heading', { name: 'Agosto/2026' })

    expect(screen.getByRole('button', { name: /Relatório consolidado/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Relatório de evolução' })).toBeInTheDocument()
    expect(screen.queryByText('Análise consolidada')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Relatório de evolução' }))
    expect(await screen.findByRole('link', { name: /Baixar PDF/ })).toHaveAttribute(
      'href',
      '/api/analises-evolucao/ev-1/relatorio'
    )
  })

  it('usa font-semibold no título (não font-bold)', async () => {
    mockFetchCompetencia()
    await renderPagina()
    const heading = await screen.findByRole('heading', { name: 'Agosto/2026' })
    expect(heading).toHaveClass('font-semibold')
    expect(heading).not.toHaveClass('font-bold')
  })

  it('aba Documentos não mostra mais seleção nem barra de gerar relatório', async () => {
    mockFetchCompetencia({
      documentos: [
        {
          id: 'doc-1',
          nomeArquivo: 'a.xlsx',
          tipo: 'xlsx',
          status: 'concluido',
          createdAt: '2026-08-01T00:00:00Z',
          uploadedById: 'u1',
          uploadedBy: { nome: 'Ana' },
          analise: { id: 'an-1' },
        },
        {
          id: 'doc-2',
          nomeArquivo: 'b.xlsx',
          tipo: 'xlsx',
          status: 'concluido',
          createdAt: '2026-08-02T00:00:00Z',
          uploadedById: 'u1',
          uploadedBy: { nome: 'Ana' },
          analise: { id: 'an-2' },
        },
      ],
    })
    await renderPagina()
    await screen.findByRole('heading', { name: 'Agosto/2026' })

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Gerar relatório consolidado/ })).not.toBeInTheDocument()
  })

  it('aba Relatório Consolidado mostra o seletor de documentos quando não há relatório gerado', async () => {
    mockFetchCompetencia({
      documentos: [
        {
          id: 'doc-1',
          nomeArquivo: 'a.xlsx',
          tipo: 'xlsx',
          status: 'concluido',
          createdAt: '2026-08-01T00:00:00Z',
          uploadedById: 'u1',
          uploadedBy: { nome: 'Ana' },
          analise: { id: 'an-1' },
        },
        {
          id: 'doc-2',
          nomeArquivo: 'b.xlsx',
          tipo: 'xlsx',
          status: 'concluido',
          createdAt: '2026-08-02T00:00:00Z',
          uploadedById: 'u1',
          uploadedBy: { nome: 'Ana' },
          analise: { id: 'an-2' },
        },
      ],
    })
    await renderPagina()
    await screen.findByRole('heading', { name: 'Agosto/2026' })

    fireEvent.click(screen.getByRole('button', { name: /Relatório consolidado/ }))

    expect(await screen.findByText('Marque os documentos que devem bater entre si')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /Gerar relatório consolidado/ })).toBeInTheDocument()
  })

  it('aba Relatório Consolidado mostra o veredito e permite reabrir o seletor quando já existe relatório', async () => {
    mockFetchCompetencia({
      documentos: [
        {
          id: 'doc-1',
          nomeArquivo: 'a.xlsx',
          tipo: 'xlsx',
          status: 'concluido',
          createdAt: '2026-08-01T00:00:00Z',
          uploadedById: 'u1',
          uploadedBy: { nome: 'Ana' },
          analise: { id: 'an-1' },
        },
        {
          id: 'doc-2',
          nomeArquivo: 'b.xlsx',
          tipo: 'xlsx',
          status: 'concluido',
          createdAt: '2026-08-02T00:00:00Z',
          uploadedById: 'u1',
          uploadedBy: { nome: 'Ana' },
          analise: { id: 'an-2' },
        },
      ],
      analisesConsolidadas: [
        {
          id: 'ac-1',
          resumo: 'Os valores batem entre os documentos.',
          metricasComparadas: [
            {
              label: 'Total',
              valores: [{ documentoId: 'doc-1', nomeArquivo: 'a.xlsx', valorExibicao: 'R$ 100' }],
              divergencia: { diferencaPercentual: 0.1 },
            },
          ],
          createdAt: '2026-08-10T00:00:00Z',
          documentos: [{ id: 'doc-1', nomeArquivo: 'a.xlsx' }],
        },
      ],
    })
    await renderPagina()
    await screen.findByRole('heading', { name: 'Agosto/2026' })

    fireEvent.click(screen.getByRole('button', { name: /Relatório consolidado/ }))

    expect(await screen.findByText('1 divergência encontrada')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText(/Baseado em:/))
    expect(await screen.findAllByRole('checkbox')).toHaveLength(2)
  })

  it('aba Medição contratual mostra o formulário de upload quando ainda não há análise', async () => {
    mockFetchCompetencia()
    await renderPagina()
    await screen.findByRole('heading', { name: 'Agosto/2026' })

    fireEvent.click(screen.getByRole('button', { name: /Medição contratual/ }))

    expect(await screen.findByText('Contrato (PDF)')).toBeInTheDocument()
    expect(screen.getByText('Planilha de levantamento (XLSX)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Gerar análise de medição/ })).toBeDisabled()
  })

  it('aba Medição contratual mostra os achados quando a última tentativa foi bloqueada', async () => {
    mockFetchCompetencia({
      analiseMedicao: {
        id: 'm-1',
        status: 'bloqueado',
        mensagemErro: null,
        resultado: null,
        achadosBloqueio: {
          bloqueantes: [{ validacao: 'V-1', severidade: 'BLOQUEIA', mensagem: 'Contratado do contrato diverge da planilha.' }],
          avisos: [],
          confirmaveis: [],
          pode_prosseguir: false,
        },
        caminhoRelatorioDocx: null,
        caminhoRelatorioXlsx: null,
        relatorioGeradoEm: null,
      },
    })
    await renderPagina()
    await screen.findByRole('heading', { name: 'Agosto/2026' })

    fireEvent.click(screen.getByRole('button', { name: /Medição contratual/ }))

    expect(await screen.findByText('Contratado do contrato diverge da planilha.')).toBeInTheDocument()
    expect(screen.getByText(/Bloqueado — precisa resolver/)).toBeInTheDocument()
  })

  it('aba Medição contratual mostra o resumo e os links de download quando concluída', async () => {
    mockFetchCompetencia({
      analiseMedicao: {
        id: 'm-1',
        status: 'concluido',
        mensagemErro: null,
        resultado: { titulo: 'Relatório de Medição — Contrato 123', total_linhas: 40, total_divergencias: 3, avisos: [] },
        achadosBloqueio: null,
        caminhoRelatorioDocx: 'https://blob/relatorio.docx',
        caminhoRelatorioXlsx: 'https://blob/relatorio.xlsx',
        relatorioGeradoEm: '2026-08-15T00:00:00Z',
      },
    })
    await renderPagina()
    await screen.findByRole('heading', { name: 'Agosto/2026' })

    fireEvent.click(screen.getByRole('button', { name: /Medição contratual/ }))

    expect(await screen.findByText('Relatório de Medição — Contrato 123')).toBeInTheDocument()
    expect(screen.getByText('3 divergências')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Baixar Word/ })).toHaveAttribute('href', 'https://blob/relatorio.docx')
    expect(screen.getByRole('link', { name: /Baixar Excel/ })).toHaveAttribute('href', 'https://blob/relatorio.xlsx')
  })
})
