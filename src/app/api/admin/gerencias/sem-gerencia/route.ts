import { NextRequest, NextResponse } from 'next/server'
import { exigirAdmin } from '@/lib/relatorios-clientes/acesso'
import { clientesSemGerencia } from '@/lib/gerencias/servico'

export async function GET(request: NextRequest) {
  const admin = await exigirAdmin(request)
  if ('erro' in admin) return admin.erro
  return NextResponse.json(await clientesSemGerencia())
}
