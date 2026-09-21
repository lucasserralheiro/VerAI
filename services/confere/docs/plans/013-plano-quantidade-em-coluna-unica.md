# PLANO 013 — Implementação da Quantidade em Coluna Única

| | |
|---|---|
| **Especificação** | [ESPEC 013](../specs/013-quantidade-em-coluna-unica.md) v1.0 |
| **Versão** | 1.0 — 2026-08-11 |
| **Estado inicial** | 368 testes de backend verdes · 42 de navegador verdes · `Relatorio_Analise_Medição.xlsx` com **seis** colunas de quantidade (três de texto, três numéricas com formato fixo `#,##0.00`) · teste-âncora da análise passando com as duas divergências declaradas |

---

## 1. O princípio que ordena este plano

A mudança de fonte é pequena: colapsar duas listas de colunas em uma e trocar um formato fixo
por um formato escolhido por item. Vinte linhas num arquivo.

O que ordena o plano é o que está em volta. **Três testes quebram, e os três foram escritos
exatamente para guardar o desenho que está sendo removido.** Cada um deles protege uma intenção
que continua valendo:

| Teste | Guarda a intenção de que… | Continua valendo? |
|---|---|---|
| `test_t518_a_coluna_numerica_e_numero_de_verdade` | a quantidade é número de verdade, não texto que parece número | **Sim, e mais forte** — agora vale para *todas* as células de quantidade, não metade |
| `test_t518_o_valor_numerico_nao_perde_precisao` | `117,2889788312131` chega inteiro à célula | **Sim, idêntica** |
| `test_t521_o_texto_da_quantidade_e_o_do_relatorio` | o arquivo exibe a mesma grafia do `.docx` | **Sim** — muda o portador, de célula de texto para formato de célula |

Daí o princípio, que é o mesmo da T-542 do PLANO 009 noutra camada:

> **O teste que guardava o desenho antigo guarda uma intenção que continua valendo.**
> Apagá-lo perde a garantia; mantê-lo como está trava a entrega numa posição de coluna.

Cada reescrita deste plano tem de sair **mais forte** que a versão que substitui. Se alguma
sair mais fraca, a entrega trocou uma garantia por conveniência — e é isso que a §5 vigia.

E há uma segunda razão para o plano existir: **a única coisa que pode sair errada sem que nada
acuse é a largura das colunas** (§5.4).

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P1 — A grafia não mudou** | Fim da F1 | Para os **56 itens**, o par (valor, código de formato) da célula reproduz o que `Quantity.formatar()` produz. Hoje o comparador acusa **52 divergências** — os inteiros, que `#,##0.00` grafa como `4,00` | O formato escolhido está errado. Corrigir antes de tocar em teste nenhum |
| **P2 — O arquivo abre e soma** | Fim da F3 | Cinco abas sem aviso de reparo; a coluna de quantidade **soma** com `=SOMA()`; a grafia na tela do Excel é a do `.docx` | Não entregar. Formato de célula é precisamente o que só o Excel mostra |
| **P3 — O conjunto não regrediu** | Fim da F3 | Teste-âncora da análise intacto com as **duas** divergências declaradas; 5 abas; marcas nos seus lugares; determinismo; 368+ testes verdes | Não entregar |

**P1 é o portão barato que protege os caros**, e é barato por um motivo específico: o
comparador que o fecha **é escrito antes da mudança e tem de reprovar** contra o código atual.
Um instrumento que já nasce verde não prova nada — é a lição da T-704 do PLANO 012, e o número
`52` é o que a torna verificável aqui.

---

## 3. Fases

### F0 — O comparador de grafia `[portão]`

**Objetivo:** poder afirmar que a grafia não mudou, antes de mudá-la. **Nenhum arquivo de
`src/` é tocado nesta fase.**

| # | Tarefa | Ref. |
|---|---|---|
| T-800 | Função de teste que, dado um `Decimal` e um código de formato do Excel, devolve **o texto que o Excel exibiria** — para os dois códigos desta espec e só para eles | `R-NUM-03` |
| T-801 | Comparador: percorre as quatro abas de detalhe e confronta a grafia derivada da célula com `origem.formatar()`, devolvendo a **lista nomeada de divergências** — código do item, esperado, obtido | **P1** |
| T-802 | **Rodar contra o arquivo atual e exigir que reprove**, com **52 divergências**, todas inteiros grafados `4,00` onde o relatório grafa `4` | **P1** |

**Verificação:** a T-802 reprova, e reprova pelo motivo certo. Se acusar número diferente de 52,
o comparador não está lendo o que diz ler — e é melhor descobrir agora que depois.

> **A T-800 é o único lugar deste backlog onde semântica do Excel é reimplementada**, e por isso
> vale só para os dois códigos que a espec usa. Um interpretador geral de formato do Excel seria
> maior que a mudança inteira, e teria bugs próprios que passariam por bugs do renderizador.

**Tamanho:** M — meio dia. **Encerra:** P1 (na F1).

---

### F1 — O renderizador `[portão]`

**Objetivo:** uma coluna por quantidade, numérica, com formato por item.

| # | Tarefa | Ref. |
|---|---|---|
| T-803 | `COLUNAS_TEXTO` e `COLUNAS_NUMERO` viram uma lista só: `Código`, `Descrição`, `Contratado`, `Medido`, `Saldo` — os nomes do gabarito | `R-NUM-04` |
| T-804 | A célula recebe o `Decimal` (nunca `float`) e o `number_format` derivado do `NumberFormat` do item | `R-NUM-01`, `02`, `03` |
| T-805 | **[risco]** Os dois códigos de formato escritos na convenção do **OOXML** — `.` decimal, `,` milhar. `MILHAR` com separador, `SIMPLES` sem | `R-NUM-07` |
| T-806 | `FORMATO_NUMERICO` fixo é removido. Se sobrar como constante morta, alguém a reusará | `R-NUM-03` |
| T-807 | A aba `Sem Divergência` continua sem `Saldo`, e a coluna de marca continua sendo a última | `R-NUM-05` |
| T-808 | **O comparador da F0 passa: zero divergências nos 56 itens** | **P1** |

**Verificação:** T-808 fecha P1. Os testes existentes ainda **não** foram tocados — três estarão
vermelhos, e é esperado (§5).

> **T-805 é o erro fácil desta entrega.** A grafia brasileira `#.##0,##` parece a certa e
> produz arquivo inválido: o OOXML fixa `.` e `,` nos papéis do inglês, e é o Excel que
> substitui pelos separadores do idioma ao exibir. Escrever "como se lê" é o engano natural.

**Tamanho:** P — três horas. **Encerra:** P1.

---

### F2 — Os três testes, reescritos mais fortes

**Objetivo:** cada garantia sobrevive à mudança de mecanismo.

| # | Tarefa | Ref. |
|---|---|---|
| T-809 | `test_t518_a_coluna_numerica_e_numero_de_verdade`: sai o fatiamento `cabecalho[5:8]` / `linha[5:8]`; entra a varredura de **todas** as células de quantidade, localizadas por cabeçalho. Mais forte: hoje cobre metade delas | §5.1 |
| T-810 | `test_t518_o_valor_numerico_nao_perde_precisao`: sai `usn[3]` (texto) e `usn[6]` (número); entra a célula única, com `Decimal("117.2889788312131")` **e** o código de formato que a exibe como `117,29` | §5.2 |
| T-811 | `test_t521_o_texto_da_quantidade_e_o_do_relatorio` vira **teste de grafia**: usa o comparador da T-801 sobre os dois itens que já nomeia — `14.024.00006.00` (MILHAR, `4.000`) e `14.023.00002.00` (SIMPLES, `1500`) | `R-NUM-03` |
| T-812 | Teste novo de `R-NUM-06`: caso **construído** com `4,50` — a célula guarda `Decimal("4.50")` e o formato exibiria `4,5`. Divergência declarada vira teste, não comentário | `R-NUM-06` |
| T-813 | Teste novo: os **dois** códigos de formato aparecem no arquivo, um por espécie de item. Impede a regra virar "todo mundo com milhar" sem ninguém notar | `R-NUM-03` |

**Verificação:** os cinco passam; os demais de `test_xlsx_analise.py` seguem verdes sem ter sido
abertos.

> **A T-811 é a que mais pode enfraquecer sem parecer.** É tentador trocá-la por "a célula é
> numérica", que passa sempre e não guarda nada. A pergunta que ela responde continua sendo *a
> planilha exibe o mesmo que o documento formal?* — e a resposta agora mora no formato.

**Tamanho:** M — meio dia.

---

### F3 — A largura, o Excel e o conjunto `[portão]`

**Objetivo:** o arquivo utilizável, e a prova de que nada regrediu.

| # | Tarefa | Ref. |
|---|---|---|
| T-814 | **[risco]** Remapear `LARGURAS`. Ela é indexada por **letra** — com três colunas a menos, toda largura passa a valer para outra coluna. Ver §5.4 | §5.4 |
| T-815 | A largura da coluna de marca acomoda `Sim — perfil ou pacote` nas duas abas que a têm, e elas ficam em letras diferentes | `R-XLS-03`, `R-XLS-04` |
| T-816 | **Abrir no Excel**: cinco abas sem aviso de reparo, `=SOMA()` devolvendo número, e a grafia conferida contra o `.docx` linha a linha em ao menos um item de cada formato | **P2**, insumo `K-08` |
| T-817 | Teste-âncora da análise intacto, com as **duas** divergências declaradas; determinismo; marcas; aba vazia | **P3** |
| T-818 | Suíte completa verde. `ruff`, `mypy` e `bandit` limpos | **P3** |

**Verificação:** P2 e P3.

> **A T-814 é a única tarefa deste plano que nada automático cobra.** Largura de coluna não
> quebra teste, não muda valor e não aparece em diff de conteúdo — aparece quando alguém abre o
> arquivo e vê `########` no lugar de um número, ou uma marca cortada pela metade. É o mesmo
> gênero da lição da ESPEC 003: a suíte garante conteúdo, não aparência.

**Tamanho:** P — três horas. **Encerra:** P2 e P3.

---

### F4 — Documentação

| # | Tarefa |
|---|---|
| T-819 | **ESPEC 009:** emenda registrando que `R-XLS-05` foi revisada — a intenção permanece, o meio muda. É a espec onde a regra mora |
| T-820 | **ESPEC 013:** status → implementada; §8 corrigida com os **três** testes que de fato quebraram (§6.1) |
| T-821 | README e CHANGELOG: a planilha passa a ter uma coluna por quantidade |
| T-822 | TASKS 013 com resultado e desvios |

**Tamanho:** P — duas horas.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3 ──► F4
  (comparador)  P1        P2 P3
```

Linear, e sem paralelização útil: a F1 depende do instrumento da F0, a F2 só faz sentido com o
renderizador pronto, e a F3 precisa das duas.

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | 1,5 a 2 dias |

---

## 5. A regressão que já está escrita

Lida no repositório, não presumida.

### 5.1 `test_t518_a_coluna_numerica_e_numero_de_verdade` — quebra por posição

```python
assert cabecalho[5:8] == ["Contratado (nº)", "Medido (nº)", "Saldo (nº)"]
for celula in linha[5:8]:
    assert celula.data_type == "n"
```

Fatiamento absoluto, e os cabeçalhos com `(nº)` deixam de existir. **Quebra nas duas
asserções.**

A reescrita é uma oportunidade, não um custo: hoje o teste cobre **três das seis** colunas de
quantidade; depois cobre **todas as três** que existirem.

### 5.2 `test_t518_o_valor_numerico_nao_perde_precisao` — quebra por posição

```python
assert usn[3] == "117,29"                                    # coluna de texto
assert Decimal(str(usn[6])) == Decimal("117.2889788312131")  # coluna numérica
```

As duas asserções apontam para colunas que mudam de posição — e a primeira aponta para uma
coluna que deixa de existir. A garantia que ela representa é a mais importante do arquivo, e
por isso a T-810 a reconstrói inteira: valor cheio na célula **e** formato que o exibe
arredondado.

### 5.3 `test_t521_o_texto_da_quantidade_e_o_do_relatorio` — quebra por desenho

É o teste que afirma `R-XLS-05` diretamente. Ele **tem** de mudar: é a regra que está sendo
revisada. Vira teste de grafia (T-811), preservando os dois itens que já nomeia, que cobrem os
dois formatos.

### 5.4 O que **nada** pega: as larguras

```python
LARGURAS = {"A": 18, "B": 62, "C": 13, "D": 11, "E": 11, "F": 15, "G": 13, "H": 13, "I": 24}
```

Indexado por **letra**, aplicado igual às cinco abas. Com três colunas a menos, tudo se
desloca:

| Coluna | Hoje, abas com saldo | Depois | Consequência |
|---|---|---|---|
| `C`–`E` | os três textos | as três **quantidades** | larguras 13/11/11 para números — provavelmente ainda serve |
| `F`–`H` | os três números | — | larguras órfãs |
| `I` (24) | **a marca** | — | a marca cai em `F`, largura **15** |

Na aba `Sem Divergência`, que não tem saldo, a marca sai de `G` (13) para `E` (**11**) — e o
valor dela é `Sim — perfil ou pacote`.

**Nenhum teste falha por isso.** Largura não muda valor, não muda tipo, não aparece em
comparação de conteúdo. Aparece quando alguém abre o arquivo — que é a T-816, e é por isso que
ela é portão e não formalidade.

### 5.5 O que **não** quebra, e é bom saber por quê

| Asserção existente | Sobrevive? | Por quê |
|---|---|---|
| `test_t521_ancora_cada_aba_confere_com_o_gabarito` | **Sim** | Localiza a quantidade **por tipo**, não por posição — e passa a achar duas células numéricas por linha em vez de duas entre seis. Fica mais simples sem uma linha alterada |
| `test_t519_a_aba_sem_divergencia_traz_a_ressalva_de_perfil` | **Sim** | Usa `cabecalho[-1]` e `linha[-1]` — a marca continua sendo a última coluna. E `"Saldo" not in cabecalho` continua verdadeiro |
| `test_t519_o_item_sem_previsao_contratual_sai_marcado` | **Sim** | Mesmo motivo: `linhas[0][-1]` |
| `_linhas_da_aba` (helper) | **Sim** | Lê a linha inteira com `values_only=True`, sem supor quantas colunas há |
| `test_t522` determinismo | **Sim** | Compara conteúdo entre duas execuções, não posições |
| `test_t554` aba vazia | **Sim** | Afirma título e cabeçalho, não quantidade de colunas |
| `test_o_resumo_traz_as_quatro_situacoes_e_o_total` | **Sim** | Outra aba, sem quantidade |
| Teste-âncora do `.docx` | **Sim** | O documento formal não é tocado por tarefa nenhuma |

**Três quebram e oito sobrevivem** — e os oito sobrevivem porque foram escritos por
característica (tipo, última coluna, conteúdo) em vez de por índice. Os três que quebram foram
escritos por índice. É a diferença que separa teste que acompanha refatoração de teste que a
impede.

---

## 6. Dois acertos à ESPEC 013

Seguindo a conduta da ESPEC 007 §13.

### 6.1 A §8 da espec errou a conta: são **três** testes, não um

A espec afirmou que os dois `test_t518_*` *"passam sem alteração"* e que só o
`test_t521_o_texto_da_quantidade_e_o_do_relatorio` seria reescrito. **Os três quebram**, pelo
motivo documentado em §5.1 e §5.2: fatiamento por posição.

O engano tem origem clara e vale registrar: a espec raciocinou sobre **o que cada teste
garante** — e nesse plano ela está certa, as três garantias sobrevivem — e não sobre **como
cada teste está escrito**. Garantia e implementação do teste são coisas diferentes, e só a
segunda quebra.

Emenda a aplicar na T-820.

### 6.2 A espec não previu as larguras

A §7 listou `xlsx_analise_renderer.py` como o único arquivo de produção a mudar, e está certa —
mas dentro dele há `LARGURAS`, que a espec não menciona e que é a única coisa que nada
automático cobra (§5.4).

Não é erro de escopo: é omissão de risco. A T-814 e a T-815 a fecham, e a T-816 é quem cobra.

---

## 7. O que pode dar errado, e o que pega

| O que pode dar errado | O que pega | Quando |
|---|---|---|
| **O código de formato na convenção brasileira** — `#.##0,##` | O Excel recusa ou exibe errado. Automático: nada. **T-816** | F1 |
| O formato escolhido não reproduzir a grafia do relatório | **P1**, com a lista nomeada de divergências. Hoje acusa 52; tem de acusar 0 | F1 |
| O comparador da F0 nascer verde e não provar nada | **T-802**, que exige a reprovação com o número exato | F0 |
| Reescrever um teste **mais fraco** — trocar grafia por "é numérico" | Revisão da T-811, e o princípio da §1. Nada automático distingue teste forte de fraco | F2 |
| `Decimal` virar `float` na passagem | `test_t518_o_valor_numerico_nao_perde_precisao` reescrito (T-810) — `117,2889788312131` é quem denuncia | F1, F2 |
| **A marca sair cortada por largura** | **Nada automático** — §5.4. Só a T-816 | F3 |
| `########` no lugar do número, por coluna estreita | **Nada automático.** T-816 | F3 |
| O âncora quebrar | T-817 — mas ele localiza por tipo e **não deveria**. Se quebrar, algo foi entendido errado | F3 |
| A aba `Sem Divergência` ganhar `Saldo` por descuido no colapso das listas | `test_t519_a_aba_sem_divergencia...`, que já afirma `"Saldo" not in cabecalho` | F1 |

As três linhas de "nada automático" são as mais caras de descobrir tarde, e as três moram no
Excel — o que faz da T-816 o portão de verdade desta entrega.

---

## 8. Insumos

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **K-08** | **O arquivo aberto no Excel**: cinco abas sem aviso de reparo, `=SOMA()` funcionando, grafia conferida contra o `.docx` | T-816 | **P2 não fecha.** É a única verificação de que o formato de célula faz o que se espera — e formato é justamente o que `openpyxl` não julga |
| **K-09** | Resposta ao `I-11` — quem recebe a planilha soma a coluna, ou só lê? | — | Não bloqueia. Se ninguém soma, esta espec perde urgência, não correção |

`K-08` é o mesmo insumo `K-01` da ESPEC 009 noutra roupa, e pela mesma razão: **`openpyxl` relê
perfeitamente o que ele mesmo escreveu.** Lá foram seis defeitos de DOCX que passaram por toda
a suíte até alguém abrir o Word.

---

## 9. O que este plano não faz

- **Não toca o `.docx`.** Nenhum arquivo de `infrastructure/report/docx_renderer.py`,
  `layout.py`, `modelo.py` ou `ooxml.py`. O teste-âncora do documento é quem cobra.
- **Não toca `domain/`.** `Quantity.formatar()` e `NumberFormat` continuam como estão — esta
  entrega **lê** a regra de formatação, não a reescreve.
- **Não toca a tela nem a API.** O painel já recebe quantidade formatada pelo backend, e o
  contrato da API não expõe a estrutura de colunas do XLSX.
- **Não muda a aba `Resumo Executivo`.** Ela traz contagens, não quantidades.
- **Não agrega quantidades entre unidades.** ESPEC 009 §4.2 recusou e continua recusado: que a
  coluna **possa** ser somada não obriga ninguém a somá-la inteira.
- **Não resolve o `I-10`.** O caso `4,50` continua sem ocorrência conhecida, declarado em
  `R-NUM-06` e coberto por caso construído.
- **Não introduz dependência.** `openpyxl` já escreve `number_format` — é atributo de célula,
  não biblioteca nova.

---

## 10. Emendas da execução — 2026-08-11

### 10.1 O portão `P1` passou com um zero falso

A §2 declarou `P1` como *"o portão barato que protege os caros"*, fechado pelo comparador da
F0. Ele fechou: **141 divergências antes, zero depois.** E o arquivo estava errado em 52 das
56 linhas.

O comparador deriva, do par (valor, código de formato), o texto que o Excel mostraria. A sua
implementação de `.##` fazia `rstrip("0")` e, quando sobrava vazio, devolvia o inteiro **sem a
vírgula** — que é exatamente a suposição que o renderizador tinha feito. **O instrumento
repetiu a hipótese do objeto medido**, e por isso confirmou em vez de medir.

O defeito real: `#` omite o **dígito** ausente, não o separador. Sob `0.##` o valor `10` exibe
`10,`. Quem o encontrou foi a fase D — abrir no Excel.

A correção da espec (`R-NUM-08`) traz junto uma asserção **estrutural**: nenhum formato do
arquivo contém `.#`. Ela não deriva nada, não modela nada e **não depende de o comparador estar
certo** — é a única do conjunto que sobrevive ao instrumento errar de novo.

> **A lição para o próximo plano:** quando uma fase constrói o instrumento que vai julgar as
> seguintes, o instrumento precisa de uma verificação que não venha da mesma cabeça que
> escreveu o código. A T-802 exigia vê-lo **reprovar** — e ele reprovou, pelo motivo certo, e
> ainda assim estava errado na outra ponta. **Ver falhar prova que o instrumento não é cego;
> não prova que ele enxerga direito.**

### 10.2 A §5 acertou o conjunto inteiro, e o método é replicável

A §5 previu **três** testes quebrando e **oito** sobrevivendo, lendo cada um no repositório.
Quebraram exatamente os três, pelos motivos previstos; os oito passaram sem uma linha alterada.

É a primeira vez neste projeto que a seção de regressão de um plano acerta o conjunto — o
PLANO 009 previu três e teve cinco, o PLANO 012 supôs uma suíte verde que não estava.

A diferença foi o método: **abrir cada teste e olhar como ele localiza a coluna**, em vez de
raciocinar sobre o que ele garante. Os três que quebraram usavam índice (`linha[5:8]`); os oito
que sobreviveram usavam característica (tipo do dado, `[-1]`, conteúdo).

### 10.3 O número do portão estava errado, e o portão funcionou assim mesmo

A §2 fixou `P1` em **52 divergências**. O comparador acusou **141**. Os dois números estão
certos e contam coisas diferentes: 52 é contagem de **itens** com as duas quantidades inteiras;
141 é contagem de **células**, e cada item tem três — ou duas, na aba sem saldo.

O portão sobreviveu ao número errado porque o que ele exige não é uma contagem, é **reprovar
por motivo verificável**: as 141 eram todas da mesma espécie. Um portão escrito como `== 52`
teria reprovado a implementação correta.

### 10.4 Uma segunda coluna nossa caiu junto, e não estava no plano

Durante a execução, o mesmo argumento que sustenta esta espec — *o gabarito é o critério de
fidelidade, e a coluna era acréscimo nosso* — foi aplicado à coluna `Perfil ou pacote` da aba
`Sem Divergência`, que também não existe no artefato de referência. Ela saiu, e `R-XLS-03` da
ESPEC 009 foi revisada (§17.8 de lá).

O plano não previu, e não tinha como: ele foi escrito para as colunas de quantidade. Fica o
registro de que **a pergunta "isto está no gabarito?" tinha mais de uma resposta a dar**, e a
aba `Sem Divergência` passou a ter exatamente as quatro colunas dele.

O custo dessa remoção está medido e registrado no CHANGELOG, porque muda o que o documento
afirma: cinco linhas conformes entram como `1/1` por convenção, e o arquivo deixou de dizer
isso. A ressalva continua na tela e na resposta da API.
