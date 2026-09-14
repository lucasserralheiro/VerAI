import { construirGradeDaPagina, detectarTabelaPorBordas, type GradeDeTabela } from './pdfTabelas'
import type { Linha } from './pdfHtml'

function segmento(x1: number, y1: number, x2: number, y2: number) {
  return { x1, y1, x2, y2 }
}

function linha(itens: Array<{ texto: string; x: number; width: number }>, y: number, pagina = 0): Linha {
  return {
    pagina,
    y,
    fontSizeMedio: 10,
    itens: itens.map((i) => ({
      texto: i.texto,
      x: i.x,
      width: i.width,
      negrito: false,
      italico: false,
      sublinhado: false,
    })),
  }
}

describe('construirGradeDaPagina', () => {
  it('monta a grade a partir de linhas horizontais e colunas verticais compridas o bastante', () => {
    const segmentos = [
      segmento(0, 100, 200, 100),
      segmento(0, 80, 200, 80),
      segmento(0, 60, 200, 60),
      segmento(0, 60, 0, 100),
      segmento(100, 60, 100, 100),
      segmento(200, 60, 200, 100),
    ]

    expect(construirGradeDaPagina(segmentos)).toEqual({ y: [100, 80, 60], x: [0, 100, 200] })
  })

  it('junta as duas arestas de uma borda desenhada como retângulo fino numa linha de grade só', () => {
    // O Word exporta borda de tabela como retângulo preenchido de ~2pt: o
    // extrator devolve a aresta de cima E a de baixo. Sem juntar as duas, a
    // grade sai com o dobro de linhas e colunas, cheia de faixas de 2pt onde
    // nenhum texto cai — e a tabela inteira é descartada por parecer vazia.
    const bordaHorizontal = (y: number) => [segmento(0, y, 200, y), segmento(0, y - 2, 200, y - 2)]
    const bordaVertical = (x: number) => [segmento(x, 56, x, 100), segmento(x + 2, 56, x + 2, 100)]
    const segmentos = [
      ...bordaHorizontal(100),
      ...bordaHorizontal(80),
      ...bordaHorizontal(58),
      ...bordaVertical(0),
      ...bordaVertical(100),
      ...bordaVertical(198),
    ]

    const grade = construirGradeDaPagina(segmentos)

    expect(grade?.y).toHaveLength(3)
    expect(grade?.x).toHaveLength(3)
  })

  it('ignora traços curtos demais pra serem borda de tabela', () => {
    const segmentos = [segmento(0, 100, 5, 100), segmento(0, 80, 5, 80), segmento(0, 60, 3, 60)]

    expect(construirGradeDaPagina(segmentos)).toBeNull()
  })

  it('devolve null quando não há pelo menos 2 linhas e 2 colunas', () => {
    expect(construirGradeDaPagina([segmento(0, 100, 200, 100)])).toBeNull()
  })

  it('rejeita grade 1x1 — moldura decorativa em volta de texto corrido, não é tabela de dados', () => {
    // Reproduz o caso real: o PDF desenha uma caixa (só a borda externa, sem
    // nenhuma linha/coluna interna) em volta de um bloco de texto corrido pra
    // destacar uma seção da proposta. Sem essa checagem, o bloco inteiro —
    // que pode ter várias frases e itens de lista — vira uma única célula de
    // uma "tabela" HTML de 1 linha e 1 coluna, perdendo a separação em
    // parágrafos.
    const segmentos = [
      segmento(0, 500, 400, 500), // topo
      segmento(0, 100, 400, 100), // base
      segmento(0, 100, 0, 500), // esquerda
      segmento(400, 100, 400, 500), // direita
    ]

    expect(construirGradeDaPagina(segmentos)).toBeNull()
  })

  it('aceita grade com 1 linha e várias colunas (ou vice-versa) — não exige as duas dimensões', () => {
    // Uma tabela real pode ter só uma linha de dado com várias colunas (ou
    // só uma coluna com várias linhas) — só a caixa 1x1, sem NENHUMA
    // divisória, é que não é tabela.
    const segmentos = [
      segmento(0, 100, 300, 100),
      segmento(0, 80, 300, 80),
      segmento(0, 80, 0, 100),
      segmento(150, 80, 150, 100),
      segmento(300, 80, 300, 100),
    ]

    expect(construirGradeDaPagina(segmentos)).toEqual({ y: [100, 80], x: [0, 150, 300] })
  })
})

describe('detectarTabelaPorBordas', () => {
  const grade: GradeDeTabela = { y: [100, 80, 60], x: [0, 100, 200] }

  it('encaixa o texto nas células da grade e monta a tabela HTML', () => {
    const linhas: Linha[] = [
      linha(
        [
          { texto: 'Item', x: 10, width: 30 },
          { texto: 'Valor', x: 110, width: 30 },
        ],
        90
      ),
      linha(
        [
          { texto: 'Storage', x: 10, width: 40 },
          { texto: 'R$ 100', x: 110, width: 40 },
        ],
        70
      ),
    ]

    const resultado = detectarTabelaPorBordas(linhas, 0, grade)

    expect(resultado?.html).toBe(
      '<table><thead><tr><th>Item</th><th>Valor</th></tr></thead><tbody><tr><td>Storage</td><td>R$ 100</td></tr></tbody></table>'
    )
    expect(resultado?.proximoIndice).toBe(2)
  })

  it('devolve null quando a linha inicial está fora da área vertical da grade', () => {
    const linhas: Linha[] = [linha([{ texto: 'Fora da tabela', x: 10, width: 50 }], 500)]

    expect(detectarTabelaPorBordas(linhas, 0, grade)).toBeNull()
  })

  it('para de consumir linhas ao trocar de página', () => {
    const linhas: Linha[] = [
      linha([{ texto: 'Item', x: 10, width: 30 }], 90, 0),
      linha([{ texto: 'Nova página, fora da tabela', x: 10, width: 100 }], 90, 1),
    ]

    const resultado = detectarTabelaPorBordas(linhas, 0, grade)

    expect(resultado?.proximoIndice).toBe(1)
  })
})

describe('mapeamento de item pra coluna da grade', () => {
  it('mantém na própria coluna o texto que começa logo depois da borda', () => {
    // Caso real do cronograma da proposta: borda de coluna em x=75,7 e o
    // cabeçalho começando em x=77,2. Com as faixas se sobrepondo pela
    // tolerância, esse 1,5pt jogava "A - SISTEMAS DE INFORMAÇÃO" na coluna do
    // "Periodo" e deslocava a linha de cabeçalho inteira uma coluna à esquerda.
    const grade: GradeDeTabela = { y: [700, 670, 660], x: [17.6, 75.7, 169.3] }
    const linhas = [
      linha(
        [
          { texto: 'Periodo', x: 19.4, width: 30 },
          { texto: 'A - SISTEMAS DE INFORMAÇÃO', x: 77.2, width: 80 },
        ],
        675
      ),
      linha(
        [
          { texto: 'out/26', x: 19.4, width: 30 },
          { texto: 'R$ 277.663,04', x: 78.9, width: 80 },
        ],
        665
      ),
    ]

    const tabela = detectarTabelaPorBordas(linhas, 0, grade)

    expect(tabela?.html).toBe(
      '<table><thead><tr><th>Periodo</th><th>A - SISTEMAS DE INFORMAÇÃO</th></tr></thead>' +
        '<tbody><tr><td>out/26</td><td>R$ 277.663,04</td></tr></tbody></table>'
    )
  })

  it('ainda aceita, na faixa mais próxima, o texto que cai um pouco fora da grade', () => {
    // A tolerância continua valendo pra linha de base desenhada logo abaixo da
    // última borda — só deixou de ter prioridade sobre a faixa que contém.
    const grade: GradeDeTabela = { y: [700, 680, 660], x: [0, 100, 200] }
    const linhas = [
      linha([{ texto: 'Cabeçalho', x: 10, width: 40 }, { texto: 'Valor', x: 110, width: 40 }], 690),
      linha([{ texto: 'Dado', x: 10, width: 40 }, { texto: '10', x: 110, width: 20 }], 658.5),
    ]

    const tabela = detectarTabelaPorBordas(linhas, 0, grade)

    expect(tabela?.html).toContain('<td>Dado</td><td>10</td>')
  })
})

