import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { PREFIXO_TEMPORARIO, TAMANHO_MAXIMO_ARQUIVO_BYTES } from '@/lib/arquivos/caminhos'

/**
 * Token pro NAVEGADOR subir um arquivo do repositório direto pro Vercel Blob, sem passar pelo corpo
 * de nenhuma requisição do VerAI (função serverless recusa corpo acima de 4,5 MB). Mesmo padrão de
 * /api/propostas-comerciais/upload-token. O arquivo cai num caminho TEMPORÁRIO; quem registra no
 * repositório (e copia pro caminho final) é POST /api/clientes/[clienteId]/arquivos.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const body = (await request.json()) as HandleUploadBody
  try {
    const resposta = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(PREFIXO_TEMPORARIO)) throw new Error('caminho de upload inválido')
        return {
          // Qualquer tipo de arquivo entra no repositório; o content type de verdade é decidido no
          // registro, pela extensão.
          allowedContentTypes: ['application/*', 'text/*', 'image/*'],
          addRandomSuffix: true,
          maximumSizeInBytes: TAMANHO_MAXIMO_ARQUIVO_BYTES,
          // Só limita quanto tempo ESTE TOKEN vale pro navegador subir o arquivo — não apaga o
          // blob. Um upload que nunca é registrado (usuário fechou a aba, POST falhou) fica em
          // `tmp-arquivos/` pra sempre; o Vercel Blob não expira nada sozinho. Falta um job de
          // limpeza periódica desse prefixo (pendente — a ser tratado no próximo plano).
          validUntil: Date.now() + 60 * 60 * 1000,
        }
      },
    })
    return NextResponse.json(resposta)
  } catch (erro) {
    return NextResponse.json({ error: erro instanceof Error ? erro.message : String(erro) }, { status: 400 })
  }
}
