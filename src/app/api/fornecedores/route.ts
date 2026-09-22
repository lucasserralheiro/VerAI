import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { ROTULOS_FORNECEDOR, SELECT_FORNECEDOR, esquemaFornecedor } from './esquema'

// Fornecedor não pertence a cliente: as rotas exigem só autenticação.

export async function GET(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const q = request.nextUrl.searchParams.get('q')?.trim()
  const where: Prisma.FornecedorWhereInput = q
    ? {
        OR: [
          { razaoSocial: { contains: q, mode: 'insensitive' } },
          { cnpj: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {}

  const fornecedores = await prisma.fornecedor.findMany({
    where,
    orderBy: { razaoSocial: 'asc' },
    select: {
      ...SELECT_FORNECEDOR,
      _count: { select: { contratosOperacionalizacao: true, termosConfirmacao: true } },
    },
  })
  return NextResponse.json(
    fornecedores.map(({ _count, ...fornecedor }) => ({
      ...fornecedor,
      totalCos: _count.contratosOperacionalizacao,
      totalTermos: _count.termosConfirmacao,
    }))
  )
}

export async function POST(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const corpo = await lerCorpo(request, esquemaFornecedor, ROTULOS_FORNECEDOR)
  if ('erro' in corpo) return corpo.erro

  const fornecedor = await prisma.fornecedor.create({ data: corpo.dados, select: SELECT_FORNECEDOR })
  return NextResponse.json(fornecedor, { status: 201 })
}
