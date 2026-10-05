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

jest.mock('./anexos/enviar-anexo', () => ({
  ...jest.requireActual('./anexos/enviar-anexo'),
  enviarAnexo: jest.fn(),
}))

import { enviarAnexo } from './anexos/enviar-anexo'
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

describe('anexos', () => {
  const arquivo = (nome: string) => new File(['x'], nome)

  it('sem conversa, o primeiro anexo cria a conversa só para ele e a ficha entra como mensagem do assistente', async () => {
    const fetchMock = jest.fn(async (url: string) => {
      if (String(url) === '/api/assistente/conversas') return new Response(JSON.stringify({ id: 'c1', somenteCriar: true }), { status: 201 })
      return new Response('{}', { status: 200 })
    })
    global.fetch = fetchMock as jest.Mock
    ;(enviarAnexo as jest.Mock).mockResolvedValue({ anexoId: 'a1', texto: '**proposta.pdf** — proposta comercial' })

    const { result } = renderHook(() => useConversaAssistente())
    await act(async () => {
      expect(await result.current.anexar([arquivo('proposta.pdf')], '/clientes/k1')).toBe(true)
    })

    const posts = fetchMock.mock.calls.filter(([url]) => String(url) === '/api/assistente/conversas') as unknown as [string, RequestInit][]
    expect(posts).toHaveLength(1)
    expect(JSON.parse(posts[0][1].body as string)).toEqual({ pergunta: 'proposta.pdf', rota: '/clientes/k1', somenteCriar: true })
    expect((enviarAnexo as jest.Mock).mock.calls[0][1]).toBe('c1')
    expect(result.current.conversaId).toBe('c1')
    expect(result.current.mensagens).toEqual([{ id: 'anexo-a1', papel: 'assistente', conteudo: '**proposta.pdf** — proposta comercial' }])
    expect(result.current.anexos).toEqual([expect.objectContaining({ nome: 'proposta.pdf' })])
    // nenhuma pergunta à IA
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/mensagens'))).toBe(false)
  })

  it('texto longo: anexar e logo depois enviar a pergunta usam a MESMA conversa recém-criada', async () => {
    const fetchMock = jest.fn(async (url: string) => {
      if (String(url) === '/api/assistente/conversas') return new Response(JSON.stringify({ id: 'c1', somenteCriar: true }), { status: 201 })
      return new Response('{}', { status: 200 })
    })
    global.fetch = fetchMock as jest.Mock
    ;(enviarAnexo as jest.Mock).mockResolvedValue({ anexoId: 'a1', texto: 'ficha' })

    const { result } = renderHook(() => useConversaAssistente())
    await act(async () => {
      const ok = await result.current.anexar([arquivo('texto-colado-2026-10-02-1005.txt')], '')
      if (ok) await result.current.enviar('Analise o texto colado.', '')
    })
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === '/api/assistente/conversas')).toHaveLength(1)
    expect(result.current.mensagens.map((m) => m.papel)).toEqual(['assistente', 'usuario', 'assistente'])
  })

  it('com conversa aberta, o anexo vai para ela sem criar outra', async () => {
    const fetchMock = jest.fn(async (url: string) => {
      if (String(url) === '/api/assistente/conversas/c9') return new Response(JSON.stringify({ id: 'c9', titulo: 't', mensagens: [], anexos: [] }))
      return new Response('{}', { status: 200 })
    })
    global.fetch = fetchMock as jest.Mock
    ;(enviarAnexo as jest.Mock).mockResolvedValue({ anexoId: 'a2', texto: 'ficha' })
    const { result } = renderHook(() => useConversaAssistente())
    await act(async () => {
      await result.current.abrirConversa('c9')
    })
    await act(async () => {
      await result.current.anexar([arquivo('b.xlsx')], '')
    })
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/assistente/conversas')).toBe(false)
    expect((enviarAnexo as jest.Mock).mock.calls[0][1]).toBe('c9')
  })

  it('abrir uma conversa mostra os cartões dos anexos já registrados', async () => {
    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'c9', titulo: 't', mensagens: [],
          anexos: [
            { id: 'a1', nome: 'termo.pdf', formato: 'pdf', status: 'ok', paginas: 3, ocr: true, ficha: null },
            { id: 'a2', nome: 'quebrado.docx', formato: 'docx', status: 'erro', paginas: 0, ocr: false, ficha: null },
            { id: 'a3', nome: 'escaneado.pdf', formato: 'pdf', status: 'sem_texto', paginas: 0, ocr: false, ficha: null },
          ],
        })
      )
    ) as jest.Mock
    const { result } = renderHook(() => useConversaAssistente())
    await act(async () => {
      await result.current.abrirConversa('c9')
    })
    expect(result.current.anexos).toEqual([
      { id: 'a1', anexoId: 'a1', nome: 'termo.pdf', etapa: 'pronto' },
      { id: 'a2', anexoId: 'a2', nome: 'quebrado.docx', etapa: 'erro', erro: 'não foi possível ler' },
      { id: 'a3', anexoId: 'a3', nome: 'escaneado.pdf', etapa: 'erro', erro: 'sem texto legível' },
    ])
  })

  it('nova conversa limpa os cartões; criar a conversa falhou → cartão de erro, sem envio', async () => {
    global.fetch = jest.fn(async () => new Response('falhou', { status: 500 })) as jest.Mock
    const { result } = renderHook(() => useConversaAssistente())
    await act(async () => {
      expect(await result.current.anexar([arquivo('a.pdf')], '')).toBe(false)
    })
    expect(enviarAnexo).not.toHaveBeenCalled()
    expect(result.current.anexos).toEqual([expect.objectContaining({ nome: 'a.pdf', etapa: 'erro', erro: 'não foi possível criar a conversa' })])
    act(() => result.current.novaConversa())
    expect(result.current.anexos).toEqual([])
  })

  it('formato inválido ou acima de 50 MB, sem conversa aberta: cartão com erro e NENHUMA conversa criada', async () => {
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ id: 'c1' }), { status: 201 }))
    global.fetch = fetchMock as jest.Mock
    const grande = arquivo('enorme.pdf')
    Object.defineProperty(grande, 'size', { value: 50 * 1024 * 1024 + 1 })
    const { result } = renderHook(() => useConversaAssistente())
    await act(async () => {
      expect(await result.current.anexar([arquivo('foto.png'), grande], '')).toBe(false)
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(enviarAnexo).not.toHaveBeenCalled()
    expect(result.current.conversaId).toBeNull()
    expect(result.current.anexos).toEqual([
      expect.objectContaining({ nome: 'foto.png', etapa: 'erro', erro: 'formato não aceito' }),
      expect.objectContaining({ nome: 'enorme.pdf', etapa: 'erro', erro: 'arquivo acima de 50 MB' }),
    ])
  })

  it('lote misto: o inválido vira cartão de erro e o válido segue (a conversa leva o nome do válido)', async () => {
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ id: 'c1', somenteCriar: true }), { status: 201 }))
    global.fetch = fetchMock as jest.Mock
    ;(enviarAnexo as jest.Mock).mockResolvedValue({ anexoId: 'a1', texto: 'ficha' })
    const { result } = renderHook(() => useConversaAssistente())
    await act(async () => {
      expect(await result.current.anexar([arquivo('foto.png'), arquivo('termo.pdf')], '')).toBe(false)
    })
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).pergunta).toBe('termo.pdf')
    expect((enviarAnexo as jest.Mock).mock.calls.map((c) => (c[0] as File).name)).toEqual(['termo.pdf'])
  })
})
