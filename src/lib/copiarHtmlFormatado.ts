/** Fonte/tamanho institucional padrão — usados quando quem chama não passa
 *  `opcoesFonte` (compatibilidade) ou quando a preferência salva é inválida.
 *  Mesmos valores default de `.markdown-preview` em `src/app/globals.css`. */
const FONTE_PADRAO = "'Aptos', 'Aptos Text', Calibri, 'Segoe UI', sans-serif"
const TAMANHO_CORPO_PADRAO = 12

/** Mesma paleta de `.markdown-preview table` em `src/app/globals.css`
 *  (`--navy`, `--border-grey`, `--light-grey`) — hardcoded aqui porque o
 *  HTML que vai pro clipboard é colado fora do site (Word, SEI), então não
 *  carrega a folha de estilos: sem repetir as cores como `style` inline, a
 *  tabela cola sem nenhuma borda/cor e cada navegador/editor de destino
 *  decide o espaçamento por conta própria — foi o que deixou as tabelas
 *  "quebradas" ao colar no SEI. */
const COR_NAVY = '#002a4a'
const COR_BORDA_GREY = '#d9d9d9'
const COR_LIGHT_GREY = '#f2f2f2'

export interface OpcoesFonteCopia {
  /** Pilha de font-family CSS (ex.: pilha de `pilhaDaFonte` em
   *  `preferenciaFonteProposta.ts`). */
  familia?: string
  /** Tamanho do corpo do texto em pontos — o título sai sempre em
   *  `tamanhoCorpo + 2`, pra manter a mesma proporção da tela. */
  tamanhoCorpo?: number
}

/** Aplica a fonte/tamanho institucional como estilo inline em cada elemento
 *  do HTML — mutação in-place do `doc` recebido. */
function aplicarFonteInstitucional(doc: Document, opcoes?: OpcoesFonteCopia): void {
  const familia = opcoes?.familia ?? FONTE_PADRAO
  const tamanhoCorpo = opcoes?.tamanhoCorpo ?? TAMANHO_CORPO_PADRAO
  const tamanhoCorpoPt = `${tamanhoCorpo}pt`
  const tamanhoTituloPt = `${tamanhoCorpo + 2}pt`

  doc.body.style.cssText = `font-family: ${familia}; font-size: ${tamanhoCorpoPt}; line-height: 1.5;`

  for (const titulo of doc.body.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    ;(titulo as HTMLElement).style.cssText = `font-family: ${familia}; font-size: ${tamanhoTituloPt}; font-weight: bold;`
  }

  for (const negrito of doc.body.querySelectorAll('strong, b')) {
    ;(negrito as HTMLElement).style.cssText = `font-family: ${familia}; font-weight: bold;`
  }

  for (const elemento of doc.body.querySelectorAll('p, li, td, th, span, em, i, a, blockquote, code')) {
    const el = elemento as HTMLElement
    const pesoNegrito = el.tagName === 'TH' ? ' font-weight: bold;' : ''
    el.style.cssText = `font-family: ${familia}; font-size: ${tamanhoCorpoPt};${pesoNegrito}`
  }
}

/**
 * Aplica a MESMA estrutura visual de `.markdown-preview table` (bordas,
 * cabeçalho em navy, linhas alternadas) como estilo inline — roda DEPOIS de
 * `aplicarFonteInstitucional` e usa `+=` em vez de `=` em `td`/`th` de
 * propósito, pra somar ao `style` de fonte já aplicado ali em vez de
 * substituí-lo. Sem isso, a tabela até chega com a fonte certa no Word/SEI,
 * mas sem nenhuma borda/largura/fundo — cada coluna solta, largura decidida
 * pelo editor de destino, cabeçalho igual a qualquer outra linha: exatamente
 * o "sem modelo nenhum" que o preview na tela não tem.
 */
function aplicarEstiloTabela(doc: Document): void {
  for (const tabela of doc.body.querySelectorAll('table')) {
    ;(tabela as HTMLElement).style.cssText = 'border-collapse: collapse; width: 100%;'
  }

  for (const linhaCabecalho of doc.body.querySelectorAll('thead tr')) {
    ;(linhaCabecalho as HTMLElement).style.cssText = `background-color: ${COR_NAVY}; color: #ffffff;`
  }

  for (const th of doc.body.querySelectorAll('th')) {
    ;(th as HTMLElement).style.cssText += `border: 1px solid ${COR_NAVY}; padding: 6px 10px; text-align: left;`
  }

  for (const td of doc.body.querySelectorAll('td')) {
    ;(td as HTMLElement).style.cssText += `border: 1px solid ${COR_BORDA_GREY}; padding: 6px 10px; vertical-align: top; text-align: left;`
  }

  // Zebra igual à tela (`tbody tr:nth-child(even)`) — ajuda a acompanhar
  // uma linha em tabelas largas (ex.: memória de cálculo com muitas colunas).
  const linhasCorpo = doc.body.querySelectorAll('tbody tr')
  linhasCorpo.forEach((linha, indice) => {
    if (indice % 2 === 1) (linha as HTMLElement).style.backgroundColor = COR_LIGHT_GREY
  })
}

/** Um bloco por linha — junta o `textContent` de cada elemento de bloco
 *  direto (h1-h6/p/table/ul/ol) em vez de `doc.body.textContent` inteiro,
 *  que colaria o texto de blocos diferentes sem separação nenhuma (HTML não
 *  insere quebra de linha entre tags por conta própria — quem fazia isso
 *  antes era o `\n` que o `marked` deixava entre blocos gerados a partir de
 *  Markdown). */
function textoSimplesDoDocumento(doc: Document): string {
  return Array.from(doc.body.children)
    .map((el) => el.textContent ?? '')
    .join('\n')
}

/**
 * Copia HTML pra área de transferência como HTML real (`text/html`, com
 * `text/plain` de fallback) — assim colar num Word/editor rico traz tabelas
 * e negrito de verdade. `html` já é o formato de armazenamento da proposta
 * (ver docs/superpowers/specs/2026-09-14-html-nativo-ocr-proposta-comercial-design.md);
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
