import { NextRequest, NextResponse } from 'next/server'

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUpload } from '@/lib/storage'

/** Um dos PDFs de entrada guardados por uma execução (contrato ou aditivo), pela
 *  posição em `arquivosEntrada`. Serve inline, para o visualizador do histórico.
 *  O endereço do storage nunca vai ao navegador. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; indice: string }> }
) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id, indice } = await params
  const execucao = await prisma.confereExecucao.findUnique({
    where: { id },
    select: { arquivosEntrada: true },
  })
  const entradas = Array.isArray(execucao?.arquivosEntrada)
    ? (execucao.arquivosEntrada as { nome: string; caminho: string }[])
    : []
  const entrada = entradas[Number(indice)]
  if (!entrada) {
    return NextResponse.json({ error: 'arquivo não encontrado' }, { status: 404 })
  }

  let arquivo: Buffer
  try {
    arquivo = await getUpload(entrada.caminho)
  } catch {
    return NextResponse.json({ error: 'arquivo não está mais disponível no storage' }, { status: 404 })
  }

  const ehPlanilha = /\.xlsx?$/i.test(entrada.caminho)
  return new NextResponse(new Uint8Array(arquivo), {
    headers: {
      'Content-Type': ehPlanilha
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf',
      'Content-Disposition': `inline; filename="${encodeURIComponent(entrada.nome)}"`,
      'Content-Length': String(arquivo.length),
    },
  })
}
