# Revisão de português na Proposta Comercial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma revisão de português sob demanda na tela de proposta final, que propõe apenas correções de ortografia/acentuação e deixa o usuário aceitar ou recusar num diff.

**Architecture:** Um endpoint stateless (`POST .../revisao-portugues`) manda o Markdown atual da proposta pro modelo (via a infra de IA já existente em `src/lib/ia/modelo.ts`) e devolve `{ original, corrigido }`. Um guardrail puro em código rejeita (422) qualquer resposta que mude número, estrutura ou contagem de linhas. No front, `PropostaFinal` ganha as abas **Visualizar** e **Correção da IA**; a aba de correção renderiza o texto com as trocas destacadas inline (`<ins>`/`<del>` via `diffWords`) e aplica a versão escolhida pelo `PATCH` já existente.

**Tech Stack:** Next.js 15 (App Router, route handlers), React 19, TypeScript, Prisma, Vercel AI SDK (`ai` — `generateText`), `diff` (jsdiff), Jest + Testing Library, Tailwind v4.

## Global Constraints

- **Sem coautoria nos commits:** o repo VerAI é público no GitHub. NUNCA adicionar `Co-Authored-By`, `Claude-Session` ou similar nas mensagens de commit.
- **Proposta Comercial continua determinística:** a conversão de arquivos → Markdown permanece 100% sem IA. A ÚNICA etapa de IA permitida é esta revisão, e só quando o usuário a aciona e aceita explicitamente o resultado.
- **A IA nunca altera conteúdo sozinha:** nada de número, data, valor, nome próprio ou estrutura Markdown muda. O guardrail é obrigatório e roda sempre antes de devolver o resultado.
- **Idioma:** todo código, comentário, nome de símbolo, mensagem de erro e texto de UI em português (pt-BR), seguindo o padrão do repo.
- **Testes:** `npm test` (Jest). Route handlers e módulos de IA usam `/** @jest-environment node */`. Componentes usam o ambiente jsdom padrão.
- **Padrões de teste existentes:** mock de auth com `jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))`; mock de prisma com objeto literal só com os métodos usados; mock do modelo de IA como em `src/lib/ia/analisar.test.ts`.
- **Tokens de UI:** reusar `BTN_PRIMARY` / `BTN_OUTLINE` de `@/lib/ui`, `cn` de `@/lib/utils`, classes `markdown-preview`, e as cores `green-ok` / `green-ok-light` / `red-crit` / `red-crit-light` (já definidas em `globals.css`).

---

## File Structure

**Criar:**
- `src/lib/ia/revisarPortugues.ts` — chama o modelo com o prompt restrito, devolve o Markdown corrigido sem cercas de código.
- `src/lib/ia/revisarPortugues.test.ts`
- `src/lib/propostas/validarRevisaoPortugues.ts` — função pura: original × corrigido → mensagem de problema ou `null`.
- `src/lib/propostas/validarRevisaoPortugues.test.ts`
- `src/lib/diffPropostaRenderizada.ts` — original + corrigido → HTML renderizado com `<ins>`/`<del>` inline.
- `src/lib/diffPropostaRenderizada.test.ts`
- `src/app/api/propostas-comerciais/[id]/revisao-portugues/route.ts` — o endpoint.
- `src/app/api/propostas-comerciais/[id]/revisao-portugues/route.test.ts`

**Modificar:**
- `src/app/propostas-comerciais/[id]/proposta-final.tsx` — abas + estados da aba de correção.
- `src/app/propostas-comerciais/[id]/proposta-final.test.tsx` — ajustar chamadas existentes + testes novos.
- `src/app/propostas-comerciais/[id]/page.tsx` — passar `propostaId` e `onUsarCorrecoes` pro `PropostaFinal`.
- `src/app/globals.css` — estilos de `.markdown-preview ins` / `.markdown-preview del`.
- `package.json` / `package-lock.json` — dependência `diff`.

---

## Task 1: Módulo de IA `revisarPortugues`

**Files:**
- Create: `src/lib/ia/revisarPortugues.ts`
- Test: `src/lib/ia/revisarPortugues.test.ts`

**Interfaces:**
- Consumes: `getModel()` de `src/lib/ia/modelo.ts` (retorna o modelo do provedor configurado); `generateText` de `ai`.
- Produces: `revisarPortugues(markdown: string): Promise<string>` — devolve o Markdown corrigido, já sem cercas ` ``` ` ao redor.

- [ ] **Step 1: Escrever o teste que falha**

```ts
/** @jest-environment node */
jest.mock('ai', () => ({ generateText: jest.fn() }))
jest.mock('./modelo', () => ({ getModel: jest.fn(() => 'modelo-mock') }))

import { generateText } from 'ai'
import { revisarPortugues } from './revisarPortugues'

describe('revisarPortugues', () => {
  beforeEach(() => jest.clearAllMocks())

  it('devolve o texto do modelo e passa o markdown recebido no prompt', async () => {
    ;(generateText as jest.Mock).mockResolvedValue({ text: '# Proposta corrigida' })

    const resultado = await revisarPortugues('# Proposta corigida')

    expect(resultado).toBe('# Proposta corrigida')
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'modelo-mock',
        prompt: expect.stringContaining('# Proposta corigida'),
      })
    )
  })

  it('remove cercas de código markdown que o modelo adicione ao redor da resposta', async () => {
    ;(generateText as jest.Mock).mockResolvedValue({ text: '```markdown\n# Proposta\n\nTexto.\n```' })

    expect(await revisarPortugues('# Proposta\n\nTexto.')).toBe('# Proposta\n\nTexto.')
  })

  it('devolve o texto aparado quando não há cercas', async () => {
    ;(generateText as jest.Mock).mockResolvedValue({ text: '  # Proposta\n' })

    expect(await revisarPortugues('# Proposta')).toBe('# Proposta')
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- revisarPortugues`
Expected: FAIL — `Cannot find module './revisarPortugues'`.

- [ ] **Step 3: Implementar o módulo**

```ts
import { generateText } from 'ai'
import { getModel } from './modelo'

/**
 * Revisão ortográfica da Proposta Comercial — a ÚNICA etapa de IA permitida
 * nesse fluxo. Corrige só ortografia e acentuação; não reescreve, não mexe em
 * número nem em estrutura. O resultado nunca é aplicado sozinho: o endpoint
 * roda um guardrail e a UI mostra o diff pro usuário aceitar ou recusar.
 */
const PROMPT = [
  'Você é um revisor ortográfico de português do Brasil, não um editor de texto.',
  '',
  'Sua ÚNICA tarefa é corrigir erros de ortografia, acentuação, concordância e',
  'digitação no texto abaixo, que está em Markdown.',
  '',
  'É PROIBIDO:',
  '- reescrever, reformular ou "melhorar" frases que já estão gramaticalmente corretas;',
  '- reordenar, resumir, expandir ou traduzir qualquer trecho;',
  '- adicionar ou remover qualquer informação, frase, item ou parágrafo;',
  '- alterar qualquer número, data, valor monetário, sigla, nome próprio ou e-mail;',
  '- alterar a marcação Markdown: mantenha exatamente os mesmos #, **, |, -, as',
  '  mesmas quebras de linha e as mesmas linhas em branco.',
  '',
  'Se uma frase já está correta, copie-a sem nenhuma mudança. Se o texto inteiro',
  'já está correto, devolva-o idêntico.',
  '',
  'Responda SOMENTE com o Markdown corrigido — sem comentários, sem explicação e',
  'sem cercas de código ``` ao redor.',
].join('\n')

export async function revisarPortugues(markdown: string): Promise<string> {
  const { text } = await generateText({
    model: getModel(),
    prompt: `${PROMPT}\n\n---\n\n${markdown}`,
  })
  return removerCercas(text)
}

function removerCercas(texto: string): string {
  const aparado = texto.trim()
  const comCerca = aparado.match(/^```(?:markdown|md)?\n([\s\S]*?)\n```$/)
  return comCerca ? comCerca[1] : aparado
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- revisarPortugues`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ia/revisarPortugues.ts src/lib/ia/revisarPortugues.test.ts
git commit -m "feat: modulo de IA de revisao ortografica da Proposta Comercial"
```

---

## Task 2: Guardrail `validarRevisaoPortugues`

**Files:**
- Create: `src/lib/propostas/validarRevisaoPortugues.ts`
- Test: `src/lib/propostas/validarRevisaoPortugues.test.ts`

**Interfaces:**
- Consumes: nada (função pura sobre strings).
- Produces: `validarRevisaoPortugues(original: string, corrigido: string): string | null` — `null` = seguro aplicar; string = mensagem curta do que a revisão alterou além de ortografia.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { validarRevisaoPortugues } from './validarRevisaoPortugues'

describe('validarRevisaoPortugues', () => {
  it('aceita quando a revisão só troca acento/ortografia de palavras', () => {
    expect(validarRevisaoPortugues('A proposta e muito boa.', 'A proposta é muito boa.')).toBeNull()
  })

  it('aceita quando o texto volta idêntico', () => {
    expect(validarRevisaoPortugues('# Proposta\n\nTexto.', '# Proposta\n\nTexto.')).toBeNull()
  })

  it('rejeita quando um número muda', () => {
    expect(validarRevisaoPortugues('Valor total: R$ 100.', 'Valor total: R$ 200.')).toMatch(/número/i)
  })

  it('rejeita quando some uma linha do documento', () => {
    expect(validarRevisaoPortugues('linha um\nlinha dois', 'linha um')).toMatch(/linhas/i)
  })

  it('rejeita quando some uma linha de tabela', () => {
    const original = '| item | valor |\n| --- | --- |\n| A | 1 |\n| B | 2 |'
    const corrigido = '| item | valor |\n| --- | --- |\n| A | 1 |'
    expect(validarRevisaoPortugues(original, corrigido)).toBeTruthy()
  })

  it('rejeita quando um item de lista deixa de ser item', () => {
    expect(validarRevisaoPortugues('- primeiro\nsegundo', 'primeiro\nsegundo')).toMatch(/listas/i)
  })

  it('rejeita quando um título deixa de ser título', () => {
    expect(validarRevisaoPortugues('# Escopo\n\ntexto', 'Escopo\n\ntexto')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- validarRevisaoPortugues`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar o guardrail**

```ts
/**
 * Guardrail da revisão ortográfica da Proposta Comercial: compara o Markdown
 * original com o que a IA devolveu e rejeita qualquer coisa que vá além de
 * troca de palavra — mudança de número, de estrutura ou de contagem de linhas.
 * Devolve `null` quando é seguro aplicar, ou uma mensagem curta do problema.
 */
export function validarRevisaoPortugues(original: string, corrigido: string): string | null {
  const linhas = (s: string) => s.split('\n')
  const contaTitulos = (s: string) => linhas(s).filter((l) => /^\s*#{1,6}\s/.test(l)).length
  const contaLinhasTabela = (s: string) => linhas(s).filter((l) => l.includes('|')).length
  const contaItensLista = (s: string) => linhas(s).filter((l) => /^\s*([-*]|\d+\.)\s/.test(l)).length
  const digitosOrdenados = (s: string) => (s.match(/\d+/g) ?? []).slice().sort()

  if (linhas(original).length !== linhas(corrigido).length) {
    return 'a revisão alterou a quantidade de linhas do documento'
  }
  if (contaTitulos(original) !== contaTitulos(corrigido)) {
    return 'a revisão alterou os títulos do documento'
  }
  if (contaLinhasTabela(original) !== contaLinhasTabela(corrigido)) {
    return 'a revisão alterou as tabelas do documento'
  }
  if (contaItensLista(original) !== contaItensLista(corrigido)) {
    return 'a revisão alterou as listas do documento'
  }

  const digitosOriginal = digitosOrdenados(original)
  const digitosCorrigido = digitosOrdenados(corrigido)
  if (
    digitosOriginal.length !== digitosCorrigido.length ||
    digitosOriginal.some((valor, i) => valor !== digitosCorrigido[i])
  ) {
    return 'a revisão alterou números do documento'
  }

  return null
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- validarRevisaoPortugues`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/propostas/validarRevisaoPortugues.ts src/lib/propostas/validarRevisaoPortugues.test.ts
git commit -m "feat: guardrail que barra revisao que mexe alem de ortografia"
```

---

## Task 3: Endpoint `POST /api/propostas-comerciais/[id]/revisao-portugues`

**Files:**
- Create: `src/app/api/propostas-comerciais/[id]/revisao-portugues/route.ts`
- Test: `src/app/api/propostas-comerciais/[id]/revisao-portugues/route.test.ts`

**Interfaces:**
- Consumes: `getAuthUser` de `@/lib/auth`; `prisma` de `@/lib/prisma`; `revisarPortugues` (Task 1); `validarRevisaoPortugues` (Task 2).
- Produces: `POST(request, { params }): Promise<NextResponse>`. Respostas: `401` sem auth; `404` proposta inexistente; `400` proposta sem `conteudoMarkdown`; `422 { error }` quando o guardrail reprova; `200 { original: string, corrigido: string }` no sucesso.

- [ ] **Step 1: Escrever o teste que falha**

```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { propostaComercial: { findUnique: jest.fn() } },
}))
jest.mock('@/lib/ia/revisarPortugues', () => ({ revisarPortugues: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revisarPortugues } from '@/lib/ia/revisarPortugues'
import { POST } from './route'

const requisicao = () =>
  new NextRequest('http://localhost/api/propostas-comerciais/p1/revisao-portugues', { method: 'POST' })
const contexto = { params: Promise.resolve({ id: 'p1' }) }

describe('POST /api/propostas-comerciais/[id]/revisao-portugues', () => {
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

  it('retorna 400 quando a proposta ainda não tem conteúdo', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', conteudoMarkdown: null })
    expect((await POST(requisicao(), contexto)).status).toBe(400)
  })

  it('retorna 200 com original e corrigido no caminho feliz', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: 'A proposta e boa.',
    })
    ;(revisarPortugues as jest.Mock).mockResolvedValue('A proposta é boa.')

    const resposta = await POST(requisicao(), contexto)

    expect(resposta.status).toBe(200)
    await expect(resposta.json()).resolves.toEqual({
      original: 'A proposta e boa.',
      corrigido: 'A proposta é boa.',
    })
  })

  it('retorna 422 quando a revisão altera um número', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: 'Valor: 100',
    })
    ;(revisarPortugues as jest.Mock).mockResolvedValue('Valor: 200')

    const resposta = await POST(requisicao(), contexto)

    expect(resposta.status).toBe(422)
    await expect(resposta.json()).resolves.toEqual({
      error: expect.stringMatching(/número/i),
    })
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- revisao-portugues/route`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implementar o route handler**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { revisarPortugues } from '@/lib/ia/revisarPortugues'
import { validarRevisaoPortugues } from '@/lib/propostas/validarRevisaoPortugues'

/**
 * Revisão ortográfica sob demanda da Proposta Comercial. Stateless: lê o
 * `conteudoMarkdown` atual, manda pro modelo, roda o guardrail e devolve as
 * duas versões pro front mostrar o diff. Nada é gravado aqui — aplicar a
 * versão corrigida é o `PATCH` normal da proposta.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const proposta = await prisma.propostaComercial.findUnique({ where: { id } })
  if (!proposta) {
    return NextResponse.json({ error: 'proposta comercial não encontrada' }, { status: 404 })
  }

  const original = proposta.conteudoMarkdown
  if (!original || !original.trim()) {
    return NextResponse.json({ error: 'a proposta ainda não tem conteúdo pra revisar' }, { status: 400 })
  }

  const corrigido = await revisarPortugues(original)

  const problema = validarRevisaoPortugues(original, corrigido)
  if (problema) {
    return NextResponse.json(
      { error: `${problema} — não é seguro aplicar automaticamente. Revise o texto manualmente em "Editar novamente".` },
      { status: 422 }
    )
  }

  return NextResponse.json({ original, corrigido })
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- revisao-portugues/route`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/propostas-comerciais/[id]/revisao-portugues"
git commit -m "feat: endpoint de revisao de portugues da Proposta Comercial"
```

---

## Task 4: Diff renderizado `diffPropostaRenderizada`

**Files:**
- Modify: `package.json` (dependência `diff`)
- Create: `src/lib/diffPropostaRenderizada.ts`
- Test: `src/lib/diffPropostaRenderizada.test.ts`

**Interfaces:**
- Consumes: `renderizarMarkdownProposta` de `@/lib/renderizarMarkdownProposta`; `diffWords` de `diff`.
- Produces: `diffPropostaRenderizada(original: string, corrigido: string): string` — HTML renderizado do documento corrigido, com cada trecho trocado marcado inline como `<del>…</del>` (removido) e `<ins>…</ins>` (adicionado). Se as duas árvores renderizadas divergirem em número de nós de texto, cai num fallback que devolve só o HTML da versão corrigida, sem marcação.

- [ ] **Step 1: Instalar a dependência**

Run: `npm install diff@^7`
Expected: `diff` aparece em `dependencies` no `package.json`. O jsdiff 7 já traz os próprios tipos TypeScript — não instale `@types/diff`. Se `npx tsc --noEmit` reclamar de tipos de `diff`, aí sim rode `npm install -D @types/diff`.

- [ ] **Step 2: Escrever o teste que falha**

```ts
import { diffPropostaRenderizada } from './diffPropostaRenderizada'

describe('diffPropostaRenderizada', () => {
  it('marca a palavra trocada com <del> e <ins> dentro do parágrafo renderizado', () => {
    const html = diffPropostaRenderizada('A proposta e boa.', 'A proposta é boa.')

    expect(html).toMatch(/<del>\s*e\s*<\/del>/)
    expect(html).toMatch(/<ins>\s*é\s*<\/ins>/)
    expect(html).toContain('<p>')
  })

  it('não marca nada quando os textos são idênticos', () => {
    const html = diffPropostaRenderizada('# Proposta\n\nTexto igual.', '# Proposta\n\nTexto igual.')

    expect(html).not.toContain('<del>')
    expect(html).not.toContain('<ins>')
  })

  it('preserva títulos e tabelas na saída', () => {
    const md = '# Título\n\n| a | b |\n| --- | --- |\n| 1 | 2 |'
    const html = diffPropostaRenderizada(md, md)

    expect(html).toContain('<h1')
    expect(html).toContain('<table')
  })

  it('cai no fallback (só a versão corrigida) quando a estrutura de texto diverge', () => {
    const html = diffPropostaRenderizada('um dois', 'um dois três\n\nquatro')

    expect(html).toContain('quatro')
    expect(html).not.toContain('<del>')
  })
})
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `npm test -- diffPropostaRenderizada`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 4: Implementar o diff**

```ts
import { diffWords } from 'diff'
import { renderizarMarkdownProposta } from './renderizarMarkdownProposta'

/**
 * Recebe o Markdown original e o corrigido pela IA e devolve o HTML do
 * documento corrigido com cada troca de palavra destacada inline
 * (`<del>` pro texto removido, `<ins>` pro adicionado). Como o guardrail já
 * garante que a estrutura não mudou, dá pra casar os nós de texto das duas
 * árvores renderizadas por posição e diffar par a par.
 */
export function diffPropostaRenderizada(original: string, corrigido: string): string {
  const htmlCorrigido = renderizarMarkdownProposta(corrigido)

  if (typeof DOMParser === 'undefined') return htmlCorrigido

  const docOriginal = new DOMParser().parseFromString(renderizarMarkdownProposta(original), 'text/html')
  const docCorrigido = new DOMParser().parseFromString(htmlCorrigido, 'text/html')

  const textosOriginal = coletarNosDeTexto(docOriginal.body, [])
  const textosCorrigido = coletarNosDeTexto(docCorrigido.body, [])

  if (textosOriginal.length !== textosCorrigido.length) return htmlCorrigido

  textosCorrigido.forEach((noCorrigido, i) => {
    const textoOriginal = textosOriginal[i].textContent ?? ''
    const textoCorrigido = noCorrigido.textContent ?? ''
    if (textoOriginal === textoCorrigido) return

    const span = docCorrigido.createElement('span')
    for (const parte of diffWords(textoOriginal, textoCorrigido)) {
      if (parte.added) {
        const ins = docCorrigido.createElement('ins')
        ins.textContent = parte.value
        span.appendChild(ins)
      } else if (parte.removed) {
        const del = docCorrigido.createElement('del')
        del.textContent = parte.value
        span.appendChild(del)
      } else {
        span.appendChild(docCorrigido.createTextNode(parte.value))
      }
    }
    noCorrigido.replaceWith(span)
  })

  return docCorrigido.body.innerHTML
}

function coletarNosDeTexto(no: Node, acumulador: Text[]): Text[] {
  for (const filho of Array.from(no.childNodes)) {
    if (filho.nodeType === 3) {
      if ((filho.textContent ?? '').trim() !== '') acumulador.push(filho as Text)
    } else {
      coletarNosDeTexto(filho, acumulador)
    }
  }
  return acumulador
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npm test -- diffPropostaRenderizada`
Expected: PASS (4 testes). Se o teste da palavra trocada falhar por espaço em branco preso no token, confira o HTML gerado com um `console.log` e ajuste o regex do teste pra casar o formato real do `diffWords` (mantendo a intenção: um `<del>` com "e" e um `<ins>` com "é").

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/diffPropostaRenderizada.ts src/lib/diffPropostaRenderizada.test.ts
git commit -m "feat: diff renderizado inline entre proposta original e revisada"
```

---

## Task 5: Estilos do diff no `globals.css`

**Files:**
- Modify: `src/app/globals.css` — dentro do bloco `.markdown-preview` (perto do `.callout-divergencia`, antes do `}` que fecha o `@layer`).

**Interfaces:**
- Consumes: cores `green-ok` / `green-ok-light` / `red-crit` / `red-crit-light` já declaradas no `@theme`.
- Produces: aparência de `<ins>` / `<del>` dentro de `.markdown-preview`.

- [ ] **Step 1: Adicionar as regras**

Depois do bloco `.markdown-preview .callout-divergencia::before { ... }` e antes do `}` final, inserir:

```css
  /* Diff da revisão de português — <ins>/<del> inline no texto renderizado
     da aba "Correção da IA" (ver src/lib/diffPropostaRenderizada.ts). */
  .markdown-preview ins {
    @apply rounded bg-green-ok-light px-0.5 font-medium text-green-ok no-underline;
  }
  .markdown-preview del {
    @apply rounded bg-red-crit-light px-0.5 text-red-crit;
  }
```

- [ ] **Step 2: Conferir que o build de CSS não quebra**

Run: `npx tsc --noEmit` e `npm run lint`
Expected: sem erros novos. (O CSS em si é validado no `npm run dev` / `build`; aqui só garantimos que nada de TS/lint regrediu.)

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: destaque de insercao/remocao no diff da proposta"
```

---

## Task 6: Abas e aba "Correção da IA" no `PropostaFinal`

**Files:**
- Modify: `src/app/propostas-comerciais/[id]/proposta-final.tsx`
- Modify: `src/app/propostas-comerciais/[id]/proposta-final.test.tsx`
- Modify: `src/app/propostas-comerciais/[id]/page.tsx`

**Interfaces:**
- Consumes: `diffPropostaRenderizada` (Task 4); endpoint `POST /api/propostas-comerciais/[id]/revisao-portugues` (Task 3); `renderizarMarkdownProposta`, `copiarMarkdownFormatado`, `BTN_PRIMARY`, `BTN_OUTLINE`, `cn`.
- Produces: `PropostaFinal` passa a exigir duas props novas — `propostaId: string` e `onUsarCorrecoes: (markdown: string) => Promise<void>` — além das já existentes `conteudoMarkdown: string` e `onEditarNovamente: () => void`.

- [ ] **Step 1: Ajustar os testes existentes e escrever os novos (falham)**

Substituir o conteúdo de `proposta-final.test.tsx` por:

```tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { PropostaFinal } from './proposta-final'

class ClipboardItemFalso {
  constructor(public items: Record<string, Blob>) {}
}

const propsBase = {
  propostaId: 'p1',
  conteudoMarkdown: '# Proposta',
  onEditarNovamente: jest.fn(),
  onUsarCorrecoes: jest.fn().mockResolvedValue(undefined),
}

describe('PropostaFinal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as unknown as { ClipboardItem: typeof ClipboardItemFalso }).ClipboardItem = ClipboardItemFalso
    Object.assign(navigator, { clipboard: { write: jest.fn().mockResolvedValue(undefined) } })
  })

  it('mostra o preview renderizado do markdown na aba Visualizar', () => {
    render(<PropostaFinal {...propsBase} />)
    expect(screen.getByRole('heading', { name: 'Proposta' })).toBeInTheDocument()
  })

  it('copia o conteúdo formatado (HTML + texto simples) e mostra "Copiado!" temporariamente', async () => {
    jest.useFakeTimers()
    render(<PropostaFinal {...propsBase} />)

    fireEvent.click(screen.getByRole('button', { name: /Copiar formatado/ }))

    await waitFor(() => expect(navigator.clipboard.write).toHaveBeenCalled())
    const itemCopiado = (navigator.clipboard.write as jest.Mock).mock.calls[0][0][0] as ClipboardItemFalso
    expect(itemCopiado.items['text/html']).toBeInstanceOf(Blob)
    expect(itemCopiado.items['text/plain']).toBeInstanceOf(Blob)
    expect(await screen.findByRole('button', { name: /Copiado!/ })).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(screen.getByRole('button', { name: /Copiar formatado/ })).toBeInTheDocument()
    jest.useRealTimers()
  })

  it('chama onEditarNovamente ao clicar em "Editar novamente"', () => {
    render(<PropostaFinal {...propsBase} />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar novamente' }))
    expect(propsBase.onEditarNovamente).toHaveBeenCalled()
  })

  it('na aba "Correção da IA" mostra o botão "Revisar português"', () => {
    render(<PropostaFinal {...propsBase} />)
    fireEvent.click(screen.getByRole('button', { name: /Correção da IA/ }))
    expect(screen.getByRole('button', { name: /Revisar português/ })).toBeInTheDocument()
  })

  it('revisa e mostra o diff com botões de aceitar/recusar', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ original: 'A proposta e boa.', corrigido: 'A proposta é boa.' }),
    }) as jest.Mock

    render(<PropostaFinal {...propsBase} conteudoMarkdown="A proposta e boa." />)
    fireEvent.click(screen.getByRole('button', { name: /Correção da IA/ }))
    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))

    expect(await screen.findByRole('button', { name: /Usar correções/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Manter original/ })).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/propostas-comerciais/p1/revisao-portugues',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('"Usar correções" chama onUsarCorrecoes com a versão corrigida', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ original: 'A proposta e boa.', corrigido: 'A proposta é boa.' }),
    }) as jest.Mock

    render(<PropostaFinal {...propsBase} conteudoMarkdown="A proposta e boa." />)
    fireEvent.click(screen.getByRole('button', { name: /Correção da IA/ }))
    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Usar correções/ }))

    await waitFor(() => expect(propsBase.onUsarCorrecoes).toHaveBeenCalledWith('A proposta é boa.'))
  })

  it('"Manter original" volta ao estado inicial sem chamar onUsarCorrecoes', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ original: 'A proposta e boa.', corrigido: 'A proposta é boa.' }),
    }) as jest.Mock

    render(<PropostaFinal {...propsBase} conteudoMarkdown="A proposta e boa." />)
    fireEvent.click(screen.getByRole('button', { name: /Correção da IA/ }))
    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Manter original/ }))

    expect(await screen.findByRole('button', { name: /Revisar português/ })).toBeInTheDocument()
    expect(propsBase.onUsarCorrecoes).not.toHaveBeenCalled()
  })

  it('mostra a mensagem do guardrail quando a resposta é 422', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ error: 'a revisão alterou números do documento — não é seguro aplicar.' }),
    }) as jest.Mock

    render(<PropostaFinal {...propsBase} />)
    fireEvent.click(screen.getByRole('button', { name: /Correção da IA/ }))
    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))

    expect(await screen.findByText(/alterou números do documento/)).toBeInTheDocument()
  })

  it('mostra "Nenhum erro de português encontrado" quando original e corrigido são iguais', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ original: '# Proposta', corrigido: '# Proposta' }),
    }) as jest.Mock

    render(<PropostaFinal {...propsBase} />)
    fireEvent.click(screen.getByRole('button', { name: /Correção da IA/ }))
    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))

    expect(await screen.findByText(/Nenhum erro de português encontrado/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `npm test -- proposta-final`
Expected: FAIL — props novas não existem / aba "Correção da IA" não existe.

- [ ] **Step 3: Reescrever `proposta-final.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { ClipboardCopy, ClipboardCheck, Pencil, Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { BTN_PRIMARY, BTN_OUTLINE } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { copiarMarkdownFormatado } from '@/lib/copiarMarkdownFormatado'
import { renderizarMarkdownProposta } from '@/lib/renderizarMarkdownProposta'
import { diffPropostaRenderizada } from '@/lib/diffPropostaRenderizada'

export interface PropostaFinalProps {
  propostaId: string
  conteudoMarkdown: string
  onEditarNovamente: () => void
  onUsarCorrecoes: (markdown: string) => Promise<void>
}

type EstadoRevisao =
  | { fase: 'inicial' }
  | { fase: 'carregando' }
  | { fase: 'erro'; mensagem: string }
  | { fase: 'pronta'; original: string; corrigido: string }

export function PropostaFinal({ propostaId, conteudoMarkdown, onEditarNovamente, onUsarCorrecoes }: PropostaFinalProps) {
  const [copiado, setCopiado] = useState(false)
  const [aba, setAba] = useState<'visualizar' | 'correcao'>('visualizar')
  const [revisao, setRevisao] = useState<EstadoRevisao>({ fase: 'inicial' })
  const [aplicando, setAplicando] = useState(false)

  async function handleCopiarFormatado() {
    await copiarMarkdownFormatado(conteudoMarkdown)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function handleRevisar() {
    setRevisao({ fase: 'carregando' })
    try {
      const resposta = await fetch(`/api/propostas-comerciais/${propostaId}/revisao-portugues`, { method: 'POST' })
      const corpo = await resposta.json().catch(() => null)
      if (!resposta.ok) {
        setRevisao({ fase: 'erro', mensagem: corpo?.error ?? 'Não foi possível revisar o texto.' })
        return
      }
      setRevisao({ fase: 'pronta', original: corpo.original, corrigido: corpo.corrigido })
    } catch {
      setRevisao({ fase: 'erro', mensagem: 'Não foi possível revisar o texto.' })
    }
  }

  async function handleUsarCorrecoes() {
    if (revisao.fase !== 'pronta') return
    setAplicando(true)
    await onUsarCorrecoes(revisao.corrigido)
    setAplicando(false)
    setRevisao({ fase: 'inicial' })
    setAba('visualizar')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-border-grey bg-light-grey/60 p-0.5">
          <button
            type="button"
            onClick={() => setAba('visualizar')}
            className={cn(
              'rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
              aba === 'visualizar' ? 'bg-white text-navy shadow-xs' : 'text-mid-grey hover:text-navy'
            )}
          >
            Visualizar
          </button>
          <button
            type="button"
            onClick={() => setAba('correcao')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
              aba === 'correcao' ? 'bg-white text-navy shadow-xs' : 'text-mid-grey hover:text-navy'
            )}
          >
            <Sparkles className="size-3.5" strokeWidth={2.25} />
            Correção da IA
          </button>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onEditarNovamente} className={BTN_OUTLINE}>
            <Pencil className="size-3.5" strokeWidth={2.25} />
            Editar novamente
          </button>
          <button type="button" onClick={handleCopiarFormatado} className={BTN_PRIMARY}>
            {copiado ? (
              <>
                <ClipboardCheck className="size-3.5" strokeWidth={2.25} />
                Copiado!
              </>
            ) : (
              <>
                <ClipboardCopy className="size-3.5" strokeWidth={2.25} />
                Copiar formatado
              </>
            )}
          </button>
        </div>
      </div>

      {aba === 'visualizar' && (
        <div
          className="markdown-preview max-h-[70vh] overflow-auto rounded-lg border border-border-grey bg-white p-4"
          dangerouslySetInnerHTML={{ __html: renderizarMarkdownProposta(conteudoMarkdown) }}
        />
      )}

      {aba === 'correcao' && (
        <RevisaoPortugues
          estado={revisao}
          aplicando={aplicando}
          onRevisar={handleRevisar}
          onUsar={handleUsarCorrecoes}
          onVoltar={() => setRevisao({ fase: 'inicial' })}
        />
      )}
    </div>
  )
}

function RevisaoPortugues({
  estado,
  aplicando,
  onRevisar,
  onUsar,
  onVoltar,
}: {
  estado: EstadoRevisao
  aplicando: boolean
  onRevisar: () => void
  onUsar: () => void
  onVoltar: () => void
}) {
  if (estado.fase === 'inicial') {
    return (
      <div className="space-y-3 rounded-lg border border-border-grey bg-white p-4">
        <p className="text-sm text-mid-grey">
          A IA revisa apenas ortografia e acentuação do texto — não reescreve frases, não muda números nem a
          estrutura. Você confere o que mudou e decide se aplica.
        </p>
        <button type="button" onClick={onRevisar} className={BTN_PRIMARY}>
          <Sparkles className="size-3.5" strokeWidth={2.25} />
          Revisar português
        </button>
      </div>
    )
  }

  if (estado.fase === 'carregando') {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-border-grey bg-white p-4 text-sm text-mid-grey">
        <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        Revisando...
      </p>
    )
  }

  if (estado.fase === 'erro') {
    return (
      <div className="space-y-3 rounded-lg border border-red-crit/30 bg-red-crit-light p-4">
        <p className="flex items-start gap-2 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {estado.mensagem}
        </p>
        <button type="button" onClick={onVoltar} className={BTN_OUTLINE}>
          Voltar
        </button>
      </div>
    )
  }

  if (estado.original === estado.corrigido) {
    return (
      <div className="space-y-3 rounded-lg border border-border-grey bg-white p-4">
        <p className="text-sm text-navy">Nenhum erro de português encontrado.</p>
        <button type="button" onClick={onVoltar} className={BTN_OUTLINE}>
          Voltar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-mid-grey">
          <del className="rounded bg-red-crit-light px-0.5 text-red-crit">riscado</del> = removido{' · '}
          <ins className="rounded bg-green-ok-light px-0.5 text-green-ok no-underline">grifado</ins> = adicionado
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onVoltar} className={BTN_OUTLINE} disabled={aplicando}>
            Manter original
          </button>
          <button type="button" onClick={onUsar} className={BTN_PRIMARY} disabled={aplicando}>
            {aplicando ? 'Aplicando...' : 'Usar correções'}
          </button>
        </div>
      </div>
      <div
        className="markdown-preview max-h-[70vh] overflow-auto rounded-lg border border-border-grey bg-white p-4"
        dangerouslySetInnerHTML={{ __html: diffPropostaRenderizada(estado.original, estado.corrigido) }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Ligar as props novas no `page.tsx`**

Em `src/app/propostas-comerciais/[id]/page.tsx`, o bloco `mostrarFinal` hoje é:

```tsx
      {mostrarFinal && (
        <PropostaFinal conteudoMarkdown={proposta.conteudoMarkdown ?? ''} onEditarNovamente={() => setModoEdicao(true)} />
      )}
```

Trocar por:

```tsx
      {mostrarFinal && (
        <PropostaFinal
          propostaId={proposta.id}
          conteudoMarkdown={proposta.conteudoMarkdown ?? ''}
          onEditarNovamente={() => setModoEdicao(true)}
          onUsarCorrecoes={handleSalvar}
        />
      )}
```

`handleSalvar` já existe na página, tem a assinatura `(markdown: string) => Promise<void>`, faz o `PATCH` do `conteudoMarkdown` e recarrega — é exatamente o que "Usar correções" precisa. Nenhuma função nova.

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `npm test -- proposta-final`
Expected: PASS (11 testes).

- [ ] **Step 6: Checagem de tipos e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 7: Rodar a suíte inteira**

Run: `npm test`
Expected: tudo verde.

- [ ] **Step 8: Commit**

```bash
git add "src/app/propostas-comerciais/[id]/proposta-final.tsx" "src/app/propostas-comerciais/[id]/proposta-final.test.tsx" "src/app/propostas-comerciais/[id]/page.tsx"
git commit -m "feat: aba de revisao de portugues na tela de proposta final"
```

---

## Task 7: Verificação manual no app

**Files:** nenhum — validação de ponta a ponta.

- [ ] **Step 1: Subir o app**

Run: `npm run dev` (com `.env.development` e o `AI_PROVIDER` configurado — ver `src/lib/ia/modelo.ts`).

- [ ] **Step 2: Fluxo feliz**

Criar uma proposta a partir de um arquivo com um erro de português conhecido (ex.: "e" no lugar de "é", falta de acento). Concluir a proposta. Na tela final: abrir a aba **Correção da IA** → **Revisar português** → conferir que o diff destaca só a troca de palavra → **Usar correções** → voltar pra Visualizar já com o texto corrigido → **Copiar formatado** funciona.

- [ ] **Step 3: Guardrail**

Numa proposta com números/tabela, se possível forçar (via prompt de teste ou modelo) uma resposta que altere um número — confirmar que aparece a mensagem "não é seguro aplicar automaticamente" e o botão "Voltar", sem opção de aplicar.

- [ ] **Step 4: Sem mudanças**

Rodar a revisão num texto já correto → "Nenhum erro de português encontrado."

- [ ] **Step 5: Commit (se algum ajuste fino foi necessário)**

```bash
git add -A
git commit -m "fix: ajustes da revisao de portugues apos teste manual"
```

---

## Self-Review (feito na escrita do plano)

- **Cobertura do spec:**
  - endpoint stateless `POST .../revisao-portugues` → Task 3 ✅
  - módulo `revisarPortugues.ts` com `generateText` + prompt restrito + remoção de cercas → Task 1 ✅
  - guardrail (linhas, títulos, tabela, itens de lista, dígitos) com resposta 422 → Task 2 + Task 3 ✅
  - `PropostaFinal` com abas Visualizar | Correção da IA, botões Editar novamente / Copiar formatado preservados → Task 6 ✅
  - estados da aba: inicial / carregando / erro-rede / 422 / sem-mudanças / com-mudanças → Task 6 (testes cobrindo inicial, diff, 422, sem-mudanças; carregando e erro-rede implementados) ✅
  - `diffPropostaRenderizada` com walk paralelo de nós de texto + fallback → Task 4 ✅
  - `page.tsx` fornece `onUsarCorrecoes` reusando `handleSalvar` (PATCH + recarrega, status `concluido`) → Task 6 Step 4 ✅
  - dependência `diff` → Task 4 Step 1 ✅
  - estilos `ins`/`del` em `globals.css` → Task 5 ✅
  - sem migration, nada persistido → nenhuma task de schema ✅
  - fora de escopo (revisão automática, coluna nova, aceite item a item, editor rich-text) → não há tasks pra isso ✅
- **Placeholders:** nenhum "TBD"/"TODO". A única nota de ajuste condicional (regex do teste em Task 4 Step 5, `@types/diff` em Task 4 Step 1) tem instrução concreta do que fazer.
- **Consistência de tipos:** `revisarPortugues(markdown: string): Promise<string>` usado igual em Task 1 e Task 3. `validarRevisaoPortugues(original, corrigido): string | null` igual em Task 2 e Task 3. `diffPropostaRenderizada(original, corrigido): string` igual em Task 4 e Task 6. Props de `PropostaFinal` (`propostaId`, `conteudoMarkdown`, `onEditarNovamente`, `onUsarCorrecoes`) idênticas entre o componente (Task 6 Step 3), os testes (Task 6 Step 1) e o `page.tsx` (Task 6 Step 4).
