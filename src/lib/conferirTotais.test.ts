import { conferirTotais } from './conferirTotais'

describe('conferirTotais', () => {
  it('acha um total simples que bate com o documento (PDF: origem é a página)', () => {
    const fontes = [{ origem: 'Página 3', pagina: 3, textoOriginal: 'Total Geral: R$ 279.663,46' }]
    const documento = '<table><tr><td>Total Geral</td><td>R$ 279.663,46</td></tr></table>'

    const resultado = conferirTotais(fontes, documento)

    expect(resultado).toEqual([
      {
        origem: 'Página 3',
        pagina: 3,
        rotulo: 'Total Geral',
        valorNoOriginal: 'R$ 279.663,46',
        encontradoNoDocumento: true,
        ocorrenciasNoDocumento: 1,
      },
    ])
  })

  it('acha um total num arquivo sem página (Word: origem é o nome do arquivo, pagina é null)', () => {
    const fontes = [{ origem: 'proposta.docx', pagina: null, textoOriginal: 'Valor Total: R$ 1.234,56' }]
    const documento = '<p>Valor Total: R$ 1.234,56</p>'

    const resultado = conferirTotais(fontes, documento)

    expect(resultado).toEqual([
      {
        origem: 'proposta.docx',
        pagina: null,
        rotulo: 'Valor Total',
        valorNoOriginal: 'R$ 1.234,56',
        encontradoNoDocumento: true,
        ocorrenciasNoDocumento: 1,
      },
    ])
  })

  it('acha o total quando o rótulo vem em negrito no PDF — textoOriginal tem <strong> embutido (formatarTexto/extrairTextoLinha em pdfHtml.ts, rótulo de total é quase sempre destacado no PDF original)', () => {
    const fontes = [{ origem: 'Página 3', pagina: 3, textoOriginal: '<strong>Total Geral</strong>: R$ 279.663,46' }]
    const documento = '<p><strong>Total Geral</strong>: R$ 279.663,46</p>'

    const resultado = conferirTotais(fontes, documento)

    expect(resultado).toEqual([
      {
        origem: 'Página 3',
        pagina: 3,
        rotulo: 'Total Geral',
        valorNoOriginal: 'R$ 279.663,46',
        encontradoNoDocumento: true,
        ocorrenciasNoDocumento: 1,
      },
    ])
  })

  it('marca como não encontrado quando o valor não aparece no documento', () => {
    const fontes = [{ origem: 'Página 1', pagina: 1, textoOriginal: 'Valor Total: R$ 1.234,56' }]
    const documento = '<p>Documento sem esse valor</p>'

    const resultado = conferirTotais(fontes, documento)

    expect(resultado).toEqual([
      {
        origem: 'Página 1',
        pagina: 1,
        rotulo: 'Valor Total',
        valorNoOriginal: 'R$ 1.234,56',
        encontradoNoDocumento: false,
        ocorrenciasNoDocumento: 0,
      },
    ])
  })

  it('dedupe: mesmo rótulo+valor repetido em páginas diferentes conta uma vez, mantendo a primeira ocorrência', () => {
    const fontes = [
      { origem: 'Página 1', pagina: 1, textoOriginal: 'Subtotal: R$ 500,00' },
      { origem: 'Página 5', pagina: 5, textoOriginal: 'Subtotal: R$ 500,00' }, // resumo repetido no fim do documento
    ]
    const documento = '<p>Subtotal: R$ 500,00</p>'

    const resultado = conferirTotais(fontes, documento)

    expect(resultado).toHaveLength(1)
    expect(resultado[0].pagina).toBe(1)
  })

  it('ignora rótulo sem valor monetário (total de páginas, total de itens)', () => {
    const fontes = [{ origem: 'Página 1', pagina: 1, textoOriginal: 'Total de 45 páginas\nTotal de 12 itens' }]

    const resultado = conferirTotais(fontes, 'documento qualquer')

    expect(resultado).toEqual([])
  })

  it('correspondência é exata, não substring — "663,46" não casa dentro de "279.663,46"', () => {
    const fontes = [{ origem: 'Página 1', pagina: 1, textoOriginal: 'Total: R$ 663,46' }]
    const documento = '<p>Valor: R$ 279.663,46</p>' // contém "663,46" como substring, mas não é o mesmo número

    const resultado = conferirTotais(fontes, documento)

    expect(resultado[0].encontradoNoDocumento).toBe(false)
  })

  it('reconhece valor sem símbolo "R$" e com pontos de alinhamento antes do valor', () => {
    const fontes = [{ origem: 'Página 2', pagina: 2, textoOriginal: 'Total Geral ..................... 279.663,46' }]
    const documento = '<td>279.663,46</td>'

    const resultado = conferirTotais(fontes, documento)

    expect(resultado[0]).toMatchObject({ rotulo: 'Total Geral', encontradoNoDocumento: true })
  })

  it('caso real: tabela de cronograma de proposta comercial', () => {
    const fontes = [
      {
        origem: 'Página 4',
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

    const resultado = conferirTotais(fontes, documento)

    expect(resultado).toEqual([
      {
        origem: 'Página 4',
        pagina: 4,
        rotulo: 'Valor Total',
        valorNoOriginal: 'R$ 279.663,46',
        encontradoNoDocumento: true,
        ocorrenciasNoDocumento: 1,
      },
    ])
  })

  it('múltiplos arquivos/páginas com totais diferentes achados TODOS, não só o primeiro', () => {
    const fontes = [
      { origem: 'Página 2', pagina: 2, textoOriginal: 'Subtotal Lote 1: R$ 10.000,00' },
      { origem: 'Página 5', pagina: 5, textoOriginal: 'Subtotal Lote 2: R$ 20.000,00' },
      { origem: 'anexo-precos.docx', pagina: null, textoOriginal: 'Total Geral: R$ 30.000,00' },
    ]
    const documento = [
      '<p>Subtotal Lote 1: R$ 10.000,00</p>',
      '<p>Subtotal Lote 2: R$ 20.000,00</p>',
      '<p>Total Geral: R$ 30.000,00</p>',
    ].join('\n\n')

    const resultado = conferirTotais(fontes, documento)

    expect(resultado).toHaveLength(3)
    expect(resultado.every((t) => t.encontradoNoDocumento)).toBe(true)
  })
})
