import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { PREFIXO_R2, configR2, urlDeEnvioR2 } from '@/lib/r2'
import {
  TAMANHO_MAXIMO_ENVIO,
  TIPOS_DE_ENVIO,
  VALIDADE_DO_LINK_S,
  chaveDeEnvio,
  extensaoDeEnvio,
} from '@/lib/propostas/envio'

/**
 * Link pro NAVEGADOR subir um arquivo da "Nova conversão" direto pro Cloudflare R2 — o binário nunca
 * passa pelo corpo desta (ou de qualquer) requisição nossa, porque a função da Vercel recusa (413)
 * corpo acima de 4,5 MB e PDF de proposta real passa disso. Substitui o token do Vercel Blob, suspenso
 * por cota desde 24/09/2026 (spec docs/superpowers/specs/2026-09-28-envio-proposta-r2-design.md).
 *
 * O link é um PUT pré-assinado que amarra tipo e tamanho, vale 15 min e só grava num caminho
 * TEMPORÁRIO; quem grava o original e converte é `POST /api/propostas-comerciais`, recebendo o
 * `endereco` devolvido aqui.
 */
export async function POST(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const corpo = (await request.json().catch(() => null)) as { nome?: unknown; tamanhoBytes?: unknown } | null
  const nome = typeof corpo?.nome === 'string' ? corpo.nome : ''
  const tamanhoBytes = corpo?.tamanhoBytes

  const extensao = extensaoDeEnvio(nome)
  if (!extensao) {
    return NextResponse.json({ error: 'formato não suportado — envie PDF, Excel (.xlsx/.csv) ou Word (.docx)' }, { status: 400 })
  }
  if (typeof tamanhoBytes !== 'number' || !Number.isInteger(tamanhoBytes) || tamanhoBytes <= 0) {
    return NextResponse.json({ error: 'tamanho do arquivo inválido' }, { status: 400 })
  }
  if (tamanhoBytes > TAMANHO_MAXIMO_ENVIO) {
    return NextResponse.json({ error: `"${nome}" passa de 50 MB` }, { status: 400 })
  }

  const cfg = configR2()
  if (!cfg) {
    return NextResponse.json({ error: 'armazenamento (R2) não configurado' }, { status: 503 })
  }

  const chave = chaveDeEnvio(extensao)
  const contentType = TIPOS_DE_ENVIO[extensao]
  const url = urlDeEnvioR2(chave, { contentType, tamanhoBytes, expiraEmSegundos: VALIDADE_DO_LINK_S }, cfg)
  return NextResponse.json({ url, endereco: `${PREFIXO_R2}${chave}`, contentType })
}
