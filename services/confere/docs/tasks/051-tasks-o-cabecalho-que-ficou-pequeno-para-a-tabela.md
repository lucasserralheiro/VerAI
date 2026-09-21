# TASKS 051 — Backlog de "O cabeçalho que ficou pequeno para a tabela"

| | |
|---|---|
| **Especificação** | [ESPEC 051](../specs/051-o-cabecalho-que-ficou-pequeno-para-a-tabela.md) v1.0 |
| **Plano** | [PLANO 051](../plans/051-plano-o-cabecalho-que-ficou-pequeno-para-a-tabela.md) v1.0 |
| **Versão** | 1.0 — 2026-09-10 |
| **Total** | 29 tarefas · 6 portões · 3 insumos em aberto. **29 executadas**, mais uma tarefa fora do inventário original (§10) |
| **Status** | **Implementada** — 2026-09-10. Os seis portões fechados. Backend **1.608 → 1.613 passed** (1.403,35 s, suíte isolada), zero falhas; `ruff` e `mypy` limpos. **Dois artefatos reancorados** — `word/document.xml`, piloto **e** PGM —, com o delta provado por desligamento nos dois. `Servidores`/`ServidoresSemDesenv`: 2 → 3 tabelas cada, nos dois pacotes (piloto 38→40, PGM 32→34 só nos anexos, 34→36 no documento completo com aditivo). Ver §10 |

> **Escrito antes da implementação.** A §10 é a única seção que não pode ser escrita agora, e é a
> que a próxima entrega vai ler.

> **A rede da ESPEC 037 vale mais que os dois anexos que esta entrega corrige.** `test_t2323_*` já
> existe e já reprova defeito deste formato; se ela ficar cega para a âncora adicional (`T-2757`), a
> próxima planilha com uma terceira tabela empilhada atravessa em silêncio de novo.

> **Nenhuma entrega alheia dentro desta árvore.** Diferente dos backlogs 036/037, aqui não há
> colisão de arquivo a gerenciar — a única coisa registrada e não commitada é a própria ESPEC e o
> PLANO 051.

---

## 1. Convenções

**Identificadores** `T-27nn`, continuando de `T-2737`, a última em uso (ESPEC 049).

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`python -m pytest` verde — **com o `-m`**, e sem servidor de desenvolvimento no ar (lição da
ESPEC 036 §10, repetida pela ESPEC 037: `uvicorn --reload` distorce `test_desempenho.py`).

**Convenção de commit** `<tipo>(T-27nn): descrição`. A configuração aditiva é `feat(...)` — é
capacidade nova do modelo do anexo, mesmo que inerte até a leitura a consumir; a generalização de
`Anexo.cortes` e de `_faixa_de_tabelas` é `fix(...)` — é a correção em si; catálogo, sonda e rede são
`test(...)`; a reancoragem é `test(...)` também, com a justificativa no corpo do commit; `README`,
specs e `CHANGELOG` são `docs(...)`. **Nunca dois tipos no mesmo commit.**

### 1.1 Seis regras que atravessam este backlog

**1 — A árvore está limpa, e isso é verificado, não presumido.** `T-2738` confirma `HEAD` e
`git status` antes de qualquer código. Se a árvore não estiver limpa como o PLANO §Estado inicial
descreve, esta entrega **para** e o achado se registra — não se mistura com a entrega alheia.

*O sinal no diff:* qualquer arquivo fora do inventário do PLANO §7 aparecendo como modificado antes
da `T-2743`.

**2 — Os dois pacotes de referência se movem, e a prova é por desligamento, não por régua parada.**
Nas entregas anteriores o piloto ficava intacto e provava o falso positivo. Aqui **os dois** —
piloto e PGM — têm o defeito medido (ESPEC 051 §2.4), então os dois `word/document.xml` mudam. O que
prova que o delta é exatamente o previsto é `T-2760`: revertida a configuração nova, os dois voltam
ao valor de `T-2738`.

*O sinal no diff:* uma reancoragem sem a `T-2760` registrada, ou um pacote que mude em entrada
diferente de `word/document.xml`.

**3 — Três lugares no código de teste assumem "no máximo um corte por anexo", e foram lidos, não
adivinhados.** `_tabelas_esperadas` (`test_docx_anexos.py:133`) compara `anexo.corte` com `None`;
`test_a_largura_e_do_bloco_e_nao_da_aba` desempacota **duas** tabelas de `Servidores`;
`test_a_marca_de_cabecalho_cai_na_primeira_fileira_da_tabela` afirma `marcadas in ([], [0])`. Os três
quebram com dois anexos de três tabelas, e os três têm tarefa própria (`T-2754`, `T-2755`, `T-2756`).

*O sinal no diff:* qualquer um dos três ainda com a forma antiga depois da `E3`.

**4 — A rede da ESPEC 037 precisa saber da âncora adicional, ou reprova pelo motivo errado.**
`_ancoras()` em `test_cabecalho_do_anexo.py:88` só lê `c.cabecalho`. Sem `T-2757`, a fileira do
cabeçalho de detalhe — corrigida, com texto em todas as 15 colunas — aparece para aquele teste como
"sem âncora declarada", e ele reprova depois da correção pelo motivo oposto ao que a corrigiu.

*O sinal no diff:* `test_t2323_*` vermelho depois da `E3`, com `Servidores` ou `ServidoresSemDesenv`
na lista de fileiras órfãs.

**5 — `_tabela_do_anexo` não muda.** Ela já recebe `(inicio, fim)` por chamada e já calcula
`forma_do_bloco(inicio, fim)` sobre esses dois argumentos — é `_faixa_de_tabelas` que decidia, até
hoje, passar no máximo dois intervalos. A correção inteira mora em fazer `_faixa_de_tabelas` passar
**um intervalo por segmento**, não em mudar o que recebe o intervalo.

*O sinal no diff:* qualquer linha alterada em `_tabela_do_anexo` (a função, não a chamada) ou em
`ooxml.py`.

**6 — `NAS` e `OutrosServicos` não são tocados.** Nenhuma tarefa deste backlog escreve
`cabecalhos_adicionais` para eles — é o `I-01` da ESPEC 037, e continua em aberto por decisão
(`D-05`).

*O sinal no diff:* qualquer edição em `anexos.json` fora das duas linhas de `Servidores` e
`ServidoresSemDesenv`.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase | Depende de decisão? |
|---|---|---|---|---|
| **E0** Linha de base e o defeito nomeado | T-2738 … T-2742 | **P0** | F0 | não |
| **E1** O catálogo aditivo | T-2743 … T-2746 | **P1** | F1 | não |
| **E2** `Anexo.cortes`, provado sem renderizar | T-2747 … T-2751 | **P2** | F2 | não |
| **E3** O renderizador e a rede atualizada | T-2752 … T-2759 | **P3** | F3 | não |
| **E4** A reancoragem, provada | T-2760 … T-2762 | **P4** | F4 | não |
| **E5** O conjunto | T-2763 … T-2766 | **P5** | F5 | não |

### 2.1 A régua da entrega — o que pode mudar de comportamento

| Muda | Não muda |
|---|---|
| `anexos.json`: `cabecalhos_adicionais` em `Servidores` e `ServidoresSemDesenv` | `anexos.json`: as outras 17 entradas, `cabecalho`, `linha_cabecalho` |
| `Anexo.corte` (propriedade) vira `Anexo.cortes`; `Anexo.linhas_cabecalho_adicionais`, campo novo | `Anexo.linha_cabecalho`, `Anexo.vazio`, `Anexo.forma_do_bloco` (assinatura) |
| `AnexoReader._anexo`: resolve cada âncora adicional | `cabecalho.py` — `localizar_cabecalho` intocada, só chamada mais vezes |
| `docx_renderer.py::_faixa_de_tabelas` — generalizada para N segmentos | `docx_renderer.py::_tabela_do_anexo`, `ooxml.py` — **nenhuma linha** |
| `Servidores`/`ServidoresSemDesenv`: 2 → **3** tabelas cada, nos dois pacotes | Os outros 17 anexos: mesma contagem de seções e tabelas de hoje |
| Piloto: 38 → **40** tabelas · PGM: 32 → **34** tabelas | `NAS`, `OutrosServicos` — nenhuma linha tocada (regra 6) |
| `PACOTE_DO_PILOTO` **e** `PACOTE_DO_PGM` → `word/document.xml` | `ANALISE_DO_PILOTO`, `ANALISE_DO_PGM` — byte a byte |
| `test_aba_reader.py`, `test_docx_anexos.py`, `test_cabecalho_do_anexo.py`, `test_anexos_configuracao.py` — testes nomeados | Os demais testes desses arquivos |
| `docs/specs/004` — nota em `R-ANX-11`; `Status` da ESPEC 051 | `frontend/`, `api/`, `V-ANX-02`, a tabela de comprovação, a capa, o teste-âncora |

---

## 3. Épico E0 — Linha de base e o defeito nomeado `[portão P0]`

> **Nenhum arquivo de `src/` é tocado neste épico.**

#### T-2738 — Confirmar a árvore e reproduzir os dois pacotes `[portão, risco]`
**Tamanho:** PP · **Ref:** PLANO §Estado inicial, regra 1, **P0**, **P4**

`git status --short` e `git log -1` → árvore limpa, `HEAD` em `fb078d1`, ramo `feature/evolucao`.
`python -m pytest tests/test_identidade_dos_artefatos.py -q` → os quatro alvos verdes nesta árvore.
Registrar `word/document.xml`: piloto `0b87c759…`, PGM `4e3197ff…` — são os valores que `T-2760` tem
de reproduzir na volta.

**Reprovando, esta entrega para aqui.** Um pacote diferente das constantes do arquivo, ou um arquivo
fora do inventário já modificado, é sinal de trabalho alheio na árvore — registra-se o achado e não
se segue para a `E1`.

**Pronto quando:** os quatro verdes, os dois hashes de `word/document.xml` transcritos neste
documento.

---

#### T-2739 — Linha de base da suíte
**Tamanho:** PP · **Ref:** **P5**

`python -m pytest --collect-only -q` → **1.608 coletados** (medido em 2026-09-10, nesta árvore).
`python -m pytest -q` completo, sozinho — conferir que não há servidor de desenvolvimento no ar antes
de medir. Registrar o `passed`.

**Pronto quando:** o número e a lista de eventuais falhas estão neste documento.

---

#### T-2740 — Congelar o defeito, fileira por fileira `[portão, risco]`
**Tamanho:** P · **Ref:** **P0**, **P3**

Renderizar `Servidores` e `ServidoresSemDesenv` nos dois pacotes (código de hoje, sem alteração) e
listar a fileira `w:tblHeader` de cada um. Esperado, medido:

| par | anexo | fileira marcada hoje | células vazias |
|---|---|---|---|
| piloto | `Servidores` | `Servidor \| vCPU \| Qtde RAM(GB) \| … \| Ambiente \| · \| · \| · \| ·` | 4 de 15 (`11`–`14`) |
| piloto | `ServidoresSemDesenv` | idem | 4 de 15 |
| PGM | `Servidores` | idem | 4 de 15 |
| PGM | `ServidoresSemDesenv` | idem | 4 de 15 |

**É o texto que `T-2758` tem de ver sem uma célula vazia.**

**Pronto quando:** as quatro linhas transcritas, reproduzidas nesta árvore — não copiadas da ESPEC.

---

#### T-2741 — Medir a âncora adicional `[risco]`
**Tamanho:** PP · **Ref:** **P1**, **P2**

`localizar_cabecalho(forma.linhas, ("Servidor", "Serviço", "Nome do Serviço"))`, isolado, sem
renderizar, contra os dois pacotes **e** o arquivo real da submissão
(`docs/documentos/SMIT SUSTENTAÇÃO_Levantamento_05969_TC 52SMIT2024_15072026_101414_V2.0.xlsx`).
Resolvido, 0-based:

| anexo | piloto | PGM | arquivo real |
|---|---|---|---|
| `Servidores` | **51** | **46** | — (não medido; fora do escopo de versionamento) |
| `ServidoresSemDesenv` | **40** | **36** | **40** |

**Os três batem para `ServidoresSemDesenv`** — piloto e arquivo real resolvem no mesmo índice, porque
o piloto **é** o mesmo documento SMIT sanitizado. É a confirmação de que a fixture não divergiu do
arquivo que originou a submissão.

**Pronto quando:** a tabela acima confirmada, reproduzida e não copiada.

---

#### T-2742 — Congelar a forma dos dois documentos `[portão]`
**Tamanho:** PP · **Ref:** **P3**

| medida | piloto | PGM |
|---|---|---|
| seções | **21** | **18** |
| tabelas | **38** | **32** |

**As duas são o portão da `E3`.** Depois da correção: **40** (piloto) e **34** (PGM) — dois a mais em
cada, um por anexo afetado. Qualquer outro número, em qualquer anexo, é vazamento fora do escopo.

**Pronto quando:** os quatro números (dois de hoje, dois esperados) neste documento.

---

## 4. Épico E1 — O catálogo aditivo `[portão P1]`

> **O campo é inerte por construção.** `AnexoReader` não lê `cabecalhos_adicionais` até a `E2` — é
> isso que permite entrar aqui sem mover um byte de documento.

#### T-2743 — `ConfiguracaoDeAnexo.cabecalhos_adicionais`
**Tamanho:** PP · **Ref:** `R-SEG-01`, `D-01`

Em `infrastructure/annex/configuracao.py`:

```python
# ESPEC 051 `R-SEG-01` — âncoras de cabeçalhos além do primário, para abas com
# mais de uma tabela empilhada. Cada uma resolvida pela mesma R-CAB-01/03 da
# ESPEC 037. Vazio para os 17 anexos com uma única tabela de corpo.
cabecalhos_adicionais: tuple[tuple[str, ...], ...] = ()
```

**Depois de `cabecalho`, não antes** — é a quarta coisa que o anexo declara, e vira a quinta.

**Pronto quando:** o campo existe, com o comentário, e `anexos_configurados()` continua devolvendo
19 entradas.

---

#### T-2744 — A âncora adicional em `anexos.json`
**Tamanho:** P · **Ref:** `R-SEG-07`

```json
{ "aba": "Servidores",           "orientacao": "retrato", "corpo": 4.3, "linha_cabecalho": 13, "cabecalho": ["Servidor", "vCPU", "Qtde RAM(GB)"], "cabecalhos_adicionais": [["Servidor", "Serviço", "Nome do Serviço"]], "paginas_grc": "6" },
{ "aba": "ServidoresSemDesenv",  "orientacao": "retrato", "corpo": 4.4, "linha_cabecalho": 12, "cabecalho": ["Servidor", "vCPU", "Qtde RAM(GB)"], "cabecalhos_adicionais": [["Servidor", "Serviço", "Nome do Serviço"]], "paginas_grc": "7" },
```

As outras 17 entradas **não mudam uma vírgula**.

**Pronto quando:** o JSON valida, e `cabecalhos_adicionais` sai não vazio só nessas duas entradas.

---

#### T-2745 — O catálogo continua inerte `[portão]`
**Tamanho:** PP · **Ref:** **P1**

`python -m pytest tests/test_identidade_dos_artefatos.py -q` → **quatro verdes**, constante nenhuma
tocada. `1.608` ainda coletados.

**Pronto quando:** verde, e `git diff --stat` mostrando só `configuracao.py` e `anexos.json`.

---

#### T-2746 — Teste de configuração novo
**Tamanho:** PP · **Ref:** `R-SEG-07`

Em `test_anexos_configuracao.py`, ao lado de `test_todo_anexo_declara_a_ancora_do_cabecalho`:

```python
def test_so_servidores_e_servidoressemdesenv_tem_ancora_adicional() -> None:
    """ESPEC 051 `R-SEG-07` — os dois únicos anexos com tabela de forma diferente empilhada."""
    com_adicional = {
        c.aba for c in anexos_configurados() if c.cabecalhos_adicionais
    }
    assert com_adicional == {"Servidores", "ServidoresSemDesenv"}
```

**Pronto quando:** verde.

---

## 5. Épico E2 — `Anexo.cortes`, provado sem renderizar `[portão P2]`

#### T-2747 — `Anexo.linhas_cabecalho_adicionais`, e o leitor resolve
**Tamanho:** PP · **Ref:** `R-SEG-01`, `D-01`

Em `domain/entities/annex.py`:

```python
# ESPEC 051 `R-SEG-01` — os índices resolvidos das âncoras adicionais, na
# mesma lógica de `linha_cabecalho` (ESPEC 037 `R-CAB-05`): resolvidos na
# leitura, não na renderização.
linhas_cabecalho_adicionais: tuple[int, ...] = ()
```

Em `infrastructure/annex/anexo_reader.py::_anexo`:

```python
cabecalho = localizar_cabecalho(forma.linhas, config.cabecalho)
adicionais = tuple(
    indice
    for ancora in config.cabecalhos_adicionais
    if (indice := localizar_cabecalho(forma.linhas, ancora)) is not None
)
...
return Anexo(
    ...,
    linha_cabecalho=cabecalho,
    linhas_cabecalho_adicionais=adicionais,
    ...,
)
```

**Âncora adicional que não resolve não é erro** — some da tupla, silenciosamente, igual à primária
sem `V-ANX-02` disparar para ela (§5.1 da ESPEC — validação nova não é objetivo desta entrega).

**Pronto quando:** `T-2751` verde.

---

#### T-2748 — `Anexo.corte` vira `Anexo.cortes`
**Tamanho:** P · **Ref:** `R-SEG-02`, `R-SEG-06`, `D-02`

Em `domain/entities/annex.py`, substituindo a propriedade `corte`:

```python
@property
def cortes(self) -> tuple[int, ...]:
    """Onde o anexo se parte em segmentos — um por cabeçalho reconhecido.

    Generaliza o `corte` único da ESPEC 004 `R-ANX-11` (ESPEC 051 `R-SEG-02`
    a `R-SEG-06`): a âncora primária e as adicionais, cada uma sujeita à
    mesma guarda de sempre — sem corte no início da aba (nada a separar) e
    sem corte numa linha que uma mesclagem atravessa (partir a região
    desalinharia os dois segmentos). Ordenado, sem repetição: duas âncoras
    que resolvam na mesma linha colapsam num corte só (`R-SEG-06`).
    """
    candidatos = {self.linha_cabecalho, *self.linhas_cabecalho_adicionais}
    candidatos.discard(None)
    return tuple(sorted(
        linha
        for linha in candidatos
        if linha > 0
        and not any(m.linha < linha <= m.ate_linha for m in self.mesclagens)
    ))
```

**Atualizar os dois comentários que citam `Anexo.corte` por nome** — `anexo_reader.py:69`,
`ooxml.py:162` — para `Anexo.cortes`.

**Pronto quando:** `T-2749` verde.

---

#### T-2749 — Os testes sintéticos, reescritos e ampliados `[risco]`
**Tamanho:** P · **Ref:** `R-SEG-02`, `R-SEG-06`

Em `test_aba_reader.py`, seção "Onde o anexo se parte" — `_anexo()` ganha um parâmetro
`adicionais: tuple[int, ...] = ()`:

| # | Caso | Esperado |
|---|---|---|
| 1 | `_anexo(7)` | `.cortes == (7,)` |
| 2 | `_anexo(0)` | `.cortes == ()` |
| 3 | `_anexo(None)` | `.cortes == ()` |
| 4 | `_anexo(7, mesclagens=(Mesclagem(5,0,9,3),))` | `.cortes == ()` |
| 5 **novo** | `_anexo(7, adicionais=(14,))` | `.cortes == (7, 14)` |
| 6 **novo** | `_anexo(7, adicionais=(7,))` | `.cortes == (7,)` — sem segmento vazio |
| 7 **novo** | `_anexo(7, mesclagens=(Mesclagem(12,0,15,3),), adicionais=(14,))` | `.cortes == (7,)` — o corte de 7 sobrevive; o de 14, atravessado, some |

**O caso 7 é o que prova que a guarda é por índice, e não por anexo inteiro.** Uma mesclagem que
atravessa a âncora adicional não pode derrubar a primária — são independentes, e o teste é onde essa
independência se afirma antes de haver planilha real que a exercite.

**Pronto quando:** os sete verdes.

---

#### T-2750 — Conferir os call sites de `.corte`
**Tamanho:** PP · **Ref:** inventário PLANO §7, busca 1

`grep -rn "\.corte\b"` em `backend/` deve devolver **zero** ocorrências fora de `.cortes` — as onze
encontradas no inventário (dois em código, nove em comentário/teste) foram todas endereçadas pelas
`T-2748`, `T-2754`, `T-2755`, `T-2756`.

**Pronto quando:** o grep limpo.

---

#### T-2751 — A sonda, sem renderizar `[portão, risco]`
**Tamanho:** PP · **Ref:** **P2**

`AnexoReader().ler(...)` nos dois pacotes, sem `Document`, imprimindo `aba → cortes`:

| pacote | anexos com 1 corte | anexos com 2 cortes |
|---|---|---|
| piloto | 17 — idênticos ao valor de hoje | `Servidores` `(12, 51)`; `ServidoresSemDesenv` `(11, 40)` |
| PGM | 14 (16 presentes menos os 2 afetados) — idênticos | `Servidores` `(11, 46)`; `ServidoresSemDesenv` `(10, 36)` |

**É o portão que decide a entrega antes de renderizar.** Um índice fora do lugar num anexo **fora**
do escopo aqui é falso positivo achado em segundos, não em ~115 s de renderização de PGM.

**Reprovando:** reverter `T-2747`/`T-2748` e voltar à `T-2749`.

**Pronto quando:** as duas tabelas batem, aba por aba, nesta árvore.

---

## 6. Épico E3 — O renderizador e a rede atualizada `[portão P3]`

> **`_tabela_do_anexo` não muda** (regra 5). Ela já recebe `(inicio, fim)` e já chama
> `forma_do_bloco(inicio, fim)` sobre eles — a correção mora inteira em `_faixa_de_tabelas`, que passa
> a fatiar a faixa em mais de dois pedaços.

#### T-2752 — `_faixa_de_tabelas`, generalizada
**Tamanho:** P · **Ref:** `R-SEG-03`, `R-SEG-04`, `D-03`

Em `infrastructure/report/docx_renderer.py`, substituindo o corpo do método
([docx_renderer.py:480-509](../../backend/src/infrastructure/report/docx_renderer.py#L480-L509)):

```python
def _faixa_de_tabelas(
    self, documento: Document, anexo: Anexo, larguras: tuple[float, ...], inicio: int, fim: int
) -> None:
    """Uma tabela por segmento — um a mais para cada cabeçalho reconhecido na faixa.

    Generaliza o corte único da ESPEC 004 (ESPEC 051 `R-SEG-03`, `R-SEG-04`):
    os cortes da faixa partem `[inicio, fim)` em segmentos, e cada segmento
    cujo início é uma linha de cabeçalho — primária ou adicional — recebe seu
    próprio `w:tblHeader`. Com nenhum corte na faixa, um segmento só: o
    comportamento de hoje.
    """
    cortes = [c for c in anexo.cortes if inicio < c < fim]
    limites = [inicio, *cortes, fim]
    cabecalhos = {anexo.linha_cabecalho, *anexo.linhas_cabecalho_adicionais}

    for indice, segue_inicio in enumerate(limites[:-1]):
        segue_fim = limites[indice + 1]
        if indice:
            # Duas tabelas coladas: o Word as junta quando não há nada entre
            # elas. Um parágrafo de 1 pt separa sem abrir espaço perceptível
            # — o mesmo que já separava preâmbulo e corpo.
            separador = documento.add_paragraph()
            separador.paragraph_format.space_before = Pt(0)
            separador.paragraph_format.space_after = Pt(0)
            separador.add_run("").font.size = Pt(1)
        self._tabela_do_anexo(
            documento, anexo, larguras, segue_inicio, segue_fim,
            repetir=segue_inicio in cabecalhos,
        )
```

**A unificação também simplifica: não há mais dois ramos.** O código de hoje decide
`repetir=False`/`repetir=True` à mão para as duas tabelas do caso com corte, e `anexo.linha_cabecalho
== inicio` para o caso sem corte. `segue_inicio in cabecalhos` cobre os dois: com um segmento só,
`segue_inicio == inicio`, e o teste é idêntico ao de hoje.

**Pronto quando:** `T-2759` verde para os 17 anexos não afetados, byte a byte.

---

#### T-2753 — Conferir que nada mais mudou no arquivo
**Tamanho:** PP · **Ref:** regra 5

`git diff docx_renderer.py` deve mostrar **só** o corpo de `_faixa_de_tabelas`. `_tabela_do_anexo`,
`_mesclar_anexo`, `_celula_do_anexo`, `_larguras_do_anexo` — intocadas. `ooxml.py` — diff vazio.

**Pronto quando:** conferido.

---

#### T-2754 — `_tabelas_esperadas` usa `cortes`
**Tamanho:** PP · **Ref:** inventário PLANO §7, busca 3

Em `test_docx_anexos.py:125`:

```python
def _tabelas_esperadas(anexo: Anexo) -> int:
    """Uma tabela por segmento — um a mais por corte dentro da faixa."""
    return sum(
        len([c for c in anexo.cortes if inicio < c < fim]) + 1
        for inicio, fim, imagem in anexo.blocos()
        if imagem is None
    )
```

**Pronto quando:** `tabelas_por_anexo` distribui corretamente as tabelas dos 19 anexos nos dois
pacotes — conferido por `T-2759`.

---

#### T-2755 — `test_a_largura_e_do_bloco_e_nao_da_aba`, reescrito
**Tamanho:** P · **Ref:** `R-SEG-03` — é o teste de aceite direto da correção

```python
def test_a_largura_e_do_bloco_e_nao_da_aba(tabelas_por_anexo: dict[str, list[Any]]) -> None:
    """`R-BRD-01` (ESPEC 014) e `R-SEG-03` (ESPEC 051) — três tabelas, três contagens.

    `Servidores` tem uma tabela de resumo (11 colunas) e uma de detalhe (15) —
    duas tabelas empilhadas na mesma aba, cada uma com a largura que o seu
    próprio cabeçalho usa. Antes da ESPEC 051 as duas eram uma tabela só, com
    15 colunas de grade e só 11 rótulos no cabeçalho repetido.
    """
    preambulo, resumo, detalhe = tabelas_por_anexo["Servidores"]
    assert len(_larguras_da_grade(preambulo)) == 9
    assert len(_larguras_da_grade(resumo)) == 11
    assert len(_larguras_da_grade(detalhe)) == 15
```

**Pronto quando:** verde nos dois pacotes.

---

#### T-2756 — `test_a_marca_de_cabecalho_cai_na_primeira_fileira_da_tabela`, reescrito
**Tamanho:** PP · **Ref:** `R-SEG-04`

```python
def test_a_marca_de_cabecalho_cai_na_primeira_fileira_da_tabela(
    tabelas_por_anexo: dict[str, list[Any]], anexos: list[Anexo]
) -> None:
    """Cada marca é a fileira 0 da sua própria tabela — não 'no máximo uma marca por anexo'."""
    for anexo in anexos:
        for tabela in tabelas_por_anexo[anexo.aba]:
            marcadas = [
                indice
                for indice, fileira in enumerate(tabela.rows)
                if _tem_cabecalho_repetido(fileira)
            ]
            assert marcadas in ([], [0]), anexo.aba
```

**A regra desceu de "por anexo" para "por tabela".** É a mesma afirmação de sempre — fora da primeira
fileira o Word ignora a marca —, só que agora um anexo pode ter mais de uma tabela marcada, e cada
marca continua tendo de ser a fileira 0 **daquela** tabela.

**Pronto quando:** verde nos dois pacotes, inclusive para `Servidores`/`ServidoresSemDesenv` com duas
tabelas marcadas cada.

---

#### T-2757 — `_ancoras()` aprende a âncora adicional `[risco]`
**Tamanho:** PP · **Ref:** regra 4

Em `test_cabecalho_do_anexo.py:81`:

```python
def _ancoras() -> list[tuple[str, ...]]:
    catalogo = [_normalizar(c.cabecalho) for c in anexos_configurados() if c.cabecalho]
    adicionais = [
        _normalizar(ancora)
        for c in anexos_configurados()
        for ancora in c.cabecalhos_adicionais
    ]
    return [_normalizar(layout.CABECALHO_COLUNAS), *catalogo, *adicionais]
```

**Sem esta tarefa, `test_t2323_*` reprova depois da `E3` — e o vermelho parece regressão.** A fileira
do cabeçalho de detalhe passa a existir com `w:tblHeader` e rótulos corretos; se `_ancoras()` não a
reconhecer, a rede a nomeia como órfã, quando na verdade é exatamente o que esta entrega quis
produzir.

**Pronto quando:** `test_t2323_toda_fileira_marcada_do_piloto_e_um_cabecalho` e
`..._do_pgm_e_um_cabecalho` verdes.

---

#### T-2758 — A rede da ESPEC 051: nenhuma célula vazia na fileira marcada
**Tamanho:** P · **Ref:** `§8.2` da espec

Em `test_cabecalho_do_anexo.py`, ao lado da `T-2323` da ESPEC 037:

```python
def test_nenhuma_fileira_marcada_tem_celula_vazia(docx_do_piloto: Path, documento_do_pgm: Path) -> None:
    """ESPEC 051 `§8.2` — a rede que a ESPEC 037 não escreveu porque não sabia deste defeito.

    `_rotulos_da_fileira` descarta células vazias de propósito (para lidar com
    mesclagem); é exatamente esse descarte que deixava passar uma fileira com
    4 de 15 colunas sem texto. Esta rede olha a fileira **crua**, sem
    descartar nada.
    """
    for caminho in (docx_do_piloto, documento_do_pgm):
        documento = docx.Document(str(caminho))
        for tabela in documento.tables:
            for fileira in tabela.rows:
                if not _tem_cabecalho_repetido(fileira):
                    continue
                textos = [celula.text.strip() for celula in fileira.cells]
                assert all(textos), f"{caminho.name}: {textos}"
```

**Reprova hoje** (antes da `E3`), nos dois pacotes, em `Servidores` e `ServidoresSemDesenv` — é o
teste que teria pego o defeito original, escrito para nunca deixar de valer.

**Pronto quando:** vermelho antes do código da `E3`, verde depois.

---

#### T-2759 — Conferir os dois pacotes, ponta a ponta `[portão]`
**Tamanho:** PP · **Ref:** **P3**

| medida | piloto | PGM |
|---|---|---|
| seções | **21** (igual à `T-2742`) | **18** (igual) |
| tabelas | **40** (38 + 2) | **34** (32 + 2) |

`python -m pytest tests/test_docx_anexos.py tests/test_cabecalho_do_anexo.py tests/test_aba_reader.py -q`
verde. `T-2755`, `T-2756`, `T-2757`, `T-2758` — as quatro nomeadas.

**Pronto quando:** os quatro números batem e a suíte dos três arquivos está verde nos dois pacotes.

---

## 7. Épico E4 — A reancoragem, provada `[portão P4]`

#### T-2760 — Prova por desligamento `[portão, risco]`
**Tamanho:** P · **Ref:** **P4**, `D-06`

Quatro passos:

1. com a `E3` entregue, medir `word/document.xml` dos dois pacotes → **valores novos**, guardados;
2. reverter `cabecalhos_adicionais` para `()` nas duas entradas de `anexos.json`, sem tocar o
   restante do código → medir de novo;
3. os dois pacotes voltam **entrada por entrada** ao valor da `T-2738`;
4. desfazer a reversão, conferir que os valores do passo 1 voltam, e só então reancorar.

**Desta vez são dois pacotes, não um** — a única mudança de procedimento em relação à ESPEC 037: o
passo 1 e o passo 3 são feitos duas vezes, piloto e PGM, e os dois têm de bater.

**Pronto quando:** os quatro passos registrados neste documento, com os quatro valores (dois de ida,
dois de volta).

---

#### T-2761 — Reancorar os dois `word/document.xml`
**Tamanho:** PP · **Ref:** **P4**, `D-06`

Trocar as duas constantes em `test_identidade_dos_artefatos.py` e escrever o parágrafo de
justificativa — abaixo do parágrafo da ESPEC 049, sem reescrevê-lo — explicando por que desta vez
**os dois** pacotes se movem, e citando a `T-2760` como prova.

**O cabeçalho daquele arquivo é explícito:** *"Se um destes testes ficar vermelho, a resposta padrão
não é reancorar."* Esta é a exceção prevista — mudança deliberada, decidida em espec —, e só é
exceção com a `T-2760` junto.

**Pronto quando:** as duas constantes trocadas, o parágrafo escrito, e os dois testes verdes.

---

#### T-2762 — As demais entradas dos dois pacotes, inalteradas `[portão]`
**Tamanho:** PP · **Ref:** **P4**

Conferir `docProps/app.xml` e as demais entradas — candidatas a se mover junto, "a medir, não a
prever". Se alguma se mover, a `T-2761` explica por quê; senão, o portão exige que fiquem paradas.

**Pronto quando:** conferido, entrada por entrada, nos dois pacotes.

---

## 8. Épico E5 — O conjunto `[portão P5]`

#### T-2763 — A suíte completa
**Tamanho:** PP · **Ref:** **P5**

`python -m pytest -q`, sozinha, comparada com a `T-2739`. Esperado: **1.608 + os testes novos**
(`T-2746`, `T-2749`×3, `T-2757` reforçado, `T-2758`), sem remoção.

**Pronto quando:** verde, número declarado.

---

#### T-2764 — `ruff` e `mypy`
**Tamanho:** PP · **Ref:** **P5**

Nos arquivos tocados: `annex.py`, `anexo_reader.py`, `configuracao.py`, `docx_renderer.py`,
`anexos.json` e os cinco arquivos de teste.

**Pronto quando:** os dois limpos.

---

#### T-2765 — O `git diff`, contra o inventário `[portão]`
**Tamanho:** PP · **Ref:** **P5**, regras 5 e 6

`git diff --stat` restrito ao inventário do PLANO §7. **Vazio** em: `ooxml.py`, `cabecalho.py`,
qualquer linha de `anexos.json` fora de `Servidores`/`ServidoresSemDesenv`, `frontend/`, `api/`.

**Pronto quando:** conferido, arquivo por arquivo.

---

#### T-2766 — Specs, README e CHANGELOG
**Tamanho:** PP · **Ref:** —

- `Status` da ESPEC 051: de **Proposta** para **Implementada**, com os números reais (`T-2759`,
  `T-2763`);
- ESPEC 004: nota em `R-ANX-11` remetendo à ESPEC 051, no mesmo padrão da nota que já remete à
  ESPEC 037;
- `README.md` e `docs/CHANGELOG.md`: entrada de correção.

**Pronto quando:** os quatro escritos.

---

## 9. Insumos em aberto

| ID | Questão | Bloqueia? |
|---|---|---|
| `I-01` | Estender `cabecalhos_adicionais` a `NAS`/`OutrosServicos`, fechando o `I-01` da ESPEC 037? | Não. Decisão própria (`D-05`) — muda um resultado hoje correto |
| `I-02` | Vale versionar o arquivo real da submissão como terceira fixture? | Não bloqueia. Ele já serve como medição de referência (`T-2741`) sem estar versionado |
| `I-03` | As 11 larguras herdadas para a tabela de resumo (prefixo das 15 medidas para a de detalhe) batem com o PDF do GRC? | Não bloqueia — é o comportamento de hoje, só sem as 4 colunas fantasmas. Vale conferir na fase de medição do GRC, fora deste backlog |

---

## 10. Emenda de execução

**2026-09-10.** Executada em pouco mais de uma hora de trabalho, mais duas execuções de suíte
completa (a primeira, contaminada por trabalho em paralelo; a segunda, isolada e limpa — 23min23s) e
seis renderizações de pacote completo. Os seis portões fechados, um deles depois de uma volta a mais
do que o previsto.

**O achado que o inventário não pegou: `test_anexo_sem_conteudo.py`.** A `T-2765` (`git diff` contra
o inventário da §7) e a busca da `E0` cobriram `_tabelas_esperadas`, `test_a_largura_e_do_bloco_e_nao_da_aba`
e `test_a_marca_de_cabecalho_cai_na_primeira_fileira_da_tabela` — os três lidos e transcritos antes do
código mudar. O que passou batido foi
`test_t2293_o_documento_do_pgm_perde_tres_secoes_e_nenhuma_tabela` (`test_anexo_sem_conteudo.py:255`,
ESPEC 036), que afirma `len(documento.tables) == 34` sobre o **documento completo do PGM com
aditivo** — não sobre os 19 anexos isolados, que é o que a `T-2742`/`T-2759` mediram (32 → 34). Com o
bloco de título e a tabela de comprovação somados, o número certo é outro: **34 → 36**. A causa raiz
de o inventário não achar isto: a busca por `\.corte\b` e por `Anexo\(` (`T-2750`, PLANO §7 busca 1-2)
achou os lugares que **leem o corte**, mas esse teste não lê `Anexo.corte` nem `Anexo.cortes` — ele só
conta tabelas do documento renderizado, e um teste desse formato só aparece rodando a suíte inteira.
**A lição: contagens hardcoded de `documento.tables` sobre o pacote completo não são achadas por
grep de símbolo — só pela suíte.** Corrigido com a mesma disciplina das reancoragens anteriores:
medido com o container real (`DIContainer` + os três arquivos do par PGM), não estimado — `36`,
confirmado — e o docstring do teste ganhou o mesmo formato de registro de delta que o resto do
arquivo já usa (`"32 porque foi medida sobre..."`, `"34 → 36 em 2026-09-10..."`), em vez de só trocar
o número.

**`test_o_custo_de_um_anexo_e_linear` falhou na primeira rodada, e por um motivo já documentado no
projeto — concorrência, não regressão.** A primeira execução da suíte completa rodou **enquanto** eu
conferia `git diff` e lia arquivos em paralelo, e o teste de custo de mesclagem — sensível a
contenção de CPU, o mesmo aviso que a ESPEC 036 §10 e a emenda do TASKS 037 já deixaram registrado —
acusou 2,81× contra o limite de 2,60×. Isolado (`pytest tests/test_desempenho.py::test_o_custo_de_um_anexo_e_linear`
sozinho), passou em 6,85 s. Confirmação adicional, por leitura: esta entrega não toca `_mesclar_anexo`,
`mesclar_regiao` nem nenhuma função de `ooxml.py` além de um comentário — não há caminho de código
que ligue esta mudança ao custo de mesclagem. A segunda execução, isolada, saiu limpa: **1.613
passed, 0 failed**. *A regra que o TASKS 037 já tinha escrito continua valendo: não é "não rodar em
paralelo com outra suíte", é não rodar nada.*

**A prova por desligamento saiu como prevista, nos dois pacotes.** `git stash` de `anexos.json`
(revertendo `cabecalhos_adicionais` para vazio, sem tocar código) devolveu os dois pacotes ao hash da
`T-2738` — `0b87c759…` (piloto) e `4e3197ff…` (PGM) — byte a byte, `4 passed`. Restaurado o stash, os
dois voltaram aos valores novos — `8561819f…` (piloto) e `7d00e15d…` (PGM) —, também `4 passed`. Das
40 entradas de cada pacote, só `word/document.xml` se moveu, nos dois sentidos e nos dois pacotes.

**A rede nova (`T-2758`) quase nasceu larga demais, e o próprio WIFI a corrigiu.** A primeira versão
comparava a fileira **crua** de todo `w:tblHeader` do documento contra "nenhuma célula vazia", sem
escopo — e reprovou em `WIFI`, cujo cabeçalho legítimo tem 2 rótulos em 10 colunas com células vazias
**por desenho da aba**, precedente já registrado na ESPEC 037 §2.6. A correção restringiu a rede às
fileiras cujos rótulos colapsados casam uma âncora — primária ou adicional — de `Servidores`/
`ServidoresSemDesenv`, no mesmo padrão de `_sem_ancora`/`_ancoras` que a ESPEC 037 já usa. Ficou mais
estreita do que a `§8.2` da espec sugeria em prosa, e mais correta.

**Resultado.** Backend **1.608 → 1.613 passed** (5 testes novos: a configuração, os três sintéticos
de `Anexo.cortes` e a rede de célula vazia — nenhum removido, nenhum teste existente mudando de
sentido além dos três previstos mais o achado desta seção). `ruff` e `mypy` limpos nos onze arquivos
tocados. **Dois artefatos reancorados** — `word/document.xml`, piloto e PGM —, com o delta provado
por desligamento nos dois sentidos. `Servidores`/`ServidoresSemDesenv`: 2 → 3 tabelas cada, nos dois
pacotes de anexos (38→40 piloto, 32→34 PGM) e no documento completo do PGM com aditivo (34→36).
`docx_renderer.py` tocado em **uma** função (`_faixa_de_tabelas`); `_tabela_do_anexo` e `ooxml.py`
intocados, exceto um comentário. `cabecalho.py`, `NAS`, `OutrosServicos`, `frontend/` e `api/` — git
diff vazio, conferido.
