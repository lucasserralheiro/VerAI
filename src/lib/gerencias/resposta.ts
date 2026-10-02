import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ErroGerencia } from './tipos'

/** Roda a ação da rota e traduz `ErroGerencia` em `{ error }` com o status dela; outro erro segue subindo. */
export async function comErroGerencia(acao: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await acao()
  } catch (e) {
    if (e instanceof ErroGerencia) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

/** Nome da gerência: aparado e obrigatório (o rótulo "Nome" vem do `lerCorpo`). */
export const nomeObrigatorio = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() : v),
  z.string({ error: 'obrigatório' }).min(1, 'obrigatório')
)
