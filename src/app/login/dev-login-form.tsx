'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { BTN_PRIMARY } from '@/lib/ui'

export function DevLoginForm() {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    const response = await fetch('/api/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (!response.ok) {
      setErro('Não foi possível entrar')
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
          <p className="text-sm text-mid-grey">Modo de desenvolvimento — acesso direto como administrador.</p>
        </div>

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
