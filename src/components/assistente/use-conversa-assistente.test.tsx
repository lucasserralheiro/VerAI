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

it('novaConversa abandona o envio em voo: a resposta atrasada do POST antigo não aparece na conversa nova', async () => {
  let chamadasPost = 0
  const abortouAPrimeira = { valor: false }
  global.fetch = jest.fn((url: string, opts?: RequestInit) => {
    if (String(url) === '/api/assistente/conversas') {
      chamadasPost++
      const numeroDaChamada = chamadasPost
      return new Promise<Response>((resolve, reject) => {
        if (numeroDaChamada === 1) {
          // a primeira nunca resolve sozinha — só quando `novaConversa` (via `parar`) abortar.
          opts?.signal?.addEventListener('abort', () => {
            abortouAPrimeira.valor = true
            reject(Object.assign(new Error('abortado'), { name: 'AbortError' }))
          })
        } else {
          resolve(new Response(JSON.stringify({ id: 'c2' }), { status: 200 }))
        }
      })
    }
    return Promise.resolve(new Response('{}', { status: 200 }))
  }) as jest.Mock

  const { result } = renderHook(() => useConversaAssistente())

  let promessaPrimeiroEnvio!: Promise<void>
  act(() => {
    promessaPrimeiroEnvio = result.current.enviar('primeira', '')
  })
  expect(result.current.estado).toBe('respondendo')

  act(() => {
    result.current.novaConversa()
  })
  expect(result.current.mensagens).toHaveLength(0)
  expect(result.current.estado).toBe('pronto')

  await act(async () => {
    await result.current.enviar('segunda', '')
  })

  expect(chamadasPost).toBe(2)
  expect(result.current.conversaId).toBe('c2')
  expect(result.current.mensagens.filter((m) => m.papel === 'usuario')).toHaveLength(1)
  expect(result.current.mensagens.find((m) => m.papel === 'usuario')?.conteudo).toBe('segunda')
  expect(result.current.mensagens.some((m) => m.conteudo === 'primeira')).toBe(false)

  // a cadeia velha finalmente é rejeitada (abortada) — não pode mudar nada do que já está na tela.
  await act(async () => {
    await promessaPrimeiroEnvio
  })
  expect(abortouAPrimeira.valor).toBe(true)
  expect(result.current.conversaId).toBe('c2')
  expect(result.current.estado).toBe('pronto')
  expect(result.current.mensagens.filter((m) => m.papel === 'usuario')).toHaveLength(1)
})

it('POST de criação rejeita (erro de rede) → erro com mensagem padrão; tentar de novo funciona depois', async () => {
  let chamadas = 0
  global.fetch = jest.fn(async (url: string) => {
    if (String(url) === '/api/assistente/conversas') {
      chamadas++
      if (chamadas === 1) throw new Error('rede caiu')
      return new Response(JSON.stringify({ id: 'c1' }), { status: 200 })
    }
    return new Response('{}', { status: 200 })
  }) as jest.Mock

  const { result } = renderHook(() => useConversaAssistente())

  await act(async () => {
    await result.current.enviar('oi', '')
  })

  expect(result.current.estado).toBe('erro')
  expect(result.current.erro).toBe('O assistente não respondeu. Tente de novo.')
  expect(result.current.conversaId).toBeNull()

  await act(async () => {
    await result.current.tentarDeNovo('')
  })

  expect(chamadas).toBe(2)
  expect(result.current.conversaId).toBe('c1')
  expect(result.current.estado).toBe('pronto')
  expect(result.current.mensagens.filter((m) => m.papel === 'usuario')).toHaveLength(1)
})

it('parar() durante o POST de criação aborta e volta pra "pronto"', async () => {
  global.fetch = jest.fn((url: string, opts?: RequestInit) => {
    if (String(url) === '/api/assistente/conversas') {
      return new Promise<Response>((_resolve, reject) => {
        opts?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('abortado'), { name: 'AbortError' })))
      })
    }
    return Promise.resolve(new Response('{}', { status: 200 }))
  }) as jest.Mock

  const { result } = renderHook(() => useConversaAssistente())

  let promessa!: Promise<void>
  act(() => {
    promessa = result.current.enviar('oi', '')
  })
  expect(result.current.estado).toBe('respondendo')

  await act(async () => {
    result.current.parar()
    await promessa
  })

  expect(result.current.estado).toBe('pronto')
  expect(result.current.conversaId).toBeNull()
})
