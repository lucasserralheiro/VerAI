'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, KeyRound } from 'lucide-react'
import { BTN_PRIMARY } from '@/lib/ui'

// O token não existe no front: vai digitado pro /api/auth/dev-login e quem
// confere é o servidor, contra DEV_AUTH_TOKEN.
export function DevLoginForm() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const response = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!response.ok) {
        setErro(response.status === 401 ? 'Token inválido' : 'Não foi possível entrar')
        setToken('')
        return
      }
      router.push('/clientes')
    } catch {
      setErro('Não foi possível entrar')
    } finally {
      setEnviando(false)
    }
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
          <p className="text-sm text-mid-grey">Sistema em desenvolvimento — informe o token de acesso.</p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">Token de acesso</span>
          <span className="relative flex items-center">
            <KeyRound className="pointer-events-none absolute left-3 size-4 text-mid-grey" strokeWidth={2} />
            <input
              type="password"
              autoComplete="off"
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

        <button type="submit" disabled={enviando} className={`${BTN_PRIMARY} w-full justify-center`}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </section>
  )
}
