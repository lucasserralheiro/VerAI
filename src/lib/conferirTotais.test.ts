import { conferirTotais } from './conferirTotais'

describe('conferirTotais', () => {
  it('acha um total simples que bate com o documento', () => {
    const paginas = [{ pagina: 3, textoOriginal: 'Total Geral: R$ 279.663,46' }]
    const documento = '<table><tr><td>Total Geral</td><td>R$ 279.663,46</td></tr></table>'

    const resultado = conferirTotais(paginas, documento)

    expect(resultado).toEqual([
      { pagina: 3, rotulo: 'Total Geral', valorNoPdf: 'R$ 279.663,46', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 },
    ])
  })

  it('marca como não encontrado quando o valor não aparece no documento', () => {
    const paginas = [{ pagina: 1, textoOriginal: 'Valor Total: R$ 1.234,56' }]
    const documento = '<p>Documento sem esse valor</p>'

    const resultado = conferirTotais(paginas, documento)

    expect(resultado).toEqual([
      { pagina: 1, rotulo: 'Valor Total', valorNoPdf: 'R$ 1.234,56', encontradoNoDocumento: false, ocorrenciasNoDocumento: 0 },
    ])
  })

  it('dedupe: mesmo rótulo+valor repetido em páginas diferentes conta uma vez, mantendo a primeira página', () => {
    const paginas = [
      { pagina: 1, textoOriginal: 'Subtotal: R$ 500,00' },
      { pagina: 5, textoOriginal: 'Subtotal: R$ 500,00' }, // resumo repetido no fim do documento
    ]
    const documento = '<p>Subtotal: R$ 500,00</p>'

    const resultado = conferirTotais(paginas, documento)

    expect(resultado).toHaveLength(1)
    expect(resultado[0].pagina).toBe(1)
  })

  it('ignora rótulo sem valor monetário (total de páginas, total de itens)', () => {
    const paginas = [{ pagina: 1, textoOriginal: 'Total de 45 páginas\nTotal de 12 itens' }]

    const resultado = conferirTotais(paginas, 'documento qualquer')

    expect(resultado).toEqual([])
  })

  it('correspondência é exata, não substring — "663,46" não casa dentro de "279.663,46"', () => {
    const paginas = [{ pagina: 1, textoOriginal: 'Total: R$ 663,46' }]
    const documento = '<p>Valor: R$ 279.663,46</p>' // contém "663,46" como substring, mas não é o mesmo número

    const resultado = conferirTotais(paginas, documento)

    expect(resultado[0].encontradoNoDocumento).toBe(false)
  })

  it('reconhece valor sem símbolo "R$" e com pontos de alinhamento antes do valor', () => {
    const paginas = [{ pagina: 2, textoOriginal: 'Total Geral ..................... 279.663,46' }]
    const documento = '<td>279.663,46</td>'

    const resultado = conferirTotais(paginas, documento)

    expect(resultado[0]).toMatchObject({ rotulo: 'Total Geral', encontradoNoDocumento: true })
  })

  it('caso real: tabela de cronograma de proposta comercial', () => {
    const paginas = [
      {
        pagina: 4,
        textoOriginal: [
          'Item  Descrição            Valor',
          '1     Implantação          R$ 45.000,00',
          '2     Manutenção mensal    R$ 12.500,00',
          '',
          'Valor Total: R$ 279.663,46',
        ].join('\n'),
      },
    ]
    const documento =
      '<table><tbody><tr><td>Implantação</td><td>R$ 45.000,00</td></tr></tbody></table>\n\n<p>Valor Total: R$ 279.663,46</p>'

    const resultado = conferirTotais(paginas, documento)

    expect(resultado).toEqual([
      { pagina: 4, rotulo: 'Valor Total', valorNoPdf: 'R$ 279.663,46', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 },
    ])
  })
})
