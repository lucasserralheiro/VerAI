import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TIPOS_DE_ENVIO } from '@/lib/propostas/envio'
import { getR2 } from '@/lib/r2'
import { CONTENT_TYPE_XLSX } from '@/lib/reajuste/arquivos'

/** Download do original ou do resultado de um reajuste do histórico. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; qual: string }> }) {
  if (!(await getAuthUser(request))) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const { id, qual } = await params
  if (qual !== 'original' && qual !== 'resultado') return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  const execucao = await prisma.reajusteExecucao.findUnique({ where: { id } })
  if (!execucao) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  const base = execucao.nomeArquivo.replace(/\.[^.]+$/, '')
  const [chave, nome, tipo] =
    qual === 'original'
      ? [execucao.chaveOriginal, execucao.nomeArquivo, TIPOS_DE_ENVIO[execucao.tipoArquivo as keyof typeof TIPOS_DE_ENVIO]]
      : [execucao.chaveResultado, `${base} - reajustado.xlsx`, CONTENT_TYPE_XLSX]
  const arquivo = await getR2(chave)
  if (!arquivo.ok) return NextResponse.json({ error: 'arquivo não encontrado no armazenamento' }, { status: 404 })
  return new NextResponse(arquivo.body, {
    headers: { 'Content-Type': tipo, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nome)}` },
  })
}
