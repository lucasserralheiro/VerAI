/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import { etapaDosValores, MIGRACAO_DOS_VALORES } from './etapa'

/* eslint-disable @typescript-eslint/no-explicit-any */

const resumo = {
  linhas: 10,
  valor: 1,
  vigencia: 2,
  assinatura: 0,
  gravacoes: [{ contrato: 'SMDHC TC 68/SMDHC/2020', linha: 'TA 02', campo: 'valor' as const, dado: 'R$ 3.151.984,05', origem: 'TERMO+CONTROLE' }],
  avisos: [{ contrato: 'SGM TC 1/SGM/2024', linha: 'TA 01', aviso: 'valor lido do termo sem segunda prova: R$ 10,00' }],
}

it('banco sem a migração: pula sem tocar nas tabelas', async () => {
  const aplicar = jest.fn()
  const linhas = await etapaDosValores({} as any, { aplicar: true }, { bancoPronto: async () => false, aplicar })
  expect(linhas).toEqual([`valores dos contratos: pulado — migração ${MIGRACAO_DOS_VALORES} não aplicada neste banco`])
  expect(aplicar).not.toHaveBeenCalled()
})

it('resume gravações e avisos', async () => {
  const linhas = await etapaDosValores({} as any, { aplicar: true }, { bancoPronto: async () => true, aplicar: async () => resumo })
  expect(linhas[0]).toBe('valores dos contratos: 10 linha(s) do histórico · gravados: valor 1 · vigência 2 · assinatura 0 · avisos 1')
  expect(linhas).toContain('  SMDHC TC 68/SMDHC/2020 TA 02 — valor R$ 3.151.984,05 (TERMO+CONTROLE)')
  expect(linhas).toContain('  aviso SGM TC 1/SGM/2024 TA 01: valor lido do termo sem segunda prova: R$ 10,00')
})

it('erro vira linha, nunca lança', async () => {
  const linhas = await etapaDosValores({} as any, { aplicar: true }, {
    bancoPronto: async () => true,
    aplicar: async () => {
      throw new Error('conexão caiu')
    },
  })
  expect(linhas).toEqual(['valores dos contratos: falhou — conexão caiu (a próxima rodada tenta de novo)'])
})
