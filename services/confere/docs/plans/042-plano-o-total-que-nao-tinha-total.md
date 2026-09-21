# PLANO 042 — Implementação de "O total que não tinha TOTAL:"

| | |
|---|---|
| **Especificação** | [ESPEC 042](../specs/042-o-total-que-nao-tinha-total.md) v1.0 |
| **Versão** | 1.0 — 2026-09-03 — **executado** em 2026-09-03. Backend fechou em 1.566 passed; um teste da ESPEC 041 precisou de ajuste (asserção que dependia do `I-01` ainda estar aberto) — não é desvio deste plano, é consequência esperada do sucesso dele |
| **Backlog** | TASKS 042, a escrever. Numeração continua de `T-2636`, a última em uso (ESPEC 041) |
| **Estado inicial** | Árvore de `backend/` carrega as ESPECs 040 e 041 **implementadas e testadas, ainda não commitadas** — `contract_item.py`, `grid.py`, `pdfplumber_extractor.py`, `container.py`, `contract_validations.py`, `conftest.py`, `contrato_cgm.pdf`, e os dois módulos de teste dessas entregas. 1.561 testes coletados |
| **Colisão conhecida** | `pdfplumber_extractor.py` já foi tocado pelas 040 e 041, em pontos diferentes (`_montar_item`, o laço principal). Este plano toca o mesmo arquivo, num terceiro ponto — o fim de `extrair()` — sem sobrepor nenhuma das duas |
| **Instrumento existente** | **A medição inteira já está na ESPEC 042 §2** — os dois valores reais (proposta e aditivo CGM, por extenso), a prova de que uma fonte só é perigosa (`aditivo_pgm.pdf`), e a prova de que a frase de prosa está ausente exatamente onde deveria estar. Nada a remedir: a `F0` reproduz |

---

## 1. O que este plano tem de diferente

> **O oráculo é a convergência de duas fontes, e o teste mais importante é o que prova que uma só não basta.** Não é suficiente `T-2640` afirmar que a frase de prosa dá o valor certo — precisa afirmar que, na ausência dela (o caso do `aditivo_pgm.pdf`), o `TOTAL` do cronograma **sozinho** não vira `total_declarado`. Sem esse teste, um `git blame` de daqui a um ano poderia "simplificar" a função para usar só uma fonte, e a supressão não teria como ser pega.

> **Não é objetivo o `PA-CGM-250912-127` (aditivo real) fechar como fixture de extração completa.** Ele tem outro defeito (`I-01`, ordem de colunas trocada) que impede a extração de chegar ao fim. A prova sobre aditivo usa os valores reais da ESPEC §2.1/§2.3 num caso construído — string, não PDF.

> **Custo extra só no caminho que já bloqueia.** A busca textual nova (`_total_por_convergencia`) só roda quando `total_declarado is None` ao fim do laço principal — os dez documentos que já funcionam nunca a alcançam, e o tempo de extração deles não muda.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Medição reproduzida, testes reprovando pelo motivo certo** | Fim da F1 | Os valores da ESPEC §2.1/§2.3 reproduzidos nesta árvore. Testes novos reprovam por a função ainda não existir; a régua dos dez documentos já passa | Investigar antes de codificar |
| **P1 — `R-TOT-01` a `R-TOT-03` implementadas; `contrato_cgm.pdf` fecha o checksum; a régua intacta** | Fim da F2 | `contrato_cgm.pdf`: `total_declarado == Decimal("5532203.96")`, `V-CTR-03` não bloqueia mais por "não localizado" nesta peça. Os dez `sha` do corpus idênticos | Reverter a F2 |
| **P2 — O conjunto** | Fim da F3 | Suíte de backend verde, `1.561 → 1.561 + N`; `ruff`/`mypy` limpos; nenhuma âncora de documento reancorada | Não entregar |

---

## 3. Fases

### F0 — Reprodução da medição

| # | Tarefa | Ref. |
|---|---|---|
| T-2637 | Reproduzir, sobre `contrato_cgm.pdf` (fixture) e sobre `docs/documentos/CGM/PA-CGM-250912-127 v4.0.pdf` (texto, fora da suíte), os dois valores da ESPEC §2.1: frase de prosa e linha `TOTAL` do cronograma, para as duas peças. Tem de bater exato: `5.532.203,96` e `6.110.655,79` | ESPEC §2.1 |
| T-2638 | Reconfirmar, sobre `aditivo_pgm.pdf`, que a frase de prosa **não existe** em lugar nenhum (§2.2/§2.3) | ESPEC §2.2, `D-01` |
| T-2639 | Régua de hoje dos dez documentos do corpus (`_medida()` de `test_extractor_aditivo_smul.py`) | `R-TOT-04` |

**Verificação:** P0 (primeira metade). **Tamanho:** PP.

---

### F1 — Os testes, escritos antes `[portão P0]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2640 | Módulo novo `tests/test_total_por_convergencia.py`. Casos construídos (string, sem PDF), com os valores reais medidos: (a) frase + linha concordando → o valor; (b) só a frase, sem a linha do cronograma → `None`; (c) só a linha, sem a frase → `None` — **este é o caso do `aditivo_pgm.pdf`, e é o teste mais importante do módulo**; (d) as duas existem e divergem → `None` | `R-TOT-01` a `R-TOT-03`, `D-01` |
| T-2641 | Teste de integração: `extrator.extrair(caminho_contrato_cgm)` → `total_declarado == Decimal("5532203.96")` | Critério de aceite da ESPEC |
| T-2642 | **[portão]** Rodar contra o `HEAD`: `T-2640` inteiro reprova (a função ainda não existe); `T-2641` reprova (`total_declarado` ainda `None`). Régua da `T-2639` já passa | **P0** |

**Verificação:** P0. **Tamanho:** P.

---

### F2 — `R-TOT-01` a `R-TOT-03` `[portão P1]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2643 | `pdfplumber_extractor.py` — duas expressões regulares (`_FRASE_TOTAL_EM_PROSA`, a linha `TOTAL` dentro de "CRONOGRAMA FÍSICO-FINANCEIRO") e a função privada `_total_por_convergencia`, que só devolve valor quando as duas concordam (tolerância `TOLERANCIA_CHECKSUM`, `0,01`) | `R-TOT-01` a `R-TOT-03`, `D-03` |
| T-2644 | Chamar a função ao fim de `extrair()`, só quando `total_declarado is None` depois do laço principal | `D-04` |
| T-2645 | **[portão]** `T-2640` e `T-2641` verdes. Régua dos dez documentos (`T-2639`) idêntica | **P1** |

**Verificação:** P1. **Tamanho:** PP.

---

### F3 — Fechamento `[portão P2]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2646 | Suíte de backend completa, `1.561 → 1.561 + N` | **P2** |
| T-2647 | `ruff`/`mypy` nos arquivos tocados | **P2** |
| T-2648 | Status da ESPEC 042 (Proposta → Implementada, números medidos, `I-01` mantido aberto), `docs/CHANGELOG.md`, `README.md` | — |
| T-2649 | `git diff --stat backend/`: só `pdfplumber_extractor.py` e o módulo de teste novo — nada nos arquivos já tocados pelas 040/041 | **P2** |

**Verificação:** P2. **Tamanho:** PP.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3
P0     P0     P1     P2
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~1h30, mais duas execuções de suíte |

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| Aceitar só uma fonte (simplificação "otimista") | `T-2640(c)` — o caso do `aditivo_pgm.pdf`, escrito antes do código |
| Mover um total nos dez documentos que já extraem | `T-2639`/`T-2645`, a régua de `sha` |
| Tentar fazer `PA-CGM-250912-127` extrair por completo nesta entrega | `I-01` — fora do escopo, declarado na ESPEC e neste plano |
| Rodar a busca textual em todo documento, não só quando `total_declarado is None` | `D-04` — custo extra teria que aparecer só no caminho que já bloqueia; `T-2646` mediria regressão de tempo se isso vazasse |

---

## 6. O que este plano não faz

- **Não corrige a ordem de colunas do `PA-CGM-250912-127`** (`I-01`) — outra causa.
- **Não traz o aditivo real como fixture** — depende de `I-01`.
- **Não cria validação nova** — `V-CTR-03` continua sendo o oráculo.
- **Não toca `_e_item_completo`, `R-FXA-*` nem `R-MES-*`** — nenhuma das duas entregas anteriores é revisitada.

---

## 7. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| F0 | Reprodução da medição | PP |
| F1 | Testes escritos antes | P |
| F2 | As duas regexes + a função de cruzamento | PP |
| F3 | Fechamento | PP |

**Total: ~1h30.**
