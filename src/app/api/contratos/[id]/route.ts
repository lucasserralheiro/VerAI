import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { chaveExata, vincularItensDoContrato } from '@/lib/relatorios-clientes/vincular-itens'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { CONTRATO_NAO_ENCONTRADO, carregarContratoComAcesso, gravarLinkSeiDoCliente, numeroTermoRepetido } from '../carregar'
import {
  ROTULOS_CONTRATO,
  SELECT_CONTRATO,
  SELECT_HISTORICO,
  SELECT_ITEM,
  esquemaContrato,
  serializarContrato,
  serializarHistorico,
  serializarItem,
} from '../esquema'

type Contexto = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarContratoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const [contrato, historico, itens] = await Promise.all([
    prisma.contrato.findUnique({ where: { id }, select: SELECT_CONTRATO }),
    prisma.historicoContrato.findMany({
      where: { contratoId: id },
      orderBy: [{ data: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      select: SELECT_HISTORICO,
    }),
    prisma.itemContrato.findMany({ where: { contratoId: id }, orderBy: { createdAt: 'asc' }, select: SELECT_ITEM }),
  ])
  if (!contrato) return NextResponse.json({ error: CONTRATO_NAO_ENCONTRADO }, { status: 404 })
  const hoje = new Date()
  const consolidado = (await consolidarContratos([contrato], hoje)).get(id)!

  return NextResponse.json({
    ...serializarContrato(contrato, consolidado.saldo, hoje, consolidado),
    historico: historico.map(serializarHistorico),
    itens: itens.map(serializarItem),
  })
}

export async function PATCH(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarContratoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const corpo = await lerCorpo(request, esquemaContrato, ROTULOS_CONTRATO)
  if ('erro' in corpo) return corpo.erro

  // Só confere quando o número MUDA: contrato que já nasceu repetido no legado continua editável.
  const atual = await prisma.contrato.findUnique({ where: { id }, select: { numeroTermo: true } })
  if (chaveExata(atual?.numeroTermo) !== chaveExata(corpo.dados.numeroTermo)) {
    const repetido = await numeroTermoRepetido(carregado.contrato.clienteId, corpo.dados.numeroTermo, id)
    if (repetido) return repetido
  }

  try {
    const contrato = await prisma.contrato.update({ where: { id }, data: corpo.dados, select: SELECT_CONTRATO })
    await gravarLinkSeiDoCliente(contrato.seiCliente, corpo.dados.linkSei)
    // Nº do termo pode ter mudado: religa os itens órfãos que passam a casar.
    await vincularItensDoContrato(prisma, id)
    const hoje = new Date()
    const consolidado = (await consolidarContratos([contrato], hoje)).get(id)!
    return NextResponse.json(serializarContrato(contrato, consolidado.saldo, hoje, consolidado))
  } catch (erro) {
    return respostaErroPrisma(erro, CONTRATO_NAO_ENCONTRADO)
  }
}

export async function DELETE(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarContratoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  // Item e termo de confirmação têm FK opcional (ON DELETE SET NULL): excluir o contrato os soltaria
  // em silêncio — o valor dos itens sumiria e o termo perderia o contrato. Bloqueia como histórico e
  // faturamento.
  const [itens, termos] = await Promise.all([
    prisma.itemContrato.count({ where: { contratoId: id } }),
    prisma.termoConfirmacao.count({ where: { contratoId: id } }),
  ])
  if (itens > 0 || termos > 0) {
    const partes = [
      itens > 0 && `${itens} ${itens === 1 ? 'item' : 'itens'}`,
      termos > 0 && `${termos} ${termos === 1 ? 'termo de confirmação' : 'termos de confirmação'}`,
    ].filter(Boolean)
    return NextResponse.json(
      { error: `Não é possível excluir: há ${partes.join(' e ')} vinculado(s) a este contrato.` },
      { status: 409 }
    )
  }

  try {
    await prisma.contrato.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (erro) {
    // P2025: sumiu entre a leitura e a escrita → 404. P2003: FK travada por histórico ou
    // faturamento (relação obrigatória, sem cascade) → 409 com mensagem específica, em vez do
    // "registro relacionado não existe" genérico de `respostaErroPrisma` (pensado pra create/update).
    if (erro instanceof Prisma.PrismaClientKnownRequestError) {
      if (erro.code === 'P2025') return NextResponse.json({ error: CONTRATO_NAO_ENCONTRADO }, { status: 404 })
      if (erro.code === 'P2003') {
        return NextResponse.json(
          { error: 'Não é possível excluir: há histórico ou faturamento vinculado a este contrato.' },
          { status: 409 }
        )
      }
    }
    throw erro
  }
}
