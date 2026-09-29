import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { abrirUpload } from '@/lib/storage'
import { podeVerArea } from '@/lib/biblioteca/areas'

type Contexto = { params: Promise<{ id: string }> }

/** Nome só com ASCII para o `filename=` de navegador velho (o `filename*` leva o nome certo). */
const nomeAscii = (nome: string) => nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]|["\\]/g, '_')

/** Única saída do conteúdo de um arquivo da biblioteca Documentos (spec 2026-09-29-biblioteca-documentos-prodam
 *  §7): a chave do R2 nunca vai ao navegador. Área que o usuário não pode ver responde 404, como se não
 *  existisse. Sempre por streaming. */
export async function GET(request: NextRequest, { params }: Contexto) {
  const usuario = await getAuthUser(request)
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const { id } = await params
  const arquivo = await prisma.arquivoBiblioteca.findUnique({
    where: { id },
    select: { area: true, nome: true, contentType: true, chave: true },
  })
  if (!arquivo || !podeVerArea(usuario.role, arquivo.area)) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  const res = await abrirUpload(arquivo.chave).catch(() => null)
  if (!res?.ok || !res.body) {
    return NextResponse.json({ error: 'não foi possível ler o arquivo agora — tente de novo' }, { status: 502 })
  }

  const modo = request.nextUrl.searchParams.get('baixar') === '1' ? 'attachment' : 'inline'
  const headers = new Headers({
    'Content-Type': arquivo.contentType,
    'Content-Disposition': `${modo}; filename="${nomeAscii(arquivo.nome)}"; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`,
    'X-Content-Type-Options': 'nosniff',
  })
  const tamanho = res.headers.get('content-length')
  if (tamanho) headers.set('Content-Length', tamanho)
  return new NextResponse(res.body, { headers })
}
