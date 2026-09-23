'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ChevronRight, Loader2, Pencil } from 'lucide-react'
import { BTN_OUTLINE } from '@/lib/ui'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import { SeiLink } from '@/components/relatorios-clientes/sei-link'
import { SecaoTermos } from '@/components/relatorios-clientes/secao-termos'
import { FormularioFornecedor, type Fornecedor } from '../formulario-fornecedor'
import { SecaoCos, type Co } from './secao-cos'

interface FornecedorDetalhe extends Fornecedor {
  cos: Co[]
}

export default function FornecedorDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [fornecedor, setFornecedor] = useState<FornecedorDetalhe | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)

  async function carregar() {
    try {
      const response = await fetch(`/api/fornecedores/${id}`)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErro(body?.error ?? 'Falha ao carregar o fornecedor.')
        return
      }
      setErro(null)
      setFornecedor(await response.json())
    } catch {
      setErro('Falha de conexão ao carregar o fornecedor.')
    }
  }

  useEffect(() => {
    carregar().finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (carregando) {
    return (
      <main className="mx-auto max-w-[110rem] px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 text-sm text-mid-grey">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          Carregando...
        </p>
      </main>
    )
  }

  if (!fornecedor) {
    return (
      <main className="mx-auto max-w-[110rem] px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 rounded-xl bg-red-crit-light p-4 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro ?? 'Fornecedor não encontrado.'}
        </p>
      </main>
    )
  }

  const acordo = [
    fornecedor.acordo && `Acordo ${fornecedor.acordo}`,
    fornecedor.numeroAcordo,
    fornecedor.dataAssinatura && `assinado em ${formatarData(fornecedor.dataAssinatura)}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <main className="mx-auto max-w-[110rem] space-y-8 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Relatórios</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <Link href="/fornecedores" className="hover:text-navy hover:underline">
            Fornecedores
          </Link>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy">{fornecedor.razaoSocial}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">{fornecedor.razaoSocial}</h1>
            {acordo && <p className="text-sm text-mid-grey">{acordo}</p>}
            {(fornecedor.cnpj || fornecedor.sei || fornecedor.contato) && (
              <p className="mt-1 flex flex-wrap gap-x-4 font-mono text-xs text-mid-grey">
                {fornecedor.cnpj && <span>CNPJ {fornecedor.cnpj}</span>}
                {fornecedor.sei && (
                  <span className="inline-flex items-center gap-1">
                    SEI <SeiLink numero={fornecedor.sei} />
                  </span>
                )}
                {fornecedor.contato && <span className="font-sans">{fornecedor.contato}</span>}
              </p>
            )}
          </div>
          {!editando && (
            <button type="button" onClick={() => setEditando(true)} className={BTN_OUTLINE}>
              <Pencil className="size-3.5" strokeWidth={2.25} />
              Editar fornecedor
            </button>
          )}
        </div>
      </div>

      {editando && (
        <FormularioFornecedor
          fornecedor={fornecedor}
          aoSalvar={(salvo) => {
            setFornecedor((atual) => (atual ? { ...atual, ...salvo } : atual))
            setEditando(false)
          }}
          aoCancelar={() => setEditando(false)}
        />
      )}

      <SecaoCos fornecedorId={fornecedor.id} cos={fornecedor.cos} aoMudar={carregar} />

      <SecaoTermos por="fornecedor" id={fornecedor.id} />
    </main>
  )
}
