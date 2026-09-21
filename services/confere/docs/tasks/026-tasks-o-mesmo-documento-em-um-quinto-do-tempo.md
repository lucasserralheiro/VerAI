# TASKS 026 — Backlog de "O mesmo documento em um quinto do tempo"

| | |
|---|---|
| **Especificação** | [ESPEC 026](../specs/026-o-mesmo-documento-em-um-quinto-do-tempo.md) v1.0 |
| **Plano** | [PLANO 026](../plans/026-plano-o-mesmo-documento-em-um-quinto-do-tempo.md) v1.0 |
| **Versão** | 1.0 — 2026-08-19 |
| **Total** | 26 tarefas · 5 portões · **0 insumos** |
| **Status** | **Concluído com ressalva** — 2026-08-19. Portões `P0` a `P3` fechados; **`P4` aberto** — exige janela em produção no `ca-confere-backend`. Backend 578 → **1.316 passed**, e a suíte caiu de 26 min 54 s para **12 min 46 s**. DOCX do piloto **22,1 → 4,6 s**, do PGM **96,6 → 11,2 s**. Navegador: **100/110**, e as 10 falhas são pré-existentes da `feature/evolucao` (§9.7). **Seis desvios e duas notas**, em §9 |

> **Escrito *antes* da implementação**, como os TASKS 020 a 023 e 025. A §9 — *o que a
> implementação ensinou* — nasce vazia e é preenchida ao fechar.

---

## 1. Convenções

**Identificadores** `T-20nn`, continuando a numeração: a ESPEC 025 fechou em `T-1937`. Os
identificadores `T-2010`–`T-2012` e `T-2020`–`T-2024` são os que a ESPEC §8 já nomeou e ficam onde
ela os pôs — **a numeração não é monotônica dentro dos épicos**, e isso é deliberado.

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`pytest` verde; comentário explicando o *porquê* onde a escolha não for óbvia.

**Convenção de commit** `<tipo>(T-20nn): descrição`.

### 1.1 Quatro regras que atravessam este backlog

**1 — A âncora é do código de hoje, ou não é âncora.** Os `sha256` de `T-2020`–`T-2022` são
medidos e comitados **antes** de qualquer linha de `src/` mudar. Extraídos depois, ancoram o
resultado da alteração: passam sempre e não afirmam nada. Não há como perceber isso depois — o
teste fica verde, o documento pode estar errado, e o único sinal seria alguém abrir o `.docx` no
Word.

O sinal no diff é uma constante `sha256` **nova** no mesmo commit que altera `backend/src/`.

**2 — Comparar XML, nunca comportamento.** Todo teste de equivalência deste backlog compara
`etree.tostring(...)`. Nunca `cell.text`, nunca contagem de linhas, nunca `len(tabela.rows)`. Os
três defeitos que o protótipo teve — `<w:t>` vazio, `w:sz` arredondado, `\t` literal — **passam em
todos os três**. É a razão de existir da ESPEC `D-05`.

O sinal no diff é um `assert` sobre `.text` dentro de `test_desempenho.py`.

**3 — A referência não é código morto.** `_escrever_de_referencia` (`T-2023`) e a comparação
contra `_Cell.merge` (`T-2024`) ficam verdes e parecem redundantes assim que a implementação nova
funciona. São o **único** ponto do repositório que ainda exercita a API pública do `python-docx`
para escrita de *run* e para mesclagem, e são o que vai acusar uma atualização da biblioteca
(`R-DES-07`). Removê-las transforma o teto de versão numa promessa sem quem a cobre.

O sinal no diff é a remoção de uma delas em nome de "limpeza".

**4 — Contar, não cronometrar.** `T-2010` e `T-2012` afirmam **zero chamadas**; `T-2011` afirma
uma **razão** entre duas medidas do mesmo ambiente. Nenhum teste deste backlog compara segundos
contra um número fixo: um teto absoluto mede a máquina, falha no CI carregado e — pior — **passa
se a correção for revertida numa máquina rápida**. A meta em segundos (`R-DES-08`) é o portão
`P2`, medido à mão.

O sinal no diff é `assert duracao < 8.0` em teste novo.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** A âncora, e o lugar de onde ela lê | T-2000 … T-2002, T-2020 … T-2022 | **P0** | F0 |
| **E1** Ver falhar | T-2003, T-2010, T-2012 | **P1** | F1 |
| **E2** `escrever` emite o XML direto | T-2004 … T-2006, T-2023 | — | F2 |
| **E3** A mesclagem recebe coordenadas | T-2007 … T-2009, T-2011, T-2024 | — | F3 |
| **E4** As limpezas e o teto de versão | T-2013 … T-2015 | — | F4 |
| **E5** Fechar | T-2016 … T-2019, T-2025 | **P2**, **P3**, **P4** | F5 |

**E2 e E3 são publicáveis sozinhos, e comutam entre si.** E0 e E1 são obrigatórios e nesta ordem.

### 2.1 A régua da entrega

| Muda | Não muda |
|---|---|
| O `w:pPr`/`w:rPr` passa a ser montado com `etree.SubElement` | **Um byte que seja** do `.docx` ou do `.xlsx` |
| A mesclagem de anexo recebe coordenadas em vez de duas células | O XML que a mesclagem produz |
| `fixar_larguras` recebe a grade já resolvida | As larguras que ela escreve |
| `documento_do_pgm` muda de arquivo (`test_capa` → `conftest`) | O que `test_capa` afirma |
| `_partes()` vira utilitário compartilhado | O que `test_quantitativo_consolidado` afirma |
| `python-docx` ganha teto de versão | A versão instalada hoje |
| O tempo: piloto 31 s → ~14 s; PGM ~115 s → ~35 s | A resposta da API, a tela, as validações, as regras de negócio |
| `pyproject.toml` declara o marcador `lento` | O conjunto de testes que roda por padrão |

---

## 3. Épico E0 — A âncora, e o lugar de onde ela lê `[portão P0]`

> **Nenhum arquivo de `backend/src/` é tocado neste épico.** O critério do `P0` é literal:
> `git diff --stat backend/src` vazio ao fim dele.

#### T-2000 — `_partes()` vira utilitário compartilhado
**Tamanho:** PP · **Ref:** PLANO §3 F0, ESPEC §2.7

`backend/tests/pacote.py`, novo. Recebe `_partes()` de `test_quantitativo_consolidado.py:130`,
**sem alterar uma linha do corpo**:

```python
PARTE_COM_CARIMBO_DE_HORA = "docProps/core.xml"


def partes(caminho: Path) -> dict[str, str]:
    """Hash de cada entrada do zip, sem o carimbo de hora."""
    with zipfile.ZipFile(caminho) as pacote:
        return {
            entrada.filename: hashlib.sha256(pacote.read(entrada.filename)).hexdigest()
            for entrada in pacote.infolist()
            if entrada.filename != PARTE_COM_CARIMBO_DE_HORA
        }
```

`test_quantitativo_consolidado.py` passa a importar. **Import no estilo dominante da suíte** —
`from pacote import partes`, como `from leitura_analise import …` e `from grafia import …`; a forma
`from tests.x import …` existe em **um** ponto só (`test_divergencia_de_fonte.py:27`) e não é o
padrão. **O comentário de quatro linhas acima da
constante viaja junto** — ele registra que a exclusão foi *medida antes de ser excluída* (ESPEC 022
§2.3), e é exatamente o que se perde numa extração apressada.

Acrescentar ao comentário o que a `T-2002` mediu: o pacote é estável byte a byte entre processos,
**inclusive** essa parte, e a exclusão fica por consistência e como cinto.

**Pronto quando:** `test_quantitativo_consolidado` verde sem nenhuma asserção alterada.

---

#### T-2001 — `documento_do_pgm` muda de casa
**Tamanho:** P · **Ref:** PLANO §3 F0, §6

Mover a fixture de `test_capa.py:132` para `conftest.py`, ao lado de `docx_do_piloto`. É o
documento do PGM **com aditivo** — o que exercita 3.157 mesclagens.

O corpo é copiado sem alteração; `test_capa` continua recebendo por nome e **não muda mais nada**.
O `_gerar` local de `test_capa.py:111` é copiado junto ou inlinado, o que for menor.

Docstring nova, no padrão do bloco *"o que é caro, e o que vale cachear"* do `conftest`: são ~115 s
hoje, e a fixture existe para que a `T-2021` não seja a **quarta** renderização de PGM da suíte.

**Pronto quando:** `test_capa` verde sem asserção alterada, e `docx_do_pgm_com_aditivo` (ou o nome
que ficar) visível de qualquer módulo.

> **Isto não consolida as três fixtures de PGM.** `test_linhas_derivadas.docx_do_pgm` e
> `test_anchor_por_codigo.pgm` são o documento **sem** aditivo — outro artefato, outras asserções.
> Unificá-las é `I-34`, e mexer nelas aqui misturaria uma economia de suíte com o portão `P0`.

---

#### T-2020 — A âncora do piloto `[portão P0]`
**Tamanho:** P · **Ref:** `R-DES-01`

`backend/tests/test_identidade_dos_artefatos.py`, novo.

```python
from pacote import partes

# Medidos em 2026-08-__ contra `feature/evolucao`, com `src/` intocado.
# Regenerar: pytest --regenerar-ancoras (ou o utilitário que a T-2020 definir)
PACOTE_DO_PILOTO: dict[str, str] = {
    "[Content_Types].xml": "…",
    "word/document.xml": "…",
    …
}


def test_o_docx_do_piloto_e_byte_a_byte_o_de_sempre(docx_do_piloto: Path) -> None:
    assert partes(docx_do_piloto) == PACOTE_DO_PILOTO
```

Compara o **dicionário inteiro**, não parte a parte num laço: o `assert` de dicionário do pytest
já mostra a entrada divergente, e um laço com `continue` esconde uma parte que apareça ou suma.

Lê de `docx_do_piloto`, que já é fixture de sessão em `conftest.py:283` — **nenhuma renderização
nova**.

**Pronto quando:** passa **hoje**, contra o código intocado.

> **Por que por entrada, e não um `sha256` do arquivo.** Foi medido na `T-2002`: um só bastaria.
> A escolha é pela mensagem de falha — `word/document.xml` difere aponta para o defeito; *o
> arquivo difere* faz a próxima pessoa começar do zero, e ela vai começar com 3,8 MB de zip.

---

#### T-2021 — A âncora do PGM `[portão P0]`
**Tamanho:** PP · **Ref:** `R-DES-01`

Idêntica à `T-2020`, sobre a fixture da `T-2001`.

**É a âncora que importa mais**, e o épico inteiro existe por ela: o piloto tem 871 mesclagens e o
PGM tem **3.157**. A E3 pode passar no piloto e quebrar aqui.

**Pronto quando:** passa hoje, e o tempo total do arquivo não cresce mais que o custo de abrir dois
zips.

---

#### T-2022 — A âncora do `.xlsx` da análise `[portão P0]`
**Tamanho:** PP · **Ref:** `R-DES-01`

Um `sha256` do arquivo inteiro, nos dois pares. Sem exclusão de parte: o XLSX é montado do zero
pelo `XlsxAnaliseRenderer`, não é aberto de um modelo, e não carrega carimbo herdado.

**O renderizador do XLSX não é tocado por esta espec — e é exatamente por isso que ele entra.**
Esta é a tarefa que falha se a alteração vazar para onde não devia. Uma espec cujo escopo é *não
mudar nada* precisa de pelo menos um teste sobre algo que ela nem pretende encostar.

**Pronto quando:** passa hoje.

---

#### T-2002 — O custo e a estabilidade, medidos
**Tamanho:** PP · **Ref:** PLANO §6

Duas medições, e as duas viram comentário:

1. **Custo.** Rodar `pytest tests/test_identidade_dos_artefatos.py --durations=5`. Se aparecer
   uma renderização de PGM, a `T-2001` falhou no propósito dela e é ela que se corrige — não se
   aceita o custo.
2. **Estabilidade.** Gerar o mesmo documento em **dois processos separados** e conferir que o
   `sha256` do arquivo inteiro coincide. Já verificado uma vez em 2026-08-19; refazer aqui é o que
   transforma verificação em registro.

**Pronto quando:** os dois números estão no cabeçalho de `test_identidade_dos_artefatos.py`.

---

**Verificação do E0:** `P0` — as três âncoras passam e `git diff --stat backend/src` está vazio.

---

## 4. Épico E1 — Ver falhar `[portão P1]`

> **Nenhum arquivo de `backend/src/` é tocado neste épico.** As duas tarefas de teste terminam
> **vermelhas**, e o vermelho é o produto.

#### T-2012 — `escrever` não consulta a ordem do esquema `[portão P1]`
**Tamanho:** PP · **Ref:** `R-DES-03`

`backend/tests/test_desempenho.py`, novo.

```python
def test_escrever_nao_consulta_a_ordem_do_esquema(monkeypatch) -> None:
    chamadas = 0
    original = BaseOxmlElement.insert_element_before

    def contado(self, elm, *tagnames):
        nonlocal chamadas
        chamadas += 1
        return original(self, elm, *tagnames)

    monkeypatch.setattr(BaseOxmlElement, "insert_element_before", contado)

    tabela = docx.Document().add_table(rows=1, cols=1)
    ooxml.escrever(tabela._cells[0], "x", negrito=True, corpo=4.8)

    assert chamadas == 0
```

O ponto de instrumentação **já foi verificado**: `BaseOxmlElement.insert_element_before` aceita
`setattr` de classe e conta corretamente. **Hoje conta 7** — uma por atributo que `escrever`
atribui pela API pública.

**Pronto quando:** falha, dizendo `7 != 0`.

---

#### T-2010 — A mesclagem não varre as fileiras `[portão P1]`
**Tamanho:** P · **Ref:** `R-DES-04`

Mesma técnica, sobre `CT_Tc._tr_idx` e `CT_Tc._tr_below` — os dois caminhos O(fileiras) de
`CT_Tc.merge`. Ambos são `property`, e o `monkeypatch` troca por uma `property` que conta e
delega.

**O escopo é `_tabelas_do_anexo`, não a renderização inteira.** `mesclar_linha` continua usando
`_Cell.merge` no bloco de título (`R-DES-09`), e são três células: contar o documento todo daria
um número diferente de zero por motivo legítimo, e o teste teria de aceitar um teto arbitrário.
**Zero é uma asserção; "menos de 40" é uma opinião.**

Monta-se um `Anexo` sintético com mesclagens — não se abre a planilha real, que custaria 2,8 s
para provar uma contagem.

**Hoje conta 12 por mesclagem** (medido numa tabela de 6 fileiras); no piloto, 10.452 no total, e
no PGM, 37.884.

**Pronto quando:** falha, com a contagem visível na mensagem.

---

#### T-2003 — As contagens de hoje, registradas
**Tamanho:** PP · **Ref:** ESPEC §2.2, §2.3

Os números que `T-2010` e `T-2012` imprimem ao falhar vão para o *docstring* dos dois testes, com
a data e o *commit*. São eles que a ESPEC §14 vai citar quando a espec fechar, e que tornam a
afirmação *"o defeito existia"* verificável depois de ele não existir mais.

**Pronto quando:** os dois *docstrings* trazem número, data e `git rev-parse --short HEAD`.

---

**Verificação do E1:** `P1` — `T-2010` e `T-2012` falham, com as contagens esperadas. Se
**passarem**, o diagnóstico da ESPEC §2 está errado e a entrega não prossegue.

---

## 5. Épico E2 — `escrever` emite o XML direto `[publicável sozinho]`

> Só `backend/src/infrastructure/report/ooxml.py` é tocado.

#### T-2023 — `escrever` reproduz a API pública
**Tamanho:** M · **Ref:** `R-DES-03`, `R-DES-06`

Em `test_desempenho.py`. A implementação de **hoje** é copiada para o arquivo de teste como
`_escrever_de_referencia`, tal e qual, e o teste compara o XML das duas:

```python
@pytest.mark.parametrize("corpo", [None, *CORPOS_DOS_ANEXOS])
@pytest.mark.parametrize("negrito", [True, False])
@pytest.mark.parametrize("alinhamento", ["left", "center", "right"])
@pytest.mark.parametrize("texto", TEXTOS)
def test_escrever_reproduz_a_api_publica(texto, alinhamento, negrito, corpo) -> None:
    esperado = _celula_com(_escrever_de_referencia, texto, alinhamento, negrito, corpo)
    obtido = _celula_com(ooxml.escrever, texto, alinhamento, negrito, corpo)
    assert etree.tostring(obtido) == etree.tostring(esperado)
```

**A matriz é fechada, não amostrada:**

| Eixo | Valores |
|---|---|
| `texto` | `""` · `"x"` · `"  espaço  "` · `"a\tb"` · `"a\nb"` · `"E&Cia <2>"` · `"ATIVAÇÃO"` · `"DATA DE ATIVACAO\t:\t26/06/2023"` |
| `negrito` | `True`, `False` |
| `corpo` | `None` **e os catorze de `anexos.json`** — 3,5 · 4,0 · 4,1 · 4,3 · 4,4 · 4,6 · 4,8 · 5,6 · 5,8 · 6,4 · 6,7 · 8,9 · 10,2 · 11,0 |
| `alinhamento` | `left`, `center`, `right` |
| `cor` | padrão · `"#222854"` · `"222854"` · `"e6e6fa"` (minúscula) |

> **Os catorze corpos, e não uma amostra.** Seis deles — **4,3 · 4,4 · 4,8 · 5,8 · 6,4 · 8,9** —
> dão resultado diferente entre `int(...)` e `round(...)`; os outros oito dão o mesmo. Uma amostra
> escolhida a esmo tem chance real de conter só os oito silenciosos, e o teste passaria sobre um
> defeito que atinge **seis dos dezenove anexos**: `Servidores`, `ServidoresSemDesenv`, `Detalhes`,
> `WIFI`, `NAS` e `ServicosVcloud`.

`CORPOS_DOS_ANEXOS` é lido de `anexos.json`, não transcrito: um anexo novo com corpo novo entra na
matriz sozinho.

**Pronto quando:** passa **antes** da `T-2004` — trivialmente, porque as duas são o mesmo código —
e continua passando **depois** dela, quando aí sim afirma alguma coisa.

> **Nascer trivialmente verde é correto, e tem precedente.** É o padrão de `_sem_os_deltas` em
> `test_quantitativo_consolidado.py`, cujo *docstring* registra o mesmo raciocínio: *"antes da
> T-1610 os dois são idênticos (…) depois dela as asserções passam a significar o que dizem"*. O
> *docstring* da `T-2023` diz isso, com o ponteiro para a `T-2004`.

---

#### T-2004 — A reescrita
**Tamanho:** M · **Ref:** `R-DES-03`, `D-01`

`ooxml.escrever`, **mesma assinatura, mesmo nome, uma função só** (`R-DES-11`). Esboço na
ESPEC §7. Os pontos que o `sha256` cobra:

| Detalhe | Regra |
|---|---|
| Ordem do `w:rPr` | `rFonts`, `b`, `color`, `sz` — nessa ordem, sem exceção |
| `negrito=False` | emite `<w:b w:val="0"/>`; **omitir o elemento não é equivalente** |
| `texto == ""` | **não** emite `<w:t>` |
| `w:sz` | `int(int(pt * 12700) / 12700.0 * 2)` — é o que `ST_HpsMeasure.convert_to_xml` faz |
| `\t` / `\n` | `<w:tab/>` / `<w:br/>`, como `CT_R.add_t` |
| espaço nas pontas | `xml:space="preserve"`, e só quando `len(texto.strip()) < len(texto)` |
| `cor` | `lstrip("#").upper()`, como o `_sem_cerquilha` de hoje |

Os *clark names* (`qn("w:rPr")` etc.) são resolvidos **uma vez, em constantes de módulo**: `qn`
aparece com 2,07 milhões de chamadas no perfil de hoje, e resolvê-lo dentro do laço devolveria
parte do ganho.

**Pronto quando:** `T-2012` verde, `T-2023` verde, e `T-2020`/`T-2021`/`T-2022` **inalteradas e
verdes**.

---

#### T-2005 — Os três casos nomeados
**Tamanho:** PP · **Ref:** ESPEC §2.5

Os parâmetros da `T-2023` que correspondem aos três defeitos do protótipo ganham `pytest.param(...,
id=...)`: `texto_vazio`, `corpo_4_8`, `com_tabulacao`.

Sem isso, a falha aparece como `test_escrever_reproduz_a_api_publica[0-True-left-4.8]` e alguém
gasta vinte minutos descobrindo qual eixo importa.

**Pronto quando:** `pytest --collect-only` mostra os três ids legíveis.

---

#### T-2006 — O comentário que sustenta o acoplamento
**Tamanho:** PP · **Ref:** `R-DES-06`

Cabeçalho de `escrever`, no tom do resto de `ooxml.py`: por que o XML é montado à mão, qual é a
ordem canônica, e que **`T-2023` é quem guarda o acordo com a biblioteca**.

E, em `_escrever_de_referencia`, o inverso: *não remover — é o único ponto do repositório que ainda
usa a API pública para escrever um `run`, e é o que acusa uma atualização do `python-docx`*
(regra 3 do §1.1).

**Pronto quando:** as duas notas existem.

---

**Verificação do E2:** suíte de backend inteira. Ganho esperado: piloto 22,1 s → ~10 s;
PGM 96,6 s → ~71 s. **Publicável sozinho.**

---

## 6. Épico E3 — A mesclagem recebe coordenadas `[publicável sozinho]`

#### T-2024 — `mesclar_regiao` reproduz a API pública
**Tamanho:** M · **Ref:** `R-DES-04`, `R-DES-06`

Duas tabelas sintéticas idênticas, uma mesclada por `ooxml.mesclar` e outra por `mesclar_regiao`,
comparando `etree.tostring` da **tabela inteira** — não da célula mesclada: uma implementação que
esqueça de remover os `w:tc` absorvidos produz a mesma célula-topo e uma tabela diferente.

Matriz:

| Caso | Por quê |
|---|---|
| 1×N (horizontal) | o caso mais comum das abas |
| N×1 (vertical) | exercita a descida por índice de `D-04` |
| N×M | os dois eixos juntos |
| começando fora da fileira 0 | o `topo` deixa de ser trivial |
| **aparada em `ate_coluna`** | `min(mesclagem.ate_coluna, colunas - 1)`, ESPEC 014 `R-BRD-05` |
| duas mesclagens disjuntas na mesma tabela | a invariante de não-sobreposição de `D-03` |
| célula única (1×1) | `mesclar` devolve cedo; `mesclar_regiao` não pode divergir aí |

> **A mesclagem aparada é a que se esquece.** É a faixa vazia de `SOA`, **o único caso real do
> piloto** que passa por ali. Uma implementação que ignore o aparo produz XML diferente em um
> anexo só, e o `sha256` acusa sem dizer onde. Este teste diz.

**Pronto quando:** passa antes da `T-2008` — as duas rotas ainda são a mesma — e depois.

---

#### T-2007 — `mesclar_regiao`
**Tamanho:** M · **Ref:** `R-DES-04`, `D-04`

Em `ooxml.py`:

```python
def mesclar_regiao(
    fileiras: list[Any], topo: int, esquerda: int, altura: int, largura: int
) -> Any:
    """A mesclagem com o retângulo já conhecido — sem varrer as fileiras (D-03)."""
    tc = fileiras[topo].tc_at_grid_offset(esquerda)
    _crescer(fileiras, topo, tc, largura, altura, tc)
    return tc


def _crescer(fileiras, linha, tc, largura, altura, topo_tc):
    vmerge = (
        ST_Merge.CONTINUE if topo_tc is not tc
        else None if altura == 1
        else ST_Merge.RESTART
    )
    deslocamento = tc.grid_offset          # lido ANTES de `_span_to_width`
    tc._span_to_width(largura, topo_tc, vmerge)
    if altura > 1:
        abaixo = fileiras[linha + 1].tc_at_grid_offset(deslocamento)
        _crescer(fileiras, linha + 1, abaixo, largura, altura - 1, topo_tc)
```

**`_span_to_width`, `_swallow_next_tc` e `_move_content_to` são reaproveitados como estão**
(`D-04`): são locais aos irmãos, são baratos, e é onde nasceria um defeito de fidelidade. Só o que
é O(fileiras) é reescrito.

O `deslocamento` é lido **antes** de `_span_to_width` de propósito — depois dela o `w:tc` engoliu
os vizinhos à direita, e a leitura continuaria correta, mas por acidente. O `python-docx` faz o
mesmo, e a ordem fica registrada em comentário.

**Pronto quando:** `T-2024` verde.

---

#### T-2008 — `_mesclar_anexo` passa coordenadas
**Tamanho:** P · **Ref:** `R-DES-04`

`docx_renderer.py:582`. A lista de fileiras é resolvida **uma vez por tabela**:

```python
fileiras = tabela._tbl.findall(qn("w:tr"))
for mesclagem in anexo.mesclagens:
    if mesclagem.linha < inicio or mesclagem.ate_linha >= fim:
        continue
    if mesclagem.coluna >= colunas:
        continue
    ate_coluna = min(mesclagem.ate_coluna, colunas - 1)
    topo = mesclagem.linha - inicio
    altura = (mesclagem.ate_linha - inicio) - topo + 1
    largura = ate_coluna - mesclagem.coluna + 1
    if altura == 1 and largura == 1:
        continue                       # equivale ao `primeira._tc is ultima._tc` de hoje
    celula = _Cell(ooxml.mesclar_regiao(fileiras, topo, mesclagem.coluna, altura, largura), pai)
    for paragrafo in celula.paragraphs[1:]:
        paragrafo._element.getparent().remove(paragrafo._element)
```

A assinatura ganha a tabela (ou as fileiras) — hoje o método recebe só `grade`. A limpeza dos
parágrafos excedentes **continua onde está**: é o que `ooxml.mesclar` fazia, e removê-la engorda a
página de `Office365` visivelmente.

**Pronto quando:** `T-2010` verde e `T-2020`/`T-2021` **inalteradas e verdes**.

---

#### T-2011 — O custo é linear
**Tamanho:** P · **Ref:** `D-07`

Tabela sintética de 8 colunas, N=400 e N=800 fileiras, uma mesclagem de linha inteira por fileira.
Afirma `t(800) / t(400) <= 2,6`.

Medido: **4,15** com o código de hoje, **1,16** com `mesclar_regiao`. A margem é de 2,2× para baixo
e 1,6× para cima, e o `1,16` foi tomado **com a suíte inteira rodando em paralelo** — o pior caso
de contenção que este projeto produz.

Marcado `@pytest.mark.lento`, **com o marcador declarado em `pyproject.toml`**:

```toml
[tool.pytest.ini_options]
markers = ["lento: mede razão de tempo; sensível a contenção"]
```

O projeto não declara marcador nenhum hoje (`pytest.mark.anyio` vem do plugin), e um marcador
desconhecido sai como aviso — numa suíte com **um** aviso conhecido, é ruído que alguém vai
investigar.

**Pronto quando:** passa, e `pytest -m "not lento"` o exclui.

---

#### T-2009 — `mesclar` e `mesclar_linha` ficam, com o porquê
**Tamanho:** PP · **Ref:** `R-DES-09`

As duas continuam. `mesclar_linha` é usada em `_bloco_titulo` e `_bloco_de_linhas`, sobre tabelas
de 3 e 5 colunas — otimizar o que custa três mesclagens seria gerar risco sem contrapartida.

Comentário em `mesclar` apontando para `mesclar_regiao` e dizendo **quando usar qual**: a de
coordenadas quando o chamador já as tem; a de células quando não.

**Pronto quando:** o comentário existe e `mesclar` não ficou órfã.

---

**Verificação do E3:** `test_docx_anexos` inteiro — é quem cobre mesclagem de anexo por
comportamento. Ganho esperado: piloto → ~5 s; PGM → ~17 s. **Publicável sozinho.**

---

## 7. Épico E4 — As limpezas e o teto de versão

> Nada aqui é o objetivo da espec. São itens que estavam no caminho.

#### T-2013 — `_cells` resolvido uma vez por tabela
**Tamanho:** P · **Ref:** ESPEC §2.6

`ooxml.py:189` e `docx_renderer.py:534` resolvem `tabela._cells` **duas vezes** para a mesma
tabela — e `_cells` reconstrói a grade inteira, resolvendo `gridSpan` e `vMerge` célula a célula.

`fixar_larguras` passa a receber a grade já resolvida. **É a única mudança de interface deste
backlog.**

Vale ~0,25 s. Se atrasar o E3, **sai** — não há prejuízo.

**Pronto quando:** as duas chamadas viram uma, e `docx_do_piloto` continua com o mesmo `sha256`.

---

#### T-2014 — O texto da página 1, lido uma vez
**Tamanho:** P · **Ref:** ESPEC §2.6

`pdfplumber_extractor.py`: `_proposta`, `_cliente` e `_identificar` chamam
`pdf.pages[0].extract_text()` cada um. Extrair uma vez e repassar.

O *docstring* de `_identificar:210` afirma *"nenhuma página é aberta de novo: `extract_text()` da
página 1 é o mesmo texto que `_proposta()` e `_cliente()` consomem"*. É verdade sobre a **página**
— os objetos são cacheados pelo `pdfplumber` — e falso sobre o **texto**, que é remontado três
vezes. Depois desta tarefa, é verdade sobre os dois.

**Pronto quando:** uma chamada, e `test_extractor_contract`, `test_extractor_contrato_pgm`,
`test_extractor_aditivo` e `test_documento_submetido` verdes.

---

#### T-2015 — O teto de versão
**Tamanho:** PP · **Ref:** `R-DES-07`

`backend/pyproject.toml`: `python-docx>=1.2.0,<2`, e `uv lock`.

Comentário no padrão do arquivo — que já explica cada dependência —, dizendo que `R-DES-01` depende
do comportamento desta biblioteca, e que **`T-2023` e `T-2024` são quem sustenta o teto**: sem
eles, teto de versão só adia o problema.

**Pronto quando:** `uv sync` reproduz o ambiente e a suíte segue verde.

---

## 8. Épico E5 — Fechar `[portões P2, P3 e P4]`

#### T-2016 — A meta de tempo `[portão P2]`
**Tamanho:** PP · **Ref:** `R-DES-08`

Cronometrar a renderização do DOCX nos dois pares, na máquina de referência, **com o processo em
repouso** — não com a suíte rodando ao lado, como foi a medida de contenção da `T-2011`.

Meta: piloto ≤ 8 s, PGM ≤ 25 s. Protótipo: 5,3 s e 16,5 s.

Se não bater: **investigar, não reverter**. A distância entre protótipo e código entregue é o que
este portão existe para medir.

**Pronto quando:** os dois números estão na ESPEC §14.

---

#### T-2017 — O conjunto `[portão P3]`
**Tamanho:** P · **Ref:** PLANO §2

`pytest -q --durations=12` com a contagem reconciliada: **578** mais as tarefas de teste deste
backlog. `mypy --strict`, `ruff check`, `bandit`. E `pnpm exec playwright test`.

> **A suíte de navegador roda mesmo sem uma linha de frontend ter mudado.** A ESPEC 012 §12.5
> registra por quê: naquela entrega, a exigência de *"a suíte inteira verde"* devolveu um defeito
> de tela de dois incrementos atrás. O custo é uma execução.

**Pronto quando:** tudo verde, contagem batendo.

---

#### T-2018 — A nova linha de base da suíte
**Tamanho:** PP · **Ref:** ESPEC §8.5

Registrar o novo tempo total ao lado da linha de base de **26 min 54 s**, e refazer a tabela dos
doze mais lentos. Projeção: 8 a 10 min.

É consequência, não objetivo — `P3` exige a suíte **verde**, não rápida —, mas é o número que
decide `I-33` e `I-34`.

**Pronto quando:** a ESPEC §8.5 traz as duas medidas.

---

#### T-2019 — Produção `[portão P4]`
**Tamanho:** PP · **Ref:** PLANO §2

Uma geração real do par do PGM no `ca-confere-backend`, cronometrada. É onde a ESPEC 012 `P1`
mediu, e é onde este número precisa aparecer — 1 vCPU, e a ESPEC 012 §2.3 mostrou que a vCPU do
Container Apps é **mais rápida** que esta máquina.

Não bloqueia a entrega; bloqueia o encerramento da espec.

**Pronto quando:** o número está na ESPEC §14, com data e revisão.

---

#### T-2025 — Emendas e documentação
**Tamanho:** P · **Ref:** ESPEC 012 §12, ESPEC 007 §13

Preencher a §9 deste arquivo com o que a implementação contrariou. Atualizar a ESPEC 026 §14 e o
CHANGELOG.

**Se algum `sha256` precisou ser reancorado, é aqui que se explica por quê** — e a explicação
precisa ser boa, porque `R-DES-01` diz que não deveria.

**Pronto quando:** §9 preenchida, mesmo que só para dizer que nada desviou.

---

## 9. O que a implementação ensinou

Seis afirmações deste backlog não sobreviveram ao contato com o código. Registradas, não
contornadas — é a conduta da ESPEC 007 §13.

### 9.1 A `T-2022` estava errada: o `.xlsx` **tem** carimbo de hora `[desvio]`

A tarefa dizia *"um só `sha256`, do arquivo inteiro: o XLSX não é aberto de um modelo e não tem
parte com carimbo"*. **A segunda metade é falsa.** O `openpyxl` monta o pacote do zero e grava
`dcterms:modified` com a hora corrente:

```
a  <dcterms:modified …>2026-08-19T14:10:11Z</dcterms:modified>
b  <dcterms:modified …>2026-08-19T14:10:13Z</dcterms:modified>
```

Duas renderizações do **mesmo objeto**, com 1,2 s de intervalo, diferem no arquivo inteiro — e
são idênticas em todas as outras entradas. A âncora do `.xlsx` passou a usar `partes()`, como a
do `.docx`.

O erro foi de raciocínio, e vale nomeá-lo: *"não é aberto de um modelo"* explica por que não há
metadado **herdado**, e nada diz sobre metadado **gerado**. A pista estava à vista — o
`test_quantitativo_consolidado` já comparava o `.xlsx` por `partes()`, e não por arquivo
inteiro, desde a ESPEC 022.

Foi pego porque a âncora foi medida em dois processos separados antes de virar constante
(`T-2002`). Medida uma vez só, teria entrado no repositório e falhado na segunda execução da
suíte, com a espec já implementada e a suspeita caindo sobre a `T-2004`.

### 9.2 O critério literal do `P0` não serviu nesta árvore `[desvio]`

`P0` pedia `git diff --stat backend/src` vazio. A `feature/evolucao` já tinha **2.014 linhas**
não comitadas em 19 arquivos de `backend/src` antes desta entrega começar, então o comando não
distingue o que é meu do que já estava lá.

Substituído por um instantâneo de `sha256` de todos os 53 `.py` de `src/`, tirado antes da
`T-2004`. Resultado ao fim:

```
infrastructure/contract/pdfplumber_extractor.py
infrastructure/report/docx_renderer.py
infrastructure/report/ooxml.py
(3 de 53)
```

Exatamente os três que a PLANO §7 previu. Nada em `domain/`, `application/` ou `api/`.

### 9.3 `lxml` passou a ser dependência **declarada** `[desvio]`

`R-DES-05` dizia *"nenhuma dependência nova. Só `lxml` (já presente, é a base do
`python-docx`)"*. Presente no ambiente, sim — mas **não declarada** no `pyproject.toml`, e
agora há `from lxml.etree import SubElement` em código de produção.

Duas consequências, ambas assumidas:

* `lxml>=5.0.0` entra em `dependencies`. Dependência usada e não declarada quebra no dia em que
  a transitiva sai;
* `lxml.*` entra nos `overrides` do mypy, junto de `pdfplumber`, `docx`, `openpyxl` e
  `defusedxml` — a biblioteca não publica *stubs*, e sem o override o `mypy --strict` reprova.
  É o padrão que o projeto já adota para as fronteiras com bibliotecas de I/O.

A alternativa era usar o `OxmlElement` que o módulo já importa, e ela custa: era exatamente o
que o perfil mostrava com 139 mil chamadas e 2,0 s.

### 9.4 Duas contagens saíram diferentes do previsto `[desvio]`

| Onde | Previsto | Medido | Por quê |
|---|---|---|---|
| `T-2012` | 7 chamadas a `insert_element_before` | **8** | com `alinhamento` explícito há um `w:jc` a mais. Sem ele são 7. O teste exercita o caso de oito, que passa por todos os ramos |
| `T-2011` | razão ~1,16 depois | **1,55** | o microbenchmark media só a mesclagem; o teste mede `_tabelas_do_anexo`, que carrega junto o custo **linear** de escrever as células. Continua muito abaixo do teto de 2,6 |

### 9.5 A `T-2001` teve de devolver dois artefatos, não um

`documento_do_pgm` devolvia o `.docx`. A `T-2022` precisa do `.xlsx` do **mesmo** par, e
gerá-lo de novo custaria os ~20 s de `gerar()` outra vez.

A fixture virou `artefatos_do_pgm`, que renderiza os dois de uma geração só; `documento_do_pgm`
e `xlsx_da_analise_do_pgm` derivam dela. `test_capa` continua pedindo `documento_do_pgm` pelo
mesmo nome e não mudou uma asserção.

### 9.6 O resultado saiu melhor que o protótipo

O protótipo da ESPEC §2.5 entregou 5,3 s (piloto) e 16,5 s (PGM). A entrega deu **4,6 s** e
**11,2 s**, porque a `T-2013` entrou junto — a grade de células deixou de ser resolvida duas
vezes por tabela de anexo, e o protótipo não fazia isso.

Vale registrar o inverso também: a `T-2013` sozinha valia ~0,25 s no protótipo, e o backlog a
classificou como *"limpeza, não objetivo"*. Sobre o caminho já corrigido, ela vale mais do que
valia sobre o caminho lento — o custo dela era proporcionalmente invisível enquanto `escrever`
dominava.

### 9.7 A suíte de navegador achou dez falhas, e nenhuma é desta entrega

Executada com backend e frontend no ar: **100 passaram, 10 falharam, em 19,2 min.**

> **A primeira tentativa não era falha da suíte, era do arnês.** Rodada como
> `playwright test 2>&1 | tail -25`, ficou 25 min sem emitir uma linha e foi interrompida por
> suspeita de travamento. O `tail` **segura toda a saída até o processo terminar** — o
> repórter `line` estava produzindo normalmente. Sem o cano, a saída flui desde o primeiro
> teste. Fica registrado porque custou meia hora e vai custar de novo.

Antes de rodar, uma geração real por HTTP contra o backend no ar confirmou que ele servia o
código novo: **14,8 s**, contra os ~31 s de antes. É a medição de ponta a ponta que faltava ao
`P2`, que mediu em processo.

**As dez, e por que nenhuma é desta entrega:**

| Falhas | Espec | Diagnóstico |
|---|---|---|
| 8 | `a11y-estrutura` ×2, `a11y-teclado`, `analise` ×4, `limpar` ×1 | **Nem chegam ao backend.** Todas importam de `estados.ts`, que intercepta `**/reports` com `route.fulfill` — a resposta é fixture no próprio arquivo de teste |
| 1 | `smoke.spec.ts:22` | Espera *"36 … de 55 itens com divergência"*. O backend devolve **37 de 58** — número produzido em `domain/`, que esta entrega não toca, e que `test_api_e2e.py` cobre e aprova |
| 1 | `limpar.spec.ts:246` | Espera **dois** campos de arquivo; o formulário tem **três** — o campo de aditivos da ESPEC 019 |

As duas últimas são as únicas que tocam o backend, e as duas falham por **contagem de itens e
de campos** — grandezas que uma mudança cujo critério de aceite é *artefato byte a byte
idêntico* não tem como produzir.

**Não foi feita a prova por `git stash`**, que é o que a ESPEC 012 §12.5 fez no caso dela. A
árvore tem 2.014 linhas não comitadas de outro trabalho **nos mesmos arquivos**, e um stash
seletivo dos três arquivos desta entrega levaria junto o que já estava lá. A evidência acima é
de outra natureza — oito casos não chamam o backend, e os dois que chamam falham em números
que o `test_api_e2e` verifica — mas é evidência circunstancial, e está dita como tal.

`P3` fica **fechado no backend** e **condicionalmente fechado no navegador**: as dez falhas são
da `feature/evolucao` em andamento, e cabem a quem a estiver conduzindo.

### 9.8 Um `I001` pré-existente em `tests/test_divergencia_de_fonte.py`

`ruff check tests/` acusa import desordenado naquele arquivo, que **não faz parte desta
entrega** e não foi tocado. Não corrigido de propósito: arrumá-lo aqui misturaria uma limpeza
alheia com uma espec de desempenho. `ruff check` está limpo em todos os arquivos que esta
entrega criou ou alterou.

### 9.9 O que o backlog acertou

* **A ordem.** `P0` antes de `P1` antes da mudança. As âncoras foram medidas contra o código
  intocado e **nunca precisaram ser reancoradas**: quatro execuções depois — pós-`escrever`,
  pós-mesclagem, pós-limpezas e na suíte inteira —, os quatro artefatos continuam byte a byte
  os de antes. (Dentro desta entrega. Elas ficaram vermelhas depois, por mudanças de texto que
  nada têm a ver com desempenho — §9.10.)
* **Comparar XML, nunca comportamento.** As 720 combinações da `T-2023` ficaram verdes na
  primeira execução depois da `T-2004`. Sem elas, os três defeitos do protótipo teriam de ser
  reencontrados por `diff` de `document.xml`, como na análise.
* **Contar, não cronometrar.** `T-2010` e `T-2012` inverteram de vermelho para verde sem uma
  linha de tolerância, e valem em qualquer máquina.
* **A `T-2001`.** Sem ela, a `T-2021` seria a quarta renderização de PGM da suíte.

### 9.10 As âncoras do `.docx` ficaram vermelhas — 2026-08-19, e não por esta entrega

O docstring de `test_identidade_dos_artefatos.py` manda registrar aqui qualquer reancoragem.
Este registro é do caso vizinho, e igualmente previsto: as âncoras reprovaram, o delta foi
provado — e **a reancoragem foi adiada de propósito**, pelo motivo da última seção abaixo.

**Não foi esta espec que as moveu.** Foi a correção da ESPEC 024 para a v1.1: a frase de
`R-NOT-02` fora escrita sem o `*` inicial, o título do bloco final prometia um marcador que a
nota não tinha, e pôr o `*` na frase muda um caractere do corpo dos dois documentos.

Vale separar o que a `R-DES-01` afirma do que ela não afirma. Ela diz que **o refatoramento do
renderizador** não move o documento — é o critério de aceite de uma entrega de desempenho.
Uma alteração deliberada de texto, decidida noutra espec, não a contradiz; contradizê-la seria
o documento mudar sem que ninguém tivesse pedido. As âncoras continuam valendo exatamente para
o que foram feitas: se uma otimização mexer no documento, elas acusam.

O que foi medido, e o que a medição provou:

| | Piloto | PGM |
|---|---|---|
| Entradas do pacote divergentes | só `word/document.xml` | só `word/document.xml` |
| Ocorrências da nota no XML | 1 | 1 |
| `word/document.xml` — ancorado | `30b67025…` | `4e82a751…` |
| `word/document.xml` — com o `*` | `84c4aadc…` | `b334b4cd…` |
| Retirar o `*` reproduz o ancorado | sim, byte a byte | sim, byte a byte |

Junto com elas, a `T-1408` de `test_capa.py` (`f549ca4c…`, que passaria a `797165ea…`): dos
16.029 `<w:t>` do corpo do piloto, **um só** mudou, e as duas contagens — textos e códigos — não
se moveram.

**Por que os valores novos não entraram.** Entre a medição e a troca, a ESPEC 028 `R-ZER-01`
começou a ser implementada na mesma árvore — ela omite as linhas sem quantidade contratada nem
medida, e move o documento outra vez. O `word/document.xml` do PGM, medido `b334b4cd…` às 16h20,
já era `954b57f3…` vinte minutos depois.

Uma âncora medida contra uma implementação em andamento não ancora nada: grava o estado de meia
hora daquela tarde. As constantes ficaram nos valores anteriores às duas mudanças, vermelhas e
comentadas, e a reancoragem única cabe a quem fechar a ESPEC 028 — com metade do trabalho já
feito, porque o delta do `*` está provado aqui e o que sobra provar é o da omissão.

**A regra que este caso acrescenta ao docstring das âncoras:** reancorar exige não só o delta
provado, mas **uma árvore parada**. Duas mudanças de documento em voo não se distinguem num
`sha256` — ele diz que algo mudou, nunca o quê.

Método idêntico ao do TASKS 024 §6.2, que já reancorara a `T-1408` na implementação original:
provar o delta desfazendo apenas a mudança prevista, em vez de colar a saída do código no teste.
A diferença é que desta vez a prova é mais barata e mais estreita — a correção acrescenta um
caractere a um parágrafo que já existia, não um parágrafo novo.

**A lição, que é sobre o texto da âncora e não sobre a âncora.** *"Os artefatos não mudam um
byte"* é verdade dentro do escopo de uma entrega e falso como invariante do repositório — o
documento vai mudar sempre que uma espec de conteúdo pedir. O que o teste protege não é a
imutabilidade do `.docx`; é que nenhuma mudança nele chegue **sem alguém ter pedido**. As três
reprovações desta correção são o teste funcionando, não atrapalhando.

---

## 10. O que este backlog não faz

* **Leitura dos anexos em `read_only`** — 2 a 6 s medidos (ESPEC §2.6, `I-31`). Exige um leitor de
  `mergeCells` e `column_dimensions` direto do pacote, e mexe em fidelidade de anexo.
* **Cache do `Contract` por *hash* do PDF** (`I-32`) — atravessa a ESPEC 001 §7.2.
* **`GZipMiddleware`** — ganho de rede, não de CPU.
* **Remover o `CapacityLimiter(1)`** (`D-09`) — a razão da ESPEC 012 `D-02` não mudou.
* **Consolidar as três fixtures de DOCX do PGM** (`I-34`) — duas são sem aditivo.
* **Mexer no cache de `docx_do_piloto`** (`I-33`).
* **Qualquer mudança de comportamento.** Se o documento mudar, o backlog falhou.
