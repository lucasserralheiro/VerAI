# PLANO 037 — Implementação de "A linha de dados que virou cabeçalho"

| | |
|---|---|
| **Especificação** | [ESPEC 037](../specs/037-a-linha-de-dados-que-virou-cabecalho.md) v1.0 |
| **Versão** | 1.0 — 2026-08-31 |
| **Backlog** | TASKS 037, a escrever. Numeração continua de `T-2314`, a última do PLANO 036 — os `T-` deste plano começam em **`T-2315`** |
| **Estado inicial** | Ramo `feature/evolucao`, `HEAD` em `24acc9e`. **A árvore carrega duas entregas não commitadas:** a ESPEC 035 e a ESPEC 036, esta última **incluindo a reancoragem do `PACOTE_DO_PGM`**. Backend: **1.527 testes coletados**, medido nesta árvore em 2026-08-31 |
| **Colisão conhecida** | **Diferente do PLANO 036, aqui a sobreposição de arquivo é real** — `annex_validations.py` (criado pela 036, ainda não rastreado), `container.py`, `test_identidade_dos_artefatos.py`, `docs/specs/004`, `README.md` e `CHANGELOG.md` são tocados pelas duas. E o `PACOTE_DO_PGM` será reancorado **pela segunda vez sem nunca ter sido commitado**. §7 |
| **Instrumento existente** | `backend/tests/pacote.py::partes`. As fixtures de sessão `docx_do_piloto`, `documento_do_pgm` (~115 s) e `anexos_do_pgm` (`test_anexo_sem_conteudo.py:237`). `test_docx_anexos.py:38` já traz `_tem_cabecalho_repetido(fileira)` — o instrumento da rede do §8.2 da espec **já existe**, e nunca foi apontado para a identidade da fileira. `AnexoReader` serve de sonda direta: resolver os 35 índices das duas planilhas custa ~10 s e **não renderiza nada** |

---

## 1. O que este plano tem de diferente dos anteriores

> **As duas metades não se separam, e o plano não finge que separam.**
> No PLANO 036 o critério (`F2`) podia ser entregue sem mover um byte, e a omissão (`F3`) só
> executava o veredito. Aqui não há esse corte: a resolução por âncora **é** o que move os cinco
> cortes do PGM. O que substitui a separação é uma **sonda que roda antes de existir documento** —
> 35 índices, ~10 s, sem renderizar. Ela nomeia exatamente o que mudou e o que não mudou, e é o
> portão que decide a entrega.

> **O catálogo é inerte por construção, e isso é aproveitado.**
> `anexos_configurados()` lê chaves nomeadas do JSON; uma chave nova é ignorada até alguém a ler.
> Então as 19 âncoras entram na `F1` **sem mudar nada**, e é isso que permite escrever a rede do
> §8.2 da espec — *"toda fileira marcada tem rótulos declarados"* — e vê-la reprovar em **cinco
> anexos nomeados do PGM** antes de uma linha de resolução existir.

> **O hash do piloto é o oráculo do falso positivo, e aqui ele é mais afiado que na 036.**
> No piloto, as 19 âncoras têm de resolver **no mesmo número** que a configuração traz hoje
> (`R-CAB-06`): o documento tem de sair idêntico, entrada por entrada. Qualquer movimento no
> `PACOTE_DO_PILOTO` significa que a resolução mexeu num índice que estava certo — e não há segundo
> lugar onde procurar.

> **Não tocar o renderizador.**
> `docx_renderer.py` e `ooxml.py` não mudam (`D-04`). `linha_cabecalho = None` já significa "não
> marcar" nos **dois** caminhos — o corte e a comparação `anexo.linha_cabecalho == inicio` —, então
> a falha segura de `R-CAB-04` sai de graça. Um `git diff` que toque qualquer um dos dois reprova a
> revisão.

> **O achado entra nesta entrega, não na seguinte.**
> Hoje, uma planilha que renomeie o cabeçalho produz uma linha errada em cada página — feio, e
> **visível**. Depois da `F3` ela produz um anexo sem repetição, que é discreto e não denuncia nada.
> `F3` sem `F4` troca um defeito ruidoso por um defeito mudo. É o primeiro risco do §5.

> **A rede do §8.2 vale mais que os cinco casos que ela corrige.**
> As cinco fileiras erradas do PGM são o sintoma; o mecanismo que as produziu continua vivo depois
> da correção, e produzirá a sexta na próxima planilha. O que o impede é um teste que afirme uma
> **relação entre o documento e o catálogo**, e não um número. Se essa tarefa cair no corte, a
> entrega inteira perdeu o sentido.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Linha de base, régua congelada, o defeito nomeado** | Fim da `F0` | Os quatro pacotes reproduzidos **nesta árvore**, entrada por entrada. As duas formas medidas: piloto **21 seções, 39 tabelas, 20 fileiras marcadas, 0 erradas**; PGM **18 seções, 34 tabelas, 18 marcadas, 5 erradas**, com as cinco abas **nomeadas** e o texto de cada fileira transcrito. `1.527` coletados | Régua não reproduzida é régua de outra árvore — e esta tem **duas** entregas dentro (§7) |
| **P1 — O catálogo, documentariamente inerte** | Fim da `F1` | As 19 âncoras em `anexos.json`. **Os quatro pacotes idênticos à `T-2315`** — nada lê o campo novo ainda. A rede do §8.2 escrita, **verde no piloto e vermelha no PGM em exatamente cinco anexos, os cinco da `T-2317`**. `R-CAB-06` escrito e vermelho por `ImportError`, declarado | Pacote movido aqui significa que alguém antecipou a `F2`, e o portão perdeu o sentido |
| **P2 — A resolução, provada sem renderizar** | Fim da `F2` | A sonda dos 35 índices: **os 19 do piloto idênticos aos de hoje**; os 16 do PGM com **exatamente cinco movidos**, para os valores da ESPEC §8.4. `R-CAB-06` verde. Os seis casos construídos de `R-CAB-02`/`03`/`04` verdes | Reverter a `F2`. Um índice do piloto que se mova é um falso positivo, e a sonda é mais barata que o documento para descobri-lo |
| **P3 — Os documentos** | Fim da `F3` | `PACOTE_DO_PILOTO` **idêntico**, entrada por entrada. PGM: **18 seções, 34 tabelas, 18 fileiras marcadas** — os três números **inalterados** —, e a rede do §8.2 **verde nos dois**. `PACOTE_DO_PGM` movido **só** em `word/document.xml`, com delta provado por desligamento | Reverter. Tabela ou seção a mais ou a menos no PGM é conteúdo perdido, não cabeçalho corrigido |
| **P4 — O achado** | Fim da `F4` | `V-ANX-02` dispara com anexo **com conteúdo** e sem âncora (**um** achado, `AVISA`) e cala com anexo **vazio** sem âncora. Achados dos dois pares **inalterados**, lista por lista | Reverter a `F4`. Achado novo em par versionado é ruído entregue em produção |
| **P5 — O conjunto** | Fim da `F5` | Backend verde, **≥ 1.527** mais os testes novos. `ruff` e `mypy` limpos nos arquivos tocados. **`git diff` sem `docx_renderer.py` e sem `ooxml.py`.** Nenhum artefato reancorado além do `PACOTE_DO_PGM` | Não entregar |

---

## 3. Fases

### F0 — Linha de base, régua e o defeito nomeado `[portão]`

**Objetivo:** congelar o que não pode mudar e **transcrever o defeito**, antes de escrever código.
A `T-2317` é o coração desta fase: sem as cinco fileiras nomeadas e com o texto copiado, a `F3` não
tem como provar que corrigiu o que se propôs a corrigir.

| # | Tarefa | Ref. |
|---|---|---|
| T-2315 | **Reproduzir os quatro pacotes nesta árvore**: `PACOTE_DO_PILOTO`, `PACOTE_DO_PGM`, `ANALISE_DO_PILOTO`, `ANALISE_DO_PGM`, entrada por entrada. O do PGM foi reancorado pela 036 **nesta árvore e não commitado** — reproduzir é o que separa *"a 036 declara"* de *"eu conferi"* | **P1**, **P3**, §7 |
| T-2316 | Linha de base: `python -m pytest` completo, número declarado. Coletados hoje: **1.527** | **P5** |
| T-2317 | **Congelar o defeito**: renderizar os dois pares e listar toda fileira com `w:tblHeader`, com o texto das sete primeiras células. Esperado — piloto **20 marcadas, 0 erradas**; PGM **18 marcadas, 5 erradas**: `Servidores` (`D84V50I \| 1 \| 2 \| 80 …`), `ServidoresSemDesenv` (`C68V13I \| 2 \| 4 \| 70 …`), `SDWAN` (`LINK DE CONECTIVIDADE …`), `SOA` (`SN1403 \| PIDE-PLANO … \| 944`), `Office365` (`PERFIL POWER BI PRO \| … \| 10 \| 5 \| 0 \| 5 \| 5`) | **P0**, **P3** |
| T-2318 | **Congelar a forma**: piloto 21 seções / 39 tabelas; PGM 18 / 34. Reproduzir, não copiar | **P3** |
| T-2319 | Executar as buscas do §8 sobre `backend/` e `frontend/`. **O resultado manda na tabela da ESPEC §8.4**, e não o contrário | **P0** |

> **A `T-2317` mede um artefato que já contém a ESPEC 036.** As 18 seções e 34 tabelas do PGM são o
> estado **pós-036**; medir contra o `HEAD` daria 21 e 34, e a comparação da `F3` acusaria uma
> mudança que não é desta entrega. §7.

**Verificação:** `P0`. **Tamanho:** PP — meia hora, mais duas renderizações de PGM.

---

### F1 — O catálogo e a rede que faltava `[portão]`

**Objetivo:** pôr as âncoras no JSON e escrever o teste que reprova o defeito — **os dois sem mudar
um byte de documento**.

| # | Tarefa | Ref. |
|---|---|---|
| T-2320 | Script de transcrição em `scripts/`, no molde de `medir_anexos_grc.py`: lê o piloto, resolve os rótulos da `linha_cabecalho` de cada anexo, descarta as células vazias e emite os três primeiros. **A revisão é humana; a transcrição não** | `D-07` |
| T-2321 | `anexos.json`: campo `cabecalho` nos 19 anexos, com a saída revisada da `T-2320`. `linha_cabecalho` **fica** (`R-CAB-05`) | `R-CAB-01`, `R-CAB-05` |
| T-2322 | **[portão]** Os quatro pacotes **idênticos** à `T-2315`, e `1.527` ainda coletados. `configuracao.py` lê chaves nomeadas: o campo novo é inerte até a `F2` | **P1** |
| T-2323 | **A rede do §8.2**, em `test_docx_anexos.py` e no par do PGM: **toda** fileira marcada ou traz os rótulos de `layout.CABECALHO_COLUNAS` (a comprovação), ou começa pela âncora de **algum** anexo de `anexos.json`. Usa `_tem_cabecalho_repetido`, que já existe | `§8.2` da espec |
| T-2324 | `R-CAB-06`: para os 19 anexos do piloto, `localizar_cabecalho` devolve `linha_cabecalho - 1`. Reprova hoje por `ImportError`, e isso é **declarado** aqui | `R-CAB-06`, `D-03` |
| T-2325 | **[portão]** Rodar e conferir **como cada um reprova**: `T-2323` **verde no piloto** e **vermelho no PGM**, nomeando os cinco anexos da `T-2317`; `T-2324` por `ImportError` | **P1** |

> **A comprovação do PGM tem o cabeçalho na fileira 1, não na 0.** `_bloco_de_linhas` põe uma faixa
> de título no bloco final (ESPEC 018 `D-06`) e marca `tabela.rows[faixa]`. Um teste que assuma
> `rows[0]` para a comprovação passa no piloto e falha no PGM por motivo errado — é a armadilha desta
> fase, e é por isso que a `T-2323` compara **rótulos**, e não posições.

> **A `T-2323` compara contra a união das 19 âncoras, não contra a âncora daquele anexo.**
> É mais fraco, e é deliberado: dispensa mapear tabela → aba nos dois documentos, e ainda assim pega
> os cinco casos, porque uma linha de dados não casa âncora nenhuma. A forma forte — cada anexo
> contra a **sua** âncora — está disponível via `tabelas_por_anexo` e entra se a fraca deixar passar
> alguma coisa na `F3`.

**Verificação:** `P1`. **Tamanho:** P — uma hora.

---

### F2 — A resolução, provada sem renderizar `[portão]`

**Objetivo:** trocar o número pelo rótulo, e provar o resultado pela **sonda**, que custa ~10 s,
antes de gastar as renderizações da `F3`.

| # | Tarefa | Ref. |
|---|---|---|
| T-2326 | `infrastructure/annex/cabecalho.py`, arquivo novo: `localizar_cabecalho(linhas, ancora) -> int \| None`. Rótulos = textos não vazios, na ordem, comparados sem caixa e sem espaço nas pontas, **sem dobrar acento**; **prefixo**, não igualdade; **primeira** ocorrência, não única | `R-CAB-02`, `R-CAB-03`, `D-01`, `D-02` |
| T-2327 | `ConfiguracaoDeAnexo.cabecalho` e a docstring do módulo — a quarta coisa que o anexo declara deixa de ser um número. `AnexoReader._anexo` resolve pela âncora sobre `forma.linhas` | `R-CAB-01` |
| T-2328 | Os seis casos construídos de `R-CAB-02`/`03`/`04`, sobre `CelulaAnexo` — sem planilha, sem renderização: preâmbulo de 3, 8 e 20 linhas; `Nome` mesclado × não mesclado; caixa e espaço × acento; prefixo mais largo (`BD`); âncora em duas linhas (`NAS`); âncora ausente → `None` | `R-CAB-02` a `R-CAB-04` |
| T-2329 | **[portão]** A **sonda dos 35 índices**, sem renderizar: os 19 do piloto **idênticos** aos de hoje; os 16 do PGM com **exatamente cinco** movidos — `Servidores` 12→11, `ServidoresSemDesenv` 11→10, `SDWAN` 8→13, `SOA` 5→8, `Office365` 16→21 (0-based) | **P2** |
| T-2330 | **[portão]** `T-2324` verde. `T-2323` continua **vermelho no PGM** — o documento ainda não foi regerado nesta fase, e é a `F3` que o vira | **P2** |

> **A `T-2329` é o portão que decide a entrega.** Ela responde às duas perguntas que importam —
> *"mexi em algum índice que estava certo?"* e *"os cinco mudaram para os valores previstos?"* — em
> dez segundos e sem ambiguidade. Um índice do piloto fora do lugar aqui **reprova antes** de custar
> ~115 s de renderização de PGM, e antes de alguém ser tentado a explicar um hash movido.

> **`R-CAB-04` sai de graça, e é preciso conferir que saiu.** Com `linha_cabecalho = None`, `corte`
> devolve `None` e `anexo.linha_cabecalho == inicio` é `False`: os dois caminhos do renderizador
> deixam de marcar sem uma linha nova. A `T-2328` afirma isso pelo documento, não pela leitura do
> código.

**Verificação:** `P2`. **Tamanho:** PP — meia hora.

---

### F3 — Os documentos e a única reancoragem `[portão]`

**Objetivo:** confirmar no artefato o que a sonda já provou, e trocar **um** hash com a justificativa
que o cabeçalho de `test_identidade_dos_artefatos.py` exige.

| # | Tarefa | Ref. |
|---|---|---|
| T-2331 | **[portão]** `PACOTE_DO_PILOTO` **idêntico** à `T-2315`, entrada por entrada. Sem exceção e sem reancoragem | **P3**, `D-08` |
| T-2332 | **[portão]** PGM: **18 seções, 34 tabelas, 18 fileiras marcadas** — os três números da `T-2317`/`T-2318` **inalterados**. Nenhum corte novo é atravessado por mesclagem, então nenhum anexo passa de duas tabelas para uma | **P3**, `R-CAB-07` |
| T-2333 | **[portão]** `T-2323` **verde nos dois pares**: as cinco fileiras da `T-2317` deixaram de ser linha de dados e passaram a ser o cabeçalho de colunas | **P3** |
| T-2334 | **Prova por desligamento**: forçando `localizar_cabecalho` a devolver `config.linha_cabecalho - 1`, o `PACOTE_DO_PGM` volta ao valor da `T-2315`, entrada por entrada. Só então reancorar | **P3**, §7 |
| T-2335 | Reancorar `PACOTE_DO_PGM` e escrever a justificativa no cabeçalho de `test_identidade_dos_artefatos.py` — **abaixo** do parágrafo que a 036 acabou de escrever, e sem reescrevê-lo (§7) | **P3** |
| T-2336 | Conferir que `test_docx_anexos` passa **sem alteração**: `test_usuarios_se_parte_em_preambulo_e_corpo` (7 e 1.014 fileiras), `test_o_cabecalho_de_usuarios_se_repete` e `test_a_marca_de_cabecalho_cai_na_primeira_fileira_da_tabela`. Todos rodam sobre o piloto, onde nenhum índice se move | **P3** |

> **`docProps/app.xml` é candidato a se mover junto**, e a espec §8.4 diz *"a medir, não a prever"*.
> Se ele se mover, a `T-2335` explica por quê; se outra entrada qualquer se mover, **o portão
> reprova** até haver explicação.

> **A `T-2334` é a única prova de que o delta é o previsto.** Reancorar porque o teste ficou vermelho
> é admitir a mudança sem saber o tamanho dela. Aqui ela é mais barata que na 036: basta uma linha
> de desligamento em `AnexoReader._anexo`, sem desfazer nada.

**Verificação:** `P3`. **Tamanho:** PP — vinte minutos de código, mais duas renderizações de PGM.

---

### F4 — O achado `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2337 | `v_anx_02_cabecalho_nao_localizado` em `annex_validations.py` — **arquivo que a 036 criou nesta árvore e ainda não commitou** (§7). Quatro partes (`R-DOC-05`), `AVISA`, **um** achado com a lista das abas | `V-ANX-02`, `D-06` |
| T-2338 | Registro no `DIContainer.gerar`, ao lado da chamada de `V-ANX-01` que a 036 pôs ali. Dispara só para anexo **com conteúdo**: `not anexo.vazio and anexo.linha_cabecalho is None` | `V-ANX-02` |
| T-2339 | **[portão]** `V-ANX-02` dispara com um anexo com conteúdo e sem âncora, e **cala** com anexo **vazio** sem âncora — esse é caso da `V-ANX-01`, e dois achados sobre o mesmo fato seriam a `R-GRD-06` violada | **P4** |
| T-2340 | **[portão]** Achados dos dois pares versionados **inalterados**, lista por lista. As 19 âncoras resolvem no piloto e as 16 presentes resolvem no PGM: `V-ANX-02` não dispara em nenhum | **P4** |
| T-2341 | Conferir a guarda da `T-2094`: ela varre **três** módulos nomeados, anteriores à ESPEC 029, e `annex_validations.py` não entra naquela lista — nem entrou pela 036. O que se afirma dele é `AVISA`, e quem o prova é a `T-2340` | §8 nº 6 |

> **`V-ANX-02` é a razão de a `F3` não poder ir sozinha para `main`.** Antes desta entrega, uma
> planilha com o cabeçalho renomeado produzia uma linha errada em cada página — errado, e visível.
> Depois da `F3` e sem a `F4`, produz um anexo sem repetição: correto, discreto, e mudo.

**Verificação:** `P4`. **Tamanho:** PP — vinte minutos.

---

### F5 — O conjunto `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2342 | Suíte de backend completa, número declarado, comparado com a `T-2316` | **P5** |
| T-2343 | `ruff` e `mypy` nos arquivos tocados | **P5** |
| T-2344 | **[portão]** `git diff` **sem `docx_renderer.py` e sem `ooxml.py`** (`D-04`); e sem `test_docx_formatacao`, `test_capa`, `pacote.py`, `linhas_do_documento.json`, `valores_do_contrato.json` e os dois `ANALISE_*` | **P5** |
| T-2345 | `test_anexos_configuracao`: os dois testes de `linha_cabecalho` **continuam valendo** (`R-CAB-05`) e ganham um par — toda entrada declara `cabecalho` não vazio | **P5** |
| T-2346 | ESPEC 004: nota em `R-ANX-11`, §4.1 e §4.2 remetendo à ESPEC 037 — **sem colidir com a nota que a 036 pôs no §9 do mesmo arquivo** (§7). `README.md`, `docs/CHANGELOG.md`, `Status` da ESPEC 037 | — |

> **A suíte de navegador não roda nesta entrega**, e a razão é a mesma que o PLANO 036 verificou e
> que a `T-2319` reconfirma: `Achado` é genérico em `frontend/src/lib/types.ts` (`validacao: string`,
> severidade em união de literais), nenhum arquivo de `frontend/` ou `api/` é tocado, e `V-ANX-02`
> não dispara em cenário versionado nenhum. Se qualquer uma das três cair, a suíte entra e este
> parágrafo sai.

**Verificação:** `P5`. **Tamanho:** PP — vinte minutos, mais o tempo da suíte.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3 ──► F4 ──► F5
P0     P1     P2     P3     P4     P5

F1  o catálogo entra e NADA muda            ← e a rede fica vermelha em 5 anexos nomeados
F2  a sonda: 30 índices parados, 5 movidos  ← o portão que decide a entrega, sem renderizar
F3  o artefato confirma, e um hash troca    ← a única reancoragem
F4  a planilha renomeada volta a ter voz    ← sem ela, F3 entrega um silêncio
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~2h30 de trabalho, mais três execuções de suíte completa (`T-2316`, `T-2325`, `T-2342`) e as quatro renderizações de PGM que `P0` e `P3` exigem |

**Nenhuma fase está bloqueada por decisão de negócio.** `I-01` e `I-02` da espec são posteriores à
entrega. O que pode travar é a `T-2315`, e é operacional: §7.

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| **Entregar a correção sem o achado**, e trocar um defeito visível por um mudo | Nada automático pega isso — é decisão humana, e por isso está no §1, na `F4` e aqui. A regra é: `F3` não vai para `main` sem `F4` |
| **A âncora transcrita errada mover um índice que estava certo** | Duas redes independentes: `T-2324` (`R-CAB-06`, contra a medição do GRC) e `T-2329`/`T-2331` (contra a sonda e contra o documento inteiro). A `T-2329` pega em dez segundos o que a `T-2331` pegaria em dois minutos |
| A âncora casar uma **linha de dados** que comece pelos mesmos rótulos | `T-2323` nos dois pares e `T-2324` no piloto. Se acontecer, a resposta é **alongar a âncora** — o campo aceita quantos rótulos forem precisos —, nunca trocar o mecanismo |
| **Perder a repetição num anexo que hoje a tem** | `T-2332`: 18 fileiras marcadas antes, 18 depois. Marca a menos é conveniência de leitura perdida em silêncio, e o número é o que a denuncia |
| **Perder tabela junto com o corte** — um corte novo atravessado por mesclagem faria `corte` virar `None` e o anexo cair de duas tabelas para uma | `T-2332`: 34 tabelas antes, 34 depois. Medido: nenhuma mesclagem atravessa os cinco cortes novos — mas medido não é asseverado, e o portão assevera |
| Reancorar o PGM sem saber o tamanho do delta | `T-2334`, a prova por desligamento. Reancoragem sem ela reprova a revisão |
| Mexer no renderizador para "resolver de vez" | `T-2344`, e `D-04`. A falha segura de `R-CAB-04` já existe nos dois caminhos; código novo lá seria código que ninguém pediu, na camada errada |
| **Apagar `linha_cabecalho` por parecer resíduo** | `R-CAB-05`, a `T-2324` que só se escreve com os dois, e o comentário obrigatório no `anexo_reader.py` explicando por que há dois. É o convite mais provável de uma revisão futura |
| A rede do §8.2 passar **antes** da correção | `T-2325`: ela tem de reprovar, e reprovar **nomeando os cinco**. Se passar na `F1`, está escrita errada — provavelmente comparando posição em vez de rótulo |
| Medir o "antes" numa árvore com 035 e 036 dentro | `T-2315`, `T-2317`, e §7 |
| Colidir com as edições da 036 em `annex_validations.py`, `container.py`, `test_identidade_dos_artefatos.py`, ESPEC 004, `README` e `CHANGELOG` | §7, e as tarefas que o dizem no corpo: `T-2335`, `T-2337`, `T-2338`, `T-2346` |

---

## 6. O que este plano não faz

- **Não toca `docx_renderer.py` nem `ooxml.py`** (`D-04`, `T-2344`).
- **Não toca `Anexo.corte` nem `Anexo.vazio`.** Só o comentário de `linha_cabecalho`, que passa a
  dizer *"resolvido na leitura"*.
- **Não repete cabeçalho de blocos secundários** — `NAS` linha 40, `OutrosServicos` 7 e 11. É o
  `I-01` da espec, e revisaria o corte da ESPEC 004 inteiro.
- **Não acrescenta aba nenhuma ao catálogo.** `Alta Plataforma`, `Impressao` e `ETL` continuam fora
  — é o `I-03` da ESPEC 036.
- **Não versiona o par do FTM** (`I-02`). A correção daquele caso continua sendo previsão
  fundamentada até alguém gerar o documento.
- **Não bloqueia geração nenhuma** (`D-06`). `V-ANX-02` é `AVISA`, e `bloqueado` não muda de valor
  em cenário nenhum.
- **Não toca o `frontend/`** nem os esquemas da API.
- **Não reancora nada além do `PACOTE_DO_PGM`** — e esse com a prova da `T-2334`.

---

## 7. Três entregas na mesma árvore, e a segunda reancoragem de um hash nunca commitado

É o ponto de operação mais afiado deste plano, e é **pior que o do PLANO 036**: lá a sobreposição de
arquivo era zero. Aqui não é.

```
HEAD 24acc9e ──► árvore de trabalho ──► esta entrega
                 ├─ ESPEC 035 dentro: grid.py, pdfplumber_extractor.py,
                 │  contract_validations.py, contract.py
                 └─ ESPEC 036 dentro: annex.py, docx_renderer.py, container.py,
                    annex_validations.py (NÃO RASTREADO), test_anexo_sem_conteudo.py,
                    test_docx_anexos.py, test_identidade_dos_artefatos.py (PGM REANCORADO),
                    docs/specs/004
                 + README.md e CHANGELOG.md, editados pelas duas
```

**Sobreposição de arquivo com a 036: quatro arquivos e três documentos.**

| Arquivo | A 036 fez | A 037 faz | Como não colidir |
|---|---|---|---|
| `annex_validations.py` | criou, com `v_anx_01` | acrescenta `v_anx_02` | Função nova ao lado, sem tocar a existente. **Arquivo não rastreado:** um `git checkout` descuidado o apaga inteiro |
| `container.py` | registrou `V-ANX-01` após a leitura dos anexos | registra `V-ANX-02` ali ao lado | Linha nova adjacente |
| `test_identidade_dos_artefatos.py` | **reancorou `PACOTE_DO_PGM`** e escreveu o parágrafo *"Reancorado só o PGM, em 2026-08-31, pela ESPEC 036"* | **reancora de novo** | `T-2335`: parágrafo **novo, abaixo**, sem reescrever o da 036. Os dois hashes contam a mesma história em dois passos, e apagar o primeiro apagaria a prova do primeiro delta |
| `docs/specs/004` | nota no §9 | notas em `R-ANX-11`, §4.1 e §4.2 | Seções diferentes do mesmo arquivo, editadas conscientemente |
| `README.md`, `CHANGELOG.md` | ambos, e a 035 também | ambos | `git diff` do arquivo antes de commitar |

**O `PACOTE_DO_PGM` será reancorado pela segunda vez sem nunca ter sido commitado.** A constante que
está no arquivo hoje é a da 036, medida nesta árvore em 2026-08-31 — **não** é a do `HEAD`. Duas
consequências operacionais:

1. a `T-2315` mede contra a árvore, e o valor que ela reproduz **é** o da 036. Medir contra
   `24acc9e` daria o pacote pré-036 e atribuiria a esta entrega um delta de três seções que não é
   dela;
2. a `T-2334` desliga **só** a resolução por âncora, e o pacote tem de voltar ao valor da `T-2315` —
   o da 036 —, não ao do `HEAD`.

**Se a `T-2315` reprovar** — algum pacote diferente das constantes do arquivo —, esta entrega
**para** antes da `F1`. Não se corrige a 035 nem a 036 dentro do PLANO 037: registra-se o achado,
resolve-se lá, e a `F0` recomeça.

**A prova por desligamento da `T-2334`, em ordem:**

1. com a `F2` entregue, medir `PACOTE_DO_PGM` → valor novo, e guardá-lo;
2. em `AnexoReader._anexo`, forçar o índice de volta a `config.linha_cabecalho - 1`, sem tocar
   `anexos.json` nem os testes → medir de novo;
3. o pacote tem de voltar **entrada por entrada** ao valor da `T-2315`;
4. desfazer o desligamento, conferir que o valor do passo 1 volta, e só então escrever a constante.

Duas renderizações de PGM a mais, ~4 min. É o mesmo procedimento das ESPECs 028 e 036, e o
desligamento aqui é **uma linha** — mais barato que o das duas anteriores.

---

## 8. O inventário, e as buscas

Sobre `backend/`:

| # | Busca | O que acha | O que já se sabe |
|---|---|---|---|
| 1 | `tblHeader`, `repetir_cabecalho`, `repetir=` | tudo que marca ou afirma a marca | `ooxml.py:157-165`; `docx_renderer.py:380,500,509,568`; `test_docx_anexos.py:38`. **Quatro lugares, e os três do renderizador não são tocados** (`D-04`) |
| 2 | `_tem_cabecalho_repetido`, `se_repete`, `cai_na_primeira_fileira` | os testes que já olham a marca | `test_docx_anexos.py:228,234,252`. **Todos afirmam posição, nenhum afirma identidade** — é exatamente a lacuna, e os três rodam só sobre o piloto. Passam sem alteração (`T-2336`) |
| 3 | `linha_cabecalho`, `Anexo(` | quem lê o número | `anexo_reader.py:54` (o único de configuração), `annex.py:122,189-195`, `docx_renderer.py:496`, mais **13 construções de `Anexo` à mão** em cinco arquivos de teste. **As construídas à mão não passam pelo leitor**: intocadas |
| 4 | `PACOTE_DO_`, `ANALISE_DO_`, `partes(` | as âncoras byte a byte | `test_identidade_dos_artefatos.py`, `pacote.py`. É a régua, e o do PGM é da 036 (§7) |
| 5 | `documento_do_pgm`, `artefatos_do_pgm`, `docx_do_piloto`, `anexos_do_pgm` | quem já paga renderização de sessão | `conftest.py:416+`, `test_anexo_sem_conteudo.py:237`. **Nenhuma renderização nova é criada** por esta entrega |
| 6 | `PERGUNTA`, `Severity.` | a guarda da `T-2094` | `test_identidade_contratual.py:388`. Varre **três** módulos nomeados; `annex_validations.py` não entra na lista, nem entrou pela 036 (`T-2341`) |
| 7 | `anexos_configurados`, `ConfiguracaoDeAnexo` | quem quebraria com campo novo | `anexo_reader.py`, `test_anexos_configuracao.py`, `test_docx_anexos.py:162`. O último só usa `.aba` |
| 8 | `CABECALHO_COLUNAS`, `_bloco_de_linhas` | a comprovação, que também marca | `layout.py:70`, `docx_renderer.py:350-380`. **`faixa = 1 if titulo else 0`** — no PGM a marca cai na fileira 1, e é a armadilha da `T-2323` |

Sobre `frontend/`:

| # | Busca | O que acha | O que já se sabe |
|---|---|---|---|
| 9 | `Achado`, `severidade`, `AVISA` | se a tela precisa conhecer a validação nova | `src/lib/types.ts:3-7` — `validacao: string`, severidade em união de literais. **Genérico: nada a fazer.** É o que autoriza não rodar a suíte de navegador (`F5`) |
| 10 | `cabeçalho`, `anexo` | asserção de tela sobre anexos | Esperado: nenhuma. Confirmar |

**O resultado das dez manda na tabela da ESPEC §8.4**, e não o contrário.

> **A busca 8 é a que engana.** A comprovação usa o mesmo `repetir_cabecalho` dos anexos, e no PGM
> ela marca a fileira **1** de uma tabela, não a 0. Um teste que trate as duas famílias como uma só,
> ou que assuma `rows[0]`, passa no piloto e falha no PGM por um motivo que nada tem a ver com esta
> espec — e a `F1` inteira perde a leitura.

---

## 9. Emenda de execução

*A preencher na execução, com o que o plano não previu.*