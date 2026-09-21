# TASKS 053 — Backlog de "A marca do parágrafo que herdou 12pt"

| | |
|---|---|
| **Especificação** | [ESPEC 053](../specs/053-a-marca-do-paragrafo-que-herdou-12pt.md) v1.0 |
| **Plano** | [PLANO 053](../plans/053-plano-a-marca-do-paragrafo-que-herdou-12pt.md) v1.0 |
| **Versão** | 1.0 — 2026-09-10 |
| **Total** | 15 tarefas · 5 portões |
| **Status** | Não iniciado |

> **Escrito antes da implementação.** A causa já foi isolada e medida na própria ESPEC (§2, Word
> real + PDF + documentos sintéticos) — este backlog não descobre o defeito, grava a correção e
> confirma que a medição se repete depois dela.

---

## 1. Convenções

**Identificadores** `T-27nn`, continuando de `T-2781`, a última em uso (ESPEC 052).

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`python -m pytest` verde — **com o `-m`**, a partir de `backend/`, sem servidor de desenvolvimento
no ar (lição das ESPECs 036/037/051: `uvicorn --reload` distorce `test_desempenho.py`).

**Convenção de commit** `<tipo>(T-27nn): descrição`. `fix(...)` para a marca do parágrafo em
`ooxml.escrever` e no separador (`E1`/`E2` — é célula/parágrafo deixando de herdar formatação
errada, não *feature* nova); `test(...)` para o oráculo estendido, os casos novos e a reancoragem;
`docs(...)` para o fechamento. **Nunca dois tipos no mesmo commit.**

### 1.1 Três coisas que atravessam este backlog

**1 — O oráculo da ESPEC 026 (`R-DES-06`) precisa acompanhar a mudança, ou reprova a matriz
inteira.** `test_escrever_reproduz_a_api_publica` compara `ooxml.escrever` byte a byte contra
`_escrever_de_referencia` (API pública). Acrescentar a marca só de um lado faz toda a matriz de
`texto`×`alinhamento`×`negrito`×`corpo` divergir — não é uma reprovação isolada, é a suíte inteira
daquele teste. `T-2785` é o que evita isso, e vem **antes** do portão `P1`, não depois.

*O sinal no diff:* `T-2784` aplicada sem `T-2785` na mesma passagem — a suíte reprova em dezenas de
casos parametrizados de uma vez, todos pelo mesmo motivo.

**2 — A marca copia o `w:sz` da execução, não recalcula.** `_escrever_de_referencia` já grava
`w:sz` na execução via `font.size = Pt(...)` (a própria API pública faz o truncamento). A marca lê
esse valor de volta do XML já montado — não chama `_meio_ponto` nem reimplementa a fórmula. Duas
implementações do mesmo truncamento são duas chances de divergir silenciosamente.

**3 — O alcance sobre a tabela de comprovação é medido, não presumido.** `ooxml.escrever` é
compartilhada por anexos e pela tabela de comprovação (`_bloco_de_linhas`/`_bloco_titulo`), que
também pode ter célula vazia (`Quantidade Contratada` não declarada, data ausente). `T-2783` mede,
antes de qualquer código mudar, se o piloto/PGM têm esse caso hoje — para que a reancoragem da `E4`
saiba, de antemão, se `word/document.xml` deve mudar só nas páginas de anexo ou também nas 2-3.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** Preparação e alcance medido | T-2782, T-2783 | **P0** | F0 |
| **E1** A marca em `ooxml.escrever`, oráculo estendido | T-2784 … T-2786 | **P1** | F1 |
| **E2** A marca no separador | T-2787 … T-2789 | **P2** | F2 |
| **E3** O vão medido no Word real | T-2790, T-2791 | **P3** | F3 |
| **E4** Fechamento e reancoragem condicional | T-2792 … T-2796 | **P4** | F4 |

### 2.1 A régua da entrega — o que muda

| Muda | Não muda |
|---|---|
| Célula de anexo (e de comprovação, `Quantidade Contratada`/data quando vazias) sem texto passa a ter `w:pPr/w:rPr` (a marca) com o mesmo corpo/fonte da execução | Célula com texto — saída idêntica à de hoje (`R-CEL-06`) |
| O parágrafo separador entre segmentos de tabela ganha a mesma marca, no seu corpo de 1pt | `altura_linha_pt`, `medidas_grc.json`, `corpo` de qualquer anexo — nenhum valor medido muda |
| Altura efetiva das linhas/parágrafos vazios, aproximando-se de uma linha populada | `hRule="atLeast"` — continua mínimo, não valor exato (`R-BRD-04`, ESPEC 049 `R-CEL-02`) |
| `test_desempenho.py::_escrever_de_referencia` — a marca via oxml bruto | O restante do oráculo — a execução continua montada pela API pública |
| `test_docx_anexos.py` ganha dois casos novos (célula vazia, separador) | As demais ~1.622 asserções da suíte |
| `PACOTE_DO_PILOTO`/`PACOTE_DO_PGM`: `word/document.xml`, condicionalmente | As outras 39 entradas de cada pacote |
| Status da ESPEC 053, `CHANGELOG.md`, `README.md` | Todo o resto de `backend/` |

---

## 3. Épico E0 — Preparação e alcance medido `[portão P0]`

#### T-2782 — Linha de base
**Tamanho:** PP

`python -m pytest --collect-only -q` → confirmar `1.624`. Hashes atuais de `word/document.xml`:
piloto `a5f730bf…`, PGM `e205b9ec…`.

**Pronto quando:** os números conferem com o que o PLANO presume.

---

#### T-2783 — O alcance sobre a tabela de comprovação, medido
**Tamanho:** P · **Ref:** `D-02` da ESPEC

Sem tocar código: contar, no piloto e no PGM, quantas células da tabela de comprovação (páginas
2-3 — `_bloco_de_linhas`, `_bloco_titulo`) têm texto vazio hoje. Os dois candidatos conhecidos:
`Quantidade Contratada` não declarada (ESPEC 028 `R-ZER-01`) e a data do levantamento ausente.
Registrar o número real de cada pacote — é o que decide se a reancoragem da `E4` é só de páginas de
anexo ou também das duas primeiras.

**Pronto quando:** o número está registrado (mesmo que seja zero nos dois).

---

## 4. Épico E1 — A marca em `ooxml.escrever`, oráculo estendido `[portão P1]`

#### T-2784 — A marca do parágrafo em `ooxml.escrever`
**Tamanho:** P · **Ref:** `R-CEL-04`, `D-01`

Dentro de `w:pPr`, depois do bloco de `w:spacing`/`w:jc` (ordem do schema: `spacing` → `jc` → `rPr`
de marca), acrescentar `w:rPr` com `w:rFonts` (as três mesmas fontes que a execução já recebe) e
`w:sz` (mesmo `corpo`, via `_meio_ponto` — a função já existe, não duplicar a fórmula).

**Pronto quando:** aplicado, e a ordem dos elementos dentro de `w:pPr` respeita o schema.

---

#### T-2785 — `_escrever_de_referencia` estendida (o oráculo, `R-DES-06`)
**Tamanho:** P · **Ref:** `R-DES-06`

Em `test_desempenho.py`, depois do dip já existente em `w:rFonts`/`w:cs` da execução: montar a
marca à mão (`OxmlElement("w:rPr")`, já que `CT_PPr` não expõe `rPr` nem no nível do oxml),
**copiando** o `w:sz` já gravado na execução (não recalculando) — `§1.1`, item 2. Anexar ao `pPr`
do parágrafo.

**Pronto quando:** `_escrever_de_referencia` produz `w:pPr/w:rPr` com o mesmo `w:sz` de `w:r/w:rPr`.

---

#### T-2786 — O portão `[portão]`
**Tamanho:** P · **Portão P1**

`test_escrever_reproduz_a_api_publica` e `test_escrever_reproduz_a_api_publica_nas_cores` verdes,
matriz inteira (`texto`×`alinhamento`×`negrito`×`corpo`, mais as quatro cores). Caso novo,
`test_a_celula_vazia_recebe_a_marca_do_paragrafo` (isolado, sem `Document` completo, no molde de
`test_escrever_nao_consulta_a_ordem_do_esquema`): célula vazia produz `w:pPr/w:rPr/w:sz` igual ao
corpo passado.

**Pronto quando:** as duas suítes de `R-DES-06` e o caso novo passam.

---

## 5. Épico E2 — A marca no separador `[portão P2]`

#### T-2787 — A marca no parágrafo separador
**Tamanho:** PP · **Ref:** `R-CEL-05`

Em `_faixa_de_tabelas` (`docx_renderer.py`), o `Pt(1)` do separador passa a uma variável só, usada
tanto no `font.size` da execução quanto no `w:sz` da marca nova — evita o literal duplicado
(`§1.1` do PLANO).

**Pronto quando:** aplicado, sem literal `1`/`2` repetido em dois lugares.

---

#### T-2788 — Caso novo em `test_docx_anexos.py`
**Tamanho:** PP · **Ref:** `R-CEL-05`

Sobre `Comunicação Dados` (dois segmentos — corte na linha de cabeçalho, ESPEC 004/051): o
parágrafo entre a primeira e a segunda tabela tem `w:pPr/w:rPr/w:sz` correspondente a 1pt.

**Pronto quando:** escrito e passando.

---

#### T-2789 — O portão `[portão]`
**Tamanho:** — · **Portão P2**

`T-2788` verde.

**Pronto quando:** confirmado.

---

## 6. Épico E3 — O vão medido no Word real `[portão P3]`

#### T-2790 — Regerar e medir
**Tamanho:** PP

Regerar o `.docx` do piloto, converter a página de `Comunicação Dados` para PDF via automação COM
do Word real, medir os mesmos três vãos da ESPEC 053 §2.1 com `pdfplumber`.

**Pronto quando:** os três valores estão medidos e registrados.

---

#### T-2791 — O portão `[portão]`
**Tamanho:** — · **Portão P3**

Os três vãos caem para a ordem de uma linha populada (~4 a 6pt), comparados contra os valores
"antes" já registrados na ESPEC (1,77pt / 17,47pt por linha / 30,94pt).

**Pronto quando:** confirmado — não "melhorou", os números caem para a faixa esperada.

---

## 7. Épico E4 — Fechamento e reancoragem condicional `[portão P4]`

#### T-2792 — Suíte e ferramentas
**Tamanho:** PP · **Portão P4**

`python -m pytest` completo; `ruff check`/`mypy src/` nos arquivos tocados.

**Pronto quando:** ferramentas limpas; suíte roda até o fim (mesmo com reprovação esperada em
`test_identidade_dos_artefatos.py`, se `T-2783` já previu célula vazia nos pacotes).

---

#### T-2793 — Reancoragem, se `T-2792` reprovar (`R-DES-01`)
**Tamanho:** P · **Ref:** `R-CEL-04`, `R-CEL-05`, ESPEC 026 `R-DES-01`

Se `test_identidade_dos_artefatos.py` reprovar: confirmar por script quais entradas mudam nos dois
pacotes — esperado só `word/document.xml` — e se o alcance bate com o que `T-2783` previu (só
anexo, ou anexo + comprovação). Prova por desligamento: revertendo `T-2784`/`T-2787` localmente
(sem commit), os dois pacotes voltam aos hashes da `T-2782` byte a byte, entrada por entrada. Só
então reancorar `PACOTE_DO_PILOTO`/`PACOTE_DO_PGM`, com o parágrafo de justificativa no cabeçalho
do arquivo, no mesmo formato das reancoragens 036/037/049/051/052.

**Pronto quando:** os quatro testes de `test_identidade_dos_artefatos.py` passam.

---

#### T-2794 — Suíte completa reexecutada
**Tamanho:** PP · **Portão P4**

`python -m pytest` completo, depois de `T-2793` (se ela rodou).

**Pronto quando:** verde, sem nenhuma reprovação.

---

#### T-2795 — Nenhuma âncora fora do previsto
**Tamanho:** PP · **Portão P4**

`git diff --stat`: restrito a `ooxml.py`, `docx_renderer.py`, `tests/test_desempenho.py`,
`tests/test_docx_anexos.py`, `tests/test_identidade_dos_artefatos.py` — além da colisão conhecida
das ESPECs 051/052, já presente na árvore. Nada em `anexos.json`, `medidas_grc.json`, `layout.py`.

**Pronto quando:** o `diff` bate com essa lista.

---

#### T-2796 — Documentos
**Tamanho:** PP

Status da ESPEC 053 (Proposta → Implementada, com os números reais de `T-2790`/`T-2791`/`T-2794`).
Linha "Incremento 053" em `README.md`. Entrada em `docs/CHANGELOG.md`.

**Pronto quando:** os três documentos refletem o estado final.

---

## 8. Rastreabilidade

| Regra | Tarefas |
|---|---|
| `R-CEL-04` (marca em `ooxml.escrever`) | T-2784, T-2786, T-2793 |
| `R-CEL-05` (marca no separador) | T-2787, T-2789, T-2793 |
| `R-CEL-06` (não-regressão: texto não muda) | T-2786, T-2791 |
| `D-01` (marca espelha a execução) | T-2784 |
| `D-02` (alcance sobre comprovação medido) | T-2783, T-2793 |
| `R-DES-06` (oráculo da API pública) | T-2785, T-2786 |
| ESPEC 026 `R-DES-01` (identidade byte a byte) | T-2793 |

---

## 9. O que este backlog não faz

- **Não altera `altura_linha_pt`, `medidas_grc.json` ou `corpo` de nenhum anexo.**
- **Não refatora o separador para reusar `ooxml.escrever`** (`D-03` da ESPEC).
- **Não mede as outras 18 abas por captura de tela** (`D-04` da ESPEC).
- **Não commita nada por conta própria** — commit é decisão à parte do usuário.

---

## 10. Sequência e commits

```
E0 ──► E1 ──► E2 ──► E3 ──► E4
P0     P1     P2     P3     P4

E0  linha de base + alcance medido           (sem commit)
E1  marca em ooxml.escrever + oráculo        fix(T-2784) · test(T-2785, T-2786)
E2  marca no separador                       fix(T-2787) · test(T-2788)
E3  medição real no Word                     (sem commit — validação)
E4  reancoragem (se necessária) + fechamento test(T-2793) · docs(T-2796)
```

---

## 11. Insumos em aberto (herdados da ESPEC)

| ID | Questão | Bloqueia? |
|---|---|---|
| `I-01` | Vale medir as outras 18 abas por captura de tela real antes de aplicar? | Não — `D-04`: o mecanismo é o mesmo em todas |
