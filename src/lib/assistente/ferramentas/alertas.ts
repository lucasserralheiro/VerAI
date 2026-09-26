import { z } from 'zod'
import { clienteIdsPermitidos, podeVerCliente } from '@/lib/visibilidade'
import { alertasDosContratos } from '@/lib/relatorios-clientes/alertas-banco'
import type { Alerta, NivelAlerta } from '@/lib/relatorios-clientes/alertas'
import { definirFerramenta, NAO_ENCONTRADO } from './comum'
import { compactar, tabela } from './compacto'

const MAX_ALERTAS = 20
const ORDEM_NIVEL: NivelAlerta[] = ['critico', 'atencao', 'info']

export const alertas = definirFerramenta({
  descricao:
    'Alertas da carteira já calculados (vencimento sem prorrogação, prorrogação sem assinatura, saldo que acaba antes da vigência, faturamento não enviado ou faltando, cadastro a revisar), do mais grave ao menos grave, com o próximo passo e o tema do manual. Sem cliente, cobre toda a carteira do usuário. Use para "o que precisa de ação", risco, pendência.',
  entrada: z.object({
    clienteId: z.string().optional(),
    contratoId: z.string().optional(),
    nivelMinimo: z.enum(['critico', 'atencao', 'info']).optional().describe('mostrar só deste nível para cima'),
  }),
  async executar({ clienteId, contratoId, nivelMinimo }, { usuario, hoje }) {
    if (clienteId && !(await podeVerCliente(usuario, clienteId))) return NAO_ENCONTRADO
    const clienteIds = await clienteIdsPermitidos(usuario)
    const todos = await alertasDosContratos({ clienteIds, clienteId, contratoId }, hoje)
    const corte = nivelMinimo ? ORDEM_NIVEL.indexOf(nivelMinimo) : ORDEM_NIVEL.length - 1
    const lista = todos.filter((a) => ORDEM_NIVEL.indexOf(a.nivel) <= corte)
    const porCodigo: Record<string, number> = {}
    for (const a of lista) porCodigo[a.codigo] = (porCodigo[a.codigo] ?? 0) + 1
    return { total: lista.length, porCodigo, alertas: lista.slice(0, MAX_ALERTAS) }
  },
  compactar(saida) {
    const r = saida as { total?: number; porCodigo?: Record<string, number>; alertas?: Alerta[] }
    if (!r.alertas) return compactar(saida)
    if (r.alertas.length === 0) return 'alertas: nenhum'
    return [
      `por código: ${Object.entries(r.porCodigo ?? {}).map(([codigo, n]) => `${codigo} ${n}`).join(' · ')}`,
      tabela(
        'alertas',
        r.alertas.map((a) => ({
          nivel: a.nivel, cliente: a.cliente, contrato: a.contrato, contratoId: a.contratoId, titulo: a.titulo, detalhe: a.detalhe, acao: a.acao, tema: a.temaManual,
        })),
        { total: r.total, colunas: ['nivel', 'cliente', 'contrato', 'contratoId', 'titulo', 'detalhe', 'acao', 'tema'] }
      ),
    ].join('\n')
  },
})
