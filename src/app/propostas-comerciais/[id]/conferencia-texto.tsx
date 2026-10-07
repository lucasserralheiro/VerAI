'use client'

import { useState } from 'react'
import { AlertCircle, CircleCheck, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ConferenciaDeTexto } from '@/lib/extracao/regua/fidelidade'
import { JanelaRevisao } from './janela-revisao'

const formato = new Intl.NumberFormat('pt-BR')

/**
 * "Todo número do original está no documento?" — a régua da conversão rodando sozinha em cada
 * proposta, pra quem converteu não precisar testar nada. Vai dentro do card da conferência de totais
 * (mesma chamada, mesmo cache). Conta TODO número — valor, código de serviço, data, quantidade —
 * e conta repetição: valor que aparecia 3 vezes no PDF e ficou 2 no documento é acusado.
 */
export function ConferenciaTexto({
  texto,
  onVerPagina,
}: {
  texto: ConferenciaDeTexto
  onVerPagina?: (pagina: number, destaque?: string) => void
}) {
  const [aberta, setAberta] = useState(false)
  if (texto.numerosNoOriginal === 0) return null

  const perdidos = texto.quantidadeNumerosPerdidos
  const sobrando = texto.quantidadeNumerosSobrando
  const problema = perdidos + sobrando > 0

  const resumo = problema
    ? [
        perdidos > 0 && `${formato.format(perdidos)} ${perdidos === 1 ? 'número do original não está' : 'números do original não estão'} no documento`,
        sobrando > 0 && `${formato.format(sobrando)} a mais no documento`,
      ]
        .filter(Boolean)
        .join(' · ')
    : `Todos os ${formato.format(texto.numerosNoOriginal)} números do original estão no documento`

  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[15px] font-medium transition-colors',
          problema
            ? 'border-red-crit/30 bg-red-crit-light/40 text-red-crit hover:bg-red-crit-light/60'
            : 'border-green-ok/30 bg-green-ok-light/40 text-navy hover:bg-green-ok-light/60'
        )}
      >
        {problema ? (
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
        ) : (
          <CircleCheck className="size-4 shrink-0 text-green-ok" strokeWidth={2.25} />
        )}
        {resumo}
      </button>

      {aberta && (
        <JanelaRevisao
          titulo={resumo}
          subtitulo="Todo número do original — valor, código, data, quantidade — procurado no documento como está agora, contando quantas vezes aparece."
          onFechar={() => setAberta(false)}
        >
          <div className="space-y-6">
            {perdidos > 0 && (
              <div className="space-y-2">
                <h3 className="text-[15px] font-semibold text-navy">
                  Não estão no documento
                  {perdidos > texto.numerosPerdidos.length && (
                    <span className="ml-2 font-normal text-mid-grey">
                      (primeiros {texto.numerosPerdidos.length} de {formato.format(perdidos)})
                    </span>
                  )}
                </h3>
                <table className="w-full text-left text-[15px]">
                  <thead>
                    <tr className="border-b border-border-grey text-sm text-mid-grey">
                      <th className="py-2 pr-3 font-medium">Origem</th>
                      <th className="py-2 pr-3 font-medium">Número</th>
                      <th className="py-2 pr-3 font-medium">Linha no original</th>
                      <th className="py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {texto.numerosPerdidos.map((item, indice) => (
                      <tr key={indice} className="border-b border-border-grey align-top last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap">{item.origem}</td>
                        <td className="py-2 pr-3 font-medium whitespace-nowrap text-red-crit tabular-nums">{item.numero}</td>
                        <td className="py-2 pr-3 text-mid-grey">{item.contexto}</td>
                        <td className="py-2 whitespace-nowrap">
                          {onVerPagina && item.pagina !== null && (
                            <button
                              type="button"
                              onClick={() => onVerPagina(item.pagina as number, item.numero)}
                              className="inline-flex items-center gap-1 text-sm font-medium text-navy-3 underline-offset-2 hover:text-orange hover:underline"
                            >
                              <ExternalLink className="size-3.5" strokeWidth={2.25} />
                              Ver no PDF
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {sobrando > 0 && (
              <div className="space-y-2">
                <h3 className="text-[15px] font-semibold text-navy">No documento, mas não no original</h3>
                <p className="text-[15px] text-mid-grey">
                  Número repetido na conversão ou digitado depois — confira se deveria estar lá.
                </p>
                <p className="text-[15px] font-medium text-red-crit tabular-nums">{texto.numerosSobrando.join('  ·  ')}</p>
              </div>
            )}

            {!problema && (
              <p className="text-[15px] text-mid-grey">
                Nenhum número sumiu nem apareceu. Isso não confere formatação nem a posição de cada valor na
                tabela — a conferência de totais e a checagem por IA cobrem isso.
              </p>
            )}

            {texto.palavrasPerdidas > 0 && (
              <p className="text-sm text-mid-grey">
                {formato.format(texto.palavrasPerdidas)} de {formato.format(texto.palavrasNoOriginal)} palavras do original
                não aparecem iguais no documento (hifenização e edição contam)
                {texto.exemploPalavrasPerdidas.length > 0 && `: ${texto.exemploPalavrasPerdidas.slice(0, 10).join(', ')}`}.
              </p>
            )}
          </div>
        </JanelaRevisao>
      )}
    </>
  )
}
