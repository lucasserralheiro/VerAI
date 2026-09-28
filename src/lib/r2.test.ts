/** @jest-environment node */
import { createHash } from 'node:crypto'
import { HASH_VAZIO, assinarSigV4, assinarUrlSigV4, codificarChave, configR2, deleteR2, putR2, urlDeEnvioR2 } from './r2'

describe('assinarSigV4', () => {
  // Exemplo oficial da AWS ("GET Object", Signature Version 4, payload em um bloco só).
  it('bate com o exemplo da documentação da AWS', () => {
    const r = assinarSigV4({
      metodo: 'GET',
      host: 'examplebucket.s3.amazonaws.com',
      caminho: '/test.txt',
      cabecalhos: { range: 'bytes=0-9' },
      hashCorpo: HASH_VAZIO,
      chaveId: 'AKIAIOSFODNN7EXAMPLE',
      segredo: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      regiao: 'us-east-1',
      servico: 's3',
      quando: new Date('2013-05-24T00:00:00Z'),
    })
    expect(r.hashCanonico).toBe('7344ae5b7ee6c3e7e6b0fe0640412a37625d1fbfff95c48bbb2dc43964946972')
    expect(r.assinatura).toBe('f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41')
    expect(r.cabecalhos.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41'
    )
    expect(r.cabecalhos['x-amz-date']).toBe('20130524T000000Z')
  })
})

describe('assinarUrlSigV4', () => {
  // Exemplo oficial da AWS ("Authenticating Requests: Using Query Parameters").
  it('bate com o exemplo da documentação da AWS', () => {
    const url = assinarUrlSigV4({
      metodo: 'GET',
      host: 'examplebucket.s3.amazonaws.com',
      caminho: '/test.txt',
      cabecalhos: {},
      expiraEmSegundos: 86400,
      chaveId: 'AKIAIOSFODNN7EXAMPLE',
      segredo: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      regiao: 'us-east-1',
      servico: 's3',
      quando: new Date('2013-05-24T00:00:00Z'),
    })
    expect(url).toBe(
      'https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404'
    )
  })
})

describe('urlDeEnvioR2', () => {
  const cfg = { contaId: 'conta', bucket: 'verai-documentos', chaveId: 'id', segredo: 'segredo' }

  it('PUT no endpoint da conta, assinando tipo e tamanho', () => {
    const url = new URL(
      urlDeEnvioR2(
        'tmp-uploads/a b.pdf',
        { contentType: 'application/pdf', tamanhoBytes: 1234, expiraEmSegundos: 900 },
        cfg,
        new Date('2026-09-28T12:00:00Z')
      )
    )
    expect(url.origin + url.pathname).toBe('https://conta.r2.cloudflarestorage.com/verai-documentos/tmp-uploads/a%20b.pdf')
    expect(url.searchParams.get('X-Amz-Credential')).toBe('id/20260928/auto/s3/aws4_request')
    expect(url.searchParams.get('X-Amz-Date')).toBe('20260928T120000Z')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900')
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host')
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('codificarChave', () => {
  it('codifica cada segmento uma vez, mantendo as barras', () => {
    expect(codificarChave('clientes/c1/a1/TC 1-2023 (assinado).pdf')).toBe('clientes/c1/a1/TC%201-2023%20%28assinado%29.pdf')
    expect(codificarChave('x/Publicação!.pdf')).toBe('x/Publica%C3%A7%C3%A3o%21.pdf')
  })
})

describe('configR2', () => {
  it('lê as 4 variáveis; faltando qualquer uma, não configura', () => {
    const env = { R2_ACCOUNT_ID: ' conta ', R2_BUCKET: 'verai-documentos', R2_ACCESS_KEY_ID: 'id', R2_SECRET_ACCESS_KEY: 'segredo' }
    expect(configR2(env)).toEqual({ contaId: 'conta', bucket: 'verai-documentos', chaveId: 'id', segredo: 'segredo' })
    expect(configR2({ ...env, R2_SECRET_ACCESS_KEY: '' })).toBeNull()
  })
})

describe('putR2 / deleteR2', () => {
  const cfg = { contaId: 'conta', bucket: 'verai-documentos', chaveId: 'id', segredo: 'segredo' }
  const fetchOriginal = global.fetch
  afterEach(() => {
    global.fetch = fetchOriginal
  })

  it('PUT assinado no endpoint da conta, com o hash do conteúdo; devolve r2:<chave>', async () => {
    const chamadas: Array<[string, RequestInit]> = []
    global.fetch = jest.fn(async (url: string, init: RequestInit) => {
      chamadas.push([url, init])
      return new Response(null, { status: 200 })
    }) as unknown as typeof fetch
    const dados = Buffer.from('%PDF')
    expect(await putR2('clientes/c1/a1/TC 1.pdf', dados, 'application/pdf', cfg)).toBe('r2:clientes/c1/a1/TC 1.pdf')
    const [url, init] = chamadas[0]
    expect(url).toBe('https://conta.r2.cloudflarestorage.com/verai-documentos/clientes/c1/a1/TC%201.pdf')
    expect(init.method).toBe('PUT')
    const cabecalhos = init.headers as Record<string, string>
    expect(cabecalhos['x-amz-content-sha256']).toBe(createHash('sha256').update(dados).digest('hex'))
    expect(cabecalhos['content-type']).toBe('application/pdf')
    expect(cabecalhos.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=id\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/)
  })

  it('gravação recusada vira erro com o status', async () => {
    global.fetch = jest.fn(async () => new Response('AccessDenied', { status: 403 })) as unknown as typeof fetch
    await expect(putR2('x.pdf', Buffer.from('a'), 'application/pdf', cfg)).rejects.toThrow(/403/)
  })

  it('apagar o que já não existe (404) não é erro', async () => {
    global.fetch = jest.fn(async () => new Response(null, { status: 404 })) as unknown as typeof fetch
    await expect(deleteR2('x.pdf', cfg)).resolves.toBeUndefined()
  })
})
