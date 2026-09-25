/** @jest-environment node */
jest.mock('./sincronizar', () => ({ sincronizarIndice: jest.fn() }))
jest.mock('./tamanho', () => ({ ...jest.requireActual('./tamanho'), tamanhoDoIndice: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import { atualizarIndiceDoAssistente } from './apos-sincronizacao'

const resumo = (over = {}) => ({ ok: 2, sem_texto: 1, erro: 0, removidos: 1, restantes: 3, ...over })

const pronto = async () => true

it('banco sem a migração do índice (produção antes do deploy): pula e avisa, sem indexar', async () => {
  const sincronizar = jest.fn()
  const linha = await atualizarIndiceDoAssistente({}, { sincronizar, tamanho: async () => 10, bancoPronto: async () => false })
  expect(sincronizar).not.toHaveBeenCalled()
  expect(linha).toBe('índice do assistente: pulado — migração 20260925190000_assistente_arquivo_cliente não aplicada neste banco')
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
