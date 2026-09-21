# TASKS 023 — Backlog de "O aviso que diz o que fazer"

| | |
|---|---|
| **Especificação** | [ESPEC 023](../specs/023-o-aviso-que-diz-o-que-fazer.md) v1.0 |
| **Plano** | [PLANO 023](../plans/023-plano-o-aviso-que-diz-o-que-fazer.md) v1.0 |
| **Versão** | 1.0 — 2026-08-18 |
| **Total** | 36 tarefas · 7 portões · **3** insumos |
| **Status** | **Concluído com ressalva** — 2026-08-18. Portões `P0`–`P4` e `P6` fechados; **`P5` aberto** (`K-30`). Backend 547 → **556**; `divergencia.spec.ts` 7/7; `axe` 14/14. Quatro desvios em §11 |
| **Referência visual** | [Proposta de tela](https://claude.ai/code/artifact/7f326d40-8de6-4bc6-a1d0-4cfc381d388c) |

> Escrito **antes** da implementação, como o TASKS 020, o 021 e o 022.

---

## 1. Convenções

**Identificadores** `T-17nn` seguem a numeração do PLANO 023, que começa em T-1700 porque a
implementação da ESPEC 022 fechou em T-1630.

**Definição de pronto — backend:** código e teste na mesma entrega; `ruff check`, `mypy src/` e
`bandit -ll -r src/` limpos; `pytest` verde; comentário explicando o *porquê* onde a escolha não
for óbvia.

**Definição de pronto — frontend:** `tsc --noEmit`, `next lint` e `next build` limpos; a suíte
Playwright verde; varredura `axe` sem violações A/AA nas duas larguras obrigatórias (1366 e 390).

**Convenção de commit** `<tipo>(T-17nn): descrição`.

### 1.1 Cinco regras que atravessam o backlog

**1 — O par piloto não exercita nada disto.** `estados.ts::pronto` monta a tela com
`contrato.pdf` + `levantamento.xlsx`, e esse par produz **zero** `V-REC-01`. Todo instrumento de
tela escrito contra ele nasce verde e permanece verde qualquer que seja a implementação.

O sinal no diff é um teste desta entrega que importe `pronto` de `estados.ts`.

**2 — Nada é removido antes de o substituto existir e ter sido visto.** A frase âmbar sobrevive
aos épicos E2 e E3 inteiros. A T-1725 é a única tarefa que remove alguma coisa, e só entra com o
**P2 fechado**.

**3 — A tela não filtra por identificador de validação.** `R-FON-09` decidiu que `V-REC-01` sai da
resposta; esconder na tela um achado que continua chegando é a traição barata dessa decisão, e cabe
numa linha.

O sinal no diff é literal: a cadeia `V-REC-01` aparecendo em qualquer arquivo `.tsx`.

**4 — Âncora que muda de fonte não pode mudar de sentido.** Seis testes leem `V-REC-01` de
`achados.avisos`. Reancorá-los em `avisos == []` é a saída de uma linha, e mata duas provas —
inclusive a da ESPEC 022. Cada um tem destino nomeado em §2.3.

O sinal no diff é `assert ... avisos == []` sem uma segunda asserção ao lado.

**5 — Nenhuma cor nova.** O eixo de severidade da ESPEC 009 (`critico`, `maior`, `conforme`) já
existe com contraste verificado. Um par de cores próprio para este aviso acrescentaria um segundo
vocabulário visual de gravidade à mesma tela.

O sinal no diff é um hexadecimal literal em `.tsx` ou uma chave nova em `tailwind.config.ts`.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** O estado de tela que não existe | T-1700 … T-1704 | **P0** | F0 |
| **E1** Os instrumentos, e o da sigla reprova | T-1705 … T-1710 | **P1** | F1 |
| **E2** `divergencias_de_fonte` existe, e a frase continua | T-1711 … T-1717 | — | F2 · **publicável** |
| **E3** A tabela na tela, com a frase ainda lá | T-1718 … T-1724 | **P2** | F3 · **publicável** |
| **E4** A frase some | T-1725 … T-1730 | **P3**, **P4** | F4 |
| **E5** As pessoas e o conjunto | T-1731 … T-1735 | **P5**, **P6** | F5 |

**Numeração dos portões:** este backlog usa os do PLANO 023 (`P0`–`P6`). A ESPEC 023 §8.3 tem os
seus três: o `P1` e o `P2` **da espec** são o `P5` daqui; o `P3` da espec é o `P4`.

### 2.1 Pontos de não retorno

**T-1712 é o primeiro toque em `src/`.** Tudo antes dela é instrumento e pode ser descartado sem
custo nenhum.

**T-1725 é irreversível na prática.** Ela remove a única representação que hoje existe. Depois
dela, o confronto entre tabela e frases — que é o portão `P2` — exige `git stash`, e ninguém o
faz. **Não entra sem o P2 fechado.**

**T-1728 destrói duas provas se for feita no automático.** Ver §2.3 e o aviso de §2.4.

### 2.2 A régua da entrega — o que pode mudar de comportamento

| Muda | Não muda |
|---|---|
| A resposta ganha `divergencias_de_fonte` | `RespostaBloqueada` — o caminho bloqueado retorna antes do laço |
| `V-REC-01` deixa de sair em `avisos` — **seis** âncoras | As demais asserções sobre `avisos`, que servem `V-CTR-*`, `V-MED-*` e `V-ADT-*` |
| A tela ganha a tabela e perde as frases âmbar | O grid de divergências, o painel de análise e a tabela de linhas derivadas |
| O contador de avisos da faixa | Totais: 58 / 27 / 13 no PGM |
| `ReportResult` ganha um campo com padrão | O `.docx` e o `.xlsx` — nem uma célula |
| — | As regras `R-QTD-01` a `R-QTD-08` da ESPEC 022 |

### 2.3 As seis âncoras, com destino

| # | Teste | Lê hoje | Destino |
|---|---|---|---|
| 1 | `test_anchor_por_codigo.py:248` | filtra `avisos` por `V-REC-01` | Mesmos cinco códigos, do campo novo |
| 2 | `test_api_e2e.py:270` | `{...} == {"V-REC-01"}` | `avisos == []` **e** `len(divergencias_de_fonte) == 5` |
| 3 | `test_consolidacao_aditivos.py:433` | `"V-REC-01" not in validacoes` | Continua; acrescentar que o campo novo está **vazio** |
| 4 | `test_consolidacao_aditivos.py:451` | `acusados == EXPLICADOS_PELO_ADITIVO` | Mesmos cinco, do campo novo. **Não pode virar `avisos == []`** |
| 5 | `test_quantitativo_consolidado.py::test_t1605` | `acusados == {CODIGO_ADULTERADO}` | Mesmo código, do campo novo, **e** severidade `CRITICO` |
| 6 | `test_reconciliation.py:259+` | chama a validação e lê `achados` | Acompanha a decisão do `I-29` (T-1711) |

### 2.4 O aviso que este backlog existe para dar

**A número 5 é a mais perigosa da suíte inteira.**

`test_t1605_a_aba_adulterada_e_acusada` foi escrita na ESPEC 022 para **reprovar** contra o código
de então, e é a única evidência viva de que a cegueira da `V-REC-01` fechou. Reancorada no
automático vira `assert avisos == []` — verde, e verde também num sistema que voltasse a suprimir.
Sobreviveria como linha de código e morreria como prova.

O destino correto está na tabela: mesmo código, do campo novo, **mais** a severidade `CRITICO`.
Ela sai mais forte do que entrou.

---

## 3. Épico E0 — O estado de tela que não existe `[portão P0]`

> **Nenhum arquivo de `src/` é tocado neste épico.**

#### T-1700 — Decidir como montar o estado
**Tamanho:** PP · **Ref:** ESPEC 023 §8.2

Duas saídas, e a escolha é do backlog:

| | Como | Custo | Problema |
|---|---|---|---|
| (a) | Gerar o par do PGM pelo navegador | ~140 s (`test_api_e2e` mede) | Acima do teto de 120 s por teste do Playwright |
| (b) | **Dublê de resposta 200**, como `estados.bloqueado` faz com o 422 | instantâneo | Espelha o schema e precisa acompanhá-lo |

**Recomendada: (b).** O que a F1 mede é comportamento **de tela** diante de uma resposta; a
correção da resposta é medida no backend, com os pares reais, onde já está.

**Pronto quando:** a decisão está registrada, com o motivo, em `estados.ts`.

---

#### T-1701 — `estados.divergenciaDeFonte`
**Tamanho:** P · **Ref:** `R-FON-01`

Dublê de 200 no formato de `RespostaRelatorio`, com as **cinco** divergências reais do PGM sem
aditivo. Os valores saem de `CONTRATADO_CONSOLIDADO` e `DELTAS_DO_ADITIVO`, que já existem em
`backend/tests/test_quantitativo_consolidado.py` — **transcritos**, não inventados.

Enquanto o campo novo não existir (E2), o dublê carrega os cinco em `avisos`, no formato de hoje.
É o que faz a T-1703 encontrar as frases.

**Pronto quando:** o estado monta e a tela exibe cinco frases `V-REC-01`.

---

#### T-1702 — `estados.divergenciaComAditivo`
**Tamanho:** PP · **Ref:** `R-FON-02`

O estado B: **uma** divergência remanescente, o `14.048.00027.00` com contratado vigente
`1.300,00` e planilha `1.400,00`.

**Nenhuma fixture do repositório produz este estado** — ele existe porque a ESPEC 022 §2.4 o
construiu adulterando a medição em memória. É a única forma de tê-lo na tela.

**Pronto quando:** o estado monta.

---

#### T-1703 — A tela mostra o defeito `[portão P0]`
**Tamanho:** PP · **Portão P0**

Rodar `divergenciaDeFonte` contra o código intocado e provar que as cinco frases aparecem.

Sem este portão, todo instrumento do E1 é vacuamente verde — e é o defeito que a regra 1 do §1.1
descreve.

**Pronto quando:** verde, com as cinco ocorrências contadas.

---

#### T-1704 — A nota de manutenção em `estados.ts`
**Tamanho:** PP

Os dublês espelham o schema do backend e precisam acompanhá-lo. O dublê de 422 já carrega essa
nota; os dois novos precisam da mesma, e da menção de que os valores vêm do
`test_quantitativo_consolidado.py`.

**Pronto quando:** a nota existe e nomeia a fonte dos valores.

---

## 4. Épico E1 — Os instrumentos, e o da sigla reprova `[portão P1]`

> **Nenhum arquivo de `src/` nem de `frontend/src/` é tocado neste épico.**

#### T-1705 — A sigla não aparece `[portão P1]`
**Tamanho:** PP · **Ref:** `R-FON-09` · **Portão P1**

`e2e/divergencia.spec.ts`: a cadeia `V-REC-01` não ocorre na tela, sobre `divergenciaDeFonte`.

Asserção sobre o texto da **página inteira**, e não sobre o seletor do bloco âmbar: o que a espec
pede é que a sigla desapareça, e amarrar ao bloco deixaria o teste verde no dia em que alguém a
movesse de lugar. É o padrão da `derivadas.spec.ts`, com a diferença que importa — o estado é o da
T-1701, não `pronto`.

**Rodar contra o código intocado e exigir que reprove**, com as cinco ocorrências nomeadas.

**Pronto quando:** reprova, e o docstring registra que a reprovação é esperada nesta fase.

---

#### T-1706 — As cinco divergências, com a diferença
**Tamanho:** P · **Ref:** `R-FON-01`, `R-FON-05`

Backend, PGM sem aditivo. Os cinco códigos, com contrato, planilha e **diferença**:

| código | contrato | planilha | diferença |
|---|---:|---:|---:|
| `14.048.00027.00` | 200,00 | 1.300,00 | +1.100,00 |
| `14.024.00006.00` | 6.100,00 | 9.000,89 | +2.900,89 |
| `10.050.00001.00` | 42.260,00 | 42.814,01 | +554,01 |
| `14.031.00020.00` | 5,00 | 10,00 | +5,00 |
| `12.030.00001.00` | 150,00 | 70,00 | −80,00 |

A coluna de diferença é conferida contra `DELTAS_DO_ADITIVO` — ela **é** o conteúdo dos blocos do
aditivo (ESPEC §2.2), e essa igualdade é o que justifica a coluna existir.

**Vermelha até o E2.** TDD comum.

**Pronto quando:** as asserções existem e falham por campo inexistente.

---

#### T-1707 — A ordem por magnitude
**Tamanho:** PP · **Ref:** `R-FON-06`

A sequência sai `14.048`, `14.031`, `12.030`, `14.024`, `10.050` — magnitude relativa decrescente
(`+550%`, `+100%`, `−53%`, `+48%`, `+1%`).

**Não** é a ordem do contrato nem a alfabética. É a asserção que falha se alguém "arrumar" a
ordenação para casar com o grid.

**Pronto quando:** existe, com o percentual de cada um no comentário.

---

#### T-1708 — As duas severidades
**Tamanho:** P · **Ref:** `R-FON-02` · **É o conteúdo da espec**

Sem aditivo aplicado ao código: `MAIOR_RELEVANCIA`. Com aditivo aplicado e divergência
remanescente: `CRITICO`.

**Escrita antes de existir campo para ela**, e de propósito. Adiada para "depois que a tabela
existir", a tabela nasce com uma tarja só e os dois estados viram trabalho futuro que não
acontece — e aí a entrega é uma reformatação.

**Pronto quando:** as duas asserções existem, uma por estado.

---

#### T-1709 — A decomposição
**Tamanho:** PP · **Ref:** `R-FON-04`

Com aditivo, a linha do `14.048.00027.00` traz proposta `200,00` **e** delta `1.100,00` — os dois
campos, não a soma. É o que permite a tela provar que somou.

**Pronto quando:** existe.

---

#### T-1710 — Confirmar que a âncora dos artefatos já cobre
**Tamanho:** PP · **Ref:** `R-FON-13` · **Portão P4** · **Pode fechar com zero linha**

`test_quantitativo_consolidado.py::T-1601/T-1602` afirmam que a quantidade do contrato não alcança
os artefatos. Esta espec não mexe em quantidade nenhuma.

Se a cobertura já bastar, **não escrever nada**. Uma segunda âncora com o mesmo propósito custa
tempo de suíte e divide a atenção de quem for lê-la.

**Pronto quando:** a conclusão está registrada — cobre, ou não cobre e por quê.

---

## 5. Épico E2 — `divergencias_de_fonte` existe, e a frase continua

> **Nada é removido neste épico.** A API ganha um campo que ninguém lê; a tela é idêntica.

#### T-1711 — Decidir o `I-29`
**Tamanho:** PP · **Ref:** `I-29`

A `V-REC-01` **devolve** as divergências, ou a acumulação passa ao caso de uso?

**Recomendada: a validação devolve.** O precedente da `R-PER-08` moveu a `V-REC-02` para o caso de
uso porque a derivação já acontecia lá — era o mesmo `if`. Aqui a comparação **é** a validação, e
movê-la a dissolveria como unidade nomeada com arquivo e teste próprios, que é o padrão de
guardrails do TRIADE.

**Pronto quando:** a decisão está no docstring da validação, com o motivo.

---

#### T-1712 — `DivergenciaDeFonte` no domínio
**Tamanho:** P · **Ref:** `R-FON-01` a `R-FON-05` · **§2.1 — primeiro toque em `src/`**

Frozen, com: código, descrição, unidade, quantidade do contrato, delta do aditivo (opcional),
quantidade da planilha, diferença, variação percentual e `tem_aditivo_aplicado`.

O último é o que separa os dois estados, e vive aqui e não na tela (`D-01`): saber se um código
teve delta aplicado exige `Contract.blocos` e a lista de peças, que o frontend não tem e não deve
ter.

**Pronto quando:** a entidade existe, com comentário explicando por que `tem_aditivo_aplicado` é
do domínio.

---

#### T-1713 — O delta por código
**Tamanho:** P · **Ref:** `R-FON-04`

Sai de `Contract.codigos_de(AUMENTO)` e `codigos_de(REDUCAO)` cruzados com os blocos das peças
submetidas.

**É o dado que a `T-1617` da ESPEC 022 preservou** ao manter `codigos_ignorados()` viva. Aquela
tarefa a preservou por causa da `V-ADT-04`; esta é o segundo consumidor, e confirma a decisão.

**Pronto quando:** o delta do `14.048.00027.00` chega `1.100,00` no par com aditivo.

---

#### T-1714 — O campo em `ReportResult`
**Tamanho:** PP

**Por último e com padrão.** O caminho bloqueado devolve `relatorio=None` antes do laço, e sem o
padrão aquele retorno deixa de compilar. Mesma regra da `derivadas`, mesmo motivo.

**Pronto quando:** `mypy` limpo e o caminho bloqueado intacto.

---

#### T-1715 — Schema e conversão
**Tamanho:** P · **Ref:** `R-FON-01`

Pydantic e a função de conversão ao lado de `_linha` e `_derivada`, com as quantidades **já
formatadas** — as regras de formatação são de domínio, e duplicá-las em TypeScript as poria em
duas linguagens.

**`RespostaBloqueada` não muda.**

**Pronto quando:** o campo aparece na resposta do par PGM sem aditivo, com cinco entradas.

---

#### T-1716 — O tipo espelho
**Tamanho:** PP

`frontend/src/lib/types.ts` — a interface e o campo em `RespostaRelatorio`.

**Pronto quando:** `tsc --noEmit` limpo.

---

#### T-1717 — O E2 fecha sem mudar a tela
**Tamanho:** PP

T-1706 a T-1709 verdes. **T-1705 continua reprovando** — a frase ainda está lá, e é assim que tem
de ser.

Atualizar `estados.divergenciaDeFonte` para trazer também o campo novo, mantendo os `avisos`.

**Pronto quando:** backend verde, tela idêntica à de antes.

---

## 6. Épico E3 — A tabela na tela, com a frase ainda lá `[portão P2]`

> **Nada é removido neste épico.** A tela fica feia, e é o preço do P2.

#### T-1718 — `DivergenciaDeFonte.tsx`
**Tamanho:** P · **Ref:** `R-FON-01`, `R-FON-14`

Nos moldes de `LinhasDerivadas.tsx`, que já resolve contêiner rolável focável (`R-ACE-05`),
cabeçalhos com `scope` e a frase acima da tabela.

Colunas: código, descrição, unidade, quantidade do contrato, quantidade da planilha, diferença com
percentual.

**A coluna de diferença é insacrificável** (`D-03`). Se faltar espaço, rola — não sai.

**Pronto quando:** a tabela renderiza os cinco itens do estado A.

---

#### T-1719 — Os dois estados
**Tamanho:** P · **Ref:** `R-FON-02`, `D-02` · **É o conteúdo da espec**

Severidade do eixo da ESPEC 009: `severidade.maior` / `maior-fundo` no estado A,
`severidade.critico` / `critico-fundo` no estado B.

**Nenhuma cor nova** (regra 5 do §1.1). O eixo existe, com contraste verificado e documentado no
`tailwind.config.ts`.

O título muda com o estado: *"Pode faltar um aditivo de contrato"* × *"Mesmo com o aditivo, N itens
não fecham"*.

**Pronto quando:** os dois estados renderizam distintos, e `T-1708` continua verde no backend.

---

#### T-1720 — Rótulo variável e decomposição
**Tamanho:** PP · **Ref:** `R-FON-03`, `R-FON-04`

*"Na proposta"* sem aditivo aplicado; *"Contratado vigente"* com ele. E a decomposição
`proposta 200,00 + aditivo 1.100,00` embaixo da descrição, em fonte monoespaçada.

Sem a decomposição, `1.300,00` é um número que o leitor tem de aceitar.

**Pronto quando:** os dois rótulos aparecem nos estados certos.

---

#### T-1721 — A ação de anexar aditivo
**Tamanho:** P · **Ref:** `R-FON-07`, `D-05`

Devolve o **foco** ao campo de aditivos do formulário. Não reenvia: a aplicação é sem estado
(ESPEC 001 §7.2) e não guarda os arquivos entre duas chamadas.

Mesmo mecanismo de foco programático de `R-ACE-15`. O rótulo diz as duas etapas — *"anexar aditivo
e gerar de novo"* —, senão promete o que não faz.

**Só no estado A.** No estado B o aditivo já está anexado.

**Pronto quando:** clicar move o foco, e o `UploadForm` expõe o alvo.

---

#### T-1722 — O rodapé que declara o silêncio
**Tamanho:** PP · **Ref:** `R-FON-12`, `D-07`

No estado B: *"os outros N itens do aditivo fecharam e por isso não aparecem"*.

É a entrega da ESPEC 022 tornada visível. Sem essa frase, uma tabela de uma linha parece relatório
incompleto — e o leitor não tem como saber que os outros foram conferidos.

**Pronto quando:** a frase aparece e o número bate com o total de códigos aditivados.

---

#### T-1723 — A seção entra no `ResultadoPanel`
**Tamanho:** PP · **Ref:** `D-08`

Depois do grid e das linhas derivadas, **acima** do bloco âmbar — que continua ali.

`R-FON-11`: a seção só existe quando há divergência. Nenhuma tabela vazia.

**Pronto quando:** com o par completo do PGM, a seção não é renderizada.

---

#### T-1724 — O confronto `[portão P2]`
**Tamanho:** PP · **Portão P2**

Com o bloco âmbar ainda na tela, nos dois estados: toda linha das frases está na tabela, e a tabela
traz diferença e percentual que as frases não têm.

**É a última janela em que a comparação é possível.** Depois da T-1725 exige `git stash`.

**Pronto quando:** o confronto está registrado, item a item.

---

## 7. Épico E4 — A frase some `[portões P3 e P4]`

#### T-1725 — `V-REC-01` deixa de ser achado
**Tamanho:** PP · **Ref:** `R-FON-09` · **§2.1 — irreversível**

**Não entra sem o P2 fechado.**

**Pronto quando:** a validação não registra mais em `ValidationReport`.

---

#### T-1726 — A sigla sumiu `[portão P3]`
**Tamanho:** PP · **Portão P3**

T-1705 verde.

**Pronto quando:** verde, e o docstring dela atualizado — a reprovação deixou de ser esperada.

---

#### T-1727 — O contador da faixa
**Tamanho:** PP · **Ref:** `R-FON-10`

Passa a contar o que é exibido. No PGM sem aditivo cai de 5 para 0 — e a tabela aparece no lugar.

**Pronto quando:** a faixa não menciona avisos quando não há.

---

#### T-1728 — Reancorar as seis `[portão P3]`
**Tamanho:** P · **Ref:** §2.3 · **Ler §2.4 antes**

Uma a uma, pelo destino da tabela. **A número 5 primeiro**, e com o §2.4 aberto ao lado.

`ListaDeAchados` **não muda** (T-1729).

**Pronto quando:** as seis verdes, nenhuma reduzida a `avisos == []` sem segunda asserção.

---

#### T-1729 — `ListaDeAchados` intacta
**Tamanho:** PP · **Ref:** `D-06`

Ela deixa de receber `V-REC-01` porque ele não vem mais, **não porque filtra**. Continua servindo
`V-CTR-*`, `V-MED-*` e `V-ADT-*`.

**Pronto quando:** `git diff` não mostra o componente.

---

#### T-1730 — O entregável não se mexeu `[portão P4]`
**Tamanho:** PP · **Portão P4**

T-1601/T-1602 verdes; `git diff` sem nada em `infrastructure/report/`.

**Pronto quando:** as duas verdes e o diff limpo.

---

## 8. Épico E5 — As pessoas e o conjunto `[portões P5 e P6]`

#### T-1731 — A pessoa acha o aditivo `[portão P5]`
**Tamanho:** PP · **Portão P5** · **Insumo `K-30`**

Alguém do faturamento que não participou desta espec vê o estado A, sem explicação prévia, e
conclui que precisa anexar o aditivo.

Nenhum teste automatizado substitui. Se falhar, é redação de `R-FON-08` ou hierarquia visual.

**Pronto quando:** a pessoa chega à conclusão sozinha.

---

#### T-1732 — A pessoa distingue os estados `[portão P5]`
**Tamanho:** PP · **Portão P5**

A mesma pessoa vê o estado B e entende que é diferente e mais grave.

**É o portão que mede se a espec foi entregue.** Se não distinguir, o que se entregou foi uma
tabela mais bonita.

**Pronto quando:** a pessoa nomeia a diferença sem ajuda.

---

#### T-1733 — `axe` nos dois estados
**Tamanho:** PP · **Ref:** `R-FON-14`, **P6**

Verificar primeiro se os estados novos entram de graça no `a11y-axe.spec.ts` parametrizado — a
tabela da ESPEC 021 entrou, e a `T-1533` daquele backlog fechou com zero linha por isso.

**Pronto quando:** sem violações A/AA em 1366 e 390.

---

#### T-1734 — O conjunto `[portão P6]`
**Tamanho:** PP · **Portão P6**

Backend com contagem reconciliada — **nenhum teste some sem substituto nomeado**; navegador sem
falha nova; `ruff`, `mypy`, `bandit`, `tsc --noEmit`, `next lint`, `next build`.

**Pronto quando:** o número final está justificado tarefa a tarefa.

---

#### T-1735 — Fechamento documental
**Tamanho:** PP

`CHANGELOG`; ESPEC e PLANO 023 marcados como implementados; este backlog com o status final e a
**§11 — O que a implementação ensinou**.

A §11 não é opcional: os três desvios do TASKS 022 são o que fez o PLANO 023 nascer sabendo que o
piloto não produz `V-REC-01`.

Registrar `I-30` a `I-32` como decididos ou adiados.

**Pronto quando:** os documentos refletem o que foi feito, incluindo o que saiu diferente.

---

## 9. Insumos

| ID | Insumo | Para quê | Quando |
|---|---|---|---|
| `K-30` | **Uma pessoa do faturamento** que não participou desta espec, com meia hora e os dois estados na tela | `P5` | T-1731, T-1732 |
| `K-31` | Decisão sobre `I-31`: divergência remanescente **com** aditivo aplicado deveria bloquear? É o mais próximo de *dado errado* que o sistema detecta | `I-31` | depois — não bloqueia |
| `K-32` | Decisão sobre `I-30`: a divergência merece aba no XLSX de análise? Mesma pergunta que o `I-21` fez das derivadas, e a resposta deveria ser a mesma para as duas | `I-30` | depois |

---

## 10. O que este backlog não faz

- **Não muda o `.docx` nem o `.xlsx`.** `R-FON-13`, e a âncora que o sustenta já existe (T-1710).
- **Não mexe na consolidação.** As regras `R-QTD-*` da ESPEC 022 ficam intactas; esta entrega
  consome o dado que elas produzem.
- **Não cria validação nem severidade nova.** Reusa o eixo da ESPEC 009 (`D-02`).
- **Não decide se o estado B bloqueia.** `I-31` e `K-31`.
- **Não corrige o manual.** Três trechos ensinam o oposto do que o sistema faz (ESPEC 023 §2.5), e
  a auditoria é `I-22` — maior que esta entrega e anterior a ela.
- **Não acrescenta dependência**, no backend nem no frontend. A tabela é HTML, e o
  `LinhasDerivadas` já resolveu rolagem e foco.

---

## 11. O que a implementação ensinou

### 11.1 O andaime reintroduziu o defeito que o teste procura

A primeira rodada do `divergencia.spec.ts` deu **4 falhas em 7**, e a mais instrutiva foi a
`T-1705`: a sigla `V-REC-01` continuava na tela **depois** de a `T-1725` a ter removido do backend.

A causa era o próprio dublê. Entre o E0 e o E3 ele injetava os cinco em `avisos`, no formato da
frase, porque era assim que o backend os entregava — e é o que fez a `T-1703` encontrar as frases e
a `T-1705` reprovar contra o código intocado. Removida a frase do produto, a injeção continuou, e o
teste passou a reprovar **por causa do próprio andaime**.

O docstring escrito na `T-1701` previa isso em letras: *"depois do E4 o campo `avisos` volta a vir
vazio do backend, e estas entradas saem daqui junto"*. A previsão estava no arquivo e não foi
executada.

**Lição para o próximo backlog desta forma:** a tarefa de remoção (`T-1725`) tem de listar
explicitamente os **dublês** a atualizar, não só o código de produção. Um andaime que espelha o
comportamento antigo é código que afirma o comportamento antigo.

### 11.2 Dois `role="region"` com o mesmo rótulo

Duas outras falhas vieram de `getByRole("region", { name: … })` resolvendo dois elementos: a
`<section aria-labelledby="titulo-divergencia">` e o contêiner rolável interno, que carrega
`role="region"` com o **mesmo** `aria-labelledby` por exigência de `R-ACE-05`.

É padrão que o `LinhasDerivadas` já usa, e portanto vai reaparecer. A âncora estável é a
`<table>`, que é única e tem o mesmo rótulo acessível.

A quarta falha foi `getByText(/proposta.*aditivo/i)` casando três elementos — a decomposição, a
frase do aviso e o rótulo do campo de upload. Ancorada nos números (`proposta 200,00 + aditivo
1.100,00`), fica única e mede o que interessa.

**Nenhuma das quatro era defeito de produto.** As sete passaram na segunda rodada sem uma linha de
`src/` alterada.

### 11.3 A decomposição exigiu um campo que a espec não previu

`R-FON-04` pede `proposta 200,00 + aditivo 1.100,00`. O backend entregava o **consolidado**
(`no_contrato`) e o **delta** (`no_aditivo`), e a tela teria de subtrair — sobre cadeias já
formatadas em pt-BR, o que é impossível sem reimplementar a formatação em TypeScript.

Entrou `na_proposta` como **propriedade derivada** no domínio, e não como terceiro campo
armazenado: guardar os três seria manter a mesma aritmética em dois lugares para divergirem depois.

### 11.4 O `next build` derrubou o servidor de desenvolvimento

Rodado com um `pnpm dev` no ar na porta 3000, o build sobrescreveu o `.next/` e o servidor passou a
devolver 500 (`Cannot find module './827.js'`). Não é defeito do projeto, e é armadilha de
ambiente: **não rodar `next build` com o `dev` ligado**, ou aceitar reiniciá-lo.

### 11.5 A `T-1710` fechou com zero linha, como previsto

A âncora diferencial de invariância dos artefatos da ESPEC 022 (`T-1601`/`T-1602`) cobre
`R-FON-13` sem alteração: esta espec não mexe em quantidade nenhuma. Confirmado por execução — as
duas continuam verdes.

É a segunda vez que a previsão se confirma; a `T-1533` do TASKS 021 fechou do mesmo jeito. O padrão
é: **verificar se a cobertura já existe antes de escrever uma segunda âncora com o mesmo
propósito.**

### 11.6 O contador da faixa não precisou de código

`R-FON-10` pede que o contador conte o que é exibido. Com a `V-REC-01` fora de `avisos`, a faixa
deixou de mencionar avisos no par PGM sem aditivo — e as divergências são contadas no **título da
própria seção** (*"Em 5 itens…"*), como as linhas derivadas já faziam.

A regra ficou satisfeita pela remoção, sem uma linha nova.
