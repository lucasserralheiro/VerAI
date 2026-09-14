function mockFetch(resposta: { ok: boolean; body: unknown }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: resposta.ok,
    json: () => Promise.resolve(resposta.body),
  }) as jest.Mock
}

import { checagemIaAtual, iniciarChecagemIa, limparChecagemIa } from './checagemIaEmAndamento'

describe('checagemIaEmAndamento', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    limparChecagemIa('p1')
  })

  it('começa sem entrada', () => {
    expect(checagemIaAtual('p1')).toBeUndefined()
  })

  it('iniciarChecagemIa chama a rota e vira status ok com o resultado', async () => {
    mockFetch({ ok: true, body: { scoreExibido: 87, trechosSuspeitos: [], paginasComImagem: [2] } })

    const promise = iniciarChecagemIa('p1')
    expect(checagemIaAtual('p1')).toEqual({ status: 'rodando', promise })

    await promise

    expect(checagemIaAtual('p1')).toEqual({
      status: 'ok',
      resultado: {
        scoreExibido: 87,
        trechosSuspeitos: [],
        paginasComImagem: [2],
        checadoEm: null,
        correcaoAutomaticaAplicada: false,
      },
    })
    expect(global.fetch).toHaveBeenCalledWith('/api/propostas-comerciais/p1/checagem-ia', { method: 'POST' })
  })

  it('chamar de novo enquanto roda devolve a MESMA promise', async () => {
    mockFetch({ ok: true, body: { scoreExibido: 87, trechosSuspeitos: [], paginasComImagem: [] } })

    const p1 = iniciarChecagemIa('p1')
    const p2 = iniciarChecagemIa('p1')

    expect(p1).toBe(p2)
    await p1
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('resposta não-ok vira status erro', async () => {
    mockFetch({ ok: false, body: { error: 'deu ruim' } })

    await expect(iniciarChecagemIa('p1')).rejects.toThrow('deu ruim')
    expect(checagemIaAtual('p1')).toEqual({ status: 'erro', mensagem: 'deu ruim' })
  })

  it('resposta sem paginasComImagem (formato antigo) vira lista vazia, não quebra', async () => {
    mockFetch({ ok: true, body: { scoreExibido: 87, trechosSuspeitos: [] } })

    const resultado = await iniciarChecagemIa('p1')

    expect(resultado.paginasComImagem).toEqual([])
  })
})
