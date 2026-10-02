import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import { DetalheGerencia } from './detalhe-gerencia'

const base = {
  id: 'g1', nome: 'Gerência X', sigla: 'GX', ativa: true, clientes: 1, managers: ['Ana'],
  carteira: [{ id: 'c1', nome: 'SMIT', siglaLegado: 'SMIT' }],
  membros: [{ usuarioId: 'u1', nome: 'Ana', email: 'ana@x.com', papel: 'manager' }],
  movimentos: [{ id: 'm1', cliente: 'SMIT', de: 'Gerência Y', para: 'Gerência X', por: 'Lucas', em: '2026-10-02T15:00:00.000Z' }],
}

function mockFetch(extra: Record<string, unknown> = {}, rotas: Record<string, unknown> = {}) {
  const chamadas: { url: string; init?: RequestInit }[] = []
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    chamadas.push({ url, init })
    const corpo = url in rotas ? rotas[url] : url === '/api/gerencias/g1' ? { ...base, podeGerirEquipe: true, podeNomearManager: true, ...extra } : []
    return { ok: true, status: 200, json: async () => corpo } as Response
  }) as unknown as typeof fetch
  return chamadas
}

describe('DetalheGerencia', () => {
  it('modo admin mostra Adicionar clientes e o papel Manager', async () => {
    mockFetch({}, { '/api/gerencias/g1/candidatos': [{ id: 'u2', nome: 'Beto', email: 'b@x.com' }] })
    render(<DetalheGerencia gerenciaId="g1" modo="admin" />)
    expect(await screen.findByRole('button', { name: /Adicionar clientes/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Adicionar pessoa/ }))
    const seletor = await screen.findByLabelText('Papel')
    expect(within(seletor).getByRole('option', { name: 'Manager' })).toBeInTheDocument()
  })

  it('manager que gere equipe nao ve Adicionar clientes e so oferece Usuario', async () => {
    mockFetch({ podeNomearManager: false }, { '/api/gerencias/g1/candidatos': [{ id: 'u2', nome: 'Beto', email: 'b@x.com' }] })
    render(<DetalheGerencia gerenciaId="g1" modo="manager" />)
    await screen.findByText('Gerência X')
    expect(screen.queryByRole('button', { name: /Adicionar clientes/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Adicionar pessoa/ }))
    const seletor = await screen.findByLabelText('Papel')
    expect(within(seletor).queryByRole('option', { name: 'Manager' })).toBeNull()
    expect(within(seletor).getByRole('option', { name: 'Usuário' })).toBeInTheDocument()
  })

  it('sem permissao de equipe nao mostra botao nenhum', async () => {
    mockFetch({ podeGerirEquipe: false, podeNomearManager: false })
    render(<DetalheGerencia gerenciaId="g1" modo="manager" />)
    await screen.findByText('Gerência X')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('lista os movimentos', async () => {
    mockFetch()
    render(<DetalheGerencia gerenciaId="g1" modo="admin" />)
    expect(await screen.findByText('SMIT · Gerência Y → Gerência X · Lucas · 02/10/2026')).toBeInTheDocument()
  })

  it('tirar da carteira envia gerenciaId null', async () => {
    const chamadas = mockFetch()
    render(<DetalheGerencia gerenciaId="g1" modo="admin" />)
    fireEvent.click(await screen.findByRole('button', { name: /Tirar da carteira/ }))
    await waitFor(() => {
      const c = chamadas.find((x) => x.url === '/api/admin/gerencias/carteira')
      expect(JSON.parse(String(c?.init?.body))).toEqual({ clienteIds: ['c1'], gerenciaId: null })
    })
  })
})
