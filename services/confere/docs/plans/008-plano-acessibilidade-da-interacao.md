# PLANO 008 — Implementação da Acessibilidade da Camada de Interação

| | |
|---|---|
| **Especificação** | [ESPEC 008](../specs/008-acessibilidade-da-interacao.md) v1.0 |
| **Versão** | 1.0 — 2026-08-07 |
| **Estado inicial** | 8 usos de `navy-300` abaixo de AA; camada ARIA vazia fora de 6 `aria-hidden` decorativos; zero estilos de foco; 308 testes de backend verdes; 2 testes de fumaça |

---

## 1. O princípio que ordena este plano

São 20 regras, mas **não são 20 problemas**. É um problema — a interação nunca foi medida —
manifestado vinte vezes.

A ESPEC 008 §1 mostra que estes defeitos atravessaram **três especificações que se importavam com
acessibilidade**. Ninguém foi negligente: a 005 mediu contraste, a 006 recusou imagem por causa do
leitor de tela, a 007 discutiu nome acessível. Os defeitos sobreviveram porque **nada os media**.

Então corrigir primeiro e medir depois seria repetir exatamente o modo de falha que a espec
diagnostica. Este plano inverte:

> **O instrumento vem antes da correção, e tem de acusar antes de absolver.**

A F0 constrói a verificação e a roda **sobre o código quebrado**. Se ela vier verde ali, o
instrumento está errado — e um instrumento errado é pior que nenhum, porque produz conformidade
declarada sobre defeito intacto. É a mesma lição da ESPEC 003, onde seis defeitos passaram por toda
a suíte e só apareceram quando alguém abriu o Word.

Há uma segunda razão, mecânica e irreversível: a ESPEC 008 §3 proíbe alteração de layout, e a §9.2
cobra **captura idêntica à anterior**. A "anterior" deixa de existir no instante em que o primeiro
arquivo for editado. **A linha de base é porta de mão única** — ou é tirada na T-401, ou o critério
de aceite mais importante do plano fica sem como ser verificado.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P1 — O instrumento acusa** | Fim da F0 | A varredura `axe` **reprova**, o script de contraste lista os **8** usos de `navy-300`, e o percurso de teclado **falha no passo 2** | O instrumento está medindo outra coisa. Corrigir antes de escrever uma linha de correção |
| **P2 — O anúncio é ouvido** | Fim da F2 | Um leitor de tela real **anuncia a conclusão** do processamento. Não "o `aria-live` está no DOM" — ouvido | O erro de D-03 está presente. Nenhuma inspeção de DOM o pega |
| **P3 — Fecha sem mouse, sem mexer pixel** | Fim da F5 | O trabalho completo é executável **só com teclado**, e a diferença de captura contra a T-411 é **vazia fora da legenda** | Não entregar |

**P1 é o que dá sentido a todo o resto.** Sem ele, cada fase seguinte entrega convicção em vez de
evidência — e convicção é precisamente o que produziu o estado inicial.

**P2 é o que economiza retrabalho silencioso.** O erro de D-03 — região viva montada junto com o
conteúdo — passa por `axe`, passa por revisão de código e passa por qualquer teste de DOM. Só não
passa por um humano com fone.

---

## 3. Fases

### F0 — O instrumento e a linha de base `[portão]`

**Objetivo:** poder provar o antes e o depois. **Nenhum arquivo de `src/` é tocado nesta fase.**

| # | Tarefa | Ref. |
|---|---|---|
| T-401 | **[porta de mão única]** Captura de referência em 1366 × 768 e 390 px, nos quatro estados — `inicial`, `processando`, `pronto`, `bloqueado` | §9.2 |
| T-402 | `@axe-core/playwright` como **devDependency**; varredura nos quatro estados — ver §6.1 | §9.2 |
| T-403 | Script de contraste: percorre os nós de texto, lê `getComputedStyle` da cor e do **fundo efetivo**, calcula pela fórmula WCAG 2.1 | `R-ACE-01` |
| T-404 | Teste de percurso de teclado, escrito contra o percurso **proposto** da ESPEC 008 §6 | `R-ACE-04` a `08` |
| T-405 | Registrar a linha vermelha: qual violação, em que arquivo, quantas | **P1** |

**Verificação:** os três instrumentos **reprovam**, e reprovam nos lugares que a ESPEC 008 §2
mapeou. A T-405 é o documento que a F5 vai usar para provar a diferença.

> **T-401 antes de tudo, inclusive antes de instalar dependência.** `pnpm install` toca o
> `pnpm-lock.yaml`, não o `src/` — mas a disciplina de tirar a captura primeiro custa cinco minutos
> e protege o único critério que não pode ser reconstruído depois.

**Tamanho:** M — meio dia. **Encerra:** P1.

---

### F1 — Cor e foco

**Objetivo:** tornar legível o que está na tela, e visível onde está o foco.

| # | Tarefa | Ref. |
|---|---|---|
| T-406 | `navy.300` → `#4E747E`, com os três contrastes em comentário, como a ESPEC 005 fez com `brand` | `R-ACE-01`, D-02 |
| T-407 | Texto do botão desabilitado → `navy-600` sobre `navy-100` — 2,60:1 vira 7,24:1 | `R-ACE-01` |
| T-408 | Regra `:focus-visible` global em `globals.css` — não existe nenhuma hoje | `R-ACE-04` |
| T-409 | `focus-within` nos dois cartões de upload, onde o `sr-only` esconde o foco nativo | `R-ACE-04` |
| T-410 | Link de pulo como primeiro filho do `<body>`; `id="conteudo"` no `<main>` | `R-ACE-08` |
| T-411 | **Nova linha de base** da captura — ver §6.3 | §9.2 |

**Verificação:** o script da T-403 fica **verde nos 8 usos**; o percurso da T-404 passa dos passos 1
a 3 e falha adiante, como esperado.

> **A T-411 é o que torna o portão P3 afiado.** A cor é uma das duas mudanças de pixel legítimas de
> toda a entrega. Isolá-la aqui e re-linhar a base faz com que, da F2 em diante, **qualquer**
> diferença de captura que não seja a legenda seja defeito. Sem esse corte, o P3 vira comparação
> subjetiva.

**Tamanho:** P — duas horas.

---

### F2 — Anúncio e foco de resultado `[portão]`

**Objetivo:** a tela passar a dizer que terminou.

| # | Tarefa | Ref. |
|---|---|---|
| T-412 | **[risco]** Invólucro `aria-live` **montado desde o primeiro render**, com o conteúdo condicional por dentro | `R-ACE-13`, **D-03** |
| T-413 | `role="alert"` em `erro` e `bloqueado` | `R-ACE-14` |
| T-414 | Foco vai para o `<h2>` do resultado ao término | `R-ACE-15` |
| T-415 | `<h2>` do bloqueio em `text-lg` — hoje o cabeçalho da situação mais grave é o menor da tela | `R-ACE-12` |
| T-416 | Teste: o invólucro existe no DOM **no estado inicial**, antes de qualquer envio | **D-03** |
| T-417 | **Escuta real** em NVDA ou Narrator, com o percurso completo | **P2** |

**Verificação:** a T-416 passa, e a T-417 confirma o anúncio **ouvido**.

> **T-412 é a tarefa de maior risco do plano inteiro.** A implementação intuitiva — envolver o
> conteúdo em `aria-live` por dentro do `return null` — produz marcação correta e comportamento
> nulo: leitores anunciam **mutação** de região presente, não inserção de região nova. O sintoma é
> ausência de som, e nada automatizado o detecta. A T-416 verifica a montagem, não o atributo; a
> T-417 verifica o efeito.

**Tamanho:** M — meio dia. **Encerra:** P2.

---

### F3 — Formulário

**Objetivo:** o envio operável por teclado, com o botão que não some sob o foco.

| # | Tarefa | Ref. |
|---|---|---|
| T-418 | `<form>` com `type="submit"`; **guarda única** no `onSubmit`, cobrindo clique e Enter | `R-ACE-07` |
| T-419 | `aria-disabled` e `aria-busy` no botão, no lugar de `disabled` | `R-ACE-06`, D-04 |
| T-420 | `aria-label` com o rótulo do campo; descrição e estado por `aria-describedby` | `R-ACE-11` |
| T-421 | Indicador de atividade e o texto de quanto pode demorar — **no formulário, não na barra** | `R-ACE-16` |
| T-422 | `border-dashed` → `border` sólida nos dois cartões | `R-ACE-17`, D-08 |
| T-423 | Testes: Enter envia; **um só arquivo não envia**; o foco permanece no botão durante o processamento | `R-ACE-06`, `07` |

**Verificação:** a T-423 passa nos três casos. A `R-CAB-05` da ESPEC 007 continua honrada — a barra
segue vazia até haver relatório.

> A guarda da T-418 não é detalhe. `aria-disabled` transfere a inibição do navegador para o código:
> **o botão volta a ser clicável de verdade.** O caso "um só arquivo escolhido" da T-423 é o que
> prova que a transferência foi feita.

**Tamanho:** M — meio dia.

---

### F4 — Grid

**Objetivo:** a tabela legível por software e alcançável por teclado. É a fase maior.

| # | Tarefa | Ref. |
|---|---|---|
| T-424 | `scope="col"` em todo `<th>`; `aria-labelledby` em toda `<table>` | `R-ACE-09` |
| T-425 | `<h3>`/`<h4>` no lugar das `<div>` das faixas navy — **mesmas classes, mesmo pixel** | `R-ACE-10`, D-06 |
| T-426 | Contêiner de rolagem focável, com nome acessível | `R-ACE-05` |
| T-427 | Legenda visível das duas marcas; **remoção dos dois `title`** | `R-ACE-03`, D-05 |
| T-428 | Portador textual do saldo negativo | `R-ACE-02` |
| T-429 | Bloco extracontratual **antes** das seções | D-07 |
| T-430 | Chave de seção por índice — `secao_titulo` colide entre grupos | — |
| T-431 | Testes de estrutura: `scope` em todos, `h3`+`h4` iguala grupos + seções, zero `title` em `src/` | `R-ACE-03`, `09`, `10` |

**Verificação:** a T-431 passa; o percurso da T-404 alcança as colunas **Quantidade Medida** e
**Saldo**, hoje inalcançáveis sem mouse.

> **A T-425 é a tarefa que mais parece arriscada e menos é.** Tailwind já normaliza o `font-size` de
> heading no *preflight*, então trocar o elemento mantendo as classes não move um pixel. A captura
> da T-438 é quem confirma — não a leitura do diff.

**Tamanho:** G — um dia.

---

### F5 — Higiene e verificação do conjunto `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-432 | `revokeObjectURL` do blob anterior antes de novo envio | `R-ACE-18` |
| T-433 | Nome do arquivo com contrato e competência | `R-ACE-19` |
| T-434 | Mensagens de erro em maiúscula | `R-ACE-20` |
| T-435 | A asserção do teste de fumaça — a única que quebra | §9.3 |
| T-436 | Varredura `axe` **verde** nos quatro estados | §9.2 |
| T-437 | **Percurso completo sem mouse**: escolher, enviar, ler o grid, baixar | **P3** |
| T-438 | **Diferença de captura** contra a T-411 — vazia fora da legenda | **P3** |
| T-439 | `next build` limpo, `tsc --noEmit` limpo, **308 testes de backend intactos** | regressão |

**Verificação:** os três critérios de P3, mais a T-439. A T-437 é executada com o mouse fisicamente
desconectado — ver §5.

**Tamanho:** M — meio dia. **Encerra:** P3.

---

### F6 — Documentação

| # | Tarefa | Ref. |
|---|---|---|
| T-440 | **ESPEC 002:** aplicar a revisão de `R-UI-04` e `R-UI-08` — depende de `K-02` | ESPEC 008 §13.1 |
| T-441 | **ESPEC 008:** status → implementada; §9.2 preenchida com os números **medidos**, no formato da ESPEC 005 §8 | — |
| T-442 | README e CHANGELOG — o incremento e a revisão da ESPEC 002 | — |
| T-443 | TASKS 008 com o resultado e os desvios | — |

> A T-440 não é burocracia. A `R-UI-04` **institui o `title`** como mecanismo ("explicação ao passar
> o cursor"). Corrigir o código sem revisar a regra deixaria espec e implementação em contradição
> declarada — o oposto do que a ESPEC 007 §13 estabeleceu como conduta.

**Tamanho:** P — duas horas.

---

## 4. Sequência

```
                              ┌─► F3 (formulário) ─┐
F0 ──► F1 ──► F2 ─────────────┤                    ├──► F5 ──► F6
   P1   (cor,  P2             └─► F4 (grid) ───────┘    P3
        base)  (ouvido)
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | 3 a 4 dias |
| 2 desenvolvedores | 2 a 3 dias — F3 e F4 em paralelo |

**F3 e F4 tocam arquivos disjuntos** — `UploadForm.tsx` contra `DivergenciaGrid.tsx` — e são a única
paralelização útil. O resto é linear por necessidade: F0 é porta de mão única, F1 fixa a base de
comparação de que F5 depende, e F2 abre o portão que valida o mecanismo mais frágil antes de o
trabalho crescer.

---

## 5. A verificação que nenhuma máquina faz

Este é o ponto em que o plano mais pode se enganar sozinho.

`axe-core` é excelente e insuficiente. Ele examina **marcação**, e três dos defeitos mais graves
desta entrega não estão na marcação:

| Defeito | `axe` pega? | Por quê |
|---|---|---|
| Contraste abaixo de AA | **Sim** | É cálculo sobre estilo computado |
| `th` sem `scope`, tabela sem nome | **Sim** | É estrutura estática |
| Rolagem não focável | **Sim** | Regra `scrollable-region-focusable` |
| **Região viva que não anuncia (D-03)** | **Não** | O atributo está lá e está correto. O que falha é o **momento da montagem** |
| **Foco perdido ao desabilitar o botão** | **Não** | Depende de um evento, não de um estado do DOM |
| **`title` inalcançável por teclado e toque** | **Não** | `title` é marcação válida. O defeito é de mecanismo |
| **Anel de foco com contraste ruim** | **Não** | Nenhuma ferramenta avalia contraste de `outline` contra fundo adjacente |

Daí a T-417 e a T-437 serem **tarefas, não conferências informais**, e daí P2 e P3 as exigirem.

**A T-437 é executada com o mouse desconectado.** Não "sem usar o mouse" — desconectado. A diferença
importa: com o dispositivo à mão, a pessoa contorna sem perceber o obstáculo que acabou de
encontrar, e o obstáculo continua na tela.

É a mesma lição da ESPEC 003 e do PLANO 004 §6, aplicada a outro sentido: **os testes garantem
conformidade sintática, não operabilidade.** Lá foi o Word; aqui é o fone e o teclado.

---

## 6. Três acertos à ESPEC 008

Três afirmações da espec não sobrevivem ao contato com o repositório. Registro em vez de contornar,
seguindo a conduta da ESPEC 007 §13.

### 6.1 "Nenhuma dependência nova" — precisa de qualificador

A §8 da espec afirma *"Nenhum arquivo novo. Nenhuma dependência nova."* e a §9.2 exige varredura
`axe-core`. **`@axe-core/playwright` não está no `package.json`** — verificado.

Não é contradição real, é imprecisão de redação. A distinção que a espec quis fazer:

> **Nenhuma dependência de produção.** O `bundle` entregue ao navegador não ganha um byte.
> `@axe-core/playwright` entra como `devDependency` do arnês de teste, ao lado do `@playwright/test`
> que já está lá.

Proposta de emenda à ESPEC 008 §8, a aplicar na T-441.

### 6.2 A varredura roda sobre o servidor de desenvolvimento

A §9.2 diz *"no build de produção"*, herdando o protocolo da ESPEC 005 §8 — que foi executado à mão,
em navegador. Mas `playwright.config.ts` sobe o alvo com `pnpm dev`, e a decisão está comentada no
próprio arquivo: `next start` não funciona com `output: standalone`.

Como fica, sem mudar o arnês:

| Verificação | Onde roda |
|---|---|
| `axe`, percurso de teclado, testes de estrutura | **`pnpm dev`**, pelo Playwright, automatizado |
| Contraste computado, captura, leitor de tela | **`next build`**, à mão, como as ESPECs 005 e 007 fizeram |

Para o que se mede, a diferença é nula: `axe` e o percurso de teclado não distinguem os dois modos.
Fazer o Playwright subir o *standalone* seria mudar infraestrutura de teste dentro de uma entrega de
acessibilidade — trabalho certo, momento errado.

### 6.3 "Cerca de um dia" contava só o código

A §12 da espec estima cerca de um dia. Este plano estima **3 a 4**.

A estimativa da espec está correta para as fases F1 a F4 somadas — as correções são pequenas e
localizadas. O que ela não contou:

| Fase | Custo | Por que existe |
|---|---|---|
| F0 | meio dia | O instrumento. É a resposta ao diagnóstico da própria §1 da espec |
| F5 | meio dia | A verificação manual de §5, que nenhuma ferramenta substitui |
| F6 | duas horas | A revisão da ESPEC 002, que a espec §13.1 exige |

**Não reduzi o plano para caber na estimativa.** Um plano ajustado ao número deixa de ser plano —
e o primeiro corte seria a F0, que é justamente o que impede esta entrega de virar mais uma rodada
de conformidade presumida.

---

## 7. O que pode dar errado, e o que pega

| O que pode dar errado | O que pega | Quando |
|---|---|---|
| **`aria-live` implementado por dentro do retorno condicional** — marcação correta, som nenhum | **Nada automático.** T-416 pega a montagem; **T-417 pega o efeito** | F2 |
| Editar `src/` antes da captura de referência | **Nada.** Porta de mão única — T-401 é a única defesa | F0 |
| `aria-disabled` sem a guarda no `onSubmit` — botão clicável sem os dois arquivos | T-423, caso "um só arquivo" | F3 |
| A troca `<div>` → `<h3>` mover pixel | Diferença de captura (T-438) | F5 |
| A legenda de D-05 empurrar o grid e passar por "mudança de layout" | É uma das **duas** exceções previstas em §9.2. Registrar na T-441 | F4 |
| O instrumento nascer verde sobre código quebrado | **P1** — é literalmente o critério do portão | F0 |
| `navy-300` mais escuro achatar a hierarquia com `navy-600` | Aceite visual de `K-03`; 10,47:1 contra 4,73:1 mantém a distância | F1 |
| Foco programático (T-414) desorientar quem enxerga | Alvo é **título**, não controle; nada é acionado. Confirmar em `K-03` | F2 |
| Teste-âncora do backend quebrar | T-439 — mas `backend/` **não é tocado**. Se quebrar, algo foi entendido errado | F5 |
| Captura variar por renderização de fonte entre máquinas | T-411 e T-438 na **mesma máquina**, mesmo navegador. Baseline **não** vai para o repositório — ver §9 | F5 |

As duas primeiras linhas não têm rede automática, e são as duas mais caras de descobrir tarde.

---

## 8. Insumos

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **K-01** | **Leitor de tela em máquina real** — NVDA, ou o Narrator que já vem no Windows 11 | T-417 | **P2 não fecha.** É a única verificação de que o anúncio existe |
| **K-02** | **Aceite da revisão de `R-UI-04` e `R-UI-08`** da ESPEC 002 | T-440 | O código corrige e a espec continua mandando o contrário. Não bloqueia F1–F5 |
| **K-03** | Aceite visual das **duas** mudanças de pixel: o cinza mais escuro e a legenda do grid | F1 e F4 | Risco de refazer a linha de base depois de a F5 já ter comparado contra ela |

`K-01` é o único insumo bloqueante, e é barato: o Narrator está instalado. `K-03` segue o mesmo
raciocínio do `K-02` do PLANO 004 — conferir cedo o que só o olho aprova evita descobrir na entrega
que a base de comparação estava errada.

---

## 9. O que este plano não faz

- **Não redesenha nada.** A ESPEC 008 §3 fez disso critério de aceite, e a T-438 é quem o cobra. As
  duas únicas mudanças de pixel — cor de texto e legenda — estão isoladas nas T-406 e T-427.
- **Não toca o backend.** Nenhum arquivo de `domain/`, `application/`, `infrastructure/` ou `api/`.
  Os 308 testes existem na T-439 como regressão, não como alvo.
- **Não implementa arrastar e soltar.** D-08 retirou a promessa (T-422); a função fica na §11 ponto 1
  da espec, com espec própria.
- **Não versiona baseline de captura.** Renderização de fonte varia entre máquinas e o repositório
  não tem CI (`.github` não existe). A comparação é **antes contra depois, na mesma máquina** — que
  é o que a pergunta "mudou o layout?" de fato exige. Se um dia houver CI, a §11 ponto 5 da espec
  volta à mesa junto com esta decisão.
- **Não persegue AAA**, nem tema escuro, nem cartões no celular, nem filtro no grid. ESPEC 008 §4.
- **Não decide o botão "Novo relatório"** da ESPEC 007 §10 ponto 4. A ESPEC 008 §11 ponto 6 mostra
  que ele pesa mais para quem usa teclado, mas é escopo novo — e escopo novo dentro de entrega de
  conformidade é como um defeito funcional entra numa entrega que não deveria ter nenhum.
