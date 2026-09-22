'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, FileSignature, Loader2, Plus } from 'lucide-react'
import { BTN_PRIMARY } from '@/lib/ui'
import { formatarData, formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import { BarraFaturado, PillVencimento } from '@/components/relatorios-clientes/indicadores-contrato'
import { FormularioContrato, type Contrato } from '../contratos/formulario-contrato'

export function AbaContratos({ clienteId }: { clienteId: string }) {
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)

  async function carregar() {
    try {
      const response = await fetch(`/api/clientes/${clienteId}/contratos`)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErro(body?.error ?? 'Falha ao carregar contratos.')
        return
      }
      setErro(null)
      const lista = await response.json()
      setContratos(Array.isArray(lista) ? lista : [])
    } catch {
      setErro('Falha de conexão ao carregar contratos.')
    }
  }

  useEffect(() => {
    carregar().finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  if (carregando) {
    return (
      <p className="flex items-center gap-2 text-sm text-mid-grey">
        <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        Carregando...
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.95rem] font-semibold text-navy">Contratos de receita</h2>
          <p className="text-xs text-mid-grey">
            Cabeçalho + histórico (contrato, aditivo, prorrogação, rescisão) numa linha do tempo só
          </p>
        </div>
        {!criando && (
          <button type="button" onClick={() => setCriando(true)} className={BTN_PRIMARY}>
            <Plus className="size-3.5" strokeWidth={2.25} />
            Novo contrato
          </button>
        )}
      </div>

      {criando && (
        <FormularioContrato
          clienteId={clienteId}
          aoSalvar={async () => {
            setCriando(false)
            await carregar()
          }}
          aoCancelar={() => setCriando(false)}
        />
      )}

      {erro ? (
        <p className="flex items-center gap-1.5 rounded-xl bg-red-crit-light p-4 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </p>
      ) : contratos.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <FileSignature className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhum contrato cadastrado.</p>
        </div>
      ) : (
        <div className="card-flush overflow-x-auto">
          <table className="table-institucional">
            <thead>
              <tr>
                <th>Nº do termo</th>
                <th>Descrição</th>
                <th>SEI cliente</th>
                <th>Situação</th>
                <th>Vencimento</th>
                <th>Valor dos itens</th>
                <th>Faturado</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((contrato) => (
                <tr key={contrato.id}>
                  <td className="font-mono text-xs">
                    <Link
                      href={`/clientes/${clienteId}/contratos/${contrato.id}`}
                      className="font-semibold text-navy hover:text-orange hover:underline"
                    >
                      {contrato.numeroTermo ?? '(sem número)'}
                    </Link>
                  </td>
                  <td>{contrato.descricao ?? '—'}</td>
                  <td className="font-mono text-xs">{contrato.seiCliente ?? '—'}</td>
                  <td>
                    <div className="flex flex-col items-start gap-1">
                      <PillVencimento vencimento={contrato.vencimento} />
                      {contrato.situacao && <span className="text-xs text-mid-grey">{contrato.situacao}</span>}
                    </div>
                  </td>
                  <td className="font-mono text-xs whitespace-nowrap">{formatarData(contrato.dataVencimento)}</td>
                  <td className="font-mono text-xs font-semibold whitespace-nowrap text-navy">
                    {contrato.saldo.percentualFaturado === null ? '—' : formatarMoeda(contrato.saldo.valorItens)}
                  </td>
                  <td>
                    <BarraFaturado saldo={contrato.saldo} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
