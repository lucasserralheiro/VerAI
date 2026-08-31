# OCR de fallback para páginas-imagem na Proposta Comercial

## Contexto

O módulo **Proposta Comercial (Conversão SEI)** converte arquivos (PDF, Excel, Word) num único
Markdown de forma **100% determinística, sem IA** — o conteúdo final tem que ser fiel ao original,
sem inventar nem um caractere (spec anterior: `2026-08-25-proposta-comercial-design.md`, que colocou
"OCR de PDF escaneado" explicitamente fora de escopo).

Hoje, quando o PDF é escaneado (página é uma imagem, sem camada de texto) ou tem um trecho colado
como imagem (tabela/print no meio de um PDF de texto), o pipeline:

- **PDF 100% escaneado** → `converterPdfParaMarkdown` devolve `''` → a rota marca a proposta como
  `status: 'erro'` ("arquivo sem conteúdo reconhecível"). O usuário fica sem saída dentro do sistema.
- **PDF misto** (texto + trecho como imagem) → o texto-dentro-de-imagem é **descartado
  silenciosamente**, sem nenhum aviso. É o caso mais perigoso: parte de um dado importante some sem
  ninguém perceber.

Esta revisão adiciona um **caminho de fallback de OCR**, que só ganha vida quando esse tipo de PDF
aparece. Para qualquer PDF normal (com camada de texto), **nada muda** — mesmo fluxo, mesma
velocidade, mesmo bundle, e o `tesseract.js` nem chega a ser baixado.

## Princípios da solução

1. **Fallback dormente.** A detecção roda de carona na extração que já acontece; o custo para um PDF
   normal é ~zero. Sem página-imagem detectada, nenhum artefato novo aparece na tela.
2. **OCR nunca roda sozinho.** O usuário vê "N páginas são imagem — o texto delas não foi extraído" e
   decide clicar em "Rodar OCR" ou transcrever à mão.
3. **OCR é um rascunho, nunca uma saída confiável.** O texto reconhecido entra **marcado como "não
   conferido"** e a proposta **não sai de `rascunho`** enquanto sobrar um trecho de OCR não revisado.
   Um humano confere cada trecho contra a imagem da página antes de liberar.
4. **De graça e local.** OCR roda no navegador do usuário via `tesseract.js` (open source, Apache 2.0)
   com os dados de idioma `por` (gratuitos, cache em IndexedDB). Nenhuma chamada de API, nenhum
   serviço em nuvem, nenhum custo por página. O dado sensível **não sai da máquina do usuário** para
   ser reconhecido.
5. **Sem infra nova de servidor.** Sem OCR/rasterização no servidor, sem fila, sem processamento
   assíncrono, sem coluna nova no banco. Restrição real: deploy no **Vercel Hobby** (teto de 60 s por
   função, cron 1×/dia) — OCR no servidor não cabe.

## 1. Detecção de páginas-imagem (servidor, durante a conversão)

`src/lib/extracao/pdfMarkdown.ts` — `converterPdfParaMarkdown` passa a devolver, além do Markdown,
a lista de páginas (1-indexadas) que precisam de OCR:

```ts
converterPdfParaMarkdown(buffer): Promise<{ markdown: string; paginasImagem: number[] }>
```

Critério por página (constantes ajustáveis no topo do arquivo):

- **Poucos caracteres extraídos** — soma de `item.str.length` dos itens daquela página < `LIMIAR_CHARS_PAGINA_IMAGEM` (~50), **e**
- **Imagem cobrindo boa parte da página** — área somada dos operadores de imagem
  (`paintImageXObject`, `paintInlineImage`, `paintImageMaskXObject`) sobre a área da página
  > `LIMIAR_COBERTURA_IMAGEM` (~0,40).

A cobertura de imagem é extraída na **mesma passada de operator list** que o `pdfTracos.ts` já faz
por página (hoje só para segmentos retos) — nada de um segundo parse do PDF. `pdfTracos.ts` passa a
expor, junto dos segmentos, a fração de área coberta por imagem por página; `pdfMarkdown.ts` consome
as duas coisas.

Para cada página marcada, `montarMarkdown` insere **na posição daquela página** (na ordem do
documento) um bloco placeholder em vez do conteúdo que não existe:

```
:::ocr-pendente[pagina=3]
_(aguardando OCR)_
:::
```

Um PDF 100% escaneado deixa de cair em `status: 'erro'`: ele vira uma sequência de blocos
`:::ocr-pendente`, um por página, e segue para o editor como `rascunho`.

## 2. Marcador `:::ocr-pendente` — o estado vive no texto

Todo o controle de estado deriva desse marcador presente no `conteudoMarkdown`. **Sem coluna nova
no banco.**

- Formato: `:::ocr-pendente[arquivoId=<cuid> pagina=<n>]` numa linha, corpo nas linhas seguintes,
  `:::` fechando numa linha só.
- `converterPdfParaMarkdown` insere só `[pagina=<n>]` (não conhece o `arquivoId`). A rota
  `POST /api/propostas-comerciais` — que cria as linhas `PropostaComercialArquivo` e concatena os
  arquivos — reescreve cada marcador daquele arquivo para incluir `arquivoId=<cuid>` antes de
  concatenar. O `arquivoId` é o que o cliente usa para baixar o blob e renderizar a página certa.
- "Pendente" = existe pelo menos um `:::ocr-pendente` no texto. "Conferido" = o wrapper foi removido
  (o texto do trecho fica, sem as linhas de marcador).
- O marcador sobrevive a ida e volta pelo `<textarea>` do editor (é texto puro). Se o usuário apagar
  um marcador na mão, aquele trecho passa a contar como conferido — comportamento aceitável e
  esperado (a pessoa assumiu a edição).

## 3. Runner de OCR no navegador

Novo componente cliente `src/app/propostas-comerciais/[id]/ocr-runner.tsx` + orquestração pura em
`src/lib/ocr/rodarOcr.ts`.

- Aparece no editor **só quando** o `conteudoMarkdown` contém `:::ocr-pendente`. Mostra
  "N páginas são imagem — o texto não foi extraído" + botão **"Rodar OCR (N páginas)"**.
- `tesseract.js` entra por `import()` dinâmico **no clique** — nunca no carregamento normal do
  editor.
- Para cada bloco `:::ocr-pendente`:
  1. Baixa o blob do arquivo original (`GET /api/propostas-comerciais/[id]/arquivos/[arquivoId]`) —
     uma vez por arquivo, em cache na sessão.
  2. Renderiza a página `pagina` para um canvas/bitmap **no navegador**, usando o `pdf.js` que o
     `unpdf` já traz (`getResolvedPDFJS()` → `page.render`).
  3. `tesseract.js` (`worker` com idioma `por`, cache em IndexedDB) reconhece o texto.
  4. Substitui o corpo do bloco pelo texto reconhecido, **mantendo o wrapper `:::ocr-pendente`**.
- Barra de progresso página a página ("Página 2 de 5…"). Ao terminar, salva via
  `PATCH /api/propostas-comerciais/[id]` (ver seção 5 — como o texto ainda tem marcadores, a proposta
  continua `rascunho`).
- Erro numa página (render ou OCR falhou): o bloco daquela página vira
  `:::ocr-pendente` com corpo `_(OCR falhou nesta página — transcreva manualmente a partir do
  original)_` e o runner segue para as próximas. Nunca aborta o lote todo.

## 4. Conferência lado a lado (o portão)

Depois de rodar o OCR, o `ocr-runner.tsx` entra em **modo revisão**: para cada trecho de OCR,

- **imagem da página renderizada à esquerda** (canvas em memória, reaproveitado do passo de OCR —
  **nunca é salvo em lugar nenhum**),
- **texto do OCR editável à direita**,
- botão **"Conferi este trecho"** → remove o wrapper `:::ocr-pendente` (mantém o texto), salva.

A revisão é **retomável**: se a pessoa sair no meio, os blocos ainda pendentes continuam no
`conteudoMarkdown` e da próxima vez o runner re-renderiza as páginas a partir do blob.

O `renderizarMarkdownProposta` (preview do editor e tela final) transforma cada bloco
`:::ocr-pendente` num **callout vermelho** — "⚠️ Texto por OCR, não conferido — página N do arquivo
original" com link **"ver página no original"** (abre o modal de arquivo original que já existe,
apontando o `pdf.js` para `#page=N`; o `data-arquivo-id`/`data-pagina` do callout vêm dos atributos
do marcador). `renderizarMarkdownProposta` continua uma função pura `(markdown) => html` — não
precisa da lista de arquivos. Mesmo mecanismo de pós-processamento de DOM já usado
para `.callout-divergencia`. `globals.css` ganha `.callout-ocr-pendente`, espelhando
`.callout-divergencia`.

## 5. Gate de finalização

`src/app/api/propostas-comerciais/[id]/route.ts` — `PATCH` hoje aceita qualquer `conteudoMarkdown`
não vazio e sempre marca `status: 'concluido'`. Passa a decidir o status pelo conteúdo:

```ts
const temOcrPendente = /:::ocr-pendente/.test(conteudoMarkdown)
status: temOcrPendente ? 'rascunho' : 'concluido'
```

- Salvar com marcador presente **não é erro** — grava o texto e mantém `rascunho`. É isso que
  permite o runner de OCR salvar o resultado sem finalizar.
- A proposta só vira `concluido` quando **todos** os trechos de OCR foram conferidos (nenhum marcador
  sobrou).
- A resposta do PATCH devolve o `status` resultante; o editor mostra "N trechos de OCR ainda não
  conferidos — proposta não finalizada" quando volta `rascunho` com marcador.
- `GET` da lista e da proposta não mudam. A tela de histórico já sabe mostrar `rascunho`.

## 6. Fluxo revisado

1. **Upload** → conversão determinística de hoje + detecção de páginas-imagem. Proposta nasce
   `rascunho` (não mais `erro` para PDF escaneado). Se não houver página-imagem, tudo segue idêntico
   a hoje.
2. **Editor** (`rascunho`): se há `:::ocr-pendente`, aparece o bloco do runner de OCR acima do
   editor e os callouts vermelhos no preview. Botão "Rodar OCR" → processa → modo revisão lado a
   lado → "Conferi" em cada trecho.
3. **Salvar**: sem marcador → `concluido` (fluxo normal). Com marcador → salva e continua `rascunho`,
   com aviso.
4. **Tela final** (`concluido`): inalterada — nunca chega aqui com trecho de OCR pendente.

## 7. Arquivos afetados

**Lógica de extração / OCR**
- `src/lib/extracao/pdfMarkdown.ts` — muda o tipo de retorno de `converterPdfParaMarkdown`; insere
  blocos `:::ocr-pendente`; consome cobertura de imagem por página.
- `src/lib/extracao/pdfTracos.ts` — a passada de operator list por página passa a computar também a
  fração de área coberta por imagem; retorno ganha esse dado ao lado dos segmentos.
- `src/lib/ocr/rodarOcr.ts` *(novo)* — orquestração pura: achar blocos `:::ocr-pendente`, parsear
  `arquivoId`/`pagina`, substituir corpo, remover wrapper. Sem dependência de DOM/tesseract (recebe
  uma função `reconhecer(imagem) => Promise<string>` injetada).

**API**
- `src/app/api/propostas-comerciais/route.ts` — `POST` reescreve `[pagina=n]` → `[arquivoId=… pagina=n]`
  por arquivo; um PDF só com páginas-imagem não vira mais `erro`.
- `src/app/api/propostas-comerciais/[id]/route.ts` — `PATCH` decide `status` por presença de marcador.

**UI**
- `src/app/propostas-comerciais/[id]/ocr-runner.tsx` *(novo)* — botão, barra de progresso, modo
  revisão lado a lado. Carrega `tesseract.js` e `pdf.js` sob demanda.
- `src/app/propostas-comerciais/[id]/editor-markdown.tsx` — monta o `ocr-runner` quando o texto tem
  `:::ocr-pendente`; mostra o aviso de "não finalizado" quando o PATCH volta `rascunho`.
- `src/lib/renderizarMarkdownProposta.ts` — `:::ocr-pendente` → `.callout-ocr-pendente` com link
  para a página do original.
- `src/app/globals.css` — `.callout-ocr-pendente`.

**Dependências**
- `tesseract.js` entra em `dependencies`. É carregado só por `import()` dinâmico dentro do
  `ocr-runner` — não afeta o bundle das outras telas. Os dados `por.traineddata` vêm da CDN do
  projeto Tesseract (padrão do `tesseract.js`), cacheados no navegador.

## 8. Testes

- `src/lib/extracao/pdfTracos.test.ts` — cobertura de imagem: página com operador de imagem grande →
  fração alta; página só com texto/traços → ~0.
- `src/lib/extracao/pdfMarkdown.test.ts` —
  - página sem texto + imagem cobrindo tudo → `paginasImagem` inclui a página, Markdown tem
    `:::ocr-pendente[pagina=N]` na posição certa;
  - página com texto normal → `paginasImagem` vazio, nenhum marcador;
  - texto ralo (< limiar) + imagem grande → marcada;
  - PDF 100% imagem → não devolve `''`, devolve um marcador por página.
  - Ajustar os ~17 testes existentes para o novo tipo de retorno (`.markdown` em vez da string).
- `src/lib/ocr/rodarOcr.test.ts` *(novo)* — parsing de `arquivoId`/`pagina`; substituição de corpo
  mantendo wrapper; remoção de wrapper na conferência; `reconhecer` mockado; erro numa página não
  aborta as outras.
- `src/lib/renderizarMarkdownProposta` (teste existente) — `:::ocr-pendente` vira
  `.callout-ocr-pendente`; texto normal não é afetado.
- `PATCH /api/propostas-comerciais/[id]` *(novo teste pequeno)* — markdown com `:::ocr-pendente` →
  `status: 'rascunho'`; sem marcador → `status: 'concluido'`.
- `ocr-runner.tsx` — teste do fluxo de estados (botão → progresso → revisão → conferir) com
  `tesseract.js` e render de página mockados.

## Fora de escopo

- **OCR ou rasterização de página no servidor**, processamento assíncrono, fila, status
  `processando`, coluna nova no banco — restrição do Vercel Hobby e decisão de manter simples.
- **OCR reconstruindo tabela / layout** — o texto reconhecido entra como linhas de texto; a pessoa
  formata (negrito, `|` de tabela) na conferência.
- **Página escaneada em 2+ colunas** — pode sair em ordem de leitura errada; limitação documentada,
  corrigida na conferência manual.
- **Imagem embutida em .docx / .xlsx** — o `mammoth` já descarta imagem de Word; sem mudança.
- **Coloração por confiança de palavra do OCR** (destacar o que o Tesseract achou duvidoso) —
  possível v2, não agora.
- **Thumbnail da página embutido no preview renderizado / no `conteudoMarkdown`** — evitado de
  propósito (incharia o texto salvo); o lado a lado acontece no modo revisão do runner, com imagem
  em memória, e o callout finalizado só linka para o original.
- **Fidelidade perfeita do texto de OCR** — impossível de garantir; por isso o gate de conferência
  humana obrigatória é o mecanismo central, não um detalhe.
