import type { PrismaClient } from '@prisma/client'

/** O agendador do SharePoint roda o código da pasta contra PRODUÇÃO, que pode estar num deploy sem a
 *  migração: cada etapa nova confere antes de tocar nas tabelas dela. */
export async function migracaoAplicada(prisma: PrismaClient, nome: string): Promise<boolean> {
  const linhas = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "_prisma_migrations" WHERE migration_name = ${nome} AND finished_at IS NOT NULL`
  return Number(linhas[0]?.n ?? 0) > 0
}
