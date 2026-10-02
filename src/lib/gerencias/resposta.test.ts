/** @jest-environment node */
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { comErroGerencia } from './resposta'
import { ErroGerencia } from './tipos'

const erroPrisma = (code: string) => new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: 'test' })

describe('comErroGerencia', () => {
  it('traduz ErroGerencia com o status dela', async () => {
    const r = await comErroGerencia(async () => {
      throw new ErroGerencia('Já existe.', 409)
    })
    expect(r.status).toBe(409)
    await expect(r.json()).resolves.toEqual({ error: 'Já existe.' })
  })

  it('P2025 vira 404', async () => {
    const r = await comErroGerencia(async () => {
      throw erroPrisma('P2025')
    })
    expect(r.status).toBe(404)
    await expect(r.json()).resolves.toEqual({ error: 'Registro não encontrado.' })
  })

  it('P2003 vira 400', async () => {
    const r = await comErroGerencia(async () => {
      throw erroPrisma('P2003')
    })
    expect(r.status).toBe(400)
    await expect(r.json()).resolves.toEqual({ error: 'Referência inválida (pessoa, gerência ou cliente inexistente).' })
  })

  it('outro erro segue subindo', async () => {
    await expect(
      comErroGerencia(async () => {
        throw erroPrisma('P2002')
      })
    ).rejects.toBeDefined()
  })

  it('devolve a resposta normal', async () => {
    const r = await comErroGerencia(async () => NextResponse.json({ ok: true }))
    expect(r.status).toBe(200)
  })
})
