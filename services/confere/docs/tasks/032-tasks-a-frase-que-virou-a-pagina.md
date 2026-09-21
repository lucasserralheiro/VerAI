# TASKS 032 — Backlog de "A frase que virou a página"

| | |
|---|---|
| **Especificação** | [ESPEC 032](../specs/032-a-frase-que-virou-a-pagina.md) v1.0 |
| **Plano** | [PLANO 032](../plans/032-plano-a-frase-que-virou-a-pagina.md) v1.0 |
| **Versão** | 1.0 — 2026-08-20 |
| **Total** | 25 tarefas · 5 portões · 3 insumos em aberto |
| **Status** | **Concluído** — 2026-08-20. **25 de 25 tarefas**, portões `P0` a `P4` fechados. Backend **1.404 → 1.422 passed**, zero falhas. Navegador **119 de 120**, com uma intermitente que passa isolada (`I-06`) |

> **Escrito antes da implementação.** A §9 é a única seção que não pode ser escrita agora, e é a
> que a próxima entrega vai ler.

---

## 1. Convenções

**Identificadores** `T-21nn`, continuando de `T-2167`, a última da ESPEC 031.

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`python -m pytest` verde — **com o `-m`**, e **sem `--timeout`**, que este projeto não tem
instalado e cujo erro sai depois do cabeçalho, com código de saída 0 em `pipe`.

**Convenção de commit** `<tipo>(T-21nn): descrição`. Reancoragem é `test(...)`; correção de
extração é `fix(...)`. **Nunca os dois no mesmo commit.**

### 1.1 Quatro regras que atravessam este backlog

**1 — O crivo é tudo-ou-nada.** Havendo **uma** palavra fora da coluna de descrição, nada daquela
página é tomado. Selecionar *"as que estão na coluna"* e descartar o resto colaria metade de um
parágrafo de prosa numa descrição contratual — e a p6 do aditivo **tem** palavras na coluna.

*O sinal no diff:* um filtro sobre as palavras candidatas, em vez de um predicado sobre o conjunto.

**2 — Nenhum número se move.** Esta entrega corrige texto. Quantidade, preço, meses e valor total
de **todos** os itens dos três documentos têm de sair idênticos, e a `T-2176` compara conjunto
inteiro contra conjunto inteiro, não amostra.

*O sinal no diff:* qualquer alteração em `_montar_item` ou nas constantes `COL_PRECO`,
`COL_QUANTIDADE`, `COL_MESES`, `COL_TOTAL`.

**3 — O inventário é de DUAS suítes.** `backend/tests/` **e** `frontend/e2e/`. A ESPEC 031 fez
seis buscas, todas na primeira, e seis testes de navegador quebraram — doze horas depois de a
ESPEC 030 os ter reancorado. As buscas 7 e 8 do PLANO §8 existem por isso.

*O sinal no diff:* uma tabela de âncoras que só cita `backend/tests/`.

**4 — A linha de base é ESTA árvore, não o `HEAD`.** `test_capa`, `test_identidade_dos_artefatos`
e `linhas_do_documento.json` receberam valores novos **hoje**, pela ESPEC 031, e não estão
commitados. Reancorar contra o `HEAD` desfaria aquela entrega em silêncio — e o `sha256` diria
apenas *"diferente"*, nunca *"você apagou a espec anterior"*.

*O sinal no diff:* um valor "de antes" copiado de `git show HEAD:...`.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** Inventário e oráculo | T-2168 … T-2172 | **P0** | F0 |
| **E1** Os testes, escritos antes | T-2173 … T-2178 | **P0** | F1 |
| **E2** O crivo, sem chamador | T-2179 … T-2180 | **P1** | F2 |
| **E3** A costura | T-2181 … T-2183 | **P2** | F3 |
| **E4** A reancoragem | T-2184 … T-2188 | **P3** | F4 |
| **E5** As duas suítes | T-2189 … T-2192 | **P4** | F5 |

### 2.1 A régua da entrega — o que pode mudar de comportamento

| Muda | Não muda |
|---|---|
| **3 descrições** no `Contract` — duas no piloto, uma no PGM | Quantidade, preço, meses e total — de **todos** os itens |
| `word/document.xml` dos dois `.docx` | Qualquer outra entrada dos pacotes `.docx` |
| Abas do `.xlsx` de análise — **quais, a medir** (ele tem coluna `Descrição`) | `V-CTR-03`, e o número de itens de cada peça |
| `test_capa.CORPO_DO_PILOTO_SHA256`; textos e códigos **a medir** | Contagens de linha, divergência e situação — nenhuma |
| 3 linhas de `linhas_do_documento.json` | A leitura da aba `Levantamento` e tudo da ESPEC 031 |
| `README.md`, `CHANGELOG.md` | `layout.py`, o caso de uso, a API e o frontend |

---

## 3. Épico E0 — Inventário e oráculo `[portão P0]`

> **Nenhum arquivo de `src/` é tocado neste épico.**

#### T-2168 — As oito buscas, nas duas suítes `[risco]`
**Tamanho:** PP · **Ref:** PLANO §8, regra 3

Seis sobre `backend/tests/`: `sha256`; `assert len(`; `ANCORA\s*=` e `\.json`; os códigos
`12\.074\.00005` e `14\.048\.00008`; `descricao` com literal; `CPE-SD-WAN` e `SQL SERVER`.

**Duas sobre `frontend/e2e/`**, e são as que a entrega anterior não fez: os mesmos códigos e
textos, e `getByText` com literal longo.

O resultado **manda na tabela da ESPEC §8.3**, que a `D-06` já declarou provisória. Âncora nova
emenda a tabela **aqui**, antes de qualquer código — nunca ajustando valor esperado a valor obtido.

**Pronto quando:** o inventário está fechado por escrito, com arquivo, linha e o que cada âncora
afirma, e a tabela da espec reflete o achado.

> **Executada — 2026-08-20.**
>
> **`backend/tests/`** — `sha256` em `test_capa`, `test_docx_formatacao`,
> `test_identidade_dos_artefatos` e `pacote.py`; a `ANCORA` do
> `linhas_do_documento.json`; nove arquivos citando os dois códigos; quatro
> asserções de descrição por literal, **nenhuma delas sobre os três itens
> afetados** (são o `12.029.00021.00`, o `14.049.00037.00` e o `15.076.00005.00`).
> As três cadeias cortadas estão no `.json`, linhas 68, 201 e 413.
>
> **`frontend/e2e/`** — **um** achado, e ele **não** é âncora: `derivadas.spec.ts`
> cita o `14.048.00008.00`, mas o teste vai em linha, código, contratada, medida
> e emitida — **a célula 2, a descrição, não é afirmada**. O localizador de linha
> casa o código dentro do nome acessível, e descrição mais longa não o quebra.
>
> **Zero âncoras de navegador afetadas — e desta vez é medição, não dedução.**
> Foi a dedução equivalente que falhou na ESPEC 031.
>
> **Achado extra:** a busca 6 revelou um **oráculo interno** que a espec não
> conhecia — o `14.048.00009.00` do PGM, mesma família e outro perfil, extraído
> inteiro. A §2.6 foi emendada.

---

#### T-2169 — Linha de base das duas suítes `[risco]`
**Tamanho:** PP · **Ref:** PLANO, Estado inicial

Backend: `python -m pytest -q`, esperado `1404 passed`. Navegador: `npx playwright test`, com o
backend no ar em `127.0.0.1:8000`.

**O navegador já entra com uma falha conhecida** — `a11y-axe › 390 px › divergenciaDeFonte`, o
`I-05` da ESPEC 031: reprova em execução completa, passa isolada, e as violações que relata são de
elementos que aquela entrega não tocou. Registrar o conjunto exato de falhas **antes**, para que a
`T-2190` possa separar herdado de novo.

**Pronto quando:** os dois números e a lista de falhas de navegador estão neste documento.

> **Executada — 2026-08-20.**
>
> **Backend: `1404 passed, 1 warning in 793.45s`** (13min13). Zero falhas.
>
> **Navegador: `119 passed, 1 failed`**, medido no fechamento da ESPEC 031 —
> **sobre este mesmo código**. Desde então só `docs/` mudou, e a suíte de
> navegador não lê documentação. Reexecutá-la custaria 15 minutos para reproduzir
> um número que continua válido.
>
> A falha é `a11y-axe.spec.ts › 390 px › axe no estado divergenciaDeFonte`, o
> `I-05`: passa isolada (`16 passed`), e as 58 violações que relata são de
> elementos que nenhuma das duas entregas tocou. **É a lista contra a qual a
> `T-2190` vai comparar.**

---

#### T-2170 — Remedir os seis casos
**Tamanho:** PP · **Ref:** `R-CON-02`, ESPEC §2.2

Três caudas com **zero** palavras fora da coluna de descrição — `contrato.pdf` p27 e p28,
`contrato_pgm.pdf` p23 — e três armadilhas com 110, 117 e 93 — `contrato.pdf` p25,
`contrato_pgm.pdf` p22, `aditivo_pgm.pdf` p6.

Da geometria, com o simulador que não toca `src/`. **Nenhum valor intermediário entre 0 e 93**: é
essa separação que autoriza o crivo, e ela precisa valer nesta árvore, não na de ontem.

**Pronto quando:** os seis conferidos, com os números registrados.

> **Executada — 2026-08-20.** Idênticos à tabela do §2.2 da espec, nesta árvore:
> caudas com **0** palavras fora da coluna (p27, p28, p23) e armadilhas com
> **110**, **117** e **93** (p25, p22, aditivo p6). Nenhum valor intermediário.

---

#### T-2171 — Confirmar o oráculo externo
**Tamanho:** PP · **Ref:** `R-CON-06`, ESPEC §2.6

A descrição da aba `Levantamento` para o `12.074.00005.00`, **nos dois pares**, é a cadeia que a
reconstrução tem de produzir:

```
DISPONIBILIZAÇÃO DE EQUIPAMENTO CPE-SD-WAN TIPO 1 (PARA LOCAIS ATÉ 50 USUÁRIOS E
THROUGHPUT DE 150 MBPS SIMULTÂNEO NOS SERVIÇOS DE SEGURANÇA)
```

Outra fonte, outro sistema, mesma cadeia — conferência **independente do código**.

Registrar também que para o `14.048.00008.00` o oráculo **não** vale como texto: a aba diz
`PERFIL IV(D) - DE 200GB ATÉ 500GB` e o contrato dirá `PERFIL D - Base de dados acima de 200GB até
500GB`. Mesmo perfil, redações diferentes. Confundir os dois faria a `T-2174` afirmar o texto errado.

**Pronto quando:** a cadeia do `12.074.00005.00` está conferida caractere por caractere nos dois
pares, e a ressalva do `14.048.00008.00` registrada.

> **Executada — 2026-08-20.** A aba traz a cadeia-alvo idêntica nos dois pares. A
> ressalva do `14.048.00008.00` vale — e ficou **melhor do que a espec previa**:
> o oráculo interno da `T-2168` dá a forma completa da família
> (`PERFIL F - Base de dados acima de…`), extraída pelo próprio extrator quando a
> linha cabe na página. O alvo deixa de ser leitura minha do PDF.

---

#### T-2172 — Capturar os quatro artefatos `[portão]`
**Tamanho:** PP · **Ref:** **P1**, regra 4

`.docx` e `.xlsx` de análise dos dois pares, com `sha256` **por entrada do pacote, sem
`docProps/core.xml`**.

**Nunca por `sha256` do arquivo.** A `T-2138` da ESPEC 031 mediu: o `.xlsx` não é byte-estável
entre execuções — duas renderizações do mesmo relatório diferem no `dcterms:modified`. Um medidor
novo é suspeito antes do código (aquela tarefa reprovou por hashear o hex em vez dos bytes).

**Esta é a linha de base do `P1`, e ela vale mais que o `HEAD`** (regra 4).

**Pronto quando:** os quatro valores estão registrados aqui.

> **Executada — 2026-08-20.** Capturados **duas vezes** e idênticos nas duas:
>
> | | `.docx` | `.xlsx` |
> |---|---|---|
> | Piloto | `f6c71b9bedfb8921` | `a8f5a96f75d8eeda` |
> | PGM | `dea720cb551854e3` | `eb067fb496808a4c` |
>
> **São diferentes dos da ESPEC 031, e têm de ser** — aqueles foram medidos antes
> daquela implementação. A primeira execução desta tarefa comparou contra eles e
> acusou *"MOVEU"* nos quatro: a ferramenta estava com a linha de base errada, e é
> exatamente o que a regra 4 deste backlog adverte. **A linha de base é esta
> árvore.**

**Verificação:** `P0` (primeira metade).

---

## 4. Épico E1 — Os testes, escritos antes `[portão P0]`

#### T-2173 — Módulo `test_cauda_de_pagina.py`
**Tamanho:** P · **Ref:** `R-CON-01`, `R-CON-02`

O crivo sobre os seis casos, cada um nomeado por documento e página, com os números de palavras
fora da coluna por extenso. É a tabela do §2.2 da espec virando asserção.

**Pronto quando:** o módulo existe e reprova contra o `HEAD` por o crivo não existir.

> **Executada.** Seis casos, cada um por documento e página. Reprovou por
> `ImportError` — o crivo não existia.

---

#### T-2174 — As três descrições reconstruídas
**Tamanho:** PP · **Ref:** `R-CON-03`, `R-CON-06`

As três por extenso. A do `12.074.00005.00` afirmada **contra a descrição da aba**, e não contra
literal copiado — é o que faz a asserção vir de fora do código (`T-2171`).

A do `14.048.00008.00` vai por literal, e o teste diz por quê: ali a aba usa outra redação.

**Pronto quando:** os três testes existem e reprovam **com o texto cortado na mensagem** — não com
`AttributeError`. É o vermelho que prova que o defeito é real.

> **Executada, e o vermelho saiu forte:**
> `assert 'DISPONIBILIZ...THROUGHPUT DE' == 'DISPONIBILIZ...DE SEGURANÇA)'`.
> O do `14.048.00008.00` afirma contra o **molde interno** — o `14.048.00009.00`
> do PGM, mesma família, extraído inteiro.

---

#### T-2175 — O teste que pega crivo frouxo `[risco]`
**Tamanho:** PP · **Ref:** `R-CON-02`, `D-02`, regra 1

`aditivo_pgm.pdf` p6: o texto acima da grade é o título da seção `E5.10` mais parágrafos
explicativos, e **parece** descrição de item. O `14.048.00027.00` já sai completo hoje.

Duas asserções: o crivo rejeita a página, e a descrição daquele item continua idêntica.

**É o único teste da suíte que reprova quem trocar o predicado sobre o conjunto por um filtro sobre
as palavras.** Sem ele, a versão frouxa passa em tudo.

**Pronto quando:** existe e **passa já** contra o `HEAD` — hoje nada é tomado, então rejeitar é o
comportamento atual.

> **Executada.** Passou contra o `HEAD` e continua passando depois do crivo: a
> p6 do aditivo é rejeitada, e o `14.048.00027.00` sai íntegro nos dois estados.

---

#### T-2176 — Nenhum valor numérico se move `[risco]`
**Tamanho:** P · **Ref:** `R-CON-04`, regra 2, **P2**

Para **cada** item de **cada** um dos três documentos: código, unidade, quantidade, preço unitário,
meses e total. Conjunto inteiro contra conjunto inteiro, congelado em constante.

É o teste mais chato deste backlog e o mais importante: é ele que garante que uma correção de texto
ficou sendo uma correção de texto. Amostra não serve — o defeito que ele previne é justamente o que
ninguém procuraria.

**Pronto quando:** existe e **passa já**. Reprovar aqui, antes de qualquer código, significaria que
a extração já está errada por outro motivo.

> **Executada, e ela reprovou uma vez — por motivo que não era o previsto.** Ao
> costurar, faltou o `import replace` de módulo: `_identificar` já o importava
> **dentro da função**, e a minha condição viu a cadeia no arquivo e não inseriu o
> de topo. A extração quebrou com `NameError`, e a `T-2176` acusou como falha de
> valor.
>
> **Regra 2 nunca foi violada** — nenhum número se moveu em momento nenhum. Mas o
> canário cantou por um defeito real, que sem ele apareceria treze minutos depois,
> na suíte inteira.

---

#### T-2177 — A cauda sem linha anterior
**Tamanho:** PP · **Ref:** `R-CON-05`

Cenário construído: página de tabela cuja cauda não tem linha anterior a que se anexar. Nenhum dos
três documentos o exercita, e é o que a `V-CTR-06` registra.

**Pronto quando:** o cenário existe, montado à mão.

---

#### T-2178 — O portão `[portão]`
**Tamanho:** PP · **Ref:** **P0**

Rodar tudo contra o `HEAD` e preencher a tabela do `P0`, teste a teste, com a asserção que cada um
acusou.

O esperado: os de reconstrução reprovam **com o texto cortado**; os de `R-CON-02` e `R-CON-04`
**passam já**.

> **Os que passam antes de qualquer código novo são resultado, não folga.** Eles afirmam o que
> **não** muda. Reprovando aqui, a premissa da entrega estaria errada antes de começar.

**Verificação:** `P0`.

---

## 5. Épico E2 — O crivo, sem chamador `[portão P1]`

#### T-2179 — A função de crivo em `grid.py`
**Tamanho:** PP · **Ref:** `R-CON-01`, `R-CON-02`, `D-05`

Recebe página e grade; devolve a cauda como texto, ou vazio.

Mora em `grid.py` porque é decisão sobre **fronteiras**, e é lá que as outras moram — o limite
sintético do rodapé, o casamento de divisórias, a atribuição por centro.

**Devolve texto ou vazio, e não `None` com significado.** *"Não há cauda"* e *"a cauda é vazia"*
são o mesmo fato para quem chama.

A ordem é a de leitura — `top`, depois `x0` —, **a mesma de `ler_celulas`**. Reinventá-la aqui poria
a mesma decisão em dois lugares, e ela importa: a cauda do `12.074.00005.00` tem duas linhas
visuais, e trocá-las produz texto que **parece** certo.

**Pronto quando:** `T-2173` e `T-2175` verdes.

> **Executada.** 13 de 16 verdes; os 3 vermelhos eram as reconstruções, que
> dependem da costura. O crivo classifica os seis casos reais corretamente.

---

#### T-2180 — O portão do instante em que nada mudou `[portão]`
**Tamanho:** PP · **Ref:** **P1**, PLANO §1

Os quatro artefatos conferidos contra a `T-2172`, por entrada. Suíte de backend idêntica à
`T-2169`.

**O crivo está inteiro e ninguém o chama.** É a régua forte — não há nada a julgar: ou é idêntico,
ou algo vazou para o extrator antes da hora.

**Pronto quando:** os quatro batem e a contagem da suíte não se move.

> **Executada — `P1` cumprido.** Os quatro artefatos byte a byte iguais à
> `T-2172`, pelo método por entrada. **O crivo existe e ninguém o chama.**

**Verificação:** `P1`.

---

## 6. Épico E3 — A costura `[portão P2]`

#### T-2181 — A cauda encontra a sua linha
**Tamanho:** PP · **Ref:** `R-CON-03`

`_linhas` passa a conhecer a página anterior; a cauda da página **n+1** é anexada ao fim da célula
de descrição da última linha da página **n**, separada por um espaço.

**Nenhuma outra célula é tocada** (`R-CON-04`). Código, unidade, preço, quantidade, meses e total
continuam saindo da página onde a linha começa.

**Pronto quando:** as três descrições saem completas e `T-2176` continua verde.

> **Executada.** As três saem inteiras; os 18 testes do módulo passam.
>
> **Uma decisão tomada na escrita, e ela era um risco real:** a costura só entra
> em `pendentes`. Fechado o bloco, o item passa a viver em `itens` **e** dentro do
> `BlocoDeItens`, e `Contract.__post_init__` exige que os dois concordem — emendar
> um só quebraria o invariante com uma mensagem incompreensível. Nos três
> documentos a linha anterior está sempre pendente; não estando, é a `R-CON-05`.
>
> E há um `caudas_costuradas` guardando contra a página que casa **duas
> geometrias**: sem ele, a mesma cauda entraria duas vezes na descrição.

---

#### T-2182 — `V-CTR-06`
**Tamanho:** PP · **Ref:** `R-CON-05`

`v_ctr_06_cauda_sem_linha_anterior`, severidade `AVISA`, e o registro no contêiner.

Não dispara em nenhum dos três documentos, e é assim que tem de ser: guarda de anomalia, no
precedente da `V-MED-04` da ESPEC 031.

**O crivo fica no domínio da grade, não na validação** — a infraestrutura relata; ela não decide o
que conta como cauda. Foi o vazamento de camada que a `T-2152` cometeu e corrigiu antes de rodar.

**Pronto quando:** dispara no cenário de `T-2177` e cala nos três documentos.

> **Executada.** Registrada **por peça**, ao lado do `v_ctr_03_checksum`, e não
> sobre o consolidado: as caudas órfãs viajam no `diagnostico`, e
> `Contract.aplicar` propaga o da proposta, perdendo o dos aditivos. Calada nos
> três documentos.

---

#### T-2183 — O portão `[portão]`
**Tamanho:** PP · **Ref:** **P2**

Três descrições mudam. **Zero** valores numéricos. `V-CTR-03` fecha nas três peças. Nenhuma
contagem de linha, divergência ou situação se move.

**Pronto quando:** o delta é exatamente o previsto, e nada fora da tabela da espec.

> **Executada — `P2` cumprido.** Três descrições completas; `ord/dem/div/crit/tot`
> idênticos nos dois pares (54/4/36/0/58 e 47/11/26/3/58); nenhum achado novo.

**Verificação:** `P2`.

---

## 7. Épico E4 — A reancoragem `[portão P3]`

> **Vem depois da E3 de propósito.** Reancorar contra implementação em andamento grava o estado de
> meia hora daquela tarde (TASKS 026 §9.10).

#### T-2184 — O delta, desligado `[risco]`
**Tamanho:** PP · **Ref:** **P3**

Desligar **apenas** a `R-CON-03` — a costura da `T-2181`, e nada mais — e medir: os quatro
artefatos têm de voltar aos valores da `T-2172`.

O passo final sozinho prova que o documento mudou, coisa que já se sabe. Este prova que ele mudou
**por esta razão e por nenhuma outra**, numa árvore que carrega trabalho de três especs.

**Pronto quando:** os quatro voltam.

> **Executada.** Desligado o crivo, os quatro voltam exatos à `T-2172`.

---

#### T-2185 — O delta, religado
**Tamanho:** PP · **Ref:** **P3**

Religar e conferir, **entrada a entrada**, quais se movem. O esperado: `word/document.xml` nos dois
`.docx`, e abas do `.xlsx` de análise — **quais, é o que esta tarefa mede**.

O renderizador da análise tem `Descrição` na coluna 2 (`COLUNAS`, linha 46). O `P3` do plano dizia,
na primeira redação, que só o `.docx` se movia; foi corrigido antes da `F0`. **A lista de artefatos
afetados é medição, não memória.**

**Pronto quando:** a lista de entradas movidas está registrada, e nenhum estilo, relação ou
`contentType` está nela.

> **Executada, e a emenda do plano se pagou.** Movem-se:
>
> | Artefato | Entradas |
> |---|---|
> | `piloto.docx` · `pgm.docx` | `word/document.xml` |
> | `piloto.xlsx` | `sheet3.xml`, `sheet5.xml` |
> | `pgm.xlsx` | `sheet5.xml` |
>
> **O `.xlsx` move**, como a redação corrigida do `P3` previa. A primeira redação
> dizia que só o `.docx` mudava, e isto teria parecido violação.

---

#### T-2186 — `test_capa.CORPO_DO_PILOTO_*` `[risco]`
**Tamanho:** PP · **Ref:** **P3**

O `sha256` muda. A contagem de textos e a de códigos: **medir, não prever.**

Descrição mais longa pode não acrescentar `<w:t>` nenhum — depende de o renderizador escrever a
célula como um texto só. Prever qualquer dos dois lados é o erro da ESPEC 031 §2.7, que previu
`16.013` de cabeça, mediu `16.006`, e teve de revogar o número na v1.1 da espec.

A contagem de **códigos** não deve mudar: nenhuma linha entra nem sai.

**Pronto quando:** os três valores medidos, com a cadeia dos estados no comentário de cada um.

> **Executada, e a cautela se pagou: dois dos três não mudam.**
>
> `TEXTOS` **16.006 → 16.006** e `CODIGOS` **75 → 75**. A descrição sai num único
> `<w:t>`, e completá-la não acrescenta elemento nenhum. Só o `sha256` se move, e
> o diff texto a texto mostra **exatamente duas trocas** — as duas descrições do
> piloto.
>
> Prever teria errado, e é o erro que a ESPEC 031 §2.7 cometeu na direção oposta.

---

#### T-2187 — `linhas_do_documento.json`
**Tamanho:** PP · **Ref:** **P3**

Regravar **derivando do anterior**, trocando três descrições, e conferir contra a saída do
renderizador nos dois pares.

**O diff desta vez tem inserções, e a prova é a paridade:** três deleções e três inserções, e as
outras 101 linhas idênticas. Na ESPEC 031 a prova foi *"zero inserções"*; aqui seria o critério
errado.

**Pronto quando:** o diff sai com três pares, e mais nada.

> **Executada, e o critério do diff teve de mudar.** `git diff --numstat` diz
> `3 inserções, 17 deleções` — as 14 extras são da **ESPEC 031**, que não está
> commitada. O `git diff` compara com o `HEAD`, e o `HEAD` não é a linha de base
> desta entrega (regra 4).
>
> A paridade foi provada por asserção, que é mais forte que contagem de linhas:
> 54 linhas com 2 trocadas e 50 com 1 trocada; **cada descrição nova estende a
> antiga**, e código, unidade, contratada e medida idênticos em todas as 104.

---

#### T-2188 — O que a `T-2168` tiver achado além destes
**Tamanho:** PP · **Ref:** **P3**

As âncoras que o inventário acrescentou à tabela da espec — inclusive as de `frontend/e2e/`, se
houver.

**Pronto quando:** a tabela da espec está inteira em verde.

**Verificação:** `P3`.

---

## 8. Épico E5 — As duas suítes `[portão P4]`

#### T-2189 — Backend completo
**Tamanho:** PP · **Ref:** **P4**

`python -m pytest`. 1.404 na entrada mais os desta entrega; o número de saída vira **número
declarado**.

> **Executada — `1422 passed, 1 warning in 1008.24s`. Zero falhas.**
> 1.404 na entrada mais os 18 do módulo novo. **1.422 é o número declarado.**
>
> Levou 16min48 contra os 13 habituais, e a causa é conhecida: o servidor de
> backend para a suíte de navegador subia em paralelo. Não é regressão de
> desempenho.

---

#### T-2190 — Navegador completo `[risco]`
**Tamanho:** PP · **Ref:** **P4**, regra 3

`npx playwright test`, com o backend no ar.

**Não deduzir que ela não se moveu.** Foi essa dedução que falhou na ESPEC 031 — e falhou logo
depois de eu escrever que o componente era aditivo e o risco, baixo. Descrição mais longa não muda
contagem nenhuma; mesmo assim, roda-se.

Comparar contra a lista da `T-2169`: falha nova reprova; a intermitente do `I-05` não.

> **Executada — `119 passed, 1 failed` em 15,3 min.**
>
> **A falha é outra**, e não a do `I-05`: `divergencia.spec.ts › a ordem é por
> magnitude`. A do `I-05` passou nesta execução.
>
> **Não é regressão desta entrega.** A asserção recebeu **lista vazia**, não lista
> reordenada — o painel não renderizou. Descrição mais longa não esvazia painel.
> E o arquivo inteiro passa isolado: **7 de 7**.
>
> **O que a terceira execução revelou, e é achado próprio:** em três execuções
> completas hoje apareceram **duas falhas intermitentes diferentes**, nunca as
> duas juntas, ambas passando isoladas, e **ambas em estados que exigem geração
> completa de relatório** — `divergenciaDeFonte` e `divergenciaComAditivo`. Não
> são duas instabilidades; é provavelmente **uma**: o preparo do estado correndo
> contra um backend lento sob carga. Registrado como `I-06`.

---

#### T-2191 — `ruff` e `mypy`
**Tamanho:** PP · **Ref:** **P4**

Sobre os arquivos tocados. O `I001` de `test_divergencia_de_fonte.py` é anterior a esta entrega e a
anteriores; **não corrigir aqui**, pela mesma razão de sempre — misturaria o diff.

> **Executada.** `ruff` e `mypy` limpos nos oito arquivos desta entrega. O `I001`
> de `test_divergencia_de_fonte.py` segue lá, e segue não sendo desta entrega.

---

#### T-2192 — `README.md` e `CHANGELOG.md`
**Tamanho:** PP

A linha do incremento 032 e a entrada de rumo: a ESPEC 001 §9.4 corrigiu o rodapé da página; esta
fecha o cabeçalho, e os dois códigos são os mesmos porque são os que caem no fim da página.

> **Executada.** A entrada do `CHANGELOG` registra também o que **não** mudou, que
> nesta entrega é mais longo que o que mudou: nenhum valor numérico, nenhuma
> contagem, e nem `CORPO_DO_PILOTO_TEXTOS` nem `_CODIGOS`.

**Verificação:** `P4`.

---

## 9. Insumos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | A descrição reconstruída do `14.048.00008.00` mistura maiúsculas do contrato com a caixa mista da continuação. Normalizar? | Não. Normalizar seria editar o contrato |
| `I-02` | O invariante de `R-CON-07` cobre os três arquivos conhecidos. Um contrato novo com outra geometria não teria guarda | Não. Nenhum número em risco, e descrição cortada é visível a quem lê |
| `I-03` | A `V-CTR-06` nunca dispara hoje. Vale mantê-la? | Não bloqueia. Precedente da `V-MED-04` |
| `I-06` | Duas falhas intermitentes distintas em três execuções da suíte de navegador, ambas em estados que exigem geração completa e ambas passando isoladas. É uma só causa — o preparo do estado contra um backend lento? | Não. Nenhuma é regressão de produto; vale uma investigação própria |

---

## 10. Emenda de execução

*Reservado. A preencher ao fim da execução.*