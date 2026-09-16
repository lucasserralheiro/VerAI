import {
  conferenciaTotaisAtual,
  iniciarConferenciaTotais,
  limparConferenciaTotais,
} from './conferenciaTotaisEmAndamento'

function mockFetch(resposta: { ok: boolean; body: unknown }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: resposta.ok,
    json: () => Promise.resolve(resposta.body),
  }) as jest.Mock
}

describe('conferenciaTotaisEmAndamento', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    limparConferenciaTotais('p1')
  })

  it('chama a rota certa via POST', async () => {
    mockFetch({ ok: true, body: { totais: [], checadoEm: '2026-09-16T00:00:00.000Z' } })

    await iniciarConferenciaTotais('p1')

    expect(global.fetch).toHaveBeenCalledWith('/api/propostas-comerciais/p1/conferir-totais', { method: 'POST' })
  })

  it('guarda o resultado ok no cache do módulo', async () => {
    mockFetch({
      ok: true,
      body: {
        totais: [
          { origem: 'Página 1', pagina: 1, rotulo: 'Total', valorNoOriginal: 'R$ 10,00', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 },
        ],
        checadoEm: '2026-09-16T00:00:00.000Z',
      },
    })

    const resultado = await iniciarConferenciaTotais('p1')

    expect(resultado.totais).toHaveLength(1)
    expect(conferenciaTotaisAtual('p1')).toEqual({ status: 'ok', resultado })
  })

  it('não duplica a chamada enquanto a primeira ainda está rodando', async () => {
    let resolver: (v: unknown) => void = () => {}
    global.fetch = jest.fn().mockReturnValue(
      new Promise((r) => {
        resolver = r
      })
    ) as jest.Mock

    const p1 = iniciarConferenciaTotais('p1')
    const p2 = iniciarConferenciaTotais('p1')

    expect(global.fetch).toHaveBeenCalledTimes(1)
    resolver({ ok: true, json: () => Promise.resolve({ totais: [], checadoEm: null }) })
    await Promise.all([p1, p2])
  })

  it('corpo inesperado (sem "totais") normaliza pra lista vazia', async () => {
    mockFetch({ ok: true, body: {} })

    const resultado = await iniciarConferenciaTotais('p1')

    expect(resultado).toEqual({ totais: [], tabelas: [], checadoEm: null })
  })

  it('resposta não-ok joga erro com a mensagem do corpo', async () => {
    mockFetch({ ok: false, body: { error: 'falhou de propósito' } })

    await expect(iniciarConferenciaTotais('p1')).rejects.toThrow('falhou de propósito')
    expect(conferenciaTotaisAtual('p1')).toEqual({ status: 'erro', mensagem: 'falhou de propósito' })
  })

  it('limparConferenciaTotais remove do cache', async () => {
    mockFetch({ ok: true, body: { totais: [], checadoEm: null } })
    await iniciarConferenciaTotais('p1')

    limparConferenciaTotais('p1')

    expect(conferenciaTotaisAtual('p1')).toBeUndefined()
  })
})
