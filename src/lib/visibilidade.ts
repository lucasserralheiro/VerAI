import type { Documento, Prisma } from '@prisma/client'
import { prisma } from './prisma'
import type { AuthUser } from './auth'

async function regrasQueBatemComUsuario(email: string) {
  const regras = await prisma.regraNotificacao.findMany()
  return regras.filter((regra) => {
    const lista = Array.isArray(regra.destinatarios) ? (regra.destinatarios as unknown[]) : []
    return lista.includes(email)
  })
}

export async function documentosVisiveisWhere(usuario: AuthUser): Promise<Prisma.DocumentoWhereInput> {
  if (usuario.role === 'admin') return {}
  if (usuario.role === 'uploader') return { uploadedById: usuario.id }

  const regras = await regrasQueBatemComUsuario(usuario.email)
  const tipos = regras.filter((r) => r.criterioTipo === 'tipoDocumento').map((r) => r.criterioValor)
  const palavras = regras.filter((r) => r.criterioTipo === 'palavraChaveNome').map((r) => r.criterioValor)

  const OR: Prisma.DocumentoWhereInput[] = [{ uploadedById: usuario.id }]
  if (tipos.length > 0) OR.push({ tipo: { in: tipos } })
  for (const palavra of palavras) {
    OR.push({ nomeArquivo: { contains: palavra, mode: 'insensitive' } })
  }
  return { OR }
}

export async function podeVerDocumento(usuario: AuthUser, documento: Documento): Promise<boolean> {
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
