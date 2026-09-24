import { chaveNumerica } from '@/lib/relatorios-clientes/vincular-itens'
import { chaveDoTermo } from './identidade'

// Auditoria das contas dos contratos, ao fim de cada sincronização com o SharePoint (spec
// docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md §10.2): as distorções que a
// conferência de 24/09/2026 achou à mão viram checagem automática — documento novo que crie uma delas
// aparece no relatório da próxima execução. Regra pura; quem junta os dados é `auditoria-banco.ts`.

export interface ContratoParaAuditar {
  cliente: string
  numeroTermo: string | null
  situacao: string | null
  /** Do consolidado (`consolidarContratos`) — a mesma regra das telas. */
  ativo: boolean
  vazio: boolean
  vigenciaFim: Date | null
  valorBase: string | null
  linhas: Array<{ tipo: string; numero: string | null }>
}

export type TipoAchado = 'finalizado-vigente' | 'ativo-sem-valor' | 'contrato-inicial-duplicado' | 'termo-duplicado' | 'contrato-duplicado'

export interface Achado {
  tipo: TipoAchado
  cliente: string
  contrato: string
  detalhe: string
}

export const ROTULO_ACHADO: Record<TipoAchado, string> = {
  'finalizado-vigente': '"Finalizado" com vigência ainda correndo',
  'ativo-sem-valor': 'ativo sem valor (fora da soma — digitar o valor)',
  'contrato-inicial-duplicado': 'mais de uma linha de contrato inicial',
  'termo-duplicado': 'o mesmo termo aditivo duas vezes',
  'contrato-duplicado': 'o mesmo contrato cadastrado duas vezes no cliente',
}

const dia = (d: Date) => d.toISOString().slice(0, 10)

export function auditarContratos(contratos: ContratoParaAuditar[], hoje: Date): Achado[] {
  const achados: Achado[] = []
  const porNumero = new Map<string, string[]>()

  for (const c of contratos) {
    if (c.vazio) continue
    const nome = c.numeroTermo ?? '(sem número)'
    const achado = (tipo: TipoAchado, detalhe: string) => achados.push({ tipo, cliente: c.cliente, contrato: nome, detalhe })

    if (!c.ativo && c.situacao && /finaliz|encerr/i.test(c.situacao) && c.vigenciaFim && c.vigenciaFim > hoje) {
      achado('finalizado-vigente', `situação "${c.situacao}", vigência até ${dia(c.vigenciaFim)}`)
    }
    if (c.ativo && c.valorBase === null) achado('ativo-sem-valor', 'nenhum termo assinado com valor lido')

    const iniciais = c.linhas.filter((l) => l.tipo === 'CONTRATO').length
    if (iniciais > 1) achado('contrato-inicial-duplicado', `${iniciais} linhas de contrato inicial`)

    const vistos = new Map<string, string>()
    for (const l of c.linhas) {
      const chave = l.tipo === 'CONTRATO' || l.tipo === 'PROSPECCAO' ? null : chaveDoTermo(l.tipo, l.numero)
      if (!chave) continue
      const anterior = vistos.get(chave)
      if (anterior !== undefined) achado('termo-duplicado', `"${anterior}" e "${l.numero}"`)
      else vistos.set(chave, l.numero ?? '')
    }

    const numero = chaveNumerica(c.numeroTermo)
    if (numero) {
      const k = `${c.cliente}|${numero}`
      porNumero.set(k, [...(porNumero.get(k) ?? []), nome])
    }
  }

  for (const [k, nomes] of porNumero) {
    if (nomes.length < 2) continue
    achados.push({ tipo: 'contrato-duplicado', cliente: k.split('|')[0], contrato: nomes[0], detalhe: nomes.join(' e ') })
  }
  return achados
}
