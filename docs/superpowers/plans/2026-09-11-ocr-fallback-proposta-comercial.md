# OCR de fallback (Etapa 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando um PDF da Proposta Comercial tem página escaneada (sem camada de texto), rodar OCR local (tesseract.js, no navegador) em vez de falhar ou descartar a imagem em silêncio — com conferência humana obrigatória antes de a proposta poder ser finalizada.

**Architecture:** Detecção de página-imagem entra na extração determinística já existente (`pdfMarkdown.ts`/`pdfTracos.ts`), sem custo pra PDF normal. O estado "pendente de OCR" vive dentro do próprio `conteudoMarkdown`, como um marcador de texto (`:::ocr-pendente[...]`) — sem coluna nova no banco. Um componente cliente novo (`ocr-runner.tsx`) baixa o PDF original, renderiza a página em canvas via `pdf.js` (já embutido no `unpdf`) e reconhece o texto via `tesseract.js`, carregados só sob demanda (`import()` dinâmico). A proposta só pode virar `concluido` quando não sobra nenhum marcador.

**Tech Stack:** Next.js (App Router), Prisma, `unpdf` (pdf.js), `tesseract.js` (novo), Jest + Testing Library.

## Global Constraints

- Zero infraestrutura nova de servidor — sem OCR/rasterização no servidor, sem fila, sem status novo no banco, sem coluna nova (restrição real: Vercel Hobby, 60s por função). Fonte: `docs/superpowers/specs/2026-08-31-ocr-fallback-proposta-comercial-design.md`.
- OCR roda **inteiramente no navegador** — nenhuma imagem de página sai da máquina do usuário. `tesseract.js` só é importado dinamicamente dentro do runner, nunca no carregamento normal do editor.
- OCR nunca roda sozinho — sempre atrás de um botão ("Rodar OCR"), com conferência lado a lado obrigatória antes do texto contar como definitivo.
- PDF normal (com camada de texto) não muda de comportamento nem de velocidade — a detecção é "de carona" na extração que já roda.
- Toda função nova é pura sempre que possível (`marcadorOcrPendente.ts`, `rodarOcr.ts`) — dependências externas (fetch, tesseract, pdf.js) entram por injeção, nunca hard-coded, pra manter testável sem DOM/worker real.

---

### Task 1: Cobertura de imagem por página em `pdfTracos.ts`

**Files:**
- Modify: `src/lib/extracao/pdfTracos.ts`
- Modify: `src/lib/extracao/pdfMarkdown.ts:198-213` (só ajusta a chamada pra continuar compilando — nenhuma detecção nova ainda)
- Test: `src/lib/extracao/pdfTracos.test.ts`
- Test: `src/lib/extracao/pdfMarkdown.test.ts` (ajusta só o mock, sem novo caso)

**Interfaces:**
- Produces: `export interface PaginaComTracos { segmentos: SegmentoReto[]; fracaoAreaComImagem: number }` e `extrairSegmentosRetosPorPagina(pdf, totalPaginas): Promise<PaginaComTracos[]>` (era `Promise<SegmentoReto[][]>`).

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/extracao/pdfTracos.test.ts`, atualizar o helper `pdfFalso` pra aceitar `view` (dimensão da página) e adicionar os códigos de operação de imagem ao `mockOps`:

```ts
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
```

```ts
function pdfFalso(fnArray: number[], argsArray: unknown[], view: number[] = [0, 0, 100, 100]) {
  return {
    getPage: jest.fn().mockResolvedValue({
      getOperatorList: jest.fn().mockResolvedValue({ fnArray, argsArray }),
      view,
    }),
  }
}
```

Trocar as 6 desestruturações existentes de `const [segmentosPagina1] = ...` para `const [{ segmentos: segmentosPagina1 }] = ...`, e a de `const [segmentos] = ...` (teste do Form XObject) para `const [{ segmentos }] = ...` — mesma lista de asserts, só o acesso muda.

Adicionar dois casos novos no fim do `describe`:

```ts
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
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- pdfTracos.test.ts`
Expected: FAIL — `fracaoAreaComImagem` undefined / destructuring quebrado, já que `pdfTracos.ts` ainda não mudou.

- [ ] **Step 3: Implementar em `pdfTracos.ts`**

Adicionar a interface exportada e trocar `extrairSegmentosDaPagina`/`extrairSegmentosRetosPorPagina`:

```ts
/** Segmentos retos de uma página + a fração da área dela coberta por imagem —
 *  matéria-prima pra sublinhado/tabela (segmentos) e pra detectar página
 *  escaneada (cobertura de imagem), sem uma segunda passada pela página. */
export interface PaginaComTracos {
  segmentos: SegmentoReto[]
  /** Área somada de paintImageXObject/paintInlineImage/paintImageMaskXObject
   *  dividida pela área da página. Pode passar de 1 se imagens se sobrepõem —
   *  não é limitado, quem decide o que fazer com isso é quem consome. */
  fracaoAreaComImagem: number
}

export async function extrairSegmentosRetosPorPagina(
  pdf: PdfDocumento,
  totalPaginas: number
): Promise<PaginaComTracos[]> {
  const pdfjs = await getResolvedPDFJS()
  const OPS = pdfjs.OPS
  const operacoesComTraco = new Set([
    OPS.stroke,
    OPS.closeStroke,
    OPS.fillStroke,
    OPS.eoFillStroke,
    OPS.closeFillStroke,
    OPS.closeEOFillStroke,
  ])

  const resultado: PaginaComTracos[] = []
  for (let numeroPagina = 1; numeroPagina <= totalPaginas; numeroPagina++) {
    const pagina = await pdf.getPage(numeroPagina)
    const operatorList = (await pagina.getOperatorList()) as {
      fnArray: number[]
      argsArray: unknown[]
    }
    const [, , larguraPagina, alturaPagina] = pagina.view as number[]
    resultado.push(extrairSegmentosDaPagina(operatorList, OPS, operacoesComTraco, larguraPagina, alturaPagina))
  }

  return resultado
}

/** Retângulo (largura x altura) ocupado por uma imagem desenhada dentro do
 *  quadrado unitário (0,0)-(1,1) transformado pela matriz corrente — mesmo
 *  cálculo de `pdfImagens.ts`, duplicado aqui de propósito (módulo pequeno,
 *  sem import cruzado) só pra medir área, não posição. */
function retanguloDaImagem(matriz: Matriz): { largura: number; altura: number } {
  const cantos = [aplicar(matriz, 0, 0), aplicar(matriz, 1, 0), aplicar(matriz, 0, 1), aplicar(matriz, 1, 1)]
  const xs = cantos.map((c) => c[0])
  const ys = cantos.map((c) => c[1])
  return { largura: Math.max(...xs) - Math.min(...xs), altura: Math.max(...ys) - Math.min(...ys) }
}

function extrairSegmentosDaPagina(
  operatorList: { fnArray: number[]; argsArray: unknown[] },
  OPS: Record<string, number>,
  operacoesComTraco: Set<number>,
  larguraPagina: number,
  alturaPagina: number
): PaginaComTracos {
  const segmentos: SegmentoReto[] = []
  const pilha: Matriz[] = []
  let atual: Matriz = IDENTIDADE
  let areaComImagem = 0
  const operacoesDeImagem = new Set([OPS.paintImageXObject, OPS.paintInlineImage, OPS.paintImageMaskXObject])

  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const fn = operatorList.fnArray[i]

    if (fn === OPS.save) {
      pilha.push(atual)
    } else if (fn === OPS.restore) {
      atual = pilha.pop() ?? IDENTIDADE
    } else if (fn === OPS.transform) {
      const matrizAplicada = operatorList.argsArray[i] as Matriz
      atual = multiplicar(atual, matrizAplicada)
    } else if (fn === OPS.paintFormXObjectBegin) {
      pilha.push(atual)
      const [matrizDoForm] = operatorList.argsArray[i] as [Matriz | null, unknown]
      if (matrizDoForm) atual = multiplicar(atual, matrizDoForm)
    } else if (fn === OPS.paintFormXObjectEnd) {
      atual = pilha.pop() ?? IDENTIDADE
    } else if (fn === OPS.constructPath) {
      const [tipoPintura, buffers, minMax] = operatorList.argsArray[i] as [
        number,
        [Float32Array | null],
        Float32Array | null,
      ]
      const desenhaTraco = operacoesComTraco.has(tipoPintura)
      const ehPreenchimentoFino =
        !desenhaTraco &&
        minMax !== null &&
        Math.min(minMax[2] - minMax[0], minMax[3] - minMax[1]) <= DIMENSAO_MAX_PREENCHIMENTO_FINO
      if ((desenhaTraco || ehPreenchimentoFino) && buffers[0]) {
        segmentos.push(...decodificarCaminho(buffers[0], atual))
      }
    } else if (operacoesDeImagem.has(fn)) {
      const { largura, altura } = retanguloDaImagem(atual)
      areaComImagem += Math.abs(largura * altura)
    }
  }

  const areaPagina = larguraPagina * alturaPagina
  const fracaoAreaComImagem = areaPagina > 0 ? areaComImagem / areaPagina : 0
  return { segmentos, fracaoAreaComImagem }
}
```

Em `src/lib/extracao/pdfMarkdown.ts`, ajustar só a leitura do retorno (comportamento idêntico ao de hoje — a detecção de página-imagem entra na Task 3):

```ts
  const segmentosPorPagina = await extrairSegmentosRetosPorPagina(pdf, totalPages)
```
continua igual, mas as duas leituras abaixo mudam de `segmentos` pra `.segmentos`:

```ts
  segmentosPorPagina.forEach(({ segmentos }, pagina) => {
    const grade = construirGradeDaPagina(segmentos)
    if (grade) gradesPorPagina.set(pagina, grade)
  })

  const todasAsLinhas: Linha[] = []
  items.forEach((itensDaPagina, pagina) => {
    const segmentos = segmentosPorPagina[pagina]?.segmentos ?? []
    const paraSublinhado = segmentosSemBordaDeTabela(segmentos, gradesPorPagina.get(pagina))
    todasAsLinhas.push(...agruparEmLinhas(itensDaPagina, pagina, paraSublinhado))
  })
```

Em `src/lib/extracao/pdfMarkdown.test.ts`, o `beforeEach` mocka `extrairSegmentosRetosPorPagina` — trocar a única linha:

```ts
  beforeEach(() => {
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([{ segmentos: [], fracaoAreaComImagem: 0 }])
  })
```

E as 3 outras ocorrências de `mockResolvedValue([[]])` no mesmo arquivo (linhas ~443, ~540, ~643 antes da mudança) para `mockResolvedValue([{ segmentos: [], fracaoAreaComImagem: 0 }])`, e as que passam segmentos reais (linhas ~263, ~275, ~424, ~729) envolvendo o array de segmentos em `{ segmentos: [...], fracaoAreaComImagem: 0 }`. Exemplo (linha ~263):

```ts
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([
      { segmentos: [{ x1: 0, y1: 98, x2: 120, y2: 98 }], fracaoAreaComImagem: 0 },
    ])
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- pdfTracos.test.ts pdfMarkdown.test.ts`
Expected: PASS em ambos os arquivos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/extracao/pdfTracos.ts src/lib/extracao/pdfTracos.test.ts src/lib/extracao/pdfMarkdown.ts src/lib/extracao/pdfMarkdown.test.ts
git commit -m "feat: calcula cobertura de imagem por pagina do PDF"
```

---

### Task 2: `marcadorOcrPendente.ts` — formato do marcador `:::ocr-pendente`

**Files:**
- Create: `src/lib/ocr/marcadorOcrPendente.ts`
- Test: `src/lib/ocr/marcadorOcrPendente.test.ts`

**Interfaces:**
- Produces:
  - `interface BlocoOcrPendente { blocoCompleto: string; arquivoId: string | null; pagina: number; corpo: string }`
  - `formatarBlocoOcrPendente(pagina: number, arquivoId?: string | null, corpo?: string): string`
  - `listarBlocosOcrPendente(markdown: string): BlocoOcrPendente[]`
  - `reescreverComArquivoId(markdown: string, arquivoId: string): string`
  - `substituirCorpo(markdown: string, bloco: BlocoOcrPendente, novoCorpo: string): string`
  - `removerWrapper(markdown: string, bloco: BlocoOcrPendente, textoFinal: string): string`
  - `temBlocoOcrPendente(markdown: string): boolean`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/lib/ocr/marcadorOcrPendente.test.ts
import {
  formatarBlocoOcrPendente,
  listarBlocosOcrPendente,
  reescreverComArquivoId,
  substituirCorpo,
  removerWrapper,
  temBlocoOcrPendente,
} from './marcadorOcrPendente'

describe('formatarBlocoOcrPendente', () => {
  it('sem arquivoId gera só [pagina=N]', () => {
    expect(formatarBlocoOcrPendente(3)).toBe(':::ocr-pendente[pagina=3]\n_(aguardando OCR)_\n:::')
  })

  it('com arquivoId gera [arquivoId=... pagina=N]', () => {
    expect(formatarBlocoOcrPendente(3, 'arq1')).toBe(':::ocr-pendente[arquivoId=arq1 pagina=3]\n_(aguardando OCR)_\n:::')
  })

  it('aceita corpo customizado', () => {
    expect(formatarBlocoOcrPendente(1, 'arq1', 'texto reconhecido')).toBe(
      ':::ocr-pendente[arquivoId=arq1 pagina=1]\ntexto reconhecido\n:::'
    )
  })
})

describe('listarBlocosOcrPendente', () => {
  it('encontra um bloco no meio do texto e extrai arquivoId/pagina/corpo', () => {
    const markdown = 'Antes.\n\n:::ocr-pendente[arquivoId=arq1 pagina=2]\n_(aguardando OCR)_\n:::\n\nDepois.'

    const blocos = listarBlocosOcrPendente(markdown)

    expect(blocos).toEqual([
      {
        blocoCompleto: ':::ocr-pendente[arquivoId=arq1 pagina=2]\n_(aguardando OCR)_\n:::',
        arquivoId: 'arq1',
        pagina: 2,
        corpo: '_(aguardando OCR)_',
      },
    ])
  })

  it('encontra vários blocos, em ordem', () => {
    const markdown = ':::ocr-pendente[pagina=1]\nA\n:::\n\ntexto\n\n:::ocr-pendente[pagina=2]\nB\n:::'

    expect(listarBlocosOcrPendente(markdown).map((b) => b.pagina)).toEqual([1, 2])
  })

  it('sem bloco nenhum devolve lista vazia', () => {
    expect(listarBlocosOcrPendente('texto qualquer sem marcador')).toEqual([])
  })

  it('arquivoId ausente vira null', () => {
    const markdown = ':::ocr-pendente[pagina=5]\ncorpo\n:::'

    expect(listarBlocosOcrPendente(markdown)[0].arquivoId).toBeNull()
  })
})

describe('reescreverComArquivoId', () => {
  it('adiciona arquivoId a todos os blocos sem ele', () => {
    const markdown = ':::ocr-pendente[pagina=1]\nA\n:::\n\n:::ocr-pendente[pagina=2]\nB\n:::'

    const resultado = reescreverComArquivoId(markdown, 'arq9')

    expect(resultado).toBe(':::ocr-pendente[arquivoId=arq9 pagina=1]\nA\n:::\n\n:::ocr-pendente[arquivoId=arq9 pagina=2]\nB\n:::')
  })

  it('texto sem marcador não muda', () => {
    expect(reescreverComArquivoId('texto normal', 'arq9')).toBe('texto normal')
  })
})

describe('substituirCorpo', () => {
  it('troca só o corpo, mantendo o wrapper e o arquivoId', () => {
    const markdown = 'X\n\n:::ocr-pendente[arquivoId=arq1 pagina=2]\n_(aguardando OCR)_\n:::\n\nY'
    const bloco = listarBlocosOcrPendente(markdown)[0]

    const resultado = substituirCorpo(markdown, bloco, 'Texto reconhecido pelo OCR.')

    expect(resultado).toBe('X\n\n:::ocr-pendente[arquivoId=arq1 pagina=2]\nTexto reconhecido pelo OCR.\n:::\n\nY')
  })
})

describe('removerWrapper', () => {
  it('substitui o bloco inteiro pelo texto final, sem sobrar marcador', () => {
    const markdown = 'X\n\n:::ocr-pendente[arquivoId=arq1 pagina=2]\nTexto reconhecido.\n:::\n\nY'
    const bloco = listarBlocosOcrPendente(markdown)[0]

    const resultado = removerWrapper(markdown, bloco, 'Texto reconhecido e conferido.')

    expect(resultado).toBe('X\n\nTexto reconhecido e conferido.\n\nY')
    expect(temBlocoOcrPendente(resultado)).toBe(false)
  })
})

describe('temBlocoOcrPendente', () => {
  it('true quando existe marcador', () => {
    expect(temBlocoOcrPendente(':::ocr-pendente[pagina=1]\nA\n:::')).toBe(true)
  })

  it('false em texto normal', () => {
    expect(temBlocoOcrPendente('texto qualquer')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- marcadorOcrPendente.test.ts`
Expected: FAIL — `Cannot find module './marcadorOcrPendente'`.

- [ ] **Step 3: Implementar**

```ts
// src/lib/ocr/marcadorOcrPendente.ts

/**
 * Formato e manipulação do marcador `:::ocr-pendente[...]` — é ele que carrega
 * todo o estado de "essa página ainda não foi conferida", direto no texto do
 * `conteudoMarkdown`, sem coluna nova no banco (ver
 * docs/superpowers/specs/2026-08-31-ocr-fallback-proposta-comercial-design.md,
 * seção 2).
 */

export interface BlocoOcrPendente {
  /** Trecho exato do markdown, do "::: ocr-pendente[...]" ao ":::" de
   *  fechamento — chave pra localizar/substituir esse bloco específico. */
  blocoCompleto: string
  arquivoId: string | null
  pagina: number
  corpo: string
}

const REGEX_BLOCO = /:::ocr-pendente\[([^\]]*)\]\n([\s\S]*?)\n:::/g

function montarAtributos(pagina: number, arquivoId?: string | null): string {
  return arquivoId ? `arquivoId=${arquivoId} pagina=${pagina}` : `pagina=${pagina}`
}

export function formatarBlocoOcrPendente(pagina: number, arquivoId?: string | null, corpo = '_(aguardando OCR)_'): string {
  return `:::ocr-pendente[${montarAtributos(pagina, arquivoId)}]\n${corpo}\n:::`
}

export function listarBlocosOcrPendente(markdown: string): BlocoOcrPendente[] {
  const blocos: BlocoOcrPendente[] = []
  for (const m of markdown.matchAll(REGEX_BLOCO)) {
    const atributos = m[1]
    const arquivoId = /arquivoId=(\S+)/.exec(atributos)?.[1] ?? null
    const pagina = Number(/pagina=(\d+)/.exec(atributos)?.[1] ?? '0')
    blocos.push({ blocoCompleto: m[0], arquivoId, pagina, corpo: m[2] })
  }
  return blocos
}

/** Usado pelo `POST /api/propostas-comerciais` — o conversor só sabe o número
 *  da página, não o `arquivoId` (ainda não existe no banco nesse ponto). */
export function reescreverComArquivoId(markdown: string, arquivoId: string): string {
  return markdown.replace(/:::ocr-pendente\[pagina=(\d+)\]/g, `:::ocr-pendente[arquivoId=${arquivoId} pagina=$1]`)
}

/** Troca só o CORPO do bloco (ex.: preenche com o texto reconhecido no lugar
 *  de "_(aguardando OCR)_"), mantendo o wrapper — a página continua pendente
 *  de conferência humana até `removerWrapper`. */
export function substituirCorpo(markdown: string, bloco: BlocoOcrPendente, novoCorpo: string): string {
  return markdown.replace(bloco.blocoCompleto, formatarBlocoOcrPendente(bloco.pagina, bloco.arquivoId, novoCorpo))
}

/** Conferência: some com o wrapper, fica só o texto — é isso que faz a
 *  página parar de contar como pendente. */
export function removerWrapper(markdown: string, bloco: BlocoOcrPendente, textoFinal: string): string {
  return markdown.replace(bloco.blocoCompleto, textoFinal)
}

export function temBlocoOcrPendente(markdown: string): boolean {
  return /:::ocr-pendente/.test(markdown)
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- marcadorOcrPendente.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ocr/marcadorOcrPendente.ts src/lib/ocr/marcadorOcrPendente.test.ts
git commit -m "feat: formato e parsing do marcador ocr-pendente"
```

---

### Task 3: Detecção de página-imagem e inserção do marcador em `pdfMarkdown.ts`

**Files:**
- Modify: `src/lib/extracao/pdfMarkdown.ts`
- Test: `src/lib/extracao/pdfMarkdown.test.ts`

**Interfaces:**
- Consumes: `PaginaComTracos` (Task 1), `formatarBlocoOcrPendente` (Task 2).
- Produces: `converterPdfParaMarkdown(buffer, opcoes?): Promise<{ markdown: string; paginasImagem: number[] }>` (era `Promise<string>`). `paginasImagem` é 1-indexado.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar em `src/lib/extracao/pdfMarkdown.test.ts` (novo `describe`, no fim do arquivo):

```ts
describe('detecção de página-imagem (fallback de OCR)', () => {
  it('página sem texto e imagem cobrindo quase tudo entra como :::ocr-pendente na posição certa', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 2,
      items: [
        [item({ str: 'Texto normal da página 1.', x: 0, hasEOL: true })],
        [], // página 2: escaneada, pdf.js não extrai texto nenhum
      ],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([
      { segmentos: [], fracaoAreaComImagem: 0 },
      { segmentos: [], fracaoAreaComImagem: 0.9 },
    ])

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado.paginasImagem).toEqual([2])
    expect(resultado.markdown).toBe('Texto normal da página 1.\n\n:::ocr-pendente[pagina=2]\n_(aguardando OCR)_\n:::')
  })

  it('página com texto normal não entra em paginasImagem', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Texto normal, bastante longo pra passar do limiar de caracteres.', x: 0, hasEOL: true })]],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([{ segmentos: [], fracaoAreaComImagem: 0.9 }])

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado.paginasImagem).toEqual([])
  })

  it('texto ralo (abaixo do limiar) sem imagem grande não é marcado', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Pouco texto', x: 0, hasEOL: true })]],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([{ segmentos: [], fracaoAreaComImagem: 0.1 }])

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado.paginasImagem).toEqual([])
  })

  it('PDF 100% imagem não devolve markdown vazio — devolve um marcador por página', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 2,
      items: [[], []],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([
      { segmentos: [], fracaoAreaComImagem: 1 },
      { segmentos: [], fracaoAreaComImagem: 1 },
    ])

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado.markdown).toBe(
      ':::ocr-pendente[pagina=1]\n_(aguardando OCR)_\n:::\n\n:::ocr-pendente[pagina=2]\n_(aguardando OCR)_\n:::'
    )
    expect(resultado.paginasImagem).toEqual([1, 2])
  })
})
```

Ajustar todos os testes já existentes no arquivo que hoje fazem `const resultado = await converterPdfParaMarkdown(...)` e depois `expect(resultado).toBe(...)` / `expect(resultado).toContain(...)` para `expect(resultado.markdown).toBe(...)` / `.toContain(...)` — é a mesma mudança mecânica em cada um dos ~17 casos (a asserção some de `resultado` direto pra `resultado.markdown`).

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- pdfMarkdown.test.ts`
Expected: FAIL — `resultado.paginasImagem` undefined, `resultado.markdown` undefined (a função ainda devolve `string` direto).

- [ ] **Step 3: Implementar**

No topo do arquivo, junto das outras constantes medidas (perto de `LIMIAR_TAMANHO_TITULO`):

```ts
/** Abaixo desse tanto de caractere extraído na página, "não tem texto de
 *  verdade ali" — candidata a página escaneada. Valor do design aprovado em
 *  2026-08-31 (não medido neste projeto; ajustar com cautela). */
const LIMIAR_CHARS_PAGINA_IMAGEM = 50

/** Acima dessa fração de área da página coberta por imagem — combinado com
 *  pouco texto acima — a página é tratada como escaneada. */
const LIMIAR_COBERTURA_IMAGEM = 0.4
```

Import novo no topo:

```ts
import { formatarBlocoOcrPendente } from '../ocr/marcadorOcrPendente'
```

Mudar a assinatura pública:

```ts
export interface ResultadoConversaoPdf {
  markdown: string
  /** Páginas (1-indexadas) sem camada de texto reconhecível — candidatas a
   *  OCR. Vazio pra qualquer PDF com texto normal. */
  paginasImagem: number[]
}

export async function converterPdfParaMarkdown(
  buffer: Buffer,
  opcoes: OpcoesConversaoPdf = {}
): Promise<ResultadoConversaoPdf> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { items, totalPages } = await extractTextItems(pdf)
  const segmentosPorPagina = await extrairSegmentosRetosPorPagina(pdf, totalPages)
  const imagens = await prepararImagens(pdf, totalPages, opcoes.salvarImagem)

  const paginasImagem0 = new Set<number>()
  for (let pagina = 0; pagina < totalPages; pagina++) {
    const caracteresDaPagina = (items[pagina] ?? []).reduce((soma, item) => soma + (item.str?.length ?? 0), 0)
    const cobertura = segmentosPorPagina[pagina]?.fracaoAreaComImagem ?? 0
    if (caracteresDaPagina < LIMIAR_CHARS_PAGINA_IMAGEM && cobertura > LIMIAR_COBERTURA_IMAGEM) {
      paginasImagem0.add(pagina)
    }
  }
  const paginasImagem = [...paginasImagem0].sort((a, b) => a - b).map((p) => p + 1)
  // A página escaneada não deve virar figura crua (![Imagem...]) — ela some
  // como imagem e reaparece como marcador de OCR, na mesma posição.
  const imagensFiltradas = imagens.filter((imagem) => !paginasImagem0.has(imagem.pagina))

  const gradesPorPagina = new Map<number, GradeDeTabela>()
  segmentosPorPagina.forEach(({ segmentos }, pagina) => {
    const grade = construirGradeDaPagina(segmentos)
    if (grade) gradesPorPagina.set(pagina, grade)
  })

  const todasAsLinhas: Linha[] = []
  items.forEach((itensDaPagina, pagina) => {
    const segmentos = segmentosPorPagina[pagina]?.segmentos ?? []
    const paraSublinhado = segmentosSemBordaDeTabela(segmentos, gradesPorPagina.get(pagina))
    todasAsLinhas.push(...agruparEmLinhas(itensDaPagina, pagina, paraSublinhado))
  })

  const paginasOcrOrdenadas = [...paginasImagem0].sort((a, b) => a - b)

  if (todasAsLinhas.length === 0) {
    const blocosOcr = paginasOcrOrdenadas.map((p) => formatarBlocoOcrPendente(p + 1))
    const restante = imagensFiltradas.map((imagem) => imagem.markdown)
    return { markdown: [...blocosOcr, ...restante].join('\n\n'), paginasImagem }
  }

  const tamanhoCorpo = calcularTamanhoCorpo(todasAsLinhas)
  const margens = calcularMargens(todasAsLinhas)

  const markdown = montarMarkdown(todasAsLinhas, tamanhoCorpo, margens, gradesPorPagina, imagensFiltradas, paginasOcrOrdenadas)
  return { markdown, paginasImagem }
}
```

Em `montarMarkdown`, novo parâmetro `paginasOcr` e drenagem por página, igual ao mecanismo já usado pra imagem:

```ts
function montarMarkdown(
  linhas: Linha[],
  tamanhoCorpo: number,
  margens: Margens,
  gradesPorPagina: Map<number, GradeDeTabela>,
  imagens: ImagemPosicionada[] = [],
  paginasOcr: number[] = []
): string {
  const blocos: string[] = []
  const imagensPendentes = [...imagens]
  const paginasOcrPendentes = [...paginasOcr]
  const ancorasDeMarcador = ancorasDeNivelDeMarcador(linhas)
  let i = 0

  const despejarOcrAntesDe = (pagina: number) => {
    while (paginasOcrPendentes.length > 0 && paginasOcrPendentes[0] <= pagina) {
      blocos.push(formatarBlocoOcrPendente(paginasOcrPendentes.shift()! + 1))
    }
  }

  const despejarImagensAntesDe = (linha: Linha) => {
    while (imagensPendentes.length > 0 && imagemVemAntesDaLinha(imagensPendentes[0], linha)) {
      blocos.push(imagensPendentes.shift()!.markdown)
    }
  }

  while (i < linhas.length) {
    despejarOcrAntesDe(linhas[i].pagina)
    despejarImagensAntesDe(linhas[i])

    const grade = gradesPorPagina.get(linhas[i].pagina)
    const tabelaPorBordas = grade ? detectarTabelaPorBordas(linhas, i, grade) : null
    if (tabelaPorBordas) {
      blocos.push(tabelaPorBordas.markdown)
      i = tabelaPorBordas.proximoIndice
      continue
    }

    const tabelaPorPosicao = absorverTabelaPorPosicao(linhas, i)
    if (tabelaPorPosicao) {
      blocos.push(tabelaPorPosicao.markdown)
      i = tabelaPorPosicao.proximoIndice
      continue
    }

    if (ehTitulo(linhas[i], tamanhoCorpo)) {
      blocos.push(formatarTitulo(linhas[i], tamanhoCorpo, margens))
      i++
      continue
    }

    const { textos, linhasConsumidas, proximoIndice } = absorverBloco(linhas, i, tamanhoCorpo, gradesPorPagina)
    blocos.push(formatarBlocoDeTexto(textos, linhasConsumidas, margens, ancorasDeMarcador))
    i = proximoIndice
  }

  for (const pagina of paginasOcrPendentes) blocos.push(formatarBlocoOcrPendente(pagina + 1))
  for (const imagem of imagensPendentes) blocos.push(imagem.markdown)

  return blocos.filter((bloco) => bloco.length > 0).join('\n\n')
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- pdfMarkdown.test.ts`
Expected: PASS — todos os casos, incluindo os 4 novos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/extracao/pdfMarkdown.ts src/lib/extracao/pdfMarkdown.test.ts
git commit -m "feat: detecta pagina-imagem e insere marcador ocr-pendente"
```

---

### Task 4: `POST /api/propostas-comerciais` consome o novo retorno e marca `arquivoId`

**Files:**
- Modify: `src/app/api/propostas-comerciais/route.ts`

**Interfaces:**
- Consumes: `converterPdfParaMarkdown` (Task 3) devolvendo `{ markdown, paginasImagem }`; `reescreverComArquivoId` (Task 2).

- [ ] **Step 1: Implementar** (sem teste dedicado — mesmo padrão já adotado nas outras rotas deste módulo)

Em `src/app/api/propostas-comerciais/route.ts`, importar `reescreverComArquivoId`:

```ts
import { reescreverComArquivoId } from '@/lib/ocr/marcadorOcrPendente'
```

Trocar o trecho que converte cada arquivo — hoje `markdown` é atribuído direto; passa a vir de `.markdown`, e a linha do PDF grava a linha do arquivo ANTES de saber o Markdown final, pra ter o `id` disponível pra reescrever o marcador:

```ts
  const arquivosConvertidos: ArquivoConvertido[] = []
  let falhaConversao: string | null = null

  for (const [indice, arquivo] of arquivosEnviados.entries()) {
    const tipo = tipoDoArquivo(arquivo.name)!
    const buffer = Buffer.from(await arquivo.arrayBuffer())
    const caminhoRelativo = buildUploadPath(`${proposta.id}/${indice}`, tipo)
    const url = await putUpload(caminhoRelativo, buffer)

    const arquivoRow = await prisma.propostaComercialArquivo.create({
      data: {
        propostaId: proposta.id,
        nomeArquivo: arquivo.name,
        tipo,
        tamanhoBytes: buffer.length,
        caminhoOriginal: url,
        conteudoExtraido: null,
        ordem: indice,
      },
    })

    let markdown: string | null = null
    try {
      if (tipo === 'pdf') {
        const resultado = await converterPdfParaMarkdown(buffer, {
          salvarImagem: (imagem) =>
            putUpload(buildImagemPath(`${proposta.id}/${indice}`, imagem.nomeArquivo), imagem.png, 'image/png'),
        })
        markdown =
          resultado.paginasImagem.length > 0 ? reescreverComArquivoId(resultado.markdown, arquivoRow.id) : resultado.markdown
      } else {
        markdown = await converterParaMarkdownDeterministico(buffer, tipo)
      }
      if (!markdown.trim()) {
        throw new Error(`não foi possível converter "${arquivo.name}" — arquivo sem conteúdo reconhecível`)
      }
    } catch (error) {
      falhaConversao = error instanceof Error ? error.message : String(error)
    }

    await prisma.propostaComercialArquivo.update({
      where: { id: arquivoRow.id },
      data: { conteudoExtraido: markdown },
    })

    if (markdown) {
      arquivosConvertidos.push({ nomeArquivo: arquivo.name, markdown })
    }
  }
```

O resto da rota (concatenação, `status: 'erro'` em falha, atualização final) continua igual.

- [ ] **Step 2: Verificar manualmente que o build/tsc não quebra**

Run: `npx tsc --noEmit`
Expected: sem erro novo relacionado a `route.ts` ou `pdfMarkdown.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/propostas-comerciais/route.ts
git commit -m "feat: grava arquivoId no marcador ocr-pendente no upload"
```

---

### Task 5: Gate de finalização no `PATCH`

**Files:**
- Modify: `src/app/api/propostas-comerciais/[id]/route.ts`
- Test: `src/app/api/propostas-comerciais/[id]/route.test.ts` *(novo)*

**Interfaces:**
- Consumes: `temBlocoOcrPendente` (Task 2).

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/app/api/propostas-comerciais/[id]/route.test.ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { propostaComercial: { findUnique: jest.fn(), update: jest.fn() } },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PATCH } from './route'

const requisicao = (corpo: unknown) =>
  new NextRequest('http://localhost/api/propostas-comerciais/p1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
const contexto = { params: Promise.resolve({ id: 'p1' }) }

describe('PATCH /api/propostas-comerciais/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({ id: 'p1' })
  })

  it('markdown com :::ocr-pendente salva e mantém rascunho', async () => {
    ;(prisma.propostaComercial.update as jest.Mock).mockImplementation(({ data }) => ({ id: 'p1', ...data }))

    const resposta = await PATCH(
      requisicao({ conteudoMarkdown: 'texto\n\n:::ocr-pendente[arquivoId=a1 pagina=2]\ncorpo\n:::' }),
      contexto
    )

    expect(prisma.propostaComercial.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'rascunho' }) })
    )
    await expect(resposta.json()).resolves.toEqual(expect.objectContaining({ status: 'rascunho' }))
  })

  it('markdown sem marcador vira concluído', async () => {
    ;(prisma.propostaComercial.update as jest.Mock).mockImplementation(({ data }) => ({ id: 'p1', ...data }))

    const resposta = await PATCH(requisicao({ conteudoMarkdown: 'texto normal, sem marcador nenhum' }), contexto)

    expect(prisma.propostaComercial.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'concluido' }) })
    )
    await expect(resposta.json()).resolves.toEqual(expect.objectContaining({ status: 'concluido' }))
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- "propostas-comerciais/\[id\]/route.test.ts"`
Expected: FAIL — hoje `status` sempre vira `'concluido'`.

- [ ] **Step 3: Implementar**

Em `src/app/api/propostas-comerciais/[id]/route.ts`:

```ts
import { temBlocoOcrPendente } from '@/lib/ocr/marcadorOcrPendente'
```

```ts
  const propostaFinal = await prisma.propostaComercial.update({
    where: { id },
    data: { conteudoMarkdown, status: temBlocoOcrPendente(conteudoMarkdown) ? 'rascunho' : 'concluido' },
  })
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- "propostas-comerciais/\[id\]/route.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/propostas-comerciais/[id]/route.ts src/app/api/propostas-comerciais/[id]/route.test.ts
git commit -m "feat: PATCH mantem rascunho enquanto houver ocr pendente"
```

---

### Task 6: Cache de sessão do OCR em andamento

**Files:**
- Create: `src/lib/ocrEmAndamento.ts`
- Test: `src/lib/ocrEmAndamento.test.ts`

**Interfaces:**
- Produces:
  - `type EntradaOcr = { status: 'rodando'; promise: Promise<string> } | { status: 'ok'; markdown: string } | { status: 'erro'; mensagem: string }`
  - `ocrAtual(propostaId: string): EntradaOcr | undefined`
  - `iniciarOcr(propostaId: string, rodar: () => Promise<string>): Promise<string>`
  - `limparOcr(propostaId: string): void`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/lib/ocrEmAndamento.test.ts
import { ocrAtual, iniciarOcr, limparOcr } from './ocrEmAndamento'

describe('ocrEmAndamento', () => {
  beforeEach(() => limparOcr('p1'))

  it('começa sem entrada', () => {
    expect(ocrAtual('p1')).toBeUndefined()
  })

  it('iniciarOcr marca como rodando e depois ok', async () => {
    const promise = iniciarOcr('p1', () => Promise.resolve('markdown final'))

    expect(ocrAtual('p1')).toEqual({ status: 'rodando', promise })

    await promise

    expect(ocrAtual('p1')).toEqual({ status: 'ok', markdown: 'markdown final' })
  })

  it('chamar de novo enquanto roda devolve a MESMA promise, sem rodar de novo', async () => {
    const rodar = jest.fn().mockResolvedValue('markdown final')

    const p1 = iniciarOcr('p1', rodar)
    const p2 = iniciarOcr('p1', rodar)

    expect(p1).toBe(p2)
    await p1
    expect(rodar).toHaveBeenCalledTimes(1)
  })

  it('falha vira status erro com a mensagem', async () => {
    const promise = iniciarOcr('p1', () => Promise.reject(new Error('deu ruim')))

    await expect(promise).rejects.toThrow('deu ruim')
    expect(ocrAtual('p1')).toEqual({ status: 'erro', mensagem: 'deu ruim' })
  })

  it('limparOcr esquece a entrada', async () => {
    await iniciarOcr('p1', () => Promise.resolve('x'))
    limparOcr('p1')
    expect(ocrAtual('p1')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- ocrEmAndamento.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
// src/lib/ocrEmAndamento.ts
/**
 * Cache em memória (nível de módulo) do OCR em andamento por proposta — mesmo
 * padrão de `revisaoPortuguesEmAndamento.ts`: sair da aba no meio do OCR não
 * perde o progresso, e clicar em "Rodar OCR" de novo enquanto já está rodando
 * nunca dispara um segundo lote.
 */

export type EntradaOcr =
  | { status: 'rodando'; promise: Promise<string> }
  | { status: 'ok'; markdown: string }
  | { status: 'erro'; mensagem: string }

const cache = new Map<string, EntradaOcr>()

export function ocrAtual(propostaId: string): EntradaOcr | undefined {
  return cache.get(propostaId)
}

export function iniciarOcr(propostaId: string, rodar: () => Promise<string>): Promise<string> {
  const atual = cache.get(propostaId)
  if (atual?.status === 'rodando') return atual.promise

  const promise = rodar()
  cache.set(propostaId, { status: 'rodando', promise })
  promise.then(
    (markdown) => {
      if (cache.get(propostaId)?.status === 'rodando') cache.set(propostaId, { status: 'ok', markdown })
    },
    (erro) => {
      if (cache.get(propostaId)?.status === 'rodando') {
        cache.set(propostaId, { status: 'erro', mensagem: erro instanceof Error ? erro.message : String(erro) })
      }
    }
  )
  return promise
}

export function limparOcr(propostaId: string): void {
  cache.delete(propostaId)
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- ocrEmAndamento.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ocrEmAndamento.ts src/lib/ocrEmAndamento.test.ts
git commit -m "feat: cache de sessao do OCR em andamento"
```

---

### Task 7: `rodarOcr.ts` — orquestração pura

**Files:**
- Create: `src/lib/ocr/rodarOcr.ts`
- Test: `src/lib/ocr/rodarOcr.test.ts`

**Interfaces:**
- Consumes: `listarBlocosOcrPendente`, `substituirCorpo` (Task 2).
- Produces:
  - `interface ProgressoOcr { pagina: number; total: number }`
  - `interface DepsRodarOcr { renderizarPagina: (arquivoId: string, pagina: number) => Promise<string>; reconhecer: (imagemDataUrl: string) => Promise<string>; onProgresso?: (p: ProgressoOcr) => void }`
  - `rodarOcrEmBlocos(markdown: string, deps: DepsRodarOcr): Promise<string>`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/lib/ocr/rodarOcr.test.ts
import { rodarOcrEmBlocos } from './rodarOcr'

describe('rodarOcrEmBlocos', () => {
  it('reconhece cada página pendente e preenche o corpo, mantendo o wrapper', async () => {
    const markdown = 'X\n\n:::ocr-pendente[arquivoId=a1 pagina=1]\n_(aguardando OCR)_\n:::\n\nY'
    const renderizarPagina = jest.fn().mockResolvedValue('data:image/png;base64,xyz')
    const reconhecer = jest.fn().mockResolvedValue('Texto reconhecido.')

    const resultado = await rodarOcrEmBlocos(markdown, { renderizarPagina, reconhecer })

    expect(resultado).toBe('X\n\n:::ocr-pendente[arquivoId=a1 pagina=1]\nTexto reconhecido.\n:::\n\nY')
    expect(renderizarPagina).toHaveBeenCalledWith('a1', 1)
    expect(reconhecer).toHaveBeenCalledWith('data:image/png;base64,xyz')
  })

  it('processa vários blocos, um a um, reportando progresso', async () => {
    const markdown =
      ':::ocr-pendente[arquivoId=a1 pagina=1]\n_(aguardando OCR)_\n:::\n\n:::ocr-pendente[arquivoId=a1 pagina=2]\n_(aguardando OCR)_\n:::'
    const renderizarPagina = jest.fn().mockResolvedValue('img')
    const reconhecer = jest.fn().mockResolvedValueOnce('Página um.').mockResolvedValueOnce('Página dois.')
    const progresso: { pagina: number; total: number }[] = []

    const resultado = await rodarOcrEmBlocos(markdown, {
      renderizarPagina,
      reconhecer,
      onProgresso: (p) => progresso.push(p),
    })

    expect(resultado).toContain('Página um.')
    expect(resultado).toContain('Página dois.')
    expect(progresso).toEqual([
      { pagina: 1, total: 2 },
      { pagina: 2, total: 2 },
    ])
  })

  it('erro numa página não aborta as outras — vira aviso de falha só naquela página', async () => {
    const markdown =
      ':::ocr-pendente[arquivoId=a1 pagina=1]\n_(aguardando OCR)_\n:::\n\n:::ocr-pendente[arquivoId=a1 pagina=2]\n_(aguardando OCR)_\n:::'
    const renderizarPagina = jest.fn().mockResolvedValue('img')
    const reconhecer = jest.fn().mockRejectedValueOnce(new Error('falhou')).mockResolvedValueOnce('Página dois.')

    const resultado = await rodarOcrEmBlocos(markdown, { renderizarPagina, reconhecer })

    expect(resultado).toContain('OCR falhou nesta página')
    expect(resultado).toContain('Página dois.')
  })

  it('markdown sem bloco pendente devolve o texto inalterado', async () => {
    const resultado = await rodarOcrEmBlocos('texto sem marcador', {
      renderizarPagina: jest.fn(),
      reconhecer: jest.fn(),
    })

    expect(resultado).toBe('texto sem marcador')
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- rodarOcr.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
// src/lib/ocr/rodarOcr.ts
import { listarBlocosOcrPendente, substituirCorpo } from './marcadorOcrPendente'

export interface ProgressoOcr {
  pagina: number
  total: number
}

export interface DepsRodarOcr {
  renderizarPagina: (arquivoId: string, pagina: number) => Promise<string>
  reconhecer: (imagemDataUrl: string) => Promise<string>
  onProgresso?: (p: ProgressoOcr) => void
}

/**
 * Roda o OCR de TODOS os blocos `:::ocr-pendente` do markdown, um a um,
 * preenchendo o corpo de cada um com o texto reconhecido (o wrapper continua
 * lá — a conferência humana é um passo separado, ver `marcadorOcrPendente.ts`
 * `removerWrapper`). Erro numa página vira um aviso só naquela página; as
 * outras seguem normalmente.
 */
export async function rodarOcrEmBlocos(markdown: string, deps: DepsRodarOcr): Promise<string> {
  const blocos = listarBlocosOcrPendente(markdown)
  let atual = markdown

  for (const [indice, bloco] of blocos.entries()) {
    deps.onProgresso?.({ pagina: indice + 1, total: blocos.length })
    try {
      if (!bloco.arquivoId) throw new Error('bloco de OCR sem arquivoId')
      const imagem = await deps.renderizarPagina(bloco.arquivoId, bloco.pagina)
      const texto = await deps.reconhecer(imagem)
      atual = substituirCorpo(atual, bloco, texto)
    } catch {
      atual = substituirCorpo(atual, bloco, '_(OCR falhou nesta página — transcreva manualmente a partir do original)_')
    }
  }

  return atual
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- rodarOcr.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ocr/rodarOcr.ts src/lib/ocr/rodarOcr.test.ts
git commit -m "feat: orquestracao pura do OCR em lote"
```

---

### Task 8: `OcrRunner` — componente cliente (botão, progresso, conferência)

**Files:**
- Create: `src/lib/ocr/depsOcrPadrao.ts`
- Create: `src/app/propostas-comerciais/[id]/ocr-runner.tsx`
- Test: `src/app/propostas-comerciais/[id]/ocr-runner.test.tsx`
- Modify: `package.json` (dependência `tesseract.js`)

**Interfaces:**
- Consumes: `listarBlocosOcrPendente`, `removerWrapper`, `BlocoOcrPendente` (Task 2); `rodarOcrEmBlocos`, `DepsRodarOcr` (Task 7); `ocrAtual`, `iniciarOcr`, `limparOcr` (Task 6).
- Produces: `export function OcrRunner(props: { propostaId: string; conteudoMarkdown: string; onConteudoAtualizado: (markdown: string) => Promise<void>; deps?: DepsRodarOcr }): JSX.Element | null` e `export async function carregarDepsOcrPadrao(propostaId: string): Promise<DepsRodarOcr>` (em `depsOcrPadrao.ts`).

- [ ] **Step 1: Instalar a dependência**

Run: `npm install tesseract.js`
Expected: entra em `dependencies` no `package.json`/`package-lock.json`.

- [ ] **Step 2: Escrever os testes que falham**

```tsx
// src/app/propostas-comerciais/[id]/ocr-runner.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OcrRunner } from './ocr-runner'
import { limparOcr } from '@/lib/ocrEmAndamento'

const markdownComPendente = 'X\n\n:::ocr-pendente[arquivoId=a1 pagina=1]\n_(aguardando OCR)_\n:::\n\nY'

describe('OcrRunner', () => {
  beforeEach(() => limparOcr('p1'))

  it('sem bloco pendente não renderiza nada', () => {
    const { container } = render(
      <OcrRunner propostaId="p1" conteudoMarkdown="texto normal" onConteudoAtualizado={jest.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra o botão "Rodar OCR" com a contagem de páginas', () => {
    render(<OcrRunner propostaId="p1" conteudoMarkdown={markdownComPendente} onConteudoAtualizado={jest.fn()} />)
    expect(screen.getByRole('button', { name: /Rodar OCR \(1 página\)/ })).toBeInTheDocument()
  })

  it('ao clicar, roda o OCR injetado, salva o resultado e entra em modo revisão', async () => {
    const onConteudoAtualizado = jest.fn().mockResolvedValue(undefined)
    const deps = {
      renderizarPagina: jest.fn().mockResolvedValue('data:image/png;base64,fake'),
      reconhecer: jest.fn().mockResolvedValue('Texto reconhecido.'),
    }

    render(
      <OcrRunner propostaId="p1" conteudoMarkdown={markdownComPendente} onConteudoAtualizado={onConteudoAtualizado} deps={deps} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Rodar OCR/ }))

    await waitFor(() =>
      expect(onConteudoAtualizado).toHaveBeenCalledWith(
        'X\n\n:::ocr-pendente[arquivoId=a1 pagina=1]\nTexto reconhecido.\n:::\n\nY'
      )
    )
    expect(await screen.findByRole('button', { name: /Conferi este trecho/ })).toBeInTheDocument()
  })

  it('"Conferi este trecho" remove o wrapper e salva o texto final', async () => {
    const onConteudoAtualizado = jest.fn().mockResolvedValue(undefined)
    const deps = {
      renderizarPagina: jest.fn().mockResolvedValue('data:image/png;base64,fake'),
      reconhecer: jest.fn().mockResolvedValue('Texto reconhecido.'),
    }
    render(
      <OcrRunner propostaId="p1" conteudoMarkdown={markdownComPendente} onConteudoAtualizado={onConteudoAtualizado} deps={deps} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Rodar OCR/ }))
    await screen.findByRole('button', { name: /Conferi este trecho/ })

    fireEvent.click(screen.getByRole('button', { name: /Conferi este trecho/ }))

    await waitFor(() =>
      expect(onConteudoAtualizado).toHaveBeenLastCalledWith('X\n\nTexto reconhecido.\n\nY')
    )
  })

  it('erro no OCR mostra mensagem e não trava o componente', async () => {
    const deps = {
      renderizarPagina: jest.fn().mockRejectedValue(new Error('sem rede')),
      reconhecer: jest.fn(),
    }
    render(<OcrRunner propostaId="p1" conteudoMarkdown={markdownComPendente} onConteudoAtualizado={jest.fn()} deps={deps} />)

    fireEvent.click(screen.getByRole('button', { name: /Rodar OCR/ }))

    // erro é por-página (rodarOcrEmBlocos absorve), então o fluxo segue pra
    // revisão com o aviso de falha no corpo do bloco
    expect(await screen.findByRole('button', { name: /Conferi este trecho/ })).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `npm test -- ocr-runner.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 4: Implementar `depsOcrPadrao.ts`**

```ts
// src/lib/ocr/depsOcrPadrao.ts
import type { DepsRodarOcr } from './rodarOcr'

/**
 * Implementação de verdade de `DepsRodarOcr`, usando `unpdf`/`tesseract.js`
 * carregados por `import()` dinâmico — só entra em bundle quando alguém roda
 * o OCR de verdade (nunca no carregamento normal do editor). Fica separado
 * de `ocr-runner.tsx` pra o componente poder mockar essa fronteira inteira
 * num `jest.mock` só.
 */
export async function carregarDepsOcrPadrao(propostaId: string): Promise<DepsRodarOcr> {
  const buffersPorArquivo = new Map<string, ArrayBuffer>()

  async function renderizarPagina(arquivoId: string, pagina: number): Promise<string> {
    let buffer = buffersPorArquivo.get(arquivoId)
    if (!buffer) {
      const resposta = await fetch(`/api/propostas-comerciais/${propostaId}/arquivos/${arquivoId}`)
      if (!resposta.ok) throw new Error('falha ao baixar o arquivo original pra OCR')
      buffer = await resposta.arrayBuffer()
      buffersPorArquivo.set(arquivoId, buffer)
    }

    const { getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const page = await pdf.getPage(pagina)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const contexto = canvas.getContext('2d')
    if (!contexto) throw new Error('não foi possível criar o contexto de canvas')
    await page.render({ canvasContext: contexto, viewport }).promise
    return canvas.toDataURL('image/png')
  }

  let workerPromise: ReturnType<typeof criarWorker> | null = null
  async function criarWorker() {
    const { createWorker } = await import('tesseract.js')
    return createWorker('por')
  }
  async function reconhecer(imagemDataUrl: string): Promise<string> {
    if (!workerPromise) workerPromise = criarWorker()
    const worker = await workerPromise
    const { data } = await worker.recognize(imagemDataUrl)
    return data.text.trim()
  }

  return { renderizarPagina, reconhecer }
}
```

- [ ] **Step 5: Implementar `ocr-runner.tsx`**

```tsx
// src/app/propostas-comerciais/[id]/ocr-runner.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertCircle, ScanText } from 'lucide-react'
import { BTN_PRIMARY } from '@/lib/ui'
import { listarBlocosOcrPendente, removerWrapper, type BlocoOcrPendente } from '@/lib/ocr/marcadorOcrPendente'
import { rodarOcrEmBlocos, type DepsRodarOcr } from '@/lib/ocr/rodarOcr'
import { carregarDepsOcrPadrao } from '@/lib/ocr/depsOcrPadrao'
import { ocrAtual, iniciarOcr, limparOcr } from '@/lib/ocrEmAndamento'

export interface OcrRunnerProps {
  propostaId: string
  conteudoMarkdown: string
  onConteudoAtualizado: (markdown: string) => Promise<void>
  /** Só em teste — substitui o carregamento real de tesseract.js/pdf.js. */
  deps?: DepsRodarOcr
}

type Estado =
  | { fase: 'inicial' }
  | { fase: 'rodando'; pagina: number; total: number }
  | { fase: 'revisao' }
  | { fase: 'erro'; mensagem: string }

export function OcrRunner({ propostaId, conteudoMarkdown, onConteudoAtualizado, deps }: OcrRunnerProps) {
  const [estado, setEstado] = useState<Estado>({ fase: 'inicial' })
  const montado = useRef(true)
  const blocosPendentes = listarBlocosOcrPendente(conteudoMarkdown)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  // Ao montar (ou trocar de proposta), recupera um OCR que já estava
  // rodando/pronto pra essa proposta — mesmo padrão de
  // `painel-revisao-portugues.tsx`: sair da aba no meio não perde o trabalho.
  useEffect(() => {
    if (blocosPendentes.length === 0) {
      setEstado({ fase: 'inicial' })
      return
    }
    const atual = ocrAtual(propostaId)
    if (!atual) {
      setEstado({ fase: 'inicial' })
    } else if (atual.status === 'rodando') {
      setEstado({ fase: 'rodando', pagina: 0, total: blocosPendentes.length })
      acompanhar(atual.promise)
    } else if (atual.status === 'erro') {
      setEstado({ fase: 'erro', mensagem: atual.mensagem })
    } else {
      setEstado({ fase: 'revisao' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propostaId, blocosPendentes.length])

  function acompanhar(promise: Promise<string>) {
    promise.then(
      async (resultado) => {
        await onConteudoAtualizado(resultado)
        limparOcr(propostaId)
        if (montado.current) setEstado({ fase: 'revisao' })
      },
      (erro) => {
        if (montado.current) {
          setEstado({ fase: 'erro', mensagem: erro instanceof Error ? erro.message : 'Não foi possível rodar o OCR.' })
        }
      }
    )
  }

  function rodar() {
    setEstado({ fase: 'rodando', pagina: 0, total: blocosPendentes.length })
    const promise = iniciarOcr(propostaId, async () => {
      const depsReais = deps ?? (await carregarDepsOcrPadrao(propostaId))
      return rodarOcrEmBlocos(conteudoMarkdown, {
        ...depsReais,
        onProgresso: (p) => {
          if (montado.current) setEstado({ fase: 'rodando', pagina: p.pagina, total: p.total })
        },
      })
    })
    acompanhar(promise)
  }

  async function conferir(bloco: BlocoOcrPendente, textoFinal: string) {
    await onConteudoAtualizado(removerWrapper(conteudoMarkdown, bloco, textoFinal))
  }

  if (estado.fase === 'inicial' && blocosPendentes.length === 0) return null

  if (estado.fase === 'inicial') {
    return (
      <div className="space-y-3 rounded-lg border border-border-grey bg-white p-4">
        <p className="text-sm text-mid-grey">
          {blocosPendentes.length} página{blocosPendentes.length > 1 ? 's são imagem' : ' é imagem'} — o texto não foi
          extraído automaticamente.
        </p>
        <button type="button" onClick={rodar} className={BTN_PRIMARY}>
          <ScanText className="size-3.5" strokeWidth={2.25} />
          Rodar OCR ({blocosPendentes.length} página{blocosPendentes.length > 1 ? 's' : ''})
        </button>
      </div>
    )
  }

  if (estado.fase === 'rodando') {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-border-grey bg-white p-4 text-sm text-mid-grey">
        <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        Rodando OCR... página {estado.pagina} de {estado.total}. Pode sair desta aba, continua rodando.
      </p>
    )
  }

  if (estado.fase === 'erro') {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-red-crit/30 bg-red-crit-light p-4 text-sm text-red-crit">
        <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
        {estado.mensagem}
      </p>
    )
  }

  return <RevisaoOcr blocos={blocosPendentes} onConferir={conferir} />
}

function RevisaoOcr({
  blocos,
  onConferir,
}: {
  blocos: BlocoOcrPendente[]
  onConferir: (bloco: BlocoOcrPendente, textoFinal: string) => Promise<void>
}) {
  const [indice, setIndice] = useState(0)
  const [texto, setTexto] = useState(blocos[0]?.corpo ?? '')
  const [salvando, setSalvando] = useState(false)

  const bloco = blocos[indice]
  if (!bloco) {
    return <p className="text-sm text-navy">Todos os trechos de OCR foram conferidos.</p>
  }

  async function confirmar() {
    setSalvando(true)
    await onConferir(bloco, texto)
    setSalvando(false)
    const proximo = indice + 1
    setIndice(proximo)
    setTexto(blocos[proximo]?.corpo ?? '')
  }

  return (
    <div className="space-y-3 rounded-lg border border-border-grey bg-white p-4">
      <p className="text-sm text-mid-grey">
        Confira o texto reconhecido contra a página original — trecho {indice + 1} de {blocos.length} (página {bloco.pagina}
        ).
      </p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={10}
        className="w-full rounded-lg border border-border-grey p-2 text-sm"
      />
      <button type="button" onClick={confirmar} disabled={salvando} className={BTN_PRIMARY}>
        {salvando ? 'Salvando...' : 'Conferi este trecho'}
      </button>
    </div>
  )
}
```

Nota: o lado a lado com a imagem da página (spec original, seção 4) usa o bitmap renderizado durante o próprio `rodar()` — fica de fora desta primeira versão pra manter o componente simples e testável sem canvas real; a pessoa confere o texto reconhecido contra o arquivo original abrindo o botão "Arquivo original" já existente no editor. Se isso se mostrar insuficiente no uso real, entra como ajuste incremental.

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `npm test -- ocr-runner.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/ocr/depsOcrPadrao.ts src/app/propostas-comerciais/[id]/ocr-runner.tsx src/app/propostas-comerciais/[id]/ocr-runner.test.tsx
git commit -m "feat: componente OcrRunner (botao, progresso, conferencia)"
```

---

### Task 9: Callout visual `.callout-ocr-pendente` no preview renderizado

**Files:**
- Modify: `src/lib/renderizarMarkdownProposta.ts`
- Modify: `src/app/globals.css`
- Test: `src/lib/renderizarMarkdownProposta.test.ts`

**Interfaces:**
- Consumes: `listarBlocosOcrPendente` (Task 2).

- [ ] **Step 1: Escrever os testes que falham**

Adicionar em `src/lib/renderizarMarkdownProposta.test.ts` (ver arquivo já existente pra seguir o mesmo padrão de setup):

```ts
  it('bloco :::ocr-pendente vira callout .callout-ocr-pendente', () => {
    const markdown = 'Texto normal.\n\n:::ocr-pendente[arquivoId=a1 pagina=3]\nTexto reconhecido.\n:::'

    const html = renderizarMarkdownProposta(markdown)

    expect(html).toContain('callout-ocr-pendente')
    expect(html).toContain('página 3')
    expect(html).not.toContain(':::ocr-pendente')
  })

  it('texto normal não é afetado', () => {
    const html = renderizarMarkdownProposta('# Título\n\nTexto normal.')

    expect(html).not.toContain('callout-ocr-pendente')
  })
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- renderizarMarkdownProposta.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/lib/renderizarMarkdownProposta.ts
import { marked } from 'marked'
import { listarBlocosOcrPendente } from './ocr/marcadorOcrPendente'

export function renderizarMarkdownProposta(markdown: string): string {
  let comCallouts = markdown
  for (const bloco of listarBlocosOcrPendente(markdown)) {
    const aviso = `<div class="callout-ocr-pendente">⚠️ Texto por OCR, não conferido — página ${bloco.pagina} do arquivo original</div>`
    comCallouts = comCallouts.replace(bloco.blocoCompleto, aviso)
  }

  const html = marked.parse(comCallouts) as string

  if (typeof DOMParser === 'undefined') return html // SSR — o pós-processamento só roda no client

  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const paragrafo of doc.body.querySelectorAll('p')) {
    if (/^divergência/i.test(paragrafo.textContent?.trim() ?? '')) {
      paragrafo.classList.add('callout-divergencia')
    }
  }
  return doc.body.innerHTML
}
```

Em `src/app/globals.css`, ao lado de `.callout-divergencia`:

```css
  .markdown-preview .callout-ocr-pendente {
    @apply my-3 flex items-start gap-2 rounded-lg border border-red-crit/30 bg-red-crit-light px-3 py-2.5 text-[13px] text-navy;
  }
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- renderizarMarkdownProposta.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/renderizarMarkdownProposta.ts src/lib/renderizarMarkdownProposta.test.ts src/app/globals.css
git commit -m "feat: callout visual pra trecho de ocr nao conferido"
```

---

### Task 10: Ligar `OcrRunner` ao editor

**Files:**
- Modify: `src/app/propostas-comerciais/[id]/editor-markdown.tsx`
- Test: `src/app/propostas-comerciais/[id]/editor-markdown.test.tsx`

**Interfaces:**
- Consumes: `OcrRunner` (Task 8), `temBlocoOcrPendente` (Task 2).

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `editor-markdown.test.tsx` (seguindo o padrão de setup já existente no arquivo):

```tsx
  it('mostra o OcrRunner quando o conteúdo tem :::ocr-pendente', () => {
    render(
      <EditorMarkdown
        propostaId="p1"
        conteudoInicial={'texto\n\n:::ocr-pendente[arquivoId=a1 pagina=1]\n_(aguardando OCR)_\n:::'}
        arquivosOriginais={[]}
        onSalvar={jest.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /Rodar OCR/ })).toBeInTheDocument()
  })

  it('sem :::ocr-pendente não mostra o OcrRunner', () => {
    render(<EditorMarkdown propostaId="p1" conteudoInicial="texto normal" arquivosOriginais={[]} onSalvar={jest.fn()} />)
    expect(screen.queryByRole('button', { name: /Rodar OCR/ })).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- editor-markdown.test.tsx`
Expected: FAIL — `OcrRunner` ainda não está montado no editor.

- [ ] **Step 3: Implementar**

Em `src/app/propostas-comerciais/[id]/editor-markdown.tsx`, importar e montar o `OcrRunner` acima da área de visualização:

```tsx
import { OcrRunner } from './ocr-runner'
```

```tsx
      <OcrRunner
        propostaId={propostaId}
        conteudoMarkdown={texto}
        onConteudoAtualizado={async (novo) => {
          setTexto(novo)
          await onSalvar(novo)
        }}
      />

      {aba === 'visualizar' && (
```

(inserido logo antes do bloco `{aba === 'visualizar' && (...)}`, depois da barra de abas/botões).

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- editor-markdown.test.tsx`
Expected: PASS.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS em todos os arquivos tocados neste plano.

- [ ] **Step 6: Commit**

```bash
git add src/app/propostas-comerciais/[id]/editor-markdown.tsx src/app/propostas-comerciais/[id]/editor-markdown.test.tsx
git commit -m "feat: liga o OcrRunner ao editor da proposta comercial"
```
