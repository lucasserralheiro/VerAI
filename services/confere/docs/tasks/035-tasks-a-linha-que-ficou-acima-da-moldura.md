# TASKS 035 — Backlog de "A linha que ficou acima da moldura"

| | |
|---|---|
| **Especificação** | [ESPEC 035](../specs/035-a-linha-que-ficou-acima-da-moldura.md) v1.0 |
| **Plano** | [PLANO 035](../plans/035-plano-a-linha-que-ficou-acima-da-moldura.md) v1.0 |
| **Versão** | 1.0 — 2026-08-31 |
| **Total** | 35 tarefas · 6 portões · 5 insumos em aberto. **30 executadas**, 1 sem objeto (`T-2271`), **4 pendentes** — as quatro exigem o binário do documento |
| **Status** | **Código completo, verificação parcial** — 2026-08-31. As três regras implementadas; portões `P0` a `P3` e `P5` fechados, `P4` **em parte**. Backend **1.482 → 1.517 passed**, zero falhas; navegador **119 / 1**, sem falha nova. Pendentes: `T-2252`, `T-2258`, `T-2270` e `T-2275`, todas por exigirem o binário do FTM (`I-01`) |

> **Escrito antes da implementação.** A §11 é a única seção que não pode ser escrita agora, e é a
> que a próxima entrega vai ler.

> **Esta entrega pode terminar na `E4` e ainda assim ser uma entrega.** O mecanismo do defeito de
> extração está estabelecido **por eliminação**, não por medição direta — o PDF não estava
> disponível quando a espec foi escrita. A `T-2269` é o portão que confirma. Reprovando, a `E5` não
> acontece, a ESPEC 035 vira v1.1, e **`E2` e `E3` ficam entregues** (`D-05`).

---

## 1. Convenções

**Identificadores** `T-22nn`, continuando de `T-2247`, a última da ESPEC 034.

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`python -m pytest` verde — **com o `-m`**, e **sem `--timeout`**, que este projeto não tem
instalado.

**Convenção de commit** `<tipo>(T-22nn): descrição`. Correção de leitura da grade é `fix(...)`;
contador e diagnóstico são `feat(...)`; fixture nova é `test(...)`. **Nunca dois tipos no mesmo
commit.**

### 1.1 Cinco regras que atravessam este backlog

**1 — A linha de base é o `HEAD`, e desta vez isso é verdade.** A árvore está limpa em `24acc9e`,
com as ESPECs 033 e 034 já commitadas. É a primeira entrega desde o PLANO 032 em que a pergunta *"de
que árvore é o antes?"* tem resposta trivial — **e é justamente por isso que vale registrá-la**, para
que a próxima não presuma o mesmo.

*O sinal no diff:* um valor "de antes" que não bata com a `T-2250`.

**2 — Nenhum dos oito `sha` de extração se move.** Congelados na `T-2250`. Esta entrega só pode
alcançar página que tenha **código de serviço entre as palavras órfãs**, e no corpus esse número é
zero (ESPEC §2.4).

*O sinal no diff:* qualquer alteração em `_fronteiras_horizontais`, `_fronteiras_verticais`,
`verticais_por_linha` ou `_faixa_mais_estreita` — nenhuma delas é desta entrega.

**3 — O risco não é perder uma linha; é inventar uma.** `V-CTR-03` já pega linha perdida — foi ela
que abriu esta espec. Uma linha **a mais**, colhida de prosa que passou pelo crivo, some no meio de
sessenta itens corretos e fecha o checksum errado. **A igualdade de `sha` é o único oráculo disso.**

*O sinal no diff:* um crivo de `R-GRD-11` que não exija **código de serviço na coluna do código** —
por posição vertical, por contagem de palavras, por "parece uma linha".

**4 — `ler_celulas` não muda de assinatura, e `_linhas` não é tocada.** `_linhas` é o crivo de
admissão de geometrias, e a ESPEC 033 `R-FXA-06` manda que ele continue respondendo a pergunta de
hoje do jeito de hoje. A contagem de `R-GRD-10` sai por **função irmã**.

*O sinal no diff:* `def ler_celulas(...) -> tuple[...]`, ou qualquer linha alterada em `_linhas`,
`_e_item_completo` ou `_geometrias_de_itens`.

**5 — `geom` é régua, não enfeite.** `montar_grade` serve o extrator **e** o crivo. Uma fronteira a
mais é uma linha a mais para o `_e_item_completo` avaliar, e uma geometria hoje recusada pode passar
a ser admitida (PLANO §7). O número entra na régua ao lado de `itens`, `total` e `sha`.

*O sinal no diff:* uma medição de fim de entrega que confira `sha` e não confira `geom`.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase | Precisa do PDF? |
|---|---|---|---|---|
| **E0** Linha de base, régua e inventário | T-2248 … T-2252 | **P0** | F0 | não |
| **E1** Os testes, escritos antes | T-2253 … T-2259 | **P0** | F1 | dois casos marcados |
| **E2** O contador | T-2260 … T-2264 | **P1** | F2 | **não** |
| **E3** O traço | T-2265 … T-2267 | **P2** | F3 | **não** |
| **E4** A confirmação do mecanismo | T-2268 … T-2271 | **P3** | F4 | **sim** |
| **E5** A fronteira superior | T-2272 … T-2277 | **P4** | F5 | **sim** |
| **E6** As duas suítes | T-2278 … T-2282 | **P5** | F6 | não |

### 2.1 A régua da entrega — o que pode mudar de comportamento

| Muda | Não muda |
|---|---|
| `PA-FTM-251001-143`: de **9 itens / `133.640,53`** para **10 itens / `185.316,73`** | Os oito `sha` de extração da `T-2250` — os cinco com item e os três da lista vazia |
| `PA-FTM-251001-143`: `cliente` de `''` para `FUNDAÇÃO THEATRO MUNICIPAL` | Os oito nomes de órgão da `T-2251`, inclusive os três `''` |
| `PA-FTM-251001-143`: `V-CTR-03` bloqueia → **cala**; `V-CAP-01` avisa → **cala** | `geom` de cada peça, o FTM inclusive (regra 5) |
| `DiagnosticoDaGrade` ganha `palavras_descartadas` | `ler_celulas`, `_linhas`, `_e_item_completo`, `_geometrias_de_itens` (regra 4) |
| `V-CTR-03` ganha sufixo **quando há descarte** | A mensagem de `V-CTR-03` quando não há — byte por byte |
| `README.md`, `CHANGELOG.md`, o `Status` da ESPEC 035 | `cauda_da_pagina` e o crivo de `R-CON-02`; a leitura por faixa; a cascata de `R-CAP-10`; o vocabulário de órgão |
| | `.docx`, `.xlsx`, `CORPO_DO_PILOTO_*`, `linhas_do_documento.json`, `valores_do_contrato.json` |

---

## 3. Épico E0 — Linha de base, régua e inventário `[portão P0]`

> **Nenhum arquivo de `src/` é tocado neste épico.**

#### T-2248 — As oito buscas, nas duas suítes `[risco]`
**Tamanho:** PP · **Ref:** PLANO §8, regra 4

Sete sobre `backend/tests/`: `montar_grade|horizontais`; `ler_celulas|_linhas|_e_item_completo|
_geometrias_de_itens`; `cauda_da_pagina|R-CON-|caudas_orfas`; `V-CTR-03|soma_dos_totais`;
`DiagnosticoDaGrade(`; `_cliente|cliente_da_capa|V-CAP-01`; `sha256`.

**Uma sobre `frontend/e2e/`**: `extração incompleta|V-CTR-03|soma dos itens`.

**A busca 1 é a que mais importa e a que mais engana.** Um teste que construa `Grade(...)` à mão não
é afetado por `R-GRD-11`; um que compare o **retorno** de `montar_grade` é. Distinguir **exige abrir
o arquivo** — foi o que a `T-2168` da ESPEC 032 fez com o `derivadas.spec.ts`, e foi o que evitou um
falso positivo.

**A busca 8 já foi feita na análise, e o resultado é contraintuitivo:** quatro arquivos do navegador
citam `V-CTR-03` — `anuncio.spec.ts:89`, `documento.spec.ts:103` e `:148`, `estados.ts:149` e `:188`,
mais um comentário em `src/lib/types.ts:12`. Mas a `mensagem` que eles carregam é *"O total do
levantamento não confere com a soma dos itens medidos"*, **escrita à mão para a fixture** e diferente
da que o backend emite. São cenários montados, não âncoras sobre a string real. **Confirmar abrindo,
não repetindo a busca.**

**Pronto quando:** o inventário está fechado por escrito, com arquivo, linha e o que cada âncora
afirma, e a tabela da ESPEC §8.5 reflete o achado.

> **Executada — 2026-08-31.**
>
> **Busca 1** — três módulos chamam `montar_grade`, e **nenhum afirma
> `horizontais` por valor**: `test_grade_por_faixa.py:205/217/233` constroem
> `Grade(...)` à mão (imunes); `:47-55` usa o retorno só para achar a linha que
> cobre uma altura; `test_grade_contrato.py:331-334` afirma `is None` /
> `is not None`, que `R-GRD-11` não muda — a síntese só ocorre onde já há grade.
>
> **Busca 2** — o crivo tem âncora real: `test_extractor_aditivo.py:166` afirma
> `len(_geometrias_de_itens(...)) == 3`, e `:223-228` chama `_linhas` e
> `_e_item_completo` diretamente. `test_extractor_aditivo_smul.py:169` mede o
> mesmo número. **É a regra 4 com nome e linha.**
>
> **Busca 4** — `test_reconciliation.py:455` afirma `V-CTR-03` **pelo
> identificador**, não pela mensagem; `test_domain.py:273` registra a validação
> com texto próprio. Nenhuma âncora sobre a string produzida.
>
> **Busca 5** — as três construções (`test_cascata_de_validacoes.py:29`,
> `test_cauda_de_pagina.py:255`, `test_documento_submetido.py:74`) usam
> **argumentos nomeados**. Campo novo por último e com padrão passa nas três.
>
> **Busca 8 — o resultado é o previsto no PLANO §8, e foi confirmado abrindo.**
> `documento.spec.ts:103`, `estados.ts:149/188` e `anuncio.spec.ts:89` carregam
> `validacao: "V-CTR-03"` com `mensagem: "O total do levantamento não confere
> com a soma dos itens medidos."` — **inventada para a fixture**.
> `documento.spec.ts:148` afirma o identificador na tela. A string do backend
> (`extração incompleta`) **não aparece em lugar nenhum do frontend**.

---

#### T-2249 — Linha de base das duas suítes `[risco]`
**Tamanho:** PP · **Ref:** PLANO, Estado inicial, **P5**

Backend: `python -m pytest -q`, esperado `1.482 passed`. Navegador: `npx playwright test`, com o
backend no ar em `127.0.0.1:8000`.

**O navegador entra com vermelho conhecido:** o `I-06` do TASKS 033
(`a11y-estrutura.spec.ts:252 › T-543 — 14.049.00054.00…`), determinístico, e a intermitente do
`I-05` (`a11y-axe.spec.ts:38 › 390 px › divergenciaDeFonte`), que reprova em execução completa e
passa isolada. Registrar o conjunto exato **antes**, para que a `T-2279` separe herdado de novo.

**A armadilha da porta, com o mecanismo que a `T-2244` identificou:** matar o `uvicorn` deixa um
worker `multiprocessing` órfão segurando o socket, e a porta continua respondendo `200` **servindo o
código anterior**. O critério confiável não é a porta: é `grep -c ERROR` no log do servidor antes de
rodar a suíte.

**Pronto quando:** os dois números e a lista de falhas estão neste documento.

> **Executada — 2026-08-31, e a primeira medição foi descartada `[risco]`.**
>
> A execução de linha de base saiu **`1 failed, 1481 passed in 1049.46s`**, e a
> falha é `test_desempenho.py::test_o_custo_de_um_anexo_e_linear` — `2.69x`
> contra o limite `2.6`. **É teste de tempo, e eu o contaminei**: rodei
> `medir_extracao.py` e outras medições em paralelo com a suíte, na mesma
> máquina.
>
> **A armadilha não foi a porta desta vez; foi a carga.** A `T-2244` da ESPEC 034
> registrou *"conferir o log do servidor, e não a porta"*; esta acrescenta
> **rodar a suíte sozinha**. Um teste de razão de custo não tem como distinguir
> regressão de vizinho barulhento.
>
> Coleta: **1.482 testes**, o número esperado. A execução limpa está na
> `T-2278`.

---

#### T-2250 — Congelar a régua de `sha` `[portão]`
**Tamanho:** PP · **Ref:** **P1**, **P2**, **P4**, regras 2 e 5

`python scripts/medir_extracao.py` (as sete peças do `CORPUS`) mais
`python scripts/medir_extracao.py backend/tests/fixtures/aditivo_pgm_2.pdf`.

O esperado, medido em 2026-08-31:

| peça | itens | total | blocos | `geom` | `sha` |
|---|---|---|---|---|---|
| `contrato.pdf` | 60 | `10637425.00` | 1 | 1 | `430e506cb76292f5` |
| `contrato_pgm.pdf` | 47 | `24551037.72` | 1 | 1 | `b8a7117b631604f1` |
| `aditivo_pgm.pdf` | 7 | `-0.12` | 3 | 3 | `0e7ec8ef5ddcc631` |
| `contrato_smul.pdf` | 41 | `27415244.95` | 1 | 1 | `6d0df30694ee2521` |
| `aditivo_smul.pdf` | 16 | `364793.93` | 3 | 4 | `fa22dd2ea6cb1d1e` |
| `modelo.pdf` | 0 | `None` | 0 | 0 | `4f53cda18c2baa0c` |
| `amostra_sem_tabela.pdf` | 0 | `None` | 0 | 0 | `4f53cda18c2baa0c` |
| `aditivo_pgm_2.pdf` | 0 | `None` | 0 | 0 | `4f53cda18c2baa0c` |

**Os três `4f53cda1…` são o `sha` da lista vazia, e isso é resultado** — não ausência de medição. Um
documento que passe a extrair item onde hoje extrai zero move esse `sha`, e é exatamente a falha da
regra 3 que ele pega.

**`geom` está na tabela de propósito** (regra 5). Conferir só `sha` deixaria passar uma geometria a
mais admitida que ainda produzisse as mesmas linhas — hoje, por sorte; amanhã, não.

**Pronto quando:** a tabela bate, valor por valor, nesta árvore.

> **Executada — 2026-08-31.** As oito linhas saíram **idênticas** à tabela
> acima, valor por valor, incluindo os `geom` e os três `sha` da lista vazia.

---

#### T-2251 — Congelar a régua de capa
**Tamanho:** PP · **Ref:** **P2**

Os nomes de órgão derivados **hoje**, peça por peça:

| peça | `cliente` hoje |
|---|---|
| `contrato.pdf` | `SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA` |
| `contrato_pgm.pdf` | `PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO` |
| `contrato_smul.pdf` | `SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO` |
| `aditivo_smul.pdf` | `SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO` |
| `aditivo_pgm_2.pdf` | `PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO` |
| `aditivo_pgm.pdf` | `''` |
| `modelo.pdf` | `''` |
| `amostra_sem_tabela.pdf` | `''` |

**Os três `''` são resultado**, e são o que prova que a classe de traços não passa a "achar órgão"
onde não há.

**Pronto quando:** a tabela bate, valor por valor, nesta árvore.

> **Executada — 2026-08-31.** As oito linhas idênticas. É o "antes" da `T-2266`.

---

#### T-2252 — A fixture do FTM `[bloqueante da E4 em diante]`
**Tamanho:** PP · **Ref:** ESPEC `T-01`, **P3**, `I-01`

Obter o `PA-FTM-251001-143 v1.0.pdf` e versioná-lo em
`backend/tests/fixtures/aditivo_ftm.pdf`.

**Não bloqueia `E1`, `E2` nem `E3`** — as duas correções daqueles épicos têm a não-regressão
inteiramente medida no corpus versionado. **Bloqueia da `E4` em diante**, e é a única dependência
externa desta entrega.

**Versionar, e não rodar contra caminho de máquina.** É o que a ESPEC 033 fez com o
`PA-SMUL-250314-22` e a ESPEC 034 com o `aditivo_pgm_2.pdf`, e pelo mesmo motivo: sem a peça na
suíte, a regra volta a valer por um documento que ninguém mais consegue reproduzir.

**Pronto quando:** o arquivo está em `fixtures/`, e `scripts/medir_extracao.py` roda sobre ele.

> **NÃO EXECUTADA — o insumo `I-01` não chegou.** O `PA-FTM-251001-143 v1.0.pdf`
> foi anexado à conversa duas vezes, mas o que chega é o **texto extraído e as
> imagens das páginas**, não o binário. Varredura do perfil do usuário por
> qualquer PDF gravado nas últimas seis horas: **nenhum**.
>
> `pdfplumber` precisa do arquivo real, porque o defeito está exatamente no que o
> texto extraído **não** carrega — os retângulos de 0,7 pt que desenham a grade.
>
> **Consequência, e ela estava prevista:** `E0` a `E3` foram executadas e
> entregam duas das três correções; `E4` e `E5` ficam abertas.

---

## 4. Épico E1 — Os testes, escritos antes `[portão P0]`

> **Dois casos ficam marcados até a `T-2252` chegar** — `T-2257` e `T-2258`. Marcar é decisão, e o
> `[risco]` da `T-2259` é conferir que os outros cinco reprovam **pelo motivo certo**.

#### T-2253 — `R-GRD-10`: o corpus acusa zero
**Tamanho:** PP · **Ref:** `R-GRD-10`, regra 3

As oito peças da `T-2250` acusam **zero** palavra descartada dentro do vão da tabela.

Escrito agora, com a função ainda ausente: reprova por `ImportError`, e é o vermelho declarado da
`T-2259`. **É a régua que impede o contador de contar prosa** — se ele acusar qualquer coisa no
corpus, está medindo a região errada.

**Pronto quando:** o caso existe e reprova pelo motivo declarado.

> **Executada — 2026-08-31, e a régua NÃO é zero.** `test_palavras_fora_da_grade.py`
> · `DESCARTE`.
>
> **A tarefa estava errada, e a medição a corrigiu.** Ao escrever este backlog eu
> confundi duas medições da espec: a §2.4 mede **zero páginas com código de
> serviço entre as órfãs** — que é o crivo da `R-GRD-11` — e eu a li como *zero
> palavras descartadas*. São coisas diferentes. Prosa acima da tabela é
> descartada em nove páginas do corpus, e está **certo**:
>
> ```
> contrato.pdf       ((25, 177),)          prosa sobre SOA
> contrato_pgm.pdf   ((22, 214),)          marcadores sobre VPN
> aditivo_pgm.pdf    ((6, 138),)           título de seção
> contrato_smul.pdf  ((11, 8), (13, 1))    prosa de seção e fragmento
> aditivo_smul.pdf   ((3, 1),)             o rótulo `Aumento`
> modelo · amostra · aditivo_pgm_2   ()    sem gabarito, sem grade
> ```
>
> **A impressão digital é régua mais forte que zero:** é o comportamento da grade
> em cada página de cada peça, e é o que `R-GRD-11` pode perturbar **sem mover um
> `sha`**. Zero teria sido uma régua que nunca falha e nunca prova nada.
>
> **E as três páginas de cauda não aparecem** — `contrato.pdf` p27 e p28,
> `contrato_pgm.pdf` p23 —, o que prova que o resgate é subtraído da conta.

---

#### T-2254 — `R-GRD-12`, em caso construído `[risco]`
**Tamanho:** P · **Ref:** `R-GRD-12`, `D-03`

**Sem abrir PDF**, no espírito de `_escolher_gabarito` e da `R-FXA-05` da ESPEC 033:

- órfãs com **um** código de serviço na coluna do código, e nada acima da linha visual dele
  → **sintetiza** a fronteira;
- órfãs com um código **e** palavra acima da linha visual dele → **não** sintetiza;
- órfãs com dois códigos → **não** sintetiza;
- órfãs sem código → **não** sintetiza (é o caso das nove páginas do corpus).

**É o teste que pega a versão frouxa da regra.** Quem implementar `R-GRD-11` por posição vertical,
por contagem de palavras ou por "tem cara de linha" passa em tudo o mais e reprova aqui.

**Pronto quando:** os quatro casos existem e reprovam por a função não existir ainda.

> **Executada — 2026-08-31, depois de a `T-2269` fechar o portão `P3`.**
>
> Cinco casos sobre `_PaginaFalsa`, sem abrir PDF: sintetiza com um código na
> coluna 0 e nada acima dele; **não** sintetiza com palavra acima da linha do
> código, com dois códigos, com prosa, nem com código citado fora da coluna 0.
>
> **A espera valeu**, e é o que a `F4` existe para garantir: o caso construído
> afirma o comportamento de uma função cujo mecanismo só foi conhecido depois da
> medição.

---

#### T-2255 — `R-CON-06`: as três caudas continuam costuradas
**Tamanho:** PP · **Ref:** `R-CON-06`, `D-04`

`contrato.pdf` p27 e p28, `contrato_pgm.pdf` p23: a cauda continua sendo costurada na descrição da
linha anterior, e **nenhuma** fronteira superior é sintetizada nelas.

**Passa antes e depois, e é assim que ele funciona.** Hoje a cauda é costurada nas três; depois,
também — porque o crivo de `D-02` não dispara onde não há código. Quem escrever `R-GRD-11` sem o
crivo reprova **só nele**, que é exatamente o serviço que ele presta.

**Pronto quando:** o caso existe e **passa** contra esta árvore.

> **Executada, e por outro caminho — 2026-08-31.** Sem `R-GRD-11` implementada,
> não há síntese que conferir. O que ficou provado é a metade verificável hoje:
> `test_r_grd_10_as_paginas_de_cauda_nao_contam_como_descarte` afirma que as três
> páginas de cauda **não entram** na contagem de descarte — o que só é verdade
> porque `cauda_da_pagina` as resgatou. A outra metade — *nenhuma fronteira é
> sintetizada nelas* — entra com a `T-2277`.

---

#### T-2256 — `R-CAP-16` / `R-CAP-17`: os oito nomes por extenso
**Tamanho:** P · **Ref:** `R-CAP-16`, `R-CAP-17`

Os oito nomes da `T-2251`, um caso por peça, com os três `''` afirmados.

**Passa antes e depois** para as oito. É régua de não-regressão, e o valor dela aparece no `P2`.

**Pronto quando:** os oito casos existem e passam contra esta árvore.

> **Executada — 2026-08-31.** `test_r_cap_17_os_oito_orgaos_nao_se_movem`, oito
> casos parametrizados, verdes contra esta árvore **antes** da `T-2265`.

---

#### T-2257 — O `_SIGLA` esquecido `[marcado até T-2252]`
**Tamanho:** PP · **Ref:** `R-CAP-16`

O nome derivado do FTM é `FUNDAÇÃO THEATRO MUNICIPAL` e **não contém `FTMSP`**.

**É metade da correção, não arredondamento.** Com a classe de traços só em `_CLIENTE`, a capa sairia
`FUNDAÇÃO THEATRO MUNICIPAL – FTMSP`, com a sigla colada — pior que o aviso de hoje, porque
**parece** certo.

**Pronto quando:** o caso existe, marcado, com o motivo da marca escrito.

> **Executada sem a fixture, e é decisão — 2026-08-31.** O defeito de capa é de
> **prosa**, e a prosa da primeira página está no anexo da conversa por extenso.
> `test_r_cap_16_a_capa_do_ftm_deriva_o_orgao` monta esse texto e afirma
> `FUNDAÇÃO THEATRO MUNICIPAL` — sem `FTMSP` colado, que é o que pega o `_SIGLA`
> esquecido. `test_r_cap_16_a_sigla_sai_com_qualquer_traco` cobre as três grafias
> reais.
>
> **O que precisa do arquivo é a extração, não a capa.** Marcar este caso teria
> deixado a metade entregável desta espec sem prova.

---

#### T-2258 — `R-GRD-11`: as dez linhas do FTM `[marcado até T-2252]`
**Tamanho:** P · **Ref:** `R-GRD-11`, **P4**

O FTM extrai **10 itens**, fecha em `185.316,73`, e a linha `14.031.00018.00` sai com
`45,33 · 95,00 · 12 · 51.676,20` **por extenso** — código, descrição, unidade e os quatro números.

**Por extenso, e não por contagem.** Dez itens e o total certo também sairiam se a linha entrasse com
a descrição errada; é a tupla inteira que prova que a fronteira foi sintetizada no lugar certo.

**Pronto quando:** o caso existe, marcado, com o motivo da marca escrito.

> **NÃO EXECUTADA — `I-01`.** Precisa da fixture, e sem ela não há como afirmar a
> tupla. Marcá-la como `xfail` contra um arquivo ausente seria cobertura de
> mentira.

---

#### T-2259 — Rodar e conferir **como** cada um reprova `[portão]`
**Tamanho:** PP · **Ref:** **P0**

| caso | vermelho esperado |
|---|---|
| `T-2253` | `ImportError` — a função irmã não existe |
| `T-2254` | `ImportError` ou `AttributeError` — a síntese não existe |
| `T-2255` | **passa** |
| `T-2256` | **passa**, nas oito |
| `T-2257` · `T-2258` | marcados |

**Teste que reprova pelo motivo errado é pior que teste ausente**, porque parece cobertura. Foi o que
a `T-2231` da ESPEC 034 mostrou: um caso de ambiguidade escrito com um texto que a regra antiga nem
casava passava sem provar nada, e só o vermelho declarado no plano denunciou.

**Pronto quando:** cada linha da tabela acima foi conferida uma a uma.

> **Executada em parte, e a tabela mudou — 2026-08-31.**
>
> | caso | previsto | observado |
> |---|---|---|
> | `T-2253` | `ImportError` | **a régua mudou de forma** (ver `T-2253`): virou a impressão digital, medida depois de a função existir |
> | `T-2254` | `ImportError` | não escrita (`I-01`) |
> | `T-2255` | passa | **passa**, na metade verificável |
> | `T-2256` | passa, nas oito | **passa, nas oito** |
> | `T-2257` | marcado | **executado** — o defeito de capa não precisa do PDF |
> | `T-2258` | marcado | não escrita (`I-01`) |
>
> **A disciplina do vermelho declarado pagou-se de novo, e ao contrário.** A
> `T-2231` da ESPEC 034 pegou um teste que passava pelo motivo errado; aqui a
> tabela pegou uma **régua** escrita pelo motivo errado. A previsão *"reprova por
> `ImportError`, depois afirma zero"* não podia se cumprir, porque zero não é o
> que o corpus faz — e foi tentar cumpri-la que revelou a confusão da `T-2253`.
>
> **A ordem foi invertida de propósito, e vale registrar:** o contador da `E2` foi
> escrito **antes** da sua régua, porque a régua tinha de ser medida e a medição
> exigia a função. Nos outros casos a ordem teste→código valeu; neste, não valia —
> forçá-la teria produzido um teste que afirma um número inventado.

---

## 5. Épico E2 — O contador `[portão P1]`

> **Não depende do PDF.** E entregue sozinho, o FTM **continua bloqueando** — mas a mensagem de
> `V-CTR-03` passa a dizer onde a grade descartou palavra. É o `T-01` da espec respondido pelo
> próprio produto, e é o que torna a `E4` uma conferência de vinte minutos.

#### T-2260 — A função irmã em `grid.py`
**Tamanho:** P · **Ref:** `R-GRD-10`, regra 4

Para uma página e uma grade, quantas palavras caíram no vão horizontal da tabela e **não** foram
atribuídas a célula nenhuma.

**`ler_celulas` não muda de assinatura, e `_linhas` não é tocada.** A leitura tentadora da espec —
*"`ler_celulas` devolve a contagem ao lado das linhas"* — trocaria o tipo de retorno e alcançaria o
crivo de admissão, que **não quer a contagem**. É a regra 4, e a ESPEC 033 `R-FXA-06` é quem a pede.

**Pronto quando:** `T-2253` verde nas oito peças, e `git diff` de `_linhas` vazio.

> **Executada — 2026-08-31.** `palavras_fora_da_grade(pagina, grade) -> int` em
> `grid.py`, ao lado de `_indice`.
>
> O vão é o da **tabela** (`verticais[0]` a `verticais[-1]`, medido em `x0`, como
> em `cauda_da_pagina`) e o teste é o de **linha** (centro, como em
> `ler_celulas`). As duas metades são emprestadas de quem já decide cada uma.
>
> **`ler_celulas` e `_linhas` intocadas** — `git diff` confirma. A regra 4 vale.

---

#### T-2261 — O campo no diagnóstico
**Tamanho:** PP · **Ref:** `R-GRD-10`

`DiagnosticoDaGrade` ganha `palavras_descartadas: tuple[tuple[int, int], ...]` — página e contagem.

**Por último e com padrão**, como `caudas_orfas`, `referencias` e `parece_proposta` antes dele: o
diagnóstico é construído à mão em dezenas de testes, e campo obrigatório quebraria todos de uma vez
sem nada acusar.

**Pronto quando:** `test_domain.py` e vizinhos verdes sem alteração.

> **Executada — 2026-08-31.** `palavras_descartadas: tuple[tuple[int, int], ...] = ()`,
> último campo de `DiagnosticoDaGrade`. As três construções à mão do §8 usam
> argumentos nomeados e não precisaram de uma linha.

---

#### T-2262 — O extrator acumula, deduplicando por página `[risco]`
**Tamanho:** P · **Ref:** `R-GRD-10`

O laço é `por página × por geometria`, e **uma página pode casar mais de uma geometria** — o
`aditivo_pgm.pdf` tem página assim, e foi por isso que a ESPEC 032 criou `caudas_costuradas`.

**Sem dedup o contador dobra**, e a mensagem mente sobre o tamanho do problema — num campo cuja razão
de existir é dizer o tamanho do problema.

**Pronto quando:** as oito peças acusam zero, e o caso do `aditivo_pgm.pdf` foi conferido à mão.

> **Executada — 2026-08-31, e o guarda é necessário.** `paginas_contadas`, ao lado
> de `caudas_costuradas`, no mesmo bloco.
>
> **A conta mora dentro do bloco da cauda de propósito:** ela precisa da `cauda`
> que acabou de ser decidida, porque o que a cauda resgatou não foi perdido. Um
> laço próprio recalcularia a mesma decisão em dois lugares.
>
> O `aditivo_pgm.pdf` tem três geometrias admitidas e a página 6 aparece **uma**
> vez — `test_r_grd_10_a_contagem_e_por_pagina_e_nao_por_geometria`. Sem o
> guarda, sairia `414` onde a página descarta `138`.

---

#### T-2263 — O sufixo condicional de `V-CTR-03`
**Tamanho:** PP · **Ref:** §5.1 da espec

Havendo descarte, a mensagem ganha *"— e a grade descartou N palavras na página P"*. **Não havendo,
sai byte por byte igual à de hoje.**

A string não tem âncora no repositório — a única ocorrência é a `f-string` que a monta —, e as
citações de `V-CTR-03` no navegador são por identificador, com mensagem inventada para a fixture.
**Mas é a `T-2248` que confirma isso, não este parágrafo.**

**Pronto quando:** os casos existentes de `V-CTR-03` em `test_reconciliation.py` e
`test_cascata_de_validacoes.py` seguem verdes sem alteração.

> **Executada — 2026-08-31, com uma correção de redação na execução.**
>
> A primeira versão saía `…na página 7 (14)` para uma página só — repetindo entre
> parênteses o número que a frase acabara de dar. Passou a ramificar: uma página,
> `na página 7`; mais de uma, `nas páginas 9 (200), 11 (30), 7 (14)`, as três
> maiores.
>
> Sem descarte, a mensagem sai **byte por byte igual** — afirmado por extenso em
> `test_r_grd_10_sem_descarte_a_mensagem_e_a_de_sempre`. `test_reconciliation.py`
> e `test_cascata_de_validacoes.py` verdes sem alteração.

---

#### T-2264 — Portão `P1` `[portão]`
**Tamanho:** PP · **Ref:** **P1**, regras 2 e 5

`palavras_descartadas` zero nas oito peças; os oito `sha` e os oito `geom` idênticos à `T-2250`.

**Pronto quando:** a tabela da `T-2250` foi reproduzida inteira, e não por amostra.

> **Executada — `P1` fecha.** As oito peças reproduzidas inteiras: `itens`,
> `total`, `blocos`, `geom` e `sha` **idênticos** à `T-2250`.

---

## 6. Épico E3 — O traço `[portão P2]`

> **Não depende do PDF** para a não-regressão. O caso positivo (`T-2257`) fica marcado.

#### T-2265 — A classe de traços em `_CLIENTE` **e** em `_SIGLA`
**Tamanho:** PP · **Ref:** `R-CAP-16`, `D-06`

Hífen, hifens tipográficos, en dash, em dash e sinal de menos — **a mesma classe nos dois padrões**.

**Não normalizar o texto extraído** (`D-06`). Trocar todo travessão por hífen antes de casar
alcançaria `_PROPOSTA`, `_PROCESSO`, `_REFERENCIA` e as descrições de item — quatro coisas que
funcionam, para corrigir uma.

**O vocabulário não se mexe** (`D-04` da ESPEC 034). `Fundação` já está lá, por antecipação, e a
antecipação funcionou: só o traço barrava.

**Pronto quando:** `T-2256` verde nas oito, e `T-2257` verde se a fixture já estiver aqui.

> **Executada — 2026-08-31.** `_TRACO` passou a ser uma classe — hífen, hifens
> tipográficos, en dash, em dash e sinal de menos —, aplicada a `_CLIENTE` **e** a
> `_SIGLA`.
>
> O `\s*` migrou para dentro da constante porque o separador real é o conjunto
> *espaço + traço + espaço*: o piloto grafa `Tecnologia- SMIT` sem o primeiro, o
> PGM `Paulo - PGM` com os dois.
>
> Vocabulário **intocado** (`D-04` da ESPEC 034): `Fundação` já estava lá por
> antecipação, e a antecipação funcionou — só o traço barrava.

---

#### T-2266 — Portão de capa `[portão]`
**Tamanho:** PP · **Ref:** **P2**

Os oito nomes da `T-2251` idênticos; os três `''` continuam `''`.

> **Executada — `P2` fecha.** Oito de oito idênticos, os três `''` inclusive.

---

#### T-2267 — Canário de extração `[portão]`
**Tamanho:** PP · **Ref:** **P2**, regra 2

Os oito `sha` e `geom` idênticos. **Este épico não toca a grade** — a régua é canário, não alvo. É
barato, e já pegou surpresa antes.

> **Executada — `P2` fecha.** Os oito `sha` e os oito `geom` idênticos.

---

## 7. Épico E4 — A confirmação do mecanismo `[portão P3]`

> **Depende da `T-2252`.** Sem a fixture, a entrega para aqui, com `E2` e `E3` entregues.

> ### ✅ EXECUTADO — e **sem a fixture**, pelo próprio produto
>
> **A `E2` entregue antes da correção era o instrumento, e funcionou como tal.**
> A primeira submissão do FTM depois dela devolveu:
>
> ```
> V-CTR-03 … diferença de 51676.20 — e a grade descartou 93 palavras
> fora de qualquer linha da tabela, nas páginas 6 (77), 7 (16)
> ```
>
> **`T-2268` · A medição.** Página 7: **16 palavras**. Página 6: 77.
>
> **`T-2269` · O caminho A, confirmado por medição.** A linha `14.031.00018.00`
> tem exatamente **16 palavras** (`14.031.00018.00 · PERFIL · OFFICE · 365 · – ·
> EXECUTIVE · E1 · LICENÇA · ATIVA/ · MÊS · BRL · 45,33 · 95,00 · 12 · BRL ·
> 51.676,20`). Duas grandezas independentes — reais e palavras — apontam a mesma
> linha. **O caminho B fica descartado:** por ele a linha teria sido *lida*, e as
> palavras não apareceriam na conta.
>
> As 77 da página 6 são prosa: as oito linhas dela somam `128.532,13`, e
> `128.532,13 + 5.108,40` (a `E3`) `= 133.640,53`, exatamente o lido. Aquela
> página não perdeu item nenhum.
>
> **`T-2270` · `geom` do FTM: NÃO MEDIDO.** É a única metade que continua exigindo
> o binário, e é a régua do risco do PLANO §7. `T-2276` a substitui pelo que dá
> para medir aqui — os oito `geom` do corpus, idênticos.
>
> **`T-2271` · Não se aplica:** `T-2269` confirmou.

#### T-2268 — Medir o FTM
**Tamanho:** PP · **Ref:** ESPEC `T-01`

Com o contador da `E2` e com `scripts/diagnosticar_linha_perdida.py <ftm> 7`. Registrar neste
documento: `horizontais[0]` da página 7, as palavras descartadas, `geom`, itens e total.

**Pronto quando:** os cinco números estão escritos aqui.

---

#### T-2269 — Confirmar o caminho A `[portão]`
**Tamanho:** PP · **Ref:** **P3**, ESPEC §2.3

Confirmar que:

1. `horizontais[0]` da página 7 fica **abaixo** da linha `E1`;
2. o `14.031.00018.00` está entre as palavras descartadas;
3. a extração de hoje é **9 itens**, `133.640,53`.

**Reprovando, é o caminho B**, e o que se sabe dele está na ESPEC §2.2: `celulas[COL_CODIGO]` não
casa `_CODIGO_EXATO` e o laço faz `continue`. A ESPEC §2.3 percorre por que isso não deveria
acontecer nesta página — se acontecer, é a §2.3 que está errada, não a medição.

---

#### T-2270 — Congelar o `geom` do FTM `[portão]`
**Tamanho:** PP · **Ref:** **P4**, regra 5, PLANO §7

O número de geometrias admitidas no FTM **antes** da correção. Esperado: `1` — a ESPEC §2.3 percorre
por que a do Cronograma Físico Financeiro não é admitida.

**É a régua do risco número um desta entrega.** `R-GRD-11` acrescenta uma linha à grade, e o crivo de
admissão avalia linhas. No corpus o risco é nulo por medição; **no FTM a fronteira é sintetizada de
fato**, e o número tem de sair igual na `T-2276`.

---

#### T-2271 — Se `T-2269` reprovar, parar `[portão]`
**Tamanho:** P · **Ref:** ESPEC §2.3, `D-05`

Emendar a ESPEC 035 para v1.1 com o mecanismo medido; substituir `R-GRD-11` e `R-GRD-12`; reabrir da
`E1`. **`R-GRD-10` e `R-CAP-16` ficam de pé** — valem nos dois cenários, e é o que a `D-05` afirma.

É o que a ESPEC 033 fez na v1.1, quando a medição derrubou a explicação da §2.3 sem derrubar a
correção.

---

## 8. Épico E5 — A fronteira superior `[portão P4]`

> ### ✅ EXECUTADO — o portão `P3` fechou, e a `E5` deixou de ser correção no escuro
>
> `T-2272` e `T-2273` em `_topo_da_linha_de_item`, função à parte no espírito de
> `_escolher_gabarito` e `_faixa_mais_estreita` — o crivo é provável sem abrir PDF,
> e é o único ponto onde `R-GRD-11` pode falhar em silêncio.
>
> **`T-2274` saiu de graça.** `cauda_da_pagina` lê o que está acima de
> `horizontais[0]`; sintetizada a fronteira, não há nada acima dela. Os dois
> crivos são **complementares** — *tudo na coluna de descrição* contra *código na
> coluna do código* —, e uma linha de item reprova o primeiro por construção. Foi
> por isso que ela sumia calada, e é por isso que a ordem não precisou de código.
>
> **`T-2276` fecha; `T-2275` não pode fechar aqui.** Os oito `sha`, os oito `geom`
> e a impressão digital do descarte **idênticos**. O que falta é a confirmação
> positiva — *o FTM lê 10 itens e fecha em 185.316,73* —, que exige o binário ou
> uma submissão pela tela.

#### T-2272 — A síntese, dentro de `montar_grade`
**Tamanho:** P · **Ref:** `R-GRD-11`, `D-01`, `D-02`

O espelho da síntese de rodapé, **no mesmo lugar dela**. O crivo é **código de serviço na coluna do
código** entre as palavras órfãs.

**Dentro de `montar_grade`, e não numa função nova.** Separá-las poria a mesma decisão em dois
lugares — é o argumento que a `T-1107` já usou para tirar de lá a contagem de divisórias. E uma
variante "sem síntese" para o crivo de admissão seria duas grades para a mesma página, com a
discordância invisível.

**Pronto quando:** `T-2258` verde e `T-2254` verde.

---

#### T-2273 — O tudo-ou-nada de `R-GRD-12`
**Tamanho:** PP · **Ref:** `R-GRD-12`, `D-03`

Um único código, e nenhuma palavra acima da linha visual dele. Não sendo, **não sintetiza** — a
página vai para o contador da `E2` e `V-CTR-03` a nomeia.

**É a `D-02` da ESPEC 032 outra vez:** sintetizar sobre um bloco que tem cauda *e* linha de item
juntaria as duas na mesma célula e produziria descrição que **parece** certa, num documento que vai
ao órgão. Não ocorre em peça nenhuma; o custo de recusar é o comportamento de hoje.

---

#### T-2274 — A ordem no extrator
**Tamanho:** PP · **Ref:** `R-CON-06`, `D-04`

`R-GRD-11` decide **antes** da costura da cauda. Sintetizada a fronteira, não há órfãs, e
`cauda_da_pagina` devolve vazio por construção.

**A ordem é o que garante exclusão mútua.** Rodando depois, a cauda veria as mesmas palavras e as
recusaria pelo crivo de coluna — e o resultado passaria a depender de quem olhou primeiro.

---

#### T-2275 — O FTM fecha `[portão]`
**Tamanho:** PP · **Ref:** **P4**

10 itens, `185.316,73`, `V-CTR-03` **cala**, `V-CAP-01` **cala**, `palavras_descartadas` zero.

---

#### T-2276 — Os oito `sha` e os `geom` `[portão]`
**Tamanho:** PP · **Ref:** **P4**, regras 2, 3 e 5

Os oito `sha` da `T-2250` **idênticos**, os `geom` idênticos, e o `geom` do FTM igual ao da
`T-2270`.

**Qualquer `sha` movido é linha inventada até prova em contrário.** É a regra 3, e este é o único
lugar onde ela é verificável.

---

#### T-2277 — As três caudas `[portão]`
**Tamanho:** PP · **Ref:** **P4**, `R-CON-06`

`T-2255` verde: `contrato.pdf` p27 e p28 e `contrato_pgm.pdf` p23 continuam costuradas, e nenhuma
fronteira foi sintetizada nelas.

---

## 9. Épico E6 — As duas suítes `[portão P5]`

#### T-2278 — Backend completo
**Tamanho:** PP · **Ref:** **P5**

`python -m pytest`. 1.482 na entrada mais os desta entrega; o número de saída vira **número
declarado**.

> **Executada duas vezes.** Ao fim da `E3`: `1511 passed`. Ao fim da `E5`:
> **`1517 passed, 1 warning in 1142.77s`. Zero falhas.**
> 1.482 na entrada mais 35 desta entrega. **1.517 é o número declarado.**
>
> **E ela desmente a linha de base da `T-2249`:** o
> `test_desempenho.py::test_o_custo_de_um_anexo_e_linear`, que lá reprovou com
> `2.69x`, passa aqui. Confirma que a falha era carga concorrente, e não regressão
> — nesta execução nada mais rodava na máquina.

---

#### T-2279 — Navegador completo `[risco]`
**Tamanho:** PP · **Ref:** **P5**

`npx playwright test`, com o backend no ar. Comparar contra a lista da `T-2249`: falha nova reprova;
o `I-06` e a intermitente do `I-05` **não**.

> **Executada — `119 passed, 1 failed` em 20,3 min. Nenhuma falha nova.**
>
> A única vermelha é `a11y-estrutura.spec.ts:252 › T-543 — 14.049.00054.00
> aparece na lista e na triagem` — o **`I-06` do TASKS 033**: determinística,
> pré-existente, provada de outra entrega. É a mesma linha de base que a `T-2224`
> da ESPEC 034 registrou (`119 / 1`, o mesmo teste).
>
> A intermitente do `I-05` (`a11y-axe.spec.ts:38 › 390 px`) **não** apareceu desta
> vez, e é o comportamento que o TASKS 032 já descreve: aparece e some entre
> execuções.
>
> **A armadilha da porta apareceu de novo — e desta vez não era órfã.** A 8000
> estava ocupada e o `uvicorn` desta sessão morreu com `Errno 10048`. O processo
> era o servidor de desenvolvimento do próprio usuário (`--reload`), que **já
> havia recarregado** as mudanças da `E5`. Rodar contra ele foi correto, e o
> `curl` de `200` mais o `--reload` são a conferência que substituiu o
> `grep -c ERROR` de um log ao qual esta sessão não tinha acesso.
>
> **A `T-2244` mandava conferir o log, não a porta. Esta acrescenta: conferir de
> quem é o processo antes de matá-lo.** Matar aquele `uvicorn` teria derrubado o
> ambiente em que o usuário mediu a `T-2269`.

**Conferir o log do servidor, não a porta** — `grep -c ERROR` antes de rodar. Porta que responde não
prova que responde o seu código; foi o que a `T-2244` da ESPEC 034 descobriu com um worker
`multiprocessing` órfão segurando o socket.

**Não deduzir que a suíte não se moveu.** Esta entrega muda a mensagem de `V-CTR-03` e o nome do
cliente na capa, e as duas coisas são tela.

---

#### T-2280 — Nada foi reancorado `[portão]`
**Tamanho:** PP · **Ref:** **P5**

`test_identidade_dos_artefatos.py`, `test_docx_formatacao.py`, `pacote.py`,
`linhas_do_documento.json` e `valores_do_contrato.json` **intocados** no `git status`.

**A árvore está limpa nesta entrega** (regra 1), então o `git diff` é só desta — sem a ressalva que o
PLANO 034 §7 precisou fazer.

> **Executada — `P5`.** O `git diff` são **quatro** arquivos de `src/`, 152
> inserções e 6 deleções — as seis são as linhas substituídas (`_CLIENTE`,
> `_SIGLA`, a `f-string` de `V-CTR-03`).
>
> `test_identidade_dos_artefatos.py`, `test_docx_formatacao.py`, `pacote.py`,
> `linhas_do_documento.json` e `valores_do_contrato.json` **não aparecem no
> `git status`**.
>
> **Regra 4 conferida no diff:** nenhuma linha de `_linhas`, `_e_item_completo`,
> `_geometrias_de_itens` ou da assinatura de `ler_celulas` foi tocada.

---

#### T-2281 — `ruff` e `mypy`
**Tamanho:** PP · **Ref:** **P5**

Sobre os arquivos tocados. O `I001` de `test_divergencia_de_fonte.py` é anterior a esta entrega e às
três anteriores; **não corrigir aqui**.

> **Executada.** `mypy src/` com `Success: no issues found in 55 source files`.
> `ruff` limpo nos cinco arquivos desta entrega — houve um `I001` no módulo de
> teste novo, corrigido com `--fix`. O `I001` de `test_divergencia_de_fonte.py`
> ficou como estava.

---

#### T-2282 — `README.md`, `CHANGELOG.md`, `Status` e o destino do script
**Tamanho:** PP

A linha do incremento 035; a entrada de rumo; e o `Status` da ESPEC 035 para **Implementada**, com os
números medidos.

A entrada do `CHANGELOG` tem de dizer o **achado estrutural**: `montar_grade` sintetiza fronteira no
rodapé desde a ESPEC 001 §9.4, e a metade de cima nunca foi escrita — não por decisão, mas porque
nenhuma peça da amostra tinha linha de item acima da primeira fronteira. E que **a extração
descartava palavra sem contar**, o que fez o diagnóstico depender de aritmética sobre o valor
declarado.

> **Executada — 2026-08-31, com o `Status` refletindo a entrega parcial.**
>
> Linha do incremento 035 no `README.md`, marcada **Parcial**; entrada de rumo no
> `CHANGELOG.md` com o achado estrutural e com a correção de régua da `T-2253`;
> `Status` da ESPEC 035 para **Parcialmente implementada** e `Versão` para
> **1.1** — a §8.2 dela pedia zero, e a medição a corrigiu.
>
> **O script ficou.** `scripts/diagnosticar_linha_perdida.py` continua não
> versionado por enquanto: ele é o instrumento da `T-2268`, e decidir removê-lo
> antes de a `E4` rodar seria jogar fora a ferramenta na véspera de usá-la.

**Decidir o destino de `scripts/diagnosticar_linha_perdida.py`:** versionar ao lado de
`medir_extracao.py` e `diagnostico_grade_contrato.py`, ou remover. Com o contador da `E2` entregue,
parte do que ele faz passa a existir no produto — mas o detalhamento por linha e por faixa, não.

**Verificação:** `P5`.

---

## 10. Insumos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | **O `PA-FTM-251001-143 v1.0.pdf` não está no repositório.** É a peça do defeito, e sem ela não há `T-01`, nem `R-GRD-11` exercitada, nem fixture de suíte | **Sim, da `E4` em diante.** `E0` a `E3` correm sem ele, e entregam duas das três correções |
| `I-02` | Por que o gerador omitiu a moldura superior nessa folha e não nas outras? Saber ajudaria a prever o próximo caso | Não. A correção trata o efeito, e o crivo é o código de serviço |
| `I-03` | Uma linha de item pode ficar acima da moldura **e** quebrar de página ao mesmo tempo, juntando `R-GRD-11` e `R-CON-01`? Não ocorre em peça nenhuma | Não — `R-GRD-12` recusa o caso misto, e o resultado é o de hoje |
| `I-04` | O contador de `R-GRD-10` deveria alimentar um `V-CTR-07`, que avisasse mesmo com o checksum fechando? | Não. Hoje o checksum é a prova; validação sem caso real é regra que envelhece sozinha |
| `I-05` | Há outros travessões tipográficos nas capas — `‒`, `―`? Só o `–` tem documento real | Não. Os demais entram na classe por antecipação, como o vocabulário da ESPEC 034 `D-04` |

**Herdados, e não desta entrega:** o `I-04` do TASKS 033 — o hook de pré-commit casa
`SMIT.*Levantamento.*\.xlsx` e não pegaria a planilha do SMUL nem a do FTM — o `I-06` do TASKS 033,
a contradição entre `a11y-estrutura.spec.ts:252` e `analise.spec.ts:183`, e o `I-05` do TASKS 032, a
intermitente do `a11y-axe.spec.ts:38`.

---

## 11. Emenda de execução

**2026-08-31.** Executadas **29 de 35**; a `T-2271` ficou sem objeto porque a `T-2269` confirmou.
Backend **1.482 → 1.517 passed**, zero falhas.

**Quatro pendências, e todas têm a mesma causa:** `T-2252` (a fixture), `T-2258` (as dez linhas),
`T-2270` (o `geom` do FTM) e `T-2275` (a confirmação positiva) exigem o binário do documento.
Nenhuma delas é código; as três regras estão implementadas e a não-regressão é integral.

**A ordem das fases foi o instrumento, e é o achado desta entrega.** O PLANO §1 abriu com *"o
arquivo do defeito não está aqui, e a ordem das fases é a resposta"*, e mandou o contador antes da
correção. Entregue a `E2` sozinha, o FTM continuava bloqueando — mas a mensagem passou a dizer *"a
grade descartou 93 palavras nas páginas 6 (77), 7 (16)"*.

**Dezesseis é o número exato de palavras da linha `14.031.00018.00`.** Duas grandezas independentes
— reais (`51.676,20 = 45,33 × 95 × 12`) e palavras (16) — apontando a mesma linha. O mecanismo saiu
de *estabelecido por eliminação* para *medido*, **sem o binário, sem script e sem sessão de
análise**: o próprio produto respondeu a pergunta que a `E4` existia para fazer.

Era hipótese quando o plano foi escrito; virou fato na execução. **Vale como padrão: quando o
diagnóstico depende de um insumo que não se tem, entregar primeiro o instrumento que o mede.**

**O backlog pediu a régua errada, e a medição a corrigiu.** A `T-2253` mandava afirmar *"o corpus
acusa zero palavra descartada"*. Não acusa: nove páginas descartam prosa — 177 na página 25 do
piloto, 214 na 22 do PGM — e descartá-la está **certo**. Eu havia confundido, ao escrever o backlog,
a medição da ESPEC §2.4 (*zero páginas com **código de serviço** entre as órfãs*, que é o crivo da
`R-GRD-11`) com *zero palavras*. A régua virou a **impressão digital** do descarte, página a página,
e ela é mais forte que zero: pega uma fronteira sintetizada onde não devia **antes** de qualquer
`sha` se mover. Zero seria uma régua que nunca falha e nunca prova nada.

**A tabela de vermelhos declarados pegou isso, e ao contrário do esperado.** A `T-2231` da ESPEC 034
usou a tabela para pegar um teste que passava pelo motivo errado; aqui ela pegou uma **régua**
escrita pelo motivo errado — a previsão *"reprova por `ImportError`, depois afirma zero"* não podia
se cumprir, e foi tentar cumpri-la que revelou a confusão. **Declarar o vermelho esperado continua
valendo a linha que custa.**

**E a ordem teste→código foi invertida numa tarefa, de propósito.** O contador da `E2` foi escrito
**antes** da sua régua, porque a régua tinha de ser medida e a medição exigia a função. Forçar a
ordem teria produzido um teste que afirma um número inventado. Nos outros casos — os oito nomes de
órgão, as caudas, a redação da mensagem — a ordem valeu e foi seguida.

**A armadilha de operação desta entrega não foi a porta; foi a carga.** A linha de base da `T-2249`
saiu `1 failed, 1481 passed`, e a falha era `test_o_custo_de_um_anexo_e_linear` — `2.69x` contra o
limite `2.6`. Eu rodei `medir_extracao.py` e outras medições **em paralelo** com a suíte, na mesma
máquina. Um teste de razão de custo não distingue regressão de vizinho barulhento. A execução limpa
da `T-2278` passou. A `T-2244` da ESPEC 034 escreveu *"conferir o log do servidor, e não a porta"*;
esta acrescenta: **rodar a suíte sozinha, ou não chamar o resultado de linha de base.**

**Uma correção de redação na execução.** O sufixo de `V-CTR-03` saía `…na página 7 (14)` para uma
página só, repetindo entre parênteses o número que a frase acabara de dar. Passou a ramificar. É
mensagem que vai para quem confere um documento que vai ao órgão; um número repetido faz procurar
uma diferença que não existe.

**O que não se moveu, e é o que dá direito de entregar:** os oito `sha` de extração, os oito `geom`,
os oito nomes de órgão, a mensagem de `V-CTR-03` quando não há descarte — byte por byte —, e as três
caudas da ESPEC 032. `ler_celulas`, `_linhas`, `_e_item_completo` e `_geometrias_de_itens` intocadas
no diff. Nenhum artefato reancorado.

**A `E5` foi escrita depois da confirmação, e não antes.** `_topo_da_linha_de_item` é função à
parte, no espírito de `_escolher_gabarito` e `_faixa_mais_estreita`: o crivo é provável sem abrir
PDF, e é o único ponto onde `R-GRD-11` pode falhar em silêncio — falhar ali significa **inventar uma
linha de item a partir de prosa**.

**E a `R-CON-06` saiu de graça.** `cauda_da_pagina` lê o que está acima de `horizontais[0]`;
sintetizada a fronteira, não há nada acima dela. Os dois crivos são complementares — *tudo na coluna
de descrição* contra *código na coluna do código* —, e uma linha de item reprova o primeiro por
construção. Foi por isso que ela sumia calada, e é por isso que a ordem não custou uma linha de
código.

**Para fechar:** pôr o `PA-FTM-251001-143 v1.0.pdf` em `backend/tests/fixtures/aditivo_ftm.pdf` e
rodar `T-2258`/`T-2275` — ou submeter pela tela, que foi como a `T-2269` se resolveu.
