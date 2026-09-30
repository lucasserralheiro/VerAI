import { z } from 'zod'
import { calendarioDoAno, proximosDoFaturamento } from '@/lib/calendario/consultas'
import { quandoTexto, ROTULO_TIPO, type DataSerializada } from '@/lib/calendario/tipos'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import { definirFerramenta } from './comum'

// Calendário de faturamento (spec 2026-09-29-calendario-faturamento). Público: não filtra por cliente.

const datas = (d: DataSerializada) => ({ tipo: ROTULO_TIPO[d.tipo], descricao: d.descricao, inicio: formatarData(d.inicio), fim: formatarData(d.fim) })

export const calendarioFaturamento = definirFerramenta({
  descricao:
    'Calendário de faturamento da PRODAM: prazos (encerramento/fechamento do faturamento, emissão de NFS-e ou nota, envio do relatório, recebimento de contratos e de processos SEI) e feriados. Sem mês: os próximos prazos a partir de hoje, com dias corridos e úteis ("quando fecha?", "até quando mando a nota?", "qual o próximo prazo?"). Com mês (AAAA-MM): todas as datas daquele mês.',
  entrada: z.object({
    mes: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('mês AAAA-MM; omita para os próximos prazos'),
    quantos: z.number().int().min(1).max(15).default(5).describe('quantos próximos prazos (padrão 5)'),
  }),
  async executar({ mes, quantos }, { hoje }) {
    if (!mes) {
      const proximos = await proximosDoFaturamento(quantos, hoje)
      if (proximos.length === 0) return { erro: 'nenhum prazo futuro no calendário de faturamento lido' }
      return { proximos: proximos.map((p) => ({ ...datas(p), quando: quandoTexto(p), diasUteis: p.emDiasUteis })) }
    }
    const [ano, m] = mes.split('-').map(Number)
    const c = await calendarioDoAno(ano)
    if (c.ano !== ano || !c.calendario) return { erro: `o calendário de faturamento de ${ano} ainda não foi lido` }
    return {
      mes: `${String(m).padStart(2, '0')}/${ano}`,
      status: c.calendario.status,
      avisos: c.calendario.avisos,
      datas: c.datas.filter((d) => d.inicio.slice(0, 7) === mes || d.fim.slice(0, 7) === mes).map(datas),
    }
  },
})
