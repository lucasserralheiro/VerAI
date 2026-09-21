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

  it('falha de rede (fetch rejeita) vira tipo "erro"', async () => {
    const { chamarConfere } = await import('./cliente')
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('fetch failed'))

    const resultado = await chamarConfere({
      contrato: { nome: 'c.pdf', bytes: Buffer.from('c') },
      levantamento: { nome: 'l.xlsx', bytes: Buffer.from('l') },
      aditivos: [],
      identidadeConfirmada: false,
    })

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
})
