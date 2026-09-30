import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { ehEnderecoDeEnvio } from '@/lib/propostas/envio'
import { chaveDoTemporario, lerDoR2 } from '@/lib/reajuste/arquivos'
import { lerArquivo } from '@/lib/reajuste/leitura'
import { ArquivoIlegivel, type TipoArquivoReajuste } from '@/lib/reajuste/tipos'

export const maxDuration = 60

/** Onde estão os valores do arquivo recém-enviado (spec §2.2 passo 3). Só lê o temporário do envio. */
export async function POST(request: NextRequest) {
  if (!(await getAuthUser(request))) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const corpo = (await request.json().catch(() => null)) as { endereco?: unknown } | null
  const endereco = typeof corpo?.endereco === 'string' ? corpo.endereco : ''
  if (!ehEnderecoDeEnvio(endereco)) return NextResponse.json({ error: 'arquivo inválido' }, { status: 400 })
  const tipo = endereco.split('.').pop() as TipoArquivoReajuste
  try {
    return NextResponse.json(await lerArquivo(await lerDoR2(chaveDoTemporario(endereco)), tipo))
  } catch (erro) {
    if (erro instanceof ArquivoIlegivel) return NextResponse.json({ error: erro.message }, { status: 422 })
    throw erro
  }
}
