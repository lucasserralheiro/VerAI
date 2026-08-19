import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashSenha } from '@/lib/auth'

export async function GET() {
  const usuarios = await prisma.usuario.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      createdAt: true,
      clientesPermitidos: { select: { id: true, nome: true } },
    },
  })
  return NextResponse.json(usuarios)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const { nome, email, senha, role } = body ?? {}

  if (
    typeof nome !== 'string' ||
    !nome ||
    typeof email !== 'string' ||
    !email ||
    typeof senha !== 'string' ||
    !senha ||
    !['uploader', 'responsavel', 'admin'].includes(role)
  ) {
    return NextResponse.json(
      { error: 'nome, email, senha e role (uploader|responsavel|admin) são obrigatórios' },
      { status: 400 }
    )
  }

  const senhaHash = await hashSenha(senha)
  const usuario = await prisma.usuario.create({
    data: { nome, email, senhaHash, role },
    select: { id: true, nome: true, email: true, role: true, createdAt: true },
  })

  return NextResponse.json(usuario, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const id = body?.id
  if (typeof id !== 'string') {
    return NextResponse.json({ error: '"id" é obrigatório' }, { status: 400 })
  }

  const { nome, email, role, senha, clientesPermitidos } = body

  const usuario = await prisma.usuario.update({
    where: { id },
    data: {
      ...(nome ? { nome } : {}),
      ...(email ? { email } : {}),
      ...(role ? { role } : {}),
      ...(senha ? { senhaHash: await hashSenha(senha) } : {}),
      ...(Array.isArray(clientesPermitidos)
        ? { clientesPermitidos: { set: clientesPermitidos.map((clienteId: string) => ({ id: clienteId })) } }
        : {}),
    },
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      createdAt: true,
      clientesPermitidos: { select: { id: true, nome: true } },
    },
  })

  return NextResponse.json(usuario)
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: '"id" é obrigatório' }, { status: 400 })
  }

  await prisma.usuario.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
