# Edição visual da Proposta Comercial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a edição em Markdown cru da Proposta Comercial por edição direto no conteúdo renderizado (contentEditable), com uma saída de emergência em texto pra quando a edição visual não bastar.

**Architecture:** Um conversor DOM→Markdown novo (`htmlEditavelParaMarkdown`) normaliza o HTML bagunçado que o `contentEditable` do navegador produz e o transforma de volta em Markdown. Um componente `ConteudoEditavelProposta` mostra o Markdown renderizado num `div contentEditable`, debounça as mudanças e devolve Markdown pro componente pai — que segue sendo a fonte da verdade (mesmo padrão de hoje, só troca a `textarea` pelo editor visual). `EditorMarkdown` (rascunho) e `PropostaFinal` (concluído) passam a usar os mesmos dois componentes; o menu de "arquivos originais" é extraído pra um arquivo compartilhado pra não duplicar entre as duas telas.

**Tech Stack:** React 19 (Client Components), TypeScript, `marked` (Markdown→HTML já existente), DOM nativo (`DOMParser`, `contentEditable`) — sem biblioteca de editor nova.

## Global Constraints

- **Sem coautoria nos commits:** repo público — nunca `Co-Authored-By`/`Claude-Session`.
- **Zero IA nessa conversão:** HTML↔Markdown continua 100% determinístico.
- **Round-trip "melhor esforço":** estrutura e conteúdo preservados; não byte-idêntico.
- **Fora de escopo:** reestruturação (mover seção, add/remove linha de tabela), editor rich-text de biblioteca, colaboração em tempo real.
- **Arquivos WIP do usuário (não commitados):** `editor-markdown.tsx` e `editor-markdown.test.tsx` têm trabalho em andamento do usuário. Ao editá-los: SEMPRE ler o arquivo completo imediatamente antes de editar (nunca confiar em leitura antiga), usar `Edit` cirúrgico (nunca `Write` sobrescrevendo o arquivo inteiro), e nunca `git checkout`/`git restore` neles. `proposta-final.tsx` e `proposta-final.test.tsx` são commits desta feature em tasks anteriores — podem ser reescritos com `Write`.
- **Idioma:** código, comentários, mensagens de UI em português (pt-BR).
- **Testes:** `npm test` (Jest + Testing Library, ambiente jsdom padrão pra componentes).

---

## File Structure

**Criar:**
- `src/lib/propostaEditavel/htmlEditavelParaMarkdown.ts` — normalização + conversão DOM→Markdown.
- `src/lib/propostaEditavel/htmlEditavelParaMarkdown.test.ts`
- `src/app/propostas-comerciais/[id]/conteudo-editavel-proposta.tsx` — o `contentEditable`.
- `src/app/propostas-comerciais/[id]/conteudo-editavel-proposta.test.tsx`
- `src/app/propostas-comerciais/[id]/editar-como-texto.tsx` — escape hatch.
- `src/app/propostas-comerciais/[id]/editar-como-texto.test.tsx`
- `src/app/propostas-comerciais/[id]/arquivos-originais.tsx` — `MenuArquivosOriginais` + `ModalArquivoOriginal` extraídos de `editor-markdown.tsx`, compartilhados com `proposta-final.tsx`.

**Modificar:**
- `src/app/propostas-comerciais/[id]/editor-markdown.tsx` — usa os componentes novos no lugar das abas Visualizar/Editar texto; importa o menu de arquivos do arquivo extraído.
- `src/app/propostas-comerciais/[id]/editor-markdown.test.tsx` — só os testes que exercitavam a aba "Editar texto" removida (ver Task 5).
- `src/app/propostas-comerciais/[id]/proposta-final.tsx` — reescrito: editável sempre, "Salvar alterações" quando sujo, ganha o menu de arquivos, perde "Editar novamente".
- `src/app/propostas-comerciais/[id]/proposta-final.test.tsx` — reescrito.
- `src/app/propostas-comerciais/[id]/page.tsx` — remove `modoEdicao`; `PropostaFinal` ganha `arquivos` e `onSalvar`.

---

## Task 1: Conversor `htmlEditavelParaMarkdown`

**Files:**
- Create: `src/lib/propostaEditavel/htmlEditavelParaMarkdown.ts`
- Test: `src/lib/propostaEditavel/htmlEditavelParaMarkdown.test.ts`

**Interfaces:**
- Consumes: nada (usa `DOMParser`, disponível no ambiente jsdom dos testes e no navegador).
- Produces: `htmlEditavelParaMarkdown(html: string): string`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
import { htmlEditavelParaMarkdown } from './htmlEditavelParaMarkdown'

describe('htmlEditavelParaMarkdown', () => {
  it('converte títulos, negrito, itálico e parágrafo', () => {
    const html = '<h1>Título</h1><p>Texto <strong>forte</strong> e <em>itálico</em>.</p>'
    expect(htmlEditavelParaMarkdown(html)).toBe('# Título\n\nTexto **forte** e _itálico_.')
  })

  it('normaliza <b>/<i> como <strong>/<em>', () => {
    expect(htmlEditavelParaMarkdown('<p>Texto <b>forte</b> e <i>itálico</i>.</p>')).toBe(
      'Texto **forte** e _itálico_.'
    )
  })

  it('remove style e class de qualquer elemento', () => {
    expect(htmlEditavelParaMarkdown('<p style="color:red" class="x">Texto</p>')).toBe('Texto')
  })

  it('desembrulha <span> mantendo o texto', () => {
    expect(htmlEditavelParaMarkdown('<p>Antes <span style="color:red">colorido</span> depois.</p>')).toBe(
      'Antes colorido depois.'
    )
  })

  it('trata <div> de bloco solto como parágrafo (jeito comum do contentEditable criar linha nova)', () => {
    expect(htmlEditavelParaMarkdown('<div>Primeira linha</div><div>Segunda linha</div>')).toBe(
      'Primeira linha\n\nSegunda linha'
    )
  })

  it('converte lista não ordenada e ordenada', () => {
    expect(htmlEditavelParaMarkdown('<ul><li>Um</li><li>Dois</li></ul>')).toBe('- Um\n- Dois')
    expect(htmlEditavelParaMarkdown('<ol><li>Um</li><li>Dois</li></ol>')).toBe('1. Um\n2. Dois')
  })

  it('converte tabela com cabeçalho', () => {
    const html =
      '<table><thead><tr><th>Item</th><th>Valor</th></tr></thead><tbody><tr><td>A</td><td>10</td></tr></tbody></table>'
    expect(htmlEditavelParaMarkdown(html)).toBe('| Item | Valor |\n| --- | --- |\n| A | 10 |')
  })

  it('converte link', () => {
    expect(htmlEditavelParaMarkdown('<p><a href="https://x.com">link</a></p>')).toBe('[link](https://x.com)')
  })

  it('desembrulha .callout-divergencia mantendo o parágrafo interno', () => {
    expect(
      htmlEditavelParaMarkdown('<div class="callout-divergencia"><p>Divergência: teste.</p></div>')
    ).toBe('Divergência: teste.')
  })

  it('converte &nbsp; em espaço normal', () => {
    expect(htmlEditavelParaMarkdown('<p>Antes&nbsp;depois</p>')).toBe('Antes depois')
  })

  it('texto solto sem wrapper de bloco (digitado direto no editor vazio) vira parágrafo', () => {
    expect(htmlEditavelParaMarkdown('Texto solto')).toBe('Texto solto')
  })

  it('round-trip sem edição preserva o conteúdo', () => {
    const html = '<h2>Escopo</h2><p>Serviço de <strong>consultoria</strong>.</p>'
    expect(htmlEditavelParaMarkdown(html)).toBe('## Escopo\n\nServiço de **consultoria**.')
  })
})
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `npx jest htmlEditavelParaMarkdown`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar o conversor**

```ts
/**
 * Converte o HTML de um `contentEditable` de volta pra Markdown — a metade
 * inversa de `renderizarMarkdownProposta`. Diferente de
 * `src/lib/extracao/htmlMarkdown.ts` (feito pra saída regular do mammoth),
 * este é baseado em DOM porque o HTML que sai do `contentEditable` do
 * navegador é mais irregular (divs soltas, spans com style, b/i em vez de
 * strong/em) e precisa de uma normalização antes de virar Markdown.
 *
 * Round-trip "melhor esforço": conteúdo e estrutura preservados, não
 * byte-idêntico.
 */
export function htmlEditavelParaMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(`<div id="raiz">${html}</div>`, 'text/html')
  const raiz = doc.getElementById('raiz')!
  normalizar(raiz)
  return converterFilhos(raiz)
}

function normalizar(raiz: HTMLElement): void {
  const doc = raiz.ownerDocument

  // Desembrulha o callout de divergência — o texto "Divergência:" já basta
  // pra `renderizarMarkdownProposta` recriar o callout na próxima renderização.
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
    no.textContent = (no.textContent ?? '').replace(/\u00A0/g, ' ')
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

function escaparInlineMarkdown(texto: string): string {
  return texto.replace(/([*_`])/g, '\\$1')
}

function inline(no: Node): string {
  if (no.nodeType === 3) return escaparInlineMarkdown(no.textContent ?? '')
  const el = no as Element
  const tag = el.tagName.toLowerCase()
  if (tag === 'br') return '  \n'
  const conteudo = Array.from(el.childNodes).map(inline).join('')
  switch (tag) {
    case 'strong':
      return conteudo.trim() ? `**${conteudo}**` : conteudo
    case 'em':
      return conteudo.trim() ? `_${conteudo}_` : conteudo
    case 'a': {
      const href = el.getAttribute('href') ?? ''
      return href ? `[${conteudo}](${href})` : conteudo
    }
    default:
      return conteudo
  }
}

function inlineDoElemento(el: Element): string {
  return Array.from(el.childNodes).map(inline).join('').trim()
}

function converterLista(el: Element, ordenada: boolean, nivel: number): string {
  const indentacao = '  '.repeat(nivel)
  const itens = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'li')
  return itens
    .map((li, indice) => {
      const sublistas = Array.from(li.children).filter((c) => ['ul', 'ol'].includes(c.tagName.toLowerCase()))
      const conteudo = Array.from(li.childNodes)
        .filter((n) => !(n.nodeType === 1 && ['ul', 'ol'].includes((n as Element).tagName.toLowerCase())))
        .map(inline)
        .join('')
        .trim()
      const marcador = ordenada ? `${indice + 1}.` : '-'
      let linha = `${indentacao}${marcador} ${conteudo}`
      for (const sub of sublistas) {
        const md = converterLista(sub, sub.tagName.toLowerCase() === 'ol', nivel + 1)
        if (md) linha += `\n${md}`
      }
      return linha
    })
    .join('\n')
}

function escaparCelulaTabela(texto: string): string {
  return texto.replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim()
}

function converterTabela(el: Element): string {
  const linhas = Array.from(el.querySelectorAll('tr'))
  if (linhas.length === 0) return ''

  const celulasPorLinha = linhas.map((tr) =>
    Array.from(tr.children)
      .filter((c) => ['td', 'th'].includes(c.tagName.toLowerCase()))
      .map((c) => escaparCelulaTabela(inlineDoElemento(c)))
  )
  const numColunas = Math.max(...celulasPorLinha.map((l) => l.length))

  function normalizarLinha(linha: string[]): string {
    const celulas = [...linha]
    while (celulas.length < numColunas) celulas.push('')
    return `| ${celulas.join(' | ')} |`
  }

  const [cabecalho, ...resto] = celulasPorLinha
  const separador = `| ${Array(numColunas).fill('---').join(' | ')} |`
  return [normalizarLinha(cabecalho), separador, ...resto.map(normalizarLinha)].join('\n')
}

function converterBloco(el: Element): string {
  const tag = el.tagName.toLowerCase()
  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return `${'#'.repeat(Number(tag[1]))} ${inlineDoElemento(el)}`
    case 'p':
      return inlineDoElemento(el)
    case 'ul':
      return converterLista(el, false, 0)
    case 'ol':
      return converterLista(el, true, 0)
    case 'table':
      return converterTabela(el)
    case 'hr':
      return '---'
    default:
      // tag de bloco desconhecida (ex.: sobrou algum <div> aninhado) — desce
      // só pro conteúdo.
      return converterFilhos(el)
  }
}

function converterFilhos(raiz: Element): string {
  const blocos: string[] = []
  for (const no of Array.from(raiz.childNodes)) {
    if (no.nodeType === 3) {
      const texto = escaparInlineMarkdown(no.textContent ?? '').trim()
      if (texto) blocos.push(texto)
      continue
    }
    const bloco = converterBloco(no as Element).trim()
    if (bloco) blocos.push(bloco)
  }
  return blocos.join('\n\n')
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `npx jest htmlEditavelParaMarkdown`
Expected: PASS (12 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/propostaEditavel/htmlEditavelParaMarkdown.ts src/lib/propostaEditavel/htmlEditavelParaMarkdown.test.ts
git commit -m "feat: conversor DOM de html editavel para markdown"
```

---

## Task 2: `ConteudoEditavelProposta`

**Files:**
- Create: `src/app/propostas-comerciais/[id]/conteudo-editavel-proposta.tsx`
- Test: `src/app/propostas-comerciais/[id]/conteudo-editavel-proposta.test.tsx`

**Interfaces:**
- Consumes: `renderizarMarkdownProposta` (`@/lib/renderizarMarkdownProposta`), `htmlEditavelParaMarkdown` (Task 1).
- Produces: `ConteudoEditavelProposta({ markdown, onChange }: { markdown: string; onChange: (markdown: string) => void })` — `div[role="textbox"]` com `aria-label="Conteúdo da proposta"`.

- [ ] **Step 1: Escrever os testes que falham**

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

  it('renderiza o markdown inicial formatado', () => {
    render(<ConteudoEditavelProposta markdown="# Título" onChange={jest.fn()} />)
    expect(screen.getByRole('heading', { name: 'Título' })).toBeInTheDocument()
  })

  it('chama onChange (com debounce) com o markdown convertido depois de digitar', () => {
    const onChange = jest.fn()
    render(<ConteudoEditavelProposta markdown="# Título" onChange={onChange} />)

    const editor = pegarEditor()
    editor.innerHTML = '<h1>Título editado</h1>'
    fireEvent.input(editor)

    expect(onChange).not.toHaveBeenCalled()
    act(() => {
      jest.advanceTimersByTime(400)
    })
    expect(onChange).toHaveBeenCalledWith('# Título editado')
  })

  it('não refaz o HTML quando o markdown muda por causa do próprio onChange (evita cursor pular)', () => {
    const onChange = jest.fn()
    const { rerender } = render(<ConteudoEditavelProposta markdown="# Título" onChange={onChange} />)

    const editor = pegarEditor()
    editor.innerHTML = '<h1>Digitando</h1>'
    fireEvent.input(editor)
    act(() => {
      jest.advanceTimersByTime(400)
    })

    // o pai reage ao onChange e devolve o mesmo markdown como prop —
    // não deve sobrescrever o innerHTML que o usuário está digitando.
    rerender(<ConteudoEditavelProposta markdown="# Digitando" onChange={onChange} />)
    expect(editor.innerHTML).toBe('<h1>Digitando</h1>')
  })

  it('refaz o HTML quando o markdown muda por uma fonte externa', () => {
    const onChange = jest.fn()
    const { rerender } = render(<ConteudoEditavelProposta markdown="# Título" onChange={onChange} />)

    rerender(<ConteudoEditavelProposta markdown="# Corrigido pela IA" onChange={onChange} />)

    expect(screen.getByRole('heading', { name: 'Corrigido pela IA' })).toBeInTheDocument()
  })

  it('colar insere só texto puro, sem HTML/estilo', () => {
    document.execCommand = jest.fn()
    render(<ConteudoEditavelProposta markdown="# Título" onChange={jest.fn()} />)

    const editor = pegarEditor()
    const clipboardData = { getData: (tipo: string) => (tipo === 'text/plain' ? 'texto colado' : '<b>html</b>') }
    fireEvent.paste(editor, { clipboardData })

    expect(document.execCommand).toHaveBeenCalledWith('insertText', false, 'texto colado')
  })

  it('Enter dentro de uma célula de tabela é bloqueado', () => {
    render(<ConteudoEditavelProposta markdown="| a |\n| - |\n| 1 |" onChange={jest.fn()} />)
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
    render(<ConteudoEditavelProposta markdown="Texto simples" onChange={jest.fn()} />)
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

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `npx jest conteudo-editavel-proposta`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar o componente**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { renderizarMarkdownProposta } from '@/lib/renderizarMarkdownProposta'
import { htmlEditavelParaMarkdown } from '@/lib/propostaEditavel/htmlEditavelParaMarkdown'

export interface ConteudoEditavelPropostaProps {
  markdown: string
  onChange: (markdown: string) => void
}

const DEBOUNCE_MS = 400

/**
 * O conteúdo renderizado da proposta, editável direto — o usuário clica no
 * texto e digita, sem ver Markdown. `onChange` é chamado (com debounce)
 * convertendo o HTML atual de volta pra Markdown via `htmlEditavelParaMarkdown`.
 *
 * O HTML interno só é regerado quando `markdown` muda por uma fonte EXTERNA
 * a este componente (ex.: "Usar correções" aplicou um texto novo) — uma
 * mudança que veio do próprio `onChange` não força um re-render, senão o
 * cursor pula pro início a cada tecla.
 */
export function ConteudoEditavelProposta({ markdown, onChange }: ConteudoEditavelPropostaProps) {
  const ref = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mudancaInternaRef = useRef(false)

  useEffect(() => {
    if (mudancaInternaRef.current) {
      mudancaInternaRef.current = false
      return
    }
    if (ref.current) ref.current.innerHTML = renderizarMarkdownProposta(markdown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  function handleInput() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      if (!ref.current) return
      mudancaInternaRef.current = true
      onChange(htmlEditavelParaMarkdown(ref.current.innerHTML))
    }, DEBOUNCE_MS)
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault()
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter') return
    const no = window.getSelection()?.anchorNode
    const elemento = no instanceof Element ? no : no?.parentElement ?? null
    if (elemento?.closest('td, th')) e.preventDefault()
  }

  return (
    <div
      ref={ref}
      role="textbox"
      aria-multiline="true"
      aria-label="Conteúdo da proposta"
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      className="markdown-preview max-h-[70vh] min-h-[200px] overflow-auto rounded-lg border border-border-grey bg-white p-4 outline-none focus:border-orange"
    />
  )
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `npx jest conteudo-editavel-proposta`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add "src/app/propostas-comerciais/[id]/conteudo-editavel-proposta.tsx" "src/app/propostas-comerciais/[id]/conteudo-editavel-proposta.test.tsx"
git commit -m "feat: proposta editavel direto no conteudo renderizado"
```

---

## Task 3: `EditarComoTexto` (escape hatch)

**Files:**
- Create: `src/app/propostas-comerciais/[id]/editar-como-texto.tsx`
- Test: `src/app/propostas-comerciais/[id]/editar-como-texto.test.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `EditarComoTexto({ markdown, onChange }: { markdown: string; onChange: (markdown: string) => void })`.

- [ ] **Step 1: Escrever os testes que falham**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { EditarComoTexto } from './editar-como-texto'

describe('EditarComoTexto', () => {
  it('começa fechado, só com o link "Editar como texto"', () => {
    render(<EditarComoTexto markdown="# Título" onChange={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'Editar como texto' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Editar como texto')).not.toBeInTheDocument()
  })

  it('abre a textarea com o markdown atual e propaga mudanças', () => {
    const onChange = jest.fn()
    render(<EditarComoTexto markdown="# Título" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Editar como texto' }))
    const textarea = screen.getByLabelText('Editar como texto') as HTMLTextAreaElement
    expect(textarea.value).toBe('# Título')

    fireEvent.change(textarea, { target: { value: '# Título editado' } })
    expect(onChange).toHaveBeenCalledWith('# Título editado')
  })

  it('"Voltar" fecha a textarea', () => {
    render(<EditarComoTexto markdown="# Título" onChange={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar como texto' }))
    fireEvent.click(screen.getByRole('button', { name: 'Voltar pra edição normal' }))
    expect(screen.getByRole('button', { name: 'Editar como texto' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Editar como texto')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `npx jest editar-como-texto`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```tsx
'use client'

import { useState } from 'react'

export interface EditarComoTextoProps {
  markdown: string
  onChange: (markdown: string) => void
}

/**
 * Saída de emergência discreta pra quando a edição visual não dá conta
 * (round-trip HTML↔Markdown é melhor esforço, não perfeito). Deliberadamente
 * secundária — um link, não uma aba — pra não voltar a ser o fluxo padrão.
 */
export function EditarComoTexto({ markdown, onChange }: EditarComoTextoProps) {
  const [aberto, setAberto] = useState(false)

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-xs text-mid-grey underline underline-offset-2 hover:text-navy"
      >
        Editar como texto
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        aria-label="Editar como texto"
        value={markdown}
        onChange={(e) => onChange(e.target.value)}
        className="h-[40vh] w-full rounded-lg border border-border-grey p-3.5 font-mono text-sm leading-relaxed outline-none focus:border-orange"
      />
      <button
        type="button"
        onClick={() => setAberto(false)}
        className="self-start text-xs text-mid-grey underline underline-offset-2 hover:text-navy"
      >
        Voltar pra edição normal
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `npx jest editar-como-texto`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add "src/app/propostas-comerciais/[id]/editar-como-texto.tsx" "src/app/propostas-comerciais/[id]/editar-como-texto.test.tsx"
git commit -m "feat: escape hatch para editar a proposta como texto cru"
```

---

## Task 4: Extrair o menu de arquivos originais

**Files:**
- Create: `src/app/propostas-comerciais/[id]/arquivos-originais.tsx`
- Modify: `src/app/propostas-comerciais/[id]/editor-markdown.tsx` (arquivo com WIP do usuário — ler antes de editar)

**Interfaces:**
- Produces: `ArquivoOriginal` (tipo), `IconePorTipo`, `MenuArquivosOriginais`, `ModalArquivoOriginal` — exportados de `arquivos-originais.tsx`.
- Consumes (em `editor-markdown.tsx`): os quatro itens acima, no lugar das definições locais.

Esta task só MOVE código — o HTML/comportamento renderizado tem que ficar
idêntico, pra não quebrar `editor-markdown.test.tsx` (WIP do usuário, não
mexer nele nesta task).

- [ ] **Step 1: Ler o `editor-markdown.tsx` atual por completo**

Antes de qualquer edição — o arquivo pode ter mudado desde a última leitura
desta conversa (é WIP ativo do usuário).

- [ ] **Step 2: Criar `arquivos-originais.tsx` com o código extraído**

Mover pra esse arquivo novo, **exatamente como estão hoje** em
`editor-markdown.tsx`: a interface `ArquivoOriginal`, a função
`IconePorTipo`, a interface `PreviewPlanilha`, o componente
`ConteudoArquivoOriginal`, e o componente `MenuArquivosOriginais`. Envolver
também o modal (hoje o bloco `{arquivoAberto && (...)}` dentro de
`EditorMarkdown`) num componente novo `ModalArquivoOriginal`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Download, FileSpreadsheet, FileText, File as FileIcon, Loader2, X } from 'lucide-react'
import { BTN_OUTLINE } from '@/lib/ui'
import { cn } from '@/lib/utils'

export interface ArquivoOriginal {
  id: string
  nomeArquivo: string
  tipo: string
}

export function IconePorTipo({ tipo }: { tipo: string }) {
  if (tipo === 'xlsx' || tipo === 'csv') return <FileSpreadsheet className="size-4 shrink-0" strokeWidth={2.25} />
  if (tipo === 'docx') return <FileIcon className="size-4 shrink-0" strokeWidth={2.25} />
  return <FileText className="size-4 shrink-0" strokeWidth={2.25} />
}

interface PreviewPlanilha {
  cabecalho: string[]
  linhas: string[][]
  totalLinhas: number
  truncado: boolean
}

/** Conteúdo do modal de arquivo original — cada tipo tem seu jeito de
 *  pré-visualizar: PDF abre a rota que já serve o binário inline, Word vira
 *  HTML renderizado (mesmo endpoint/lib já usados em "Relatórios dos
 *  clientes"), planilha vira uma tabela a partir do preview estruturado. */
function ConteudoArquivoOriginal({ propostaId, arquivo }: { propostaId: string; arquivo: ArquivoOriginal }) {
  const [preview, setPreview] = useState<PreviewPlanilha | null>(null)

  useEffect(() => {
    setPreview(null)
    if (arquivo.tipo === 'xlsx' || arquivo.tipo === 'csv') {
      fetch(`/api/propostas-comerciais/${propostaId}/arquivos/${arquivo.id}/preview`)
        .then((r) => r.json())
        .then(setPreview)
    }
  }, [propostaId, arquivo.id, arquivo.tipo])

  if (arquivo.tipo === 'pdf') {
    return (
      <iframe
        src={`/api/propostas-comerciais/${propostaId}/arquivos/${arquivo.id}?modo=preview`}
        className="h-full w-full rounded-lg border border-border-grey"
        title={arquivo.nomeArquivo}
      />
    )
  }

  if (arquivo.tipo === 'docx') {
    return (
      <iframe
        src={`/api/propostas-comerciais/${propostaId}/arquivos/${arquivo.id}/preview`}
        className="h-full w-full rounded-lg border border-border-grey bg-white"
        title={arquivo.nomeArquivo}
      />
    )
  }

  if (!preview) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-mid-grey">
        <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        Carregando pré-visualização...
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border-grey">
      {preview.truncado && (
        <p className="border-b border-border-grey bg-orange-light px-3 py-2 text-xs text-orange-dark">
          Mostrando as primeiras {preview.linhas.length} de {preview.totalLinhas} linhas — baixe o arquivo pra
          ver tudo.
        </p>
      )}
      <div className="overflow-auto">
        <table className="table-institucional">
          <thead>
            <tr>
              {preview.cabecalho.map((coluna, i) => (
                <th key={i}>{coluna}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.linhas.map((linha, i) => (
              <tr key={i}>
                {linha.map((valor, j) => (
                  <td key={j}>{valor}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Botão que abre os arquivos originais — um único arquivo abre direto; mais
 *  de um vira um menu (não faz sentido listar tudo permanentemente na tela,
 *  isso só ocupava espaço sem servir de navegação de verdade). */
export function MenuArquivosOriginais({
  arquivos,
  onAbrir,
  onRemover,
}: {
  arquivos: ArquivoOriginal[]
  onAbrir: (arquivo: ArquivoOriginal) => void
  onRemover?: (arquivo: ArquivoOriginal) => void
}) {
  const [aberto, setAberto] = useState(false)

  if (arquivos.length === 0) return null

  if (arquivos.length === 1) {
    return (
      <button type="button" onClick={() => onAbrir(arquivos[0])} className={BTN_OUTLINE}>
        <FileText className="size-3.5" strokeWidth={2.25} />
        Arquivo original
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className={BTN_OUTLINE}
      >
        <FileText className="size-3.5" strokeWidth={2.25} />
        Arquivos originais ({arquivos.length})
        <ChevronDown className={cn('size-3.5 transition-transform duration-150', aberto && 'rotate-180')} strokeWidth={2.25} />
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-border-grey bg-white p-1.5 shadow-lg"
          >
            {arquivos.map((arquivo) => (
              <div
                key={arquivo.id}
                role="menuitem"
                tabIndex={0}
                onClick={() => {
                  onAbrir(arquivo)
                  setAberto(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onAbrir(arquivo)
                    setAberto(false)
                  }
                }}
                className="group flex cursor-pointer items-center gap-1 rounded-lg pr-1 text-sm text-navy transition-colors hover:bg-orange-light/40"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2.5 py-2 pl-2.5">
                  <IconePorTipo tipo={arquivo.tipo} />
                  <span className="min-w-0 flex-1 truncate">{arquivo.nomeArquivo}</span>
                </span>
                {onRemover && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemover(arquivo)
                    }}
                    aria-label={`Remover ${arquivo.nomeArquivo}`}
                    title="Remover arquivo"
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-mid-grey opacity-0 transition-colors group-hover:opacity-100 hover:bg-red-crit-light hover:text-red-crit focus-visible:opacity-100"
                  >
                    <X className="size-3.5" strokeWidth={2.25} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Modal que abre um arquivo original — usado tanto pelo editor de rascunho
 *  quanto pela tela final. */
export function ModalArquivoOriginal({
  propostaId,
  arquivo,
  onFechar,
}: {
  propostaId: string
  arquivo: ArquivoOriginal
  onFechar: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col gap-3 rounded-2xl bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
            <IconePorTipo tipo={arquivo.tipo} />
            {arquivo.nomeArquivo}
          </h2>
          <div className="flex items-center gap-1">
            <a
              href={`/api/propostas-comerciais/${propostaId}/arquivos/${arquivo.id}`}
              download={arquivo.nomeArquivo}
              aria-label={`Baixar ${arquivo.nomeArquivo}`}
              title="Baixar arquivo original"
              className="flex size-7 items-center justify-center rounded-md text-mid-grey transition-colors hover:bg-navy/[0.06] hover:text-navy"
            >
              <Download className="size-4" strokeWidth={2.25} />
            </a>
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className="flex size-7 items-center justify-center rounded-md text-mid-grey transition-colors hover:bg-navy/[0.06] hover:text-navy"
            >
              <X className="size-4" strokeWidth={2.25} />
            </button>
          </div>
        </div>
        <ConteudoArquivoOriginal propostaId={propostaId} arquivo={arquivo} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Atualizar `editor-markdown.tsx` pra importar do arquivo novo**

Usando `Edit` (não `Write`) sobre o conteúdo lido no Step 1:
- Remover do arquivo: a interface `ArquivoOriginal`, `IconePorTipo`, a
  interface `PreviewPlanilha`, `ConteudoArquivoOriginal`,
  `MenuArquivosOriginais`, e o bloco JSX do modal (`{arquivoAberto && (...)}`).
- No topo, importar:
  ```ts
  import { ArquivoOriginal, MenuArquivosOriginais, ModalArquivoOriginal } from './arquivos-originais'
  ```
  (removendo `ArquivoOriginal`/`ArquivosOriginal`-relacionados dos imports de
  ícones do `lucide-react` que ficarem sem uso, e de `BTN_OUTLINE`/`cn` se
  ficarem sem uso — conferir com o linter no Step 4).
- Trocar o bloco `{arquivoAberto && (<div className="fixed inset-0 ...">...)}`
  por:
  ```tsx
  {arquivoAberto && (
    <ModalArquivoOriginal propostaId={propostaId} arquivo={arquivoAberto} onFechar={() => setArquivoAberto(null)} />
  )}
  ```
- **Não mexer em mais nada** — `EditorMarkdown`, `handleRemoverArquivo`, os
  states, as abas — tudo isso é assunto da Task 5.

- [ ] **Step 4: Verificar que nada quebrou**

Run: `npx tsc --noEmit` e `npx jest editor-markdown`
Expected: `tsc` limpo; a suíte de `editor-markdown` no MESMO estado de antes
desta task (a mesma única falha pré-existente do WIP do usuário — "abre um
menu pra escolher qual ver", `fetch is not defined` — nenhuma NOVA falha).
Se aparecer uma falha nova, o HTML/comportamento não ficou idêntico —
comparar com cuidado antes de seguir.

- [ ] **Step 5: Commit**

```bash
git add "src/app/propostas-comerciais/[id]/arquivos-originais.tsx" "src/app/propostas-comerciais/[id]/editor-markdown.tsx"
git commit -m "refactor: extrai menu de arquivos originais pra arquivo compartilhado"
```

---

## Task 5: `editor-markdown.tsx` usa a edição visual

**Files:**
- Modify: `src/app/propostas-comerciais/[id]/editor-markdown.tsx` (ler antes de editar — WIP do usuário)
- Modify: `src/app/propostas-comerciais/[id]/editor-markdown.test.tsx` (ler antes de editar — WIP do usuário; editar só o estritamente necessário)

**Interfaces:**
- Consumes: `ConteudoEditavelProposta` (Task 2), `EditarComoTexto` (Task 3).
- Produces: `EditorMarkdown` sem as abas "Visualizar"/"Editar texto" — vira sempre o conteúdo editável + o link de escape hatch. A aba "Correção da IA" continua igual.

- [ ] **Step 1: Ler `editor-markdown.tsx` e `editor-markdown.test.tsx` por completo**

Ambos são WIP ativo do usuário — não confiar em leitura anterior desta
conversa.

- [ ] **Step 2: Atualizar `editor-markdown.tsx` com `Edit` cirúrgico**

- Importar `ConteudoEditavelProposta` e `EditarComoTexto`.
- Trocar o tipo do state `aba` de `'visualizar' | 'editar' | 'correcao'` pra
  `'visualizar' | 'correcao'` (remove `'editar'`).
- Remover o botão da aba "Editar texto" do seletor de abas.
- Trocar os dois blocos:
  ```tsx
  {aba === 'visualizar' && (
    <div aria-label="Visualização da proposta" className="markdown-preview h-[65vh] ..." dangerouslySetInnerHTML={...} />
  )}
  {aba === 'editar' && (
    <div className="flex flex-col gap-1.5">
      <textarea aria-label="Texto da proposta" ... />
      ...
    </div>
  )}
  ```
  por:
  ```tsx
  {aba === 'visualizar' && (
    <div className="space-y-1.5">
      <ConteudoEditavelProposta markdown={texto} onChange={setTexto} />
      <EditarComoTexto markdown={texto} onChange={setTexto} />
    </div>
  )}
  ```
- O resto (`handleSalvar`, `handleCopiarFormatado`, `MenuArquivosOriginais`,
  `ModalArquivoOriginal`, a aba "Correção da IA") não muda.

- [ ] **Step 3: Atualizar `editor-markdown.test.tsx` com `Edit` cirúrgico**

Os testes que exercitavam a aba "Editar texto" removida testam um fluxo que
não existe mais — ajustar pra exercitar o novo (`ConteudoEditavelProposta`
já tem seus próprios testes unitários na Task 2, então aqui é só garantir
que `EditorMarkdown` liga tudo certo):

- `'troca pra aba Editar texto e permite alterar o conteúdo'` → remover (a
  aba não existe mais).
- `'abre na aba Visualizar mostrando o conteúdo renderizado'` → manter, mas
  trocar a asserção `expect(screen.queryByLabelText('Texto da proposta')).not.toBeInTheDocument()`
  por `expect(screen.getByRole('textbox', { name: 'Conteúdo da proposta' })).toBeInTheDocument()`.
- `'chama onSalvar com o texto atual ao clicar em Salvar'` → trocar a edição
  via `fireEvent.click('Editar texto')` + `fireEvent.change(textarea, ...)`
  por editar através do `EditarComoTexto`:
  ```tsx
  fireEvent.click(screen.getByRole('button', { name: 'Editar como texto' }))
  fireEvent.change(screen.getByLabelText('Editar como texto'), { target: { value: 'conteúdo editado' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
  expect(onSalvar).toHaveBeenCalledWith('conteúdo editado')
  ```
- Os testes de arquivos originais (abrir modal, menu com vários arquivos,
  remover arquivo) não mudam — continuam batendo porque o HTML ficou
  idêntico (Task 4).

- [ ] **Step 4: Rodar a suíte**

Run: `npx jest editor-markdown`
Expected: mesmo número de falhas pré-existentes de antes (a de xlsx preview,
`fetch is not defined` — WIP do usuário, não desta feature), nenhuma falha
nova.

- [ ] **Step 5: `tsc` e commit**

Run: `npx tsc --noEmit`
Expected: limpo.

```bash
git add "src/app/propostas-comerciais/[id]/editor-markdown.tsx" "src/app/propostas-comerciais/[id]/editor-markdown.test.tsx"
git commit -m "feat: editor de rascunho usa edicao visual em vez de markdown cru"
```

---

## Task 6: `proposta-final.tsx` — sempre editável, "Salvar alterações"

**Files:**
- Modify: `src/app/propostas-comerciais/[id]/proposta-final.tsx`
- Modify: `src/app/propostas-comerciais/[id]/proposta-final.test.tsx`

**Interfaces:**
- Consumes: `ConteudoEditavelProposta` (Task 2), `EditarComoTexto` (Task 3), `ArquivoOriginal`/`MenuArquivosOriginais`/`ModalArquivoOriginal` (Task 4), `PainelRevisaoPortugues` (já existe).
- Produces: `PropostaFinalProps` muda de
  `{ propostaId, conteudoMarkdown, onEditarNovamente, onUsarCorrecoes }` pra
  `{ propostaId, conteudoMarkdown, arquivos: ArquivoOriginal[], onSalvar: (markdown: string) => Promise<void> }`.
  (`onUsarCorrecoes` não existe mais como prop separada — vira uso interno de
  `onSalvar` só quando o usuário aceita a correção E ela é considerada uma
  edição, então marca sujo; ver Step 3.)

- [ ] **Step 1: Reescrever o teste**

```tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { PropostaFinal } from './proposta-final'
import { limparRevisao } from '@/lib/revisaoPortuguesEmAndamento'

class ClipboardItemFalso {
  constructor(public items: Record<string, Blob>) {}
}

const propsBase = {
  propostaId: 'p1',
  conteudoMarkdown: '# Proposta',
  arquivos: [],
  onSalvar: jest.fn().mockResolvedValue(undefined),
}

describe('PropostaFinal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    limparRevisao('p1')
    ;(global as unknown as { ClipboardItem: typeof ClipboardItemFalso }).ClipboardItem = ClipboardItemFalso
    Object.assign(navigator, { clipboard: { write: jest.fn().mockResolvedValue(undefined) } })
  })

  it('mostra o conteúdo renderizado e editável na aba Visualizar', () => {
    render(<PropostaFinal {...propsBase} />)
    expect(screen.getByRole('heading', { name: 'Proposta' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Conteúdo da proposta' })).toBeInTheDocument()
  })

  it('não mostra "Salvar alterações" antes de qualquer edição', () => {
    render(<PropostaFinal {...propsBase} />)
    expect(screen.queryByRole('button', { name: /Salvar alterações/ })).not.toBeInTheDocument()
  })

  it('edição faz aparecer "Salvar alterações"; salvar chama onSalvar e o esconde de novo', async () => {
    render(<PropostaFinal {...propsBase} />)

    const editor = screen.getByRole('textbox', { name: 'Conteúdo da proposta' })
    editor.innerHTML = '<h1>Proposta editada</h1>'
    fireEvent.input(editor)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 450))
    })

    const botaoSalvar = await screen.findByRole('button', { name: /Salvar alterações/ })
    fireEvent.click(botaoSalvar)

    await waitFor(() => expect(propsBase.onSalvar).toHaveBeenCalledWith('# Proposta editada'))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Salvar alterações/ })).not.toBeInTheDocument())
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

  it('não mostra mais o botão "Editar novamente"', () => {
    render(<PropostaFinal {...propsBase} />)
    expect(screen.queryByRole('button', { name: /Editar novamente/ })).not.toBeInTheDocument()
  })

  it('com arquivos originais, mostra o menu pra abrir', () => {
    render(<PropostaFinal {...propsBase} arquivos={[{ id: 'a1', nomeArquivo: 'proposta.pdf', tipo: 'pdf' }]} />)
    expect(screen.getByRole('button', { name: 'Arquivo original' })).toBeInTheDocument()
  })

  it('na aba "Correção da IA" mostra o botão "Revisar português"', () => {
    render(<PropostaFinal {...propsBase} />)
    fireEvent.click(screen.getByRole('button', { name: /Correção da IA/ }))
    expect(screen.getByRole('button', { name: /Revisar português/ })).toBeInTheDocument()
  })

  it('"Usar correções" atualiza o conteúdo e marca como sujo (precisa salvar)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ original: 'A proposta e boa.', corrigido: 'A proposta é boa.' }),
    }) as jest.Mock

    render(<PropostaFinal {...propsBase} conteudoMarkdown="A proposta e boa." />)
    fireEvent.click(screen.getByRole('button', { name: /Correção da IA/ }))
    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Usar correções/ }))

    expect(await screen.findByRole('button', { name: /Salvar alterações/ })).toBeInTheDocument()
    expect(propsBase.onSalvar).not.toHaveBeenCalled()
  })

  it('"Manter original" volta ao estado inicial sem marcar sujo', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ original: 'A proposta e boa.', corrigido: 'A proposta é boa.' }),
    }) as jest.Mock

    render(<PropostaFinal {...propsBase} conteudoMarkdown="A proposta e boa." />)
    fireEvent.click(screen.getByRole('button', { name: /Correção da IA/ }))
    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Manter original/ }))

    expect(await screen.findByRole('button', { name: /Revisar português/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Salvar alterações/ })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest proposta-final`
Expected: FAIL (props/comportamento novo ainda não implementado).

- [ ] **Step 3: Reescrever `proposta-final.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { ClipboardCopy, ClipboardCheck, Sparkles } from 'lucide-react'
import { BTN_PRIMARY, BTN_OUTLINE } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { copiarMarkdownFormatado } from '@/lib/copiarMarkdownFormatado'
import { ConteudoEditavelProposta } from './conteudo-editavel-proposta'
import { EditarComoTexto } from './editar-como-texto'
import { PainelRevisaoPortugues } from './painel-revisao-portugues'
import { ArquivoOriginal, MenuArquivosOriginais, ModalArquivoOriginal } from './arquivos-originais'

export interface PropostaFinalProps {
  propostaId: string
  conteudoMarkdown: string
  arquivos: ArquivoOriginal[]
  onSalvar: (markdown: string) => Promise<void>
}

export function PropostaFinal({ propostaId, conteudoMarkdown, arquivos, onSalvar }: PropostaFinalProps) {
  const [markdown, setMarkdown] = useState(conteudoMarkdown)
  const [sujo, setSujo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [aba, setAba] = useState<'visualizar' | 'correcao'>('visualizar')
  const [arquivoAberto, setArquivoAberto] = useState<ArquivoOriginal | null>(null)

  useEffect(() => {
    setMarkdown(conteudoMarkdown)
    setSujo(false)
  }, [conteudoMarkdown])

  useEffect(() => {
    if (!sujo) return
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [sujo])

  function handleMudarTexto(novoMarkdown: string) {
    setMarkdown(novoMarkdown)
    setSujo(true)
  }

  async function handleSalvar() {
    setSalvando(true)
    await onSalvar(markdown)
    setSalvando(false)
    setSujo(false)
  }

  async function handleCopiarFormatado() {
    await copiarMarkdownFormatado(markdown)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function handleUsarCorrecoes(corrigido: string) {
    setMarkdown(corrigido)
    setSujo(true)
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

        <div className="flex flex-wrap gap-2">
          <MenuArquivosOriginais arquivos={arquivos} onAbrir={setArquivoAberto} />
          {sujo && (
            <button type="button" onClick={handleSalvar} disabled={salvando} className={BTN_PRIMARY}>
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </button>
          )}
          <button type="button" onClick={handleCopiarFormatado} className={BTN_OUTLINE}>
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
        <div className="space-y-1.5">
          <ConteudoEditavelProposta markdown={markdown} onChange={handleMudarTexto} />
          <EditarComoTexto markdown={markdown} onChange={handleMudarTexto} />
        </div>
      )}

      {aba === 'correcao' && (
        <PainelRevisaoPortugues propostaId={propostaId} markdownAtual={markdown} onUsarCorrecoes={handleUsarCorrecoes} />
      )}

      {arquivoAberto && (
        <ModalArquivoOriginal propostaId={propostaId} arquivo={arquivoAberto} onFechar={() => setArquivoAberto(null)} />
      )}
    </div>
  )
}
```

Nota: `handleUsarCorrecoes` não é mais `async` nem chama `onSalvar` — só
atualiza o estado local e marca sujo, igual qualquer outra edição. O usuário
ainda precisa clicar "Salvar alterações" pra persistir (comportamento
consistente: toda edição, venha de onde vier, passa pelo mesmo botão).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest proposta-final`
Expected: PASS (10 testes).

- [ ] **Step 5: Commit**

```bash
git add "src/app/propostas-comerciais/[id]/proposta-final.tsx" "src/app/propostas-comerciais/[id]/proposta-final.test.tsx"
git commit -m "feat: tela final sempre editavel, com salvar alteracoes"
```

---

## Task 7: `page.tsx` — remove o modo de edição separado

**Files:**
- Modify: `src/app/propostas-comerciais/[id]/page.tsx`

**Interfaces:**
- Consumes: `PropostaFinalProps` novo (Task 6) — `arquivos`, `onSalvar` no lugar de `onEditarNovamente`/`onUsarCorrecoes`.

- [ ] **Step 1: Editar `page.tsx`**

Remover o state `modoEdicao` e simplificar as condições:

```tsx
  const mostrarEditor = proposta.status === 'rascunho'
  const mostrarFinal = proposta.status === 'concluido'
```

Trocar o bloco `mostrarFinal`:

```tsx
      {mostrarFinal && (
        <PropostaFinal
          propostaId={proposta.id}
          conteudoMarkdown={proposta.conteudoMarkdown ?? ''}
          arquivos={proposta.arquivos}
          onSalvar={handleSalvar}
        />
      )}
```

`handleSalvar` já existe e faz exatamente isso (PATCH + recarrega,
`status → concluido`, que já é o status atual — sem efeito colateral).

- [ ] **Step 2: `tsc`, suíte completa, commit**

Run: `npx tsc --noEmit`
Expected: limpo.

Run: `npm test`
Expected: mesmas falhas pré-existentes de sempre (nav-bar 2, editor-markdown
1 — WIP do usuário), nenhuma falha nova.

```bash
git add "src/app/propostas-comerciais/[id]/page.tsx"
git commit -m "feat: tela final sempre editavel, sem modo de edicao separado"
```

---

## Self-Review

- **Cobertura do spec:** conversor DOM→Markdown (Task 1) ✅; componente
  editável com debounce/paste/Enter-em-tabela/re-render controlado (Task 2)
  ✅; escape hatch discreto (Task 3) ✅; menu de arquivos originais extraído e
  reaproveitado pela tela final (Task 4, 6) ✅; `editor-markdown.tsx` sem a
  aba de Markdown cru (Task 5) ✅; tela final sempre editável com "Salvar
  alterações" condicional (Task 6) ✅; sem "Editar novamente"/modo de edição
  separado (Task 6, 7) ✅; "Copiar formatado" e "Correção da IA" usam o
  Markdown atual, editado ou não (Task 6) ✅; nenhuma IA na conversão ✅; fora
  de escopo (reestruturação, TipTap, colaboração) não implementado ✅.
- **Placeholders:** nenhum. As notas sobre "conferir com o linter" (Task 4) e
  "comparar com cuidado" (Task 4/5) são instruções de verificação, não
  trabalho adiado.
- **Consistência de tipos:** `htmlEditavelParaMarkdown(html: string): string`
  igual nas Tasks 1, 2. `ConteudoEditavelPropostaProps` e
  `EditarComoTextoProps` (`{ markdown: string; onChange: (markdown: string) => void }`)
  idênticas entre os componentes e onde são usados (Tasks 5, 6).
  `ArquivoOriginal`/`MenuArquivosOriginais`/`ModalArquivoOriginal` com a
  mesma assinatura entre a extração (Task 4) e os dois usos (Tasks 5, 6).
  `PropostaFinalProps` novo é usado de forma consistente entre o componente
  (Task 6) e `page.tsx` (Task 7).
- **Risco isolado:** as únicas tasks que tocam arquivos WIP do usuário
  (`editor-markdown.tsx`/`.test.tsx`) são as Tasks 4 e 5, com passos
  explícitos de "ler antes de editar", `Edit` cirúrgico em vez de `Write`, e
  verificação de que nenhuma falha nova aparece na suíte desses arquivos.
