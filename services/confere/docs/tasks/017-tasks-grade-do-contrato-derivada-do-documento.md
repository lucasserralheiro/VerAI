# TASKS 017 — Backlog da Grade Derivada do Documento

| | |
|---|---|
| **Especificação** | [ESPEC 017](../specs/017-grade-do-contrato-derivada-do-documento.md) v1.0 |
| **Plano** | [PLANO 017](../plans/017-plano-grade-do-contrato-derivada-do-documento.md) v1.0 |
| **Versão** | 1.0 — 2026-08-12 |
| **Total** | 38 tarefas · 4 portões · 3 insumos |
| **Status** | **Concluído** — 2026-08-12. Os quatro portões fechados; `P4` com uma ressalva de dívida preexistente — ver §10.5 |

> Escrito **antes** da implementação, como o TASKS 003, o TASKS 004, o TASKS 008, o TASKS 009, o
> TASKS 012 e o TASKS 013.

---

## 1. Convenções

**Identificadores** `T-11nn` seguem a numeração do PLANO 017, que começa em T-1100 porque o
PLANO 016 fechou em T-1025. **Sete tarefas nascem neste backlog** — T-1131 a T-1137 — e estão
registradas como emendas em §2.2.

**Definição de pronto — backend:** código e teste na mesma entrega; `ruff check`, `mypy src/` e
`bandit -ll -r src/` limpos; `pytest` verde; comentário explicando o *porquê* onde a escolha não
for óbvia.

**Convenção de commit** `<tipo>(T-11nn): descrição`.

### 1.1 Cinco regras que atravessam o backlog

**1 — Nenhum teste existente é reescrito. Nenhum.** O `git diff --stat` sobre `backend/tests/`
tem de mostrar apenas linhas **acrescentadas**, mais a fixture nova no `conftest.py`. É a regra
de aceite mais importante da ESPEC 017 §9.1, e a T-1126 é quem a cobra.

Se uma tarefa parecer exigir tocar em `test_extractor_contract.py`, **pare**. Aquele arquivo é o
contrato de não-regressão desta entrega, e ele afirma coisas que continuam verdadeiras: 60
itens, 57 códigos, `10637425.00`, e os itens nominais `12.074.00005.00` e `14.048.00008.00`.

**2 — Nenhuma constante nova de calibração.** É `D-03`, e é a lição do defeito.
`COLUNAS_DA_TABELA` foi escrita com a mesma boa intenção que teríamos hoje: medir o documento
real e usar a medida. O que a condenou foi a **natureza**, não o valor.

Um `0.02` aparecendo no diff é o sinal. Se a implementação precisar de uma tolerância relativa
para funcionar, o critério de `R-GRD-02` foi mal entendido — ele usa **igualdade exata** entre
conjuntos de divisórias.

**3 — `ler_celulas` não é tocada.** A distribuição das palavras nas células é o que resolveu a
descrição multilinha na ESPEC 001 §9.4 — a razão de a grade existir. Esta entrega mexe em **onde
ficam as fronteiras**, nunca em como as palavras são atribuídas a elas.

**4 — A grade se descobre por propriedade do negócio, nunca por coordenada.** Duas afirmações são
permitidas, e só duas: a tabela de itens tem **sete colunas** (`R-GRD-01`) e é **onde estão os
códigos de serviço** (`R-GRD-02`). Qualquer terceira afirmação sobre geometria é uma constante
calibrada disfarçada.

**5 — Campo novo em dataclass entra por último e com padrão.** `Contract` é construído em testes
com argumentos parciais — `Contract(proposta="X")`, `Contract(proposta="X", itens=…)`. O campo
`diagnostico` da T-1120 entra no fim com `= None`, ou a E3 derruba testes que a E1 e a E2
preservaram.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Situação |
|---|---|---|---|
| **E0** O segundo contrato entra, e reprova | T-1100 … T-1103 | **P1** | ✅ — reprovou com 0 itens, e só a proposta passou |
| **E1** Casar por coluna | T-1131 · T-1132 · T-1104 … T-1108 | **P2** | ✅ — a identidade mudou de altitude, §10.1 |
| **E2** O gabarito derivado do documento | T-1109 · T-1133 · T-1110 · T-1135 · T-1111 … T-1116 | **P3** | ✅ — os dois contratos com checksum `0,00` |
| **E3** A cascata, o diagnóstico e o aviso | T-1117 … T-1123 · T-1134 | — | ✅ — 57 achados viraram 1 |
| **E4** O conjunto e a documentação | T-1124 … T-1130 · T-1136 · T-1137 | **P4** | ✅ com ressalva — §10.5 |

### Resultado

| O que | Antes | Depois |
|---|---|---|
| Contratos que a aplicação lê | **1** — só a geometria do piloto | **2**, de órgãos e geometrias diferentes |
| `PA-PGM-251015-159` | **0 itens**, 57 achados bloqueantes | **47 itens**, checksum `0,00` |
| Piloto | 60 itens, checksum `0,00` | **idêntico**, e por igualdade provada |
| Origem do gabarito | constante medida no piloto | **derivada do documento** |
| Constantes de calibração | 2 (`COLUNAS_DA_TABELA`, `TOLERANCIA`) | **0 no caminho de decisão** — a primeira virou referência de `V-CTR-04`, a segunda agrupa candidatas dentro da página |
| Contrato ilegível na tela | **57** achados | **1**, com diagnóstico do que foi observado |
| Testes de backend | 379 | **405** |
| Testes diretos de `grid.py` | **0** | **15** |
| Tempo da suíte | 8 min 13 s | **8 min 05 s**, com 26 testes a mais |
| Testes existentes reescritos | — | **nenhum** — `conftest.py` com 11 inserções e 0 deleções |
| Dependências novas | — | **nenhuma** |

### Os quatro portões

| Portão | Resultado |
|---|---|
| **P1 — o instrumento enxerga a falha** | ✅ `Contract(proposta='PA-PGM-251015-159', total_declarado=None, itens=[])`. Cinco asserções reprovaram e **uma passou** — a proposta, que não depende da grade. Era exatamente o que a T-1102 exigia |
| **P2 — o piloto não mudou** | ✅ As mesmas cinco páginas produzem grade — `{25, 26, 27, 28, 29}` — e nelas as oito divisórias são iguais valor por valor. `test_extractor_contract.py` verde sem uma linha alterada. **A formulação do portão precisou mudar de altitude — §10.1** |
| **P3 — os dois contratos fecham** | ✅ Piloto `10637425.00`, `PA-PGM` `24551037.72`, os dois com diferença `0,00`, mesmo código sem parâmetro de layout |
| **P4 — o conjunto não regrediu** | ✅ **405 testes verdes em 8 min 05 s**; `mypy` limpo em 56 arquivos; `ruff` limpo em todos os arquivos desta entrega; `bandit -ll` sem apontamentos em 3.560 linhas. **Ressalva:** dois erros de `ruff` preexistentes em `test_reconciliation.py`, alheios a esta entrega — §10.5 |

### Desvios

| Tarefa | O que mudou | Por quê |
|---|---|---|
| **T-1105** | A identidade deixou de ser entre as listas cruas e passou a ser sobre o resultado observável — dois testes no lugar de um | Nas páginas sem grade o filtro antigo devolve lista **parcial** e o novo devolve vazia (`R-GRD-04`). Escrito como o plano mandava, o portão reprovaria a implementação correta. §10.1 |
| **T-1109 · T-1134** | `derivar_gabarito` virou acessor de `analisar_geometria`, que devolve gabarito **e** diagnóstico | A T-1134 exigia o diagnóstico *sem uma segunda leitura do PDF*, e as duas coisas saem do mesmo laço. `derivar_gabarito` sobreviveu porque `R-GRD-02` é uma afirmação sobre o gabarito sozinho, e é assim que os testes a interrogam |
| **T-1134** | A presença de texto é medida por `pagina.chars`, não por `extract_text()` | A pergunta é *existe camada de texto?*, e a resposta está nos caracteres — sem pagar a análise de layout em todas as páginas |
| **T-1104** | O `lambda` com argumento padrão virou a função `_mais_proxima` | `mypy` recusou: *Cannot infer type of lambda*. Com `coluna` como parâmetro não há captura de variável de laço para explicar a quem ler depois |
| **T-1135** | O script ganhou a exibição do **gabarito derivado**, além do conserto da assinatura | Era a informação que faltava nele: sabendo qual geometria o extrator escolheu, o veredito deixa de ser inferência e passa a ser leitura |
| **T-1136** | O script acusou "extração parcial" nas páginas 31 e 32 do `PA-PGM` — **falso positivo**, corrigido | §10.3 |
| **T-1125** | `ruff` reprovou em arquivo alheio à entrega | §10.5 |
| **T-1124 · T-1137** | A suíte custa **8 min 05 s** contra 8 min 13 s da linha de base, com 26 testes a mais | A passada extra de `analisar_geometria` não custou tempo mensurável: ela lê `pagina.rects`, que o extrator já percorria, e a contagem de códigos só é paga para as poucas páginas candidatas. A diferença de 8 s está dentro do ruído entre execuções — houve uma medição intermediária de 7 min 29 s |

**Ordem de execução:** E0 → E1 → E2 → E3 → E4. Linear (PLANO 017 §4).

A E1 **não pode** começar antes da E0: a T-1102 tem de rodar contra o código intocado, ou o
número que ela exige deixa de significar o que significa.

Dentro da E1 e da E2 há duas sequências rígidas, e são o que dá agilidade ao resto:

```
E1:  T-1131 ──► T-1105 ──► T-1104 ──► T-1105 de novo
     (congela)  (verde     (muda)     (tem de continuar verde)  ◄── P2
                trivial)
E2:  T-1132 ──► T-1109 ──► T-1110 ──► T-1135
     (candidatas) (deriva)  (assinatura) (conserta o script que ela quebra)
```

O resto de cada épico é paralelizável entre pessoas.

### 2.1 Pontos de não retorno

**Nenhum.** A entrega é `git revert`: cinco arquivos de produção, um de teste novo, uma fixture
binária e o script de diagnóstico. Nada persistido, nada migrado — o contrato é reextraído a cada
requisição, e não há artefato antigo em disco.

### 2.2 Três desvios já conhecidos, antes de começar

Registrados agora, não contornados — conduta da ESPEC 007 §13.

**1 — O PLANO 017 §5.1 esqueceu um caller: o script de diagnóstico.**

A §5.1 afirma, corretamente, que **nenhum teste** importa `grid.py`, e conclui que a troca de
assinatura de `montar_grade` tem *"um caller em produção e zero em teste"*. Verificado: está
certo sobre os testes e **incompleto sobre o resto**.

`scripts/diagnostico_grade_contrato.py` importa `montar_grade`, `COLUNAS_DA_TABELA` e
`TOLERANCIA`, e chama `montar_grade(pagina)` na linha 194. A T-1110 o quebra.

O detalhe que torna isto mais que um ajuste: **é a ferramenta que o suporte usará na próxima
ocorrência.** Quebrada em silêncio, ela só será descoberta no dia em que outro contrato falhar —
exatamente o dia em que ela é necessária. A T-1135 nasce para consertá-la na mesma tarefa que a
quebra, e a T-1136 exige vê-la rodar.

**2 — `derivar_gabarito` precisa das candidatas brutas, que hoje não existem separadas.**

`_fronteiras_verticais` faz duas coisas num `return` só: coleta os retângulos finos e altos, e
filtra pelo gabarito. A T-1109 precisa da **primeira metade**, sem a segunda; a T-1104 precisa da
segunda, reescrita.

Separá-las é refatoração pura, sem mudança de comportamento, e ela vem antes das duas — é a
T-1132. Fazê-la de passagem dentro da T-1109 misturaria refatoração com mudança de
comportamento na mesma revisão de código, que é onde os defeitos se escondem.

**3 — A ESPEC 017 §12 pôs a fixture do `PA-PGM` na última fase.**

Já registrado no PLANO 017 §6.1. Repetido aqui porque é a ordem que este backlog executa: a
fixture é a **E0**, antes de qualquer correção. Emenda a aplicar na T-1128.

### 2.3 A régua da entrega — o que pode mudar de comportamento

Toda diferença observável entre antes e depois tem de ser atribuível a esta lista:

| Onde | Delta esperado |
|---|---|
| Extração do **piloto** | **Nenhuma.** Zero diferenças, em qualquer campo, em qualquer página. É o que `P2` e `P3` medem |
| Extração do `PA-PGM` | De **0 itens** para **47**, com checksum `0,00` |
| Resposta `422` de contrato ilegível | De **57 achados** para **1**, com diagnóstico na mensagem |
| Achados de contrato legível | **`V-CTR-04`** a mais, e só em geometria não canônica |
| Tempo da suíte | Uma passada a mais por `pagina.rects`, já percorridos. Medir — T-1137 |
| Assinatura de `montar_grade` | Ganha o parâmetro `gabarito`. Dois callers, os dois atualizados |

**Se aparecer uma sétima diferença, pare.**

---

## 3. Épico E0 — O segundo contrato entra, e reprova `[portão P1]`

> **Nenhum arquivo de `src/` é tocado neste épico.** O instrumento nasce antes do alvo.

#### T-1100 — A fixture
**Tamanho:** PP · **Ref:** `D-07`

Copiar `docs/documentos/PA-PGM-251015-159 v5.0.pdf` para
`backend/tests/fixtures/contrato_pgm.pdf`, e acrescentar `caminho_contrato_pgm` ao `conftest.py`
em escopo de **sessão**, ao lado de `caminho_contrato`.

A duplicação segue o que o projeto já faz: `contrato.pdf` é cópia byte a byte de
`Q-00739-7.pdf`, verificado por SHA-256. Fixture que aponta para `docs/` acopla teste a
documentação.

**Pronto quando:** a fixture existe e o `pytest --collect-only` continua coletando 379.

---

#### T-1101 — O teste-âncora do `PA-PGM`
**Tamanho:** M · **Ref:** ESPEC 017 §9.2

Arquivo novo — `backend/tests/test_extractor_contrato_pgm.py`. Não acrescentar ao
`test_extractor_contract.py`: aquele arquivo é o contrato de não-regressão do piloto (§1.1
regra 1), e misturar os dois faz um `git diff` nele parecer violação da regra.

Afirma, contra o extrator:

| O que | Valor |
|---|---|
| itens | 47 |
| códigos distintos | 46 |
| páginas com item | `{22, 23, 24, 25}` |
| proposta | `PA-PGM-251015-159` |
| total declarado | `24551037.72` |
| `soma_dos_totais == total_declarado` | diferença `0,00` |

**Pronto quando:** o teste existe e afirma os seis, cada um numa asserção própria — um `assert`
composto esconde qual metade falhou.

---

#### T-1102 — Ver o teste reprovar `[portão P1]`
**Tamanho:** P · **Ref:** PLANO 017 §2 · **Portão P1**

Rodar contra o código **atual**, sem nenhuma alteração de `src/`, e exigir que reprove com:

- `len(itens) == 0` — não 42, não 47, **zero**;
- `total_declarado is None`;
- `proposta == "PA-PGM-251015-159"` — esta **já passa hoje**, porque `_proposta` lê o texto da
  página 1 e não depende da grade.

A terceira é a que distingue "o extrator não leu a tabela" de "o extrator não abriu o arquivo".
Se a proposta também vier vazia, o problema é outro e o diagnóstico desta espec não se aplica.

**Pronto quando:** os três números estão registrados aqui, e o teste reprova por eles.

---

#### T-1103 — A origem documental dos números
**Tamanho:** PP · **Ref:** **Portão P1**

Comentário no teste dizendo de onde vem cada valor esperado: `24551037.72` está impresso na
linha `TOTAL:` da página 25 do PDF; 47 e 46 saem da contagem de linhas com código.

**Um teste-âncora cujo valor esperado foi copiado da saída do código que ele julga não é âncora,
é espelho.** O comentário é o que impede alguém, daqui a um ano, "consertar" o teste com o número
que o programa devolveu.

**Pronto quando:** nenhum dos seis valores da T-1101 está sem procedência escrita.

---

## 4. Épico E1 — Casar por coluna `[portão P2]`

> Este épico corrige o **defeito B** (ESPEC 017 §2.3), que já está armado no piloto. A verificação
> é uma **identidade**, e é o que a torna barata e forte ao mesmo tempo.

#### T-1131 — Congelar o filtro atual como referência `[nasce neste backlog]`
**Tamanho:** PP · **Ref:** §2.2 · **Antes da T-1104**

Copiar o corpo atual de `_fronteiras_verticais` para o arquivo de teste, como
`_filtro_de_referencia(pagina)`. **Cópia literal**, sem melhorar nada.

É o que permite a T-1105 comparar duas implementações em vez de comparar contra uma lista de
números escrita à mão. Uma lista escrita à mão seria um terceiro lugar onde a geometria do piloto
está codificada — exatamente o vício que a espec remove.

**Pronto quando:** a função está no teste e é idêntica à de produção, com comentário dizendo que
é uma fotografia e não deve ser mantida em dia.

---

#### T-1105 — O teste de identidade `[portão P2]`
**Tamanho:** P · **Ref:** PLANO 017 §2 · **Portão P2** · **Roda duas vezes**

Para **cada uma das 32 páginas** do piloto, a lista devolvida pela produção é `==` à devolvida
pela `_filtro_de_referencia`.

Inclusive as páginas que devolvem **vazio** — são 26 delas, e são metade da garantia: uma
implementação que passasse a aceitar páginas que hoje recusa quebraria o extrator sem que
nenhuma asserção sobre as 6 páginas boas percebesse.

> **É o coração do backlog, e é tentador escrevê-lo fraco.** "As duas listas têm oito elementos"
> passa sempre e não guarda nada. O que ele afirma é **igualdade de listas, página por página**.

Roda duas vezes: **agora**, verde trivialmente (as duas funções são a mesma), e **depois da
T-1104**, quando passa a significar alguma coisa.

**Pronto quando:** verde antes da T-1104 — e é esperado que seja trivial.

---

#### T-1132 — Separar coleta de filtro `[nasce neste backlog]`
**Tamanho:** P · **Ref:** §2.2

`_fronteiras_verticais` faz duas coisas num `return`. Extrair a primeira como
`_candidatas_verticais(pagina) -> list[float]` — os retângulos finos e altos, ordenados, sem
nenhum filtro de gabarito.

Refatoração pura: `_fronteiras_verticais` passa a chamá-la e a filtrar o resultado. **Nenhuma
mudança de comportamento**, e a T-1105 continua verde.

A T-1104 precisa da segunda metade reescrita; a T-1109 precisa da primeira sozinha. Separá-las
antes evita misturar refatoração e mudança de comportamento na mesma revisão.

**Pronto quando:** T-1105 verde, e `_candidatas_verticais` não menciona `COLUNAS_DA_TABELA`.

---

#### T-1104 — Casar cada coluna com a candidata mais próxima
**Tamanho:** P · **Ref:** `R-GRD-04`

`_fronteiras_verticais` passa a percorrer as **oito colunas esperadas** e escolher, para cada
uma, a candidata mais próxima dentro de `TOLERANCIA`. Sem candidata para alguma coluna, devolve
lista vazia.

> **A armadilha é de simetria.** O filtro atual pergunta *"esta candidata está perto de alguma
> coluna?"*; o novo pergunta *"esta coluna tem alguma candidata perto?"* Parecem a mesma pergunta
> e não são — a assimetria **é** o defeito B. Escrever o laço na direção antiga com cara de nova
> reproduz o defeito com código diferente, e a T-1105 não pega, porque no piloto as duas direções
> coincidem.

Quem pega é a T-1106. Ela é obrigatória por isso.

**Pronto quando:** o laço itera sobre as colunas, não sobre as candidatas.

---

#### T-1106 — O caso construído do defeito B
**Tamanho:** P · **Ref:** `R-GRD-04`

Duas candidatas a **0,7 pt** da mesma coluna esperada resolvem para uma, e a lista sai com oito.

Caso **construído**, não amostrado do PDF: isola o mecanismo da geometria do `PA-PGM`. É o que
faz o teste continuar significando alguma coisa se um dia aquele contrato sair da suíte.

Os números vêm da página 25 do `PA-PGM`: coluna esperada `404,3`, candidatas `404,3` e `405,0`.

**Pronto quando:** o teste falha se o laço for escrito na direção antiga (T-1104).

---

#### T-1107 — `montar_grade` deixa de contar
**Tamanho:** PP · **Ref:** `R-GRD-04`

A guarda `len(verticais) != len(COLUNAS_DA_TABELA)` vira `not verticais`.

A contagem passou a ser responsabilidade de quem casa: `_fronteiras_verticais` devolve oito ou
nada. Manter a comparação seria a mesma verificação em dois lugares, e o dia em que discordarem
será um dia perdido.

**Pronto quando:** `montar_grade` não menciona `len(COLUNAS_DA_TABELA)`.

---

#### T-1108 — O piloto intacto `[portão P2]`
**Tamanho:** P · **Ref:** **Portão P2**

`test_extractor_contract.py` verde, **sem uma linha alterada**, e a T-1105 verde depois da
mudança.

**Pronto quando:** P2 fechado, com as duas confirmações registradas aqui. A T-1101 continua
**vermelha** — o gabarito ainda é a constante, e é esperado.

---

## 5. Épico E2 — O gabarito derivado do documento `[portão P3]`

#### T-1109 — Agrupar conjuntos idênticos de oito
**Tamanho:** M · **Ref:** `R-GRD-01`, `R-GRD-02`

`derivar_gabarito(pdf) -> tuple[float, ...] | None`. Para cada página, `_candidatas_verticais`
(T-1132); as páginas com **exatamente oito** candidatas entram num agrupamento por conjunto
**idêntico** — igualdade de tupla, não aproximação.

O `8` vem de `R-GRD-01`: sete colunas é fato do negócio, e é a única afirmação numérica
permitida (§1.1 regra 4).

**Pronto quando:** a função devolve os conjuntos candidatos e as páginas de cada um, sem ainda
escolher.

---

#### T-1133 — O desempate, como função própria `[nasce neste backlog]`
**Tamanho:** P · **Ref:** `R-GRD-02` · §2.2

Escolher entre os conjuntos candidatos: vence o que concentra **mais códigos de serviço** nas
suas páginas; empatando, o de maior vão.

Função separada, com entrada de dados simples — lista de `(conjunto, páginas, códigos)` — e
portanto testável sem PDF. É o que permite a T-1114 provar o desempate sem depender de o piloto
continuar tendo aquela página 30.

> **É o único ponto onde `R-GRD-02` pode falhar em silêncio.** A geometria não distingue a
> tabela de itens da página 30 do piloto: oito divisórias, 85% da largura, contra 88% da certa.
> Um `max()` por vão passa em todos os outros testes deste backlog e escolhe a tabela errada.

**Pronto quando:** a função é testável com listas, sem abrir PDF.

---

#### T-1110 — `montar_grade` recebe o gabarito
**Tamanho:** P · **Ref:** `D-04`

`montar_grade(pagina, gabarito)`. `_fronteiras_verticais(pagina, gabarito)` idem.

**Esta tarefa quebra `scripts/diagnostico_grade_contrato.py`** — §2.2, desvio 1. A T-1135 vem
imediatamente depois, na mesma entrega.

**Pronto quando:** `grid.py` não referencia `COLUNAS_DA_TABELA` em nenhum caminho de execução —
só a T-1122 a usará, para conferir.

---

#### T-1135 — Consertar o script de diagnóstico `[nasce neste backlog]`
**Tamanho:** P · **Ref:** §2.2 desvio 1 · **Imediatamente após a T-1110**

`scripts/diagnostico_grade_contrato.py` chama `montar_grade(pagina)` na linha 194 e importa
`COLUNAS_DA_TABELA` e `TOLERANCIA`.

Atualizar para a assinatura nova: derivar o gabarito uma vez com `derivar_gabarito(pdf)` e
repassá-lo. O script ganha de brinde a capacidade de mostrar **qual gabarito foi derivado**, que
é a informação que faltava nele.

**É a ferramenta que o suporte usará na próxima ocorrência.** Quebrada em silêncio, só será
descoberta no dia em que for necessária.

**Pronto quando:** o script roda nos dois PDFs sem erro. O veredito muda na T-1136.

---

#### T-1111 — O extrator deriva antes de ler
**Tamanho:** P · **Ref:** `R-GRD-05`

`extrair()` chama `derivar_gabarito(pdf)` antes do laço de páginas e o repassa a `montar_grade`.
Gabarito `None` produz `Contract` vazio, e `V-CTR-01` bloqueia como hoje.

**Pronto quando:** um PDF sem nenhum conjunto de oito devolve `Contract` com `itens == []`, sem
exceção.

---

#### T-1112 — O gabarito do piloto **é** a constante
**Tamanho:** P · **Ref:** `R-GRD-09` · **Portão P3**

`derivar_gabarito` do piloto devolve `COLUNAS_DA_TABELA`, **valor por valor**. Não "equivalente",
não "dentro da tolerância": igual.

> **É a ponte entre o mundo antigo e o novo.** Se o gabarito derivado do piloto for idêntico à
> constante, nada do que vinha depois dela pode ter mudado. E é o que mantém `COLUNAS_DA_TABELA`
> honesta em vez de decorativa: se um dia divergir, a suíte cobra.

**Pronto quando:** `assert derivar_gabarito(pdf) == COLUNAS_DA_TABELA`.

---

#### T-1113 — O gabarito do `PA-PGM`
**Tamanho:** PP · **Ref:** `R-GRD-02`

`(51.4, 122.3, 273.0, 353.6, 404.3, 445.3, 491.1, 551.5)`.

**Pronto quando:** verde, com o comentário dizendo que os valores foram medidos no PDF, não
copiados da saída.

---

#### T-1114 — O concorrente da página 30 `[risco]`
**Tamanho:** P · **Ref:** `R-GRD-02`

O conjunto de oito da página 30 do piloto — 85% da largura, **zero** códigos de serviço — não é
escolhido.

Duas asserções, e as duas importam: sobre o piloto real, e sobre a função da T-1133 com listas
construídas. A segunda continua valendo se o piloto mudar; a primeira prova que o caso é real e
não hipótese.

**Pronto quando:** trocar o critério para `max()` por vão faz **este** teste falhar, e só ele.

---

#### T-1115 — As páginas com grade não mudaram
**Tamanho:** P · **Ref:** `R-GRD-03`

No piloto, as páginas que produzem grade são exatamente `{25, 26, 27, 28, 29}` — o conjunto de
hoje, medido (ESPEC 017 §2.6).

A 25 e a 29 entram por **conter** o gabarito, não por serem iguais a ele. É `R-GRD-03`, e é o
que traz de volta a página do quadro de totais — a que carrega o `TOTAL:`.

**Pronto quando:** o conjunto está escrito literalmente no teste, não derivado de contagem.

---

#### T-1116 — Os dois contratos fecham `[portão P3]`
**Tamanho:** P · **Ref:** **Portão P3**

A T-1101 passa. Piloto e `PA-PGM`, mesmo código, sem parâmetro de layout, os dois com checksum
`0,00`.

**Pronto quando:** P3 fechado, com os dois totais lado a lado aqui — `10637425.00` e
`24551037.72`.

---

## 6. Épico E3 — A cascata, o diagnóstico e o aviso

#### T-1117 — A guarda no orquestrador
**Tamanho:** PP · **Ref:** `R-GRD-06`, `D-06`

`container.gerar()`: `V-CTR-02` e `V-CTR-03` sob `if contrato.itens`.

**As três validações não são tocadas.** A guarda vive no orquestrador para que a validação não
precise saber em que ordem é chamada — e para que os testes unitários das três sobrevivam
intactos (§1.1 regra 1).

`v_cat_02` e `v_rec_01` **não** recebem guarda: medido que não cascateiam (ESPEC 017 §2.7).

**Pronto quando:** o `if` cobre exatamente duas chamadas.

---

#### T-1118 — Um achado, não 57
**Tamanho:** P · **Ref:** `R-GRD-06`

Contrato vazio mais catálogo de 55 entradas visíveis produz **um** achado bloqueante.

**Pronto quando:** o teste afirma `== 1`, e o número 57 aparece no comentário como o que era.

---

#### T-1119 — A guarda não engoliu a validação
**Tamanho:** P · **Ref:** `R-GRD-06`

O caso oposto: contrato **não** vazio, com um código de catálogo ausente dele, continua
produzindo `V-CTR-02`.

Sem este teste, `if False:` passaria na T-1118 e apagaria uma validação bloqueante inteira. É o
par que torna a T-1118 honesta.

**Pronto quando:** falha se a guarda for escrita larga demais.

---

#### T-1120 — `DiagnosticoDaGrade`
**Tamanho:** P · **Ref:** `R-GRD-07` · §1.1 regra 5

Dataclass congelada com: páginas, páginas com borda desenhada, divisórias encontradas, páginas
com texto. Campo `diagnostico` em `Contract`, **por último e com `= None`**.

**Pronto quando:** `Contract(proposta="X")` continua funcionando, e a suíte inteira verde.

---

#### T-1134 — Coletar o diagnóstico no extrator `[nasce neste backlog]`
**Tamanho:** P · **Ref:** `R-GRD-07`

Preencher o `DiagnosticoDaGrade` durante a passada de `derivar_gabarito`, que já percorre todas
as páginas e já olha `rects` e palavras.

Separada da T-1120 porque são camadas diferentes — a estrutura é domínio, a coleta é
infraestrutura — e porque a coleta é a metade que pode custar tempo, se for escrita como uma
segunda passada em vez de aproveitar a primeira.

**Pronto quando:** o diagnóstico é preenchido **sem** uma segunda leitura do PDF.

---

#### T-1121 — A mensagem que orienta
**Tamanho:** P · **Ref:** `R-GRD-07`

`v_ctr_01` concatena o diagnóstico à mensagem. Teste afirma que ela traz o número de páginas e o
de divisórias encontradas.

Hoje o suporte recebe *"tabela de itens não localizada"* e não tem por onde começar. Com
"32 páginas, 6 com borda, 0 divisórias reconhecidas" ele distingue PDF digitalizado de layout
novo sem abrir o arquivo.

**Pronto quando:** os números estão na mensagem. Se a **frase** ajuda ou não, só o `K-10` diz.

---

#### T-1122 — `V-CTR-04`, o aviso de geometria
**Tamanho:** P · **Ref:** `R-GRD-08`

`v_ctr_04_geometria_nao_canonica`, `AVISA`: dispara quando o gabarito derivado difere de
`COLUNAS_DA_TABELA` em mais de 1,5 pt em qualquer divisória.

Avisa e não bloqueia, pelo princípio da `V-CAT-03`: documento que sai com aviso é conferível.
E há prova independente de que a leitura está certa — o checksum (`R-GRD-10`).

**Pronto quando:** a validação é uma função nomeada, com teste próprio, como as demais.

---

#### T-1123 — Ausente no piloto, presente no `PA-PGM`
**Tamanho:** PP · **Ref:** `R-GRD-08`

As duas asserções. A primeira é a que importa: `V-CTR-04` disparando no piloto significaria que
a T-1112 mentiu.

**Pronto quando:** verde nos dois contratos.

---

## 7. Épico E4 — O conjunto e a documentação `[portão P4]`

#### T-1124 — A suíte completa
**Tamanho:** P · **Ref:** **Portão P4** · **Insumo `K-11`**

379 testes verdes, mais os novos deste backlog. A linha de base foi medida: **379 em 8 min 13 s**.

**Reservar o tempo.** Oito minutos é exatamente a duração que convida a rodar um subconjunto e
declarar verde — que é como a suíte de um-só-PDF: verdadeira e insuficiente.

**Pronto quando:** o número final está registrado aqui, ao lado de 379.

---

#### T-1137 — O tempo não degradou `[nasce neste backlog]`
**Tamanho:** PP · **Ref:** §2.3

Comparar a duração da suíte com os **8 min 13 s** da linha de base.

A derivação acrescenta uma passada por `pagina.rects` — já percorridos pelo extrator —, e a
expectativa é ruído. Se subir de forma perceptível, a T-1134 provavelmente virou uma segunda
leitura do PDF.

**Pronto quando:** os dois tempos estão registrados aqui, com a diferença.

---

#### T-1125 — Lint, tipos e segurança
**Tamanho:** PP · **Ref:** **Portão P4**

`ruff`, `mypy` e `bandit` limpos. `test_architecture.py` verde **sem alteração** — `domain/`
recebeu um campo opcional e nenhuma regra.

**Pronto quando:** os três limpos.

---

#### T-1126 — Nenhum teste existente foi reescrito `[portão P4]`
**Tamanho:** PP · **Ref:** §1.1 regra 1 · **Portão P4**

`git diff --stat` sobre `backend/tests/`, esperando **apenas** linhas acrescentadas, mais o
`conftest.py` com a fixture nova e os arquivos de teste novos.

Se `test_extractor_contract.py` aparecer com linhas removidas, a implementação está errada — e a
resposta não é ajustar o teste.

**Pronto quando:** o `--stat` está colado aqui.

---

#### T-1136 — O diagnóstico roda e muda de veredito `[nasce neste backlog]`
**Tamanho:** PP · **Ref:** §2.2 desvio 1 · **Insumo `K-10`**

Rodar `scripts/diagnostico_grade_contrato.py` nos dois PDFs e conferir que:

- o piloto continua com `✓ A grade foi montada`, nas mesmas cinco páginas;
- o `PA-PGM` **passa** de `✗ Nenhuma página produziu grade` para `✓`, em quatro páginas.

É a verificação de que a T-1135 não apenas fez o script importar sem erro, mas o manteve
dizendo a verdade.

**Pronto quando:** os dois vereditos estão registrados aqui.

---

#### T-1127 — ESPEC 001
**Tamanho:** P · **Ref:** `D-05`

Emenda registrando que a §9.4 teve o **meio** revisado, não a intenção: a reconstrução da grade a
partir das bordas desenhadas permanece — é o que resolveu a descrição multilinha —, e o que muda
é como as fronteiras são descobertas.

É a espec onde a decisão mora, e é lá que quem a procurar vai olhar.

**Pronto quando:** a emenda diz o que continua valendo, não só o que mudou.

---

#### T-1128 — ESPEC 017
**Tamanho:** P

Status → implementada. Emendas: a fase E da §12 se desdobra em E0, **antes de tudo** (PLANO 017
§6.1); e o script de diagnóstico como terceiro caller (§2.2 desvio 1).

**Pronto quando:** nenhuma afirmação da espec contradiz o que foi entregue.

---

#### T-1129 — README e CHANGELOG
**Tamanho:** P

A aplicação lê contratos de geometria diferente da do piloto. No CHANGELOG, o que vale registrar
não é a funcionalidade — é **por que ela não existia**: a grade era localizada por coordenada
medida num contrato, num extrator cujo próprio cabeçalho rejeitava posição fixa.

**Pronto quando:** a entrada explica a causa, não só o sintoma.

---

#### T-1130 — Este backlog
**Tamanho:** P

Resultado, desvios e o que a implementação ensinou.

**Pronto quando:** os desvios estão escritos com o motivo, e não como lista de ajustes.

---

## 8. Insumos

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **K-10** | **A tela do bloqueio, vista por quem confere**, com o diagnóstico de `R-GRD-07` | T-1121 · T-1136 | Não bloqueia P4. A mensagem estará correta e pode estar ilegível — gênero de defeito que só quem lê encontra |
| **K-11** | **Janela de ~8 min para a suíte completa**, medida em 8 min 13 s | T-1124 | P4 não fecha |
| **K-12** | Resposta ao `I-02` — **existe catálogo próprio do `PA-PGM`?** | — | Não bloqueia a entrega. Bloqueia o **uso** |

`K-12` é o insumo que decide se esta entrega resolve o problema **do usuário** ou apenas o
problema **do software**. Corrigida a extração, o `PA-PGM` passa a ser lido e continua sem gerar
relatório, agora por 26 `V-CTR-02` legítimos — o catálogo padrão é do contrato SMIT.

Vale perguntar antes de começar, não depois de entregar.

---

## 9. O que este backlog não faz

- **Não reescreve teste existente.** §1.1 regra 1, cobrada pela T-1126.
- **Não toca `ler_celulas`.** §1.1 regra 3.
- **Não toca `application/`, `api/` nem `frontend/`.** O contrato da API não muda de forma; muda
  o conteúdo da lista de achados.
- **Não introduz tolerância relativa.** §1.1 regra 2 — é a constante mágica nova no lugar da
  velha, e a única coisa deste backlog que **nada automático pega**.
- **Não aceita bordas em `lines`/`curves`.** ESPEC 017 §4.2 — nenhum dos dois contratos usa, e
  código sem caso real que o exercite é código que ninguém sabe se funciona.
- **Não implementa âncora pelo texto do cabeçalho.** A repetição entre páginas a tornou
  desnecessária (ESPEC 017 §2.5).
- **Não mexe na `TOLERANCIA` de 1,5 pt.** Ela continua agrupando candidatas próximas dentro de
  uma página, que é o que sempre soube fazer. O que muda é contra o que ela é comparada.
- **Não corrige o catálogo do `PA-PGM`.** É insumo — `K-12`.
- **Não introduz dependência.** `pdfplumber` já expõe `rects` e `extract_words`.

---

## 10. O que a implementação ensinou

### 10.1 O portão estava escrito na camada errada

O PLANO 017 §2 definiu `P2` como *"em todas as páginas do piloto, o casamento por coluna devolve
lista **idêntica** ao filtro atual"*, e a §1 chamou isso de coração do plano. A intuição estava
certa e a formulação **reprovaria a implementação correta**.

Nas 27 páginas do piloto que não produzem grade, o filtro anterior devolve uma lista **parcial** —
as duas ou três divisórias que por acaso caíam perto de alguma coluna — e o novo devolve vazio,
porque nem toda coluna tem candidata. É o que `R-GRD-04` manda fazer: grade parcial não significa
nada. As duas levam `montar_grade` ao mesmo `None`, e a diferença é invisível para o extrator.

O teste rodou vermelho antes da mudança e foi reescrito em dois:

1. o **conjunto de páginas** com grade é o mesmo — `{25, 26, 27, 28, 29}`;
2. **onde há grade**, as oito divisórias são iguais valor por valor.

> **A lição:** uma identidade só é um bom portão na camada em que o comportamento importa. O plano
> a escreveu na camada em que o código muda, e ali as duas implementações **têm** de divergir —
> era essa a correção.

### 10.2 O plano listou os callers e esqueceu o que estava fora do `backend/`

Registrado em §2.2 antes de começar, e vale repetir no fim porque a T-1110 de fato quebrou o
script: o PLANO 017 §5.1 buscou `montar_grade` em `backend/tests/`, achou zero, e concluiu *"um
caller em produção e zero em teste"*. A busca estava certa e o escopo dela era estreito —
`scripts/diagnostico_grade_contrato.py` chamava a função e importava duas constantes.

O que torna isso mais que um ajuste: **é a ferramenta que o suporte usará na próxima ocorrência**.
Quebrada em silêncio, seria descoberta no dia em que fosse necessária.

### 10.3 O diagnóstico gritou lobo, e o checksum o desmentiu

Rodado no `PA-PGM` depois da correção, o script acusou *"extração parcial: páginas 31 e 32"* — e o
checksum do mesmo contrato fechava em `0,00`.

A heurística era *"página com código e com borda que não produziu grade perdeu linha"*. Serve para
o piloto, cuja capa cita códigos sem ter borda. Não serve para o `PA-PGM`, que traz nas páginas 31
e 32 **outra** tabela, com códigos e moldura próprias, que não é a de itens e não devia produzir
grade nenhuma.

Corrigida para *"página que **contém o gabarito escolhido** e não produziu grade"* — a única
formulação em que a acusação é verdadeira. Quando um instrumento e o checksum discordam, é o
instrumento que está errado: o checksum é prova exata, e a heurística é heurística.

### 10.4 A codificação do script foi corrompida por um comando de shell

Uma substituição feita com `Get-Content | Set-Content` no PowerShell 5.1 leu o arquivo UTF-8 como
ANSI e regravou o resultado, transformando `Diagnóstico` em `DiagnÃ³stico` no arquivo inteiro.
Reparado invertendo a transformação — decodificar como UTF-8, codificar como CP1252, decodificar
como UTF-8 — e confirmado rodando o script nos dois PDFs.

Fica o registro porque o modo de falha é silencioso: o Python continua executando, e só quem lê o
código vê. A edição de arquivo por pipeline de shell não tem lugar aqui — as ferramentas de edição
preservam a codificação.

### 10.5 O `P4` fechou com dívida alheia à entrega

`ruff check .` reprova com dois erros, ambos em `backend/tests/test_reconciliation.py`: um import
não usado (`Entradas`) e um nome não definido (`Callable`, F821 — inofensivo em tempo de execução
por causa de `from __future__ import annotations`).

**Verificado que são preexistentes:** `git diff HEAD` sobre o arquivo vem vazio, e o `ruff` reprova
igual na versão em HEAD. Nenhuma tarefa deste backlog o tocou.

Não foram corrigidos, e a escolha é deliberada: a regra 1 da §1.1 e a auditoria da T-1126 valem
mais intactas do que o portão vale fechado no literal. Um diff em `backend/tests/` que não seja
puramente aditivo enfraquece a única prova de que nenhum teste existente foi reescrito.

**São duas linhas de conserto, e ficam registradas aqui como a próxima coisa a fazer.**
