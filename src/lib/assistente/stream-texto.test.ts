/** @jest-environment node */
import { streamDeTexto } from './stream-texto'

it('stream de UI com um texto só, lido pelo mesmo leitor da tela', async () => {
  const r = streamDeTexto('**SMS**: 2 contratos')
  const bruto = await r.text()
  expect(bruto).toContain('"type":"text-delta"')
  expect(bruto).toContain('**SMS**: 2 contratos')
})
