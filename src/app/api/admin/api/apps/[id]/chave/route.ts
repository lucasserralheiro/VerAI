import { NextRequest, NextResponse } from 'next/server'

import { exigirAdminApi } from '@/lib/api/admin'
import { girarChave } from '@/lib/api/apps'

/** POST — gera chave nova; a antiga para de funcionar na hora. Devolve a chave inteira (única vez). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await exigirAdminApi(request)
  if ('erro' in admin) return admin.erro
  return NextResponse.json(await girarChave((await params).id))
}
