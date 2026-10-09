'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Check, Copy, Download, KeyRound, Loader2, Plus, RefreshCw, Send, Trash2, Webhook } from 'lucide-react'
import { BTN_NAVY, BTN_OUTLINE, BTN_OUTLINE_SM, BTN_PRIMARY, INPUT_BASE, LINK_DANGER } from '@/lib/ui'

// API de plataforma do VerAI — spec docs/superpowers/specs/2026-10-08-api-plataforma-design.md.
// Aplicativos: quem LÊ os dados do VerAI (chave + permissões por recurso + webhooks).
// Fontes externas: sistemas de onde o VerAI RECEBE dados (o AIBertinho é uma).

interface Recurso { recurso: string; rotulo: string; descricao: string }
interface Entrega { recursos: string[]; status: number | null; erro: string | null; criadoEm: string }
interface Hook { id: string; url: string; eventos: string[]; segredo: string; ativo: boolean; entregas: Entrega[] }
interface App {
  id: string; nome: string; descricao: string | null; ativo: boolean; escopos: string[]; chavePrefixo: string
  criadoEm: string; criadoPor: string | null; ultimoUsoEm: string | null; webhooks: Hook[]
}
interface EstadoRecurso { recurso: string; total: number; sincronizadoEm: string | null; erro: string | null; liberadoPelaFonte: boolean | null }
interface Fonte { id: string; slug: string; nome: string; url: string; ativa: boolean; recursos: string[]; temSegredo: boolean; chaveFinal: string; estado: EstadoRecurso[] }
interface Painel { urlBase: string; recursos: Recurso[]; apps: App[]; fontes: Fonte[] }
interface Descoberta { ok: boolean; sistema?: string; app?: string; recursos?: (Recurso & { permitido: boolean })[]; erro?: string }

const ler = (r: string) => `${r}:ler`
const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca')

async function chamar<T = unknown>(url: string, metodo = 'GET', corpo?: unknown): Promise<T> {
  const r = await fetch(url, { method: metodo, headers: corpo ? { 'content-type': 'application/json' } : undefined, body: corpo ? JSON.stringify(corpo) : undefined })
  const json = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((json as { error?: string }).error ?? `Falha (HTTP ${r.status})`)
  return json as T
}

function Copiar({ texto, rotulo = 'Copiar' }: { texto: string; rotulo?: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      type="button"
      className={BTN_OUTLINE_SM}
      onClick={() => {
        void navigator.clipboard.writeText(texto)
        setOk(true)
        setTimeout(() => setOk(false), 1500)
      }}
    >
      {ok ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {ok ? 'Copiado' : rotulo}
    </button>
  )
}

function Chave({ ligada, onClick, rotulo, ocupada = false }: { ligada: boolean; onClick: () => void; rotulo: string; ocupada?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={ligada} aria-label={rotulo} disabled={ocupada} onClick={onClick}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${ligada ? 'bg-green-ok' : 'bg-navy/20'}`}>
      <span className={`size-5 rounded-full bg-white shadow transition-transform ${ligada ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  )
}

/** Caixas de seleção dos recursos, com "todos". */
function EscolhaDeRecursos({ recursos, marcados, onChange, desabilitados = [] }: { recursos: Recurso[]; marcados: string[]; onChange: (lista: string[]) => void; desabilitados?: string[] }) {
  const habilitados = recursos.filter((r) => !desabilitados.includes(r.recurso)).map((r) => r.recurso)
  const todos = habilitados.length > 0 && habilitados.every((r) => marcados.includes(r))
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-xs font-medium text-navy">
        <input type="checkbox" checked={todos} onChange={() => onChange(todos ? [] : habilitados)} /> Todos
      </label>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {recursos.map((r) => {
          const bloqueado = desabilitados.includes(r.recurso)
          return (
            <label key={r.recurso} className={`flex items-start gap-2 text-sm ${bloqueado ? 'text-mid-grey/60' : 'text-navy'}`} title={r.descricao}>
              <input type="checkbox" className="mt-1" disabled={bloqueado} checked={marcados.includes(r.recurso)}
                onChange={() => onChange(marcados.includes(r.recurso) ? marcados.filter((x) => x !== r.recurso) : [...marcados, r.recurso])} />
              <span>{r.rotulo}{bloqueado && <span className="text-xs"> — não liberado</span>}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

/** Aviso com a chave/segredo que só aparece uma vez. */
function Revelado({ titulo, valor, texto, onFechar }: { titulo: string; valor: string; texto: string; onFechar: () => void }) {
  return (
    <div className="rounded-xl border border-orange/40 bg-orange-light/40 p-4">
      <p className="text-sm font-semibold text-navy">{titulo}</p>
      <p className="text-xs text-mid-grey">{texto}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="break-all rounded-lg bg-white px-2 py-1 text-sm text-navy">{valor}</code>
        <Copiar texto={valor} />
        <button type="button" className={BTN_OUTLINE_SM} onClick={onFechar}>Já guardei</button>
      </div>
    </div>
  )
}

// ─── Aplicativos ────────────────────────────────────────────────────────────────

function NovoApp({ recursos, onCriado }: { recursos: Recurso[]; onCriado: (chave: string) => void }) {
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [marcados, setMarcados] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  if (!aberto) {
    return (
      <button type="button" className={BTN_PRIMARY} onClick={() => setAberto(true)}>
        <Plus className="size-4" aria-hidden /> Novo aplicativo
      </button>
    )
  }
  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-navy">Novo aplicativo</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={INPUT_BASE} placeholder="Nome (ex.: AIBertinho)" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input className={INPUT_BASE} placeholder="Para que serve (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </div>
      <div>
        <p className="mb-1 text-sm font-medium text-navy">O que ele pode ler</p>
        <EscolhaDeRecursos recursos={recursos} marcados={marcados} onChange={setMarcados} />
      </div>
      {erro && <p className="text-sm text-red-crit">{erro}</p>}
      <div className="flex gap-2">
        <button type="button" className={BTN_PRIMARY} disabled={salvando || nome.trim().length < 2}
          onClick={async () => {
            setSalvando(true)
            setErro(null)
            try {
              const r = await chamar<{ chave: string }>('/api/admin/api/apps', 'POST', { nome, descricao, escopos: marcados.map(ler) })
              setAberto(false); setNome(''); setDescricao(''); setMarcados([])
              onCriado(r.chave)
            } catch (e) {
              setErro((e as Error).message)
            } finally {
              setSalvando(false)
            }
          }}>
          {salvando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />} Criar e gerar chave
        </button>
        <button type="button" className={BTN_OUTLINE} onClick={() => setAberto(false)}>Cancelar</button>
      </div>
    </div>
  )
}

function NovoWebhook({ app, recursos, onCriado }: { app: App; recursos: Recurso[]; onCriado: (segredo: string) => void }) {
  const permitidos = recursos.filter((r) => app.escopos.includes(ler(r.recurso)))
  const [aberto, setAberto] = useState(false)
  const [url, setUrl] = useState('')
  const [eventos, setEventos] = useState<string[]>(permitidos.map((r) => r.recurso))
  const [erro, setErro] = useState<string | null>(null)
  if (!aberto) {
    return (
      <button type="button" className={BTN_OUTLINE_SM} onClick={() => { setEventos(permitidos.map((r) => r.recurso)); setAberto(true) }}>
        <Plus className="size-3.5" aria-hidden /> Adicionar webhook
      </button>
    )
  }
  return (
    <div className="space-y-2 rounded-xl border border-navy/10 p-3">
      <input className={`${INPUT_BASE} w-full`} placeholder="https://outro-sistema/api/v1/webhooks/verai" value={url} onChange={(e) => setUrl(e.target.value)} />
      <p className="text-xs text-mid-grey">Avisar quando mudar:</p>
      <EscolhaDeRecursos recursos={recursos} marcados={eventos} onChange={setEventos}
        desabilitados={recursos.filter((r) => !app.escopos.includes(ler(r.recurso))).map((r) => r.recurso)} />
      {erro && <p className="text-sm text-red-crit">{erro}</p>}
      <div className="flex gap-2">
        <button type="button" className={BTN_NAVY} onClick={async () => {
          setErro(null)
          try {
            const r = await chamar<{ segredo: string }>(`/api/admin/api/apps/${app.id}/webhooks`, 'POST', { url, eventos })
            setAberto(false); setUrl('')
            onCriado(r.segredo)
          } catch (e) { setErro((e as Error).message) }
        }}>Salvar webhook</button>
        <button type="button" className={BTN_OUTLINE_SM} onClick={() => setAberto(false)}>Cancelar</button>
      </div>
    </div>
  )
}

function CartaoApp({ app, recursos, recarregar, revelar }: { app: App; recursos: Recurso[]; recarregar: () => void; revelar: (titulo: string, valor: string, texto: string) => void }) {
  const [ocupado, setOcupado] = useState(false)
  const [mostrar, setMostrar] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const marcados = recursos.filter((r) => app.escopos.includes(ler(r.recurso))).map((r) => r.recurso)

  async function acao(fn: () => Promise<unknown>) {
    setOcupado(true)
    setAviso(null)
    try { await fn(); recarregar() } catch (e) { setAviso((e as Error).message) } finally { setOcupado(false) }
  }

  return (
    <div className={`card space-y-4 ${app.ativo ? '' : 'opacity-70'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-navy">{app.nome}</h3>
          {app.descricao && <p className="text-sm text-mid-grey">{app.descricao}</p>}
          <p className="mt-1 text-xs text-mid-grey">
            Chave <code className="text-navy">{app.chavePrefixo}…</code> · último uso {quando(app.ultimoUsoEm)} · criado por {app.criadoPor ?? '—'} em {quando(app.criadoEm)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${app.ativo ? 'text-green-ok' : 'text-mid-grey'}`}>{app.ativo ? 'Ativo' : 'Desativado'}</span>
          <Chave ligada={app.ativo} ocupada={ocupado} rotulo={`Ativar ${app.nome}`} onClick={() => acao(() => chamar(`/api/admin/api/apps/${app.id}`, 'PATCH', { ativo: !app.ativo }))} />
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-navy">Pode ler</p>
        <EscolhaDeRecursos recursos={recursos} marcados={marcados}
          onChange={(lista) => acao(() => chamar(`/api/admin/api/apps/${app.id}`, 'PATCH', { escopos: lista.map(ler) }))} />
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-navy"><Webhook className="size-4" aria-hidden /> Webhooks — avisos de mudança</p>
        {app.webhooks.length === 0 && <p className="text-xs text-mid-grey">Nenhum. Sem webhook, o aplicativo só fica sabendo das mudanças quando consultar a API.</p>}
        {app.webhooks.map((w) => (
          <div key={w.id} className="space-y-1.5 rounded-xl border border-navy/10 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all text-sm text-navy">{w.url}</code>
              <Chave ligada={w.ativo} ocupada={ocupado} rotulo="Webhook ativo" onClick={() => acao(() => chamar(`/api/admin/api/webhooks/${w.id}`, 'PATCH', { ativo: !w.ativo }))} />
            </div>
            <p className="text-xs text-mid-grey">
              Avisa: {w.eventos.length ? w.eventos.map((e) => recursos.find((r) => r.recurso === e)?.rotulo ?? e).join(', ') : 'nada'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-mid-grey">Segredo:</span>
              <code className="text-xs text-navy">{mostrar === w.id ? w.segredo : 'whsec_••••••••'}</code>
              <button type="button" className={BTN_OUTLINE_SM} onClick={() => setMostrar(mostrar === w.id ? null : w.id)}>{mostrar === w.id ? 'Esconder' : 'Mostrar'}</button>
              <Copiar texto={w.segredo} rotulo="Copiar segredo" />
              <button type="button" className={BTN_OUTLINE_SM} disabled={ocupado} onClick={() => acao(async () => {
                const r = await chamar<{ ok: boolean; status: number | null; erro: string | null }>(`/api/admin/api/webhooks/${w.id}/testar`, 'POST')
                setAviso(r.ok ? 'Ping entregue — o outro sistema aceitou a assinatura.' : `Ping falhou: ${r.erro ?? `HTTP ${r.status}`}`)
              })}><Send className="size-3.5" aria-hidden /> Testar</button>
              <button type="button" className={LINK_DANGER} onClick={() => window.confirm('Excluir este webhook?') && acao(() => chamar(`/api/admin/api/webhooks/${w.id}`, 'DELETE'))}>
                <Trash2 className="size-3.5" aria-hidden /> Excluir
              </button>
            </div>
            {w.entregas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {w.entregas.map((e, i) => (
                  <span key={i} title={`${quando(e.criadoEm)} · ${e.recursos.join(', ')}${e.erro ? ` · ${e.erro}` : ''}`}
                    className={`rounded-full px-2 py-0.5 text-[11px] ${e.erro ? 'bg-red-crit/10 text-red-crit' : 'bg-green-ok/10 text-green-ok'}`}>
                    {e.status ?? 'sem resposta'} · {new Date(e.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        <NovoWebhook app={app} recursos={recursos} onCriado={(segredo) => { recarregar(); revelar('Segredo do webhook', segredo, 'Cadastre este segredo no outro sistema (na fonte "VerAI" de lá). Ele também fica visível aqui.') }} />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-navy/10 pt-3">
        <button type="button" className={BTN_OUTLINE_SM} disabled={ocupado} onClick={() => window.confirm(`Gerar chave nova para ${app.nome}? A chave atual para de funcionar na hora.`) && acao(async () => {
          const r = await chamar<{ chave: string }>(`/api/admin/api/apps/${app.id}/chave`, 'POST')
          revelar(`Nova chave de ${app.nome}`, r.chave, 'Copie agora — ela não aparece de novo. Troque no outro sistema; a antiga já parou de funcionar.')
        })}><KeyRound className="size-3.5" aria-hidden /> Gerar chave nova</button>
        <button type="button" className={LINK_DANGER} onClick={() => window.confirm(`Excluir ${app.nome}? A chave e os webhooks dele param na hora.`) && acao(() => chamar(`/api/admin/api/apps/${app.id}`, 'DELETE'))}>
          <Trash2 className="size-3.5" aria-hidden /> Excluir aplicativo
        </button>
        {aviso && <span className="text-sm text-navy">{aviso}</span>}
      </div>
    </div>
  )
}

// ─── Fontes externas ────────────────────────────────────────────────────────────

function NovaFonte({ urlBase, onCriada }: { urlBase: string; onCriada: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [url, setUrl] = useState('')
  const [chave, setChave] = useState('')
  const [segredo, setSegredo] = useState('')
  const [descoberta, setDescoberta] = useState<Descoberta | null>(null)
  const [marcados, setMarcados] = useState<string[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  if (!aberto) {
    return (
      <button type="button" className={BTN_PRIMARY} onClick={() => setAberto(true)}>
        <Plus className="size-4" aria-hidden /> Adicionar fonte
      </button>
    )
  }
  const permitidos = descoberta?.recursos?.filter((r) => r.permitido).map((r) => r.recurso) ?? []
  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-navy">Adicionar fonte</h3>
      <p className="text-xs text-mid-grey">
        No outro sistema, crie um aplicativo chamado &quot;VerAI&quot; e copie a chave. Se quiser avisos na hora, cadastre lá um webhook apontando para{' '}
        <code>{urlBase}/api/v1/webhooks/{nome ? nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '<nome>'}</code> e traga o segredo.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={INPUT_BASE} placeholder="Nome (ex.: AIBertinho)" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input className={INPUT_BASE} placeholder="Endereço (ex.: https://aibertinho.vercel.app)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input className={INPUT_BASE} placeholder="Chave que o outro sistema gerou para o VerAI" value={chave} onChange={(e) => setChave(e.target.value)} />
        <input className={INPUT_BASE} placeholder="Segredo do webhook (opcional)" value={segredo} onChange={(e) => setSegredo(e.target.value)} />
      </div>
      <button type="button" className={BTN_OUTLINE} disabled={ocupado || !url || !chave} onClick={async () => {
        setOcupado(true); setErro(null)
        try {
          const d = await chamar<Descoberta>('/api/admin/api/fontes/descobrir', 'POST', { url, chave })
          setDescoberta(d)
          if (d.ok) setMarcados(d.recursos?.filter((r) => r.permitido).map((r) => r.recurso) ?? [])
        } finally { setOcupado(false) }
      }}>{ocupado ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />} Testar e ver o que ela libera</button>
      {descoberta && !descoberta.ok && <p className="text-sm text-red-crit">{descoberta.erro}</p>}
      {descoberta?.ok && descoberta.recursos && (
        <div>
          <p className="mb-1 text-sm text-green-ok">Conectado a {descoberta.sistema} como &quot;{descoberta.app}&quot;. Escolha o que receber:</p>
          <EscolhaDeRecursos recursos={descoberta.recursos} marcados={marcados} onChange={setMarcados}
            desabilitados={descoberta.recursos.filter((r) => !permitidos.includes(r.recurso)).map((r) => r.recurso)} />
        </div>
      )}
      {erro && <p className="text-sm text-red-crit">{erro}</p>}
      <div className="flex gap-2">
        <button type="button" className={BTN_PRIMARY} disabled={!descoberta?.ok || nome.trim().length < 2 || ocupado} onClick={async () => {
          setOcupado(true); setErro(null)
          try {
            await chamar('/api/admin/api/fontes', 'POST', { nome, url, chave, segredoWebhook: segredo || null, recursos: marcados })
            setAberto(false); setNome(''); setUrl(''); setChave(''); setSegredo(''); setDescoberta(null)
            onCriada()
          } catch (e) { setErro((e as Error).message) } finally { setOcupado(false) }
        }}>Salvar e receber</button>
        <button type="button" className={BTN_OUTLINE} onClick={() => setAberto(false)}>Cancelar</button>
      </div>
    </div>
  )
}

function CartaoFonte({ fonte, urlBase, recarregar }: { fonte: Fonte; urlBase: string; recarregar: () => void }) {
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [descoberta, setDescoberta] = useState<Descoberta | null>(null)
  const [marcados, setMarcados] = useState<string[]>(fonte.recursos)
  const [segredo, setSegredo] = useState('')
  const enderecoWebhook = `${urlBase}/api/v1/webhooks/${fonte.slug}`

  async function acao(fn: () => Promise<unknown>, ok?: string) {
    setOcupado(true); setAviso(null)
    try { await fn(); if (ok) setAviso(ok); recarregar() } catch (e) { setAviso((e as Error).message) } finally { setOcupado(false) }
  }

  return (
    <div className={`card space-y-4 ${fonte.ativa ? '' : 'opacity-70'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-navy">{fonte.nome}</h3>
          <p className="text-xs text-mid-grey">{fonte.url} · chave …{fonte.chaveFinal}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={BTN_OUTLINE_SM} disabled={ocupado || !fonte.ativa}
            onClick={() => acao(() => chamar(`/api/admin/api/fontes/${fonte.id}/sincronizar`, 'POST'), 'Atualizado.')}>
            {ocupado ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Download className="size-3.5" aria-hidden />} Atualizar agora
          </button>
          <Chave ligada={fonte.ativa} ocupada={ocupado} rotulo={`Receber de ${fonte.nome}`} onClick={() => acao(() => chamar(`/api/admin/api/fontes/${fonte.id}`, 'PATCH', { ativa: !fonte.ativa }))} />
        </div>
      </div>

      <ul className="divide-y divide-navy/10 rounded-xl border border-navy/10">
        {fonte.estado.length === 0 && <li className="px-4 py-3 text-sm text-mid-grey">Nenhum recurso escolhido.</li>}
        {fonte.estado.map((e) => (
          <li key={e.recurso} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="font-medium text-navy">{e.recurso}</span>
            <span className={`text-xs ${e.erro ? 'text-red-crit' : e.liberadoPelaFonte === false ? 'text-mid-grey' : e.sincronizadoEm ? 'text-green-ok' : 'text-mid-grey'}`} title={e.erro ?? undefined}>
              {e.erro ? 'Erro na última tentativa' : e.liberadoPelaFonte === false ? 'A fonte não libera mais' : e.sincronizadoEm ? `${e.total} registro(s) · ${quando(e.sincronizadoEm)}` : 'Ainda não recebido'}
            </span>
          </li>
        ))}
      </ul>

      <div className="space-y-2">
        <button type="button" className={BTN_OUTLINE_SM} disabled={ocupado} onClick={() => acao(async () => {
          const d = await chamar<Descoberta>(`/api/admin/api/fontes/${fonte.id}/descobrir`, 'POST')
          setDescoberta(d); setMarcados(fonte.recursos)
        })}>Escolher o que receber</button>
        {descoberta && !descoberta.ok && <p className="text-sm text-red-crit">{descoberta.erro}</p>}
        {descoberta?.ok && descoberta.recursos && (
          <div className="space-y-2 rounded-xl border border-navy/10 p-3">
            <EscolhaDeRecursos recursos={descoberta.recursos} marcados={marcados} onChange={setMarcados}
              desabilitados={descoberta.recursos.filter((r) => !r.permitido).map((r) => r.recurso)} />
            <p className="text-xs text-mid-grey">O que você desmarcar tem a cópia apagada daqui.</p>
            <button type="button" className={BTN_NAVY} onClick={() => acao(async () => {
              await chamar(`/api/admin/api/fontes/${fonte.id}`, 'PATCH', { recursos: marcados })
              setDescoberta(null)
            }, 'Salvo.')}>Salvar</button>
          </div>
        )}
      </div>

      <div className="space-y-1.5 rounded-xl bg-navy/[0.03] p-3 text-xs text-mid-grey">
        <p>
          <strong className="text-navy">Avisos na hora:</strong> no outro sistema, cadastre um webhook no aplicativo do VerAI com este endereço{' '}
          {fonte.temSegredo ? 'e o segredo já está guardado aqui.' : 'e cole o segredo dele abaixo.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="break-all text-navy">{enderecoWebhook}</code>
          <Copiar texto={enderecoWebhook} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input className={`${INPUT_BASE} py-1 text-xs`} placeholder={fonte.temSegredo ? 'Trocar segredo do webhook' : 'Segredo do webhook (whsec_…)'} value={segredo} onChange={(e) => setSegredo(e.target.value)} />
          <button type="button" className={BTN_OUTLINE_SM} disabled={!segredo || ocupado} onClick={() => acao(async () => {
            await chamar(`/api/admin/api/fontes/${fonte.id}`, 'PATCH', { segredoWebhook: segredo })
            setSegredo('')
          }, 'Segredo salvo.')}>Salvar segredo</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-navy/10 pt-3">
        <button type="button" className={LINK_DANGER} onClick={() => window.confirm(`Excluir a fonte ${fonte.nome}? Tudo o que veio dela é apagado daqui.`) && acao(() => chamar(`/api/admin/api/fontes/${fonte.id}`, 'DELETE'))}>
          <Trash2 className="size-3.5" aria-hidden /> Excluir fonte
        </button>
        {aviso && <span className="text-sm text-navy">{aviso}</span>}
      </div>
    </div>
  )
}

// ─── Documentação ───────────────────────────────────────────────────────────────

function Documentacao({ painel }: { painel: Painel }) {
  const base = painel.urlBase
  const exemplo = `curl -H "Authorization: Bearer vrai_SUA_CHAVE" "${base}/api/v1/contratos?limite=50"`
  return (
    <div className="card space-y-4 text-sm text-navy">
      <div>
        <h3 className="font-semibold">Como outro sistema usa a API do VerAI</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-mid-grey">
          <li>Crie um aplicativo na aba Aplicativos, marque o que ele pode ler e copie a chave.</li>
          <li>O outro sistema manda a chave em <code>Authorization: Bearer &lt;chave&gt;</code>.</li>
          <li>Para saber das mudanças na hora, cadastre um webhook no aplicativo.</li>
        </ol>
      </div>
      <div>
        <p className="font-medium">Endpoints</p>
        <ul className="mt-1 space-y-0.5 font-mono text-xs text-mid-grey">
          <li>GET {base}/api/v1 — quem é a chave e o que ela pode ler</li>
          <li>GET {base}/api/v1/&lt;recurso&gt;?pagina=1&amp;limite=100&amp;cliente=SGM&amp;gerencia=GRC-4</li>
          <li>GET {base}/api/v1/&lt;recurso&gt;/&lt;id&gt;</li>
          <li>POST {base}/api/v1/acoes/localizar-contratos</li>
        </ul>
        <p className="mt-1 text-xs text-mid-grey">Recursos: {painel.recursos.map((r) => r.recurso).join(', ')}.</p>
      </div>
      <div>
        <p className="font-medium">Exemplo</p>
        <div className="mt-1 flex items-start gap-2">
          <code className="block flex-1 break-all rounded-lg bg-navy/[0.04] p-2 text-xs">{exemplo}</code>
          <Copiar texto={exemplo} />
        </div>
      </div>
      <div>
        <p className="font-medium">Webhooks</p>
        <p className="text-xs text-mid-grey">
          POST com <code>{'{ id, tipo: "recursos.alterados" | "ping", origem: "verai", recursos: [...], ocorridoEm }'}</code> e o cabeçalho{' '}
          <code>X-Webhook-Assinatura: t=&lt;unix&gt;,v1=&lt;HMAC-SHA256(segredo, &quot;t.corpo&quot;)&gt;</code>. O aviso diz só o que mudou; busque os dados pela API.
          Recuse assinaturas com mais de 5 minutos.
        </p>
      </div>
      <a className={BTN_OUTLINE} href="/api/v1/openapi.json" target="_blank" rel="noreferrer">
        <BookOpen className="size-4" aria-hidden /> Especificação OpenAPI
      </a>
    </div>
  )
}

// ─── Página ────────────────────────────────────────────────────────────────────

type Aba = 'apps' | 'fontes' | 'docs'

export default function AdminApiPage() {
  const [painel, setPainel] = useState<Painel | null>(null)
  const [aba, setAba] = useState<Aba>('apps')
  const [revelado, setRevelado] = useState<{ titulo: string; valor: string; texto: string } | null>(null)

  const carregar = useCallback(async () => {
    setPainel(await chamar<Painel>('/api/admin/api'))
  }, [])

  useEffect(() => {
    carregar().catch(() => setPainel(null))
  }, [carregar])

  const abas: { id: Aba; rotulo: string; detalhe: string }[] = [
    { id: 'apps', rotulo: 'Aplicativos', detalhe: `${painel?.apps.length ?? 0} com acesso ao VerAI` },
    { id: 'fontes', rotulo: 'Fontes externas', detalhe: `${painel?.fontes.length ?? 0} enviando dados ao VerAI` },
    { id: 'docs', rotulo: 'Documentação', detalhe: 'Como integrar' },
  ]

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <div className="flex items-center gap-2">
          <KeyRound className="size-5 text-orange" strokeWidth={2.25} />
          <h1 className="text-2xl font-semibold text-navy">API e integrações</h1>
        </div>
        <p className="mt-1 text-sm text-mid-grey">
          Outros sistemas leem os dados do VerAI com uma chave própria e só o que você liberar. Do outro lado, o VerAI recebe dados das fontes que você cadastrar.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-navy/10">
        {abas.map((a) => (
          <button key={a.id} type="button" onClick={() => setAba(a.id)}
            className={`-mb-px border-b-2 px-3 pb-2 text-left ${aba === a.id ? 'border-orange text-navy' : 'border-transparent text-mid-grey hover:text-navy'}`}>
            <span className="block text-sm font-semibold">{a.rotulo}</span>
            <span className="block text-xs">{a.detalhe}</span>
          </button>
        ))}
      </div>

      {revelado && <Revelado {...revelado} onFechar={() => setRevelado(null)} />}

      {!painel ? (
        <p className="flex items-center gap-2 text-sm text-mid-grey"><Loader2 className="size-4 animate-spin" aria-hidden /> Carregando…</p>
      ) : aba === 'apps' ? (
        <div className="space-y-4">
          <NovoApp recursos={painel.recursos} onCriado={(chave) => { void carregar(); setRevelado({ titulo: 'Chave do novo aplicativo', valor: chave, texto: 'Copie agora e cadastre no outro sistema — por segurança ela não aparece de novo (dá para gerar outra).' }) }} />
          {painel.apps.length === 0 && <p className="text-sm text-mid-grey">Nenhum aplicativo ainda. Nada sai do VerAI até você criar um.</p>}
          {painel.apps.map((app) => (
            <CartaoApp key={app.id} app={app} recursos={painel.recursos} recarregar={() => void carregar()} revelar={(titulo, valor, texto) => setRevelado({ titulo, valor, texto })} />
          ))}
        </div>
      ) : aba === 'fontes' ? (
        <div className="space-y-4">
          <NovaFonte urlBase={painel.urlBase} onCriada={() => void carregar()} />
          {painel.fontes.length === 0 && <p className="text-sm text-mid-grey">Nenhuma fonte. O VerAI não recebe dados de outro sistema.</p>}
          {painel.fontes.map((f) => (
            <CartaoFonte key={f.id} fonte={f} urlBase={painel.urlBase} recarregar={() => void carregar()} />
          ))}
        </div>
      ) : (
        <Documentacao painel={painel} />
      )}
    </main>
  )
}
