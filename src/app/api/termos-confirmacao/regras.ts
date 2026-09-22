import { NextResponse } from 'next/server'
import { ERRO_VIGENCIA, vigenciaInvalida } from '@/app/api/fornecedores/esquema'

export { contratoForaDoCliente } from '@/app/api/contratos/carregar'

export function erroVigencia(inicio: Date | null | undefined, fim: Date | null | undefined): NextResponse | null {
  return vigenciaInvalida(inicio, fim) ? NextResponse.json({ error: ERRO_VIGENCIA }, { status: 400 }) : null
}
