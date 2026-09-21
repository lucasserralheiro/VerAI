# ESPEC 043 — O cartão sem título

| | |
|---|---|
| **Status** | **Implementada** — 2026-09-03. Backend **1.566 → 1.573 passed**, zero falhas — uma reprovação de `test_desempenho.py` (área não tocada) foi ruído de carga, confirmada isolada. Nenhum teste de disparo/não-disparo das sete validações mudou; os três testes que liam `.mensagem` (`V-CTR-06`, `V-ADT-02`, `V-CTR-07`) continuam verdes, sem editar a asserção. `V-MED-03` e `V-MED-04` ganharam o primeiro teste dedicado |
| **Versão** | 1.0 — 2026-09-03 |
| **Depende de** | [ESPEC 025](025-o-arquivo-que-nao-e-a-proposta.md) `R-DOC-05` — o achado em quatro partes (`titulo`/`causa`/`ação`/`detalhe`) e o card que já sabe desenhá-las. Esta espec não cria mecanismo novo; estende o alcance do que já existe |
| **Revisa** | Nada de decisão anterior. A `R-DOC-05` sempre previu cobrir "onze validações" que ainda mandavam só `mensagem" — esta é a primeira fatia dessa dívida a ser paga |
| **Não toca** | `CartaoDeAchado`, `CartaoAgregado`, `ListaDeAchados` e `agruparPorValidacao` (nenhuma linha de `ResultadoPanel.tsx`) — o mecanismo de exibição já existe e já funciona; esta espec só **usa** ele em mais lugares. As validações `BLOQUEIA` (`V-CTR-01`, `V-CTR-03`, `V-ADT-03`, `V-MED-01`), `V-CAP-01` e `V-CTR-05` — fora do escopo, ver §4.2 |
| **Referência normativa** | `backend/src/infrastructure/validations/contract_validations.py` e `measurement_validations.py` — os sete pontos que ainda chamam `achados.registrar()` em vez de `registrar_em_partes()`, dentro do grupo `AVISA` |
| **Origem** | Submissão real: captura de tela com `V-CAP-01` e `V-CTR-05` aparecendo com a sigla técnica exposta no card. A investigação (nesta conversa) mediu o alcance real — treze validações, não duas — e achou um segundo defeito, mais grave, na mesma vizinhança (§2.3) |

---

## 1. Problema

**Um card de aviso mostra a sigla técnica da validação (`V-CTR-06`, `V-MED-03`...) em fonte monoespaçada, colada na frase crua que o backend registrou — vocabulário de quem dá suporte, exposto a quem só está conferindo o relatório.**

`CartaoDeAchado` já sabe desenhar um card em linguagem simples, com o técnico escondido num `<details>` — a ESPEC 025 construiu isso para as mensagens de bloqueio. Mas o próprio comentário do código já admite que a cobertura parou no meio: *"onze validações ainda mandam só `mensagem`"* ([ResultadoPanel.tsx:33](../../frontend/src/app/components/ResultadoPanel.tsx#L33)).

## 2. O que foi levantado

### 2.1 O alcance real é treze validações, contadas uma a uma

Busca em todo `backend/src/infrastructure/validations/` por `achados.registrar(` (a forma sem `titulo`) contra `achados.registrar_em_partes(` (a forma com):

| validação | severidade | arquivos de teste que a citam |
|---|---|---|
| `V-CTR-01` | BLOQUEIA | 4 |
| `V-CTR-03` | BLOQUEIA | **16** |
| `V-ADT-03` | BLOQUEIA | 6 |
| `V-MED-01` (ramo sem diagnóstico) | BLOQUEIA | 6 |
| `V-CTR-05` | AVISA | 7 |
| `V-CAP-01` | AVISA | 7 |
| `V-ADT-02` | AVISA | 4 |
| `V-CTR-07` | AVISA | 3 |
| `V-ADT-04` | AVISA | 2 |
| `V-CTR-04` | AVISA | 2 |
| `V-CTR-06` | AVISA | 2 |
| `V-MED-03` | AVISA | 2 |
| `V-MED-04` | AVISA | 2 |

Treze, não duas. As quatro `BLOQUEIA` têm o maior alcance de teste — `V-CTR-03` sozinha aparece em dezesseis arquivos — e a maior visibilidade, por serem a mensagem que impede o relatório de sair.

### 2.2 Por que a mudança não é cosmética

`registrar_em_partes` **recalcula** `mensagem` a partir de `titulo + causa + ação` ([validation_finding.py:85-102](../../backend/src/domain/entities/validation_finding.py#L85-L102)) — não é um campo extra ao lado do de sempre. Dar título a uma validação muda o texto de `mensagem`, e é esse campo que os testes de backend leem. Trocar a palavra sem inventariar quem depende do texto exato é o erro que o `PLANO 024`/`028` deste projeto já cometeu e documentou.

### 2.3 Um achado mais grave que apareceu do lado: `CartaoAgregado` tem texto fixo, para qualquer validação

`ListaDeAchados` manda **qualquer** validação com mais de um achado para `CartaoAgregado`, sem checar qual validação é:

```tsx
if (grupo.length > 1) {
    return [<CartaoAgregado key={grupo[0].validacao} achados={grupo} tom={tom} />];
}
```

E `CartaoAgregado` tem o texto **fixo**, escrito só para `V-CTR-05`: *"{N} códigos do contrato não aparecem no levantamento."* ([ResultadoPanel.tsx:91-92](../../frontend/src/app/components/ResultadoPanel.tsx#L91-L92)). `V-MED-03` (código repetido sem marca de desconto) já dispara várias vezes no mesmo relatório por natureza — o próprio comentário do backend registra *"dispararia em oito dos nove códigos repetidos do PGM"*. Se isso ocorrer, a tela mostraria *"8 códigos do contrato não aparecem no levantamento"* sobre uma validação que não tem nada a ver com isso. Não há teste cobrindo esse caminho — `CartaoAgregado` só é exercitado pelo `achados-agregados.spec.ts`, e só para `V-CTR-05`.

**Fica registrado e fora do escopo desta espec** (`I-01`): corrigir `CartaoAgregado` depende de toda validação `AVISA` já ter `titulo` — não faz sentido generalizá-lo até a Fase B também estar pronta.

### 2.4 O plano de fases, e por que esta é só a primeira

| Fase | O quê | Alcance de teste |
|---|---|---|
| **A — esta espec** | As sete `AVISA` de menor alcance: `V-CTR-04`, `V-CTR-06`, `V-CTR-07`, `V-ADT-02`, `V-ADT-04`, `V-MED-03`, `V-MED-04` | 2 a 4 arquivos cada |
| B | `V-CAP-01`, `V-CTR-05` | 7 arquivos cada |
| C | Generalizar `CartaoAgregado` para usar `titulo` | Depende de A e B prontas |
| D | As quatro `BLOQUEIA` | Até 16 arquivos — maior risco, maior visibilidade |

## 3. Objetivo

Que as sete validações `AVISA` de menor alcance passem a ter `titulo`/`causa`/`ação`, no mesmo formato que a ESPEC 025 já criou — sem tocar o mecanismo de exibição, e sem mover nenhuma validação `BLOQUEIA`, `V-CAP-01` ou `V-CTR-05`.

**Não é objetivo:** generalizar `CartaoAgregado` (`I-01`, Fase C); tocar as validações `BLOQUEIA` (Fase D); mudar quais achados disparam, sua severidade, ou a ordem deles na tela.

## 4. Escopo

### 4.1 Dentro do escopo

As sete funções, em `contract_validations.py` e `measurement_validations.py`:
`v_ctr_04_geometria_nao_canonica`, `v_ctr_06_cauda_sem_linha_anterior`,
`v_ctr_07_periodo_nao_numerico`, `v_adt_02_aditivo_sem_efeito`,
`v_adt_04_movimento_de_codigo_ausente`, `v_med_03_desconto_por_posicao`,
`v_med_04_apuracao_sem_par` — cada uma trocando `achados.registrar(...)` por
`achados.registrar_em_partes(...)`.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| `V-CAP-01`, `V-CTR-05` | Fase B — maior alcance de teste (7 arquivos cada), tratada em separado |
| `V-CTR-01`, `V-CTR-03`, `V-ADT-03`, `V-MED-01` | Fase D — são `BLOQUEIA`; maior risco e maior visibilidade |
| `CartaoAgregado` | `I-01` — Fase C, depende das fases A e B estarem prontas |
| Qualquer mudança de comportamento (severidade, condição de disparo, ordem) | Esta espec só reformula texto — o que dispara e quando não muda |

## 5. Regras

| ID | Regra |
|---|---|
| `R-CLA-01` | As sete validações do §4.1 passam a usar `registrar_em_partes`, com `titulo` no vocabulário de quem confere (não cita a sigla nem o nome da regra), `causa` explicando como o sistema concluiu aquilo, e `ação` dizendo o que fazer em um passo |
| `R-CLA-02` | O texto técnico que hoje vai em `mensagem` (números, trechos extraídos, referências de ESPEC) migra para `detalhe` — visível só dentro de "Detalhes técnicos (para o suporte)", no mesmo padrão da ESPEC 025 |
| `R-CLA-03` | **Nenhuma condição de disparo muda.** As sete validações continuam registrando exatamente nos mesmos casos, com a mesma severidade (`AVISA`) — testado por igualdade de **quando** dispara, não de **o que** a mensagem diz |
| `R-CLA-04` | **Invariante de não-regressão:** todo teste de backend que hoje afirma o texto de `mensagem` para uma das sete validações é achado por inventário (`grep` pela sigla, não por onde o teste "parece morar") e atualizado para o texto novo — nunca contornado |

### 5.1 O texto de cada validação

| Validação | Título | Causa | Ação |
|---|---|---|---|
| `V-CTR-04` | A tabela de itens foi lida com um layout diferente do habitual. | As colunas do contrato não batem com a geometria de referência do sistema. | Não é preciso fazer nada — a extração foi conferida pela soma dos totais. |
| `V-CTR-06` | Um trecho de descrição pode ter ficado de fora. | A página seguinte começa com um texto que parece continuação da linha anterior, mas não havia onde encaixá-lo. | Confira a descrição do item — o trecho no detalhe técnico pode pertencer a ele. |
| `V-CTR-07` | O período de um item não foi lido como número de meses. | O texto extraído da coluna de período não é um número puro. | Confira, no PDF do contrato, se o período dessa linha está correto no relatório. |
| `V-ADT-02` | Este aditivo não altera o escopo do contrato. | Ele só traz mudança de quantidade, sem incluir nem excluir itens. | Não é preciso fazer nada — o documento sai igual ao que sairia sem este aditivo. |
| `V-ADT-04` | Um código alterado por aditivo não consta do contrato original. | Falta uma peça anterior, ou o bloco está rotulado como aumento em vez de inclusão. | A linha sairá no bloco final do relatório — confira se falta anexar algum aditivo. |
| `V-MED-03` | Um código aparece mais de uma vez na planilha sem marca de desconto. | O sistema não conseguiu identificar qual ocorrência já desconta o uso de desenvolvimento. | Confira, na planilha, qual das ocorrências entrou no relatório (indicada no detalhe). |
| `V-MED-04` | Um bloco de desconto não teve o par correspondente encontrado. | O bloco desconta recursos de desenvolvimento, mas a planilha não tem o bloco sem desconto para comparar. | As quantidades saem como a planilha traz, sem o desconto — confira se os dois blocos existem na aba Levantamento. |

`causa` e `ação` levam os dados variáveis do achado (código, página, texto extraído) quando o atual `mensagem` já os carrega — a tabela acima mostra a forma fixa; a implementação preenche os campos.

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **Sete validações, não treze, nem as duas da imagem original** | Medido (§2.1): as `BLOQUEIA` e as duas de maior alcance (`V-CAP-01`, `V-CTR-05`) têm risco de teste desproporcional a uma primeira fatia. Provar o processo no grupo pequeno primeiro é mais barato que descobrir o processo errado em 16 arquivos de uma vez |
| `D-02` | **Nenhuma mudança em `ResultadoPanel.tsx`** | O mecanismo já existe, já é testado, e já funciona para `V-DOC-01`/`V-ADT-01` (ESPEC 025). Reescrevê-lo aqui multiplicaria o risco sem necessidade |
| `D-03` | **`CartaoAgregado` fica de fora, mesmo sendo o achado mais grave** (`I-01`) | Corrigi-lo exige que toda validação `AVISA` tenha `titulo` para ele usar — as sete desta fase mais as duas da Fase B. Misturar as duas coisas nesta espec a faria depender de escopo que ela mesma não cobre |
| `D-04` | **O inventário de testes é por `grep` da sigla, nunca por leitura de arquivo por arquivo "que parece relevante"** | Precedente do `PLANO 024 §7`/`028 §9.6`: inventário por onde o teste "mora" já perdeu âncora duas vezes neste projeto |

## 7. O que muda no código

| Arquivo | Mudança |
|---|---|
| `infrastructure/validations/contract_validations.py` | `v_ctr_04_geometria_nao_canonica`, `v_ctr_06_cauda_sem_linha_anterior`, `v_ctr_07_periodo_nao_numerico`, `v_adt_02_aditivo_sem_efeito`, `v_adt_04_movimento_de_codigo_ausente` — `registrar` → `registrar_em_partes`, texto conforme §5.1 |
| `infrastructure/validations/measurement_validations.py` | `v_med_03_desconto_por_posicao`, `v_med_04_apuracao_sem_par` — idem |
| `tests/` | Todo teste que hoje afirma `mensagem` de uma das sete validações, achado por `grep`, atualizado para o texto novo |
| `frontend/` | **Nenhuma.** `CartaoDeAchado` já lê `titulo`/`causa`/`ação`/`detalhe` |

## 8. Testes e critério de aceite

| Regra | Verificação |
|---|---|
| `R-CLA-01`/`02` | Cada uma das sete validações, testada isolada: achado sai com `titulo`, `causa`, `ação` preenchidos e `detalhe` carregando o que hoje vai em `mensagem` |
| `R-CLA-03` | As condições de disparo de cada validação continuam idênticas — mesmos testes de "quando dispara"/"quando não dispara" já existentes, sem alteração de asserção sobre isso |
| `R-CLA-04` | Inventário por `grep` das sete siglas em `tests/`, com cada ocorrência que afirma `mensagem` conferida e, se necessário, atualizada |

**Critério de aceite:** suíte de backend verde; nenhuma condição de disparo muda; os sete cards, na tela, saem no formato de `V-DOC-01` (título + causa + ação, técnico recolhido) — conferido manualmente, já que não há teste de navegador cobrindo o conteúdo destes cards hoje.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Teste que afirma `mensagem` escapar do inventário | `D-04` — busca por `grep` da sigla, não por arquivo "que parece relevante" |
| Mudar, sem perceber, quando uma validação dispara | `R-CLA-03` — os testes de disparo/não-disparo já existentes continuam a régua, intocados |
| Confundir esta entrega com a correção do `CartaoAgregado` | `I-01`/`D-03` — fora do escopo, declarado |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | `CartaoAgregado` tem texto fixo para qualquer validação com mais de um achado — hoje só exercitado por `V-CTR-05`, mas `V-MED-03` já pode disparar várias vezes. Precisa de generalização, depois das Fases A e B | Não bloqueia esta espec. Bloqueia a tela mostrar texto certo se `V-MED-03` (ou outra validação desta fase) disparar mais de uma vez no mesmo relatório antes da Fase C — risco real, não hipotético |
| `I-02` | Vale um teste de navegador cobrindo o conteúdo dos cards `AVISA` no estado `pronto`? Hoje nenhum existe (mesma lacuna que a ESPEC 038 §2.2 documentou) | Não. Fora do escopo desta espec de conteúdo |

## 11. Relação com a ESPEC 025

A 025 criou o mecanismo — `registrar_em_partes`, o card em quatro partes, o `<details>` técnico — e aplicou a duas validações `BLOQUEIA` (`V-DOC-01`, `V-ADT-01`). Esta espec não muda nada do que a 025 decidiu; usa a mesma ferramenta em mais sete lugares, começando pelos de menor risco.

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Inventário de testes das sete siglas | P |
| B | Os sete `registrar_em_partes`, com o texto de §5.1 | P |
| C | Atualizar os testes afetados | P — depende do que o inventário achar |
| D | Suíte completa e conferência manual dos sete cards na tela | PP |

**Estimativa: meio dia**, a maior parte em B e C.
