/** @jest-environment node */
import { Prisma } from '@prisma/client'
import { respostaErroPrisma } from './erros-prisma'

const erroPrisma = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('falhou', { code, clientVersion: 'teste' })

describe('respostaErroPrisma', () => {
  it('P2025 (registro sumiu) vira 404 com a mensagem da coisa', async () => {
    const resposta = respostaErroPrisma(erroPrisma('P2025'), 'fornecedor não encontrado')
    expect(resposta.status).toBe(404)
    await expect(resposta.json()).resolves.toEqual({ error: 'fornecedor não encontrado' })
  })

  it('P2003 (FK inexistente) vira 400', async () => {
    const resposta = respostaErroPrisma(erroPrisma('P2003'), 'fornecedor não encontrado')
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'registro relacionado não existe' })
  })

  it('relança qualquer outro erro', () => {
    const outro = new Error('boom')
    expect(() => respostaErroPrisma(outro, 'x')).toThrow('boom')
    expect(() => respostaErroPrisma(erroPrisma('P2002'), 'x')).toThrow()
  })
})
