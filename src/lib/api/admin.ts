import { NextRequest, NextResponse } from 'next/server'

import type { AuthUser } from '@/lib/auth'
import { RECURSOS, RECURSOS_DO_VERAI } from '@/lib/integracao/feed'
import { estadoDaFonte } from '@/lib/integracao/espelho'
import { listarFontes } from '@/lib/integracao/fontes'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'

import { listarApps } from './apps'

/** Rotas /api/admin/api/*: só admin (o middleware já barra /api/admin; aqui é a segunda trava). */
export async function exigirAdminApi(request: NextRequest): Promise<{ usuario: AuthUser } | { erro: NextResponse }> {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return { erro: autenticado.erro }
  if (autenticado.usuario.role !== 'admin') return { erro: NextResponse.json({ error: 'acesso negado' }, { status: 403 }) }
  return { usuario: autenticado.usuario }
}

/** Tudo o que a tela /admin/api mostra. */
export async function painelDaApi(origem: string) {
  const [apps, fontes] = await Promise.all([listarApps(), listarFontes()])
  return {
    urlBase: (process.env.APP_URL ?? origem).replace(/\/$/, ''),
    recursos: RECURSOS.map((recurso) => ({ recurso, ...RECURSOS_DO_VERAI[recurso] })),
    apps: apps.map((a) => ({
      ...a,
      criadoEm: a.criadoEm.toISOString(),
      ultimoUsoEm: a.ultimoUsoEm?.toISOString() ?? null,
      webhooks: a.webhooks.map((w) => ({ ...w, entregas: w.entregas.map((e) => ({ ...e, criadoEm: e.criadoEm.toISOString() })) })),
    })),
    fontes: await Promise.all(
      fontes.map(async (f) => ({
        id: f.id,
        slug: f.slug,
        nome: f.nome,
        url: f.url,
        ativa: f.ativa,
        recursos: f.recursos,
        temSegredo: !!f.segredoWebhook,
        chaveFinal: f.chave.slice(-4),
        estado: await estadoDaFonte(f.slug, f.recursos),
      }))
    ),
  }
}
