import { NextRequest, NextResponse } from 'next/server'

import { exigirAdminApi, painelDaApi } from '@/lib/api/admin'

/** GET — painel da tela /admin/api: catálogo de recursos, aplicativos (com webhooks) e fontes externas. */
export async function GET(request: NextRequest) {
  const admin = await exigirAdminApi(request)
  if ('erro' in admin) return admin.erro
  return NextResponse.json(await painelDaApi(request.nextUrl.origin))
}
