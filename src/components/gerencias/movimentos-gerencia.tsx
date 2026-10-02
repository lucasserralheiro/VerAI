import type { MovimentoSerializado } from '@/lib/gerencias/tipos'

export function formatarMovimento(m: MovimentoSerializado): string {
  const data = new Date(m.em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  return `${m.cliente} · ${m.de ?? 'Sem gerência'} → ${m.para ?? 'Sem gerência'} · ${m.por ?? 'Sistema'} · ${data}`
}

export function MovimentosGerencia({ movimentos }: { movimentos: MovimentoSerializado[] }) {
  return (
    <section className="card space-y-2">
      <h2 className="text-lg font-semibold text-navy">Movimentos</h2>
      {movimentos.length === 0 ? (
        <p className="text-sm text-mid-grey">Nenhum movimento ainda.</p>
      ) : (
        <ul className="space-y-1 text-sm text-mid-grey">
          {movimentos.map((m) => (
            <li key={m.id}>{formatarMovimento(m)}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
