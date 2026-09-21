# ESPEC 017 — A grade da tabela de itens é derivada do documento

| | |
|---|---|
| **Status** | **Implementada** — 2026-08-12. Portões P1 a P4 fechados. Duas emendas em §14 |
| **Versão** | 1.1 — 2026-08-12 — implementada |
| **Depende de** | [ESPEC 001](001-mvp-analise-medicao.md) — implementada |
| **Revisa** | O **meio** pelo qual a ESPEC 001 §9.4 localiza a tabela de itens, não a intenção. Ver `D-05` |
| **Referência normativa** | `docs/documentos/PA-SMIT-260319-739 Q-00739-7.pdf` (piloto) e `docs/documentos/PA-PGM-251015-159 v5.0.pdf` (o contrato que falhou) |
| **Instrumento** | `scripts/diagnostico_grade_contrato.py` — reconstrói a decisão de `montar_grade()` e aponta em qual filtro a página caiu |
| **Origem** | Processamento bloqueado com 57 mensagens de erro ao submeter o `PA-PGM-251015-159` |

---

## 1. Problema

Ao submeter o contrato `PA-PGM-251015-159 v5.0`, a aplicação bloqueia o processamento e exibe
57 achados: um `V-CTR-01`, um `V-CTR-03` e **55** `V-CTR-02`, um para cada entrada visível do
catálogo.

Há **um** defeito, e os outros 56 achados são consequência aritmética dele. `V-CTR-01` dispara
quando `Contract.itens` está vazio; com a lista vazia, `quantidade_para()` devolve `None` para
todo código, e `total_declarado` fica `None`. A tela apresenta 57 mensagens das quais uma é
acionável — e ela sai da área visível na nona linha.

O extrator declara, no próprio cabeçalho, o princípio certo:

> *"A tabela é localizada por âncora de conteúdo — padrão do código e linha `TOTAL:` — e nunca
> por número de página fixo: um aditivo com uma página a mais deslocaria tudo."*

A grade, porém, é localizada por **coordenada absoluta**: `COLUNAS_DA_TABELA` guarda as posições
*x* das oito divisórias medidas no contrato-piloto, com tolerância de 1,5 pt. É uma dependência
mais frágil que o número de página que o comentário rejeita — um deslocamento de 0,53 mm na
margem derruba a extração inteira, sem exceção e sem sinal.

---

## 2. O que foi medido

Tudo nesta seção foi lido dos dois PDFs com o instrumento declarado no cabeçalho, e conferido
contra o extrator de produção. Nada é suposto.

### 2.1 A tabela do `PA-PGM` existe, está íntegra e é legível

Com o gabarito ajustado às divisórias reais do documento — e **nenhuma outra alteração** no
extrator, nas validações ou no catálogo:

| | piloto | `PA-PGM` |
|---|---|---|
| páginas da tabela | 26 a 29 | 22 a 25 |
| itens | 60 | **47** |
| códigos distintos | 57 | **46** |
| total declarado | 10.637.425,00 | **24.551.037,72** |
| soma dos totais | 10.637.425,00 | **24.551.037,72** |
| diferença (`V-CTR-03`) | 0,00 | **0,00** |

O checksum fechando exato é a prova de ponta a ponta que a `V-CTR-03` foi escrita para dar
(PLANO 001 D-03): nenhuma linha se perdeu. **O documento sempre esteve legível; o que não estava
era a régua.**

### 2.2 Defeito A — o gabarito é absoluto

A tabela do `PA-PGM` tem as mesmas sete colunas do piloto, em outra posição:

| coluna | piloto | `PA-PGM` | Δ | dentro de 1,5 pt? |
|---|---|---|---|---|
| 0 | 34,5 | 51,4 | +16,9 | |
| 1 | 117,0 | 122,3 | +5,3 | |
| 2 | 262,5 | 273,0 | +10,5 | |
| 3 | 352,5 | 353,6 | +1,1 | ✅ |
| 4 | 403,5 | 404,3 | +0,8 | ✅ |
| 5 | 447,7 | 445,3 | −2,4 | |
| 6 | 498,0 | 491,1 | −6,9 | |
| 7 | 561,0 | 551,5 | −9,5 | |

Duas das oito passam pelo filtro. `len(verticais) != 8`, `montar_grade()` devolve `None`, e as
páginas 22 a 24 são descartadas.

### 2.3 Defeito B — o filtro **conta** em vez de **casar**

Este é independente do primeiro, e não estava previsto no diagnóstico inicial.

[`_fronteiras_verticais`](../../backend/src/infrastructure/contract/grid.py) guarda **toda**
candidata que esteja a menos de 1,5 pt de **alguma** coluna esperada, e `montar_grade` depois
exige que sobrem exatamente oito. Na página 25 do `PA-PGM`, o quadro de totais mensais tem uma
divisória em **405,0** — a **0,7 pt** da divisória de itens em **404,3**:

```
pág 25, 15 candidatas → 9 aceitas   ✗ != 8  →  montar_grade devolve None
  coluna 404,3 recebe DUAS candidatas: [404,3  405,0]   Δ = 0,7 pt
```

A página inteira é descartada, e com ela os 5 itens que traz **e a linha `TOTAL:`**.

Duas consequências que decidem o desenho:

1. **O defeito B sobrevive à correção do defeito A.** Medido: corrigindo só o gabarito, a
   extração devolve 42 itens das páginas 22 a 24 e `total_declarado = None` — ou seja, continua
   bloqueando, agora por `V-CTR-03`. Corrigir A sem corrigir B **não resolve o caso**.
2. **O defeito B já está armado no piloto.** A página 29 tem a mesma estrutura — 15 candidatas,
   tabela de itens mais quadro de totais — e só escapa porque suas duas divisórias vizinhas
   estão a 3,0 pt uma da outra (403,5 e 406,5), o dobro da tolerância. É folga de 1,5 pt entre
   funcionar e não funcionar, num contrato que hoje funciona.

### 2.4 As proporções casam — mas não é um reescalonamento puro

| coluna | rel. piloto | rel. `PA-PGM` | Δrel | largura piloto | largura `PA-PGM` |
|---|---|---|---|---|---|
| 0 | 0,0000 | 0,0000 | +0,0000 | — | — |
| 1 | 0,1567 | 0,1418 | **−0,0149** | 82,5 | **70,9** |
| 2 | 0,4330 | 0,4431 | +0,0101 | 145,5 | 150,7 |
| 3 | 0,6040 | 0,6043 | +0,0003 | 90,0 | 80,6 |
| 4 | 0,7009 | 0,7057 | +0,0048 | 51,0 | 50,7 |
| 5 | 0,7848 | 0,7876 | +0,0028 | 44,2 | 41,0 |
| 6 | 0,8803 | 0,8792 | −0,0011 | 50,3 | 45,8 |
| 7 | 1,0000 | 1,0000 | +0,0000 | 63,0 | 60,4 |

O vão passa de 526,5 para 500,1 pt — razão 0,9499 — mas **as larguras não escalam juntas**: a
coluna `CÓDIGO` encolhe 14% enquanto a `DESCRIÇÃO` cresce 3,6%. Não é o mesmo template
reescalado; é o mesmo template com colunas retocadas.

Casar por proporção com tolerância de 0,02 funcionaria — o desvio máximo é 0,0149 —, **mas com
25% de folga**. Calibrar essa constante em cima do único par de contratos disponível é criar uma
constante mágica nova no lugar da que acabou de quebrar. Ver `D-03`.

### 2.5 O conjunto de oito divisórias **se repete entre páginas** — e isso dispensa a tolerância

É o achado que decide a espec.

**Piloto:**

```
3 páginas [26, 27, 28]  vão=526,5 pt (88% da largura)  51 códigos
  [34,5  117,0  262,5  352,5  403,5  447,7  498,0  561,0]

1 página  [30]          vão=507,8 pt (85% da largura)   0 códigos
  [53,2  100,5  181,5  256,5  336,7  406,5  486,7  561,0]

pág 25 (9 divisórias,  0 códigos) — CONTÉM o conjunto
pág 29 (15 divisórias, 6 códigos) — CONTÉM o conjunto
```

**`PA-PGM`:**

```
3 páginas [22, 23, 24]  vão=500,1 pt (84% da largura)  41 códigos
  [51,4  122,3  273,0  353,6  404,3  445,3  491,1  551,5]

pág 25 (15 divisórias, 5 códigos) — CONTÉM o conjunto
pág 31 (18 divisórias, 3 códigos) — não contém
pág 32 (9 divisórias,  1 código)  — não contém
```

Três fatos, e cada um sustenta uma parte da regra:

1. **O conjunto que interessa se repete idêntico, valor por valor, em três páginas** nos dois
   contratos. Não é aproximação: é igualdade.
2. **As páginas restantes da tabela o contêm** — a 25 e a 29 no piloto, a 25 no `PA-PGM` —
   junto com as divisórias do quadro de totais. É o caso do defeito B, e "contém" é a relação
   certa para descrevê-lo.
3. **Há um concorrente, e o desempate é por código de serviço.** A página 30 do piloto traz
   outro conjunto de oito, com 85% da largura — quase indistinguível por geometria. O que a
   separa é não ter **nenhum** código de serviço, enquanto o conjunto certo tem 51. As páginas
   31 e 32 do `PA-PGM` são outra tabela e não contêm o conjunto: ficam de fora sem precisar de
   desempate.

O critério que sai daí — *o conjunto de oito divisórias que se repete no maior número de
páginas, e cujas páginas concentram mais códigos de serviço* — **não usa coordenada absoluta nem
tolerância relativa**. Usa duas propriedades do negócio: a tabela de itens tem sete colunas, e é
onde estão os códigos de serviço.

### 2.6 O critério reproduz exatamente a seleção de páginas de hoje, no piloto

| página | hoje | pelo critério de §2.5 |
|---|---|---|
| 25 | grade | contém o conjunto → grade |
| 26, 27, 28 | grade | é o conjunto → grade |
| 29 | grade | contém o conjunto → grade |
| 30 | sem grade | conjunto concorrente, 0 códigos → descartado |
| demais | sem grade | 2 divisórias ou nenhuma → descartado |

Nenhuma página entra, nenhuma sai. É a base da garantia de não-regressão de §9.

### 2.7 A cascata vem de duas validações, não de todas

Medido em [`reconciliation_validations.py`](../../backend/src/infrastructure/validations/reconciliation_validations.py):
`v_cat_02` itera `contrato.codigos`, que está vazio, e não registra nada; `v_rec_01` sai no
`continue` quando `do_contrato is None`, que é sempre. **Só `V-CTR-02` e `V-CTR-03` cascateiam.**
O escopo do ajuste de apresentação é menor do que as 57 mensagens sugerem.

### 2.8 O que sobra depois da correção **não é defeito**

Com a extração corrigida, o `PA-PGM` ainda produz 26 `V-CTR-02`. Agora são achados legítimos: o
catálogo padrão tem 55 entradas visíveis, semeadas do contrato SMIT, e o `PA-PGM` é outro
contrato, com 46 códigos e outro escopo. Vinte e seis códigos do catálogo SMIT não existem nele.

A ação correta é **subir o catálogo correspondente** no campo opcional que a `R-CAT-01` já
prevê. Não é código. Ver `I-02`.

---

## 3. Objetivo

A grade da tabela de itens é **derivada do documento submetido**, por propriedades estruturais do
negócio, e não comparada a coordenadas medidas num contrato específico.

Como consequência: contratos de outros órgãos, aditivos com outra margem e o mesmo contrato
regerado por outra ferramenta são lidos sem alteração de código — e o piloto continua saindo
idêntico ao que sai hoje.

---

## 4. Escopo

### 4.1 Dentro do escopo

- Derivar o gabarito de divisórias do próprio PDF (§2.5).
- Casar cada coluna com a divisória mais próxima, em vez de filtrar candidatas e contá-las (§2.3).
- Suprimir a cascata de `V-CTR-02` e `V-CTR-03` quando não há tabela (§2.7).
- Enriquecer a mensagem de `V-CTR-01` com o que foi observado no documento.
- O `PA-PGM` como segundo contrato real na suíte de testes.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Aceitar bordas desenhadas como `lines`/`curves` | Nenhum dos dois contratos usa. Seria código sem caso real que o exercite — e §2.5 mostra que o mecanismo de derivação não depende da origem da borda, então acrescentá-la depois é local |
| Âncora pelo texto do cabeçalho (`CÓDIGO`, `DESCRIÇÃO`, …) | Era a saída para "template com colunas genuinamente diferentes". §2.5 tornou-a desnecessária: a repetição entre páginas identifica a tabela sem ler o cabeçalho |
| PDF digitalizado, sem camada de texto | Exige OCR. Fora do alcance de qualquer ajuste no extrator, e o diagnóstico já o distingue e diz isso |
| Corrigir o catálogo para o `PA-PGM` | §2.8 — é insumo, não código. A aplicação já aceita catálogo por upload |
| Alterar `V-CTR-01`, `V-CTR-02` e `V-CTR-03` como validações | Continuam com a mesma semântica e a mesma severidade. O que muda é **quando o orquestrador as chama** (`R-GRD-06`) e o que a primeira **informa** (`R-GRD-07`) |
| Paralelizar ou acelerar a extração | A passada extra de §2.5 percorre `pagina.rects`, que o extrator já percorre. Custo desprezível e não medido como problema |

---

## 5. Regras

| ID | Regra |
|---|---|
| `R-GRD-01` | A tabela de itens tem **sete colunas** — código, descrição, unidade, preço, quantidade, meses, total — e portanto **oito divisórias**. Este é o único número estrutural da regra, e vem do negócio, não de medição |
| `R-GRD-02` | O gabarito de divisórias é **derivado do documento**, numa passada anterior à leitura das células: entre os conjuntos de oito divisórias que aparecem idênticos em uma ou mais páginas, vence o conjunto cujas páginas concentram **mais códigos de serviço**; empatando, o de maior vão |
| `R-GRD-03` | Uma página entra na extração quando **contém** o gabarito derivado — não quando é igual a ele. É o que traz de volta a página do quadro de totais, que carrega itens e a linha `TOTAL:` (§2.3) |
| `R-GRD-04` | Cada uma das oito divisórias é resolvida pela candidata **mais próxima** da posição do gabarito. Duas candidatas para a mesma coluna resolvem-se pela distância, nunca inflando a contagem |
| `R-GRD-05` | Não havendo conjunto de oito divisórias em nenhuma página, `montar_grade` devolve `None` e `V-CTR-01` bloqueia, como hoje. **A ausência de tabela continua sendo bloqueio** |
| `R-GRD-06` | `V-CTR-02` e `V-CTR-03` só são avaliadas quando `contrato.itens` não está vazio. Sem tabela, as duas reportariam consequência no lugar da causa (§2.7). A guarda vive no **orquestrador**; as validações continuam puras |
| `R-GRD-07` | A mensagem de `V-CTR-01` traz o que foi observado — páginas, páginas com borda desenhada, divisórias encontradas, páginas com texto. Hoje o suporte recebe *"não localizada"* e não tem por onde começar |
| `R-GRD-08` | O gabarito derivado é **conferido** contra `COLUNAS_DA_TABELA`. Divergindo além de 1,5 pt em qualquer divisória, registra-se `V-CTR-04` (`AVISA`): o contrato foi lido por geometria diferente da de referência, e quem confere merece saber disso antes de assinar |
| `R-GRD-09` | `COLUNAS_DA_TABELA` **permanece no código**, rebaixada de seletor a referência de conferência (`R-GRD-08`). Continua sendo a geometria do piloto, e é o que dá sentido ao aviso |
| `R-GRD-10` | O checksum `V-CTR-03` continua sendo a **única** prova de que a extração está completa. Nada nesta espec o relaxa: grade derivada corretamente e checksum divergente continua sendo bloqueio |

---

## 6. Decisões

### `D-01` — Casar por coluna, não filtrar e contar

O defeito B (§2.3) tem correção de três linhas: em vez de guardar toda candidata próxima de
alguma coluna e exigir que sobrem oito, percorrer as oito colunas esperadas e escolher, para
cada uma, a candidata mais próxima.

Medido: o resultado é **idêntico ao de hoje em todas as páginas do piloto**, e resolve a página
25 do `PA-PGM`. É a mudança de menor risco da espec, e sozinha já desarma a bomba-relógio de
1,5 pt que existe hoje no piloto.

### `D-02` — O gabarito é derivado por repetição entre páginas, não por proporção

As duas alternativas resolvem o `PA-PGM`. A escolha é pela que **não introduz constante nova**.

Casar por proporção exige uma tolerância relativa, e §2.4 mostrou que o desvio real consome 75%
de um limite de 0,02 escolhido a olho. O próximo contrato pode consumir 110%, e o modo de falha
é o de hoje: silêncio total, 57 mensagens, nenhuma acionável.

A repetição entre páginas usa **igualdade exata** entre conjuntos de divisórias — nada a
calibrar — e duas propriedades que são do negócio, não do arquivo: a tabela de itens tem sete
colunas (`R-GRD-01`) e é onde estão os códigos de serviço (`R-GRD-02`). Medido nos dois
contratos, acerta os dois e rejeita os três concorrentes (§2.5).

**Alternativa descartada:** casar por proporção com tolerância de 0,02. Fica registrada aqui
porque continua sendo a saída se algum dia aparecer um contrato cuja tabela ocupe **uma página
só** — caso em que não há repetição a medir. Ver `R-GRD-02` e `I-01`.

### `D-03` — Nenhuma constante nova de calibração

Decorre de `D-02` e merece registro próprio, porque é a lição do defeito: `COLUNAS_DA_TABELA` e
`TOLERANCIA` foram escritas com a mesma boa intenção de hoje — medir o documento real e usar a
medida. O que as condenou não foi o valor, foi a **natureza**: uma constante calibrada num
documento é uma afirmação sobre aquele documento, disfarçada de afirmação sobre o formato.

Trocá-la por outra constante calibrada em dois documentos adia o problema sem mudá-lo.

### `D-04` — A derivação é uma passada do extrator, não da grade

`montar_grade(pagina)` é por página, e o critério de `R-GRD-02` é por documento. A derivação
entra em `PdfPlumberContractExtractor.extrair()`, que já tem o `pdf` aberto, e o gabarito passa a
ser **parâmetro** de `montar_grade(pagina, gabarito)`.

Isto mantém `grid.py` como está conceitualmente — reconstrução da grade de uma página, dada a
geometria — e põe a decisão de *qual é a geometria* onde há visão do documento inteiro. A
assinatura muda, e é a única mudança de interface da espec.

### `D-05` — A ESPEC 001 §9.4 é revisada, não revogada

O que a §9.4 quis — *reconstruir a grade a partir das bordas desenhadas, porque extração por
linha resolve 15 de 60 e `extract_tables()` resolve 58 de 60* — continua integralmente de pé.
Esta espec não troca o mecanismo de leitura de células; troca **como as fronteiras da grade são
descobertas**.

A frase do cabeçalho do extrator — *"localizada por âncora de conteúdo, nunca por posição
fixa"* — passa a ser verdadeira também para as colunas, e não só para as páginas.

### `D-06` — A cascata é guardada no orquestrador, não dentro das validações

Pôr o `if contrato.itens` dentro de `v_ctr_02_catalogo_resolvido` seria mais curto e conflataria
duas responsabilidades: a validação passaria a saber em que ordem é chamada. Os testes unitários
existentes das três validações continuam válidos, sem alteração, porque nenhuma delas muda.

Vale para `V-CTR-02` e `V-CTR-03`; §2.7 mediu que as demais não precisam de guarda.

### `D-07` — O `PA-PGM` entra na suíte como fixture

A suíte roda hoje contra **um** PDF, com o total `10637425.00` no código. Ela passa 100% e o
produto falha em campo — porque o acoplamento à geometria do piloto é exatamente o que uma suíte
de um-só-documento não consegue enxergar.

Um segundo contrato real, de outro órgão e outra geometria, é a única coisa nesta espec que
impede a classe inteira de defeito de voltar.

---

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `infrastructure/contract/grid.py` | **Entra** `derivar_gabarito(pdf) -> tuple[float, ...] \| None` (`R-GRD-02`). `_fronteiras_verticais` passa a casar por coluna (`R-GRD-04`, `D-01`). `montar_grade(pagina, gabarito)` recebe a geometria em vez de consultar a constante. `COLUNAS_DA_TABELA` permanece, como referência de `R-GRD-08` |
| `infrastructure/contract/pdfplumber_extractor.py` | `extrair()` chama `derivar_gabarito(pdf)` antes do laço de páginas e o repassa a `montar_grade` (`D-04`). Coleta o diagnóstico de `R-GRD-07` |
| `domain/entities/contract.py` | **Entra** `diagnostico: DiagnosticoDaGrade \| None = None` — campo opcional, com padrão. Nenhuma construção existente de `Contract` quebra |
| `infrastructure/validations/contract_validations.py` | `v_ctr_01` concatena o diagnóstico à mensagem (`R-GRD-07`). **Entra** `v_ctr_04_geometria_nao_canonica` (`AVISA`, `R-GRD-08`) |
| `infrastructure/di/container.py` | `gerar()` guarda `V-CTR-02` e `V-CTR-03` sob `if contrato.itens` (`R-GRD-06`); chama `v_ctr_04` |
| `backend/tests/fixtures/` | **Entra** `contrato_pgm.pdf` — cópia de `PA-PGM-251015-159 v5.0.pdf`, como o piloto já é cópia de `Q-00739-7` |
| `scripts/diagnostico_grade_contrato.py` | Já existe. Passa a ser a ferramenta declarada de suporte para esta classe de ocorrência |

**Nada muda em `application/`, `api/` ou `frontend/`.** O contrato da API não é tocado: a resposta
`422` já carrega a lista de achados, e o que muda é o conteúdo dela — de 57 mensagens para uma
mensagem informativa. O painel da tela renderiza o que recebe.

`domain/` recebe um campo opcional e nenhuma regra nova. `test_architecture.py` continua valendo.

---

## 8. Validação nova

| ID | Severidade | Quando dispara | Mensagem |
|---|---|---|---|
| `V-CTR-04` | `AVISA` | O gabarito derivado difere de `COLUNAS_DA_TABELA` em mais de 1,5 pt em qualquer divisória | `a tabela foi lida com geometria diferente da de referência (vão {a}–{b} pt contra {c}–{d} pt) — a extração foi conferida pelo checksum` |

Avisa, não bloqueia. O princípio é o da `V-CAT-03`: um documento que sai com aviso é conferível;
um que não sai não é. E há prova independente de que a leitura está certa — `V-CTR-03`, que
bloqueia se a soma não fechar (`R-GRD-10`).

`V-CTR-04` não dispara no piloto por construção: o gabarito derivado dele **é**
`COLUNAS_DA_TABELA` (§2.5). Ela existe para o dia em que um contrato novo entrar sem ninguém
perceber que entrou — que é precisamente o dia em que ninguém estará olhando.

---

## 9. Testes e critério de aceite

### 9.1 O portão de não-regressão

[`test_extractor_contract.py`](../../backend/tests/test_extractor_contract.py) é o contrato de
não-regressão desta espec, e é forte: 60 itens, 57 códigos, total `10637425.00`, mais as
asserções **nominais** dos itens que as abordagens anteriores perdiam — `12.074.00005.00` e
`14.048.00008.00`.

**Ele deve passar sem uma linha alterada.** Se precisar ser tocado, a implementação está errada,
e essa é a regra de aceite mais importante do documento.

Vale para toda a suíte: nenhum teste existente é reescrito. `D-06` foi decidido assim
precisamente para que os testes das três validações sobrevivam intactos.

### 9.2 Cobertura nova

| Nível | Cobertura |
|---|---|
| `R-GRD-02` | `derivar_gabarito` devolve `COLUNAS_DA_TABELA` para o piloto — o gabarito derivado **é** a constante, valor por valor |
| `R-GRD-02` | `derivar_gabarito` devolve `(51,4 … 551,5)` para o `PA-PGM` |
| `R-GRD-02` | O conjunto concorrente da página 30 do piloto (0 códigos) **não** é escolhido (§2.5, fato 3) |
| `R-GRD-03` | As páginas com grade no piloto são exatamente `{25, 26, 27, 28, 29}` — o conjunto de hoje (§2.6) |
| `R-GRD-04` | Na página 25 do `PA-PGM`, a coluna de 404,3 resolve para 404,3 e não para 405,0, e a página produz grade |
| `R-GRD-04` | Em todas as páginas do piloto, o casamento por coluna devolve **a mesma lista** que o filtro atual — a asserção que sustenta `D-01` |
| `R-GRD-05` | PDF sem nenhum conjunto de oito divisórias produz `Contract` vazio e `V-CTR-01` bloqueante |
| `R-GRD-06` | Contrato vazio + catálogo de 55 entradas produz **um** achado, não 57 |
| `R-GRD-06` | Contrato **não** vazio com um código de catálogo ausente continua produzindo `V-CTR-02` — a guarda não engoliu a validação |
| `R-GRD-07` | A mensagem de `V-CTR-01` contém o número de páginas e o de divisórias encontradas |
| `R-GRD-08` | `V-CTR-04` ausente no piloto; presente no `PA-PGM` |
| **Âncora `PA-PGM`** | 47 itens, 46 códigos, páginas 22 a 25, proposta `PA-PGM-251015-159`, total `24551037.72`, checksum `0,00` |
| `R-GRD-10` | Checksum divergente continua bloqueando, com a grade derivada corretamente |

### 9.3 O critério de aceite

Dois contratos reais, de órgãos diferentes e geometrias diferentes, extraídos pelo **mesmo
código sem parâmetro de layout**, ambos com checksum fechando em `0,00`.

É o que separa "funciona no piloto" de "funciona".

### 9.4 O que não é testado de novo

Anexos (ESPEC 004), relatório em DOCX (ESPEC 003), análise em XLSX (ESPEC 009) e grid de
divergências (ESPEC 002) não são tocados. Se algum reprovar, a mudança vazou para onde não devia.

---

## 10. Riscos

| Risco | Mitigação |
|---|---|
| **A derivação escolher a tabela errada** num contrato com várias tabelas de sete colunas | O desempate por código de serviço (`R-GRD-02`) é o que separa a tabela de itens das demais, e foi medido contra três concorrentes reais (§2.5, fato 3). Havendo erro, `V-CTR-03` bloqueia: a soma de outra tabela não fecha com o `TOTAL:` |
| **Tabela de itens que ocupe uma página só** — sem repetição a medir | `R-GRD-02` aceita conjunto que apareça em **uma** página. O desempate por código continua valendo, e é o que impede escolher o quadro de totais. Não há caso real; registrado em `I-01` |
| **Um contrato com número de colunas diferente de sete** | `R-GRD-01` é premissa declarada, e `V-CTR-01` bloqueia com o diagnóstico de `R-GRD-07` dizendo quantas divisórias foram encontradas. Falha alto e legível, que é o oposto do defeito de hoje |
| **A guarda de `R-GRD-06` esconder um `V-CTR-02` legítimo** | Ela só age com `contrato.itens` vazio, situação em que já há bloqueio por `V-CTR-01`. Há teste dedicado ao caso oposto (§9.2) |
| **`V-CTR-04` virar ruído** — todo contrato novo avisa | É a intenção: geometria diferente da de referência é fato que quem confere deve saber. Avisa uma vez por geração, não por item |
| **A passada extra custar tempo** | Percorre `pagina.rects`, que o extrator já percorre. Não medido como problema; se aparecer, o gabarito é derivado das primeiras páginas com borda em vez de todas |
| **`COLUNAS_DA_TABELA` apodrecer sem uso** | `R-GRD-09` a mantém viva como referência de `V-CTR-04`, com teste que exige que o gabarito derivado do piloto seja igual a ela (§9.2). Se apodrecer, quebra a suíte |

---

## 11. Pontos em aberto

| ID | Questão | Bloqueia? |
|---|---|---|
| `I-01` | Existe contrato cuja tabela de itens ocupe uma página só? Muda o peso do desempate de `R-GRD-02` e reabriria o casamento por proporção como alternativa (`D-02`) | Não |
| `I-02` | Existe catálogo próprio do contrato `PA-PGM`? Sem ele, os 26 `V-CTR-02` de §2.8 continuam bloqueando — corretamente, mas o usuário não conseguirá gerar o relatório | **Não bloqueia esta espec, bloqueia o uso.** É a próxima pergunta depois da implementação |
| `I-03` | Contratos de outros órgãos desenham a moldura como `rects`, ou algum usa `lines`/`curves`? Decide se a camada de §4.2 sai do "fora do escopo" | Não |
| `I-04` | O aviso `V-CTR-04` deve aparecer também no rodapé do `.docx`, ou só na tela? Esta espec assume só na tela, como os demais avisos | Não |

---

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | `R-GRD-04` — casar por coluna. A mudança de `D-01`, com a asserção de identidade no piloto | PP |
| B | `R-GRD-02` e `R-GRD-03` — `derivar_gabarito` e o parâmetro em `montar_grade` | M |
| C | `R-GRD-06` e `R-GRD-07` — guarda da cascata e diagnóstico na mensagem | P |
| D | `R-GRD-08` — `V-CTR-04` | PP |
| E | `D-07` — fixture do `PA-PGM` e o bloco de testes-âncora de §9.2 | P |

**Total: 1 a 1,5 dia.** O que sustenta a estimativa é §2.1: o documento já é legível pelo
extrator atual, e a prova de ponta a ponta já foi feita — trocando o gabarito à mão, o `PA-PGM`
sai com 47 itens e checksum zerado. A espec troca *como o gabarito é obtido*; não escreve
extração nova.

A ordem das fases não é arbitrária. **A fase A vem primeiro porque é a única que corrige um
defeito já presente no piloto** (§2.3), e porque a asserção "o casamento por coluna devolve a
mesma lista em todas as páginas do piloto" é o que autoriza tudo o que vem depois.

---

## 14. Emendas da implementação — 2026-08-12

### 14.1 A identidade do portão P2 não podia ser entre as listas cruas

O PLANO 017 §2 definiu `P2` como *"em todas as páginas do piloto, o casamento por coluna devolve
lista **idêntica** ao filtro atual"*. Escrito assim, o portão reprovaria a implementação correta.

Nas páginas que **não** produzem grade — 27 das 32 no piloto — o filtro anterior devolve uma
lista **parcial**: as duas ou três divisórias que por acaso caíam perto de alguma coluna. O novo
devolve vazio, porque nem toda coluna tem candidata, e é o que `R-GRD-04` manda fazer: uma grade
parcial não significa nada.

As duas levam `montar_grade` ao mesmo `None`, e a diferença é invisível para o extrator. A
identidade correta é sobre o **resultado observável**, e virou dois testes:

1. o **conjunto de páginas** que produz grade é o mesmo — `{25, 26, 27, 28, 29}`;
2. **onde há grade**, as oito divisórias são iguais valor por valor.

O portão fechou com os dois. O erro do plano foi de altitude: ele descreveu a identidade na
camada onde o código mudou, e não na camada onde o comportamento importa.

### 14.2 O `V-CTR-04` só existe porque `COLUNAS_DA_TABELA` sobreviveu

`R-GRD-09` manteve a constante como referência de conferência, e na implementação isso se mostrou
mais útil do que a regra previa. Ela é o que permite ao teste T-1112 afirmar que o gabarito
derivado do piloto **é** a constante — igualdade exata, não equivalência.

Essa asserção é a ponte entre o mundo antigo e o novo: se o gabarito derivado do piloto é
idêntico ao que o selecionava antes, nada do que vinha depois pode ter mudado. Sem ela, `P2` e
`P3` provariam que o resultado final está certo, mas não que o **caminho** é o mesmo.

---

## 13. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-08-12 | Redação inicial. O diagnóstico apontou primeiro "template genuinamente diferente, exige âncora pelo cabeçalho"; a medição de §2.5 mostrou que a repetição entre páginas resolve sem tolerância, e o desenho encolheu. O defeito B (§2.3) não constava do diagnóstico inicial e só apareceu ao provar a correção de ponta a ponta — foi ele que revelou o risco latente no piloto |
| 1.1 | 2026-08-12 | **Implementada.** Duas emendas em §14. Os dois contratos extraem com checksum `0,00`, a suíte foi de 379 para 405 testes, e nenhum teste existente foi reescrito — `conftest.py` com 11 inserções e zero deleções |