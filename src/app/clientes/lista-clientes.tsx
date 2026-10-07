'use client'

// Implementação da lista de clientes. Fica fora do page.tsx enquanto a tela
// está marcada como "em desenvolvimento" — quando for liberar, é só trocar
// a flag EM_DESENVOLVIMENTO em ./page.tsx.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Inbox, LayoutGrid, Loader2, Plus, Rows3, Search } from 'lucide-react'
import { BTN_OUTLINE, INPUT_BASE } from '@/lib/ui'
import { AtualizacaoSharepoint } from '@/components/sharepoint/atualizacao-sharepoint'
import type { CarteiraDoPainel, PainelCarteiras, TotaisCarteira } from '@/lib/relatorios-clientes/painel-carteiras'
import { ModalCliente } from './modal-cliente'
import { SeloCarteira } from './[id]/permissao-cliente'
import { FaixaTotais, PastaCarteira, ResumoCliente } from './painel-carteiras'
import { definirCarteiraFoco, useCarteiraFoco } from '@/components/carteira/carteira-foco'

interface Cliente {
  id: string
  nome: string
  siglaLegado?: string | null
  gerencia?: { id: string; nome: string } | null
}

interface UsuarioLogado {
  id: string
  role: string
}

/** Mesmo id que o servidor usa para a pasta dos clientes sem gerência (`SEM_CARTEIRA`). */
const SEM_CARTEIRA = 'sem'

type Visao = 'carteiras' | 'todos'
type Ordem = 'nome' | 'valor' | 'vencimento'

// Normaliza pra busca: minúsculas e sem acentos ("gestao" encontra "GESTÃO").
function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Onde o usuário está, lido da URL (`?carteira=<id|sem>` e `?visao=todos`) — voltar do navegador e
 *  link copiado abrem no mesmo lugar. */
function lerUrl(): { carteira: string | null; visao: Visao } {
  if (typeof window === 'undefined') return { carteira: null, visao: 'carteiras' }
  const params = new URLSearchParams(window.location.search)
  return { carteira: params.get('carteira'), visao: params.get('visao') === 'todos' ? 'todos' : 'carteiras' }
}

function urlDe(carteira: string | null, visao: Visao) {
  const params = new URLSearchParams()
  if (carteira) params.set('carteira', carteira)
  else if (visao === 'todos') params.set('visao', 'todos')
  const qs = params.toString()
  return `/clientes${qs ? `?${qs}` : ''}`
}

/** Peso de vencimento pra ordenar: vencido > 30 dias > 90 dias > nada. */
function urgencia(t: TotaisCarteira | undefined) {
  if (!t) return 0
  return t.vencidos * 1_000_000 + t.vencem30 * 1_000 + t.vencem90
}

export function ListaClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [painel, setPainel] = useState<PainelCarteiras | null | 'erro'>(null)
  const [minhas, setMinhas] = useState<Set<string>>(new Set())
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<Ordem>('nome')
  const [{ carteira: carteiraAberta, visao }, setLocal] = useState<{ carteira: string | null; visao: Visao }>({
    carteira: null,
    visao: 'carteiras',
  })

  async function carregar() {
    const response = await fetch('/api/clientes')
    if (response.ok) setClientes(await response.json())
  }

  // Totais vêm à parte: a lista aparece na hora e os números entram quando o painel chega (ele consolida
  // todos os contratos). Falha no painel não esconde a lista.
  async function carregarPainel() {
    try {
      const response = await fetch('/api/clientes/painel')
      const dados = response.ok ? await response.json() : null
      setPainel(dados && Array.isArray(dados.carteiras) ? dados : 'erro')
    } catch {
      setPainel('erro')
    }
  }

  useEffect(() => {
    carregar().finally(() => setCarregando(false))
    carregarPainel()
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(setUsuario)
      .catch(() => {})
    fetch('/api/gerencias/minhas')
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => {
        if (Array.isArray(v)) setMinhas(new Set(v.map((x: { gerenciaId: string }) => x.gerenciaId)))
      })
      .catch(() => {})
  }, [])

  // URL ↔ tela: lê ao abrir e no voltar/avançar do navegador. A pasta aberta É a carteira em foco do menu
  // lateral (uma escolha só para a área inteira): abrir pasta, voltar do navegador e o seletor do menu
  // mudam a mesma coisa.
  useEffect(() => {
    setLocal(lerUrl())
    const aoVoltar = () => {
      const atual = lerUrl()
      setLocal(atual)
      definirCarteiraFoco(atual.carteira)
    }
    window.addEventListener('popstate', aoVoltar)
    return () => window.removeEventListener('popstate', aoVoltar)
  }, [])

  const navegar = useCallback((carteira: string | null, novaVisao: Visao = 'carteiras') => {
    window.history.pushState(null, '', urlDe(carteira, novaVisao))
    setLocal({ carteira, visao: novaVisao })
    setBusca('')
    definirCarteiraFoco(carteira)
  }, [])

  // Ao abrir: link com `?carteira=` manda no foco; sem ele, abre na carteira em foco. Depois: troca no menu
  // abre a pasta correspondente aqui.
  const { foco, pronto } = useCarteiraFoco()
  const primeiraVez = useRef(true)
  useEffect(() => {
    if (!pronto) return
    const atual = lerUrl()
    if (primeiraVez.current) {
      primeiraVez.current = false
      if (atual.carteira) {
        if (atual.carteira !== foco) definirCarteiraFoco(atual.carteira)
        return
      }
      if (atual.visao === 'todos' || !foco) return
    } else if (atual.carteira === foco || (!foco && !atual.carteira)) {
      return
    }
    window.history.replaceState(null, '', urlDe(foco, 'carteiras'))
    setLocal({ carteira: foco, visao: 'carteiras' })
    setBusca('')
  }, [foco, pronto])

  const ehAdmin = usuario?.role === 'admin'
  const painelPronto = painel !== null && painel !== 'erro' ? painel : null

  // Pastas: do painel (traz gerente, sigla, gerência vazia e totais); enquanto ele não chega, montadas dos
  // próprios clientes pra tela não esperar.
  const carteiras: CarteiraDoPainel[] = useMemo(() => {
    const doPainel = painelPronto?.carteiras
    if (doPainel) {
      const minhasPrimeiro = [...doPainel].sort((a, b) => Number(minhas.has(b.id)) - Number(minhas.has(a.id)))
      return minhasPrimeiro
    }
    const porId = new Map<string, CarteiraDoPainel>()
    for (const c of clientes) {
      const id = c.gerencia?.id ?? SEM_CARTEIRA
      const atual = porId.get(id)
      if (atual) atual.totais.clientes++
      else
        porId.set(id, {
          id,
          nome: c.gerencia?.nome ?? 'Sem carteira',
          sigla: null,
          gerentes: [],
          totais: totaisVazios(1),
        })
    }
    return [...porId.values()].sort((a, b) =>
      a.id === SEM_CARTEIRA ? 1 : b.id === SEM_CARTEIRA ? -1 : a.nome.localeCompare(b.nome, 'pt-BR')
    )
  }, [painelPronto, clientes, minhas])

  // Sem nenhuma gerência cadastrada não há o que agrupar: vai direto pra lista de clientes.
  const temCarteiras = carteiras.some((c) => c.id !== SEM_CARTEIRA)
  const carteira = carteiraAberta ? carteiras.find((c) => c.id === carteiraAberta) ?? null : null
  const nivel: 'carteiras' | 'carteira' | 'todos' =
    carteiraAberta && (carteira || carteiraAberta === SEM_CARTEIRA)
      ? 'carteira'
      : visao === 'todos' || !temCarteiras
        ? 'todos'
        : 'carteiras'

  const termo = normalizar(busca)
  const buscando = termo.length > 0

  const clientesDoNivel = useMemo(() => {
    const daCarteira = (c: Cliente) => (c.gerencia?.id ?? SEM_CARTEIRA) === carteiraAberta
    const base = nivel === 'carteira' ? clientes.filter(daCarteira) : clientes
    const filtrados = !buscando
      ? base
      : base.filter((c) => normalizar(c.nome).includes(termo) || normalizar(c.siglaLegado ?? '').includes(termo))
    if (ordem === 'nome' || !painelPronto) return filtrados
    const t = painelPronto.clientes
    return [...filtrados].sort((a, b) =>
      ordem === 'valor'
        ? Number(t[b.id]?.valorContratado ?? 0) - Number(t[a.id]?.valorContratado ?? 0)
        : urgencia(t[b.id]) - urgencia(t[a.id])
    )
  }, [clientes, nivel, carteiraAberta, buscando, termo, ordem, painelPronto])

  // Na raiz, digitar busca em todos os clientes (não nas pastas) — quem procura "SMS" quer o cliente.
  const mostrandoClientes = nivel !== 'carteiras' || buscando
  const totaisDoNivel: TotaisCarteira | null | 'erro' =
    painel === 'erro' ? 'erro' : !painelPronto ? null : nivel === 'carteira' ? carteira?.totais ?? null : painelPronto.geral
  const nomeDoNivel = nivel === 'carteira' ? carteira?.nome ?? 'Sem carteira' : null

  return (
    <main className="mx-auto max-w-[110rem] space-y-6 px-6 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-semibold tracking-wide text-orange uppercase">Painel</span>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">
            Relatórios dos clientes
          </h1>
          <AtualizacaoSharepoint />
        </div>

        {ehAdmin && (
          <button onClick={() => setModalAberto(true)} className={BTN_OUTLINE}>
            <Plus className="size-3.5" strokeWidth={2.25} />
            Novo cliente
          </button>
        )}
      </div>

      {!carregando && clientes.length > 0 && (
        <>
          {/* Trilha: Todas as carteiras › <carteira> */}
          {temCarteiras && (
            <nav aria-label="Trilha" className="flex flex-wrap items-center gap-1 text-sm">
              {nivel === 'carteira' ? (
                <>
                  <a
                    href={urlDe(null, 'carteiras')}
                    onClick={(e) => {
                      e.preventDefault()
                      navegar(null)
                    }}
                    className="font-medium text-navy/70 hover:text-navy hover:underline"
                  >
                    Todas as carteiras
                  </a>
                  <ChevronRight className="size-4 text-mid-grey" strokeWidth={2} />
                  <span className="font-semibold text-navy" aria-current="page">
                    {nomeDoNivel}
                  </span>
                  {carteira && carteira.gerentes.length > 0 && (
                    <span className="ml-2 text-xs text-mid-grey">Gerente: {carteira.gerentes.join(', ')}</span>
                  )}
                </>
              ) : (
                <span className="font-semibold text-navy">{nivel === 'todos' ? 'Todos os clientes' : 'Todas as carteiras'}</span>
              )}
            </nav>
          )}

          <FaixaTotais
            totais={totaisDoNivel}
            rotulo={nivel === 'carteira' ? `da carteira ${nomeDoNivel}` : 'gerais'}
          />

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-md">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mid-grey"
                strokeWidth={2.25}
              />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={nivel === 'carteira' ? `Buscar cliente em ${nomeDoNivel}` : 'Buscar cliente por nome ou sigla'}
                aria-label="Buscar cliente"
                className={`${INPUT_BASE} w-full pl-9`}
              />
            </div>

            {mostrandoClientes && painelPronto && (
              <select
                value={ordem}
                onChange={(e) => setOrdem(e.target.value as Ordem)}
                aria-label="Ordenar"
                className={INPUT_BASE}
              >
                <option value="nome">Ordenar: nome</option>
                <option value="valor">Ordenar: maior valor contratado</option>
                <option value="vencimento">Ordenar: vencimentos mais urgentes</option>
              </select>
            )}

            {temCarteiras && nivel !== 'carteira' && (
              <div role="group" aria-label="Visão" className="ml-auto inline-flex rounded-lg border border-border-grey bg-white p-0.5">
                {(
                  [
                    ['carteiras', 'Por carteira', LayoutGrid],
                    ['todos', 'Todos os clientes', Rows3],
                  ] as const
                ).map(([valor, rotulo, Icone]) => (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={nivel === valor}
                    onClick={() => navegar(null, valor)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      nivel === valor ? 'bg-navy text-white' : 'text-navy/70 hover:text-navy'
                    }`}
                  >
                    <Icone className="size-3.5" strokeWidth={2.25} />
                    {rotulo}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-mid-grey">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          Carregando...
        </p>
      ) : clientes.length === 0 ? (
        ehAdmin ? (
          <div className="card-flush flex flex-col items-center gap-3 p-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
              <Inbox className="size-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm text-mid-grey">
              Nenhum cliente cadastrado ainda. Use o botão &ldquo;Novo cliente&rdquo;.
            </p>
          </div>
        ) : (
          <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
              <Inbox className="size-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm text-mid-grey">
              Nenhum cliente disponível. Peça a um admin pra cadastrar em /admin/clientes e liberar acesso.
            </p>
          </div>
        )
      ) : !mostrandoClientes ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {carteiras.map((c) => (
            <li key={c.id}>
              <PastaCarteira
                carteira={c}
                minha={minhas.has(c.id)}
                carregandoTotais={!painelPronto}
                href={urlDe(c.id, 'carteiras')}
                aoAbrir={() => navegar(c.id)}
              />
            </li>
          ))}
        </ul>
      ) : clientesDoNivel.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <Search className="size-5" strokeWidth={1.75} />
          </span>
          {buscando ? (
            <>
              <p className="text-sm text-mid-grey">Nenhum cliente encontrado para &ldquo;{busca.trim()}&rdquo;.</p>
              {nivel === 'carteira' && (
                <button
                  type="button"
                  onClick={() => {
                    const texto = busca
                    navegar(null, 'todos')
                    setBusca(texto)
                  }}
                  className="text-sm font-semibold text-navy underline"
                >
                  Buscar em todas as carteiras
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-mid-grey">
              Nenhum cliente nesta carteira.
              {ehAdmin && (
                <>
                  {' '}
                  <Link href="/admin/gerencias" className="font-semibold text-navy underline">
                    Distribuir clientes
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
      ) : (
        <>
          {nivel === 'carteira' && carteiraAberta === SEM_CARTEIRA && ehAdmin && (
            <p className="text-sm text-mid-grey">
              Estes clientes ainda não têm gerência — só o administrador edita.{' '}
              <Link href="/admin/gerencias" className="font-semibold text-navy underline">
                Distribuir em carteiras
              </Link>
            </p>
          )}
          <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
            {clientesDoNivel.map((cliente) => {
              const totais = painelPronto?.clientes[cliente.id]
              return (
                <li key={cliente.id}>
                  <Link
                    href={`/clientes/${cliente.id}`}
                    className="group flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-colors hover:bg-navy/5"
                  >
                    <span className="relative h-12 w-16">
                      <span aria-hidden="true" className="absolute top-0 left-1.5 h-2.5 w-7 rounded-t-md bg-navy" />
                      <span
                        aria-hidden="true"
                        className="absolute top-2 left-0 h-10 w-16 overflow-hidden rounded-md bg-navy-3 shadow-sm"
                      >
                        <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0)_40%)]" />
                      </span>
                      {cliente.siglaLegado && (
                        <span className="absolute bottom-1 left-1/2 max-w-14 -translate-x-1/2 truncate rounded bg-orange px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wide text-white">
                          {cliente.siglaLegado}
                        </span>
                      )}
                    </span>
                    <span className="line-clamp-2 text-[13px] leading-tight font-semibold text-navy">{cliente.nome}</span>
                    {/* Dentro da carteira o selo seria repetido; fora dela diz de quem é o cliente. */}
                    {nivel !== 'carteira' && cliente.gerencia && <SeloCarteira gerencia={cliente.gerencia} />}
                    {totais && <ResumoCliente totais={totais} />}
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {ehAdmin && (
        <ModalCliente
          aberto={modalAberto}
          aoFechar={() => setModalAberto(false)}
          aoSalvar={() => {
            setModalAberto(false)
            setBusca('')
            carregar()
            carregarPainel()
          }}
        />
      )}
    </main>
  )
}

function totaisVazios(clientes: number): TotaisCarteira {
  return {
    clientes,
    clientesComContratoAtivo: 0,
    contratosAtivos: 0,
    contratosSemValor: 0,
    valorContratado: '0',
    faturado: '0',
    saldo: null,
    percentualFaturado: null,
    vencidos: 0,
    vencem30: 0,
    vencem90: 0,
  }
}
