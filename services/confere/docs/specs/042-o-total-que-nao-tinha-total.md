# ESPEC 042 — O total que não tinha TOTAL:

| | |
|---|---|
| **Status** | **Implementada** — 2026-09-03. Backend **1.561 → 1.566 passed**, zero falhas — uma reprovação de `test_regua_da_tabela_errada.py` (asserção antiga da ESPEC 041, que afirmava `total_declarado is None` como parte do `I-01` que esta espec fecha) foi corrigida no mesmo commit lógico. Os dez documentos do corpus não se moveram. `contrato_cgm.pdf`: `total_declarado == Decimal("5532203.96")`, `V-CTR-03` não bloqueia mais essa peça por "total não localizado". `I-01` (o aditivo real, `PA-CGM-250912-127`, com ordem de colunas trocada) segue aberto, fora do escopo |
| **Versão** | 1.0 — 2026-09-03 |
| **Depende de** | [ESPEC 001](001-mvp-analise-medicao.md) `V-CTR-03` — o checksum que continua sendo o oráculo. [ESPEC 040](040-o-mes-que-veio-com-dias.md) `R-MES-*` — implementada, independente desta. [ESPEC 041](041-a-regua-da-tabela-errada.md) `I-01` — a origem direta desta espec |
| **Revisa** | Nada de decisão anterior. `V-CTR-03` continua exigindo `total_declarado`; esta espec só amplia **onde** ele pode ser encontrado — nunca relaxa o bloqueio quando genuinamente não existe |
| **Não toca** | `_e_item_completo`, a leitura de item por linha (`R-FXA-*`, ESPEC 033/041), a ordem fixa das colunas (`COL_PRECO`/`COL_QUANTIDADE`/`COL_MESES`/`COL_TOTAL`), a severidade de `V-CTR-03` quando o total realmente não está em lugar nenhum do documento |
| **Referência normativa** | `docs/documentos/CGM/PC-CGM-240603-82 v3.0.pdf` (a proposta, já fixture — `contrato_cgm.pdf`) · `docs/documentos/CGM/PA-CGM-250912-127 v4.0.pdf` (o aditivo — **ainda não fixture**, ver `I-01`) |
| **Origem** | `ESPEC 041` `I-01`, com a instrução do usuário de que a correção também cubra aditivo — o que revisou a hipótese inicial (§2.2) |

---

## 1. Problema

**Um documento pode declarar o total do contrato duas vezes, sem nenhuma das duas ser a linha `TOTAL:` que `V-CTR-03` sabe ler — e o relatório é recusado mesmo quando a soma dos itens fecha exatamente com o que o próprio documento afirma.**

`total_declarado` só é preenchido quando o laço de extração encontra uma linha cujo texto contém `"TOTAL:"`, com uma célula contendo `"BRL"` ([pdfplumber_extractor.py:80,291,503-505](../../backend/src/infrastructure/contract/pdfplumber_extractor.py#L503-L505)). A `PC-CGM-240603-82` não tem `"TOTAL:"` em nenhuma das 15 páginas — medido, busca literal, zero ocorrências. O total dela está só em prosa, na página 10: *"O Valor total dos Serviços... é estimado em R$ 5.532.203,96"* — e de novo, na seção "6. CRONOGRAMA FÍSICO-FINANCEIRO", numa linha `TOTAL` (sem dois-pontos) cujo último valor é o mesmo número.

## 2. O que foi levantado

### 2.1 O documento declara o total duas vezes, nunca na forma que o extrator procura

Medido nas duas peças reais da CGM — a proposta e o aditivo `PA-CGM-250912-127`:

| documento | frase em prosa (*"Valor total dos Serviços... estimado em R$ X"*) | `TOTAL` do cronograma físico-financeiro | as duas concordam? |
|---|---|---|---|
| `PC-CGM-240603-82` (proposta) | `R$ 5.532.203,96` | `5.532.203,96` | **sim** |
| `PA-CGM-250912-127` (aditivo) | `R$ 6.110.655,79` | `6.110.655,79` | **sim** |

Nenhuma das duas peças tem `"TOTAL:"` em nenhuma página — a família de propostas CGM inteira declara o total assim, e não na forma que o resto do corpus usa.

### 2.2 A hipótese descartada: usar só o `TOTAL` do cronograma, sem cruzar com a prosa

Primeira ideia, testada e **rejeitada por medição real**: usar diretamente o valor da linha `TOTAL` do cronograma físico-financeiro como `total_declarado`, sempre que a busca normal falhasse.

Contra o `aditivo_pgm.pdf` (aditivo de puro ajuste quantitativo — `Aumento`/`Redução` sobre itens já existentes, sem declarar período novo): o `TOTAL` do cronograma dele é `24.551.037,60` — o **total absoluto do contrato depois do aditivo**. O total que **esta peça** de fato declara (achado pela via normal, que funciona nela) é `-0,12` — o delta que ela move. A aritmética prova a diferença de natureza:

```
24.551.037,72  (contrato_pgm.pdf, a proposta original)
−       0,12   (o delta que este aditivo declara)
─────────────
24.551.037,60  (o TOTAL do cronograma físico-financeiro deste aditivo)
```

Usar o `TOTAL` do cronograma como `total_declarado` de um aditivo assim faria `V-CTR-03` comparar um delta pequeno contra um total de 24 milhões — bloquearia com uma mensagem que **parece** apontar extração incompleta e na verdade é a comparação errada. Pior que o bloqueio de hoje, que ao menos é honesto sobre o que não sabe.

### 2.3 O sinal que resolve, sem precisar classificar o tipo de aditivo

Medido: `aditivo_pgm.pdf` **não tem** a frase *"Valor total dos Serviços... estimado em"* em lugar nenhum — só o cabeçalho de coluna "VALOR TOTAL" do cronograma, que não é frase nenhuma. A ausência da frase já é o sinal que separa este caso dos dois da CGM, sem que o extrator precise saber se está diante de uma prorrogação, um ajuste quantitativo, ou os dois juntos (o próprio `PA-CGM-250912-127` é os dois ao mesmo tempo — declara prorrogação **e** aumento de quantitativo em dois anexos, na mesma peça).

A regra fica: **as duas fontes têm de existir e concordar.** Não é preciso decidir que tipo de peça é — o próprio documento se autoconfirma, com duas frases escritas para leitores diferentes (uma para quem lê a proposta corrida, outra para quem confere o cronograma).

### 2.4 Achado fora de escopo: `PA-CGM-250912-127` tem a ordem das colunas trocada

Ao investigar o aditivo, a extração dele parou noutro ponto: `item 14.049.00039.00 (página 4) sem quantidade`. Medido na linha crua: a ordem física das colunas nesta peça é **quantidade, período, preço** — não **preço, quantidade, período** como em todo o resto do corpus, inclusive a própria proposta CGM. É um defeito de geometria, de outra causa, que faz `COL_PRECO`/`COL_QUANTIDADE`/`COL_MESES` lerem a célula errada em cada posição. **Não tem relação com `total_declarado`**, e por isso o aditivo real não pode, hoje, virar fixture de extração ponta a ponta — ver `I-01`.

## 3. Objetivo

Que `total_declarado` seja localizado quando o documento o declara por duas fontes textuais independentes e concordantes — mesmo sem linha `TOTAL:` — em proposta ou em aditivo, sem que o extrator precise classificar o tipo da peça.

**Não é objetivo:** aceitar uma fonte só como prova; corrigir a ordem de colunas do `PA-CGM-250912-127` (`I-01`); relaxar `V-CTR-03` quando o total genuinamente não está em lugar nenhum do documento.

## 4. Escopo

### 4.1 Dentro do escopo

- Uma busca em prosa pela frase *"Valor total dos Serviços... estimado em R$ X"*;
- A leitura da linha `TOTAL` (sem dois-pontos) dentro da seção "CRONOGRAMA FÍSICO-FINANCEIRO";
- O cruzamento das duas — só produz valor quando concordam, dentro da mesma tolerância do checksum;
- Acionado **só** quando a busca normal (`TOTAL:`/`BRL`) já percorreu o documento inteiro sem achar nada.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| A ordem de colunas trocada no `PA-CGM-250912-127` | `I-01` — outra causa, e bloqueia a extração antes de chegar a `total_declarado` |
| Aceitar só a prosa, ou só o cronograma, sem cruzar | `D-01` — medido no `aditivo_pgm.pdf`: uma fonte só mentiria sobre o total desta peça |
| Classificar o tipo de aditivo (prorrogação, ajuste, os dois) | `D-02` — desnecessário; a convergência das duas fontes já decide |
| Trazer `PA-CGM-250912-127` como fixture de extração completa | Depende de `I-01` estar resolvido primeiro |

## 5. Regras

| ID | Regra |
|---|---|
| `R-TOT-01` | Quando o laço principal termina com `total_declarado is None`, uma segunda busca — só textual, sem grade — procura a frase *"Valor total dos Serviços... estimado em R$ X"* em qualquer página do documento |
| `R-TOT-02` | A mesma busca localiza a seção "CRONOGRAMA FÍSICO-FINANCEIRO" e, nela, a linha cujo primeiro token é `TOTAL`; o último valor monetário da linha é o candidato do cronograma |
| `R-TOT-03` | `total_declarado` só recebe o valor da prosa se **as duas buscas acharem algo** e os dois valores baterem dentro da mesma tolerância de `V-CTR-03` (`TOLERANCIA_CHECKSUM`, `0,01`). Achando só uma, ou divergindo as duas, `total_declarado` permanece `None` — o bloqueio de hoje continua valendo |
| `R-TOT-04` | **Invariante de não-regressão:** os dez documentos do corpus que já têm `total_declarado` preenchido não passam por este código — a régua de `sha` da ESPEC 033/040/041 continua idêntica |

### 5.1 Validações

**Nenhuma validação nova.** `V-CTR-03` já é o oráculo — soma os itens e compara contra `total_declarado`, venha ele de onde vier. Esta espec só amplia a fonte; a prova de integridade continua sendo a mesma.

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **Exige as duas fontes concordando, nunca uma só** | Medido (§2.2): o `TOTAL` do cronograma sozinho, num aditivo de ajuste quantitativo, é o total absoluto pós-aditivo — não o delta que a peça declara. Só a convergência com a prosa evita usar esse número no lugar errado |
| `D-02` | **Não classifica o tipo da peça** (proposta, aditivo de prorrogação, de ajuste, ou os dois) | O `PA-CGM-250912-127` é prorrogação **e** ajuste na mesma peça — uma classificação binária já nasceria errada. A convergência das duas fontes textuais é suficiente, e não exige entender a semântica do documento |
| `D-03` | **A tolerância é a mesma de `V-CTR-03`, `TOLERANCIA_CHECKSUM`** | Duas fontes que declaram o mesmo valor por vias diferentes (frase corrida vs. tabela) podem divergir por arredondamento de centavo; a mesma régua que já protege o checksum protege esta comparação |
| `D-04` | **Acionado só depois de a busca normal esgotar o documento inteiro** | Preserva o comportamento de hoje bit a bit para os dez documentos que já funcionam — nenhum deles chega a este código |
| `D-05` | **A ordem de colunas do aditivo fica de fora (`I-01`)** | Causa e mecanismo diferentes: `_montar_item` lê célula errada por posição fixa, e nenhuma correção de `total_declarado` resolve isso |

## 7. O que muda no código

| Arquivo | Mudança |
|---|---|
| `infrastructure/contract/pdfplumber_extractor.py` | Duas expressões regulares novas (frase de prosa, linha `TOTAL` do cronograma) e uma função privada que as cruza. Chamada uma vez, ao fim de `extrair()`, só quando `total_declarado is None` — custo extra só no caminho que hoje bloqueia |
| `domain/`, `application/`, `api/`, `frontend/` | **Nenhuma** |

## 8. Testes e critério de aceite

| Regra | Verificação |
|---|---|
| `R-TOT-01`/`R-TOT-02` | Casos construídos (string sintética, sem PDF) com a frase de prosa e a linha do cronograma, no molde dos valores medidos em §2.1 e §2.3 |
| `R-TOT-03` | Caso em que só uma das duas existe → `None`; caso em que as duas existem e divergem → `None`; caso em que concordam → o valor |
| `R-TOT-04` | Régua dos dez documentos do corpus (`test_extractor_aditivo_smul.py::REGUA`) — idêntica |
| Integração | `contrato_cgm.pdf`: `total_declarado == Decimal("5532203.96")`; `V-CTR-03` deixa de bloquear por "não localizado" nesta peça, e o checksum fecha (`soma_dos_totais` já bate exato, medido na ESPEC 041) |
| `I-01`, fora do escopo | `PA-CGM-250912-127` **não** entra como fixture de extração completa — a prova sobre aditivo fica em caso construído a partir do texto real, não em documento inteiro |

**Critério de aceite:** nenhum `sha` do corpus se move; `contrato_cgm.pdf` deixa de bloquear por `V-CTR-03` "total não localizado"; a suíte fecha verde.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| As duas fontes concordarem por coincidência, com uma delas errada | Improvável por construção (duas frases escritas independentemente, para leitores diferentes), e `V-CTR-03` continua comparando o resultado contra `soma_dos_totais` depois — grade errada nos itens ainda derruba o checksum |
| A regex de prosa casar com uma frase de "valor total" em outro contexto do documento | Âncora específica na sequência *"Valor total dos Serviços... estimado em R$"*, não em "valor total" solto |
| Confundir esta correção com "o aditivo `PA-CGM-250912-127` já funciona" | `I-01` declarado explicitamente no escopo e no critério de aceite — o aditivo continua bloqueado por outro motivo |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | `PA-CGM-250912-127` tem a ordem das colunas trocada (quantidade, período, preço) e não extrai por completo — impede trazê-lo como fixture de teste de ponta a ponta, e impede confirmar em documento real que `R-TOT-*` fecha o relatório de um aditivo | Não bloqueia esta espec — a prova sobre aditivo usa caso construído a partir do texto real (§8). Bloqueia o aditivo real ficar 100% verde — candidato a spec própria |

## 11. Relação com a ESPEC 041

Fecha o `I-01` daquela espec — o `total_declarado is None` que a `R-FXA-09` deixou como último bloqueio do `contrato_cgm.pdf`. Não reabre nada da 041: a leitura de item por linha continua exatamente como ficou.

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Testes com os valores já medidos nesta espec (§2.1, §2.3) | P |
| B | As duas regexes e a função de cruzamento em `pdfplumber_extractor.py` | PP |
| C | Suíte completa e conferência de `sha` do corpus | PP |

**Estimativa: menos de meio dia.** A medição está pronta; falta só escrever.
