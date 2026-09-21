# PLANO 030 — Implementação de "O vermelho que virou paisagem"

| | |
|---|---|
| **Especificação** | [ESPEC 030](../specs/030-o-vermelho-que-virou-paisagem.md) v1.1 |
| **Versão** | 1.1 — 2026-08-20 — escrito antes da implementação; renumerado quando a execução de fechamento da ESPEC 029 devolveu o `R-PAN-04` ao verde |
| **Backlog** | [TASKS 030](../tasks/030-tasks-o-vermelho-que-virou-paisagem.md) v1.0 — 22 tarefas, `T-2112` a `T-2133`, continuando de `T-2111` |
| **Estado inicial** | Suíte de navegador: **120 testes, 110 verdes, 10 vermelhos** (ESPEC 030 §2 v1.1), com backend no ar. Backend: verde, 1.383. As **14** regressões da ESPEC 029 já foram corrigidas lá |
| **Instrumento existente** | O relatório JSON da execução (`--reporter=json`), que sobrevive à reescrita de linha do terminal; as **âncoras do backend** como fonte dos números do piloto; e `git log -S`, que é o instrumento principal desta entrega |

---

## 1. O que este plano tem de diferente dos anteriores

**Esta entrega é uma investigação com um pouco de código no fim — e não o contrário.**

Os outros planos deste projeto começam sabendo o que fazer e discutem como fazer sem quebrar nada.
Aqui, ao contrário, **as dez correções são triviais e a dificuldade inteira está em decidir qual
correção cada uma pede**. Trocar um `2` por um `3` leva um minuto; saber se aquele `3` é legítimo é
o trabalho.

> **O padrão é "defeito", não "coisa antiga".**
> `R-SUI-03` inverte o instinto de quem olha uma suíte vermelha há meses. Cada um dos dez precisa
> sair da F0 com `ESPEC nnn` e `R-XXX-nn` ao lado — ou entra na lista de defeitos. **Um deles já
> tem cara disso** (§2.5 da espec: o código de serviço que aparece duas vezes), e é o único cujo
> tamanho eu não sei estimar.

**O laço de retorno não pode ser a suíte inteira.** Ela leva **32 minutos**, e um plano que a use
como resposta a cada edição custaria o dia. O laço é por arquivo — `npx playwright test
e2e/limpar.spec.ts` responde em 1 a 4 minutos —, e a suíte inteira roda **duas vezes**: uma para
fixar o estado inicial (já rodou) e outra no portão final.

**A regra mais importante desta espec é verificável por comando, e por isso é verificada a cada
fase.** `R-SUI-01` — o produto não anda para trás — é `git diff --stat frontend/src/` vazio.
Deixar isso para o fim seria descobrir tarde que uma "correçãozinha" no componente resolveu três
testes de uma vez, que é exatamente como a regressão entra.

**E há um risco de método que este projeto já documentou duas vezes**: reancorar colando a saída
atual. `R-SUI-05` proíbe, e a F2 tem uma fonte de números que não é a tela — as âncoras do backend,
que já passaram pelo crivo das suas próprias especs.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — A classificação, com dono** | Fim da F0 | Os dez com espec e regra nomeadas, **ou** marcados defeito por ausência de dono. Nenhuma edição antes disso | Sem `P0` a entrega vira mutirão de colar números — o que a espec existe para não ser |
| **P1 — O produto não se moveu** | Fim de **cada** fase | `git diff --stat frontend/src/` vazio (exceto na F4, e só se o veredito for defeito) | Reverter a fase inteira. É a `R-SUI-01`, e é a exigência explícita do dono do produto |
| **P2 — O veredito do `14.049.00054.00`** | Fim da F4 | Quantas vezes aparece, **em quais componentes**, e a espec que decidiu — ou o conserto, com teste que o guarde | Não fechar a espec com o item em aberto: era ele que justificava a entrega existir |
| **P3 — A suíte inteira verde** | Fim da F5 | `120 passed`, número **declarado** (`D-05`) | Não entregar |
| **P4 — O backend intocado** | Fim da F5 | `git diff --stat backend/` vazio | Escopo vazado |

---

## 3. Fases

### F0 — A classificação `[portão P0]`

**Objetivo:** saber, para cada um dos dez, **quem** moveu o comportamento — antes de tocar em
qualquer arquivo.

| # | Tarefa | Ref. |
|---|---|---|
| T-2112 | Fixar a lista dos dez a partir do JSON da execução de fechamento da ESPEC 029 — `110 passed, 10 failed`. É a linha de base de `P3` | ESPEC §2 |
| T-2113 | Para cada um: `git log --oneline -S "<trecho da asserção>" -- e2e/<arquivo>` — quando o teste nasceu — e `git log --oneline -- frontend/src/<componente>` — quando o comportamento mudou. A interseção nomeia a entrega | `R-SUI-02` |
| T-2114 | Cruzar cada entrega com `docs/specs/` e extrair a **regra** que decidiu a mudança. `ESPEC nnn` sem `R-XXX-nn` não fecha | `R-SUI-03` |
| T-2115 | Separar o que sobrar sem dono. **Esses são defeitos**, e a lista deles é o resultado mais importante desta fase | `R-SUI-03`, `D-02` |
| T-2116 | **[portão]** A tabela dos dez, com classe e dono, neste plano ou no TASKS | **P0** |

> **A família A já tem dono provável, e mesmo assim passa pela F0.** *"É o campo de aditivos"* é
> uma boa hipótese — mas `R-ADT-10` precisa estar citada, porque é ela que autoriza a reancoragem
> na fase seguinte. Hipótese não autoriza nada.

**Tamanho:** P — uma a duas horas. **Nenhum arquivo é editado.**

---

### F1 — Família A: o terceiro campo `[portão P1]`

**Objetivo:** os quatro testes que contam campos passam a **nomear** o que querem.

| # | Tarefa | Ref. |
|---|---|---|
| T-2117 | `limpar.spec.ts` — `valoresDosCampos` distingue os dois obrigatórios do opcional. É a função que os dois testes de lá compartilham, e consertá-la fecha `R-LMP-01` e `R-LMP-04` juntos | `D-04` |
| T-2118 | `a11y-estrutura.spec.ts` — o inventário de nomes acessíveis passa a afirmar sobre os campos **por nome**, e não sobre "todos os `input[type=file]`" | `D-04` |
| T-2119 | `a11y-teclado.spec.ts` — o percurso ganha o degrau do campo de aditivos, na posição que `R-ADT-10` lhe deu, com o comentário dizendo por que ele está ali | `D-04`, `R-ADT-10` |
| T-2120 | **[portão]** Os três arquivos verdes isolados; `git diff --stat frontend/src/` vazio | **P1** |

> **`D-04` é o conteúdo desta fase, não um detalhe.** Trocar `2` por `3` deixaria os quatro testes
> exatamente tão frágeis quanto estavam — envelheceriam de novo no dia do quarto campo. O que muda
> é a asserção passar a falar dos campos que ela quer, e ignorar os que não são dela.

**Tamanho:** P — uma hora.

---

### F2 — Família B: os números da análise `[portão P1]`

**Objetivo:** os quatro de `analise.spec.ts` voltam a afirmar, contra a fonte certa.

| # | Tarefa | Ref. |
|---|---|---|
| T-2121 | Localizar a **fonte** de cada número: `Sem divergência`, o total de itens analisados e a contagem de perfis saem de `AnaliseDaMedicao`, e o backend já os ancora em `test_anchor_analise.py` e `test_analise.py` | `R-SUI-05` |
| T-2122 | Reancorar os quatro de contagem **com a fonte declarada no próprio teste** (`R-SUI-06`): de onde o número vem e qual regra o produz | `R-SUI-06` |
| T-2123 | **[portão]** `analise.spec.ts` verde isolado; `git diff --stat frontend/src/` vazio | **P1** |

> **O número não vem da tela.** Se a fonte for a saída do navegador, o teste passa a afirmar que a
> tela concorda consigo mesma — e a próxima divergência entre backend e frontend fica invisível
> exatamente onde este teste deveria vê-la. As âncoras do backend já foram conferidas contra as
> especs que as decidiram; é delas que o número sai.

**Tamanho:** M — duas a três horas. É a fase mais longa, e o `T-2121` é quase todo o custo.

---

### F3 — Família C: a faixa `[portão P1]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2124 | `smoke.spec.ts` — a frase (`{n} de {n} divergem`) e o número (58, não 55), com a fonte declarada | `R-SUI-06` |
| T-2125 | **[portão]** `smoke.spec.ts` verde; `frontend/src/` intocado | **P1** |

> **Duas mudanças num teste só, e as duas com dono diferente.** A frase mudou no componente; o
> número mudou porque o bloco final entrou no documento (ESPEC 018). Reancorar sem separar as duas
> deixaria metade da explicação de fora — e é essa metade que a próxima pessoa vai procurar.

**Tamanho:** PP — vinte minutos.

---

### F4 — O `14.049.00054.00` `[portão P2]`

**Objetivo:** saber se a tela mostra um item duas vezes por decisão ou por defeito.

| # | Tarefa | Ref. |
|---|---|---|
| T-2126 | Medir: em quais componentes o código aparece no estado `pronto` — grid de divergências, painel de análise, tabela de linhas derivadas, bloco final. **A tabela da ESPEC 021 é o primeiro suspeito**: ela lista as linhas `1 / 1` por derivação, e um item de perfil apareceria nela e no grid | ESPEC §2.5 |
| T-2127 | Achar a decisão: alguma espec decidiu que o mesmo código apareça em dois lugares da tela? `R-PER-*` da ESPEC 021 e `R-PAN-*` da 009 são onde procurar | `R-SUI-03` |
| T-2128 | **Com dono** — reancorar o teste para o que a decisão manda, dizendo em qual componente cada ocorrência mora. **Sem dono** — é defeito: consertar o produto, e aí `P1` cede espaço para esta fase, e só para ela | `R-SUI-04` |
| T-2129 | **[portão]** Veredito escrito, com a contagem por componente | **P2** |

> **Esta é a única fase autorizada a tocar `frontend/src/`**, e só se o `T-2127` não achar dono.
> A ordem importa: procurar a decisão **antes** de consertar evita o pior desfecho possível desta
> entrega — desfazer, em nome de um teste antigo, um comportamento que alguém decidiu de propósito.
> Seria a `R-SUI-01` violada exatamente onde ela é mais difícil de enxergar.

**Tamanho:** P a M — a única incógnita do plano.

---

### F5 — O conjunto `[portões P3, P4]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2130 | Suíte de navegador inteira, com `--reporter=json`: **120 passed** | **P3** |
| T-2131 | O portão de contagem: o total esperado vira número declarado, para que teste que suma apareça como diferença e não como silêncio | `D-05` |
| T-2132 | `git diff --stat backend/` vazio; `npx tsc --noEmit` e `next lint` limpos | **P4** |
| T-2133 | ESPEC 030 para *Implementada*, com a tabela final de classificação; `README.md` | — |

**Tamanho:** PP — meia hora, mais os 32 minutos de execução.

---

## 4. Sequência

```
F0 ──▶ F1 ──▶ F2 ──▶ F3 ──▶ F4 ──▶ F5
class.  campo  números faixa  o item  fecha
 P0      P1     P1     P1    P2      P3 P4
 │                            │
 └ nenhuma edição             └ única fase que pode tocar `src/`
```

**F1, F2 e F3 são independentes entre si** e podem ir em qualquer ordem, ou em paralelo por pessoas
diferentes: tocam arquivos distintos e não compartilham nada além do portão `P1`.

**F0 vem antes de todas, e F4 vem depois de todas** — não por dependência técnica, mas porque a F4
é a única que pode mexer no produto, e é melhor que ela aconteça com a suíte já limpa em volta: um
vermelho novo, ali, tem uma causa só.

---

## 5. O que pode dar errado, e o que pega

| O que | Sintoma | O que pega |
|---|---|---|
| Consertar o produto para o teste antigo passar | Verde, e uma evolução desfeita em silêncio | `P1` ao fim de **cada** fase, não só no fim |
| Reancorar colando a saída da tela | Teste verde que não afirma nada | `T-2121` e a fonte declarada de `R-SUI-06` |
| Classificar como deriva por preguiça | Um defeito real fica mais um semestre | `R-SUI-03` — sem dono nomeado, é defeito |
| Trocar `2` por `3` na família A | Os mesmos quatro testes vermelhos na próxima entrega | `D-04`, e a revisão procura contagem literal no diff |
| Rodar a suíte inteira a cada edição | O dia acaba antes da entrega | Laço por arquivo; a suíte inteira roda duas vezes |
| A F4 virar refatoração | Escopo vazado no fim da entrega | `P2` exige veredito, não melhoria |
| Um teste "sem objeto" ser apagado | O comportamento deixa de ser afirmado, e ninguém nota | `D-03` — apagar é decisão de espec (`I-01`), nunca de execução |

---

## 6. O que este plano não faz

* **Não muda o produto**, exceto na F4 e só com veredito de defeito.
* **Não toca o backend.** `P4` é a verificação.
* **Não acrescenta cobertura.** Nenhum teste novo além do que a F4 exigir para guardar um conserto.
* **Não ataca os 32 minutos** da suíte (`I-02` da espec). É entrega própria, e misturá-la aqui
  faria a reancoragem e a otimização se justificarem uma pela outra.
* **Não apaga teste nenhum.**

---

## 7. Por que a classificação é fase, e não a primeira tarefa de cada correção

O caminho natural seria juntar: para cada teste vermelho, investigar e consertar na sequência.
Seria mais rápido em cada item, e errado no conjunto — por três razões:

1. **O resultado da F0 muda o formato do trabalho.** Se três dos dez forem defeito, esta deixa de
   ser uma entrega de reancoragem e passa a ser uma de correção de produto, com outro risco e
   outro portão. Descobrir isso no sétimo item é descobrir tarde.
2. **Investigar com o conserto na mão enviesa o veredito.** Quem já tem o `git diff` pronto acha
   dono para qualquer coisa. Separar as duas atividades é o que mantém `R-SUI-03` sendo uma
   pergunta de verdade.
3. **A lista de defeitos tem valor próprio mesmo que a entrega pare aqui.** Dez testes vermelhos
   há meses são dez afirmações que ninguém conferiu; saber quais delas não têm dono é resultado,
   com ou sem correção em seguida.

É o mesmo motivo pelo qual o PLANO 028 fez do oráculo uma fase, e não a primeira linha da
implementação: medir antes de mexer é o que separa reancorar de apagar a linha vermelha.
