# TASKS 037 — Backlog de "A linha de dados que virou cabeçalho"

| | |
|---|---|
| **Especificação** | [ESPEC 037](../specs/037-a-linha-de-dados-que-virou-cabecalho.md) v1.0 |
| **Plano** | [PLANO 037](../plans/037-plano-a-linha-de-dados-que-virou-cabecalho.md) v1.0 |
| **Versão** | 1.0 — 2026-08-31 |
| **Total** | 32 tarefas · 6 portões · 5 insumos em aberto. **32 executadas** |
| **Status** | **Implementada** — 2026-08-31. Os seis portões fechados. Backend **1.527 → 1.543 passed**; `ruff` e `mypy` limpos. **Um artefato reancorado**, o `PACOTE_DO_PGM`, com o delta provado por desligamento de uma linha; o piloto não se moveu. PGM: 18 seções, 34 tabelas e 18 fileiras marcadas **antes e depois** — cinco delas trocaram de identidade. `V-ANX-02` entrou na mesma entrega (regra 6) e não dispara em par versionado nenhum. Ver §10 |

> **Escrito antes da implementação.** A §10 é a única seção que não pode ser escrita agora, e é a
> que a próxima entrega vai ler.

> **A `E3` não vai para `main` sem a `E4`.** Hoje uma planilha com o cabeçalho renomeado produz uma
> linha errada em cada página — errado, e **visível**. Depois da `E3` e sem a `E4`, produz um anexo
> sem repetição: correto, discreto e mudo. É a única forma de esta entrega sair pior que o defeito.

> **A rede da `T-2323` vale mais que os cinco casos que ela corrige.** As cinco fileiras erradas do
> PGM são o sintoma; o mecanismo que as produziu sobrevive à correção e produzirá a sexta na próxima
> planilha. Se alguma tarefa cair no corte, **não é essa**.

---

## 1. Convenções

**Identificadores** `T-23nn`, continuando de `T-2314`, a última da ESPEC 036.

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`python -m pytest` verde — **com o `-m`**, e **sem `--timeout`**, que este projeto não tem instalado.

**Convenção de commit** `<tipo>(T-2nnn): descrição`. A resolução por âncora é `fix(...)`; `V-ANX-02`
é `feat(...)`; catálogo, teste e régua são `test(...)`/`chore(...)`; `README`, spec e CHANGELOG são
`docs(...)`. **Nunca dois tipos no mesmo commit.**

### 1.1 Seis regras que atravessam este backlog

**1 — A linha de base não é o `HEAD`, e desta vez são duas entregas alheias.** A árvore carrega a
ESPEC 035 **e** a ESPEC 036, ambas entregues e **não commitadas** — e a 036 **reancorou o
`PACOTE_DO_PGM` nesta árvore**. A constante que está no arquivo hoje é a dela, não a do `24acc9e`.

*O sinal no diff:* um valor "de antes" medido contra o `HEAD`, ou um delta de **três seções** do PGM
atribuído a esta entrega — esse é da 036.

**2 — O `PACOTE_DO_PILOTO` não se move, e não é reancorado.** No piloto as 19 âncoras têm de resolver
**no mesmo número** que a configuração traz hoje. Ele é o único oráculo do falso positivo: nenhuma
validação pega **um** índice legítimo movido em silêncio.

*O sinal no diff:* qualquer linha alterada dentro de `PACOTE_DO_PILOTO`, `ANALISE_DO_PILOTO` ou
`ANALISE_DO_PGM`.

**3 — O risco não é sobrar marca; é sumir marca, ou sumir tabela.** Uma fileira de dados marcada é o
defeito que se está corrigindo, e ele é visível na primeira folha. Um anexo que **perca** a repetição
some sem ruído; um corte novo atravessado por mesclagem faria `corte` virar `None` e derrubaria o
anexo de duas tabelas para uma, levando o preâmbulo junto.

*O sinal no diff:* uma contagem do PGM diferente de **18 seções, 34 tabelas, 18 fileiras marcadas**.

**4 — `docx_renderer.py` e `ooxml.py` não são tocados.** `linha_cabecalho = None` já significa "não
marcar" nos **dois** caminhos — `Anexo.corte` devolve `None`, e `anexo.linha_cabecalho == inicio` é
`False`. A falha segura de `R-CAB-04` sai de graça.

*O sinal no diff:* qualquer linha alterada em `infrastructure/report/docx_renderer.py` ou
`infrastructure/report/ooxml.py`.

**5 — `linha_cabecalho` não é resíduo.** Ele sai da renderização e vira o oráculo da `T-2324`
(`R-CAB-05`, `D-03`). Apagá-lo joga fora a única medição independente que existe, e é o convite mais
provável de uma revisão futura.

*O sinal no diff:* `linha_cabecalho` removido de `anexos.json` ou de `ConfiguracaoDeAnexo`, ou a
`T-2324` reescrita para comparar a âncora consigo mesma.

**6 — A resolução sem o achado não é entrega.** `E3` e `E4` vão juntas para `main`.

*O sinal no diff:* um commit de `E3` sem `v_anx_02_cabecalho_nao_localizado` na mesma entrega.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase | Depende de decisão? |
|---|---|---|---|---|
| **E0** Linha de base, régua e o defeito nomeado | T-2315 … T-2319 | **P0** | F0 | não |
| **E1** O catálogo e a rede que faltava | T-2320 … T-2325 | **P1** | F1 | não |
| **E2** A resolução, provada sem renderizar | T-2326 … T-2330 | **P2** | F2 | não |
| **E3** Os documentos e a única reancoragem | T-2331 … T-2336 | **P3** | F3 | não |
| **E4** O achado | T-2337 … T-2341 | **P4** | F4 | não |
| **E5** O conjunto | T-2342 … T-2346 | **P5** | F5 | não |

### 2.1 A régua da entrega — o que pode mudar de comportamento

| Muda | Não muda |
|---|---|
| PGM: cinco cortes de anexo mudam de linha (`T-2329`) | PGM: **18 seções, 34 tabelas, 18 fileiras marcadas** (regra 3) |
| PGM: cinco fileiras marcadas **trocam de identidade** — deixam de ser linha de dados | `PACOTE_DO_PILOTO` — entrada por entrada (regra 2) |
| `PACOTE_DO_PGM` → `word/document.xml`, e o que mais a `T-2334` medir | `ANALISE_DO_PILOTO` e `ANALISE_DO_PGM` — byte a byte |
| `anexos.json`: campo `cabecalho` nos 19 anexos | `linha_cabecalho`, que fica (regra 5); `medidas_grc.json` |
| `AnexoReader._anexo`: resolve o índice pela âncora | `docx_renderer.py`, `ooxml.py`, `Anexo.corte`, `Anexo.vazio` (regra 4) |
| `cabecalho.py` — arquivo novo, função pura | `aba_reader.py`, `figuras.py` |
| `annex_validations.py` — `V-ANX-02` ao lado de `V-ANX-01` | `v_anx_01`, que a 036 acabou de escrever (§7 do PLANO) |
| `README.md`; ESPEC 004 `R-ANX-11`/§4.1/§4.2; `CHANGELOG.md`; `Status` da ESPEC 037 | Os achados dos dois pares versionados — lista por lista |
| | `frontend/` e `api/schemas.py`; o teste-âncora; a tabela de comprovação; a capa |

---

## 3. Épico E0 — Linha de base, régua e o defeito nomeado `[portão P0]`

> **Nenhum arquivo de `src/` é tocado neste épico.**

#### T-2315 — Reproduzir os quatro pacotes nesta árvore `[portão, risco]`
**Tamanho:** PP · **Ref:** PLANO §7, **P1**, **P3**, regra 1

`python -m pytest tests/test_identidade_dos_artefatos.py -q`, e registrar o resultado. Os quatro
alvos: `PACOTE_DO_PILOTO`, `PACOTE_DO_PGM`, `ANALISE_DO_PILOTO`, `ANALISE_DO_PGM`.

**É a tarefa mais importante deste épico, e o motivo é mais forte que na 036.** Lá a régua era o que
a 035 *declarava* não ter movido. Aqui o `PACOTE_DO_PGM` **foi mesmo movido**, pela ESPEC 036, nesta
árvore, e **não foi commitado**. A constante no arquivo é o valor pós-036. Medir contra `24acc9e`
daria o pacote pré-036 e atribuiria a esta entrega um delta de três seções que é da entrega anterior.

**Reprovando, esta entrega para aqui.** Não se corrige a 035 nem a 036 dentro do PLANO 037:
registra-se o achado, resolve-se lá, e a `E0` recomeça.

**Pronto quando:** os quatro testes verdes nesta árvore, com o comando, a data e o valor de
`PACOTE_DO_PGM` transcrito neste documento — é ele que a `T-2334` tem de fazer voltar.

---

#### T-2316 — Linha de base da suíte
**Tamanho:** PP · **Ref:** **P5**

`python -m pytest -q` completo. **Coletados hoje: 1.527** (medido em 2026-08-31, nesta árvore, com
a 035 e a 036 dentro). Registrar o `passed` e a lista de falhas, se houver.

**Rodar sozinha, e conferir o `uvicorn` antes.** É a lição que a ESPEC 036 §10 deixou escrita:
`test_desempenho.py::test_o_custo_de_um_anexo_e_linear` é razão de tempo, e o servidor de
desenvolvimento com `--reload` consumia ~2/3 de um núcleo continuamente, varrendo a árvore. Antes de
medir: `uvicorn` no ar? ou parar, ou registrar que o número saiu com ele.

**A suíte de navegador não entra na linha de base** — `T-2319` confirma as três razões (PLANO `F5`).

**Pronto quando:** o número e a lista estão neste documento.

---

#### T-2317 — Congelar o defeito, fileira por fileira `[portão, risco]`
**Tamanho:** P · **Ref:** **P0**, **P3**

Renderizar os dois pares e listar **toda** fileira com `w:tblHeader`, com o texto das sete primeiras
células. O esperado, medido em 2026-08-31:

| par | marcadas | das quais erradas |
|---|---|---|
| piloto | **20** — 1 da comprovação + 19 de anexo | **0** |
| PGM | **18** — 2 da comprovação + 16 de anexo | **5** |

As cinco do PGM, e é este texto que a `T-2333` tem de ver desaparecer:

| anexo | fileira marcada hoje |
|---|---|
| `Servidores` | `D84V50I \| 1 \| 2 \| 80 \| 20 \| 0 \| 0` |
| `ServidoresSemDesenv` | `C68V13I \| 2 \| 4 \| 70 \| 10 \| 0 \| 0` |
| `SDWAN` | `LINK DE CONECTIVIDADE \| … \| 2 \| ·` |
| `SOA` | `SN1403 \| PIDE-PLANO DE INFORMATIZAÇÃO… \| 944 \| ·` |
| `Office365` | `PERFIL POWER BI PRO \| … \| 10 \| 5 \| 0 \| 5 \| 5` |

**No PGM a comprovação marca duas fileiras, e uma delas é a de índice 1.** `_bloco_de_linhas` faz
`faixa = 1 if titulo else 0` e marca `tabela.rows[faixa]`: o bloco final da ESPEC 018 `D-06` tem
faixa de título, então a marca cai na segunda fileira. Quem não souber disso vai achar que encontrou
um sexto defeito.

**Este é o artefato pós-036.** As 18 seções e 34 tabelas do PGM já são o estado com a 036 dentro.

**Pronto quando:** as duas listas estão transcritas neste documento, reproduzidas e não copiadas
desta tabela.

---

#### T-2318 — Congelar a forma dos dois documentos `[portão]`
**Tamanho:** PP · **Ref:** **P3**

| medida | piloto | PGM |
|---|---|---|
| seções | **21** | **18** |
| tabelas | **39** | **34** |
| fileiras com `w:tblHeader` | **20** | **18** |

**As três do PGM são o portão** (regra 3), e nenhuma delas pode mudar. Seção é página; tabela é
conteúdo; fileira marcada é a conveniência de leitura que esta entrega existe para consertar — não
para diminuir.

**Pronto quando:** os seis números reproduzidos nesta árvore.

---

#### T-2319 — As dez buscas `[risco]`
**Tamanho:** PP · **Ref:** PLANO §8

Oito sobre `backend/`: `tblHeader|repetir_cabecalho|repetir=`;
`_tem_cabecalho_repetido|se_repete|cai_na_primeira_fileira`; `linha_cabecalho|Anexo\(`;
`PACOTE_DO_|ANALISE_DO_|partes\(`; `documento_do_pgm|artefatos_do_pgm|docx_do_piloto|anexos_do_pgm`;
`PERGUNTA|Severity\.`; `anexos_configurados|ConfiguracaoDeAnexo`; `CABECALHO_COLUNAS|_bloco_de_linhas`.

Duas sobre `frontend/`: `Achado|severidade|AVISA`; `cabeçalho|anexo`.

**A busca 2 é a que revela a lacuna.** `test_docx_anexos.py:228,234,252` já olham a marca —
`test_o_cabecalho_de_usuarios_se_repete`, `test_a_marca_de_cabecalho_cai_na_primeira_fileira_da_tabela`
e `test_todo_anexo_de_mais_de_uma_pagina_repete_o_cabecalho`. **Os três afirmam posição; nenhum
afirma identidade**, e os três rodam só sobre o piloto. É exatamente por isso que o defeito
atravessou o versionamento.

**A busca 8 é a que engana.** A comprovação usa o mesmo `repetir_cabecalho` dos anexos, e no PGM
marca a fileira 1 (`T-2317`). Um teste que trate as duas famílias como uma só, ou que assuma
`rows[0]`, passa no piloto e falha no PGM por um motivo que nada tem a ver com esta espec.

**Pronto quando:** o inventário está fechado por escrito, com arquivo, linha e o que cada âncora
afirma, e a tabela da ESPEC §8.4 reflete o achado.

---

## 4. Épico E1 — O catálogo e a rede que faltava `[portão P1]`

> **O catálogo é inerte por construção.** `anexos_configurados()` lê chaves nomeadas; um campo novo
> que ninguém consulta não muda um byte. É isso que permite escrever a rede antes da resolução, e
> vê-la reprovar **nomeando os cinco**.

#### T-2320 — Script de transcrição das âncoras
**Tamanho:** PP · **Ref:** `D-07`

Em `scripts/`, no molde de `medir_anexos_grc.py`: abre o piloto, lê cada aba pela `AbaReader`, pega
a fileira `linha_cabecalho - 1`, descarta as células sem texto e emite os três primeiros rótulos.

**Transcrição não se faz à mão.** São 19 tuplas com acento, asterisco, parêntese e `Nº`
(`Download*`, `Qtde RAM(GB)`, `COD. MPLS`). `anexos.json` continua sendo configuração humana — a
**revisão** é humana; a digitação não precisa ser.

**Pronto quando:** o script roda e emite as 19 tuplas.

---

#### T-2321 — As 19 âncoras em `anexos.json`
**Tamanho:** P · **Ref:** `R-CAB-01`, `R-CAB-05`

Campo `cabecalho` em cada anexo, com a saída revisada da `T-2320`, e
`ConfiguracaoDeAnexo.cabecalho: tuple[str, ...]`. **`linha_cabecalho` fica** (regra 5).

| aba | `linha_cabecalho` | `cabecalho` |
|---|---|---|
| `Detalhes` | 1 | `Servidor`, `WEB`, `Serviço` |
| `DetalhesSemDesenv` | 1 | `Servidor`, `WEB`, `Serviço` |
| `Servidores` | 13 | `Servidor`, `vCPU`, `Qtde RAM(GB)` |
| `ServidoresSemDesenv` | 12 | `Servidor`, `vCPU`, `Qtde RAM(GB)` |
| `BD` | 15 | `CLIENTE`, `GERENCIADOR`, `PROJETO` |
| `Usuários` | 8 | `Nº`, `Secretaria`, `Login` |
| `NAS` | 7 | `Secretaria`, `Pasta`, `Share` |
| `Central de Servicos` | 4 | `Unidade`, `Qtde` |
| `Colocation` | 8 | `HOST`, `UNIDADE`, `QUANTIDADE` |
| `Comunicação Dados` | 11 | `COD. MPLS`, `DATA ACEITE`, `ORGÃO SIGNATÁRIO` |
| `SDWAN` | 9 | `Seq`, `PrimeID`, `Secretaria` |
| `WIFI` | 5 | `Unidade`, `Quantidade Medida` |
| `CertificadosDigitais` | 3 | `SECRETARIA`, `URL`, `DATA VALIDADE` |
| `Internet` | 7 | `Download*`, `Kbps`, `Mbps` |
| `SOA` | 6 | `Seq`, `Data`, `Projeto` |
| `OutrosServicos` | 3 | `Descrição`, `Qtde` |
| `Office365` | 17 | `Nº`, `Secretaria`, `Nome` |
| `ServicosVcloud` | 6 | `VM`, `vCPU`, `Memória` |
| `ServicosEmNuvem` | 2 | `Descrição`, `Qtde` |

**Três rótulos por âncora, e não um.** Medido: **um** já resolveria as duas planilhas versionadas.
Três é margem, e é grátis — o custo de discriminar é zero e o de não discriminar aparece na planilha
do mês que vem. Quatro anexos só têm dois rótulos no cabeçalho, e ficam com dois.

**Pronto quando:** o JSON valida, `anexos_configurados()` devolve as 19 âncoras, e nenhuma está
vazia.

---

#### T-2322 — O catálogo é inerte `[portão]`
**Tamanho:** PP · **Ref:** **P1**

`python -m pytest tests/test_identidade_dos_artefatos.py -q` → **quatro verdes**, sem tocar constante
nenhuma. E `1.527` ainda coletados.

**Pacote movido aqui significa que alguém antecipou a `E2`** — e o portão `P1` perde o sentido: um
documento que se mova nesta altura deixa de ter dono.

**Pronto quando:** os quatro verdes, com o `git diff` de `src/` mostrando **só** `anexos.json` e a
linha do campo em `configuracao.py`.

---

#### T-2323 — A rede que faltava `[portão, risco]`
**Tamanho:** P · **Ref:** ESPEC §8.2

Nos dois documentos: **toda** fileira com `w:tblHeader` ou traz os rótulos de
`layout.CABECALHO_COLUNAS`, ou **começa pela âncora de algum anexo** de `anexos.json`.

```python
def _rotulos_da_fileira(fileira: Any) -> tuple[str, ...]:
    """Textos não vazios, com repetições **consecutivas** colapsadas."""
    saida: list[str] = []
    for celula in fileira.cells:
        texto = celula.text.strip()
        if texto and (not saida or saida[-1] != texto):
            saida.append(texto)
    return tuple(saida)
```

**O colapso de repetições consecutivas não é esperteza: é como o `python-docx` expõe uma célula
mesclada.** `fileira.cells` devolve o mesmo objeto uma vez por posição da grade, então o cabeçalho de
`Office365` no piloto sai `Nº | Secretaria | Nome | Nome | Nome | Nome | Login`. Do lado da planilha
o `openpyxl` faz o contrário — guarda o valor só na âncora e deixa as demais vazias. **As duas
normalizações precisam encontrar-se no meio**, e é isso que faz a mesma âncora valer para o SMIT,
onde `Nome` ocupa quatro colunas, e para o FTM, onde ocupa uma.

Conferido contra as 20 fileiras do piloto: `CertificadosDigitais` (`SECRETARIA | URL | URL | DATA
VALIDADE`), `Central de Servicos` (`Unidade | Unidade | Qtde`) e `WIFI` (`· | · | Unidade |
Quantidade Medida | · | · | ·`) só passam com o colapso **e** com o descarte de vazias.

**Compara contra a união das 19 âncoras, não contra a âncora daquele anexo.** É mais fraco, e é
deliberado: dispensa mapear tabela → aba nos dois documentos e ainda pega os cinco casos, porque uma
linha de dados não casa âncora nenhuma. A forma forte — cada anexo contra a **sua** — está disponível
via `tabelas_por_anexo`, e entra se a fraca deixar passar alguma coisa na `E3`.

**Pronto quando:** o teste existe, fica **verde no piloto** e **vermelho no PGM**, nomeando na
mensagem de falha os cinco anexos da `T-2317`.

---

#### T-2324 — `R-CAB-06`: a âncora resolve a linha medida
**Tamanho:** PP · **Ref:** `R-CAB-06`, `D-03`, regra 5

Para os 19 anexos do piloto, `localizar_cabecalho(forma.linhas, config.cabecalho)` devolve
`config.linha_cabecalho - 1`.

**É a razão de `linha_cabecalho` continuar existindo.** As âncoras foram transcritas de uma planilha;
os números foram medidos no GRC, por outro caminho e em outro incremento. Comparar os dois é a única
rede que pega uma âncora transcrita errada **antes** de ela virar documento — e é um teste que só se
escreve se os dois existirem.

**Reprova por `ImportError`, e isso é declarado aqui** — `cabecalho.py` só existe na `E2`. Vermelho
certo, no precedente da `T-2292` da ESPEC 036.

**Pronto quando:** o teste existe e reprova por `ImportError`, não por asserção.

---

#### T-2325 — Conferir **como** cada teste reprova `[portão]`
**Tamanho:** PP · **Ref:** **P1**

| tarefa | reprova por |
|---|---|
| T-2323 | **valor** — cinco fileiras do PGM sem âncora correspondente, **nomeadas** |
| T-2324 | **`ImportError`** — o módulo não existe ainda |

**Teste que passa aqui é teste que não afirma nada.** E há um jeito específico de a `T-2323` passar
por engano: comparando **posição** em vez de rótulo, ou esquecendo o colapso de repetições — que a
faria reprovar no piloto também, por motivo errado, e o vermelho pareceria certo.

**Não escrever `cabecalho.py` durante uma espera.** É a lição literal da ESPEC 036 §10: código
adiantado transformou um `ImportError` declarado num verde silencioso, e o vermelho que provaria o
teste teve de ser reconstruído removendo o arquivo.

**Pronto quando:** a tabela acima está conferida linha por linha neste documento, com a mensagem de
falha da `T-2323` transcrita.

---

## 5. Épico E2 — A resolução, provada sem renderizar `[portão P2]`

#### T-2326 — `cabecalho.py`, a função pura
**Tamanho:** PP · **Ref:** `R-CAB-02`, `R-CAB-03`, `D-01`, `D-02`

Arquivo novo `infrastructure/annex/cabecalho.py`:

```python
def _rotulos(linha: tuple[CelulaAnexo, ...]) -> tuple[str, ...]:
    """Os textos da fileira, na ordem, **descartadas as vazias**.

    Descartar é o que torna a comparação indiferente a mesclagem: o `openpyxl`
    guarda o valor só na âncora da região, então `Nome | · | · | ·` e `Nome`
    dão o mesmo rótulo.
    """
    return tuple(c.texto.strip().casefold() for c in linha if c.texto.strip())


def localizar_cabecalho(
    linhas: tuple[tuple[CelulaAnexo, ...], ...], ancora: tuple[str, ...]
) -> int | None:
    """A **primeira** fileira cujos rótulos **começam** pela âncora."""
    if not ancora:
        return None
    chave = tuple(r.strip().casefold() for r in ancora)
    for indice, linha in enumerate(linhas):
        if _rotulos(linha)[: len(chave)] == chave:
            return indice
    return None
```

**As duas escolhas do `D-02` são medidas, e o comentário do módulo tem de dizer por quê:**

- **prefixo, não igualdade** — `BD` traz `VOLUME GB | PERFIL` no piloto e `AMBIENTE | VOLUME GB | …`
  no PGM. Igualdade devolveria `None` para uma aba que hoje está **certa**, e a correção quebraria o
  que funcionava;
- **primeira, não única** — os rótulos se repetem dentro da aba: `NAS` casa nas linhas 7 e **40** do
  piloto e 7 e **179** do PGM; `OutrosServicos` casa em 3, **7** e **11** do PGM. Exigir unicidade
  reprovaria três das 35 combinações, todas hoje corretas.

**`casefold` e `strip`, e acento não se dobra** (`R-CAB-02`). Dobrar acento criaria casamentos que
ninguém pediu, e a medição diz que não é preciso.

**Pronto quando:** o módulo existe, `ruff` e `mypy` limpos, e a `T-2328` verde.

---

#### T-2327 — O leitor resolve pela âncora
**Tamanho:** PP · **Ref:** `R-CAB-01`, `D-04`

Em `AnexoReader._anexo`
([anexo_reader.py:53-55](../../backend/src/infrastructure/annex/anexo_reader.py#L53-L55)):

```python
# ESPEC 037 `R-CAB-01` — o cabeçalho é localizado pelos rótulos, não pelo
# número. `config.linha_cabecalho` continua no JSON e **não é lido aqui**: ele
# é a medição do GRC, e serve de oráculo à `R-CAB-06`. Ver `D-03`.
cabecalho = localizar_cabecalho(forma.linhas, config.cabecalho)
```

Mais a docstring de `configuracao.py` — a quarta coisa que o anexo declara deixa de ser um número —
e o comentário de `Anexo.linha_cabecalho`, que passa a dizer *"resolvido na leitura"*.

**O comentário é obrigatório, e é a regra 5.** Sem ele, a próxima revisão vê dois campos para a mesma
coisa e apaga o certo.

**`Anexo.corte` não muda** (regra 4). Com `None`, ele devolve `None` e o outro caminho
(`anexo.linha_cabecalho == inicio`) fica `False`: a falha segura de `R-CAB-04` já existe.

**Pronto quando:** a `T-2324` fica verde.

---

#### T-2328 — Os seis casos construídos
**Tamanho:** P · **Ref:** `R-CAB-02` a `R-CAB-04`

Sobre `CelulaAnexo`, **sem planilha e sem renderização** — exceto o último, que é de documento:

| # | Caso | Afirma |
|---|---|---|
| a | Mesmo cabeçalho com preâmbulo de 3, 8 e 20 linhas | O índice acompanha o preâmbulo. É o defeito, em miniatura |
| b | `Nome` mesclado em 4 colunas × `Nome` em 1 | Mesma âncora resolve os dois — é o caso SMIT × FTM |
| c | `" nº "`, `"Nº"`, `"NÚMERO"` | Caixa e espaço não separam; **acento e palavra, sim** |
| d | Âncora que é prefixo de um cabeçalho mais largo | Resolve — é o caso `BD` |
| e | Âncora presente em duas fileiras | Resolve na **primeira** — é o caso `NAS` |
| f | Anexo **com conteúdo** e sem a âncora | `linha_cabecalho is None`, **nenhuma** fileira com `w:tblHeader` no documento, e o anexo sai **numa tabela só, com todas as suas linhas** |

**O caso `f` é de documento de propósito.** Ele afirma `R-CAB-04` onde ela importa — no artefato — e
não pela leitura do código. É o único dos seis que passa pelo renderizador, e é o que prova que a
falha segura de fato saiu de graça.

**Pronto quando:** os seis verdes.

---

#### T-2329 — A sonda dos 35 índices `[portão, risco]`
**Tamanho:** PP · **Ref:** **P2**

`AnexoReader().ler(...)` nas duas planilhas, imprimindo `aba → linha_cabecalho` resolvido. **~10 s,
sem renderizar nada.**

| planilha | anexos resolvidos | índices que mudam |
|---|---|---|
| `levantamento.xlsx` | 19 | **nenhum** |
| `levantamento_pgm.xlsx` | 16 (3 abas ausentes) | **exatamente cinco** |

Os cinco, em índice 0-based:

| aba | hoje | depois | (1-based, como se lê a planilha) |
|---|---|---|---|
| `Servidores` | 12 | **11** | 13 → 12 |
| `ServidoresSemDesenv` | 11 | **10** | 12 → 11 |
| `SDWAN` | 8 | **13** | 9 → 14 |
| `SOA` | 5 | **8** | 6 → 9 |
| `Office365` | 16 | **21** | 17 → 22 |

**Este é o portão que decide a entrega.** Ele responde às duas perguntas que importam — *mexi em
algum índice que estava certo?* e *os cinco foram para os valores previstos?* — em dez segundos, sem
ambiguidade e **antes** de custar ~115 s de renderização de PGM. Um índice do piloto fora do lugar
aqui reprova antes de alguém ser tentado a explicar um hash movido.

**Reprovando:** reverter a `T-2326`/`T-2327` e voltar à `T-2328`. Não reancorar, não "conferir se o
documento continua bonito".

**Pronto quando:** as duas tabelas batem, aba por aba, nesta árvore.

---

#### T-2330 — O teste do teste `[portão]`
**Tamanho:** PP · **Ref:** **P2**

`T-2324` **verde**. `T-2323` **ainda vermelha no PGM** — o documento não foi regerado nesta fase, e
é a `E3` que a vira.

**Uma `T-2323` verde aqui não é boa notícia:** ou o documento foi regerado sem que o portão `P2`
fosse fechado, ou a rede está comparando posição. As duas merecem investigação antes de seguir.

**Pronto quando:** os dois estados conferidos e registrados.

---

## 6. Épico E3 — Os documentos e a única reancoragem `[portão P3]`

> **Nenhum arquivo de `src/` é tocado neste épico.** O código já está pronto desde a `E2`; aqui só se
> mede, se prova e se reancora.

#### T-2331 — O piloto, entrada por entrada `[portão]`
**Tamanho:** PP · **Ref:** **P3**, regra 2, `D-08`

`PACOTE_DO_PILOTO` **idêntico** à `T-2315`. Sem exceção, sem reancoragem, sem "só o `document.xml`".

**É o único oráculo do falso positivo desta entrega.** No piloto as 19 âncoras resolvem no número de
hoje (`T-2329`), então o documento tem de sair idêntico — 19 anexos reais, 15.955 células escritas.
Um movimento aqui é um índice que estava certo e deixou de estar, e **nada mais no repositório o
denunciaria**.

**Pronto quando:** verde, e o `git diff` da constante **vazio**.

---

#### T-2332 — As três medidas do PGM `[portão]`
**Tamanho:** PP · **Ref:** **P3**, `R-CAB-07`, regra 3

Os números da `T-2318`, agora: **18 seções, 34 tabelas, 18 fileiras marcadas**. **Nenhum muda.**

**As três dizem coisas diferentes, e todas importam:**

- **seções** — nada nesta entrega omite ou cria página; um movimento aqui é vazamento da 036;
- **tabelas** — é a regra 3. Um corte novo atravessado por mesclagem faria `Anexo.corte` devolver
  `None` e o anexo cairia de duas tabelas para uma, levando junto a separação entre preâmbulo e
  corpo. Medido: nenhuma das cinco linhas novas é atravessada — **mas medido não é asseverado**;
- **fileiras marcadas** — 18 antes, 18 depois. Marca a menos é a repetição perdida em silêncio, que é
  o defeito simétrico ao que se está corrigindo.

**Pronto quando:** os três batem, medidos e não deduzidos.

---

#### T-2333 — As cinco fileiras trocam de identidade `[portão]`
**Tamanho:** PP · **Ref:** **P3**

`T-2323` **verde nos dois pares**. E, para o registro, a lista da `T-2317` refeita: as cinco fileiras
que eram `D84V50I…`, `C68V13I…`, `LINK DE CONECTIVIDADE…`, `SN1403…` e `PERFIL POWER BI PRO…` são
agora, respectivamente, `Servidor | vCPU | Qtde RAM(GB) | …`, a mesma, `Seq | PrimeID | Secretaria |
…`, `Seq | Data | Projeto | …` e `Nº | Secretaria | Nome | …`.

**É a única tarefa que mostra a correção como o usuário a vê.** Os hashes e as contagens dizem que
nada quebrou; esta diz o que melhorou.

**Pronto quando:** a rede verde nos dois, e a lista nova transcrita ao lado da velha neste documento.

---

#### T-2334 — A prova por desligamento `[portão, risco]`
**Tamanho:** P · **Ref:** **P3**, PLANO §7

Quatro passos, nesta ordem:

1. com a `E2` entregue, medir `PACOTE_DO_PGM` → **valor novo**, guardado;
2. em `AnexoReader._anexo`, trocar **uma linha** — `cabecalho = config.linha_cabecalho - 1` —, sem
   tocar `anexos.json`, `cabecalho.py` nem os testes → medir de novo;
3. o pacote tem de voltar **entrada por entrada** ao valor da `T-2315` — **o valor da 036**, e não o
   do `24acc9e`;
4. desfazer o desligamento, conferir que o valor do passo 1 volta, e **só então** escrever a
   constante.

**Reancorar porque o teste ficou vermelho é admitir a mudança sem saber o tamanho dela.** Desligar e
ver o hash **voltar** é o que transforma *"mudou"* em *"mudou exatamente isto"*. Aqui o desligamento
é **uma linha** — mais barato que o da 028 e o da 036, que precisavam desfazer duas mudanças.

**Custo:** duas renderizações de PGM, ~4 min. **`docProps/app.xml` é candidato a se mover junto** — a
ESPEC §8.4 diz *"a medir, não a prever"*. Qualquer outra entrada que se mova **reprova o portão** até
haver explicação escrita.

**Pronto quando:** os quatro passos estão registrados neste documento, com o valor de ida e o de
volta.

---

#### T-2335 — Reancorar o `PACOTE_DO_PGM`, sem apagar a 036
**Tamanho:** PP · **Ref:** **P3**, PLANO §7

Trocar o hash e escrever a justificativa no cabeçalho de `test_identidade_dos_artefatos.py`: o que
mudou, por qual espec, qual era o valor anterior, e que as demais entradas não se moveram.

**Parágrafo novo, abaixo do da 036 — nunca por cima.** Aquele arquivo já traz *"Reancorado só o PGM,
em 2026-08-31, pela ESPEC 036"*, escrito nesta árvore e ainda não commitado. Os dois hashes contam a
mesma história em dois passos, e apagar o primeiro apagaria a prova do primeiro delta.

**O cabeçalho daquele arquivo é explícito:** *"Se um destes testes ficar vermelho, a resposta padrão
**não** é reancorar."* Esta é a exceção prevista — mudança deliberada decidida em espec —, e ela só
é exceção **com a `T-2334` junto**.

**Pronto quando:** a constante trocada, o parágrafo escrito abaixo do da 036, e o teste verde.

---

#### T-2336 — Os testes de anexo passam sem alteração `[portão]`
**Tamanho:** PP · **Ref:** **P3**, `R-CAB-07`

`python -m pytest tests/test_docx_anexos.py -q` verde, **com `git diff` vazio no arquivo** — exceto
pela rede da `T-2323`, que é adição.

Os três que mais importam, e todos sobre o piloto:

- `test_usuarios_se_parte_em_preambulo_e_corpo` — 7 e 1.014 fileiras. **É o corte, afirmado por
  número:** se a resolução mexer no índice de `Usuários`, este reprova antes de qualquer hash;
- `test_o_cabecalho_de_usuarios_se_repete`;
- `test_a_marca_de_cabecalho_cai_na_primeira_fileira_da_tabela` — `marcadas in ([], [0])` para cada
  anexo.

**Pronto quando:** verde, e o diff do arquivo mostra **só** adição.

---

## 7. Épico E4 — O achado `[portão P4]`

#### T-2337 — `v_anx_02_cabecalho_nao_localizado`
**Tamanho:** PP · **Ref:** `V-ANX-02`, `D-06`

Em `infrastructure/validations/annex_validations.py` — **arquivo que a ESPEC 036 criou nesta árvore e
ainda não commitou** (PLANO §7). Função nova ao lado de `v_anx_01`, sem tocar a existente:

```python
def v_anx_02_cabecalho_nao_localizado(
    anexos: list[Anexo], achados: ValidationReport
) -> None:
    orfaos = [a.aba for a in anexos if not a.vazio and a.linha_cabecalho is None]
    if not orfaos:
        return
    achados.registrar_em_partes("V-ANX-02", Severity.AVISA, titulo=..., causa=..., acao=..., detalhe=...)
```

- **título:** *"O cabeçalho de colunas não foi localizado em alguns anexos."*
- **causa:** *"Nessas abas, nenhuma linha traz os rótulos esperados de cabeçalho. O conteúdo saiu inteiro; o que falta é a repetição do cabeçalho no topo de cada página."*
- **ação:** *"Confira se a planilha renomeou as colunas dessas abas. O restante do documento não é afetado."*
- **detalhe:** as abas, com a âncora esperada de cada uma, para o suporte.

**`not a.vazio` é a condição que separa esta validação da `V-ANX-01`.** Anexo vazio também tem
`linha_cabecalho is None`, e nele não há o que repetir — dois achados sobre o mesmo fato seriam a
`R-GRD-06` violada, que é o defeito dos 57 achados do `PA-PGM`.

**Um achado com a lista, não um por aba.** Mesma razão, e mesmo precedente da `v_anx_01` ao lado.

**Pronto quando:** o módulo tem as duas funções e a `T-2339` fica verde.

---

#### T-2338 — Registro no contêiner
**Tamanho:** PP · **Ref:** `V-ANX-02`

Em `DIContainer.gerar`, ao lado da chamada de `V-ANX-01` que a 036 pôs
([container.py:317](../../backend/src/infrastructure/di/container.py#L317)):

```python
anexos = [] if achados.bloqueado else self.leitor_de_anexos().ler(entradas.levantamento)
v_anx_01_nenhuma_aba_de_anexo_reconhecida(anexos, achados)
v_anx_02_cabecalho_nao_localizado(anexos, achados)
```

**Linha nova adjacente, sem reescrever a da 036** (PLANO §7). Bloqueado, `anexos` é `[]` e a
compreensão da `T-2337` devolve lista vazia: a validação cala sozinha, sem guarda extra.

**Pronto quando:** o registro está no lugar e a `T-2340` fica verde.

---

#### T-2339 — Dispara com conteúdo, cala com vazio `[portão]`
**Tamanho:** PP · **Ref:** **P4**

Dois casos, sobre `ValidationReport`:

- anexo **com conteúdo** e `linha_cabecalho is None` → **um** achado, `validacao == "V-ANX-02"`,
  `severidade == AVISA`, com a aba nomeada;
- anexo **vazio** e `linha_cabecalho is None` → **nenhum** achado.

**O segundo é o que impede a validação de duplicar a `V-ANX-01`.** Sem ele, uma planilha com as abas
renomeadas geraria dois achados sobre a mesma causa — e a `R-GRD-06` manda relatar a causa, não as
consequências.

**Pronto quando:** os dois verdes, com o número de achados afirmado por extenso.

---

#### T-2340 — Os achados dos dois pares, inalterados `[portão]`
**Tamanho:** PP · **Ref:** **P4**

Gerar os dois pares versionados e comparar a lista de achados, **item por item**, com a de antes.
`V-ANX-02` não pode aparecer em nenhum dos dois: as 19 âncoras resolvem no piloto e as 16 presentes
resolvem no PGM (`T-2329`).

**Achado novo em par versionado é ruído entregue em produção.**

**Pronto quando:** as duas listas idênticas.

---

#### T-2341 — A guarda da `T-2094`, conferida e **não** alterada
**Tamanho:** PP · **Ref:** PLANO §8, nº 6

`test_identidade_contratual.py:388` varre **três** módulos nomeados — os anteriores à ESPEC 029 —
procurando `PERGUNTA`. `annex_validations.py` não entra naquela lista, e não entrou pela 036:
acrescentá-lo mentiria sobre a cronologia.

O que se afirma dele é outra coisa, e já está na `T-2339`: ele registra `AVISA`.

**Pronto quando:** a guarda verde e o `git diff` de `test_identidade_contratual.py` vazio.

---

## 8. Épico E5 — O conjunto `[portão P5]`

#### T-2342 — A suíte completa
**Tamanho:** PP · **Ref:** **P5**

`python -m pytest -q`, sozinha, comparada com a `T-2316`. Esperado: **1.527 + os testes novos**,
sem remoção — nenhum teste existente é invertido por esta entrega.

**Conferir o `uvicorn --reload` antes de medir** (`T-2316`).

**Pronto quando:** verde, com o número declarado neste documento.

---

#### T-2343 — `ruff` e `mypy`
**Tamanho:** PP · **Ref:** **P5**

Nos arquivos tocados: `cabecalho.py`, `anexo_reader.py`, `configuracao.py`, `annex_validations.py`,
`container.py`, `annex.py` (só comentário) e os testes.

**O `I001` de `tests/test_divergencia_de_fonte.py` é pré-existente** e não é desta entrega — foi
registrado como `I-06` da ESPEC 036 e continua aberto.

**Pronto quando:** os dois limpos nos arquivos tocados.

---

#### T-2344 — O renderizador intocado, e nada mais reancorado `[portão]`
**Tamanho:** PP · **Ref:** **P5**, regras 2 e 4

`git diff` **vazio** em: `infrastructure/report/docx_renderer.py`, `infrastructure/report/ooxml.py`,
`test_docx_formatacao.py`, `test_capa.py`, `pacote.py`, `fixtures/linhas_do_documento.json`,
`fixtures/valores_do_contrato.json`, e as constantes `PACOTE_DO_PILOTO`, `ANALISE_DO_PILOTO` e
`ANALISE_DO_PGM`.

**Os dois primeiros são a regra 4**, e são o que separa esta entrega de uma refatoração do
renderizador que ninguém pediu. A única constante que pode ter mudado é `PACOTE_DO_PGM`, pela
`T-2335`, com a prova da `T-2334` junto.

**Cuidado com `annex_validations.py`: ele não está rastreado.** Um `git checkout` ou um
`git clean` descuidado apaga o arquivo inteiro — com a `v_anx_01` da 036 dentro.

**Pronto quando:** o diff confere, arquivo por arquivo.

---

#### T-2345 — `test_anexos_configuracao` ganha o par
**Tamanho:** PP · **Ref:** `R-CAB-05`, regra 5

Os dois testes de `linha_cabecalho` — `test_todo_anexo_declara_a_linha_de_cabecalho` e
`test_a_linha_de_cabecalho_e_contada_a_partir_de_um`
([test_anexos_configuracao.py:71-82](../../backend/tests/test_anexos_configuracao.py#L71-L82)) —
**continuam valendo sem alteração**, e ganham um terceiro: toda entrada declara `cabecalho` não
vazio.

**Manter os dois é a regra 5 virada em teste.** Eles são a razão de `linha_cabecalho` sobreviver, e
quem os apagar terá apagado o oráculo da `T-2324` sem perceber.

**Pronto quando:** os três verdes.

---

#### T-2346 — Spec, ESPEC 004, README e CHANGELOG
**Tamanho:** PP · **Ref:** PLANO §7

- `Status` da ESPEC 037: de **Proposta** para **Implementada**, com os números medidos;
- ESPEC 004: nota em `R-ANX-11`, §4.1 e §4.2 remetendo à ESPEC 037 — o cabeçalho passa a ser
  identificado por rótulo, e a frase *"O número da linha entra na configuração, ao lado da orientação
  e do corpo de fonte"* deixa de valer (ESPEC 037 §11). **A 036 escreveu no §9 do mesmo arquivo:**
  seções diferentes, editadas conscientemente;
- `README.md`: o comportamento novo e a `V-ANX-02`. **A 035 e a 036 editaram a mesma seção** — ler o
  que puseram ali antes de escrever, e conferir com `git diff README.md` antes de commitar;
- `docs/CHANGELOG.md`: entrada de correção.

**Pronto quando:** os quatro escritos, e o diff dos documentos mostra só as edições esperadas.

---

## 9. Insumos em aberto

| ID | Questão | Bloqueia? |
|---|---|---|
| `I-01` | Repetir o cabeçalho dos blocos **secundários** — `NAS` linha 40, `OutrosServicos` 7 e 11? Exigiria uma tabela por bloco, não duas por anexo | Não. Espec própria, e revisaria o corte da ESPEC 004 inteiro |
| `I-02` | Versionar um par do **FTM** como terceira fixture? É o caso que originou a espec, e o único com `Office365` de preâmbulo curto | Não bloqueia a entrega. **Bloqueia a afirmação de que o FTM está corrigido**, que hoje é previsão fundamentada — a âncora `Nº, Secretaria, Nome` resolve o caso pela leitura do print, não por medição |
| `I-03` | A âncora deve ser declarada por anexo ou derivada do piloto em tempo de execução? | Não. `D-01` decidiu: derivar amarraria o catálogo a uma fixture de teste e tornaria a configuração ilegível na revisão |
| `I-04` | `V-ANX-02` nunca dispara nas planilhas conhecidas. Vale mantê-la? | Não. Precedente de `V-ANX-01`, `V-MED-04` e `V-CTR-06` |
| `I-05` | Três rótulos por âncora bastam? Medido: **um** já resolve as duas planilhas versionadas, e três é margem. Se uma planilha futura tiver um rótulo repetido cedo demais, a resposta é **alongar a âncora**, não trocar o mecanismo | Não. É configuração, e muda em uma linha de JSON |

---

## 10. Emenda de execução

**2026-08-31.** Executada em ~1h de trabalho, mais duas execuções de suíte completa (17 min cada) e
seis renderizações do par do PGM. Os seis portões fechados.

**A `T-2330` previu um vermelho que não podia acontecer.** O backlog dizia que a `T-2323` ficaria
vermelha no PGM até a `E3`, *"porque o documento ainda não foi regerado nesta fase"*. Não há
documento em cache: `documento_do_pgm` é fixture de sessão que **renderiza a cada execução**. Então
a rede virou verde junto com a `E2`, e a `T-2333` da `E3` já nasceu satisfeita. O erro foi de
redação do backlog, não de desenho — o portão `P2` continuou tendo o que precisava, que era a sonda
da `T-2329`.

**Eu fui o barulho da linha de base, contra a regra que eu mesmo tinha escrito.** A `T-2316` manda
rodar a suíte sozinha, e a ESPEC 036 §10 já tinha diagnosticado a contenção. Parei o `uvicorn`
(2.358 s de CPU acumulados) e, com a suíte no ar, rodei o script de transcrição da `T-2320` para não
ficar ocioso. Resultado: `test_o_custo_de_um_anexo_e_linear` reprovou em **2,80x** contra o limite
de 2,6, e a base saiu `1 failed, 1526 passed`. Sozinho, o módulo passou — **734 passed em 46 s**,
o mesmo número que a 036 registrou. Base efetiva: **1.527**. Na execução final, com só edições de
documento em paralelo, a suíte saiu **1543 passed** limpa. *A regra não é "não rodar em paralelo com
outra suíte": é não rodar nada.*

**A `T-2344` precisou de outra forma no cenário de árvore suja, e isso o backlog não previu.** Ela
manda conferir `git diff` **vazio** em `docx_renderer.py` e `ooxml.py`. Mas o diff é contra o
`HEAD`, e a ESPEC 036 — não commitada — alterou os dois. A verificação virou: *nenhuma linha
acrescentada nesses arquivos menciona `037`, `R-CAB` ou `localizar_cabecalho`* — zero. Vale a regra
geral: **em árvore com entrega alheia dentro, "diff vazio" não é verificável; "diff sem as minhas
marcas" é.**

**A prova por desligamento saiu mais barata que a da 036, e o previsto se confirmou inteiro.** Uma
linha em `AnexoReader._anexo` — `config.linha_cabecalho - 1` no lugar da resolução por âncora — e o
`PACOTE_DO_PGM` voltou a `6b85e981…`, o valor da 036, **entrada por entrada**; religada, voltou a
`df71db05…`. Das 40 entradas do pacote, **39 idênticas e uma diferente**: `docProps/app.xml`, que a
ESPEC §8.4 listava como candidato e mandava *"medir, não prever"*, ficou parado pela segunda vez.

**A sonda da `T-2329` pagou-se, e é a decisão que eu repetiria.** Dez segundos, sem renderizar:
**19 índices parados no piloto, 5 movidos no PGM** para exatamente os valores previstos. Ela deu o
veredito da entrega antes de qualquer renderização de PGM (~115 s cada), e antes de haver hash
movido para alguém ser tentado a explicar.

**A armadilha do colapso de mesclagem era real, e o piloto foi quem a teria denunciado.** O
`python-docx` repete o texto de uma célula mesclada uma vez por coluna da grade; o `openpyxl` guarda
só na âncora. Se a normalização estivesse errada, a rede reprovaria **no piloto** — e o vermelho
pareceria certo, porque o PGM também estaria vermelho. Passou de primeira, e as três fileiras que a
exercitam (`CertificadosDigitais`, `Central de Servicos`, `WIFI`) são a prova.

**Uma tarefa mudou de lugar.** O guarda do catálogo — *toda entrada declara âncora* — nasceu em
`test_cabecalho_do_anexo.py` na `E1` e foi para `test_anexos_configuracao.py` na `T-2345`, ao lado
dos dois testes de `linha_cabecalho` que ele acompanha. Manter os três juntos é o que torna visível,
em revisão, que apagar `linha_cabecalho` quebraria o oráculo da `R-CAB-06`.

**Resultado.** Backend **1.527 → 1.543 passed** (16 novos, nenhum removido). `ruff` e `mypy` limpos
nos arquivos tocados. **Um artefato reancorado** — `PACOTE_DO_PGM`, `word/document.xml` — com o
delta provado por desligamento; o piloto não se moveu, entrada por entrada. PGM: **18 seções, 34
tabelas e 18 fileiras marcadas antes e depois**, com **cinco delas trocando de identidade**.
`V-ANX-02` não dispara em nenhum dos dois pares. `docx_renderer.py` e `ooxml.py` intocados.