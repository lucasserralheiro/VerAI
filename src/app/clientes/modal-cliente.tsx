'use client'

// Modal de cliente (criar E editar) — espelha a ficha FT_Cliente ("Controle de Clientes") do legado GRC-1:
// Sigla, Nome, Endereço, Nº, Bairro e a grade de Responsáveis. Modal nativo (<dialog> +
// showModal()), mesmo padrão de aba-responsaveis.tsx / aba-contratos.tsx. Em edição, carrega os
// responsáveis do cliente, sincroniza as mudanças da grade e oferece a exclusão do cliente.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, Loader2, Plus, Save, Trash2, X } from 'lucide-react'
import { BTN_PRIMARY, BTN_OUTLINE, INPUT_BASE, LINK_DANGER } from '@/lib/ui'

/** Cliente como a tela de detalhe o guarda — o que o modal precisa pra abrir em modo edição. */
export interface ClienteEdicao {
  id: string
  nome: string
  siglaLegado: string | null
  endereco: string | null
  numero: string | null
  bairro: string | null
}

interface ResponsavelForm {
  /** Só existe pra responsável já gravado (edição); linha nova não tem. */
  id?: string
  nome: string
  area: string
  email: string
  telefone: string
  celular: string
}

interface FormularioCliente {
  siglaLegado: string
  nome: string
  endereco: string
  numero: string
  bairro: string
}

const RESPONSAVEL_VAZIO: ResponsavelForm = { nome: '', area: '', email: '', telefone: '', celular: '' }
const CLIENTE_VAZIO: FormularioCliente = { siglaLegado: '', nome: '', endereco: '', numero: '', bairro: '' }

const CAMPOS_RESPONSAVEL: { campo: keyof ResponsavelForm; rotulo: string; tipo?: string }[] = [
  { campo: 'nome', rotulo: 'Nome(s) do(s) responsável(is)' },
  { campo: 'area', rotulo: 'Área' },
  { campo: 'email', rotulo: 'E-mail', tipo: 'email' },
  { campo: 'telefone', rotulo: 'Telefone', tipo: 'tel' },
  { campo: 'celular', rotulo: 'Celular', tipo: 'tel' },
]

const INPUT_CELULA = `${INPUT_BASE} w-full min-w-0 px-2 py-1.5`

export function ModalCliente({
  aberto,
  cliente,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  aberto: boolean
  /** Sem `cliente` o modal cria; com `cliente` edita (e mostra "Excluir cliente"). */
  cliente?: ClienteEdicao | null
  aoFechar: () => void
  aoSalvar: (salvo: ClienteEdicao | null) => void
  aoExcluir?: () => void
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
      aria-label={cliente ? 'Editar cliente' : 'Novo cliente'}
      className="w-[min(56rem,calc(100vw-2rem))] border-0 bg-transparent p-0"
    >
      {/* Conteúdo só existe com o modal aberto: cada abertura começa com o formulário limpo/recarregado. */}
      {aberto && (
        <ConteudoModal
          cliente={cliente ?? null}
          aoCancelar={() => dialogoRef.current?.close()}
          aoSalvar={aoSalvar}
          aoExcluir={aoExcluir}
        />
      )}
    </dialog>
  )
}

type RespostaResponsavel = ResponsavelForm & { id: string }

function aoTexto(valor: string | null | undefined) {
  return valor ?? ''
}

async function mensagemDeErro(response: Response, padrao: string) {
  const body = await response.json().catch(() => null)
  return body?.error ?? padrao
}

function ConteudoModal({
  cliente: clienteEditado,
  aoCancelar,
  aoSalvar,
  aoExcluir,
}: {
  cliente: ClienteEdicao | null
  aoCancelar: () => void
  aoSalvar: (salvo: ClienteEdicao | null) => void
  aoExcluir?: () => void
}) {
  const editando = clienteEditado !== null
  const [cliente, setCliente] = useState<FormularioCliente>(() =>
    clienteEditado
      ? {
          siglaLegado: aoTexto(clienteEditado.siglaLegado),
          nome: clienteEditado.nome,
          endereco: aoTexto(clienteEditado.endereco),
          numero: aoTexto(clienteEditado.numero),
          bairro: aoTexto(clienteEditado.bairro),
        }
      : CLIENTE_VAZIO
  )
  const [responsaveis, setResponsaveis] = useState<ResponsavelForm[]>([{ ...RESPONSAVEL_VAZIO }])
  // ids dos responsáveis gravados que o usuário tirou da grade — apagados só ao salvar.
  const [removidos, setRemovidos] = useState<string[]>([])
  const [carregandoResponsaveis, setCarregandoResponsaveis] = useState(editando)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  const clienteId = clienteEditado?.id
  useEffect(() => {
    if (!clienteId) return
    let cancelado = false
    fetch(`/api/clientes/${clienteId}/responsaveis`)
      .then(async (response) => {
        if (!response.ok) throw new Error()
        const lista: Array<{ id: string; nome: string; area: string | null; email: string | null; telefone: string | null; celular: string | null }> =
          await response.json()
        if (cancelado) return
        if (lista.length > 0) {
          setResponsaveis(
            lista.map((r) => ({
              id: r.id,
              nome: r.nome,
              area: aoTexto(r.area),
              email: aoTexto(r.email),
              telefone: aoTexto(r.telefone),
              celular: aoTexto(r.celular),
            }))
          )
        }
      })
      .catch(() => {
        if (!cancelado) setErro('Não foi possível carregar os responsáveis deste cliente.')
      })
      .finally(() => {
        if (!cancelado) setCarregandoResponsaveis(false)
      })
    return () => {
      cancelado = true
    }
  }, [clienteId])

  function alterarCliente(campo: keyof FormularioCliente, valor: string) {
    setCliente((atual) => ({ ...atual, [campo]: valor }))
  }

  function alterarResponsavel(indice: number, campo: keyof ResponsavelForm, valor: string) {
    setResponsaveis((atual) => atual.map((r, i) => (i === indice ? { ...r, [campo]: valor } : r)))
  }

  function removerResponsavel(indice: number) {
    const alvo = responsaveis[indice]
    if (alvo?.id) setRemovidos((atual) => [...atual, alvo.id as string])
    setResponsaveis((atual) => {
      const restante = atual.filter((_, i) => i !== indice)
      return restante.length > 0 ? restante : [{ ...RESPONSAVEL_VAZIO }]
    })
  }

  const linhaPreenchida = (r: ResponsavelForm) =>
    [r.nome, r.area, r.email, r.telefone, r.celular].some((v) => v.trim() !== '')

  /** Leva a grade pro servidor: apaga os removidos, atualiza os existentes e cria os novos.
   *  Cada passo bem-sucedido é refletido no estado (id do recém-criado, removido já apagado),
   *  então repetir "Salvar" após uma falha no meio não duplica nem reapaga nada. */
  async function sincronizarResponsaveis(id: string, preenchidos: ResponsavelForm[]) {
    for (const idRemovido of removidos) {
      const response = await fetch(`/api/responsaveis/${idRemovido}`, { method: 'DELETE' })
      if (!response.ok && response.status !== 404) {
        throw new Error(await mensagemDeErro(response, 'Falha ao remover responsável.'))
      }
      setRemovidos((atual) => atual.filter((x) => x !== idRemovido))
    }

    for (const linha of preenchidos) {
      const { id: idLinha, ...dados } = linha
      const response = await fetch(idLinha ? `/api/responsaveis/${idLinha}` : `/api/clientes/${id}/responsaveis`, {
        method: idLinha ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      })
      if (!response.ok) throw new Error(await mensagemDeErro(response, 'Falha ao salvar responsável.'))
      if (!idLinha) {
        const criado: RespostaResponsavel = await response.json()
        setResponsaveis((atual) => atual.map((r) => (r === linha ? { ...r, id: criado.id } : r)))
      }
    }
  }

  async function handleSalvar(event: FormEvent) {
    event.preventDefault()
    setErro(null)

    // Linha em branco na grade é só espaço pra digitar — não vira responsável.
    const preenchidos = responsaveis.filter(linhaPreenchida)
    if (preenchidos.some((r) => r.nome.trim() === '')) {
      setErro('Informe o nome do responsável em todas as linhas preenchidas.')
      return
    }

    setSalvando(true)
    try {
      if (!editando) {
        const response = await fetch('/api/admin/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...cliente, responsaveis: preenchidos.map(({ nome, area, email, telefone, celular }) => ({ nome, area, email, telefone, celular })) }),
        })
        if (!response.ok) {
          setErro(await mensagemDeErro(response, 'Falha ao criar cliente.'))
          return
        }
        aoSalvar(null)
        return
      }

      const response = await fetch(`/api/clientes/${clienteEditado.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cliente),
      })
      if (!response.ok) {
        setErro(await mensagemDeErro(response, 'Falha ao salvar cliente.'))
        return
      }
      const atualizado: ClienteEdicao = await response.json()
      try {
        await sincronizarResponsaveis(clienteEditado.id, preenchidos)
      } catch (e) {
        setErro(`Dados do cliente salvos, mas os responsáveis não: ${e instanceof Error ? e.message : 'falha desconhecida.'}`)
        return
      }
      aoSalvar(atualizado)
    } catch {
      setErro('Falha de conexão ao salvar cliente.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir() {
    if (!clienteEditado) return
    setExcluindo(true)
    setErro(null)
    try {
      const response = await fetch(`/api/clientes/${clienteEditado.id}`, { method: 'DELETE' })
      if (!response.ok) {
        setErro(await mensagemDeErro(response, 'Falha ao excluir cliente.'))
        setConfirmandoExclusao(false)
        return
      }
      aoExcluir?.()
    } catch {
      setErro('Falha de conexão ao excluir cliente.')
      setConfirmandoExclusao(false)
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <form onSubmit={handleSalvar} className="card-flush overflow-hidden">
      <header className="flex items-center justify-between bg-navy px-6 py-4 text-white">
        <h2 className="text-lg font-semibold tracking-tight">{editando ? 'Editar cliente' : 'Novo cliente'}</h2>
        <button
          type="button"
          onClick={aoCancelar}
          aria-label="Fechar"
          className="rounded-md p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-5" strokeWidth={2.25} />
        </button>
      </header>

      <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[9rem_1fr]">
          <Campo rotulo="Sigla">
            <input
              type="text"
              value={cliente.siglaLegado}
              onChange={(e) => alterarCliente('siglaLegado', e.target.value)}
              maxLength={20}
              className={`${INPUT_BASE} w-full uppercase`}
            />
          </Campo>
          <Campo rotulo="Nome" obrigatorio>
            <input
              type="text"
              value={cliente.nome}
              onChange={(e) => alterarCliente('nome', e.target.value)}
              required
              autoFocus
              className={`${INPUT_BASE} w-full`}
            />
          </Campo>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_7rem_14rem]">
          <Campo rotulo="Endereço">
            <input
              type="text"
              value={cliente.endereco}
              onChange={(e) => alterarCliente('endereco', e.target.value)}
              className={`${INPUT_BASE} w-full`}
            />
          </Campo>
          <Campo rotulo="Nº">
            <input
              type="text"
              inputMode="numeric"
              value={cliente.numero}
              onChange={(e) => alterarCliente('numero', e.target.value)}
              className={`${INPUT_BASE} w-full`}
            />
          </Campo>
          <Campo rotulo="Bairro">
            <input
              type="text"
              value={cliente.bairro}
              onChange={(e) => alterarCliente('bairro', e.target.value)}
              className={`${INPUT_BASE} w-full`}
            />
          </Campo>
        </div>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-navy">Responsáveis</h3>
            <button
              type="button"
              onClick={() => setResponsaveis((atual) => [...atual, { ...RESPONSAVEL_VAZIO }])}
              className={BTN_OUTLINE}
            >
              <Plus className="size-3.5" strokeWidth={2.25} />
              Adicionar responsável
            </button>
          </div>

          {carregandoResponsaveis ? (
            <p className="flex items-center gap-2 text-sm text-mid-grey">
              <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
              Carregando responsáveis...
            </p>
          ) : (
          <div className="overflow-x-auto rounded-xl border border-border-grey">
            <table className="w-full min-w-[42rem] text-sm">
              <thead className="bg-light-grey text-left text-xs font-semibold text-navy">
                <tr>
                  {CAMPOS_RESPONSAVEL.map(({ campo, rotulo }) => (
                    <th key={campo} className="px-2 py-2 font-semibold">
                      {rotulo}
                    </th>
                  ))}
                  <th className="w-10" aria-label="Remover" />
                </tr>
              </thead>
              <tbody>
                {responsaveis.map((responsavel, indice) => (
                  <tr key={indice} className="border-t border-border-grey">
                    {CAMPOS_RESPONSAVEL.map(({ campo, rotulo, tipo }) => (
                      <td key={campo} className="p-1.5">
                        <input
                          type={tipo ?? 'text'}
                          value={responsavel[campo]}
                          onChange={(e) => alterarResponsavel(indice, campo, e.target.value)}
                          aria-label={`${rotulo} (linha ${indice + 1})`}
                          className={INPUT_CELULA}
                        />
                      </td>
                    ))}
                    <td className="p-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => removerResponsavel(indice)}
                        aria-label={`Remover responsável (linha ${indice + 1})`}
                        className="rounded-md p-1.5 text-mid-grey transition-colors hover:bg-light-grey hover:text-red-crit"
                      >
                        <Trash2 className="size-4" strokeWidth={2} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </section>

        {erro && (
          <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
            <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
            {erro}
          </p>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-grey bg-light-grey/50 px-6 py-4">
        <div>
          {editando &&
            (confirmandoExclusao ? (
              <span className="flex items-center gap-2 text-xs">
                <span className="font-medium text-red-crit">
                  Excluir este cliente e todos os dados vinculados (documentos, contratos, faturamentos, demandas)? Não dá para desfazer.
                </span>
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
                Excluir cliente
              </button>
            ))}
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={aoCancelar} className={BTN_OUTLINE}>
            Cancelar
          </button>
          <button type="submit" disabled={salvando || carregandoResponsaveis} className={BTN_PRIMARY}>
            {salvando ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} />
            ) : editando ? (
              <Save className="size-3.5" strokeWidth={2.25} />
            ) : (
              <Plus className="size-3.5" strokeWidth={2.25} />
            )}
            {editando ? 'Salvar' : 'Criar cliente'}
          </button>
        </div>
      </footer>
    </form>
  )
}

function Campo({
  rotulo,
  obrigatorio,
  children,
}: {
  rotulo: string
  obrigatorio?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium text-mid-grey">
        {rotulo}
        {obrigatorio && <span className="text-red-crit"> *</span>}
      </span>
      {children}
    </label>
  )
}
