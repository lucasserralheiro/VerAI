import { NextRequest, NextResponse } from 'next/server'

import { pastasDoCliente } from '@/lib/confere/pastas'
import { exigirAcessoCliente } from '@/lib/relatorios-clientes/acesso'

/** Os arquivos do cliente com as pastas do SharePoint — a janela "Pastas do cliente" do ConfereAI.
 *  Só leitura; nunca devolve `urlBlob` (o PDF abre por `/api/arquivos/[id]`). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const autenticado = await exigirAcessoCliente(request, clienteId)
  if ('erro' in autenticado) return autenticado.erro
  const pastas = await pastasDoCliente(clienteId)
  if (!pastas) return NextResponse.json({ detail: 'cliente não encontrado' }, { status: 404 })
  return NextResponse.json(pastas)
}
