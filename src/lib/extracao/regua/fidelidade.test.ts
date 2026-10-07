import { conferirTextoDoOriginal, medirFidelidade, numeros, palavras, textoVisivelDoHtml } from './fidelidade'

const pagina = (textoOriginal: string, html: string) => [{ textoOriginal, html }]

describe('medirFidelidade', () => {
  it('HTML com o mesmo texto do PDF não acusa nada', () => {
    const f = medirFidelidade(pagina('Valor total do contrato\nR$ 1.200,00', '<p>Valor total do contrato</p>\n\n<p><strong>R$ 1.200,00</strong></p>'))
    expect(f).toMatchObject({ palavrasPerdidas: 0, palavrasSobrando: 0, palavrasForaDeOrdem: 0, numerosPerdidos: 0, numerosSobrando: 0, ordemMedida: true })
    expect(f.numerosNoPdf).toBe(1)
  })

  it('valor que some do HTML é número perdido, com exemplo', () => {
    const f = medirFidelidade(pagina('Total R$ 1.200,00', '<p>Total R$</p>'))
    expect(f.numerosPerdidos).toBe(1)
    expect(f.exemploNumerosPerdidos).toEqual(['1.200,00'])
  })

  it('valor que aparece do nada (duplicado na quebra de página) é número a mais', () => {
    const f = medirFidelidade(pagina('Subtotal 500,00', '<p>Subtotal 500,00</p><p>500,00</p>'))
    expect(f.numerosSobrando).toBe(1)
    expect(f.exemploNumerosSobrando).toEqual(['500,00'])
  })

  it('mesmas palavras em outra posição contam como fora de ordem, não como perdidas', () => {
    const f = medirFidelidade(pagina('um dois três quatro', '<p>três quatro um dois</p>'))
    expect(f.palavrasPerdidas).toBe(0)
    expect(f.palavrasSobrando).toBe(0)
    expect(f.palavrasForaDeOrdem).toBe(2)
  })

  it('marcador de lista, entidade e pontuação das pontas não viram diferença', () => {
    const f = medirFidelidade(pagina('• Item A & B.', '<ul><li>Item A &amp; B.</li></ul>'))
    expect(f.palavrasPerdidas + f.palavrasSobrando).toBe(0)
  })

  it('valor grudado na moeda no PDF e separado em célula no HTML é o mesmo número', () => {
    const f = medirFidelidade(pagina('BRL269,00', '<table><tr><td>BRL</td><td>269,00</td></tr></table>'))
    expect(f.numerosPerdidos + f.numerosSobrando).toBe(0)
  })
})

describe('peças', () => {
  it('textoVisivelDoHtml tira tag e imagem e resolve entidade', () => {
    expect(textoVisivelDoHtml('<p>A&nbsp;&lt;b&gt;<img src="x.png" alt="Imagem da página 1"></p>')).toBe('A <b>')
  })

  it('palavras descarta token só de pontuação', () => {
    expect(palavras('— Item 1) • (2,50)')).toEqual(['Item', '1', '2,50'])
  })

  it('números inteiros: código de serviço, data e valor contam como um cada', () => {
    expect(numeros('12.074.00005.00 em 01/02/2024 por R$ 1.234,56.')).toEqual(['12.074.00005.00', '01/02/2024', '1.234,56'])
  })
})

describe('conferirTextoDoOriginal', () => {
  const fonte = (pagina: number, textoOriginal: string) => ({ origem: `Página ${pagina}`, pagina, textoOriginal })

  it('valor que aparecia 3 vezes e ficou 2 é acusado, na ocorrência que sumiu', () => {
    const r = conferirTextoDoOriginal(
      [fonte(1, 'Item 1 100,00'), fonte(2, 'Item 2 100,00'), fonte(3, 'Item 3 100,00')],
      '<p>Item 1 100,00</p><p>Item 2</p><p>Item 3 100,00</p>',
      { compararSobra: false }
    )
    expect(r.quantidadeNumerosPerdidos).toBe(1)
    expect(r.numerosPerdidos).toEqual([{ numero: '100,00', origem: 'Página 2', pagina: 2, contexto: 'Item 2 100,00' }])
  })

  it('negrito do texto original não atrapalha', () => {
    const r = conferirTextoDoOriginal([fonte(1, '<strong>Total</strong> 1.500,00')], '<p><strong>Total</strong> 1.500,00</p>', {
      compararSobra: true,
    })
    expect(r).toMatchObject({ numerosNoOriginal: 1, quantidadeNumerosPerdidos: 0, quantidadeNumerosSobrando: 0, palavrasPerdidas: 0 })
  })

  it('número a mais só entra quando pedido (fonte única)', () => {
    const fontes = [fonte(1, 'Total 10,00')]
    const documento = '<p>Total 10,00</p><p>10,00</p>'
    expect(conferirTextoDoOriginal(fontes, documento, { compararSobra: true }).numerosSobrando).toEqual(['10,00'])
    expect(conferirTextoDoOriginal(fontes, documento, { compararSobra: false }).quantidadeNumerosSobrando).toBe(0)
  })
})
