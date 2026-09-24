import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { custoEstimadoUsd, precosDoAmbiente } from '@/lib/assistente/custo'

interface LinhaUso {
  mes: string
  usuario: string
  perguntas: number
  entrada: number
  cache: number
  saida: number
}

export async function GET(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  if (autenticado.usuario.role !== 'admin') return NextResponse.json({ error: 'acesso negado' }, { status: 403 })

  const linhas = await prisma.$queryRaw<LinhaUso[]>`
    SELECT to_char(m."createdAt", 'YYYY-MM') AS mes,
           u.nome AS usuario,
           (count(*) FILTER (WHERE m.papel = 'usuario'))::int AS perguntas,
           coalesce(sum(m."tokensEntrada"), 0)::int AS entrada,
           coalesce(sum(m."tokensCache"), 0)::int AS cache,
           coalesce(sum(m."tokensSaida"), 0)::int AS saida
      FROM "MensagemAssistente" m
      JOIN "ConversaAssistente" c ON c.id = m."conversaId"
      JOIN "Usuario" u ON u.id = c."usuarioId"
     WHERE m."createdAt" >= now() - interval '6 months'
     GROUP BY 1, 2
     ORDER BY 1 DESC, 2`
  const precos = precosDoAmbiente()
  return NextResponse.json({
    precosConfigurados: precos !== null,
    linhas: linhas.map((l) => ({ ...l, custoUsd: precos ? custoEstimadoUsd(l, precos) : null })),
  })
}
