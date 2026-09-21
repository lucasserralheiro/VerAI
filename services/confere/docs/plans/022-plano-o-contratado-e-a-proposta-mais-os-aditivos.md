# PLANO 022 — Implementação de "O contratado é a proposta mais os seus aditivos"

| | |
|---|---|
| **Especificação** | [ESPEC 022](../specs/022-o-contratado-e-a-proposta-mais-os-aditivos.md) v1.0 |
| **Versão** | 1.1 — 2026-08-18 — **executado**. Três desvios registrados no §11 do TASKS 022 |
| **Estado inicial** | **537 testes de backend** (coleta 3,4 s) e a suíte de navegador em 11 arquivos · o par PGM **sem** aditivo produz **5** `V-REC-01`; **com** aditivo, **0** — por supressão · **nenhum** teste afirma que o `.docx` e o `.xlsx` do par com aditivo não se movem · **dois** testes existentes afirmam comportamento que a espec revoga (§5.3) |
| **Instrumentos existentes** | `tests/leitura_relatorio.py::ler_docx` e `tests/leitura_analise.py` — leem os artefatos gerados. São a base da âncora de `R-QTD-05`, e já existem |
| **Numeração dos portões** | Este plano usa `P0`–`P5`. A ESPEC 022 §8.4 tem os seus, `P1` e `P2`: o `P1` **da espec** (entregável idêntico) é o `P1` **deste plano**; o `P2` da espec (a cegueira fecha) é o `P3` daqui. Onde o texto disser só `P3`, é o do plano |
| **Numeração das tarefas** | `T-1600` em diante. A última usada no repositório é `T-1537` |
| **Emendas** | v1.1 — §5.3 acrescentada e a `T-1607` reescrita. Ver §9 |

---

## 1. O princípio que ordena este plano

A mudança de código são seis linhas. O plano é grande porque **o sucesso desta entrega é nada
mudar em quase todo lugar**, e isso é caro de provar.

> **A invariância do entregável é capturada antes de qualquer edição.**
> A espec inteira se apoia numa promessa — *"é apenas visual, não deve interferir no relatório
> docx ou xlsx"*. Hoje nada na suíte afirma isso para o par **com aditivo**. Se a âncora for
> escrita depois da F2, ela grava o que a implementação produziu e a promessa vira tautologia. A
> `T-1601` captura os dois artefatos **contra o código intocado**, e é a primeira tarefa do plano
> por esse motivo, não por conveniência.

> **Os cinco números vêm do PDF, não da saída do código.**
> `554,01`, `-80,00`, `2.900,89`, `5,00`, `1.100,00` (ESPEC §2.1) e as cinco somas de §2.2 são a
> única verdade externa deste plano. Transcrever da execução seria escrever um teste que afirma
> *"o código faz o que o código faz"* — e o sinal negativo do `12.030.00001.00` é o valor mais
> fácil de estragar sem querer, porque parece defeito de extração. É a mesma exigência da
> `T-1500` do PLANO 021.

> **A soma existe antes de a supressão sair. Nunca há um commit em que nenhum dos dois mecanismos
> proteja.**
> `R-QTD-06` manda o `explicados` embora. A ordem inversa — tirar a supressão e depois somar —
> abre uma janela em que o par com aditivo volta a exibir cinco avisos falsos. Por isso a **F2
> soma e não remove nada**: nela os dois mecanismos coexistem e concordam, e o produto continua
> publicável. A F3 só remove depois de a soma estar medida.

> **Um teste que afirma o comportamento revogado é partido, não apagado.**
> Os dois testes de §5.3 vão para o vermelho por mérito. A saída barata é deletá-los; e num
> deles — o `test_t1320_aumento_e_reducao_nao_mudam_nada` — metade das asserções **continua
> valendo**, e é justamente a que protege o documento. Apagar o teste inteiro removeria a única
> cobertura existente da guarda de `R-QTD-03` no mesmo commit em que a guarda passa a importar.

> **Só um teste deste plano mede o defeito, e ele tem de reprovar hoje.**
> É a `T-1605`, a da aba adulterada. Contra o código intocado ela reprova acusando **zero**
> avisos onde deveria haver um. Todo o resto é TDD comum — vermelho por comportamento
> inexistente — e este plano diz isso, em vez de vestir de portão o que é apenas ordem de
> escrita.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — O oráculo existe e casa** | Fim da F0 | Os cinco deltas transcritos do `aditivo_pgm.pdf` são iguais ao que o extrator lê hoje, **sinal incluído**. E a âncora dos dois artefatos do par com aditivo está capturada e verde | Não começar a F1. Ou a transcrição está errada, ou o extrator está — e a diferença entre as duas hipóteses muda a espec |
| **P1 — O entregável não se mexeu** | Fim da F2 e de novo no fim da F3 | `.docx` idêntico parte a parte; `.xlsx` idêntico exceto `docProps/core.xml`; objeto `Report` idêntico. **Nos dois momentos** | Reverter a fase. É o portão que a espec chama de `P1` e sem o qual ela não pode ser aceita |
| **P2 — A soma bate** | Fim da F2 | Os cinco valores de ESPEC §2.2, um a um, contra o oráculo da `T-1600`. E `V-REC-01` continua em **0** no par com aditivo — agora com os dois mecanismos concordando | Não seguir para a F3. Se a soma não bate, remover a supressão reintroduz avisos falsos |
| **P3 — A cegueira fecha** | Fim da F3 | `T-1605` fica **verde**: com o aditivo e a aba adulterada, `V-REC-01` acusa `14.048.00027.00`. É o `P2` da espec, e o único portão que mede o objetivo | Reverter a F3. A F2 é publicável sozinha e o produto fica correto sem ela |
| **P4 — A contraprova continua de pé** | Fim da F3 | `test_t1340_o_silencio_e_fundamentado_e_nao_geral` verde **sem uma linha alterada**: sem aditivo, os cinco avisos voltam | O escopo vazou. Esta tarefa não deve tocar o caminho sem aditivo |
| **P5 — O conjunto** | Fim da F5 | Suíte de backend **verde**; suíte de navegador **sem falha nova**; `ruff`, `mypy` limpos. Nenhum arquivo de `frontend/` alterado | Não entregar |

**O portão mais fácil de pular é o P1**, porque ele passa sozinho — a tentação é confiar na
leitura da cadeia de chamadas em vez de comparar os bytes. A ESPEC §2.3 já fez essa comparação
uma vez, à mão; o plano existe para transformá-la em regressão permanente.

---

## 3. Fases

### F0 — O oráculo e a âncora do entregável `[portão]`

**Objetivo:** ter as duas verdades externas contra as quais medir. **Nenhum arquivo de `src/` é
tocado.**

| # | Tarefa | Ref. |
|---|---|---|
| T-1600 | Transcrever os cinco deltas da ESPEC §2.1 e as cinco somas de §2.2 para constantes de teste, lidas **abrindo o PDF do aditivo**, não rodando o extrator. O `-80,00` do `12.030.00001.00` entra com o sinal que o documento traz | ESPEC §2.1, §2.2 |
| T-1601 | **[portão]** Âncora de invariância dos artefatos: gerar `.docx` e `.xlsx` do par **PGM + aditivo** e guardar o hash de cada entrada do zip, **exceto** `docProps/core.xml`. Passa desde já | **P1**, `R-QTD-05` |
| T-1602 | Âncora do objeto `Report` do mesmo par: linhas, `demais_itens`, `total_divergencias`, derivadas. Falha antes e mais alto que a `T-1601`, e diz **onde** | **P1**, `R-QTD-05` |
| T-1603 | **[portão]** Provar que a transcrição da `T-1600` casa o que o extrator lê hoje. Só o extrator: sem consolidação, sem relatório | **P0** |

**Verificação:** P0.

> **A `T-1601` exclui `docProps/core.xml` por medição, não por precaução.** A ESPEC §2.3 abriu a
> parte e mostrou que a única diferença é `dcterms:modified` — o carimbo de hora, que muda entre
> duas execuções quaisquer. Excluir a parte inteira é aceitável **porque foi olhada**; excluí-la
> sem olhar teria escondido qualquer alteração de metadado real.

> **A `T-1602` parece redundante com a `T-1601` e não é.** O hash do zip responde *sim ou não*.
> Quando a resposta for *não* — e em algum momento será, num refactor futuro — a `T-1601` sozinha
> não diz se mudou uma quantidade, uma descrição ou a ordem. A `T-1602` diz, e custa vinte linhas.

**Tamanho:** P — duas horas. **Encerra:** P0.

---

### F1 — Os instrumentos, e o da cegueira reprova `[portão]`

**Objetivo:** poder afirmar, ao final, o que mudou e o que não mudou. **Nenhum arquivo de `src/`
é tocado.** Os testes existentes de §5.3 são reescritos aqui, e não na F2: quando a soma entrar,
a suíte já tem de estar dizendo a verdade nova.

| # | Tarefa | Ref. |
|---|---|---|
| T-1604 | `tests/test_quantitativo_consolidado.py`: os cinco valores somados, contra o oráculo da `T-1600`. Vermelhos por comportamento inexistente — **TDD comum, não portão** | `R-QTD-01` |
| T-1605 | **[portão]** O teste da cegueira: par com aditivo, aba adulterada de `1.300` para `1.400` no `14.048.00027.00`, e `V-REC-01` tem de acusar **aquele** código. Rodar contra o código intocado e **exigir que reprove**, com o zero acusado no relatório de falha | **P3**, ESPEC §2.4 |
| T-1606 | Asserção do sinal: `12.030.00001.00` sai `70,00`. É a que falha se alguém aplicar `abs()` ou negar por rótulo | `R-QTD-02`, `D-02` |
| T-1607 | **Partir `test_t1320_aumento_e_reducao_nao_mudam_nada`** ([`test_consolidacao_aditivos.py:112`](../../backend/tests/test_consolidacao_aditivos.py)) em dois. **A metade da guarda fica onde está**, renomeada, afirmando só que o código ausente (`99.999.00001.00`) continua fora do consolidado — verde hoje e depois. **A metade da soma sai** e vira asserção nova em `test_quantitativo_consolidado.py`: o item do delta entra na lista. Docstring reescrito: ele hoje se anuncia como *"`R-ADT-06` — o coração da espec"* | `R-QTD-01`, `R-QTD-03`, §5.3 |
| T-1608 | Reforçar `test_t1333_v_adt_04_avisa_aumento_de_codigo_ausente` ([`:260`](../../backend/tests/test_consolidacao_aditivos.py)) com a asserção que falta: além de `V-ADT-04` disparar, a **quantidade do consolidado não muda**. Verde hoje; passa a ser a rede da guarda | `R-QTD-03`, `D-03` |
| T-1609 | Fixture sintética de duas peças: a primeira aumenta um código, a segunda o exclui. Asserção: o código sai, e o delta não o ressuscita | `R-QTD-04` |

**Verificação:** P1 do plano continua verde (nada de `src/` foi tocado). `T-1605` reprova;
`T-1604`, `T-1606` e a metade da soma da `T-1607` ficam vermelhas até a F2; `T-1608` e a metade
da guarda da `T-1607` ficam verdes desde já.

> **A `T-1605` é o único instrumento deste plano que mede o defeito.** Escrita contra o código de
> hoje, ela reprova porque o sistema atual não percebe a adulteração — que é exatamente a
> afirmação da ESPEC §2.4. Uma versão dela escrita depois da F3 estaria verde no primeiro dia e
> não provaria nada.

> **A `T-1607` é a tarefa mais fácil de fazer errado do plano inteiro.** O teste vai para o
> vermelho na F2 por mérito, e a saída barata é deletá-lo. Metade das suas asserções continua
> verdadeira — `"99.999.00001.00" not in consolidado.codigos` —, e ela é a **única cobertura
> existente** do comportamento que a guarda de `R-QTD-03` preserva. Apagar o teste inteiro
> removeria essa cobertura no exato commit em que ela passa a importar.

> **A `T-1608` corrige uma lacuna que já existe hoje.** O teste da `V-ADT-04` afirma que o aviso
> sai, e não afirma que o consolidado ficou intacto — porque antes desta espec era impossível ele
> não ficar. Depois dela, passa a ser possível, e a asserção que faltava vira a rede.

**Tamanho:** P — três horas. **Encerra:** P1 (revalidado).

---

### F2 — A soma existe, e a supressão continua `[publicável sozinha]`

**Objetivo:** o consolidado passa a conhecer os deltas. **Nada é removido.**

| # | Tarefa | Ref. |
|---|---|---|
| T-1610 | O ramo `AUMENTO`/`REDUCAO` em `Contract.aplicar`, com a guarda de código presente | `R-QTD-01`, `R-QTD-03` |
| T-1611 | Docstring de `aplicar` reescrito. Hoje afirma *"só `Inclusão` e `Exclusão` são aplicadas"*; a medição das 58 linhas que ele cita continua verdadeira e ganha a companhia de ESPEC §2.3 | `R-QTD-01` |
| T-1612 | **[portão]** `T-1601` e `T-1602` verdes: o `.docx`, o `.xlsx` e o `Report` não se moveram | **P1** |
| T-1613 | **[portão]** `T-1604`, `T-1606` a `T-1609` verdes. E `V-REC-01` continua em 0 no par com aditivo — os dois mecanismos concordando | **P2** |

**Verificação:** P1 e P2.

> **Esta fase é publicável sozinha e não muda nada de observável.** Com a supressão ainda no
> lugar, a tela é idêntica, o documento é idêntico e o comportamento é idêntico. É o commit mais
> chato do plano e o mais seguro: se algo quebrar aqui, quebrou na consolidação, e não há segunda
> hipótese a investigar.

> **A `T-1613` é o que autoriza a F3.** Enquanto a soma não estiver medida contra o oráculo,
> remover a supressão é trocar um mecanismo conhecido por um não verificado.

**Tamanho:** PP — uma hora. **Encerra:** P1, P2.

---

### F3 — A supressão sai `[portão]`

**Objetivo:** o silêncio passa a ser aritmético.

| # | Tarefa | Ref. |
|---|---|---|
| T-1614 | O parâmetro `explicados` e a variável `silenciados` saem de `v_rec_01_divergencia_de_quantidade_contratada` | `R-QTD-06` |
| T-1615 | O `explicados=` sai da chamada em `infrastructure/di/container.py` | `R-QTD-06` |
| T-1616 | Docstring da `V-REC-01` reescrito: saem os três parágrafos sobre o silêncio fundamentado, entra a razão nova | `R-QTD-06` |
| T-1617 | Docstring de `codigos_ignorados()` reescrito. A função **fica** — `V-ADT-04` depende dela —, sem a referência a `D-08` | `R-QTD-07` |
| T-1618 | **[portão]** `T-1605` verde: a cegueira fechou | **P3** |
| T-1619 | **[portão]** `test_t1340_o_silencio_e_fundamentado_e_nao_geral` verde **sem alteração** | **P4** |
| T-1620 | **[portão]** `T-1601` e `T-1602` verdes de novo. A F3 não toca o documento, e é preciso provar | **P1** |
| T-1621 | Reescrever o docstring de `test_t1340_v_rec_01_zera_no_pgm`. Ele continua verde e passa a estar verde por outro mecanismo; os três parágrafos que descrevem o silêncio da `D-08` mentem a partir daqui | §5.2 |

**Verificação:** P1, P3, P4.

> **A `T-1617` é a que se perde num plano descuidado.** `codigos_ignorados()` parece existir só
> para alimentar o `explicados`, e o instinto ao remover o consumidor é remover a função. Ela
> continua sendo o insumo de `V-ADT-04`, que detecta aditivo de código ausente — e apagá-la
> derruba uma validação sem relação com esta espec.

> **A `T-1621` não é cosmética.** Aquele docstring é a documentação do mecanismo, e ele descreve
> um mecanismo que deixou de existir. Um teste verde que explica errado por que está verde é pior
> que um teste sem docstring: ele ensina o mecanismo errado a quem for mexer depois.

**Tamanho:** PP — uma hora. **Encerra:** P1, P3, P4.

---

### F4 — Os textos que ficaram falsos

**Objetivo:** nenhuma mensagem do produto, e nenhum docstring, afirma o que deixou de valer.

| # | Tarefa | Ref. |
|---|---|---|
| T-1622 | Mensagem da `V-ADT-02`. Hoje diz *"não altera o conjunto de itens — traz apenas … que mudam quantitativo. O relatório sai igual ao que sairia sem ele"*. A segunda metade continua verdadeira; a frase tem de separar **efeito no documento** de **efeito na conferência** | `R-QTD-08`, `D-06` |
| T-1623 | Reancorar `test_t1331_v_adt_02_avisa_aditivo_sem_efeito` ([`:200`](../../backend/tests/test_consolidacao_aditivos.py)), que afirma `"não altera o conjunto" in mensagem`. **Existe, e é o segundo caso de §5.3** — não é hipótese. O predicado `altera_o_conjunto` **não muda** | `D-06`, §5.3 |
| T-1624 | Docstring de `test_t1310_so_inclusao_e_exclusao_alteram_o_conjunto` ([`test_blocos_de_itens.py:89`](../../backend/tests/test_blocos_de_itens.py)). O teste **continua verde** e correto; o docstring diz *"Quantidade não entra"*, o que deixa de ser verdade fora daquele predicado | §5.2 |
| T-1625 | Comentário do `contratada_texto` em `measurement_item.py`: diz *"fica guardada só para a V-REC-01"*, o que **já era impreciso** desde a ESPEC 018 — `contratada_para` alimenta o relatório. Corrigir de passagem | ESPEC §7 |
| T-1626 | Varredura por menções ao mecanismo antigo em `docs/` e `scripts/conteudo_do_manual.py`. **Registrar o que for encontrado; não corrigir o manual aqui** — ele tem defeito maior e anterior (`I-22` da ESPEC 021) | — |

**Verificação:** nenhum portão próprio. Entra no P5.

> **A `T-1626` levanta e não conserta, de propósito.** O manual descreve `V-REC-01` em quatro
> trechos, e a ESPEC 021 já registrou que ele documenta validações que não existem e omite sete
> que existem. Corrigir quatro linhas dentro de um documento sabidamente desalinhado dá a
> impressão de que ele está em dia. O escopo certo é a auditoria completa, que é outra tarefa.

**Tamanho:** PP — meia hora.

---

### F5 — O conjunto `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-1627 | Suíte de backend completa. Contagem reconciliada: **537** menos os que a `T-1607` funde, mais os novos. **Nenhum teste some sem substituto nomeado** | **P5** |
| T-1628 | Suíte de navegador. **Nenhum arquivo de `frontend/` foi alterado** — é uma verificação de que o escopo não vazou, não de comportamento novo | **P5** |
| T-1629 | `ruff` e `mypy` limpos | **P5** |
| T-1630 | Atualizar `docs/CHANGELOG.md` e marcar a ESPEC 022 como implementada | — |

**Verificação:** P5.

> **A `T-1627` conta, e não estima.** A `T-1607` transforma um teste parametrizado em dois — a
> contagem final não é `537 + novos`, e uma reconciliação que ignore isso esconderia um teste
> perdido no meio do saldo.

**Tamanho:** PP — meia hora.

---

## 4. Sequência

```
F0  oráculo + âncora dos artefatos      [P0]     ── nenhum src/ tocado
     │
F1  instrumentos; o da cegueira reprova [P1]     ── nenhum src/ tocado
     │                                              testes de §5.3 reescritos aqui
F2  soma aplicada, supressão intacta    [P1,P2]  ── publicável sozinha, nada observável muda
     │
F3  supressão removida                  [P1,P3,P4]
     │
F4  textos falsos corrigidos
     │
F5  conjunto                            [P5]
```

O ponto de reversão é o fim da F2: dali o produto está correto e nada mudou para quem usa. A F3 é
a que entrega o valor e é a única que pode ser revertida isoladamente sem deixar o sistema pior
do que estava.

---

## 5. A regressão que já está escrita

Levantamento feito sobre a suíte, não sobre memória: todos os testes que mencionam `AUMENTO` ou
`REDUCAO` foram lidos, mais os que exercitam `V-REC-01` e `Contract.aplicar`.

### 5.1 O que **não** é afetado, e por quê

| Teste | Por que sobrevive |
|---|---|
| `test_anchor_por_codigo.py:233` — os cinco `V-REC-01` do PGM | A fixture `pgm` (`:102`) recebe **contrato + levantamento**, sem aditivo. Sem aditivo não há delta a aplicar, e os cinco avisos continuam saindo. **Verificado no código, não suposto** |
| `test_api_e2e.py:270` — `{"V-REC-01"}` | Idem: é o `test_t1350_o_campo_de_aditivos_e_opcional`, que existe justamente para provar que o caminho sem aditivo é o de antes |
| `test_consolidacao_aditivos.py:392` — o silêncio não é geral | Roda sem aditivo. É o `P4` deste plano e não pode ser tocado |
| `test_reconciliation.py:292` | Chama `v_rec_01` diretamente, **sem** `explicados`. A remoção do parâmetro não o afeta |
| `test_t1320_os_aditivos_sao_aplicados_em_sequencia:143` | Só `Inclusão` e `Exclusão`. Intacto |
| `test_t1333_v_adt_04_nao_avisa_quando_o_codigo_existe:285` | `Aumento` de código presente, sem aviso — continua sem aviso |
| `test_extractor_aditivo.py` | Afirma a **extração**, que não muda. É de onde o oráculo da `T-1600` sai |
| `test_docx_estrutura.py`, `test_docx_formatacao.py` | Cobertos por `T-1601`/`T-1602` por cima, e não mudam |

### 5.2 O que muda de razão, não de valor

Dois testes continuam verdes e passam a estar verdes por outro motivo. Nos dois, o docstring é
que fica falso:

| Teste | O que passa a mentir |
|---|---|
| `test_t1340_v_rec_01_zera_no_pgm:370` | Descreve, em três parágrafos, o silêncio da `D-08` e o canário que o separa de *"a validação foi desligada"*. As duas asserções continuam corretas — inclusive a das derivadas, que continua sendo a contraprova. `T-1621` reescreve |
| `test_t1310_so_inclusao_e_exclusao_alteram_o_conjunto:89` | O predicado `altera_o_conjunto` **não muda** (`D-06`) e o teste está certo. O docstring conclui *"Quantidade não entra"*, e a partir daqui ela entra — só não no conjunto de códigos. `T-1624` reescreve |

### 5.3 O que muda de **valor** — e são exatamente dois

Esta seção faltava na v1.0 deste plano. Os dois testes abaixo afirmam, hoje, comportamento que a
ESPEC 022 revoga, e vão ao vermelho **por mérito**:

| Teste | Asserção que cai | Asserção que sobrevive | Tarefa |
|---|---|---|---|
| `test_t1320_aumento_e_reducao_nao_mudam_nada:112` | `[i.codigo.valor for i in consolidado.itens] == ["10.050.00001.00"]` — o item do delta passa a entrar | `"99.999.00001.00" not in consolidado.codigos` — **continua verdadeira, pela guarda de `R-QTD-03`** | `T-1607` |
| `test_t1331_v_adt_02_avisa_aditivo_sem_efeito:200` | `"não altera o conjunto" in mensagem` — a frase muda por `R-QTD-08` | O disparo em si: `V-ADT-02` continua saindo para aditivo só de quantitativo | `T-1623` |

O primeiro é o mais perigoso do plano, e o §1 diz por quê: **é um teste que se parte, não que se
apaga.** O seu docstring se anuncia como *"`R-ADT-06` — o coração da espec, no seu teste mais
direto"*, o que o marca como candidato óbvio à deleção — e levaria junto a única cobertura da
guarda.

### 5.4 O que não pode se mexer

- Uma linha do `.docx` ou uma célula do `.xlsx` do par com aditivo (`T-1601`);
- Uma linha de `frontend/` (`T-1628`);
- O predicado `altera_o_conjunto` (`D-06`) — só o seu docstring;
- A assinatura de `V-ADT-04` ou o seu comportamento (`T-1608`);
- A função `codigos_ignorados()` (`T-1617`).

---

## 6. O que pode dar errado, e o que pega

| Falha | O que pega | Fase |
|---|---|---|
| Alguém aplicar `abs()` no delta da `Redução`, achando que o negativo é defeito de extração | `T-1606` — asserção do `70,00` | F1 |
| **O `test_t1320` ser apagado em vez de partido**, levando junto a cobertura da guarda | `T-1607` como tarefa nomeada, e a `T-1627`, que exige substituto nomeado para todo teste que some | F1/F5 |
| A guarda de código presente ser esquecida, e um `Aumento` órfão mudar a estrutura do documento | `T-1608` e, por cima, `T-1601` | F1/F0 |
| `codigos_ignorados()` ser removida junto com o `explicados` | `T-1617` como tarefa explícita, e a suíte de `V-ADT-04` | F3 |
| A soma alterar a ordem do documento por algum caminho não previsto | `T-1602` — o `Report` diz **onde** mudou | F0 |
| O `explicados` voltar como parâmetro opcional com padrão `None`, silenciosamente | Asserção de assinatura na `T-1604`, conforme ESPEC §8.1 | F1 |
| A entrega parecer inútil, porque no caso feliz nada muda | `T-1605` é o que mostra o que mudou. É o portão do objetivo, e o único | F1/F3 |

---

## 7. Insumos

| Insumo | Onde |
|---|---|
| Os cinco deltas, com sinal | `backend/tests/fixtures/aditivo_pgm.pdf`, blocos `Aumento` e `Redução` — ESPEC §2.1 |
| As cinco somas esperadas | ESPEC §2.2 |
| A aba com os valores contratados | `backend/tests/fixtures/levantamento_pgm.xlsx` |
| O par completo já montado | `resultado_do_pgm` em `test_consolidacao_aditivos.py:330` — contrato + aditivo + levantamento |
| Leitores dos artefatos | `tests/leitura_relatorio.py`, `tests/leitura_analise.py` — já existem |
| Fixtures sintéticas | `_peca`, `_bloco` e `_item` em `test_consolidacao_aditivos.py:48-66` — o padrão já existe |

**Nenhuma fixture nova de PDF é necessária**, e nenhuma fixture sintética nova de `Aumento` de
código ausente: ela já existe em `test_t1333_v_adt_04_avisa_aumento_de_codigo_ausente`. A v1.0
deste plano pedia uma, por não ter olhado.

---

## 8. O que este plano não faz

- **Não muda de onde o documento tira número.** `R-CTR-01` continua revogada (`D-05` da espec,
  `I-26`). Se a discussão voltar, volta como espec própria;
- **Não mexe na apresentação da `V-REC-01`.** A tabela estruturada é `I-25`, e depende desta
  entrega para não exibir número enganoso;
- **Não corrige o manual.** A `T-1626` levanta e registra; a auditoria é `I-22` da ESPEC 021;
- **Não toca `frontend/`.** Nem um arquivo. A `T-1628` verifica isso.

---

## 9. Emendas

### v1.1 — 2026-08-18, antes da execução

Levantamento dos testes que tocam `AUMENTO`/`REDUCAO`, feito ao iniciar a F0 e interrompido antes
de qualquer edição de código. Três correções:

| # | O que a v1.0 dizia | O que é |
|---|---|---|
| 1 | §5 tinha duas categorias — *não afetado* e *muda de razão* | Falta a terceira, e ela tem dois casos. §5.3 acrescentada; a antiga §5.3 virou §5.4 |
| 2 | `T-1607` pedia *"fixture sintética de `Aumento` de código ausente"* | A fixture já existe (`test_t1333_v_adt_04_avisa_aumento_de_codigo_ausente`). A tarefa virou a partição do `test_t1320`, e o reforço do teste existente virou `T-1608` |
| 3 | `T-1622` da v1.0 dizia *"**se** houver teste afirmando o texto da `V-ADT-02`"* | Há, em `:200`. Deixou de ser condicional |

O deslocamento de numeração a partir da antiga `T-1609` é consequência das duas primeiras. As
fases, os portões e o princípio ordenador não mudaram — a v1.0 já mandava partir em vez de
apagar, mas não sabia que havia o que partir.
