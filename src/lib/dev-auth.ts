import type { NextRequest } from 'next/server'

/**
 * Modo de desenvolvimento: login por token + "Simular usuário" no header.
 * Liga com DEV_AUTH_ENABLED=1 — nunca deve estar ligado em produção real.
 */

export const IMPERSONATOR_COOKIE_NAME = 'dev-impersonando'

export function devAuthEnabled(): boolean {
  return process.env.DEV_AUTH_ENABLED === '1'
}

export function getImpersonatorId(request: NextRequest): string | null {
  return request.cookies.get(IMPERSONATOR_COOKIE_NAME)?.value ?? null
}
