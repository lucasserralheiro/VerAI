import { extrairSegmentosRetosPorPagina } from './pdfTracos'

// Códigos reais do pdf.js (conferidos com `OPS` de `getResolvedPDFJS()` numa
// instalação real do unpdf) — fixos aqui pro teste não depender do pacote.
var mockOps = {
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
}

jest.mock('unpdf', () => ({
  getResolvedPDFJS: jest.fn(() => Promise.resolve({ OPS: mockOps })),
}))

function pdfFalso(fnArray: number[], argsArray: unknown[]) {
  return {
    getPage: jest.fn().mockResolvedValue({
      getOperatorList: jest.fn().mockResolvedValue({ fnArray, argsArray }),
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

    const [segmentosPagina1] = await extrairSegmentosRetosPorPagina(pdf as never, 1)

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

    const [segmentosPagina1] = await extrairSegmentosRetosPorPagina(pdf as never, 1)

    expect(segmentosPagina1).toEqual([{ x1: 0, y1: 0, x2: 100, y2: 0 }])
  })

  it('descarta segmento diagonal (não é reto horizontal nem vertical)', async () => {
    const caminho = new Float32Array([0, 0, 0, 1, 100, 100])
    const pdf = pdfFalso(
      [mockOps.constructPath],
      [[mockOps.stroke, [caminho], new Float32Array([0, 0, 100, 100])]]
    )

    const [segmentosPagina1] = await extrairSegmentosRetosPorPagina(pdf as never, 1)

    expect(segmentosPagina1).toEqual([])
  })

  it('ignora path preenchido não-fino (não é traço nem barra de sublinhado)', async () => {
    const caminho = new Float32Array([0, 0, 0, 1, 50, 0, 1, 50, 50, 1, 0, 50, 4])
    const pdf = pdfFalso(
      [mockOps.constructPath],
      [[mockOps.fill, [caminho], new Float32Array([0, 0, 50, 50])]]
    )

    const [segmentosPagina1] = await extrairSegmentosRetosPorPagina(pdf as never, 1)

    expect(segmentosPagina1).toEqual([])
  })

  it('trata um path preenchido bem fino (barra de sublinhado desenhada como retângulo) como traço aproveitável', async () => {
    // retângulo fino: moveTo(0,0) lineTo(100,0) lineTo(100,2) lineTo(0,2) closePath
    const caminho = new Float32Array([0, 0, 0, 1, 100, 0, 1, 100, 2, 1, 0, 2, 4])
    const pdf = pdfFalso(
      [mockOps.constructPath],
      [[mockOps.fill, [caminho], new Float32Array([0, 0, 100, 2])]]
    )

    const [segmentosPagina1] = await extrairSegmentosRetosPorPagina(pdf as never, 1)

    expect(segmentosPagina1).toContainEqual({ x1: 0, y1: 0, x2: 100, y2: 0 })
  })
})
