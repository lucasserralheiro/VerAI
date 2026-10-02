/** @jest-environment node */
import { TAMANHO_MAXIMO_ENVIO } from '@/lib/propostas/envio'
import { TAMANHO_MAXIMO_ANEXO } from './tipos'

it('o teto do anexo na tela é o mesmo do envio pré-assinado do servidor', () => {
  expect(TAMANHO_MAXIMO_ANEXO).toBe(TAMANHO_MAXIMO_ENVIO)
})
