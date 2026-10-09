import { NextResponse } from 'next/server'

import { documentoOpenApi } from '@/lib/api/openapi'

/** GET /api/v1/openapi.json — documentação da API (pública: não traz dado nenhum). */
export async function GET(request: Request) {
  return NextResponse.json(documentoOpenApi(new URL(request.url).origin))
}
