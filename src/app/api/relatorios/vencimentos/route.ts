import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { clientesVisiveisWhere } from '@/lib/visibilidade'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
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
  const hoje = new Date()
  const consolidados = await consolidarContratos(contratos, hoje)
  // A ordem do banco é pelo vencimento do cabeçalho; a de verdade é pela vigência efetiva.
  const fim = (id: string) => consolidados.get(id)!.vigenciaFim?.getTime() ?? Infinity
  return NextResponse.json(
    contratos
      .map(({ cliente, ...contrato }) => {
        const consolidado = consolidados.get(contrato.id)!
        return { ...serializarContrato(contrato, consolidado.saldo, hoje, consolidado), cliente, ativo: consolidado.ativo }
      })
      .sort((a, b) => fim(a.id) - fim(b.id) || (a.numeroTermo ?? '').localeCompare(b.numeroTermo ?? '', 'pt-BR'))
  )
}
