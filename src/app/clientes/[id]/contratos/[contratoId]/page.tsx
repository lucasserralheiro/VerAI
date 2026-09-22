'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ChevronRight, ExternalLink, Info, Loader2, Pencil } from 'lucide-react'
import { BTN_OUTLINE } from '@/lib/ui'
import { formatarData, formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import { BarraFaturado, PillVencimento } from '@/components/relatorios-clientes/indicadores-contrato'
import { FormularioContrato, type Contrato } from '../formulario-contrato'
import { SecaoHistorico, type LinhaHistorico } from './secao-historico'
import { SecaoItens, type Item } from './secao-itens'

interface ContratoDetalhe extends Contrato {
  historico: LinhaHistorico[]
  itens: Item[]
}

function CartaoSaldo({ contrato }: { contrato: Contrato }) {
  const { saldo } = contrato
  return (
    <section aria-label="Saldo do contrato" className="card space-y-3">
      <h2 className="text-[0.95rem] font-semibold text-navy">Saldo</h2>
      {saldo.saldo === null ? (
        <p className="flex items-start gap-1.5 rounded-lg bg-orange-light px-3 py-2 text-sm text-orange-dark">
          <Info className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
          Sem itens vinculados — saldo não calculável. Vincule os itens importados ou cadastre os itens do contrato.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3">
            {[
              { rotulo: 'Valor dos itens', valor: saldo.valorItens },
              { rotulo: 'Faturado', valor: saldo.faturado },
              { rotulo: 'Saldo', valor: saldo.saldo },
            ].map(({ rotulo, valor }) => (
              <div key={rotulo}>
                <dt className="text-xs text-mid-grey">{rotulo}</dt>
                <dd className="font-mono text-sm font-semibold text-navy">{formatarMoeda(valor)}</dd>
              </div>
            ))}
          </dl>
          <BarraFaturado saldo={saldo} />
        </>
      )}
    </section>
  )
}

export default function ContratoDetalhePage({ params }: { params: Promise<{ id: string; contratoId: string }> }) {
  const { id: clienteId, contratoId } = use(params)
  const [contrato, setContrato] = useState<ContratoDetalhe | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)

  async function carregar() {
    try {
      const response = await fetch(`/api/contratos/${contratoId}`)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErro(body?.error ?? 'Falha ao carregar o contrato.')
        return
      }
      setErro(null)
      setContrato(await response.json())
    } catch {
      setErro('Falha de conexão ao carregar o contrato.')
    }
  }

  useEffect(() => {
    carregar().finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId])

  if (carregando) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 text-sm text-mid-grey">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          Carregando...
        </p>
      </main>
    )
  }

  if (!contrato) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 rounded-xl bg-red-crit-light p-4 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro ?? 'Contrato não encontrado.'}
        </p>
      </main>
    )
  }

  const titulo = contrato.numeroTermo ?? '(sem número)'

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Relatórios</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <Link href="/clientes" className="hover:text-navy hover:underline">
            Clientes
          </Link>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <Link href={`/clientes/${clienteId}?aba=contratos`} className="hover:text-navy hover:underline">
            Contratos
          </Link>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy">{titulo}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-[1.6rem] leading-tight font-semibold tracking-tight text-navy">{titulo}</h1>
              <PillVencimento vencimento={contrato.vencimento} />
              {contrato.situacao && <span className="text-sm text-mid-grey">{contrato.situacao}</span>}
            </div>
            {contrato.descricao && <p className="text-sm text-foreground">{contrato.descricao}</p>}
            <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-mid-grey">
              <span>
                vigência {formatarData(contrato.dataInicio)} – {formatarData(contrato.dataVencimento)}
              </span>
              {contrato.seiCliente && <span>SEI cliente {contrato.seiCliente}</span>}
              {contrato.seiProdam && <span>SEI PRODAM {contrato.seiProdam}</span>}
              {contrato.linkSei && (
                <a
                  href={contrato.linkSei}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-sans font-medium text-navy hover:text-orange hover:underline"
                >
                  abrir no SEI
                  <ExternalLink className="size-3" strokeWidth={2.25} />
                </a>
              )}
            </p>
          </div>
          {!editando && (
            <button type="button" onClick={() => setEditando(true)} className={BTN_OUTLINE}>
              <Pencil className="size-3.5" strokeWidth={2.25} />
              Editar contrato
            </button>
          )}
        </div>
      </div>

      {editando && (
        <FormularioContrato
          clienteId={clienteId}
          contrato={contrato}
          aoSalvar={(salvo) => {
            setContrato((atual) => (atual ? { ...atual, ...salvo } : atual))
            setEditando(false)
          }}
          aoCancelar={() => setEditando(false)}
        />
      )}

      <CartaoSaldo contrato={contrato} />
      <SecaoHistorico contratoId={contrato.id} historico={contrato.historico} aoMudar={carregar} />
      <SecaoItens contratoId={contrato.id} itens={contrato.itens} aoMudar={carregar} />
    </main>
  )
}
