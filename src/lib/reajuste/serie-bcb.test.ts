/** @jest-environment node */
import { FonteIndiceIndisponivel, URL_SERIE_IPC_FIPE, buscarSerieIpcFipe, lerRespostaDaSerie } from './serie-bcb'

describe('lerRespostaDaSerie', () => {
  it('converte data dd/mm/aaaa e mantém a variação como texto', () => {
    expect(
      lerRespostaDaSerie([
        { data: '01/07/2026', valor: '-0.03' },
        { data: '01/08/2026', valor: '0.01' },
      ])
    ).toEqual([
      { mes: '2026-07', variacao: '-0.03' },
      { mes: '2026-08', variacao: '0.01' },
    ])
  })
  it('recusa o que não é a série', () => {
    expect(() => lerRespostaDaSerie({ erro: 'x' })).toThrow(FonteIndiceIndisponivel)
    expect(() => lerRespostaDaSerie([])).toThrow(FonteIndiceIndisponivel)
    expect(() => lerRespostaDaSerie([{ data: '2026-08-01', valor: '0.1' }])).toThrow(FonteIndiceIndisponivel)
    expect(() => lerRespostaDaSerie([{ data: '01/08/2026', valor: 'abc' }])).toThrow(FonteIndiceIndisponivel)
  })
})

describe('buscarSerieIpcFipe', () => {
  const resposta = (corpo: string, tipo: string, status = 200) =>
    Promise.resolve(new Response(corpo, { status, headers: { 'content-type': tipo } }))

  it('chama a série 193 com User-Agent', async () => {
    const fetcher = jest.fn(() => resposta('[{"data":"01/08/2026","valor":"0.01"}]', 'application/json; charset=utf-8'))
    await expect(buscarSerieIpcFipe(fetcher as unknown as typeof fetch)).resolves.toEqual([{ mes: '2026-08', variacao: '0.01' }])
    expect(URL_SERIE_IPC_FIPE).toContain('bcdata.sgs.193')
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(URL_SERIE_IPC_FIPE)
    expect((init.headers as Record<string, string>)['User-Agent']).toBeTruthy()
  })
  it('HTML de bloqueio e erro HTTP viram FonteIndiceIndisponivel', async () => {
    await expect(buscarSerieIpcFipe((() => resposta('<html>', 'text/html')) as unknown as typeof fetch)).rejects.toThrow(
      FonteIndiceIndisponivel
    )
    await expect(buscarSerieIpcFipe((() => resposta('', 'text/plain', 502)) as unknown as typeof fetch)).rejects.toThrow(
      'Banco Central respondeu 502'
    )
  })
})
