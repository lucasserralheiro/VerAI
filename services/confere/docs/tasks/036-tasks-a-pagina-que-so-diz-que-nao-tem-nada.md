# TASKS 036 — Backlog de "A página que só diz que não tem nada"

| | |
|---|---|
| **Especificação** | [ESPEC 036](../specs/036-a-pagina-que-so-diz-que-nao-tem-nada.md) v1.0 |
| **Plano** | [PLANO 036](../plans/036-plano-a-pagina-que-so-diz-que-nao-tem-nada.md) v1.0 |
| **Versão** | 1.0 — 2026-08-31 |
| **Total** | 32 tarefas · 5 portões · 6 insumos em aberto. **32 executadas** |
| **Status** | **Implementada** — 2026-08-31. Os cinco portões fechados. Backend **1.517 → 1.527 passed** (10 testes novos; a `T-317` foi **substituída**, não removida). `ruff` e `mypy` limpos. **Um único artefato reancorado** — `PACOTE_DO_PGM`, `word/document.xml`, com o delta provado por desligamento; o piloto não se moveu. `V-ANX-01` entrou com `D-04` como escrito: ausência parcial não avisa (`I-01` continua reversível em uma condição e um teste) |

> **Escrito antes da implementação.** A §10 é a única seção que não pode ser escrita agora, e é a
> que a próxima entrega vai ler.

> **A `E3` não vai para `main` sem a `E4`.** Hoje as páginas vazias são feias e são **sinal**: são
> o único aviso de que a planilha pode ter vindo com o layout trocado. A `E3` apaga o sinal; a `E4`
> o devolve onde ele é acionável. Entregar só a `E3` deixa o produto pior do que está — e é a única
> forma de esta espec sair pior que o defeito.

---

## 1. Convenções

**Identificadores** `T-22nn`/`T-23nn`, continuando de `T-2282`, a última da ESPEC 035.

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`python -m pytest` verde — **com o `-m`**, e **sem `--timeout`**, que este projeto não tem
instalado.

**Convenção de commit** `<tipo>(T-2nnn): descrição`. A omissão da página e o critério de vazio são
`fix(...)`; `V-ANX-01` é `feat(...)`; teste e régua são `test(...)`; `README`, spec e CHANGELOG são
`docs(...)`. **Nunca dois tipos no mesmo commit.**

### 1.1 Cinco regras que atravessam este backlog

**1 — A linha de base não é o `HEAD`.** A árvore carrega a ESPEC 035 **entregue e não commitada**:
seis arquivos modificados, um teste novo e três documentos. A sobreposição de arquivo com esta
entrega é zero; a de **âncora** é total — os quatro pacotes byte a byte são exatamente o que a 035
declara não ter movido. Declaração não é medição.

*O sinal no diff:* um valor "de antes" **copiado das constantes** de
`test_identidade_dos_artefatos.py` em vez de medido nesta árvore pela `T-2283`.

**2 — O `PACOTE_DO_PILOTO` não se move, e não é reancorado.** O piloto tem **zero** anexos vazios:
nenhuma das duas mudanças pode alcançá-lo. Ele é o único oráculo do falso positivo — 19 anexos
reais, 15.955 células escritas —, e nenhuma validação pega um anexo legítimo omitido em silêncio.

*O sinal no diff:* qualquer linha alterada dentro de `PACOTE_DO_PILOTO`, `ANALISE_DO_PILOTO` ou
`ANALISE_DO_PGM`.

**3 — O risco não é sobrar página; é sumir conteúdo.** Página a mais é o defeito que se está
corrigindo, e ele é visível. Um anexo com conteúdo classificado como vazio some sem ruído nenhum, no
meio de dezesseis anexos corretos, num documento de 40 páginas que ninguém relê inteiro.

*O sinal no diff:* um critério de vazio que consulte `celula.borda` — a ESPEC 014 `R-BRD-02` já
mediu que borda **não** é conteúdo, e usá-la manteria vivos anexos vazios; ou uma contagem de
tabelas do PGM diferente de **34**.

**4 — `anexo_reader.py` não é tocado.** A leitura devolve os 19 anexos configurados, com ou sem
conteúdo (`R-VAZ-04`, `D-03`). Filtrar lá parece mais limpo e apaga o fato de que `V-ANX-01`
depende — e o teste que distingue *"nenhuma aba veio"* de *"18 vieram vazias"* deixa de ser
escrevível.

*O sinal no diff:* qualquer linha alterada em `infrastructure/annex/anexo_reader.py`, ou uma
compreensão de lista com `if not anexo.vazio` dentro do leitor ou do caso de uso.

**5 — A omissão sem o achado não é entrega.** `E3` e `E4` vão juntas para `main`.

*O sinal no diff:* um commit de `E3` sem `annex_validations.py` na mesma entrega.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase | Depende de decisão? |
|---|---|---|---|---|
| **E0** Linha de base, régua e inventário | T-2283 … T-2287 | **P0** | F0 | não |
| **E1** Os testes, escritos antes | T-2288 … T-2294 | **P0** | F1 | não |
| **E2** O critério, documentariamente inerte | T-2295 … T-2298 | **P1** | F2 | não |
| **E3** A omissão | T-2299 … T-2304 | **P2** | F3 | não |
| **E4** O achado | T-2305 … T-2309 | **P3** | F4 | **`I-01`** |
| **E5** O conjunto | T-2310 … T-2314 | **P4** | F5 | não |

### 2.1 A régua da entrega — o que pode mudar de comportamento

| Muda | Não muda |
|---|---|
| Documento do PGM: **21 → 18 seções** | Documento do PGM: **34 tabelas**, com as mesmas larguras e o mesmo conteúdo |
| Documento do PGM: **3 → 0** parágrafos com *"A planilha não trouxe conteúdo para este anexo."* | `PACOTE_DO_PILOTO` — entrada por entrada (regra 2) |
| `PACOTE_DO_PGM` → `word/document.xml`, e o que mais a `T-2302` medir | `ANALISE_DO_PILOTO` e `ANALISE_DO_PGM` — byte a byte |
| `Anexo.vazio`: de `not self.linhas` para conteúdo + figuras | `_tem_conteudo`, e o resto de `annex.py` |
| `DocxRenderer._anexos`: teste antes da seção; `_anexo_vazio` removido | `_secao_do_anexo`, `_tabelas_do_anexo`, `_faixa_de_tabelas`, `_figura_do_anexo`, `_larguras_do_anexo` |
| `annex_validations.py` — arquivo novo, `V-ANX-01`, `AVISA` | `anexo_reader.py`, `anexos.json`, `medidas_grc.json` (regra 4) |
| `README.md` §"Limitações conhecidas"; ESPEC 004 §9; `CHANGELOG.md`; `Status` da ESPEC 036 | Os achados dos dois pares versionados — lista por lista |
| | `frontend/` e `api/schemas.py`; o teste-âncora; a tabela de comprovação; a capa |

---

## 3. Épico E0 — Linha de base, régua e inventário `[portão P0]`

> **Nenhum arquivo de `src/` é tocado neste épico.**

#### T-2283 — Reproduzir os quatro pacotes nesta árvore `[portão, risco]`
**Tamanho:** PP · **Ref:** PLANO §7, **P1**, **P2**, regra 1

`python -m pytest tests/test_identidade_dos_artefatos.py -q`, e registrar o resultado. Os quatro
alvos: `PACOTE_DO_PILOTO`, `PACOTE_DO_PGM`, `ANALISE_DO_PILOTO`, `ANALISE_DO_PGM`.

**É a tarefa mais importante deste épico, e a razão está no PLANO §7.** A ESPEC 035 está aberta na
árvore e declara *"não-regressão integral… nenhum artefato reancorado"*. A declaração é
provavelmente verdadeira e **não serve como linha de base**: linha de base é medição na árvore em
que se vai trabalhar. Foi o defeito que o PLANO 034 §7 registrou, e o único jeito de não repeti-lo é
rodar.

**Reprovando, esta entrega para aqui.** Não se corrige a ESPEC 035 dentro do PLANO 036: registra-se
o achado, resolve-se lá, e a `E0` recomeça.

**Pronto quando:** os quatro testes verdes nesta árvore, com o comando e a data neste documento.

---

#### T-2284 — Linha de base da suíte
**Tamanho:** PP · **Ref:** **P4**

`python -m pytest -q` completo. **Coletados hoje: 1.517** (medido em 2026-08-31, nesta árvore).
Registrar o `passed` e a lista de falhas, se houver.

**Rodar sozinha.** A lição da `T-2249` da ESPEC 035: `test_desempenho.py::
test_o_custo_de_um_anexo_e_linear` é razão de tempo, e reprova por vizinho barulhento. Nada de
medição em paralelo — e esta entrega **tem** medições paralelas tentadoras, todas de renderização de
PGM.

**A suíte de navegador não entra na linha de base**, e o PLANO §3 `F5` explica: nenhum arquivo de
`frontend/` ou `api/` é tocado, o contrato `Achado` é genérico, e `V-ANX-01` não dispara em cenário
versionado nenhum. **A `T-2287` confirma as três coisas** — se qualquer uma cair, a linha de base do
navegador entra e esta decisão sai.

**Pronto quando:** o número e a lista estão neste documento.

---

#### T-2285 — Congelar a sonda de anexos `[portão]`
**Tamanho:** PP · **Ref:** **P1**

`AnexoReader().ler(...)` nas duas planilhas, imprimindo por aba: nº de linhas, nº de células com
texto ou preenchimento, nº de imagens e o veredito de `vazio`. **~3 s, sem renderizar nada.**

O esperado, medido em 2026-08-31:

| planilha | anexos | `vazio == True` |
|---|---|---|
| `levantamento.xlsx` | 19 | **nenhum** |
| `levantamento_pgm.xlsx` | 19 | `Colocation`, `Comunicação Dados`, `CertificadosDigitais` |

**Nenhuma aba com linhas e zero células úteis, e nenhuma aba só com figura** — nas duas planilhas.
É o que diz que os dois casos do §2.4 da espec são casos construídos, não casos do corpus, e é por
isso que a `E2` não pode mover documento nenhum.

**Pronto quando:** a tabela bate, aba por aba, nesta árvore. É o "antes" da `T-2297`.

---

#### T-2286 — Congelar a forma do documento do PGM `[portão]`
**Tamanho:** PP · **Ref:** **P2**

Três números, medidos sobre `documento_do_pgm` (ou sobre uma renderização só dos anexos do PGM, que
custa ~22 s e dá os mesmos três):

| medida | hoje |
|---|---|
| seções | **21** — capa, corpo e 19 anexos |
| parágrafos com *"não trouxe conteúdo"* | **3** |
| tabelas | **34** |

**A de tabelas é a que importa** (regra 3). As três seções vazias não produzem tabela nenhuma hoje,
então o número **não pode mudar** — nem para menos, que seria conteúdo perdido, nem para mais.

**Pronto quando:** os três números reproduzidos nesta árvore, e não copiados desta tabela.

---

#### T-2287 — As nove buscas `[risco]`
**Tamanho:** PP · **Ref:** PLANO §8

Sete sobre `backend/`: `vazio|_anexo_vazio|não trouxe conteúdo`; `SECOES_ANTES_DOS_ANEXOS|
TABELAS_ANTES_DOS_ANEXOS|2 \+ 19`; `PACOTE_DO_|ANALISE_DO_|partes\(`; `documento_do_pgm|
artefatos_do_pgm|docx_do_piloto`; `Anexo\(`; `PERGUNTA|Severity\.`; `anexos` em `application/` e
`api/`.

Duas sobre `frontend/`: `Achado|severidade|AVISA`; `anexo|não trouxe`.

**A busca 9 é a que engana.** `frontend/src/app/components/LinhasDerivadas.tsx:104` tem a frase *"a
planilha não trouxe um número na coluna…"* — **outra espec** (021), outro assunto, redação quase
igual à que esta entrega apaga. Uma substituição por texto no repositório inteiro a alcançaria, e o
vermelho apareceria na suíte de navegador, que este plano decidiu não rodar. **Abrir o arquivo
decide; a busca não.**

**A busca 2 é hipótese verificada por leitura, e precisa de execução:** `test_docx_anexos.py:143` e
`test_api_e2e.py:105` contam 19 seções de anexo, e **os dois usam o piloto**, que não tem anexo
vazio. Se algum contar sobre o PGM, ele é da `E3` e não da regressão.

**Pronto quando:** o inventário está fechado por escrito, com arquivo, linha e o que cada âncora
afirma, e a tabela da ESPEC §8.3 reflete o achado.

> **Executada — 2026-08-31.**
>
> **Busca 1** — três lugares, como previsto: `docx_renderer.py:405-406,433,448`;
> `test_docx_anexos.py:309`; `README.md:325`. Nenhuma outra ocorrência em
> `backend/`.
>
> **Busca 2** — `test_api_e2e.py:105` (`2 + 19`) e `test_docx_anexos.py:143`
> (`SECOES_ANTES_DOS_ANEXOS + 19`). **Os dois sobre o piloto**, confirmado
> abrindo: o primeiro lê `resposta_do_piloto`, o segundo a fixture `documento`,
> que vem de `caminho_levantamento`. Nenhuma contagem de seção sobre o PGM —
> logo, nenhuma âncora de regressão nesta entrega.
>
> **Busca 5 — o achado desta busca, e ele não estava previsto.**
> `test_aba_reader.py:118-127` já constrói `Anexo(linhas=((),) * 20)`, que é
> **exatamente a forma do caso do §2.4a da espec**. Ele é imune: os três testes
> que o usam afirmam só `.corte`, que não consulta `vazio`. `test_figuras.py`
> monta anexos com conteúdo e figura e afirma `blocos()` — também imune.
> `test_desempenho.py:100-113` monta anexo com conteúdo e chama
> `_tabelas_do_anexo` direto, sem passar por `_anexos`.
>
> **Busca 7 — `Report.anexos` tem um único consumidor em `src/`:**
> `docx_renderer.py:403`. A ESPEC §2.6 confirmada por varredura, não por leitura.
>
> **Busca 6** — a guarda da `T-2094` (`test_identidade_contratual.py:408-412`)
> lista três módulos por nome. `annex_validations.py` não entra (`T-2309`).
>
> **Buscas 8 e 9** — `types.ts:3-7` tipa `Achado` genericamente
> (`validacao: string`), então a validação nova não pede mudança de tela. E a
> armadilha prevista **existe**: `LinhasDerivadas.tsx:104` traz *"a planilha não
> trouxe um número na coluna…"*, da ESPEC 021, sobre a célula de medida sem
> número. **Não é para tocar.**

---

## 4. Épico E1 — Os testes, escritos antes `[portão P0]`

> **Nenhum arquivo de `src/` é tocado neste épico.** Todos os testes deste épico reprovam ao fim
> dele, e a `T-2294` declara **como** cada um reprova.

#### T-2288 — `R-VAZ-01`/`R-VAZ-03`: o anexo vazio não produz página
**Tamanho:** PP · **Ref:** `R-VAZ-01`, `R-VAZ-03`, `D-07`

Substitui o `test_anexo_sem_linhas_sai_com_titulo_e_observacao`
([test_docx_anexos.py:299](../../backend/tests/test_docx_anexos.py#L299)). Mesmo relatório, três
asserções novas:

```python
documento = docx.Document(str(destino))
assert len(documento.sections) == SECOES_ANTES_DOS_ANEXOS        # nenhuma seção nova
assert "AbaSemNada" not in [p.text for p in documento.paragraphs]
assert len(documento.tables) == TABELAS_ANTES_DOS_ANEXOS         # como antes
```

**A terceira asserção é a que sobrevive da `T-317`**, e é ela que continua afirmando o que aquela
tarefa queria: a geração **não quebra** com anexo vazio. O que muda é o meio — a página deixa de ser
a prova (`D-07`, ESPEC §11).

**Pronto quando:** o teste existe e reprova por `len(documento.sections)` — **2 esperado, 3 obtido**.

---

#### T-2289 — `R-VAZ-02` a: a aba com resquício de formatação
**Tamanho:** PP · **Ref:** `R-VAZ-02`

Caso construído, sem planilha: `Anexo(aba="SoResiduo", linhas=((), (), ()))`. Hoje ele **não** é
`vazio` — `_colunas_uteis` devolveu zero e as linhas sobreviveram —, e sai como **tabela invisível
de 3 fileiras × 1 coluna** numa página só dele.

Medido em 2026-08-31, contra o renderizador:

```
vazio? False · total_colunas 0 · 1 seção nova · 1 tabela 3 × 1, sem borda e sem texto
```

**É página em branco, sem sequer a frase** — o mesmo defeito por outro caminho, e o que justifica o
critério novo ser por conteúdo e não por linhas.

**Pronto quando:** o teste existe e reprova por seção e tabela a mais.

---

#### T-2290 — `R-VAZ-02` b: a aba só com figura
**Tamanho:** PP · **Ref:** `R-VAZ-02`

`Anexo(aba="SoFigura", linhas=(), imagens=(png,))`, com um PNG mínimo embutido no teste. Ele **tem**
conteúdo pela regra nova, e tem de sair — com a figura.

Hoje `vazio` devolve `True` e curto-circuita antes de `blocos()`, que **sabe** emitir a figura:

```
vazio? True · blocos() = [(0, 0, ImagemAnexo(...))]
```

**Reprova hoje por dois motivos ao mesmo tempo, e é bom que reprove:** falta a figura **e** sobra a
frase. Depois da `E2`, por nenhum. **Se passar já na `E1`, o caso construído está errado** —
provavelmente com alguma célula não-vazia sobrando.

**Pronto quando:** o teste existe e reprova pela ausência da imagem no pacote.

---

#### T-2291 — `R-VAZ-02` c: borda não é conteúdo
**Tamanho:** PP · **Ref:** `R-VAZ-02`, ESPEC 014 `R-BRD-02`

`Anexo` cujas células têm `borda=True` e nada mais é **vazio**, e é omitido.

**É a regra 3 do §1.1 virada em teste.** Usar `borda` como sinal de conteúdo manteria vivos
justamente os anexos que esta entrega existe para omitir — e contradiria a medição da ESPEC 014, que
achou borda em coluna que o Excel não imprime.

**Pronto quando:** o teste existe e reprova por seção a mais.

---

#### T-2292 — `V-ANX-01`: dispara com 19, cala com 18
**Tamanho:** PP · **Ref:** `V-ANX-01`, `D-04`

Dois casos, sobre `ValidationReport`:

- 19 anexos vazios → **um** achado, `validacao == "V-ANX-01"`, `severidade == AVISA`;
- 18 vazios e 1 com conteúdo → **nenhum** achado.

**O segundo é o que impede a regra de virar aviso de ausência parcial.** É `D-04` com nome e linha:
3 de 19 no PGM é escopo contratado, não anomalia.

**Reprova por `ImportError`, e isso é declarado aqui** — o módulo `annex_validations.py` só existe
na `E4`. É vermelho certo, no precedente da `T-2253` da ESPEC 035.

**Pronto quando:** o teste existe e reprova por `ImportError`, não por asserção.

---

#### T-2293 — `R-VAZ-05`/`R-VAZ-06` sobre o documento do PGM
**Tamanho:** P · **Ref:** `R-VAZ-05`, `R-VAZ-06`, **P2**

Sobre a fixture de sessão `documento_do_pgm`: **18 seções**, **0** parágrafos com a frase, **34
tabelas**, e os 16 anexos com conteúdo na ordem de `anexos.json`.

**Não renderiza nada.** `documento_do_pgm` é fixture de sessão do `conftest`, criada pela `T-2001`
exatamente para não haver uma quarta renderização de PGM na suíte — são ~115 s, o par mais caro. Um
teste que gere o PGM de novo cobraria isso todo dia, para sempre.

**A asserção de 34 tabelas é a regra 3.** Seção é página; tabela é conteúdo. Uma tabela a menos é
anexo perdido, e é a única falha desta entrega que ninguém veria olhando o documento por cima.

**Pronto quando:** o teste existe e reprova por `21 != 18`.

---

#### T-2294 — Conferir **como** cada teste reprova `[portão]`
**Tamanho:** PP · **Ref:** **P0**

Rodar `T-2288` a `T-2293` contra esta árvore e registrar o motivo de cada vermelho:

| tarefa | reprova por |
|---|---|
| T-2288 | valor — 3 seções, 2 esperadas |
| T-2289 | valor — seção e tabela a mais |
| T-2290 | valor — imagem ausente do pacote |
| T-2291 | valor — seção a mais |
| T-2292 | **`ImportError`** — o módulo não existe ainda |
| T-2293 | valor — 21 seções, 18 esperadas |

**Teste que passa aqui é teste que não afirma nada.** É o defeito que o `P0` da ESPEC 034 pegou: um
caso construído com texto que a regra não casava, verde por acidente e sem discriminar. Um vermelho
por `ImportError` onde se esperava valor esconde exatamente isso.

**Pronto quando:** a tabela acima está conferida linha por linha neste documento.

---

## 5. Épico E2 — O critério, documentariamente inerte `[portão P1]`

#### T-2295 — `Anexo.vazio` passa a perguntar por conteúdo
**Tamanho:** PP · **Ref:** `R-VAZ-02`, `D-02`

```python
@property
def vazio(self) -> bool:
    if self.imagens:
        return False
    return not any(_tem_conteudo(c) for linha in self.linhas for c in linha)
```

**`_tem_conteudo` é reusada, não reescrita** (`D-02`). Ela é da ESPEC 014, já decide largura de bloco
e grade, e um segundo critério de "vazio" ao lado do primeiro é a espécie de divergência que ninguém
percebe até os dois discordarem.

**A figura vem antes da varredura de propósito:** é a saída barata, e é o caso do §2.4b — anexo com
figura e nenhuma célula **tem** conteúdo.

**Pronto quando:** `T-2289`, `T-2290` e `T-2291` verdes; `T-2288` e `T-2293` **ainda vermelhos**.

---

#### T-2296 — Os quatro pacotes idênticos `[portão]`
**Tamanho:** PP · **Ref:** **P1**, regra 2

`python -m pytest tests/test_identidade_dos_artefatos.py -q` → **quatro verdes**, sem tocar
constante nenhuma.

**A `E2` sozinha não pode mudar documento, e isso é asserção.** Os vereditos dos dois pares são
conhecidos pela `T-2285`: piloto 19 × `False`, PGM 16 × `False` e 3 × `True`. Critério novo com os
mesmos vereditos ⇒ mesmos documentos. **Movido qualquer pacote aqui, o critério classificou errado
alguma coisa — e não há segundo lugar onde procurar.**

**Reprovando:** reverter a `T-2295` e voltar ao caso construído. Não reancorar, não "conferir se o
documento continua bonito".

**Pronto quando:** os quatro verdes, com o `git diff` mostrando **um** arquivo de `src/` alterado.

---

#### T-2297 — A sonda reproduzida `[portão]`
**Tamanho:** PP · **Ref:** **P1**

A `T-2285` de novo, com o critério novo: **0/19** no piloto e **3/19** no PGM, as mesmas três abas
nomeadas.

**É a `T-2296` vista do outro lado, e custa 3 s.** O pacote diz *"o documento não mudou"*; a sonda
diz *"o veredito não mudou"*. As duas juntas separam "não mudou" de "mudou duas vezes e voltou" — que
é improvável e é exatamente o tipo de coisa que se descobre tarde.

**Pronto quando:** a tabela da `T-2285` reproduzida, aba por aba.

---

#### T-2298 — O teste do teste `[portão]`
**Tamanho:** PP · **Ref:** **P1**

Conferir que `T-2288` e `T-2293` **continuam vermelhos** ao fim da `E2`.

**Um `T-2288` verde aqui significa que alguém entregou a `E3` junto**, e o portão `P1` perdeu o
sentido: um documento que se mova deixa de ter dono. As duas mudanças têm riscos opostos — o critério
erra em silêncio, a omissão é mecânica — e é por isso que são dois épicos.

**Pronto quando:** os dois vermelhos, pelo mesmo motivo da `T-2294`.

---

## 6. Épico E3 — A omissão `[portão P2]`

#### T-2299 — O anexo vazio deixa de virar seção
**Tamanho:** PP · **Ref:** `R-VAZ-01`, `R-VAZ-03`, `D-01`

Em `_anexos` ([docx_renderer.py:397](../../backend/src/infrastructure/report/docx_renderer.py#L397)):

```python
for anexo in relatorio.anexos:
    # Anexo sem conteúdo não vira página: nem seção, nem título, nem nota.
    if anexo.vazio:
        continue
    secao = self._secao_do_anexo(documento, anexo)
    self._tabelas_do_anexo(documento, anexo, secao)
```

e **`_anexo_vazio` sai inteiro** — método, título e frase
([docx_renderer.py:433-450](../../backend/src/infrastructure/report/docx_renderer.py#L433-L450)).

**A ordem é a correção, não um detalhe de estilo** (`D-01`). Hoje `_secao_do_anexo` é chamada antes
do teste: apagar só o corpo de `_anexo_vazio` deixaria a quebra de seção de pé e trocaria a página
que explica por uma **página em branco com timbrado**.

**Pronto quando:** `T-2288`, `T-2289`, `T-2291` e `T-2293` verdes.

---

#### T-2300 — A forma do documento do PGM `[portão]`
**Tamanho:** PP · **Ref:** **P2**, `R-VAZ-05`

Os três números da `T-2286`, agora: **18 seções**, **0** frases, **34 tabelas**.

**A de tabelas é o portão** (regra 3). 18 e 0 são o que se pediu; **34** é o que prova que não se
levou conteúdo junto.

**Pronto quando:** os três batem, medidos e não deduzidos.

---

#### T-2301 — O piloto, entrada por entrada `[portão]`
**Tamanho:** PP · **Ref:** **P2**, regra 2, `D-06`

`PACOTE_DO_PILOTO` **idêntico** à `T-2283`. Sem exceção, sem reancoragem, sem "só o `document.xml`".

**É o único oráculo do falso positivo desta entrega.** `V-ANX-01` pega a planilha inteira trocada;
nada pega **um** anexo legítimo classificado como vazio — a não ser este hash, que cobre 19 anexos
reais e 15.955 células escritas.

**Pronto quando:** verde, e o `git diff` da constante **vazio**.

---

#### T-2302 — A prova por desligamento `[portão, risco]`
**Tamanho:** P · **Ref:** **P2**, PLANO §7

Quatro passos, nesta ordem:

1. com a `E3` entregue, medir `PACOTE_DO_PGM` → **valor novo**, guardado;
2. desfazer **só** o `continue` da `T-2299` e **só** a `T-2295`, sem tocar testes → medir de novo;
3. o pacote tem de voltar **entrada por entrada** ao valor da `T-2283`;
4. refazer as duas, conferir que o valor do passo 1 volta, e **só então** escrever a constante.

**Reancorar porque o teste ficou vermelho é admitir a mudança sem saber o tamanho dela.** Desligar
as duas linhas e ver o hash **voltar** é o que transforma *"mudou"* em *"mudou exatamente isto"*. É
o procedimento que a ESPEC 028 usou para trocar dois hashes, descrito no cabeçalho do próprio
arquivo de teste.

**Custo:** duas renderizações de PGM a mais, ~4 min. **`docProps/app.xml` é candidato a se mover
junto** — a ESPEC §8.3 diz *"a medir, não a prever"*. Qualquer outra entrada que se mova **reprova o
portão** até haver explicação escrita.

**Pronto quando:** os quatro passos estão registrados neste documento, com o valor de ida e o de
volta.

---

#### T-2303 — Reancorar o `PACOTE_DO_PGM`, no rito
**Tamanho:** PP · **Ref:** **P2**

Trocar o hash e **escrever a justificativa no cabeçalho** de `test_identidade_dos_artefatos.py`, no
formato que ele mesmo impõe: o que mudou, por qual espec, qual era o valor anterior, e que as demais
entradas não se moveram.

**O cabeçalho daquele arquivo é explícito:** *"Se um destes testes ficar vermelho, a resposta padrão
**não** é reancorar."* Esta é a exceção prevista — mudança deliberada de documento decidida em espec
—, e ela só é exceção **com a prova da `T-2302` junto**.

**Pronto quando:** a constante trocada, o comentário escrito, e o teste verde.

---

#### T-2304 — A frase não sobrevive em canto nenhum
**Tamanho:** PP · **Ref:** `D-07`

Remover o `test_anexo_sem_linhas_sai_com_titulo_e_observacao` e varrer a suíte inteira por
`"não trouxe conteúdo"`.

**Varrer, e não confiar no teste conhecido.** A `T-2287` já mapeou três ocorrências — o renderizador,
o teste e o README —, e a busca aqui é a que confirma que o inventário estava certo.

**Não tocar `LinhasDerivadas.tsx:104`** (busca 9 da `T-2287`): a frase de lá é da ESPEC 021, sobre a
célula de medida sem número, e a semelhança é armadilha.

**Pronto quando:** a busca não acha nada em `backend/`, e o frontend está intocado.

---

## 7. Épico E4 — O achado `[portão P3]` · depende de `I-01`

#### T-2305 — `v_anx_01_nenhuma_aba_de_anexo_reconhecida`
**Tamanho:** PP · **Ref:** `V-ANX-01`, `D-05`

Arquivo novo `infrastructure/validations/annex_validations.py`, com uma função e o achado em quatro
partes (`R-DOC-05`):

```python
def v_anx_01_nenhuma_aba_de_anexo_reconhecida(
    anexos: list[Anexo], achados: ValidationReport
) -> None:
    if not anexos or any(not anexo.vazio for anexo in anexos):
        return
    achados.registrar_em_partes("V-ANX-01", Severity.AVISA, titulo=..., causa=..., acao=..., detalhe=...)
```

- **título:** *"Nenhuma aba de detalhamento foi reconhecida na planilha."*
- **causa:** *"As 19 abas de anexo esperadas não foram encontradas, ou vieram sem conteúdo. A tabela de comprovação foi lida normalmente."*
- **ação:** *"Confira se a planilha é a do levantamento completo. O documento sai sem os anexos de detalhamento."*
- **detalhe:** a lista das abas configuradas, para o suporte.

**`not anexos` é guarda, não zelo:** sem anexos lidos não há o que afirmar — é o caso do relatório
bloqueado, em que o contêiner nem chega a ler ([container.py:317](../../backend/src/infrastructure/di/container.py#L317)).
Sem ela, a validação chamada fora do fluxo acusaria ausência onde não houve leitura, que é
exatamente o que `R-GRD-06` proíbe.

**`AVISA`, e a decisão é `D-05`.** Quando isto dispara, `V-MED-01` passou e a identidade foi
conferida: o que fatura está inteiro, e o que falta é detalhamento.

**Pronto quando:** o módulo existe e `T-2292` fica verde.

---

#### T-2306 — Registro no contêiner
**Tamanho:** PP · **Ref:** `V-ANX-01`

Em `DIContainer.gerar`, **logo após** a leitura dos anexos:

```python
anexos = [] if achados.bloqueado else self.leitor_de_anexos().ler(entradas.levantamento)
v_anx_01_nenhuma_aba_de_anexo_reconhecida(anexos, achados)
```

**Depois do teste de `bloqueado`, e isso não altera bloqueio nenhum:** `AVISA` não entra em
`ValidationReport.bloqueado`, e a lista já foi consultada acima. Bloqueado, `anexos` é `[]` e a
guarda da `T-2305` cala.

**Pronto quando:** o registro está no lugar e a `T-2308` fica verde.

---

#### T-2307 — Um achado, não dezenove `[portão]`
**Tamanho:** PP · **Ref:** **P3**, `D-04`

`T-2292` verde nos dois casos: **um** achado com 19 vazios, **nenhum** com 18.

**É `R-GRD-06` na forma que esta entrega precisa dela:** relatar a causa — *a planilha nomeia as abas
de outro jeito* — e não a consequência repetida dezenove vezes. Foi o defeito dos 57 achados do
`PA-PGM`, e ele nasceu do mesmo jeito.

**Pronto quando:** verde, com o número de achados afirmado por extenso.

---

#### T-2308 — Os achados dos dois pares, inalterados `[portão]`
**Tamanho:** PP · **Ref:** **P3**

Gerar os dois pares versionados e comparar a lista de achados, **item por item**, com a de antes.
`V-ANX-01` não pode aparecer em nenhum dos dois: o PGM tem 16 anexos com conteúdo.

**Achado novo em par versionado é ruído entregue em produção.** É o teste onde `D-04` dói — se a
decisão de `I-01` for avisar na ausência parcial, este portão muda de forma, e é a hora de saber.

**Pronto quando:** as duas listas idênticas.

---

#### T-2309 — A guarda da `T-2094`, conferida e **não** alterada
**Tamanho:** PP · **Ref:** §8 do PLANO, nº 6

`test_identidade_contratual.py:388` varre **três** módulos nomeados — os anteriores à ESPEC 029 —
procurando `PERGUNTA`. O arquivo novo **não entra naquela lista**: acrescentá-lo mentiria sobre a
cronologia e não afirmaria nada útil.

O que se afirma de `annex_validations.py` é outra coisa, e já está na `T-2292`: ele registra
`AVISA`.

**Pronto quando:** a guarda está verde e o `git diff` de `test_identidade_contratual.py` está vazio.

---

## 8. Épico E5 — O conjunto `[portão P4]`

#### T-2310 — A suíte completa
**Tamanho:** PP · **Ref:** **P4**

`python -m pytest -q`, sozinha, comparada com a `T-2284`. Esperado: **1.517 + os testes novos**,
menos o `T-317` removido.

**Rodar sozinha** — `test_desempenho` mede razão de tempo, e esta entrega tem renderizações de PGM
tentadoras para rodar em paralelo (`T-2284`).

**Pronto quando:** verde, com o número declarado neste documento.

---

#### T-2311 — `ruff` e `mypy`
**Tamanho:** PP · **Ref:** **P4**

Nos arquivos tocados: `annex.py`, `docx_renderer.py`, `annex_validations.py`, `container.py` e os
testes.

**Pronto quando:** os dois limpos.

---

#### T-2312 — Nenhum outro artefato reancorado `[portão]`
**Tamanho:** PP · **Ref:** **P4**, regra 2

`git diff` sobre: `test_docx_formatacao.py`, `test_capa.py`, `pacote.py`,
`fixtures/linhas_do_documento.json`, `fixtures/valores_do_contrato.json`, e as constantes
`PACOTE_DO_PILOTO`, `ANALISE_DO_PILOTO` e `ANALISE_DO_PGM`.

**Todos vazios.** A única constante que esta entrega pode ter tocado é `PACOTE_DO_PGM`, pela
`T-2303`, com a prova da `T-2302` junto.

**Pronto quando:** o diff confere, arquivo por arquivo.

---

#### T-2313 — O `README`, sem atropelar a ESPEC 035
**Tamanho:** PP · **Ref:** PLANO §7

Em §"Limitações conhecidas", o parágrafo *"Os dezenove anexos dependem do nome da aba"* sai na parte
que deixou de valer — as dezenove seções em silêncio — e dá lugar ao comportamento novo mais a
`V-ANX-01`.

**A ESPEC 035 editou a mesma seção do mesmo arquivo, e está aberta na árvore.** Ler o que ela pôs ali
antes de escrever, e conferir com `git diff README.md` antes de commitar. É como se perde um
parágrafo alheio num `git add -A`.

**Pronto quando:** o parágrafo novo está escrito e o diff do README mostra **só** as duas edições
esperadas.

---

#### T-2314 — Spec, ESPEC 004 e CHANGELOG
**Tamanho:** PP · **Ref:** —

- `Status` da ESPEC 036: de **Proposta** para **Implementada**, com os números medidos;
- ESPEC 004 §9, linha *"Anexo com aba vazia"*: remissão à ESPEC 036 — a mitigação de lá deixou de
  ser a de hoje (ESPEC 036 §11);
- `docs/CHANGELOG.md`: entrada de mudança de rumo. O que mudou é uma **decisão de produto** revista
  com caso real, que é exatamente o que aquele arquivo registra.

**Pronto quando:** os três escritos.

---

## 9. Insumos em aberto

| ID | Questão | Bloqueia? |
|---|---|---|
| `I-01` | Avisar também na ausência **parcial**, listando as abas omitidas? `D-04` decidiu que não. Custo zero no documento; custo em ruído na tela, toda competência, para órgãos de escopo estável | **Sim, a `E4`.** As demais entregam sem a decisão |
| `I-02` | Deve haver, no documento, menção de que o órgão não tem os anexos X, Y e Z? | Não. Se vier, é linha de capa, não página de anexo |
| `I-03` | Abas presentes na planilha e ausentes de `anexos.json` — `Alta Plataforma`, `Impressao` e `ETL` no PGM — são descartadas em silêncio. O defeito simétrico | Não. Espec própria: é de catálogo, e exige medir a geometria de cada aba nova no GRC |
| `I-04` | `V-ANX-01` nunca dispara nas planilhas conhecidas. Vale mantê-la? | Não. Precedente de `V-MED-04` e `V-CTR-06` |
| `I-05` | A planilha do órgão que originou o relato — a das cinco páginas — **não está versionada**. O caso reprodutível é o do PGM, com três | Não. Mas versionar uma planilha com **muitas** abas ausentes daria a `V-ANX-01` um caso real, e hoje ela só tem caso construído |
| `I-06` | `ruff` acusa `I001` em `tests/test_divergencia_de_fonte.py` — **pré-existente**, `git status` limpo para esse arquivo. Não foi corrigido aqui: arrumar arquivo alheio no meio de uma entrega polui o diff que a revisão precisa ler | Não. Uma linha, em qualquer entrega que passe por ali |

---

## 10. Emenda de execução

**2026-08-31.** Executada em ~1h de trabalho, mais três execuções de suíte completa (21 min cada) e
seis renderizações do par do PGM.

**A régua da `T-2286` estava errada, e a prova por desligamento foi quem corrigiu.** O backlog
congelou **32 tabelas** para o documento do PGM. O número certo é **34**: a medição da análise fora
feita sobre uma renderização **só dos anexos**, sem o bloco de título nem a tabela de comprovação, e
eu a transcrevi para o backlog como se fosse do documento completo. A `T-2293` reprovou por `34 !=
32` — **e reprovou do lado certo**: fosse o inverso, o teste teria passado escondendo uma tabela a
menos. O "antes" verdadeiro veio da `T-2302`, que mede os dois estados no mesmo artefato: **34 antes,
34 depois**. Régua copiada de outra medição é régua de outro artefato.

**A `T-2298` previu um verde que não podia acontecer.** O backlog dizia *"`T-2289` a `T-2291`
verdes ao fim da `E2`"*. Só a `T-2290` ficou: os outros dois afirmam **o veredito e a página**, e a
página é da `E3`. Depois da `E2` eles passaram a reprovar em `assert len(documento.sections) == 2`,
com o `assert anexo.vazio` já verde — ou seja, o critério funcionando e a omissão ainda ausente, que
é exatamente o estado que o portão `P1` queria enxergar. O erro foi de redação do backlog, não de
desenho: quem escreve o teste decide onde ele reprova, e eu escrevi dois testes de ponta a ponta
onde o backlog previa dois de unidade.

**O `P1` pagou-se, e é a decisão que eu repetiria.** Com a `E2` aplicada e a `E3` ausente, os quatro
pacotes saíram **idênticos**. Isso não é conforto: é o que dá dono ao delta da `E3`. Entregues
juntas, o `word/document.xml` movido do PGM não teria como ser atribuído ao critério ou à omissão, e
a única saída seria desfazer as duas para descobrir — que é a `T-2302` feita tarde e sem plano.

**A prova por desligamento saiu limpa e barata.** Desligadas as duas mudanças, o pacote do PGM
voltou a `67b31124…` **entrada por entrada**, igual à constante que estava no repositório; religadas,
voltou ao valor novo. **Uma única entrada se move**, e `docProps/app.xml` — que a ESPEC §8.3 listava
como candidato e mandava *"medir, não prever"* — ficou parado. Custo: duas renderizações de PGM,
~4 min. É o que separa *"mudou"* de *"mudou exatamente isto"*.

**A `T-2292` foi conferida com o módulo removido, e valeu.** Eu havia escrito o
`annex_validations.py` durante uma espera, antes da `E4` — então na hora da `T-2294` o teste passava
em vez de reprovar por `ImportError`, e o vermelho declarado teria virado uma linha não verificada
no documento. Mover o arquivo para fora e rodar os três casos custou 0,7 s e confirmou o
`ModuleNotFoundError`. **Escrever código adiantado numa espera custa o vermelho que provaria o
teste.**

**A armadilha da carga reapareceu, e desta vez ela tem nome.** A primeira execução final saiu
`1 failed, 1526 passed`, e a falha foi `test_o_custo_de_um_anexo_e_linear` — razão de tempo, o mesmo
teste que contaminou a linha de base da ESPEC 035. Rodado sozinho, o módulo inteiro passa: **734
passed em 57 s**; a reexecução completa saiu **`1527 passed`**, verde.

**O que a ESPEC 035 não sabia e esta entrega mediu: a fonte da contenção é o servidor de
desenvolvimento.** `uvicorn api.main:app --reload --port 8000`, no ar desde as 11:49, marcava
**5.813 s** de CPU às 13:52 e **8.632 s** às 15:01 — cerca de **2/3 de um núcleo, continuamente**,
sem ninguém usando a tela. É o `--reload` varrendo a árvore, e uma entrega que passa a tarde
escrevendo arquivos dentro dela o mantém ocupado. A `T-2249` da ESPEC 035 concluiu *"rodar a suíte
sozinha"* e culpou as próprias medições em paralelo; **faltava a metade que não é nossa**. Fica a
regra para a próxima: antes da suíte de referência, conferir se há `uvicorn --reload` no ar — e, se
houver, ou pará-lo, ou registrar que o número foi medido com ele.

**Isto não muda o veredito sobre a falha, e vale dizer por quê.** `_renderizar_anexo` chama
`_tabelas_do_anexo` **direto**, sem passar pelo laço `_anexos`, e o anexo sintético que ele monta tem
conteúdo — `Anexo.vazio` nunca é consultado. Nenhuma das duas mudanças está no caminho medido, e
omitir anexo é trabalho **não feito**: esta entrega só pode baratear a renderização.

**O que a `T-2287` achou e o backlog não previa:** `test_aba_reader.py:118-127` já constrói
`Anexo(linhas=((),) * 20)` — a forma exata do caso do §2.4a — desde a ESPEC 004, para testar
`.corte`. Imune, porque aquele caminho não consulta `vazio`. A forma que a espec descreveu como
hipótese estava versionada há incrementos.

**Resultado.** Backend **1.517 → 1.527 passed**. `ruff` limpo em `src` — sobra um `I001` em
`tests/test_divergencia_de_fonte.py`, **pré-existente e intocado por esta entrega** (`I-06`) — e
`mypy` sem erros. Documento do PGM: **21 → 18 seções**, **3 → 0** frases, **34 tabelas nos dois
estados**. Piloto intacto, entrada por entrada. `anexo_reader.py`, `anexos.json` e `frontend/`
intocados. Diff: 5 arquivos, +89/−34, mais o módulo novo e o de teste novo.
