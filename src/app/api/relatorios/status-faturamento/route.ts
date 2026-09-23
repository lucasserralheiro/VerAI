import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { clientesVisiveisWhere } from '@/lib/visibilidade'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { ANO, MES, resumoDasNotas } from '@/app/api/faturamentos/esquema'

/** `?ano=&mes=` (obrigatórios): para cada contrato ativo — ou que tenha faturamento na competência —
 *  os faturamentos daquele mês, com valor (o do faturamento ou a soma das notas) e envio
 *  cliente/GFP. Contrato ativo sem faturamento vem com a lista vazia: é o "faltou faturar". */
export async function GET(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const params = request.nextUrl.searchParams
  const ano = ANO.safeParse(params.get('ano') ?? '')
  if (!ano.success) return NextResponse.json({ error: `Ano: ${ano.error.issues[0].message}` }, { status: 400 })
  const mes = MES.safeParse(params.get('mes') ?? '')
  if (!mes.success) return NextResponse.json({ error: `Mês: ${mes.error.issues[0].message}` }, { status: 400 })

  const contratos = await prisma.contrato.findMany({
    where: { cliente: await clientesVisiveisWhere(autenticado.usuario) },
    orderBy: [{ cliente: { nome: 'asc' } }, { numeroTermo: 'asc' }],
    select: {
      id: true,
      numeroTermo: true,
      descricao: true,
      situacao: true,
      dataVencimento: true,
      cliente: { select: { id: true, nome: true, siglaLegado: true } },
      faturamentos: {
        where: { competenciaAno: ano.data, competenciaMes: mes.data },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          valor: true,
          situacao: true,
          sei: true,
          complementar: true,
          enviadoCliente: true,
          enviadoGfp: true,
        },
      },
    },
  })

  const consolidados = await consolidarContratos(contratos, new Date())
  const relevantes = contratos.filter((contrato) => contrato.faturamentos.length > 0 || consolidados.get(contrato.id)!.ativo)
  const resumos = await resumoDasNotas(relevantes.flatMap((contrato) => contrato.faturamentos.map((f) => f.id)))

  return NextResponse.json(
    relevantes.map(({ faturamentos, situacao, dataVencimento, ...contrato }) => ({
      ...contrato,
      faturamentos: faturamentos.map(({ valor, ...faturamento }) => ({
        ...faturamento,
        valorExibido: valor?.toString() ?? resumos.get(faturamento.id)?.valorNotas ?? '0',
        semNota: valor === null && !resumos.has(faturamento.id),
      })),
    }))
  )
}
