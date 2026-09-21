# TASKS 034 — Backlog de "O órgão que vem antes da frase"

| | |
|---|---|
| **Especificação** | [ESPEC 034](../specs/034-o-orgao-que-vem-antes-da-frase.md) v1.0 |
| **Plano** | [PLANO 034](../plans/034-plano-o-orgao-que-vem-antes-da-frase.md) v1.0 |
| **Versão** | 1.0 — 2026-08-27 |
| **Total** | 25 tarefas · 4 portões · 4 insumos em aberto |
| **Status** | **Concluído** — 2026-08-27. **25 de 25 tarefas**, portões `P0` a `P3`. Backend **1.458 → 1.482 passed**, zero falhas. Os quatorze campos de capa do piloto e do PGM intactos, nenhum artefato reancorado. A `T-2231` foi reescrita no `P0` por passar pelo motivo errado |

> **Escrito antes da implementação.** A §10 é a única seção que não pode ser escrita agora, e é a
> que a próxima entrega vai ler.

---

## 1. Convenções

**Identificadores** `T-22nn`, continuando de `T-2222`, a última da ESPEC 033.

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`python -m pytest` verde — **com o `-m`**, e **sem `--timeout`**, que este projeto não tem
instalado.

**Convenção de commit** `<tipo>(T-22nn): descrição`. Correção de derivação é `fix(...)`; fixture
nova é `test(...)`. **Nunca os dois no mesmo commit.**

### 1.1 Quatro regras que atravessam este backlog

**1 — A linha de base é ESTA árvore, e não o `HEAD`.** A ESPEC 033 está aqui inteira e não foi
commitada. Medir "antes" contra `git show HEAD:` mediria um mundo em que o `aditivo_smul.pdf` nem
sequer extrai — e em que a régua de capa do par SMUL não existe.

*O sinal no diff:* um valor "de antes" copiado de `git show HEAD:...`, ou uma comparação que
pressuponha o `contrato_smul.pdf` fora da suíte.

**2 — Nenhum campo de capa do piloto ou do PGM se move.** São sete campos por par, congelados na
`T-2226`. Esta entrega só pode alcançar documentos cuja derivação **falha** hoje.

*O sinal no diff:* qualquer alteração em `_SIGLA`, em `subtitulo_da_capa`, em `cliente_da_capa` ou
na cascata de `R-CAP-10`.

**3 — O nome do cliente nunca contém a contratada.** Medido: o alargamento por `entre a` captura
`… - SMUL E A EMPRESA TECNOLOGIA … (PRODAM) PARA A PRESTAÇÃO DE SERVIÇOS DE "SUSTENTAÇÃO…"`. O
terminador do sintagma é a **sigla**, nunca o ponto.

*O sinal no diff:* um `\.` ou um `$` fechando o padrão do órgão; ou uma captura preguiçosa até fim
de frase.

**4 — `V-CAP-01` não se remove.** Ela deixa de disparar em documento conhecido, e continua
necessária: é o alarme do dia em que aparecer um órgão fora do vocabulário (`D-04`).

*O sinal no diff:* `v_cap_01_cliente_nao_derivado` saindo do módulo ou do registro no contêiner.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** Linha de base, régua e inventário | T-2223 … T-2227 | **P0** | F0 |
| **E1** Os testes, escritos antes | T-2228 … T-2234 | **P0** | F1 |
| **E2** O identificador, com o aviso de pé | T-2235 … T-2238 | **P1** | F2 |
| **E3** O órgão | T-2239 … T-2242 | **P2** | F3 |
| **E4** As duas suítes | T-2243 … T-2247 | **P3** | F4 |

### 2.1 A régua da entrega — o que pode mudar de comportamento

| Muda | Não muda |
|---|---|
| `contrato_smul.pdf`: `cliente` de `''` para `SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO` | O `cliente` das outras seis peças — inclusive os dois `''` do `aditivo_pgm` e do `modelo` |
| `contrato_smul.pdf`: `proposta` de `''` para `PC-SMUL-240916-136` | O identificador das outras seis peças |
| `PA-PGM-260818-201`: passa a derivar o órgão | Os sete campos de capa do piloto e do PGM (`T-2226`) |
| `aditivo_smul.pdf`: passa a derivar o órgão — efeito colateral, nada o consome | `Contract.aplicar`, que usa o `cliente` da **proposta** (`T-1420`) |
| Capa do par SMUL: `cliente`, `proposta_origem`, `propostas`, e o silêncio de `V-CAP-01` | Os sete `sha` de extração da ESPEC 033 — esta entrega não toca a grade |
| `README.md`, `CHANGELOG.md`, o `Status` da ESPEC 034 | `.docx`, `.xlsx`, `CORPO_DO_PILOTO_*`, `linhas_do_documento.json`, `_SIGLA`, `R-CAP-10` |

---

## 3. Épico E0 — Linha de base, régua e inventário `[portão P0]`

> **Nenhum arquivo de `src/` é tocado neste épico.**

#### T-2223 — As cinco buscas, nas duas suítes `[risco]`
**Tamanho:** PP · **Ref:** PLANO §8, regra 2

Quatro sobre `backend/tests/`: `_cliente|cliente_da_capa|R-CAP-04`; `V-CAP-01`;
`_proposta|proposta_origem|propostas`; `sha256`.

**Uma sobre `frontend/e2e/`**: `SECRETARIA|PROCURADORIA|PA-SMIT|PA-PGM|propostas`.

**A busca 3 tem doze módulos, e a maioria não é âncora.** A citação de `propostas` costuma ser
construção de cenário, não asserção — distinguir uma da outra **exige abrir o arquivo**. Foi o que a
`T-2168` da ESPEC 032 fez com o `derivadas.spec.ts`, e foi o que evitou um falso positivo.

**Pronto quando:** o inventário está fechado por escrito, com arquivo, linha e o que cada âncora
afirma, e a tabela da ESPEC §8.2 reflete o achado.

> **Executada — 2026-08-27.**
>
> **`backend/tests/`** — buscas 1 e 2: tudo em `test_capa.py`, e **tudo sobre o
> piloto e o PGM**: `:356` (os dois separadores de sigla), `:386` (o cliente
> sobrevive ao aditivo), `:421-462` (a cascata), `:470` e `:485` (`V-CAP-01`).
> Busca 3: as asserções de identificador são cinco — `test_analise.py:286`,
> `test_consolidacao_aditivos.py:468-469` e `:521`, `test_reconciliation.py:99`,
> `test_capa.py:464` —, e as cinco são dos dois pares. Busca 4: as âncoras de
> `sha256` de sempre.
>
> **`frontend/e2e/`** — três citações, e **nenhuma é âncora do nome do cliente**:
> `documento.spec.ts:99` e `:129` afirmam a mensagem de recusa do `modelo.pdf`,
> que lista as propostas **citadas** pelo arquivo errado (`_REFERENCIA`,
> intocada); `estados.ts:83` é literal de cenário. Foi preciso abrir os arquivos —
> a busca sozinha teria dado três falsos positivos.

---

#### T-2224 — Linha de base das duas suítes `[risco]`
**Tamanho:** PP · **Ref:** PLANO, Estado inicial, regra 1

Backend: `python -m pytest -q`, esperado `1.458 passed` **nesta árvore**. Navegador:
`npx playwright test`, com o backend no ar em `127.0.0.1:8000`.

**O navegador já entra com um vermelho conhecido:** `a11y-estrutura.spec.ts:252 › T-543 —
14.049.00054.00 aparece na lista e na triagem`, o `I-06` do TASKS 033 — provado pré-existente e
determinístico, e de outra entrega. Registrar o conjunto exato **antes**, para que a `T-2244` possa
separar herdado de novo.

**Duas armadilhas de operação, aprendidas na `T-2219`:** matar a tarefa de fundo **não** mata o
`uvicorn`; e um servidor que não consegue ligar em `:8000` deixa a suíte rodar contra o processo
antigo, com o código anterior em memória. Conferir a **porta**, e não a tarefa.

**Pronto quando:** os dois números e a lista de falhas estão neste documento.

> **Executada — 2026-08-27.** Medida no fechamento da ESPEC 033, **nesta
> árvore**, e nada de código mudou entre lá e aqui:
>
> - **Backend: `1.458 passed, 1 warning in 1010.23s`**, zero falhas;
> - **Navegador: `119 passed, 1 failed` em 17,6 min.** A falha é
>   `a11y-estrutura.spec.ts:252 › T-543 — 14.049.00054.00 aparece na lista e na
>   triagem`, o `I-06` do TASKS 033 — determinística, provada pré-existente e de
>   outra entrega. **É a lista contra a qual a `T-2244` compara.**

---

#### T-2225 — O vocabulário de `R-CAP-11`
**Tamanho:** PP · **Ref:** ESPEC `I-01`, `D-04`

Fechar a lista de palavras institucionais com quem conhece a carteira de clientes da PRODAM.
Medidas por documento real: **`Secretaria`** e **`Procuradoria`**. As demais entram por antecipação.

**Não bloqueia**, e é o que a `D-04` garante: palavra ausente **degrada para o comportamento de
hoje** — `V-CAP-01` avisa e a capa usa o subtítulo. O custo de uma lista incompleta é o custo de
hoje; o de uma lista aberta seria nome errado.

**Pronto quando:** a lista está registrada aqui, com a marca de quais palavras têm documento real e
quais são antecipação.

> **Executada — 2026-08-27, e o insumo continua aberto.**
>
> A lista entrou com nove palavras: **`Secretaria`** e **`Procuradoria`** com
> documento real; `Coordenadoria`, `Subprefeitura`, `Autarquia`, `Fundação`,
> `Agência`, `Instituto` e `Companhia` por antecipação, marcadas como tal no
> comentário de `_VOCABULARIO_DE_ORGAO`.
>
> **Não bloqueou, e a `D-04` é o que permite isso:** palavra ausente degrada para
> o comportamento de hoje. O `I-01` segue aberto para quem conhece a carteira.

---

#### T-2226 — Congelar a régua de capa `[portão]`
**Tamanho:** PP · **Ref:** **P1**, **P2**, regras 1 e 2

Medir **nesta árvore** e registrar. Este é o "antes" desta entrega.

O esperado, medido em 2026-08-27:

| peça | `cliente` | `proposta` |
|---|---|---|
| `contrato.pdf` | `SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA` | `PA-SMIT-260319-739` |
| `contrato_pgm.pdf` | `PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO` | `PA-PGM-251015-159` |
| `aditivo_pgm.pdf` | `''` | `PA-PGM-260304-715` |
| `contrato_smul.pdf` | `''` | `''` |
| `aditivo_smul.pdf` | `''` | `PA-SMUL-250314-22` |
| `modelo.pdf` | `''` | `''` |
| `PA-PGM-260818-201` | `''` | `PA-PGM-260818-201` |

| campo de capa | piloto | pgm |
|---|---|---|
| `cliente_da_capa` | `SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA` | `PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO` |
| `proposta_origem` | `PA-SMIT-260319-739` | `PA-PGM-251015-159 e PA-PGM-260304-715` |
| `propostas` | `('PA-SMIT-260319-739',)` | `('PA-PGM-251015-159', 'PA-PGM-260304-715')` |
| `contrato_referencia` | `TC 52/SMIT/2024` | `TC 015/PGM/2024` |
| `subtitulo_da_capa` | `SMIT SUSTENTAÇÃO` | `PGM TC 015` |

**Os dois `''` do `aditivo_pgm` e do `modelo` são resultado**, e não ausência de medição: são o que
prova que a regra nova não "acha órgão" onde não há.

**Pronto quando:** as duas tabelas batem, valor por valor, nesta árvore.

> **Executada — 2026-08-27.** As duas tabelas saíram idênticas às deste
> documento, valor por valor, **nesta árvore**.

---

#### T-2227 — O canário da ESPEC 033
**Tamanho:** PP · **Ref:** **P3**

`python scripts/medir_extracao.py`: os sete `sha` da ESPEC 033. Esta entrega **não toca a grade**, e
é isso que a régua da entrega anterior afirma de graça.

Se um `sha` se mover aqui, o defeito não é desta espec — é sinal de que a árvore não é a que a
`T-2197` mediu.

**Pronto quando:** os sete idênticos aos da ESPEC 033 §8.2.

**Verificação:** `P0` (primeira metade).

> **Executada.** Os sete `sha` idênticos aos da ESPEC 033 §8.2.

---

## 4. Épico E1 — Os testes, escritos antes `[portão P0]`

#### T-2228 — Os cinco nomes, por extenso
**Tamanho:** P · **Ref:** `R-CAP-11`, `R-CAP-14`

Um caso por peça, com o nome literal:

```
contrato.pdf        SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA
contrato_pgm.pdf    PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO
contrato_smul.pdf   SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO
aditivo_smul.pdf    SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO
PA-PGM-260818-201   PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO
```

**Os dois últimos são os que hoje falham, e um deles não é do SMUL** — o `PA-PGM-260818-201` escreve
`prestação de serviços de sustentação de TIC para a`, com o objeto no meio. Sem ele, a entrega
pareceria uma correção para um documento só.

**Pronto quando:** existem e reprovam com **`''`** no lugar do nome — não com `ImportError`.

> **Executada — 5 casos, e três reprovaram contra esta árvore**, que é o
> esperado: `aditivo_pgm_2`, `contrato_smul` e `aditivo_smul`, todos com `''` no
> lugar do nome. Os dois que já derivavam passaram desde o início.
>
> **A decisão do `I-03` foi versionar o `PA-PGM-260818-201`** como
> `aditivo_pgm_2.pdf` (`620360a7f20a3963`, 11.346 bytes). Sem ele, a entrega
> pareceria uma correção para um documento só — e a terceira linha desta tabela é
> a única prova de que o defeito não é do SMUL.

---

#### T-2229 — Os dois vazios
**Tamanho:** PP · **Ref:** `R-CAP-15`

`aditivo_pgm.pdf` e `modelo.pdf` continuam devolvendo `''`.

O primeiro é o `test_t1418_o_aditivo_nao_traz_a_frase`, que já existe e **tem de continuar verde**: a
página 1 dele não nomeia órgão nenhum. O segundo é o PDF que não é proposta.

**São o contrapeso de `T-2228`.** Uma regra que derive nome de qualquer página passaria nos cinco de
cima e falharia nestes dois — e ninguém olharia.

**Pronto quando:** existem e **passam já**.

> **Executada — 2 casos, e passaram já.** O `aditivo_pgm.pdf` continua sem
> nomear órgão na página 1, e o `modelo.pdf` continua não sendo proposta. São o
> contrapeso da `T-2228`, e é neles que uma regra frouxa apareceria.

---

#### T-2230 — O teste que pega o alargamento ingênuo `[risco]`
**Tamanho:** PP · **Ref:** `R-CAP-12`, regra 3, ESPEC §2.4

O nome derivado do `contrato_smul.pdf` **não contém** `PRODAM`, `Empresa` nem `Prestação`.

Medido: capturar depois de `entre a` até o ponto produz

```
SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO - SMUL E A EMPRESA TECNOLOGIA DA
INFORMAÇÃO E COMUNICAÇÃO DO MUNICÍPIO DE SÃO PAULO (PRODAM) PARA A PRESTAÇÃO DE
SERVIÇOS DE "SUSTENTAÇÃO DE INFRAESTRUTURA DE TIC"
```

— a contratada dentro do nome do cliente, na capa de um documento que vai ao órgão.

**Passa já, e passa depois — e é assim que ele funciona.** Hoje o nome é vazio, e vazio não contém
`PRODAM`. Depois é o órgão, e também não. **É o único teste que reprova a versão ingênua da regra.**

**Pronto quando:** existe e passa contra esta árvore.

> **Executada — 4 casos, e passaram já**, como o backlog previa: hoje o nome do
> `PC-SMUL` é vazio, e vazio não contém `PRODAM`; depois é o órgão, e também não.
> Continua sendo o único teste que reprova a versão ingênua da regra.

---

#### T-2231 — A ambiguidade não escolhe
**Tamanho:** PP · **Ref:** `R-CAP-13`, `D-03`

Caso construído, sem abrir PDF: duas ocorrências do **mesmo** nome derivam — é o caso do piloto, que
tem duas —; dois nomes **distintos** devolvem `''`.

`R-CAP-10` sabe menos e erra menos: uma página que fale de dois órgãos não diz qual é o cliente, e a
capa cai para o subtítulo com `V-CAP-01` avisando.

**Pronto quando:** existe e reprova contra esta árvore por a regra não existir.

> **Executada, e a primeira versão dela não servia `[risco]`.**
>
> O caso de ambiguidade usava `…e a Procuradoria … para a prestação.` — texto que
> a `R-CAP-04` **não casava**, porque ela exige `prestação de serviços para`.
> Resultado: o teste passava contra esta árvore e não provava nada. Um teste que
> passa pelo motivo errado não é régua.
>
> Reescrito com a frase-gatilho no lugar. Agora a regra antiga captura até o ponto
> e devolve os **dois órgãos concatenados** — `SECRETARIA … - SMUL E A
> PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO`, um nome que não é de ninguém —, e
> o teste reprova. É a mesma família de defeito da `T-2230`, com dois órgãos no
> lugar da contratada.
>
> O caso do órgão citado duas vezes passa nas duas árvores: é invariante, não
> discriminante. Registrado como tal.

---

#### T-2232 — `R-DOC-11`
**Tamanho:** PP · **Ref:** `R-DOC-11`, `D-05`

Três asserções:

1. `contrato_smul.pdf` → `PC-SMUL-240916-136`;
2. as outras seis peças **inalteradas**, com os valores da `T-2226`;
3. o cabeçalho `Proposta Comercial PRODAM/DRM/GRC-3/NRC3 Nº 668` **não** é capturado — é o que os
   dois-pontos obrigatórios garantem.

**Pronto quando:** existe e reprova **só** no primeiro caso.

> **Executada — 8 casos, e reprovou só nos dois do `contrato_smul`**, que é o
> esperado: `AssertionError: assert '' == 'PC-SMUL-240916-136'`.

---

#### T-2233 — A régua de capa como asserção
**Tamanho:** P · **Ref:** `R-CAP-15`, regra 2, **P2**

Os sete campos de capa dos dois pares, congelados em constante no formato da `T-2226`.

**É o teste mais importante deste backlog.** É o único que separa *"passei a derivar o órgão do
SMUL"* de *"passei a derivar sem mexer em quem já derivava"* — e o campo em jogo é o mais visível do
documento que vai ao órgão.

**Pronto quando:** existe e **passa já**. Reprovar aqui significaria que a régua da `T-2226` não é a
desta árvore.

> **Executada — 2 testes, e passaram já.**
>
> O do PGM exigiu **expor o `Report`** na `ArtefatosDoPgm`: ele já era construído
> ali e descartado, e pedir uma segunda geração custaria os ~115 s que aquela
> fixture existe para não pagar duas vezes. Campo novo, `relatorio` — a
> alternativa era afirmar a capa do par com aditivo sem o par com aditivo.

---

#### T-2234 — O portão `[portão]`
**Tamanho:** PP · **Ref:** **P0**

Rodar tudo contra esta árvore e preencher a tabela do `P0`, teste a teste, com a asserção que cada
um acusou.

O esperado: `T-2228` e `T-2231` reprovam; `T-2229`, `T-2230` e `T-2233` **passam já**; `T-2232`
reprova só no `contrato_smul`.

> **Três dos seis passam antes de qualquer código, e isso é resultado.** Eles afirmam o que **não**
> muda. Reprovando aqui, a premissa da entrega estaria errada antes de começar.

**Verificação:** `P0`.

> **Executada — `P0` cumprido**, depois da correção da `T-2231`:
>
> | teste | contra esta árvore | motivo |
> |---|---|---|
> | `T-2228` | 3 de 5 reprovam | `''` no lugar do nome |
> | `T-2229` | passa | os dois vazios já são o comportamento |
> | `T-2230` | passa | vazio não contém `PRODAM` |
> | `T-2231` | 1 de 2 reprova | os dois órgãos concatenados |
> | `T-2232` | 2 de 8 reprovam | `'' == 'PC-SMUL-240916-136'` |
> | `T-2233` | passa | a capa dos dois pares é a de hoje |

---

## 5. Épico E2 — O identificador, com o aviso de pé `[portão P1]`

#### T-2235 — `_PROPOSTA` aceita a proposta comercial
**Tamanho:** PP · **Ref:** `R-DOC-11`, `D-05`

Passa a casar `Proposta Comercial:` além de `Proposta de Aditivo:`, com **dois-pontos
obrigatórios**.

A ESPEC 025 já **enunciara** o fato — criou `_DECLARA_PROPOSTA` porque *"uma proposta comercial
inicial não traz `Proposta de Aditivo:` em lugar nenhum"* —, mas alargou o **detector** e deixou o
**extrator** como estava. Esta tarefa fecha a metade que ficou.

**Pronto quando:** `T-2232` verde.

> **Executada.** `Proposta (?:Comercial|de Aditivo):` — sem a variante `2º`, que
> a medição mostrou desnecessária: o `PA-PGM-260818-201` diz `2º Aditivo` na
> **prosa** do objetivo, e `Proposta de Aditivo:` na linha que declara o código.

---

#### T-2236 — O aviso continua de pé, agora nomeando a peça `[portão]`
**Tamanho:** PP · **Ref:** **P1**, PLANO §1

`V-CAP-01` **ainda dispara** no par SMUL, e a mensagem passa de

```
o nome do órgão não foi derivado da proposta  — a capa identificará…
```

para

```
o nome do órgão não foi derivado da proposta PC-SMUL-240916-136 — a capa identificará…
```

**Aviso que já tenha calado aqui reprova a fase.** Terminar um épico com o defeito principal ainda
de pé é deliberado: é o que prova que o identificador foi corrigido **antes** de o aviso
desaparecer. Na ordem inversa, esta correção ficaria sem testemunha.

**Pronto quando:** a mensagem é exatamente essa, e o aviso continua na lista.

> **Executada — `P1` cumprido, e o portão pagou-se.** A mensagem passou a ser:
>
> ```
> o nome do órgão não foi derivado da proposta PC-SMUL-240916-136 —
> a capa identificará o cliente pelo título do levantamento
> ```
>
> **O aviso continua na lista**, que é o que esta fase tinha de provar: o
> identificador foi corrigido antes de o aviso desaparecer, e a correção tem
> testemunha.

---

#### T-2237 — A capa dos dois pares, intacta `[portão]`
**Tamanho:** PP · **Ref:** **P1**, regra 2

Os sete campos da `T-2226` idênticos, nos dois pares.

**O `propostas` do par SMUL cresce nesta fase** — de `('PA-SMUL-250314-22',)` para
`('PC-SMUL-240916-136', 'PA-SMUL-250314-22')` —, e com ele o `proposta_origem` e o rodapé de
`R-ADT-11`. É o efeito desejado: o rodapé passa a nomear as duas peças que formam o quantitativo.
O par SMUL não tem artefato ancorado.

**Pronto quando:** os quatorze valores batem.

> **Executada.** `T-2233` verde nos dois pares — os quatorze valores intactos.

---

#### T-2238 — O ganho de graça em `V-ADT-03`
**Tamanho:** PP · **Ref:** `R-DOC-11`

Registrar, sem teste novo: com identificador, a proposta passa a participar da contagem de peça
repetida — submetê-la duas vezes passa a ser detectado, o que hoje não acontece.

Nenhum documento real o exercita, e a validação já tem cobertura. **É registro, não trabalho.**

**Verificação:** `P1`.

> **Executada — registro, sem teste novo.** Com identificador, o
> `contrato_smul.pdf` passa a participar da contagem de `V-ADT-03`: submetê-lo
> duas vezes passa a ser detectado, o que hoje não acontece. Nenhum documento
> real o exercita.

---

## 6. Épico E3 — O órgão `[portão P2]`

#### T-2239 — `_CLIENTE` passa a ser o sintagma institucional
**Tamanho:** PP · **Ref:** `R-CAP-11` a `R-CAP-14`

O padrão deixa de ser *"capture depois da frase até o ponto"* e passa a ser *"ache o sintagma
institucional e corte na sigla"*. `_cliente()` ganha a regra de ambiguidade de `R-CAP-13`.

**`_SIGLA` não se mexe.** Ela já resolve a variação medida na ESPEC 020 §2.5 — `Tecnologia- SMIT`
sem espaço, `Paulo - PGM` com — e continua sendo aplicada por padrão, nunca por separador fixo.
Reescrevê-la aqui reabriria uma decisão que já tem caso real dos dois lados.

**O docstring precisa carregar as quatro redações medidas**, e não a regra abstrata: `para a`,
`de <objeto> para a`, `entre a`, `à`. Quem ler daqui a um ano tem de encontrar, no lugar da decisão,
a razão de a âncora ser o sintagma e não a preposição.

**Pronto quando:** `T-2228`, `T-2229`, `T-2230` e `T-2231` verdes.

> **Executada.** `_CLIENTE` passou a ser o vocabulário seguido de
> `[^.;]{0,90}?` e da sigla, e `_cliente()` passou a contar **nomes distintos**
> via `finditer`.
>
> `_SIGLA` não foi tocada — ela já resolve `Tecnologia- SMIT` sem espaço e
> `Paulo - PGM` com, e continua removendo por padrão. O `[^.;]` é o que impede o
> sintagma de atravessar pontuação de frase, e o quantificador preguiçoso é o que
> o faz parar no **primeiro** `- SIGLA`.

---

#### T-2240 — O aviso cala `[portão]`
**Tamanho:** PP · **Ref:** **P2**

`V-CAP-01` não dispara mais no par SMUL, e a capa dele passa a trazer
`SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO`.

**E a validação continua no código** (regra 4). Ela não dispara em documento conhecido — como a
`V-CTR-06` da ESPEC 032 e a `V-MED-04` da 031 — e é o alarme do dia em que aparecer um órgão fora do
vocabulário.

> **Executada — `P2` cumprido.** `V-CAP-01` **calou** no par SMUL: dos dois
> avisos, sobra o do `14.031.00023.00`, que é da `R-MED-02` e é pré-existente.
>
> A capa passou a trazer `SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO`, e o
> `proposta_origem` passou a `PC-SMUL-240916-136 e PA-SMUL-250314-22` — as duas
> peças que formam o quantitativo, que é o que a `R-ADT-11` sempre mandou.
>
> **A validação continua no código**, e continua registrada no contêiner
> (regra 4).

---

#### T-2241 — A capa dos dois pares, intacta de novo `[portão]`
**Tamanho:** PP · **Ref:** **P2**, regra 2

Os sete campos da `T-2226` pela segunda vez, e os sete `sha` da `T-2227`.

**Parece redundante depois da `T-2237`, e não é:** a `T-2239` mexeu na função que deriva o cliente de
**todos** os documentos, e é o cliente que a capa mostra.

> **Executada.** `test_capa.py` inteiro verde junto com o módulo novo — 57
> testes —, e os sete `sha` de extração idênticos.

---

#### T-2242 — O efeito colateral no aditivo do SMUL
**Tamanho:** PP · **Ref:** ESPEC `I-03`

O `aditivo_smul.pdf` passa a derivar o órgão, e hoje não deriva.

Nada consome o `cliente` de um aditivo: `Contract.aplicar` usa o da **proposta**, e a `T-1420` da
ESPEC 020 existe exatamente porque aquele campo sumia no caminho com aditivo. Um teste barato
afirmando que o cliente do par não muda por causa disso.

**Verificação:** `P2`.

> **Executada.** O `aditivo_smul.pdf` passou a derivar `SECRETARIA MUNICIPAL DE
> URBANISMO E LICENCIAMENTO`, e o par continua trazendo o cliente **da proposta**.
>
> A asserção é sobre a **origem**, e não sobre o valor: aqui os dois coincidem, e
> um teste de igualdade passaria mesmo se `aplicar` tivesse passado a usar o do
> aditivo.

---

## 7. Épico E4 — As duas suítes `[portão P3]`

#### T-2243 — Backend completo
**Tamanho:** PP · **Ref:** **P3**

`python -m pytest`. 1.458 na entrada mais os desta entrega; o número de saída vira **número
declarado**.

> **Executada — `1482 passed, 1 warning in 1256.03s`. Zero falhas.**
> 1.458 na entrada mais 24 desta entrega. **1.482 é o número declarado.**

---

#### T-2244 — Navegador completo `[risco]`
**Tamanho:** PP · **Ref:** **P3**

`npx playwright test`, com o backend no ar.

Comparar contra a lista da `T-2224`: falha nova reprova; o vermelho do `I-06` **não**, e ele é
determinístico — vai aparecer.

**Não deduzir que a suíte não se moveu.** Esta entrega muda o nome do cliente na capa, e a capa é
tela. Se algum estado do navegador for montado sobre um par que passe a derivar, a asserção muda.

> **Executada — `118 passed, 2 failed` em 15,6 min, e as duas são conhecidas.**
>
> 1. `a11y-estrutura.spec.ts:252 › T-543 — 14.049.00054.00…` — o `I-06` do
>    TASKS 033: determinística, pré-existente, provada de outra entrega;
> 2. `a11y-axe.spec.ts:38 › 390 px › divergenciaDeFonte` — **a intermitente do
>    `I-05`**, que o TASKS 032 descreveu com estas palavras: *"reprova em
>    execução completa, passa isolada"*. Reexecutada sozinha: **2 passed**.
>
> Nenhuma é desta entrega. A linha de base era `119 / 1`; a diferença é a
> intermitente, que o `I-05` já registra como aparecendo e sumindo entre
> execuções.
>
> **A armadilha da porta apareceu de novo, e desta vez com o mecanismo
> identificado `[risco]`.** O primeiro backend não conseguiu ligar
> (`Errno 10048`) e a porta continuava respondendo `200`. O processo que a
> segurava era um **worker `multiprocessing` órfão** —
> `spawn_main(parent_pid=20976)` —, filho do `uvicorn` da entrega anterior:
> matar o pai deixa o filho com o socket. Rodar a suíte ali teria medido o código
> **anterior**, com aparência de sucesso.
>
> O critério que funciona é o do log: `grep -c ERROR` no arquivo do servidor
> **antes** de rodar a suíte. Zero erros, e o backend é o seu.

---

#### T-2245 — Nada foi reancorado `[portão]`
**Tamanho:** PP · **Ref:** **P3**, regra 2

`test_capa.py`, `test_identidade_dos_artefatos.py`, `test_docx_formatacao.py`, `pacote.py` e
`linhas_do_documento.json` **intocados**.

**Cuidado com a leitura do `git diff`:** se a ESPEC 033 não tiver sido commitada, o diff traz as duas
entregas. Arquivo que aparece por causa da 033 **não** é reancoragem desta (PLANO §7).

> **Executada — `P3`.** O `git diff` de `backend/tests/` traz **87 inserções e 1
> deleção**, e a deleção é a linha do `@parametrize` de `test_domain.py`, que é da
> **ESPEC 033**. No `conftest.py`, só inserções.
>
> `test_capa.py`, `test_identidade_dos_artefatos.py`, `test_docx_formatacao.py`,
> `pacote.py` e `linhas_do_documento.json` **não aparecem no `git status`**.

---

#### T-2246 — `ruff` e `mypy`
**Tamanho:** PP · **Ref:** **P3**

Sobre os arquivos tocados. O `I001` de `test_divergencia_de_fonte.py` é anterior a esta entrega e às
anteriores; **não corrigir aqui**.

> **Executada.** `mypy src/` com `Success: no issues found in 55 source files`.
> `ruff` limpo nos arquivos desta entrega — o único achado é o `I001` de
> `test_divergencia_de_fonte.py`, anterior a esta entrega e às duas anteriores.

---

#### T-2247 — `README.md`, `CHANGELOG.md` e o `Status` da espec
**Tamanho:** PP

A linha do incremento 034; a entrada de rumo; e o `Status` da ESPEC 034 para **Implementada**, com
os números medidos.

A entrada do `CHANGELOG` tem de dizer o **achado estrutural**, que é o que explica a regra ter
nascido estreita: `contrato.pdf` e `contrato_pgm.pdf` são **aditivos**, e a `R-CAP-04` foi calibrada
sobre a gramática de aditivo. O `PC-SMUL-240916-136` é a primeira proposta comercial inicial a
entrar no campo de contrato em toda a história do repositório.

**Verificação:** `P3`.

> **Executada.** Linha do incremento 034 no `README.md`; entrada de rumo no
> `CHANGELOG.md`; `Status` da ESPEC 034 para **Implementada**.
>
> A entrada do `CHANGELOG` registra o **achado estrutural** como causa: as duas
> peças que calibraram a `R-CAP-04` são aditivos, e a gramática de aditivo não é
> a de proposta comercial.

---

## 8. Insumos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | O vocabulário de `R-CAP-11` tem documento real para `Secretaria` e `Procuradoria`; as demais palavras entram por antecipação. Quais órgãos da carteira não começam por nenhuma delas? | Não. Palavra ausente degrada para o comportamento de hoje (`D-04`), e `V-CAP-01` avisa |
| `I-02` | Existe capa em que o órgão apareça **sem** sigla? Aí `R-CAP-11` não fecha o sintagma | Não. Nenhuma das sete peças; e o resultado seria o de hoje |
| `I-03` | **O `PA-PGM-260818-201` não está versionado** — vive na pasta de teste do órgão. Ele é a segunda peça que hoje falha, e a única prova de que o defeito não é do SMUL | **Decidir na `F0`.** Ou entra como fixture, ou a `T-2228` fica com o caso marcado. É a única peça desta espec cuja disponibilidade não está resolvida |
| `I-04` | O `aditivo_smul.pdf` passa a derivar o órgão. Nada consome o `cliente` de um aditivo — vale afirmar isso como invariante permanente? | Não. `T-2242` cobre; o custo é um teste barato |

**Herdados, e não desta entrega:** o `I-04` do TASKS 033 — o hook de pré-commit casa
`SMIT.*Levantamento.*\.xlsx` e não pegaria a planilha do SMUL — e o `I-06` — a contradição entre
`a11y-estrutura.spec.ts:252` e `analise.spec.ts:183`, que deixa a suíte de navegador com um vermelho
permanente.

---

## 9. Emenda de execução

**2026-08-27.** Executado em ~2h30 de trabalho, mais duas execuções de suíte.

**O `P0` pegou um teste que passava pelo motivo errado, e essa foi a hora de pegá-lo.** O caso de
ambiguidade da `T-2231` usava um texto que a `R-CAP-04` **não casava** — ele passava contra a árvore
antiga sem provar nada. Reescrito com a frase-gatilho, a regra antiga passou a devolver os dois
órgãos concatenados, e o teste passou a discriminar. **Um teste que passa pelo motivo errado é pior
que um teste ausente**, porque parece cobertura.

**A ordem das duas correções pagou-se, como na ESPEC 033.** No fim do `E2` o `V-CAP-01` continuava
disparando — e nomeando a peça. Se ele tivesse calado ali, a correção do identificador teria entrado
sem testemunha, e ninguém saberia dizer qual das duas mudanças a produziu.

**A régua de capa passou antes do código, e é isso que ela tinha de fazer.** Os quatorze campos dos
dois pares foram congelados na `T-2226` e afirmados na `T-2233` — verde desde o primeiro instante,
porque esta entrega só podia alcançar documentos cuja derivação **falhava**. Foi reexecutada no `P1`
e no `P2`, e nunca se moveu.

**A decisão do `I-03` foi versionar o segundo documento que falhava.** Sem o `aditivo_pgm_2.pdf`, a
entrega pareceria uma correção para um documento só — e a regra voltaria a valer por uma amostra de
um, que é exatamente como a `R-CAP-04` nasceu estreita.

**A armadilha da porta reapareceu e agora tem mecanismo.** Não é *"o `uvicorn` sobrevive"*: é que ele
**deixa um worker `multiprocessing` órfão** segurando o socket quando o pai morre. O sintoma é cruel
— a porta responde `200`, e a suíte roda contra o código anterior com aparência de sucesso. O
critério confiável é `grep -c ERROR` no log do servidor antes de rodar a suíte.

**Resultado.** Backend **1.458 → 1.482 passed**, zero falhas. Navegador `118 / 2`, ambas conhecidas.
`ruff` e `mypy` limpos. Os quatorze campos de capa do piloto e do PGM intactos, os sete `sha` de
extração intactos, **nenhum artefato reancorado**. O par SMUL passa a trazer
`SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO` na capa, e `V-CAP-01` calou.
