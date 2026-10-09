import { prisma } from '@/lib/prisma'

import { apagarCopia } from './espelho'

// Cadastro das FONTES EXTERNAS (sistemas de onde o VerAI recebe dados pela API de plataforma deles).
// Spec docs/superpowers/specs/2026-10-08-api-plataforma-design.md §6.

export function slugDe(nome: string): string {
  return (
    nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'fonte'
  )
}

export interface Descoberta {
  ok: boolean
  sistema?: string
  app?: string
  recursos?: { recurso: string; rotulo: string; descricao: string; permitido: boolean }[]
  erro?: string
}

/** Chama `GET <url>/api/v1` com a chave: confirma que é a API de plataforma e diz o que a chave pode ler. */
export async function descobrirFonte(url: string, chave: string): Promise<Descoberta> {
  try {
    const resposta = await fetch(`${url.replace(/\/$/, '')}/api/v1`, {
      headers: { authorization: `Bearer ${chave}`, accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (resposta.status === 401) return { ok: false, erro: 'a fonte recusou a chave (inválida, girada ou app desativado)' }
    if (!resposta.ok) return { ok: false, erro: `a fonte respondeu HTTP ${resposta.status} — o endereço é de um sistema com a API v1?` }
    const corpo = (await resposta.json()) as { objeto?: string; sistema?: string; app?: { nome?: string }; recursos?: Descoberta['recursos'] }
    if (corpo.objeto !== 'api' || !Array.isArray(corpo.recursos)) return { ok: false, erro: 'o endereço respondeu, mas não no formato da API v1' }
    return { ok: true, sistema: corpo.sistema, app: corpo.app?.nome, recursos: corpo.recursos }
  } catch (erro) {
    return { ok: false, erro: `sem resposta da fonte (${erro instanceof Error ? erro.message : String(erro)})` }
  }
}

export async function listarFontes() {
  return prisma.fonteExterna.findMany({ orderBy: { nome: 'asc' } })
}

export async function criarFonte(dados: { nome: string; url: string; chave: string; segredoWebhook?: string | null; recursos: string[] }) {
  let slug = slugDe(dados.nome)
  for (let n = 2; await prisma.fonteExterna.findUnique({ where: { slug } }); n++) slug = `${slugDe(dados.nome)}-${n}`
  return prisma.fonteExterna.create({
    data: { slug, nome: dados.nome.trim(), url: dados.url.trim().replace(/\/$/, ''), chave: dados.chave.trim(), segredoWebhook: dados.segredoWebhook?.trim() || null, recursos: dados.recursos },
  })
}

/** Atualiza a fonte. Recurso desmarcado tem a cópia apagada na hora. */
export async function atualizarFonte(
  id: string,
  dados: Partial<{ nome: string; url: string; chave: string; segredoWebhook: string | null; recursos: string[]; ativa: boolean }>
) {
  const atual = await prisma.fonteExterna.findUniqueOrThrow({ where: { id } })
  const fonte = await prisma.fonteExterna.update({
    where: { id },
    data: {
      ...dados,
      url: dados.url?.trim().replace(/\/$/, ''),
      chave: dados.chave?.trim() || undefined,
      segredoWebhook: dados.segredoWebhook === undefined ? undefined : dados.segredoWebhook?.trim() || null,
    },
  })
  const sairam = atual.recursos.filter((r) => !fonte.recursos.includes(r))
  if (sairam.length) await apagarCopia(fonte.slug, sairam)
  return fonte
}

/** Exclui a fonte e toda a cópia que veio dela. */
export async function excluirFonte(id: string) {
  const fonte = await prisma.fonteExterna.delete({ where: { id } })
  await apagarCopia(fonte.slug)
}
