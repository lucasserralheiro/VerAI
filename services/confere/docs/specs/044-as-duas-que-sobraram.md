# ESPEC 044 — As duas que sobraram

| | |
|---|---|
| **Status** | **Implementada** — 2026-09-04. Backend **1.573 → 1.575 passed**, zero falhas. Os sete arquivos de teste medidos em §2.1 permaneceram intocados — nenhum lia `.mensagem`, confirmado na execução |
| **Versão** | 1.0 — 2026-09-04 |
| **Depende de** | [ESPEC 025](025-o-arquivo-que-nao-e-a-proposta.md) `R-DOC-05` — o achado em quatro partes. [ESPEC 043](043-o-cartao-sem-titulo.md) `R-CLA-01` a `R-CLA-04` — o mesmo mecanismo, aplicado às sete validações da Fase A |
| **Revisa** | Nada de decisão anterior. É a Fase B que a ESPEC 043 §2.4 já previa, separada por cautela — a medição desta espec mostra que a cautela não era necessária, mas a decisão de separar continua válida como registro |
| **Não toca** | `ResultadoPanel.tsx`, `CartaoAgregado`, `ListaDeAchados` — nenhuma linha de frontend. As quatro validações `BLOQUEIA` (Fase D) e a generalização do card agregado (Fase C, `I-01` da ESPEC 043) — fora do escopo, ver §4.2 |
| **Referência normativa** | Os sete arquivos de teste que citam `V-CAP-01` ou `V-CTR-05` (`backend/tests/`) — todos medidos nesta espec, nenhum lê `.mensagem` |
| **Origem** | Os dois avisos da submissão real que abriu toda esta série (`V-CAP-01`, `V-CTR-05`), deixados de fora da ESPEC 043 por estimativa de risco — revista aqui |

---

## 1. Problema

**Os dois avisos que motivaram toda a investigação — `V-CAP-01` e `V-CTR-05` — continuam saindo com a sigla técnica exposta, coladas na frase crua**, porque a ESPEC 043 os separou para uma "Fase B" de maior cautela, sem medir se essa cautela era necessária.

## 2. O que foi levantado

### 2.1 A estimativa de risco da ESPEC 043 estava inflada

A 043 §2.1 contou "7 arquivos de teste" para cada uma das duas, usando `grep -rl` sem filtrar por
extensão — a contagem incluía `__pycache__` (bytecode compilado), não só código-fonte. Refeita com
`--include="*.py"`:

| validação | arquivos reais | asserção sobre `.mensagem`? |
|---|---|---|
| `V-CAP-01` | 3 (`test_capa.py`, `test_derivacao_do_orgao.py`, `test_documento_submetido.py`) | nenhuma |
| `V-CTR-05` | 4 (`test_identidade_contratual.py`, `test_periodo_por_extenso.py`, `test_planilha_nao_lida.py`, `test_reconciliation.py`) | nenhuma |

Todos os sete checam `.validacao`, `.codigo`, ou contagem de achados — nunca o texto da mensagem.
**O risco de regressão de teste é zero**, medido, não estimado.

### 2.2 `V-CTR-05` já tem um card agregado — e este não muda

`V-CTR-05` é a única validação hoje servida por `CartaoAgregado` (ESPEC 043 §2.3): quando dispara
várias vezes, a tela já mostra um resumo em português, com texto fixo escrito para ela.
`CartaoAgregado` não lê `.titulo` — dar título a `V-CTR-05` não muda o caminho agregado em nada. O
que muda é só o caminho **singular** (um achado só), que hoje cai em `CartaoDeAchado` com a sigla
exposta — exatamente o que a imagem original mostrava.

### 2.3 Efeito colateral: a Fase C fica desbloqueada, mas não é objeto desta espec

Depois desta entrega, **toda** validação `AVISA` do sistema tem `titulo` — as sete da Fase A, estas
duas, e as que já tinham desde a ESPEC 025 (`V-MED-02`, `V-ANX-01`, `V-ANX-02`, `V-IDT-01` a `03`).
A generalização de `CartaoAgregado` (`I-01` da ESPEC 043) deixa de ter pré-requisito técnico
pendente — mas continua sendo decisão e trabalho de outra spec, não desta.

## 3. Objetivo

Que `V-CAP-01` e `V-CTR-05` ganhem `titulo`/`causa`/`ação`, no mesmo formato da ESPEC 043 — fechando
os dois avisos que originaram esta série de investigações.

**Não é objetivo:** generalizar `CartaoAgregado` (mesmo desbloqueado, §2.3); tocar as validações
`BLOQUEIA`; mudar o caminho agregado de `V-CTR-05`.

## 4. Escopo

### 4.1 Dentro do escopo

`v_cap_01_cliente_nao_derivado` e `v_ctr_05_codigo_contratado_ausente_da_aba`, em
`contract_validations.py` — `registrar` → `registrar_em_partes`.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| `CartaoAgregado` | Desbloqueado tecnicamente (§2.3), mas é decisão e trabalho de spec própria — generalizar um componente é maior que dar texto a duas funções |
| As quatro `BLOQUEIA` (Fase D) | Maior alcance de teste real (`V-CTR-03` sozinha tem 16 arquivos) e maior visibilidade — merece a mesma medição cuidadosa antes de mexer |
| Mudar quando `V-CAP-01`/`V-CTR-05` disparam | Só a forma de registrar muda |

## 5. Regras

| ID | Regra |
|---|---|
| `R-CLA-05` | `V-CAP-01` e `V-CTR-05` passam a usar `registrar_em_partes`, com o texto do §5.1 |
| `R-CLA-06` | **Nenhuma condição de disparo muda** — mesma severidade (`AVISA`), mesmos casos |
| `R-CLA-07` | **Invariante de não-regressão:** os sete arquivos de teste do §2.1 continuam verdes sem edição — nenhum lê `.mensagem` |

### 5.1 O texto de cada validação

| Validação | Título | Causa | Ação |
|---|---|---|---|
| `V-CAP-01` | O nome do órgão não foi identificado automaticamente na proposta. | O sistema não conseguiu localizar o nome do cliente na primeira página da proposta. | A capa do relatório usará o nome que está no título da planilha de levantamento. |
| `V-CTR-05` | O código {codigo} está no contrato, mas não tem registro de uso no levantamento. | Ele está na tabela de preços do contrato, mas não aparece na planilha de medição desta competência. | Este item não entrará no relatório — confira se ele deveria ter sido medido nesta competência. |

### 5.2 Validações

Nenhuma nova — mesmo racional da ESPEC 043 §5.1 (nenhuma desta série cria validação; só reformula
texto de validação existente).

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **Nenhuma substring precisa sobreviver** | Medido (§2.1): zero teste lê `.mensagem` para estas duas. Diferente da Fase A, o texto de `causa`/`ação` não tem restrição herdada do texto antigo |
| `D-02` | **`CartaoAgregado` fica de fora, mesmo desbloqueado** | Generalizar um componente compartilhado por toda a tela é decisão de maior alcance que dar texto a duas funções — merece spec própria, com o próprio risco medido (quais outras validações podem agregar, e o que cada uma deveria mostrar) |
| `D-03` | **A Fase D (`BLOQUEIA`) continua separada** | `V-CTR-03` sozinha tem 16 arquivos de teste reais — ordem de grandeza maior que qualquer validação já tratada nesta série, e merece a mesma cautela que a Fase A/B já tiveram, não menos |

## 7. O que muda no código

| Arquivo | Mudança |
|---|---|
| `infrastructure/validations/contract_validations.py` | `v_cap_01_cliente_nao_derivado`, `v_ctr_05_codigo_contratado_ausente_da_aba` — `registrar` → `registrar_em_partes`, texto de §5.1 |
| `tests/` | Um teste isolado por validação, no molde da ESPEC 043 |
| `frontend/` | **Nenhuma** |

## 8. Testes e critério de aceite

| Regra | Verificação |
|---|---|
| `R-CLA-05` | Cada validação, testada isolada: achado sai com `titulo`, `causa`, `ação` preenchidos |
| `R-CLA-06` | Testes de disparo/não-disparo já existentes, intocados |
| `R-CLA-07` | Os sete arquivos do §2.1 continuam verdes, sem nenhuma linha editada |

**Critério de aceite:** suíte de backend verde; os dois cards, na tela, saem no formato de `V-DOC-01`;
o caminho agregado de `V-CTR-05` (`CartaoAgregado`) continua idêntico.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Achar, tarde, que algum dos sete arquivos lia `.mensagem` afinal | `D-01` é afirmação medida (§2.1), não suposição — conferir de novo na execução custa um `grep`, não uma surpresa |
| Confundir esta entrega com a correção do `CartaoAgregado` | `D-02`, fora do escopo, declarado |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | Com a Fase C tecnicamente desbloqueada (§2.3), vale abri-la em seguida? | Não decide aqui — é chamada de próxima entrega, não desta |

## 11. Relação com a ESPEC 043

Fecha a Fase B que a 043 §2.4 previu e adiou. Nenhuma regra ou decisão da 043 é revisada — só a
estimativa de risco do §2.1 dela, corrigida por medição (§2.1 desta espec).

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Conferir o §2.1 na árvore de execução | PP |
| B | Dois testes + as duas validações | PP |
| C | Suíte completa | PP |

**Estimativa: menos de uma hora.** É a entrega mais barata da série — o risco já estava medido antes
de a spec ser escrita.
