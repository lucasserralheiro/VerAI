import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const hook = {
  conversaId: null as string | null,
  mensagens: [] as { id: string; papel: 'usuario' | 'assistente'; conteudo: string }[],
  estado: 'pronto' as 'pronto' | 'respondendo' | 'erro',
  erro: null as string | null,
  ferramentaAtual: null as string | null,
  enviar: jest.fn(),
  parar: jest.fn(),
  tentarDeNovo: jest.fn(),
  novaConversa: jest.fn(),
  abrirConversa: jest.fn(),
}
jest.mock('./use-conversa-assistente', () => ({ useConversaAssistente: () => hook }))
jest.mock('@/components/relatorios-clientes/sei-link', () => ({ SeiLink: ({ numero }: { numero: string }) => <span>{numero}</span> }))

import { PainelAssistente } from './painel-assistente'

beforeEach(() => {
  jest.clearAllMocks()
  Object.assign(hook, { conversaId: null, mensagens: [], estado: 'pronto', erro: null, ferramentaAtual: null })
  global.fetch = jest.fn(async (url: string) =>
    new Response(JSON.stringify(String(url).startsWith('/api/assistente/contexto') ? { rotulo: 'SMIT › Contrato 031/2023' } : { conversas: [] }))
  ) as jest.Mock
})

it('mostra o chip de contexto da tela e as sugestões; clicar numa sugestão envia com a rota', async () => {
  render(<PainelAssistente rota="/clientes/c1/contratos/k1" onFechar={() => {}} />)
  expect(await screen.findByText('SMIT › Contrato 031/2023')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Qual o saldo deste contrato?' }))
  expect(hook.enviar).toHaveBeenCalledWith('Qual o saldo deste contrato?', '/clientes/c1/contratos/k1')
})

it('remover o chip envia sem a rota', async () => {
  render(<PainelAssistente rota="/clientes/c1" onFechar={() => {}} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Remover contexto' }))
  fireEvent.change(screen.getByPlaceholderText(/Pergunte/), { target: { value: 'oi' } })
  fireEvent.keyDown(screen.getByPlaceholderText(/Pergunte/), { key: 'Enter' })
  expect(hook.enviar).toHaveBeenCalledWith('oi', '')
})

it('Shift+Enter não envia', () => {
  render(<PainelAssistente rota="/confere" onFechar={() => {}} />)
  fireEvent.change(screen.getByPlaceholderText(/Pergunte/), { target: { value: 'oi' } })
  fireEvent.keyDown(screen.getByPlaceholderText(/Pergunte/), { key: 'Enter', shiftKey: true })
  expect(hook.enviar).not.toHaveBeenCalled()
})

it('respondendo: mostra a ferramenta em uso e o botão Parar', () => {
  Object.assign(hook, { estado: 'respondendo', ferramentaAtual: 'resumoDoCliente', mensagens: [{ id: 'p', papel: 'usuario', conteudo: 'oi' }] })
  render(<PainelAssistente rota="/confere" onFechar={() => {}} />)
  expect(screen.getByText('Consultando o cliente…')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Parar' }))
  expect(hook.parar).toHaveBeenCalled()
})

it('erro: mostra a mensagem e "Tentar de novo" (com a rota, quando há contexto)', async () => {
  Object.assign(hook, { estado: 'erro', erro: 'O assistente não respondeu. Tente de novo.' })
  render(<PainelAssistente rota="/clientes/c1" onFechar={() => {}} />)
  await screen.findByText('SMIT › Contrato 031/2023') // espera o chip carregar
  expect(screen.getByText('O assistente não respondeu. Tente de novo.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
  expect(hook.tentarDeNovo).toHaveBeenCalledWith('/clientes/c1')
})

it('lista conversas anteriores e abre uma', async () => {
  ;(global.fetch as jest.Mock).mockImplementation(async (url: string) =>
    new Response(JSON.stringify(String(url).startsWith('/api/assistente/contexto') ? { rotulo: null } : { conversas: [{ id: 'c9', titulo: 'Saldo do SMIT', atualizadaEm: '2026-09-22T10:00:00Z' }] }))
  )
  render(<PainelAssistente rota="/confere" onFechar={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Conversas anteriores' }))
  fireEvent.click(await screen.findByRole('button', { name: /Saldo do SMIT/ }))
  await waitFor(() => expect(hook.abrirConversa).toHaveBeenCalledWith('c9'))
})
