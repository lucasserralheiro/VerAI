import { enviarParaR2 } from './envio-r2-navegador'

const LINK = {
  url: 'https://conta.r2.cloudflarestorage.com/verai-documentos/tmp-uploads/x.pdf?X-Amz-Signature=abc',
  endereco: 'r2:tmp-uploads/x.pdf',
  contentType: 'application/pdf',
}

const resposta = (status: number, corpo?: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) }) as Response

describe('enviarParaR2', () => {
  const arquivo = new File(['%PDF-conteudo'], 'Proposta Final.pdf', { type: 'application/pdf' })

  beforeEach(() => {
    global.fetch = jest.fn()
  })

  it('pede o link à rota e faz o PUT do arquivo nele, com o tipo assinado; devolve o endereço', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(resposta(200, LINK)).mockResolvedValueOnce(resposta(200))

    await expect(enviarParaR2(arquivo, '/api/propostas-comerciais/envio')).resolves.toBe('r2:tmp-uploads/x.pdf')

    const [[rota, pedido], [url, envio]] = (global.fetch as jest.Mock).mock.calls
    expect(rota).toBe('/api/propostas-comerciais/envio')
    expect(pedido.method).toBe('POST')
    expect(JSON.parse(pedido.body)).toEqual({ nome: 'Proposta Final.pdf', tamanhoBytes: arquivo.size })
    expect(url).toBe(LINK.url)
    expect(envio).toEqual({ method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: arquivo })
  })

  it('rota recusa: lança a mensagem dela, sem tentar o PUT', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(resposta(400, { error: '"Proposta Final.pdf" passa de 50 MB' }))

    await expect(enviarParaR2(arquivo, '/rota')).rejects.toThrow('"Proposta Final.pdf" passa de 50 MB')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('rede quebrada no PUT (bucket sem CORS, por exemplo): mensagem legível', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(resposta(200, LINK)).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(enviarParaR2(arquivo, '/rota')).rejects.toThrow(
      'Não foi possível enviar "Proposta Final.pdf" para o armazenamento.'
    )
  })

  it('armazenamento recusa o PUT: mensagem com o status', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(resposta(200, LINK)).mockResolvedValueOnce(resposta(403))

    await expect(enviarParaR2(arquivo, '/rota')).rejects.toThrow('O armazenamento recusou "Proposta Final.pdf" (403).')
  })
})
