import { NextResponse } from 'next/server'

// Envelope da API de plataforma — o MESMO nos dois sistemas (VerAI e AIBertinho), para um cliente servir
// aos dois. Sucesso: `{ objeto, ... }`. Erro: `{ erro: { codigo, mensagem } }` com o status HTTP certo.

export function respostaApi(corpo: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(corpo, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

export function erroApi(status: number, codigo: string, mensagem: string, extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ erro: { codigo, mensagem, ...extra } }, { status, headers: { 'Cache-Control': 'private, no-store' } })
}
