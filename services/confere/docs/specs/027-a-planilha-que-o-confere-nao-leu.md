# ESPEC 027 — A planilha que o Confere não leu

| | |
|---|---|
| **Status** | **Implementada** — 2026-08-19. Portões `P0` a `P3` fechados; `P4` é humano. Sessenta achados viram um; backend 1330 verdes; navegador 101/111, sem falha nova |
| **Versão** | 1.0 — 2026-08-19 |
| **Depende de** | [ESPEC 001](001-mvp-analise-medicao.md), [ESPEC 018](018-o-relatorio-segue-o-contrato.md), [ESPEC 023](023-o-aviso-que-diz-o-que-fazer.md), [ESPEC 025](025-o-arquivo-que-nao-e-a-proposta.md) — implementadas |
| **Revisa** | `V-MED-01` como hipótese em vez de causa; `V-MED-02` como duas mensagens para um cabeçalho; `V-CTR-05` como *n* cartões para uma lista; a ausência de guarda entre `V-MED-01` e as três validações que dependem dela |
| **Não toca** | A leitura da aba (`R-MED-*`), a reconciliação, o `.docx`, o `.xlsx`. Esta espec muda **o que se diz** sobre uma leitura que já decidiu certo — é a ESPEC 025 aplicada ao outro arquivo |
| **Referência normativa** | `levantamento.xlsx`, `levantamento_pgm.xlsx`, `contrato.pdf`, `contrato_pgm.pdf` |
| **Origem** | *"há como melhorar as mensagens abaixo referente a validação do arquivo Levantamento"*, sobre a tela de bloqueio com 60 cartões |

---

## 1. Problema

Uma planilha cujo layout o leitor não reconhece produz **sessenta cartões na tela**, e cinquenta
e nove deles são consequência do primeiro:

```
V-MED-01  nenhum item encontrado na aba 'Levantamento' — o layout da planilha pode ter mudado
V-MED-02  data do levantamento não localizada no cabeçalho da aba
V-MED-02  contrato de referência não localizado no cabeçalho da aba
V-CTR-05  código 10.050.00001.00 está no contrato mas não aparece no levantamento — …
V-CTR-05  código 10.050.00002.00 está no contrato mas não aparece no levantamento — …
…                                                              (mais 55 iguais)
```

O cabeçalho da tela diz **"Corrija o ponto abaixo"**, no singular. Ele está certo: há um ponto
só. É a tela que não sabe disso.

**Isto é a ESPEC 025 §1, palavra por palavra, do outro lado do formulário.** Lá eram três
mensagens para uma causa no campo Contrato; aqui são sessenta no campo Levantamento. Aquela
espec construiu o achado de quatro partes, o cartão que o empilha e o padrão de guarda no
orquestrador — e aplicou tudo a duas validações do contrato. As da medição ficaram para trás.

E a mensagem que sobra, mesmo sozinha, não serve: *"o layout da planilha pode ter mudado"* é
uma **hipótese sobre o arquivo**, não uma causa. Quem lê não tem o que fazer com ela.

---

## 2. O que foi medido

Execução sobre `feature/evolucao`, com as fixtures do repositório.

### 2.1 Sessenta achados, uma causa

Aba lida, zero itens — o cenário da imagem —, com cada validação chamada como o container as
chama hoje:

| Par | Total na tela | `V-MED-01` | `V-MED-02` | `V-CTR-05` |
|---|---|---|---|---|
| Piloto | **60** | 1 | 2 | **57** |
| PGM | **49** | 1 | 2 | **46** |

As três que se repetem são **aritmética da primeira**:

* `V-CTR-05` percorre `contrato.codigos - medicao.codigos`. Com a medição vazia, isso é o
  contrato inteiro — 57 códigos no piloto, 46 no PGM. Ela não descobriu nada; ela subtraiu de
  um conjunto vazio.
* `V-MED-02` lê data e contrato das **dez primeiras linhas da coluna A** — as mesmas linhas de
  onde os itens não saíram. Quando o layout escapa, os três falham juntos, e por um motivo só.

[`container.py:194-197`](../../backend/src/infrastructure/di/container.py) chama as quatro em
sequência, sem guarda:

```python
v_med_01_aba_reconhecida(medicao, achados)
v_med_02_cabecalho_localizado(medicao, achados)
v_med_03_desconto_por_posicao(medicao, achados)
v_ctr_05_codigo_contratado_ausente_da_aba(contrato, medicao, achados)
```

Sete linhas acima, no mesmo arquivo, a ESPEC 025 pôs a guarda equivalente para o contrato:

```python
if all(peca.itens for peca in (proposta, *aditivos)):
    v_ctr_01_tabela_localizada(contrato, achados)
```

**A `R-GRD-06` — *não acusar consequência de coisa já acusada* — vale desde a ESPEC 017 e é
violada aqui.** Não por discordância: por não ter chegado a este lado.

### 2.2 Duas das treze validações têm o cartão de quatro partes

`registrar_em_partes` existe, está testado, e é usado por **`V-DOC-01` e `V-ADT-01`** — as duas
que a ESPEC 025 tocou. As outras onze, `V-MED-*` e `V-CTR-05` inclusive, chamam `registrar()` e
caem no ramo de compatibilidade do painel
([`ResultadoPanel.tsx:42`](../../frontend/src/app/components/ResultadoPanel.tsx)):

```tsx
if (!achado.titulo) {
    // sai o identificador em monoespaçado e a frase corrida
}
```

É o que a imagem mostra. **O cartão bom não está quebrado: ele não está sendo alimentado.**

### 2.3 A causa real é enumerável, e o diagnóstico é de graça

O leitor lê **as cinco primeiras colunas**
([`levantamento_reader.py:29`](../../backend/src/infrastructure/measurement/levantamento_reader.py)):

```python
COLUNAS_LIDAS = 5
linhas = [[_texto(v) for v in linha[:COLUNAS_LIDAS]] for linha in livro[ABA].iter_rows(...)]
```

Um código de serviço na coluna F ou adiante rende **zero itens**. E essa é a diferença entre
*"o layout pode ter mudado"* e *"os códigos estão na coluna H"* — a segunda frase conserta o
problema, e o sistema tem como sabê-la.

Verificado com uma planilha sintética, códigos na coluna H:

```
itens lidos                  : 0
COLUNAS_LIDAS                : 5
linhas preenchidas           : 5
códigos por coluna (1-based) : {8: 3}
=> degrau 2 detectável       : True
```

O custo é **uma releitura da mesma planilha já aberta, e só quando a leitura falha**. No caminho
feliz, zero. É a mesma economia da `R-GRD-07`: o diagnóstico sai do que já foi olhado.

Daí três degraus, no molde da `R-DOC-03`:

| Degrau | Evidência | O que se pode afirmar |
|---|---|---|
| 1 | Nenhuma célula preenchida na aba | a aba está vazia |
| 2 | Há códigos, **fora das colunas A–E** | em qual coluna eles estão |
| 3 | Nenhum código em lugar nenhum da aba | o arquivo não parece um levantamento |

**O degrau 2 é o que muda a vida de quem confere**, e hoje é indistinguível dos outros dois.

### 2.4 O caminho da aba ausente já é bom, e não entra

Planilha sem a aba `Levantamento` levanta `ExtractionError` no leitor e sai como 422 com
*"planilha sem a aba 'Levantamento' — verifique se o arquivo é o levantamento"*. Nomeia a causa
e o conserto, não passa pelo painel de achados, e tem teste próprio
(`test_planilha_sem_a_aba_levantamento_falha`). **Fica como está**, e está registrado para que
ninguém o inclua por simetria.

### 2.5 O nome do arquivo não chega à validação da medição

`Entradas` carrega `nome_do_contrato` desde a `R-DOC-06`, e **só ele**. O caminho em disco é
posicional (`levantamento.xlsx`) pela razão da `R-ADT-10`, então o cartão da medição não tem
como exibir o arquivo que a pessoa enviou — que é a segunda linha de todo cartão da ESPEC 025.

---

## 3. Objetivo

Que a tela de bloqueio do levantamento mostre **um cartão**, e que esse cartão diga em qual
coluna estão os códigos.

Nenhuma decisão de extração muda. Nenhum número muda. O relatório que hoje sai continua saindo
igual — esta espec só é visível quando alguma coisa dá errado.

---

## 4. Escopo

### 4.1 Dentro do escopo

- A guarda que impede `V-MED-02`, `V-MED-03` e `V-CTR-05` de descreverem a falha da `V-MED-01`.
- `V-MED-01` em quatro partes, com os três degraus de §2.3.
- `V-MED-02` como **um** achado, e não dois.
- `V-CTR-05` agregada em um cartão com a lista de códigos.
- `DiagnosticoDaAba` no agregado da medição, e o nome do arquivo em `Entradas`.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| **Ler mais que cinco colunas** | Seria corrigir em silêncio o que a `R-LEV-04` manda relatar. Aceitar código em qualquer coluna muda a leitura de todo levantamento, inclusive dos que funcionam, e é decisão de extração — não de mensagem. Ver `D-04` e `I-36` |
| Aviso no formulário pelo nome do arquivo | A `R-DOC-08` fez isso para o campo Contrato. O caso simétrico — enviar a proposta no campo Levantamento — é real, mas é outra entrega. `I-37` |
| Converter as outras oito validações ao cartão de quatro partes | `V-CTR-01`, `V-CTR-03`, `V-CTR-04`, `V-ADT-02` a `V-ADT-04`, `V-CAP-01`, `V-MED-03`. Nenhuma delas apareceu em tela real com problema de redação. Converter por simetria é trabalho sem defeito que o motive |
| A aba ausente | §2.4 |
| Mudar severidade de qualquer validação | `V-MED-01` bloqueia, `V-MED-02` e `V-CTR-05` avisam. As três decisões estão certas e não são reabertas |
| O `.docx`, o `.xlsx`, a reconciliação | Esta espec não os alcança |

---

## 5. Regras

| ID | Regra |
|---|---|
| `R-LEV-01` | Bloqueada a leitura da aba, **nenhuma outra validação da medição é registrada**. `V-MED-02`, `V-MED-03` e `V-CTR-05` descrevem a mesma falha por outros ângulos, e as três calam |
| `R-LEV-02` | A guarda vive no **orquestrador**, não dentro das validações: elas continuam chamáveis fora de ordem e com os testes de unidade que já têm (`R-GRD-06`, ESPEC 019 `D-06`) |
| `R-LEV-03` | `V-CTR-05` cala quando a **medição** não foi lida — não quando existe bloqueio em qualquer lugar. Um contrato bloqueado por checksum não invalida a observação de que a aba não traz um código contratado. Ver `D-03` |
| `R-LEV-04` | `V-MED-01` diz **em qual coluna** os códigos estão, quando estão fora das colunas lidas. É o degrau 2 de §2.3, e é a única informação nova que esta espec produz |
| `R-LEV-05` | A causa de `V-MED-01` é decidida por **função pura** sobre o diagnóstico, sem abrir planilha. É a `D-04` da ESPEC 025, e é o que torna os três degraus testáveis sem fixture |
| `R-LEV-06` | O diagnóstico é apurado **só quando a leitura falha**. No caminho feliz o custo é zero — a releitura não acontece |
| `R-LEV-07` | `V-MED-02` registra **um** achado, com o texto ajustado a qual dos dois campos faltou, ou aos dois |
| `R-LEV-08` | `V-CTR-05` continua registrando **um achado por código**, com o `codigo` preenchido — o grid depende dele. A agregação em um cartão é da **tela** |
| `R-LEV-09` | `Entradas` carrega o nome com que o levantamento foi submetido, **só para exibição**. O caminho em disco continua posicional (`R-ADT-10`) |
| `R-LEV-10` | Nenhuma mudança na leitura da aba: os mesmos itens, as mesmas quantidades, os mesmos blocos. Verificado pelas âncoras de artefato da ESPEC 026, que não podem se mexer |
| `R-LEV-11` | Nenhuma dependência nova |

---

## 6. Decisões

### `D-01` — A guarda antes da redação

Reescrever `V-MED-01` sem a guarda entregaria **um cartão bom e cinquenta e nove ruins**. A
guarda sozinha, sem reescrever nada, já leva a tela de 60 para 1 — e é três linhas.

Por isso ela sai primeiro e é publicável sozinha: o usuário passa de sessenta mensagens
confusas para uma mensagem confusa, o que já é ganho. É a ordem que a ESPEC 025 usou na F2.

### `D-02` — Diagnosticar com o que já foi aberto

O `DiagnosticoDaAba` espelha o `DiagnosticoDaGrade` da ESPEC 017: um registro do que a leitura
observou, que viaja no agregado e alimenta a mensagem.

A releitura acontece **dentro do leitor**, que já tem o livro aberto, e **só quando nenhum item
saiu**. Fazê-la na validação exigiria reabrir o arquivo — 0,1 s no modo somente-leitura, mas
sobretudo colocaria I/O dentro de uma validação, que hoje é função pura sobre agregados.

### `D-03` — `V-CTR-05` cala pela peça, não pela gravidade

O instinto seguinte à `R-LEV-01` é *"esconder todo aviso quando há bloqueio"*. Isso apagaria
informação legítima: o levantamento pode ter sido lido perfeitamente e o contrato ter sido
bloqueado por outro motivo, e a ausência de um código contratado continua sendo verdade útil.

É a `D-03` da ESPEC 025 dita de novo, porque é o erro que esta espec está mais perto de cometer.

### `D-04` — Não corrigir a leitura em silêncio

Descobrindo que os códigos estão na coluna H, a tentação é lê-los de lá. Seria trocar uma
mensagem clara por um comportamento que ninguém pediu e que muda a leitura de **todos** os
levantamentos, inclusive dos dois que funcionam.

A `R-LEV-04` manda **relatar**. Se depois se decidir que o leitor deve aceitar qualquer coluna,
que seja com espec própria, medindo o efeito nos dois pares reais — `I-36`.

### `D-05` — A agregação da `V-CTR-05` é da tela

Manter os *n* achados no modelo custa nada e preserva duas coisas: o `codigo` que o grid
consome, e as duas asserções de `test_reconciliation.py` que contam achados por código.

Agregar no `ResultadoPanel` é um agrupamento por `validacao`, e é onde o problema de fato
está — sessenta cartões é fato de **apresentação**.

### `D-06` — Um cabeçalho, um achado

`V-MED-02` registra dois achados para data e contrato de referência, que saem das mesmas dez
linhas e falham juntos. É a mesma doença da §1 em escala menor, e corrigi-la aqui custa uma
linha.

O texto se ajusta a qual faltou. **A severidade não muda**: os dois degradam o topo do
documento sem invalidar número nenhum, e é isso que `AVISA` significa.

---

## 7. O que muda no código

| Arquivo | Mudança |
|---|---|
| `infrastructure/di/container.py` | A guarda de `R-LEV-01`; `nome_do_levantamento` em `Entradas` |
| `domain/entities/measurement.py` | `DiagnosticoDaAba` — linhas preenchidas, colunas lidas, códigos por coluna |
| `infrastructure/measurement/levantamento_reader.py` | Preenche o diagnóstico **quando nenhum item sai** (`R-LEV-06`) |
| `infrastructure/validations/measurement_validations.py` | `V-MED-01` em quatro partes com os degraus; `V-MED-02` em um achado |
| `api/routers/reports.py` | Passa o nome do arquivo submetido |
| `frontend/src/app/components/ResultadoPanel.tsx` | Agrega `V-CTR-05` num cartão |

**Nada em `application/`, nada no renderizador, nada na leitura de itens.** A regra de
dependência não é tocada e `test_architecture.py` continua valendo.

Esboço da guarda, para fixar a forma:

```python
v_med_01_aba_reconhecida(medicao, achados)
# `R-LEV-01` — sem item lido, as três abaixo descrevem a **mesma** falha por
# outros ângulos: o cabeçalho sai das mesmas linhas, e `contrato.codigos - ∅`
# é o contrato inteiro. Sessenta cartões para uma causa (ESPEC 027 §2.1).
if medicao.itens:
    v_med_02_cabecalho_localizado(medicao, achados)
    v_med_03_desconto_por_posicao(medicao, achados)
    v_ctr_05_codigo_contratado_ausente_da_aba(contrato, medicao, achados)
```

`v_med_03` já é inócua com zero itens — o laço percorre `medicao.codigos`, que está vazio.
Entra sob a guarda porque a intenção fica legível, não porque precise.

---

## 8. Catálogo de mensagens

As quatro partes da `R-DOC-05`, no mesmo tom da ESPEC 025 §9.

### 8.1 `V-MED-01` — nenhum item lido

**Título**, fixo — nome do arquivo **entre parênteses, na mesma frase** (§14.1 emenda):

> Nenhum item foi lido da aba Levantamento ({nome-do-arquivo.xlsx}).

**Causa**, por degrau:

| degrau | texto |
|---|---|
| 1 | A aba `Levantamento` está vazia. |
| 2 | Os códigos de serviço desta planilha estão na coluna **{L}**. O Confere lê os códigos das colunas **A a E** da aba `Levantamento`. |
| 3 | Nenhuma das {N} linhas preenchidas da aba traz um código de serviço no formato `00.000.00000.00`. |

**Ação**, por degrau — porque o conserto é diferente em cada um:

| degrau | texto |
|---|---|
| 1 | Envie a planilha de levantamento da competência, com os itens medidos. |
| 2 | Envie a planilha no layout padrão do levantamento, com o código de serviço até a coluna E. |
| 3 | Confirme que este é o arquivo de levantamento — a aba existe, mas não traz itens de serviço. |

**Detalhe** — `V-MED-01` · aba `Levantamento` · {N} linhas preenchidas · colunas lidas A–E ·
códigos por coluna: {mapa}

**Renderizado, no degrau 2** (texto literal — sem `**`/`` ` `` no componente, que não
interpreta markdown; ver §14.1):

> Nenhum item foi lido da aba Levantamento (SMIT_SUSTENTACAO_Levantamento_05969_….xlsx).
>
> Os códigos de serviço desta planilha estão na coluna H. O Confere lê os códigos das
> colunas A a E da aba Levantamento.
>
> ➜ Envie a planilha no layout padrão do levantamento, com o código de serviço até a coluna E.
>
> ▸ *Detalhes técnicos (para o suporte)* — V-MED-01 · aba Levantamento · 312 linhas
> preenchidas · colunas lidas A–E · códigos por coluna: {8: 74}

### 8.2 `V-MED-02` — o cabeçalho da aba

Um achado, com o texto ajustado. **Aviso**, não bloqueio.

> **O cabeçalho da aba Levantamento não traz {a data | o contrato | a data nem o contrato}.**
>
> O relatório sai com {esse campo | esses dois campos} em branco no topo.
>
> ➜ Confira as dez primeiras linhas da aba: elas devem trazer `Data do Levantamento :` e
> `conforme contrato :`.

### 8.3 `V-CTR-05` — os códigos contratados que a aba não traz

O modelo continua com um achado por código (`R-LEV-08`); a tela empilha, em parágrafos
separados — este bloco já tinha essa forma, e a implementação a seguiu sem desvio (§14.1 é
sobre `V-MED-01`, não sobre este):

> **{N} códigos do contrato não aparecem no levantamento.**
>
> Eles não entrarão no relatório — a comprovação cobre o que a aba `Levantamento` traz.
>
> `10.050.00001.00` · `10.050.00002.00` · `10.050.00055.00` · `11.027.00001.00` ·
> `11.051.00012.00`
>
> ➜ Se algum destes deveria ter sido medido, confira a competência da planilha.

No singular — um código — o título vira *"O código {codigo} do contrato não aparece no
levantamento."* e a lista some.

### 8.4 O que sai da tela

* `V-MED-02` sobre aba não lida — consequência da mesma leitura (`R-LEV-01`).
* `V-CTR-05` sobre aba não lida — subtração de conjunto vazio (`R-LEV-01`).
* A segunda mensagem de `V-MED-02` quando os dois campos faltam (`R-LEV-07`).
* Os *n*−1 cartões de `V-CTR-05` quando ela dispara legitimamente (`D-05`).

---

## 9. Testes e portões

### 9.1 Aceite

| ID | Teste | Afirma |
|---|---|---|
| `T-2026` | Planilha com códigos na coluna H produz **exatamente um** achado, `V-MED-01`, e `achados.avisos == []` | `R-LEV-01` — é o teste que define a espec |
| `T-2027` | A causa de `V-MED-01` sobre `DiagnosticoDaAba` **construído à mão**, nos três degraus — inclusive o 1, que não tem fixture | `R-LEV-05` |
| `T-2028` | O degrau 2 nomeia a coluna: a causa contém `"coluna H"` | `R-LEV-04` |
| `T-2029` | `V-MED-02` com os dois campos faltando registra **um** achado | `R-LEV-07` |

### 9.2 Regressão

| ID | Teste | Afirma |
|---|---|---|
| `T-2030` | Os dois pares reais continuam **sem nenhum** `V-MED-*` e sem `V-CTR-05` | O caminho feliz não se move |
| `T-2031` | As âncoras de artefato da ESPEC 026 — `sha256` por entrada, `.docx` e `.xlsx`, nos dois pares — **inalteradas** | `R-LEV-10`. Se o documento mudar, esta espec errou |
| `T-2032` | `V-CTR-05` com a medição **lida** e um código removido continua registrando, com o `codigo` preenchido | `R-LEV-03`, `D-03`, `D-05` — o contrapeso da guarda |
| `T-2033` | Contrato bloqueado por checksum, medição lida: `V-CTR-05` **continua** registrando | `R-LEV-03` — cala pela peça, não pela gravidade |
| — | `test_planilha_sem_a_aba_levantamento_falha` sem uma linha alterada | §2.4 |
| — | `test_architecture.py`, `test_api_e2e.py`, as âncoras da ESPEC 026 | Nada disso muda |

### 9.3 A âncora que **muda de valor**, e é o canário

`test_reader_measurement.py::test_v_med_02_apenas_avisa` afirma hoje:

```python
assert len(achados.avisos) == 2
```

Com a `R-LEV-07` isso vira **1**. É a única asserção do repositório que esta espec obriga a
mexer, e está nomeada aqui para que a mudança seja **deliberada** — não uma correção
apressada para "fazer passar". Se qualquer outra asserção precisar mudar, algo saiu do escopo.

### 9.4 Portões

| ID | Portão | Fecha quando |
|---|---|---|
| `P0` | **A âncora do defeito** | Um teste reproduz a tela: planilha com códigos deslocados produz **60** achados no piloto. Verde contra o código intocado |
| `P1` | **Sessenta viram um** | `T-2026` passa. É o portão que sozinho justifica a entrega |
| `P2` | **O degrau nomeia a coluna** | `T-2028` |
| `P3` | **O caminho feliz não se moveu** | `T-2030` e `T-2031`; suíte inteira verde; `mypy --strict`, `ruff`, `bandit` |
| `P4` | **A pessoa** | Alguém do faturamento, sem explicação prévia, lê o cartão e diz o que fazer com a planilha. É humano, e é o que a ESPEC 025 `P6` deixou aberto pelo mesmo motivo |

`P0` antes de `P1`: sem ele, *"sessenta viram um"* é afirmação sem testemunha.

---

## 10. Riscos

| Risco | Mitigação |
|---|---|
| **A guarda esconder achado legítimo** — é o pior resultado possível desta espec | `T-2032` e `T-2033` são os negativos. A guarda é por **peça** (`R-LEV-03`), e a condição é `medicao.itens`, não `achados.bloqueado` |
| **O degrau 2 apontar a coluna errada** numa planilha com códigos espalhados | A causa nomeia a coluna **com mais códigos**, e o detalhe traz o mapa inteiro. `T-2027` cobre o empate |
| **Alguém "consertar" o leitor** para aceitar qualquer coluna | `D-04` diz por que não, e a `R-LEV-04` manda relatar. Está no escopo negativo, com `I-36` para reabrir |
| **A releitura custar no caminho feliz** | `R-LEV-06`: só acontece com zero itens. O caminho feliz nunca a paga, e `T-2030` roda os dois pares |
| **O texto do degrau 3 acusar levantamento legítimo** de não ser levantamento | Ele não afirma: pede confirmação. E só alcança planilha com aba `Levantamento`, com linhas preenchidas, e **nenhum** código em coluna nenhuma |
| **`V-MED-02` virar um e a mensagem perder informação** | O texto se ajusta aos três casos, e `T-2029` cobre os três |

---

## 11. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-36` | O leitor deve aceitar o código em qualquer coluna, em vez de A–E? Resolveria o degrau 2 sem mensagem nenhuma — e mudaria a leitura dos dois pares que funcionam | Não. `D-04`. Reabrir com espec própria e medição |
| `I-37` | Aviso no formulário quando o arquivo escolhido para Levantamento parece uma proposta — o simétrico da `R-DOC-08` | Não |
| `I-38` | As outras oito validações merecem o cartão de quatro partes, ou só quando aparecerem em tela com problema? | Não. §4.2 |
| `I-39` | Qual é o layout real da planilha que motivou esta espec? O degrau 2 é hipótese fundamentada no código, não observação de um arquivo | Não bloqueia, mas **confirma ou corrige §2.3**: se o arquivo real cair no degrau 3, a prioridade dos textos muda |

---

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | `P0` — a âncora dos 60 achados | PP |
| B | A guarda (`R-LEV-01`, `R-LEV-02`) e os negativos | P · **publicável sozinha** |
| C | `DiagnosticoDaAba` e a função pura da causa | P |
| D | `V-MED-01` em quatro partes; `nome_do_levantamento` | P |
| E | `V-MED-02` em um; agregação da `V-CTR-05` na tela | P |
| F | `P3` e `P4` | PP |

**Total: um dia.** O grosso é catálogo de mensagens e teste. O mecanismo — cartão, quatro
partes, guarda, diagnóstico — foi todo construído pelas ESPECs 017 e 025; esta entrega os
aplica onde ainda não chegaram.

---

## 13. Relação com as especs anteriores

### 13.1 ESPEC 025 — o mesmo defeito, o outro arquivo

A ESPEC 025 §1 abre com três mensagens para uma causa no campo Contrato, e diagnostica: *"as
três descrevem o mecanismo interno enquanto a causa real cabe numa linha"*. Troque *três* por
*sessenta* e *Contrato* por *Levantamento*, e é esta espec.

O que ela construiu e esta usa sem alterar: `ValidationFinding` com `titulo`/`causa`/`acao`/
`detalhe`, `registrar_em_partes`, o cartão empilhado do `ResultadoPanel`, o `▸ detalhes`
recolhido, e o padrão de guarda no orquestrador.

**O que esta acrescenta** é o degrau 2: a ESPEC 025 conseguia dizer *o que o arquivo não é*;
aqui dá para dizer **onde está o dado** — e isso é conserto, não diagnóstico.

### 13.2 ESPEC 017 `R-GRD-06` e `R-GRD-07` — a regra e o instrumento

`R-GRD-06` — *não acusar consequência de coisa já acusada* — é de 2026 e vale para o projeto
inteiro. `R-GRD-07` estabeleceu que o diagnóstico sai do que a leitura já olhou, sem passada
extra. `DiagnosticoDaAba` é `DiagnosticoDaGrade` do outro lado, e a `R-LEV-06` é a `R-GRD-07`.

### 13.3 ESPEC 026 — as âncoras que esta espec tem de respeitar

`T-2031` reusa as âncoras de `sha256` por entrada, dos dois pares. Elas foram medidas na ESPEC
026 contra o código intocado, e uma espec de mensagem **não pode movê-las**: se moverem, esta
entrega alcançou o documento, o que a §4.2 proíbe.

---

## 14. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-08-19 | Redação inicial. §2 com a cascata medida nos dois pares e o degrau 2 verificado em planilha sintética |
| 1.1 | 2026-08-19 | **Implementada.** `P0` a `P3` fechados. Backend: 1316 → 1330 verdes, reconciliado dígito a dígito. Navegador: 101/111, as 10 falhas pré-existentes (TASKS 027 §9.6). Uma emenda, em §14.1 |
| 1.1 | 2026-08-19 | **Implementada.** Portões `P0` a `P3` fechados; `P4` (a pessoa) é humano e fica para quem operar a tela. Uma emenda, em §14.1 |

### 14.1 O título tem o nome do arquivo entre parênteses, não em segunda linha

A redação original de §8.1 mostrava o título e o nome do arquivo em duas linhas —
`**Nenhum item foi lido da aba Levantamento.**` seguido de `` `{nome-do-arquivo}` `` — no mesmo
estilo visual da ESPEC 025 §9.4. **A implementação segue outro padrão, já estabelecido no
código**: `_identificar()`, em `contract_validations.py`, embute o nome do arquivo **entre
parênteses, na mesma frase**, para `V-DOC-01`.

O motivo é mecânico: `achado.titulo` é renderizado num único `<p>` sem `white-space:
pre-line` (`ResultadoPanel.tsx:53`), então um `\n` dentro da *string* não produz quebra de
linha visível — vira espaço em branco colapsado. As duas linhas de §8.1 eram formatação do
*markdown da própria espec*, não uma instrução sobre a estrutura do componente.

`_titulo_med01` segue `_identificar`: `"Nenhum item foi lido da aba Levantamento
({nome_do_arquivo})."`. Os textos de causa, ação e detalhe também perderam o `**negrito**` e
os `` `crases` `` que a espec continha — o componente não interpreta markdown, e o texto que
chega à tela é literal, como já era em `V-DOC-01`. §8.1 e §8.3 foram corrigidos para refletir
isso.
