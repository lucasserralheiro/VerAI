import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { SELECT_ARQUIVO, serializarArquivo, usosDosArquivos } from '@/lib/arquivos/servico'

type Contexto = { params: Promise<{ clienteId: string }> }

/** O navegador calcula o SHA-256 antes de subir e pergunta aqui — arquivo que o cliente já tem nem
 *  chega a ser enviado. Não substitui a checagem do registro (o servidor recalcula o hash lá). */
export async function GET(request: NextRequest, { params }: Contexto) {
  const { clienteId } = await params
  const acesso = await exigirAcessoCliente(request, clienteId)
  if ('erro' in acesso) return acesso.erro

  const sha256 = request.nextUrl.searchParams.get('sha256')?.toLowerCase() ?? ''
  if (!/^[0-9a-f]{64}$/.test(sha256)) return NextResponse.json({ error: 'sha256 inválido' }, { status: 400 })

  const arquivo = await prisma.arquivoCliente.findFirst({
    where: { clienteId, sha256, removidoEm: null },
    select: SELECT_ARQUIVO,
  })
  if (!arquivo) return NextResponse.json({ arquivo: null })
  const usos = await usosDosArquivos([arquivo.id])
  return NextResponse.json({ arquivo: serializarArquivo(arquivo, usos.get(arquivo.id) ?? []) })
}
