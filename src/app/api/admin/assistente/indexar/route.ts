import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { sincronizarIndice } from '@/lib/assistente/indexacao/sincronizar'

export const maxDuration = 60

async function contagemPorStatus(): Promise<Record<string, number>> {
  const grupos = await prisma.indiceDocumento.groupBy({ by: ['status'], _count: { _all: true } })
  return Object.fromEntries(grupos.map((g) => [g.status, g._count._all]))
}

async function exigirAdmin(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  if (autenticado.usuario.role !== 'admin') return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  return null
}

export async function GET(request: NextRequest) {
  const negado = await exigirAdmin(request)
  if (negado) return negado
  return NextResponse.json({ porStatus: await contagemPorStatus() })
}

/** Uma rodada de sincronização (até 20 arquivos). A tela chama de novo enquanto `restantes > 0`. */
export async function POST(request: NextRequest) {
  const negado = await exigirAdmin(request)
  if (negado) return negado
  const resumo = await sincronizarIndice({ conferirVersao: true, limite: 20 })
  return NextResponse.json({ ...resumo, porStatus: await contagemPorStatus() })
}
