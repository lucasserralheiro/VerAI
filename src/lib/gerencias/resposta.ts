import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { ErroGerencia } from './tipos'

/** Roda a ação da rota e traduz `ErroGerencia` em `{ error }` com o status dela (e P2025/P2003 do Prisma em 404/400); outro erro segue subindo. */
export async function comErroGerencia(acao: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await acao()
  } catch (e) {
    if (e instanceof ErroGerencia) return NextResponse.json({ error: e.message }, { status: e.status })
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 })
      if (e.code === 'P2003') {
        return NextResponse.json(
          { error: 'Referência inválida (pessoa, gerência ou cliente inexistente).' },
          { status: 400 }
        )
      }
    }
    throw e
  }
}

/** Nome da gerência: aparado e obrigatório (o rótulo "Nome" vem do `lerCorpo`). */
export const nomeObrigatorio = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() : v),
  z.string({ error: 'obrigatório' }).min(1, 'obrigatório')
)
