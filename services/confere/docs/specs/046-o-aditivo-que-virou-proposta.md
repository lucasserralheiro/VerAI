# ESPEC 046 — O aditivo que virou proposta

| | |
|---|---|
| **Status** | **Implementada** — 2026-09-08. Backend **1.601 → 1.601 passed**, zero falhas — nenhum teste novo, nenhum removido, só o comportamento de `test_t1332` invertido. `ruff`/`mypy` limpos. O risco central desta espec (§9) **não é mitigado por ela** — é uma decisão explícita, tomada com o risco conhecido, registrada aqui para que quem ler depois saiba que não foi descuido |
| **Versão** | 1.0 — 2026-09-08 |
| **Depende de** | [ESPEC 019](019-contrato-e-aditivos.md) `R-ADT-01` a `R-ADT-08` — a consolidação (`Contract.aplicar()`) e o bloqueio que esta espec remove, com a razão original de existir |
| **Revisa** | [ESPEC 019](019-contrato-e-aditivos.md) `R-ADT-03`, segunda forma — *"Proposta no campo de aditivo... Bloqueia porque o resultado seria um relatório com o escopo faltando"*. Esta espec remove esse bloqueio, por pedido explícito, depois de o risco ter sido levantado e confirmado nesta conversa |
| **Não toca** | A primeira forma de `V-ADT-03` (peça repetida — duplicata de arquivo), `Contract.aplicar()` e a consolidação de blocos rotulados, `V-ADT-01`, `V-ADT-02`, `V-ADT-04`, o checksum de `V-CTR-03` |
| **Referência normativa** | `PA-CGM-250912-127 v4.0.pdf` (o caso que motivou — aditivo genuíno, bloco único sem rótulo) · `PC-CGM-240603-82 v3.0.pdf` (o caso simétrico — mesma forma, já sem checagem hoje, por estar no campo do contrato) |
| **Origem** | Pedido direto do usuário nesta conversa: *"Há como deixar igual a proposta"*, depois de alertado explicitamente sobre o risco de descarte silencioso (§9) e de ter escolhido esta opção mesmo assim |

---

## 1. Problema

**Hoje, um aditivo cujo bloco único não tem rótulo é sempre bloqueado — mesmo quando a peça se declara aditivo genuíno na própria capa.** `PA-CGM-250912-127 v4.0` é uma "PROPOSTA DE ADITIVO AO CONTRATO TC 16/CGM/2024" — uma renovação que restabelece o escopo inteiro, sem usar `Inclusão`/`Redução`/`Aumento`, porque não movimenta item por item. Isso produz um único bloco sem rótulo, e `V-ADT-03` bloqueia, obrigando quem submete a reenviar manualmente no campo do contrato toda vez que esse formato aparecer.

O usuário pediu, sabendo o custo: que o aditivo pare de ser checado dessa forma — que ele seja tratado exatamente como a proposta já é hoje, que nunca passa por esse crivo.

## 2. O que foi levantado no código

### 2.1 A checagem é assimétrica por desenho, não por lacuna

`v_adt_03_peca_repetida_ou_trocada` ([contract_validations.py:384-424](../../backend/src/infrastructure/validations/contract_validations.py#L384-L424)) tem dois ramos. O segundo:

```python
for aditivo in aditivos:
    if len(aditivo.blocos) == 1 and aditivo.blocos[0].rotulo is None:
        achados.registrar("V-ADT-03", Severity.BLOQUEIA, ...)
```

percorre só `aditivos` — nunca `proposta`. Medido nesta conversa: `PC-CGM-240603-82` (a proposta-base) tem exatamente a mesma forma — bloco único, sem rótulo —, e não dispara nada, porque nunca é examinada por este ramo.

### 2.2 Por que o bloqueio existe: o que `Contract.aplicar()` faz com um bloco sem rótulo

`Contract.aplicar()` ([contract.py:217-224](../../backend/src/domain/entities/contract.py#L217-L224)) só sabe combinar blocos rotulados `Inclusão`/`Exclusão`/`Aumento`/`Redução`. Um bloco sem rótulo não cai em nenhum desses ramos — **é ignorado por completo**. Se `V-ADT-03` deixar de bloquear, um aditivo assim submetido produz um relatório idêntico ao que sairia **sem esse aditivo nenhum** — os 27 itens da peça desaparecem, sem erro e sem aviso.

### 2.3 O relatório sai, e sai sem o escopo — confirmado nesta conversa

Rodado o pipeline completo (`DIContainer.gerar`) com `PC-CGM-240603-82` como contrato e `PA-CGM-250912-127 v4.0` forçado como aditivo, sem `V-ADT-03` no caminho: `resultado.achados.bloqueado` é `False`, `resultado.relatorio` não é `None`. O relatório é gerado — só que sem o escopo que o aditivo deveria ter trazido.

## 3. Objetivo

Que um aditivo com bloco único sem rótulo pare de ser bloqueado — que a checagem trate aditivo e proposta da mesma forma: nenhuma das duas passa por este crivo.

**Não é objetivo:**
- registrar qualquer sinal — nem `AVISA` — quando isso ocorrer. É remoção completa, não um rebaixamento de severidade (ao contrário do que a ESPEC 040 fez com `meses`). O usuário pediu especificamente "igual à proposta", e a proposta não deixa rastro nenhum nesse crivo;
- mudar como `Contract.aplicar()` consolida blocos — um bloco sem rótulo continua sendo ignorado por ela; só deixa de ser **impedido de chegar** até ela;
- distinguir "aditivo de renovação genuíno" de "peça errada no campo errado" por nenhum sinal novo (como a declaração `PROPOSTA DE ADITIVO AO CONTRATO`, medida na mesma conversa) — essa distinção **não entra nesta espec**, por decisão: o pedido foi para remover a checagem, não para torná-la mais seletiva.

## 4. Escopo

### 4.1 Dentro do escopo

- Remover o segundo ramo de `v_adt_03_peca_repetida_ou_trocada` (o laço `for aditivo in aditivos:` que testa bloco único sem rótulo);
- Ajustar o teste que hoje afirma esse bloqueio (`test_t1332_v_adt_03_bloqueia_proposta_no_campo_de_aditivo`, [test_consolidacao_aditivos.py:253-267](../../backend/tests/test_consolidacao_aditivos.py#L253-L267)) para afirmar o oposto;
- Atualizar o docstring da função, que hoje descreve as "duas formas" — passa a descrever uma só.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| A primeira forma de `V-ADT-03` (peça repetida) | Checagem independente, sobre duplicata de arquivo — nada do pedido a envolve |
| `Contract.aplicar()` | Continua ignorando bloco sem rótulo — o comportamento dela não muda, só deixa de ser barrado antes de chegar lá |
| Sinal de aviso substituto | `D-02` — considerado e rejeitado; ver §6 |
| Detecção de "aditivo genuíno" por declaração da capa (`PROPOSTA DE ADITIVO AO CONTRATO`) | Fora do pedido — isso tornaria a checagem mais seletiva, não removida |

## 5. Regras

| ID | Regra |
|---|---|
| `R-ADT-03-rev` | A segunda forma de `R-ADT-03` — bloco único sem rótulo em aditivo — deixa de existir. Um aditivo assim submetido não gera achado nenhum; segue para `Contract.aplicar()`, que o ignora silenciosamente (comportamento inalterado, ESPEC 019) |
| `R-ADT-03a` | A primeira forma — peça repetida — permanece intocada, exatamente como está hoje |

### 5.1 Validações

Nenhuma validação nova. **Uma validação existente é removida** — o oposto do padrão desta série de specs (033 a 045), todas elas com o mesmo refrão "sem validação nova, o checksum já é o oráculo". Aqui não há oráculo nenhum para o que se perde: `V-CTR-03` soma os itens que **chegaram** — um bloco inteiro que nunca chegou não move soma nenhuma, e o checksum fecha normalmente, sem saber que faltou algo.

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **Remoção completa, não rebaixamento para `AVISA`** | Pedido explícito do usuário — "igual à proposta" — depois de alertado que a alternativa mais segura (avisar, não calar) existia e foi oferecida. Registrado aqui para que a ausência de aviso não pareça descuido de uma revisão futura |
| `D-02` | **Nenhum sinal novo baseado na declaração `PROPOSTA DE ADITIVO AO CONTRATO`** | Essa distinção (aditivo genuíno vs. peça errada) foi levantada na mesma conversa como alternativa mais segura — tornaria a checagem seletiva em vez de removê-la. Não é o que foi pedido; fica registrada como caminho não tomado, não esquecido (`I-01`) |
| `D-03` | **A primeira forma de `V-ADT-03` não é tocada** | Protege contra duplicata de arquivo — risco diferente, sem relação com o que motivou o pedido |

## 7. O que muda no código

| Arquivo | Mudança |
|---|---|
| `infrastructure/validations/contract_validations.py` | `v_adt_03_peca_repetida_ou_trocada`: remove o laço `for aditivo in aditivos: if len(aditivo.blocos) == 1 and ...`. Docstring reescrito para descrever só a forma que resta |
| `tests/test_consolidacao_aditivos.py` | `test_t1332_v_adt_03_bloqueia_proposta_no_campo_de_aditivo` deixa de afirmar bloqueio — passa a afirmar `achados.achados == []` para o mesmo caso, ou é removido, se não sobrar comportamento distinto para testar |
| `domain/`, `application/`, `api/`, `frontend/`, `container.py` | **Nenhuma.** A função já está com o `import`/wiring corretos; a mudança é inteira dentro do corpo dela |

## 8. Testes e critério de aceite

| Regra | Verificação |
|---|---|
| `R-ADT-03-rev` | `PA-CGM-250912-127 v4.0` submetido como aditivo (com `PC-CGM-240603-82` como contrato) não bloqueia mais. **O relatório sai sem os itens desse aditivo — isto é o resultado esperado desta espec, não uma regressão a investigar** |
| `R-ADT-03a` | O caso de peça repetida (`test_t1350_aditivo_repetido_bloqueia`, `test_api_e2e.py`) continua bloqueando, sem alteração |

**Critério de aceite:** o teste de bloco único sem rótulo deixa de afirmar bloqueio; o teste de peça repetida não muda; suíte completa verde.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| **Um aditivo com bloco único sem rótulo — genuíno ou por engano — desaparece do relatório sem nenhum sinal, para sempre, depois desta mudança** | **Nenhuma.** É o efeito pretendido pela decisão `D-01`. Quem revisar o relatório final não tem, dentro do sistema, nenhuma pista de que um aditivo submetido não teve efeito nenhum — a mesma situação que `V-ADT-02` avisa para aditivos rotulados (`Aumento`/`Redução` sem itens) não existe para bloco sem rótulo nenhum, porque ele nunca chega a ser um bloco "sem efeito": é tratado como se não tivesse sido submetido |
| Alguém, no futuro, enviar por engano uma proposta comercial inteira no campo de aditivo (o caso original que `R-ADT-03` foi escrita para pegar, ESPEC 019) | Nenhuma. Depois desta espec, esse envio também deixa de bloquear — o cenário que motivou a regra original volta a ser possível, sem aviso |
| Confundir "o aditivo não teve efeito porque não movimenta" (`V-ADT-02`, que avisa) com "o aditivo não teve efeito porque foi descartado inteiro" (esta espec, que não avisa) | Nenhuma dentro do sistema. Só processo externo — conferência manual de quem submete — evita a confusão |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | Se o silêncio se mostrar problemático na prática — um aditivo submetido e esquecido, um relatório saindo incompleto sem ninguém notar —, a alternativa mais segura (`D-02`: usar a declaração `PROPOSTA DE ADITIVO AO CONTRATO` para distinguir e ao menos avisar) continua disponível como espec própria, não descartada, só não escolhida agora | Não bloqueia esta espec; é o caminho de volta se a decisão precisar ser revista |

## 11. Relação com a ESPEC 019 e a ESPEC 045

A ESPEC 019 criou `R-ADT-03` depois de medir o custo do silêncio: *"a proposta a descartaria inteira, em silêncio"* — a frase que a mensagem de hoje ainda carrega. Esta espec reverte essa decisão para um caso específico, com o mesmo custo, agora aceito conscientemente em vez de evitado.

A ESPEC 045 (a mesma peça, `PA-CGM-250912-127 v4.0`) resolveu um problema de **conteúdo lido errado** — preço e quantidade trocados, mas presentes. Esta espec é sobre **conteúdo que deixa de aparecer**. São riscos de naturezas opostas: um corrompe silenciosamente o que está lá; o outro apaga silenciosamente o que deveria estar.

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Remover o ramo em `contract_validations.py` e reescrever o docstring | PP |
| B | Ajustar `test_t1332_v_adt_03_bloqueia_proposta_no_campo_de_aditivo` | PP |
| C | Suíte completa | PP |

**Estimativa: menos de uma hora.** É a menor mudança de código desta série — e a que carrega o maior risco por linha removida.
