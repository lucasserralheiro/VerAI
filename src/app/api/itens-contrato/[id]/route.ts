import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { AuthUser } from '@/lib/auth'
import { exigirUsuario, verificarAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { podeVerItensSemContrato } from '@/app/api/contratos/carregar'
import {
  ERRO_VALOR_TOTAL,
  ROTULOS_ITEM,
  SELECT_ITEM,
  esquemaEdicaoItem,
  serializarItem,
  valorTotalDoItem,
} from '@/app/api/contratos/esquema'

type Contexto = { params: Promise<{ id: string }> }

const NAO_ENCONTRADO = 'item não encontrado'

async function negarSemAcesso(usuario: AuthUser, clienteId: string | undefined) {
  if (clienteId) return verificarAcessoCliente(usuario, clienteId)
  return (await podeVerItensSemContrato(usuario))
    ? null
    : NextResponse.json({ error: 'acesso negado' }, { status: 403 })
}

/** Autentica, acha o item e checa acesso (401 → 404 → 403): pelo cliente do contrato dele, ou —
 *  item importado sem contrato — pela regra de `podeVerItensSemContrato`. */
async function carregarComAcesso(request: NextRequest, id: string) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado

  const item = await prisma.itemContrato.findUnique({
    where: { id },
    select: {
      id: true,
      quantidade: true,
      valorUnitario: true,
      valorTotal: true,
      clienteSiglaLegado: true,
      contrato: { select: { clienteId: true } },
    },
  })
  if (!item) return { erro: NextResponse.json({ error: NAO_ENCONTRADO }, { status: 404 }) }

  const negado = await negarSemAcesso(autenticado.usuario, item.contrato?.clienteId)
  return negado ? { erro: negado } : { usuario: autenticado.usuario, item }
}

export async function PATCH(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro
  const { usuario, item } = carregado

  const corpo = await lerCorpo(request, esquemaEdicaoItem, ROTULOS_ITEM)
  if ('erro' in corpo) return corpo.erro
  const { valorTotal: valorTotalInformado, ...dados } = corpo.dados

  // Vincular a um contrato: ele tem que existir e o usuário tem que ver o cliente dele.
  if (dados.contratoId) {
    const destino = await prisma.contrato.findUnique({
      where: { id: dados.contratoId },
      select: { clienteId: true, cliente: { select: { siglaLegado: true } } },
    })
    if (!destino) return NextResponse.json({ error: 'Contrato: não encontrado' }, { status: 400 })
    const negado = await verificarAcessoCliente(usuario, destino.clienteId)
    if (negado) return negado
    // Item do legado traz a sigla do cliente dono: nunca vai pro contrato de OUTRO cliente — a mesma
    // regra do vínculo automático (vincular-itens.ts), agora também no vínculo manual.
    const siglaDoItem = item.clienteSiglaLegado?.trim().toUpperCase()
    const siglaDoDestino = destino.cliente?.siglaLegado?.trim().toUpperCase()
    if (siglaDoItem && destino.cliente && siglaDoItem !== siglaDoDestino) {
      return NextResponse.json(
        { error: `Contrato: este item é do cliente ${siglaDoItem} no legado — não pode ir para contrato de outro cliente` },
        { status: 400 }
      )
    }
  }

  // valorTotal é obrigatório na coluna: não pode ser apagado; mudou quantidade/valor unitário sem
  // mandar o total → recalcula com o que já está gravado.
  if (valorTotalInformado === null) return NextResponse.json({ error: ERRO_VALOR_TOTAL }, { status: 400 })
  let valorTotal = valorTotalInformado
  // O formulário da tela reenvia o total que já estava gravado junto com a quantidade/unitário
  // novos: total igual ao gravado não é "total informado", é o antigo — recalcula.
  const mudouQuantidadeOuUnitario = dados.quantidade !== undefined || dados.valorUnitario !== undefined
  if (
    valorTotal !== undefined &&
    mudouQuantidadeOuUnitario &&
    item.valorTotal !== undefined &&
    new Prisma.Decimal(valorTotal).equals(item.valorTotal)
  ) {
    valorTotal = undefined
  }
  if (valorTotal === undefined && mudouQuantidadeOuUnitario) {
    valorTotal =
      valorTotalDoItem({
        quantidade: dados.quantidade === undefined ? item.quantidade?.toString() : dados.quantidade,
        valorUnitario: dados.valorUnitario === undefined ? item.valorUnitario?.toString() : dados.valorUnitario,
      }) ?? undefined
  }

  try {
    const atualizado = await prisma.itemContrato.update({
      where: { id },
      data: valorTotal === undefined ? dados : { ...dados, valorTotal },
      select: SELECT_ITEM,
    })
    return NextResponse.json(serializarItem(atualizado))
  } catch (erro) {
    return respostaErroPrisma(erro, NAO_ENCONTRADO)
  }
}

export async function DELETE(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  try {
    await prisma.itemContrato.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (erro) {
    return respostaErroPrisma(erro, NAO_ENCONTRADO)
  }
}
