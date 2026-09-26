/** @jest-environment node */
jest.mock('./sincronizar', () => ({ sincronizarIndice: jest.fn() }))
jest.mock('./tamanho', () => ({ ...jest.requireActual('./tamanho'), tamanhoDoIndice: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/assistente/fichas/gerar', () => ({ gerarFichasPendentes: jest.fn() }))
jest.mock('@/lib/assistente/configuracao', () => ({ configuracaoDoAssistente: jest.fn() }))

import { atualizarFichasDoAssistente, atualizarIndiceDoAssistente } from './apos-sincronizacao'

const resumo = (over = {}) => ({ ok: 2, sem_texto: 1, erro: 0, removidos: 1, restantes: 3, ...over })

const pronto = async () => true

it('banco sem a migração do índice (produção antes do deploy): pula e avisa, sem indexar', async () => {
  const sincronizar = jest.fn()
  const linha = await atualizarIndiceDoAssistente({}, { sincronizar, tamanho: async () => 10, bancoPronto: async () => false })
  expect(sincronizar).not.toHaveBeenCalled()
  expect(linha).toBe('índice do assistente: pulado — migração 20260926100000_assistente_referencias não aplicada neste banco')
})

it('uma rodada com teto 200 e a linha do log', async () => {
  const sincronizar = jest.fn(async () => resumo())
  const linha = await atualizarIndiceDoAssistente({}, { sincronizar, tamanho: async () => 10, bancoPronto: pronto })
  expect(sincronizar).toHaveBeenCalledWith({ clienteId: undefined, limite: 200 })
  expect(linha).toBe('índice do assistente: indexados 2 · sem texto 1 · removidos 1 · erros 0 · pendentes 3')
})

it('com clientes, uma rodada por cliente e soma', async () => {
  const sincronizar = jest.fn(async (_opcoes: { clienteId?: string }) => resumo({ erro: 1 }))
  const linha = await atualizarIndiceDoAssistente({ clienteIds: ['c1', 'c2'] }, { sincronizar, tamanho: async () => 10, bancoPronto: pronto })
  expect(sincronizar.mock.calls.map((c) => c[0].clienteId)).toEqual(['c1', 'c2'])
  expect(linha).toBe('índice do assistente: indexados 4 · sem texto 2 · removidos 2 · erros 2 · pendentes 6')
})

it('acima de 80 MB não indexa e avisa', async () => {
  const sincronizar = jest.fn()
  const linha = await atualizarIndiceDoAssistente({}, { sincronizar, tamanho: async () => 81 * 1024 * 1024, bancoPronto: pronto })
  expect(sincronizar).not.toHaveBeenCalled()
  expect(linha).toMatch(/PARADO .* 81\.0 MB.* 80 MB/)
})

it('falha vira linha no log, nunca exceção', async () => {
  const falha = jest.fn(async () => {
    throw new Error('R2 fora')
  })
  const linha = await atualizarIndiceDoAssistente({}, { sincronizar: falha, tamanho: async () => 10, bancoPronto: pronto })
  expect(linha).toBe('índice do assistente: falhou — R2 fora (a próxima rodada tenta de novo)')
})

describe('atualizarFichasDoAssistente', () => {
  const resumoFichas = { porRegra: 3, comIa: 5, parciais: 6, semTexto: 2, erros: 0, tokens: 41000, restantes: 12 }

  it('banco sem a migração das fichas: pula e avisa', async () => {
    const gerar = jest.fn()
    const linha = await atualizarFichasDoAssistente({ gerar, bancoPronto: async () => false, comIa: () => true })
    expect(gerar).not.toHaveBeenCalled()
    expect(linha).toBe('fichas: pulado — migração 20260926110000_assistente_fichas não aplicada neste banco')
  })

  it('linha do log com teto de 50', async () => {
    const gerar = jest.fn(async () => resumoFichas)
    const linha = await atualizarFichasDoAssistente({ gerar, bancoPronto: async () => true, comIa: () => true })
    expect(gerar).toHaveBeenCalledWith({ limite: 50, comIa: true })
    expect(linha).toBe('fichas: por regra 3 · com IA 5 · parciais 6 · sem texto 2 · erros 0 · tokens 41000 · pendentes 12')
  })

  it('sem chave de IA: só regras, e avisa', async () => {
    const gerar = jest.fn(async () => resumoFichas)
    const linha = await atualizarFichasDoAssistente({ gerar, bancoPronto: async () => true, comIa: () => false })
    expect(gerar).toHaveBeenCalledWith({ limite: 50, comIa: false })
    expect(linha).toMatch(/ \(sem IA: chave não configurada\)$/)
  })

  it('falha vira linha, nunca exceção', async () => {
    const linha = await atualizarFichasDoAssistente({ gerar: jest.fn(async () => { throw new Error('banco fora') }), bancoPronto: async () => true, comIa: () => true })
    expect(linha).toBe('fichas: falhou — banco fora (a próxima rodada tenta de novo)')
  })
})
