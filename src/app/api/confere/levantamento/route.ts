import { NextRequest, NextResponse } from 'next/server'

import { identificarLevantamento } from '@/lib/confere/cadastro'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'

/** Lê o cabeçalho do levantamento e acha o contrato no cadastro — só leitura, a planilha não é
 *  guardada (docs/superpowers/specs/2026-09-25-confere-contrato-do-cadastro-design.md §7.1). */
export async function POST(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const levantamento = (await request.formData()).get('levantamento')
  if (!(levantamento instanceof File)) {
    return NextResponse.json({ detail: 'levantamento é obrigatório' }, { status: 400 })
  }
  const resposta = await identificarLevantamento(autenticado.usuario, new Uint8Array(await levantamento.arrayBuffer()))
  return NextResponse.json(resposta)
}
