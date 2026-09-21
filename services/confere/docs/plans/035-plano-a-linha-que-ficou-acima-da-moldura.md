# PLANO 035 — Implementação de "A linha que ficou acima da moldura"

| | |
|---|---|
| **Especificação** | [ESPEC 035](../specs/035-a-linha-que-ficou-acima-da-moldura.md) v1.0 |
| **Versão** | 1.0 — 2026-08-31 |
| **Backlog** | TASKS 035, a escrever. Numeração continua de `T-2247`, a última da ESPEC 034 — os `T-` deste plano começam em **`T-2248`** |
| **Estado inicial** | **A árvore está limpa** — `HEAD` em `24acc9e`, com as ESPECs 033 e 034 já commitadas. Só há dois arquivos novos, os desta entrega: a ESPEC 035 e `scripts/diagnosticar_linha_perdida.py`. Backend: **1.482 testes coletados**, o mesmo número que a ESPEC 034 fechou. Pela primeira vez desde o PLANO 032, **o "antes" é o `HEAD`** e não há de que desconfiar (§7) |
| **Colisão conhecida** | **Nenhuma entrega aberta.** Mas há colisão *interna*: `montar_grade` é chamada pelo extrator **e** pelo crivo de admissão de geometrias, e `R-GRD-11` muda o que ela devolve. É o risco número um deste plano, e tem seção própria (§7) |
| **Dependência externa bloqueante** | O `PA-FTM-251001-143 v1.0.pdf` **não está no repositório**. Sem ele não há como confirmar o mecanismo (`T-01` da espec) nem exercitar `R-GRD-11`. O plano é ordenado para que **duas das três entregas não dependam dele** (§1) |
| **Instrumento existente** | `scripts/medir_extracao.py` (a régua de `sha`, ESPEC 033) e `scripts/diagnosticar_linha_perdida.py` (escrito na análise, valida contra `contrato.pdf` p27). A medição das órfãs do corpus já está feita: **nove páginas imprimem acima da grade, zero têm código de serviço** (ESPEC §2.4) |

---

## 1. O que este plano tem de diferente dos anteriores

> **O arquivo do defeito não está aqui, e a ordem das fases é a resposta.**
> Duas das três correções — o contador (`R-GRD-10`) e o traço (`R-CAP-16`) — têm a não-regressão
> inteiramente medida no corpus versionado, e **entregam sem o PDF**. Só `R-GRD-11` precisa dele.
> Por isso elas vêm primeiro: se o arquivo demorar, a entrega não fica parada, e o que já entrou é
> exatamente o que torna o diagnóstico do arquivo trivial quando ele chegar.

> **O contador vem antes da correção, e isso é instrumento, não ordem arbitrária.**
> Entregue só a `F1`, o FTM **continua bloqueando** — mas a mensagem de `V-CTR-03` passa a dizer
> *"e a grade descartou N palavras na página 7"*. Isso é o `T-01` da espec **respondido pelo próprio
> produto**, sem script e sem sessão de análise. É o mesmo movimento do PLANO 034, onde `R-DOC-11`
> veio antes para o `V-CAP-01` nomear a peça antes de calar.

> **O risco aqui não é perder uma linha. É inventar uma.**
> `V-CTR-03` já pega linha perdida — foi ela que abriu esta espec. O que nada pega, hoje, é uma
> linha **a mais**, colhida de prosa que passou pelo crivo. Ela some no meio de sessenta itens
> corretos e fecha o checksum errado. **A régua de `sha` da ESPEC 033 é o único oráculo dessa
> falha**, e é por isso que ela é portão em três fases e não uma conferência do fim.

> **`montar_grade` tem dois consumidores, e um deles é o crivo de admissão.**
> O extrator lê com ela e o `_e_item_completo` decide com ela. Mudar o que ela devolve muda **as duas
> coisas**, e a ESPEC 033 `R-FXA-06` existe justamente para proteger a segunda. §7 mede o que isso
> implica e diz o que verificar.

> **Não mexer na assinatura de `ler_celulas`.**
> A espec diz que ela "devolve, ao lado das linhas, a contagem". A leitura tentadora é trocar o tipo
> de retorno — e isso alcança `_linhas`, que é o crivo de admissão e **não quer a contagem**.
> A contagem sai por função irmã (§7), e `_linhas` não é tocada. Um `git diff` que mexa em `_linhas`
> reprova a revisão.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Linha de base, régua congelada, inventário, testes reprovando pelo motivo certo** | Fim da `F0`+`F1` | As buscas do §8 executadas nas duas suítes. Os oito `sha` da ESPEC §8.3 reproduzidos **nesta árvore**. Testes novos reprovam pelo **valor**, nunca por `ImportError`: os de nome de órgão com `''` na mensagem, o de `R-GRD-12` por a função não existir ainda | Inventário deduzido é o defeito que o projeto cometeu quatro vezes. E régua não reproduzida é régua de outra árvore |
| **P1 — O contador, e o corpus acusando zero** | Fim da `F2` | `palavras_descartadas` das oito peças é **zero em todas**. Os oito `sha` **idênticos**. A mensagem de `V-CTR-03` sai byte por byte igual quando não há o que dizer | Reverter a `F2`. Contador que acuse qualquer coisa no corpus está contando a coisa errada |
| **P2 — O traço** | Fim da `F3` | Os oito nomes de órgão da ESPEC §2.5 **idênticos**, com os três vazios afirmados. Os oito `sha` **idênticos** — esta fase não toca a grade | Reverter a `F3`. Nome de órgão que se mova é regressão, não melhoria |
| **P3 — O mecanismo confirmado** | Fim da `F4` | Com o FTM em `fixtures/`: `horizontais[0]` **abaixo** da linha `E1`, e o `14.031.00018.00` entre as palavras que o contador da `F2` acusa. Extração hoje: **9 itens**, `133.640,53` | **Não seguir para a `F5`.** É o caminho B: a ESPEC 035 vira v1.1, `R-GRD-11`/`R-GRD-12` são substituídas, e `F2`+`F3` **ficam entregues** (`D-05`) |
| **P4 — A fronteira superior** | Fim da `F5` | FTM: **10 itens**, `185.316,73`, `V-CTR-03` **cala**, `palavras_descartadas` = zero. Os oito `sha` **idênticos**. **`geom` do FTM continua sendo o de `P3`** (§7). Caudas do `contrato.pdf` p27/p28 e do `contrato_pgm.pdf` p23 costuradas como hoje | Reverter a `F5`. Qualquer `sha` movido é linha inventada até prova em contrário |
| **P5 — O conjunto** | Fim da `F6` | Backend verde, **≥ 1.482**. Navegador sem falha nova sobre a linha de base da `T-2249`. `ruff` e `mypy` limpos. **Nenhum artefato reancorado** | Não entregar |

---

## 3. Fases

### F0 — Linha de base, régua e inventário `[portão]`

**Objetivo:** congelar o que não pode mudar, **antes** de escrever código.

| # | Tarefa | Ref. |
|---|---|---|
| T-2248 | Executar as buscas do §8 nas duas suítes. **O resultado manda na tabela da ESPEC §8.5**, e não o contrário | §8 |
| T-2249 | Linha de base: backend completo com o número declarado (esperado `1.482 passed`) e a lista de falhas do navegador, para separar herdado de novo | **P5** |
| T-2250 | **Congelar a régua de `sha`.** `scripts/medir_extracao.py` nas sete peças do `CORPUS` mais o `aditivo_pgm_2.pdf`. Conferir contra a tabela da ESPEC §8.3, valor por valor | **P1**, **P2**, **P4** |
| T-2251 | Congelar a régua de capa: os oito nomes de órgão derivados hoje (ESPEC §2.5, coluna "hoje") | **P2** |
| T-2252 | **Pedir o `PA-FTM-251001-143 v1.0.pdf`** e colocá-lo em `backend/tests/fixtures/aditivo_ftm.pdf`. **Não bloqueia `F1` a `F3`**; bloqueia da `F4` em diante | **P3** |

**A régua da `T-2250`, a reproduzir nesta árvore:**

```
contrato.pdf          itens= 60  total= 10.637.425,00  geom=1  sha=430e506cb76292f5
contrato_pgm.pdf      itens= 47  total= 24.551.037,72  geom=1  sha=b8a7117b631604f1
aditivo_pgm.pdf       itens=  7  total=         -0,12  geom=3  sha=0e7ec8ef5ddcc631
contrato_smul.pdf     itens= 41  total= 27.415.244,95  geom=1  sha=6d0df30694ee2521
aditivo_smul.pdf      itens= 16  total=    364.793,93  geom=4  sha=fa22dd2ea6cb1d1e
modelo.pdf            itens=  0  total=          None  geom=0  sha=4f53cda18c2baa0c
amostra_sem_tabela    itens=  0  total=          None  geom=0  sha=4f53cda18c2baa0c
aditivo_pgm_2.pdf     itens=  0  total=          None  geom=0  sha=4f53cda18c2baa0c
```

> **Os três `4f53cda1…` são o `sha` da lista vazia, e isso é resultado — não ausência de medição.**
> Um documento que passe a extrair item onde hoje extrai zero move esse `sha`, e o portão pega.

**Verificação:** `P0` (primeira metade). **Tamanho:** PP — trinta minutos, mais o tempo das suítes.

---

### F1 — Os testes, escritos antes `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2253 | `R-GRD-10`: as oito peças acusam **zero** palavra descartada. Passa desde já quando o contador existir; é a régua que impede o contador de contar prosa | `R-GRD-10` |
| T-2254 | `R-GRD-12`, em **caso construído, sem abrir PDF**, no espírito de `_escolher_gabarito`: órfãs com um código e mais nada → sintetiza; órfãs com um código **e** palavra acima da linha visual dele → **não** sintetiza | `R-GRD-12`, `D-03` |
| T-2255 | `R-CON-06`: nas três páginas de cauda medidas (`contrato.pdf` p27 e p28, `contrato_pgm.pdf` p23) a cauda continua sendo costurada e **nenhuma** fronteira superior é sintetizada | `R-CON-06`, **P4** |
| T-2256 | `R-CAP-16`/`R-CAP-17`: os oito nomes por extenso, um caso por peça, com os três vazios afirmados | `R-CAP-16`, `R-CAP-17` |
| T-2257 | **O teste que pega o `_SIGLA` esquecido:** o nome derivado do FTM **não contém** `FTMSP`. Fica marcado até a `T-2252` chegar | `R-CAP-16` |
| T-2258 | `R-GRD-11`: o FTM extrai **10 itens**, fecha em `185.316,73`, e a linha `14.031.00018.00` sai com `45,33 · 95,00 · 12 · 51.676,20` **por extenso**. Marcado até a fixture chegar | `R-GRD-11`, **P4** |
| T-2259 | **[portão]** Rodar contra esta árvore e conferir **como cada um reprova**: `T-2254` por a função não existir; `T-2256` com `''` no lugar do nome do FTM; `T-2253` e `T-2255` **passam já** | **P0** |

**Verificação:** `P0`.

> **`T-2255` passa antes e depois, e é assim que ele funciona.** Hoje a cauda é costurada nas três
> páginas; depois, também — porque o crivo de `D-02` não dispara nelas. Quem escrever `R-GRD-11` sem
> o crivo do código reprova **só nele**, que é exatamente o serviço que ele presta.

> **`T-2253` também passa antes**, e por um motivo que vale registrar: hoje o contador não existe,
> então o teste só pode ser escrito depois da `F2`. **Escrevê-lo em `F1` com a função ausente é o
> vermelho certo** — `ImportError` aqui é informação, e não descuido, porque a `T-2259` o declara.

**Tamanho:** P — uma hora e meia.

---

### F2 — O contador, sem o arquivo `[portão]`

**Objetivo:** fazer o Confere dizer *o que descartou* antes de mudar *o que lê*.

| # | Tarefa | Ref. |
|---|---|---|
| T-2260 | Função irmã em `grid.py` que devolve, para uma página e uma grade, quantas palavras caíram no vão da tabela e **não** foram atribuídas. **`ler_celulas` e `_linhas` não são tocadas** (§7) | `R-GRD-10`, §7 |
| T-2261 | `DiagnosticoDaGrade` ganha `palavras_descartadas: tuple[tuple[int, int], ...]` — **por último e com padrão**, como todos os campos acrescentados a ele | `R-GRD-10` |
| T-2262 | O extrator acumula a contagem **por página**, deduplicando quando a página casa mais de uma geometria — do jeito que `caudas_costuradas` já faz | `R-GRD-10`, §7 |
| T-2263 | `V-CTR-03` ganha o sufixo **condicional**. Sem descarte, a mensagem sai byte por byte igual | §5.1 da espec |
| T-2264 | **[portão]** As oito peças acusam zero; os oito `sha` idênticos à `T-2250` | **P1** |

**Verificação:** `P1`.

> **A dedup da `T-2262` não é zelo: é correção.** O laço do extrator é `por página × por geometria`,
> e o `aditivo_pgm.pdf` tem página casada por duas geometrias — foi por isso que a ESPEC 032 criou
> `caudas_costuradas`. Sem dedup, o contador dobra e a mensagem mente sobre o tamanho do problema.

> **O sufixo da `T-2263` é condicional, e é o que o mantém sem risco.** Nenhum teste e nenhum
> artefato ancoram essa string — conferido: a única ocorrência no repositório é a `f-string` que a
> monta. Ainda assim, é a `T-2248` que confirma, não este parágrafo.

**Tamanho:** PP — quarenta minutos.

---

### F3 — O traço, sem o arquivo `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2265 | Classe de traços em `_CLIENTE` **e** em `_SIGLA` — hífen, hifens tipográficos, en dash, em dash e sinal de menos, a **mesma classe nos dois** | `R-CAP-16` |
| T-2266 | **[portão]** Os oito nomes da `T-2251` idênticos; os três vazios continuam vazios | **P2** |
| T-2267 | **[portão]** Os oito `sha` idênticos. Esta fase não toca a grade, e a régua é canário — mas é barato e já pegou surpresa antes | **P2** |

**Verificação:** `P2`.

> **`_SIGLA` é metade da correção, não um detalhe de arredondamento.** Com a classe só em `_CLIENTE`,
> a capa do FTM sairia `FUNDAÇÃO THEATRO MUNICIPAL – FTMSP`, com a sigla colada — pior que o aviso
> de hoje, porque **parece** certo. É o que a `T-2257` afirma.

> **O vocabulário não se mexe** (`D-04` da ESPEC 034). `Fundação` já está lá, por antecipação, e a
> antecipação funcionou. Alargá-lo "de passagem" reabriria uma decisão que tem caso real.

**Tamanho:** PP — vinte minutos.

---

### F4 — A confirmação do mecanismo `[portão, e é o que decide o resto]`

**Depende da `T-2252`.** Sem a fixture, a entrega para aqui — com `F2` e `F3` já entregues.

| # | Tarefa | Ref. |
|---|---|---|
| T-2268 | Medir o FTM com o contador da `F2` e com `scripts/diagnosticar_linha_perdida.py`. Registrar `horizontais[0]` da página 7, as palavras descartadas e `geom` | ESPEC `T-01` |
| T-2269 | **[portão]** Confirmar o caminho A: o `14.031.00018.00` está entre as descartadas, e `horizontais[0]` fica **abaixo** da linha `E1`. Extração hoje: 9 itens, `133.640,53` | **P3** |
| T-2270 | Registrar o `geom` do FTM **antes** da correção. É a régua de §7 — o número **não pode subir** na `F5` | **P4**, §7 |
| T-2271 | Se `T-2269` reprovar: **parar**, emendar a ESPEC 035 para v1.1 com o mecanismo medido, e reabrir da `F1` | ESPEC §2.3 |

**Verificação:** `P3`.

> **Esta fase pode terminar a entrega, e isso está previsto.** A ESPEC §2.3 estabelece o caminho A
> **por eliminação**, não por medição direta — o arquivo não estava disponível quando ela foi
> escrita. Se o `T-2269` disser outra coisa, `F2` e `F3` continuam válidas e entregues (`D-05`), e a
> espec ganha uma v1.1 do jeito que a ESPEC 033 ganhou a dela na execução.

**Tamanho:** PP — vinte minutos, uma vez que o arquivo esteja aqui.

---

### F5 — A fronteira superior `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2272 | `montar_grade` sintetiza a fronteira superior quando há **código de serviço na coluna do código** entre as órfãs — o espelho da síntese de rodapé, e no mesmo lugar dela | `R-GRD-11`, `D-01`, `D-02` |
| T-2273 | O tudo-ou-nada de `R-GRD-12`: um único código, e nenhuma palavra acima da linha visual dele. Não sendo, **não sintetiza** | `R-GRD-12`, `D-03` |
| T-2274 | Conferir a ordem no extrator: `R-GRD-11` decide **antes** da costura da cauda, e sintetizada a fronteira não há órfãs para `cauda_da_pagina` ver | `R-CON-06`, `D-04` |
| T-2275 | **[portão]** FTM: 10 itens, `185.316,73`, `V-CTR-03` cala, contador em zero | **P4** |
| T-2276 | **[portão]** Os oito `sha` da `T-2250` **idênticos**, e o `geom` de cada peça igual — inclusive o do FTM contra a `T-2270` (§7) | **P4** |
| T-2277 | **[portão]** `T-2255` verde: as três caudas continuam costuradas, e nenhuma fronteira sintetizada nelas | **P4** |

**Verificação:** `P4`.

> **A síntese mora dentro de `montar_grade`, junto da de rodapé, e não numa função nova.** Separá-las
> poria a mesma decisão em dois lugares, e o dia em que discordarem seria um dia perdido — é o
> argumento que a `T-1107` já usou para tirar a contagem de divisórias de lá.

> **`geom` é portão, e não conferência.** `montar_grade` serve o extrator **e** o crivo de admissão:
> uma fronteira a mais é uma linha a mais para o `_e_item_completo` avaliar, e uma geometria que
> hoje é recusada pode passar a ser admitida. §7 explica por que o corpus não corre esse risco e o
> FTM corre.

**Tamanho:** P — uma hora.

---

### F6 — O conjunto `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2278 | Suíte de backend completa, número declarado, comparado com a `T-2249` | **P5** |
| T-2279 | Suíte de navegador completa. Falha nova reprova; herdada da `T-2249` não | **P5** |
| T-2280 | **Nenhum artefato reancorado:** `test_identidade_dos_artefatos`, `test_docx_formatacao`, `pacote.py`, `linhas_do_documento.json` e `valores_do_contrato.json` intocados no `git diff` | **P5** |
| T-2281 | `ruff` e `mypy` nos arquivos tocados | **P5** |
| T-2282 | `README.md`, `docs/CHANGELOG.md` e o `Status` da ESPEC 035. Decidir se `scripts/diagnosticar_linha_perdida.py` fica versionado ou sai | — |

**Verificação:** `P5`. **Tamanho:** PP — trinta minutos, mais ~35 de suítes.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3 ──┬──► F4 ──► F5 ──► F6
P0     P0     P1     P2   │    P3     P4     P5
                          │
              sem o PDF ──┘    ◄── a fixture entra aqui (T-2252)

F2  o Confere passa a DIZER o que descartou — o FTM ainda bloqueia
F3  a capa do FTM passa a nomear o órgão — o FTM ainda bloqueia
F4  o mecanismo é confirmado, ou a espec vira v1.1 e a entrega para aqui
F5  o FTM lê as dez linhas e o V-CTR-03 cala
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~4h30, mais duas execuções de suíte. `F0` a `F3` (~3h) **não dependem do arquivo** |

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| **Inventar uma linha de item a partir de prosa** | Os oito `sha` da `T-2250`, portão em `P1`, `P2` e `P4`. É a falha que nenhuma validação pega, e a única régua é a igualdade do conjunto |
| Juntar cauda e linha de item na mesma célula | `T-2254` (`R-GRD-12`) e `T-2255`. A lição de ESPEC 032 §2.3: *degradado* é melhor que *errado* |
| **Admitir uma geometria a mais no FTM** por causa da fronteira nova | `T-2270` e `T-2276` — o `geom` medido antes e comparado depois (§7) |
| Mudar a assinatura de `ler_celulas` e alcançar o crivo de admissão | §1 e §7. `git diff` que toque `_linhas` reprova a revisão |
| Contador dobrado em página com duas geometrias | `T-2262` e a régua de zero da `T-2264` — o `aditivo_pgm.pdf` exercita o caso |
| Corrigir `_CLIENTE` e esquecer `_SIGLA` | `T-2257`: o nome do FTM não contém `FTMSP` |
| O arquivo não chegar | `F2` e `F3` entregam sem ele. A `F4` é o portão, e a parada é limpa |
| `T-2269` derrubar o mecanismo de §2.3 | `T-2271` — parar, emendar para v1.1, reabrir da `F1`. `R-GRD-10` e `R-CAP-16` ficam de pé (`D-05`) |
| Confundir vermelho herdado com vermelho novo no navegador | `T-2249` congela a lista antes |
| Medir o "antes" da árvore errada | §7 do PLANO 034, e desta vez a árvore está limpa (§7) |

---

## 6. O que este plano não faz

- **Não toca a leitura por faixa** (`R-FXA-01` a `R-FXA-06`). A ESPEC §2.3 mede que ela está correta
  na página do defeito — foi ela que fez o `TOTAL:` fechar em `185.316,73`.
- **Não toca o crivo de admissão de geometrias** nem a escolha do gabarito. §7 verifica que a
  fronteira nova não o alcança; verificar não é alterar.
- **Não afrouxa o crivo da cauda** (`R-CON-02`). `R-GRD-11` acrescenta um caso **antes** dele.
- **Não cria `V-CTR-07`** (`I-03`). O contador alimenta a mensagem de `V-CTR-03`; validação sem caso
  real é regra que envelhece sozinha.
- **Não abre o vocabulário de órgãos** (`D-04` da ESPEC 034).
- **Não normaliza travessões no texto extraído** (`D-06`): a classe alcança os dois padrões que
  precisam dela, e `_PROPOSTA`, `_PROCESSO`, `_REFERENCIA` e as descrições ficam como estão.

---

## 7. `montar_grade` tem dois consumidores, e um deles decide

É o ponto técnico mais afiado desta entrega, e não está no risco genérico de nenhuma outra.

```
montar_grade(pagina, divisorias)
   ├── extrair()                  lê as células dos itens        ← o alvo de R-GRD-11
   └── _linhas() → _e_item_completo()   decide QUAIS geometrias entram   ← R-FXA-06 protege
```

`R-GRD-11` acrescenta uma fronteira, logo acrescenta **uma linha** à grade. Para o extrator, é a
linha que faltava. Para o crivo, é **mais uma linha a avaliar** — e uma geometria hoje recusada pode
passar a render item completo e ser admitida. Admitida uma geometria a mais, o extrator passa a ler
a página por ela também, e a `linhas_vistas` só deduplica células **idênticas**.

**No corpus versionado o risco é nulo, e por medição:** a fronteira só é sintetizada onde há código
de serviço entre as órfãs, e nas nove páginas que imprimem acima da grade esse número é **zero**
(ESPEC §2.4). `montar_grade` devolve exatamente a mesma `Grade` de hoje, e o crivo vê o de sempre.

**No FTM o risco é real**, porque lá a fronteira é sintetizada de fato. Daí a `T-2270`: medir `geom`
**antes** e exigir o mesmo número depois. A expectativa é `1` nos dois estados — a ESPEC §2.3 percorre
por que a geometria do Cronograma não é admitida —, mas é expectativa, e o portão é que decide.

**Três regras de implementação que caem daqui:**

1. **`ler_celulas` não muda de assinatura.** A contagem de `R-GRD-10` sai por função irmã. `_linhas`
   chama `ler_celulas` e **não é tocada** — é o que `R-FXA-06` pede quando diz que o crivo tem de
   continuar respondendo a pergunta de hoje do jeito de hoje.
2. **A síntese fica dentro de `montar_grade`**, ao lado da de rodapé. Uma variante "sem síntese" para
   o crivo seria duas grades para a mesma página, e a discordância entre elas seria invisível.
3. **`geom` entra na régua**, ao lado de `itens`, `total` e `sha`. `scripts/medir_extracao.py` já o
   imprime; falta usá-lo como portão, e não como enfeite.

Há três testes chamando `montar_grade` — `test_grade_contrato.py`, `test_grade_por_faixa.py` e
`test_cauda_de_pagina.py` — e dois scripts. Nenhum afirma `horizontais` por valor hoje; a `T-2248`
confirma.

---

## 8. O inventário, e as buscas

Sobre `backend/tests/`:

| # | Busca | O que acha | O que já se sabe |
|---|---|---|---|
| 1 | `montar_grade`, `horizontais` | quem afirma a forma da grade | `test_grade_contrato.py`, `test_grade_por_faixa.py`, `test_cauda_de_pagina.py`. Nenhum afirma `horizontais` por valor — **e isso é hipótese, não medição** |
| 2 | `ler_celulas`, `_linhas`, `_e_item_completo`, `_geometrias_de_itens` | quem afirma o crivo de admissão | `test_grade_por_faixa.py`. É o que §7 protege |
| 3 | `cauda_da_pagina`, `R-CON-`, `caudas_orfas` | quem afirma a costura | `test_cauda_de_pagina.py`, e o `V-CTR-06` em `test_cascata_de_validacoes.py` |
| 4 | `V-CTR-03`, `soma_dos_totais` | quem afirma o checksum e a mensagem | `test_reconciliation.py`, `test_cascata_de_validacoes.py`. A string da mensagem **não** tem âncora — conferido |
| 5 | `DiagnosticoDaGrade(` | construções à mão que quebrariam com campo obrigatório | `test_domain.py` e vizinhos. É o motivo de o campo entrar **por último e com padrão** |
| 6 | `_cliente`, `cliente_da_capa`, `V-CAP-01` | quem afirma o nome do órgão | `test_capa.py`, `test_derivacao_do_orgao.py` |
| 7 | `sha256` | as âncoras de pacote e de corpo, que **não** podem se mover | `pacote.py`, `test_capa.py`, `test_docx_formatacao.py`, `test_identidade_dos_artefatos.py` |

Sobre `frontend/e2e/`:

| # | Busca | O que acha | O que já se sabe |
|---|---|---|---|
| 8 | `extração incompleta`, `V-CTR-03`, `soma dos itens` | asserção de tela sobre a mensagem que ganha sufixo | **Quatro arquivos citam `V-CTR-03`** — `anuncio.spec.ts:89`, `documento.spec.ts:103,148`, `estados.ts:149,188` e um comentário em `src/lib/types.ts:12`. Mas a `mensagem` que eles carregam é *"O total do levantamento não confere com a soma dos itens medidos"*, **inventada para a fixture** e diferente da que o backend emite. São cenários montados, não âncoras sobre a string real |

**O resultado das oito manda na tabela da ESPEC §8.5**, e não o contrário.

> **A busca 8 já foi feita e ilustra por que ela existe.** Os quatro arquivos do navegador citam
> `V-CTR-03` **pelo identificador**, com uma mensagem escrita à mão para o cenário. O sufixo de
> `R-GRD-10` não os alcança — mas alguém que buscasse só `V-CTR-03` e parasse aí concluiria o
> contrário, e alguém que não buscasse concluiria o contrário também. **A busca sozinha não decide;
> abrir o arquivo decide.**

> **A busca 1 é a que mais importa e a que mais engana.** Um teste que construa `Grade(...)` à mão
> não é afetado; um que compare o retorno de `montar_grade` é. Distinguir exige abrir o arquivo —
> foi o que a `T-2168` da ESPEC 032 fez com o `derivadas.spec.ts`, e foi o que evitou um falso
> positivo. A busca sozinha não decide.

---

## 9. Emenda de execução

*A preencher na execução, com o que o plano não previu.*
