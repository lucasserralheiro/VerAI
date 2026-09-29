/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/storage', () => ({ putUpload: jest.fn(), deleteUpload: jest.fn(async () => {}), getUpload: jest.fn() }))

import { etapaDaBiblioteca, MIGRACAO_DA_BIBLIOTECA, motivoIncompletaBiblioteca } from './etapa'
import type { ResultadoBiblioteca } from './sincronizar'

/* eslint-disable @typescript-eslint/no-explicit-any */

const completa = (extra: Partial<ResultadoBiblioteca> = {}): ResultadoBiblioteca => ({
  listados: 904,
  ignorados: 0,
  novos: 0,
  mudados: 1,
  iguais: 903,
  removidos: 0,
  falhas: [],
  leituras: ['tabela de preços 2026 v3.0: 315 serviços'],
  conferencia: [{ area: 'TABELA_PRECOS', noSharepoint: 5, noVerai: 5, faltando: [] }],
  remocaoSuspensa: null,
  ...extra,
})

function deps(r: ResultadoBiblioteca | Error, extra: any = {}) {
  return {
    existe: () => true,
    bancoPronto: async () => true,
    fonte: () => ({ listar: async () => [], ler: async () => Buffer.from('') }),
    sincronizar: jest.fn(async () => {
      if (r instanceof Error) throw r
      return r
    }),
    agora: () => new Date('2026-09-29T13:00:00Z'),
    ...extra,
  }
}
const prisma = () => ({ atualizacaoBiblioteca: { create: jest.fn() } })

it('motivoIncompletaBiblioteca', () => {
  expect(motivoIncompletaBiblioteca(completa(), true)).toBeNull()
  expect(motivoIncompletaBiblioteca(completa(), false)).toBe('só listagem')
  expect(motivoIncompletaBiblioteca(completa({ conferencia: [{ area: 'OUTRO', noSharepoint: 1, noVerai: 0, faltando: ['x'] }] }), true)).toBe('conferência com divergência')
  expect(motivoIncompletaBiblioteca(completa({ remocaoSuspensa: 'curta' }), true)).toBe('remoção suspensa')
  expect(motivoIncompletaBiblioteca(completa({ falhas: [{ caminho: 'a', motivo: 'b' }] }), true)).toBe('1 arquivo(s) com falha')
})

it('pasta que não existe neste PC: pula sem problema', async () => {
  const r = await etapaDaBiblioteca(prisma() as any, { aplicar: true, raiz: 'C:/nao/existe' }, deps(completa(), { existe: () => false }))
  expect(r).toEqual({ linhas: ['biblioteca Documentos: pasta não encontrada (C:/nao/existe) — pulada'], problema: false })
})

it('banco sem a migração (produção num deploy antigo): pula e não mexe no código de saída', async () => {
  const d = deps(completa(), { bancoPronto: async () => false })
  const r = await etapaDaBiblioteca(prisma() as any, { aplicar: true, raiz: 'x' }, d)
  expect(r).toEqual({ linhas: [`biblioteca Documentos: pulada — migração ${MIGRACAO_DA_BIBLIOTECA} não aplicada neste banco`], problema: false })
  expect(d.sincronizar).not.toHaveBeenCalled()
})

it('passada completa grava a data das telas', async () => {
  const p = prisma()
  const r = await etapaDaBiblioteca(p as any, { aplicar: true, raiz: 'x' }, deps(completa()))
  expect(p.atualizacaoBiblioteca.create).toHaveBeenCalledWith({ data: { biblioteca: 'DOCUMENTOS', iniciadaEm: new Date('2026-09-29T13:00:00Z'), arquivos: 904 } })
  expect(r.problema).toBe(false)
  expect(r.linhas.join('\n')).toMatch(/904 arquivo\(s\)[\s\S]*tabela de preços 2026 v3\.0[\s\S]*TUDO NO VERAI[\s\S]*data das telas: atualizada/)
})

it('divergência: problema (código 2) e sem data', async () => {
  const p = prisma()
  const r = await etapaDaBiblioteca(
    p as any,
    { aplicar: true, raiz: 'x' },
    deps(completa({ conferencia: [{ area: 'LINKS_MPLS', noSharepoint: 2, noVerai: 1, faltando: ['L/a.pdf'] }] }))
  )
  expect(r.problema).toBe(true)
  expect(p.atualizacaoBiblioteca.create).not.toHaveBeenCalled()
  expect(r.linhas.join('\n')).toMatch(/DIVERGÊNCIA em LINKS_MPLS[\s\S]*falta L\/a\.pdf/)
})

it('erro inesperado vira linha do log e problema', async () => {
  const r = await etapaDaBiblioteca(prisma() as any, { aplicar: true, raiz: 'x' }, deps(new Error('R2 fora')))
  expect(r).toEqual({ linhas: ['biblioteca Documentos: falhou — R2 fora (a próxima rodada tenta de novo)'], problema: true })
})

it('só listagem: não grava data e não é problema', async () => {
  const p = prisma()
  const r = await etapaDaBiblioteca(p as any, { aplicar: false, raiz: 'x' }, deps(completa({ conferencia: null })))
  expect(p.atualizacaoBiblioteca.create).not.toHaveBeenCalled()
  expect(r.problema).toBe(false)
})
