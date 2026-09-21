# PLANO 049 — Implementação de "O respiro maior que a linha de dado"

| | |
|---|---|
| **Especificação** | [ESPEC 049](../specs/049-o-respiro-maior-que-a-linha-de-dado.md) v1.1 |
| **Versão** | 1.0 — 2026-09-09 — **executado** em 2026-09-09. Todos os portões fechados, uma frente extra (`T-2737`) achada e resolvida na F3 |
| **Backlog** | [TASKS 049](../tasks/049-tasks-o-respiro-maior-que-a-linha-de-dado.md) — numeração continua de `T-2727`, a última em uso (ESPEC 048) |
| **Estado final** | `docx_renderer.py`, `tests/test_docx_anexos.py` e `tests/test_identidade_dos_artefatos.py` modificados. Suíte completa do backend: **1.608 passed, 0 failed**, 1310,15s. `ruff check` e `mypy src/` limpos. Nenhum commit feito por este plano — decisão do usuário |
| **Colisão conhecida** | `docs/specs/050-o-relatorio-que-nao-deixava-rastro.md` existe, **não rastreado**, fora do escopo desta entrega — criado por outro trabalho em paralelo nesta árvore. Este plano não o toca e não depende dele |

---

## 1. O que este plano tem de diferente

> **A ordem de trabalho foi invertida em relação às ESPECs anteriores, e por um motivo concreto.**
> O defeito é de **renderização visual** — a altura efetiva de uma linha depois que o Word resolve
> `hRule="atLeast"` contra o parágrafo de cada célula —, e nenhum teste do backend hoje mede altura
> efetiva no Word (só o valor **declarado** em `w:trHeight`, via `python-docx`). O diagnóstico e a
> correção foram feitos por medição direta — Word real, via automação COM, exportado a PDF e medido
> em pontos —, não por um teste escrito antes do código. O código já mudou; o que falta é fechar a
> lacuna de cobertura automatizada que permitiu o defeito passar despercebido, e é isso que a F2 faz.

> **A correção é uma condicional a menos, não uma função nova.** `ooxml.escrever` já suportava texto
> vazio (`R-DES-03` da ESPEC 026); o `git diff` inteiro é a remoção de `if celula.texto:` em
> `_celula_do_anexo` (`docx_renderer.py`).

> **Uma terceira frente apareceu na execução, e não estava no PLANO original: reancorar
> `test_identidade_dos_artefatos.py`.** A ESPEC 026 `R-DES-01` trava o `.docx` do piloto e do PGM
> byte a byte contra um hash gravado; como esta correção muda deliberadamente o XML de toda célula
> vazia de anexo, os dois pacotes tinham de mudar de hash — e mudaram, só em `word/document.xml`,
> confirmado e provado por desligamento (`T-2737`). Não é regressão: é exatamente o caso que o
> próprio arquivo já documenta como reancoragem legítima (ESPECs 024, 028, 036, 037).

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Diagnóstico e correção confirmados por medição real** | Já satisfeito, antes deste plano | Vão `INTERNET-CGM`→`INTERNET` e `INTERNET`→`Uso Internet...`, medidos via Word COM + PDF, caem de 25,4/25,5pt para 17,4/17,5pt (−8,0pt, o `w:after="160"` removido); suíte relacionada em `§Estado inicial` — 825 passed, 0 failed | — (já fechado) |
| **P1 — Regra `R-CEL-01` travada por teste automatizado** | Fim da F2 | Teste novo falha contra a versão **sem** a correção (`if celula.texto:` de volta) e passa com ela — confirma que o teste exercita a mudança certa, não um efeito colateral | Reescrever o teste |
| **P2 — Fechamento** | Fim da F3 | Suíte completa (`python -m pytest`), `ruff check` e `mypy src/` limpos; `git diff --stat backend/` só em `docx_renderer.py` e no teste novo; ESPEC 049 passa de "Proposta" para "Implementada" com os números reais | Não entregar |

---

## 3. Fases

### F0 — Preparação

| # | Tarefa | Ref. |
|---|---|---|
| T-2728 | Confirmar a linha de base: `python -m pytest --collect-only -q` → 1.607; `git status --short -- backend/` → só `docx_renderer.py` | — |

**Verificação:** preparação. **Tamanho:** PP — cinco minutos.

---

### F1 — Diagnóstico e correção `[portão P0 — já satisfeito]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2729 | Registrar o diagnóstico: descartada a hipótese de perda de altura do Excel (XML bruto de `SMIT SUSTENTAÇÃO_...xlsx` e `CGM_Levantamento_06034_...xlsx` sem `customHeight` em nenhuma linha); causa real isolada em `_celula_do_anexo` (`docx_renderer.py:585`, condicional `if celula.texto:`) | `R-CEL-01` |
| T-2730 | A correção: remover a condicional, chamando `ooxml.escrever` sempre — **já aplicada** na árvore de trabalho | `R-CEL-01`, `R-CEL-02` |
| T-2731 | **[portão]** Confirmar os números já medidos (§Estado inicial): vãos reais antes/depois via Word COM + PDF; suíte relacionada 825 passed | **P0** |

**Verificação:** P0. **Tamanho:** já executado — registro retroativo.

---

### F2 — Teste de regressão para `R-CEL-01` `[portão P1 — fechado]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2732 | `test_docx_anexos.py`: novo teste sobre uma linha de respiro real (ex.: `Internet`, a linha vazia entre as duas primeiras faixas de título) — a célula vazia tem, no XML, `w:pPr/w:spacing` com `before="0"` e `after="0"`, e `w:rPr/w:sz` igual ao corpo do próprio anexo (mesmo valor que uma célula com texto da mesma tabela recebe) | `R-CEL-01`, `R-CEL-03` |
| T-2733 | **[portão]** Confirmado que `T-2732` reprova (`AttributeError`, `w:pPr` ausente) com `if celula.texto:` restaurado localmente, e passa com o código atual | **P1** |

**Verificação:** P1 fechado. **Tamanho:** PP — vinte minutos.

---

### F3 — Fechamento `[portão P2 — fechado]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2734 | Suíte de backend completa (`python -m pytest`); `ruff check`/`mypy src/` limpos. Revelou 2 reprovações em `test_identidade_dos_artefatos.py` | **P2** |
| T-2737 | **Achado durante `T-2734`, fora do previsto no PLANO original:** `test_identidade_dos_artefatos.py` reprovou em dois casos (`test_o_docx_do_piloto_e_byte_a_byte_o_de_sempre`, `test_o_docx_do_pgm_e_byte_a_byte_o_de_sempre`) — `R-DES-01` da ESPEC 026. A correção muda deliberadamente o XML de toda célula vazia de anexo, então o `word/document.xml` dos dois pacotes muda de hash. Reancorado seguindo o protocolo já documentado no próprio arquivo (provar por desligamento): confirmado por script que só `word/document.xml` difere nos dois pacotes (40/40 chaves, zero adicionada/removida), e que revertendo a correção localmente o hash volta byte a byte ao valor antigo nos dois. `PACOTE_DO_PILOTO`/`PACOTE_DO_PGM` atualizados, com parágrafo novo no docstring registrando a reancoragem | `R-CEL-01`, ESPEC 026 `R-DES-01` |
| T-2734b | Suíte completa reexecutada após `T-2737`: **1.608 passed, 0 failed**, 1310,15s | **P2** |
| T-2735 | Status da ESPEC 049 (Proposta → Implementada v1.1, com os números medidos); `docs/CHANGELOG.md`; linha nova de "Incremento 049" em `README.md` | — |
| T-2736 | **[portão]** `git diff --stat backend/`: confirmado — `docx_renderer.py`, `tests/test_docx_anexos.py` e `tests/test_identidade_dos_artefatos.py`. Nada em `ooxml.py`, `layout.py`, `medidas_grc.json`, `domain/` ou `application/` | **P2** |

**Verificação:** P2 fechado. **Tamanho:** PP — vinte minutos, mais o tempo da suíte (rodada duas vezes: antes e depois da reancoragem).

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3
       P0     P1     P2
      (feito) (feito) (feito)
```

| Alocação | Duração real |
|---|---|
| 1 desenvolvedor | F1+F2 ~1h; F3 ~50min (duas execuções de suíte completa, ~22min cada, mais a reancoragem) |

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| O teste novo (`T-2732`) não exercitar de fato a mudança, e passar mesmo com o defeito de volta | `T-2733` — checagem de caracterização explícita contra a versão sem a correção |
| Custo de desempenho em anexos muito densos | Já medido (`ESPEC 049 §6/D-03`): +11% no pior caso testado (`Usuários`, 1.021 linhas). `T-2734` roda `test_o_custo_de_um_anexo_e_linear`, que mede razão, não tempo absoluto |
| Contagem de páginas dos anexos muda em relação a documentos já entregues | Efeito esperado — nenhum teste-âncora fixa contagem de página dos anexos |
| **Materializado:** o hash byte a byte do `.docx` (piloto e PGM) muda, travando `test_identidade_dos_artefatos.py` (`R-DES-01`) | Não previsto nesta lista antes da execução. Resolvido por `T-2737` — reancoragem provada por desligamento, só `word/document.xml` se move nos dois pacotes |

---

## 6. O que este plano não faz

- **Não toca `ooxml.altura_fixa`, `layout.py` ou `medidas_grc.json`** — o mínimo de altura continua vindo da medição do GRC (`D-02` da ESPEC).
- **Não lê `row_dimensions` do Excel** — hipótese avaliada e descartada (ESPEC 049 §2.1).
- **Não mede as outras 18 abas por screenshot** — o mecanismo corrigido é o mesmo `_celula_do_anexo` para todas (`I-01` da ESPEC, em aberto por decisão, não por omissão).
- **Não commita nada por conta própria** — commit é decisão à parte do usuário.

---

## 7. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| F0 | Linha de base | PP |
| F1 | Diagnóstico e correção | executado |
| F2 | Teste de regressão | executado |
| F3 | Fechamento (inclui a reancoragem imprevista, `T-2737`) | executado |

**Concluído.** As quatro fases fechadas em 2026-09-09; nenhum commit feito por este plano.
