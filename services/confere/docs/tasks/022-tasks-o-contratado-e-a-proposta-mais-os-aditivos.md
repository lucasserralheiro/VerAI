# TASKS 022 — Backlog de "O contratado é a proposta mais os seus aditivos"

| | |
|---|---|
| **Especificação** | [ESPEC 022](../specs/022-o-contratado-e-a-proposta-mais-os-aditivos.md) v1.0 |
| **Plano** | [PLANO 022](../plans/022-plano-o-contratado-e-a-proposta-mais-os-aditivos.md) v1.1 |
| **Versão** | 1.0 — 2026-08-18 |
| **Total** | 31 tarefas · 6 portões · **3** insumos |
| **Status** | **Concluído** — 2026-08-18. Portões `P0` a `P5` fechados. Suíte de backend 537 → **547** em 21m25s; `ruff`, `mypy` e `bandit -ll` limpos; `frontend/` intocado. Três desvios em §11 |

> Escrito **antes** da implementação, como o TASKS 017, o 018, o 020 e o 021.

---

## 1. Convenções

**Identificadores** `T-16nn` seguem a numeração do PLANO 022, que começa em T-1600 porque a
implementação da ESPEC 021 fechou em T-1537.

**Definição de pronto — backend:** código e teste na mesma entrega; `ruff check`, `mypy src/` e
`bandit -ll -r src/` limpos; `pytest` verde; comentário explicando o *porquê* onde a escolha não
for óbvia.

**Frontend:** não há. Esta entrega não abre um arquivo de `frontend/`, e a T-1628 é a verificação
disso.

**Convenção de commit** `<tipo>(T-16nn): descrição`.

### 1.1 Cinco regras que atravessam o backlog

**1 — Os cinco deltas vêm do PDF, nunca da saída do extrator.** `554,01`, `-80,00`, `2.900,89`,
`5,00` e `1.100,00` são a única verdade externa desta entrega. Escrever a asserção a partir do que
o código produziu transforma o teste em *"o código faz o que o código faz"* — e o sinal negativo
do `12.030.00001.00` é o valor mais fácil de estragar sem querer.

**Exceção única e nomeada:** as âncoras de invariância dos artefatos (T-1601, T-1602). Elas não
afirmam correção, e sim que **nada se moveu** — e o que sai hoje já está certo e já é entregue.

**2 — A âncora do entregável é capturada antes do primeiro toque em `src/`.** A promessa desta
espec é *"não interfere no docx nem no xlsx"*. Capturada depois, ela grava o que a implementação
produziu e a promessa vira tautologia.

O sinal no diff é literal: qualquer alteração em `domain/`, `application/` ou `infrastructure/`
num commit anterior ao da T-1601.

**3 — Um teste que afirma o comportamento revogado é partido, não apagado.** Dois testes vão ao
vermelho por mérito (§2.3). Num deles, metade das asserções **continua valendo** — e é a metade
que protege o documento.

O sinal no diff é uma remoção de `def test_` sem uma adição correspondente nomeada na mesma
entrega.

**4 — A soma existe antes de a supressão sair.** O E2 soma e não remove nada; o E3 remove. A ordem
inversa abre uma janela em que o par com aditivo exibe cinco avisos falsos.

**5 — O sinal do delta não se inventa.** Nada de `abs()`, nada de negar por rótulo, nada de
`if rotulo is REDUCAO: -q`. O documento traz `-80.00` e é isso que se soma. `RotuloDeBloco` decide
**o que fazer**, nunca **com que sinal** (`D-02`).

É o defeito mais provável desta entrega **porque parece acabamento**: um número negativo numa
coluna de quantidade parece erro de extração para quem não leu a espec.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** O oráculo e a âncora do entregável | T-1600 … T-1603 | **P0** | F0 |
| **E1** Os instrumentos, e o da cegueira reprova | T-1604 … T-1609 | **P1** | F1 |
| **E2** A soma existe, e a supressão continua | T-1610 … T-1613 | **P1**, **P2** | F2 · **publicável** |
| **E3** A supressão sai | T-1614 … T-1621 | **P1**, **P3**, **P4** | F3 |
| **E4** Os textos que ficaram falsos | T-1622 … T-1626 | — | F4 |
| **E5** O conjunto | T-1627 … T-1630 | **P5** | F5 |

**Numeração dos portões:** este backlog usa os do PLANO 022 (`P0`–`P5`). A ESPEC 022 §8.4 tem os
seus dois: o `P1` **da espec** é o `P1` daqui; o `P2` da espec é o `P3` daqui.

### 2.1 Pontos de não retorno

**T-1610 é o primeiro toque em `src/`.** Tudo antes dela é instrumento e pode ser descartado sem
custo nenhum.

**T-1607 destrói cobertura se for feita no automático.** O `test_t1320_aumento_e_reducao_nao_mudam_nada`
vai ao vermelho na T-1610, e o seu docstring se anuncia como *"`R-ADT-06` — o coração da espec, no
seu teste mais direto"* — o que o marca como candidato óbvio à deleção. Metade das suas asserções
continua verdadeira, e é a **única cobertura existente** do comportamento que a guarda de
`R-QTD-03` preserva.

**T-1614 é irreversível na prática.** Depois dela o silêncio da `V-REC-01` é aritmético, e a
comparação entre os dois mecanismos — que é o portão P2 — exige `git stash`. **Não entra sem o P2
fechado.**

**O fim do E2 é o ponto de reversão do backlog.** Dali o produto está correto e nada mudou para
quem usa. O E3 entrega o valor e é o único épico que pode ser revertido isoladamente sem deixar o
sistema pior do que estava.

### 2.2 A régua da entrega — o que pode mudar de comportamento

| Muda | Não muda |
|---|---|
| `Contract.aplicar` passa a somar `Aumento` e `Redução` | `posicao_de`, `descricao_para` e `_unidade` — o delta entra no fim, o código já existe antes |
| `V-REC-01` passa a comparar em vez de suprimir | O caminho **sem aditivo**: cinco avisos antes, cinco depois |
| `V-REC-01` perde o parâmetro `explicados` | `codigos_ignorados()`, que é insumo de `V-ADT-04` |
| O texto da `V-ADT-02` | O predicado `altera_o_conjunto` (`D-06`) |
| Dois docstrings de teste que passam a mentir (§5.2 do PLANO) | As asserções desses dois testes |
| A suíte ganha `test_quantitativo_consolidado.py` | O `.docx` e o `.xlsx`, byte a byte, exceto `docProps/core.xml` |
| — | **`frontend/`, inteiro.** Nem um arquivo |

### 2.3 Os dois testes que mudam de valor

Levantados na v1.1 do plano, lendo **todos** os testes que mencionam `AUMENTO`/`REDUCAO`:

| Teste | Asserção que cai | Asserção que sobrevive | Tarefa |
|---|---|---|---|
| `test_t1320_aumento_e_reducao_nao_mudam_nada:112` | a lista de itens do consolidado | `"99.999.00001.00" not in codigos` — pela guarda | T-1607 |
| `test_t1331_v_adt_02_avisa_aditivo_sem_efeito:200` | `"não altera o conjunto" in mensagem` | o disparo da `V-ADT-02` | T-1623 |

---

## 3. Épico E0 — O oráculo e a âncora do entregável `[portão P0]`

> **Nenhum arquivo de `src/` é tocado neste épico.**

#### T-1600 — Transcrever os cinco deltas e as cinco somas
**Tamanho:** PP · **Ref:** ESPEC 022 §2.1, §2.2

Arquivo novo — `backend/tests/test_quantitativo_consolidado.py`. Duas constantes: os cinco deltas
dos blocos `Aumento` e `Redução` do `aditivo_pgm.pdf`, e as cinco somas esperadas.

**Lidas abrindo o PDF do aditivo**, não rodando o extrator.

O `12.030.00001.00` entra `-80,00`, com o sinal que o documento traz. Transcrevê-lo como `80,00`
"porque redução é positiva" é o erro que a T-1603 existe para pegar, e é o mesmo erro que a regra
5 do §1.1 descreve.

**Pronto quando:** as duas constantes existem, com comentário dizendo que são a **fonte única** das
asserções de quantidade deste backlog e que não podem ser regeneradas a partir do código.

---

#### T-1601 — Âncora de invariância dos artefatos `[portão P1]`
**Tamanho:** P · **Ref:** ESPEC 022 §2.3 · **Portão P1**

Gerar `.docx` e `.xlsx` do par **PGM + aditivo** — o `resultado_do_pgm` de
`test_consolidacao_aditivos.py:330` já monta as entradas — e guardar o hash de cada entrada do
zip.

**Excluir `docProps/core.xml`, e só ela.** A exclusão é legítima porque a parte foi aberta e
medida: a única diferença é `dcterms:modified`, o carimbo de hora, que muda entre duas execuções
quaisquer. Excluir sem olhar teria escondido qualquer alteração de metadado real — o comentário
tem de registrar isso, senão a próxima pessoa amplia a exclusão sem o mesmo cuidado.

**Passa desde já**, contra o código intocado. É a única tarefa deste épico que não pode esperar:
capturada depois do E2, ela grava o resultado da mudança e não prova nada.

**Pronto quando:** verde, e a mensagem de falha nomeia **qual entrada do zip** divergiu.

---

#### T-1602 — Âncora do objeto `Report`
**Tamanho:** PP · **Ref:** ESPEC 022 §2.3 · **Portão P1**

Do mesmo par: linhas (código, descrição, unidade, contratada, medida), `demais_itens`,
`total_divergencias` e a contagem de derivadas.

Parece redundante com a T-1601 e não é. O hash do zip responde *sim ou não*; quando a resposta for
*não* — e num refactor futuro será —, ele não diz se mudou uma quantidade, uma descrição ou a
ordem. Esta diz, e falha antes.

**Pronto quando:** verde, com a comparação campo a campo e a falha apontando a linha divergente.

---

#### T-1603 — A transcrição casa o que o extrator lê `[portão P0]`
**Tamanho:** PP · **Ref:** PLANO 022 §3 · **Portão P0**

Rodar **só o `PdfPlumberContractExtractor`** sobre `aditivo_pgm.pdf` e comparar os cinco deltas
contra a constante da T-1600 — código, quantidade e sinal. Sem consolidação, sem relatório, sem
container.

Se reprovar, há duas hipóteses com consequências opostas: erro de transcrição (barato) ou o
extrator entregando outra coisa (caro, e muda a ESPEC §2.1). **Descobrir aqui custa dez minutos.**

**Pronto quando:** verde, e a mensagem de falha mostra o código e o valor divergente — não só
*"assert False"*.

---

## 4. Épico E1 — Os instrumentos, e o da cegueira reprova `[portão P1]`

> **Nenhum arquivo de `src/` é tocado neste épico.** O instrumento nasce antes do alvo — regra que
> a ESPEC 017 estabeleceu e a 019, a 020 e a 021 confirmaram.
>
> Os dois testes de §2.3 são reescritos **aqui**, e não no E2: quando a soma entrar, a suíte já
> tem de estar dizendo a verdade nova.

#### T-1604 — As cinco somas, e a assinatura
**Tamanho:** P · **Ref:** ESPEC 022 §8.1

Em `test_quantitativo_consolidado.py`, contra o oráculo da T-1600 e passando pela consolidação:

| Afirmação | Valor |
|---|---|
| `10.050.00001.00` | 42.814,01 |
| `12.030.00001.00` | 70,00 |
| `14.024.00006.00` | 9.000,89 |
| `14.031.00020.00` | 10,00 |
| `14.048.00027.00` | 1.300,00 |

Os **números**, um a um — não a contagem de divergências. Um teste que afirme só *"zero
divergências"* passaria com a soma errada em dois códigos que se cancelassem.

Mais a asserção de assinatura: `v_rec_01_divergencia_de_quantidade_contratada` não aceita
`explicados`. É o que impede o parâmetro de voltar como padrão silencioso — vermelha só a partir
do E3.

**Vermelha até o E2.** TDD comum, não portão.

**Pronto quando:** as cinco asserções existem e falham pelo motivo certo (soma não aplicada), e a
de assinatura existe.

---

#### T-1605 — O teste da cegueira `[portão P3]`
**Tamanho:** P · **Ref:** ESPEC 022 §2.4 · **Portão P3**

Par com aditivo, `contratada_texto` do `14.048.00027.00` adulterado de `1.300` para `1.400` na
medição em memória — `MeasurementItem` é `frozen` e `contratada` é propriedade, então o caminho é
`replace(item, contratada_texto="1400")`.

Asserção: `V-REC-01` acusa **aquele** código.

**Rodar contra o código intocado e exigir que reprove**, acusando zero avisos onde deveria haver
um. É o único instrumento deste backlog que mede o defeito; escrito depois do E3, estaria verde no
primeiro dia e não provaria nada.

**Pronto quando:** reprova hoje, com o zero nomeado no relatório de falha, e o docstring registra
que a reprovação é o comportamento esperado nesta fase.

---

#### T-1606 — A asserção do sinal
**Tamanho:** PP · **Ref:** `R-QTD-02`, `D-02`

`12.030.00001.00` sai `70,00` — o único caso de redução dos dois pares.

É a asserção que falha se alguém aplicar `abs()` ao delta ou negar por rótulo. Separada da T-1604
de propósito: lá ela seria uma linha entre cinco, e o relatório de falha diria *"uma das somas
está errada"*. Aqui diz **qual defeito**.

**Pronto quando:** existe, com docstring citando `D-02` e a regra 5 do §1.1.

---

#### T-1607 — Partir o teste do `R-ADT-06`
**Tamanho:** P · **Ref:** PLANO 022 §5.3 · **§2.1 — ponto de não retorno**

`test_t1320_aumento_e_reducao_nao_mudam_nada` ([`test_consolidacao_aditivos.py:112`](../../backend/tests/test_consolidacao_aditivos.py))
é parametrizado em `AUMENTO`/`REDUCAO` e tem duas asserções. Elas seguem destinos opostos:

| Asserção | Destino |
|---|---|
| `[i.codigo.valor for i in consolidado.itens] == ["10.050.00001.00"]` | **Cai.** Vira asserção inversa em `test_quantitativo_consolidado.py`: o item do delta entra na lista |
| `"99.999.00001.00" not in consolidado.codigos` | **Fica onde está**, no teste renomeado. Verde hoje e depois — é a guarda de `R-QTD-03` |

O teste que fica precisa de nome novo: `test_t1320_aumento_e_reducao_nao_criam_codigo` ou
equivalente. O antigo se anuncia como *"o coração da espec"* de uma regra revogada, e manter o
nome deixaria um marcador falso na suíte.

**Não apagar o teste inteiro.** É o que a regra 3 do §1.1 nomeia, e o que o §2.1 marca como ponto
de não retorno: a metade que sobrevive é a única cobertura existente do comportamento que a guarda
preserva, e ela some no exato commit em que passa a importar.

**Pronto quando:** os dois testes existem, o docstring do que ficou explica que a guarda é o que
ele protege, e nenhuma asserção do original ficou órfã.

---

#### T-1608 — Reforçar o teste da `V-ADT-04`
**Tamanho:** PP · **Ref:** `R-QTD-03`, `D-03`

`test_t1333_v_adt_04_avisa_aumento_de_codigo_ausente` ([`:260`](../../backend/tests/test_consolidacao_aditivos.py))
afirma que o aviso sai. Não afirma que o consolidado ficou intacto — porque antes desta espec era
impossível ele não ficar.

Acrescentar: a **quantidade do consolidado não muda**, e `99.999.00001.00` continua fora de
`contrato.codigos`.

Verde hoje. Passa a ser a rede do único caminho pelo qual esta entrega conseguiria alterar o
`.docx`: um `Aumento` órfão entraria como item novo, o código ganharia posição no contrato e a sua
linha sairia do bloco final para o corpo ordenado.

**Pronto quando:** as duas asserções novas existem e o docstring explica por que passaram a ser
necessárias.

---

#### T-1609 — Delta e exclusão na mesma sequência
**Tamanho:** PP · **Ref:** `R-QTD-04`

Fixture sintética de duas peças, com `_peca` e `_bloco` que já existem em
`test_consolidacao_aditivos.py:48-66`: a primeira aumenta um código, a segunda o exclui.

Asserção: o código sai, e o delta não o ressuscita.

É o par do `test_t1320_os_aditivos_sao_aplicados_em_sequencia`, que hoje cobre só
`Inclusão`/`Exclusão`. Com quatro rótulos aplicados, a ordem passa a ter uma combinação a mais que
ninguém exercita.

**Pronto quando:** verde depois do E2, vermelho ou verde-por-acaso antes — o docstring diz qual.

---

## 5. Épico E2 — A soma existe, e a supressão continua `[portões P1 e P2]`

> **Nada é removido neste épico.** Com a supressão ainda no lugar, a tela é idêntica, o documento é
> idêntico e o comportamento é idêntico. É o commit mais chato do backlog e o mais seguro: se algo
> quebrar aqui, quebrou na consolidação, e não há segunda hipótese a investigar.

#### T-1610 — O ramo `Aumento`/`Redução` em `Contract.aplicar`
**Tamanho:** PP · **Ref:** `R-QTD-01`, `R-QTD-03` · **§2.1 — primeiro toque em `src/`**

```python
elif bloco.rotulo in (RotuloDeBloco.AUMENTO, RotuloDeBloco.REDUCAO):
    presentes = {i.codigo.valor for i in itens}
    itens.extend(i for i in bloco.itens if i.codigo.valor in presentes)
```

`presentes` é recalculado **dentro** do laço, e não uma vez antes: `R-QTD-04` exige que um código
excluído por uma peça anterior não receba delta de uma posterior, e um conjunto calculado fora
ignoraria a sequência.

Comentário obrigatório, com dois porquês: o sinal vem do documento (`D-02`) e a guarda existe para
não mudar a estrutura do `.docx` (`D-03`).

**Pronto quando:** T-1604, T-1606, T-1609 e a metade nova da T-1607 ficam verdes.

---

#### T-1611 — Docstring de `aplicar`
**Tamanho:** PP · **Ref:** `R-QTD-01`

Hoje afirma *"**Só `Inclusão` e `Exclusão` são aplicadas.**"* e sustenta a afirmação com a medição
das 58 linhas do PGM.

A medição continua verdadeira e ganha companhia: a ESPEC §2.3 mediu que, aplicando os quatro
rótulos, os artefatos saem idênticos. O parágrafo novo diz **por que** somar não move o documento
— as três coisas que o contrato fornece dependem só de quais códigos existem.

**Pronto quando:** o docstring não afirma mais nada que a T-1610 tornou falso.

---

#### T-1612 — O entregável não se mexeu `[portão P1]`
**Tamanho:** PP · **Portão P1**

T-1601 e T-1602 verdes depois da T-1610.

Se a T-1602 reprovar e a T-1601 passar, é bug no instrumento. Se as duas reprovarem, a leitura da
falha da T-1602 diz onde — e a suspeita número um é a guarda da T-1610 ausente ou mal escrita.

**Pronto quando:** as duas verdes, sem alteração em nenhuma das duas.

---

#### T-1613 — A soma bate, com os dois mecanismos `[portão P2]`
**Tamanho:** PP · **Portão P2**

Os cinco valores da T-1604 verdes, e `V-REC-01` continua em **0** no par com aditivo — agora com a
soma e a supressão concordando.

**É este portão que autoriza o E3.** Enquanto a soma não estiver medida contra o oráculo, remover
a supressão é trocar um mecanismo conhecido por um não verificado.

**Pronto quando:** P2 fechado e registrado.

---

## 6. Épico E3 — A supressão sai `[portões P1, P3 e P4]`

#### T-1614 — `explicados` sai da `V-REC-01`
**Tamanho:** PP · **Ref:** `R-QTD-06` · **§2.1 — irreversível na prática**

O parâmetro e a variável `silenciados`. O laço volta a percorrer `contrato.codigos` sem subtração.

**Não entra sem o P2 fechado.**

**Pronto quando:** a assinatura tem três parâmetros e a asserção de assinatura da T-1604 fica
verde.

---

#### T-1615 — `explicados=` sai do container
**Tamanho:** PP · **Ref:** `R-QTD-06`

A chamada em `infrastructure/di/container.py:151-158` volta a três argumentos, e o comentário
`# D-08 — cala sobre o que os blocos descartados já explicam` sai com ela.

**Pronto quando:** nenhuma referência a `explicados` sobra em `src/`.

---

#### T-1616 — Docstring da `V-REC-01`
**Tamanho:** PP · **Ref:** `R-QTD-06`

Saem os três parágrafos sobre o silêncio fundamentado — *"`explicados` cala o que um aditivo já
explicou"*, a medição dos cinco códigos e *"o silêncio é fundamentado, não conveniente"*.

Entra a razão nova, e ela é mais curta: a validação compara o contratado consolidado com o da aba,
e cala quando os dois batem.

**Pronto quando:** o docstring não descreve mecanismo que não existe.

---

#### T-1617 — Docstring de `codigos_ignorados()`
**Tamanho:** PP · **Ref:** `R-QTD-07` · **A função fica**

Hoje ele justifica a função pela `D-08`: *"é a **evidência** de que a divergência de quantidade
daquele código está explicada pelo aditivo. `V-REC-01` cala sobre eles…"*.

`V-REC-01` deixa de calar, mas **a função continua** — é o insumo de `V-ADT-04`, que detecta
aditivo de código ausente. O instinto ao remover o consumidor é remover a função, e apagá-la
derruba uma validação sem relação com esta espec.

**Pronto quando:** o docstring diz o que a função faz e para quem, sem referência a `D-08`, e a
suíte de `V-ADT-04` continua verde.

---

#### T-1618 — A cegueira fechou `[portão P3]`
**Tamanho:** PP · **Portão P3**

T-1605 verde: com o aditivo e a aba adulterada, `V-REC-01` acusa `14.048.00027.00`.

**É o único portão que mede o objetivo desta entrega.** Os outros medem que nada quebrou.

**Pronto quando:** verde, e o docstring da T-1605 atualizado — a reprovação deixou de ser o
comportamento esperado.

---

#### T-1619 — A contraprova continua de pé `[portão P4]`
**Tamanho:** PP · **Portão P4**

`test_t1340_o_silencio_e_fundamentado_e_nao_geral` verde **sem uma linha alterada**: sem aditivo,
os cinco avisos voltam.

Ele foi escrito na ESPEC 019 para separar *"a validação calou porque o aditivo explica"* de *"a
validação foi desligada"*, e continua fazendo exatamente esse trabalho — agora contra um
mecanismo diferente. Se precisar ser tocado, o escopo vazou para o caminho sem aditivo.

**Pronto quando:** verde, e `git diff` não mostra o arquivo nessa região.

---

#### T-1620 — O entregável, de novo `[portão P1]`
**Tamanho:** PP · **Portão P1**

T-1601 e T-1602 verdes depois do E3.

A remoção da supressão não toca o documento por nenhum caminho previsto — e é por isso que se
mede, em vez de se afirmar.

**Pronto quando:** as duas verdes.

---

#### T-1621 — Docstring de `test_t1340_v_rec_01_zera_no_pgm`
**Tamanho:** PP · **Ref:** PLANO 022 §5.2

O teste continua verde e passa a estar verde por outro mecanismo. Os três parágrafos que descrevem
o silêncio da `D-08` e o canário que o separa de *"a validação foi desligada"* mentem a partir
daqui.

As duas asserções continuam corretas, **inclusive a das derivadas** — ela continua sendo a
contraprova de que o pipeline não emudeceu, e não sai.

Um teste verde que explica errado por que está verde é pior que um teste sem docstring: ele ensina
o mecanismo errado a quem for mexer depois.

**Pronto quando:** o docstring descreve o silêncio aritmético e aponta a T-1605 como o canário
novo.

---

## 7. Épico E4 — Os textos que ficaram falsos

#### T-1622 — Mensagem da `V-ADT-02`
**Tamanho:** PP · **Ref:** `R-QTD-08`, `D-06`

Hoje: *"aditivo … não altera o conjunto de itens — traz apenas {rótulos}, que mudam quantitativo.
**O relatório sai igual ao que sairia sem ele**"*.

A segunda metade **continua verdadeira** — o `.docx` sai idêntico, porque `R-REL-04` usa a
quantidade da aba. O que ficou falso é a implicação de que o arquivo não teve efeito: ele passa a
ter, na conferência.

A frase nova tem de separar as duas coisas, sem sugerir que o documento mudou.

**Pronto quando:** a mensagem distingue efeito no documento de efeito na conferência, e o
predicado `altera_o_conjunto` não foi tocado.

---

#### T-1623 — Reancorar o teste da `V-ADT-02`
**Tamanho:** PP · **Ref:** §2.3 · **Existe, não é hipótese**

`test_t1331_v_adt_02_avisa_aditivo_sem_efeito` ([`:200`](../../backend/tests/test_consolidacao_aditivos.py))
afirma `"não altera o conjunto" in achados.avisos[0].mensagem`.

Reancorar no trecho da frase nova que **não** vai mudar de novo. Ancorar na metade que fala do
documento é mais estável que ancorar na que fala da conferência, porque a primeira é consequência
de `R-REL-04` e a segunda é redação.

**Pronto quando:** verde, e a âncora escolhida está justificada em comentário.

---

#### T-1624 — Docstring de `test_t1310_so_inclusao_e_exclusao_alteram_o_conjunto`
**Tamanho:** PP · **Ref:** PLANO 022 §5.2

[`test_blocos_de_itens.py:89`](../../backend/tests/test_blocos_de_itens.py). O teste **continua
verde e correto** — `altera_o_conjunto` não muda (`D-06`), e a asserção de que `AUMENTO` e
`REDUCAO` devolvem `False` é exatamente o que deve continuar valendo.

O docstring é que conclui *"Quantidade não entra"*, citando `R-ADT-06`. A partir daqui ela entra —
só não no conjunto de códigos, que é o que o predicado mede.

**Pronto quando:** o docstring explica que o predicado é sobre o **conjunto**, e que quantidade
passou a entrar por outro caminho.

---

#### T-1625 — Comentário do `contratada_texto`
**Tamanho:** PP · **Ref:** ESPEC 022 §7

`measurement_item.py:27-30` diz *"A quantidade contratada da planilha **não** alimenta o relatório
… Fica guardada só para a V-REC-01 confrontar as duas fontes"*.

**Já era impreciso** desde a ESPEC 018: `contratada_para` alimenta a coluna *Quantidade
Contratada* do documento. Corrigir de passagem — é uma linha, e ela induz a erro quem for ler o
domínio para entender de onde vem o número do relatório.

**Pronto quando:** o comentário descreve os dois consumidores.

---

#### T-1626 — Varredura documental
**Tamanho:** PP

Procurar menções ao mecanismo antigo em `docs/` e em `scripts/conteudo_do_manual.py` — são quatro
trechos do manual citando `V-REC-01`.

**Registrar o que for encontrado; não corrigir o manual aqui.** Ele tem defeito maior e anterior:
a ESPEC 021 `I-22` mediu que quatro validações documentadas não existem, sete em produção não
estão documentadas e duas mentem sobre o efeito. Corrigir quatro linhas dentro de um documento
sabidamente desalinhado dá a impressão de que ele está em dia.

**Pronto quando:** a lista existe, anexada ao `K-29`.

---

## 8. Épico E5 — O conjunto `[portão P5]`

#### T-1627 — Suíte de backend, com a contagem reconciliada
**Tamanho:** PP · **Portão P5**

`pytest` verde. E a contagem **conferida, não estimada**: a T-1607 transforma um teste
parametrizado em dois de origens diferentes, então o total não é `537 + novos`.

**Nenhum teste some sem substituto nomeado.** É a verificação da regra 3 do §1.1, e o modo de
falha que ela persegue é o silencioso: um `def test_` removido no meio de um diff grande não
aparece em relatório verde nenhum.

**Pronto quando:** o número final está justificado tarefa a tarefa.

---

#### T-1628 — Nenhum arquivo de `frontend/` foi alterado
**Tamanho:** PP · **Portão P5**

`git diff --name-only` sobre `frontend/` tem de sair **vazio**.

Não é verificação de comportamento novo: é verificação de que o escopo não vazou. A suíte de
navegador roda por garantia, e qualquer falha nela é anterior a esta entrega.

**Pronto quando:** o diff é vazio e a suíte não tem falha nova.

---

#### T-1629 — Estática limpa
**Tamanho:** PP · **Portão P5**

`ruff check`, `mypy src/` e `bandit -ll -r src/`.

Atenção ao `mypy` na T-1614: remover um parâmetro com padrão de uma função pública deixa
chamadores desatualizados **passando**, se forem por argumento posicional. A varredura por
`explicados` da T-1615 é o que fecha isso, e esta tarefa é a segunda rede.

**Pronto quando:** os três limpos.

---

#### T-1630 — Fechamento documental
**Tamanho:** PP

`docs/CHANGELOG.md` com a entrada da entrega; ESPEC 022 e PLANO 022 marcados como implementados;
este backlog com o status final e a seção **§11 — O que a implementação ensinou**, no formato dos
TASKS 020 e 021.

A §11 não é opcional. Os seis desvios registrados no TASKS 021 são o que fez a v1.1 do PLANO 022
existir antes da primeira linha de código.

**Pronto quando:** os três documentos refletem o que foi feito, incluindo o que saiu diferente do
planejado.

---

## 9. Insumos

| ID | Insumo | Para quê | Quando |
|---|---|---|---|
| `K-27` | **Confirmação de negócio** de que o quantitativo consolidado é mesmo proposta + deltas, e não há uma quarta peça no PGM alterando os mesmos códigos | `R-QTD-01` | antes da T-1610 |
| `K-28` | Resposta ao `I-26`: com o contratado correto, a `R-CTR-01` volta? O documento passa a usar a quantidade do contrato? | `I-26` | depois — **não bloqueia** |
| `K-29` | Decisão sobre o `I-22` — a auditoria do manual. A T-1626 alimenta a lista; a correção é trabalho próprio | `I-22` | depois |

O `K-27` é o único que vale confirmar antes de codar, e é barato: a ESPEC 019 §2.8 já mediu que os
cinco códigos de `Aumento`/`Redução` estão todos na proposta, e a `V-ADT-04` acusa se aparecer um
que não esteja. A pergunta que sobra é documental — se existe peça não submetida.

---

## 10. O que este backlog não faz

- **Não muda o `.docx` nem o `.xlsx`.** `R-QTD-05`, e as T-1601/T-1602 são as asserções que
  sustentam a frase.
- **Não reabre `R-CTR-01`.** A premissa que a revogou cai, e mesmo assim não se mexe (`D-05`,
  `K-28`). Se a discussão voltar, volta como espec própria.
- **Não mexe na apresentação da `V-REC-01`.** A tabela estruturada é o `I-25`, e depende desta
  entrega para não exibir número enganoso.
- **Não remove `codigos_ignorados()`.** `R-QTD-07`, e a T-1617 é a tarefa que a protege.
- **Não muda o predicado `altera_o_conjunto`.** `D-06` — só o texto da mensagem e o docstring.
- **Não audita o manual.** A T-1626 levanta e registra (`K-29`).
- **Não toca `frontend/`.** Nem um arquivo, e a T-1628 verifica.
- **Não acrescenta dependência**, e não lê nenhum arquivo novo. Os três blocos do aditivo já são
  extraídos hoje e descartados na aplicação.

---

## 11. O que a implementação ensinou

### 11.1 A `T-1601` virou teste diferencial, e não instantâneo

O backlog pedia *"guardar o hash de cada entrada do zip"*. Implementado assim, o teste prenderia a
suíte à saída atual do renderizador: toda mudança legítima de layout o quebraria, obrigando a
regenerar o esperado — e regenerar um instantâneo é o momento em que ninguém confere.

A propriedade que `R-QTD-05` afirma não é *"o documento é este"*, e sim **"o quantitativo do
contrato não alcança o documento"**. A implementação compara dois consolidados que diferem *só*
nas quantidades — o de produção e um *foil* com os deltas retirados — e exige artefatos idênticos.
Isso afirma exatamente a regra, e sobrevive a qualquer mudança de layout.

O custo: antes da T-1610 os dois lados são o mesmo objeto e o teste passa trivialmente. É aceitável
porque o teste não é o instrumento que mede o defeito — esse é a T-1605, e ela reprovou.

### 11.2 A T-1605 exigiu um container, não uma chamada de função

Escrita como chamada direta a `v_rec_01_...`, ela teria de passar `explicados` para reproduzir o
comportamento de hoje — e mudaria de forma na T-1614, deixando de ser o mesmo teste antes e depois.

A saída foi o padrão que o `conftest` já usa: subclasse de `DIContainer` com os dois leitores
substituídos e **nada mais**. A ordem das validações, a consolidação e o caso de uso continuam os
de produção, e o teste é indiferente à assinatura da validação.

A adulteração acontece no agregado, não na planilha: `replace(item, contratada_texto="1400")`. O
campo é `contratada_texto` e não `contratada` — esta é propriedade derivada, e `MeasurementItem` é
`frozen`.

### 11.3 A varredura da T-1626 achou defeito anterior, e maior

Quatro menções a `V-REC-01` em `scripts/conteudo_do_manual.py`. **Três afirmam o oposto do que o
sistema faz**, e desde antes desta entrega:

| Linha | O que o manual diz | Desde quando é falso |
|---|---|---|
| `810` | *"O relatório usa a do contrato"* | ESPEC 018 `R-REL-04` / `D-05` — três especs |
| `1095` | *"a fonte da verdade é o contrato"* | idem |
| `1098` | *"o relatório usa a do contrato"* | idem |
| `850` | *"O aviso `V-REC-01` merece leitura, sempre"* | continua correto |

A nota da linha `850` merece registro à parte: ela conta que a `V-REC-01` expôs no piloto *"um item
cujo aditivo elevou a quantidade de 6 para 10 e que o relatório montado à mão manteve em 6"*. É
exatamente o caso que a ESPEC 022 passa a tratar por aritmética — e o manual já o descrevia como o
valor da validação, quando o produto ainda o resolvia por supressão.

**Não corrigido aqui**, conforme a T-1626 e o `K-29`. Corrigir três linhas dentro de um documento
com o defeito medido em `I-22` — quatro validações documentadas que não existem, sete em produção
não documentadas — daria a impressão de que ele está em dia. A lista fica anexada ao `K-29`.

### 11.4 O `measurement_item.py` mentia havia três especs

O comentário do `contratada_texto` afirmava *"não alimenta o relatório — a fonte da verdade é o
contrato"*. As duas frases ficaram falsas na ESPEC 018 e sobreviveram às 019, 020 e 021.

A T-1625 as corrigiu de passagem. Vale a observação: o comentário estava no **domínio**, que é onde
alguém vai ler para entender de onde vem o número do documento — e mandava para o lugar errado.
Ele e as três linhas do manual têm a mesma origem, e nenhuma auditoria as pegou porque comentário
e prosa não quebram teste.
