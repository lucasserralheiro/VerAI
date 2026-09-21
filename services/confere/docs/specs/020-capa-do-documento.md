# ESPEC 020 — A capa é do contrato que o documento comprova

| | |
|---|---|
| **Status** | **Implementada com ressalva** — 2026-08-17. Suíte 488 → 522. **O portão `P5` do PLANO 020 fica aberto**: exige conferência no Word. Emendas em §14 |
| **Versão** | 1.3 — 2026-08-17. A §2.1 modelava a capa por parágrafo, e a unidade é o nó `<w:t>`; ver §13 |
| **Depende de** | [ESPEC 003](003-relatorio-em-docx.md), [ESPEC 018](018-o-relatorio-segue-o-contrato.md) e [ESPEC 019](019-contrato-e-aditivos.md) — implementadas |
| **Revisa** | `R-DOC-02` (a capa é reproduzida como está no modelo). Ver `D-01` |
| **Resolve** | `I-01` da ESPEC 018 — *"a capa fixa. **Não bloqueia a espec, bloqueia a entrega.** Espec própria em seguida"* |
| **Referência normativa** | `backend/src/infrastructure/report/modelo_prodam.docx` e os dois pares reais |
| **Origem** | Gerado o documento do PGM, a capa diz `SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA` e `Contrato : TC 52/SMIT/2024 - TA 02` |

---

## 1. Problema

O relatório do PGM está pronto. A capa dele é do SMIT.

```
SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA
SMIT SUSTENTAÇÃO
Contrato : TC 52/SMIT/2024 - TA 02
Proposta : PC-SMIT-240402-53 V1.0 / PA-SMIT-250220-15 V 1.4 / PA-SMIT-260319-739
```

Não é um detalhe de acabamento. **É o pior defeito que este produto pode ter**, e por três razões
que se somam:

- o documento vai ao órgão como comprovação de faturamento, e a capa nomeia **outro cliente**;
- da página 2 em diante está tudo certo, o que torna o erro fácil de não ver na conferência;
- expõe a um terceiro o número de contrato e as propostas de outro órgão.

A ESPEC 018 registrou isso como `I-01` e foi explícita: *"não bloqueia a espec, bloqueia a
entrega"*. A ESPEC 019 fez o PGM gerar 58 linhas corretas — e deixou o mesmo bilhete. **Enquanto
esta espec não for implementada, o produto tem exatamente um cliente.**

---

## 2. O que foi medido

Tudo lido dos arquivos reais com o código de produção. Nada é suposto.

### 2.1 A capa são três caixas de três nós `<w:t>`, e cada uma vem duplicada

O modelo tem **6 blocos `w:txbxContent`**: três caixas de texto, cada uma repetida por
`mc:AlternateContent` — o mecanismo pelo qual o Word guarda uma representação moderna e uma de
compatibilidade da mesma forma. Lidas na ordem:

```
caixa 1 · t0  UTILIZAÇÃO DE RECURSOS DE INFRAESTRUTURA          fixo — o que o documento é
caixa 1 · t1  SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA     CLIENTE
caixa 1 · t2  SMIT SUSTENTAÇÃO                                  SUBTÍTULO

caixa 2 · t0  Contrato : TC 52/SMIT/2024 - TA 02                CONTRATO
caixa 2 · t1  Proposta : PC-SMIT-240402-53 V1.0 / PA-SMIT-…-15 V 1.4 /   PROPOSTAS
caixa 2 · t2  PA-SMIT-260319-739                                PROPOSTAS (continuação da quebra)

caixa 3 · t0  DIRETORIA DE INFRAESTRUTURA E TECNOLOGIA          fixo — a PRODAM
caixa 3 · t1  GIO - GERÊNCIA DE OPERAÇÕES                       fixo — a PRODAM
caixa 3 · t2  PA-SMIT-260319-739                                PROPOSTAS (rodapé da capa)
```

**A unidade é o nó `<w:t>`, não o parágrafo** — e a distinção não é acadêmica. Medidos os
parágrafos por caixa: **3, 4 e 2**. A caixa do contrato tem um parágrafo **vazio** entre `Contrato :`
e `Proposta :`, e na do rodapé o `GIO` e a proposta dividem o **mesmo parágrafo**, em dois *runs*.

Já os nós `<w:t>` são **exatamente três em todas as seis caixas**, e cada campo é um deles inteiro.
Endereçar por parágrafo erraria em duas das três caixas. A versão 1.1 desta espec dizia *"três
caixas de três parágrafos"*, e a T-1404 pegou o erro antes de existir código (§14.1).

**`PA-SMIT-260319-739` aparece em dois papéis diferentes** — continuação da linha `Proposta :` na
caixa 2, e rodapé da capa na caixa 3 —, e é por isso que ele soma 4 ocorrências no XML contra 2 de
cada um dos outros. Endereçar os campos por casamento de cadeia escreveria a lista de propostas nos
dois lugares e a duplicaria na caixa 2 (`D-09`).

### 2.2 Cada texto vive num único `<w:t>`

| texto | está num `<w:t>` único? | ocorrências |
|---|---|---|
| `UTILIZAÇÃO DE RECURSOS DE INFRAESTRUTURA` | **sim** | 2 |
| `SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA` | **sim** | 2 |
| `SMIT SUSTENTAÇÃO` | **sim** | 2 |
| `Contrato : TC 52/SMIT/2024 - TA 02` | **sim** | 2 |
| `Proposta : PC-SMIT-240402-53 V1.0 / …` | **sim** | 2 |
| `PA-SMIT-260319-739` | **sim** | **4** |
| `DIRETORIA DE INFRAESTRUTURA E TECNOLOGIA` | **sim** | 2 |
| `GIO - GERÊNCIA DE OPERAÇÕES` | **sim** | 2 |

**Os oito, sem exceção, num `<w:t>` só.** É o que torna esta espec barata: escrever num campo é
trocar o conteúdo de um nó, sem tocar em fonte, posição, cor ou na arte da capa (`D-01`).

### 2.3 Todo o resíduo está em `word/document.xml`

Varrido o pacote inteiro do modelo à procura de `SMIT`:

```
word/document.xml : 12 ocorrências
(nenhuma outra parte)
```

Nada em `docProps/core.xml`, `word/header1.xml`, `word/footer1.xml` ou nas relações. A varredura de
`R-CAP-09` é barata e uma parte só a cobre — mas continua sendo escrita sobre o **pacote**, porque a
afirmação que interessa é *nada do outro contrato sai daqui*, e não *a capa está certa* (`D-06`).

### 2.4 As quatro derivações, e o que elas produzem

| campo | fonte | piloto SMIT | PGM |
|---|---|---|---|
| **cliente** | prosa da página 1 da proposta | `SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA` | `PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO` |
| **subtítulo** | título da aba `Levantamento` | `SMIT SUSTENTAÇÃO` | `PGM TC 015` |
| **contrato** | `contrato_referencia` da aba | `TC 52/SMIT/2024` | `TC 015/PGM/2024` |
| **propostas** | `Report.propostas` (ESPEC 019) | `PA-SMIT-260319-739` | `PA-PGM-251015-159 / PA-PGM-260304-715` |

**A verificação mais forte disponível:** rodadas as regras sobre o piloto, o cliente sai
`SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA` e o subtítulo sai `SMIT SUSTENTAÇÃO` — **as duas
idênticas, caractere por caractere, ao que o modelo já traz gravado**. A derivação reproduz a capa
cuja correção é conhecida. Não é semelhança: é a mesma cadeia.

### 2.5 O separador da sigla **não** é o mesmo nos dois documentos

A frase de onde o cliente sai, medida:

```
SMIT:  'Secretaria Municipal de Inovação e Tecnologia- SMIT'    ← sem espaço antes do hífen
PGM:   'Procuradoria Geral do Município de São Paulo - PGM'     ← com espaço
```

Um `rsplit(' - ')` — a leitura natural de *"sem a sigla"* — funciona no PGM e **falha no SMIT**,
deixando `TECNOLOGIA- SMIT` na capa. E falha do jeito pior: no par cuja capa correta já se conhece,
onde ninguém olharia duas vezes. Daí `R-CAP-04` escrever o padrão, e não a intenção.

O aditivo do PGM **não traz a frase** — o que é indiferente, porque o cliente vem da proposta.

### 2.6 O que **não** é derivável

| não derivável | onde aparece | por quê |
|---|---|---|
| ` - TA 02` | `Contrato : TC 52/SMIT/2024 - TA 02` | o número do termo aditivo não está em fonte nenhuma. A ESPEC 009 §6.2 já o registrou |
| `V1.0`, `V 1.4` | na pilha de propostas | o extrator lê o identificador, não a versão |
| a pilha **completa** | `PC-SMIT-240402-53 / PA-SMIT-250220-15 / …` | a proposta do PGM declara a sua em prosa; **a do SMIT não declara nada** |

A pilha completa é o caso mais interessante, e é assimétrico: o `PA-PGM-251015-159` diz *"Os
serviços previstos são os constantes da Proposta Técnica Comercial - PC-PGM-240715-100 v7,
PA-PGM-250320-24 v1, PA-250409-037 v1 e PA-PGM-250930-142 v4"*, e o `PA-SMIT-260319-739` não traz
frase equivalente. Derivar de um e não do outro produziria capas de formato diferente por órgão.

### 2.7 A aba `Capa` do levantamento existe e está vazia

Os dois arquivos trazem uma aba chamada `Capa`. Medida:

```
SMIT  — aba Capa: 1 linha × 1 coluna, nenhum texto
PGM   — aba Capa: 1 linha × 1 coluna, nenhum texto
```

Ela carrega **um desenho**, não dados. Foi a primeira hipótese que testei — seria a fonte ideal — e
está descartada por medição, não por opinião.

### 2.8 O que a suíte afirma hoje sobre a capa

```python
def test_a_capa_e_identica_a_do_modelo(gerado):
    assert _caixas_de_texto(gerado) == _caixas_de_texto(MODELO)

def test_a_capa_traz_o_conteudo_esperado(gerado):
    assert "SMIT SUSTENTAÇÃO" in achatado
    assert "TC 52/SMIT/2024" in achatado
```

**A suíte protege o defeito.** O primeiro teste é a `R-DOC-02` escrita como asserção — *a capa é
reproduzida como está* —, e ele fica vermelho no instante em que a capa passar a ser preenchida.
Não é um teste ruim: era a regra certa quando havia um cliente só. Ele **inverte de sentido**
(`D-08`), não é apagado.

E os dois usam a fixture `relatorio_vazio`, cujo `titulo` é `"LEVANTAMENTO - COMPROVAÇÃO"` — que
**não casa** o padrão de `R-CAP-05`. A cascata de `D-10` existe por causa dela.

---

### 2.9 O documento do PGM contém `SMIT` por um motivo legítimo

Gerado o documento do par completo do PGM com o código de hoje, e varrido o pacote:

```
ocorrências de "SMIT" em word/document.xml : 13
partes do pacote que contêm "SMIT"          :  1
```

Discriminadas:

| cadeia | origem | é resíduo? |
|---|---|---|
| `Contrato : TC 52/SMIT/2024 - TA 02` | modelo | **sim** |
| `Proposta : PC-SMIT-240402-53 V1.0 / PA-SMIT-250220-15 V 1.4 /` | modelo | **sim** |
| `PA-SMIT-260319-739` | modelo, 4× | **sim** |
| `SMIT SUSTENTAÇÃO` | modelo | **sim** |
| **`SMIT`** | **aba `NAS` do levantamento do PGM** | **não — dado do cliente** |

São **12 de resíduo e 1 legítima**. A décima terceira é uma célula da planilha que o próprio
cliente enviou, e que vira linha de anexo corretamente.

**Isto define a forma do critério de aceite.** Ele é sobre **as cadeias identificadoras do modelo**,
nunca sobre a palavra `SMIT` — que o documento do PGM contém, e vai continuar contendo.

## 3. Objetivo

**A capa nomeia o contrato que o documento comprova.**

Nenhum dado de outro cliente sobrevive no documento gerado — o que é verificável por varredura, e é
o critério de aceite (§9.3).

---

## 4. Escopo

### 4.1 Dentro do escopo

- Os cinco campos variáveis da capa passam a ser preenchidos (`R-CAP-01` a `R-CAP-07`).
- Os campos são endereçados por **posição**, e todas as cópias do `mc:AlternateContent` recebem o
  mesmo valor (`R-CAP-03`, `R-CAP-10`).
- Os três textos institucionais da PRODAM ficam como estão (`R-CAP-08`).
- `V-CAP-01` — o cliente não pôde ser derivado da proposta (§8).
- Os dois testes de capa são convertidos (`D-08`), e entra a varredura de resíduo (`R-CAP-09`).

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| **A arte, as fontes e o posicionamento da capa** | Só o texto dentro dos parágrafos muda. §2.2 mede que isso é uma troca de cadeia (`D-01`) |
| O número do termo aditivo (` - TA 02`) | §2.6 — não está em fonte nenhuma. `D-03` decide não inventar. Ver `I-01` |
| As versões das propostas (`V1.0`) | idem |
| Reconstruir a pilha histórica de propostas | §2.6 — o SMIT não a declara. A capa nomeia **as peças submetidas** (`D-04`) |
| O timbrado, o rodapé e o corpo | A ESPEC 019 `D-09` acabou de mexer no rodapé; nada aqui o toca |
| Ajustar a caixa para caber muitas propostas | `I-05` — o limite não foi medido. Ver §10 |

---

## 5. Regras

| ID | Regra |
|---|---|
| `R-CAP-01` | A capa é preenchida com os dados do par submetido. **Nenhum texto do modelo que identifique um contrato pode sobreviver** ao documento de outro |
| `R-CAP-02` | O preenchimento é **substituição do texto do `<w:t>`**. Fonte, tamanho, cor, posição e a arte da capa não são tocados |
| `R-CAP-03` | Os campos são endereçados por **posição — `(caixa lógica, parágrafo)`** —, nunca por casamento de cadeia. Cada caixa lógica tem **duas cópias** no pacote (`mc:AlternateContent`), e as duas recebem o mesmo valor |
| `R-CAP-04` | O **cliente** é o texto que segue `prestação de serviços para a` na primeira página da proposta, até o primeiro ponto final, **sem a sigla** — removido o sufixo `-` seguido de duas ou mais maiúsculas — e em caixa alta. O separador da sigla **pode ou não** ter espaço antes do hífen (§2.5) |
| `R-CAP-05` | O **subtítulo** é o miolo do título da aba `Levantamento`, entre `LEVANTAMENTO - COMPROVAÇÃO ` e ` - CATÁLOGO DE SERVIÇOS DIT` |
| `R-CAP-06` | O **contrato** é o `contrato_referencia` da aba, **sem sufixo**: a aplicação não conhece o número do termo aditivo e não o inventa |
| `R-CAP-07` | As **propostas** são as peças submetidas, na ordem de submissão (ESPEC 019 `R-ADT-11`), unidas por ` / `. O texto inteiro vai para `caixa 2 · ¶1`, prefixado por `Proposta : `; `caixa 2 · ¶2` fica **vazio**; `caixa 3 · ¶2` recebe a mesma lista, sem prefixo |
| `R-CAP-08` | `UTILIZAÇÃO DE RECURSOS DE INFRAESTRUTURA`, `DIRETORIA DE INFRAESTRUTURA E TECNOLOGIA` e `GIO - GERÊNCIA DE OPERAÇÕES` **ficam**: identificam a PRODAM, não o cliente |
| `R-CAP-09` | O documento gerado **não contém** nenhuma das cadeias do modelo que identificam um contrato. É afirmação sobre o pacote inteiro, não sobre a capa |
| `R-CAP-10` | Nenhum campo da capa fica vazio. Subtítulo indisponível cai para o `contrato_referencia`; cliente indisponível cai para o subtítulo (`D-10`) |

---

## 6. Decisões

### `D-01` — Substituir o texto, não reconstruir a capa

§2.2 mede o que autoriza: os oito textos estão, cada um, num `<w:t>` único. Preenchê-los é trocar o
conteúdo de oito nós, e nada mais.

A alternativa — remontar as caixas de texto com `python-docx` — exigiria reproduzir fonte, corpo,
cor, espaçamento, alinhamento e posição de cada uma, com a arte de fundo por cima. Seria reescrever
a capa para mudar quatro linhas dela, e a primeira diferença de milímetro apareceria no documento
que vai ao órgão.

`R-DOC-02` — *"a capa é reproduzida como está"* — fica revista no que diz respeito ao **texto**, e
intacta no que diz respeito à **forma**. É a mesma divisão que a ESPEC 018 `D-10` fez com o corpo:
muda o conteúdo, não muda a diagramação.

### `D-02` — Todas as cópias, sempre

`mc:AlternateContent` guarda duas representações da mesma forma, e **o Word escolhe uma conforme a
versão**. Preencher só a primeira produz um documento que mostra o cliente certo em uma máquina e o
errado em outra — defeito que não se reproduz onde se testa.

Por isso `R-CAP-03` fala nas **duas cópias de cada caixa**, e por isso `R-CAP-09` varre o **pacote**
e não lê a capa: a asserção precisa alcançar a representação que o teste não está lendo.

### `D-09` — Os campos são endereçados por posição, não por cadeia

**A correção mais importante da revisão.** A versão 1.0 mandava *"substituir todas as ocorrências de
cada texto"*, e §2.1 mede por que isso quebra: `PA-SMIT-260319-739` aparece em **dois papéis** — a
continuação da linha `Proposta :` na caixa 2 e o rodapé da capa na caixa 3.

Casando por cadeia, a lista de propostas iria para os dois lugares **e** ficaria duplicada na caixa
2, que já a teria recebido no parágrafo anterior. O resultado seria uma capa errada de um jeito
novo — que é exatamente o que esta espec existe para não fazer.

O endereço é `(caixa lógica, parágrafo)`, com a caixa lógica cobrindo as suas duas cópias. É estável
porque a **estrutura** da capa não muda: três caixas de três parágrafos, e §9.1 a põe no portão de
não-regressão.

**Sobre o rodapé da capa (`caixa 3 · ¶2`):** no modelo ele traz a mesma proposta que a caixa 2 —
com uma peça, o identificador aparece nos dois lugares. A generalização fiel é repetir a lista
inteira, e é o que `R-CAP-07` manda. Não invento hierarquia entre as peças que o documento não
declara.

### `D-03` — O que a aplicação não sabe, ela não escreve

A capa do modelo diz `Contrato : TC 52/SMIT/2024 - TA 02`. A aplicação conhece `TC 52/SMIT/2024` e
**não conhece** o ` - TA 02` (§2.6).

O princípio já está estabelecido — a ESPEC 009 §6.2 recusou o mesmo sufixo na planilha de análise,
*"inventá-las aqui gravaria no código um dado que a aplicação não tem como saber"*. A capa segue a
mesma regra e sai `Contrato : TC 015/PGM/2024`.

**Custo declarado:** o documento do SMIT deixa de dizer ` - TA 02`. É perda real de informação para
quem confere, e está em `I-01`. A alternativa — um campo a mais no formulário — troca um defeito
silencioso por um campo que alguém preenche errado, e fica registrada como caminho pronto.

### `D-04` — As propostas da capa são as peças submetidas

Não a pilha histórica. §2.6 mede que ela é irrecuperável de forma uniforme: o PGM declara a sua em
prosa, o SMIT não declara nada.

A capa passa a nomear **o que gerou este documento** — que é, aliás, a leitura mais útil para quem
o confere, e a mesma informação que a ESPEC 019 `D-09` pôs no rodapé. Com o par completo do PGM:

```
Proposta : PA-PGM-251015-159 / PA-PGM-260304-715
```

### `D-05` — O cliente vem da prosa, e essa é a dívida desta espec

`R-CAP-04` lê o nome do órgão de uma frase em português. **É a única derivação por prosa em todo o
projeto** — tudo o mais sai de estrutura: grade desenhada no PDF, célula de planilha, rótulo de
bloco. Prosa é a fonte que mais muda sem avisar, e isso fica dito e não escondido.

Três coisas limitam o dano, e as três são medidas:

1. o padrão casa nas **duas** propostas reais, e o resultado do piloto é **idêntico** ao do modelo
   (§2.4) — a regra reproduz a capa cuja correção se conhece;
2. o separador da sigla varia, e `R-CAP-04` descreve o padrão em vez da intenção (§2.5);
3. quando não casar, a capa **não fica com o nome de ninguém**: cai para o subtítulo (`D-10`), e
   `V-CAP-01` avisa.

`PGM TC 015` no lugar de `PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO` é menos formal e **nunca é
o cliente errado**.

**Alternativa descartada:** derivar a sigla do `contrato_referencia` — `TC 015/PGM/2024` → `PGM`.
É estrutural e infalível, e dá a sigla onde a capa quer o nome por extenso. Fica como o degrau
seguinte da cascata se a prosa se mostrar frágil em campo.

### `D-10` — A cascata dos vazios, e por que ela é necessária

**Segunda correção da revisão.** A 1.0 mandava o cliente cair para o subtítulo, e não dizia o que
fazer quando o **subtítulo** não existisse. §2.8 mede que isso acontece na própria suíte: a fixture
`relatorio_vazio` tem `titulo="LEVANTAMENTO - COMPROVAÇÃO"`, que não casa o padrão — e o cliente
cairia num vazio, deixando em branco a linha mais visível da capa.

A cascata fecha em algo que sempre existe:

```
cliente     ← prosa da proposta   →  subtítulo  →  contrato_referencia
subtítulo   ← título da aba       →  contrato_referencia
contrato    ← contrato_referencia
```

`contrato_referencia` vem da aba e é lido em todo levantamento válido. Se ele também faltar, o
documento já não é gerado: `V-MED-02` bloqueia antes.

### `D-06` — A varredura é o critério de aceite, e não uma asserção a mais

`R-CAP-09` verifica que **nenhuma cadeia identificadora do modelo sobrevive** no pacote gerado. É a
formulação direta do defeito: *o documento do PGM não pode conter `SMIT`*.

Vale mais que conferir a capa campo a campo porque não depende de eu ter listado os campos certos.
Se o modelo mudar e ganhar uma nona menção ao SMIT, este teste acusa e os outros não — e §2.3 mede
que hoje são doze, todas numa parte só do pacote.

### `D-07` — A capa é preenchida no renderizador, com os dados que o `Report` já tem

Quatro dos cinco campos já estão no agregado: `contrato_referencia`, `titulo` e `propostas`
(ESPEC 019). Só o **cliente** é novo, e entra como `Report.cliente`.

Ele é derivado na **extração do contrato**, junto de `proposta` — é dado da primeira página do PDF,
e é lá que a primeira página já é lida. O renderizador não abre PDF.

**Terceira correção da revisão:** `Contract.aplicar`, que a ESPEC 019 introduziu, monta um `Contract`
novo a partir de uma lista fixa de campos. `cliente` precisa entrar nela, ou o consolidado sai sem
cliente — e a capa quebraria **exatamente no caso com aditivo**, que é o do PGM. Ver §7.

### `D-08` — Os dois testes de capa invertem, e ficam mais fortes

`test_a_capa_e_identica_a_do_modelo` afirma hoje a igualdade total. Passa a afirmar a igualdade
**menos os campos preenchidos**: os textos institucionais de `R-CAP-08` continuam idênticos, e a
estrutura — três caixas de três parágrafos, seis blocos — não muda.

`test_a_capa_traz_o_conteudo_esperado` deixa de citar `SMIT SUSTENTAÇÃO` e passa a citar o que foi
submetido, **nos dois pares**. É o teste que teria pegado o defeito se existisse com o segundo par.

---

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `infrastructure/contract/pdfplumber_extractor.py` | Entra `_cliente(pdf)` — o nome do órgão da primeira página, ao lado do `_proposta` que já está lá (`D-07`) |
| `domain/entities/contract.py` | `Contract.cliente: str = ""`. **E `aplicar` passa a repassá-lo** — sem isso o consolidado do PGM perde o cliente (`D-07`) |
| `domain/entities/report.py` | `Report.cliente: str = ""` |
| `application/use_cases/generate_measurement_report.py` | Repassa `cliente` do contrato para o relatório |
| `infrastructure/report/docx_renderer.py` | Entra `_preencher_a_capa` — escreve nos `<w:t>` endereçados por `(caixa, parágrafo)` (`R-CAP-02`, `R-CAP-03`). É o único ponto que mexe no XML da capa |
| `infrastructure/report/modelo.py` | Entram o mapa de posições dos campos e a lista das cadeias identificadoras do modelo — em um lugar só, e é dela que `R-CAP-09` deriva a varredura |
| `infrastructure/validations/` | Entra `v_cap_01_cliente_nao_derivado` |
| `backend/tests/conftest.py` | `relatorio_vazio` ganha `cliente` e um `titulo` que case o padrão — **e um segundo fixture que não case**, para exercitar `D-10` |
| `backend/tests/test_docx_estrutura.py` | Os dois testes de capa convertidos (`D-08`) |
| `backend/tests/` | Entra a varredura de resíduo e a capa do PGM |

**O modelo `modelo_prodam.docx` não é alterado.** Continua sendo entrada, e o teste
`test_o_modelo_nao_e_alterado` continua valendo sem mudança.

---

## 8. Validações

### 8.1 Entra

| ID | Severidade | Quando dispara | Por quê |
|---|---|---|---|
| `V-CAP-01` | `AVISA` | O nome do cliente não pôde ser derivado da primeira página da proposta | A capa cai para o subtítulo (`D-10`) e o documento sai. Quem confere precisa saber que a identificação do órgão é a curta, e não a formal. Não dispara em nenhum dos dois pares |

### 8.2 Não entra, e por quê

**Não há validação bloqueante nesta espec.** O caminho de falha — cliente não derivável — tem uma
saída segura e correta, e bloquear a geração por causa de uma linha de capa seria pior que o
problema.

A garantia dura é o **teste** de `R-CAP-09`, e não uma validação em tempo de execução: resíduo do
modelo no pacote é defeito de código, não condição do insumo. Insumo mau vira achado; código mau
vira teste vermelho.

---

## 9. Testes e critério de aceite

### 9.1 O portão de não-regressão

Duas categorias, e confundi-las é o que torna um portão de não-regressão inútil: **intocável** é o
que não pode mudar; **sancionado** é o que muda, e exatamente assim. Sem a segunda lista, quem vir
uma diferença não consegue distinguir *"era esperado"* de *"quebrou"*.

#### Intocável

`test_nenhuma_parte_do_pacote_se_perde`, `test_fontes_imagens_e_timbrado_sobrevivem`,
`test_o_modelo_nao_e_alterado`, as duas seções de `R-DOC-03`/`R-DOC-04`, a ausência de página em
branco, o determinismo de `R-DOC-10`, e tudo o que a ESPEC 004 afirma sobre os anexos.

**A estrutura da capa entra no portão**, porque `D-09` passa a depender dela: seis blocos
`w:txbxContent`, três parágrafos cada.

E o **corpo do documento**: fora das seis caixas da capa, o texto do piloto é idêntico ao de hoje.
Nada na suíte afirma isso hoje — os 488 testes o cobrem indiretamente —, e a espec abre o
renderizador.

#### Sancionado — o delta da capa do piloto

Dos nove parágrafos da capa, **seis não se movem e três mudam**:

| parágrafo | | valor |
|---|---|---|
| `caixa 1 · ¶0` | **idêntico** | `UTILIZAÇÃO DE RECURSOS DE INFRAESTRUTURA` |
| `caixa 1 · ¶1` | **idêntico** | `SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA` |
| `caixa 1 · ¶2` | **idêntico** | `SMIT SUSTENTAÇÃO` |
| `caixa 3 · ¶0` | **idêntico** | `DIRETORIA DE INFRAESTRUTURA E TECNOLOGIA` |
| `caixa 3 · ¶1` | **idêntico** | `GIO - GERÊNCIA DE OPERAÇÕES` |
| `caixa 3 · ¶2` | **idêntico** | `PA-SMIT-260319-739` |
| `caixa 2 · ¶0` | **muda** | `Contrato : TC 52/SMIT/2024 - TA 02` → `Contrato : TC 52/SMIT/2024` |
| `caixa 2 · ¶1` | **muda** | `Proposta : PC-SMIT-240402-53 V1.0 / PA-SMIT-250220-15 V 1.4 /` → `Proposta : PA-SMIT-260319-739` |
| `caixa 2 · ¶2` | **muda** | `PA-SMIT-260319-739` → *(vazio)* |

As três mudanças são o custo que `D-03` e `D-04` declaram — o ` - TA 02` e a pilha histórica —, aqui
convertido de prosa em asserção. **Custo declarado num texto de decisão não é custo verificado.**

Que **dois** dos campos derivados saiam idênticos ao modelo é o oráculo de `D-05`, e é a razão de o
piloto valer mais que o PGM como prova: ver §9.4.

### 9.2 Cobertura nova

| Nível | Cobertura |
|---|---|
| **`R-CAP-09`** | **O documento do PGM não contém nenhuma das cinco cadeias identificadoras do modelo** — varredura do pacote inteiro, e não da capa. São **12 ocorrências** hoje. É o critério de aceite |
| **`R-CAP-09`** | **A lista de cadeias é necessária e suficiente**: cobre as 12 do modelo e **não** casa a palavra `SMIT` que a aba `NAS` do levantamento do PGM traz numa célula, e que sai legitimamente no anexo (§2.9) |
| `R-CAP-09` | Simétrico: o documento do piloto não contém nenhuma cadeia identificadora do PGM |
| **`R-CAP-03` / `D-09`** | **`caixa 3 · ¶2` recebe a lista de propostas e `caixa 2 · ¶2` fica vazio** — é o teste que pega a substituição por cadeia, que escreveria nos dois e duplicaria na caixa 2 |
| `R-CAP-03` | Os campos das duas cópias de cada caixa lógica são iguais entre si — pega o preenchimento pela metade (`D-02`) |
| **`R-CAP-04`** | **`Secretaria Municipal de Inovação e Tecnologia- SMIT` → `SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA`**, e `…São Paulo - PGM` → `…SÃO PAULO`. Os dois separadores, no mesmo teste (§2.5) |
| `R-CAP-04` | O resultado do piloto é **idêntico ao do modelo**, caractere por caractere |
| `R-CAP-05` | O subtítulo do piloto é `SMIT SUSTENTAÇÃO`; o do PGM, `PGM TC 015` |
| **`R-CAP-10` / `D-10`** | **Título fora do padrão cai para `contrato_referencia`; cliente não derivado cai para o subtítulo.** Nenhum campo da capa sai vazio |
| `R-CAP-06` | A capa do PGM diz `Contrato : TC 015/PGM/2024`, **sem** sufixo inventado |
| `R-CAP-07` | Com o aditivo, a capa do PGM diz `Proposta : PA-PGM-251015-159 / PA-PGM-260304-715` |
| `R-CAP-08` | Os três textos da PRODAM saem idênticos aos do modelo nos dois pares |
| `V-CAP-01` | Dispara com proposta cuja primeira página não traz a frase; não dispara nos dois pares |
| `D-08` | A capa difere do modelo **apenas** nos cinco campos variáveis |
| **§9.1** | **O delta sancionado do piloto**: os seis parágrafos idênticos e os três mudados, com os valores transcritos do modelo |
| **§9.1** | **Invariância do corpo**: no piloto, o texto fora das seis caixas da capa é idêntico ao de hoje |
| — | Nome de órgão com `&` é escapado e o pacote continua abrindo (§10) |

### 9.3 O critério de aceite

**Gerado o documento do par do PGM, nenhuma das cinco cadeias identificadoras do modelo aparece no
pacote — e o documento do piloto continua saindo com a capa que sempre teve, agora por derivação e
não por estar gravada.**

O critério é sobre **as cadeias do modelo**, e não sobre a palavra `SMIT`: §2.9 mede que o
documento do PGM contém `SMIT` por um motivo legítimo, e um critério escrito sobre a palavra seria
inatingível.

### 9.4 O piloto prova; o PGM confere

As duas metades do critério **não têm o mesmo peso**, e tratá-las como se tivessem é o modo mais
fácil de se enganar aqui.

**O piloto tem oráculo.** A capa correta dele existe, gravada no modelo, escrita por quem sabia o
que devia estar lá. Que a derivação a reproduza caractere por caractere (§2.4) é prova externa: o
resultado é conferido contra algo que o código não produziu.

**O PGM não tem.** Nada independente afirma que `PGM TC 015` é o subtítulo certo, ou que o cliente
deva ser o nome formal em vez da sigla. Asserção do tipo *"a capa diz o que a derivação produziu"*
compara o código consigo mesmo. O que o PGM prova de verdade é o **negativo** — que nenhuma cadeia
do SMIT sobrou (`R-CAP-09`) —, e isso é forte, mas é outra coisa.

O único oráculo do PGM é humano, e está no insumo `K-20` do PLANO 020: alguém abre o documento e
confere. É por isso que o plano tem um portão que nenhum teste encerra.

A segunda metade é o que prova que a derivação está certa: o piloto é o documento cuja capa correta
já se conhece, e §2.4 mede que a derivação a reproduz caractere por caractere.

---

## 10. Riscos

| Risco | Mitigação |
|---|---|
| **O preenchimento pela metade**, por causa do `mc:AlternateContent` | `D-02`, e o teste que compara as duas cópias de cada caixa. É o defeito que não se reproduz na máquina de quem testa |
| **Endereçar por cadeia e escrever no campo errado** | `D-09`. Era o defeito da versão 1.0 desta espec, e tem teste próprio |
| **A derivação do cliente falhar** num contrato de outro órgão | `D-05` e `D-10` — cascata até o `contrato_referencia`, com `V-CAP-01`. Nunca fica com o nome de outro cliente |
| **O separador da sigla variar** de novo | `R-CAP-04` descreve o padrão, e §9.2 testa as duas formas medidas. Uma terceira forma cairia no *fallback*, não numa capa errada |
| A capa perder o ` - TA 02` e alguém sentir falta | `D-03` e `I-01`. É perda declarada, e o caminho de volta — um campo no formulário — está descrito |
| **Estouro da caixa de texto** com muitas propostas | **Não medido** (`I-05`). A linha já ocupa duas no modelo com três peças; caixa do Word não cresce sozinha. O corte aconteceria na abertura, e o `python-docx` não o acusa. Se ocorrer, abreviar a lista resolve sem mudar regra |
| **Quebrar o pacote** ao mexer no `document.xml` | A escrita é no texto do `<w:t>`, sem tocar em marcação. `test_nenhuma_parte_do_pacote_se_perde` e a abertura por `python-docx` nos testes cobrem |
| Texto que **contenha caractere de marcação** (`&`, `<`) | O nome do órgão vem de PDF e pode trazer `&`. A escrita escapa o que insere — teste com nome sintético |
| O modelo ganhar uma menção nova ao SMIT numa revisão futura | `R-CAP-09` varre o pacote e acusa, mesmo sem ninguém atualizar a lista de campos (`D-06`) |
| **A estrutura da capa mudar** numa revisão do modelo, e `D-09` endereçar o parágrafo errado | §9.1 põe a estrutura no portão: seis blocos, três parágrafos cada. Um modelo novo com outra forma para a suíte antes de produzir capa errada |

---

## 11. Pontos em aberto

| ID | Questão | Bloqueia? |
|---|---|---|
| **`I-01`** | O ` - TA 02` faz falta na capa? Se fizer, entra como campo opcional no formulário — e aí vale para o número do termo **e** para a pilha histórica de propostas | **Não.** `D-03` decide por não inventar, e o documento sai |
| `I-02` | `UTILIZAÇÃO DE RECURSOS DE INFRAESTRUTURA` vale para todo contrato, ou muda com o objeto? Nenhuma fonte oferece alternativa | Não. `R-CAP-08` o mantém fixo |
| `I-03` | A capa deve trazer a competência — `julho/2026` —, que hoje só aparece na planilha de análise? O modelo não tem campo para ela | Não |
| `I-04` | Um órgão pode recusar a capa sem a pilha histórica de propostas (`D-04`)? | Não bloqueia. Se recusar, `I-01` é o mesmo caminho |
| **`I-05`** | **Quantas propostas cabem na caixa antes de a linha ser cortada?** Não medido — exige renderizar e olhar | Não bloqueia: o par do PGM tem duas e a linha do modelo já comportava três. Bloqueia *afirmar* que N peças cabem |

---

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| **A** | `R-CAP-02`, `R-CAP-03`, `R-CAP-06` a `R-CAP-09` — o mapa de posições, a escrita e a varredura, com os campos que o `Report` já tem | **P** |
| B | `R-CAP-04`, `R-CAP-05`, `R-CAP-10` e `V-CAP-01` — as derivações e a cascata | P |
| C | `D-08` — converter os dois testes de capa, ajustar as fixtures e acrescentar o par do PGM | P |

**Total: uma diária.**

A fase A já resolve o defeito para os campos de fonte segura — contrato e propostas — e pode ser
publicada com o cliente e o subtítulo ainda caindo para o `contrato_referencia`. É a ordem que
entrega valor primeiro: `Contrato : TC 52/SMIT/2024` numa capa do PGM é o vazamento mais grave, e
some na fase A.

> A 1.0 estimava *"meia diária a uma diária"*. Estava otimista por não contar `D-09`: o mapa de
> posições e o seu teste são trabalho que a estimativa anterior não via.

---

## 13. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-08-17 | Redação inicial, resolvendo o `I-01` da ESPEC 018. Começou maior — supunha reconstruir as caixas de texto — e encolheu ao medir que os **oito textos da capa vivem cada um num `<w:t>` único**, o que torna o preenchimento uma troca de cadeia. Encolheu de novo ao medir que o subtítulo do piloto sai do título da aba **caractere por caractere**. A aba `Capa` do levantamento foi a primeira hipótese de fonte e está descartada por medição |
| **1.2** | **2026-08-17** | **O critério de aceite era inatingível.** Ao escrever o PLANO 020, medi o documento do PGM gerado com o código de hoje: **13 ocorrências de `SMIT`**, das quais **12 são resíduo do modelo e 1 é dado legítimo do cliente** — a aba `NAS` do levantamento do PGM traz a palavra numa célula, e ela sai no anexo, corretamente (§2.9). A §9.3 pedia que *"a cadeia `SMIT` não apareça em lugar nenhum do pacote"*, o que **nunca ficaria verde**. A regra `R-CAP-09` já estava certa — *"nenhuma das cadeias do modelo que identificam um contrato"* —; eram §9.2 e §9.3 que a contradiziam, por atalho de redação. É a mesma lição da ESPEC 018 §1.1: medi o **modelo**, concluí sobre o **documento gerado**, e os dois não são a mesma coisa |
| **1.1** | **2026-08-17** | **Cinco correções de revisão, duas delas graves.** (1) `D-09` — a 1.0 mandava *"substituir todas as ocorrências de cada texto"*, e §2.1 mede que `PA-SMIT-260319-739` tem **dois papéis**: continuação da linha `Proposta :` e rodapé da capa. Casar por cadeia escreveria a lista nos dois lugares e a duplicaria na caixa 2 — capa errada de um jeito novo. Os campos passam a ser endereçados por `(caixa, parágrafo)`. (2) `R-CAP-04` — §2.5 mede que o separador da sigla **difere** entre os dois documentos, `Tecnologia- SMIT` contra `Paulo - PGM`; a regra passa a descrever o padrão em vez da intenção, porque a leitura natural falhava justamente no piloto. (3) `D-10` — a cascata dos vazios, que a 1.0 deixava aberta: o cliente caía para o subtítulo, e o subtítulo não tinha para onde cair — e §2.8 mede que a fixture da própria suíte não casa o padrão. (4) `Contract.aplicar` passa a repassar `cliente`; sem isso a capa quebraria no caso **com aditivo**, que é o do PGM. (5) `I-05` e o risco de estouro da caixa, não medido, declarado como tal. Entram ainda a medição de §2.3 — todo o resíduo está em `word/document.xml`, doze ocorrências — e a dívida de `D-05` dita com todas as letras: `R-CAP-04` é a **única derivação por prosa do projeto**. Esforço revisto de *"meia diária a uma"* para **uma diária** |
