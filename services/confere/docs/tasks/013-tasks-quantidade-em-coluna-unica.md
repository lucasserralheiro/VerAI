# TASKS 013 — Backlog da Quantidade em Coluna Única

| | |
|---|---|
| **Especificação** | [ESPEC 013](../specs/013-quantidade-em-coluna-unica.md) v1.2 |
| **Plano** | [PLANO 013](../plans/013-plano-quantidade-em-coluna-unica.md) v1.0, com emendas em §10 |
| **Versão** | 1.1 — 2026-08-11 — inclui a correção de `R-NUM-08` e a remoção da coluna `Perfil ou pacote` |
| **Total** | 24 tarefas · 2 insumos |
| **Status** | **Concluído** — 2026-08-11. Os três portões fechados; **`P1` fechou uma vez com zero falso** e foi refeito — ver §12.4. Reconferir o arquivo corrigido no Excel continua pendente de `K-08` |

> Escrito **antes** da implementação, como o TASKS 003, o TASKS 004, o TASKS 008, o TASKS 009 e
> o TASKS 012.

---

## 1. Convenções

**Identificadores** `T-8nn` seguem a numeração do PLANO 013, que começa em T-800 porque o
PLANO 012 fechou em T-729. A **T-823 nasce neste backlog** e está registrada como emenda em
§2.2.

**Definição de pronto — backend:** código e teste na mesma entrega; `ruff check`,
`mypy src/` e `bandit -ll -r src/` limpos; `pytest` verde; comentário explicando o *porquê*
onde a escolha não for óbvia.

**Convenção de commit** `<tipo>(T-8nn): descrição`.

### 1.1 Cinco regras que atravessam o backlog

**1 — O `.docx` não é tocado. Em nenhuma tarefa.** Estes quatro arquivos ficam somente leitura:

```
backend/src/infrastructure/report/docx_renderer.py
backend/src/infrastructure/report/layout.py
backend/src/infrastructure/report/modelo.py
backend/src/infrastructure/report/ooxml.py
```

O documento formal é o critério de aceite do projeto, e o teste-âncora da ESPEC 001 é quem
cobra. Se uma tarefa parecer exigir mudança em algum deles, **pare**.

**2 — `domain/` também não é tocado.** `Quantity.formatar()` e `NumberFormat` são a **fonte** da
regra de grafia, não o objeto dela. Esta entrega lê a regra e a traduz para formato de célula;
reescrevê-la criaria duas verdades para a mesma decisão — é a razão de `D-02`.

**3 — Nenhum teste pode sair mais fraco.** Os três que quebram foram escritos para guardar
`R-XLS-05`, e as três garantias continuam valendo (PLANO 013 §1). Trocar uma asserção de grafia
por "a célula é numérica" faz o teste passar e **apaga a garantia**. Se uma reescrita ficar mais
curta e mais fácil, desconfie.

**4 — Coluna se localiza por característica, nunca por índice.** Foi o que fez oito testes
sobreviverem e três quebrarem (PLANO 013 §5.5). Vale para todo teste novo **e** para o mapa de
larguras (§2.2): nada neste backlog pode voltar a depender de "a quinta coluna".

**5 — Nada de `float`.** O `Decimal` vai direto para a célula, como já vai hoje. É a mesma
recusa que `Quantity` faz no construtor, e o `14.070.00001.00` é quem denuncia:
`117,2889788312131`.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Situação |
|---|---|---|---|
| **E0** O comparador de grafia | T-800 … T-802 | **P1** | ✅ — refeito após §12.4 |
| **E1** O renderizador | T-803 … T-808 | **P1** | ✅ — quatro códigos, `R-NUM-08` |
| **E2** Os três testes, reescritos mais fortes | T-809 … T-813 | — | ✅ — mais a asserção estrutural |
| **E3** A largura, o Excel e o conjunto | T-814 … T-818 · T-823 | **P2** · **P3** | ✅ — a T-816 achou a vírgula pendurada |
| **E4** Documentação | T-819 … T-822 | — | ✅ |

**Ordem de execução:** E0 → E1 → E2 → E3 → E4. Linear, sem paralelização útil (PLANO 013 §4).

### Resultado

| O que | Antes | Depois |
|---|---|---|
| Colunas de quantidade por aba | **6** (3 texto + 3 número) | **3**, numéricas |
| Células de quantidade com tipo numérico | metade | **todas** |
| Colunas da aba `Itens Críticos` | 9 (A–I) | **6** |
| Colunas da aba `Sem Divergência` | 7 | **4** — as do gabarito, ver §12.5 |
| Códigos de formato | **1**, fixo (`#,##0.00`) | **4**, escolhidos por célula (`R-NUM-08`) |
| Formatos contendo `.#` | — | **nenhum**, verificado por asserção estrutural |
| Largura da coluna de marca | **24** numa aba, **13** noutra | **26** onde existe |
| Larguras | por **letra**, fixa para as quatro abas | por **nome de coluna** |
| Testes de backend | 368 | **379** |
| Testes de `test_xlsx_analise.py` | 14 (11 sobrevivem · 3 quebram) | **20** |
| Camadas tocadas | — | **`infrastructure/report/`**. Domínio, aplicação e API **não** |
| Dependências novas | — | **nenhuma** |

Um arquivo de produção mudou: `backend/src/infrastructure/report/xlsx_analise_renderer.py`.

### Os três portões

| Portão | Resultado |
|---|---|
| **P1 — a grafia não mudou** | ⚠️ Fechou com **141 → 0**, e o **zero era falso** — o comparador repetia a suposição do renderizador. Refeito sob `R-NUM-08`, agora com uma asserção **estrutural** que não depende dele. Ver §12.4 |
| **P2 — o arquivo abre e soma** | ✅ **Fechado, e foi ele quem achou o defeito.** A vírgula pendurada só apareceu no Excel. Reconferir o arquivo corrigido continua sendo `K-08` |
| **P3 — o conjunto não regrediu** | ✅ Âncora da análise intacto com as **duas** divergências declaradas; determinismo e aba vazia sem alteração; **379 testes verdes**; `ruff`, `mypy` e `bandit` limpos |

### Desvios

| Tarefa | O que mudou | Por quê |
|---|---|---|
| **T-801** | O comparador casa cabeçalho por **prefixo**, não por igualdade | Sem isso ele não enxergava as colunas `Contratado (nº)` do arranjo anterior e devolvia **zero** divergências — falso verde. Ver §12.1 |
| **T-802** | São **141** divergências, não 52 | O plano contou **itens**; o comparador conta **células**. Ver §12.2 |
| **T-814** | A largura passou a vir do **nome**, não de um remapeamento de letras | Registrado em §2.2 antes de começar. Corrigiu de passagem um defeito anterior a esta espec |
| **T-809 · T-810 · T-811** | Os testes mudaram de nome junto com o conteúdo | Os nomes citavam `T-518` e `T-521`, tarefas da ESPEC 009 que descreviam o desenho removido. Manter o nome antigo faria o teste mentir sobre o que guarda |
| **T-804 · T-805** | Os dois códigos de formato viraram **quatro**, escolhidos por célula | `#,##0.##` exibia `10,` — o `#` omite o dígito, não o separador. Achado na T-816, ao abrir no Excel. `R-NUM-08` acrescentada, `R-NUM-06` revogada. Ver §12.4 |
| **T-800 · T-801** | O comparador foi reescrito depois de já ter fechado o portão | Ele modelava `.##` com a mesma suposição do renderizador. Ver §12.4 |
| **T-812** | O veredito do caso construído **inverteu**: `4,50` agora exibe `4,50` | Sem `#` depois do ponto não há zero a omitir. O teste continua, provando o oposto do que provava — e `I-10` fechou de tabela |
| **T-813** | Passou a afirmar o conjunto de formatos **e** a ausência de `.#` | A segunda é estrutural e vale mesmo se o comparador errar de novo (`R-NUM-08`) |
| **T-807** | A coluna `Perfil ou pacote` **saiu** da aba `Sem Divergência` | Mesmo argumento desta espec, aplicado a outra coluna nossa: o gabarito não a tem. Fora do escopo do plano — ver §12.5 |
| **T-823** | O arquivo precisou ser regerado **duas vezes** | A primeira versão foi gerada antes das correções de `R-NUM-08` e da remoção da coluna. Artefato de conferência envelhece em silêncio |

### 2.1 Pontos de não retorno

**Nenhum.** A entrega é `git revert` do épico: um arquivo de produção, cinco de teste, e nada
persistido. O `.docx` não é tocado, a API não muda, e o arquivo gerado é recalculado a cada
requisição — não há artefato antigo em disco para migrar.

### 2.2 Dois desvios já conhecidos, antes de começar

Registrados agora, não contornados — conduta da ESPEC 007 §13.

**1 — A T-814 sobe de "remapear larguras" para "derivar largura do nome da coluna".**

O plano manda remapear `LARGURAS`, que hoje é `{"A": 18, "B": 62, …, "I": 24}`. Remapear
**preserva o defeito**: índice absoluto num arquivo cujas colunas mudam por aba.

E o defeito já existe hoje, antes desta entrega:

| Aba | Colunas hoje | Onde cai a marca | Largura que recebe |
|---|---|---|---|
| `Itens Críticos` | 9 (A–I) | **I** | 24 — correta |
| `Divergências` | 8 (A–H) | — | — |
| `Sem Divergência` | 7 (A–G) | **G** | **13** — estreita para `Sim — perfil ou pacote` |

`LARGURAS` foi escrita para a aba de nove colunas e aplicada às três. Remapear para seis daria o
mesmo resultado noutra posição.

A T-814 passa a **derivar a largura do nome da coluna** — `Código`, `Descrição`, quantidades,
marca — e a aplicá-la pelo índice em que aquele nome caiu. É a regra 4 de §1.1 aplicada ao
renderizador, e corrige de passagem uma imprecisão anterior a esta espec.

**2 — Falta uma tarefa no PLANO 013: gerar o arquivo para a conferência humana.**

A T-816 manda abrir o arquivo no Excel, e o plano não diz de onde ele vem. **`saida/Relatorio_Analise_Medicao.xlsx` não existe** — verificado. A T-823 fecha a lacuna, imediatamente antes da T-816.

### 2.3 A régua da E1 — o que pode mudar no arquivo

Toda diferença entre o arquivo de antes e o de depois tem de ser atribuível a esta lista:

| Onde | Delta esperado |
|---|---|
| Cabeçalho das abas de detalhe | As três colunas `(nº)` **somem**; as três de texto viram numéricas |
| Células de quantidade | Passam de texto para número, com formato de exibição |
| Grafia exibida | **Nenhuma mudança** — é o que `P1` mede |
| Coluna de marca | Muda de posição; **conteúdo idêntico** |
| Largura | Recalculada por nome (§2.2) |
| Aba `Resumo Executivo` | **Nenhuma.** Traz contagens, não quantidades, e tem larguras próprias |
| Aba vazia, determinismo, títulos | **Nenhuma** |

Se aparecer uma sétima diferença, **pare**.

---

## 3. Épico E0 — O comparador de grafia `[portão P1]`

> **Nenhum arquivo de `src/` é tocado neste épico.** O instrumento nasce antes do alvo.

#### T-800 — O que o Excel exibiria
**Tamanho:** M · **Ref:** `R-NUM-03`

Função de teste que recebe um `Decimal` e um código de formato e devolve **o texto que o Excel
mostraria**.

**Vale só para os dois códigos desta espec.** Um interpretador geral de formato do Excel seria
maior que a mudança inteira e traria defeitos próprios, que passariam por defeitos do
renderizador — instrumento com bug é pior que instrumento nenhum, porque acusa o inocente.

**Pronto quando:** a função reproduz, sobre valores construídos, as quatro combinações que
importam: inteiro com e sem milhar, e decimal com e sem milhar.

---

#### T-801 — O comparador
**Tamanho:** M · **Ref:** PLANO 013 §2 · **Portão P1**

Percorre as quatro abas de detalhe, deriva a grafia de cada célula de quantidade pela T-800 e a
confronta com `origem.formatar()`.

Devolve a **lista nomeada de divergências** — código do item, esperado, obtido. Nunca um
booleano: diferença sem nome não orienta correção. É a mesma exigência da T-504 do PLANO 009.

**Pronto quando:** o comparador nomeia as divergências e roda sobre as quatro abas.

---

#### T-802 — Ver o comparador reprovar
**Tamanho:** P · **Ref:** PLANO 013 §2 · **Portão P1**

Rodar contra o arquivo **atual**, sem nenhuma alteração de `src/`, e exigir **52 divergências**
— os 52 itens inteiros, que `#,##0.00` grafa `4,00` onde o relatório grafa `4`.

Instrumento que nasce verde não prova nada. O número exato é o que distingue "o comparador
funciona" de "o comparador não está comparando" — se acusar 56, está pegando também os quatro
com decimal, que hoje já conferem; se acusar 0, não está lendo o formato.

**Pronto quando:** as 52 estão registradas aqui, e a espécie delas é uma só.

---

## 4. Épico E1 — O renderizador `[portão P1]`

#### T-803 — Uma lista de colunas
**Tamanho:** P · **Ref:** `R-NUM-04`

`COLUNAS_TEXTO` e `COLUNAS_NUMERO` colapsam em uma: `Código`, `Descrição`, `Contratado`,
`Medido`, `Saldo`.

São os nomes **do gabarito** (ESPEC 013 §2.1). O sufixo `(nº)` existia só para desambiguar do
par de texto, e sem o par ele não desambigua nada.

**Pronto quando:** existe uma lista, e o `Sem Divergência` continua derivando dela sem `Saldo`.

---

#### T-804 — A célula recebe número e formato
**Tamanho:** M · **Ref:** `R-NUM-01`, `R-NUM-02`, `R-NUM-03`

`Decimal` direto no valor — nunca `float` (§1.1 regra 5) — e `number_format` escolhido pelo
`NumberFormat` do item.

O formato sai do domínio, não de uma tabela nova no renderizador: a escolha entre `MILHAR` e
`SIMPLES` é atributo do item (`R-MED-04`), e uma segunda tabela seria a segunda verdade que
`D-02` recusa.

**Pronto quando:** toda célula de quantidade tem `data_type == "n"` e um `number_format` que
não é o padrão.

---

#### T-805 — Os dois códigos, na convenção do OOXML `[risco]`
**Tamanho:** P · **Ref:** `R-NUM-07`

`MILHAR` com separador de milhar, `SIMPLES` sem — e os dois escritos com `.` como decimal e `,`
como milhar, que é a convenção do formato OOXML.

**A grafia brasileira parece a certa e produz arquivo inválido.** O código é escrito em inglês
e o Excel o exibe com os separadores do idioma do usuário — é ele quem traduz, não nós. Escrever
"como se lê" é o engano natural aqui, e o comentário no código precisa dizer isso, porque quem
ler depois vai querer "corrigir".

**Pronto quando:** os dois códigos estão em constantes nomeadas, com o porquê da convenção
escrito ao lado.

---

#### T-806 — `FORMATO_NUMERICO` sai
**Tamanho:** P · **Ref:** `R-NUM-03`

Remover a constante fixa `#,##0.00`.

Deixá-la como constante morta é convite: alguém a reusará por parecer "o formato do projeto", e
o `4,00` volta por uma porta que ninguém está olhando.

**Pronto quando:** a constante não existe e nada a referencia.

---

#### T-807 — A aba sem saldo e a marca no fim
**Tamanho:** P · **Ref:** `R-NUM-05`

`Sem Divergência` continua sem `Saldo` (`R-ANA-11`), e a coluna de marca continua sendo a
**última** nas duas abas que a têm.

A posição final da marca é o que faz `test_t519_*` sobreviver com `[-1]` (PLANO 013 §5.5).
Perdê-la quebraria dois testes que não precisavam ser tocados.

**Pronto quando:** os dois `test_t519_*` continuam verdes **sem alteração**.

---

#### T-808 — O comparador passa
**Tamanho:** P · **Ref:** PLANO 013 §2 · **Portão P1**

Zero divergências nos 56 itens.

Comparar com o registro da T-802: passou de 52 para 0, e a espécie que sumiu é a dos inteiros.

**Pronto quando:** P1 fechado, com os dois números lado a lado aqui. Os três testes de §5 do
plano estarão **vermelhos**, e é esperado.

---

## 5. Épico E2 — Os três testes, reescritos mais fortes

> **Regra 3 de §1.1 governa este épico inteiro.** Cada reescrita sai mais forte que a versão
> que substitui, ou a entrega trocou garantia por conveniência.

#### T-809 — Toda quantidade é número, não metade
**Tamanho:** M · **Ref:** PLANO 013 §5.1

`test_t518_a_coluna_numerica_e_numero_de_verdade` hoje faz `cabecalho[5:8]` e `linha[5:8]` —
fatiamento absoluto, e os cabeçalhos `(nº)` deixam de existir.

Reescrito: localiza as colunas de quantidade **pelo cabeçalho** e varre todas. Hoje cobre três
das seis; depois cobre as três que existem — a mesma asserção passa a valer para 100% das
células em vez de 50%.

**Pronto quando:** o teste falha se **uma** célula de quantidade virar texto, em qualquer aba.

---

#### T-810 — A precisão, com o formato ao lado
**Tamanho:** M · **Ref:** PLANO 013 §5.2

`test_t518_o_valor_numerico_nao_perde_precisao` hoje faz `usn[3] == "117,29"` (coluna de texto,
que some) e `usn[6]` (numérica, que muda de posição).

Reescrito sobre a célula única do `14.070.00001.00`: guarda `Decimal("117.2889788312131")` **e**
tem formato que a exibe como `117,29`.

É a garantia mais importante do arquivo — o valor cheio para somar, a grafia curta para ler — e
depois desta entrega as duas moram na mesma célula. O teste tem de afirmar as duas.

**Pronto quando:** falha se o `Decimal` passar por `float`, **e** falha se o formato exibir
`117,2889788312131`.

---

#### T-811 — O texto vira grafia
**Tamanho:** M · **Ref:** `R-NUM-03`

`test_t521_o_texto_da_quantidade_e_o_do_relatorio` afirma `R-XLS-05` diretamente, e por isso é o
único que **tem** de mudar de forma: a regra está sendo revisada.

Vira teste de grafia, pelo comparador da T-801, sobre os dois itens que ele já nomeia:
`14.024.00006.00` (MILHAR — `4.000` contratado, `3.265,64` medido, `734,36` saldo) e
`14.023.00002.00` (SIMPLES — `1500`, sem milhar).

**É a reescrita que mais pode enfraquecer sem parecer.** Trocá-la por "a célula é numérica"
passa sempre e não guarda nada. A pergunta que ela responde continua sendo *a planilha exibe o
mesmo que o documento formal?*

**Pronto quando:** o teste falha se o formato de `SIMPLES` ganhar separador de milhar.

---

#### T-812 — A divergência declarada vira teste
**Tamanho:** P · **Ref:** `R-NUM-06`

Caso **construído** com `4,50`: a célula guarda `Decimal("4.50")` e o formato exibiria `4,5`,
enquanto o `.docx` grafa `4,50`.

O piloto não percorre este caminho — as quatro quantidades com decimal são `117,29`, `121,29`,
`3.265,64` e `762,55`, e nenhuma termina em zero na segunda casa. Caso construído, não amostrado
— mesma escolha da T-553 do PLANO 009.

Divergência declarada em comentário é divergência esquecida; em teste, é divergência que alguém
reencontra no dia em que ela aparecer de verdade.

**Pronto quando:** o teste documenta a divergência **passando**, e não escondendo.

---

#### T-813 — Os dois formatos existem no arquivo
**Tamanho:** P · **Ref:** `R-NUM-03`

Um item de cada espécie, com o código de formato conferido na célula.

Sem ele, a regra pode virar "todo mundo com milhar" e o comparador de grafia ainda passaria em
quase tudo — só os itens `SIMPLES` de quatro dígitos denunciariam, e há poucos.

**Pronto quando:** o teste encontra os **dois** códigos distintos no mesmo arquivo.

---

## 6. Épico E3 — A largura, o Excel e o conjunto `[portões P2 e P3]`

#### T-814 — A largura passa a vir do nome `[risco]`
**Tamanho:** M · **Ref:** §2.2 · **PLANO 013 §5.4**

`LARGURAS` deixa de ser mapa por letra e passa a ser mapa por **nome de coluna**, aplicado pelo
índice em que o nome caiu.

Motivo em §2.2: o mapa por letra foi escrito para a aba de nove colunas e aplicado às três, e
já erra hoje na `Sem Divergência`. Remapear para seis repetiria o defeito noutra posição.

É a regra 4 de §1.1 aplicada ao renderizador — a mesma que fez oito testes sobreviverem a esta
entrega.

**Pronto quando:** acrescentar ou remover uma coluna não exige tocar no mapa de larguras.

---

#### T-815 — A marca cabe
**Tamanho:** P · **Ref:** `R-XLS-03`, `R-XLS-04`

A largura da coluna de marca acomoda `Sim — perfil ou pacote` nas duas abas que a têm — e elas
ficam em **letras diferentes**, o que é exatamente o que a T-814 resolve.

**Pronto quando:** conferido na T-816, com o arquivo aberto. Não há como conferir antes.

---

#### T-823 — Gerar o arquivo para a conferência `[nasce neste backlog]`
**Tamanho:** P · **Ref:** §2.2 · **Imediatamente antes da T-816**

Gerar `saida/Relatorio_Analise_Medicao.xlsx` dos dois arquivos do piloto.

**O arquivo não existe** — verificado. A T-816 manda abri-lo no Excel e o plano não diz quem o
produz. É lacuna pequena e trava um portão: sem arquivo, `P2` não tem objeto.

**Pronto quando:** o arquivo existe, com as cinco abas, e o caminho está registrado aqui.

---

#### T-816 — O arquivo aberto no Excel `[portão P2]`
**Tamanho:** P · **Ref:** PLANO 013 §2 · **Portão P2** · **Insumo `K-08`**

Verificação humana, não teste:

1. As cinco abas abrem, **sem aviso de reparo**.
2. `=SOMA()` sobre uma coluna de quantidade devolve número, não zero.
3. A grafia confere com o `.docx` em ao menos um item de cada formato — `4.000` com milhar,
   `1500` sem.
4. A marca `Sim — perfil ou pacote` **não sai cortada**, nas duas abas que a têm.
5. Nenhum `########` no lugar de número.

Os itens 4 e 5 são os que **nada automático pega** (PLANO 013 §5.4). `openpyxl` relê
perfeitamente o que ele mesmo escreveu — é a cegueira que deixou seis defeitos de DOCX passarem
por toda a suíte na ESPEC 003, até alguém abrir o Word.

**Pronto quando:** os cinco pontos conferidos por pessoa, e o resultado registrado aqui.

---

#### T-817 — O âncora e as marcas intactos
**Tamanho:** P · **Ref:** **Portão P3**

Teste-âncora da análise passando com as **duas** divergências declaradas (`I-06` e `I-01`);
`test_t519_*`, `test_t522` e `test_t554` verdes **sem alteração**.

O âncora localiza a quantidade por tipo e não deveria sequer notar esta entrega. **Se quebrar,
algo foi entendido errado** — e a resposta não é ajustar o âncora.

**Pronto quando:** verde, com o número de divergências registrado aqui.

---

#### T-818 — Regressão do conjunto
**Tamanho:** P · **Ref:** **Portão P3**

Suíte completa verde — 368 mais os novos. `ruff`, `mypy` e `bandit` limpos.
`test_architecture.py` sem alteração: `domain/` não foi tocado.

**Pronto quando:** tudo verde, com os números aqui.

---

## 7. Épico E4 — Documentação

#### T-819 — ESPEC 009
**Tamanho:** P

Emenda registrando que `R-XLS-05` foi **revisada, não revogada**: a intenção — *o arquivo tem
de poder ser somado* — permanece; o meio muda de duas colunas para uma com formato.

É a espec onde a regra mora, e é lá que quem a procurar vai olhar.

**Pronto quando:** a emenda diz o que continua valendo, não só o que mudou.

---

#### T-820 — ESPEC 013
**Tamanho:** P

Status → implementada. E a correção da §8: são **três** testes que quebram, não um — o engano
foi raciocinar sobre o que cada teste **garante** em vez de como cada teste está **escrito**
(PLANO 013 §6.1).

**Pronto quando:** nenhuma afirmação da espec contradiz o que foi entregue.

---

#### T-821 — README e CHANGELOG
**Tamanho:** P

A planilha passa a ter uma coluna por quantidade. No CHANGELOG, o que vale registrar não é a
funcionalidade — é que **o gabarito sempre teve uma coluna**, e a duplicação era acréscimo
nosso.

**Pronto quando:** a entrada explica por que o arranjo anterior existia, e por que deixou de ser
necessário.

---

#### T-822 — Este backlog
**Tamanho:** P

Resultado, desvios e o que a implementação ensinou.

**Pronto quando:** os desvios estão escritos com o motivo, e não como lista de ajustes.

---

## 8. Insumos

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **K-08** | **O arquivo aberto no Excel** — cinco abas, soma, grafia e a marca inteira | T-816 | **P2 não fecha.** É a única verificação de que o formato de célula faz o que se espera, e a única que enxerga largura |
| **K-09** | Resposta ao `I-11` — quem recebe a planilha soma a coluna, ou só lê? | — | Não bloqueia. Muda a urgência da espec, não a correção dela |

`K-08` é o `K-01` da ESPEC 009 noutra roupa, e pelo mesmo motivo. Lá foram seis defeitos de
DOCX que passaram por toda a suíte até alguém abrir o Word.

---

## 9. O que este backlog não faz

- **Não toca o `.docx`** — §1.1 regra 1.
- **Não toca `domain/`** — §1.1 regra 2. A regra de grafia é lida, não reescrita.
- **Não toca a tela nem a API.** O painel recebe quantidade já formatada pelo backend, e o
  contrato da API não expõe a estrutura de colunas do XLSX.
- **Não muda a aba `Resumo Executivo`.** Contagens, não quantidades — e ela tem larguras
  próprias, verificado.
- **Não agrega quantidades entre unidades.** ESPEC 009 §4.2 recusou; que a coluna **possa** ser
  somada não obriga ninguém a somá-la inteira.
- **Não resolve o `I-10`.** O caso `4,50` segue sem ocorrência conhecida, declarado em
  `R-NUM-06` e coberto por caso construído (T-812).
- **Não introduz dependência.** `number_format` é atributo de célula do `openpyxl`, que já é
  dependência do projeto.

---

## 12. O que a implementação ensinou

### 12.1 O comparador nasceu cego, e o portão foi quem viu

A T-802 manda rodar o comparador contra o arquivo atual e **exigir que reprove**. Na primeira
execução ele devolveu **zero divergências** — o que, num arquivo que grafa `4,00` onde o
relatório grafa `4`, é impossível.

A causa: o comparador procurava colunas chamadas `Contratado`, `Medido` e `Saldo`, e no arranjo
anterior **esses eram os nomes das colunas de texto**. As numéricas — as únicas com formato a
medir — chamavam-se `Contratado (nº)`. Ele varria o arquivo inteiro e não olhava nenhuma célula
com formato.

Se a T-802 não existisse, o comparador entraria na E1 como instrumento verde, o renderizador
mudaria, e ele continuaria devolvendo zero — **aprovando qualquer coisa**. O portão que parecia
burocracia foi o que impediu a entrega inteira de se apoiar num instrumento cego.

Corrigido casando por **prefixo**, o que o faz valer nos dois arranjos com uma versão só. Um
comparador com duas versões não compara coisa nenhuma.

### 12.2 `52` e `141` estão os dois certos, e contam coisas diferentes

A ESPEC 013 §2.3 apurou **52 linhas inteiras** de 56, e o PLANO 013 transformou esse número no
critério de `P1`. O comparador acusou **141**.

Nenhum dos dois está errado: **52 é contagem de itens** cujas duas quantidades são inteiras;
**141 é contagem de células** — cada item tem três (contratada, medida, saldo), ou duas na aba
`Sem Divergência`, que não traz saldo.

O portão funcionou apesar do número errado, e vale entender por quê: o que ele exige não é um
número, é **reprovar por motivo verificável**. As 141 eram todas da mesma espécie, e foi a
espécie única — não a contagem — que sustentou o diagnóstico. Um portão que só soubesse comparar
`== 52` teria reprovado a entrega correta.

### 12.3 A previsão de regressão do plano acertou em cheio

O PLANO 013 §5 listou, lendo o repositório, **três** testes que quebrariam e **oito** que
sobreviveriam. Quebraram exatamente os três, e pelos motivos previstos — fatiamento por posição.
Os oito passaram sem uma linha alterada.

É a primeira vez neste projeto que a §5 de um plano acerta o conjunto inteiro. A diferença em
relação ao PLANO 009 (que previu três e teve cinco) e ao PLANO 012 (que supôs uma suíte verde
que não estava) foi o método: **abrir cada teste e olhar como ele localiza a coluna**, em vez de
raciocinar sobre o que ele garante.

E o resultado tem uma leitura própria: os três que quebraram usavam índice (`linha[5:8]`,
`usn[3]`); os oito que sobreviveram usavam característica (tipo do dado, `[-1]`, conteúdo). **A
diferença entre teste que acompanha refatoração e teste que a impede não é o rigor — é o
acoplamento a posição.**

Foi a mesma lição que a T-814 aplicou ao renderizador, e por isso as duas andaram juntas.

### 12.4 O instrumento errou junto com o código, e o portão aprovou o defeito

**É a lição mais cara desta entrega.** O `P1` fechou com 141 → 0, e o arquivo estava errado em
**52 das 56 linhas**: toda quantidade redonda exibia `10,` em vez de `10`.

O `#` de um formato do Excel omite o **dígito** ausente. O separador decimal é literal e fica.
`0.##` sobre `10` mostra `10,`.

O comparador de `tests/grafia.py` foi escrito justamente para perceber o que os testes de valor
não percebem — a célula guarda o número certo e **mostra** outra coisa. E ele implementou `.##`
fazendo `rstrip("0")` e, quando sobrava vazio, devolvendo o inteiro **sem** a vírgula: a mesma
suposição do renderizador, escrita duas vezes, por quem escreveu as duas.

> **Instrumento que repete a hipótese do objeto medido não mede — confirma.**

A T-802 exigiu vê-lo **reprovar** contra o arranjo anterior, e ele reprovou, com 141
divergências da espécie certa. Isso provou que ele não era cego. **Não provou que enxergava
direito** — e as duas coisas parecem a mesma na hora.

A correção veio com a asserção que faltava, e ela é de outra natureza: **nenhum formato do
arquivo contém `.#`**. Não deriva nada, não modela nada, não depende do comparador. É
estrutural, e vale mesmo se o instrumento errar de novo.

Quem achou o defeito foi a fase D — abrir no Excel. A §12.5 do PLANO 013 dizia que ela era o
portão de verdade, e estava certa por uma razão que ninguém tinha antecipado: não era só o
`openpyxl` que relia o que ele mesmo escrevera. **Era o teste também.**

### 12.5 O gabarito tinha mais de uma resposta a dar

Durante a execução, o argumento desta espec — *o gabarito é o critério de fidelidade, e a
coluna era acréscimo nosso* — foi aplicado a uma segunda coluna: a `Perfil ou pacote` da aba
`Sem Divergência`, que também não existe no artefato de referência.

Ela saiu, `R-XLS-03` da ESPEC 009 foi revisada, e a aba passou a ter exatamente as **quatro**
colunas do gabarito.

O custo está medido e registrado no CHANGELOG porque **muda o que o documento afirma**: cinco
das dezenove linhas conformes entram como `1/1` por convenção de `R-REC-04` — uma delas é o
banco de dados contratado no perfil D e medido no perfil C — e o arquivo deixou de dizer isso.
A ressalva continua na tela e na resposta da API, que é onde nasceu.

A lição de método: a pergunta *"isto está no gabarito?"* foi feita para as colunas de
quantidade e tinha resposta para outras. **Quando um critério de fidelidade entra numa espec,
vale varrer o artefato inteiro com ele antes de fechar o escopo** — senão o mesmo argumento
volta em entregas seguintes, uma coluna por vez.

### 12.6 O que continua sem verificação

O portão `P2` é humano e depende do `K-08`. As três coisas que **nenhum teste deste backlog
alcança** são:

1. o arquivo abrir sem aviso de reparo;
2. a marca `Sim — perfil ou pacote` não sair cortada;
3. `########` no lugar de um número, por coluna estreita.

`openpyxl` relê perfeitamente o que ele mesmo escreveu, e **formato de célula é precisamente o
que só o Excel mostra**. É a cegueira que deixou seis defeitos de DOCX passarem por toda a suíte
na ESPEC 003, até alguém abrir o Word.
