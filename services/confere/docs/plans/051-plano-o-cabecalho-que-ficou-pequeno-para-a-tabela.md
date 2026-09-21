# PLANO 051 — Implementação de "O cabeçalho que ficou pequeno para a tabela"

| | |
|---|---|
| **Especificação** | [ESPEC 051](../specs/051-o-cabecalho-que-ficou-pequeno-para-a-tabela.md) v1.0 |
| **Versão** | 1.0 — 2026-09-10 — **executado** em 2026-09-10. Todos os seis portões fechados; achado extra na `E5` (`test_t2293_o_documento_do_pgm_perde_tres_secoes_e_nenhuma_tabela`, fora do inventário original) resolvido na mesma fase — ver §9 do TASKS |
| **Backlog** | [TASKS 051](../tasks/051-tasks-o-cabecalho-que-ficou-pequeno-para-a-tabela.md). Numeração continua de `T-2737`, a última em uso (ESPEC 049) — os `T-` deste plano começam em **`T-2738`** |
| **Estado inicial** | Ramo `feature/evolucao`, `HEAD` em `fb078d1`. Árvore de trabalho **limpa** — o único arquivo não rastreado é a própria `docs/specs/051-...md` que este plano implementa, ainda não commitada. Backend: **1.608 testes coletados**, medido nesta árvore em 2026-09-10 |
| **Colisão conhecida** | Nenhuma. Diferente dos PLANOs 036/037, não há outra entrega dentro da árvore de trabalho |
| **Instrumento existente** | `AnexoReader().ler(...)` resolve os cortes **sem renderizar** — é a sonda barata desta entrega, no mesmo papel que teve na F2 do PLANO 037. `tests/test_docx_anexos.py::tabelas_por_anexo` já distribui tabelas por anexo e já lida com anexos de mais de dois blocos (`ServicosEmNuvem`, cortado por figura) — a extensão para mais de duas tabelas **por corte** é a mesma ideia, um nível abaixo. `test_aba_reader.py` já tem a suíte sintética de `Anexo.corte`, isolada de planilha — é onde os testes novos de `Anexo.cortes` entram |

---

## 1. O que este plano tem de diferente

> **A generalização é de tipo, e o risco mora em três lugares nomeados que assumiam "no máximo uma
> fileira marcada por anexo".** `Anexo.corte: int | None` vira `Anexo.cortes: tuple[int, ...]` — uma
> mudança pequena de assinatura — mas três pontos do código e da suíte foram escritos quando um anexo
> só podia ter **um** corte, e "no máximo um" está embutido na lógica deles, não só no tipo:
> `_tabelas_esperadas` (`test_docx_anexos.py:133`) compara `anexo.corte` com `None`; o teste
> `test_a_largura_e_do_bloco_e_nao_da_aba` desempacota **exatamente duas** tabelas de `Servidores`
> (`preambulo, corpo = ...`); e `test_a_marca_de_cabecalho_cai_na_primeira_fileira_da_tabela` afirma
> `marcadas in ([], [0])` — uma lista com **um** zero, não dois. Os três encontrados por leitura do
> código, não por execução da suíte — é o inventário do §8.

> **A rede que a própria ESPEC 037 escreveu precisa aprender sobre a âncora nova, ou reprova depois
> da correção — pelo motivo errado.** `test_t2323_toda_fileira_marcada_do_*_e_um_cabecalho`
> (`test_cabecalho_do_anexo.py`) já confere que toda fileira `w:tblHeader` bate com uma âncora
> declarada — mas `_ancoras()`, ali dentro, só lê `c.cabecalho` (a âncora primária). Depois desta
> entrega, a fileira do cabeçalho de **detalhe** de `Servidores`/`ServidoresSemDesenv` vai carregar
> `w:tblHeader` com os rótulos da âncora **adicional**, que `_ancoras()` não conhece — e a mesma rede
> que corrigiu a ESPEC 037 voltaria a soar, apontando para um cabeçalho que agora está certo. É a
> `T-2755`, e sem ela o portão `P3` fecha vermelho por um motivo que não é regressão.

> **Os dois pacotes de referência já carregam o defeito — não há régua parada desta vez.** Nas
> reancoragens anteriores (036, 037, 049) o piloto ficava intacto e servia de prova de que a mudança
> não tocou o que já estava certo. Aqui o `word/document.xml` dos **dois** pacotes se move, porque o
> defeito medido na ESPEC 051 §2.4 já está nos dois hoje. A prova por desligamento (`T-2758`) é o que
> substitui "o piloto não se mexe" como oráculo desta vez.

> **`forma_do_bloco` por segmento é a correção; marcar a fileira certa não bastaria sozinho.** A
> ESPEC 037 corrigiu **qual** linha marcar e não precisou tocar o renderizador (`D-04` daquela espec).
> Aqui, marcar a fileira do cabeçalho de detalhe sem também recalcular a largura **por segmento**
> deixaria a mesma tabela com 15 colunas de grade e só 11 rótulos — o defeito seria outro, não
> resolvido. `T-2750` é a tarefa que faz a diferença, e o portão `P3` mede as larguras, não só as
> marcas.

> **O mecanismo fica pronto para o `I-01` da ESPEC 037, e não é acionado.** `cabecalhos_adicionais`
> resolveria `NAS` e `OutrosServicos` se configurado — mas isso muda um resultado hoje correto
> (`ESPEC 051 §2.5`, `D-05`), e não é desta entrega. Nenhuma tarefa deste plano toca `anexos.json` em
> anexo diferente dos dois nomeados.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Linha de base e o defeito nomeado nos dois pacotes** | Fim da `F0` | Piloto **21 seções, 38 tabelas**; PGM **18 seções, 32 tabelas** — medidos nesta árvore. As duas fileiras marcadas de `Servidores`/`ServidoresSemDesenv`, nos dois pares, com **4 células vazias de 15**, texto transcrito. Hashes atuais de `word/document.xml` registrados — piloto `0b87c759…`, PGM `4e3197ff…`. `1.608` coletados | Régua não reproduzida nesta árvore é régua de outra árvore |
| **P1 — O catálogo, inerte** | Fim da `F1` | `cabecalhos_adicionais` em `anexos.json`, só nos dois anexos. **Os quatro pacotes idênticos à `T-2738`** — nada lê o campo ainda. `1.608` coletados | Pacote movido aqui é sinal de que a `F2` foi antecipada |
| **P2 — `Anexo.cortes`, provado sem renderizar** | Fim da `F2` | A sonda `AnexoReader().ler(...)`, sem `Document`: `Servidores` e `ServidoresSemDesenv` com **dois** cortes nos dois pacotes, nos índices da `T-2741`; os outros 17 anexos com **um** corte cada, idêntico ao valor de hoje. Os testes sintéticos de `test_aba_reader.py` — os quatro existentes reescritos para `.cortes`, mais os três novos (§8.1) — verdes | Reverter a `F2`. Um corte movido num anexo fora do escopo é falso positivo, e a sonda é mais barata que renderizar para achá-lo |
| **P3 — Os documentos, e a rede atualizada** | Fim da `F3` | `Servidores` e `ServidoresSemDesenv` com **três** tabelas cada, nos dois pacotes; nenhuma fileira `w:tblHeader` com célula vazia dentro da própria largura. Os outros 17 anexos com a **mesma** contagem de seções e tabelas de `P0`. `test_t2323_*` (com `_ancoras()` estendida) verde nos dois pares | Reverter. Tabela a mais ou a menos num anexo fora do escopo é conteúdo deslocado, não cabeçalho corrigido |
| **P4 — A reancoragem, provada** | Fim da `F4` | Prova por desligamento: revertido `cabecalhos_adicionais` para vazio, os dois pacotes voltam ao hash da `T-2738`, entrada por entrada. Só então os dois hashes de `word/document.xml` são trocados, com o parágrafo de justificativa | Não reancorar sem a prova |
| **P5 — O conjunto** | Fim da `F5` | Backend verde, **≥ 1.608** mais os testes novos. `ruff` e `mypy` limpos nos arquivos tocados. `git diff --stat` restrito ao inventário do §8 — em especial, **nenhuma** mudança em `NAS`, `OutrosServicos`, `cabecalho.py`, `frontend/`, `api/` | Não entregar |

---

## 3. Fases

### F0 — Linha de base e o defeito nomeado `[portão]`

**Objetivo:** congelar o que não pode mudar por acidente, e transcrever o defeito nos dois pacotes de
referência antes de escrever código — sem isso, a `F3` não tem como provar que corrigiu o que se
propôs a corrigir.

| # | Tarefa | Ref. |
|---|---|---|
| T-2738 | Reproduzir `PACOTE_DO_PILOTO` e `PACOTE_DO_PGM` nesta árvore, entrada por entrada, contra as constantes de `test_identidade_dos_artefatos.py`. Registrar `word/document.xml`: piloto `0b87c759…`, PGM `4e3197ff…` | **P0**, **P4** |
| T-2739 | Linha de base: `python -m pytest --collect-only -q` → declarar o número (**1.608** nesta árvore) | **P5** |
| T-2740 | **Congelar o defeito**: renderizar os dois pares com o código de hoje e listar a fileira `w:tblHeader` de `Servidores` e `ServidoresSemDesenv` — 15 células de grade, 4 vazias (`[11, 12, 13, 14]`), texto das 11 preenchidas transcrito | **P0**, **P3** |
| T-2741 | Medir a âncora adicional (`["Servidor", "Serviço", "Nome do Serviço"]`) contra os dois pacotes **e** o arquivo real da submissão, com `localizar_cabecalho` isolado (sem renderizar): resolve em `Servidores` 51 (piloto) / 46 (PGM); `ServidoresSemDesenv` 40 (piloto) / 36 (PGM) — 0-based | **P1**, **P2** |
| T-2742 | Congelar a forma: piloto 21 seções / 38 tabelas; PGM 18 / 32. Reproduzir nesta árvore, não copiar da ESPEC | **P0**, **P3** |

**Verificação:** `P0`. **Tamanho:** PP — meia hora, mais duas renderizações de cada par.

---

### F1 — O catálogo aditivo `[portão]`

**Objetivo:** pôr a âncora adicional no JSON e no dataclass de configuração, sem que nada a leia
ainda — o mesmo movimento que a `F1` do PLANO 037 fez para a âncora primária.

| # | Tarefa | Ref. |
|---|---|---|
| T-2743 | `ConfiguracaoDeAnexo.cabecalhos_adicionais: tuple[tuple[str, ...], ...] = ()`, em `configuracao.py`, com a docstring do campo (mesmo padrão do comentário de `cabecalho`, ESPEC 037) | `R-SEG-01`, `D-01` |
| T-2744 | `anexos.json`: campo `cabecalhos_adicionais: [["Servidor", "Serviço", "Nome do Serviço"]]` em `Servidores` e `ServidoresSemDesenv`, com a âncora da `T-2741`. As outras 17 entradas **não mudam** | `R-SEG-07` |
| T-2745 | **[portão]** Os quatro pacotes **idênticos** à `T-2738`, `1.608` ainda coletados — `AnexoReader` ainda não lê o campo | **P1** |
| T-2746 | Teste novo em `test_anexos_configuracao.py`: `cabecalhos_adicionais` não vazio só em `Servidores` e `ServidoresSemDesenv`, vazio nas outras 17 | `R-SEG-07` |

**Verificação:** `P1`. **Tamanho:** P — quarenta minutos.

---

### F2 — `Anexo.cortes`, provado sem renderizar `[portão]`

**Objetivo:** trocar `int | None` por `tuple[int, ...]`, resolver a âncora adicional na leitura, e
provar as duas coisas pela sonda — antes de gastar as renderizações da `F3`.

| # | Tarefa | Ref. |
|---|---|---|
| T-2747 | `Anexo.linhas_cabecalho_adicionais: tuple[int, ...] = ()`, em `annex.py`. `AnexoReader._anexo` resolve cada entrada de `cabecalhos_adicionais` com `localizar_cabecalho` (a mesma função da ESPEC 037, sem alteração), descartando as que devolvem `None` | `R-SEG-01`, `D-01` |
| T-2748 | `Anexo.corte` (propriedade) vira `Anexo.cortes`: para cada linha em `{linha_cabecalho, *linhas_cabecalho_adicionais}` — descartado `None`, descartado `0` (sem preâmbulo a separar) e descartada a que uma mesclagem atravessa (mesma guarda de hoje, aplicada por índice) —, devolve a tupla **ordenada e sem repetição** | `R-SEG-02`, `R-SEG-06`, `D-02` |
| T-2749 | Reescrever os quatro testes sintéticos de `test_aba_reader.py` (`corte` → `cortes`, `7` → `(7,)`, `None` → `()`) e acrescentar três: duas âncoras resolvendo em linhas distintas → dois cortes ordenados; duas âncoras resolvendo na **mesma** linha → um corte só (`R-SEG-06`); mesclagem atravessando a âncora **adicional** (não a primária) bloqueia só aquele corte, o outro sobrevive | `R-SEG-02`, `R-SEG-06` |
| T-2750 | Atualizar os comentários que citam `Anexo.corte` por nome (`anexo_reader.py:69`, `ooxml.py:162`) para `Anexo.cortes` | — |
| T-2751 | **[portão]** Sonda sem `Document`: `AnexoReader().ler(...)` nos dois pacotes — `Servidores`/`ServidoresSemDesenv` com `cortes` de **dois** elementos, nos valores da `T-2741`; os outros 17 anexos com **um** elemento, idêntico ao `corte` de hoje | **P2** |

**Verificação:** `P2`. **Tamanho:** PP — uma hora.

---

### F3 — O renderizador e a rede atualizada `[portão]`

**Objetivo:** desenhar uma tabela por segmento — e só agora, porque é aqui que `forma_do_bloco`
aprende a olhar para o segmento, não para o bloco inteiro, que a lacuna de largura se fecha.

| # | Tarefa | Ref. |
|---|---|---|
| T-2752 | `_faixa_de_tabelas` (`docx_renderer.py:480`): os cortes da faixa (`[c for c in anexo.cortes if inicio < c < fim]`) definem os limites dos segmentos; um separador de 1 pt entre cada dois segmentos consecutivos — o mesmo parágrafo que já separa preâmbulo e corpo hoje | `R-SEG-03`, `R-SEG-04`, `D-03` |
| T-2753 | `_tabela_do_anexo` passa a ser chamada **uma vez por segmento**, com `forma_do_bloco(segue_inicio, segue_fim)` calculado **naquele** intervalo — não mais no bloco inteiro entre um corte e o fim. `repetir` é `segue_inicio in {anexo.linha_cabecalho, *anexo.linhas_cabecalho_adicionais}` | `R-SEG-03`, `R-SEG-04`, `D-03` |
| T-2754 | Corrigir `_tabelas_esperadas` (`test_docx_anexos.py:125`): contar segmentos por `len(cortes dentro da faixa) + 1`, em vez de "no máximo dois" | — (inventário §8) |
| T-2755 | Reescrever `test_a_largura_e_do_bloco_e_nao_da_aba`: `preambulo, resumo, detalhe = tabelas_por_anexo["Servidores"]`, com 9 / 11 / 15 colunas de grade — é o teste de aceite direto de `R-SEG-03` | `R-SEG-03` |
| T-2756 | Reescrever `test_a_marca_de_cabecalho_cai_na_primeira_fileira_da_tabela`: `assert all(m == 0 for m in marcadas)`, em vez de `marcadas in ([], [0])` — a regra é "cada marca é a fileira 0 **da sua tabela**", não "no máximo uma marca por anexo" | `R-SEG-04` |
| T-2757 | Estender `_ancoras()` em `test_cabecalho_do_anexo.py` para incluir `c.cabecalhos_adicionais`, além de `c.cabecalho` — sem isso `test_t2323_*` volta a reprovar depois desta entrega, por um cabeçalho que agora está certo | §1, `T-2323` da ESPEC 037 |
| T-2758 | Teste novo, no molde da `T-2323`: em `Servidores` e `ServidoresSemDesenv`, nos dois pacotes, nenhuma fileira `w:tblHeader` tem célula vazia dentro da própria largura de grade — a rede da ESPEC 051 §8.2 | `§8.2` da espec |
| T-2759 | **[portão]** Rodar e conferir: `T-2755`, `T-2756`, `T-2757`, `T-2758` verdes nos dois pacotes; os outros 17 anexos com a mesma contagem de seções e tabelas da `T-2742` | **P3** |

**Verificação:** `P3`. **Tamanho:** P — uma hora e meia.

---

### F4 — A reancoragem, provada `[portão]`

**Objetivo:** confirmar no artefato o que a sonda já provou, e trocar os hashes com a justificativa
que o cabeçalho de `test_identidade_dos_artefatos.py` exige — desta vez nos **dois** pacotes.

| # | Tarefa | Ref. |
|---|---|---|
| T-2760 | **Prova por desligamento**: revertendo `cabecalhos_adicionais` para `()` nas duas entradas de `anexos.json` (sem tocar o restante do código), os dois pacotes voltam ao valor da `T-2738`, entrada por entrada | **P4**, `D-06` |
| T-2761 | Reancorar `word/document.xml` em `PACOTE_DO_PILOTO` **e** `PACOTE_DO_PGM`, com o parágrafo de justificativa no cabeçalho de `test_identidade_dos_artefatos.py` — abaixo do parágrafo da ESPEC 049, sem reescrevê-lo, explicando por que **desta vez o piloto também se move** | **P4**, `D-06` |
| T-2762 | Conferir `docProps/app.xml` e as demais entradas dos dois pacotes: candidatas a se mover junto, "a medir, não a prever". Se alguma se mover, a `T-2761` explica por quê; senão, o portão exige que fiquem paradas | **P4** |

**Verificação:** `P4`. **Tamanho:** PP — vinte minutos de conferência, mais quatro renderizações (duas por pacote: antes e depois do desligamento).

---

### F5 — O conjunto `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2763 | Suíte de backend completa, número declarado, comparado com a `T-2739` | **P5** |
| T-2764 | `ruff` e `mypy` nos arquivos tocados | **P5** |
| T-2765 | **[portão]** `git diff --stat` restrito ao inventário do §8 — em especial **sem** `NAS`, `OutrosServicos`, `cabecalho.py`, `frontend/`, `api/` | **P5** |
| T-2766 | ESPEC 004: nota em `R-ANX-11` remetendo à ESPEC 051, no mesmo padrão da nota que já remete à ESPEC 037. `Status` da ESPEC 051 passa de "Proposta" para "Implementada", com os números reais (não os previstos) | — |

**Verificação:** `P5`. **Tamanho:** PP — vinte minutos, mais o tempo da suíte.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3 ──► F4 ──► F5
P0     P1     P2     P3     P4     P5

F1  a âncora adicional entra e NADA muda        ← inerte até o AnexoReader ler
F2  a sonda: 17 anexos parados, 2 com 2 cortes  ← sem renderizar
F3  o documento confirma, e a rede é reforçada  ← T-2757 é o item que falta sem saber que falta
F4  os dois hashes trocam, com prova            ← desta vez os dois pacotes se movem
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~3h30 de trabalho, mais três execuções de suíte completa (`T-2739`, `T-2759`, `T-2763`) e seis renderizações de par completo (`T-2738`×2, `T-2740`×2, `T-2760`/`T-2761`×2) |

**Nenhuma fase está bloqueada por decisão de negócio.** `I-01`, `I-02` e `I-03` da espec são
posteriores à entrega.

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| **A rede da ESPEC 037 reprovar depois da correção, por não conhecer a âncora adicional** | `T-2757`, nomeada explicitamente no §1. É o risco mais provável deste plano — o código pode estar certo e a suíte reprovar assim mesmo |
| **Um dos três lugares que assumem "no máximo um corte" quebrar em silêncio, sem accusar nada** | `_tabelas_esperadas` reprova alto (índice fora da lista) se não corrigida; os outros dois (`T-2755`, `T-2756`) foram lidos e transcritos antes do código mudar — não dependem de a suíte os achar sozinha |
| A âncora adicional casar uma linha de dados comum, em vez do cabeçalho de detalhe | `T-2741` mede contra os dois pacotes e o arquivo real antes de entrar em `anexos.json`; `T-2758` é a rede que pegaria em produção |
| Reancorar às cegas | `T-2760`, a prova por desligamento — sem ela a `T-2761` não roda |
| `NAS` ou `OutrosServicos` mudarem de contagem de tabela por engano | `T-2759`/`T-2765` — nenhuma tarefa deste plano toca a configuração desses dois anexos; qualquer movimento neles é sinal de que a generalização vazou para onde não devia |
| Perder tabela junto com o corte — um corte novo atravessado por mesclagem virar "sem corte" | `T-2749` cobre o caso construído; `T-2759` confere que os dois anexos afetados saem com três tabelas, não duas, nos dois pacotes |
| A largura da tabela de resumo (11 colunas) sair errada por herdar as 15 larguras medidas para a de detalhe | `test_as_larguras_sao_as_medidas_no_grc` já afirma "prefixo, não igualdade" (ESPEC 014) e não precisa mudar — `T-2759` confirma que continua verde sem alteração |
| Confundir esta entrega com o `I-01` da ESPEC 037 e estender a `NAS`/`OutrosServicos` durante a implementação | `D-05` da espec, e o portão `P5` (`T-2765`) reprova qualquer `git diff` fora do escopo nomeado |

---

## 6. O que este plano não faz

- **Não estende `cabecalhos_adicionais` a `NAS` ou `OutrosServicos`** — o `I-01` da ESPEC 037 segue em
  aberto, agora com o mecanismo disponível para quem decidir resolvê-lo.
- **Não toca `cabecalho.py`** (`localizar_cabecalho`). É reaproveitada como está, chamada mais vezes.
- **Não muda largura, corpo, orientação ou mesclagem** de nenhum anexo, além do necessário para
  separar as tabelas de `Servidores` e `ServidoresSemDesenv` em mais segmentos.
- **Não versiona um terceiro par de fixture** a partir do arquivo real da submissão. Ele entra só
  como medição de referência (`T-2741`), no molde de como a ESPEC 033 usou o par SMUL — se um dia
  fizer sentido versioná-lo, é decisão própria.
- **Não toca `frontend/` nem `api/`** — nenhum tipo de achado novo, nenhuma tela.
- **Não reancora nada além de `word/document.xml`** nos dois pacotes, e só com a prova da `T-2760`.
- **Não adiciona validação nova** — `V-ANX-02` (ESPEC 037) continua cobrindo a âncora primária; uma
  âncora adicional que não resolva não é condição de erro (§5.1 da espec).

---

## 7. O inventário, e as buscas

Sobre `backend/`, exaustivo — não amostrado:

| # | Busca | O que acha | O que já se sabe |
|---|---|---|---|
| 1 | `\.corte\b` | todo lugar que lê `Anexo.corte` hoje | `anexo_reader.py:69` (comentário), `docx_renderer.py:446,490` (código), `ooxml.py:162` (comentário), `test_aba_reader.py:133,138,142,147` (suíte sintética — **reescrita inteira**, `T-2749`), `test_docx_anexos.py:113,133,222,527` (um deles é código — `T-2754` —, os outros três são comentário). **Onze ocorrências, contadas, nenhuma solta** |
| 2 | `Anexo(` fora de `ConfiguracaoDeAnexo`/`CelulaAnexo`/`ImagemAnexo` | todo construtor direto de `Anexo` em teste | 13 construções em 6 arquivos (`test_aba_reader.py`, `test_anexo_sem_conteudo.py`, `test_cabecalho_do_anexo.py`, `test_desempenho.py`, `test_docx_anexos.py`, `test_figuras.py`) — **todas por palavra-chave**. Um campo novo com valor padrão, inserido depois de `linha_cabecalho`, não quebra nenhuma |
| 3 | `tabelas_por_anexo\[` | todo teste que depende da contagem de tabelas por anexo | `test_docx_anexos.py`, dezenas de usos. Os que indexam por posição fixa (`[0]`, `[1]`) em anexos **fora** do escopo (`NAS`, `Usuários`, `Comunicação Dados`, `Internet`) não mudam — `[0]` continua sendo o preâmbulo em todos eles. Só `Servidores`/`ServidoresSemDesenv` ganham um terceiro elemento |
| 4 | `marcadas in`, `_tem_cabecalho_repetido` | toda afirmação sobre **quantas** fileiras marcadas por anexo | `test_a_marca_de_cabecalho_cai_na_primeira_fileira_da_tabela` (`T-2756`, a única que quebra); `test_o_cabecalho_de_usuarios_se_repete` e `test_todo_anexo_de_mais_de_uma_pagina_repete_o_cabecalho` afirmam **existência** de marca, não contagem — não mudam |
| 5 | `_ancoras\(\)`, `c\.cabecalho\b` | quem lê a âncora primária e esqueceria a adicional | `test_cabecalho_do_anexo.py:88` (`T-2757`, a armadilha do §1); `test_anexos_configuracao.py` só lê `.cabecalho`, não `.cabecalhos_adicionais` — os testes de âncora primária **não mudam**, o campo é aditivo |
| 6 | `forma_do_bloco`, `blocos\(\)` | quem chama a função que hoje mede o bloco inteiro | `docx_renderer.py:527` (`_tabela_do_anexo`, o único call site — `T-2753`) e os testes de `annex.py` que já teste `forma_do_bloco` isoladamente (não tocados: continuam corretos para um único intervalo, só passam a ser chamados com limites diferentes) |
| 7 | `PACOTE_DO_`, `word/document.xml` | as âncoras byte a byte | `test_identidade_dos_artefatos.py`. Hoje: piloto `0b87c759…`, PGM `4e3197ff…` (`T-2738`) |
| 8 | `docx_do_piloto`, `documento_do_pgm`, `anexos_do_pgm` | quem já paga renderização de sessão | `conftest.py`. Nenhuma renderização nova é criada — as fixtures existentes servem |

Sobre `frontend/`:

| # | Busca | O que acha |
|---|---|---|
| 9 | `Achado`, `validacao` | Esperado: nenhuma dependência — esta entrega não cria achado novo, não muda `V-ANX-02`. A suíte de navegador não entra neste plano |

**O resultado das nove manda na `F3`, e não o contrário.**

---

## 8. Testes sintéticos novos (detalhe da `T-2749`, `T-2755`, `T-2756`, `T-2758`)

### 8.1 `test_aba_reader.py` — `Anexo.cortes`

| Caso | Entrada | Esperado |
|---|---|---|
| Uma âncora, cabeçalho não é a primeira linha | `_anexo(7)` | `.cortes == (7,)` |
| Cabeçalho é a primeira linha | `_anexo(0)` | `.cortes == ()` |
| Sem cabeçalho | `_anexo(None)` | `.cortes == ()` |
| Mesclagem atravessa a âncora primária | `_anexo(7, (Mesclagem(5,0,9,3),))` | `.cortes == ()` |
| **Novo** — duas âncoras, linhas distintas | `_anexo(7, adicionais=(14,))` | `.cortes == (7, 14)` |
| **Novo** — duas âncoras, mesma linha | `_anexo(7, adicionais=(7,))` | `.cortes == (7,)` — sem segmento vazio |
| **Novo** — mesclagem atravessa só a adicional | `_anexo(7, (Mesclagem(12,0,15,3),), adicionais=(14,))` | `.cortes == (7,)` — o corte de 7 sobrevive, o de 14 é bloqueado |

### 8.2 `test_docx_anexos.py` / `test_cabecalho_do_anexo.py`

| Teste | Afirma |
|---|---|
| `test_a_largura_e_do_bloco_e_nao_da_aba` (reescrito) | `preambulo, resumo, detalhe = tabelas_por_anexo["Servidores"]`; larguras de grade `9`, `11`, `15` |
| `test_a_marca_de_cabecalho_cai_na_primeira_fileira_da_tabela` (reescrito) | `all(m == 0 for m in marcadas)`, por anexo |
| **Novo** — nenhuma célula vazia na fileira marcada | Para `Servidores` e `ServidoresSemDesenv`, nos dois pacotes: toda fileira `w:tblHeader` tem `celula.text.strip()` não vazio em **todas** as células — a rede da ESPEC 051 §8.2 |
| `test_t2323_*` (com `_ancoras()` estendida) | Continua verde nos dois pacotes — agora reconhecendo as fileiras de cabeçalho de detalhe |

---

## 9. Emenda de execução

*A preencher na execução, com o que o plano não previu.*
