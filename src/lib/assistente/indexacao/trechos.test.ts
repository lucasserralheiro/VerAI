import { cortarEmTrechos, htmlParaTexto, hashTexto } from './trechos'

describe('cortarEmTrechos', () => {
  it('página curta vira um trecho só, com a página preservada', () => {
    expect(cortarEmTrechos([{ pagina: 3, texto: '  Cláusula   primeira.  ' }])).toEqual([
      { pagina: 3, ordem: 0, texto: 'Cláusula primeira.' },
    ])
  })

  it('tira caractere nulo e de controle (o Postgres recusa 0x00 em texto)', () => {
    const [trecho] = cortarEmTrechos([{ pagina: 1, texto: 'Cláu\u0000sula 5ª\u0007 — reajuste\u0000' }])
    expect(trecho.texto).toBe('Cláusula 5ª — reajuste')
  })

  it('pula página vazia e numera a ordem através das páginas', () => {
    const trechos = cortarEmTrechos([
      { pagina: 1, texto: 'um' },
      { pagina: 2, texto: '   ' },
      { pagina: 3, texto: 'três' },
    ])
    expect(trechos.map((t) => [t.pagina, t.ordem, t.texto])).toEqual([
      [1, 0, 'um'],
      [3, 1, 'três'],
    ])
  })

  it('texto longo sem quebra: pedaços de até 1500 com 200 de sobreposição', () => {
    const texto = 'abcdefghij'.repeat(400) // 4000 caracteres
    const trechos = cortarEmTrechos([{ pagina: 1, texto }])
    expect(trechos).toHaveLength(3)
    expect(trechos.every((t) => t.texto.length <= 1500)).toBe(true)
    expect(trechos[1].texto.slice(0, 200)).toBe(texto.slice(1300, 1500))
    expect(trechos[2].texto.endsWith(texto.slice(-10))).toBe(true)
  })

  it('prefere cortar em fim de frase quando existe um depois da metade', () => {
    const frase = 'x'.repeat(1000) + '. ' + 'y'.repeat(1000)
    const [primeiro] = cortarEmTrechos([{ pagina: 1, texto: frase }])
    expect(primeiro.texto.endsWith('.')).toBe(true)
  })
})

describe('htmlParaTexto', () => {
  it('tira tags, separa célula e linha, decodifica entidades básicas', () => {
    expect(htmlParaTexto('<p>Valor &amp; prazo</p><table><tr><td>A</td><td>B</td></tr></table>')).toBe(
      'Valor & prazo\nA | B |'
    )
  })
})

describe('hashTexto', () => {
  it('é estável e muda com o conteúdo', () => {
    expect(hashTexto('a')).toBe(hashTexto('a'))
    expect(hashTexto('a')).not.toBe(hashTexto('b'))
  })
})
