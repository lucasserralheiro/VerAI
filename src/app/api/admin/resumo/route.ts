import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirAdmin } from '@/lib/relatorios-clientes/acesso'

export async function GET(request: NextRequest) {
  const admin = await exigirAdmin(request)
  if ('erro' in admin) return admin.erro
  const [usuarios, gerencias, clientes, semGerencia] = await Promise.all([
    prisma.usuario.count(),
    prisma.gerencia.count({ where: { ativa: true } }),
    prisma.cliente.count(),
    prisma.cliente.count({ where: { carteira: null } }),
  ])
  return NextResponse.json({ usuarios, gerencias, clientes, semGerencia })
}
