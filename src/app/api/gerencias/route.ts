import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'

/** Gerências ativas (id, nome, sigla) para o seletor de carteira da área "Relatórios dos clientes". Leitura
 *  para qualquer usuário logado — todos veem todos os clientes; a gestão das gerências continua no /admin. */
export async function GET(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  const gerencias = await prisma.gerencia.findMany({
    where: { ativa: true },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, sigla: true },
  })
  return NextResponse.json(gerencias)
}
