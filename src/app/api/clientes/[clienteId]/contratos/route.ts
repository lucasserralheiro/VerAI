import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { saldosDosContratos } from '@/lib/relatorios-clientes/saldos-contratos'
import { calcularSaldo } from '@/lib/relatorios-clientes/saldo'
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
  const saldos = await saldosDosContratos(contratos.map((contrato) => contrato.id))
  const hoje = new Date()
  return NextResponse.json(contratos.map((contrato) => serializarContrato(contrato, saldos.get(contrato.id)!, hoje)))
}

export async function POST(request: NextRequest, { params }: Contexto) {
  const { clienteId } = await params
  const acesso = await exigirAcessoCliente(request, clienteId)
  if ('erro' in acesso) return acesso.erro
  if (!(await clienteExiste(clienteId))) return clienteNaoEncontrado()

  const corpo = await lerCorpo(request, esquemaContrato, ROTULOS_CONTRATO)
  if ('erro' in corpo) return corpo.erro

  const contrato = await prisma.contrato.create({ data: { clienteId, ...corpo.dados }, select: SELECT_CONTRATO })
  // Contrato recém-criado não tem item nem nota fiscal.
  return NextResponse.json(serializarContrato(contrato, calcularSaldo({ valorItens: null, faturado: null })), {
    status: 201,
  })
}
