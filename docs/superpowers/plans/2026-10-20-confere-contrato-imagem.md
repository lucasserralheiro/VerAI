# ConfereAI — contrato que é imagem: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o ConfereAI passa a ler proposta PC/PA que é imagem (impressa com letras em contorno ou escaneada — 95 de 469 hoje): o VerAI monta um PDF limpo (texto lido da imagem + linhas da tabela achadas na imagem) e o envia ao Confere no lugar do original.

**Architecture:** uma peça pura `lerPdfDeImagem` em `src/lib/leitura-imagem/` (desenhar página → ler palavras → achar linhas → montar PDF com `pdf-lib`), com desenho e reconhecimento injetados: no Node (agendador e régua) por `unpdf` + `@napi-rs/canvas` + `tesseract.js`; no navegador por canvas do DOM + `tesseract.js`. O agendador lê de antemão e guarda o PDF lido no R2 (`leitura-imagem/<sha256>.pdf`) com uma linha em `LeituraImagemPdf`; o proxy do ConfereAI troca o original pela versão lida; arquivo enviado do computador é lido no navegador. O Confere (Python) não muda a leitura — só a mensagem do PDF sem texto.

**Tech Stack:** Next.js 15, TypeScript, Prisma 6/Postgres (Neon), Jest, `unpdf`, `tesseract.js` 7, `pdf-lib` (novo), `@napi-rs/canvas` (novo, só Node), Python 3.12/pdfplumber (Confere), Cloudflare R2.

**Spec:** `docs/superpowers/specs/2026-10-20-confere-contrato-imagem-design.md`.

## Global Constraints

- **A palavra "OCR" não aparece na tela.** Textos fixos (copiar exatamente):
  - lido: `Este contrato é uma imagem (foi impresso ou escaneado). O sistema leu o texto da imagem — confira os valores.` (no aditivo: `Este aditivo é uma imagem …`)
  - não deu para ler: `Este contrato é uma imagem e o sistema não conseguiu ler o texto. Peça o arquivo do Word ou um PDF salvo pelo Word.` (aditivo: `Este aditivo é uma imagem …`)
  - bloqueio com documento lido: `Este contrato é uma imagem — a leitura pode ter errado um valor. Confira os valores ou peça o arquivo do Word.`
  - progresso no navegador: `Lendo o contrato, que é uma imagem… página {n} de {total}` (aditivo: `Lendo o aditivo {i}, que é uma imagem… página {n} de {total}`)
- **Número lido nunca é corrigido** (invariante de `repararTextoPdf.ts`): o texto do OCR vai como veio; erro vira bloqueio pela conta do Confere.
- **O original nunca é trocado** no cadastro, no histórico nem em "Ver no PDF": a versão lida só vai ao Confere.
- **Nada de marca no DOCX/XLSX** (regra "só conferência" de 08/10/2026).
- **Só tabela nova** (`LeituraImagemPdf`): o agendador roda o cliente Prisma desta pasta contra produção. Migração escrita à mão; **nunca** `prisma migrate dev`/`migrate diff` com o banco de dev como shadow. Aplicar no dev: `npx dotenv -e .env.development -- npx prisma migrate deploy` e `npx prisma generate`. Em produção, migração **antes** do deploy e antes de o agendador rodar o código novo.
- `@napi-rs/canvas` e `tesseract.js` do lado Node **só** em `scripts/` e em `src/lib/leitura-imagem/deps-node.ts` (importado só por scripts e pela etapa do agendador) — nunca numa rota do Next.
- Não rodar `next build` com o dev server de pé.
- **Commits sem `Co-Authored-By`** (a empresa não permite). Na main, com **índice próprio**, porque outras sessões commitam ao mesmo tempo e o índice é compartilhado. "Commit" nos passos = este procedimento com os arquivos listados:
  ```bash
  export GIT_INDEX_FILE=$(mktemp) && git read-tree HEAD && git add <arquivos> && \
  C=$(git commit-tree $(git write-tree) -p HEAD -m "<mensagem>") && git update-ref refs/heads/main $C HEAD; unset GIT_INDEX_FILE
  ```
  Arquivo que **outra sessão também alterou** (hoje: `prisma/schema.prisma`, `CLAUDE.md`, `package.json`): não use `git add` nele — monte o blob a partir do HEAD só com a sua mudança e grave com `git update-index --cacheinfo 100644,$(git hash-object -w <arquivo-montado>),<caminho>` antes do `write-tree`.
- `package.json`/`package-lock.json` mudam ao instalar dependência: confira com `git diff HEAD -- package.json` o que é seu antes do commit (mesma regra acima).
- Python do Confere: no Windows não há `resource`; a suíte que importa `api.main` roda em contêiner:
  ```bash
  MSYS_NO_PATHCONV=1 docker run --rm -v "C:/projeto/VerAI/services/confere/backend:/src:ro" -e PYTHONPATH=/w/src -w /w python:3.12-slim \
    sh -c "pip -q install uv >/dev/null 2>&1 && cp -r /src/pyproject.toml /src/uv.lock /src/src /src/tests /w/ && uv sync --frozen -q && .venv/bin/python -m pytest -q -p no:cacheprovider <testes>"
  ```
  O extrator sozinho (sem `api.main`) roda no Windows: `services/confere/backend/.venv/Scripts/python.exe`.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/leitura-imagem/sem-texto.ts` | `pdfSemTexto(bytes)` — nenhuma página com texto extraível |
| `src/lib/leitura-imagem/linhas.ts` | `acharLinhas(imagem)` — segmentos retos longos na imagem (puro) |
| `src/lib/leitura-imagem/montar-pdf.ts` | `montarPdf(paginas)` — PDF novo com linhas + palavras (`pdf-lib`) |
| `src/lib/leitura-imagem/ler.ts` | `lerPdfDeImagem(deps, aoAvancar)` — orquestra página a página; tipos compartilhados |
| `src/lib/leitura-imagem/deps-node.ts` | desenho e reconhecimento no Node (`unpdf` + `@napi-rs/canvas` + `tesseract.js`) |
| `src/lib/leitura-imagem/deps-navegador.ts` | o mesmo no navegador (canvas do DOM) |
| `src/lib/leitura-imagem/preparar.ts` | navegador: `prepararParaOConfere(arquivo, rotulo, aoAvancar)` |
| `src/lib/leitura-imagem/guardar.ts` | `LeituraImagemPdf`: chave do R2, consultar por `sha256`, migração |
| `src/lib/leitura-imagem/etapa.ts` | `etapaDaLeituraDeImagem` do agendador |
| `src/lib/leitura-imagem/no-confere.ts` | proxy: trocar pela versão lida; anotar documentos do cadastro |
| `src/app/confere/components/AvisoDeImagem.tsx` | o aviso na linha do documento |
| `services/confere/backend/scripts/extrair_contrato.py` | CLI: extrai um contrato e imprime JSON (régua) |
| `scripts/ler-pdf-imagem.ts` | CLI: lê um PDF de imagem e grava o PDF lido (conferência manual) |
| `scripts/regua-leitura-imagem.ts` | régua: as PC/PA sem texto da biblioteca → lidas → Confere |
| `prisma/migrations/20261020160000_leitura_imagem_pdf/migration.sql` | tabela nova |

---

### Task 1: Regra "sem texto" em TypeScript (+ `pdf-lib`)

**Files:**
- Create: `src/lib/leitura-imagem/sem-texto.ts`
- Test: `src/lib/leitura-imagem/sem-texto.test.ts`
- Modify: `package.json`, `package-lock.json` (dependência `pdf-lib`)

**Interfaces:**
- Produces: `pdfSemTexto(bytes: Uint8Array): Promise<boolean>` — `true` só quando **nenhuma** página tem texto extraível; arquivo que não abre como PDF → `false` (quem decide a mensagem é o Confere, como em `pdf_sem_texto` do Python).

- [ ] **Step 1: Instalar `pdf-lib`**

Run: `npm install pdf-lib@1.17.1`
Expected: `package.json` ganha `"pdf-lib": "^1.17.1"` em `dependencies`.

- [ ] **Step 2: Escrever o teste que falha**

```ts
/** @jest-environment node */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { pdfSemTexto } from './sem-texto'

async function pdfCom(desenhar: (doc: PDFDocument) => Promise<void>): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  await desenhar(doc)
  return doc.save()
}

describe('pdfSemTexto', () => {
  it('PDF só com desenho (linhas, nenhuma fonte) não tem texto', async () => {
    const bytes = await pdfCom(async (doc) => {
      const pagina = doc.addPage([595, 842])
      pagina.drawLine({ start: { x: 50, y: 50 }, end: { x: 500, y: 50 }, thickness: 1, color: rgb(0, 0, 0) })
      pagina.drawRectangle({ x: 60, y: 100, width: 200, height: 40, borderColor: rgb(0, 0, 0), borderWidth: 1 })
    })
    expect(await pdfSemTexto(bytes)).toBe(true)
  })

  it('PDF com texto em alguma página tem texto', async () => {
    const bytes = await pdfCom(async (doc) => {
      doc.addPage([595, 842])
      const fonte = await doc.embedFont(StandardFonts.Helvetica)
      doc.addPage([595, 842]).drawText('TOTAL R$ 1.234,56', { x: 50, y: 700, size: 12, font: fonte })
    })
    expect(await pdfSemTexto(bytes)).toBe(false)
  })

  it('arquivo que não é PDF responde false', async () => {
    expect(await pdfSemTexto(new TextEncoder().encode('não sou um pdf'))).toBe(false)
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx jest src/lib/leitura-imagem/sem-texto.test.ts`
Expected: FAIL — `Cannot find module './sem-texto'`.

- [ ] **Step 4: Implementar**

```ts
import { extractText, getDocumentProxy } from 'unpdf'

/**
 * O PDF não tem texto nenhum — as letras foram gravadas como desenho (impresso pelo "Microsoft:
 * Print To PDF" com letras em contorno) ou a folha foi escaneada? Mesma pergunta que o Confere faz
 * em `pdf_sem_texto` (services/confere/backend/src/infrastructure/shared/arquivos.py), respondida
 * pelo texto extraível de cada página: só `true` quando nenhuma página tem um caractere sequer.
 * Arquivo que nem abre como PDF responde `false` — a mensagem desse caso é do Confere.
 */
export async function pdfSemTexto(bytes: Uint8Array): Promise<boolean> {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes))
  } catch {
    return false
  }
  const { text } = await extractText(pdf, { mergePages: false })
  return (text as string[]).every((pagina) => pagina.trim() === '')
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx jest src/lib/leitura-imagem/sem-texto.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

Arquivos: `src/lib/leitura-imagem/sem-texto.ts`, `src/lib/leitura-imagem/sem-texto.test.ts`, `package.json`, `package-lock.json` (só a sua mudança — ver Global Constraints).
Mensagem: `feat(leitura-imagem): regra "PDF sem texto" em TypeScript`

---

### Task 2: Achar as linhas da tabela na imagem

**Files:**
- Create: `src/lib/leitura-imagem/linhas.ts`
- Test: `src/lib/leitura-imagem/linhas.test.ts`

**Interfaces:**
- Consumes: `ImagemEmMemoria` de `src/lib/ocr/preprocessarImagem.ts` (`{ data: Uint8ClampedArray; width: number; height: number }`, RGBA).
- Produces:
  ```ts
  export interface Segmento { orientacao: 'h' | 'v'; fixo: number; inicio: number; fim: number } // pixels; 'h': fixo = y, 'v': fixo = x
  export function acharLinhas(imagem: ImagemEmMemoria, opcoes?: Partial<OpcoesLinhas>): Segmento[]
  ```

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { acharLinhas, type Segmento } from './linhas'
import type { ImagemEmMemoria } from '@/lib/ocr/preprocessarImagem'

function branca(largura: number, altura: number): ImagemEmMemoria {
  return { data: new Uint8ClampedArray(largura * altura * 4).fill(255), width: largura, height: altura }
}
function pintar(img: ImagemEmMemoria, x0: number, y0: number, x1: number, y1: number) {
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 0
    }
}
const verticais = (s: Segmento[]) => s.filter((l) => l.orientacao === 'v')
const horizontais = (s: Segmento[]) => s.filter((l) => l.orientacao === 'h')

describe('acharLinhas', () => {
  it('acha a grade de uma tabela: 3 horizontais e 8 verticais', () => {
    const img = branca(1000, 1000)
    for (const y of [100, 200, 300]) pintar(img, 100, y, 800, y + 3)
    for (let x = 100; x <= 800; x += 100) pintar(img, x, 100, x + 3, 303)
    const linhas = acharLinhas(img)
    expect(horizontais(linhas)).toHaveLength(3)
    expect(verticais(linhas)).toHaveLength(8)
    expect(verticais(linhas).map((l) => Math.round(l.fixo))).toEqual([101, 201, 301, 401, 501, 601, 701, 801])
  })

  it('letras (traços curtos) não viram linha', () => {
    const img = branca(1000, 1000)
    for (let x = 100; x < 900; x += 15) pintar(img, x, 500, x + 3, 530)
    expect(acharLinhas(img)).toEqual([])
  })

  it('sublinhado vira horizontal, nunca divisória vertical', () => {
    const img = branca(1000, 1000)
    pintar(img, 200, 400, 500, 403)
    const linhas = acharLinhas(img)
    expect(horizontais(linhas)).toHaveLength(1)
    expect(verticais(linhas)).toHaveLength(0)
  })

  it('linha escaneada com falhas de 2 px é uma linha só', () => {
    const img = branca(1000, 1000)
    for (let y = 100; y < 700; y += 50) pintar(img, 300, y, 302, y + 48)
    const linhas = verticais(acharLinhas(img))
    expect(linhas).toHaveLength(1)
    expect(linhas[0].inicio).toBe(100)
    expect(linhas[0].fim).toBeGreaterThanOrEqual(697)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/leitura-imagem/linhas.test.ts`
Expected: FAIL — `Cannot find module './linhas'`.

- [ ] **Step 3: Implementar**

```ts
import type { ImagemEmMemoria } from '@/lib/ocr/preprocessarImagem'

/** Um traço reto e longo achado na imagem, em pixels. Na horizontal `fixo` é o y; na vertical, o x. */
export interface Segmento {
  orientacao: 'h' | 'v'
  fixo: number
  inicio: number
  fim: number
}

export interface OpcoesLinhas {
  /** Luminância abaixo da qual o pixel é "tinta". */
  limiarEscuro: number
  /** Comprimento mínimo de uma horizontal, em fração da largura da página. */
  fracaoHorizontal: number
  /** Comprimento mínimo de uma vertical, em fração da altura da página. Uma letra de corpo 10 a
   *  ~300 DPI tem ~40 px; 2,5% de uma A4 a 300 DPI são ~88 px. */
  fracaoVertical: number
  /** Falha tolerada dentro de um traço (escaneado), em pixels. */
  lacunaMaxima: number
  /** Distância entre corridas vizinhas para serem a mesma linha (espessura), em pixels. */
  espessuraMaxima: number
}

const PADRAO: OpcoesLinhas = {
  limiarEscuro: 128,
  fracaoHorizontal: 0.08,
  fracaoVertical: 0.025,
  lacunaMaxima: 3,
  espessuraMaxima: 3,
}

interface Corrida {
  fixo: number
  inicio: number
  fim: number
}

/** As corridas de "tinta" de comprimento mínimo ao longo de cada fileira (`fixo` de 0 a `n`). */
function corridas(n: number, m: number, tinta: (fixo: number, pos: number) => boolean, minimo: number, lacuna: number): Corrida[] {
  const achadas: Corrida[] = []
  for (let fixo = 0; fixo < n; fixo++) {
    let inicio = -1
    let ultimo = -1
    for (let pos = 0; pos <= m; pos++) {
      const escuro = pos < m && tinta(fixo, pos)
      if (escuro) {
        if (inicio < 0) inicio = pos
        ultimo = pos
      } else if (inicio >= 0 && pos - ultimo > lacuna) {
        if (ultimo - inicio + 1 >= minimo) achadas.push({ fixo, inicio, fim: ultimo + 1 })
        inicio = -1
      }
    }
  }
  return achadas
}

/** Junta corridas de fileiras vizinhas que se sobrepõem — a espessura do traço — numa linha só. */
function agrupar(lista: Corrida[], espessura: number): Corrida[] {
  const abertos: { soma: number; n: number; ultimo: number; inicio: number; fim: number }[] = []
  const fechados: typeof abertos = []
  for (const c of lista) {
    for (let i = abertos.length - 1; i >= 0; i--) {
      if (c.fixo - abertos[i].ultimo > espessura) fechados.push(...abertos.splice(i, 1))
    }
    const grupo = abertos.find((g) => Math.min(g.fim, c.fim) - Math.max(g.inicio, c.inicio) > 0.5 * Math.min(g.fim - g.inicio, c.fim - c.inicio))
    if (grupo) {
      grupo.soma += c.fixo
      grupo.n += 1
      grupo.ultimo = c.fixo
      grupo.inicio = Math.min(grupo.inicio, c.inicio)
      grupo.fim = Math.max(grupo.fim, c.fim)
    } else {
      abertos.push({ soma: c.fixo, n: 1, ultimo: c.fixo, inicio: c.inicio, fim: c.fim })
    }
  }
  return [...fechados, ...abertos].map((g) => ({ fixo: g.soma / g.n, inicio: g.inicio, fim: g.fim }))
}

/**
 * As linhas retas e longas da página desenhada — as bordas da tabela de itens. É o que o Confere
 * usa para achar as colunas (`analisar_geometria` em grid.py): no PDF escaneado elas não existem
 * como vetor, e no impresso com letras em contorno vêm misturadas a dezenas de milhares de traços
 * de letra. Letra é traço curto; linha de tabela é traço longo — o limite está em `OpcoesLinhas`.
 */
export function acharLinhas(imagem: ImagemEmMemoria, opcoes: Partial<OpcoesLinhas> = {}): Segmento[] {
  const o = { ...PADRAO, ...opcoes }
  const { data, width, height } = imagem
  const tinta = (x: number, y: number) => {
    const i = (y * width + x) * 4
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] < o.limiarEscuro
  }
  const h = corridas(height, width, (y, x) => tinta(x, y), Math.round(width * o.fracaoHorizontal), o.lacunaMaxima)
  const v = corridas(width, height, (x, y) => tinta(x, y), Math.round(height * o.fracaoVertical), o.lacunaMaxima)
  return [
    ...agrupar(h, o.espessuraMaxima).map((s) => ({ orientacao: 'h' as const, ...s })),
    ...agrupar(v, o.espessuraMaxima)
      .map((s) => ({ orientacao: 'v' as const, ...s }))
      .sort((a, b) => a.fixo - b.fixo),
  ]
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/lib/leitura-imagem/linhas.test.ts`
Expected: PASS (4 testes). Se o teste da grade achar a horizontal também como pedaço de vertical (cruzamentos), confira que `fracaoVertical` filtra os 3 px do cruzamento — não afrouxe o teste.

- [ ] **Step 5: Commit**

Arquivos: `src/lib/leitura-imagem/linhas.ts`, `src/lib/leitura-imagem/linhas.test.ts`.
Mensagem: `feat(leitura-imagem): acha as linhas da tabela na imagem da página`

---

### Task 3: Montar o PDF limpo

**Files:**
- Create: `src/lib/leitura-imagem/montar-pdf.ts`
- Test: `src/lib/leitura-imagem/montar-pdf.test.ts`

**Interfaces:**
- Consumes: `Segmento` (Task 2).
- Produces:
  ```ts
  export interface PalavraLida { texto: string; x0: number; y0: number; x1: number; y1: number } // pixels, origem no topo
  export interface PaginaLida { larguraPt: number; alturaPt: number; escala: number; palavras: PalavraLida[]; linhas: Segmento[] }
  export const PRODUTOR_DA_LEITURA = 'VerAI — leitura de imagem'
  export async function montarPdf(paginas: PaginaLida[]): Promise<Uint8Array>
  ```

- [ ] **Step 1: Escrever o teste que falha**

```ts
/** @jest-environment node */
import { PDFDocument } from 'pdf-lib'
import { getDocumentProxy } from 'unpdf'
import { montarPdf, PRODUTOR_DA_LEITURA, type PaginaLida } from './montar-pdf'

const pagina: PaginaLida = {
  larguraPt: 595,
  alturaPt: 842,
  escala: 4,
  palavras: [
    { texto: 'TOTAL', x0: 400, y0: 400, x1: 600, y1: 440 },
    { texto: '1.234,56', x0: 1600, y0: 400, x1: 1900, y1: 440 },
    { texto: 'execução', x0: 400, y0: 600, x1: 700, y1: 640 },
  ],
  linhas: [
    { orientacao: 'v', fixo: 380, inicio: 380, fim: 700 },
    { orientacao: 'h', fixo: 380, inicio: 380, fim: 2000 },
  ],
}

async function itensDeTexto(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(new Uint8Array(bytes))
  const conteudo = await (await pdf.getPage(1)).getTextContent()
  return conteudo.items.filter((i) => 'str' in i) as { str: string; transform: number[] }[]
}

describe('montarPdf', () => {
  it('a página tem o tamanho original e o produtor da leitura', async () => {
    const doc = await PDFDocument.load(await montarPdf([pagina]))
    expect(doc.getPageCount()).toBe(1)
    expect(doc.getPage(0).getSize()).toEqual({ width: 595, height: 842 })
    expect(doc.getProducer()).toBe(PRODUTOR_DA_LEITURA)
  })

  it('cada palavra volta como texto, na posição da caixa (pixel / escala)', async () => {
    const itens = await itensDeTexto(await montarPdf([pagina]))
    const total = itens.find((i) => i.str === 'TOTAL')!
    const valor = itens.find((i) => i.str === '1.234,56')!
    expect(total.transform[4]).toBeCloseTo(100, 0)
    expect(valor.transform[4]).toBeCloseTo(400, 0)
    // y do PDF cresce para cima: a caixa termina 110 pt abaixo do topo.
    expect(total.transform[5]).toBeGreaterThan(842 - 110 - 1)
    expect(total.transform[5]).toBeLessThan(842 - 100)
  })

  it('número passa exatamente como foi lido e acento do português é mantido', async () => {
    const textos = (await itensDeTexto(await montarPdf([pagina]))).map((i) => i.str)
    expect(textos).toContain('1.234,56')
    expect(textos).toContain('execução')
  })

  it('caractere que a fonte não escreve some, o resto da palavra fica', async () => {
    const estranha: PaginaLida = { ...pagina, palavras: [{ texto: 'R$→10', x0: 400, y0: 400, x1: 600, y1: 440 }], linhas: [] }
    expect((await itensDeTexto(await montarPdf([estranha]))).map((i) => i.str)).toContain('R$10')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/leitura-imagem/montar-pdf.test.ts`
Expected: FAIL — `Cannot find module './montar-pdf'`.

- [ ] **Step 3: Implementar**

```ts
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import type { Segmento } from './linhas'

/** Uma palavra lida da imagem, com a caixa em pixels (origem no topo, como o canvas). */
export interface PalavraLida {
  texto: string
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface PaginaLida {
  larguraPt: number
  alturaPt: number
  /** Pixels por ponto da imagem lida (a escala do desenho). */
  escala: number
  palavras: PalavraLida[]
  linhas: Segmento[]
}

/** Só informativo: nenhuma regra depende dele (spec §3.1). */
export const PRODUTOR_DA_LEITURA = 'VerAI — leitura de imagem'

/** Parte da altura da caixa abaixo da linha de base (descendentes). */
const DESCENDENTE = 0.2

/** Os caracteres que a Helvetica padrão (WinAnsi) escreve. Os do português estão todos lá; o que
 *  sobra é ruído da leitura e sai. Dígito nunca sai: é ASCII. */
function escrevivel(texto: string, fonte: PDFFont): string {
  return [...texto]
    .filter((c) => {
      try {
        fonte.encodeText(c)
        return true
      } catch {
        return false
      }
    })
    .join('')
}

/**
 * O PDF limpo que vai ao Confere no lugar do original que é imagem: mesmo número e tamanho de
 * páginas, as linhas da tabela como linhas e cada palavra lida como texto, no lugar da caixa. Os
 * traços das letras do original não vêm — é isso que deixa o PDF leve para o Render free. O texto
 * vai exatamente como foi lido: número nunca é "corrigido" (spec §3.1).
 */
export async function montarPdf(paginas: PaginaLida[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setProducer(PRODUTOR_DA_LEITURA)
  doc.setCreator(PRODUTOR_DA_LEITURA)
  const fonte = await doc.embedFont(StandardFonts.Helvetica)
  const preto = rgb(0, 0, 0)

  for (const p of paginas) {
    const pagina = doc.addPage([p.larguraPt, p.alturaPt])
    const pt = (px: number) => px / p.escala
    const y = (px: number) => p.alturaPt - pt(px)

    for (const l of p.linhas) {
      const [start, end] =
        l.orientacao === 'h'
          ? [{ x: pt(l.inicio), y: y(l.fixo) }, { x: pt(l.fim), y: y(l.fixo) }]
          : [{ x: pt(l.fixo), y: y(l.inicio) }, { x: pt(l.fixo), y: y(l.fim) }]
      pagina.drawLine({ start, end, thickness: 0.75, color: preto })
    }

    for (const palavra of p.palavras) {
      const texto = escrevivel(palavra.texto, fonte)
      if (!texto) continue
      const altura = pt(palavra.y1 - palavra.y0)
      const largura = pt(palavra.x1 - palavra.x0)
      // O tamanho que faz a palavra caber na largura da caixa, sem passar da altura: o Confere lê
      // célula por posição, e palavra que vaza para a coluna vizinha seria lida na coluna errada.
      const tamanho = Math.max(1, Math.min(altura, largura / fonte.widthOfTextAtSize(texto, 1)))
      pagina.drawText(texto, { x: pt(palavra.x0), y: y(palavra.y1) + tamanho * DESCENDENTE, size: tamanho, font: fonte, color: preto })
    }
  }
  return doc.save()
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/lib/leitura-imagem/montar-pdf.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

Arquivos: `src/lib/leitura-imagem/montar-pdf.ts`, `src/lib/leitura-imagem/montar-pdf.test.ts`.
Mensagem: `feat(leitura-imagem): monta o PDF limpo com as linhas e as palavras lidas`

---

### Task 4: `lerPdfDeImagem` — a peça inteira, com desenho e leitura injetados

**Files:**
- Create: `src/lib/leitura-imagem/ler.ts`
- Test: `src/lib/leitura-imagem/ler.test.ts`

**Interfaces:**
- Consumes: `acharLinhas` (Task 2), `montarPdf`, `PalavraLida`, `PaginaLida` (Task 3), `ImagemEmMemoria`.
- Produces:
  ```ts
  export interface PaginaDesenhada { larguraPt: number; alturaPt: number; escala: number; pixels: ImagemEmMemoria; imagem: unknown }
  export interface DepsLeituraImagem {
    totalDePaginas: () => Promise<number>
    desenhar: (pagina: number) => Promise<PaginaDesenhada>
    reconhecer: (imagem: unknown) => Promise<PalavraLida[]>
  }
  export interface ProgressoDaLeitura { pagina: number; total: number }
  export const MAXIMO_DE_PAGINAS = 60
  export class LeituraImagemFalhou extends Error {}
  export async function lerPdfDeImagem(deps: DepsLeituraImagem, aoAvancar?: (p: ProgressoDaLeitura) => void): Promise<{ pdf: Uint8Array; paginas: number }>
  ```

- [ ] **Step 1: Escrever o teste que falha**

```ts
/** @jest-environment node */
import { PDFDocument } from 'pdf-lib'
import { lerPdfDeImagem, LeituraImagemFalhou, MAXIMO_DE_PAGINAS, type DepsLeituraImagem } from './ler'

function deps(paginas: string[][], extra: Partial<DepsLeituraImagem> = {}): DepsLeituraImagem {
  return {
    totalDePaginas: async () => paginas.length,
    desenhar: async (n) => ({
      larguraPt: 595,
      alturaPt: 842,
      escala: 4,
      pixels: { data: new Uint8ClampedArray(100 * 100 * 4).fill(255), width: 100, height: 100 },
      imagem: n,
    }),
    reconhecer: async (imagem) =>
      paginas[(imagem as number) - 1].map((texto, i) => ({ texto, x0: 100, y0: 100 + i * 60, x1: 400, y1: 140 + i * 60 })),
    ...extra,
  }
}

describe('lerPdfDeImagem', () => {
  it('lê página a página, na ordem, e avisa o progresso', async () => {
    const progresso: string[] = []
    const r = await lerPdfDeImagem(deps([['ITEM'], ['TOTAL']]), (p) => progresso.push(`${p.pagina}/${p.total}`))
    expect(r.paginas).toBe(2)
    expect(progresso).toEqual(['1/2', '2/2'])
    expect((await PDFDocument.load(r.pdf)).getPageCount()).toBe(2)
  })

  it('nenhuma palavra em página nenhuma é falha, com motivo', async () => {
    await expect(lerPdfDeImagem(deps([[], []]))).rejects.toThrow(new LeituraImagemFalhou('nenhum texto reconhecido nas 2 páginas'))
  })

  it('falha numa página é falha do arquivo, dizendo a página', async () => {
    const quebra = deps([['A'], ['B']], {
      reconhecer: async (imagem) => {
        if (imagem === 2) throw new Error('worker caiu')
        return [{ texto: 'A', x0: 1, y0: 1, x1: 2, y1: 2 }]
      },
    })
    await expect(lerPdfDeImagem(quebra)).rejects.toThrow('página 2: worker caiu')
  })

  it(`arquivo com mais de ${MAXIMO_DE_PAGINAS} páginas é recusado antes de ler`, async () => {
    const desenhar = jest.fn()
    const grande = deps([], { totalDePaginas: async () => MAXIMO_DE_PAGINAS + 1, desenhar })
    await expect(lerPdfDeImagem(grande)).rejects.toThrow(LeituraImagemFalhou)
    expect(desenhar).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/leitura-imagem/ler.test.ts`
Expected: FAIL — `Cannot find module './ler'`.

- [ ] **Step 3: Implementar**

```ts
import type { ImagemEmMemoria } from '@/lib/ocr/preprocessarImagem'
import { acharLinhas } from './linhas'
import { montarPdf, type PaginaLida, type PalavraLida } from './montar-pdf'

/** Uma página desenhada como imagem: os pixels (para achar as linhas) e a imagem no formato que o
 *  reconhecimento aceita (data URL no navegador, Buffer PNG no Node). */
export interface PaginaDesenhada {
  larguraPt: number
  alturaPt: number
  escala: number
  pixels: ImagemEmMemoria
  imagem: unknown
}

/** O que muda entre Node e navegador: desenhar a página e ler as palavras. Presas a um PDF só. */
export interface DepsLeituraImagem {
  totalDePaginas: () => Promise<number>
  desenhar: (pagina: number) => Promise<PaginaDesenhada>
  reconhecer: (imagem: unknown) => Promise<PalavraLida[]>
}

export interface ProgressoDaLeitura {
  pagina: number
  total: number
}

/** Proposta tem 10–30 páginas; acima disto não é o documento que o Confere espera, e a leitura
 *  levaria tempo demais (no navegador, com a pessoa olhando). */
export const MAXIMO_DE_PAGINAS = 60

export class LeituraImagemFalhou extends Error {
  constructor(motivo: string) {
    super(motivo)
    this.name = 'LeituraImagemFalhou'
  }
}

/**
 * Lê o PDF que é imagem e devolve o PDF limpo para o Confere (spec §3.1). Página a página — uma
 * imagem por vez na memória. Qualquer página que falhe derruba o arquivo inteiro: um contrato com
 * uma página a menos daria um relatório errado, não um relatório parcial.
 */
export async function lerPdfDeImagem(
  deps: DepsLeituraImagem,
  aoAvancar?: (p: ProgressoDaLeitura) => void
): Promise<{ pdf: Uint8Array; paginas: number }> {
  const total = await deps.totalDePaginas()
  if (total > MAXIMO_DE_PAGINAS) {
    throw new LeituraImagemFalhou(`o arquivo tem ${total} páginas — o limite da leitura é ${MAXIMO_DE_PAGINAS}`)
  }
  const lidas: PaginaLida[] = []
  for (let pagina = 1; pagina <= total; pagina++) {
    aoAvancar?.({ pagina, total })
    try {
      const desenhada = await deps.desenhar(pagina)
      const palavras = await deps.reconhecer(desenhada.imagem)
      lidas.push({
        larguraPt: desenhada.larguraPt,
        alturaPt: desenhada.alturaPt,
        escala: desenhada.escala,
        palavras,
        linhas: acharLinhas(desenhada.pixels),
      })
    } catch (erro) {
      throw new LeituraImagemFalhou(`página ${pagina}: ${erro instanceof Error ? erro.message : String(erro)}`)
    }
  }
  if (lidas.every((p) => p.palavras.length === 0)) {
    throw new LeituraImagemFalhou(`nenhum texto reconhecido nas ${total} páginas`)
  }
  return { pdf: await montarPdf(lidas), paginas: total }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/lib/leitura-imagem`
Expected: PASS (todas as suítes da pasta).

- [ ] **Step 5: Commit**

Arquivos: `src/lib/leitura-imagem/ler.ts`, `src/lib/leitura-imagem/ler.test.ts`.
Mensagem: `feat(leitura-imagem): lerPdfDeImagem — página a página, falha com motivo`

---

### Task 5: Desenho e leitura no Node (+ `@napi-rs/canvas`) e o CLI de conferência

**Files:**
- Create: `src/lib/leitura-imagem/deps-node.ts`
- Create: `scripts/ler-pdf-imagem.ts`
- Test: `src/lib/leitura-imagem/deps-node.test.ts` (só roda com `RODAR_LEITURA_REAL=1`: baixa o modelo de português do tesseract)
- Modify: `package.json`, `package-lock.json` (`@napi-rs/canvas`)
- Modify: `.gitignore` (pasta `logs/tesseract/`, se `logs/` ainda não estiver ignorado — confira antes)

**Interfaces:**
- Consumes: `DepsLeituraImagem`, `PaginaDesenhada` (Task 4), `PalavraLida` (Task 3), `binarizarEContrastar` (`src/lib/ocr/preprocessarImagem.ts`).
- Produces:
  ```ts
  export const ESCALA_DA_LEITURA = 4
  export async function criarDepsNode(bytes: Uint8Array): Promise<DepsLeituraImagem & { encerrar: () => Promise<void> }>
  ```
  CLI: `npx tsx scripts/ler-pdf-imagem.ts <entrada.pdf> [saida.pdf]` — grava `<entrada>.lido.pdf` por padrão e imprime páginas, segundos e KB.

- [ ] **Step 1: Instalar**

Run: `npm install @napi-rs/canvas@0.1.80`
Expected: entra em `dependencies`. (Se essa versão não existir, use a mais recente `0.1.x` publicada há mais de duas semanas: `npm view @napi-rs/canvas time --json`.)

- [ ] **Step 2: Escrever o teste (integração, com guarda)**

```ts
/** @jest-environment node */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getDocumentProxy, extractText } from 'unpdf'
import { criarDepsNode } from './deps-node'
import { lerPdfDeImagem } from './ler'

const real = process.env.RODAR_LEITURA_REAL === '1' ? describe : describe.skip

real('criarDepsNode (leitura de verdade — RODAR_LEITURA_REAL=1)', () => {
  jest.setTimeout(180_000)

  it('lê um PDF com tabela e devolve texto e as divisórias', async () => {
    const doc = await PDFDocument.create()
    const fonte = await doc.embedFont(StandardFonts.Helvetica)
    const p = doc.addPage([595, 842])
    for (let x = 50; x <= 540; x += 70) p.drawLine({ start: { x, y: 700 }, end: { x, y: 600 }, thickness: 1, color: rgb(0, 0, 0) })
    p.drawText('TOTAL 1.234,56', { x: 60, y: 650, size: 14, font: fonte })
    const deps = await criarDepsNode(await doc.save())
    try {
      const { pdf } = await lerPdfDeImagem(deps)
      const { text } = await extractText(await getDocumentProxy(pdf), { mergePages: true })
      expect(text).toContain('1.234,56')
    } finally {
      await deps.encerrar()
    }
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `RODAR_LEITURA_REAL=1 npx jest src/lib/leitura-imagem/deps-node.test.ts`
Expected: FAIL — `Cannot find module './deps-node'`.

- [ ] **Step 4: Implementar `deps-node.ts`**

```ts
import { join } from 'node:path'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { createWorker } from 'tesseract.js'
import { getDocumentProxy, renderPageAsImage } from 'unpdf'
import { binarizarEContrastar } from '@/lib/ocr/preprocessarImagem'
import type { DepsLeituraImagem, PaginaDesenhada } from './ler'
import type { PalavraLida } from './montar-pdf'

/** ~300 DPI — o mesmo de `ESCALA_RENDER_OCR` (src/lib/ocr/depsOcrPadrao.ts). */
export const ESCALA_DA_LEITURA = 4

/** Desenho e leitura no Node — agendador e scripts. NUNCA importar numa rota do Next:
 *  `@napi-rs/canvas` é nativo e o tesseract baixa o modelo de português na primeira vez. */
export async function criarDepsNode(bytes: Uint8Array): Promise<DepsLeituraImagem & { encerrar: () => Promise<void> }> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes))
  const worker = await createWorker('por', 1, { cachePath: join(process.cwd(), 'logs', 'tesseract') })

  async function desenhar(numero: number): Promise<PaginaDesenhada> {
    const pagina = await pdf.getPage(numero)
    const { width, height } = pagina.getViewport({ scale: 1 })
    const png = await renderPageAsImage(new Uint8Array(bytes), numero, {
      scale: ESCALA_DA_LEITURA,
      canvasImport: () => import('@napi-rs/canvas'),
    })
    const imagem = await loadImage(Buffer.from(png))
    const canvas = createCanvas(imagem.width, imagem.height)
    const contexto = canvas.getContext('2d')
    contexto.drawImage(imagem, 0, 0)
    const pixels = contexto.getImageData(0, 0, imagem.width, imagem.height)
    binarizarEContrastar(pixels)
    contexto.putImageData(pixels, 0, 0)
    return { larguraPt: width, alturaPt: height, escala: ESCALA_DA_LEITURA, pixels, imagem: canvas.toBuffer('image/png') }
  }

  async function reconhecer(imagem: unknown): Promise<PalavraLida[]> {
    const { data } = await worker.recognize(imagem as Buffer, {}, { blocks: true })
    return (data.blocks ?? []).flatMap((bloco) =>
      bloco.paragraphs.flatMap((paragrafo) =>
        paragrafo.lines.flatMap((linha) =>
          linha.words.map((w) => ({ texto: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 }))
        )
      )
    )
  }

  return {
    totalDePaginas: async () => pdf.numPages,
    desenhar,
    reconhecer,
    encerrar: async () => {
      await worker.terminate()
      await pdf.destroy()
    },
  }
}
```

Se o TypeScript recusar `renderPageAsImage(new Uint8Array(bytes), …)` por já haver um documento aberto, passe `pdf` no lugar dos bytes (a função aceita os dois) — evita reabrir o PDF a cada página.

- [ ] **Step 5: Rodar e ver passar**

Run: `RODAR_LEITURA_REAL=1 npx jest src/lib/leitura-imagem/deps-node.test.ts`
Expected: PASS. E sem a variável: `npx jest src/lib/leitura-imagem` → a suíte aparece como *skipped*.

- [ ] **Step 6: Escrever o CLI `scripts/ler-pdf-imagem.ts`**

```ts
// Lê um PDF que é imagem e grava o PDF limpo ao lado — para conferir à mão o que o Confere vai receber
// (spec docs/superpowers/specs/2026-10-20-confere-contrato-imagem-design.md).
// Uso: npx tsx scripts/ler-pdf-imagem.ts <entrada.pdf> [saida.pdf]
import { readFileSync, writeFileSync } from 'node:fs'
import { criarDepsNode } from '../src/lib/leitura-imagem/deps-node'
import { lerPdfDeImagem } from '../src/lib/leitura-imagem/ler'
import { pdfSemTexto } from '../src/lib/leitura-imagem/sem-texto'

async function main() {
  const [entrada, saida = entrada.replace(/\.pdf$/i, '.lido.pdf')] = process.argv.slice(2)
  if (!entrada) throw new Error('uso: npx tsx scripts/ler-pdf-imagem.ts <entrada.pdf> [saida.pdf]')
  const bytes = new Uint8Array(readFileSync(entrada))
  if (!(await pdfSemTexto(bytes))) console.log('aviso: este PDF tem texto — o Confere já o lê sem leitura de imagem')
  const inicio = Date.now()
  const deps = await criarDepsNode(bytes)
  try {
    const { pdf, paginas } = await lerPdfDeImagem(deps, (p) => process.stdout.write(`\rpágina ${p.pagina} de ${p.total}`))
    writeFileSync(saida, pdf)
    console.log(`\n${paginas} página(s) em ${Math.round((Date.now() - inicio) / 1000)} s → ${saida} (${Math.round(pdf.length / 1024)} KB)`)
  } finally {
    await deps.encerrar()
  }
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro)
  process.exit(1)
})
```

- [ ] **Step 7: Conferir com a proposta real do HSPM**

Run: `npx tsx scripts/ler-pdf-imagem.ts "<pasta ContratosReceita>/HSPM/TC 094-2023 - Sustentação e Melhorias de TIC/1) TC 094-2023 - Contrato Inicial/PC-HSPM-230207-13 v3.0.pdf" logs/hspm.lido.pdf`
(a pasta é `~/rede.sp/rede.sp - ContratosReceita`; copie o arquivo para `logs/` antes se o caminho com espaços atrapalhar.)
Expected: 12 páginas, PDF de dezenas a poucas centenas de KB. Depois:
`services/confere/backend/.venv/Scripts/python.exe -I -c "import sys; sys.path.insert(0,'services/confere/backend/src'); from pathlib import Path; from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor as E; c=E().extrair(Path('logs/hspm.lido.pdf')); print(len(c.itens), c.total_declarado, c.soma_dos_totais)"`
Expected: itens > 0. Anote itens, total e soma no relatório da task — é o primeiro dado real; **não** ajuste constantes aqui (a régua da Task 6 é que mede).

- [ ] **Step 8: Commit**

Arquivos: `src/lib/leitura-imagem/deps-node.ts`, `src/lib/leitura-imagem/deps-node.test.ts`, `scripts/ler-pdf-imagem.ts`, `package.json`, `package-lock.json` (só a sua mudança), `.gitignore` se mudou.
Mensagem: `feat(leitura-imagem): leitura no Node (canvas nativo + tesseract) e CLI de conferência`

---

### Task 6: Régua da leitura de imagem — e PARAR para o critério de aceite

**Files:**
- Create: `services/confere/backend/scripts/extrair_contrato.py`
- Create: `scripts/regua-leitura-imagem.ts`

**Interfaces:**
- Consumes: `pdfSemTexto` (Task 1), `criarDepsNode` (Task 5), `lerPdfDeImagem` (Task 4).
- Produces: `logs/regua-leitura-imagem.json` (`{ quando, arquivos: Record<caminho, Resultado> }`) e o número `LEITURAS_POR_PASSADA` usado na Task 8.

- [ ] **Step 1: CLI de extração do Confere**

```python
"""Extrai um contrato com o extrator do Confere e imprime o resumo em JSON — a régua da leitura de
imagem (VerAI, scripts/regua-leitura-imagem.ts) chama isto para cada PDF lido. Só o extrator: não
importa ``api.main`` (que precisa de ``resource``, ausente no Windows)."""

from __future__ import annotations

import json
import sys
import time
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor  # noqa: E402


def main(caminho: str) -> None:
    inicio = time.monotonic()
    try:
        contrato = PdfPlumberContractExtractor().extrair(Path(caminho))
    except Exception as erro:  # a régua conta a falha, não para
        print(json.dumps({"ok": False, "erro": f"{type(erro).__name__}: {erro}", "segundos": round(time.monotonic() - inicio, 1)}))
        return
    total = contrato.total_declarado
    soma = contrato.soma_dos_totais
    print(
        json.dumps(
            {
                "ok": True,
                "itens": len(contrato.itens),
                "total_declarado": None if total is None else str(total),
                "soma": str(soma),
                "fecha": total is not None and abs(soma - total) <= Decimal("0.01"),
                "segundos": round(time.monotonic() - inicio, 1),
            }
        )
    )


if __name__ == "__main__":
    main(sys.argv[1])
```

Run: `services/confere/backend/.venv/Scripts/python.exe -I services/confere/backend/scripts/extrair_contrato.py services/confere/backend/tests/fixtures/contrato.pdf`
Expected: `{"ok": true, "itens": …, "fecha": true, …}` (fixture com texto — prova que o CLI funciona).

- [ ] **Step 2: Escrever a régua**

```ts
// Régua da leitura de imagem (spec docs/superpowers/specs/2026-10-20-confere-contrato-imagem-design.md §5).
// Acha as PC/PA sem texto da biblioteca, lê cada uma, passa o PDF lido pelo extrator do Confere e conta,
// por tipo de arquivo, quantas fecham a conta (soma dos itens = total declarado).
// Uso: npx tsx scripts/regua-leitura-imagem.ts [--pasta=…] [--salvar] [--limite=N] [--filtro=trecho] [--tipo=impresso|escaneado]
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, relative } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { criarDepsNode } from '../src/lib/leitura-imagem/deps-node'
import { lerPdfDeImagem } from '../src/lib/leitura-imagem/ler'
import { pdfSemTexto } from '../src/lib/leitura-imagem/sem-texto'

type Tipo = 'impresso' | 'escaneado' | 'outro'
interface Resultado {
  tipo: Tipo
  gerador: string
  paginas: number | null
  segundosLeitura: number | null
  kb: number | null
  falhaLeitura: string | null
  itens: number | null
  fecha: boolean
  segundosExtracao: number | null
  erroExtracao: string | null
}

const arg = (nome: string) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.split('=').slice(1).join('=')
const PASTA = arg('pasta') ?? process.env.SHAREPOINT_PASTA ?? join(homedir(), 'rede.sp', 'rede.sp - ContratosReceita')
const BASE = 'logs/regua-leitura-imagem.json'
const SAIDA = 'logs/regua-leitura-imagem'
const PYTHON = existsSync('services/confere/backend/.venv/Scripts/python.exe')
  ? 'services/confere/backend/.venv/Scripts/python.exe'
  : 'services/confere/backend/.venv/bin/python'

function* pdfs(pasta: string): Generator<string> {
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome)
    if (statSync(caminho).isDirectory()) yield* pdfs(caminho)
    else if (/\.pdf$/i.test(nome) && /^(PC|PA)[-_ ]/i.test(nome)) yield caminho
  }
}

function tipoDoGerador(gerador: string): Tipo {
  if (/print to pdf|primopdf|nitro/i.test(gerador)) return 'impresso'
  if (/lexmark|pfu|ilovepdf|scan/i.test(gerador)) return 'escaneado'
  return 'outro'
}

async function gerador(bytes: Uint8Array): Promise<string> {
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true })
    return doc.getProducer() ?? doc.getCreator() ?? '?'
  } catch {
    return '?'
  }
}

async function medir(caminho: string): Promise<Resultado> {
  const bytes = new Uint8Array(readFileSync(caminho))
  const g = await gerador(bytes)
  const r: Resultado = { tipo: tipoDoGerador(g), gerador: g, paginas: null, segundosLeitura: null, kb: null, falhaLeitura: null, itens: null, fecha: false, segundosExtracao: null, erroExtracao: null }
  const inicio = Date.now()
  const deps = await criarDepsNode(bytes)
  let lido: Uint8Array
  try {
    const saida = await lerPdfDeImagem(deps)
    lido = saida.pdf
    r.paginas = saida.paginas
  } catch (erro) {
    r.falhaLeitura = erro instanceof Error ? erro.message : String(erro)
    return r
  } finally {
    await deps.encerrar()
  }
  r.segundosLeitura = Math.round((Date.now() - inicio) / 1000)
  r.kb = Math.round(lido.length / 1024)
  const arquivo = join(SAIDA, `${createHash('sha256').update(bytes).digest('hex')}.pdf`)
  writeFileSync(arquivo, lido)
  const json = JSON.parse(execFileSync(PYTHON, ['-I', 'services/confere/backend/scripts/extrair_contrato.py', arquivo], { encoding: 'utf8', timeout: 900_000 }))
  r.segundosExtracao = json.segundos
  if (!json.ok) r.erroExtracao = json.erro
  else {
    r.itens = json.itens
    r.fecha = json.fecha
  }
  return r
}

function resumo(resultados: Record<string, Resultado>) {
  const porTipo = new Map<Tipo, Resultado[]>()
  for (const r of Object.values(resultados)) porTipo.set(r.tipo, [...(porTipo.get(r.tipo) ?? []), r])
  for (const [tipo, lista] of porTipo) {
    const lidos = lista.filter((r) => !r.falhaLeitura)
    const media = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0)
    console.log(
      `${tipo.padEnd(10)} ${lista.length} arquivo(s) · lidos ${lidos.length} · fecham a conta ${lista.filter((r) => r.fecha).length}` +
        ` · leitura média ${media(lidos.map((r) => r.segundosLeitura ?? 0))} s · extração máx ${Math.max(0, ...lidos.map((r) => r.segundosExtracao ?? 0))} s` +
        ` · PDF lido médio ${media(lidos.map((r) => r.kb ?? 0))} KB`
    )
  }
}

async function main() {
  mkdirSync(SAIDA, { recursive: true })
  const limite = Number(arg('limite') ?? Infinity)
  const filtro = arg('filtro')
  const tipo = arg('tipo')
  const resultados: Record<string, Resultado> = {}
  let n = 0
  for (const caminho of pdfs(PASTA)) {
    const rel = relative(PASTA, caminho).replaceAll('\\', '/')
    if (filtro && !rel.includes(filtro)) continue
    if (!(await pdfSemTexto(new Uint8Array(readFileSync(caminho))))) continue
    if (n++ >= limite) break
    process.stdout.write(`${n}. ${basename(caminho)} … `)
    const r = await medir(caminho)
    if (tipo && r.tipo !== tipo) continue
    resultados[rel] = r
    console.log(r.falhaLeitura ? `não leu (${r.falhaLeitura})` : `${r.itens ?? 0} itens · ${r.fecha ? 'fecha' : 'NÃO fecha'}${r.erroExtracao ? ` · ${r.erroExtracao}` : ''}`)
  }
  console.log('')
  resumo(resultados)

  if (process.argv.includes('--salvar')) {
    writeFileSync(BASE, JSON.stringify({ quando: new Date(), arquivos: resultados }, null, 1))
    console.log(`base salva em ${BASE}`)
    return
  }
  if (!existsSync(BASE)) return
  const base: Record<string, Resultado> = JSON.parse(readFileSync(BASE, 'utf8')).arquivos
  let piorou = 0
  for (const [rel, r] of Object.entries(resultados)) {
    const antes = base[rel]
    if (!antes) continue
    if (antes.fecha && !r.fecha) {
      piorou++
      console.log(`PIOROU  ${rel}`)
    } else if (!antes.fecha && r.fecha) console.log(`melhorou ${rel}`)
  }
  if (piorou > 0) process.exit(1)
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
```

- [ ] **Step 3: Rodar em 5 arquivos (fumaça)**

Run: `npx tsx scripts/regua-leitura-imagem.ts --limite=5`
Expected: 5 linhas por arquivo e o resumo por tipo, sem exceção não tratada.

- [ ] **Step 4: Rodar nos 95 e salvar a base**

Run: `npx tsx scripts/regua-leitura-imagem.ts --salvar` (roda em segundo plano; leva tempo — a leitura média vezes 95).
Expected: `logs/regua-leitura-imagem.json` gravado e o resumo por tipo.

- [ ] **Step 5: Commit**

Arquivos: `services/confere/backend/scripts/extrair_contrato.py`, `scripts/regua-leitura-imagem.ts`.
Mensagem: `feat(leitura-imagem): régua — PC/PA sem texto lidas e passadas pelo extrator do Confere`

- [ ] **Step 6: PARAR — critério de aceite com o usuário**

Mostre ao usuário, em linguagem simples (sem "OCR"): por tipo (impresso × escaneado), quantas fecham a conta, quantas não leram, o tempo médio de leitura e o pior tempo de extração. Proponha:
- o **mínimo de aceite** (ex.: impressos ≥ X de 78 fecham);
- se os **escaneados** entram nesta versão (só se fecharem);
- `LEITURAS_POR_PASSADA` = `floor(20 min / leitura média)` (cabe na passada de 30 min com folga).

Registre a decisão no fim da spec (seção "Decisão da régua (data)") e só siga para a Task 7 com o ok do usuário. Se os impressos não fecharem, a investigação vem antes de qualquer task seguinte — `npx tsx scripts/ler-pdf-imagem.ts` num caso que falhou e compare o PDF lido com o original.

---

### Task 7: Tabela `LeituraImagemPdf` e o acesso a ela

**Files:**
- Create: `prisma/migrations/20261020160000_leitura_imagem_pdf/migration.sql`
- Modify: `prisma/schema.prisma` (model novo, no fim do arquivo)
- Create: `src/lib/leitura-imagem/guardar.ts`
- Test: `src/lib/leitura-imagem/guardar.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const MIGRACAO_DA_LEITURA_IMAGEM = '20261020160000_leitura_imagem_pdf'
  export type SituacaoDaLeitura = 'lido' | 'falhou' | 'com_texto'
  export interface LeituraGuardada { sha256: string; situacao: SituacaoDaLeitura; caminhoLido: string | null }
  export function chaveDoLido(sha256: string): string               // 'leitura-imagem/<sha256>.pdf'
  export async function leiturasPorSha(prisma: PrismaClient, shas: string[]): Promise<Map<string, LeituraGuardada>>
  ```

- [ ] **Step 1: Migração (à mão)**

```sql
-- ConfereAI: versão lida dos PDFs que são imagem (spec 2026-10-20-confere-contrato-imagem-design §3.2).
-- Só tabela nova: o agendador do SharePoint roda o cliente Prisma da pasta contra produção.
CREATE TABLE "LeituraImagemPdf" (
    "id" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "situacao" TEXT NOT NULL,
    "caminhoLido" TEXT,
    "paginas" INTEGER,
    "motivo" TEXT,
    "lidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tentarDepoisDe" TIMESTAMP(3),
    CONSTRAINT "LeituraImagemPdf_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LeituraImagemPdf_sha256_key" ON "LeituraImagemPdf"("sha256");
```

- [ ] **Step 2: Model no `schema.prisma`**

```prisma
// Versão lida de um PDF que é imagem (letras em contorno ou escaneado) — spec
// docs/superpowers/specs/2026-10-20-confere-contrato-imagem-design.md §3.2. Pelo conteúdo (`sha256`), sem
// FK: liga a `ArquivoCliente`/`ArquivoSharepoint` pelo `sha256` que eles já têm. `com_texto` lembra o
// arquivo que NÃO é imagem, para o agendador não baixá-lo de novo. O original nunca é trocado.
model LeituraImagemPdf {
  id             String    @id @default(cuid())
  sha256         String    @unique
  // 'lido' | 'falhou' | 'com_texto'
  situacao       String
  // `r2:leitura-imagem/<sha256>.pdf` quando lido.
  caminhoLido    String?
  paginas        Int?
  motivo         String?
  lidoEm         DateTime  @default(now())
  tentarDepoisDe DateTime?
}
```

Aplicar no dev: `npx dotenv -e .env.development -- npx prisma migrate deploy` e `npx prisma generate`.
Expected: `1 migration applied` (ou a lista com esta) e o cliente gerado sem erro.

- [ ] **Step 3: Escrever o teste que falha**

```ts
import { chaveDoLido, leiturasPorSha } from './guardar'

describe('guardar', () => {
  it('a chave do R2 é pelo conteúdo', () => {
    expect(chaveDoLido('abc')).toBe('leitura-imagem/abc.pdf')
  })

  it('consulta só os sha pedidos e devolve por sha', async () => {
    const findMany = jest.fn().mockResolvedValue([{ sha256: 'a', situacao: 'lido', caminhoLido: 'r2:leitura-imagem/a.pdf' }])
    const prisma = { leituraImagemPdf: { findMany } } as never
    const mapa = await leiturasPorSha(prisma, ['a', 'b', 'a'])
    expect(findMany).toHaveBeenCalledWith({ where: { sha256: { in: ['a', 'b'] } }, select: { sha256: true, situacao: true, caminhoLido: true } })
    expect(mapa.get('a')).toEqual({ sha256: 'a', situacao: 'lido', caminhoLido: 'r2:leitura-imagem/a.pdf' })
    expect(mapa.has('b')).toBe(false)
  })

  it('lista vazia não consulta o banco', async () => {
    const findMany = jest.fn()
    expect((await leiturasPorSha({ leituraImagemPdf: { findMany } } as never, [])).size).toBe(0)
    expect(findMany).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx jest src/lib/leitura-imagem/guardar.test.ts`
Expected: FAIL — `Cannot find module './guardar'`.

- [ ] **Step 5: Implementar**

```ts
import type { PrismaClient } from '@prisma/client'

/** Tabela `LeituraImagemPdf`. O agendador roda contra produção, que pode estar num deploy sem ela. */
export const MIGRACAO_DA_LEITURA_IMAGEM = '20261020160000_leitura_imagem_pdf'

export type SituacaoDaLeitura = 'lido' | 'falhou' | 'com_texto'

export interface LeituraGuardada {
  sha256: string
  situacao: SituacaoDaLeitura
  caminhoLido: string | null
}

/** Pelo conteúdo: o mesmo PDF em dois clientes é lido uma vez só. */
export function chaveDoLido(sha256: string): string {
  return `leitura-imagem/${sha256}.pdf`
}

export async function leiturasPorSha(prisma: PrismaClient, shas: string[]): Promise<Map<string, LeituraGuardada>> {
  const unicos = [...new Set(shas)]
  if (unicos.length === 0) return new Map()
  const linhas = await prisma.leituraImagemPdf.findMany({
    where: { sha256: { in: unicos } },
    select: { sha256: true, situacao: true, caminhoLido: true },
  })
  return new Map(linhas.map((l) => [l.sha256, { ...l, situacao: l.situacao as SituacaoDaLeitura }]))
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx jest src/lib/leitura-imagem/guardar.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

Arquivos: a migração, `src/lib/leitura-imagem/guardar.ts`, `src/lib/leitura-imagem/guardar.test.ts` e `prisma/schema.prisma` **montado a partir do HEAD só com o model novo** (outra sessão tem mudanças nele — ver Global Constraints).
Mensagem: `feat(leitura-imagem): tabela LeituraImagemPdf (só tabela nova)`

---

### Task 8: Etapa do agendador

**Files:**
- Create: `src/lib/leitura-imagem/etapa.ts`
- Test: `src/lib/leitura-imagem/etapa.test.ts`
- Modify: `scripts/sincronizar-sharepoint.ts` (depois de `etapaDosValores`, ~linha 173; e o cabeçalho de opções, linha ~12)

**Interfaces:**
- Consumes: `MIGRACAO_DA_LEITURA_IMAGEM`, `chaveDoLido` (Task 7); `pdfSemTexto` (Task 1); `lerPdfDeImagem` (Task 4); `criarDepsNode` (Task 5); `migracaoAplicada` (`src/lib/migracao-aplicada.ts`); `getUpload` (`src/lib/storage.ts`); `putR2` (`src/lib/r2.ts`).
- Produces:
  ```ts
  export const LEITURAS_POR_PASSADA: number      // o número decidido na Task 6
  export const VERIFICACOES_POR_PASSADA = 200
  export interface Candidato { sha256: string; nome: string; urlBlob: string }
  export interface DepsEtapaLeitura { … }       // abaixo
  export async function etapaDaLeituraDeImagem(prisma: PrismaClient, opcoes: { aplicar: boolean }, deps?: DepsEtapaLeitura): Promise<string[]>
  ```

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { etapaDaLeituraDeImagem, LEITURAS_POR_PASSADA, type DepsEtapaLeitura } from './etapa'

const agora = new Date('2026-10-21T10:00:00Z')

function deps(over: Partial<DepsEtapaLeitura> = {}): DepsEtapaLeitura & { gravados: unknown[] } {
  const gravados: unknown[] = []
  return {
    gravados,
    bancoPronto: async () => true,
    candidatos: async () => [
      { sha256: 's1', nome: 'PC-A.pdf', urlBlob: 'r2:a' },
      { sha256: 's2', nome: 'PC-B.pdf', urlBlob: 'r2:b' },
    ],
    baixar: async (url) => Buffer.from(url),
    semTexto: async (bytes) => bytes.toString() === 'r2:a',
    ler: async () => ({ pdf: new Uint8Array([1, 2, 3]), paginas: 12 }),
    enviar: async (chave) => `r2:${chave}`,
    registrar: async (linha) => {
      gravados.push(linha)
    },
    agora: () => agora,
    ...over,
  }
}

describe('etapaDaLeituraDeImagem', () => {
  it('sem a migração, pula e diz por quê', async () => {
    const d = deps({ bancoPronto: async () => false })
    expect((await etapaDaLeituraDeImagem({} as never, { aplicar: true }, d))[0]).toMatch(/pulado — migração/)
    expect(d.gravados).toEqual([])
  })

  it('sem --aplicar não grava nada', async () => {
    const d = deps()
    await etapaDaLeituraDeImagem({} as never, { aplicar: false }, d)
    expect(d.gravados).toEqual([])
  })

  it('lê o que é imagem, lembra o que tem texto', async () => {
    const d = deps()
    const linhas = await etapaDaLeituraDeImagem({} as never, { aplicar: true }, d)
    expect(d.gravados).toEqual([
      { sha256: 's1', situacao: 'lido', caminhoLido: 'r2:leitura-imagem/s1.pdf', paginas: 12, motivo: null, tentarDepoisDe: null },
      { sha256: 's2', situacao: 'com_texto', caminhoLido: null, paginas: null, motivo: null, tentarDepoisDe: null },
    ])
    expect(linhas[0]).toMatch(/1 lido\(s\) · 0 falha\(s\) · 1 com texto/)
  })

  it('falha de leitura grava o motivo e tenta de novo depois de 24 h', async () => {
    const d = deps({ ler: async () => Promise.reject(new Error('página 3: worker caiu')) })
    await etapaDaLeituraDeImagem({} as never, { aplicar: true }, d)
    expect(d.gravados[0]).toEqual({
      sha256: 's1',
      situacao: 'falhou',
      caminhoLido: null,
      paginas: null,
      motivo: 'página 3: worker caiu',
      tentarDepoisDe: new Date('2026-10-22T10:00:00Z'),
    })
  })

  it(`lê no máximo ${LEITURAS_POR_PASSADA} por passada`, async () => {
    const muitos = Array.from({ length: LEITURAS_POR_PASSADA + 3 }, (_, i) => ({ sha256: `s${i}`, nome: `PC-${i}.pdf`, urlBlob: 'r2:a' }))
    const ler = jest.fn(async () => ({ pdf: new Uint8Array([1]), paginas: 1 }))
    await etapaDaLeituraDeImagem({} as never, { aplicar: true }, deps({ candidatos: async () => muitos, ler }))
    expect(ler).toHaveBeenCalledTimes(LEITURAS_POR_PASSADA)
  })

  it('erro inesperado vira linha de log, nunca exceção', async () => {
    const d = deps({ candidatos: async () => Promise.reject(new Error('banco fora')) })
    expect((await etapaDaLeituraDeImagem({} as never, { aplicar: true }, d))[0]).toMatch(/falhou — banco fora/)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/leitura-imagem/etapa.test.ts`
Expected: FAIL — `Cannot find module './etapa'`.

- [ ] **Step 3: Implementar** (troque `10` pelo número decidido na Task 6)

```ts
import type { PrismaClient } from '@prisma/client'
import { migracaoAplicada } from '@/lib/migracao-aplicada'
import { putR2 } from '@/lib/r2'
import { getUpload } from '@/lib/storage'
import { chaveDoLido, MIGRACAO_DA_LEITURA_IMAGEM, type SituacaoDaLeitura } from './guardar'
import { lerPdfDeImagem } from './ler'
import { pdfSemTexto } from './sem-texto'

// Etapa "leitura de imagem" no fim de scripts/sincronizar-sharepoint.ts (spec
// docs/superpowers/specs/2026-10-20-confere-contrato-imagem-design.md §3.3). Lê de antemão as PC/PA que
// são imagem, para o ConfereAI não fazer ninguém esperar. Nunca lança e nunca muda o código de saída.

/** Decidido pela régua (Task 6 do plano): leitura média × isto cabe na passada de 30 min com folga. */
export const LEITURAS_POR_PASSADA = 10
/** Arquivos baixados só para saber se são imagem, por passada (a primeira passada tem ~470). */
export const VERIFICACOES_POR_PASSADA = 200
const ESPERA_DEPOIS_DE_FALHAR_MS = 24 * 60 * 60 * 1000

export interface Candidato {
  sha256: string
  nome: string
  urlBlob: string
}

export interface LinhaDaLeitura {
  sha256: string
  situacao: SituacaoDaLeitura
  caminhoLido: string | null
  paginas: number | null
  motivo: string | null
  tentarDepoisDe: Date | null
}

export interface DepsEtapaLeitura {
  bancoPronto: () => Promise<boolean>
  candidatos: () => Promise<Candidato[]>
  baixar: (urlBlob: string) => Promise<Buffer>
  semTexto: (bytes: Buffer) => Promise<boolean>
  ler: (bytes: Buffer) => Promise<{ pdf: Uint8Array; paginas: number }>
  enviar: (chave: string, pdf: Uint8Array) => Promise<string>
  registrar: (linha: LinhaDaLeitura) => Promise<void>
  agora: () => Date
}

const PROPOSTA = /^(PC|PA)[-_ ]/i

/** PC/PA ativas da biblioteca cujo conteúdo ainda não tem linha em `LeituraImagemPdf` — ou cuja
 *  falha já pode ser tentada de novo. */
async function candidatosDoBanco(prisma: PrismaClient, agora: Date): Promise<Candidato[]> {
  const [arquivos, conhecidos] = await Promise.all([
    prisma.arquivoSharepoint.findMany({
      where: { removidoNaOrigemEm: null, arquivo: { is: { removidoEm: null, extensao: 'pdf' } } },
      select: { sha256: true, caminho: true, arquivo: { select: { urlBlob: true } } },
    }),
    prisma.leituraImagemPdf.findMany({
      where: { OR: [{ situacao: { not: 'falhou' } }, { tentarDepoisDe: { gt: agora } }] },
      select: { sha256: true },
    }),
  ])
  const pular = new Set(conhecidos.map((c) => c.sha256))
  const vistos = new Set<string>()
  const candidatos: Candidato[] = []
  for (const a of arquivos) {
    const nome = a.caminho.split('/').pop() ?? a.caminho
    if (!PROPOSTA.test(nome) || !a.arquivo || pular.has(a.sha256) || vistos.has(a.sha256)) continue
    vistos.add(a.sha256)
    candidatos.push({ sha256: a.sha256, nome, urlBlob: a.arquivo.urlBlob })
  }
  return candidatos
}

function depsPadrao(prisma: PrismaClient): DepsEtapaLeitura {
  return {
    bancoPronto: () => migracaoAplicada(prisma, MIGRACAO_DA_LEITURA_IMAGEM),
    candidatos: () => candidatosDoBanco(prisma, new Date()),
    baixar: getUpload,
    semTexto: (bytes) => pdfSemTexto(new Uint8Array(bytes)),
    ler: async (bytes) => {
      // Import tardio: o canvas nativo e o tesseract só carregam quando há o que ler.
      const { criarDepsNode } = await import('./deps-node')
      const deps = await criarDepsNode(new Uint8Array(bytes))
      try {
        return await lerPdfDeImagem(deps)
      } finally {
        await deps.encerrar()
      }
    },
    enviar: (chave, pdf) => putR2(chave, Buffer.from(pdf), 'application/pdf'),
    registrar: async (linha) => {
      await prisma.leituraImagemPdf.upsert({
        where: { sha256: linha.sha256 },
        create: { ...linha, lidoEm: new Date() },
        update: { ...linha, lidoEm: new Date() },
      })
    },
    agora: () => new Date(),
  }
}

export async function etapaDaLeituraDeImagem(
  prisma: PrismaClient,
  opcoes: { aplicar: boolean },
  deps: DepsEtapaLeitura = depsPadrao(prisma)
): Promise<string[]> {
  try {
    if (!(await deps.bancoPronto())) return [`leitura de imagem: pulado — migração ${MIGRACAO_DA_LEITURA_IMAGEM} não aplicada neste banco`]
    const candidatos = (await deps.candidatos()).slice(0, VERIFICACOES_POR_PASSADA)
    if (!opcoes.aplicar) return [`leitura de imagem: ${candidatos.length} arquivo(s) a verificar (sem --aplicar, nada é lido)`]

    let lidos = 0
    let falhas = 0
    let comTexto = 0
    const detalhes: string[] = []
    for (const c of candidatos) {
      const bytes = await deps.baixar(c.urlBlob)
      if (!(await deps.semTexto(bytes))) {
        comTexto++
        await deps.registrar({ sha256: c.sha256, situacao: 'com_texto', caminhoLido: null, paginas: null, motivo: null, tentarDepoisDe: null })
        continue
      }
      if (lidos + falhas >= LEITURAS_POR_PASSADA) continue
      try {
        const { pdf, paginas } = await deps.ler(bytes)
        const caminhoLido = await deps.enviar(chaveDoLido(c.sha256), pdf)
        await deps.registrar({ sha256: c.sha256, situacao: 'lido', caminhoLido, paginas, motivo: null, tentarDepoisDe: null })
        lidos++
      } catch (erro) {
        const motivo = erro instanceof Error ? erro.message : String(erro)
        await deps.registrar({
          sha256: c.sha256,
          situacao: 'falhou',
          caminhoLido: null,
          paginas: null,
          motivo,
          tentarDepoisDe: new Date(deps.agora().getTime() + ESPERA_DEPOIS_DE_FALHAR_MS),
        })
        falhas++
        detalhes.push(`  não leu ${c.nome}: ${motivo}`)
      }
    }
    return [`leitura de imagem: ${lidos} lido(s) · ${falhas} falha(s) · ${comTexto} com texto · ${candidatos.length} verificado(s)`, ...detalhes]
  } catch (erro) {
    return [`leitura de imagem: falhou — ${erro instanceof Error ? erro.message : String(erro)} (a próxima rodada tenta de novo)`]
  }
}
```

Note: o arquivo de imagem que passou do limite da passada (`continue` sem registrar) volta como candidato na passada seguinte.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/lib/leitura-imagem/etapa.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Ligar no agendador**

Em `scripts/sincronizar-sharepoint.ts`, no import (junto dos outros `etapa…`):

```ts
import { etapaDaLeituraDeImagem } from '../src/lib/leitura-imagem/etapa'
```

E logo depois da linha `if (comValores) console.log(`\n${(await etapaDosValores(prisma, { aplicar })).join('\n')}`)`:

```ts
    // PC/PA que são imagem (letras em contorno ou escaneadas), lidas de antemão para o ConfereAI (spec
    // 2026-10-20-confere-contrato-imagem). Pulada com --clientes (passada parcial) e --sem-leitura-imagem.
    // Não muda o código de saída.
    if (!clientes && !process.argv.includes('--sem-leitura-imagem')) {
      console.log(`\n${(await etapaDaLeituraDeImagem(prisma, { aplicar })).join('\n')}`)
    }
```

No comentário de opções do topo do arquivo, acrescente `--sem-leitura-imagem (pula a leitura das propostas que são imagem)` depois de `--sem-valores (…)`.

- [ ] **Step 6: Rodar no dev, simulando e aplicando**

Run: `npx dotenv -e .env.development -- npx tsx scripts/sincronizar-sharepoint.ts --sem-documentos --sem-valores`
Expected: no fim, `leitura de imagem: N arquivo(s) a verificar (sem --aplicar, nada é lido)`.
(Com `--aplicar` no dev: dev e produção dividem o bucket do R2 — as chaves `leitura-imagem/<sha256>.pdf` são pelo conteúdo e servem aos dois; pode rodar.)

- [ ] **Step 7: Commit**

Arquivos: `src/lib/leitura-imagem/etapa.ts`, `src/lib/leitura-imagem/etapa.test.ts`, `scripts/sincronizar-sharepoint.ts`.
Mensagem: `feat(leitura-imagem): etapa do agendador — lê de antemão as PC/PA que são imagem`

---

### Task 9: Proxy do ConfereAI usa a versão lida; histórico marca; tela recebe a situação

**Files:**
- Create: `src/lib/leitura-imagem/no-confere.ts`
- Test: `src/lib/leitura-imagem/no-confere.test.ts`
- Modify: `src/lib/confere/cadastro.ts` (`ArquivoBaixado`, `carregarArquivosDoCadastro` seleciona `sha256`; `carregarDocumentos` anota)
- Modify: `src/lib/confere/tipos-cadastro.ts` (`DocumentoDoCadastro.leituraDeImagem`)
- Modify: `src/app/api/confere/reports/route.ts` (troca + histórico com o original)
- Modify: `src/lib/confere/historico.ts` (`lidoDeImagem` na entrada guardada)
- Test: `src/app/api/confere/reports/route.test.ts` (caso novo)

**Interfaces:**
- Consumes: `leiturasPorSha` (Task 7); `getUpload`.
- Produces:
  ```ts
  // cadastro.ts
  export interface ArquivoBaixado { nome: string; bytes: Buffer; sha256?: string; original?: Buffer; lidoDeImagem?: boolean }
  // tipos-cadastro.ts — DocumentoDoCadastro ganha:
  leituraDeImagem?: 'lido' | 'falhou' | null
  // no-confere.ts
  export async function trocarPelasVersoesLidas(arquivos: Map<string, ArquivoBaixado>, deps?: DepsTroca): Promise<Map<string, ArquivoBaixado>>
  export async function anotarLeituras(documentos: DocumentoDoCadastro[], deps?: DepsAnotar): Promise<void>
  // historico.ts — EntradaParaGuardar e EntradaGuardada ganham:
  lidoDeImagem?: boolean
  ```

- [ ] **Step 1: Escrever o teste que falha (`no-confere.test.ts`)**

```ts
import { anotarLeituras, trocarPelasVersoesLidas } from './no-confere'

const lido = { sha256: 'a', situacao: 'lido' as const, caminhoLido: 'r2:leitura-imagem/a.pdf' }

describe('trocarPelasVersoesLidas', () => {
  it('troca os bytes pela versão lida e guarda o original', async () => {
    const original = Buffer.from('original')
    const entrada = new Map([['id1', { nome: 'PC.pdf', bytes: original, sha256: 'a' }]])
    const saida = await trocarPelasVersoesLidas(entrada, {
      leituras: async () => new Map([['a', lido]]),
      baixar: async () => Buffer.from('lido'),
    })
    expect(saida.get('id1')).toEqual({ nome: 'PC.pdf', bytes: Buffer.from('lido'), sha256: 'a', original, lidoDeImagem: true })
  })

  it('sem leitura, falhou ou com texto: fica como veio', async () => {
    const entrada = new Map([['id1', { nome: 'PC.pdf', bytes: Buffer.from('x'), sha256: 'a' }]])
    const saida = await trocarPelasVersoesLidas(entrada, {
      leituras: async () => new Map([['a', { ...lido, situacao: 'falhou' as const, caminhoLido: null }]]),
      baixar: jest.fn(),
    })
    expect(saida.get('id1')).toEqual(entrada.get('id1'))
  })
})

describe('anotarLeituras', () => {
  it('marca lido/falhou; com_texto e sem linha ficam null', async () => {
    const docs = [
      { arquivoId: '1', nome: 'A', origem: null },
      { arquivoId: '2', nome: 'B', origem: null },
      { arquivoId: '3', nome: 'C', origem: null },
    ]
    await anotarLeituras(docs, {
      shaDosArquivos: async () => new Map([['1', 'a'], ['2', 'b'], ['3', 'c']]),
      leituras: async () =>
        new Map([
          ['a', lido],
          ['b', { sha256: 'b', situacao: 'falhou' as const, caminhoLido: null }],
          ['c', { sha256: 'c', situacao: 'com_texto' as const, caminhoLido: null }],
        ]),
    })
    expect(docs.map((d) => (d as { leituraDeImagem?: unknown }).leituraDeImagem)).toEqual(['lido', 'falhou', null])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/leitura-imagem/no-confere.test.ts`
Expected: FAIL — `Cannot find module './no-confere'`.

- [ ] **Step 3: Tipos**

Em `src/lib/confere/cadastro.ts`, substitua a interface:

```ts
export interface ArquivoBaixado {
  nome: string
  /** O que vai ao Confere: o original, ou a versão lida quando o original é imagem. */
  bytes: Buffer
  sha256?: string
  /** O original, quando `bytes` é a versão lida — é ele que vai para o histórico ("Ver no PDF"). */
  original?: Buffer
  lidoDeImagem?: boolean
}
```

Em `carregarArquivosDoCadastro`, acrescente `sha256: true` ao `select` do `prisma.arquivoCliente.findMany` e devolva `{ nome: arquivo.nome, bytes: await getUpload(arquivo.urlBlob), sha256: arquivo.sha256 }`.

Em `src/lib/confere/tipos-cadastro.ts`, dentro de `DocumentoDoCadastro`, depois de `pasta?`:

```ts
  /** O PDF é imagem? `'lido'`: o agendador já leu o texto e o ConfereAI usa a versão lida; `'falhou'`:
   *  não deu para ler. Ausente/`null`: PDF comum (spec 2026-10-20-confere-contrato-imagem §3.4). */
  leituraDeImagem?: 'lido' | 'falhou' | null
```

- [ ] **Step 4: Implementar `no-confere.ts`**

```ts
import { prisma } from '@/lib/prisma'
import { getUpload } from '@/lib/storage'
import type { ArquivoBaixado } from '@/lib/confere/cadastro'
import type { DocumentoDoCadastro } from '@/lib/confere/tipos-cadastro'
import { leiturasPorSha, type LeituraGuardada } from './guardar'

export interface DepsTroca {
  leituras: (shas: string[]) => Promise<Map<string, LeituraGuardada>>
  baixar: (caminho: string) => Promise<Buffer>
}

/** O PDF do cadastro que é imagem vai ao Confere na versão lida (spec §3.4); o original fica em
 *  `original`, para o histórico. Sem leitura `lido`, o arquivo segue como veio — e o Confere recusa
 *  com a mensagem de PDF sem texto, como hoje. */
export async function trocarPelasVersoesLidas(
  arquivos: Map<string, ArquivoBaixado>,
  deps: DepsTroca = { leituras: (shas) => leiturasPorSha(prisma, shas), baixar: getUpload }
): Promise<Map<string, ArquivoBaixado>> {
  const shas = [...arquivos.values()].map((a) => a.sha256).filter((s): s is string => Boolean(s))
  const leituras = await deps.leituras(shas)
  const saida = new Map<string, ArquivoBaixado>()
  for (const [id, arquivo] of arquivos) {
    const leitura = arquivo.sha256 ? leituras.get(arquivo.sha256) : undefined
    if (leitura?.situacao === 'lido' && leitura.caminhoLido) {
      saida.set(id, { ...arquivo, bytes: await deps.baixar(leitura.caminhoLido), original: arquivo.bytes, lidoDeImagem: true })
    } else {
      saida.set(id, arquivo)
    }
  }
  return saida
}

export interface DepsAnotar {
  shaDosArquivos: (ids: string[]) => Promise<Map<string, string>>
  leituras: (shas: string[]) => Promise<Map<string, LeituraGuardada>>
}

/** Marca cada documento do cadastro com a situação da leitura de imagem — a tela mostra o aviso. */
export async function anotarLeituras(
  documentos: DocumentoDoCadastro[],
  deps: DepsAnotar = {
    shaDosArquivos: async (ids) =>
      new Map(
        (await prisma.arquivoCliente.findMany({ where: { id: { in: ids } }, select: { id: true, sha256: true } })).map((a) => [a.id, a.sha256])
      ),
    leituras: (shas) => leiturasPorSha(prisma, shas),
  }
): Promise<void> {
  if (documentos.length === 0) return
  const shaPorId = await deps.shaDosArquivos([...new Set(documentos.map((d) => d.arquivoId))])
  const leituras = await deps.leituras([...shaPorId.values()])
  for (const d of documentos) {
    const situacao = leituras.get(shaPorId.get(d.arquivoId) ?? '')?.situacao
    d.leituraDeImagem = situacao === 'lido' || situacao === 'falhou' ? situacao : null
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx jest src/lib/leitura-imagem/no-confere.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 6: Ligar no cadastro, no proxy e no histórico**

`src/lib/confere/cadastro.ts`, em `carregarDocumentos`, antes do `return {`:

```ts
  // Situação da leitura de imagem de cada PDF (spec 2026-10-20-confere-contrato-imagem §3.4) — o aviso da tela.
  await anotarLeituras([...(escolha.base ? [escolha.base] : []), ...escolha.aditivos, ...alternativas])
```
(import: `import { anotarLeituras } from '@/lib/leitura-imagem/no-confere'`.)

`src/app/api/confere/reports/route.ts`, logo depois do `try { doCadastro = await carregarArquivosDoCadastro(…) } catch …`:

```ts
  // PDF do cadastro que é imagem vai na versão lida pelo agendador (spec 2026-10-20-confere-contrato-imagem §3.4).
  doCadastro = await trocarPelasVersoesLidas(doCadastro)
```
(import: `import { trocarPelasVersoesLidas } from '@/lib/leitura-imagem/no-confere'`.)

E as entradas do histórico passam a levar o original e a marca:

```ts
  const entradasDoHistorico = [
    {
      papel: 'contrato' as const,
      nome: parametros.contrato.nome,
      bytes: parametros.contrato.original ?? parametros.contrato.bytes,
      lidoDeImagem: parametros.contrato.lidoDeImagem,
    },
    ...parametros.aditivos.map((aditivo) => ({
      papel: 'aditivo' as const,
      nome: aditivo.nome,
      bytes: aditivo.original ?? aditivo.bytes,
      lidoDeImagem: aditivo.lidoDeImagem,
    })),
    { papel: 'levantamento' as const, nome: levantamento.name, bytes: planilha.bytes },
  ]
```
(`paraArquivo(...)` devolve `ArquivoBaixado` sem `original`/`lidoDeImagem` — o `??` cobre.)

No mesmo arquivo, no ramo assíncrono, o `return { papel: entrada.papel, nome: entrada.nome, caminho }` vira:

```ts
              return { papel: entrada.papel, nome: entrada.nome, caminho, ...(entrada.lidoDeImagem ? { lidoDeImagem: true } : {}) }
```

`src/lib/confere/historico.ts`: em `EntradaParaGuardar` e em `EntradaGuardada` acrescente `lidoDeImagem?: boolean`; e o `return { papel: entrada.papel, nome: entrada.nome, caminho }` dentro de `registrarNoHistorico` vira o mesmo do ramo assíncrono acima.

- [ ] **Step 7: Teste do proxy**

Em `src/app/api/confere/reports/route.test.ts`, siga o padrão dos casos que mandam `contrato_arquivo_id` e acrescente um em que `@/lib/leitura-imagem/no-confere` é mockado:

```ts
jest.mock('@/lib/leitura-imagem/no-confere', () => ({
  trocarPelasVersoesLidas: jest.fn(async (m) => m),
}))
```

com um caso que faz `trocarPelasVersoesLidas` devolver o contrato com `bytes: Buffer.from('lido')`, `original: Buffer.from('original')`, `lidoDeImagem: true`, e confere: (a) o que vai a `chamarConfere`/`iniciarNoConfere` tem `contrato.bytes` = `'lido'`; (b) a entrada do histórico do contrato tem `bytes` = `'original'` e `lidoDeImagem: true`. Use os helpers e mocks já existentes no arquivo (leia o topo dele antes) — não crie um segundo jeito de montar a requisição.

Run: `npx jest src/app/api/confere src/lib/confere src/lib/leitura-imagem`
Expected: PASS.

- [ ] **Step 8: Commit**

Arquivos: `src/lib/leitura-imagem/no-confere.ts`, `src/lib/leitura-imagem/no-confere.test.ts`, `src/lib/confere/cadastro.ts`, `src/lib/confere/tipos-cadastro.ts`, `src/app/api/confere/reports/route.ts`, `src/app/api/confere/reports/route.test.ts`, `src/lib/confere/historico.ts`.
Mensagem: `feat(confere): contrato do cadastro que é imagem vai ao Confere na versão lida`

---

### Task 10: Arquivo enviado do computador é lido no navegador

**Files:**
- Create: `src/lib/leitura-imagem/deps-navegador.ts`
- Create: `src/lib/leitura-imagem/preparar.ts`
- Test: `src/lib/leitura-imagem/preparar.test.ts`
- Modify: `src/app/confere/lib/api.ts` (`gerarRelatorio`)
- Test: `src/app/confere/lib/api.test.ts` (caso novo)

**Interfaces:**
- Consumes: `pdfSemTexto` (Task 1), `lerPdfDeImagem`, `LeituraImagemFalhou`, `DepsLeituraImagem` (Task 4), `binarizarEContrastar`, `ProgressoDoServidor` (`src/app/confere/lib/api.ts`).
- Produces:
  ```ts
  // deps-navegador.ts
  export async function criarDepsNavegador(bytes: Uint8Array): Promise<DepsLeituraImagem & { encerrar: () => Promise<void> }>
  // preparar.ts
  export interface Preparado { arquivo: File; lidoDeImagem: boolean }
  export async function prepararParaOConfere(arquivo: File, rotulo: string, aoAvancar?: (fase: string) => void, deps?: DepsPreparar): Promise<Preparado>
  ```

- [ ] **Step 1: `deps-navegador.ts`** (sem teste unitário: é a fronteira com canvas e worker, como `depsOcrPadrao.ts`)

```ts
import { binarizarEContrastar } from '@/lib/ocr/preprocessarImagem'
import type { DepsLeituraImagem, PaginaDesenhada } from './ler'
import type { PalavraLida } from './montar-pdf'

/** ~300 DPI — o mesmo de `ESCALA_RENDER_OCR` (src/lib/ocr/depsOcrPadrao.ts) e de `ESCALA_DA_LEITURA`. */
const ESCALA = 4

/** Desenho e leitura no navegador, para o arquivo enviado do computador no ConfereAI. Carregados
 *  por `import()` — só entram no bundle quando um PDF que é imagem aparece. */
export async function criarDepsNavegador(bytes: Uint8Array): Promise<DepsLeituraImagem & { encerrar: () => Promise<void> }> {
  const { getDocumentProxy } = await import('unpdf')
  const { createWorker } = await import('tesseract.js')
  const pdf = await getDocumentProxy(new Uint8Array(bytes))
  const worker = await createWorker('por')

  async function desenhar(numero: number): Promise<PaginaDesenhada> {
    const pagina = await pdf.getPage(numero)
    const base = pagina.getViewport({ scale: 1 })
    const viewport = pagina.getViewport({ scale: ESCALA })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const contexto = canvas.getContext('2d')
    if (!contexto) throw new Error('não foi possível criar o contexto de canvas')
    await pagina.render({ canvas, canvasContext: contexto, viewport }).promise
    const pixels = contexto.getImageData(0, 0, canvas.width, canvas.height)
    binarizarEContrastar(pixels)
    contexto.putImageData(pixels, 0, 0)
    return { larguraPt: base.width, alturaPt: base.height, escala: ESCALA, pixels, imagem: canvas.toDataURL('image/png') }
  }

  async function reconhecer(imagem: unknown): Promise<PalavraLida[]> {
    const { data } = await worker.recognize(imagem as string, {}, { blocks: true })
    return (data.blocks ?? []).flatMap((bloco) =>
      bloco.paragraphs.flatMap((paragrafo) =>
        paragrafo.lines.flatMap((linha) =>
          linha.words.map((w) => ({ texto: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 }))
        )
      )
    )
  }

  return {
    totalDePaginas: async () => pdf.numPages,
    desenhar,
    reconhecer,
    encerrar: async () => {
      await worker.terminate()
      await pdf.destroy()
    },
  }
}
```

- [ ] **Step 2: Escrever o teste que falha (`preparar.test.ts`)**

```ts
import { prepararParaOConfere } from './preparar'

const arquivo = () => new File([new Uint8Array([1, 2, 3])], 'PC-X.pdf', { type: 'application/pdf' })

describe('prepararParaOConfere', () => {
  it('PDF com texto segue como veio', async () => {
    const original = arquivo()
    const r = await prepararParaOConfere(original, 'o contrato', undefined, { semTexto: async () => false, ler: jest.fn() })
    expect(r).toEqual({ arquivo: original, lidoDeImagem: false })
  })

  it('PDF que é imagem vai lido, com o mesmo nome, e mostra o progresso sem a palavra OCR', async () => {
    const fases: string[] = []
    const r = await prepararParaOConfere(arquivo(), 'o contrato', (f) => fases.push(f), {
      semTexto: async () => true,
      ler: async (_bytes, aoAvancar) => {
        aoAvancar?.({ pagina: 3, total: 12 })
        return { pdf: new Uint8Array([9]), paginas: 12 }
      },
    })
    expect(r.lidoDeImagem).toBe(true)
    expect(r.arquivo.name).toBe('PC-X.pdf')
    expect(new Uint8Array(await r.arquivo.arrayBuffer())).toEqual(new Uint8Array([9]))
    expect(fases).toEqual(['Lendo o contrato, que é uma imagem… página 3 de 12'])
    expect(fases.join(' ')).not.toMatch(/ocr/i)
  })

  it('leitura que falha devolve o original — o Confere responde com a mensagem de PDF sem texto', async () => {
    const original = arquivo()
    const r = await prepararParaOConfere(original, 'o contrato', undefined, {
      semTexto: async () => true,
      ler: async () => Promise.reject(new Error('página 1: worker caiu')),
    })
    expect(r).toEqual({ arquivo: original, lidoDeImagem: false })
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx jest src/lib/leitura-imagem/preparar.test.ts`
Expected: FAIL — `Cannot find module './preparar'`.

- [ ] **Step 4: Implementar `preparar.ts`**

```ts
import type { ProgressoDaLeitura } from './ler'

export interface Preparado {
  arquivo: File
  lidoDeImagem: boolean
}

export interface DepsPreparar {
  semTexto: (bytes: Uint8Array) => Promise<boolean>
  ler: (bytes: Uint8Array, aoAvancar?: (p: ProgressoDaLeitura) => void) => Promise<{ pdf: Uint8Array; paginas: number }>
}

const depsPadrao: DepsPreparar = {
  semTexto: async (bytes) => (await import('./sem-texto')).pdfSemTexto(bytes),
  ler: async (bytes, aoAvancar) => {
    const [{ criarDepsNavegador }, { lerPdfDeImagem }] = await Promise.all([import('./deps-navegador'), import('./ler')])
    const deps = await criarDepsNavegador(bytes)
    try {
      return await lerPdfDeImagem(deps, aoAvancar)
    } finally {
      await deps.encerrar()
    }
  },
}

/**
 * O PDF enviado do computador, pronto para o Confere (spec 2026-10-20-confere-contrato-imagem §3.4): se
 * é imagem, lê o texto ali mesmo e devolve o PDF lido com o mesmo nome. `rotulo` entra na frase do
 * progresso ("o contrato", "o aditivo 2"). Se a leitura falha, devolve o original: o Confere recusa
 * com a mensagem de PDF sem texto, que já diz o que fazer.
 */
export async function prepararParaOConfere(
  arquivo: File,
  rotulo: string,
  aoAvancar?: (fase: string) => void,
  deps: DepsPreparar = depsPadrao
): Promise<Preparado> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  if (!(await deps.semTexto(bytes))) return { arquivo, lidoDeImagem: false }
  try {
    const { pdf } = await deps.ler(bytes, (p) => aoAvancar?.(`Lendo ${rotulo}, que é uma imagem… página ${p.pagina} de ${p.total}`))
    return { arquivo: new File([pdf], arquivo.name, { type: 'application/pdf' }), lidoDeImagem: true }
  } catch {
    return { arquivo, lidoDeImagem: false }
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx jest src/lib/leitura-imagem/preparar.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 6: Ligar em `gerarRelatorio`** (`src/app/confere/lib/api.ts`)

No começo da função, antes de `const corpo = new FormData();`:

```ts
	// Spec 2026-10-20-confere-contrato-imagem §3.4 — PDF do computador que é imagem é lido aqui, no
	// navegador; o do cadastro já vem lido do servidor. `algumLido` decide a dica do bloqueio.
	const { prepararParaOConfere } = await import("@/lib/leitura-imagem/preparar");
	const avisarLeitura = (fase: string) => aoAvancar?.({ situacao: "processando", fase, posicao: 0 });
	const contratoPronto =
		entrada.contrato.tipo === "arquivo"
			? await prepararParaOConfere(entrada.contrato.arquivo, "o contrato", avisarLeitura)
			: null;
	// Um aditivo por vez (laço, não `Promise.all`): uma imagem por vez na memória do navegador.
	const aditivosProntos: (Awaited<ReturnType<typeof prepararParaOConfere>> | null)[] = [];
	for (const [i, aditivo] of entrada.aditivos.entries()) {
		aditivosProntos.push(
			aditivo.tipo === "arquivo" ? await prepararParaOConfere(aditivo.arquivo, `o aditivo ${i + 1}`, avisarLeitura) : null,
		);
	}
	const algumLido =
		Boolean(contratoPronto?.lidoDeImagem) ||
		aditivosProntos.some((a) => a?.lidoDeImagem) ||
		(entrada.contrato.tipo !== "arquivo" && entrada.contrato.documento.leituraDeImagem === "lido") ||
		entrada.aditivos.some((a) => a.tipo !== "arquivo" && a.documento.leituraDeImagem === "lido");
```

Troque `corpo.append("contrato", entrada.contrato.arquivo);` por `corpo.append("contrato", contratoPronto!.arquivo);` e, no laço dos aditivos, `aditivo.arquivo` por `aditivosProntos[indice]!.arquivo` (transforme o `for…of` em `for (const [indice, aditivo] of entrada.aditivos.entries())`).

Onde a função devolve o estado `bloqueado` (procure `situacao: "bloqueado"` dentro de `gerarRelatorio` e das funções que ela chama), passe o resultado por:

```ts
const AVISO_DE_LEITURA: Achado = {
	validacao: "LEITURA-IMAGEM",
	severidade: "AVISA",
	mensagem: "Este contrato é uma imagem — a leitura pode ter errado um valor. Confira os valores ou peça o arquivo do Word.",
	codigo: null,
};

function comDicaDeLeitura(estado: Estado, algumLido: boolean): Estado {
	return algumLido && estado.situacao === "bloqueado" ? { ...estado, avisos: [AVISO_DE_LEITURA, ...estado.avisos] } : estado;
}
```

— aplicando `comDicaDeLeitura(…, algumLido)` no(s) `return` de `gerarRelatorio` (um ponto só, no fim: guarde o estado numa variável e devolva `comDicaDeLeitura(estado, algumLido)`). Importe `Achado` de `./types` se ainda não estiver.

- [ ] **Step 7: Teste em `api.test.ts`**

Acrescente, seguindo o padrão de mock de `fetch` do arquivo:

```ts
jest.mock("@/lib/leitura-imagem/preparar", () => ({
	prepararParaOConfere: jest.fn(async (arquivo: File) => ({ arquivo, lidoDeImagem: false })),
}));
```

e dois casos: (a) com `prepararParaOConfere` devolvendo `lidoDeImagem: true` e um `File` novo, o `FormData` enviado leva o arquivo novo em `contrato`; (b) com documento do cadastro `leituraDeImagem: "lido"` e resposta 422 bloqueada, o estado devolvido tem como primeiro aviso a mensagem `Este contrato é uma imagem — a leitura pode ter errado um valor. Confira os valores ou peça o arquivo do Word.`

Run: `npx jest src/app/confere src/lib/leitura-imagem`
Expected: PASS.

- [ ] **Step 8: Commit**

Arquivos: `src/lib/leitura-imagem/deps-navegador.ts`, `src/lib/leitura-imagem/preparar.ts`, `src/lib/leitura-imagem/preparar.test.ts`, `src/app/confere/lib/api.ts`, `src/app/confere/lib/api.test.ts`.
Mensagem: `feat(confere): PDF do computador que é imagem é lido no navegador antes do envio`

---

### Task 11: Aviso na linha do documento e mensagem do Confere em língua de gente

**Files:**
- Create: `src/app/confere/components/AvisoDeImagem.tsx`
- Test: `src/app/confere/components/AvisoDeImagem.test.tsx`
- Modify: `src/app/confere/components/UploadForm.tsx` (linha do contrato ~431 e linhas dos aditivos)
- Modify: `services/confere/backend/src/infrastructure/di/container.py` (`mensagem_pdf_sem_texto`, ~linha 497)
- Modify: `services/confere/backend/tests/test_pdf_sem_texto.py` (texto esperado, se o teste o cita)

**Interfaces:**
- Consumes: `DocumentoDoCadastro.leituraDeImagem` (Task 9).
- Produces: `<AvisoDeImagem situacao={…} papel="contrato" | "aditivo" />` — não renderiza nada para `null`/`undefined`.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
import { render, screen } from "@testing-library/react";
import { AvisoDeImagem } from "./AvisoDeImagem";

describe("AvisoDeImagem", () => {
	it("lido: pede para conferir os valores, sem falar em OCR", () => {
		render(<AvisoDeImagem situacao="lido" papel="contrato" />);
		expect(
			screen.getByText("Este contrato é uma imagem (foi impresso ou escaneado). O sistema leu o texto da imagem — confira os valores."),
		).toBeInTheDocument();
		expect(document.body.textContent).not.toMatch(/ocr/i);
	});

	it("falhou: diz o que pedir", () => {
		render(<AvisoDeImagem situacao="falhou" papel="aditivo" />);
		expect(
			screen.getByText("Este aditivo é uma imagem e o sistema não conseguiu ler o texto. Peça o arquivo do Word ou um PDF salvo pelo Word."),
		).toBeInTheDocument();
	});

	it("PDF comum: nada", () => {
		const { container } = render(<AvisoDeImagem situacao={null} papel="contrato" />);
		expect(container).toBeEmptyDOMElement();
	});
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/app/confere/components/AvisoDeImagem.test.tsx`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```tsx
/** O aviso do PDF que é imagem, na linha do documento (spec 2026-10-20-confere-contrato-imagem §3.4).
 *  A tela nunca diz "OCR": quem usa sabe o que é "imagem" e "impresso ou escaneado". */
export function AvisoDeImagem({
	situacao,
	papel,
}: {
	situacao: "lido" | "falhou" | null | undefined;
	papel: "contrato" | "aditivo";
}) {
	if (!situacao) return null;
	const documento = papel === "contrato" ? "Este contrato" : "Este aditivo";
	const texto =
		situacao === "lido"
			? `${documento} é uma imagem (foi impresso ou escaneado). O sistema leu o texto da imagem — confira os valores.`
			: `${documento} é uma imagem e o sistema não conseguiu ler o texto. Peça o arquivo do Word ou um PDF salvo pelo Word.`;
	return <p className="mt-1 text-sm leading-snug text-amber-800">{texto}</p>;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/app/confere/components/AvisoDeImagem.test.tsx`
Expected: PASS.

- [ ] **Step 5: Pôr na tela**

Em `UploadForm.tsx`, na linha do contrato, logo depois do `<p className="text-sm text-confere-navy-300">…"Do computador"}</p>`:

```tsx
									<AvisoDeImagem situacao={contratoDoCadastro?.leituraDeImagem} papel="contrato" />
```

Nas linhas de aditivo do cadastro: procure onde `textoDoDocumento(` é usado para o aditivo e acrescente logo depois, do mesmo jeito, `<AvisoDeImagem situacao={<documento do aditivo>.leituraDeImagem} papel="aditivo" />` (o `<documento do aditivo>` é a variável que o `textoDoDocumento(` daquela linha recebe). Import: `import { AvisoDeImagem } from "./AvisoDeImagem";`.

Run: `npx jest src/app/confere`
Expected: PASS (inclui os testes de `UploadForm`, se houver).

- [ ] **Step 6: Mensagem do Confere**

Em `services/confere/backend/src/infrastructure/di/container.py`, substitua o corpo de `mensagem_pdf_sem_texto`:

```python
def mensagem_pdf_sem_texto(papel: str, nome: str = "") -> str:
    arquivo = f"O PDF {papel} ({nome})" if nome else f"O PDF {papel}"
    return (
        f"{arquivo} é uma imagem (foi impresso ou escaneado) e o sistema não conseguiu ler o "
        "texto. Peça o arquivo do Word ou um PDF salvo pelo Word — nele dá para selecionar e "
        "copiar o texto."
    )
```

Run: `grep -n "não tem texto\|Print To PDF" services/confere/backend/tests/test_pdf_sem_texto.py` — se algum teste cita o texto antigo, troque pelo trecho novo `é uma imagem (foi impresso ou escaneado)`.
Run (contêiner, ver Global Constraints): `… pytest -q -p no:cacheprovider tests/test_pdf_sem_texto.py`
Expected: PASS.

- [ ] **Step 7: Commit**

Arquivos: `src/app/confere/components/AvisoDeImagem.tsx`, `src/app/confere/components/AvisoDeImagem.test.tsx`, `src/app/confere/components/UploadForm.tsx`, `services/confere/backend/src/infrastructure/di/container.py`, `services/confere/backend/tests/test_pdf_sem_texto.py` (se mudou).
Mensagem: `feat(confere): aviso do PDF que é imagem e mensagem em língua de gente`

---

### Task 12: O Confere lê o PDF montado — teste no Python

**Files:**
- Create: `services/confere/backend/tests/fixtures/contrato_lido_de_imagem.pdf` (gerado)
- Create: `scripts/gerar-fixture-leitura-imagem.ts`
- Create: `services/confere/backend/tests/test_leitura_de_imagem.py`

**Interfaces:**
- Consumes: `montarPdf` (Task 3).

- [ ] **Step 1: Gerar a fixture com o `montarPdf`**

`scripts/gerar-fixture-leitura-imagem.ts` monta, a partir das palavras e linhas de uma tabela de itens no formato das propostas (cabeçalho de 7 colunas — 8 divisórias verticais — 3 itens e a linha `TOTAL`), um PDF com `montarPdf` e grava em `services/confere/backend/tests/fixtures/contrato_lido_de_imagem.pdf`. Copie o formato da tabela de uma fixture de contrato existente: rode `services/confere/backend/.venv/Scripts/python.exe -I -c "import sys; sys.path.insert(0,'services/confere/backend/src'); import pdfplumber; p=pdfplumber.open('services/confere/backend/tests/fixtures/contrato.pdf'); [print(i, w['text'], round(w['x0']), round(w['top'])) for i,pg in enumerate(p.pages) for w in pg.extract_words() if w['top']>0][:400]"` e use as **mesmas posições (em pontos) e textos** das palavras e das divisórias da página da tabela de itens — escala 1 (`escala: 1`, posições em pt = px). O script grava o PDF e imprime itens e total esperados.

Run: `npx tsx scripts/gerar-fixture-leitura-imagem.ts`
Expected: arquivo gravado.

- [ ] **Step 2: Teste que falha**

```python
"""O PDF montado pela leitura de imagem do VerAI (`montarPdf`) é lido pelo extrator como qualquer
outro: texto em Helvetica, divisórias como linhas (spec 2026-10-20-confere-contrato-imagem §3.1)."""

from pathlib import Path

from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor
from infrastructure.shared.arquivos import pdf_sem_texto

FIXTURE = Path(__file__).parent / "fixtures" / "contrato_lido_de_imagem.pdf"


def test_pdf_lido_tem_texto() -> None:
    assert not pdf_sem_texto(FIXTURE)


def test_extrator_acha_a_grade_e_fecha_a_conta() -> None:
    contrato = PdfPlumberContractExtractor().extrair(FIXTURE)
    assert len(contrato.itens) == 3
    assert contrato.total_declarado is not None
    assert contrato.soma_dos_totais == contrato.total_declarado
```

(ajuste `3` ao número de itens que o script da Step 1 imprimiu.)

- [ ] **Step 3: Rodar**

Run: `services/confere/backend/.venv/Scripts/python.exe -m pytest -q -p no:cacheprovider services/confere/backend/tests/test_leitura_de_imagem.py` (o extrator roda no Windows; a pasta `tests` tem `conftest` — se ele importar `api.main`, rode no contêiner).
Expected: PASS. Se falhar porque o pdfplumber não vê as linhas do `drawLine` como divisórias, a correção é em `montarPdf` (desenhar a divisória como retângulo fino, `drawRectangle` com largura 0,75 pt) — com o teste da Task 3 ajustado junto — nunca no Confere.

- [ ] **Step 4: Commit**

Arquivos: `scripts/gerar-fixture-leitura-imagem.ts`, a fixture, `services/confere/backend/tests/test_leitura_de_imagem.py` (e `montar-pdf.ts`/teste se mudaram).
Mensagem: `test(confere): o PDF montado pela leitura de imagem é lido pelo extrator`

---

### Task 13: Documentação, produção e conferência ponta a ponta

**Files:**
- Modify: `CLAUDE.md` (seção "Integração do Confere" — só o parágrafo novo; outra sessão também altera este arquivo)
- Modify: `docs/superpowers/specs/2026-10-20-confere-contrato-imagem-design.md` (situação)

- [ ] **Step 1: CLAUDE.md**

Depois do parágrafo **PDF sem texto** (20/10) da seção do Confere, acrescente:

```markdown
  **Contrato que é imagem** (20/10): 95 de 469 PC/PA da biblioteca são imagem (letras em contorno ou escaneadas). O
  agendador lê de antemão (`etapaDaLeituraDeImagem`, `src/lib/leitura-imagem/`): desenha a página, lê as palavras
  (tesseract.js), acha as linhas da tabela na imagem e monta um PDF limpo (`pdf-lib`) em `r2:leitura-imagem/<sha256>.pdf`,
  com uma linha em `LeituraImagemPdf` (tabela nova; `com_texto` lembra quem não é imagem). O proxy troca o original pela
  versão lida; o do computador é lido no navegador. O original nunca é trocado; a tela nunca diz "OCR". Régua:
  `npx tsx scripts/regua-leitura-imagem.ts [--salvar]` antes e depois de mexer em `src/lib/leitura-imagem/`. Spec
  `docs/superpowers/specs/2026-10-20-confere-contrato-imagem-design.md`.
```

- [ ] **Step 2: Suítes**

Run: `npx jest src/lib/leitura-imagem src/lib/confere src/app/confere src/app/api/confere --runInBand`
Expected: PASS.
Run (contêiner): suíte inteira do Confere. Expected: tudo passa (o `test_o_custo_de_um_anexo_e_linear` mede relógio e pode oscilar com o contêiner carregado — se só ele falhar, rode-o sozinho).
Run: `npx tsc --noEmit -p .` Expected: sem erro novo nos arquivos desta feature.

- [ ] **Step 3: Commit**

Arquivos: `CLAUDE.md` (montado a partir do HEAD só com o parágrafo novo), a spec.
Mensagem: `docs: contrato que é imagem no ConfereAI`

- [ ] **Step 4: Produção — migração antes**

Run: `npx dotenv -e .env.production.local -- npx prisma migrate deploy`
Expected: aplica `20261020160000_leitura_imagem_pdf` (e só migrações já commitadas — confira a lista antes de confirmar; se houver migração de outra sessão ainda não commitada na pasta, pare e pergunte ao usuário).

- [ ] **Step 5: Push e deploy**

Push pela conta `lucasserralheiro` (CLAUDE.md, "Deploy é da sessão de IA"):
`gh auth switch -u lucasserralheiro && VERAI_LIBERAR_PUSH=1 git push origin main`
Confira: Vercel com o commit em `success` (`gh api repos/lucasserralheiro/VerAI/commits/<sha>/statuses`), Render com o deploy Live e `curl https://confere-backend.onrender.com/health` → `{"status":"ok"}`.

- [ ] **Step 6: Primeira passada de leitura**

Run (no PC do Lucas, contra produção): `npx dotenv -e .env.production.local -- npx tsx scripts/sincronizar-sharepoint.ts --aplicar --sem-documentos --sem-valores`
Expected: no fim, `leitura de imagem: N lido(s) · … · M com texto`. As passadas seguintes do agendador completam o resto.

- [ ] **Step 7: Conferir na tela**

No ConfereAI de produção, a planilha do HSPM TC 094/2023 (contrato `PC-HSPM-230207-13 v3.0`): a linha do contrato mostra "Este contrato é uma imagem… confira os valores." e a geração termina (relatório ou bloqueio com a dica). Relate ao usuário o que aconteceu, com o resultado da régua.
