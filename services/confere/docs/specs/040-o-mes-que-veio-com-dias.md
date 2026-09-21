# ESPEC 040 — O mês que veio com dias

| | |
|---|---|
| **Status** | **Implementada** — 2026-09-03. Backend **1.543 → 1.555 passed**, zero falhas — uma reprovação de `test_desempenho.py` (área não tocada por esta entrega) foi ruído de carga sob a suíte completa, confirmada isolada em seguida. Os dez documentos do corpus saem com as tuplas de item idênticas. Conferido no aplicativo real com `contrato_cgm.pdf`: a mensagem original sumiu, e a prevista (`I-04`) apareceu no lugar dela — exatamente como a §2.3 antecipou. **Uma revisão de código, pedida depois da entrega inicial, achou `V-CTR-07` sem chamada em `container.py`** — existia e passava isolada, mas não rodava em produção. Corrigido, com um teste que exercita o `DIContainer` real (§13) |
| **Versão** | **1.1** — 2026-09-03. A §2.3 foi corrigida durante o planejamento da implementação ([PLANO 040](../plans/040-plano-o-mes-que-veio-com-dias.md)): a v1.0 presumia, por leitura de código, que a tabela de escopo não seria lida por `_montar_item`. **Medido no documento real** (já localizado no repositório): ela é. Nenhuma regra, decisão ou escopo desta espec muda — abre-se o ponto `I-04` |
| **Depende de** | [ESPEC 001](001-mvp-analise-medicao.md) `V-CTR-03` — o checksum que continua sendo o oráculo de integridade. [ESPEC 019](019-contrato-e-aditivos.md) `D-05` — o crivo de admissão de geometria, que esta espec não reabre |
| **Revisa** | Nada de decisão anterior. Estende a família `V-CTR-*` com a mesma política de severidade que `V-CTR-04`, `V-CTR-05` e `V-CTR-06` já usam — "avisa e não bloqueia" para achado que não compromete o checksum |
| **Não toca** | O crivo de admissão de geometria (`_e_item_completo`, ESPEC 019 `D-05`), a escolha do gabarito, a leitura por faixa (ESPEC 033), `preço unitário`/`quantidade`/`valor total` — que continuam bloqueantes exatamente como hoje —, o checksum de `V-CTR-03`, a API, o `.docx` e o frontend |
| **Referência normativa** | `docs/documentos/CGM/PC-CGM-240603-82 v3.0.pdf`, promovido a `backend/tests/fixtures/contrato_cgm.pdf` (`sha256` `e1e75af8459fbfc1…`) |
| **Origem** | Submissão real: *"item 10.050.00001.00 (página 10) sem meses — extração incompleta da tabela do contrato"*, com a tabela de origem anexada em conversa: duas linhas do mesmo código na seção 5 (PREÇO DOS SERVIÇOS) — uma com período `9`, outra com período `2 meses e 14 dias` |

---

## 1. Problema

**Um período de contrato escrito por extenso derruba a submissão inteira, mesmo quando preço,
quantidade e total da mesma linha estão intactos.**

A tabela "5. PREÇO DOS SERVIÇOS" traz o código `10.050.00001.00` duas vezes — a segunda linha é a
cauda de um período que não fecha em mês cheio:

| PREÇO UNITÁRIO | QTDE | PERÍODO (MÊS) | TOTAL |
|---|---|---|---|
| 217,70 | 100 | `2 meses e 14 dias` | 21.770,00 |

`_montar_item` ([pdfplumber_extractor.py:514-536](../../backend/src/infrastructure/contract/pdfplumber_extractor.py#L514-L536))
exige que as quatro colunas numéricas — quantidade, preço, meses, total — parseiem como `Decimal`, e
levanta `ExtractionError` se qualquer uma falhar. `ExtractionError` estoura **dentro da extração**,
antes de qualquer `V-CTR-*`; [reports.py:279](../../backend/src/api/routers/reports.py#L279) e
[reports.py:357](../../backend/src/api/routers/reports.py#L357) a convertem em `422`, e a submissão
inteira é recusada — como na origem da ESPEC 033.

**Não é tabela truncada, e não é confusão entre tabelas.** A célula está inteira, legível, e a linha
pertence à tabela certa — a mesma que já tem, duas linhas acima, uma leitura perfeita do mesmo código
com período `9`. O que falta é o parser reconhecer um período que **não é um número puro**.

## 2. O que foi levantado no código

### 2.1 Por que só "meses" falta, e nada mais

`para_decimal` ([quantity.py:30-61](../../backend/src/domain/value_objects/quantity.py#L30-L61))
sobre os quatro campos daquela linha:

```python
para_decimal('217,70')             -> Decimal('217.70')     # preço — ok
para_decimal('100')                -> Decimal('100')        # quantidade — ok
para_decimal('2 meses e 14 dias')  -> None                  # meses — Decimal('2 meses e 14 dias')
                                                              #   levanta InvalidOperation
para_decimal('21.770,00')          -> Decimal('21770.00')   # total — ok
```

`meses` é o único campo cujo texto tem letras. Os outros três chegam limpos, e é por isso que a
mensagem cita só `sem meses` — igual ao formato de `_montar_item` quando `faltando` tem um elemento
só ([pdfplumber_extractor.py:520-536](../../backend/src/infrastructure/contract/pdfplumber_extractor.py#L520-L536)).

### 2.2 O campo que bloqueia não é lido em lugar nenhum

Busca por `.meses` em todo `backend/src/`: a única ocorrência fora da própria definição
([contract_item.py:18](../../backend/src/domain/entities/contract_item.py#L18)) é a atribuição em
`_montar_item` ([pdfplumber_extractor.py:547](../../backend/src/infrastructure/contract/pdfplumber_extractor.py#L547)).
Nenhuma validação, nenhum cálculo, nenhuma resposta de API e nenhum `.docx` o consultam.

O próprio código explica por quê. `Contract.soma_dos_totais`
([contract.py:312-319](../../backend/src/domain/entities/contract.py#L312-L319)) soma o
`total_declarado` de cada linha, e não `preço × quantidade × meses`:

> *"a fórmula varia por item — em HORA/HOMEM a quantidade já é o total do período e os meses não
> multiplicam, enquanto em serviços mensais multiplicam"*

`10.050.00001.00` é `HORA/HOMEM` — exatamente o caso em que `meses` não participa de conta nenhuma. O
campo hoje é **capturado e nunca consultado**, e ainda assim tem o poder de derrubar a submissão
inteira.

### 2.3 A tabela de escopo também passa por `_montar_item` — por um caminho diferente do previsto

*(revisão da v1.0, que presumia o contrário por leitura de código; corrigida por medição no
documento real)*

O código `14.023.00002.00` (ACESSO À REDE PRODAM PARA USUÁRIOS DA PMSP, USUÁRIO/MÊS, QTDE 255) está
na mesma página 10 do `PC-CGM-240603-82`, numa tabela de escopo com **cinco** divisórias —
`_faixas_verticais` mede a faixa da sua linha (`y = 138,2–149,9`) como
`[68.6, 126.5, 337.5, 394.0, 421.1]`, contra as **oito** da tabela de preços mais abaixo na mesma
folha (`y = 490,6–526,6`, por exemplo). Sem faixa própria de oito e sem herança válida (os cinco
traços não são subconjunto da faixa anterior), a linha cai no degrau `R-FXA-04` da ESPEC 033 — "as
divisórias da página" — e é lida com as colunas da tabela de preços, a mesma geometria que
`montar_grade` monta para o documento inteiro.

**Isso não é o defeito desta espec, e é uma consequência dele que a v1.0 não previu.** Com `meses`
deixando de bloquear (`R-MES-01`), a extração do `PC-CGM-240603-82` avança até essa linha e falha de
novo — agora com `sem preço unitário, valor total`, no código `14.023.00002.00`. É um **segundo
defeito, independente**, e continua bloqueando por decisão (`R-MES-02`): `preço` e `total` seguem
exigidos. Registrado como `I-04`, fora do escopo desta espec — mesmo padrão da ESPEC 033 em relação
ao aditivo do PGM (§1: "corrigido só o primeiro, a mensagem passa a [outra], no mesmo item"), com a
diferença de que aqui os dois defeitos pertencem a specs diferentes, não a fases da mesma.

### 2.4 Por que não é o defeito da ESPEC 033

A ESPEC 033 tratou de **grade errada** — uma linha lida com as divisórias de uma tabela vizinha, o
que faz colunas legítimas saírem fundidas ou cortadas. Aqui a grade está certa: a mesma geometria lê
corretamente a linha do período `9`, duas linhas acima, na mesma tabela. O defeito é de **conteúdo**,
não de geometria — o texto da célula é prosa de negócio, não um número mal cortado.

## 3. Objetivo

Que uma linha de item com período que não parseia como número **não impeça a geração do relatório**,
e que a informação não se perca — ela deve ficar visível para quem confere, do mesmo jeito que os
demais achados `AVISA` já ficam.

**Não é objetivo:** interpretar "N meses e M dias" como fração de mês (`D-01`); mudar o crivo de
admissão de geometria; mudar a severidade de `preço`, `quantidade` ou `total`, que continuam
bloqueantes.

## 4. Escopo

### 4.1 Dentro do escopo

- `_montar_item` deixa de exigir `meses` no conjunto de campos bloqueantes;
- `ContractItem.meses` passa a aceitar ausência, preservando o texto original da célula quando o
  número não parseia;
- uma validação nova, na família `V-CTR-*`, avisando — sem bloquear — quando isso ocorre;
- uma fixture que reproduza o caso (`I-01`).

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Parser que entenda "N meses e M dias" como número fracionário | `D-01` — o próprio contrato já resolve período quebrado abrindo outra linha; inventar uma fração de mês seria semântica que o negócio não usa, e para serviços mensais `meses` **multiplica** — um valor fracionário inventado entraria em conta que hoje está correta |
| Severidade de `preço unitário`, `quantidade`, `valor total` | Continuam sustentando o checksum de `V-CTR-03`; `D-04` mantém o bloqueio |
| O crivo de admissão de geometria (`_e_item_completo`) | Mesmo racional da ESPEC 033 `D-03`: mantê-lo intacto preserva a prova de que **quais** geometrias entram não muda |
| Exibir o período no `.docx` ou na API | `meses` não é servido a nenhum consumidor hoje (§2.2); adicioná-lo é entrega própria, fora desta espec |
| A leitura de linha sem faixa própria de oito divisórias, que cai no degrau `R-FXA-04` (ESPEC 033) | Fora do escopo — é o mecanismo que faz `14.023.00002.00` cair na geometria da tabela de preços (`I-04`). Corrigi-lo é assunto de spec própria |

## 5. Regras

| ID | Regra |
|---|---|
| `R-MES-01` | `_montar_item` não bloqueia mais por `meses` ausente. Célula cujo texto não parseia como `Decimal` produz o item com `meses=None` e `meses_bruto` guardando o texto original da célula |
| `R-MES-02` | `quantidade`, `preço unitário` e `valor total` continuam exigidos: ausência de qualquer um deles continua levantando `ExtractionError`, sem mudança de comportamento |
| `R-MES-03` | O crivo de admissão de geometria (`_e_item_completo`) **não muda** — continua exigindo as quatro colunas numéricas, incluindo `meses`, para aceitar uma geometria candidata |
| `R-MES-04` | Nova validação `V-CTR-07`, severidade `AVISA`: para cada item com `meses is None`, registra código, página e o texto bruto da célula, convidando conferência manual |
| `R-MES-05` | **Invariante de não-regressão:** nos dez documentos do corpus que hoje extraem sem erro, nenhuma tupla de item muda — nenhum deles exercita célula de `meses` não numérica |

### 5.1 Validações

`V-CTR-07` entra em [contract_validations.py](../../backend/src/infrastructure/validations/contract_validations.py),
no molde de `V-CTR-06`: percorre `contrato.itens`, filtra `meses is None`, e registra:

```
código {codigo} (página {pagina}): o período não foi lido como número de meses
— texto extraído: '{meses_bruto}'. Confira manualmente se o período está correto
no relatório
```

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **Não ensinar o parser a interpretar "N meses e M dias"** | Inventaria uma semântica fracionária de mês que o negócio não usa (§4.2) e que, se algum dia `meses` passar a multiplicar em serviço mensal, produziria número errado em vez de célula recusada — pior que o bloqueio de hoje |
| `D-02` | **`meses` vira `int \| None`, não `str`** | Preserva o contrato de tipo para o caso comum — que continua sendo a maioria das linhas, e é `int` limpo hoje em todos os dez documentos do corpus. Trocar para `str` mudaria a semântica do campo para todo consumidor futuro, não só para o caso de borda |
| `D-03` | **`meses_bruto` guarda o texto original** | Sem ele, o aviso da `R-MES-04` diria apenas "não é número" — a pessoa que confere teria de abrir o PDF de novo para saber o que a célula dizia. Custa um campo opcional; evita uma releitura manual |
| `D-04` | **Severidade `AVISA`, não bloqueio, e é decisão restrita a este campo** | `meses` não sustenta o checksum de `V-CTR-03` (§2.2) — bloquear por ele é desproporcional ao seu uso real. `preço`, `quantidade` e `total` continuam bloqueantes porque *esses* sustentam a prova de integridade |
| `D-05` | **O crivo de admissão de geometria não muda** | Mesmo racional da ESPEC 033 `D-03`: a admissão continua respondendo à pergunta de hoje, do jeito de hoje. Isso mantém intacta a medição que a ESPEC 019 `D-05` fez sobre o crivo — nenhuma geometria nova passa a ser aceita por este trabalho |

## 7. O que muda no código

| Arquivo | Mudança |
|---|---|
| `domain/entities/contract_item.py` | `meses: int` → `meses: int \| None`; campo novo `meses_bruto: str \| None = None` |
| `infrastructure/contract/pdfplumber_extractor.py` | `_montar_item`: `meses` sai do conjunto `faltando`; quando `para_decimal(celulas[COL_MESES])` é `None`, monta o item com `meses=None, meses_bruto=_limpar(celulas[COL_MESES])`. `_e_item_completo` **não muda** (`R-MES-03`) |
| `infrastructure/validations/contract_validations.py` | `v_ctr_07_periodo_nao_numerico`, no molde de `v_ctr_06_cauda_sem_linha_anterior` |
| `tests/fixtures/` | Fixture nova reproduzindo a célula "N meses e M dias" — pendente do PDF real ou de um equivalente sintético (`I-01`) |
| `application/`, `api/`, `frontend/` | **Nenhuma.** `meses` não é servido a nenhum consumidor hoje (§2.2) |

## 8. Testes e critério de aceite

### 8.1 As regras

| Regra | Verificação |
|---|---|
| `R-MES-01` | Linha com `PERÍODO = '2 meses e 14 dias'` não levanta `ExtractionError`; o item resultante tem `meses=None` e `meses_bruto='2 meses e 14 dias'` |
| `R-MES-02` | Fixture com `preço`, `quantidade` ou `total` ausente continua levantando `ExtractionError` — teste existente, não deve mudar de resultado |
| `R-MES-03` | A lista de geometrias admitidas, documento a documento, é idêntica à de antes desta mudança (mesma tabela que a ESPEC 033 §8.1 usa para `R-FXA-06`) |
| `R-MES-04` | `V-CTR-07` dispara com o código, a página e o texto bruto corretos; **não** dispara nos dez documentos do corpus |
| `R-MES-05` | §8.2 |

### 8.2 Regressão

Mesma técnica da ESPEC 033 §8.2: `sha256` da lista de tuplas de item de cada um dos dez documentos do
corpus, antes e depois. Nenhum deve se mover — nenhum exercita célula de `meses` não numérica hoje.

### 8.3 Critério de aceite

1. Nenhum `sha` do corpus se move;
2. a fixture nova extrai sem `ExtractionError`, com `V-CTR-07` registrado;
3. `preço`, `quantidade` e `total` ausentes continuam bloqueando, sem exceção;
4. a lista de geometrias admitidas por documento não muda (`R-MES-03`).

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Retirar `meses` do bloqueio esconder célula genuinamente truncada | Só o **texto** de `meses` deixa de bloquear; `quantidade`, `preço` e `total` — os campos que uma célula fundida tende a corromper junto (ESPEC 033 §2.4) — continuam recusando a linha inteira |
| `V-CTR-07` nunca ser lida por não estar em destaque na tela | Fora do escopo backend desta espec; o bloco de avisos já existe e a ESPEC 038 trata de onde ele aparece — esta espec só adiciona um achado à mesma fila |
| A fixture nova ser construída sem o PDF real e divergir do caso reportado | `I-01` — pendência declarada, não presunção |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | **Resolvido.** O PDF real já está no repositório (`docs/documentos/CGM/PC-CGM-240603-82 v3.0.pdf`); falta promovê-lo a fixture — ver PLANO 040 | Não |
| `I-02` | Vale, no futuro, exibir `meses_bruto` no `.docx` quando presente? | Não. `meses` não aparece no relatório hoje; seria entrega nova, não desta espec |
| `I-03` | Outros campos hoje bloqueantes (`preço`, `quantidade`, `total`) têm o mesmo padrão de conteúdo em prosa em algum documento do corpus? | Não. Não medido nesta espec — os três continuam bloqueantes por decisão (`D-04`), independente da resposta |
| `I-04` | Descoberto no planejamento (§2.3): `14.023.00002.00`, mesma página, falha por um defeito independente — linha sem faixa própria de oito divisórias lida pela geometria da tabela de preços via `R-FXA-04`. Impede que `PC-CGM-240603-82` gere relatório completo mesmo após esta correção | Não bloqueia esta espec; bloqueia o documento real ficar 100% verde — merece investigação própria |

## 11. Relação com a ESPEC 033

As duas nascem do mesmo tipo de origem — submissão real, mesma forma de mensagem
(`ExtractionError: item ... sem <campo> — extração incompleta`) — e ambas preservam o mesmo invariante
central: nenhuma tupla de item dos dez documentos do corpus se move. Mas são defeitos de classes
diferentes: a 033 corrigiu **onde** a grade lê (geometria emprestada de tabela vizinha); esta corrige
**o que fazer** quando o conteúdo de uma célula não numérica é legítimo, mas o campo que a recebe está
tipado para exigir número — e o campo em questão nunca é consumido (§2.2), o que a 033 não tinha: lá,
os quatro campos ausentes eram todos consumidos pelo checksum.

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | `ContractItem.meses_bruto` e o ajuste de `_montar_item` | PP |
| B | `V-CTR-07` e seu teste | PP |
| C | Fixture nova, pendente de `I-01` | P — ou maior, se depender de construir um PDF sintético do zero |
| D | Suíte completa e conferência de `sha` do corpus | PP |

**Estimativa: menos de meio dia**, uma vez resolvido `I-01`.

## 13. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-09-03 | Redação inicial, a partir da submissão real com o item `10.050.00001.00` e da análise de que o campo bloqueante (`meses`) não é consumido em lugar nenhum do backend (§2.2) |
| 1.2 | 2026-09-03 | Revisão de código pós-implementação achou dois defeitos: `v_ctr_07_periodo_nao_numerico` não era chamada por `container.py` — existia e passava isolada, mas nenhum relatório gerado em produção emitia o aviso; e `meses_bruto` saía `''` em vez de `None` quando a célula estava vazia (não em prosa), tornando a mensagem do aviso vazia nesse caso. Os dois corrigidos, com um teste novo que roda o `DIContainer` real (`_ContainerComFontesEmCache`, o mesmo mecanismo de `test_v_ctr_05_dispara_pelo_container_com_medicao_lida`) — é o que prova a ligação, e não só a validação isolada |
