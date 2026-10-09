import type { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

import { hashDaChave } from './chave'
import { erroApi } from './resposta'

// Porta da API de plataforma: `Authorization: Bearer <chave do app>`. App desativado ou chave girada =
// 401. Escopo é por recurso ("contratos:ler"); faltou o escopo = 403. Spec 2026-10-08-api-plataforma §3.

export interface AppAutenticado {
  id: string
  nome: string
  escopos: string[]
}

export const escopoDeLeitura = (recurso: string) => `${recurso}:ler`

export function podeLer(app: Pick<AppAutenticado, 'escopos'>, recurso: string): boolean {
  return app.escopos.includes(escopoDeLeitura(recurso))
}

const UM_MINUTO = 60_000

export async function autenticarApp(request: Request): Promise<{ app: AppAutenticado } | { erro: NextResponse }> {
  const cabecalho = request.headers.get('authorization') ?? ''
  const chave = cabecalho.startsWith('Bearer ') ? cabecalho.slice('Bearer '.length).trim() : ''
  if (!chave) return { erro: erroApi(401, 'sem_chave', 'Envie a chave do aplicativo em Authorization: Bearer <chave>.') }
  const app = await prisma.apiApp.findUnique({
    where: { chaveHash: hashDaChave(chave) },
    select: { id: true, nome: true, escopos: true, ativo: true, ultimoUsoEm: true },
  })
  if (!app || !app.ativo) return { erro: erroApi(401, 'chave_invalida', 'Chave inválida, girada ou de aplicativo desativado.') }
  if (!app.ultimoUsoEm || Date.now() - app.ultimoUsoEm.getTime() > UM_MINUTO) {
    void prisma.apiApp.update({ where: { id: app.id }, data: { ultimoUsoEm: new Date() } }).catch(() => undefined)
  }
  return { app: { id: app.id, nome: app.nome, escopos: app.escopos } }
}

export function exigirLeitura(app: AppAutenticado, recurso: string): NextResponse | null {
  return podeLer(app, recurso)
    ? null
    : erroApi(403, 'sem_permissao', `Este aplicativo não tem o escopo ${escopoDeLeitura(recurso)}.`, { escopo: escopoDeLeitura(recurso) })
}
