# Redesign visual: de "template de IA" para back-office institucional sóbrio

## Contexto

O VerAI já recebeu uma identidade institucional (navy/laranja, commit `04b3459`), mas manteve
uma camada de convenções visuais típicas de produto gerado por ferramentas de IA
(v0/lovable/bolt): gradientes em botão e logo, sombras com glow colorido, blur/dot-grid
decorativos, ícones gigantes em watermark, ícone-em-caixa-colorida por item de lista, cantos
muito arredondados e micro-animações de scale/lift. Nenhum desses elementos carrega
informação — são só decoração, e é isso que faz o app "cheirar" a projeto gerado por IA em vez
de ferramenta de trabalho.

Paralelamente, a visão de produto do VerAI é ser o guarda-chuva de mais de uma
ferramenta/solução dentro do mesmo app (novos módulos entrando como novas áreas na mesma
navbar lateral, não como produtos separados). A navegação e a marca de hoje estão amarradas à
ideia de "análise de documentos" como se fosse o app inteiro — isso precisa ser corrigido junto,
senão o próximo módulo vai entrar como apêndice mal encaixado.

## Objetivo

1. Remover os clichês visuais de "gerado por IA" da UI, adotando uma linguagem de back-office
   institucional sóbrio: cor só com propósito (ação/estado), ícone só quando esclarece uma ação
   ambígua, sombra só onde há elevação real, cantos discretos, sem gradiente/glow/blur/scale
   decorativo.
2. Reestruturar a navbar e a marca para deixar explícito que "Clientes / Documentos /
   Notificações" é a área do módulo de análise de documentos — não o app inteiro — preparando o
   terreno pra um próximo módulo entrar como novo grupo, sem precisar redesenhar a navegação.

## Fora de escopo

- Os PDFs gerados para download (`RelatorioDocument`, `ConsolidadoDocument`,
  `EvolucaoDocument`) — são documentos formais entregues ao cliente, tratados à parte se/quando
  fizer sentido.
- Definir quais serão os próximos módulos ou construir qualquer hub/launcher — só preparar a
  estrutura da navbar/marca pra não travar essa expansão.
- Revisão de paleta de cor (navy/laranja Prodam permanece; só muda *onde e quanto* aparece).
- Mudança de copy/conteúdo (headline do login, textos de página) — a menos que o texto dependa
  diretamente de um elemento visual removido (ex. legenda que só fazia sentido ao lado do blob).

## Princípios da nova linguagem

- **Todo elemento visual carrega informação.** Se um ícone, sombra ou gradiente não ajuda a
  entender ou agir mais rápido, ele sai.
- **Cor com propósito.** Laranja é reservado para ação primária e alerta. Navy é estrutura
  (navbar, cabeçalho de tabela). O resto da interface é neutro (branco/cinza).
- **Flat, não glossy.** Preenchimento sólido e borda fina no lugar de gradiente e sombra com
  brilho colorido. Sombra só em elementos com elevação real (modal, dropdown, sticky bar).
  Cards/linhas de tabela usam borda fina, não sombra flutuante. Isso vale também para o botão
  primário: sólido, sem gradiente e sem glow colorido.
- **Ícone funcional, não decorativo.** Ícone só quando a ação é ambígua sem ele (baixar,
  excluir, expandir/recolher). Ícone nunca vira elemento gráfico grande (watermark, avatar em
  caixa colorida, logo em quadrado gradiente).
- **Radius discreto e consistente.** Cantos pequenos e uniformes — não a maximamente arredondada
  "bolha de app" atual.
- **Sem micro-interação decorativa.** Sem `scale`/`brightness`/`translate-y` no hover de botão e
  card. Transição de estado é só cor/borda.

## Mudanças por camada

### 1. Tokens (`src/app/globals.css`)

- `--radius`: reduz a base (de `0.85rem` para algo como `0.4rem`), o que baixa em cascata toda a
  escala `--radius-sm` … `--radius-4xl` — cards e modais deixam de usar `rounded-2xl`/`rounded-3xl`
  "bolha" e passam a um raio discreto, mais próximo de `rounded-lg`.
- Escala de sombra: simplifica para 1–2 camadas sutis (mantém algo equivalente a `shadow-xs`/
  `shadow-sm` para elevação real); remove o uso decorativo de `shadow-lg`/`shadow-xl`/glow
  colorido fora de modais e barras sticky.
- Remove `.bg-dot-grid` (textura pontilhada decorativa).
- Remove `.icon-watermark` (ícone gigante translúcido em cards de métrica) — os cards de métrica
  passam a ser só label + número, sem esse recurso.
- `.card` / `.card-flush`: acompanham o novo radius/sombra da escala de tokens.
- `.card-interactive`: tira o `hover:-translate-y-0.5` (lift), mantém só troca de
  borda/sombra sutil no hover.

### 2. Botões e inputs (`src/lib/ui.ts`, `src/components/ui/button.tsx`)

Os dois arquivos duplicam o mesmo padrão de botão primário (`ui.ts` tem versões string,
`button.tsx` é o componente shadcn) — ambos precisam do mesmo ajuste:

- **Primário:** troca gradiente `from-[#ff7a34] to-orange` por `bg-orange` sólido; remove o
  glow colorido da sombra (fica só a sombra mínima de elevação real, se alguma); remove
  `hover:brightness-[1.03]` e `active:scale-[0.98]` — hover só escurece pra `orange-dark`.
- **Outline / secondary / ghost:** já são razoavelmente sóbrios; só remove `active:scale-[0.98]`
  e o `hover:shadow-sm` extra (troca de borda já basta como feedback).
- **Inputs:** mantém como estão (já sóbrios) — só acompanha o novo radius global.

### 3. Badge (`src/components/ui/badge.tsx`)

- Remove a sombra "glossy" com highlight interno (`inset_0_1px_0_rgba(255,255,255,0.25)`).
  Fica preenchimento sólido + sombra mínima só se necessário pra contraste.

### 4. Marca / logo (`src/components/nav-bar.tsx`, `src/app/login/page.tsx`)

- Troca o ícone `FileSearch` em quadrado com gradiente e sombra colorida (que amarra a marca
  visualmente a "busca em documento") por um wordmark/monograma neutro — só o texto
  "**VerAI**" (como já aparece ao lado do ícone hoje) ou um bloco sólido com a letra "V", sem
  gradiente, sombra colorida ou scale no hover.
- Isso desacopla a marca da função do módulo atual, coerente com VerAI virar guarda-chuva de
  mais de uma ferramenta.

### 5. Navbar (`src/components/nav-bar.tsx`)

- `TOP_LINKS` (Clientes, Todos os documentos, Notificações) deixa de ficar solto na raiz da
  navbar e passa a viver sob um rótulo de seção — ex. **"Análise de Documentos"** — usando o
  mesmo padrão visual/estrutural que a seção "Configuração" já usa hoje (label + agrupamento).
  Isso deixa a navbar pronta para receber um segundo grupo (próximo módulo) sem precisar
  redesenhar nada.
- Notificações permanece como está por ora (não fica claro ainda se será um serviço
  transversal a outros módulos ou específico deste) — decisão adiada para quando o próximo
  módulo for definido.

### 6. Hero do login (`src/app/login/page.tsx`)

- Remove `.bg-dot-grid`, o glow radial (`radial-gradient(circle_at_top_left,...)`) e o blob
  desfocado (`blur-3xl`). Painel navy fica sólido, sem textura. Mantém headline, copy, divisor
  e rodapé como estão.

### 7. Cards de métrica com watermark (dashboard `src/app/page.tsx`, `documentos/[id]/page.tsx`)

- Remove o ícone gigante translúcido vazando do card (`.icon-watermark`). Tile fica só
  label + número (uppercase kicker do label pode manter função, mas sem o ícone de fundo).

### 8. Listas com ícone-avatar (`src/app/clientes/page.tsx` e padrões equivalentes)

- Remove o ícone em caixa colorida arredondada por item de lista (padrão "avatar"). Linha fica
  mais direta — texto do item como elemento principal, sem elemento gráfico extra por item.

### 9. Modais e barras sticky (`src/app/clientes/[id]/[competencia]/page.tsx`)

- Mantêm sombra (elevação real é legítima aqui), mas acompanham o novo radius/token de sombra
  simplificado — não usar `shadow-xl` "pesado" onde `shadow-md`/token equivalente já resolve.

### 10. Auditoria geral de ícones

Durante a implementação, cada página deve ser revisada com o critério do princípio "ícone
funcional, não decorativo": mantém ícone em ação real (baixar, excluir, ver, expandir/recolher,
paginação), remove onde é só reforço visual redundante ao texto do link/botão.

## Arquivos afetados (mapeados até aqui)

`globals.css`, `src/lib/ui.ts`, `src/components/ui/badge.tsx`, `src/components/ui/button.tsx`,
`src/components/nav-bar.tsx`, `src/app/login/page.tsx`, `src/app/page.tsx`,
`src/app/clientes/page.tsx`, `src/app/clientes/[id]/page.tsx`,
`src/app/clientes/[id]/[competencia]/page.tsx`, `src/app/documentos/[id]/page.tsx`,
`src/app/notificacoes/page.tsx`, `src/app/admin/usuarios/page.tsx`,
`src/app/admin/clientes/page.tsx`, `src/app/admin/regras-notificacao/page.tsx`.

A maior parte do efeito vem em cascata dos tokens/utilitários compartilhados (itens 1–3); os
itens 4–9 são ajustes pontuais por página. O plano de implementação deve confirmar essa lista
arquivo a arquivo.

## Testes / verificação

Sem lógica de negócio envolvida — verificação é visual e por revisão de código:

- `npm run lint` e a suíte de testes existente (`jest`) continuam passando (nenhum teste
  depende de classes CSS específicas, mas confirmar).
- Revisão visual manual das páginas afetadas (dashboard, login, clientes, competência,
  documento, notificações) antes de considerar concluído.
