# ESPEC 041 — A régua da tabela errada

| | |
|---|---|
| **Status** | **Implementada** — 2026-09-03. Backend **1.555 → 1.561 passed**, zero falhas. Os dez documentos do corpus saem com as tuplas de item idênticas — inclusive os 28 testes de `test_grade_por_faixa.py` (ESPEC 033), verdes sem alteração. `contrato_cgm.pdf` extrai **33 itens**, soma `5.532.203,96` — o valor que a proposta declara em prosa. `14.023.00002.00` e `15.069.00001.00` deixam de bloquear e passam a aparecer com o preço real da página 12, em vez da leitura falsa da tabela de escopo na página 10. `total_declarado` continua `None` (`I-01`, fora do escopo) |
| **Versão** | 1.0 — 2026-09-03 |
| **Depende de** | [ESPEC 017](017-grade-do-contrato-derivada-do-documento.md) — a grade derivada do documento. [ESPEC 019](019-contrato-e-aditivos.md) `R-ADT-08` — mais de uma geometria por documento. [ESPEC 033](033-as-tres-tabelas-na-mesma-folha.md) `R-FXA-01` a `R-FXA-06` — a leitura por faixa, que esta espec estende |
| **Revisa** | [ESPEC 033](033-as-tres-tabelas-na-mesma-folha.md) `R-FXA-04`/`D-01`: *"não havendo faixa própria nem herança admissível, valem as divisórias da página — o comportamento de hoje, bit a bit"*. Aquela regra continua valendo; ganha uma condição que faltava medir na ocasião |
| **Não toca** | O crivo de admissão de geometrias (`_e_item_completo`, ESPEC 019 `D-05`), a escolha do gabarito (`R-GRD-02`), `R-FXA-01`, `R-FXA-02` e `R-FXA-03` (intactas), o checksum de `V-CTR-03`, e o ESPEC 040 (`R-MES-*`, já implementada, independente desta) |
| **Referência normativa** | `PC-CGM-240603-82 v3.0.pdf` (o defeito, já fixture — `backend/tests/fixtures/contrato_cgm.pdf`) · os dez documentos do corpus (a não-regressão) |
| **Origem** | `ESPEC 040` `I-04`: submissão real, item `14.023.00002.00 (página 10) sem preço unitário, valor total — extração incompleta da tabela do contrato` |

---

## 1. Problema

**Uma linha de uma tabela de escopo — sem preço, sem período, sem total — é lida com as colunas de uma tabela de preços que fica mais abaixo na mesma folha, e a extração falha exigindo campos que aquela linha nunca teve.**

A página 10 do `PC-CGM-240603-82` traz duas tabelas de formato diferente: uma tabela de escopo — código, descrição, unidade, quantidade, quatro colunas — e, mais abaixo, a tabela "5. PREÇO DOS SERVIÇOS" — sete colunas, com preço, período e total. O item `14.023.00002.00` (ACESSO À REDE PRODAM PARA USUÁRIOS DA PMSP) pertence à primeira. A extração o lê com as colunas da segunda, e ele sai `sem preço unitário, valor total`.

**Não é o defeito da ESPEC 033.** Aquela tratou de linhas que pertencem a tabelas *do mesmo formato* — `Inclusão`, `Redução`, `Aumento`, todas com sete colunas — e corrigiu a leitura para usar, em cada linha, as divisórias da faixa que a cobre. Ela deixou de propósito um degrau de reserva, `R-FXA-04`: quando uma linha não tem faixa própria de oito nem herda de uma anterior, ela é lida com "as divisórias da página" — o comportamento de antes da 033, preservado porque o `contrato_pgm.pdf` depende dele para linhas que genuinamente pertencem à tabela de itens mas não têm borda própria desenhada.

O que a 033 não previu — porque nenhum documento da amostra o exercitava — é uma linha cair em `R-FXA-04` **pertencendo a uma tabela de formato estruturalmente diferente**, não à mesma tabela sem borda. `R-FXA-04` não faz essa pergunta; aplica as colunas da página a qualquer linha que não se qualifique para os degraus anteriores.

## 2. O que foi levantado no código

### 2.1 A página 10 tem duas tabelas de formato diferente

Medido em `PC-CGM-240603-82 v3.0.pdf`, página 10. A linha do `14.023.00002.00` (`y = 138,2–149,9`) tem faixa própria — mas com **cinco** divisórias, não oito:

```
68.6 · 126.5 · 337.5 · 394.0 · 421.1
```

A tabela de preços, mais abaixo na mesma folha (`y = 490,6–526,6`), tem oito:

```
33.2 · 101.8 · 298.3 · 361.8 · 401.5 · 470.6 · 507.4 · 555.5
```

Sem faixa própria de oito e sem herança (os cinco traços não são subconjunto de faixa anterior nenhuma), a linha cai em `R-FXA-04`.

### 2.2 `R-FXA-04` não distingue "sem faixa por acaso" de "é outra tabela"

`verticais_por_linha` ([grid.py:582-616](../../backend/src/infrastructure/contract/grid.py#L582-L616)) tem quatro degraus: faixa própria de oito (`R-FXA-01`/`02`), herança por subconjunto (`R-FXA-03`), e senão, **sempre**, as divisórias da página. O quarto degrau não olha se a linha tem traços próprios — e, tendo, se eles dizem alguma coisa sobre a que tabela ela pertence.

### 2.3 A medição: a união das geometrias realmente admitidas, não o gabarito único

Primeira hipótese, testada e descartada: *"se a linha tem traços próprios e eles não batem com o gabarito escolhido, ela não é linha de item"*. Medida contra o corpus inteiro, usando o **gabarito único** (`analisar_geometria(pdf).gabarito`):

| documento | linhas com traços que não batem no gabarito único |
|---|---|
| `contrato.pdf`, `contrato_pgm.pdf`, `contrato_smul.pdf` | 0 |
| `aditivo_pgm.pdf` | 2 |
| `aditivo_smul.pdf` | 11 |
| `contrato_cgm.pdf` | 15 |

As duas do `aditivo_pgm.pdf` são, medido, **exatamente** as divisórias de uma segunda geometria admitida na mesma página — não lixo, e não a tabela do gabarito. Comparar só contra o gabarito único as rejeitaria incorretamente.

Repetida a medição contra a **união de todas as geometrias que `_geometrias_de_itens` admite** para o documento — o mesmo conjunto que o laço de extração já usa, releitura por releitura — o quadro muda:

| documento | geometrias admitidas | linhas fora da união | com código de serviço |
|---|---|---|---|
| `contrato.pdf` | 1 | 0 | 0 |
| `contrato_pgm.pdf` | 1 | 0 | 0 |
| `aditivo_pgm.pdf` | 3 | **0** | 0 |
| `contrato_smul.pdf` | 1 | 0 | 0 |
| `aditivo_smul.pdf` | 4 | 14 | **0** — prosa e título de seção (`E5. OUTROS SERVIÇOS`, `E5.1. ARMAZENAMENTO DE DADOS`...) |
| `modelo.pdf` | 0 | 0 | 0 |
| `contrato_cgm.pdf` | 5 | 48 | **4** — `14.023.00002.00`, `15.069.00001.00` (duas ocorrências cada, uma por geometria que a alcança) |

**Nenhuma linha real dos oito documentos que já extraem tem código de serviço nessas 62 linhas fora da união.** É a régua desta espec: em nenhum deles a mudança tem como mover um item.

### 2.4 O protótipo: extração completa, soma batendo com o valor declarado em prosa

Prototipado em memória (sem gravar nada): com a linha sem correspondência na união produzindo **zero células** em vez de ser lida pelas colunas de outra tabela, `PC-CGM-240603-82` extrai **33 itens**, soma **`5.532.203,96`** — exatamente o valor que a proposta declara por extenso na abertura da seção 5: *"O Valor total dos Serviços... é estimado em R$ 5.532.203,96"*.

### 2.5 Um terceiro achado, fora do escopo: o total declarado não está numa linha `TOTAL:`

`Contract.total_declarado` veio `None` no protótipo. Este contrato expressa o total em **prosa**, na frase citada acima — não numa linha `TOTAL:` dentro da grade, que é o único lugar em que `_total_declarado` ([pdfplumber_extractor.py:493](../../backend/src/infrastructure/contract/pdfplumber_extractor.py#L493)) procura. Mesmo com esta espec implementada, `V-CTR-03` bloquearia o `PC-CGM-240603-82` com *"total do contrato não localizado"* — outro mecanismo, outra causa, registrado como `I-01` e fora do escopo.

## 3. Objetivo

Que uma linha sem faixa própria de oito só seja lida pelas divisórias da página quando essas divisórias forem, de fato, uma geometria de item que o documento usa — nunca por presunção.

**Não é objetivo:** mudar quais geometrias são admitidas; ler o total declarado em prosa (`I-01`); tratar tabela de escopo como fonte de item de faturamento — ela continua não sendo.

## 4. Escopo

### 4.1 Dentro do escopo

- O quarto degrau de `verticais_por_linha` (`R-FXA-04`), que passa a exigir que os traços próprios da linha — havendo algum — pertençam à união das geometrias admitidas;
- `ler_celulas` e o laço de extração, para tolerar uma linha que não produz coluna nenhuma;
- `contrato_cgm.pdf` como fixture de não-regressão (já trazido pela ESPEC 040).

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| `total_declarado` expresso em prosa | `I-01` — outro mecanismo (`_total_declarado`, que procura `TOTAL:`), outra causa |
| `R-FXA-01`, `R-FXA-02`, `R-FXA-03` | Intactas — só o quarto degrau ganha uma condição |
| O crivo de admissão de geometrias (`_e_item_completo`) | Mesmo racional da ESPEC 033 `D-03`: mantê-lo intacto preserva a prova de que **quais** geometrias entram não muda |
| Ler a tabela de escopo como item | Ela não é item de faturamento hoje, e não é objeto desta correção — o sistema simplesmente para de confundi-la com a que é |

## 5. Regras

| ID | Regra |
|---|---|
| `R-FXA-09` | No quarto degrau de `verticais_por_linha`, antes de aplicar as divisórias da página: se a linha tem traços próprios (`tracos`, não vazio) e eles **não são subconjunto da união de todas as geometrias que `_geometrias_de_itens` admite** para o documento, a linha não é lida como item — produz zero células, não uma linha malformada |
| `R-FXA-10` | Linha **sem** traço próprio nenhum continua caindo no comportamento de hoje — `R-FXA-04` original, intocado. A regra nova só se aplica quando a linha **tem** borda própria e ela aponta para outra tabela |
| `R-FXA-11` | **Invariante de não-regressão:** os dez documentos do corpus que hoje extraem produzem as mesmas tuplas de item, os mesmos totais, os mesmos blocos e as mesmas geometrias admitidas — medido por `sha`, igual à régua da ESPEC 033 |

### 5.1 Validações

**Nenhuma validação nova**, pelo mesmo racional da ESPEC 033 §5.1: o oráculo já existe e é `V-CTR-03`. Grade errada move valor; valor movido não fecha checksum.

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **A comparação é contra a união de todas as geometrias admitidas, não contra o gabarito único** | Medido (§2.3): as duas linhas do `aditivo_pgm.pdf` que não batem no gabarito único pertencem a uma **segunda** geometria legitimamente admitida na mesma página. Comparar só contra o gabarito as rejeitaria — regressão real, não hipotética |
| `D-02` | **Linha rejeitada produz zero células, não uma exceção** | É o mesmo efeito que uma linha cujo primeiro campo não bate `_CODIGO_EXATO` já tem hoje — ela nunca chega a `_montar_item`. Aqui o texto do código bate por acidente de coordenada; o efeito correto é o mesmo: não é linha de item, silenciosamente, como qualquer outra prosa fora da grade |
| `D-03` | **Não tenta ler a tabela de escopo com a geometria dela própria** | O sistema não faz nada com tabela de escopo hoje — não é item de faturamento. Lê-la seria trabalho sem consumidor, e ampliaria o escopo desta correção sem necessidade |
| `D-04` | **Sem validação nova** | Mesmo racional da ESPEC 033 `D-07` — o checksum de `V-CTR-03` já é o oráculo, e ele é por peça |
| `D-05` | **O total em prosa fica de fora (`I-01`)** | Causa e mecanismo diferentes — `_total_declarado` procura uma linha `TOTAL:`, e este documento não tem uma. Resolver isso aqui misturaria dois defeitos numa correção que é sobre um |

## 7. O que muda no código

| Arquivo | Mudança |
|---|---|
| `infrastructure/contract/grid.py` | `verticais_por_linha` ganha o quarto degrau revisado (`R-FXA-09`/`R-FXA-10`): recebe (ou calcula) a união das geometrias admitidas, e devolve `None` para a linha que não pertence a nenhuma delas |
| `infrastructure/contract/grid.py` | `ler_celulas`: a palavra cuja linha resolve para `None` é ignorada — mesmo caminho que já ignora palavra fora da grade |
| `infrastructure/contract/pdfplumber_extractor.py` | O laço de extração passa a união das geometrias já calculadas (`self._geometrias_de_itens`) para a leitura por faixa |
| `tests/fixtures/` | Nenhuma nova — `contrato_cgm.pdf` já está na suíte (ESPEC 040) |
| `domain/`, `application/`, `api/`, `frontend/` | **Nenhuma** |

## 8. Testes e critério de aceite

| Regra | Verificação |
|---|---|
| `R-FXA-09` | A linha do `14.023.00002.00` (e `15.069.00001.00`) não é lida como item; `contrato_cgm.pdf` não levanta mais `ExtractionError` para elas |
| `R-FXA-10` | Os casos de `R-FXA-04` que o `contrato_pgm.pdf` já exercita (linha sem traço próprio) continuam lidos exatamente como hoje |
| `R-FXA-11` | Régua dos dez documentos — `sha` da tupla de item, total, blocos e geometrias admitidas — idêntica, no molde de `test_extractor_aditivo_smul.py::REGUA` |
| Não-objetivo | `contrato_cgm.pdf` continua **sem gerar relatório completo** depois desta espec — `total_declarado is None` bloqueia por `V-CTR-03`, e é o `I-01`, não regressão |

**Critério de aceite:** nenhum `sha` do corpus se move; `14.023.00002.00` e `15.069.00001.00` extraem sem erro (com ou sem aparecer como item, conforme `R-FXA-09` decidir); a suíte fecha verde.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| A união de geometrias mal calculada rejeitar uma linha real de item | `R-FXA-11` — a régua dos dez documentos por igualdade de `sha`, não por amostra |
| Uma geometria de item genuína não entrar na união por alguma razão de admissão | O checksum de `V-CTR-03` continua sendo prova independente, por peça — grade errada move valor, e valor movido não fecha |
| Confundir esta correção com "o `contrato_cgm.pdf` já funciona" | `I-01` é declarado explicitamente no escopo e no critério de aceite: o documento continua bloqueado por outro motivo |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | `total_declarado` expresso em prosa, não em linha `TOTAL:` — `_total_declarado` não o encontra, e `V-CTR-03` bloqueia o `PC-CGM-240603-82` mesmo depois desta correção | Não bloqueia esta espec; impede o documento real de fechar 100% — candidato a spec própria |
| `I-02` | Quantos outros contratos, ainda não vistos, têm tabela de escopo dividindo página com a tabela de preços? Só o `PC-CGM-240603-82` o exercita hoje | Não. `R-FXA-09` é geral — não depende de conhecer os documentos futuros, só da união medida em cada um |

## 11. Relação com a ESPEC 033

A 033 corrigiu linha lida pela geometria de uma tabela **do mesmo formato** na mesma folha (`Inclusão`/`Redução`/`Aumento`, sete colunas as três). Esta corrige linha lida pela geometria de uma tabela de **formato diferente** (quatro colunas, sem preço) que a `R-FXA-04` — degrau que a própria 033 preservou intocado — não sabia reconhecer como estranha.

As duas regras convivem: `R-FXA-01` a `R-FXA-03` continuam decidindo pela linha que **tem** faixa própria de oito ou herda de uma; `R-FXA-09` entra só no que sobra para o quarto degrau, e só quando esse resto tem traços próprios que apontam para fora de qualquer geometria admitida.

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Medição já feita nesta espec — sem trabalho adicional | — |
| B | Testes: `R-FXA-09`/`10` com os valores medidos, a régua dos dez documentos | P |
| C | O quarto degrau em `grid.py`, e `ler_celulas` tolerando linha sem coluna | PP |
| D | Suíte completa e conferência de `sha` | PP |

**Estimativa: menos de meio dia.** A medição mais cara desta espec já está feita.
