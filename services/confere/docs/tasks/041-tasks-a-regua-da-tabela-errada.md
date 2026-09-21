# TASKS 041 — Backlog de "A régua da tabela errada"

| | |
|---|---|
| **Especificação** | [ESPEC 041](../specs/041-a-regua-da-tabela-errada.md) v1.0 |
| **Plano** | [PLANO 041](../plans/041-plano-a-regua-da-tabela-errada.md) v1.0 — executado |
| **Versão** | 1.0 — 2026-09-03 |
| **Total** | 14 tarefas · 3 portões · 2 insumos em aberto |
| **Status** | **Concluído** — 2026-09-03. Portões `P0` a `P2` fechados. Backend **1.555 → 1.561 passed**, zero falhas. `ruff`/`mypy` limpos. Nenhuma fase revertida |

> **Escrito depois da implementação**, como os TASKS 024 e 028. O usuário escolheu executar direto do
> PLANO 041, sem backlog próprio — esta é a reconstrução, para o registro ficar completo. A `§10` é a
> parte que só se sabe depois de executar.

> **Dois arquivos de produção.** `grid.py` (novo nesta entrega) e `pdfplumber_extractor.py` (já tocado
> pela 040, em outro ponto). Nenhum outro — nem `contract_item.py`, nem `contract_validations.py`, nem
> `container.py`, que são da 040.

---

## 1. Convenções

**Identificadores** `T-26nn`, continuando de `T-2622`, a última em uso (o ajuste de `container.py` da
ESPEC 040).

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`python -m pytest` verde. Medido antes de começar: árvore com a ESPEC 040 já implementada e testada,
ainda não commitada; `grid.py` limpo; **1.555 testes coletados**.

**Convenção de commit** `<tipo>(T-26nn): descrição`. `test(...)` para `E0`/`E1`; `fix(...)` para `E2`;
`docs(...)` para `E3`.

### 1.1 Três regras que atravessam este backlog

**1 — Não é objetivo o `contrato_cgm.pdf` gerar relatório completo.** `total_declarado` vem `None`
nesse documento (`I-01`, total expresso em prosa) — depois desta correção ele ainda bloqueia, só que
em `V-CTR-03`, não mais em `_montar_item`. Resolver isso nesta entrega estaria fora do escopo aprovado.

*O sinal no diff:* qualquer tentativa de fazer `_total_declarado` reconhecer texto em prosa.

**2 — O oráculo é duplo, e o segundo é herdado.** (1) `14.023.00002.00` e `15.069.00001.00` param de
levantar `ExtractionError`. (2) A régua dos dez documentos (`test_extractor_aditivo_smul.py::REGUA`)
continua idêntica — mesma técnica da ESPEC 033/040, reaproveitada sem alteração.

*O sinal no diff:* uma nova função de medição ao lado da que já existe.

**3 — A comparação é contra a união de todas as geometrias admitidas, não contra uma única.** Medido
na ESPEC §2.3: duas linhas do `aditivo_pgm.pdf` têm traços que não batem com a geometria escolhida
como gabarito, mas pertencem a uma segunda geometria legitimamente admitida na mesma página — comparar
só contra uma delas as rejeitaria.

*O sinal no diff:* `verticais_por_linha` comparando `tracos` contra `grade.verticais` ou contra um
`gabarito` único, em vez da união de `geometrias`.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** Reprodução da medição | T-2623 … T-2625 | **P0** (1ª metade) | F0 |
| **E1** Os testes, escritos antes | T-2626 … T-2628 | **P0** | F1 |
| **E2** `R-FXA-09`/`R-FXA-10` | T-2629 … T-2632 | **P1** | F2 |
| **E3** Fechamento | T-2633 … T-2636 | **P2** | F3 |

### 2.1 A régua da entrega — o que mudou

| Muda | Não muda |
|---|---|
| `verticais_por_linha` ganha o parâmetro `geometrias` e o quarto degrau (`R-FXA-09`) | `R-FXA-01` a `R-FXA-03` — faixa própria e herança, intactas |
| `ler_celulas` tolera linha sem coluna (`None`) | O crivo de admissão de geometrias (`_e_item_completo`) |
| `14.023.00002.00` e `15.069.00001.00` passam a aparecer como item, com o preço real da página 12 | Os dez documentos do corpus — nenhuma tupla de item se move (`test_extractor_aditivo_smul.py::REGUA`, `test_grade_por_faixa.py`) |
| Status da ESPEC 041, `docs/CHANGELOG.md`, `README.md` | `contract_item.py`, `contract_validations.py`, `container.py` — nenhuma linha (são da 040) |

---

## 3. Épico E0 — Reprodução da medição `[portão P0, 1ª metade]`

> **Nenhum arquivo de `src/` é tocado neste épico.** A ESPEC 041 já mediu tudo; aqui só se confere.

#### T-2623 — A tabela da ESPEC §2.3, reproduzida
**Tamanho:** PP · **Ref:** ESPEC §2.3

União de geometrias por documento, linhas fora dela, com/sem código — para os dez documentos do
corpus. **Bateu exato**: `contrato.pdf`/`contrato_pgm.pdf`/`aditivo_pgm.pdf`/`contrato_smul.pdf` com
zero mismatch; `aditivo_smul.pdf` com 14, nenhum com código; `contrato_cgm.pdf` com 48, **4** com
código (`14.023.00002.00` e `15.069.00001.00`, duas ocorrências cada).

**Pronto quando:** os números conferem com a ESPEC, sem ajuste — e conferiram.

---

#### T-2624 — O protótipo do §2.4, reproduzido
**Tamanho:** PP · **Ref:** ESPEC §2.4, `I-01`

`contrato_cgm.pdf` extrai 33 itens, soma `5.532.203,96`, `total_declarado is None`. **Bateu exato.**

**Pronto quando:** os três valores conferem — e conferiram.

---

#### T-2625 — A régua de hoje dos dez documentos
**Tamanho:** PP · **Ref:** `R-FXA-11`

`test_extractor_aditivo_smul.py` completo: **11 passed**. Linha de base desta entrega.

**Pronto quando:** verde — e estava.

---

## 4. Épico E1 — Os testes, escritos antes `[portão P0]`

#### T-2626 — `tests/test_regua_da_tabela_errada.py`
**Tamanho:** P · **Ref:** `R-FXA-09`, `R-FXA-10`, `D-01`

Casos construídos com os traços medidos na ESPEC §2.1 e §2.3, no molde de `_PaginaDeTraços` de
`test_grade_por_faixa.py` (sem abrir PDF): linha de escopo com traços fora da união → nenhuma célula;
sem o parâmetro `geometrias`, o comportamento de hoje não muda; linha sem traço próprio continua caindo
na página (`R-FXA-10`); traço que pertence a uma **segunda** geometria admitida (o caso do
`aditivo_pgm.pdf`) não é rejeitado (`D-01`). Mais dois testes de integração sobre o `contrato_cgm.pdf`
real.

**Pronto quando:** escrito — seis casos ao todo.

---

#### T-2627 — `test_t2609` (ESPEC 040) atualizado
**Tamanho:** PP

Renomeado para `test_t2609_i04_fechado_pela_espec_041`: a asserção de `ExtractionError` sai; entra a
confirmação de que `14.023.00002.00` não aparece mais como item da página 10. O docstring passa a
remeter à ESPEC 041, e não mais ao `I-04` como pendência.

**Pronto quando:** reescrito, com a asserção nova.

---

#### T-2628 — O portão `[portão]`
**Tamanho:** PP · **Portão P0**

Contra o `HEAD`: **6 reprovaram**, **1 passou** — mais do que o plano previa (ele citava só o caso
"fora da união"). As três chamadas que passam `geometrias=` a `verticais_por_linha` reprovaram com
`TypeError: unexpected keyword argument 'geometrias'` — a assinatura ainda não aceitava o parâmetro. Os
dois testes de integração sobre o PDF real reprovaram com o `ExtractionError` de sempre. O único que
passou foi o que afirma o comportamento **sem** o parâmetro novo — exatamente o que tinha de continuar
valendo. A régua da `T-2625` já passava.

**Pronto quando:** a tabela de reprovações bate com o motivo esperado — e bateu, com um `TypeError`
declarado em vez de suposto.

---

## 5. Épico E2 — `R-FXA-09`/`R-FXA-10` `[portão P1]`

#### T-2629 — O quarto degrau em `verticais_por_linha`
**Tamanho:** PP · **Ref:** `R-FXA-09` · **Primeiro toque em `grid.py`**

Parâmetro novo `geometrias: Sequence[tuple[float, ...]] = ()`, com o padrão vazio preservando o
comportamento de hoje (mesmo princípio de `por_faixa=False` em `ler_celulas`). O degrau: linha sem
faixa própria, sem herança, com traços próprios que não são subconjunto da união de `geometrias` →
`None`, em vez das divisórias da página.

**Pronto quando:** a função compila com a assinatura nova, `mypy` sem acusar os usos existentes.

---

#### T-2630 — `ler_celulas` tolera linha sem coluna
**Tamanho:** PP · **Ref:** `D-02`

A palavra cuja linha resolve para `None` é ignorada — mesmo caminho que já ignora palavra fora da
grade. `ler_celulas` ganha o mesmo parâmetro `geometrias`, repassado a `verticais_por_linha`.

**Pronto quando:** nenhuma linha vira exceção; ela simplesmente não produz célula.

---

#### T-2631 — O laço principal passa a união
**Tamanho:** PP

`pdfplumber_extractor.py`: `ler_celulas(pagina, grade, por_faixa=True, geometrias=geometrias)` — a
variável `geometrias` já existia no laço (`_geometrias_de_itens`, calculada antes do laço de páginas);
nada novo a computar.

**Pronto quando:** a chamada passa a lista, sem outra linha do arquivo tocada.

---

#### T-2632 — O portão `[portão, risco]`
**Tamanho:** PP · **Portão P1**

`T-2626` inteiro verde na primeira rodada, **exceto duas asserções** que comparavam `Decimal` com
`float` puro (`13.79` em vez de `Decimal("13.79")`) — falha de teste, não do código: `Decimal('13.79')
== 13.79` é `False` em Python, porque `13.79` não é exatamente representável em binário. Corrigido nos
dois lugares (`T-2627` deste TASKS não afetada — o defeito era só no módulo novo). Depois da correção,
**18 de 18** verdes. Régua dos dez documentos (`T-2625`) e os 28 testes de `test_grade_por_faixa.py`
(ESPEC 033) — que chamam `verticais_por_linha` com a assinatura **antiga**, sem `geometrias` —
continuaram verdes sem alteração nenhuma.

**Achado que não estava previsto, e foi bom:** `14.023.00002.00` e `15.069.00001.00` não ficaram
simplesmente ausentes — apareceram como item, com preço real, vindos de uma **segunda ocorrência** na
página 12. O documento repete o padrão que a ESPEC 040 já tinha visto no `10.050.00001.00`: cada código
aparece uma vez na tabela de escopo (sem preço) e de novo na tabela de preços (com preço) — a correção
faz a leitura ignorar a primeira e pegar a segunda, que é a certa.

**Pronto quando:** os 18 + 11 + 28 verdes — e estavam, depois do ajuste de `Decimal`.

---

## 6. Épico E3 — Fechamento `[portão P2]`

#### T-2633 — Suíte completa
**Tamanho:** PP · **Portão P2**

`1.555 → 1.561 passed`, zero falhas, em 19min02. Seis testes novos (`test_regua_da_tabela_errada.py`),
nenhum removido.

**Pronto quando:** verde, número reconciliado — e estava.

---

#### T-2634 — Ferramentas
**Tamanho:** PP · **Portão P2**

`ruff check` acusou **uma** linha longa (107 > 100) em `test_t2609_i04_fechado_pela_espec_041` —
corrigida quebrando a comprehension em três linhas. `mypy src/` limpo de primeira nos dois arquivos de
produção.

**Pronto quando:** os dois limpos — e ficaram, depois do ajuste de `ruff`.

---

#### T-2635 — Documentos
**Tamanho:** PP

Status da ESPEC 041 (Proposta → Implementada, números medidos, `I-01`/`I-02` mantidos abertos),
entrada nova em `docs/CHANGELOG.md`, linha nova em `README.md`. O `PLANO 041` ganhou a nota de
"executado" na própria versão, sem seção de emenda — não houve desvio a registrar lá.

**Pronto quando:** os quatro documentos refletem o estado final — e refletem.

---

#### T-2636 — Nenhuma âncora de documento tocada
**Tamanho:** PP · **Portão P2**

`git diff --stat backend/`: `contract_item.py`, `grid.py`, `pdfplumber_extractor.py`, `container.py`,
`contract_validations.py`, `conftest.py` modificados; `contrato_cgm.pdf`, `test_periodo_por_extenso.py`,
`test_regua_da_tabela_errada.py` novos. Os quatro primeiros e a fixture são da **040**, não desta
entrega — só `grid.py` e a parte nova de `pdfplumber_extractor.py` pertencem à 041. Nenhuma entrada em
`docx_renderer.py`, `report.py`, `.xlsx` de análise ou *schema* de API.

**Pronto quando:** o `diff` bate com essa distinção — e bateu.

---

## 7. Rastreabilidade

| Regra | Tarefas |
|---|---|
| `R-FXA-09` | T-2626, T-2629, T-2632 |
| `R-FXA-10` | T-2626, T-2629 |
| `R-FXA-11` | T-2625, T-2632, T-2633 |
| `D-01` | T-2626 (o caso do `aditivo_pgm.pdf`) |
| `D-02` | T-2630 |

---

## 8. O que este backlog não faz

- **Não lê `total_declarado` em prosa** (`I-01`) — outra causa, outra spec.
- **Não toca `_e_item_completo`** nem a escolha do gabarito.
- **Não cria validação nova** — `V-CTR-03` continua sendo o oráculo.
- **Não traz fixture nova** — `contrato_cgm.pdf` já estava na suíte desde a 040.
- **Não commita nada** — a árvore de trabalho segue como está; commit é decisão à parte.

---

## 9. Sequência e commits

```
E0 ──► E1 ──► E2 ──► E3
P0     P0     P1     P2

E0  medição reproduzida, nenhum arquivo tocado
E1  seis casos + um teste da 040 atualizado    test(T-2626, T-2627)
E2  o quarto degrau, em grid.py + o laço        fix(T-2629..631)
E3  fechamento                                  docs(T-2635)
```

**Execução real:** feita numa sessão contínua, sem separar por commit — o registro acima é a
segmentação lógica, para quem for commitar depois.

---

## 10. Insumos em aberto

| ID | Questão | Bloqueia? |
|---|---|---|
| `I-01` | `total_declarado` do `contrato_cgm.pdf` vem `None` — o valor está em prosa, não numa linha `TOTAL:`. `V-CTR-03` bloqueia o relatório completo desse documento por esse motivo, independente desta correção | Não bloqueia este backlog; impede o documento real de fechar 100% — candidato a spec própria |
| `I-02` | Quantos outros contratos, ainda não vistos, têm tabela de escopo dividindo página com a de preços? | Não. `R-FXA-09` é geral — não depende de conhecer documentos futuros |

---

## 11. O que a execução ensinou, escrevendo depois

**O plano previu um portão de reprovação mais estreito do que o real, e isso é resultado, não
falha.** `T-2628` (aqui) esperava só o caso "traço fora da união" reprovando; na prática, três testes
reprovaram por `TypeError` (parâmetro que ainda não existia) e dois por `ExtractionError` (o defeito
de sempre) — cinco motivos diferentes, todos corretos, nenhum surpresa real: são exatamente os pontos
que o código ainda não tinha.

**Um bug de teste, não de produção, apareceu no primeiro portão da `E2`.** Duas asserções comparavam
`Decimal` com literal `float` (`13.79`) — em Python, `Decimal('13.79') == 13.79` é `False`, porque
`13.79` não tem representação binária exata. Corrigido para `Decimal("13.79")`, no padrão que o resto
da suíte já usa. Vale como lembrete: literal numérico solto num `assert` contra campo `Decimal` é o
tipo de erro que só aparece rodando, nunca lendo.

**O achado bom que o plano não prometeu:** a ESPEC 041 previa, como resultado conservador, que as duas
linhas de escopo simplesmente parariam de dar erro — sem dizer se ficariam de fora do relatório. Na
prática, os dois códigos aparecem como item, com o preço real de uma segunda ocorrência na página 12.
O mecanismo é o mesmo que a ESPEC 040 já tinha visto: código repetido, uma vez em tabela de escopo,
outra na de preço — e a correção faz a leitura pegar a certa, não as duas nem nenhuma.

**Nenhuma fase foi revertida.** Os três portões fecharam na primeira passagem de cada fase, contando
os dois ajustes acima (que são dentro da própria `E2`/`E3`, não reversão de fase).
