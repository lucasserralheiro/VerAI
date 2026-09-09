import { NextRequest, NextResponse } from 'next/server'

/**
 * Rota substituída por `/api/propostas-comerciais/[id]/arquivos/[arquivoId]`
 * — cada proposta agora pode ter vários arquivos de origem, então "o PDF
 * original" deixou de fazer sentido como conceito único. Mantida só pra
 * responder com 410 Gone em vez de quebrar em runtime caso algo externo
 * ainda aponte pra ela.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return NextResponse.json(
    {
      error:
        'rota descontinuada — uma proposta agora pode ter vários arquivos; use /api/propostas-comerciais/' +
        id +
        '/arquivos/{arquivoId}',
    },
    { status: 410 }
  )
}
