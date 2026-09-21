'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Calculator, CircleCheck, ChevronLeft, ExternalLink, Loader2, X } from 'lucide-react'
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
import { BlocoComparacao } from './painel-checagem-conversao'

export interface CardConferenciaTotaisProps {
  propostaId: string
  /** Abre o PDF original na página citada, com o valor destacado. */
  onVerPagina?: (pagina: number, destaque?: string, onUsarSelecao?: (texto: string) => void) => void
}

type Estado =
  | { fase: 'carregando' }
  | { fase: 'pronta'; resultado: ResultadoConferenciaTotais }
  | { fase: 'erro'; mensagem: string }

/** Item escolhido pra comparação lado a lado (PDF × documento) — vem tanto
 *  de célula de tabela quanto de linha da lista achatada, por isso é a
 *  forma comum entre as duas: "no PDF" é sempre o texto de origem (linha
 *  inteira, na tabela; rótulo + valor, na lista), "no documento" é o
 *  trecho ao redor de onde bateu (ou nada, se não achou). */
interface ItemSelecionado {
  origem: string
  pagina: number | null
  valorNoOriginal: string
  contextoOriginal: string
  contextoNoDocumento?: string
  encontradoNoDocumento: boolean
}

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
  const [selecionado, setSelecionado] = useState<ItemSelecionado | null>(null)
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

  function fecharJanela() {
    setAberta(false)
    setSelecionado(null)
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

      {aberta && selecionado && (
        <JanelaRevisao
          titulo={selecionado.valorNoOriginal}
          subtitulo={`${selecionado.origem} — comparação lado a lado, igual à checagem por IA.`}
          onFechar={fecharJanela}
          rodape={
            <button type="button" onClick={() => setSelecionado(null)} className={BTN_OUTLINE}>
              <ChevronLeft className="size-3.5" strokeWidth={2.25} />
              Voltar pra lista
            </button>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <BlocoComparacao rotulo={`No PDF · ${selecionado.origem}`} cor="navy">
              {selecionado.contextoOriginal}
            </BlocoComparacao>
            <BlocoComparacao
              rotulo="No documento"
              cor={selecionado.encontradoNoDocumento ? 'verde' : 'vermelho'}
              acao={
                !selecionado.encontradoNoDocumento && onVerPagina && selecionado.pagina !== null ? (
                  <button
                    type="button"
                    onClick={() => onVerPagina(selecionado.pagina as number, selecionado.valorNoOriginal)}
                    className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-navy-3 underline-offset-2 hover:text-orange hover:underline"
                  >
                    <ExternalLink className="size-3.5" strokeWidth={2.25} />
                    Ver no PDF
                  </button>
                ) : undefined
              }
            >
              {selecionado.encontradoNoDocumento ? (
                selecionado.contextoNoDocumento
              ) : (
                <span className="text-red-crit">Não encontrado no documento — confira se o valor foi digitado certo.</span>
              )}
            </BlocoComparacao>
          </div>
        </JanelaRevisao>
      )}

      {aberta && !selecionado && (
        <JanelaRevisao
          titulo={`${totalValores} ${totalValores === 1 ? 'total conferido' : 'totais conferidos'}`}
          subtitulo="Tabela reconstruída como está no original — clique num valor pra comparar lado a lado com o documento."
          onFechar={fecharJanela}
        >
          <div className="space-y-6">
            {tabelas.map((tabela, indice) => (
              <TabelaReconstruida key={indice} tabela={tabela} onSelecionar={setSelecionado} />
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
                    </tr>
                  </thead>
                  <tbody>
                    {totais.map((total, indice) => (
                      <LinhaTotal key={indice} total={total} onSelecionar={setSelecionado} />
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
 *  valor) só é exibida, sem cor nenhuma — comparar não faz sentido pra ela.
 *  Célula de VALOR é clicável — abre a comparação lado a lado com onde ela
 *  bateu (ou não) no documento. */
function TabelaReconstruida({
  tabela,
  onSelecionar,
}: {
  tabela: TabelaConferidaCliente
  onSelecionar: (item: ItemSelecionado) => void
}) {
  const celulasDeValor = tabela.linhas.flat().filter((c) => c.ehValor)
  const divergentes = celulasDeValor.filter((c) => !c.encontradoNoDocumento).length
  // Contado à parte de `divergentes`: o número ESTÁ no documento, o sinal é
  // que está trocado. Juntar os dois num contador só esconderia justamente o
  // que diferencia uma Redução de uma Inclusão.
  const sinaisTrocados = celulasDeValor.filter((c) => c.sinalDivergente).length

  return (
    <div className="space-y-1.5">
      <p className="text-[15px] font-semibold text-navy">
        {tabela.origem}
        {divergentes > 0 && (
          <span className="ml-2 font-normal text-red-crit">
            {divergentes} {divergentes === 1 ? 'valor não bate' : 'valores não batem'}
          </span>
        )}
        {sinaisTrocados > 0 && (
          <span className="ml-2 font-normal text-orange-dark">
            {sinaisTrocados} com sinal trocado
          </span>
        )}
      </p>
      <div className="overflow-x-auto rounded-lg border border-border-grey">
        <table className="w-full min-w-max text-left text-sm">
          <tbody>
            {tabela.linhas.map((celulas, indiceLinha) => (
              <tr key={indiceLinha} className="border-b border-border-grey last:border-0">
                {celulas.map((celula, indiceCelula) => (
                  <td
                    key={indiceCelula}
                    onClick={() =>
                      celula.ehValor &&
                      onSelecionar({
                        origem: tabela.origem,
                        pagina: tabela.pagina,
                        valorNoOriginal: celula.texto,
                        contextoOriginal: celula.contextoOriginal ?? celula.texto,
                        contextoNoDocumento: celula.contextoNoDocumento,
                        encontradoNoDocumento: celula.encontradoNoDocumento ?? false,
                      })
                    }
                    title={
                      celula.sinalDivergente
                        ? 'O número aparece no documento, mas com o sinal trocado — confira se é Inclusão ou Redução.'
                        : undefined
                    }
                    className={cn(
                      'px-3 py-1.5 align-top whitespace-nowrap',
                      celula.ehValor && 'tabular-nums font-medium',
                      celula.ehValor && 'cursor-pointer transition-opacity hover:opacity-70',
                      celula.ehValor &&
                        celula.encontradoNoDocumento &&
                        !celula.sinalDivergente &&
                        'bg-green-ok-light/40 text-navy',
                      // Terceiro estado, entre o verde e o vermelho: o número
                      // está no documento (por isso não é vermelho), mas com o
                      // sinal invertido. A cor não é o único aviso — o rótulo
                      // acima da tabela diz "N com sinal trocado" por extenso,
                      // e a célula carrega `title` explicando.
                      celula.ehValor && celula.sinalDivergente && 'bg-orange-light/50 text-orange-dark',
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

function LinhaTotal({ total, onSelecionar }: { total: TotalConferidoCliente; onSelecionar: (item: ItemSelecionado) => void }) {
  return (
    <tr
      onClick={() =>
        onSelecionar({
          origem: total.origem,
          pagina: total.pagina,
          valorNoOriginal: total.valorNoOriginal,
          contextoOriginal: `${total.rotulo}: ${total.valorNoOriginal}`,
          contextoNoDocumento: total.contextoNoDocumento,
          encontradoNoDocumento: total.encontradoNoDocumento,
        })
      }
      className="cursor-pointer border-b border-border-grey transition-colors last:border-0 hover:bg-navy/[0.03]"
    >
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
    </tr>
  )
}
