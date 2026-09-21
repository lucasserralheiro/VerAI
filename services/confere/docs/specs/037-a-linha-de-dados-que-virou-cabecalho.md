# ESPEC 037 — A linha de dados que virou cabeçalho

| | |
|---|---|
| **Status** | **Implementada** — 2026-08-31. As sete regras e a `V-ANX-02` entraram. Backend **1.527 → 1.543 passed** (16 testes novos, nenhum removido); `ruff` e `mypy` limpos. **O piloto não se moveu, entrada por entrada** — as 19 âncoras resolvem na `linha_cabecalho` que já estava no catálogo (`R-CAB-06`). **Um artefato reancorado**, o `PACOTE_DO_PGM`, com o delta provado por desligamento de **uma linha**; `word/document.xml` foi a única entrada a se mover, `docProps/app.xml` ficou parado. No PGM: **18 seções, 34 tabelas e 18 fileiras marcadas antes e depois** — o que mudou foi a **identidade de cinco** delas, que deixaram de ser linha de dados. `V-ANX-02` não dispara em nenhum dos dois pares. `docx_renderer.py` e `ooxml.py` **intocados** (`D-04`) |
| **Versão** | **1.0** — 2026-08-31 |
| **Depende de** | [ESPEC 004](004-anexos-de-detalhamento.md) — os 19 anexos de detalhamento, implementada. É dela que vêm `anexos.json`, o `linha_cabecalho` e a `R-ANX-11`, que esta espec corrige |
| **Revisa** | [ESPEC 004](004-anexos-de-detalhamento.md) `R-ANX-11` e §4.1. A `R-ANX-11` está certa no fim — *"o cabeçalho de colunas se repete no topo de cada página"* — e errada no meio: ela identifica o cabeçalho por **número de linha**, e o número foi medido numa planilha só |
| **Não toca** | A tabela de comprovação, a capa, o teste-âncora, o `.xlsx` da análise, a resposta da API, a tela. Nenhuma largura, nenhum corpo, nenhuma orientação, nenhuma ordem, nenhuma mesclagem. **Nenhum anexo cujo cabeçalho já é encontrado onde a configuração diz** |
| **Referência normativa** | `backend/tests/fixtures/levantamento.xlsx` (piloto/SMIT) — as 19 âncoras saem dele, e ele é a régua de não-vazamento; e `backend/tests/fixtures/levantamento_pgm.xlsx` — onde **5 dos 16 anexos presentes** marcam hoje a fileira errada. O defeito é reprodutível na suíte, sem planilha nova |
| **Origem** | Conferência de um documento gerado para o contrato do FTM: no anexo `Office365`, a linha do 4º usuário — `4 \| FTM \| Alipia de Santana Santos Aguilar Bastos \| x538584 \| …` — aparecia no topo de **todas** as páginas do anexo, e o cabeçalho de colunas verdadeiro não aparecia em nenhuma. A planilha do FTM não está versionada; a investigação mostrou que o caso reprodutível equivalente **já estava no PGM**, em cinco anexos, desde que o par foi versionado |

---

## 1. Problema

Uma **linha de dados** é impressa no topo de cada página do anexo, como se fosse o cabeçalho de
colunas. No documento do FTM que originou esta espec:

```
Nº  Secretaria  Nome                                    Login     Email                            …
4   FTM         Alipia de Santana Santos Aguilar Bastos x538584   alipiasantos@prefeitura.sp.gov.br …
   ← e outra vez no topo da página seguinte, e da seguinte, e da seguinte
```

Não é duplicação de dados: é a **mesma fileira redesenhada** pelo Word a cada quebra de página,
porque ela carrega `<w:tblHeader/>`. O documento vai ao órgão como peça de cobrança, e quem confere
lê, em cada folha, um usuário nominal que não está ali — enquanto o cabeçalho verdadeiro
(`Nº | Secretaria | Nome | Login | …`) ficou preso na primeira página e não se repete em nenhuma.

**É pior do que feio.** O anexo `Office365` do FTM lista pessoas com nome, RF e e-mail. Repetir uma
delas em cada página, em posição de rótulo, é publicar um dado pessoal fora do seu lugar e sugerir,
a cada folha, que a coluna se chama *"Alipia de Santana Santos Aguilar Bastos"*.

### 1.1 O defeito já está no artefato versionado

Renderizando os dois pares da suíte hoje (2026-08-31) e enumerando as fileiras que carregam
`w:tblHeader`:

| Par | Seções | Tabelas | Fileiras marcadas | **Marcadas que são linha de dados** |
|---|---|---|---|---|
| Piloto/SMIT | 21 | 39 | 20 | **0** |
| PGM | 18 | 34 | 18 | **5** |

As cinco do PGM, com o texto que se repete em cada página do anexo:

| Anexo | Fileira marcada hoje | O que ela é |
|---|---|---|
| `Servidores` | `D84V50I \| 1 \| 2 \| 80 \| 20 \| 0 \| 0` | 1ª linha de dados |
| `ServidoresSemDesenv` | `C68V13I \| 2 \| 4 \| 70 \| 10 \| 0 \| 0` | 1ª linha de dados |
| `SDWAN` | `LINK DE CONECTIVIDADE \| … \| 2` | faixa de resumo do preâmbulo |
| `SOA` | `SN1403 \| PIDE-PLANO DE INFORMATIZAÇÃO… \| 944` | linha de dados do resumo |
| `Office365` | `PERFIL POWER BI PRO \| … \| 10 \| 5 \| 0 \| 5 \| 5` | linha de dados do resumo |

O par do PGM está versionado desde a ESPEC 020 e passa por `test_identidade_dos_artefatos`,
`test_docx_anexos`, `test_capa` e `test_api_e2e`. **Nenhum deles olha qual fileira leva a marca**, e
por isso o defeito atravessou em silêncio todas as especs desde então. O que ele custa não é
hipótese medida em laboratório: é o documento que o PGM recebe.

## 2. O que foi levantado no código

### 2.1 Onde a marca nasce

A cadeia inteira, do JSON ao XML, tem cinco elos e nenhum ponto de verificação:

1. [`anexos.json`](../../backend/src/infrastructure/annex/anexos.json) fixa `"linha_cabecalho": 17`
   para `Office365` — um número **absoluto**, 1-based, medido uma vez no GRC do SMIT;
2. [`anexo_reader.py:53-55`](../../backend/src/infrastructure/annex/anexo_reader.py#L53-L55) só
   converte para 0-based. **Não confere se aquela linha é um cabeçalho**;
3. [`annex.py:172-195`](../../backend/src/domain/entities/annex.py#L172-L195) (`Anexo.corte`)
   devolve o índice cru;
4. [`docx_renderer.py:500-509`](../../backend/src/infrastructure/report/docx_renderer.py#L500-L509)
   parte o anexo em duas tabelas exatamente ali e chama a segunda com `repetir=True`;
5. [`docx_renderer.py:567-568`](../../backend/src/infrastructure/report/docx_renderer.py#L567-L568)
   → [`ooxml.py:157-165`](../../backend/src/infrastructure/report/ooxml.py#L157-L165) escreve
   `<w:tblHeader/>` em `tabela.rows[0]`.

**A fileira que estiver naquele índice vira cabeçalho, seja ela o que for.**

### 2.2 O índice é fixo; o preâmbulo não é

O que precede o cabeçalho de colunas nessas abas é um bloco de resumo, e ele **cresce e encolhe com
o escopo do órgão**. Em `Office365` há um bloco `SECRETARIA - X` por secretaria atendida:

| Planilha | Blocos de resumo | Linha real do cabeçalho | O que está na linha 17 |
|---|---|---|---|
| Piloto/SMIT | 1 (`SMIT`) | **17** | o cabeçalho — a configuração foi medida aqui |
| PGM | 2 (`SNJ`, `PGM`) | **22** | `PERFIL POWER BI PRO \| 10 \| 5 \| 0 \| 5 \| 5` |
| FTM (não versionada) | — | **13**, deduzida | a linha do 4º usuário |

A dedução do FTM fecha pela numeração visível no documento: cabeçalho na 13 → dados a partir da 14
→ a 17 é o **item 4**, que é exatamente o que o print mostra, seguido do item 5.

O mesmo mecanismo, com outra origem, explica as outras quatro do PGM: `Servidores` e
`ServidoresSemDesenv` têm um bloco de resumo a menos, e o cabeçalho subiu uma linha (13→12, 12→11);
`SDWAN` tem cinco a mais (9→14); `SOA`, três (6→9).

**O número não é propriedade do formato. É propriedade da planilha de julho/2026 do SMIT**, e foi
codificado como se fosse do formato.

### 2.3 A guarda que existe não guarda isto

`Anexo.corte` tem uma única condição de recusa:

```python
if any(m.linha < self.linha_cabecalho <= m.ate_linha for m in self.mesclagens):
    return None
```

Ela protege contra **partir uma região mesclada** — e uma linha de dados comum não é atravessada por
mesclagem nenhuma. Medido nos dois pares: a condição não dispara em nenhum dos 35 pares aba×planilha,
nem nos cinco casos errados. A guarda existente é ortogonal ao defeito.

### 2.4 O caminho sem corte também marca

Quando `corte` é `None` porque o cabeçalho **é** a primeira linha da aba, a marca vem por outro ramo
([`docx_renderer.py:495-497`](../../backend/src/infrastructure/report/docx_renderer.py#L495-L497)):

```python
self._tabela_do_anexo(documento, anexo, larguras, inicio, fim, anexo.linha_cabecalho == inicio)
```

É o caso de `Detalhes` e `DetalhesSemDesenv` (`linha_cabecalho: 1`), corretos nos dois pares. O ramo
importa para o desenho da correção: com `linha_cabecalho = None`, a comparação `None == 0` é `False`,
e **os dois caminhos deixam de marcar sozinhos**, sem uma linha de código nova no renderizador.

### 2.5 Quem lê `linha_cabecalho`

Um consumidor de configuração
([`anexo_reader.py:53`](../../backend/src/infrastructure/annex/anexo_reader.py#L53)) e dois de
domínio (`Anexo.corte` e a comparação do §2.4). Nem a `AnaliseDaMedicao`, nem a resposta da API, nem
a tela o leem — a ESPEC 004 §10 nº 3 fechou isso. **A correção cabe inteira na leitura**, e é essa
propriedade que sustenta a §8.2.

### 2.6 O que distingue um cabeçalho, e o que não distingue

Três sinais foram medidos nas 35 combinações aba×planilha antes de se escolher um:

| Sinal | Por que não serve sozinho |
|---|---|
| **Preenchimento** (`A52A2A`, `6A5ACD`) | O cabeçalho de `Office365` no piloto tem preenchimento e **não** tem negrito; o de `Servidores` tem os dois. E `SOA` no PGM tem um cabeçalho **sem preenchimento nenhum**: a busca por pintura não o acharia |
| **Fileira cheia** | `WIFI` tem cabeçalho de 2 rótulos em 10 colunas, começando por **duas células vazias**; `Central de Servicos`, `OutrosServicos` e `ServicosEmNuvem` têm 2 rótulos. "Todas as colunas preenchidas" descartaria quatro cabeçalhos legítimos |
| **Os rótulos** | Serve. É o que a §5 adota, com as duas ressalvas do §2.7 |

### 2.7 Os rótulos servem — com duas ressalvas medidas

**a) Comparação por prefixo, não por igualdade.** A aba `BD` tem `VOLUME GB \| PERFIL` no piloto e
`AMBIENTE \| VOLUME GB \| …` no PGM: o mesmo cabeçalho, com uma coluna a mais. Exigir a tupla
inteira devolveria "não encontrado" para uma aba que hoje está **certa**, e a correção quebraria o
que funcionava.

**b) Primeira ocorrência, não ocorrência única.** Os rótulos do cabeçalho **se repetem** dentro da
mesma aba, porque algumas abas têm um segundo bloco com a mesma tabela:

| Aba | Linhas que casam a âncora (piloto) | (PGM) |
|---|---|---|
| `NAS` | 7, **40** | 7, **179** |
| `OutrosServicos` | 3 | 3, **7**, **11** |

Em todos os casos a primeira ocorrência é a certa — é o cabeçalho da **maior tabela da aba**, que é
o que `anexos.json` sempre quis apontar (§4.1 da ESPEC 004). Exigir unicidade reprovaria três das 35
combinações, todas hoje corretas.

**As mesclagens não atrapalham**, e isso não é sorte: o `openpyxl` guarda o valor só na âncora da
região mesclada, então descartar as células sem texto transforma `Nome \| · \| · \| ·` em um rótulo
`Nome`. É o que faz a âncora do `Office365` valer tanto para o SMIT — onde `Nome` ocupa quatro
colunas — quanto para o FTM, onde ocupa uma.

## 3. Objetivo

Que a fileira marcada como cabeçalho de repetição seja **o cabeçalho de colunas daquela planilha**,
e não a fileira que ocupa um número medido em outra; e que, quando ele não for encontrado, o anexo
saia **sem repetição** e o fato seja dito no painel de achados.

**Não é objetivo:** adivinhar cabeçalho em aba que não tem; repetir cabeçalho de mais de uma tabela
por anexo; mudar o que quer que seja em anexo cujo cabeçalho já é encontrado onde a configuração
diz.

## 4. Escopo

### 4.1 Dentro do escopo

- A resolução da linha de cabeçalho **por conteúdo**, na leitura do anexo.
- O comportamento quando ela não resolve: não marcar, e avisar.
- A transcrição das 19 âncoras para `anexos.json`, medidas no piloto.
- Um teste que impede o defeito de voltar em qualquer anexo, de qualquer planilha.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Repetir cabeçalho de blocos secundários (`NAS` linha 40, `OutrosServicos` linhas 7 e 11) | O corte da ESPEC 004 é um só por anexo, e o Word só repete as primeiras fileiras de **uma** tabela. Repetir os secundários exigiria N tabelas por anexo. Registrado em `I-01` |
| Detectar o cabeçalho **sem** âncora declarada, por heurística de forma | §2.6: os três sinais de forma reprovaram na medição. Uma heurística que erra em silêncio é o defeito que esta espec corrige, com outro rosto |
| `anexos.json` por órgão | A âncora é justamente o que torna o catálogo único viável entre órgãos. Contradiria a correção |
| Largura, corpo, orientação, ordem, mesclagem ou grade de qualquer anexo | `R-CAB-07`. Esta espec move **um índice** |
| A tabela de comprovação, que também usa `repetir_cabecalho` ([docx_renderer.py:377-380](../../backend/src/infrastructure/report/docx_renderer.py#L377-L380)) | Ali o cabeçalho é **construído** pelo renderizador a partir de `layout.CABECALHO_COLUNAS`, não lido de planilha. Não há o que localizar |

## 5. Regras

| ID | Regra |
|---|---|
| `R-CAB-01` | **O cabeçalho de um anexo é localizado pelos seus rótulos, não pelo seu número de linha.** Cada anexo declara em `anexos.json` uma **âncora**: os primeiros rótulos do cabeçalho, medidos no piloto |
| `R-CAB-02` | Os **rótulos de uma fileira** são os textos das suas células, na ordem, **descartadas as vazias** — o que torna a comparação indiferente a mesclagem (§2.7). Comparados sem diferenciar caixa e sem espaço nas pontas; acentuação **não** é dobrada |
| `R-CAB-03` | O cabeçalho é a **primeira** fileira da aba cujos rótulos **começam pela âncora** (prefixo, não igualdade — §2.7a; primeira, não única — §2.7b) |
| `R-CAB-04` | **Âncora não encontrada ⇒ anexo sem repetição.** `linha_cabecalho` fica `None`, `corte` fica `None`, nenhuma fileira é marcada, e o anexo sai numa tabela só. Nunca se marca "a linha que estiver lá" |
| `R-CAB-05` | `linha_cabecalho` **permanece em `anexos.json`** como a medição do piloto, e deixa de alimentar a renderização. Passa a ser o oráculo de `R-CAB-06` |
| `R-CAB-06` | **No piloto, a âncora de cada um dos 19 anexos resolve exatamente para a `linha_cabecalho` medida.** É a régua que impede a âncora de ser transcrita errada, e o teste que trava o catálogo |
| `R-CAB-07` | **Nada além do índice muda.** Para todo anexo cuja âncora resolve no número já configurado, o XML produzido é **byte a byte o de hoje** |

### 5.1 Validação nova

| ID | Severidade | Quando dispara |
|---|---|---|
| `V-ANX-02` | `AVISA` | Há anexo **com conteúdo** cuja âncora não foi encontrada. **Um achado**, com a lista das abas (`R-GRD-06`): a causa provável é uma planilha com o cabeçalho renomeado, e as abas são a consequência repetida |

Não dispara em nenhum dos dois pares versionados — as 19 âncoras resolvem no piloto e as 16
presentes resolvem no PGM. É guarda de anomalia, no precedente da `V-ANX-01` (ESPEC 036) e da
`V-MED-04` (ESPEC 031).

Não dispara para **anexo vazio**: ali não há o que repetir, e o caso já é da `V-ANX-01`.

Texto proposto, em quatro partes (`R-DOC-05`):

- **título:** *"O cabeçalho de colunas não foi localizado em alguns anexos."*
- **causa:** *"Nessas abas, nenhuma linha traz os rótulos esperados de cabeçalho. O conteúdo saiu inteiro; o que falta é a repetição do cabeçalho no topo de cada página."*
- **ação:** *"Confira se a planilha renomeou as colunas dessas abas. O restante do documento não é afetado."*
- **detalhe:** as abas, com a âncora esperada de cada uma, para o suporte.

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **Localizar por rótulo, não por forma** | §2.6, medido: preenchimento e "fileira cheia" reprovam em quatro cabeçalhos legítimos e num cabeçalho sem pintura. O rótulo é o único sinal que sobrevive às 35 combinações — e é o único **auditável na revisão**: quem lê `anexos.json` vê o que se procura |
| `D-02` | **Prefixo e primeira ocorrência** | §2.7, as duas ressalvas medidas. Igualdade quebraria `BD`; unicidade quebraria `NAS` e `OutrosServicos`. As duas quebras seriam em abas **hoje corretas**, que é o pior resultado possível para uma correção |
| `D-03` | **`linha_cabecalho` fica, como oráculo** | Apagá-lo pareceria mais limpo e jogaria fora a única medição independente que existe. Mantido, ele vira `R-CAB-06`: um erro de transcrição da âncora **reprova um teste** em vez de sair no documento. É o mesmo papel que `medidas_grc.json` cumpre para as larguras |
| `D-04` | **A correção mora na leitura; o renderizador não muda** | §2.5. `AnexoReader` já tem as linhas em mãos quando monta o `Anexo`, e `linha_cabecalho = None` já significa "não repetir" nos **dois** caminhos do renderizador (§2.4). Mexer no renderizador para corrigir um índice seria mover o defeito de camada |
| `D-05` | **Não marcar nada quando não resolve** | `R-CAB-04`. As três saídas possíveis são marcar a linha do número configurado (é o defeito), adivinhar por forma (`D-01` mostrou que erra em silêncio) e não marcar. Só a terceira é honesta: perde-se a repetição do cabeçalho, que é conveniência de leitura, e não se ganha uma linha falsa, que é informação errada |
| `D-06` | **`AVISA`, não `BLOQUEIA`** | O conteúdo do anexo sai inteiro; o que falta é a repetição de um rótulo. Bloquear a emissão do documento por isso seria desproporcional, na mesma medida da `D-05` da ESPEC 036 |
| `D-07` | **As âncoras são transcritas por script na fase A, revisadas e commitadas** | `anexos.json` é configuração humana, e continua sendo; mas 19 tuplas de rótulos com acento, asterisco e `Nº` são transcrição, e transcrição à mão erra. O script lê o piloto e emite o JSON; a revisão é humana; `R-CAB-06` é a rede |
| `D-08` | **Reancorar o `PACOTE_DO_PGM` é consequência esperada; o `PACOTE_DO_PILOTO` não pode se mover** | No piloto, todas as 19 âncoras resolvem no número de hoje (medido): o documento tem de sair idêntico. Se ele se mover, a resolução está errada, e o hash é quem avisa. É a mesma prova por desligamento da ESPEC 036 `D-06` |

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `infrastructure/annex/anexos.json` | Campo novo `cabecalho` em cada um dos 19 anexos — a âncora. `linha_cabecalho` **fica**, como medição de referência (`R-CAB-05`) |
| `infrastructure/annex/configuracao.py` | `ConfiguracaoDeAnexo.cabecalho: tuple[str, ...]`; docstring do módulo atualizada — a quarta coisa que o anexo declara deixa de ser um número |
| `infrastructure/annex/cabecalho.py` | **Arquivo novo** — `localizar_cabecalho(linhas, ancora) -> int \| None` e a normalização de rótulos (`R-CAB-02`, `R-CAB-03`). Função pura sobre `CelulaAnexo`: testável sem planilha |
| `infrastructure/annex/anexo_reader.py` | `_anexo` passa a resolver o índice pela âncora sobre `forma.linhas`, em vez de subtrair 1 da configuração |
| `infrastructure/validations/annex_validations.py` | `v_anx_02_cabecalho_nao_localizado` |
| `infrastructure/di/container.py` | Chamada da validação junto de `V-ANX-01`, no ponto em que os anexos já foram lidos ([container.py:317](../../backend/src/infrastructure/di/container.py#L317)) |
| `domain/entities/annex.py` | **Nenhuma mudança de comportamento.** Só o comentário de `linha_cabecalho`, que passa a dizer *"resolvido na leitura"* — e o de `corte`, que ganha a remissão a esta espec |
| `infrastructure/report/docx_renderer.py`, `ooxml.py` | **Nenhuma** (`D-04`) |
| `application/`, `api/`, `frontend/` | **Nenhuma** (§2.5) |
| `scripts/` | Script de transcrição das âncoras (`D-07`), no molde de `medir_anexos_grc.py` |
| `docs/specs/004` §4.1 e `R-ANX-11` | Remissão a esta espec: o cabeçalho passa a ser identificado por rótulo |
| `README.md`, `docs/CHANGELOG.md` | Registro do comportamento novo e da `V-ANX-02` |

## 8. Testes e critério de aceite

### 8.1 As regras

| Regra | Verificação |
|---|---|
| `R-CAB-01` · `R-CAB-03` | Aba sintética com preâmbulo de 3, 8 e 20 linhas e o mesmo cabeçalho: o índice resolvido acompanha o preâmbulo nas três |
| `R-CAB-02` a | Cabeçalho com `Nome` mesclado em 4 colunas e cabeçalho com `Nome` em 1 resolvem pela **mesma** âncora — é o caso SMIT × FTM |
| `R-CAB-02` b | `" nº "`, `"Nº"` e `"NÚMERO"`: os dois primeiros casam, o terceiro não. Caixa e espaço não separam; acento e palavra, sim |
| `R-CAB-03` a | Âncora que é prefixo de um cabeçalho **mais largo** resolve — o caso `BD` (§2.7a) |
| `R-CAB-03` b | Aba com a âncora em duas linhas resolve na **primeira** — o caso `NAS` (§2.7b) |
| `R-CAB-04` | Aba com conteúdo e sem a âncora: `linha_cabecalho is None`, **nenhuma** fileira do documento com `w:tblHeader`, e o anexo sai numa tabela só, com todas as suas linhas |
| `R-CAB-06` | **Para os 19 anexos do piloto, `localizar_cabecalho` devolve `linha_cabecalho - 1`.** É o teste que trava o catálogo (`D-03`) |
| `R-CAB-07` | `PACOTE_DO_PILOTO` inalterado, entrada por entrada |
| `V-ANX-02` dispara | Um anexo com conteúdo e sem âncora → **um** achado, `AVISA`, nomeando a aba |
| `V-ANX-02` cala | Anexo **vazio** sem âncora → nenhum achado (é caso da `V-ANX-01`); e os dois pares versionados → nenhum achado |

### 8.2 A rede que faltava

**O teste que teria pego este defeito, e que não existe:**

> Em cada um dos dois documentos, **toda** fileira marcada com `w:tblHeader` ou é o cabeçalho da
> tabela de comprovação, ou tem os rótulos declarados como âncora daquele anexo em `anexos.json`.

Hoje ele reprova o PGM em cinco anexos (§1.1). Depois da correção, passa nos dois — e passa para
qualquer planilha futura, porque afirma uma relação entre o documento e a configuração, e não um
número. É o item mais importante da entrega: sem ele, a espec corrige cinco casos e deixa o
mecanismo capaz de produzir o sexto.

### 8.3 Regressão

- `test_docx_anexos` — 19 seções, 14 retrato e 5 paisagem, larguras, figuras, corte e cabeçalho
  repetido: **passam sem alteração**. A fixture é o piloto, e nele nenhum índice se move;
- `test_anexos_configuracao` — `test_todo_anexo_declara_a_linha_de_cabecalho` e
  `test_a_linha_de_cabecalho_e_contada_a_partir_de_um` **continuam valendo** (`R-CAB-05`), e ganham
  um par: toda entrada declara `cabecalho` não vazio;
- `test_anexo_sem_conteudo` (ESPEC 036) — as 18 seções e 34 tabelas do PGM **não se movem**: os
  anexos vazios continuam vazios, e o corte só muda de linha dentro de anexo que já tinha duas
  tabelas;
- `test_aba_reader`, `test_figuras`, `test_desempenho` — intocados. A resolução é uma varredura
  linear por anexo, sobre linhas já lidas: no pior caso (`Office365` do PGM, 1.488 fileiras) é
  desprezível ao lado das 3.157 mesclagens;
- o **teste-âncora** e as 55 linhas da tabela de comprovação: intocados (`R-ANX-09`);
- os dois `.xlsx` de análise: **byte a byte inalterados**.

### 8.4 O delta esperado

**Cinco cortes mudam de linha no PGM. Nada mais, em lugar nenhum.**

| Âncora | Esperado |
|---|---|
| `PACOTE_DO_PILOTO` (`.docx`) | **Inalterado, entrada por entrada.** Régua de não-vazamento (`D-08`) |
| `PACOTE_DO_PGM` → `word/document.xml` | **Muda.** Reancoragem com justificativa, no rito do cabeçalho de `test_identidade_dos_artefatos.py` |
| `PACOTE_DO_PGM` → demais entradas | **A medir na fase A, não a prever.** Nenhuma deveria se mover |
| PGM: `Servidores` | corte **12 → 11** (0-based) |
| PGM: `ServidoresSemDesenv` | corte **11 → 10** |
| PGM: `SDWAN` | corte **8 → 13** |
| PGM: `SOA` | corte **5 → 8** |
| PGM: `Office365` | corte **16 → 21** |
| PGM: seções | **18 → 18** |
| PGM: tabelas | **34 → 34.** Nenhum corte novo é atravessado por mesclagem (medido), então nenhum anexo passa de duas tabelas para uma |
| PGM: fileiras com `w:tblHeader` | **18 → 18**, mas **5 delas trocam de identidade**: deixam de ser linha de dados e passam a ser o cabeçalho de colunas |
| `ANALISE_DO_PILOTO` e `ANALISE_DO_PGM` (`.xlsx`) | **Inalterados** |
| Achados de qualquer par | **Inalterados** — `V-ANX-02` não dispara em nenhum dos dois |

**Critério de aceite:**

1. qualquer movimento no pacote do piloto **reprova a entrega** — é o sinal de que a resolução mudou
   um índice que estava certo;
2. qualquer tabela ou seção a mais ou a menos no PGM **reprova a entrega**;
3. qualquer achado novo em qualquer dos dois pares **reprova a entrega**;
4. o teste do §8.2 tem de **reprovar antes** da correção e passar depois. Se ele passa antes, está
   escrito errado.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| **A âncora transcrita errada mover um índice hoje correto** | `R-CAB-06` mais o `PACOTE_DO_PILOTO`. São duas redes independentes: uma compara com a medição do GRC, a outra com o documento inteiro, entrada por entrada |
| Uma planilha renomear o cabeçalho e o anexo perder a repetição em silêncio | `V-ANX-02`. É a razão de a validação estar nesta espec e não numa seguinte: sem ela, trocamos um defeito ruidoso por um defeito mudo |
| A âncora casar uma linha de dados que por acaso comece pelos mesmos rótulos | Improvável por construção — as âncoras são rótulos de coluna (`Qtde RAM(GB)`, `PrimeID`, `Data Migração Nuvem`) — e detectável: `R-CAB-06` no piloto e o teste do §8.2 nos dois pares. Se acontecer, a resposta é **alongar a âncora**, não trocar o mecanismo |
| Alguém "simplificar" a resolução de volta para o número | `R-CAB-05` mantém o número no JSON, e é exatamente o convite. A defesa é `R-CAB-06`, que só se escreve se os dois existirem, e o comentário no `anexo_reader.py` explicando por que há dois |
| Reancorar às cegas o pacote do PGM | Prova por desligamento: forçando `localizar_cabecalho` a devolver o índice configurado, o pacote tem de voltar ao hash de hoje, entrada por entrada. Mesma prova das ESPECs 028 e 036 |
| O FTM, que originou a espec, não estar coberto pela suíte | Reconhecido, e é `I-02`. A âncora `["Nº", "Secretaria", "Nome"]` resolve o caso pela leitura do print — o cabeçalho do FTM tem esses rótulos —, mas isso é **previsão, não medição**. A confirmação exige gerar o documento do FTM depois da entrega |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | Repetir o cabeçalho dos blocos **secundários** (`NAS` linha 40, `OutrosServicos` 7 e 11)? Exigiria uma tabela por bloco, não duas por anexo | Não. Espec própria, e revisaria o corte da ESPEC 004 inteiro |
| `I-02` | Versionar um par do FTM como terceira fixture? É o caso que originou a espec, e é o único com `Office365` de preâmbulo curto | Não bloqueia a entrega. Bloqueia a afirmação de que o FTM está corrigido — que hoje é previsão (§9) |
| `I-03` | A âncora deve ser **por anexo** ou poderia ser derivada do piloto em tempo de execução? | Não. Decidido por `D-01`: derivar em execução amarraria o catálogo a uma fixture de teste e tornaria a configuração ilegível na revisão |
| `I-04` | `V-ANX-02` deve listar a âncora esperada no `detalhe`? Ajuda o suporte; é vocabulário interno para quem confere | Não. Decidido no texto da §5.1 — vai no `detalhe`, que é a parte recolhida do cartão (`R-DOC-05`) |

## 11. Relação com a ESPEC 004 e a `R-ANX-11`

A `R-ANX-11` diz:

> A linha de cabeçalho de colunas **se repete no topo de cada página** do anexo. É a única
> divergência deliberada em relação ao GRC — ver §4.2

E o §4.2, ao explicá-la:

> **Qual linha é o cabeçalho** varia por anexo: em `Usuários` é a 8ª da aba, em `NAS` é a 7ª, porque
> antes dela vêm título, resumo e subtítulo (§3.1). **O número da linha entra na configuração, ao
> lado da orientação e do corpo de fonte.**

A regra está certa e não muda: o cabeçalho se repete, e o corte em duas tabelas continua sendo o
único jeito de consegui-lo no Word. O que esta espec corrige está na última frase do §4.2, e é uma
troca de categoria:

| O que entra na configuração | É propriedade de… | Varia entre planilhas? |
|---|---|---|
| Orientação (retrato/paisagem) | do **formato**, medida no GRC | Não |
| Corpo de fonte (3,5 a 11 pt) | do **formato**, medida no GRC | Não |
| **Número da linha do cabeçalho** | do **arquivo** — de quantos blocos de resumo aquele órgão tem | **Sim** |

As duas primeiras podem ser um valor fixo porque descrevem como o GRC imprime a aba. A terceira foi
posta "ao lado" delas, e descreve **um arquivo específico**. O §4.2 chega perto de dizer isso —
*"porque antes dela vêm título, resumo e subtítulo"* — e para uma linha antes: se o cabeçalho está
na 8ª **porque** há três coisas antes dele, então o que identifica o cabeçalho é o que ele é, e o
número é só onde ele calhou de estar naquela planilha.

Com uma planilha só, a do piloto, "a linha 17" e "a linha `Nº | Secretaria | Nome`" são a mesma
coisa, e não havia como distinguir a afirmação certa da errada. Com o PGM, e depois com o FTM, elas
se separam: o preâmbulo é do órgão, o cabeçalho é do formato. Esta espec troca o meio e mantém o fim
— e a `linha_cabecalho` que sobra não é resíduo: é a medição original virada oráculo (`D-03`).

Continua valendo, sem alteração, a reversibilidade que o §4.2 previu — *"um anexo que não deva
repetir declara isso no `anexos.json`"*: uma âncora vazia é a declaração de que aquele anexo não
repete cabeçalho, e cai no mesmo caminho de `R-CAB-04`.

É o mesmo movimento da ESPEC 017 sobre a grade do contrato, que trocou o catálogo fixo pela
derivação a partir do documento, e o da ESPEC 036 sobre a página vazia: **o que a planilha diz vale
mais do que o que nós anotamos sobre ela**.

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Script de transcrição das âncoras, `anexos.json` e o inventário do delta do PGM, antes de qualquer código (`D-07`, `D-08`) | P |
| B | Testes escritos antes: os seis casos de `R-CAB-02`/`03`/`04`, o `R-CAB-06` e **o teste do §8.2**, que tem de reprovar | P |
| C | `cabecalho.py` e a resolução no `AnexoReader` | PP |
| D | `V-ANX-02` e registro no contêiner | PP |
| E | Reancoragem do `PACOTE_DO_PGM`, com o delta provado por desligamento | P |
| F | `README`, `CHANGELOG` e as notas na ESPEC 004 §4.1 e `R-ANX-11` | PP |

**Estimativa: meio dia.** O código é curto — uma função pura e três linhas no leitor —, e o trabalho
está em A, em B e em E. Não há decisão de negócio pendente: `I-01` e `I-02` são posteriores à
entrega, e nenhum dos dois a bloqueia.