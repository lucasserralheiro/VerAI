import { ocrAtual, iniciarOcr, limparOcr } from './ocrEmAndamento'

describe('ocrEmAndamento', () => {
  beforeEach(() => limparOcr('p1'))

  it('começa sem entrada', () => {
    expect(ocrAtual('p1')).toBeUndefined()
  })

  it('iniciarOcr marca como rodando e depois ok', async () => {
    const promise = iniciarOcr('p1', () => Promise.resolve('markdown final'))

    expect(ocrAtual('p1')).toEqual({ status: 'rodando', promise })

    await promise

    expect(ocrAtual('p1')).toEqual({ status: 'ok', markdown: 'markdown final' })
  })

  it('chamar de novo enquanto roda devolve a MESMA promise, sem rodar de novo', async () => {
    const rodar = jest.fn().mockResolvedValue('markdown final')

    const p1 = iniciarOcr('p1', rodar)
    const p2 = iniciarOcr('p1', rodar)

    expect(p1).toBe(p2)
    await p1
    expect(rodar).toHaveBeenCalledTimes(1)
  })

  it('falha vira status erro com a mensagem', async () => {
    const promise = iniciarOcr('p1', () => Promise.reject(new Error('deu ruim')))

    await expect(promise).rejects.toThrow('deu ruim')
    expect(ocrAtual('p1')).toEqual({ status: 'erro', mensagem: 'deu ruim' })
  })

  it('limparOcr esquece a entrada', async () => {
    await iniciarOcr('p1', () => Promise.resolve('x'))
    limparOcr('p1')
    expect(ocrAtual('p1')).toBeUndefined()
  })
})
