# HTML nativo — Fase 1: Extração determinística (PDF, Excel, Word, marcador OCR) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer todo o conversor determinístico da Proposta Comercial (PDF, Excel/CSV, Word) emitir
HTML em vez de Markdown, mantendo intactas todas as heurísticas de fidelidade (fonte, posição, traço
vetorial, grade de bordas de tabela) — só a sintaxe de saída muda.

**Architecture:** Cada formatador de string dentro de `pdfMarkdown.ts` (renomeado `pdfHtml.ts`),
`excel.ts` e a ponte de `.docx` (`extracao/index.ts`) troca a montagem de string Markdown por
montagem de string HTML equivalente. Nenhuma heurística de detecção (o que é negrito, título,
tabela, lista) muda — só a serialização final. Texto bruto extraído do PDF/planilha passa a ser
escapado (`&`/`<`/`>`) antes de entrar em qualquer tag, o que não era necessário no Markdown. Lista
com nível de indentação precisa de uma segunda passada (`agruparListasEmHtml`) que junta `<li>`
soltos em `<ul>`/`<ol>` aninhado — o `marked` fazia esse agrupamento de graça a partir de sintaxe
Markdown; em HTML nativo isso precisa ser feito no código.

**Tech Stack:** TypeScript, Jest, sem biblioteca nova.

## Global Constraints

- Nenhuma heurística de detecção (fonte, posição, traço vetorial) muda nesta fase — só a
  serialização final de string. Qualquer teste de heurística que já passa tem que continuar
  passando (só o valor esperado muda de sintaxe Markdown pra HTML).
- Texto extraído do PDF/planilha pode conter `&`, `<`, `>` — todo texto bruto (nunca as tags que o
  próprio código insere) tem que passar por `escaparHtml` antes de entrar no HTML final.
- `PropostaComercial.conteudoMarkdown` (coluna do Prisma) **não muda de nome nesta fase** — continua
  gravando ali, só que o conteúdo agora é HTML em vez de Markdown. O rename da coluna é assunto de
  uma fase posterior (migração de banco), fora deste plano.
- `marked` continua em `dependencies` até a fase de migração de dado — não remover ainda.

---

### Task 1: Renomear `pdfMarkdown.ts` → `pdfHtml.ts` (mecânico, sem mudança de comportamento)

**Files:**
- Rename: `src/lib/extracao/pdfMarkdown.ts` → `src/lib/extracao/pdfHtml.ts`
- Rename: `src/lib/extracao/pdfMarkdown.test.ts` → `src/lib/extracao/pdfHtml.test.ts`
- Modify: `src/lib/extracao/pdfTabelas.ts` (import de `./pdfMarkdown` → `./pdfHtml`)
- Modify: `src/lib/extracao/pdfTabelas.test.ts` (mesmo import, se existir)
- Modify: `src/app/api/propostas-comerciais/route.ts:6` (`converterPdfParaMarkdown` de `'@/lib/extracao/pdfMarkdown'` → `'@/lib/extracao/pdfHtml'`)
- Modify: `src/app/api/propostas-comerciais/route.test.ts` (mesmo import, se existir)
- Modify: `src/lib/extracao/pdfMarkdown.test.ts` referências dentro do próprio arquivo renomeado (`import { converterPdfParaMarkdown } from './pdfMarkdown'` → `from './pdfHtml'`)

Esta etapa é SÓ renomear arquivo/import — a função continua se chamando `converterPdfParaMarkdown`
e devolvendo Markdown (isso muda nas próximas tasks). Serve pra isolar o rename mecânico do rename
de comportamento, e pra confirmar que nada mais depende do caminho antigo antes de começar a mexer
na lógica.

- [ ] **Step 1: Renomear os dois arquivos com `git mv`**

```bash
git mv src/lib/extracao/pdfMarkdown.ts src/lib/extracao/pdfHtml.ts
git mv src/lib/extracao/pdfMarkdown.test.ts src/lib/extracao/pdfHtml.test.ts
```

- [ ] **Step 2: Atualizar os imports que apontam pro caminho antigo**

Rode a busca e corrija cada ocorrência de `'./pdfMarkdown'` / `'@/lib/extracao/pdfMarkdown'` pra
`'./pdfHtml'` / `'@/lib/extracao/pdfHtml'` (dentro do próprio `pdfHtml.ts`/`pdfHtml.test.ts`, em
`pdfTabelas.ts`, e em `route.ts`):

```bash
grep -rl "extracao/pdfMarkdown'\|from './pdfMarkdown'" src | xargs sed -i "s#extracao/pdfMarkdown'#extracao/pdfHtml'#g; s#from './pdfMarkdown'#from './pdfHtml'#g"
```

- [ ] **Step 3: Rodar a suíte inteira pra confirmar que o rename não quebrou nada**

Run: `npx jest src/lib/extracao src/app/api/propostas-comerciais -i`
Expected: PASS — mesmo comportamento de antes, só caminho de arquivo diferente.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: renomeia pdfMarkdown.ts para pdfHtml.ts

Renomeação mecânica, sem mudança de comportamento — prepara terreno
pra converter os formatadores de Markdown pra HTML nas próximas
tasks. Segue o design em
docs/superpowers/specs/2026-09-14-html-nativo-ocr-proposta-comercial-design.md."
```

---

### Task 2: `escaparHtml` compartilhado + `formatarTexto` emite HTML (negrito/itálico/sublinhado)

**Files:**
- Create: `src/lib/extracao/escaparHtml.ts`
- Create: `src/lib/extracao/escaparHtml.test.ts`
- Modify: `src/lib/extracao/pdfHtml.ts` (`formatarTexto`)
- Modify: `src/lib/extracao/pdfHtml.test.ts` (3 casos existentes de negrito/itálico/combinado)

**Interfaces:**
- Produces: `escaparHtml(texto: string): string` — escapa `&`, `<`, `>` (nesta ordem: `&` primeiro,
  senão escapar `<`/`>` geraria `&amp;lt;` a partir de um `&lt;` literal do PDF). Usado por toda
  task seguinte que gera HTML a partir de texto bruto (PDF, planilha).
- Produces: `formatarTexto(item: ItemLinha): string` — mesma assinatura de hoje, devolve HTML em vez
  de Markdown.

- [ ] **Step 1: Escrever o teste de `escaparHtml`**

```ts
// src/lib/extracao/escaparHtml.test.ts
import { escaparHtml } from './escaparHtml'

describe('escaparHtml', () => {
  it('escapa & antes de escapar < e >, pra não escapar em dobro um &lt; já literal do texto', () => {
    expect(escaparHtml('Fulano & Cia')).toBe('Fulano &amp; Cia')
    expect(escaparHtml('&lt;tag&gt;')).toBe('&amp;lt;tag&amp;gt;')
  })

  it('escapa < e > soltos', () => {
    expect(escaparHtml('Preço < 100 e > 50')).toBe('Preço &lt; 100 e &gt; 50')
  })

  it('texto sem caractere especial passa direto', () => {
    expect(escaparHtml('Texto normal, com vírgula.')).toBe('Texto normal, com vírgula.')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha (módulo não existe ainda)**

Run: `npx jest src/lib/extracao/escaparHtml.test.ts`
Expected: FAIL — `Cannot find module './escaparHtml'`

- [ ] **Step 3: Implementar `escaparHtml`**

```ts
// src/lib/extracao/escaparHtml.ts

/** Escapa `&`/`<`/`>` — todo texto BRUTO extraído do PDF/planilha passa por
 *  aqui antes de entrar em qualquer tag HTML montada pelo conversor. Nunca
 *  aplicar nas tags que o próprio código insere (senão a tag vira texto
 *  literal na tela). A ordem importa: `&` primeiro, senão um `&lt;` já
 *  literal do documento original viraria `&amp;lt;` em vez de continuar
 *  representando o caractere `<`. */
export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
```

- [ ] **Step 4: Rodar de novo e confirmar que passa**

Run: `npx jest src/lib/extracao/escaparHtml.test.ts`
Expected: PASS

- [ ] **Step 5: Atualizar os 3 testes existentes de `formatarTexto` em `pdfHtml.test.ts`**

Os três testes abaixo já existem no arquivo (renomeados na Task 1) com nomes em português — troque
o nome do `it` e o `expect` de cada um:

```ts
it('envolve trecho com fonte em negrito em <strong>...</strong>', async () => {
  ;(extractTextItems as jest.Mock).mockResolvedValue({
    totalPages: 1,
    items: [[item({ str: 'Texto em negrito', x: 0, fontFamily: 'Helvetica-Bold', hasEOL: true })]],
  })

  const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

  expect(resultado).toBe('<p><strong>Texto em negrito</strong></p>')
})

it('envolve trecho em itálico com <em>...</em>', async () => {
  ;(extractTextItems as jest.Mock).mockResolvedValue({
    totalPages: 1,
    items: [[item({ str: 'Termo em itálico', x: 0, fontFamily: 'Helvetica-Oblique', hasEOL: true })]],
  })

  const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

  expect(resultado).toBe('<p><em>Termo em itálico</em></p>')
})

it('combina negrito e itálico em <strong><em>...</em></strong> quando os dois batem no mesmo trecho', async () => {
  ;(extractTextItems as jest.Mock).mockResolvedValue({
    totalPages: 1,
    items: [[item({ str: 'Muito importante', x: 0, fontFamily: 'Helvetica-BoldOblique', hasEOL: true })]],
  })

  const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

  expect(resultado).toBe('<p><strong><em>Muito importante</em></strong></p>')
})
```

Note que o resultado esperado agora vem envolto em `<p>...</p>` — isso só existirá de verdade depois
da Task 5 (`formatarBlocoDeTexto` passa a envolver todo parágrafo comum em `<p>`). Deixe esses três
testes como estão nesta task (vão falhar até a Task 5 — é esperado, ver Step 6) e não pule a Task 5.

Troque também o nome do import: `converterPdfParaMarkdown` → `converterPdfParaHtml` em todo o
arquivo de teste (`import { converterPdfParaHtml } from './pdfHtml'`), e todo `const { markdown:
resultado }` → `const { html: resultado }` — vale pra este arquivo inteiro, não só os 3 casos acima
(as próximas tasks vão mexer nos outros testes um por vez).

- [ ] **Step 6: Implementar — renomear a função e trocar `formatarTexto`**

Em `pdfHtml.ts`:

```ts
import { escaparHtml } from './escaparHtml'

// ... (renomeia a função pública, mantém toda a lógica de heurística igual)
export async function converterPdfParaHtml(
  buffer: Buffer,
  opcoes: OpcoesConversaoPdf = {}
): Promise<ResultadoConversaoPdf> {
  // corpo idêntico ao de `converterPdfParaMarkdown` por enquanto — só o nome
  // muda nesta task; o campo `markdown` do retorno vira `html` na Task 5,
  // quando `montarMarkdown`/`montarHtml` também for renomeado.
  ...
}

/** Aplica negrito/itálico/sublinhado a um trecho de texto — fonte única
 *  desse formato, reaproveitada tanto pra parágrafo comum quanto pra célula
 *  de tabela (posição ou borda). Devolve HTML; `item.texto` é escapado
 *  ANTES de entrar em qualquer tag. */
export function formatarTexto(item: ItemLinha): string {
  let texto = escaparHtml(item.texto)
  if (item.negrito && item.italico) texto = `<strong><em>${texto}</em></strong>`
  else if (item.negrito) texto = `<strong>${texto}</strong>`
  else if (item.italico) texto = `<em>${texto}</em>`
  if (item.sublinhado) texto = `<u>${texto}</u>`
  return texto
}
```

Por ora deixe `ResultadoConversaoPdf.markdown` e `PaginaConvertida.markdown` com o nome antigo —
essa troca de nome de campo é o Step da Task 5 (é lá que faz sentido, junto da última peça que falta
pra fechar o formato final).

- [ ] **Step 7: Rodar os 3 testes — esperado FALHAR ainda (faltam as próximas tasks)**

Run: `npx jest src/lib/extracao/pdfHtml.test.ts -t "negrito|itálico|combina"`
Expected: FAIL nos 3 (envolvidos em `<p>` que ainda não existe) — comportamento esperado nesta
altura do plano; confirme que a MENSAGEM de erro mostra o HTML sem o `<p>` (`<strong>Texto em
negrito</strong>` em vez de `**Texto em negrito**`), que é o sinal de que `formatarTexto` já está
certo — só falta o wrapper de parágrafo da Task 5.

- [ ] **Step 8: Commit**

```bash
git add src/lib/extracao/escaparHtml.ts src/lib/extracao/escaparHtml.test.ts src/lib/extracao/pdfHtml.ts src/lib/extracao/pdfHtml.test.ts
git commit -m "feat: formatarTexto emite HTML (negrito/itálico/sublinhado)

escaparHtml novo, compartilhado por todo o conversor determinístico.
3 testes de negrito/itálico/combinado ainda falham nesta task —
faltam o wrapper de <p> (Task 5). Parte da migração pra HTML nativo,
ver docs/superpowers/specs/2026-09-14-html-nativo-ocr-proposta-comercial-design.md."
```

---

### Task 3: Tabela — `montarTabelaMarkdown` → `montarTabelaHtml`

**Files:**
- Modify: `src/lib/extracao/pdfHtml.ts` (`montarTabelaMarkdown` → `montarTabelaHtml`)
- Modify: `src/lib/extracao/pdfTabelas.ts` (chamada de `montarTabelaMarkdown`)
- Modify: `src/lib/extracao/pdfHtml.test.ts` (casos de tabela — por bordas e por posição)
- Modify: `src/lib/extracao/pdfTabelas.test.ts` (se existir, casos de `detectarTabelaPorBordas`)

**Interfaces:**
- Consumes: `formatarTexto` (Task 2) — as células já chegam como HTML inline pronto, não precisa
  escapar de novo aqui.
- Produces: `montarTabelaHtml(linhas: string[][]): string` — mesma assinatura de
  `montarTabelaMarkdown`, devolve `<table>...</table>`.

- [ ] **Step 1: Escrever o teste da função pura, isolado**

Adicione a `pdfHtml.test.ts` (exportar `montarTabelaHtml` de `pdfHtml.ts`, junto de `formatarTexto`,
que já é exportado hoje):

```ts
import { montarTabelaHtml } from './pdfHtml'

describe('montarTabelaHtml', () => {
  it('monta cabeçalho em <th> e corpo em <td>, dentro de <thead>/<tbody>', () => {
    const html = montarTabelaHtml([
      ['Item', 'Valor'],
      ['Consultoria', 'R$ 1.000'],
      ['Suporte', 'R$ 500'],
    ])

    expect(html).toBe(
      '<table><thead><tr><th>Item</th><th>Valor</th></tr></thead>' +
        '<tbody><tr><td>Consultoria</td><td>R$ 1.000</td></tr>' +
        '<tr><td>Suporte</td><td>R$ 500</td></tr></tbody></table>'
    )
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/lib/extracao/pdfHtml.test.ts -t "montarTabelaHtml"`
Expected: FAIL — `montarTabelaHtml is not a function` (ainda se chama `montarTabelaMarkdown`)

- [ ] **Step 3: Implementar**

```ts
export function montarTabelaHtml(linhas: string[][]): string {
  const [cabecalho, ...resto] = linhas
  const linhaCabecalho = `<tr>${cabecalho.map((c) => `<th>${c}</th>`).join('')}</tr>`
  const linhasCorpo = resto.map((linha) => `<tr>${linha.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')
  return `<table><thead>${linhaCabecalho}</thead><tbody>${linhasCorpo}</tbody></table>`
}
```

Remova `montarTabelaMarkdown`. Em `pdfTabelas.ts`, troque o import (`formatarTexto,
montarTabelaMarkdown` → `formatarTexto, montarTabelaHtml`) e a chamada em
`detectarTabelaPorBordas` (`montarTabelaMarkdown(celulas)` → `montarTabelaHtml(celulas)`), mantendo
o nome do campo de retorno como `markdown` por enquanto (troca pra `html` na Task 5, junto do resto
da assinatura pública).

- [ ] **Step 4: Rodar de novo — passa**

Run: `npx jest src/lib/extracao/pdfHtml.test.ts -t "montarTabelaHtml"`
Expected: PASS

- [ ] **Step 5: Atualizar os testes end-to-end de tabela existentes**

Em `pdfHtml.test.ts`, localize os `describe`/`it` de tabela (por bordas vetoriais e por posição/
corredor — buscar por `montarTabelaMarkdown` ou por `expect(resultado).toContain('|')` /
`expect(resultado).toBe(` com `\|` no meio). Pra cada um, troque a asserção Markdown
(`'| Item | Valor |\n| --- | --- |\n| ...'`) pelo HTML equivalente que `montarTabelaHtml` produz
(mesmo padrão do Step 1 acima) — mantendo o MESMO input mockado (`extractTextItems`,
`extrairSegmentosRetosPorPagina`), já que a heurística de detecção não muda. Se um caso testa
`detectarTabelaPorBordas`/`pdfTabelas.test.ts` diretamente, mesma troca lá.

- [ ] **Step 6: Rodar a suíte de extração inteira**

Run: `npx jest src/lib/extracao -i`
Expected: os casos de tabela PASSAM; os 3 casos de negrito/itálico/combinado da Task 2 continuam
FALHANDO (esperado — resolve na Task 5).

- [ ] **Step 7: Commit**

```bash
git add src/lib/extracao/pdfHtml.ts src/lib/extracao/pdfHtml.test.ts src/lib/extracao/pdfTabelas.ts src/lib/extracao/pdfTabelas.test.ts
git commit -m "feat: tabela do conversor de PDF emite <table> HTML

montarTabelaMarkdown vira montarTabelaHtml — heurística de detecção
(borda vetorial e fallback por posição/corredor) inalterada, só a
serialização final muda."
```

---

### Task 4: Título — `formatarTitulo` emite `<h1>`/`<h2>`

**Files:**
- Modify: `src/lib/extracao/pdfHtml.ts` (`formatarTitulo`)
- Modify: `src/lib/extracao/pdfHtml.test.ts` (casos de título)

**Interfaces:**
- Consumes: `extrairTextoLinha` (já existente, chama `formatarTexto` por item — nenhuma mudança
  nesta task, já emite HTML desde a Task 2).
- Produces: `formatarTitulo(linha: Linha, tamanhoCorpo: number, margens: Margens): string` — mesma
  assinatura, devolve `<h1>`/`<h2>`, com `style="text-align:center"` quando centralizado.

- [ ] **Step 1: Localizar e atualizar os testes de título existentes**

Busque em `pdfHtml.test.ts` os `it` com "título" no nome (ex.: "detecta título por tamanho de fonte
maior que o corpo do texto", visto no Step 76 do arquivo original, e os de título centralizado).
Troque a asserção de `'# Texto do Título'` / `'## Texto'` pra `'<h1>Texto do Título</h1>'` /
`'<h2>Texto</h2>'`, e de `'<h1 align="center">Texto</h1>'` pra `'<h1 style="text-align:center">Texto</h1>'`.
Exemplo concreto (adapte ao texto/fixture real do teste que você encontrar):

```ts
it('detecta título por tamanho de fonte maior que o corpo do texto', async () => {
  // ... mock de extractTextItems inalterado ...
  const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))
  expect(resultado).toBe('<h1>Texto Do Título</h1>') // era '# Texto Do Título'
})
```

- [ ] **Step 2: Rodar e confirmar que falha (função ainda emite Markdown)**

Run: `npx jest src/lib/extracao/pdfHtml.test.ts -t "título"`
Expected: FAIL

- [ ] **Step 3: Implementar**

```ts
function formatarTitulo(linha: Linha, tamanhoCorpo: number, margens: Margens): string {
  const texto = extrairTextoLinha(linha)
  const nivel = linha.fontSizeMedio >= tamanhoCorpo * 1.5 ? 1 : 2
  const estilo = ehCentralizado(linha, margens) ? ' style="text-align:center"' : ''
  return `<h${nivel}${estilo}>${texto}</h${nivel}>`
}
```

- [ ] **Step 4: Rodar de novo — passa**

Run: `npx jest src/lib/extracao/pdfHtml.test.ts -t "título"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/extracao/pdfHtml.ts src/lib/extracao/pdfHtml.test.ts
git commit -m "feat: título do conversor de PDF emite <h1>/<h2> HTML"
```

---

### Task 5: Parágrafo (alinhado/comum), lista com nível e cláusula numerada

Esta é a task mais delicada da fase: no Markdown, `marked` juntava linhas `- item` consecutivas
num `<ul>` sozinho, a partir só da sintaxe. Em HTML nativo não existe mais esse passo de renderização
— o próprio conversor tem que produzir a lista já aninhada. A solução: cada bloco de lista sai
marcado com um atributo temporário de nível (`<li data-nivel="N">`), e uma passada final
(`agruparListasEmHtml`) junta blocos consecutivos numa árvore de `<ul>` aninhado, removendo o
atributo.

**Files:**
- Modify: `src/lib/extracao/pdfHtml.ts` (`formatarBlocoDeTexto`, `montarMarkdown` → `montarHtml`,
  nova função `agruparListasEmHtml`)
- Modify: `src/lib/extracao/pdfHtml.test.ts` (parágrafo comum, centralizado, justificado, lista
  simples, lista aninhada, cláusula numerada, e os 3 casos de negrito/itálico da Task 2 — que agora
  finalmente devem passar)

**Interfaces:**
- Produces: `agruparListasEmHtml(blocos: string[]): string[]` — nova função pura, exportada só pra
  teste direto.
- Produces: `converterPdfParaHtml(...): Promise<ResultadoConversaoPdf>` — `ResultadoConversaoPdf`
  troca o campo `markdown: string` por `html: string`, e `PaginaConvertida.markdown` por
  `PaginaConvertida.html`. Toda task/arquivo depois desta que consumia `.markdown` do retorno passa
  a consumir `.html` (ver Task de wiring em `route.ts` no fim deste plano).

- [ ] **Step 1: Escrever o teste de `agruparListasEmHtml` isolado**

```ts
import { agruparListasEmHtml } from './pdfHtml'

describe('agruparListasEmHtml', () => {
  it('junta blocos <li> consecutivos do MESMO nível num <ul> só', () => {
    const resultado = agruparListasEmHtml([
      '<p>Antes</p>',
      '<li data-nivel="0">Um</li>',
      '<li data-nivel="0">Dois</li>',
      '<p>Depois</p>',
    ])
    expect(resultado).toEqual(['<p>Antes</p>', '<ul><li>Um</li><li>Dois</li></ul>', '<p>Depois</p>'])
  })

  it('aninha <ul> quando o nível aumenta e fecha quando volta a diminuir', () => {
    const resultado = agruparListasEmHtml([
      '<li data-nivel="0">Item 1</li>',
      '<li data-nivel="1">Sub 1.1</li>',
      '<li data-nivel="1">Sub 1.2</li>',
      '<li data-nivel="0">Item 2</li>',
    ])
    expect(resultado.join('')).toBe(
      '<ul><li>Item 1</li><ul><li>Sub 1.1</li><li>Sub 1.2</li></ul><li>Item 2</li></ul>'
    )
  })

  it('bloco sem <li> nenhum passa direto, sem <ul> nenhum', () => {
    expect(agruparListasEmHtml(['<p>Só texto</p>'])).toEqual(['<p>Só texto</p>'])
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/lib/extracao/pdfHtml.test.ts -t "agruparListasEmHtml"`
Expected: FAIL — `agruparListasEmHtml is not a function`

- [ ] **Step 3: Implementar `agruparListasEmHtml` e o novo `formatarBlocoDeTexto`**

```ts
const REGEX_LI_COM_NIVEL = /^<li data-nivel="(\d+)">([\s\S]*)<\/li>$/

/** Depois que `montarHtml` monta todos os blocos da página, uma rodada de
 *  `<li data-nivel="N">` consecutivos precisa virar UMA lista aninhada —
 *  sem isso cada item fica solto (HTML inválido, sem marcador nenhum ao
 *  colar no SEI). Constrói a árvore com uma pilha de nível: abre `<ul>`
 *  novo quando o nível sobe, fecha quando desce, mantém aberto quando o
 *  nível se repete. */
export function agruparListasEmHtml(blocos: string[]): string[] {
  const resultado: string[] = []
  const pilha: number[] = []

  function fecharAte(nivel: number) {
    while (pilha.length > 0 && pilha[pilha.length - 1] >= nivel) {
      resultado.push('</ul>')
      pilha.pop()
    }
  }

  for (const bloco of blocos) {
    const item = bloco.match(REGEX_LI_COM_NIVEL)
    if (!item) {
      fecharAte(0)
      resultado.push(bloco)
      continue
    }
    const nivel = Number(item[1])
    if (pilha.length === 0 || nivel > pilha[pilha.length - 1]) {
      resultado.push('<ul>')
      pilha.push(nivel)
    } else if (nivel < pilha[pilha.length - 1]) {
      fecharAte(nivel + 1)
      if (pilha.length === 0 || pilha[pilha.length - 1] !== nivel) {
        resultado.push('<ul>')
        pilha.push(nivel)
      }
    }
    resultado.push(`<li>${item[2]}</li>`)
  }
  fecharAte(0)
  return resultado
}

/** Formata um bloco (parágrafo, item de lista ou cláusula numerada) já
 *  reunido por `absorverBloco`. `textos`/`textoCompleto` já chegam como HTML
 *  inline pronto (negrito/itálico/sublinhado via `formatarTexto`) — nunca
 *  escapar de novo aqui, só envolver na tag de bloco certa. */
function formatarBlocoDeTexto(
  textos: string[],
  linhasDoBloco: Linha[],
  margens: Margens,
  ancorasDeMarcador: number[]
): string {
  const textoCompleto = textos.join(' ')

  // Cláusula numerada (1., 2., 4., 5. — número real do PDF, não sequencial)
  // vira parágrafo com o número LITERAL: um <ol> de verdade é renumerado
  // pelo navegador a partir de 1, o que apagaria o número original da
  // cláusula. Diferente do Markdown, HTML não precisa escapar "1." — o
  // texto literal nunca é reinterpretado como marcação.
  const numerada = textoCompleto.match(REGEX_LISTA_NUMERADA)
  if (numerada) return `<p>${numerada[1]}${numerada[2]} ${numerada[3]}</p>`

  const marcada = textoCompleto.match(REGEX_LISTA_MARCADOR)
  if (marcada) {
    const x = linhasDoBloco[0]?.itens[0]?.x ?? 0
    const nivel = nivelDoMarcador(x, ancorasDeMarcador)
    // Marcador temporário — `agruparListasEmHtml`, rodada final sobre todos
    // os blocos da página, junta rodadas consecutivas destes <li> em <ul>
    // aninhado por nível e remove o atributo.
    return `<li data-nivel="${nivel}">${marcada[1]}</li>`
  }

  if (linhasDoBloco.length === 1 && ehCentralizado(linhasDoBloco[0], margens)) {
    return `<p style="text-align:center">${textoCompleto}</p>`
  }
  if (linhasDoBloco.length >= 2 && ehJustificado(linhasDoBloco, margens)) {
    return `<p style="text-align:justify">${textoCompleto}</p>`
  }

  return `<p>${textoCompleto}</p>`
}
```

- [ ] **Step 4: Renomear `montarMarkdown` → `montarHtml`, aplicar `agruparListasEmHtml` antes do
  join, e trocar os nomes de campo do retorno público**

```ts
function montarHtml(
  linhas: Linha[],
  tamanhoCorpo: number,
  margens: Margens,
  gradesPorPagina: Map<number, GradeDeTabela>,
  imagens: ImagemPosicionada[] = [],
  paginasOcr: number[] = []
): { html: string; blocosPorPagina: Map<number, string[]> } {
  // ... corpo idêntico ao de `montarMarkdown` até o `return` final ...
  const blocosFiltrados = blocos.filter((bloco) => bloco.length > 0)
  return { html: agruparListasEmHtml(blocosFiltrados).join('\n'), blocosPorPagina }
}
```

No corpo de `converterPdfParaHtml`, troque toda referência a `.markdown` do resultado de
`montarHtml`/`montarMarkdown` por `.html`, e no `export interface ResultadoConversaoPdf`/
`PaginaConvertida`, renomeie o campo `markdown: string` → `html: string` nos dois. Ajuste também o
`return` do caminho "PDF só de imagem" (`todasAsLinhas.length === 0`) pra usar a mesma chave
`html:`.

- [ ] **Step 5: Atualizar os testes de parágrafo/lista/cláusula numerada existentes, e os 3 de
  negrito/itálico da Task 2**

Os 3 testes de negrito/itálico/combinado (Task 2) devem passar sem mudança nenhuma agora — o `<p>`
que faltava já é produzido por `formatarBlocoDeTexto`. Rode-os primeiro pra confirmar.

Para os testes de parágrafo centralizado/justificado, lista com marcador e cláusula numerada:
localize cada `it` correspondente em `pdfHtml.test.ts` (buscar por `align="center"`, `align="justify"`,
`- `, `\\.`) e troque a asserção:

```ts
// centralizado: '<p align="center">Texto</p>' → '<p style="text-align:center">Texto</p>'
// justificado:  '<p align="justify">Texto</p>' → '<p style="text-align:justify">Texto</p>'
// lista simples: '- Item um\n\n- Item dois' → '<ul><li>Item um</li><li>Item dois</li></ul>'
// cláusula numerada: '1\\. Texto' → '<p>1. Texto</p>'
```

Se houver um teste de lista com dois níveis de indentação (marcador recuado), troque pra:
`'<ul><li>Item</li><ul><li>Sub-item</li></ul></ul>'`, seguindo o mesmo padrão do Step 1.

- [ ] **Step 6: Rodar a suíte inteira de extração**

Run: `npx jest src/lib/extracao -i`
Expected: PASS em tudo — este é o primeiro ponto do plano em que `pdfHtml.test.ts` inteiro passa de
novo.

- [ ] **Step 7: Commit**

```bash
git add src/lib/extracao/pdfHtml.ts src/lib/extracao/pdfHtml.test.ts
git commit -m "feat: parágrafo/lista/cláusula numerada do conversor de PDF em HTML

agruparListasEmHtml novo — junta <li data-nivel> consecutivos numa
árvore de <ul> aninhado, papel que o marked fazia de graça a partir
da sintaxe Markdown. ResultadoConversaoPdf.markdown e
PaginaConvertida.markdown renomeados pra .html — primeiro ponto do
plano em que a suíte de extração passa inteira de novo."
```

---

### Task 6: Imagem embutida — `![Imagem da página N](url)` → `<img>`

**Files:**
- Modify: `src/lib/extracao/pdfHtml.ts` (`prepararImagens`, `ImagemPosicionada`)
- Modify: `src/lib/extracao/pdfHtml.test.ts` (caso de imagem de conteúdo)

**Interfaces:**
- Consumes: `extrairImagensDeConteudo` (inalterado — `pdfImagens.ts` não muda nesta fase, só
  devolve `ImagemDeConteudo[]` com posição/PNG, igual hoje).
- Produces: `ImagemPosicionada.html: string` (era `.markdown`).

- [ ] **Step 1: Localizar e atualizar o teste de imagem existente**

Busque em `pdfHtml.test.ts` por `![Imagem da página` e troque a asserção:

```ts
// era: expect(resultado).toContain('![Imagem da página 2](https://exemplo/img.png)')
expect(resultado).toContain('<img alt="Imagem da página 2" src="https://exemplo/img.png">')
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/lib/extracao/pdfHtml.test.ts -t "imagem"`
Expected: FAIL

- [ ] **Step 3: Implementar**

```ts
interface ImagemPosicionada {
  pagina: number
  topo: number
  html: string
}

async function prepararImagens(
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
  totalPaginas: number,
  salvarImagem: OpcoesConversaoPdf['salvarImagem']
): Promise<ImagemPosicionada[]> {
  if (!salvarImagem) return []

  const posicionadas: ImagemPosicionada[] = []
  for (const imagem of await extrairImagensDeConteudo(pdf, totalPaginas)) {
    const url = await salvarImagem(imagem)
    if (!url) continue
    posicionadas.push({
      pagina: imagem.pagina,
      topo: imagem.topo,
      html: `<img alt="Imagem da página ${imagem.pagina + 1}" src="${escaparHtml(url)}">`,
    })
  }
  return posicionadas
}
```

Ajuste as duas outras referências a `imagem.markdown` (a lista `restante` no caminho "PDF só de
imagem" e `registrar(imagem.pagina, imagem.markdown)` em `montarHtml`) pra `imagem.html`.

- [ ] **Step 4: Rodar de novo — passa**

Run: `npx jest src/lib/extracao/pdfHtml.test.ts -t "imagem"`
Expected: PASS

- [ ] **Step 5: Rodar a suíte inteira de extração de novo (checagem de regressão final desta
  task)**

Run: `npx jest src/lib/extracao -i`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/extracao/pdfHtml.ts src/lib/extracao/pdfHtml.test.ts
git commit -m "feat: imagem embutida do PDF emite <img> HTML em vez de ![]()"
```

---

### Task 7: Marcador de OCR pendente — `:::ocr-pendente[...]:::` → `<div class="ocr-pendente">`

**Files:**
- Modify: `src/lib/ocr/marcadorOcrPendente.ts`
- Modify: `src/lib/ocr/marcadorOcrPendente.test.ts`
- Modify: `src/lib/extracao/pdfHtml.ts` (chamada de `formatarBlocoOcrPendente` — sem mudança de
  assinatura, só confirma que continua batendo)

**Interfaces:**
- Produces (mesma assinatura pública de hoje, corpo muda):
  `formatarBlocoOcrPendente(pagina: number, arquivoId?: string | null, corpo?: string): string`
  `listarBlocosOcrPendente(html: string): BlocoOcrPendente[]`
  `reescreverComArquivoId(html: string, arquivoId: string): string`
  `substituirCorpo(html: string, bloco: BlocoOcrPendente, novoCorpo: string): string`
  `removerWrapper(html: string, bloco: BlocoOcrPendente, htmlFinal: string): string`
  `temBlocoOcrPendente(html: string): boolean`

- [ ] **Step 1: Reescrever `marcadorOcrPendente.test.ts` pro novo formato**

Leia o arquivo de teste atual (`src/lib/ocr/marcadorOcrPendente.test.ts`) pra ver a lista completa de
casos (parsing com/sem `arquivoId`, `substituirCorpo`, `removerWrapper`, `reescreverComArquivoId`,
`temBlocoOcrPendente`) e reescreva CADA `it`, trocando só os literais de entrada/saída do formato
antigo pro novo — a lógica de cada caso (o que está sendo testado) não muda. Exemplo de referência
pros literais:

```ts
describe('formatarBlocoOcrPendente', () => {
  it('monta o marcador com pagina, sem arquivoId', () => {
    expect(formatarBlocoOcrPendente(3)).toBe('<div class="ocr-pendente" data-pagina="3"><p><em>(aguardando OCR)</em></p></div>')
  })

  it('monta o marcador com arquivoId e corpo customizado', () => {
    expect(formatarBlocoOcrPendente(3, 'cuid123', '<p>texto reconhecido</p>')).toBe(
      '<div class="ocr-pendente" data-arquivo-id="cuid123" data-pagina="3"><p>texto reconhecido</p></div>'
    )
  })
})

describe('listarBlocosOcrPendente', () => {
  it('lista todos os blocos do html, com arquivoId e pagina extraídos', () => {
    const html =
      '<p>Antes</p>' +
      '<div class="ocr-pendente" data-arquivo-id="a1" data-pagina="2"><p>x</p></div>' +
      '<p>Depois</p>'
    expect(listarBlocosOcrPendente(html)).toEqual([
      {
        blocoCompleto: '<div class="ocr-pendente" data-arquivo-id="a1" data-pagina="2"><p>x</p></div>',
        arquivoId: 'a1',
        pagina: 2,
        corpo: '<p>x</p>',
      },
    ])
  })
})

describe('reescreverComArquivoId', () => {
  it('injeta data-arquivo-id nos marcadores sem ele', () => {
    const html = '<div class="ocr-pendente" data-pagina="1"><p>x</p></div>'
    expect(reescreverComArquivoId(html, 'a1')).toBe(
      '<div class="ocr-pendente" data-arquivo-id="a1" data-pagina="1"><p>x</p></div>'
    )
  })
})

describe('temBlocoOcrPendente', () => {
  it('true quando o html tem pelo menos um marcador', () => {
    expect(temBlocoOcrPendente('<div class="ocr-pendente" data-pagina="1"></div>')).toBe(true)
  })
  it('false quando não tem nenhum', () => {
    expect(temBlocoOcrPendente('<p>texto normal</p>')).toBe(false)
  })
})
```

Reaproveite os casos de `substituirCorpo`/`removerWrapper` do arquivo original, só trocando os
literais de entrada pro formato `<div class="ocr-pendente" ...>`.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/lib/ocr/marcadorOcrPendente.test.ts`
Expected: FAIL — a implementação ainda produz `:::ocr-pendente[...]`

- [ ] **Step 3: Implementar**

```ts
export interface BlocoOcrPendente {
  blocoCompleto: string
  arquivoId: string | null
  pagina: number
  corpo: string
}

const REGEX_BLOCO = /<div class="ocr-pendente"([^>]*)>([\s\S]*?)<\/div>/g

function montarAtributos(pagina: number, arquivoId?: string | null): string {
  const arquivo = arquivoId ? ` data-arquivo-id="${arquivoId}"` : ''
  return `${arquivo} data-pagina="${pagina}"`
}

export function formatarBlocoOcrPendente(
  pagina: number,
  arquivoId?: string | null,
  corpo = '<p><em>(aguardando OCR)</em></p>'
): string {
  return `<div class="ocr-pendente"${montarAtributos(pagina, arquivoId)}>${corpo}</div>`
}

export function listarBlocosOcrPendente(html: string): BlocoOcrPendente[] {
  const blocos: BlocoOcrPendente[] = []
  for (const m of html.matchAll(REGEX_BLOCO)) {
    const atributos = m[1]
    const arquivoId = /data-arquivo-id="([^"]*)"/.exec(atributos)?.[1] ?? null
    const pagina = Number(/data-pagina="(\d+)"/.exec(atributos)?.[1] ?? '0')
    blocos.push({ blocoCompleto: m[0], arquivoId, pagina, corpo: m[2] })
  }
  return blocos
}

/** Usado pelo `POST /api/propostas-comerciais` — o conversor só sabe o
 *  número da página, não o `arquivoId` (ainda não existe no banco nesse
 *  ponto). */
export function reescreverComArquivoId(html: string, arquivoId: string): string {
  return html.replace(
    /<div class="ocr-pendente" data-pagina="(\d+)">/g,
    `<div class="ocr-pendente" data-arquivo-id="${arquivoId}" data-pagina="$1">`
  )
}

export function substituirCorpo(html: string, bloco: BlocoOcrPendente, novoCorpo: string): string {
  return html.replace(bloco.blocoCompleto, formatarBlocoOcrPendente(bloco.pagina, bloco.arquivoId, novoCorpo))
}

export function removerWrapper(html: string, bloco: BlocoOcrPendente, htmlFinal: string): string {
  return html.replace(bloco.blocoCompleto, htmlFinal)
}

export function temBlocoOcrPendente(html: string): boolean {
  return /<div class="ocr-pendente"/.test(html)
}
```

- [ ] **Step 4: Rodar de novo — passa**

Run: `npx jest src/lib/ocr/marcadorOcrPendente.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ocr/marcadorOcrPendente.ts src/lib/ocr/marcadorOcrPendente.test.ts
git commit -m "feat: marcador de OCR pendente vira <div class=\"ocr-pendente\">

Formato antigo (:::ocr-pendente[arquivoId=... pagina=...]:::) era
pseudo-sintaxe Markdown; agora é um elemento HTML real, localizável
por regex sobre a tag em vez de fence customizado. Assinatura pública
do módulo inalterada."
```

---

### Task 8: `.docx` — sanitiza o HTML do `mammoth` em vez de rebaixar pra Markdown

**Files:**
- Create: `src/lib/extracao/sanitizarHtmlMammoth.ts`
- Create: `src/lib/extracao/sanitizarHtmlMammoth.test.ts`
- Modify: `src/lib/extracao/index.ts`
- Delete: `src/lib/extracao/htmlMarkdown.ts`
- Delete: `src/lib/extracao/htmlMarkdown.test.ts`

**Interfaces:**
- Produces: `sanitizarHtmlMammoth(html: string): string`

- [ ] **Step 1: Escrever o teste**

```ts
// src/lib/extracao/sanitizarHtmlMammoth.test.ts
import { sanitizarHtmlMammoth } from './sanitizarHtmlMammoth'

describe('sanitizarHtmlMammoth', () => {
  it('remove atributos id/class/style que o mammoth pode anexar', () => {
    const html = '<h1 id="titulo-1" class="Titulo1">Objeto do contrato</h1>'
    expect(sanitizarHtmlMammoth(html)).toBe('<h1>Objeto do contrato</h1>')
  })

  it('preserva a tag e o conteúdo quando não tem atributo nenhum', () => {
    const html = '<p><strong>Negrito</strong> e <em>itálico</em>.</p>'
    expect(sanitizarHtmlMammoth(html)).toBe(html)
  })

  it('preserva tabela do mammoth sem alteração de estrutura', () => {
    const html = '<table><tr><td>A</td><td>B</td></tr></table>'
    expect(sanitizarHtmlMammoth(html)).toBe(html)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/lib/extracao/sanitizarHtmlMammoth.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar**

```ts
// src/lib/extracao/sanitizarHtmlMammoth.ts

const ATRIBUTOS_REMOVIDOS = /\s(?:id|class|style)="[^"]*"/g

/**
 * Sanitiza o HTML que o `mammoth` gera a partir de um `.docx` — remove só
 * atributos que o `mammoth` pode anexar (`id` de âncora de sumário,
 * `class` de estilo do Word) e que não servem pro documento final. Não
 * reescreve tag nenhuma: o subconjunto que o `mammoth` produz (h1-h6, p,
 * strong/em, u, a, ul/ol/li, table, br) já É o formato de saída do
 * conversor — não existe mais "conversão pra outra sintaxe" aqui, só
 * limpeza de atributo.
 */
export function sanitizarHtmlMammoth(html: string): string {
  return html.replace(ATRIBUTOS_REMOVIDOS, '')
}
```

- [ ] **Step 4: Rodar de novo — passa**

Run: `npx jest src/lib/extracao/sanitizarHtmlMammoth.test.ts`
Expected: PASS

- [ ] **Step 5: Trocar o uso em `extracao/index.ts` e apagar `htmlMarkdown.ts`**

```ts
// src/lib/extracao/index.ts
import { extrairExcel, lerPlanilhaPreview, converterPlanilhaParaMarkdown, type PreviewPlanilha } from './excel'
import { extrairPdf } from './pdf'
import { extrairDocx, converterDocxParaHtml } from './docx'
import { sanitizarHtmlMammoth } from './sanitizarHtmlMammoth'

export { lerPlanilhaPreview, type PreviewPlanilha, converterDocxParaHtml }

export async function extrairConteudo(buffer: Buffer, tipo: string): Promise<string> {
  // ... inalterado ...
}

/** Converte um arquivo original em HTML de forma 100% determinística — sem
 *  IA, sem interpretar nem resumir nada, só reformata o conteúdo tal como
 *  está no arquivo original. Usado na Proposta Comercial, onde a fidelidade
 *  ao original é obrigatória. */
export async function converterParaHtmlDeterministico(buffer: Buffer, tipo: string): Promise<string> {
  switch (tipo) {
    case 'xlsx':
    case 'csv':
      return converterPlanilhaParaMarkdown(buffer, tipo) // troca pra converterPlanilhaParaHtml na Task 9
    case 'docx':
      return sanitizarHtmlMammoth(await converterDocxParaHtml(buffer))
    default:
      throw new Error(`Tipo de arquivo "${tipo}" não suportado para conversão determinística`)
  }
}
```

(Deixe `converterPlanilhaParaMarkdown` como está por enquanto — vira `converterPlanilhaParaHtml` na
Task 9, logo em seguida; não precisa ficar sem compilar entre uma task e outra porque o nome do
export não muda até lá.)

```bash
git rm src/lib/extracao/htmlMarkdown.ts src/lib/extracao/htmlMarkdown.test.ts
```

- [ ] **Step 6: Rodar a suíte de extração inteira**

Run: `npx jest src/lib/extracao -i`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: .docx sanitiza o HTML do mammoth em vez de rebaixar pra Markdown

htmlMarkdown.ts (parser próprio de ~270 linhas que convertia o HTML
do mammoth pra Markdown) sai por completo — o mammoth já produz o
formato de saída final do módulo; só falta tirar id/class/style que
ele às vezes anexa."
```

---

### Task 9: Excel/CSV — tabela emite HTML

**Files:**
- Modify: `src/lib/extracao/excel.ts` (`planilhaParaTabelaMarkdown` → `planilhaParaTabelaHtml`,
  `converterPlanilhaParaMarkdown` → `converterPlanilhaParaHtml`)
- Modify: `src/lib/extracao/excel.test.ts`
- Modify: `src/lib/extracao/index.ts` (usa o novo nome)

**Interfaces:**
- Consumes: `escaparHtml` (Task 2).
- Produces: `converterPlanilhaParaHtml(buffer: Buffer, tipo: 'xlsx' | 'csv'): Promise<string>`

- [ ] **Step 1: Localizar e atualizar os testes existentes de `converterPlanilhaParaMarkdown`**

Busque em `excel.test.ts` por `converterPlanilhaParaMarkdown` e troque nome + asserção de tabela
Markdown pro equivalente HTML, seguindo o mesmo padrão da Task 3:

```ts
it('converte planilha de uma aba só numa tabela HTML', async () => {
  // ... mock do workbook, inalterado ...
  const html = await converterPlanilhaParaHtml(buffer, 'xlsx')
  expect(html).toBe(
    '<table><thead><tr><th>Item</th><th>Valor</th></tr></thead>' +
      '<tbody><tr><td>Consultoria</td><td>1000</td></tr></tbody></table>'
  )
})

it('planilha vazia devolve aviso em <p><em>', async () => {
  // ... mock de workbook sem linha nenhuma ...
  const html = await converterPlanilhaParaHtml(buffer, 'xlsx')
  expect(html).toBe('<p><em>Planilha vazia — nenhum dado encontrado.</em></p>')
})

it('mais de uma aba vira <h2> por aba, separadas por <hr>', async () => {
  // ... mock de workbook com duas abas com dado ...
  const html = await converterPlanilhaParaHtml(buffer, 'xlsx')
  expect(html).toContain('<h2>')
  expect(html).toContain('<hr>')
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/lib/extracao/excel.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar**

```ts
import { escaparHtml } from './escaparHtml'

function celulaHtml(valor: string, tag: 'td' | 'th'): string {
  return `<${tag}>${escaparHtml(valor)}</${tag}>`
}

/** Converte UMA aba numa tabela HTML (todas as linhas, sem amostragem nem
 *  estatística). */
function planilhaParaTabelaHtml({ cabecalho, linhas }: PlanilhaCarregada): string {
  const linhaCabecalho = `<tr>${cabecalho.map((c) => celulaHtml(c || '', 'th')).join('')}</tr>`
  const linhasCorpo = linhas.map((l) => `<tr>${l.map((v) => celulaHtml(String(v ?? ''), 'td')).join('')}</tr>`).join('')
  return `<table><thead>${linhaCabecalho}</thead><tbody>${linhasCorpo}</tbody></table>`
}

/** Converte a planilha inteira (todas as abas com dados, todas as linhas,
 *  sem amostragem nem estatística) em HTML — determinístico, sem IA. Usado
 *  na Proposta Comercial, onde o conteúdo final tem que ser fiel ao
 *  original, só formatado. Com mais de uma aba, cada uma vira uma seção sob
 *  o próprio nome; nenhuma aba é descartada. */
export async function converterPlanilhaParaHtml(buffer: Buffer, tipo: 'xlsx' | 'csv'): Promise<string> {
  const abas = await carregarPlanilhasComDados(buffer, tipo)
  if (abas.length === 0) {
    return '<p><em>Planilha vazia — nenhum dado encontrado.</em></p>'
  }
  if (abas.length === 1) {
    return planilhaParaTabelaHtml(abas[0])
  }
  return abas.map((aba) => `<h2>${escaparHtml(aba.planilha.name)}</h2>${planilhaParaTabelaHtml(aba)}`).join('<hr>')
}
```

Remova `escaparCelulaMarkdown` e `planilhaParaTabelaMarkdown`/`converterPlanilhaParaMarkdown`.

Em `extracao/index.ts`, troque o import e a chamada:

```ts
import { extrairExcel, lerPlanilhaPreview, converterPlanilhaParaHtml, type PreviewPlanilha } from './excel'
// ...
export async function converterParaHtmlDeterministico(buffer: Buffer, tipo: string): Promise<string> {
  switch (tipo) {
    case 'xlsx':
    case 'csv':
      return converterPlanilhaParaHtml(buffer, tipo)
    case 'docx':
      return sanitizarHtmlMammoth(await converterDocxParaHtml(buffer))
    default:
      throw new Error(`Tipo de arquivo "${tipo}" não suportado para conversão determinística`)
  }
}
```

- [ ] **Step 4: Rodar de novo — passa**

Run: `npx jest src/lib/extracao/excel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/extracao/excel.ts src/lib/extracao/excel.test.ts src/lib/extracao/index.ts
git commit -m "feat: planilha (.xlsx/.csv) emite tabela HTML em vez de Markdown"
```

---

### Task 10: Fechar o wiring em `route.ts` (upload) e rodar a suíte completa da Proposta Comercial

**Files:**
- Modify: `src/app/api/propostas-comerciais/route.ts`
- Modify: `src/app/api/propostas-comerciais/route.test.ts`

**Interfaces:**
- Consumes: `converterPdfParaHtml` (Task 1+5, devolve `.html`/`.paginasImagem`),
  `converterParaHtmlDeterministico` (Task 8/9), `reescreverComArquivoId` (Task 7).

- [ ] **Step 1: Atualizar o teste de `POST /api/propostas-comerciais`**

Em `route.test.ts`, troque qualquer asserção que espera sintaxe Markdown no `conteudoMarkdown`
gravado (ex.: `expect(proposta.conteudoMarkdown).toContain('**negrito**')`) pela equivalente HTML
(`expect(proposta.conteudoMarkdown).toContain('<strong>negrito</strong>')`) — o NOME do campo do
banco não muda nesta fase (ver Global Constraints), só o conteúdo.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/app/api/propostas-comerciais/route.test.ts`
Expected: FAIL nos pontos que ainda esperam sintaxe Markdown

- [ ] **Step 3: Implementar — trocar os nomes usados em `route.ts`**

```ts
import { converterPdfParaHtml } from '@/lib/extracao/pdfHtml'
import { converterParaHtmlDeterministico } from '@/lib/extracao'
import { reescreverComArquivoId } from '@/lib/ocr/marcadorOcrPendente'

// ...
interface ArquivoConvertido {
  nomeArquivo: string
  html: string
}
const arquivosConvertidos: ArquivoConvertido[] = []
// ...
let html: string | null = null
try {
  if (tipo === 'pdf') {
    const resultado = await converterPdfParaHtml(buffer, {
      salvarImagem: (imagem) =>
        putUpload(buildImagemPath(`${proposta.id}/${indice}`, imagem.nomeArquivo), imagem.png, 'image/png'),
    })
    html = resultado.paginasImagem.length > 0 ? reescreverComArquivoId(resultado.html, arquivoRow.id) : resultado.html
  } else {
    html = await converterParaHtmlDeterministico(buffer, tipo)
  }
  if (!html.trim()) {
    throw new Error(`não foi possível converter "${arquivo.nomeArquivo}" — arquivo sem conteúdo reconhecível`)
  }
} catch (error) {
  falhaConversao = error instanceof Error ? error.message : String(error)
}

await prisma.propostaComercialArquivo.update({
  where: { id: arquivoRow.id },
  data: { conteudoExtraido: html },
})

if (html) {
  arquivosConvertidos.push({ nomeArquivo: arquivo.nomeArquivo, html })
}
// ...
const htmlFinal =
  arquivosConvertidos.length === 1
    ? arquivosConvertidos[0].html
    : arquivosConvertidos.map((a) => `<h2>${a.nomeArquivo}</h2>${a.html}`).join('<hr>')

const propostaFinal = await prisma.propostaComercial.update({
  where: { id: proposta.id },
  data: { conteudoMarkdown: htmlFinal, status: 'rascunho' },
})
```

Note que `conteudoMarkdown:` continua sendo a chave do Prisma (nome da coluna não muda nesta fase —
ver Global Constraints) mesmo a variável se chamando `htmlFinal`. O nome do NOME DE ARQUIVO no
`<h2>` de mais de um arquivo (`a.nomeArquivo`) não passa por `escaparHtml` explicitamente aqui
porque já é o nome do arquivo enviado pela pessoa (mesmo tratamento de confiança que o resto do
upload já dá); se quiser blindar contra um nome de arquivo com `<`/`&`, envolva com
`escaparHtml(a.nomeArquivo)` — recomendado, mas não bloqueante pra fechar esta task.

- [ ] **Step 4: Rodar de novo — passa**

Run: `npx jest src/app/api/propostas-comerciais/route.test.ts`
Expected: PASS

- [ ] **Step 5: Rodar a suíte COMPLETA do projeto uma vez, de ponta a ponta desta fase**

Run: `npx jest`
Expected: PASS em tudo dentro do escopo desta fase (`src/lib/extracao/**`, `src/lib/ocr/
marcadorOcrPendente.test.ts`, `src/app/api/propostas-comerciais/route.test.ts`). Testes de
`editor-markdown`/`conteudo-editavel-proposta`/`checarConversao`/`painel-checagem-conversao` etc.
ainda esperam Markdown — vão falhar até as próximas fases (fora do escopo deste plano). Confirme que
a LISTA de falhas restantes é só esses arquivos das próximas fases, nada em `extracao`/`ocr`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/propostas-comerciais/route.ts src/app/api/propostas-comerciais/route.test.ts
git commit -m "feat: rota de upload da Proposta Comercial grava HTML em conteudoMarkdown

Fecha a Fase 1 da migração pra HTML nativo — PDF, Excel/CSV e Word
convertidos de ponta a ponta. Nome da coluna do banco continua
conteudoMarkdown (rename fica pra fase de migração de dado); o
conteúdo gravado agora é HTML. Editor visual, checagem por IA e cópia
formatada ainda esperam Markdown — próximas fases deste roteiro, ver
docs/superpowers/specs/2026-09-14-html-nativo-ocr-proposta-comercial-design.md."
```

---

## Roteiro das próximas fases (não incluídas neste plano)

Escritas como plano de implementação separado, quando chegarmos em cada uma — não faz sentido
detalhar agora um plano de tasks em cima de código que ainda não existe:

- **Fase 2 — Editor/render/copy:** `ConteudoEditavelProposta` grava `innerHTML` direto (remove
  `htmlEditavelParaMarkdown`), `renderizarMarkdownProposta.ts` → só pós-processamento de callout
  (remove `marked`), `copiarMarkdownFormatado.ts` → `copiarHtmlFormatado.ts` (remove
  `marked.parse`). Depende desta Fase 1 estar mergeada.
- **Fase 3 — OCR:** pré-processamento de imagem em `depsOcrPadrao.ts`, exposição de bounding box por
  palavra em `rodarOcr.ts`, reconstrução de tabela reaproveitando `corredoresDoBloco`/
  `absorverTabelaPorPosicao` (generalizados pra aceitar posição de OCR), cobertura estendida a
  `paginasComImagem`. Depende do formato de marcador da Fase 1 (Task 7).
  Antes de escrever essa fase, investigar `tesseract.js` v7 (`data.words[].bbox`) contra a versão
  real instalada — não documentado neste plano por não ter sido verificado ainda.
- **Fase 4 — Checagem por IA + aplicação de correção (MAIOR RISCO):** `checarConversao.ts`
  (`semMarcacaoMarkdown` → remoção de tag HTML, todos os guard-rails re-verificados),
  `mudancasTexto.ts` (ainda não lido — faz busca/substituição literal de trecho no documento pra
  aplicar/desfazer correção da IA) e `painel-checagem-conversao.tsx` (1582 linhas). Antes de
  escrever o plano desta fase: ler `mudancasTexto.ts`, `lista-mudancas.tsx` e `janela-revisao.tsx`
  por completo — não foram lidos até agora, e é aqui que mora o maior risco de regressão silenciosa
  do projeto inteiro (ver "Risco conhecido" na spec).
- **Fase 5 — Migração de banco:** rename `PropostaComercial.conteudoMarkdown` →
  `conteudoHtml` (migration Prisma), script one-shot `scripts/migrar-markdown-para-html.mts` pro
  dado já em produção, remoção de `marked` de `dependencies` depois de confirmado que não sobra uso
  em runtime.

## Self-Review

**Cobertura da spec (seção 1 e parte da 2/4):** formatadores de negrito/itálico/sublinhado (Task 2),
tabela (Task 3), título (Task 4), parágrafo/lista/cláusula numerada (Task 5), imagem (Task 6),
marcador de OCR (Task 7), `.docx` (Task 8), Excel/CSV (Task 9), wiring da rota de upload (Task 10) —
toda a seção "1. Extração determinística passa a gerar HTML" da spec está coberta. Editor/render/
copy (seção 2), checagem por IA (seção 3) e OCR melhorado (seção 4) ficam pro roteiro de fases
seguintes, deliberadamente fora deste plano.

**Placeholder scan:** nenhum "TBD"/"implementar depois" — toda task tem código real de teste e
implementação. As referências a "buscar em X e trocar Y" (Tasks 3/4/5/9) apontam pro padrão exato
de troca com um exemplo concreto, porque o conteúdo completo dos arquivos de teste existentes
(alguns não lidos por inteiro) não estava disponível neste planejamento — é uma instrução acionável,
não um placeholder de "faça a coisa certa".

**Consistência de tipo:** `ResultadoConversaoPdf.html`/`PaginaConvertida.html` (Task 5) usados
consistentemente em `route.ts` (Task 10). `ImagemPosicionada.html` (Task 6) consistente com o uso em
`montarHtml` (Task 5). `escaparHtml` (Task 2) com a mesma assinatura em todo consumidor (Tasks 2, 6,
9). Formato do marcador OCR (Task 7) consistente entre `formatarBlocoOcrPendente` (produtor, também
chamado de dentro de `pdfHtml.ts`) e `listarBlocosOcrPendente`/`reescreverComArquivoId` (consumidores).
