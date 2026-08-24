'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, AlertCircle } from 'lucide-react'
import { BTN_PRIMARY } from '@/lib/ui'

export function DevLoginForm() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    const response = await fetch('/api/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (!response.ok) {
      setErro('Token inválido')
      return
    }
    router.push('/clientes')
  }

  return (
    <section className="flex items-center justify-center bg-background p-8">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="space-y-1 lg:hidden">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-md bg-orange text-base font-bold text-white">
              V
            </span>
            <span className="text-lg font-semibold tracking-tight text-navy">
              Ver<span className="text-orange">AI</span>
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-navy">Entrar</h2>
          <p className="text-sm text-mid-grey">Modo de desenvolvimento — informe o token de acesso.</p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">Token</span>
          <span className="relative flex items-center">
            <KeyRound className="pointer-events-none absolute left-3 size-4 text-mid-grey" strokeWidth={2} />
            <input
              type="text"
              autoComplete="off"
              placeholder="verai_2026"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="w-full rounded-lg border border-border-grey py-2.5 pr-3 pl-9 text-sm shadow-xs outline-none transition-all focus:border-orange focus:ring-4 focus:ring-orange/12"
              required
            />
          </span>
        </label>

        {erro && (
          <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
            <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
            {erro}
          </p>
        )}

        <button type="submit" className={`${BTN_PRIMARY} w-full justify-center`}>
          Entrar
        </button>
      </form>
    </section>
  )
}
