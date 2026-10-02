import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { PapelGerencia, Vinculo } from './permissao'
import {
  ErroGerencia,
  type ClienteCarteira,
  type GerenciaDetalhe,
  type GerenciaResumo,
} from './tipos'

const SELECT_CLIENTE = { id: true, nome: true, siglaLegado: true } as const

const SELECT_RESUMO = {
  id: true,
  nome: true,
  sigla: true,
  ativa: true,
  _count: { select: { carteira: true } },
  membros: { where: { papel: 'manager' }, select: { usuario: { select: { nome: true } } } },
} as const

function resumir(g: {
  id: string
  nome: string
  sigla: string | null
  ativa: boolean
  _count: { carteira: number }
  membros: Array<{ usuario: { nome: string } }>
}): GerenciaResumo {
  return {
    id: g.id,
    nome: g.nome,
    sigla: g.sigla,
    ativa: g.ativa,
    clientes: g._count.carteira,
    managers: g.membros.map((m) => m.usuario.nome),
  }
}

export async function listarGerencias(): Promise<GerenciaResumo[]> {
  const linhas = await prisma.gerencia.findMany({
    orderBy: [{ ativa: 'desc' }, { nome: 'asc' }],
    select: SELECT_RESUMO,
  })
  return linhas.map(resumir)
}

export async function detalheGerencia(id: string): Promise<GerenciaDetalhe | null> {
  const g = await prisma.gerencia.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      sigla: true,
      ativa: true,
      _count: { select: { carteira: true } },
      membros: {
        select: { papel: true, usuario: { select: { id: true, nome: true, email: true } } },
        orderBy: { usuario: { nome: 'asc' } },
      },
    },
  })
  if (!g) return null

  const carteira = await prisma.carteiraCliente.findMany({
    where: { gerenciaId: id },
    select: { cliente: { select: SELECT_CLIENTE } },
    orderBy: { cliente: { nome: 'asc' } },
  })
  const clienteIds = carteira.map((c) => c.cliente.id)

  const movs = await prisma.movimentoCarteira.findMany({
    where: {
      OR: [{ clienteId: { in: clienteIds } }, { deGerenciaId: id }, { paraGerenciaId: id }],
    },
    orderBy: { em: 'desc' },
    take: 50,
    select: {
      id: true,
      cliente: { select: { nome: true } },
      deGerenciaId: true,
      paraGerenciaId: true,
      porId: true,
      em: true,
    },
  })

  const gerencias = await prisma.gerencia.findMany({ select: { id: true, nome: true } })
  const nomeGerencia = new Map(gerencias.map((x) => [x.id, x.nome]))
  const porIds = [...new Set(movs.map((m) => m.porId).filter((x): x is string => !!x))]
  const usuarios = porIds.length
    ? await prisma.usuario.findMany({ where: { id: { in: porIds } }, select: { id: true, nome: true } })
    : []
  const nomeUsuario = new Map(usuarios.map((u) => [u.id, u.nome]))

  return {
    id: g.id,
    nome: g.nome,
    sigla: g.sigla,
    ativa: g.ativa,
    clientes: g._count.carteira,
    managers: g.membros.filter((m) => m.papel === 'manager').map((m) => m.usuario.nome),
    carteira: carteira.map((c) => c.cliente),
    membros: g.membros.map((m) => ({
      usuarioId: m.usuario.id,
      nome: m.usuario.nome,
      email: m.usuario.email,
      papel: m.papel as PapelGerencia,
    })),
    movimentos: movs.map((m) => ({
      id: m.id,
      cliente: m.cliente.nome,
      de: m.deGerenciaId ? (nomeGerencia.get(m.deGerenciaId) ?? null) : null,
      para: m.paraGerenciaId ? (nomeGerencia.get(m.paraGerenciaId) ?? null) : null,
      por: m.porId ? (nomeUsuario.get(m.porId) ?? null) : null,
      em: m.em.toISOString(),
    })),
  }
}

export async function criarGerencia(d: { nome: string; sigla?: string | null }): Promise<GerenciaResumo> {
  try {
    const g = await prisma.gerencia.create({
      data: { nome: d.nome, sigla: d.sigla ?? null },
      select: SELECT_RESUMO,
    })
    return resumir(g)
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') {
      throw new ErroGerencia('Já existe gerência com esse nome ou sigla.', 409)
    }
    throw e
  }
}

export async function atualizarGerencia(
  id: string,
  d: { nome?: string; sigla?: string | null; ativa?: boolean }
) {
  if (d.ativa === false) {
    const clientes = await prisma.carteiraCliente.count({ where: { gerenciaId: id } })
    if (clientes > 0) throw new ErroGerencia(`Tire os ${clientes} clientes da carteira antes de desativar.`, 409)
  }
  try {
    await prisma.gerencia.update({ where: { id }, data: d })
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') {
      throw new ErroGerencia('Já existe gerência com esse nome ou sigla.', 409)
    }
    throw e
  }
}

export async function clientesSemGerencia(): Promise<ClienteCarteira[]> {
  return prisma.cliente.findMany({ where: { carteira: null }, orderBy: { nome: 'asc' }, select: SELECT_CLIENTE })
}

export async function moverClientes(clienteIds: string[], paraGerenciaId: string | null, porId: string) {
  if (paraGerenciaId) {
    const destino = await prisma.gerencia.findUnique({ where: { id: paraGerenciaId }, select: { id: true, ativa: true } })
    if (!destino) throw new ErroGerencia('Gerência não encontrada.', 404)
    if (!destino.ativa) throw new ErroGerencia('Gerência desativada não recebe clientes.', 409)
  }
  const atuais = await prisma.carteiraCliente.findMany({
    where: { clienteId: { in: clienteIds } },
    select: { clienteId: true, gerenciaId: true },
  })
  const deOnde = new Map(atuais.map((a) => [a.clienteId, a.gerenciaId]))
  const mudam = clienteIds.filter((id) => (deOnde.get(id) ?? null) !== paraGerenciaId)
  if (mudam.length === 0) return { movidos: 0 }

  const gravar: Prisma.PrismaPromise<unknown>[] = paraGerenciaId
    ? mudam.map((clienteId) =>
        prisma.carteiraCliente.upsert({
          where: { clienteId },
          create: { clienteId, gerenciaId: paraGerenciaId, movidoPorId: porId },
          update: { gerenciaId: paraGerenciaId, movidoPorId: porId, movidoEm: new Date() },
        })
      )
    : [prisma.carteiraCliente.deleteMany({ where: { clienteId: { in: mudam } } })]
  const trilha: Prisma.PrismaPromise<unknown>[] = mudam.map((clienteId) =>
    prisma.movimentoCarteira.create({
      data: { clienteId, deGerenciaId: deOnde.get(clienteId) ?? null, paraGerenciaId, porId },
    })
  )
  await prisma.$transaction([...gravar, ...trilha])
  return { movidos: mudam.length }
}

export async function vinculosDoUsuario(usuarioId: string): Promise<Array<Vinculo & { nome: string }>> {
  const linhas = await prisma.membroGerencia.findMany({
    where: { usuarioId, gerencia: { ativa: true } },
    select: { gerenciaId: true, papel: true, gerencia: { select: { nome: true } } },
    orderBy: { gerencia: { nome: 'asc' } },
  })
  return linhas.map((l) => ({ gerenciaId: l.gerenciaId, papel: l.papel as PapelGerencia, nome: l.gerencia.nome }))
}

export async function papelNaGerencia(gerenciaId: string, usuarioId: string): Promise<PapelGerencia | null> {
  const m = await prisma.membroGerencia.findUnique({
    where: { gerenciaId_usuarioId: { gerenciaId, usuarioId } },
    select: { papel: true },
  })
  return m ? (m.papel as PapelGerencia) : null
}

export async function gravarMembro(gerenciaId: string, usuarioId: string, papel: PapelGerencia) {
  await prisma.membroGerencia.upsert({
    where: { gerenciaId_usuarioId: { gerenciaId, usuarioId } },
    create: { gerenciaId, usuarioId, papel },
    update: { papel },
  })
}

export async function removerMembro(gerenciaId: string, usuarioId: string) {
  await prisma.membroGerencia.delete({ where: { gerenciaId_usuarioId: { gerenciaId, usuarioId } } })
}

export async function gerenciaDoCliente(clienteId: string): Promise<{ id: string; nome: string } | null> {
  const c = await prisma.carteiraCliente.findUnique({
    where: { clienteId },
    select: { gerencia: { select: { id: true, nome: true } } },
  })
  return c ? c.gerencia : null
}

export async function candidatosDaEquipe(gerenciaId: string): Promise<Array<{ id: string; nome: string; email: string }>> {
  return prisma.usuario.findMany({
    where: { gerencias: { none: { gerenciaId } } },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, email: true },
  })
}
