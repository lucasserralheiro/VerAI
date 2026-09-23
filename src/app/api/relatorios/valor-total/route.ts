import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { clientesVisiveisWhere } from '@/lib/visibilidade'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { calcularSaldo } from '@/lib/relatorios-clientes/saldo'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'

/** Por cliente visível: nº de contratos (e quantos ativos), valor contratado dos ativos (histórico,
 *  senão itens), faturado (notas fiscais) e saldo — a mesma regra do contrato e da ficha, somada. */
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
  const hoje = new Date()
  const consolidados = await consolidarContratos(
    clientes.flatMap((cliente) => cliente.contratos),
    hoje
  )

  return NextResponse.json(
    clientes.map(({ contratos, ...cliente }) => {
      // Mesma conta do cartão "Valor contratado" da ficha: só contratos ativos, base = histórico
      // (senão itens); contrato ativo sem valor nenhum fica fora e é contado.
      let valorContratado = new Prisma.Decimal(0)
      let faturado = new Prisma.Decimal(0)
      let ativos = 0
      let semValor = 0
      for (const contrato of contratos) {
        const consolidado = consolidados.get(contrato.id)!
        if (!consolidado.ativo) continue
        ativos++
        faturado = faturado.plus(consolidado.saldo.faturado)
        if (consolidado.valorBase === null) semValor++
        else valorContratado = valorContratado.plus(consolidado.valorBase)
      }
      return {
        ...cliente,
        contratos: contratos.length,
        contratosAtivos: ativos,
        contratosSemValor: semValor,
        saldo: calcularSaldo({ valorItens: valorContratado, faturado }),
      }
    })
  )
}
