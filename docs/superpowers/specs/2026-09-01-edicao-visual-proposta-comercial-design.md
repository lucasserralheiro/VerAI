# Edição visual da Proposta Comercial

## Contexto

Hoje, editar o texto da proposta acontece numa aba "Editar texto" com uma
`textarea` de Markdown cru (`#`, `**`, `|`) — confuso pra quem não conhece
Markdown. Este design troca isso por edição **direto na visualização
renderizada**, como um documento normal, mantendo o Markdown só como formato
de armazenamento interno.

## Princípio

- O usuário nunca precisa ver `#`/`**`/`|` pra editar texto e número.
- A conversão HTML↔Markdown é "melhor esforço": estrutura e conteúdo
  preservados, mas não byte-idêntica. Reestruturação (mover seção,
  adicionar linha de tabela) fica fora de escopo — é edição de texto/número,
  não um editor de documento completo.
- Existe uma saída de emergência discreta ("Editar como texto") pros casos em
  que a edição visual não dá conta.

## Fluxo por tela

**Tela final (`status: concluido`):** a aba "Visualizar" vira o conteúdo
**sempre editável**. Mexer em algo faz aparecer **"Salvar alterações"**
(PATCH). Não existe mais "Editar novamente" nem o modo de edição separado —
`page.tsx` sempre mostra `PropostaFinal` pra esse status. O menu de arquivos
originais (hoje só no editor) passa a aparecer também aqui.

**Rascunho (`status: rascunho`, logo após gerar):** mesma visão editável
dentro de `EditorMarkdown`; o botão "Salvar" continua concluindo a proposta
(PATCH, `status → concluido`).

Em ambas as telas, **"Copiar formatado"** e **"Correção da IA"** operam sobre
o Markdown atual — incluindo edições ainda não salvas.

## Componente editável

`ConteudoEditavelProposta` (`src/app/propostas-comerciais/[id]/conteudo-editavel-proposta.tsx`):

```ts
interface ConteudoEditavelPropostaProps {
  markdown: string
  onChange: (markdown: string) => void
}
```

- Renderiza `renderizarMarkdownProposta(markdown)` dentro de um
  `div contentEditable="true"` com a classe `markdown-preview` (mesma
  aparência visual de hoje).
- **`onInput`** → debounce de ~400ms → converte o HTML atual do container pra
  Markdown via `htmlEditavelParaMarkdown` → chama `onChange`.
- **`onPaste`** → `e.preventDefault()`; insere só `clipboardData.getData('text/plain')`
  na posição do cursor (`document.execCommand('insertText', …)` ou
  equivalente via Selection API). Evita que colar do Word/navegador traga
  `<span style>`, fonte, cor.
- **`onKeyDown`** → se o cursor está dentro de `<td>`/`<th>`, `Enter` é
  prevenido (não quebra a estrutura da tabela). Fora de tabela, comportamento
  padrão do navegador (parágrafo novo).
- **Re-render controlado:** o HTML interno só é regerado a partir do
  `markdown` recebido por prop na montagem e quando esse `markdown` muda por
  uma fonte **externa** ao próprio editor (ex.: "Usar correções" da revisão de
  português aplicou um novo texto). Uma mudança que veio do próprio `onInput`
  não força um re-render (evita o cursor pular).
- `beforeunload` registrado enquanto há alteração não salva (o componente pai
  informa isso via prop `sujo` ou o próprio componente expõe o estado sujo
  pro pai — decisão de implementação, não de design).

## Conversão HTML → Markdown

Módulo `src/lib/propostaEditavel/htmlEditavelParaMarkdown.ts` — baseado em
DOM (`DOMParser`), não regex (o `contentEditable` do navegador produz HTML
mais irregular que a saída do mammoth que `htmlMarkdown.ts` já trata).

**1. Normalização** do container antes de converter:
- remove atributos `style` e `class` de todos os nós (exceto o próprio
  container);
- desembrulha `<span>` (mantém só o texto/filhos);
- `<b>` → `<strong>`, `<i>` → `<em>`;
- `<div>` de bloco (o jeito mais comum de o navegador criar parágrafo no
  `contentEditable`) → tratado como `<p>`;
- nós de texto só com espaço/`&nbsp;` entre blocos são descartados; `&nbsp;`
  vira espaço normal;
- `<div class="callout-divergencia">` (inserido pelo pós-processamento de
  `renderizarMarkdownProposta`) é desembrulhado pro `<p>` interno — o texto
  começando em "Divergência" volta a virar callout sozinho na próxima
  renderização, não precisa preservar a marcação.

**2. Conversão** da árvore normalizada, reaproveitando (extraída pra função
compartilhada) a lógica de tabela e lista que já existe em
`src/lib/extracao/htmlMarkdown.ts`:
- `h1`–`h6` → `#`…`######`;
- `p` → parágrafo;
- `strong`/`em` → `**`/`_`;
- `a` → `[texto](url)`;
- `ul`/`ol`/`li` (com aninhamento) → lista Markdown;
- `table` (`thead`/`tbody`/`tr`/`td`/`th`) → tabela Markdown;
- `hr` → `---`.

**Contrato:** round-trip "melhor esforço" — `Markdown → HTML → Markdown` sem
edição do usuário preserva conteúdo e estrutura, mas não é garantido
byte-idêntico (espaçamento pode normalizar).

## Escape hatch — "Editar como texto"

Componente `src/app/propostas-comerciais/[id]/editar-como-texto.tsx`:

```ts
interface EditarComoTextoProps {
  markdown: string
  onChange: (markdown: string) => void
}
```

- Um link discreto abaixo do conteúdo editável: **"Editar como texto"**.
- Ao clicar, revela a `textarea` de Markdown cru (reaproveita o visual que já
  existe hoje na aba "Editar texto"), inicializada com o `markdown` atual.
- Mudanças na textarea chamam `onChange` diretamente — sem passar pelo
  conversor HTML→Markdown.
- Um botão/link "Voltar pra edição normal" fecha a textarea e volta o
  `ConteudoEditavelProposta` a exibir o `markdown` atual (incluindo o que foi
  digitado na textarea).
- É deliberadamente secundário: não é aba, não compete visualmente com o
  fluxo normal.

## Telas — mudanças

**`proposta-final.tsx`:**
- A aba "Visualizar" passa a renderizar `ConteudoEditavelProposta` (+
  `EditarComoTexto` abaixo). A aba "Correção da IA" continua como está.
- Estado `sujo` (mudou desde o último save) + botão **"Salvar alterações"**
  que aparece só quando sujo → `PATCH` com o Markdown atual → limpa o sujo.
- Remove `onEditarNovamente`/"Editar novamente".
- Ganha o menu de arquivos originais (`MenuArquivosOriginais`, hoje só em
  `editor-markdown.tsx` — extraído pra um componente compartilhado ou
  duplicado conforme o que for menor risco na implementação).
- `handleCopiarFormatado` e o `markdownAtual` passado pro
  `PainelRevisaoPortugues` usam o Markdown atual (editado, salvo ou não).

**`editor-markdown.tsx`:**
- As abas "Visualizar"/"Editar texto" são substituídas por
  `ConteudoEditavelProposta` + `EditarComoTexto`. A aba "Correção da IA"
  continua.
- "Salvar" continua chamando `onSalvar(markdown atual)`.

**`page.tsx`:**
- Remove o estado `modoEdicao` e o branch que mostrava `EditorMarkdown`
  quando `status === 'concluido'`. Regra simplificada:
  `status === 'rascunho'` → `EditorMarkdown`; `status === 'concluido'` →
  `PropostaFinal`.

## Testes

- `htmlEditavelParaMarkdown`: normaliza `<span style>`, `<b>`/`<i>`, `<div>`
  de parágrafo; produz Markdown correto de título/negrito/lista/tabela;
  desembrulha `.callout-divergencia`; converte `&nbsp;`.
- `ConteudoEditavelProposta`: `onChange` chamado (com debounce) ao digitar;
  paste insere só texto puro (sem estilo); `Enter` dentro de `<td>` não
  insere quebra de bloco; re-render só quando o `markdown` muda por fora.
- `proposta-final`: "Salvar alterações" só aparece quando sujo e some após
  salvar; "Copiar formatado" usa o texto editado (não salvo); o painel de
  correção recebe o texto editado como `markdownAtual`; sem "Editar
  novamente" na tela.
- `editar-como-texto`: alterna exibição da textarea; editar nela propaga
  `onChange`; "Voltar" fecha e mantém o texto.
- `editor-markdown`: idem — `ConteudoEditavelProposta` no lugar das duas
  abas antigas.

## Fora de escopo

- Reestruturação visual (mover seção, adicionar/remover linha ou coluna de
  tabela, reordenar lista).
- Editor rich-text de biblioteca (TipTap) — descartado no brainstorming.
- Qualquer IA na conversão HTML↔Markdown — é 100% determinística, igual ao
  resto da Proposta Comercial.
- Colaboração em tempo real / múltiplos editores simultâneos.
