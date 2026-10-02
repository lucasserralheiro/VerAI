'use client'

import { usePermissaoCliente } from '../../permissao-cliente'
import { useState, type FormEvent } from 'react'
import { AlertCircle, FileSpreadsheet, Link2, Package, Plus, Search } from 'lucide-react'
import { BTN_OUTLINE, BTN_OUTLINE_SM, BTN_PRIMARY, INPUT_BASE, LINK_DANGER } from '@/lib/ui'
import { formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import { ImportarPlanilhaItens } from './importar-planilha-itens'

export interface Item {
  id: string
  contratoId: string | null
  contratoTextoLegado: string | null
  descricao: string | null
  quantidade: string | null
  valorUnitario: string | null
  valorTotal: string
}

type CampoItem = 'descricao' | 'quantidade' | 'valorUnitario' | 'valorTotal'

const CAMPOS: Array<{ campo: CampoItem; rotulo: string }> = [
  { campo: 'descricao', rotulo: 'Descrição' },
  { campo: 'quantidade', rotulo: 'Quantidade' },
  { campo: 'valorUnitario', rotulo: 'Valor unitário' },
  { campo: 'valorTotal', rotulo: 'Valor total' },
]

const FORMULARIO_VAZIO: Record<CampoItem, string> = { descricao: '', quantidade: '', valorUnitario: '', valorTotal: '' }

async function mensagemDeErro(response: Response, padrao: string) {
  const body = await response.json().catch(() => null)
  return body?.error ?? padrao
}

/** Busca os itens importados do GRC-1 sem contrato (design doc §3.6) e vincula a este contrato. */
function VincularItens({ contratoId, aoVincular }: { contratoId: string; aoVincular: () => Promise<void> }) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<Item[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function handleBuscar(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    try {
      const response = await fetch(`/api/itens-contrato?semContrato=1&contratoId=${contratoId}&q=${encodeURIComponent(busca.trim())}`)
      if (!response.ok) {
        setErro(await mensagemDeErro(response, 'Falha ao buscar itens importados.'))
        return
      }
      setResultados(await response.json())
    } catch {
      setErro('Falha de conexão ao buscar itens importados.')
    }
  }

  async function handleVincular(itemId: string) {
    setErro(null)
    try {
      const response = await fetch(`/api/itens-contrato/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contratoId }),
      })
      if (!response.ok) {
        setErro(await mensagemDeErro(response, 'Falha ao vincular o item.'))
        return
      }
      setResultados((atual) => atual?.filter((item) => item.id !== itemId) ?? null)
      await aoVincular()
    } catch {
      setErro('Falha de conexão ao vincular o item.')
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-navy">Vincular itens importados</h3>
        <p className="text-xs text-mid-grey">
          Itens vindos do sistema legado sem contrato identificado. Busque pelo texto do contrato no legado ou pela descrição.
        </p>
      </div>
      <form role="search" onSubmit={handleBuscar} className="flex max-w-md gap-2">
        <input
          aria-label="Buscar item importado"
          type="search"
          placeholder="Ex.: 031/SEME/2017"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className={`${INPUT_BASE} flex-1`}
        />
        <button type="submit" className={BTN_OUTLINE}>
          <Search className="size-3.5" strokeWidth={2.25} />
          Buscar
        </button>
      </form>
      {erro && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </p>
      )}
      {resultados !== null &&
        (resultados.length === 0 ? (
          <p className="text-sm text-mid-grey">Nenhum item sem contrato encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-institucional">
              <thead>
                <tr>
                  <th>Contrato (legado)</th>
                  <th>Descrição</th>
                  <th>Valor total</th>
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono text-xs">{item.contratoTextoLegado ?? '—'}</td>
                    <td>{item.descricao ?? '—'}</td>
                    <td className="font-mono text-xs whitespace-nowrap">{formatarMoeda(item.valorTotal)}</td>
                    <td className="text-right">
                      <button type="button" onClick={() => handleVincular(item.id)} className={BTN_OUTLINE_SM}>
                        <Link2 className="size-3" strokeWidth={2.25} />
                        Vincular
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  )
}

export function SecaoItens({ contratoId, itens, aoMudar }: { contratoId: string; itens: Item[]; aoMudar: () => Promise<void> }) {
  const { podeEditar } = usePermissaoCliente()
  // null = formulário fechado; 'novo' = criando; id = editando aquele item
  const [editando, setEditando] = useState<string | null>(null)
  const [vinculando, setVinculando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [formulario, setFormulario] = useState(FORMULARIO_VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null)

  function abrirFormulario(item?: Item) {
    setErro(null)
    setEditando(item?.id ?? 'novo')
    setFormulario(
      item
        ? {
            descricao: item.descricao ?? '',
            quantidade: item.quantidade ?? '',
            valorUnitario: item.valorUnitario ?? '',
            valorTotal: item.valorTotal,
          }
        : FORMULARIO_VAZIO
    )
  }

  async function handleSalvar(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)
    const criando = editando === 'novo'
    try {
      const response = await fetch(criando ? `/api/contratos/${contratoId}/itens` : `/api/itens-contrato/${editando}`, {
        method: criando ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formulario),
      })
      if (!response.ok) {
        setErro(await mensagemDeErro(response, 'Falha ao salvar o item.'))
        return
      }
      setEditando(null)
      await aoMudar()
    } catch {
      setErro('Falha de conexão ao salvar o item.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir(id: string) {
    setConfirmandoExclusao(null)
    setErroExclusao(null)
    try {
      const response = await fetch(`/api/itens-contrato/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        setErroExclusao(await mensagemDeErro(response, 'Falha ao excluir o item.'))
        return
      }
      await aoMudar()
    } catch {
      setErroExclusao('Falha de conexão ao excluir o item.')
    }
  }

  return (
    <section aria-label="Itens do contrato" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.95rem] font-semibold text-navy">Itens</h2>
          <p className="text-xs text-mid-grey">Sem valor no histórico, a soma dos itens vira o valor contratado</p>
        </div>
        {podeEditar && editando === null && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setVinculando((atual) => !atual)} className={BTN_OUTLINE}>
              <Link2 className="size-3.5" strokeWidth={2.25} />
              Vincular itens importados
            </button>
            <button type="button" onClick={() => setImportando((atual) => !atual)} className={BTN_OUTLINE}>
              <FileSpreadsheet className="size-3.5" strokeWidth={2.25} />
              Importar planilha
            </button>
            <button type="button" onClick={() => abrirFormulario()} className={BTN_PRIMARY}>
              <Plus className="size-3.5" strokeWidth={2.25} />
              Novo item
            </button>
          </div>
        )}
      </div>

      {vinculando && editando === null && <VincularItens contratoId={contratoId} aoVincular={aoMudar} />}
      {importando && editando === null && (
        <ImportarPlanilhaItens
          contratoId={contratoId}
          aoImportar={async () => {
            setImportando(false)
            await aoMudar()
          }}
        />
      )}

      {editando !== null && (
        <form onSubmit={handleSalvar} className="card space-y-3">
          <h3 className="text-sm font-semibold text-navy">{editando === 'novo' ? 'Novo item' : 'Editar item'}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CAMPOS.map(({ campo, rotulo }) => (
              <label key={campo} className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-mid-grey">{rotulo}</span>
                <input
                  aria-label={rotulo}
                  type="text"
                  inputMode={campo === 'descricao' ? undefined : 'decimal'}
                  value={formulario[campo]}
                  onChange={(e) => setFormulario((atual) => ({ ...atual, [campo]: e.target.value }))}
                  className={INPUT_BASE}
                />
              </label>
            ))}
          </div>
          <p className="text-xs text-mid-grey">Sem valor total, ele é calculado como quantidade × valor unitário.</p>
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
            <button type="button" onClick={() => setEditando(null)} className={BTN_OUTLINE}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {erroExclusao && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erroExclusao}
        </p>
      )}

      {itens.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <Package className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhum item vinculado a este contrato.</p>
        </div>
      ) : (
        <div className="card-flush overflow-x-auto">
          <table className="table-institucional">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Qtd</th>
                <th>Valor unitário</th>
                <th>Valor total</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.descricao ?? '—'}
                    {item.contratoTextoLegado && (
                      <span className="block font-mono text-[0.7rem] text-mid-grey">legado: {item.contratoTextoLegado}</span>
                    )}
                  </td>
                  <td className="font-mono text-xs">{item.quantidade ?? '—'}</td>
                  <td className="font-mono text-xs whitespace-nowrap">{formatarMoeda(item.valorUnitario)}</td>
                  <td className="font-mono text-xs font-semibold whitespace-nowrap text-navy">{formatarMoeda(item.valorTotal)}</td>
                  <td>
                    <div className="flex items-center justify-end gap-3 text-xs">
                      {!podeEditar ? null : confirmandoExclusao === item.id ? (
                        <>
                          <span className="font-medium text-red-crit">Excluir?</span>
                          <button type="button" onClick={() => handleExcluir(item.id)} className={LINK_DANGER}>
                            Sim
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmandoExclusao(null)}
                            className="font-medium text-mid-grey hover:text-navy hover:underline"
                          >
                            Não
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => abrirFormulario(item)} className={BTN_OUTLINE_SM}>
                            Editar
                          </button>
                          <button type="button" onClick={() => setConfirmandoExclusao(item.id)} className={LINK_DANGER}>
                            Excluir
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
