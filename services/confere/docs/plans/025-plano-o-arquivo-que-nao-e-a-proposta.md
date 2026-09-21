# PLANO 025 — Implementação de "O arquivo que não é a proposta"

| | |
|---|---|
| **Especificação** | [ESPEC 025](../specs/025-o-arquivo-que-nao-e-a-proposta.md) v1.0 |
| **Versão** | 1.0 — 2026-08-18 — **executado**. Quatro desvios registrados no §10 do TASKS 025 |
| **Estado inicial** | **559 testes de backend** coletados (21 min de suíte cheia) e 13 arquivos de navegador · `modelo.pdf` submetido como contrato produz **três** achados: `V-ADT-01`, `V-CTR-01` e `V-CAP-01` · **11** asserções de backend leem `.mensagem` (§5) · o texto *"Processamento bloqueado"* está em **quatro arquivos** do frontend (§5.4) |
| **Instrumentos existentes** | `caminho_modelo` já existe em `conftest.py:95`, e aponta para o arquivo exato da ESPEC §2.1. `caminho_levantamento` idem. **A âncora deste plano não precisa de fixture nova** — o par que reproduz a tela já está no repositório |
| **Numeração dos portões** | Este plano usa `P0`–`P7`. Os da ESPEC §10 são `P0`–`P8`: o `P0` **da espec** é o `P4` daqui; o `P1` da espec é o `P4` também; o `P8` da espec (a pessoa do faturamento) é o `P6` daqui |
| **Numeração das tarefas** | `T-1900` em diante. A última usada no repositório é `T-1809` |

---

## 1. O princípio que ordena este plano

Esta entrega é menor que a ESPEC 023 e falha por um motivo específico, que não é o de lá.

> **Ao contrário do PLANO 023, aqui o estado existe nas fixtures — e é por isso que a âncora não
> pode ser dublê.**
> `estados.bloqueado` é um 422 sintético porque *"nenhuma combinação das fixtures do repositório
> produz achado bloqueante"* (`estados.ts:47`). **Isso deixou de ser verdade**: `modelo.pdf` no
> campo contrato produz os três achados da §1 da espec, por 17 s de extração. A F0 escreve a âncora
> **contra os arquivos reais**, no `pytest`. Um dublê aqui mediria a renderização de um objeto
> inventado e deixaria o backend livre para errar.

> **A armadilha do plano é o padrão de `parece_proposta`.**
> Trinta e tantos pontos da suíte constroem `Contract(proposta="X")` sem diagnóstico, e a
> `test_t1121_sem_diagnostico_a_mensagem_e_a_de_sempre` existe justamente para guardar essa
> fronteira. Se `V-DOC-01` puder disparar sem diagnóstico, ela e a `T-1330` viram vermelhas — e,
> pior, o caminho `V-ADT-01` desaparece de toda a suíte sem que nada o diga. **Sem diagnóstico, a
> peça é reconhecida como proposta.** É a única leitura conservadora, e a `T-1904` a fixa antes de
> existir código para ela.

> **O substituto vem antes da remoção.** `R-DOC-07` manda `V-CTR-01` e `V-CAP-01` calarem sobre
> peça bloqueada. A F2 faz isso **antes** de `V-DOC-01` existir, e é publicável sozinha: o usuário
> passa de três mensagens confusas para uma mensagem confusa, o que já é ganho. A mensagem boa vem
> na F4, e a F2 não depende dela.

> **A F1 não toca no backend, e é a que mais economiza.** `R-DOC-08` são 16,6 s de espera e uma
> tela de erro evitados por uma comparação de string. Sai primeiro, sozinha, e nada abaixo dela
> depende disso.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — A âncora existe e mostra o defeito** | Fim da F0 | Um teste de backend submete `modelo.pdf` como contrato e encontra **exatamente** `V-ADT-01`, `V-CTR-01` e `V-CAP-01`. Rodado contra o código intocado, ele passa | Não começar a F1. Sem essa âncora, toda afirmação deste plano sobre "três viram um" é opinião |
| **P1 — O aviso aparece antes de processar** | Fim da F1 | Escolhido um arquivo com `levantamento` no nome no campo Contrato, o aviso surge **sem** requisição ao backend, e *Enviar assim mesmo* segue o fluxo normal | A F1 é publicável sozinha; corrigir antes de seguir |
| **P2 — Três achados viram um** | Fim da F2 | A âncora do P0, reancorada, encontra **um** bloqueante. `V-CTR-01` e `V-CAP-01` não são mais registradas sobre peça bloqueada, e continuam registradas quando a peça não está | Reverter a F2. A supressão errada esconde achado legítimo, que é pior que repeti-lo |
| **P3 — Os quatro degraus decidem sem abrir PDF** | Fim da F3 | A função pura da causa é exercitada nos quatro degraus da `R-DOC-03` sobre `DiagnosticoDaGrade` construído à mão — inclusive o degrau 1, que não tem fixture | Se ela exigir um PDF, ela está no lugar errado (`D-04`) |
| **P4 — `V-DOC-01` acusa o modelo e cala nos três reais** | Fim da F4 | `modelo.pdf` → `V-DOC-01` com as três referências de proposta. `contrato.pdf`, `contrato_pgm.pdf` e `aditivo_pgm.pdf` → **nenhum** `V-DOC-01`. `amostra-p1.pdf` → `V-DOC-01` sem linha de evidência | Não seguir. Um falso positivo aqui recusa proposta legítima, que é o pior resultado possível desta espec |
| **P5 — A tela diz qual arquivo enviar** | Fim da F5 | O cartão exibe título, causa, ação e `▸ detalhes`; o colchete de diagnóstico não aparece mais no corpo da frase; o nome do arquivo está visível | Reverter a F5. A F4 é publicável sozinha, com a mensagem concatenada |
| **P6 — A pessoa** | Fim da F6 | Alguém do faturamento, sem explicação prévia, vê a tela e diz qual arquivo deve enviar (espec `P8`) | Não é falha de código: é redação da §9 da espec. Corrigir e repetir |
| **P7 — O conjunto** | Fim da F6 | Backend verde com contagem reconciliada; navegador sem falha nova; `axe` A/AA em 1366 e 390; `ruff`, `mypy`, `tsc --noEmit`, `next lint`, `next build` limpos | Não entregar |

**O portão mais fácil de pular é o P4**, porque o caso feliz — o `modelo.pdf` acusado — é o que dá
prazer escrever. Os três negativos são o que impede a espec de recusar proposta boa, e são eles que
justificam a `R-DOC-02` exigir **dois** sinais negativos.

---

## 3. Fases

### F0 — A âncora que reproduz a tela `[portão P0]`

**Objetivo:** poder afirmar, ao final, o que mudou. **Nenhum arquivo de `src/` é tocado.**

| # | Tarefa | Ref. |
|---|---|---|
| T-1900 | `test_documento_submetido.py`: `DIContainer().gerar(Entradas(contrato=caminho_modelo, levantamento=caminho_levantamento))`. Asserção sobre o **conjunto** de validações — `{"V-ADT-01", "V-CTR-01", "V-CAP-01"}` —, não sobre a primeira | **P0**, ESPEC §1 |
| T-1901 | Medir o custo do teste e decidir o escopo da fixture. `modelo.pdf` custa ~17 s; se a suíte passar a pedi-lo mais de uma vez, cachear no padrão de `fontes_caras` | — |
| T-1902 | Registrar no cabeçalho de `estados.ts` que a afirmação da linha 47 caducou: as fixtures **passaram** a produzir bloqueio | §5.4 |
| T-1903 | Inventariar as seis ocorrências de *"Processamento bloqueado"*, em quatro arquivos, para que a F5 não esqueça nenhuma | §5.4 |
| T-1904 | **[portão]** O canário do padrão: `v_doc_01` sobre `Contract(proposta="X")` **sem diagnóstico** não registra nada. Escrito agora, contra função que ainda não existe — fica vermelho por import até a F4, e é intencional | §1, `R-DOC-02` |

**Verificação:** P0. `T-1900` passa hoje, encontrando os três achados.

> **A `T-1900` é a tarefa que salva o plano.** O instinto é escrever a asserção como
> `achados.bloqueantes[0].validacao == "V-ADT-01"`. Com índice, a F2 fica verde tendo removido a
> validação errada. Sobre o conjunto, ela reprova até que sobre exatamente o que se quer.

**Tamanho:** P — duas horas. **Encerra:** P0.

---

### F1 — O aviso do formulário `[portão P1]` `[publicável sozinha]`

**Objetivo:** evitar a espera e a tela de erro no caso mais comum. **Nenhum arquivo de backend é
tocado.**

| # | Tarefa | Ref. |
|---|---|---|
| T-1905 | `UploadForm`: ao escolher arquivo no campo Contrato, comparar o nome com o vocabulário de levantamento (`levantamento`, `_GRC`, `comprovacao`). Aviso inline, com *Enviar assim mesmo* e *Trocar arquivo* | `R-DOC-08` |
| T-1906 | O aviso é `role="status"`, não `alert`: não interrompe, porque não é erro. Segue a `R-ACE-13` e entra no `inventario-de-anuncios.ts` | ESPEC 008 |
| T-1907 | **[portão]** `e2e/documento.spec.ts`: escolher um arquivo com `levantamento` no nome faz o aviso surgir **sem** requisição — asserção sobre `page.route` não ter sido chamada | **P1** |
| T-1908 | O aviso não bloqueia: *Enviar assim mesmo* segue o fluxo, e o botão Gerar continua habilitado o tempo todo | `R-DOC-08`, `D-07` |

**Verificação:** P1.

> **O aviso julga pelo nome, que é sinal fraco — e é por isso que ele avisa e não impede.** Um
> arquivo chamado `proposta_do_levantamento_2026.pdf` dispara o aviso e é legítimo. A saída
> *Enviar assim mesmo* é o que torna o falso positivo barato; sem ela, esta tarefa não deveria
> existir.

**Tamanho:** P — três horas. **Encerra:** P1. **Publicável sozinha.**

---

### F2 — O nome do arquivo e o fim da cascata `[portão P2]` `[publicável sozinha]`

**Objetivo:** três achados viram um, e a peça passa a ter nome. **`V-DOC-01` ainda não existe.**

| # | Tarefa | Ref. |
|---|---|---|
| T-1909 | `Entradas` ganha os nomes originais dos arquivos, hoje perdidos em `gravar(..., "contrato")`. Nome original **só para exibição**; o caminho em disco continua posicional, pela razão da `R-ADT-10` | `R-DOC-06` |
| T-1910 | `v_adt_01_peca_sem_itens` passa a nomear o arquivo quando `peca.proposta` está vazio, em vez de *"(sem identificação)"* | `R-DOC-06` |
| T-1911 | `container.gerar`: `v_ctr_01_tabela_localizada` só é chamada quando **todas** as peças renderam itens. A guarda vive no orquestrador, como as outras (`R-GRD-06`, ESPEC 019 `D-06`) | `R-DOC-07` |
| T-1912 | `v_cap_01_cliente_nao_derivado` só é chamada quando a proposta tem itens. **O texto da validação não muda** — §5.2 | `R-DOC-07` |
| T-1913 | **[portão]** A âncora da `T-1900` reancorada: **um** bloqueante, `V-ADT-01`, com o nome do arquivo na mensagem | **P2** |
| T-1914 | O negativo da supressão: proposta legítima **sem** cliente derivado continua produzindo `V-CAP-01` — a `T-1425` já é esse teste, e basta confirmá-la verde | `R-DOC-07` |

**Verificação:** P2. Contagem de backend reconciliada.

> **A `T-1914` é o contrapeso da `T-1912`.** Suprimir por gravidade é fácil de exagerar: o passo
> seguinte natural — *"esconder todo aviso quando há bloqueio"* — apagaria informação legítima. A
> `R-DOC-07` é sobre **consequência da mesma peça**, e não sobre gravidade.

**Tamanho:** M — meio dia. **Encerra:** P2. **Publicável sozinha.**

---

### F3 — Os sinais e a função pura da causa `[portão P3]`

**Objetivo:** o diagnóstico passa a carregar o que já era calculado, e a causa vira função
testável. **Nada muda na tela.**

| # | Tarefa | Ref. |
|---|---|---|
| T-1915 | `DiagnosticoDaGrade` ganha `geometrias_candidatas: int`, `codigos_nas_candidatas: tuple[int, ...]` e `parece_proposta: bool` — **por último e com padrão**, pela razão que o próprio campo `diagnostico` já registra | `R-DOC-01` |
| T-1916 | `analisar_geometria` e o extrator preenchem os três. `parece_proposta` é `_PROPOSTA` na p.1 **ou** alguma candidata com código. Sem diagnóstico, o valor é o conservador (§1) | `R-DOC-02` |
| T-1917 | As referências citadas na p.1: `_REFERENCIA = \b(?:PC\|PA)-[A-Z]+-[\d-]+`, sobre a **mesma string** que `_proposta()` e `_cliente()` já percorrem. Nenhuma leitura nova de PDF | `R-DOC-01`, ESPEC §2.4 |
| T-1918 | `causa_provavel(diagnostico) -> Causa` — função pura, com os quatro degraus da `R-DOC-03`, no lugar e no espírito de `_escolher_gabarito` | `D-04` |
| T-1919 | **[portão]** Os quatro degraus sobre `DiagnosticoDaGrade` construído à mão, sem abrir PDF — inclusive o degrau 1, que não tem fixture no repositório | **P3**, ESPEC `P2` |
| T-1920 | O gabarito dos sinais: os quatro PDFs da ESPEC §2.3 produzem `parece_proposta` `True, True, True, False`. **É a medição da espec virando teste** | `R-DOC-02` |

**Verificação:** P3. A tela e a API não mudaram.

> **A `T-1920` é a que impede a regra de nascer torta.** Ela é barata — quatro arquivos, uma
> asserção — e é a única prova de que a `R-DOC-02` não recusa proposta legítima. Escrita depois da
> F4, ela vira confirmação; escrita aqui, é gabarito.

**Tamanho:** M — meio dia. **Encerra:** P3.

---

### F4 — `V-DOC-01` entra, `V-ADT-01` se restringe `[portão P4]` `[publicável sozinha]`

**Objetivo:** a mensagem certa, ainda na forma de `mensagem` concatenada.

| # | Tarefa | Ref. |
|---|---|---|
| T-1921 | `v_doc_01_peca_nao_e_proposta`, com o texto da ESPEC §9.2 montado a partir de `causa_provavel` e das referências | `R-DOC-03` |
| T-1922 | `v_adt_01_peca_sem_itens` só registra quando `parece_proposta`; o texto vira o da ESPEC §9.3, com a ação dirigida ao suporte | `R-DOC-04` |
| T-1923 | `container.gerar`: `V-DOC-01` antes de `V-ADT-01`, por peça, com o papel (*Contrato*, *1º aditivo*…) que a mensagem usa | `R-DOC-03` |
| T-1924 | **[portão]** O positivo: `modelo.pdf` → um `V-DOC-01`, com `PC-SMIT-240402-53`, `PA-SMIT-250220-15` e `PA-SMIT-260319-739` na mensagem | **P4**, ESPEC `P0` |
| T-1925 | **[portão]** Os três negativos: `contrato.pdf`, `contrato_pgm.pdf` e `aditivo_pgm.pdf` não produzem `V-DOC-01` | **P4**, ESPEC `P1` |
| T-1926 | **[portão]** O degrau mais baixo: `saida/amostra-p1.pdf` → `V-DOC-01` com a parte fixa e nenhuma referência citada | **P4**, ESPEC `P3` |
| T-1927 | A `T-1904` fica verde: sem diagnóstico, nada de `V-DOC-01`, e `V-ADT-01` segue como sempre | §1 |

**Verificação:** P4.

> **A ordem da `T-1923` é o que evita a cascata nova.** `V-DOC-01` e `V-ADT-01` descrevem o mesmo
> silêncio por motivos diferentes; se ambas puderem registrar na mesma peça, esta espec terá
> trocado três mensagens por duas.

**Tamanho:** M — meio dia. **Encerra:** P4. **Publicável sozinha** — a mensagem sai concatenada,
como hoje, e já diz o que fazer.

---

### F5 — O achado estruturado e o cartão `[portão P5]`

**Objetivo:** título, causa, ação e detalhes recolhidos.

| # | Tarefa | Ref. |
|---|---|---|
| T-1928 | `ValidationFinding` ganha `titulo`, `causa`, `acao`, `detalhe`; `mensagem` vira `f"{titulo} — {causa} {acao}"` quando os campos existem, e continua literal quando não | `R-DOC-05` |
| T-1929 | `Achado` no schema, com os quatro opcionais. Achado antigo continua chegando só com `mensagem` — é o que mantém a F5 reversível | `R-DOC-05` |
| T-1930 | `CartaoDeAchado` substitui `ListaDeAchados`: título, causa, ação, `<details>` com o detalhe e botão *Copiar*. Um cartão por peça (`D-05`) | `D-05` |
| T-1931 | O cabeçalho da tela vira *"Não foi possível gerar o relatório"*, nos **quatro** pontos da `T-1903` — inclusive `inventario-de-anuncios.ts`, que é o que a `a11y` lê | ESPEC §9.1 |
| T-1932 | Achado sem os campos novos continua renderizando por `mensagem`. É o caminho de todas as outras validações, que esta espec não toca | `R-DOC-05` |
| T-1933 | **[portão]** `documento.spec.ts`: o dublê de 422 com os campos novos exibe as quatro partes, e o colchete de diagnóstico **não** aparece no corpo | **P5** |

**Verificação:** P5. `axe` no cartão novo.

> **A `T-1932` é o que torna a F5 segura.** Doze validações continuam mandando só `mensagem`. Se o
> cartão exigir os quatro campos, elas somem da tela — e o teste que pegaria isso é o da `V-CTR-03`,
> que ninguém vai lembrar de rodar contra a tela.

**Tamanho:** M — um dia. **Encerra:** P5.

---

### F6 — A pessoa e o conjunto `[portões P6 e P7]`

| # | Tarefa | Ref. |
|---|---|---|
| T-1934 | **[portão]** Uma pessoa do faturamento, sem explicação prévia, vê a tela do `modelo.pdf` e diz qual arquivo enviar | **P6**, ESPEC `P8` |
| T-1935 | Suíte cheia com contagem reconciliada: 559 → o número novo, tarefa a tarefa | **P7** |
| T-1936 | `ruff`, `mypy`, `tsc --noEmit`, `next lint`, `next build`; navegador completo; `axe` A/AA em 1366 e 390 | **P7** |
| T-1937 | TASKS 025 com os desvios, no formato dos anteriores | — |

**Tamanho:** P. **Encerra:** P6 e P7.

---

## 4. Sequência

```
F0 ──▶ F1 ──▶ (publicável)
 │
 ├────▶ F2 ──▶ (publicável)
 │       │
 │       ▼
 └────▶ F3 ──▶ F4 ──▶ (publicável) ──▶ F5 ──▶ F6
```

F1 e F2 são independentes entre si e da F3 — só compartilham a âncora da F0. **Se a entrega
precisar parar em algum ponto, os cortes bons são depois da F1, da F2 e da F4**, nessa ordem de
preferência decrescente por custo e crescente por valor.

---

## 5. A regressão que já está escrita

### 5.1 O que **não** é afetado

A extração (`R-GRD-*`, `R-ADT-*`), a consolidação (`R-QTD-*`), o `.docx` e o `.xlsx`. As validações
`V-CTR-03`, `V-CTR-04`, `V-CTR-05`, `V-ADT-02` a `V-ADT-04`, `V-MED-*` e `V-REC-01`. Nenhum arquivo
de `infrastructure/report/` é tocado — e é a mesma afirmação que a `R-FON-13` fez na ESPEC 023.

### 5.2 As âncoras que **parecem** mudar, e não mudam

Estas três leem o texto de validações que este plano toca, e **continuam verdes**, porque a espec
não altera o texto de `V-CTR-01` nem de `V-CAP-01` — altera **onde** elas são registradas:

| Âncora | O que afirma | Por que sobrevive |
|---|---|---|
| `test_cascata_de_validacoes.py:75` (T-1121) | o diagnóstico está na mensagem da `V-CTR-01` | chama a validação direto, sem o container |
| `test_cascata_de_validacoes.py:86` (T-1121) | a mensagem termina em *"proposta comercial completa"* | idem |
| `test_capa.py:452` (T-1425) | `V-CAP-01` avisa sem cliente | idem |

**Nomeadas de propósito**: o instinto, ao ver a F2 mudar o comportamento do container, é "arrumar"
estas três. Arrumá-las apagaria os testes de unidade das validações que continuam existindo.

### 5.3 A âncora que muda de valor, e é o canário

`test_consolidacao_aditivos.py:201` (T-1330) chama `v_adt_01_peca_sem_itens` com
`Contract(proposta="PA-VAZIO")` — **sem diagnóstico**. Depois da `T-1922`, ela só continua verde se
o padrão de `parece_proposta` for o conservador. É o teste que reprova primeiro se a §1 deste plano
for ignorada, e é bom que seja.

### 5.4 O texto do cabeçalho, em seis pontos de quatro arquivos

`ResultadoPanel.tsx:125`, `estados.ts:56` e `:79`, `anuncio.spec.ts:80` e `:129`,
`inventario-de-anuncios.ts:136`. O último é o que a suíte de acessibilidade compara: mudar o
componente e esquecer o inventário deixa a `a11y` vermelha por texto, não por defeito — e o tempo
se perde procurando no lugar errado.

### 5.5 O que não pode se mexer

O `.docx` e o `.xlsx`, byte a byte. `test_docx_estrutura`, `test_docx_formatacao` e as âncoras
`test_anchor_*` são a prova, e nenhuma delas deve precisar de uma linha.

---

## 6. O que pode dar errado, e o que pega

| Risco | Sintoma | O que pega |
|---|---|---|
| `parece_proposta` com padrão errado | metade da suíte vermelha, ou — pior — verde com `V-ADT-01` inalcançável | `T-1904` e `T-1330` |
| `V-DOC-01` recusa proposta legítima | nenhum, até um usuário reclamar | `T-1925` — os três negativos |
| `V-DOC-01` e `V-ADT-01` na mesma peça | três mensagens viram duas, e ninguém nota | `T-1923` mais a asserção de conjunto da `T-1913` |
| Supressão exagerada na `R-DOC-07` | avisos legítimos somem do caminho feliz | `T-1914` |
| Cartão exige os quatro campos | as outras doze validações desaparecem da tela | `T-1932` |
| Inventário de anúncios esquecido | `a11y` vermelha por texto | `T-1903` e `T-1931` |
| Custo da suíte | +17 s por chamada a `modelo.pdf` | `T-1901` decide o cache antes de a F4 pedi-lo quatro vezes |

---

## 7. Insumos

Todos já no repositório. **Nenhuma fixture nova.**

* `backend/tests/fixtures/modelo.pdf` — o arquivo da ESPEC §2.1, já exposto por `caminho_modelo`.
* `contrato.pdf`, `contrato_pgm.pdf`, `aditivo_pgm.pdf` — os três negativos do `P4`.
* `saida/amostra-p1.pdf` — o degrau mais baixo. **Único fora de `fixtures/`**; a `T-1926` decide se
  o copia para lá ou se lê de onde está.
* `levantamento.xlsx` — o segundo arquivo do par, para a âncora da F0.
* As referências de proposta da ESPEC §2.4, transcritas e não geradas.

---

## 8. O que este plano não faz

* A saída antecipada para PDF grande e alheio (`I-01` da espec). Fica o custo atual: a causa é
  apurada depois da varredura de geometria.
* `V-DOC-01` no campo Levantamento (`I-02`).
* `causa` e `acao` no `.docx` (`I-03`) — o documento continua com `mensagem`.
* Qualquer classificação positiva do documento. Prova-se o que ele não é (`D-02`).
