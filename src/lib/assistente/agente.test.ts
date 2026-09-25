/** @jest-environment node */
import { simulateReadableStream } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'

jest.mock('unpdf', () => ({})) // ESM; carregado pela cadeia das ferramentas, não usado aqui
jest.mock('@/lib/prisma', () => ({ prisma: { cliente: { findMany: jest.fn(async () => [{ id: 'c1', nome: 'SMIT', siglaLegado: 'SMIT', _count: { contratos: 1 } }]) } } }))
jest.mock('@/lib/visibilidade', () => ({ clienteIdsPermitidos: jest.fn(async () => null), podeVerCliente: jest.fn(async () => true), documentosVisiveisWhere: jest.fn(async () => ({})) }))

import { executarAgente, montarMensagens, MAX_HISTORICO, type ResultadoAgente } from './agente'

const usuario = { id: 'u', nome: 'U', email: 'u@x', role: 'admin' as const }
const uso = (entrada: number, cache: number, saida: number) => ({
  inputTokens: { total: entrada, noCache: entrada - cache, cacheRead: cache, cacheWrite: undefined },
  outputTokens: { total: saida, text: saida, reasoning: undefined },
})

describe('montarMensagens', () => {
  it('só as últimas mensagens e o contexto junto da pergunta (depois do histórico)', () => {
    const historico = Array.from({ length: 10 }, (_, i) => ({ papel: (i % 2 ? 'assistente' : 'usuario') as 'usuario' | 'assistente', conteudo: `m${i}` }))
    const msgs = montarMensagens(historico, 'e o saldo?', 'Hoje é 23/09/2026.')
    expect(msgs).toHaveLength(MAX_HISTORICO + 1)
    expect(msgs[0]).toEqual({ role: 'user', content: 'm4' })
    expect(msgs.at(-1)).toEqual({ role: 'user', content: 'Hoje é 23/09/2026.\n\nPergunta: e o saldo?' })
  })
})

describe('executarAgente', () => {
  it('chama a ferramenta, responde e entrega texto, ferramentas e tokens somados', async () => {
    const modelo = new MockLanguageModelV4({
      doStream: [
        {
          stream: simulateReadableStream({
            chunks: [
              { type: 'stream-start', warnings: [] },
              { type: 'tool-call', toolCallId: 't1', toolName: 'buscarClientes', input: '{"termo":"smit"}' },
              { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage: uso(100, 20, 10) },
            ],
          }),
        },
        {
          stream: simulateReadableStream({
            chunks: [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'O SMIT tem 1 contrato.' },
              { type: 'text-end', id: '1' },
              { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: uso(150, 100, 8) },
            ],
          }),
        },
      ],
    })
    let final: ResultadoAgente | undefined
    const resultado = executarAgente({ usuario, historico: [], pergunta: 'fale do smit', contexto: null, modelo }, async (r) => {
      final = r
    })
    await resultado.consumeStream()
    await new Promise((r) => setTimeout(r, 0))
    expect(final).toEqual({
      texto: 'O SMIT tem 1 contrato.',
      ferramentas: [{ nome: 'buscarClientes', entrada: { termo: 'smit' } }],
      tokensEntrada: 250,
      tokensSaida: 18,
      tokensCache: 120,
    })
    // A 2ª chamada recebeu o resultado da ferramenta, em texto compacto.
    expect(JSON.stringify(modelo.doStreamCalls[1].prompt)).toContain('c1|SMIT|SMIT|1')
  })
})

describe('contexto da pergunta', () => {
  it('"Já identificados" vai na última mensagem do usuário, nunca no system', async () => {
    const modelo = new MockLanguageModelV4({
      doStream: [
        {
          stream: simulateReadableStream({
            chunks: [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'ok' },
              { type: 'text-end', id: '1' },
              { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: uso(1, 0, 1) },
            ],
          }),
        },
      ],
    })
    const contexto = 'Hoje é 25/09/2026. Já identificados (use estes ids, não procure de novo): cliente SMIT (clienteId: c1).'
    await executarAgente({ usuario, historico: [], pergunta: 'saldo?', contexto, modelo }, async () => {}).consumeStream()
    const prompt = modelo.doStreamCalls[0].prompt
    // A regra 4 da instrução cita o rótulo "Já identificados"; o que não pode ir ao system é o conteúdo.
    expect(JSON.stringify(prompt.filter((m) => m.role === 'system'))).not.toContain('clienteId: c1')
    expect(JSON.stringify(prompt.at(-1))).toContain('cliente SMIT (clienteId: c1)')
  })
})
