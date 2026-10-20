/** @jest-environment node */

describe('chamarConfere', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    jest.restoreAllMocks()
    process.env = { ...OLD_ENV, CONFERE_SERVICE_URL: 'https://confere.exemplo', CONFERE_SHARED_SECRET: 'segredo-de-teste' }
  })

  afterAll(() => {
    process.env = OLD_ENV
  })

  function mockFetch(status: number, corpo: unknown) {
    return jest.spyOn(global, 'fetch').mockResolvedValue({
      status,
      json: async () => corpo,
    } as Response)
  }

  it('envia multipart com os arquivos, identidade_confirmada e o header do segredo', async () => {
    const { chamarConfere } = await import('./cliente')
    const fetchMock = mockFetch(200, {
      titulo: 't',
      docx_base64: 'ZG9jeA==',
      analise_xlsx_base64: 'eGxzeA==',
    })

    await chamarConfere({
      contrato: { nome: 'contrato.pdf', bytes: Buffer.from('c') },
      levantamento: { nome: 'levantamento.xlsx', bytes: Buffer.from('l') },
      aditivos: [{ nome: 'aditivo1.pdf', bytes: Buffer.from('a') }],
      identidadeConfirmada: true,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://confere.exemplo/reports')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>)['X-Confere-Secret']).toBe('segredo-de-teste')
    const body = init?.body as FormData
    expect(body.get('contrato')).toBeInstanceOf(Blob)
    expect(body.get('levantamento')).toBeInstanceOf(Blob)
    expect(body.getAll('aditivos').length).toBe(1)
    expect(body.get('identidade_confirmada')).toBe('true')
  })

  it('sucesso (200): devolve tipo "concluido" com o corpo da resposta', async () => {
    const { chamarConfere } = await import('./cliente')
    mockFetch(200, {
      titulo: 'Relatório X',
      docx_base64: 'ZG9jeA==',
      analise_xlsx_base64: 'eGxzeA==',
    })

    const resultado = await chamarConfere({
      contrato: { nome: 'c.pdf', bytes: Buffer.from('c') },
      levantamento: { nome: 'l.xlsx', bytes: Buffer.from('l') },
      aditivos: [],
      identidadeConfirmada: false,
    })

    expect(resultado.tipo).toBe('concluido')
    if (resultado.tipo === 'concluido') {
      expect(resultado.resposta.titulo).toBe('Relatório X')
    }
  })

  it('bloqueado (422 com "bloqueantes"): devolve tipo "bloqueado"', async () => {
    const { chamarConfere } = await import('./cliente')
    mockFetch(422, {
      detalhe: 'processamento bloqueado por validação',
      bloqueantes: [{ validacao: 'V-1', severidade: 'BLOQUEIA', mensagem: 'erro' }],
      avisos: [],
      confirmaveis: [],
      pode_prosseguir: false,
    })

    const resultado = await chamarConfere({
      contrato: { nome: 'c.pdf', bytes: Buffer.from('c') },
      levantamento: { nome: 'l.xlsx', bytes: Buffer.from('l') },
      aditivos: [],
      identidadeConfirmada: false,
    })

    expect(resultado.tipo).toBe('bloqueado')
    if (resultado.tipo === 'bloqueado') {
      expect(resultado.resposta.bloqueantes).toHaveLength(1)
    }
  })

  it('422 sem "bloqueantes" (falha de extração) vira tipo "erro", não "bloqueado"', async () => {
    const { chamarConfere } = await import('./cliente')
    mockFetch(422, { detail: 'PDF corrompido' })

    const resultado = await chamarConfere({
      contrato: { nome: 'c.pdf', bytes: Buffer.from('c') },
      levantamento: { nome: 'l.xlsx', bytes: Buffer.from('l') },
      aditivos: [],
      identidadeConfirmada: false,
    })

    expect(resultado.tipo).toBe('erro')
    if (resultado.tipo === 'erro') {
      expect(resultado.mensagem).toBe('PDF corrompido')
    }
  })

  it('401 (segredo incorreto) vira tipo "erro" com mensagem clara', async () => {
    const { chamarConfere } = await import('./cliente')
    mockFetch(401, { detail: 'não autorizado' })

    const resultado = await chamarConfere({
      contrato: { nome: 'c.pdf', bytes: Buffer.from('c') },
      levantamento: { nome: 'l.xlsx', bytes: Buffer.from('l') },
      aditivos: [],
      identidadeConfirmada: false,
    })

    expect(resultado.tipo).toBe('erro')
    if (resultado.tipo === 'erro') {
      expect(resultado.mensagem).toBe('não autorizado')
    }
  })

  it('falha de rede (fetch rejeita) vira tipo "erro" com a mensagem de indisponibilidade', async () => {
    const { chamarConfere, MENSAGEM_CONFERE_INDISPONIVEL } = await import('./cliente')
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('fetch failed'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const resultado = await chamarConfere({
      contrato: { nome: 'c.pdf', bytes: Buffer.from('c') },
      levantamento: { nome: 'l.xlsx', bytes: Buffer.from('l') },
      aditivos: [],
      identidadeConfirmada: false,
    })

    expect(resultado).toEqual({ tipo: 'erro', mensagem: MENSAGEM_CONFERE_INDISPONIVEL })
  })

  // 19/10/2026 — o Render matou a instância por falta de memória no meio da
  // geração; a resposta foi a página de erro do provedor, sem JSON, e a tela
  // mostrava "Confere respondeu 502 sem uma mensagem reconhecível".
  it.each([429, 502, 503, 504])('%i sem corpo JSON vira a mensagem de indisponibilidade', async (status) => {
    const { chamarConfere, MENSAGEM_CONFERE_INDISPONIVEL } = await import('./cliente')
    jest.spyOn(global, 'fetch').mockResolvedValue({
      status,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    } as unknown as Response)

    const resultado = await chamarConfere(PARAMETROS)

    expect(resultado).toEqual({ tipo: 'erro', mensagem: MENSAGEM_CONFERE_INDISPONIVEL })
  })

  it('503 com "detail" do próprio Confere mantém a mensagem dele', async () => {
    const { chamarConfere } = await import('./cliente')
    mockFetch(503, { detail: 'A geração foi interrompida porque os documentos exigiram mais memória' })

    const resultado = await chamarConfere(PARAMETROS)

    expect(resultado).toEqual({
      tipo: 'erro',
      mensagem: 'A geração foi interrompida porque os documentos exigiram mais memória',
    })
  })

  const PARAMETROS = {
    contrato: { nome: 'c.pdf', bytes: Buffer.from('c') },
    levantamento: { nome: 'l.xlsx', bytes: Buffer.from('l') },
    aditivos: [],
    identidadeConfirmada: false,
  }

  // Quebra que pega: `fetch` sem limite de espera. Foi o 504 de 24/09/2026 — a
  // chamada ficava pendurada até a Vercel matar a função, e a tela recebia o
  // erro cru da plataforma em vez de uma resposta do VerAI.
  it('desiste e devolve "tempo-esgotado" quando o Confere não responde dentro do tempo limite', async () => {
    const { chamarConfere } = await import('./cliente')
    // Dublê fiel ao fetch de verdade: só termina quando o sinal aborta, e
    // rejeita com o motivo dele (o `TimeoutError` de `AbortSignal.timeout`).
    jest.spyOn(global, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          const sinal = init?.signal
          if (!sinal) return reject(new Error('chamada sem signal: nada limita a espera'))
          sinal.addEventListener('abort', () => reject(sinal.reason))
        })
    )

    const resultado = await chamarConfere(PARAMETROS, { tempoLimiteMs: 20 })

    expect(resultado).toEqual({ tipo: 'tempo-esgotado' })
  })

  // Quebra que pega: 200 com corpo ilegível (conexão cortada no meio dos ~5 MB)
  // passando como "concluido" com `resposta: null`. A tela leria
  // `relatorio.docx_base64` de null, a promessa rejeitaria sem ninguém tratar e
  // o modal de progresso ficaria aberto para sempre.
  it('200 com o corpo cortado no meio vira "erro", não "concluido"', async () => {
    const { chamarConfere } = await import('./cliente')
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{"titulo":"LEVANTAMENTO - COMPRO', { status: 200 }))

    const resultado = await chamarConfere(PARAMETROS)

    expect(resultado.tipo).toBe('erro')
  })

  it('lança erro claro quando CONFERE_SERVICE_URL não está configurado', async () => {
    process.env.CONFERE_SERVICE_URL = ''
    const { chamarConfere } = await import('./cliente')

    await expect(
      chamarConfere({
        contrato: { nome: 'c.pdf', bytes: Buffer.from('c') },
        levantamento: { nome: 'l.xlsx', bytes: Buffer.from('l') },
        aditivos: [],
        identidadeConfirmada: false,
      })
    ).rejects.toThrow(/CONFERE_SERVICE_URL/)
  })

  // 20/10/2026 — geração assíncrona (`/jobs`).
  describe('jobs', () => {
    it('iniciarNoConfere: 202 com id vira "iniciado"; Confere sem /jobs vira "sem-suporte"', async () => {
      const { iniciarNoConfere } = await import('./cliente')
      const espiao = mockFetch(202, { id: 'job-1', situacao: 'na_fila', posicao: 0 })
      await expect(iniciarNoConfere(PARAMETROS)).resolves.toEqual({ tipo: 'iniciado', id: 'job-1' })
      expect(espiao.mock.calls[0][0]).toBe('https://confere.exemplo/jobs')

      mockFetch(404, { detail: 'Not Found' })
      await expect(iniciarNoConfere(PARAMETROS)).resolves.toEqual({ tipo: 'sem-suporte' })
    })

    it('consultarNoConfere: andamento, pronto e perdido', async () => {
      const { consultarNoConfere } = await import('./cliente')
      mockFetch(200, { id: 'j', situacao: 'processando', fase: 'Lendo a planilha de levantamento', posicao: 0, segundos: 12 })
      await expect(consultarNoConfere('j')).resolves.toEqual({
        tipo: 'andamento',
        situacao: 'processando',
        fase: 'Lendo a planilha de levantamento',
        posicao: 0,
        segundos: 12,
      })

      mockFetch(200, { id: 'j', situacao: 'concluido' })
      await expect(consultarNoConfere('j')).resolves.toEqual({ tipo: 'pronto' })

      mockFetch(404, { detail: 'o serviço pode ter reiniciado' })
      await expect(consultarNoConfere('j')).resolves.toEqual({
        tipo: 'perdido',
        mensagem: 'o serviço pode ter reiniciado',
      })
    })

    it('resultadoDoConfere: lê igual ao /reports (200 relatório, 422 bloqueado)', async () => {
      const { resultadoDoConfere } = await import('./cliente')
      mockFetch(200, { docx_base64: 'AA==', analise_xlsx_base64: 'BB==' })
      await expect(resultadoDoConfere('j')).resolves.toEqual({
        tipo: 'concluido',
        resposta: { docx_base64: 'AA==', analise_xlsx_base64: 'BB==' },
      })

      const bloqueio = { bloqueantes: [], avisos: [], confirmaveis: [], pode_prosseguir: false }
      mockFetch(422, bloqueio)
      await expect(resultadoDoConfere('j')).resolves.toEqual({ tipo: 'bloqueado', resposta: bloqueio })
    })
  })
})
