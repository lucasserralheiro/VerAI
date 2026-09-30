import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'

/** Resposta pronta (sem IA) no mesmo formato de stream que a tela já lê. */
export function streamDeTexto(texto: string): Response {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: 'text-start', id: 'direta' })
      writer.write({ type: 'text-delta', id: 'direta', delta: texto })
      writer.write({ type: 'text-end', id: 'direta' })
    },
  })
  return createUIMessageStreamResponse({ stream })
}
