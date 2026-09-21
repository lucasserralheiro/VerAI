# TASKS 008 — Backlog da Acessibilidade da Camada de Interação

| | |
|---|---|
| **Especificação** | [ESPEC 008](../specs/008-acessibilidade-da-interacao.md) v1.0 |
| **Plano** | [PLANO 008](../plans/008-plano-acessibilidade-da-interacao.md) v1.0 |
| **Versão** | 1.0 — 2026-08-07 |
| **Total** | 43 tarefas · 3 insumos |
| **Status** | **Concluído** — 41 tarefas · P1 e P3 fechados · **P2 pendente de `K-01`** · `K-02` e `K-03` pendentes |

> Escrito **antes** da implementação, como o TASKS 003 e o TASKS 004.

---

## 1. Convenções

**Identificadores** `T-4nn` seguem a numeração do PLANO 008. `K-nn` são insumos do
solicitante.

**Definição de pronto de qualquer tarefa:** código e teste na mesma entrega;
`tsc --noEmit`, `next lint` e `playwright test` verdes; comentário explicando o *porquê*
onde a escolha não for óbvia.

> A definição de pronto do backend — `ruff`, `mypy`, `pytest` — não se aplica: **nenhuma
> tarefa deste backlog toca `backend/`.** Os 308 testes entram uma vez, na T-439, como
> regressão.

**Convenção de commit** `<tipo>(T-4nn): descrição`.

### 1.1 Três regras que atravessam o backlog

**1 — Nenhuma tarefa move posição ou tamanho, fora das cinco exceções.** A ESPEC 008 §3
fez disso critério de aceite. As mudanças de aparência sancionadas são estas, e só estas:

| Tarefa | Delta | Reflui? |
|---|---|---|
| T-406 · T-407 | Cor de texto em 8 nós, mais o texto do botão desabilitado | Não |
| T-415 | Corpo do `<h2>` do estado bloqueado | **Sim**, no estado `bloqueado` |
| T-421 | Indicador de atividade — giro e linha de espera | **Sim**, no estado `processando` |
| T-422 | Traço da borda dos cartões — tracejada para sólida | Não |
| T-427 | Legenda do grid | **Sim**, no estado `pronto` |

Se uma tarefa exigir uma sexta, **pare**. A T-438 compara contra exatamente estas cinco.

> **A lista nasceu com quatro e fechou com cinco.** A T-421 acrescenta um giro e uma
> linha de texto ao estado `processando` — `R-ACE-16` a exige, e ela reflui. Não estava
> prevista aqui nem na ESPEC 008 §9.2, pela mesma razão que a T-415 não estava: a §9.2
> foi escrita contando só as mudanças óbvias. A T-441 emenda as duas.

**2 — `sr-only` não conserta problema visual.** Se a solução de uma tarefa for
"acrescentar texto para leitor de tela e deixar o visual como está", **pare** — é a D-09
da espec. `sr-only` acrescenta contexto que o layout já dá aos olhos; nunca o substitui.

**3 — `backend/` não é tocado.** Nenhum arquivo de `domain/`, `application/`,
`infrastructure/` ou `api/`. Se uma tarefa parecer exigir mudança no backend, **pare** —
`RespostaRelatorio` já traz tudo o que esta entrega consome.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Situação |
|---|---|---|---|
| **E0** O instrumento e a linha de base | T-401 … T-405 | **P1** | ✅ |
| **E1** Cor e foco | T-406 … T-411 | — | ✅ |
| **E2** Anúncio e foco de resultado ⚠️ | T-412 … T-417 | **P2** | ✅ automático · ⬜ `K-01` |
| **E3** Formulário | T-418 … T-423 | — | ✅ |
| **E4** Grid | T-424 … T-431 | — | ✅ |
| **E5** Higiene e verificação do conjunto | T-432 … T-439 | **P3** | ✅ automático · ⬜ T-437 manual |
| **E6** Documentação | T-440 … T-443 | — | ✅ |

### Resultado

| O que | Antes | Depois |
|---|---|---|
| Nós de texto abaixo de 4,5:1 | **155** | **0** |
| Pior contraste | 2,60:1 — botão desabilitado | **7,24:1** |
| Violações `axe` A/AA · 4 estados × 2 larguras | 9 | **0** |
| Percurso de teclado | falha no passo 1 | **8 de 8** |
| `title` como portador único | 2 | **0** |
| `th` sem `scope` · tabelas anônimas | todos · 22 | 0 · 0 |
| Suíte de navegador | 2 testes | **26 testes**, ~10 min |
| Testes de backend | 308 | **308, não tocados** |
| Dependências de produção | — | **nenhuma nova** |

### Evidência do P3 — T-438

Dez capturas comparadas, antes contra depois, mesma máquina. **Toda diferença é
atribuível**, e a nenhuma sexta:

| Captura | Diferença | Delta |
|---|---|---|
| `inicial` · `erro` — ambas larguras | faixas de cor no parágrafo, nos cartões e no botão | T-406 · T-407 · T-422 |
| `processando-1366` | as mesmas faixas, mais y 350–389 e y 406–444 | **T-421** |
| `processando-390` | +44 px de altura | **T-421** |
| `bloqueado-1366` · `bloqueado-390` | +8 px e +16 px de altura | **T-415** |
| `pronto-1366` · `pronto-390` | +52 px e +68 px de altura | **T-427** |

Nenhuma captura mudou de **largura** — o critério que pegou o defeito da §2.4.

### Desvios

| Tarefa | O que mudou | Por quê |
|---|---|---|
| **T-401** | As capturas foram perdidas na primeira execução da suíte, e a linha de base teve de ser reconstruída revertendo os arquivos ao HEAD | O Playwright **apaga `test-results/` inteiro** a cada execução, e foi onde eu as guardei. Corrigido com `outputDir` numa subpasta. Foi o único ponto de não retorno do backlog, e eu o pisei |
| **T-402** | Entraram **três** devDependencies, não uma: `@axe-core/playwright`, `axe-core` e `sharp` | `sharp` é o comparador de imagem da T-438. Já estava em disco como transitiva do Next; torná-la explícita é mais honesto que importá-la por caminho de `.pnpm` |
| **T-402** | Varredura passou a rodar em **duas larguras** | A 1366 px o grid não transborda — ver abaixo |
| **T-403** | Precisou congelar `transition` e pular `aria-hidden` | Duas fontes de falso positivo — §2.3 |
| **T-421** | Virou o **quinto** delta de aparência, não previsto | §1.1 |
| **T-428 · T-427** | Exigiram `relative` nas células | Introduziram transbordo horizontal — ver abaixo |
| **T-435** | Além do nome do arquivo, cinco seletores `getByText("Processando")` tiveram de virar `getByRole` | O `sr-only` da T-412 acrescentou um segundo texto "Processando" na página, e o seletor por texto passou a resolver dois elementos |

### As três coisas que a implementação ensinou

**1 — O `axe` acusou duas regras, não as que o plano previa.** Sobre o código quebrado ele
encontrou `color-contrast` e `scrollable-region-focusable`. Não encontrou `scope` ausente,
tabela sem nome, região viva ausente, foco perdido ao desabilitar nem `title`
inalcançável — nenhuma delas é marcação inválida. O PLANO 008 §5 dava `th`/`scope` como
coberto pelo `axe`; não é. Quem verifica `R-ACE-09` é a T-431.

**2 — O defeito mais grave da entrega foi introduzido por uma correção de
acessibilidade.** Os `sr-only` das T-427 e T-428 são `position: absolute`, e sem ancestral
posicionado se ancoram no bloco inicial: escaparam do contêiner que rola e levaram o
`scrollWidth` da página de 390 para **845 px** a 390 px de largura — rolagem horizontal do
documento no celular. Não aparece a 1366 px, não quebra teste nenhum e o `axe` não vê,
porque a marcação está correta.

Quem pegou foi a **comparação de captura**, pela largura da imagem. A régua que encontrou
o pior defeito desta entrega não foi a de acessibilidade.

**3 — A lista de exceções de aparência cresceu duas vezes.** A ESPEC 008 §9.2 previu duas;
este backlog nasceu com quatro; fechou com cinco. Todas as adições são exigidas por regras
da própria espec. Escrever a lista antes de medir subestima — e é por isso que a T-438
compara contra a lista, e não confirma a lista contra o que saiu.

### O que ainda não foi verificado

**A escuta.** O portão **P2** exige ouvir o anúncio em leitor de tela e depende do `K-01`.
A montagem da região viva está verificada nas duas direções — o teste da T-416 falha
quando o invólucro volta para dentro do retorno condicional —, mas **isso não é o mesmo
que o anúncio ter sido ouvido**.

**O percurso com o mouse desconectado.** A T-437 automatizada passa nos 8 passos. A forma
escrita da tarefa é humana e não foi executada.

**Este backlog é inteiramente reversível.** Nada foi substituído, `backend/` não foi
tocado, e nenhuma dependência de produção entrou.

### 2.1 Ponto de não retorno

**Um só, e é o primeiro.** A T-401 tira a linha de base do layout atual. Editar qualquer
arquivo de `frontend/src/` antes dela destrói a única referência contra a qual o P3 pode
ser verificado, e ela não é reconstruível.

Fora disso o backlog é inteiramente reversível: nada é substituído, `backend/` não é
tocado, e reverter é `git revert` do épico.

### 2.2 Um desvio já conhecido, antes de começar

A T-415 muda o corpo do `<h2>` do estado bloqueado, e isso **reflui o layout** naquele
estado. A ESPEC 008 §9.2 lista só duas exceções — cor e legenda —, mas a `R-ACE-12` exige
a mudança. A espec está internamente inconsistente neste ponto.

**Registrado agora, não contornado.** A T-441 emenda a §9.2 para listar as quatro
exceções da §1.1. Não se ajusta a régua depois da medição — é a conduta da ESPEC 007 §13.

### 2.3 A linha vermelha — T-405

Medido em 2026-08-07, sobre `feature/evolucao`, antes de qualquer edição em
`frontend/src/`. É o "antes" que a T-436 contradiz.

**Contraste (T-403)** — 4 estados. **155 nós** abaixo de 4,5:1:

| Ocorrências | Contraste | Cor | Onde |
|---|---|---|---|
| 102 | 3,61:1 | `#628A93` sobre `#FAFAFA` | Cabeçalho das tabelas, 11 px |
| 36 | 3,77:1 | `#628A93` sobre branco | Coluna **Unidade**, 14 px |
| 8 | 3,55:1 | `#628A93` sobre `teal-50/40` | Descrição dos campos, 12 px |
| 5 | 3,50:1 | `#628A93` sobre `surface` | Parágrafo de abertura, 14 px |
| 3 | 3,77:1 | `#628A93` sobre branco | Subtítulo do grid e auxiliares |
| **1** | **2,60:1** | `#628A93` sobre `#C8D9E6` | **Botão desabilitado** |

**Todos os 155 são o mesmo token.** A ESPEC 008 §2.2 previu o valor e os fundos; a
medição confirmou os dois.

**`axe` (T-402)** — 4 estados × 2 larguras:

| Regra | Ocorrências |
|---|---|
| `color-contrast` | 8 |
| `scrollable-region-focusable` | **1 — só a 390 px** |

**Teclado (T-404)** — falha no **passo 1**: o primeiro `Tab` cai no
`input[type=file]`, sem link de pulo e com nome acessível vazio.

#### O que a linha vermelha ensinou, e não estava previsto

**1 — A rolagem do grid não transborda no desktop.** A 1366 px a tabela mede
832 px dentro de 848 px úteis. O defeito da `R-ACE-05` **só existe abaixo de
~880 px**, e uma varredura só no desktop daria a regra por cumprida. A T-402
passou a varrer nas duas larguras por causa disto.

**2 — `axe` sozinho encontra menos do que o PLANO 008 §5 estimou.** Ele acusou
**duas** regras. Não acusou a falta de `scope`, a falta de nome nas 22 tabelas, a
ausência de região viva, o foco perdido ao desabilitar nem o `title` inalcançável
— porque nenhuma delas é marcação inválida. A tabela do PLANO 008 §5 subestimou:
`th-has-data-cells` existe, mas `scope` ausente **não é violação** para o `axe`,
é técnica recomendada. `R-ACE-09` é verificada pela T-431, não pelo `axe`.

#### Duas calibragens que o instrumento exigiu

| Falso positivo | Correção |
|---|---|
| Botão medido **no meio da `transition`** — 2,86:1 numa cor que não existe em estado nenhum | Congelar `transition` e `animation` antes de medir |
| Divisor `·` da barra, `aria-hidden`, a 1,45:1 | Pular subárvores `aria-hidden`: a WCAG 1.4.3 isenta decoração pura, e a ESPEC 006 §257 já a declarou |

Ambas produziriam reprovação sobre defeito inexistente — que é o modo de falha
oposto ao que o P1 vigia, e igualmente corrosivo.

---

## 3. Épico E0 — O instrumento e a linha de base `[portão P1]`

> A fase que dá sentido às outras. **Nenhum arquivo de `frontend/src/` é tocado aqui.**

#### T-401 — Captura de referência
**Tamanho:** M · **Ref:** ESPEC 008 §9.2 · **Ponto de não retorno**

Oito capturas: quatro estados — `inicial`, `processando`, `pronto`, `bloqueado` — em
1366 × 768 e 390 px. Destino `frontend/test-results/a11y-baseline/`, que já é ignorado
pelo git (`.gitignore:36`) — a baseline **não é versionada**, pelo motivo do PLANO 008 §9.

Três cuidados que a captura ingênua não tem:

| Cuidado | Por quê |
|---|---|
| O estado `processando` exige `page.route` com atraso | Ele é transitório. Sem interceptar a chamada, não há como capturá-lo |
| `fullPage: true` com o `<header>` `sticky` | A barra pode ser recomposta em cada faixa. Conferir a imagem, não confiar |
| Mesmos dois arquivos de fixture, sempre | Nome de arquivo aparece no cartão. Fixture diferente vira diferença falsa na T-438 |

**Pronto quando:** as oito imagens existem, e a de `processando` mostra o botão em
`Processando…`.

---

#### T-402 — `axe-core` no arnês de teste
**Tamanho:** P · **Ref:** ESPEC 008 §9.2, PLANO 008 §6.1

`pnpm add -D @axe-core/playwright axe-core`. Varredura nos quatro estados.

**Restringir as etiquetas a `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`.** O conjunto
padrão do `axe` inclui `best-practice`, que não é norma e produziria reprovação fora do
escopo — a ESPEC 008 §4 recusou AAA explicitamente, e um portão que reprova por regra não
acordada é um portão que se aprende a ignorar.

Roda sobre `pnpm dev`, como todo o Playwright do projeto. A justificativa está no
PLANO 008 §6.2: para `axe`, dev e produção não diferem.

**Pronto quando:** a varredura roda nos quatro estados e **reprova**, listando ao menos
`color-contrast`, `scrollable-region-focusable` e `th-has-data-cells` ou equivalente.

---

#### T-403 — Script de contraste
**Tamanho:** M · **Ref:** `R-ACE-01`

Percorre os nós de texto, lê `getComputedStyle` da cor e do fundo **efetivo**, calcula
pela fórmula WCAG 2.1 e reprova abaixo de 4,5:1.

**Por que não bastam os `color-contrast` do `axe`:** ele **isenta controle desabilitado**,
e a `R-ACE-01` diz expressamente que não isenta — o botão desabilitado é o **estado
inicial** do primário desta tela. O `axe` também pula o nó quando não consegue determinar
o fundo, e devolve "incomplete", não "violation". Os dois casos são exatamente os que
importam aqui.

> **O ponto difícil é o fundo.** `bg-teal-50/40` chega ao `getComputedStyle` como `rgba`
> com alfa 0,4. Compor sobre o ancestral opaco é obrigatório — ler o `rgba` como se fosse
> a cor final dá o número errado, e dá para o lado otimista.

**Pronto quando:** o script lista **os 8 usos de `navy-300`** da ESPEC 008 §2.2 mais o
texto do botão desabilitado, com os contrastes batendo com a tabela da espec.

---

#### T-404 — Teste de percurso de teclado
**Tamanho:** M · **Ref:** `R-ACE-04` a `R-ACE-08`

Escrito contra o percurso **proposto** da ESPEC 008 §6, não contra o atual. Ele nasce
vermelho e vai ficando verde tarefa a tarefa — é o painel de progresso do backlog.

Cada passo afirma `document.activeElement` e, onde houver foco, **que o indicador é
visível**.

> **Cuidado que derruba o teste ingênuo:** `ring-2` do Tailwind compila para `box-shadow`,
> não para `outline`. Um teste que só afirme `outlineWidth !== "0px"` reprova o anel
> correto da T-409. Afirmar os dois.

**Pronto quando:** o teste roda, falha **no passo 2** — foco no primeiro `input[type=file]`
sem indicador visível — e a mensagem de falha diz qual passo quebrou.

---

#### T-405 — Registro da linha vermelha
**Tamanho:** P · **Ref:** **P1**

A saída das T-402, T-403 e T-404 consolidada numa seção deste documento: qual violação,
em que arquivo, quantas. É o "antes" que a T-436 vai contradizer.

**Pronto quando:** o registro está neste arquivo e a contagem bate com a ESPEC 008 §2.

---

**Verificação do E0 — `P1`:** os três instrumentos **reprovam**, nos lugares que a
ESPEC 008 §2 mapeou. **Se algum vier verde, ele está medindo outra coisa** — corrigir o
instrumento antes de escrever uma linha de correção.

---

## 4. Épico E1 — Cor e foco

> Torna legível o que está na tela e visível onde está o foco. Fecha a base de comparação.

#### T-406 — `navy.300` → `#4E747E`
**Tamanho:** P · **Ref:** `R-ACE-01`, D-02 · **Delta de aparência 1/4**

Em `tailwind.config.ts`, com os três contrastes em comentário, como a ESPEC 005 fez com
`brand` — a regra fica onde quem for usar o token vai lê-la.

Os **8 usos são todos `text-`** — verificado na ESPEC 008 §2.2. Nenhum é borda, nenhum é
fundo, e por isso não é preciso token companheiro.

**Pronto quando:** a T-403 fica verde nos 8, com 4,73:1 / 5,09:1 / 4,83:1.

---

#### T-407 — Texto do botão desabilitado
**Tamanho:** P · **Ref:** `R-ACE-01`

`navy-300` sobre `navy-100` dá 2,60:1. Vira `navy-600`, que dá **7,24:1**.

> **Armadilha de sequência, e é silenciosa.** A classe hoje é `disabled:text-navy-300`, e
> a variante `disabled:` do Tailwind depende do **atributo real**. A T-419 troca `disabled`
> por `aria-disabled` — e nesse instante a variante deixa de casar e a cor volta ao padrão,
> sem erro, sem aviso, sem teste vermelho.
>
> **Escrever já aqui como expressão condicional de classe**, nunca como variante
> `disabled:`. Vale para todas as classes `disabled:` do botão, não só a cor.

**Pronto quando:** o botão desabilitado tem 7,24:1 na T-403, **e a asserção continua verde
depois da T-419**.

---

#### T-408 — Regra `:focus-visible` global
**Tamanho:** P · **Ref:** `R-ACE-04`

Em `globals.css`. Não existe nenhuma hoje — é a origem direta do defeito mais grave da
espec.

Dois cuidados:

| Cuidado | Por quê |
|---|---|
| Seletor em `:where(...)` | Especificidade zero: componente sobrepõe sem `!important` |
| **Excluir `[tabindex="-1"]`** | A T-414 dá foco programático a um `<h2>`. Sem a exclusão, o cabeçalho recebe anel ao ser focado, o que confunde quem enxerga — o alvo é leitura, não ação |

O anel usa `teal-500`, que dá 7,05:1 sobre branco e satisfaz com folga os 3:1 exigidos de
elemento de interface.

**Pronto quando:** `Tab` em qualquer link ou botão produz anel visível, e o `<h2>` da
T-414 **não** o recebe.

---

#### T-409 — Foco visível nos cartões de upload
**Tamanho:** P · **Ref:** `R-ACE-04`

O `input[type=file]` é `sr-only`. Ele continua focável e o foco continua invisível — o
`<label>` precisa reagir.

**Usar `has-[:focus-visible]:`, não `focus-within:`.** O `focus-within` dispara também no
clique de mouse, porque clicar o rótulo foca o input: o anel apareceria para quem não
precisa dele. O Tailwind do projeto é 3.4.1, e as variantes `has-*` estão disponíveis.

`ring-offset-2` exige cor de deslocamento; o cartão está sobre `bg-white`, que é o padrão
— conferir, não supor.

**Pronto quando:** `Tab` mostra o anel no cartão; **clique não mostra**; a T-404 passa dos
passos 2 e 3.

---

#### T-410 — Link de pulo
**Tamanho:** P · **Ref:** `R-ACE-08`

Primeiro filho do `<body>` em `layout.tsx` — **antes de `{children}`**, senão não é o
primeiro focável. `id="conteudo"` no `<main>` de `page.tsx`.

> A barra é `sticky` e mede **73 px** (ESPEC 007 §13). Sem `scroll-margin-top` no alvo, o
> pulo deposita o topo do formulário **debaixo da barra** — o link funciona para o foco e
> falha para o olho.

**Pronto quando:** o primeiro `Tab` do documento revela o link; acioná-lo põe o foco no
`<main>` e o topo do formulário **visível abaixo da barra**.

---

#### T-411 — Nova linha de base
**Tamanho:** P · **Ref:** ESPEC 008 §9.2, PLANO 008 §6.3

Repetir a T-401, mesma máquina, mesmo navegador, mesma fixture.

É o que dá gume ao P3: da E2 em diante, **qualquer** diferença de captura que não seja
T-415, T-422 ou T-427 é defeito.

**Pronto quando:** as oito imagens novas existem e diferem das da T-401 **apenas** em cor
de texto e no anel de foco.

---

**Verificação do E1:** T-403 verde; T-404 passa dos passos 1 a 3 e falha adiante, como
esperado.

---

## 5. Épico E2 — Anúncio e foco de resultado `[portão P2]`

> A fase de maior risco do backlog. O defeito principal **não tem detecção automática**.

#### T-412 — Invólucro `aria-live` montado desde o primeiro render
**Tamanho:** M · **Ref:** `R-ACE-13`, **D-03** · **Risco**

`ResultadoPanel` hoje devolve `null` no estado inicial. O invólucro `aria-live` passa a
ser devolvido **sempre**, com o conteúdo condicional por dentro.

> **A implementação intuitiva não funciona e não avisa.** Envolver o conteúdo em
> `aria-live` por dentro do `return null` produz marcação correta e comportamento nulo:
> leitores anunciam **mutação** de região já presente na árvore, não inserção de região
> nova. O sintoma é ausência de som. Passa por revisão de código, por `axe` e por qualquer
> asserção de DOM.

Dois detalhes: `aria-atomic="false"`, para não reler o painel inteiro a cada mudança; e o
invólucro **não pode** nascer em `display:none`.

**Pronto quando:** o invólucro está no DOM antes de qualquer envio (T-416) **e** o anúncio
é ouvido (T-417). As duas condições — a primeira sozinha não prova nada.

---

#### T-413 — `role="alert"` em erro e bloqueio
**Tamanho:** P · **Ref:** `R-ACE-14`

> `role="alert"` carrega `aria-live="assertive"` implícito e vai ficar **dentro** do
> invólucro `polite` da T-412. Regiões vivas aninhadas são válidas e o papel interno
> prevalece no seu subárvore, mas há risco real de **anúncio duplicado** dependendo do
> leitor. A T-417 verifica que o bloqueio é anunciado **uma vez**.

**Pronto quando:** os estados `erro` e `bloqueado` têm `role="alert"`, e a T-417 confirma
anúncio único.

---

#### T-414 — Foco no título do resultado
**Tamanho:** P · **Ref:** `R-ACE-15` · **Depende de:** T-408

`useEffect` sobre `estado.situacao`; `tabIndex={-1}` no `<h2>` e `ref.focus()` ao entrar
em `pronto` ou `bloqueado`.

O alvo é **título, não controle**: nada é acionado, e o foco pousa no topo do que acabou
de surgir. É o que impede que a T-419 — botão que permanece focável — deixe o usuário
parado enquanto a tela mudou embaixo.

**Pronto quando:** após o resultado, `document.activeElement` é o `<h2>` do painel, **sem
anel visível** (T-408).

---

#### T-415 — Hierarquia do cabeçalho de bloqueio
**Tamanho:** P · **Ref:** `R-ACE-12` · **Delta de aparência 2/4** · **Desvio §2.2**

O `<h2>` do bloqueio é `text-sm`; o do grid é `text-lg`. O cabeçalho da situação mais
grave é o menor da tela. Iguala em `text-lg`.

**Reflui o estado `bloqueado`.** É o desvio registrado em §2.2 — a T-441 emenda a §9.2 da
espec, e a T-438 espera esta diferença.

**Pronto quando:** os dois `<h2>` têm o mesmo corpo, e a diferença aparece **só** na
captura do estado `bloqueado`.

---

#### T-416 — Teste da montagem do invólucro
**Tamanho:** P · **Ref:** **D-03**

Afirma que o elemento com `aria-live` existe no DOM **no estado inicial**, antes de
qualquer envio.

É o único teste automático que pega o erro da T-412. Não afirma o atributo — afirma o
**momento**.

**Pronto quando:** o teste passa; e **falha** se o invólucro for movido para dentro do
retorno condicional. Verificar as duas direções.

---

#### T-417 — Escuta real em leitor de tela
**Tamanho:** M · **Ref:** **P2** · **Insumo:** `K-01`

Percurso completo com NVDA ou com o Narrator do Windows 11: escolher os dois arquivos,
enviar, ouvir a conclusão, percorrer o grid.

| O que confirmar | Regra |
|---|---|
| A conclusão é **anunciada** | `R-ACE-13` |
| O bloqueio é anunciado **uma vez**, não duas | T-413 |
| O nome de cada campo é o rótulo, e nada mais | `R-ACE-11` — validável já, antes da T-420, como linha de base |

**Pronto quando:** o anúncio é ouvido. Não há substituto automático — PLANO 008 §5.

---

**Verificação do E2 — `P2`:** T-416 verde nas duas direções e T-417 confirmando o som.

---

## 6. Épico E3 — Formulário

> Paralelizável com o E4 — arquivos disjuntos.

#### T-418 — `<form>` com guarda única
**Tamanho:** P · **Ref:** `R-ACE-07`

`<section>` vira `<form onSubmit>`, botão vira `type="submit"`. As classes são idênticas
— os dois são bloco, não há delta de aparência.

A guarda de "faltam arquivos" vai para o `onSubmit`, **um lugar só**, cobrindo clique e
Enter. É pré-requisito da T-419.

**Pronto quando:** Enter com os dois arquivos envia; Enter com um só não envia.

---

#### T-419 — `aria-disabled` no lugar de `disabled`
**Tamanho:** M · **Ref:** `R-ACE-06`, D-04 · **Depende de:** T-418, T-407

Desabilitar o elemento que está com foco joga o foco para o `<body>` no Chrome e no
Safari — o usuário perde a posição **no instante em que a espera de até 90 s começa**.

`aria-disabled` mantém o botão na ordem de tabulação e o anuncia como indisponível.
`aria-busy` durante o processamento.

Duas consequências, ambas assumidas:

| Consequência | Tratamento |
|---|---|
| O botão volta a ser **clicável de verdade** | A guarda da T-418 é o que impede o envio |
| As variantes `disabled:` param de casar | Todas viram expressão condicional — T-407 |

> Os dois `input[type=file]` **continuam com `disabled`** durante o processamento, e isso
> não fere a `R-ACE-06`: a regra proíbe desabilitar controle **que está com foco**, e o
> foco está no botão. Ler a regra pelo que ela diz.

**Pronto quando:** durante o processamento o botão permanece em `document.activeElement`
com `aria-disabled="true"`.

---

#### T-420 — Nome acessível dos campos
**Tamanho:** P · **Ref:** `R-ACE-11`

Hoje o nome acessível de cada input é **todo o texto do `<label>`** que o envolve —
rótulo, descrição e o arquivo escolhido, concatenados e mudando a cada seleção.

`aria-label` com o rótulo — nome explícito vence conteúdo de rótulo —, e descrição e
estado por `aria-describedby`. O cartão inteiro segue clicável.

**Pronto quando:** o nome acessível é exatamente `Contrato` e `Levantamento`, **antes e
depois** de escolher arquivo.

---

#### T-421 — Indicador de atividade
**Tamanho:** P · **Ref:** `R-ACE-16`

Giro no botão e uma linha dizendo que pode levar até um minuto. **No formulário, nunca na
barra** — a `R-CAB-05` da ESPEC 007 é preservada de propósito, e uma entrega de
acessibilidade seria o pretexto fácil para furá-la.

> `animate-spin` roda por até 90 s. A WCAG 2.2.2 é nível **A** e trata de movimento
> automático acima de 5 s; indicador de carregamento costuma ser aceito como essencial,
> mas `motion-reduce:animate-none` custa uma classe e resolve a dúvida — quem pediu menos
> movimento no sistema recebe o texto sem o giro.

**Pronto quando:** o estado `processando` mostra giro e texto; com `prefers-reduced-motion`
ativo o giro para e o texto permanece; a barra segue vazia.

---

#### T-422 — Borda sólida nos cartões
**Tamanho:** P · **Ref:** `R-ACE-17`, D-08 · **Delta de aparência 3/4**

`border-dashed` → `border`. Tracejado é a convenção de área de arraste, e arrastar ali não
faz nada — o usuário que tenta não recebe erro, recebe inércia.

Uma palavra. **Não** implementar arraste: ESPEC 008 §11 ponto 1.

**Pronto quando:** os dois cartões têm borda sólida. Sem reflui — mesma largura.

---

#### T-423 — Testes do formulário
**Tamanho:** P · **Ref:** `R-ACE-06`, `07`, `11`

| Caso | Prova |
|---|---|
| Enter com os dois arquivos envia | T-418 |
| **Enter e clique com um só arquivo não enviam** | Que a guarda foi transferida junto com o `aria-disabled` |
| Foco permanece no botão durante o processamento | T-419 |
| Nome acessível = rótulo, antes e depois de escolher | T-420 |

O segundo caso é o que importa: sem ele, a T-419 entrega um botão que envia formulário
incompleto.

**Pronto quando:** os quatro passam.

---

## 7. Épico E4 — Grid

> A fase maior. Paralelizável com o E3.

#### T-424 — `scope` e nome acessível das tabelas
**Tamanho:** P · **Ref:** `R-ACE-09`

`scope="col"` em todo `<th>`; `aria-labelledby` em toda `<table>`, apontando para o título
de seção da T-425.

São 22 tabelas hoje anônimas e idênticas — na lista de tabelas do leitor, indistinguíveis.

**Pronto quando:** nenhum `<th>` sem `scope`; nenhuma `<table>` sem nome.

---

#### T-425 — Faixas de seção viram cabeçalhos reais
**Tamanho:** M · **Ref:** `R-ACE-10`, D-06

As faixas navy são `<div>` com peso tipográfico de cabeçalho. Viram `<h3>`/`<h4>`
**mantendo as classes** — o *preflight* do Tailwind já normaliza corpo e peso de heading,
então não há delta de aparência.

> **O nível tem de ser condicional.** `grupo_titulo` é opcional. Emitir sempre `<h3>` para
> grupo e `<h4>` para seção produz `<h2>` → `<h4>` nas seções sem grupo — salto de nível,
> que a regra `heading-order` do `axe` reprova com razão. **Sem grupo, a seção é `<h3>`.**

**Pronto quando:** a contagem de `h3`+`h4` iguala grupos + seções; `heading-order` verde;
e a T-438 não acusa diferença.

---

#### T-426 — Rolagem focável
**Tamanho:** P · **Ref:** `R-ACE-05`

`tabIndex={0}` e `role="region"` com nome acessível nos contêineres `overflow-x-auto`. São
52 rem de tabela em 56 rem de coluna: sem isso, **Quantidade Medida** e **Saldo** são
inalcançáveis para quem não usa mouse.

> **Custo assumido:** 22 paradas de tabulação novas, uma por seção. É o preço da
> WCAG 2.1.1, e a navegação por cabeçalhos da T-425 mais o link de pulo da T-410 são o que
> o tornam tolerável. Registrar; se incomodar em uso real, é assunto para o item 2 da
> ESPEC 008 §11, não para desfazer esta tarefa.

**Pronto quando:** a T-404 alcança as duas colunas só com teclado.

---

#### T-427 — Legenda, e remoção dos dois `title`
**Tamanho:** M · **Ref:** `R-ACE-03`, D-05 · **Delta de aparência 4/4**

Legenda visível abaixo do título do grid, explicando as duas marcas uma vez só. Saem o
`title` da etiqueta **perfil** e o do saldo negativo.

A do perfil é a mais séria: `R-DIV-04` a criou porque **banco de dados contratado no perfil
D e medido no perfil C aparece como se não houvesse diferença**. É a ressalva que impede
concluir "confere" quando não confere, e está hoje num mecanismo que não existe em toque e
não abre por teclado.

**Reflui o estado `pronto`.** É a segunda exceção prevista na ESPEC 008 §9.2.

**Pronto quando:** a legenda explica as duas marcas; `grep -rn "title=" frontend/src/`
devolve **zero**.

---

#### T-428 — Portador textual do saldo negativo
**Tamanho:** P · **Ref:** `R-ACE-02`

O destaque é hoje só cromático — fundo e texto vermelhos. Acrescentar portador acessível,
sem mexer no visual.

`sr-only` é absolutamente posicionado: não afeta a célula `tabular-nums` alinhada à
direita. Conferir na T-438.

**Pronto quando:** o leitor lê o saldo negativo com a qualificação; a captura não muda.

---

#### T-429 — Bloco extracontratual antes das seções
**Tamanho:** P · **Ref:** D-07

Medir o que não foi contratado é o achado que mais compromete o faturamento, e hoje aparece
depois de 22 seções e 36 linhas.

`R-DIV-05` **não é alterada** — bloco próprio, mesmo critério de entrada, mesmo rótulo.
Muda só a posição; "ao final" descrevia arranjo, não requisito.

> O teste de fumaça afirma a **visibilidade** do bloco, não sua ordem. Não quebra.

**Pronto quando:** o bloco aparece antes da primeira seção e o teste de fumaça segue verde.

---

#### T-430 — Chave de seção por índice
**Tamanho:** P

`key={secao.secao_titulo}` colide entre grupos diferentes. Passa a índice.

**Pronto quando:** nenhum aviso de chave duplicada no console.

---

#### T-431 — Testes de estrutura do grid
**Tamanho:** M · **Ref:** `R-ACE-03`, `05`, `09`, `10`

| Asserção | Regra |
|---|---|
| Todo `th` tem `scope="col"`; toda `table` tem nome | `R-ACE-09` |
| `h3`+`h4` iguala grupos + seções; sem salto de nível | `R-ACE-10` |
| Todo `overflow-x-auto` tem `tabIndex=0` e nome | `R-ACE-05` |
| **Zero `title=` em `frontend/src/`** | `R-ACE-03` |

A última é `grep`, não Playwright — e é a que impede a reintrodução do mecanismo que esta
espec removeu.

**Pronto quando:** as quatro passam.

---

## 8. Épico E5 — Higiene e verificação do conjunto `[portão P3]`

#### T-432 — Liberar o blob anterior
**Tamanho:** P · **Ref:** `R-ACE-18`

`URL.createObjectURL` sem `revoke` retém ~41 páginas de DOCX por geração, pela sessão
inteira. Liberar antes de novo envio, em `page.tsx`.

Basta liberar no envio: qualquer transição para `erro` ou `bloqueado` passa por lá.

**Pronto quando:** duas gerações seguidas deixam um blob vivo, não dois.

---

#### T-433 — Nome do arquivo baixado
**Tamanho:** P · **Ref:** `R-ACE-19`

`confere-<contrato>-<aaaa-mm>.docx`, de `contrato_referencia` e `data_levantamento`. Doze
competências viravam `(1)`…`(11)` na pasta de Downloads.

Higienizar a referência — ela vai para nome de arquivo.

**Pronto quando:** o nome traz contrato e competência, e não contém caractere inválido.

---

#### T-434 — Mensagens em maiúscula
**Tamanho:** P · **Ref:** `R-ACE-20`

As duas de `lib/api.ts` começam em minúscula e destoam do resto da interface.

**Pronto quando:** as duas começam em maiúscula.

---

#### T-435 — Asserção do teste de fumaça
**Tamanho:** P · **Ref:** ESPEC 008 §9.3 · **Depende de:** T-433

`toBe("levantamento-comprovacao.docx")` → `toMatch(/^confere-.+\.docx$/)`. **É a única
asserção que quebra em toda a entrega.**

**Pronto quando:** os dois testes de fumaça passam, com o resto do arquivo intocado.

---

#### T-436 — Varredura `axe` verde
**Tamanho:** P · **Ref:** ESPEC 008 §9.2

Zero violações A e AA nos quatro estados. Contrastar com o registro da T-405.

**Pronto quando:** zero violações, e a diferença contra a T-405 está registrada.

---

#### T-437 — Percurso completo sem mouse
**Tamanho:** M · **Ref:** **P3**

Escolher os dois arquivos, enviar, ler o grid, baixar o DOCX. **Com o mouse fisicamente
desconectado.**

> A diferença não é retórica. Com o dispositivo à mão, a pessoa contorna sem perceber o
> obstáculo que acabou de encontrar — e o obstáculo continua na tela.

**Pronto quando:** o trabalho completo foi feito sem mouse, e cada obstáculo encontrado
virou tarefa ou desvio registrado.

---

#### T-438 — Diferença de captura
**Tamanho:** M · **Ref:** **P3** · **Depende de:** T-411

Repetir a captura da T-411 e comparar. Mesma máquina, mesmo navegador, mesma fixture.

**São esperadas exatamente quatro diferenças** — as da §1.1. Qualquer quinta é defeito de
layout e reprova o portão.

**Pronto quando:** a diferença é explicável linha a linha pela tabela da §1.1.

---

#### T-439 — Build e regressão
**Tamanho:** P

`next build` limpo, `tsc --noEmit` limpo, `next lint` limpo, **308 testes de backend
intactos**.

> `backend/` não foi tocado. Se algum dos 308 quebrar, algo foi entendido errado — não
> corrigir o teste.

**Pronto quando:** os quatro verdes.

---

**Verificação do E5 — `P3`:** T-437 e T-438 fechados, com a T-439 como rede.

---

## 9. Épico E6 — Documentação

#### T-440 — ESPEC 002: revisão de `R-UI-04` e `R-UI-08`
**Tamanho:** P · **Ref:** ESPEC 008 §13.1 · **Insumo:** `K-02`

A `R-UI-04` **institui o `title`** — "explicação ao passar o cursor". A T-427 o remove.
Corrigir o código sem revisar a regra deixaria espec e implementação em contradição
declarada.

`R-UI-08` ganha o acréscimo de que o destaque não é só cromático. `R-DIV-05` **não muda**.

**Pronto quando:** as duas regras estão revisadas, com nota apontando para a ESPEC 008.

---

#### T-441 — ESPEC 008: fechamento e três emendas
**Tamanho:** P

Status → implementada; §9.2 preenchida com os números **medidos**, no formato da
ESPEC 005 §8. Mais as emendas que a implementação obrigou:

| Emenda | Origem |
|---|---|
| §8: "nenhuma dependência **de produção**" | PLANO 008 §6.1 — `@axe-core/playwright` é `devDependency` |
| §9.2: **quatro** exceções de aparência, não duas | §2.2 deste documento — a T-415 reflui |
| §9.2: o que roda em dev e o que roda no *build* | PLANO 008 §6.2 |

**Pronto quando:** a espec descreve o que foi feito, incluindo onde ela mesma estava errada.

---

#### T-442 — README e CHANGELOG
**Tamanho:** P

README: ESPEC 008 passa de proposta a implementada. CHANGELOG: o incremento e a revisão da
ESPEC 002 — inclusive **por que** o `title` saiu, que é o que evita a pergunta voltar.

---

#### T-443 — Fechamento deste documento
**Tamanho:** P

Resultado, desvios e **o que só a verificação manual pegou** — como no TASKS 003 §2 e no
TASKS 004 §2. A última parte é a mais valiosa: é o inventário do que `axe` não vê.

---

## 10. Insumos

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **K-01** | **Leitor de tela em máquina real** — NVDA, ou o Narrator já instalado no Windows 11 | T-417 | **P2 não fecha.** É a única verificação de que o anúncio existe |
| **K-02** | **Aceite da revisão de `R-UI-04` e `R-UI-08`** da ESPEC 002 | T-440 | O código corrige e a espec continua mandando o contrário. Não bloqueia E1–E5 |
| **K-03** | Aceite visual das **quatro** mudanças de aparência da §1.1 | E1 e E4 | Risco de refazer a linha de base depois de a T-438 já ter comparado contra ela |

`K-01` é o único bloqueante, e é barato — o Narrator já está instalado. `K-03` é o que
torna `K-02` e a T-438 baratos, pelo mesmo raciocínio do `K-02` do PLANO 004.

---

## 11. Sequência

```
                          ┌─► E3 (formulário) ─┐
E0 ──► E1 ──► E2 ─────────┤                    ├──► E5 ──► E6
  P1    (cor,   P2        └─► E4 (grid) ───────┘    P3
        base)  (ouvido)
```

| | |
|---|---|
| **Caminho crítico** | T-401 → T-406 → T-411 → T-412 → T-417 → T-425 → T-427 → T-438 → T-441 |
| **Duração** | 3 a 4 dias, 1 desenvolvedor · 2 a 3 dias, 2 desenvolvedores |

**E3 e E4 tocam arquivos disjuntos** — `UploadForm.tsx` contra `DivergenciaGrid.tsx` — e
são a única paralelização útil. O resto é linear por necessidade: E0 é porta de mão única,
E1 fixa a base de que o E5 depende, e o E2 valida o mecanismo mais frágil antes de o
trabalho crescer.

---

## 12. O que este backlog não faz

- **Não redesenha nada.** Quatro deltas de aparência, enumerados na §1.1 e cobrados na
  T-438.
- **Não toca `backend/`.** Os 308 testes entram uma vez, na T-439, como regressão.
- **Não implementa arrastar e soltar.** A T-422 retira a promessa; a função fica na
  ESPEC 008 §11 ponto 1, com espec própria.
- **Não versiona baseline de captura.** `frontend/test-results/` já é ignorado. A
  comparação é antes contra depois, na mesma máquina — PLANO 008 §9.
- **Não persegue AAA**, tema escuro, cartões no celular nem filtro no grid. ESPEC 008 §4.
- **Não decide o botão "Novo relatório"** da ESPEC 007 §10 ponto 4. Pesa mais para quem usa
  teclado, mas é escopo novo — e escopo novo dentro de entrega de conformidade é como um
  defeito funcional entra numa entrega que não deveria ter nenhum.
