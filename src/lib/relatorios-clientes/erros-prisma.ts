import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

/**
 * Traduz as corridas previsíveis de escrita em resposta HTTP, em vez de 500:
 * `P2025` (o registro sumiu entre a leitura e a escrita) → 404 com a mensagem
 * dada; `P2003` (FK aponta pra registro inexistente) → 400. Qualquer outro erro
 * é relançado.
 */
export function respostaErroPrisma(erro: unknown, naoEncontrado: string): NextResponse {
  if (erro instanceof Prisma.PrismaClientKnownRequestError) {
    if (erro.code === 'P2025') return NextResponse.json({ error: naoEncontrado }, { status: 404 })
    if (erro.code === 'P2003') {
      return NextResponse.json({ error: 'registro relacionado não existe' }, { status: 400 })
    }
  }
  throw erro
}
