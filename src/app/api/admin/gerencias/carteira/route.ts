import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { exigirAdmin } from '@/lib/relatorios-clientes/acesso'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { moverClientes } from '@/lib/gerencias/servico'
import { comErroGerencia } from '@/lib/gerencias/resposta'

const esquema = z.object({
  clienteIds: z.array(z.string().min(1)).min(1, 'escolha ao menos um cliente'),
  gerenciaId: z.string().min(1).nullable(),
})

export async function POST(request: NextRequest) {
  const admin = await exigirAdmin(request)
  if ('erro' in admin) return admin.erro
  const corpo = await lerCorpo(request, esquema, { clienteIds: 'Clientes', gerenciaId: 'Gerência' })
  if ('erro' in corpo) return corpo.erro
  return comErroGerencia(async () => {
    const r = await moverClientes(corpo.dados.clienteIds, corpo.dados.gerenciaId, admin.usuario.id)
    return NextResponse.json(r)
  })
}
