'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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
    <main className="space-y-4 p-8">
      <h1 className="text-xl font-semibold">Notificações</h1>

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : notificacoes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma notificação por enquanto.</p>
      ) : (
        <ul className="space-y-2">
          {notificacoes.map((notificacao) => (
            <li
              key={notificacao.id}
              className={`flex items-center justify-between rounded border p-3 text-sm ${
                notificacao.lida ? 'opacity-60' : 'bg-blue-50'
              }`}
            >
              <Link href={`/documentos/${notificacao.documentoId}`} className="hover:underline">
                {notificacao.documento.nomeArquivo} —{' '}
                {new Date(notificacao.createdAt).toLocaleString('pt-BR')}
              </Link>
              {!notificacao.lida && (
                <button
                  onClick={() => marcarComoLida(notificacao.id)}
                  className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                >
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
