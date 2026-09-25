import { destinoDoLink } from './links'

it('classifica links da resposta', () => {
  expect(destinoDoLink('sei:7010202600096354')).toEqual({ tipo: 'sei', numero: '7010202600096354' })
  expect(destinoDoLink('/clientes/c1/contratos/k1')).toEqual({ tipo: 'interno', href: '/clientes/c1/contratos/k1' })
  expect(destinoDoLink('https://sei.prefeitura.sp.gov.br/x')).toEqual({ tipo: 'externo', href: 'https://sei.prefeitura.sp.gov.br/x' })
  expect(destinoDoLink('javascript:alert(1)')).toEqual({ tipo: 'texto' })
  expect(destinoDoLink('//evil.com')).toEqual({ tipo: 'texto' })
  // Backslash: o parser de URL normaliza `\` pra `/` em esquemas especiais — "/\evil.com" vira
  // "//evil.com" (protocol-relative) e troca de origem. Sem checar a origem resolvida, passava como interno.
  expect(destinoDoLink('/\\evil.com')).toEqual({ tipo: 'texto' })
  expect(destinoDoLink(undefined)).toEqual({ tipo: 'texto' })
})
