import { z } from 'zod'
import { buscarTrechos } from '@/lib/assistente/busca'
import { definirFerramenta } from './comum'
import { compactar } from './compacto'

const LIMITE_NORMAS = 8

export const buscarNasNormas = definirFerramenta({
  descricao:
    'Procura nos textos oficiais indexados (leis, decretos, regulamento interno da PRODAM) e devolve o artigo citável. Use para prazo, limite, prorrogação, reajuste, rescisão, apostilamento. Se não achar, a norma não está na base: não responda de memória.',
  entrada: z.object({ consulta: z.string().min(2).max(200).describe('palavras-chave em português, ex.: "prorrogação serviço contínuo"') }),
  async executar({ consulta }, { usuario }) {
    const trechos = await buscarTrechos({ consulta, origens: ['REFERENCIA'], limite: LIMITE_NORMAS }, usuario)
    if (trechos.length === 0) return { total: 0, trechos: [], aviso: 'Não está na base de normas do VerAI.' }
    return { total: trechos.length, trechos: trechos.map((t) => ({ norma: t.nomeArquivo, citacao: t.texto })) }
  },
  compactar(saida) {
    const r = saida as { total?: number; aviso?: string; trechos?: { citacao: string }[] }
    if (!r.trechos || r.trechos.length === 0) return compactar(saida)
    // O trecho já começa com "[<norma> — Art. N]": é o que a IA cita.
    return [`normas (total ${r.total}):`, ...r.trechos.map((t) => `"${t.citacao.replace(/\s+/g, ' ').trim()}"`)].join('\n')
  },
})
