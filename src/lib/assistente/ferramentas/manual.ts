import { z } from 'zod'
import { MANUAL, TEMAS_MANUAL } from '@/lib/assistente/manual'
import { definirFerramenta } from './comum'

export const AVISO_RASCUNHO = 'rascunho em validação — não cite como regra'

export const consultarManual = definirFerramenta({
  descricao:
    'Manual da equipe sobre processo e norma de um tema: prorrogacao (prorrogação de vigência), aditivo-valor (acréscimo e supressão), reajuste (reajuste e repactuação), apostilamento (apostilamento × aditivo), rescisao (rescisão e encerramento), faturamento (lançamento e envio ao cliente e ao GFP), sei (trâmite do processo), confere (quando usar o ConfereAI). Tema em rascunho não é regra.',
  entrada: z.object({ tema: z.enum(TEMAS_MANUAL) }),
  async executar({ tema }) {
    const t = MANUAL[tema]
    return t.status === 'validado'
      ? { tema: t.tema, titulo: t.titulo, status: t.status, validadoPor: t.validadoPor, validadoEm: t.validadoEm, texto: t.texto }
      : { tema: t.tema, titulo: t.titulo, status: t.status, aviso: AVISO_RASCUNHO, texto: t.texto }
  },
  compactar(saida) {
    const r = saida as { titulo: string; status: string; aviso?: string; validadoPor?: string; validadoEm?: string; texto: string }
    const cabecalho = r.aviso ? `${r.titulo} — ${r.status}: ${r.aviso}` : `${r.titulo} — validado por ${r.validadoPor} em ${r.validadoEm}`
    return `${cabecalho}\n${r.texto}`
  },
})
