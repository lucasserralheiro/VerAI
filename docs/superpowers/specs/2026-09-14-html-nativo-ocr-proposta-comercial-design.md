# HTML nativo + OCR melhorado na Proposta Comercial (Conversão SEI)

**Data:** 2026-09-14
**Status:** em desenho

## Contexto

A Proposta Comercial (Conversão SEI) converte PDF/Excel/Word num Markdown determinístico (sem IA),
editado visualmente e depois colado no SEI. Duas dores motivam esta revisão:

1. **Fidelidade da conversão** — "o resultado precisa ser espelho do original": conteúdo que
   quebra formatação, some ou aparece incompleto, sobretudo em página escaneada ou com imagem
   embutida (tabela/print que veio como figura, não como texto).
2. **Markdown é o formato errado pra esse problema.** Investigando o código, Markdown não é só uma
   escolha subótima de sintaxe — ele já está sendo **convertido pra HTML e de volta três vezes**,
   em três pontos diferentes, cada um com perda potencial:
   - `ConteudoEditavelProposta` já edita **HTML** de um `contentEditable` (a pessoa nunca vê
     sintaxe Markdown na edição visual) e converte de volta pra Markdown a cada mudança
     (`htmlEditavelParaMarkdown` — comentário no próprio arquivo: *"round-trip melhor esforço, não
     byte-idêntico"*), só pra guardar como Markdown e renderizar de volta pra HTML na tela seguinte.
   - `.docx` já sai como HTML nativo do `mammoth` — hoje é convertido PRA BAIXO em Markdown
     (`htmlMarkdown.ts`, ~270 linhas de parser próprio) só pra manter tudo uniforme, e depois
     convertido DE VOLTA pra HTML pra renderizar/editar/copiar.
   - `copiarMarkdownFormatado.ts` roda `marked.parse(markdown)` só pra virar HTML de novo antes de
     ir pro clipboard — o destino (SEI) sempre aceitou HTML colado como rich text.

   Guardar **HTML como formato único**, ponta a ponta, elimina as três conversões de volta — cada
   uma delas é uma fonte real de "formatação quebrada" que não tem a ver com a extração do PDF em
   si.

**Decisão de stack (já discutida e fechada antes deste documento):** continua tudo em Node/TS/
Next.js, sem infra nova — nem serviço Python, nem OCR/Document AI pago na nuvem. A melhoria de OCR
é feita dentro do que já existe (`tesseract.js` local, no navegador). IA continua restrita à
checagem textual já existente (`checarConversao.ts`) — não entra em visão, não entra na extração.
Python/serviço externo fica registrado como próximo passo **condicional**, only se a melhoria de OCR
local abaixo, medida contra o corpus real (`scripts/diagnostico-conversao.mts`), não for suficiente.

**O que "espelho" significa na prática:** nunca perder ou inventar conteúdo silenciosamente. Nenhuma
tecnologia de OCR ou extração garante 100% de acerto — por isso o gate de conferência humana
obrigatória (já existente, ver `2026-08-31-ocr-fallback-proposta-comercial-design.md`) continua
sendo o mecanismo real de garantia, não uma promessa desta revisão.

## 1. Extração determinística passa a gerar HTML, não Markdown

`pdfMarkdown.ts` (renomeado — sugestão `pdfHtml.ts`) mantém **exatamente as mesmas heurísticas**
de fidelidade (fonte, posição, traço vetorial, grade de bordas de tabela — nada disso muda), só os
formatadores finais trocam de sintaxe de saída:

| Hoje (Markdown) | Passa a ser (HTML) |
|---|---|
| `**t**` / `*t*` / `<u>t</u>` | `<strong>t</strong>` / `<em>t</em>` / `<u>t</u>` |
| `# t` / `<h1 align="center">t</h1>` | `<h1>t</h1>` / `<h1 style="text-align:center">t</h1>` |
| `<p align="center">`/`justify` | `<p style="text-align:center">`/`justify` |
| `montarTabelaMarkdown` (`\| a \| b \|`) | `<table><thead>...</thead><tbody>...</tbody></table>` |
| `- item` / `1. item` | `<ul><li>` / `<ol><li>` |
| `![Imagem da página N](url)` | `<img alt="Imagem da página N" src="url">` |
| `:::ocr-pendente[arquivoId=… pagina=…]…:::` (pseudo-sintaxe) | `<div class="ocr-pendente" data-arquivo-id="…" data-pagina="…">…</div>` — elemento HTML real, manipulável com `querySelectorAll` em vez de regex sobre string |

`pdfTabelas.ts` (`detectarTabelaPorBordas`) e `pdfImagens.ts` mudam só a chamada final de
montagem de string (tabela/imagem), não a lógica de detecção.

`htmlMarkdown.ts` (conversor do HTML do `mammoth`) deixa de existir como "conversor pra outra
sintaxe" — vira uma sanitização do HTML do `mammoth` pro subconjunto de tags aceito pelo módulo
(mesmo espírito de hoje, "não interpreta nem reescreve", só que a entrada já é o formato de saída —
bem menos código).

## 2. Editor, renderização e cópia passam a operar sobre HTML

- **`ConteudoEditavelProposta`**: grava `ref.current.innerHTML` (normalizado/sanitizado pro mesmo
  subconjunto de tags do restante do pipeline) direto como conteúdo salvo — sem passar por
  `htmlEditavelParaMarkdown`. Elimina o round-trip "melhor esforço" a cada tecla.
- **`renderizarMarkdownProposta.ts`** (renomeado — sugestão `renderizarHtmlProposta.ts`): não
  precisa mais de `marked` — vira só o pós-processamento que já faz hoje (marcar
  `.callout-ocr-pendente` a partir de `div.ocr-pendente`, `.callout-divergencia` em parágrafo que
  começa com "Divergência"), direto sobre o HTML salvo.
- **`copiarMarkdownFormatado.ts`** (renomeado — sugestão `copiarHtmlFormatado.ts`): remove
  `marked.parse` por completo — aplica a mesma fonte/tamanho/estilo de tabela institucional
  (`aplicarFonteInstitucional`, `aplicarEstiloTabela`, inalteradas) direto no HTML já salvo, e
  escreve no clipboard. Uma etapa de parsing a menos entre "o que está na tela" e "o que cola no
  SEI" — categoria inteira de divergência eliminada.
- **Modo "Editar como texto"** (`espaco-proposta.tsx`, textarea de escape): continua existindo pro
  caso em que a edição visual não dá conta — só que edita HTML cru em vez de Markdown cru. É uma
  perda de ergonomia pontual e consciente (HTML é mais verboso de mexer à mão que Markdown); aceita
  porque é o modo secundário — o modo principal (visual, a maioria do uso) só melhora.

## 3. Checagem por IA — adapta, não redesenha

`checarConversao.ts` é o módulo mais maduro do projeto (vários guard-rails contra alucinação,
cada um documentado com um caso real que o motivou: âncora no texto original, `preservaTitulos`,
`trocaConteudoSobRotuloAmbiguo`, dedupe entre páginas). Nada disso muda de propósito — só a função
`semMarcacaoMarkdown` (hoje: regex que tira `#`, `-`/`*`/`+`, `**`, `\|` — sintaxe Markdown) passa a
tirar marcação HTML (tags) em vez de sintaxe Markdown, pra continuar comparando texto puro. O
prompt troca as referências a "MARKDOWN" por "HTML"; a regra central — `trecho`/`correcaoSugerida`
têm que ser cópia literal de um pedaço do documento, nunca invenção — não muda.

**Atenção na implementação:** todo guard-rail existente precisa ser reverificado contra o novo
formato antes de considerar essa parte pronta — ver "Risco conhecido".

## 4. OCR — pré-processamento + tabela reconstruída + cobertura estendida

Três melhorias, dentro do `tesseract.js` local que já existe — nenhuma nova dependência de IA:

- **Pré-processamento de imagem antes do OCR** (`depsOcrPadrao.ts`): hoje a página renderiza em
  `scale: 2` e vai crua pro `tesseract.js`. Passa a aplicar, no canvas: aumento de escala (valor a
  medir contra o corpus, não chutado — mesmo princípio já seguido nas constantes de
  `pdfMarkdown.ts`), binarização/contraste e, se viável, correção de inclinação (deskew). Ganho de
  acurácia de texto reconhecido, sem trocar de motor.
- **Tabela reconstruída a partir da posição das palavras do OCR** — `tesseract.js` já expõe a
  posição (bounding box) de cada palavra reconhecida; hoje `reconhecer` descarta tudo isso e
  devolve só o texto corrido (`data.text`). A mesma heurística geométrica que `pdfMarkdown.ts` já
  usa pro PDF nativo (`corredoresDoBloco`/`absorverTabelaPorPosicao` — corredor vertical vazio que
  atravessa várias linhas) é generalizada pra aceitar posição vinda do OCR, não só do PDF. Quando
  reconhece o padrão, o bloco sai como `<table>`; sem padrão reconhecível, cai pro texto corrido de
  hoje (a pessoa formata na conferência, como já é).
- **Cobertura estendida a imagem de conteúdo embutida** — hoje só página 100% escaneada
  (`paginasImagem`) entra no fluxo de OCR; uma tabela/trecho que vem como IMAGEM dentro de uma
  página de texto normal (`paginasComImagem`) só gera aviso e vira `<img>` muda, sem texto nenhum
  extraído. Passa a entrar no MESMO fluxo `div.ocr-pendente` + conferência lado a lado — é o caso
  concreto por trás de "tabela vira imagem em vez de markdown".
- **Gate de conferência humana obrigatório continua idêntico**, sem relaxar: melhor OCR reduz
  quanto trabalho de correção a pessoa tem na conferência, não substitui a conferência.

## Fluxo revisado

```
Upload (PDF/Excel/Word) → extração determinística → HTML com <div class="ocr-pendente"> nas
                           páginas escaneadas OU com imagem de conteúdo embutida
                                    │
                                    ▼ (se há algum .ocr-pendente)
                    OCR local (tesseract.js) com pré-processamento
                    → tenta reconstruir <table> pela posição das palavras
                    → conferência lado a lado obrigatória (inalterada)
                                    │
                                    ▼ (sem .ocr-pendente restante)
                    Editor visual (contentEditable sobre HTML, sem round-trip)
                    + checagem por IA (texto × HTML, guard-rails adaptados)
                                    │
                                    ▼
                    "Copiar formatado" grava o HTML salvo direto no clipboard
```

## Migração de dado existente

Propostas já salvas em produção têm `conteudoMarkdown` em Markdown. Um script one-shot
(`scripts/migrar-markdown-para-html.mts`, usando `marked` só nesse script de migração) reescreve
todas as linhas existentes pra HTML antes do deploy da nova versão do código — não fica um caminho
de leitura "aceita os dois formatos" permanente no app. Depois da migração, `marked` sai de
`dependencies` (não é mais usado em lugar nenhum do runtime).

## Arquivos afetados

**Extração**
- `src/lib/extracao/pdfMarkdown.ts` → `pdfHtml.ts` — formatadores passam a emitir HTML.
- `src/lib/extracao/pdfTabelas.ts`, `pdfImagens.ts` — ajuste da montagem final de string.
- `src/lib/extracao/htmlMarkdown.ts` → vira sanitização do HTML do `mammoth`.
- `src/lib/ocr/marcadorOcrPendente.ts` — `:::ocr-pendente[...]:::` vira `div.ocr-pendente[data-*]`,
  manipulação por DOM em vez de regex.

**OCR**
- `src/lib/ocr/depsOcrPadrao.ts` — pré-processamento de imagem antes do `recognize`.
- `src/lib/ocr/rodarOcr.ts` — `reconhecer` devolve também posição por palavra.
- `src/lib/extracao/pdfMarkdown.ts`/novo módulo compartilhado — corredor/coluna generalizado pra
  aceitar posição de OCR além de posição de PDF nativo.
- `pdfMarkdown.ts` (detecção de `paginasComImagem`) — passa a alimentar o mesmo fluxo de
  `.ocr-pendente`, não só um aviso.

**Editor / IA / cópia**
- `src/lib/propostaEditavel/htmlEditavelParaMarkdown.ts` — removido (edição visual grava HTML
  direto).
- `src/app/propostas-comerciais/[id]/conteudo-editavel-proposta.tsx` — grava `innerHTML`
  sanitizado direto.
- `src/lib/renderizarMarkdownProposta.ts` → `renderizarHtmlProposta.ts` — só pós-processamento de
  callout.
- `src/lib/copiarMarkdownFormatado.ts` → `copiarHtmlFormatado.ts` — sem `marked.parse`.
- `src/lib/ia/checarConversao.ts` — `semMarcacaoMarkdown` vira remoção de tag HTML; prompt ajustado;
  todos os guard-rails reverificados contra o novo formato.
- `src/app/propostas-comerciais/[id]/espaco-proposta.tsx` — modo "Editar como texto" edita HTML.

**Banco / migração**
- `prisma/schema.prisma` — `PropostaComercial.conteudoMarkdown` (mantém nome de coluna ou renomeia
  pra `conteudoHtml` — decisão de implementação; qualquer um dos dois exige migration).
- `scripts/migrar-markdown-para-html.mts` *(novo)* — reescreve dado existente, roda uma vez.

**Dependência**
- `marked` sai de `dependencies` depois da migração (não sobra nenhum uso em runtime).

## Testes

- `pdfHtml.test.ts` (ex-`pdfMarkdown.test.ts`) — todos os ~17+ casos existentes reescritos pra
  esperar HTML em vez de Markdown; heurísticas de detecção (fonte, posição, borda) inalteradas.
- `htmlEditavelParaMarkdown.test.ts` — removido junto do módulo.
- `copiarHtmlFormatado.test.ts` (ex-`copiarMarkdownFormatado.test.ts`) — mock de
  `navigator.clipboard.write`, confere que o HTML salvo (sem reparse) chega com estilo institucional
  aplicado.
- `checarConversao.test.ts` — todos os testes de guard-rail existentes (âncora no original,
  `preservaTitulos`, `trocaConteudoSobRotuloAmbiguo`, dedupe) reexecutados contra fixtures em HTML —
  nenhum pode regredir.
- `rodarOcr.test.ts`, novo teste de reconstrução de tabela — bloco de palavras com bounding box
  simulando corredor de coluna → espera `<table>`; bloco sem padrão → texto corrido (comportamento
  atual preservado como fallback).
- `depsOcrPadrao` — não temos hoje teste de pré-processamento de imagem; avaliar teste
  baseado em fixture (imagem sintética) no plano de implementação.
- `scripts/migrar-markdown-para-html.mts` — teste com amostra real de `conteudoMarkdown` salvo,
  confere que o HTML resultante renderiza o mesmo conteúdo visível.

## Risco conhecido

- **`checarConversao.ts` é o módulo mais calibrado do projeto** — vários guard-rails nasceram de
  bug real em produção (score que piorava depois de correção certa, correção que apagava seção
  vizinha, troca de conteúdo entre ocorrências do mesmo rótulo). Trocar a base de "sintaxe Markdown"
  por "tag HTML" tem que preservar TODOS eles — risco real de regressão silenciosa se um guard-rail
  continuar assumindo (mesmo sem querer) a sintaxe antiga. Tratar como a parte de maior risco desta
  entrega, não a mais simples.
- **Reconstrução de tabela por posição do OCR é heurística nova**, mesmo reaproveitando lógica já
  testada — não tem corpus de calibração próprio ainda. Mesma ressalva *best-effort* que já vale
  pro resto do conversor: célula mesclada ou layout incomum pode sair errado, corrigido na
  conferência.
- **Teto do pré-processamento local.** Se mesmo com as melhorias acima o `tesseract.js` ainda errar
  muito num PDF difícil, isso é o sinal concreto (medido pelo `diagnostico-conversao.mts`, não
  achismo) pra reabrir a conversa sobre OCR/Document AI pago ou serviço em Python — registrado como
  próximo passo condicional, não descartado nem decidido agora.
- **Sanitização do `contentEditable`.** Navegadores geram HTML irregular ao editar
  (`<div>`/`<span style>`/`<b>` em vez de `<strong>`) — hoje isso é normalizado dentro da conversão
  pra Markdown; com HTML como destino final, a normalização/sanitização (tags permitidas, remoção de
  `style`/`class` soltos) continua necessária, só muda de lugar.

## Fora de escopo

- **Trocar de stack/linguagem (Python) ou adicionar serviço de OCR/Document AI pago na nuvem** —
  decisão já tomada de não fazer isso nesta entrega; vira próximo passo condicional, só se a
  melhoria de OCR local, medida, não for suficiente.
- **IA de visão pra ler a página do PDF diretamente** — decisão mantida de revisões anteriores; IA
  continua só na checagem textual.
- **Editor rich-text novo** — a edição visual (`ConteudoEditavelProposta`) já existe; esta revisão
  só remove o round-trip pra Markdown por trás dela, não troca a experiência.
- **Fidelidade perfeita/"OCR sem erro"** — nenhuma tecnologia garante isso; o gate de conferência
  humana continua sendo o mecanismo real, não uma promessa desta revisão.
- **Migração incremental/formato duplo permanente** (aceitar Markdown E HTML em `conteudoMarkdown`
  indefinidamente) — decisão é migração one-shot antes do deploy, sem caminho de leitura duplo
  permanente no app.
