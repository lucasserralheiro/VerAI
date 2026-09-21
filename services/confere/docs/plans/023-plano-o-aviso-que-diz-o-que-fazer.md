# PLANO 023 — Implementação de "O aviso que diz o que fazer"

| | |
|---|---|
| **Especificação** | [ESPEC 023](../specs/023-o-aviso-que-diz-o-que-fazer.md) v1.0 |
| **Versão** | 1.0 — 2026-08-18 — **executado**. Quatro desvios registrados no §11 do TASKS 023 |
| **Estado inicial** | **547 testes de backend** (21 min de suíte cheia) e a de navegador em 11 arquivos · o par PGM sem aditivo produz **5** `V-REC-01`; **o par piloto produz zero** · **seis** âncoras de teste leem `V-REC-01` de `achados.avisos` (§5) |
| **Instrumentos existentes** | A âncora diferencial de invariância dos artefatos (`test_quantitativo_consolidado.py`, T-1601/T-1602) cobre `R-FON-13` sem uma linha nova. O oráculo dos cinco valores também já existe, em `CONTRATADO_CONSOLIDADO` |
| **Numeração dos portões** | Este plano usa `P0`–`P6`. A ESPEC 023 §8.3 tem os seus três: o `P1` **da espec** (a pessoa acha o aditivo) é o `P5` daqui; o `P2` da espec (os estados se distinguem) é o `P5` também; o `P3` da espec (entregável intacto) é o `P4` daqui |
| **Numeração das tarefas** | `T-1700` em diante. A última usada no repositório é `T-1630` |

---

## 1. O princípio que ordena este plano

Esta entrega é maior que a ESPEC 022 e falha por motivos diferentes. Lá, o risco era mexer no
entregável sem perceber. Aqui, é **apagar canário**.

> **O par piloto não exercita nada disto, e é com ele que a suíte de navegador roda.**
> `estados.ts::pronto` monta a tela com `contrato.pdf` + `levantamento.xlsx`, e esse par produz
> **zero** `V-REC-01`. Um teste escrito ali afirmando *"a sigla não aparece"* fica verde no
> primeiro dia, contra o código intocado, e não prova nada — é exatamente o defeito que a `T-1506`
> do PLANO 021 evitou por um triz porque o piloto **tinha** `V-REC-02`. Aqui não tem, e o plano
> tem de resolver isso na F0, antes de qualquer instrumento.

> **O substituto vem antes da remoção. Nunca há um commit em que a informação não esteja em lugar
> nenhum.**
> `R-FON-09` manda `V-REC-01` sair de `avisos`. A F2 e a F3 **não removem nada**: o payload novo
> nasce ao lado da frase, e a F3 termina com os dois na tela ao mesmo tempo — feio de propósito.
> É a única janela em que tabela e frases podem ser confrontadas, e é o portão `P2`.

> **Seis âncoras leem `V-REC-01` de `achados.avisos`, e uma delas é a prova da ESPEC 022.**
> A `T-1605` — o teste da aba adulterada — afirma que a cegueira fechou. Reancorada no automático,
> ela vira `avisos == []`, fica verde e **passa a provar o contrário do que foi escrita para
> provar**. §5.2 nomeia as seis, uma a uma, com o destino de cada.

> **Dois estados, ou a espec não foi entregue.**
> Se a implementação colapsar `MAIOR_RELEVANCIA` e `CRITICO` numa tarja só, o resultado é uma
> tabela mais bonita e nenhuma informação nova. `R-FON-02` é o conteúdo; o resto é apresentação.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — O estado existe e mostra o defeito** | Fim da F0 | Há um estado de tela, montável em Playwright, que exibe as cinco frases `V-REC-01`. Rodado contra o código intocado, ele as encontra | Não começar a F1. Sem esse estado, todo instrumento de tela deste plano é vacuamente verde |
| **P1 — Os instrumentos existem, e o que tem de reprovar reprova** | Fim da F1 | O teste da sigla **reprova**, acusando as cinco ocorrências. A âncora dos artefatos passa desde já | O instrumento está errado. Um teste de tela verde hoje não está procurando o que se pensa |
| **P2 — A tabela diz tudo o que as frases diziam, e mais** | Fim da F3 | Com o bloco âmbar **ainda na tela**, tabela e frases são confrontadas: nenhuma linha só nas frases. E a tabela mostra diferença e percentual, que as frases não têm | Não remover nada na F4. Enquanto a tabela não contiver tudo, a frase é a única fonte |
| **P3 — A frase some, e as seis âncoras foram reancoradas** | Fim da F4 | `V-REC-01` não sai mais em `avisos`; o teste da sigla fica verde; as **seis** de §5.2 estão reancoradas, **não apagadas** — em especial a `T-1605` | Reverter a F4. A F3 é publicável sozinha |
| **P4 — O entregável não se mexeu** | Fim da F4 | `T-1601` e `T-1602` verdes. Nenhuma alteração em `infrastructure/report/` | O escopo vazou para o documento, que `R-FON-13` põe fora |
| **P5 — As duas pessoas** | Fim da F5 | Alguém do faturamento, sem explicação prévia, vê o estado A e conclui que precisa anexar o aditivo; e vê o estado B e entende que ali é diferente e mais grave (espec `P1` e `P2`) | Não é falha de código: é redação de `R-FON-08` ou hierarquia visual. Corrigir e repetir |
| **P6 — O conjunto** | Fim da F5 | Backend verde com contagem reconciliada; navegador sem falha nova; `axe` A/AA em 1366 e 390; `ruff`, `mypy`, `tsc --noEmit`, `next lint`, `next build` limpos | Não entregar |

**O portão mais fácil de pular é o P2**, pelo mesmo motivo do PLANO 021: exige conviver com uma
tela feia por uma fase inteira. É também o único momento em que a informação nova e a antiga estão
visíveis juntas e podem ser confrontadas.

---

## 3. Fases

### F0 — O estado de tela que hoje não existe `[portão P0]`

**Objetivo:** poder ver `V-REC-01` numa tela de teste. **Nenhum arquivo de `src/` é tocado.**

| # | Tarefa | Ref. |
|---|---|---|
| T-1700 | **Decidir como montar o estado.** Duas saídas, e a escolha é do plano: (a) gerar o par do PGM pelo navegador; (b) dublê de resposta 200, como `estados.bloqueado` já faz com o 422. **Recomendada: (b)** — o par do PGM leva ~140 s por HTTP (`test_api_e2e`), acima do teto de 120 s por teste do Playwright | ESPEC §8.2 |
| T-1701 | `estados.ts` ganha `divergenciaDeFonte(page)`: dublê de 200 no formato de `RespostaRelatorio`, com os **cinco avisos reais** do PGM. Os valores saem de `CONTRATADO_CONSOLIDADO`, que já existe no backend — transcritos, não gerados | `R-FON-01` |
| T-1702 | Um segundo estado, `divergenciaComAditivo(page)`, com **uma** divergência remanescente — o `14.048.00027.00` a `1.400,00`. É o estado B, e nenhuma fixture do repositório o produz | `R-FON-02` |
| T-1703 | **[portão]** Provar que `divergenciaDeFonte` exibe as cinco frases hoje, contra o código intocado | **P0** |
| T-1704 | Registrar em `estados.ts` que os dublês espelham o backend e precisam acompanhar o schema — mesma nota que o dublê de 422 já carrega | — |

**Verificação:** P0.

> **A T-1700 é a tarefa que salva o plano.** O instinto é escrever o teste da sigla contra
> `estados.pronto`, que é o que a `derivadas.spec.ts` faz. Com o piloto, `V-REC-01` **nunca**
> aparece — nem antes nem depois —, e o teste nasce verde e permanece verde qualquer que seja a
> implementação. Descobrir isso na F4 significa ter entregue sem instrumento.

> **O dublê é legítimo aqui e não seria no backend.** O que a F1 mede é comportamento **de tela**
> diante de uma resposta; a correção da resposta é medida no backend, com os pares reais, onde já
> está. Misturar os dois faria a suíte de navegador pagar 140 s para reconferir o que o `pytest` já
> conferiu.

**Tamanho:** P — duas horas. **Encerra:** P0.

---

### F1 — Os instrumentos, e o da sigla reprova `[portão P1]`

**Objetivo:** poder afirmar, ao final, o que mudou e o que não mudou. **Nenhum arquivo de `src/`
nem de `frontend/src/` é tocado.**

| # | Tarefa | Ref. |
|---|---|---|
| T-1705 | **[portão]** `e2e/divergencia.spec.ts`: a cadeia `V-REC-01` não ocorre na tela, sobre `divergenciaDeFonte`. **Reprova hoje**, com as cinco ocorrências nomeadas na falha. Asserção sobre o texto da página inteira, não sobre o seletor do bloco — a sigla tem de sumir, não de mudar de lugar | **P1**, `R-FON-09` |
| T-1706 | Backend: as cinco divergências do PGM sem aditivo, com os valores de ESPEC §2.2 e a diferença de §2.2. Vermelhas por campo inexistente — TDD comum | `R-FON-01`, `R-FON-05` |
| T-1707 | A ordem de `R-FON-06`: `14.048`, `14.031`, `12.030`, `14.024`, `10.050`. **Não** a ordem do contrato, e não a alfabética — é a asserção que falha se alguém "arrumar" a ordenação | `R-FON-06` |
| T-1708 | A severidade dos dois estados: sem aditivo, todas `MAIOR_RELEVANCIA`; com aditivo e aba adulterada, a única em `CRITICO`. **É o conteúdo da espec**, e o teste que a defende | `R-FON-02` |
| T-1709 | A decomposição de `R-FON-04`: com aditivo, a linha traz proposta `200,00` **e** delta `1.100,00` — os dois campos, não a soma | `R-FON-04` |
| T-1710 | Âncora dos artefatos: confirmar que `T-1601`/`T-1602` cobrem `R-FON-13` **sem alteração**. Se cobrirem, nada a escrever — é a única tarefa deste plano que pode fechar com zero linha | **P4**, `R-FON-13` |

**Verificação:** P1. `T-1705` reprova; `T-1710` passa; as demais ficam vermelhas até a F2.

> **A `T-1708` é a que separa esta entrega de uma reformatação.** Se ela for adiada para "depois
> que a tabela existir", a tabela vai nascer com uma tarja só e os dois estados viram trabalho
> futuro que não acontece. Ela é escrita **antes** de existir campo para ela.

> **A `T-1710` pode custar zero, e é bom que custe.** A âncora diferencial da ESPEC 022 afirma que
> a quantidade do contrato não alcança os artefatos; esta espec não mexe em quantidade nenhuma.
> Confirmar que a cobertura já existe vale mais que escrever uma segunda âncora com o mesmo
> propósito.

**Tamanho:** P — três horas. **Encerra:** P1.

---

### F2 — `divergencias_de_fonte` existe, e `V-REC-01` continua `[publicável sozinha]`

**Objetivo:** o dado estruturado chega à resposta da API. **Nada é removido.**

| # | Tarefa | Ref. |
|---|---|---|
| T-1711 | **Decidir o `I-29`**: a `V-REC-01` devolve as divergências, ou a acumulação passa ao caso de uso? **Recomendada: a validação devolve.** O precedente da `R-PER-08` moveu a `V-REC-02` para o caso de uso porque a derivação já acontecia lá; aqui a comparação é a própria validação, e movê-la a dissolveria como unidade nomeada com teste próprio | `I-29` |
| T-1712 | `DivergenciaDeFonte` no domínio (frozen): código, descrição, unidade, contrato, delta do aditivo (opcional), planilha, diferença, variação e `tem_aditivo_aplicado` | `R-FON-01` a `05` |
| T-1713 | O delta por código sai de `Contract` — `codigos_de(AUMENTO)` e `codigos_de(REDUCAO)` cruzados com os blocos das peças. **É o dado que a `T-1617` da ESPEC 022 preservou**, e é o que permite `R-FON-04` | `R-FON-04` |
| T-1714 | `ReportResult` ganha o campo **por último e com padrão** — o caminho bloqueado retorna antes do laço. Mesma regra da `derivadas` | — |
| T-1715 | Schema Pydantic e conversão no router, com as quantidades **formatadas no backend**, como `LinhaDoGrid` | `R-FON-01` |
| T-1716 | `types.ts` — o tipo espelho e o campo em `RespostaRelatorio` | — |
| T-1717 | **[portão]** `T-1706` a `T-1709` verdes; `T-1705` **continua reprovando** — a frase ainda está lá, e é assim que tem de ser | — |

**Verificação:** as quatro do backend verdes, a de tela ainda vermelha.

> **Esta fase é publicável e invisível.** A API ganha um campo que ninguém lê; a tela é idêntica.
> Se algo quebrar aqui, quebrou na montagem do payload, e não há segunda hipótese.

**Tamanho:** P — três horas.

---

### F3 — A tabela na tela, com as frases ainda lá `[portão P2]`

**Objetivo:** a informação nova visível, **sem remover a antiga**.

| # | Tarefa | Ref. |
|---|---|---|
| T-1718 | `DivergenciaDeFonte.tsx`, nos moldes de `LinhasDerivadas.tsx` — que já resolve contêiner rolável focável, `scope` e a frase acima da tabela | `R-FON-01`, `R-FON-14` |
| T-1719 | Os dois estados, com o eixo de severidade da ESPEC 009 (`maior` e `critico`). **Nenhuma cor nova** — o projeto já tem o eixo, com contraste verificado | `R-FON-02`, `D-02` |
| T-1720 | Rótulo variável da coluna: *"Na proposta"* / *"Contratado vigente"*, e a decomposição embaixo da descrição quando houver delta | `R-FON-03`, `R-FON-04` |
| T-1721 | A ação de anexar aditivo, devolvendo o foco ao campo — mesmo mecanismo de `R-ACE-15`, sem reenviar | `R-FON-07`, `D-05` |
| T-1722 | O rodapé do estado B declarando que os demais fecharam | `R-FON-12`, `D-07` |
| T-1723 | A seção entra em `ResultadoPanel` **acima** do bloco âmbar, que continua ali | `D-08` |
| T-1724 | **[portão]** Confronto: nos dois estados, toda linha das frases está na tabela, e a tabela traz diferença e percentual que as frases não têm | **P2** |

**Verificação:** P2. Publicável — o produto fica melhor mesmo com a duplicação.

> **A tela fica feia nesta fase, e é o preço do P2.** Depois da F4 o confronto exige `git stash`,
> e ninguém o faz.

**Tamanho:** P — quatro horas.

---

### F4 — A frase some `[portões P3 e P4]`

| # | Tarefa | Ref. |
|---|---|---|
| T-1725 | `V-REC-01` deixa de ser registrada como achado | `R-FON-09` |
| T-1726 | **[portão]** `T-1705` verde: a sigla sumiu da tela | **P3** |
| T-1727 | O contador da faixa de resultado passa a contar o que é exibido | `R-FON-10` |
| T-1728 | **Reancorar as seis de §5.2**, uma a uma, com atenção especial à `T-1605` — ver o aviso em §5.3 | **P3** |
| T-1729 | `ListaDeAchados` **não muda**. Ela deixa de receber `V-REC-01` porque ele não vem mais, não porque filtra | `D-06` |
| T-1730 | **[portão]** `T-1601`/`T-1602` verdes; `git diff` sem nada em `infrastructure/report/` | **P4** |

**Verificação:** P3, P4.

**Tamanho:** P — três horas.

---

### F5 — As pessoas e o conjunto `[portões P5 e P6]`

| # | Tarefa | Ref. |
|---|---|---|
| T-1731 | **[portão]** Uma pessoa do faturamento vê o estado A sem explicação prévia e conclui que precisa anexar o aditivo | **P5** |
| T-1732 | **[portão]** A mesma pessoa vê o estado B e entende que é diferente e mais grave | **P5** |
| T-1733 | Varredura `axe` A/AA em 1366 e 390 sobre os dois estados novos. Verificar se entram de graça no `a11y-axe.spec.ts` parametrizado, como a tabela da ESPEC 021 entrou | `R-FON-14`, **P6** |
| T-1734 | Suíte de backend com contagem reconciliada; suíte de navegador; `ruff`, `mypy`, `tsc --noEmit`, `next lint`, `next build` | **P6** |
| T-1735 | Registrar `I-30` a `I-32` como decididos ou adiados; atualizar `CHANGELOG` e os status | — |

**Verificação:** P5, P6.

**Tamanho:** P — três horas, mais a agenda das duas pessoas.

---

## 4. Sequência

```
F0  o estado de tela que não existe   [P0]      ── nenhum src/ tocado
     │
F1  instrumentos; o da sigla reprova  [P1]      ── nenhum src/ tocado
     │
F2  payload existe, frase continua              ── publicável, invisível
     │
F3  tabela na tela, frase continua    [P2]      ── publicável, feio de propósito
     │
F4  a frase some                      [P3,P4]
     │
F5  pessoas e conjunto                [P5,P6]
```

**Total: dois dias e meio**, mais a agenda do `P5`.

---

## 5. A regressão que já está escrita

Levantamento sobre a suíte de 547, buscando toda leitura de `V-REC-01`.

### 5.1 O que **não** é afetado

| Teste | Por quê |
|---|---|
| `test_domain.py:238` | Registra um achado `V-REC-01` à mão para exercitar `ValidationReport`. Não depende de a validação real emitir |
| `test_blocos_de_itens.py:101` | Só menciona a validação em docstring |
| `test_quantitativo_consolidado.py` — as somas, o sinal, a guarda, a sequência | Afirmam a **consolidação**, que esta espec não toca |
| `test_docx_*`, `test_capa`, `test_analise` | O entregável não muda (`R-FON-13`) |

### 5.2 As seis âncoras que mudam de valor

| # | Teste | O que lê hoje | Destino |
|---|---|---|---|
| 1 | `test_anchor_por_codigo.py:248` | `{a.codigo ... if a.validacao == "V-REC-01"}` | Mesmos cinco códigos, lidos do campo novo |
| 2 | `test_api_e2e.py:270` | `{a["validacao"] for a in corpo["avisos"]} == {"V-REC-01"}` | `avisos == []` **e** `len(divergencias_de_fonte) == 5` |
| 3 | `test_consolidacao_aditivos.py:433` | `"V-REC-01" not in validacoes` | Continua válido; acrescentar que o campo novo está **vazio** — senão fica verde num pipeline mudo |
| 4 | `test_consolidacao_aditivos.py:451` | `acusados == EXPLICADOS_PELO_ADITIVO` — **a contraprova** de que sem aditivo os cinco voltam | Mesmos cinco, do campo novo. **Não pode virar `avisos == []`** |
| 5 | `test_quantitativo_consolidado.py::test_t1605` | `acusados == {CODIGO_ADULTERADO}` — **a prova da ESPEC 022** | Mesmo código, do campo novo, **e** severidade `CRITICO` |
| 6 | `test_reconciliation.py:259+` | Chama a validação e lê `achados` | Acompanha a decisão do `I-29` (T-1711) |

### 5.3 O aviso que este plano existe para dar

**A número 5 é a mais perigosa da suíte inteira.**

`test_t1605_a_aba_adulterada_e_acusada` foi escrita na ESPEC 022 para reprovar contra o código de
então, provando que o sistema era cego naqueles cinco códigos. Ela é a única evidência viva de que
a cegueira fechou.

Reancorá-la no automático produz `assert resultado.achados.avisos == []` — que fica **verde**, e
que seria verde também num sistema que voltasse a suprimir. O teste sobreviveria como linha de
código e morreria como prova.

O destino correto é o da coluna: mesmo código, lido do campo novo, **mais** a asserção de
severidade `CRITICO`. Ela sai mais forte do que entrou — passa a provar a cegueira fechada *e* a
distinção de estados que esta espec introduz.

Mesma regra, com menos gravidade, para a número 4: ela separa *"calou porque o aditivo explica"*
de *"a validação foi desligada"*, e é o `P4` do PLANO 022.

### 5.4 O que não pode se mexer

- Uma linha do `.docx` ou uma célula do `.xlsx` (`T-1730`);
- As regras `R-QTD-01` a `R-QTD-08` da ESPEC 022;
- `ListaDeAchados`, que continua servindo `V-CTR-*`, `V-MED-*` e `V-ADT-*` (`D-06`);
- `codigos_ignorados()`, agora consumida também por `T-1713`.

---

## 6. O que pode dar errado, e o que pega

| Falha | O que pega | Fase |
|---|---|---|
| **O teste da sigla nascer contra `estados.pronto`** e ser vacuamente verde | `T-1700` e o portão `P0` — o estado é construído antes do instrumento | F0 |
| **Os dois estados colapsarem numa tarja só** | `T-1708`, escrita antes de existir campo para ela | F1 |
| **A `T-1605` ser reancorada em `avisos == []`** | §5.3, `T-1728` e o portão `P3` | F4 |
| Alguém **filtrar `V-REC-01` na tela** em vez de tirá-lo da resposta | `D-06`; o sinal no diff é a cadeia num `.tsx` | F4 |
| A coluna de diferença ser **cortada** por espaço | `D-03` a declara insacrificável; a rolagem resolve | F3 |
| A ação **prometer reenvio** que não acontece | `D-05` e o rótulo em duas etapas | F3 |
| A tabela virar **mais uma tabela ignorada** | `R-FON-11` — só existe quando há o que mostrar | F3 |

---

## 7. Insumos

| ID | Insumo | Para quê | Quando |
|---|---|---|---|
| `K-30` | **Uma pessoa do faturamento** que não participou desta espec, com meia hora e os dois estados na tela | `P5` | T-1731 |
| `K-31` | Decisão sobre `I-31`: divergência remanescente com aditivo aplicado deveria **bloquear**? | `I-31` | depois — não bloqueia |
| `K-32` | Decisão sobre `I-30`: a divergência merece aba no XLSX de análise? Mesma pergunta que o `I-21` fez das derivadas | `I-30` | depois |

---

## 8. O que este plano não faz

- **Não muda o `.docx` nem o `.xlsx`.** `R-FON-13`, e a âncora que o sustenta já existe.
- **Não mexe na consolidação.** As regras `R-QTD-*` da ESPEC 022 ficam intactas; esta entrega
  consome o dado que elas produzem.
- **Não cria validação nem severidade nova no domínio.** Reusa o eixo da ESPEC 009 (`D-02`).
- **Não corrige o manual** — três trechos ensinam o oposto do que o sistema faz (ESPEC 023 §2.5),
  e a auditoria é `I-22`.
- **Não decide se o estado B deve bloquear.** É `I-31` e `K-31`.
