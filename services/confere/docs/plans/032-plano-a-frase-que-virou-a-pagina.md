# PLANO 032 — Implementação de "A frase que virou a página"

| | |
|---|---|
| **Especificação** | [ESPEC 032](../specs/032-a-frase-que-virou-a-pagina.md) v1.0 |
| **Versão** | 1.0 — 2026-08-20 — **não executado.** O §9 fica reservado para a emenda de execução |
| **Backlog** | TASKS 032, a escrever. Numeração continua de `T-2167`, a última da ESPEC 031 |
| **Estado inicial** | Backend **1.404 passed**, navegador **119 de 120** — a que falta é a intermitente do `I-05` da ESPEC 031, que passa isolada. A árvore **não está limpa**: **46 arquivos** fora do `HEAD`, carregando trabalho de **três** especs (029, 030 e 031). Nada disso é desta entrega |
| **Colisão conhecida** | Nenhuma direta. A ESPEC 031 tocou `container.py`, `measurement.py` e o caso de uso; esta toca `grid.py`, `pdfplumber_extractor.py` e `contract_validations.py` — conjuntos disjuntos. **As âncoras de documento, porém, são as mesmas**, e foram reancoradas há horas: `test_capa`, `test_identidade_dos_artefatos` e `linhas_do_documento.json` (§7) |
| **Instrumento existente** | **O oráculo já existe e é externo ao código** (ESPEC §2.6): a aba `Levantamento` traz, nos dois pares, exatamente o texto que a reconstrução do `12.074.00005.00` tem de produzir. `V-CTR-03` é a prova pronta de que nenhum item se perde. A medição do §2.2 da espec foi feita com um simulador que não toca `src/` |

---

## 1. O que este plano tem de diferente dos anteriores

> **O risco não é perder texto. É colar texto errado.**
> O defeito de hoje é uma descrição cortada — visível, e sem número em jogo. O defeito que uma
> correção mal feita introduz é uma descrição **adulterada com 177 palavras de prosa sobre SOA**,
> num documento que vai ao órgão. A ESPEC §2.3 mediu isso, e é a razão de o crivo de `R-CON-02`
> existir antes da costura de `R-CON-03`.

> **A ordem das duas metades é a decisão de desenho do plano.**
> O crivo — *"isto é cauda ou é prosa?"* — é uma função pura sobre uma página, sem chamador. Escrita
> primeiro, ela existe, tem teste próprio sobre os **seis** casos reais, e **não pode mover
> documento nenhum**. É o portão `P1`, e é o mesmo instante que a ESPEC 031 usou para recuperar a
> régua forte dentro de uma entrega só. Só depois a costura a liga ao extrator.

> **O inventário de âncoras é de DUAS suítes, e esta é a quarta vez que o projeto aprende isso.**
> PLANO 024 §7 escreveu o critério; PLANO 028 §8 registrou que ele não foi aplicado até o fim;
> TASKS 031 §11 registrou que ele **nunca saiu de `backend/tests/`** — e seis testes de navegador
> quebraram doze horas depois de a ESPEC 030 os ter reancorado. Aqui o inventário são **oito**
> buscas, e as duas últimas são sobre `frontend/e2e/` (§8).

> **O `.xlsx` de análise também carrega descrição, e quase escapou.**
> O `P3` deste plano dizia, na primeira redação, que *"só `word/document.xml` se move"*. O
> renderizador da análise tem `Descrição` na coluna 2 desde sempre. Corrigido antes da `F0` — e
> serve de aviso: **a lista de artefatos afetados é medição, não memória.**

> **Esta entrega provavelmente não move a tela — e "provavelmente" não é critério.**
> Descrição mais longa não muda contagem nenhuma, e nenhum teste de navegador que eu conheça afirma
> texto de descrição. Foi exatamente esse raciocínio que falhou na ESPEC 031, e por isso a busca 8
> é tarefa, não dedução.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Inventário das duas suítes, oráculo confirmado, testes reprovando pelo motivo certo** | Fim da `F1` | As **oito** buscas do §8 executadas. Os seis casos do §2.2 da espec remedidos contra a árvore parada — três caudas, três armadilhas. Os testes novos reprovam com o **texto cortado** na mensagem; os que afirmam invariante **passam já** | Oráculo derivado do código só prova que o código concorda consigo mesmo. E inventário de uma suíte só é o defeito da entrega anterior |
| **P1 — O crivo existe e nenhum documento se moveu** | Fim da `F2` | O crivo classifica os seis casos corretamente, com teste próprio verde. Os quatro artefatos saem com os hashes da linha de base, medidos **por entrada do pacote, sem `docProps/core.xml`** (`T-2138` da ESPEC 031). A suíte de backend fica como estava | Diferença aqui é vazamento: o crivo alcançou o extrator antes de a `F3` autorizar. Reverter a `F2` |
| **P2 — A costura, com o delta exatamente o previsto** | Fim da `F3` | **Três** descrições mudam. **Zero** valores numéricos mudam, conferidos no conjunto inteiro dos três documentos. `V-CTR-03` fecha nas três peças. Nenhuma contagem de linha, divergência ou situação se move | Reverter a `F3`. Valor numérico que se mova é o defeito que esta espec existe para não causar |
| **P3 — Reancoragem provada, com a árvore parada** | Fim da `F4` | O delta reproduzido desligando **apenas** a `R-CON-03`. No `.docx`, só `word/document.xml` se move. **No `.xlsx` de análise também se movem abas** — ele traz coluna `Descrição` (`COLUNAS`, linha 46 do renderizador), e quais abas é medição da `F0`, não dedução; o `.json` da `T-1507` regravado **por derivação**, com diff de deleções e inserções **pareadas** — três linhas, três substituições | Não trocar constante nenhuma. Colar a saída do código na âncora apaga a linha vermelha; não reancora |
| **P4 — As duas suítes** | Fim da `F5` | Backend verde com número declarado. Navegador **sem falha nova** sobre a linha de base — que é `119 de 120`, com a intermitente do `I-05` | Não entregar |

---

## 3. Fases

### F0 — Inventário e oráculo `[portão]`

**Objetivo:** saber o que a mudança reancora — nas **duas** suítes — e reconfirmar os seis casos
contra a árvore de hoje.

| # | Tarefa | Ref. |
|---|---|---|
| T-1 | Executar as **oito** buscas do §8. O resultado **manda na tabela da ESPEC §8.3**, que a `D-06` já declarou provisória | ESPEC `D-06` |
| T-2 | Linha de base das duas suítes: backend `1.404 passed`; navegador, o conjunto de falhas de hoje, para separar herdado de novo | Estado inicial |
| T-3 | Remedir os seis casos do §2.2 com o simulador: três caudas com **zero** palavras fora da coluna, três armadilhas com 93, 110 e 117 | `R-CON-02`, `R-CON-07` |
| T-4 | Confirmar o oráculo: a descrição da aba do `12.074.00005.00`, nos dois pares, é o texto-alvo caractere por caractere | `R-CON-06` |
| T-5 | Capturar os quatro artefatos e conferir contra a linha de base **pelo método por entrada** — nunca por `sha256` do arquivo, que no `.xlsx` é irreprodutível | **P1** |

**Verificação:** `P0` (primeira metade).

> **`T-4` é o que separa esta entrega das anteriores.** Nenhuma outra teve conferência **externa ao
> código** do texto que produz. Aqui outra fonte, gerada por outro sistema, traz a cadeia exata — e
> é ela que transforma *"o texto parece completo"* em asserção.

**Tamanho:** PP — trinta minutos, mais o tempo das suítes.

---

### F1 — Os testes, escritos antes `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-6 | Módulo novo `tests/test_cauda_de_pagina.py`: o crivo sobre as três caudas e as três armadilhas, cada uma nomeada por documento e página | `R-CON-01`, `R-CON-02` |
| T-7 | As três descrições reconstruídas, **por extenso** no teste. A do `12.074.00005.00` afirmada contra a da aba, e não contra literal — é o `R-CON-06` | `R-CON-03`, `R-CON-06` |
| T-8 | **O teste que pega crivo frouxo:** `aditivo_pgm.pdf` p6. O texto rejeitado ali parece descrição de item, e o `14.048.00027.00` já sai completo. Quem afrouxar a regra quebra este | `R-CON-02`, `D-02` |
| T-9 | **Nenhum valor numérico se move:** os quatro campos de **todos** os itens dos três documentos, conjunto inteiro contra conjunto inteiro | `R-CON-04`, **P2** |
| T-10 | Cenário construído da `R-CON-05` — cauda sem linha anterior. Nenhum documento real o exercita | `R-CON-05` |
| T-11 | **[portão]** Rodar contra o `HEAD`: os de reconstrução reprovam **com o texto cortado na mensagem**; os de `R-CON-02` e `R-CON-04` **passam já** | **P0** |

**Verificação:** `P0`.

> **`T-9` é o teste mais importante deste plano, e o mais chato de escrever.** É ele que garante
> que uma correção de texto ficou sendo uma correção de texto. Comparar amostra não serve: o
> conjunto inteiro, os quatro campos, os três documentos.

> **`T-11` tem testes que passam antes de qualquer código novo**, e é resultado. `R-CON-02` passa
> porque hoje **nada** é tomado — o crivo rejeitar tudo é o comportamento atual. `R-CON-04` passa
> porque nenhum número muda hoje nem depois.

**Tamanho:** P — uma hora e meia.

---

### F2 — O crivo, e o instante em que nada mudou `[portão]`

**Objetivo:** a função que decide *"cauda ou prosa"* existindo, testada, e **sem chamador**.

| # | Tarefa | Ref. |
|---|---|---|
| T-12 | `grid.py` — função que recebe página e grade e devolve a cauda, ou vazio. O crivo de `R-CON-02` mora aqui, junto das outras decisões sobre fronteiras | `R-CON-01`, `R-CON-02`, `D-05` |
| T-13 | **[portão]** Testes de `T-6` e `T-8` verdes. Os quatro artefatos idênticos à `T-5`, por entrada. Suíte de backend idêntica à `T-2` | **P1** |

**Verificação:** `P1`.

> **A função devolve texto ou vazio, e não `None` com significado.** *"Não há cauda"* e *"há cauda
> vazia"* são o mesmo fato para quem chama, e distingui-los criaria um caso a tratar que não existe.

**Tamanho:** PP — trinta minutos.

---

### F3 — A costura `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-14 | `pdfplumber_extractor.py` — a cauda da página **n+1** é anexada à célula de descrição da última linha da página **n**. `_linhas` passa a conhecer a página anterior | `R-CON-03` |
| T-15 | `contract_validations.py` — `v_ctr_06_cauda_sem_linha_anterior`, e o registro no contêiner | `R-CON-05` |
| T-16 | **[portão]** Três descrições mudam; zero números; `V-CTR-03` fecha nas três peças | **P2** |

**Verificação:** `P2`.

> **A ordem da anexação é a de leitura — `top`, depois `x0` — e é a mesma de `ler_celulas`.**
> Reinventá-la aqui poria a mesma decisão em dois lugares. Ela importa: a cauda do
> `12.074.00005.00` tem duas linhas visuais, e trocá-las produz texto que **parece** certo.

**Tamanho:** PP — quarenta minutos.

---

### F4 — A reancoragem `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-17 | Desligar **apenas** a `R-CON-03` e medir: os quatro artefatos voltam à `T-5` | **P3** |
| T-18 | Religar e conferir, entrada a entrada, **quais** se movem: `word/document.xml` nos `.docx`, e as abas de situação nos `.xlsx`. Nenhum estilo, relação ou `contentType` | **P3** |
| T-19 | `test_capa.CORPO_DO_PILOTO_*` — o `sha256` muda; a contagem de textos e a de códigos, **a medir**. Descrição mais longa pode não acrescentar `<w:t>` nenhum, e supor qualquer dos dois lados é o erro que a ESPEC 031 §2.7 cometeu | **P3** |
| T-20 | `linhas_do_documento.json` — regravar **por derivação**, trocando três descrições. Aqui o diff tem inserções: são três, pareadas com três deleções | **P3** |
| T-21 | O que a `T-1` tiver achado além destes | **P3** |

**Verificação:** `P3`.

> **O diff do `.json` desta vez não é só de deleções.** Na ESPEC 031 ele saiu com 14 deleções e
> zero inserções, e aquilo era prova. Aqui a prova é a **paridade**: três linhas trocadas, e as
> outras 101 idênticas.

**Tamanho:** P — uma hora, quase toda de espera de renderização.

---

### F5 — O conjunto `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-22 | Suíte de backend completa, número declarado | **P4** |
| T-23 | **Suíte de navegador completa.** Não deduzir que ela não se moveu — foi essa dedução que falhou na entrega anterior | **P4** |
| T-24 | `ruff` e `mypy` nos arquivos tocados | **P4** |
| T-25 | `README.md`, `CHANGELOG.md`, e a linha do incremento 032 | — |

**Tamanho:** PP — trinta minutos de trabalho, mais ~30 de suítes.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3 ──► F4 ──► F5
P0     P0     P1     P2     P3     P4
              │
              └─ o crivo existe, sem chamador, e nada se moveu
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~4h30, mais três execuções de suíte |

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| Colar prosa numa descrição contratual | `T-8` — o aditivo, cujo texto rejeitado parece descrição de item. É o único teste que reprova crivo frouxo |
| Tomar *"só as palavras que estão na coluna"* e descartar o resto | `D-02` é tudo-ou-nada, e o `T-8` o exercita: a p6 do aditivo **tem** palavras na coluna de descrição |
| Mover um valor numérico | `T-9`, conjunto inteiro contra conjunto inteiro, e `V-CTR-03` nas três peças |
| Inverter a ordem das linhas da cauda | `T-7` afirma o texto por extenso, e o `R-CON-06` o confronta com a aba — duas linhas trocadas produzem cadeia diferente |
| Prever a contagem de textos do corpo em vez de medi-la | `T-19` diz explicitamente para medir. É o erro da ESPEC 031 §2.7, e custou uma revogação |
| Deduzir que a suíte de navegador não se moveu | `T-23`, e a busca 8 do §8 |
| Confundir vermelho herdado com vermelho novo | `T-2` mede as duas linhas de base **antes**, e o navegador já entra com uma falha intermitente conhecida |

---

## 6. O que este plano não faz

- Não toca quantidade, preço, mês, total, ordem, `Contract.aplicar` nem `posicao_de`.
- Não toca a leitura da aba `Levantamento` nem qualquer regra da ESPEC 031.
- Não trata continuação em coluna que não seja a de descrição (`D-03`).
- Não normaliza a caixa do texto reconstruído (`I-01`).
- Não corrige o **problema 3** do mesmo relato — o desdobramento por qualificador do
  `14.025.00011.00`. É defeito distinto, com causa distinta, e pede a sua espec.

---

## 7. As âncoras de documento foram reancoradas há horas

`test_capa.CORPO_DO_PILOTO_*`, as entradas `word/document.xml` de `test_identidade_dos_artefatos` e
o `linhas_do_documento.json` receberam valores novos **hoje**, pela ESPEC 031.

Isso muda uma coisa na `F4`, e vale dizê-la: **o valor "de antes" contra o qual o delta é provado
não é o do `HEAD` do repositório** — é o da `T-5`, medido nesta árvore. Reancorar contra o `HEAD`
desfaria a ESPEC 031 em silêncio, e o `sha256` não diria isso: diria apenas *"diferente"*.

É a regra do TASKS 026 §9.10 — *"reancorar exige delta provado **e** árvore parada"* — no caso em
que a árvore não está parada porque uma entrega anterior ainda não foi commitada.

---

## 8. O inventário, e as oito buscas

Sobre `backend/tests/`:

| # | Busca | O que acha |
|---|---|---|
| 1 | `sha256` | âncoras de pacote e de corpo |
| 2 | `assert len(` | contagens em testes cujo nome não fala de contagem |
| 3 | `ANCORA\s*=` e `\.json` | âncoras em fixture |
| 4 | `12\.074\.00005` e `14\.048\.00008` | os dois códigos, onde quer que apareçam |
| 5 | `descricao` com literal de texto | asserções sobre designação contratual |
| 6 | `CPE-SD-WAN` e `SQL SERVER` | os textos por extenso, que a busca por código não pega |

Sobre `frontend/e2e/` — **as duas que a ESPEC 031 não fez**:

| # | Busca | O que acha |
|---|---|---|
| 7 | os mesmos códigos e textos das buscas 4 a 6 | asserção de tela sobre descrição |
| 8 | `getByText` com literal longo | qualquer cadeia de descrição embutida num seletor |

**O resultado das oito manda na tabela da ESPEC §8.3**, e não o contrário. Âncora nova emenda a
tabela **antes** da `F2` — nunca ajustando valor esperado a valor obtido.

---

## 9. Emenda de execução

**2026-08-20.**

**O inventário de duas suítes funcionou, e o resultado foi *"nenhuma âncora de navegador"* — medido.**
A busca 7 achou uma citação ao `14.048.00008.00` em `derivadas.spec.ts`, e a inspeção mostrou que o
teste afirma linha, código, contratada, medida e emitida: **a célula da descrição não é afirmada**.
Foi preciso abrir o arquivo para saber; a busca sozinha teria dado um falso positivo, e a dedução
sozinha teria dado o falso negativo que custou seis vermelhos na entrega anterior.

**A correção do `P3` antes da `F0` se pagou.** A primeira redação dizia *"só `word/document.xml` se
move"*; o renderizador da análise tem `Descrição` na coluna 2 desde sempre. Medido: movem-se
`sheet3` e `sheet5` no `.xlsx` do piloto e `sheet5` no do PGM. Sem a correção, isto teria parecido
violação do portão — e o reflexo seria investigar o código, não o critério.

**A `T-2186` provou o oposto do que a ESPEC 031 §2.7 supôs, e nas duas vezes supor foi o erro.**
Lá se previu que os textos do corpo cairiam 4 e caíram 11. Aqui eu esperava que subissem, e não
subiram: **16.006 antes e depois**, porque a descrição sai num único `<w:t>`. Só o `sha256` se move.
A instrução *"medir, não prever"* pagou-se nas duas direções.

**O canário numérico cantou por um defeito que não era numérico.** A `T-2176` reprovou logo depois
da costura, e a causa era um `NameError`: faltou o `import replace` de módulo, porque `_identificar`
já o importava **dentro da função** e a busca pela cadeia no arquivo achou o import local. Nenhum
valor se moveu em momento nenhum. O teste cumpriu a função mesmo assim — acusou em 90 segundos o que
apareceria treze minutos depois.

**Um invariante quase quebrado, e a decisão que o evitou.** A costura entra **só em `pendentes`**.
Fechado o bloco, o item passa a viver em `itens` *e* dentro do `BlocoDeItens`, e
`Contract.__post_init__` compara os dois: emendar um só quebraria o agregado com uma mensagem sobre
contagem de itens, a quilômetros da causa. Nos três documentos a linha anterior está sempre
pendente; não estando, é a `R-CON-05` e a `V-CTR-06` a registra.

**E um guarda que só apareceu ao escrever:** uma página pode casar **duas geometrias**. Sem
`caudas_costuradas`, a mesma cauda entraria duas vezes na mesma descrição — e o teste de texto por
extenso teria acusado, mas com uma mensagem que levaria muito tempo para explicar.

**O critério do diff do `.json` teve de mudar, e é consequência da regra 4.** `git diff` compara com
o `HEAD`, e o `HEAD` não é a linha de base desta entrega: as 14 deleções extras são da ESPEC 031,
não commitada. A paridade foi provada por asserção — cada descrição nova **estende** a antiga, e as
outras quatro colunas são idênticas nas 104 linhas. **Numa árvore com entregas empilhadas, contagem
de linhas de diff não serve como prova.**

**Resultado.** Backend **1.404 → 1.422 passed**, zero falhas. `ruff` e `mypy` limpos nos oito
arquivos tocados. Três descrições completas, nenhum valor numérico movido, nenhuma contagem movida.