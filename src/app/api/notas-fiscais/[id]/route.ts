import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario, verificarAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { ROTULOS_NOTA, SELECT_NOTA, esquemaEdicaoNota, serializarNota } from '@/app/api/faturamentos/esquema'

type Contexto = { params: Promise<{ id: string }> }

const NAO_ENCONTRADA = 'nota fiscal não encontrada'

/** Autentica, acha a nota e checa acesso pelo cliente do faturamento dela (401 → 404 → 403). */
async function carregarComAcesso(request: NextRequest, id: string) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado

  const nota = await prisma.notaFiscal.findUnique({
    where: { id },
    select: { id: true, faturamento: { select: { clienteId: true } } },
  })
  if (!nota) return { erro: NextResponse.json({ error: NAO_ENCONTRADA }, { status: 404 }) }

  const negado = await verificarAcessoCliente(autenticado.usuario, nota.faturamento.clienteId)
  return negado ? { erro: negado } : { nota }
}

export async function PATCH(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const corpo = await lerCorpo(request, esquemaEdicaoNota, ROTULOS_NOTA)
  if ('erro' in corpo) return corpo.erro

  try {
    const nota = await prisma.notaFiscal.update({ where: { id }, data: corpo.dados, select: SELECT_NOTA })
    return NextResponse.json(serializarNota(nota))
  } catch (erro) {
    return respostaErroPrisma(erro, NAO_ENCONTRADA)
  }
}

export async function DELETE(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  try {
    await prisma.notaFiscal.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (erro) {
    return respostaErroPrisma(erro, NAO_ENCONTRADA)
  }
}
