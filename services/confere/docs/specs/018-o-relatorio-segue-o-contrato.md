# ESPEC 018 — O relatório segue o levantamento, ordenado pelo contrato

| | |
|---|---|
| **Status** | **Implementada** — 2026-08-14. Emendas de execução em §14 |
| **Versão** | 4.1 — 2026-08-14 — implementada. Seis emendas de execução em §14 |
| **Depende de** | [ESPEC 001](001-mvp-analise-medicao.md) e [ESPEC 017](017-grade-do-contrato-derivada-do-documento.md) — implementadas |
| **Revisa** | `R-CAT-01` (o catálogo dirige o relatório), `R-CTR-01` (a quantidade contratada vem do contrato) e `R-DIV-05` (consumo sem previsão fica fora do documento). Ver `D-04`, `D-05` e `D-06` |
| **Corrige** | `R-MED-02` — a regra do desconto não era aplicada em **nenhum** dos dois pares. Defeito de produção, ver §2.8 e a emenda `14.1` |
| **Referência normativa** | `docs/documentos/PA-SMIT-260319-739 Q-00739-7.pdf` (piloto) e `docs/documentos/PMG/PA-PGM-251015-159 v5.0.pdf` |
| **Origem** | Processamento bloqueado com 45 achados ao submeter o par PMG, sendo 26 `V-CTR-02` bloqueantes |

---

## 1. Problema

Submetido o par do PGM — contrato `PA-PGM-251015-159 v5.0` e levantamento de `TC 015/PGM/2024` —
a aplicação bloqueia com 45 achados e não gera nada.

**A extração está correta.** Medido com o código de produção: 47 itens, 46 códigos, total
declarado `24.551.037,72` e soma dos totais `24.551.037,72` — checksum `0,00`. A ESPEC 017
entregou o que prometeu.

O que bloqueia é o **catálogo**: semeado do relatório modelo do SMIT, ele tem 30 de 54 códigos em
comum com um contrato de outro órgão.

O defeito não é o catálogo estar errado — é o relatório **depender** dele. O laço que monta o
documento é o catálogo, não a medição:

```python
# application/use_cases/generate_measurement_report.py
for entrada in sorted(catalogo, key=lambda e: e.ordem):
```

Um item medido sem entrada de catálogo nunca vira linha: não é comparado, não é somado, não
aparece. E como a análise da ESPEC 009 é derivada do `Report`, ela herda o mesmo filtro.

---

## 2. O que foi medido

Tudo nesta seção foi lido dos arquivos reais com o código de produção. Nada é suposto.

### 2.1 Os dois pares, lado a lado

| | piloto (SMIT) | PMG |
|---|---|---|
| proposta (PDF) | `PA-SMIT-260319-739` | `PA-PGM-251015-159` |
| contrato (planilha) | `TC 52/SMIT/2024` | `TC 015/PGM/2024` |
| linhas do contrato | 60 | 47 |
| códigos do contrato | 57 | 46 |
| checksum `V-CTR-03` | `0,00` | `0,00` |
| linhas da aba `Levantamento` | 74 | 68 |
| **códigos da aba** | **61** | **59** |
| aderência catálogo→contrato | 54/54 = 100% | **30/54 = 56%** |

### 2.2 A aba `Levantamento` contém o contrato inteiro

Nos dois pares, **`contrato − planilha = ∅`**: todo código contratado está na aba. Adotar a aba
como universo do relatório não perde item contratado nenhum, e é o que autoriza `D-03`.

O caminho inverso não vale: a aba tem 4 códigos a mais no piloto e **13 a mais** no PMG.

### 2.3 O que existe só na aba, classificado

| grupo | situação | piloto | PMG |
|---|---|---|---|
| A | contratada > 0 **e** medida > 0 | 0 | 0 |
| **B** | contratada 0 · **medida > 0** | 1 | 3 |
| **C** | **contratada > 0** · medida 0 | 0 | **2** |
| D | contratada 0 · medida 0 | 3 | 8 |

**Grupo C só aparece no PMG, e é o achado mais revelador do levantamento:**

```
14.071.00006.00   contratada 5   medida 0   MIDDLEWARE - DIREITO DE USO DE SOFTWARE
14.071.00007.00   contratada 1   medida 0   GERENCIAMENTO DE TECNOLOGIAS EM CAMADA INTERMEDIÁRIA
```

A planilha afirma que estão contratados e o PDF não os conhece. Não são linhas soltas: a aba do
PGM traz as faixas `E2.4 MIDDLEWARE` e `E2.5 GERENCIAMENTO DE TECNOLOGIAS EM CAMADA
INTERMEDIÁRIA` — **seções inteiras** ausentes do PDF.

Isso confirma o que a primeira página do PDF declara: *"Proposta de Aditivo: PA-PGM-251015-159 …
Os serviços previstos são os constantes da Proposta Técnica Comercial PC-PGM-240715-100 v7,
PA-PGM-250320-24 v1, PA-250409-037 v1 e PA-PGM-250930-142 v4"*. **O PDF é a quinta peça de uma
pilha**, datado de 11/11/2025; o levantamento é de 23/07/2026.

### 2.4 A ordem não é derivável da planilha, e o agrupamento é

A ordem da aba diverge da do relatório modelo em **56 de 61 posições**; a do catálogo diverge da
do contrato em **299 pares de 55 códigos**. A ordem editorial do modelo não sai de fonte nenhuma
— é a metade do catálogo que esta espec descarta (`D-02`).

O agrupamento, esse sai: a aba traz **as 22 seções do relatório modelo, 22 de 22**, e a do PGM
traz as suas 37, com seções que o SMIT não tem. Manter as faixas nunca exigiu catálogo — é
decisão de negócio descartá-las (`D-07`).

### 2.5 A família `10.050` é a única exclusão, e não é a unidade HORA/HOMEM

O piloto tem sete itens `HORA/HOMEM`, todos com medida `0` na aba. A unidade não separa quem
entra de quem sai:

| código | unidade | no relatório modelo |
|---|---|---|
| `10.050.00001.00` · `00002.00` · `00055.00` | HORA/HOMEM | **não** |
| `11.051.00012.00` | HORA/HOMEM | **sim**, `100 / 0` |
| `14.051.00025.00` | HORA/HOMEM | **sim**, `50 / 0` |

O que separa é a família `10.050` — especialista/analista e consultoria de BI, faturados por
outro instrumento. As duas planilhas corroboram por conta própria: sob a faixa
`A - SISTEMAS DE INFORMAÇÃO` estão exatamente `10.050.00001/00002/00055` no piloto e
`10.050.00001` no PMG.

### 2.6 Perfil/pacote é derivável da planilha, exatamente

```
PILOTO
  catálogo marca PERFIL_PACOTE:  14.025.00011 · 14.046.00010 · 14.048.00008 · 14.070.00002
  planilha traz medida não numérica em: exatamente esses quatro
  marcados e numéricos: nenhum      não numéricos e não marcados: nenhum
```

No PMG a derivação alcança cinco códigos, quatro dos quais o catálogo do SMIT desconhece.

### 2.7 Descrição: as duas fontes falam línguas diferentes

Comparando código a código, ignorando acento, caixa e pontuação:

| | códigos comuns | equivalente | **realmente diferente** |
|---|---|---|---|
| piloto | 57 | 23 | **34** |
| PMG | 46 | 24 | **22** |

```
12.029.00021.00   contrato  SOLUÇÃO DE ACESSO A REDE CORPORATIVA PMSP - 8192 KBPS - COM REDUNDÂNCIA
                  planilha  MPLS - 8 Mbps com redundância

14.028.00005.00   contrato  COLOCATION
                  planilha  COLOCATION GERENCIADO - Quantidade de Us

14.024.00005.00   planilha  BAIXA PLATAFORMA - SAN - GB - DESCONTANDO RECURSOS DE DESENVOLVIMENTO
```

O contrato traz a **designação contratual**; a aba traz o **apelido operacional de quem mede** —
e, no último caso, a própria metodologia de apuração dentro da descrição. É o que decide `D-08`.

### 2.8 Defeito de produção: a regra do desconto não é aplicada no PMG

A aba repete o mesmo código quando existe a variante que desconta recursos de desenvolvimento.
`R-MED-02` manda prevalecer a descontada — **o cliente não paga por servidor de desenvolvimento**.

```
PILOTO   74 linhas | bloco_titulo vazio:  0/74  | 13 códigos repetidos → 13 resolvidos pela regra
PMG      68 linhas | bloco_titulo vazio: 68/68  |  9 códigos repetidos →  1 resolvido pela regra
```

A causa está em como a faixa chega ao leitor. Na planilha da PGM ela é **célula mesclada**, e o
modo somente-leitura entrega o mesmo texto repetido nas cinco colunas:

```
PILOTO  linha 69:  ['E1.1 - … DESCONTANDO …',  None, None, None, None]           → aceita
PMG     linha 57:  ['E1.1 - … DESCONTANDO …',  'E1.1 - …', 'E1.1 - …',
                                               'E1.1 - …', 'E1.1 - …']            → rejeita
```

`_e_titulo_de_bloco` exige *"texto na primeira coluna e nada nas demais"*. Nenhuma das 37 faixas
da PGM passa, e os oito códigos `14.049.*` caem no atalho *"vale a última lida"*.

**Hoje o valor sai certo por coincidência**: a aba do PGM lista `TOTAL DE RECURSOS` acima e
`DESCONTANDO` abaixo, então a última lida é a descontada — `14.049.00048.00` sai 5 e não 7,
`14.049.00038.00` sai 5 e não 9. Numa planilha com os blocos invertidos, o cliente pagaria pelos
servidores de desenvolvimento, **sem erro, sem aviso e sem teste que acusasse**.

---

## 3. Objetivo

O relatório é derivado **da aba `Levantamento`**, ordenado pelos códigos do contrato.

Como consequência: qualquer par contrato + levantamento gera relatório, sem catálogo e sem
cadastro prévio. **No DOCX, a partir da página 2, mudam o universo, as quantidades, a ordem e o
agrupamento. O layout físico não muda** — colunas, larguras, fontes, capa, timbrado, rodapé e
anexos ficam como estão (`D-10`).

---

## 4. Escopo

### 4.1 Dentro do escopo

- O universo do relatório passa a ser a aba `Levantamento` (`R-REL-01`).
- As duas quantidades passam a vir da aba (`R-REL-04`).
- Uma linha por código, ordenada pelo contrato; o resto num bloco final (`R-REL-02`, `R-REL-03`).
- O documento perde grupos e seções a partir da página 2 (`R-REL-05`).
- A família `10.050` fica fora do documento (`R-REL-06`).
- Descrição e unidade do contrato onde ele conhece o código (`R-REL-07`).
- Perfil/pacote derivado da planilha (`R-REL-08`).
- **A correção da `R-MED-02`** e o teste da ordem invertida (`R-REL-11`, `D-09`).
- O catálogo e as quatro validações que o pressupõem saem (`R-REL-10`).
- O teste-âncora é convertido de comparação posicional para comparação por código (`D-11`).

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| **O layout físico do DOCX** | Colunas, larguras, fontes, capa, timbrado, rodapé e anexos ficam como estão (`D-10`), e §9.1 o torna verificável |
| A capa fixa | `TC 52/SMIT/2024` e `PA-SMIT-260319-739` estão gravados (ESPEC 003 §9.1). **Vira defeito no instante em que o PGM gerar documento** — espec própria. Ver `I-01` |
| Reproduzir o modelo GRC para o SMIT | É o que esta espec troca. Quem quiser o formato antigo tem o histórico do git |
| Agrupamento derivado das faixas da aba | **Tecnicamente disponível** (§2.4) e descartado por decisão de negócio (`D-07`) |
| Consolidar contrato original mais aditivos | Segue fora, como na ESPEC 001. §2.3 mostra que é a causa raiz do `I-05`, não desta espec |
| Anexos, grid e análise em XLSX | Não são tocados. A análise passa a ver mais itens porque o universo cresceu |

---

## 5. Regras

| ID | Regra |
|---|---|
| `R-REL-01` | O universo do documento é a **aba `Levantamento`**: todo código que ela traz vira linha, salvo a exclusão de `R-REL-06`. O contrato não define quem entra |
| `R-REL-02` | **Uma linha por código.** Ocorrências repetidas do mesmo código na aba são resolvidas por `R-MED-02`, não somadas |
| `R-REL-03` | A **ordem** é a de aparição do código na tabela de itens do contrato. Códigos que o contrato não traz vão para um bloco final, `DEMAIS ITENS DO LEVANTAMENTO`, na ordem da aba |
| `R-REL-04` | **As duas quantidades vêm da aba** — `Quantidade Contratada` e `Quantidade Medida`. `R-CTR-01` fica revogada |
| `R-REL-05` | O documento **não tem agrupamento** a partir da página 2. O cabeçalho de colunas aparece uma vez por página, não uma vez por seção |
| `R-REL-06` | Códigos da família **`10.050`** ficam **fora do documento** e **dentro da comparação**: não imprimem linha, mas continuam validados e contam para o grid e para a análise |
| `R-REL-07` | Descrição e unidade vêm do **contrato** onde o código existe nele; da **aba** no bloco final de `R-REL-03` |
| `R-REL-08` | Item cuja medida na aba **não é numérica** é perfil ou pacote, e sai como `1 / 1` |
| `R-REL-09` | A quantidade sai **sempre com separador de milhar** |
| `R-REL-10` | O **catálogo deixa de existir**. Saem `catalogo_padrao.json`, o leitor, o campo `catalogo` da API e as validações `V-CTR-02`, `V-CAT-01`, `V-CAT-02` e `V-CAT-03` |
| `R-REL-11` | Uma linha é **faixa de bloco** quando todas as suas células preenchidas carregam **o mesmo texto** — o que cobre a faixa em coluna única e a mesclada. Corrige `R-MED-02` (§2.8) |
| `R-REL-12` | `V-REC-01` passa a avaliar **todo código do contrato**, inclusive os que `R-REL-06` mantém fora do documento, e informa que o relatório usa a quantidade da aba |
| `R-REL-13` | `V-CTR-04` sai da lista de achados apresentada. Depois da ESPEC 017 ela dispara para todo contrato que não seja o piloto |

---

## 6. Decisões

### `D-01` — Uma linha por código, não uma por linha do contrato

O contrato desdobra `10.050.00001.00` em três linhas no piloto e duas no PMG; a aba traz uma.
O que se fatura é código × quantidade, e é nessa granularidade que a medição existe. Uma linha
cuja quantidade medida é **estruturalmente impreenchível** é defeito num documento de cobrança.

**Custo declarado:** `14.025.00011.00` perde a distinção `IT0101` / `SG0721`. Ver `I-02`.

### `D-02` — A ordem vem do contrato; o agrupamento, de lugar nenhum

Nem a aba nem o contrato reproduzem a ordem editorial do modelo (§2.4), e ela não é derivável.
Adotar a do contrato é a escolha de negócio: o documento passa a ser conferível linha a linha
contra a tabela de itens do contrato, que é o instrumento que ele comprova.

### `D-03` — O universo é a aba, não o contrato

§2.2 mede o que autoriza a inversão: a aba **contém** o contrato nos dois pares. Sair da aba
nunca perde item contratado, e ganha os 4 e os 13 códigos que só ela conhece.

O caminho oposto — universo do contrato — perderia o grupo C do PMG, que é a evidência de que o
PDF submetido não cobre o escopo vigente (§2.3).

### `D-04` — Nada da aba é filtrado, salvo a família `10.050`

Decisão de negócio: **todos os itens apontados na aba entram no documento**, inclusive os 11
zerados dos dois lados (grupo D). Um relatório de comprovação que omite linha da própria fonte
deixa de reconciliar com ela, e reconciliar é a função dele.

A família `10.050` é a única exceção, e §2.5 mostra que ela não é derivável dos arquivos — vive
numa constante nomeada, com o motivo ao lado:

```python
# Horas de especialista/analista e consultoria de BI são faturadas por outro
# instrumento: aparecem na aba com medida 0 e não entram na comprovação.
FAMILIAS_FORA_DO_DOCUMENTO = frozenset({"10.050"})
```

**Alternativa descartada:** excluir por unidade `HORA/HOMEM`. §2.5 mede que ela removeria
`11.051.00012.00` e `14.051.00025.00`, que o modelo imprime.

### `D-05` — As duas quantidades vêm da aba, e a `R-CTR-01` cai

Decisão de negócio, que **responde o `I-05` por consequência**:

| código | pelo contrato | **pela aba** |
|---|---|---|
| `14.024.00006.00` | 6.100 / 8.542,16 → **item crítico** | 9.000,89 / 8.542,16 → divergente |
| `12.030.00001.00` | 150 / 70 → divergente | 70 / 70 → **sem divergência** |
| `14.031.00020.00` | 5 / 5 → sem divergência | 10 / 5 → divergente |
| `10.050.00001.00` | 42.260 / 0 | 42.814,01 / 0 |

É defensável — a aba é de julho/2026 e o PDF de novembro/2025, e §2.3 mostra que o PDF é uma
peça de cinco. Mas é **decisão**, não consequência técnica, e fica registrada como tal.

`V-REC-01` sobrevive e inverte a mensagem: continua expondo que as fontes divergem, agora
informando que o relatório usa a da aba. Deixa de ser ponto de decisão e passa a ser nota.

### `D-06` — O bloco final, e o fim da `R-DIV-05` para o documento

Os códigos que só a aba conhece não têm posição no contrato. Vão para um bloco ao final,
`DEMAIS ITENS DO LEVANTAMENTO`, na ordem da aba.

Título neutro de propósito: o documento vai ao órgão, e `sem previsão contratual` é juízo que a
aplicação não tem elementos para emitir — o grupo C mostra que a ausência pode ser do PDF, não
do contrato. Os números se leem sozinhos: `0 / 1` diz uma coisa, `5 / 0` diz outra.

Não separo B, C e D em blocos distintos: a distinção é de análise, e ela já aparece no grid e na
planilha da análise, que são de quem opera.

### `D-07` — O agrupamento é descartado por decisão de negócio, não por impossibilidade

Registrado à parte porque é o ponto que um leitor futuro tem mais chance de interpretar errado.

Uma redação anterior desta espec afirmava que o agrupamento *"ou vem de um catálogo, ou não
existe"*. **Era falso** — §2.4 mede que a aba traz as 22 seções do modelo e o PGM traz 37.

**Alternativa descartada:** derivar grupo e seção das faixas da aba, com a ordem do contrato
dentro de cada seção. Fica registrada porque é o caminho pronto caso algum órgão recuse o
documento sem seções (`I-03`), e porque custa meia diária.

### `D-08` — Descrição e unidade do contrato, não da aba

§2.7 mede 34 descrições realmente diferentes em 57 no piloto. Não é caixa nem acento: o contrato
diz `SOLUÇÃO DE ACESSO A REDE CORPORATIVA PMSP - 8192 KBPS`, a aba diz `MPLS - 8 Mbps`.

Decide o caso o `14.024.00005.00`, cuja descrição na aba é
`BAIXA PLATAFORMA - SAN - GB - DESCONTANDO RECURSOS DE DESENVOLVIMENTO`: a aba carrega a
**metodologia de apuração** dentro da descrição, e o documento vai ao cliente.

O relatório é uma comprovação **contratual** — cada linha precisa ser conferível contra o
contrato, e é a designação contratual que permite isso.

**Alternativa descartada:** tudo da aba, por uniformidade. São 4 linhas no piloto e 13 no PMG que
usariam texto da aba, todas segregadas no bloco final — onde uma voz diferente é esperada, porque
ali não há contrato de onde tirar.

### `D-09` — A faixa é reconhecida pelo texto repetido, não pela abertura do arquivo

§2.8 diagnostica o defeito. A saída óbvia — abrir a planilha em modo completo — custa 1,7 s e o
arquivo inteiro em memória, e trata o sintoma.

A correção é no crivo:

```python
def _e_titulo_de_bloco(self, celulas: list[str]) -> bool:
    valores = {c.strip() for c in celulas if c.strip()}
    if len(valores) != 1:
        return False
    return valores.pop().lower() not in _CABECALHOS
```

*Uma faixa é a linha cujas células preenchidas carregam o mesmo texto.* Cobre as duas formas de
uma vez, não tem constante a calibrar, e linha de item ou de total cai fora por `len != 1`.

**Medido antes de propor:**

| | faixas hoje | com a correção | repetidos | **resolvidos pela regra** |
|---|---|---|---|---|
| piloto | 35 | 35 — *conjunto idêntico* | 13 | 13 → **13** |
| PMG | **0** | **37** | 9 | 1 → **9** |

Nenhuma quantidade se move: os oito casos do PMG já devolviam o valor descontado pelo atalho.
**O que muda é a garantia** — o número certo passa a sair porque a regra mandou.

### `D-10` — O layout físico não é tocado

Muda o conteúdo e a sequência; não muda a forma. A espec já troca o critério de aceite do
projeto; trocar também a diagramação tiraria a única referência que sobra para julgar se a troca
deu certo. §9.1 torna o limite verificável.

### `D-11` — O teste-âncora é convertido, não apagado

`test_anchor_fidelity.py` compara célula a célula com as páginas 2 e 3 do modelo GRC. Sem
agrupamento, com outra ordenação e com as quantidades vindo de outra fonte, ele **não tem como
passar** na forma posicional.

Passa a comparar **por código**: para cada código do piloto, a quantidade medida deve ser a que o
modelo GRC traz. A contratada sai da comparação, porque `D-05` troca deliberadamente a fonte.

Entram duas asserções novas em troca: a descrição de toda linha é, caractere por caractere, a do
contrato (`R-REL-07`), e o conjunto de códigos do documento é o da aba menos a família `10.050`
(`R-REL-01`, `R-REL-06`).

**Divergências declaradas**, das 54 linhas ordenadas pelo contrato no piloto:

| código | motivo |
|---|---|
| `11.027.00001.00` | Contrato e aditivo dizem 10, o modelo grafa 6. Já existe hoje, pendente do `I-01` da ESPEC 001 |
| `14.025.00011.00` | Modelo imprime duas linhas de `1 / 1`; `D-01` consolida em uma |

---

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `application/use_cases/generate_measurement_report.py` | O laço passa a ser sobre **os códigos da aba**, ordenados pela posição no contrato (`R-REL-01`, `R-REL-03`). Some a montagem de `ReportSection`. As duas quantidades passam a sair de `MeasurementItem` (`R-REL-04`). **Sai o registro de `V-CAT-03`**, hoje emitido aqui dentro de `_medida` |
| `domain/entities/report.py` | `ReportSection` sai. `Report.linhas` vira lista direta, mais `demais_itens` para o bloco de `R-REL-03` |
| `domain/entities/measurement_item.py` | Some o comentário que declara a aba como fonte secundária da quantidade contratada — ela passa a ser a fonte |
| `infrastructure/measurement/levantamento_reader.py` | `_e_titulo_de_bloco` reescrita (`D-09`) |
| `domain/entities/catalog_entry.py` | **Sai** |
| `infrastructure/catalog/` | **Sai inteiro**. `V-CAT-01` sai junto: nunca foi achado, e sim conferência de chave duplicada feita na leitura |
| `infrastructure/validations/contract_validations.py` | **Sai** `v_ctr_02`. `v_ctr_04` deixa de ser registrada (`R-REL-13`). **Entra** `v_ctr_05` (§8.2) |
| `infrastructure/validations/reconciliation_validations.py` | **Sai** `v_cat_02`. `v_rec_01` perde os `continue` de `exibir` e `qualificador` e inverte a mensagem (`R-REL-12`) |
| `infrastructure/validations/measurement_validations.py` | **Entra** `v_med_03` (§8.2) |
| `infrastructure/report/docx_renderer.py` | Somem as faixas de grupo e seção; entra o bloco final. **Larguras, fontes, capa, timbrado e anexos não são tocados** (`D-10`) |
| `infrastructure/di/container.py` | `Entradas.catalogo` sai; `gerar()` deixa de ler catálogo e de chamar quatro validações |
| `api/routers/reports.py` · `api/schemas.py` | O campo `catalogo` sai. A resposta perde o agrupamento por seção e ganha o bloco final |
| `frontend/src/app/components/` | `ResultadoPanel` e `DivergenciaGrid` deixam de agrupar por seção |
| `scripts/seed_catalog.py` | **Sai** |
| `backend/tests/` | Âncora convertido (`D-11`). Saem os testes das validações removidas. Entram o âncora do PMG e a fixture de ordem invertida (`D-09`) |

Contagem esperada de linhas:

| | ordenadas pelo contrato | bloco final | **total** | hoje |
|---|---|---|---|---|
| piloto | 54 | 4 | **58** | 55 |
| PMG | 45 | 13 | **58** | bloqueado |

---

## 8. Validações

### 8.1 Saem

| ID | Motivo |
|---|---|
| `V-CTR-02` | Não há catálogo a resolver. Elimina os 26 bloqueantes do PGM |
| `V-CAT-01` | Não há catálogo cuja chave conferir |
| `V-CAT-02` | Não há catálogo de onde um código do contrato possa estar fora. Elimina 15 avisos do PGM |
| `V-CAT-03` | Código contratado e não medido não existe mais: o universo é a aba |

### 8.2 Entram

| ID | Severidade | Quando dispara | Por quê |
|---|---|---|---|
| `V-CTR-05` | `AVISA` | Código do contrato ausente da aba `Levantamento` | Preserva a metade útil da `V-CAT-03`. Não ocorre em nenhum dos dois pares (§2.2), e é o alarme para o dia em que ocorrer |
| `V-MED-03` | `AVISA` | Código repetido na aba resolvido pela **última ocorrência**, sem variante `DESCONTANDO` identificada | A rede de `D-09`. Com a correção não dispara em nenhum dos dois pares; dispararia hoje em 8 dos 9 repetidos do PMG |

### 8.3 Mudam

| ID | Mudança |
|---|---|
| `V-REC-01` | Avalia todo código do contrato e informa que o relatório usa a quantidade da aba (`R-REL-12`). No PMG sai de 3 para **4** achados |
| `V-REC-02` | Passa a informar que a medida veio como texto e a linha saiu `1 / 1` por derivação |
| `V-CTR-04` | Continua sendo medida, deixa de ser apresentada (`R-REL-13`) |

### 8.4 Ficam intactas

`V-CTR-01`, `V-CTR-03`, `V-MED-01` e `V-MED-02`.

**`V-CTR-03` continua bloqueando**, e agora por outro motivo: o contrato deixou de fornecer
quantidades, mas fornece a **ordem**. Um contrato lido pela metade reordenaria o documento em
silêncio e mandaria itens legítimos para o bloco final. O checksum segue sendo a única prova de
que a tabela foi lida inteira (`R-GRD-10` da ESPEC 017).

### 8.5 O resultado para o PMG

| | hoje | com esta espec |
|---|---|---|
| bloqueantes | **26** | **0** |
| avisos | 19 | **10** — 5 `V-REC-01` e 5 `V-REC-02` |
| documento gerado | não | **sim, 58 linhas** |

A espec previa 4 avisos, contando só a `V-REC-01`. São **10**: a `V-REC-01`
subiu para 5 (emenda `14.3`) e a `V-REC-02` passa a avisar em cada linha
derivada como perfil — 5 no PGM, 4 no piloto. É informação, não ruído: toda
linha que sai `1 / 1` por derivação diz isso a quem confere.

---

## 9. Testes e critério de aceite

### 9.1 O portão de não-regressão

`test_extractor_contract.py` **não pode ser tocado** — 60 itens, 57 códigos e `10637425.00` no
piloto; 47 itens, 46 códigos e `24551037.72` no PMG. Vale igualmente para os anexos (ESPEC 004) e
para os testes de capa, timbrado, rodapé e largura de coluna, que `D-10` põe fora do escopo.

### 9.2 Cobertura nova

| Nível | Cobertura |
|---|---|
| `R-REL-01` | O conjunto de códigos do documento é o da aba menos a família `10.050`: 58 no piloto, 58 no PMG |
| `R-REL-02` | `10.050.00001.00` não gera três linhas; `14.049.00048.00` gera uma |
| `R-REL-03` | As 54 primeiras linhas do piloto seguem a ordem do contrato; as 4 restantes estão no bloco final |
| `R-REL-04` | `14.024.00006.00` do PMG sai com contratada `9.000,89`, e não `6.100,00` |
| `R-REL-05` | O DOCX não contém faixa de grupo ou seção; o cabeçalho aparece uma vez por página |
| `R-REL-06` | Nenhum `10.050.*` no documento, **e** os três continuam avaliados por `V-REC-01` |
| `R-REL-07` | Descrição e unidade de toda linha ordenada pelo contrato são as do contrato, caractere por caractere; as do bloco final são as da aba |
| `R-REL-08` | Os quatro perfis do piloto e os cinco do PMG saem `1 / 1`; item com medida numérica não vira perfil |
| **`R-REL-11`** | **Fixture com os blocos invertidos** — `DESCONTANDO` acima, `TOTAL DE RECURSOS` abaixo — resolve pela variante descontada. É o teste que não existe hoje |
| `R-REL-11` | No PMG, os 9 códigos repetidos são resolvidos pela regra, não pelo atalho; no piloto, o conjunto de faixas é idêntico ao de hoje |
| `V-MED-03` | Dispara na fixture sem marca de desconto; **não** dispara em nenhum dos dois pares reais |
| `V-CTR-05` | Dispara em fixture com código contratado ausente da aba; não dispara nos dois pares |
| **Âncora piloto** | Por código, a quantidade **medida** é a do modelo GRC, salvo as duas divergências de `D-11` |
| **Âncora PMG** | 58 linhas, 0 bloqueantes, 4 avisos, documento gerado |

### 9.3 O critério de aceite

**Os dois pares reais geram documento, pelo mesmo código, sem catálogo e sem parâmetro de
contrato** — e o piloto sai com as mesmas quantidades medidas que o modelo GRC traz.

---

## 10. Riscos

| Risco | Mitigação |
|---|---|
| **O documento sem seções não ser aceito como entrega formal** | O caminho de volta é curto e conhecido: as faixas estão na aba (§2.4), e restaurá-las é meia diária (`D-07`) |
| **A capa continuar dizendo `TC 52/SMIT/2024`** no documento do PGM | `I-01`. **Bloqueia a entrega**, e por isso precisa de espec própria imediata |
| **Adotar a quantidade da aba mascarar consumo a descoberto** | É o que `D-05` decide, e o `14.024.00006.00` deixa de ser item crítico. `V-REC-01` mantém a divergência visível a quem opera, e `I-05` registra a pergunta documental |
| **O bloco final crescer sem controle** num contrato de escopo pequeno | É informação, não ruído: no PMG são 13 linhas, das quais 2 revelam seções ausentes do PDF. Se incomodar, a ordenação por medida dentro do bloco resolve sem mudar regra |
| **A correção da faixa quebrar o piloto** | `D-09` mede que o conjunto de faixas é **idêntico**, linha por linha. É o portão que autoriza a mudança |
| **O escopo crescer** durante a implementação | `D-10`, com §9.1 tornando-o verificável |
| **Perder a capacidade de reproduzir o modelo GRC** | Intencional. O histórico do git guarda catálogo e renderizador por seções |
| **A análise da ESPEC 009 mudar de números** | O universo cresceu — consequência pretendida. O âncora da análise é reconciliado no mesmo commit |

---

## 11. Pontos em aberto

| ID | Questão | Bloqueia? |
|---|---|---|
| `I-01` | A capa fixa (ESPEC 003 §9.1) | **Não bloqueia a espec, bloqueia a entrega.** Espec própria em seguida |
| `I-02` | A perda da distinção `IT0101` / `SG0721` em `14.025.00011.00` é aceitável? | Não |
| `I-03` | Relatório sem agrupamento é aceito como entrega formal? | **Decidido em 2026-08-12: sim** (`D-07`) |
| `I-04` | Além da família `10.050`, há outras faturadas por instrumento diferente? | Não |
| `I-05` | Houve aditivo depois de 11/11/2025 alterando NAS, conexão de internet, licenças E5 ou horas de especialista no `TC 15/PGM/2024`? | Não bloqueia o código. `D-05` decidiu pela aba; a resposta diz se a decisão está certa |
| `I-06` | Os itens do grupo D — contratada 0 e medida 0 — devem mesmo aparecer? `D-04` diz que sim | Não |

---

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| **A** | **`D-09` — a correção da faixa, com a fixture de ordem invertida e `V-MED-03`** | **PP** |
| B | `R-REL-01` a `R-REL-04` — universo da aba, uma linha por código, ordem do contrato, quantidades da aba | M |
| C | `R-REL-05` e `D-06` — remover faixas, acrescentar o bloco final | P |
| D | `R-REL-06` a `R-REL-09` — família fora, descrição do contrato, perfil derivado, formato | P |
| E | `R-REL-10` — retirar catálogo, leitor, campo de API e quatro validações | M |
| F | `D-11` — converter o âncora e reconciliar o da análise | M |

**Total: 2 a 3 dias.**

**A fase A vem primeiro e é independente das demais**: corrige defeito que está no ar hoje, não
move nenhuma quantidade, e pode ser publicada sozinha. A fase F vem por último porque, enquanto o
âncora antigo roda, ele é a rede que denuncia mudança de número nas fases B a E.

---

## 14. Emendas da implementação — 2026-08-14

### 14.1 O defeito da `R-MED-02` não era do PGM: era dos dois

A `D-09` afirma que a regra do desconto estava desligada **no PGM**. Medido na
implementação, com o crivo anterior sobre os arquivos reais:

```
faixas reconhecidas          piloto  1 de 35        PGM  1 de 38
```

**As faixas dos dois levantamentos são mescladas**, e o crivo antigo rejeitava
as duas. A regra estava desligada em produção para o piloto também — e acertava
porque nos dois arquivos o bloco do desconto está listado por último.

A §2.8 comparava o **fixture** do SMIT contra o **original** do PGM, e por isso
mediu 35 onde o certo era 1.

### 14.2 A fixture escondia o defeito, e essa é a lição

O `sanitize_fixture.py` regrava a planilha com `openpyxl`, que guarda a
mesclagem e **apaga as células não-âncora**. A faixa saía de 5/5 colunas
preenchidas no arquivo real para 1/5 na fixture — e nessa forma o crivo antigo
funcionava.

**A suíte testava uma forma que a produção nunca vê.** É a mesma classe de falha
que a ESPEC 017 documentou — suíte verde, produto quebrado —, agora na geração
da fixture e não no número de documentos.

O sanitizador passou a materializar a mesclagem **apenas nas linhas que a origem
já entrega repetidas**, preservando a fidelidade de cada arquivo.

### 14.3 A `V-REC-01` do PGM são cinco, não quatro

A §2.7 previa quatro divergências. A quinta é o `14.048.00027.00` — contrato
**200**, levantamento **1.300** —, que a versão anterior nunca comparava porque
o código **não existe no catálogo do SMIT** e a validação iterava o catálogo.

Some-se a ela o `10.050.00001.00`, com 554,01 horas, que era pulado por
`exibir = N`. As duas cegueiras da validação anterior eram maiores do que a
espec mediu.

### 14.4 A quantidade contratada não sai da variante descontada

`item_para` resolve qual ocorrência vale para a **medição**, e essa variante
costuma trazer a coluna `Quantidade Contratada` **vazia**: é o caso do
`14.024.00005.00` nos dois pares. Ler a contratada de lá produzia `0` onde a aba
afirma 3.500, e um item conforme viraria *consumo sem cobertura* na análise.

Entrou `Measurement.contratada_para`, que devolve a primeira ocorrência que a
declare. A quantidade contratada é atributo do **código**, não da variante de
apuração.

### 14.5 O levantamento do PGM não existia como fixture

O TASKS 018 supôs o par completo na suíte; havia só o `contrato_pgm.pdf`. O
sanitizador foi estendido ao segundo arquivo — e a linha do cabeçalho das abas
com dado pessoal passou a ser **derivada**, não declarada: no PGM o `Office365`
tem o cabeçalho na linha **22**, contra 17 no SMIT, e a constante teria deixado
1.488 linhas de nomes e e-mails institucionais passarem para a fixture.

### 14.6 A `V-CTR-04` saiu da lista, e a `V-REC-02` entrou em cinco linhas

A `R-REL-13` foi aplicada: a `V-CTR-04` deixou de ser registrada como achado — a
medição segue no `DiagnosticoDaGrade`, e a validação continua no módulo com
teste próprio.

Em troca, a `V-REC-02` passou a avisar em toda linha derivada como perfil
(`R-REL-08`), que é o que a `D-03` pediu: sem ela, um `"N/A"` numa célula
viraria `1 / 1` em silêncio. São 4 no piloto e 5 no PGM.

### 14.7 Sem linhas, sem tabela

`relatorio_vazio` passou a emitir uma tabela só com cabeçalho, e isso deslocou o
índice de tabelas em que os 32 testes de anexo se apoiam. O renderizador voltou
a não emitir bloco quando não há linha — que era o comportamento anterior, com
as seções vazias suprimidas pela `R-CAT-02`.

---

## 13. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-08-12 | Redação inicial. Começou como "um catálogo por contrato" — registry, identidade no JSON, validação de pareamento — e encolheu para "nenhum catálogo" quando a decisão de negócio dispensou agrupamento e ordem editorial |
| 1.1 | 2026-08-12 | **Correção de premissa.** A §2.4 afirmava que o agrupamento *"ou vem de um catálogo, ou não existe"*. É falso: a aba traz as 22 seções do modelo. A lição é a do defeito de origem — medi que o agrupamento não sai do **contrato** e concluí que não saía de lugar nenhum, sem abrir a segunda fonte |
| 2.0 | 2026-08-12 | Escopo reduzido a agrupamento e ordenação, catálogo rebaixado a camada de apresentação. Substituída no mesmo dia |
| 3.0 | 2026-08-12 | O catálogo sai, por decisão de negócio, depois de medido o preço: 12 células de texto mudam em 55 |
| 4.0 | 2026-08-12 | **O universo passa a ser a aba `Levantamento`, com as duas quantidades vindas dela** (`D-03`, `D-05`), a ordem vindo do contrato (`D-02`) e nada filtrado além da família `10.050` (`D-04`). Some a `R-DIV-05` para o documento: o que só a aba conhece vai para o bloco final (`D-06`). Descrição e unidade voltam a vir do contrato, depois de §2.7 medir que as duas fontes falam línguas diferentes e que a aba carrega metodologia de apuração dentro da descrição (`D-08`). Incorpora a **correção da `R-MED-02`** (`D-09`), defeito de produção descoberto ao verificar a regra do desconto a pedido do negócio — a ESPEC deixa de ser só mudança de desenho e passa a carregar um conserto |
