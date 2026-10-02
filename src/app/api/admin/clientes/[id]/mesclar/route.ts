import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { exigirAdmin } from '@/lib/relatorios-clientes/acesso'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await exigirAdmin(request)
  if ('erro' in admin) return admin.erro
  const { id } = await params
  const body = await request.json().catch(() => null)
  const destinoClienteId = body?.destinoClienteId

  if (typeof destinoClienteId !== 'string' || !destinoClienteId) {
    return NextResponse.json({ error: '"destinoClienteId" é obrigatório' }, { status: 400 })
  }
  if (destinoClienteId === id) {
    return NextResponse.json({ error: 'cliente de origem e destino não podem ser o mesmo' }, { status: 400 })
  }

  const [origem, destino] = await Promise.all([
    prisma.cliente.findUnique({
      where: { id },
      select: { id: true, siglaLegado: true, usuariosPermitidos: { select: { id: true } } },
    }),
    prisma.cliente.findUnique({ where: { id: destinoClienteId }, select: { id: true, siglaLegado: true } }),
  ])
  if (!origem || !destino) {
    return NextResponse.json({ error: 'cliente de origem ou destino não encontrado' }, { status: 404 })
  }

  // Mesclar leva TUDO que é do cliente (antes só documentos e análises: com contrato, faturamento ou
  // demanda o delete da origem estourava). Quem via a origem passa a ver o destino; a sigla do
  // legado vai junto quando o destino não tem — é ela que liga os itens do GRC-1 que esperam o cliente.
  const mover = { where: { clienteId: id }, data: { clienteId: destinoClienteId } }
  // Carteira: o destino mantém a dele; se não tem, herda a da origem. Os movimentos vão pro destino
  // e a carteira da origem some no Cascade do delete (por isso tudo isso vem antes dele).
  const [carteiraOrigem, carteiraDestino] = await Promise.all([
    prisma.carteiraCliente.findUnique({ where: { clienteId: id } }),
    prisma.carteiraCliente.findUnique({ where: { clienteId: destinoClienteId } }),
  ])
  try {
    await prisma.$transaction([
      prisma.documento.updateMany(mover),
      prisma.analiseConsolidada.updateMany(mover),
      prisma.analiseEvolucao.updateMany(mover),
      prisma.contrato.updateMany(mover),
      prisma.faturamento.updateMany(mover),
      prisma.termoConfirmacao.updateMany(mover),
      prisma.demanda.updateMany(mover),
      prisma.solicitacao.updateMany(mover),
      prisma.responsavelCliente.updateMany(mover),
      prisma.arquivoCliente.updateMany(mover),
      prisma.indiceDocumento.updateMany(mover),
      prisma.trechoDocumento.updateMany(mover),
      prisma.cliente.update({
        where: { id: destinoClienteId },
        data: { usuariosPermitidos: { connect: origem.usuariosPermitidos.map((u) => ({ id: u.id })) } },
      }),
      prisma.movimentoCarteira.updateMany(mover),
      ...(carteiraOrigem && !carteiraDestino
        ? [
            prisma.carteiraCliente.create({
              data: { clienteId: destinoClienteId, gerenciaId: carteiraOrigem.gerenciaId, movidoPorId: admin.usuario.id },
            }),
            // A herança fica no histórico da carteira: sem isso o destino aparece com gerência sem movimento.
            prisma.movimentoCarteira.create({
              data: {
                clienteId: destinoClienteId,
                deGerenciaId: null,
                paraGerenciaId: carteiraOrigem.gerenciaId,
                porId: admin.usuario.id,
              },
            }),
          ]
        : []),
      prisma.cliente.delete({ where: { id } }),
      ...(origem.siglaLegado && !destino.siglaLegado
        ? [prisma.cliente.update({ where: { id: destinoClienteId }, data: { siglaLegado: origem.siglaLegado } })]
        : []),
    ])
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        {
          error:
            'o destino já tem um registro que colide com a origem (análise consolidada/evolução na mesma competência, ou o mesmo arquivo no repositório) — resolva manualmente antes de mesclar',
        },
        { status: 409 }
      )
    }
    throw error
  }

  return NextResponse.json({ ok: true })
}
