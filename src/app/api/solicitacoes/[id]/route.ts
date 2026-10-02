import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario, verificarAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { ROTULOS_SOLICITACAO, SELECT_SOLICITACAO, esquemaEdicaoSolicitacao } from '@/app/api/demandas/esquema'

type Contexto = { params: Promise<{ id: string }> }

const NAO_ENCONTRADA = 'solicitação não encontrada'

// Solicitação é cabeçalho: só criar/editar, sem DELETE (decisão da passada de detalhamento).
export async function PATCH(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const atual = await prisma.solicitacao.findUnique({ where: { id }, select: { id: true, clienteId: true } })
  if (!atual) return NextResponse.json({ error: NAO_ENCONTRADA }, { status: 404 })
  const negadoAtual = await verificarAcessoCliente(autenticado.usuario, atual.clienteId, 'editar')
  if (negadoAtual) return negadoAtual

  const corpo = await lerCorpo(request, esquemaEdicaoSolicitacao, ROTULOS_SOLICITACAO)
  if ('erro' in corpo) return corpo.erro

  if (corpo.dados.clienteId && corpo.dados.clienteId !== atual.clienteId) {
    const negadoNovo = await verificarAcessoCliente(autenticado.usuario, corpo.dados.clienteId, 'editar')
    if (negadoNovo) return negadoNovo
  }

  try {
    const solicitacao = await prisma.solicitacao.update({ where: { id }, data: corpo.dados, select: SELECT_SOLICITACAO })
    return NextResponse.json(solicitacao)
  } catch (erro) {
    return respostaErroPrisma(erro, NAO_ENCONTRADA)
  }
}
