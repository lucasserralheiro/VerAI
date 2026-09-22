import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { clientesVisiveisWhere } from '@/lib/visibilidade'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { SELECT_TERMO, serializarTermo } from '@/app/api/termos-confirmacao/esquema'
import { ROTULOS_FORNECEDOR, SELECT_CO, SELECT_FORNECEDOR, esquemaFornecedor, serializarCo } from '../esquema'

type Contexto = { params: Promise<{ id: string }> }

const NAO_ENCONTRADO = 'fornecedor não encontrado'

function naoEncontrado() {
  return NextResponse.json({ error: NAO_ENCONTRADO }, { status: 404 })
}

export async function GET(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const fornecedor = await prisma.fornecedor.findUnique({ where: { id }, select: SELECT_FORNECEDOR })
  if (!fornecedor) return naoEncontrado()

  // O fornecedor é de todos, mas cada termo pertence a um cliente: só entram os visíveis.
  const [cos, termos] = await Promise.all([
    prisma.contratoOperacionalizacao.findMany({
      where: { fornecedorId: id },
      orderBy: [{ dataInicio: 'desc' }, { createdAt: 'desc' }],
      select: SELECT_CO,
    }),
    prisma.termoConfirmacao.findMany({
      where: { fornecedorId: id, cliente: await clientesVisiveisWhere(autenticado.usuario) },
      orderBy: [{ vigenciaInicio: 'desc' }, { createdAt: 'desc' }],
      select: SELECT_TERMO,
    }),
  ])

  return NextResponse.json({ ...fornecedor, cos: cos.map(serializarCo), termos: termos.map(serializarTermo) })
}

export async function PATCH(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const existente = await prisma.fornecedor.findUnique({ where: { id }, select: { id: true } })
  if (!existente) return naoEncontrado()

  const corpo = await lerCorpo(request, esquemaFornecedor, ROTULOS_FORNECEDOR)
  if ('erro' in corpo) return corpo.erro

  try {
    const fornecedor = await prisma.fornecedor.update({ where: { id }, data: corpo.dados, select: SELECT_FORNECEDOR })
    return NextResponse.json(fornecedor)
  } catch (erro) {
    return respostaErroPrisma(erro, NAO_ENCONTRADO)
  }
}
