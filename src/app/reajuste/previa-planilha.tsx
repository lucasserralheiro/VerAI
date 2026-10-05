'use client'

// Prévia da planilha (spec §2.2 passo 3): a aba como ela é, com as colunas de valor marcáveis no
// cabeçalho e o corrigido dentro da própria célula. Só exibição — o servidor recalcula tudo ao gerar.
import { useState } from 'react'
import type Decimal from 'decimal.js'
import { ChevronDown } from 'lucide-react'
import { corrigirValor } from '@/lib/reajuste/calculo'
import type { ColunaCandidata, Leitura } from '@/lib/reajuste/tipos'

const brl = (v: string) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const chaveDaColuna = (aba: string, coluna: number) => `${aba}|${coluna}`

function letraDaColuna(n: number): string {
  let letra = ''
  for (let i = n; i > 0; i = Math.floor((i - 1) / 26)) letra = String.fromCharCode(65 + ((i - 1) % 26)) + letra
  return letra
}

export function PreviaPlanilha(props: {
  leitura: Extract<Leitura, { tipo: 'planilha' }>
  fator: Decimal | null
  marcadas: Set<string>
  onMudar: (marcadas: Set<string>) => void
}) {
  const { leitura, marcadas } = props
  const primeiraComValor = leitura.abas.find((a) => leitura.colunas.some((c) => c.aba === a.nome))?.nome
  const [abaAtual, setAbaAtual] = useState(primeiraComValor ?? leitura.abas[0]?.nome ?? '')
  const [menuAberto, setMenuAberto] = useState(false)
  const aba = leitura.abas.find((a) => a.nome === abaAtual) ?? leitura.abas[0]

  const alternar = (chave: string) => {
    const nova = new Set(marcadas)
    if (nova.has(chave)) nova.delete(chave)
    else nova.add(chave)
    props.onMudar(nova)
  }

  if (leitura.colunas.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-center text-sm text-mid-grey">
        Nenhuma coluna com valores nesta planilha.
      </div>
    )
  }

  const candidatas = new Map<number, ColunaCandidata>(
    leitura.colunas.filter((c) => c.aba === aba?.nome).map((c) => [c.coluna, c])
  )

  const daAba = leitura.colunas.filter((c) => c.aba === aba?.nome)
  const marcadasNaAba = daAba.filter((c) => marcadas.has(chaveDaColuna(c.aba, c.coluna))).length
  const trocarDaAba = (marcar: (c: ColunaCandidata) => boolean) => {
    const nova = new Set(marcadas)
    for (const c of daAba) {
      const chave = chaveDaColuna(c.aba, c.coluna)
      if (marcar(c)) nova.add(chave)
      else nova.delete(chave)
    }
    props.onMudar(nova)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Uma linha só: abas à esquerda, escolha das colunas num menu (planilha real tem dezenas). */}
      <div className="flex items-center gap-3 border-b border-border-grey px-3 py-2">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {leitura.abas.map((a) => {
            const n = leitura.colunas.filter((c) => c.aba === a.nome && marcadas.has(chaveDaColuna(c.aba, c.coluna))).length
            return (
              <button
                key={a.nome}
                type="button"
                onClick={() => {
                  setAbaAtual(a.nome)
                  setMenuAberto(false)
                }}
                className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                  a.nome === aba?.nome ? 'bg-navy text-white' : 'text-mid-grey hover:bg-light-grey hover:text-navy'
                }`}
              >
                {a.nome}
                {n > 0 && (
                  <span className={`ml-1.5 rounded-full px-1.5 text-[10px] ${a.nome === aba?.nome ? 'bg-orange' : 'bg-orange/15 text-orange-dark'}`}>
                    {n}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {daAba.length > 0 && (
          <div className="relative shrink-0">
            <button
              type="button"
              aria-expanded={menuAberto}
              onClick={() => setMenuAberto((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-grey px-2.5 py-1 text-xs font-medium text-navy hover:border-navy/35"
            >
              Colunas a corrigir
              <span className="rounded-full bg-orange px-1.5 text-[10px] text-white">
                {marcadasNaAba}/{daAba.length}
              </span>
              <ChevronDown className="size-3.5" />
            </button>
            {menuAberto && (
              <div className="absolute right-0 z-40 mt-1 w-80 rounded-xl border border-border-grey bg-white shadow-lg">
                <div className="flex justify-between border-b border-border-grey px-3 py-2 text-xs">
                  <button type="button" className="font-medium text-navy hover:text-orange" onClick={() => trocarDaAba((c) => c.sugerida)}>
                    Só as sugeridas
                  </button>
                  <button type="button" className="font-medium text-navy hover:text-orange" onClick={() => trocarDaAba(() => true)}>
                    Todas
                  </button>
                  <button type="button" className="font-medium text-mid-grey hover:text-orange" onClick={() => trocarDaAba(() => false)}>
                    Nenhuma
                  </button>
                </div>
                <ul className="max-h-72 overflow-y-auto py-1">
                  {daAba.map((c) => {
                    const chave = chaveDaColuna(c.aba, c.coluna)
                    return (
                      <li key={chave}>
                        <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-light-grey">
                          <input type="checkbox" className="accent-orange" checked={marcadas.has(chave)} onChange={() => alternar(chave)} />
                          <span className="w-6 shrink-0 font-mono text-mid-grey">{letraDaColuna(c.coluna)}</span>
                          <span className="min-w-0 flex-1 truncate text-navy" title={c.cabecalho}>
                            {c.cabecalho}
                          </span>
                          <span className="shrink-0 text-mid-grey tabular-nums">{c.quantidade}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {aba && (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 z-30 w-10 border-r border-b border-border-grey bg-light-grey" />
                {aba.linhas[0]?.celulas.map((_, i) => {
                  const coluna = i + 1
                  const candidata = candidatas.get(coluna)
                  const chave = chaveDaColuna(aba.nome, coluna)
                  const ativa = marcadas.has(chave)
                  return (
                    <th
                      key={coluna}
                      className={`min-w-28 border-r border-b border-border-grey px-2 py-1.5 text-center font-medium ${
                        ativa ? 'bg-orange text-white' : 'bg-light-grey text-mid-grey'
                      }`}
                    >
                      {candidata ? (
                        <label className="inline-flex cursor-pointer items-center gap-1.5">
                          <input
                            type="checkbox"
                            aria-label={`Corrigir ${candidata.cabecalho}`}
                            className="accent-navy"
                            checked={ativa}
                            onChange={() => alternar(chave)}
                          />
                          {letraDaColuna(coluna)}
                        </label>
                      ) : (
                        letraDaColuna(coluna)
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {aba.linhas.map((linha) => {
                const cabecalho = linha.numero === aba.linhaCabecalho
                const antes = aba.linhaCabecalho > 0 && linha.numero < aba.linhaCabecalho
                return (
                  <tr key={linha.numero} className={antes ? 'opacity-60' : undefined}>
                    <td className="sticky left-0 z-10 border-r border-b border-border-grey bg-light-grey px-2 py-1 text-right text-mid-grey tabular-nums">
                      {linha.numero}
                    </td>
                    {linha.celulas.map((celula, i) => {
                      const ativa = marcadas.has(chaveDaColuna(aba.nome, i + 1))
                      const corrige = ativa && !cabecalho && linha.numero > aba.linhaCabecalho && celula.v !== undefined
                      return (
                        <td
                          key={i}
                          className={`max-w-64 border-r border-b border-border-grey px-2 py-1 align-top ${
                            cabecalho ? 'bg-navy/[0.04] font-semibold text-navy' : ''
                          } ${ativa ? 'bg-orange/[0.06]' : 'bg-white'} ${celula.v !== undefined ? 'text-right tabular-nums' : ''}`}
                        >
                          {corrige && props.fator ? (
                            <span className="flex flex-col items-end leading-tight">
                              <span className="text-[10px] text-mid-grey line-through">{celula.t}</span>
                              {celula.f ? (
                                <span
                                  className="font-semibold text-navy italic"
                                  title="Fórmula: no arquivo gerado ela é refeita com as colunas corrigidas (pode variar alguns centavos desta prévia)"
                                >
                                  ≈ {brl(corrigirValor(celula.v!, props.fator))}
                                </span>
                              ) : (
                                <span className="font-semibold text-navy">{brl(corrigirValor(celula.v!, props.fator))}</span>
                              )}
                            </span>
                          ) : (
                            <span className="block truncate" title={celula.t}>
                              {celula.t}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {aba && (aba.totalLinhas > aba.linhas.length || aba.totalColunas > (aba.linhas[0]?.celulas.length ?? 0)) && (
        <p className="border-t border-border-grey bg-light-grey/60 px-3 py-1.5 text-xs text-mid-grey">
          Mostrando {aba.linhas.length} de {aba.totalLinhas} linhas — a correção vale para a coluna inteira.
        </p>
      )}
    </div>
  )
}
