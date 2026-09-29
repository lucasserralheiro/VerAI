import { nomeDoMes } from '@/lib/controles-contratos/tipos'

// Frase que a tela mostra ao lado do campo preenchido com prova (spec
// docs/superpowers/specs/2026-09-29-valor-vigencia-contratos-design.md §0): de onde veio e com o que confere.

export type CampoOrigem = 'valor' | 'vigencia' | 'assinatura'

interface Prova {
  pagina?: number | null
  mes?: string
  controleMes?: string
  planilhaLinha?: number
}

const mes = (p: Prova) => (p.controleMes ?? p.mes ? ` de ${nomeDoMes((p.controleMes ?? p.mes)!)}` : '')
const linha = (p: Prova) => (p.planilhaLinha ? ` (linha ${p.planilhaLinha})` : '')

const NOMES: Record<string, (p: Prova) => string> = {
  EXTENSO: () => 'valor por extenso',
  PLANILHA: (p) => `planilha de contratos${linha(p)}`,
  CONTROLE: (p) => `controle do faturamento${mes(p)}`,
  PROPOSTA: () => 'proposta',
  CADEIA: () => 'valor do termo anterior',
  TERMO: () => 'termo',
}
const FEMININO = new Set(['PLANILHA', 'PROPOSTA'])

const nome = (fonte: string, p: Prova) => NOMES[fonte]?.(p) ?? fonte.toLowerCase()
const com = (fonte: string, p: Prova) => `${FEMININO.has(fonte) ? 'a' : 'o'} ${nome(fonte, p)}`
const de = (fonte: string, p: Prova) => `${FEMININO.has(fonte) ? 'da' : 'do'} ${nome(fonte, p)}`

function lista(itens: string[]): string {
  return itens.length <= 1 ? (itens[0] ?? '') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

export function textoDaOrigem(campo: CampoOrigem, origem: string, prova: unknown): string {
  const p = (prova ?? {}) as Prova
  const [primeira, ...demais] = origem.split('+')
  const confere = demais.length > 0 ? `; confere com ${lista(demais.map((f) => com(f, p)))}` : ''
  const texto =
    campo === 'assinatura'
      ? primeira === 'CONTROLE'
        ? `o termo está em uso no ${nome('CONTROLE', p)}`
        : `a planilha de contratos dá a contratação como concluída${linha(p)}`
      : campo === 'valor' && primeira === 'TERMO'
        ? `lido do termo${p.pagina ? ` (pág. ${p.pagina})` : ''}${confere}`
        : `${campo === 'valor' ? 'valor' : 'vigência'} ${de(primeira, p)}${confere}`
  return `Preenchido automaticamente: ${texto}`
}
