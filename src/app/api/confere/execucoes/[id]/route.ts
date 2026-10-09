import { NextRequest, NextResponse } from 'next/server'

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteUpload } from '@/lib/storage'
import { podeVerCliente } from '@/lib/visibilidade'

/** Uma execução do histórico, com o resultado guardado — é o que alimenta
 *  `/confere/historico/[id]`, que reabre o mesmo grid da tela de geração.
 *
 *  `resultado` vem `null` nas execuções gravadas antes da migração
 *  `20260921190000`: a página trata esse caso mostrando os downloads e
 *  dizendo que o detalhamento não foi guardado. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const execucao = await prisma.confereExecucao.findUnique({
    where: { id },
    select: {
      id: true,
      nomeContrato: true,
      nomeLevantamento: true,
      nomesAditivos: true,
      resultado: true,
      createdAt: true,
      contratoId: true,
      arquivosEntrada: true,
    },
  })
  if (!execucao) {
    return NextResponse.json({ error: 'execução não encontrada' }, { status: 404 })
  }

  const { contratoId, arquivosEntrada, ...dados } = execucao
  const guardadas = Array.isArray(arquivosEntrada) ? (arquivosEntrada as { papel: string; nome: string }[]) : []
  const posicaoDaPlanilha = guardadas.findIndex((entrada) => entrada.papel === 'levantamento')
  return NextResponse.json({
    ...dados,
    planilha:
      posicaoDaPlanilha >= 0
        ? { rotulo: guardadas[posicaoDaPlanilha].nome, url: `/api/confere/execucoes/${id}/entrada/${posicaoDaPlanilha}` }
        : undefined,
    fontes: await fontesDoContrato(usuario, id, contratoId, arquivosEntrada, execucao),
  })
}

/** Os PDFs de entrada que dá para abrir no histórico, na ordem de aplicação
 *  (proposta-base e depois os aditivos).
 *
 *  Execuções novas guardam os PDFs (`arquivosEntrada`) e servem por
 *  `/entrada/<n>`. As anteriores não têm isso: para elas, tenta achar no repositório
 *  do cliente do contrato o arquivo de **mesmo nome** (o mais recente, sem os
 *  removidos). O que veio do computador e não foi guardado fica de fora — sem fonte,
 *  a tela não torna a linha clicável. */
async function fontesDoContrato(
  usuario: Awaited<ReturnType<typeof getAuthUser>> & object,
  id: string,
  contratoId: string | null,
  arquivosEntrada: unknown,
  execucao: { nomeContrato: string; nomesAditivos: unknown }
): Promise<{ rotulo: string; url: string }[]> {
  const guardadas = Array.isArray(arquivosEntrada) ? (arquivosEntrada as { papel: string; nome: string }[]) : []
  if (guardadas.length > 0) {
    let aditivo = 0
    return guardadas.flatMap((entrada, posicao) =>
      entrada.papel === 'levantamento'
        ? []
        : [
            {
              rotulo: `${entrada.papel === 'contrato' ? 'Contrato' : `Aditivo ${++aditivo}`} · ${entrada.nome}`,
              url: `/api/confere/execucoes/${id}/entrada/${posicao}`,
            },
          ]
    )
  }

  if (!contratoId) return []
  const contrato = await prisma.contrato.findUnique({ where: { id: contratoId }, select: { clienteId: true } })
  if (!contrato || !(await podeVerCliente(usuario, contrato.clienteId))) return []

  const aditivos = Array.isArray(execucao.nomesAditivos) ? (execucao.nomesAditivos as string[]) : []
  const nomes = [execucao.nomeContrato, ...aditivos]
  const arquivos = await prisma.arquivoCliente.findMany({
    where: { clienteId: contrato.clienteId, removidoEm: null, nome: { in: nomes } },
    select: { id: true, nome: true },
    orderBy: { createdAt: 'desc' },
  })

  const fontes: { rotulo: string; url: string }[] = []
  nomes.forEach((nome, posicao) => {
    const arquivo = arquivos.find((a) => a.nome === nome)
    if (!arquivo) return
    fontes.push({
      rotulo: `${posicao === 0 ? 'Contrato' : `Aditivo ${posicao}`} · ${nome}`,
      url: `/api/arquivos/${arquivo.id}?modo=inline`,
    })
  })
  return fontes
}

/** Apaga a linha do histórico e os dois documentos que ela guardava.
 *
 *  Os blobs saem ANTES da linha: apagar a linha primeiro deixaria os dois
 *  arquivos órfãos no bucket, sem nada no banco apontando pra eles. Cada
 *  remoção é best-effort — um blob que já não existe não pode impedir a
 *  limpeza do registro.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const execucao = await prisma.confereExecucao.findUnique({ where: { id } })
  if (!execucao) {
    return NextResponse.json({ error: 'execução não encontrada' }, { status: 404 })
  }

  const entradas = Array.isArray(execucao.arquivosEntrada)
    ? (execucao.arquivosEntrada as { caminho: string }[])
    : []
  await Promise.all([
    deleteUpload(execucao.caminhoDocx).catch(() => {}),
    deleteUpload(execucao.caminhoXlsx).catch(() => {}),
    ...entradas.map((entrada) => deleteUpload(entrada.caminho).catch(() => {})),
  ])
  await prisma.confereExecucao.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
