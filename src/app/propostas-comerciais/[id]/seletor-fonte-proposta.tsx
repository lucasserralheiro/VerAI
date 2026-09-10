'use client'

import { OPCOES_FONTE, TAMANHOS_CORPO, type PreferenciaFonte } from '@/lib/preferenciaFonteProposta'

export interface SeletorFontePropostaProps {
  preferencia: PreferenciaFonte
  onMudarFonte: (fonte: string) => void
  onMudarTamanho: (tamanhoCorpo: (typeof TAMANHOS_CORPO)[number]) => void
}

const SELECT_CLASSNAME =
  'rounded-xl border border-navy/15 bg-white py-1.5 pl-2.5 pr-7 text-sm font-medium text-navy outline-none transition-colors duration-150 hover:border-navy/35 focus:border-orange focus:ring-4 focus:ring-orange/12'

/**
 * Fonte e tamanho da Proposta Comercial — controla o preview renderizado e o
 * HTML de "Copiar formatado" (ver `src/lib/preferenciaFonteProposta.ts`).
 * Compartilhado entre `EditorMarkdown` e `PropostaFinal`, que têm a mesma
 * barra de ações.
 */
export function SeletorFonteProposta({ preferencia, onMudarFonte, onMudarTamanho }: SeletorFontePropostaProps) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="sr-only" htmlFor="seletor-fonte-proposta">
        Fonte da proposta
      </label>
      <select
        id="seletor-fonte-proposta"
        value={preferencia.fonte}
        onChange={(e) => onMudarFonte(e.target.value)}
        className={SELECT_CLASSNAME}
      >
        {OPCOES_FONTE.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="seletor-tamanho-proposta">
        Tamanho da fonte (corpo do texto, em pontos)
      </label>
      <select
        id="seletor-tamanho-proposta"
        value={preferencia.tamanhoCorpo}
        onChange={(e) => onMudarTamanho(Number(e.target.value) as (typeof TAMANHOS_CORPO)[number])}
        className={SELECT_CLASSNAME}
      >
        {TAMANHOS_CORPO.map((tamanho) => (
          <option key={tamanho} value={tamanho}>
            {tamanho}pt
          </option>
        ))}
      </select>
    </div>
  )
}
