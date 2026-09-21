# ESPEC 035 — A linha que ficou acima da moldura

| | |
|---|---|
| **Status** | **Implementada** — 2026-08-31, com **uma verificação pendente**. As três regras entraram: `R-GRD-10` (o contador e o sufixo de `V-CTR-03`), `R-CAP-16` (a classe de traços) e `R-GRD-11`/`R-GRD-12` (a fronteira superior). Não-regressão **integral**: os oito `sha`, os oito `geom`, os oito nomes de órgão e a impressão digital do descarte idênticos; nenhum artefato reancorado. **Falta a confirmação positiva** — *o `PA-FTM-251001-143` lê 10 itens e fecha em `185.316,73`* —, que exige o binário ou uma submissão pela tela (TASKS 035 `I-01`) |
| **Versão** | **1.2** — 2026-08-31. **1.1:** a §8.2 pedia que o corpus acusasse **zero** palavra descartada, e a v1.0 confundiu duas medições — a §2.4 mede zero páginas com **código de serviço** entre as órfãs, o crivo da `R-GRD-11`, não zero palavras. A régua de `R-GRD-10` passou a ser a **impressão digital** do descarte. **1.2:** a §2.3 estabelecia o caminho A por eliminação; a §2.7 o confirma por **medição** — 16 palavras descartadas na página 7, o tamanho exato da linha perdida |
| **Depende de** | [ESPEC 017](017-grade-do-contrato-derivada-do-documento.md) — a grade derivada do documento. [ESPEC 032](032-a-frase-que-virou-a-pagina.md) — a cauda de página e o crivo de coluna, que esta espec **reusa sem alterar**. [ESPEC 034](034-o-orgao-que-vem-antes-da-frase.md) `R-CAP-11` — o sintagma institucional, que esta espec só destrava |
| **Revisa** | A `orfas` da [ESPEC 001](001-mvp-analise-medicao.md) §9.4, que sintetiza fronteira **só no rodapé**; e o separador literal de `_CLIENTE`/`_SIGLA` ([ESPEC 020](020-capa-do-documento.md) `R-CAP-04`, [ESPEC 034](034-o-orgao-que-vem-antes-da-frase.md) `R-CAP-11`) |
| **Não toca** | A descoberta de geometrias (`R-GRD-02`, `R-ADT-08`), o crivo de admissão (ESPEC 019 `D-05`), a leitura por faixa (ESPEC 033 `R-FXA-01` a `R-FXA-06`), a costura da cauda (`R-CON-01` a `R-CON-05`), a ordem dos itens (`R-REL-03`), a cascata de `R-CAP-10`, a aba `Levantamento` e a consolidação de aditivos |
| **Referência normativa** | `PA-FTM-251001-143 v1.0.pdf` (o defeito) · `contrato.pdf`, `contrato_pgm.pdf`, `aditivo_pgm.pdf`, `aditivo_pgm_2.pdf`, `contrato_smul.pdf`, `aditivo_smul.pdf`, `modelo.pdf`, `amostra_sem_tabela.pdf` (a não-regressão) |
| **Origem** | Submissão real do aditivo da Fundação Theatro Municipal, recusada com dois achados: `V-CTR-03` bloqueando por `51.676,20` e `V-CAP-01` avisando que o órgão não derivou |

---

## 1. Problema

O aditivo `PA-FTM-251001-143` **não gera relatório**. A tela recusa a submissão com dois achados:

```
V-CTR-03  extração incompleta: a soma dos itens (133640.53) não bate com o
          total declarado (185316.73) — diferença de 51676.20
V-CAP-01  o nome do órgão não foi derivado da proposta PA-FTM-251001-143 —
          a capa identificará o cliente pelo título do levantamento
```

São **dois defeitos independentes, e os dois precisam cair**: `V-CTR-03` bloqueia, e corrigi-lo
sozinho entregaria o relatório com a capa dizendo o nome curto de um órgão que a primeira página
nomeia por extenso.

E nenhum dos dois é PDF defeituoso. A tabela está inteira e legível; o órgão está escrito na
primeira página. O que falha nos dois casos é uma **premissa de amostra** que envelheceu — em §2.3
uma moldura que sempre fechava, em §2.5 um traço que sempre era hífen.

## 2. O que foi levantado no código

As medições de §2.1, §2.4 e §2.5 foram feitas com o extrator de produção sobre as oito peças do
repositório. As de §2.2 e §2.3 foram feitas sobre o texto e as imagens do documento submetido — o
binário não está no repositório, e é isso que `T-01` fecha.

### 2.1 O que sumiu é uma linha só, e dá para nomeá-la

A diferença fecha exata contra uma única linha da tabela:

```
soma das dez linhas da tabela : 185.316,73   = total declarado ✓
soma que o Confere leu        : 133.640,53
diferença                     :  51.676,20   = 45,33 × 95,00 × 12
                                             = 14.031.00018.00  PERFIL OFFICE 365 – EXECUTIVE E1

as oito linhas da página 6    : 128.532,13
                    + a E3    :   5.108,40   → 133.640,53   ← exatamente o que foi lido
```

**As oito linhas da página 6 entraram, e a segunda linha da página 7 também.** Sumiu a
**primeira linha da página 7**, e só ela.

`soma_dos_totais` soma `self.itens` direto
([contract.py:293](../../backend/src/domain/entities/contract.py#L293)) — não passa por blocos. O
item está mesmo ausente da lista; não é artefato de agregação.

### 2.2 A extração tem exatamente dois caminhos de descarte silencioso

Nenhuma exceção foi levantada, o que exclui célula numérica ilegível: `_montar_item` falha alto
([pdfplumber_extractor.py:482](../../backend/src/infrastructure/contract/pdfplumber_extractor.py#L482))
e viraria `422`, não `V-CTR-03`. Restam dois pontos onde uma linha some **sem erro e sem registro**:

| | onde | mecanismo |
|---|---|---|
| **A** | [grid.py:565-567](../../backend/src/infrastructure/contract/grid.py#L565-L567) | a palavra cai fora de `[horizontais[0], horizontais[-1]]`, `_indice` devolve `None` e `ler_celulas` a descarta |
| **B** | [pdfplumber_extractor.py:259-260](../../backend/src/infrastructure/contract/pdfplumber_extractor.py#L259-L260) | `celulas[COL_CODIGO]` não casa `_CODIGO_EXATO` e o laço faz `continue` |

**Nenhum dos dois deixa rastro.** É por isso que o único sinal disponível foi um checksum dizendo
*"faltam R$ 51.676,20"*, e não *"a página 7 descartou 14 palavras"*.

### 2.3 O caminho B se elimina pela construção; sobra o A

A página 7 traz **duas tabelas de sete colunas na mesma folha** — a de itens (3 linhas) e o
Cronograma Físico Financeiro (`PERÍODO · A · B · C · E · H · VALOR TOTAL`, 14 linhas). É o cenário
da ESPEC 033, e a suspeita natural. Percorrido degrau a degrau, ele não se sustenta:

| degrau | o que aconteceria | fecha? |
|---|---|---|
| descoberta (`R-ADT-08`) | duas candidatas de oito divisórias: itens (10 códigos, páginas 6 e 7) e cronograma (2 códigos, página 7). `R-GRD-02` elege a de itens | ✅ |
| admissão (ESPEC 019 `D-05`) | a do cronograma aplicada à página 7 não rende item completo — a coluna `PERÍODO` começa à direita da coluna de código, e o código cai fora dela | ✅ só a de itens é admitida |
| leitura por faixa (`R-FXA-01`) | a `E1` e a `E3` têm faixa própria de oito, desenhada; cada uma é fatiada pelas suas divisórias | ✅ as duas corretas |
| a linha `TOTAL:` | células mescladas, três traços. Herda da `E3` por `R-FXA-03`, e é o que faz `_total_declarado` devolver `185.316,73` | ✅ **e é o observado** |

O último degrau é a prova de que a leitura por faixa **está operando** na página 7: sem ela o
`TOTAL:` não fecharia, e o total declarado não teria saído certo. Se as divisórias estivessem
erradas na `E1`, estariam erradas na `E3` — que é a linha imediatamente abaixo, com a mesma
geometria desenhada. **A `E3` saiu inteira.**

Sobra o **caminho A**, e ele explica a assimetria de graça: a `E1` é a **primeira linha da folha**,
e é a única cuja leitura depende de onde `horizontais[0]` está.

> **`T-01` CONFIRMOU, e não pelo script — pelo produto** (§2.7). O contador de `R-GRD-10`, entregue
> antes da correção, mediu **16 palavras descartadas na página 7**, que é exatamente o tamanho da
> linha `14.031.00018.00`. O caminho B fica descartado por medição, e não mais por eliminação: por
> ele a linha teria sido **lida** e as palavras não apareceriam na conta.

### 2.4 A moldura fecha no rodapé e não fecha no topo

`montar_grade` já sabe que a moldura deste gerador não cobre tudo o que imprime — **no rodapé**
([grid.py:327-334](../../backend/src/infrastructure/contract/grid.py#L327-L334)):

```python
limite = horizontais[-1]
orfas = [p for p in pagina.extract_words()
         if (p["top"] + p["bottom"]) / 2 >= limite and verticais[0] <= p["x0"] < verticais[-1]]
if orfas:
    horizontais = [*horizontais, max(p["bottom"] for p in orfas) + 1.0]
```

O comentário ao lado é da ESPEC 001 §9.4: *"foi assim que 12.074.00005.00 e 14.048.00008.00 se
perderam nas abordagens anteriores"*. **A metade de cima nunca foi escrita** — e não por decisão:
porque nenhuma peça da amostra tinha linha de item acima da primeira fronteira.

Que o gerador imprime fora da moldura está medido nas fixtures, com o extrator de produção:

```
contrato.pdf      p25  horizontais[0]=624,7  → 177 palavras acima   prosa sobre SOA
contrato.pdf      p27  horizontais[0]= 55,5  →   7 palavras acima   cauda de descrição
contrato.pdf      p28  horizontais[0]= 55,5  →  10 palavras acima   cauda de descrição
contrato_pgm.pdf  p22  horizontais[0]=430,7  → 214 palavras acima   marcadores sobre VPN
contrato_pgm.pdf  p23  horizontais[0]= 78,5  →  16 palavras acima   cauda de descrição
contrato_smul.pdf p11  horizontais[0]= 39,9  →   8 palavras acima   prosa de seção
contrato_smul.pdf p13  horizontais[0]= 39,3  →   1 palavra  acima   fragmento de cabeçalho
aditivo_smul.pdf  p3   horizontais[0]= 82,5  →   1 palavra  acima   rótulo de bloco
aditivo_pgm.pdf   p6   horizontais[0]=329,2  → 138 palavras acima   título de seção
```

**Nove páginas do corpus imprimem acima da grade, e a ESPEC 032 resgata apenas o subconjunto que é
cauda de descrição.** O resto é descartado — corretamente, porque é prosa. O que não existe é o
terceiro caso: **linha de item inteira**.

E o crivo que o separa dos outros dois já existe em espírito. Medido nas nove páginas — onze
pares página × geometria, porque duas delas casam duas geometrias:

```
páginas com código de serviço na coluna do código, entre as órfãs : 0
páginas com código de serviço entre as órfãs, em qualquer coluna  : 0
```

**Zero, e zero.** Um crivo por *"há código de serviço na coluna 0?"* não toca nenhuma das nove —
não chega perto de tocar. É a mesma qualidade de separação que a ESPEC 032 mediu para a cauda
(`0` contra `93`, sem valor intermediário).

### 2.5 O órgão não deriva por causa de um travessão

Esta metade está medida e fechada. `_CLIENTE` e `_SIGLA`
([pdfplumber_extractor.py:112-120](../../backend/src/infrastructure/contract/pdfplumber_extractor.py#L112-L120))
exigem **hífen ASCII** entre o nome e a sigla:

```python
_CLIENTE = re.compile(_VOCABULARIO_DE_ORGAO + r"[^.;]{0,90}?\s*-\s*[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ]{2,}\b")
_SIGLA   = re.compile(r"\s*-\s*[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ]{2,}\s*$")
```

A capa do FTM escreve `Fundação Theatro Municipal – FTMSP`, com **en dash `–` (U+2013)**. Medido:

```
_CLIENTE.finditer(capa)                    →  []            nenhum
o mesmo texto com hífen ASCII              →  ['Fundação Theatro Municipal - FTMSP']
codepoint do separador no documento        →  0x2013
```

`nomes` sai vazio, `len(nomes) != 1`, `_cliente()` devolve `''`, `V-CAP-01` avisa. **Não é a
`R-CAP-13`** (ambiguidade), e **não é o vocabulário**: `Funda[çc][ãa]o` já está na lista fechada
que a ESPEC 034 `D-04` montou por antecipação. A antecipação funcionou; só o traço barrou.

O mesmo documento usa `–` também nas descrições (`PERFIL OFFICE 365 – EXECUTIVE E1`): é traço
tipográfico do gerador desta peça, não um caractere solto.

Trocando o literal por uma **classe de traços** — hífen, hifens tipográficos, en/em dash e o sinal
de menos —, medido nas oito peças:

| peça | hoje | com a classe |
|---|---|---|
| `PA-FTM-251001-143` | `''` | **`FUNDAÇÃO THEATRO MUNICIPAL`** |
| `contrato.pdf` | `SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA` | **igual** |
| `contrato_pgm.pdf` | `PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO` | **igual** |
| `contrato_smul.pdf` | `SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO` | **igual** |
| `aditivo_smul.pdf` | `SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO` | **igual** |
| `aditivo_pgm_2.pdf` | `PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO` | **igual** |
| `aditivo_pgm.pdf` · `modelo.pdf` · `amostra_sem_tabela.pdf` | `''` | **igual** |

**8 de 8 inalteradas, e a nona passa a derivar.**

`_SIGLA` precisa da mesma classe, e não é detalhe: sem ela a capa sairia
`FUNDAÇÃO THEATRO MUNICIPAL – FTMSP`, com a sigla colada no nome.

### 2.6 O que o Confere não consegue dizer hoje

`DiagnosticoDaGrade` ([contract.py:46-96](../../backend/src/domain/entities/contract.py#L46-L96))
conta páginas, páginas com borda, páginas com texto, divisórias, geometrias candidatas, códigos por
candidata e caudas órfãs. **Não conta o que a grade descartou.**

É a lacuna que fez esta análise custar o que custou: o sintoma disponível foi um número de reais, e
a página só apareceu por aritmética. O contador custa zero leitura nova — o laço que descarta é o
mesmo que atribui.

### 2.7 A confirmação, medida pelo próprio Confere

O contador de `R-GRD-10` foi entregue **antes** da correção, e a primeira submissão do FTM depois
disso devolveu:

```
V-CTR-03 extração incompleta: a soma dos itens (133640.53) não bate com o total
declarado (185316.73) — diferença de 51676.20 — e a grade descartou 93 palavras
fora de qualquer linha da tabela, nas páginas 6 (77), 7 (16)
```

**Dezesseis na página 7.** A linha perdida, quebrada em palavras como o `pdfplumber` a quebra::

    14.031.00018.00  PERFIL  OFFICE  365  –  EXECUTIVE  E1
    LICENÇA  ATIVA/  MÊS   BRL  45,33   95,00   12   BRL  51.676,20
                                                    ──────────────
                                                       16 palavras

São **duas grandezas independentes apontando para a mesma linha**: o checksum falta `51.676,20`, que
é `45,33 × 95 × 12`, e a contagem de palavras dá exatamente o tamanho dela. Nada além da `E1` foi
descartado naquela folha.

**As 77 da página 6 são prosa, e a aritmética prova.** As oito linhas daquela página somam
`128.532,13`, e `128.532,13 + 5.108,40` — a `E3`, na página 7 — `= 133.640,53`, exatamente o que foi
lido. A página 6 não perdeu item nenhum; as 77 palavras são texto de seção que nunca pertenceu a
linha alguma, como as 177 sobre SOA na página 25 do piloto.

**E é o que o contador existe para fazer.** Ele conta e não julga: separar *prosa* de *linha de
item* é trabalho do crivo de `R-GRD-11`, não da contagem. A mensagem dá a pista; a regra decide.

## 3. Objetivo

Que a linha de item impressa acima da moldura seja lida, e que a capa nomeie o órgão quando a
primeira página o nomeia com qualquer traço tipográfico — **sem mover uma vírgula do que as oito
peças do repositório extraem hoje**.

E que a próxima linha perdida se anuncie como página e contagem, não como diferença em reais.

**Não é objetivo:** adivinhar linha que o documento não imprime; alargar o crivo da cauda da ESPEC
032; nem mexer em como as geometrias são descobertas, admitidas ou fatiadas.

## 4. Escopo

### 4.1 Dentro do escopo

- A fronteira horizontal superior de `montar_grade`, quando as palavras acima dela são linha de item.
- O contador do que a grade descarta, no diagnóstico.
- O separador entre nome de órgão e sigla, em `_CLIENTE` e `_SIGLA`.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| `cauda_da_pagina` e o crivo de `R-CON-02` | Está certo, e é ele que impede prosa de virar descrição. Esta espec **acrescenta um caso antes dele**, não altera o dele |
| A leitura por faixa (`R-FXA-01` a `R-FXA-06`) | §2.3 mede que está operando corretamente na página do defeito |
| O crivo de admissão de geometrias | §2.3 mede que admite só a de itens, como deve |
| `V-CTR-03` como regra | Continua bloqueando pelo mesmo critério. Ganha o que dizer, não o que decidir |
| A cascata de `R-CAP-10` | Continua sendo a saída segura, e esta espec só reduz a frequência dela |
| O vocabulário de órgão (`D-04` da 034) | Inalterado. O FTM entra por `Fundação`, que já está lá |

## 5. Regras

| ID | Regra |
|---|---|
| `R-GRD-10` | A extração **conta**, por página, as palavras que caíram dentro do vão horizontal da tabela e **não** foram atribuídas a célula nenhuma. O número viaja em `DiagnosticoDaGrade` |
| `R-GRD-11` | Havendo, acima de `horizontais[0]` e dentro do vão da grade, um **código de serviço na coluna do código**, `montar_grade` sintetiza uma fronteira superior — o espelho da que a ESPEC 001 §9.4 já sintetiza no rodapé |
| `R-GRD-12` | **É tudo ou nada.** A fronteira só é sintetizada se as palavras órfãs forem **uma linha de item e nada mais**: um único código, e nenhuma palavra acima da linha visual dele. Havendo mais, não sintetiza — a página vai para `R-GRD-10` e o `V-CTR-03` a nomeia |
| `R-CON-06` | `R-GRD-11` decide **antes** da costura da cauda. Sintetizada a fronteira, não há órfãs, e `cauda_da_pagina` devolve vazio por construção — nunca as duas coisas sobre as mesmas palavras |
| `R-CAP-16` | O separador entre o nome do órgão e a sigla é **qualquer traço** — hífen, hifens tipográficos, en dash, em dash ou sinal de menos —, em `_CLIENTE` e em `_SIGLA`, com a mesma classe nos dois |
| `R-CAP-17` | **Invariante afirmado por extenso:** os nomes derivados das oito peças do repositório são os da tabela de §2.5, e os três documentos que não nomeiam órgão continuam devolvendo vazio |

### 5.1 Validações

**Nenhuma validação nova.** `V-CTR-03` e `V-CAP-01` ficam como estão — mudam quando disparam, não o
que fazem.

`V-CTR-03` ganha, **apenas quando há o que dizer**, o sufixo de `R-GRD-10`:

```
extração incompleta: a soma dos itens (…) não bate com o total declarado (…) —
diferença de … — e a grade descartou 14 palavras na página 7
```

Sem palavras descartadas, a mensagem sai **byte por byte igual à de hoje**. Nenhum teste e nenhum
artefato ancoram essa string hoje — conferido: a única ocorrência no repositório é a própria
`f-string` que a monta.

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **A fronteira superior é sintetizada, não descoberta** | A borda não está desenhada; procurá-la é procurar o que não existe. O rodapé já é resolvido assim desde a ESPEC 001 §9.4, e a assimetria entre topo e rodapé nunca foi escolha — foi ausência de caso |
| `D-02` | **O crivo é o código de serviço na coluna do código** | É o que separa *linha de item* de *cauda de descrição* e de *prosa*. Medido: das nove páginas do corpus que imprimem acima da grade, **zero** têm código nas órfãs, em qualquer coluna. O crivo não chega perto de disparar onde não deve |
| `D-03` | **Tudo ou nada** (`R-GRD-12`) | É a `D-02` da ESPEC 032, pelo mesmo motivo: sintetizar sobre um bloco que tem cauda *e* linha de item juntaria as duas na mesma célula, e produziria descrição que **parece** certa. Não ocorre em nenhuma peça; o custo de recusar é o comportamento de hoje |
| `D-04` | **`R-GRD-11` roda antes da cauda** (`R-CON-06`) | As duas leem a mesma região, e a ordem é o que garante que uma exclua a outra. Rodando depois, a cauda veria as palavras e as recusaria pelo crivo de coluna — e o resultado dependeria de qual olhou primeiro |
| `D-05` | **O contador entra mesmo se `T-01` derrubar o mecanismo** | `R-GRD-10` é a resposta à §2.6, e ela vale para qualquer causa. Foi a falta dele que fez o diagnóstico depender de aritmética sobre o valor declarado |
| `D-06` | **Classe de traços, e não normalização do texto** | Normalizar todo travessão para hífen antes de casar mexeria em `_PROPOSTA`, `_PROCESSO`, `_REFERENCIA` e nas descrições de item — quatro coisas que hoje funcionam, para corrigir uma. A classe alcança exatamente os dois padrões que precisam dela |
| `D-07` | **As duas metades numa espec só** | A mesma peça expõe as duas, e **as duas são necessárias para ela gerar certo**: `V-CTR-03` bloqueia, e sem `R-CAP-16` o relatório sairia com a capa degradada. Separar entregaria meia correção num documento que já está na fila |
| `D-08` | **`V-CTR-03` não deixa de bloquear** | Ela está certa: a extração **está** incompleta. Esta espec faz a extração ficar completa; a validação segue sendo a prova independente de que ficou |

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `infrastructure/contract/grid.py` | `montar_grade` ganha a fronteira superior sintética (`R-GRD-11`, `R-GRD-12`); `ler_celulas` passa a devolver, ao lado das linhas, a contagem de palavras não atribuídas (`R-GRD-10`) |
| `infrastructure/contract/pdfplumber_extractor.py` | Ordena `R-GRD-11` antes da costura (`R-CON-06`); acumula a contagem no diagnóstico; classe de traços em `_CLIENTE` e `_SIGLA` (`R-CAP-16`) |
| `domain/entities/contract.py` | `DiagnosticoDaGrade` ganha `palavras_descartadas: tuple[tuple[int, int], ...]` — **por último e com padrão**, como todos os campos acrescentados a ele |
| `infrastructure/validations/` | `V-CTR-03` ganha o sufixo condicional. Nenhuma regra nova, nenhuma severidade alterada |
| `application/`, `api/`, `frontend/` | **Nenhuma.** Nenhum contrato de API muda de forma |

## 8. Testes e critério de aceite

### 8.1 A medição que falta

| ID | Tarefa | Bloqueia? |
|---|---|---|
| `T-01` | Rodar `scripts/diagnosticar_linha_perdida.py <ftm.pdf> 7` e confirmar o mecanismo de §2.3: `horizontais[0]` abaixo da linha `E1`, e o `14.031.00018.00` entre as palavras descartadas | **Sim.** É o que separa `R-GRD-11` de uma correção escrita no escuro |

O arquivo precisa entrar em `backend/tests/fixtures/` para virar fixture da suíte — é a mesma
exigência que a ESPEC 033 fez do `PA-SMUL-250314-22`.

### 8.2 As regras

| Regra | Verificação |
|---|---|
| `R-GRD-11` | O `PA-FTM-251001-143` extrai **10 itens** e fecha em `185.316,73`; a linha `14.031.00018.00` sai com `45,33 · 95,00 · 12 · 51.676,20` por extenso |
| `R-GRD-12` | Caso construído, sem abrir PDF, no espírito de `_escolher_gabarito`: órfãs com um código e mais nada → sintetiza; órfãs com um código **e** palavras acima da linha dele → **não** sintetiza |
| `R-GRD-10` | O diagnóstico do FTM **antes** da correção acusa a página 7; **depois**, acusa zero. E as oito peças do corpus acusam zero nos dois estados |
| `R-CON-06` | Nas três páginas de cauda medidas (`contrato.pdf` p27 e p28, `contrato_pgm.pdf` p23), a cauda continua sendo costurada e **nenhuma** fronteira é sintetizada — o crivo de `D-02` não dispara nelas |
| `R-CAP-16` · `R-CAP-17` | Os nove nomes de §2.5 por extenso, um por peça, com os três vazios afirmados. E o nome do FTM **não contém** `FTMSP` — é o teste que pega o `_SIGLA` esquecido |

### 8.3 Regressão — a régua, medida no `HEAD` antes de qualquer código

`scripts/medir_extracao.py`, o instrumento que a ESPEC 033 criou para isto — as sete peças do
`CORPUS` dele mais o `aditivo_pgm_2.pdf`, que entrou depois e não tem tabela de itens. `sha` é o `sha256` da
lista de tuplas `(código, descrição, unidade, quantidade, preço, meses, total, página)` de **todos**
os itens:

| documento | itens | `TOTAL:` declarado | blocos | geometrias | `sha` no `HEAD` | exigido depois |
|---|---|---|---|---|---|---|
| `contrato.pdf` | 60 | 10.637.425,00 | 1 | 1 | `430e506cb76292f5` | **igual** |
| `contrato_pgm.pdf` | 47 | 24.551.037,72 | 1 | 1 | `b8a7117b631604f1` | **igual** |
| `aditivo_pgm.pdf` | 7 | −0,12 | 3 | 3 | `0e7ec8ef5ddcc631` | **igual** |
| `contrato_smul.pdf` | 41 | 27.415.244,95 | 1 | 1 | `6d0df30694ee2521` | **igual** |
| `aditivo_smul.pdf` | 16 | 364.793,93 | 3 | 4 | `fa22dd2ea6cb1d1e` | **igual** |
| `modelo.pdf` | 0 | — | 0 | 0 | `4f53cda18c2baa0c` | **igual** |
| `amostra_sem_tabela.pdf` | 0 | — | 0 | 0 | `4f53cda18c2baa0c` | **igual** |
| `aditivo_pgm_2.pdf` | 0 | — | 0 | 0 | `4f53cda18c2baa0c` | **igual** |
| `PA-FTM-251001-143` | 9 | 185.316,73 | 1 | ? | *(a medir em `T-01`)* | **10 · 185.316,73** |

**Igualdade de `sha`, e não amostragem.** É o único critério que pega o defeito que esta espec
poderia introduzir — uma linha a mais, colhida de prosa que passou pelo crivo — porque essa linha
não aparece em item que alguém escolheria conferir.

### 8.4 Por que a régua tende a não se mover

A não-regressão desta espec não é previsão: é **consequência aritmética da medição de §2.4**.

`R-GRD-11` só age em página que tenha código de serviço nas órfãs. No corpus inteiro esse número é
**zero** — não *baixo*, zero. Nove páginas imprimem acima da grade e nenhuma delas tem um código
lá. Enquanto isso valer, `montar_grade` devolve exatamente a mesma `Grade` de hoje para as oito
peças, e todo o resto do pipeline é função dela.

`R-CAP-16` é o mesmo argumento em outro campo: §2.5 mede as oito saídas, uma a uma, iguais.

**Critério de aceite:** qualquer `sha` de §8.3 que se mova reprova a entrega. Qualquer nome de
órgão de §2.5 que se mova reprova a entrega. Suíte de backend sem falha nova.

### 8.5 Inventário de âncoras

| Âncora | Efeito previsto |
|---|---|
| `test_grade_por_faixa.py`, `test_extractor_*`, `test_reconciliation.py` | **inalterados** — a `Grade` das oito peças não se move (§8.4) |
| `test_cauda_de_pagina.py` | **inalterado** — `R-CON-06` mede que o crivo não dispara nas três páginas de cauda |
| `test_capa.py` — cliente do piloto, do PGM e do SMUL | **inalterados** (§2.5) |
| `test_domain.py` — construções de `DiagnosticoDaGrade` | **inalterados**: campo novo por último e com padrão |
| a mensagem de `V-CTR-03` | **sem âncora no repositório** — conferido |
| `.docx` e `.xlsx` do piloto e do PGM, `linhas_do_documento.json`, `valores_do_contrato.json` | **inalterados** — nenhum item se move |
| `frontend/e2e/` | **inalterado** — nenhum contrato de API muda de forma |

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Sintetizar fronteira sobre prosa e inventar uma linha de item | `D-02` — o crivo é o código na coluna do código, e §2.4 mede **zero** ocorrências no corpus. O `sha` de §8.3 é o que pegaria |
| Juntar cauda e linha de item na mesma célula, produzindo descrição plausível e errada | `R-GRD-12` recusa o caso misto por completo. É a lição de ESPEC 032 §2.3: *degradado* é melhor que *errado* num documento que vai ao órgão |
| `T-01` derrubar o mecanismo de §2.3 | Declarado como pendência bloqueante, com o instrumento pronto. `R-GRD-10` e `R-CAP-16` valem de qualquer forma (`D-05`) |
| A classe de traços capturar um separador que não é separador | O padrão continua exigindo sigla em caixa alta depois dele, e §2.5 mede as oito peças iguais |
| O contador de `R-GRD-10` custar tempo | Zero leitura nova: é o mesmo laço que já percorre `extract_words()`. A ESPEC 026 continua valendo |
| A tabela do FTM ter mais defeitos além da `E1` | O checksum é a prova: `V-CTR-03` só cala em `185.316,73` |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | Por que o gerador omitiu a moldura superior nesta folha e não nas outras? Saber ajudaria a prever o próximo caso — mas não muda a correção, que trata o efeito | Não |
| `I-02` | Uma linha de item pode ficar acima da moldura **e** quebrar de página ao mesmo tempo, juntando `R-GRD-11` e `R-CON-01`? Não ocorre em peça nenhuma | Não — `R-GRD-12` recusa o caso misto, e o resultado é o de hoje |
| `I-03` | O contador de `R-GRD-10` deveria alimentar uma validação própria — um `V-CTR-07` que avisa mesmo com o checksum fechando? | Não. Fica para quando houver caso: hoje o checksum é a prova, e validação sem caso real é regra que envelhece sozinha |
| `I-04` | Há outros travessões tipográficos nas capas — `‒`, `―`? Só o `–` tem documento real; os demais entram na classe por antecipação, como o vocabulário da ESPEC 034 `D-04` | Não |

## 11. Relação com as ESPECs 001, 032 e 034

**Com a ESPEC 001**, esta é a metade que faltou. Aquela espec descobriu que a moldura não fecha no
rodapé e sintetizou a fronteira de baixo, nomeando os dois itens que se perdiam. A de cima não foi
recusada — nunca foi perguntada, porque nenhuma peça da amostra tinha linha de item acima da grade.

**Com a ESPEC 032**, é o terceiro caso da mesma região da folha. Aquela espec catalogou dois — cauda
de descrição e prosa — e construiu o crivo de coluna que os separa. Esta acrescenta o terceiro,
**reusando o crivo em vez de afrouxá-lo**: a linha de item é justamente o que reprova o crivo da
cauda, e é por isso que sumia calada.

**Com a ESPEC 034**, é a mesma classe de estreiteza uma casa adiante. Aquela trocou a frase pela
âncora do sintagma e ampliou o vocabulário por antecipação; ficou o separador, que continuou sendo
um caractere literal medido em seis documentos que usam hífen.

É o padrão que a ESPEC 033 §11 registrou e a 034 §11 repetiu: **uma correção resolve o lado que a
amostra mostra, e o lado restante espera o documento que o exiba.** O FTM é esse documento, duas
vezes.

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | `T-01` — o arquivo em `fixtures/`, a régua do `HEAD` e a confirmação do mecanismo | PP |
| B | Testes escritos antes: os 10 itens do FTM, o caso construído de `R-GRD-12`, as três páginas de cauda e os nove nomes de capa | P |
| C | `R-GRD-11` e `R-GRD-12` em `montar_grade`, com `R-CON-06` na ordem do extrator | P |
| D | `R-GRD-10` — contador, campo no diagnóstico e sufixo de `V-CTR-03` | PP |
| E | `R-CAP-16` | PP |
| F | Suítes, `medir_extracao.py` nas oito peças e conferência de `sha` por `sha` | PP |

**Estimativa: um dia.** As duas correções são pequenas; o trabalho está em A, B e F — e em F está o
que dá direito de dizer que nada regrediu.
