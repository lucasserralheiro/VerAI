# ESPEC 019 — Aditivos: o que entra e o que sai da proposta

| | |
|---|---|
| **Status** | **Implementada** — 2026-08-17. Fases A a F. Suíte 411 → 488, sem regressão. Emendas de execução em §14 |
| **Versão** | 2.2 — 2026-08-14. A 1.0 somava quantitativos; a 2.1 acrescentou `V-ADT-04`; a 2.2 achou a exclusão no `ANEXO II`. Ver §13 |
| **Depende de** | [ESPEC 017](017-grade-do-contrato-derivada-do-documento.md) e [ESPEC 018](018-o-relatorio-segue-o-contrato.md) — implementadas |
| **Revisa** | `R-GRD-02` (uma geometria por documento, escolhida por `max`), `R-GRD-01` (uma tabela de itens por documento), `R-REL-10` (*"dois arquivos, e só"*) e `R-CTR-05` (a proposta do rodapé). Ver `D-04`, `D-05`, `D-09` e `D-10` |
| **Responde** | `I-05` da ESPEC 018 — *"houve aditivo depois de 11/11/2025?"*. **Houve**, e §2.7 mostra o que ele explica |
| **Referência normativa** | `docs/documentos/PMG/PA-PGM-251015-159 v5.0.pdf`, `docs/documentos/PMG/PA-PGM-260304-715 - Q-00715-5_aditivo.pdf`, `docs/documentos/PMG/PGM_TC 015_Levantamento_06008_TC 015PGM2024_23072026_095059_V1.0.xlsx` e `docs/documentos/PA-SMIT-260319-739 Q-00739-7.pdf` |
| **Origem** | Uma proposta comercial pode ter aditivos. O `TC 015/PGM/2024` tem o `PA-PGM-251015-159 v5.0` **mais** o `PA-PGM-260304-715`, e a aplicação lê só o primeiro |

---

## 1. Problema

Uma proposta comercial pode ter aditivos, e a aplicação recebe um PDF só.

O que um aditivo muda, **para este trabalho**, é estreito e precisa ser dito com precisão. Desde a
ESPEC 018 `D-05`, o relatório não usa valor nem quantitativo do contrato: as duas quantidades vêm da
aba `Levantamento` (`R-REL-04`). O que o contrato ainda fornece é

- a **ordem** das linhas (`R-REL-03`),
- a **descrição** e a **unidade** de cada linha (`R-REL-07`),

e as três coisas dependem de uma só pergunta: **quais códigos a proposta contém**.

Logo, um aditivo importa quando **inclui ou exclui item**. Quando ele apenas aumenta ou reduz
quantidade, não muda nada que este relatório use.

Os aditivos declaram isso em blocos rotulados — `Inclusão`, `Exclusão`, `Aumento`, `Redução` —,
cada um com a sua tabela. **Os dois primeiros são operativos aqui; os dois últimos são ruído**, e
tratá-los como dado seria trazer de volta um quantitativo que a ESPEC 018 já decidiu não usar.

Há ainda um defeito que precede tudo isso: **submetido hoje ao extrator, o aditivo do PGM devolve
zero itens e nenhum erro** (§2.3). Sem consertar isso, não há inclusão nem exclusão a aplicar.

---

## 2. O que foi medido

Tudo nesta seção foi lido dos arquivos reais com o código de produção em `backend/src/`. Nada é
suposto, nada vem de execução anterior.

### 2.1 As peças

| | contrato PGM | aditivo PGM | piloto SMIT |
|---|---|---|---|
| arquivo | `PA-PGM-251015-159 v5.0` | `PA-PGM-260304-715` | `PA-SMIT-260319-739` |
| páginas | 32 | 10 | 32 |
| `Proposta de Aditivo:` | `PA-PGM-251015-159` | `PA-PGM-260304-715` | `PA-SMIT-260319-739` |
| `Proposta #:` | `Q-00518-5` | `Q-00715-5` | `Q-00739-7` |
| contrato citado | `Nº 15/PGM/2024` | `Nº 15/PGM/2024` | `Nº 52/SMIT/2024` |
| **itens lidos hoje** | **47** | **0** | **60** |

### 2.2 O rótulo do bloco está na linha `TOTAL:`, dentro da grade

Cada bloco encerra com uma linha `TOTAL:` que **carrega o seu rótulo**. Lida pelo
`ler_celulas` de produção:

```
CONTRATO PMG   pag25   ['', '', '', '', 'Aumento',  'TOTAL:', 'BRL 24.551.037,72']
ADITIVO  PMG   pag6    ['', '', '', '', 'Aumento',  'TOTAL:', 'BRL    884.902,44']
ADITIVO  PMG   pag6    ['', '', '', '', 'Redução',  'TOTAL:', 'BRL   -897.734,40']
ADITIVO  PMG   pag7    ['', '', '', '', 'Inclusão', 'TOTAL:', 'BRL     12.831,84']
PILOTO  SMIT   pag29   ['', '', '', '', '',         'TOTAL:', 'BRL 10.637.425,00']
```

Não é preciso ler prosa nem casar título de seção com tabela: o rótulo chega pela mesma grade que
já traz os itens. Particionando os itens pelo `TOTAL:` que os encerra:

| documento | blocos | itens |
|---|---|---|
| contrato PGM | `Aumento` | 47 |
| **aditivo PGM** | **`Aumento`** · **`Redução`** · **`Inclusão`** | **4 · 1 · 2** |
| piloto SMIT | *(sem rótulo)* | 60 |

O rótulo pode cair numa célula (`'Aumento TOTAL:'`) ou em duas (`'Aumento'` + `'TOTAL:'`),
conforme a geometria que leu a linha — o reconhecimento tem de ser sobre a linha inteira, não sobre
uma coluna fixa.

### 2.3 O extrator lê zero itens do aditivo, e não reclama

```
ADITIVO PA-PGM-260304-715
  gabarito: None
  diagnóstico: 10 páginas, 3 com borda desenhada, 10 com texto,
               no máximo 15 divisórias verticais numa página
  itens: 0        total_declarado: None
```

`R-GRD-02` procura páginas com **exatamente oito** divisórias verticais. No aditivo não existe
nenhuma:

| página | divisórias | o que há na página |
|---|---|---|
| 6 | **11** | tabela `Aumento` **e** tabela `Redução` |
| 7 | **15** | tabela `Inclusão` **e** o Cronograma Físico Financeiro |

A regra pressupõe *uma tabela de itens por página*. **Um aditivo viola isso por construção**: é
justamente o documento que traz vários blocos curtos, e blocos curtos partilham página.

O contrato do PGM tem o mesmo problema na página 25 — 15 divisórias, tabela de itens dividida com o
cronograma —, e escapa porque as páginas 22 a 24 têm oito e é delas que o gabarito sai. **O aditivo
não tem essa página de sobra**: nenhuma das suas três tabelas ocupa uma página sozinha.

### 2.4 As três tabelas do aditivo são legíveis — com três geometrias distintas

Cada linha da tabela é desenhada como oito traços verticais partilhando o mesmo par `(topo, base)`.
Agrupando os traços **por faixa** antes de contar, as tabelas aparecem separadas:

| tabela | página | geometria (8 divisórias) | itens |
|---|---|---|---|
| `Aumento` | 6 | `53,2 · 126,7 · 272,2 · 354,0 · 408,0 · 449,2 · 496,5 · 561,0` | 4 |
| `Redução` | 6 | `53,2 · 127,5 · 274,5 · 354,0 · 408,0 · 449,2 · 497,2 · 561,0` | 1 |
| `Inclusão` | 7 | `53,2 · 126,7 · 274,5 · 355,5 · 408,7 · 450,0 · 496,5 · 561,0` | 2 |
| *cronograma* | 7 | `34,5 · 108,7 · 183,0 · 263,2 · 338,2 · 412,5 · 486,7 · 561,0` | **0** |

**As três são realmente distintas**, não variações dentro da tolerância: `272,2` contra `274,5` são
2,3 pt e `354,0` contra `355,5` são 1,5 pt — ambas fora de `TOLERANCIA = 1,5`. Um gabarito único
não lê as três.

Alimentando `montar_grade` / `ler_celulas` **de produção** com cada uma, as sete linhas saem
completas. O bloco que interessa:

```
Inclusão   14.071.00006.00  UN           BRL 217,81   5,00   8   BRL  8.712,40
           14.071.00007.00  SERVIÇO/MÊS  BRL 514,93   1,00   8   BRL  4.119,44
                                                Inclusão TOTAL:   BRL 12.831,84
```

### 2.5 Varrer toda geometria de oito divisórias produz lixo

Medido antes de propor: aceitando **toda** geometria de oito divisórias, a do cronograma seria
aplicada às páginas de itens e leria linhas malformadas — quantidade e período colados numa célula:

```
CONTRATO PMG   geometria do cronograma → 5 linhas com código, 0 completas
   14.049.00060.00  [… 'PLANO/MÊS', 'BRL 359,59', '10,00 12', 'BRL 43.150,80']
PILOTO SMIT    geometria do cronograma → 6 linhas com código, 0 completas
   15.076.00002.00  [… 'FAIXA/MÊS',  'BRL 277,60', '1 12',     'BRL 3.331,20']
```

O discriminador de `R-GRD-02` — *onde estão os códigos de serviço* — **tem de sobreviver**; o que
muda é que ele deixa de eleger uma geometria e passa a filtrar as que servem (`D-05`).

### 2.6 O rótulo não diz se a tabela é escopo inteiro ou delta — o papel diz

Medição que impede o erro mais fácil desta espec:

- O bloco único do **contrato** do PGM é rotulado **`Aumento`** e vale `BRL 24.551.037,72` — o
  **contrato inteiro**, não um acréscimo.
- O bloco único do **piloto** SMIT **não tem rótulo** e vale `BRL 10.637.425,00` — idem.

Uma regra do tipo *"ignore todo bloco `Aumento`"* aplicada indistintamente **zeraria o contrato do
PGM**. O que separa não é o rótulo: é o papel da peça, e o papel vem do campo em que ela foi
submetida (`D-03`, `D-11`).

### 2.7 O piloto confirma que a tabela da proposta já é o escopo resultante

A página 1 do `PA-SMIT-260319-739` declara, em prosa:

```
Exclusão dos itens:
  12.030.00002.00 - CONEXÃO INTERNET COM 50% DE BANDA GARANTIDA …
  12.055.00010.00 - INSTALAÇÃO DE ACCESS POINT
Redução do item:
  12.030.00001.00 - CONEXÃO INTERNET COM 100% DE BANDA GARANTIDA …
```

Medido contra a sua própria tabela de itens:

| código | está na tabela? |
|---|---|
| `12.030.00002.00` | **não** |
| `12.055.00010.00` | **não** |
| `12.030.00001.00` | sim, quantidade 60 |

Os excluídos **já não estão lá**. A tabela de uma proposta é o escopo resultante dela; a de um
aditivo é o delta. É a base de `D-03`.

§2.10 prova o mesmo no PGM com muito mais força — ali as movimentações estão em **tabela**, e a
tabela de itens reflete **doze de doze**.

### 2.8 O que o aditivo do PGM muda, e o que não muda

Aplicando só `Inclusão` e `Exclusão`, e ignorando `Aumento` e `Redução`:

| bloco | itens | efeito |
|---|---|---|
| `Aumento` | `10.050.00001.00` · `14.031.00020.00` · `14.024.00006.00` · `14.048.00027.00` | **ignorado** |
| `Redução` | `12.030.00001.00` | **ignorado** |
| `Inclusão` | `14.071.00006.00` · `14.071.00007.00` | **dois códigos entram** |
| `Exclusão` | — | nenhum |

Consolidado: **49 itens, 48 códigos** (47 + 2).

E a semântica dos rótulos se confirma código a código — medido contra a proposta:

| bloco | códigos | **já na proposta?** |
|---|---|---|
| `Aumento` | os quatro | **sim, os 4** |
| `Redução` | `12.030.00001.00` | **sim** |
| `Inclusão` | `14.071.00006.00` · `14.071.00007.00` | **não, nenhum** |

*Aumenta-se o que existe; inclui-se o que não existe.* É o que sustenta `R-ADT-06a`: um `Aumento`
de código ausente da proposta seria inconsistência, e `V-ADT-04` a expõe.

E os dois códigos incluídos são exatamente o *"grupo C"* que a ESPEC 018 §2.3 registrou como
*"a planilha afirma que estão contratados e o PDF não conhece"*. A conclusão daquela espec estava
certa e agora tem nome: a peça que faltava é este arquivo.

### 2.9 Os blocos ignorados explicam, código a código, as cinco `V-REC-01` do PGM

Os cinco códigos tocados pelos blocos `Aumento` e `Redução` — que esta espec **ignora** — são
exatamente os cinco que a `V-REC-01` acusa hoje:

| código | contrato | bloco ignorado | soma | aba |
|---|---|---|---|---|
| `10.050.00001.00` | 42.260,00 | `Aumento` 554,01 | 42.814,01 | **42.814,01** |
| `12.030.00001.00` | 150,00 | `Redução` −80,00 | 70,00 | **70** |
| `14.024.00006.00` | 6.100,00 | `Aumento` 2.900,89 | 9.000,89 | **9.000,89** |
| `14.031.00020.00` | 5,00 | `Aumento` 5,00 | 10,00 | **10** |
| `14.048.00027.00` | 200,00 | `Aumento` 1.100,00 | 1.300,00 | **1.300** |

**Correspondência exata, cinco de cinco.** As `V-REC-01` do PGM nunca foram divergência entre as
fontes: eram a ausência de uma peça.

Isso **não** reintroduz a soma no relatório — `D-02` mantém o quantitativo fora. O que a tabela
autoriza é usar os blocos ignorados como **evidência**: sabendo que o aditivo alterou justamente
esses cinco, a `V-REC-01` deixa de avisar sobre eles com fundamento, em vez de calar por acaso
(`D-08`).

### 2.10 A exclusão existe, e está no `ANEXO II` — que é registro, não instrução

O contrato do PGM tem, nas páginas 30 a 32, um **`ANEXO II – ALTERAÇÕES DE QUANTITATIVOS`** com as
quatro movimentações em tabelas próprias, incluindo **duas de `Exclusão`**:

```
· Redução de recursos no Anexo "SISTEMAS DE INFORMAÇÃO"
· Inclusão de recursos no Anexo "DATA CENTER"
· Aumento  de recursos no Anexo "SERVIÇOS DE COMUNICAÇÃO"
· Aumento  de recursos no Anexo "DATA CENTER"
· Exclusão de recursos no Anexo "SERVIÇOS DE COMUNICAÇÃO"
· Exclusão de recursos no Anexo "DATA CENTER"
```

É **outro formato**: quatro colunas — `CÓDIGO`, `DESCRIÇÃO`, `UNIDADE`, `QTDE` —, com a `QTDE`
partida em `DE` / `PARA` nos blocos que alteram quantidade e simples nos que incluem ou excluem.

**A tabela de itens já reflete tudo, sem exceção.** Conferido movimento a movimento contra o
dimensionamento da página 22 a 25:

| movimento | `ANEXO II` diz | tabela de itens | |
|---|---|---|---|
| `Exclusão` | `12.029.00009/00012/00021/00024/00026`, `12.074.00001.00`, `14.033.00001.00` | **ausentes, os 7** | ✔ |
| `Inclusão` | `14.070.00001.00` = 43 · `14.070.00002.00` = 1 | 43 · 1 | ✔ |
| `Aumento` | `12.030.00001.00` de 72 **para 150** · `14.024.00001.00` de 5.200 **para 6.000** | 150 · 6.000 | ✔ |
| `Redução` | `10.050.00001.00` de 56.260 **para 42.260** | 42.260 | ✔ |

**Doze de doze.** A tabela de itens de uma proposta é o **escopo resultante**; o `ANEXO II` é a
memória de como se chegou nele. Aplicá-lo seria aplicar duas vezes (`D-12`).

E a exclusão tem consequência visível hoje: `12.074.00001.00` — `SD-WAN (INSTALAÇÃO)` — **saiu do
contrato e continua na aba** `Levantamento`. É por isso que ele aparece no bloco `DEMAIS ITENS` do
relatório do PGM, com `0 / 0`. É exatamente o que `R-ADT-05` deve produzir.

**O que ainda falta**: o `ANEXO II` é de uma **proposta**. Nenhum **aditivo** do repositório traz
bloco `Exclusão` — nem no dimensionamento de sete colunas, nem em anexo: as páginas 8 a 10 do
`PA-PGM-260304-715` são LGPD e assinaturas.

Então a incógnita encolheu, mas não fechou: sei que a exclusão se escreve `Exclusão`, que lista
código e descrição, e que existem **dois formatos possíveis** — o bloco de sete colunas com
`Exclusão TOTAL:`, simétrico ao `Inclusão` do PGM, e a tabela de quatro colunas do `ANEXO II`. Qual
deles um aditivo usa, não sei (`I-01`, `D-13`).

### 2.11 O `ANEXO II` não pode ser confundido com tabela de itens

Medida obrigatória depois de §2.10, porque `R-ADT-08` passou a procurar faixas em vez de páginas, e
o `ANEXO II` **tem códigos de serviço e tem bordas desenhadas**:

| página | faixas | tamanhos de faixa | faixas com 8 |
|---|---|---|---|
| 22 *(itens)* | 10 | 3 · 5 · **8** | **8** |
| 25 *(itens + cronograma)* | 21 | 2 · **8** | **20** |
| 31 *(`ANEXO II`)* | 25 | 3 · 4 · 5 · 6 | **0** |
| 32 *(`ANEXO II`)* | 9 | 3 · 5 | **0** |

O `ANEXO II` tem quatro a seis colunas e **nunca oito**. Não há como ele entrar como tabela de
itens: a separação é estrutural, não depende de rótulo nem de número de página.

### 2.11 O efeito medido no relatório do PGM

Simulado com o consolidado real, pelo caso de uso e pelas validações de produção:

| | hoje (só contrato) | **com o aditivo** |
|---|---|---|
| itens do contrato | 47 | **49** |
| códigos do contrato | 46 | **48** |
| checksum por peça | `0,00` | **`0,00` e `0,00`** |
| bloqueantes | 0 | **0** |
| `V-REC-01` | 5 | **0** *(por `D-08`)* |
| `V-REC-02` | 5 | 5 |
| **avisos** | **10** | **5** |
| linhas ordenadas | 45 | **47** |
| bloco `DEMAIS ITENS` | 13 | **11** |
| total de linhas | 58 | 58 |

Os dois códigos incluídos saem do bloco final e entram ao fim do corpo ordenado:

```
…  15.069.00001.00   1 / 1
   14.071.00006.00   5 / 0
   14.071.00007.00   1 / 1
```

**Não-regressão do piloto, medida no mesmo momento:** 60 itens, 57 códigos, `10.637.425,00`, uma
geometria, 54 + 4 = 58 linhas, 0 bloqueantes, 4 avisos. Idêntico ao de hoje.

---

## 3. Objetivo

**Um aditivo altera o conjunto de itens da proposta, e é só isso que o relatório absorve.**

A aplicação passa a receber a proposta e *n* aditivos. De cada aditivo, aplica os blocos `Inclusão`
e `Exclusão` sobre o conjunto de itens da proposta; **descarta os blocos `Aumento` e `Redução`**,
que alteram apenas quantitativo — que este trabalho não usa.

Com zero aditivos, o comportamento é o de hoje, item por item.

---

## 4. Escopo

### 4.1 Dentro do escopo

- `R-GRD-02` passa a descobrir a geometria **por faixa de linha** e a admitir **mais de uma
  geometria** por documento (`R-ADT-08`, `D-04`, `D-05`).
- Os itens de um documento passam a ser **particionados por bloco**, pelo rótulo da linha `TOTAL:`
  (`R-ADT-01`, `D-01`).
- `Inclusão` e `Exclusão` são aplicadas; `Aumento` e `Redução` são **descartadas** (`R-ADT-02` a
  `R-ADT-05`, `D-02`).
- O checksum passa a valer **por peça**, sobre todos os blocos (`R-ADT-09`, `D-07`).
- `V-ADT-01` a `V-ADT-03` — as guardas contra conjunto silenciosamente errado (§8.2).
- `V-REC-01` deixa de avisar sobre código tocado por bloco descartado (`D-08`).
- A API e a tela aceitam *n* aditivos, opcionais (`R-ADT-10`, `D-10`).
- O rodapé nomeia todas as peças (`R-ADT-11`, `D-09`).

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| **Consolidar quantitativo** | É a correção que define esta versão. O relatório não usa quantidade do contrato desde a ESPEC 018 `D-05`; somá-la aqui seria trabalho cujo resultado nada consome (`D-02`) |
| **Trocar a fonte da quantidade do relatório** | `R-REL-04` continua valendo: as duas quantidades saem da aba |
| Valores, preços, períodos e vigências | Nada disso entra. Vigências diferentes entre peças (12 e 8 meses) deixam de ser questão quando não se soma |
| Ler a prosa de `Exclusão dos itens:` da página 1 | §2.7 mede que, na proposta, a tabela já reflete a prosa. Num aditivo, o bloco é a fonte (`D-01`). Ver `I-02` |
| **Ler o `ANEXO II – ALTERAÇÕES DE QUANTITATIVOS`** | §2.10 mede que a tabela de itens já reflete **doze de doze** movimentações dele. É registro, não instrução — aplicá-lo duplicaria as inclusões (`R-ADT-13`, `D-12`) |
| Ordenar as peças por data ou identificador | §2.1 e `D-11`: o documento não sustenta. A ordem é a da submissão |
| Descobrir aditivos sozinha | A aplicação é sem estado (ESPEC 001 §7.2). Quem submete sabe quais peças valem |
| A capa fixa do DOCX | Continua sendo o `I-01` da ESPEC 018 |
| Anexos, grid e análise | Não são tocados |

---

## 5. Regras

| ID | Regra |
|---|---|
| `R-ADT-01` | Os itens de um documento são **particionados em blocos**. Um bloco termina na linha `TOTAL:`, e o **rótulo do bloco** é a palavra que a antecede na mesma linha — `Aumento`, `Redução`, `Inclusão`, `Exclusão` — ou **nenhuma** |
| `R-ADT-02` | **Na proposta**, todos os blocos valem, qualquer que seja o rótulo. A tabela de uma proposta é o escopo resultante dela (§2.6, §2.7) |
| `R-ADT-03` | **Num aditivo**, valem **apenas** os blocos `Inclusão` e `Exclusão` |
| `R-ADT-04` | `Inclusão` **acrescenta** ao conjunto os códigos do bloco, ao fim da ordem, com a descrição e a unidade do aditivo |
| `R-ADT-05` | `Exclusão` **remove** do conjunto todos os itens cujo código o bloco traga |
| `R-ADT-06` | `Aumento` e `Redução` são **descartados**: alteram quantitativo, que este relatório não usa. Não acrescentam, não removem e não reordenam nada. Os códigos que tocam ficam registrados para `D-08` |
| `R-ADT-06a` | Código de bloco `Aumento` ou `Redução` que **não esteja** no conjunto consolidado é **inconsistência documental**, e dispara `V-ADT-04`. Não se pode aumentar o que não foi contratado |
| `R-ADT-07` | Os aditivos são aplicados **em sequência**, na ordem de submissão, sobre o conjunto acumulado. Um código incluído por um aditivo pode ser excluído por outro posterior |
| `R-ADT-08` | Um documento pode conter **mais de uma tabela de itens, com geometrias distintas**. A geometria é descoberta por **faixa de linha** — oito traços verticais partilhando o mesmo par `(topo, base)` — e **toda** geometria que renda linha de item completa é usada. `R-GRD-01` e `R-GRD-02` ficam revistas |
| `R-ADT-09` | O checksum `V-CTR-03` é conferido **por peça**, sobre **todos** os seus blocos, inclusive os descartados. **Não** é conferido no conjunto consolidado, que não tem total declarado a que corresponder |
| `R-ADT-10` | A requisição aceita `contrato` (obrigatório), `levantamento` (obrigatório) e `aditivos` (**zero ou mais**). Sem aditivo, o resultado é idêntico ao de hoje. `R-REL-10` fica revista |
| `R-ADT-11` | O rodapé do documento nomeia **todas** as peças, na ordem de submissão |
| `R-ADT-12` | Uma mesma linha física lida por duas geometrias é **uma linha**. A identidade é `(página, conteúdo das sete células)` |
| `R-ADT-13` | O **`ANEXO II – ALTERAÇÕES DE QUANTITATIVOS`** é registro, **nunca instrução**: a tabela de itens da peça já o reflete (§2.10). Não é lido, e não pode ser — §2.11 mede que suas faixas têm de 3 a 6 divisórias e nunca 8 |
| `R-ADT-14` | `Exclusão` é reconhecida **nos dois formatos** conhecidos: bloco de sete colunas com `Exclusão TOTAL:` e tabela de quatro colunas rotulada `Exclusão de recursos`. Em ambos, o que se lê é a **lista de códigos** — quantidade e valor são irrelevantes (`D-13`) |

---

## 6. Decisões

### `D-01` — O bloco é a unidade, e o rótulo vem da linha `TOTAL:`

§2.2 mede que o rótulo chega **pela mesma grade que traz os itens** — não é preciso casar título de
seção com tabela por posição na página, nem interpretar prosa.

A partição é direta: acumule linhas de item; ao encontrar uma linha `TOTAL:`, feche o bloco com o
rótulo que ela carrega. O rótulo pode estar numa célula ou em duas conforme a geometria, então o
reconhecimento é sobre a **linha inteira**, não sobre uma coluna fixa.

**Alternativa descartada:** ler os títulos `Aumento` / `Redução` / `Inclusão` que aparecem como
texto solto acima de cada tabela. Estão fora da grade, e casá-los às tabelas exigiria comparar
coordenadas — mais frágil, e sem ganho: a linha `TOTAL:` já os repete.

### `D-02` — O quantitativo fica de fora, e é isso que torna a espec pequena

O relatório não usa quantidade do contrato desde a ESPEC 018 `D-05`: as duas quantidades vêm da aba
(`R-REL-04`). Do contrato saem ordem, descrição e unidade — e as três dependem só de **quais
códigos existem**.

Medido: aplicando apenas `Inclusão`/`Exclusão`, o documento do PGM sai com **58 linhas, 47
ordenadas e 11 no bloco final** — *exatamente* o que sairia somando todos os quantitativos das
quatro tabelas. O quantitativo consolidado não muda uma célula do documento.

Somá-lo seria produzir um número que nada consome, e que precisaria de vigência, rateio e
arredondamento para ser defensável. Não entra.

> A versão 1.0 desta espec somava tudo. Estava tecnicamente correta e resolvia um problema que não
> existe. Ver §13.

### `D-03` — Proposta é escopo; aditivo é delta. O papel vem do campo submetido

O erro fácil aqui é derivar o papel do rótulo. §2.6 mede por que não dá: o bloco único do contrato
do PGM é rotulado **`Aumento`** e vale o contrato inteiro. *"Ignore blocos `Aumento`"*, aplicado
sem distinguir papel, zeraria o contrato.

E §2.9 da ESPEC 018 já media que **nada no documento** separa proposta de aditivo — as três peças
se declaram `Proposta de Aditivo:`, e o aditivo do PGM sequer traz data.

Portanto o papel é **posicional**: o que chega em `contrato` é a proposta; o que chega em
`aditivos` são aditivos. É informação que só quem submete tem, e `V-ADT-03` é a rede para quando
ela vier trocada.

### `D-04` — A geometria é descoberta por faixa, não por página

`R-GRD-02` pergunta *"que páginas têm exatamente oito divisórias?"*. É a pergunta errada, e §2.3
mede o preço: **nenhuma** página do aditivo responde, e o documento inteiro se perde.

E não é azar: **um aditivo viola a premissa por construção**. É o documento feito de blocos curtos,
e blocos curtos partilham página. A premissa *uma tabela de itens por página* sobreviveu três specs
porque só havia propostas na amostra.

A pergunta certa é uma unidade abaixo. Cada linha é desenhada como oito traços verticais com o
mesmo `(topo, base)`; a página é a **união** desses conjuntos, e a união de duas tabelas não tem
oito elementos — tem 11 na página 6 e 15 na página 7.

**É estreitamento, não afrouxamento**: passa a exigir que as oito divisórias sejam *contemporâneas
na mesma linha desenhada*, e não apenas coexistentes na página. `R-GRD-03` — a recuperação por
proximidade — continua intacta, e é o que segue lendo a página 25 do contrato do PGM.

### `D-05` — O discriminador vira filtro, não eleição

`_escolher_gabarito` faz hoje `max(candidatos, key=(codigos, vao))`: escolhe **uma**. O aditivo
precisa de três (§2.4).

Trocar por *"aceite todas"* é inaceitável — §2.5 mede que a geometria do cronograma, aplicada às
páginas de itens, rende 5 linhas malformadas no contrato do PGM e 6 no piloto.

A regra fica: **use toda geometria que renda ao menos uma linha de item completa** — código na
primeira célula e as sete células legíveis. É o mesmo critério de `R-GRD-02`, aplicado como crivo
de admissão em vez de desempate.

Medido com esse crivo: contrato **1** geometria e 47 itens; aditivo **2** geometrias e 7 itens;
piloto **1** geometria e 60 itens, com o cronograma descartado nos três.

> O aditivo usa duas e não três porque a geometria de `Aumento` já lê a página 6 inteira, faixa de
> `Redução` inclusive: as colunas divergem menos que a `TOLERANCIA` de `R-GRD-03`. `R-ADT-12` é o
> que torna isso detalhe de execução e não número a defender.

### `D-06` — Extrair tudo, aplicar pouco

Os blocos `Aumento` e `Redução` são **extraídos e conferidos**, e só então descartados. Parece
desperdício e não é — são três coisas:

1. o **checksum** da peça só fecha somando todos os blocos (`D-07`);
2. `V-ADT-02` só distingue *"aditivo sem bloco operativo"* de *"aditivo que não foi lido"* se souber
   que leu os outros blocos;
3. `D-08` usa os códigos descartados como evidência.

Descartar na leitura pouparia nada e cegaria as três.

### `D-07` — O checksum vale por peça, nunca no consolidado

O conjunto consolidado — 47 itens da proposta mais 2 do bloco `Inclusão` — **não tem total
declarado a que corresponder**. Somar os totais das suas linhas dá `24.563.869,56`, que não é
número de documento nenhum: é a mistura de um escopo com um delta.

Conferir o checksum ali produziria um bloqueio permanente e falso. Ele fica onde sempre foi
verdadeiro: dentro de cada peça, contra o `TOTAL:` que ela declara. Medido: `0,00` na proposta e
`0,00` no aditivo (`−0,12` dos dois lados).

`V-CTR-03` deixa de rodar sobre o consolidado. É a única validação que perde alcance nesta espec, e
`V-ADT-01` cobre exatamente o buraco que sobra.

### `D-08` — A `V-REC-01` cala sobre o que o aditivo explica

Aplicada a espec, o contrato do PGM segue com `14.024.00006.00` em 6.100 enquanto a aba diz
9.000,89 — porque `D-02` não soma. A `V-REC-01` continuaria acusando as cinco divergências de hoje.

Seriam cinco avisos que **sempre disparam e nunca exigem ação**: sabemos a causa, ela está no
arquivo submetido, e a decisão de negócio é que a diferença não importa. É a patologia que a
`R-REL-13` da ESPEC 018 eliminou da `V-CTR-04` — aviso permanente treina quem confere a ignorar
avisos, inclusive os que importam.

§2.9 mede que os códigos dos blocos descartados são **exatamente** os cinco. Então a regra é
autossustentada: **`V-REC-01` não avisa sobre código tocado por bloco `Aumento` ou `Redução` de
algum aditivo submetido.** No PGM: de 5 para 0, e o total de avisos de 10 para 5.

O silêncio é fundamentado, não conveniente: se o aditivo *não* trouxer o código, o aviso volta —
e aí ele significa o que sempre significou, *falta uma peça ou uma fonte está errada*.

**Alternativa descartada:** manter os cinco avisos com texto explicativo. Mantém ruído permanente
para dizer *"isto é esperado"*.

### `D-12` — O `ANEXO II` é memória, e memória não se executa

§2.10 mede a tentação e o perigo na mesma tabela: o `ANEXO II` do contrato do PGM lista sete
exclusões, duas inclusões, dois aumentos e uma redução — **e a tabela de itens já reflete os doze**.

Lê-lo seria aplicar tudo duas vezes: os sete excluídos já não estão na tabela, e removê-los de novo
não faria mal; mas os dois incluídos entrariam em duplicata, e é isso que quebra.

A regra é simples e vale para qualquer peça: **o que vale é a tabela de itens**. Numa proposta ela
é o escopo resultante; num aditivo, o delta rotulado. O `ANEXO II` explica ao leitor humano como se
chegou ali, e é para ele que serve.

§2.11 mede que a separação é estrutural — 3 a 6 divisórias contra 8 —, então isto não depende de o
código lembrar de ignorar o anexo: ele não o alcança.

### `D-13` — `Exclusão` tem dois formatos possíveis, e só a lista de códigos importa

Até §2.10 eu tratava `Exclusão` como pura simetria com `Inclusão`. Não é bem assim: o formato de
exclusão que **existe de fato** no repositório é o do `ANEXO II` — quatro colunas, sem `TOTAL:`,
sem valor.

Num aditivo, ela pode aparecer nos dois:

| forma | onde foi vista | o que traz |
|---|---|---|
| bloco de 7 colunas, `Exclusão TOTAL:` | **em nenhum lugar** — projetada por simetria com o `Inclusão` do PGM | código, descrição, unidade, preço, quantidade, período, total |
| tabela de 4 colunas, `Exclusão de recursos` | **`ANEXO II` do contrato do PGM** (§2.10) | código, descrição, unidade, quantidade |

Reconhecer as duas custa pouco **porque o que se extrai é o mesmo nos dois casos: a lista de
códigos**. `R-ADT-05` remove por código; quantidade, preço e período não entram na decisão. Um
formato dá sete células e o outro quatro, e a primeira — o código — é a única que importa.

É o que torna a incerteza de `I-01` barata: qualquer que seja o formato, o dado é uma coluna de
códigos sob um título que começa com `Exclus`.

### `D-09` — O rodapé nomeia todas as peças

`R-CTR-05` põe no rodapé *"Quantidades conforme a proposta `PA-…`"*. Com duas peças, nomear só a
primeira afirma como origem um documento que não é a origem inteira:

```
TC 015/PGM/2024  ·  Conforme as propostas PA-PGM-251015-159 e PA-PGM-260304-715
```

Singular com uma peça, plural com mais de uma. É cadeia renderizada no documento que vai ao órgão:
tem teste próprio (§9.2).

> `D-02` também torna a palavra *Quantidades* imprecisa — as quantidades vêm da aba desde a ESPEC
> 018. O ajuste do texto entra junto, por ser a mesma linha.

### `D-10` — *n* arquivos, e os dois primeiros continuam obrigatórios

A ESPEC 018 `R-REL-10` celebrou *"dois arquivos, e só"* ao eliminar o catálogo. O ganho ali era
**acabar com o cadastro prévio**, não fixar o número dois — e nada disso volta: aditivo é insumo
submetido, sem semear nada.

`aditivos` é lista opcional. Zero aditivos é o caminho de hoje, bit a bit, e é o que o piloto
exercita (§2.11). Na tela, um terceiro campo, múltiplo e explicitamente opcional; a regra `completo`
do `UploadForm` **não** passa a exigi-lo, ou o piloto deixa de ser submissível.

### `D-11` — A ordem vem da submissão

§2.1 mede que o documento não sustenta ordenação automática. E com `R-ADT-07` a ordem passa a
importar de verdade: inclusão e exclusão do mesmo código em aditivos diferentes só se resolvem em
sequência.

Proposta primeiro, aditivos na ordem em que forem enviados. Documentado na tela, ao lado do campo.

---

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `infrastructure/contract/grid.py` | `analisar_geometria` agrupa os traços verticais **por faixa `(topo, base)`** antes de contar (`D-04`) e devolve **uma lista** de gabaritos. `_escolher_gabarito` vira `_filtrar_gabaritos` (`D-05`) |
| `infrastructure/contract/pdfplumber_extractor.py` | Laço externo por gabarito, com deduplicação por `(página, células)` (`R-ADT-12`). Os itens saem **particionados em blocos**, pelo rótulo da linha `TOTAL:` (`D-01`). `_total_declarado` acumula os `TOTAL:` de todos os blocos (`D-07`) |
| `domain/entities/contract.py` | Entra `BlocoDeItens(rotulo, itens)` e `Contract.blocos`. `Contract.itens` continua existindo e passa a ser a concatenação dos blocos — nada a jusante muda. Entra `Contract.aplicar(aditivos) -> Contract` (`R-ADT-02` a `R-ADT-07`) |
| `domain/interfaces/ports.py` | Nada. `IContractExtractor` continua *um caminho → um `Contract`*; aplicar aditivo é do domínio |
| `infrastructure/validations/contract_validations.py` | **Entram** `v_adt_01`, `v_adt_02` e `v_adt_03`. `v_ctr_03_checksum` roda **por peça** e deixa de rodar no consolidado (`D-07`). `v_ctr_04` compara a **primeira** geometria com `COLUNAS_DA_TABELA` |
| `infrastructure/validations/reconciliation_validations.py` | `v_rec_01` recebe os códigos dos blocos descartados e cala sobre eles (`D-08`) |
| `infrastructure/di/container.py` | `Entradas.aditivos: tuple[Path, ...] = ()`. `gerar()` extrai cada peça, valida por peça, aplica os aditivos e segue o fluxo de hoje |
| `api/routers/reports.py` · `api/schemas.py` | Campo `aditivos: list[UploadFile] = []` (`D-10`) |
| `domain/entities/report.py` · `report/docx_renderer.py` · `report/xlsx_analise_renderer.py` | `proposta_origem` passa a listar as peças (`D-09`) |
| `frontend/.../UploadForm.tsx` · `page.tsx` · `lib/api.ts` · `lib/types.ts` | Terceiro campo, `multiple`, opcional. `completo` **não** passa a exigi-lo |
| `backend/tests/fixtures/` | Entra `aditivo_pgm.pdf`, gerado pelo `sanitize_fixture.py`. Entra fixture sintética com bloco `Exclusão` (§9.2, `I-01`) |

**O caso de uso não muda.** `GenerateMeasurementReport` recebe um `Contract` e não sabe de quantas
peças ele veio — foi assim que §2.11 foi medido, com o código de produção intocado.

---

## 8. Validações

### 8.1 Mudam

| ID | Mudança |
|---|---|
| `V-CTR-01` | Cita **qual peça** não teve tabela localizada; o diagnóstico traz o número de geometrias encontradas |
| `V-CTR-03` | Roda **por peça**, sobre todos os blocos; **deixa de rodar no consolidado** (`D-07`). No PGM: `0,00` e `0,00` |
| `V-CTR-04` | Compara a primeira geometria com `COLUNAS_DA_TABELA`. Continua medida e não apresentada (`R-REL-13`) |
| `V-CTR-05` | Avalia o conjunto **consolidado** contra a aba. No PGM não dispara: os dois códigos incluídos estão na aba |
| `V-REC-01` | Cala sobre código tocado por bloco descartado (`D-08`). **No PGM sai de 5 para 0** |

### 8.2 Entram

| ID | Severidade | Quando dispara | Por quê |
|---|---|---|---|
| `V-ADT-01` | **`BLOQUEIA`** | Peça submetida da qual **nenhum item** foi extraído | É o defeito de hoje (§2.3). `D-07` tirou o checksum do consolidado; sem esta guarda, um aditivo ilegível some sem deixar rastro |
| `V-ADT-02` | **`AVISA`** | Aditivo lido, com blocos, mas **sem `Inclusão` nem `Exclusão`** | Aditivo só de quantitativo é legítimo e **não muda nada** aqui. Quem submeteu precisa saber que o arquivo não teve efeito — senão vai procurar num relatório idêntico a diferença que ele não produziu |
| `V-ADT-03` | **`BLOQUEIA`** | Duas peças com o mesmo `Proposta de Aditivo:`, ou peça submetida em `aditivos` cujo bloco único não é rotulado | A primeira metade pega a peça repetida; a segunda pega a proposta submetida como aditivo — §2.6 mede que uma proposta traz bloco único, sem rótulo ou rotulado `Aumento`, e nos dois casos ela seria **inteiramente descartada** por `R-ADT-03`, em silêncio |
| `V-ADT-04` | **`AVISA`** | Código em bloco `Aumento` ou `Redução` **ausente** do conjunto consolidado (`R-ADT-06a`) | Não se aumenta o que não foi contratado. Ou **falta uma peça intermediária** — o aditivo que incluiu aquele código —, ou o bloco está rotulado errado. Nos dois casos o código sai no bloco final em vez do corpo ordenado, e sem este aviso isso aconteceria em silêncio. §2.8 mede que não dispara no PGM: os 5 códigos estão todos na proposta |

### 8.3 Ficam intactas

`V-MED-01`, `V-MED-02`, `V-MED-03` e `V-REC-02`. Nenhuma olha o contrato.

### 8.4 O resultado para o PGM

| | hoje | com esta espec |
|---|---|---|
| bloqueantes | 0 | **0** |
| `V-REC-01` | **5** | **0** |
| `V-REC-02` | 5 | 5 |
| **avisos** | **10** | **5** |
| documento | 58 linhas, 45 + 13 | **58 linhas, 47 + 11** |

---

## 9. Testes e critério de aceite

### 9.1 O portão de não-regressão

`test_extractor_contract.py` **não pode ser tocado**. O piloto continua em 60 itens, 57 códigos e
`10637425.00`; o contrato do PGM, lido **sozinho**, em 47 itens, 46 códigos e `24551037.72`.
`D-04` e `D-05` são estreitamentos, e este teste é o que prova que são.

Valem igualmente os testes de anexos (ESPEC 004), de capa, timbrado e largura de coluna, e o âncora
do piloto (ESPEC 018 `D-11`) — o piloto não tem aditivo e sai idêntico.

### 9.2 Cobertura nova

| Nível | Cobertura |
|---|---|
| `R-ADT-01` / `D-01` | Partição por bloco: contrato PGM `[('Aumento', 47)]`; aditivo `[('Aumento', 4), ('Redução', 1), ('Inclusão', 2)]`; piloto `[(None, 60)]` |
| `R-ADT-01` | O rótulo é reconhecido tanto em `['…','Aumento','TOTAL:','BRL …']` quanto em `['…','Aumento TOTAL:','BRL …']` |
| `R-ADT-02` / `D-03` | A proposta contribui **todos** os 47 itens, apesar do rótulo `Aumento` |
| **`R-ADT-03`** | **Os 5 itens dos blocos `Aumento` e `Redução` do aditivo não entram no conjunto**: consolidado tem 49 itens, não 54 |
| `R-ADT-04` | `14.071.00006.00` e `14.071.00007.00` entram como as **duas últimas** linhas do corpo ordenado, com descrição e unidade do aditivo |
| **`R-ADT-05`** | **Fixture sintética com bloco `Exclusão`, nos dois formatos de `D-13`** — o código sai do conjunto e, seguindo na aba, aparece no bloco `DEMAIS ITENS` |
| `R-ADT-05` | **Espelho no documento real:** `12.074.00001.00`, excluído pelo `ANEXO II` do contrato do PGM, está na aba e sai hoje no bloco `DEMAIS ITENS` com `0 / 0` — a forma que uma exclusão tem no relatório (§2.10) |
| **`R-ADT-13`** | **O `ANEXO II` não contribui item nem exclusão**: o contrato do PGM lido sozinho continua em 47 itens e 46 códigos, apesar de suas páginas 31 e 32 trazerem 8 códigos de serviço em tabelas com borda |
| `R-ADT-13` | Nenhuma faixa das páginas 31 e 32 tem 8 divisórias — 3, 4, 5 e 6 apenas (§2.11) |
| `R-ADT-07` | Fixture com dois aditivos: código incluído pelo primeiro e excluído pelo segundo não entra; a ordem inversa entra |
| `R-ADT-08` / `D-04` | Nenhuma página do aditivo tem 8 divisórias — 11 na 6 e 15 na 7 —, e por faixa saem **4** conjuntos. As duas propostas saem em **2** cada: tabela de itens e cronograma |
| `R-ADT-08` | O gabarito primário das duas propostas **não se move** com a troca de página por faixa: segue `COLUNAS_DA_TABELA` no piloto e `GABARITO_DO_PGM` no PGM |
| `D-05` | Das 4 candidatas do aditivo, **3** são tabela de itens; das 2 de cada proposta, **1**. A geometria do cronograma não contribui item: 5 linhas malformadas no contrato do PGM e 6 no piloto ficam de fora |
| **`D-05`** | **O cronograma do aditivo tem 2 códigos de serviço na sua página** — um crivo *"tem código"* o admitiria. É o teste que impede `_e_item_completo` de ser trocado por uma contagem de códigos |
| `R-ADT-09` / `D-07` | Checksum `0,00` na proposta e `0,00` no aditivo — este somando os **três** `TOTAL:` (`884.902,44`, `−897.734,40`, `12.831,84`) para `−0,12`. **E o consolidado não é conferido** |
| `R-ADT-10` | Sem aditivo, o par do piloto produz 54 + 4 linhas, 0 bloqueantes, 4 avisos — idêntico a hoje |
| `R-ADT-11` / `D-09` | Rodapé com duas propostas no PGM e uma no piloto, com concordância de número |
| `R-ADT-12` | O aditivo rende 7 itens, não 12 |
| **`D-08`** | **`V-REC-01` não avisa sobre os 5 códigos dos blocos descartados**; avisa normalmente sobre um sexto código divergente que o aditivo não toque |
| `V-ADT-01` | Dispara ao submeter como aditivo um PDF sem tabela de itens |
| `V-ADT-02` | Dispara em aditivo só com `Aumento`/`Redução`; **não** dispara no aditivo do PGM, que tem `Inclusão` |
| `V-ADT-03` | Dispara com a mesma peça duas vezes, e com o contrato do PGM submetido no campo `aditivos` |
| **`V-ADT-04`** | Dispara em fixture com `Aumento` de código ausente da proposta; **não** dispara no aditivo do PGM, cujos 5 códigos estão todos nela (§2.8) |
| **Âncora PGM** | Par completo: 0 bloqueantes, **5 avisos, todos `V-REC-02`**, documento de 58 linhas — 47 ordenadas e 11 no bloco final |

### 9.3 O critério de aceite

**Submetidos proposta, aditivo e levantamento do PGM, os dois códigos do bloco `Inclusão` entram no
corpo ordenado do documento, os cinco códigos dos blocos `Aumento` e `Redução` não alteram nada, e
o relatório sai com zero `V-REC-01`.**

E o piloto, sem aditivo, sai byte a byte como sai hoje.

---

## 10. Riscos

| Risco | Mitigação |
|---|---|
| **`Exclusão` nunca foi observada *num aditivo*** (§2.10) — no `ANEXO II` de uma proposta, sim | Encolheu com §2.10: sei a grafia, sei que lista código e descrição, e sei os **dois formatos possíveis** (`D-13`). Falta saber qual um aditivo usa. Mitigação: reconhecer os dois, por prefixo sem acento (`exclus`), extraindo só a coluna de códigos — o que é comum aos dois. Enquanto não vier um caso real, `V-ADT-02` avisa quando um aditivo não teve efeito, que é o sintoma de rótulo não reconhecido |
| **O `ANEXO II` ser aplicado como instrução**, duplicando as inclusões | `R-ADT-13` e `D-12`. E a garantia é estrutural, não disciplinar: §2.11 mede que suas faixas têm de 3 a 6 divisórias e o extrator só alcança as de 8 |
| **Rótulo novo ou grafado de outro modo** ser descartado em silêncio | Rótulo não reconhecido **não** é tratado como `Aumento`: cai em `V-ADT-02`, que avisa que o aditivo não teve efeito |
| **Aditivo que falha na extração** somar zero em silêncio | `V-ADT-01` bloqueia por peça, antes de aplicar. `D-07` tirou o checksum do consolidado, o que torna esta guarda indispensável e não redundante |
| **Proposta submetida como aditivo** ser inteiramente descartada | `V-ADT-03`, segunda metade (§8.2) |
| **`D-04` admitir tabela espúria** num documento futuro | Três guardas em série: faixa com oito traços contemporâneos, crivo de linha completa (`D-05`) e checksum por peça |
| **`D-08` calar sobre divergência legítima** | Cala apenas sobre código que um aditivo submetido declara ter alterado. Se a peça não for submetida, o aviso volta. §2.9 mede a correspondência exata nos cinco |
| **Faltar um aditivo intermediário** — o que incluiu um código que outro depois aumenta | `V-ADT-04`. O sintoma é preciso e não tem outra causa: `Aumento` de código que a proposta consolidada não contém |
| **Uma peça faltar na submissão** e ninguém notar | `V-REC-01` é o alarme, e `D-08` é o que a mantém significativa ao remover o ruído previsível |
| **A fixture do aditivo esconder a forma real**, como em ESPEC 018 §14.2 | §9.2 exige que a fixture reproduza as **três** geometrias e os **três** rótulos — se a sanitização normalizar, os testes de `D-01` e `D-04` caem |

---

## 11. Pontos em aberto

| ID | Questão | Bloqueia? |
|---|---|---|
| **`I-01`** | **Um aditivo real com exclusão** — em qual dos dois formatos de `D-13` ela vem? Bloco de 7 colunas com `Exclusão TOTAL:`, ou tabela de 4 colunas como o `ANEXO II`? | **Não bloqueia a implementação**: `R-ADT-14` reconhece os dois, e `D-13` mede que o dado extraído é o mesmo — a coluna de códigos. Bloqueia *afirmar* que foi verificado em produção |
| `I-08` | Um **aditivo** pode trazer `ANEXO II` próprio? O `PA-PGM-260304-715` não traz — páginas 8 a 10 são LGPD e assinaturas | Não. `R-ADT-13` já manda ignorá-lo em qualquer peça, e §2.11 garante que ele não é alcançável |
| `I-07` | Um bloco `Aumento` pode trazer código ausente da proposta legitimamente — por exemplo, o aditivo aumentando algo que ele mesmo incluiu num bloco anterior? Se sim, `V-ADT-04` deve ignorar códigos incluídos pela **mesma** peça | Não. `R-ADT-07` aplica os blocos em sequência, então a `Inclusão` do mesmo aditivo já teria entrado antes — e `V-ADT-04` não dispararia. Registrado porque depende da ordem dos blocos dentro da peça, que só o PGM exemplifica |
| `I-02` | Existe aditivo que declara exclusão **só em prosa**, sem tabela, como faz a página 1 do piloto (§2.7)? | Não. Se existir, `V-ADT-02` avisa que o arquivo não teve efeito — e aí a espec precisa crescer |
| `I-03` | Há outros aditivos vigentes do `TC 015/PGM/2024`? §2.9 fecha os cinco códigos, o que sugere que não | Não bloqueia o código. Bloqueia afirmar que o PGM está completo. **`V-ADT-04` passa a ser o detector automático disso**: peça intermediária faltante aparece como `Aumento` de código que ninguém contratou |
| `I-04` | O `PA-PGM-251015-159` declara depender de quatro propostas anteriores (`PC-PGM-240715-100 v7`, `PA-PGM-250320-24 v1`, `PA-250409-037 v1`, `PA-PGM-250930-142 v4`). São peças a submeter, ou já estão incorporadas ao v5.0? | Não. O checksum do v5.0 fecha sozinho, o que indica peça completa — mas `I-03` só se responde com isto |
| `I-05` | Um aditivo pode **reincluir** código excluído por aditivo anterior? `R-ADT-07` diz que sim, por sequência | Não |
| `I-06` | A prosa do aditivo chama de *"Power BI Premium"* o item que a sua tabela nomeia `14.071.00006.00 — MIDDLEWARE - DIREITO DE USO DE SOFTWARE`, ao mesmo preço de `217,81`. Qual designação vai ao documento? | Não. A aba usa a mesma da tabela, e `R-ADT-04` faz sair essa |

---

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| **A** | **`D-04` + `D-05` — geometria por faixa, seleção por filtro.** Fecha com o portão de §9.1 verde e o aditivo rendendo 7 itens | **M** |
| B | `D-01` — partição por bloco e rótulo na linha `TOTAL:`; `D-07` — checksum por peça | P |
| C | `R-ADT-02` a `R-ADT-07` — `Contract.aplicar`, `Entradas.aditivos`, fluxo do container | P |
| D | `V-ADT-01` a `V-ADT-03` e `D-08` | P |
| E | `R-ADT-10` — API e tela com *n* arquivos | M |
| F | `D-09` — rodapé, e o âncora do par PGM completo | P |

**Total: 2 dias.**

**A fase A vem primeiro e é independente**: conserta um defeito que está no ar hoje — aditivo
submetido como contrato devolve zero itens, calado —, não move nenhum número dos dois pares (§9.1) e
pode ser publicada sozinha. Nada nas fases seguintes tem valor sem ela: não há bloco a particionar
num documento que lê zero linhas.

A fase F vem por último porque, enquanto o âncora antigo do PGM roda com 10 avisos, ele é a rede
que denuncia mudança inesperada nas fases B a E.

---

## 14. Emendas da implementação

### Fase A — 2026-08-17

Fase A entregue: `D-04` (geometria por faixa) e `D-05` (crivo em vez de eleição), mais o
`D-07` parcial — o total somado por peça, que vinha na mesma função e sem o qual o aditivo teria
total errado. Suíte de **411 para 431**, `ruff check` e `mypy` limpos.

| documento | itens | códigos | total declarado | checksum |
|---|---|---|---|---|
| piloto SMIT | 60 | 57 | `10.637.425,00` | `0,00` |
| proposta PGM | 47 | 46 | `24.551.037,72` | `0,00` |
| **aditivo PGM** | **7** *(era 0)* | **7** | **`−0,12`** | **`0,00`** |

### 14.1 Candidatas e admitidas são números diferentes, e a §9.2 os confundia

A §9.2 pedia *"o aditivo rende 3 conjuntos… contrato e piloto continuam em 1"*. Medido na
implementação, são duas contagens distintas:

```
                 candidatas (R-ADT-08)   admitidas (D-05)
piloto SMIT               2                     1
proposta PGM              2                     1
aditivo  PGM              4                     3
```

`analisar_geometria` devolve **toda** geometria de sete colunas — nas propostas, a tabela de itens
**e o cronograma**. A redução ao que é tabela de itens é do extrator, porque depende de ler célula.
A §9.2 foi corrigida para pedir os dois números.

### 14.2 O cronograma do aditivo tem código de serviço, e isso salva a `D-05`

`R-GRD-02`, ao pé da letra, discrimina por *onde estão os códigos de serviço*. Medido: a geometria
do cronograma do aditivo está na **mesma página 7** que a da `Inclusão` e enxerga **os mesmos dois
códigos**.

Um crivo *"tem código na página"* admitiria as duas e injetaria linha malformada. O que as separa é
**render linha de item completa**, que é o que `D-05` escreve — e agora tem teste próprio, marcado
`[risco]`, para que a troca por uma contagem de códigos não passe calada.

### 14.3 A ordem do documento exigiu inverter os laços

`R-REL-03` faz do contrato a **fonte da ordem** do relatório. Iterar geometria por geometria e
página por dentro embaralha as páginas quando uma geometria cobre a 22 e outra a 25.

Os laços ficaram **páginas por fora, geometrias por dentro**. Não estava na espec, e é o que mantém
`posicao_de` significando o que sempre significou.

### 14.4 Os totais não podem ser deduplicados por conteúdo de célula

`R-ADT-12` dá como identidade de linha `(página, conteúdo das sete células)`. Para os totais isso
está **errado**, e o contrato do PGM mostra por quê: a sua linha `TOTAL:` da página 25 é lida pelas
duas geometrias em formas diferentes —

```
pelo gabarito de itens        ['', '', '', '', 'Aumento', 'TOTAL:',        'BRL 24.551.037,72']
pelo gabarito do cronograma   ['', '', '', '', '',        'Aumento TOTAL:', 'BRL 24.551.037,72']
```

— porque a palavra `Aumento` cai numa célula ou em duas conforme a grade. Deduplicar por conteúdo
contaria as duas e o total sairia `49.102.075,44`.

Os totais passaram a ser deduplicados por **`(página, valor)`**, que sobrevive à quebra de célula.
Hoje o caso não se materializa — a geometria do cronograma é rejeitada e nunca lê —, então isto é
defesa em profundidade: a linha existe porque foi medida, não porque falhou.

### 14.5 `_candidatas_verticais` não pode passar a ler `bottom`

A `_PaginaFalsa` da T-1106 constrói retângulos com `x0`, `width`, `height` e `top` — **sem
`bottom`**. Fazer o agrupamento por faixa dentro de `_candidatas_verticais` quebraria quatro testes
da ESPEC 017 com `KeyError`, por um motivo que nada tem a ver com o que eles afirmam.

As duas funções ficaram separadas, e é o desenho certo por si: `_candidatas_verticais` serve a
`R-GRD-04`, que é por página; `_faixas_verticais` serve a `R-ADT-08`, que é por faixa.

### 14.6 O que a Fase A **não** entregou

Nada de `Inclusão`/`Exclusão` foi aplicado ainda: o aditivo é **lido**, e o seu conjunto não é
consolidado com o da proposta. O relatório do PGM segue idêntico ao de hoje — 45 + 13 linhas, 10
avisos —, porque nada além do extrator mudou.

É o que a espec previu ao pôr a fase A primeiro: *"conserta um defeito que está no ar hoje… e pode
ser publicada sozinha"*.

---

### Fase B — 2026-08-17

`D-01` entregue: `RotuloDeBloco`, `BlocoDeItens`, `Contract.blocos` e a partição no extrator. Suíte
de **431 para 459**, `ruff check` e `mypy` limpos. A partição medida nos três documentos:

| documento | blocos |
|---|---|
| piloto SMIT | `[(None, 60, 10.637.425,00)]` |
| proposta PGM | `[(AUMENTO, 47, 24.551.037,72)]` |
| **aditivo PGM** | `[(AUMENTO, 4, 884.902,44), (REDUCAO, 1, −897.734,40), (INCLUSAO, 2, 12.831,84)]` |

Dos sete itens do aditivo, **dois** alteram o conjunto. Os outros cinco são exatamente os códigos
que a `D-08` vai usar como evidência (§2.9).

### 14.7 `Contract.itens` não podia virar derivação de `blocos`

O desenho limpo seria `itens` como propriedade de `blocos` — uma fonte de verdade só. Não dá:
`test_extractor_contract` constrói `Contract(proposta=…, total_declarado=…, itens=…)` para provar o
checksum contra tabela mutilada, e é o arquivo que a §9.1 se proibiu de tocar.

`itens` ficou sendo o campo, e `blocos` entrou ao lado com padrão `()`. A redundância é real, então
paguei por ela: `__post_init__` confere que a concatenação dos blocos é igual a `itens` **quando há
blocos**. Duas visões da mesma tabela sem guarda é deriva à espera de acontecer.

### 14.8 Rótulo desconhecido devolve `None`, e não `AUMENTO`

Decisão que não estava na espec e que precisa estar. `None` e `AUMENTO` levam ao **mesmo** lugar
numa proposta — `R-ADT-02` toma todos os blocos — e a lugares **opostos** num aditivo, onde
`R-ADT-03` descarta o `Aumento`.

Mapear desconhecido para `AUMENTO` faria um bloco de rótulo novo — `Prorrogação`, `Repactuação` —
ser descartado **em silêncio**. Devolvendo `None`, ele não altera o conjunto e `V-ADT-02` avisa que
o aditivo não surtiu efeito, que é o sintoma de rótulo não reconhecido. Tem teste marcado `[risco]`.

### 14.9 `BlocoDeItens` carrega o seu total

A espec descrevia `BlocoDeItens(rotulo, itens)`. Entrou também o `total_declarado`, porque é a linha
`TOTAL:` que **delimita** o bloco: guardar o valor à parte deixaria o bloco sem o dado que o
define, e `R-ADT-09` — checksum por peça sobre todos os blocos — não teria como ser afirmada bloco a
bloco.

### 14.10 Duas ausências medidas, não supostas

O laço da partição admite dois casos de borda, e nenhum dos três documentos os produz:

- **`TOTAL:` sem item antes** — não fecha bloco. Bloco vazio não é bloco de itens, e registrá-lo
  faria `V-ADT-02` contar uma `Exclusão` inexistente como efeito.
- **itens sem `TOTAL:` depois** — saem num bloco **sem rótulo**, e não descartados. Vale a tabela
  que a peça mostra; e se faltou total, `V-CTR-03` já bloqueia por outro caminho.

### 14.11 O que a Fase B **não** entregou

`Contract.aplicar` não existe ainda: os blocos estão lidos e rotulados, e ninguém os consolida. O
relatório do PGM continua idêntico — 45 + 13 linhas, 10 avisos.

Da `D-07`, ficou a metade que era do extrator (total somado por peça). A outra metade — **não rodar
`V-CTR-03` no consolidado** — só existe quando houver consolidado, na Fase C.

---

### Fases C a F — 2026-08-17

Entregues: `Contract.aplicar`, as quatro validações novas, o silêncio da `V-REC-01`, o terceiro
campo na API e na tela, e o rodapé. Suíte de **459 para 488**, `ruff check`, `mypy` e
`next build` limpos.

O critério de aceite da §9.3, medido:

| | piloto | PGM sem aditivo | **PGM com aditivo** |
|---|---|---|---|
| linhas ordenadas | 54 | 45 | **47** |
| bloco `DEMAIS ITENS` | 4 | 13 | **11** |
| total de linhas | 58 | 58 | 58 |
| bloqueantes | 0 | 0 | **0** |
| `V-REC-01` | 0 | 5 | **0** |
| `V-REC-02` | 4 | 5 | 5 |
| rodapé | 1 proposta | 1 proposta | **2 propostas** |

### 14.12 O checksum mudou de lugar, não de força

`D-07` diz que `V-CTR-03` não roda no consolidado. Implementado, virou uma troca de laço: onde havia
`if contrato.itens: v_ctr_03_checksum(contrato, …)`, há agora

```python
for peca in (proposta, *aditivos):
    if peca.itens:
        v_ctr_03_checksum(peca, achados)
```

Com zero aditivos é literalmente a chamada de antes, sobre o mesmo objeto. Com aditivos, cada peça é
conferida contra o `TOTAL:` que ela própria declara — que é onde o checksum sempre foi verdadeiro.

O consolidado sai com `total_declarado=None` e `blocos=()`, e isso é afirmação, não omissão: ele
mistura um escopo com deltas, e não há número de documento a que corresponder.

### 14.13 A `V-ADT-03` só pega uma das duas formas de proposta

A §8.2 pede que ela bloqueie *"peça submetida em `aditivos` cujo bloco único não é rotulado"*. Isso
pega a forma do **piloto** — bloco único sem rótulo — e **não pega a do PGM**, cujo bloco único é
rotulado `Aumento` e vale o contrato inteiro (§2.6).

Não há como distinguir essa segunda forma de um aditivo legítimo que só aumente quantitativo: as
duas são um bloco `Aumento` e nada mais. O que sobra para ela é a `V-ADT-02`, que avisa *"não altera
o conjunto de itens… o relatório sai igual ao que sairia sem ele"*.

Fica registrado como limite conhecido: a proposta do PGM submetida no campo errado **avisa**, não
bloqueia. A do piloto bloqueia.

### 14.14 Dois aditivos de mesmo nome se sobrescreveriam em disco

`gravar()` monta o caminho como `destino / f"{campo}.pdf"`. Passando o nome do arquivo como campo,
duas peças homônimas — o caso realista, `aditivo.pdf` duas vezes — gravariam **no mesmo caminho**, e
a segunda entraria como cópia da primeira.

Os aditivos são gravados por **posição**: `aditivo-1.pdf`, `aditivo-2.pdf`. A `V-ADT-03` continua
sendo quem acusa a duplicata, mas agora acusa o que de fato foi enviado, e não um artefato da
gravação. Há teste na API que envia o mesmo PDF duas vezes com o mesmo nome.

### 14.15 O rodapé não tinha teste nenhum

Ao aplicar `D-09` descobri que a linha `Contrato: …  ·  Quantidades conforme a proposta …` **nunca
foi verificada**: nenhuma asserção da suíte a tocava. Ela podia ser reescrita, ou sumir, sem nada
ficar vermelho — num documento que vai ao órgão.

Entrou teste parametrizado sobre o DOCX renderizado, nas duas concordâncias. E a redação foi
corrigida junto: saiu a palavra **Quantidades**, porque desde a ESPEC 018 `D-05` as duas quantidades
vêm da aba `Levantamento`. O que as propostas originam é o **escopo**.

```
Contrato: TC 015/PGM/2024  ·  Conforme as propostas PA-PGM-251015-159 e PA-PGM-260304-715
```

### 14.16 `Report` ganhou a contagem, e não só a cadeia

Para o rodapé concordar em número não basta a cadeia pronta: `"PA-A e PA-B"` e um identificador que
contenha " e " são indistinguíveis. `Report.propostas` entrou ao lado de `proposta_origem` só para
isso, e `Contract.identificacao` é quem compõe o texto — `PA-A`, `PA-A e PA-B`,
`PA-A, PA-B e PA-C`.

### 14.17 O que **não** foi entregue

- **`R-ADT-05` não tem espelho em documento real.** A exclusão é exercitada por fixture sintética,
  nos dois formatos de `D-13`. O que existe de real é o `ANEXO II` da proposta do PGM, e o teste
  sobre ele prova o **oposto**: que ele não é lido (`R-ADT-13`). `I-01` segue aberto.
- **`V-ADT-04` não dispara em documento real** — §2.8 mede que os cinco códigos estão todos na
  proposta. É exercitada por fixture.
- A **capa fixa** do DOCX continua dizendo `TC 52/SMIT/2024` (`I-01` da ESPEC 018). Estava fora do
  escopo e continua: **bloqueia a entrega do documento do PGM**, e precisa de espec própria.

---

## 13. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-08-14 | Redação inicial: **somar os quantitativos** do contrato e dos aditivos. Media a soma fechando com a aba nos sete códigos e tratava o sinal negativo da `Redução` como dado, decidindo explicitamente **ignorar os rótulos** dos blocos por serem *"uma segunda fonte para o mesmo fato"* |
| **2.2** | **2026-08-14** | **A exclusão foi encontrada.** Ao perguntar-se como funciona a exclusão, uma varredura por `exclus` em todos os PDFs achou o **`ANEXO II – ALTERAÇÕES DE QUANTITATIVOS`** nas páginas 30 a 32 do contrato do PGM, com as quatro movimentações em tabelas de quatro colunas — **duas delas de `Exclusão`**, somando 7 códigos. A §2.10 anterior, que afirmava *"`Exclusão` não é observável em nenhum documento do repositório"*, **estava errada**: eu havia procurado apenas o bloco de sete colunas com `Exclusão TOTAL:`, no formato do `Inclusão` do PGM, e nunca abri as páginas finais. Duas consequências. Primeira, `D-03` ganha prova dura: a tabela de itens reflete **doze de doze** movimentações do `ANEXO II`, e `12.074.00001.00` — excluído, mas ainda medido na aba — é o exemplo vivo do que uma exclusão produz no relatório. Segunda, entram `R-ADT-13` e `D-12`: o `ANEXO II` é **registro, nunca instrução**, sob pena de duplicar as inclusões — com §2.11 medindo que a garantia é estrutural, suas faixas têm de 3 a 6 divisórias e o extrator só alcança as de 8. `R-ADT-14` e `D-13` passam a reconhecer os **dois** formatos de exclusão, o que custa pouco porque o dado é o mesmo nos dois: a coluna de códigos. O `I-01` encolhe de *"nunca vi exclusão"* para *"não sei qual formato um aditivo usa"* |
| 2.1 | 2026-08-14 | Entram `R-ADT-06a` e **`V-ADT-04`**, ao perguntar-se o que acontece quando o aditivo traz `Aumento`. Descartar o bloco resolve o caso normal, mas deixava passar em silêncio o caso doente: `Aumento` de código que a proposta não contém — sintoma de **peça intermediária faltante**, que mandaria o item para o bloco final sem uma palavra. Medido em §2.8 que a semântica dos rótulos se sustenta no PGM: os 5 códigos de `Aumento`/`Redução` estão na proposta, os 2 de `Inclusão` não |
| **2.0** | **2026-08-14** | **Correção de escopo, vinda do negócio.** O relatório não usa quantitativo do contrato desde a ESPEC 018 `D-05` — usa **ordem, descrição e unidade**, e as três dependem só de *quais códigos existem*. Um aditivo importa quando **inclui ou exclui** item; `Aumento` e `Redução` mudam apenas quantitativo e são **descartados** (`D-02`, `R-ADT-06`). O rótulo do bloco, que a 1.0 descartava por princípio, passa a ser **o dado operativo** (`D-01`) — e §2.2 mede que ele chega pela mesma grade dos itens, na linha `TOTAL:`. Medido que o documento sai **idêntico** pelos dois caminhos, 58 linhas em 47 + 11: a soma da 1.0 estava correta e não alimentava nada. Entram `D-03` (papel vem do campo submetido, não do rótulo — o bloco único do contrato do PGM é rotulado `Aumento` e vale o contrato inteiro), `D-07` (checksum por peça, nunca no consolidado, que não tem total a que corresponder) e `D-08` (a `V-REC-01` cala sobre o que os blocos descartados explicam — §2.9 mede correspondência exata nos cinco códigos). Registrado que **`Exclusão` não é observável em nenhum documento do repositório** (§2.10, `I-01`): é a única regra projetada e não medida |
