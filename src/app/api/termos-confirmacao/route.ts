import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { clientesVisiveisWhere } from '@/lib/visibilidade'
import { exigirAcessoCliente, exigirUsuario, verificarAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { ROTULOS_TERMO, SELECT_TERMO, esquemaNovoTermo, serializarTermo } from './esquema'
import { contratoForaDoCliente, erroVigencia } from './regras'

const ORDEM = [{ vigenciaInicio: 'desc' as const }, { createdAt: 'desc' as const }]

/** `?clienteId=` (aba Fornecedores da ficha do cliente) ou `?fornecedorId=` (ficha do fornecedor —
 *  só os termos dos clientes visíveis ao usuário). */
export async function GET(request: NextRequest) {
  const clienteId = request.nextUrl.searchParams.get('clienteId')
  const fornecedorId = request.nextUrl.searchParams.get('fornecedorId')

  if (clienteId) {
    const acesso = await exigirAcessoCliente(request, clienteId)
    if ('erro' in acesso) return acesso.erro
    const termos = await prisma.termoConfirmacao.findMany({ where: { clienteId }, orderBy: ORDEM, select: SELECT_TERMO })
    return NextResponse.json(termos.map(serializarTermo))
  }

  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  if (!fornecedorId) return NextResponse.json({ error: 'informe clienteId ou fornecedorId' }, { status: 400 })

  const termos = await prisma.termoConfirmacao.findMany({
    where: { fornecedorId, cliente: await clientesVisiveisWhere(autenticado.usuario) },
    orderBy: ORDEM,
    select: SELECT_TERMO,
  })
  return NextResponse.json(termos.map(serializarTermo))
}

export async function POST(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const corpo = await lerCorpo(request, esquemaNovoTermo, ROTULOS_TERMO)
  if ('erro' in corpo) return corpo.erro
  const { clienteId, contratoId, vigenciaInicio, vigenciaFim } = corpo.dados

  const negado = await verificarAcessoCliente(autenticado.usuario, clienteId)
  if (negado) return negado

  const invalido = (contratoId && (await contratoForaDoCliente(contratoId, clienteId))) || erroVigencia(vigenciaInicio, vigenciaFim)
  if (invalido) return invalido

  try {
    const termo = await prisma.termoConfirmacao.create({ data: corpo.dados, select: SELECT_TERMO })
    return NextResponse.json(serializarTermo(termo), { status: 201 })
  } catch (erro) {
    // P2003 aqui = fornecedor ou cliente inexistente.
    return respostaErroPrisma(erro, 'termo de confirmação não encontrado')
  }
}
