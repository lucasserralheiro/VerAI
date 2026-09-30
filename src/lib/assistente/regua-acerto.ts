// Régua de acerto do assistente (spec 2026-09-30-assistente-consultor-design §11). Puro: o script faz as
// perguntas e passa aqui o que observou.

export type TipoEsperado = 'verai' | 'geral' | 'recusa' | 'sem-dado' | 'direta'

export interface Caso {
  intencao: string
  perguntas: string[]
  tipo: TipoEsperado
  ferramenta?: string
  /** Valor que TEM de aparecer na resposta, lido do banco na hora (null = não confere chave). */
  chave?: () => Promise<string | null>
}

export interface Observado {
  texto: string
  ferramentas: string[]
  direta: boolean
  naoConfirmados: string[]
}

const FRASE_RECUSA = 'Isso está fora do que o assistente do VerAI atende.'
const NAO_ENCONTREI = /n[aã]o encontrei/i

export function avaliarCaso(caso: Pick<Caso, 'tipo' | 'ferramenta'>, chave: string | null, obs: Observado): { ok: boolean; motivos: string[] } {
  const motivos: string[] = []
  const texto = obs.texto.trim()
  switch (caso.tipo) {
    case 'recusa':
      if (!texto.startsWith(FRASE_RECUSA)) motivos.push('não recusou com a frase fixa')
      break
    case 'geral':
      if (!texto.includes(':::geral')) motivos.push('sem bloco :::geral')
      break
    case 'sem-dado':
      if (!NAO_ENCONTREI.test(texto)) motivos.push('não disse que não encontrou')
      break
    case 'direta':
      if (!obs.direta) motivos.push('não foi resposta direta')
      break
    case 'verai':
      if (caso.ferramenta && !obs.ferramentas.includes(caso.ferramenta)) motivos.push(`não chamou ${caso.ferramenta}`)
      break
  }
  if ((caso.tipo === 'verai' || caso.tipo === 'direta') && chave && !texto.includes(chave)) motivos.push(`chave ${chave} ausente`)
  if (caso.tipo !== 'geral' && caso.tipo !== 'recusa' && obs.naoConfirmados.length > 0) motivos.push(`${obs.naoConfirmados.length} número não confirmado`)
  return { ok: motivos.length === 0, motivos }
}
