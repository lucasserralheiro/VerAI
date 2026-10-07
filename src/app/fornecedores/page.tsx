'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AlertCircle, ChevronRight, Loader2, Plus, Search, Truck } from 'lucide-react'
import { BTN_OUTLINE, BTN_PRIMARY, INPUT_BASE } from '@/lib/ui'
import { SeiLink } from '@/components/relatorios-clientes/sei-link'
import { SeletorCarteira, comCarteira, useCarteiraFoco } from '@/components/carteira/carteira-foco'
import type { Fornecedor } from './formulario-fornecedor'
import { ModalFornecedor } from './modal-fornecedor'

interface FornecedorNaLista extends Fornecedor {
  totalCos: number
  totalTermos: number
}

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<FornecedorNaLista[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [criando, setCriando] = useState(false)
  // Fornecedor é cadastro comum; com carteira em foco a lista mostra quem tem termo com clientes dela.
  const { foco, pronto } = useCarteiraFoco()

  async function carregar(q = '') {
    try {
      const response = await fetch(comCarteira(q ? `/api/fornecedores?q=${encodeURIComponent(q)}` : '/api/fornecedores', foco))
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErro(body?.error ?? 'Falha ao carregar fornecedores.')
        return
      }
      setErro(null)
      setFornecedores(await response.json())
    } catch {
      setErro('Falha de conexão ao carregar fornecedores.')
    }
  }

  useEffect(() => {
    if (!pronto) return
    carregar(busca.trim()).finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco, pronto])

  function handleBuscar(event: FormEvent) {
    event.preventDefault()
    void carregar(busca.trim())
  }

  return (
    <main className="mx-auto max-w-[110rem] space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Relatórios</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy">Fornecedores</span>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">Fornecedores</h1>
            <p className="text-sm text-mid-grey">
              Acordos, contratos de operacionalização e termos de confirmação
              {foco && ' — só quem tem termo com clientes da carteira em foco'}
            </p>
            <SeletorCarteira className="mt-2" />
          </div>
          <button type="button" onClick={() => setCriando(true)} className={BTN_PRIMARY}>
            <Plus className="size-3.5" strokeWidth={2.25} />
            Novo fornecedor
          </button>
        </div>
      </div>

      <ModalFornecedor
        aberto={criando}
        aoFechar={() => setCriando(false)}
        aoSalvar={async () => {
          setCriando(false)
          await carregar(busca.trim())
        }}
      />

      <form role="search" onSubmit={handleBuscar} className="flex max-w-md gap-2">
        <input
          aria-label="Buscar fornecedor"
          type="search"
          placeholder="Razão social ou CNPJ"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className={`${INPUT_BASE} flex-1`}
        />
        <button type="submit" className={BTN_OUTLINE}>
          <Search className="size-3.5" strokeWidth={2.25} />
          Buscar
        </button>
      </form>

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-mid-grey">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          Carregando...
        </p>
      ) : erro ? (
        <p className="flex items-center gap-1.5 rounded-xl bg-red-crit-light p-4 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </p>
      ) : fornecedores.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <Truck className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhum fornecedor encontrado.</p>
        </div>
      ) : (
        <div className="card-flush overflow-x-auto">
          <table className="table-institucional">
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>Acordo</th>
                <th>Nº do acordo</th>
                <th>Processo SEI</th>
                <th>CO</th>
                <th>Termos</th>
              </tr>
            </thead>
            <tbody>
              {fornecedores.map((fornecedor) => (
                <tr key={fornecedor.id}>
                  <td>
                    <Link href={`/fornecedores/${fornecedor.id}`} className="font-semibold text-navy hover:text-orange hover:underline">
                      {fornecedor.razaoSocial}
                    </Link>
                  </td>
                  <td>{fornecedor.acordo ?? '—'}</td>
                  <td className="font-mono text-xs">{fornecedor.numeroAcordo ?? '—'}</td>
                  <td>
                    <SeiLink numero={fornecedor.sei} />
                  </td>
                  <td>{fornecedor.totalCos}</td>
                  <td>{fornecedor.totalTermos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
