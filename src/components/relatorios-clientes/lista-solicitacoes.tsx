'use client'

// Lista de solicitações: serve à aba "Solicitações" da ficha do cliente (`clienteId` fixo, sem coluna nem
// filtro de cliente) e à lista geral /solicitacoes (cross-cliente). Mesmo desenho de `lista-demandas.tsx`.

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AlertCircle, ChevronRight, Inbox, Loader2, Plus, Search } from 'lucide-react'
import { BTN_OUTLINE, BTN_OUTLINE_SM, BTN_PRIMARY, INPUT_BASE } from '@/lib/ui'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import { usePermissaoCliente } from '@/app/clientes/[id]/permissao-cliente'
import { SeletorCarteira, comCarteira, useCarteiraFoco } from '@/components/carteira/carteira-foco'
import { rotuloCliente, type OpcaoCliente } from './formulario-demanda'

interface Solicitacao {
  id: string
  clienteId: string
  tipo: string | null
  numero: string | null
  descricao: string | null
  situacao: string | null
  dataAbertura: string | null
  dataFinal: string | null
  comVisita: boolean | null
  observacao: string | null
  cliente: OpcaoCliente
}

interface Sugestoes {
  tipo: string[]
  situacao: string[]
}

type CampoTexto = 'clienteId' | 'descricao' | 'numero' | 'tipo' | 'situacao' | 'dataAbertura' | 'dataFinal' | 'observacao'

const CAMPOS: Array<{ campo: Exclude<CampoTexto, 'clienteId'>; rotulo: string; tipo?: string; sugestao?: keyof Sugestoes; largo?: boolean }> = [
  { campo: 'descricao', rotulo: 'Assunto', largo: true },
  { campo: 'numero', rotulo: 'Nº do chamado' },
  { campo: 'tipo', rotulo: 'Tipo', sugestao: 'tipo' },
  { campo: 'situacao', rotulo: 'Situação', sugestao: 'situacao' },
  { campo: 'dataAbertura', rotulo: 'Abertura', tipo: 'date' },
  { campo: 'dataFinal', rotulo: 'Conclusão', tipo: 'date' },
  { campo: 'observacao', rotulo: 'Observação', largo: true },
]

function paraFormulario(solicitacao?: Solicitacao, clienteFixo?: string): Record<CampoTexto, string> {
  return {
    clienteId: solicitacao?.clienteId ?? clienteFixo ?? '',
    descricao: solicitacao?.descricao ?? '',
    numero: solicitacao?.numero ?? '',
    tipo: solicitacao?.tipo ?? '',
    situacao: solicitacao?.situacao ?? '',
    dataAbertura: solicitacao?.dataAbertura?.slice(0, 10) ?? '',
    dataFinal: solicitacao?.dataFinal?.slice(0, 10) ?? '',
    observacao: solicitacao?.observacao ?? '',
  }
}

/** Modal nativo (<dialog> + showModal()), mesmo padrão de clientes/modal-cliente.tsx. */
function ModalSolicitacao({
  aberto,
  aoFechar,
  children,
}: {
  aberto: boolean
  aoFechar: () => void
  children: ReactNode
}) {
  const dialogoRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialogoRef.current
    if (!el) return
    if (aberto && !el.open) el.showModal()
    else if (!aberto && el.open) el.close()
  }, [aberto])

  return (
    <dialog
      ref={dialogoRef}
      onClose={aoFechar}
      onClick={(e) => {
        if (e.target === dialogoRef.current) dialogoRef.current?.close()
      }}
      aria-label="Solicitação"
      className="w-[min(56rem,calc(100vw-2rem))] border-0 bg-transparent p-0"
    >
      {aberto && children}
    </dialog>
  )
}

function FormularioSolicitacao({
  solicitacao,
  clientes,
  sugestoes,
  aoSalvar,
  aoCancelar,
  clienteFixo,
}: {
  solicitacao?: Solicitacao
  clientes: OpcaoCliente[] | null
  /** Na ficha do cliente: o cliente já está decidido e o campo some. */
  clienteFixo?: string
  sugestoes: Sugestoes | null
  aoSalvar: () => Promise<void>
  aoCancelar: () => void
}) {
  const titulo = solicitacao ? 'Editar solicitação' : 'Nova solicitação'
  const [campos, setCampos] = useState(() => paraFormulario(solicitacao, clienteFixo))
  const [comVisita, setComVisita] = useState(solicitacao?.comVisita ?? false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)
    try {
      const response = await fetch(solicitacao ? `/api/solicitacoes/${solicitacao.id}` : '/api/solicitacoes', {
        method: solicitacao ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...campos, comVisita }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErro(body?.error ?? 'Falha ao salvar solicitação.')
        return
      }
      await aoSalvar()
    } catch {
      setErro('Falha de conexão ao salvar solicitação.')
    } finally {
      setSalvando(false)
    }
  }

  const alterar = (campo: CampoTexto, valor: string) => setCampos((atual) => ({ ...atual, [campo]: valor }))

  return (
    <form aria-label={titulo} onSubmit={handleSubmit} className="card space-y-3">
      <h3 className="text-sm font-semibold text-navy">{titulo}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!clienteFixo && (
        <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-mid-grey">Cliente</span>
            <select aria-label="Cliente" value={campos.clienteId} onChange={(e) => alterar('clienteId', e.target.value)} required className={INPUT_BASE}>
              <option value="">{clientes ? 'Selecione...' : 'Carregando...'}</option>
              {clientes?.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {rotuloCliente(cliente)}
                </option>
              ))}
            </select>
          </label>
        )}
        {CAMPOS.map(({ campo, rotulo, tipo, sugestao, largo }) => (
          <label key={campo} className={`flex flex-col gap-1 text-sm ${largo ? 'lg:col-span-2' : ''}`}>
            <span className="text-xs font-medium text-mid-grey">{rotulo}</span>
            <input
              aria-label={rotulo}
              type={tipo ?? 'text'}
              list={sugestao ? `sugestoes-solicitacao-${sugestao}` : undefined}
              value={campos[campo]}
              onChange={(e) => alterar(campo, e.target.value)}
              required={campo === 'descricao'}
              className={INPUT_BASE}
            />
          </label>
        ))}
      </div>
      {sugestoes &&
        (Object.keys(sugestoes) as Array<keyof Sugestoes>).map((chave) => (
          <datalist key={chave} id={`sugestoes-solicitacao-${chave}`}>
            {sugestoes[chave].map((valor) => (
              <option key={valor} value={valor} />
            ))}
          </datalist>
        ))}
      <label className="flex items-center gap-2 text-sm text-navy">
        <input type="checkbox" checked={comVisita} onChange={(e) => setComVisita(e.target.checked)} className="size-4 accent-orange" />
        Com visita
      </label>
      {erro && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={salvando} className={BTN_PRIMARY}>
          Salvar
        </button>
        <button type="button" onClick={aoCancelar} className={BTN_OUTLINE}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export function ListaSolicitacoes({ clienteId }: { clienteId?: string }) {
  const geral = !clienteId
  const { podeEditar } = usePermissaoCliente()
  // Na lista geral vale a carteira em foco; dentro do cliente, não.
  const { foco: focoCarteira, pronto } = useCarteiraFoco()
  const foco = geral ? focoCarteira : null
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([])
  const [sugestoes, setSugestoes] = useState<Sugestoes | null>(null)
  const [clientes, setClientes] = useState<OpcaoCliente[] | null>(null)
  const [filtros, setFiltros] = useState({ clienteId: clienteId ?? '', situacao: '' })
  const [busca, setBusca] = useState('')
  const [q, setQ] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  // null = formulário fechado; 'nova' = criando; id = editando aquela solicitação
  const [editando, setEditando] = useState<string | null>(null)

  async function carregar() {
    const params = new URLSearchParams()
    if (filtros.clienteId) params.set('clienteId', filtros.clienteId)
    if (filtros.situacao) params.set('situacao', filtros.situacao)
    if (q) params.set('q', q)
    const query = params.toString()
    try {
      const response = await fetch(comCarteira(`/api/solicitacoes${query ? `?${query}` : ''}`, foco))
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErro(body?.error ?? 'Falha ao carregar solicitações.')
        return
      }
      setErro(null)
      const corpo = await response.json()
      setSolicitacoes(Array.isArray(corpo?.solicitacoes) ? corpo.solicitacoes : [])
      setSugestoes(corpo?.sugestoes ?? null)
    } catch {
      setErro('Falha de conexão ao carregar solicitações.')
    }
  }

  useEffect(() => {
    if (geral && !pronto) return
    carregar().finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros, q, foco, pronto])

  // Trocou a carteira: o cliente escolhido no filtro pode não ser dela.
  useEffect(() => {
    if (geral) setFiltros((atual) => (atual.clienteId ? { ...atual, clienteId: '' } : atual))
  }, [geral, foco])

  // Lista de clientes só na lista geral (filtro e select do formulário).
  useEffect(() => {
    if (!geral || !pronto) return
    fetch(comCarteira('/api/clientes', foco))
      .then(async (response) => {
        if (!response.ok) return
        const lista = await response.json()
        if (Array.isArray(lista)) setClientes(lista)
      })
      .catch(() => {})
  }, [geral, foco, pronto])

  function handleBuscar(event: FormEvent) {
    event.preventDefault()
    setQ(busca.trim())
  }

  const emEdicao = solicitacoes.find((solicitacao) => solicitacao.id === editando)

  const botaoNova = podeEditar && (
    <button type="button" onClick={() => setEditando('nova')} className={BTN_PRIMARY}>
      <Plus className="size-3.5" strokeWidth={2.25} />
      Nova solicitação
    </button>
  )

  return (
    <div className="space-y-6">
      {geral ? (
        <div className="space-y-3">
          <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
            <span>Relatórios</span>
            <ChevronRight className="size-3" strokeWidth={2.5} />
            <span className="font-semibold text-navy">Solicitações</span>
          </nav>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">Solicitações</h1>
              <p className="text-sm text-mid-grey">Chamados (RDM, solicitações) abertos pelos clientes</p>
            </div>
            {botaoNova}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-mid-grey">Chamados (RDM, solicitações) abertos por este cliente</p>
          {botaoNova}
        </div>
      )}

      <ModalSolicitacao aberto={editando !== null} aoFechar={() => setEditando(null)}>
        <FormularioSolicitacao
          key={editando}
          solicitacao={emEdicao}
          clientes={clientes}
          clienteFixo={clienteId}
          sugestoes={sugestoes}
          aoSalvar={async () => {
            setEditando(null)
            await carregar()
          }}
          aoCancelar={() => setEditando(null)}
        />
      </ModalSolicitacao>

      <div className="flex flex-wrap items-center gap-2">
        {geral && <SeletorCarteira />}
        {geral && (
        <select
            aria-label="Filtrar por cliente"
            value={filtros.clienteId}
            onChange={(e) => setFiltros((atual) => ({ ...atual, clienteId: e.target.value }))}
            className={INPUT_BASE}
          >
            <option value="">Todos os clientes</option>
            {clientes?.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {rotuloCliente(cliente)}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Filtrar por situação"
          value={filtros.situacao}
          onChange={(e) => setFiltros((atual) => ({ ...atual, situacao: e.target.value }))}
          className={INPUT_BASE}
        >
          <option value="">Todas as situações</option>
          {sugestoes?.situacao.map((situacao) => (
            <option key={situacao} value={situacao}>
              {situacao}
            </option>
          ))}
        </select>
        <form role="search" onSubmit={handleBuscar} className="flex gap-2">
          <input
            aria-label="Buscar solicitação"
            type="search"
            placeholder="Assunto ou nº do chamado"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className={`${INPUT_BASE} w-64`}
          />
          <button type="submit" className={BTN_OUTLINE}>
            <Search className="size-3.5" strokeWidth={2.25} />
            Buscar
          </button>
        </form>
      </div>

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
      ) : solicitacoes.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <Inbox className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhuma solicitação encontrada.</p>
        </div>
      ) : (
        <div className="card-flush overflow-x-auto">
          <table className="table-institucional">
            <thead>
              <tr>
                {geral && <th>Cliente</th>}
                <th>Nº</th>
                <th>Assunto</th>
                <th>Tipo</th>
                <th>Abertura</th>
                <th>Situação</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {solicitacoes.map((solicitacao) => (
                <tr key={solicitacao.id}>
                  {geral && (
                    <td className="font-mono text-xs font-semibold">{solicitacao.cliente.siglaLegado ?? solicitacao.cliente.nome}</td>
                  )}
                  <td className="font-mono text-xs">{solicitacao.numero ?? '—'}</td>
                  <td>{solicitacao.descricao ?? '—'}</td>
                  <td>{solicitacao.tipo ?? '—'}</td>
                  <td className="font-mono text-xs whitespace-nowrap">{formatarData(solicitacao.dataAbertura)}</td>
                  <td>{solicitacao.situacao ?? '—'}</td>
                  <td className="text-right">
                    {editando === null && podeEditar && (
                      <button type="button" onClick={() => setEditando(solicitacao.id)} className={BTN_OUTLINE_SM}>
                        Editar
                      </button>
                    )}
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
