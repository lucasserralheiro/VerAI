import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { clientesVisiveisWhere } from '@/lib/visibilidade'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { saldosDosContratos } from '@/lib/relatorios-clientes/saldos-contratos'
import { calcularSaldo } from '@/lib/relatorios-clientes/saldo'
import { contratoAtivo } from '@/lib/relatorios-clientes/regras'

/** Por cliente visível: nº de contratos (e quantos ativos), soma dos itens vinculados, faturado
 *  (notas fiscais) e saldo — o mesmo cálculo do contrato, somado. */
export async function GET(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const clientes = await prisma.cliente.findMany({
    where: await clientesVisiveisWhere(autenticado.usuario),
    orderBy: { nome: 'asc' },
    select: {
      id: true,
      nome: true,
      siglaLegado: true,
      contratos: { select: { id: true, situacao: true, dataVencimento: true } },
    },
  })
  const saldos = await saldosDosContratos(clientes.flatMap((cliente) => cliente.contratos.map((c) => c.id)))
  const hoje = new Date()

  return NextResponse.json(
    clientes.map(({ contratos, ...cliente }) => {
      let valorItens = new Prisma.Decimal(0)
      let faturado = new Prisma.Decimal(0)
      for (const contrato of contratos) {
        const saldo = saldos.get(contrato.id)!
        valorItens = valorItens.plus(saldo.valorItens)
        faturado = faturado.plus(saldo.faturado)
      }
      return {
        ...cliente,
        contratos: contratos.length,
        contratosAtivos: contratos.filter((contrato) => contratoAtivo(contrato, hoje)).length,
        saldo: calcularSaldo({ valorItens, faturado }),
      }
    })
  )
}
