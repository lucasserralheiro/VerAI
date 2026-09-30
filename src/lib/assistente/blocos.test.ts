import { RECUSA, separarBlocos, tiposDaResposta } from './blocos'

it('separa trechos do VerAI e blocos :::geral, na ordem', () => {
  expect(separarBlocos('O contrato vence em 12/11/2026.\n\n:::geral\nPara prorrogar, normalmente…\n:::\n\nPróximo passo: abrir o contrato.')).toEqual([
    { tipo: 'verai', texto: 'O contrato vence em 12/11/2026.' },
    { tipo: 'geral', texto: 'Para prorrogar, normalmente…' },
    { tipo: 'verai', texto: 'Próximo passo: abrir o contrato.' },
  ])
})

it('bloco aberto no meio do stream já é geral', () => {
  expect(separarBlocos(':::geral\nApostilamento é')).toEqual([{ tipo: 'geral', texto: 'Apostilamento é' }])
})

it('tipos: verai, geral, recusa', () => {
  expect(tiposDaResposta('Saldo R$ 1,00.')).toEqual(['verai'])
  expect(tiposDaResposta(':::geral\nx\n:::')).toEqual(['geral'])
  expect(tiposDaResposta('a\n:::geral\nx\n:::')).toEqual(['verai', 'geral'])
  expect(tiposDaResposta(RECUSA)).toEqual(['recusa'])
})

it('resposta com 4 blocos (dois geral separados por texto do VerAI)', () => {
  expect(
    separarBlocos('Contexto 1.\n\n:::geral\nGeral 1\n:::\n\nTexto do VerAI.\n\n:::geral\nGeral 2\n:::'),
  ).toEqual([
    { tipo: 'verai', texto: 'Contexto 1.' },
    { tipo: 'geral', texto: 'Geral 1' },
    { tipo: 'verai', texto: 'Texto do VerAI.' },
    { tipo: 'geral', texto: 'Geral 2' },
  ])
})

// Delimitadores com espaço, indent, bullet — tolerância a espaço/indentação
it('::: geral (espaço entre ::: e geral) abre bloco', () => {
  expect(separarBlocos('a\n::: geral\nx\n:::\nb')).toEqual([
    { tipo: 'verai', texto: 'a' },
    { tipo: 'geral', texto: 'x' },
    { tipo: 'verai', texto: 'b' },
  ])
})

it(':::geral indentado abre bloco', () => {
  expect(separarBlocos('Antes.\n\n  :::geral\nGeral\n:::\n\nDepois.')).toEqual([
    { tipo: 'verai', texto: 'Antes.' },
    { tipo: 'geral', texto: 'Geral' },
    { tipo: 'verai', texto: 'Depois.' },
  ])
})

it(':::geral com bullet abre bloco', () => {
  expect(separarBlocos('- :::geral\nGeral\n:::')).toEqual([{ tipo: 'geral', texto: 'Geral' }])
})

it('fechamento indentado (  :::) fecha, texto depois continua verai', () => {
  expect(separarBlocos('a\n:::geral\nx\n  :::\nb')).toEqual([
    { tipo: 'verai', texto: 'a' },
    { tipo: 'geral', texto: 'x' },
    { tipo: 'verai', texto: 'b' },
  ])
})

it('fechamento com espaço (::: ) fecha, texto depois continua verai', () => {
  expect(separarBlocos('a\n:::geral\nx\n::: \nb')).toEqual([
    { tipo: 'verai', texto: 'a' },
    { tipo: 'geral', texto: 'x' },
    { tipo: 'verai', texto: 'b' },
  ])
})

// Recusa com normalização
it('frase de recusa exata → ["recusa"]', () => {
  expect(tiposDaResposta(RECUSA)).toEqual(['recusa'])
})

it('frase de recusa em bold → ["recusa"]', () => {
  expect(tiposDaResposta(`**${RECUSA}**`)).toEqual(['recusa'])
})

it('frase de recusa com bloco geral → ["recusa", "geral"]', () => {
  expect(tiposDaResposta(`${RECUSA}\n\n:::geral\nConhecimento\n:::`)).toEqual(['recusa', 'geral'])
})

it('só o começo da frase de recusa não é recusa', () => {
  expect(tiposDaResposta('Isso está fora do que o assistente do VerAI atende.')).toEqual(['verai'])
})
