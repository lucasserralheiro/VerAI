import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUpload } from '@/lib/storage'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { contratoForaDoCliente } from '@/app/api/contratos/carregar'
import { SELECT_ARQUIVO, serializarArquivo, usosDosArquivos } from '@/lib/arquivos/servico'
import { ROTULOS_ARQUIVO, esquemaEdicao } from '@/app/api/clientes/[clienteId]/arquivos/esquema'
import { carregarArquivoComAcesso } from '../carregar'

type Contexto = { params: Promise<{ id: string }> }

/** Única porta de saída do conteúdo de um arquivo do repositório: a URL do Blob nunca vai pro
 *  navegador. `?modo=inline` é a pré-visualização do painel. */
export async function GET(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarArquivoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro
  const { usuario, arquivo } = carregado

  const inline = request.nextUrl.searchParams.get('modo') === 'inline'

  let conteudo: Buffer
  try {
    conteudo = await getUpload(arquivo.urlBlob)
  } catch (erro) {
    console.error('[arquivos] falha ao ler arquivo do storage', erro)
    return NextResponse.json(
      { error: 'não foi possível ler o arquivo agora — tente de novo' },
      { status: 502 }
    )
  }

  await prisma.acessoArquivo.create({
    data: { arquivoId: arquivo.id, usuarioId: usuario.id, acao: inline ? 'visualizou' : 'baixou' },
  })

  return new NextResponse(new Uint8Array(conteudo), {
    headers: {
      'Content-Type': arquivo.contentType,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`,
    },
  })
}

export async function PATCH(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarArquivoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const corpo = await lerCorpo(request, esquemaEdicao, ROTULOS_ARQUIVO)
  if ('erro' in corpo) return corpo.erro

  if (corpo.dados.contratoId) {
    const contratoInvalido = await contratoForaDoCliente(corpo.dados.contratoId, carregado.arquivo.clienteId)
    if (contratoInvalido) return contratoInvalido
  }

  // Só o que veio no corpo (undefined = não mexe). `textoOpcional` já trocou '' por null.
  const data = Object.fromEntries(Object.entries(corpo.dados).filter(([, valor]) => valor !== undefined))
  const arquivo = await prisma.arquivoCliente.update({ where: { id }, data, select: SELECT_ARQUIVO })
  const usos = await usosDosArquivos([id])
  return NextResponse.json(serializarArquivo(arquivo, usos.get(id) ?? []))
}

/** Remoção lógica, e só quando nada usa o arquivo (spec §3.4 regra 2). O blob fica. */
export async function DELETE(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarArquivoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const usos = (await usosDosArquivos([id])).get(id) ?? []
  if (usos.length > 0) return NextResponse.json({ error: 'arquivo em uso', usos }, { status: 409 })

  await prisma.arquivoCliente.update({ where: { id }, data: { removidoEm: new Date() } })
  return NextResponse.json({ ok: true })
}
