# PLANO 043 — Implementação de "O cartão sem título"

| | |
|---|---|
| **Especificação** | [ESPEC 043](../specs/043-o-cartao-sem-titulo.md) v1.0 |
| **Versão** | 1.0 — 2026-09-03 — **executado** em 2026-09-03. Backend fechou em 1.573 passed; nenhum desvio do plano — os três testes antigos com asserção de `mensagem` sobreviveram sem edição, como previsto |
| **Backlog** | TASKS 043, a escrever. Numeração continua de `T-2649`, a última em uso (ESPEC 042) |
| **Estado inicial** | Árvore de `backend/` carrega as ESPECs 040, 041 e 042 **implementadas e testadas, ainda não commitadas**. `contract_validations.py` já foi tocado pela 040 (que criou `v_ctr_07_periodo_nao_numerico`) — as outras seis funções desta entrega estão intocadas por qualquer uma das três. 1.566 testes coletados |
| **Colisão conhecida** | `contract_validations.py`: esta entrega edita `v_ctr_07_periodo_nao_numerico` — a mesma função que a 040 criou —, mas em outro aspecto (a forma de registrar o achado, não a condição de disparo). Nenhuma sobreposição de linha com o que a 040 escreveu |
| **Instrumento existente** | O inventário completo dos testes que citam as sete siglas já foi medido nesta sessão — não por contagem de arquivo, mas **por asserção**: quais delas checam `.mensagem` e quais só checam `.validacao`/`.severidade`/`.codigo` (§1) |

---

## 1. O que este plano tem de diferente

> **O risco medido é menor do que a ESPEC estimou.** Das sete validações, só **três** têm teste que
> lê `.mensagem`: `V-CTR-06` (`"página 7" in mensagem`), `V-ADT-02` (`"documento sai igual" in
> mensagem`) e `V-CTR-07` (três substrings: código, página, texto extraído). As outras quatro —
> `V-CTR-04`, `V-ADT-04`, `V-MED-03`, `V-MED-04` — não têm asserção de texto nenhuma para quebrar.

> **`V-MED-03` e `V-MED-04` não têm teste unitário dedicado hoje.** `V-MED-03` só aparece num
> docstring de fixture (`conftest.py:155`); `V-MED-04` só num comentário (`test_apuracao_descontada.py:114`).
> Nenhum teste chama `v_med_04_apuracao_sem_par` diretamente. Esta entrega não corre risco de
> quebrar nada nelas — e de quebra fecha uma lacuna de cobertura que já existia.

> **`V-CTR-07` é a única que exige desenho cuidadoso.** A `causa`/`ação` precisam preservar as três
> substrings que `test_periodo_por_extenso.py` já verifica — código, página e o texto extraído —,
> senão o teste quebra por perda de informação, não por mudança de redação.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Medição confirmada, testes novos reprovando pelo motivo certo** | Fim da F1 | O texto final de `causa`/`ação` de `V-CTR-06`, `V-ADT-02` e `V-CTR-07` contém as substrings que os testes de hoje exigem. Testes novos (`titulo` preenchido) reprovam contra o `HEAD`; os três testes antigos com asserção de `mensagem` **continuam passando** contra o `HEAD` (ainda não foram tocados) | Redesenhar o texto antes de codificar |
| **P1 — As sete implementadas; nenhuma condição de disparo mudou** | Fim da F2 | Testes novos verdes. Os três testes antigos com asserção de `mensagem` (`V-CTR-06`, `V-ADT-02`, `V-CTR-07`) continuam verdes, agora contra o código novo. Todo teste de "quando dispara"/"quando não dispara" das sete validações, intocado | Reverter a F2 |
| **P2 — O conjunto** | Fim da F3 | Suíte de backend verde, `1.566 → 1.566 + N`; `ruff`/`mypy` limpos; conferência manual dos sete cards na tela | Não entregar |

---

## 3. Fases

### F0 — Medição e desenho do texto

| # | Tarefa | Ref. |
|---|---|---|
| T-2650 | Reproduzir o inventário: para cada uma das sete siglas, os arquivos que a citam e se alguma asserção lê `.mensagem`. Confirmar a tabela do §1 | ESPEC §2.1, `D-04` |
| T-2651 | Para `V-CTR-06`, `V-ADT-02` e `V-CTR-07`: escrever o texto final de `causa`/`ação` garantindo que as substrings exigidas pelos testes de hoje sobrevivam na concatenação `titulo + causa + ação`. Para `V-CTR-07`, especificamente: código, `"página N"` e o texto de `meses_bruto`, todos dentro de `causa` | ESPEC §5.1 |

**Verificação:** P0 (primeira metade). **Tamanho:** PP.

---

### F1 — Os testes, escritos antes `[portão P0]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2652 | Um teste por validação, isolado (`Contract`/`ContractItem`/`Measurement` construído à mão, sem PDF nem planilha — no molde de `test_cauda_de_pagina.py:249-268`), afirmando `titulo`, `causa`, `ação` e `detalhe` preenchidos. Para `V-MED-03` e `V-MED-04`, é o **primeiro** teste dedicado que qualquer uma das duas recebe | `R-CLA-01`, `R-CLA-02` |
| T-2653 | **[portão]** Rodar contra o `HEAD`: os sete testes novos reprovam (`titulo == ""`); os três testes antigos com asserção de `mensagem` (`V-CTR-06`, `V-ADT-02`, `V-CTR-07`) **continuam passando**, porque o código ainda não mudou | **P0** |

**Verificação:** P0. **Tamanho:** P.

---

### F2 — As sete validações `[portão P1]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2654 | `contract_validations.py` — `v_ctr_04_geometria_nao_canonica`, `v_ctr_06_cauda_sem_linha_anterior`, `v_ctr_07_periodo_nao_numerico`, `v_adt_02_aditivo_sem_efeito`, `v_adt_04_movimento_de_codigo_ausente`: `registrar` → `registrar_em_partes`, texto de `T-2651`/ESPEC §5.1 | `R-CLA-01` |
| T-2655 | `measurement_validations.py` — `v_med_03_desconto_por_posicao`, `v_med_04_apuracao_sem_par`: idem | `R-CLA-01` |
| T-2656 | **[portão]** Os sete testes de `T-2652` verdes. Os três testes antigos (`V-CTR-06`, `V-ADT-02`, `V-CTR-07`) verdes, agora contra o código novo. Todos os testes de disparo/não-disparo das sete validações, já existentes, sem alteração de asserção — continuam verdes | **P1** |

**Verificação:** P1. **Tamanho:** P.

---

### F3 — Fechamento `[portão P2]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2657 | Suíte de backend completa, `1.566 → 1.566 + N` | **P2** |
| T-2658 | `ruff`/`mypy` nos dois arquivos tocados e nos módulos de teste | **P2** |
| T-2659 | Conferência manual: os sete cards, no formato de `V-DOC-01` (título + causa + ação, técnico recolhido) — visual já prototipado no artefato desta conversa, conferir contra o app real se possível | Critério de aceite da ESPEC |
| T-2660 | Status da ESPEC 043 (Proposta → Implementada, números medidos), `docs/CHANGELOG.md`, `README.md` | — |
| T-2661 | `git diff --stat backend/`: só `contract_validations.py`, `measurement_validations.py` e os arquivos de teste tocados — nada em `grid.py`, `pdfplumber_extractor.py`, `container.py`, `ResultadoPanel.tsx` | **P2** |

**Verificação:** P2. **Tamanho:** PP.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3
P0     P0     P1     P2
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~2h, mais duas execuções de suíte |

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| `causa`/`ação` de `V-CTR-07` perder uma das três substrings (código, página, texto extraído) | `T-2653`/`T-2656` — o teste antigo de `test_periodo_por_extenso.py` reprova especificamente nessa asserção |
| Mudar, sem perceber, quando uma validação dispara | Os testes de disparo/não-disparo já existentes, intocados, continuam sendo a régua |
| Confundir esta entrega com a correção do `CartaoAgregado` ou com `V-CAP-01`/`V-CTR-05` | Fora do escopo — declarado na ESPEC (`I-01`, Fases B/C/D) e neste plano |
| Tocar `ResultadoPanel.tsx` "para conferir" | Não deveria ser necessário — o mecanismo já existe. Se acontecer, é sinal de que `titulo`/`causa`/`ação` não bastaram |

---

## 6. O que este plano não faz

- **Não toca `V-CAP-01`, `V-CTR-05`** (Fase B) nem as quatro `BLOQUEIA` (Fase D).
- **Não generaliza `CartaoAgregado`** (`I-01`, Fase C).
- **Não toca `ResultadoPanel.tsx`** nem qualquer arquivo de `frontend/`.
- **Não muda severidade nem condição de disparo** de nenhuma das sete validações.

---

## 7. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| F0 | Medição e desenho do texto | PP |
| F1 | Sete testes escritos antes | P |
| F2 | As sete validações | P |
| F3 | Fechamento | PP |

**Total: ~2h.**
