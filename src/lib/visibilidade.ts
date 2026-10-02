import type { Documento, Prisma } from '@prisma/client'
import { prisma } from './prisma'
import type { AuthUser } from './auth'
import { decidirEdicao } from './gerencias/permissao'

/** `null` = sem restrição. Desde 02/10/2026 todo usuário logado vê todos os clientes (spec
 *  2026-10-02-gerencias §0.1); quem edita decide `podeEditarCliente`. */
export async function clienteIdsPermitidos(_usuario: AuthUser): Promise<string[] | null> {
  return null
}

async function regrasQueBatemComUsuario(email: string) {
  const regras = await prisma.regraNotificacao.findMany()
  return regras.filter((regra) => {
    const lista = Array.isArray(regra.destinatarios) ? (regra.destinatarios as unknown[]) : []
    return lista.includes(email)
  })
}

export async function documentosVisiveisWhere(usuario: AuthUser): Promise<Prisma.DocumentoWhereInput> {
  const idsClientes = await clienteIdsPermitidos(usuario)
  const restricaoCliente: Prisma.DocumentoWhereInput =
    idsClientes === null ? {} : { clienteId: { in: idsClientes } }

  if (usuario.role === 'admin') return restricaoCliente
  if (usuario.role === 'uploader') return { AND: [restricaoCliente, { uploadedById: usuario.id }] }

  const regras = await regrasQueBatemComUsuario(usuario.email)
  const tipos = regras.filter((r) => r.criterioTipo === 'tipoDocumento').map((r) => r.criterioValor)
  const palavras = regras.filter((r) => r.criterioTipo === 'palavraChaveNome').map((r) => r.criterioValor)

  const OR: Prisma.DocumentoWhereInput[] = [{ uploadedById: usuario.id }]
  if (tipos.length > 0) OR.push({ tipo: { in: tipos } })
  for (const palavra of palavras) {
    OR.push({ nomeArquivo: { contains: palavra, mode: 'insensitive' } })
  }
  return { AND: [restricaoCliente, { OR }] }
}

export async function podeVerDocumento(usuario: AuthUser, documento: Documento): Promise<boolean> {
  const idsClientes = await clienteIdsPermitidos(usuario)
  if (idsClientes !== null && !idsClientes.includes(documento.clienteId)) return false

  if (usuario.role === 'admin' || documento.uploadedById === usuario.id) return true
  if (usuario.role === 'uploader') return false

  const regras = await regrasQueBatemComUsuario(usuario.email)
  return regras.some((regra) => {
    if (regra.criterioTipo === 'tipoDocumento') return regra.criterioValor === documento.tipo
    if (regra.criterioTipo === 'palavraChaveNome') {
      return documento.nomeArquivo.toLowerCase().includes(regra.criterioValor.toLowerCase())
    }
    return false
  })
}

export async function clientesVisiveisWhere(usuario: AuthUser): Promise<Prisma.ClienteWhereInput> {
  const ids = await clienteIdsPermitidos(usuario)
  return ids === null ? {} : { id: { in: ids } }
}

export async function podeVerCliente(usuario: AuthUser, clienteId: string): Promise<boolean> {
  const ids = await clienteIdsPermitidos(usuario)
  return ids === null || ids.includes(clienteId)
}

/** Edição de cliente (spec 2026-10-02-gerencias §3): admin; membro da gerência ativa dona do cliente; e, na
 *  transição da Fase A, quem tem o cliente em `clientesPermitidos`. Uma consulta só. Os mocks antigos de rota
 *  devolvem `clientesPermitidos` sem filtro — por isso a conferência por id, e não só pelo tamanho da lista. */
export async function podeEditarCliente(usuario: AuthUser, clienteId: string): Promise<boolean> {
  if (usuario.role === 'admin') return true
  const registro = await prisma.usuario.findUnique({
    where: { id: usuario.id },
    select: {
      clientesPermitidos: { where: { id: clienteId }, select: { id: true } },
      gerencias: {
        where: { gerencia: { ativa: true, carteira: { some: { clienteId } } } },
        select: { gerenciaId: true },
      },
    },
  })
  return decidirEdicao({
    ehAdmin: false,
    membroDaGerenciaDoCliente: (registro?.gerencias ?? []).length > 0,
    liberadoNoModeloAntigo: (registro?.clientesPermitidos ?? []).some((c) => c.id === clienteId),
  })
}
