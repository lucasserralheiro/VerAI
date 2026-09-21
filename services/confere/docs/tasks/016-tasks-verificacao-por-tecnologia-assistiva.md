# TASKS 016 — Backlog da Verificação por Tecnologia Assistiva

| | |
|---|---|
| **Especificação** | [ESPEC 016](../specs/016-verificacao-por-tecnologia-assistiva.md) v1.1 |
| **Plano** | [PLANO 016](../plans/016-plano-verificacao-por-tecnologia-assistiva.md) v1.0 |
| **Versão** | 1.0 — 2026-08-12 |
| **Total** | 30 tarefas · 3 insumos |
| **Status** | **Não iniciado** |

> Escrito **antes** da implementação, como o TASKS 003, 004, 008, 009, 012, 013 e 015.

---

## 1. Convenções

**Identificadores** `T-10nn` seguem a numeração do PLANO 016, que começa em T-1000 porque o
PLANO 015 fechou em T-934. **Quatro tarefas nascem neste backlog** — T-1026 a T-1029 — e estão
registradas como emendas em §2.2.

**Definição de pronto:** teste na mesma entrega; `tsc --noEmit`, `next lint` e `next build` limpos;
comentário explicando o *porquê* onde a escolha não for óbvia.

**Convenção de commit** `<tipo>(T-10nn): descrição`.

### 1.1 Cinco regras que atravessam o backlog

**1 — `frontend/src/` não é tocado. Em nenhuma tarefa.** Toda a pasta fica somente leitura:

```
frontend/src/
```

Não é cautela: é o que sustenta o portão P3. Se `src/` não muda, a captura tem de sair **idêntica
em todos os estados**, e qualquer diferença é sintoma. Se uma tarefa parecer exigir mudança ali,
**pare** — o achado vira entrega própria (`I-20`), não conserto de passagem.

**2 — O inventário não é escrito a partir do DOM.** É o risco central do PLANO 016 §1. Preencher
olhando o DevTools produz um arquivo que parece certo e faz `R-TA-10` passar **por construção**:
"todo mecanismo tem entrada" e "toda entrada tem mecanismo" viram tautologias. A fonte são as
**regras** — `R-ACE-13`, `R-ACE-14`, `R-ACE-16`, `R-LMP-10`. O DOM é a outra ponta da comparação.

**Se você abrir o DevTools durante a T-1004, pare.**

**3 — Espécie antes de asserção.** Nunca aplicar identidade de nó a `role="alert"`. Alert é região
assertiva e atômica cujo padrão de uso **é** aparecer — testar que ele não é inserido afirmaria o
oposto da norma, e deixaria a suíte vermelha contra código certo (PLANO 016 §6.1).

**4 — Nenhum teste sai mais fraco.** Vale sobretudo para a T-416: trocar `toHaveCount(1)` por
`toHaveCount(inventario.length)` troca uma constante cega por outra. O que a reescrita tem de
afirmar é **correspondência**, não cardinalidade.

**5 — Nenhuma constante literal de contagem em teste novo.** Contagem vem do inventário. É a regra
que a §2.5 da espec existe para instituir, e ela se aplica ao código que este backlog escreve, não
só ao que ele corrige.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Situação |
|---|---|---|---|
| **E0** O ambiente, a referência e **a escuta** | T-1027 · T-1017 · T-1000 … T-1003 | **P1** | ⬜ |
| **E1** O inventário, escrito das regras | T-1028 · T-1004 … T-1007 | — | ⬜ |
| **E2** Os testes de mecanismo | T-1008 … T-1013 · T-1029 | **P2** | ⬜ |
| **E3** A T-416 sem número mágico | T-1014 … T-1016 | — | ⬜ |
| **E4** Regressão | T-1020 · T-1018 · T-1019 | **P3** | ⬜ |
| **E5** Documentação e continuidade | T-1026 · T-1021 … T-1025 | — | ⬜ |

**Ordem:** E0 → E1 → E2 → E3 → E4 → E5. Linear, e a dependência da E0 é de **conteúdo**: as
observações dela mudam o que o inventário declara e o que os testes afirmam.

### Os três portões

| Portão | Critério | Resultado |
|---|---|---|
| **P1 — a escuta, uma vez** | Cinco passos da ESPEC 016 §8.3, com o par registrado e as observações escritas | ⬜ |
| **P2 — instrumento verificado** | `R-TA-02`, `R-TA-10` e `R-TA-11` verdes **e vistos reprovar** nos quatro modos | ⬜ |
| **P3 — nada regrediu** | Tabela da ESPEC 016 §8.2 numa **única** execução; captura idêntica | ⬜ |

### Resultado

*A preencher na T-1025.*

### 2.1 Pontos de não retorno

**Um, e não é de código.** A **T-1017** — capturar a referência — é irrecuperável se pulada:
`capturar-baseline.mjs:8` registra que as capturas não são versionadas, e a pasta `referencia`
existente é da ESPEC 015, já com deriva de ambiente conhecida (TASKS 015 §12.3).

Fora isso, a entrega é `git revert` do épico: dois arquivos de teste novos, um alterado, nada
persistido, e **zero arquivos de produção**.

### 2.2 Quatro desvios já conhecidos, antes de começar

Registrados agora, não contornados — conduta da ESPEC 007 §13. Os três primeiros são buracos do
PLANO 016, encontrados ao auditá-lo.

**1 — `R-TA-07` não tem tarefa no plano.**

É a regra que manda toda espec futura acrescentar a entrada no inventário e o teste
correspondente — ou seja, **a regra que decide se o instrumento sobrevive à próxima spec ou
apodrece**. Nenhuma das 26 tarefas do PLANO 016 a implementa ou a registra em lugar algum.

Regra sem tarefa é regra que ninguém aplica. A **T-1026** a fecha, e o ponto dela não é escrever a
regra outra vez: é decidir **onde ela passa a viver** para ser encontrada por quem escrever a
ESPEC 017.

**2 — A captura de referência estava na fase errada.**

O PLANO 016 pôs a T-1017 na F4, por ser do portão P3, e precisou de um parágrafo para explicar que
ela roda antes da F1. **Se uma tarefa precisa de parágrafo para justificar a posição, a posição
está errada.** Ela vem para a E0, que não toca arquivo nenhum e já exige o ambiente no ar — como o
PLANO 015 fez.

**3 — Falta tarefa de ambiente, de novo.**

O TASKS 015 §2.2 registrou exatamente esta lacuna e criou a T-933 por causa dela. O PLANO 016 a
repete: a E0 e a E4 precisam de backend e frontend no ar, e nenhuma tarefa os sobe. A conferência
de saúde existia (T-1020), mas enterrada na E4 — longe de onde é necessária pela primeira vez.

A **T-1027** sobe o ambiente e confere **o conteúdo servido**, não só o `200`. Um `200` sozinho não
distingue "subiu" de "subiu quebrada", que foi o modo de falha de duas execuções na entrega
anterior (TASKS 015 §12.2).

**4 — A bifurcação depois da escuta: aceita como está.**

O PLANO 016 §6.2 pergunta se o `role="alert"` aninhado é anunciado uma vez, duas ou nenhuma, e não
diz o que acontece com a E1 e a E2 em cada caso. **Isso fica como está**, e a razão é deliberada:
planejar ramos que dependem de uma medição nunca feita é especulação, e especulação em backlog vira
tarefa que ninguém executa.

O que entra é uma frase por desfecho, na T-1002, para que a decisão seja rápida quando o número
existir — e não um ramo inteiro escrito no escuro.

### 2.3 A régua da E2 — o que pode mudar no repositório

| Onde | Delta esperado |
|---|---|
| `frontend/e2e/inventario-de-anuncios.ts` | **Novo** |
| `frontend/e2e/anuncio.spec.ts` | **Novo** |
| `frontend/e2e/a11y-estrutura.spec.ts` | **Alterado** — só a T-416 |
| `frontend/e2e/limpar.spec.ts` | **Talvez** — só o `R-LMP-13`, e só se a T-1016 decidir absorvê-lo |
| `frontend/src/` · `backend/` | **Nenhum** — §1.1 regra 1 |
| Captura, em todos os estados e larguras | **Nenhum.** Zero exceções sancionadas |
| Contagem de testes de backend | **379, idêntica** |

**Se aparecer uma sétima diferença, pare.**

---

## 3. Épico E0 — O ambiente, a referência e a escuta `[portão P1]`

> **Nenhum arquivo é tocado neste épico.** E a T-1017 não pode ser feita depois — §2.1.

#### T-1027 — Subir o ambiente e conferir o que ele serve `[nasce neste backlog]`
**Tamanho:** PP · **Ref:** §2.2 desvio 3

Backend em `127.0.0.1:8000` e frontend em `localhost:3000`.

Conferir **três** coisas, não uma: `/health` responde `200`; `/` responde `200`; e o HTML servido
contém os marcadores da tela — o formulário, a região viva e o diálogo. As duas primeiras não
distinguem "subiu" de "subiu quebrada".

**Pronto quando:** os três marcadores foram encontrados no HTML servido, e não só o status.

---

#### T-1017 — Capturar a referência `[irrecuperável]` `[movida da F4]`
**Tamanho:** P · **Ref:** **Portão P3** · §2.2 desvio 2

`node scripts/capturar-baseline.mjs referencia-016` — 12 capturas, seis estados × duas larguras.

Pasta nova, e não reaproveitar a `referencia` da ESPEC 015: aquela foi tirada num `.next` anterior
e já acumulou deriva de ambiente conhecida (TASKS 015 §12.3).

**Pronto quando:** existem 12 PNGs em `test-results/a11y-baseline/referencia-016/`.

---

#### T-1000 — Ligar o leitor e registrar o par
**Tamanho:** PP · **Ref:** `R-TA-03`, `D-01` · **Insumo `K-13`**

`Ctrl+Win+Enter` para o Narrador, ou NVDA se disponível. Registrar **qual leitor e qual navegador**
aqui, antes de começar a ouvir.

Verificação sem instrumento nomeado não é reproduzível — e a próxima pessoa precisa saber se a
divergência que encontrar é da tela ou do leitor.

**Pronto quando:** o par está escrito neste backlog.

---

#### T-1001 — Os cinco passos
**Tamanho:** PP · **Ref:** `R-TA-04`, **Portão P1**

Percorrer o roteiro da [ESPEC 016 §8.3](../specs/016-verificacao-por-tecnologia-assistiva.md),
anotando **o que se ouviu** em cada passo — a frase, não o veredito.

| # | Ação | Fala esperada |
|---|---|---|
| 1 | `Tab` até o primeiro campo | *"Contrato, botão procurar arquivo"* |
| 2 | Escolher os dois, `Enter` no primário | *"Processando o relatório. Pode levar até um minuto."* |
| 3 | Aguardar a conclusão | O anúncio de conclusão — `P2` da ESPEC 008 |
| 4 | `Tab` até *Limpar*, `Enter`, confirmar | *"Formulário limpo. Envie novos arquivos…"* — `K-10` da ESPEC 015 |
| 5 | Entrada inválida | O `role="alert"` interrompe e é lido |

**Pronto quando:** existe uma transcrição, passo a passo. **Silêncio em qualquer passo é
reprovação**, e o passo diz qual mecanismo falhou.

---

#### T-1002 — A pergunta do `alert` aninhado `[risco]`
**Tamanho:** PP · **Ref:** PLANO 016 §6.2

No passo 5, responder especificamente: o `role="alert"` **dentro** da região `aria-live="polite"`
é anunciado **uma vez, duas, ou nenhuma**?

É pergunta de estrutura, levantada ao planejar, que só a escuta responde. E o desfecho decide pouco
agora, de propósito (§2.2 desvio 4):

| Resposta | O que muda |
|---|---|
| Uma vez | Nada. O aninhamento está correto e a E1 segue |
| Nenhuma | **Defeito real**, anterior a esta spec. Vira entrega própria (`I-20`); a E1 registra a entrada como não conforme |
| Duas | **Defeito real** — leitura duplicada. Mesmo tratamento |

**Pronto quando:** há um número, e ele está escrito aqui.

---

#### T-1003 — Registrar o que soou errado sem ser silêncio
**Tamanho:** PP · **Ref:** **Portão P1**

Anotar o que **aconteceu e estava errado**: texto truncado, ordem trocada, leitura dupla, fala
diferente da esperada.

**É o achado caro desta fase, e o mais fácil de perder.** O portão pergunta *"ouviu?"*, e a resposta
natural é sim ou não — mas silêncio é óbvio, e a automação da E2 o pegaria. O anúncio que acontece
e está errado, nada automatizado distingue de sucesso.

E há uma janela: **quem escutar nunca mais será ingênuo.** Da segunda vez em diante a pessoa já
sabe o que esperar, e passa a ouvir o que espera. Esta anotação vale mais agora do que em qualquer
repetição.

**Pronto quando:** as observações estão escritas, incluindo as que não reprovam nada.

---

## 4. Épico E1 — O inventário, escrito das regras

> **A regra 2 de §1.1 governa este épico inteiro.** Se você abrir o DevTools para preencher o
> inventário, o instrumento nasce inútil e nada fica vermelho.

#### T-1028 — A forma da entrada `[nasce neste backlog]`
**Tamanho:** PP · **Ref:** `R-TA-01`, `R-TA-06`

Definir o tipo de uma entrada em `e2e/inventario-de-anuncios.ts`, antes de preencher qualquer uma:

```
mecanismo    — o seletor que a identifica
estado       — qual dos estados de `estados.ts` a dispara
especie      — `mutada` | `inserida`   (§1.1 regra 3)
fala         — o que se espera ouvir, por extenso
automatizavel— booleano, com o motivo quando falso
```

Definir a forma antes do conteúdo é o que impede o campo `especie` de ser acrescentado depois, para
uma entrada só, quando o teste de `role="alert"` quebrar.

**Pronto quando:** o tipo existe e o compilador o exige em toda entrada.

---

#### T-1004 — Preencher, a partir das regras `[risco]`
**Tamanho:** P · **Ref:** `R-TA-01`, `D-06` · §1.1 regra 2

Uma entrada por mecanismo, escrita lendo `R-ACE-13`, `R-ACE-14`, `R-ACE-16` e `R-LMP-10` — as
regras que dizem **o que deve ser anunciado**.

**É aqui que este backlog mais pode falhar em silêncio.** Preencher olhando o DOM é o caminho de
menor resistência, produz um arquivo que parece certo, e faz `R-TA-10` passar sem afirmar nada. O
sintoma é a ausência de sintoma. É o defeito da T-801 do PLANO 013 com outro rosto.

**Pronto quando:** cada entrada aponta a regra que a exige. Entrada sem regra é entrada que veio do
DOM.

---

#### T-1005 — Declarar a espécie de cada uma
**Tamanho:** PP · **Ref:** `R-TA-02` emendada, PLANO 016 §6.1

`aria-live="polite"` e `role="status"` são **`mutada`**; `role="alert"` é **`inserida`**.

A distinção não é estética: ela decide qual asserção a E2 aplica, e aplicar a errada deixa a suíte
vermelha contra código certo.

**Pronto quando:** nenhuma entrada tem espécie omitida, e as duas de `role="alert"` estão como
`inserida`.

---

#### T-1006 — Confrontar com o DOM, à mão, uma vez
**Tamanho:** PP · **Ref:** PLANO 016 §1

Comparar o inventário escrito com o que a tela de fato tem, e **registrar as divergências aqui**.

Divergência é **achado**, não erro de digitação a corrigir em silêncio: ela significa que uma regra
pede um anúncio que não existe, ou que existe um anúncio que regra nenhuma pediu.

**Pronto quando:** ou não há divergência, ou cada uma está nomeada com o lado que está errado.

---

#### T-1007 — As não automatizáveis são os passos da escuta
**Tamanho:** PP · **Ref:** `R-TA-06`

A lista de entradas com `automatizavel: false` tem de **coincidir** com os passos da §8.3 da espec.

Se divergirem, um dos dois está desatualizado — e o mais provável é a lista da escuta, que é
prosa.

**Pronto quando:** as duas listas batem, ou a diferença está explicada.

---

## 5. Épico E2 — Os testes de mecanismo `[portão P2]`

#### T-1008 — Identidade de nó, para as `mutada`
**Tamanho:** M · **Ref:** `R-TA-02`

Guardar o nó, provocar a transição, e afirmar que é **o mesmo** nó com conteúdo novo.

É o `D-03` da ESPEC 008 virando asserção: inserção — nó novo — é o defeito que nenhuma inspeção de
atributo distingue de mutação.

**Pronto quando:** vale para todas as entradas de espécie `mutada`, dirigido pelo inventário e não
por uma lista escrita à mão no teste.

---

#### T-1009 — Presença, papel e mensagem, para as `inserida` `[risco]`
**Tamanho:** P · **Ref:** `R-TA-02` emendada, §1.1 regra 3

Para `role="alert"`, asserir que a região **aparece**, tem o papel certo e traz a mensagem.

**Não aplicar identidade de nó.** Para alert, inserir é o comportamento correto — testar o contrário
afirmaria o oposto da norma e deixaria a suíte vermelha contra código certo, que é o modo de falha
que mais rápido ensina uma equipe a ignorar uma suíte.

**Pronto quando:** o teste passa com o código atual, e passaria também se o alert fosse recriado a
cada render — porque é isso que se espera dele.

---

#### T-1010 — Ver a identidade de nó reprovar
**Tamanho:** P · **Ref:** **Portão P2**

Mover a região viva para dentro do retorno condicional de `ResultadoPanel` e conferir que a T-1008
fica **vermelha**, pelo motivo certo — nó diferente, não seletor não encontrado.

Instrumento que nasce verde não prova nada. **Desfazer a mudança depois** — §1.1 regra 1.

**Pronto quando:** o modo de falha está registrado aqui, e `src/` voltou ao original.

---

#### T-1011 — `R-TA-10`, sentido DOM → inventário
**Tamanho:** P · **Ref:** `R-TA-10`

Varrer os cinco estados de `estados.ts` e afirmar que todo `[aria-live]`, `[role=status]` e
`[role=alert]` encontrado tem entrada.

**Pronto quando:** mecanismo sem entrada reprova, com o seletor nomeado na mensagem.

---

#### T-1029 — `R-TA-10`, sentido inventário → DOM `[nasce neste backlog]`
**Tamanho:** P · **Ref:** `R-TA-10`

O sentido inverso: toda entrada tem mecanismo correspondente **no estado que ela declara**.

Separado da T-1011 de propósito. São perguntas diferentes com modos de falha diferentes — um
sentido só deixa o inventário **apodrecer cheio**, que é como documentos de estado morrem, e é o
sentido que ninguém lembra de escrever.

**Pronto quando:** entrada fantasma reprova, nomeando a entrada e o estado.

---

#### T-1012 — Ver as duas direções reprovarem
**Tamanho:** P · **Ref:** **Portão P2**

Remover uma entrada do inventário — T-1011 fica vermelha. Acrescentar uma entrada fantasma —
T-1029 fica vermelha. **Desfazer as duas.**

São dois modos de falha distintos, e um teste que só cobre um passa por completo sem ser.

**Pronto quando:** os dois modos estão registrados aqui.

---

#### T-1013 — Conter o custo da suíte `[risco]`
**Tamanho:** P · **Ref:** PLANO 016 §5.3

`estados.ts::pronto` e `::erro` disparam geração real, ~30 s cada. Um `anuncio.spec.ts` ingênuo
acrescentaria três a quatro gerações — ~2 min a uma suíte que já leva 20,5 min.

Aplicar o padrão de `estados.ts::situacaoVazia`: **gerar uma vez e reemitir a resposta capturada**
com `route.fulfill`.

**Pronto quando:** o tempo total da suíte está registrado aqui, antes e depois. Crescimento de suíte
é o custo que ninguém mede até doer.

---

## 6. Épico E3 — A T-416 sem número mágico

#### T-1014 — A constante sai
**Tamanho:** PP · **Ref:** `R-TA-11`

Em [`a11y-estrutura.spec.ts:19-23`](../../frontend/e2e/a11y-estrutura.spec.ts#L19-L23), o
`toHaveCount(1)` deixa de existir. A contagem vem do inventário.

**Pronto quando:** não há literal numérico de contagem no teste.

---

#### T-1015 — E a reescrita sai **mais forte**
**Tamanho:** P · **Ref:** ESPEC 016 §12.3 · §1.1 regra 4

A tentação é `toHaveCount(inventario.length)` — que troca uma constante cega por outra: continuaria
passando com as regiões certas **em número** e erradas **em identidade**.

O que a reescrita afirma é **correspondência**: cada região declarada existe, é a declarada, e está
no estado declarado.

**Pronto quando:** o teste falha se uma região viva declarada sumir, **e não falha** quando uma
região legítima nova é acrescentada ao inventário. Os dois lados.

---

#### T-1016 — O destino do `R-LMP-13`
**Tamanho:** PP · **Ref:** ESPEC 016 §12.3

O teste da ESPEC 015 que registrou por que o anúncio da limpeza usa `role="status"` foi escrito para
impedir que alguém "corrigisse" a marcação e derrubasse a T-416. Com a contagem vinda do inventário,
a correção deixa de derrubar.

Absorver ou manter. **Manter é a escolha conservadora**, e a decisão fica registrada com o motivo —
não silenciosamente executada.

**Pronto quando:** a decisão está escrita aqui, com o porquê.

---

## 7. Épico E4 — Regressão `[portão P3]`

#### T-1020 — Conferir a saúde antes da execução longa
**Tamanho:** PP · **Ref:** PLANO 016 §5.5

Repetir a conferência da T-1027 **imediatamente antes** da T-1018: `/health`, `/` e **o conteúdo
servido**.

Na entrega anterior, duas execuções inteiras foram perdidas para ambiente — `.next` corrompido e
backend encerrado com a sessão — e nos dois casos o sintoma foi indistinguível de defeito da
entrega (TASKS 015 §12.2). Custa dez segundos e evita 20 minutos.

**Pronto quando:** os três conferidos, no minuto anterior à execução.

---

#### T-1018 — A suíte inteira, numa única execução
**Tamanho:** P · **Ref:** **Portão P3**

A tabela da [ESPEC 016 §8.2](../specs/016-verificacao-por-tecnologia-assistiva.md): nove suítes mais
as novas, backend **379 intocados**, `tsc`/`lint`/`build` limpos.

**Uma execução, não várias.** A `R-LMP-04` da ESPEC 015 passou isolada e falhou em conjunto:
execução fragmentada não é execução.

**Pronto quando:** verde, com os números ao lado dos do estado inicial.

---

#### T-1019 — A captura, contra a régua
**Tamanho:** P · **Ref:** **Portão P3** · §2.3

`capturar-baseline.mjs depois-016` e comparação contra `referencia-016`.

**Idêntica em todos os estados, nas duas larguras. Zero exceções sancionadas** — diferente da
ESPEC 015, aqui não há botão novo a justificar pixel nenhum. `src/` não foi tocado; se algo mudou, o
escopo declarado foi furado.

**Pronto quando:** 12 de 12 idênticas, ou a entrega para.

---

## 8. Épico E5 — Documentação e continuidade

#### T-1026 — Onde `R-TA-07` passa a viver `[nasce neste backlog]`
**Tamanho:** P · **Ref:** `R-TA-07` · §2.2 desvio 1

`R-TA-07` manda toda espec futura acrescentar a entrada no inventário e o teste correspondente.
**Nenhuma tarefa do PLANO 016 a implementava** — e é a regra que decide se o instrumento sobrevive à
próxima spec ou apodrece.

O ponto não é escrevê-la de novo: é decidir **onde ela é encontrada** por quem escrever a
ESPEC 017. Candidatos: o cabeçalho do próprio `inventario-de-anuncios.ts`, onde quem for acrescentar
uma entrada já está; a mensagem de falha da T-1011, que é onde alguém esbarra ao esquecer; e o
README.

A resposta provavelmente é **os três**, e a mensagem de falha é a que mais funciona — regra que
aparece quando o teste quebra não depende de ninguém tê-la lido antes.

**Pronto quando:** a regra é alcançável sem que alguém precise lembrar da ESPEC 016.

---

#### T-1021 — ESPEC 016
**Tamanho:** P

Status → implementada. E três correções que o planejamento e a escuta obrigaram:

1. `R-TA-02` emendada para distinguir **espécie** — ela não vale para `role="alert"` (PLANO 016 §6.1).
2. §2.2 corrigida: são **duas** regiões de topo e **duas aninhadas**, não cinco irmãs (§6.2).
3. O resultado da T-1002 — o que o `alert` aninhado de fato faz.

**Pronto quando:** nenhuma afirmação da espec contradiz o que foi entregue.

---

#### T-1022 — ESPEC 008: fechar o `P2`
**Tamanho:** PP

Registrar a escuta com o par usado e a transcrição. **É a pendência mais antiga do projeto**, aberta
desde 2026-08-07.

**Pronto quando:** o `P2` deixa de estar em aberto na §14.5 daquela espec.

---

#### T-1023 — ESPEC 015: fechar o `K-10`
**Tamanho:** PP

`K-10` fechado, e o destino do `R-LMP-13` (T-1016) registrado.

**Pronto quando:** o §12.6 item 1 do TASKS 015 deixa de dizer "não verificado".

---

#### T-1024 — CHANGELOG
**Tamanho:** P

O que vale registrar **não é o instrumento** — é o que a primeira escuta revelou. Se ela não revelou
nada, isso também é achado: significa que cinco mecanismos implementados às cegas estavam certos, e
vale saber.

**Pronto quando:** a entrada diz o que se aprendeu ouvindo, não o que se construiu.

---

#### T-1025 — Este backlog
**Tamanho:** P

Resultado, desvios e o que a implementação ensinou.

**Pronto quando:** os desvios têm motivo, e não são lista de ajustes.

---

## 9. Insumos

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **K-13** | **Uma pessoa e cinco minutos** com o Narrador (`Ctrl+Win+Enter`) ou NVDA | T-1000 | **P1 não fecha e o backlog não começa.** Quarta vez que este insumo é pedido |
| **K-14** | Resposta ao `I-17` — JAWS entra? | — | Não bloqueia. `D-01` fixa um par gratuito |
| **K-15** | Decisão sobre `I-18` — a escuta por uma pessoa cega usuária | — | Não bloqueia, e a resposta provavelmente é sim. Quem escreveu a fala é a pior pessoa para julgar se ela basta |

`K-13` é o único bloqueante, custa cinco minutos, não custa licença nem instalação — e é o motivo de
quatro portões estarem abertos em quatro especs.

---

## 10. O que este backlog não faz

- **Não toca `frontend/src/`** — §1.1 regra 1. É o que sustenta o P3.
- **Não toca o backend.** 379 testes, contagem idêntica.
- **Não corrige defeito que a escuta achar.** `I-20` — vira entrega própria. Misturar verificação e
  correção destrói o critério que mantém esta entrega honesta.
- **Não amplia a conformidade.** Nenhuma regra WCAG nova; muda o instrumento, não a régua.
- **Não simula leitor de tela.** `D-04` — asserir a árvore de acessibilidade mede o que o navegador
  expõe, não o que o leitor fala.
- **Não resolve a família "abrir no Excel"** — `P2` da ESPEC 009 e da 013, `I-19`.
- **Não planeja a bifurcação da T-1002** — §2.2 desvio 4, decisão deliberada.
- **Não introduz dependência.**

---

## 11. O que a implementação ensinou

*A preencher na T-1025.*