import type { AuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { podeVerCliente } from '@/lib/visibilidade'

export interface RotaInterpretada {
  clienteId?: string
  contratoId?: string
  faturamentoId?: string
  demandaId?: string
}

export function interpretarRota(pathname: string): RotaInterpretada {
  const cliente = /^\/clientes\/([^/?#]+)(?:\/(contratos|faturamentos)\/([^/?#]+))?/.exec(pathname)
  if (cliente && cliente[1] !== 'novo') {
    const rota: RotaInterpretada = { clienteId: cliente[1] }
    if (cliente[2] === 'contratos') rota.contratoId = cliente[3]
    if (cliente[2] === 'faturamentos') rota.faturamentoId = cliente[3]
    return rota
  }
  const demanda = /^\/demandas\/([^/?#]+)/.exec(pathname)
  if (demanda) return { demandaId: demanda[1] }
  return {}
}

/** Texto curto que vai junto com a pergunta (não no system, pra não quebrar o cache) + o rótulo
 *  do chip no painel. `null` quando a tela não tem cliente/contrato ou o usuário não pode vê-lo. */
export async function descreverContexto(
  rota: RotaInterpretada,
  usuario: AuthUser
): Promise<{ texto: string; rotulo: string } | null> {
  const partesTexto: string[] = []
  const partesRotulo: string[] = []

  if (rota.demandaId) {
    const demanda = await prisma.demanda.findUnique({
      where: { id: rota.demandaId },
      select: { assunto: true, clienteId: true, cliente: { select: { nome: true } } },
    })
    if (!demanda || !(await podeVerCliente(usuario, demanda.clienteId))) return null
    partesTexto.push(`cliente ${demanda.cliente.nome} (clienteId: ${demanda.clienteId})`, `demanda "${demanda.assunto ?? 'sem assunto'}" (demandaId: ${rota.demandaId})`)
    partesRotulo.push(demanda.cliente.nome, `Demanda ${demanda.assunto ?? ''}`.trim())
  } else if (rota.clienteId) {
    if (!(await podeVerCliente(usuario, rota.clienteId))) return null
    const cliente = await prisma.cliente.findUnique({ where: { id: rota.clienteId }, select: { nome: true } })
    if (!cliente) return null
    partesTexto.push(`cliente ${cliente.nome} (clienteId: ${rota.clienteId})`)
    partesRotulo.push(cliente.nome)
    if (rota.contratoId) {
      const contrato = await prisma.contrato.findUnique({ where: { id: rota.contratoId }, select: { numeroTermo: true, clienteId: true } })
      if (contrato && contrato.clienteId === rota.clienteId) {
        partesTexto.push(`contrato ${contrato.numeroTermo ?? 'sem número'} (contratoId: ${rota.contratoId})`)
        partesRotulo.push(`Contrato ${contrato.numeroTermo ?? ''}`.trim())
      }
    }
    if (rota.faturamentoId) {
      const faturamento = await prisma.faturamento.findUnique({
        where: { id: rota.faturamentoId },
        select: { competenciaAno: true, competenciaMes: true, clienteId: true, contratoId: true },
      })
      if (faturamento && faturamento.clienteId === rota.clienteId) {
        const comp = `${String(faturamento.competenciaMes ?? 0).padStart(2, '0')}/${faturamento.competenciaAno ?? ''}`
        partesTexto.push(`faturamento da competência ${comp} (faturamentoId: ${rota.faturamentoId}, contratoId: ${faturamento.contratoId})`)
        partesRotulo.push(`Faturamento ${comp}`)
      }
    }
  } else {
    return null
  }

  return {
    rotulo: partesRotulo.join(' › '),
    texto: `Tela aberta pelo usuário: ${partesTexto.join('; ')}. Quando a pergunta disser "este cliente", "este contrato" ou similar, é deste.`,
  }
}
