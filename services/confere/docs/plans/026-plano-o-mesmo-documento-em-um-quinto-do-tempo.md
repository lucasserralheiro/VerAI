# PLANO 026 — Implementação de "O mesmo documento em um quinto do tempo"

| | |
|---|---|
| **Especificação** | [ESPEC 026](../specs/026-o-mesmo-documento-em-um-quinto-do-tempo.md) v1.0 |
| **Versão** | 1.0 — 2026-08-19 — **proposto** |
| **Estado inicial** | **578 testes de backend**, verdes, em **26 min 54 s** · DOCX do piloto **22,1 s**, do PGM **96,6 s** · `insert_element_before` chamada **7×** por `ooxml.escrever` (medido) · `CT_Tc._tr_idx` chamada **10.452×** no piloto e **37.884×** no PGM · razão de escala da mesclagem **4,15×** ao dobrar as fileiras |
| **Instrumentos existentes** | `docx_do_piloto` (sessão, `conftest.py:283`) · `documento_do_pgm` **com aditivo** (sessão, mas **dentro de `test_capa.py:132`**) · `_partes()`, o comparador `sha256` por entrada do pacote, **dentro de `test_quantitativo_consolidado.py:130`**. Nenhuma fixture nova de arquivo: os cinco insumos já estão em `backend/tests/fixtures/` |
| **Numeração dos portões** | **Igual à da espec** — `P0` a `P4`, sem remapeamento. Foi possível porque a espec §9 já ordenou os portões pela execução |
| **Numeração das tarefas** | `T-2000` em diante; a última usada no repositório é `T-1937`. Os identificadores `T-2010`–`T-2012` e `T-2020`–`T-2024` são os que a ESPEC §8 já nomeou, e ficam **onde ela os pôs** — por isso a numeração não é monotônica dentro das fases |

---

## 1. O princípio que ordena este plano

Esta entrega não tem risco de regra de negócio: nenhuma validação muda, nenhuma mensagem muda,
nenhum campo da API muda. **Todo o risco está concentrado em um ponto só** — o documento sair
diferente —, e esse ponto é integralmente verificável por `sha256`.

Isso inverte a economia habitual de um plano. Onde a ESPEC 025 gastou fases distribuindo risco,
aqui a fase que decide tudo é a primeira, e ela não toca em uma linha de produção.

> **A âncora vem antes, ou a espec não tem critério de aceite.**
> `R-DES-01` afirma que o documento não muda. Uma constante `sha256` extraída **depois** da
> alteração ancora o resultado da alteração — passa sempre, e não afirma nada. A F0 mede e
> registra os *hashes* contra o código intocado, e só então a F2 começa. É a razão de `P0`
> preceder `P1` na espec §9, e é a única inversão de ordem que arruinaria esta entrega.

> **Os três defeitos que o protótipo teve não seriam vistos por teste de conteúdo.**
> `<w:t>` vazio a mais, `w:sz` arredondado em vez de truncado, `\t` literal em vez de `<w:tab/>`
> — nos três casos o texto lido de volta é o mesmo, as células estão nos mesmos lugares, a
> contagem de linhas não muda. Um `w:sz` de `10` em vez de `9` é **seis anexos com o corpo
> errado** — seis dos catorze corpos de `anexos.json` divergem entre truncar e arredondar, e `cell.text` não vê. A F2 não é aceita por leitura: é aceita por `sha256`.

> **As duas correções são independentes, e a ordem entre elas é uma escolha.**
> `escrever` (F2) e a mesclagem (F3) não se tocam: uma escreve dentro do `w:tc`, a outra mexe na
> estrutura das fileiras. Cada uma é publicável sozinha e cada uma se prova sozinha. `escrever`
> vem primeiro por ser a de maior ganho no piloto — que é o par que quase toda a suíte exercita
> — e por ser a de risco mais alto: melhor pagá-lo cedo, com o resto do plano inteiro pela
> frente para acusar.

> **A F1 escreve testes que devem ficar vermelhos, e isso é o produto dela.**
> `T-2010` e `T-2012` contam chamadas a interno de biblioteca. Escritos depois da correção,
> seriam tautologias verdes. Escritos antes, medem o defeito — e o número que eles imprimem ao
> falhar (7, 10.452, 37.884) é o que vai para o histórico da espec.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — A âncora existe e é do código de hoje** | Fim da F0 | `T-2020`, `T-2021` e `T-2022` **passam contra `src/` intocado**, com os `sha256` registrados como constantes no arquivo de teste. `git diff --stat backend/src` vazio | Não começar a F1. Sem isto, tudo o que vier depois é otimização com promessa, não com prova |
| **P1 — O defeito está medido, não suposto** | Fim da F1 | `T-2010` e `T-2012` **falham** contra o código de hoje, com as contagens da espec §2.2 e §2.3 | Se passarem, o diagnóstico da espec está errado e a entrega não deve prosseguir |
| **P2 — A meta de tempo** | Fim da F5 | `R-DES-08` medido à mão nos dois pares na máquina de referência: DOCX do piloto ≤ 8 s, do PGM ≤ 25 s | Não reverter: investigar. O protótipo entregou 5,3 s e 16,5 s, e a distância entre protótipo e produção é o que este portão existe para medir |
| **P3 — O conjunto** | Fim da F5 | **578 testes** verdes, contagem reconciliada com as tarefas novas · `mypy --strict`, `ruff`, `bandit` limpos · suíte de navegador sem falha nova | Não entregar |
| **P4 — Produção** | Depois | Uma geração real do par do PGM no `ca-confere-backend`, cronometrada, com o número registrado na espec §14 | Não bloqueia a entrega; bloqueia o encerramento da espec |

**O portão mais fácil de pular é o `P0`**, e por um motivo humano: ele não produz nada visível.
Escrever três testes que passam contra o código atual parece trabalho perdido. É o único trabalho
deste plano que não pode ser refeito depois.

---

## 3. Fases

### F0 — A âncora, e o lugar de onde ela lê `[portão P0]`

**Objetivo:** poder afirmar, ao final, que nada mudou. **Nenhum arquivo de `src/` é tocado.**

| # | Tarefa | Ref. |
|---|---|---|
| T-2000 | Promover `_partes()` — hoje privada de `test_quantitativo_consolidado.py:130` — para um utilitário compartilhado (`tests/pacote.py`). O teste de origem passa a importá-la, **sem alterar nenhuma asserção sua**. A exclusão de `docProps/core.xml` e o comentário que a explica viajam junto | ESPEC §2.7 |
| T-2001 | Mover `documento_do_pgm` (**com aditivo**) de `test_capa.py:132` para `conftest.py`, como fixture de sessão ao lado de `docx_do_piloto`. `test_capa` passa a recebê-la por injeção e não muda mais nada | §6 |
| T-2020 | `test_identidade_dos_artefatos.py`: `sha256` **por entrada** do pacote do piloto, contra um dicionário de constantes medido agora. Lê de `docx_do_piloto` | **P0**, `R-DES-01` |
| T-2021 | Idem para o par do PGM **com aditivo**. Lê da fixture da `T-2001` | **P0**, `R-DES-01` |
| T-2022 | `sha256` do `.xlsx` da análise dos dois pares. **Um só `sha256`, do arquivo inteiro**: o XLSX não é aberto de um modelo e não tem parte com carimbo | **P0**, `R-DES-01` |
| T-2002 | Medir o custo das três tarefas acima e registrar no cabeçalho do arquivo. Se `T-2021` custar uma renderização nova de PGM, a `T-2001` falhou no seu propósito | §6 |

**Verificação:** `P0`.

> **A `T-2001` é a tarefa que impede a suíte de piorar.** Hoje o DOCX do PGM é renderizado **três
> vezes** na suíte, por três fixtures diferentes: `test_capa.documento_do_pgm` (com aditivo),
> `test_linhas_derivadas.docx_do_pgm` (sem) e `test_anchor_por_codigo.pgm` (sem). São ~300 s. A
> `T-2021` seria a quarta. Mover a primeira para o `conftest` e ler dela custa zero; criar uma
> fixture nova custa 115 s por execução de suíte, para sempre.
>
> **As três não são o mesmo documento** — duas são sem aditivo —, então isto **não** é
> consolidação das três. É mover a que o `T-2021` precisa para onde ele a enxerga. Unificar as
> outras duas é assunto de outro dia (`I-34`).

> **Por que `sha256` por entrada, e não do arquivo inteiro.** Foi medido: o pacote é estável
> byte a byte entre processos, **inclusive `docProps/core.xml`** — o `dcterms:modified` vem do
> `modelo.docx` e o `python-docx` não o reescreve. Um `sha256` só bastaria. A escolha é por
> **mensagem de falha**: `word/document.xml difere` aponta para o defeito; `o arquivo difere` faz
> a próxima pessoa começar do zero. A exclusão de `docProps/core.xml` fica assim mesmo, por
> consistência com o teste que já existe e como cinto para o dia em que alguém escrever
> propriedades no documento.

**Tamanho:** P — três horas. **Encerra:** `P0`.

---

### F1 — Ver falhar `[portão P1]`

**Objetivo:** transformar o diagnóstico da espec §2 em asserção. **Nenhum arquivo de `src/` é
tocado.** As duas tarefas terminam **vermelhas**, de propósito.

| # | Tarefa | Ref. |
|---|---|---|
| T-2012 | `test_desempenho.py::test_escrever_nao_consulta_a_ordem_do_esquema` — `monkeypatch` em `BaseOxmlElement.insert_element_before` contando chamadas; afirma **zero** durante uma chamada a `ooxml.escrever`. **Hoje conta 7** | **P1**, `R-DES-03` |
| T-2010 | `test_desempenho.py::test_a_mesclagem_nao_varre_as_fileiras` — `monkeypatch` em `CT_Tc._tr_idx` e `CT_Tc._tr_below`; afirma **zero** durante `_tabelas_do_anexo` de um anexo com mesclagens. **Hoje conta 12 por mesclagem** | **P1**, `R-DES-04` |
| T-2003 | Registrar as contagens de hoje no *docstring* dos dois testes, com a data. É o número que a espec §14 vai citar | ESPEC §2.2, §2.3 |

**Verificação:** `P1` — os dois falham, com as contagens esperadas.

> **Os dois pontos de instrumentação foram verificados antes de virarem tarefa.**
> `BaseOxmlElement.insert_element_before` e `CT_Tc._tr_idx` são atributos de classe Python comuns
> (as classes do `lxml` via `ElementBase` aceitam `setattr`), e um `monkeypatch` sobre eles conta
> corretamente: 7 e 12 medidos. **Não é presunção**: um plano que descobrisse na F1 que o alvo
> não é instrumentável teria de reprojetar `P1` no meio da execução.

> **`T-2010` mede sobre `_tabelas_do_anexo`, e não sobre a renderização inteira.**
> `mesclar_linha` continua usando `_Cell.merge` (`R-DES-09`) no bloco de título, e são três
> células. Contar o documento inteiro daria um número diferente de zero por um motivo legítimo, e
> o teste teria de aceitar um teto arbitrário em vez de zero. Zero é uma asserção; "menos de 40"
> é uma opinião.

**Tamanho:** PP — duas horas. **Encerra:** `P1`.

---

### F2 — `escrever` emite o XML direto `[publicável sozinha]`

**Objetivo:** −12 s no piloto e −25 s no PGM. **Só `ooxml.py` é tocado.**

| # | Tarefa | Ref. |
|---|---|---|
| T-2023 | `test_desempenho.py::test_escrever_reproduz_a_api_publica` — a implementação de hoje é **copiada para o arquivo de teste** como `_escrever_de_referencia`, usando a API pública do `python-docx`. O teste monta duas células e compara `etree.tostring` do `w:tc`. Matriz da espec §8.2 | `R-DES-03`, `R-DES-06` |
| T-2004 | Reescrever `ooxml.escrever` (ESPEC §7). **Mesma assinatura, mesmo nome, uma função só** (`R-DES-11`) | `R-DES-03` |
| T-2005 | Os três casos da espec §2.5 explicitados como parâmetros nomeados de `T-2023` — `texto_vazio`, `corpo_4_8`, `com_tabulacao` — para que a falha nomeie o defeito | ESPEC §2.5 |
| T-2006 | Comentário de cabeçalho em `escrever`: por que o XML é montado à mão, qual é a ordem canônica do `w:rPr`, e que `T-2023` é quem guarda o acordo com a biblioteca | `R-DES-06` |

**Verificação:** `T-2012` fica verde. `T-2020`, `T-2021` e `T-2022` **continuam verdes** — é o
critério de aceite da fase. Suíte de backend inteira.

> **`T-2023` nasce trivialmente verde, e isso é correto.** Antes da `T-2004`, a referência e a
> implementação são o mesmo código, e o teste não afirma nada. Depois dela, as duas divergem por
> construção e a asserção passa a significar o que diz. É exatamente o padrão de
> `_sem_os_deltas` em `test_quantitativo_consolidado.py`, cujo *docstring* registra o mesmo
> raciocínio — *"antes da T-1610 os dois são idênticos (…) depois dela as asserções passam a
> significar o que dizem"*.

> **A referência não pode ser deletada depois.** A tentação, uma vez verde, é remover
> `_escrever_de_referencia` como código morto. Ela é o **único** ponto do repositório que ainda
> exercita a API pública do `python-docx` para escrita de *run*, e é o que vai acusar uma
> atualização da biblioteca (`R-DES-07`, espec §8.3). Fica com comentário dizendo isso.

**Tamanho:** M — meio dia. **Publicável sozinha.**

---

### F3 — A mesclagem recebe coordenadas `[publicável sozinha]`

**Objetivo:** −5 s no piloto e −80 s no PGM. **`ooxml.py` e `docx_renderer.py`.**

| # | Tarefa | Ref. |
|---|---|---|
| T-2024 | `test_desempenho.py::test_mesclar_regiao_reproduz_a_api_publica` — duas tabelas sintéticas idênticas, uma mesclada por `ooxml.mesclar` e outra por `mesclar_regiao`; compara o `etree.tostring` da **tabela inteira**. Matriz da espec §8.2 | `R-DES-04`, `R-DES-06` |
| T-2007 | `ooxml.mesclar_regiao(fileiras, topo, esquerda, altura, largura)`, com a descida vertical por índice (`D-04`). `_span_to_width`, `_swallow_next_tc` e `_move_content_to` são **reaproveitados como estão** | `R-DES-04`, `D-04` |
| T-2008 | `_mesclar_anexo` resolve `tabela._tbl.findall(qn("w:tr"))` **uma vez** e passa coordenadas. A limpeza dos parágrafos excedentes continua onde está | `R-DES-04` |
| T-2011 | `test_desempenho.py::test_o_custo_de_um_anexo_e_linear` — tabela sintética de 8 colunas, N=400 e N=800 fileiras, uma mesclagem de linha por fileira; afirma `t(800)/t(400) <= 2,6`. Marcado `@pytest.mark.lento`, **com o marcador registrado em `[tool.pytest.ini_options] markers`** — hoje a seção não declara nenhum, e marcador não registrado sai como aviso | `D-07` |
| T-2009 | `ooxml.mesclar` e `ooxml.mesclar_linha` **permanecem**, com comentário dizendo que servem ao bloco de título e por que não foram otimizadas | `R-DES-09` |

**Verificação:** `T-2010` fica verde, `T-2011` passa. As três âncoras da F0 **continuam verdes**.
`test_docx_anexos` inteiro, que é quem cobre mesclagem de anexo por comportamento.

> **A matriz de `T-2024` precisa incluir a mesclagem aparada.** `_mesclar_anexo` limita
> `ate_coluna` a `colunas - 1` (ESPEC 014 `R-BRD-05`), e a faixa vazia de `SOA` é o único caso
> real do piloto que passa por ali. Uma implementação nova que ignore o aparo produz XML
> diferente **em um anexo só**, e o `sha256` acusa sem dizer onde. `T-2024` diz.

> **Não reimplementar `_span_to_width`.** A tentação é reescrever a mesclagem horizontal junto,
> "já que estamos aqui". Ela é local aos irmãos, é barata, e é onde nasceria um defeito de
> fidelidade. `D-04` só autoriza reescrever o que é O(fileiras).

**Tamanho:** M — meio dia. **Publicável sozinha.**

---

### F4 — As limpezas do caminho e o teto de versão

**Objetivo:** o que estava no caminho e custa pouco. Nada aqui é o objetivo da espec.

| # | Tarefa | Ref. |
|---|---|---|
| T-2013 | `_tabela_do_anexo` resolve `tabela._cells` **uma vez** e o repassa a `fixar_larguras`, que hoje o resolve de novo (`ooxml.py:189` e `docx_renderer.py:534`) | ESPEC §2.6 |
| T-2014 | `pdfplumber_extractor`: o texto da página 1 é extraído uma vez e repassado a `_proposta`, `_cliente` e `_identificar`. O *docstring* de `_identificar`, que já afirma *"nenhuma página é aberta de novo"*, passa a ser verdade também para o texto | ESPEC §2.6 |
| T-2015 | `pyproject.toml`: `python-docx>=1.2.0,<2`; `uv lock`. Comentário citando `R-DES-07` e apontando para `T-2023`/`T-2024` como o que sustenta o teto | `R-DES-07` |

**Verificação:** âncoras da F0 verdes; suíte inteira.

> **A `T-2013` muda a assinatura de `fixar_larguras`, que é pública dentro do módulo.** É a única
> tarefa deste plano que altera uma interface. Vale ~0,25 s e entra porque está no caminho da
> F3 — se atrasar a fase, sai para outro dia sem prejuízo nenhum.

**Tamanho:** P — duas horas.

---

### F5 — Fechar `[portões P2, P3 e P4]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2016 | **[portão]** Medir `R-DES-08` nos dois pares, na máquina de referência, com o processo em repouso. Registrar em ESPEC §14 | **P2** |
| T-2017 | **[portão]** Suíte de backend inteira com `--durations=12`, contagem reconciliada; `mypy --strict`, `ruff`, `bandit`; `pnpm exec playwright test` | **P3** |
| T-2018 | Registrar o novo tempo de suíte em ESPEC §8.5, ao lado da linha de base de 26 min 54 s | ESPEC §8.5 |
| T-2019 | **[portão]** Uma geração real do par do PGM no `ca-confere-backend`, cronometrada | **P4** |
| T-2025 | Emendas: o que a execução contrariou na espec, no padrão da ESPEC 012 §12 e da 007 §13. README e CHANGELOG | — |

**Verificação:** `P2`, `P3`, `P4`.

> **`T-2017` roda a suíte de navegador mesmo sem uma linha de frontend ter mudado.** A ESPEC 012
> §12.5 registra por que: naquela entrega, a exigência de "a suíte inteira verde" devolveu um
> defeito de tela de dois incrementos atrás. O custo é uma execução; o que ela pega não tem preço
> conhecido de antemão.

**Tamanho:** P — três horas, mais a janela de produção.

---

## 4. Sequência

```
F0 ──▶ F1 ──▶ F2 ──▶ (publicável) ──┐
              │                      │
              └────▶ F3 ──▶ (publicável) ──┼──▶ F4 ──▶ F5
                                           │
                             (F2 e F3 comutam)
```

**F0 e F1 são obrigatórias e nesta ordem.** Depois delas, F2 e F3 são independentes: cada uma se
prova pelas suas âncoras e cada uma pode ser publicada sozinha.

Se a entrega precisar parar, **os cortes bons são depois da F2 e depois da F3**, nessa ordem. Parar
depois da F2 entrega o piloto em ~14 s e o PGM em ~90 s; parar depois da F3 entrega o número
inteiro. Parar antes da F2 não entrega nada — mas deixa `P0` e `P1` no repositório, que é a metade
cara e a que não se refaz.

---

## 5. A regressão que já está escrita

Esta seção é o motivo pelo qual este plano é curto. Quase toda a proteção necessária já existe.

### 5.1 O que não é afetado, e por quê

Nenhum arquivo de `domain/`, `application/` ou `api/` é tocado (`R-DES-02`). Nenhuma validação,
nenhuma regra de extração, nenhuma consolidação, nenhuma mensagem. `test_architecture.py` continua
valendo sem alteração, e a resposta de `POST /reports` continua idêntica — que é a `R-RSP-05` da
ESPEC 012, ainda em vigor palavra por palavra.

O `.xlsx` da análise **também** não é tocado, e `T-2022` está no plano justamente para provar isso:
é o teste que falha se a mudança vazar para onde não devia.

### 5.2 As âncoras existentes que cobrem exatamente esta mudança

Nenhuma delas precisa de uma linha. Todas foram escritas sem saber desta espec, e é isso que as
torna boas testemunhas:

| Âncora | O que afirma | Por que pega esta mudança |
|---|---|---|
| `test_capa.py:294` (`T-1408`) | `sha256` do corpo de texto inteiro — 16 mil textos | *"Um caractere que mude em qualquer das 16 mil células o derruba"*. Pega qualquer erro de texto da `escrever` |
| `test_quantitativo_consolidado.py:130` | `sha256` por entrada do pacote | A técnica que `T-2020` generaliza. Continua rodando no seu escopo próprio |
| `test_docx_formatacao.py:176` | `R-DOC-10` — duas execuções, mesmos *bytes* | Se a `escrever` introduzir qualquer não-determinismo, cai aqui |
| `test_docx_anexos.py` | Orientação, largura, altura, corte de cabeçalho, **mesclagens**, figuras | É o teste de comportamento da F3. O `sha256` diz *que* mudou; este diz *o quê* |
| `test_docx_estrutura.py` | Seções, capa intocada | Pega dano estrutural da F3 |
| `test_anchor_por_codigo.py`, `test_anchor_analise.py`, `test_linhas_derivadas.py` | Âncoras de conteúdo nos dois pares | O conteúdo lido de volta |
| `test_api_e2e.py` | A resposta de `POST /reports` | O caminho completo, por HTTP |

### 5.3 O que **parece** que vai quebrar, e não quebra

| Suspeita | Por que não |
|---|---|
| `test_capa.py` vai quebrar com a `T-2001` | A fixture apenas **muda de arquivo**; o corpo é copiado sem alteração e a injeção continua por nome. Se quebrar, a `T-2001` foi feita errada |
| `test_quantitativo_consolidado.py` vai quebrar com a `T-2000` | `_partes` é movida, não alterada. A exclusão de `docProps/core.xml` e o comentário viajam junto — **e o comentário é o item que se perde numa extração apressada** |
| As âncoras de `sha256` vão exigir reancoragem | **Não devem.** Se exigirem, `R-DES-01` foi violada e a fase é revertida. Reancorar aqui é o erro que este plano existe para não cometer |

### 5.4 A única coisa que não tem teste, e o que se faz sobre ela

`T-2011` — a linearidade — é o único teste com relógio, e o relógio é a coisa menos confiável de
um CI. A mitigação é a margem: teto de `2,6` contra `1,16` medido depois e `4,15` medido antes.
A medida de `1,16` foi tomada **com a suíte inteira rodando em paralelo**, que é o pior caso de
contenção que este projeto produz, e a razão sobreviveu.

Se ainda assim oscilar: `-m "not lento"` no laço rápido. **Nunca afrouxar o fator** — é o que
ele mede.

O marcador é registrado em `pyproject.toml` pela `T-2011`. O projeto ainda não declara marcador
nenhum (`pytest.mark.anyio` vem do plugin), e um marcador desconhecido sai como aviso — que numa
suíte com **um** aviso conhecido é ruído que alguém vai gastar tempo investigando.

---

## 6. O que pode dar errado, e o que pega

| Risco | Sintoma | O que pega |
|---|---|---|
| `escrever` diverge em um caso da matriz | `sha256` vermelho, sem dizer onde | `T-2023` diz onde — é o teste que nomeia o caso |
| `escrever` diverge em um caso **fora** da matriz | `sha256` vermelho nos dois pares | `T-2020`/`T-2021`. É a rede de baixo, e é por isso que a matriz não precisa ser exaustiva |
| A âncora é tirada depois da mudança | Tudo verde, nada provado | `P0` com `git diff --stat backend/src` vazio como critério |
| Mesclagem aparada tratada errado | Um anexo com a grade errada | `T-2024` (caso `SOA`) e `test_docx_anexos` |
| `T-2010` medindo o documento inteiro | Teto arbitrário em vez de zero | Escopo em `_tabelas_do_anexo`, fixado na tarefa |
| Custo da suíte piorar com a `T-2021` | +115 s por execução, para sempre | `T-2001` antes; `T-2002` mede e confirma |
| `_escrever_de_referencia` removida como código morto | O teto de versão vira promessa | Comentário na `T-2006`, e a espec §8.3 |
| Atualização do `python-docx` muda o XML | Nenhum, até um documento sair errado | `R-DES-07` (teto) mais `T-2023`/`T-2024` |
| Ganho não aparecer em produção | — | `P4`. A ESPEC 012 §2.3 mostrou que a vCPU do Container Apps é mais rápida que esta máquina; a direção é favorável |

---

## 7. Insumos

Todos já no repositório. **Nenhuma fixture de arquivo nova.**

* `contrato.pdf` + `levantamento.xlsx` — o piloto: 19 anexos, 15.955 células, 871 mesclagens.
* `contrato_pgm.pdf` + `aditivo_pgm.pdf` + `levantamento_pgm.xlsx` — o par que exercita **3.157
  mesclagens** e 31.048 células. É ele que torna a F3 verificável; o piloto sozinho não a alcança.
* `docx_do_piloto` (`conftest.py:283`) — fixture de sessão, já existente.
* `documento_do_pgm` (`test_capa.py:132`) — existe, é de sessão, e a `T-2001` a move para onde a
  `T-2021` a enxerga.
* `_partes()` (`test_quantitativo_consolidado.py:130`) — o comparador, e a `T-2000` o compartilha.

As tabelas sintéticas de `T-2011` e `T-2024` são construídas em memória no próprio teste: não são
fixture, não vão para o disco, e não dependem de nenhum arquivo real — que é o que as faz rodar em
qualquer máquina.

---

## 8. O que este plano não faz

* **Leitura dos anexos em `read_only`** (2 a 6 s, ESPEC §2.6 e `I-31`). Medido e registrado; fica
  para uma espec própria, porque mexe em fidelidade de anexo.
* **Cache do `Contract` por *hash* do PDF** (`I-32`). Decisão de produto — atravessa a ESPEC 001
  §7.2.
* **`GZipMiddleware`** na resposta. Ganho de rede, não de CPU.
* **Remover o `CapacityLimiter(1)`** (`D-09`). A razão da ESPEC 012 `D-02` não mudou.
* **Unificar as três fixtures de DOCX do PGM.** Duas delas são sem aditivo; consolidá-las é
  mudança de suíte com decisão própria (`I-34`).
* **Mexer no cache de `docx_do_piloto`** (`I-33`). Deixa de ser necessário por custo e continua
  correto por desenho.
* **Qualquer mudança de comportamento.** Se o documento mudar, o plano falhou.

---

## 9. Insumos pendentes que este plano abre

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-34` | As três fixtures de DOCX do PGM (duas sem aditivo, uma com) valem consolidação? São ~300 s de suíte | Não. `T-2001` move uma; as outras ficam |
| `I-35` | `docx_do_piloto` (conftest, fontes em cache) e `documento_do_piloto` (`test_capa`, container real) renderizam o **mesmo** documento por caminhos diferentes. Um dos dois é redundante | Não. Descoberto ao escrever a `T-2020`, registrado para não se perder |
