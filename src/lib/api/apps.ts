import { prisma } from '@/lib/prisma'
import { RECURSOS } from '@/lib/integracao/feed'

import { escopoDeLeitura } from './autenticar'
import { gerarChave, gerarSegredo } from './chave'
import { enviarWebhook } from './webhooks'

// Cadastro dos APLICATIVOS que consomem a API do VerAI (tela /admin/api). A chave inteira só sai daqui na
// criação e no giro; o segredo do webhook aparece na tela (precisa ser copiado para o outro sistema).

/** Só escopos de recursos que existem — nada de escopo inventado vindo da tela. */
export function escoposValidos(escopos: string[]): string[] {
  const validos = new Set(RECURSOS.map(escopoDeLeitura))
  return [...new Set(escopos)].filter((e) => validos.has(e)).sort()
}

export async function listarApps() {
  const apps = await prisma.apiApp.findMany({
    orderBy: { nome: 'asc' },
    select: {
      id: true,
      nome: true,
      descricao: true,
      ativo: true,
      escopos: true,
      chavePrefixo: true,
      criadoEm: true,
      criadoPor: true,
      ultimoUsoEm: true,
      webhooks: {
        orderBy: { criadoEm: 'asc' },
        select: {
          id: true,
          url: true,
          eventos: true,
          segredo: true,
          ativo: true,
          entregas: { orderBy: { criadoEm: 'desc' }, take: 5, select: { recursos: true, status: true, erro: true, criadoEm: true } },
        },
      },
    },
  })
  return apps
}

export async function criarApp(dados: { nome: string; descricao?: string | null; escopos: string[] }, quem: string) {
  const { chave, prefixo, hash } = gerarChave()
  const app = await prisma.apiApp.create({
    data: {
      nome: dados.nome.trim(),
      descricao: dados.descricao?.trim() || null,
      escopos: escoposValidos(dados.escopos),
      chavePrefixo: prefixo,
      chaveHash: hash,
      criadoPor: quem,
    },
    select: { id: true },
  })
  return { id: app.id, chave }
}

export async function atualizarApp(id: string, dados: Partial<{ nome: string; descricao: string | null; ativo: boolean; escopos: string[] }>) {
  await prisma.apiApp.update({
    where: { id },
    data: { ...dados, escopos: dados.escopos ? escoposValidos(dados.escopos) : undefined },
  })
}

/** Gira a chave: a antiga para de funcionar na hora. */
export async function girarChave(id: string) {
  const { chave, prefixo, hash } = gerarChave()
  await prisma.apiApp.update({ where: { id }, data: { chavePrefixo: prefixo, chaveHash: hash } })
  return { chave }
}

export async function excluirApp(id: string) {
  await prisma.apiApp.delete({ where: { id } })
}

export async function criarWebhook(appId: string, dados: { url: string; eventos: string[] }) {
  return prisma.apiWebhook.create({
    data: { appId, url: dados.url.trim(), eventos: dados.eventos.filter((e) => RECURSOS.includes(e)), segredo: gerarSegredo() },
    select: { id: true, segredo: true },
  })
}

export async function atualizarWebhook(id: string, dados: Partial<{ url: string; eventos: string[]; ativo: boolean }>) {
  await prisma.apiWebhook.update({
    where: { id },
    data: { ...dados, url: dados.url?.trim(), eventos: dados.eventos?.filter((e) => RECURSOS.includes(e)) },
  })
}

export async function excluirWebhook(id: string) {
  await prisma.apiWebhook.delete({ where: { id } })
}

/** Manda um `ping` assinado para o webhook — confere URL e segredo do outro lado. */
export async function testarWebhook(id: string) {
  const hook = await prisma.apiWebhook.findUniqueOrThrow({ where: { id }, select: { id: true, url: true, segredo: true } })
  return enviarWebhook(hook, 'ping', [])
}
