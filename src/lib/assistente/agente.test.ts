/** @jest-environment node */
import { simulateReadableStream } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'

jest.mock('unpdf', () => ({})) // ESM; carregado pela cadeia das ferramentas, não usado aqui
jest.mock('@/lib/prisma', () => ({ prisma: { cliente: { findMany: jest.fn(async () => [{ id: 'c1', nome: 'SMIT', siglaLegado: 'SMIT', _count: { contratos: 1 } }]) } } }))
jest.mock('@/lib/visibilidade', () => ({ clienteIdsPermitidos: jest.fn(async () => null), podeVerCliente: jest.fn(async () => true), documentosVisiveisWhere: jest.fn(async () => ({})) }))

import { executarAgente, finalizarResposta, limparChamadasVazadas, montarMensagens, MAX_HISTORICO, type ResultadoAgente } from './agente'
import { INSTRUCOES_SISTEMA } from './instrucoes'
import { NAO_ENCONTREI, RECUSA } from './blocos'

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

describe('finalizarResposta', () => {
  it('confere só o que está fora de :::geral, contra saídas e contexto', () => {
    const r = finalizarResposta({
      texto: 'Vence em 31/12/2026, saldo R$ 5,00.\n:::geral\nEm geral o prazo é de 60 meses, R$ 7,00.\n:::',
      saidas: ['fim: 31/12/2026'],
      contexto: 'Hoje é 30/09/2026.',
      houveFerramenta: true,
    })
    expect(r.conferencia).toEqual({ conferidos: 1, naoConfirmados: ['R$ 5,00'] })
    expect(r.tipos).toEqual(['verai', 'geral'])
    expect(r.bloqueada).toBe(false)
  })

  it('número do VerAI sem nenhuma consulta: troca por "Não encontrei" e mantém o bloco geral', () => {
    const r = finalizarResposta({ texto: 'O saldo é R$ 5,00.\n:::geral\nDica geral.\n:::', saidas: [], contexto: 'Hoje é 30/09/2026.', houveFerramenta: false })
    expect(r.bloqueada).toBe(true)
    expect(r.texto).toBe(`${NAO_ENCONTREI}\n\n:::geral\nDica geral.\n:::`)
    expect(r.conferencia).toEqual({ conferidos: 0, naoConfirmados: [] })
    expect(r.tipos).toEqual(['verai', 'geral'])
  })

  it('sem consulta mas número do contexto (data de hoje) não bloqueia', () => {
    expect(finalizarResposta({ texto: 'Hoje é 30/09/2026.', saidas: [], contexto: 'Hoje é 30/09/2026.', houveFerramenta: false }).bloqueada).toBe(false)
  })

  it('recusa com bloco geral sobrando: os tipos vêm de tiposDaResposta', () => {
    const r = finalizarResposta({ texto: `${RECUSA}\n:::geral\nx\n:::`, saidas: [], contexto: null, houveFerramenta: false })
    expect(r.tipos).toEqual(['recusa', 'geral'])
    expect(r.bloqueada).toBe(false)
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
    const { resposta } = executarAgente({ usuario, historico: [], pergunta: 'fale do smit', contexto: null, modelo }, async (r) => {
      final = r
    })
    const corpo = await resposta.text()
    // O texto do modelo chega inteiro antes da conferência, e a conferência antes do fim.
    const iTexto = corpo.indexOf('O SMIT tem 1 contrato.')
    const iConferencia = corpo.indexOf('"type":"data-conferencia"')
    expect(iTexto).toBeGreaterThan(-1)
    expect(iConferencia).toBeGreaterThan(iTexto)
    expect(corpo.lastIndexOf('"type":"text-end"')).toBeLessThan(iConferencia)
    expect(corpo.indexOf('"type":"finish"')).toBeGreaterThan(iConferencia)
    expect(corpo).toContain('"data":{"naoConfirmados":[],"bloqueada":false}')
    expect(final).toEqual({
      texto: 'O SMIT tem 1 contrato.',
      ferramentas: [{ nome: 'buscarClientes', entrada: { termo: 'smit' } }],
      conferencia: { conferidos: 0, naoConfirmados: [] },
      tipos: ['verai'],
      bloqueada: false,
      tokensEntrada: 250,
      tokensSaida: 18,
      tokensCache: 120,
    })
    // A 2ª chamada recebeu o resultado da ferramenta, em texto compacto.
    expect(JSON.stringify(modelo.doStreamCalls[1].prompt)).toContain('c1|SMIT|SMIT|1')
  })

  it('data passada na ENTRADA da ferramenta confirma a resposta (ISO na entrada, dd/mm/aaaa no texto)', async () => {
    const modelo = new MockLanguageModelV4({
      doStream: [
        {
          stream: simulateReadableStream({
            chunks: [
              { type: 'stream-start', warnings: [] },
              { type: 'tool-call', toolCallId: 't1', toolName: 'buscarClientes', input: '{"termo":"2027-01-02"}' },
              { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage: uso(1, 0, 1) },
            ],
          }),
        },
        {
          stream: simulateReadableStream({
            chunks: [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Vencem até 02/01/2027.' },
              { type: 'text-end', id: '1' },
              { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: uso(1, 0, 1) },
            ],
          }),
        },
      ],
    })
    let final: ResultadoAgente | undefined
    await executarAgente({ usuario, historico: [], pergunta: 'o que vence?', contexto: null, modelo }, async (r) => {
      final = r
    }).resposta.text()
    expect(final!.conferencia).toEqual({ conferidos: 1, naoConfirmados: [] })
  })

  it('valor passado na ENTRADA da ferramenta NÃO confirma a resposta', async () => {
    const modelo = new MockLanguageModelV4({
      doStream: [
        {
          stream: simulateReadableStream({
            chunks: [
              { type: 'stream-start', warnings: [] },
              { type: 'tool-call', toolCallId: 't1', toolName: 'buscarClientes', input: '{"termo":"R$ 999,00"}' },
              { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage: uso(1, 0, 1) },
            ],
          }),
        },
        {
          stream: simulateReadableStream({
            chunks: [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Fica R$ 999,00.' },
              { type: 'text-end', id: '1' },
              { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: uso(1, 0, 1) },
            ],
          }),
        },
      ],
    })
    let final: ResultadoAgente | undefined
    await executarAgente({ usuario, historico: [], pergunta: 'o que vence?', contexto: null, modelo }, async (r) => {
      final = r
    }).resposta.text()
    expect(final!.conferencia).toEqual({ conferidos: 0, naoConfirmados: ['R$ 999,00'] })
  })
})

describe('executarAgente — conferência e falha', () => {
  const soTexto = (texto: string) =>
    new MockLanguageModelV4({
      doStream: [
        {
          stream: simulateReadableStream({
            chunks: [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: texto },
              { type: 'text-end', id: '1' },
              { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: uso(1, 0, 1) },
            ],
          }),
        },
      ],
    })

  it('número sem nenhuma consulta: a parte data-conferencia leva o texto de bloqueio e a gravação também', async () => {
    let final: ResultadoAgente | undefined
    const { resposta } = executarAgente({ usuario, historico: [], pergunta: 'saldo?', contexto: 'Hoje é 30/09/2026.', modelo: soTexto('O saldo é R$ 5,00.') }, async (r) => {
      final = r
    })
    const corpo = await resposta.text()
    expect(corpo).toContain(`"data":{"naoConfirmados":[],"bloqueada":true,"texto":"${NAO_ENCONTREI}"}`)
    expect(final).toMatchObject({ texto: NAO_ENCONTREI, bloqueada: true, tipos: ['verai'], ferramentas: [] })
  })

  it('falha do provedor: mensagem fixa no stream e aoTerminar com texto vazio', async () => {
    const erro = jest.spyOn(console, 'error').mockImplementation(() => {})
    const modelo = new MockLanguageModelV4({
      doStream: async () => {
        throw new Error('provedor fora')
      },
    })
    let final: ResultadoAgente | undefined
    const { resposta } = executarAgente({ usuario, historico: [], pergunta: 'oi', contexto: null, modelo }, async (r) => {
      final = r
    })
    const corpo = await resposta.text()
    expect(corpo).toContain('O assistente não respondeu. Tente de novo.')
    expect(corpo).not.toContain('provedor fora')
    expect(corpo).not.toContain('data-conferencia')
    expect(final).toMatchObject({ texto: '', ferramentas: [] })
    erro.mockRestore()
  })

  it('erro no meio do stream: resposta parcial não é gravada (texto vazio, tokens seguem)', async () => {
    const erro = jest.spyOn(console, 'error').mockImplementation(() => {})
    const modelo = new MockLanguageModelV4({
      doStream: [
        {
          stream: simulateReadableStream({
            chunks: [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Resposta pela metade' },
              { type: 'error', error: new Error('conexão caiu') },
            ],
          }),
        },
      ],
    })
    let final: ResultadoAgente | undefined
    const { resposta } = executarAgente({ usuario, historico: [], pergunta: 'oi', contexto: null, modelo }, async (r) => {
      final = r
    })
    await resposta.text()
    expect(final).toBeDefined()
    expect(final!.texto).toBe('')
    erro.mockRestore()
  })

  it('chamada de ferramenta do DeepSeek vazada no texto: sai antes de conferir e gravar; a tela recebe o texto limpo', async () => {
    const vazado = 'O termo prorroga a vigência.\n\n<｜｜DSML｜｜ calls><｜｜DSML｜｜ invoke name="lerAnexo"><｜｜DSML｜｜ parameter name="anexoId">a1</｜｜DSML｜｜ parameter></｜｜DSML｜｜ invoke></｜｜DSML｜｜ calls>'
    let final: ResultadoAgente | undefined
    const { resposta } = executarAgente({ usuario, historico: [], pergunta: 'o que muda?', contexto: null, modelo: soTexto(vazado) }, async (r) => {
      final = r
    })
    const corpo = await resposta.text()
    expect(final!.texto).toBe('O termo prorroga a vigência.')
    expect(corpo).toContain('"data":{"naoConfirmados":[],"bloqueada":false,"texto":"O termo prorroga a vigência."}')
  })

  it('só chamada vazada, sem texto: cai no caminho sem resposta', async () => {
    let final: ResultadoAgente | undefined
    const { resposta } = executarAgente(
      { usuario, historico: [], pergunta: 'o que muda?', contexto: null, modelo: soTexto('<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>lerAnexo<｜tool▁sep｜>{"anexoId":"a1"}<｜tool▁call▁end｜><｜tool▁calls▁end｜>') },
      async (r) => {
        final = r
      }
    )
    await resposta.text()
    expect(final!.texto).toBe('')
  })

  it('falha em aoTerminar (banco) não vira erro na tela', async () => {
    const erro = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { resposta } = executarAgente({ usuario, historico: [], pergunta: 'oi', contexto: null, modelo: soTexto('ok') }, async () => {
      throw new Error('banco fora')
    })
    const corpo = await resposta.text()
    expect(corpo).not.toContain('"type":"error"')
    expect(erro).toHaveBeenCalled()
    erro.mockRestore()
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
    await executarAgente({ usuario, historico: [], pergunta: 'saldo?', contexto, modelo }, async () => {}).resposta.text()
    const prompt = modelo.doStreamCalls[0].prompt
    // A regra 4 da instrução cita o rótulo "Já identificados"; o que não pode ir ao system é o conteúdo.
    expect(JSON.stringify(prompt.filter((m) => m.role === 'system'))).not.toContain('clienteId: c1')
    expect(JSON.stringify(prompt.at(-1))).toContain('cliente SMIT (clienteId: c1)')
  })
})

describe('limparChamadasVazadas', () => {
  it('tira o bloco de marcadores (DSML e ｜) e mantém o texto antes e depois', () => {
    expect(limparChamadasVazadas('Antes.<｜｜DSML｜｜ calls>x</｜｜DSML｜｜ calls>\nDepois.')).toBe('Antes.\nDepois.')
    expect(limparChamadasVazadas('Sem nada estranho: R$ 5,00 | coluna')).toBe('Sem nada estranho: R$ 5,00 | coluna')
    expect(limparChamadasVazadas('linha com DSML solta\nresto')).toBe('resto')
    expect(limparChamadasVazadas('a ｜ b')).toBe('a  b')
  })
})

describe('instrução do sistema', () => {
  it('traz a regra dos anexos da conversa', () => {
    for (const termo of ['anexosDaConversa', 'lerAnexo', 'compararAnexoComContrato', 'conferirPrecosDoAnexo', '<<<ANEXO', 'anexoId'])
      expect(INSTRUCOES_SISTEMA).toContain(termo)
    expect(INSTRUCOES_SISTEMA.length).toBeLessThanOrEqual(6000)
  })

  it('cabe no teto e cita as ferramentas de analista, o formato e as regras da fase 1', () => {
    expect(INSTRUCOES_SISTEMA.length).toBeLessThanOrEqual(6000)
    expect(INSTRUCOES_SISTEMA).toContain('[confirmar]')
    for (const termo of [
      'alertas', 'consultarManual', 'buscarNasNormas', 'fichasDoContrato', 'buscarNosDocumentos', 'Atenção', 'Próximo passo', 'Já identificados', '(tipo:id)', 'sei:', '"|"',
      ':::geral', 'calendarioFaturamento', 'simularReajuste', 'controleDoFaturamento', 'Período citado', 'Contratos possíveis', 'Contrato provável', RECUSA,
    ]) {
      expect(INSTRUCOES_SISTEMA).toContain(termo)
    }
  })
})

describe('instrução do sistema — ajustes da régua', () => {
  it('IPC "últimos N meses" = os N últimos publicados, sem passar período', () => {
    expect(INSTRUCOES_SISTEMA).toMatch(/últimos N meses.*publicados/)
    expect(INSTRUCOES_SISTEMA).toContain('omita mesInicial e mesFinal')
  })
  it('dúvida de Excel, Word, e-mail, SEI e ferramentas do escritório é trabalho (:::geral); recusa só para lazer', () => {
    expect(INSTRUCOES_SISTEMA).toMatch(/Excel[\s\S]*Word[\s\S]*e-mail[\s\S]*SEI[\s\S]*:::geral/)
    expect(INSTRUCOES_SISTEMA).toContain('cultura geral')
    expect(INSTRUCOES_SISTEMA).toContain('poema')
    expect(INSTRUCOES_SISTEMA).toContain('nunca abrevie')
    expect(INSTRUCOES_SISTEMA.length).toBeLessThanOrEqual(6000)
  })
})
