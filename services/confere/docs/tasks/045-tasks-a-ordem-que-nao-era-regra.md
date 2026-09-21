# TASKS 045 — Backlog de "A ordem que não era regra"

| | |
|---|---|
| **Especificação** | [ESPEC 045](../specs/045-a-ordem-que-nao-era-regra.md) v1.0 |
| **Plano** | [PLANO 045](../plans/045-plano-a-ordem-que-nao-era-regra.md) v1.0 |
| **Versão** | 1.0 — 2026-09-08 |
| **Total** | 21 tarefas · 4 portões · 3 insumos herdados da ESPEC |
| **Status** | **Concluído** — 2026-09-08. Portões `P0` a `P3` fechados. Backend **1.575 → 1.601 passed**, zero falhas reais — uma reprovação de `test_desempenho.py` (área não tocada) foi ruído de carga sob a suíte completa, confirmada isolada. `ruff`/`mypy` limpos. Nenhuma fase revertida — um bug corrigido dentro da própria `F2`, antes do portão `P1` fechar (§12) |

> **Cinco arquivos de produção.** `grid.py`, `pdfplumber_extractor.py`, `contract.py`, `contract_validations.py`
> e `container.py`. Nenhum outro — nem `contract_item.py`, que já tem `meses_bruto` desde a ESPEC 040 e
> não precisa de campo novo.

---

## 1. Convenções

**Identificadores** `T-26nn`/`T-27nn`, continuando de `T-2670`, a última em uso (ESPEC 044).

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`python -m pytest` verde — **não** `uv run pytest`, que quebra a coleta do backend nesta árvore.
Medido antes de começar: árvore com as ESPECs 043/044 já implementadas, ainda não commitadas;
`grid.py`/`pdfplumber_extractor.py`/`contract.py`/`container.py` limpos; **1.575 testes coletados**.

**Convenção de commit** `<tipo>(T-26nn): descrição`. `test(...)` para `E0`/`E1`; `fix(...)`/`feat(...)`
para `E2`/`E3`; `docs(...)` para `E4`.

### 1.1 Quatro regras que atravessam este backlog

**1 — O papel é resolvido por trecho do fluxo de linhas, não uma vez por geometria nem por documento.**
Medido na ESPEC §2.4: a mesma geometria hospeda "5.2"/"5.3" (canônico), "5.4" (invertido) e "5.1"
(canônico de novo) no mesmo `PA-CGM-250912-127 v4.0`. Resolver uma vez por geometria aplicaria a ordem
errada a pelo menos uma dessas seções.

*O sinal no diff:* uma função que resolve o papel a partir da geometria sozinha, sem receber o estado
acumulado das linhas já lidas.

**2 — Sem cabeçalho novo, o papel ativo anterior continua valendo — não reseta para o canônico.**
Medido: dezenove linhas de "5.4" não repetem o cabeçalho, inclusive atravessando a virada de página
3→4. Resetar a cada linha sem cabeçalho quebraria exatamente as linhas que esta espec existe para
consertar.

*O sinal no diff:* o papel voltando ao valor de `R-COL-05` (canônico) em toda linha que não resolveu
um cabeçalho novo, em vez de manter o que já valia.

**3 — `código`, `descrição`, `unidade` e `total` continuam fixos.** Nenhum documento medido — nos nove
do corpus nem no `PA-CGM-250912-127 v4.0` — move essas quatro colunas. Só `preço`, `quantidade` e
`período` ganham papel dinâmico.

*O sinal no diff:* qualquer leitura de `celulas[0]`, `celulas[1]`, `celulas[2]` ou `celulas[6]` por
um índice que não seja literal.

**4 — `V-CTR-08` só está pronta quando aparece pelo `DIContainer` real.** A ESPEC 040 §13 achou uma
validação que existia, passava isolada, e nunca rodava em produção por falta de wiring em
`container.py`. O portão `P2` (`T-2687`) exige o teste de pipeline completo — não é opcional nem
tarefa de limpeza posterior.

*O sinal no diff:* uma validação nova em `contract_validations.py` sem a chamada correspondente em
`container.py`, ou com a chamada mas sem teste que passe pelo `DIContainer`.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** Preparação | T-2671 … T-2673 | — | F0 |
| **E1** Os testes, escritos antes | T-2674 … T-2677 | **P0** | F1 |
| **E2** `R-COL-01` a `R-COL-06` | T-2678 … T-2682 | **P1** | F2 |
| **E3** `V-CTR-08` | T-2683 … T-2687 | **P2** | F3 |
| **E4** Fechamento | T-2688 … T-2691 | **P3** | F4 |

### 2.1 A régua da entrega — o que muda

| Muda | Não muda |
|---|---|
| `grid.py` ganha `classificar_rotulo_de_coluna` e `resolver_papel_das_colunas` | `montar_grade`, `ler_celulas`, `verticais_por_linha` — nenhuma linha |
| `extrair` mantém papel ativo + pendentes por geometria; `_montar_item` recebe `papel` | A descoberta de geometria (`R-GRD-02` a `R-GRD-04`) e o crivo de admissão (`_e_item_completo`) |
| `DiagnosticoDaGrade` ganha `ordem_de_colunas_alternativa` | `ContractItem` — nenhum campo novo, `meses_bruto` já existe (ESPEC 040) |
| `V-CTR-08` nova, registrada no `container.py` | `V-CTR-03` continua o oráculo de integridade; `V-CTR-04`/`06`/`07` intactas |
| `14.049.00039.00` extrai sem erro; `14.049.00038.00`/`048`/`049` deixam de trocar preço por quantidade | Os nove documentos do corpus — nenhuma tupla de item se move |
| Status da ESPEC 045, `docs/CHANGELOG.md`, `README.md` | `docx_renderer.py`, `report.py`, *schema* de API, frontend — nenhuma linha |

---

## 3. Épico E0 — Preparação

#### T-2671 — Fixture `aditivo_cgm.pdf`
**Tamanho:** PP · **Ref:** ESPEC `I-01`

Copiar `docs/documentos/CGM/PA-CGM- 250912-127 v4.0.pdf` para `backend/tests/fixtures/aditivo_cgm.pdf`,
byte a byte — o mesmo arquivo real que gerou a submissão original.

**Pronto quando:** o arquivo está em `fixtures/`, `sha256` conferido contra o original em
`docs/documentos/CGM/`.

---

#### T-2672 — Linha de base: nenhuma troca de papel no corpus
**Tamanho:** PP · **Ref:** `R-COL-08`

Reproduzir, para os nove documentos de `fixtures/` (excluindo o `aditivo_cgm.pdf` recém-chegado), a
medição da ESPEC §2.4: zero trocas de papel registradas.

**Pronto quando:** os nove batem com a ESPEC, sem ajuste.

---

#### T-2673 — Reprodução do defeito original
**Tamanho:** PP

Rodar o extrator de hoje (sem nenhuma linha desta entrega) contra `aditivo_cgm.pdf`: confirma o
`ExtractionError` em `14.049.00039.00 (página 4) sem quantidade`.

**Pronto quando:** o erro reproduz, idêntico ao da submissão real.

---

## 4. Épico E1 — Os testes, escritos antes `[portão P0]`

#### T-2674 — `classificar_rotulo_de_coluna`, testado antes de existir
**Tamanho:** P · **Ref:** `R-COL-02`

Casos: `"PREÇO UNITÁRIO (R$)"` → `"preco"`; `"Unitário"` → `"preco"`; `"QTDE"` → `"quantidade"`;
`"Quantidade Contratado"` → `"quantidade"`; `"PERIODO (MÊS)"` → `"meses"`; `"Período Mês"` → `"meses"`;
`"limitação de banda na quantidade contratada"` (a frase de prosa medida na ESPEC §2.4, para provar que
o crivo é sobre texto de **célula de cabeçalho**, isolado — a função em si não sabe de coluna, isso é
responsabilidade de quem monta o texto que ela recebe) → ainda classifica como `"quantidade"` **se**
receber só esse texto, o que é esperado; a guarda contra o falso positivo é o roteamento por coluna em
`R-COL-03`, testado em `T-2676`, não aqui; `"TOTAL (R$)"` → `None`.

**Pronto quando:** escrito, reprovando por `ImportError` — a função ainda não existe.

---

#### T-2675 — `resolver_papel_das_colunas`, testado antes de existir
**Tamanho:** P · **Ref:** `R-COL-04`

Casos sintéticos (`dict[int, list[str]]` como entrada, sem PDF): as três colunas resolvendo a papéis
distintos → mapeamento completo; uma coluna vazia ou sem rótulo reconhecido → `None`; duas colunas
casando o mesmo papel (rótulo ambíguo/repetido) → `None`; papel repetido em índice diferente → `None`.

**Pronto quando:** escrito, reprovando por `ImportError`.

---

#### T-2676 — `tests/test_ordem_alternativa_de_colunas.py`
**Tamanho:** P · **Ref:** `R-COL-01` a `R-COL-06`

Integração sobre `aditivo_cgm.pdf` real:

- `14.049.00038.00`: `quantidade == Decimal('1')`, `preco_unitario == Decimal('3129.89')` — não
  invertidos (hoje sairiam `12` e `1`);
- `14.049.00039.00` (duas ocorrências): sem `ExtractionError`; `meses is None`;
  `meses_bruto` igual a `'2 meses e 16 dias'` e `'9meses e 14 dias'`, respectivamente;
- `15.069.00001.00`: `quantidade == Decimal('1')`, `preco_unitario == Decimal('9976.84')` — o papel
  voltou ao canônico depois de "5.4 Data Center" (prova de `D-01`);
- soma de `total_declarado` de todos os itens: `Decimal('6110655.79')`;
- os nove documentos de `T-2672`: nenhum move a régua (reaproveita a medição, não recalcula do zero).

**Pronto quando:** escrito, reprovando com o `ExtractionError` de sempre no `14.049.00039.00`.

---

#### T-2677 — O portão `[portão]`
**Tamanho:** PP · **Portão P0**

Contra o `HEAD`: `T-2674`/`T-2675` reprovam por `ImportError` (as funções não existem);
`T-2676` reprova com `ExtractionError: item 14.049.00039.00 (página 4) sem quantidade`. A régua da
`T-2672` já passa.

**Pronto quando:** a tabela de reprovações bate com o motivo esperado — e bateu.

---

## 5. Épico E2 — `R-COL-01` a `R-COL-06` `[portão P1]`

#### T-2678 — As duas funções puras em `grid.py`
**Tamanho:** PP · **Ref:** `R-COL-02`, `R-COL-04`

```python
_ROTULO_PRECO = re.compile(r"PRE[ÇC]O|UNIT[ÁA]RIO", re.I)
_ROTULO_QUANTIDADE = re.compile(r"QTDE|QUANTIDADE", re.I)
_ROTULO_PERIODO = re.compile(r"PER[ÍI]ODO|M[ÊE]S", re.I)

def classificar_rotulo_de_coluna(texto: str) -> str | None: ...
def resolver_papel_das_colunas(pendentes: dict[int, list[str]]) -> dict[str, int] | None: ...
```

Sem abrir PDF, sem depender de `pdfplumber` — mesmo padrão de `_escolher_gabarito`/`_faixa_mais_estreita`.

**Pronto quando:** `T-2674`/`T-2675` verdes.

---

#### T-2679 — Papel ativo e pendentes no laço de `extrair`
**Tamanho:** P · **Ref:** `R-COL-01`, `R-COL-03`, `R-COL-05`

`pdfplumber_extractor.py`, dentro de `extrair` (laço das linhas 304-336): um `dict` de papel ativo por
geometria (chave = tupla de divisórias, valor inicial = canônico) e um `dict` de pendentes por
geometria (colunas 3/4/5). Para cada `celulas` produzida: se **não** é linha de item, acumula o texto
de `celulas[3]`, `celulas[4]`, `celulas[5]` nos pendentes daquela geometria; se **é** linha de item,
tenta `resolver_papel_das_colunas` sobre os pendentes — resolvendo, atualiza o papel ativo — e limpa os
pendentes de qualquer forma, resolvendo ou não (`D-03`).

**Pronto quando:** compila, `mypy` sem acusar os pontos de chamada existentes.

---

#### T-2680 — `_montar_item` recebe o papel
**Tamanho:** PP · **Ref:** `R-COL-06`, `D-06`

Parâmetro novo `papel: dict[str, int]`. `quantidade = para_decimal(celulas[papel["quantidade"]])`,
`preco = para_decimal(celulas[papel["preco"]])`, `meses = para_decimal(celulas[papel["meses"]])` (esta
última já sob `R-MES-01`, sem bloquear). `codigo`, `descricao`, `unidade` e `total` continuam lidos por
índice literal (0, 1, 2, 6) — nenhuma mudança nessas quatro linhas.

**Pronto quando:** `T-2676` passa no item `14.049.00038.00` (não invertido) e no `14.049.00039.00`
(sem erro).

---

#### T-2681 — `DiagnosticoDaGrade.ordem_de_colunas_alternativa`
**Tamanho:** PP

Campo novo `ordem_de_colunas_alternativa: tuple[tuple[int, str], ...] = ()`, por último e com padrão
(mesmo motivo dos campos irmãos — dezenas de construções parciais na suíte). Preenchido pelo extrator a
cada troca de papel observada, com a página onde ocorreu e uma descrição legível da ordem lida (ex.:
`"quantidade, período, preço unitário"`).

**Pronto quando:** compila; `T-2676` consegue inspecionar o campo (mesmo que ainda sem teste dedicado —
isso é `E3`).

---

#### T-2682 — O portão `[portão]`
**Tamanho:** PP · **Portão P1**

`T-2674`, `T-2675`, `T-2676` inteiro verdes. Régua da `T-2672` idêntica. Checksum de
`aditivo_cgm.pdf`: 27 itens, soma `R$ 6.110.655,79`, sem `ExtractionError`.

**Achado que não estava previsto**: a primeira rodada de `T-2676` reprovou em
`test_t2676a_item_que_travava_extrai_sem_erro` — `meses_bruto` saía com o texto do preço
(`"R$ 4.659,23"`) em vez do período (`"2 meses e 16 dias"`). Causa: a linha que monta `meses_bruto`
em `_montar_item` ainda lia `celulas[COL_MESES]` fixo, não `celulas[papel["meses"]]` — a mesma classe
de defeito que esta espec inteira existe para corrigir, reintroduzida numa linha que `T-2680` não
tinha tocado por completo. Corrigido dentro da própria `F2`, antes de fechar o portão (§12).

**Pronto quando:** os três módulos verdes e a régua intacta — e ficaram, depois do ajuste acima.

---

## 6. Épico E3 — `V-CTR-08` `[portão P2]`

#### T-2683 — `v_ctr_08_ordem_alternativa_de_colunas`
**Tamanho:** PP · **Ref:** `R-COL-07`

`contract_validations.py`, no molde de `v_ctr_04_geometria_nao_canonica` (linha 503): percorre
`contrato.diagnostico.ordem_de_colunas_alternativa`, registra `AVISA` por `registrar_em_partes` (não
`registrar` — as ESPECs 043/044 já converteram as validações vizinhas para o formato em partes; esta
nasce já no formato novo).

**Pronto quando:** função escrita, sem chamada ainda em `container.py`.

---

#### T-2684 — Teste da validação isolada
**Tamanho:** PP · **Ref:** `R-COL-07`

`Contract` construído à mão com `diagnostico.ordem_de_colunas_alternativa` não vazio → dispara;
vazio (ou `diagnostico is None`) → não dispara.

**Pronto quando:** os dois casos verdes.

---

#### T-2685 — Wiring no `container.py`
**Tamanho:** PP · **Ref:** `D-05`

Ao lado de `v_ctr_06_cauda_sem_linha_anterior`/`v_ctr_07_periodo_nao_numerico`, para a proposta
(sob `if proposta.itens:`) e para cada aditivo (sob `if aditivo.itens:`).

**Pronto quando:** a chamada existe nos dois pontos, mesmo formato de guarda dos vizinhos.

---

#### T-2686 — Teste pelo `DIContainer` real
**Tamanho:** P · **Ref:** `D-05`

Mesmo mecanismo da ESPEC 040 §13 (`_ContainerComFontesEmCache` ou equivalente já presente na suíte):
roda o pipeline completo com `aditivo_cgm.pdf` e confirma que `V-CTR-08` aparece na lista de achados
que o relatório de fato usaria — não a função chamada isoladamente.

**Pronto quando:** verde, e reprova se `T-2685` for revertida (prova de que o teste realmente depende
do wiring).

---

#### T-2687 — O portão `[portão]`
**Tamanho:** PP · **Portão P2**

`V-CTR-08` dispara para `aditivo_cgm.pdf` pelo pipeline completo (`T-2686`); não dispara para nenhum
dos nove documentos do corpus (reaproveita a régua de `T-2672` — papel nunca diverge, logo
`ordem_de_colunas_alternativa` sempre vazio para eles).

**Pronto quando:** os dois lados confirmados — e confirmaram, de primeira, sem ajuste.

---

## 7. Épico E4 — Fechamento `[portão P3]`

#### T-2688 — Suíte completa
**Tamanho:** PP · **Portão P3**

`python -m pytest`: `1.575 → 1.601 passed` em 22min00. Uma reprovação — `test_desempenho.py::
test_o_custo_de_um_anexo_e_linear` (razão `2,73x` contra o teto `2,6x`) —, área não tocada por esta
entrega (custo de mesclagem de célula em anexo `.docx`). Isolado (`pytest
tests/test_desempenho.py::test_o_custo_de_um_anexo_e_linear`), **1 passed em 5,3s** — o mesmo padrão
de ruído de carga já documentado nas ESPECs 041/043 quando a suíte inteira roda em paralelo.

**Pronto quando:** verde, número reconciliado — e estava, contando a reprovação isolada como ruído.

---

#### T-2689 — Ferramentas
**Tamanho:** PP · **Portão P3**

`ruff check` e `mypy src/` nos arquivos tocados (`grid.py`, `pdfplumber_extractor.py`, `contract.py`,
`contract_validations.py`, `container.py`). Os dois limpos de primeira — nenhum ajuste de estilo
necessário.

**Pronto quando:** os dois limpos — e ficaram.

---

#### T-2690 — Documentos
**Tamanho:** PP

Status da ESPEC 045 (Proposta → Implementada, números medidos nesta execução, `I-01` fechado por
`T-2671`, `I-02` mantido aberto por natureza, `I-03` fechado pela medição real desta entrega —
substituindo a do protótipo isolado). Entrada nova em `docs/CHANGELOG.md`. Linha nova em `README.md`.
`PLANO 045` ganha a nota de "executado" na própria versão.

**Pronto quando:** os quatro documentos refletem o estado final — e refletem.

---

#### T-2691 — Nenhuma âncora de documento fora do previsto
**Tamanho:** PP · **Portão P3**

`git status --short`: `grid.py`, `pdfplumber_extractor.py`, `contract.py`, `contract_validations.py`,
`container.py`, `conftest.py` (a fixture nova de `caminho_aditivo_cgm`) modificados; `aditivo_cgm.pdf`,
`test_papel_das_colunas.py` e `test_ordem_alternativa_de_colunas.py` novos. Nada em
`contract_item.py`, `docx_renderer.py`, `report.py`, *schema* de API ou frontend — confirmado.
`measurement_validations.py`, `README.md`, `docs/CHANGELOG.md` também aparecem modificados, mas são
das ESPECs 043/044 (já assim antes desta entrega começar).

**Pronto quando:** o `diff` bate com essa lista — e bateu.

---

## 8. Rastreabilidade

| Regra | Tarefas |
|---|---|
| `R-COL-01` | T-2676, T-2679, T-2682 |
| `R-COL-02` | T-2674, T-2678 |
| `R-COL-03` | T-2679 |
| `R-COL-04` | T-2675, T-2678 |
| `R-COL-05` | T-2679 |
| `R-COL-06` | T-2680, T-2682 |
| `R-COL-07` | T-2683, T-2684, T-2687 |
| `R-COL-08` | T-2672, T-2676, T-2682, T-2687 |
| `D-01` | T-2676 (item `15.069.00001.00`, papel voltando ao canônico) |
| `D-03` | T-2679 (pendentes limpos sempre, resolvendo ou não) |
| `D-04` | T-2679 (papel ativo mantido sem cabeçalho novo) |
| `D-05` | T-2685, T-2686, T-2687 |
| `D-06` | T-2680 (código/descrição/unidade/total fixos) |

---

## 9. O que este backlog não faz

- **Não interpreta `"N meses e M dias"`** — já resolvido pela ESPEC 040, fora de escopo.
- **Não toca a descoberta de geometria nem o crivo de admissão** (`_e_item_completo`).
- **Não muda `R-FXA-*`** — a leitura por faixa é consumida como está.
- **Não generaliza a leitura de coluna** para código, descrição, unidade ou total.
- **Não commita nada por conta própria** — a árvore de trabalho segue como está; commit é decisão à
  parte do usuário.

---

## 10. Sequência e commits

```
E0 ──► E1 ──► E2 ──► E3 ──► E4
       P0     P1     P2     P3

E0  fixture + linha de base                     test(T-2671..673)
E1  testes escritos antes                       test(T-2674..677)
E2  grid.py + extractor.py + contract.py         feat(T-2678..682)
E3  V-CTR-08 + wiring                            feat(T-2683..687)
E4  fechamento                                   docs(T-2690)
```

---

## 11. Insumos em aberto (herdados da ESPEC)

| ID | Questão | Bloqueia? |
|---|---|---|
| `I-01` | `aditivo_cgm.pdf` não era fixture — fechado por `T-2671` | Não — resolvido no próprio backlog |
| `I-02` | Quantos outros contratos, ainda não vistos, declaram ordem de coluna diferente da canônica? | Não. `R-COL-01` a `R-COL-05` são gerais — não dependem de conhecer documentos futuros |
| `I-03` | O checksum fechar para `PA-CGM-250912-127 v4.0` foi medido em protótipo isolado — `T-2682`/`T-2688` confirmam de novo, dentro da árvore real | Não — é o próprio critério de aceite dos portões `P1`/`P3` |

---

## 12. O que a execução ensinou, escrevendo depois

**Um bug de roteamento apareceu na primeira rodada de `T-2676`, e é a mesma classe de defeito que
esta espec inteira existe para corrigir.** `_montar_item` foi editada em duas frentes por `T-2680`:
os três campos lidos do `papel` (`quantidade`, `preco`, `meses`) e a linha que monta `meses_bruto`
quando `meses` não parseia. A primeira frente foi atualizada; a segunda — `meses_bruto=None if meses
is not None else (_limpar(celulas[COL_MESES]) or None)` — continuou lendo `COL_MESES` fixo. O
sintoma: `14.049.00039.00` parava de estourar `ExtractionError` (porque `quantidade` e `preco` já
liam certo), mas `meses_bruto` saía com o texto da célula de **preço** (`"R$ 4.659,23"`), não do
período (`"2 meses e 16 dias"`) — um segundo campo trocado, mais sutil que o primeiro porque não
bloqueia nada, só produz um aviso (`V-CTR-07`) com o texto errado.

**O que pegou:** `test_t2676a_item_que_travava_extrai_sem_erro` (`T-2676`), que afirma
`meses_bruto == "2 meses e 16 dias"` explicitamente — não só "não é `None`". Um teste que checasse
apenas a ausência de erro teria deixado passar.

**Por que isso não invalida a medição da ESPEC.** O protótipo em memória que fundamentou a ESPEC 045
(§2.4/§2.5) não constrói `ContractItem` — ele lê `celulas[papel[...]]` diretamente para medir
quantidade/preço/total e o fechamento do checksum, sem passar por `_montar_item`. O checksum (que
soma `total_declarado`, não `meses`) fechava de qualquer forma; o defeito só existia no caminho de
produção, entre `T-2680` e `T-2682`, e a suíte de testes é exatamente o que existe para pegar essa
classe de lacuna antes de qualquer commit.

**Nenhuma fase foi revertida.** O ajuste coube dentro da própria `F2`, antes do portão `P1` fechar —
não foi preciso desfazer nenhuma tarefa já dada como pronta.

**A régua do corpus (`R-COL-08`) nunca precisou de ajuste.** Os nove documentos de `T-2672` bateram
exatos contra a baseline em toda rodada — `P0`, `P1`, `P2` e `P3` —, porque nenhum deles exercita
`meses_bruto` fora do `None` (o defeito só aparece com papel invertido **e** período em prosa, e só o
`aditivo_cgm.pdf` tem as duas coisas).
