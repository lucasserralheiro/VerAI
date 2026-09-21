# ESPEC 011 — Ordenação das páginas 2 a 4 pela proposta comercial

| | |
|---|---|
| **Status** | Proposta |
| **Versão** | 1.0 — 2026-08-10 |
| **Depende de** | [ESPEC 001](001-mvp-analise-medicao.md), [ESPEC 003](003-relatorio-em-docx.md), [ESPEC 004](004-anexos-de-detalhamento.md) — implementadas |
| **Afeta** | [ESPEC 002](002-painel-de-divergencias.md) §7 e [ESPEC 009](009-analise-da-medicao.md) — por propagação, ver §10 |
| **Revisa** | O critério de aceite do projeto: o gabarito de **ordem** deixa de ser o GRC e passa a ser a proposta |
| **Referência normativa** | `docs/documentos/PA-SMIT-260319-739 Q-00739-7.pdf`, páginas 26 a 29 |

---

## 1. Problema

As páginas 2 a 4 do `.docx` — a tabela de comprovação — saem hoje na ordem do relatório GRC, porque o
catálogo embutido foi semeado a partir dele (`scripts/seed_catalog.py`, campo `ordem`). O GRC é o
documento que se quis reproduzir na ESPEC 001, e a fidelidade a ele virou o critério de aceite do
projeto.

O solicitante determinou que a ordem passe a ser a da **proposta comercial**
`PA-SMIT-260319-739 Q-00739-7`. As duas ordens são diferentes, e a diferença não é cosmética: sete
das vinte e duas seções mudam de conteúdo interno e quinze mudam de posição.

Quem confere uma medição trabalha com a proposta aberta ao lado. Hoje precisa procurar cada item —
a proposta lista `11.027.00001.00` antes de `11.051.00012.00`, o documento faz o contrário. A ordem
comum é o que torna a conferência sequencial em vez de uma busca por item.

---

## 2. O que foi medido

Tudo nesta seção foi lido dos arquivos, não suposto.

### 2.1 A proposta já é uma entrada da aplicação

```
sha256  a4b1505178cafe5e…   docs/documentos/PA-SMIT-260319-739 Q-00739-7.pdf
sha256  a4b1505178cafe5e…   backend/tests/fixtures/contrato.pdf
```

**Os dois arquivos são idênticos byte a byte.** O documento de referência desta espec é o mesmo PDF
que a aplicação já recebe no campo `contrato` e já lê em `PdfPlumberContractExtractor`.

Isto decide a arquitetura antes de qualquer outra coisa: **não entra arquivo novo, não entra
configuração nova.** A ordem pedida está dentro de um insumo que já é lido, e o extrator já a
preserva — `Contract.itens` sai em ordem de documento, porque `extrair()` percorre páginas e células
sequencialmente e faz `append`.

### 2.2 A ordem da proposta

A tabela de itens ocupa as páginas 26 a 29 e traz **60 linhas em ordem crescente de código de
serviço**, numa lista única, sem faixas de grupo, sem faixas de seção e sem cabeçalho repetido.

```
 1  10.050.00001.00   ESPECIALISTA /ANALISTA DE SISTEMA DE INFORMAÇÃO
 …
 6  11.027.00001.00   DISPONIBILIZAÇÃO DE CERTIFICADO DIGITAL - SERVIDOR SSL
 7  11.051.00012.00   CONSULTORIA TÉCNICA - INFRAESTRUTURA DE REDE
 8  12.029.00021.00   SOLUÇÃO DE ACESSO A REDE CORPORATIVA PMSP - 8192 KBPS
 …
60  15.076.00005.00   SOA FAIXA 5
```

Das 60 linhas, 55 chegam ao relatório: as 5 restantes são os três itens do grupo `A - SISTEMAS DE
INFORMAÇÃO` (`exibir = N` no catálogo) e os dois desdobramentos extras de `10.050.00001.00`.

### 2.3 As 55 linhas do relatório têm todas correspondência na proposta

Nenhum órfão. Toda entrada do catálogo com `exibir = S` casa com pelo menos uma linha da tabela da
proposta pela chave `(código, qualificador)` — a mesma chave que a `R-REC-02` já usa para reconciliar
quantidade. A ordem, portanto, é **total**: não há item para o qual seja preciso arbitrar posição.

### 2.4 As 22 seções continuam contíguas — este é o achado que viabiliza a espec

A pergunta que decidia entre "dá para fazer" e "não dá" era: reordenar pela proposta espalha os itens
de uma mesma seção pelo documento? Se espalhasse, as faixas de seção teriam de cair, e a tabela
viraria a lista corrida da proposta.

Medido: **os 55 códigos, na ordem da proposta, produzem 22 blocos contíguos para 22 seções
distintas.** Nenhuma seção se fragmenta. As faixas sobrevivem inteiras.

Não é coincidência sortuda que valha para sempre — é uma propriedade do par catálogo + proposta
deste contrato, e por isso vira validação (`V-ORD-01`, §8), não pressuposto.

### 2.5 Há um empate, e ele não se resolve por código

`14.025.00011.00` aparece duas vezes entre as 55, discriminado por `IT0101` e `SG0721`:

| | Primeiro | Segundo |
|---|---|---|
| GRC / documento atual | `IT0101` | `SG0721` |
| **Proposta**, linhas 25 e 26 | **`SG0721`** | **`IT0101`** |

Ordenar por código deixaria este par indefinido, e qualquer desempate alfabético o resolveria ao
contrário do que a proposta diz — `IT0101` < `SG0721`. É o caso concreto que determina D-01.

### 2.6 As faixas de grupo são dado posicional, e quebram

`grupo_titulo` está preenchido em apenas 5 das 22 seções do catálogo, e o renderizador o emite onde
o encontra. Ele carrega **duas coisas diferentes** no mesmo campo:

| Valor | Preso à seção | O que é | Sob a ordem da proposta |
|---|---|---|---|
| `C - SERVIÇOS DE COMUNICAÇÃO` | `C1` | Faixa de **grupo** | Erra o lugar: a primeira seção do grupo C passa a ser `C2` |
| `C7 - SD-WAN` | `C7.3` | Faixa **intermediária** | Continua correta — `C7.3` é a única seção `C7.x` |
| `E - DATACENTER` | `E1.1` | Faixa de **grupo** | Erra o lugar: a primeira seção do grupo E passa a ser `E5.7` |
| `E2. SERVIÇOS EM NUVEM` | `E2.1` | Faixa **intermediária** | **Deixa de cobrir bloco contíguo**: `E2.1` fica na posição 16, `E2.2` e `E2.3` nas 20 e 21 |
| `E5 - OUTROS SERVIÇOS` | `E5.1` | Faixa **intermediária** | **Deixa de cobrir bloco contíguo**: as sete seções `E5.x` ficam espalhadas da posição 7 à 19 |

Os quatro grupos (`B`, `C`, `E`, `H`) **continuam contíguos** sob a nova ordem — só as faixas
intermediárias `E2` e `E5` perdem o bloco que nomeavam. Ver D-03.

### 2.7 A tabela já ocupa três páginas

Medido abrindo o `.docx` gerado no Word e repaginando: a tabela de comprovação tem **109 fileiras** e
**termina na página 4**, onde o GRC a encerra na 3. As páginas 2 a 4 do pedido são, portanto, a
tabela inteira — não sobra nada dela para a página 5, e nenhum anexo começa antes da 4 terminar.

A nova ordem leva a tabela a **107 fileiras** (perde as duas faixas intermediárias de §2.6). A
paginação não é objeto desta espec e permanece como está.

---

## 3. Objetivo

Duas ordenações, **selecionáveis na geração**:

| Ordenação | Origem da ordem | Papel |
|---|---|---|
| `PROPOSTA` | Posição na tabela de itens do PDF de contrato recebido | **Padrão.** É o critério de aceite a partir desta espec |
| `GRC` | Campo `ordem` do catálogo | Preservada. É o que o projeto entrega hoje |

O documento não ganha uma segunda variante permanente nem um segundo renderizador: ganha **um
parâmetro**. Ver D-04.

---

## 4. Regras

| ID | Regra |
|---|---|
| `R-ORD-01` | A ordem das linhas das páginas 2 a 4 é a **posição do item na tabela do PDF de contrato**, casada pela chave `(código, qualificador)` da `R-REC-02` |
| `R-ORD-02` | A ordenação é **por posição, nunca por valor do código**. Códigos repetidos são desempatados pela posição na proposta, e não alfabeticamente pelo qualificador (§2.5) |
| `R-ORD-03` | A **seção** de cada linha continua vindo do catálogo. A proposta define ordem; o catálogo define taxonomia. Nenhum dos dois invade o outro |
| `R-ORD-04` | As seções saem na ordem da **sua primeira linha**. Item que não conste da proposta vai para o fim, preservando entre si a ordem do catálogo (`R-ORD-08`) |
| `R-ORD-05` | Uma faixa de grupo ou intermediária é emitida na **primeira seção que ela cobre**, e **só se as seções que cobre formarem bloco contíguo**. Faixa que não cobre bloco contíguo não é emitida |
| `R-ORD-06` | A ordenação é **parâmetro da geração**, com dois valores: `PROPOSTA` (padrão) e `GRC`. Nenhum outro artefato do documento muda entre as duas |
| `R-ORD-07` | O catálogo embutido **não é reordenado**. O campo `ordem` continua sendo a ordem do GRC — é o que faz `GRC` continuar existindo sem uma segunda fonte de dados (D-05) |
| `R-ORD-08` | Item exibível ausente da proposta **não bloqueia e não some**: sai no fim da sua seção com aviso `V-ORD-02`. Um relatório que engole linha é pior que um relatório fora de ordem |
| `R-ORD-09` | A geração continua **determinística** (`R-DOC-10`): a ordem é função apenas dos insumos, sem depender de ordem de dicionário nem de estabilidade de `sorted` sobre chave ambígua |

---

## 5. A ordem resultante

### 5.1 Seções — de 22 posições, 15 mudam

| # | Antes (GRC) | # | **Depois (proposta)** | Primeira linha |
|---|---|---|---|---|
| 1 | `B` | 1 | `B` | `11.027.00001.00` |
| 2 | `C1` | 2 | **`C2`** | `12.029.00021.00` |
| 3 | `C2` | 3 | **`C1`** | `12.029.00097.00` |
| 4 | `C3` | 4 | **`C4`** | `12.030.00001.00` |
| 5 | `C4` | 5 | **`C3`** | `12.055.00002.00` |
| 6 | `C7.3` | 6 | `C7.3` | `12.074.00005.00` |
| 7 | `E1.1` | 7 | **`E5.7`** | `14.023.00002.00` |
| 8 | `E1.2` | 8 | **`E5.1`** | `14.024.00005.00` |
| 9 | `E1.3` | 9 | **`E1.5`** | `14.025.00011.00` |
| 10 | `E1.5` | 10 | **`E5.5`** | `14.026.00003.00` |
| 11 | `E2.1` | 11 | **`E1.3`** | `14.028.00005.00` |
| 12 | `E2.2` | 12 | **`E3`** | `14.031.00016.00` |
| 13 | `E2.3` | 13 | **`E5.6`** | `14.033.00001.00` |
| 14 | `E3` | 14 | **`E1.2`** | `14.046.00010.00` |
| 15 | `E5.1` | 15 | **`E1.1`** | `14.049.00005.00` |
| 16 | `E5.2` | 16 | **`E2.1`** | `14.049.00057.00` |
| 17 | `E5.3` | 17 | **`E5.8`** | `14.051.00025.00` |
| 18 | `E5.5` | 18 | **`E5.2`** | `14.067.00001.00` |
| 19 | `E5.6` | 19 | **`E5.3`** | `14.067.00002.00` |
| 20 | `E5.7` | 20 | **`E2.2`** | `14.070.00001.00` |
| 21 | `E5.8` | 21 | **`E2.3`** | `14.070.00002.00` |
| 22 | `H` | 22 | `H` | `15.076.00001.00` |

A numeração das seções deixa de ser crescente na página — `C2` antes de `C1`, `E5.7` antes de `E5.1`.
É consequência direta e inevitável do pedido: a proposta ordena por código de serviço, e a numeração
`E1`/`E2`/`E5` é taxonomia do GRC, que não segue o código. Ver §11, ponto 1.

### 5.2 Linhas — 7 seções mudam por dentro

| Seção | Antes | **Depois** |
|---|---|---|
| `B` | `11.051.00012.00`, `11.027.00001.00` | `11.027.00001.00`, `11.051.00012.00` |
| `C2` | `…00080`, `…00021`, `…00025` | `…00021`, `…00025`, `…00080` |
| `C3` | `12.055.00004.00`, `12.055.00002.00` | `12.055.00002.00`, `12.055.00004.00` |
| `E1.5` | `…00011` `IT0101`, `…00011` `SG0721` | `…00011` **`SG0721`**, `…00011` `IT0101` |
| `E5.1` | `14.024.00006.00` (NAS), `14.024.00005.00` (SAN) | `14.024.00005.00` (SAN), `14.024.00006.00` (NAS) |
| `E1.2` | `14.048.00008.00`, `14.046.00010.00` | `14.046.00010.00`, `14.048.00008.00` |
| `E1.1` | `…00037` … `…00055`, `14.049.00005.00` | **`14.049.00005.00`**, `…00037` … `…00055` |

As 15 seções restantes têm ordem interna já coincidente — `C7.3`, `E2.1`, `E3` e `H` porque a
sequência do GRC ali é crescente por código; as demais porque têm uma linha só.

### 5.3 Faixas — duas mudam de lugar, duas somem

| Faixa | Antes | **Depois** |
|---|---|---|
| `C - SERVIÇOS DE COMUNICAÇÃO` | sobre `C1` | sobre **`C2`** |
| `C7 - SD-WAN` | sobre `C7.3` | sobre `C7.3` — inalterada |
| `E - DATACENTER` | sobre `E1.1` | sobre **`E5.7`** |
| `E2. SERVIÇOS EM NUVEM` | sobre `E2.1` | **não emitida** (`R-ORD-05`) |
| `E5 - OUTROS SERVIÇOS` | sobre `E5.1` | **não emitida** (`R-ORD-05`) |

---

## 6. Decisões de engenharia

### D-01 — Ordena-se pela posição na proposta, não pelo valor do código

A proposta deste contrato está em ordem crescente de código, e é tentador implementar
`sorted(linhas, key=lambda l: l.codigo)`. Duas linhas seriam suficientes, e estaria errado por dois
motivos independentes:

1. **O empate de §2.5 sai invertido.** `14.025.00011.00` `SG0721` precede `IT0101` na proposta;
   ordenar por código não distingue os dois, e qualquer desempate por qualificador os põe ao
   contrário.
2. **A premissa não é do problema, é deste PDF.** "A proposta está ordenada por código" é uma
   observação sobre `Q-00739-7`. O pedido é seguir *a proposta*, não seguir *o código*. No dia em que
   um aditivo listar um item fora de sequência, a implementação por `sorted` produzirá silenciosamente
   uma ordem que ninguém pediu, e o teste continuará passando porque estaria medindo a mesma premissa
   errada.

Ordenar por posição custa o mesmo e é literal: `Contract.itens` já vem em ordem de documento.

**Alternativa descartada:** regravar o campo `ordem` do `catalogo_padrao.json` com a sequência da
proposta. Resolveria o piloto em um `git diff` legível e é o caminho mais curto — mas o catálogo
passaria a codificar uma ordem derivada de *um* contrato, e o upload de catálogo da `R-CAT-01`
deixaria de ser suficiente para um contrato diferente: seria preciso reordená-lo à mão, do lado de
fora. Ver também D-05.

### D-02 — As faixas de seção sobrevivem porque foi medido que sobrevivem

A ordem da proposta é uma lista corrida sem taxonomia. Ela poderia ser incompatível com um documento
que tem faixas — bastaria dois itens da mesma seção caírem em pontos distantes da sequência.

§2.4 mediu: **não caem.** Os 55 códigos, na ordem da proposta, produzem 22 blocos contíguos para 22
seções. O documento mantém a estrutura que a `R-DOC-06` exige e adota a ordem que o solicitante pede,
sem que uma coisa custe a outra.

**Isto é um fato sobre este par catálogo + contrato, e não uma garantia.** Um aditivo que insira um
código no meio da faixa de outra seção fragmentaria um bloco. Por isso vira `V-ORD-01` (§8): a
contiguidade é **verificada a cada geração** e, se falhar, o documento sai com aviso explícito em vez
de sair com uma seção repetida em dois lugares sem que ninguém note.

### D-03 — As faixas são recalculadas na montagem, não lidas de posição fixa

Hoje o renderizador emite `grupo_titulo` onde quer que o encontre, e o catálogo o preenche numa
seção escolhida à mão. Isso funciona enquanto a ordem for a mesma em que o catálogo foi semeado —
`grupo_titulo` é, na prática, **dado posicional disfarçado de atributo**.

Com duas ordens possíveis, a posição precisa ser derivada: a faixa é emitida na primeira seção que
ela cobre, na ordem vigente, e somente se as seções que cobre forem contíguas (`R-ORD-05`).

**As faixas `E2` e `E5` deixam de ser emitidas, e isso é uma perda real.** `E5 - OUTROS SERVIÇOS`
nomeava sete seções; sob a ordem da proposta elas ficam espalhadas da posição 7 à 19, com `E1.x`,
`E2.x` e `E3` entremeadas. Emitir a faixa sobre `E5.7` seria pior que não emitir: um cabeçalho que
anuncia um bloco que não existe é informação falsa num documento que instrui faturamento.

Não há saída melhor dentro do pedido. Manter as faixas intermediárias exigiria manter as seções
agrupadas por numeração — que é exatamente a ordem do GRC que se está trocando. As duas exigências
são incompatíveis, e a espec escolhe a que foi pedida.

**Alternativa descartada:** separar `grupo_titulo` em dois campos no catálogo — faixa de grupo e
faixa intermediária. É a modelagem correta e continua correta depois desta espec; ficou de fora
porque não altera o resultado no piloto (`C`, `E` são grupo; `C7`, `E2`, `E5` são intermediárias, e a
regra de contiguidade já as trata bem) e porque mexer no formato do catálogo obrigaria a revisar o
leitor de upload. Registrado em §11, ponto 3.

### D-04 — Um parâmetro, não um segundo renderizador

A ordenação é decidida na **montagem do agregado** — `GenerateMeasurementReport.executar()` —, não na
renderização. O `DocxRenderer` percorre `relatorio.secoes` e não faz ideia de onde a ordem veio; ele
não muda nem uma linha.

Duas consequências que justificam a escolha:

- **A tela e os dois documentos nunca discordam.** O grid da ESPEC 002, o `.docx` e o
  `Relatorio_Analise_Medição.xlsx` da ESPEC 009 são todos derivações do mesmo agregado. Ordenar no
  agregado ordena os três de uma vez; ordenar no renderizador faria o documento discordar da tela que
  o antecede — e a `R-UI-01` (revista pela ESPEC 010) fundamenta a conferência exatamente na
  correspondência de ordem entre os dois.
- **Não há dois caminhos de código para manter.** A alternativa — um `DocxRenderer` por ordem — teria
  duplicado 560 linhas de renderizador para trocar a origem de um índice.

### D-05 — O catálogo continua na ordem do GRC

`R-ORD-07` mantém o `catalogo_padrao.json` intocado. Não é conservadorismo: é o que faz a ordenação
`GRC` continuar existindo. Se o catálogo fosse regravado na ordem da proposta, a ordem do GRC
desapareceria do projeto e a opção `GRC` precisaria de uma segunda fonte de dados para ser
reconstruída.

Com o catálogo como está, as duas ordens saem de insumos que a aplicação **já lê**: `GRC` do campo
`ordem`, `PROPOSTA` da posição no PDF de contrato. Nenhum arquivo novo, nenhum dado duplicado, e
nenhuma das duas pode ficar desatualizada em relação à outra.

### D-06 — `PROPOSTA` é o padrão

O solicitante determinou que o critério de aceite passe a ser a proposta. Um padrão que não seja o
critério de aceite produz a situação em que o documento que sai do botão é diferente do documento que
o teste-âncora aprova — e é sempre o teste que perde essa discussão, tarde.

`GRC` fica disponível para quem precise remontar a comparação com o relatório de referência.

---

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `domain/value_objects/` | **Entra** `Ordenacao` — `PROPOSTA` \| `GRC`. Enum de duas entradas, no padrão de `QuantityKind` |
| `domain/entities/contract.py` | **Entra** `posicao_de(codigo, qualificador) -> int \| None`, irmã de `quantidade_para` e `descricao_para`, com a mesma regra de casamento por qualificador |
| `application/use_cases/generate_measurement_report.py` | `executar()` recebe `ordenacao: Ordenacao = PROPOSTA`. A chave do laço deixa de ser `entrada.ordem` fixo e passa a ser a chave da ordenação escolhida. **A montagem da linha não muda** |
| `application/use_cases/…` | **Entra** a emissão de faixas por contiguidade (`R-ORD-05`) — hoje implícita no `grupo_titulo` do catálogo |
| `infrastructure/validations/` | **Entram** `V-ORD-01` (contiguidade) e `V-ORD-02` (item fora da proposta), ambas `AVISA` |
| `infrastructure/di/container.py` | `Entradas` ganha `ordenacao`; `gerar()` a repassa ao caso de uso |
| `infrastructure/report/docx_renderer.py` | **Nenhuma** — D-04 |
| `infrastructure/catalog/catalogo_padrao.json` | **Nenhuma** — `R-ORD-07` |
| `api/` | `POST /reports` ganha o campo de formulário `ordenacao`, opcional, padrão `proposta` |
| `frontend/` | Seletor de ordenação no `UploadForm`, com `proposta` pré-selecionada |

O extrator de contrato **não muda**: ele já devolve `Contract.itens` em ordem de documento (§2.1). É
essa propriedade acidental — nunca declarada, mas real e coberta pelo `test_extractor_contract.py` —
que reduz esta espec ao tamanho que ela tem. Vale documentá-la no docstring de `extrair()`, já que
passa a ser contrato e não mais coincidência.

---

## 8. Validações novas

| ID | Severidade | Quando dispara | Mensagem |
|---|---|---|---|
| `V-ORD-01` | `AVISA` | Uma seção deixa de ser contígua sob a ordem escolhida | `seção {código} aparece em {n} blocos separados — a faixa foi emitida só no primeiro` |
| `V-ORD-02` | `AVISA` | Item exibível sem correspondência na tabela do contrato | `código {código} não consta da proposta — a linha saiu no fim da seção` |

Ambas avisam, nenhuma bloqueia. O princípio é o mesmo da `V-CAT-03`: um documento que sai com aviso
é conferível; um documento que não sai não é.

`V-ORD-01` não dispara no piloto — §2.4 mediu 22 blocos para 22 seções. Ela existe para o dia em que
um aditivo mudar isso, que é precisamente o dia em que ninguém estará olhando.

---

## 9. Testes e critério de aceite

### 9.1 O teste-âncora muda de gabarito de ordem

Este é o ponto de maior consequência da espec, e o único irreversível sem decisão nova.

`test_anchor_fidelity.py` afirma hoje:

```python
def test_a_ordem_dos_codigos_e_a_mesma(nosso, modelo):
    assert [l.codigo for l in nosso] == [l.codigo for l in modelo]   # modelo = GRC
```

Passa a afirmar:

```python
def test_a_ordem_segue_a_proposta(nosso, contrato):
    assert [l.codigo for l in nosso] == ordem_da_proposta(contrato)
```

**A comparação célula a célula com o GRC permanece integralmente** — as 55 linhas continuam sendo
conferidas contra o relatório de referência, com a divergência declarada de `11.027.00001.00`
(ESPEC 001 §9.1). O que muda é o **casamento**: por código, e não mais por posição. É o que separa
"a ordem está diferente" de "o conteúdo está errado", duas falhas que hoje o mesmo `assert` confunde.

Sem essa separação, a reordenação faria **41 das 55** linhas reprovarem por deslocamento — medido —, e
o teste deixaria de detectar um erro real de conteúdo no meio do ruído.

### 9.2 Cobertura

| Nível | Cobertura |
|---|---|
| Domínio | `Contract.posicao_de` casa por qualificador e devolve `None` para código ausente |
| Ordenação | As 55 linhas na ordem `PROPOSTA` batem com a sequência extraída de `Q-00739-7`, **incluindo** o par `SG0721` / `IT0101` de §2.5 |
| Ordenação | Com `ordenacao=GRC` o documento sai **byte a byte** igual ao que o projeto entrega hoje — é o que prova que `R-ORD-07` está de pé |
| Seções | 22 seções, contíguas, na ordem de §5.1 |
| Faixas | `C` sobre `C2`, `E` sobre `E5.7`, `C7` sobre `C7.3`; `E2` e `E5` ausentes (`R-ORD-05`) |
| Faixas | Uma faixa cujas seções não sejam contíguas é emitida **uma vez só**, e `V-ORD-01` registra |
| Estrutura | 107 fileiras na tabela de comprovação — 109 menos as duas faixas de §5.3 |
| **Âncora** | 55 linhas conferidas célula a célula com o GRC, casadas por código; 54 idênticas mais a divergência do certificado |
| Determinismo | Duas execuções produzem documentos idênticos, nas duas ordenações (`R-ORD-09`, `R-DOC-10`) |
| API | `ordenacao` ausente ⇒ `proposta`; valor inválido ⇒ 422 com mensagem, nunca silêncio |
| E2E | O grid da tela sai na mesma ordem do `.docx` baixado — a correspondência da `R-UI-01` |

### 9.3 O que não é testado de novo

Os 19 anexos (ESPEC 004) não são tocados. Eles já saem na ordem das páginas 4 a 41 do GRC, declarada
em `anexos.json`, e a proposta não os menciona. `test_docx_anexos.py` e `test_anchor_analise.py`
devem passar sem alteração — se algum reprovar, a mudança vazou para onde não devia.

---

## 10. Propagação para as ESPECs 002 e 009

`R-ORD-06` diz que a ordenação é parâmetro da geração, e D-04 a coloca no agregado. Segue daí que a
ordem nova aparece em **três** lugares, não em um:

| Artefato | Efeito |
|---|---|
| `.docx`, páginas 2 a 4 | O objeto desta espec |
| Grid de divergências (ESPEC 002) | `apenas_divergencias()` preserva a ordem das seções — o grid reordena junto, e é o que mantém a `R-UI-01` verdadeira |
| `Relatorio_Analise_Medição.xlsx` (ESPEC 009) | As quatro situações continuam sendo as quatro; **dentro** de cada uma, os itens seguem a ordem do relatório e portanto reordenam |

Nada disso é efeito colateral a corrigir: é a consequência pretendida. Tela e documentos fora de
ordem entre si seria o defeito.

O que **não** muda: a classificação de cada item (`R-ANA-01` a `R-ANA-04`), as contagens por situação,
o bloco de itens sem previsão contratual (`R-DIV-05`) e a glosa. Ordenar não reclassifica.

---

## 11. Riscos

| Risco | Mitigação |
|---|---|
| A numeração das seções sai fora de sequência na página — `C2` antes de `C1` | Consequência inevitável do pedido. §5.1 a documenta item a item; §11 ponto 1 registra a saída, se incomodar |
| As faixas `E2` e `E5` somem sem que o leitor perceba | D-03 e `R-ORD-05` explicam por quê. `V-ORD-01` registra o caso geral. As seções continuam todas rotuladas |
| Um aditivo fragmentar uma seção | `V-ORD-01`. O documento sai com aviso, não com seção repetida em silêncio |
| Perda de fidelidade ao GRC passar despercebida | §9.1: a comparação célula a célula com o GRC **permanece**, casada por código. Só a asserção de ordem troca de gabarito |
| A opção `GRC` apodrecer sem uso | Está no teste (§9.2, linha "byte a byte"). Se quebrar, quebra a suíte, não o usuário |
| Contrato futuro cuja tabela o extrator leia fora de ordem | O casamento é por posição de leitura. `test_extractor_contract.py` cobre a ordem; §7 pede que ela vire docstring, e não coincidência |

---

## 12. Pontos em aberto

| # | Questão | Impacto |
|---|---|---|
| 1 | A numeração `C1`/`C2`/`E1`/`E2`/`E5` fora de sequência é aceitável, ou os rótulos de seção devem ser renumerados na ordem em que aparecem? Esta espec **não renumera**: o rótulo é o vínculo com o GRC e com a tela | Legibilidade do documento |
| 2 | As faixas `E2. SERVIÇOS EM NUVEM` e `E5 - OUTROS SERVIÇOS` deixam de ser emitidas (§5.3). Se forem consideradas essenciais, a saída é agrupar por elas **antes** de ordenar pela proposta — o que reintroduz parte da ordem do GRC e precisa ser pedido explicitamente | Estrutura do documento |
| 3 | `grupo_titulo` carrega faixa de grupo e faixa intermediária no mesmo campo (D-03). Separá-los é a modelagem correta e não foi feito porque não altera o resultado no piloto | Modelo do catálogo |
| 4 | A tabela ocupa as páginas 2 a 4 onde o GRC usa 2 e 3 (§2.7). Não é objeto desta espec e permanece como está | Paginação |
| 5 | O seletor de ordenação deve aparecer na tela, ou `PROPOSTA` basta e `GRC` fica só para o teste? Esta espec assume que aparece | Interface |

Nenhum bloqueia a implementação. O ponto 2 é o único que, respondido ao contrário, muda o desenho.

---

## 13. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | `Ordenacao`, `Contract.posicao_de` e a chave de ordenação no caso de uso | P |
| B | Emissão de faixas por contiguidade (`R-ORD-05`) e as duas validações | M |
| C | Teste-âncora: casamento por código, gabarito de ordem na proposta | M |
| D | Parâmetro na API, no container e o seletor no formulário | P |
| E | Teste de que `ordenacao=GRC` reproduz o documento atual byte a byte | P |

**Total: 1 a 2 dias.** O que sustenta a estimativa é §2.1: a ordem pedida já está dentro de um insumo
que a aplicação lê, na ordem em que ela precisa. Não há arquivo novo, não há extração nova, e o
renderizador não é tocado.

---

## 14. Histórico

| Versão | Mudança |
|---|---|
| 1.0 | Espec inicial. O pedido chegou primeiro apontando o relatório GRC como referência de ordem, e foi corrigido para a proposta `PA-SMIT-260319-739 Q-00739-7` antes de qualquer linha de código |
