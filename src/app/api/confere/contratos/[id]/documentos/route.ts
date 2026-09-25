import { NextRequest, NextResponse } from 'next/server'

import { competenciaAtual, documentosDoContrato } from '@/lib/confere/cadastro'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'

const COMPETENCIA = /^(\d{4})-(0[1-9]|1[0-2])$/

/** Proposta-base, aditivos e avisos de um contrato escolhido à mão, na competência da planilha
 *  (`?competencia=AAAA-MM`); sem ela, o mês atual. 404 para contrato inexistente ou fora do acesso. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const { id } = await params
  const achado = COMPETENCIA.exec(request.nextUrl.searchParams.get('competencia') ?? '')
  const competencia = achado ? { ano: Number(achado[1]), mes: Number(achado[2]) } : competenciaAtual()
  const documentos = await documentosDoContrato(autenticado.usuario, id, competencia, achado !== null)
  if (!documentos) return NextResponse.json({ detail: 'contrato não encontrado' }, { status: 404 })
  return NextResponse.json(documentos)
}
