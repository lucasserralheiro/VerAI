import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { lerCorpo, textoObrigatorio, textoOpcional } from '@/lib/relatorios-clientes/validacao'
import { esquemaResponsavel } from '@/app/api/responsaveis/esquema'

export async function GET() {
  const clientes = await prisma.cliente.findMany({
    orderBy: { nome: 'asc' },
    select: {
      id: true,
      nome: true,
      createdAt: true,
      _count: { select: { documentos: true } },
    },
  })
  return NextResponse.json(clientes)
}

const esquemaNovoCliente = z.object({
  nome: textoObrigatorio,
  siglaLegado: textoOpcional.transform((sigla) => (sigla ? sigla.toUpperCase() : sigla)),
  endereco: textoOpcional,
  numero: textoOpcional,
  bairro: textoOpcional,
  responsaveis: z.array(esquemaResponsavel).optional(),
})

export async function POST(request: NextRequest) {
  const corpo = await lerCorpo(request, esquemaNovoCliente, { siglaLegado: 'Sigla', nome: 'Nome' })
  if ('erro' in corpo) return corpo.erro
  const { responsaveis, ...dadosCliente } = corpo.dados

  try {
    // Cliente + responsáveis numa criação só (nested write): ou entra tudo, ou nada.
    const cliente = await prisma.cliente.create({
      data: {
        ...dadosCliente,
        ...(responsaveis?.length ? { responsaveis: { create: responsaveis } } : {}),
      },
      select: { id: true, nome: true, siglaLegado: true, createdAt: true },
    })
    return NextResponse.json(cliente, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'já existe um cliente com esse nome ou sigla' }, { status: 409 })
    }
    throw error
  }
}
