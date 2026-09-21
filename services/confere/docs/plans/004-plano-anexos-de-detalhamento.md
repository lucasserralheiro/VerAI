# PLANO 004 — Implementação dos Anexos de Detalhamento

| | |
|---|---|
| **Especificação** | [ESPEC 004](../specs/004-anexos-de-detalhamento.md) v1.3 |
| **Versão** | 1.0 — 2026-08-06 |
| **Estado inicial** | DOCX de 3 páginas em produção, 224 testes verdes, teste-âncora em 54 de 55 |

---

## 1. O princípio que ordena este plano

São 19 anexos, mas **não são 19 problemas**. É um problema — despejar uma aba num
DOCX preservando forma — repetido dezenove vezes.

Por isso o plano não avança anexo a anexo. Ele prova a **máquina** numa fatia
vertical, depois a submete aos **dois extremos**, e só então roda os dezesseis
restantes, que passam a ser repetição.

Fazer o contrário — começar pelo `Central de Servicos`, de 7 linhas e 3 colunas —
seria confortável e não provaria nada: os problemas reais estão no volume de
`Usuários` e na largura de `Comunicação Dados`.

**Escolha da fatia:** `NAS`. Retrato, 7 colunas, 42 linhas, com mesclagens,
preenchimentos e negrito — o caso completo em tamanho conferível de relance.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P1 — A máquina funciona** | Fim da F1 | O anexo `NAS` sai no documento **visualmente igual** à página 25 do GRC | Rever o leitor genérico antes de escalar o erro por 19 |
| **P2 — Os extremos cabem** | Fim da F2 | `Usuários` gera 16 páginas com cabeçalho repetido; `Comunicação Dados` cabe com 22 colunas em 3,5 pt | Ajustar largura e corpo antes dos demais |
| **P3 — O conjunto** | Fim da F4 | 19 anexos, **teste-âncora intacto**, tempo medido e documento aberto no Word | Não entregar |

**P1 é o que economiza trabalho.** Um defeito no leitor descoberto no anexo 19 custa
dezenove correções; descoberto no primeiro, custa uma.

---

## 3. Fases

### F0 — Fundação: o leitor e a fixture

**Objetivo:** ler qualquer aba preservando forma, e poder testar `Usuários` e
`Office365` sem dado pessoal no repositório.

| # | Tarefa | Ref. |
|---|---|---|
| T-301 | Leitor genérico de aba: valores, mesclagens, preenchimentos e negrito | `R-ANX-05`, `R-ANX-06` |
| T-302 | **[risco]** Fixture sintética para `Usuários` e `Office365` — mesma forma, mesma contagem, dados gerados | `R-ANX-10` |
| T-303 | Teste do leitor contra abas reais de forma variada — `NAS`, `Comunicação Dados`, `BD` | |
| T-304 | Teste de guarda: nenhuma fixture do repositório contém nome, login ou e-mail reais | `R-ANX-10` |

**Verificação:** o leitor devolve as 42 linhas × 7 colunas do `NAS` com as 9 mesclagens
e os preenchimentos; os 224 testes seguem verdes.

> **T-302 antes de tudo.** Sem a fixture sintética, os testes de `Usuários` só rodariam
> com o arquivo íntegro, que não entra no repositório. Adiar isso significaria escrever
> testes que só passam na minha máquina.

**Tamanho:** M — meio dia.

---

### F1 — A fatia vertical `[portão]`

**Objetivo:** o anexo `NAS` no documento, de ponta a ponta.

| # | Tarefa | Ref. |
|---|---|---|
| T-305 | `anexos.json` com **uma** entrada: `NAS` | `R-ANX-04` |
| T-306 | Entidade `Anexo` no domínio — nome, orientação, corpo, linha de cabeçalho | |
| T-307 | Nova seção por anexo, com orientação e quebra de página | `R-ANX-02`, `R-ANX-03` |
| T-308 | Tabela do anexo: mesclagens, preenchimentos, negrito, corpo de fonte | `R-ANX-06` |
| T-309 | Cabeçalho repetido — `w:tblHeader` na linha declarada | `R-ANX-11` |
| T-310 | Testes de estrutura e formatação do anexo | **P1** |

**Verificação:** o documento tem 4 páginas — capa, comprovação, `NAS` — e a página do
`NAS` é **conferida ao lado da página 25 do GRC**.

**Tamanho:** G — um dia. **Encerra:** P1.

---

### F2 — Os dois extremos `[portão]`

**Objetivo:** submeter a máquina ao que ela tem de mais difícil.

| # | Tarefa | Alvo |
|---|---|---|
| T-311 | **[risco]** `Usuários`: 1.021 linhas, paisagem, 16 páginas | volume e paginação |
| T-312 | Conferir que o cabeçalho se repete em todas as páginas do anexo | `R-ANX-11` |
| T-313 | **[risco]** `Comunicação Dados`: 22 colunas em 3,5 pt | largura extrema |
| T-314 | Larguras de coluna: dividir a área útil proporcionalmente à planilha | |
| T-315 | Medir o tempo real de geração dos dois | §5 |

**Verificação:** `Usuários` produz 1.021 linhas de dados no documento; `Comunicação
Dados` cabe na largura útil sem coluna cortada. **Os dois conferidos no Word.**

> A largura é o ponto sensível de T-313. A tabela de comprovação já ensinou que a
> margem interna das células conta: com 22 colunas, o padrão do Word somaria 4,7 cm.

**Tamanho:** G — um dia. **Encerra:** P2.

---

### F3 — Os dezesseis restantes

**Objetivo:** completar os 19, sem novidade técnica.

| # | Tarefa |
|---|---|
| T-316 | `anexos.json` completo, com as 19 entradas medidas na ESPEC 004 §3 |
| T-317 | Comportamento de aba vazia: título e observação, sem quebrar |
| T-318 | Teste de cobertura: os 19 anexos presentes, na ordem, com a orientação certa |

**Verificação:** o documento tem cerca de 41 páginas, com 19 anexos na ordem da spec.

**Tamanho:** M — meio dia. **Depende de:** P2.

---

### F4 — Verificação do conjunto `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-319 | **Teste-âncora**: 54 de 55 linhas, inalterado | `R-ANX-09`, **P3** |
| T-320 | Determinismo: duas execuções produzem documentos idênticos | `R-DOC-10` |
| T-321 | Medir o tempo real de ponta a ponta e comparar com a projeção de 25 s | §5 |
| T-322 | Abrir o documento completo no Word e percorrer os 19 anexos | **P3**, insumo `K-01` |

**Verificação:** os três critérios acima, e o documento abre sem aviso do Word.

**Tamanho:** M — meio dia.

---

### F5 — Documentação

| # | Tarefa |
|---|---|
| T-323 | README: o documento passa a ter ~41 páginas; registrar o tempo de geração medido |
| T-324 | CHANGELOG: o incremento e a decisão de manter os anexos fora da tela |
| T-325 | TASKS 004 atualizado com o resultado e os desvios |

**Tamanho:** P — duas horas.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3 ──► F4 ──► F5
   (leitor) P1    P2         P3
   (fixture)
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | 3 a 5 dias |

Sem paralelização útil: F1 prova o que F2 estressa e F3 repete.

---

## 5. Desempenho — o que medir e quando

A ESPEC 004 §6 mediu **12,8 s** só para as 15.315 células de `Usuários`, e projetou
**20 a 25 s** para os 19 anexos. Você confirmou que 25 s é tolerável, e a otimização
ficou fora do escopo.

Duas medições ficam no plano assim mesmo:

| Quando | O que medir | Por quê |
|---|---|---|
| T-315, fim da F2 | Tempo de `Usuários` + `Comunicação Dados` | Se já passar de 25 s aqui, a projeção estava otimista e vale reabrir a conversa **antes** da F3 |
| T-321, fim da F4 | Tempo de ponta a ponta, real | É o número que vai para o README, e o que a tela vai fazer o usuário esperar |

**Se T-321 passar de 40 s**, a opção 2 da ESPEC 004 §6 — emitir o XML das tabelas
grandes diretamente — deixa de ser escape e vira necessidade. Registrar, não decidir
sozinho.

---

## 6. O que pode dar errado, e o que pega

| O que pode dar errado | O que pega | Quando |
|---|---|---|
| O leitor perder mesclagens ou preenchimentos | Teste do leitor (T-303) e a conferência visual do `NAS` | F0, F1 |
| Colunas de `Comunicação Dados` estourarem a largura | Teste de soma de larguras (T-314) | F2 |
| Cabeçalho não repetir | Teste do `w:tblHeader` (T-312) | F2 |
| **Os anexos deslocarem a tabela de comprovação** | **Teste-âncora** (T-319) | F4 |
| Tempo passar de 25 s | Medições de T-315 e T-321 | F2, F4 |
| **Aparência de um anexo sair errada** | **Nada automático.** Conferência visual | F1, F2, F4 |
| Dado pessoal entrar no repositório | Teste de guarda (T-304) e o hook de pré-commit | F0 |

A penúltima linha é a mesma lição da ESPEC 003: **os testes garantem forma e conteúdo,
não aparência.** Lá foram seis defeitos que passaram por toda a suíte e só apareceram
no Word. Aqui há 19 anexos — a conferência visual não é opcional, e é por isso que
P1 e P2 a exigem antes de escalar.

---

## 7. Insumos

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **K-01** | **Aceite visual do documento completo, aberto no Word** | T-322 | É a única verificação de aparência que existe |
| **K-02** | Aceite visual da fatia `NAS` e dos dois extremos | P1 e P2 | Risco de repetir um erro de formatação por 19 anexos |

`K-02` é o que torna `K-01` barato: conferir três anexos cedo evita descobrir na
entrega que os dezenove precisam de ajuste.

---

## 8. O que este plano não faz

- **Não otimiza o desempenho.** Fora do escopo por decisão sua, com o gatilho de §5
  registrado.
- **Não leva os anexos para a tela.** ESPEC 004 §3.4. `api/` e `frontend/` não mudam.
- **Não mapeia item de serviço para anexo.** É o insumo que falta para o detalhamento
  sob demanda, registrado como evolução na ESPEC 004 §12.
- **Não altera a capa nem a tabela de comprovação.** Se o teste-âncora quebrar, algo
  foi entendido errado — os anexos entram **depois**, e nada antes deles muda.
