# PLANO 027 — Implementação de "A planilha que o Confere não leu"

| | |
|---|---|
| **Especificação** | [ESPEC 027](../specs/027-a-planilha-que-o-confere-nao-leu.md) v1.0 |
| **Versão** | 1.0 — 2026-08-19 — **proposto** |
| **Estado inicial** | **1.316 testes de backend**, verdes, em 12 min 46 s (depois da ESPEC 026) · aba lida com zero itens produz **60** achados no piloto e **49** no PGM · **2 de 13** validações usam o cartão de quatro partes · `Entradas` carrega `nome_do_contrato` e não o do levantamento · `Measurement` não tem diagnóstico |
| **Instrumentos existentes** | `registrar_em_partes` e o cartão de quatro partes (ESPEC 025, testados) · o padrão de guarda em [`container.py:192`](../../backend/src/infrastructure/di/container.py) · `DiagnosticoDaGrade` como molde (ESPEC 017) · `scripts/gerar_fixtures_desconto.py` como precedente de fixture sintética de levantamento · as âncoras `sha256` da ESPEC 026 |
| **Numeração dos portões** | **Igual à da espec** — `P0` a `P4` |
| **Numeração das tarefas** | `T-2026` em diante; a última usada é `T-2025` (TASKS 026). Os identificadores `T-2026`–`T-2033` são os que a ESPEC §9 já nomeou e ficam onde ela os pôs |

---

## 1. O princípio que ordena este plano

O mecanismo desta entrega já existe. A ESPEC 025 construiu o achado de quatro partes, o cartão
que o empilha e o padrão de guarda no orquestrador; a ESPEC 017 construiu o diagnóstico que sai
do que a leitura já olhou. **Nada aqui é invenção — é aplicação.**

O que sobra de difícil é uma coisa só: a guarda que faz sessenta cartões virarem um pode
esconder um achado legítimo, e esse é o pior resultado possível desta espec.

> **A guarda vale mais que os textos, e sai primeiro.**
> Três linhas levam a tela de 60 para 1 sem escrever uma palavra nova. Os textos melhoram o
> cartão que sobra; a guarda faz os outros 59 sumirem. Se a entrega parar depois da F1, ela já
> terá entregado a maior parte do valor — o usuário passa de sessenta mensagens confusas para
> uma mensagem confusa, o que é a troca que a ESPEC 025 fez na F2 dela.

> **Os negativos da guarda saem na mesma fase que ela, nunca depois.**
> `T-2032` e `T-2033` provam que `V-CTR-05` continua acusando quando a medição **foi** lida.
> Publicar a guarda sem eles seria publicar o risco: uma supressão exagerada não deixa rastro,
> não quebra teste nenhum, e só aparece no dia em que alguém não vir um aviso que deveria ter
> visto. `D-03` da espec existe por isso, e a F1 não fecha sem os dois.

> **Uma âncora vai mudar de valor, e ela está nomeada.**
> `test_reader_measurement.py:142` afirma `len(achados.avisos) == 2`, e a `R-LEV-07` a torna
> `1`. É a **única** asserção do repositório que esta entrega obriga a mexer. Qualquer outra que
> peça alteração é sinal de que algo saiu do escopo — em especial as âncoras `sha256` da ESPEC
> 026, que uma espec de mensagem não pode mover.

> **O degrau 2 é dedução, não observação.**
> A ESPEC §2.3 conclui, do código, que um código de serviço na coluna F ou adiante rende zero
> itens, e verifica isso numa planilha sintética. **Não foi visto o arquivo real que motivou a
> espec** (`I-39`). Se ele aparecer, a `T-2036` o passa pelo diagnóstico antes da F3 escrever
> os textos: se cair no degrau 3, a ordem de prioridade das três frases muda.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — A âncora reproduz a tela** | Fim da F0 | Um teste de backend submete a planilha de códigos deslocados e encontra **60** achados: 1 `V-MED-01`, 2 `V-MED-02`, 57 `V-CTR-05`. Rodado contra o código intocado, ele **passa** | Não começar a F1. Sem ele, *"sessenta viram um"* é afirmação sem testemunha |
| **P1 — Sessenta viram um** | Fim da F1 | A âncora do `P0`, reancorada, encontra **um** achado e `avisos == []`. E os negativos: com a medição lida, `V-CTR-05` continua registrando | Reverter a F1. Supressão errada esconde achado legítimo, que é pior que repeti-lo |
| **P2 — O degrau nomeia a coluna** | Fim da F2 | A causa da `V-MED-01` sobre `DiagnosticoDaAba` construído à mão, nos três degraus; no degrau 2 ela contém `"coluna H"` | Se a causa exigir abrir planilha, ela está no lugar errado (`R-LEV-05`) |
| **P3 — O caminho feliz não se moveu** | Fim da F5 | Os dois pares reais sem nenhum `V-MED-*` e sem `V-CTR-05`; as âncoras `sha256` da ESPEC 026 **inalteradas**; suíte inteira verde; `mypy --strict`, `ruff`, `bandit` | Não entregar |
| **P4 — A pessoa** | Depois | Alguém do faturamento, sem explicação prévia, lê o cartão e diz o que fazer com a planilha | Não é falha de código: é redação da ESPEC §8. Corrigir e repetir |

**O portão mais fácil de pular é o `P1` pela metade** — declarar vitória quando os 60 viram 1 e
deixar os negativos para depois. É exatamente aí que a supressão exagerada entra sem ser vista.

---

## 3. Fases

### F0 — A âncora do defeito `[portão P0]`

**Objetivo:** poder afirmar, ao final, o que mudou. **Nenhum arquivo de `src/` é tocado.**

| # | Tarefa | Ref. |
|---|---|---|
| T-2034 | `scripts/gerar_fixture_deslocada.py` → `levantamento_codigos_deslocados.xlsx`: aba `Levantamento` com cabeçalho plausível e os códigos na **coluna H**. No padrão de `gerar_fixtures_desconto.py`, que é como as outras duas planilhas sintéticas nasceram | ESPEC §2.3 |
| T-2035 | **[portão]** `test_planilha_nao_lida.py`: `gerar()` com o contrato do piloto e a planilha deslocada. Asserção sobre a **contagem por validação** — `{"V-MED-01": 1, "V-MED-02": 2, "V-CTR-05": 57}` | **P0**, ESPEC §2.1 |
| T-2036 | Se o arquivo real que motivou a espec estiver disponível, passá-lo pelo diagnóstico e registrar em qual degrau cai (`I-39`). **Não bloqueia**: sem ele, vale a dedução da §2.3 | ESPEC `I-39` |

**Verificação:** `P0` — a `T-2035` passa **hoje**, encontrando os 60.

> **A fixture precisa da aba `Levantamento` com nome exato, e com conteúdo.** Uma planilha sem a
> aba cai em `ExtractionError` (422) antes de qualquer validação — outro caminho, já bom, e
> registrado na ESPEC §2.4 como fora do escopo. A fixture que testa a `V-MED-01` tem de
> **chegar** à `V-MED-01`.

> **A asserção é sobre o dicionário de contagens, não sobre o primeiro achado.** Com
> `achados[0].validacao == "V-MED-01"`, a F1 ficaria verde tendo suprimido a validação errada, e
> o `P1` não valeria nada. É a regra 2 do TASKS 025, pelo mesmo motivo.

> **Usar o contrato em cache.** `_ContainerComFontesEmCache` do `conftest` evita os 7 s de
> extração do PDF; o leitor de anexos que ele também substitui é indiferente aqui, porque com
> bloqueio os anexos não são lidos.

**Tamanho:** P — duas horas. **Encerra:** `P0`.

---

### F1 — A guarda `[portão P1]` `[publicável sozinha]`

**Objetivo:** 60 → 1. **Nenhum texto novo é escrito nesta fase.**

| # | Tarefa | Ref. |
|---|---|---|
| T-2037 | A guarda em `container.gerar`: `v_med_02`, `v_med_03` e `v_ctr_05` sob `if medicao.itens:`. Comentário citando `R-LEV-01` e o número da ESPEC §2.1 | `R-LEV-01`, `R-LEV-02` |
| T-2026 | **[portão]** A âncora da `T-2035` reancorada: **um** achado, `V-MED-01`, e `achados.avisos == []` | **P1**, `R-LEV-01` |
| T-2032 | **[portão]** O negativo: medição **lida**, um código removido — `V-CTR-05` continua registrando, com o `codigo` preenchido. A `test_v_ctr_05_dispara_quando_o_contratado_nao_foi_medido` já é esse teste; basta confirmá-la verde e apontar para ela | **P1**, `R-LEV-03`, `D-03` |
| T-2033 | **[portão]** O segundo negativo: contrato bloqueado por checksum **com a medição lida** — `V-CTR-05` continua registrando. Este **não** existe hoje | **P1**, `R-LEV-03` |
| T-2030 | Os dois pares reais continuam sem nenhum `V-MED-*` e sem `V-CTR-05` | `R-LEV-10` |

**Verificação:** `P1`. Contagem de backend reconciliada.

> **A `T-2033` é a tarefa que impede o exagero.** O passo seguinte natural à `R-LEV-01` é
> *"esconder todo aviso quando há bloqueio"* — e aí um contrato bloqueado por checksum apagaria
> a observação, verdadeira e útil, de que a aba não traz um código contratado. A guarda é por
> **peça**: a condição é `medicao.itens`, nunca `achados.bloqueado`.
>
> É a mesma armadilha da `D-03` da ESPEC 025, e ela caiu nela uma vez antes de a regra existir.

> **`v_med_03` entra sob a guarda mesmo sendo inócua.** Com zero itens o laço dela não executa.
> Entra porque a intenção fica legível para quem ler depois — e porque deixá-la de fora obrigaria
> a explicar por que só ela ficou.

**Tamanho:** P — três horas. **Encerra:** `P1`. **Publicável sozinha.**

---

### F2 — O diagnóstico e a causa `[portão P2]`

**Objetivo:** o sistema passa a saber **onde estão os códigos**. Nada muda na tela ainda.

| # | Tarefa | Ref. |
|---|---|---|
| T-2038 | `DiagnosticoDaAba` em `domain/entities/measurement.py`: linhas preenchidas, colunas lidas, códigos por coluna. `frozen`, no molde do `DiagnosticoDaGrade` | `R-LEV-05` |
| T-2039 | O leitor o preenche **quando nenhum item sai** — releitura da linha inteira sobre o livro já aberto. No caminho feliz, nada acontece | `R-LEV-06` |
| T-2040 | A causa como **função pura** do diagnóstico: três degraus, sem abrir planilha | `R-LEV-05`, `D-02` |
| T-2027 | **[portão]** Os três degraus sobre `DiagnosticoDaAba` construído à mão — inclusive o 1, que não tem fixture | **P2**, `R-LEV-05` |
| T-2028 | **[portão]** O degrau 2 nomeia a coluna: a causa contém `"coluna H"` para a fixture da `T-2034` | **P2**, `R-LEV-04` |

**Verificação:** `P2`.

> **A releitura vive no leitor, não na validação.** Fazê-la na validação exigiria reabrir o
> arquivo — 0,1 s em modo somente-leitura, e portanto barato —, mas poria **I/O dentro de uma
> validação**, que hoje é função pura sobre agregados. É a fronteira que a `test_architecture`
> guarda, e o custo de furá-la não é o décimo de segundo.

> **A causa é função pura porque o degrau 1 não tem fixture.** Uma aba absolutamente vazia é
> possível de construir, mas provar os três degraus por arquivo custaria três planilhas para
> testar três `if`. É a `D-04` da ESPEC 025, e é o que fez a causa da `V-DOC-01` ser testável nos
> quatro degraus com zero PDFs.

> **Empate de colunas.** Se houver códigos em mais de uma coluna fora de A–E, a causa nomeia a de
> **maior contagem** e o detalhe traz o mapa inteiro. A `T-2027` cobre esse caso, porque é onde
> uma implementação ingênua escolhe a primeira e acerta por sorte na fixture.

**Tamanho:** M — meio dia. **Encerra:** `P2`.

---

### F3 — Os textos

**Objetivo:** o cartão que sobrou passa a dizer o que houve, como se sabe e o que fazer.

| # | Tarefa | Ref. |
|---|---|---|
| T-2041 | `nome_do_levantamento` em `Entradas` e no router. **Só para exibição** — o caminho em disco continua posicional (`R-ADT-10`) | `R-LEV-09` |
| T-2042 | `V-MED-01` por `registrar_em_partes`, com título, causa por degrau, ação por degrau e detalhe. Textos da ESPEC §8.1, **literais** | `R-LEV-04` |
| T-2043 | `V-MED-02` em **um** achado, com o texto ajustado a qual campo faltou | `R-LEV-07`, `D-06` |
| T-2029 | Os três casos da `V-MED-02` — só a data, só o contrato, os dois | `R-LEV-07` |
| T-2044 | **[canário]** `test_v_med_02_apenas_avisa`: `len(achados.avisos)` passa de `2` para `1`. Alterada **de propósito**, com o porquê no docstring | ESPEC §9.3 |

**Verificação:** suíte de backend inteira. **Nenhuma âncora além da `T-2044` pode mexer.**

> **Os textos entram literais, e os testes os citam literais.** Nascem da própria espec — não há
> planilha nem PDF de onde transcrevê-los —, e um teste que asserte contra a constante que a
> implementação define provaria só que o código concorda com ele mesmo. É a regra 3 do TASKS 025.

> **A ação muda por degrau, e não só a causa.** É o que separa esta espec de uma reescrita de
> frase: no degrau 2 o conserto é *reposicionar a coluna*; no 3 é *confirmar que o arquivo é o
> certo*. Uma ação única para os três degraus mandaria metade das pessoas para o lugar errado —
> foi o que a `V-DOC-01` fez no degrau 1 da ESPEC 025, e por isso ela também tem ação por degrau.

**Tamanho:** M — meio dia.

---

### F4 — A tela

**Objetivo:** `V-CTR-05` deixa de ser *n* cartões, mesmo quando dispara com razão.

| # | Tarefa | Ref. |
|---|---|---|
| T-2045 | `ListaDeAchados` agrupa por `validacao` quando há mais de um achado da mesma, e renderiza a lista de códigos dentro de um cartão. Texto da ESPEC §8.3 | `R-LEV-08`, `D-05` |
| T-2046 | `e2e`: com um estado de vários `V-CTR-05`, a tela mostra **um** cartão com os *n* códigos. Estado sintético em `estados.ts`, como os demais | `D-05` |
| T-2047 | Inventário: conferir que o agrupamento não altera o grid, que consome `codigo` do achado por outro caminho | `R-LEV-08` |

**Verificação:** suíte de navegador; `axe` sem violação nova.

> **A agregação é da tela, e o modelo não muda.** Manter os *n* achados preserva o `codigo` que o
> grid consome e as duas asserções de `test_reconciliation.py`. Agregar no backend obrigaria a
> escolher entre a lista e o código, e a tela é onde o problema de fato está — sessenta cartões é
> fato de apresentação.

> **Singular e plural.** Um código só não mostra lista: o título vira *"O código {codigo} do
> contrato não aparece no levantamento."* É o mesmo cuidado que o cabeçalho da tela já tem em
> `ResultadoPanel.tsx:177`, e não tê-lo aqui produziria *"1 códigos"*.

**Tamanho:** P — três horas.

---

### F5 — Fechar `[portões P3 e P4]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2031 | **[portão]** As âncoras `sha256` da ESPEC 026 — `.docx` e `.xlsx`, nos dois pares — **inalteradas** | **P3**, `R-LEV-10` |
| T-2048 | **[portão]** Suíte de backend com contagem reconciliada; `mypy --strict`, `ruff`, `bandit`; suíte de navegador | **P3** |
| T-2049 | **[portão]** `P4` — alguém do faturamento diante do cartão | **P4** |
| T-2050 | Emendas: o que a implementação contrariou, no padrão da ESPEC 007 §13. CHANGELOG | — |

**Tamanho:** P — três horas, mais a janela da pessoa.

---

## 4. Sequência

```
F0 ──▶ F1 ──▶ (publicável) ──▶ F2 ──▶ F3 ──▶ F4 ──▶ F5
       │
       └── 60 → 1, sem escrever um texto novo
```

Ao contrário do PLANO 026, aqui as fases **não comutam**: a F3 escreve a causa que a F2 apura, e
a F4 arruma a tela que a F1 esvaziou.

**Se a entrega precisar parar, o corte bom é depois da F1** — e é um corte muito bom. Ele sozinho
resolve 59 dos 60 cartões. O segundo melhor é depois da F3, com a tela de `V-CTR-05` ficando para
outro dia.

---

## 5. A regressão que já está escrita

### 5.1 O que não é afetado

A leitura da aba (`R-MED-*`), a reconciliação, o `.docx`, o `.xlsx`, a extração do contrato, a
consolidação de aditivos. Nenhum arquivo de `application/` é tocado, e em `domain/` só entra um
dataclass novo — `test_architecture.py` continua valendo sem alteração.

### 5.2 As âncoras que **não podem** se mexer

| Âncora | Por que ela vale aqui |
|---|---|
| `test_identidade_dos_artefatos.py` (ESPEC 026) | `sha256` por entrada do `.docx` e do `.xlsx`, nos dois pares. Uma espec de mensagem que mova um byte do documento **errou** |
| `test_capa.py::test_t1408` | `sha256` do corpo de texto inteiro |
| `test_anchor_por_codigo.py`, `test_anchor_analise.py` | As âncoras de conteúdo |
| `test_api_e2e.py` | A resposta de `POST /reports` no caminho feliz |
| `test_planilha_sem_a_aba_levantamento_falha` | O caminho da aba ausente, que a ESPEC §2.4 deixa fora |

### 5.3 A âncora que muda de valor, e é o canário

`test_reader_measurement.py:142` — `assert len(achados.avisos) == 2` → `1`, pela `R-LEV-07`.

**É a única.** Está aqui para que a mudança seja um ato, e não uma correção apressada para fazer
passar. Se outra pedir alteração, parar e entender por quê.

### 5.4 Os testes de unidade das validações continuam valendo

`test_v_med_01_bloqueia_medicao_vazia`, `test_v_med_01_aceita_medicao_com_itens`,
`test_v_ctr_05_nao_dispara_no_piloto` e `test_v_ctr_05_dispara_quando_o_contratado_nao_foi_medido`
chamam as validações **direto**, sem o container. A guarda vive no orquestrador (`R-LEV-02`)
justamente para que continuem verdes — e o instinto de "arrumá-las" ao ver a F1 mudar o
comportamento apagaria a cobertura de unidade das validações que continuam existindo.

É a §5.2 do PLANO 025, no mesmo lugar e pelo mesmo motivo.

---

## 6. O que pode dar errado, e o que pega

| Risco | Sintoma | O que pega |
|---|---|---|
| Guarda por gravidade em vez de por peça | avisos legítimos somem do caminho feliz, sem nada indicar | `T-2032` e `T-2033` |
| Âncora do `P0` por índice em vez de contagem | a F1 fica verde tendo suprimido a validação errada | `T-2035` compara o dicionário inteiro |
| Degrau 2 escolher a coluna errada no empate | causa aponta coluna com um código enquanto 74 estão noutra | `T-2027` |
| Causa exigindo abrir planilha | I/O dentro de validação; degrau 1 sem como testar | `T-2027` constrói o diagnóstico à mão |
| Fixture sem a aba `Levantamento` | cai em `ExtractionError` e a âncora testa outro caminho | `T-2035` afirma `V-MED-01` presente |
| `V-MED-02` perdendo informação ao virar um | o usuário deixa de saber **qual** campo faltou | `T-2029`, nos três casos |
| Agregação da `V-CTR-05` quebrando o grid | o grid perde as marcas por código | `T-2047` |
| *"1 códigos"* no singular | ninguém percebe até um usuário ver | `T-2045` trata o singular |
| Alguém "consertar" o leitor para ler qualquer coluna | os dois pares reais mudam de leitura | `D-04` da espec; as âncoras da ESPEC 026 acusariam |

---

## 7. Insumos

Quase tudo já no repositório.

* `levantamento.xlsx`, `levantamento_pgm.xlsx`, `contrato.pdf`, `contrato_pgm.pdf` — os pares
  reais, para o caminho feliz.
* `scripts/gerar_fixtures_desconto.py` — o precedente que a `T-2034` copia.
* `_ContainerComFontesEmCache` (`conftest.py`) — evita 7 s de PDF na âncora.
* `registrar_em_partes`, o cartão de quatro partes, o `▸ detalhes` — ESPEC 025, prontos.
* `DiagnosticoDaGrade` — o molde do `DiagnosticoDaAba`.

**Uma fixture nova, sintética:** `levantamento_codigos_deslocados.xlsx`, gerada por script
versionado. Nenhum arquivo real novo.

**Um insumo de fora, e não bloqueante:** o arquivo que motivou a espec (`I-39`). Sem ele, o
degrau 2 continua sendo dedução fundamentada no código e verificada em planilha sintética — o
que basta para implementar, mas não para afirmar que é o caso mais comum.

---

## 8. O que este plano não faz

* **Ler o código em qualquer coluna** (`I-36`) — seria corrigir em silêncio o que a `R-LEV-04`
  manda relatar, e mudaria a leitura dos dois pares que funcionam.
* **Aviso no formulário** quando o arquivo do campo Levantamento parece uma proposta (`I-37`) —
  o simétrico da `R-DOC-08`, e outra entrega.
* **Converter as outras oito validações** ao cartão de quatro partes (`I-38`) — nenhuma delas
  apareceu em tela real com problema de redação.
* **O caminho da aba ausente** — já nomeia causa e conserto (ESPEC §2.4).
* **Mudar severidade de qualquer validação** — `V-MED-01` bloqueia, as outras avisam, e as três
  decisões estão certas.
* **Qualquer mudança no documento.** Se o `.docx` ou o `.xlsx` mudarem um byte, o plano falhou.
