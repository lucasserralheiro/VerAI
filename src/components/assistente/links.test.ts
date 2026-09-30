import { destinoDoLink, ESQUEMA_PROPRIO } from './links'

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

it('esquemas curtos viram /ir/<tipo>/<id>; id estranho vira texto', () => {
  expect(destinoDoLink('contrato:ck1abc')).toEqual({ tipo: 'interno', href: '/ir/contrato/ck1abc' })
  expect(destinoDoLink('confere:ck9')).toEqual({ tipo: 'interno', href: '/ir/confere/ck9' })
  expect(destinoDoLink('contrato:../x')).toEqual({ tipo: 'texto' })
  expect(destinoDoLink('usuario:ck1')).toEqual({ tipo: 'texto' })
})

it('o markdown deixa passar os esquemas próprios', () => {
  expect(ESQUEMA_PROPRIO.test('sei:123')).toBe(true)
  expect(ESQUEMA_PROPRIO.test('contrato:ck1')).toBe(true)
  expect(ESQUEMA_PROPRIO.test('javascript:alert(1)')).toBe(false)
})

it('aviso:nao-confirmado é destino próprio, não link de registro', () => {
  expect(destinoDoLink('aviso:nao-confirmado')).toEqual({ tipo: 'aviso' })
})
