# TASKS 049 — Backlog de "O respiro maior que a linha de dado"

| | |
|---|---|
| **Especificação** | [ESPEC 049](../specs/049-o-respiro-maior-que-a-linha-de-dado.md) v1.1 |
| **Plano** | [PLANO 049](../plans/049-plano-o-respiro-maior-que-a-linha-de-dado.md) v1.0 |
| **Versão** | 1.0 — 2026-09-09 |
| **Total** | 11 tarefas · 3 portões · 1 colisão conhecida (fora do escopo) · 1 frente extra achada na execução |
| **Status** | **Concluído** — 2026-09-09. `P0`, `P1` e `P2` fechados na mesma passagem, com uma frente extra achada e resolvida na F3 (`T-2737`, reancoragem de `test_identidade_dos_artefatos.py`, ESPEC 026 `R-DES-01`). Backend **1.607 → 1.608 passed** (`1608 passed, 1 warning in 1310,15s`), zero falha. `ruff check` e `mypy src/` limpos. Nenhuma fase revertida |

> **Dois arquivos de produção/teste previstos, mais um terceiro achado na execução.**
> `docx_renderer.py` (correção) e `test_docx_anexos.py` (caso novo) eram o escopo original. A suíte
> completa revelou que `test_identidade_dos_artefatos.py` também precisava mudar — não por acaso,
> mas porque a `R-DES-01` da própria ESPEC 026 existe para pegar exatamente isto: um `.docx` que
> mudou de conteúdo. Reancorado com o mesmo protocolo que o arquivo já documenta (provar por
> desligamento), não por decisão nova. `ooxml.py`, `medidas_grc.json` e `layout.py` continuam de
> fora — nenhum dos três muda de valor.

---

## 1. Convenções

**Identificadores** `T-27nn`, continuando de `T-2727`, a última em uso (ESPEC 048).

**Definição de pronto:** código e teste; `ruff check` e `mypy src/` limpos; `python -m pytest` verde —
**não** `uv run pytest`, que quebra a coleta do backend nesta árvore. Medido antes de começar:
1.607 testes coletados; `docx_renderer.py` já modificado na árvore, sem commit.

**Convenção de commit** `<tipo>(T-27nn): descrição`. `fix(...)` para o commit da correção em si
(`E1` — é uma célula deixando de receber formatação que já deveria receber, não *feature* nova);
`test(...)` para o teste de regressão (`E2`); `docs(...)` para o fechamento (`E3`).

### 1.1 A inversão de ordem, e por que ela não é um atalho

**O diagnóstico e a correção já existem antes do teste automatizado — ao contrário do padrão
teste-antes das ESPECs anteriores.** A razão: o defeito só é observável na altura **efetiva** que o
Word atribui à linha depois de resolver `hRule="atLeast"` contra o parágrafo da célula, e nenhum
teste do backend mede isso — só o valor **declarado** em `w:trHeight`. O diagnóstico foi feito
medindo o documento real, aberto no Word via automação COM, exportado a PDF e medido em pontos
(`pdfplumber`); a correção foi validada do mesmo jeito, antes e depois, com a suíte relacionada
inteira (825 passed) confirmando zero regressão no que já era testado.

*O que isso não dispensa:* um teste automatizado que trave a **causa** (a normalização de parágrafo
que a célula vazia deixa de receber), para que a suíte de CI — que não abre o Word — continue
protegendo esta regra depois que esta entrega fechar. É o que a F2 (`T-2732`/`T-2733`) faz.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** Preparação | T-2728 | — | F0 |
| **E1** Diagnóstico e correção (já executados) | T-2729 … T-2731 | **P0** (fechado) | F1 |
| **E2** Teste de regressão | T-2732 … T-2733 | **P1** (fechado) | F2 |
| **E3** Fechamento | T-2734, T-2737, T-2734b, T-2735, T-2736 | **P2** | F3 |

### 2.1 A régua da entrega — o que muda

| Muda | Não muda |
|---|---|
| Célula de anexo sem texto passa a receber `w:spacing before="0" after="0"` e o corpo de fonte do anexo — mesma normalização que uma célula com texto já recebia | Célula com texto — saída idêntica à de hoje (`R-CEL-03`) |
| Altura efetiva das linhas de respiro nas 19 abas de anexo, aproximando-se do mínimo declarado (`altura_linha_pt`) | `altura_linha_pt`, `ooxml.altura_fixa`, `medidas_grc.json` — o mínimo continua vindo do GRC |
| `test_docx_anexos.py` ganha um caso novo para `R-CEL-01` | As demais ~1.606 asserções da suíte — nenhuma delas fixa o que esta entrega corrige |
| `PACOTE_DO_PILOTO`/`PACOTE_DO_PGM` em `test_identidade_dos_artefatos.py`: só a entrada `word/document.xml`, reancorada (`T-2737`) | As outras 39 entradas de cada pacote — confirmado igual, chave a chave |
| Status da ESPEC 049, `docs/CHANGELOG.md`, `README.md` | Todo o resto de `backend/` — nenhuma outra linha |

---

## 3. Épico E0 — Preparação

#### T-2728 — Linha de base
**Tamanho:** PP

`python -m pytest --collect-only -q` → 1.607 testes coletados. `git status --short -- backend/` →
só `docx_renderer.py` modificado, sem outro arquivo pendente.

**Pronto quando:** os dois números/estados conferem com o que o PLANO presume.

---

## 4. Épico E1 — Diagnóstico e correção `[portão P0 — já fechado]`

#### T-2729 — Descarte da hipótese e isolamento da causa
**Tamanho:** já executado · **Ref:** `R-CEL-01`

Hipótese de perda de altura do Excel descartada por leitura do XML bruto (`xl/worksheets/sheetNN.xml`)
de `docs/documentos/SMIT SUSTENTAÇÃO_Levantamento_05969_TC 52SMIT2024_15072026_101414_V2.0.xlsx` e de
`docs/documentos/CGM/CGM_Levantamento_06034_TC 16CGM2024_03082026_105905_V1.0.xlsx` — nenhuma linha das
abas `Internet`/`Usuários` tem `customHeight`. Causa real isolada em `_celula_do_anexo`
(`docx_renderer.py:585`): `ooxml.escrever` só normaliza o parágrafo quando `celula.texto` é verdadeiro.

**Pronto quando:** registrado — já está, nesta ESPEC/PLANO.

---

#### T-2730 — A correção
**Tamanho:** já executado · **Ref:** `R-CEL-01`, `R-CEL-02`

`_celula_do_anexo`: remove `if celula.texto:` — `ooxml.escrever` passa a ser chamada sempre, com
`celula.texto` (que pode ser `""`). Uma condicional a menos, nenhuma função nova.

**Pronto quando:** aplicado na árvore de trabalho — já está (`git status --short`).

---

#### T-2731 — O portão `[portão]`
**Tamanho:** já executado · **Portão P0 (fechado)**

Vãos medidos via Word COM + PDF: `INTERNET-CGM`→`INTERNET` 25,4pt→17,4pt; `INTERNET`→`Uso Internet...`
25,5pt→17,5pt (−8,0pt nos dois, o `w:after="160"` removido). Suíte relacionada (`test_docx_anexos.py`,
`test_docx_formatacao.py`, `test_docx_estrutura.py`, `test_desempenho.py`, `test_anchor_por_codigo.py`,
`test_anexo_sem_conteudo.py`) com a correção: **825 passed, 0 failed**.

**Pronto quando:** os números acima conferem — já conferem.

---

## 5. Épico E2 — Teste de regressão `[portão P1]`

#### T-2732 — O caso novo em `test_docx_anexos.py`
**Tamanho:** PP · **Ref:** `R-CEL-01`, `R-CEL-03`

Sobre o anexo `Internet` (ou outro com linha de respiro conhecida), localizar a célula vazia entre as
duas primeiras faixas de título e verificar, no XML da célula:

- `w:pPr/w:spacing` presente, com `w:before="0"` e `w:after="0"`;
- `w:rPr/w:sz` (dentro do `w:r` vazio) igual ao `_meio_ponto(anexo.corpo)` — o mesmo valor que uma
  célula com texto da mesma tabela recebe.

**Pronto quando:** escrito e passando contra o código atual (já corrigido).

---

#### T-2733 — O portão `[portão]`
**Tamanho:** PP · **Portão P1**

Checagem de caracterização: restaurar localmente `if celula.texto:` em `_celula_do_anexo` (sem
commitar) e confirmar que `T-2732` **reprova**. Desfazer a restauração antes de seguir.

**Pronto quando:** `T-2732` reprova sem a correção e passa com ela — confirma que o teste exercita a
mudança certa, não um efeito colateral.

**Resultado:** confirmado — reprova com `AttributeError` (`w:pPr` ausente na célula vazia) sem a
correção, passa com o código atual.

---

## 6. Épico E3 — Fechamento `[portão P2]`

#### T-2734 — Suíte e ferramentas
**Tamanho:** PP · **Portão P2**

`python -m pytest` completo; `ruff check` e `mypy src/` em `docx_renderer.py`. Revela 2 reprovações
em `test_identidade_dos_artefatos.py` (`test_o_docx_do_piloto_e_byte_a_byte_o_de_sempre`,
`test_o_docx_do_pgm_e_byte_a_byte_o_de_sempre`) — segue para `T-2737`.

**Pronto quando:** `ruff`/`mypy` limpos e a suíte roda até o fim (mesmo com as duas reprovações
esperadas, que `T-2737` resolve).

**Resultado:** `ruff check`/`mypy src/` limpos. Suíte: `2 failed, 1606 passed` (as duas reprovações
esperadas — `test_identidade_dos_artefatos.py`).

---

#### T-2737 — Reancoragem de `test_identidade_dos_artefatos.py` (`R-DES-01`)
**Tamanho:** PP · **Ref:** `R-CEL-01`, ESPEC 026 `R-DES-01`

Achado durante `T-2734`, fora do PLANO original. `R-DES-01` (ESPEC 026) trava o `.docx` do piloto e
do PGM byte a byte contra `PACOTE_DO_PILOTO`/`PACOTE_DO_PGM`; a correção desta entrega muda o XML de
toda célula vazia de anexo nos dois documentos, então o pacote muda de hash — comportamento esperado,
não regressão.

Protocolo seguido, o mesmo que o próprio arquivo já documenta (reancoragens das ESPECs 024/028/036/037):

1. Script (`pacote.partes`) sobre as fixtures `docx_do_piloto`/`documento_do_pgm` gerou os hashes
   novos, gravados em JSON — nenhuma transcrição manual de hexadecimal;
2. Comparação chave a chave contra `PACOTE_DO_PILOTO`/`PACOTE_DO_PGM`: 40/40 chaves nos dois pacotes,
   zero adicionada, zero removida, **uma só** com valor diferente — `word/document.xml` — nos dois;
3. Prova por desligamento: `_celula_do_anexo` com `if celula.texto:` restaurado localmente (sem
   commit), pacotes regerados, e os dois voltam byte a byte ao hash antigo (`e56dcb58…` piloto,
   `df71db05…` PGM) — confirma que é esta mudança, e só ela, que move o pacote;
4. `PACOTE_DO_PILOTO["word/document.xml"]` e `PACOTE_DO_PGM["word/document.xml"]` atualizados para os
   valores novos (`0b87c759…` piloto, `4e3197ff…` PGM); parágrafo novo no docstring do arquivo,
   registrando a reancoragem no mesmo formato das anteriores.

**Pronto quando:** os quatro testes de `test_identidade_dos_artefatos.py` passam (os dois byte a byte
mais os dois de `.xlsx`, que não mudam).

**Resultado:** os 4 passam. `word/document.xml` reancorado: `e56dcb58…` → `0b87c759…` (piloto),
`df71db05…` → `4e3197ff…` (PGM). As outras 39 entradas de cada pacote, inalteradas.

---

#### T-2734b — Suíte completa reexecutada
**Tamanho:** PP · **Portão P2**

`python -m pytest` completo, depois de `T-2737`.

**Pronto quando:** verde, sem nenhuma reprovação.

**Resultado:** `1608 passed, 1 warning in 1310.15s (0:21:50)`. `1.607 → 1.608` — só o caso novo de
`R-CEL-01` (`T-2732`).

---

#### T-2735 — Documentos
**Tamanho:** PP

Status da ESPEC 049 (Proposta → Implementada, com os números de `T-2731`/`T-2734b`, e a reancoragem
de `T-2737` registrada). Entrada em `docs/CHANGELOG.md`. Linha nova de "Incremento 049" em
`README.md`, no molde das linhas 49-58.

**Pronto quando:** os três documentos refletem o estado final.

**Resultado:** feito — ESPEC 049 em v1.1/Implementada, `CHANGELOG.md` e `README.md` atualizados.

---

#### T-2736 — Nenhuma âncora fora do previsto
**Tamanho:** PP · **Portão P2**

`git diff --stat backend/`: `docx_renderer.py`, `tests/test_docx_anexos.py` e
`tests/test_identidade_dos_artefatos.py` (este último, só as duas entradas `word/document.xml` e o
parágrafo de reancoragem). Nada em `ooxml.py`, `layout.py`, `medidas_grc.json`, `domain/` ou
`application/`.

**Pronto quando:** o `diff` bate com essa lista.

**Resultado:** confirmado — `git status --short backend/` lista exatamente os três arquivos.

---

## 7. Rastreabilidade

| Regra | Tarefas |
|---|---|
| `R-CEL-01` (célula vazia recebe a mesma normalização de parágrafo) | T-2729, T-2730, T-2731, T-2732, T-2733, T-2737 |
| `R-CEL-02` (altura continua mínimo, não valor exato) | T-2730, T-2731 |
| `R-CEL-03` (não-regressão: célula com texto não muda) | T-2731, T-2732 |
| `D-01` (reusar `ooxml.escrever`, sem função nova) | T-2730 |
| `D-03` (custo extra aceito, medido) | T-2731, T-2734 |
| ESPEC 026 `R-DES-01` (o `.docx` não muda um byte sem motivo declarado) | T-2737 |

---

## 8. O que este backlog não faz

- **Não toca `ooxml.altura_fixa`, `layout.py` ou `medidas_grc.json`** — decisão `D-02` da ESPEC.
- **Não lê `row_dimensions` do Excel** — hipótese avaliada e descartada.
- **Não mede as outras 18 abas por screenshot** — `I-01` da ESPEC, em aberto por decisão.
- **Não commita nada por conta própria** — commit é decisão à parte do usuário.

---

## 9. Sequência e commits

```
E0 ──► E1 ──► E2 ──► E3
      P0     P1     P2
     (feito) (feito)

E0  linha de base                          (sem commit)
E1  diagnóstico + correção                 fix(T-2730)
E2  teste de regressão                     test(T-2732 … T-2733)
E3  reancoragem do hash byte a byte        test(T-2737)
E3  fechamento                             docs(T-2735)
```

**Dois commits em E3, não um.** `T-2737` é uma consequência mecânica de `R-DES-01` — comprovada por
desligamento, não uma decisão de produto —, mas é uma mudança de *teste* sobre um *fato* diferente do
que motiva o `fix` de `E1`. Separar os dois deixa reversível cada um por conta própria.

---

## 10. Insumos em aberto (herdados da ESPEC)

| ID | Questão | Bloqueia? |
|---|---|---|
| `I-01` | Vale medir o efeito visual nas outras 18 abas, com screenshot real, antes de aplicar? | Não — o mecanismo é o mesmo `_celula_do_anexo` para todas |
