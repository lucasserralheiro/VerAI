# TASKS 027 — Backlog de "A planilha que o Confere não leu"

| | |
|---|---|
| **Especificação** | [ESPEC 027](../specs/027-a-planilha-que-o-confere-nao-leu.md) v1.0 |
| **Plano** | [PLANO 027](../plans/027-plano-a-planilha-que-o-confere-nao-leu.md) v1.0 |
| **Versão** | 1.0 — 2026-08-19 |
| **Total** | 25 tarefas · 5 portões · **1 insumo não bloqueante** (`I-39`) |
| **Status** | **Concluído** — 2026-08-19. Portões `P0` a `P3` fechados; `P4` (a pessoa) é humano e fica para quem operar a tela. Backend 1316 → **1330 passed**, reconciliado dígito a dígito. Navegador: **101/111**, e as 10 falhas são as mesmas, pré-existentes, da TASKS 026 §9.7 — nenhuma nova. Cinco desvios, em §9 |

> **Escrito *antes* da implementação**, como os TASKS 020 a 026. A §9 — *o que a implementação
> ensinou* — nasce vazia e é preenchida ao fechar.

---

## 1. Convenções

**Identificadores** `T-20nn`, continuando a numeração: a ESPEC 026 fechou em `T-2025`. Os
identificadores `T-2026`–`T-2033` são os que a ESPEC §9 já nomeou e ficam **onde ela os pôs** —
por isso a numeração não é monotônica dentro dos épicos.

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`pytest` verde; comentário explicando o *porquê* onde a escolha não for óbvia.

**Convenção de commit** `<tipo>(T-20nn): descrição`.

### 1.1 Quatro regras que atravessam este backlog

**1 — A guarda é por peça, nunca por gravidade.** A condição é `medicao.itens`, e jamais
`achados.bloqueado`. Um contrato bloqueado por checksum **não** invalida a observação de que a
aba não traz um código contratado — e uma guarda por gravidade apagaria essa observação sem
quebrar teste nenhum, sem deixar rastro, e só apareceria no dia em que alguém não visse um aviso
que deveria ter visto.

O sinal no diff é `achados.bloqueado` dentro da condição da guarda.

**2 — Asserção sobre contagem, nunca sobre índice.** Esta entrega **remove** achados de uma
lista. `achados[0].validacao == "V-MED-01"` fica verde tendo suprimido a validação errada, e não
há como perceber. Toda asserção de achado deste backlog compara o **dicionário de contagens por
validação** — `Counter(a.validacao for a in ...)` — ou conjuntos.

O sinal no diff é `achados[0]` ou `bloqueantes[0]` em teste novo.

**3 — Os textos entram literais.** As mensagens da ESPEC §8 nascem da própria espec; não há
planilha nem PDF de onde transcrevê-las. Os testes citam as cadeias **literalmente**, e nunca via
a constante que a implementação define — comparar contra ela provaria só que o código concorda
com ele mesmo. É a regra 3 do TASKS 025.

O sinal no diff é um teste que asserte `mensagens.V_MED_01_TITULO` em vez do texto.

**4 — Uma âncora muda, e ela tem nome.** `test_reader_measurement.py:142` passa de `2` para `1`
(`T-2044`). **Só ela.** Se qualquer outra asserção pedir alteração — em especial as `sha256` da
ESPEC 026 —, parar e entender por quê antes de tocar nela.

O sinal no diff é uma constante de âncora alterada num commit que não é o da `T-2044`.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** A âncora do defeito | T-2034 … T-2036 | **P0** | F0 |
| **E1** A guarda | T-2037, T-2026, T-2030, T-2032, T-2033 | **P1** | F1 |
| **E2** O diagnóstico e a causa | T-2038 … T-2040, T-2027, T-2028 | **P2** | F2 |
| **E3** Os textos | T-2041 … T-2044, T-2029 | — | F3 |
| **E4** A tela | T-2045 … T-2047 | — | F4 |
| **E5** Fechar | T-2031, T-2048 … T-2050 | **P3**, **P4** | F5 |

**E1 é publicável sozinha** — e é o corte bom se a entrega precisar parar. As fases **não
comutam**: a E3 escreve a causa que a E2 apura, e a E4 arruma a tela que a E1 esvaziou.

### 2.1 A régua da entrega

| Muda | Não muda |
|---|---|
| A tela de bloqueio do levantamento: **60 cartões → 1** | A leitura da aba: os mesmos itens, quantidades e blocos |
| `V-MED-01` ganha título, causa por degrau, ação por degrau e detalhe | A **severidade** das três validações — bloqueia, avisa, avisa |
| `V-MED-02` registra **um** achado, não dois | Que `V-MED-02` avise em vez de bloquear |
| `V-CTR-05` aparece como **um** cartão com a lista | Que `V-CTR-05` registre **um achado por código**, com o `codigo` |
| `Measurement` ganha `diagnostico` | A reconciliação, a extração do contrato, a consolidação |
| `Entradas` carrega o nome do levantamento | O caminho **em disco**, que continua posicional (`R-ADT-10`) |
| — | **Um byte que seja** do `.docx` ou do `.xlsx` |
| — | O caminho da aba ausente (`ExtractionError` → 422) |

---

## 3. Épico E0 — A âncora do defeito `[portão P0]`

> **Nenhum arquivo de `backend/src/` é tocado neste épico.**

#### T-2034 — A planilha de códigos deslocados
**Tamanho:** P · **Ref:** ESPEC §2.3

`scripts/gerar_fixture_deslocada.py`, no padrão de `gerar_fixtures_desconto.py` — que é como
`levantamento_blocos_invertidos.xlsx` e `levantamento_sem_marca_de_desconto.xlsx` nasceram.
Produz `backend/tests/fixtures/levantamento_codigos_deslocados.xlsx`:

* aba com o nome **exato** `Levantamento`;
* cabeçalho plausível nas primeiras linhas, **sem** `Data do Levantamento :` nem
  `conforme contrato :` — é o que faz `V-MED-02` disparar duas vezes, que é parte dos 60;
* descrição na coluna A, quantidades adiante, e os **códigos de serviço na coluna H**;
* de dez a vinte linhas: a âncora conta achados, não itens.

**Pronto quando:** o arquivo existe, é versionado, e o script que o gera também.

> **A fixture precisa chegar à `V-MED-01`.** Uma planilha sem a aba `Levantamento` cai em
> `ExtractionError` (422) **antes** de qualquer validação — outro caminho, já bom, e que a ESPEC
> §2.4 deixa deliberadamente fora. Errar o nome da aba faz esta fixture testar o caminho errado
> e passar mesmo assim.

---

#### T-2035 — A âncora dos sessenta `[portão P0]`
**Tamanho:** P · **Ref:** **P0**, ESPEC §2.1

`backend/tests/test_planilha_nao_lida.py`, novo:

```python
resultado = container.gerar(
    Entradas(contrato=caminho_contrato, levantamento=caminho_codigos_deslocados)
)
assert Counter(a.validacao for a in resultado.achados.achados) == {
    "V-MED-01": 1,
    "V-MED-02": 2,
    "V-CTR-05": 57,
}
```

Sobre o **dicionário inteiro** (regra 2 do §1.1). Com índice, a E1 ficaria verde tendo suprimido
a validação errada e o `P1` não valeria nada.

`container` é o `_ContainerComFontesEmCache` do `conftest`: evita os 7 s de extração do PDF do
piloto. O leitor de anexos que ele também substitui é indiferente — com bloqueio, os anexos não
são lidos.

**Pronto quando:** passa **hoje**, contra o código intocado, encontrando os 60.

---

#### T-2036 — O arquivo real, se ele existir `[insumo I-39]`
**Tamanho:** PP · **Ref:** ESPEC `I-39`

O degrau 2 da ESPEC §2.3 é **dedução do código** — cinco colunas lidas — verificada em planilha
sintética. **Não foi visto o arquivo que motivou a espec.**

Se ele estiver disponível, passá-lo pelo diagnóstico da `T-2039` e registrar em qual degrau cai.
Se cair no degrau 3 em vez do 2, a ordem de prioridade dos textos da ESPEC §8.1 muda — e é bom
saber disso **antes** da E3.

**Não bloqueia.** Sem ele, vale a dedução.

**Pronto quando:** o degrau observado está registrado, ou está registrado que o arquivo não
estava disponível.

---

**Verificação do E0:** `P0` — a `T-2035` passa com os 60 achados.

---

## 4. Épico E1 — A guarda `[portão P1]` `[publicável sozinho]`

> **Nenhum texto novo é escrito neste épico.** Ele leva a tela de 60 para 1 sem tocar numa
> mensagem.

#### T-2037 — A guarda
**Tamanho:** PP · **Ref:** `R-LEV-01`, `R-LEV-02`

`container.gerar`, logo após `v_med_01_aba_reconhecida`:

```python
v_med_01_aba_reconhecida(medicao, achados)
# `R-LEV-01` — sem item lido, as três abaixo descrevem a **mesma** falha por
# outros ângulos: o cabeçalho sai das mesmas linhas de onde os itens não
# saíram, e `contrato.codigos - ∅` é o contrato inteiro. Sessenta cartões
# para uma causa (ESPEC 027 §2.1).
#
# A guarda vive aqui, e não dentro das validações, para que elas não precisem
# saber em que ordem são chamadas (`R-GRD-06`) — é a mesma forma da guarda de
# `v_ctr_01`, sete linhas acima.
if medicao.itens:
    v_med_02_cabecalho_localizado(medicao, achados)
    v_med_03_desconto_por_posicao(medicao, achados)
    v_ctr_05_codigo_contratado_ausente_da_aba(contrato, medicao, achados)
```

**Pronto quando:** a `T-2026` passa e os negativos também.

> **`v_med_03` entra sob a guarda mesmo sendo inócua.** Com zero itens o laço dela não executa —
> `medicao.codigos` está vazio. Entra porque a intenção fica legível para quem ler depois, e
> porque deixá-la de fora obrigaria a explicar por que só ela ficou.

---

#### T-2026 — Sessenta viram um `[portão P1]`
**Tamanho:** PP · **Ref:** **P1**, `R-LEV-01`

A âncora da `T-2035`, reancorada:

```python
assert Counter(...) == {"V-MED-01": 1}
assert resultado.achados.avisos == []
```

**Pronto quando:** passa, e o docstring registra o número de antes — 60 no piloto, 49 no PGM.

---

#### T-2032 — O negativo: medição lida, código ausente `[portão P1]`
**Tamanho:** PP · **Ref:** **P1**, `R-LEV-03`, `D-03`

`test_v_ctr_05_dispara_quando_o_contratado_nao_foi_medido` (`test_reconciliation.py:326`) **já é
este teste**: remove um código da medição lida e afirma que `V-CTR-05` registra.

A tarefa é confirmá-lo verde **pelo container**, e não só pela validação direta — é a passagem
que a guarda pode quebrar. Acrescentar um caso pelo container, apontando para o de unidade.

**Pronto quando:** com a medição lida e um código a menos, `V-CTR-05` sai do `gerar()` completo,
com o `codigo` preenchido.

---

#### T-2033 — O negativo que não existe hoje `[portão P1]` `[risco]`
**Tamanho:** P · **Ref:** **P1**, `R-LEV-03`

**Contrato bloqueado por outro motivo, medição lida:** `V-CTR-05` continua registrando.

É a tarefa que impede o exagero. O passo seguinte natural à `R-LEV-01` é *"esconder todo aviso
quando há bloqueio"* — e aí um contrato bloqueado por checksum apagaria uma observação
verdadeira sobre a planilha, que está íntegra.

Montar com um `Contract` de checksum quebrado e a medição real do piloto, com um código do
contrato ausente da aba.

**Pronto quando:** existe, e reprova se a guarda passar a olhar `achados.bloqueado`.

---

#### T-2030 — O caminho feliz não se moveu
**Tamanho:** PP · **Ref:** `R-LEV-10`

Os dois pares reais continuam sem nenhum `V-MED-*` e sem `V-CTR-05`. `test_v_ctr_05_nao_dispara_no_piloto`
já cobre metade; a tarefa é o par do PGM e a asserção pelo container.

**Pronto quando:** `Counter(...) == {}` para os dois pares, quanto a estas quatro validações.

---

**Verificação do E1:** `P1`. Contagem de backend reconciliada. **Publicável sozinho.**

---

## 5. Épico E2 — O diagnóstico e a causa `[portão P2]`

#### T-2038 — `DiagnosticoDaAba`
**Tamanho:** P · **Ref:** `R-LEV-05`, `D-02`

`domain/entities/measurement.py`, no molde do `DiagnosticoDaGrade`:

```python
@dataclass(frozen=True)
class DiagnosticoDaAba:
    """ESPEC 027 `R-LEV-05` — o que a leitura da aba observou.

    Existe para que `V-MED-01` deixe de dizer apenas *"o layout pode ter
    mudado"*. Com estes três campos, a causa distingue aba vazia de coluna
    deslocada de arquivo errado — sem abrir a planilha de novo.
    """

    linhas_preenchidas: int
    colunas_lidas: int
    #: Coluna 1-based -> quantos códigos de serviço ela traz, na linha inteira.
    codigos_por_coluna: dict[int, int]
```

Em `Measurement`, **por último e com padrão** — `diagnostico: DiagnosticoDaAba | None = None` —,
pela mesma razão registrada no `Contract`: construções parciais nos testes quebrariam com campo
obrigatório.

**Pronto quando:** `mypy --strict` limpo e as duas construções de `Measurement()` da suíte
continuam válidas.

---

#### T-2039 — O leitor preenche, e só quando falha
**Tamanho:** P · **Ref:** `R-LEV-06`

Em `LevantamentoReader.ler`, depois de `_ler_itens`: se `medicao.itens` estiver vazio, reler as
linhas **inteiras** — não recortadas em `COLUNAS_LIDAS` — e contar códigos por coluna.

O critério é **o mesmo do leitor**: `PADRAO_EM_TEXTO.fullmatch(texto.strip())`. Usar `search`
faria o diagnóstico contar como código o que a leitura rejeitaria, e a mensagem apontaria uma
coluna que não resolveria nada.

**No caminho feliz não acontece nada** (`R-LEV-06`): o `if` não entra.

**Pronto quando:** o diagnóstico da fixture da `T-2034` traz `{8: N}`; o do piloto é `None`.

> **A releitura vive no leitor, não na validação.** Fazê-la na validação exigiria reabrir o
> arquivo — barato, 0,1 s em somente-leitura — mas poria **I/O dentro de uma validação**, que
> hoje é função pura sobre agregados. É a fronteira que `test_architecture` guarda, e o custo de
> furá-la não é o décimo de segundo.

---

#### T-2040 — A causa, como função pura
**Tamanho:** P · **Ref:** `R-LEV-05`, `D-02`

Função de módulo em `measurement_validations.py`, recebendo `DiagnosticoDaAba | None` e
devolvendo as duas frases — causa e ação — do degrau. Sem tocar em arquivo.

Degraus da ESPEC §2.3, nesta ordem:

1. `linhas_preenchidas == 0` → aba vazia;
2. `codigos_por_coluna` não vazio → coluna deslocada, nomeando a de **maior contagem**;
3. caso contrário → nenhum código na aba.

Diagnóstico `None` cai no texto genérico de hoje: a validação continua chamável sem ele
(`R-GRD-06`).

**Pronto quando:** `T-2027` passa nos três degraus, sem abrir planilha.

> **A coluna nomeada é a de maior contagem, e o mapa inteiro vai no detalhe.** Uma implementação
> que pegue a primeira acerta na fixture — que só tem uma — e erra numa planilha com um código
> perdido na coluna C e setenta e quatro na H. `T-2027` cobre o empate.

---

#### T-2027 — Os três degraus `[portão P2]`
**Tamanho:** P · **Ref:** **P2**, `R-LEV-05`

Sobre `DiagnosticoDaAba` **construído à mão**, incluindo:

* degrau 1 — `linhas_preenchidas=0`, que **não tem fixture**;
* degrau 2 — `{8: 74}`;
* degrau 2 com empate — `{3: 1, 8: 74}` → nomeia **H**;
* degrau 3 — `linhas_preenchidas=312, codigos_por_coluna={}`;
* `None` — o texto de hoje.

**Pronto quando:** os cinco casos passam sem nenhum arquivo de fixture.

---

#### T-2028 — O degrau 2 nomeia a coluna `[portão P2]`
**Tamanho:** PP · **Ref:** **P2**, `R-LEV-04`

Ponta a ponta, sobre a fixture da `T-2034`: a causa do achado contém `"coluna H"`.

É a única informação **nova** que esta espec produz, e a que justifica a `T-2039`.

**Pronto quando:** passa pelo `gerar()` completo.

---

**Verificação do E2:** `P2`.

---

## 6. Épico E3 — Os textos

#### T-2041 — O nome do levantamento
**Tamanho:** P · **Ref:** `R-LEV-09`

`Entradas` ganha `nome_do_levantamento: str = ""`; o router o preenche com
`levantamento.filename`. Espelha o `nome_do_contrato` da `R-DOC-06`.

**Só para exibição.** O caminho em disco continua `levantamento.xlsx`, posicional, pela razão da
`R-ADT-10` — dois arquivos homônimos se sobrescreveriam.

**Pronto quando:** o cartão exibe o nome enviado; padrão vazio não quebra construção nenhuma.

---

#### T-2042 — `V-MED-01` em quatro partes
**Tamanho:** M · **Ref:** `R-LEV-04`, ESPEC §8.1

`registrar_em_partes`, com os textos da ESPEC §8.1 **literais**:

| parte | conteúdo |
|---|---|
| `titulo` | *Nenhum item foi lido da aba Levantamento.* mais o nome do arquivo |
| `causa` | o degrau, da `T-2040` |
| `acao` | o degrau — **muda com ele**, e não só a causa |
| `detalhe` | `V-MED-01` · aba `Levantamento` · N linhas · colunas lidas A–E · códigos por coluna |

**Pronto quando:** o cartão renderiza com as quatro partes, e `mensagem` continua sendo a
concatenação das três primeiras — o `.docx` e as asserções antigas a consomem.

> **A ação muda por degrau, e é o que separa esta espec de trocar uma frase.** No degrau 2 o
> conserto é *reposicionar a coluna*; no 3 é *confirmar que o arquivo é o certo*. Uma ação única
> mandaria metade das pessoas para o lugar errado — é por isso que a `V-DOC-01` da ESPEC 025
> também tem ação por degrau.

---

#### T-2043 — `V-MED-02` em um achado
**Tamanho:** P · **Ref:** `R-LEV-07`, `D-06`

Um `registrar_em_partes`, com o título ajustado a qual campo faltou: *a data*, *o contrato*, ou
*a data nem o contrato*.

**A severidade não muda.** Os dois degradam o topo do documento sem invalidar número nenhum, e é
isso que `AVISA` significa.

**Pronto quando:** os três casos produzem **um** achado cada.

---

#### T-2029 — Os três casos do cabeçalho
**Tamanho:** PP · **Ref:** `R-LEV-07`

Só a data; só o contrato; os dois. Em cada um, `len(achados.avisos) == 1` e o título nomeia o que
faltou.

**Pronto quando:** os três passam, e nenhum deles é o caso "nenhum faltou" — esse já é coberto.

---

#### T-2044 — O canário `[risco]`
**Tamanho:** PP · **Ref:** ESPEC §9.3, PLANO §5.3

`test_reader_measurement.py:142` — `assert len(achados.avisos) == 2` passa a `1`.

**É a única asserção do repositório que esta entrega altera.** O docstring registra: o valor
mudou porque a `R-LEV-07` fundiu dois achados em um, e **não** porque o teste estava errado.

**Pronto quando:** alterada, com o porquê ao lado. Se outra âncora pedir alteração no mesmo
commit, parar.

---

**Verificação do E3:** suíte de backend inteira. Nenhuma âncora além desta pode se mexer.

---

## 7. Épico E4 — A tela

#### T-2045 — `V-CTR-05` em um cartão
**Tamanho:** P · **Ref:** `R-LEV-08`, `D-05`

`ListaDeAchados` (`ResultadoPanel.tsx:74`) agrupa por `validacao` quando há mais de um achado da
mesma. Texto da ESPEC §8.3, com a lista de códigos dentro do cartão.

**Singular tratado:** um código só não mostra lista — o título vira *"O código {codigo} do
contrato não aparece no levantamento."* Sem isso sai *"1 códigos"*, e é o mesmo cuidado que o
cabeçalho da tela já tem em `ResultadoPanel.tsx:177`.

**O modelo não muda** (`R-LEV-08`): continuam sendo *n* achados com `codigo`.

**Pronto quando:** *n* achados de `V-CTR-05` produzem um cartão com *n* códigos.

---

#### T-2046 — O caso na suíte de navegador
**Tamanho:** P · **Ref:** `D-05`

Estado sintético em `estados.ts`, no padrão dos demais, com vários `V-CTR-05`. O teste afirma
**um** cartão e os *n* códigos visíveis.

Entra no `inventario-de-anuncios.ts` se acrescentar texto anunciado — mudar o componente e
esquecer o inventário deixa a `a11y` vermelha **por texto**, e o tempo se perde procurando
defeito onde não há.

**Pronto quando:** verde, e `axe` sem violação nova.

---

#### T-2047 — O grid não é afetado
**Tamanho:** PP · **Ref:** `R-LEV-08`

O grid de divergências consome `codigo` do achado por outro caminho. Conferir que o agrupamento
na lista de achados não o alcança.

**Pronto quando:** os testes de grid existentes seguem verdes, sem alteração.

---

**Verificação do E4:** suíte de navegador.

---

## 8. Épico E5 — Fechar `[portões P3 e P4]`

#### T-2031 — As âncoras da ESPEC 026 `[portão P3]`
**Tamanho:** PP · **Ref:** **P3**, `R-LEV-10`

`test_identidade_dos_artefatos.py` verde, **sem uma constante alterada**, nos dois pares.

Uma espec de mensagem que mova um byte do documento errou.

**Pronto quando:** os quatro testes passam.

---

#### T-2048 — O conjunto `[portão P3]`
**Tamanho:** P · **Ref:** **P3**

`pytest -q --durations=12` com a contagem reconciliada: **1.316** mais as tarefas de teste deste
backlog, menos nenhuma. `mypy --strict`, `ruff check`, `bandit`. E `pnpm exec playwright test`.

> **A suíte de navegador roda sem pipe.** `playwright test 2>&1 | tail` segura toda a saída até o
> fim e parece travamento — custou meia hora na ESPEC 026 (TASKS 026 §9.7).

**Pronto quando:** tudo verde, contagem batendo.

---

#### T-2049 — A pessoa `[portão P4]`
**Tamanho:** PP · **Ref:** **P4**

Alguém do faturamento, sem explicação prévia, lê o cartão e diz o que fazer com a planilha.

Não é falha de código se falhar: é redação da ESPEC §8.

**Pronto quando:** a pessoa acerta, ou o texto é corrigido e o teste repetido.

---

#### T-2050 — Emendas e documentação
**Tamanho:** P · **Ref:** ESPEC 007 §13

Preencher a §9 deste arquivo com o que a implementação contrariou. ESPEC §14 e CHANGELOG.

**Se alguma âncora além da `T-2044` precisou mudar, é aqui que se explica por quê** — e a
explicação precisa ser boa.

**Pronto quando:** §9 preenchida, mesmo que só para dizer que nada desviou.

---

## 9. O que a implementação ensinou

Cinco coisas não sobreviveram ao contato com o código. Registradas, não contornadas — é a
conduta da ESPEC 007 §13.

### 9.1 O título com o nome do arquivo estava em duas linhas, e devia estar em uma `[desvio]`

A ESPEC §8.1 mostrava título e nome do arquivo em linhas separadas — o mesmo estilo visual da
ESPEC 025 §9.4. **`achado.titulo` é um `<p>` sem `white-space: pre-line`**
(`ResultadoPanel.tsx:53`): um `\n` na *string* não quebra linha, vira espaço colapsado.

`_titulo_med01` segue o padrão que `_identificar()` já usa em `contract_validations.py` para
`V-DOC-01`: o nome entre parênteses, na mesma frase. `"Nenhum item foi lido da aba
Levantamento ({nome_do_arquivo})."` A ESPEC §8.1 e o exemplo renderizado foram corrigidos
(§14.1 da espec).

Pego porque o *rendering* real foi conferido contra o componente, não só contra o texto da
espec — `tsc --noEmit` não acusaria uma string com `\n` a mais; só a leitura do JSX o fez.

### 9.2 Os textos são literais — sem `**negrito**` nem `` `crases` `` `[desvio]`

`CartaoDeAchado` não interpreta markdown: `{achado.causa}` é interpolação de texto puro. A
ESPEC §8.1 usava `**A a E**` e `` `Levantamento` `` como formatação — convenção de leitura do
*documento*, não da tela. Os textos implementados são planos, como os de `V-DOC-01` já eram
(`_frase_da_causa`, em `contract_validations.py`, não usa markdown). Corrigido junto com 9.1.

### 9.3 O contrato bloqueado por checksum (T-2033) precisou de um extrator falso, não só de um `Contract` à mão

A tarefa previa "montar com um `Contract` de checksum quebrado". Só isso não bastava:
`container.gerar()` sempre chama `self.extrator_de_contrato().extrair(entradas.contrato)` — não
há como injetar um `Contract` pronto sem substituir o próprio extrator.

Resolvido com `_ExtratorFixo`, no mesmo padrão de `_ContratoEmCache` do `conftest.py`
(ESPEC 025) e de `_MedicaoFixa`, escrita ao lado dela para a `T-2032`. `entradas.contrato`
recebeu um `Path` que nunca é aberto — `_ExtratorFixo.extrair()` ignora o argumento —, então
não precisou apontar para um arquivo real.

### 9.4 A guarda de `R-LEV-01` não precisou de nenhuma alteração em `v_med_03`

A `T-2037` previu um comentário explicando por que `v_med_03_desconto_por_posicao` entra sob a
guarda "mesmo sendo inócua com zero itens". Confirmado: o laço de `v_med_03` é
`for codigo in sorted(medicao.codigos)`, e `medicao.codigos` é `set()` vazio quando
`medicao.itens` é vazio — o corpo nunca executa. Nenhum teste teve de provar isso à parte; é
consequência direta de `codigos` ser uma `@property` sobre `itens`.

### 9.5 A suíte de backend reconciliou exatamente, sem sobra nem falta

**1330 passed**, e a soma bate dígito a dígito: 1316 (linha de base, ESPEC 026) + 2
(`test_planilha_nao_lida.py`) + 3 (`test_reconciliation.py`: `T-2032`, `T-2033`, `T-2030`) + 6
(`test_causa_da_leitura_vazia.py`: `T-2027` ×5, `T-2028`) + 3 (`test_reader_measurement.py`:
`T-2029` ×3) = **1330**. Nenhum teste pré-existente precisou de ajuste além do canário nomeado
da `T-2044`.

As quatro âncoras da ESPEC 026 (`test_identidade_dos_artefatos.py`) permanecem verdes sem
nenhuma constante alterada — confirmando `R-LEV-10`: nada desta entrega alcança o `.docx` ou o
`.xlsx`, porque as três validações que ela toca só disparam em caminhos que já bloqueiam a
geração do documento.

### 9.6 A suíte de navegador — 101/111, as dez falhas são as mesmas de sempre

Executada por inteiro, sem pipe (a lição da TASKS 026 §9.7): **101 passed, 10 failed,
29,9 min**, contra 100/110 antes desta entrega. O teste novo — `achados-agregados.spec.ts`,
da `T-2046` — passou, e nenhuma das dez falhas mudou de identidade:

```
a11y-estrutura.spec.ts:102   T-423 — o nome acessível é o rótulo
a11y-estrutura.spec.ts:208   T-431 — 14.049.00054.00 aparece exatamente uma vez
a11y-teclado.spec.ts:67      o botão é alcançável mesmo indisponível
analise.spec.ts:17           T-532 — as quatro situações com rótulo, critério e contagem
analise.spec.ts:46           T-532 — R-RES-02, o total dos itens analisados
analise.spec.ts:127          T-533 — os blocos recolhíveis, abre e fecha por teclado
analise.spec.ts:146          T-535 — R-PAN-06, sem divergência declara os de perfil
limpar.spec.ts:97            R-LMP-04 — a limpeza zera o elemento
limpar.spec.ts:246           R-LMP-01 — confirmar descarta o relatório inteiro
smoke.spec.ts:22             dois arquivos entram e o DOCX é baixado
```

São, dígito a dígito, as dez que a TASKS 026 §9.7 já havia diagnosticado como anteriores à
`feature/evolucao` em andamento — oito não chamam o backend (mocado por `estados.ts`), e as
duas que chamam (`limpar.spec.ts:246`, `smoke.spec.ts:22`) falham por **contagem de campos e
de itens**, produzida em `domain/`, que esta entrega não toca. Nenhuma delas cita `V-MED-01`,
`V-MED-02` ou `V-CTR-05`.

O tempo — quase 30 min para 111 casos — não é desta entrega: é o efeito acumulado dos ~15
testes que geram um relatório real (`pronto()` em `estados.ts`), cada um pagando 15 a 30 s, com
`workers: 1` no `playwright.config.ts`. A suíte inteira já levava perto disso antes.

---

## 10. O que este backlog não faz

* **Ler o código em qualquer coluna** (`I-36`) — seria corrigir em silêncio o que a `R-LEV-04`
  manda relatar, e mudaria a leitura dos dois pares que funcionam.
* **Aviso no formulário** quando o arquivo do campo Levantamento parece uma proposta (`I-37`).
* **Converter as outras oito validações** ao cartão de quatro partes (`I-38`) — nenhuma apareceu
  em tela real com problema de redação.
* **O caminho da aba ausente** — já nomeia causa e conserto (ESPEC §2.4).
* **Mudar severidade de validação alguma.**
* **Qualquer mudança no documento.** Se o `.docx` ou o `.xlsx` mudarem um byte, o backlog falhou.
