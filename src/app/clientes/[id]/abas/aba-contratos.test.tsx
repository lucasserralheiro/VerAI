import { fireEvent, render, screen, within } from '@testing-library/react'
import { AbaContratos } from './aba-contratos'
import { PermissaoContext } from '../permissao-cliente'
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

function contrato(parcial: Record<string, unknown>) {
  return {
    id: 'k1',
    clienteId: 'c1',
    numeroTermo: 'TC 105/2025/SI',
    descricao: 'Data Center',
    seiCliente: '6018.2025/0126067-0',
    seiProdam: null,
    situacao: 'Ativo',
    dataInicio: null,
    dataVencimento: '2026-11-30T00:00:00.000Z',
    vigente: true,
    linkSei: null,
    saldo: { valorItens: '81031443.62', faturado: '50239495.04', saldo: '30791948.58', percentualFaturado: '62.00' },
    vencimento: { nivel: 'critico', dias: 12 },
    ...parcial,
  }
}

function resposta(ok: boolean, corpo: unknown) {
  return Promise.resolve({ ok, json: () => Promise.resolve(corpo) }) as unknown as Promise<Response>
}

function mockApi(options: { lista?: unknown[]; erroLista?: boolean; erroPost?: string } = {}) {
  let lista = [...(options.lista ?? [contrato({})])]
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    const metodo = init?.method ?? 'GET'
    if (u === '/api/clientes/c1/contratos' && metodo === 'GET') {
      return options.erroLista ? resposta(false, { error: 'acesso negado' }) : resposta(true, lista)
    }
    if (u === '/api/clientes/c1/contratos' && metodo === 'POST') {
      if (options.erroPost) return resposta(false, { error: options.erroPost })
      const novo = contrato({
        id: 'k2',
        ...JSON.parse(String(init?.body)),
        dataVencimento: null,
        saldo: { valorItens: '0', faturado: '0', saldo: null, percentualFaturado: null },
        vencimento: { nivel: 'sem-data', dias: null },
      })
      lista = [...lista, novo]
      return resposta(true, novo)
    }
    return resposta(false, { error: `rota inesperada ${metodo} ${u}` })
  }) as jest.Mock
}

describe('AbaContratos', () => {
  it('lista os contratos com semáforo de vencimento, valor atual do contrato e % faturado', async () => {
    mockApi({
      lista: [
        contrato({
          resumoHistorico: {
            aditivos: 0,
            prorrogacoes: 0,
            valorAtual: { valor: '81031443.62', tipo: 'CONTRATO', data: '2025-11-30T00:00:00.000Z' },
            proposta: null,
            termo: null,
          },
        }),
      ],
    })
    render(<AbaContratos clienteId="c1" />)
    const link = await screen.findByRole('link', { name: 'TC 105/2025/SI' })
    expect(link).toHaveAttribute('href', '/clientes/c1/contratos/k1')
    const linha = link.closest('tr')!
    expect(within(linha).getByText('Data Center')).toBeInTheDocument()
    expect(within(linha).getByText('vence em 12d')).toBeInTheDocument()
    expect(within(linha).getByText('até 30/11/2026')).toBeInTheDocument()
    // Valor = o do último termo do histórico, com a origem embaixo.
    expect(within(linha).getByText('R$ 81.031.443,62')).toBeInTheDocument()
    expect(within(linha).getByText('Contrato de 30/11/2025')).toBeInTheDocument()
    expect(within(linha).getByText('62% faturado')).toBeInTheDocument()
  })

  it('PC/PA e TC/TA abrem a mesma janela de escolha, cada uma com os seus documentos (não o PDF direto)', async () => {
    HTMLDialogElement.prototype.showModal = jest.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    })
    const anexo = { url: '/api/arquivos/x?modo=inline', nome: 'x.pdf', referencia: 'TA 01' }
    mockApi({
      lista: [
        contrato({
          resumoHistorico: { aditivos: 1, prorrogacoes: 0, valorAtual: null, proposta: anexo, termo: anexo },
        }),
      ],
    })
    render(<AbaContratos clienteId="c1" />)

    const botaoTermo = await screen.findByRole('button', { name: 'TC/TA do TC 105/2025/SI' })
    expect(screen.getByRole('button', { name: 'PC/PA do TC 105/2025/SI' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Abrir PDF/ })).not.toBeInTheDocument()

    fireEvent.click(botaoTermo)
    expect(await screen.findByRole('heading', { name: 'TC/TA do TC 105/2025/SI' })).toBeInTheDocument()
  })

  it('contrato sem termo nem proposta mostra só o traço nas duas colunas', async () => {
    mockApi({
      lista: [contrato({ resumoHistorico: { aditivos: 0, prorrogacoes: 0, valorAtual: null, proposta: null, termo: null } })],
    })
    render(<AbaContratos clienteId="c1" />)

    await screen.findByRole('link', { name: 'TC 105/2025/SI' })
    expect(screen.queryByRole('button', { name: /(PC\/PA|TC\/TA) do/ })).not.toBeInTheDocument()
  })

  it('mostra cada nível do semáforo e "sem valor" quando o contrato não tem base', async () => {
    mockApi({
      lista: [
        contrato({ id: 'a', numeroTermo: 'A', vencimento: { nivel: 'vencido', dias: -3 } }),
        contrato({ id: 'b', numeroTermo: 'B', vencimento: { nivel: 'ok', dias: 200 } }),
        contrato({
          id: 'c',
          numeroTermo: 'C',
          vencimento: { nivel: 'sem-data', dias: null },
          saldo: { valorItens: '0', faturado: '10', saldo: null, percentualFaturado: null },
        }),
      ],
    })
    render(<AbaContratos clienteId="c1" />)
    expect(await screen.findByText('vencido há 3d')).toBeInTheDocument()
    expect(screen.getByText('vigente')).toBeInTheDocument()
    const linhaC = screen.getByRole('link', { name: 'C' }).closest('tr')!
    expect(within(linhaC).getByText('sem data')).toBeInTheDocument()
    expect(within(linhaC).getByText('sem valor')).toBeInTheDocument()
  })

  it('mostra erro quando a lista não carrega', async () => {
    mockApi({ erroLista: true })
    render(<AbaContratos clienteId="c1" />)
    expect(await screen.findByText('acesso negado')).toBeInTheDocument()
  })

  it('cadastra um contrato novo', async () => {
    mockApi({ lista: [] })
    render(<AbaContratos clienteId="c1" />)
    fireEvent.click(await screen.findByRole('button', { name: /Novo contrato/ }))
    fireEvent.change(screen.getByLabelText('Nº do termo'), { target: { value: 'TC 010/2026' } })
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Wi-fi' } })
    fireEvent.change(screen.getByLabelText('Vencimento'), { target: { value: '2027-01-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('link', { name: 'TC 010/2026' })).toBeInTheDocument()
    const post = (global.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1].body)).toEqual(
      expect.objectContaining({ numeroTermo: 'TC 010/2026', descricao: 'Wi-fi', dataVencimento: '2027-01-31' })
    )
  })

  it('mostra a mensagem da API quando o cadastro falha', async () => {
    mockApi({ lista: [], erroPost: 'Nº do termo: campo obrigatório' })
    render(<AbaContratos clienteId="c1" />)
    fireEvent.click(await screen.findByRole('button', { name: /Novo contrato/ }))
    fireEvent.change(screen.getByLabelText('Nº do termo'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Nº do termo: campo obrigatório')).toBeInTheDocument()
  })
})

describe('AbaContratos somente leitura', () => {
  it('sem permissão de edição não mostra "Novo contrato" e a linha não abre o editor', async () => {
    mockApi()
    render(
      <PermissaoContext.Provider value={{ carregando: false, podeEditar: false, gerencia: null }}>
        <AbaContratos clienteId="c1" />
      </PermissaoContext.Provider>,
    )
    expect(await screen.findByText('TC 105/2025/SI')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Novo contrato/ })).toBeNull()
    fireEvent.click(screen.getByText('Data Center'))
    expect(screen.queryByText('Excluir contrato')).toBeNull()
  })
})
