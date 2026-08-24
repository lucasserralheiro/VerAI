import { devAuthEnabled } from '@/lib/dev-auth'
import { LoginForm } from './login-form'
import { DevLoginForm } from './dev-login-form'

export default function LoginPage() {
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

      {devAuthEnabled() ? <DevLoginForm /> : <LoginForm />}
    </main>
  )
}
