import { Prisma } from '@prisma/client'
import { hashDaEntidade, hashDe, jsonCanonico } from './canonico'

it('ordem das chaves não muda o hash', () => {
  expect(hashDe({ a: 1, b: { c: 2, d: 3 } })).toBe(hashDe({ b: { d: 3, c: 2 }, a: 1 }))
})

it('Decimal e Date viram texto; undefined vira null', () => {
  expect(jsonCanonico({ v: new Prisma.Decimal('10.50'), d: new Date('2026-10-07T00:00:00Z'), x: undefined })).toBe(
    '{"d":"2026-10-07T00:00:00.000Z","v":"10.5","x":null}'
  )
})

it('hash da entidade não depende da ordem dos registros', () => {
  expect(hashDaEntidade([{ id: 'b', hash: '2' }, { id: 'a', hash: '1' }])).toBe(hashDaEntidade([{ id: 'a', hash: '1' }, { id: 'b', hash: '2' }]))
})
