# TASKS 020 — Backlog da Capa do Documento

| | |
|---|---|
| **Especificação** | [ESPEC 020](../specs/020-capa-do-documento.md) v1.2 |
| **Plano** | [PLANO 020](../plans/020-plano-capa-do-documento.md) v1.1 |
| **Versão** | 1.0 — 2026-08-17 |
| **Total** | 40 tarefas · 7 portões · 3 insumos |
| **Status** | **Concluído com ressalva** — 2026-08-17. Seis dos sete portões fechados; **`P5` fica aberto**: exige abrir o Word, e é humano. Suíte 488 → 522. Ver §11 |

> Escrito **antes** da implementação, como o TASKS 017 e o TASKS 018.

---

## 1. Convenções

**Identificadores** `T-14nn` seguem a numeração do PLANO 020, que começa em T-1400 porque a
implementação da ESPEC 019 fechou em T-1340.

**Definição de pronto — backend:** código e teste na mesma entrega; `ruff check`, `mypy src/` e
`bandit -ll -r src/` limpos; `pytest` verde; comentário explicando o *porquê* onde a escolha não
for óbvia.

**Convenção de commit** `<tipo>(T-14nn): descrição`.

### 1.1 Seis regras que atravessam o backlog

**1 — O piloto é o oráculo, e nada mais é.** A capa correta do SMIT já existe, gravada no modelo.
Toda tarefa de derivação se julga contra ela, caractere por caractere. Se o resultado do piloto
divergir do modelo em algo que §9.1 da espec não sancionou, a tarefa está errada — não *"quase
certa"*, errada.

O PGM **não** julga nada positivo: nada independente diz que `PGM TC 015` é o subtítulo certo.
Ele prova o **negativo** — que nenhuma cadeia do SMIT sobrou. Ver ESPEC 020 §9.4.

**2 — Endereço de campo é `(caixa, parágrafo)`. Nunca casamento de cadeia.** É a `D-09`, e é o
defeito que a revisão da espec pegou antes de virar código. `PA-SMIT-260319-739` aparece em **dois
papéis** — continuação da linha `Proposta :` e rodapé da capa. Um `.replace()` sobre o XML escreve
nos dois e duplica num deles.

Um `str.replace` ou um `re.sub` sobre `document.xml` aparecendo no diff é o sinal de que esta
regra foi violada.

**3 — Todas as cópias, sempre.** Cada caixa lógica existe **duas vezes** no pacote, por
`mc:AlternateContent`. O Word escolhe uma conforme a versão. Preencher uma só produz o defeito que
**não se reproduz na máquina de quem testa** — e é por isso que a T-1414 existe.

**4 — O que a aplicação não sabe, ela não escreve.** `D-03`. Nada de ` - TA 02`, nada de versões
de proposta, nada de pilha histórica. Se uma tarefa parecer exigir inventar um pedaço de texto,
**pare** e leia `I-01`.

**5 — A diagramação da capa não é tocada.** Fonte, corpo, cor, posição, arte. Só o **texto do
parágrafo** muda. O renderizador estará aberto na F2 e na F3, e a tentação de "ajustar de
passagem" é máxima ali — foi o que a ESPEC 018 `D-10` tratou como risco principal.

**6 — Campo novo em dataclass entra por último e com padrão.** `Contract` e `Report` são
construídos com argumentos parciais em vários testes. `cliente` entra no fim, com `= ""`. É a
mesma regra que a ESPEC 019 seguiu para `blocos` e `propostas`, e pelo mesmo motivo.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Situação |
|---|---|---|---|
| **E0** O alvo é atingível | T-1400 … T-1402 | **P0** | ✅ |
| **E1** Os instrumentos, e o que reprova reprova | T-1403 … T-1408 | **P1** | ✅ — reprovou em 5, e pegou dois defeitos de instrumento (§11.1, §11.3) |
| **E2** Escrever nos campos | T-1409 … T-1416 | — | ✅ — o vazamento acabou aqui |
| **E3** As derivações, e o piloto é reproduzido | T-1417 … T-1426 | **P2** | ✅ — a capa do piloto sai idêntica ao modelo nos dois campos derivados |
| **E4** Converter os testes de capa | T-1427 … T-1433 | **P3**, **P4** | ✅ — **três** testes invertidos, não dois (§11.4) |
| **E5** Alguém abre o Word, e o conjunto | T-1434 … T-1439 | **P5**, **P6** | ⚠️ **P6 ✅ · P5 aberto** — T-1434 e T-1435 pendentes (§11.5) |

### 2.1 Pontos de não retorno

**T-1410 é o primeiro toque em `src/`.** Tudo antes dela é instrumento, e pode ser descartado sem
custo. Depois dela, o `document.xml` gerado deixa de ser cópia do modelo.

**T-1427 e T-1428 destroem a única asserção que hoje afirma a capa.** Só entram com a T-1426
verde: converter o teste antes de a derivação estar certa deixa o projeto sem nenhuma referência
sobre a capa, exatamente como a T-1246 do TASKS 018 evitou com o catálogo.

**T-1429 muda uma fixture compartilhada.** `relatorio_vazio` é usada por `test_docx_estrutura.py`
**e** por `test_docx_anexos.py`. A T-1432 é o portão que prova que os 32 testes de anexo não
dependiam do conteúdo dela.

### 2.2 Um desvio já conhecido, antes de começar

**A ESPEC 020 §9.3 foi corrigida na v1.2, e a T-1402 já está feita em espírito.** O critério de
aceite original — *"a cadeia `SMIT` não aparece no pacote"* — era inatingível, e a espec já traz a
redação certa. A T-1402 permanece no backlog como **conferência**, não como redação: alguém tem de
verificar que nenhum outro ponto da espec ou do plano ainda persegue a palavra `SMIT`.

### 2.3 A régua da entrega — o que pode mudar de comportamento

| Muda | Não muda |
|---|---|
| Os cinco campos variáveis da capa, nos dois pares | A diagramação da capa: fonte, cor, posição, arte |
| Três parágrafos da capa **do piloto** (ESPEC §9.1, sancionado) | Os seis parágrafos restantes da capa do piloto |
| `Contract` e `Report` ganham `cliente` | O corpo do documento, os anexos, o rodapé, o timbrado |
| Uma validação nova, `V-CAP-01`, que **não dispara** nos dois pares | O número de achados dos dois pares |
| `relatorio_vazio` ganha dois campos | O que os 32 testes de anexo afirmam |

---

## 3. Épico E0 — O alvo é atingível `[portão P0]`

> **Nenhum arquivo de `src/` é tocado neste épico** — salvo o registro de constantes da T-1400,
> que não é executado por ninguém ainda.

#### T-1400 — A lista das cadeias identificadoras
**Tamanho:** PP · **Ref:** `R-CAP-09`

Em `infrastructure/report/modelo.py`, uma tupla nomeada com as **cinco** cadeias do modelo que
identificam um contrato:

```
'SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA'
'SMIT SUSTENTAÇÃO'
'Contrato : TC 52/SMIT/2024 - TA 02'
'Proposta : PC-SMIT-240402-53 V1.0 / PA-SMIT-250220-15 V 1.4 /'
'PA-SMIT-260319-739'
```

**Não** incluir `UTILIZAÇÃO DE RECURSOS DE INFRAESTRUTURA`, `DIRETORIA DE INFRAESTRUTURA E
TECNOLOGIA` nem `GIO - GERÊNCIA DE OPERAÇÕES`: identificam a PRODAM, ficam no documento por
`R-CAP-08`, e pô-las na lista faria a varredura acusar o comportamento correto.

**Pronto quando:** a tupla existe, com comentário dizendo que ela é a **fonte única** da varredura
de `R-CAP-09` e do mapa de posições da T-1409.

---

#### T-1401 — A lista é necessária e suficiente `[portão P0]`
**Tamanho:** P · **Ref:** PLANO 020 §6 · **Portão P0**

Duas asserções, e as duas contra documentos reais:

| Afirmação | Como |
|---|---|
| **Suficiente** | as cinco cadeias cobrem as **12** ocorrências de `SMIT` no `document.xml` do modelo |
| **Necessária** | nenhuma delas casa a ocorrência de `SMIT` que a aba `NAS` do levantamento do PGM produz no anexo |

A segunda é a razão de este épico existir. *"O documento do PGM não fala em SMIT"* é falso e
sempre será — a planilha que o cliente enviou fala. *"Nada do contrato do SMIT vaza para o
documento do PGM"* é verdadeiro e verificável, e a diferença entre as duas frases é **uma célula**.

**Pronto quando:** as duas asserções existem, e a segunda cita nominalmente a aba `NAS` no
comentário, para que ninguém a "simplifique" depois.

---

#### T-1402 — Conferir que nada mais persegue a palavra `SMIT`
**Tamanho:** PP · **Ref:** PLANO 020 §6 · **Portão P0**

A ESPEC 020 v1.2 já corrigiu §9.2 e §9.3. Esta tarefa é a **conferência**: varrer espec e plano
atrás de qualquer outro ponto que ainda escreva o critério sobre a palavra em vez de sobre as
cadeias.

**Pronto quando:** nenhuma ocorrência de *"a cadeia `SMIT`"* como critério sobrou nos dois
documentos.

---

## 4. Épico E1 — Os instrumentos, e o que reprova reprova `[portão P1]`

> **Nenhum arquivo de `src/` é tocado neste épico.** O instrumento nasce antes do alvo — é a regra
> que a ESPEC 017 estabeleceu e a 019 confirmou.

#### T-1403 — A varredura
**Tamanho:** P · **Ref:** `R-CAP-09`

Arquivo novo — `backend/tests/test_capa.py`. Gerado o documento, nenhuma cadeia da T-1400 aparece
em **nenhuma parte do pacote**, e não só na capa.

A varredura é sobre o pacote porque `mc:AlternateContent` guarda uma representação que o teste que
lê a capa por `w:txbxContent` pode não estar olhando (`D-02`).

**Pronto quando:** a varredura existe, parametrizada pelos dois pares.

---

#### T-1404 — Ver a varredura reprovar `[portão P1]`
**Tamanho:** PP · **Ref:** PLANO 020 §2 · **Portão P1**

Rodar contra o código **atual** e exigir que reprove no PGM com as **12 ocorrências nominais, por
cadeia** — nunca por contagem agregada.

Uma varredura que afirme *"12 ocorrências"* fica verde no dia em que alguém preencher quatro
campos e esquecer o quinto, **se outro passar a aparecer duas vezes**. O relatório de falha tem de
dizer **qual** cadeia sobrou.

**Pronto quando:** o teste reprova, e a mensagem de falha nomeia as cinco cadeias e onde cada uma
está.

---

#### T-1405 — O simétrico já passa
**Tamanho:** PP · **Ref:** `R-CAP-09`

A varredura das cadeias do **PGM** contra o documento do **piloto** passa hoje, e tem de continuar
passando.

Parece trivial e não é: é o que impede a implementação de "resolver" o problema escrevendo o
conteúdo do PGM no modelo.

**Pronto quando:** o teste existe e passa desde já.

---

#### T-1406 — A estrutura da capa
**Tamanho:** PP · **Ref:** **Portão P4**

Seis blocos `w:txbxContent`, três parágrafos cada.

Parece decorativo e é o que sustenta a `D-09`: endereçar campo por `(caixa, parágrafo)` só é
seguro enquanto a forma for essa. Se um modelo novo entrar com outra estrutura, este teste acusa
**antes** de o endereçamento escrever no parágrafo errado.

**Pronto quando:** o teste existe e passa desde já.

---

#### T-1407 — O delta sancionado da capa do piloto
**Tamanho:** P · **Ref:** ESPEC 020 §9.1 · **Portão P2**

Dos nove parágrafos, **seis idênticos ao modelo e três mudados**:

| parágrafo | | valor esperado |
|---|---|---|
| `c1·¶0` · `c1·¶1` · `c1·¶2` | idêntico | como no modelo |
| `c3·¶0` · `c3·¶1` · `c3·¶2` | idêntico | como no modelo |
| `c2·¶0` | muda | `Contrato : TC 52/SMIT/2024` |
| `c2·¶1` | muda | `Proposta : PA-SMIT-260319-739` |
| `c2·¶2` | muda | *(vazio)* |

**Os três valores esperados são transcritos do modelo à mão, nunca copiados da saída do código.**
Um teste que compare o programa consigo mesmo não mede nada — é a lição da T-1103 do TASKS 017.

Esta tarefa **passa pela metade** hoje: a parte dos seis idênticos já vale, a dos três mudados fica
vermelha até a F2 e a F3. Registre isso no teste, ou alguém vai "consertá-lo" na E1.

**Pronto quando:** o teste existe; os seis idênticos passam; os três mudados reprovam, e o
comentário diz que reprovar é o esperado até a T-1426.

---

#### T-1408 — A invariância do corpo
**Tamanho:** PP · **Ref:** **Portão P4**

No piloto, o conjunto de `<w:t>` **fora** das seis caixas da capa é idêntico ao de hoje.

Nada na suíte afirma isso — os 488 testes o cobrem indiretamente. É um cinto de uma linha, e a F2
abre o renderizador: pega edição acidental no corpo enquanto o arquivo está aberto, que é o risco
que a ESPEC 018 `D-10` tratou como prioridade.

**Pronto quando:** o teste existe e passa desde já.

---

## 5. Épico E2 — Escrever nos campos

> **Publicável sozinho.** Ao fim deste épico o vazamento acabou, com a capa ainda identificando o
> órgão pelo número do contrato.

#### T-1409 — O mapa de posições
**Tamanho:** P · **Ref:** `R-CAP-03`, `D-09`

Em `modelo.py`, ao lado da lista da T-1400: `(caixa lógica, parágrafo) → campo`, cobrindo as duas
cópias de cada caixa.

Nove posições, das quais **cinco** são campo e **três** são fixas de `R-CAP-08` — a nona,
`c1·¶0`, também é fixa.

**Pronto quando:** o mapa existe e cobre as seis cópias, com comentário explicando por que o
endereço não é a cadeia (regra 2 de §1.1).

---

#### T-1410 — `_preencher_a_capa`
**Tamanho:** M · **Ref:** `R-CAP-02` · **primeiro toque em `src/`**

No `docx_renderer`: escreve o texto do `<w:t>` endereçado pelo mapa da T-1409, **escapando o que
insere**.

O escape não é zelo abstrato: o nome do órgão vem de PDF e pode trazer `&`. Um `&` cru no `<w:t>`
produz XML inválido e o **Word recusa o arquivo inteiro** — falha total, num caminho que só
aparece com um cliente cujo nome o tenha.

**Pronto quando:** a função escreve nas duas cópias de cada caixa; teste com nome sintético
contendo `&` e `<` produz pacote que o `python-docx` reabre.

---

#### T-1411 — Contrato
**Tamanho:** PP · **Ref:** `R-CAP-06`, `D-03`

`c2·¶0` ← `Contrato : {contrato_referencia}`, **sem sufixo**.

**Pronto quando:** o piloto sai `Contrato : TC 52/SMIT/2024` e o PGM `Contrato : TC 015/PGM/2024`.

---

#### T-1412 — Propostas, nos três destinos
**Tamanho:** P · **Ref:** `R-CAP-07`, `D-09`

- `c2·¶1` ← `Proposta : ` + `' / '.join(propostas)`
- `c2·¶2` ← **vazio**
- `c3·¶2` ← `' / '.join(propostas)`, sem prefixo

O `c2·¶2` esvazia porque o modelo o usava como **quebra visual** da linha longa. Escrever a lista
inteira no `¶1` e deixar o `¶2` vazio é determinístico e não exige matemática de layout.

**Pronto quando:** os três destinos recebem o previsto, e o PGM com aditivo sai
`Proposta : PA-PGM-251015-159 / PA-PGM-260304-715`.

---

#### T-1413 — O teste que pega o endereçamento por cadeia `[risco]`
**Tamanho:** PP · **Ref:** `D-09`

`c3·¶2` recebe a lista **e** `c2·¶2` fica vazio.

É a asserção que reprova numa implementação que faça `.replace()` sobre o XML: ali os dois
receberiam a lista, e o `c2` a teria duas vezes. Sem este teste, o defeito da ESPEC 020 v1.0
voltaria pelo código.

**Pronto quando:** o teste existe e falharia numa implementação por `replace`.

---

#### T-1414 — As duas cópias concordam
**Tamanho:** PP · **Ref:** `R-CAP-03`, `D-02`

Para cada caixa lógica, o texto das duas cópias é igual entre si.

É o teste do defeito que **não se reproduz na máquina de quem testa**: preenchida uma cópia só, o
documento mostra o cliente certo em uma versão do Word e o errado em outra.

**Pronto quando:** o teste percorre as três caixas lógicas e compara par a par.

---

#### T-1415 — Cliente e subtítulo caem, deliberadamente
**Tamanho:** PP · **Ref:** `R-CAP-10`

Nesta fase os dois ainda **não** são derivados: caem para `contrato_referencia` pela cascata de
`D-10`.

É estado intermediário **deliberado**, e é o que torna o épico publicável: a capa fica menos
informativa do que ficará e **já não nomeia outro órgão**.

**Pronto quando:** o comportamento está assim e há comentário dizendo que é temporário, com
referência à T-1417.

---

#### T-1416 — O vazamento acabou
**Tamanho:** PP · **Ref:** **P3** parcial

A varredura da T-1403 passa nos dois pares, mesmo sem as derivações.

**Pronto quando:** T-1403 verde nos dois. Ponto de corte de entrega — daqui já se pode publicar.

---

## 6. Épico E3 — As derivações, e o piloto é reproduzido `[portão P2]`

#### T-1417 — `_cliente(pdf)`
**Tamanho:** P · **Ref:** `R-CAP-04`, ESPEC §2.5

No extrator, ao lado de `_proposta`: o texto que segue `prestação de serviços para a` até o
primeiro ponto, **sem a sigla**, em caixa alta.

A remoção da sigla é `-` seguido de duas ou mais maiúsculas, **com ou sem espaço antes do hífen**.

**Pronto quando:** existe, e o comentário registra que a prosa é a única fonte não estrutural do
projeto inteiro (`D-05`).

---

#### T-1418 — Os dois separadores `[risco]`
**Tamanho:** PP · **Ref:** `R-CAP-04`, ESPEC §2.5

No mesmo teste, as duas formas medidas:

```
'Secretaria Municipal de Inovação e Tecnologia- SMIT'  → 'SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA'
'Procuradoria Geral do Município de São Paulo - PGM'   → 'PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO'
```

Um `rsplit(' - ')` passa no segundo e **falha no primeiro**, deixando `TECNOLOGIA- SMIT` na capa
— e falha no par cuja capa correta já se conhece, onde ninguém olharia duas vezes.

**Pronto quando:** o teste tem as duas formas, e falharia num `rsplit(' - ')`.

---

#### T-1419 — `cliente` no domínio
**Tamanho:** PP · **Ref:** `D-07`

`Contract.cliente: str = ""`, `Report.cliente: str = ""`, e o repasse no caso de uso. **Por último
e com padrão** (regra 6 de §1.1).

**Pronto quando:** nenhuma construção existente de `Contract` ou `Report` na suíte precisou mudar.

---

#### T-1420 — `Contract.aplicar` repassa `cliente` `[risco]`
**Tamanho:** PP · **Ref:** `D-07`, ESPEC 019

`aplicar` monta um `Contract` novo a partir de uma lista fixa de campos. Um campo que não entre
nessa lista **some em silêncio, e só no caminho com aditivo** — que é o do PGM, que é o motivo
desta espec existir.

**Pronto quando:** `cliente` está na construção de `aplicar`.

---

#### T-1421 — O cliente sobrevive à consolidação
**Tamanho:** PP · **Ref:** `D-07`

Teste: com aditivo, o consolidado mantém o cliente da proposta.

Falha hoje se a T-1420 não existir. É o par instrumento/correção da regra do épico.

**Pronto quando:** o teste existe e falharia sem a T-1420.

---

#### T-1422 — Subtítulo
**Tamanho:** PP · **Ref:** `R-CAP-05`

`c1·¶2` ← miolo do título da aba, entre `LEVANTAMENTO - COMPROVAÇÃO ` e
` - CATÁLOGO DE SERVIÇOS DIT`.

**Pronto quando:** piloto `SMIT SUSTENTAÇÃO`, PGM `PGM TC 015`.

---

#### T-1423 — A cascata
**Tamanho:** P · **Ref:** `R-CAP-10`, `D-10`

```
cliente     ← prosa da proposta  →  subtítulo  →  contrato_referencia
subtítulo   ← título da aba      →  contrato_referencia
```

Fecha em algo que sempre existe. Se `contrato_referencia` faltar, `V-MED-02` já bloqueou antes.

**Pronto quando:** nenhum campo da capa sai vazio em nenhum caminho.

---

#### T-1424 — `V-CAP-01`
**Tamanho:** PP · **Ref:** ESPEC §8.1

`v_cap_01_cliente_nao_derivado`, severidade `AVISA`.

Avisa e não bloqueia: o caminho de falha tem saída segura, e barrar a geração por causa de uma
linha de capa seria pior que o problema.

**Pronto quando:** existe e está no fluxo do container.

---

#### T-1425 — `V-CAP-01` sob prova
**Tamanho:** PP · **Ref:** ESPEC §9.2

Dispara em fixture cuja primeira página não traz a frase; **não** dispara nos dois pares reais.

**Pronto quando:** as duas metades afirmadas.

---

#### T-1426 — O teste-oráculo `[portão P2]`
**Tamanho:** PP · **Ref:** ESPEC §2.4 · **Portão P2**

No piloto, cliente e subtítulo saem **idênticos ao modelo**:

```
SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA
SMIT SUSTENTAÇÃO
```

**É o portão mais forte deste backlog e custa três linhas.** A capa correta do piloto já existe;
se a derivação a reproduz caractere por caractere, ela está certa — não *provavelmente certa*.
Mesma natureza da T-1112 do TASKS 017, que exigiu igualdade e não equivalência.

Com ela verde, a **T-1407 inteira** passa a valer.

**Pronto quando:** T-1426 e T-1407 verdes. P2 fechado.

---

## 7. Épico E4 — Converter os testes de capa `[portões P3 e P4]`

> **Só começa com a T-1426 verde** (§2.1).

#### T-1427 — `test_a_capa_e_identica_a_do_modelo` inverte
**Tamanho:** P · **Ref:** `D-08`, `R-CAP-08`

Passa de igualdade total para **igualdade menos os cinco campos**: os quatro textos fixos
idênticos, a estrutura idêntica.

Não é apagado. Era a `R-DOC-02` escrita como asserção, e era a regra certa quando havia um cliente
só.

**Pronto quando:** o teste afirma o que continua verdadeiro, e o docstring registra o que mudou e
por quê.

---

#### T-1428 — `test_a_capa_traz_o_conteudo_esperado` inverte
**Tamanho:** PP · **Ref:** `D-08`

Deixa de citar `SMIT SUSTENTAÇÃO` como conteúdo esperado de qualquer documento, e passa a citar o
que foi submetido — **nos dois pares**.

É o teste que teria pegado o defeito se existisse com o segundo par.

**Pronto quando:** parametrizado pelos dois pares.

---

#### T-1429 — `relatorio_vazio` ganha os campos
**Tamanho:** PP · **Ref:** ESPEC §7

`cliente` e um `titulo` que case o padrão de `R-CAP-05`.

**Fixture compartilhada** — ver §2.1. A T-1432 é o portão.

**Pronto quando:** alterada, e `test_docx_estrutura.py` verde.

---

#### T-1430 — A fixture da cascata
**Tamanho:** PP · **Ref:** `R-CAP-10`

Fixture **nova**, com `titulo` fora do padrão e sem cliente.

Não reaproveitar a `relatorio_vazio`: depois da T-1429 ela passa a ser o caso feliz, e o caso de
cascata perde o seu exemplar. É justamente o caso que a revisão da espec descobriu estar aberto.

**Pronto quando:** existe, e a T-1423 a usa.

---

#### T-1431 — A capa do PGM
**Tamanho:** PP · **Ref:** `R-CAP-01`

```
PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO
PGM TC 015
Contrato : TC 015/PGM/2024
Proposta : PA-PGM-251015-159 / PA-PGM-260304-715
```

**Conferência, não prova** (§1.1 regra 1): nada independente diz que estes são os valores certos.
O que este teste guarda é a **estabilidade** deles.

**Pronto quando:** os quatro afirmados, com o docstring registrando que o oráculo do PGM é o
`K-20`.

---

#### T-1432 — Os 32 de anexo, intactos `[portão P4]`
**Tamanho:** PP · **Ref:** **Portão P4**

`test_docx_anexos.py` verde **sem uma linha alterada**, apesar de a T-1429 ter mudado a fixture
que ele compartilha.

**Pronto quando:** `git diff --stat` sobre o arquivo mostra zero linhas.

---

#### T-1433 — Varredura limpa e estrutura intacta `[portões P3 e P4]`
**Tamanho:** PP · **Ref:** **P3**, **P4**

T-1403, T-1406, T-1407, T-1408, T-1413 e T-1414 verdes nos dois pares.

**Pronto quando:** P3 e P4 fechados.

---

## 8. Épico E5 — Alguém abre o Word, e o conjunto `[portões P5 e P6]`

#### T-1434 — Abrir os dois documentos `[portão P5]`
**Tamanho:** P · **Ref:** `K-20` · **Portão P5**

Gerar os dois e **abrir no Word**, conferindo a lista do `K-20` item a item.

Nenhuma asserção sobre XML prova que o texto coube na caixa, que a fonte não mudou ou que a arte
não ficou por cima. A ESPEC 003 registrou que a suíte de DOCX releu por meses o que ela mesma
escrevia e deixou seis defeitos passarem.

**Pronto quando:** os itens do `K-20` conferidos e registrados em §10.

---

#### T-1435 — Responder o `I-05` `[portão P5]`
**Tamanho:** PP · **Ref:** ESPEC `I-05` · **Portão P5**

Com o Word aberto: a linha `Proposta :` do PGM, com duas peças, **não foi cortada**. Registrar
quantas peças se observou caberem.

É a única pergunta desta espec que nenhum teste responde.

**Pronto quando:** o número está escrito no `K-21` e em §10.

---

#### T-1436 — A suíte `[portão P6]`
**Tamanho:** PP · **Ref:** **Portão P6**

Verde, com a contagem reconciliada contra os 488 iniciais mais os novos.

**Pronto quando:** verde **e** o número bate — não basta verde.

---

#### T-1437 — Ferramentas `[portão P6]`
**Tamanho:** PP · **Ref:** **Portão P6**

`ruff check`, `mypy src/`, `bandit -ll -r src/` limpos.

---

#### T-1438 — Fechar a documentação
**Tamanho:** PP

ESPEC 020 → **Implementada**, com as emendas de execução. **ESPEC 018 `I-01` → resolvido** — é o
bilhete que esta entrega existe para tirar.

---

#### T-1439 — CHANGELOG e este backlog
**Tamanho:** PP

CHANGELOG com o resultado; §10 deste arquivo com desvios e a resposta ao `I-05`.

---

## 9. Insumos

| ID | Insumo | Para quê | Quando |
|---|---|---|---|
| `K-20` | **Lista do que conferir com o Word aberto**: nome do órgão; subtítulo; linha `Contrato :`; linha `Proposta :` **inteira e não cortada**; rodapé da capa; os três textos da PRODAM; a arte de fundo; a ausência de página em branco depois da capa | **P5** | T-1434 |
| `K-21` | Quantas peças cabem na linha `Proposta :` antes do corte | `I-05` | T-1435 |
| `K-22` | Decisão de negócio sobre o `I-01` — se o ` - TA 02` faz falta e entra como campo do formulário | ESPEC `I-01` | depois |

---

## 10. O que este backlog não faz

- **Não toca a diagramação da capa** (§1.1 regra 5).
- **Não inventa** o ` - TA 02`, as versões nem a pilha histórica (§1.1 regra 4).
- **Não altera** `modelo_prodam.docx`. Ele é entrada, e `test_o_modelo_nao_e_alterado` continua
  provando isso sem mudança.
- **Não resolve** o estouro da caixa. Mede se existe (`K-21`) e para aí.
- **Não toca** o rodapé do documento, que a ESPEC 019 `D-09` acabou de mexer, nem o corpo, nem os
  anexos, nem o grid, nem a análise.

---

## 11. O que a implementação ensinou

### 11.1 A unidade do endereço era o `<w:t>`, não o parágrafo

A ESPEC 020 §2.1 modelava a capa como *"três caixas de três parágrafos"*. **Falso, em duas das
três.** Medido pela T-1404, contra o código intocado:

```
caixa 1 · 3 parágrafos
caixa 2 · 4 parágrafos   ← um vazio entre `Contrato :` e `Proposta :`
caixa 3 · 2 parágrafos   ← `GIO` e a proposta no MESMO parágrafo, em dois runs
```

Os nós `<w:t>` são **três em todas as seis caixas**, e cada campo é um deles inteiro. As constantes
de `modelo.py` já eram as tuplas certas — o que estava errado era a **unidade**.

**A T-1404 pagou-se aqui.** Endereçar por parágrafo escreveria o cliente no lugar certo, o contrato
no lugar certo, e o rodapé da capa **num parágrafo que não existe** — `IndexError` no melhor caso,
campo errado no pior. O instrumento pegou antes de haver uma linha de `src/` para depurar.

### 11.2 A varredura é assimétrica, e a versão 1.0 do teste não era

Escrevi a T-1403 parametrizada pelos dois pares, aplicando `CADEIAS_DO_MODELO` a ambos. Reprovou no
piloto **depois** de a implementação estar certa — porque `SMIT SUSTENTAÇÃO` e `PA-SMIT-260319-739`
são os dados **verdadeiros** daquele contrato, e a derivação os reproduz.

É a mesma armadilha da palavra `SMIT` que o PLANO 020 §6 documentou, um grau mais fina: lá eu
comparava contra dado do cliente, aqui contra a saída correta. A regra é *nada de **outro** contrato
sobrevive aqui*, e ela não se escreve com uma lista só.

O teste virou dois: as cadeias do modelo contra o documento do PGM, e as do PGM contra o do piloto.

### 11.3 A âncora do corpo tinha de ser medida na fixture

Medi `16.027` nós no documento gerado a partir de `docs/documentos/`, e o teste — que usa a
**fixture sanitizada** — obteve `16.028`. Um nó de diferença, porque a sanitização substitui dado
pessoal por sintético.

É a ESPEC 018 §14.2 outra vez: *a suíte testava uma forma que a produção nunca vê*. Aqui o risco era
o inverso e igualmente ruim — gravar num teste um número medido num arquivo que ele não usa.

### 11.4 Eram três testes invertendo, não dois

O inventário do PLANO 020 §5.1 listou `test_a_capa_e_identica_a_do_modelo` e
`test_a_capa_traz_o_conteudo_esperado`. Faltou **`test_a_capa_sobrevive_a_remocao_da_folha_em_branco`**,
que também comparava a capa inteira com o modelo — para provar outra coisa, que ela não fora removida
junto com a folha em branco.

O inventário foi feito por leitura do que os testes **afirmam sobre a capa**, e este afirma sobre a
**remoção da folha**. Procurar por assunto perde o que usa a mesma asserção para outro fim; procurar
pela **asserção** — `== _caixas_de_texto(MODELO)` — teria achado os três.

### 11.5 O que ficou por fazer

**O portão P5 não foi fechado.** Abrir o Word é humano, e as T-1434 e T-1435 continuam abertas. Os
dois documentos estão gerados em `saida/capa/` para a conferência, e o `I-05` — quantas propostas
cabem na linha antes do corte — segue sem resposta.

É o único portão desta entrega que nenhum teste substitui, e o `K-20` é a lista do que olhar.
