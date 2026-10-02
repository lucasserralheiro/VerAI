import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { SELECT_ARQUIVO, registrarArquivo, serializarArquivo, usosDosArquivos } from '@/lib/arquivos/servico'
import { ROTULOS_ARQUIVO, esquemaRegistro } from './esquema'

// Registro baixa o temporário e sobe pro caminho final servidor a servidor (até 50 MB) — mais que
// os 10s padrão de uma função serverless em conexão lenta.
export const maxDuration = 60

type Contexto = { params: Promise<{ clienteId: string }> }

async function clienteExiste(clienteId: string) {
  return (await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } })) !== null
}

const clienteNaoEncontrado = () => NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

/** Repositório do cliente: todos os arquivos não removidos (a tela filtra), com onde cada um é usado. */
export async function GET(request: NextRequest, { params }: Contexto) {
  const { clienteId } = await params
  const acesso = await exigirAcessoCliente(request, clienteId)
  if ('erro' in acesso) return acesso.erro
  if (!(await clienteExiste(clienteId))) return clienteNaoEncontrado()

  const where = { clienteId, removidoEm: null }
  const [arquivos, agregado] = await Promise.all([
    prisma.arquivoCliente.findMany({ where, orderBy: { createdAt: 'desc' }, select: SELECT_ARQUIVO }),
    prisma.arquivoCliente.aggregate({ where, _count: { _all: true }, _sum: { tamanhoBytes: true } }),
  ])
  const usos = await usosDosArquivos(arquivos.map((a) => a.id))

  return NextResponse.json({
    arquivos: arquivos.map((a) => serializarArquivo(a, usos.get(a.id) ?? [])),
    resumo: { total: agregado._count._all, bytes: agregado._sum.tamanhoBytes ?? 0 },
  })
}

export async function POST(request: NextRequest, { params }: Contexto) {
  const { clienteId } = await params
  const acesso = await exigirAcessoCliente(request, clienteId, 'editar')
  if ('erro' in acesso) return acesso.erro
  if (!(await clienteExiste(clienteId))) return clienteNaoEncontrado()

  const corpo = await lerCorpo(request, esquemaRegistro, ROTULOS_ARQUIVO)
  if ('erro' in corpo) return corpo.erro
  const dados = corpo.dados

  let arquivo, duplicado
  try {
    ;({ arquivo, duplicado } = await registrarArquivo({
      clienteId,
      urlTemporaria: dados.urlTemporaria,
      nome: dados.nome,
      categoria: dados.categoria,
      enviadoPorId: acesso.usuario.id,
    }))
  } catch (erro) {
    console.error('[arquivos] falha ao registrar arquivo', erro)
    return NextResponse.json(
      { error: 'não foi possível ler o arquivo enviado — envie de novo' },
      { status: 502 }
    )
  }
  const usos = await usosDosArquivos([arquivo.id])
  return NextResponse.json(
    { arquivo: serializarArquivo(arquivo, usos.get(arquivo.id) ?? []), duplicado },
    { status: duplicado ? 200 : 201 }
  )
}
