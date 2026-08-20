'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck, Inbox, Loader2 } from 'lucide-react'
import { BTN_OUTLINE_SM } from '@/lib/ui'

interface Notificacao {
  id: string
  documentoId: string
  lida: boolean
  createdAt: string
  documento: { nomeArquivo: string }
}

export default function NotificacoesPage() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    const response = await fetch('/api/notificacoes')
    if (response.ok) {
      setNotificacoes(await response.json())
    }
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function marcarComoLida(id: string) {
    await fetch('/api/notificacoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    carregar()
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-8 lg:px-8">
      <div className="flex items-center gap-2">
        <Bell className="size-5 text-orange" strokeWidth={2.25} />
        <h1 className="text-2xl font-bold text-navy">Notificações</h1>
      </div>

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-mid-grey">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          Carregando...
        </p>
      ) : notificacoes.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <Inbox className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhuma notificação por enquanto.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notificacoes.map((notificacao) => (
            <li
              key={notificacao.id}
              className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-sm shadow-sm transition-all ${
                notificacao.lida
                  ? 'border-black/[0.05] bg-white opacity-60'
                  : 'border-orange/25 bg-orange-light shadow-md'
              }`}
            >
              <Link
                href={`/documentos/${notificacao.documentoId}`}
                className="flex items-center gap-2.5 hover:underline"
              >
                {!notificacao.lida && <span className="size-1.5 shrink-0 rounded-full bg-orange" aria-hidden />}
                <span>
                  <span className="font-medium text-navy">{notificacao.documento.nomeArquivo}</span>
                  <span className="block text-xs text-mid-grey">
                    {new Date(notificacao.createdAt).toLocaleString('pt-BR')}
                  </span>
                </span>
              </Link>
              {!notificacao.lida && (
                <button onClick={() => marcarComoLida(notificacao.id)} className={BTN_OUTLINE_SM}>
                  <CheckCheck className="size-3.5" strokeWidth={2.25} />
                  Marcar como lida
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
