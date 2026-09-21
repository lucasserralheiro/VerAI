# ESPEC 028 — A linha que não diz nada

| | |
|---|---|
| **Status** | **Implementada** — 2026-08-19. Backend 1.330 → **1.342 passed** (10 testes num módulo novo, 2 parametrizados no âncora por código), suíte verde em 12min30. **Seis** âncoras de documento reancoradas, com os dois deltas em voo provados em separado (§8.3) |
| **Versão** | 1.1 — 2026-08-20 — **emendada pela [ESPEC 031](031-o-zero-que-a-planilha-nao-escreveu.md)**. A `R-ZER-01` não muda uma vírgula; o **exemplo** do §1 é que evaporou, e a §1.1 diz por quê |
| **Depende de** | [ESPEC 018](018-o-relatorio-segue-o-contrato.md) `D-06` (o bloco final) e [ESPEC 024](024-o-asterisco-que-explica-o-bloco-final.md) (o asterisco e a nota) — as duas implementadas |
| **Revisa** | [ESPEC 018](018-o-relatorio-segue-o-contrato.md) `D-04` — *"nada mais é omitido"*. Passa a haver **uma** omissão, estreita e só de desenho: a linha do bloco final que não afirma quantidade nenhuma. O dado continua inteiro (`R-ZER-05`) |
| **Não toca** | `Contract.posicao_de`, `Contract.aplicar`, a `R-REL-06` (família `10.050`) e qualquer regra de **quais** códigos entram no bloco final. O critério de pertencimento é decisão fechada das ESPECs 018 e 022 |
| **Referência normativa** | `backend/tests/fixtures/contrato.pdf` + `levantamento.xlsx` (piloto — 4 itens no bloco final) e `contrato_pgm.pdf` + `aditivo_pgm.pdf` + `levantamento_pgm.xlsx` (13 sem o aditivo, 11 com ele) |
| **Origem** | Captura da faixa `DEMAIS ITENS DO LEVANTAMENTO*` do documento do piloto, com quatro linhas — três delas com `0` nas duas colunas de quantidade. O pedido: *"quando os itens presentes na aba de levantamento sem código correspondente na tabela de itens do contrato analisado tiver 0 na Quantidade Contratada e também 0 na Quantidade Medida não é necessário exibir a linha. Quando 0 for apenas em uma das duas colunas, então a linha deve ser exibida"* |

---

## 1. Problema

O bloco final existe desde a ESPEC 018 `D-06`, e desde a ESPEC 024 ele diz o que é. O que ele
não diz é por que traz linhas que não trazem nada.

No piloto são **três das quatro**:

| Código | Descrição | Contratada | Medida |
|---|---|---|---|
| `12.029.00001.00` | GESTAO DA INSTALACAO - 4096 A 155000 KBPS - SEM REDUNDÂNCIA (VIVO) | 0 | 0 |
| `14.049.00054.00` | HOSPEDAGEM DE APLICAÇÃO TIPO C - NÃO GERENCIADA - LINUX | 0 | **2** |
| `14.049.00004.00` | DISPONIBLIZACAO DE vCPU ADICIONAL | 0 | 0 |
| `14.024.00001.00` | ALTA PLATAFORMA - GRANDE PORTE (MAINFRAME) GB | 0 | 0 |

No PGM são **sete das treze** (seis das onze, com o aditivo aplicado).

Uma linha `0 / 0` no bloco final não é achado, não é cobrança e não é cobertura. O item está na
aba porque o catálogo o prevê, não porque algo lhe aconteceu no período. Ela não prova nem
desmente coisa alguma — e o documento em que ela aparece é a peça que vai ao órgão.

A `14.049.00054.00` é o contraste que fecha o argumento: `0 / 2` diz *"consumimos dois de um item
que o contrato analisado não conhece"*, e isso é exatamente o que o bloco final existe para
mostrar. Uma coluna zerada é informação; duas são ausência de assunto.

### 1.1 Emenda — aquele `0 / 2` não existia (ESPEC 031, 2026-08-20)

**O argumento acima continua inteiramente correto, e a `R-ZER-01` fica como está.** *"Uma coluna
zerada é informação; duas são ausência de assunto"* segue valendo, e nenhum teste desta espec mudou
de intenção.

O que caiu foi o **exemplo**. O `2` do `14.049.00054.00` vinha do bloco **bruto** de
`E1.1 - HOSPEDAGEM DE APLICAÇÃO`; a apuração descontada da mesma seção não lista o código, porque
descontado o desenvolvimento ele mede zero. O Confere lia a linha ausente como *"não há variante"*
em vez de *"mediu zero"* — defeito da `R-MED-02`, corrigido pela `R-APU-03`.

Com `0 / 0`, o item entra na própria `R-ZER-01` e sai do bloco final. **No piloto isso esvazia o
bloco**, e a `R-ZER-04` — que até aqui só tinha cenário construído (§8.1) — ganha o seu primeiro
caso real: somem faixa, asterisco e nota.

Fica o registro, e ele não é decorativo: esta espec escolheu, entre os quatro itens do bloco final
do piloto, **justamente o único que o sistema fabricava**, e foram precisos dois incrementos e uma
conferência manual de quem fatura para alguém perceber. É a razão de a `R-APU-08` da ESPEC 031
exigir registro visível para todo número inferido — um número sem rastro vira premissa de argumento
alheio, e foi o que aconteceu aqui.

## 2. O que foi levantado no código

### 2.1 Onde o bloco nasce

`GenerateMeasurementReport.executar`
([generate_measurement_report.py:120-124](../../backend/src/application/use_cases/generate_measurement_report.py#L120-L124))
manda para `relatorio.demais_itens` toda linha cujo código o contrato consolidado não posiciona.
Nada ali olha quantidade — nem deve: `posicao_de` responde *onde*, não *quanto*.

### 2.2 Onde ele é desenhado

`DocxRenderer._preencher` chama `_bloco_de_linhas` com o título de `layout.TITULO_DEMAIS_ITENS`
quando `relatorio.demais_itens` não é vazio, e `_rodape` escreve a nota de `R-NOT-02` sob a mesma
condição ([docx_renderer.py:242-246, 679-683](../../backend/src/infrastructure/report/docx_renderer.py#L242-L246)).
São **duas** condições sobre a mesma lista, escritas em pontos distantes um do outro — e é isso
que a `R-ZER-04` tem de manter em acordo quando a lista deixa de ser desenhada por inteiro.

### 2.3 Célula vazia não é zero

`ReportLine.contratada_declarada` (T-1272) guarda a distinção: a aba do PGM traz o
`14.046.00003.00` com a contratada em branco, e o renderizador escreve **célula vazia**, não `0`
([docx_renderer.py:368-371](../../backend/src/infrastructure/report/docx_renderer.py#L368-L371)).
Ausência de afirmação não é afirmação de nada.

Esse mesmo `14.046.00003.00` mostra por que a contagem tem de sair da linha emitida e não da
planilha: a medida dele não é numérica, a `R-REL-08` o trata como perfil e o emite `1 / 1`
(ESPEC 021). Na aba ele parece zerado; na linha, não é.

### 2.4 O que o modelo GRC fez com esses itens

Nenhum dos quatro códigos do bloco final do piloto aparece nas páginas de comprovação do
`modelo.pdf` — medido com `leitura_relatorio.ler_pdf`. Quem montou o relatório à mão **omitiu os
quatro**, inclusive o `0 / 2`.

A ESPEC 018 `D-04` reverteu essa omissão inteira de propósito, e continua certa: o `0 / 2` é
justamente o que o modelo escondia. Esta espec não volta ao comportamento do modelo — devolve ao
documento a economia que ele fazia **apenas** onde não havia o que mostrar.

### 2.5 Quem mais lê `demais_itens`

- `api/routers/reports.py:304` — o grid da tela, e o `total_linhas` que o `test_api_e2e` ancora em 58;
- `AnaliseDaMedicao.de_relatorio` — o `.xlsx` de análise, via `Report.todas_as_linhas`;
- `Report.divergentes` e `Report.sem_cobertura` — as leituras de conferência.

Todos existem para **conferir**, e conferir é o oposto de omitir. É o fato que decide a `D-01`.

## 3. Objetivo

Que o bloco final leve ao órgão apenas as linhas que afirmam alguma quantidade, e que tudo o mais
— dado, tela, análise e API — permaneça exatamente como está.

**Não é objetivo:** mudar quais códigos entram no bloco final, mexer no bloco ordenado pelo
contrato, ou fazer a omissão em qualquer camada que não seja o desenho do `.docx`.

## 4. Escopo

### 4.1 Dentro do escopo

- A linha do bloco final com `0` contratada e `0` medida deixa de ser desenhada no `.docx`.
- O asterisco do título e a nota do rodapé passam a acompanhar o bloco **exibido**.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| O bloco ordenado pelo contrato | `D-03` — ali o zero é resposta do contrato, não ausência de assunto |
| Grid, análise `.xlsx` e API | `D-01` — são instrumentos de conferência; o documento é que vai ao órgão |
| O texto da nota de `R-NOT-02` | `D-06`, com a pergunta registrada em `I-01` |
| Quais códigos caem no bloco final | Critério de negócio fechado (ESPECs 018 e 022) |
| Manual de utilização | Não menciona o bloco final até hoje — lacuna anterior, registrada como `I-02` da ESPEC 024 e não corrigida aqui |

## 5. Regras

| ID | Regra |
|---|---|
| `R-ZER-01` | No bloco final, a linha cuja quantidade contratada é `0` **e** cuja quantidade medida é `0` não é desenhada no `.docx`. Um zero só numa das duas colunas — nos dois sentidos, `0 / 2` e `5 / 0` — mantém a linha |
| `R-ZER-02` | A regra vale **apenas** para o bloco final. Nas linhas que o contrato ordena, `0 / 0` continua saindo |
| `R-ZER-03` | Quantidade contratada **não declarada** (célula vazia na aba, `contratada_declarada = False`) não é zero: a linha é exibida. Vale a distinção da T-1272 |
| `R-ZER-04` | Quando **todas** as linhas do bloco final são omitidas por `R-ZER-01`, o documento não traz a faixa, nem o asterisco de `R-NOT-01`, nem a nota de `R-NOT-02` — fica idêntico ao de um relatório sem bloco final |
| `R-ZER-05` | A omissão é do `.docx` e de mais nada. `Report.demais_itens`, `total_linhas`, o grid, o `.xlsx` de análise e a resposta da API permanecem com todas as linhas |
| `R-ZER-06` | O texto da nota de `R-NOT-02` não muda. A neutralidade da ESPEC 018 `D-06` e a explicação da ESPEC 024 seguem como estão |

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **A omissão mora no renderizador**, não no caso de uso | Filtrar em `executar` seria uma linha mais curta e levaria os itens embora da tela e da análise junto. §2.5: aquelas superfícies existem para conferir, e quem confere precisa ver que o item existe na aba. Encolhe a peça que vai ao órgão; não encolhe o dado |
| `D-02` | **O predicado é do domínio** (`ReportLine.sem_quantidade_alguma`); **a decisão de omitir é da apresentação** | *"Esta linha não afirma quantidade nenhuma"* é fato sobre a linha, e vale onde quer que ela seja lida. *"Logo, não desenhe"* é escolha de um documento específico. Separá-los deixa a regra testável sem gerar `.docx`, e deixa a decisão visível onde ela acontece |
| `D-03` | **Só o bloco final** | No bloco do contrato, `0 / 0` é o contrato respondendo *"este item existe e não foi consumido"* — some-la obrigaria quem confere a voltar ao PDF para descobrir que a resposta era zero. No bloco final não há contrato de onde a resposta viesse: o zero ali não afirma, apenas ocupa |
| `D-04` | **Célula vazia não entra na regra** (`R-ZER-03`) | Continuação da T-1272. Onde a aba nada afirma sobre o contratado não há dois zeros — há um zero e um silêncio. Errar por exibir é reversível; errar por omitir apaga o rastro de um dado que faltou |
| `D-05` | **O bloco exibido é calculado uma vez e passado ao rodapé** | O asterisco e a nota remetem a uma faixa que pode não existir mais (`R-ZER-04`). Recomputar a condição em cada ponto é como eles se separariam no dia em que a regra mudasse — e um asterisco órfão é pior do que não ter nota |
| `D-06` | **O texto da nota não muda** | A frase descreve *o que o bloco é*, e isso continua verdadeiro para cada linha que sobra. Dizer também *o que foi omitido* é decisão de conteúdo do documento, não consequência técnica desta regra — fica em `I-01` |

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `domain/entities/report.py` | `ReportLine.sem_quantidade_alguma` — propriedade nova, sem estado novo |
| `infrastructure/report/docx_renderer.py` | `_bloco_final(relatorio)` filtra; `_preencher` desenha o resultado e o passa a `_rodape`, que decide a nota por ele |
| `application/use_cases/generate_measurement_report.py` | Nenhuma (`D-01`) |
| `infrastructure/report/layout.py` | Nenhuma — nem título, nem nota, nem medida |
| `api/schemas.py` · `routers/reports.py` | Nenhuma (`R-ZER-05`) |
| `infrastructure/report/xlsx_analise_renderer.py` · `domain/entities/analysis.py` | Nenhuma (`R-ZER-05`) |
| `frontend/` | Nenhuma — o grid continua listando o bloco inteiro |

## 8. Testes e critério de aceite

### 8.1 As regras

| Regra | Verificação |
|---|---|
| `R-ZER-01` | `test_linhas_zeradas.py` — tabela-verdade de `sem_quantidade_alguma` e um documento construído em que só a linha `0 / 2` sobrevive. Nos pares reais, `test_anchor_por_codigo`: o piloto passa de 58 para **55** linhas e o PGM de 58 para **51**, com os códigos omitidos nomeados por extenso |
| `R-ZER-02` | Relatório construído com `0 / 0` em `relatorio.linhas`: a linha continua no documento |
| `R-ZER-03` | Caso `contratada_declarada = False` com medida `0` — a linha é exibida. **Só existe construído**: nenhum dos dois pares reais traz contratada em branco no bloco final (`I-03`) |
| `R-ZER-04` | Bloco final inteiro zerado — sem faixa, sem asterisco, sem nota; e o par simétrico, com uma linha sobrevivente, em que os três voltam |
| `R-ZER-05` | Nos dois pares reais: `relatorio.demais_itens` continua com os 4 e os 13 códigos nominais enquanto o `.docx` traz 1 e 6. `test_api_e2e` mantém `total_linhas == 58` sem alteração |
| `R-ZER-06` | Os testes de `R-NOT-01` e `R-NOT-02` da ESPEC 024 seguem verdes sem edição de texto |

### 8.2 Regressão

`test_docx_formatacao` volta a contar **55** células em lavanda — o mesmo número de antes da
ESPEC 018, por outro conjunto de códigos. A coincidência está registrada no teste para que
ninguém a leia como conferência.

### 8.3 As âncoras de documento, e como foram trocadas

Seis âncoras mediam o `.docx` e reprovaram: `CORPO_DO_PILOTO_*` em `test_capa.py`, as entradas
`word/document.xml` dos dois pacotes em `test_identidade_dos_artefatos.py`, o `.json` de 58 linhas
por par da `T-1507` em `test_linhas_derivadas.py` e a contagem no fim do teste de `.docx` válido em
`test_api_e2e.py`. **As duas últimas não estavam no inventário** e só apareceram na suíte completa
(TASKS 028 §9.6).

Havia **duas** mudanças de documento na árvore ao mesmo tempo — a correção da ESPEC 024 v1.1 (o
`*` inicial na nota) e esta espec —, e o TASKS 026 §9.10 registrara a regra que o caso criou:
reancorar exige delta provado **e** árvore parada. A troca esperou, e a prova foi feita em dois
passos, cada um desfazendo apenas a sua mudança:

| | Piloto | PGM |
|---|---|---|
| Ancorado (sem `*`, sem a 028) | `30b67025…` | `4e82a751…` |
| Com o `*`, sem a 028 | `84c4aadc…` | `b334b4cd…` |
| Com as duas — o valor de hoje | `ad68ff2a…` | `954b57f3…` |

Em nenhum dos dois passos outra entrada dos pacotes se moveu. No corpo do piloto, a aritmética
fecha nas duas contagens independentes: 16.029 → **16.017** textos, que são as 3 linhas omitidas
a 4 células cada — a unidade sai vazia, porque no bloco final não há contrato de onde tirá-la —,
e 79 → **76** códigos.

A âncora da `T-1507` fechou pelo mesmo método, e produziu a evidência mais legível da entrega: o
`.json` foi regravado **derivando-o do anterior** — removendo dele os códigos de `ZERADOS_DO_*` — e
o resultado bateu com a saída do renderizador nos dois pares. O `git diff` do arquivo tem **70
deleções e zero inserções**: nenhuma das 106 linhas restantes se moveu.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Alguém procurar no documento um item que a aba traz e não achá-lo | O item continua no grid, na análise e na API (`R-ZER-05`), e o que se perde é uma linha que não afirmava quantidade. É o custo aceito da decisão de origem |
| A omissão migrar para o caso de uso numa simplificação futura, levando os itens embora da tela | Teste dedicado em `test_anchor_por_codigo`: `relatorio.demais_itens` tem de continuar com os 4 e os 13 códigos nominais **enquanto** o documento traz menos |
| Asterisco órfão — título sem faixa, ou nota sem asterisco | `D-05` e o par de testes de `R-ZER-04`, nos dois sentidos |
| Reancorar às cegas as quatro constantes de documento | §8.3 — os dois deltas provados em separado, e a regra do TASKS 026 §9.10 aplicada em vez de contornada |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | A nota de `R-NOT-02` descreve o bloco como *"itens presentes na aba de levantamento sem código correspondente na tabela de itens do contrato analisado"*, e ele passa a trazer só **parte** deles. Vale acrescentar que os sem quantidade alguma foram omitidos? | Não. É decisão de conteúdo do documento, e o `D-06` mantém o texto até que ela seja tomada |
| `I-02` | O grid e o `.xlsx` de análise deveriam marcar visualmente as linhas que **não** foram ao documento, para que quem confere saiba o que o órgão não vai ver? | Não. Decide-se com uso real |
| `I-03` | Nenhum dos dois pares traz contratada em branco no bloco final: a `R-ZER-03` só é exercitada por cenário construído. Um terceiro par a exercitaria? | Não. A regra é a mesma da T-1272, que tem caso real no bloco do contrato |

## 11. Relação com a ESPEC 018

A `D-04` disse *"nada mais é omitido"* contra um estado em que a `R-DIV-05` deixava de fora
**todo** item sem previsão contratual — inclusive os que tinham medição, que eram o achado. Esta
espec não reabre aquela decisão: mantém no documento tudo o que afirma quantidade, e devolve à
omissão apenas o que não afirma nada.

O modelo GRC omitia os quatro; a ESPEC 018 trouxe os quatro; esta traz **o que dos quatro tem o
que dizer**.

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | `ReportLine.sem_quantidade_alguma` | PP |
| B | `_bloco_final` e as duas chamadas no `docx_renderer` | PP |
| C | Testes das seis regras, em módulo próprio | P |
| D | Reancoragem das quatro constantes de documento, com os dois deltas provados | P |

**Estimativa: menos de um dia.** A regra é aritmética sobre dado que já está na linha; o trabalho
de verdade está em D, e é trabalho de prova, não de código.