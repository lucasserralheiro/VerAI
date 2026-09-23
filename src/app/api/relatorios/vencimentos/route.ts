import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { clientesVisiveisWhere } from '@/lib/visibilidade'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { saldosDosContratos } from '@/lib/relatorios-clientes/saldos-contratos'
import { contratoAtivo } from '@/lib/relatorios-clientes/regras'
import { SELECT_CONTRATO, serializarContrato } from '@/app/api/contratos/esquema'

/** Contratos de todos os clientes visíveis, os que vencem primeiro no topo (sem data por último).
 *  Cada linha traz `vencimento` (semáforo), `saldo` e `ativo` — a tela filtra os ativos. */
export async function GET(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const contratos = await prisma.contrato.findMany({
    where: { cliente: await clientesVisiveisWhere(autenticado.usuario) },
    orderBy: [{ dataVencimento: { sort: 'asc', nulls: 'last' } }, { numeroTermo: 'asc' }],
    select: { ...SELECT_CONTRATO, cliente: { select: { id: true, nome: true, siglaLegado: true } } },
  })
  const saldos = await saldosDosContratos(contratos.map((contrato) => contrato.id))
  const hoje = new Date()
  return NextResponse.json(
    contratos.map(({ cliente, ...contrato }) => ({
      ...serializarContrato(contrato, saldos.get(contrato.id)!, hoje),
      cliente,
      ativo: contratoAtivo(contrato, hoje),
    }))
  )
}
