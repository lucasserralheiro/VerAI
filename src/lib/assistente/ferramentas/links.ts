import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { podeVerCliente } from '@/lib/visibilidade'
import { linksDoContrato } from '@/lib/links-mpls/consultas'
import { nomeDaCompetencia, ROTULO_CATEGORIA, type RelatorioDoContrato } from '@/lib/links-mpls/tipos'
import { definirFerramenta, NAO_ENCONTRADO } from './comum'

// Links MPLS (spec 2026-09-29-links-mpls). Número só de relatório conferido; sem prova fica fora das contas.

const MAX_CODIGOS = 20
const codigos = (ls: { codigo: string }[]) => (ls.length > MAX_CODIGOS ? `${ls.slice(0, MAX_CODIGOS).map((l) => l.codigo).join(', ')} e mais ${ls.length - MAX_CODIGOS}` : ls.map((l) => l.codigo).join(', ') || 'nenhum')

const doRelatorio = (r: RelatorioDoContrato) =>
  r.conferido && r.ativos !== null
    ? { categoria: ROTULO_CATEGORIA[r.categoria], ativos: r.ativos, entraram: r.entraram === null ? 'sem mês anterior conferido' : codigos(r.entraramLinks), sairam: r.sairam === null ? 'sem mês anterior conferido' : codigos(r.sairamLinks) }
    : { categoria: ROTULO_CATEGORIA[r.categoria], leitura: 'sem prova — fora das contas; confira no PDF' }

export const linksMpls = definirFerramenta({
  descricao:
    'Links MPLS (rede de dados) do relatório mensal de faturamento: quantos links ativos por contrato e categoria, e quais códigos entraram e saíram em relação ao mês anterior. Informe contratoId ou clienteId; competência AAAA-MM opcional (padrão: a mais recente).',
  entrada: z
    .object({ contratoId: z.string().optional(), clienteId: z.string().optional(), competencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() })
    .refine((e) => e.contratoId || e.clienteId, 'informe contratoId ou clienteId'),
  async executar({ contratoId, clienteId, competencia }, { usuario }) {
    let contratos: { id: string; numeroTermo: string | null }[]
    if (contratoId) {
      const c = await prisma.contrato.findUnique({ where: { id: contratoId }, select: { id: true, clienteId: true, numeroTermo: true } })
      if (!c || !(await podeVerCliente(usuario, c.clienteId))) return NAO_ENCONTRADO
      contratos = [c]
    } else {
      if (!(await podeVerCliente(usuario, clienteId!))) return NAO_ENCONTRADO
      contratos = await prisma.contrato.findMany({ where: { clienteId }, select: { id: true, numeroTermo: true } })
    }
    const lidos = await Promise.all(contratos.map(async (c) => ({ c, l: await linksDoContrato(c.id, competencia) })))
    const comLinks = lidos.filter(({ l }) => l.relatorios.length > 0)
    if (comLinks.length === 0) return { erro: 'nenhum relatório de links MPLS lido para este contrato ou cliente' }
    // Cada contrato vem do seu mês mais recente (ou do pedido, se existir nele): o mês vai em cada item.
    const itens = comLinks.map(({ c, l }) => {
      const mes = l.competencia ? nomeDaCompetencia(l.competencia) : null
      if (competencia && l.competencia !== competencia) return { item: { contrato: c.numeroTermo, competencia: mes, aviso: `sem relatório em ${nomeDaCompetencia(competencia)}` }, numerico: null }
      return { item: { contrato: c.numeroTermo, competencia: mes, relatorios: l.relatorios.map(doRelatorio) }, numerico: { mes: l.competencia, relatorios: l.relatorios } }
    })
    const comNumero = itens.flatMap((i) => (i.numerico ? [i.numerico] : []))
    const meses = new Set(comNumero.map((n) => n.mes))
    const mesmoMes = meses.size <= 1
    const total = comNumero.flatMap((n) => n.relatorios).reduce((s, r) => s + (r.conferido && r.ativos !== null ? r.ativos : 0), 0)
    const topo = [...new Set(itens.map((i) => i.item.competencia))]
    return {
      competencia: topo.length === 1 ? topo[0] : null,
      contratos: itens.map((i) => i.item),
      ...(mesmoMes ? { totalAtivosConferidos: total } : { aviso: 'contratos em meses diferentes — sem total' }),
    }
  },
})
