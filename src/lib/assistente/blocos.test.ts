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

it('resposta com dois blocos :::geral separados por texto do VerAI → 3 ou mais blocos na ordem certa', () => {
  expect(
    separarBlocos('Contexto 1.\n\n:::geral\nGeral 1\n:::\n\nTexto do VerAI.\n\n:::geral\nGeral 2\n:::'),
  ).toEqual([
    { tipo: 'verai', texto: 'Contexto 1.' },
    { tipo: 'geral', texto: 'Geral 1' },
    { tipo: 'verai', texto: 'Texto do VerAI.' },
    { tipo: 'geral', texto: 'Geral 2' },
  ])
})
