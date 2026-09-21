import { NextRequest, NextResponse } from 'next/server'

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteUpload } from '@/lib/storage'

/** Uma execução do histórico, com o resultado guardado — é o que alimenta
 *  `/confere/historico/[id]`, que reabre o mesmo grid da tela de geração.
 *
 *  `resultado` vem `null` nas execuções gravadas antes da migração
 *  `20260921190000`: a página trata esse caso mostrando os downloads e
 *  dizendo que o detalhamento não foi guardado. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const execucao = await prisma.confereExecucao.findUnique({
    where: { id },
    select: {
      id: true,
      nomeContrato: true,
      nomeLevantamento: true,
      nomesAditivos: true,
      resultado: true,
      createdAt: true,
    },
  })
  if (!execucao) {
    return NextResponse.json({ error: 'execução não encontrada' }, { status: 404 })
  }

  return NextResponse.json(execucao)
}

/** Apaga a linha do histórico e os dois documentos que ela guardava.
 *
 *  Os blobs saem ANTES da linha: apagar a linha primeiro deixaria os dois
 *  arquivos órfãos no bucket, sem nada no banco apontando pra eles. Cada
 *  remoção é best-effort — um blob que já não existe não pode impedir a
 *  limpeza do registro.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const execucao = await prisma.confereExecucao.findUnique({ where: { id } })
  if (!execucao) {
    return NextResponse.json({ error: 'execução não encontrada' }, { status: 404 })
  }

  await Promise.all([
    deleteUpload(execucao.caminhoDocx).catch(() => {}),
    deleteUpload(execucao.caminhoXlsx).catch(() => {}),
  ])
  await prisma.confereExecucao.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
