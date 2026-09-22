import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { ERRO_VIGENCIA, ROTULOS_CO, SELECT_CO, esquemaCo, serializarCo, vigenciaInvalida } from '../../esquema'

type Contexto = { params: Promise<{ id: string }> }

const NAO_ENCONTRADO = 'fornecedor não encontrado'

export async function POST(request: NextRequest, { params }: Contexto) {
  const { id: fornecedorId } = await params
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const fornecedor = await prisma.fornecedor.findUnique({ where: { id: fornecedorId }, select: { id: true } })
  if (!fornecedor) return NextResponse.json({ error: NAO_ENCONTRADO }, { status: 404 })

  const corpo = await lerCorpo(request, esquemaCo, ROTULOS_CO)
  if ('erro' in corpo) return corpo.erro
  if (vigenciaInvalida(corpo.dados.dataInicio, corpo.dados.dataFim)) {
    return NextResponse.json({ error: ERRO_VIGENCIA }, { status: 400 })
  }

  try {
    const co = await prisma.contratoOperacionalizacao.create({
      data: { fornecedorId, ...corpo.dados },
      select: SELECT_CO,
    })
    return NextResponse.json(serializarCo(co), { status: 201 })
  } catch (erro) {
    return respostaErroPrisma(erro, NAO_ENCONTRADO)
  }
}
