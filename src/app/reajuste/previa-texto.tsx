'use client'

// Prévia de PDF/Word (spec §2.2 passo 3): o documento ao lado dos valores em R$ achados no texto,
// cada um com o corrigido. PDF/DOCX não é reescrito — o resultado é uma planilha de comparação.
import { useState } from 'react'
import type Decimal from 'decimal.js'
import { corrigirValor } from '@/lib/reajuste/calculo'
import type { Leitura } from '@/lib/reajuste/tipos'

const brl = (v: string) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function PreviaTexto(props: {
  leitura: Extract<Leitura, { tipo: 'texto' }>
  fator: Decimal | null
  marcadas: Set<string>
  onMudar: (marcadas: Set<string>) => void
  urlDoPdf: string | null // o arquivo local, pro visualizador do navegador; null = Word ou sem suporte
}) {
  const { valores } = props.leitura
  const [pagina, setPagina] = useState<number | null>(null)

  const alternar = (chave: string) => {
    const nova = new Set(props.marcadas)
    if (nova.has(chave)) nova.delete(chave)
    else nova.add(chave)
    props.onMudar(nova)
  }
  const corrigido = (v: string) => (props.fator ? brl(corrigirValor(v, props.fator)) : '—')
  const todas = valores.length > 0 && props.marcadas.size === valores.length

  const lista =
    valores.length === 0 ? (
      <div className="flex h-full items-center justify-center p-10 text-center text-sm text-mid-grey">
        Nenhum valor em R$ com centavos foi achado no texto.
      </div>
    ) : (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-border-grey px-4 py-3">
          <span className="text-xs font-medium tracking-wide text-mid-grey uppercase">
            Valores achados · {props.marcadas.size} de {valores.length} marcados
          </span>
          <button
            type="button"
            className="text-xs font-medium text-navy hover:text-orange hover:underline"
            onClick={() => props.onMudar(new Set(todas ? [] : valores.map((v) => String(v.indice))))}
          >
            {todas ? 'Desmarcar todos' : 'Marcar todos'}
          </button>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-border-grey overflow-auto">
          {valores.map((v) => {
            const chave = String(v.indice)
            const ativa = props.marcadas.has(chave)
            return (
              <li key={v.indice} className={`flex gap-3 px-4 py-3 transition-colors ${ativa ? 'bg-white' : 'bg-light-grey/60'}`}>
                <input
                  type="checkbox"
                  aria-label={v.bruto}
                  className="mt-1 size-4 shrink-0 accent-orange"
                  checked={ativa}
                  onChange={() => alternar(chave)}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className={`text-xs leading-relaxed ${ativa ? 'text-mid-grey' : 'text-mid-grey/70'}`}>
                    {v.pagina !== null && (
                      <button
                        type="button"
                        disabled={!props.urlDoPdf}
                        onClick={() => setPagina(v.pagina)}
                        className="mr-2 rounded bg-navy/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-navy enabled:hover:bg-navy/15"
                        title={props.urlDoPdf ? 'Ir para a página no documento' : undefined}
                      >
                        pág. {v.pagina}
                      </button>
                    )}
                    …{v.antes} <mark className="rounded bg-orange/15 px-0.5 font-medium text-navy">{v.bruto}</mark> {v.depois}…
                  </p>
                  <p className={`flex items-baseline gap-2 text-sm tabular-nums ${ativa ? '' : 'opacity-50'}`}>
                    <span className="text-mid-grey">{brl(v.original)}</span>
                    <span className="text-mid-grey">→</span>
                    <span className="font-semibold text-navy">{corrigido(v.original)}</span>
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    )

  if (!props.urlDoPdf) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <p className="border-b border-border-grey bg-light-grey/60 px-4 py-2 text-xs text-mid-grey">
          Word não tem visualização no navegador — confira os valores pelo trecho em que aparecem.
        </p>
        <div className="min-h-0 flex-1">{lista}</div>
      </div>
    )
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(24rem,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,1fr)] xl:grid-rows-1">
      <iframe
        key={pagina ?? 0}
        title="Documento"
        src={pagina ? `${props.urlDoPdf}#page=${pagina}` : props.urlDoPdf}
        className="h-full w-full border-b border-border-grey bg-light-grey xl:border-r xl:border-b-0"
      />
      <div className="min-h-0">{lista}</div>
    </div>
  )
}
