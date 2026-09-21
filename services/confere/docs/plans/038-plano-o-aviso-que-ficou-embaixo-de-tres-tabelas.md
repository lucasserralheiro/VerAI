# PLANO 038 — Implementação de "O aviso que ficou embaixo de três tabelas"

| | |
|---|---|
| **Especificação** | [ESPEC 038](../specs/038-o-aviso-que-ficou-embaixo-de-tres-tabelas.md) v1.0 |
| **Versão** | 1.0 — 2026-09-01 |
| **Backlog** | TASKS 038, a escrever. A última numeração usada é `T-2346`, do PLANO 037 — os `T-` deste plano começam em **`T-2347`** |
| **Estado inicial** | Ramo `feature/evolucao`, `HEAD` em `45ee8fb`, **árvore limpa** — o único arquivo não rastreado é `docs/specs/038-…`, escrito nesta sessão. Medido em 2026-09-01: backend **1.543 testes coletados**; navegador **120 testes em 15 arquivos** (`npx playwright test --list`) |
| **Colisão conhecida** | **Nenhuma.** Diferente dos PLANOS 036 e 037, não há outra entrega dentro da árvore. Um único arquivo de produção é tocado: `frontend/src/app/components/ResultadoPanel.tsx` |
| **Instrumento existente** | `estados.ts:414-447` — `comDivergencias` intercepta o corpo real de 200 e o devolve mutado: é o molde exato do dublê que falta. `analise.spec.ts:84-99` e `a11y-estrutura.spec.ts:208-230` — `compareDocumentPosition`, a técnica de asserção de ordem, já em uso duas vezes. `ESTADOS` (`estados.ts:459`) — entrar ali dá `axe` nas duas larguras e o contraste **sem escrever teste**. `a11y-estrutura.spec.ts:141` — a hierarquia de cabeçalhos sem salto já é rede desta entrega, e não custa nada |

---

## 1. O que este plano tem de diferente dos anteriores

> **É a primeira entrega desta série que não toca o backend, e a régua muda de natureza.**
> Não há hash de artefato, não há pacote a reproduzir, não há reancoragem. O que se congela é
> **ordem no DOM** — cinco `h2` numa sequência —, e o instrumento que a mede já está escrito e em uso
> em dois testes. A `T-2363` é a régua do *não toquei*: `git diff --stat backend/` vazio e 1.543
> coletados.

> **A rede vem antes do componente, e tem de reprovar por três motivos distintos.**
> A `F1` inteira roda com o `ResultadoPanel.tsx` intocado, e a `T-2354` não pergunta *"reprovou?"* —
> pergunta *"reprovou dizendo o quê?"*. Ordem `depois`, cabeçalho `0 encontrados`, contagem `fora do
> bloco`. Três vermelhos por três razões nomeadas.

> **Cuidado com o teste que passaria de qualquer jeito.**
> A `R-AVI-04` diz *"a contagem aparece uma vez"* — e **hoje já aparece uma vez**, na faixa. Um teste
> escrito ao pé da letra passa antes e depois da entrega, e não é rede: é decoração. A asserção tem
> de ser *"o número aparece uma vez **e dentro do cabeçalho do bloco**"*, que reprova hoje porque não
> há cabeçalho. Está na `T-2353`, e é o erro mais fácil de cometer neste plano.

> **O portão que decide não é o teste que passa a passar — é o que não se move.**
> Cinco `h2` em ordem relativa idêntica, e uma única diferença entre a `T-2348` e a `T-2358`: o bloco
> âmbar mudou de lugar. `LinhasDerivadas` e `DivergenciaDeFonte` **não se movem** (`R-AVI-06`), e a
> forma mais provável de estragar esta entrega é aproveitar a viagem para reorganizar o resto.

> **O risco real desta entrega nenhuma máquina pega.**
> Âmbar no topo, encostado num botão de download, é a gramática visual da tela de bloqueio do mesmo
> produto. Se a frase da `R-AVI-05` não desfizer essa leitura, a entrega troca um aviso que ninguém
> lê por um aviso que assusta — que é pior. É a `D-06` da espec, é o `P4`, e é humano. §7.

> **Entrar em `ESTADOS` custa três gerações reais, e vale.**
> `axe` (duas larguras) e contraste passam a varrer um estado que hoje **nenhuma varredura cobre** —
> a ESPEC §2.2 mostrou que os dois dublês de `pronto` zeram `avisos` de propósito. São ~2 min a mais
> numa suíte de 32.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Linha de base e a ordem de hoje, congelada** | Fim da `F0` | Navegador: **120 testes em 15 arquivos**, suíte completa verde com o backend no ar, número declarado. Backend: **1.543** coletados. A ordem dos cinco `h2` do estado `pronto` transcrita, com o `<ul>` âmbar **depois de todos** | Suíte que já começa vermelha não mede entrega nenhuma. Se houver vermelho prévio, ele é classificado pela ESPEC 030 `R-SUI-02` **antes** da `F1` |
| **P1 — A rede, vermelha e pelos motivos certos** | Fim da `F1` | Os três testes escritos, com `ResultadoPanel.tsx` **intocado**, reprovando por: ordem `depois`, cabeçalho `0`, contagem fora do bloco. O dublê `prontoComAvisos` monta a tela com **dois** avisos, um de cada formato de cartão | Teste que passa aqui está escrito errado — quase certamente é a armadilha da contagem (§1). Reescrever antes de seguir |
| **P2 — A tela, e nada além dela** | Fim da `F2` | Os três verdes. A `T-2348` reproduzida com **uma única diferença**: o bloco âmbar mudou de lugar; os cinco `h2` na mesma ordem relativa. `git diff` com **um** arquivo de produção | Reverter. Qualquer segunda diferença na ordem é escopo que entrou sozinho |
| **P3 — O conjunto** | Fim da `F3` | Suíte de navegador completa verde, número declarado: **120 + 3 varreduras + os do `avisos.spec.ts`**. `axe` verde no estado novo nas duas larguras. `git diff --stat backend/` **vazio** e **1.543** coletados | Não entregar |
| **P4 — A leitura, que é humana** | Fim da `F3` | Uma passagem de leitor de tela no estado `pronto` com avisos, e a pergunta da `D-06` a uma pessoa do faturamento: *"isto te impede de baixar o relatório?"* | Resposta *sim* reprova **a frase**, não a posição: reescrever a `R-AVI-05` e repetir. Pode ficar declarado **aberto**, como a ESPEC 023 fez com o `P5` — o que não pode é ser dado por fechado sem ter acontecido |

---

## 3. Fases

### F0 — Linha de base e a ordem congelada `[portão]`

**Objetivo:** saber o que a tela faz hoje, em número e em ordem, antes de escrever qualquer teste.
A `T-2348` é o coração da fase: sem a ordem transcrita, a `F2` não tem como provar que moveu **uma**
coisa.

| # | Tarefa | Ref. |
|---|---|---|
| T-2347 | Linha de base do navegador: `npx playwright test --list` → **120 em 15 arquivos**; e a suíte completa com o backend no ar, número declarado. ~32 min | **P0**, **P3** |
| T-2348 | **Congelar a ordem**: no estado `pronto`, listar os `h2` de `#conteudo` na ordem do documento e a posição do `<ul>` âmbar. Esperado — *Relatório gerado*, *Análise da medição*, *Divergências, na ordem do relatório*, *Linhas derivadas*, *Divergência de fonte*, e o bloco de avisos **depois de todos** | **P0**, **P2** |
| T-2349 | Reconfirmar as duas varreduras da ESPEC §2.2 nesta árvore: nenhum teste afirma a posição do bloco nem o texto `aviso(s) registrado(s)`; os dois dublês de `pronto` zeram `avisos` (`estados.ts:435`) | **P0** |
| T-2350 | Backend: `python -m pytest --collect-only -q` → **1.543**. É a régua do *não toquei* | **P3** |

> **Se a suíte já vier vermelha, isto não é problema desta entrega — e não pode ser ignorado.**
> A ESPEC 030 existe porque vermelho crônico virou paisagem uma vez. Vermelho prévio se classifica
> por `R-SUI-02` e se registra na `§9`; o que não se faz é seguir para a `F1` sem saber quantos e
> quais.

**Verificação:** `P0`. **Tamanho:** PP de trabalho, mais os ~32 min da suíte.

---

### F1 — A rede, vermelha e pelo motivo certo `[portão]`

**Objetivo:** escrever o dublê e os três testes **sem tocar o componente**, e conferir como cada um
reprova.

| # | Tarefa | Ref. |
|---|---|---|
| T-2351 | `prontoComAvisos` em `estados.ts`, no molde de `comDivergencias` (`414-447`): intercepta o 200 real e injeta **dois** avisos — um `V-MED-03` no formato `mensagem` (o da captura que originou a espec) e um `V-CTR-06` no formato de quatro partes (`R-DOC-05`). Os dois formatos porque o bloco pode conter os dois, e a §2.1 da espec mostra que oito das treze validações ainda mandam só `mensagem` | `R-AVI-01`, ESPEC §2.1 |
| T-2352 | `avisos.spec.ts`, **a ordem**: o cabeçalho do bloco precede `#titulo-analise`, por `compareDocumentPosition` — molde de `analise.spec.ts:84-99`. Nada de coordenada de pixel | ESPEC `P0`, `R-AVI-01` |
| T-2353 | No mesmo arquivo, **o cabeçalho e a contagem**: `getByRole("heading")` encontra o bloco; e o número de avisos aparece **uma vez e dentro do cabeçalho**. A segunda metade da frase é o que faz o teste reprovar hoje — sem ela ele passa antes e depois (§1) | `R-AVI-02`, `R-AVI-04` |
| T-2354 | **[portão]** Rodar com `ResultadoPanel.tsx` **intocado** e conferir **como** cada um reprova: ordem → `"depois"`; cabeçalho → `0` encontrados; contagem → está na faixa, fora de cabeçalho nenhum | **P1** |

> **O dublê custa uma geração real por invocação**, como todos os `pronto` sintéticos deste projeto:
> ele deixa o backend responder uma vez, muta o corpo e o serve de volta. Não há como baratear sem
> abrir mão de o corpo ser o real — e é o corpo real que faz o teste falar da tela, não do dublê.

**Verificação:** `P1`. **Tamanho:** P — uma hora.

---

### F2 — A tela `[portão]`

**Objetivo:** mover o bloco, dar-lhe cabeçalho e frase, tirar a contagem da faixa — e **nada mais**.

| # | Tarefa | Ref. |
|---|---|---|
| T-2355 | `ResultadoPanel.tsx`: o bloco sai da linha 322 e entra logo abaixo da faixa, como `<section aria-labelledby="titulo-avisos">`, com `h2` (contagem, singular e plural de verdade — nada de `aviso(s)`) e a frase da `R-AVI-05`. `ListaDeAchados` **não muda** | `R-AVI-01` a `03`, `05` |
| T-2356 | A faixa perde ` · N aviso(s) registrado(s)` (`ResultadoPanel.tsx:259-260`) | `R-AVI-04`, `D-03` |
| T-2357 | Os dois comentários — `293-301` (`LinhasDerivadas`) e `309-316` (`DivergenciaDeFonte`) — deixam de localizar as seções **pelo bloco âmbar** e passam a dizer o que elas são, com a remissão à `D-05`. A `R-PAN-01` continua citada: ela não mudou | `D-05` |
| T-2358 | **[portão]** Os três da `F1` verdes; a `T-2348` reproduzida com **uma única diferença**; `git diff --name-only` com **um** arquivo de produção | **P2** |

> **Sem `role="alert"`** (`R-AVI-07`). O painel já está dentro da região `aria-live="polite"` da
> `R-ACE-13`, e o papel de alerta ali produziria anúncio duplo, um deles cortando o que estiver sendo
> lido. É o acréscimo mais tentador desta fase, e o único proibido por regra.

> **Sem cor nova** (`R-AVI-08`). O âmbar é o do `CartaoDeAchado`, que já é varrido pelo contraste no
> estado `bloqueado`.

**Verificação:** `P2`. **Tamanho:** PP — vinte minutos.

---

### F3 — As varreduras, o conjunto e os documentos `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2359 | `prontoComAvisos` entra em `ESTADOS` (`estados.ts:459`): `axe` nas duas larguras e contraste, sem escrever teste. Custo medido: **3 gerações reais** | **P3** |
| T-2360 | **[portão]** `axe` verde no estado novo, a 1366 e a 390 px. O par âmbar já passa no `bloqueado`, então reprovação aqui é **de estrutura** — o candidato provável é `aria-labelledby` apontando para `id` que não existe | **P3** |
| T-2361 | A `fala` da entrada `conclusao` (`inventario-de-anuncios.ts:113-121`) passa a declarar o que a região viva lê quando há avisos. **Entrada nova não há**: nenhum mecanismo de anúncio foi criado, e é o que `R-AVI-07` garante | `R-TA-05`, ESPEC 016 |
| T-2362 | **[portão]** Suíte de navegador completa, número declarado: **120 + 3 + os do `avisos.spec.ts`**. Comparar com a `T-2347`, teste a teste se o total não bater | **P3** |
| T-2363 | **[portão]** `git diff --stat backend/` **vazio**; `python -m pytest --collect-only -q` ainda **1.543** | **P3** |
| T-2364 | **[portão humano]** A escuta e o olho: uma passagem de leitor de tela no `pronto` com avisos — o que se ouve depois de *Relatório gerado* —, e a pergunta da `D-06` a uma pessoa do faturamento. §7 | **P4** |
| T-2365 | Documentos: `Status` da ESPEC 038; nota em ESPEC 021 `D-07`, em ESPEC 023 `D-08` e em `R-FON-10` remetendo a esta entrega; linha em `docs/CHANGELOG.md`; linha `Incremento 038` no `README.md` | `D-03`, `D-05` |

> **A `T-2361` é a que se esquece.** Nenhum teste reprova por `fala` desatualizada — ela é verificada
> por escuta humana (`R-TA-05`), e por isso envelhece em silêncio. O inventário existe justamente
> para não depender de alguém lembrar.

**Verificação:** `P3` e `P4`. **Tamanho:** PP — vinte minutos, mais o tempo da suíte.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3
P0     P1     P2     P3 + P4

F0  a ordem de hoje, transcrita          ← cinco h2 e o ul âmbar depois de todos
F1  três testes vermelhos, o componente intocado
    ordem "depois" · cabeçalho 0 · contagem fora do bloco
F2  o bloco sobe, e UMA coisa muda de lugar
F3  varreduras, números, e a leitura humana ← o único portão que teste não fecha
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~2h de trabalho, mais **duas** execuções completas da suíte de navegador (`T-2347`, `T-2362`) a ~32 min cada, e a escuta da `T-2364` |

**Nenhuma fase está bloqueada por decisão de negócio.** Os quatro `I-` da espec são posteriores à
entrega. O que pode travar é o `P4`, e é humano: depende de alguém do faturamento olhar a tela.

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| **A contagem virar um teste que passa antes e depois** | §1 e a `T-2353`: a asserção é *"uma vez **e dentro do cabeçalho**"*. Se a `T-2354` mostrar esse verde, o teste está errado, não o produto |
| **Âmbar no topo ser lido como bloqueio** | Nada automático. `P4`, `T-2364`, §7 — e a resposta é reescrever a frase, nunca desfazer a posição |
| **Aproveitar a viagem para reorganizar outra seção** | `T-2358`: uma única diferença entre a ordem de antes e a de depois. Duas diferenças reprovam |
| Esquecer de tirar a contagem da faixa e passar a exibi-la duas vezes | `T-2353` no lado do bloco, `T-2358` no lado do `diff`. É o esquecimento mais provável de uma entrega feita às pressas |
| Acrescentar `role="alert"` "para garantir que ouvem" | `R-AVI-07` e a nota da `F2`. O sintoma seria anúncio duplo, e quem o detecta é a escuta — depois de entregue |
| **`aria-labelledby` apontando para `id` inexistente** | `T-2360`. É a violação de `axe` mais provável de um bloco novo com cabeçalho |
| Os comentários das ressalvas ficarem apontando para uma âncora que saiu | `T-2357`, no mesmo `diff` da mudança que os invalida |
| A `fala` do inventário envelhecer em silêncio | `T-2361`. Nenhum teste a pega — é a razão de a tarefa existir |
| Entrar em `ESTADOS` e a suíte estourar o tempo | Custo medido: 3 gerações, ~2 min sobre 32. Se doer, o corte é `I-02` da ESPEC 030, não esta entrega |
| **A suíte já estar vermelha antes de começar** | `T-2347`, e a regra da ESPEC 030 `R-SUI-02`: classificar antes de tocar |

---

## 6. O que este plano não faz

- **Não toca o `backend/`.** Nem um arquivo, e a `T-2363` mede isso.
- **Não muda o estado `bloqueado`** (`R-AVI-09`), onde a ordem já é a desta espec.
- **Não toca `CartaoDeAchado`, `CartaoAgregado` nem `agruparPorValidacao`.** O formato do cartão é o
  `I-01` da espec — as oito validações que ainda mandam só `mensagem` são entrega própria.
- **Não move `LinhasDerivadas` nem `DivergenciaDeFonte`** (`R-AVI-06`).
- **Não cria mecanismo de anúncio** — logo, não cria entrada no inventário (`T-2361`).
- **Não acrescenta cor, token ou severidade** (`R-AVI-08`).
- **Não toca `Barra.tsx`.** Se o placar da barra deve ganhar os avisos, é `I-03` da espec.
- **Não recolhe o bloco quando há muitos avisos** — `I-02`, e só se responde com um par real que os
  produza.
- **Não audita o manual** (`I-04`).

---

## 7. O portão que nenhuma máquina fecha

Todo o resto deste plano é verificável: ordem no DOM, contagem de testes, `git diff` vazio. **A coisa
que decide se a entrega funcionou não é.**

O que se está fazendo é pôr um bloco âmbar no topo da tela, encostado em dois botões de download. Na
tela de bloqueio deste mesmo produto — mesmo componente, mesma família de cor, dez linhas acima no
arquivo — essa composição significa *não baixe, corrija e reenvie*. A pessoa que confere faturamento
viu essa tela muitas vezes.

Se ela olhar a tela nova e hesitar, a entrega piorou o produto: trocou um aviso ignorado por um
aviso que trava. E nenhum dos onze testes deste plano vê isso.

**O que o `P4` pede, em dois passos, e cabe em cinco minutos:**

1. **A escuta.** Com leitor de tela, gerar um relatório no estado `prontoComAvisos` e ouvir o que a
   região viva lê depois de *Relatório gerado*. Esperado: o título do bloco, a frase que diz que o
   relatório foi gerado, e os avisos. O que reprova é o aviso soar **antes** da conclusão, ou a
   frase não ser lida — nos dois casos o problema é a ordem dentro da região, não a posição na tela.
2. **O olho.** Mostrar a tela a uma pessoa do faturamento e fazer **uma** pergunta, sem explicar
   nada antes: *"isto te impede de baixar o relatório?"*. A resposta esperada é *não*.

Resposta *sim* reprova **a frase da `R-AVI-05`**, e o conserto é textual: dizer mais cedo e mais
claro que o relatório está pronto. Desfazer a posição seria devolver o problema que a espec inteira
descreve.

E vale registrar o precedente: a ESPEC 023 declarou-se *"implementada com ressalva"* com o `P5`
aberto por exigir duas pessoas do faturamento diante das telas. **Deixar o `P4` aberto é aceitável;
dá-lo por fechado sem ter acontecido, não.**

---

## 8. O inventário, e as buscas

Sobre `frontend/`:

| # | Busca | O que acha | O que já se sabe |
|---|---|---|---|
| 1 | `avisos` em `src/` | quem consome a lista | `types.ts:23,190,213`, `api.ts:196`, `ResultadoPanel.tsx:238,259,322`. **Três pontos no componente, e só o da 322 e o da 259 mudam** — o 238 é o estado `bloqueado` (`R-AVI-09`) |
| 2 | `registrado`, `aviso(s)` | o texto que sai da faixa | Só `ResultadoPanel.tsx:259-260`. Nenhum teste o afirma (ESPEC §2.2) |
| 3 | `titulo-analise`, `titulo-derivadas`, `titulo-divergencia`, `divergencias` | os `id` de cabeçalho já usados | `AnaliseMedicaoPanel.tsx:214`, `LinhasDerivadas.tsx:92`, `DivergenciaDeFonte.tsx:133`, `DivergenciaGrid.tsx:212`. **`titulo-avisos` está livre** — confirmar antes de usar |
| 4 | `compareDocumentPosition` | a técnica de ordem, já em uso | `analise.spec.ts:87`, `a11y-estrutura.spec.ts:222`. Copiar, não inventar |
| 5 | `ESTADOS`, `Object.entries(ESTADOS)` | o que uma entrada nova em `estados.ts` liga | `a11y-axe.spec.ts:37` (× 2 larguras) e `a11y-contraste.spec.ts:173`. **Três testes de graça, três gerações de custo** |
| 6 | `INVENTARIO`, `MUTADAS`, `fala` | o que exige entrada no inventário | `inventario-de-anuncios.ts`. Mecanismo **novo** exige entrada; conteúdo novo em região existente exige só a `fala` (`T-2361`) |
| 7 | `h1, h2, h3` | o teste de hierarquia | `a11y-estrutura.spec.ts:141-157`. Já existente, e é rede desta entrega sem uma linha nova |
| 8 | `role="alert"` em `src/` | onde o papel é legítimo | `ResultadoPanel.tsx:208,218` — `erro` e `bloqueado`, os dois declarados no inventário. O bloco novo **não** entra nessa lista |

Sobre `backend/`: **nenhuma.** Se alguma busca aqui achar trabalho a fazer, o escopo vazou.

> **A busca 5 é a que engana.** Uma linha em `ESTADOS` cria três testes em dois arquivos que ninguém
> abriu — e cada um deles paga uma geração real. É barato e é ótimo; só não pode ser surpresa na hora
> de comparar o total da `T-2362` com o da `T-2347`.

---

## 9. Emenda de execução

*A preencher na execução, com o que o plano não previu.*
