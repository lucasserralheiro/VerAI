# TASKS 040 — Backlog de "O mês que veio com dias"

| | |
|---|---|
| **Especificação** | [ESPEC 040](../specs/040-o-mes-que-veio-com-dias.md) v1.1 |
| **Plano** | [PLANO 040](../plans/040-plano-o-mes-que-veio-com-dias.md) v1.0 |
| **Versão** | 1.0 — 2026-09-03 |
| **Total** | 18 tarefas · 4 portões · 3 insumos em aberto |
| **Status** | **Concluído** — 2026-09-03. Portões `P0` a `P3` fechados. Backend **1.543 → 1.555 passed**. Confirmado no aplicativo real pelo usuário: a mensagem original sumiu, e a de `I-04` apareceu no lugar dela, como previsto. Revisão de código pós-entrega achou `V-CTR-07` sem chamada em `container.py` — corrigido, ver §12 |

> **Escrito antes da implementação.** A §10 é a única seção que não pode ser escrita agora, e é a
> que a próxima entrega vai ler.

> **Dois arquivos de produção em todo o backlog.** `contract_item.py` e `pdfplumber_extractor.py` na
> `E2`; `contract_validations.py` na `E3`. Se o diff trouxer `grid.py` ou `_e_item_completo`, alguma
> tarefa reabriu uma decisão que não é desta entrega.

> **O portão que decide a `E2` é uma mensagem, não um "passou".** Depois da correção, o documento real
> tem de continuar falhando — só que com outro código e outro campo. `P1`, `T-2613`.

---

## 1. Convenções

**Identificadores** `T-26nn`, continuando de `T-2603`, a última em uso no repositório.

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`python -m pytest` verde. Medido nesta árvore em 2026-09-03, antes de começar: `backend/` limpo,
**1.543 testes coletados** (`python -m pytest --collect-only -q`, **com o `-m`** — `uv run pytest`
puro quebra a coleta deste projeto).

**Convenção de commit** `<tipo>(T-26nn): descrição`. `test(...)` para `E0`/`E1`; `fix(...)` para a
`E2` — corrige um defeito de bloqueio indevido, não acrescenta função; `feat(...)` para a `E3` — é
validação nova; `docs(...)` para a `E4`. **Nunca dois tipos no mesmo commit.**

### 1.1 Cinco regras que atravessam este backlog

**1 — Dois arquivos de produção, e só dois, até a `E3`.** `contract_item.py` e
`pdfplumber_extractor.py`. `_e_item_completo` — o crivo de admissão de geometria da ESPEC 019/033 —
**não é tocado**: continua exigindo as quatro colunas numéricas para aceitar uma geometria candidata.

*O sinal no diff:* qualquer linha em `_e_item_completo` ou em `grid.py`.

**2 — O portão da `E2` pergunta "com qual mensagem ainda falha", não "passou?".** O documento real
(`contrato_cgm.pdf`) tem dois defeitos independentes na mesma página. Corrigido só o de `meses`, ele
**continua quebrado** — agora no código `14.023.00002.00`, com `sem preço unitário, valor total`. Se
a extração terminar sem erro depois da `E2`, algo além do previsto mudou, e é sinal de alarme, não de
sorte.

*O sinal no diff:* `T-2613` verde sem um `pytest.raises` no meio.

**3 — O oráculo de regressão é o conjunto dos dez documentos, por igualdade, nunca por amostra.** A
função `_medida()` de `test_extractor_aditivo_smul.py` já existe e já devolve `(itens, total, blocos,
geometrias, sha)` — esta entrega a **reusa**, não a reescreve.

*O sinal no diff:* uma nova função de medição ao lado da que já existe.

**4 — A maior parte da prova não abre PDF nenhum.** `_montar_item` é testável com uma lista de
células construída à mão, no espírito de `T-13` da ESPEC 033 sobre `para_decimal`. É onde os seis
casos da `E1` são provados — rápido, determinístico, sem depender de geometria de página.

*O sinal no diff:* um teste novo que abre `contrato_cgm.pdf` para provar algo que uma lista de string
já provaria.

**5 — Nenhum PDF novo além de `contrato_cgm.pdf`.** O aditivo do CGM (`PA-CGM-250912-127 v4.0.pdf`)
tem a mesma célula em prosa, mas falha por um **terceiro** motivo, ainda não investigado. Trazê-lo
misturaria três defeitos numa entrega que é sobre um.

*O sinal no diff:* um segundo arquivo nesta família em `tests/fixtures/`.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** Linha de base e a fixture | T-2604 … T-2607 | **P0** (1ª metade) | F0 |
| **E1** Os testes, escritos antes | T-2608 … T-2610 | **P0** | F1 |
| **E2** `R-MES-01` a `R-MES-03` | T-2611 … T-2614 | **P1** | F2 |
| **E3** `V-CTR-07` | T-2615 … T-2617 | **P2** | F3 |
| **E4** Fechamento | T-2618 … T-2621 | **P3** | F4 |

### 2.1 A régua da entrega — o que pode mudar de comportamento

| Muda | Não muda |
|---|---|
| `ContractItem.meses` vira `int \| None`; campo novo `meses_bruto` | `_e_item_completo` — o crivo de admissão de geometria |
| `_montar_item` não bloqueia mais por `meses` ausente | `preço unitário`, `quantidade`, `valor total` continuam bloqueantes |
| Validação nova `V-CTR-07`, severidade `AVISA` | `V-CTR-03` (checksum) e as demais validações |
| `contrato_cgm.pdf` entra como fixture, com `caminho_contrato_cgm` em `conftest.py` | Os dez documentos do corpus — nenhuma tupla de item se move (`REGUA` de `test_extractor_aditivo_smul.py`) |
| Status da ESPEC 040, `docs/CHANGELOG.md` | `application/`, `api/`, `frontend/` — nenhuma linha |

---

## 3. Épico E0 — Linha de base e a fixture `[portão P0, 1ª metade]`

> **Nenhum arquivo de `src/` é tocado neste épico.** Só se mede e se traz o PDF para dentro da suíte.

#### T-2604 — Medir a mensagem original, na árvore parada
**Tamanho:** PP · **Ref:** ESPEC §1

Rodar `PdfPlumberContractExtractor().extrair(...)` sobre
`docs/documentos/CGM/PC-CGM-240603-82 v3.0.pdf` e registrar a mensagem exata do `ExtractionError`.

**Já medida uma vez nesta sessão** (`item 10.050.00001.00 (página 10) sem meses — extração
incompleta da tabela do contrato`) — repetir na execução, e não supor: é o "antes" desta entrega, e
é sobre ele que `T-2610` e `T-2613` são portão.

**Pronto quando:** a mensagem está transcrita neste documento, byte a byte.

---

#### T-2605 — Trazer o PDF para a suíte
**Tamanho:** PP · **Ref:** `I-01` da ESPEC (resolvido)

Copiar `docs/documentos/CGM/PC-CGM-240603-82 v3.0.pdf` para
`backend/tests/fixtures/contrato_cgm.pdf`. Registrar o `sha256` do arquivo neste documento
(`e1e75af8459fbfc1…`, medido nesta sessão).

**Sem sanitização.** É proposta comercial — preços e serviços —, não planilha com dado pessoal;
entra do mesmo jeito que `contrato_smul.pdf` e `aditivo_smul.pdf` já entraram (ESPEC 033 `D-08`).

**Pronto quando:** o arquivo está em `tests/fixtures/`, com o `sha256` conferido.

---

#### T-2606 — A fixture de caminho
**Tamanho:** PP

`caminho_contrato_cgm` em `conftest.py`, `scope="session"`, no molde exato de
`caminho_aditivo_smul` (linha 90) — inclusive o docstring explicando **por que** o documento está
ali, não só o que ele é.

**Pronto quando:** a fixture existe e resolve para `FIXTURES / "contrato_cgm.pdf"`.

---

#### T-2607 — A régua dos dez documentos, hoje
**Tamanho:** PP · **Ref:** `R-MES-05`

Reexecutar `_medida()` (de `test_extractor_aditivo_smul.py`) sobre os seis documentos de
`REGUA` (que cobrem os dez, com repetição) e conferir que os valores batem com os já gravados ali.

**Não é uma régua nova — é a mesma, reconferida.** Se algum valor divergir, a árvore não está no
estado que este plano presume, e a investigação vem antes de qualquer outra tarefa.

**Pronto quando:** os seis valores conferem, sem ajuste.

---

## 4. Épico E1 — Os testes, escritos antes `[portão P0]`

> **Nenhum arquivo de produção é tocado neste épico.** É a regra 4: a maior parte da prova mora aqui,
> sem abrir PDF nenhum.

#### T-2608 — Os seis casos de `_montar_item`
**Tamanho:** P · **Ref:** `R-MES-01`, `R-MES-02`

Módulo novo `tests/test_periodo_por_extenso.py`. Chamadas diretas a
`extractor._montar_item(celulas, codigo, pagina)`, com listas de célula construídas à mão — sem
`pdfplumber`, sem geometria:

| caso | célula de `meses` | esperado |
|---|---|---|
| (a) limpo | `'9'` | item igual ao de hoje, `meses == 9`, `meses_bruto is None` |
| (b) prosa | `'2 meses e 14 dias'` | **sem exceção**; `meses is None`; `meses_bruto == '2 meses e 14 dias'` |
| (c) preço ausente | `''` na coluna de preço | `ExtractionError` — inalterado |
| (d) quantidade ausente | `''` na coluna de quantidade | `ExtractionError` — inalterado |
| (e) total ausente | `''` na coluna de total | `ExtractionError` — inalterado |
| (f) `meses` **e** preço ausentes | ambos `''` | `ExtractionError`, mensagem citando **só** `preço unitário` |

**(a), (c), (d), (e), (f) já passam contra o `HEAD`.** Só (b) é o caso novo. Os cinco que já passam
não são folga: são a prova de que a mudança é estreita, medida **antes** de existir.

**Pronto quando:** os seis casos estão escritos, com o texto exato de cada mensagem esperada.

---

#### T-2609 — A mensagem original, sobre o PDF real
**Tamanho:** PP

No mesmo módulo, com a fixture `contrato_cgm`:
`pytest.raises(ExtractionError, match=r"10\.050\.00001\.00.*sem meses")`.

Documenta o defeito atual sobre o documento que originou a espec — e é o teste que a `T-2613` vai
inverter.

**Pronto quando:** escrito, e passando contra o `HEAD` (o defeito ainda existe).

---

#### T-2610 — O portão `[portão]`
**Tamanho:** PP · **Portão P0**

Rodar `test_periodo_por_extenso.py` inteiro contra o `HEAD`, com `git diff src/` vazio:

| teste | resultado esperado |
|---|---|
| `T-2608` (a, c, d, e, f) | **passam** |
| `T-2608` (b) | **reprova** — é o único caso novo |
| `T-2609` | **passa** — documenta o defeito de hoje |

**Pronto quando:** a tabela acima bate, com a mensagem de reprovação de (b) transcrita neste
documento.

---

## 5. Épico E2 — `R-MES-01` a `R-MES-03` `[portão P1]`

#### T-2611 — `ContractItem.meses` fica opcional
**Tamanho:** PP · **Ref:** `D-02`, `D-03` · **Primeiro toque em `src/`**

`domain/entities/contract_item.py`: `meses: int` → `meses: int | None`. Campo novo
`meses_bruto: str | None = None`, com um comentário curto explicando que ele só é preenchido quando
`meses` não parseia — e por quê (a auditoria manual que `V-CTR-07` promete).

**Com default.** Nenhum dos fixtures existentes (todos com `meses=<int>` explícito) precisa mudar.

**Pronto quando:** o tipo compila e `mypy` não acusa nada nos usos existentes.

---

#### T-2612 — `_montar_item` deixa de bloquear por `meses`
**Tamanho:** PP · **Ref:** `R-MES-01`, `R-MES-03`

Em `pdfplumber_extractor.py::_montar_item`: `meses` sai da lista `faltando`. Quando
`para_decimal(celulas[COL_MESES])` é `None`, o item é montado com
`meses=None, meses_bruto=_limpar(celulas[COL_MESES])`.

**`_e_item_completo` não é tocado** (regra 1). Ele é uma função diferente, testada em separado, e
mexer nela reabriria a admissão de geometria — fora do escopo por decisão (`D-05` da ESPEC).

**Pronto quando:** `T-2608(b)` fica verde, sem nenhuma outra linha do arquivo alterada além da
lógica de `meses`.

---

#### T-2613 — O portão da mensagem prevista `[portão, risco]`
**Tamanho:** PP · **Portão P1**

`T-2608` inteiro verde. `T-2609` passa a **reprovar** — a asserção é ajustada para

```python
pytest.raises(ExtractionError, match=r"14\.023\.00002\.00.*sem preço unitário, valor total")
```

e essa mensagem tem de bater **exata** com a que a ESPEC §2.3 prevê, não uma aproximação.

**Este é o portão mais importante do backlog inteiro** (ver o aviso no topo do documento). Se a
extração do `contrato_cgm` terminar **sem** erro nenhum aqui, parar: significa que algo além do
campo `meses` deixou de bloquear, e a causa mais provável é uma mudança acidental em
`_e_item_completo` ou em como as geometrias são admitidas — nenhuma das duas deveria ter mudado
nesta entrega.

**Pronto quando:** a nova asserção de `T-2609` está verde, com a mensagem exata registrada neste
documento.

---

#### T-2614 — Os dez documentos não se moveram `[portão]`
**Tamanho:** PP · **Portão P1**

Reexecutar a régua da `T-2607`: os seis valores de `REGUA` idênticos — item, total, blocos,
geometrias admitidas e `sha`, os cinco na mesma medição.

**Pronto quando:** os seis valores batem, sem exceção.

---

## 6. Épico E3 — `V-CTR-07` `[portão P2]`

#### T-2615 — A validação
**Tamanho:** PP · **Ref:** `R-MES-04`

Em `infrastructure/validations/contract_validations.py`, função nova
`v_ctr_07_periodo_nao_numerico`, no molde de `v_ctr_06_cauda_sem_linha_anterior`: percorre
`contrato.itens`, filtra `meses is None`, registra `Severity.AVISA` com código, página e o texto de
`meses_bruto`.

**Pronto quando:** a função existe e segue o formato de mensagem da ESPEC §5.1.

---

#### T-2616 — O teste, sem PDF nenhum
**Tamanho:** PP · **Ref:** `R-MES-04`

No módulo de teste de validações, `Contract`/`ContractItem` construídos à mão — padrão de
`test_cauda_de_pagina.py:249-264`:

- item com `meses=None, meses_bruto="2 meses e 14 dias"` → um achado `AVISA`, com código, página e
  texto certos;
- item com `meses=12` → nenhum achado;
- contrato sem itens → nenhum achado.

**Pronto quando:** os três casos passam.

---

#### T-2617 — O portão `[portão]`
**Tamanho:** PP · **Portão P2**

`T-2616` verde. Suíte de validações existente sem nenhum achado `BLOQUEIA` novo introduzido em
lugar nenhum — `V-CTR-07` é `AVISA`, e só `AVISA`.

**Pronto quando:** os dois conferem.

---

## 7. Épico E4 — Fechamento `[portão P3]`

#### T-2618 — Suíte completa
**Tamanho:** PP · **Portão P3**

`python -m pytest`, número comparado com os 1.543 coletados na `E0`. Esperado: **1.543 + N**, com
`N` = os testes novos de `T-2608`, `T-2609` e `T-2616`, nenhum removido.

**Pronto quando:** verde, com o número reconciliado tarefa a tarefa.

---

#### T-2619 — Ferramentas
**Tamanho:** PP · **Portão P3**

`ruff check` e `mypy src/` sobre os três arquivos tocados.

**Pronto quando:** os dois limpos.

---

#### T-2620 — Documentos
**Tamanho:** PP

- **Status da ESPEC 040**: de *Proposta* para *Implementada*, com os números medidos e o `I-04`
  explicitamente mantido como ponto em aberto — não fechado por esta entrega;
- **`docs/CHANGELOG.md`**: entrada nova, citando que `meses` deixou de ser campo bloqueante por não
  ser consumido em lugar nenhum do backend (ESPEC §2.2), e que o segundo defeito do CGM (`I-04`)
  segue aberto;
- **`README.md`**: linha do incremento 040, se a tabela existente tiver esse padrão.

**Pronto quando:** os três documentos refletem o estado final, incluindo o que ficou aberto.

---

#### T-2621 — Nenhuma âncora de documento tocada
**Tamanho:** PP · **Portão P3**

`git diff --stat backend/`: só `contract_item.py`, `pdfplumber_extractor.py`,
`contract_validations.py`, `conftest.py`, os dois módulos de teste novos e a fixture binária.
**Nenhuma** entrada em `docx_renderer.py`, `report.py`, `xlsx` de análise ou *schema* de API.

**Pronto quando:** o `diff` bate com essa lista, e nada além dela.

---

## 8. Rastreabilidade

| Regra | Tarefas |
|---|---|
| `R-MES-01` | T-2608(b), T-2611, T-2612, T-2613 |
| `R-MES-02` | T-2608(c, d, e, f), T-2612, T-2613 |
| `R-MES-03` | T-2612, T-2614 |
| `R-MES-04` | T-2615, T-2616, T-2617 |
| `R-MES-05` | T-2607, T-2614 |

---

## 9. O que este backlog não faz

- **Não toca `grid.py`, `_e_item_completo`, nem o crivo de admissão de geometria** (regra 1). `I-04`
  fica de pé.
- **Não traz `PA-CGM-250912-127 v4.0.pdf`** como fixture (regra 5) — mesmo padrão de célula, terceiro
  defeito, ainda não investigado.
- **Não exibe `meses_bruto` no `.docx` ou na API** — `meses` não é servido a nenhum consumidor hoje;
  é entrega própria (`I-02` da ESPEC).
- **Não sanitiza `contrato_cgm.pdf`** — proposta comercial, não planilha com dado pessoal.
- **Não acrescenta dependência.**

---

## 10. Sequência e commits

```
E0 ──► E1 ──► E2 ──► E3 ──► E4
P0     P0     P1     P2     P3

E0  fixture e linha de base             nenhum arquivo de produção tocado
E1  seis casos, o extrator intocado     test(T-2608..610)
E2  R-MES em contract_item + extractor  fix(T-2611..614)
E3  V-CTR-07                            feat(T-2615..617)
E4  fechamento                          docs(T-2620) · o resto é verificação
```

**A `E1` e a `E2` não se juntam num commit.** Quem ler o histórico precisa poder ver os seis casos
vermelhos (com exceção de cinco, que já passam por não mudarem) antes do conserto — é o que prova
que o teste mede o que diz medir.

---

## 11. Insumos em aberto

| ID | Questão | Bloqueia? |
|---|---|---|
| `I-02` | Vale, no futuro, exibir `meses_bruto` no `.docx` quando presente? | Não. `meses` não aparece no relatório hoje; seria entrega nova |
| `I-03` | Outros campos hoje bloqueantes (`preço`, `quantidade`, `total`) têm o mesmo padrão de conteúdo em prosa em algum documento do corpus? | Não. Não medido nesta entrega; os três seguem bloqueantes por decisão, independente da resposta |
| `I-04` | `14.023.00002.00`, mesma página do `contrato_cgm.pdf`, falha por um defeito independente — linha sem faixa própria de oito divisórias lida pela geometria da tabela de preços via `R-FXA-04` (ESPEC 033). Impede que o documento real gere relatório completo mesmo após esta entrega | Não bloqueia este backlog; bloqueia o documento real ficar 100% verde — candidato a uma spec própria |

---

## 12. Emenda de execução

**2026-09-03.** As cinco fases correram na ordem prevista, e os quatro portões fecharam sem
reverter fase nenhuma.

**`T-2610` reprovou em quatro testes, não em um.** O backlog previa que (a), (c), (d), (e) e (f) já
passariam contra o `HEAD`, e só (b) reprovaria. Dois ajustes sobre o previsto: (a) reprova também,
porque `item.meses_bruto` não existe antes da `T-2611` — `AttributeError`, não falha de asserção; e
(f) reprova porque a mensagem de hoje **inclui** `meses` junto com `preço unitário` (o comportamento
que a `T-2612` corrige), então "a mensagem cita só preço unitário" ainda é falso no `HEAD`. Os dois
reprovam pelo motivo certo — só não era o motivo que a tabela do backlog nomeava. `(c)`, `(d)` e
`(e)` passaram como previsto.

**`T-2613` fechou exatamente como o backlog descreveu — o portão fez o que prometia.** Depois de
`R-MES-01`/`R-MES-02`, `contrato_cgm.pdf` parou de falhar em `10.050.00001.00` e passou a falhar em
`14.023.00002.00` com `sem preço unitário, valor total` — a mensagem prevista na ESPEC §2.3, byte a
byte. Nenhuma investigação extra foi necessária.

**Confirmação fora da suíte, em produção, no meio da execução.** O usuário rodou o aplicativo real
com o mesmo `PC-CGM-240603-82` enquanto a `E4` ainda rodava em background, e a tela mostrou
exatamente `item 14.023.00002.00 (página 10) sem preço unitário, valor total` — o mesmo texto que
`T-2613` já tinha medido na suíte. É a mesma prova, por um caminho independente.

**Um job em background morreu sem deixar saída, e foi refeito sem custo.** A primeira tentativa de
`T-2618` (suíte completa) foi interrompida por fora desta sessão — o arquivo de saída ficou vazio, e
o status voltou `stopped` numa notificação seguinte. Reexecutada do zero, terminou normalmente em
18min46.

**A suíte completa acusou uma reprovação em área não tocada — ruído de carga, não regressão.**
`test_desempenho.py::test_o_custo_de_um_anexo_e_linear` reprovou dentro da suíte cheia (8,20× contra
o limite de 2,6×) e passou isolado, em 5,15s. O arquivo mede custo de mesclagem de XLSX — nenhuma
relação com `contract_item.py`, `pdfplumber_extractor.py` ou `contract_validations.py` — e a suíte
completa acabara de processar 1.553 testes, incluindo extrações de PDF pesadas. Reexecutar isolado
é o critério certo para separar deriva de máquina de regressão real, e foi o que decidiu: não é
regressão.

**Contagem final:** 1.543 coletados na `E0`, **1.553** ao final — os dez novos de
`test_periodo_por_extenso.py` (sete de `_montar_item`/mensagem do PDF real, três de `V-CTR-07`),
nenhum removido. `ruff check` e `mypy src/` limpos nos três arquivos de produção tocados. `git diff
--stat backend/` trouxe exatamente os cinco arquivos e os dois artefatos novos previstos em `T-2621`
— nenhuma âncora de documento (`.docx`, `.xlsx`, *schema* de API) tocada.

**O que ficou aberto, e é de outra entrega.** `I-04` — o segundo defeito do `PC-CGM-240603-82` —
segue sem investigação própria, confirmado real tanto pela suíte quanto pelo uso em produção.

### 12.1 Revisão de código pós-entrega — dois achados, os dois corrigidos

**A `E3` fechou um portão que não testava o que a entrega prometia.** `T-2617` verificou
`v_ctr_07_periodo_nao_numerico` isolada — chamada direta, achado certo — e nunca perguntou se
`container.py` a chama. Não perguntava porque nenhuma tarefa do backlog nomeava `container.py`
(regra 1 do §1.1 só protegia `_e_item_completo` e `grid.py`, na direção contrária). O usuário testou
o aplicativo real com `contrato_cgm.pdf` **antes** de a `E4` terminar (a mensagem de `I-04` que
apareceu na tela era esperada, e apareceu certa) — mas aquele teste não exercitava `V-CTR-07`, porque
`contrato_cgm.pdf` bloqueia por `I-04` antes de chegar lá. O relatório com um item de `meses` em
prosa **e sem outro bloqueio** nunca foi gerado de ponta a ponta nesta entrega, e foi assim que a
lacuna sobreviveu ao portão `P2`.

Uma revisão de código pedida depois achou dois problemas:

1. `v_ctr_07_periodo_nao_numerico` sem chamada em `container.py` — corrigida com duas linhas, ao
   lado de `v_ctr_06_cauda_sem_linha_anterior` (mesma guarda `if peça.itens`), e um teste novo,
   `test_t2622_v_ctr_07_dispara_pelo_container_completo`, que roda o `DIContainer` real via
   `_ContainerComFontesEmCache` — o mesmo mecanismo que `test_reconciliation.py` já usa para provar
   a ligação de `V-CTR-05` ao container, não só a validação isolada;
2. `meses_bruto` saindo `''` em vez de `None` quando a célula de período está genuinamente vazia (não
   em prosa) — `_limpar('')` devolve `''`, e a expressão original não distinguia os dois casos.
   Corrigido com `_limpar(...) or None`, e um teste novo, `test_t2608g`.

**A lição, para o próximo backlog que criar uma validação nova:** o portão que prova que a
validação existe e está certa (`T-2617`) não é o mesmo portão que prova que ela **roda em produção**.
O segundo exige um teste contra o orquestrador real — `DIContainer.gerar`, não uma chamada direta —,
e vale nomear esse teste como tarefa própria desde o backlog inicial, não descobrir a falta dele numa
revisão depois.

**Números finais, depois da correção:** 1.543 → **1.555 passed** (doze testes novos em
`test_periodo_por_extenso.py`, nenhum removido); `ruff`/`mypy` limpos nos cinco arquivos tocados
(os três originais mais `container.py`); suíte completa reexecutada do zero, sem a reprovação de
`test_desempenho.py` que apareceu na primeira rodada (ruído de carga, não regressão — §12).
