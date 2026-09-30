import { renderToStaticMarkup } from 'react-dom/server'
import { render, screen } from '@testing-library/react'
import { componentesMarkdown, marcarNaoConfirmados, RespostaMarkdown, transformarUrl } from './resposta-markdown'

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

it('urlTransform mantém sei:/contrato: e limpa javascript:', () => {
  expect(transformarUrl('sei:7010202600096354')).toBe('sei:7010202600096354')
  expect(transformarUrl('contrato:ck1')).toBe('contrato:ck1')
  expect(transformarUrl('/clientes/c1')).toBe('/clientes/c1')
  expect(transformarUrl('javascript:alert(1)')).toBe('')
})

it('bloco :::geral vira caixa com título e rodapé; número não confirmado ganha ⚠', () => {
  render(<RespostaMarkdown texto={'Saldo R$ 5,00.\n:::geral\nDica.\n:::'} naoConfirmados={['R$ 5,00']} />)
  expect(screen.getByText('Não está nos documentos do VerAI · resposta da IA')).toBeInTheDocument()
  expect(screen.getByText('Confira antes de usar.')).toBeInTheDocument()
  // o stub do react-markdown mostra o texto cru: a marca entrou como link markdown no texto
  expect(screen.getByText('Saldo R$ 5,00 [⚠](aviso:nao-confirmado).')).toBeInTheDocument()
})

it('link aviso: vira ⚠ com título', () => {
  const A = componentesMarkdown.a as (p: { href?: string; children?: React.ReactNode }) => React.ReactNode
  const html = renderToStaticMarkup(<>{A({ href: 'aviso:nao-confirmado', children: '⚠' })}</>)
  expect(html).toContain('title="não confirmado no VerAI"')
  expect(html).toContain('⚠')
  expect(transformarUrl('aviso:nao-confirmado')).toBe('aviso:nao-confirmado')
})

it('marcarNaoConfirmados: todas as ocorrências, com escape de regex, e nada sem lista', () => {
  expect(marcarNaoConfirmados('a R$ 5,00 e R$ 5,00.', ['R$ 5,00'])).toBe(
    'a R$ 5,00 [⚠](aviso:nao-confirmado) e R$ 5,00 [⚠](aviso:nao-confirmado).'
  )
  expect(marcarNaoConfirmados('x 1.5 y 105', ['1.5'])).toBe('x 1.5 [⚠](aviso:nao-confirmado) y 105')
  expect(marcarNaoConfirmados('texto')).toBe('texto')
})

it('não marca dentro da caixa geral', () => {
  render(<RespostaMarkdown texto={':::geral\nvale R$ 5,00.\n:::'} naoConfirmados={['R$ 5,00']} />)
  expect(screen.queryByText(/aviso:nao-confirmado/)).toBeNull()
})

it('marcarNaoConfirmados: número dentro de outro número não é marcado', () => {
  expect(marcarNaoConfirmados('a 11.50 b 1.5', ['1.5'])).toBe('a 11.50 b 1.5 [⚠](aviso:nao-confirmado)')
  expect(marcarNaoConfirmados('R$ 1.500,00 e 500,00', ['500,00'])).toBe('R$ 1.500,00 e 500,00 [⚠](aviso:nao-confirmado)')
})

it('marcarNaoConfirmados: em link, marca depois do link inteiro e não toca o destino', () => {
  expect(marcarNaoConfirmados('[R$ 5,00](contrato:k1)', ['R$ 5,00'])).toBe('[R$ 5,00](contrato:k1) [⚠](aviso:nao-confirmado)')
  expect(marcarNaoConfirmados('[ver](contrato:5,00)', ['5,00'])).toBe('[ver](contrato:5,00)')
})

it('marcarNaoConfirmados: entradas sobrepostas dão uma marca só', () => {
  expect(marcarNaoConfirmados('R$ 5,00', ['R$ 5,00', '5,00'])).toBe('R$ 5,00 [⚠](aviso:nao-confirmado)')
})
