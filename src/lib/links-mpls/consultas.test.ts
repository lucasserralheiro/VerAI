/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import { resumir, serializarLink } from './consultas'
import { diferencaDeLinks, nomeDaCompetencia } from './tipos'

/* eslint-disable @typescript-eslint/no-explicit-any */

const link = (codigo: string, situacao = 'ATIVO') => ({ codigo, situacao, kbps: 16384, redundancia: 'Sem', dataAceite: null, dataCancelamento: null, entidade: 'X', tipoLogradouro: 'RUA', endereco: 'LÍBERO BADARÓ', numero: '293' }) as any
const rel = (parcial: any) => ({
  id: 'r1',
  arquivoId: 'a1',
  ano: 2026,
  mes: 9,
  sigla: 'CGM',
  clienteId: 'c1',
  contratoId: 'k1',
  contratoTexto: '16/CGM/2024',
  categoria: 'SOLUCAO',
  ativos: 3,
  cancelados: 0,
  conferido: true,
  avisos: [],
  links: [link('A'), link('B'), link('C')],
  ...parcial,
})

it('diferença por código entre dois meses', () => {
  const d = diferencaDeLinks([{ codigo: 'A' }, { codigo: 'B' }, { codigo: 'D' }], [{ codigo: 'A' }, { codigo: 'C' }])
  expect(d.entraram.map((l) => l.codigo)).toEqual(['B', 'D'])
  expect(d.sairam.map((l) => l.codigo)).toEqual(['C'])
})

it('resumo com entraram/saíram só quando os dois meses estão conferidos', () => {
  const antes = rel({ mes: 8, links: [link('A'), link('B'), link('X')] })
  expect(resumir(rel({}), antes, 'Controladoria')).toMatchObject({ competencia: '2026-09', ativos: 3, entraram: 1, sairam: 1, clienteNome: 'Controladoria' })
  expect(resumir(rel({}), { ...antes, conferido: false }, null)).toMatchObject({ entraram: null, sairam: null })
  expect(resumir(rel({ conferido: false }), antes, null)).toMatchObject({ ativos: null, cancelados: null, entraram: null })
})

it('link serializado junta tipo, endereço e número; competência por extenso', () => {
  expect(serializarLink(link('A')).endereco).toBe('RUA LÍBERO BADARÓ 293')
  expect(nomeDaCompetencia('2026-09')).toBe('set/2026')
})
