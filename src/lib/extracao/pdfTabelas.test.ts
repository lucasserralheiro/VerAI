import { construirGradeDaPagina, detectarTabelaPorBordas, type GradeDeTabela } from './pdfTabelas'
import type { Linha } from './pdfMarkdown'

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
    // uma "tabela" Markdown de 1 linha e 1 coluna, perdendo a separação em
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

  it('encaixa o texto nas células da grade e monta a tabela Markdown', () => {
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

    expect(resultado?.markdown).toBe('| Item | Valor |\n| --- | --- |\n| Storage | R$ 100 |')
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
