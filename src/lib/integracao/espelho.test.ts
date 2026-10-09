/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import { diferenca } from './espelho'
import { slugDe } from './fontes'

const r = (id: string, hash: string) => ({ id, hash, chaveCliente: null, chaveGerencia: null, dados: {} })

it('separa novos, mudados (pelo hash) e removidos', () => {
  const existentes = [
    { id: 'l1', idOrigem: '1', hash: 'a' },
    { id: 'l2', idOrigem: '2', hash: 'b' },
    { id: 'l3', idOrigem: '3', hash: 'c' },
  ]
  const d = diferenca(existentes, [r('1', 'a'), r('2', 'B'), r('4', 'd')])
  expect(d.novos.map((x) => x.id)).toEqual(['4'])
  expect(d.mudados).toEqual([{ id: 'l2', registro: r('2', 'B') }])
  expect(d.removidos).toEqual(['l3'])
})

it('registro repetido conta uma vez', () => {
  expect(diferenca([], [r('1', 'a'), r('1', 'a')]).novos).toHaveLength(1)
})

it('slug da fonte: sem acento, minúsculo, com hífen', () => {
  expect(slugDe('AIBertinho — DRM')).toBe('aibertinho-drm')
  expect(slugDe('Ação Social')).toBe('acao-social')
})
