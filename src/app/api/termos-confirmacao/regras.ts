import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ERRO_VIGENCIA, vigenciaInvalida } from '@/app/api/fornecedores/esquema'

/** 400 pronto quando o contrato informado não existe ou é de outro cliente; `null` quando pode. */
export async function contratoForaDoCliente(contratoId: string, clienteId: string): Promise<NextResponse | null> {
  const contrato = await prisma.contrato.findUnique({ where: { id: contratoId }, select: { clienteId: true } })
  if (contrato?.clienteId === clienteId) return null
  const mensagem = contrato ? 'Contrato: não pertence a este cliente' : 'Contrato: não encontrado'
  return NextResponse.json({ error: mensagem }, { status: 400 })
}

export function erroVigencia(inicio: Date | null | undefined, fim: Date | null | undefined): NextResponse | null {
  return vigenciaInvalida(inicio, fim) ? NextResponse.json({ error: ERRO_VIGENCIA }, { status: 400 }) : null
}
