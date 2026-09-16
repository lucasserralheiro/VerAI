'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Calculator, CircleCheck, ExternalLink, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BTN_OUTLINE } from '@/lib/ui'
import {
  conferenciaTotaisAtual,
  iniciarConferenciaTotais,
  limparConferenciaTotais,
  type ResultadoConferenciaTotais,
  type TabelaConferidaCliente,
  type TotalConferidoCliente,
} from '@/lib/conferenciaTotaisEmAndamento'
import { JanelaRevisao } from './janela-revisao'
import { TituloSecao } from './titulo-secao'

export interface CardConferenciaTotaisProps {
  propostaId: string
  /** Abre o PDF original na página citada, com o valor destacado. */
  onVerPagina?: (pagina: number, destaque?: string, onUsarSelecao?: (texto: string) => void) => void
}

type Estado =
  | { fase: 'carregando' }
  | { fase: 'pronta'; resultado: ResultadoConferenciaTotais }
  | { fase: 'erro'; mensagem: string }

/**
 * Conferência rápida (sem IA, determinística) dos valores do PDF/Word/
 * planilha contra o documento — atalho a mais além da checagem por IA
 * (`painel-checagem-conversao.tsx`), pra bater o olho nos números sem
 * esperar chamada de modelo nenhuma. Dispara sozinho ao montar (diferente
 * da checagem por IA, que espera clique) — é praticamente instantâneo. Ver
 * docs/superpowers/specs/2026-09-16-conferencia-totais-design.md.
 */
export function CardConferenciaTotais({ propostaId, onVerPagina }: CardConferenciaTotaisProps) {
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' })
  const [aberta, setAberta] = useState(false)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  function disparar() {
    setEstado({ fase: 'carregando' })
    iniciarConferenciaTotais(propostaId).then(
      (resultado) => {
        if (montado.current) setEstado({ fase: 'pronta', resultado })
      },
      (erro) => {
        if (montado.current) {
          setEstado({ fase: 'erro', mensagem: erro instanceof Error ? erro.message : 'Não foi possível conferir os totais.' })
        }
      }
    )
  }

  useEffect(() => {
    const atual = conferenciaTotaisAtual(propostaId)
    if (atual?.status === 'ok') {
      setEstado({ fase: 'pronta', resultado: atual.resultado })
      return
    }
    if (atual?.status === 'erro') {
      setEstado({ fase: 'erro', mensagem: atual.mensagem })
      return
    }
    if (atual?.status === 'rodando') {
      setEstado({ fase: 'carregando' })
      atual.promise.then(
        (resultado) => {
          if (montado.current) setEstado({ fase: 'pronta', resultado })
        },
        (erro) => {
          if (montado.current) {
            setEstado({ fase: 'erro', mensagem: erro instanceof Error ? erro.message : 'Não foi possível conferir os totais.' })
          }
        }
      )
      return
    }
    disparar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propostaId])

  function tentarDeNovo() {
    limparConferenciaTotais(propostaId)
    disparar()
  }

  const titulo = <TituloSecao icone={Calculator}>Conferência de totais</TituloSecao>

  if (estado.fase === 'carregando') {
    return (
      <section className="space-y-2">
        {titulo}
        <p className="flex items-start gap-2 text-[15px] text-mid-grey">
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" strokeWidth={2.25} />
          Conferindo totais...
        </p>
      </section>
    )
  }

  if (estado.fase === 'erro') {
    return (
      <section className="space-y-2">
        {titulo}
        <p className="flex items-start gap-2 text-[15px] text-red-crit">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
          {estado.mensagem}
        </p>
        <button type="button" onClick={tentarDeNovo} className={BTN_OUTLINE}>
          Tentar de novo
        </button>
      </section>
    )
  }

  const { totais, tabelas } = estado.resultado
  // Total de valores conferidos = os de tabela (dentro de `tabelas`, célula
  // a célula) + os de texto corrido (`totais`, fonte sem tabela detectada)
  // — as duas fontes juntas, nunca contam o mesmo valor duas vezes (ver
  // `conferirTotais.ts`: fonte com tabela nunca entra em `totais`).
  const celulasDeValor = tabelas.flatMap((tabela) => tabela.linhas.flat().filter((c) => c.ehValor))
  const totalValores = totais.length + celulasDeValor.length
  const divergentes = totais.filter((t) => !t.encontradoNoDocumento).length + celulasDeValor.filter((c) => !c.encontradoNoDocumento).length

  if (totalValores === 0) {
    return (
      <section className="space-y-1">
        {titulo}
        <p className="text-[15px] text-mid-grey">
          Nenhum total detectado automaticamente — confira o documento manualmente.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-2">
      {titulo}
      <button
        type="button"
        onClick={() => setAberta(true)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[15px] font-medium transition-colors',
          divergentes > 0
            ? 'border-red-crit/30 bg-red-crit-light/40 text-red-crit hover:bg-red-crit-light/60'
            : 'border-green-ok/30 bg-green-ok-light/40 text-navy hover:bg-green-ok-light/60'
        )}
      >
        {divergentes > 0 ? (
          <>
            <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
            {divergentes} de {totalValores} {totalValores === 1 ? 'total não bate' : 'totais não batem'}
          </>
        ) : (
          <>
            <CircleCheck className="size-4 shrink-0 text-green-ok" strokeWidth={2.25} />
            {totalValores} {totalValores === 1 ? 'total conferido' : 'totais conferidos'}
          </>
        )}
      </button>

      {aberta && (
        <JanelaRevisao
          titulo={`${totalValores} ${totalValores === 1 ? 'total conferido' : 'totais conferidos'}`}
          subtitulo="Tabela reconstruída como está no original — verde bate com o documento, vermelho não achou."
          onFechar={() => setAberta(false)}
        >
          <div className="space-y-6">
            {tabelas.map((tabela, indice) => (
              <TabelaReconstruida key={indice} tabela={tabela} onVerPagina={onVerPagina} />
            ))}

            {totais.length > 0 && (
              <div className="space-y-2">
                {tabelas.length > 0 && <h3 className="text-[15px] font-semibold text-navy">Outros valores (fora de tabela)</h3>}
                <table className="w-full text-left text-[15px]">
                  <thead>
                    <tr className="border-b border-border-grey text-sm text-mid-grey">
                      <th className="py-2 pr-3 font-medium">Origem</th>
                      <th className="py-2 pr-3 font-medium">Rótulo</th>
                      <th className="py-2 pr-3 font-medium">Valor no original</th>
                      <th className="py-2 pr-3 font-medium">No documento</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {totais.map((total, indice) => (
                      <LinhaTotal key={indice} total={total} onVerPagina={onVerPagina} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </JanelaRevisao>
      )}
    </section>
  )
}

/** Tabela reconstruída, exatamente como está no PDF/planilha original —
 *  mesma linha, mesma coluna, mesma célula — com cada valor destacado
 *  achado/não achado no documento final. Célula de descrição/código (não
 *  valor) só é exibida, sem cor nenhuma — comparar não faz sentido pra ela. */
function TabelaReconstruida({
  tabela,
  onVerPagina,
}: {
  tabela: TabelaConferidaCliente
  onVerPagina?: (pagina: number, destaque?: string, onUsarSelecao?: (texto: string) => void) => void
}) {
  const celulasDeValor = tabela.linhas.flat().filter((c) => c.ehValor)
  const divergentes = celulasDeValor.filter((c) => !c.encontradoNoDocumento).length

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] font-semibold text-navy">
          {tabela.origem}
          {divergentes > 0 && (
            <span className="ml-2 font-normal text-red-crit">
              {divergentes} {divergentes === 1 ? 'valor não bate' : 'valores não batem'}
            </span>
          )}
        </p>
        {onVerPagina && tabela.pagina !== null && (
          <button
            type="button"
            onClick={() => onVerPagina(tabela.pagina as number)}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-navy-3 underline-offset-2 hover:text-orange hover:underline"
          >
            <ExternalLink className="size-3.5" strokeWidth={2.25} />
            Ver no PDF
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border-grey">
        <table className="w-full min-w-max text-left text-sm">
          <tbody>
            {tabela.linhas.map((celulas, indiceLinha) => (
              <tr key={indiceLinha} className="border-b border-border-grey last:border-0">
                {celulas.map((celula, indiceCelula) => (
                  <td
                    key={indiceCelula}
                    className={cn(
                      'px-3 py-1.5 align-top whitespace-nowrap',
                      celula.ehValor && 'tabular-nums font-medium',
                      celula.ehValor && celula.encontradoNoDocumento && 'bg-green-ok-light/40 text-navy',
                      celula.ehValor && !celula.encontradoNoDocumento && 'bg-red-crit-light/40 text-red-crit'
                    )}
                  >
                    {celula.texto || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LinhaTotal({
  total,
  onVerPagina,
}: {
  total: TotalConferidoCliente
  onVerPagina?: (pagina: number, destaque?: string, onUsarSelecao?: (texto: string) => void) => void
}) {
  return (
    <tr className="border-b border-border-grey last:border-0">
      <td className="py-2 pr-3">{total.origem}</td>
      <td className="py-2 pr-3">{total.rotulo}</td>
      <td className="py-2 pr-3 tabular-nums">{total.valorNoOriginal}</td>
      <td className="py-2 pr-3">
        {total.encontradoNoDocumento ? (
          <span className="inline-flex items-center gap-1 text-green-ok">
            <CircleCheck className="size-4" strokeWidth={2.25} /> Achado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-red-crit">
            <X className="size-4" strokeWidth={2.25} /> Não achado
          </span>
        )}
      </td>
      <td className="py-2">
        {!total.encontradoNoDocumento && onVerPagina && total.pagina !== null && (
          <button
            type="button"
            onClick={() => onVerPagina(total.pagina as number, total.valorNoOriginal)}
            className="inline-flex items-center gap-1 text-sm font-medium text-navy-3 underline-offset-2 hover:text-orange hover:underline"
          >
            <ExternalLink className="size-3.5" strokeWidth={2.25} />
            Ver no PDF
          </button>
        )}
      </td>
    </tr>
  )
}
