import { NextResponse } from 'next/server'

export function notImplemented() {
  return NextResponse.json({ error: 'ainda não implementado' }, { status: 501 })
}
