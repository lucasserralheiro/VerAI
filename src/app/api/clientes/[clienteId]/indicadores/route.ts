import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { exigirAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { saldosDosContratos } from '@/lib/relatorios-clientes/saldos-contratos'
import { situacaoVencimento } from '@/lib/relatorios-clientes/vencimento'
import { competenciaValida, contratoAtivo, demandaAberta } from '@/lib/relatorios-clientes/regras'
import { resumoDasNotas } from '@/app/api/faturamentos/esquema'

type Contexto = { params: Promise<{ clienteId: string }> }

const DIA_MS = 24 * 60 * 60 * 1000

/** Os 4 cartões do topo da ficha do cliente: contratos ativos (+ vencendo em 30 dias), valor
 *  contratado (itens vinculados dos ativos), faturado na última competência com faturamento e
 *  demandas abertas (+ abertas há mais de 30 dias). */
export async function GET(request: NextRequest, { params }: Contexto) {
  const { clienteId } = await params
  const acesso = await exigirAcessoCliente(request, clienteId)
  if ('erro' in acesso) return acesso.erro

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: {
      contratos: { select: { id: true, situacao: true, dataVencimento: true } },
      faturamentos: { select: { id: true, competenciaAno: true, competenciaMes: true, valor: true } },
      demandas: { select: { situacao: true, dataAbertura: true, createdAt: true } },
    },
  })
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  const hoje = new Date()

  const ativos = cliente.contratos.filter((contrato) => contratoAtivo(contrato, hoje))
  const vencendoEm30Dias = ativos.filter((contrato) => {
    const { dias } = situacaoVencimento(contrato.dataVencimento, hoje)
    return dias !== null && dias <= 30
  }).length
  const saldos = await saldosDosContratos(ativos.map((contrato) => contrato.id))
  const valorContratado = ativos.reduce((soma, contrato) => soma.plus(saldos.get(contrato.id)!.valorItens), new Prisma.Decimal(0))

  const validos = cliente.faturamentos.filter((f) => competenciaValida(f.competenciaAno, f.competenciaMes))
  const chave = (f: (typeof validos)[number]) => f.competenciaAno! * 100 + f.competenciaMes!
  const ultimaChave = Math.max(...validos.map(chave))
  let faturadoUltimoMes: { ano: number; mes: number; valor: string } | null = null
  if (validos.length > 0) {
    const doMes = validos.filter((f) => chave(f) === ultimaChave)
    const resumos = await resumoDasNotas(doMes.map((f) => f.id))
    const valor = doMes.reduce(
      (soma, f) => soma.plus(f.valor ?? resumos.get(f.id)?.valorNotas ?? 0),
      new Prisma.Decimal(0)
    )
    faturadoUltimoMes = { ano: Math.floor(ultimaChave / 100), mes: ultimaChave % 100, valor: valor.toString() }
  }

  const abertas = cliente.demandas.filter((demanda) => demandaAberta(demanda.situacao))
  const abertasHaMaisDe30Dias = abertas.filter(
    (demanda) => hoje.getTime() - (demanda.dataAbertura ?? demanda.createdAt).getTime() > 30 * DIA_MS
  ).length

  return NextResponse.json({
    contratosAtivos: ativos.length,
    vencendoEm30Dias,
    valorContratado: valorContratado.toString(),
    faturadoUltimoMes,
    demandasAbertas: abertas.length,
    abertasHaMaisDe30Dias,
  })
}
