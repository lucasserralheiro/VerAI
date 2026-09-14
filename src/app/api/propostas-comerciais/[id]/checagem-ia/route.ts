import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { getUpload } from '@/lib/storage'
import { converterPdfParaMarkdown, type PaginaConvertida } from '@/lib/extracao/pdfMarkdown'
import { checarConversao } from '@/lib/ia/checarConversao'

/** Impressão digital barata do documento auditado — mais barato que guardar
 *  o texto inteiro de novo só pra saber "isto ainda é o que foi checado da
 *  última vez?" (ver `mesmoDocumento`). */
function hashDocumento(texto: string): string {
  return createHash('sha256').update(texto).digest('hex')
}

/**
 * Checagem por IA da conversão — recalcula a conversão determinística de
 * cada PDF da proposta (o mesmo `converterPdfParaMarkdown` do upload) pra ter
 * texto original por página, e manda pro modelo auditar contra o Markdown do
 * DOCUMENTO INTEIRO da proposta — sempre a mesma comparação, tenha ou não
 * edição (ver o comentário no topo de `checarConversao.ts` pra entender por
 * que não existe mais uma versão "mais fraca" pra quando ainda não houve
 * edição nenhuma).
 *
 * Pelo corpo do pedido:
 * - SEM `conteudoMarkdown`: audita contra o Markdown JÁ SALVO da proposta
 *   (`proposta.conteudoMarkdown`) — é o que roda sozinho ao abrir a
 *   proposta. O resultado é reaproveitado (F5 não refaz a análise) enquanto
 *   os PDFs E o documento salvo forem os mesmos da última vez (ver
 *   `mesmoDocumento`); refaz quando qualquer um dos dois mudou, ou o pedido
 *   vem com `?refazer=1`.
 * - COM `conteudoMarkdown`: "Auditar PDF depois das mudanças" no painel —
 *   audita o Markdown de AGORA (pode ter edição ainda não persistida).
 *   Sempre roda na hora (nunca serve do cache).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const proposta = await prisma.propostaComercial.findUnique({
    where: { id },
    include: { arquivos: true },
  })
  if (!proposta) {
    return NextResponse.json({ error: 'proposta comercial não encontrada' }, { status: 404 })
  }

  const arquivosPdf = proposta.arquivos.filter((arquivo) => arquivo.tipo === 'pdf').sort((a, b) => a.ordem - b.ordem)
  const idsPdf = arquivosPdf.map((arquivo) => arquivo.id)
  const refazer = request.nextUrl.searchParams.get('refazer') === '1'

  const corpo = await request.json().catch(() => null)
  const markdownAtual =
    corpo && typeof corpo.conteudoMarkdown === 'string' && corpo.conteudoMarkdown.trim()
      ? (corpo.conteudoMarkdown as string)
      : null
  // Sem `conteudoMarkdown` explícito no corpo, audita contra o que já está
  // salvo na proposta — é o Markdown mais recente que existe pra ela nesse
  // momento (não muda o resultado, muda só CONTRA O QUE a checagem roda).
  const documentoAtual = markdownAtual ?? proposta.conteudoMarkdown ?? ''

  // "Corrigir N automaticamente" já foi usado nesta proposta uma vez — a
  // pessoa pediu pra não oferecer mais o botão em lote depois disso (só
  // grava a marca, não roda IA nenhuma). Fica pra sempre: nada nesta rota
  // desliga de novo.
  if (corpo && corpo.marcarCorrecaoAutomaticaAplicada === true) {
    const salva = lerChecagemSalva(proposta.checagemIa)
    const atualizada: ChecagemSalva = {
      scoreExibido: salva?.scoreExibido ?? null,
      trechosSuspeitos: salva?.trechosSuspeitos ?? [],
      paginasComImagem: salva?.paginasComImagem ?? [],
      arquivosPdf: salva?.arquivosPdf ?? idsPdf,
      documentoHash: salva?.documentoHash,
      correcaoAutomaticaAplicada: true,
    }
    await prisma.propostaComercial.update({
      where: { id },
      data: { checagemIa: atualizada as unknown as Prisma.InputJsonValue },
    })
    return NextResponse.json({
      scoreExibido: atualizada.scoreExibido,
      trechosSuspeitos: atualizada.trechosSuspeitos,
      paginasComImagem: atualizada.paginasComImagem,
      checadoEm: proposta.checagemIaEm?.toISOString() ?? null,
      correcaoAutomaticaAplicada: true,
    })
  }

  // "Auditar PDF depois das mudanças" é sempre sob pedido explícito e sempre
  // sobre o Markdown de AGORA (que pode ainda nem estar salvo) — não faz
  // sentido servir do cache nem checar `refazer`. Sem `conteudoMarkdown`
  // explícito, serve do cache quando PDFs E documento salvo baterem com a
  // última checagem (ver `mesmoDocumento`).
  if (!markdownAtual) {
    const salva = lerChecagemSalva(proposta.checagemIa)
    if (!refazer && salva && mesmoDocumento(salva, idsPdf, documentoAtual)) {
      return NextResponse.json({
        scoreExibido: salva.scoreExibido,
        trechosSuspeitos: salva.trechosSuspeitos,
        paginasComImagem: salva.paginasComImagem,
        checadoEm: proposta.checagemIaEm?.toISOString() ?? null,
        correcaoAutomaticaAplicada: salva.correcaoAutomaticaAplicada ?? false,
      })
    }
  }

  const paginasConvertidas: PaginaConvertida[] = []
  const paginasComImagem: number[] = []
  for (const arquivo of arquivosPdf) {
    const buffer = await getUpload(arquivo.caminhoOriginal)
    const resultado = await converterPdfParaMarkdown(buffer)
    paginasConvertidas.push(...resultado.paginasConvertidas)
    paginasComImagem.push(...resultado.paginasComImagem)
  }

  try {
    const resultado =
      paginasConvertidas.length === 0
        ? { scoreExibido: null, trechosSuspeitos: [] }
        : await checarConversao(paginasConvertidas, documentoAtual)
    const checadoEm = new Date()
    // A marca "correção automática já usada" é sobre a PROPOSTA, não sobre
    // este resultado — uma auditoria nova sobrescreve o JSON inteiro, então
    // sem herdar aqui o flag voltaria pra false e o botão reapareceria.
    const correcaoAutomaticaAplicada = lerChecagemSalva(proposta.checagemIa)?.correcaoAutomaticaAplicada ?? false
    const paraSalvar: ChecagemSalva = {
      ...resultado,
      paginasComImagem,
      arquivosPdf: idsPdf,
      documentoHash: hashDocumento(documentoAtual),
      correcaoAutomaticaAplicada,
    }

    // Falhar ao gravar não pode esconder um resultado que já está pronto —
    // no pior caso, o próximo F5 checa de novo.
    await prisma.propostaComercial
      .update({
        where: { id },
        data: { checagemIa: paraSalvar as unknown as Prisma.InputJsonValue, checagemIaEm: checadoEm },
      })
      .catch((erro) => console.error('checagem por IA: não foi possível salvar o resultado —', erro))

    return NextResponse.json({
      ...resultado,
      paginasComImagem,
      checadoEm: checadoEm.toISOString(),
      correcaoAutomaticaAplicada,
    })
  } catch (erro) {
    console.error('checagem por IA falhou:', erro)
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    return NextResponse.json({ error: `não foi possível checar a conversão agora (${detalhe})` }, { status: 502 })
  }
}

interface ChecagemSalva {
  scoreExibido: number | null
  trechosSuspeitos: unknown[]
  paginasComImagem: number[]
  /** Ids dos PDFs checados — se a proposta ganhar/perder PDF, não vale mais. */
  arquivosPdf: string[]
  /** Hash (`hashDocumento`) do Markdown contra o qual esta checagem rodou —
   *  se `proposta.conteudoMarkdown` mudou desde então (a pessoa editou), o
   *  cache não vale mais, mesmo com os mesmos PDFs (ver `mesmoDocumento`).
   *  Ausente em checagem salva antes desse campo existir — nesse caso não
   *  há como confiar no cache, refaz. */
  documentoHash?: string
  /** true depois que a pessoa usou "Corrigir N automaticamente" pelo menos
   *  uma vez nesta proposta — a partir daí o painel para de oferecer esse
   *  botão em lote (pedido explícito: cada correção segura passa a exigir
   *  clique manual em "Aplicar no documento", uma por uma). Nunca volta a
   *  false sozinho. */
  correcaoAutomaticaAplicada?: boolean
}

/** Lê o JSON salvo com cuidado — coluna pode estar vazia ou num formato
 *  antigo; nesse caso trata como "não checada" e checa de novo. */
function lerChecagemSalva(valor: unknown): ChecagemSalva | null {
  if (!valor || typeof valor !== 'object') return null
  const v = valor as Partial<ChecagemSalva>
  if (!Array.isArray(v.trechosSuspeitos) || !Array.isArray(v.arquivosPdf)) return null
  return {
    scoreExibido: typeof v.scoreExibido === 'number' ? v.scoreExibido : null,
    trechosSuspeitos: v.trechosSuspeitos,
    paginasComImagem: Array.isArray(v.paginasComImagem) ? v.paginasComImagem : [],
    arquivosPdf: v.arquivosPdf.filter((x): x is string => typeof x === 'string'),
    documentoHash: typeof v.documentoHash === 'string' ? v.documentoHash : undefined,
    correcaoAutomaticaAplicada: v.correcaoAutomaticaAplicada === true,
  }
}

/** O cache só vale quando os PDFs continuam os mesmos E o documento contra o
 *  qual a última checagem rodou é EXATAMENTE o que está salvo agora — sem o
 *  segundo critério, editar a proposta e recarregar a página serviria um
 *  resultado desatualizado, calculado antes da edição. */
function mesmoDocumento(salva: ChecagemSalva, idsPdfAtuais: string[], documentoAtual: string): boolean {
  if (salva.arquivosPdf.length !== idsPdfAtuais.length) return false
  const atuaisSet = new Set(idsPdfAtuais)
  if (!salva.arquivosPdf.every((id) => atuaisSet.has(id))) return false
  return salva.documentoHash === hashDocumento(documentoAtual)
}
