import { conferirTotais, conferirTotaisPlanilha, extrairTabelasConferidas } from './conferirTotais'

describe('conferirTotais — fonte com tabela é ignorada (coberta por extrairTabelasConferidas)', () => {
  it('fonte com html contendo <table> não entra na lista achatada', () => {
    const html = '<table><tbody><tr><td>Total Geral</td><td>R$ 279.663,46</td></tr></tbody></table>'
    const fontes = [{ origem: 'Página 1', pagina: 1, textoOriginal: 'texto qualquer', html }]

    const resultado = conferirTotais(fontes, html)

    expect(resultado).toEqual([])
  })

  it('fonte SEM html (ou sem tabela nele) continua usando o texto puro, linha por linha', () => {
    const fontes = [{ origem: 'Página 5', pagina: 5, textoOriginal: 'Valor Total: R$ 279.663,46' }]

    const resultado = conferirTotais(fontes, '<p>Valor Total: R$ 279.663,46</p>')

    expect(resultado).toMatchObject([
      { origem: 'Página 5', pagina: 5, rotulo: 'Valor Total', valorNoOriginal: 'R$ 279.663,46', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 },
    ])
  })
})

describe('extrairTabelasConferidas', () => {
  it('caso real: tabela de preço reconstruída LINHA POR LINHA, célula por célula, mesmo com textoOriginal bagunçado (colunas coladas sem separador)', () => {
    // textoOriginal é EXATAMENTE o tipo de parede de texto que a extração
    // real do PDF produziu quando a tabela não separou colunas — a
    // reconstrução usa só `html` (a mesma tabela, já detectada pelo
    // conversor), nem chega a olhar pro textoOriginal.
    const textoOriginalBagunçado =
      'CÓD.PRODUTOUNIDADEPREÇO LISTA (R$)QUANTPERÍODOTOTAL (R$)10.050.00065.00ANALISTA DE INFORMAÇÃO (COMPLEXIDADE 1)HORA/HOMEMBRL 269,00001.824,0012BRL 490.656,00'
    const html = [
      '<table><thead><tr><th>Código</th><th>Produto</th><th>Unidade</th><th>Preço</th><th>Quant</th><th>Período</th><th>Total</th></tr></thead>',
      '<tbody><tr>',
      '<td>10.050.00065.00</td>',
      '<td>ANALISTA DE INFORMAÇÃO (COMPLEXIDADE 1)</td>',
      '<td>HORA/HOMEM</td>',
      '<td>BRL 269,00</td>',
      '<td>1.824,00</td>',
      '<td>12</td>',
      '<td>BRL 490.656,00</td>',
      '</tr></tbody></table>',
    ].join('')
    const fontes = [{ origem: 'Página 38', pagina: 38, textoOriginal: textoOriginalBagunçado, html }]
    const documento =
      '<table><tr><td>ANALISTA DE INFORMAÇÃO (COMPLEXIDADE 1)</td><td>R$ 269,00</td><td>1.824,00</td><td>R$ 88,88</td></tr></table>' // TOTAL de propósito diferente, pra provar que dá pra ver célula a célula qual bateu

    const resultado = extrairTabelasConferidas(fontes, documento)

    expect(resultado).toMatchObject([
      {
        origem: 'Página 38',
        pagina: 38,
        linhas: [
          [
            { texto: 'Código', ehValor: false },
            { texto: 'Produto', ehValor: false },
            { texto: 'Unidade', ehValor: false },
            { texto: 'Preço', ehValor: false },
            { texto: 'Quant', ehValor: false },
            { texto: 'Período', ehValor: false },
            { texto: 'Total', ehValor: false },
          ],
          [
            { texto: '10.050.00065.00', ehValor: false },
            { texto: 'ANALISTA DE INFORMAÇÃO (COMPLEXIDADE 1)', ehValor: false },
            { texto: 'HORA/HOMEM', ehValor: false },
            { texto: 'BRL 269,00', ehValor: true, encontradoNoDocumento: true },
            { texto: '1.824,00', ehValor: true, encontradoNoDocumento: true },
            { texto: '12', ehValor: false },
            { texto: 'BRL 490.656,00', ehValor: true, encontradoNoDocumento: false },
          ],
        ],
      },
    ])
  })

  it('célula de valor carrega o contexto: a linha inteira "no original" e o trecho "no documento" onde bateu', () => {
    const html =
      '<table><tbody><tr><td>ANALISTA DE INFORMAÇÃO</td><td>HORA/HOMEM</td><td>R$ 269,00</td></tr></tbody></table>'
    const fontes = [{ origem: 'Página 38', pagina: 38, textoOriginal: '', html }]
    const documento = '<p>Descrição do serviço: preço unitário R$ 269,00 por hora.</p>'

    const resultado = extrairTabelasConferidas(fontes, documento)

    const celulaValor = resultado[0].linhas[0][2]
    expect(celulaValor).toMatchObject({
      texto: 'R$ 269,00',
      ehValor: true,
      encontradoNoDocumento: true,
      contextoOriginal: 'ANALISTA DE INFORMAÇÃO | HORA/HOMEM | R$ 269,00',
    })
    expect(celulaValor.contextoNoDocumento).toContain('269,00')
  })

  it('fonte sem <table> no html não vira nenhuma TabelaConferida', () => {
    const fontes = [{ origem: 'Página 5', pagina: 5, textoOriginal: 'Valor Total: R$ 279.663,46' }]

    const resultado = extrairTabelasConferidas(fontes, '<p>Valor Total: R$ 279.663,46</p>')

    expect(resultado).toEqual([])
  })

  it('mais de uma tabela na mesma fonte vira mais de uma TabelaConferida, nunca misturadas', () => {
    const html =
      '<table><tbody><tr><td>Lote 1</td><td>R$ 10,00</td></tr></tbody></table>' +
      '<table><tbody><tr><td>Lote 2</td><td>R$ 20,00</td></tr></tbody></table>'
    const fontes = [{ origem: 'Página 1', pagina: 1, textoOriginal: '', html }]

    const resultado = extrairTabelasConferidas(fontes, '<p>R$ 10,00 e R$ 20,00</p>')

    expect(resultado).toHaveLength(2)
    expect(resultado[0].linhas).toMatchObject([[{ texto: 'Lote 1', ehValor: false }, { texto: 'R$ 10,00', ehValor: true, encontradoNoDocumento: true }]])
    expect(resultado[1].linhas).toMatchObject([[{ texto: 'Lote 2', ehValor: false }, { texto: 'R$ 20,00', ehValor: true, encontradoNoDocumento: true }]])
  })
})

describe('conferirTotais', () => {
  it('zero à esquerda sobrando não impede o match — "015,00" é o mesmo valor que "15,00" no documento', () => {
    // Acontece quando um valor real vem colado a outro sem separador (ex.:
    // coluna de tabela grudada com a próxima) e o "0" sobrando de um match
    // anterior vira prefixo do próximo — ver `normalizarValor`.
    const fontes = [{ origem: 'Página 1', pagina: 1, textoOriginal: 'Quantidade: 015,00' }]
    const documento = '<td>15,00</td>'

    const resultado = conferirTotais(fontes, documento)

    expect(resultado[0].encontradoNoDocumento).toBe(true)
  })

  it('acha valor monetário SEM nenhuma palavra-chave de total no rótulo — pedido explícito: confere todo item de preço, não só o total', () => {
    const fontes = [
      {
        origem: 'Página 12',
        pagina: 12,
        textoOriginal: 'Analista de Informação (Complexidade 1) HORA/HOMEM R$ 490.656,00',
      },
    ]
    const documento = '<p>Analista de Informação (Complexidade 1) HORA/HOMEM R$ 490.656,00</p>'

    const resultado = conferirTotais(fontes, documento)

    expect(resultado).toMatchObject([
      {
        origem: 'Página 12',
        pagina: 12,
        rotulo: 'Analista de Informação (Complexidade 1) HORA/HOMEM',
        valorNoOriginal: 'R$ 490.656,00',
        encontradoNoDocumento: true,
        ocorrenciasNoDocumento: 1,
      },
    ])
  })

  it('acha um total simples que bate com o documento (PDF: origem é a página)', () => {
    const fontes = [{ origem: 'Página 3', pagina: 3, textoOriginal: 'Total Geral: R$ 279.663,46' }]
    const documento = '<table><tr><td>Total Geral</td><td>R$ 279.663,46</td></tr></table>'

    const resultado = conferirTotais(fontes, documento)

    expect(resultado).toMatchObject([
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

    expect(resultado).toMatchObject([
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

    expect(resultado).toMatchObject([
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
        contextoNoDocumento: undefined,
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

  it('caso real: tabela de cronograma — confere CADA valor da linha, não só o total', () => {
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
    const documento = [
      '<table><tbody>',
      '<tr><td>Implantação</td><td>R$ 45.000,00</td></tr>',
      '<tr><td>Manutenção mensal</td><td>R$ 12.500,00</td></tr>',
      '</tbody></table>',
      '<p>Valor Total: R$ 279.663,46</p>',
    ].join('\n\n')

    const resultado = conferirTotais(fontes, documento)

    expect(resultado).toMatchObject([
      { origem: 'Página 4', pagina: 4, rotulo: '1     Implantação', valorNoOriginal: 'R$ 45.000,00', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 },
      { origem: 'Página 4', pagina: 4, rotulo: '2     Manutenção mensal', valorNoOriginal: 'R$ 12.500,00', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 },
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

  it('caso real: várias linhas de tabela saem GRUDADAS numa textoOriginal só (extração do PDF não separou), acha TODOS os totais, não só o primeiro', () => {
    // Reprodução simplificada de uma proposta real: a tabela de preço por
    // seção (A, B, C...) saiu sem quebra de linha entre uma seção e outra.
    const fontes = [
      {
        origem: 'Página 43',
        pagina: 43,
        textoOriginal:
          'A - SISTEMAS DE INFORMAÇÃO TOTAL: R$ 3.626.691,20B - SERVIÇOS DE REDES E CONECTIVIDADES TOTAL: R$ 89.531,95C - SOLUÇÕES DE SERVIÇOS DE COMUNICAÇÃO TOTAL: R$ 1.466.325,75',
      },
    ]
    const documento = [
      '<p>A - SISTEMAS DE INFORMAÇÃO TOTAL: R$ 3.626.691,20</p>',
      '<p>B - SERVIÇOS DE REDES E CONECTIVIDADES TOTAL: R$ 89.531,95</p>',
      '<p>C - SOLUÇÕES DE SERVIÇOS DE COMUNICAÇÃO TOTAL: R$ 1.466.325,75</p>',
    ].join('\n\n')

    const resultado = conferirTotais(fontes, documento)

    expect(resultado.map((t) => t.valorNoOriginal)).toEqual(['R$ 3.626.691,20', 'R$ 89.531,95', 'R$ 1.466.325,75'])
    expect(resultado.every((t) => t.encontradoNoDocumento)).toBe(true)
  })
})

describe('conferirTotaisPlanilha', () => {
  it('acha o valor da célula quando ele aparece IDÊNTICO (formato JS, não BR) no documento', () => {
    // `celulaHtml` (excel.ts) renderiza a célula com `String(valor)` — sem
    // separador de milhar, ponto no lugar de vírgula. É assim que o número
    // aparece no HTML final, não "279.663,46".
    const candidatos = [{ rotulo: 'Total Geral', valor: 279663.46 }]
    const documento = '<table><tr><td>Total Geral</td><td>279663.46</td></tr></table>'

    const resultado = conferirTotaisPlanilha('precos.xlsx', candidatos, documento)

    expect(resultado).toMatchObject([
      {
        origem: 'precos.xlsx',
        pagina: null,
        rotulo: 'Total Geral',
        valorNoOriginal: '279.663,46',
        encontradoNoDocumento: true,
        ocorrenciasNoDocumento: 1,
      },
    ])
  })

  it('marca como não encontrado quando o valor não está no documento', () => {
    const candidatos = [{ rotulo: 'Subtotal', valor: 500 }]

    const resultado = conferirTotaisPlanilha('precos.xlsx', candidatos, '<p>documento sem esse valor</p>')

    expect(resultado[0].encontradoNoDocumento).toBe(false)
  })

  it('correspondência exata — "63.46" não casa dentro de "279663.46"', () => {
    const candidatos = [{ rotulo: 'Total', valor: 63.46 }]
    const documento = '<td>279663.46</td>'

    const resultado = conferirTotaisPlanilha('precos.xlsx', candidatos, documento)

    expect(resultado[0].encontradoNoDocumento).toBe(false)
  })
})
