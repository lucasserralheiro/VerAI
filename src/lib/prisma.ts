import { PrismaClient } from '@prisma/client'

type ObservadorDeSql = (sql: string) => void

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; observadorDeSql?: ObservadorDeSql }

/** Liga quem recebe cada SQL executado — o aviso de mudança da API de plataforma
 *  (src/lib/integracao/aviso.ts), registrado por src/instrumentation.ts só no runtime Node. Fica fora
 *  deste arquivo de propósito: o middleware (Edge) importa `prisma` via `auth.ts`, e o aviso puxa
 *  `node:crypto`, que o Edge não tem. */
export function definirObservadorDeSql(observador: ObservadorDeSql | undefined): void {
  globalForPrisma.observadorDeSql = observador
}

/** O evento `query` entrega cada SQL ao observador (se houver): escrita em tabela do domínio comercial
 *  dispara os webhooks da API de plataforma. O tipo exportado continua `PrismaClient`. */
function criarPrisma(): PrismaClient {
  const cliente = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] })
  cliente.$on('query', (evento) => {
    try {
      globalForPrisma.observadorDeSql?.(evento.query)
    } catch {
      // observar nunca pode derrubar uma query
    }
  })
  return cliente as unknown as PrismaClient
}

export const prisma = globalForPrisma.prisma ?? criarPrisma()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
