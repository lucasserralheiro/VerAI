import { act, renderHook } from '@testing-library/react'

// `ai` real (Task 10) fala HTTP de verdade via `DefaultChatTransport`; aqui o que importa é o
// fluxo de estado do hook (POST de criação, guarda de envio em voo), não o parsing do stream.
// Stub simples: `sendMessages` devolve algo, `readUIMessageStream` gera uma mensagem final de
// assistente já pronta.
jest.mock('ai', () => ({
  DefaultChatTransport: jest.fn().mockImplementation(() => ({
    sendMessages: jest.fn().mockResolvedValue('stream-fake'),
  })),
  readUIMessageStream: jest.fn(async function* () {
    yield { id: 'm1', role: 'assistant', parts: [{ type: 'text', text: 'ok' }] }
  }),
}))

import { useConversaAssistente } from './use-conversa-assistente'

beforeEach(() => {
  jest.clearAllMocks()
})

it('primeiro POST falha → erro; "tentar de novo" refaz o POST e segue sem duplicar a bolha do usuário', async () => {
  let chamadasConversas = 0
  global.fetch = jest.fn(async (url: string) => {
    if (String(url) === '/api/assistente/conversas') {
      chamadasConversas++
      if (chamadasConversas === 1) return new Response('deu ruim', { status: 500 })
      return new Response(JSON.stringify({ id: 'c1' }), { status: 200 })
    }
    return new Response('{}', { status: 200 })
  }) as jest.Mock

  const { result } = renderHook(() => useConversaAssistente())

  await act(async () => {
    await result.current.enviar('oi', '')
  })

  expect(result.current.estado).toBe('erro')
  expect(result.current.conversaId).toBeNull()
  expect(result.current.mensagens.filter((m) => m.papel === 'usuario')).toHaveLength(1)

  await act(async () => {
    await result.current.tentarDeNovo('')
  })

  expect(chamadasConversas).toBe(2)
  expect(result.current.conversaId).toBe('c1')
  expect(result.current.estado).toBe('pronto')
  expect(result.current.mensagens.filter((m) => m.papel === 'usuario')).toHaveLength(1)
})

it('chamar enviar duas vezes antes do POST resolver dispara só um POST', async () => {
  const fetchMock = jest.fn(async (url: string) => {
    if (String(url) === '/api/assistente/conversas') {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return new Response(JSON.stringify({ id: 'c1' }), { status: 200 })
    }
    return new Response('{}', { status: 200 })
  })
  global.fetch = fetchMock as jest.Mock

  const { result } = renderHook(() => useConversaAssistente())

  await act(async () => {
    const p1 = result.current.enviar('oi', '')
    const p2 = result.current.enviar('oi', '')
    await Promise.all([p1, p2])
  })

  const chamadasConversas = fetchMock.mock.calls.filter(([url]) => String(url) === '/api/assistente/conversas')
  expect(chamadasConversas).toHaveLength(1)
  expect(result.current.mensagens.filter((m) => m.papel === 'usuario')).toHaveLength(1)
})
