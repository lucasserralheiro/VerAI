import { prisma } from '@/lib/prisma'
import { auditarNoBanco } from '@/lib/importacao-sharepoint/auditoria-banco'
import { ROTULO_ACHADO, type Achado } from '@/lib/importacao-sharepoint/auditoria'
import { consolidarContratos } from './contratos-consolidados'
import { linhaAssinada } from './regras'
import { alertasDoContrato, competenciasEncerradas, LIMIARES, ordenarAlertas, type Alerta } from './alertas'

// Junta do banco o que as regras de `alertas.ts` precisam, passando pelo MESMO consolidado das telas.

interface ContratoDoAlerta {
  id: string
  clienteId: string
  cliente: string
  /** Chave da auditoria: sigla (ou "?") | número do termo (ou "(sem número)"). */
  chaveAuditoria: string
  contrato: string | null
}

/** Achados da auditoria das contas como alertas. `ativo-sem-valor` fica de fora: a regra própria já cobre. */
export function alertasDaAuditoria(achados: Achado[], contratos: ContratoDoAlerta[]): Alerta[] {
  const porChave = new Map(contratos.map((c) => [c.chaveAuditoria, c]))
  const alertas: Alerta[] = []
  for (const a of achados) {
    if (a.tipo === 'ativo-sem-valor') continue
    const c = porChave.get(`${a.cliente}|${a.contrato}`)
    if (!c) continue
    alertas.push({
      codigo: `cadastro-${a.tipo}`,
      nivel: 'atencao',
      clienteId: c.clienteId,
      cliente: c.cliente,
      contratoId: c.id,
      contrato: c.contrato,
      titulo: ROTULO_ACHADO[a.tipo],
      detalhe: a.detalhe,
      acao: 'Revisar o cadastro do contrato.',
      temaManual: null,
      dias: null,
    })
  }
  return alertas
}

const TIPOS_COM_TERMO = new Set(['CONTRATO', 'ADITIVO', 'PRORROGACAO'])

/** Alertas dos contratos visíveis (`clienteIds` null = todos), já em ordem de prioridade. */
export async function alertasDosContratos(
  filtro: { clienteIds: string[] | null; clienteId?: string; contratoId?: string },
  hoje: Date
): Promise<Alerta[]> {
  const contratos = await prisma.contrato.findMany({
    where: {
      AND: [
        filtro.clienteIds === null ? {} : { clienteId: { in: filtro.clienteIds } },
        filtro.clienteId ? { clienteId: filtro.clienteId } : {},
        filtro.contratoId ? { id: filtro.contratoId } : {},
      ],
    },
    select: {
      id: true,
      clienteId: true,
      numeroTermo: true,
      situacao: true,
      dataVencimento: true,
      cliente: { select: { siglaLegado: true, nome: true } },
      historico: { select: { id: true, tipo: true, data: true, situacao: true, termoArquivoId: true } },
    },
  })
  if (contratos.length === 0) return []
  const ids = contratos.map((c) => c.id)
  const janela = competenciasEncerradas(hoje, LIMIARES.janelaCompetencias + 1)
  const [consolidados, faturamentos, semTexto, achados] = await Promise.all([
    consolidarContratos(contratos, hoje),
    prisma.faturamento.findMany({
      where: { contratoId: { in: ids }, OR: janela.map((c) => ({ competenciaAno: c.ano, competenciaMes: c.mes })) },
      select: { contratoId: true, competenciaAno: true, competenciaMes: true, valor: true, situacao: true, enviadoCliente: true, enviadoGfp: true, createdAt: true },
    }),
    prisma.indiceDocumento.findMany({
      where: { origem: 'HISTORICO_TERMO', status: 'sem_texto', origemId: { in: contratos.flatMap((c) => c.historico.map((h) => h.id)) } },
      select: { origemId: true },
    }),
    auditarNoBanco(prisma, [...new Set(contratos.map((c) => c.clienteId))], hoje),
  ])
  const linhasSemTexto = new Set(semTexto.map((i) => i.origemId))

  const identidades: ContratoDoAlerta[] = contratos.map((c) => ({
    id: c.id,
    clienteId: c.clienteId,
    cliente: c.cliente.siglaLegado ?? c.cliente.nome,
    chaveAuditoria: `${c.cliente.siglaLegado ?? '?'}|${c.numeroTermo ?? '(sem número)'}`,
    contrato: c.numeroTermo,
  }))
  const alertas = contratos.flatMap((c, i) => {
    const consolidado = consolidados.get(c.id)
    if (!consolidado) return []
    return alertasDoContrato(
      {
        clienteId: c.clienteId,
        cliente: identidades[i].cliente,
        contratoId: c.id,
        contrato: c.numeroTermo,
        consolidado,
        faturamentos: faturamentos
          .filter((f) => f.contratoId === c.id)
          .map((f) => ({ ...f, valor: f.valor === null ? null : f.valor.toString() })),
        termosAssinadosSemPdf: c.historico.filter((h) => TIPOS_COM_TERMO.has(h.tipo) && linhaAssinada(h) && !h.termoArquivoId).length,
        termosSemTexto: c.historico.filter((h) => linhasSemTexto.has(h.id)).length,
      },
      hoje
    )
  })
  return ordenarAlertas([...alertas, ...alertasDaAuditoria(achados, identidades)])
}
