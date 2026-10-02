import { duvidaDeTrabalho } from './tipo-pergunta'

it.each([
  'como corrijo uma fórmula PROCV que dá #N/D no Excel?',
  'como escrevo um ofício pedindo reajuste?',
  'preciso de uma minuta de despacho',
  'como mando e-mail pelo Outlook com PDF?',
  'o que é apostilamento?',
])('dúvida de trabalho: %s', (p) => expect(duvidaDeTrabalho(p)).toBe(true))

it.each(['qual a capital da França?', 'me passa uma receita de bolo', 'me escreve um poema sobre o mar', 'conta uma piada'])(
  'não é dúvida de trabalho: %s',
  (p) => expect(duvidaDeTrabalho(p)).toBe(false)
)
