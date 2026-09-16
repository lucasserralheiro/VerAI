# Conferência rápida de totais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar à pessoa que revisa uma Proposta Comercial um jeito de bater o olho, em segundos, nos
valores de total/resultado geral do PDF contra o documento convertido — sem esperar a checagem por IA
(mais lenta, roda página por página via chamada de modelo).

**Architecture:** Extração e verificação 100% determinística (regex + comparação exata de número, sem
IA nenhuma) num novo módulo `src/lib/conferirTotais.ts`, exposto por um endpoint HTTP próprio
(`POST /api/propostas-comerciais/[id]/conferir-totais`, separado da rota de checagem por IA de
propósito — não pode ficar refém da latência dela), cacheado por hash do documento (mesmo padrão já
usado pela checagem por IA) e consumido por um card novo no painel lateral da proposta.

**Tech Stack:** Next.js (App Router, route handlers), Prisma/Postgres, React (client component), Jest +
Testing Library.

## Global Constraints

- Extração e verificação são **sempre determinísticas** — nenhuma chamada de modelo/IA neste recurso.
- Confere **só linhas de total/resultado geral** (rótulo tipo "total", "subtotal", "valor total",
  "total geral", "resultado geral" perto de valor monetário) — não célula a célula de tabela.
- Correspondência de valor é **exata** (número normalizado igual), nunca por substring/`includes`.
- Endpoint **separado** da checagem por IA (`checagem-ia/route.ts`) — não deve esperar nem bloquear
  nela.
- **Nunca bloqueia nada** — puramente informativo, mesmo em erro ou divergência.
- Cache por hash do documento salvo (mesmo padrão de `documentoHash`/`mesmoDocumento` já usado em
  `checagem-ia/route.ts`) — só recalcula quando os PDFs ou o documento salvo mudaram.
- Referência completa: `docs/superpowers/specs/2026-09-16-conferencia-totais-design.md`.

---

### Task 1: Colunas `conferenciaTotais`/`conferenciaTotaisEm` no banco

**Files:**
- Modify: `prisma/schema.prisma:111-127` (model `PropostaComercial`)
- Create: `prisma/migrations/20260916120000_add_conferencia_totais_proposta/migration.sql`

**Interfaces:**
- Produces: colunas `conferenciaTotais Json?` e `conferenciaTotaisEm DateTime?` no model
  `PropostaComercial`, disponíveis via `prisma.propostaComercial` (usadas pela Task 3).

- [ ] **Step 1: Adicionar os campos no schema**

Em `prisma/schema.prisma`, dentro do model `PropostaComercial`, logo depois de `checagemIaEm`:

```prisma
  checagemIa       Json?
  checagemIaEm     DateTime?
  // Resultado da conferência determinística (sem IA) dos valores de total/
  // resultado geral do PDF contra o documento — atalho rápido, separado da
  // checagem por IA (ver docs/superpowers/specs/2026-09-16-conferencia-totais-design.md).
  conferenciaTotais   Json?
  conferenciaTotaisEm DateTime?
  createdAt        DateTime  @default(now())
```

- [ ] **Step 2: Criar a migração manualmente**

Crie `prisma/migrations/20260916120000_add_conferencia_totais_proposta/migration.sql`:

```sql
-- Resultado da conferência determinística de totais (PDF x documento),
-- salvo pra não recalcular a cada F5 — só depende dos PDFs e do documento
-- salvo, igual à checagem por IA (checagemIa/checagemIaEm).
ALTER TABLE "PropostaComercial" ADD COLUMN IF NOT EXISTS "conferenciaTotais" JSONB;
ALTER TABLE "PropostaComercial" ADD COLUMN IF NOT EXISTS "conferenciaTotaisEm" TIMESTAMP(3);
```

- [ ] **Step 3: Regenerar o client do Prisma**

Run: `npm run dev:generate`
Expected: termina sem erro; `node_modules/.prisma/client` passa a expor `conferenciaTotais` e
`conferenciaTotaisEm` no tipo `PropostaComercial`.

- [ ] **Step 4: Aplicar a migração no banco de desenvolvimento (se houver um rodando)**

Run: `npm run dev:db:up` (se ainda não estiver rodando), depois `npm run dev:migrate`
Expected: a migração `20260916120000_add_conferencia_totais_proposta` aparece como aplicada, sem
pedir para resetar o banco.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260916120000_add_conferencia_totais_proposta
git commit -m "feat: colunas conferenciaTotais/conferenciaTotaisEm na Proposta Comercial"
```

---

### Task 2: `conferirTotais.ts` — extração e verificação determinística

**Files:**
- Create: `src/lib/conferirTotais.ts`
- Test: `src/lib/conferirTotais.test.ts`

**Interfaces:**
- Consumes: nada de outra task — função pura, só recebe página+texto e o documento.
- Produces:
  ```ts
  export interface PaginaParaConferirTotal {
    pagina: number
    textoOriginal: string
  }

  export interface TotalConferido {
    pagina: number
    rotulo: string
    valorNoPdf: string
    encontradoNoDocumento: boolean
    ocorrenciasNoDocumento: number
  }

  export function conferirTotais(paginas: PaginaParaConferirTotal[], documentoAtual: string): TotalConferido[]
  ```
  Usado pela Task 3 (rota).

- [ ] **Step 1: Escrever os testes (falhando)**

Crie `src/lib/conferirTotais.test.ts`:

```ts
import { conferirTotais } from './conferirTotais'

describe('conferirTotais', () => {
  it('acha um total simples que bate com o documento', () => {
    const paginas = [{ pagina: 3, textoOriginal: 'Total Geral: R$ 279.663,46' }]
    const documento = '<table><tr><td>Total Geral</td><td>R$ 279.663,46</td></tr></table>'

    const resultado = conferirTotais(paginas, documento)

    expect(resultado).toEqual([
      { pagina: 3, rotulo: 'Total Geral', valorNoPdf: 'R$ 279.663,46', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 },
    ])
  })

  it('marca como não encontrado quando o valor não aparece no documento', () => {
    const paginas = [{ pagina: 1, textoOriginal: 'Valor Total: R$ 1.234,56' }]
    const documento = '<p>Documento sem esse valor</p>'

    const resultado = conferirTotais(paginas, documento)

    expect(resultado).toEqual([
      { pagina: 1, rotulo: 'Valor Total', valorNoPdf: 'R$ 1.234,56', encontradoNoDocumento: false, ocorrenciasNoDocumento: 0 },
    ])
  })

  it('dedupe: mesmo rótulo+valor repetido em páginas diferentes conta uma vez, mantendo a primeira página', () => {
    const paginas = [
      { pagina: 1, textoOriginal: 'Subtotal: R$ 500,00' },
      { pagina: 5, textoOriginal: 'Subtotal: R$ 500,00' }, // resumo repetido no fim do documento
    ]
    const documento = '<p>Subtotal: R$ 500,00</p>'

    const resultado = conferirTotais(paginas, documento)

    expect(resultado).toHaveLength(1)
    expect(resultado[0].pagina).toBe(1)
  })

  it('ignora rótulo sem valor monetário (total de páginas, total de itens)', () => {
    const paginas = [{ pagina: 1, textoOriginal: 'Total de 45 páginas\nTotal de 12 itens' }]

    const resultado = conferirTotais(paginas, 'documento qualquer')

    expect(resultado).toEqual([])
  })

  it('correspondência é exata, não substring — "663,46" não casa dentro de "279.663,46"', () => {
    const paginas = [{ pagina: 1, textoOriginal: 'Total: R$ 663,46' }]
    const documento = '<p>Valor: R$ 279.663,46</p>' // contém "663,46" como substring, mas não é o mesmo número

    const resultado = conferirTotais(paginas, documento)

    expect(resultado[0].encontradoNoDocumento).toBe(false)
  })

  it('reconhece valor sem símbolo "R$" e com pontos de alinhamento antes do valor', () => {
    const paginas = [{ pagina: 2, textoOriginal: 'Total Geral ..................... 279.663,46' }]
    const documento = '<td>279.663,46</td>'

    const resultado = conferirTotais(paginas, documento)

    expect(resultado[0]).toMatchObject({ rotulo: 'Total Geral', encontradoNoDocumento: true })
  })

  it('caso real: tabela de cronograma de proposta comercial', () => {
    const paginas = [
      {
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

    const resultado = conferirTotais(paginas, documento)

    expect(resultado).toEqual([
      { pagina: 4, rotulo: 'Valor Total', valorNoPdf: 'R$ 279.663,46', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 },
    ])
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- src/lib/conferirTotais.test.ts`
Expected: FAIL — `Cannot find module './conferirTotais'`.

- [ ] **Step 3: Implementar `conferirTotais.ts`**

Crie `src/lib/conferirTotais.ts`:

```ts
/**
 * Conferência determinística (sem IA) dos valores de TOTAL/resultado geral
 * de cada página do PDF contra o documento HTML — atalho a mais além da
 * checagem por IA (`checarConversao.ts`), focado só nos números de maior
 * risco financeiro numa proposta comercial (total, subtotal), pra bater o
 * olho rápido sem esperar chamada de modelo nenhuma. Ver
 * docs/superpowers/specs/2026-09-16-conferencia-totais-design.md.
 *
 * Limitação conhecida e aceita (mesma escolha de design já feita pra texto
 * em `checarConversao.ts`): confirma que o valor existe em ALGUM lugar do
 * documento, não que está na seção certa.
 */

export interface PaginaParaConferirTotal {
  pagina: number
  textoOriginal: string
}

export interface TotalConferido {
  pagina: number
  rotulo: string
  valorNoPdf: string
  encontradoNoDocumento: boolean
  ocorrenciasNoDocumento: number
}

/** Rótulo de total, do mais específico pro mais genérico — na mesma posição
 *  de início, a alternativa mais específica tenta primeiro (ordem da
 *  alternação em regex JS não é "mais longa vence", é "primeira que bate"),
 *  então "Total Geral" nunca vira só "Total". Entre rótulo e valor tolera
 *  ":", "-", espaço e pontos de alinhamento (comum em tabela impressa,
 *  ex.: "Total Geral ..... R$ 10,00"), até 40 caracteres pra não vazar pra
 *  prosa sem relação (que tem letra, não bate nessa classe de caracteres). */
const REGEX_ROTULO_VALOR =
  /(total\s+geral|valor\s+total|subtotal|resultado\s+geral|total)[\s.\-:]{0,40}(R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i

/** Todo número em formato monetário BR (milhar com ponto, decimal com
 *  vírgula de 2 dígitos) solto no texto — usado pra indexar o documento
 *  inteiro numa única passada (ver `indexarValoresDoDocumento`). */
const REGEX_QUALQUER_VALOR = /\d{1,3}(?:\.\d{3})*,\d{2}/g

/** Remove separador de milhar, mantém a vírgula decimal — só assim dois
 *  números "iguais" escritos de formas diferentes comparam igual. */
function normalizarValor(valor: string): string {
  return valor.replace(/\./g, '')
}

/** Quantas vezes cada valor normalizado aparece no documento inteiro —
 *  calculado uma vez só (não por total encontrado do PDF), pra não repetir
 *  a varredura do documento inteiro pra cada total (documento grande x
 *  poucas dezenas de totais: O(documento), não O(totais × documento)). */
function indexarValoresDoDocumento(documentoAtual: string): Map<string, number> {
  const indice = new Map<string, number>()
  for (const match of documentoAtual.matchAll(REGEX_QUALQUER_VALOR)) {
    const chave = normalizarValor(match[0])
    indice.set(chave, (indice.get(chave) ?? 0) + 1)
  }
  return indice
}

/** Chave de dedupe: mesmo rótulo (sem diferenciar caixa) + mesmo valor
 *  normalizado conta uma vez só, mesmo vindo de páginas diferentes
 *  (resumo/cabeçalho repetido). */
function chaveDoTotal(rotulo: string, valorNormalizado: string): string {
  return `${rotulo.trim().toLowerCase()} ${valorNormalizado}`
}

/**
 * Pra cada página, acha a primeira linha com rótulo de total perto de um
 * valor monetário, e confere se o MESMO valor (correspondência EXATA do
 * número normalizado, nunca substring — "663,46" não pode casar dentro de
 * "279.663,46") aparece em algum lugar do documento inteiro.
 */
export function conferirTotais(paginas: PaginaParaConferirTotal[], documentoAtual: string): TotalConferido[] {
  const indiceDocumento = indexarValoresDoDocumento(documentoAtual)
  const vistos = new Set<string>()
  const totais: TotalConferido[] = []

  for (const pagina of paginas) {
    for (const linha of pagina.textoOriginal.split('\n')) {
      const match = linha.match(REGEX_ROTULO_VALOR)
      if (!match) continue

      const rotulo = match[1].trim()
      const valorNormalizado = normalizarValor(match[3])
      const chave = chaveDoTotal(rotulo, valorNormalizado)
      if (vistos.has(chave)) continue
      vistos.add(chave)

      const valorNoPdf = match[2] ? `${match[2]} ${match[3]}` : match[3]
      const ocorrenciasNoDocumento = indiceDocumento.get(valorNormalizado) ?? 0
      totais.push({
        pagina: pagina.pagina,
        rotulo,
        valorNoPdf,
        encontradoNoDocumento: ocorrenciasNoDocumento > 0,
        ocorrenciasNoDocumento,
      })
    }
  }

  return totais
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- src/lib/conferirTotais.test.ts`
Expected: PASS — 7 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/conferirTotais.ts src/lib/conferirTotais.test.ts
git commit -m "feat: conferirTotais — checagem determinística de totais PDF x documento"
```

---

### Task 3: Rota `POST /api/propostas-comerciais/[id]/conferir-totais`

**Files:**
- Create: `src/app/api/propostas-comerciais/[id]/conferir-totais/route.ts`
- Test: `src/app/api/propostas-comerciais/[id]/conferir-totais/route.test.ts`

**Interfaces:**
- Consumes: `conferirTotais(paginas: PaginaParaConferirTotal[], documentoAtual: string): TotalConferido[]`
  (Task 2), `converterPdfParaHtml` (`src/lib/extracao/pdfHtml.ts`, já existente — mesmo usado por
  `checagem-ia/route.ts`), campos `conferenciaTotais`/`conferenciaTotaisEm` no Prisma (Task 1).
- Produces: `POST` retorna `{ totais: TotalConferido[]; checadoEm: string | null }` — consumido pela
  Task 4 (`iniciarConferenciaTotais`).

- [ ] **Step 1: Escrever o teste da rota (falhando)**

Crie `src/app/api/propostas-comerciais/[id]/conferir-totais/route.test.ts`:

```ts
/** @jest-environment node */
import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { propostaComercial: { findUnique: jest.fn(), update: jest.fn() } },
}))
jest.mock('@/lib/storage', () => ({ getUpload: jest.fn() }))
jest.mock('@/lib/extracao/pdfHtml', () => ({ converterPdfParaHtml: jest.fn() }))
jest.mock('@/lib/conferirTotais', () => ({ conferirTotais: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUpload } from '@/lib/storage'
import { converterPdfParaHtml } from '@/lib/extracao/pdfHtml'
import { conferirTotais } from '@/lib/conferirTotais'
import { POST } from './route'

function hashDocumento(texto: string): string {
  return createHash('sha256').update(texto).digest('hex')
}

const requisicao = () =>
  new NextRequest('http://localhost/api/propostas-comerciais/p1/conferir-totais', { method: 'POST' })
const contexto = { params: Promise.resolve({ id: 'p1' }) }

describe('POST /api/propostas-comerciais/[id]/conferir-totais', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
    ;(prisma.propostaComercial.update as jest.Mock).mockResolvedValue({})
  })

  it('retorna 401 sem autenticação', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(requisicao(), contexto)).status).toBe(401)
  })

  it('retorna 404 quando a proposta não existe', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await POST(requisicao(), contexto)).status).toBe(404)
  })

  it('junta paginasConvertidas de todos os PDFs (ignora xlsx/docx) e conta contra o documento salvo', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: 'Documento salvo',
      conferenciaTotais: null,
      conferenciaTotaisEm: null,
      arquivos: [
        { id: 'a1', tipo: 'pdf', ordem: 0, caminhoOriginal: 'https://blob/a1.pdf' },
        { id: 'a2', tipo: 'xlsx', ordem: 1, caminhoOriginal: 'https://blob/a2.xlsx' },
      ],
    })
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('fake'))
    ;(converterPdfParaHtml as jest.Mock).mockResolvedValue({
      html: 'x',
      paginasImagem: [],
      paginasConvertidas: [{ pagina: 1, textoOriginal: 'Total: R$ 10,00', html: '<p>x</p>' }],
      paginasComImagem: [],
    })
    ;(conferirTotais as jest.Mock).mockReturnValue([
      { pagina: 1, rotulo: 'Total', valorNoPdf: 'R$ 10,00', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 },
    ])

    const resposta = await POST(requisicao(), contexto)

    expect(getUpload).toHaveBeenCalledTimes(1) // só o arquivo pdf, não o xlsx
    expect(conferirTotais).toHaveBeenCalledWith(
      [{ pagina: 1, textoOriginal: 'Total: R$ 10,00', html: '<p>x</p>' }],
      'Documento salvo'
    )
    const corpo = await resposta.json()
    expect(corpo).toMatchObject({
      totais: [{ pagina: 1, rotulo: 'Total', valorNoPdf: 'R$ 10,00', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 }],
    })
    expect(typeof corpo.checadoEm).toBe('string')
    expect(prisma.propostaComercial.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conferenciaTotais: expect.objectContaining({ documentoHash: hashDocumento('Documento salvo') }),
        }),
      })
    )
  })

  it('serve do cache quando os PDFs e o documento salvo batem com a última conferência', async () => {
    const documentoSalvo = 'Documento salvo'
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: documentoSalvo,
      conferenciaTotaisEm: new Date('2026-09-01T00:00:00.000Z'),
      conferenciaTotais: {
        totais: [{ pagina: 1, rotulo: 'Total', valorNoPdf: 'R$ 10,00', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 }],
        arquivosPdf: ['a1'],
        documentoHash: hashDocumento(documentoSalvo),
      },
      arquivos: [{ id: 'a1', tipo: 'pdf', ordem: 0, caminhoOriginal: 'https://blob/a1.pdf' }],
    })

    const resposta = await POST(requisicao(), contexto)

    expect(conferirTotais).not.toHaveBeenCalled()
    expect(getUpload).not.toHaveBeenCalled()
    const corpo = await resposta.json()
    expect(corpo.totais).toEqual([
      { pagina: 1, rotulo: 'Total', valorNoPdf: 'R$ 10,00', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 },
    ])
  })

  it('refaz quando o documento salvo mudou desde a última conferência (cache não vale mais)', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: 'Documento NOVO, editado',
      conferenciaTotaisEm: new Date('2026-09-01T00:00:00.000Z'),
      conferenciaTotais: {
        totais: [],
        arquivosPdf: ['a1'],
        documentoHash: hashDocumento('Documento antigo'), // não bate mais
      },
      arquivos: [{ id: 'a1', tipo: 'pdf', ordem: 0, caminhoOriginal: 'https://blob/a1.pdf' }],
    })
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('fake'))
    ;(converterPdfParaHtml as jest.Mock).mockResolvedValue({
      html: 'x',
      paginasImagem: [],
      paginasConvertidas: [{ pagina: 1, textoOriginal: 'a', html: 'a' }],
      paginasComImagem: [],
    })
    ;(conferirTotais as jest.Mock).mockReturnValue([])

    const resposta = await POST(requisicao(), contexto)

    expect(conferirTotais).toHaveBeenCalledTimes(1)
    expect(resposta.status).toBe(200)
  })

  it('sem nenhum arquivo pdf chama conferirTotais com lista vazia de páginas', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: null,
      conferenciaTotais: null,
      conferenciaTotaisEm: null,
      arquivos: [{ id: 'a2', tipo: 'xlsx', ordem: 0, caminhoOriginal: 'https://blob/a2.xlsx' }],
    })
    ;(conferirTotais as jest.Mock).mockReturnValue([])

    const resposta = await POST(requisicao(), contexto)

    expect(conferirTotais).toHaveBeenCalledWith([], '')
    const corpo = await resposta.json()
    expect(corpo.totais).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- src/app/api/propostas-comerciais/[id]/conferir-totais/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implementar a rota**

Crie `src/app/api/propostas-comerciais/[id]/conferir-totais/route.ts`:

```ts
import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { getUpload } from '@/lib/storage'
import { converterPdfParaHtml, type PaginaConvertida } from '@/lib/extracao/pdfHtml'
import { conferirTotais, type TotalConferido } from '@/lib/conferirTotais'

function hashDocumento(texto: string): string {
  return createHash('sha256').update(texto).digest('hex')
}

/**
 * Conferência determinística (sem IA) dos totais do PDF contra o
 * documento — separada da checagem por IA de propósito: é praticamente
 * grátis (regex + comparação de número), não pode ficar refém da latência
 * da checagem por IA (chamada de modelo por página). Sempre roda contra o
 * Markdown/HTML JÁ SALVO da proposta. Ver
 * docs/superpowers/specs/2026-09-16-conferencia-totais-design.md.
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

  const arquivosPdf = proposta.arquivos.filter((arquivo) => arquivo.tipo === 'pdf').sort((a, b) => a.ordem - b.ordem)
  const idsPdf = arquivosPdf.map((arquivo) => arquivo.id)
  const documentoAtual = proposta.conteudoMarkdown ?? ''

  const salva = lerConferenciaSalva(proposta.conferenciaTotais)
  if (salva && mesmoDocumento(salva, idsPdf, documentoAtual)) {
    return NextResponse.json({ totais: salva.totais, checadoEm: proposta.conferenciaTotaisEm?.toISOString() ?? null })
  }

  const paginasConvertidas: PaginaConvertida[] = []
  for (const arquivo of arquivosPdf) {
    const buffer = await getUpload(arquivo.caminhoOriginal)
    const resultado = await converterPdfParaHtml(buffer)
    paginasConvertidas.push(...resultado.paginasConvertidas)
  }

  const totais = conferirTotais(paginasConvertidas, documentoAtual)
  const checadoEm = new Date()
  const paraSalvar: ConferenciaSalva = {
    totais,
    arquivosPdf: idsPdf,
    documentoHash: hashDocumento(documentoAtual),
  }

  // Falhar ao gravar não pode esconder um resultado que já está pronto —
  // no pior caso, a próxima chamada confere de novo.
  await prisma.propostaComercial
    .update({
      where: { id },
      data: { conferenciaTotais: paraSalvar as unknown as Prisma.InputJsonValue, conferenciaTotaisEm: checadoEm },
    })
    .catch((erro) => console.error('conferência de totais: não foi possível salvar o resultado —', erro))

  return NextResponse.json({ totais, checadoEm: checadoEm.toISOString() })
}

interface ConferenciaSalva {
  totais: TotalConferido[]
  arquivosPdf: string[]
  documentoHash: string
}

/** Lê o JSON salvo com cuidado — coluna pode estar vazia; nesse caso trata
 *  como "nunca conferido" e conta de novo. */
function lerConferenciaSalva(valor: unknown): ConferenciaSalva | null {
  if (!valor || typeof valor !== 'object') return null
  const v = valor as Partial<ConferenciaSalva>
  if (!Array.isArray(v.totais) || !Array.isArray(v.arquivosPdf) || typeof v.documentoHash !== 'string') return null
  return {
    totais: v.totais,
    arquivosPdf: v.arquivosPdf.filter((x): x is string => typeof x === 'string'),
    documentoHash: v.documentoHash,
  }
}

/** O cache só vale quando os PDFs continuam os mesmos E o documento contra
 *  o qual a última conferência rodou é EXATAMENTE o que está salvo agora —
 *  mesmo critério de `checagem-ia/route.ts` (`mesmoDocumento`). */
function mesmoDocumento(salva: ConferenciaSalva, idsPdfAtuais: string[], documentoAtual: string): boolean {
  if (salva.arquivosPdf.length !== idsPdfAtuais.length) return false
  const atuaisSet = new Set(idsPdfAtuais)
  if (!salva.arquivosPdf.every((id) => atuaisSet.has(id))) return false
  return salva.documentoHash === hashDocumento(documentoAtual)
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- src/app/api/propostas-comerciais/[id]/conferir-totais/route.test.ts`
Expected: PASS — 6 testes.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/propostas-comerciais/\[id\]/conferir-totais
git commit -m "feat: rota POST conferir-totais — endpoint rápido, separado da checagem por IA"
```

---

### Task 4: `src/lib/conferenciaTotaisEmAndamento.ts` — cache no cliente

**Files:**
- Create: `src/lib/conferenciaTotaisEmAndamento.ts`
- Test: `src/lib/conferenciaTotaisEmAndamento.test.ts`

**Interfaces:**
- Consumes: `fetch('/api/propostas-comerciais/{id}/conferir-totais', { method: 'POST' })` → `{ totais, checadoEm }`
  (Task 3).
- Produces:
  ```ts
  export interface TotalConferidoCliente {
    pagina: number
    rotulo: string
    valorNoPdf: string
    encontradoNoDocumento: boolean
    ocorrenciasNoDocumento: number
  }
  export interface ResultadoConferenciaTotais {
    totais: TotalConferidoCliente[]
    checadoEm: string | null
  }
  export type EntradaConferenciaTotais =
    | { status: 'rodando'; promise: Promise<ResultadoConferenciaTotais> }
    | { status: 'ok'; resultado: ResultadoConferenciaTotais }
    | { status: 'erro'; mensagem: string }
  export function conferenciaTotaisAtual(propostaId: string): EntradaConferenciaTotais | undefined
  export function iniciarConferenciaTotais(propostaId: string): Promise<ResultadoConferenciaTotais>
  export function limparConferenciaTotais(propostaId: string): void
  ```
  Usado pela Task 5 (`CardConferenciaTotais`).

- [ ] **Step 1: Escrever os testes (falhando)**

Crie `src/lib/conferenciaTotaisEmAndamento.test.ts`:

```ts
import {
  conferenciaTotaisAtual,
  iniciarConferenciaTotais,
  limparConferenciaTotais,
} from './conferenciaTotaisEmAndamento'

function mockFetch(resposta: { ok: boolean; body: unknown }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: resposta.ok,
    json: () => Promise.resolve(resposta.body),
  }) as jest.Mock
}

describe('conferenciaTotaisEmAndamento', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    limparConferenciaTotais('p1')
  })

  it('chama a rota certa via POST', async () => {
    mockFetch({ ok: true, body: { totais: [], checadoEm: '2026-09-16T00:00:00.000Z' } })

    await iniciarConferenciaTotais('p1')

    expect(global.fetch).toHaveBeenCalledWith('/api/propostas-comerciais/p1/conferir-totais', { method: 'POST' })
  })

  it('guarda o resultado ok no cache do módulo', async () => {
    mockFetch({
      ok: true,
      body: {
        totais: [{ pagina: 1, rotulo: 'Total', valorNoPdf: 'R$ 10,00', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 }],
        checadoEm: '2026-09-16T00:00:00.000Z',
      },
    })

    const resultado = await iniciarConferenciaTotais('p1')

    expect(resultado.totais).toHaveLength(1)
    expect(conferenciaTotaisAtual('p1')).toEqual({ status: 'ok', resultado })
  })

  it('não duplica a chamada enquanto a primeira ainda está rodando', async () => {
    let resolver: (v: unknown) => void = () => {}
    global.fetch = jest.fn().mockReturnValue(
      new Promise((r) => {
        resolver = r
      })
    ) as jest.Mock

    const p1 = iniciarConferenciaTotais('p1')
    const p2 = iniciarConferenciaTotais('p1')

    expect(global.fetch).toHaveBeenCalledTimes(1)
    resolver({ ok: true, json: () => Promise.resolve({ totais: [], checadoEm: null }) })
    await Promise.all([p1, p2])
  })

  it('corpo inesperado (sem "totais") normaliza pra lista vazia', async () => {
    mockFetch({ ok: true, body: {} })

    const resultado = await iniciarConferenciaTotais('p1')

    expect(resultado).toEqual({ totais: [], checadoEm: null })
  })

  it('resposta não-ok joga erro com a mensagem do corpo', async () => {
    mockFetch({ ok: false, body: { error: 'falhou de propósito' } })

    await expect(iniciarConferenciaTotais('p1')).rejects.toThrow('falhou de propósito')
    expect(conferenciaTotaisAtual('p1')).toEqual({ status: 'erro', mensagem: 'falhou de propósito' })
  })

  it('limparConferenciaTotais remove do cache', async () => {
    mockFetch({ ok: true, body: { totais: [], checadoEm: null } })
    await iniciarConferenciaTotais('p1')

    limparConferenciaTotais('p1')

    expect(conferenciaTotaisAtual('p1')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- src/lib/conferenciaTotaisEmAndamento.test.ts`
Expected: FAIL — `Cannot find module './conferenciaTotaisEmAndamento'`.

- [ ] **Step 3: Implementar o módulo**

Crie `src/lib/conferenciaTotaisEmAndamento.ts`:

```ts
/**
 * Cache em memória (nível de módulo) da conferência de totais em andamento
 * por proposta — mesmo padrão de `checagemIaEmAndamento.ts`: iniciada
 * sozinha ao montar o card (ver `card-conferencia-totais.tsx`), sair da
 * aba no meio não perde o resultado, montar o card duas vezes não duplica
 * a chamada.
 */

export interface TotalConferidoCliente {
  pagina: number
  rotulo: string
  valorNoPdf: string
  encontradoNoDocumento: boolean
  ocorrenciasNoDocumento: number
}

export interface ResultadoConferenciaTotais {
  totais: TotalConferidoCliente[]
  checadoEm: string | null
}

export type EntradaConferenciaTotais =
  | { status: 'rodando'; promise: Promise<ResultadoConferenciaTotais> }
  | { status: 'ok'; resultado: ResultadoConferenciaTotais }
  | { status: 'erro'; mensagem: string }

const cache = new Map<string, EntradaConferenciaTotais>()

export function conferenciaTotaisAtual(propostaId: string): EntradaConferenciaTotais | undefined {
  return cache.get(propostaId)
}

export function iniciarConferenciaTotais(propostaId: string): Promise<ResultadoConferenciaTotais> {
  const atual = cache.get(propostaId)
  if (atual?.status === 'rodando') return atual.promise

  const promise = (async (): Promise<ResultadoConferenciaTotais> => {
    const resposta = await fetch(`/api/propostas-comerciais/${propostaId}/conferir-totais`, { method: 'POST' })
    const corpo = await resposta.json().catch(() => null)
    if (!resposta.ok) {
      throw new Error(corpo?.error ?? 'Não foi possível conferir os totais.')
    }
    // Normaliza na borda — corpo inesperado vira "sem totais" em vez de
    // corromper o resto da tela (mesmo padrão de `iniciarChecagemIa`).
    const totais = Array.isArray(corpo?.totais) ? corpo.totais : []
    const checadoEm = typeof corpo?.checadoEm === 'string' ? corpo.checadoEm : null
    return { totais, checadoEm }
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

export function limparConferenciaTotais(propostaId: string): void {
  cache.delete(propostaId)
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- src/lib/conferenciaTotaisEmAndamento.test.ts`
Expected: PASS — 6 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/conferenciaTotaisEmAndamento.ts src/lib/conferenciaTotaisEmAndamento.test.ts
git commit -m "feat: cache cliente da conferência de totais (conferenciaTotaisEmAndamento)"
```

---

### Task 5: `CardConferenciaTotais` — UI

**Files:**
- Create: `src/app/propostas-comerciais/[id]/card-conferencia-totais.tsx`
- Test: `src/app/propostas-comerciais/[id]/card-conferencia-totais.test.tsx`

**Interfaces:**
- Consumes: `conferenciaTotaisAtual`, `iniciarConferenciaTotais`, `limparConferenciaTotais`,
  `ResultadoConferenciaTotais`, `TotalConferidoCliente` (Task 4); `JanelaRevisao` (componente
  existente, `./janela-revisao.tsx`); `TituloSecao` (componente existente, `./titulo-secao.tsx`);
  `BTN_OUTLINE` (`@/lib/ui`); `cn` (`@/lib/utils`).
- Produces:
  ```ts
  export interface CardConferenciaTotaisProps {
    propostaId: string
    onVerPagina?: (pagina: number, destaque?: string, onUsarSelecao?: (texto: string) => void) => void
  }
  export function CardConferenciaTotais(props: CardConferenciaTotaisProps): JSX.Element
  ```
  Renderizado pela Task 6 em `espaco-proposta.tsx`. `onVerPagina` tem a MESMA assinatura já usada por
  `PainelChecagemConversaoProps.onVerPagina` (`painel-checagem-conversao.tsx`) — mesmo callback
  `verPaginaNoOriginal` de `espaco-proposta.tsx` serve pros dois.

- [ ] **Step 1: Escrever os testes (falhando)**

Crie `src/app/propostas-comerciais/[id]/card-conferencia-totais.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { CardConferenciaTotais } from './card-conferencia-totais'
import { limparConferenciaTotais } from '@/lib/conferenciaTotaisEmAndamento'

function mockFetch(resposta: { ok: boolean; body: unknown }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: resposta.ok,
    json: () => Promise.resolve(resposta.body),
  }) as jest.Mock
}

describe('CardConferenciaTotais', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    limparConferenciaTotais('p1')
  })

  it('dispara a conferência ao montar e mostra "Conferindo totais..."', () => {
    mockFetch({ ok: true, body: { totais: [] } })

    render(<CardConferenciaTotais propostaId="p1" />)

    expect(screen.getByText(/Conferindo totais/)).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/propostas-comerciais/p1/conferir-totais', { method: 'POST' })
  })

  it('sem total detectado mostra mensagem neutra', async () => {
    mockFetch({ ok: true, body: { totais: [] } })

    render(<CardConferenciaTotais propostaId="p1" />)

    expect(await screen.findByText(/Nenhum total detectado automaticamente/)).toBeInTheDocument()
  })

  it('com todos os totais batendo mostra a contagem sem destaque de erro', async () => {
    mockFetch({
      ok: true,
      body: {
        totais: [
          { pagina: 3, rotulo: 'Total Geral', valorNoPdf: 'R$ 279.663,46', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 },
        ],
      },
    })

    render(<CardConferenciaTotais propostaId="p1" />)

    expect(await screen.findByText('1 total conferido')).toBeInTheDocument()
  })

  it('com divergência mostra quantos não batem e a janela detalha com "Ver no PDF"', async () => {
    mockFetch({
      ok: true,
      body: {
        totais: [
          { pagina: 3, rotulo: 'Total Geral', valorNoPdf: 'R$ 279.663,46', encontradoNoDocumento: false, ocorrenciasNoDocumento: 0 },
          { pagina: 4, rotulo: 'Subtotal', valorNoPdf: 'R$ 100,00', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 },
        ],
      },
    })
    const onVerPagina = jest.fn()

    render(<CardConferenciaTotais propostaId="p1" onVerPagina={onVerPagina} />)
    fireEvent.click(await screen.findByText('1 de 2 totais não bate'))

    expect(screen.getByText('Total Geral')).toBeInTheDocument()
    expect(screen.getByText('R$ 279.663,46')).toBeInTheDocument()
    expect(screen.getByText('Não achado')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Ver no PDF/ }))
    expect(onVerPagina).toHaveBeenCalledWith(3, 'R$ 279.663,46')
  })

  it('erro na resposta mostra a mensagem e "Tentar de novo"', async () => {
    mockFetch({ ok: false, body: { error: 'falhou' } })

    render(<CardConferenciaTotais propostaId="p1" />)

    expect(await screen.findByText('falhou')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tentar de novo/ })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- src/app/propostas-comerciais/\[id\]/card-conferencia-totais.test.tsx`
Expected: FAIL — `Cannot find module './card-conferencia-totais'`.

- [ ] **Step 3: Implementar o componente**

Crie `src/app/propostas-comerciais/[id]/card-conferencia-totais.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Calculator, CircleCheck, ExternalLink, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BTN_OUTLINE } from '@/lib/ui'
import {
  conferenciaTotaisAtual,
  iniciarConferenciaTotais,
  limparConferenciaTotais,
  type ResultadoConferenciaTotais,
  type TotalConferidoCliente,
} from '@/lib/conferenciaTotaisEmAndamento'
import { JanelaRevisao } from './janela-revisao'
import { TituloSecao } from './titulo-secao'

export interface CardConferenciaTotaisProps {
  propostaId: string
  /** Abre o PDF original na página citada, com o valor destacado. */
  onVerPagina?: (pagina: number, destaque?: string, onUsarSelecao?: (texto: string) => void) => void
}

type Estado =
  | { fase: 'carregando' }
  | { fase: 'pronta'; resultado: ResultadoConferenciaTotais }
  | { fase: 'erro'; mensagem: string }

/**
 * Conferência rápida (sem IA, determinística) dos valores de total/
 * resultado geral do PDF contra o documento — atalho a mais além da
 * checagem por IA (`painel-checagem-conversao.tsx`), pra bater o olho nos
 * números de maior risco financeiro sem esperar chamada de modelo nenhuma.
 * Dispara sozinho ao montar (diferente da checagem por IA, que espera
 * clique) — é praticamente instantâneo. Ver
 * docs/superpowers/specs/2026-09-16-conferencia-totais-design.md.
 */
export function CardConferenciaTotais({ propostaId, onVerPagina }: CardConferenciaTotaisProps) {
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' })
  const [aberta, setAberta] = useState(false)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  function disparar() {
    setEstado({ fase: 'carregando' })
    iniciarConferenciaTotais(propostaId).then(
      (resultado) => {
        if (montado.current) setEstado({ fase: 'pronta', resultado })
      },
      (erro) => {
        if (montado.current) {
          setEstado({ fase: 'erro', mensagem: erro instanceof Error ? erro.message : 'Não foi possível conferir os totais.' })
        }
      }
    )
  }

  useEffect(() => {
    const atual = conferenciaTotaisAtual(propostaId)
    if (atual?.status === 'ok') {
      setEstado({ fase: 'pronta', resultado: atual.resultado })
      return
    }
    if (atual?.status === 'erro') {
      setEstado({ fase: 'erro', mensagem: atual.mensagem })
      return
    }
    if (atual?.status === 'rodando') {
      setEstado({ fase: 'carregando' })
      atual.promise.then(
        (resultado) => {
          if (montado.current) setEstado({ fase: 'pronta', resultado })
        },
        (erro) => {
          if (montado.current) {
            setEstado({ fase: 'erro', mensagem: erro instanceof Error ? erro.message : 'Não foi possível conferir os totais.' })
          }
        }
      )
      return
    }
    disparar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propostaId])

  function tentarDeNovo() {
    limparConferenciaTotais(propostaId)
    disparar()
  }

  const titulo = <TituloSecao icone={Calculator}>Conferência de totais</TituloSecao>

  if (estado.fase === 'carregando') {
    return (
      <section className="space-y-2">
        {titulo}
        <p className="flex items-start gap-2 text-[15px] text-mid-grey">
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" strokeWidth={2.25} />
          Conferindo totais...
        </p>
      </section>
    )
  }

  if (estado.fase === 'erro') {
    return (
      <section className="space-y-2">
        {titulo}
        <p className="flex items-start gap-2 text-[15px] text-red-crit">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
          {estado.mensagem}
        </p>
        <button type="button" onClick={tentarDeNovo} className={BTN_OUTLINE}>
          Tentar de novo
        </button>
      </section>
    )
  }

  const { totais } = estado.resultado
  const divergentes = totais.filter((t) => !t.encontradoNoDocumento)

  if (totais.length === 0) {
    return (
      <section className="space-y-1">
        {titulo}
        <p className="text-[15px] text-mid-grey">
          Nenhum total detectado automaticamente — confira o documento manualmente.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-2">
      {titulo}
      <button
        type="button"
        onClick={() => setAberta(true)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[15px] font-medium transition-colors',
          divergentes.length > 0
            ? 'border-red-crit/30 bg-red-crit-light/40 text-red-crit hover:bg-red-crit-light/60'
            : 'border-green-ok/30 bg-green-ok-light/40 text-navy hover:bg-green-ok-light/60'
        )}
      >
        {divergentes.length > 0 ? (
          <>
            <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
            {divergentes.length} de {totais.length} {totais.length === 1 ? 'total não bate' : 'totais não batem'}
          </>
        ) : (
          <>
            <CircleCheck className="size-4 shrink-0 text-green-ok" strokeWidth={2.25} />
            {totais.length} {totais.length === 1 ? 'total conferido' : 'totais conferidos'}
          </>
        )}
      </button>

      {aberta && (
        <JanelaRevisao
          titulo={`${totais.length} ${totais.length === 1 ? 'total conferido' : 'totais conferidos'}`}
          subtitulo="Rótulo e valor extraídos do PDF, conferidos contra o documento inteiro."
          onFechar={() => setAberta(false)}
        >
          <table className="w-full text-left text-[15px]">
            <thead>
              <tr className="border-b border-border-grey text-sm text-mid-grey">
                <th className="py-2 pr-3 font-medium">Página</th>
                <th className="py-2 pr-3 font-medium">Rótulo</th>
                <th className="py-2 pr-3 font-medium">Valor no PDF</th>
                <th className="py-2 pr-3 font-medium">No documento</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {totais.map((total, indice) => (
                <LinhaTotal key={indice} total={total} onVerPagina={onVerPagina} />
              ))}
            </tbody>
          </table>
        </JanelaRevisao>
      )}
    </section>
  )
}

function LinhaTotal({
  total,
  onVerPagina,
}: {
  total: TotalConferidoCliente
  onVerPagina?: (pagina: number, destaque?: string, onUsarSelecao?: (texto: string) => void) => void
}) {
  return (
    <tr className="border-b border-border-grey last:border-0">
      <td className="py-2 pr-3 tabular-nums">{total.pagina}</td>
      <td className="py-2 pr-3">{total.rotulo}</td>
      <td className="py-2 pr-3 tabular-nums">{total.valorNoPdf}</td>
      <td className="py-2 pr-3">
        {total.encontradoNoDocumento ? (
          <span className="inline-flex items-center gap-1 text-green-ok">
            <CircleCheck className="size-4" strokeWidth={2.25} /> Achado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-red-crit">
            <X className="size-4" strokeWidth={2.25} /> Não achado
          </span>
        )}
      </td>
      <td className="py-2">
        {!total.encontradoNoDocumento && onVerPagina && (
          <button
            type="button"
            onClick={() => onVerPagina(total.pagina, total.valorNoPdf)}
            className="inline-flex items-center gap-1 text-sm font-medium text-navy-3 underline-offset-2 hover:text-orange hover:underline"
          >
            <ExternalLink className="size-3.5" strokeWidth={2.25} />
            Ver no PDF
          </button>
        )}
      </td>
    </tr>
  )
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- src/app/propostas-comerciais/\[id\]/card-conferencia-totais.test.tsx`
Expected: PASS — 5 testes.

- [ ] **Step 5: Commit**

```bash
git add src/app/propostas-comerciais/\[id\]/card-conferencia-totais.tsx src/app/propostas-comerciais/\[id\]/card-conferencia-totais.test.tsx
git commit -m "feat: CardConferenciaTotais — card de conferência rápida de totais"
```

---

### Task 6: Ligar o card em `espaco-proposta.tsx`

**Files:**
- Modify: `src/app/propostas-comerciais/[id]/espaco-proposta.tsx:20,300-305`
- Modify: `src/app/propostas-comerciais/[id]/espaco-proposta.test.tsx` (novo teste)

**Interfaces:**
- Consumes: `CardConferenciaTotais` (Task 5), `verPaginaNoOriginal` (já existe em
  `espaco-proposta.tsx:207-211`, mesma função já passada pra `PainelChecagemConversao`).

- [ ] **Step 1: Escrever o teste de integração (falhando)**

Em `src/app/propostas-comerciais/[id]/espaco-proposta.test.tsx`, adicione dentro do `describe('EspacoProposta', ...)`,
logo depois do teste `'mostra documento e painel de checagem juntos — sem abas'`:

```tsx
  it('mostra o card de conferência de totais junto do painel de checagem', async () => {
    render(<EspacoProposta {...props()} />)

    expect(await screen.findByText('Conferência de totais')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- src/app/propostas-comerciais/\[id\]/espaco-proposta.test.tsx -t "conferência de totais"`
Expected: FAIL — texto "Conferência de totais" não encontrado na tela.

- [ ] **Step 3: Importar e renderizar o card**

Em `src/app/propostas-comerciais/[id]/espaco-proposta.tsx`, adicione o import junto dos outros
componentes locais (perto da linha 20):

```ts
import { CardConferenciaTotais } from './card-conferencia-totais'
```

E renderize o card ACIMA de `PainelChecagemConversao`, dentro do mesmo `<div className="space-y-4">`
(por volta da linha 299-306):

```tsx
          <div className="space-y-4">
            <CardConferenciaTotais propostaId={propostaId} onVerPagina={verPaginaNoOriginal} />
            <PainelChecagemConversao
              propostaId={propostaId}
              conteudoMarkdown={markdown}
              onConteudoAtualizado={mudarESalvar}
              onVerPagina={verPaginaNoOriginal}
            />
          </div>
```

- [ ] **Step 4: Rodar TODA a suíte de `espaco-proposta.test.tsx` e confirmar que passa**

Run: `npm test -- src/app/propostas-comerciais/\[id\]/espaco-proposta.test.tsx`
Expected: PASS — todos os testes existentes continuam passando (o `global.fetch` mockado nesses testes
devolve um corpo sem `totais`; o card normaliza isso pra lista vazia e mostra a mensagem neutra, sem
quebrar nada — ver `iniciarConferenciaTotais` na Task 4) e o novo teste também passa.

- [ ] **Step 5: Rodar a suíte inteira do projeto**

Run: `npm test`
Expected: PASS — nenhuma regressão em outros arquivos.

- [ ] **Step 6: Commit**

```bash
git add src/app/propostas-comerciais/\[id\]/espaco-proposta.tsx src/app/propostas-comerciais/\[id\]/espaco-proposta.test.tsx
git commit -m "feat: liga CardConferenciaTotais no painel lateral da Proposta Comercial"
```
