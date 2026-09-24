import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import {
  ERRO_VIGENCIA,
  ROTULOS_CO,
  SELECT_CO,
  esquemaCo,
  serializarCo,
  vigenciaInvalida,
} from '@/app/api/fornecedores/esquema'

// CO (contrato de operacionalização) é do fornecedor, não de cliente: exige só autenticação.

type Contexto = { params: Promise<{ id: string }> }

const NAO_ENCONTRADO = 'CO não encontrado'

/** Autentica e acha o registro (401 → 404). */
async function carregar(request: NextRequest, id: string) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado

  const co = await prisma.contratoOperacionalizacao.findUnique({
    where: { id },
    select: { id: true, dataInicio: true, dataFim: true },
  })
  if (!co) return { erro: NextResponse.json({ error: NAO_ENCONTRADO }, { status: 404 }) }
  return { co }
}

export async function PATCH(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregar(request, id)
  if ('erro' in carregado) return carregado.erro

  const corpo = await lerCorpo(request, esquemaCo, ROTULOS_CO)
  if ('erro' in corpo) return corpo.erro

  // PATCH parcial: a data que não veio no corpo é a que já está gravada.
  const { dataInicio, dataFim } = corpo.dados
  const inicio = dataInicio === undefined ? carregado.co.dataInicio : dataInicio
  const fim = dataFim === undefined ? carregado.co.dataFim : dataFim
  if (vigenciaInvalida(inicio, fim)) return NextResponse.json({ error: ERRO_VIGENCIA }, { status: 400 })

  try {
    const co = await prisma.contratoOperacionalizacao.update({ where: { id }, data: corpo.dados, select: SELECT_CO })
    return NextResponse.json(serializarCo(co))
  } catch (erro) {
    return respostaErroPrisma(erro, NAO_ENCONTRADO)
  }
}

export async function DELETE(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregar(request, id)
  if ('erro' in carregado) return carregado.erro

  // A FK do termo é SET NULL: excluir o CO soltaria os termos em silêncio. Bloqueia.
  const termos = await prisma.termoConfirmacao.count({ where: { contratoOperacionalizacaoId: id } })
  if (termos > 0) {
    return NextResponse.json(
      { error: `Não é possível excluir: há ${termos} termo(s) de confirmação ligado(s) a este CO.` },
      { status: 409 }
    )
  }

  try {
    await prisma.contratoOperacionalizacao.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (erro) {
    return respostaErroPrisma(erro, NAO_ENCONTRADO)
  }
}
