'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Lock, AlertCircle } from 'lucide-react'
import { BTN_PRIMARY } from '@/lib/ui'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    })
    if (!response.ok) {
      setErro('Credenciais inválidas')
      return
    }
    router.push('/clientes')
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-navy p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-orange text-base font-bold text-white">
            V
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Ver<span className="text-orange">AI</span>
          </span>
        </div>

        <div className="space-y-5">
          <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-orange uppercase">
            Uso interno
          </span>
          <h1 className="max-w-md text-4xl leading-tight font-bold text-orange">
            Análise automatizada de documentos via IA
          </h1>
          <div className="h-px w-16 bg-orange" />
          <p className="max-w-sm text-sm leading-relaxed text-light-blue">
            Centralize o envio, a verificação e o histórico de documentos dos seus clientes com
            insights gerados por inteligência artificial.
          </p>
        </div>

        <p className="text-xs text-light-blue/70">
          © {new Date().getFullYear()} Prodam — VerAI
        </p>
      </section>

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
            <p className="text-sm text-mid-grey">Acesse com suas credenciais institucionais.</p>
          </div>

          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Usuário</span>
              <span className="relative flex items-center">
                <Mail className="pointer-events-none absolute left-3 size-4 text-mid-grey" strokeWidth={2} />
                <input
                  type="text"
                  autoComplete="username"
                  placeholder="admin ou voce@empresa.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-lg border border-border-grey py-2.5 pr-3 pl-9 text-sm shadow-xs outline-none transition-all focus:border-orange focus:ring-4 focus:ring-orange/12"
                  required
                />
              </span>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Senha</span>
              <span className="relative flex items-center">
                <Lock className="pointer-events-none absolute left-3 size-4 text-mid-grey" strokeWidth={2} />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  className="w-full rounded-lg border border-border-grey py-2.5 pr-3 pl-9 text-sm shadow-xs outline-none transition-all focus:border-orange focus:ring-4 focus:ring-orange/12"
                  required
                />
              </span>
            </label>
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
    </main>
  )
}
