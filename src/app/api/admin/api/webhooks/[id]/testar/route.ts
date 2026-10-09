import { NextRequest, NextResponse } from 'next/server'

import { exigirAdminApi } from '@/lib/api/admin'
import { testarWebhook } from '@/lib/api/apps'

/** POST — manda um `ping` assinado para o webhook. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await exigirAdminApi(request)
  if ('erro' in admin) return admin.erro
  return NextResponse.json(await testarWebhook((await params).id))
}
