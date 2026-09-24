import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { consolidarContrato, consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { calcularSaldo } from '@/lib/relatorios-clientes/saldo'
import { vincularItensDoContrato } from '@/lib/relatorios-clientes/vincular-itens'
import { gravarLinkSeiDoCliente, numeroTermoRepetido } from '@/app/api/contratos/carregar'
import { ROTULOS_CONTRATO, SELECT_CONTRATO, esquemaContrato, serializarContrato } from '@/app/api/contratos/esquema'

type Contexto = { params: Promise<{ clienteId: string }> }

async function clienteExiste(clienteId: string) {
  return (await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } })) !== null
}

function clienteNaoEncontrado() {
  return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
}

export async function GET(request: NextRequest, { params }: Contexto) {
  const { clienteId } = await params
  const acesso = await exigirAcessoCliente(request, clienteId)
  if ('erro' in acesso) return acesso.erro
  if (!(await clienteExiste(clienteId))) return clienteNaoEncontrado()

  const contratos = await prisma.contrato.findMany({
    where: { clienteId },
    orderBy: [{ dataVencimento: { sort: 'asc', nulls: 'last' } }, { numeroTermo: 'asc' }],
    select: SELECT_CONTRATO,
  })
  // Regra única (vigência efetiva, ativo, valor e saldo) — a mesma da ficha, dos relatórios e do detalhe.
  const hoje = new Date()
  const consolidados = await consolidarContratos(contratos, hoje)
  return NextResponse.json(
    contratos.map((contrato) => {
      const consolidado = consolidados.get(contrato.id)!
      return {
        ...serializarContrato(contrato, consolidado.saldo, hoje, consolidado),
        resumoHistorico: consolidado.resumoHistorico,
      }
    })
  )
}

export async function POST(request: NextRequest, { params }: Contexto) {
  const { clienteId } = await params
  const acesso = await exigirAcessoCliente(request, clienteId)
  if ('erro' in acesso) return acesso.erro
  if (!(await clienteExiste(clienteId))) return clienteNaoEncontrado()

  const corpo = await lerCorpo(request, esquemaContrato, ROTULOS_CONTRATO)
  if ('erro' in corpo) return corpo.erro

  const repetido = await numeroTermoRepetido(clienteId, corpo.dados.numeroTermo)
  if (repetido) return repetido

  const contrato = await prisma.contrato.create({ data: { clienteId, ...corpo.dados }, select: SELECT_CONTRATO })
  await gravarLinkSeiDoCliente(contrato.seiCliente, corpo.dados.linkSei)
  // Itens órfãos do legado que citam este termo passam a valer já na criação.
  await vincularItensDoContrato(prisma, contrato.id)
  // Contrato recém-criado não tem nota fiscal; o saldo é recalculado na próxima leitura.
  const hoje = new Date()
  const consolidado = consolidarContrato(contrato, [], calcularSaldo({ valorItens: null, faturado: null }), hoje)
  return NextResponse.json(serializarContrato(contrato, consolidado.saldo, hoje, consolidado), { status: 201 })
}
