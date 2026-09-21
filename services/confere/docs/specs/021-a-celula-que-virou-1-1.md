# ESPEC 021 — A célula que virou 1/1

| | |
|---|---|
| **Status** | **Implementada, com um portão aberto** — 2026-08-18. Portões `P0` a `P4` fechados; **`P5` depende de pessoa** (T-1532). Suíte de backend 522 → **537**; navegador 88 testes, **as mesmas 10 falhas anteriores à entrega e nenhuma nova**. Emenda em §14 |
| **Versão** | 1.1 — 2026-08-18 — implementada. `R-PER-02` emendada na execução (§14.1) |
| **Depende de** | [ESPEC 002](002-painel-de-divergencias.md), [ESPEC 008](008-acessibilidade-da-interacao.md), [ESPEC 009](009-analise-da-medicao.md) e [ESPEC 018](018-o-relatorio-segue-o-contrato.md) — implementadas |
| **Revisa** | `V-REC-02` como achado de texto (ESPEC 018 §8.3). Ver `D-02`. E a linha do `V-REC-02` no manual (§2.6) |
| **Não toca** | `R-REL-08`. O que sai no documento continua sendo `1 / 1`. Esta espec muda o que se **vê sobre** o que saiu |
| **Referência normativa** | `backend/tests/fixtures/levantamento.xlsx` e `backend/tests/fixtures/levantamento_pgm.xlsx`, aba `Levantamento` |
| **Origem** | *"Não há como exibir exatamente como está na planilha de medidas? Uma planilha como: Descrição, Código, Quantidade Contratada, Quantidade Medida"* |

---

## 1. Problema

O par do PGM termina a geração com cinco linhas amarelas na tela:

```
V-REC-02  código 14.048.00009.00 tem medida não numérica ('F') — a linha sai como perfil/pacote, com 1 e 1
V-REC-02  código 14.046.00003.00 tem medida não numérica ('A') — a linha sai como perfil/pacote, com 1 e 1
V-REC-02  código 14.046.00008.00 tem medida não numérica ('A') — a linha sai como perfil/pacote, com 1 e 1
V-REC-02  código 14.025.00011.00 tem medida não numérica ('PACOTE') — a linha sai como perfil/pacote, com 1 e 1
V-REC-02  código 14.071.00007.00 tem medida não numérica ('PACOTE') — a linha sai como perfil/pacote, com 1 e 1
```

A mensagem está **correta**. Ela diz o código, diz o conteúdo da célula, diz o que o sistema
fez e por quê. Foi escrita na ESPEC 018 §14.6 com uma finalidade explícita e legítima: sem
ela, *"um `N/A` numa célula viraria `1 / 1` em silêncio"*.

O problema não é o conteúdo. É que **ela foi escrita para quem conhece o sistema**, e quem a lê
é quem confere faturamento. `V-REC-02` não é endereço de nada. *"Medida não numérica"* é a
descrição do mecanismo, não do que a pessoa precisa fazer. E `('F')` é a célula — mas não diz
**qual** célula, em que linha, ao lado de quê.

O pedido de origem é preciso e é a resposta certa: mostrar como está na planilha.

Esta espec acrescenta que a tabela pedida **não é uma reformatação da mensagem**. A §2 mostra
três fatos que a mensagem atual não conta, um deles registrado desde a ESPEC 001 como perda de
informação aceita e nunca exibido em lugar nenhum do produto.

---

## 2. O que foi medido

Leitura do código em `feature/evolucao` e execução do pipeline sobre os dois pares de fixtures.
Nada aqui é lembrança.

### 2.1 As cinco mensagens são o par do PGM, e o piloto tem quatro

| Par | Avisos | Composição | Linhas `1 / 1` |
|---|---:|---|---:|
| `contrato_pgm.pdf` + `levantamento_pgm.xlsx` | **10** | 5 `V-REC-01`, 5 `V-REC-02` | 5 de 58 |
| `contrato.pdf` + `levantamento.xlsx` (piloto) | **4** | 4 `V-REC-02` | 4 de 58 |

Confere com a ESPEC 018 §8.5. **No piloto, `V-REC-02` é o único aviso que existe**: a tela do
par piloto é, hoje, quatro frases amarelas e mais nada.

### 2.2 As mesmas linhas, como estão na aba

Lidas pelo `LevantamentoReader`, com o texto bruto de cada célula.

**PGM — `levantamento_pgm.xlsx`, aba `Levantamento`:**

| Linha | Código | Descrição na aba | Contratada | Medida | Sai |
|---:|---|---|:---:|:---:|:---:|
| 72 | `14.048.00009.00` | BANCO DE DADOS - SQL SERVER - PERFIL VI(F) - DE 1.000GB ATÉ 3.000GB | `F` | `F` | 1 / 1 |
| 73 | `14.046.00003.00` | BANCO DE DADOS - MYSQL - PERFIL I(A) - ATÉ 10GB | `-` | `A` | 1 / 1 |
| 74 | `14.046.00008.00` | BANCO DE DADOS - POSTGRESQL - PERFIL I(A) - ATÉ 10GB | `A` | `A` | 1 / 1 |
| 83 | `14.025.00011.00` | PLATAFORMA DE BI - MS SQL | `1` | `PACOTE` | 1 / 1 |
| 105 | `14.071.00007.00` | GERENCIAMENTO DE TECNOLOGIAS EM CAMADA INTERMEDIÁRIA (MIDDLEWARE) (GTCI) - M1 - DISPONIBILIZADAS NO TENANT DA PRODAM - ATÉ 1000 LICENÇAS CONTRATADAS | `1` | `PACOTE` | 1 / 1 |

**Piloto — `levantamento.xlsx`:**

| Linha | Código | Descrição na aba | Contratada | Medida | Sai |
|---:|---|---|:---:|:---:|:---:|
| 88 | `14.048.00008.00` | BANCO DE DADOS - SQL SERVER - PERFIL IV(D) - DE 200GB ATÉ 500GB | `D` | `C` | 1 / 1 |
| 89 | `14.046.00010.00` | BANCO DE DADOS - MYSQL - PERFIL II(B) - DE 10GB ATÉ 100GB | `B` | `B` | 1 / 1 |
| 98 | `14.025.00011.00` | PLATAFORMA DE BI - MS SQL | `2` | `PACOTE` | 1 / 1 |
| 114 | `14.070.00002.00` | GERENCIAMENTO DE CONSUMO DE NUVEM | `1` | `PACOTE` | 1 / 1 |

O número da linha é o da planilha: o leitor percorre a aba inteira com
`enumerate(linhas, start=1)`, e a aba é lida sem salto. **Já existe, e é gratuito.**

### 2.3 Três fatos que a mensagem de hoje não conta

#### `14.048.00008.00` — contratada `D`, medida `C`

É o **banco de dados contratado no perfil IV(D) e medido no perfil III(C)**: o caso que a
ESPEC 001 §9.3 registrou como perda de informação aceita, que a ESPEC 009 `R-PAN-06` transformou
na ressalva do painel — *"itens de perfil entram como 1/1 e não podem divergir"* — e que
**nunca foi exibido**.

A mensagem atual diz `tem medida não numérica ('C')`. Mostra o `C`. **Não mostra o `D` ao
lado**, que é a metade da informação que torna a linha interessante. As duas colunas lado a
lado exibem a divergência de perfil pela primeira vez no produto.

#### `14.025.00011.00` no piloto — contratada `2`, medida `PACOTE`

A célula da quantidade contratada traz o número **2** (inteiro, não texto). A linha sai `1 / 1`.
Um `2` que vira `1` sem que documento, grid, painel de análise ou mensagem digam uma palavra.

Não é defeito: `R-REL-08` manda a linha inteira sair `1 / 1`, e a regra existe porque pacote não
se conta. Mas é exatamente o tipo de coisa cuja **ausência** de exibição é indefensável num
documento que instrui faturamento.

#### `14.046.00003.00` — a célula contratada é `-`

Um hífen, não um número e não um vazio. O código aparece **uma vez** na aba e
`contratada_para` devolve `None`.

Fica a correção de precisão: o comentário de `report.py:32-37` (`T-1272`) afirma que a aba do
PGM *"traz o `14.046.00003.00` com a quantidade contratada **em branco**"*. Medido, a célula
contém `-`. A conclusão daquele comentário — *"é ausência de afirmação, não afirmação de que
nada foi contratado"* — fica **mais forte**, não mais fraca: alguém digitou o traço de
propósito. Só a descrição da célula estava imprecisa.

### 2.4 A descrição do contrato perde justamente o perfil

O relatório usa a designação **contratual** onde ela existe (`R-REL-07` / `D-08` da ESPEC 018),
e há boa razão para isso: são 34 descrições realmente diferentes em 57, e a aba carrega
metodologia de apuração dentro do texto.

Para estas linhas, a medição inverte o resultado:

| Código | O contrato diz | A aba diz |
|---|---|---|
| `14.048.00008.00` | `PLATAFORMA DE BANCO DE DADOS - SQL SERVER - PERFIL` | `BANCO DE DADOS - SQL SERVER - PERFIL IV(D) - DE 200GB ATÉ 500GB` |
| `14.046.00010.00` | `PLATAFORMA DE BANCO DE DADOS - MYSQL - PERFIL B - Base de dados acima de 10GB até 100GB` | `BANCO DE DADOS - MYSQL - PERFIL II(B) - DE 10GB ATÉ 100GB` |
| `14.025.00011.00` | `PLATAFORMA DE BI - MS SQL – SG0721` | `PLATAFORMA DE BI - MS SQL` |

A primeira linha decide a questão. A descrição contratual de `14.048.00008.00` **termina na
palavra `PERFIL`** — corta exatamente antes da letra. É a descrição do único item cuja letra
contratada difere da medida, e é a que não tem letra nenhuma.

Não é preferência: numa tabela cuja finalidade é fazer alguém reencontrar a célula na planilha,
a descrição certa é a que está **na planilha**. Ver `D-01`.

### 2.5 Hoje, essas linhas não estão em lugar nenhum útil da resposta

| Onde | Estão? |
|---|---|
| Grid de divergências (`divergencias`) | **Não.** `contratada == medida == 1`, logo `tem_divergencia` é falso. Medido: 0 das 4 no piloto, 0 das 5 no PGM |
| `demais_itens` | **Parcialmente.** 2 das 5 no PGM (`14.046.00003.00`, `14.071.00007.00`); 0 das 4 no piloto |
| Painel de análise | **Diluídas.** Caem em `SEM_DIVERGENCIA`: 4 entre 21 no piloto, 5 entre 31 no PGM. `perfis_ou_pacotes` conta quantas são, e a `R-PAN-06` avisa que existem — mas não diz **quais** |
| `LinhaDoGrid` | Traz `contratada` e `medida` já **formatadas**: `"1"` e `"1"`. O texto da célula não está ali |
| `Achado` | Quatro campos: `validacao`, `severidade`, `mensagem`, `codigo`. O texto da célula existe **só dentro da frase** |

O dado bruto sobrevive à leitura — `MeasurementItem.medida_texto` e `contratada_texto` existem
exatamente para isso, e o comentário no `measurement_item.py:18-20` diz por quê. Ele morre na
formatação da mensagem, em `_avisar_perfil`.

**A informação não precisa ser produzida. Precisa parar de ser descartada.**

### 2.6 O manual descreve um comportamento que não existe mais

`scripts/conteudo_do_manual.py:813-819`:

> | `V-REC-02` | Quantidade não numérica em item **que não é de perfil** | AVISA | A linha sai **zerada**. Verifique a célula correspondente na planilha |

As duas afirmações estão erradas desde a ESPEC 018: hoje toda linha não numérica é derivada
**como** perfil, e sai `1 / 1`, não zerada. Quem seguir o manual procura zeros que não existem.

Aberto o arquivo, o defeito é maior que a linha. A tabela do manual lista **10** validações:

| Situação | IDs |
|---|---|
| Já não existem (removidas pela ESPEC 018 §8.1) | `V-CTR-02`, `V-CAT-01`, `V-CAT-02`, `V-CAT-03` |
| Existem, texto **errado** | `V-REC-01` (*"o relatório usa a do contrato"* — revogado por `R-REL-04` / `D-05`), `V-REC-02` |
| Existem, texto certo | `V-CTR-01`, `V-CTR-03`, `V-MED-01`, `V-MED-02` |
| **Ausentes** do manual | `V-CTR-05`, `V-MED-03`, `V-ADT-01`, `V-ADT-02`, `V-ADT-03`, `V-ADT-04`, `V-CAP-01` |

Quatro linhas descrevem código que não existe, sete validações em produção não estão
documentadas, e duas mentem sobre o efeito. Esta espec corrige **a linha do `V-REC-02`**, que é
consequência direta do que ela muda. O resto é maior que ela — `I-22`.

---

## 3. Objetivo

Que as linhas que saem `1 / 1` por derivação sejam apresentadas **como estão na planilha**, numa
tabela com as colunas que quem confere já conhece, dizendo em que linha da aba estão e o que o
sistema fez com elas.

O alvo é a pessoa que abre a planilha em seguida. A tabela é boa se ela encontra a célula sem
que ninguém lhe explique o que é `V-REC-02`.

**Não é mudar o que sai.** O `.docx` vai ao órgão e continua dizendo `1 / 1`: `R-REL-08` está
intacta, e a decisão de negócio que a sustenta não é reaberta aqui.

---

## 4. Escopo

### 4.1 Dentro do escopo

- Tabela na tela, com linha da aba, código, descrição **da aba**, as duas quantidades **como
  estão na célula** e o que saiu no documento.
- Campo estruturado na resposta da API carregando esses dados.
- Fim da frase amarela do `V-REC-02` (`D-02`).
- Correção da linha do `V-REC-02` no manual (§2.6).

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Mudar o que sai no `.docx` | `R-REL-08` é decisão de negócio da ESPEC 018 `D-03`. O documento vai ao cliente; esta espec é sobre a conferência interna |
| Marcar as linhas derivadas no `.docx` | Mesma razão. O leitor do documento é o órgão, não quem confere |
| Aba nova no XLSX de análise | A análise é papel de trabalho e tem contrato próprio (`R-XLS-02`). Vale a pergunta, não a entrada de carona — `I-21` |
| **Avisar** quando o texto contratado difere do medido (`D` × `C`) | Seria validação nova, com ID, severidade e teste próprios. Esta espec **exibe**; decidir se aquilo é achado é outra decisão — `I-23` |
| Auditoria completa do manual (§2.6) | Quatro validações inexistentes e sete ausentes. É defeito de hoje, independente desta espec, e maior que ela — `I-22` |
| Reabrir `R-REL-07` (a descrição do documento vem do contrato) | A troca de fonte vale **para esta tabela**, e a razão é `D-01`. O documento não muda |

---

## 5. Regras

| ID | Regra |
|---|---|
| `R-PER-01` | Toda linha que sai `1 / 1` por derivação (`R-REL-08`) é apresentada numa **tabela própria**, com: número da linha na aba, código, descrição, quantidade contratada, quantidade medida e o que saiu no documento |
| `R-PER-02` | As duas quantidades são exibidas **como o leitor as entrega** — sem conversão a número, sem normalização adicional e sem vazio virando zero. `-`, `F`, `PACOTE` e `2` saem como estão (`D-03`). Emendada na implementação: ver §14.1 |
| `R-PER-03` | A descrição é a **da aba `Levantamento`**, não a do contrato (`D-01`). É a única das duas que carrega o perfil (§2.4), e é a que a pessoa vai reencontrar na planilha |
| `R-PER-04` | A tabela informa o **número da linha na aba**. É o endereço da célula; sem ele a conferência vira busca por código |
| `R-PER-05` | A ordem é a **da aba**, ascendente por número de linha — a ordem em que a planilha será percorrida. Não é a ordem do relatório: `R-REL-03` ordena pelo contrato, e essa ordem não serve a quem vai conferir células |
| `R-PER-06` | A tabela mostra também **o que saiu** (`1 / 1`), e não apenas a célula (`D-05`) |
| `R-PER-07` | A tabela é precedida de **uma frase** que diz o que aconteceu e o que fazer, sem sigla de validação e sem vocabulário do sistema |
| `R-PER-08` | `V-REC-02` **deixa de ser emitida como achado**. A informação passa a viajar estruturada, e a frase amarela some da tela (`D-02`) |
| `R-PER-09` | O contador de avisos da faixa de resultado passa a contar **o que é exibido**. No PGM ele cai de 10 para 5; no piloto, de 4 para nenhum |
| `R-PER-10` | A tabela só existe **quando há linha derivada**. Nenhuma tabela vazia, nenhuma seção dizendo "nenhum item" — o caso normal é não haver nada a mostrar |
| `R-PER-11` | Nada muda no `.docx` nem no `.xlsx`. `R-REL-08` intacta, `R-XLS-02` intacta |
| `R-PER-12` | A tabela obedece à régua da ESPEC 008 §13.4 como todo elemento novo: contêiner rolável focável (`R-ACE-05`), cabeçalhos com `scope`, e nada comunicado só por cor (`R-ACE-02`) |

---

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **A descrição vem da aba**, contrariando `R-REL-07` só nesta tabela | Decidido pelo negócio e confirmado pela medição — as duas concordam, o que é raro o bastante para registrar. A §2.4 mostra a descrição contratual de `14.048.00008.00` terminando na palavra `PERFIL`, cortada antes da letra, justamente no único item cujo perfil contratado difere do medido. Uma tabela que existe para levar alguém até a célula tem de falar a língua da planilha |
| `D-02` | **`V-REC-02` sai de `avisos`**, em vez de continuar sendo emitida e ser filtrada na tela | Precedente direto: `R-REL-13` da ESPEC 018 fez isso com `V-CTR-04` — *"continua sendo medida, deixa de ser apresentada"*. Aqui é mais forte, porque a informação não é descartada e sim **promovida**: de uma frase para um registro com seis campos. A alternativa — manter o achado e filtrar por `validacao === "V-REC-02"` no componente — põe o identificador de uma validação de backend dentro de uma condicional de React, e deixa o mesmo fato na resposta duas vezes, em duas formas, para divergirem depois. **Custo assumido:** quatro asserções de teste usam a contagem de `V-REC-02` como canário e precisam mudar de âncora (§8.2) |
| `D-03` | **O texto do leitor, sem tratamento adicional** | Mostrar o `-` do `14.046.00003.00` como `0`, ou como célula vazia, seria repetir na tela exatamente o apagamento que a tabela existe para desfazer. O valor da coluna é ser o que está lá |
| `D-04` | **O número da linha vem do leitor**, não de uma contagem nova | `MeasurementItem.linha` já é o número real da linha do Excel: a aba é lida inteira e enumerada a partir de 1, sem salto. Zero custo, e a alternativa — recontar — criaria uma segunda numeração para divergir da primeira |
| `D-05` | **A coluna do que saiu fica** | Sem ela, a tabela é um extrato da planilha e o leitor tem de lembrar o que o sistema fez. Com ela, a dedução do sistema fica ao lado do dado que a originou, exposta ao julgamento de quem confere. É a coluna que transforma exibição em conferência |
| `D-06` | **Os valores emitidos são derivados da `ReportLine` construída**, não escritos como `"1 / 1"` na tela | `R-REL-08` é regra de domínio. Repetir o `1` no componente é a mesma decisão em dois lugares, e no dia em que a regra mudar a tela mentirá sem que nada acuse. A formatação segue onde já está — no backend, como `LinhaDoGrid` faz e pela mesma razão |
| `D-07` | **A tabela ocupa o lugar do bloco amarelo** — depois do grid de divergências | A ordem de leitura da tela é decisão da ESPEC 009 `R-PAN-01`: gravidade, depois seções. Estas linhas são, por construção, *sem divergência*: são a **ressalva** à conformidade, e ressalva vem depois do que ela ressalva. É também onde a pessoa já está acostumada a encontrá-las. **A âncora saiu; a decisão fica** — ESPEC 038 `D-05`: o bloco âmbar subiu para junto da faixa de resultado, e a tabela **não se moveu**. *"O lugar do bloco amarelo"* era marco geográfico, não decisão sobre ele, e a `R-AVI-06` preserva a posição que esta decisão quis |
| `D-08` | **O campo se chama `linhas_derivadas`**, e não `perfis` ou `pacotes` | *Perfil* e *pacote* são o que o sistema **concluiu**; *derivada* é o que ele **fez**. O nome que descreve a inferência é o que impede tratá-la como fato — e a §2.3 mostra uma linha (`D` × `C`) em que a inferência apaga uma diferença real |

---

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `domain/entities/report.py` | **Novo** `LinhaDerivada` (frozen): `linha_na_aba`, `codigo`, `descricao`, `contratada_texto`, `medida_texto` e a `ReportLine` emitida (`D-06`) |
| `application/use_cases/generate_measurement_report.py` | `_avisar_perfil` **sai** (`D-02`). `_montar_linha` acumula a `LinhaDerivada` no mesmo padrão de acumulador que `achados` já usa. `ReportResult` ganha `derivadas: tuple[LinhaDerivada, ...] = ()` — com padrão, porque o caminho bloqueado devolve `relatorio=None` antes do laço |
| `api/schemas.py` | `LinhaDerivada` (Pydantic) e `linhas_derivadas: list[LinhaDerivada]` em `RespostaRelatorio`. **`RespostaBloqueada` não muda**: o laço que deriva linhas roda depois do `if achados.bloqueado`, então o caminho bloqueado nunca teve `V-REC-02` e não terá linha derivada |
| `api/routers/reports.py` | Uma função de conversão ao lado de `_linha`, com as quantidades emitidas já formatadas |
| `frontend/src/lib/types.ts` | O tipo espelho e o campo novo em `RespostaRelatorio` |
| `frontend/src/app/components/LinhasDerivadas.tsx` | **Novo.** A tabela, nos moldes de `DivergenciaGrid` — que já resolve rolagem, foco e cabeçalhos |
| `frontend/src/app/components/ResultadoPanel.tsx` | A tabela entra onde o bloco amarelo estava (`D-07`). `ListaDeAchados` **não muda**: ela deixa de receber `V-REC-02` porque ele não vem mais, não porque ela filtra |
| `frontend/src/app/components/AnaliseMedicaoPanel.tsx` | **Nenhuma.** A ressalva `R-PAN-06` continua exata, e agora tem para onde apontar |
| `scripts/conteudo_do_manual.py` | A linha do `V-REC-02` (§2.6) |
| `infrastructure/report/` · `docx_renderer` · `layout` · XLSX | **Nenhuma** (`R-PER-11`) |

Os dublês de resposta em `e2e/estados.ts:47` e `e2e/anuncio.spec.ts:79` são `RespostaBloqueada`
(422) e **não precisam do campo novo**. O dublê de `situacaoVazia` parte da resposta real e o
recebe de graça.

Esboço da acumulação, para fixar a forma e não a sintaxe:

```python
# `R-PER-05` — o laço de `executar` percorre `medicao.codigos_em_ordem`, que é a
# ordem da aba. Acumular aqui devolve a ordem da planilha sem ordenação alguma;
# a ordenação por posição do contrato acontece depois, e só sobre `linhas`.
if item.medida is None:
    emitida = ReportLine(..., perfil_ou_pacote=True)
    derivadas.append(
        LinhaDerivada(
            linha_na_aba=item.linha,
            codigo=codigo,
            descricao=item.descricao,      # D-01 — a da aba, não a do contrato
            contratada_texto=item.contratada_texto,
            medida_texto=item.medida_texto,
            emitida=emitida,
        )
    )
    return emitida
```

---

## 8. Testes e critério de aceite

### 8.1 Backend — `tests/test_linhas_derivadas.py` (novo)

| Regra | Verificação |
|---|---|
| `R-PER-01` | Piloto: **4** linhas derivadas. PGM: **5**. Iguais à contagem de `perfil_ou_pacote` do relatório — nenhuma linha `1 / 1` fora da tabela, nenhuma entrada sem linha `1 / 1` |
| `R-PER-02` | O `14.046.00003.00` do PGM chega com `contratada_texto == "-"`. **Não** `""`, **não** `"0"`. É a asserção que trava `D-03`, e é a que falha se alguém "melhorar" a coluna |
| `R-PER-02` | O `14.048.00008.00` do piloto chega com `"D"` e `"C"` — os dois, e nessa ordem. É o caso da ESPEC 001 §9.3 |
| `R-PER-03` | A descrição do `14.048.00008.00` contém `PERFIL IV(D)`. A do contrato termina em `PERFIL` (§2.4): asserir o sufixo distingue as duas fontes, asserir o prefixo não |
| `R-PER-04` | Piloto: linhas `88, 89, 98, 114`. PGM: `72, 73, 74, 83, 105` |
| `R-PER-05` | A sequência sai **ascendente** nos dois pares, sem ordenação explícita no código |
| `R-PER-06` | As quantidades emitidas são `1` e `1` nos nove casos |
| `R-PER-08` | `V-REC-02` **não aparece** em `achados.avisos` em nenhum dos dois pares. No piloto, `avisos == []` |

### 8.2 Regressão — as quatro asserções que mudam de âncora

`D-02` tira o canário de quatro testes. Todas continuam provando o que provavam; a âncora passa
de `V-REC-02` para `linhas_derivadas`:

| Onde | Hoje | Passa a ser |
|---|---|---|
| `test_api_e2e.py:244` | `{a["validacao"] …} == {"V-REC-02"}` | `avisos == []` **e** `len(corpo["linhas_derivadas"]) == 5` |
| `test_api_e2e.py:263` | `… == {"V-REC-01", "V-REC-02"}` | `… == {"V-REC-01"}` **e** `len(corpo["linhas_derivadas"]) == 5` |
| `test_consolidacao_aditivos.py:380` | `count("V-REC-02") == 5` e `len(validacoes) == 5` | `avisos == []` **e** `len(derivadas) == 5` |
| `test_consolidacao_aditivos.py:459` | `[…] == ["V-REC-02"] * 4` | `avisos == []` **e** `len(derivadas) == 4` |

O caso do `:380` merece atenção: aquele teste prova que **`V-REC-01` calou porque o aditivo o
explica**, e os cinco `V-REC-02` serviam de prova de que o pipeline não tinha simplesmente
emudecido. Trocar por `avisos == []` sem mais nada **destrói a contraprova**. A segunda asserção
não é redundância: é o canário mudando de galho.

### 8.3 Regressão — o que não pode mudar

| Verificação | Critério |
|---|---|
| `.docx` dos dois pares | **58 linhas nos dois**, e os testes de `test_docx_estrutura.py` e `test_docx_formatacao.py` passam sem alteração (`R-PER-11`) |
| `.xlsx` de análise | Inalterado. `analise_referencia.xlsx` continua servindo de âncora |
| Painel de análise | `SEM_DIVERGENCIA` com `perfis_ou_pacotes` **4** no piloto e **5** no PGM. A `R-PAN-06` continua exibida |
| `total_linhas`, `total_divergencias`, `demais_itens` | 58 / 37 / 4 no piloto; 58 / 27 / 13 no PGM |
| `tsc --noEmit` · `next lint` · `next build` | Limpos |

### 8.4 Playwright — `e2e/derivadas.spec.ts` (novo)

| Regra | Verificação |
|---|---|
| `R-PER-01` | Com o par piloto, a tabela existe e tem **4** linhas de corpo |
| `R-PER-08` | A cadeia `V-REC-02` **não ocorre em lugar nenhum da tela**. É a asserção literal do pedido de origem, e a que falha se o achado voltar |
| `R-PER-10` | Nenhum dos estados montados por `estados.ts` renderiza tabela vazia |
| `R-PER-12` | `axe` sem violações A/AA nas duas larguras que a ESPEC 008 §14.3 tornou obrigatórias (1366 e 390) |

Atenção ao texto da frase de `R-PER-07`: pela emenda §14.4 da ESPEC 015, **qualquer texto novo
de tela que contenha a sequência "relatório gerado" derruba sete suítes** em modo estrito, e a
mensagem de erro não diz isso — diz *"strict mode violation"*.

### 8.5 Portões

| ID | Portão | Fecha quando |
|---|---|---|
| `P1` | **Alguém do faturamento acha a célula** | Uma pessoa que nunca ouviu falar de `V-REC-02` recebe a tela, abre a planilha e chega às cinco células sem que ninguém explique nada. É o único portão que mede o objetivo desta espec, e nenhum teste automatizado o substitui |
| `P2` | **O `D` × `C` fica visível** | Gerado o par piloto, a tabela mostra `D` e `C` lado a lado no `14.048.00008.00`. É a primeira vez que a perda declarada na ESPEC 001 §9.3 aparece no produto, e é a prova de que a tabela é mais do que a mensagem reformatada |

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| **A tabela virar mais uma tabela na tela**, ignorada como as frases amarelas eram | `R-PER-10` — ela só existe quando há o que mostrar, e o caso normal é não haver. `R-PER-07` diz o que fazer, não o que aconteceu. E ela tem 4 ou 5 linhas, não 58 |
| **Alguém normalizar a coluna crua** — trocar `-` por `0`, ou o vazio por traço, "para ficar bonito" | `R-PER-02` como regra e a asserção do `-` em §8.1, que falha alto. É o defeito mais provável desta entrega, porque parece um acabamento |
| **A contagem de avisos cair e parecer que algo sumiu** | `R-PER-09`. No piloto o bloco amarelo desaparece por inteiro — de quatro frases para nenhuma —, e é a mudança visível mais brusca da espec. Se a tabela não estiver claramente no lugar, a tela parecerá ter perdido informação |
| **Perder `V-REC-02` como rastro de auditoria** | `D-02` assume. O identificador continua nas especs e no manual como registro histórico, e a informação que ele carregava fica **mais completa**. O que se perde é a contagem de achados como canário — daí §8.2 mover o canário, e não apenas apagá-lo |
| **A descrição longa quebrar o layout** | O `14.071.00007.00` tem 148 caracteres. O `DivergenciaGrid` já convive com descrições assim, e é dele que a tabela herda a rolagem horizontal e o `tabIndex` do contêiner (`R-ACE-05`) |
| **O `1 / 1` ser escrito à mão no componente** | `D-06`. Uma constante de domínio duplicada em TypeScript é a forma mais barata de a tela passar a mentir sem que nada acuse |
| **`R-REL-08` parecer reaberta** | Não é, e o cabeçalho diz isso. Se a discussão sobre o que sai no documento voltar, ela volta como espec própria — esta só torna visível o que já acontece |

---

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-21` | As linhas derivadas merecem aba própria no XLSX de análise? Ele é o papel de trabalho, e é o que sai da tela para o e-mail | Não. §4.2. Decide-se depois de `P1`: se a tabela na tela bastar, a aba é peso morto |
| `I-22` | **O manual precisa de auditoria completa.** Quatro validações documentadas não existem, sete em produção não estão documentadas, duas mentem sobre o efeito (§2.6) | Não bloqueia esta espec — mas é defeito **de hoje**, e maior que ela. Deveria virar espec ou tarefa própria antes da próxima entrega ao usuário |
| `I-23` | Contratado `D` e medido `C` deveria ser **achado**, e não só coluna? Hoje nada avisa; a `R-PAN-06` diz que a diferença *pode* existir, e a tabela passará a mostrar que ela **existe** num item real | Não. Vira validação nova (`V-REC-03`?), com severidade e teste próprios. Registrado agora porque a §2.3 é o que torna a pergunta respondível: até aqui ninguém tinha o dado à vista |
| `I-24` | A comparação de `I-23` é confiável? `D` × `C` é claro; `PACOTE` × `1` não é comparável, e `F` × `F` é igualdade de letra, não prova de perfil correto. As formas variam entre planilhas | Não. É o que impede `I-23` de ser trivial, e é por isso que ele não entrou de carona aqui |

---

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | `LinhaDerivada` no domínio e a acumulação no caso de uso; `_avisar_perfil` sai | PP |
| B | Schema, conversão no router e o campo na resposta | PP |
| C | `test_linhas_derivadas.py` e as quatro âncoras de §8.2 | P |
| D | `LinhasDerivadas.tsx` e a troca no `ResultadoPanel` | P |
| E | `derivadas.spec.ts` e a varredura `axe` | P |
| F | A linha do `V-REC-02` no manual | PP |
| G | `P1` e `P2` | PP |

**Total: um dia.** O que torna barato é a §2.5: nenhum dado novo é produzido, nenhuma leitura a
mais é feita, nenhuma regra de negócio é decidida. Move-se informação que já existe de dentro de
uma frase para dentro de um registro.

O que exige atenção é a fase C. As quatro asserções de §8.2 são o tipo de mudança que se faz
apagando a linha vermelha, e uma delas — `test_consolidacao_aditivos.py:380` — perde a
contraprova se for apagada em vez de reancorada.

---

## 12. Relação com as especs anteriores

### 12.1 ESPEC 018 `R-REL-08` — intacta

A derivação continua idêntica: medida não numérica é perfil ou pacote, e sai `1 / 1`. Esta espec
não muda o que o sistema faz; muda o que ele **conta** sobre o que fez. A distinção importa
porque `R-REL-08` é decisão de negócio (`D-03` daquela espec) e não está sendo reaberta.

### 12.2 ESPEC 018 `R-REL-13` — o precedente de `D-02`

> `V-CTR-04` continua sendo medida, deixa de ser apresentada.

É a mesma forma, com um argumento a mais: ali a validação sumiu da tela e sobreviveu num
diagnóstico interno; aqui ela sai da lista de achados porque o que ela dizia passa a ser dito
melhor, no mesmo payload, com seis campos em vez de uma frase.

### 12.3 ESPEC 018 §14.6 — a razão da `V-REC-02` é preservada

> Sem ela, um `"N/A"` numa célula viraria `1 / 1` em silêncio.

Continua verdadeira, e continua sendo o motivo de existir alguma coisa aqui. A tabela cumpre a
mesma função com mais precisão: além de dizer que houve derivação, diz **em que linha da
planilha** e **ao lado de que quantidade contratada**.

### 12.4 ESPEC 009 `R-PAN-06` — a ressalva ganha destino

> `N` desses itens são de perfil ou pacote — entram sempre como 1/1, então a diferença de perfil
> não aparece nas quantidades. Igualdade aqui não é conferência bem-sucedida.

A frase está certa e continua. Ela sempre terminou sem saída: dizia que a diferença *não
aparece*, e não havia onde ela aparecesse. Passa a haver.

### 12.5 ESPEC 001 §9.3 — a perda declarada passa a ser visível

A perda de informação dos itens de perfil foi **declarada e aceita** desde o MVP, com o
`14.048.00008.00` nomeado como exemplo. Vinte especs depois, ela nunca esteve na tela. `P2`
fecha isso.

### 12.6 ESPEC 008 §13.4 — a régua vale para a tabela nova

Toda espec que acrescenta elemento ou estado herda as regras de acessibilidade da 008.
`R-PER-12` é essa herança, e `e2e/derivadas.spec.ts` é onde ela é verificada.

---

## 14. Emendas da implementação — 2026-08-18

### 14.1 `R-PER-02` prometia mais do que o leitor entrega

A regra dizia *"texto **bruto** da célula"*. Lido o `levantamento_reader.py`, o que existe é o
texto **normalizado na leitura**, pela `_texto()`:

- células de texto chegam com `.strip()` aplicado;
- células numéricas chegam como texto **pt-BR** — o `2` da linha 98 e os três `1` são inteiros no
  XLSX e chegam `"2"` e `"1"`; um `1.0` chegaria `"1,0"`. A conversão existe desde o MVP e tem
  motivo forte, registrado no próprio arquivo: repassar `762.55` cru faria o conversor pt-BR ler
  76.255, *"um erro de duas ordens de grandeza que passaria despercebido"*;
- uma data chegaria `dd/mm/aaaa`.

**Para as nove células medidas não muda nada**, e a T-1501 provou isso contra as duas planilhas:
o que se lê na tela do Excel e o que o leitor devolve coincidem, caractere por caractere, nas
quatro do piloto e nas cinco do PGM.

A emenda existe para impedir a leitura literal. Quem lesse *"bruto"* poderia concluir que precisa
**abrir a planilha outra vez** para pegar o valor sem tratamento — uma segunda leitura do arquivo,
com uma segunda chance de divergir da primeira.

A regra não enfraquece: o que ela proíbe — `para_decimal`, `or 0`, substituir vazio — continua
proibido. `D-03` mudou de título pelo mesmo motivo.

---

## 13. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.1 | 2026-08-18 | **Emenda de implementação** (§14.1): `R-PER-02` deixa de prometer *"texto bruto da célula"* e passa a dizer *"como o leitor as entrega"*. Levantada no PLANO 021 §6 e aplicada na T-1502, com o portão `P0` fechado pela T-1501 |
| 1.0 | 2026-08-18 | Redação inicial. Começou como *"trocar cinco frases por uma tabela"* e cresceu ao medir as células: o `D` × `C` do `14.048.00008.00` e o `2` → `1` do `14.025.00011.00` mostraram que a tabela **acrescenta** informação em vez de reformatá-la, e a descrição contratual truncada em `PERFIL` decidiu sozinha a `D-01`. A auditoria do manual (§2.6) apareceu de carona e ficou fora do escopo por ser maior que a espec |
