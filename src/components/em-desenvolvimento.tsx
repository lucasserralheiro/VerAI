import { Construction } from 'lucide-react'

// Aviso de tela ainda não construída. Ocupa o lugar do conteúdo da página
// mantendo o cabeçalho, pra deixar claro que o que existe ali não é a
// funcionalidade final.
export function EmDesenvolvimento({ titulo }: { titulo: string }) {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-1">
        <span className="text-xs font-semibold tracking-wide text-orange uppercase">Painel</span>
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">{titulo}</h1>
      </div>

      <div className="card-flush flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-orange-light text-orange">
          <Construction className="size-6" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <p className="text-base font-semibold text-navy">Em desenvolvimento</p>
          <p className="max-w-md text-sm text-mid-grey">
            Esta área ainda não está disponível. O conteúdo vai aparecer aqui quando a funcionalidade for
            liberada.
          </p>
        </div>
      </div>
    </main>
  )
}
