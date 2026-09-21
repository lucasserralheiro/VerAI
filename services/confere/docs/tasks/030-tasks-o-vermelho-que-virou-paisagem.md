# TASKS 030 — Backlog de "O vermelho que virou paisagem"

| | |
|---|---|
| **Especificação** | [ESPEC 030](../specs/030-o-vermelho-que-virou-paisagem.md) v1.1 |
| **Plano** | [PLANO 030](../plans/030-plano-o-vermelho-que-virou-paisagem.md) v1.1 |
| **Versão** | 1.0 — 2026-08-20 |
| **Total** | 22 tarefas · 5 portões · 3 insumos em aberto |
| **Status** | **Em execução** — E0 a E4 fechados; E5 (suíte inteira) em execução. Nove reancorados, um veredito de deriva com regra revista (`D-06`), um defeito nomeado e adiado (`I-04`) |

> **Escrito antes da implementação.** A §9 é a única seção que não pode ser escrita agora, e é a
> que a próxima entrega vai ler.

---

## 1. Convenções

**Identificadores** `T-21nn`, continuando de `T-2111`, a última da ESPEC 029.

**Definição de pronto**, e ela tem **quatro** partes nesta entrega — uma a mais que o de sempre:

1. o arquivo de teste roda verde **isolado** (`npx playwright test e2e/<arquivo>.spec.ts`);
2. `npx tsc --noEmit` e `npx next lint` limpos;
3. **`git diff --stat frontend/src/` vazio** — a quarta, e a que não existe em nenhum outro
   backlog deste projeto;
4. comentário no teste dizendo **de onde veio** o que ele passou a afirmar.

**Convenção de commit** `<tipo>(T-21nn): descrição`. Reancoragem é `test(...)`; conserto de produto
é `fix(...)`. **Nunca os dois no mesmo commit** — é `R-SUI-04`, e é o que permite ler o histórico
depois.

**O laço de retorno é por arquivo.** A suíte inteira leva 32 minutos e roda **duas vezes**: a
linha de base já está tirada (`110 passed, 10 failed`, execução de fechamento da ESPEC 029) e a
outra é o portão `P3`.

### 1.1 Quatro regras que atravessam este backlog

**1 — O produto não anda para trás.** Nenhuma tarefa, exceto a `T-2128` e só com veredito de
defeito, altera comportamento decidido por espec posterior. É exigência explícita do dono do
produto, e é a razão de a definição de pronto ter uma quarta parte.

*O sinal no diff:* **qualquer** linha em `frontend/src/` fora do épico E4.

**2 — Classificar antes de editar.** O épico E0 não toca arquivo nenhum, e nenhum outro começa
antes de ele fechar. Sem dono nomeado, o teste é defeito (`R-SUI-03`) — e defeito muda a forma da
entrega inteira.

*O sinal no diff:* uma edição em `e2e/` num commit que não seja precedido pela classificação da
`T-2116`.

**3 — Reancorar é contra a fonte, nunca contra a saída.** O número novo vem da regra que o decidiu
ou da âncora do backend que já o guarda — nunca de copiar o que a tela imprime hoje.

*O sinal no diff:* um literal novo (`21`, `58`, `3`) sem comentário ao lado dizendo de onde saiu.

**4 — Nomear o que se quer, não contar o que existe.** Os quatro testes da família A quebraram
porque varriam `input[type="file"]` e presumiam dois. Trocar `2` por `3` os deixa exatamente tão
frágeis quanto estavam.

*O sinal no diff:* uma contagem literal trocada por outra contagem literal.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** A classificação | T-2112 … T-2116 | **P0** | F0 |
| **E1** Família A — o terceiro campo | T-2117 … T-2120 | **P1** | F1 |
| **E2** Família B — os números da análise | T-2121 … T-2123 | **P1** | F2 |
| **E3** Família C — a faixa | T-2124 … T-2125 | **P1** | F3 |
| **E4** O `14.049.00054.00` | T-2126 … T-2129 | **P2** | F4 |
| **E5** O conjunto | T-2130 … T-2133 | **P3 P4** | F5 |

### 2.1 A régua da entrega — o que pode mudar de comportamento

| Muda | Não muda |
|---|---|
| O que dez testes de `e2e/` **afirmam** | O que a tela **faz** — exceto se `T-2127` não achar dono |
| A suíte de navegador: 110 → **120 verdes** | O backend, em nenhum arquivo (`P4`) |
| A contagem total passa a ser declarada (`D-05`) | O `.docx`, o `.xlsx`, as validações, a API |
| — | O tempo de execução: 32 minutos continuam 32 (`I-02`) |
| — | O número de testes: 120 entram, 120 saem (`D-03`) |

---

## 3. Épico E0 — A classificação `[portão P0]`

> **Nenhum arquivo é editado neste épico.** A saída é uma tabela, e ela decide o formato de tudo
> o que vem depois.

#### T-2112 — Fixar a lista dos dez
**Tamanho:** PP · **Ref:** ESPEC §2, **P3**

A lista sai do JSON da execução de fechamento da ESPEC 029 — `110 passed, 10 failed` —, e não de
uma execução nova: aquela já foi feita com a árvore no estado em que esta entrega começa.

**Pronto quando:** os dez estão neste documento, por arquivo, teste e mensagem de falha.

> **Por que não rodar de novo:** 32 minutos para reproduzir um resultado que já existe, e o risco
> de a lista mudar por acaso entre as duas execuções — que é justamente o que a `T-2129` vai ter
> de distinguir mais adiante.

#### T-2113 — Datar cada teste e cada mudança
**Tamanho:** P · **Ref:** `R-SUI-02`

Para cada um dos dez, dois comandos:

```bash
git log --oneline -S "<trecho da asserção>" -- frontend/e2e/<arquivo>.spec.ts   # quando o teste nasceu
git log --oneline -- frontend/src/app/components/<componente>.tsx               # quando a tela mudou
```

A interseção nomeia a entrega que moveu o comportamento.

**Pronto quando:** cada um dos dez tem duas datas e um commit candidato.

#### T-2114 — Achar a regra, não só a entrega
**Tamanho:** P · **Ref:** `R-SUI-03`

Cruzar o commit com `docs/specs/` e extrair o identificador da regra. `ESPEC 019` não fecha;
`ESPEC 019 R-ADT-10` fecha.

**Pronto quando:** cada deriva tem `ESPEC nnn` **e** `R-XXX-nn`.

> **É a regra que autoriza a reancoragem, não a entrega.** *"Mudou na 019"* explica o passado;
> `R-ADT-10` diz o que a tela **deve** fazer — e é contra isso que o teste vai passar a afirmar.

#### T-2115 — Separar o que não tem dono
**Tamanho:** PP · **Ref:** `R-SUI-03`, `D-02`

O que sobrar sem `R-XXX-nn` é **defeito**. Não é lista de pendências: é o resultado mais valioso
desta fase, e muda a estimativa da entrega.

**Pronto quando:** a lista existe — mesmo que vazia, e aí isso está escrito.

#### T-2116 — `[portão]` A tabela dos dez `[fechada em 2026-08-20]`
**Tamanho:** PP · **Ref:** **P0**

| Teste | Fam. | Classe | Dono | Ação |
|---|---|---|---|---|
| `a11y-estrutura` — nome acessível | A | deriva | ESPEC 019 `R-ADT-10` · `D-10` | reancorar |
| `a11y-teclado` — percurso completo | A | deriva | ESPEC 019 `R-ADT-10` (ordem: ESPEC 008 §6) | reancorar |
| `limpar` — `R-LMP-01` | A | deriva | ESPEC 019 `R-ADT-10` | reancorar |
| `limpar` — `R-LMP-04` | A | deriva | ESPEC 019 `R-ADT-10` | reancorar |
| `analise` — as quatro situações (19 → 21) | B | deriva | ESPEC 018 `R-REL-01` | reancorar |
| `analise` — `R-RES-02` (56 → 58) | B | deriva | ESPEC 018 `R-REL-01` | reancorar |
| `analise` — abre e fecha (56 → 58) | B | deriva | ESPEC 018 `R-REL-01` | reancorar |
| `analise` — `R-PAN-06` (5 → 4 perfis) | B | deriva | ESPEC 018 `D-01` | reancorar |
| `smoke` — 55 → 58 | C | deriva | ESPEC 018 `R-REL-01` | reancorar |
| `a11y-estrutura` — `14.049.00054.00` 1 → 2 | D | **a apurar** | — | **E4** |
| `smoke` — faixa `B - SERVIÇOS DE REDES…` ausente | **D** | **a apurar** | — nenhuma regra remove; ESPEC 002 `R-UI-01` e ESPEC 010 §7 legislam sobre ela | **E4** |

> **A última linha apareceu durante a E3**, escondida atrás da primeira asserção do mesmo teste
> (§9.1). São **onze** achados em dez testes — e é a tese da ESPEC 030 §1 se realizando dentro de
> uma linha de log.

**Pronto quando:** as dez linhas preenchidas. ✅

### O que a classificação achou, e não estava previsto

**1 — A família C não é sobre a frase.** A ESPEC 030 v1.0 dizia que o texto da faixa havia mudado.
Não mudou: `ResultadoPanel.tsx:257` escreve `{n} de {m} itens com divergência entre contratado e
medido`, palavra por palavra. O `Barra.tsx` diz `… divergem`, mas o `smoke` nunca falou dele.
**Só o número mudou** — 55 → 58. Corrigido na ESPEC 030 v1.2.

**2 — Nove dos dez têm o mesmo par de donos**, e é uma história só: a ESPEC 018 mudou o universo do
relatório (56 → 58 itens, dos quais os dois novos são conformes: 19 → 21) e consolidou o
`14.025.00011.00` numa linha (5 → 4 perfis); a ESPEC 019 acrescentou o terceiro campo.

**3 — O backend foi reancorado nas duas ocasiões; a tela, não.** O
`test_anchor_analise.py` documenta a mudança dos perfis em uma frase — *"eram cinco: o
`14.025.00011.00` contava duas vezes"* — enquanto o `analise.spec.ts` continuou procurando cinco.
A assimetria não é acaso: o backend tem disciplina de reancoragem escrita (TASKS 026 §9.10) e a
suíte de tela nunca teve. É o que `D-05` e `R-SUI-06` passam a corrigir.

---

## 4. Épico E1 — Família A: o terceiro campo `[portão P1]`

> Dono provável: **ESPEC 019 `R-ADT-10`**, o campo *Aditivos da proposta*. Provável, e não
> confirmado, até a `T-2116`.

#### T-2117 — `valoresDosCampos` distingue obrigatório de opcional
**Tamanho:** P · **Ref:** `D-04`, `R-LMP-01`, `R-LMP-04`

`limpar.spec.ts` tem uma função que lê o `value` de **todo** `input[type="file"]` da página. Os
dois testes de lá quebram por causa dela, e consertá-la fecha os dois.

O que a função passa a devolver não é *"três valores"*: é **os campos que aquela asserção quer**.
`R-LMP-01` fala do que a limpeza descarta — os três, então; `R-LMP-04` fala do que estava
preenchido antes dela — os dois obrigatórios, porque o de aditivos não foi preenchido pelo teste.

**Pronto quando:** os dois verdes, e a distinção está no nome da função ou no argumento — não num
`slice(0, 2)`.

#### T-2118 — O inventário de nomes acessíveis passa a nomear
**Tamanho:** P · **Ref:** `D-04`

`a11y-estrutura.spec.ts` compara a lista de nomes acessíveis com `["Contrato", "Levantamento"]`.
Acrescentar `"Aditivos da proposta"` faz passar hoje e quebra no dia do quarto campo.

A asserção passa a ser sobre **cada campo ter o nome do seu rótulo** — que é o que `T-423` quer
dizer —, e não sobre a lista inteira ser aquela.

**Pronto quando:** verde, e um campo novo no formulário **não** quebra este teste.

#### T-2119 — O percurso por teclado ganha o degrau que existe
**Tamanho:** P · **Ref:** `D-04`, `R-ADT-10`, ESPEC 008 §6

`a11y-teclado.spec.ts` conta: link de pulo → Contrato → Levantamento → botão. Falta o campo de
aditivos, que a `R-ADT-10` pôs em terceiro **de propósito** — depois dos dois obrigatórios e antes
de *Gerar relatório*.

O degrau novo entra com o comentário dizendo qual regra o pôs ali. Sem isso, a próxima pessoa vai
achar que alguém contou errado.

**Pronto quando:** o percurso completo passa, e cada degrau tem a regra que o justifica.

#### T-2120 — `[portão]` `P1` do E1
**Tamanho:** PP · **Ref:** **P1**

Três arquivos verdes isolados; `git diff --stat frontend/src/` **vazio**.

---

## 5. Épico E2 — Família B: os números da análise `[portão P1]`

#### T-2121 — Localizar a fonte de cada número
**Tamanho:** M · **Ref:** `R-SUI-05`

Quatro números: `Sem divergência: N itens`, `N itens analisados`, `N desses itens são de perfil ou
pacote`, e as quatro contagens da tabela de situações.

Todos saem de `AnaliseDaMedicao`, e o backend já os ancora — `test_anchor_analise.py` e
`test_analise.py`. **É de lá que o número vem**, não da tela.

**Pronto quando:** cada um dos quatro tem a âncora do backend que o produz, ou a regra da ESPEC
009 que o define.

> **É a tarefa mais cara do backlog, e é ela que impede a entrega de virar cola-e-passa.** Se a
> fonte for a saída do navegador, o teste passa a afirmar que a tela concorda consigo mesma — e a
> próxima divergência entre backend e frontend fica invisível exatamente onde ele deveria vê-la.

#### T-2122 — Reancorar os quatro, com a fonte declarada
**Tamanho:** P · **Ref:** `R-SUI-06`

Cada número novo entra com um comentário de uma linha: de onde ele vem e qual regra o produz.

**Pronto quando:** `analise.spec.ts` verde, e nenhum literal novo sem procedência.

#### T-2123 — `[portão]` `P1` do E2
**Tamanho:** PP · **Ref:** **P1**

`analise.spec.ts` verde isolado; `frontend/src/` intocado.

---

## 6. Épico E3 — Família C: a faixa `[portão P1]`

#### T-2124 — A frase e o número do `smoke`
**Tamanho:** PP · **Ref:** `R-SUI-06`

`smoke.spec.ts` procura `36 … de 55 itens com divergência`. O componente hoje escreve
`{total_divergencias} de {total_linhas} divergem`, e `total_linhas` é **58**.

São **duas** mudanças, com donos diferentes: a frase mudou no `Barra.tsx`; o número mudou porque o
bloco final entrou no documento (ESPEC 018). As duas são declaradas.

**Pronto quando:** verde, com as duas procedências no comentário.

#### T-2125 — `[portão]` `P1` do E3
**Tamanho:** PP · **Ref:** **P1**

---

## 7. Épico E4 — O `14.049.00054.00` `[portão P2]`

> **O único épico autorizado a tocar `frontend/src/`**, e só se a `T-2127` não achar dono.

#### T-2126 — Medir onde o código aparece
**Tamanho:** P · **Ref:** ESPEC §2.5

No estado `pronto`, contar as ocorrências do código **por componente**: grid de divergências,
painel de análise, tabela de linhas derivadas, bloco final.

**A tabela de linhas derivadas da ESPEC 021 é o primeiro suspeito**: ela lista as linhas `1 / 1`
por derivação, e um item de perfil apareceria nela **e** no grid.

**Pronto quando:** existe a contagem por componente, e não só o total `2`.

#### T-2127 — Procurar a decisão
**Tamanho:** P · **Ref:** `R-SUI-03`

Alguma espec decidiu que o mesmo código apareça em dois lugares da tela? `R-PER-*` da ESPEC 021 e
`R-PAN-*` da 009 são onde procurar.

**Pronto quando:** há uma regra nomeada, **ou** está escrito que não há.

#### T-2128 — O veredito
**Tamanho:** P a M · **Ref:** `R-SUI-04`

* **Com dono** — reancorar o teste: ele passa a afirmar quantas ocorrências e **em quais
  componentes**, que é mais do que ele afirmava antes.
* **Sem dono** — é defeito: consertar o produto, com teste que guarde o conserto. É a única tarefa
  do backlog que pode escrever em `frontend/src/`.

**Pronto quando:** o teste verde e o veredito escrito.

> **A ordem desta e da anterior é o conteúdo do épico.** Consertar antes de procurar a decisão é
> como se desfaz, em nome de um teste antigo, algo que alguém decidiu de propósito — a `R-SUI-01`
> violada exatamente onde ela é mais difícil de enxergar.

#### T-2129 — `[portão]` `P2`
**Tamanho:** PP · **Ref:** **P2**

Veredito escrito, com a contagem por componente e a regra — ou a ausência dela — nomeada.

---

## 8. Épico E5 — O conjunto `[portões P3, P4]`

#### T-2130 — A suíte inteira
**Tamanho:** PP · **Ref:** **P3**

`--reporter=json`, porque o `line` não sobrevive à reescrita de terminal — foi assim que a ESPEC
029 leu `96 passed` sem enxergar `24 failed` (TASKS 029 §11.5).

**Pronto quando:** `120 passed`.

#### T-2131 — O portão de contagem
**Tamanho:** P · **Ref:** `D-05`

O total esperado vira número declarado, como o backend faz desde o TASKS 026. Teste que sumir —
renomeado, não coletado, excluído sem querer — passa a aparecer como diferença, e não como
silêncio.

**Pronto quando:** a suíte reprova se o total coletado mudar sem que alguém troque o número.

#### T-2132 — `[portão]` `P4` e o resto
**Tamanho:** PP · **Ref:** **P4**

`git diff --stat backend/` **vazio**; `tsc` e `lint` limpos.

#### T-2133 — A documentação
**Tamanho:** PP · **Ref:** —

ESPEC 030 para **Implementada**, com a tabela final de classificação da `T-2116`; `README.md`;
a §9 deste documento preenchida.

---

## 9. O que a implementação ensinou

### 9.1 Vermelho escondia vermelho — dentro do **mesmo** teste `[achado]`

O `smoke :: dois arquivos entram e o DOCX é baixado` falhava na **primeira** asserção, e por isso
as seguintes nunca eram avaliadas. Corrigida aquela — `37 de 58`, contra a fonte —, apareceu outra
atrás dela:

```
Locator: getByText('B - SERVIÇOS DE REDES E CONECTIVIDADES')
Error: element(s) not found
```

**A tela não agrupa mais o grid por faixa de seção.** A prova é estrutural, não visual: o
`LinhaDoGrid` do `schemas.py` tem `codigo`, `descricao`, `unidade`, `contratada`, `medida`,
`saldo`, `perfil_ou_pacote` e `sem_previsao_contratual` — **não há campo de grupo**. O
`DivergenciaGrid.tsx` não menciona faixa em lugar nenhum. A string
`"B - SERVIÇOS DE REDES E CONECTIVIDADES"` existe hoje num arquivo só do repositório: o teste que
a procura.

**Isto é candidato a defeito, e o segundo desta entrega.** Três coisas apontam para lá:

* a ESPEC 002 `R-UI-01` decidiu a cor **das faixas de seção do grid**, e a ESPEC 010 §7 a revisou
  — duas especs legislando sobre um elemento que hoje não existe;
* a ESPEC 018 §2.4, que poderia tê-las removido ao tirar o catálogo, diz o contrário com todas as
  letras: *"manter as faixas nunca exigiu catálogo"*;
* o `README.md:50` ainda afirma *"grid de divergências na tela: 36 de 55 itens, **agrupados como no
  relatório**"*.

Nenhuma regra encontrada decide a remoção. Por `R-SUI-03`, **é defeito até que alguém apareça com
`R-XXX-nn`** — e vai para a E4, ao lado do `14.049.00054.00`.

### 9.4 Os dois vereditos da E4, medidos por componente

O `14.049.00054.00` aparece em **duas vistas**, e não duas vezes na mesma:

| # | Onde | Contexto no DOM |
|---|---|---|
| 1 | painel de análise | dentro do `<details>` *"Item crítico — medido acima do contratado, 1 item"* |
| 2 | grid de divergências | tabela em `main > section`, fora de qualquer `<details>` |

**Deriva**, com `R-PAN-07` revista pela ESPEC 030 `D-06` — decisão do dono do produto sobre a
evidência de que nenhuma contagem é inflada.

As **faixas de seção**: **deriva**, e o veredito passou por duas versões — a primeira estava
errada, e o §9.5 conta por quê.

### 9.5 Chamei de defeito o que era deriva, por não conferir a premissa `[desvio]`

As faixas de seção sumiram do grid, a `R-DIV-03` manda agrupar, e eu procurei — sem achar — uma
regra que as removesse. Concluí defeito, propus a ESPEC 031 e pus a asserção em `test.fixme`.

**A pergunta estava errada.** Não era *"alguma regra removeu as faixas?"*, e sim *"alguma regra as
tornou impossíveis?"*. A `R-DIV-03` pedia agrupamento **e** ordem do relatório na mesma frase — o
agrupamento **era** a ordem —, e a ESPEC 018 `R-REL-03` trocou a ordem pela do contrato, que não
tem seções. Nada precisou remover as faixas: bastou reordenar.

Quem expôs isso foi o dono do produto, com três palavras: *"para que spec 031?"*. Eu ia abrir uma
entrega sobre uma premissa que não tinha conferido.

**A lição é sobre o `R-SUI-03`, e refina a regra.** *"Sem dono nomeado, é defeito"* protege contra
classificar defeito como deriva por preguiça. Não protege do inverso — e o inverso também custa:
aqui, uma spec inteira e um conserto de API que ninguém precisava. Procurar quem **removeu** não
basta; é preciso procurar quem **impossibilitou**.

### 9.2 A minha primeira reancoragem leu a mensagem de falha, não a fonte `[desvio]`

A `T-2124` trocou `55` por `58` e reprovou de novo: o outro número da mesma frase — as
divergências — também havia mudado, de **36 para 37**. A mensagem de falha mostrava só o primeiro,
porque a regex inteira não casava.

`R-SUI-05` existe exatamente contra isso, e eu a violei na primeira oportunidade: fui à mensagem,
não à âncora. Indo à âncora — `test_api_e2e.py`, `total_linhas == 58` **e**
`total_divergencias == 37` — os dois números aparecem juntos, com o mesmo dono.

### 9.3 Derivar do que existe ainda é contar `[desvio]`

A `T-2117` trocou `toHaveCount(2)` por *"quantos `input[type=\"file\"]` a página tem"*, e reprovou
por 3 ≠ 2: só os dois campos obrigatórios usam o rótulo `escolher arquivo…`; o de aditivos tem o
seu. A contagem dinâmica parecia cumprir `D-04` e não cumpria — continuava perguntando *quantos
existem* em vez de *quais eu quero*. A versão certa deriva de `OBRIGATORIOS.length`.

---

## 10. Rastreabilidade

| Regra | Tarefas |
|---|---|
| `R-SUI-01` | Todas — é a quarta parte da definição de pronto, e os portões `P1` |
| `R-SUI-02` | T-2113, T-2116 |
| `R-SUI-03` | T-2114, T-2115, T-2127 |
| `R-SUI-04` | T-2128, e a convenção de commit do §1 |
| `R-SUI-05` | T-2121 |
| `R-SUI-06` | T-2122, T-2124 |
| `R-SUI-07` | T-2130 |
| `R-SUI-08` | — nenhuma: a lição já foi aplicada na ESPEC 029, e o que sobra aqui é não desfazê-la |

---

## 11. O que este backlog não faz

* **Não muda o produto**, exceto na `T-2128` e só com veredito de defeito.
* **Não toca o backend.** `T-2132` é a verificação.
* **Não apaga teste nenhum** (`D-03`). Teste que tenha perdido o objeto é `I-01`, e é decisão de
  espec.
* **Não acrescenta cobertura nova.** Devolve crédito à que existe.
* **Não ataca os 32 minutos** (`I-02` da espec). São 38 gerações reais espalhadas por sete
  arquivos, contra uma só do `anuncio.spec.ts`, que roda 23 testes em um minuto e meio. É entrega
  própria — e provavelmente a próxima, porque mexe nos mesmos sete arquivos que este backlog
  reancora.
* **Não acrescenta dependência.**
