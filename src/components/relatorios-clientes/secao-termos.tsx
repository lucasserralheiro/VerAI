'use client'

// Termo de confirmação é a ponte fornecedor ↔ cliente: a mesma lista/formulário aparece na aba
// "Fornecedores" da ficha do cliente (`por="cliente"`, escolhe-se o fornecedor) e na ficha do
// fornecedor (`por="fornecedor"`, escolhe-se o cliente). Mesma API: /api/termos-confirmacao.
// O seletor "Contrato ligado" lista os contratos do cliente do termo (a API recusa contrato de
// outro cliente).

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, FileSignature, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { BTN_OUTLINE, BTN_PRIMARY, INPUT_BASE, LINK_DANGER } from '@/lib/ui'
import { formatarData, formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import { SeiLink } from './sei-link'

export interface Termo {
  id: string
  fornecedorId: string
  clienteId: string
  contratoId: string | null
  numero: string | null
  valor: string | null
  vigenciaInicio: string | null
  vigenciaFim: string | null
  sei: string | null
  observacao: string | null
  fornecedor: { id: string; razaoSocial: string }
  cliente: { id: string; nome: string; siglaLegado: string | null }
  contrato: { id: string; numeroTermo: string | null } | null
}

interface Opcao {
  id: string
  rotulo: string
}

type CamposTexto = 'numero' | 'valor' | 'vigenciaInicio' | 'vigenciaFim' | 'sei' | 'observacao'
type Formulario = Record<CamposTexto | 'outroLadoId' | 'contratoId', string>

const FORMULARIO_VAZIO: Formulario = {
  outroLadoId: '',
  contratoId: '',
  numero: '',
  valor: '',
  vigenciaInicio: '',
  vigenciaFim: '',
  sei: '',
  observacao: '',
}

const CAMPOS: Array<{ campo: CamposTexto; rotulo: string; tipo?: string }> = [
  { campo: 'numero', rotulo: 'Nº do TC' },
  { campo: 'valor', rotulo: 'Valor' },
  { campo: 'vigenciaInicio', rotulo: 'Início da vigência', tipo: 'date' },
  { campo: 'vigenciaFim', rotulo: 'Fim da vigência', tipo: 'date' },
  { campo: 'sei', rotulo: 'Processo SEI' },
  { campo: 'observacao', rotulo: 'Observação' },
]

function paraFormulario(termo: Termo, por: 'cliente' | 'fornecedor'): Formulario {
  return {
    outroLadoId: por === 'cliente' ? termo.fornecedorId : termo.clienteId,
    contratoId: termo.contratoId ?? '',
    numero: termo.numero ?? '',
    valor: termo.valor ?? '',
    vigenciaInicio: termo.vigenciaInicio?.slice(0, 10) ?? '',
    vigenciaFim: termo.vigenciaFim?.slice(0, 10) ?? '',
    sei: termo.sei ?? '',
    observacao: termo.observacao ?? '',
  }
}

function vigencia(termo: Termo): string {
  if (!termo.vigenciaInicio && !termo.vigenciaFim) return '—'
  return `${formatarData(termo.vigenciaInicio)} – ${formatarData(termo.vigenciaFim)}`
}

function rotuloCliente(cliente: { nome: string; siglaLegado: string | null }) {
  return cliente.siglaLegado ? `${cliente.siglaLegado} — ${cliente.nome}` : cliente.nome
}

function rotuloOutroLadoDoTermo(termo: Termo, por: 'cliente' | 'fornecedor') {
  return por === 'cliente' ? termo.fornecedor.razaoSocial : rotuloCliente(termo.cliente)
}

async function mensagemDeErro(response: Response, padrao: string) {
  const body = await response.json().catch(() => null)
  return body?.error ?? padrao
}

export function SecaoTermos({ por, id }: { por: 'cliente' | 'fornecedor'; id: string }) {
  const [termos, setTermos] = useState<Termo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroLista, setErroLista] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  // 'novo' = criando um termo; um Termo = editando aquela linha; null = modal fechado.
  const [modalTermo, setModalTermo] = useState<'novo' | Termo | null>(null)

  const rotuloOutroLado = por === 'cliente' ? 'Fornecedor' : 'Cliente'

  async function carregar() {
    try {
      const response = await fetch(`/api/termos-confirmacao?${por === 'cliente' ? 'clienteId' : 'fornecedorId'}=${id}`)
      if (!response.ok) {
        setErroLista(await mensagemDeErro(response, 'Falha ao carregar os termos de confirmação.'))
        return
      }
      setErroLista(null)
      setTermos(await response.json())
    } catch {
      setErroLista('Falha de conexão ao carregar os termos de confirmação.')
    }
  }

  useEffect(() => {
    carregar().finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [por, id])

  const termosFiltrados = useMemo(() => {
    const termoBusca = busca.trim().toLowerCase()
    if (!termoBusca) return termos
    return termos.filter((termo) =>
      [rotuloOutroLadoDoTermo(termo, por), termo.numero, termo.contrato?.numeroTermo, termo.sei, termo.observacao].some(
        (campo) => campo?.toLowerCase().includes(termoBusca)
      )
    )
  }, [termos, busca, por])

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
          <h2 className="text-[0.95rem] font-semibold text-navy">
            {por === 'cliente' ? 'Fornecedores ligados a este cliente' : 'Termos de confirmação'}
          </h2>
          <p className="text-xs text-mid-grey">
            {por === 'cliente'
              ? 'Via termo de confirmação (ponte fornecedor ↔ contrato de receita)'
              : 'Clientes atendidos por este fornecedor, via termo de confirmação'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Buscar termo de confirmação</span>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-mid-grey" strokeWidth={2.25} />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={`Buscar por ${rotuloOutroLado.toLowerCase()}, nº, SEI...`}
              className={`${INPUT_BASE} w-64 py-1.5 pl-8 text-sm`}
            />
          </label>
          <button type="button" onClick={() => setModalTermo('novo')} className={BTN_PRIMARY}>
            <Plus className="size-3.5" strokeWidth={2.25} />
            Novo termo de confirmação
          </button>
        </div>
      </div>

      {erroLista ? (
        <p className="flex items-center gap-1.5 rounded-xl bg-red-crit-light p-4 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erroLista}
        </p>
      ) : termos.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <FileSignature className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhum termo de confirmação cadastrado.</p>
        </div>
      ) : termosFiltrados.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <Search className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhum termo encontrado para &quot;{busca}&quot;.</p>
        </div>
      ) : (
        <div className="card-flush overflow-x-auto">
          <table className="table-institucional">
            <thead>
              <tr>
                <th>{rotuloOutroLado}</th>
                <th>Nº do TC</th>
                <th>Contrato ligado</th>
                <th>Valor</th>
                <th>Vigência</th>
                <th>Processo SEI</th>
              </tr>
            </thead>
            <tbody>
              {termosFiltrados.map((termo) => (
                <tr key={termo.id} onClick={() => setModalTermo(termo)} className="cursor-pointer">
                  <td className="font-semibold text-navy">{rotuloOutroLadoDoTermo(termo, por)}</td>
                  <td className="font-mono text-xs">{termo.numero ?? '—'}</td>
                  <td className="font-mono text-xs">{termo.contrato?.numeroTermo ?? '—'}</td>
                  <td className="font-mono text-xs whitespace-nowrap">{formatarMoeda(termo.valor)}</td>
                  <td className="font-mono text-xs whitespace-nowrap">{vigencia(termo)}</td>
                  <td>
                    <SeiLink numero={termo.sei} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ModalTermo
        estado={modalTermo}
        por={por}
        id={id}
        rotuloOutroLado={rotuloOutroLado}
        aoFechar={() => setModalTermo(null)}
        aoSalvar={async () => {
          setModalTermo(null)
          await carregar()
        }}
        aoExcluir={async () => {
          setModalTermo(null)
          await carregar()
        }}
      />
    </div>
  )
}

/** Modal nativo (`<dialog>` + `showModal()`) reaproveitando o mesmo formulário pra criar E
 *  editar — mesmo padrão do modal de contratos em `aba-contratos.tsx`. */
function ModalTermo({
  estado,
  por,
  id,
  rotuloOutroLado,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  estado: 'novo' | Termo | null
  por: 'cliente' | 'fornecedor'
  id: string
  rotuloOutroLado: string
  aoFechar: () => void
  aoSalvar: () => void
  aoExcluir: () => void
}) {
  const dialogoRef = useRef<HTMLDialogElement>(null)
  const termo = estado === 'novo' ? undefined : (estado ?? undefined)
  const aberto = estado !== null

  useEffect(() => {
    const el = dialogoRef.current
    if (!el) return
    if (aberto && !el.open) {
      el.showModal()
    } else if (!aberto && el.open) {
      el.close()
    }
  }, [aberto])

  return (
    <dialog
      ref={dialogoRef}
      onClose={aoFechar}
      onClick={(e) => {
        if (e.target === dialogoRef.current) dialogoRef.current?.close()
      }}
      aria-label={termo ? 'Editar termo de confirmação' : 'Novo termo de confirmação'}
      className="w-[min(44rem,calc(100vw-2rem))] border-0 bg-transparent p-0"
    >
      {aberto && (
        <ConteudoModalTermo
          key={termo?.id ?? 'novo'}
          por={por}
          id={id}
          rotuloOutroLado={rotuloOutroLado}
          termo={termo}
          aoSalvar={aoSalvar}
          aoExcluir={aoExcluir}
          aoCancelar={() => dialogoRef.current?.close()}
        />
      )}
    </dialog>
  )
}

function ConteudoModalTermo({
  por,
  id,
  rotuloOutroLado,
  termo,
  aoSalvar,
  aoExcluir,
  aoCancelar,
}: {
  por: 'cliente' | 'fornecedor'
  id: string
  rotuloOutroLado: string
  termo: Termo | undefined
  aoSalvar: () => void
  aoExcluir: () => void
  aoCancelar: () => void
}) {
  const [formulario, setFormulario] = useState<Formulario>(termo ? paraFormulario(termo, por) : FORMULARIO_VAZIO)
  const [opcoes, setOpcoes] = useState<Opcao[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)

  // Carrega as opções do outro lado (fornecedores, na aba do cliente; clientes, na ficha do fornecedor).
  useEffect(() => {
    let cancelado = false
    async function carregarOpcoes() {
      try {
        const response = await fetch(por === 'cliente' ? '/api/fornecedores' : '/api/clientes')
        if (!response.ok) {
          if (!cancelado) setErro(await mensagemDeErro(response, `Falha ao carregar a lista de ${rotuloOutroLado.toLowerCase()}s.`))
          return
        }
        const lista = await response.json()
        if (cancelado) return
        setOpcoes(
          por === 'cliente'
            ? lista.map((f: { id: string; razaoSocial: string }) => ({ id: f.id, rotulo: f.razaoSocial }))
            : lista.map((c: { id: string; nome: string; siglaLegado: string | null }) => ({ id: c.id, rotulo: rotuloCliente(c) }))
        )
      } catch {
        if (!cancelado) setErro('Falha de conexão ao carregar as opções.')
      }
    }
    void carregarOpcoes()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [por])

  // Contratos do cliente do termo: o da página (aba do cliente) ou o escolhido no select (ficha do
  // fornecedor). Recarrega quando esse cliente muda.
  const clienteDoTermo = por === 'cliente' ? id : formulario.outroLadoId
  const [contratos, setContratos] = useState<Opcao[]>([])
  useEffect(() => {
    if (!clienteDoTermo) {
      setContratos([])
      return
    }
    let cancelado = false
    fetch(`/api/clientes/${clienteDoTermo}/contratos`)
      .then(async (response) => {
        if (cancelado) return
        if (!response.ok) {
          setErro(await mensagemDeErro(response, 'Falha ao carregar os contratos do cliente.'))
          return
        }
        const lista: Array<{ id: string; numeroTermo: string | null }> = await response.json()
        if (!cancelado) setContratos(lista.map((c) => ({ id: c.id, rotulo: c.numeroTermo ?? '(sem número)' })))
      })
      .catch(() => !cancelado && setErro('Falha de conexão ao carregar os contratos do cliente.'))
    return () => {
      cancelado = true
    }
  }, [clienteDoTermo])

  async function handleSalvar(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)
    const criando = !termo
    const { outroLadoId, ...campos } = formulario
    // O termo não muda de cliente depois de criado; o fornecedor pode ser trocado.
    const corpo = criando
      ? { ...campos, clienteId: por === 'cliente' ? id : outroLadoId, fornecedorId: por === 'cliente' ? outroLadoId : id }
      : por === 'cliente'
        ? { ...campos, fornecedorId: outroLadoId }
        : campos
    try {
      const response = await fetch(criando ? '/api/termos-confirmacao' : `/api/termos-confirmacao/${termo.id}`, {
        method: criando ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      if (!response.ok) {
        setErro(await mensagemDeErro(response, 'Falha ao salvar o termo de confirmação.'))
        return
      }
      aoSalvar()
    } catch {
      setErro('Falha de conexão ao salvar o termo de confirmação.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir() {
    if (!termo) return
    setExcluindo(true)
    setErroExclusao(null)
    try {
      const response = await fetch(`/api/termos-confirmacao/${termo.id}`, { method: 'DELETE' })
      if (!response.ok) {
        setErroExclusao(await mensagemDeErro(response, 'Falha ao excluir o termo de confirmação.'))
        setConfirmandoExclusao(false)
        return
      }
      aoExcluir()
    } catch {
      setErroExclusao('Falha de conexão ao excluir o termo de confirmação.')
      setConfirmandoExclusao(false)
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <form onSubmit={handleSalvar} className="card space-y-3">
      <h3 className="text-sm font-semibold text-navy">{termo ? 'Editar termo de confirmação' : 'Novo termo de confirmação'}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">{rotuloOutroLado}</span>
          <select
            aria-label={rotuloOutroLado}
            value={formulario.outroLadoId}
            onChange={(e) =>
              // Na ficha do fornecedor, trocar o cliente invalida o contrato escolhido.
              setFormulario((atual) => ({
                ...atual,
                outroLadoId: e.target.value,
                contratoId: por === 'fornecedor' ? '' : atual.contratoId,
              }))
            }
            required
            // O cliente de um termo já criado não muda (o acesso é checado por ele).
            disabled={por === 'fornecedor' && !!termo}
            className={INPUT_BASE}
          >
            <option value="">{opcoes ? 'Selecione...' : 'Carregando...'}</option>
            {opcoes?.map((opcao) => (
              <option key={opcao.id} value={opcao.id}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Contrato ligado</span>
          <select
            aria-label="Contrato ligado"
            value={formulario.contratoId}
            onChange={(e) => setFormulario((atual) => ({ ...atual, contratoId: e.target.value }))}
            disabled={!clienteDoTermo}
            className={INPUT_BASE}
          >
            <option value="">Nenhum</option>
            {contratos.map((contrato) => (
              <option key={contrato.id} value={contrato.id}>
                {contrato.rotulo}
              </option>
            ))}
          </select>
        </label>
        {CAMPOS.map(({ campo, rotulo, tipo }) => (
          <label key={campo} className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-mid-grey">{rotulo}</span>
            <input
              aria-label={rotulo}
              type={tipo ?? 'text'}
              inputMode={campo === 'valor' ? 'decimal' : undefined}
              placeholder={campo === 'valor' ? '0,00' : undefined}
              value={formulario[campo]}
              onChange={(e) => setFormulario((atual) => ({ ...atual, [campo]: e.target.value }))}
              className={INPUT_BASE}
            />
          </label>
        ))}
      </div>
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

      {termo && (
        <div className="space-y-2 border-t border-border-grey pt-3">
          <div className="flex items-center justify-between gap-3">
            {confirmandoExclusao ? (
              <span className="flex items-center gap-2 text-xs">
                <span className="font-medium text-red-crit">Excluir este termo de confirmação?</span>
                <button type="button" disabled={excluindo} onClick={handleExcluir} className={LINK_DANGER}>
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoExclusao(false)}
                  className="font-medium text-mid-grey hover:text-navy hover:underline"
                >
                  Não
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmandoExclusao(true)} className={`${LINK_DANGER} text-xs`}>
                <Trash2 className="size-3.5" strokeWidth={2.25} />
                Excluir termo de confirmação
              </button>
            )}
          </div>
          {erroExclusao && (
            <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-xs text-red-crit">
              <AlertCircle className="size-3.5 shrink-0" strokeWidth={2.25} />
              {erroExclusao}
            </p>
          )}
        </div>
      )}
    </form>
  )
}
