import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { contratoForaDoCliente } from '@/app/api/contratos/carregar'
import { SELECT_ARQUIVO, serializarArquivo, usosDosArquivos } from '@/lib/arquivos/servico'
import { ROTULOS_ARQUIVO, esquemaEdicao } from '@/app/api/clientes/[clienteId]/arquivos/esquema'
import { carregarArquivoComAcesso } from '../carregar'

type Contexto = { params: Promise<{ id: string }> }

/** Nome sem acento e só com ASCII imprimível, pro fallback `filename=` do Content-Disposition
 *  (navegador velho que não lê `filename*=UTF-8''...`). */
function nomeAsciiFallback(nome: string): string {
  const semAcento = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return semAcento.replace(/[^\x20-\x7e]|["\\]/g, '_')
}

/** Única porta de saída do conteúdo de um arquivo do repositório: a URL do Blob nunca vai pro
 *  navegador. `?modo=inline` é a pré-visualização do painel.
 *
 *  Sempre por streaming (`res.body` direto pro `NextResponse`) — nunca carregar o arquivo inteiro
 *  num Buffer: Vercel Functions limita corpo de resposta NÃO-streamed a 4,5 MB, e o repositório
 *  aceita até 50 MB. */
export async function GET(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarArquivoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro
  const { usuario, arquivo } = carregado

  const inline = request.nextUrl.searchParams.get('modo') === 'inline'

  const res = await fetch(arquivo.urlBlob).catch(() => null)
  if (!res?.ok || !res.body) {
    console.error(
      '[arquivos] falha ao ler arquivo do storage',
      res ? new Error(`storage respondeu ${res.status}`) : new Error('falha ao contatar o storage')
    )
    return NextResponse.json(
      { error: 'não foi possível ler o arquivo agora — tente de novo' },
      { status: 502 }
    )
  }

  await prisma.acessoArquivo.create({
    data: { arquivoId: arquivo.id, usuarioId: usuario.id, acao: inline ? 'visualizou' : 'baixou' },
  })

  const headers = new Headers({
    'Content-Type': arquivo.contentType,
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${nomeAsciiFallback(arquivo.nome)}"; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`,
    'X-Content-Type-Options': 'nosniff',
  })
  const tamanho = res.headers.get('content-length')
  if (tamanho) headers.set('Content-Length', tamanho)

  return new NextResponse(res.body, { headers })
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
