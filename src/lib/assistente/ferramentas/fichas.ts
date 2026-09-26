import type { OrigemTrecho } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { podeVerCliente } from '@/lib/visibilidade'
import { SELECAO_ANEXOS } from '@/lib/relatorios-clientes/anexos-historico'
import { ORIGENS_FICHA } from '@/lib/assistente/fichas/gerar'
import type { CampoFicha } from '@/lib/assistente/fichas/campos'
import { data, definirFerramenta, NAO_ENCONTRADO } from './comum'
import { compactar } from './compacto'

export interface FichaResumo {
  arquivo: string
  situacao: 'ok' | 'parcial' | 'sem ficha' | 'escaneado' | 'erro'
  campos: Record<string, { valor: string; pagina: number | null }>
  naoConfirmados: string[]
}

interface LinhaFichas {
  tipo: string
  numero: string | null
  assinadoEm: string
  proposta: FichaResumo | null
  termo: FichaResumo | null
}

const naoConfirmadosDe = (mensagem: string | null | undefined) =>
  mensagem?.startsWith('não confirmados: ') ? mensagem.slice('não confirmados: '.length).split(', ') : []

export const fichasDoContrato = definirFerramenta({
  descricao:
    'Fichas já lidas dos PDFs do histórico de UM contrato (proposta e termo de cada linha: objeto, valor, vigência, reajuste, garantia, multas, pagamento, medição e, em aditivo, o que mudou), com a página. Use para "o que mudou", comparar proposta × termo ou aditivos. Para o texto exato da cláusula, use buscarNosDocumentos.',
  entrada: z.object({ contratoId: z.string().min(1) }),
  async executar({ contratoId }, { usuario }) {
    const contrato = await prisma.contrato.findUnique({
      where: { id: contratoId },
      select: {
        clienteId: true,
        numeroTermo: true,
        historico: { orderBy: [{ data: 'asc' }, { createdAt: 'asc' }], select: { id: true, tipo: true, numero: true, data: true, ...SELECAO_ANEXOS } },
      },
    })
    if (!contrato || !(await podeVerCliente(usuario, contrato.clienteId))) return NAO_ENCONTRADO
    const ids = contrato.historico.map((h) => h.id)
    const [fichas, indices] = await Promise.all([
      prisma.fichaDocumento.findMany({ where: { origem: { in: ORIGENS_FICHA }, origemId: { in: ids } }, select: { origem: true, origemId: true, status: true, campos: true, mensagem: true } }),
      prisma.indiceDocumento.findMany({ where: { origem: { in: ORIGENS_FICHA }, origemId: { in: ids } }, select: { origem: true, origemId: true, status: true } }),
    ])
    const resumo = (origem: OrigemTrecho, linhaId: string, arquivo: { nome: string } | null): FichaResumo | null => {
      if (!arquivo) return null
      const ficha = fichas.find((f) => f.origem === origem && f.origemId === linhaId)
      const indice = indices.find((i) => i.origem === origem && i.origemId === linhaId)
      const situacao: FichaResumo['situacao'] =
        indice?.status === 'sem_texto' ? 'escaneado' : !ficha ? 'sem ficha' : ficha.status === 'erro' ? 'erro' : ficha.status === 'ok' ? 'ok' : 'parcial'
      const campos = Object.fromEntries(
        Object.entries((ficha?.campos ?? {}) as Record<string, CampoFicha>).map(([nome, c]) => [nome, { valor: c.valor, pagina: c.pagina }])
      )
      return { arquivo: arquivo.nome, situacao, campos, naoConfirmados: naoConfirmadosDe(ficha?.mensagem) }
    }
    const linhas: LinhaFichas[] = contrato.historico.map((h) => ({
      tipo: h.tipo,
      numero: h.numero,
      assinadoEm: data(h.data),
      proposta: resumo('HISTORICO_PROPOSTA', h.id, h.propostaArquivo),
      termo: resumo('HISTORICO_TERMO', h.id, h.termoArquivo),
    }))
    return { contrato: contrato.numeroTermo, linhas }
  },
  compactar(saida) {
    const r = saida as { contrato?: string | null; linhas?: LinhaFichas[] }
    if (!r.linhas) return compactar(saida)
    const doc = (rotulo: string, f: FichaResumo) => {
      if (f.situacao === 'escaneado' || f.situacao === 'sem ficha' || f.situacao === 'erro') return `${rotulo} ${f.arquivo}: ${f.situacao}`
      const campos = Object.entries(f.campos).map(([n, c]) => `${n} ${c.valor.replace(/\s+/g, ' ')}${c.pagina ? ` (p. ${c.pagina})` : ''}`)
      if (f.naoConfirmados.length) campos.push(`não confirmado: ${f.naoConfirmados.join(', ')}`)
      return `${rotulo} ${f.arquivo}: ${campos.join(' · ') || 'nada lido'}`
    }
    const linhas = r.linhas.flatMap((l) => {
      const cabecalho = `${l.tipo}${l.numero ? ` ${l.numero}` : ''}${l.assinadoEm !== '—' ? ` (assinado ${l.assinadoEm})` : ' (sem data de assinatura)'}`
      const docs = [l.proposta && doc('proposta', l.proposta), l.termo && doc('termo', l.termo)].filter((x): x is string => !!x)
      return docs.length ? docs.map((d) => `${cabecalho} — ${d}`) : [`${cabecalho} — sem PDF`]
    })
    return [`fichas do contrato ${r.contrato ?? ''}:`.trim(), ...linhas].join('\n')
  },
})
