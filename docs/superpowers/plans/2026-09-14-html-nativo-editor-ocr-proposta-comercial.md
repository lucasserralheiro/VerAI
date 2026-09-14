# HTML nativo — Fases 2+3: Editor/renderização/cópia + OCR melhorado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editor visual, renderização e "Copiar formatado" passam a operar sobre HTML nativo (sem
`marked`, sem round-trip pra Markdown); OCR local ganha pré-processamento de imagem, reconstrução de
tabela por posição das palavras reconhecidas, e cobertura estendida a página com imagem de conteúdo
embutida.

**Architecture:** Fase 2: os três pontos que hoje convertem HTML↔Markdown (editor, renderização,
cópia) perdem a metade que reserializa pra Markdown — o HTML já é o formato de armazenamento (Fase
1). Fase 3: `corredoresDoBloco` (heurística de corredor/coluna já calibrada pro PDF nativo) é
extraída pra um módulo compartilhado e reaproveitada com a posição das palavras que o `tesseract.js`
devolve; pré-processamento de imagem (contraste) roda em cima de `ImageData` puro, testável sem
canvas real.

**Tech Stack:** TypeScript, Jest, `tesseract.js` (já instalado, v7 — `recognize(imagem, {}, {blocks:
true})` devolve `data.blocks[].paragraphs[].lines[].words[]`, cada um com `bbox: {x0,y0,x1,y1}`).

## Global Constraints

- Nenhuma heurística de detecção de tabela por posição (PDF nativo) muda de comportamento — a
  extração pra `corredores.ts` é um refactor puro, sem mudança de resultado.
- `marked` sai de `dependencies` só no fim da Fase 2 (Task 5), depois de confirmado que não sobra
  nenhum uso em runtime.
- Nomes de prop/variável que hoje dizem "markdown" (`conteudoMarkdown`, prop `markdown` de
  `ConteudoEditavelProposta`, etc.) **não são renomeados nesta fase** — só o que cada função FAZ com
  o conteúdo muda. Rename de nome é cosmético, fica pra uma limpeza dedicada depois (mesma decisão
  já tomada na Fase 1 pro nome da coluna do banco).
- OCR continua 100% local (`tesseract.js`, no navegador) — nenhuma chamada de rede/IA nova nesta
  fase.
- Cobertura estendida a `paginasComImagem` (Task 11) é uma simplificação deliberada: reconhece a
  PÁGINA INTEIRA (mesmo mecanismo já usado pra página escaneada), sem recortar só a região da
  imagem — pode reconhecer de novo texto que já está certo no resto da página. A conferência humana
  obrigatória (já existente, inalterada) descarta o que for duplicado. Recorte preciso por região
  fica como melhoria futura, não nesta entrega.

---

# Fase 2 — Editor, renderização e cópia em HTML nativo

### Task 1: `renderizarHtmlProposta.ts` — remove `marked`, só pós-processa callout

**Files:**
- Create: `src/lib/renderizarHtmlProposta.ts`
- Create: `src/lib/renderizarHtmlProposta.test.ts`
- Delete: `src/lib/renderizarMarkdownProposta.ts`, `src/lib/renderizarMarkdownProposta.test.ts`

**Interfaces:**
- Produces: `renderizarHtmlProposta(html: string): string` — mesmo papel de
  `renderizarMarkdownProposta`, mas o parâmetro já é HTML (nenhum parse de sintaxe acontece mais
  aqui).

- [ ] **Step 1: Escrever o teste**

```ts
// src/lib/renderizarHtmlProposta.test.ts
import { renderizarHtmlProposta } from './renderizarHtmlProposta'

describe('renderizarHtmlProposta', () => {
  it('html normal passa direto, sem alteração', () => {
    const html = renderizarHtmlProposta('<h1>Título</h1><p>Texto normal.</p>')
    expect(html).toBe('<h1>Título</h1><p>Texto normal.</p>')
  })

  it('destaca parágrafo que começa com "Divergência" como callout', () => {
    const html = renderizarHtmlProposta('<p>Divergência entre fontes.</p>')
    expect(html).toContain('callout-divergencia')
  })

  it('marcador de OCR pendente vira callout .callout-ocr-pendente', () => {
    const conteudo =
      '<p>Texto normal.</p>' +
      '<div class="ocr-pendente" data-arquivo-id="a1" data-pagina="3"><p>Texto reconhecido.</p></div>'

    const html = renderizarHtmlProposta(conteudo)

    expect(html).toContain('callout-ocr-pendente')
    expect(html).toContain('página 3')
    expect(html).not.toContain('class="ocr-pendente"') // só sobra o callout, não o marcador original
  })

  it('texto normal não é afetado', () => {
    const html = renderizarHtmlProposta('<h1>Título</h1><p>Texto normal.</p>')
    expect(html).not.toContain('callout-ocr-pendente')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/lib/renderizarHtmlProposta.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar**

```ts
// src/lib/renderizarHtmlProposta.ts
import { listarBlocosOcrPendente } from './ocr/marcadorOcrPendente'

/**
 * Pós-processa o HTML já salvo da proposta pra exibição: troca cada
 * marcador `<div class="ocr-pendente">` por um callout visual
 * (`.callout-ocr-pendente`) e marca como `.callout-divergencia` qualquer
 * parágrafo que comece com "Divergência" — convenção que fica disponível
 * pra quem for editar o texto manualmente sinalizar um conflito entre
 * fontes (a conversão em si é 100% determinística, sem IA, então nada gera
 * esse aviso sozinho).
 *
 * Não interpreta sintaxe nenhuma — o conteúdo já É HTML (ver
 * docs/superpowers/specs/2026-09-14-html-nativo-ocr-proposta-comercial-design.md).
 * Antes desta função rodava `marked.parse` pra converter Markdown; isso saiu.
 */
export function renderizarHtmlProposta(html: string): string {
  let comCallouts = html
  for (const bloco of listarBlocosOcrPendente(html)) {
    const aviso = `<div class="callout-ocr-pendente">⚠️ Texto por OCR, não conferido — página ${bloco.pagina} do arquivo original</div>`
    comCallouts = comCallouts.replace(bloco.blocoCompleto, aviso)
  }

  if (typeof DOMParser === 'undefined') return comCallouts // SSR — o pós-processamento só roda no client

  const doc = new DOMParser().parseFromString(comCallouts, 'text/html')
  for (const paragrafo of doc.body.querySelectorAll('p')) {
    if (/^divergência/i.test(paragrafo.textContent?.trim() ?? '')) {
      paragrafo.classList.add('callout-divergencia')
    }
  }
  return doc.body.innerHTML
}
```

```bash
git rm src/lib/renderizarMarkdownProposta.ts src/lib/renderizarMarkdownProposta.test.ts
```

- [ ] **Step 4: Rodar de novo — passa**

Run: `npx jest src/lib/renderizarHtmlProposta.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: renderizarHtmlProposta substitui renderizarMarkdownProposta

Remove marked.parse por completo — o conteúdo já é HTML (Fase 1);
esta função só faz pós-processamento de callout (OCR pendente,
divergência), igual antes."
```

---

### Task 2: `sanitizarHtmlEditavel.ts` — normaliza `contentEditable`, sem serializar pra Markdown

**Files:**
- Create: `src/lib/propostaEditavel/sanitizarHtmlEditavel.ts`
- Create: `src/lib/propostaEditavel/sanitizarHtmlEditavel.test.ts`
- Delete: `src/lib/propostaEditavel/htmlEditavelParaMarkdown.ts`,
  `src/lib/propostaEditavel/htmlEditavelParaMarkdown.test.ts`

**Interfaces:**
- Produces: `sanitizarHtmlEditavel(html: string): string`

- [ ] **Step 1: Escrever os testes**

```ts
// src/lib/propostaEditavel/sanitizarHtmlEditavel.test.ts
import { sanitizarHtmlEditavel } from './sanitizarHtmlEditavel'

describe('sanitizarHtmlEditavel', () => {
  it('normaliza <b>/<i> pra <strong>/<em>', () => {
    expect(sanitizarHtmlEditavel('<p><b>Negrito</b> e <i>itálico</i>.</p>')).toBe(
      '<p><strong>Negrito</strong> e <em>itálico</em>.</p>'
    )
  })

  it('desembrulha <span>/<font>, preservando o texto', () => {
    expect(sanitizarHtmlEditavel('<p><span style="color:red">Texto</span></p>')).toBe('<p>Texto</p>')
  })

  it('<div> fora de tabela/lista vira <p>', () => {
    expect(sanitizarHtmlEditavel('<div>Linha nova</div>')).toBe('<p>Linha nova</p>')
  })

  it('<div> dentro de <td> não vira <p> (preserva a célula)', () => {
    const html = '<table><tbody><tr><td><div>Conteúdo</div></td></tr></tbody></table>'
    expect(sanitizarHtmlEditavel(html)).toBe(html)
  })

  it('remove style/class de qualquer elemento', () => {
    expect(sanitizarHtmlEditavel('<p class="foo" style="color:red">Texto</p>')).toBe('<p>Texto</p>')
  })

  it('desembrulha o callout de divergência, mantendo o texto', () => {
    const html = '<p class="callout-divergencia">Divergência: texto.</p>'
    expect(sanitizarHtmlEditavel(html)).toBe('Divergência: texto.')
  })

  it('normaliza nbsp pra espaço comum', () => {
    expect(sanitizarHtmlEditavel('<p>Texto com nbsp.</p>')).toBe('<p>Texto com nbsp.</p>')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/lib/propostaEditavel/sanitizarHtmlEditavel.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar**

```ts
// src/lib/propostaEditavel/sanitizarHtmlEditavel.ts

/**
 * Sanitiza o HTML que sai de um `contentEditable` antes de salvar —
 * normaliza o jeito irregular como o navegador marca formatação
 * (`<div>`/`<span style>`/`<b>` em vez de `<p>`/`<strong>`) pro mesmo
 * subconjunto de tags que o resto do conversor usa. Diferente do módulo
 * anterior (`htmlEditavelParaMarkdown.ts`, removido), NÃO serializa pra
 * Markdown — devolve HTML mesmo, que já é o formato de armazenamento (ver
 * docs/superpowers/specs/2026-09-14-html-nativo-ocr-proposta-comercial-design.md).
 *
 * Round-trip "melhor esforço": conteúdo e estrutura preservados, não
 * byte-idêntico.
 */
export function sanitizarHtmlEditavel(html: string): string {
  const doc = new DOMParser().parseFromString(`<div id="raiz">${html}</div>`, 'text/html')
  const raiz = doc.getElementById('raiz')!
  normalizar(raiz)
  return raiz.innerHTML
}

function normalizar(raiz: HTMLElement): void {
  const doc = raiz.ownerDocument

  // Desembrulha o callout de divergência — decoração só de exibição
  // (`renderizarHtmlProposta` recria a partir do texto "Divergência:" na
  // próxima renderização); salvar o wrapper junto duplicaria a marcação.
  raiz.querySelectorAll('.callout-divergencia').forEach((el) => desembrulhar(el))

  raiz.querySelectorAll('b').forEach((el) => renomear(el, 'strong'))
  raiz.querySelectorAll('i').forEach((el) => renomear(el, 'em'))
  raiz.querySelectorAll('span, font').forEach((el) => desembrulhar(el))

  // <div> de bloco (fora de célula/item de lista) é como o contentEditable
  // costuma marcar uma linha nova — vira parágrafo.
  raiz.querySelectorAll('div').forEach((el) => {
    if (el.closest('td, th, li')) return
    renomear(el, 'p')
  })

  raiz.querySelectorAll('*').forEach((el) => {
    el.removeAttribute('style')
    el.removeAttribute('class')
  })

  const walker = doc.createTreeWalker(raiz, NodeFilter.SHOW_TEXT)
  let no = walker.nextNode()
  while (no) {
    no.textContent = (no.textContent ?? '').replace(/ /g, ' ')
    no = walker.nextNode()
  }
}

function renomear(el: Element, tag: string): void {
  const novo = el.ownerDocument.createElement(tag)
  while (el.firstChild) novo.appendChild(el.firstChild)
  el.replaceWith(novo)
}

function desembrulhar(el: Element): void {
  el.replaceWith(...Array.from(el.childNodes))
}
```

```bash
git rm src/lib/propostaEditavel/htmlEditavelParaMarkdown.ts src/lib/propostaEditavel/htmlEditavelParaMarkdown.test.ts
```

**Nota:** editar o documento enquanto existe um `.ocr-pendente` ainda visível no editor (OCR
pendente) já era um ponto cego do módulo anterior — `normalizar` não desembrulha
`.callout-ocr-pendente`, então um `<div>` desses vira `<p>` comum se a pessoa editar por perto. Esta
task preserva esse comportamento (não piora, não conserta) — investigar como um follow-up separado
se virar problema real.

- [ ] **Step 4: Rodar de novo — passa**

Run: `npx jest src/lib/propostaEditavel/sanitizarHtmlEditavel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: sanitizarHtmlEditavel substitui htmlEditavelParaMarkdown

Mesma normalização de contentEditable de antes (b/i, span/font, div de
bloco, style/class, nbsp) — só não serializa mais pra Markdown, já
devolve HTML (formato de armazenamento desde a Fase 1). Remove ~100
linhas de serialização (inline/lista/tabela em sintaxe Markdown) que
não fazem mais sentido nenhum."
```

---

### Task 3: `ConteudoEditavelProposta` grava HTML direto, sem round-trip

**Files:**
- Modify: `src/app/propostas-comerciais/[id]/conteudo-editavel-proposta.tsx`
- Modify: `src/app/propostas-comerciais/[id]/conteudo-editavel-proposta.test.tsx`

**Interfaces:**
- Consumes: `renderizarHtmlProposta` (Task 1), `sanitizarHtmlEditavel` (Task 2).
- Produces: mesma assinatura pública de `ConteudoEditavelProposta` (prop `markdown: string` mantém
  o nome — ver Global Constraints).

- [ ] **Step 1: Atualizar as fixtures do teste existente pra HTML**

Reescreva `conteudo-editavel-proposta.test.tsx` trocando cada `markdown="# Título"` (ou variantes)
por HTML equivalente, e os `expect(onChange).toHaveBeenCalledWith(...)` pro HTML que
`sanitizarHtmlEditavel` realmente produz (não Markdown):

```tsx
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ConteudoEditavelProposta } from './conteudo-editavel-proposta'

function pegarEditor() {
  return screen.getByRole('textbox', { name: 'Conteúdo da proposta' }) as HTMLDivElement
}

describe('ConteudoEditavelProposta', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('renderiza o HTML inicial formatado', () => {
    render(<ConteudoEditavelProposta markdown="<h1>Título</h1>" onChange={jest.fn()} />)
    expect(screen.getByRole('heading', { name: 'Título' })).toBeInTheDocument()
  })

  it('chama onChange (com debounce) com o HTML sanitizado depois de digitar', () => {
    const onChange = jest.fn()
    render(<ConteudoEditavelProposta markdown="<h1>Título</h1>" onChange={onChange} />)

    const editor = pegarEditor()
    editor.innerHTML = '<h1>Título editado</h1>'
    fireEvent.input(editor)

    expect(onChange).not.toHaveBeenCalled()
    act(() => {
      jest.advanceTimersByTime(400)
    })
    expect(onChange).toHaveBeenCalledWith('<h1>Título editado</h1>')
  })

  it('não refaz o HTML quando o markdown muda por causa do próprio onChange (evita cursor pular)', () => {
    const onChange = jest.fn()
    const { rerender } = render(<ConteudoEditavelProposta markdown="<h1>Título</h1>" onChange={onChange} />)

    const editor = pegarEditor()
    editor.innerHTML = '<h1>Digitando</h1>'
    fireEvent.input(editor)
    act(() => {
      jest.advanceTimersByTime(400)
    })

    rerender(<ConteudoEditavelProposta markdown="<h1>Digitando</h1>" onChange={onChange} />)
    expect(editor.innerHTML).toBe('<h1>Digitando</h1>')
  })

  it('refaz o HTML quando o markdown muda por uma fonte externa', () => {
    const onChange = jest.fn()
    const { rerender } = render(<ConteudoEditavelProposta markdown="<h1>Título</h1>" onChange={onChange} />)

    rerender(<ConteudoEditavelProposta markdown="<h1>Corrigido pela IA</h1>" onChange={onChange} />)

    expect(screen.getByRole('heading', { name: 'Corrigido pela IA' })).toBeInTheDocument()
  })

  it('colar insere só texto puro, sem HTML/estilo', () => {
    document.execCommand = jest.fn()
    render(<ConteudoEditavelProposta markdown="<h1>Título</h1>" onChange={jest.fn()} />)

    const editor = pegarEditor()
    const clipboardData = { getData: (tipo: string) => (tipo === 'text/plain' ? 'texto colado' : '<b>html</b>') }
    fireEvent.paste(editor, { clipboardData })

    expect(document.execCommand).toHaveBeenCalledWith('insertText', false, 'texto colado')
  })

  it('Enter dentro de uma célula de tabela é bloqueado', () => {
    render(<ConteudoEditavelProposta markdown="<table><tr><td>1</td></tr></table>" onChange={jest.fn()} />)
    const editor = pegarEditor()
    const celula = editor.querySelector('td')!
    const noDeTexto = celula.firstChild!

    jest.spyOn(window, 'getSelection').mockReturnValue({
      anchorNode: noDeTexto,
    } as unknown as Selection)

    const evento = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    fireEvent(editor, evento)

    expect(evento.defaultPrevented).toBe(true)
  })

  it('Enter fora de tabela não é bloqueado', () => {
    render(<ConteudoEditavelProposta markdown="<p>Texto simples</p>" onChange={jest.fn()} />)
    const editor = pegarEditor()
    const noDeTexto = editor.querySelector('p')!.firstChild!

    jest.spyOn(window, 'getSelection').mockReturnValue({
      anchorNode: noDeTexto,
    } as unknown as Selection)

    const evento = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    fireEvent(editor, evento)

    expect(evento.defaultPrevented).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/app/propostas-comerciais/\[id\]/conteudo-editavel-proposta.test.tsx`
Expected: FAIL — o componente ainda usa `renderizarMarkdownProposta`/`htmlEditavelParaMarkdown`
(módulos apagados nas tasks anteriores), então nem compila.

- [ ] **Step 3: Trocar os dois imports e usos**

```tsx
// src/app/propostas-comerciais/[id]/conteudo-editavel-proposta.tsx — troca só estas duas linhas de import e as duas chamadas
import { renderizarHtmlProposta } from '@/lib/renderizarHtmlProposta'
import { sanitizarHtmlEditavel } from '@/lib/propostaEditavel/sanitizarHtmlEditavel'
```

No corpo do componente: `ref.current.innerHTML = renderizarHtmlProposta(markdown)` (era
`renderizarMarkdownProposta`) e `onChange(sanitizarHtmlEditavel(ref.current.innerHTML))` (era
`htmlEditavelParaMarkdown`). Nenhuma outra linha do componente muda — `handlePaste`,
`handleKeyDown`, debounce, refs, tudo igual.

- [ ] **Step 4: Rodar de novo — passa**

Run: `npx jest src/app/propostas-comerciais/\[id\]/conteudo-editavel-proposta.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: ConteudoEditavelProposta grava HTML direto, sem round-trip pra Markdown

Elimina a dupla conversão HTML->Markdown->HTML que rodava a cada
tecla — o contentEditable já edita HTML; agora ele grava o HTML
sanitizado direto (sanitizarHtmlEditavel) e exibe via
renderizarHtmlProposta, sem reserializar sintaxe no meio do caminho."
```

---

### Task 4: `copiarHtmlFormatado.ts` — remove `marked.parse`

**Files:**
- Create: `src/lib/copiarHtmlFormatado.ts`
- Create: `src/lib/copiarHtmlFormatado.test.ts`
- Delete: `src/lib/copiarMarkdownFormatado.ts`, `src/lib/copiarMarkdownFormatado.test.ts`

**Interfaces:**
- Produces: `copiarHtmlFormatado(html: string, opcoesFonte?: OpcoesFonteCopia): Promise<void>` —
  mesmo papel de `copiarMarkdownFormatado`, `OpcoesFonteCopia` com a mesma forma de antes
  (`{ familia?: string; tamanhoCorpo?: number }`).

- [ ] **Step 1: Escrever o teste**

```ts
// src/lib/copiarHtmlFormatado.test.ts
import { copiarHtmlFormatado } from './copiarHtmlFormatado'

class ClipboardItemFalso {
  constructor(public items: Record<string, Blob>) {}
}

async function htmlCopiado(html: string): Promise<string> {
  await copiarHtmlFormatado(html)
  const item = (navigator.clipboard.write as jest.Mock).mock.calls[0][0][0] as ClipboardItemFalso
  return item.items['text/html'].text()
}

function temEstiloFonte(html: string, trecho: string): boolean {
  return html.includes(trecho)
}

const HTML_TABELA =
  '<table><thead><tr><th>Item</th><th>Valor</th></tr></thead>' +
  '<tbody><tr><td>Storage</td><td>R$ 100</td></tr><tr><td>Rede</td><td>R$ 200</td></tr></tbody></table>'

const NAVY_RGB = 'rgb(0, 42, 74)'
const BORDA_GREY_RGB = 'rgb(217, 217, 217)'
const LIGHT_GREY_RGB = 'rgb(242, 242, 242)'

describe('copiarHtmlFormatado', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as unknown as { ClipboardItem: typeof ClipboardItemFalso }).ClipboardItem = ClipboardItemFalso
    Object.assign(navigator, { clipboard: { write: jest.fn().mockResolvedValue(undefined) } })
  })

  it('copia HTML e texto simples pra área de transferência, um bloco por linha', async () => {
    await copiarHtmlFormatado('<h1>Título</h1><p>Texto normal.</p>')

    expect(navigator.clipboard.write).toHaveBeenCalledTimes(1)
    const item = (navigator.clipboard.write as jest.Mock).mock.calls[0][0][0] as ClipboardItemFalso
    expect(item.items['text/html']).toBeInstanceOf(Blob)
    expect(item.items['text/plain']).toBeInstanceOf(Blob)
    expect(await item.items['text/plain'].text()).toBe('Título\nTexto normal.')
  })

  it('título sai com a fonte institucional Aptos, 14pt e negrito', async () => {
    const html = await htmlCopiado('<h2>Seção 1</h2>')
    const tituloTag = html.match(/<h2[^>]*>/)?.[0] ?? ''

    expect(tituloTag.toLowerCase()).toContain('aptos')
    expect(temEstiloFonte(tituloTag, 'font-size: 14pt')).toBe(true)
    expect(temEstiloFonte(tituloTag, 'font-weight: bold')).toBe(true)
  })

  it('parágrafo sai com a fonte institucional Aptos em 12pt (corpo do texto)', async () => {
    const html = await htmlCopiado('<p>Um parágrafo qualquer da proposta.</p>')
    const paragrafoTag = html.match(/<p[^>]*>/)?.[0] ?? ''

    expect(paragrafoTag.toLowerCase()).toContain('aptos')
    expect(temEstiloFonte(paragrafoTag, 'font-size: 12pt')).toBe(true)
  })

  it('trecho em negrito sai em negrito mas mantém o tamanho do corpo do texto (não vira título)', async () => {
    const html = await htmlCopiado('<p>Isso é <strong>importante</strong> de verdade.</p>')
    const strongTag = html.match(/<strong[^>]*>/)?.[0] ?? ''

    expect(strongTag).not.toBe('')
    expect(temEstiloFonte(strongTag, 'font-weight: bold')).toBe(true)
    expect(strongTag).not.toContain('14pt') // negrito no corpo do texto não é título
  })

  it('célula de tabela sai com a fonte institucional em 12pt', async () => {
    const html = await htmlCopiado(HTML_TABELA)
    const tdTag = html.match(/<td[^>]*>/)?.[0] ?? ''

    expect(html).toContain('<table')
    expect(tdTag.toLowerCase()).toContain('aptos')
    expect(temEstiloFonte(tdTag, 'font-size: 12pt')).toBe(true)
  })

  it('tabela sai com borda, largura cheia e cabeçalho em navy — sem isso ela cola sem estrutura nenhuma no Word/SEI', async () => {
    const html = await htmlCopiado(HTML_TABELA)
    const tabelaTag = html.match(/<table[^>]*>/)?.[0] ?? ''
    const linhaCabecalhoTag = html.match(/<tr[^>]*>\s*<th/)?.[0] ?? ''
    const thTag = html.match(/<th(?=[\s>])[^>]*>/)?.[0] ?? ''
    const tdTag = html.match(/<td[^>]*>/)?.[0] ?? ''

    expect(temEstiloFonte(tabelaTag, 'border-collapse: collapse')).toBe(true)
    expect(temEstiloFonte(tabelaTag, 'width: 100%')).toBe(true)
    expect(temEstiloFonte(linhaCabecalhoTag, `background-color: ${NAVY_RGB}`)).toBe(true)
    expect(temEstiloFonte(thTag, `border: 1px solid ${NAVY_RGB}`)).toBe(true)
    expect(temEstiloFonte(tdTag, `border: 1px solid ${BORDA_GREY_RGB}`)).toBe(true)
    expect(thTag.toLowerCase()).toContain('aptos')
  })

  it('linhas do corpo da tabela alternam fundo (zebra), igual ao preview na tela', async () => {
    const html = await htmlCopiado(HTML_TABELA)
    const linhasCorpo = [...html.matchAll(/<tr[^>]*>\s*<td/g)].map((m) => m[0])

    expect(linhasCorpo).toHaveLength(2)
    expect(linhasCorpo[0]).not.toContain(LIGHT_GREY_RGB)
    expect(linhasCorpo[1]).toContain(LIGHT_GREY_RGB)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/lib/copiarHtmlFormatado.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar**

Copie `aplicarFonteInstitucional`/`aplicarEstiloTabela`/as constantes de cor de
`copiarMarkdownFormatado.ts` **sem alteração nenhuma** (não dependem de Markdown, só manipulam o
`doc` já parseado) — só a função pública e a extração de texto simples mudam:

```ts
// src/lib/copiarHtmlFormatado.ts
const FONTE_PADRAO = "'Aptos', 'Aptos Text', Calibri, 'Segoe UI', sans-serif"
const TAMANHO_CORPO_PADRAO = 12
const COR_NAVY = '#002a4a'
const COR_BORDA_GREY = '#d9d9d9'
const COR_LIGHT_GREY = '#f2f2f2'

export interface OpcoesFonteCopia {
  familia?: string
  tamanhoCorpo?: number
}

function aplicarFonteInstitucional(doc: Document, opcoes?: OpcoesFonteCopia): void {
  // ... corpo idêntico ao de copiarMarkdownFormatado.ts, sem mudança ...
}

function aplicarEstiloTabela(doc: Document): void {
  // ... corpo idêntico ao de copiarMarkdownFormatado.ts, sem mudança ...
}

/** Um bloco por linha — junta o `textContent` de cada elemento de bloco
 *  direto (h1-h6/p/table/ul/ol) em vez de `doc.body.textContent` inteiro,
 *  que colaria o texto de blocos diferentes sem separação nenhuma (HTML não
 *  insere quebra de linha entre tags por conta própria — quem fazia isso
 *  antes era o `\n` que o `marked` deixava entre blocos gerados). */
function textoSimplesDoDocumento(doc: Document): string {
  return Array.from(doc.body.children)
    .map((el) => el.textContent ?? '')
    .join('\n')
}

/**
 * Copia HTML pra área de transferência como HTML real (`text/html`, com
 * `text/plain` de fallback) — assim colar num Word/editor rico traz tabelas
 * e negrito de verdade. `html` já é o formato de armazenamento (Fase 1);
 * antes desta função rodava `marked.parse` a partir de Markdown — isso saiu.
 *
 * Cada elemento sai com a fonte institucional já embutida no `style` — ver
 * `aplicarFonteInstitucional`. Tabelas saem com a mesma borda/cabeçalho
 * navy/zebra do preview — ver `aplicarEstiloTabela`. Sem `opcoesFonte`, usa
 * o padrão institucional (Aptos, 12pt/14pt).
 */
export async function copiarHtmlFormatado(html: string, opcoesFonte?: OpcoesFonteCopia): Promise<void> {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  aplicarFonteInstitucional(doc, opcoesFonte)
  aplicarEstiloTabela(doc)

  const htmlFinal = doc.body.innerHTML
  const textoSimples = textoSimplesDoDocumento(doc) || html

  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([htmlFinal], { type: 'text/html' }),
      'text/plain': new Blob([textoSimples], { type: 'text/plain' }),
    }),
  ])
}
```

```bash
git rm src/lib/copiarMarkdownFormatado.ts src/lib/copiarMarkdownFormatado.test.ts
```

- [ ] **Step 4: Rodar de novo — passa**

Run: `npx jest src/lib/copiarHtmlFormatado.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: copiarHtmlFormatado substitui copiarMarkdownFormatado

Remove marked.parse — html já é o formato de armazenamento. Texto
simples do clipboard passa a juntar o textContent de cada bloco
direto com \\n entre eles (textoSimplesDoDocumento), em vez de
doc.body.textContent inteiro — sem isso, blocos coladas sem espaço
nenhum entre si (HTML não insere quebra de linha sozinho como o
marked deixava)."
```

---

### Task 5: Wiring final — `espaco-proposta.tsx`, `diffPropostaRenderizada.ts`, remove `marked`

**Files:**
- Modify: `src/app/propostas-comerciais/[id]/espaco-proposta.tsx`
- Modify: `src/lib/diffPropostaRenderizada.ts`
- Modify: `src/lib/diffPropostaRenderizada.test.ts`
- Modify: `package.json` (remove `marked` de `dependencies`)

**Interfaces:**
- Consumes: `copiarHtmlFormatado` (Task 4), `renderizarHtmlProposta` (Task 1).

- [ ] **Step 1: `espaco-proposta.tsx` — trocar o import**

```tsx
// era: import { copiarMarkdownFormatado } from '@/lib/copiarMarkdownFormatado'
import { copiarHtmlFormatado } from '@/lib/copiarHtmlFormatado'
```

E a chamada dentro de `handleCopiarFormatado`: `await copiarHtmlFormatado(markdown, {...})` (era
`copiarMarkdownFormatado`). Nada mais muda nesse arquivo.

- [ ] **Step 2: Atualizar `diffPropostaRenderizada.test.ts` pras fixtures em HTML**

```ts
// src/lib/diffPropostaRenderizada.test.ts
import { diffPropostaRenderizada } from './diffPropostaRenderizada'

describe('diffPropostaRenderizada', () => {
  it('marca a palavra trocada com <del> e <ins> dentro do parágrafo renderizado', () => {
    const html = diffPropostaRenderizada('<p>A proposta e boa.</p>', '<p>A proposta é boa.</p>')

    expect(html).toMatch(/<del>\s*e\s*<\/del>/)
    expect(html).toMatch(/<ins>\s*é\s*<\/ins>/)
    expect(html).toContain('<p>')
  })

  it('não marca nada quando os textos são idênticos', () => {
    const html = diffPropostaRenderizada(
      '<h1>Proposta</h1><p>Texto igual.</p>',
      '<h1>Proposta</h1><p>Texto igual.</p>'
    )

    expect(html).not.toContain('<del>')
    expect(html).not.toContain('<ins>')
  })

  it('preserva títulos e tabelas na saída', () => {
    const html =
      '<h1>Título</h1><table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
    const resultado = diffPropostaRenderizada(html, html)

    expect(resultado).toContain('<h1')
    expect(resultado).toContain('<table')
  })

  it('cai no fallback (só a versão corrigida) quando a estrutura de texto diverge', () => {
    const html = diffPropostaRenderizada('<p>um dois</p>', '<p>um dois três</p><p>quatro</p>')

    expect(html).toContain('quatro')
    expect(html).not.toContain('<del>')
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx jest src/lib/diffPropostaRenderizada.test.ts`
Expected: FAIL — `diffPropostaRenderizada.ts` ainda importa `renderizarMarkdownProposta` (apagado na
Task 1).

- [ ] **Step 4: Trocar o import em `diffPropostaRenderizada.ts`**

```ts
// era: import { renderizarMarkdownProposta } from './renderizarMarkdownProposta'
import { renderizarHtmlProposta } from './renderizarHtmlProposta'
```

E as duas chamadas internas (`renderizarMarkdownProposta(corrigido)` →
`renderizarHtmlProposta(corrigido)`, idem pro `original`). Nada mais no arquivo muda — a lógica de
diff por nó de texto é agnóstica de Markdown vs. HTML.

- [ ] **Step 5: Rodar de novo — passa**

Run: `npx jest src/lib/diffPropostaRenderizada.test.ts`
Expected: PASS

- [ ] **Step 6: Confirmar que `marked` não sobra em nenhum lugar do runtime e remover do `package.json`**

```bash
grep -rn "from 'marked'\|require('marked')" src
```

Expected: nenhuma ocorrência (as quatro que existiam — `renderizarMarkdownProposta.ts`,
`copiarMarkdownFormatado.ts`, e seus testes — foram apagadas nas Tasks 1 e 4).

Remova a linha `"marked": "^15.0.12",` de `dependencies` em `package.json` e rode:

```bash
npm install
```

- [ ] **Step 7: Rodar a suíte inteira**

Run: `npx jest`
Expected: PASS em tudo dentro do escopo da Fase 2 (`renderizarHtmlProposta`,
`sanitizarHtmlEditavel`, `conteudo-editavel-proposta`, `copiarHtmlFormatado`,
`diffPropostaRenderizada`, `espaco-proposta`). Roda `npx tsc --noEmit` também — espera-se limpo.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: fecha a Fase 2 — remove marked do projeto

espaco-proposta.tsx e diffPropostaRenderizada.ts apontam pros módulos
novos (copiarHtmlFormatado, renderizarHtmlProposta). marked sai de
dependencies — não sobra nenhum uso em runtime. Editor visual,
renderização e cópia formatada operam sobre HTML nativo de ponta a
ponta, sem round-trip pra Markdown em lugar nenhum."
```

---

# Fase 3 — OCR melhorado

### Task 6: Extrai `corredores.ts` de `pdfHtml.ts` (refactor puro)

**Files:**
- Create: `src/lib/extracao/corredores.ts`
- Create: `src/lib/extracao/corredores.test.ts`
- Modify: `src/lib/extracao/pdfHtml.ts`

**Interfaces:**
- Produces: `corredoresDoBloco(linhas: LinhaPosicionada[], larguraMinima: number): Intervalo[]`,
  `interface ItemPosicionado { x: number; width: number }`,
  `interface LinhaPosicionada { itens: ItemPosicionado[] }`, `interface Intervalo { inicio: number;
  fim: number }`. `Linha`/`ItemLinha` de `pdfHtml.ts` continuam estruturalmente compatíveis (têm
  `x`/`width` a mais campos) — nenhuma mudança de tipo nos call sites de `pdfHtml.ts`.

- [ ] **Step 1: Mover o código, sem mudar comportamento**

```ts
// src/lib/extracao/corredores.ts
export interface ItemPosicionado {
  x: number
  width: number
}

export interface LinhaPosicionada {
  itens: ItemPosicionado[]
}

export interface Intervalo {
  inicio: number
  fim: number
}

/** Em quantas linhas do bloco o corredor precisa aparecer como espaço ENTRE
 *  dois trechos de texto — e não como sobra à direita de uma linha curta, que
 *  toda última linha de parágrafo tem. */
const LINHAS_PARA_CONFIRMAR_CORREDOR = 2

function intervalosOcupados(linha: LinhaPosicionada): Intervalo[] {
  return linha.itens
    .map((item) => ({ inicio: item.x, fim: item.x + item.width }))
    .sort((a, b) => a.inicio - b.inicio)
}

/** Recorta de `livres` tudo que `ocupados` cobre — o que sobra é espaço em
 *  branco. */
function subtrairIntervalos(livres: Intervalo[], ocupados: Intervalo[]): Intervalo[] {
  let resultado = livres
  for (const ocupado of ocupados) {
    const proximo: Intervalo[] = []
    for (const livre of resultado) {
      if (ocupado.fim <= livre.inicio || ocupado.inicio >= livre.fim) {
        proximo.push(livre)
        continue
      }
      if (ocupado.inicio > livre.inicio) proximo.push({ inicio: livre.inicio, fim: ocupado.inicio })
      if (ocupado.fim < livre.fim) proximo.push({ inicio: ocupado.fim, fim: livre.fim })
    }
    resultado = proximo
  }
  return resultado
}

/** O corredor é espaço ENTRE textos nesta linha (tem conteúdo dos dois lados),
 *  e não a sobra à direita de uma linha que simplesmente acabou antes. */
function ehEspacoEntreTextos(corredor: Intervalo, linha: LinhaPosicionada): boolean {
  const ocupados = intervalosOcupados(linha)
  return ocupados.some((item) => item.fim <= corredor.inicio) && ocupados.some((item) => item.inicio >= corredor.fim)
}

/**
 * Corredores verticais que atravessam TODAS as linhas do bloco sem encostar em
 * texto nenhum — é isso que separa coluna de tabela de espaço esticado de
 * parágrafo justificado.
 *
 * Num parágrafo justificado os vãos entre palavras são largos, mas caem num X
 * diferente a cada linha; empilhadas, uma linha tapa o vão da outra e não sobra
 * corredor. Numa tabela as colunas ficam sempre no mesmo lugar, então o
 * corredor atravessa o bloco inteiro de cima a baixo.
 *
 * Extraído de `pdfHtml.ts` (heurística original pro PDF nativo, calibrada
 * contra `scripts/diagnostico-conversao.mts`) pra ser reaproveitado também
 * pela reconstrução de tabela do OCR (`tabelaPorPosicaoOcr.ts`) — mesmo
 * princípio geométrico, fonte de posição diferente (ponto de PDF vs. pixel
 * de canvas renderizado).
 */
export function corredoresDoBloco(linhas: LinhaPosicionada[], larguraMinima: number): Intervalo[] {
  const inicios = linhas.flatMap((linha) => linha.itens.map((item) => item.x))
  const fins = linhas.flatMap((linha) => linha.itens.map((item) => item.x + item.width))
  if (inicios.length === 0) return []

  let livres: Intervalo[] = [{ inicio: Math.min(...inicios), fim: Math.max(...fins) }]
  for (const linha of linhas) livres = subtrairIntervalos(livres, intervalosOcupados(linha))

  return livres.filter((corredor) => {
    if (corredor.fim - corredor.inicio < larguraMinima) return false
    const confirmacoes = linhas.filter((linha) => ehEspacoEntreTextos(corredor, linha)).length
    return confirmacoes >= LINHAS_PARA_CONFIRMAR_CORREDOR
  })
}
```

Em `pdfHtml.ts`: apague `interface Intervalo`, `intervalosOcupados`, `subtrairIntervalos`,
`ehEspacoEntreTextos`, `corredoresDoBloco` (o corpo inteiro dessas 5 declarações), e troque o import:

```ts
import { corredoresDoBloco, type Intervalo } from './corredores'
```

- [ ] **Step 2: Escrever teste direto do módulo extraído**

```ts
// src/lib/extracao/corredores.test.ts
import { corredoresDoBloco } from './corredores'

describe('corredoresDoBloco', () => {
  it('acha um corredor que atravessa todas as linhas', () => {
    const linhas = [
      { itens: [{ x: 0, width: 40 }, { x: 100, width: 40 }] },
      { itens: [{ x: 0, width: 30 }, { x: 100, width: 30 }] },
    ]

    const corredores = corredoresDoBloco(linhas, 18)

    expect(corredores).toEqual([{ inicio: 40, fim: 100 }])
  })

  it('não acha corredor quando os vãos caem em X diferente a cada linha (parágrafo justificado)', () => {
    const linhas = [
      { itens: [{ x: 0, width: 12 }, { x: 40, width: 80 }] },
      { itens: [{ x: 0, width: 60 }, { x: 95, width: 10 }, { x: 125, width: 55 }] },
    ]

    expect(corredoresDoBloco(linhas, 18)).toEqual([])
  })

  it('exige confirmação em pelo menos 2 linhas — corredor que só aparece numa linha não conta', () => {
    const linhas = [
      { itens: [{ x: 0, width: 40 }, { x: 100, width: 40 }] },
      { itens: [{ x: 0, width: 140 }] }, // linha corrida, sem vão nenhum
    ]

    expect(corredoresDoBloco(linhas, 18)).toEqual([])
  })
})
```

- [ ] **Step 3: Rodar o módulo novo e a suíte de extração inteira**

Run: `npx jest src/lib/extracao -i`
Expected: PASS em tudo — inclusive os `describe`s de "tabela por posição" em `pdfHtml.test.ts`, que
continuam passando porque o comportamento não mudou, só o arquivo.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: extrai corredoresDoBloco de pdfHtml.ts pra corredores.ts

Refactor puro, sem mudança de comportamento — prepara reaproveitar a
mesma heurística de corredor/coluna na reconstrução de tabela do OCR
(Task 9), sem duplicar a lógica geométrica."
```

---

### Task 7: `preprocessarImagem.ts` — contraste, puro e testável sem canvas real

**Files:**
- Create: `src/lib/ocr/preprocessarImagem.ts`
- Create: `src/lib/ocr/preprocessarImagem.test.ts`

**Interfaces:**
- Produces: `binarizarEContrastar(imagem: ImagemEmMemoria): void`,
  `interface ImagemEmMemoria { data: Uint8ClampedArray; width: number; height: number }` — mesma
  forma de um `ImageData` de canvas, sem depender da API de canvas de verdade (jsdom não tem
  `canvas` real instalado — testável com um objeto literal).

- [ ] **Step 1: Escrever o teste**

```ts
// src/lib/ocr/preprocessarImagem.test.ts
import { binarizarEContrastar } from './preprocessarImagem'

describe('binarizarEContrastar', () => {
  it('estica o contraste: luminância mínima vira preto (0), máxima vira branco (255)', () => {
    // 2 pixels: cinza escuro (60,60,60) e cinza claro (180,180,180) — simula
    // scanner de baixo contraste (nunca preto/branco puro).
    const imagem = {
      data: new Uint8ClampedArray([60, 60, 60, 255, 180, 180, 180, 255]),
      width: 2,
      height: 1,
    }

    binarizarEContrastar(imagem)

    expect(imagem.data[0]).toBe(0)
    expect(imagem.data[4]).toBe(255)
    expect(imagem.data[3]).toBe(255) // alpha preservado
    expect(imagem.data[7]).toBe(255)
  })

  it('página uniforme (sem variação de luminância) não altera nada', () => {
    const imagem = {
      data: new Uint8ClampedArray([128, 128, 128, 255, 128, 128, 128, 255]),
      width: 2,
      height: 1,
    }

    binarizarEContrastar(imagem)

    expect(Array.from(imagem.data)).toEqual([128, 128, 128, 255, 128, 128, 128, 255])
  })

  it('pixel intermediário escala linearmente entre o mínimo e o máximo já presentes', () => {
    const imagem = {
      data: new Uint8ClampedArray([0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255]),
      width: 3,
      height: 1,
    }

    binarizarEContrastar(imagem)

    expect(imagem.data[0]).toBe(0)
    expect(imagem.data[4]).toBe(128)
    expect(imagem.data[8]).toBe(255)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/lib/ocr/preprocessarImagem.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar**

```ts
// src/lib/ocr/preprocessarImagem.ts

export interface ImagemEmMemoria {
  data: Uint8ClampedArray
  width: number
  height: number
}

/**
 * Converte pra escala de cinza e estica o contraste (normalização min-max):
 * a luminância mais escura do bitmap vira preto, a mais clara vira branco, o
 * resto escala linearmente entre os dois. PDF escaneado costuma sair com
 * contraste baixo (cinza sobre cinza, sombra de scanner) — esticar isso
 * ajuda o `tesseract.js` a separar traço de caractere do fundo.
 *
 * Não é binarização de verdade (preto/branco puro, tipo Otsu) — mais
 * simples e já suficiente pro ganho que dá; binarização propriamente dita
 * fica como melhoria futura se isso não bastar.
 */
export function binarizarEContrastar(imagem: ImagemEmMemoria): void {
  const { data, width, height } = imagem
  const totalPixels = width * height
  const luminancias = new Float64Array(totalPixels)

  let min = 255
  let max = 0
  for (let i = 0; i < totalPixels; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    // Luminância perceptual (ITU-R BT.601) — fórmula padrão de conversão
    // pra escala de cinza em processamento de imagem.
    const luminancia = 0.299 * r + 0.587 * g + 0.114 * b
    luminancias[i] = luminancia
    if (luminancia < min) min = luminancia
    if (luminancia > max) max = luminancia
  }

  const amplitude = max - min
  if (amplitude === 0) return // página em branco/uniforme — nada pra esticar

  for (let i = 0; i < totalPixels; i++) {
    const esticado = ((luminancias[i] - min) / amplitude) * 255
    data[i * 4] = esticado
    data[i * 4 + 1] = esticado
    data[i * 4 + 2] = esticado
    // data[i*4+3] (alpha) preservado — não é tocado.
  }
}
```

- [ ] **Step 4: Rodar de novo — passa**

Run: `npx jest src/lib/ocr/preprocessarImagem.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: binarizarEContrastar — pré-processamento de imagem pro OCR

Função pura sobre ImageData (grayscale + contrast stretch min-max) —
testável sem canvas real (jsdom não tem o pacote canvas instalado).
Ainda não conectada ao OCR de verdade — isso é a Task 8."
```

---

### Task 8: `depsOcrPadrao.ts` — escala maior, pré-processamento, e `reconhecer` devolve palavras

**Files:**
- Modify: `src/lib/ocr/depsOcrPadrao.ts`
- Modify: `src/lib/ocr/rodarOcr.ts` (interface `DepsRodarOcr`)
- Modify: `src/lib/ocr/rodarOcr.test.ts`
- Modify: `src/app/propostas-comerciais/[id]/ocr-runner.test.tsx` (mocks de `deps`)

**Interfaces:**
- Produces: `interface PalavraReconhecidaOcr { texto: string; x: number; largura: number; y: number
  }`, `interface ResultadoReconhecimento { texto: string; palavras: PalavraReconhecidaOcr[] }`.
  `DepsRodarOcr.reconhecer` passa de `(imagem: string) => Promise<string>` pra `(imagem: string) =>
  Promise<ResultadoReconhecimento>`.

- [ ] **Step 1: Atualizar `DepsRodarOcr` em `rodarOcr.ts`**

```ts
// src/lib/ocr/rodarOcr.ts — só a interface muda nesta task; o corpo de
// rodarOcrEmBlocos que consome o resultado é a Task 10.
export interface PalavraReconhecidaOcr {
  texto: string
  x: number
  largura: number
  y: number
}

export interface ResultadoReconhecimento {
  texto: string
  palavras: PalavraReconhecidaOcr[]
}

export interface DepsRodarOcr {
  renderizarPagina: (arquivoId: string, pagina: number) => Promise<string>
  reconhecer: (imagemDataUrl: string) => Promise<ResultadoReconhecimento>
  onProgresso?: (p: ProgressoOcr) => void
}
```

- [ ] **Step 2: Atualizar os mocks de `reconhecer` em `rodarOcr.test.ts` e `ocr-runner.test.tsx`**

Em `rodarOcr.test.ts`, troque cada `reconhecer: jest.fn().mockResolvedValue('Texto reconhecido.')`
por `reconhecer: jest.fn().mockResolvedValue({ texto: 'Texto reconhecido.', palavras: [] })` (idem
pros `mockResolvedValueOnce('Página um.')` → `mockResolvedValueOnce({ texto: 'Página um.', palavras:
[] })`, e mesma troca em `ocr-runner.test.tsx`). Não muda mais nada nesses dois arquivos nesta task
— a Task 10 é que muda o que `rodarOcrEmBlocos` FAZ com o resultado (por isso `palavras: []` — sem
corredor detectável, cai no fallback de texto corrido, comportamento igual ao de hoje).

- [ ] **Step 3: Rodar — falha (implementação ainda não devolve o formato novo)**

Run: `npx jest src/lib/ocr/rodarOcr.test.ts "src/app/propostas-comerciais/\[id\]/ocr-runner.test.tsx"`
Expected: FAIL — type error / mock não bate com o que `depsOcrPadrao.ts` de verdade devolveria (mas
como esses dois arquivos SEMPRE usam `deps` mockado — nunca o `depsOcrPadrao.ts` real — o que falha
aqui é só o `tsc`/shape do mock contra a interface nova; rode `npx tsc --noEmit` pra confirmar o
motivo antes de prosseguir).

- [ ] **Step 4: Implementar em `depsOcrPadrao.ts`**

```ts
// src/lib/ocr/depsOcrPadrao.ts
import type { DepsRodarOcr, ResultadoReconhecimento } from './rodarOcr'
import { binarizarEContrastar } from './preprocessarImagem'

/** Escala de renderização da página pro OCR — 1 ponto de PDF = 1/72 polegada,
 *  então escala × 72 = DPI efetivo. 300 DPI é o valor oficialmente
 *  recomendado pela documentação do Tesseract pra melhor acurácia
 *  (https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html) — não é
 *  medido contra um corpus deste projeto (mesma ressalva de
 *  `LIMIAR_CHARS_PAGINA_IMAGEM` em pdfHtml.ts); ajustar com cautela.
 *  300/72 ≈ 4.17, arredondado pra 4 (300 DPI ainda dentro da faixa
 *  recomendada, sem gerar bitmap desproporcionalmente grande). */
const ESCALA_RENDER_OCR = 4

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
    const viewport = page.getViewport({ scale: ESCALA_RENDER_OCR })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const contexto = canvas.getContext('2d')
    if (!contexto) throw new Error('não foi possível criar o contexto de canvas')
    await page.render({ canvas, canvasContext: contexto, viewport }).promise

    const imageData = contexto.getImageData(0, 0, canvas.width, canvas.height)
    binarizarEContrastar(imageData)
    contexto.putImageData(imageData, 0, 0)

    return canvas.toDataURL('image/png')
  }

  let workerPromise: ReturnType<typeof criarWorker> | null = null
  async function criarWorker() {
    const { createWorker } = await import('tesseract.js')
    return createWorker('por')
  }
  async function reconhecer(imagemDataUrl: string): Promise<ResultadoReconhecimento> {
    if (!workerPromise) workerPromise = criarWorker()
    const worker = await workerPromise
    // `{ blocks: true }` é o que faz o tesseract.js devolver
    // `data.blocks[].paragraphs[].lines[].words[]` com bounding box por
    // palavra — sem isso `data.blocks` vem `null` (só o texto corrido em
    // `data.text`, que é o que o projeto já usava antes desta fase).
    const { data } = await worker.recognize(imagemDataUrl, {}, { blocks: true })
    const palavras = (data.blocks ?? []).flatMap((bloco) =>
      bloco.paragraphs.flatMap((paragrafo) =>
        paragrafo.lines.flatMap((linha) =>
          linha.words.map((palavra) => ({
            texto: palavra.text,
            x: palavra.bbox.x0,
            largura: palavra.bbox.x1 - palavra.bbox.x0,
            y: palavra.bbox.y0,
          }))
        )
      )
    )
    return { texto: data.text.trim(), palavras }
  }

  return { renderizarPagina, reconhecer }
}
```

- [ ] **Step 5: Rodar de novo — passa**

Run: `npx jest src/lib/ocr "src/app/propostas-comerciais/\[id\]/ocr-runner.test.tsx"`
Expected: PASS (esses testes mockam `deps` por completo — `depsOcrPadrao.ts` real não é exercitado
por eles, mas agora bate com a interface).

- [ ] **Step 6: `npx tsc --noEmit`**

Expected: limpo.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: depsOcrPadrao renderiza em 300 DPI e devolve palavra por posição

Escala de renderização sobe de 2 pra 4 (144 -> 300 DPI, recomendação
oficial do Tesseract). binarizarEContrastar (Task 7) roda em cima do
ImageData antes do reconhecimento. recognize() passa { blocks: true }
pra devolver bounding box por palavra — reconhecer() devolve
{ texto, palavras } em vez de string crua, base pra reconstrução de
tabela (Task 9)."
```

---

### Task 9: `tabelaPorPosicaoOcr.ts` — reconstrói tabela a partir das palavras do OCR

**Files:**
- Create: `src/lib/ocr/tabelaPorPosicaoOcr.ts`
- Create: `src/lib/ocr/tabelaPorPosicaoOcr.test.ts`

**Interfaces:**
- Consumes: `corredoresDoBloco` (Task 6), `montarTabelaHtml` (já exportado de
  `src/lib/extracao/pdfHtml.ts`), `PalavraReconhecidaOcr` (Task 8).
- Produces: `reconstruirTabelaOcr(palavras: PalavraReconhecidaOcr[]): string | null` — devolve HTML
  de `<table>` quando reconhece padrão de coluna, `null` quando não (quem chama cai pro fallback de
  texto corrido).

- [ ] **Step 1: Escrever os testes**

```ts
// src/lib/ocr/tabelaPorPosicaoOcr.test.ts
import { reconstruirTabelaOcr } from './tabelaPorPosicaoOcr'
import type { PalavraReconhecidaOcr } from './rodarOcr'

function palavra(texto: string, x: number, largura: number, y: number): PalavraReconhecidaOcr {
  return { texto, x, largura, y }
}

describe('reconstruirTabelaOcr', () => {
  it('devolve null quando não há palavra nenhuma', () => {
    expect(reconstruirTabelaOcr([])).toBeNull()
  })

  it('devolve null quando só tem uma linha (sem corredor pra confirmar)', () => {
    const palavras = [palavra('Item', 10, 40, 100), palavra('Valor', 120, 40, 100)]
    expect(reconstruirTabelaOcr(palavras)).toBeNull()
  })

  it('reconstrói tabela quando duas colunas se alinham em pelo menos duas linhas', () => {
    const palavras = [
      palavra('Item', 10, 40, 100),
      palavra('Valor', 200, 40, 100),
      palavra('Storage', 10, 60, 60),
      palavra('R$100', 200, 50, 60),
    ]

    const html = reconstruirTabelaOcr(palavras)

    expect(html).toBe(
      '<table><thead><tr><th>Item</th><th>Valor</th></tr></thead>' +
        '<tbody><tr><td>Storage</td><td>R$100</td></tr></tbody></table>'
    )
  })

  it('devolve null pra texto corrido sem coluna nenhuma (parágrafo comum)', () => {
    const palavras = [
      palavra('Texto', 10, 40, 100),
      palavra('corrido', 55, 50, 100),
      palavra('sem', 10, 30, 60),
      palavra('coluna', 45, 50, 60),
    ]

    expect(reconstruirTabelaOcr(palavras)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/lib/ocr/tabelaPorPosicaoOcr.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar**

```ts
// src/lib/ocr/tabelaPorPosicaoOcr.ts
import { corredoresDoBloco, type LinhaPosicionada } from '../extracao/corredores'
import { montarTabelaHtml } from '../extracao/pdfHtml'
import type { PalavraReconhecidaOcr } from './rodarOcr'

/** Diferença máxima de Y (em pixels do canvas renderizado, escala 4 — ver
 *  `ESCALA_RENDER_OCR` em depsOcrPadrao.ts) pra duas palavras contarem como
 *  a MESMA linha. Não medido contra um corpus de página escaneada real
 *  (mesma ressalva de `TOLERANCIA_MESMA_LINHA` em pdfHtml.ts, que é o
 *  equivalente calibrado pro PDF nativo, em pontos em vez de pixels);
 *  ajustar com cautela se `ESCALA_RENDER_OCR` mudar. */
const TOLERANCIA_MESMA_LINHA_PX = 16

/** Largura mínima (em pixels) de um corredor vertical vazio pra virar
 *  separação de coluna — mesmo princípio de `LARGURA_MINIMA_CORREDOR` em
 *  pdfHtml.ts, em pixels de canvas em vez de pontos de PDF (OCR não tem
 *  acesso à coordenada de ponto do PDF original, só ao bitmap renderizado). */
const LARGURA_MINIMA_CORREDOR_PX = 48

function agruparEmLinhas(palavras: PalavraReconhecidaOcr[]): PalavraReconhecidaOcr[][] {
  const ordenadas = [...palavras].sort((a, b) => a.y - b.y || a.x - b.x)
  const linhas: PalavraReconhecidaOcr[][] = []
  for (const palavra of ordenadas) {
    const ultima = linhas[linhas.length - 1]
    if (ultima && Math.abs(ultima[0].y - palavra.y) <= TOLERANCIA_MESMA_LINHA_PX) {
      ultima.push(palavra)
    } else {
      linhas.push([palavra])
    }
  }
  return linhas.map((linha) => [...linha].sort((a, b) => a.x - b.x))
}

function paraLinhaPosicionada(linha: PalavraReconhecidaOcr[]): LinhaPosicionada {
  return { itens: linha.map((p) => ({ x: p.x, width: p.largura })) }
}

function linhaParaColunas(linha: PalavraReconhecidaOcr[], divisores: number[]): string[] {
  const colunas: string[] = Array(divisores.length + 1).fill('')
  for (const palavra of linha) {
    const indice = divisores.filter((divisor) => palavra.x >= divisor).length
    colunas[indice] = colunas[indice] ? `${colunas[indice]} ${palavra.texto}` : palavra.texto
  }
  return colunas
}

/**
 * Reconstrói uma tabela HTML a partir da posição das palavras reconhecidas
 * pelo OCR — mesmo princípio geométrico de `absorverTabelaPorPosicao` em
 * pdfHtml.ts (corredor vertical vazio que atravessa várias linhas), só que
 * a fonte de posição é o bounding box do `tesseract.js` em vez da posição
 * de texto nativo do PDF. Devolve `null` quando não reconhece padrão de
 * coluna nenhum — quem chama cai pro texto corrido (comportamento de hoje).
 */
export function reconstruirTabelaOcr(palavras: PalavraReconhecidaOcr[]): string | null {
  if (palavras.length === 0) return null

  const linhas = agruparEmLinhas(palavras)
  if (linhas.length < 2) return null

  const corredores = corredoresDoBloco(linhas.map(paraLinhaPosicionada), LARGURA_MINIMA_CORREDOR_PX)
  if (corredores.length === 0) return null

  const divisores = corredores.map((c) => (c.inicio + c.fim) / 2).sort((a, b) => a - b)
  const celulas = linhas.map((linha) => linhaParaColunas(linha, divisores))
  return montarTabelaHtml(celulas)
}
```

- [ ] **Step 4: Rodar de novo — passa**

Run: `npx jest src/lib/ocr/tabelaPorPosicaoOcr.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: reconstruirTabelaOcr — tabela a partir da posição das palavras do OCR

Reaproveita corredoresDoBloco (Task 6) e montarTabelaHtml, já
existentes e testados pro PDF nativo — mesmo princípio geométrico,
fonte de posição diferente. Ainda não conectada ao runner de OCR de
verdade — isso é a Task 10."
```

---

### Task 10: `rodarOcr.ts` monta o corpo com tabela reconstruída ou parágrafos

**Files:**
- Modify: `src/lib/ocr/rodarOcr.ts`
- Modify: `src/lib/ocr/rodarOcr.test.ts`

**Interfaces:**
- Consumes: `reconstruirTabelaOcr` (Task 9), `escaparHtml` (`src/lib/extracao/escaparHtml.ts`, já
  existe desde a Fase 1).

- [ ] **Step 1: Atualizar os testes existentes pro novo formato de corpo**

Os 4 testes de `rodarOcr.test.ts` (da Fase 1) mockam `reconhecer` devolvendo `{ texto, palavras: []
}` — com `palavras` vazio, `reconstruirTabelaOcr` sempre devolve `null`, então cai no fallback de
texto corrido. Ajuste as asserções que checam o corpo exato:

```ts
// 'reconhece cada página pendente e preenche o corpo, mantendo o wrapper'
const reconhecer = jest.fn().mockResolvedValue({ texto: 'Texto reconhecido.', palavras: [] })
// ...
expect(resultado).toBe(
  '<p>X</p>' +
    '<div class="ocr-pendente" data-arquivo-id="a1" data-pagina="1"><p>Texto reconhecido.</p></div>' +
    '<p>Y</p>'
)
```

(era `'...Texto reconhecido.</div>...'` sem `<p>` — agora o texto corrido vira parágrafo(s), não
mais texto solto dentro do `<div>`.) Ajuste também o teste de "Conferi este trecho" (Task 3 do plano
da Fase 1, arquivo `ocr-runner.test.tsx`) da mesma forma:
`toHaveBeenLastCalledWith('<p>X</p><p>Texto reconhecido.</p><p>Y</p>')`.

Adicione um teste novo cobrindo a reconstrução de tabela:

```ts
it('reconstrói tabela quando o OCR devolve palavras com padrão de coluna', async () => {
  const html = '<div class="ocr-pendente" data-arquivo-id="a1" data-pagina="1"><p><em>(aguardando OCR)</em></p></div>'
  const renderizarPagina = jest.fn().mockResolvedValue('img')
  const reconhecer = jest.fn().mockResolvedValue({
    texto: 'Item Valor\nStorage R$100',
    palavras: [
      { texto: 'Item', x: 10, largura: 40, y: 100 },
      { texto: 'Valor', x: 200, largura: 40, y: 100 },
      { texto: 'Storage', x: 10, largura: 60, y: 60 },
      { texto: 'R$100', x: 200, largura: 50, y: 60 },
    ],
  })

  const resultado = await rodarOcrEmBlocos(html, { renderizarPagina, reconhecer })

  expect(resultado).toContain('<table>')
  expect(resultado).toContain('<td>Storage</td><td>R$100</td>')
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/lib/ocr/rodarOcr.test.ts`
Expected: FAIL — implementação ainda não monta `<p>`/`<table>`, só substitui o corpo pelo texto cru.

- [ ] **Step 3: Implementar**

```ts
// src/lib/ocr/rodarOcr.ts
import { listarBlocosOcrPendente, substituirCorpo } from './marcadorOcrPendente'
import { reconstruirTabelaOcr } from './tabelaPorPosicaoOcr'
import { escaparHtml } from '../extracao/escaparHtml'

export interface ProgressoOcr {
  pagina: number
  total: number
}

export interface PalavraReconhecidaOcr {
  texto: string
  x: number
  largura: number
  y: number
}

export interface ResultadoReconhecimento {
  texto: string
  palavras: PalavraReconhecidaOcr[]
}

export interface DepsRodarOcr {
  renderizarPagina: (arquivoId: string, pagina: number) => Promise<string>
  reconhecer: (imagemDataUrl: string) => Promise<ResultadoReconhecimento>
  onProgresso?: (p: ProgressoOcr) => void
}

/** Monta o corpo HTML do bloco a partir do resultado do reconhecimento:
 *  tenta reconstruir tabela pela posição das palavras primeiro (mais fiel
 *  quando o padrão de coluna é reconhecível); sem padrão, cai pra um
 *  parágrafo por linha de texto reconhecida — texto bruto do OCR é
 *  escapado (nunca confiar em `&`/`</>` vindos de reconhecimento de
 *  caractere). */
function montarCorpoDoOcr(resultado: ResultadoReconhecimento): string {
  const tabela = reconstruirTabelaOcr(resultado.palavras)
  if (tabela) return tabela

  return resultado.texto
    .split('\n')
    .filter((linha) => linha.trim().length > 0)
    .map((linha) => `<p>${escaparHtml(linha.trim())}</p>`)
    .join('')
}

/**
 * Roda o OCR de TODOS os blocos `.ocr-pendente` do HTML, um a um,
 * preenchendo o corpo de cada um com o texto (ou tabela) reconhecido — o
 * wrapper continua lá, a conferência humana é um passo separado (ver
 * `marcadorOcrPendente.ts`, `removerWrapper`). Erro numa página vira um
 * aviso só naquela página; as outras seguem normalmente.
 */
export async function rodarOcrEmBlocos(html: string, deps: DepsRodarOcr): Promise<string> {
  const blocos = listarBlocosOcrPendente(html)
  let atual = html

  for (const [indice, bloco] of blocos.entries()) {
    deps.onProgresso?.({ pagina: indice + 1, total: blocos.length })
    try {
      if (!bloco.arquivoId) throw new Error('bloco de OCR sem arquivoId')
      const imagem = await deps.renderizarPagina(bloco.arquivoId, bloco.pagina)
      const resultado = await deps.reconhecer(imagem)
      atual = substituirCorpo(atual, bloco, montarCorpoDoOcr(resultado))
    } catch {
      atual = substituirCorpo(
        atual,
        bloco,
        '<p><em>(OCR falhou nesta página — transcreva manualmente a partir do original)</em></p>'
      )
    }
  }

  return atual
}
```

- [ ] **Step 4: Rodar de novo — passa**

Run: `npx jest src/lib/ocr/rodarOcr.test.ts "src/app/propostas-comerciais/\[id\]/ocr-runner.test.tsx"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: rodarOcrEmBlocos reconstrói tabela ou monta parágrafo por linha

Antes: corpo do bloco virava o texto cru do tesseract.js, sem
formatação nenhuma (parede de texto). Agora: tenta reconstruir
<table> pela posição das palavras (Task 9); sem padrão de coluna,
cada linha reconhecida vira <p> separado, escapado. Fecha o ganho de
fidelidade que motivou o pré-processamento e a reconstrução de
tabela desta fase."
```

---

### Task 11: Cobertura estendida — imagem embutida em página de texto também vira `.ocr-pendente`

**Files:**
- Modify: `src/lib/extracao/pdfHtml.ts`
- Modify: `src/lib/extracao/pdfHtml.test.ts`

**Interfaces:** nenhuma nova — reaproveita `formatarBlocoOcrPendente` (já existente) no lugar de
montar `<img>` direto pras imagens de `paginasComImagem`.

- [ ] **Step 1: Atualizar o teste de `paginasComImagem` existente e adicionar um caso de HTML**

Em `pdfHtml.test.ts`, no `describe('paginasComImagem ...')`, o teste "página com imagem de conteúdo
entra em paginasComImagem" continua válido sem mudança (`paginasComImagem` como lista de números não
muda). Adicione um teste novo checando o HTML gerado:

```ts
it('imagem de conteúdo (página com texto normal) vira marcador de OCR pendente, não <img> muda', async () => {
  ;(extractTextItems as jest.Mock).mockResolvedValue({
    totalPages: 1,
    items: [[item({ str: 'Texto normal da página, com bastante conteúdo textual.', x: 0, hasEOL: true })]],
  })
  ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([{ segmentos: [], fracaoAreaComImagem: 0 }])
  ;(extrairImagensDeConteudo as jest.Mock).mockResolvedValue([
    {
      pagina: 0,
      x: 0,
      y: 0,
      largura: 200,
      altura: 150,
      topo: 700,
      larguraPx: 400,
      alturaPx: 300,
      nomeArquivo: 'pagina-1-imagem-1.png',
      png: Buffer.from(''),
    },
  ])

  const resultado = await converterPdfParaHtml(Buffer.from(''), {
    salvarImagem: async () => 'https://storage.exemplo/img.png',
  })

  expect(resultado.html).toContain('<div class="ocr-pendente" data-pagina="1">')
  expect(resultado.html).not.toContain('<img')
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/lib/extracao/pdfHtml.test.ts -t "marcador de OCR pendente, não"`
Expected: FAIL — hoje ainda vira `<img>`.

- [ ] **Step 3: Implementar — trocar `imagem.html` (o `<img>`) por um marcador quando a página está
  em `paginasComImagem`**

```ts
// dentro de converterPdfParaHtml, logo depois de calcular paginasComImagem:
const imagensParaOcr = imagensFiltradas.map((imagem): ImagemPosicionada =>
  paginasComImagemSet.has(imagem.pagina + 1)
    ? { pagina: imagem.pagina, topo: imagem.topo, html: formatarBlocoOcrPendente(imagem.pagina + 1) }
    : imagem
)
```

Isso exige guardar `paginasComImagem` como `Set` ANTES de virar array ordenado (hoje só existe como
array, criado depois de `imagensFiltradas` já estar pronto) — reordene a Task assim: calcule
`paginasComImagemSet` a partir de `imagensFiltradas` primeiro, transforme `imagensFiltradas` em
`imagensParaOcr` (a troca acima), e só DEPOIS derive `paginasComImagem` (array ordenado, pro campo
de retorno) a partir do mesmo `Set` — mesmo valor de sempre, só a ordem de cálculo muda:

```ts
// substitua o bloco atual (linhas ~269-273 de pdfHtml.ts) por:
const imagensFiltradas = imagens.filter((imagem) => !paginasImagem0.has(imagem.pagina))
const paginasComImagemSet = new Set(imagensFiltradas.map((imagem) => imagem.pagina + 1))
const paginasComImagem = [...paginasComImagemSet].sort((a, b) => a - b)
// Imagem de conteúdo numa página de texto normal deixa de virar <img> muda —
// entra no mesmo fluxo de OCR + conferência das páginas escaneadas (só que
// sem discutir o resto do texto da página, que já está certo).
const imagensParaOcr: ImagemPosicionada[] = imagensFiltradas.map((imagem) =>
  paginasComImagemSet.has(imagem.pagina + 1)
    ? { pagina: imagem.pagina, topo: imagem.topo, html: formatarBlocoOcrPendente(imagem.pagina + 1) }
    : imagem
)
```

E troque as DUAS chamadas seguintes de `montarHtml(...)`/`imagensFiltradas.map((imagem) =>
imagem.html)` (linha 300 e a passada como argumento em `montarHtml`, linha 312) pra usar
`imagensParaOcr` em vez de `imagensFiltradas`.

**Nota (ver Global Constraints):** o marcador criado aqui aponta pra PÁGINA INTEIRA — ao rodar OCR
nele, `renderizarPagina`/`reconhecer` processam a página toda, não só a região da imagem. Isso é uma
simplificação deliberada: sem recorte por região, o texto reconhecido pode repetir conteúdo que já
está certo no resto da página (texto nativo já extraído normalmente) — a conferência humana
obrigatória descarta a repetição. Recorte preciso fica como melhoria futura.

- [ ] **Step 4: Rodar de novo — passa**

Run: `npx jest src/lib/extracao/pdfHtml.test.ts -i`
Expected: PASS — inclusive os testes antigos de imagem embutida (`describe('imagens do PDF no
HTML')`), que usam páginas SEM texto real ao redor (`paginasImagem`, não `paginasComImagem`) e por
isso continuam produzindo `<img>` normalmente, sem entrar neste caminho novo.

- [ ] **Step 5: Rodar a suíte completa do projeto**

Run: `npx jest`
Expected: PASS em tudo.
Run: `npx tsc --noEmit`
Expected: limpo.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: imagem de conteúdo em página de texto vira marcador de OCR pendente

Antes: tabela/gráfico que veio como imagem embutida numa página de
texto normal virava <img> muda, sem nenhum texto extraído (só um
aviso no painel de checagem). Agora entra no mesmo fluxo de OCR +
conferência humana das páginas 100% escaneadas — sem discutir o resto
do texto da página, que já está certo. Simplificação deliberada: OCR
roda na página inteira, sem recorte por região (ver nota na Task 11
do plano) — a conferência descarta eventual repetição.

Fecha a Fase 3 da migração pra HTML nativo. Ver
docs/superpowers/specs/2026-09-14-html-nativo-ocr-proposta-comercial-design.md."
```

---

## Roteiro restante (não incluído neste plano)

- **Fase 4 — Checagem por IA + aplicação de correção (MAIOR RISCO):** `checarConversao.ts`
  (`semMarcacaoMarkdown` → remoção de tag HTML, todos os guard-rails re-verificados),
  `mudancasTexto.ts` (não lido até agora — faz busca/substituição literal de trecho no documento pra
  aplicar/desfazer correção da IA) e `painel-checagem-conversao.tsx` (1582 linhas). Ler
  `mudancasTexto.ts`, `lista-mudancas.tsx` e `janela-revisao.tsx` por completo antes de escrever o
  plano desta fase.
- **Fase 5 — Migração de banco:** rename `PropostaComercial.conteudoMarkdown` → `conteudoHtml`
  (migration Prisma), script one-shot `scripts/migrar-markdown-para-html.mts` pro dado já em
  produção.

## Self-Review

**Cobertura da spec:** seção 2 (editor/render/copy) coberta pelas Tasks 1-5; seção 4 (OCR — pré-
processamento, reconstrução de tabela, cobertura estendida) coberta pelas Tasks 6-11. Seção 3
(checagem por IA) fica pra Fase 4, fora deste plano — reafirmado no roteiro acima.

**Placeholder scan:** nenhum "TBD"/"implementar depois". A Task 11 inclui uma limitação deliberada
(sem recorte por região) — documentada como decisão de escopo, não como trabalho faltando.

**Consistência de tipo:** `ResultadoReconhecimento`/`PalavraReconhecidaOcr` definidos na Task 8
(interface em `rodarOcr.ts`) e consumidos com o mesmo formato nas Tasks 9 e 10.
`LinhaPosicionada`/`ItemPosicionado`/`Intervalo` da Task 6 usados sem alteração pela Task 9.
`ImagemPosicionada.html` (Fase 1) usado consistentemente pela Task 11.
