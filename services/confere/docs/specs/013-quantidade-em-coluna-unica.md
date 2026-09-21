# ESPEC 013 — A quantidade volta a ocupar uma coluna

| | |
|---|---|
| **Status** | **Implementada** — 2026-08-11. Portões P1 e P3 fechados; **P2 pendente do insumo `K-08`** |
| **Versão** | 1.2 — 2026-08-11 — implementada, com quatro emendas em §13 |
| **Depende de** | [ESPEC 009](009-analise-da-medicao.md) — implementada |
| **Revisa** | `R-XLS-05` da ESPEC 009 — o **meio**, não a intenção. Ver §6 `D-04` |
| **Artefato de referência** | `backend/tests/fixtures/analise_referencia.xlsx` — o mesmo gabarito da ESPEC 009 |
| **Origem** | Pergunta de quem usa a planilha: *"por que o XLSX tem colunas duplicadas?"* |

---

## 1. Problema

No `Relatorio_Analise_Medição.xlsx`, cada quantidade ocupa **duas** colunas:

```
│ Contratado │ Medido │ Saldo │ Contratado (nº) │ Medido (nº) │ Saldo (nº) │
│          4 │      8 │    -4 │            4,00 │        8,00 │      -4,00 │
```

São seis colunas para três grandezas. As três primeiras são **texto** — daí o triângulo verde
com que o Excel avisa *"número armazenado como texto"* — e as três últimas são o número de
verdade, que permite somar.

`R-XLS-05` criou esse arranjo por um motivo correto: *"uma coluna de texto que parece número é
o defeito clássico de relatório em planilha"*. O que ela não considerou é que **o Excel sabe
guardar um número e exibi-lo com outra grafia** — e é para isso que serve o formato de célula.

O sintoma que trouxe a pergunta é o mais barato de todos: a planilha parece ter erro de
montagem. Quem recebe não sabe qual das duas colunas é a boa.

---

## 2. O que foi medido

### 2.1 O gabarito tem **uma** coluna, e ela é numérica

O artefato que a ESPEC 009 adotou como alvo de fidelidade traz, nas quatro abas de detalhe:

```
cabeçalho: ('Código', 's') ('Descrição', 's') ('Contratado', 's') ('Medido', 's') ('Saldo', 's')
dados:     ('11.051.00012.00', 's') ('CONSULTORIA…', 's') (100, 'n') (0, 'n') (100, 'n')
```

`'n'` é o tipo numérico do `openpyxl`. **A duplicação é acréscimo nosso**, não do gabarito.
Voltar a uma coluna por conceito aproxima do artefato de referência em vez de afastar — e é o
oposto do que a intuição sugeria antes de olhar.

### 2.2 As duas colunas **não** carregam o mesmo número

É o fato que impede resolver isto apagando a coluna errada:

| Item | Coluna de texto | Coluna numérica |
|---|---|---|
| `14.070.00001.00` | `117,29` | `117,2889788312131` |

O texto é a grafia do relatório, arredondada para duas casas; o número é o `Decimal` cheio que
veio da planilha de medição. Há teste dedicado a essa distinção
(`test_t518_o_valor_numerico_nao_perde_precisao`): *"o texto arredonda para exibir; o número
não pode"*.

**Ficar só com o texto perderia precisão e a capacidade de somar** — seria voltar exatamente ao
defeito que `R-XLS-05` foi escrita para evitar. A coluna que fica é a numérica.

### 2.3 O formato do Excel reproduz a grafia do relatório — com **um** código por caso

A `Quantity.formatar()` tem uma regra que, à primeira vista, nenhum formato do Excel
reproduziria: quando a parte decimal é `00`, ela **desaparece** (`4`); quando não é, saem
**duas** casas (`117,29`). Formatos do Excel condicionam por faixa de valor, não por "é
inteiro".

> **A primeira versão desta espec errou aqui, e o erro chegou à planilha aberta.** Ela
> concluiu que `#,##0.##` resolvia os dois casos com um código só. Ver §2.5 e `R-NUM-08`.

A condição *"tem casa decimal ou não"* é decidida **por célula, no renderizador**, onde o
valor está — e não delegada a um truque do código de formato. São quatro códigos:

| Valor | `formatar()` | Código | Excel exibe | |
|---|---|---|---|---|
| `4000` (MILHAR) | `4.000` | `#,##0` | `4.000` | ✅ |
| `1500` (SIMPLES) | `1500` | `0` | `1500` | ✅ |
| `3265.64` (MILHAR) | `3.265,64` | `#,##0.00` | `3.265,64` | ✅ |
| `117.2889788312131` | `117,29` | `#,##0.00` | `117,29` | ✅ |
| `4.50` | `4,50` | `#,##0.00` | `4,50` | ✅ |
| `0` | `0` | `#,##0` | `0` | ✅ |

A paridade com o `.docx` é **exata**, e não só sobre os dados reais: não sobra caso teórico.
As 56 linhas do piloto e os casos construídos conferem os dois lados.

### 2.4 O teste-âncora já localiza a quantidade por tipo, não por posição

O comparador da ESPEC 009 faz:

```python
numericas = [c for c in linha if isinstance(c, int | float | Decimal)]
```

com o comentário: *"as colunas numéricas não estão na mesma posição nas cinco abas […]
localizar por tipo é o que sobrevive a isso"*. Ou seja, **a duplicação já era um estorvo para o
próprio teste**, contornado em vez de removido. Esta espec remove a causa, e o comparador
continua valendo sem alteração.

### 2.5 O que só o Excel mostrou — e por que nenhum teste viu

`#,##0.##` foi escolhido porque `#` "omite o dígito ausente". Omite mesmo — **o dígito**. O
separador decimal é literal e permanece:

```
valor 10, formato 0.##      → o Excel exibe   10,
valor 4000, formato #,##0.## → o Excel exibe  4.000,
```

A vírgula pendurada apareceu em **52 das 56 linhas** — exatamente a maioria que a escolha de
`.##` pretendia servir. O caso decimal, minoria, saía certo.

**A suíte estava verde, e o instrumento é a explicação.** O comparador de grafia
(`tests/grafia.py`) deriva do par (valor, código) o texto que o Excel mostraria, e a sua
implementação de `.##` fazia `decimal.rstrip("0")` e, quando sobrava vazio, **devolvia o
inteiro sem vírgula** — a mesma suposição do renderizador, escrita duas vezes. Um instrumento
que erra junto com o código não mede o código: confirma-o.

É a razão de `R-NUM-08` trazer, junto com a correção, uma asserção **estrutural** — nenhum
formato do arquivo contém `.#` — que não depende de o comparador estar certo.

---

## 3. Objetivo

Cada quantidade ocupa **uma** coluna, de tipo numérico, com o valor cheio, exibida na mesma
grafia do relatório por formato de célula.

A planilha soma como planilha e se lê como o documento — que é o que `R-XLS-05` queria, por um
meio que ela não considerou.

---

## 4. Escopo

### 4.1 Dentro do escopo

- Colapsar as duas colunas de cada quantidade em uma, numérica.
- Formato de exibição por item, derivado do `NumberFormat` que o domínio já produz.
- Cabeçalhos de volta a `Contratado`, `Medido`, `Saldo` — como o gabarito.
- Reescrita dos testes que afirmavam a coluna de texto.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Alterar o `.docx` | É o entregável formal e o teste-âncora da ESPEC 001 o guarda. Nada aqui o toca |
| Alterar a tela | O painel da ESPEC 009 mostra quantidade já formatada pelo backend (`D-04` de lá) e não tem coluna duplicada. Nada muda |
| Mudar a regra de formatação do domínio | `Quantity.formatar()` e `NumberFormat` continuam como estão. Esta espec **lê** a regra, não a reescreve |
| A aba `Resumo Executivo` | Traz contagens de itens, não quantidades. Não tem coluna duplicada e não é tocada |
| Somar quantidades entre unidades diferentes | ESPEC 009 §4.2 recusou, e continua recusado: somar `HORA/HOMEM` com `GB` produz número sem significado. Que a coluna **possa** ser somada não obriga ninguém a somá-la inteira |

---

## 5. Regras

| ID | Regra |
|---|---|
| `R-NUM-01` | Cada quantidade — contratada, medida e saldo — ocupa **uma** coluna, de tipo numérico (`cell.data_type == "n"`) |
| `R-NUM-02` | O valor gravado é o `Decimal` cheio, **sem passar por `float`**. É a exigência que já valia para a coluna numérica e que continua valendo: isto instrui faturamento |
| `R-NUM-03` | A exibição vem de **formato de célula**, escolhido por célula a partir de duas condições que já existem fora do renderizador: o `NumberFormat` do item (`MILHAR` usa separador de milhar, `SIMPLES` não) e o valor arredondado ser ou não redondo — a mesma condição de `Quantity.formatar()`. São quatro códigos: `#,##0`, `#,##0.00`, `0` e `0.00` |
| `R-NUM-04` | Os cabeçalhos são `Contratado`, `Medido` e `Saldo` — sem o sufixo `(nº)`, que existia só para desambiguar do par de texto |
| `R-NUM-05` | A aba `Sem Divergência` continua **sem** a coluna de saldo (`R-ANA-11`): ele é zero por definição da situação |
| ~~`R-NUM-06`~~ | **Revogada por `R-NUM-08`.** Declarava divergência em `4,50`, que exibiria `4,5` porque `#` omite o zero à direita. Sem `#` depois do ponto não há o que omitir: o valor decimal recebe `.00` e grafa `4,50`, igual ao `.docx`. O teste construído continua, com o veredito invertido |
| `R-NUM-07` | O código do formato é escrito na convenção do OOXML (`.` decimal, `,` milhar) e o Excel o exibe com os separadores do idioma do usuário. Escrever `#.##0,00` produziria arquivo inválido |
| `R-NUM-08` | **Nenhum código de formato contém `#` depois do ponto decimal.** O `#` omite o *dígito* ausente, **não o separador**: sob `0.##` o valor `10` exibe `10,` (§2.5). A condição "tem casa decimal" é resolvida no renderizador, por célula. A asserção que guarda isto é **estrutural** — nenhum formato do arquivo contém `.#` —, e não depende do comparador de grafia estar certo |

---

## 6. Decisões

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **A coluna que fica é a numérica** | §2.2 — ela carrega mais informação (precisão cheia) e é a única que permite somar. Planilha que não soma não é planilha; é PDF com bordas |
| `D-02` | O formato sai do `NumberFormat` **do domínio**, não de uma regra nova no renderizador | É a mesma razão de `D-04` da ESPEC 009: a escolha entre `MILHAR` e `SIMPLES` é atributo do item (`R-MED-04`), e duplicá-la criaria duas fontes de verdade para a mesma decisão |
| `D-03` | ~~`#,##0.##` e não `#,##0.00`~~ → **quatro códigos, escolhidos por célula** | O diagnóstico continua certo: com `.00` fixo todo inteiro sairia `4,00` contra o `4` do relatório, em **52 das 56 linhas**. Errada era a saída — `.##` não omite a casa decimal, só o dígito, e trocou `4,00` por `10,` na mesma maioria de linhas (§2.5). Um código de formato não sabe responder *"é redondo?"*; o renderizador sabe, porque tem o valor. Decidir lá custa quatro constantes e um `if`, e elimina o caso teórico junto |
| `D-04` | **`R-XLS-05` é revisada, não revogada** | A intenção dela — *"o arquivo tem de poder ser somado"* — é o que esta espec preserva; o que muda é o meio. Ela concluiu "então duas colunas" porque tratou texto e número como mutuamente exclusivos numa célula, e no Excel não são |
| `D-05` | Nenhuma coluna nova para "o texto do relatório" | Quem precisa da grafia exata tem o `.docx`, que é o documento formal. Reproduzi-la numa segunda coluna é o que criou o problema |

---

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `infrastructure/report/xlsx_analise_renderer.py` | `COLUNAS_TEXTO` e `COLUNAS_NUMERO` colapsam em uma lista; a célula recebe o `Decimal` e um `number_format` derivado do `NumberFormat` do item |
| `tests/test_xlsx_analise.py` | Três testes reescritos — §8 |

**Nada muda em `domain/`, `application/` ou `api/`.** A resposta da API não é tocada: ela já
devolve a análise em JSON, com as quantidades formatadas (`D-04` da ESPEC 009), e o XLSX viaja
em base64 sem que a estrutura de colunas apareça no contrato.

`tests/test_architecture.py` continua valendo sem alteração.

---

## 8. Testes

| Teste | O que acontece |
|---|---|
| `test_t521_ancora_cada_aba_confere_com_o_gabarito` | **Passa sem alteração.** Localiza a quantidade por tipo (§2.4), e passa a encontrar exatamente duas células numéricas por linha em vez de duas entre seis |
| `test_t518_a_coluna_numerica_e_numero_de_verdade` | **Passa sem alteração**, e fica mais forte: agora **todas** as células de quantidade são numéricas, não metade |
| `test_t518_o_valor_numerico_nao_perde_precisao` | **Passa sem alteração** — `117,2889788312131` continua na célula |
| `test_t521_o_texto_da_quantidade_e_o_do_relatorio` | **Reescrito.** Deixa de comparar o texto da célula e passa a comparar **valor + formato**: a célula de `14.024.00006.00` tem `Decimal("4000")` e formato com separador de milhar; a de `14.023.00002.00` tem formato sem |
| **Novo** — `R-NUM-03` | Um item de cada formato, com o código de formato conferido na célula. É o que impede a regra de virar "todo mundo com milhar" sem ninguém notar |
| **Novo** — ~~`R-NUM-06`~~ → `R-NUM-08` | O caso construído com `4,50` continua, com o veredito **invertido**: a planilha exibe `4,50`, igual ao relatório. Some a divergência declarada |
| **Novo** — `R-NUM-08`, estrutural | Nenhum formato do arquivo contém `.#`. É a asserção que não depende do comparador — ver §2.5 |
| **Novo** — `R-NUM-08`, paridade | Sete valores, nas duas famílias de formato, conferidos contra `Quantity.formatar()`: `10`, `1500`, `4000`, `0`, `-4`, `117,2889…` e `4,50` |
| `test_t519_*`, `test_t554_*`, `test_t522_*` | Inalterados — marcas, aba vazia e determinismo não dependem do arranjo de colunas |

O aceite é o de sempre neste projeto: **o teste-âncora contra o gabarito continua passando**, e
agora com uma coincidência a mais — o nosso arquivo passa a ter o mesmo número de colunas que
ele.

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| **O formato exibir diferente do `.docx`** | Era `R-NUM-06`, e deixou de existir com `R-NUM-08`: os quatro códigos cobrem os dois casos sem omissão. O risco que **sobra** é o de §2.5 — um código novo que dependa de truque de formatação —, e é a asserção estrutural que o guarda |
| **O separador de milhar sair errado** por diferença de idioma do Excel | `R-NUM-07` — o código do formato é escrito na convenção do OOXML e traduzido pelo Excel. Escrever na convenção brasileira produziria arquivo inválido, e é o erro fácil de cometer aqui |
| **Alguém somar a coluna inteira**, misturando `HORA/HOMEM` com `GB` | Já era possível na coluna `(nº)`. §4.2 mantém a recusa de **agregar por nós**; o que a planilha permite ao usuário é escolha dele, e é o que se espera de uma planilha |
| **Perder a conferência linha a linha contra o `.docx`** | Ela não era feita por humano: quem a faz é o teste-âncora, automaticamente, e ele compara valores — não texto (§2.4) |
| **O gabarito deixar de bater** | Ele já tem uma coluna por conceito (§2.1). O risco é o inverso: hoje é que divergimos dele |

---

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| ~~`I-10`~~ | ~~Existe quantidade com uma casa decimal significativa seguida de zero (`4,50`)?~~ | **Fechado, e sem precisar de resposta.** A pergunta só importava para decidir o destino de `R-NUM-06`; com `R-NUM-08` o caso grafa igual ao relatório, exista ou não |
| `I-11` | Quem recebe a planilha usa a coluna para somar, ou só para ler? | Não. Se ninguém soma, a discussão inteira perde peso — e a resposta muda a prioridade de um eventual terceiro formato |

---

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Colapsar as colunas e aplicar o formato por item | P |
| B | Reescrever `test_t521_o_texto_da_quantidade_e_o_do_relatorio` para valor + formato | P |
| C | Dois testes novos — formato por item e o caso construído de `R-NUM-06` | P |
| D | Abrir no Excel e conferir grafia e soma | PP |

**Total: meio dia.** O que torna barato é que o dado já está certo: a coluna numérica de hoje
já guarda o `Decimal` cheio e já é do tipo certo. Esta espec **apaga** a coluna redundante e
transfere a grafia para onde ela pertence — o formato da célula.

A fase D não é opcional. É a mesma razão da ESPEC 003: `openpyxl` relê perfeitamente o que ele
mesmo escreveu, e formato de célula é precisamente o que só o Excel mostra.

---

## 13. Emendas da implementação — 2026-08-11

### 13.1 A §8 errou a conta: são **três** testes, não um

A §8 afirmou que os dois `test_t518_*` *"passam sem alteração"* e que só o
`test_t521_o_texto_da_quantidade_e_o_do_relatorio` seria reescrito. **Os três quebraram**,
e os três pelo mesmo motivo: fatiamento por posição — `cabecalho[5:8]`, `linha[5:8]`,
`usn[3]`, `usn[6]`.

O engano tem origem clara: a espec raciocinou sobre **o que cada teste garante** — e nisso
estava certa, as três garantias sobreviveram — e não sobre **como cada teste está escrito**.
Garantia e implementação do teste são coisas diferentes, e só a segunda quebra.

Os oito que sobreviveram foram escritos por **característica** — tipo do dado, última coluna,
conteúdo. É a diferença entre teste que acompanha refatoração e teste que a impede.

### 13.2 O comparador mede **células**, e são 141 — não 52

A §2.3 apurou 52 linhas inteiras e o PLANO 013 transformou esse número no critério do portão
`P1`. Na execução o comparador acusou **141**.

Os dois números estão certos e contam coisas diferentes: **52 é a contagem de itens** cujas
duas quantidades são inteiras; **141 é a contagem de células** divergentes — cada item tem
três (contratada, medida, saldo) ou duas, na aba `Sem Divergência`, que não traz saldo.

Todas as 141 são da mesma espécie: inteiro grafado `4,00` onde o relatório grafa `4`. Depois
da mudança, **zero**.

O portão cumpriu o papel apesar do número errado, porque o que ele exige é *reprovar por
motivo verificável* — e a espécie única das divergências é que sustentou o diagnóstico.

### 13.3 As larguras eram um problema anterior a esta espec

A §7 listou o renderizador como único arquivo a mudar, e está certa — mas dentro dele há
`LARGURAS`, que a espec não mencionou. Ela era mapa por **letra de coluna**, aplicado igual às
quatro abas de detalhe, que têm contagens diferentes.

O defeito **já existia**: escrita para a aba de nove colunas, ela dava largura 24 à marca em
`Itens Críticos` e **13** em `Sem Divergência`, onde o valor é `Sim — perfil ou pacote`.

Passou a ser mapa por **nome de coluna**, aplicado ao índice em que o nome caiu. A marca recebe
26 nas duas abas, e acrescentar ou remover coluna deixou de exigir tocar no mapa. É a mesma
lição da §13.1, noutra camada: **localizar por característica, nunca por índice.**

### 13.4 A vírgula pendurada: a fase D era o teste, e ela achou o defeito

A §11 declarou que **abrir no Excel não era opcional**, *"porque `openpyxl` relê perfeitamente
o que ele mesmo escreveu, e formato de célula é precisamente o que só o Excel mostra"*. A frase
estava certa e a espec mesmo assim confiou num truque de formatação: `#,##0.##`, com o
raciocínio de que `#` faria a casa decimal sumir quando não houvesse dígito.

Faz sumir o dígito. **A vírgula é literal e fica.** Toda quantidade redonda saiu `10,` em vez
de `10` — em 52 das 56 linhas, a mesma maioria que a escolha pretendia servir (§2.5).

Duas lições, e a segunda é a que vale:

1. **Um código de formato não sabe responder *"é redondo?"*.** Quem sabe é quem tem o valor.
   Mover a condição para o renderizador custou quatro constantes e um `if`, e de quebra
   revogou `R-NUM-06` e fechou `I-10`.
2. **O comparador errou junto com o código.** `tests/grafia.py` foi escrito para ser o
   instrumento que percebe o que os testes de valor não percebem — e implementou `.##`
   com a mesma suposição do renderizador. Instrumento que repete a hipótese do objeto medido
   não mede: confirma. A correção veio com uma asserção **estrutural** — nenhum formato
   contém `.#` — que vale mesmo se o comparador estiver errado de novo.

A §13.1 já tinha registrado que garantia e implementação de um teste são coisas diferentes.
Esta é a versão mais cara da mesma lição: **também o instrumento de medida precisa de um
teste que não dependa dele.**

---

## 12. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-08-11 | Redação inicial, com o gabarito e as 56 linhas do piloto medidos em §2 |
| 1.1 | 2026-08-11 | Implementada. Três emendas em §13 |
| 1.2 | 2026-08-11 | **`R-NUM-08`** — a vírgula pendurada, vista na planilha aberta. `#,##0.##` e `0.##` dão lugar a quatro códigos escolhidos por célula; `R-NUM-06` revogada, `I-10` fechado, `D-03` e §2.3 corrigidas, §2.5 e §13.4 acrescentadas |
