import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { exigirAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { competenciaValida, demandaAberta } from '@/lib/relatorios-clientes/regras'
import { resumoDasNotas } from '@/app/api/faturamentos/esquema'
import { faturamentoCancelado } from '@/lib/relatorios-clientes/situacao-faturamento'

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
      faturamentos: { select: { id: true, competenciaAno: true, competenciaMes: true, valor: true, situacao: true } },
      demandas: { select: { situacao: true, dataAbertura: true, createdAt: true } },
    },
  })
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  const hoje = new Date()

  // Regra única de contrato (contratos-consolidados.ts): a mesma da aba Contratos e dos relatórios.
  const consolidados = await consolidarContratos(cliente.contratos, hoje)
  const ativos = cliente.contratos.filter((contrato) => consolidados.get(contrato.id)!.ativo)
  // Só quem ainda vai vencer: o ativo de prazo já vencido conta em `vencidos` (aviso), não aqui.
  const vencendoEm30Dias = ativos.filter((contrato) => {
    const { dias } = consolidados.get(contrato.id)!.vencimento
    return dias !== null && dias >= 0 && dias <= 30
  }).length
  // Ativos com prazo vencido = situação "Ativo" desatualizada (aviso, o contrato segue ativo).
  const vencidos = ativos.filter((contrato) => consolidados.get(contrato.id)!.situacaoDesatualizada).length
  // Valor contratado = base de cada contrato ativo. Contrato sem valor nenhum fica fora da soma e é
  // contado, pro cartão avisar em vez de mostrar R$ 0,00 como se fosse resultado.
  let semValor = 0
  let valorContratado = new Prisma.Decimal(0)
  for (const contrato of ativos) {
    const base = consolidados.get(contrato.id)!.valorBase
    if (base === null) semValor++
    else valorContratado = valorContratado.plus(base)
  }

  // Último mês faturado = a última competência COM valor (lançado ou em nota fiscal). Se nenhum mês
  // tem valor, cai na última competência lançada e avisa `semValor` — em vez de exibir R$ 0,00 como
  // se fosse resultado.
  // Cancelado não é execução cobrada (situacao-faturamento.ts): fora do "faturado no último mês".
  const validos = cliente.faturamentos.filter(
    (f) => competenciaValida(f.competenciaAno, f.competenciaMes) && !faturamentoCancelado(f.situacao)
  )
  const chave = (f: (typeof validos)[number]) => f.competenciaAno! * 100 + f.competenciaMes!
  let faturadoUltimoMes: { ano: number; mes: number; valor: string; semValor: boolean } | null = null
  if (validos.length > 0) {
    const resumos = await resumoDasNotas(validos.map((f) => f.id))
    const temValor = (f: (typeof validos)[number]) => f.valor !== null || resumos.has(f.id)
    const comValor = validos.filter(temValor)
    const base = comValor.length > 0 ? comValor : validos
    const ultimaChave = Math.max(...base.map(chave))
    const doMes = base.filter((f) => chave(f) === ultimaChave)
    const valor = doMes.reduce(
      (soma, f) => soma.plus(f.valor ?? resumos.get(f.id)?.valorNotas ?? 0),
      new Prisma.Decimal(0)
    )
    faturadoUltimoMes = {
      ano: Math.floor(ultimaChave / 100),
      mes: ultimaChave % 100,
      valor: valor.toString(),
      semValor: comValor.length === 0,
    }
  }

  const abertas = cliente.demandas.filter((demanda) => demandaAberta(demanda.situacao))
  const abertasHaMaisDe30Dias = abertas.filter(
    (demanda) => hoje.getTime() - (demanda.dataAbertura ?? demanda.createdAt).getTime() > 30 * DIA_MS
  ).length

  return NextResponse.json({
    contratosAtivos: ativos.length,
    vencendoEm30Dias,
    vencidos,
    valorContratado: valorContratado.toString(),
    contratosSemValor: semValor,
    faturadoUltimoMes,
    demandasAbertas: abertas.length,
    abertasHaMaisDe30Dias,
  })
}
