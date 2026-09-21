# ESPEC 022 — O contratado é a proposta mais os seus aditivos

| | |
|---|---|
| **Status** | **Implementada** — 2026-08-18. Portões `P0` a `P5` fechados; suíte de backend 537 → **547** |
| **Versão** | 1.0 — 2026-08-18 |
| **Depende de** | [ESPEC 018](018-o-relatorio-segue-o-contrato.md) e [ESPEC 019](019-contrato-e-aditivos.md) — implementadas |
| **Revisa** | `R-ADT-06` e `D-02` da ESPEC 019 (*"o quantitativo fica de fora"*), `D-08` (o silêncio por lista de códigos) e o texto da `V-ADT-02` |
| **Não toca** | `R-REL-04` / `D-05` da ESPEC 018. As duas quantidades do documento continuam vindo da aba `Levantamento`. §2.3 mede que o `.docx` e o `.xlsx` saem **idênticos** |
| **Referência normativa** | `backend/tests/fixtures/contrato_pgm.pdf`, `aditivo_pgm.pdf` e `levantamento_pgm.xlsx` |
| **Origem** | *"Há como alterarmos para considerar os quantitativos de contratos e aditivos"* — e, no mesmo fôlego, *"é apenas visual, na tela, não deve interferir no relatório docx ou xlsx"* |

---

## 1. Problema

A tela do PGM sem aditivo termina com cinco frases amarelas:

```
V-REC-01  código 10.050.00001.00: quantidade contratada diverge entre as fontes
          — contrato 42260.00, levantamento 42814.01. O relatório usa a do levantamento
```

A ESPEC 019 §2.9 já tinha medido que essas cinco divergências **não eram divergência**: eram a
ausência de uma peça. Somando os blocos `Aumento` e `Redução` do aditivo, as duas fontes batem,
cinco de cinco.

Sabendo disso, a `D-08` daquela espec resolveu o sintoma pelo caminho mais barato: `V-REC-01`
passou a **calar** sobre os códigos que os blocos descartados tocam. A lista vem de
`codigos_ignorados()`, e é literalmente um conjunto de supressão.

O silêncio funciona, e o produto ficou melhor com ele. Mas tem um custo que não estava medido, e
que esta espec mede em §2.4: **naqueles cinco códigos o sistema deixou de conferir qualquer
coisa.** Se a planilha trouxer o número errado justamente ali, ninguém vê — não porque as fontes
concordam, mas porque a comparação foi desligada.

Há uma segunda consequência, menor e mais incômoda: enquanto o silêncio não se aplica — quando o
aditivo não é submetido —, a frase chama de *"contrato"* um número que **não é o contratado
vigente**. `42.260,00` é a proposta original; o contratado é `42.814,01`. A mensagem está
tecnicamente correta sobre a sua própria fonte e enganosa sobre o mundo.

As duas coisas têm a mesma causa: o consolidado não conhece os deltas.

---

## 2. O que foi medido

Execução sobre `feature/evolucao` com as fixtures do PGM. Nada aqui é lembrança.

### 2.1 Os deltas já chegam prontos para serem somados

Extração de `aditivo_pgm.pdf`:

| bloco | código | quantidade extraída | unidade |
|---|---|---:|---|
| `AUMENTO` | `10.050.00001.00` | `554.01` | HORA/HOMEM |
| `AUMENTO` | `14.031.00020.00` | `5.00` | LICENÇA ATIVA/MÊS |
| `AUMENTO` | `14.024.00006.00` | `2900.89` | GB/MÊS |
| `AUMENTO` | `14.048.00027.00` | `1100.00` | GB/MÊS |
| `REDUCAO` | `12.030.00001.00` | **`-80.00`** | Mbps/MÊS |
| `INCLUSAO` | `14.071.00006.00` · `14.071.00007.00` | `5.00` · `1.00` | UN · SERVIÇO/MÊS |

**A `Redução` já vem negativa do documento.** O total do bloco também (`-897.734,40`). Não é
preciso interpretar o rótulo para decidir sinal: os dois rótulos recebem o mesmo tratamento, e é
o que torna esta espec pequena.

### 2.2 A soma fecha, cinco de cinco

| código | consolidado hoje | com os deltas | aba `Levantamento` | |
|---|---:|---:|---:|:--|
| `10.050.00001.00` | 42.260,00 | **42.814,01** | 42.814,01 | ✅ |
| `12.030.00001.00` | 150,00 | **70,00** | 70 | ✅ |
| `14.024.00006.00` | 6.100,00 | **9.000,89** | 9.000,89 | ✅ |
| `14.031.00020.00` | 5,00 | **10,00** | 10 | ✅ |
| `14.048.00027.00` | 200,00 | **1.300,00** | 1.300 | ✅ |

Varrendo **todos** os códigos do consolidado contra a aba: `5` divergências hoje, `0` com os
deltas aplicados. É a tabela da ESPEC 019 §2.9 — que a mediu e escolheu não usar — agora
verificada por execução, e não por leitura do PDF.

### 2.3 O `.docx` e o `.xlsx` não mudam

Pipeline completo rodado duas vezes com o par `contrato_pgm.pdf` + `aditivo_pgm.pdf` +
`levantamento_pgm.xlsx`, uma sem e outra com os deltas, comparando **entrada por entrada dentro
do zip** (hash do conteúdo de cada parte, sem os metadados do arquivo):

| Artefato | Resultado |
|---|---|
| `.docx` | **Todas as partes idênticas** |
| `.xlsx` | Todas idênticas **exceto** `docProps/core.xml` |
| Objeto `Report` (linhas, demais itens, divergências, derivadas) | **Idêntico** |

E a única diferença do `.xlsx` foi aberta:

```
antes  -> <dcterms:modified>2026-08-18T13:02:05Z</dcterms:modified>
depois -> <dcterms:modified>2026-08-18T13:04:17Z</dcterms:modified>
```

É o carimbo de hora da geração, que difere entre duas execuções quaisquer. **Nenhuma célula, e
nenhum parágrafo, muda.**

O `Report` idêntico é a prova mais forte das três: não é coincidência de renderização — é que a
quantidade do contrato **não chega aos renderizadores**. `R-REL-04` / `D-05` faz as duas
quantidades virem da aba, e do contrato saem apenas ordem, descrição e unidade.

### 2.4 A cegueira, medida

Cinco cenários da `V-REC-01`. Nos dois últimos, a aba foi adulterada de `1.300` para `1.400` no
`14.048.00027.00` — um código coberto pelo bloco `Aumento`:

| cenário | avisos | quais |
|---|---:|---|
| sem aditivo | 5 | os cinco da §2.2 |
| com aditivo — **hoje** | 0 | — |
| com aditivo — com deltas | 0 | — |
| **aba adulterada — hoje** | **0** | — ← **não percebe** |
| **aba adulterada — com deltas** | **1** | `14.048.00027.00` |

**É a justificativa desta espec.** Hoje o silêncio da `D-08` é indistinguível de conferência: a
tela diz a mesma coisa quando as fontes concordam e quando a planilha está errada. Com a soma, o
silêncio passa a significar *"eu conferi e bate"*.

Note a terceira linha: no caso feliz **a tela não muda**. O ganho não é visual — é que a
checagem passa a existir.

### 2.5 Nada do que o contrato fornece ao documento se move

As três coisas que o consolidado entrega ao relatório, e por que somar itens no fim da lista não
as altera:

| O que | Como é obtido | Efeito da soma |
|---|---|---|
| **ordem** | `posicao_de` devolve o índice da **primeira** ocorrência do código | Nenhum — o código já existe antes; os itens do delta entram no fim |
| **descrição** | `descricao_para` usa `candidatos[0]` | Nenhum — o primeiro continua sendo o da proposta |
| **unidade** | `_unidade` usa `itens[0].unidade` | Nenhum — pelo mesmo motivo, e importa: a unidade do aditivo chega com encoding sujo (`LICEN?A ATIVA/ M?S`) |

É o mecanismo por trás de §2.3, e é o que permite `R-QTD-05` ser uma regra e não uma esperança.

---

## 3. Objetivo

Que o quantitativo contratado do consolidado seja **o da proposta mais os seus aditivos**, para
que a `V-REC-01` volte a comparar em vez de suprimir — sem alterar uma célula do que é entregue.

Não-objetivo: mudar de onde o documento tira número. Ver `D-05`.

---

## 4. Escopo

### 4.1 Dentro do escopo

- Aplicar `Aumento` e `Redução` em `Contract.aplicar`;
- Remover o parâmetro `explicados` da `V-REC-01` e o seu preenchimento no container;
- Reescrever o texto da `V-ADT-02`, que passa a ser falso pela metade;
- Um teste de não-alteração dos artefatos, travando §2.3 como regressão permanente;
- Atualizar os docstrings que documentam o mecanismo antigo.

### 4.2 Fora do escopo

- **A `R-CTR-01`.** A premissa que a revogou cai (`D-05`), mas reabri-la é decisão de negócio com
  efeito no entregável, e esta espec prometeu não tocar no entregável;
- A apresentação da `V-REC-01` na tela — a tabela estruturada discutida em `I-25`;
- Qualquer leitura nova de PDF. Os três blocos já são extraídos hoje e descartados na aplicação.

---

## 5. Regras

| ID | Regra |
|---|---|
| `R-QTD-01` | `Contract.aplicar` passa a aplicar **os quatro** rótulos. `Aumento` e `Redução` entram como itens adicionais do mesmo código, e `quantidade_para` os soma pelo caminho que já existe |
| `R-QTD-02` | **O sinal vem do documento.** A `Redução` é extraída negativa (§2.1); nenhum rótulo é interpretado para decidir sinal, e os dois recebem tratamento idêntico |
| `R-QTD-03` | O delta só é aplicado a código **já presente** no consolidado naquele ponto da sequência. `Aumento` de código ausente continua sendo `V-ADT-04`, e a sua linha continua caindo no bloco final |
| `R-QTD-04` | A ordem de `R-ADT-07` é preservada: os blocos de cada peça são aplicados na ordem de submissão, e um código excluído por um aditivo posterior não é ressuscitado por um delta anterior |
| `R-QTD-05` | **Nada muda no `.docx` nem no `.xlsx`.** Travado por teste sobre os artefatos gerados, não por confiança na cadeia de chamadas |
| `R-QTD-06` | O parâmetro `explicados` da `V-REC-01` **deixa de existir**. O silêncio passa a ser aritmético |
| `R-QTD-07` | `codigos_ignorados()` **permanece** — `V-ADT-04` depende dela —, com o docstring reescrito: ela deixa de ser evidência de silêncio e volta a ser o que o nome diz |
| `R-QTD-08` | A `V-ADT-02` deixa de afirmar que um aditivo só de quantitativo não tem efeito. Ele passa a ter — na conferência, não no documento — e a mensagem tem de distinguir as duas coisas |

---

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **Somar itens, em vez de mutar a quantidade do item existente** | `quantidade_para` já soma todas as linhas do código, porque a proposta desdobra o mesmo código em várias linhas (`10.050.00001.00` são três). Somar um item a mais usa o mecanismo que existe; mutar exigiria escolher *qual* das três linhas recebe o delta, pergunta que o documento não responde |
| `D-02` | **O sinal é dado do documento, não do rótulo** | Medido em §2.1. Derivar o sinal do rótulo criaria uma segunda fonte de verdade para a mesma informação, e ela divergiria no dia em que um aditivo trouxesse `Redução` com valor positivo. `RotuloDeBloco` continua decidindo **o que fazer**, nunca **com que sinal** |
| `D-03` | **A guarda de `R-QTD-03` é o que impede a soma de mudar a estrutura** | Sem ela, um `Aumento` de código ausente criaria um item do nada, e aquele código ganharia posição no contrato — saindo do bloco final para o corpo ordenado. Isso mudaria o `.docx`, que é exatamente o que esta espec promete não fazer. `V-ADT-04` já descreve o comportamento correto (*"a linha sairá no bloco final"*), e a guarda o preserva |
| `D-04` | **O silêncio por lista de códigos sai inteiro** | Manter os dois — soma **e** supressão — deixaria a supressão como rede invisível: ela nunca dispararia, e ninguém saberia que estava lá até o dia em que mascarasse um defeito real. `D-08` da ESPEC 019 foi a decisão certa para o que se sabia então; §2.4 é o que se sabe agora |
| `D-05` | **A `R-CTR-01` não se reabre aqui** | A `D-05` da ESPEC 018 revogou *"o relatório usa a quantidade do contrato"* com uma premissa explícita: o PDF é de 11/11/2025 e a aba é de 23/07/2026, o contrato está defasado. Com os aditivos aplicados essa premissa cai — e mesmo assim não se mexe. O pedido de origem foi categórico sobre não tocar no entregável, e a decisão passa a estar **disponível**, que é diferente de estar tomada. Registrada em `I-26` |
| `D-06` | **`V-ADT-02` muda de texto, não de predicado** | `altera_o_conjunto` continua sendo sobre o conjunto de códigos, e é a pergunta certa para saber se o **documento** muda. O que ficou falso é a conclusão da frase, não a condição que a dispara |

---

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `domain/entities/contract.py` · `aplicar` | Ganha o ramo de `AUMENTO`/`REDUCAO` com a guarda de `R-QTD-03`. Docstring reescrito: hoje ele afirma *"só `Inclusão` e `Exclusão` são aplicadas"* e cita a medição das 58 linhas — que continua verdadeira e passa a ter companhia (§2.3) |
| `domain/entities/contract.py` · `codigos_ignorados` | **Fica** (`R-QTD-07`), com o docstring sem a referência a `D-08` |
| `infrastructure/validations/reconciliation_validations.py` | O parâmetro `explicados` e o `silenciados` saem. O docstring perde os três parágrafos sobre o silêncio fundamentado e ganha a razão nova |
| `infrastructure/validations/contract_validations.py` · `v_adt_02` | Texto da mensagem (`R-QTD-08`) |
| `infrastructure/di/container.py` | A chamada da `V-REC-01` perde o `explicados=` e volta a ter três argumentos |
| `domain/entities/measurement_item.py` | O comentário do `contratada_texto` diz *"fica guardada só para a V-REC-01"* — **já era impreciso** desde a ESPEC 018 (`contratada_para` alimenta o relatório). Corrigir de passagem |
| `application/` · `api/` · `infrastructure/report/` · `frontend/` | **Nenhuma.** É o que `R-QTD-05` afirma e §8.2 verifica |

Esboço, para fixar a forma e não a sintaxe:

```python
elif bloco.rotulo in (RotuloDeBloco.AUMENTO, RotuloDeBloco.REDUCAO):
    # `R-QTD-02` — a `Redução` chega negativa do documento (§2.1), então os
    # dois rótulos têm o mesmo tratamento e nenhum sinal é inferido aqui.
    #
    # `R-QTD-03` / `D-03` — **só para código que já existe.** Um `Aumento` de
    # código ausente é o que `V-ADT-04` acusa, e a linha tem de continuar
    # caindo no bloco final; aplicá-lo aqui lhe daria posição no contrato e
    # mudaria a estrutura do documento em silêncio.
    presentes = {i.codigo.valor for i in itens}
    itens.extend(i for i in bloco.itens if i.codigo.valor in presentes)
```

---

## 8. Testes e critério de aceite

### 8.1 Backend — `tests/test_quantitativo_consolidado.py` (novo)

| Regra | Verificação |
|---|---|
| `R-QTD-01` | Os cinco valores de §2.2, um a um. Não a contagem: os **números** |
| `R-QTD-02` | O `12.030.00001.00` sai `70,00`. É o único caso de redução, e é o que falha se alguém "corrigir" o sinal com `abs()` |
| `R-QTD-03` | Aditivo sintético com `Aumento` de código ausente: a quantidade do consolidado **não muda**, `V-ADT-04` dispara, e o código continua fora de `contrato.codigos` |
| `R-QTD-04` | Aditivo sintético que exclui um código que um aditivo anterior aumentou: o código sai, e o delta não o traz de volta |
| `R-QTD-06` | `v_rec_01_...` não aceita mais `explicados` — asserção de assinatura, que é o que impede o parâmetro de voltar como padrão silencioso |
| — | **A cegueira de §2.4**: com o aditivo e a aba adulterada em `14.048.00027.00`, a `V-REC-01` acusa **aquele** código. É o teste que dá sentido à espec inteira |

### 8.2 Backend — o portão de não-regressão

| Verificação | Âncora |
|---|---|
| `R-QTD-05` | Gerar `.docx` e `.xlsx` do par PGM+aditivo e comparar **parte a parte do zip** com o esperado, ignorando `docProps/core.xml`. É §2.3 virando teste |
| `R-QTD-05` | O objeto `Report` — linhas, `demais_itens`, `total_divergencias`, derivadas — idêntico. Falha antes e mais alto que o anterior, e diz **onde** |
| ESPEC 019 | `test_t1340_o_silencio_e_fundamentado_e_nao_geral` **continua valendo sem alteração**: ele roda sem aditivo, onde nada muda, e os cinco avisos continuam voltando |
| ESPEC 018 | `test_anchor_por_codigo.py:233` e `test_api_e2e.py:270` rodam no caminho **sem aditivo**. Verificado: nenhum dos dois muda |

### 8.3 Testes que mudam de razão, não de valor

`test_t1340_v_rec_01_zera_no_pgm` continua verde — e passa a estar verde por outro mecanismo. O
docstring dele descreve, em três parágrafos, o silêncio da `D-08` e o canário que o separa de
*"a validação foi desligada"*. **Reescrever, não apagar**: a contraprova continua necessária, e
agora é mais simples de enunciar — o silêncio é aritmético e a §2.4 é o seu canário.

### 8.4 Portões

| ID | Portão | Fecha quando |
|---|---|---|
| `P1` | **O entregável é bit a bit o mesmo** | §8.2 verde com o par real. Sem ele a espec não pode ser aceita, porque contradiz o pedido de origem |
| `P2` | **A cegueira fecha** | O teste da aba adulterada acusa `14.048.00027.00`. É o único que mede o objetivo; os outros medem que nada quebrou |

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| **Alguém "corrigir" o sinal da `Redução`** — aplicar `abs()` ou negar por rótulo, achando que o negativo é defeito de extração | `R-QTD-02` como regra, `D-02` com a medição, e a asserção do `70,00` em §8.1, que falha alto. É o defeito mais provável desta entrega, porque parece um acabamento |
| **A guarda de `R-QTD-03` ser esquecida** e um `Aumento` órfão mudar a estrutura do documento | `D-03` e o teste do aditivo sintético. É o único caminho pelo qual esta espec conseguiria alterar o `.docx`, e por isso está travado dos dois lados |
| **Perder o rastro de por que a `V-REC-01` cala** | O silêncio passa a ser observável: some porque os números batem, e §2.4 prova que ele volta quando não batem. É mais rastreável que a lista de supressão, não menos |
| **`V-CTR-03` acusar o consolidado** | Não roda nele (`R-ADT-09` / `D-07` da ESPEC 019). A soma dos totais do consolidado passa a incluir valores negativos, o que tornaria o checksum ainda mais sem sentido ali — e continua sem rodar |
| **O caso feliz não mostrar diferença nenhuma** e a entrega parecer inútil | É o que §2.4 existe para responder, e é por isso que `P2` é o portão do objetivo. Uma espec cujo sucesso é *nada visível mudar* precisa de um teste que mostre o que mudou |
| **A `R-CTR-01` voltar de carona** | `D-05` e §4.2. Se a discussão voltar, volta como espec própria — com o efeito no entregável na mesa, que é onde ela pertence |

---

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-25` | A `V-REC-01` merece tabela estruturada, como a `V-REC-02` ganhou na ESPEC 021? Cinco frases amarelas repetindo *"O relatório usa a do levantamento"* são a mesma patologia que a `R-PER-08` tratou | Não. Fica mais fácil depois desta espec: com os deltas aplicados, a coluna *"no contrato"* deixa de ser enganosa e passa a poder ser exibida |
| `I-26` | Com o contratado correto, a `R-CTR-01` deve voltar — o documento passar a usar a quantidade do contrato? | Não. `D-05`. Mas a premissa que a revogou caiu, e isso precisa estar registrado no dia em que alguém reabrir a pergunta |
| `I-27` | Um aditivo **só** de quantitativo passa a ter efeito na conferência e nenhum no documento. `V-ADT-02` deve continuar avisando? | Não. `R-QTD-08` resolve o texto; se a validação inteira deve sair é decisão que depende de ver o aviso novo em uso |
| `I-28` | O `ANEXO II` da proposta do PGM (ESPEC 019 §2.10) traz duas `Exclusão` que nenhum aditivo submetido carrega. Com o quantitativo em jogo, a diferença entre *o que o anexo registra* e *o que as peças aplicam* fica maior | Não. `D-12` da ESPEC 019 continua valendo: memória não se executa |

---

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | O ramo em `aplicar` com a guarda, e os docstrings de `aplicar` e `codigos_ignorados` | PP |
| B | `explicados` sai da `V-REC-01` e do container; docstring reescrito | PP |
| C | `test_quantitativo_consolidado.py`, incluindo o caso da aba adulterada | P |
| D | O portão de não-regressão de §8.2 sobre os artefatos | P |
| E | Texto da `V-ADT-02` e o docstring de `test_t1340_v_rec_01_zera_no_pgm` | PP |
| F | `P1` e `P2` | PP |

**Total: meio dia.** O que torna barato é §2.1: os três blocos já são extraídos, os sinais já vêm
prontos, e `quantidade_para` já soma. Nenhuma leitura nova, nenhuma regra de negócio nova.

O que exige atenção é a fase D. O teste dos artefatos é o único que impede esta espec de virar,
por acidente, a espec que ela promete não ser.

---

## 12. Relação com as especs anteriores

### 12.1 ESPEC 019 `R-ADT-06` e `D-02` — revogadas, com a razão registrada

`D-02` deixou o quantitativo de fora e chamou isso de *"o que torna a espec pequena"*. Estava
certo: naquele momento o quantitativo não tinha consumidor, porque `R-REL-04` já tinha tirado o
contrato do documento. O consumidor apareceu depois, e é a própria `V-REC-01`.

### 12.2 ESPEC 019 `D-08` — o silêncio troca de mecanismo, não de intenção

A intenção da `D-08` era não repetir cinco avisos que sempre disparam e nunca exigem ação — a
patologia que `R-REL-13` eliminou da `V-CTR-04`. Ela continua atendida: no PGM os avisos
continuam em zero (§2.4, terceira linha). O que muda é **o motivo**, e com ele a capacidade de o
sistema notar quando o motivo deixa de valer.

### 12.3 ESPEC 018 `R-REL-04` / `D-05` — intacta, e medida

Não é promessa de cadeia de chamadas: §2.3 compara os artefatos gerados. O `Report` idêntico é a
evidência de que a quantidade do contrato não alcança os renderizadores.

### 12.4 ESPEC 021 — o precedente que esta espec **não** segue

A ESPEC 021 tirou a `V-REC-02` de `avisos` e promoveu a informação a registro estruturado. Seria
o caminho natural para a `V-REC-01`, e é `I-25`. Esta espec faz o passo anterior: consertar o
**dado** antes de decidir como exibi-lo. Uma tabela com a coluna *"no contrato"* mostrando
`200,00` para um item aditivado seria uma apresentação melhor de um número errado.
