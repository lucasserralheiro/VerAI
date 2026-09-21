# TASKS 028 — Backlog de "A linha que não diz nada"

| | |
|---|---|
| **Especificação** | [ESPEC 028](../specs/028-a-linha-que-nao-diz-nada.md) v1.0 |
| **Plano** | [PLANO 028](../plans/028-plano-a-linha-que-nao-diz-nada.md) v1.0 |
| **Versão** | 1.0 — 2026-08-19 |
| **Total** | 22 tarefas · 4 portões · 0 insumos |
| **Status** | **Concluído** — 2026-08-19. Portões `P0` a `P3` fechados. Backend **1.342 passed** (1.330 do TASKS 027 mais os 12 desta entrega). **Seis** âncoras de documento reancoradas, e não quatro: duas só apareceram na suíte completa, em §9.6 — o desvio mais caro desta entrega |

> **Escrito *depois* da implementação**, como os TASKS 024 e ao contrário dos 020 a 023 e do 027.
> É desvio de método e está registrado como tal em §9.1. A §9 é a parte deste documento que não
> poderia ter sido escrita antes, e é a que tem valor.

---

## 1. Convenções

**Identificadores** `T-20nn`, continuando a numeração: a ESPEC 027 fechou em `T-2050`.

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`python -m pytest` verde (§9.1); comentário explicando o *porquê* onde a escolha não for óbvia.

**Convenção de commit** `<tipo>(T-20nn): descrição`.

### 1.1 Três regras que atravessam este backlog

**1 — O oráculo se mede na planilha, nunca no predicado.** A lista de códigos que somem do
documento entra nos testes **por extenso**. Derivá-la de `sem_quantidade_alguma` faria o teste
afirmar *"o código concorda com o código"* — o modo de falha que o PLANO 021 §1 nomeou.

O sinal no diff é uma compreensão de lista chamando o predicado dentro do arquivo de teste.

**2 — Toda âncora de invariância do documento tem de ser inventariada antes de abrir o
renderizador**, e **por o que o teste afirma, não por onde ele mora** (PLANO 024 §7). Esta entrega
**remove** linhas do corpo do `.docx` de propósito: são **seis** âncoras em cinco arquivos —
quatro achadas no inventário e duas que só a suíte completa acusou (§9.6).

A varredura que as acha todas é por três padrões, e não por nome de arquivo: `sha256`, constante de
contagem e `assert len(`. A sexta é um `assert len(...) == 58` no fim de um teste cujo nome fala de
decodificar base64.

O sinal no diff é uma constante de contagem ou de `sha256` alterada sem a cadeia dos estados ao
lado.

**3 — A omissão é do documento; o dado não encolhe.** Toda tarefa que toque `demais_itens` tem de
poder responder *"e o grid?"*. A resposta é sempre a mesma: o grid, a análise e a API continuam
com o bloco inteiro.

O sinal no diff é um `if` dentro de `GenerateMeasurementReport.executar`.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** O oráculo | T-2051 … T-2054 | **P0** | F0 |
| **E1** Os testes, escritos antes | T-2055 … T-2058 | **P0** | F1 |
| **E2** A implementação | T-2059 … T-2062 | **P1** | F2 |
| **E3** A reancoragem | T-2063 … T-2066, T-2071, T-2072 | **P2** | F3 |
| **E4** O conjunto | T-2067 … T-2070 | **P3** | F4 |

### 2.1 A régua da entrega — o que pode mudar de comportamento

| Muda | Não muda |
|---|---|
| O bloco final do `.docx` perde a linha `0 / 0` | Quais códigos entram em `demais_itens` |
| Piloto 58 → 55 linhas; PGM 58 → 51 | `Report.demais_itens`, `total_linhas`, o grid, o `.xlsx`, a API |
| As **seis** âncoras de documento (§9.3, §9.6) | O bloco ordenado pelo contrato, inclusive `0 / 0` |
| `README.md` e o comentário de `types.ts` | `layout.py` — nenhuma medida, cor ou texto |

---

## 3. Épico E0 — O oráculo `[portão P0]`

> **Nenhum arquivo de `src/` nem de `tests/` é tocado neste épico.** A saída é conhecimento
> medido, que só depois vira constante.

#### T-2051 — Listar o bloco final dos dois pares
**Tamanho:** PP · **Ref:** ESPEC §1

Gerar o `Report` do piloto e do PGM (com e sem o aditivo) e imprimir, para cada linha de
`demais_itens`: `contratada`, `medida`, `contratada_declarada` e `perfil_ou_pacote`.

**Do `Report`, e não da aba.** A aba é a fonte; a linha emitida é o que o documento desenha, e é
sobre ela que a regra fala.

**Pronto quando:** as três listas existem, com os valores por código.

---

#### T-2052 — Separar os zerados, e conferir contra a captura
**Tamanho:** PP · **Ref:** `R-ZER-01`

Piloto **3 de 4**; PGM **7 de 13** sem o aditivo, **6 de 11** com ele.

A captura de tela que originou o pedido mostra as quatro linhas do piloto, e as três zeradas são
exatamente as que ela exibe com `0` nas duas colunas. É a única conferência externa disponível, e
ela fecha.

**Pronto quando:** `ZERADOS_DO_PILOTO` e `ZERADOS_DO_PGM` estão escritos por extenso, cada código
conferido um a um.

---

#### T-2053 — Os que **parecem** zerados e não são `[risco]`
**Tamanho:** PP · **Ref:** `R-ZER-03`, ESPEC §2.3

O `14.046.00003.00` do PGM está listado no comentário do grupo D do âncora como *"zerado dos dois
lados"* — e a linha emitida é `1 / 1`: a aba traz a contratada em branco e a medida não numérica, e
a `R-REL-08` o trata como perfil (ESPEC 021).

Conferir também se algum item do bloco final tem `contratada_declarada = False`. **Nenhum tem**, nos
dois pares — o que torna a `R-ZER-03` uma regra sem caso real, e é o que a `T-2055` precisa saber.

**Pronto quando:** os dois casos estão nomeados, e o comentário enganoso do âncora está marcado
para receber a ressalva na `T-2057`.

---

#### T-2054 — `0 / 0` no bloco ordenado pelo contrato
**Tamanho:** PP · **Ref:** `R-ZER-02`

Medir quantas linhas de `relatorio.linhas` têm as duas quantidades zeradas nos dois pares.

**São zero.** A consequência é o que importa: **nenhum teste com par real acusaria** a regra
vazando para o bloco do contrato, e por isso a `R-ZER-02` precisa de cenário construído.

**Pronto quando:** a medição existe e a conclusão está registrada.

---

## 4. Épico E1 — Os testes, escritos antes `[portão P0]`

#### T-2055 — O módulo dos cenários construídos
**Tamanho:** P · **Ref:** `R-ZER-01` a `R-ZER-04`

`tests/test_linhas_zeradas.py`, com `Report` montado à mão e renderizado **sem anexos** — o custo
da geração é escrever os anexos, e nada aqui olha para eles.

Cinco asserções: tabela-verdade de `sem_quantidade_alguma` (incluindo `contratada_declarada =
False`, que a `T-2053` mostrou não ter caso real), bloco final misto, `0 / 0` no bloco do contrato,
bloco final **inteiro** zerado e o simétrico com uma linha sobrevivente.

Os dois últimos são um par: um afirma que faixa, asterisco e nota somem juntos; o outro, que voltam
juntos. Separados, o primeiro passaria com um renderizador que nunca escrevesse o bloco final.

**Pronto quando:** existe, e reprova nos casos de bloco final por linha exibida a mais.

---

#### T-2056 — O teste que reprova a simplificação `[risco]`
**Tamanho:** PP · **Ref:** `R-ZER-05`, `D-01`

Em `test_anchor_por_codigo.py`, parametrizado nos dois pares: `resultado.relatorio.demais_itens`
tem de continuar com os 4 e os 13 códigos nominais **enquanto** o `.docx` traz menos.

**É o único ponto da suíte que reprova a omissão feita no caso de uso.** Lá ela seria uma linha
mais curta e levaria os itens embora da tela e da análise junto — e nenhum outro teste notaria,
porque o documento sairia igual.

**Pronto quando:** existe e passa já (hoje nada é omitido em lugar nenhum), guardando o invariante
para depois da `T-2060`.

---

#### T-2057 — As constantes do âncora por código
**Tamanho:** PP · **Ref:** `R-ZER-01`

`BLOCO_FINAL_DO_*` seguem **inteiras** — são o conteúdo de `demais_itens`, e é isso que a `T-2056`
compara. Entram `ZERADOS_DO_*`, da `T-2052`, e `EXIBIDOS_DO_* = BLOCO_FINAL - ZERADOS`.

`LINHAS_DO_PILOTO` 58 → 55, `LINHAS_DO_PGM` 58 → 51, `BLOCO_FINAL_PILOTO` 4 → 1,
`BLOCO_FINAL_PGM` 13 → 6, com o comentário de reancoragem por cima do bloco.

Junto, a ressalva da `T-2053` ao lado de `ZERADOS_DO_PGM`: o `14.046.00003.00` **não** entra,
apesar do comentário do grupo D.

E `test_t1215_o_conjunto_e_a_aba_menos_a_familia_10050` passa a subtrair também os zerados, com o
docstring dizendo que as duas exclusões são de naturezas diferentes — a `10.050` sai da
**comparação**, esta só deixa de **desenhar a linha**.

**Pronto quando:** as constantes refletem o oráculo, não a saída do código.

---

#### T-2058 — O portão `[portão P0]`
**Tamanho:** PP · **Portão P0**

Contra o `HEAD`: os testes de bloco final reprovam por linha a mais; os de `R-ZER-02` e `R-ZER-03`
**passam já**, porque descrevem o que não muda.

**Executado fora de ordem, e por isso executado de novo** (§9.7): como os testes nasceram depois do
código, este portão foi fechado **desligando a omissão** e observando o que reprova — que é a mesma
pergunta, feita ao contrário.

| Teste | Sem a omissão | O que isso prova |
|---|---|---|
| tabela-verdade de `sem_quantidade_alguma` (5 casos) | passa | é teste da `T-2059`, que continua no lugar; desligar a `T-2060` não a alcança |
| bloco final misto | **reprova** | é a `R-ZER-01` |
| bloco final inteiro zerado | **reprova** | é a `R-ZER-04` |
| `0 / 0` no bloco do contrato | passa | `R-ZER-02` — descreve o que não muda |
| um zero só, nos dois sentidos | passa | `R-ZER-01` pela contrapositiva |
| `T-2056`, nos dois pares | **reprova**, na segunda asserção | a omissão não chegou ao documento |

**Pronto quando:** a saída da reprovação nomeia códigos exibidos a mais — e não erro de importação
ou de fixture. **Fechado:** as quatro reprovações apontam a linha da asserção certa, e as três que
passam são exatamente as que afirmam invariante.

---

## 5. Épico E2 — A implementação `[portão P1]`

#### T-2059 — `ReportLine.sem_quantidade_alguma`
**Tamanho:** PP · **Ref:** `R-ZER-01`, `R-ZER-03`, `D-02` · **Primeiro toque em `src/`**

`contratada_declarada and contratada.valor == 0 and medida.valor == 0`, ao lado de
`sem_cobertura_contratual` — a propriedade irmã, que também lê a linha para responder sobre ela.

**Compara `valor`, nunca `formatar()`**, pela razão da `R-ANA-06`: a formatação arredonda, e
`0,004` sairia como `0,00`.

O docstring registra que **quem** omite e **onde** é escolha do renderizador: aqui está o fato,
não a decisão.

**Pronto quando:** a tabela-verdade da `T-2055` fica verde, sem gerar `.docx`.

---

#### T-2060 — `_bloco_final`
**Tamanho:** PP · **Ref:** `R-ZER-01`, `D-01`

`@staticmethod` no `DocxRenderer`, devolve `demais_itens` sem as zeradas.

**No renderizador, e não no caso de uso.** O docstring diz por quê, em uma frase: `demais_itens`
continua inteiro para a tela, para a análise e para a API, que existem para conferir; quem encolhe
é a peça que vai ao órgão.

**Pronto quando:** a `T-2056` continua verde — o `Report` intacto — e o documento encolhe.

---

#### T-2061 — Uma lista, dois pontos de decisão `[portão P1]`
**Tamanho:** PP · **Ref:** `R-ZER-04`, `D-05` · **Portão P1**

`_preencher` calcula `bloco_final` **uma vez**, desenha se não vazio e o **passa** a `_rodape`, que
troca `if relatorio.demais_itens` por `if bloco_final`.

**Passar, e não recomputar.** Os dois pontos estão a quatrocentas linhas um do outro e decidem
sobre a mesma lista; recomputar é como o asterisco e a nota se separariam no dia em que a regra
mudasse. `_rodape` ganha um parâmetro — é o preço, e é barato.

**Pronto quando:** o par de testes de `R-ZER-04` fecha nos dois sentidos.

---

#### T-2062 — O delta é só o previsto `[portão P1]`
**Tamanho:** PP · **Portão P1**

`test_anchor_por_codigo` acusa 55 e 51, com os códigos ausentes iguais aos do oráculo — nem um a
mais. `test_docx_formatacao` acusa a lavanda em **55**.

A lavanda voltar ao número de antes da ESPEC 018 é **coincidência**, e o docstring do teste passa a
dizer isso: aqueles 55 eram outro conjunto de códigos, e quem afirma quais são é o âncora.

**Pronto quando:** verde, com a coincidência registrada para não ser lida como conferência.

---

## 6. Épico E3 — A reancoragem `[portão P2]`

> **Este épico não toca `src/`.** Ele existe porque a entrega herdou quatro âncoras vermelhas de
> outra mudança — o `*` da ESPEC 024 v1.1 —, e o TASKS 026 §9.10 escreveu que a troca caberia a
> quem fechasse esta espec.

#### T-2063 — Medir com o `*`, **sem** a omissão `[risco]` · **Ler o PLANO 028 §7 antes**
**Tamanho:** P · **Portão P2**

Desligar **apenas** a omissão, mantendo tudo o mais, e medir os quatro artefatos.

Tem de sair `84c4aadc…` (piloto), `b334b4cd…` (PGM), `797165ea…` / 16.029 textos / 79 códigos
(corpo do piloto) — os valores que o TASKS 026 §9.10 registrara **horas antes, por outra pessoa e
antes de esta implementação existir**.

**É este passo que autoriza a troca**, e não o hash final: ele prova que o documento se moveu pelas
duas razões previstas e por nenhuma outra.

**Pronto quando:** os cinco números batem com o registro alheio.

---

#### T-2064 — Medir com as duas
**Tamanho:** PP · **Portão P2**

Religar a omissão: `ad68ff2a…`, `954b57f3…`, `b9d29dd9…`, 16.017 textos, 76 códigos.

Conferir que **só** `word/document.xml` difere em cada pacote — nas duas medições. Entrada a mais
ou a menos significa escopo vazado para fora do corpo.

**Pronto quando:** a diferença de cada pacote é de uma entrada só.

---

#### T-2065 — A aritmética por caminho independente
**Tamanho:** PP · **Portão P2**

16.029 − 16.017 = **12** = 3 linhas × 4 células — a unidade sai vazia no bloco final, porque lá não
há contrato de onde tirá-la. E 79 − 76 = **3** códigos.

**Dois caminhos que não se apoiam um no outro.** Um `sha256` diz que mudou; estes dizem **quanto**,
e batem com o que a regra promete tirar.

**Pronto quando:** as duas contas fecham sem ajuste.

---

#### T-2066 — Trocar as quatro constantes `[portão P2]`
**Tamanho:** PP · **Portão P2**

Cada constante recebe a **cadeia dos três estados** no comentário — ancorado, com o `*`, com as
duas —, não só o valor novo.

Junto, o docstring de `test_identidade_dos_artefatos.py`, que declarava as âncoras *"vermelhas e
ainda não reancoradas"*, e o comentário de `CORPO_DO_PILOTO_*` em `test_capa.py`, que mandava não
reancorar isolado. Os dois textos deixam de valer no momento da troca, e deixá-los mandaria a
próxima pessoa refazer uma prova já feita.

`CORPO_DO_PILOTO_CODIGOS` muda de papel: era a confirmação de que **nada** somia, passa a ser a
medida do que some **de propósito**.

**Pronto quando:** as quatro verdes, e nenhum comentário do arquivo contradiz o estado novo.

---

#### T-2071 — A âncora de 58 linhas por par `[risco]` · **não prevista pelo plano**
**Tamanho:** P · **Ref:** §9.6 · **Portão P2**

`test_linhas_derivadas.py::test_t1507_o_documento_nao_se_move` compara **linha a linha** o `.docx`
dos dois pares com `tests/fixtures/linhas_do_documento.json` — 58 registros de cinco campos cada,
por par. Esta entrega o move de propósito.

**A âncora nova é a antiga menos as linhas previstas, e não a saída do renderizador.** O `.json` foi
regravado removendo dele exatamente os códigos de `ZERADOS_DO_*`, e só então comparado com o que o
código produz. Os dois bateram nos dois pares.

O `git diff` do arquivo é a prova barata: **70 deleções, zero inserções** — 10 linhas × 7 linhas de
JSON. Nenhuma descrição, unidade ou quantidade das 106 restantes se moveu.

**Preservar a formatação faz parte da tarefa.** O primeiro rascunho gravou com `indent=2` num
arquivo escrito com `indent=1`, e o diff saiu com 745 inserções e 815 deleções — a prova de 70/0
teria ficado invisível dentro do ruído.

**Pronto quando:** verde, com o diff mostrando só deleções.

---

#### T-2072 — A contagem escondida no e2e `[risco]` · **não prevista pelo plano**
**Tamanho:** PP · **Ref:** `R-ZER-05`, §9.6 · **Portão P2**

`test_api_e2e.py::test_o_documento_embutido_decodifica_para_um_docx_valido` termina com
`assert len(ler_docx_de_bytes(conteudo)) == 58`, depois de conferir assinatura de ZIP, fontes e
imagens. Passa a **55**.

**E o teste vizinho, `test_dois_arquivos_entram_e_o_relatorio_sai`, continua afirmando
`total_linhas == 58`.** Os dois juntos são a `R-ZER-05` dita por dois testes do mesmo módulo: a
resposta conta 58 enquanto o documento que ela carrega desenha 55. O comentário registra que voltar
a igualá-los significa ou a omissão vazando para o `Report`, ou sumindo do documento.

**Pronto quando:** verde, com o par de números explicado ao lado.

---

## 7. Épico E4 — O conjunto `[portão P3]`

#### T-2067 — Suíte e ferramentas `[portão P3]`
**Tamanho:** PP · **Portão P3**

Coleta **1.330 → 1.342**, reconciliada tarefa a tarefa: 10 da `T-2055` e 2 da `T-2056`, nenhum
removido. `ruff check` e `mypy src/` limpos sobre os arquivos tocados.

**Com `python -m pytest`** — ver §9.1.

**Pronto quando:** verde, com o número justificado.

---

#### T-2068 — Os textos que afirmavam *"nada é omitido"*
**Tamanho:** PP · **Ref:** `R-ZER-05`

Dois lugares dizem por extenso o que esta entrega revisa:

- `README.md` — *"Nada é omitido — nem o consumo sem cobertura contratual"*. Passa a dizer que a
  única linha que não sai é a que zera as duas quantidades, e que ela continua na tela;
- `frontend/src/lib/types.ts` — o comentário de `demais_itens`, que ganha a ressalva de que a lista
  do grid é **maior** que a do documento.

**Nenhuma linha de código do frontend muda.** É comentário, e existe para que quem ler o tipo não
conclua que a lista espelha o `.docx`.

**Pronto quando:** os dois textos concordam com a `R-ZER-05`.

---

#### T-2069 — A mudança de rumo
**Tamanho:** PP

`docs/CHANGELOG.md`: a `D-04` da ESPEC 018 ganha a sua primeira exceção — com o porquê de ela não
estar errada, apenas larga demais, e com o que o modelo GRC já fazia (ESPEC §2.4).

**Pronto quando:** a entrada permite entender a decisão sem abrir a espec.

---

#### T-2070 — Fechamento documental
**Tamanho:** PP

ESPEC e PLANO 028 marcados como implementados, com os números finais; este backlog com o status e
a §9.

**Pronto quando:** os documentos refletem o que foi feito, **incluindo o que saiu diferente**.

---

## 8. Rastreabilidade

| Regra | Tarefas |
|---|---|
| `R-ZER-01` | T-2052, T-2055, T-2057, T-2059, T-2060, T-2062 |
| `R-ZER-02` | T-2054, T-2055 |
| `R-ZER-03` | T-2053, T-2055, T-2059 |
| `R-ZER-04` | T-2055, T-2061 |
| `R-ZER-05` | T-2056, T-2060, T-2068 |
| `R-ZER-06` | — nenhuma: a regra é *não mexer no texto da nota*, e o que a guarda são os testes de `R-NOT-01`/`R-NOT-02` da ESPEC 024, que seguem sem edição |

---

## 9. O que a implementação ensinou

### 9.1 O backlog foi escrito depois — e a suíte só coleta com `-m` `[desvio]`

**Dois desvios de método, um de processo e um de ferramenta.**

O de processo é o mesmo do TASKS 024: espec, plano e backlog escritos depois da implementação. A
razão foi a mesma — a entrega é pequena e o pedido chegou como uma frase —, e a consequência
também: a §9 é a única parte que não poderia ter sido escrita antes.

O de ferramenta custou uma execução inteira. `uv run pytest`, a partir de `backend/`, **interrompe
a coleta**:

```
tests\test_divergencia_de_fonte.py:27: in <module>
    from tests.test_quantitativo_consolidado import (
E   ModuleNotFoundError: No module named 'tests'
```

Só o `python -m` põe o diretório corrente no `sys.path`, e o `pythonpath = ["src"]` do
`pyproject.toml` não cobre isso. Execuções por arquivo passam das duas formas — o que faz o defeito
aparecer **no fim**, depois de minutos de renderização de DOCX. Não é defeito desta entrega; está
aqui porque a próxima pessoa vai tropeçar nele do mesmo jeito.

### 9.2 O oráculo pagou-se numa linha, e a linha era um comentário

A `T-2053` existe porque o âncora por código lista o `14.046.00003.00` do PGM sob o comentário
*"grupo D — zerado dos dois lados, e entra assim mesmo"*. É verdade **sobre a aba** e falso **sobre
a linha emitida**: a `R-REL-08` a emite `1 / 1`.

Uma regra escrita a partir daquele comentário — e ele é o texto mais próximo do assunto em todo o
repositório — teria tirado do documento um item de perfil. O que pegou não foi teste nem revisão:
foi medir o `Report` antes de escrever o predicado.

**Lição:** comentário de teste é documentação da **fonte**, e a regra fala do **produto**. Quando os
dois discordam, quem manda é a linha emitida.

### 9.3 A regra do TASKS 026 §9.10 foi exercida na primeira oportunidade — e funcionou

Aquele registro adiou a reancoragem de propósito e escreveu que ela caberia a quem fechasse esta
espec, com a regra nova: *reancorar exige não só o delta provado, mas uma árvore parada*.

Teria sido fácil tratar isso como formalidade — as constantes estavam comentadas, a explicação
existia, e colar os valores novos passaria em qualquer revisão. O que a `T-2063` acrescentou é uma
coisa só: a medição intermediária, com o `*` e sem a omissão, reproduziu **número a número** o que
o TASKS 026 registrara horas antes, antes de esta implementação existir.

Isso é o que autoriza trocar quatro constantes de uma vez. Um `sha256` final não teria dito nada
além de *"mudou"*.

**O que a prática acrescenta à regra:** o custo de manter âncoras vermelhas por um dia é baixo
**se elas estiverem comentadas no próprio arquivo**. Os comentários deixados no `test_capa.py` e no
`test_identidade_dos_artefatos.py` foram o que permitiu retomar a prova sem refazê-la — e apagá-los
na `T-2066` é parte da tarefa, porque um aviso que sobrevive ao seu motivo vira ruído.

### 9.4 O número que voltou ao de antes, por outro caminho

`test_docx_formatacao` contava 58 células em lavanda; volta a **55**, que é exatamente o número de
antes da ESPEC 018.

São outros 55 códigos. O teste passou a dizer isso no docstring, porque um número que coincide com
um valor histórico é convite a concluir *"então nada mudou"* — e aqui mudou duas vezes, em
sentidos opostos, por razões diferentes.

### 9.5 A documentação era uma âncora não executável, e ninguém a teria acusado

Duas frases do repositório afirmavam por extenso *"nada é omitido"*: o `README.md` e o comentário de
`demais_itens` em `types.ts`. Nenhuma suíte as verifica, e as duas teriam sobrevivido à entrega
inteira dizendo o contrário do código.

Foram achadas por busca literal pela frase da `D-04`, e não por teste. **Toda espec que revise uma
decisão de outra deveria fazer essa busca**: a decisão revista costuma estar escrita em prosa, em
lugares que nenhum portão alcança.

### 9.6 O inventário de âncoras falhou de novo — e o plano citava uma delas `[desvio]`

**É o desvio mais caro desta entrega, e é o mesmo do TASKS 024 §6.1 com outra roupa.**

O PLANO 024 §7 fechou com um critério: *o inventário de âncoras se faz por o que o teste afirma,
não por onde ele mora*. Esta entrega o aplicou — e **parou cedo**. Achou as quatro constantes de
`sha256` e de contagem, e a suíte completa, 14 minutos depois, acusou mais duas:

| Âncora | O que afirma | Por que escapou |
|---|---|---|
| `test_linhas_derivadas.py::test_t1507` | as 58 linhas de cada par, campo a campo, contra um `.json` de fixture | o inventário procurou **constantes no código**, e esta mora num arquivo de dados |
| `test_api_e2e.py::...docx_valido` | `len(ler_docx_de_bytes(...)) == 58` | é a última linha de um teste cujo nome fala de decodificar base64 e conferir fontes |

**O agravante:** o PLANO 028 §1 **cita** a `T-1507` pelo nome, elogiando o precedente do PLANO 021
— *"é a diferença entre saber que o documento não mudou e supor"* — sem perceber que ela ancorava
exatamente o que a entrega ia mudar. Ler a âncora e não a reconhecer como âncora é pior do que não
encontrá-la: a informação estava na mão.

**O que teria pego, e custaria um minuto:** `grep -rn "sha256\|assert len(\|== 58" tests/`. Os três
padrões acham as seis. A regra do §1.1 passa a nomeá-los, porque *"por o que o teste afirma"* é
critério e não procedimento — e o que faltou foi o procedimento.

**A lição de segunda ordem, que é a que sobra.** Duas entregas seguidas descobriram âncoras pela
suíte completa, e nas duas a reancoragem em si correu bem. O gargalo não é a prova do delta — é
**saber a lista antes de começar**. Uma varredura escrita, versionada e rodada no início da fase,
em vez de um critério lembrado de memória, é o que ainda falta a este repositório.

**O que correu bem, e não por acaso:** o método da prova aguentou o susto. As duas âncoras novas
foram fechadas pelo mesmo caminho das quatro — derivar o esperado do estado anterior e comparar com
a saída, em vez de colar a saída — e a da `T-2071` produziu a evidência mais legível da entrega
inteira: 70 deleções, zero inserções.

### 9.7 O `P0` foi fechado ao contrário — e é o que salva um backlog escrito depois

Um portão que exige *"ver o teste reprovar contra o código intocado"* é impossível de cumprir
quando o teste nasce depois do código. A tentação é declará-lo cumprido por analogia — *"o teste é
específico, obviamente reprovaria"* — e é exatamente aí que entra o teste que não testa nada.

A saída custou dois minutos: **desligar a omissão** e rodar. É a mesma pergunta feita ao contrário,
e a tabela da `T-2058` é a resposta. Quatro reprovações, cada uma na asserção esperada; três
passagens, todas em testes que afirmam invariante.

**Duas coisas que só aparecem fazendo:**

- a tabela-verdade de `sem_quantidade_alguma` **passa** com a omissão desligada, e tinha de passar:
  ela testa a propriedade do domínio, não o desenho. Desligar uma tarefa não é o mesmo que desligar
  a entrega, e o portão só vale se souber a diferença;
- a `T-2056` reprovou na **segunda** asserção nos dois pares — `demais_itens` continuava certo, o
  documento é que trazia os zerados. Reprovar na asserção certa é parte da evidência: uma falha na
  primeira significaria que o teste estava medindo outra coisa.

**A regra que fica:** backlog escrito depois da implementação não pode herdar o `P0` por analogia.
Ou o portão é reexecutado ao contrário, com a tabela do que reprova, ou ele não foi fechado —
e dizer que foi é pior do que não tê-lo.

---

## 10. O que este backlog não faz

- **Não muda quais códigos entram no bloco final.** `Contract.posicao_de` e `Contract.aplicar`
  ficam intactas.
- **Não toca o caso de uso**, o grid, o `.xlsx` de análise nem os *schemas* da API (`R-ZER-05`).
- **Não altera o texto da nota de `R-NOT-02`** — a pergunta de se ela deveria mencionar a omissão
  está em `I-01` da espec, e é decisão de conteúdo do documento.
- **Não toca `layout.py`:** nenhuma medida, cor, título ou constante de texto muda.
- **Não corrige o manual**, que segue sem mencionar o bloco final — `I-02` da ESPEC 024, lacuna
  anterior a esta entrega.
- **Não acrescenta dependência.**