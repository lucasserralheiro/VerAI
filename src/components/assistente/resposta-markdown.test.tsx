import { renderToStaticMarkup } from 'react-dom/server'
import { componentesMarkdown } from './resposta-markdown'

// react-markdown é um stub de teste (ESM puro, ver jest.config.ts) que não repassa `components`
// pra nada — então o que dá pra testar aqui é o renderer de imagem isolado, chamando-o direto.

it('imagem: nunca renderiza <img> (link cego de IA não pode virar rastreador) — só o alt, ou nada', () => {
  const Img = componentesMarkdown.img as (props: { alt?: string; src?: string }) => React.ReactNode

  const comAlt = renderToStaticMarkup(<>{Img({ alt: 'gráfico de barras', src: 'https://rastreador.example/beacon.png' })}</>)
  expect(comAlt).not.toContain('<img')
  expect(comAlt).not.toContain('rastreador.example')
  expect(comAlt).toContain('gráfico de barras')

  expect(Img({ src: 'https://rastreador.example/beacon.png' })).toBeNull()
})
