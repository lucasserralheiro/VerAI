# PLANO 033 — Implementação de "As três tabelas na mesma folha"

| | |
|---|---|
| **Especificação** | [ESPEC 033](../specs/033-as-tres-tabelas-na-mesma-folha.md) v1.0 |
| **Versão** | 1.0 — 2026-08-27 — **executado** em 2026-08-27. A emenda está no §9 |
| **Backlog** | TASKS 033, a escrever. Numeração continua de `T-2192`, a última da ESPEC 032 |
| **Estado inicial** | Árvore **limpa**: só `README.md` modificado, de antes desta entrega, e a ESPEC 033 nova. Nenhuma entrega empilhada — ao contrário do PLANO 032, que rodou sobre 46 arquivos fora do `HEAD`. Backend **medido no `HEAD`**: `1.422 passed, 1 warning in 930,51s`. Navegador: **119 de 120** conforme a ESPEC 032, com a intermitente do `I-06` do TASKS 032 — **a remedir**, não a supor |
| **Colisão conhecida** | Nenhuma. Os três arquivos tocados — `grid.py`, `pdfplumber_extractor.py`, `quantity.py` — estão commitados e estáveis desde `90dcd6d`. A ESPEC 032 mexeu nos dois primeiros, mas já entrou |
| **Instrumento existente** | **O protótipo já foi construído e medido**, e a régua desta entrega saiu dele: a tabela de `sha` da ESPEC §8.2, a contagem de células da §2.6 e os tempos da §8.2. `V-CTR-03` é o oráculo independente, por peça. Nada disso precisa ser inventado na execução — precisa ser **reproduzido** |

---

## 1. O que este plano tem de diferente dos anteriores

> **O risco não é deixar de ler o SMUL. É mover um número nos dez que já leem.**
> O defeito de hoje é ruidoso: 422 na cara de quem submete. O defeito que uma correção mal feita
> introduz é silencioso — uma linha fatiada com as divisórias erradas em documento que hoje sai
> certo, e um `.docx` de faturamento com um valor a menos. Por isso a régua desta entrega é
> **igualdade de `sha`**, e não inspeção.

> **Esta é, provavelmente, a primeira entrega em muitas em que NENHUMA âncora de documento se move.**
> O delta previsto sobre `.docx`, `.xlsx` e `linhas_do_documento.json` é **zero**. Isso inverte o
> portão de reancoragem dos planos anteriores: lá, o trabalho era provar que o delta era exatamente
> o previsto; aqui, **qualquer** movimento é defeito. Ninguém reancora nada nesta entrega — e se
> alguém sentir vontade de reancorar, a `F3` fez algo errado.

> **A tentação a evitar tem nome, número e teste.**
> A leitura por faixa parece boa também dentro do crivo de admissão. **Medido: seria ruína.** Ela
> aprovaria **todas** as candidatas — 2 de 2 no piloto, 2 de 2 no PGM, 4 de 4 no aditivo do PGM e
> 5 de 5 no SMUL —, inclusive a geometria do cronograma que a ESPEC 019 §2.5 barrou. `R-FXA-06` é
> regra por isso, e `test_t1305_tres_das_quatro_geometrias_sao_tabela_de_itens` é quem a defende.

> **A ordem das duas correções é um instrumento, não uma preferência.**
> Corrigida só a geometria, o SMUL **continua falhando** — e falha com uma mensagem **diferente e
> prevista**: `sem valor total`, no mesmo item. Isso transforma o fim da `F3` num portão de verdade:
> se a mensagem for outra, a leitura por faixa não fez o que se espera dela, e descobrimos isso
> antes de o segundo defeito mascarar o primeiro.

> **A leitura muda em documentos que hoje passam — e isso é esperado, medido e inofensivo.**
> Doze linhas no piloto, 15 no PGM, 14 no aditivo, 14 na proposta SMUL: **todas** do cronograma
> físico-financeiro, nenhuma com código de serviço, nenhuma com `TOTAL:` (o cronograma grafa
> `TOTAL`, sem dois-pontos). Quem executar vai ver diferença ao depurar e precisa saber, **antes**,
> que ela está prevista na ESPEC §8.3 — senão vai investigar um falso positivo, como quase
> aconteceu com o `.xlsx` de análise no PLANO 032 §9.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Linha de base das duas suítes, fixtures dentro, testes reprovando pelo motivo certo** | Fim da `F1` | As **seis** buscas do §8 executadas. Backend e navegador medidos na árvore parada. Os dois PDFs do SMUL como fixture, com o `sha256` do arquivo registrado. Os testes novos do SMUL reprovam com **`sem preço unitário, meses`** na mensagem; os de invariante (`R-FXA-07`) **passam já** | Inventário deduzido é o defeito que o projeto já cometeu quatro vezes (PLANO 032 §1). E teste que reprova pelo motivo errado não é régua |
| **P1 — A função existe, sem chamador, e nada se moveu** | Fim da `F2` | As divisórias por linha calculadas corretamente para as cinco faixas da página 4 (ESPEC §2.1) e para a linha `TOTAL:` por herança. `ler_celulas` **sem** o parâmetro continua idêntica. Suíte de backend igual à `F0`, teste a teste | Diferença aqui é vazamento: a função alcançou o extrator antes de a `F3` autorizar. Reverter a `F2` |
| **P2 — O laço lê por faixa, e os dez `sha` não se movem** | Fim da `F3` | Os **dez** `sha` da ESPEC §8.2 idênticos, e com eles os totais, os blocos e a lista de geometrias admitidas. O SMUL falha com **`sem valor total`** — a mensagem prevista, não outra | Reverter a `F3`. `sha` que se mova é exatamente o defeito que esta espec existe para não causar |
| **P3 — O sinal, com o alcance medido** | Fim da `F4` | SMUL: **16 itens, 3 blocos, `364.793,93`**, `V-CTR-03` fechando. Os dez `sha` **ainda** idênticos. A varredura da ESPEC §2.6 reproduzida: uma cadeia distinta muda de resposta em 8.310 células | Reverter a `F4`. Normalização que mude mais de uma cadeia no corpus não é a `R-NUM-01` |
| **P4 — As duas suítes e as estáticas** | Fim da `F5` | Backend verde com número declarado, **maior ou igual** à `F0`. Navegador **sem falha nova** sobre a linha de base da `F0`. `ruff` e `mypy` limpos nos arquivos tocados. **Nenhum artefato reancorado** | Não entregar |

---

## 3. Fases

### F0 — Linha de base, fixtures e a régua `[portão]`

**Objetivo:** ter a régua reproduzível **antes** de escrever código, e as fixtures dentro da suíte.

| # | Tarefa | Ref. |
|---|---|---|
| T-1 | Executar as **seis** buscas do §8. O resultado manda na tabela da ESPEC §8.1 — não o contrário | §8 |
| T-2 | Linha de base das **duas** suítes na árvore parada. O backend já está medido — `1.422 passed` em 930,5 s —; falta o **navegador**, com o conjunto de falhas de hoje nomeado, para separar herdado de novo | **P0**, **P4** |
| T-3 | Trazer os dois PDFs do SMUL para `tests/fixtures/` e registrá-los no `conftest.py`, no padrão das fixtures de sessão existentes. **Só os PDFs** (§6) | `D-08` |
| T-4 | Instrumentar a régua: um script fora de `src/` que extrai cada peça do corpus e imprime `(itens, total, blocos, geometrias, sha)`. É o que produziu a ESPEC §8.2, e é o que a `F3` e a `F4` vão reexecutar. Precedente: `scripts/diagnostico_grade_contrato.py` | **P2**, **P3** |
| T-5 | Rodar a régua na árvore parada e **congelar** a tabela de dez linhas. Este é o "antes" desta entrega | **P2** |
| T-6 | Remedir, na árvore parada, os fatos da ESPEC §2.1: as cinco faixas de oito divisórias da página 4, com os valores por extenso | `R-FXA-01` |

**Verificação:** `P0` (primeira metade).

> **A régua é de `sha`, e o `sha` é do conjunto — não de amostra.** Comparar "alguns itens" foi o que
> deixou passar o defeito da ESPEC 031. Aqui a tupla é `(código, descrição, unidade, quantidade,
> preço, meses, total, página)` de **todos** os itens, de **todas** as peças.

> **`T-3` traz PDF, e só.** O levantamento do SMUL fica de fora, e há uma razão a mais do que o
> escopo: o hook de pré-commit casa `SMIT.*Levantamento.*\.xlsx`, e **não** pegaria um
> `SMUL_Levantamento…xlsx` com a aba de dados pessoais. Trazer a planilha exigiria sanitizar **e**
> alargar o hook — outra entrega (§6).

**Tamanho:** P — uma hora, mais o tempo das suítes.

---

### F1 — Os testes, escritos antes `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-7 | Módulo novo `tests/test_grade_por_faixa.py`: as divisórias que valem em cada linha da página 4 do SMUL, faixa por faixa, com os valores da ESPEC §2.1 por extenso | `R-FXA-01`, `R-FXA-02` |
| T-8 | A herança da linha `TOTAL:`: os traços `428,7` e `516,9` do `Redução TOTAL:` são subconjunto do conjunto da `Redução` e **não** do da `Inclusão`. **É o teste que reprova herança por proximidade** | `R-FXA-03`, `D-05` |
| T-9 | A cobertura com espessura de traço: `57,0` contra `57,7`. Caso construído, sem abrir PDF, no espírito de `_escolher_gabarito` | `R-FXA-05` |
| T-10 | `tests/test_extractor_aditivo_smul.py`: os quatro valores da linha do `12.030.00002.00` — `-200,00`, `986,81`, `5`, `-986.810,00` — por extenso | `R-FXA-08` |
| T-11 | Os três blocos do SMUL com rótulo, contagem e total; `V-CTR-03` fechando em `364.793,93` | `R-FXA-08` |
| T-12 | **O teste que segura tudo:** os dez `sha` da ESPEC §8.2 como asserção, peça a peça, com totais, blocos e número de geometrias admitidas | `R-FXA-07`, **P2** |
| T-13 | `para_decimal`: `'BRL - 986.810,00'` → `-986810.00`; `'PACOTE'`, `'Perfil D'`, `'- '` → `None`; `'BRL 229,02'`, `'4.000,00'`, `'1500'`, `'117,2889'` inalterados | `R-NUM-01` |
| T-14 | **[portão]** Rodar contra o `HEAD`: `T-10` e `T-11` reprovam com **`sem preço unitário, meses`** na mensagem; `T-12` e o invariante **passam já**; `T-13` reprova só no caso do sinal | **P0** |

**Verificação:** `P0`.

> **`T-12` é o teste mais importante deste plano.** É o único que separa *"corrigi o SMUL"* de
> *"corrigi o SMUL sem quebrar o resto"*, e é ele que vai reprovar se alguém, meses depois, achar
> que a leitura por faixa também serve para a admissão.

> **`T-14` tem testes que passam antes de qualquer código novo, e isso é resultado.** `T-12` passa
> porque a extração dos dez documentos não muda — nem antes, nem depois. Um teste de invariante que
> só fica verde depois da mudança não estaria medindo invariante nenhum.

**Tamanho:** P — duas horas. O grosso é `T-12`.

---

### F2 — As divisórias por linha, sem chamador `[portão]`

**Objetivo:** a função existindo, testada e **inerte**.

| # | Tarefa | Ref. |
|---|---|---|
| T-15 | `grid.py` — função nova que recebe página e grade e devolve, **para cada linha**, as divisórias que valem: faixa própria de oito (a mais estreita, `R-FXA-02`), herança por subconjunto (`R-FXA-03`), ou as da página (`R-FXA-04`) | `R-FXA-01` a `R-FXA-05` |
| T-16 | `ler_celulas` ganha o parâmetro de leitura por faixa, **com o padrão de hoje**. Sem o parâmetro, a função é a de sempre — e é o que mantém `_linhas` e a admissão intocadas | `R-FXA-06`, `D-03` |
| T-17 | **[portão]** `T-7`, `T-8` e `T-9` verdes. Suíte de backend idêntica à `T-2`, teste a teste. A régua da `T-5` reproduzida sem uma diferença | **P1** |

**Verificação:** `P1`.

> **O parâmetro tem padrão, e o padrão é o comportamento de hoje.** É o que torna a `F2` provável de
> ser inerte por construção, e não por cuidado: nenhum chamador existente passa o parâmetro, logo
> nenhum chamador existente muda.

> **A herança é por subconjunto, não por proximidade — e a função precisa deixar isso legível.**
> Quem ler daqui a um ano tem de encontrar, no lugar da decisão, os dois traços do `Redução TOTAL:`
> e a razão de `516,9` não existir no conjunto da `Inclusão`.

**Tamanho:** PP — quarenta minutos.

---

### F3 — A linha do laço `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-18 | `pdfplumber_extractor.py` — o laço de extração passa a ler por faixa. **Uma linha.** `_linhas`, usada pela admissão, **não** muda | `R-FXA-06` |
| T-19 | **[portão]** Reexecutar a régua: os dez `sha` idênticos à `T-5`, com totais, blocos e geometrias admitidas | **P2** |
| T-20 | **[portão]** O SMUL falha com **`sem valor total`** no `12.030.00002.00`. Mensagem diferente da prevista reprova a fase | **P2** |
| T-21 | Conferir que as linhas que mudam de leitura são as do cronograma, e só elas: 12 · 15 · 14 · 14, nas páginas 29, 25, 7 e 13 (ESPEC §8.3) | ESPEC §8.3 |

**Verificação:** `P2`.

> **`T-20` é contraintuitivo e é o ponto.** Terminar uma fase com o documento-alvo **ainda
> quebrado**, e com a mensagem certa, prova que a leitura por faixa entregou o que promete — e prova
> que o segundo defeito é mesmo independente. Corrigir os dois juntos deixaria isso por conta da fé.

> **`T-21` não é opcional.** É a diferença entre saber que o cronograma mudou e descobrir na
> depuração. A ESPEC §8.3 já diz quais linhas e por que não importam; a tarefa é confirmar que são
> essas.

**Tamanho:** PP — trinta minutos, quase todo de medição.

---

### F4 — O sinal `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-22 | `quantity.py` — `para_decimal` normaliza **o espaço entre o sinal e os dígitos**, e nada mais | `R-NUM-01`, `D-06` |
| T-23 | **[portão]** SMUL: 16 itens, 3 blocos, `364.793,93`, `V-CTR-03` fechando | **P3** |
| T-24 | **[portão]** Os dez `sha` **ainda** idênticos | **P3** |
| T-25 | Reproduzir a varredura da ESPEC §2.6: 7.882 células de PDF e 428 de planilha, com **uma** cadeia distinta mudando de resposta | **P3**, `D-06` |

**Verificação:** `P3`.

> **`D-06` proíbe a generalização tentadora.** Remover todo espaço interno faria
> `'BRL -200,00 986,81'` — a célula fundida do §2.4 — deixar de ser recusada por sorte, e não por
> regra. A guarda de `_montar_item` tem de continuar recusando célula fundida; é ela que denuncia
> tabela genuinamente truncada.

**Tamanho:** PP — vinte minutos.

---

### F5 — O conjunto `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-26 | Suíte de backend completa, número declarado, comparado com a `T-2` | **P4** |
| T-27 | **Suíte de navegador completa.** Não deduzir que ela não se moveu — foi essa dedução que falhou na ESPEC 031 e custou seis vermelhos | **P4** |
| T-28 | **Conferir que nenhum artefato foi reancorado:** `test_capa`, `test_identidade_dos_artefatos`, `linhas_do_documento.json` e as âncoras de `.xlsx` intactos no `git diff` | **P4** |
| T-29 | `ruff` e `mypy` nos arquivos tocados | **P4** |
| T-30 | `README.md` (linha do incremento 033), `docs/CHANGELOG.md`, e o `Status` da ESPEC 033 de **Proposta** para **Implementada**, com os números medidos | — |

**Verificação:** `P4`.

> **`T-28` é o portão invertido desta entrega.** Nos planos anteriores, a tarefa equivalente
> conferia que a reancoragem foi feita direito. Aqui ela confere que **não houve** reancoragem: o
> `git diff` de `backend/tests/` deve conter arquivos **novos** e nenhuma constante alterada.

**Tamanho:** PP — trinta minutos de trabalho, mais ~30 de suítes.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3 ──► F4 ──► F5
P0     P0     P1     P2     P3     P4
              │      │      │
              │      │      └─ SMUL verde; dez sha ainda idênticos
              │      └──────── SMUL falha com a mensagem PREVISTA; dez sha idênticos
              └─────────────── a função existe, sem chamador, e nada se moveu
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~4h30, mais três execuções de suíte |

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| Mover um valor num documento que hoje sai certo | `T-12`, os dez `sha`, reexecutado em `T-19` e `T-24`. E `V-CTR-03`, que é independente do código de teste |
| Aplicar a leitura por faixa também no crivo de admissão | `test_t1305_tres_das_quatro_geometrias_sao_tabela_de_itens` (3 de 4) e `test_t1305_sem_o_crivo_o_cronograma_injetaria_lixo` (6 e 5 linhas malformadas). Medido: por faixa, **todas** as candidatas seriam admitidas |
| A herança atravessar para a tabela de baixo | `T-8`. `516,9` não existe no conjunto da `Inclusão`, e é o que reprova herança por proximidade |
| Mexer em `TOLERANCIA` achando que o defeito é de aproximação | `D-04`, corrigido na v1.1 da espec: na página 4 os cinco gabaritos casam **exatos**, e a tolerância não é exercida. Mexer nela quebraria a `R-GRD-04` sem tocar no problema |
| Generalizar `para_decimal` para remover todo espaço interno | `T-25` — a varredura acusaria mais de uma cadeia mudando — e `D-06` |
| Investigar as linhas do cronograma como se fossem regressão | `T-21` e a ESPEC §8.3, que já as preveem e explicam |
| Reancorar um artefato "porque mudou" | `T-28`. Nesta entrega, artefato que muda é defeito — não âncora velha |
| Confundir vermelho herdado com vermelho novo no navegador | `T-2` mede as duas linhas de base **antes**; o navegador já entra com a intermitente do `I-06` |
| Deduzir que a suíte de navegador não se moveu | `T-27`, e a busca 6 do §8 |

---

## 6. O que este plano não faz

- **Não muda o crivo de admissão** nem a escolha do gabarito (`R-FXA-06`, `R-GRD-02`).
- **Não mexe em `TOLERANCIA`** (`D-04`).
- **Não cria validação nova** (`D-07`). O oráculo é `V-CTR-03`, e ele já existe.
- **Não traz o levantamento do SMUL para a suíte.** Fora do escopo da espec, e há um segundo motivo
  medido: o hook de pré-commit casa `SMIT.*Levantamento.*\.xlsx` e **não** pegaria a planilha do
  SMUL. Alargar o hook e sanitizar é trabalho próprio, e vale abrir — o `test_dado_pessoal` só cobre
  a fixture que já está dentro.
- **Não persegue os dois avisos observados no par SMUL** (ESPEC §8.4): o nome do órgão não derivado
  (`R-CAP-04`) e o código repetido sem bloco de desconto (`R-MED-02`). São pré-existentes, e cada um
  pede a sua análise.
- **Não consolida candidatas quase iguais** na descoberta da geometria (`I-02`): é desempenho, não
  correção.

---

## 7. A régua desta entrega é a igualdade, não a reancoragem

Vale dizer explicitamente, porque contraria o hábito dos últimos incrementos.

Da ESPEC 030 à 032, toda entrega mexeu no que sai no documento, e o trabalho de prova foi **medir o
delta e reancorar**: `CORPO_DO_PILOTO_*`, as entradas do pacote em `test_identidade_dos_artefatos`,
o `linhas_do_documento.json`. Havia sempre a pergunta *"quanto pode mudar?"*.

Aqui a resposta é **nada**. Um documento que hoje gera tem de gerar byte por byte o mesmo, e por
isso:

1. o "antes" desta entrega é a régua da `T-5`, medida nesta árvore — que, por sorte, coincide com o
   `HEAD`, porque a árvore está limpa. **É a primeira vez em três entregas que coincide**, e ainda
   assim a `T-5` mede em vez de supor;
2. nenhuma constante de teste deve aparecer alterada no `git diff` final (`T-28`);
3. o que **deve** aparecer é arquivo novo: dois PDFs, dois módulos de teste, um script de medição.

Se, ao fim da `F3`, alguém estiver diante de um `sha` diferente e pensando *"deve ser reancoragem"*,
a resposta é não. É a `F3` errada.

---

## 8. O inventário, e as seis buscas

Sobre `backend/tests/`:

| # | Busca | O que acha | O que já se sabe |
|---|---|---|---|
| 1 | `ler_celulas`, `montar_grade`, `_faixas_verticais`, `analisar_geometria` | quem depende da assinatura que ganha parâmetro | `test_grade_contrato.py`, `test_extractor_aditivo.py`, `test_cauda_de_pagina.py` |
| 2 | `para_decimal` | os casos que a `R-NUM-01` toca | `test_domain.py`, `test_analise.py` |
| 3 | `_geometrias_de_itens`, `candidatos`, `_e_item_completo` | as asserções sobre admissão, que `R-FXA-06` promete não mover | `test_extractor_aditivo.py:165-228`, `test_grade_contrato.py:301-313` |
| 4 | `sha256` | as âncoras de pacote e de corpo, que **não** podem se mover | `pacote.py`, `test_capa.py`, `test_docx_formatacao.py`, `test_identidade_dos_artefatos.py` |
| 5 | `12\.030\.00002`, `986\.810`, `364\.793` | o código e os valores do SMUL, onde quer que já apareçam | `12.030.00002.00` aparece na ESPEC 019 §2.7 como item **excluído** do piloto — conferir se algum teste o afirma ausente |

Sobre `frontend/e2e/`:

| # | Busca | O que acha | O que já se sabe |
|---|---|---|---|
| 6 | os mesmos códigos e valores da busca 5, e `getByText` com literal numérico | asserção de tela sobre valor de item | Uma varredura preliminar não achou nada — **e isso não dispensa a tarefa.** Foi exatamente essa dedução que falhou na ESPEC 031 |

**O resultado das seis manda na tabela da ESPEC §8.1**, e não o contrário. Âncora nova emenda a
tabela **antes** da `F2` — nunca ajustando valor esperado a valor obtido.

> **A busca 5 tem uma armadilha conhecida.** O `12.030.00002.00` é o mesmo código que a ESPEC 019
> §2.7 usou para provar que *"os excluídos já não estão na tabela"* do `PA-SMIT-260319-739`. Um
> teste que afirme a ausência dele **naquele** documento continua certo, e não tem relação com o
> SMUL. Confundir os dois faria alguém "corrigir" um teste que está correto.

---

## 9. Emenda de execução

**2026-08-27.** Executado em ~5h, das quais quase duas foram de suíte e uma de investigação de um
vermelho alheio.

**O que o plano acertou.** As cinco fases correram na ordem, e os cinco portões fecharam. A `F3`
terminar com o documento-alvo **ainda quebrado**, com `sem valor total`, foi o melhor instrumento
deste plano: separou os dois defeitos na prática, e não na argumentação. A régua de `sha` foi
executada três vezes e nunca se moveu — em nenhum momento houve a dúvida de reancoragem que os
últimos três incrementos tiveram.

**O que o plano errou, e a `F0` pegou.** O §2.3 da espec explicava o defeito pela `TOLERANCIA`, e a
`T-2198` mediu que ela não é exercida: as cinco candidatas casam exatas contra as 22 verticais da
página. A espec foi para v1.1 e o `D-04` foi restabelecido por outra razão. **A fase de medir antes
de codificar existe para isto**, e foi a única vez em muitos incrementos em que ela derrubou a
explicação em vez de confirmá-la.

**O que o plano subestimou.** A `T-2194`/`T-2219` estavam dimensionadas como `PP` — *rodar e
comparar*. A suíte de navegador voltou com uma falha de nome novo, e provar que era pré-existente
custou reverter só o `src/`, reiniciar o backend e rodar de novo — com uma armadilha no meio: **matar
a tarefa de fundo não mata o `uvicorn`**, e a primeira medição do `HEAD` rodou contra o servidor
antigo, com o código modificado em memória. O `Errno 10048` no log foi quem denunciou.

Se o plano tivesse uma sexta regra, seria essa: *ao medir o `HEAD` contra a árvore modificada, conferir
a porta, e não a tarefa.*

**O que ficou aberto, e é de outra entrega.** `a11y-estrutura.spec.ts:252` contradiz
`analise.spec.ts:183` sobre o `14.049.00054.00` desde que a apuração descontada mudou. Registrado no
`I-06` do TASKS 033, e **não corrigido aqui** — a regra 4 vale nas duas direções.
