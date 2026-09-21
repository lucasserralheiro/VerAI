# TASKS 018 — Backlog do Relatório Derivado do Levantamento

| | |
|---|---|
| **Especificação** | [ESPEC 018](../specs/018-o-relatorio-segue-o-contrato.md) v4.0 |
| **Plano** | [PLANO 018](../plans/018-plano-o-relatorio-segue-o-contrato.md) v1.0 |
| **Versão** | 1.0 — 2026-08-12 |
| **Total** | **90 tarefas · 6 portões · 4 insumos** |
| **Status** | **Concluído** — 2026-08-14. Seis portões fechados; desvios em §14 |

> Escrito **antes** da implementação, como o TASKS 003, 004, 008, 009, 012, 013 e 017.

---

## 0. Resultado

| O que | Antes | Depois |
|---|---|---|
| `PA-PGM` | **bloqueado**, 26 achados bloqueantes | **58 linhas**, 0 bloqueantes |
| Piloto | 55 linhas em 22 seções | **58 linhas**, sem agrupamento |
| Fonte das quantidades | contrato | **aba `Levantamento`** |
| Ordem das linhas | catálogo | **contrato** |
| Arquivos de entrada | 2 + catálogo opcional | **2** |
| Catálogo | 58 entradas embutidas | **removido** |
| `R-MED-02` no piloto | 1 de 35 faixas reconhecidas | **35 de 35** |
| `R-MED-02` no PGM | 1 de 38 | **38 de 38** |
| `V-REC-01` no PGM | 3 visíveis | **5** |
| Testes de backend | 405 | **423** |

### Desvios

| Tarefa | O que mudou | Por quê |
|---|---|---|
| **T-1203** | Deixou de ser identidade entre crivos e passou a afirmar `1 → 35/38` | O defeito era dos **dois** pares, não só do PGM. A medição da espec comparava o *fixture* do SMIT contra o *original* do PGM |
| **T-1200** | A fixture materializa a faixa nas cinco colunas **sem** `merge_cells` | O `openpyxl` apaga as células não-âncora ao mesclar, e a fixture passava nos dois crivos — provando nada |
| **T-1290** | Nasceu: o levantamento do PGM não existia como fixture | O backlog supôs o par completo na suíte; havia só o `contrato_pgm.pdf` |
| **T-1219** | Cinco `V-REC-01` no PGM, não quatro | O `14.048.00027.00` nunca era comparado: o código não existe no catálogo do SMIT |
| **T-1222** | Entrou `Measurement.contratada_para` | A variante descontada traz a coluna contratada **vazia**; ler de lá punha 0 onde a aba afirma 3.500 |
| **T-1232** | Sem linhas, sem tabela | `relatorio_vazio` passou a emitir tabela só com cabeçalho, deslocando o índice em que 32 testes de anexo se apoiam |

---

## 1. Convenções

**Identificadores** `T-12nn` seguem a numeração do PLANO 018, que começa em T-1200 porque o
TASKS 017 fechou em T-1137. **Trinta e duas tarefas nascem neste backlog** — T-1258 a T-1289 —
por desdobramento das 58 do plano. Estão registradas em §2.4.

**Definição de pronto — backend:** código e teste na mesma entrega; `ruff check`, `mypy src/` e
`bandit -ll -r src/` limpos; `pytest` verde; comentário explicando o *porquê* onde a escolha não
for óbvia.

**Definição de pronto — frontend:** `pnpm lint` e `pnpm build` limpos; o componente renderiza sem
seção e sem erro no console.

**Convenção de commit** `<tipo>(T-12nn): descrição`.

**Marcas:** `[portão]` encerra um portão · `∥` pode correr em paralelo com as irmãs do mesmo bloco
· `⛔` ponto de não retorno.

### 1.1 Seis regras que atravessam o backlog

**1 — O inventário é lei.** A partir da E1, nenhum teste é apagado sem constar da categoria
**MORRE**. Se um teste ficar vermelho e não estiver no inventário, ele é **regressão**, não
limpeza — conserte o código, não o teste. É a diferença entre preservar cobertura e apagar quem
reclama, e a T-1251 é quem cobra.

**2 — Esta entrega reescreve testes, e a promessa é outra.** Diferente da ESPEC 017, aqui 19
testes morrem por decisão e 2 vivem dentro de `test_extractor_contract.py`. A promessa
verificável é: **as 24 asserções de extração daquele arquivo permanecem intactas**, e os 147
testes da lista INTOCÁVEL não são tocados.

**3 — `contratada is None` não é zero.** `MeasurementItem.contratada` devolve `Decimal | None`.
O `14.046.00003.00` do PMG tem a célula **vazia**. Célula vazia é ausência de afirmação; zero é
afirmação de que nada foi contratado. Confundi-las põe um item como *medido acima do contratado*
na análise. É a T-1272, e ela existe separada por isso.

**4 — O âncora antigo roda até a E6.** Ele fica vermelho na E4 e é a única rede que mede o
estrago nas E3, E4 e E5. Sai por tarefa nomeada — T-1250 —, nunca como efeito colateral.

**5 — O layout físico não é tocado.** Coluna, largura, fonte, altura de linha, capa, timbrado,
rodapé e anexos. O renderizador estará aberto na E4 e a tentação é máxima. `D-10`, cobrado pela
T-1238 e pelos 57 testes de anexo verdes sem alteração.

**6 — Valor esperado de teste nunca vem da saída do código.** Vale para os âncoras e sobretudo
para a T-1259: um teste que compara o código consigo mesmo não é invariância, é tautologia.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Situação |
|---|---|---|---|
| **E0** A regra do desconto passa a valer | T-1259 · T-1200 · T-1258 · T-1201 · T-1202 … T-1208 · T-1260 · T-1261 | **P0** | ⬜ |
| **E1** O inventário da suíte | T-1209 … T-1213 · T-1262 … T-1268 | **P1** | ⬜ |
| **E2** O âncora novo, e ele reprova | T-1269 · T-1214 … T-1220 · T-1270 | **P2** | ⬜ |
| **E3** O universo passa a ser a aba | T-1271 · T-1221 · T-1222 · T-1272 · T-1223 … T-1229 · T-1273 … T-1275 | — | ⬜ |
| **E4** Ordem, bloco final e o fim das faixas | T-1276 · T-1230 … T-1238 · T-1277 … T-1283 | — | ⬜ |
| **E5** Regras de linha, e o catálogo sai | T-1239 … T-1249 · T-1284 … T-1288 | **P3 · P4** | ⬜ |
| **E6** O conjunto e a documentação | T-1250 … T-1257 · T-1289 | **P5** | ⬜ |

### 2.1 Ordem e paralelismo

```
E0 ─────────────────────────────────────────────►  entrega independente
│
├─ E1 ─┐
│      ├─► E3 ──► E4 ──► E5 ──► E6
└─ E2 ─┘
```

**A E0 não depende de nada e nada depende dela.** Corrige defeito de produção, não move
quantidade, e pode ir ao ar com a ESPEC 018 ainda em discussão.

**E1 e E2 não tocam `src/`** e correm em paralelo entre si e com a E0 — três frentes desde o
primeiro dia.

Da E3 em diante é linear entre épicos, mas **largamente paralelo dentro de cada um**. As
sequências rígidas são só quatro:

```
E0:  T-1259 ──► T-1202 ──► T-1206         (congela · muda · prova que não moveu)
E2:  T-1269 ──► T-1214 ──► T-1218         (helper · âncora · vê reprovar)
E3:  T-1271 ──► T-1221 ──► T-1222 ──► T-1272
E5:  T-1249 ──► T-1246 ⛔                  (verde antes de remover)
```

Todo o resto de cada épico é paralelizável entre pessoas.

### 2.2 Alocação sugerida

| Frente | Épicos | Perfil |
|---|---|---|
| **A** | E0 → E3 → E5 | Backend, domínio e reconciliação |
| **B** | E1 → E4 (testes) → E6 | Backend, suíte e documentação |
| **C** | E2 → E4 (renderizador e tela) | DOCX e frontend |

Com três frentes: **1,5 a 2 dias**. Com uma pessoa: 2,5 a 3 dias (PLANO 018 §4).

### 2.3 Pontos de não retorno

**Um, e é a T-1246 ⛔** — a remoção de `infrastructure/catalog/`, `catalog_entry.py` e
`seed_catalog.py`.

Não é irreversível no git; é irreversível **na prática dentro da entrega**: removido o catálogo, o
âncora antigo já não passa por construção. Se o novo ainda não passar por defeito, o projeto fica
sem nenhuma referência para julgar se o documento está certo.

Por isso a T-1246 vem **depois** de a T-1249 estar verde, e não antes.

### 2.4 As trinta e duas tarefas que nascem neste backlog

Desdobramentos do plano, para granularidade e paralelismo:

| Nova | Desdobra | Motivo |
|---|---|---|
| T-1258 | T-1200 | Segunda fixture, **sem** marca de desconto — a `V-MED-03` precisa de um caso que dispare |
| T-1259 | T-1206 | O congelamento dos valores tem de acontecer **antes** da mudança, não junto da asserção |
| T-1260 | T-1207 | Registrar `V-MED-03` no `container` é tarefa de orquestração, não de validação |
| T-1261 | T-1203 | Fechar P0 exige a suíte inteira, não só os testes novos |
| T-1262 … T-1268 | T-1210 | Inventário **por arquivo** — sete frentes paralelas em vez de uma tarefa monolítica |
| T-1269 | T-1214 | O leitor do modelo por código é insumo dos quatro âncoras |
| T-1270 | T-1219 | O bloco final tem conteúdo nominal próprio a afirmar |
| T-1271 | T-1221 | A ordem de aparição na aba é uma propriedade nova de `Measurement` |
| T-1272 | T-1222 | `contratada is None` merece tarefa e teste próprios (§1.1 regra 3) |
| T-1273 … T-1275 | T-1229 | Atualização dos testes MUDA, por arquivo |
| T-1276 | T-1230 | O índice de posição no contrato é propriedade nova de `Contract` |
| T-1277 | T-1232 | Repetir o cabeçalho por página é mecanismo OOXML distinto de remover faixa |
| T-1278 … T-1280 | T-1235 | Frontend por componente |
| T-1281 … T-1283 | T-1237 | Atualização dos testes de seção, por arquivo |
| T-1284 | T-1245 | O separador tem asserção própria — o âncora não a pega |
| T-1285 … T-1288 | T-1246 | A remoção do catálogo em quatro camadas, cada uma revisável sozinha |
| T-1289 | T-1251 | Medir o tempo da suíte é dado de operação, não critério de verde |

### 2.5 A régua da entrega — o que pode mudar de comportamento

Toda diferença observável entre antes e depois tem de ser atribuível a esta lista:

| Onde | Delta esperado |
|---|---|
| **Quantidades do piloto e do PMG após a E0** | **Nenhuma.** Zero diferenças. É o que `P0` mede |
| Linhas do documento — piloto | 55 → **58** (54 ordenadas + 4 no bloco final) |
| Linhas do documento — PMG | bloqueado → **58** (45 + 13) |
| Achados do PMG | 26 bloqueantes + 19 avisos → **0 + 4** |
| Quantidade contratada | do contrato → **da aba** (`D-05`) |
| Descrição e unidade | do catálogo → **do contrato**; da aba no bloco final |
| Agrupamento | 22 seções → **nenhuma** |
| `14.023.00002.00` | `1500` → **`1.500`** |
| `14.025.00011.00` | duas linhas `1 / 1` → **uma** |
| Análise (ESPEC 009) | universo maior; as quatro situações mudam de contagem |
| Layout físico | **nenhuma diferença** |

**Se aparecer uma décima segunda diferença, pare.**

---

## 3. Épico E0 — A regra do desconto passa a valer `[portão P0]`

> **Entrega independente.** Corrige defeito de produção sem mover quantidade. Publicável sozinha,
> antes de qualquer decisão sobre o resto da ESPEC 018.

#### T-1259 — Congelar os valores de hoje `[primeiro]`
**Tamanho:** P · **Ref:** `P0` · **Bloqueia:** T-1206

Antes de tocar em `src/`, registrar num módulo de teste os valores **medidos hoje** de
`item_para(codigo).medida` para os **22 códigos repetidos** — 13 do piloto, 9 do PMG.

Os valores vêm da **planilha**, lidos à mão, com o número da linha ao lado. Não da saída do
extrator (§1.1 regra 6).

Referência para os do PMG, já medidos: `14.049.00048.00` → 5 (não 7); `14.049.00038.00` → 5 (não
9); `14.049.00005.00` → 15,07 (não 22,08); `14.024.00005.00` → 2.105,4 (não 2.470,4).

**Pronto quando:** os 22 valores estão no arquivo, cada um com a linha da planilha de onde saiu.

---

#### T-1200 — Fixture de blocos invertidos, com faixa mesclada ∥
**Tamanho:** P · **Ref:** `D-09`

`backend/tests/fixtures/levantamento_blocos_invertidos.xlsx`: `DESCONTANDO RECURSOS DE
DESENVOLVIMENTO` **acima**, `TOTAL DE RECURSOS` abaixo, com a faixa **mesclada nas cinco
colunas**, como na planilha da PGM.

Uma fixture com o título em coluna única passa nos dois códigos e não prova nada.

**Pronto quando:** o arquivo existe, a faixa é mesclada, e um código repetido aparece com valor
diferente em cada bloco.

---

#### T-1258 — Fixture sem marca de desconto ∥
**Tamanho:** PP · **Ref:** ESPEC §8.2

Segunda fixture: código repetido em dois blocos, **nenhum deles** com a marca `DESCONTANDO`. É o
caso que `V-MED-03` tem de acusar.

**Pronto quando:** o arquivo existe e nenhuma faixa contém a marca.

---

#### T-1201 — Ver a fixture reprovar `[portão P0]`
**Tamanho:** PP · **Ref:** `P0` · **Depende de:** T-1200

Rodar T-1200 contra o código **atual** e exigir que reprove: hoje o atalho *"vale a última lida"*
escolhe o bloco de baixo, que na fixture é o **total cheio**.

**Pronto quando:** reprova, e o valor obtido é o do bloco `TOTAL DE RECURSOS`.

---

#### T-1202 — Reescrever `_e_titulo_de_bloco`
**Tamanho:** PP · **Ref:** `R-REL-11`, `D-09` · **Depende de:** T-1259

```python
def _e_titulo_de_bloco(self, celulas: list[str]) -> bool:
    valores = {c.strip() for c in celulas if c.strip()}
    if len(valores) != 1:
        return False
    return valores.pop().lower() not in _CABECALHOS
```

*Faixa é a linha cujas células preenchidas carregam o mesmo texto.* Cobre a faixa em coluna única
e a mesclada, sem constante a calibrar. Linha de item e linha de total caem fora por `len != 1`.

**Pronto quando:** T-1201 passa e o docstring explica as duas formas de faixa.

---

#### T-1203 — Identidade de faixas no piloto `[portão P0]`
**Tamanho:** P · **Ref:** `P0` · **Depende de:** T-1202

Teste: no piloto, o conjunto de **números de linha** reconhecidos como faixa é **igual** ao de
hoje — 35 e 35, linha por linha. Não "mesma quantidade": mesma lista.

**Pronto quando:** a asserção compara listas, e passa.

---

#### T-1204 — As 37 faixas do PMG ∥
**Tamanho:** PP · **Ref:** `R-REL-11` · **Depende de:** T-1202

Teste: no PMG, 37 faixas reconhecidas, e `bloco_titulo` **não vazio** nos 68 itens — hoje são
68 vazios.

**Pronto quando:** os dois números estão afirmados separadamente.

---

#### T-1205 — Os repetidos resolvem pela marca ∥
**Tamanho:** P · **Ref:** `R-MED-02` · **Depende de:** T-1202

Teste: os 9 códigos repetidos do PMG e os 13 do piloto são resolvidos pela variante
`DESCONTANDO` — `desconta_desenvolvimento` verdadeiro na escolhida.

Hoje o PMG resolve **1 de 9** por essa via.

**Pronto quando:** 9 e 13, cada conjunto numa asserção própria.

---

#### T-1206 — Invariância de valor `[portão P0]`
**Tamanho:** P · **Ref:** `P0` · **Depende de:** T-1259, T-1202

Teste: para os dois pares, `item_para(codigo).medida` dos 22 códigos é **idêntica** aos valores
congelados na T-1259.

É a tarefa que parece redundante e é o portão. Ela existe para o dia em que a planilha listar os
blocos na outra ordem.

**Pronto quando:** os 22 batem, e o teste referencia a T-1259 em comentário.

---

#### T-1207 — `v_med_03_desconto_por_posicao` ∥
**Tamanho:** P · **Ref:** ESPEC §8.2

Validação `AVISA` em `measurement_validations.py`: código repetido resolvido pela **última
ocorrência**, sem variante `DESCONTANDO` identificada.

Mensagem: `código {c} aparece {n} vezes no levantamento sem bloco de desconto identificado — foi
usada a última ocorrência (linha {l})`.

**Pronto quando:** a validação existe, com teste unitário próprio.

---

#### T-1260 — Registrar `V-MED-03` no orquestrador ∥
**Tamanho:** PP · **Ref:** ESPEC §8.2 · **Depende de:** T-1207

`container.gerar()` chama `v_med_03` junto das demais `v_med_*`.

**Pronto quando:** aparece na resposta da API para a fixture da T-1258.

---

#### T-1261 — Suíte verde e P0 fechado `[portão P0]`
**Tamanho:** PP · **Ref:** `P0` · **Depende de:** todas as anteriores da E0

Suíte completa verde — **405 mais os testes novos** —, `ruff`, `mypy` e `bandit` limpos.

**Pronto quando:** P0 fechado, e a E0 pode ser publicada sozinha.

---

## 4. Épico E1 — O inventário da suíte `[portão P1]`

> **Nenhum arquivo de `src/` é tocado neste épico.** Sete das doze tarefas são paralelas.

#### T-1209 — Categoria MORRE ∥
**Tamanho:** PP · **Ref:** `R-REL-10`

Listar nominalmente: `test_catalog_seed.py` (12 testes) e `test_default_catalog.py` (7) inteiros;
`test_extractor_contract.py::test_v_ctr_02_todo_o_catalogo_visivel_resolve` (l. 167) e
`::test_v_ctr_02_bloqueia_codigo_fora_do_contrato` (l. 185).

**Pronto quando:** 21 testes nomeados, com arquivo e linha.

---

#### T-1210 … T-1268 — Categoria MUDA, por arquivo ∥∥∥∥∥∥∥

Sete tarefas paralelas. Cada uma percorre **um** arquivo e lista, teste a teste, o que a asserção
afirma hoje e o que passará a afirmar.

| # | Arquivo | Testes | O que procurar |
|---|---|---|---|
| T-1210 | `test_reconciliation.py` | 28 | quantidade contratada vinda do contrato · catálogo · `V-CAT` |
| T-1262 | `test_divergences.py` | 26 | agrupamento por seção · `sem_previsao_contratual` |
| T-1263 | `test_analise.py` | 27 | `sem_previsao_contratual` · contagem das quatro situações |
| T-1264 | `test_domain.py` | 40 | `ReportSection` · `CatalogEntry` · `secao_codigo` |
| T-1265 | `test_api_e2e.py` | 16 | campo `catalogo` no formulário · seções na resposta |
| T-1266 | `test_cascata_de_validacoes.py` | 7 | `V-CTR-02` · `V-CAT-0x` · ordem das validações |
| T-1267 | `test_docx_estrutura.py` + `test_xlsx_analise.py` | 33 | faixas de grupo e seção no DOCX · abas da análise |
| T-1268 | `conftest.py` · `leitura_relatorio.py` · `leitura_analise.py` | — | `fontes_caras` e os helpers de leitura |

**Tamanho de cada:** P · **Pronto quando:** cada teste do arquivo está classificado em *muda* ou
*não muda*, com uma linha dizendo o quê.

> **A T-1268 é a mais perigosa das oito.** `fontes_caras` é de escopo de sessão e alimenta ~250
> testes. Alterá-la sem mapear os consumidores quebra tudo de uma vez e longe da causa
> (PLANO 018 §5.4).

---

#### T-1211 — Categoria INTOCÁVEL ∥
**Tamanho:** PP · **Ref:** `P4`

Listar os 147: `test_extractor_contract.py` (24 de 26), `test_extractor_contrato_pgm.py` (6),
`test_grade_contrato.py` (13), `test_docx_anexos.py` (32), `test_anexos_configuracao.py` (25),
`test_figuras.py` (9), `test_aba_reader.py` (16), `test_dado_pessoal.py` (6),
`test_architecture.py` (16).

**Pronto quando:** a lista existe e soma 147.

---

#### T-1212 — Reconciliar com 405 `[portão P1]`
**Tamanho:** PP · **Ref:** `P1` · **Depende de:** T-1209 … T-1268

MORRE + MUDA + INTOCÁVEL + *não afetados* = **405**.

**Pronto quando:** a soma bate. Se não bater, falta arquivo no inventário.

---

#### T-1213 — Registrar o inventário aqui `[portão P1]`
**Tamanho:** PP · **Ref:** `P1`, `P5` · **Depende de:** T-1212

Gravar as três listas na §10 deste backlog. É contra elas que a T-1251 confere.

**Pronto quando:** P1 fechado.

---

## 5. Épico E2 — O âncora novo, e ele reprova `[portão P2]`

> **Nenhum arquivo de `src/` é tocado neste épico.**

#### T-1269 — Leitor do modelo por código `[primeiro]`
**Tamanho:** P · **Ref:** `D-11` · **Bloqueia:** T-1214, T-1215, T-1216

Helper em `tests/leitura_relatorio.py`: lê as páginas 2 e 3 do modelo GRC e devolve
`dict[codigo] -> (contratada, medida, descricao, unidade)`.

Reaproveitar o que já existe no arquivo. **Ler do PDF, nunca transcrever** — número transcrito
vira número inventado na primeira revisão.

**Pronto quando:** devolve 54 códigos do modelo, e um teste do próprio helper confere três deles.

---

#### T-1214 — Âncora por código: quantidade medida
**Tamanho:** M · **Ref:** `D-11` · **Depende de:** T-1269

Para cada código do piloto, a **quantidade medida** do relatório gerado é a do modelo GRC.

A contratada sai da comparação: `D-05` troca deliberadamente a fonte.

**Pronto quando:** o teste existe, com uma asserção por código e não um `assert` composto.

---

#### T-1215 — Âncora de conjunto ∥
**Tamanho:** P · **Ref:** `R-REL-01`, `R-REL-06` · **Depende de:** T-1269

Os códigos do documento são os da aba **menos** a família `10.050` — **58** no piloto, **58** no
PMG.

**Pronto quando:** afirma o conjunto, não só a contagem.

---

#### T-1216 — Âncora de ordem ∥
**Tamanho:** P · **Ref:** `R-REL-03` · **Depende de:** T-1269

As 54 primeiras linhas do piloto seguem a ordem de aparição no contrato; as 4 restantes estão no
bloco final.

**Pronto quando:** a lista de códigos, na ordem, é comparada com a do contrato.

---

#### T-1217 — Declarar as duas divergências ∥
**Tamanho:** PP · **Ref:** `D-11`

No próprio teste, com o motivo:

| código | motivo |
|---|---|
| `11.027.00001.00` | contrato e aditivo dizem 10, o modelo grafa 6 — `I-01` da ESPEC 001 |
| `14.025.00011.00` | modelo imprime duas linhas `1 / 1`; `D-01` consolida em uma |

**Pronto quando:** as duas são exceções nomeadas, não valores ajustados no esperado.

---

#### T-1218 — Ver o âncora reprovar `[portão P2]`
**Tamanho:** PP · **Ref:** `P2` · **Depende de:** T-1214 … T-1217

Contra o código **atual**: **55 linhas onde se esperam 58**, sem bloco final, com a família
`10.050` ausente por `exibir = N` em vez de por `R-REL-06`.

**Pronto quando:** reprova pelos três motivos, registrados aqui.

---

#### T-1219 — Âncora do PMG ∥
**Tamanho:** P · **Ref:** ESPEC §9.2

58 linhas (45 + 13), 0 bloqueantes, 4 avisos, documento gerado.

**Pronto quando:** os quatro números estão afirmados separadamente.

---

#### T-1270 — Âncora do bloco final ∥
**Tamanho:** P · **Ref:** `D-06`

Conteúdo nominal do bloco:

| | códigos |
|---|---|
| piloto (4) | `12.029.00001.00` · `14.024.00001.00` · `14.049.00004.00` · `14.049.00054.00` |
| PMG (13) | os 3 do grupo B, os 2 do grupo C (`14.071.00006.00`, `14.071.00007.00`) e os 8 do grupo D |

**Pronto quando:** os 17 códigos estão nomeados, e `14.071.00006.00` sai com contratada 5 e
medida 0.

---

#### T-1220 — O âncora antigo continua rodando
**Tamanho:** PP · **Ref:** §1.1 regra 4

Nenhuma alteração em `test_anchor_fidelity.py` nesta fase. Ele fica vermelho a partir da E4 e é
consultado, não consertado.

**Pronto quando:** está registrado aqui que a retirada é a T-1250, e ninguém a antecipa.

---

## 6. Épico E3 — O universo passa a ser a aba

#### T-1271 — Ordem de aparição na aba `[primeiro]`
**Tamanho:** PP · **Ref:** `R-REL-01` · **Bloqueia:** T-1221

`Measurement.codigos_em_ordem` — códigos distintos na ordem em que aparecem na aba, sem repetir.

**Pronto quando:** devolve 61 no piloto e 59 no PMG, na ordem da planilha.

---

#### T-1222 — As duas quantidades vêm da aba
**Tamanho:** P · **Ref:** `R-REL-04`, `D-05` · **Depende de:** T-1221

`_montar_linha` passa a ler `contratada` e `medida` de `MeasurementItem`. `R-CTR-01` revogada.

**Pronto quando:** nenhuma linha do relatório consulta `contrato.quantidade_para`.

---

#### T-1272 — `contratada is None` não é zero
**Tamanho:** P · **Ref:** §1.1 regra 3 · **Depende de:** T-1222

Célula vazia é **ausência de afirmação**; a linha sai com a quantidade contratada em branco, e a
análise não a classifica como *medido acima do contratado*.

Caso real: `14.046.00003.00` do PMG, `contratada = None`.

**Pronto quando:** teste dedicado com esse código, e a célula do DOCX sai vazia — não `0`.

---

#### T-1221 — O laço passa a iterar a aba
**Tamanho:** M · **Ref:** `R-REL-01`, `R-REL-02` · **Depende de:** T-1271

`GenerateMeasurementReport.executar` itera os códigos da aba, um por código, resolvidos por
`item_para`. O catálogo ainda existe nesta fase; deixa de ser a fonte de iteração.

**Pronto quando:** o piloto produz 61 linhas e o PMG 59, antes das exclusões da E5.

---

#### T-1223 — Sai o registro de `V-CAT-03` ∥
**Tamanho:** PP · **Ref:** ESPEC §8.1

Remover o `achados.registrar("V-CAT-03", …)` de dentro de `_medida`.

**Pronto quando:** `V-CAT-03` não aparece mais em nenhuma resposta.

---

#### T-1224 — `v_ctr_05_codigo_contratado_ausente_da_aba` ∥
**Tamanho:** P · **Ref:** ESPEC §8.2

`AVISA`. Preserva a metade útil da `V-CAT-03`. Não ocorre em nenhum dos dois pares.

**Pronto quando:** existe, com teste unitário.

---

#### T-1225 — `v_rec_01` amplia e inverte ∥
**Tamanho:** P · **Ref:** `R-REL-12`, `D-05`

Perde os `continue` de `exibir` e `qualificador`; a mensagem passa a dizer que o relatório usa a
quantidade **da aba**.

**Pronto quando:** avalia todo código do contrato, inclusive `10.050.*`.

---

#### T-1226 — Teste: o NAS deixa de ser crítico ∥
**Tamanho:** P · **Ref:** `D-05`

`14.024.00006.00` do PMG sai com contratada `9.000,89`, não `6.100,00`, e a análise o classifica
como **divergente**, não crítico.

**Pronto quando:** as duas asserções — quantidade e classificação — estão separadas.

---

#### T-1227 — Teste: as 4 divergências do PMG ∥
**Tamanho:** P · **Ref:** `R-REL-12`

Inclui `10.050.00001.00` — contrato 42.260,00 × aba 42.814,01 —, hoje invisível.

**Pronto quando:** os quatro códigos estão nomeados.

---

#### T-1228 — Teste de `V-CTR-05` ∥
**Tamanho:** PP · **Ref:** ESPEC §9.2

Dispara em fixture com código contratado ausente da aba; **não** dispara nos dois pares.

---

#### T-1229 · T-1273 · T-1274 · T-1275 — Atualizar os testes MUDA, por arquivo ∥∥∥∥

| # | Arquivo | Depende do inventário |
|---|---|---|
| T-1229 | `test_reconciliation.py` | T-1210 |
| T-1273 | `test_domain.py` | T-1264 |
| T-1274 | `test_api_e2e.py` | T-1265 |
| T-1275 | `test_cascata_de_validacoes.py` | T-1266 |

**Tamanho de cada:** P · **Pronto quando:** só os testes do inventário foram tocados. Qualquer
outro vermelho é regressão (§1.1 regra 1).

---

## 7. Épico E4 — Ordem, bloco final e o fim das faixas

#### T-1276 — Posição do código no contrato `[primeiro]`
**Tamanho:** PP · **Ref:** `R-REL-03` · **Bloqueia:** T-1230

`Contract.posicao_de(codigo) -> int | None` — índice de primeira aparição na tabela de itens.
`None` para código que o contrato não traz.

**Pronto quando:** devolve 0 para o primeiro código do contrato e `None` para `15.076.00001.00` no
PMG.

---

#### T-1230 — A ordem passa a ser a do contrato
**Tamanho:** P · **Ref:** `R-REL-03`, `D-02` · **Depende de:** T-1276

**Pronto quando:** T-1216 passa.

---

#### T-1231 — `Report.demais_itens` ∥
**Tamanho:** P · **Ref:** `R-REL-03`, `D-06` · **Depende de:** T-1276

Códigos com `posicao_de is None`, na ordem da aba.

**Pronto quando:** T-1270 passa.

---

#### T-1232 — Somem as faixas do renderizador ∥
**Tamanho:** P · **Ref:** `R-REL-05`

Remover a emissão das linhas de grupo e de seção do `docx_renderer`. **Nada mais.**

**Pronto quando:** o DOCX do piloto não tem nenhuma linha de faixa.

---

#### T-1277 — Cabeçalho de colunas uma vez por página ∥
**Tamanho:** P · **Ref:** `R-REL-05` · **Depende de:** T-1232

Hoje ele repete por seção. Passa a ser linha de cabeçalho de tabela com repetição por página
(`tblHeader` do OOXML), em vez de emissão manual.

**Pronto quando:** aparece uma vez por página em documento de várias páginas.

---

#### T-1233 — O bloco final no renderizador ∥
**Tamanho:** P · **Ref:** `D-06` · **Depende de:** T-1231

Título `DEMAIS ITENS DO LEVANTAMENTO`, mesmo desenho de tabela das demais linhas. **Mesmas
larguras** (`D-10`).

**Pronto quando:** aparece no DOCX dos dois pares, com 4 e 17 linhas.

---

#### T-1234 — `ReportSection` sai ∥
**Tamanho:** P · **Ref:** ESPEC §7 · **Depende de:** T-1232

`Report.linhas` vira lista direta.

---

#### T-1235 — `api/schemas.py` ∥
**Tamanho:** P · **Ref:** ESPEC §7

A resposta perde o agrupamento por seção e ganha `demais_itens`.

---

#### T-1278 · T-1279 · T-1280 — Frontend ∥∥∥

| # | Arquivo | O que muda |
|---|---|---|
| T-1278 | `ResultadoPanel.tsx` | Deixa de agrupar por seção; renderiza lista e bloco final |
| T-1279 | `DivergenciaGrid.tsx` | Idem, preservando o bloco de sem previsão da ESPEC 002 |
| T-1280 | `frontend/e2e/` | Ajustar os seletores que dependem de cabeçalho de seção |

**Tamanho de cada:** P · **Depende de:** T-1235

---

#### T-1236 — Teste: o DOCX não tem faixas ∥
**Tamanho:** P · **Ref:** `R-REL-05`

Nenhuma faixa de grupo ou seção; cabeçalho uma vez por página.

---

#### T-1237 · T-1281 · T-1282 · T-1283 — Atualizar os testes de seção, por arquivo ∥∥∥∥

| # | Arquivo | Depende do inventário |
|---|---|---|
| T-1237 | `test_divergences.py` | T-1262 |
| T-1281 | `test_analise.py` | T-1263 |
| T-1282 | `test_xlsx_analise.py` | T-1267 |
| T-1283 | `test_docx_estrutura.py` | T-1267 |

**Tamanho de cada:** P

---

#### T-1238 — Conferir que o layout físico não mudou `[risco]`
**Tamanho:** P · **Ref:** `P4`, `D-10`

`git diff` do `docx_renderer.py` restrito às funções de faixa e ao bloco novo. Largura de coluna,
capa, timbrado, rodapé e anexos sem uma linha alterada.

**Pronto quando:** `test_docx_anexos.py` (32) e `test_anexos_configuracao.py` (25) verdes **sem
alteração** — 57 testes que provam que o escopo não vazou.

---

## 8. Épico E5 — Regras de linha, e o catálogo sai `[portões P3 · P4]`

#### T-1239 — A constante de família ∥
**Tamanho:** PP · **Ref:** `R-REL-06`, `D-04`

```python
# Horas de especialista/analista e consultoria de BI são faturadas por outro
# instrumento: aparecem na aba com medida 0 e não entram na comprovação.
FAMILIAS_FORA_DO_DOCUMENTO = frozenset({"10.050"})
```

Fora do **documento**, dentro da **comparação**.

---

#### T-1240 — Teste da família ∥
**Tamanho:** P · **Ref:** `R-REL-06`

Nenhum `10.050.*` no documento, **e** os três continuam avaliados por `V-REC-01`. As duas
asserções separadas — é o que distingue "excluído do documento" de "excluído do sistema".

---

#### T-1241 — Descrição e unidade do contrato ∥
**Tamanho:** P · **Ref:** `R-REL-07`, `D-08`

Do contrato onde o código existe nele; da aba no bloco final.

---

#### T-1242 — Teste de descrição ∥
**Tamanho:** P · **Ref:** `R-REL-07`

Caractere por caractere. Casos de referência: `12.029.00021.00` sai
`SOLUÇÃO DE ACESSO A REDE CORPORATIVA PMSP - 8192 KBPS…` e **não** `MPLS - 8 Mbps`;
`14.024.00005.00` **não** carrega `DESCONTANDO RECURSOS DE DESENVOLVIMENTO` na descrição.

---

#### T-1243 — Perfil/pacote derivado da aba ∥
**Tamanho:** P · **Ref:** `R-REL-08`, `D-03`

Medida não numérica → `1 / 1`. `V-REC-02` muda de mensagem.

---

#### T-1244 — Teste de perfil ∥
**Tamanho:** P · **Ref:** `R-REL-08`

Os 4 do piloto e os 5 do PMG saem `1 / 1`; item com medida numérica **não** vira perfil.

---

#### T-1245 — Separador de milhar sempre ∥
**Tamanho:** PP · **Ref:** `R-REL-09`

---

#### T-1284 — Teste do separador ∥
**Tamanho:** PP · **Ref:** `R-REL-09` · **Depende de:** T-1245

`14.023.00002.00` sai `1.500`. O âncora não pega isto — compara quantidade, não grafia.

---

#### T-1249 — Portão: os dois pares geram `[portão P3]`
**Tamanho:** P · **Ref:** `P3` · **Depende de:** T-1239 … T-1284 · **Bloqueia:** T-1246

T-1214, T-1215, T-1216, T-1219 e T-1270 **verdes**. Piloto 58, PMG 58 com 0 bloqueantes e 4
avisos.

**Pronto quando:** P3 fechado. **Só então a T-1246 começa.**

---

#### T-1246 — Sai `infrastructure/catalog/` ⛔
**Tamanho:** P · **Ref:** `R-REL-10` · **Depende de:** T-1249

`catalogo_padrao.json`, `default_catalog.py`, `xlsx_catalog_reader.py`,
`domain/entities/catalog_entry.py`. `V-CAT-01` sai junto — nunca foi achado, e sim conferência de
chave duplicada na leitura.

---

#### T-1285 — Sai do container ∥
**Tamanho:** PP · **Ref:** `R-REL-10` · **Depende de:** T-1246

`Entradas.catalogo` e a leitura de catálogo em `gerar()`.

---

#### T-1286 — Sai da API ∥
**Tamanho:** P · **Ref:** `R-REL-10` · **Depende de:** T-1246

Campo `catalogo` do formulário em `routers/reports.py` e a gravação em `uploads.py`.

---

#### T-1287 — Sai o `seed_catalog.py` ∥
**Tamanho:** PP · **Ref:** `R-REL-10` · **Depende de:** T-1246

Mais as referências em `README.md` e em `scripts/`.

---

#### T-1288 — Saem `v_ctr_02` e `v_cat_02` ∥
**Tamanho:** PP · **Ref:** ESPEC §8.1 · **Depende de:** T-1246

---

#### T-1247 — Saem os testes da categoria MORRE
**Tamanho:** P · **Ref:** T-1209 · **Depende de:** T-1246

Os 19 de arquivo inteiro mais os 2 nominais de `test_extractor_contract.py`. **Só os do
inventário.**

---

#### T-1248 — As 24 asserções de extração intactas `[portão P4]`
**Tamanho:** PP · **Ref:** `P4` · **Depende de:** T-1247

`git diff` de `test_extractor_contract.py` mostra **apenas** a remoção dos dois testes de
`V-CTR-02`. As 24 asserções de extração sem uma linha alterada.

**Pronto quando:** P4 fechado.

---

## 9. Épico E6 — O conjunto e a documentação `[portão P5]`

#### T-1250 — Retirar o âncora posicional antigo
**Tamanho:** PP · **Ref:** §1.1 regra 4 · **Depende de:** T-1249

Com o novo verde. Tarefa nomeada, não efeito colateral.

---

#### T-1253 — Reconciliar o âncora da análise ∥
**Tamanho:** M · **Ref:** ESPEC §10

`test_anchor_analise.py`: o universo cresceu e as quatro situações mudam de contagem. Os números
novos vêm da regra, não da saída — cada situação recontada a partir do conjunto novo.

---

#### T-1251 — Suíte verde e reconciliada `[portão P5]`
**Tamanho:** P · **Ref:** `P5`, T-1213

Verde **e** batendo com o inventário: `405 − MORRE + novos = total`. Verde sem reconciliar não
fecha o portão.

---

#### T-1289 — Medir o tempo da suíte ∥
**Tamanho:** PP · **Ref:** `K-14`

Linha de base: ~9 min para 405. Registrar o novo, para o dia em que alguém perguntar.

---

#### T-1252 — Qualidade ∥
**Tamanho:** PP · **Ref:** `P5`

`ruff`, `mypy`, `bandit` limpos. `test_architecture.py` verde **sem alteração**.

---

#### T-1254 — Emenda à ESPEC 001 ∥
**Tamanho:** P

Registrar a revogação de `R-CAT-01`, `R-CTR-01` e `R-DIV-05`.

---

#### T-1255 — ESPEC 018 → implementada ∥
**Tamanho:** P

Com as emendas de execução e o desdobramento da fase F em E2 e E6 (PLANO 018 §6.1).

---

#### T-1256 — README ∥
**Tamanho:** P

O catálogo sai de "Entradas"; "Estado atual" e "Limitações" atualizados; **linhas de ESPEC 017 e
018 na tabela de incrementos, hoje ausentes**.

---

#### T-1257 — CHANGELOG e fechamento deste backlog ∥
**Tamanho:** P

Resultado, desvios e o inventário fechado.

---

## 10. Inventário da suíte

> Preenchido pela **E1**, antes de qualquer alteração em `src/`. É contra esta seção que a T-1251
> reconcilia.

> Levantado por análise sintática dos testes, não a olho. A contagem aqui é de
> **funções `test_*`** — 308. A suíte coleta 423 casos, porque parametrização
> multiplica algumas.

### 10.1 MORRE — 21 funções

| Arquivo | Funções | Motivo |
|---|---|---|
| `test_catalog_seed.py` | 12 | `scripts/seed_catalog.py` sai |
| `test_default_catalog.py` | 6 | `catalogo_padrao.json` sai |
| `test_extractor_contract.py` | 2 | `test_v_ctr_02_todo_o_catalogo_visivel_resolve`, `test_v_ctr_02_bloqueia_codigo_fora_do_contrato` |
| `test_cascata_de_validacoes.py` | 1 | `test_t1119_contrato_legivel_com_codigo_ausente_ainda_bloqueia` — é teste de `V-CTR-02` |

### 10.2 MUDA — 32 funções

| Arquivo | Funções | O que muda |
|---|---|---|
| `test_divergences.py` | 7 | 4 de seção · 3 de `sem_previsao` |
| `test_reconciliation.py` | 7 | 3 de seção · 4 de catálogo |
| `test_api_e2e.py` | 6 | 3 de campo `catalogo` · 3 de `sem_previsao` |
| `test_domain.py` | 3 | `ReportSection` e chave de reconciliação |
| `test_analise.py` | 3 | `sem_previsao` no universo da análise |
| `test_reader_measurement.py` | 2 | leitor de catálogo (`test_catalogo_carrega_ordenado`, `test_catalogo_com_aba_errada_falha`) |
| `test_xlsx_analise.py` | 2 | `sem_previsao` e aba vazia |
| `test_cascata_de_validacoes.py` | 1 | `test_t1118` — a contagem de achados muda |
| `conftest.py` | — | `fontes_caras` e `caminho_catalogo` |

### 10.3 INTOCÁVEL — 100 funções

`test_extractor_contrato_pgm.py` · `test_grade_contrato.py` · `test_docx_anexos.py` ·
`test_anexos_configuracao.py` · `test_figuras.py` · `test_aba_reader.py` ·
`test_dado_pessoal.py` · `test_architecture.py` · `test_desconto_desenvolvimento.py`,
mais as **24** asserções de extração de `test_extractor_contract.py`.

### 10.4 Falsos positivos da varredura, conferidos e descartados

Registrados porque descartá-los em silêncio é como se apaga cobertura:

| Teste | Marca | Por que **não** muda |
|---|---|---|
| `test_extractor_contract.py` — 6 testes de `quantidade_para` | contratada | `Contract.quantidade_para` **sobrevive**: a `V-REC-01` continua confrontando as duas fontes. O que muda é quem alimenta a linha, não o acessor |
| `test_reader_measurement.py::test_planilha_sem_a_aba_levantamento_falha` | catálogo | Casou por substring; é teste da aba `Levantamento` |
| `test_api_e2e.py::test_pdf_falso_e_recusado` e `::test_arquivo_corrompido…` | catálogo | Usam o campo `catalogo` só para montar o formulário; a asserção é sobre o PDF |

### 10.5 Reconciliação

```
MORRE 21 + MUDA 32 + INTOCÁVEL 100 + não afetados 155 = 308 funções
```

---

## 11. Insumos

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **K-13** | A capa do documento do PGM (`I-01`) | Antes da entrega ao PGM | Não bloqueia P5. **Bloqueia o uso**: o documento sai com `TC 52/SMIT/2024` na capa |
| **K-14** | Janela de ~9 min para a suíte completa | T-1251 | P5 não fecha. Rodar subconjunto e declarar verde é como a suíte de um-só-PDF: verdadeira e insuficiente |
| **K-15** | Resposta ao `I-05` — houve aditivo depois de 11/11/2025? | — | Decide se `D-05` está certa |
| **K-16** | **O DOCX aberto no Word**, piloto e PMG | Antes da E4 terminar | Não bloqueia P5, e é o insumo que mais importa — ver §12 |

---

## 12. A lista do `K-16` — o que quem abrir o Word vai conferir

A ESPEC 003 registrou seis defeitos de DOCX que a suíte inteira não pegou até alguém abrir o
arquivo. Esta entrega muda a **estrutura** do documento.

- [ ] Não há nenhuma faixa de grupo ou seção a partir da página 2
- [ ] O cabeçalho de colunas aparece **uma vez por página**, e não some na virada
- [ ] A ordem das linhas é a do contrato
- [ ] O bloco `DEMAIS ITENS DO LEVANTAMENTO` está ao final, com a mesma moldura
- [ ] `14.023.00002.00` sai **`1.500`**, com separador
- [ ] As descrições são as do contrato — `SOLUÇÃO DE ACESSO…`, não `MPLS - 8 Mbps`
- [ ] Nenhuma descrição carrega `DESCONTANDO RECURSOS DE DESENVOLVIMENTO`
- [ ] `14.046.00003.00` do PMG sai com a célula de contratada **vazia**, não `0`
- [ ] Larguras de coluna, capa, timbrado e rodapé **idênticos** aos de hoje
- [ ] Os 19 anexos abrem e paginam como antes

---

## 13. O que este backlog não faz

- **Não promete "nenhum teste reescrito".** 19 morrem por decisão e 2 vivem no arquivo-âncora da
  extração. A promessa é as 24 asserções de extração intactas e os 147 INTOCÁVEIS sem uma linha.
- **Não toca extração.** Nem `grid.py`, nem `pdfplumber_extractor.py`.
- **Não toca layout físico.** `D-10`, T-1238 e 57 testes de anexo como prova.
- **Não restaura agrupamento a partir da aba.** `D-07` — caminho pronto, decisão de negócio.
- **Não consolida contrato mais aditivos.** Causa raiz do `I-05`, fora do escopo.
- **Não corrige a capa fixa.** `K-13`, espec própria.
- **Não abre a planilha em modo completo.** `D-09` corrige o crivo, não a abertura.
- **Não introduz dependência nova.**
