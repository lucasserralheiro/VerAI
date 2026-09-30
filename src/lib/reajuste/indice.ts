// Sincroniza a série do Banco Central com a tabela IndiceIpcFipe (spec §1.3). Nunca sobrescreve em
// silêncio: mês gravado com valor diferente vira divergência pra decisão humana.
import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { dataParaMes, mesParaData } from './meses'
import { URL_SERIE_IPC_FIPE, buscarSerieIpcFipe, type MesDoIndice } from './serie-bcb'

export interface Divergencia {
  mes: string
  gravado: string
  fonte: string
}

const limpo = (valor: string) => new Decimal(valor).toString()

export function compararComGravados(fonte: MesDoIndice[], gravados: Map<string, string>) {
  const novos: MesDoIndice[] = []
  const confirmados: string[] = []
  const divergentes: Divergencia[] = []
  for (const item of fonte) {
    const gravado = gravados.get(item.mes)
    if (gravado === undefined) novos.push(item)
    else if (new Decimal(gravado).eq(item.variacao)) confirmados.push(item.mes)
    else divergentes.push({ mes: item.mes, gravado: limpo(gravado), fonte: limpo(item.variacao) })
  }
  return { novos, confirmados, divergentes }
}

export async function sincronizarIpcFipe(deps: { buscar?: () => Promise<MesDoIndice[]>; agora?: Date } = {}) {
  const buscar = deps.buscar ?? (() => buscarSerieIpcFipe())
  const agora = deps.agora ?? new Date()
  const fonte = await buscar()
  const linhas = await prisma.indiceIpcFipe.findMany({ select: { mes: true, variacao: true } })
  const gravados = new Map(linhas.map((l) => [dataParaMes(l.mes), l.variacao.toString()]))
  const { novos, confirmados, divergentes } = compararComGravados(fonte, gravados)

  if (novos.length > 0) {
    await prisma.indiceIpcFipe.createMany({
      data: novos.map((n) => ({ mes: mesParaData(n.mes), variacao: n.variacao, fonte: URL_SERIE_IPC_FIPE, buscadoEm: agora })),
      skipDuplicates: true,
    })
  }
  if (confirmados.length > 0) {
    await prisma.indiceIpcFipe.updateMany({ where: { mes: { in: confirmados.map(mesParaData) } }, data: { buscadoEm: agora } })
  }
  return { novos: novos.length, confirmados: confirmados.length, divergentes }
}

export async function lerIndiceGravado() {
  const [linhas, maximo] = await Promise.all([
    prisma.indiceIpcFipe.findMany({ orderBy: { mes: 'asc' }, select: { mes: true, variacao: true } }),
    prisma.indiceIpcFipe.aggregate({ _max: { buscadoEm: true } }),
  ])
  return {
    meses: linhas.map((l) => ({ mes: dataParaMes(l.mes), variacao: limpo(l.variacao.toString()) })),
    atualizadoEm: maximo._max.buscadoEm?.toISOString() ?? null,
  }
}
