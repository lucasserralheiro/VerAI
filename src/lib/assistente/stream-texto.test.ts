/** @jest-environment node */
import { DefaultChatTransport, readUIMessageStream, type UIMessage } from 'ai'
import { streamDeTexto } from './stream-texto'

it('stream de UI com um texto só, lido pelo mesmo leitor da tela', async () => {
  const transporte = new DefaultChatTransport<UIMessage>({
    api: '/api/x',
    fetch: (async () => streamDeTexto('**SMS**: 2 contratos')) as typeof fetch,
  })
  const stream = await transporte.sendMessages({ chatId: 'c', messages: [], trigger: 'submit-message', messageId: undefined, abortSignal: undefined })
  let texto = ''
  for await (const parcial of readUIMessageStream({ stream })) {
    texto = parcial.parts.map((p) => (p.type === 'text' ? p.text : '')).join('')
  }
  expect(texto).toBe('**SMS**: 2 contratos')
})
