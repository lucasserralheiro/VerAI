import { digitosDoSei, formatarSei, urlDoSei } from './sei'

describe('formatarSei', () => {
  it('aplica a máscara em número só com dígitos', () => {
    expect(formatarSei('7010202600096354')).toBe('7010.2026/0009635-4')
  })
  it('mantém quem já tem máscara e devolve o texto aparado fora do padrão', () => {
    expect(formatarSei('6017.2024/0028323-7')).toBe('6017.2024/0028323-7')
    expect(formatarSei('  Novo Sustenta ')).toBe('Novo Sustenta')
    expect(formatarSei(null)).toBe('')
  })
})

describe('urlDoSei', () => {
  it('usa o link cadastrado quando existe', () => {
    expect(urlDoSei('7010202600096354', 'https://sei.exemplo/abc', 'https://x/{numero}')).toBe('https://sei.exemplo/abc')
  })
  it('monta pelo modelo com número mascarado e só dígitos', () => {
    expect(urlDoSei('7010202600096354', null, 'https://x/?p={numero}&d={digitos}')).toBe(
      `https://x/?p=${encodeURIComponent('7010.2026/0009635-4')}&d=7010202600096354`
    )
  })
  it('sem link nem modelo devolve null (o componente copia o número)', () => {
    expect(urlDoSei('7010202600096354', null, undefined)).toBeNull()
    expect(urlDoSei('', 'https://x', undefined)).toBeNull()
  })
  it('digitosDoSei ignora máscara', () => {
    expect(digitosDoSei('6017.2024/0028323-7')).toBe('6017202400283237')
  })
})
