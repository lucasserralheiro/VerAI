import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { getR2 } from '@/lib/r2'
import { NOME_IMAGEM_VALIDO, chaveImagemProposta } from '@/lib/propostas/imagens'

type Contexto = { params: Promise<{ id: string; indice: string; nome: string }> }

/** Imagem extraída de dentro do PDF na conversão (o `src` do `<img>` do HTML da proposta). O R2 é
 *  privado: a imagem só sai por aqui, pra quem está logado — mesma regra de quem vê a proposta. */
export async function GET(request: NextRequest, { params }: Contexto) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id, indice, nome } = await params
  const naoEncontrada = NextResponse.json({ error: 'imagem não encontrada' }, { status: 404 })
  if (!/^\d+$/.test(indice) || !NOME_IMAGEM_VALIDO.test(nome)) return naoEncontrada

  const proposta = await prisma.propostaComercial.findUnique({ where: { id }, select: { id: true } })
  if (!proposta) return naoEncontrada

  const res = await getR2(chaveImagemProposta(id, indice, nome)).catch(() => null)
  if (res?.status === 404) return naoEncontrada
  if (!res?.ok || !res.body) {
    console.error('[propostas-comerciais] falha ao ler imagem do R2', res ? `status ${res.status}` : 'sem resposta')
    return NextResponse.json({ error: 'não foi possível ler a imagem agora — tente de novo' }, { status: 502 })
  }

  const headers = new Headers({
    'Content-Type': 'image/png',
    'X-Content-Type-Options': 'nosniff',
    // A imagem de uma conversão nunca muda (nova conversão = nova proposta, outra URL).
    'Cache-Control': 'private, max-age=86400, immutable',
  })
  const tamanho = res.headers.get('content-length')
  if (tamanho) headers.set('Content-Length', tamanho)

  return new NextResponse(res.body, { headers })
}
