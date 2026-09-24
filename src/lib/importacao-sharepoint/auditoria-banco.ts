import type { PrismaClient } from '@prisma/client'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { auditarContratos, type Achado } from './auditoria'

// Junta do banco o que a auditoria (auditoria.ts) precisa, passando pelo MESMO consolidado das telas
// (ativo, vigência, valor) — nada de recalcular contrato por conta própria (CLAUDE.md, "regra única").

export async function auditarNoBanco(db: PrismaClient, clienteIds: string[], hoje: Date = new Date()): Promise<Achado[]> {
  if (clienteIds.length === 0) return []
  const contratos = await db.contrato.findMany({
    where: { clienteId: { in: clienteIds } },
    select: {
      id: true,
      numeroTermo: true,
      situacao: true,
      dataVencimento: true,
      cliente: { select: { siglaLegado: true } },
      historico: { select: { tipo: true, numero: true } },
    },
  })
  const consolidados = await consolidarContratos(contratos, hoje)
  return auditarContratos(
    contratos.map((c) => {
      const k = consolidados.get(c.id)
      return {
        cliente: c.cliente.siglaLegado ?? '?',
        numeroTermo: c.numeroTermo,
        situacao: c.situacao,
        ativo: k?.ativo ?? false,
        vazio: k?.vazio ?? false,
        vigenciaFim: k?.vigenciaFim ?? null,
        valorBase: k?.valorBase ?? null,
        linhas: c.historico,
      }
    }),
    hoje
  )
}
