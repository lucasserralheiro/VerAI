import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'

/**
 * Gera o token que deixa o NAVEGADOR subir o arquivo direto pro Vercel Blob,
 * sem passar pelo corpo desta (ou de qualquer outra) requisição — existe
 * porque uma função serverless da Vercel rejeita (413 FUNCTION_PAYLOAD_TOO_LARGE)
 * qualquer corpo de requisição acima de 4,5 MB, e PDF de proposta real passa
 * disso com frequência (caso real: 413 num PDF de ~6 MB).
 *
 * O arquivo sobe pra um caminho TEMPORÁRIO — quem grava no caminho final e
 * roda a conversão é `POST /api/propostas-comerciais`, buscando o conteúdo
 * daqui pelo servidor (sem limite de corpo de requisição, é uma chamada
 * servidor-a-servidor) e apagando o temporário depois. Ver o comentário lá.
 *
 * Aceita qualquer arquivo autenticado apontando pra este endpoint — a
 * validação de TIPO de arquivo (PDF/Excel/Word) continua só em
 * `POST /api/propostas-comerciais`, pelo nome; aqui só limita tamanho, pra
 * não virar um upload público sem controle nenhum.
 */
const TAMANHO_MAXIMO_BYTES = 50 * 1024 * 1024 // 50 MB — bem acima do que qualquer proposta real usa hoje

export async function POST(request: NextRequest): Promise<NextResponse> {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        // Content-type de PDF/Excel/Word varia por navegador e SO (ex.:
        // .csv às vezes vem como text/csv, às vezes application/vnd.ms-excel)
        // — deixa passar e confia na validação por extensão que já existe em
        // `POST /api/propostas-comerciais`, em vez de arriscar rejeitar
        // upload válido por mimetype divergente.
        allowedContentTypes: ['application/*', 'text/*'],
        addRandomSuffix: true,
        maximumSizeInBytes: TAMANHO_MAXIMO_BYTES,
        // Some do bucket sozinho se ninguém completar o registro da proposta
        // (aba fechada no meio do upload, por exemplo) — não fica lixo preso
        // pra sempre no caminho temporário.
        validUntil: Date.now() + 60 * 60 * 1000, // 1h
      }),
    })
    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
  }
}
