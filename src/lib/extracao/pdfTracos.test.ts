import { extrairSegmentosRetosPorPagina } from './pdfTracos'

// Códigos reais do pdf.js (conferidos com `OPS` de `getResolvedPDFJS()` numa
// instalação real do unpdf) — fixos aqui pro teste não depender do pacote.
const mockOps = {
  save: 10,
  restore: 11,
  transform: 12,
  stroke: 20,
  closeStroke: 21,
  fill: 22,
  eoFill: 23,
  fillStroke: 24,
  eoFillStroke: 25,
  closeFillStroke: 26,
  closeEOFillStroke: 27,
  constructPath: 91,
  paintFormXObjectBegin: 74,
  paintFormXObjectEnd: 75,
  paintImageXObject: 85,
  paintInlineImage: 86,
  paintImageMaskXObject: 87,
}

jest.mock('unpdf', () => ({
  getResolvedPDFJS: jest.fn(() => Promise.resolve({ OPS: mockOps })),
}))

function pdfFalso(fnArray: number[], argsArray: unknown[], view: number[] = [0, 0, 100, 100]) {
  return {
    getPage: jest.fn().mockResolvedValue({
      getOperatorList: jest.fn().mockResolvedValue({ fnArray, argsArray }),
      view,
    }),
  }
}

describe('extrairSegmentosRetosPorPagina', () => {
  it('extrai uma linha horizontal (moveTo + lineTo) já convertida pela matriz de transformação corrente', async () => {
    const caminho = new Float32Array([0, 100, 50, 1, 300, 50]) // moveTo(100,50) lineTo(300,50)
    const pdf = pdfFalso(
      [mockOps.transform, mockOps.constructPath],
      [
        [1, 0, 0, 1, 10, 20], // translada (10, 20)
        [mockOps.stroke, [caminho], new Float32Array([100, 50, 300, 50])],
      ]
    )

    const [{ segmentos: segmentosPagina1 }] = await extrairSegmentosRetosPorPagina(pdf as never, 1)

    expect(segmentosPagina1).toEqual([{ x1: 110, y1: 70, x2: 310, y2: 70 }])
  })

  it('respeita save/restore ao acumular a matriz — transform dentro de save/restore não vaza pro traço seguinte', async () => {
    const caminho = new Float32Array([0, 0, 0, 1, 100, 0])
    const pdf = pdfFalso(
      [mockOps.save, mockOps.transform, mockOps.restore, mockOps.constructPath],
      [
        null,
        [1, 0, 0, 1, 1000, 1000],
        null,
        [mockOps.stroke, [caminho], new Float32Array([0, 0, 100, 0])],
      ]
    )

    const [{ segmentos: segmentosPagina1 }] = await extrairSegmentosRetosPorPagina(pdf as never, 1)

    expect(segmentosPagina1).toEqual([{ x1: 0, y1: 0, x2: 100, y2: 0 }])
  })

  it('descarta segmento diagonal (não é reto horizontal nem vertical)', async () => {
    const caminho = new Float32Array([0, 0, 0, 1, 100, 100])
    const pdf = pdfFalso(
      [mockOps.constructPath],
      [[mockOps.stroke, [caminho], new Float32Array([0, 0, 100, 100])]]
    )

    const [{ segmentos: segmentosPagina1 }] = await extrairSegmentosRetosPorPagina(pdf as never, 1)

    expect(segmentosPagina1).toEqual([])
  })

  it('ignora path preenchido não-fino (não é traço nem barra de sublinhado)', async () => {
    const caminho = new Float32Array([0, 0, 0, 1, 50, 0, 1, 50, 50, 1, 0, 50, 4])
    const pdf = pdfFalso(
      [mockOps.constructPath],
      [[mockOps.fill, [caminho], new Float32Array([0, 0, 50, 50])]]
    )

    const [{ segmentos: segmentosPagina1 }] = await extrairSegmentosRetosPorPagina(pdf as never, 1)

    expect(segmentosPagina1).toEqual([])
  })

  it('trata um path preenchido bem fino (barra de sublinhado desenhada como retângulo) como traço aproveitável', async () => {
    // retângulo fino: moveTo(0,0) lineTo(100,0) lineTo(100,2) lineTo(0,2) closePath
    const caminho = new Float32Array([0, 0, 0, 1, 100, 0, 1, 100, 2, 1, 0, 2, 4])
    const pdf = pdfFalso(
      [mockOps.constructPath],
      [[mockOps.fill, [caminho], new Float32Array([0, 0, 100, 2])]]
    )

    const [{ segmentos: segmentosPagina1 }] = await extrairSegmentosRetosPorPagina(pdf as never, 1)

    expect(segmentosPagina1).toContainEqual({ x1: 0, y1: 0, x2: 100, y2: 0 })
  })

  it('aplica a matriz do Form XObject — traço desenhado dentro de um form sai na posição real da página', async () => {
    const caminho = new Float32Array([0, 0, 0, 1, 200, 0]) // moveTo(0,0) lineTo(200,0)
    const pdf = pdfFalso(
      [mockOps.paintFormXObjectBegin, mockOps.constructPath, mockOps.paintFormXObjectEnd, mockOps.constructPath],
      [
        [[1, 0, 0, 1, 40, 300], null], // o form desloca tudo 40pt à direita e 300pt pra cima
        [mockOps.stroke, [caminho], new Float32Array([0, 0, 200, 0])],
        [],
        [mockOps.stroke, [caminho], new Float32Array([0, 0, 200, 0])],
      ]
    )

    const [{ segmentos }] = await extrairSegmentosRetosPorPagina(pdf as never, 1)

    // O primeiro traço nasce dentro do form (deslocado); o segundo, depois do
    // `End`, volta pra origem — é isso que prova que a pilha foi desempilhada.
    expect(segmentos).toEqual([
      { x1: 40, y1: 300, x2: 240, y2: 300 },
      { x1: 0, y1: 0, x2: 200, y2: 0 },
    ])
  })

  it('calcula a fração de área coberta por imagem numa página com uma imagem de página inteira', async () => {
    const pdf = pdfFalso(
      [mockOps.transform, mockOps.paintImageXObject],
      [
        [100, 0, 0, 100, 0, 0], // escala a imagem (unidade 0..1) pra cobrir toda a página 100x100
        ['img1', 100, 100],
      ]
    )

    const [{ fracaoAreaComImagem }] = await extrairSegmentosRetosPorPagina(pdf as never, 1)

    expect(fracaoAreaComImagem).toBeCloseTo(1)
  })

  it('página só com traço/texto (sem imagem) tem fracaoAreaComImagem zero', async () => {
    const caminho = new Float32Array([0, 0, 0, 1, 100, 0])
    const pdf = pdfFalso([mockOps.constructPath], [[mockOps.stroke, [caminho], new Float32Array([0, 0, 100, 0])]])

    const [{ fracaoAreaComImagem }] = await extrairSegmentosRetosPorPagina(pdf as never, 1)

    expect(fracaoAreaComImagem).toBe(0)
  })
})
