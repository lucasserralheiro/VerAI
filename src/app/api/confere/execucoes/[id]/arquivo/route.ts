import { NextRequest, NextResponse } from 'next/server'

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUpload } from '@/lib/storage'

const TIPOS = {
  docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    prefixo: 'confere',
    extensao: 'docx',
  },
  xlsx: {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    prefixo: 'confere-analise',
    extensao: 'xlsx',
  },
} as const

type Tipo = keyof typeof TIPOS

/** `R-ACE-19` do Confere, aplicada ao histórico: o nome do arquivo baixado
 *  distingue as competências na pasta de Downloads. Aqui a base é o nome do
 *  contrato submetido (sem extensão), higienizado porque vai para nome de
 *  arquivo. */
function nomeDoArquivo(nomeContrato: string, tipo: Tipo): string {
  const { prefixo, extensao } = TIPOS[tipo]
  const base = nomeContrato
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${[prefixo, base].filter(Boolean).join('-')}.${extensao}`
}

/**
 * Baixa um dos dois documentos guardados por uma execução do histórico.
 *
 * O blob é servido por aqui, e não por redirecionamento pra URL pública: é o
 * que permite exigir sessão e devolver o `Content-Disposition` com o nome
 * certo — o caminho no storage é posicional (`relatorio.docx`), e sem o
 * cabeçalho toda execução baixaria com o mesmo nome.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const tipo = request.nextUrl.searchParams.get('tipo')
  if (tipo !== 'docx' && tipo !== 'xlsx') {
    return NextResponse.json({ error: 'tipo deve ser docx ou xlsx' }, { status: 400 })
  }

  const { id } = await params
  const execucao = await prisma.confereExecucao.findUnique({ where: { id } })
  if (!execucao) {
    return NextResponse.json({ error: 'execução não encontrada' }, { status: 404 })
  }

  const url = tipo === 'docx' ? execucao.caminhoDocx : execucao.caminhoXlsx
  let arquivo: Buffer
  try {
    arquivo = await getUpload(url)
  } catch {
    return NextResponse.json({ error: 'arquivo não está mais disponível no storage' }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(arquivo), {
    headers: {
      'Content-Type': TIPOS[tipo].mime,
      'Content-Disposition': `attachment; filename="${nomeDoArquivo(execucao.nomeContrato, tipo)}"`,
      'Content-Length': String(arquivo.length),
    },
  })
}
