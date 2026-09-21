# TASKS 038 — Backlog de "O aviso que ficou embaixo de três tabelas"

| | |
|---|---|
| **Especificação** | [ESPEC 038](../specs/038-o-aviso-que-ficou-embaixo-de-tres-tabelas.md) v1.0 |
| **Plano** | [PLANO 038](../plans/038-plano-o-aviso-que-ficou-embaixo-de-tres-tabelas.md) v1.0 |
| **Versão** | 1.0 — 2026-09-01 |
| **Total** | 19 tarefas · 5 portões · 4 insumos em aberto |
| **Status** | **A executar** |

> **Escrito antes da implementação.** A §10 é a única seção que não pode ser escrita agora, e é a
> que a próxima entrega vai ler.

> **Um arquivo de produção, e só um.** `ResultadoPanel.tsx`. Nenhuma linha de `backend/`, nenhum
> outro componente, nenhum tipo. Se o diff tiver um segundo arquivo de `frontend/src/`, houve escopo
> que entrou sozinho — e a `T-2358` é onde isso aparece.

> **O portão que decide esta entrega é humano.** Âmbar no topo, encostado em dois botões de
> download, é a gramática da tela de bloqueio deste mesmo produto. Nenhum dos onze testes vê isso.
> `P4`, `T-2364`, PLANO §7.

---

## 1. Convenções

**Identificadores** `T-23nn`, continuando de `T-2346`, a última da ESPEC 037.

**Definição de pronto:** código e teste na mesma entrega; `npx tsc --noEmit` sem erro; `pnpm lint`
sem aviso; a suíte de navegador verde **com o backend no ar**. Medido nesta árvore em 2026-09-01,
antes de começar: `tsc` limpo, `lint` limpo, **120 testes em 15 arquivos**, backend **1.543
coletados**.

*O aviso de depreciação do `next lint` — *"será removido no Next.js 16"* — é pré-existente e **não é
desta entrega**. Não migrar nada aqui.*

**Convenção de commit** `<tipo>(T-2nnn): descrição`. A mudança de posição é `fix(...)` — corrige um
defeito de leitura, não acrescenta função; o dublê e os specs são `test(...)`; ESPEC, PLANO,
CHANGELOG e README são `docs(...)`. **Nunca dois tipos no mesmo commit.**

### 1.1 Seis regras que atravessam este backlog

**1 — Um arquivo de produção.** `frontend/src/app/components/ResultadoPanel.tsx`. `ListaDeAchados`,
`CartaoDeAchado`, `CartaoAgregado` e `agruparPorValidacao` **não são tocados**: o formato do cartão é
o `I-01` da espec, e é entrega própria.

*O sinal no diff:* qualquer segundo arquivo em `frontend/src/`.

**2 — O backend não existe nesta entrega.** Nenhum arquivo, nenhum teste, nenhum schema. A resposta
da API já traz `avisos`, e é tudo de que a tela precisa.

*O sinal no diff:* qualquer linha sob `backend/`.

**3 — A rede vem antes do componente, e tem de reprovar dizendo o quê.** A `E1` inteira roda com
`ResultadoPanel.tsx` intocado. A `T-2354` não pergunta *"reprovou?"*: pergunta *"reprovou por qual
dos três motivos?"*.

*O sinal no diff:* um commit que traga teste e componente juntos na `E1`.

**4 — "A contagem aparece uma vez" não é asserção; é decoração.** Hoje ela **já** aparece uma vez, na
faixa. O teste tem de dizer *uma vez **e dentro do cabeçalho do bloco***, que é o que reprova hoje.
É o erro mais fácil de cometer neste backlog.

*O sinal no diff:* a `T-2353` verde com o componente intocado.

**5 — Uma única diferença de ordem.** Entre a transcrição da `T-2348` e a da `T-2358`, o bloco âmbar
muda de lugar e **nada mais**. `LinhasDerivadas` e `DivergenciaDeFonte` não se movem (`R-AVI-06`).

*O sinal no diff:* dois `h2` trocando de posição relativa, ou uma seção que sumiu.

**6 — Sem `role="alert"`, sem cor nova.** O painel já está dentro da região `aria-live="polite"` da
`R-ACE-13`; o papel de alerta ali produz anúncio duplo, um deles cortando o que estiver sendo lido
(`R-AVI-07`). O âmbar é o do `CartaoDeAchado` (`R-AVI-08`).

*O sinal no diff:* `role="alert"` novo em `ResultadoPanel.tsx`, ou uma classe de cor que não seja
`border-amber-200 bg-amber-50 text-amber-900`.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase | Depende de decisão? |
|---|---|---|---|---|
| **E0** Linha de base e a ordem congelada | T-2347 … T-2350 | **P0** | F0 | não |
| **E1** A rede, vermelha e pelo motivo certo | T-2351 … T-2354 | **P1** | F1 | não |
| **E2** A tela | T-2355 … T-2358 | **P2** | F2 | não |
| **E3** As varreduras, o conjunto e os documentos | T-2359 … T-2365 | **P3**, **P4** | F3 | `P4` depende de gente |

### 2.1 A régua da entrega — o que pode mudar de comportamento

| Muda | Não muda |
|---|---|
| A **posição** do bloco de avisos no estado `pronto` | O estado `bloqueado`, onde a ordem já é esta (`R-AVI-09`) |
| O bloco ganha `<section>`, `h2` com contagem e frase de contexto | O conteúdo dos cartões — `ListaDeAchados` e os dois cartões, intocados (regra 1) |
| A faixa perde ` · N aviso(s) registrado(s)` | A frase `{n} de {m} itens com divergência entre contratado e medido`, que `smoke.spec.ts:49` afirma |
| Dois comentários de `ResultadoPanel.tsx` deixam de citar o bloco âmbar como âncora | A posição de `LinhasDerivadas` e `DivergenciaDeFonte` (regra 5) |
| `estados.ts` ganha `prontoComAvisos`, e ele entra em `ESTADOS` | `estados.ts:435` — os dois dublês de `comDivergencias` continuam zerando `avisos` (`R-FON-09`) |
| `avisos.spec.ts` — arquivo novo | Os 120 testes existentes, todos |
| A `fala` da entrada `conclusao` do inventário | O inventário no mais: **nenhum mecanismo de anúncio é criado** (regra 6) |
| ESPEC 021 `D-07`, ESPEC 023 `D-08` e `R-FON-10` ganham nota; `README`, `CHANGELOG`, `Status` | `backend/` inteiro (regra 2); `types.ts`; `api.ts`; `Barra.tsx` |

---

## 3. Épico E0 — Linha de base e a ordem congelada `[portão P0]`

> **Nenhum arquivo é tocado neste épico.** Só se mede e se transcreve.

#### T-2347 — Linha de base da suíte de navegador `[portão]`
**Tamanho:** PP de trabalho, ~32 min de execução · **Ref:** **P0**, **P3**

`npx playwright test --list` e a suíte completa, com o backend no ar. Medido em 2026-09-01, antes de
começar: **120 testes em 15 arquivos**.

Registrar neste documento o `passed`, e **a lista de falhas se houver**.

**Vermelho prévio não é problema desta entrega, e não pode ser ignorado.** A ESPEC 030 existe porque
vermelho crônico virou paisagem uma vez, e o hábito que ela combate é ler *"falhou"* e seguir. Se
houver, classificar por `R-SUI-02` — deriva ou defeito, com dono nomeado — e registrar aqui **antes**
da `E1`. O que não se faz é começar sem saber quantos e quais.

**Pronto quando:** o número e a lista estão neste documento.

---

#### T-2348 — Congelar a ordem de hoje `[portão, risco]`
**Tamanho:** PP · **Ref:** **P0**, **P2**, regra 5

No estado `pronto`, listar os `h2` dentro de `#conteudo` na ordem do documento, e a posição do `<ul>`
âmbar em relação a eles. O esperado, lido em `ResultadoPanel.tsx:245-327`:

| # | `h2` | origem |
|---|---|---|
| 1 | Relatório gerado | `ResultadoPanel.tsx:249` |
| 2 | Análise da medição | `AnaliseMedicaoPanel.tsx:215` (`#titulo-analise`) |
| 3 | Divergências, na ordem do relatório | `DivergenciaGrid.tsx:154` |
| 4 | Linhas derivadas | `LinhasDerivadas.tsx:93` (`#titulo-derivadas`) |
| 5 | Divergência de fonte | `DivergenciaDeFonte.tsx:144` (`#titulo-divergencia`) |
| — | **o bloco de avisos** | `ResultadoPanel.tsx:322` — **depois de todos, e sem cabeçalho nenhum** |

**É a tarefa mais importante deste épico.** Sem esta lista transcrita, a `T-2358` não tem como provar
que moveu **uma** coisa — e "moveu uma coisa" é o portão `P2` inteiro.

**Reproduzir, não copiar desta tabela.** O piloto pode não emitir aviso nenhum no `pronto`: neste
caso a linha do `<ul>` âmbar é medida no dublê da `T-2351`, e as cinco de cima são medidas agora.

**Pronto quando:** a ordem está transcrita neste documento, medida na tela.

---

#### T-2349 — Reconfirmar as duas varreduras da ESPEC §2.2
**Tamanho:** PP · **Ref:** **P0**

Nesta árvore, confirmar o que a espec mediu:

1. **nenhum** teste afirma a posição do bloco de avisos nem o texto `aviso(s) registrado(s)`;
2. os dois dublês de `pronto` zeram a lista — `estados.ts:435`, `corpo.avisos = []`, pela `R-FON-09`;
3. as únicas afirmações sobre avisos na suíte — `achados-agregados.spec.ts` e o dublê de
   `estados.ts:140-170` — são no estado **bloqueado**.

**É o que autoriza a `E2` a mover o bloco sem reancorar teste nenhum.** Se alguma das três cair,
a entrega ganha uma tarefa de reancoragem, e ela é `R-SUI-04`: deriva reancora o teste, e num commit
separado do que muda o produto.

**Pronto quando:** as três confirmadas, com os comandos de busca registrados.

---

#### T-2350 — A régua do "não toquei o backend"
**Tamanho:** PP · **Ref:** **P3**, regra 2

`cd backend && python -m pytest --collect-only -q`. Medido em 2026-09-01: **1.543 coletados**.

**Com o `-m`.** `uv run pytest` puro quebra a coleta deste projeto, e o número que sair dele não
serve de régua.

Não é preciso rodar a suíte de backend inteira: esta entrega não toca uma linha dela, e o que se
quer é um número que a `T-2363` possa repetir.

**Pronto quando:** o número está neste documento.

---

## 4. Épico E1 — A rede, vermelha e pelo motivo certo `[portão P1]`

> **`ResultadoPanel.tsx` não é tocado neste épico.** É a regra 3, e é o que dá sentido ao `P1`.

#### T-2351 — O dublê `prontoComAvisos`
**Tamanho:** P · **Ref:** `R-AVI-01`, ESPEC §2.1

Em `estados.ts`, no molde de `comDivergencias` ([estados.ts:414-447](../../frontend/e2e/estados.ts#L414-L447)):
esperar o `200` real com `endsWith("/reports")`, ler o corpo, escrever `corpo.avisos`, e servir o
corpo mutado por `page.route`.

**Dois avisos, e de formatos diferentes** — porque o bloco pode conter os dois, e a ESPEC §2.1 mostra
que oito das treze validações que emitem `AVISA` ainda mandam só `mensagem`:

| validação | formato | por quê |
|---|---|---|
| `V-MED-03` | só `mensagem` | é o da captura que originou a espec; exercita o caminho de `CartaoDeAchado` sem `titulo` (`ResultadoPanel.tsx:42-49`) |
| `V-ANX-01` | quatro partes (`titulo`, `causa`, `acao`, `detalhe`) | exercita o caminho da `R-DOC-05`, com o `<details>` de diagnóstico. É uma das cinco que usam `registrar_em_partes`, e das poucas que mandam `detalhe` ([annex_validations.py:50-60](../../backend/src/infrastructure/validations/annex_validations.py#L50-L60)) |

**`endsWith`, nunca `includes`.** `POST /reports/conferencia-previa` **contém** `/reports` e responde
antes da geração: com `includes`, a espera captura o corpo do portão de identidade e a tela nunca
vira `pronto`. É a T-2103 da ESPEC 029, e custou onze testes vermelhos uma vez.

**Não entra em `ESTADOS` ainda** — isso é a `T-2359`, e entrar aqui ligaria três varreduras antes de
a tela existir.

**Pronto quando:** `prontoComAvisos` monta a tela com os dois cartões visíveis.

---

#### T-2352 — O teste da ordem
**Tamanho:** PP · **Ref:** ESPEC `P0`, `R-AVI-01`

`frontend/e2e/avisos.spec.ts`, arquivo novo. Com `prontoComAvisos` montado, o cabeçalho do bloco de
avisos **precede** `#titulo-analise` no documento.

**Por `compareDocumentPosition`**, no molde de [analise.spec.ts:84-99](../../frontend/e2e/analise.spec.ts#L84-L99)
e de [a11y-estrutura.spec.ts:208-230](../../frontend/e2e/a11y-estrutura.spec.ts#L208-L230). **Nunca
por coordenada de pixel:** posição na tela depende de viewport, de fonte e do que estiver aberto;
ordem no documento é o que a regra afirma.

**Pronto quando:** escrito, e vermelho — devolvendo `"depois"`.

---

#### T-2353 — O cabeçalho e a contagem `[risco]`
**Tamanho:** PP · **Ref:** `R-AVI-02`, `R-AVI-04`, regra 4

No mesmo arquivo, duas asserções:

1. **o bloco é alcançável por cabeçalho** — `getByRole("heading")` o encontra pelo nome. É a §1.3 da
   espec virada em teste: hoje o último cabeçalho da tela é *Divergência de fonte*, e o que vem
   depois só existe para quem rolar até o fim;
2. **a contagem aparece uma vez, e dentro do cabeçalho.**

**A segunda metade da frase 2 é o teste inteiro.** *"Aparece uma vez"* já é verdade hoje — na faixa —
e um teste escrito ao pé da letra da `R-AVI-04` passaria antes e depois da entrega. O que reprova
hoje é a exigência de **onde**: não há cabeçalho para o número estar dentro.

*O modo de falha:* a `T-2354` encontrar este teste verde com o componente intocado. Se isso
acontecer, o teste está errado — não o produto.

**Pronto quando:** escrito, e vermelho pelo motivo certo.

---

#### T-2354 — Conferir **como** cada um reprova `[portão]`
**Tamanho:** PP · **Ref:** **P1**, regra 3

Rodar `avisos.spec.ts` com `git diff frontend/src/` **vazio**, e conferir a mensagem de cada falha:

| teste | tem de reprovar dizendo |
|---|---|
| ordem (`T-2352`) | `"depois"` — o bloco vem depois de `#titulo-analise` |
| cabeçalho (`T-2353`) | `0` cabeçalhos encontrados com aquele nome |
| contagem (`T-2353`) | o número existe na tela, e **fora** de cabeçalho nenhum |

**Três vermelhos por três razões distintas.** Um vermelho genérico — *"elemento não encontrado"* nos
três — costuma significar que o dublê não montou a tela, e não que a regra está sendo medida.

**Pronto quando:** as três mensagens estão transcritas neste documento.

---

## 5. Épico E2 — A tela `[portão P2]`

#### T-2355 — O bloco sobe, com cabeçalho e frase
**Tamanho:** P · **Ref:** `R-AVI-01`, `02`, `03`, `05`

Em `ResultadoPanel.tsx`, o bloco sai de `322-326` e entra **logo abaixo da faixa de resultado**,
antes de `<AnaliseMedicaoPanel>`:

* `<section className="mt-6" aria-labelledby="titulo-avisos">` — `titulo-avisos` está livre,
  conferido em 2026-09-01;
* `h2` com a contagem, **singular e plural de verdade**: `1 aviso` / `N avisos`. O `aviso(s)` entre
  parênteses morre aqui (`R-PER-07`);
* a frase da `R-AVI-05`, dizendo que o relatório foi gerado **antes** de dizer o que conferir;
* `<ListaDeAchados achados={relatorio.avisos} tom="aviso" />`, **sem alteração**.

**A guarda `relatorio.avisos.length > 0` continua** (`R-AVI-03`): seção permanente com "nenhum aviso"
treina a pessoa a ignorar o lugar — é a `R-FON-11` e a `R-PER-10`.

**Sem `role="alert"` e sem cor nova** (regra 6). É o acréscimo mais tentador desta tarefa.

**Pronto quando:** a `T-2352` e a `T-2353` verdes.

---

#### T-2356 — A contagem sai da faixa
**Tamanho:** PP · **Ref:** `R-AVI-04`, `D-03`

Remover ` · ${relatorio.avisos.length} aviso(s) registrado(s)` de
[ResultadoPanel.tsx:259-260](../../frontend/src/app/components/ResultadoPanel.tsx#L259-L260).

**A frase da faixa não muda no mais.** `smoke.spec.ts:49` afirma `/36.*de 58 itens com divergência/`,
e ela tem de continuar verde — se reprovar, a faixa mudou mais do que devia.

**Isto revisa a `R-FON-10` da ESPEC 023**, e a nota que o registra é a `T-2365`. O contador não
desaparece: muda de lugar, e passa a ficar a zero pixels do que conta.

**Pronto quando:** o número aparece uma vez na tela, e `smoke` verde.

---

#### T-2357 — Os dois comentários que passariam a mentir
**Tamanho:** PP · **Ref:** `D-05`

[ResultadoPanel.tsx:293-301](../../frontend/src/app/components/ResultadoPanel.tsx#L293-L301) (antes
de `LinhasDerivadas`) e [309-316](../../frontend/src/app/components/ResultadoPanel.tsx#L309-L316)
(antes de `DivergenciaDeFonte`) localizam as duas seções **pelo bloco âmbar** — *"acima do bloco
amarelo"*, *"a seção ocupa o lugar do bloco âmbar"*.

Passam a dizer o que as seções **são** — as últimas da tela, ressalva depois do que ela ressalva —,
com remissão à ESPEC 038 `D-05`.

**A `R-PAN-01` continua citada nos dois.** Ela não mudou: gravidade, depois seções, depois ressalvas.
O que muda é que o aviso deixou de ser servido como se fosse ressalva.

**Comentário que aponta para uma âncora que saiu é a forma mais barata de a próxima pessoa
reconstituir a ordem errada.** Por isso entra no mesmo commit da `T-2355`, e não depois.

**Pronto quando:** nenhum dos dois cita o bloco âmbar como referência de posição.

---

#### T-2358 — Uma única diferença `[portão]`
**Tamanho:** PP · **Ref:** **P2**, regras 1 e 5

Três verificações:

1. os três testes da `E1` verdes;
2. a `T-2348` reproduzida: os cinco `h2` na **mesma ordem relativa**, e o bloco de avisos agora entre
   o 1º e o 2º. **Uma diferença, não duas**;
3. `git diff --name-only` com **um** arquivo em `frontend/src/`, e **nenhum** em `backend/`.

**A forma mais provável de estragar esta entrega é aproveitar a viagem** — reorganizar uma seção
vizinha, "melhorar" um espaçamento, unificar dois títulos. Duas diferenças na ordem reprovam o
portão.

**Pronto quando:** as três conferem.

---

## 6. Épico E3 — As varreduras, o conjunto e os documentos `[portões P3, P4]`

#### T-2359 — `prontoComAvisos` entra em `ESTADOS`
**Tamanho:** PP · **Ref:** **P3**

Uma linha em [estados.ts:459](../../frontend/e2e/estados.ts#L459), e três testes nascem em dois
arquivos que ninguém abriu: `axe` nas duas larguras ([a11y-axe.spec.ts:37](../../frontend/e2e/a11y-axe.spec.ts#L37))
e o contraste ([a11y-contraste.spec.ts:173](../../frontend/e2e/a11y-contraste.spec.ts#L173)).

**Custo: três gerações reais**, ~2 min sobre os 32 da suíte. **Ganho:** um estado que hoje
**nenhuma varredura cobre** — a ESPEC §2.2 mostrou que os dois dublês de `pronto` zeram `avisos` de
propósito.

**Pronto quando:** os três testes aparecem na lista e passam.

---

#### T-2360 — `axe` no estado novo, nas duas larguras `[portão]`
**Tamanho:** PP · **Ref:** **P3**

Verde a 1366 e a 390 px.

**O par âmbar já passa no contraste do estado `bloqueado`**, com os mesmos tokens — então uma
reprovação aqui não é de cor: é de estrutura. O candidato provável é `aria-labelledby="titulo-avisos"`
apontando para um `id` que não foi escrito no `h2`, que o `axe` reporta como
`aria-valid-attr-value`.

**Pronto quando:** zero violações nas duas larguras.

---

#### T-2361 — A `fala` do inventário `[risco]`
**Tamanho:** PP · **Ref:** `R-TA-05`, ESPEC 016

A entrada `conclusao` de [inventario-de-anuncios.ts:113-121](../../frontend/e2e/inventario-de-anuncios.ts#L113-L121)
declara que a região viva lê *"Relatório gerado, e o placar de divergências."*. Com o bloco dentro da
mesma região, ela passa a ler também o título dos avisos e a frase de contexto.

**Entrada nova não há.** Nenhum mecanismo de anúncio foi criado — é o que a regra 6 garante —, e o
`R-TA-07` só exige entrada para mecanismo novo.

**É a tarefa que se esquece.** Nenhum teste reprova por `fala` desatualizada: ela é verificada por
escuta humana (`R-TA-05`), e por isso envelhece em silêncio. O inventário existe exatamente para não
depender de alguém lembrar.

**Pronto quando:** a `fala` diz o que a região passa a ler, e `anuncio.spec.ts` continua verde.

---

#### T-2362 — A suíte de navegador completa `[portão]`
**Tamanho:** PP de trabalho, ~32 min de execução · **Ref:** **P3**

Completa, com o backend no ar, comparada com a `T-2347`.

Esperado: **120 + 3 varreduras (`T-2359`) + os testes de `avisos.spec.ts`**. Se o total não bater,
comparar **teste a teste** com a lista da `T-2347` — total que fecha por acaso esconde um teste
perdido e um ganho.

**Pronto quando:** verde, com o número declarado neste documento.

---

#### T-2363 — O backend intocado `[portão]`
**Tamanho:** PP · **Ref:** **P3**, regra 2

`git diff --stat backend/` **vazio**, e `python -m pytest --collect-only -q` ainda **1.543**.

**A árvore está limpa nesta entrega** — diferente das ESPECs 036 e 037, não há entrega alheia dentro
—, então *"diff vazio"* é verificável ao pé da letra, e não precisa da forma fraca que a TASKS 037
§10 teve de inventar.

**Pronto quando:** os dois conferem.

---

#### T-2364 — A escuta e o olho `[portão humano, risco]`
**Tamanho:** P — cinco minutos, mais o tempo de achar as pessoas · **Ref:** **P4**, PLANO §7

Dois passos, e o segundo é o que decide a entrega:

1. **A escuta.** Com leitor de tela, montar `prontoComAvisos` e ouvir o que a região viva lê depois
   de *Relatório gerado*. Esperado: o título do bloco, a frase de contexto e os avisos. **Reprova**
   se o aviso soar antes da conclusão, ou se a frase não for lida — nos dois casos o problema é a
   ordem dentro da região, não a posição na tela.
2. **O olho.** Mostrar a tela a uma pessoa do faturamento e fazer **uma** pergunta, sem explicar
   nada antes: *"isto te impede de baixar o relatório?"*. Esperado: **não**.

**Resposta *sim* reprova a frase da `R-AVI-05`, não a posição.** O conserto é textual — dizer mais
cedo e mais claro que o relatório está pronto. Desfazer a posição seria devolver o problema que a
espec inteira descreve.

**Pode ficar declarado aberto**, como a ESPEC 023 fez com o `P5` — *"exige duas pessoas do
faturamento diante das telas, e é humano"*. **O que não pode é ser dado por fechado sem ter
acontecido.**

**Pronto quando:** os dois passos aconteceram e estão registrados na §10 — ou o `P4` está declarado
aberto, com a razão escrita.

---

#### T-2365 — ESPEC, notas, CHANGELOG e README
**Tamanho:** PP · **Ref:** `D-03`, `D-05`

- **`Status` da ESPEC 038**: de *Proposta* para *Implementada*, com os números medidos e o estado do
  `P4`;
- **ESPEC 021 `D-07`** e **ESPEC 023 `D-08`**: nota remetendo à ESPEC 038 `D-05` — a âncora *"onde o
  bloco âmbar está"* saiu; a decisão de ordem que as duas tomaram **não** mudou;
- **ESPEC 023 `R-FON-10`**: nota remetendo à `D-03` — o contador mudou de lugar;
- **`docs/CHANGELOG.md`**: entrada de mudança de rumo. É onde a revisão de `R-FON-10` fica visível
  para quem não ler a ESPEC 038;
- **`README.md`**: linha `Incremento 038` na tabela (o padrão da linha 48).

**Pronto quando:** os cinco escritos, e `git diff` dos documentos mostra só as edições esperadas.

---

## 7. O que este backlog não faz

- **Não toca o `backend/`** (regra 2, `T-2363`).
- **Não muda o estado `bloqueado`** (`R-AVI-09`), onde a ordem já é a desta espec.
- **Não toca `CartaoDeAchado`, `CartaoAgregado` nem `agruparPorValidacao`** — `I-01`.
- **Não move `LinhasDerivadas` nem `DivergenciaDeFonte`** (regra 5).
- **Não cria mecanismo de anúncio**, logo não cria entrada no inventário (`T-2361`).
- **Não acrescenta cor, token ou severidade** (regra 6).
- **Não toca `Barra.tsx`** — `I-03`.
- **Não recolhe o bloco quando há muitos avisos** — `I-02`.
- **Não migra o `next lint`** para a CLI do ESLint. O aviso de depreciação é pré-existente.

---

## 8. Sequência e commits

```
E0 ──► E1 ──► E2 ──► E3
P0     P1     P2     P3 + P4

E0  a ordem de hoje, transcrita           nenhum arquivo tocado
E1  três vermelhos, o componente intocado test(T-2351..54)
E2  o bloco sobe, e UMA coisa muda        fix(T-2355..57)
E3  varreduras, números, escuta, docs     test(T-2359) · docs(T-2365)
```

**A `E1` e a `E2` não se juntam num commit.** Quem ler o histórico precisa poder ver a rede vermelha
antes do conserto — é o que prova que ela mede o que diz medir (regra 3).

---

## 9. Insumos em aberto

| ID | Questão | Bloqueia? |
|---|---|---|
| `I-01` | Oito das treze validações que emitem `AVISA` usam `registrar` e não `registrar_em_partes`: cartão sem título, sigla à vista, texto técnico no meio da frase. Subir o bloco torna isso **mais** visível | Não. É a `R-DOC-05` da ESPEC 025 aplicada às que ficaram para trás, e é entrega própria |
| `I-02` | Há um número de avisos a partir do qual o bloco deve recolher-se, como os quatro blocos da análise? | Não. Só se responde com um par real que produza muitos |
| `I-03` | A `Barra` fixa mostra o placar de divergências e não menciona avisos. Vale um indicador ali, agora que a contagem saiu da faixa? | Não. É `R-CAB-05`/`R-CAB-06`, e é outra decisão |
| `I-04` | O manual (`scripts/conteudo_do_manual.py`) descreve a tela com o bloco no fim? A ESPEC 023 §2.5 já achou o manual desatualizado uma vez | Não. Auditoria do manual é maior que esta entrega |

---

## 10. Emenda de execução

*A preencher na execução, com o que o backlog não previu.*
