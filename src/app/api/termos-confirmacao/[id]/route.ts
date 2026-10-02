import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario, verificarAcessoCliente, type ModoAcesso } from '@/lib/relatorios-clientes/acesso'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { ROTULOS_TERMO, SELECT_TERMO, esquemaEdicaoTermo, serializarTermo } from '../esquema'
import { coForaDoFornecedor, contratoForaDoCliente, erroVigencia } from '../regras'

type Contexto = { params: Promise<{ id: string }> }

const NAO_ENCONTRADO = 'termo de confirmação não encontrado'

/** Autentica, acha o registro e checa acesso pelo `clienteId` dele (401 → 404 → 403). */
async function carregarComAcesso(request: NextRequest, id: string, modo: ModoAcesso) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado

  const termo = await prisma.termoConfirmacao.findUnique({
    where: { id },
    select: { id: true, clienteId: true, fornecedorId: true, contratoOperacionalizacaoId: true, vigenciaInicio: true, vigenciaFim: true },
  })
  if (!termo) return { erro: NextResponse.json({ error: NAO_ENCONTRADO }, { status: 404 }) }

  const negado = await verificarAcessoCliente(autenticado.usuario, termo.clienteId, modo)
  return negado ? { erro: negado } : { termo }
}

export async function PATCH(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarComAcesso(request, id, 'editar')
  if ('erro' in carregado) return carregado.erro
  const { termo } = carregado

  const corpo = await lerCorpo(request, esquemaEdicaoTermo, ROTULOS_TERMO)
  if ('erro' in corpo) return corpo.erro
  const { contratoId, vigenciaInicio, vigenciaFim } = corpo.dados

  // PATCH parcial: o que não veio no corpo é o que já está gravado. O CO tem que ser do fornecedor
  // final do termo (trocar o fornecedor e manter o CO do antigo é recusado).
  const fornecedorFinal = corpo.dados.fornecedorId ?? termo.fornecedorId
  const coFinal =
    corpo.dados.contratoOperacionalizacaoId === undefined ? termo.contratoOperacionalizacaoId : corpo.dados.contratoOperacionalizacaoId
  const invalido =
    (contratoId && (await contratoForaDoCliente(contratoId, termo.clienteId))) ||
    (coFinal && (await coForaDoFornecedor(coFinal, fornecedorFinal))) ||
    erroVigencia(
      vigenciaInicio === undefined ? termo.vigenciaInicio : vigenciaInicio,
      vigenciaFim === undefined ? termo.vigenciaFim : vigenciaFim
    )
  if (invalido) return invalido

  try {
    const atualizado = await prisma.termoConfirmacao.update({ where: { id }, data: corpo.dados, select: SELECT_TERMO })
    return NextResponse.json(serializarTermo(atualizado))
  } catch (erro) {
    return respostaErroPrisma(erro, NAO_ENCONTRADO)
  }
}

export async function DELETE(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarComAcesso(request, id, 'editar')
  if ('erro' in carregado) return carregado.erro

  try {
    await prisma.termoConfirmacao.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (erro) {
    return respostaErroPrisma(erro, NAO_ENCONTRADO)
  }
}
