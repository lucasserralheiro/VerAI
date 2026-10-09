/** Roda uma vez quando o servidor sobe (Next.js instrumentation). Só no runtime Node: liga o aviso de
 *  mudança da API de plataforma ao Prisma (spec docs/superpowers/specs/2026-10-08-api-plataforma-design.md
 *  §5). No Edge (middleware) não há `node:crypto` nem webhook a disparar. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const [{ definirObservadorDeSql }, { observarSql }] = await Promise.all([import('./lib/prisma'), import('./lib/integracao/aviso')])
  definirObservadorDeSql(observarSql)
}
