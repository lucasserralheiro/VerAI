# Checagem por IA da conversão PDF → Markdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Depois que uma Proposta Comercial converte um PDF, checar automaticamente (por IA, texto vs. texto — nunca vendo imagem) se a conversão determinística perdeu ou alterou algo, mostrando um score de confiabilidade (nunca 100%) e a lista de trechos suspeitos, puramente informativo.

**Architecture:** Depende do plano `2026-09-11-ocr-fallback-proposta-comercial.md` já implementado (marcador `:::ocr-pendente`, `OcrRunner`). Estende `converterPdfParaMarkdown` pra também devolver o texto original e o Markdown de cada página (excluindo as marcadas pra OCR). Um novo módulo de IA (`checarConversao.ts`, mesmo padrão de `revisarPortugues.ts`) compara página a página via `generateObject`, o código agrega o score com teto de 99%. Um painel novo no editor/tela final compõe o `OcrRunner` (se houver pendência) com o resultado da checagem, iniciada sozinha ao montar — nunca bloqueia `rascunho`→`concluido`.

**Tech Stack:** Next.js (App Router), `ai` SDK (`generateObject`) via `getModel()` já abstraído, Zod, Jest + Testing Library.

## Global Constraints

- Só PDF entra na checagem — `.xlsx`/`.docx` ficam de fora (YAGNI). Fonte: `docs/superpowers/specs/2026-09-11-checagem-ia-conversao-design.md`.
- Página que caiu em `paginasImagem` (OCR) nunca entra na checagem — comparar contra o `pdf.js` (que não extrai nada de página escaneada) sempre daria falso positivo.
- Score exibido nunca é 100% — teto de 99% aplicado NO CÓDIGO (`Math.min(Math.round(media * 100), 99)`), nunca confiado só ao prompt.
- Puramente informativo — nunca altera `status` nem bloqueia finalização.
- Nada é persistido no banco — recalculado por sessão do navegador (mesmo padrão de `revisaoPortuguesEmAndamento.ts`).
- A checagem audita a CONVERSÃO AUTOMÁTICA (recalculada a partir do PDF original), não edições manuais feitas depois — roda uma vez ao abrir o editor (ou ao terminar o OCR), não a cada tecla.

---

### Task 1: `converterPdfParaMarkdown` devolve texto original e Markdown por página

**Files:**
- Modify: `src/lib/extracao/pdfMarkdown.ts`
- Test: `src/lib/extracao/pdfMarkdown.test.ts`

**Interfaces:**
- Produces: `ResultadoConversaoPdf` ganha `paginasConvertidas: { pagina: number; textoOriginal: string; markdown: string }[]` (1-indexado, exclui páginas em `paginasImagem`).

- [ ] **Step 1: Escrever os testes que falham**

Adicionar em `src/lib/extracao/pdfMarkdown.test.ts`:

```ts
describe('paginasConvertidas (texto original x markdown, por página)', () => {
  it('devolve texto original e markdown da página, pra página com texto normal', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Texto original da página.', x: 0, hasEOL: true })]],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([{ segmentos: [], fracaoAreaComImagem: 0 }])

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado.paginasConvertidas).toEqual([
      { pagina: 1, textoOriginal: 'Texto original da página.', markdown: 'Texto original da página.' },
    ])
  })

  it('página marcada pra OCR não entra em paginasConvertidas', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 2,
      items: [
        [item({ str: 'Texto normal da página 1.', x: 0, hasEOL: true })],
        [], // página 2: escaneada
      ],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([
      { segmentos: [], fracaoAreaComImagem: 0 },
      { segmentos: [], fracaoAreaComImagem: 0.9 },
    ])

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado.paginasConvertidas.map((p) => p.pagina)).toEqual([1])
  })

  it('duas páginas com texto normal geram duas entradas, na ordem', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 2,
      items: [
        [item({ str: 'Primeira.', x: 0, hasEOL: true })],
        [item({ str: 'Segunda.', x: 0, hasEOL: true })],
      ],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([
      { segmentos: [], fracaoAreaComImagem: 0 },
      { segmentos: [], fracaoAreaComImagem: 0 },
    ])

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado.paginasConvertidas.map((p) => p.pagina)).toEqual([1, 2])
    expect(resultado.paginasConvertidas[1].textoOriginal).toBe('Segunda.')
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- pdfMarkdown.test.ts`
Expected: FAIL — `resultado.paginasConvertidas` undefined.

- [ ] **Step 3: Implementar**

Em `src/lib/extracao/pdfMarkdown.ts`, atualizar a interface pública:

```ts
export interface PaginaConvertida {
  /** 1-indexada, como `paginasImagem`. */
  pagina: number
  textoOriginal: string
  markdown: string
}

export interface ResultadoConversaoPdf {
  markdown: string
  paginasImagem: number[]
  /** Uma entrada por página com texto nativo (exclui as de `paginasImagem`) —
   *  usada só pela checagem por IA, pra comparar texto original x Markdown
   *  gerado sem precisar reler o PDF de novo em outro lugar. */
  paginasConvertidas: PaginaConvertida[]
}
```

Trocar `montarMarkdown` pra também devolver o Markdown agrupado por página (`registrar` empacota cada bloco no lugar de um `blocos.push` direto):

```ts
function montarMarkdown(
  linhas: Linha[],
  tamanhoCorpo: number,
  margens: Margens,
  gradesPorPagina: Map<number, GradeDeTabela>,
  imagens: ImagemPosicionada[] = [],
  paginasOcr: number[] = []
): { markdown: string; blocosPorPagina: Map<number, string[]> } {
  const blocos: string[] = []
  const blocosPorPagina = new Map<number, string[]>()
  const registrar = (pagina: number, bloco: string) => {
    blocos.push(bloco)
    if (bloco.length === 0) return
    const lista = blocosPorPagina.get(pagina) ?? []
    lista.push(bloco)
    blocosPorPagina.set(pagina, lista)
  }
  const imagensPendentes = [...imagens]
  const paginasOcrPendentes = [...paginasOcr]
  const ancorasDeMarcador = ancorasDeNivelDeMarcador(linhas)
  let i = 0

  const despejarOcrAntesDe = (pagina: number) => {
    while (paginasOcrPendentes.length > 0 && paginasOcrPendentes[0] <= pagina) {
      // Bloco de OCR não é conteúdo checável — só entra em `blocos`, não em
      // `blocosPorPagina` (a página fica de fora de `paginasConvertidas`).
      blocos.push(formatarBlocoOcrPendente(paginasOcrPendentes.shift()! + 1))
    }
  }

  const despejarImagensAntesDe = (linha: Linha) => {
    while (imagensPendentes.length > 0 && imagemVemAntesDaLinha(imagensPendentes[0], linha)) {
      const imagem = imagensPendentes.shift()!
      registrar(imagem.pagina, imagem.markdown)
    }
  }

  while (i < linhas.length) {
    despejarOcrAntesDe(linhas[i].pagina)
    despejarImagensAntesDe(linhas[i])

    const grade = gradesPorPagina.get(linhas[i].pagina)
    const tabelaPorBordas = grade ? detectarTabelaPorBordas(linhas, i, grade) : null
    if (tabelaPorBordas) {
      registrar(linhas[i].pagina, tabelaPorBordas.markdown)
      i = tabelaPorBordas.proximoIndice
      continue
    }

    const tabelaPorPosicao = absorverTabelaPorPosicao(linhas, i)
    if (tabelaPorPosicao) {
      registrar(linhas[i].pagina, tabelaPorPosicao.markdown)
      i = tabelaPorPosicao.proximoIndice
      continue
    }

    if (ehTitulo(linhas[i], tamanhoCorpo)) {
      registrar(linhas[i].pagina, formatarTitulo(linhas[i], tamanhoCorpo, margens))
      i++
      continue
    }

    const { textos, linhasConsumidas, proximoIndice } = absorverBloco(linhas, i, tamanhoCorpo, gradesPorPagina)
    registrar(linhas[i].pagina, formatarBlocoDeTexto(textos, linhasConsumidas, margens, ancorasDeMarcador))
    i = proximoIndice
  }

  for (const pagina of paginasOcrPendentes) blocos.push(formatarBlocoOcrPendente(pagina + 1))
  for (const imagem of imagensPendentes) registrar(imagem.pagina, imagem.markdown)

  return { markdown: blocos.filter((bloco) => bloco.length > 0).join('\n\n'), blocosPorPagina }
}
```

E em `converterPdfParaMarkdown`, montar `paginasConvertidas` a partir de `todasAsLinhas` (texto original) e `blocosPorPagina` (markdown):

```ts
  const tamanhoCorpo = calcularTamanhoCorpo(todasAsLinhas)
  const margens = calcularMargens(todasAsLinhas)

  const { markdown, blocosPorPagina } = montarMarkdown(
    todasAsLinhas,
    tamanhoCorpo,
    margens,
    gradesPorPagina,
    imagensFiltradas,
    paginasOcrOrdenadas
  )

  const textoOriginalPorPagina = new Map<number, string[]>()
  for (const linha of todasAsLinhas) {
    const lista = textoOriginalPorPagina.get(linha.pagina) ?? []
    lista.push(extrairTextoLinha(linha))
    textoOriginalPorPagina.set(linha.pagina, lista)
  }

  const paginasConvertidas: PaginaConvertida[] = [...textoOriginalPorPagina.entries()]
    .filter(([pagina]) => !paginasImagem0.has(pagina))
    .map(([pagina, linhasTexto]) => ({
      pagina: pagina + 1,
      textoOriginal: linhasTexto.join('\n'),
      markdown: (blocosPorPagina.get(pagina) ?? []).join('\n\n'),
    }))
    .sort((a, b) => a.pagina - b.pagina)

  return { markdown, paginasImagem, paginasConvertidas }
```

(o branch `if (todasAsLinhas.length === 0) { ... }`, alguns parágrafos acima, já devolve cedo com `paginasConvertidas: []` — ajustar o `return` dali pra incluir esse campo vazio.)

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- pdfMarkdown.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/extracao/pdfMarkdown.ts src/lib/extracao/pdfMarkdown.test.ts
git commit -m "feat: converterPdfParaMarkdown devolve texto original e markdown por pagina"
```

---

### Task 2: `checarConversao.ts` — checagem por IA, página a página

**Files:**
- Create: `src/lib/ia/checarConversao.ts`
- Test: `src/lib/ia/checarConversao.test.ts`

**Interfaces:**
- Consumes: `getModel` (`src/lib/ia/modelo.ts`, já existe).
- Produces:
  - `interface TrechoSuspeito { pagina: number; trecho: string; motivo: string }`
  - `interface ResultadoChecagem { scoreExibido: number | null; trechosSuspeitos: TrechoSuspeito[] }`
  - `interface PaginaParaChecar { pagina: number; textoOriginal: string; markdown: string }`
  - `checarConversao(paginas: PaginaParaChecar[]): Promise<ResultadoChecagem>`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/lib/ia/checarConversao.test.ts
jest.mock('ai', () => ({ generateObject: jest.fn() }))
jest.mock('./modelo', () => ({ getModel: jest.fn().mockReturnValue('modelo-fake') }))

import { generateObject } from 'ai'
import { checarConversao } from './checarConversao'

describe('checarConversao', () => {
  beforeEach(() => jest.clearAllMocks())

  it('sem página pra checar devolve score null e lista vazia, sem chamar a IA', async () => {
    const resultado = await checarConversao([])

    expect(resultado).toEqual({ scoreExibido: null, trechosSuspeitos: [] })
    expect(generateObject).not.toHaveBeenCalled()
  })

  it('agrega o score (média) e marca a página nos trechos suspeitos', async () => {
    ;(generateObject as jest.Mock)
      .mockResolvedValueOnce({
        object: { scoreConfianca: 1, trechosSuspeitos: [] },
      })
      .mockResolvedValueOnce({
        object: { scoreConfianca: 0.6, trechosSuspeitos: [{ trecho: 'Valor: R$ 100', motivo: 'número pode ter trocado' }] },
      })

    const resultado = await checarConversao([
      { pagina: 1, textoOriginal: 'Texto da página 1', markdown: 'Texto da página 1' },
      { pagina: 2, textoOriginal: 'Valor: R$ 1.000', markdown: 'Valor: R$ 100' },
    ])

    expect(resultado.scoreExibido).toBe(80) // média (1 + 0.6) / 2 = 0.8 -> 80%
    expect(resultado.trechosSuspeitos).toEqual([
      { pagina: 2, trecho: 'Valor: R$ 100', motivo: 'número pode ter trocado' },
    ])
  })

  it('nunca devolve 100%, mesmo quando toda página vem com score 1', async () => {
    ;(generateObject as jest.Mock).mockResolvedValue({ object: { scoreConfianca: 1, trechosSuspeitos: [] } })

    const resultado = await checarConversao([{ pagina: 1, textoOriginal: 'x', markdown: 'x' }])

    expect(resultado.scoreExibido).toBe(99)
  })

  it('uma página falhando não derruba a checagem inteira', async () => {
    ;(generateObject as jest.Mock)
      .mockRejectedValueOnce(new Error('modelo indisponível'))
      .mockResolvedValueOnce({ object: { scoreConfianca: 0.9, trechosSuspeitos: [] } })

    const resultado = await checarConversao([
      { pagina: 1, textoOriginal: 'a', markdown: 'a' },
      { pagina: 2, textoOriginal: 'b', markdown: 'b' },
    ])

    expect(resultado.scoreExibido).toBe(90)
  })

  it('todas as páginas falhando lança erro', async () => {
    ;(generateObject as jest.Mock).mockRejectedValue(new Error('modelo indisponível'))

    await expect(checarConversao([{ pagina: 1, textoOriginal: 'a', markdown: 'a' }])).rejects.toThrow(
      'não foi possível checar nenhuma página'
    )
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- checarConversao.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
// src/lib/ia/checarConversao.ts
import { generateObject } from 'ai'
import { z } from 'zod'
import { getModel } from './modelo'

/**
 * Checagem por IA da conversão de PDF — compara o texto ORIGINAL de cada
 * página (extraído pelo `pdf.js`) com o Markdown que a extração
 * determinística gerou pra ela, procurando divergência real de conteúdo.
 * Nunca vê a imagem da página — só texto. Puramente informativo: o score e
 * os trechos suspeitos nunca bloqueiam nada (ver
 * docs/superpowers/specs/2026-09-11-checagem-ia-conversao-design.md).
 */

const schemaPagina = z.object({
  scoreConfianca: z.number().min(0).max(1),
  trechosSuspeitos: z.array(
    z.object({
      trecho: z.string(),
      motivo: z.string(),
    })
  ),
})

export interface TrechoSuspeito {
  pagina: number
  trecho: string
  motivo: string
}

export interface ResultadoChecagem {
  /** 0-99, nunca 100 — teto aplicado no código, não no prompt. `null` quando
   *  não havia nenhuma página checável (documento só de páginas de OCR). */
  scoreExibido: number | null
  trechosSuspeitos: TrechoSuspeito[]
}

export interface PaginaParaChecar {
  pagina: number
  textoOriginal: string
  markdown: string
}

const PROMPT = [
  'Você audita a conversão automática de um PDF pra Markdown.',
  '',
  'Compare o TEXTO ORIGINAL da página com o MARKDOWN GERADO a partir dele.',
  'Aponte SÓ divergência real de conteúdo — texto que sumiu, número ou data',
  'trocado, célula de tabela faltando. NUNCA aponte estilo, escolha de',
  'formatação Markdown (títulos, negrito, listas) ou reordenação cosmética',
  'do texto — isso não é erro de conversão.',
  '',
  '"scoreConfianca": de 0 a 1, quão confiável está essa página (1 = nenhuma',
  'divergência encontrada).',
  '"trechosSuspeitos": um item por divergência encontrada, com "trecho"',
  '(cópia exata de um pedaço do MARKDOWN GERADO onde está o problema) e',
  '"motivo" (curto, em português, explicando a suspeita). Lista vazia se não',
  'achar nada.',
  '',
  'Responda SÓ com o JSON do schema pedido.',
].join('\n')

async function checarPagina(pagina: PaginaParaChecar): Promise<{
  pagina: number
  scoreConfianca: number
  trechosSuspeitos: TrechoSuspeito[]
}> {
  const { object } = await generateObject({
    model: getModel(process.env.AI_REVISAO_MODEL || undefined),
    schema: schemaPagina,
    prompt: `${PROMPT}\n\n---TEXTO ORIGINAL (página ${pagina.pagina})---\n${pagina.textoOriginal}\n\n---MARKDOWN GERADO---\n${pagina.markdown}`,
    maxOutputTokens: 2000,
  })
  return {
    pagina: pagina.pagina,
    scoreConfianca: object.scoreConfianca,
    trechosSuspeitos: object.trechosSuspeitos.map((t) => ({ ...t, pagina: pagina.pagina })),
  }
}

export async function checarConversao(paginas: PaginaParaChecar[]): Promise<ResultadoChecagem> {
  if (paginas.length === 0) return { scoreExibido: null, trechosSuspeitos: [] }

  const resultados = await Promise.allSettled(paginas.map(checarPagina))

  const ok: { pagina: number; scoreConfianca: number; trechosSuspeitos: TrechoSuspeito[] }[] = []
  let falhas = 0
  resultados.forEach((resultado, indice) => {
    if (resultado.status === 'fulfilled') {
      ok.push(resultado.value)
    } else {
      falhas++
      console.error(`checagem por IA: página ${paginas[indice].pagina} falhou, pulando —`, resultado.reason)
    }
  })

  if (ok.length === 0) {
    throw new Error('não foi possível checar nenhuma página da conversão')
  }

  const media = ok.reduce((soma, r) => soma + r.scoreConfianca, 0) / ok.length
  const scoreExibido = Math.min(Math.round(media * 100), 99)
  const trechosSuspeitos = ok.flatMap((r) => r.trechosSuspeitos)

  return { scoreExibido, trechosSuspeitos }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- checarConversao.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ia/checarConversao.ts src/lib/ia/checarConversao.test.ts
git commit -m "feat: checagem por IA da conversao PDF, pagina a pagina"
```

---

### Task 3: `POST /api/propostas-comerciais/[id]/checagem-ia`

**Files:**
- Create: `src/app/api/propostas-comerciais/[id]/checagem-ia/route.ts`
- Test: `src/app/api/propostas-comerciais/[id]/checagem-ia/route.test.ts`

**Interfaces:**
- Consumes: `converterPdfParaMarkdown` (Task 1 deste plano), `checarConversao` (Task 2), `getUpload` (`src/lib/storage.ts`, já existe).
- Produces: `POST` devolve `{ scoreExibido: number | null; trechosSuspeitos: TrechoSuspeito[] }`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/app/api/propostas-comerciais/[id]/checagem-ia/route.test.ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { propostaComercial: { findUnique: jest.fn() } },
}))
jest.mock('@/lib/storage', () => ({ getUpload: jest.fn() }))
jest.mock('@/lib/extracao/pdfMarkdown', () => ({ converterPdfParaMarkdown: jest.fn() }))
jest.mock('@/lib/ia/checarConversao', () => ({ checarConversao: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUpload } from '@/lib/storage'
import { converterPdfParaMarkdown } from '@/lib/extracao/pdfMarkdown'
import { checarConversao } from '@/lib/ia/checarConversao'
import { POST } from './route'

const requisicao = () => new NextRequest('http://localhost/api/propostas-comerciais/p1/checagem-ia', { method: 'POST' })
const contexto = { params: Promise.resolve({ id: 'p1' }) }

describe('POST /api/propostas-comerciais/[id]/checagem-ia', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
  })

  it('retorna 401 sem autenticação', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(requisicao(), contexto)).status).toBe(401)
  })

  it('retorna 404 quando a proposta não existe', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await POST(requisicao(), contexto)).status).toBe(404)
  })

  it('junta paginasConvertidas de todos os arquivos PDF e devolve o resultado da checagem', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      arquivos: [
        { id: 'a1', tipo: 'pdf', caminhoOriginal: 'https://blob/a1.pdf' },
        { id: 'a2', tipo: 'xlsx', caminhoOriginal: 'https://blob/a2.xlsx' },
      ],
    })
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('fake'))
    ;(converterPdfParaMarkdown as jest.Mock).mockResolvedValue({
      markdown: 'x',
      paginasImagem: [],
      paginasConvertidas: [{ pagina: 1, textoOriginal: 'original', markdown: 'gerado' }],
    })
    ;(checarConversao as jest.Mock).mockResolvedValue({ scoreExibido: 87, trechosSuspeitos: [] })

    const resposta = await POST(requisicao(), contexto)

    expect(getUpload).toHaveBeenCalledTimes(1) // só o arquivo pdf, não o xlsx
    expect(getUpload).toHaveBeenCalledWith('https://blob/a1.pdf')
    expect(checarConversao).toHaveBeenCalledWith([{ pagina: 1, textoOriginal: 'original', markdown: 'gerado' }])
    await expect(resposta.json()).resolves.toEqual({ scoreExibido: 87, trechosSuspeitos: [] })
  })

  it('sem nenhum arquivo pdf devolve score null sem chamar checarConversao', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      arquivos: [{ id: 'a2', tipo: 'xlsx', caminhoOriginal: 'https://blob/a2.xlsx' }],
    })

    const resposta = await POST(requisicao(), contexto)

    expect(checarConversao).not.toHaveBeenCalled()
    await expect(resposta.json()).resolves.toEqual({ scoreExibido: null, trechosSuspeitos: [] })
  })

  it('retorna 502 quando a checagem falha', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      arquivos: [{ id: 'a1', tipo: 'pdf', caminhoOriginal: 'https://blob/a1.pdf' }],
    })
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('fake'))
    ;(converterPdfParaMarkdown as jest.Mock).mockResolvedValue({
      markdown: 'x',
      paginasImagem: [],
      paginasConvertidas: [{ pagina: 1, textoOriginal: 'a', markdown: 'a' }],
    })
    ;(checarConversao as jest.Mock).mockRejectedValue(new Error('modelo indisponível'))

    const resposta = await POST(requisicao(), contexto)

    expect(resposta.status).toBe(502)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- "checagem-ia/route.test.ts"`
Expected: FAIL — rota não existe.

- [ ] **Step 3: Implementar**

```ts
// src/app/api/propostas-comerciais/[id]/checagem-ia/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { getUpload } from '@/lib/storage'
import { converterPdfParaMarkdown, type PaginaConvertida } from '@/lib/extracao/pdfMarkdown'
import { checarConversao } from '@/lib/ia/checarConversao'

/**
 * Checagem por IA sob demanda — recalcula a conversão determinística de cada
 * arquivo PDF da proposta (o mesmo `converterPdfParaMarkdown` do upload) só
 * pra obter texto original x Markdown por página, e manda pro modelo
 * auditar. Não lê o `conteudoMarkdown` salvo nem grava nada — stateless,
 * como a revisão de português.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const proposta = await prisma.propostaComercial.findUnique({
    where: { id },
    include: { arquivos: true },
  })
  if (!proposta) {
    return NextResponse.json({ error: 'proposta comercial não encontrada' }, { status: 404 })
  }

  const arquivosPdf = proposta.arquivos.filter((arquivo) => arquivo.tipo === 'pdf')

  const paginasConvertidas: PaginaConvertida[] = []
  for (const arquivo of arquivosPdf) {
    const buffer = await getUpload(arquivo.caminhoOriginal)
    const resultado = await converterPdfParaMarkdown(buffer)
    paginasConvertidas.push(...resultado.paginasConvertidas)
  }

  if (paginasConvertidas.length === 0) {
    return NextResponse.json({ scoreExibido: null, trechosSuspeitos: [] })
  }

  try {
    const resultado = await checarConversao(paginasConvertidas)
    return NextResponse.json(resultado)
  } catch (erro) {
    console.error('checagem por IA falhou:', erro)
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    return NextResponse.json({ error: `não foi possível checar a conversão agora (${detalhe})` }, { status: 502 })
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- "checagem-ia/route.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/propostas-comerciais/[id]/checagem-ia/route.ts src/app/api/propostas-comerciais/[id]/checagem-ia/route.test.ts
git commit -m "feat: rota POST de checagem por IA da conversao"
```

---

### Task 4: Cache de sessão da checagem em andamento

**Files:**
- Create: `src/lib/checagemIaEmAndamento.ts`
- Test: `src/lib/checagemIaEmAndamento.test.ts`

**Interfaces:**
- Produces:
  - `interface ResultadoChecagemIa { scoreExibido: number | null; trechosSuspeitos: { pagina: number; trecho: string; motivo: string }[] }`
  - `type EntradaChecagemIa = { status: 'rodando'; promise: Promise<ResultadoChecagemIa> } | { status: 'ok'; resultado: ResultadoChecagemIa } | { status: 'erro'; mensagem: string }`
  - `checagemIaAtual(propostaId: string): EntradaChecagemIa | undefined`
  - `iniciarChecagemIa(propostaId: string): Promise<ResultadoChecagemIa>`
  - `limparChecagemIa(propostaId: string): void`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/lib/checagemIaEmAndamento.test.ts
function mockFetch(resposta: { ok: boolean; body: unknown }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: resposta.ok,
    json: () => Promise.resolve(resposta.body),
  }) as jest.Mock
}

import { checagemIaAtual, iniciarChecagemIa, limparChecagemIa } from './checagemIaEmAndamento'

describe('checagemIaEmAndamento', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    limparChecagemIa('p1')
  })

  it('começa sem entrada', () => {
    expect(checagemIaAtual('p1')).toBeUndefined()
  })

  it('iniciarChecagemIa chama a rota e vira status ok com o resultado', async () => {
    mockFetch({ ok: true, body: { scoreExibido: 87, trechosSuspeitos: [] } })

    const promise = iniciarChecagemIa('p1')
    expect(checagemIaAtual('p1')).toEqual({ status: 'rodando', promise })

    await promise

    expect(checagemIaAtual('p1')).toEqual({
      status: 'ok',
      resultado: { scoreExibido: 87, trechosSuspeitos: [] },
    })
    expect(global.fetch).toHaveBeenCalledWith('/api/propostas-comerciais/p1/checagem-ia', { method: 'POST' })
  })

  it('chamar de novo enquanto roda devolve a MESMA promise', async () => {
    mockFetch({ ok: true, body: { scoreExibido: 87, trechosSuspeitos: [] } })

    const p1 = iniciarChecagemIa('p1')
    const p2 = iniciarChecagemIa('p1')

    expect(p1).toBe(p2)
    await p1
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('resposta não-ok vira status erro', async () => {
    mockFetch({ ok: false, body: { error: 'deu ruim' } })

    await expect(iniciarChecagemIa('p1')).rejects.toThrow('deu ruim')
    expect(checagemIaAtual('p1')).toEqual({ status: 'erro', mensagem: 'deu ruim' })
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- checagemIaEmAndamento.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
// src/lib/checagemIaEmAndamento.ts
/**
 * Cache em memória (nível de módulo) da checagem por IA em andamento por
 * proposta — mesmo padrão de `revisaoPortuguesEmAndamento.ts`/
 * `ocrEmAndamento.ts`, mas iniciada sozinha (não por clique): sair da aba no
 * meio não perde o resultado, e montar o painel duas vezes não dispara duas
 * chamadas.
 */

export interface TrechoSuspeitoIa {
  pagina: number
  trecho: string
  motivo: string
}

export interface ResultadoChecagemIa {
  scoreExibido: number | null
  trechosSuspeitos: TrechoSuspeitoIa[]
}

export type EntradaChecagemIa =
  | { status: 'rodando'; promise: Promise<ResultadoChecagemIa> }
  | { status: 'ok'; resultado: ResultadoChecagemIa }
  | { status: 'erro'; mensagem: string }

const cache = new Map<string, EntradaChecagemIa>()

export function checagemIaAtual(propostaId: string): EntradaChecagemIa | undefined {
  return cache.get(propostaId)
}

export function iniciarChecagemIa(propostaId: string): Promise<ResultadoChecagemIa> {
  const atual = cache.get(propostaId)
  if (atual?.status === 'rodando') return atual.promise

  const promise = (async (): Promise<ResultadoChecagemIa> => {
    const resposta = await fetch(`/api/propostas-comerciais/${propostaId}/checagem-ia`, { method: 'POST' })
    const corpo = await resposta.json().catch(() => null)
    if (!resposta.ok) {
      throw new Error(corpo?.error ?? 'Não foi possível checar a conversão.')
    }
    return corpo as ResultadoChecagemIa
  })()

  cache.set(propostaId, { status: 'rodando', promise })
  promise.then(
    (resultado) => {
      if (cache.get(propostaId)?.status === 'rodando') cache.set(propostaId, { status: 'ok', resultado })
    },
    (erro) => {
      if (cache.get(propostaId)?.status === 'rodando') {
        cache.set(propostaId, { status: 'erro', mensagem: erro instanceof Error ? erro.message : String(erro) })
      }
    }
  )
  return promise
}

export function limparChecagemIa(propostaId: string): void {
  cache.delete(propostaId)
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- checagemIaEmAndamento.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/checagemIaEmAndamento.ts src/lib/checagemIaEmAndamento.test.ts
git commit -m "feat: cache de sessao da checagem por IA em andamento"
```

---

### Task 5: `PainelChecagemConversao` — painel único (OCR + resultado da IA)

**Files:**
- Create: `src/app/propostas-comerciais/[id]/painel-checagem-conversao.tsx`
- Test: `src/app/propostas-comerciais/[id]/painel-checagem-conversao.test.tsx`

**Interfaces:**
- Consumes: `OcrRunner` (plano de OCR, já implementado), `temBlocoOcrPendente` (`@/lib/ocr/marcadorOcrPendente`), `checagemIaAtual`, `iniciarChecagemIa`, `limparChecagemIa`, `ResultadoChecagemIa` (Task 4).
- Produces: `export function PainelChecagemConversao(props: { propostaId: string; conteudoMarkdown: string; onConteudoAtualizado: (markdown: string) => Promise<void> }): JSX.Element`

- [ ] **Step 1: Escrever os testes que falham**

```tsx
// src/app/propostas-comerciais/[id]/painel-checagem-conversao.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { PainelChecagemConversao } from './painel-checagem-conversao'
import { limparChecagemIa } from '@/lib/checagemIaEmAndamento'
import { limparOcr } from '@/lib/ocrEmAndamento'

function mockFetch(resposta: { ok: boolean; body: unknown }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: resposta.ok,
    json: () => Promise.resolve(resposta.body),
  }) as jest.Mock
}

describe('PainelChecagemConversao', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    limparChecagemIa('p1')
    limparOcr('p1')
  })

  it('com :::ocr-pendente mostra o OcrRunner e NÃO inicia a checagem por IA', () => {
    mockFetch({ ok: true, body: { scoreExibido: 90, trechosSuspeitos: [] } })

    render(
      <PainelChecagemConversao
        propostaId="p1"
        conteudoMarkdown={'texto\n\n:::ocr-pendente[arquivoId=a1 pagina=1]\n_(aguardando OCR)_\n:::'}
        onConteudoAtualizado={jest.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /Rodar OCR/ })).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('sem marcador pendente, inicia a checagem sozinha e mostra "Verificando com IA..."', () => {
    mockFetch({ ok: true, body: { scoreExibido: 90, trechosSuspeitos: [] } })

    render(<PainelChecagemConversao propostaId="p1" conteudoMarkdown="texto normal" onConteudoAtualizado={jest.fn()} />)

    expect(screen.getByText(/Verificando com IA/)).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/propostas-comerciais/p1/checagem-ia', { method: 'POST' })
  })

  it('mostra o score (nunca 100%) e a lista de trechos suspeitos quando pronto', async () => {
    mockFetch({
      ok: true,
      body: { scoreExibido: 87, trechosSuspeitos: [{ pagina: 2, trecho: 'Valor: R$ 100', motivo: 'número suspeito' }] },
    })

    render(<PainelChecagemConversao propostaId="p1" conteudoMarkdown="texto normal" onConteudoAtualizado={jest.fn()} />)

    expect(await screen.findByText(/87%/)).toBeInTheDocument()
    expect(screen.getByText(/número suspeito/)).toBeInTheDocument()
    expect(screen.getByText(/estimativa da IA/i)).toBeInTheDocument()
  })

  it('score null mostra a mensagem de "sem páginas de texto nativo"', async () => {
    mockFetch({ ok: true, body: { scoreExibido: null, trechosSuspeitos: [] } })

    render(<PainelChecagemConversao propostaId="p1" conteudoMarkdown="texto normal" onConteudoAtualizado={jest.fn()} />)

    expect(await screen.findByText(/Sem páginas de texto nativo/)).toBeInTheDocument()
  })

  it('erro na checagem mostra mensagem', async () => {
    mockFetch({ ok: false, body: { error: 'modelo indisponível' } })

    render(<PainelChecagemConversao propostaId="p1" conteudoMarkdown="texto normal" onConteudoAtualizado={jest.fn()} />)

    await waitFor(() => expect(screen.getByText(/modelo indisponível/)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- painel-checagem-conversao.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```tsx
// src/app/propostas-comerciais/[id]/painel-checagem-conversao.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react'
import { temBlocoOcrPendente } from '@/lib/ocr/marcadorOcrPendente'
import {
  checagemIaAtual,
  iniciarChecagemIa,
  limparChecagemIa,
  type ResultadoChecagemIa,
} from '@/lib/checagemIaEmAndamento'
import { OcrRunner } from './ocr-runner'

export interface PainelChecagemConversaoProps {
  propostaId: string
  conteudoMarkdown: string
  onConteudoAtualizado: (markdown: string) => Promise<void>
}

type Estado =
  | { fase: 'carregando' }
  | { fase: 'pronta'; resultado: ResultadoChecagemIa }
  | { fase: 'erro'; mensagem: string }

/**
 * Painel único da Proposta Comercial: OCR (Etapa 1, já existente em
 * `ocr-runner.tsx`) primeiro, se houver `:::ocr-pendente`; depois — sozinha,
 * sem botão — a checagem por IA (Etapa 2), sempre visível no editor e na
 * tela final.
 */
export function PainelChecagemConversao({ propostaId, conteudoMarkdown, onConteudoAtualizado }: PainelChecagemConversaoProps) {
  const temOcrPendente = temBlocoOcrPendente(conteudoMarkdown)
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' })
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  useEffect(() => {
    if (temOcrPendente) return

    const atual = checagemIaAtual(propostaId)
    if (atual?.status === 'ok') {
      setEstado({ fase: 'pronta', resultado: atual.resultado })
      return
    }
    if (atual?.status === 'erro') {
      setEstado({ fase: 'erro', mensagem: atual.mensagem })
      return
    }

    setEstado({ fase: 'carregando' })
    iniciarChecagemIa(propostaId).then(
      (resultado) => {
        if (montado.current) setEstado({ fase: 'pronta', resultado })
      },
      (erro) => {
        if (montado.current) {
          setEstado({ fase: 'erro', mensagem: erro instanceof Error ? erro.message : 'Não foi possível checar a conversão.' })
        }
      }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propostaId, temOcrPendente])

  if (temOcrPendente) {
    return (
      <OcrRunner
        propostaId={propostaId}
        conteudoMarkdown={conteudoMarkdown}
        onConteudoAtualizado={async (novo) => {
          limparChecagemIa(propostaId) // texto mudou (OCR conferido) — a checagem anterior não vale mais
          await onConteudoAtualizado(novo)
        }}
      />
    )
  }

  if (estado.fase === 'carregando') {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-border-grey bg-white p-4 text-sm text-mid-grey">
        <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        Verificando com IA... pode sair desta aba, continua rodando.
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

  const { scoreExibido, trechosSuspeitos } = estado.resultado

  if (scoreExibido === null) {
    return (
      <p className="rounded-lg border border-border-grey bg-white p-4 text-sm text-mid-grey">
        Sem páginas de texto nativo pra checar automaticamente — revise o conteúdo de OCR manualmente.
      </p>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-border-grey bg-white p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-navy">
        <ShieldCheck className="size-4 shrink-0" strokeWidth={2.25} />
        {scoreExibido}% de confiabilidade (estimativa da IA) — confira os trechos abaixo antes de finalizar.
      </p>
      {trechosSuspeitos.length === 0 ? (
        <p className="text-sm text-mid-grey">Nenhum trecho suspeito encontrado.</p>
      ) : (
        <ul className="space-y-2">
          {trechosSuspeitos.map((trecho, indice) => (
            <li key={indice} className="rounded-lg border border-orange/30 bg-orange-light/40 p-2.5 text-sm text-navy">
              <p className="font-medium">Página {trecho.pagina}</p>
              <p className="text-mid-grey">"{trecho.trecho}"</p>
              <p>{trecho.motivo}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- painel-checagem-conversao.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/propostas-comerciais/[id]/painel-checagem-conversao.tsx src/app/propostas-comerciais/[id]/painel-checagem-conversao.test.tsx
git commit -m "feat: painel unico de OCR + checagem por IA da conversao"
```

---

### Task 6: Trocar `OcrRunner` avulso pelo `PainelChecagemConversao` no editor e na tela final

**Files:**
- Modify: `src/app/propostas-comerciais/[id]/editor-markdown.tsx`
- Modify: `src/app/propostas-comerciais/[id]/proposta-final.tsx`
- Test: `src/app/propostas-comerciais/[id]/editor-markdown.test.tsx`
- Test: `src/app/propostas-comerciais/[id]/proposta-final.test.tsx`

**Interfaces:**
- Consumes: `PainelChecagemConversao` (Task 5).

- [ ] **Step 1: Escrever os testes que falham**

Em `editor-markdown.test.tsx`, adicionar (ou ajustar, se algum teste da Task 10 do plano de OCR já cobria isso diretamente contra `OcrRunner`):

```tsx
  it('mostra o resultado da checagem por IA quando não há OCR pendente', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ scoreExibido: 95, trechosSuspeitos: [] }),
    }) as jest.Mock

    render(<EditorMarkdown propostaId="p1" conteudoInicial="texto normal" arquivosOriginais={[]} onSalvar={jest.fn()} />)

    expect(await screen.findByText(/95%/)).toBeInTheDocument()
  })
```

Em `proposta-final.test.tsx`, o mesmo tipo de asserção (mock de `fetch`, renderiza `PropostaFinal`, espera o score aparecer) — seguir o padrão de setup já existente nesse arquivo.

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- editor-markdown.test.tsx proposta-final.test.tsx`
Expected: FAIL — ainda usa `OcrRunner` direto, sem checagem por IA.

- [ ] **Step 3: Implementar**

Em `editor-markdown.tsx`, trocar o import e o uso:

```tsx
import { PainelChecagemConversao } from './painel-checagem-conversao'
```

```tsx
      <PainelChecagemConversao
        propostaId={propostaId}
        conteudoMarkdown={texto}
        onConteudoAtualizado={async (novo) => {
          setTexto(novo)
          await onSalvar(novo)
        }}
      />

      {aba === 'visualizar' && (
```

(substitui o bloco `<OcrRunner ... />` inserido no plano anterior.)

Em `proposta-final.tsx`, adicionar o mesmo painel (a tela final ainda não tinha nenhum, já que finalizar exigia zero OCR pendente):

```tsx
import { PainelChecagemConversao } from './painel-checagem-conversao'
```

```tsx
      <PainelChecagemConversao
        propostaId={propostaId}
        conteudoMarkdown={markdown}
        onConteudoAtualizado={async (novo) => {
          handleMudarTexto(novo)
          await onSalvar(novo)
        }}
      />

      {aba === 'visualizar' && (
```

(inserido no mesmo lugar relativo — antes do bloco `{aba === 'visualizar' && (...)}`, depois da barra de abas/botões.)

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- editor-markdown.test.tsx proposta-final.test.tsx`
Expected: PASS.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS em todos os arquivos tocados nos dois planos (OCR + checagem por IA).

- [ ] **Step 6: Commit**

```bash
git add src/app/propostas-comerciais/[id]/editor-markdown.tsx src/app/propostas-comerciais/[id]/proposta-final.tsx src/app/propostas-comerciais/[id]/editor-markdown.test.tsx src/app/propostas-comerciais/[id]/proposta-final.test.tsx
git commit -m "feat: liga o painel de checagem por IA ao editor e a tela final"
```
