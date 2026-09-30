'use client'

// Valores a corrigir (spec §2.2 passo 3): colunas da planilha ou valores achados no texto, com o corrigido ao lado.
import type Decimal from 'decimal.js'
import { corrigirValor } from '@/lib/reajuste/calculo'
import type { Leitura } from '@/lib/reajuste/tipos'

const brl = (v: string) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const chaveDaColuna = (aba: string, coluna: number) => `${aba}|${coluna}`

export function Selecao(props: {
  leitura: Leitura
  fator: Decimal | null
  marcadas: Set<string>
  onMudar: (marcadas: Set<string>) => void
}) {
  const alternar = (chave: string) => {
    const nova = new Set(props.marcadas)
    if (nova.has(chave)) nova.delete(chave)
    else nova.add(chave)
    props.onMudar(nova)
  }
  const corrigido = (v: string) => (props.fator ? brl(corrigirValor(v, props.fator)) : '—')

  if (props.leitura.tipo === 'planilha') {
    if (props.leitura.colunas.length === 0) {
      return <p className="text-sm text-mid-grey">Nenhuma coluna com valores nesta planilha.</p>
    }
    return (
      <ul className="space-y-2 text-sm">
        {props.leitura.colunas.map((c) => {
          const chave = chaveDaColuna(c.aba, c.coluna)
          return (
            <li key={chave}>
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={props.marcadas.has(chave)} onChange={() => alternar(chave)} />
                <span>
                  <strong className="text-navy">{c.cabecalho}</strong>{' '}
                  <span className="text-mid-grey">
                    ({c.aba}, {c.quantidade} {c.quantidade === 1 ? 'valor' : 'valores'})
                  </span>
                  <br />
                  <span className="text-xs text-mid-grey">{c.exemplos.map((e) => `${brl(e)} → ${corrigido(e)}`).join(' · ')}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    )
  }

  if (props.leitura.valores.length === 0) {
    return <p className="text-sm text-mid-grey">Nenhum valor em R$ com centavos foi achado no texto.</p>
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-mid-grey">
          <th className="w-8" />
          <th className="py-2">Pág.</th>
          <th className="py-2">Trecho</th>
          <th className="py-2 text-right">Original</th>
          <th className="py-2 text-right">Corrigido</th>
        </tr>
      </thead>
      <tbody>
        {props.leitura.valores.map((v) => (
          <tr key={v.indice} className="border-b last:border-0">
            <td>
              <input
                type="checkbox"
                aria-label={v.bruto}
                checked={props.marcadas.has(String(v.indice))}
                onChange={() => alternar(String(v.indice))}
              />
            </td>
            <td className="py-1.5 text-mid-grey">{v.pagina ?? '—'}</td>
            <td className="py-1.5 text-xs text-mid-grey">
              …{v.antes} <mark className="bg-orange/15 text-navy">{v.bruto}</mark> {v.depois}…
            </td>
            <td className="py-1.5 text-right tabular-nums">{brl(v.original)}</td>
            <td className="py-1.5 text-right font-semibold tabular-nums text-navy">{corrigido(v.original)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
