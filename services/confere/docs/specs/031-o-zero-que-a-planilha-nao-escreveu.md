# ESPEC 031 — O zero que a planilha não escreveu

| | |
|---|---|
| **Status** | **Implementada** — 2026-08-20. Backend **1.383 → 1.404 passed**, suíte verde em 11min38. Doze números do delta conferidos um a um contra a §8.4; delta de documento provado nos dois sentidos. Navegador **119 de 120** — seis âncoras de tela reancoradas (o inventário não saíra de `backend/tests/`), e uma falha intermitente que passa isolada |
| **Versão** | **1.2 — 2026-08-20 — `R-APU-08` revogada por decisão de quem pediu (§12).** A tela deixa de mostrar as linhas zeradas; o dado permanece na API. Antes: 1.1, emendada pela `T-2134` (inventário de âncoras). A §8.4 foi refeita por medição e passou de 17 para 24 linhas; a §2.7 registra a cascata da `R-ZER-04`, que a v1.0 não previu |
| **Depende de** | [ESPEC 001](001-mvp-analise-medicao.md) `R-MED-02` (a regra do desconto) e [ESPEC 018](018-o-relatorio-segue-o-contrato.md) `R-REL-11` (a faixa mesclada, que **ligou** aquela regra nos arquivos reais) — as duas implementadas |
| **Revisa** | `R-MED-02`: a resolução deixa de ser **por código** e passa a ser **por bloco**. E [ESPEC 028](028-a-linha-que-nao-diz-nada.md) §1, que usou o `14.049.00054.00` como *"o contraste que fecha o argumento"* — o `0 / 2` dele nunca existiu (§11) |
| **Não toca** | `Measurement.contratada_para` (`R-APU-04`), `Measurement.codigos_em_ordem`, `Contract.posicao_de`, a `R-REL-06` (família `10.050`), a `R-REL-08` (perfil ou pacote), a `R-ZER-01` e o critério de quais códigos caem no bloco final |
| **Referência normativa** | `backend/tests/fixtures/levantamento.xlsx` (piloto — 74 itens, 4 blocos de apuração) e `levantamento_pgm.xlsx` (68 itens, 4 blocos). Bordas: `levantamento_sem_marca_de_desconto.xlsx` e `levantamento_blocos_invertidos.xlsx` |
| **Origem** | Conferência manual de quem fatura, contra a planilha da infra: *"O item considerado como crítico: `14.043.00054.00` HOSPEDAGEM DE APLICAÇÃO TIPO C - NÃO GERENCIADA - LINUX, sem previsão contratual. Ele não consta na lista, pois ele só tem em desenvolvimento, que não é cobrado do cliente."* Os códigos do relato lêem `14.043`; no arquivo são `14.049`, e todas as demais colunas conferem linha a linha |
| **Decisão de entrega** | **Uma fase.** A alternativa de duas — detectar sem emitir, e emitir depois — foi apresentada e recusada pelo autor do pedido. O custo está registrado em `D-07` |

---

## 1. Problema

A aba `Levantamento` apura a seção `E1.1 - HOSPEDAGEM DE APLICAÇÃO` **duas vezes**: uma com todos
os recursos, outra descontando os de desenvolvimento. A segunda é a que vale — o cliente não paga
por servidor de desenvolvimento —, e a `R-MED-02` diz exatamente isso desde a ESPEC 001.

Os dois blocos casam linha a linha, com uma exceção:

| Código | Descrição | Bloco bruto (L53-63) | Apuração descontada (L71-80) |
|---|---|---|---|
| `14.049.00037.00` | TIPO A - GERENCIADA - WINDOWS | 1 | 1 |
| `14.049.00047.00` | TIPO A - GERENCIADA - LINUX | 4 | 2 |
| `14.049.00038.00` | TIPO B - GERENCIADA - WINDOWS | 5 | 2 |
| `14.049.00048.00` | TIPO B - GERENCIADA - LINUX | 7 | 5 |
| `14.049.00039.00` | TIPO C - GERENCIADA - WINDOWS | 6 | 6 |
| `14.049.00049.00` | TIPO C - GERENCIADA - LINUX | 1 | 1 |
| **`14.049.00054.00`** | **TIPO C - NÃO GERENCIADA - LINUX** | **2** | **ausente** |
| `14.049.00040.00` | TIPO D - GERENCIADA - WINDOWS | 2 | 2 |
| `14.049.00050.00` | TIPO D - GERENCIADA - LINUX | 0 | 0 |
| `14.049.00045.00` | TIPO D - NÃO GERENCIADA - WINDOWS | 0 | 0 |
| `14.049.00055.00` | TIPO D - NÃO GERENCIADA - LINUX | 0 | 0 |

Onze linhas em cima, dez embaixo. O `14.049.00054.00` some porque, descontado o desenvolvimento,
ele mede **zero** — e quem montou a planilha expressou o zero **apagando a linha**, não escrevendo
`0`.

O Confere não ouve esse silêncio. `item_para` procura uma ocorrência descontada **daquele código**,
não encontra nenhuma, e cai no atalho *"vale a última lida"* — devolvendo os 2 servidores de
desenvolvimento como quantidade faturável. O item sai `contratada 0 / medida 2`, saldo `-2`, e é o
**único item crítico do piloto**.

O documento que vai ao órgão afirma consumo de dois servidores sem cobertura contratual, para
recursos que não são cobrados. É afirmação errada em peça de faturamento, e é pior do que um aviso
a mais na tela: uma acusação sem base.

**Não é caso isolado.** O PGM tem a mesma forma, em outro código: `14.049.00037.00`, medido `1` no
bloco bruto e ausente da apuração descontada.

## 2. O que foi levantado no código

### 2.1 Onde a regra mora, e por que ela erra

`Measurement.item_para`
([measurement.py:47-66](../../backend/src/domain/entities/measurement.py#L47-L66)):

```python
descontados = [item for item in candidatos if item.desconta_desenvolvimento]
return descontados[-1] if descontados else candidatos[-1]
```

`candidatos` são as ocorrências **daquele código**. A `R-MED-02` foi implementada como regra por
código, e o que a planilha expressa é regra por **apuração**: o bloco descontado é um
restabelecimento completo da seção, não uma coleção de correções avulsas.

O defeito está na semântica da ausência. Hoje ela é lida como *"este código não tem variante
descontada"*. O significado é *"a quantidade descontada é zero"*.

### 2.2 Os quatro blocos, e como eles se emparelham

A marca `DESCONTANDO RECURSOS DE DESENVOLVIMENTO` aparece em **duas posições** distintas, e a
[measurement_item.py:52-58](../../backend/src/domain/entities/measurement_item.py#L52-L58) já
verifica as duas:

- **no título do bloco** — `E1.1` e `TOTAIS VCPU e VRAM`, nos dois arquivos reais;
- **na descrição da linha** — o `14.024.00005.00` da seção `E5.1`, linha 129 do piloto.

Só a primeira constitui apuração de bloco. E ali o título descontado é o título bruto **mais** a
marca:

```
'E1.1 - HOSPEDAGEM DE APLICAÇÃO - TOTAL DE RECURSOS'
'E1.1 - HOSPEDAGEM DE APLICAÇÃO - TOTAL DE RECURSOS - DESCONTANDO RECURSOS DE DESENVOLVIMENTO'

'TOTAIS VCPU e VRAM'
'TOTAIS VCPU e VRAM - DESCONTANDO RECURSOS DE DESENVOLVIMENTO'
```

Medido: **quatro** blocos descontados nos dois pares — dois em cada —, e os quatro emparelham por
esse critério, sem sobra e sem ambiguidade.

### 2.3 Por que o pareamento não pode ser por posição

O bloco descontado **não fica colado** ao bruto. No piloto:

```
L53-63  E1.1 - HOSPEDAGEM DE APLICAÇÃO - TOTAL DE RECURSOS
L66-67  TOTAIS VCPU e VRAM                                    ← no meio
L71-80  E1.1 - ... - DESCONTANDO RECURSOS DE DESENVOLVIMENTO
L83-84  TOTAIS VCPU e VRAM - DESCONTANDO ...
```

Parear com o bloco imediatamente anterior zeraria os códigos errados. E o precedente já existe:
a ESPEC 018 `D-09` decidiu que **a marca decide, não a posição**, e a fixture
`levantamento_blocos_invertidos.xlsx` existe para provar isso. Este pareamento segue a mesma
decisão, um nível acima.

### 2.4 O raio de alcance, medido antes de escrever código

A regra proposta foi simulada sobre os sete arquivos de medição do projeto, sem tocar em `src/`:

| Arquivo | Códigos | Blocos pareados | Sem par | **Códigos tocados** |
|---|---|---|---|---|
| Piloto (real e fixture) | 61 | 2 | 0 | **1** — `14.049.00054.00`, L59 |
| PGM (real e fixture) | 59 | 2 | 0 | **1** — `14.049.00037.00`, L45 |
| `sem_marca_de_desconto` | 1 | 0 | 0 | 0 |
| `blocos_invertidos` | 1 | 1 | 0 | 0 |
| `codigos_deslocados` | 0 | 0 | 0 | 0 |

**Dois códigos em 120.** A fixture `blocos_invertidos` é o caso instrutivo: ela **pareia** e mesmo
assim não toca nada — a regra atravessa sem efeito, que é o comportamento correto.

Fixture e arquivo real concordam nos dois pares, mesmos códigos e mesmas linhas. O registro é
deliberado: foi a divergência entre os dois que manteve a `R-MED-02` desligada em produção por
vários incrementos sem que a suíte notasse (ESPEC 018 §2.8), e esta espec não repete a omissão de
não conferir (`R-APU-09`).

### 2.5 A guarda de três condições

O caminho novo só executa quando **as três** valem:

1. o código não tem **nenhuma** ocorrência com a marca — tendo, a `R-MED-02` resolve e o caminho
   novo não é consultado;
2. alguma ocorrência dele está em bloco que **pareia** com uma apuração descontada;
3. o código está **ausente** do conjunto de códigos daquela apuração.

Os 13 códigos repetidos do piloto e os 9 do PGM param na condição 1. Todo código fora de seção com
apuração descontada — a grande maioria — para na 2. Não é *"testamos e não quebrou"*: é guarda
legível, falsa para 118 dos 120 códigos.

### 2.6 Quem mais lê a quantidade medida

- `GenerateMeasurementReport._montar_linha`
  ([generate_measurement_report.py:174-190](../../backend/src/application/use_cases/generate_measurement_report.py#L174-L190))
  — o único consumidor de `item_para` no fluxo de geração;
- `Measurement.contratada_para` — **não** sai de `item_para`, e é o que impede que a coluna vazia
  da variante descontada vire `0` (T-1625). A `R-APU-04` mantém isso intacto;
- `v_med_03_desconto_por_posicao` — a rede do atalho *"vale a última lida"*, que continua valendo
  para o caso que ela cobre.

### 2.7 A cascata que a v1.0 não previu — o bloco final do piloto esvazia

Medido na `T-2134`, com a regra aplicada por *monkeypatch* e sem tocar `src/`:

| | Piloto | PGM |
|---|---|---|
| Bloco final, linhas **exibidas** hoje | **1** | 4 |
| Bloco final, linhas exibidas depois | **0** | 3 |

O `14.049.00054.00` era **a única linha do bloco final do piloto que a `R-ZER-01` ainda desenhava**
— as outras três já eram `0 / 0`. Passando ele a `0 / 0`, o bloco final do piloto fica **vazio**, e
a `R-ZER-04` dispara: o documento perde a faixa `DEMAIS ITENS DO LEVANTAMENTO*`, o asterisco do
título e a nota do rodapé.

Três consequências, e nenhuma delas estava na v1.0:

1. **A `R-ZER-04` ganha o seu primeiro caso real.** A ESPEC 028 §8.1 registrou que ela só era
   exercitada por cenário construído. Passa a ter par real, e é uma melhora — mas não foi pedida,
   e por isso está aqui e não escondida num delta de `sha256`;
2. **`CORPO_DO_PILOTO_TEXTOS` cai muito mais que as 4 células previstas.** Somem também os textos
   da faixa e o parágrafo da nota. O número previsto de 16.013 **fica revogado**: vale o medido na
   `T-2156`;
3. **Dois testes da ESPEC 024 perdem o caso real** —
   `test_o_titulo_do_bloco_final_termina_em_asterisco` e `test_a_nota_do_bloco_final_aparece_no_corpo`,
   ambos sobre a `fixture gerado`, que é o **piloto**. Precisam ser repontados ao PGM, que continua
   com três linhas exibidas. Repontar, e não afrouxar: a `R-NOT-01` e a `R-NOT-02` continuam
   valendo onde há bloco final.

**Decisão de quem pediu — 2026-08-20: a cascata é aceita e a `R-ZER-04` fica intocada.** A
alternativa oferecida era manter a nota de rodapé mesmo com o bloco vazio, trocando o silêncio por
um *"olhei e não havia nada"*. Foi recusada: o documento não ganha conteúdo novo, e a regra escrita
na ESPEC 028 vale como está. A ambiguidade da ausência — *"nada a relatar"* contra *"não olhou"* —
fica registrada em `I-04`, sem bloquear.

**Também medido, e igualmente ausente da v1.0:** `total_divergencias` cai de **37 para 36** no
piloto e de **27 para 26** no PGM. O `14.049.00054.00` divergia por `0 ≠ 2`; com `0 = 0` ele deixa
de divergir. O grid da tela encolhe uma linha em cada par.

## 3. Objetivo

Que a quantidade medida de uma seção com apuração descontada venha **dela**, inclusive quando isso
significa zero por ausência de linha; e que a inferência seja visível a quem confere.

**Não é objetivo:** mexer na quantidade contratada, mudar quais códigos entram no relatório ou em
que ordem, alterar a `R-ZER-01`, ou tratar a marca que aparece em descrição de linha.

## 4. Escopo

### 4.1 Dentro do escopo

- O pareamento entre bloco bruto e apuração descontada, por título.
- A leitura da ausência como zero, e a emissão correspondente.
- O registro visível da inferência, na tela e na API.
- A validação que impede a regra de se desligar em silêncio.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Quantidade contratada | `D-04` — é atributo do código, não da variante de apuração. `contratada_para` já resolve, e mexer nela reabriria a T-1625 |
| Marca em descrição de linha (SAN, L129) | `D-05` — ali as duas ocorrências existem e a `R-MED-02` acerta. Inferir apuração de seção a partir de uma descrição zeraria todos os demais códigos dela |
| A omissão do `.docx` | Consequência da `R-ZER-01`, que já existe e não muda. Esta espec produz o `0 / 0`; a ESPEC 028 decide o que fazer com ele |
| A família `10.050` e a `R-REL-08` | Regras de outra natureza, em outro ponto do fluxo |
| Manual de utilização | A §8.3 descreve o comportamento de hoje. Atualização registrada em `I-03` |

## 5. Regras

| ID | Regra |
|---|---|
| `R-APU-01` | Um bloco é **apuração descontada** quando o seu **título** contém `DESCONTANDO RECURSOS DE DESENVOLVIMENTO`. O bloco bruto que ele restabelece é aquele cujo título é igual ao dele removidos a marca e o separador que a precede |
| `R-APU-02` | Havendo par, a apuração descontada vale pela **seção inteira**: a quantidade medida de todo código do bloco bruto vem dela. É a `R-MED-02` elevada de código para bloco |
| `R-APU-03` | Código presente no bloco bruto e **ausente** da apuração descontada mede **zero**. A ausência de linha é afirmação de zero, não ausência de informação |
| `R-APU-04` | A **quantidade contratada não muda**. Continua vindo de `contratada_para` — a primeira ocorrência do código que a declare, onde quer que esteja |
| `R-APU-05` | Sem par, nada muda. Bloco descontado que não encontre bruto correspondente não altera leitura nenhuma, e dispara `V-MED-04` |
| `R-APU-06` | A marca em **descrição de linha** não constitui apuração de bloco. Aquele caso segue resolvido pela `R-MED-02` |
| `R-APU-07` | A `R-APU-03` só se aplica quando a ocorrência bruta traz medida **numérica**. Sendo não numérica, a `R-REL-08` (perfil ou pacote) segue mandando e `V-MED-04` avisa |
| ~~`R-APU-08`~~ | **REVOGADA em 2026-08-20 (§12).** Dizia: *toda aplicação da `R-APU-03` produz um registro visível — `LinhaZerada` — … A inferência não é silenciosa.* O `LinhaZerada` continua existindo no domínio e na resposta da API; o que saiu foi o quadro na tela |
| `R-APU-09` | O conjunto de códigos tocados pela `R-APU-03` é **invariante mantido**, afirmado por extenso nos dois pares reais: `{14.049.00054.00}` no piloto e `{14.049.00037.00}` no PGM |

### 5.1 Validação nova

| ID | Severidade | Quando dispara |
|---|---|---|
| `V-MED-04` | `AVISA` | Bloco com a marca no título cujo bloco bruto não foi encontrado (`R-APU-05`), ou ocorrência bruta não numérica alcançada pela `R-APU-03` (`R-APU-07`). Hoje não dispararia em arquivo nenhum |

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **A regra é por bloco, não por código** | É a formulação de quem pediu: *"se tiver dois blocos com o mesmo título, considerar o que tem DESCONTANDO"*. É também o que a planilha significa — o bloco de baixo é uma apuração completa. Formulada por código, ela precisa de um caso especial para a ausência, e caso especial é onde defeito se esconde |
| `D-02` | **O pareamento é por título, e não por posição nem por conteúdo** | Posição morre no dado (§2.3). Conteúdo — *"o bruto é o que contém os códigos do descontado"* — é inferência para responder o que o documento responde por escrito, e falha justamente quando a diferença é grande, que é o caso que a regra existe para tratar |
| `D-03` | **`item_para` fica intocada; a resolução nova é método próprio** | `item_para` responde *qual ocorrência vale*, e aqui a resposta é *nenhuma*. Forçar esse caso no tipo de retorno dela mexeria em todos os chamadores para servir a um. O caso de uso pergunta as duas coisas, e a `R-APU-08` garante que a segunda pergunta não passe despercebida |
| `D-04` | **A contratada não entra na regra** | T-1625: a variante descontada costuma trazer a coluna vazia, e o total está na ocorrência primária. Ler a contratada da apuração descontada produziria `0` onde a planilha afirma 3.500 — o defeito simétrico ao que esta espec corrige |
| `D-05` | **Marca em descrição não constitui apuração** (`R-APU-06`) | Limite declarado. Não há caso real, e inferir seção a partir de uma descrição zeraria todos os demais códigos dela. Risco desproporcional ao ganho |
| `D-06` | **Registro visível, e não achado novo de validação** (`R-APU-08`) | Precedente da ESPEC 021 `R-PER-08`: a `V-REC-02` foi *promovida* de frase para registro de seis campos. Criar os dois poria a mesma informação em dois lugares para divergirem depois. A `V-MED-04` cobre coisa diferente — a regra **não** ter funcionado |
| `D-07` | **Entrega em uma fase** | A alternativa de duas — detectar sem emitir, com âncoras provadamente inalteradas, e emitir depois — foi oferecida e recusada. O que se perde é a régua *"nenhuma diferença é aceitável"*; o que sobra é a §8.4, com o diff enumerado antes da primeira linha de código. Com duas linhas em jogo é administrável, e fica registrado que a escolha foi de quem pediu |
| `D-08` | **A inferência erra para menos** | Se a planilha esquecer uma linha de verdade, subdeclaramos uma quantidade medida, com o registro na tela. O erro de hoje é o oposto: afirmar consumo sem cobertura em peça de cobrança. Entre subdeclarar com rastro e acusar sem base, o primeiro domina — e nenhuma pessoa distingue *"é zero"* de *"esqueci"* olhando a mesma planilha |

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `domain/entities/measurement.py` | `_apuracoes_descontadas` (pareamento, `R-APU-01`) e `omitido_da_apuracao_descontada(codigo)` (`R-APU-03`). `item_para`, `contratada_para` e `codigos_em_ordem` **intocadas** |
| `domain/entities/measurement_item.py` | A marca deixa de ser privada — o pareamento precisa dela. Sem mudança de comportamento |
| `domain/entities/report.py` | `LinhaZerada` — registro novo ao lado de `LinhaDerivada`, e **fora** do agregado `Report`, pelo mesmo motivo: o `Report` é o documento; isto é auxílio de conferência |
| `application/use_cases/generate_measurement_report.py` | `_montar_linha` ganha o ramo guardado da `R-APU-03`, **antes** do ramo de perfil ou pacote; `ReportResult` ganha `zeradas` |
| `infrastructure/validations/measurement_validations.py` | `v_med_04_apuracao_sem_par` |
| `infrastructure/di/container.py` | Registro da validação nova |
| `api/schemas.py` · `routers/reports.py` | Campo novo com as `zeradas`, aditivo |
| `frontend/` | Tabela das linhas zeradas, no padrão da tabela de linhas derivadas da ESPEC 021 |
| `infrastructure/report/docx_renderer.py` · `xlsx_analise_renderer.py` | **Nenhuma.** A linha chega `0 / 0` e a `R-ZER-01` já sabe o que fazer |

## 8. Testes e critério de aceite

### 8.1 As regras

| Regra | Verificação |
|---|---|
| `R-APU-01` | Os quatro blocos descontados dos dois pares emparelham; título com marca abreviada ou separador trocado **não** emparelha, e cai em `V-MED-04` |
| `R-APU-02` | Nos dois pares, os 13 e os 9 códigos repetidos mantêm exatamente os valores de `CONGELADOS_PILOTO` e `CONGELADOS_PGM` — nenhum deles se move |
| `R-APU-03` | Fixture nova e mínima: bloco bruto com 3 códigos, descontado com 2. O terceiro sai `0` |
| `R-APU-04` | `14.024.00005.00` continua `contratada 3500 / medida 762,55` no piloto — o caso que prova que a contratada não foi arrastada |
| `R-APU-05` | `levantamento_sem_marca_de_desconto.xlsx` — nenhum par, nenhuma mudança, `V-MED-03` segue sendo quem avisa |
| `R-APU-06` | `14.024.00005.00` de novo: a marca está na descrição, o bloco `E5.1` não é apuração descontada, e nada nele é zerado |
| `R-APU-07` | Cenário construído: ocorrência bruta com medida `PACOTE` ausente da apuração descontada — sai `1 / 1` pela `R-REL-08`, com `V-MED-04` |
| `R-APU-08` | O `LinhaZerada` do piloto traz linha 59, os dois títulos e o texto `'2'` |
| `R-APU-09` | Conjunto tocado afirmado por extenso nos dois pares. Cresceu, encolheu ou esvaziou: reprova |

### 8.2 Regressão

- `test_desconto_desenvolvimento.py` passa **sem edição**: `CONGELADOS_PILOTO` e `CONGELADOS_PGM`
  não contêm nenhum dos dois códigos órfãos. Conferido antes de escrever esta espec, e é a
  evidência mais direta de que a `R-MED-02` não foi tocada;
- `test_analise.py` passa sem edição: os cenários de crítico são `ReportLine` construída, e a
  mudança é anterior, em `Measurement`;
- `total_linhas == 58` nos dois pares **não muda** — a linha continua no `Report`, na análise e na
  API, com medida `0` (`R-ZER-05` da ESPEC 028).

### 8.3 A suíte passa a ver os arquivos reais

Hoje ela toca apenas `backend/tests/fixtures/`, nunca `docs/documentos/`. Foi esse o buraco da
ESPEC 018 §2.8. Entra um teste marcado que abre os dois arquivos reais e confere a contagem de
pares e o conjunto tocado (`R-APU-09`). Verificação feita à mão em agosto não é garantia em
novembro.

### 8.4 O diff esperado, enumerado antes do código

Linha de base capturada com a árvore parada, antes de qualquer alteração. O `sha256` é **por
entrada do pacote, com `docProps/core.xml` fora**:

| | `.docx` | `.xlsx` de análise |
|---|---|---|
| Piloto | `d7829ee0af3cb50f` | `0a0b779902f1d6ed` |
| PGM | `a1df03d46f3e5cc2` | `d4ef7185adf8fe47` |

> **Por que não é o `sha256` do arquivo, que a v1.0 registrava.** A `T-2138` mediu duas capturas do
> **mesmo** relatório, sem nada mudar entre elas, e o `.xlsx` saiu diferente nas duas: um byte, e o
> byte é o `dcterms:modified` de `docProps/core.xml`. O `.docx` é byte-estável — a `R-DOC-10` o
> normaliza de propósito —, e o `.xlsx` não, porque nenhuma âncora do projeto o media inteiro e o
> problema nunca apareceu. Os quatro valores da v1.0 ficam **revogados**: dois eram irreprodutíveis.
>
> O método é o que `test_identidade_dos_artefatos.py` já documenta para os pacotes: *"por entrada
> do pacote, e não um `sha256` do arquivo… alguns bytes variam entre processos, `docProps/core.xml`
> inclusive"*. Estava escrito, e a v1.0 não o aplicou ao `.xlsx`.

O que deve mudar, e nada além disto. **A tabela é o resultado da `T-2134`** — as seis buscas do
PLANO §8 sobre `backend/tests/` inteiro, mais a simulação por *monkeypatch* que produziu os
números. A v1.0 previa 17 linhas de cabeça; a medição achou 24, e sete delas a v1.0 não tinha.

| Âncora | Hoje | Esperado |
|---|---|---|
| **Números do domínio — piloto** | | |
| itens críticos | 1 | **0** |
| sem divergência | 21 | **22** |
| `total_divergencias` | 37 | **36** ← *ausente da v1.0* |
| bloco final exibido | 1 | **0** ← *ausente da v1.0; ver §2.7* |
| `total_linhas` | 58 | **58** *(não muda)* |
| **Números do domínio — PGM** | | |
| itens críticos | 4 | **3** |
| sem divergência | 31 | **32** |
| `total_divergencias` | 27 | **26** ← *ausente da v1.0* |
| bloco final exibido | 4 | **3** |
| `total_linhas` | 58 | **58** *(não muda)* |
| **Constantes e asserções** | | |
| `test_anchor_por_codigo.py:37` `LINHAS_DO_PILOTO` | 55 | **54** |
| `test_anchor_por_codigo.py:38` `LINHAS_DO_PGM` | 51 | **50** |
| `test_anchor_por_codigo.py:88` `ZERADOS_DO_PILOTO` | 3 | **4** — entra `14.049.00054.00` |
| `test_anchor_por_codigo.py:94` `ZERADOS_DO_PGM` | 7 | **8** — entra `14.049.00037.00` |
| `test_docx_formatacao.py:84` — lavanda, uma por linha | 55 | **54** ← *ausente da v1.0* |
| `test_docx_formatacao.py:287` — `R-NOT-01`, asterisco | passa | **repontar ao PGM** ← *ausente da v1.0* |
| `test_docx_formatacao.py:300` — `R-NOT-02`, nota | passa | **repontar ao PGM** ← *ausente da v1.0* |
| `test_api_e2e.py:114` — linhas do `.docx` embutido | 55 | **54** ← *ausente da v1.0* |
| `test_api_e2e.py:126,128` — `total_divergencias` e `len` | 37 | **36** |
| `test_api_e2e.py:157` — `len(demais_itens)` | 4 | **4** *(não muda)* |
| `test_api_e2e.py:160,162` — `sem_cobertura` e saldo `-2` | 1 item | **vazio** |
| `test_api_e2e.py:369-371` — críticos e a marca | 1 item | **vazio** |
| `test_capa.py:80` `CORPO_DO_PILOTO_TEXTOS` | 16.017 | **medir** — o `16.013` da v1.0 fica revogado (§2.7) |
| `test_capa.py:81` `CORPO_DO_PILOTO_CODIGOS` | 76 | **75** (54 + 21 do anexo) |
| `test_capa.py:82` `CORPO_DO_PILOTO_SHA256` | — | reancorar com delta provado |
| `test_identidade_dos_artefatos.py` — `word/document.xml` | — | reancorar, dois pacotes |
| `test_linhas_derivadas.py:333` + `linhas_do_documento.json` | 58 linhas/par | regravar **por deleção**; `git diff` sem inserções |
| `test_anchor_analise.py:54,57` `CONTAGEM_ESPERADA` | 1 / 21 | **0 / 22** |
| `test_anchor_analise.py:151-152` — `diferencas[…00054]` | `EXCEDENTE` / `CRITICO` | sai da lista |
| `test_divergences.py:148-149` — `total_divergencias` | 37 | **36** ← *ausente da v1.0* |
| `test_divergences.py:175-181` — `sem_previsao_contratual` | 1 item | **vazio** ← *ausente da v1.0* |
| `test_reconciliation.py:128-133` — `sem_cobertura_contratual` | `True` | **`False`** ← *ausente da v1.0* |
| `test_xlsx_analise.py:381` — aba *Itens Críticos* | 1 linha | **vazia** ← *ausente da v1.0* |
| `test_xlsx_analise.py:52` `FORA_DA_COMPARACAO` | contém `…00054` | rever |
| `README.md` — quadro de estado | *"1 crítico, 20 sem medição, 16 parciais, 19 conformes"* | atualizar; os dois últimos já estavam defasados |

**Confirmado sem edição**, e é o resultado mais tranquilizador da `T-2134`:

- `test_desconto_desenvolvimento.py` — `CONGELADOS_PILOTO` e `CONGELADOS_PGM` não contêm nenhum dos
  dois órfãos. A `R-MED-02` não se move;
- `test_analise.py` e `test_linhas_zeradas.py` — cenários construídos, anteriores a `Measurement`;
- `test_anchor_analise.py:114` — `sum(declarado) == 55` mede o **gabarito do GRC**, arquivo externo;
- os cinco `total_linhas == 58` e o `total_itens == 58` espalhados pelo e2e.

**Critério de aceite:** qualquer diferença fora desta tabela reprova a entrega. Vale a regra do
TASKS 026 §9.10 — reancorar exige delta provado **e** árvore parada.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| A regra se desligar sozinha numa planilha futura cujo título grafe a marca de outro jeito, voltando ao defeito de hoje em silêncio — o modo de falha da ESPEC 018 | `V-MED-04` (`R-APU-05`) transforma o não-pareamento em achado visível, e a §8.3 põe os arquivos reais sob teste |
| O alcance crescer sem que ninguém veja | `R-APU-09`: conjunto por extenso, mantido |
| A planilha esquecer uma linha de verdade, e o zero ser inferido sobre esquecimento | `R-APU-08` — o registro mostra o valor bruto ao lado do zero emitido. Não é eliminável: nem uma pessoa distingue os dois casos olhando a planilha (`D-08`) |
| Reancorar às cegas as cinco constantes de documento | §8.4 — diff enumerado antes do código, e a regra do TASKS 026 §9.10 |
| A entrega em uma fase misturar a mudança de mecanismo com a de valor | `D-07` — escolha registrada de quem pediu, com o custo nomeado |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | Desenvolvimento é cobrado de **algum** cliente? Quem pediu escreveu que aguarda três pessoas responderem | **Não.** A regra não depende da resposta: ela lê o que a planilha afirma. Cobrando-se um dia, a planilha listará o item nos dois blocos e a regra continua correta |
| `I-02` | O `LinhaZerada` deve aparecer também no `.xlsx` de análise, ou basta a tela? | Não. Segue o precedente da ESPEC 021, que deixou `LinhaDerivada` só na tela |
| `I-03` | A §8.3 do manual descreve o comportamento antigo do desconto | Não. Correção editorial, junto da entrega |
| `I-04` | Com o bloco final vazio, o documento do piloto deixa de falar do assunto. Vale, numa espec futura, afirmar *"nenhum item fora do contrato teve movimento no período"* em vez de calar? | Não. Oferecido e recusado nesta entrega (§2.7); é conteúdo de documento, não consequência técnica |

## 11. Relação com a ESPEC 028

A ESPEC 028 §1 listou o `14.049.00054.00` com `0 / 2` e o usou como **o contraste que fecha o
argumento**:

> A `14.049.00054.00` é o contraste que fecha o argumento: `0 / 2` diz *"consumimos dois de um item
> que o contrato analisado não conhece"*, e isso é exatamente o que o bloco final existe para
> mostrar. Uma coluna zerada é informação; duas são ausência de assunto.

O raciocínio continua **inteiramente correto**, e a `R-ZER-01` não muda uma vírgula. O que evapora
é o exemplo: aquele `0 / 2` nunca existiu na planilha — é defeito de leitura desta espec. Depois
dela, o item passa a ser `0 / 0` e a `R-ZER-01` o omite, junto dos outros três.

Fica o registro de que a ESPEC 028 escolheu o único exemplo do piloto que era artefato do próprio
sistema, e de que dois incrementos e uma conferência manual foram necessários para perceber. É a
razão de a `R-APU-08` existir: número inferido sem registro visível vira premissa de argumento
alheio.

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Pareamento e `omitido_da_apuracao_descontada` no domínio | PP |
| B | O ramo guardado em `_montar_linha`, `LinhaZerada` e `ReportResult` | PP |
| C | `V-MED-04` e registro no contêiner | PP |
| D | API e a tabela no frontend | P |
| E | Testes das nove regras, fixture mínima nova e o teste dos arquivos reais | P |
| F | Reancoragem das cinco constantes, com delta provado | P |

**Estimativa: um dia.** O código é curto; o trabalho está em E e F, e é trabalho de prova.

---

## 12. `R-APU-08` revogada — 2026-08-20

**Pedido de quem confere, depois de ver o quadro em uso:** retirar da tela a seção *"Linhas zeradas
pela apuração que desconta desenvolvimento"*.

**Feito.** O componente foi removido e o seu uso no painel de resultado, também.

**O que fica:** `LinhaZerada` continua sendo produzida no domínio, viaja no `ReportResult` e sai no
campo `linhas_zeradas` da resposta da API. **A informação não foi destruída — saiu da tela.** O
campo custa alguns bytes numa resposta que raramente os tem, e mantê-lo deixa a porta aberta para
quem consome a API e para uma tela futura.

**O que se perde, e está aqui porque foi argumentado contra:** esta espec sustentou, na §11, que
número inferido sem registro visível vira premissa de argumento alheio — foi assim que a ESPEC 028
apoiou o exemplo central do seu §1 num `0 / 2` que o próprio sistema fabricava, e foram precisos
dois incrementos e uma conferência manual para alguém perceber.

Com a `R-APU-08` revogada, o zero do `14.049.00054.00` volta a ser invisível para quem só olha a
tela. Quem quiser conferi-lo terá de ler a resposta da API ou abrir a planilha.

**A alternativa oferecida e não escolhida** era manter o quadro e permitir dispensar a linha já
conferida. Fica registrada aqui para que a próxima pessoa saiba que ela existiu.

**Isto é revogação de regra, não ajuste de tela**, e por isso está numa seção própria em vez de num
`git diff` de componente.