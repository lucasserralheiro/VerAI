jest.mock('unpdf', () => ({
  getDocumentProxy: jest.fn(),
  getResolvedPDFJS: jest.fn(),
}))

import { getResolvedPDFJS } from 'unpdf'
import { extrairImagensDeConteudo, localizarImagensDeConteudo } from './pdfImagens'

/** Códigos arbitrários — o módulo lê os nomes do `OPS` que o pdf.js devolve,
 *  não os números em si. */
const OPS = {
  save: 1,
  restore: 2,
  transform: 3,
  paintFormXObjectBegin: 4,
  paintFormXObjectEnd: 5,
  paintImageXObject: 6,
  outraOperacaoQualquer: 99,
}

const LARGURA_PAGINA = 595
const ALTURA_PAGINA = 842

interface ImagemNaPagina {
  objId: string
  /** Canto inferior esquerdo e tamanho DESENHADO na página, em pontos. */
  x: number
  y: number
  largura: number
  altura: number
  /** Tamanho do bitmap de origem, em pixels. */
  larguraPx?: number
  alturaPx?: number
  /** Envolve o desenho num Form XObject com esta matriz, pra testar se o
   *  módulo compõe a transformação (senão a posição sai errada). */
  matrizDoForm?: [number, number, number, number, number, number]
}

interface PaginaFake {
  imagens: ImagemNaPagina[]
  /** Cada item é um trecho de texto e o Y da linha de base dele. */
  texto?: { str: string; y: number }[]
}

function construirOperatorList(imagens: ImagemNaPagina[]) {
  const fnArray: number[] = []
  const argsArray: unknown[] = []
  const emitir = (fn: number, args: unknown) => {
    fnArray.push(fn)
    argsArray.push(args)
  }

  for (const imagem of imagens) {
    const { x, y, largura, altura, larguraPx = 800, alturaPx = 600 } = imagem
    emitir(OPS.save, [])
    if (imagem.matrizDoForm) {
      emitir(OPS.paintFormXObjectBegin, [imagem.matrizDoForm, null])
    }
    // Toda imagem é desenhada dentro do quadrado unitário transformado.
    emitir(OPS.transform, [largura, 0, 0, altura, x, y])
    emitir(OPS.paintImageXObject, [imagem.objId, larguraPx, alturaPx])
    if (imagem.matrizDoForm) emitir(OPS.paintFormXObjectEnd, [])
    emitir(OPS.restore, [])
  }

  return { fnArray, argsArray }
}

function pdfFake(paginas: PaginaFake[], bitmaps: Record<string, unknown> = {}) {
  return {
    numPages: paginas.length,
    getPage: async (numeroPagina: number) => {
      const pagina = paginas[numeroPagina - 1]
      return {
        view: [0, 0, LARGURA_PAGINA, ALTURA_PAGINA],
        getOperatorList: async () => construirOperatorList(pagina.imagens),
        getTextContent: async () => ({
          items: (pagina.texto ?? []).map((t) => ({ str: t.str, transform: [1, 0, 0, 1, 50, t.y] })),
        }),
        objs: {
          get(objId: string, callback: (objeto: unknown) => void) {
            callback(bitmaps[objId] ?? null)
          },
        },
        commonObjs: {
          get(objId: string, callback: (objeto: unknown) => void) {
            callback(bitmaps[objId] ?? null)
          },
        },
      }
    },
  }
}

/** Bitmap RGB chapado, do tamanho pedido — só pra ter pixel válido pro PNG. */
function bitmapRgb(width: number, height: number) {
  return { width, height, kind: 2, data: new Uint8Array(width * height * 3).fill(200) }
}

/** Bitmap RGB quase todo branco, com só `pixelsComConteudo` pixels pretos —
 *  simula a caixa/moldura vazia real (borda fina, miolo em branco) que virou
 *  bloco de OCR sem solução em produção. */
function bitmapQuaseBranco(width: number, height: number, pixelsComConteudo: number) {
  const data = new Uint8Array(width * height * 3).fill(255)
  for (let i = 0; i < pixelsComConteudo; i++) {
    data[i * 3] = 0
    data[i * 3 + 1] = 0
    data[i * 3 + 2] = 0
  }
  return { width, height, kind: 2, data }
}

/** Parágrafo comum ocupando o miolo da página, pra que as imagens testadas
 *  tenham texto acima e abaixo — a situação de uma figura de verdade. */
const TEXTO_DO_CORPO = [
  { str: 'Linha do topo do corpo', y: 700 },
  { str: 'Linha do meio', y: 400 },
  { str: 'Linha do pé do corpo', y: 120 },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const comoPdf = (fake: ReturnType<typeof pdfFake>) => fake as any

beforeEach(() => {
  ;(getResolvedPDFJS as jest.Mock).mockResolvedValue({ OPS })
})

describe('localizarImagensDeConteudo', () => {
  it('encontra a figura no meio do texto, com posição e nome derivados da página', async () => {
    const pdf = pdfFake([
      {
        texto: TEXTO_DO_CORPO,
        imagens: [{ objId: 'img_1', x: 60, y: 300, largura: 480, altura: 320, larguraPx: 1025, alturaPx: 690 }],
      },
    ])

    const imagens = await localizarImagensDeConteudo(comoPdf(pdf), 1)

    expect(imagens).toHaveLength(1)
    expect(imagens[0]).toMatchObject({
      pagina: 0,
      x: 60,
      y: 300,
      largura: 480,
      altura: 320,
      topo: 620,
      larguraPx: 1025,
      alturaPx: 690,
      nomeArquivo: 'pagina-1-imagem-1.png',
    })
  })

  it('compõe a matriz do Form XObject — senão a figura sai na posição errada', async () => {
    const pdf = pdfFake([
      {
        texto: TEXTO_DO_CORPO,
        imagens: [
          {
            objId: 'img_1',
            x: 0,
            y: 0,
            largura: 480,
            altura: 320,
            // O form desloca tudo 60pt pra direita e 300pt pra cima.
            matrizDoForm: [1, 0, 0, 1, 60, 300],
          },
        ],
      },
    ])

    const [imagem] = await localizarImagensDeConteudo(comoPdf(pdf), 1)

    expect(imagem.x).toBe(60)
    expect(imagem.y).toBe(300)
  })

  it('devolve as imagens na ordem de leitura: por página e, dentro da página, de cima pra baixo', async () => {
    const pdf = pdfFake([
      {
        texto: TEXTO_DO_CORPO,
        imagens: [
          { objId: 'img_baixo', x: 60, y: 150, largura: 400, altura: 200 },
          { objId: 'img_cima', x: 60, y: 450, largura: 400, altura: 200 },
        ],
      },
      { texto: TEXTO_DO_CORPO, imagens: [{ objId: 'img_p2', x: 60, y: 300, largura: 400, altura: 200 }] },
    ])

    const imagens = await localizarImagensDeConteudo(comoPdf(pdf), 2)

    expect(imagens.map((i) => i.nomeArquivo)).toEqual([
      'pagina-1-imagem-1.png',
      'pagina-1-imagem-2.png',
      'pagina-2-imagem-1.png',
    ])
    expect(imagens[0].y).toBe(450)
  })

  describe('descarta o que é moldura da página, não figura do documento', () => {
    it('logo do cabeçalho: no alto da página e sem texto nenhum acima dele', async () => {
      const pdf = pdfFake([
        { texto: TEXTO_DO_CORPO, imagens: [{ objId: 'logo', x: 175, y: 741, largura: 245, altura: 73 }] },
      ])

      expect(await localizarImagensDeConteudo(comoPdf(pdf), 1)).toHaveLength(0)
    })

    it('faixa do rodapé: no pé da página e sem texto nenhum abaixo dela', async () => {
      const pdf = pdfFake([
        { texto: TEXTO_DO_CORPO, imagens: [{ objId: 'rodape', x: 0, y: 0, largura: 595, altura: 65 }] },
      ])

      expect(await localizarImagensDeConteudo(comoPdf(pdf), 1)).toHaveLength(0)
    })

    it('mantém a figura que abre a página quando existe texto acima dela', async () => {
      const pdf = pdfFake([
        {
          texto: [{ str: 'Título da seção', y: 800 }, ...TEXTO_DO_CORPO],
          imagens: [{ objId: 'figura', x: 60, y: 690, largura: 400, altura: 90 }],
        },
      ])

      expect(await localizarImagensDeConteudo(comoPdf(pdf), 1)).toHaveLength(1)
    })

    it('elemento repetido em três páginas, mesmo fora do cabeçalho — o pdf.js troca o objId a cada página', async () => {
      const marcaDagua = (objId: string): ImagemNaPagina => ({
        objId,
        x: 100,
        y: 300,
        largura: 400,
        altura: 300,
        larguraPx: 900,
        alturaPx: 600,
      })
      const pdf = pdfFake([
        { texto: TEXTO_DO_CORPO, imagens: [marcaDagua('img_p0_1')] },
        { texto: TEXTO_DO_CORPO, imagens: [marcaDagua('img_p1_1')] },
        { texto: TEXTO_DO_CORPO, imagens: [marcaDagua('g_d0_img_p2_1')] },
      ])

      expect(await localizarImagensDeConteudo(comoPdf(pdf), 3)).toHaveLength(0)
    })

    it('mantém a figura repetida em duas páginas apenas', async () => {
      const figura = (objId: string): ImagemNaPagina => ({ objId, x: 100, y: 300, largura: 400, altura: 300 })
      const pdf = pdfFake([
        { texto: TEXTO_DO_CORPO, imagens: [figura('img_p0_1')] },
        { texto: TEXTO_DO_CORPO, imagens: [figura('img_p1_1')] },
      ])

      expect(await localizarImagensDeConteudo(comoPdf(pdf), 2)).toHaveLength(2)
    })

    it('ícone, marcador e carimbo de assinatura', async () => {
      const pdf = pdfFake([
        {
          texto: TEXTO_DO_CORPO,
          imagens: [
            { objId: 'carimbo_sei', x: 200, y: 300, largura: 65, altura: 41 },
            { objId: 'icone', x: 60, y: 400, largura: 12, altura: 12 },
          ],
        },
      ])

      expect(await localizarImagensDeConteudo(comoPdf(pdf), 1)).toHaveLength(0)
    })

    it('régua/divisória: faixa muito mais larga que alta', async () => {
      const pdf = pdfFake([
        { texto: TEXTO_DO_CORPO, imagens: [{ objId: 'regua', x: 50, y: 300, largura: 500, altura: 8 }] },
      ])

      expect(await localizarImagensDeConteudo(comoPdf(pdf), 1)).toHaveLength(0)
    })

    it('capa: a arte de fundo e as camadas desenhadas sobre ela', async () => {
      const pdf = pdfFake([
        {
          texto: [
            { str: 'PRODAM-SP — Visão do Negócio v4.3 — Página 1 de 22', y: 800 },
            { str: 'Visão do Negócio — Solução Hospitalar', y: 520 },
            { str: 'Aplicação: +Saúde HSPM — Coordenação: NSS2', y: 500 },
            { str: 'Gestão do Projeto: Conecta Saúde Servidor 360º', y: 480 },
          ],
          imagens: [
            { objId: 'fundo', x: 0, y: 0, largura: 595, altura: 842 },
            { objId: 'degrade', x: 40, y: 200, largura: 300, altura: 250 },
          ],
        },
      ])

      expect(await localizarImagensDeConteudo(comoPdf(pdf), 1)).toHaveLength(0)
    })

    it('mas mantém a imagem de página inteira quando a página quase não tem texto — é página escaneada', async () => {
      const pdf = pdfFake([
        { texto: [{ str: 'pg. 12', y: 20 }], imagens: [{ objId: 'digitalizada', x: 0, y: 0, largura: 595, altura: 842 }] },
      ])

      expect(await localizarImagensDeConteudo(comoPdf(pdf), 1)).toHaveLength(1)
    })
  })
})

describe('extrairImagensDeConteudo', () => {
  it('devolve um PNG válido, com as dimensões do bitmap decodificado', async () => {
    const pdf = pdfFake(
      [{ texto: TEXTO_DO_CORPO, imagens: [{ objId: 'img_1', x: 60, y: 300, largura: 480, altura: 320 }] }],
      { img_1: bitmapRgb(120, 90) }
    )

    const [imagem] = await extrairImagensDeConteudo(comoPdf(pdf), 1)

    expect(imagem.larguraPx).toBe(120)
    expect(imagem.alturaPx).toBe(90)
    expect([...imagem.png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(imagem.png.subarray(12, 16).toString('ascii')).toBe('IHDR')
    expect(imagem.png.readUInt32BE(16)).toBe(120)
    expect(imagem.png.readUInt32BE(20)).toBe(90)
    expect(imagem.png.subarray(imagem.png.length - 8, imagem.png.length - 4).toString('ascii')).toBe('IEND')
  })

  it('ignora a imagem que o pdf.js não entregou, em vez de derrubar a conversão', async () => {
    const pdf = pdfFake([
      {
        texto: TEXTO_DO_CORPO,
        imagens: [
          { objId: 'sem_bitmap', x: 60, y: 500, largura: 480, altura: 200 },
          { objId: 'com_bitmap', x: 60, y: 150, largura: 480, altura: 200 },
        ],
      },
    ])
    // Só a segunda tem bitmap registrado.
    const pdfComUmBitmap = pdfFake(
      [
        {
          texto: TEXTO_DO_CORPO,
          imagens: [
            { objId: 'sem_bitmap', x: 60, y: 500, largura: 480, altura: 200 },
            { objId: 'com_bitmap', x: 60, y: 150, largura: 480, altura: 200 },
          ],
        },
      ],
      { com_bitmap: bitmapRgb(60, 40) }
    )
    expect(await localizarImagensDeConteudo(comoPdf(pdf), 1)).toHaveLength(2)

    const imagens = await extrairImagensDeConteudo(comoPdf(pdfComUmBitmap), 1)

    expect(imagens).toHaveLength(1)
    expect(imagens[0].larguraPx).toBe(60)
  })

  it('descarta o bitmap com menos dados do que as dimensões prometem, em vez de gravar um PNG embaralhado', async () => {
    const pdf = pdfFake(
      [{ texto: TEXTO_DO_CORPO, imagens: [{ objId: 'truncado', x: 60, y: 300, largura: 480, altura: 320 }] }],
      { truncado: { width: 120, height: 90, kind: 2, data: new Uint8Array(100) } }
    )

    expect(await extrairImagensDeConteudo(comoPdf(pdf), 1)).toHaveLength(0)
  })

  it('descarta imagem praticamente toda branca (0,1% de pixels com conteúdo) — evita bloco de OCR sem solução', async () => {
    const pdf = pdfFake(
      [{ texto: TEXTO_DO_CORPO, imagens: [{ objId: 'caixa_vazia', x: 60, y: 300, largura: 480, altura: 320 }] }],
      { caixa_vazia: bitmapQuaseBranco(100, 100, 10) } // 10 de 10.000 = 0,1%
    )

    expect(await extrairImagensDeConteudo(comoPdf(pdf), 1)).toHaveLength(0)
  })

  it('mantém imagem com conteúdo esparso mas acima do limiar (0,6% de pixels com conteúdo)', async () => {
    const pdf = pdfFake(
      [{ texto: TEXTO_DO_CORPO, imagens: [{ objId: 'diagrama_esparso', x: 60, y: 300, largura: 480, altura: 320 }] }],
      { diagrama_esparso: bitmapQuaseBranco(100, 100, 60) } // 60 de 10.000 = 0,6%
    )

    expect(await extrairImagensDeConteudo(comoPdf(pdf), 1)).toHaveLength(1)
  })
})
