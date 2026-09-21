# PLANO 045 — Implementação de "A ordem que não era regra"

| | |
|---|---|
| **Especificação** | [ESPEC 045](../specs/045-a-ordem-que-nao-era-regra.md) v1.0 |
| **Versão** | 1.0 — 2026-09-08 — **executado** em 2026-09-08. Todos os portões fechados na primeira passagem de cada fase; um bug pego no portão `P1` (`meses_bruto` ainda lendo `COL_MESES` fixo) foi corrigido dentro da própria F2, antes do portão fechar — ver TASKS 045 §12 |
| **Backlog** | [TASKS 045](../tasks/045-tasks-a-ordem-que-nao-era-regra.md) — numeração continua de `T-2670`, a última em uso (ESPEC 044) |
| **Estado inicial** | Árvore de `backend/` carrega as ESPECs 043/044 implementadas, **ainda não commitadas** — `README.md`, `contract_validations.py`, `measurement_validations.py` e `docs/CHANGELOG.md` modificados. `grid.py`, `pdfplumber_extractor.py`, `contract.py`, `contract_item.py` e `container.py` estão **limpos**, intocados por elas. **1.575 testes coletados** (`python -m pytest --collect-only -q`) |
| **Colisão conhecida** | `contract_validations.py` já foi tocado pelas ESPECs 043/044 (conversão de `registrar()` para `registrar_em_partes()` em sete validações). Este plano acrescenta uma função nova, `v_ctr_08_...`, ao final do arquivo — sem tocar nenhuma linha das sete já convertidas. Confirmado por leitura: `v_ctr_04` (linha 503), `v_ctr_06` (541) e `v_ctr_07` (574) mantêm as posições citadas na ESPEC 045 |
| **Instrumento existente** | **A medição inteira já está na ESPEC 045 §2** — o vocabulário de rótulo, o rastreamento de papel por linha contra os nove documentos do corpus e contra `PA-CGM-250912-127 v4.0.pdf`, e o protótipo de extração completa (27 itens, checksum fechando em `R$ 6.110.655,79`). A `F0`/`F1` **reproduzem**, não descobrem |

---

## 1. O que este plano tem de diferente

> **O oráculo é triplo.** (1) `aditivo_cgm.pdf` extrai 27 itens sem `ExtractionError`, com `14.049.00038.00` e afins lendo quantidade/preço **não invertidos**. (2) A soma dos totais fecha contra o total declarado — `R$ 6.110.655,79` — logo `V-CTR-03` não bloqueia. (3) A régua dos nove documentos do corpus (`test_extractor_aditivo_smul.py::REGUA` e as demais suítes que fixam `sha`/contagem de item) continua idêntica, porque `R-COL-08` já mediu que nenhum deles exercita um papel não canônico.

> **`V-CTR-08` precisa aparecer pelo pipeline real, não só isolada.** A ESPEC 040 §13 achou, numa revisão pós-implementação, uma validação que existia, passava sozinha, e nunca rodava em produção porque `container.py` não a chamava. Este plano paga essa lição adiantado: o portão `P2` (§2) exige um teste que exercita o `DIContainer` real, no molde do que a ESPEC 040 acrescentou depois.

> **Não é objetivo generalizar para outras colunas.** Código, descrição, unidade e total continuam em posição fixa (`D-06` da ESPEC). Se alguém, no calor da entrega, "aproveitar" para tornar todas as sete colunas dinâmicas, está fora do escopo aprovado.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Testes novos escritos, reprovando pelo motivo certo** | Fim da F1 | Os testes unitários de `grid.py` reprovam por `ImportError`/`AttributeError` (as funções ainda não existem); os testes de integração sobre `aditivo_cgm.pdf` reprovam com o `ExtractionError` de sempre; a régua do corpus já passa | Reprovação por motivo diferente do esperado é sinal de que a árvore não está no estado que o plano presume |
| **P1 — `R-COL-01` a `R-COL-06` implementadas; `aditivo_cgm.pdf` extrai limpo; a régua intacta** | Fim da F2 | `aditivo_cgm.pdf`: 27 itens, zero erro, soma `R$ 6.110.655,79`. Os nove `sha`/contagens do corpus idênticos | Reverter a F2 |
| **P2 — `V-CTR-08` visível pelo pipeline real** | Fim da F3 | `V-CTR-08` dispara para `aditivo_cgm.pdf` via `DIContainer` completo (não só a função isolada); não dispara para nenhum dos nove documentos do corpus | Reverter a F3; suspeitar primeiro do wiring em `container.py` (ESPEC 040 §13) |
| **P3 — O conjunto** | Fim da F4 | Suíte de backend verde, `1.575 → 1.575 + N`; `ruff`/`mypy` limpos; nenhuma âncora de documento reancorada | Não entregar |

---

## 3. Fases

### F0 — Preparação

**Objetivo:** trazer a fixture e conferir, nesta árvore, os números que a ESPEC já mediu.

| # | Tarefa | Ref. |
|---|---|---|
| T-2671 | Copiar `docs/documentos/CGM/PA-CGM- 250912-127 v4.0.pdf` para `backend/tests/fixtures/aditivo_cgm.pdf` | ESPEC `I-01` |
| T-2672 | Reproduzir, nos nove documentos de `fixtures/`, que nenhum registra troca de papel (ESPEC §2.4) — linha de base | `R-COL-08` |
| T-2673 | Reproduzir, com `aditivo_cgm.pdf`, o `ExtractionError` original — prova de que o defeito segue presente nesta árvore, antes de qualquer código | — |

**Verificação:** P0 (preparação). **Tamanho:** PP — quinze minutos.

---

### F1 — Os testes, escritos antes `[portão P0]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2674 | Testes unitários de `classificar_rotulo_de_coluna` (a escrever em `grid.py`): vocabulário `PREÇO`/`UNITÁRIO`, `QTDE`/`QUANTIDADE`, `PERÍODO`/`MÊS`/`MESES`, e texto fora da lista → `None`. Dados sintéticos, sem abrir PDF | `R-COL-02` |
| T-2675 | Testes unitários de `resolver_papel_das_colunas`: pendentes com as três colunas resolvendo a papéis distintos → mapeamento; incompleto, ambíguo ou com papel repetido → `None`. Casos de §2.2/§2.4 da ESPEC, sintéticos | `R-COL-04` |
| T-2676 | Módulo novo `tests/test_ordem_alternativa_de_colunas.py`, integração sobre `aditivo_cgm.pdf`: `14.049.00038.00` com `quantidade=1`/`preco_unitario=Decimal('3129.89')` (não invertidos); `14.049.00039.00` sem `ExtractionError`, com `meses=None` e `meses_bruto` preenchido; o papel volta ao canônico em `15.069.00001.00` (seção 5.1); soma dos totais igual a `Decimal('6110655.79')` | `R-COL-01` a `R-COL-06` |
| T-2677 | **[portão]** Rodar contra o `HEAD`: `T-2674`/`T-2675` reprovam por `ImportError`/`AttributeError`; `T-2676` reprova com o `ExtractionError` de sempre no `14.049.00039.00`. A régua da `T-2672` já passa | **P0** |

**Verificação:** P0. **Tamanho:** P — quarenta minutos.

---

### F2 — `R-COL-01` a `R-COL-06` `[portão P1]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2678 | `grid.py`: `classificar_rotulo_de_coluna(texto: str) -> str \| None` e `resolver_papel_das_colunas(pendentes: dict[int, list[str]]) -> dict[str, int] \| None` — funções puras, no molde de `_escolher_gabarito`/`_faixa_mais_estreita` | `R-COL-02`, `R-COL-04` |
| T-2679 | `pdfplumber_extractor.py::extrair`: papel ativo por geometria (`dict[tuple[float, ...], dict[str, int]]`, inicializado ao canônico) e buffer de pendentes por geometria, atualizados no laço existente (linhas 304-336) — acumula nas linhas que não são item, resolve e limpa nas que são | `R-COL-01`, `R-COL-03`, `R-COL-05` |
| T-2680 | `_montar_item` ganha o parâmetro `papel: dict[str, int]`, usado no lugar de `COL_PRECO`/`COL_QUANTIDADE`/`COL_MESES` para os três campos correspondentes. `código`, `descrição`, `unidade` e `total` continuam fixos | `R-COL-06`, `D-06` |
| T-2681 | `domain/entities/contract.py::DiagnosticoDaGrade` ganha `ordem_de_colunas_alternativa: tuple[tuple[int, str], ...] = ()`, no molde de `palavras_descartadas` — preenchido pelo extrator a cada troca de papel observada | — |
| T-2682 | **[portão]** `T-2674`/`T-2675`/`T-2676` inteiro verdes. Régua da `T-2672` idêntica. Checksum de `aditivo_cgm.pdf` fecha: 27 itens, soma `R$ 6.110.655,79` | **P1** |

**Verificação:** P1. **Tamanho:** PP — uma hora.

---

### F3 — `V-CTR-08` `[portão P2]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2683 | `contract_validations.py`: `v_ctr_08_ordem_alternativa_de_colunas`, no molde de `v_ctr_04_geometria_nao_canonica` — percorre `contrato.diagnostico.ordem_de_colunas_alternativa`, registra `AVISA` por `registrar_em_partes` | `R-COL-07` |
| T-2684 | Teste dedicado da validação isolada: dispara com um `Contract` construído à mão com `ordem_de_colunas_alternativa` não vazio; não dispara com vazio | `R-COL-07` |
| T-2685 | `infrastructure/di/container.py`: registra `v_ctr_08_ordem_alternativa_de_colunas` ao lado de `v_ctr_06`/`v_ctr_07`, para a proposta e para cada aditivo | `D-05` |
| T-2686 | Teste que exercita o `DIContainer` real com `aditivo_cgm.pdf` (mesmo mecanismo da ESPEC 040 §13 — `_ContainerComFontesEmCache` ou equivalente), confirmando que `V-CTR-08` chega ao relatório pelo pipeline completo, não só isolada | `D-05` |
| T-2687 | **[portão]** `V-CTR-08` dispara para `aditivo_cgm.pdf` via pipeline completo; não dispara para nenhum dos nove documentos do corpus | **P2** |

**Verificação:** P2. **Tamanho:** P — quarenta minutos.

---

### F4 — Fechamento `[portão P3]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2688 | Suíte de backend completa, `1.575 → 1.575 + N` | **P3** |
| T-2689 | `ruff check` / `mypy src/` nos arquivos tocados | **P3** |
| T-2690 | Status da ESPEC 045 (Proposta → Implementada, números medidos, `I-01`/`I-02`/`I-03` fechados ou mantidos abertos conforme o caso), `docs/CHANGELOG.md`, `README.md` | — |
| T-2691 | `git diff --stat backend/`: `grid.py`, `pdfplumber_extractor.py`, `contract.py`, `contract_validations.py`, `container.py`, os dois módulos de teste novos, mais a fixture `aditivo_cgm.pdf`. Nada em `contract_item.py`, `docx_renderer.py`, `report.py`, *schema* de API ou frontend | **P3** |

**Verificação:** P3. **Tamanho:** PP — trinta minutos, mais o tempo da suíte.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3 ──► F4
       P0     P1     P2     P3
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~3h, mais três execuções de suíte |

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| Mover um item nos nove documentos que já extraem | `T-2672`/`T-2682`, a régua do corpus |
| Resolver o papel uma vez por geometria (documento inteiro), em vez de por trecho do fluxo de linhas | `T-2676` — o caso do item `15.069.00001.00`, que exige o papel voltar ao canônico depois de "5.4 Data Center", **na mesma geometria** (`D-01` da ESPEC) |
| Resetar o papel para o canônico a cada linha sem cabeçalho, em vez de manter o que já valia | `T-2676` — os dezenove itens de "5.4" que não repetem o cabeçalho, incluindo a virada de página 3→4 (`D-04`) |
| `V-CTR-08` existir e nunca ser chamada em produção (repetir o defeito da ESPEC 040 §13) | `T-2686`, o portão `P2` exige o `DIContainer` real, não a função isolada |
| Vocabulário de rótulo casar com prosa fora das colunas 3-5 | `T-2674`/`T-2675` cobrem o caso medido ("quantidade contratada" em prosa, ESPEC §2.4) como não-casamento |
| Tentar generalizar a leitura para código/descrição/unidade/total | Fora do escopo aprovado (`D-06`) — não há tarefa para isso neste plano |

---

## 6. O que este plano não faz

- **Não interpreta `"N meses e M dias"`** como fração de mês — já resolvido pela ESPEC 040 (`D-01`), fora de escopo.
- **Não toca a descoberta de geometria nem o crivo de admissão** (`_e_item_completo`, `_geometrias_de_itens`).
- **Não muda `R-FXA-*`** (ESPECs 033/041) — a leitura por faixa é consumida como está.
- **Não generaliza para código, descrição, unidade ou total** — só as três colunas numéricas centrais ganham papel dinâmico.

---

## 7. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| F0 | Fixture e linha de base | PP |
| F1 | Testes escritos antes | P |
| F2 | `grid.py` + `pdfplumber_extractor.py` + `contract.py` | PP |
| F3 | `V-CTR-08` + wiring no container | P |
| F4 | Fechamento | PP |

**Total: ~3h.** A medição já paga na ESPEC 045 — inclusive o checksum fechando no documento real — é o que torna esta entrega previsível.
