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
  expect(lerMensagemDoStream(msg as never)).toEqual({ texto: 'O SMIT tem 3 contratos.', ferramenta: 'resumoDoCliente' })
})

it('sem ferramenta pendente', () => {
  expect(lerMensagemDoStream({ id: 'm', role: 'assistant', parts: [{ type: 'text', text: 'ok' }] } as never)).toEqual({ texto: 'ok', ferramenta: null })
})

it('mensagemDeErro tira o { error } do corpo JSON das rotas', () => {
  expect(mensagemDeErro(new Error('{"error":"Limite de 30 perguntas por hora atingido. Tente de novo mais tarde."}'))).toBe(
    'Limite de 30 perguntas por hora atingido. Tente de novo mais tarde.'
  )
  expect(mensagemDeErro(new Error('rede caiu'))).toBe('O assistente não respondeu. Tente de novo.')
})
