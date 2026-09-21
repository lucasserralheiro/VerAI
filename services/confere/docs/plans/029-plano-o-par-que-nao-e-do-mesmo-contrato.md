# PLANO 029 — Implementação de "O par que não é do mesmo contrato"

| | |
|---|---|
| **Especificação** | [ESPEC 029](../specs/029-o-par-que-nao-e-do-mesmo-contrato.md) v1.2 |
| **Versão** | 1.0 — 2026-08-20 — **escrito antes da implementação**, como os PLANOs 020 a 023 e 027 |
| **Backlog** | [TASKS 029](../tasks/029-tasks-o-par-que-nao-e-do-mesmo-contrato.md) v1.0 — 38 tarefas, `T-2073` a `T-2110`, continuando de onde o TASKS 028 fechou (`T-2072`) |
| **Estado inicial** | `feature/evolucao`, com a ESPEC 028 executada e a suíte de backend na contagem do TASKS 028. Nenhum insumo em aberto: os quatro do negócio foram respondidos em 2026-08-20 e os dois de engenharia estão declarados na ESPEC §12 |
| **Instrumento existente** | Tudo o que esta entrega precisa de *mecanismo* já existe: `registrar_em_partes` e o cartão de quatro partes (ESPEC 025), a caixa âmbar com dois botões do `UploadForm` (`R-DOC-08`), a agregação por validação no `ResultadoPanel` (ESPEC 027 `D-05`), o padrão de guarda no container, e o `<dialog>` de confirmação da ESPEC 015. **Nenhuma fixture nova**: o cenário de erro é o cruzamento das fixtures reais |

---

## 1. O que este plano tem de diferente dos anteriores

**O valor desta entrega é uma pergunta, e uma pergunta que ninguém pode responder é uma tranca.**

É a diferença central em relação a todas as entregas anteriores do projeto. Da ESPEC 018 à 028, o
backend podia ser publicado sozinho: uma linha a menos no bloco final, um cartão melhor redigido,
uma leitura mais rápida — em nenhum caso a tela precisava aprender nada para que o backend fizesse
sentido.

Aqui não. `Severity.PERGUNTA` **impede a emissão até que alguém confirme**, e a confirmação chega
por um botão que só existe depois da fase da tela. Publicar o backend sozinho entregaria
exatamente o que o dono do negócio recusou em `I-04`: um bloqueio sem saída.

> **Por isso a estreia é em dois degraus, e o segundo é uma constante.**
> As validações nascem registrando **`AVISA`** (F4). Nesse estado elas já entregam a metade que
> importa — a divergência aparece, nomeada, no lugar dos dezenove sintomas — e **não podem travar
> ninguém**. Quando a tela souber perguntar (F6), a severidade sobe a `PERGUNTA` numa constante, e
> há um teste que guarda a troca.
>
> Um degrau, e não dois, obrigaria a publicar backend e tela no mesmo instante, ou a manter uma
> semana de trabalho fora da linha principal. Os dois riscos são maiores que o de uma severidade
> temporária.

**O risco desta entrega não está na regra.** A comparação é `(base, órgão, ano)` contra
`(base, órgão, ano)`, medida em cinco peças e três planilhas, com zero falso positivo (ESPEC §2.4).
O risco está em três lugares ao redor dela:

> **1 — A severidade nova muda o significado de `bloqueado` para as onze validações que já
> existem.** `ValidationReport.bloqueado` decide se o caso de uso monta relatório, se os ~20 s de
> anexos são pagos e qual o status HTTP. Acrescentar um valor ao `enum` é uma linha; não perceber
> que alguma validação existente passou a cair nele é um bloqueio permanente e falso, do tipo que a
> ESPEC 025 §1 levou meses para diagnosticar.

> **2 — A suíte de navegador intercepta `**/reports`, e o *endpoint* novo não casa com esse
> padrão.** Quinze arquivos em `e2e/` fazem `page.route("**/reports", …)`. `POST
> /reports/conferencia-previa` escaparia de todos eles e bateria num backend que, nesses testes,
> não está lá — e o clique em *Gerar relatório* nunca chegaria ao `POST` que a spec espera. É a
> falha mais cara desta entrega e ela é **invisível pelo backend**: `R-IDT-12` (falhar aberto) e a
> interceptação nova em `estados.ts` são as duas metades do conserto.

> **3 — O inventário de anúncios reprova sozinho, e com razão.** `e2e/inventario-de-anuncios.ts`
> exige que todo mecanismo de anúncio novo — e a caixa do portão é um `role="status"` — tenha
> entrada apontando **a regra que o exige**. Sem a entrada a suíte fica vermelha de propósito; com
> uma entrada escrita a partir do DOM, o teste vira tautologia (TASKS 016 §1.1, regra 2).

**E há uma armadilha de leitura**, já nomeada na ESPEC §2.8: `PdfPlumberContractExtractor.extrair`
constrói `Contract` em **dois** pontos, e `Contract.aplicar` monta o consolidado a partir de uma
**lista fixa de campos**. Campo novo que não entre nos três lugares some em silêncio — foi
exatamente o defeito da `T-1420`, com `cliente`, no caminho com aditivo.

---

## 2. Portões

Os oito são os da ESPEC §10.4. A coluna *momento* é o que este plano acrescenta.

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Os pares reais não se movem** | Medido na F0, reconferido na F7 | `.docx` e `.xlsx` dos dois pares **idênticos parte a parte**; contagem de achados por par idêntica à do início. Vale também no caminho **confirmado** (`I-06`) | Reverter. Documento movido é escopo vazado — a ESPEC §4.2 proíbe |
| **P4 — O objeto de valor decide sem abrir arquivo** | Fim da F2 | `015` = `15`; `smit` = `SMIT`; `TC 52/SMIT/2024` = `Contrato Nº 52/SMIT/2024`; **`52-A/SMIT/2024` = `52/SMIT/2024`**; string sem identidade → `None` | Não seguir para a F3: todo o resto compara com este objeto |
| **P3 — Ausência é silêncio** | Fim da F4 | `modelo.pdf`, `amostra_sem_tabela.pdf` e `levantamento_codigos_deslocados.xlsx` não ganham achado novo | O `R-IDT-06` é o que separa esta espec de um alarme que dispara no escuro |
| **P1 — As quatro trocas param** | Fim da F4 (como aviso) e da F6 (como pergunta) | Os quatro cruzamentos do §2.4 produzem **um** achado `V-IDT-01`, com o texto do §9.1 | Reverter a fase |
| **P2 — O aditivo para antes de consolidar** | Fim da F4 | `contrato.pdf` + `aditivo_pgm.pdf` acusa `V-IDT-03`, e o consolidado **não** contém os códigos do aditivo | Ordem errada no container: depois de `aplicar`, a peça de origem não é mais distinguível |
| **P6 — A conferência prévia é barata** | Fim da F5 | Contrato + 1 aditivo + levantamento em **menos de 2 s** (0,65 s medidos), e **sem** abrir a tabela de itens | Se a prévia custar como a extração, ela perde a razão de existir (`D-10`) |
| **P5 — O ciclo do portão** | Fim da F6 | Pergunta → *Gerar assim mesmo* → documento emitido **com** o aviso de `R-IDT-11`. E: sem o campo, 422 com `confirmaveis` | Não publicar: é este ciclo que faz a entrega ser uma pergunta e não uma tranca |
| **P7 — O conjunto** | Fim da F7 | Backend verde na contagem inicial mais os testes desta entrega; navegador sem falha nova; `ruff` e `mypy` limpos; **nenhuma âncora movida** | Não entregar |

---

## 3. Fases

### F0 — O oráculo da identidade `[portão P0]`

**Objetivo:** saber, antes de escrever regra alguma, **o que cada arquivo declara** e **o que a
suíte afirma hoje** — os dois medidos, não derivados do código que ainda não existe.

| # | Tarefa | Ref. |
|---|---|---|
| T-2073 | Remedir a linha de base da suíte na árvore intocada, e registrar o número | TASKS §3 |
| T-2074 | Extrair e listar por extenso a identidade das **cinco peças** e das **três planilhas**: contrato, processo, peça, e o **texto cru** de onde cada um saiu | ESPEC §2.1, §2.2 |
| T-2075 | Medir a **contagem de achados por validação** dos dois pares reais e dos dois cruzamentos, hoje. É a linha de base de `P0` | ESPEC §10.2 |
| T-2076 | Inventariar as âncoras que esta entrega **não pode mover**, nos dois lados: `sha256`, contagens e `assert len(` no backend; as cinco entradas de `inventario-de-anuncios.ts` e todos os `page.route("**/reports")` do `e2e/` | ESPEC §10.3, §1 riscos 2 e 3 |

**Verificação:** P0 (primeira metade).

> **O oráculo se mede no arquivo, nunca no *parser*.** A lista de identidades entra nos testes por
> extenso. Derivá-la de `IdentidadeContratual.de_texto` faria o teste afirmar *"o código concorda
> com o código"* — o modo de falha que o PLANO 021 §1 nomeou e que o TASKS 028 §9.7 exercitou.

**Tamanho:** PP — trinta minutos, sem tocar em `src/`.

---

### F1 — Os testes, escritos antes `[portão P4]`

**Objetivo:** ter, contra o código intocado, a prova de que a detecção ainda não existe.

| # | Tarefa | Ref. |
|---|---|---|
| T-2077 | `tests/test_identidade_contratual.py` — o objeto de valor: as oito strings reais da F0, `015`/`15`, caixa, prefixos `TC`/`CT`, **sufixo**, e as duas strings sem identidade | `R-IDT-01` a `R-IDT-04`, **P4** |
| T-2078 | No mesmo módulo, os quatro cruzamentos: hoje devolvem `bloqueado=False` e **zero** achado de identidade — a asserção reprova pelo motivo certo | `V-IDT-01`, **P1** |
| T-2079 | O cruzamento com aditivo: `contrato.pdf` + `aditivo_pgm.pdf`, afirmando que o consolidado **não** deve conter os sete códigos do aditivo | `V-IDT-03`, **P2** |
| T-2080 | Os três negativos de `R-IDT-06`, com `modelo.pdf`, `amostra_sem_tabela.pdf` e a planilha deslocada — **passam já**, e é resultado, não folga | `R-IDT-06`, **P3** |
| T-2081 | **[portão]** Rodar contra o `HEAD`: os de detecção reprovam por achado ausente; os de ausência passam | **P4** parcial |

**Verificação:** P4 (primeira metade).

> **T-2080 passa antes de existir código novo, e isso é o teste mais valioso da fase.** Ele
> descreve o que **não** muda. Se reprovasse aqui, a premissa de que a regra é estreita estaria
> errada antes de começar.

**Tamanho:** P — uma hora e meia.

---

### F2 — O objeto de valor `[publicável sozinha]` `[portão P4]`

**Objetivo:** a identidade existe como conceito do domínio, sem conhecer PDF nem planilha.

| # | Tarefa | Ref. |
|---|---|---|
| T-2082 | `domain/value_objects/identidade_contratual.py` — base, sufixo, órgão, ano; `de_texto`, `de_referencia_da_aba`, igualdade por `(base, órgão, ano)`, `__str__` | `R-IDT-01`, `R-IDT-02`, `R-IDT-03` |
| T-2083 | A comparação de `R-IDT-04`: sufixo **fora**, base por valor numérico, órgão por caixa alta | `I-03` |
| T-2084 | **[portão]** T-2077 verde, inclusive as oito strings reais | **P4** |

**Verificação:** P4.

> **A tentação aqui é comparar `str`.** Guardar a identidade normalizada como texto (`"52/SMIT/2024"`)
> funcionaria em todos os casos medidos e falharia no primeiro sufixo — que o negócio confirmou
> existir. O objeto guarda as quatro partes separadas justamente para que a comparação possa
> ignorar uma delas.

**Tamanho:** P — uma hora. **Publicável sozinha**: nada a consome ainda.

---

### F3 — A identidade nas peças `[portão P0]`

**Objetivo:** todo `Contract` sabe de que contrato é — inclusive o que falhou na extração e o
consolidado.

| # | Tarefa | Ref. |
|---|---|---|
| T-2085 | `Contract.identidade` e `Contract.processo`, **por último e com padrão** | `R-IDT-09` |
| T-2086 | As duas regexes no extrator, sobre o `texto_da_capa` que já circula, e o preenchimento **nos dois pontos de construção** | ESPEC §2.8 |
| T-2087 | Os dois campos na **lista fixa** de `Contract.aplicar` | `R-IDT-09`, `T-1420` |
| T-2088 | **[portão]** Teste que abre `amostra_sem_tabela.pdf` (caminho sem tabela) e o par PGM com aditivo (consolidado), afirmando identidade presente nos dois; e `P0` reconferido | **P0** |

**Verificação:** P0.

> **T-2088 é a tarefa que a `T-1420` escreveu para nós.** Lá o `cliente` sumia no caminho com
> aditivo porque `aplicar` monta um objeto novo a partir de uma lista fixa, e ninguém percebeu por
> um mês. São dois testes de três linhas cada.

**Tamanho:** P — uma hora.

---

### F4 — As três validações `[publicável sozinha, como AVISA]` `[portões P1, P2, P3]`

**Objetivo:** a divergência passa a **aparecer**, nomeada, com o cartão de quatro partes.

| # | Tarefa | Ref. |
|---|---|---|
| T-2089 | `infrastructure/validations/identity_validations.py` — `V-IDT-01`, `V-IDT-02`, `V-IDT-03`, com os textos do ESPEC §9 | `V-IDT-01` a `V-IDT-03` |
| T-2090 | A severidade sai de **uma constante do módulo**, iniciada em `AVISA`. É o degrau do §1 | §1 |
| T-2091 | As três chamadas no container, **sob as guardas** de §7.2: `V-IDT-03` no laço dos aditivos e **antes** de `aplicar`; as outras duas dentro do `if medicao.itens` | `R-GRD-06`, **P2** |
| T-2092 | **[portão]** T-2078, T-2079 e T-2080 verdes; os dois pares reais sem achado novo | **P1**, **P2**, **P3** |

**Verificação:** P1 (como aviso), P2, P3.

> **É aqui que a entrega já paga.** Mesmo parando neste degrau — e ela pode parar, sem prejuízo —,
> os dezenove cartões do par trocado ganham a frase que os explica, e nenhum usuário fica travado.

**Tamanho:** M — meio dia.

---

### F5 — A API: o campo, o 422 e a prévia `[portão P6]`

**Objetivo:** o backend sabe receber uma confirmação e sabe responder a pergunta em menos de um
segundo.

| # | Tarefa | Ref. |
|---|---|---|
| T-2093 | `Severity.PERGUNTA`; `bloqueado` passa a incluí-la; `confirmaveis` ao lado de `bloqueantes` e `avisos` | `R-IDT-10` |
| T-2094 | **[portão]** O teste que afirma que **nenhuma das onze validações existentes** registra `PERGUNTA` — o risco 1 do §1, transformado em vermelho | §1, risco 1 |
| T-2095 | `identidade_confirmada` em `Entradas` e no `POST /reports`, padrão `False`; o teste de que **ausência não confirma** | `R-IDT-10` |
| T-2096 | `identificar()` no extrator (página 1) e no leitor da aba (dez linhas, `read_only`) | `D-10` |
| T-2097 | `POST /reports/conferencia-previa` e `RespostaDaConferencia`, incluindo os aditivos | `I-05` |
| T-2098 | **[portão]** A prévia dos dois pares, com aditivo, abaixo de 2 s — e um teste que afirma que ela **não** extrai a tabela de itens | **P6** |

**Verificação:** P6.

> **T-2094 é o teste mais barato e mais importante desta fase.** Ele custa quatro linhas e guarda
> a única mudança da entrega que alcança código que ninguém está olhando.

**Tamanho:** M — meio dia.

---

### F6 — A tela `[portão P5]`

**Objetivo:** a pergunta chega a quem pode respondê-la.

| # | Tarefa | Ref. |
|---|---|---|
| T-2099 | A chamada à prévia antes do envio, **falhando aberto** em erro ou acima de 3 s | `R-IDT-12` |
| T-2100 | A caixa de `R-DOC-08` passa a aceitar também o aviso do servidor, com os textos de §9 e o botão *Gerar assim mesmo* | `R-IDT-10`, ESPEC §2.9 |
| T-2101 | `identidade_confirmada` no envio, e o rebaixamento do achado a aviso na resposta | `R-IDT-11` |
| T-2102 | **A entrada nova em `inventario-de-anuncios.ts`**, apontando `R-IDT-10` como a regra que a exige — escrita da regra, não do DOM | TASKS 016 §1.1 |
| T-2103 | A interceptação de `**/reports/conferencia-previa` em `e2e/estados.ts`, e a varredura dos quinze arquivos que interceptam `**/reports` | §1, risco 2 |
| T-2104 | A severidade sobe de `AVISA` para `PERGUNTA` — **uma constante** — com o teste que guarda a troca | §1 |
| T-2105 | **[portão]** O ciclo ponta a ponta em Playwright: pergunta → confirmação → documento com o aviso | **P5** |

**Verificação:** P5.

> **T-2104 é a linha que fecha a entrega, e ela vem depois da T-2105 estar escrita.** Subir a
> severidade antes de o ciclo existir é publicar a tranca que `I-04` recusou.

**Tamanho:** M — meio dia.

---

### F7 — Fechamento `[portão P7]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2106 | Suíte de backend inteira; contagem reconciliada com a da F0 mais os testes desta entrega | **P7** |
| T-2107 | Suíte de navegador; nenhuma falha nova além das pré-existentes | **P7** |
| T-2108 | `ruff check` e `mypy src/` limpos nos arquivos tocados | **P7** |
| T-2109 | **[portão]** As âncoras da F0 reconferidas uma a uma: nenhuma movida | **P0**, **P7** |
| T-2110 | `README.md` — a linha da ESPEC 029; `docs/CHANGELOG.md` se o rumo mudar; a ESPEC para *Implementada* | — |

**Tamanho:** PP — uma hora.

---

## 4. Sequência

```
F0 ──▶ F1 ──▶ F2 ──▶ F3 ──▶ F4 ──▶ F5 ──▶ F6 ──▶ F7
oráculo testes  VO   peças  valida  API   tela  fecha
 P0      P4     P4    P0    P1P2P3   P6    P5    P7
                │            │              │
                └ publicável └ publicável   └ o degrau da
                  sozinha      como AVISA     severidade sobe
```

**F2 e F4 são os dois pontos de parada seguros.** Em F2 nada consome o objeto novo; em F4 a
detecção existe e não trava ninguém. Qualquer interrupção fora desses dois pontos deixa a árvore
com uma severidade que a tela não sabe responder.

**F5 e F6 podem trocar de ordem em parte**: a tela pode ser escrita contra a prévia mockada. Mas
`T-2104` — a subida da severidade — é sempre a última tarefa de código da entrega.

---

## 5. O que pode dar errado, e o que pega

| O que | Sintoma | O que pega |
|---|---|---|
| `PERGUNTA` alcançar validação existente | Bloqueio permanente e falso, sem teste vermelho | `T-2094` |
| Publicar F4/F5 com `PERGUNTA` e sem a tela | Usuário travado, sem botão para responder — o que `I-04` recusou | `T-2090` (nasce `AVISA`) e a ordem de `T-2104` |
| A prévia escapar das interceptações do `e2e/` | Specs de navegador que travam ou passam pelo caminho errado | `R-IDT-12` (falha aberto) + `T-2103` |
| `role="status"` novo sem entrada no inventário | Suíte de navegador vermelha, com mensagem apontando para o inventário | `T-2102` |
| Campo novo fora de um dos três pontos de construção | Identidade some no caminho sem tabela ou no consolidado, **em silêncio** | `T-2088` |
| Comparar identidade como texto | Sufixo vira divergência; todo contrato renumerado pergunta à toa | `T-2083`, `P4` |
| Oráculo derivado do *parser* | Testes verdes que não afirmam nada | `T-2073`, escrito antes da F2 |
| Confirmar por omissão | Quem chama a API sem o campo recebe documento de par divergente | `T-2095` |
| A prévia abrir a tabela de itens | Portão de 0,65 s vira portão de 17 s, e perde a razão de existir | `T-2098` |

---

## 6. O que este plano não faz

* **Não toca o documento.** Nenhuma medida, cor, texto ou linha do `.docx` e do `.xlsx` — nem no
  caminho confirmado (`I-06`). `P0` é reconferido duas vezes por isso.
* **Não implementa `V-IDT-04`** (vigência). `D-06`.
* **Não usa a cobertura de códigos** como sinal. `D-05`, fechado por `I-01`.
* **Não persiste a confirmação nem registra quem confirmou.** `I-07`; o serviço continua sem
  estado.
* **Não reancora nada.** Ao contrário do PLANO 028, esta entrega não tem delta de documento
  legítimo: âncora vermelha aqui é defeito, não reancoragem.

---

## 7. Por que a estreia é em dois degraus, e não uma bandeira de configuração

A alternativa óbvia ao degrau `AVISA → PERGUNTA` é uma variável de ambiente: publicar tudo com
`PERGUNTA` desligado e ligar em produção quando a tela subir.

Ela foi descartada por três razões, e a terceira é a que decide:

1. **O projeto não tem nenhuma.** Não há configuração de comportamento em lugar nenhum do código —
   tudo o que o sistema decide, decide a partir dos arquivos submetidos. A primeira seria um
   precedente caro para uma necessidade de uma semana.
2. **Uma bandeira exige testar os dois estados para sempre**, enquanto o degrau exige testar a
   troca uma vez (`T-2104`).
3. **A bandeira esconde o degrau; a constante o expõe.** Com bandeira, o estado de produção passa a
   depender de uma variável fora do repositório — e a pergunta *"o portão está ligado?"* deixa de
   ter resposta no código.

O custo do degrau é honesto e está escrito: entre a F4 e a F6, um par divergente **avisa e emite**.
É o comportamento de hoje mais uma frase explicando os dezenove sintomas — estritamente melhor que
o de hoje, e nunca pior.
