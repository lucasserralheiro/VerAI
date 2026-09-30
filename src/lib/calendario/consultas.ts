import { prisma } from '@/lib/prisma'
import { hojeEmBrasilia, proximosPrazos, type DataSerializada, type ProximoPrazo, type TipoDataFaturamento } from './tipos'

// Consultas do calendário de faturamento (spec 2026-09-29-calendario-faturamento §7). É de todos os usuários.

const serializar = (d: { inicio: Date; fim: Date; tipo: string; descricao: string }): DataSerializada => ({
  inicio: d.inicio.toISOString(),
  fim: d.fim.toISOString(),
  tipo: d.tipo as TipoDataFaturamento,
  descricao: d.descricao,
})

export async function calendarioDoAno(ano?: number) {
  const anos = (await prisma.calendarioFaturamento.findMany({ select: { ano: true }, orderBy: { ano: 'desc' } })).map((c) => c.ano)
  const atual = hojeEmBrasilia().getUTCFullYear()
  const escolhido = ano && anos.includes(ano) ? ano : anos.includes(atual) ? atual : (anos[0] ?? null)
  if (escolhido === null) return { anos, ano: null, anoAtualSemCalendario: true, calendario: null, datas: [] as DataSerializada[] }
  const c = await prisma.calendarioFaturamento.findUnique({ where: { ano: escolhido }, include: { datas: { orderBy: { inicio: 'asc' } } } })
  return {
    anos,
    ano: escolhido,
    anoAtualSemCalendario: !anos.includes(atual),
    calendario: c ? { status: c.status as 'ok' | 'so-feriados', avisos: Array.isArray(c.avisos) ? (c.avisos as string[]) : [], arquivoId: c.arquivoId, lidoEm: c.lidoEm.toISOString() } : null,
    datas: (c?.datas ?? []).map(serializar),
  }
}

/** Próximos prazos de todos os calendários com prova (atravessa a virada do ano). */
export async function proximosDoFaturamento(n = 3, agora: Date = new Date()): Promise<ProximoPrazo[]> {
  const hoje = hojeEmBrasilia(agora)
  const datas = await prisma.dataFaturamento.findMany({
    where: { fim: { gte: new Date(hoje.getTime() - 400 * 86_400_000) }, calendario: { status: 'ok' } },
    orderBy: { inicio: 'asc' },
  })
  return proximosPrazos(datas.map(serializar), hoje, n)
}
