# TASKS 033 — Backlog de "As três tabelas na mesma folha"

| | |
|---|---|
| **Especificação** | [ESPEC 033](../specs/033-as-tres-tabelas-na-mesma-folha.md) v1.1 |
| **Plano** | [PLANO 033](../plans/033-plano-as-tres-tabelas-na-mesma-folha.md) v1.0 |
| **Versão** | 1.0 — 2026-08-27 |
| **Total** | 30 tarefas · 5 portões · 6 insumos em aberto |
| **Status** | **Concluído** — 2026-08-27. **30 de 30 tarefas**, portões `P0` a `P4`. Backend **1.422 → 1.458 passed**, zero falhas. Seis `sha` de régua intactos, nenhum artefato reancorado. A `T-2198` achou um erro no §2.3 da espec, que foi para **v1.1** |

> **Escrito antes da implementação.** A §10 é a única seção que não pode ser escrita agora, e é a
> que a próxima entrega vai ler.

---

## 1. Convenções

**Identificadores** `T-22nn`, continuando de `T-2192`, a última da ESPEC 032.

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`python -m pytest` verde — **com o `-m`**, e **sem `--timeout`**, que este projeto não tem
instalado.

**Convenção de commit** `<tipo>(T-22nn): descrição`. Fixture nova é `test(...)`; correção de
extração é `fix(...)`. **Nunca os dois no mesmo commit.**

### 1.1 Quatro regras que atravessam este backlog

**1 — Nenhum `sha` se move.** Dez documentos extraem hoje, e os dez têm de sair com a mesma lista
de tuplas de item. A régua está congelada na `T-2197` e é reexecutada em `T-2211` e `T-2216`. Não é
inspeção, não é amostra: é igualdade do conjunto.

*O sinal no diff:* qualquer alteração em `_montar_item`, em `_fronteiras_verticais`, ou nas
constantes `TOLERANCIA` e `COL_*`.

**2 — A leitura por faixa NÃO entra na admissão.** Medido: se entrasse, o crivo aprovaria **todas**
as candidatas — 2 de 2 no piloto, 2 de 2 no PGM, 4 de 4 no aditivo do PGM, 5 de 5 no SMUL —,
inclusive a geometria do cronograma que a ESPEC 019 §2.5 barrou.

*O sinal no diff:* `_linhas` ou `_e_item_completo` alterados; ou `por_faixa=True` chegando a
`_geometrias_de_itens`.

**3 — A herança é por subconjunto, nunca por proximidade.** A linha `TOTAL:` herda as divisórias da
tabela acima **só** quando os traços que ela própria desenha pertencem àquele conjunto. É o que
impede a herança de atravessar para a tabela seguinte, e o caso real que a prova são os traços
`428,7` e `516,9` do `Redução TOTAL:` — `516,9` **não existe** no conjunto da `Inclusão`.

*O sinal no diff:* uma herança do tipo *"vale a última linha que teve divisórias"*, sem o teste de
pertinência.

**4 — Nesta entrega não se reancora NADA.** O delta previsto sobre `.docx`, `.xlsx`,
`CORPO_DO_PILOTO_*` e `linhas_do_documento.json` é **zero**. É o portão invertido dos últimos
incrementos: aqui, artefato que muda é defeito, não âncora velha.

*O sinal no diff:* qualquer constante de teste com valor novo. O `git diff` de `backend/tests/` tem
de conter **arquivos novos e nada mais**.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** Linha de base, fixtures e a régua | T-2193 … T-2198 | **P0** | F0 |
| **E1** Os testes, escritos antes | T-2199 … T-2206 | **P0** | F1 |
| **E2** As divisórias por linha, sem chamador | T-2207 … T-2209 | **P1** | F2 |
| **E3** A linha do laço | T-2210 … T-2213 | **P2** | F3 |
| **E4** O sinal | T-2214 … T-2217 | **P3** | F4 |
| **E5** As duas suítes | T-2218 … T-2222 | **P4** | F5 |

### 2.1 A régua da entrega — o que pode mudar de comportamento

| Muda | Não muda |
|---|---|
| `PA-SMUL-250314-22`: de `ExtractionError` para **16 itens, 3 blocos, `364.793,93`** | Os **dez** `sha` dos documentos que já extraem, e com eles totais, blocos e páginas |
| **50 linhas** da página 4 do SMUL passam a ser fatiadas por faixa | O número de geometrias **admitidas** por documento, na ordem da `T-2197`: 1 · 1 · 3 · 0 · 0 · 1 · 1 · 3 · 0 · 1 — e **4** no SMUL |
| **12 · 15 · 14 · 14** linhas do cronograma (p29, p25, p7, p13) saem com as colunas separadas | Nenhuma delas tem código de serviço, e o `TOTAL` do cronograma não tem dois-pontos — nada entra na extração |
| `para_decimal` passa a ler **uma** cadeia que hoje é `None` | As outras 8.309 células do corpus |
| Arquivos **novos**: 2 PDFs, 2 módulos de teste, 1 script de medição | `.docx`, `.xlsx`, `CORPO_DO_PILOTO_*`, `linhas_do_documento.json` — **nenhuma entrada, nenhum valor** |
| `README.md`, `CHANGELOG.md`, o `Status` da ESPEC 033 | `TOLERANCIA`, `_geometrias_de_itens`, `_e_item_completo`, `R-GRD-02`, a aba `Levantamento`, a API e o frontend |

---

## 3. Épico E0 — Linha de base, fixtures e a régua `[portão P0]`

> **Nenhum arquivo de `src/` é tocado neste épico.**

#### T-2193 — As seis buscas, nas duas suítes `[risco]`
**Tamanho:** PP · **Ref:** PLANO §8, regra 4

Cinco sobre `backend/tests/`: `ler_celulas|montar_grade|_faixas_verticais|analisar_geometria`;
`para_decimal`; `_geometrias_de_itens|candidatos|_e_item_completo`; `sha256`; e
`12\.030\.00002|986\.810|364\.793`.

**Uma sobre `frontend/e2e/`**: os mesmos códigos e valores, e `getByText` com literal numérico. Uma
varredura preliminar não achou nada — **e isso não dispensa a busca**. Foi a dedução equivalente que
falhou na ESPEC 031 e custou seis vermelhos.

**A armadilha da busca 5, registrada antes:** o `12.030.00002.00` é o mesmo código que a ESPEC 019
§2.7 usa para provar que os itens excluídos **não estão** na tabela do `PA-SMIT-260319-739`. Um
teste que afirme a ausência dele **naquele** documento continua correto e não tem relação com o
SMUL. Confundir os dois faria alguém "corrigir" um teste que está certo.

**Pronto quando:** o inventário está fechado por escrito, com arquivo, linha e o que cada âncora
afirma, e a tabela da ESPEC §8.1 reflete o achado.

> **Executada — 2026-08-27.**
>
> **`backend/tests/`** — busca 1: `test_grade_contrato.py` (8 `montar_grade`, 2
> `_faixas_verticais`, 3 `analisar_geometria`), `test_extractor_aditivo.py` (4) e
> `test_cauda_de_pagina.py` (1 `ler_celulas`, 2 `montar_grade`); **nenhum passa
> parâmetro novo**, então a bandeira com padrão é segura. Busca 2:
> `test_domain.py:64` e `:71`, os dois parametrizados. Busca 3: as asserções de
> admissão em `test_extractor_aditivo.py:165-166`, `:228` e
> `test_grade_contrato.py:356-358`. Busca 4: âncoras em `pacote.py`,
> `test_capa.py`, `test_docx_formatacao.py` e `test_identidade_dos_artefatos.py`.
> Busca 5: **zero** ocorrências do código e dos valores do SMUL.
>
> **`frontend/e2e/`** — busca 6: **zero**. Medição, não dedução.

---

#### T-2194 — Linha de base do navegador `[risco]`
**Tamanho:** PP · **Ref:** PLANO, Estado inicial

**O backend já está medido nesta árvore:** `1.422 passed, 1 warning in 930,51s`, zero falhas.
Registrado no cabeçalho deste documento.

Falta o navegador: `npx playwright test`, com o backend no ar em `127.0.0.1:8000`. A ESPEC 032
fechou em `119 passed, 1 failed`, e o `I-06` daquele backlog registrou **duas** intermitentes
distintas em três execuções, ambas em estados que exigem geração completa, ambas passando isoladas.

Registrar o conjunto exato de falhas **antes**, para que a `T-2219` possa separar herdado de novo.

**Pronto quando:** o número e a lista de falhas estão neste documento.

> **Executada — 2026-08-27.** `119 passed, 1 failed` em 17,6 min — **o mesmo
> número da linha de base da ESPEC 032**, e uma falha **diferente** das duas do
> `I-06`: `a11y-estrutura.spec.ts:252 › T-543 — 14.049.00054.00 aparece na lista
> e na triagem`.
>
> A linha de base do navegador teve, portanto, de ser medida **depois** da
> mudança e reconferida no `HEAD` — ver `T-2219`, que é onde a investigação está.

---

#### T-2195 — As duas fixtures do SMUL
**Tamanho:** PP · **Ref:** `D-08`, PLANO §6

`contrato_smul.pdf` (a proposta `PC-SMUL-240916-136 v2.0`) e `aditivo_smul.pdf` (o aditivo
`PA-SMUL-250314-22 v5.0`) em `tests/fixtures/`, com fixtures de sessão no `conftest.py` no padrão
das existentes — `caminho_contrato_pgm`, `caminho_aditivo_pgm`.

O docstring de cada uma diz **por que ela está na suíte**, como o das outras: é o terceiro órgão, e
é o **único** documento do repositório com três tabelas de itens de larguras diferentes na mesma
folha.

**Só os PDFs.** O levantamento do SMUL fica fora, e não é só escopo: o hook de pré-commit casa
`SMIT.*Levantamento.*\.xlsx` e **não** pegaria um `SMUL_Levantamento…xlsx` com a aba de dados
pessoais (`I-04`).

**Pronto quando:** os dois arquivos estão versionados, com o `sha256` de cada um registrado aqui, e
as fixtures resolvem.

> **Executada — 2026-08-27.** `contrato_smul.pdf`
> (`5e07d78fb2aec513…`, 850.159 bytes) e `aditivo_smul.pdf`
> (`2d917e92a4a0d6e0…`, 342.386 bytes), com as duas fixtures de sessão no
> `conftest.py`.

---

#### T-2196 — A régua, instrumentada
**Tamanho:** P · **Ref:** **P2**, **P3**, regra 1

Um script fora de `src/` — `scripts/medir_extracao.py`, no precedente do
`scripts/diagnostico_grade_contrato.py` — que abre cada peça do corpus e imprime, por documento:

```
itens · total declarado · soma dos totais · blocos (rótulo, n, total) · geometrias admitidas · sha
```

O `sha` é o `sha256` da lista de tuplas `(código, descrição, unidade, quantidade, preço, meses,
total, página)` de **todos** os itens.

**Precisa ser script, e não célula de teste**, porque é reexecutado três vezes — `T-2197`, `T-2211`
e `T-2216` — e porque a `T-2211` o roda com o SMUL **ainda quebrando**, que é estado que teste
nenhum aceita.

**Pronto quando:** roda sobre os onze documentos e imprime a tabela.

> **Executada — 2026-08-27.** `scripts/medir_extracao.py`. O corpus versionado
> são **sete** arquivos: as dez linhas da ESPEC §8.2 são estes seis mais quatro
> repetições — conferido por `sha256` **do arquivo**, `contrato.pdf` é byte a
> byte o `PA-SMIT-260319-739`, `contrato_pgm.pdf` o `PA-PGM-251015-159` e
> `aditivo_pgm.pdf` o `PA-PGM-260304-715`. A décima peça, o
> `PA-PGM-260818-201_TESTE`, não é versionada.

---

#### T-2197 — Congelar a régua `[portão]`
**Tamanho:** PP · **Ref:** **P2**, regra 1

Rodar a `T-2196` na árvore parada e registrar aqui a tabela de dez linhas. Este é o **"antes"**
desta entrega.

O esperado, medido no protótipo:

| documento | itens | total | blocos | geom. | `sha` |
|---|---|---|---|---|---|
| `contrato.pdf` | 60 | 10.637.425,00 | 1 | 1 | `430e506c…` |
| `contrato_pgm.pdf` | 47 | 24.551.037,72 | 1 | 1 | `b8a7117b…` |
| `aditivo_pgm.pdf` | 7 | −0,12 | 3 | 3 | `0e7ec8ef…` |
| `modelo.pdf` | 0 | — | 0 | 0 | `4f53cda1…` |
| `amostra_sem_tabela.pdf` | 0 | — | 0 | 0 | `4f53cda1…` |
| `PA-SMIT-260319-739` | 60 | 10.637.425,00 | 1 | 1 | `430e506c…` |
| `PA-PGM-251015-159` | 47 | 24.551.037,72 | 1 | 1 | `b8a7117b…` |
| `PA-PGM-260304-715` | 7 | −0,12 | 3 | 3 | `0e7ec8ef…` |
| `PA-PGM-260818-201` | 0 | — | 0 | 0 | `4f53cda1…` |
| `PC-SMUL-240916-136` | 41 | 27.415.244,95 | 1 | 1 | `6d0df306…` |

**Diferença aqui reprova a fase, e não é reancoragem** — é sinal de que a árvore não é a que a
espec mediu.

**Pronto quando:** a tabela desta tarefa bate com a de cima, valor por valor.

> **A árvore está limpa, então o "antes" coincide com o `HEAD`.** É a primeira vez em três entregas
> que coincide — e ainda assim se mede, porque a coincidência é circunstância, não garantia.

> **Executada — 2026-08-27.** A tabela saiu **idêntica** à da espec, valor por
> valor, com os blocos: `None:60`, `AUMENTO:47`, e os três do aditivo do PGM
> (`AUMENTO:4:884902.44`, `REDUCAO:1:-897734.40`, `INCLUSAO:2:12831.84`).

---

#### T-2198 — Remedir as faixas da página 4
**Tamanho:** PP · **Ref:** `R-FXA-01`, ESPEC §2.1

As cinco faixas de oito divisórias da página 4 do `aditivo_smul.pdf`, com os valores por extenso:

```
 28,5– 80,7  Inclusão    38.7 99.9 230.1 299.7 379.5 429.3 462.9 515.1
 80,7–201,3  Inclusão    38.7 99.9 230.7 299.7 378.9 428.7 462.3 515.1
258,3–363,9  Redução     38.7 99.9 230.1 299.7 343.5 378.9 428.7 516.9
418,5–561,3  Aumento     38.7 99.9 230.1 299.7 343.5 378.9 431.7 515.1
693,3–807,3  cronograma  38.7 82.5 147.9 213.3 278.7 344.1 409.5 474.9
```

Conferir também o mecanismo do §2.3: as 22 candidatas verticais da página são a **união** das
quatro tabelas, e nela toda coluna de toda geometria tem correspondência **exata**.

**Pronto quando:** os cinco conjuntos conferidos nesta árvore, e o resultado de
`_fronteiras_verticais` registrado para as cinco candidatas.

**Verificação:** `P0` (primeira metade).

> **Executada — 2026-08-27, e ela achou um erro na espec `[risco]`.**
>
> As cinco faixas conferem, valor por valor. **O mecanismo do §2.3 não.** A v1.0
> dizia que a geometria da `Inclusão` casava sobre a `Redução` por três folgas de
> 0,6 pt dentro de `TOLERANCIA = 1.5`. Medido com `_fronteiras_verticais` sobre a
> página 4: **as cinco candidatas saem idênticas ao seu gabarito**, sem um único
> ajuste. A tolerância não é exercida.
>
> A causa real é mais simples e mais séria: as 22 candidatas verticais da página
> são a **união** das quatro tabelas, e nela toda coluna de toda geometria tem
> correspondência **exata**. É a `R-GRD-03` — *"a página entra quando contém o
> gabarito"* — funcionando como escrita, numa folha para a qual não foi pensada.
>
> A espec foi para **v1.1**: §2.3 reescrita com os `cx` dos seis tokens da linha,
> e `D-04` restabelecida por outra razão — não se mexe em `TOLERANCIA` porque ela
> **não participa** do defeito, e não porque baixá-la quebraria algo. A correção
> e todas as medições de não-regressão não mudam.

---

## 4. Épico E1 — Os testes, escritos antes `[portão P0]`

#### T-2199 — Módulo `test_grade_por_faixa.py`
**Tamanho:** P · **Ref:** `R-FXA-01`, `R-FXA-02`

As divisórias que valem em cada linha da página 4, faixa por faixa, com os valores da `T-2198` por
extenso. É a tabela do §2.1 da espec virando asserção.

Inclui o caso de `R-FXA-02`: havendo duas faixas de oito cobrindo a mesma linha, vale a **mais
estreita**.

**Pronto quando:** o módulo existe e reprova contra o `HEAD` por a função não existir.

> **Executada — 9 testes.** Oito parametrizados por altura na página 4, um por
> faixa, mais o contraste entre as duas grades na linha do `12.030.00002.00`.
>
> **A grade da fixture é a da `Inclusão`, e é de propósito**: é a campeã de
> `R-GRD-02` e é ela que hoje lê a folha inteira. Todas as asserções, inclusive
> as da `Redução` e do `Aumento`, saem dessa mesma grade — o que elas provam é
> que a **linha** vence a página, e não que a geometria certa foi escolhida.

---

#### T-2200 — A herança da linha `TOTAL:` `[risco]`
**Tamanho:** PP · **Ref:** `R-FXA-03`, `D-05`, regra 3

Os traços do `Redução TOTAL:` são `{428,7 · 516,9}`. Duas asserções:

1. o conjunto é subconjunto do da `Redução` → **herda**;
2. o conjunto **não** é subconjunto do da `Inclusão` — `516,9` não existe lá → **não herda**.

**É o único teste que reprova herança por proximidade.** Sem ele, a versão *"vale a última linha que
teve divisórias"* passa em tudo e quebra no primeiro documento com duas tabelas empilhadas.

**Pronto quando:** existe e reprova contra o `HEAD` por a herança não existir.

> **Executada — 5 testes.** Três de herança, um do subconjunto e um do branco
> entre blocos.
>
> O do subconjunto (`test_t2200_a_heranca_e_por_subconjunto_e_nao_por_proximidade`)
> não abre PDF: afirma sobre os conjuntos medidos que `{428,7 · 516,9}` cabe na
> `Redução` e **não** cabe na `Inclusão`. É a regra 3 deste backlog em forma de
> asserção, e reprova quem trocar a pertinência por proximidade.

---

#### T-2201 — A cobertura com espessura de traço
**Tamanho:** PP · **Ref:** `R-FXA-05`

`57,0` contra `57,7`: a fronteira horizontal é lida em `top` e o traço vertical começa na **base**
dela. Sem a tolerância de `ESPESSURA_MAXIMA_DO_TRACO`, **nenhuma** linha do piloto acharia a sua
faixa, e tudo cairia na página.

Caso construído, sem abrir PDF, no espírito de `_escolher_gabarito`: entrada de dados simples,
asserção sobre a escolha.

**Pronto quando:** existe, e cobre também o caso de folga insuficiente — faixa que **não** cobre a
linha.

> **Executada — 3 testes, nenhum abre PDF.** A `_PaginaDeTraços` implementa só
> `.rects`, que é tudo o que `_faixas_verticais` lê.
>
> Três casos: a faixa `57,7–99,7` cobre a linha `57,0–99,0`; uma que começa 3 pt
> abaixo **não** cobre; e entre duas que cobrem vale a mais estreita. O segundo é
> o que impede a folga de virar vizinhança generosa.

---

#### T-2202 — Os quatro valores da linha do `12.030.00002.00`
**Tamanho:** PP · **Ref:** `R-FXA-08`

Por extenso: quantidade `-200,00`, preço `986,81`, meses `5`, total `-986.810,00`.

**Pronto quando:** existe e reprova **com `sem preço unitário, meses` na mensagem** — não com
`FileNotFoundError` nem `AttributeError`. É o vermelho que prova que o defeito é o que a espec diz.

> **Executada — 2 testes.** Os quatro valores por extenso, e a conferência
> aritmética `quantidade × preço × meses == total` — que é o que amarra os quatro
> entre si, em vez de afirmar cada um isolado.

---

#### T-2203 — Os três blocos do SMUL
**Tamanho:** PP · **Ref:** `R-FXA-08`, `R-ADT-01`

`Inclusão` 12 itens / `1.304.002,55`; `Redução` 1 / `-986.810,00`; `Aumento` 3 / `47.601,38`. Total
declarado `364.793,93`, e `V-CTR-03` fechando.

**O rótulo importa tanto quanto o total.** Sem a herança da `T-2200`, o bloco `Redução` não fecha e
os seus itens migram para o `Aumento` — 4 itens sob o rótulo errado, com o checksum ainda fechando.
É o modo de falha que só este teste pega.

**Pronto quando:** existe e reprova contra o `HEAD`.

> **Executada — 3 testes.** Os três blocos com rótulo, contagem e total; o
> checksum contra o `364.793,93` impresso na peça; e a ausência de código
> repetido entre os 16 itens.
>
> O terceiro é a `R-ADT-12` sob a nova leitura: as quatro geometriais admitidas
> passam a produzir células idênticas para a mesma linha física, e a
> `linhas_vistas` as reduz a uma. Antes produziam quatro fatiamentos distintos, e
> nenhum deduplicava.

---

#### T-2204 — Os dez `sha`, como asserção `[risco]`
**Tamanho:** P · **Ref:** `R-FXA-07`, regra 1, **P2**

Para **cada** um dos dez documentos que hoje extraem: itens, total declarado, blocos, número de
geometrias admitidas e o `sha` do conjunto. Congelado em constante, no formato da `T-2197`.

**É o teste mais importante deste backlog.** É o único que separa *"corrigi o SMUL"* de *"corrigi o
SMUL sem quebrar o resto"*, e é ele que vai reprovar quem, meses depois, achar que a leitura por
faixa também serve para a admissão.

O número de geometrias admitidas entra na mesma asserção de propósito: é a `regra 2` virando teste.

**Pronto quando:** existe e **passa já** contra o `HEAD`. Reprovar aqui significaria que a régua da
`T-2197` não é a desta árvore.

> **Executada — 6 testes, parametrizados por fixture, e verdes contra o `HEAD`.**
>
> Parametrizado, e não um teste só com um laço: a mensagem de falha precisa dizer
> **qual** documento se moveu. `_medida` reproduz exatamente o que o
> `scripts/medir_extracao.py` imprime, para que a régua da suíte e a régua da mão
> não possam divergir.

---

#### T-2205 — `para_decimal`
**Tamanho:** PP · **Ref:** `R-NUM-01`, `D-06`

Muda: `'BRL - 986.810,00'` → `-986810.00`.

Não muda: `'BRL -986.810,00'` → `-986810.00`; `'BRL 229,02'` → `229.02`; `'4.000,00'`, `'1500'`,
`'117,2889'`; e `'PACOTE'`, `'Perfil D'`, `'- '`, `''` → `None`.

**E o caso que a `D-06` protege:** `'BRL -200,00 986,81'` — a célula fundida do §2.4 — continua
`None`. Uma normalização que remova todo espaço interno faria essa célula parar de ser recusada por
sorte, e a guarda de `_montar_item` deixaria de denunciar tabela truncada.

**Pronto quando:** existe e reprova **só** no primeiro caso.

> **Executada — 8 casos novos**, de 10 para 18. A conversão foi de 5 para 9
> (`'BRL - 986.810,00'`, `'BRL -986.810,00'`, `'- 200,00'`, `'+ 1.500'`) e a
> recusa de 5 para 9 (`'-'`, `'- '`, `'BRL -200,00 986,81'`, `'BRL 7,48 697,00'`).
>
> As duas últimas são as células fundidas que a grade errada produzia, e estão ali
> **como recusa**: é a `D-06` virando teste. Quem generalizar a normalização para
> remover todo espaço interno reprova nelas.

---

#### T-2206 — O portão `[portão]`
**Tamanho:** PP · **Ref:** **P0**

Rodar tudo contra o `HEAD` e preencher a tabela do `P0`, teste a teste, com a asserção que cada um
acusou.

O esperado: `T-2199` a `T-2203` reprovam, e a `T-2202` reprova com a mensagem `sem preço unitário,
meses`; `T-2204` **passa já**; `T-2205` reprova só no caso do sinal.

> **Os que passam antes de qualquer código novo são resultado, não folga.** Eles afirmam o que
> **não** muda. Reprovando aqui, a premissa da entrega estaria errada antes de começar.

**Verificação:** `P0`.

> **Executada — `P0` cumprido.** Contra o `HEAD`:
>
> | módulo | resultado | motivo |
> |---|---|---|
> | `test_grade_por_faixa.py` | erro de coleta | `ImportError: verticais_por_linha` |
> | `test_extractor_aditivo_smul.py` (T-2202/03) | 5 erros | `ExtractionError: item 12.030.00002.00 (página 4) sem preço unitário, meses` |
> | `test_extractor_aditivo_smul.py` (T-2204) | **6 passed** | a régua já vale |
> | `test_domain.py` | 3 failed, 51 passed | só os três casos de sinal |
>
> O vermelho do SMUL saiu **com a mensagem da espec**, e não com `AttributeError`.

---

## 5. Épico E2 — As divisórias por linha, sem chamador `[portão P1]`

#### T-2207 — A função em `grid.py`
**Tamanho:** PP · **Ref:** `R-FXA-01` a `R-FXA-05`

Recebe página e grade; devolve, **para cada linha**, as divisórias que valem:

1. a faixa própria de oito que cobre a linha — a **mais estreita**, se houver mais de uma;
2. não havendo, as da linha anterior, **se os traços desta linha forem subconjunto delas**;
3. não havendo, as da página.

Mora em `grid.py` porque é decisão sobre **fronteiras**, e é lá que as outras moram — o limite
sintético do rodapé, o casamento de divisórias, a atribuição por centro, o crivo da cauda.

**O docstring precisa carregar o caso real**, e não a regra abstrata: os traços `{428,7 · 516,9}` do
`Redução TOTAL:`, e a razão de `516,9` não pertencer ao conjunto da `Inclusão`. Quem ler daqui a um
ano tem de encontrar o porquê no lugar da decisão.

**Pronto quando:** `T-2199`, `T-2200` e `T-2201` verdes.

> **Executada.** `verticais_por_linha` e o auxiliar `_faixa_mais_estreita`.
>
> **Uma decisão tomada na escrita, e ela é o que impede a herança de vazar:** o
> `anterior` só é atualizado quando a linha tem faixa **própria** de oito. O ramo
> de fallback devolve as divisórias da página **sem** tocá-lo — senão o branco
> entre dois blocos herdaria da tabela de cima e passaria a herança adiante, para
> a tabela de baixo, e a corrente atravessaria a folha inteira.

---

#### T-2208 — O parâmetro em `ler_celulas` `[risco]`
**Tamanho:** PP · **Ref:** `R-FXA-06`, `D-03`, regra 2

`ler_celulas` ganha o parâmetro de leitura por faixa, **com o padrão sendo o comportamento de
hoje**.

Nenhum chamador existente o passa, logo nenhum chamador existente muda — a fase é inerte por
construção, e não por cuidado. `_linhas`, usada por `_geometrias_de_itens`, **não** é tocada.

**Pronto quando:** a suíte de backend está idêntica à `T-2194`, teste a teste.

> **Executada.** `ler_celulas(pagina, grade, por_faixa=False)`.
>
> O padrão é o comportamento de hoje, e nenhum chamador existente passa a
> bandeira: a fase é inerte **por construção**. `_linhas` não foi tocada, e é ela
> que serve `_geometrias_de_itens` — a regra 2 deste backlog vive nessa linha que
> não mudou.

---

#### T-2209 — O portão do instante em que nada mudou `[portão]`
**Tamanho:** PP · **Ref:** **P1**, PLANO §1

A régua da `T-2196` reexecutada: os dez `sha` idênticos à `T-2197`, sem uma diferença. Suíte de
backend idêntica à linha de base.

**A função está inteira e ninguém a chama.** É a régua forte — não há nada a julgar: ou é idêntico,
ou algo vazou para o extrator antes da hora.

**Pronto quando:** os dez batem e a contagem da suíte não se move.

**Verificação:** `P1`.

> **Executada — `P1` cumprido.** 17 verdes em `test_grade_por_faixa.py`. Os 108
> testes dos seis módulos que tocam a grade — `test_grade_contrato`,
> `test_extractor_aditivo`, `test_cauda_de_pagina`, `test_extractor_contract`,
> `test_extractor_contrato_pgm`, `test_blocos_de_itens` — verdes e sem mudança.
> A régua reproduziu a `T-2197` linha por linha, **com o SMUL ainda falhando pela
> mensagem original**: a função existe e ninguém a chama.

---

## 6. Épico E3 — A linha do laço `[portão P2]`

#### T-2210 — O laço lê por faixa
**Tamanho:** PP · **Ref:** `R-FXA-06`

Uma linha em `pdfplumber_extractor.py`: o laço de extração passa a ler por faixa.

**`_linhas` continua como está** (regra 2). A admissão é decisão da ESPEC 019, e esta entrega não a
reabre.

**Efeito colateral esperado, e bem-vindo:** com divisórias por linha, as quatro geometrias admitidas
do SMUL passam a produzir células **idênticas** para as mesmas linhas físicas, e a `linhas_vistas`
as reduz a uma. Hoje elas produzem quatro fatiamentos diferentes da mesma linha.

**Pronto quando:** `T-2202` e `T-2203` avançam do erro de preço/meses para o erro de total.

> **Executada — uma linha, mais o comentário que a explica.**
>
> `caudas_costuradas` e `linhas_vistas` já existiam da ESPEC 032 e da 019, e é o
> que fez a mudança caber em uma linha: a dedução de linha repetida por várias
> geometrias já estava resolvida — só faltava as geometrias concordarem sobre
> onde a linha é cortada.

---

#### T-2211 — Os dez `sha`, reexecutados `[portão]`
**Tamanho:** PP · **Ref:** **P2**, regra 1

A régua da `T-2196`, comparada com a `T-2197`. Dez linhas idênticas — itens, total, blocos,
geometrias e `sha`.

**Pronto quando:** os dez batem. Um que não bata reprova a fase, e a resposta é reverter a `T-2210`
— **nunca** reancorar (regra 4).

> **Executada.** Os seis `sha` idênticos à `T-2197`, com totais, blocos e
> geometrias. Nada a reancorar.

---

#### T-2212 — A mensagem prevista `[portão]`
**Tamanho:** PP · **Ref:** **P2**, PLANO §1

O SMUL **ainda falha**, e falha com:

```
item 12.030.00002.00 (página 4) sem valor total — extração incompleta da tabela do contrato
```

**Mensagem diferente reprova a fase.** Terminar um épico com o documento-alvo ainda quebrado é
deliberado: é o que prova que a leitura por faixa entregou o que promete, e que o segundo defeito é
mesmo independente. Corrigir os dois juntos deixaria isso por conta da fé.

**Pronto quando:** a mensagem é exatamente essa.

> **Executada — `P2` cumprido, e o portão pagou-se.**
>
> `item 12.030.00002.00 (página 4) sem **valor total** — extração incompleta da
> tabela do contrato`. Exatamente a mensagem prevista, no mesmo item: a leitura
> por faixa entregou os quatro valores da linha e o que restou foi o sinal.

---

#### T-2213 — As linhas do cronograma
**Tamanho:** PP · **Ref:** ESPEC §8.3

Confirmar que as linhas que mudam de leitura nos quatro documentos que já passam são **as do
cronograma, e só elas**: 12 na p29 do piloto, 15 na p25 do PGM, 14 na p7 do aditivo, 14 na p13 da
proposta SMUL.

Conferir as duas razões de elas não entrarem na extração: nenhuma tem código de serviço, e o
cronograma grafa `TOTAL` **sem dois-pontos**, enquanto `_MARCA_TOTAL` exige os dois-pontos.

**Esta tarefa não é opcional.** É a diferença entre saber que o cronograma mudou e descobrir na
depuração — o falso positivo que quase custou uma investigação no PLANO 032 §9.

**Verificação:** `P2`.

> **Executada.** 12 · 15 · 14 · 14 linhas mudam de leitura, nas páginas 29, 25,
> 7 e 13 — e das **55**, `com código de serviço = 0` e `com 'TOTAL:' = 0` nas
> quatro peças. São as linhas do cronograma, e saem **melhores**:
> `['Mês 01', 'R$ 115.082,55 R$ 2.166,83', …, 'R$', '4.657,58', …]` passa a
> `['Mês 01', 'R$ 115.082,55', 'R$ 2.166,83', …, 'R$ 4.657,58', …]`.

---

## 7. Épico E4 — O sinal `[portão P3]`

#### T-2214 — `para_decimal` normaliza o sinal
**Tamanho:** PP · **Ref:** `R-NUM-01`, `D-06`

O espaço entre o sinal e os dígitos, e **nada mais**.

**Pronto quando:** `T-2205` verde.

> **Executada.** `re.sub(r"^([+-])\s+", r"\g<1>", limpo)`.
>
> **`\g<1>` e não `\1`, e há uma razão prática:** durante a prototipagem a
> substituição foi escrita num literal não-cru e `\1` virou o caractere `SOH`
> — a normalização passou a **apagar** o sinal, e o efeito só apareceu porque
> `para_decimal('BRL - 986.810,00')` continuou devolvendo `None`. `\g<1>` não
> tem essa ambiguidade em contexto nenhum.

---

#### T-2215 — O SMUL fecha `[portão]`
**Tamanho:** PP · **Ref:** **P3**, `R-FXA-08`

16 itens, 3 blocos, `364.793,93`, `V-CTR-03` fechando. `T-2202` e `T-2203` verdes.

O `364.793,93` é o valor impresso na própria peça — **o oráculo não é o código**.

> **Executada — `P3` cumprido.** 16 itens; `INCLUSAO:12:1304002.55`,
> `REDUCAO:1:-986810.00`, `AUMENTO:3:47601.38`; total e soma em `364793.93`.

---

#### T-2216 — Os dez `sha`, de novo `[portão]`
**Tamanho:** PP · **Ref:** **P3**, regra 1

A régua pela terceira vez. Os dez continuam idênticos à `T-2197`.

**Parece redundante depois da `T-2211`, e não é:** a `T-2214` mexeu numa função do domínio que a
extração de **todos** os documentos usa, quatro vezes por item.

> **Executada.** Os seis `sha` idênticos pela terceira vez.

---

#### T-2217 — O alcance da normalização, remedido
**Tamanho:** PP · **Ref:** `D-06`, ESPEC §2.6

Reproduzir a varredura: comparar resposta antiga e nova, célula a célula, sobre os dez PDFs (as duas
leituras, todas as geometrias) e as três planilhas `Levantamento`.

O esperado: **7.882** células de PDF e **428** de planilha; **uma** cadeia distinta muda de
resposta — `'BRL - 986.810,00'`, que aparece 6 vezes porque é lida por mais de uma geometria.

Mais de uma cadeia distinta reprova a fase: não seria a `R-NUM-01`.

**Verificação:** `P3`.

> **Executada.** 7.882 células de PDF e 428 de planilha; **6** respostas mudam,
> todas a mesma cadeia `'BRL - 986.810,00'` — lida seis vezes porque mais de uma
> geometria alcança aquela linha. Zero mudanças nas três planilhas.

---

## 8. Épico E5 — As duas suítes `[portão P4]`

#### T-2218 — Backend completo
**Tamanho:** PP · **Ref:** **P4**

`python -m pytest`. 1.422 na entrada mais os desta entrega; o número de saída vira **número
declarado**.

> **Executada — `1458 passed, 1 warning in 1010.23s`. Zero falhas.**
> 1.422 na entrada mais 36 desta entrega. **1.458 é o número declarado.**

---

#### T-2219 — Navegador completo `[risco]`
**Tamanho:** PP · **Ref:** **P4**

`npx playwright test`, com o backend no ar.

**Não deduzir que ela não se moveu.** Esta entrega não muda nada do que a tela recebe — e foi
exatamente esse raciocínio que falhou na ESPEC 031, logo depois de escrito.

Comparar contra a lista da `T-2194`: falha nova reprova; as intermitentes do `I-05` não.

> **Executada — e a falha é pré-existente, provado em três passos `[risco]`.**
>
> `119 passed, 1 failed (17.6m)`. A falha é
> `a11y-estrutura.spec.ts:252 › T-543 — 14.049.00054.00 aparece na lista e na
> triagem`: `Expected: 2 · Received: 1`, contando `<td>` com aquele código.
>
> **1. Não é intermitente.** Reprova isolada, no arquivo sozinho e com `-g`.
> Determinística, ao contrário das duas do `I-06`.
>
> **2. Não é desta entrega.** `git stash` **só dos três arquivos de `src/`**,
> backend reiniciado no `HEAD`, mesmo teste: `Expected: 2 · Received: 1`,
> idêntico. **Sem uma linha desta entrega, falha igual.**
>
> *A primeira tentativa deste passo não valeu, e vale registrar por quê:* o
> `uvicorn` antigo sobreviveu ao fim da tarefa de fundo, o servidor do `HEAD`
> não conseguiu ligar em `:8000` (`Errno 10048`) e o teste rodou contra o
> processo que ainda tinha **o código modificado em memória**. O log do backend
> foi quem denunciou. Um "reproduz no `HEAD`" obtido assim teria sido falso.
>
> **3. A causa está em outra entrega, e há contradição interna que a prova.**
> `analise.spec.ts:183` — **verde nesta mesma execução** — afirma o oposto:
>
> ```ts
> await expect(critico.getByText("14.049.00054.00")).toHaveCount(0);
> ```
>
> com o comentário da ESPEC 031: *"o `14.049.00054.00` saía `0 / 2` (…); com
> `0 = 0` ele deixou de ser crítico"*. Um teste afirma que o código **está** na
> triagem crítica; o outro, que **não está**. O `a11y-estrutura` ficou sem
> reancorar quando a apuração descontada mudou.
>
> **Não é corrigido aqui** (regra 4): reancorar teste de outra entrega dentro
> desta misturaria o diff e apagaria a linha vermelha de quem for investigar.
> Registrado como `I-06`.

---

#### T-2220 — Nada foi reancorado `[portão]`
**Tamanho:** PP · **Ref:** **P4**, regra 4

`git diff` de `backend/tests/`: só arquivos **novos**. `test_capa`, `test_identidade_dos_artefatos`,
`test_docx_formatacao`, `pacote.py` e `linhas_do_documento.json` **intocados**.

**É o portão invertido desta entrega.** Nos incrementos anteriores a tarefa equivalente conferia que
a reancoragem foi feita direito; aqui ela confere que não houve nenhuma.

**Pronto quando:** o `git diff` de `backend/tests/` não contém uma única constante alterada.

> **Executada — `P4`.** O `git diff` de `backend/tests/` tem **63 inserções e
> 1 deleção**, e a deleção é a linha do `@parametrize` de `test_domain.py` que
> foi expandida para várias linhas. **Nenhuma constante com valor novo.**
>
> `test_capa.py`, `test_identidade_dos_artefatos.py`, `test_docx_formatacao.py`,
> `pacote.py` e `linhas_do_documento.json` **não aparecem no `git status`**.

---

#### T-2221 — `ruff` e `mypy`
**Tamanho:** PP · **Ref:** **P4**

Sobre os arquivos tocados. O `I001` de `test_divergencia_de_fonte.py` é anterior a esta entrega e às
anteriores; **não corrigir aqui** — misturaria o diff.

> **Executada.** `ruff` limpo nos oito arquivos e `mypy src/` com
> `Success: no issues found in 55 source files`.
>
> O `scripts/medir_extracao.py` entrou com três `# noqa: E402` copiados do
> `diagnostico_grade_contrato.py`, e o `ruff` os apontou como `RUF100`: `E402`
> não está no `select` do projeto. Corrigidos **no arquivo novo**; os do script
> anterior ficam onde estão, por serem de outra entrega.

---

#### T-2222 — `README.md`, `CHANGELOG.md` e o `Status` da espec
**Tamanho:** PP

A linha do incremento 033; a entrada de rumo; e o `Status` da ESPEC 033 de **Proposta** para
**Implementada**, com os números medidos.

**A entrada do `CHANGELOG` desta vez é quase toda sobre o que não mudou** — dez `sha` idênticos,
nenhum artefato reancorado — e sobre a razão de a ESPEC 019 §2.4 ter deixado a metade que faltava:
as três geometrias daquele aditivo estavam em páginas diferentes, e a premissa *uma tabela por
página* sobreviveu porque a amostra não a contrariava.

**Verificação:** `P4`.

> **Executada.** Linha do incremento 033 no `README.md`; entrada de rumo no
> `CHANGELOG.md`; `Status` da espec para **Implementada** e versão **1.1**.
>
> A entrada do `CHANGELOG` registra também **o que a execução corrigiu na
> espec** — a §2.3 atribuía o defeito à `TOLERANCIA`, e a `T-2198` mediu que
> ela não é sequer exercida.

---

## 9. Insumos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | Existe contrato cuja linha de item **não** tenha oito traços na sua faixa **e** divida a folha com outra tabela de largura diferente? Nem faixa própria nem herança respondem | Não. Nenhum dos dez documentos o exercita, e o caso termina em `ExtractionError` ou em `V-CTR-03` — nunca em número errado calado |
| `I-02` | A `Inclusão` do SMUL rende duas candidatas para uma tabela só, por 0,6 pt de deriva. Vale consolidar candidatas quase iguais na descoberta? | Não. Com a leitura por faixa as duas passam a produzir células idênticas. Seria desempenho, não correção |
| `I-03` | Três das cinco geometrias do SMUL só existem porque o cabeçalho quebra linha. Vale medir a família toda de propostas? | Não. A regra não depende de quantas geometrias há |
| `I-04` | **O hook de pré-commit casa `SMIT.*Levantamento.*\.xlsx` e não pegaria `SMUL_Levantamento…xlsx`.** A guarda de dados pessoais está presa ao nome de um órgão | Não bloqueia esta entrega, que não traz planilha. **Vale uma correção própria**, e é pequena: alargar o padrão e conferir o `scripts/sanitize_fixture.py` para o novo par |
| `I-05` | As intermitentes do `I-06` do TASKS 032 — duas falhas distintas em três execuções, ambas em estados que exigem geração completa, ambas passando isoladas | Não. Nenhuma é regressão de produto; vale investigação própria |
| `I-06` | **`a11y-estrutura.spec.ts:252` contradiz `analise.spec.ts:183`.** Um espera o `14.049.00054.00` em duas vistas; o outro afirma que ele **não** está na triagem crítica, e traz o comentário da ESPEC 031 que explica por quê. O primeiro ficou sem reancorar quando a apuração descontada mudou | Não bloqueia esta entrega — provado que reprova no `HEAD` sem uma linha dela (`T-2219`). **Bloqueia a leitura da suíte de navegador**, que fica com um vermelho permanente até alguém decidir qual dos dois testes está certo |

---

## 10. Emenda de execução

**2026-08-27.**

**A `T-2198` achou um erro na espec antes de a espec virar código, e é o melhor resultado deste
backlog.** A v1.0 explicava o defeito pela `TOLERANCIA = 1.5`: a geometria da `Inclusão` casaria
sobre a `Redução` por três folgas de 0,6 pt. Medido com `_fronteiras_verticais` na fixture: **as
cinco candidatas saem idênticas ao seu gabarito**, sem um único ajuste. A causa é outra e mais
simples — as 22 candidatas verticais da página são a **união** das quatro tabelas, e nela toda
coluna de toda geometria tem correspondência exata.

A correção não mudou uma linha; a explicação mudou inteira. Se a tarefa fosse *"implementar o que a
espec diz"*, o erro teria sobrevivido ao incremento e envenenado a próxima análise da mesma área —
alguém mexeria em `TOLERANCIA` procurando um defeito que não está lá.

**A ordem das duas correções pagou-se exatamente onde o plano disse que pagaria.** No fim da `F3` o
SMUL continuava quebrado, com `sem valor total` — a mensagem prevista, no mesmo item. Fosse outra,
a leitura por faixa não teria feito o que promete, e teríamos descoberto isso com o segundo defeito
ainda por cima.

**O portão invertido funcionou como pergunta, não como cerimônia.** Três execuções da régua — antes,
no meio e no fim —, e os seis `sha` iguais nas três. Em nenhum momento houve a dúvida *"será que
posso reancorar isto?"*, porque a resposta estava escrita antes: não.

**O `P1` provou-se inerte por construção, e não por cuidado.** A bandeira de `ler_celulas` nasceu com
o padrão de hoje; nenhum chamador existente a passa. Os 108 testes dos seis módulos da grade ficaram
verdes com a função inteira dentro do arquivo e ninguém a chamando.

**A suíte de navegador custou o dobro do previsto, e o custo foi de investigação, não de execução.**
`119 passed, 1 failed` — o mesmo número da linha de base —, mas com uma falha de nome novo. Provar
que ela era pré-existente exigiu três passos (`T-2219`), e o **segundo deles quase saiu falso**: o
`uvicorn` antigo sobreviveu ao fim da tarefa de fundo, o servidor do `HEAD` não conseguiu ligar na
porta, e o teste rodou contra o processo que ainda tinha o código modificado em memória. O log do
backend denunciou; sem ele, o registro diria *"reproduz no `HEAD`"* apoiado numa medição que não
mediu nada.

**Lição operacional, e ela é nova neste projeto:** *matar a tarefa de fundo não mata o servidor*.
Quem for repetir o passo 2 desta investigação tem de conferir a porta, e não a tarefa.

**A contradição que a falha revelou é de outra entrega.** `a11y-estrutura.spec.ts:252` e
`analise.spec.ts:183` afirmam coisas opostas sobre o mesmo código, e o segundo carrega o comentário
da ESPEC 031 que explica a mudança. Não foi corrigido aqui: reancorar teste alheio dentro desta
entrega misturaria o diff e apagaria a linha vermelha. Está no `I-06`.

**Resultado.** Backend **1.422 → 1.458 passed**, zero falhas. `ruff` e `mypy` limpos. Seis `sha` de
régua intactos; **nenhum artefato reancorado**. O `PA-SMUL-250314-22` extrai 16 itens em três blocos
e fecha em `364.793,93`, e o trio real — proposta, aditivo e levantamento — gera 53 linhas de
relatório sem achado bloqueante.
