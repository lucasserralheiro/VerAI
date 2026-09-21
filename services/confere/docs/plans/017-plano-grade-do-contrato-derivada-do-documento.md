# PLANO 017 — Implementação da Grade Derivada do Documento

| | |
|---|---|
| **Especificação** | [ESPEC 017](../specs/017-grade-do-contrato-derivada-do-documento.md) v1.0 |
| **Versão** | 1.0 — 2026-08-12 |
| **Estado inicial** | **379 testes de backend verdes em 8 min 13 s** · `test_extractor_contract.py` + `test_domain.py` verdes em 9,1 s (66 testes) · **nenhum teste importa `grid.py`** (§5.1) · `PA-PGM-251015-159 v5.0` extrai **0 itens** e bloqueia com 57 achados |
| **Instrumento existente** | `scripts/diagnostico_grade_contrato.py`, validado nos dois contratos e em 10 cenários sintéticos |

---

## 1. O princípio que ordena este plano

A mudança de fonte é pequena: uma passada a mais no PDF, um parâmetro a mais numa função e um
laço que casa em vez de filtrar. Talvez sessenta linhas em dois arquivos.

O que ordena o plano é outra coisa, e está escrita na história do defeito:

> **A suíte passou 100% enquanto o produto falhava em campo.**

Não por descuido de quem a escreveu. Ela roda contra **um** PDF, com o total `10637425.00` no
código, e o acoplamento à geometria desse PDF é exatamente o que uma suíte de um-só-documento
não tem como enxergar. Todo teste do extrator estava certo, e nenhum podia falhar.

Daí a primeira regra deste plano, que é a lição da T-802 do PLANO 013 e da T-704 do PLANO 012
aplicada a um caso novo:

> **O instrumento vem antes da correção, e tem de reprovar.**
> Aqui o instrumento não é um comparador que escrevemos: é **um segundo contrato real**. A F0
> não toca `src/` — ela põe o `PA-PGM` na suíte e exige vê-lo reprovar, com o número exato.

A segunda regra decorre da restrição do solicitante — *sem regredir os cenários que já
funcionam* — e da forma dos dois defeitos:

> **A correção mais barata é a que prova mais.**
> O defeito B (ESPEC 017 §2.3) tem uma correção de três linhas cuja verificação é uma
> **identidade**: em todas as páginas do piloto, casar por coluna devolve exatamente a mesma
> lista que filtrar e contar. Uma igualdade é mais forte que qualquer bateria de asserções sobre
> o resultado, e é barata. Ela vem antes de tudo o que é estrutural.

E há uma terceira, que é o que esta espec tem de específico:

> **Nenhuma constante nova de calibração.**
> `COLUNAS_DA_TABELA` e `TOLERANCIA` foram escritas com a mesma boa intenção que teríamos hoje —
> medir o documento real e usar a medida. O que as condenou foi a natureza, não o valor. Um
> plano que as substituísse por uma tolerância relativa calibrada em dois documentos adiaria o
> problema sem mudá-lo. É o que a §7 vigia.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P1 — O instrumento enxerga a falha** | Fim da F0 | O teste-âncora do `PA-PGM` **reprova** contra o código atual, e reprova pelo motivo certo: **0 itens** extraídos onde se esperam 47, `total_declarado is None`, `proposta == "PA-PGM-251015-159"` | A fixture está errada, ou o PDF não é o que quebrou. Descobrir agora, não depois |
| **P2 — O piloto não mudou** | Fim da F1 | Em **todas** as páginas do piloto, o casamento por coluna devolve lista **idêntica** ao filtro atual. `test_extractor_contract.py` verde sem uma linha alterada | A correção do defeito B mudou comportamento onde não devia. Parar |
| **P3 — Os dois contratos fecham** | Fim da F2 | Piloto: 60 itens, 57 códigos, `10637425.00`, checksum `0,00`. `PA-PGM`: 47 itens, 46 códigos, `24551037.72`, checksum `0,00`. **Mesmo código, sem parâmetro de layout** | Não entregar. É o critério de aceite da ESPEC 017 §9.3 |
| **P4 — O conjunto não regrediu** | Fim da F4 | 379 testes verdes; `ruff`, `mypy` e `bandit` limpos; nenhum teste existente reescrito | Não entregar |

**P2 é o portão barato que protege os caros.** Ele é barato por um motivo específico: é uma
igualdade entre duas funções sobre o mesmo insumo, não uma afirmação sobre o resultado final. E
protege os caros porque **toda a suíte depende da extração do piloto** — a fixture
`fontes_caras` do `conftest.py` chama o extrator e alimenta os testes de DOCX, XLSX, grid e API.
Se a extração mudar, quebra tudo de uma vez e longe da causa.

**P1 e P3 são o mesmo teste, em dois momentos.** Ele reprova na F0 e passa na F2. Nada entre os
dois momentos pode fazê-lo passar por acidente: a F1 não toca o gabarito.

---

## 3. Fases

### F0 — O segundo contrato entra, e reprova `[portão]`

**Objetivo:** poder afirmar que a correção corrigiu. **Nenhum arquivo de `src/` é tocado nesta
fase.**

| # | Tarefa | Ref. |
|---|---|---|
| T-1100 | `backend/tests/fixtures/contrato_pgm.pdf` — cópia de `docs/documentos/PA-PGM-251015-159 v5.0.pdf`, como o piloto já é cópia de `Q-00739-7`. Fixture `caminho_contrato_pgm` no `conftest.py`, sessão | `D-07` |
| T-1101 | Teste-âncora do `PA-PGM`: 47 itens, 46 códigos distintos, páginas `{22, 23, 24, 25}`, proposta `PA-PGM-251015-159`, total `24551037.72`, `soma_dos_totais == total_declarado` | §9.2 |
| T-1102 | **Rodar contra o código atual e exigir que reprove**: `len(itens) == 0` e `total_declarado is None`, com a proposta **já** correta — `_proposta` lê o texto da página 1 e não depende da grade | **P1** |
| T-1103 | Registrar no teste, em comentário, os quatro números do `PA-PGM` e sua origem — o checksum do documento, não uma execução nossa. É o que impede alguém "consertar" o teste pelo valor obtido | **P1** |

**Verificação:** T-1102 reprova, e reprova pelo motivo certo. Acusando número diferente de zero,
a fixture não é o arquivo que quebrou — e é melhor descobrir agora.

> **A T-1103 é a que mais parece formalidade e menos é.** Um teste-âncora cujo valor esperado foi
> copiado da saída do código que ele julga não é âncora, é espelho. `24551037.72` está impresso
> na linha `TOTAL:` do PDF, e é isso que o comentário precisa dizer.

**Tamanho:** P — duas horas. **Encerra:** P1.

---

### F1 — Casar por coluna `[portão]`

**Objetivo:** corrigir o defeito B, e provar que ele não muda o piloto.

| # | Tarefa | Ref. |
|---|---|---|
| T-1104 | `_fronteiras_verticais` percorre as **oito colunas esperadas** e escolhe, para cada uma, a candidata mais próxima dentro da tolerância. Sem candidata para alguma coluna, devolve lista vazia | `R-GRD-04` |
| T-1105 | **[portão]** Teste de identidade: para **cada página** do piloto, a lista devolvida é `==` à que o filtro anterior devolvia. O filtro anterior fica no teste como função de referência, não em `src/` | **P2** |
| T-1106 | Teste construído do defeito B: duas candidatas a 0,7 pt da mesma coluna resolvem para uma, e a lista sai com oito. É o caso da página 25 do `PA-PGM`, isolado da geometria dele | `R-GRD-04` |
| T-1107 | `montar_grade` deixa de comparar contagem com `len(COLUNAS_DA_TABELA)` e passa a exigir lista não vazia. A contagem virou responsabilidade de quem casa | `R-GRD-04` |
| T-1108 | `test_extractor_contract.py` verde, **sem uma linha alterada** | **P2** |

**Verificação:** P2. A T-1105 é a asserção que autoriza tudo o que vem depois.

> **A T-1105 é o coração deste plano, e é tentador escrevê-la fraca.** "As duas listas têm oito
> elementos" passa sempre e não guarda nada. O que ela tem de afirmar é **igualdade de listas,
> página por página, nas 32 páginas** — inclusive nas que devolvem vazio. É de graça, e é a
> única coisa que separa "corrigi o defeito B" de "mudei o comportamento do piloto".

> **A T-1104 tem uma armadilha de simetria.** O filtro atual pergunta *"esta candidata está perto
> de alguma coluna?"*; o novo pergunta *"esta coluna tem alguma candidata perto?"*. Parecem a
> mesma pergunta e não são — é precisamente a assimetria que causa o defeito B. Escrever o laço
> na direção antiga com cara de nova reproduz o defeito com código diferente.

**Tamanho:** P — três horas. **Encerra:** P2.

---

### F2 — O gabarito derivado do documento `[portão]`

**Objetivo:** o gabarito deixa de ser constante e passa a ser achado no PDF.

| # | Tarefa | Ref. |
|---|---|---|
| T-1109 | `derivar_gabarito(pdf) -> tuple[float, ...] \| None`: coleta as candidatas de cada página, agrupa por conjunto **idêntico** de oito, e escolhe o conjunto cujas páginas concentram mais códigos de serviço; empatando, o de maior vão | `R-GRD-01`, `R-GRD-02` |
| T-1110 | `montar_grade(pagina, gabarito)` recebe a geometria. **Caller único em produção, nenhum em teste** (§5.1) | `D-04` |
| T-1111 | `extrair()` chama `derivar_gabarito(pdf)` antes do laço; gabarito `None` produz `Contract` vazio, e `V-CTR-01` bloqueia como hoje | `R-GRD-05` |
| T-1112 | **[portão]** `derivar_gabarito` do piloto devolve `COLUNAS_DA_TABELA`, **valor por valor**. Não "equivalente": igual | **P3**, `R-GRD-09` |
| T-1113 | `derivar_gabarito` do `PA-PGM` devolve `(51.4, 122.3, 273.0, 353.6, 404.3, 445.3, 491.1, 551.5)` | `R-GRD-02` |
| T-1114 | **[risco]** Teste do concorrente: o conjunto de oito da **página 30 do piloto** — 85% da largura, **zero** códigos — não é escolhido. É o desempate de `R-GRD-02` sob prova | `R-GRD-02` |
| T-1115 | Teste de `R-GRD-03`: as páginas com grade no piloto são exatamente `{25, 26, 27, 28, 29}` — o conjunto de hoje | `R-GRD-03` |
| T-1116 | **[portão]** T-1101 passa. Os dois contratos com checksum `0,00` | **P3** |

**Verificação:** P3. E o teste-âncora do piloto continua intocado.

> **A T-1112 é o que mantém `COLUNAS_DA_TABELA` viva e honesta.** Ela é a ponte entre o mundo
> antigo e o novo: se o gabarito derivado do piloto for igual à constante, então nada do que
> vinha depois dela pode ter mudado. Se um dia divergir, a suíte cobra — e é o que impede a
> constante de apodrecer como número decorativo.

> **A T-1114 é o único lugar onde o critério de `R-GRD-02` pode falhar em silêncio.** A geometria
> não distingue a tabela de itens da página 30: ela tem oito divisórias e 85% da largura, contra
> 88% da tabela certa. Quem distingue é o código de serviço. Um `max()` por vão em vez de por
> códigos passaria nos outros testes e escolheria a tabela errada — e aí o `V-CTR-03` bloquearia,
> corretamente e sem explicar por quê.

**Tamanho:** M — meio dia. **Encerra:** P3.

---

### F3 — A cascata, o diagnóstico e o aviso

**Objetivo:** que a tela diga a causa, e não 57 vezes a consequência.

| # | Tarefa | Ref. |
|---|---|---|
| T-1117 | `container.gerar()`: `V-CTR-02` e `V-CTR-03` sob `if contrato.itens`. **A guarda vive no orquestrador**; as três validações não são tocadas | `R-GRD-06`, `D-06` |
| T-1118 | Teste: contrato vazio + catálogo de 55 entradas produz **um** achado, não 57 | `R-GRD-06` |
| T-1119 | Teste do caso oposto: contrato **não** vazio com código de catálogo ausente continua produzindo `V-CTR-02`. É o que prova que a guarda não engoliu a validação | `R-GRD-06` |
| T-1120 | `DiagnosticoDaGrade` — páginas, páginas com borda, divisórias encontradas, páginas com texto. Campo **opcional com padrão `None`** em `Contract`: nenhuma construção existente quebra | `R-GRD-07` |
| T-1121 | `v_ctr_01` concatena o diagnóstico à mensagem. Teste afirma que a mensagem traz o número de páginas e o de divisórias | `R-GRD-07` |
| T-1122 | `v_ctr_04_geometria_nao_canonica` (`AVISA`): dispara quando o gabarito derivado difere de `COLUNAS_DA_TABELA` além de 1,5 pt em qualquer divisória | `R-GRD-08` |
| T-1123 | Teste: `V-CTR-04` **ausente** no piloto, **presente** no `PA-PGM` | `R-GRD-08` |

**Verificação:** os seis testes passam; `test_api_e2e.py` verde — a resposta `422` muda de
conteúdo, não de forma.

> **A T-1120 é onde um campo novo pode quebrar o que não deve.** `Contract` é construído em
> vários testes com argumentos posicionais parciais — `Contract(proposta="X")`,
> `Contract(proposta="X", itens=contrato.itens)`. O campo entra **por último e com padrão**, ou a
> F3 derruba testes que a F1 e a F2 preservaram.

**Tamanho:** P — três horas.

---

### F4 — O conjunto e a documentação `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-1124 | Suíte completa verde — **379 testes**, contra os 379 verdes do estado inicial. **Reservar o tempo**: a execução completa custa ~8 min, quase toda em leitura de anexos (§8, `K-11`) | **P4** |
| T-1125 | `ruff`, `mypy` e `bandit` limpos. `test_architecture.py` verde sem alteração | **P4** |
| T-1126 | Conferir que **nenhum teste existente foi reescrito** — `git diff --stat` sobre `backend/tests/`, esperando só linhas **acrescentadas** e o `conftest.py` com a fixture nova | **P4**, §9 |
| T-1127 | ESPEC 001: emenda registrando que a §9.4 teve o **meio** revisado — a reconstrução por bordas permanece; a descoberta das fronteiras muda | `D-05` |
| T-1128 | ESPEC 017: status → implementada, com as emendas de execução | — |
| T-1129 | README e CHANGELOG: a aplicação lê contratos de geometria diferente da do piloto | — |
| T-1130 | TASKS 017 com resultado e desvios | — |

**Tamanho:** P — três horas. **Encerra:** P4.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3 ──► F4
 P1     P2     P3            P4
(o 2º  (o piloto (os dois          (o conjunto)
contrato) não mudou) fecham)
```

Linear, e sem paralelização útil. A F1 poderia em tese correr junto da F0, e não deve: a T-1102
tem de rodar contra o código **intocado**, ou o número que ela exige deixa de significar o que
significa.

A F3 é independente da F2 em código — a guarda da cascata não depende do gabarito —, mas depende
dela em **verificação**: a T-1123 precisa de um `PA-PGM` que extraia para poder afirmar que
`V-CTR-04` dispara nele.

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | 1,5 a 2 dias |

---

## 5. A regressão que já está escrita

Lida no repositório, não presumida.

### 5.1 Nenhum teste importa `grid.py` — e isso corta nos dois sentidos

Busca por `montar_grade`, `COLUNAS_DA_TABELA`, `_fronteiras_verticais`, `ler_celulas` e `Grade`
em `backend/tests/`: **zero ocorrências.** Os `gridCol` que aparecem são OOXML de tabela do Word,
sem relação.

| Consequência | Sinal |
|---|---|
| A troca de assinatura de `montar_grade` (`D-04`) não quebra teste nenhum — há **um** caller em produção e **zero** em teste | ✅ favorável |
| A grade **não tem teste direto**. Tudo o que se sabe sobre ela vem por reflexo, através do extrator | ⚠️ desfavorável |

O segundo item é a explicação mecânica de por que o defeito passou: não havia onde uma asserção
sobre geometria pudesse falhar. As T-1105, T-1112, T-1114 e T-1115 são os primeiros testes
diretos de `grid.py` do projeto, e é por isso que quatro das cinco tarefas de portão estão nelas.

### 5.2 O teste-âncora do extrator é forte, e é o contrato de não-regressão

`test_extractor_contract.py` — 19 testes, todos contra o piloto, todos através do extrator:

| Asserção | Sobrevive? | Por quê |
|---|---|---|
| 60 itens, 57 códigos | **Sim** | P2 garante lista idêntica; P3 reafirma o total |
| `12.074.00005.00` e `14.048.00008.00` presentes — os itens que as abordagens anteriores perdiam | **Sim** | São da página 29, que continua entrando por `R-GRD-03` (§2.6 da espec) |
| checksum `10637425.00` | **Sim** | Depende da página 29, idem |
| descrição multilinha íntegra | **Sim** | `ler_celulas` não é tocada |
| `proposta == "PA-SMIT-260319-739"` | **Sim** | `_proposta` lê texto da página 1, não a grade |
| as sete validações `V-CTR-0x` | **Sim** | Nenhuma validação muda de semântica; `D-06` mantém a guarda fora delas |

**Nenhum é reescrito.** É a asserção da T-1126, e a regra de aceite mais importante da ESPEC 017
§9.1: se algum precisar ser tocado, a implementação está errada.

### 5.3 Toda a suíte depende da extração do piloto

`conftest.py` monta `fontes_caras` chamando `PdfPlumberContractExtractor().extrair(caminho_contrato)`,
em escopo de sessão, e dela derivam os testes de DOCX, XLSX de análise, grid de divergências,
reconciliação e API.

Qualquer mudança no que o extrator devolve para o piloto **quebra tudo de uma vez, e longe da
causa** — um teste de largura de coluna do DOCX falharia por uma divisória vertical mal casada.
É a razão de P2 existir como portão próprio, no fim da fase mais barata.

### 5.4 O que muda de conteúdo sem quebrar teste: a resposta `422`

`test_api_e2e.py` exercita o caminho feliz do piloto. A resposta bloqueada muda de **57 achados
para 1** (`R-GRD-06`) e ganha diagnóstico na mensagem (`R-GRD-07`) — e nenhum teste afirma hoje a
contagem de achados de um contrato ilegível, porque nunca houve um na suíte.

A T-1118 e a T-1121 fecham essa lacuna. Não é regressão: é cobertura que não existia.

### 5.5 O que **nada** pega

| O que | Por quê |
|---|---|
| O gabarito derivado escolher a tabela errada num contrato futuro | Nenhum teste pode cobrir contrato que não temos. O que sobra é `V-CTR-03` bloqueando, e `V-CTR-04` avisando que a geometria não é a de referência |
| A mensagem de diagnóstico de `R-GRD-07` sair confusa para quem lê | A T-1121 afirma que os números estão lá, não que a frase ajuda. Só alguém lendo a tela julga isso |

A segunda linha é o `K-10` da §8.

---

## 6. Um acerto à ESPEC 017

Seguindo a conduta da ESPEC 007 §13.

### 6.1 A §12 da espec ordenou as fases certo, e pelo motivo declarado — mas faltou dizer o que a F0 é

A ESPEC 017 §12 lista cinco fases e justifica a ordem: *"a fase A vem primeiro porque é a única
que corrige um defeito já presente no piloto"*. Está certo, e este plano a preserva como F1.

O que a espec não disse é que **antes de A tem de existir o instrumento**, e que o instrumento é
a fixture do `PA-PGM` com o teste reprovando. Ela listou a fixture na fase E, no fim — junto com
os testes-âncora, o que é natural quando se pensa em "testes" como uma coisa só.

Não é erro de escopo: é ordem. A fixture no fim significa corrigir dois defeitos sem nunca ter
visto a falha reproduzida na suíte, e depois escrever o teste que a mede. Nesse arranjo, um teste
verde ao final não distingue "corrigimos" de "escrevemos o teste com o número que o código deu".

Emenda a aplicar na T-1128: a fase E da espec se desdobra em F0 (antes de tudo) e no bloco de
testes-âncora de cada fase.

---

## 7. O que pode dar errado, e o que pega

| O que pode dar errado | O que pega | Quando |
|---|---|---|
| **Introduzir uma tolerância relativa calibrada** — a constante mágica nova no lugar da velha | **Nada automático.** É revisão de código contra `D-03`. Um `0.02` no diff é o sinal | F2 |
| Escrever o laço de T-1104 na direção antiga com cara de nova | **T-1105** — a igualdade página por página. Mas só se ela for escrita forte; ver o alerta da F1 | F1 |
| `max()` por vão em vez de por códigos em `derivar_gabarito` | **T-1114**, e só ela. Passaria em todos os outros testes do plano | F2 |
| A T-1105 nascer fraca — "as duas listas têm oito elementos" | Revisão, e o princípio da §1. Nada automático distingue asserção forte de fraca | F1 |
| O teste-âncora do `PA-PGM` ganhar o número que o código produziu | **T-1103**, que exige a origem documental do `24551037.72` | F0 |
| O campo `diagnostico` quebrar construções posicionais de `Contract` | Suíte inteira, ruidosamente. **T-1120** o previne entrando por último com padrão | F3 |
| A guarda de `R-GRD-06` engolir `V-CTR-02` legítimo | **T-1119**, o caso oposto | F3 |
| Página do piloto entrar ou sair da extração sem ninguém notar | **T-1115** — o conjunto `{25, 26, 27, 28, 29}`, explícito | F2 |
| A suíte completa não caber no tempo previsto e alguém rodar só um subconjunto | **Nada automático.** `K-11` | F4 |

As duas linhas de "nada automático" são as caras: a primeira porque reintroduz a classe de
defeito que a espec existe para remover, e a segunda porque é o que permitiu ela chegar em campo.

---

## 8. Insumos

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **K-10** | **A tela do bloqueio, vista por quem confere**, com o diagnóstico de `R-GRD-07`. Um contrato ilegível submetido pela interface | T-1121 | Não bloqueia P4. A mensagem estará correta e pode estar ilegível — é o gênero de defeito que só quem lê encontra |
| **K-11** | **Janela de ~8 min para a suíte completa**, medida: 379 testes em 8 min 13 s, quase todo o custo em leitura de anexos | T-1124 | P4 não fecha. Oito minutos é tempo suficiente para tentar rodar subconjunto e declarar verde — que é como a suíte de um-só-PDF: verdadeira e insuficiente |
| **K-12** | Resposta ao `I-02` da espec — **existe catálogo próprio do `PA-PGM`?** | — | Não bloqueia a entrega. Bloqueia o **uso**: sem ele, o contrato passa a extrair corretamente e continua sem gerar relatório, agora por 26 `V-CTR-02` legítimos |

`K-12` é o insumo que decide se esta entrega resolve o problema **do usuário** ou apenas o
problema **do software**. Vale perguntar antes de começar, não depois de entregar.

---

## 9. O que este plano não faz

- **Não reescreve teste existente.** Nenhum. A T-1126 o verifica com `git diff --stat`, esperando
  apenas linhas acrescentadas em `backend/tests/` e a fixture nova no `conftest.py`.
- **Não toca `ler_celulas`.** A distribuição de palavras nas células — o que resolveu a descrição
  multilinha na ESPEC 001 §9.4 — não muda. Este plano mexe em **onde ficam as fronteiras**, não
  em como as palavras são atribuídas a elas.
- **Não toca `application/`, `api/` nem `frontend/`.** O contrato da API não muda de forma; muda o
  conteúdo da lista de achados.
- **Não aceita bordas em `lines`/`curves`.** ESPEC 017 §4.2 — nenhum dos dois contratos usa, e
  código sem caso real que o exercite é código que ninguém sabe se funciona.
- **Não implementa âncora pelo texto do cabeçalho.** §2.5 da espec a tornou desnecessária.
- **Não introduz tolerância relativa.** `D-03`. É o que a §7 vigia na primeira linha.
- **Não corrige o catálogo do `PA-PGM`.** É insumo, não código — `K-12`.
- **Não mexe na `TOLERANCIA` de 1,5 pt.** Ela continua servindo para agrupar candidatas próximas
  dentro de uma página, que é o que ela sempre foi boa em fazer. O que muda é que ela deixa de ser
  comparada contra uma coordenada absoluta do piloto.
- **Não introduz dependência.** `pdfplumber` já expõe `rects` e `extract_words`.
