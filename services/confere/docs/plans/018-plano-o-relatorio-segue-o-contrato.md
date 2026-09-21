# PLANO 018 — Implementação do Relatório Derivado do Levantamento

| | |
|---|---|
| **Especificação** | [ESPEC 018](../specs/018-o-relatorio-segue-o-contrato.md) v4.0 |
| **Versão** | 1.1 — 2026-08-14 — **executado**. Os seis portões fecharam; desvios no TASKS 018 §0 |
| **Estado inicial** | **405 testes coletados** (1,78 s de coleta; execução completa ~9 min) · `PA-PGM` extrai **47 itens com checksum `0,00`** e mesmo assim bloqueia com **45 achados**, 26 deles bloqueantes · `R-MED-02` **desligada no PMG**: 0 de 37 faixas reconhecidas |
| **Instrumento existente** | As medições da ESPEC 018 §2, todas reproduzíveis com o código de produção sobre os dois pares reais |

---

## 1. O princípio que ordena este plano

A ESPEC 017 pôde prometer uma coisa rara e verificá-la: **nenhum teste existente reescrito**. Foi
o que deu ao PLANO 017 o seu portão mais forte.

**Esta espec não pode prometer isso, e fingir que pode é o primeiro risco.** Ela retira um
subsistema inteiro — o catálogo — e troca a fonte das quantidades. Dezenove testes deixam de ter
objeto, e dois deles vivem *dentro* do arquivo-âncora da extração. Um plano que só descubra isso
na fase final vai negociar o critério de aceite sob pressão de entrega.

Daí a regra que ordena tudo:

> **O inventário vem antes do código.**
> Antes de tocar `src/`, a F1 produz a lista **nominal** dos testes que morrem por decisão, dos
> que mudam de asserção e dos que **não podem ser tocados**. Sem essa lista, "a suíte está verde"
> ao final não distingue *"preservamos o que importava"* de *"apagamos o que reclamava"*.

A segunda regra é a mesma da ESPEC 017, aplicada a um âncora novo:

> **O instrumento vem antes da correção, e tem de reprovar.**
> O âncora por código (`D-11`) é escrito na F2, contra o código intocado, e **tem de reprovar**.
> Um âncora escrito depois da mudança mede a mudança, não o modelo.

A terceira é o que esta espec tem de específico, e é o que justifica a ordem das fases:

> **A correção que não move número vem primeiro, e sai sozinha.**
> A `D-09` conserta um defeito que está no ar hoje, e o faz sem alterar uma única quantidade nos
> dois pares reais. É a única fase cujo portão é uma **identidade**, é a mais barata, e é
> publicável antes de qualquer decisão sobre a ESPEC 018. Se o resto do plano parar por decisão
> de negócio, a F0 já terá valido.

E uma quarta, que decorre da ESPEC 003:

> **Alguém abre o Word.**
> A suíte de DOCX releu por meses o que ela mesma escrevia e deixou seis defeitos passarem até
> alguém abrir o arquivo. Este plano muda a **estrutura** do documento — tira faixas, muda ordem,
> acrescenta bloco. Nenhuma asserção sobre XML substitui um par de olhos. É o `K-16`.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — A regra do desconto vale, e nada se move** | Fim da F0 | Piloto: conjunto de faixas **idêntico**, 35 = 35, linha por linha. PMG: **0 → 37** faixas, e os 9 códigos repetidos resolvidos **pela marca**, não pelo atalho. **Nenhuma quantidade muda em nenhum dos dois pares.** Suíte verde nos 405 | A correção mexeu em comportamento. Parar — esta fase existe justamente por não dever mover nada |
| **P1 — O inventário está fechado** | Fim da F1 | Lista nominal, conferida contra a suíte, das três categorias: **morre** (19+2), **muda de asserção**, **intocável**. Soma bate com 405 | Não começar a F3. Sem inventário não há critério de aceite |
| **P2 — O novo âncora reprova** | Fim da F2 | O âncora por código **reprova contra o código atual**, e pelo motivo certo: 55 linhas onde se esperam 58, com a família `10.050` ausente e o bloco final inexistente | O âncora está errado, ou o entendimento do alvo está. Descobrir agora |
| **P3 — Os dois pares geram** | Fim da F5 | Piloto: **58 linhas** (54 + 4). PMG: **58 linhas** (45 + 13), **0 bloqueantes, 4 avisos**, documento gerado. Mesmo código, sem catálogo e sem parâmetro de contrato | Não entregar. É o critério de aceite da ESPEC 018 §9.3 |
| **P4 — O que não devia mudar não mudou** | Fim da F5 | As **24** asserções de extração de `test_extractor_contract.py` intactas; `test_extractor_contrato_pgm.py`, `test_grade_contrato.py`, `test_docx_anexos.py`, `test_anexos_configuracao.py`, `test_figuras.py`, `test_aba_reader.py`, `test_dado_pessoal.py` e `test_architecture.py` **sem uma linha alterada** | O escopo vazou. `D-10` é a regra violada |
| **P5 — O conjunto** | Fim da F6 | Suíte verde; `ruff`, `mypy`, `bandit` limpos; contagem final reconciliada contra o inventário da F1 | Não entregar |

**P0 é o portão que não depende de nenhuma decisão de negócio.** Ele fecha com a espec inteira
ainda em discussão, e a fase que ele encerra pode ir para produção sozinha.

**P4 é o `D-10` sob prova.** A tentação de "arrumar de passagem" largura de coluna, capa ou anexo
é máxima justamente nesta espec, porque o renderizador está aberto na F4.

---

## 3. Fases

### F0 — A regra do desconto passa a valer `[portão]`

**Objetivo:** corrigir um defeito de produção sem mover nenhuma quantidade. **Independente de
todo o resto do plano; publicável sozinha.**

| # | Tarefa | Ref. |
|---|---|---|
| T-1200 | Fixture `levantamento_blocos_invertidos.xlsx` — `DESCONTANDO RECURSOS DE DESENVOLVIMENTO` **acima**, `TOTAL DE RECURSOS` abaixo, com a faixa **mesclada** como na planilha da PGM | `D-09` |
| T-1201 | **Rodar T-1200 contra o código atual e exigir que reprove**: hoje o atalho *"vale a última lida"* escolheria o valor cheio | **P0** |
| T-1202 | `_e_titulo_de_bloco` reescrita: faixa é a linha cujas células preenchidas carregam **o mesmo texto** | `R-REL-11`, `D-09` |
| T-1203 | **[portão]** Teste de identidade: no piloto, o conjunto de linhas reconhecidas como faixa é **igual, linha por linha**, ao de hoje — 35 e 35 | **P0** |
| T-1204 | Teste: no PMG, 37 faixas reconhecidas, e `bloco_titulo` não vazio nos 68 itens | `R-REL-11` |
| T-1205 | Teste: os 9 códigos repetidos do PMG resolvem pela variante `DESCONTANDO`, e os 13 do piloto seguem resolvendo | `R-MED-02` |
| T-1206 | **[portão]** Teste de invariância de valor: para os dois pares, `item_para(codigo).medida` é **idêntica** antes e depois — os valores esperados vêm registrados nominalmente, não recalculados | **P0** |
| T-1207 | `v_med_03_desconto_por_posicao` (`AVISA`): código repetido resolvido pela última ocorrência, sem variante `DESCONTANDO` identificada | ESPEC §8.2 |
| T-1208 | Teste: `V-MED-03` dispara na fixture de T-1200 sem marca, e **não** dispara em nenhum dos dois pares reais | ESPEC §9.2 |

**Verificação:** P0. T-1201 reprova antes, passa depois; T-1203 e T-1206 provam que nada mais se
moveu.

> **A T-1206 é a que parece redundante e é o portão.** É tentador confiar em que "corrigir o
> reconhecimento da faixa não muda valor" — e é verdade **hoje**, porque a planilha da PGM lista o
> desconto embaixo. A asserção existe para o dia em que não for. Os valores esperados têm de ser
> escritos à mão a partir da planilha, nunca copiados da saída do código: um teste que compara o
> código consigo mesmo não é invariância, é tautologia.

> **A T-1200 é a fixture que não existia, e é a razão de o defeito ter atravessado a planilha
> inteira da PGM sem ninguém ver.** Ela precisa ter a faixa **mesclada** — uma fixture com o
> título em coluna única passa nos dois códigos e não prova nada.

**Tamanho:** PP — três horas. **Encerra:** P0.

---

### F1 — O inventário da suíte `[portão]`

**Objetivo:** saber, nominalmente, o que morre. **Nenhum arquivo de `src/` é tocado.**

| # | Tarefa | Ref. |
|---|---|---|
| T-1209 | Inventário categoria **MORRE**: `test_catalog_seed.py` (12) e `test_default_catalog.py` (7) inteiros; `test_extractor_contract.py::test_v_ctr_02_todo_o_catalogo_visivel_resolve` e `::test_v_ctr_02_bloqueia_codigo_fora_do_contrato` (linhas 167 e 185) | `R-REL-10` |
| T-1210 | Inventário categoria **MUDA**: os testes de `test_reconciliation.py`, `test_divergences.py`, `test_cascata_de_validacoes.py`, `test_domain.py`, `test_analise.py`, `test_xlsx_analise.py`, `test_api_e2e.py` e `test_docx_estrutura.py` que afirmam seção, agrupamento, `sem_previsao_contratual` ou quantidade contratada vinda do contrato | §5 |
| T-1211 | Inventário categoria **INTOCÁVEL**, nominal por arquivo (§5.3) | **P4** |
| T-1212 | **[portão]** A soma das três categorias reconcilia com os 405 coletados | **P1** |
| T-1213 | Registrar o inventário no TASKS 018, com o número de cada categoria. É contra ele que a F6 confere | **P1**, **P5** |

**Verificação:** P1.

> **Esta fase não produz código e é a mais importante do plano.** Sem ela, o desfecho previsível é
> alguém, na F6, diante de 40 testes vermelhos, decidir caso a caso o que "já não fazia sentido" —
> que é exatamente como se apaga cobertura sem perceber. O inventário transforma essa decisão em
> algo tomado **antes**, a frio, e revisável.

**Tamanho:** P — duas horas. **Encerra:** P1.

---

### F2 — O novo âncora, e ele reprova `[portão]`

**Objetivo:** poder afirmar, ao final, que o documento continua certo. **Nenhum arquivo de `src/`
é tocado.**

| # | Tarefa | Ref. |
|---|---|---|
| T-1214 | Âncora por código do piloto: para cada código, a **quantidade medida** é a do modelo GRC. Lido do PDF do modelo, não transcrito | `D-11` |
| T-1215 | Asserção de conjunto: os códigos do documento são os da aba **menos** a família `10.050` — 58 no piloto | `R-REL-01`, `R-REL-06` |
| T-1216 | Asserção de ordem: as 54 primeiras linhas seguem a ordem de aparição no contrato; as 4 restantes estão no bloco final | `R-REL-03` |
| T-1217 | As duas divergências de `D-11` declaradas **no teste**, com o motivo: `11.027.00001.00` (aditivo × modelo) e `14.025.00011.00` (consolidação de qualificador) | `D-11` |
| T-1218 | **[portão]** Rodar contra o código atual e exigir que reprove: 55 linhas onde se esperam 58, sem bloco final | **P2** |
| T-1219 | Âncora do PMG: 58 linhas, 45 + 13, 0 bloqueantes, 4 avisos, documento gerado | ESPEC §9.2 |
| T-1220 | **O âncora antigo continua rodando.** Só é retirado na F6, e a retirada é tarefa própria | §4 |

**Verificação:** P2. T-1218 reprova, e pelo motivo certo.

> **A T-1220 é o que impede o pior desfecho deste plano.** O âncora posicional antigo é a única
> rede que denuncia mudança de número nas fases F3 a F5. Retirá-lo cedo — e há tentação, porque
> ele vai ficar vermelho assim que a F4 tirar as faixas — é ficar sem medição justamente na fase
> em que o documento muda. Ele sai **por tarefa nomeada**, na F6, com o novo já verde.

**Tamanho:** M — meio dia. **Encerra:** P2.

---

### F3 — O universo passa a ser a aba

**Objetivo:** inverter o laço. É a fase de maior raio de alcance.

| # | Tarefa | Ref. |
|---|---|---|
| T-1221 | `GenerateMeasurementReport.executar` passa a iterar **os códigos da aba**, um por código, resolvidos por `item_para` | `R-REL-01`, `R-REL-02` |
| T-1222 | As duas quantidades passam a sair de `MeasurementItem` — `contratada` e `medida` (`R-CTR-01` revogada) | `R-REL-04`, `D-05` |
| T-1223 | Sai o registro de `V-CAT-03`, hoje emitido dentro de `_medida` | ESPEC §8.1 |
| T-1224 | `v_ctr_05_codigo_contratado_ausente_da_aba` (`AVISA`) — preserva a metade útil da `V-CAT-03` | ESPEC §8.2 |
| T-1225 | `v_rec_01` perde os `continue` de `exibir` e `qualificador` e inverte a mensagem | `R-REL-12`, `D-05` |
| T-1226 | Teste: `14.024.00006.00` do PMG sai com contratada `9.000,89`, não `6.100,00`; e a análise o classifica como **divergente**, não crítico | `D-05` |
| T-1227 | Teste: o PMG produz 4 `V-REC-01`, incluindo `10.050.00001.00` — contrato 42.260,00 × aba 42.814,01 | `R-REL-12` |
| T-1228 | Teste: `V-CTR-05` dispara em fixture com código contratado ausente da aba; não dispara nos dois pares | ESPEC §9.2 |
| T-1229 | Atualizar os testes da categoria **MUDA** do inventário que afirmam quantidade contratada vinda do contrato | T-1210 |

**Verificação:** os âncoras de F2 ainda reprovam — falta a ordem, o bloco e as exclusões. O
âncora antigo mede o estrago e é consultado, não consertado.

> **A T-1222 é onde um erro silencioso é mais provável.** `MeasurementItem.contratada` devolve
> `Decimal | None`, e `None` não é zero: `14.046.00003.00` do PMG tem a célula **vazia**, não
> zerada. Tratar `None` como `0` põe "contratada 0" num documento onde o correto é a célula em
> branco — e a análise classificaria como *medido acima do contratado* um item sobre o qual a
> planilha nada afirma.

**Tamanho:** M — meio dia.

---

### F4 — Ordem do contrato, bloco final e o fim das faixas

**Objetivo:** o documento assume a forma nova.

| # | Tarefa | Ref. |
|---|---|---|
| T-1230 | A ordem passa a ser a posição do código na tabela de itens do contrato | `R-REL-03`, `D-02` |
| T-1231 | `Report.demais_itens` — códigos que o contrato não traz, na ordem da aba | `R-REL-03`, `D-06` |
| T-1232 | `docx_renderer`: somem as faixas de grupo e de seção; o cabeçalho de colunas passa a **um por página** | `R-REL-05` |
| T-1233 | `docx_renderer`: o bloco `DEMAIS ITENS DO LEVANTAMENTO` ao final, com o mesmo desenho de tabela das demais linhas | `D-06` |
| T-1234 | `ReportSection` sai de `domain/entities/report.py`; `Report.linhas` vira lista direta | ESPEC §7 |
| T-1235 | `api/schemas.py` e `ResultadoPanel`/`DivergenciaGrid`: deixam de agrupar por seção; a resposta ganha o bloco final | ESPEC §7 |
| T-1236 | Teste: o DOCX do piloto não contém nenhuma faixa de grupo ou seção, e o cabeçalho aparece uma vez por página | `R-REL-05` |
| T-1237 | Atualizar os testes da categoria **MUDA** que afirmam seção e `sem_previsao_contratual` | T-1210 |
| T-1238 | **[risco]** Conferir que largura de coluna, capa, timbrado, rodapé e anexos não mudaram — `git diff` restrito às funções de faixa | **P4**, `D-10` |

**Verificação:** T-1216 (ordem) passa. `test_docx_anexos.py` e `test_anexos_configuracao.py`
verdes **sem alteração** — 57 testes que provam que o escopo não vazou.

> **A T-1238 é o `D-10` sob prova, e o renderizador estará aberto.** Tirar a faixa é mexer na
> montagem da tabela, e a coluna de descrição já é 24 pt mais estreita que o modelo por uma
> decisão anterior. Qualquer "ajuste ao mesmo tempo" desta fase fica indistinguível da mudança
> pedida, e não há teste que separe um do outro depois.

**Tamanho:** M — meio dia.

---

### F5 — As quatro regras de linha, e o catálogo sai `[portão]`

**Objetivo:** fechar o comportamento e remover o subsistema.

| # | Tarefa | Ref. |
|---|---|---|
| T-1239 | `FAMILIAS_FORA_DO_DOCUMENTO = frozenset({"10.050"})`, com o motivo no comentário. Fora do **documento**, dentro da **comparação** | `R-REL-06`, `D-04` |
| T-1240 | Teste: nenhum `10.050.*` no documento, **e** os três continuam avaliados por `V-REC-01` | `R-REL-06` |
| T-1241 | Descrição e unidade do **contrato** onde o código existe nele; da aba no bloco final | `R-REL-07`, `D-08` |
| T-1242 | Teste: a descrição de toda linha ordenada pelo contrato é a do contrato, caractere por caractere; as do bloco final são as da aba | `R-REL-07` |
| T-1243 | Perfil/pacote derivado da aba: medida não numérica → `1 / 1`. `V-REC-02` muda de mensagem | `R-REL-08`, `D-03` |
| T-1244 | Teste: os 4 perfis do piloto e os 5 do PMG saem `1 / 1`; item com medida numérica **não** vira perfil | `R-REL-08` |
| T-1245 | Separador de milhar sempre. `14.023.00002.00` passa a sair `1.500` | `R-REL-09` |
| T-1246 | **Sai** `infrastructure/catalog/` inteiro, `domain/entities/catalog_entry.py`, `scripts/seed_catalog.py`, `Entradas.catalogo`, o campo `catalogo` da API e as validações `v_ctr_02` e `v_cat_02` | `R-REL-10` |
| T-1247 | Saem os testes da categoria **MORRE** do inventário — 19 arquivos-inteiros mais os 2 nominais de `test_extractor_contract.py` | T-1209 |
| T-1248 | **[portão]** As **24** asserções de extração de `test_extractor_contract.py` intactas | **P4** |
| T-1249 | **[portão]** T-1214, T-1215, T-1216 e T-1219 passam. Os dois pares geram 58 linhas | **P3** |

**Verificação:** P3 e P4.

> **A T-1246 é irreversível na prática, e por isso vem depois de T-1249 estar verde.** Retirar o
> catálogo com o âncora novo ainda vermelho deixa o projeto sem nenhuma referência: o antigo já
> não passa por construção, e o novo ainda não passa por defeito. Ordem importa mais aqui do que
> em qualquer outra tarefa do plano.

> **A T-1245 muda uma célula do documento do piloto** — `1500` vira `1.500`. É consequência
> declarada de `D-06` da espec, e o âncora novo não a pega, porque compara quantidade e não
> grafia. Precisa estar no `K-16`, na lista do que quem abrir o Word vai conferir.

**Tamanho:** M — meio dia. **Encerra:** P3 e P4.

---

### F6 — O conjunto, o âncora antigo e a documentação `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-1250 | **Retirar o âncora posicional antigo**, com o novo verde. Tarefa nomeada, não efeito colateral | T-1220 |
| T-1251 | Suíte completa verde. Contagem final **reconciliada contra o inventário da F1** — não basta verde, tem de bater | **P5**, T-1213 |
| T-1252 | `ruff`, `mypy`, `bandit` limpos. `test_architecture.py` verde **sem alteração** | **P5** |
| T-1253 | Âncora da análise (`test_anchor_analise.py`) reconciliado: o universo cresceu, e os números das quatro situações mudam | ESPEC §10 |
| T-1254 | ESPEC 001: emenda registrando a revogação de `R-CAT-01`, `R-CTR-01` e `R-DIV-05` | ESPEC, cabeçalho |
| T-1255 | ESPEC 018 → implementada, com as emendas de execução | — |
| T-1256 | README: o catálogo sai de "Entradas"; "Estado atual" e "Limitações" atualizados; linhas de ESPEC 017 e 018 na tabela de incrementos, hoje ausentes | — |
| T-1257 | CHANGELOG e TASKS 018 com resultado, desvios e o inventário fechado | — |

**Tamanho:** P — quatro horas. **Encerra:** P5.

---

## 4. Sequência

```
F0 ──────────────────────────────────────►  publicável sozinha
P0

        F1 ──► F2 ──► F3 ──► F4 ──► F5 ──► F6
        P1     P2                   P3·P4   P5
    (inventário)(âncora        (os dois pares)(conjunto)
                 reprova)
```

**A F0 não depende de nada e nada depende dela.** Corrige defeito de produção, não move
quantidade, e pode ir ao ar enquanto a ESPEC 018 ainda é discutida. Se o resto parar, ela fica.

F1 e F2 não tocam `src/` e poderiam correr em paralelo com a F0. Da F3 em diante é linear: cada
fase deixa o âncora novo menos vermelho, e nenhuma o deixa verde antes da F5.

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | 2,5 a 3 dias |
| — só a F0 | 3 horas |

---

## 5. A regressão que já está escrita

Lida no repositório, não presumida. **405 testes em 25 arquivos.**

### 5.1 Dezenove testes morrem por decisão, e dois moram no arquivo errado

| Arquivo | Testes | Destino |
|---|---|---|
| `test_catalog_seed.py` | 12 | **Morre inteiro** — `scripts/seed_catalog.py` sai |
| `test_default_catalog.py` | 7 | **Morre inteiro** — `catalogo_padrao.json` sai |
| `test_extractor_contract.py` | **2 de 26** | `test_v_ctr_02_todo_o_catalogo_visivel_resolve` (l. 167) e `test_v_ctr_02_bloqueia_codigo_fora_do_contrato` (l. 185) |

**Os dois últimos são a razão de a §1 recusar a promessa da ESPEC 017.** `test_extractor_contract.py`
é o contrato de não-regressão da extração, e tem dentro dele dois testes de uma validação que esta
espec remove. A promessa correta não é *"nenhum teste reescrito"* — é **"as 24 asserções de
extração permanecem intactas"**, que é o que a T-1248 verifica.

### 5.2 Onde o raio de alcance é maior

Contagem de menções por arquivo, medida:

| Arquivo | testes | `catalog` | seção/grupo | `sem_previsao` | `V-CTR-02`/`V-CAT` |
|---|---|---|---|---|---|
| `test_reconciliation.py` | 28 | 12 | 3 | 0 | 1 |
| `test_divergences.py` | 26 | 0 | 7 | 6 | 0 |
| `test_analise.py` | 27 | 0 | 2 | 9 | 0 |
| `test_domain.py` | 40 | 3 | 7 | 0 | 1 |
| `test_api_e2e.py` | 16 | 10 | 0 | 5 | 0 |
| `test_cascata_de_validacoes.py` | 7 | 10 | 2 | 2 | 2 |
| `test_docx_estrutura.py` | 13 | 0 | — | — | — |
| `conftest.py` | — | 4 | 0 | 0 | 0 |

`test_divergences.py` e `test_analise.py` são os que mais mudam sem que o catálogo apareça neles:
afirmam **agrupamento** e **`sem_previsao_contratual`**, e `D-06` altera os dois.

### 5.3 O que não pode ser tocado — 143 testes

| Arquivo | Testes | Por quê sobrevive |
|---|---|---|
| `test_extractor_contract.py` | **24 de 26** | Esta espec não altera extração |
| `test_extractor_contrato_pgm.py` | 6 | idem |
| `test_grade_contrato.py` | 13 | idem — é a cobertura da ESPEC 017 |
| `test_docx_anexos.py` | 32 | Anexos fora do escopo (`D-10`) |
| `test_anexos_configuracao.py` | 25 | idem |
| `test_figuras.py` | 9 | idem |
| `test_aba_reader.py` | 16 | Leitura de abas não muda |
| `test_dado_pessoal.py` | 6 | Sanitização não muda |
| `test_architecture.py` | 16 | O domínio continua sem framework |

**São 147 testes que provam que o escopo não vazou** — é a metade forte do P4.

### 5.4 A cadeia que quebra tudo de uma vez

`conftest.py` monta `fontes_caras` em escopo de sessão, com quatro menções ao catálogo. Dela
derivam DOCX, XLSX de análise, grid, reconciliação e API.

Mudar a assinatura dessa fixture sem cuidado quebra **~250 testes de uma vez e longe da causa**.
A F3 deve alterá-la mantendo o nome e a aridade dos itens que sobrevivem, e a remoção do parâmetro
de catálogo é tarefa da F5, não da F3.

### 5.5 O que **nada** pega

| O que | Por quê |
|---|---|
| O documento sem faixas ficar ilegível ou feio no Word | Nenhuma asserção sobre XML julga leiturabilidade. É o `K-16` |
| `1500` virar `1.500` no piloto | O âncora novo compara quantidade, não grafia. Só quem abrir o arquivo vê |
| A decisão de `D-05` estar errada — a aba não ser a fonte vigente | É questão documental, não de código. `K-15` |
| O bloco final crescer demais num contrato futuro | Não há terceiro par para medir |

---

## 6. Um acerto à ESPEC 018

Seguindo a conduta da ESPEC 007 §13 e do PLANO 017 §6.

### 6.1 A §12 da espec ordenou as fases certo, e omitiu duas que não são código

A ESPEC 018 §12 lista seis fases e acerta ao pôr a correção da faixa em primeiro e o âncora em
último, pelos motivos declarados. Este plano preserva as duas pontas.

O que a espec não previu é que **entre a correção e a primeira mudança de desenho cabem duas
fases sem código**: o inventário (F1) e o âncora escrito para reprovar (F2).

Não é lacuna de escopo, é de ordem — e é a mesma que o PLANO 017 §6.1 apontou na ESPEC 017. Lá a
fixture do segundo contrato estava listada na fase final, junto com "os testes"; aqui o âncora
novo está na fase F, pelo mesmo raciocínio. Em ambos os casos o efeito é o mesmo: sem o
instrumento antes, um teste verde ao final não distingue *"consertamos"* de *"escrevemos o teste
com o número que o código deu"*.

Emenda a aplicar na T-1255: a fase F da espec se desdobra em F2 (o âncora escrito e reprovando) e
F6 (o antigo retirado, o novo verde).

### 6.2 A espec diz "2 a 3 dias" sem contar o inventário

Com F1 e F2 explícitas, o total sobe para **2,5 a 3 dias**. A diferença é pequena e vale
declarar, porque é o tipo de meia diária que costuma ser cortada primeiro e é a que sustenta o
critério de aceite.

---

## 7. O que pode dar errado, e o que pega

| O que pode dar errado | O que pega | Quando |
|---|---|---|
| **Apagar teste que reclamou, em vez do que perdeu objeto** | **T-1212 e T-1251** — o inventário fechado antes e reconciliado depois. Sem ele, nada pega | F5 · F6 |
| Tratar `contratada is None` como zero | **T-1226** parcialmente; o caso `14.046.00003.00` do PMG precisa de teste próprio. Ver alerta da F3 | F3 |
| Retirar o âncora antigo cedo, porque fica vermelho na F4 | **T-1220 e T-1250** — a retirada é tarefa nomeada da F6 | F4 |
| Arrumar largura, capa ou anexo "de passagem" | **T-1238** e os 57 testes de anexo verdes sem alteração | F4 |
| O âncora novo nascer com o número que o código deu | **T-1218** — ele tem de reprovar antes, com 55 onde se esperam 58 | F2 |
| A correção da faixa mover alguma quantidade | **T-1203 e T-1206** — identidade de faixas e invariância de valor | F0 |
| `V-MED-03` nascer ruidosa e ser desligada | **T-1208** — não dispara em nenhum dos dois pares reais | F0 |
| Quebrar `fontes_caras` e ver 250 testes vermelhos sem causa aparente | Nada automático. §5.4 é o aviso; a mitigação é alterar a fixture na F3 e só remover o catálogo na F5 | F3 |
| **O documento sair correto e ilegível** | **Nada automático.** `K-16` | F4 · F5 |
| A decisão de `D-05` mascarar consumo a descoberto | Nada automático. `V-REC-01` mantém visível; a resposta é documental (`K-15`) | — |

As três linhas de "nada automático" são as caras. A do inventário porque decide se a entrega
preserva cobertura ou a apaga; a do Word porque é a lição já paga uma vez pela ESPEC 003; a de
`D-05` porque é decisão de negócio que nenhum teste pode julgar.

---

## 8. Insumos

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **K-13** | **A capa do documento do PGM** (`I-01` da espec). Hoje sai com `TC 52/SMIT/2024` gravado | Antes da entrega ao PGM | Não bloqueia P5. **Bloqueia o uso**: o PMG passa a gerar documento, e o documento sai com o contrato de outro órgão na capa. É espec própria, imediatamente depois desta |
| **K-14** | Janela de ~9 min para a suíte completa | T-1251 | P5 não fecha. Rodar subconjunto e declarar verde é exatamente como a suíte de um-só-PDF: verdadeira e insuficiente |
| **K-15** | Resposta ao `I-05` — houve aditivo depois de 11/11/2025 alterando NAS, internet, licenças E5 ou horas de especialista no `TC 15/PGM/2024`? | — | Não bloqueia a entrega. Decide se `D-05` está certa: pela aba, o `14.024.00006.00` deixa de ser item crítico |
| **K-16** | **O DOCX aberto no Word por quem confere** — piloto e PMG, com atenção a: ausência de faixas, ordem do contrato, bloco final, `1.500` com separador, e as descrições vindas do contrato | Fim da F5 | Não bloqueia P5, e é o insumo que mais importa. A ESPEC 003 registrou seis defeitos de DOCX que a suíte inteira não pegou até alguém abrir o arquivo — e esta espec muda a estrutura do documento |

`K-16` é a diferença entre "os testes passam" e "o documento serve". Vale agendar antes de
começar a F4, não depois de terminar a F5.

---

## 9. O que este plano não faz

- **Não promete "nenhum teste reescrito".** Dezenove morrem por decisão e dois vivem dentro do
  arquivo-âncora da extração (§5.1). A promessa é outra e é verificável: **as 24 asserções de
  extração permanecem intactas**, e 147 testes de extração, grade, anexos, figuras e arquitetura
  não são tocados.
- **Não toca a extração.** Nem `grid.py`, nem `pdfplumber_extractor.py`. O contrato continua
  sendo lido exatamente como a ESPEC 017 o deixou, e o checksum segue bloqueando.
- **Não mexe em capa, timbrado, rodapé, largura de coluna, fonte ou anexos.** `D-10`, com T-1238
  e 57 testes de anexo como prova.
- **Não restaura o agrupamento a partir da aba.** É `D-07`: tecnicamente disponível, descartado
  por decisão de negócio, e registrado como caminho pronto se algum órgão recusar.
- **Não consolida contrato original mais aditivos.** É a causa raiz do `I-05` e continua fora, como
  na ESPEC 001.
- **Não corrige a capa fixa.** `K-13` — espec própria, e bloqueia a entrega ao PGM, não esta.
- **Não abre a planilha em modo completo.** `D-09` corrige o crivo, não a abertura: 1,7 s e o
  arquivo inteiro em memória seriam pagos para tratar o sintoma.
- **Não introduz dependência nova.** `openpyxl` e `pdfplumber` já entregam tudo o que as regras
  novas precisam.
