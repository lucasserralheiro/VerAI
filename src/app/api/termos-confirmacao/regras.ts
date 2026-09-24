import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ERRO_VIGENCIA, vigenciaInvalida } from '@/app/api/fornecedores/esquema'

export { contratoForaDoCliente } from '@/app/api/contratos/carregar'

export function erroVigencia(inicio: Date | null | undefined, fim: Date | null | undefined): NextResponse | null {
  return vigenciaInvalida(inicio, fim) ? NextResponse.json({ error: ERRO_VIGENCIA }, { status: 400 }) : null
}

/** 400 pronto quando o CO informado não existe ou é de outro fornecedor que não o do termo. */
export async function coForaDoFornecedor(coId: string, fornecedorId: string): Promise<NextResponse | null> {
  const co = await prisma.contratoOperacionalizacao.findUnique({ where: { id: coId }, select: { fornecedorId: true } })
  if (co?.fornecedorId === fornecedorId) return null
  const mensagem = co ? 'CO: não é deste fornecedor' : 'CO: não encontrado'
  return NextResponse.json({ error: mensagem }, { status: 400 })
}
