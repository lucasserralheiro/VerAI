# PLANO 021 — Implementação de "A célula que virou 1/1"

| | |
|---|---|
| **Especificação** | [ESPEC 021](../specs/021-a-celula-que-virou-1-1.md) v1.0 |
| **Versão** | 1.1 — 2026-08-18 — **executado**, salvo o `P5`. Emenda do `P6` em §10; desvios no TASKS 021 §11 |
| **Estado inicial** | **522 testes de backend** (coleta 4,5 s) e **84 de navegador** em 10 arquivos · o par piloto exibe hoje **4 frases amarelas e mais nada**; o do PGM, **10** · **nenhum** teste afirma o conteúdo bruto das células derivadas |
| **Instrumento existente** | `tests/leitura_relatorio.py::ler_docx` — devolve as linhas do documento gerado. É a âncora de invariância de `R-PER-11`, e já existe |
| **Numeração dos portões** | Este plano usa `P0`–`P6`. A ESPEC 021 §8.5 tem os seus, `P1` e `P2`: o `P1` **da espec** é o `P5` **deste plano**, e o `P2` da espec é o `P2` daqui. Onde o texto disser só `P2`, é o do plano |

---

## 1. O princípio que ordena este plano

Esta é uma entrega barata com dois modos de falha caros, e nenhum dos dois é técnico.

> **Os nove valores vêm da planilha, não da saída do código.**
> As 4 linhas do piloto e as 5 do PGM (ESPEC §2.2) são a única verdade externa que este plano
> tem. Se as asserções forem escritas a partir do que a implementação produzir, elas passam a
> afirmar *"o código faz o que o código faz"* — e o `-` do `14.046.00003.00`, que é o valor mais
> fácil de estragar sem querer, ficaria protegido por um teste que copia o estrago. É a mesma
> exigência da `T-1407` do PLANO 020: os valores são **transcritos da fonte**, nunca da saída.

> **O substituto vem antes da remoção. Nunca há um commit em que a informação não esteja em
> lugar nenhum.**
> `D-02` da espec manda `V-REC-02` sair. A ordem inversa — remover o achado e depois construir a
> tabela — abre uma janela em que uma linha sai `1 / 1` sem que nada, em parte alguma, diga isso.
> É exatamente o silêncio que a ESPEC 018 §14.6 escreveu a validação para impedir. Por isso a
> **F2 e a F3 não removem nada**, e a F4 só remove depois de a tabela existir e ter sido vista.

> **Um instrumento mede o defeito; os outros medem a correção. O plano não confunde os dois.**
> Só uma asserção deste plano falha hoje **pelo motivo certo** contra o código intocado: a de que
> a cadeia `V-REC-02` não aparece na tela (`T-1506`). Ela reprova com 4 ocorrências no piloto.
> Todo o resto é TDD comum — vermelho por campo inexistente —, e este plano diz isso em vez de
> vestir de portão o que é apenas ordem de escrita.

> **O documento não pode se mexer.**
> A fase F2 abre `generate_measurement_report.py`, que é onde o `.docx` é montado — o único
> artefato que sai da aplicação e vai ao órgão. `R-PER-11` diz que ele não muda; `T-1507` é o que
> transforma essa frase em asserção, capturada **antes** de qualquer edição.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — O oráculo existe e casa** | Fim da F0 | As nove linhas transcritas à mão das duas planilhas são **iguais** ao que o `LevantamentoReader` lê hoje: número da linha, código, descrição, contratada e medida | Não começar a F1. Ou a transcrição está errada, ou o leitor está — e a diferença entre as duas hipóteses é o plano inteiro |
| **P1 — Os instrumentos existem, e o que tem de reprovar reprova** | Fim da F1 | `T-1506` reprova contra o código intocado, acusando **4** ocorrências de `V-REC-02` na tela do piloto. `T-1507` (invariância do documento) passa desde já, nos dois pares | O instrumento está errado. Um teste de tela que já esteja verde hoje não está procurando o que se pensa |
| **P2 — A tabela diz tudo o que as frases diziam, e mais** | Fim da F3 | Com o bloco amarelo **ainda na tela**, a tabela e as frases são comparadas lado a lado nos dois pares: nenhuma linha só nas frases. E o `14.048.00008.00` do piloto mostra `D` e `C` (espec `P2`) | Não remover nada na F4. Enquanto a tabela não contiver tudo, a frase é a única fonte |
| **P3 — A frase some, e nada se perde** | Fim da F4 | `V-REC-02` não sai mais em `avisos`; `T-1506` fica verde; as **quatro** asserções de §5.1 estão reancoradas, não apagadas | Reverter a F4. A F3 é publicável sozinha e o produto fica utilizável sem ela |
| **P4 — O documento não se mexeu** | Fim da F4 | `ler_docx` devolve, nos dois pares, exatamente as linhas capturadas na F1. `test_docx_estrutura.py` e `test_docx_formatacao.py` verdes **sem uma linha alterada** | O escopo vazou para o documento, que a espec põe fora (`R-PER-11`) |
| **P5 — Alguém do faturamento acha a célula** | Fim da F5 | Uma pessoa que nunca ouviu falar de `V-REC-02` recebe a tela, abre a planilha e chega às células sem explicação prévia (espec `P1`) | Não é falha de código: é falha de redação da frase de `R-PER-07` ou de colunas. Corrigir e repetir — nenhum teste substitui isto |
| **P6 — O conjunto** | Fim da F5 | Suíte de backend **verde**; suíte de navegador **sem falha nova contra a linha de base de 74/84** (ver §10); contagem reconciliada; `ruff`, `mypy`, `tsc --noEmit`, `next lint` e `next build` limpos | Não entregar |

**O portão mais fácil de pular é o P2**, porque exige conviver com uma tela feia — tabela e frases
juntas — por uma fase inteira. É também o único momento do plano em que a informação nova e a
antiga estão visíveis ao mesmo tempo e podem ser confrontadas. Depois da F4 essa comparação deixa
de ser possível.

---

## 3. Fases

### F0 — O oráculo, escrito à mão `[portão]`

**Objetivo:** ter uma verdade externa contra a qual medir. **Nenhum arquivo de `src/` é tocado.**

| # | Tarefa | Ref. |
|---|---|---|
| T-1500 | Transcrever as **nove** linhas da ESPEC §2.2 para uma constante de teste — linha, código, descrição, contratada, medida —, lidas **abrindo as duas planilhas**, não rodando o leitor | ESPEC §2.2 |
| T-1501 | **[portão]** Provar que a transcrição casa o que o `LevantamentoReader` lê hoje. Só o leitor: sem relatório, sem API, sem código novo | **P0** |
| T-1502 | Registrar o achado do `_texto()` (§6) e emendar `R-PER-02`: o texto é o **da leitura**, não o do arquivo | §6 |

**Verificação:** P0.

> **A T-1500 é três linhas de constante e é a única coisa neste plano que não pode ser derivada.**
> Todo o resto — o campo na API, a tabela, o componente — pode ser reconstruído a partir do
> código. Os nove pares de células, não: eles vivem em dois arquivos `.xlsx` e é deles que a
> entrega inteira depende. Transcrevê-los depois de a implementação existir é copiar a resposta.

> **A T-1501 pode reprovar por um motivo bom.** Se a transcrição divergir, há duas hipóteses e
> elas têm consequências opostas: dedo errado ao transcrever (barato) ou o leitor entregando
> outra coisa (caro, e muda a espec). Descobrir na F0 custa dez minutos; descobrir na F3 custa
> refazer as asserções todas com a saída do código como referência — que é precisamente o
> defeito que a T-1500 existe para impedir.

**Tamanho:** PP — uma hora. **Encerra:** P0.

---

### F1 — Os instrumentos, e o da tela reprova `[portão]`

**Objetivo:** poder afirmar, ao final, o que mudou e o que não mudou. **Nenhum arquivo de `src/`
nem de `frontend/src/` é tocado.**

| # | Tarefa | Ref. |
|---|---|---|
| T-1503 | `tests/test_linhas_derivadas.py`: as asserções de conteúdo da ESPEC §8.1, contra o oráculo da T-1500. Vermelhas por campo inexistente — **TDD comum, não portão** | `R-PER-01` a `06` |
| T-1504 | Asserção do `-`: `14.046.00003.00` chega com `contratada_texto == "-"`. **Não** `""`, **não** `"0"` | `R-PER-02`, `D-03` |
| T-1505 | **Invariante de acoplamento**: o número de linhas derivadas é igual ao de `perfil_ou_pacote` do relatório, nos dois pares. É o que impede tabela e documento divergirem | `R-PER-01` |
| T-1506 | **[portão]** `e2e/derivadas.spec.ts`: a cadeia `V-REC-02` não ocorre na tela. Rodar contra o código intocado e **exigir que reprove**, com as 4 ocorrências do piloto nomeadas no relatório de falha | **P1**, `R-PER-08` |
| T-1507 | **Âncora de invariância do documento**: capturar hoje, com `leitura_relatorio.ler_docx`, as linhas do `.docx` dos **dois** pares. Passa desde já e tem de continuar passando | **P4**, `R-PER-11` |

**Verificação:** P1. T-1506 reprova; T-1507 passa; T-1503 a T-1505 ficam vermelhas até a F2.

> **A T-1506 é o único instrumento deste plano que mede o defeito.** Ela é escrita contra a tela
> de hoje, onde as quatro frases existem, e reprova. Uma versão dela escrita depois da F4 estaria
> verde no primeiro dia e não provaria nada — e é o erro que a ESPEC 017 estabeleceu como conduta
> a evitar e que o PLANO 020 repetiu na `T-1404`.

> **A T-1507 custa cinco linhas porque o leitor já existe.** Nada na suíte afirma hoje que a
> tabela de comprovação não se moveu; os 522 testes a cobrem indiretamente, por estrutura e
> formatação. A F2 abre exatamente o arquivo que a monta. Capturar as linhas **antes** é a
> diferença entre saber que o documento não mudou e supor.

> **A T-1505 parece redundante e não é.** As duas coleções nascem no mesmo `if`, e por isso
> parece impossível divergirem. Elas divergem no dia em que alguém acrescentar um segundo caminho
> de derivação — um `N/A` tratado à parte, uma família excluída — e esquecer de acumular. O
> sintoma seria uma linha `1 / 1` no documento sem entrada na tabela: exatamente o silêncio que a
> espec inteira existe para acabar.

**Tamanho:** P — duas horas. **Encerra:** P1.

---

### F2 — `linhas_derivadas` existe, e `V-REC-02` continua `[publicável sozinha]`

**Objetivo:** o dado bruto chega à resposta da API. **Nada é removido.**

| # | Tarefa | Ref. |
|---|---|---|
| T-1508 | `LinhaDerivada` em `domain/entities/report.py` (frozen): `linha_na_aba`, `codigo`, `descricao`, `contratada_texto`, `medida_texto`, `emitida: ReportLine` | ESPEC §7 |
| T-1509 | Acumulação em `_montar_linha`, no mesmo padrão de acumulador que `achados` já usa. A ordem sai da aba de graça: o laço de `executar` percorre `medicao.codigos_em_ordem` | `R-PER-05`, `D-04` |
| T-1510 | `ReportResult.derivadas: tuple[LinhaDerivada, ...] = ()` — **com padrão**, porque o caminho bloqueado devolve antes do laço | ESPEC §7 |
| T-1511 | `LinhaDerivada` no `api/schemas.py` e `linhas_derivadas` em `RespostaRelatorio`. `RespostaBloqueada` **não muda** | ESPEC §7 |
| T-1512 | Conversão no router, ao lado de `_linha`, com as quantidades emitidas formatadas pelo backend | `D-06` |
| T-1513 | **`_avisar_perfil` fica.** Estado intermediário deliberado: o mesmo fato viaja nas duas formas | §1, `P2` |
| T-1514 | **[risco]** Teste: as quatro asserções de §5.1 continuam verdes **sem alteração**. É a prova de que a F2 não removeu nada | **P3** invertido |

**Verificação:** T-1503 a T-1505 ficam verdes. T-1506 continua reprovando — e deve.

> **A T-1513 é o que torna esta fase publicável.** Ao fim dela, quem consome a API tem o dado
> estruturado e a tela está **idêntica**. Se o plano parar aqui por qualquer motivo, nada
> regrediu e alguma coisa melhorou. É a mesma forma da `T-1415` do PLANO 020.

> **A T-1509 não ordena nada, e isso é uma decisão.** `R-PER-05` pede a ordem da aba;
> `medicao.codigos_em_ordem` já é a ordem da aba, e a ordenação por posição do contrato acontece
> **depois**, sobre `relatorio.linhas`. Acumular dentro do laço entrega a ordem certa sem uma
> linha de `sort` — e um `sorted()` acrescentado por zelo produziria a mesma sequência nos dois
> pares medidos, escondendo a dependência até o dia em que ela deixasse de valer.

> **A T-1510 tem padrão por um motivo verificável.** `executar` devolve `ReportResult(relatorio=None, …)`
> antes do laço quando há bloqueante. Sem o padrão, esse retorno deixa de compilar — e a correção
> apressada seria passar `()` ali, que é o mesmo resultado com uma chance a mais de esquecer.

**Tamanho:** P — três horas.

---

### F3 — A tabela na tela, com as frases ainda lá `[portão]`

**Objetivo:** poder confrontar o que a tabela diz com o que as frases diziam.

| # | Tarefa | Ref. |
|---|---|---|
| T-1515 | O tipo espelho em `frontend/src/lib/types.ts` e o campo em `RespostaRelatorio` | ESPEC §7 |
| T-1516 | `LinhasDerivadas.tsx`: a tabela, herdando de `DivergenciaGrid` o contêiner rolável focável, os cabeçalhos com `scope` e o tratamento de descrição longa | `R-PER-01`, `12` |
| T-1517 | A frase de `R-PER-07` — sem sigla, sem vocabulário do sistema, dizendo o que fazer. **Não pode conter a cadeia "relatório gerado"** (ESPEC 015 §14.4) | `R-PER-07` |
| T-1518 | Entrada no `ResultadoPanel`, no lugar previsto por `D-07` — depois do grid, **acima** do bloco amarelo, que continua | `D-07` |
| T-1519 | `R-PER-10`: sem linha derivada, sem tabela. Verificado com o dublê de `situacaoVazia`, que parte da resposta real | `R-PER-10` |
| T-1520 | **[portão]** Confronto lado a lado, nos dois pares: toda linha das frases está na tabela, com o mesmo código e o mesmo texto de célula. Nenhuma só nas frases | **P2** |
| T-1521 | **[portão]** O `14.048.00008.00` do piloto mostra `D` e `C` na mesma linha da tabela | **P2**, espec `P2` |

**Verificação:** P2.

> **A T-1520 é o portão desta entrega e dura uma fase.** É a única janela em que as duas
> representações coexistem na tela. Depois da F4 a comparação exige `git stash`, e ninguém a faz.
> Custa cinco minutos e dois pares de arquivos.

> **A T-1521 fecha algo que estava aberto desde o MVP.** A perda de informação dos itens de
> perfil foi declarada e aceita na ESPEC 001 §9.3, com este código nomeado; vinte especs depois
> ela nunca esteve na tela. Se a tabela não a mostrar, ela não é melhor que a frase.

> **A T-1518 põe a tabela acima do bloco amarelo, e não abaixo.** Nesta fase há dois blocos
> dizendo o mesmo; o que fica por último parece a ressalva do primeiro. Como o bloco amarelo é o
> que vai sumir, ele é que fica embaixo — assim a tela da F3 já é, de cima para baixo, a tela da
> F4 mais uma sobra.

**Tamanho:** P — três horas. **Encerra:** P2.

---

### F4 — A frase some `[portão]`

**Objetivo:** uma representação só. **Só começa com o P2 fechado.**

| # | Tarefa | Ref. |
|---|---|---|
| T-1522 | Remover `_avisar_perfil` e a chamada. `V-REC-02` deixa de ser emitida | `R-PER-08`, `D-02` |
| T-1523 | `test_api_e2e.py:244` → `avisos == []` **e** `len(corpo["linhas_derivadas"]) == 5` | §5.1 |
| T-1524 | `test_api_e2e.py:263` → `{"V-REC-01"}` **e** `len(corpo["linhas_derivadas"]) == 5` | §5.1 |
| T-1525 | **[risco]** `test_consolidacao_aditivos.py:380` → `avisos == []` **e** `len(derivadas) == 5`. A segunda asserção **não é redundância**: é a contraprova mudando de galho (§5.2) | §5.2 |
| T-1526 | `test_consolidacao_aditivos.py:459` → `avisos == []` **e** `len(derivadas) == 4` | §5.1 |
| T-1527 | O bloco amarelo sai da tela do `ResultadoPanel`. `ListaDeAchados` **não é alterada**: ela deixa de receber `V-REC-02` porque ele não vem mais | `D-02` |
| T-1528 | O contador da faixa de resultado passa a contar o que é exibido: PGM de 10 para 5, piloto de 4 para nenhum | `R-PER-09` |
| T-1529 | **[portão]** `T-1506` fica verde. `T-1507` continua verde nos dois pares; `test_docx_estrutura.py` e `test_docx_formatacao.py` sem uma linha alterada | **P3**, **P4** |

**Verificação:** P3 e P4.

> **A T-1525 é a tarefa que este plano teme.** O teste do `:380` prova que **`V-REC-01` calou
> porque o aditivo o explica** — não porque o pipeline emudeceu —, e os cinco `V-REC-02` eram o
> canário que sustentava essa distinção. Trocar por `avisos == []` e seguir em frente deixa o
> teste verde e sem sentido: ele passaria também num pipeline que não registrasse achado nenhum.
> A `len(derivadas) == 5` é o canário no galho novo, e sem ela a `D-08` da ESPEC 019 perde a
> prova que a acompanha.

> **A T-1527 não filtra por identificador, e a diferença importa.** A alternativa — manter o
> achado e esconder na tela com `validacao !== "V-REC-02"` — põe um ID de validação de backend
> dentro de uma condicional de React e deixa o mesmo fato viajando duas vezes. `D-02` decidiu
> contra, e esta tarefa é onde a decisão se cumpre ou se trai.

> **A T-1528 é a mudança visível mais brusca do plano.** No piloto o bloco amarelo desaparece por
> inteiro e o contador vai a zero. Se a tabela não estiver claramente no lugar, a tela **parecerá
> ter perdido informação** — e é o risco que o P5 mede.

**Tamanho:** P — duas horas. **Encerra:** P3 e P4.

---

### F5 — O manual, a pessoa e o conjunto `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-1530 | `scripts/conteudo_do_manual.py`: a linha do `V-REC-02` deixa de dizer *"item que não é de perfil"* e *"a linha sai zerada"* | ESPEC §2.6 |
| T-1531 | Regenerar o `Manual_de_Utilizacao_Confere.docx` e conferir que só essa linha mudou | ESPEC §2.6 |
| T-1532 | **[portão]** `P5`: a tela e as duas planilhas nas mãos de alguém do faturamento, sem explicação prévia. Registrar **onde a pessoa hesitou**, não só se chegou | **P5**, `K-23` |
| T-1533 | `axe` sem violações A/AA com a tabela na tela, nas duas larguras obrigatórias (1366 e 390) | `R-PER-12` |
| T-1534 | Suíte de backend verde e contagem reconciliada contra os 522 iniciais; 84 de navegador mais os novos | **P6** |
| T-1535 | `ruff`, `mypy`, `tsc --noEmit`, `next lint`, `next build` limpos | **P6** |
| T-1536 | ESPEC 021 → implementada, com as emendas de execução e o acerto de §6 | — |
| T-1537 | CHANGELOG com o resultado e com a resposta ao `I-21`, se o P5 a produzir | `I-21` |

> **A T-1532 pede onde a pessoa hesitou, e não se ela conseguiu.** *"Conseguiu"* é resposta
> binária e sempre otimista — quem está sendo observado se esforça. A hesitação diz qual coluna
> não estava clara, e é o insumo que corrige a frase de `R-PER-07` antes de o manual sair.

**Tamanho:** PP — duas horas. **Encerra:** P5 e P6.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ─────────────────────► publicável sozinha
P0     P1     (API tem o dado;
              a tela não mudou)
                    │
                    └──► F3 ─────────► publicável sozinha
                         P2            (tabela na tela;
                    (confronto)         frases ainda lá)
                              │
                              └──► F4 ──► F5
                                   P3·P4  P5·P6
```

**Há dois cortes de entrega, e os dois são legítimos.** Ao fim da F2, a resposta da API carrega o
dado bruto e nada na tela mudou. Ao fim da F3, a tabela está na tela e nada foi removido — o
produto já resolve o problema de origem, com uma sobra amarela que incomoda e não engana.

**A F4 é a única fase que remove alguma coisa, e é a única que não é publicável sozinha:** ela
depende do P2, que só existe enquanto a F3 e as frases coexistem.

F0 e F1 não tocam código de produção.

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | 1 dia (13 h) |
| — até a F2, publicável | 6 h |
| — até a F3, o problema de origem resolvido | 9 h |

---

## 5. A regressão que já está escrita

Lida no repositório, não presumida. **522 testes de backend, 84 de navegador em 10 arquivos.**

### 5.1 As quatro asserções que mudam de âncora — e são exatamente quatro

Varridos os `backend/tests/`, `V-REC-02` aparece em asserção em **dois** arquivos:

| Arquivo · linha | Hoje | Passa a ser | O que prova |
|---|---|---|---|
| `test_api_e2e.py:244` | `{…} == {"V-REC-02"}` | `avisos == []` e `len(linhas_derivadas) == 5` | `D-08` da ESPEC 019 — o aditivo cala os cinco `V-REC-01` |
| `test_api_e2e.py:263` | `== {"V-REC-01", "V-REC-02"}` | `== {"V-REC-01"}` e `len(linhas_derivadas) == 5` | `D-10` — sem aditivo, o caminho é o de antes |
| `test_consolidacao_aditivos.py:380` | `count("V-REC-02") == 5`, `len(validacoes) == 5` | `avisos == []` e `len(derivadas) == 5` | O silêncio fundamentado da `V-REC-01` (§5.2) |
| `test_consolidacao_aditivos.py:459` | `== ["V-REC-02"] * 4` | `avisos == []` e `len(derivadas) == 4` | ESPEC 019 §9.1 — zero aditivos, bit a bit |

### 5.2 As demais asserções sobre `avisos` **não são afetadas**, e vale saber por quê

`test_reconciliation.py:295`, `:296`, `:331`, `test_reader_measurement.py:142`,
`test_domain.py:244`, `test_cascata_de_validacoes.py:108-110`, `test_capa.py:440`, `:457` e
`test_consolidacao_aditivos.py:201`, `:214`, `:277`, `:290` chamam **a função de validação
diretamente**, com `ValidationReport()` montado à mão. Nenhuma passa por
`GenerateMeasurementReport`, que é o único lugar onde `_avisar_perfil` roda.

`test_anchor_por_codigo.py:233` filtra por `validacao == "V-REC-01"` e é indiferente.

**A consequência prática:** a F4 é cirúrgica. Quatro asserções, dois arquivos, e nenhuma
descoberta tardia — a varredura está feita.

### 5.3 O que não pode se mexer

| Verificação | Critério |
|---|---|
| `.docx` dos dois pares | `ler_docx` idêntico à captura da F1 (`T-1507`). `test_docx_estrutura.py` e `test_docx_formatacao.py` **sem uma linha alterada** |
| `.xlsx` de análise | Inalterado; `analise_referencia.xlsx` continua servindo de âncora |
| Painel de análise | `SEM_DIVERGENCIA` com `perfis_ou_pacotes` **4** no piloto e **5** no PGM; a `R-PAN-06` continua exibida |
| Totais | 58 / 37 / 4 no piloto; 58 / 27 / 13 no PGM |
| Dublês de `e2e/estados.ts:47` e `anuncio.spec.ts:79` | São `RespostaBloqueada` (422): **não precisam do campo novo** e não são tocados |
| Percurso de teclado da ESPEC 008 §6 | A tabela acrescenta **uma** parada de tabulação (o contêiner rolável de `R-ACE-05`), e só quando há linha derivada |

---

## 6. Um acerto à ESPEC 021

`R-PER-02` diz *"texto **bruto** da célula"*. Medido o `levantamento_reader.py`, o que existe é o
texto **normalizado na leitura**, por `_texto()`:

- células de texto chegam com `.strip()` aplicado;
- células numéricas chegam como texto **pt-BR**: o inteiro `1` da linha 83 vira `"1"`, e um
  `1.0` viria como `"1,0"` — a conversão existe desde o MVP e tem motivo forte, registrado no
  próprio arquivo: repassar `762.55` cru faria o conversor pt-BR ler 76.255, *"um erro de duas
  ordens de grandeza que passaria despercebido"*;
- uma data chegaria como `dd/mm/aaaa`.

**Para as nove células medidas, não muda nada** — são cinco cadeias de texto e quatro inteiros.
O acerto é de precisão, e existe para impedir uma leitura literal da regra: alguém que leia
*"bruto"* pode concluir que precisa **abrir a planilha outra vez** para pegar o valor sem
tratamento. Não precisa, e não deve — seria uma segunda leitura do arquivo, com uma segunda
chance de divergir da primeira.

Redação proposta para `R-PER-02`:

> As duas quantidades são exibidas **como o leitor as entrega** — sem conversão a número, sem
> normalização adicional e sem vazio virando zero. `-`, `F`, `PACOTE` e `2` saem como estão.

`T-1502` aplica a emenda. A regra não enfraquece: o que ela proíbe — `para_decimal`, `or 0`,
substituir vazio — continua proibido.

---

## 7. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| **Escrever as asserções a partir da saída do código** | T-1500 e o P0. É o risco número um, e o mais silencioso: o teste fica verde e não mede nada |
| **Normalizar a coluna crua** — `-` virar `0` ou vazio | T-1504, que falha alto e nominalmente. É o defeito mais provável da entrega, porque parece acabamento |
| **Remover `V-REC-02` antes de a tabela existir** | A ordem das fases e o P2. É o único momento em que este plano poderia produzir um silêncio pior que o de hoje |
| **Apagar as quatro asserções em vez de reancorar** | T-1525 é `[risco]` por isso. Uma delas perde a contraprova, e o teste continua verde |
| **Mexer no documento com o renderizador aberto** | T-1507, capturado antes de qualquer edição |
| **`1 / 1` escrito à mão no componente** | `D-06` e T-1512. Uma constante de domínio duplicada em TypeScript é a forma mais barata de a tela passar a mentir |
| **A tabela e o documento divergirem** | T-1505, a invariante de acoplamento |
| **Descrição de 148 caracteres quebrar o layout** | T-1516 herda o tratamento do `DivergenciaGrid`, que já convive com ela |
| **A frase nova conter "relatório gerado"** | T-1517. Pela ESPEC 015 §14.4, derruba **sete suítes** com erro de *strict mode violation*, que não diz nada sobre a causa |
| **`derivadas` sem padrão quebrar o caminho bloqueado** | T-1510 |
| **A tela parecer ter perdido informação** depois da F4 | T-1528 e o P5. Nenhum teste automatizado mede isto |
| **Filtrar por `validacao === "V-REC-02"` na tela** por ser mais rápido | T-1527. É a traição de `D-02`, e ela cabe numa linha |
| **Tomar o P5 por conferência de rotina** | T-1532 pede onde a pessoa hesitou. *"Conseguiu"* é sempre sim |

---

## 8. Insumos

| ID | Insumo | Para quê |
|---|---|---|
| `K-23` | **Uma pessoa do faturamento**, que não tenha participado desta espec, com meia hora e os dois pares de arquivos | P5 · T-1532 |
| `K-24` | Resposta ao `I-21`: depois do P5, se a tabela na tela basta ou se as linhas derivadas precisam de aba no XLSX de análise | `I-21` |
| `K-25` | Decisão sobre o `I-22` — a auditoria do manual. Quatro validações documentadas não existem e sete em produção não estão documentadas. **Não bloqueia este plano**, e deveria ser decidido antes da próxima entrega ao usuário | `I-22` |

---

## 9. O que este plano não faz

- **Não muda o `.docx` nem o `.xlsx`.** `R-PER-11`, e o T-1507 é a asserção que sustenta a frase.
- **Não reabre `R-REL-08`.** A derivação continua idêntica; muda o que se conta sobre ela.
- **Não cria validação nova.** A comparação `D` × `C` do `I-23` é registrada pela espec e fica
  fora: exigiria decidir o que `PACOTE` × `1` significa, e `I-24` mostra que não é trivial.
- **Não audita o manual.** Corrige a linha do `V-REC-02`, que é consequência direta, e para aí
  (`K-25`).
- **Não toca o painel de análise.** A ressalva `R-PAN-06` continua exata; ela apenas passa a ter
  para onde apontar.
- **Não acrescenta dependência**, nem no backend nem no frontend. A tabela é HTML, e o
  `DivergenciaGrid` já resolveu rolagem e foco.

---

## 10. Emenda de execução — o `P6` passa a ser critério de delta

**2026-08-18.** O `P6` exigia *"suíte de backend e de navegador verdes"*. A de navegador **não
estava verde antes desta entrega**, e não por causa dela.

Medida contra o código intocado, antes de a F2 abrir qualquer arquivo de `src/`:

```
74 passed, 10 failed (26,2 min)
```

As dez rastreiam para trabalho **não commitado** das ESPECs 018 e 019 — o `HEAD` desta branch tem
especificações só até a 017. Quatro vêm do terceiro campo de upload (Aditivos), cinco de contagens
que a ESPEC 018 mudou por decisão, e uma é colisão de desenho que ninguém decidiu. O diagnóstico
completo, com a causa raiz na `T-1280` do TASKS 018, está no TASKS 021 §11.6.

**Critério que passa a valer:** a suíte de navegador termina com **as mesmas 10 falhas**, e
nenhuma a mais. É o único critério honesto disponível, e não afrouxa nada — a linha de base é um
número fixo, medido e versionado neste plano.

**O que ele não faz:** não conserta a suíte, e não deve. Misturar *"a suíte voltou a valer"* com
*"a tabela nova existe"* faria com que nenhum dos dois pudesse ser revertido sozinho. Fica como
`K-26` no TASKS 021.

**Resultado.** A suíte terminou em **78 de 88** — os 84 originais mais os 4 da `derivadas.spec.ts`
—, com as **mesmas dez** falhas, nos mesmos arquivos e nas mesmas linhas. O critério fechou.
