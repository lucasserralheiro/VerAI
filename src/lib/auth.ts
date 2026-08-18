import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import type { NextRequest } from 'next/server'
import { prisma } from './prisma'

export const AUTH_COOKIE_NAME = 'token-verai'

function getSecretKey() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET não configurado')
  return new TextEncoder().encode(secret)
}

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 10)
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash)
}

export type Role = 'uploader' | 'responsavel' | 'admin'

export interface SessaoPayload {
  id: string
  role: Role
  [key: string]: unknown
}

export async function criarSessao(payload: SessaoPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getSecretKey())
}

export async function verificarSessao(token: string): Promise<SessaoPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    if (typeof payload.id !== 'string' || typeof payload.role !== 'string') return null
    return { id: payload.id, role: payload.role as Role }
  } catch {
    return null
  }
}

export interface AuthUser {
  id: string
  nome: string
  email: string
  role: Role
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
  if (!token) return null

  const sessao = await verificarSessao(token)
  if (!sessao) return null

  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.id },
    select: { id: true, nome: true, email: true, role: true },
  })
  if (!usuario) return null

  return usuario as AuthUser
}
