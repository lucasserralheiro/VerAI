# Navegação e UX do relatório consolidado — design

## Contexto

O menu lateral já agrupa "Clientes" sob o rótulo de seção "Análise de Documentos"
(`src/components/nav-bar.tsx`), mas isso não se reflete dentro das páginas: os
breadcrumbs começam direto em "Clientes", e a aba "Análise consolidada" (dentro de
`/clientes/[id]/[competencia]`) ficou confusa — mistura nomenclatura com o "relatório"
baixável em PDF, exige um fluxo de duas etapas em abas diferentes pra gerar um
resultado, não explica o que faz, e empilha informação sem hierarquia clara.

Paralelamente, botões, badges e títulos em todo o app carregam peso visual (sombra,
`font-semibold`/`font-bold`, uppercase com tracking largo) que foge do padrão de
produtos de referência ("tecnológico premium") como Linear, Stripe, Vercel e Notion —
que usam raio de borda modesto (6–8px), zero sombra, peso médio e bastante espaço em
branco em vez de peso tipográfico pra criar hierarquia.

Este documento cobre dois blocos de mudança:

- **A. Navegação e UX do relatório consolidado** — específico da tela de competência
  do cliente.
- **B. Tokens visuais compartilhados** — botões, badges, tabs, títulos. Como usa
  classes centralizadas (`src/lib/ui.ts`, `src/components/ui/badge.tsx`,
  `table-institucional` em `globals.css`), o efeito é automático em todas as páginas
  que já usam esses componentes, não só na tela de competência.

## A. Navegação e UX do relatório consolidado

### A1. Breadcrumb reflete a hierarquia do menu

O breadcrumb passa a abrir com "Análise de Documentos" como categoria não clicável
(mesmo rótulo já usado como cabeçalho de seção na sidebar), seguida do trilho atual:

```
Análise de Documentos › Clientes › Prefeitura X › Ago/2026
```

Aplica-se aos breadcrumbs em `src/app/clientes/[id]/page.tsx` e
`src/app/clientes/[id]/[competencia]/page.tsx`.

### A2. Vocabulário único: "Relatório"

"Análise" era o termo técnico usado tanto pra o que aparece na tela quanto pra o PDF
baixável, gerando ambiguidade. Unifica-se em "Relatório" em tudo que é visível ao
usuário:

| Hoje | Passa a ser |
|---|---|
| Aba "Análise consolidada" | Aba **"Relatório consolidado"** |
| Aba "Evolução" | Aba **"Relatório de evolução"** |
| Botão "Gerar análise consolidada" | Botão **"Gerar relatório consolidado"** |
| Link "Baixar relatório consolidado" | Link **"Baixar PDF"** (a palavra "relatório" já está no título da aba — repetir é redundante) |
| Link "Baixar relatório de evolução" | Link **"Baixar PDF"** |

"Análise" continua existindo como termo técnico interno (nomes de variável, tipos
TypeScript, comentários) — não precisa de rename em código, só na camada de texto
visível (labels, títulos, copy).

### A3. Ação e resultado no mesmo lugar

Hoje: seleção de documentos mora na aba Documentos (checkboxes + barra fixa no
rodapé), o resultado aparece na aba Relatório Consolidado — duas abas pra uma ação.

Passa a ser: o seletor de documentos muda de lugar, saindo da aba Documentos e
entrando na própria aba **Relatório Consolidado**, no topo:

- **Sem relatório gerado ainda**: o seletor é o conteúdo principal da aba (substitui
  o texto explicativo + botão "Ir para Documentos" que existe hoje como estado vazio).
  Checkboxes pré-marcados com os documentos concluídos (mesma lógica de default que
  já existe), botão "Gerar relatório consolidado" logo abaixo.
- **Com relatório já gerado**: o seletor fica recolhido por padrão, substituído por
  uma linha compacta: `Baseado em: doc1.xlsx, doc2.pdf · Gerar novo relatório`. Clicar
  nessa linha expande o seletor de novo, sem sair da aba.
- A aba **Documentos** perde a barra fixa de seleção/geração — fica só com upload e a
  tabela de gestão de arquivos (ver análise individual, baixar original, excluir), que
  é o que ela já faz bem.
- A aba **Relatório de evolução** não tem esse problema (não depende de seleção
  manual — compara automaticamente com o mês anterior) e não muda nessa frente.

### A4. Hierarquia visual do relatório consolidado

Ordem atual mistura conclusão, evidência e metadado. Nova ordem, do mais importante
pro mais acessório:

1. **Veredito** — divergências em destaque logo no topo da aba ("3 divergências"
   em tom crítico / "Sem divergências" em tom de sucesso). Hoje esse dado só aparece
   no cabeçalho da página (fora da aba); passa a aparecer também dentro dela.
2. **Resumo da IA** — texto corrido, promovido pra logo abaixo do veredito (hoje vem
   depois da tabela).
3. **Tabela comparativa** — a evidência, métrica por métrica.
4. **Proveniência** — linha discreta com o seletor recolhido do item A3 (docs usados,
   data de geração, botão "Baixar PDF").
5. **Histórico** — continua colapsado no rodapé, sem mudança de comportamento.

### A5. Ajuda sempre visível

- **O quê**: subtítulo fixo de uma linha abaixo do título "Relatório consolidado",
  visível tanto no estado vazio quanto com relatório já gerado — não depende de clique:
  > "Compara números que deveriam bater entre documentos diferentes do mesmo mês —
  > pra achar divergência antes de fechar a competência."
- **Como usar**: fica autoexplicado pela própria UI, já que o seletor de documentos
  (A3) mora nessa aba. Uma microcopy curta acima do seletor reforça a ação:
  > "Marque os documentos que devem bater entre si."

Isso substitui o texto explicativo que hoje só existe no estado vazio da aba.

## B. Tokens visuais compartilhados

Mudança em `src/lib/ui.ts` (`BTN_PRIMARY`, `BTN_OUTLINE`, `BTN_OUTLINE_SM`,
`INPUT_BASE`), `src/components/ui/badge.tsx` e classes utilitárias em
`src/app/globals.css` (`table-institucional`, títulos de página, labels de aba).

Referência de bancada (produtos "tecnológico premium" citados: Linear, Stripe,
Vercel, Notion) — todos usam raio de borda modesto (6–8px, nunca pill em botão),
peso de fonte médio (nunca semibold/bold em botão ou corpo de texto), zero sombra
decorativa (borda fina de 1px separa em vez de "flutuar"), bastante espaço em branco.
Isso bate com a categoria `Minimalism & Swiss Style` do banco local do skill
`ui-ux-pro-max`, cujo "Best For" é "Enterprise apps, dashboards, SaaS platforms,
professional tools" — match direto com o VerAI.

### B1. Botões e inputs

- Raio: `rounded-lg` (6.4px) → `rounded-xl` (~8.3px) — ajuste modesto, não pill.
- Peso: `BTN_PRIMARY` sai de `font-semibold` pra `font-medium` (`BTN_OUTLINE` já é
  `font-medium`, sem mudança).
- Sombra: remove `shadow-xs` de `BTN_PRIMARY`, `BTN_OUTLINE` e `BTN_OUTLINE_SM` —
  hierarquia primário/secundário passa a vir só de cor de fundo vs. borda, sem
  elevação.
- Padding: reduz levemente (`px-3.5 py-2` → `px-3.5 py-1.5`) pra ficar mais enxuto.
- `INPUT_BASE` acompanha o mesmo raio (`rounded-xl`) pra manter consistência com
  botões na mesma área (ex: formulário de upload).

### B2. Badges

- Peso: `font-semibold` → `font-medium`.
- Raio: badges são elementos pequenos e não-interativos (chips de status) — nessas
  referências, mesmo em sistemas com botão de raio modesto, o chip/tag geralmente
  fica com `rounded-full` (diferencia visualmente "isto é uma etiqueta" de "isto é um
  botão"). `Badge` passa de `rounded-md` pra `rounded-full`.

### B3. Tabelas (`table-institucional`)

- Cabeçalho (`th`): remove `uppercase` e `tracking-wide`, mantém `font-semibold` (é
  cabeçalho de tabela, não rótulo de ação — pode manter peso pra se diferenciar da
  linha de dados).

### B4. Abas e títulos de página

- Labels de aba (`TABS` na página de competência): remove `uppercase` e
  `tracking-wide`, mantém `font-semibold` só no estado ativo.
- Títulos H1 de página (`text-[1.75rem] font-bold tracking-tight`): `font-bold` →
  `font-semibold`, mantém o tamanho e o `tracking-tight`.

## Fora de escopo

- Redesenho da sidebar em si (só o breadcrumb interno das páginas muda).
- Mudança de paleta de cor (navy/laranja institucional Prodam continua).
- Mudança de fonte (Geist já é a tipografia usada pela Vercel — mantida).
- URL/deep-link por aba (não foi apontado como problema pelo usuário).
- Wizard de página única substituindo as abas (mudança maior, não justificada pelo
  problema relatado).
