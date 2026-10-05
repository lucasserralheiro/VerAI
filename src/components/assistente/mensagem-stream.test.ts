import { lerMensagemDoStream, mensagemDeErro } from './mensagem-stream'

it('junta os textos e aponta a ferramenta ainda em andamento', () => {
  const msg = {
    id: 'm',
    role: 'assistant' as const,
    parts: [
      { type: 'step-start' },
      { type: 'tool-buscarClientes', toolCallId: 't1', state: 'output-available', input: {}, output: {} },
      { type: 'tool-resumoDoCliente', toolCallId: 't2', state: 'input-available', input: {} },
      { type: 'text', text: 'O SMIT ' },
      { type: 'text', text: 'tem 3 contratos.' },
    ],
  }
  expect(lerMensagemDoStream(msg as never)).toEqual({ texto: 'O SMIT tem 3 contratos.', ferramenta: 'resumoDoCliente', conferencia: null })
})

it('sem ferramenta pendente', () => {
  expect(lerMensagemDoStream({ id: 'm', role: 'assistant', parts: [{ type: 'text', text: 'ok' }] } as never)).toEqual({ texto: 'ok', ferramenta: null, conferencia: null })
})

it('mensagemDeErro tira o { error } do corpo JSON das rotas', () => {
  expect(mensagemDeErro(new Error('{"error":"Limite de 30 perguntas por hora atingido. Tente de novo mais tarde."}'))).toBe(
    'Limite de 30 perguntas por hora atingido. Tente de novo mais tarde.'
  )
  expect(mensagemDeErro(new Error('rede caiu'))).toBe('O assistente não respondeu. Tente de novo.')
})

it('lê a parte data-conferencia; bloqueada troca o texto', () => {
  const r = lerMensagemDoStream({ id: 'm', role: 'assistant', parts: [
    { type: 'text', text: 'O saldo é R$ 5,00.' },
    { type: 'data-conferencia', data: { naoConfirmados: [], bloqueada: true, texto: 'Não encontrei isso no VerAI.' } },
  ] } as never)
  expect(r.texto).toBe('Não encontrei isso no VerAI.')
  expect(r.conferencia).toEqual({ naoConfirmados: [], bloqueada: true, texto: 'Não encontrei isso no VerAI.' })
})

it('conferencia não bloqueada mantém o texto e devolve os não confirmados', () => {
  const r = lerMensagemDoStream({ id: 'm', role: 'assistant', parts: [
    { type: 'text', text: 'Saldo R$ 5,00.' },
    { type: 'data-conferencia', data: { naoConfirmados: ['R$ 5,00'], bloqueada: false } },
  ] } as never)
  expect(r.texto).toBe('Saldo R$ 5,00.')
  expect(r.conferencia?.naoConfirmados).toEqual(['R$ 5,00'])
})

it('texto limpo do servidor (chamada de ferramenta vazada) troca o texto mesmo sem bloqueio', () => {
  const r = lerMensagemDoStream({ id: 'm', role: 'assistant', parts: [
    { type: 'text', text: 'O termo prorroga. <｜｜DSML｜｜ calls>lixo' },
    { type: 'data-conferencia', data: { naoConfirmados: [], bloqueada: false, texto: 'O termo prorroga.' } },
  ] } as never)
  expect(r.texto).toBe('O termo prorroga.')
})
