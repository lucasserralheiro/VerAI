# PLANO 015 — Implementação do Limpar para Recomeçar

| | |
|---|---|
| **Especificação** | [ESPEC 015](../specs/015-limpar-para-recomecar.md) v1.0 |
| **Versão** | 1.0 — 2026-08-11 |
| **Estado inicial** | Tela sem qualquer controle de recomeço · `page.tsx` libera os *blobs* **só** no envio, e o caminho `pronto → inicial` por `selecionar` **não passa por lá** (ESPEC 015 §2.2) · seis suítes de navegador (`smoke`, `analise`, `timeout`, `a11y-axe`, `a11y-contraste`, `a11y-teclado`, `a11y-estrutura`) · capturas de referência **não versionadas** (`test-results/a11y-baseline/`, fora do repositório) · ESPEC 008 `P2` — a escuta em leitor de tela — **em aberto desde 2026-08-07** |

---

## 1. O princípio que ordena este plano

A ESPEC 015 declarou o vazamento de §2.2 como verificação **humana**, no portão `P2`, com uma
justificativa herdada da ESPEC 008 §14: *"não há asserção de memória na suíte"*.

**A justificativa está certa e a conclusão não.** São coisas diferentes:

> Liberar um *blob* não é **medir memória**. É **revogar um identificador** — e identificador
> revogado é observável: depois de `revokeObjectURL`, um `fetch` sobre aquela `blob:` URL falha.

O `href` de *Baixar DOCX* **é** a URL do *blob* ([`ResultadoPanel.tsx:144`](../../frontend/src/app/components/ResultadoPanel.tsx#L144)).
Ela pode ser lida do DOM, guardada, e consultada depois da transição. Isso converte o defeito
mais sério desta entrega de "olhar no DevTools e acreditar" em portão automático — e, com isso,
o coloca sob o princípio que o PLANO 012 §1 estabeleceu e que aqui se aplica sem ressalva:

> **O teste que define a entrega tem de falhar primeiro — e falhar pelo motivo certo.**

Contra o código de hoje, esse teste **aprova** o vazamento: a URL antiga continua resolvendo.
Ele tem de nascer vermelho na F1, e ficar verde na F2 por causa da correção, não por causa de
uma mudança na forma de medir.

**E antes de tudo isso, a F0 captura o "antes".** Não é diligência genérica: é a regra que o
PLANO 012 §10.4 escreveu para o próximo plano, depois de a lacuna custar duas investigações
neste projeto. Aqui ela é mais dura que lá, por um motivo verificado no repositório —
`scripts/capturar-baseline.mjs` diz, na linha 8, que as capturas **não são versionadas**. A
referência de layout que a ESPEC 008 §3 exige **não existe até alguém gerá-la**, e depois da
primeira linha alterada ela é **irrecuperável**. Pular a F0 não adia a verificação: destrói o
instrumento dela.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P1 — O vazamento, vivo e morto** | F1 → F2 | O teste da T-902 **reprova** contra o código atual (a URL antiga ainda resolve) e **aprova** depois da F2 (as duas deixam de resolver), nos três caminhos que abandonam `pronto`: envio, troca de arquivo e limpeza | Se nascer verde, o instrumento não mede o que diz. Corrigir o instrumento antes de tocar em `page.tsx` |
| **P2 — O mesmo arquivo, reescolhido** | Fim da F5 | Limpar, reescolher **o mesmo arquivo** nos dois cartões, e a seleção reaparecer — em **Chromium e Firefox**. É o caso que a ESPEC 015 §2.3 se recusou a afirmar de memória | `R-LMP-04` não está cumprida. Sem ela o botão cria um beco: a tela diz vazio e o formulário não está |
| **P3 — A conformidade não regrediu** | Fim da F5 | `axe` limpo nos **cinco** estados (os quatro de hoje mais o diálogo aberto) nas duas larguras · contraste limpo nos cinco · percurso de teclado verde · captura com **exatamente** as diferenças previstas em §5.4 · as seis suítes verdes | Não entregar. A ESPEC 008 §13.4 fixou AA como régua permanente, e este é o primeiro controle novo depois disso |

**Mapeamento com a espec, para não haver confusão:** `P1` deste plano é o `P2` da ESPEC 015,
promovido de humano a automático (§6.1). `P2` deste plano é o `P1` da espec. `P3` não tem
correspondente na espec — é o protocolo da ESPEC 008 §9.2, que `R-LMP-13` manda aplicar.

---

## 3. Fases

### F0 — O "antes" `[irrecuperável]`

**Objetivo:** ter contra o que comparar. **Nenhum arquivo é tocado nesta fase.**

| # | Tarefa | Ref. |
|---|---|---|
| T-900 | Rodar as **seis** suítes de navegador e a de backend, e registrar o resultado. Se alguma já estiver vermelha, é defeito alheio e sai desta entrega — foi o que custou uma investigação no PLANO 012 §10.4 | §1 |
| T-901 | `node scripts/capturar-baseline.mjs referencia` — **10 capturas**, cinco estados em duas larguras. Sem isto a §5.4 é opinião | **P3** |

**Verificação:** existe uma pasta `test-results/a11y-baseline/referencia/` com 10 PNGs, e
existe um registro de quantos testes passavam antes.

> **A T-901 é a única tarefa deste plano que não pode ser feita depois.** As capturas não são
> versionadas (`capturar-baseline.mjs:8`), e a máquina que renderiza a fonte é esta. Uma
> referência tirada depois da F3 compara a entrega consigo mesma.

**Tamanho:** PP — quarenta minutos, quase toda de espera: `pronto` e `erro` geram relatório de
verdade, duas vezes cada, uma por largura.

---

### F1 — O instrumento do vazamento `[portão]`

**Objetivo:** poder afirmar que o *blob* foi liberado, antes de liberá-lo. **Nenhum arquivo de
`src/` é tocado.**

| # | Tarefa | Ref. |
|---|---|---|
| T-902 | Auxiliar de teste: lê o `href` de *Baixar DOCX* e de *Baixar análise*, e devolve se cada URL **ainda resolve**, por `page.evaluate` com `fetch` no contexto da página — `blob:` é escopado por origem e não resolve de fora | ESPEC 015 §2.2 |
| T-903 | **Provar que o instrumento discrimina**: em `pronto`, as duas URLs resolvem; após um `revokeObjectURL` disparado à mão por `page.evaluate`, nenhuma resolve. Sem este passo, um `fetch` que falha por outro motivo passaria por revogação | §1 |
| T-904 | **Rodar contra o código atual e exigir reprovação**: em `pronto`, trocar um arquivo por outro e afirmar que as URLs antigas **deixaram** de resolver. Hoje elas resolvem — o teste tem de ficar vermelho, e é o vazamento visto vivo | **P1** |

**Verificação:** T-903 passa (mede o instrumento), T-904 **reprova** (mede a aplicação). O resto
da suíte segue verde — nada de `src/` foi tocado.

> **A T-903 existe porque `fetch` falha por muitos motivos.** Um auxiliar que devolve "não
> resolve" para URL revogada, URL malformada, CSP e rede caída não distingue correção de erro de
> digitação. Ele precisa acertar os **dois** lados antes de valer como portão — é a lição da
> T-802 do PLANO 013, onde o comparador tinha de acusar 52 divergências e não "alguma".

**Tamanho:** P — duas horas.

---

### F2 — A âncora do descarte `[portão]` `[entregável sozinho]`

**Objetivo:** liberar os dois *blobs* em todo caminho que abandona `pronto`.

| # | Tarefa | Ref. |
|---|---|---|
| T-905 | `descartar(estado)` em [`page.tsx`](../../frontend/src/app/page.tsx) — função única, sem efeito quando o estado não é `pronto` | `R-LMP-11`, `D-05` |
| T-906 | `enviar()` passa a chamá-la, no lugar das duas linhas de `revokeObjectURL` que já tem | `R-LMP-11` |
| T-907 | **[risco]** `selecionar()` passa a chamá-la **antes** de trocar o estado. É o caminho de §2.2, e é o defeito que existe hoje | `R-LMP-11` |
| T-908 | O comentário de `page.tsx` que afirma *"Liberar no envio basta"* é reescrito. Ele documenta o raciocínio que produziu o defeito, e deixá-lo convida a reintroduzi-lo | `D-05` |
| T-909 | **T-904 fica verde**, e pelo motivo certo: comparar com o modo de falha registrado na F1 | **P1** |

**Verificação:** P1 fecha. Nenhum teste existente muda de cor — liberar uma URL que nada mais
referencia é invisível para a tela.

> **Esta fase corrige um defeito que existe hoje e não depende do botão.** A ESPEC 015 §11 já
> registrou que ela vale por si. Se a entrega for interrompida em qualquer ponto adiante, **esta
> parte deve ser mantida**, e é o motivo de ela vir tão cedo.

> **A T-907 é onde o vazamento mora, e ela tem uma ordem que importa.** Chamar `descartar` depois
> de `setEstado` liberaria com base num estado já substituído — em React o `estado` da closure
> ainda é o antigo, então funcionaria por acidente. Escrever na ordem certa é mais barato que
> explicar por que a errada funciona.

**Tamanho:** PP — uma hora. **Encerra:** P1.

---

### F3 — O botão e o diálogo

**Objetivo:** o controle existir, e nunca limpar sem confirmação.

| # | Tarefa | Ref. |
|---|---|---|
| T-910 | Botão **Limpar** em [`UploadForm.tsx`](../../frontend/src/app/components/UploadForm.tsx), ao lado do primário, em estilo secundário | `R-LMP-01`, `12`, `D-03` |
| T-911 | **[risco]** `type="button"` explícito. Dentro do `<form>` de `R-ACE-07` a omissão o torna `submit`, e clicar em *Limpar* geraria relatório | `R-LMP-03`, §2.4 |
| T-912 | Visibilidade: aparece com arquivo escolhido **ou** estado diferente de `inicial`; **some** durante `processando` | `R-LMP-02`, `D-02`, `D-09` |
| T-913 | `ConfirmarLimpeza.tsx` — `<dialog>` com `showModal()`, dois controles, sem dependência nova | `R-LMP-07`, `D-07` |
| T-914 | **[risco]** Os dois textos de `D-04`: com relatório gerado, a confirmação diz que ele será descartado e que não há recuperação; sem relatório, texto mais leve | `R-LMP-06` |
| T-915 | Só o controle de confirmação limpa. `Esc`, o botão de cancelar e qualquer outro fechamento **não limpam** — tratar `close` sem `returnValue` de confirmação como cancelamento | `R-LMP-05` |
| T-916 | A limpeza zera `arquivos`, leva o estado a `inicial`, chama `descartar()` e **remonta o formulário** por `key` | `R-LMP-01`, `04`, `D-08` |

**Verificação:** limpar funciona pela tela, e cancelar não faz nada. Foco e anúncio ainda **não**
estão feitos — é a F4, e é onde ficam os defeitos que não se veem.

> **T-910 e T-913 andam juntas e não devem ser separadas em dois commits.** Um botão que limpa
> sem diálogo é um controle destrutivo sem guarda, e é precisamente o estado que `R-LMP-05`
> proíbe. É o inverso da T-707/T-708 do PLANO 012: lá a separação protegia; aqui ela cria uma
> janela em que o pior caso da entrega está solto.

> **T-914 é onde o texto pode ficar pior que a ausência dele.** Um aviso que exagera no caso leve
> ensina a confirmar sem ler — e aí a pessoa confirma sem ler no caso grave, que é o único que
> importa. Nada automatizado julga isso; é o insumo `K-11`.

**Tamanho:** P — três horas.

---

### F4 — Foco e anúncio

**Objetivo:** a limpeza não desorientar quem opera por teclado ou por leitor de tela. **É a fase
com o defeito mais difícil de ver.**

| # | Tarefa | Ref. |
|---|---|---|
| T-917 | Ao abrir, o foco pousa no controle **de cancelar**, dentro do diálogo | `R-LMP-08` |
| T-918 | **[risco]** Cancelado, o foco volta ao botão *Limpar*; confirmado, vai para o primeiro `input[type=file]` — que naquele instante é um elemento **recém-montado** pela `key` da T-916, e não o de antes | `R-LMP-09`, `D-08` |
| T-919 | **[risco]** Mensagem de volta ao estado inicial, em região própria. O invólucro de `R-ACE-13` **esvazia** nesta transição, e região viva que esvazia é silêncio | `R-LMP-10`, `D-06` |
| T-920 | Conferir que o botão *Limpar*, ao desaparecer com o foco dentro, não deixa o foco cair no `<body>` — é o modo de falha do `D-04` da ESPEC 008, com outro controle | `R-LMP-09`, `R-ACE-06` |

**Verificação:** os quatro casos de foco verificados por teste; o anúncio, por teste de presença
— e por escuta, que é `K-10`.

> **A T-918 é a armadilha de ordem desta entrega.** Remontar por `key` destrói o elemento e cria
> outro. Um `ref` capturado antes da limpeza aponta para um nó fora do documento, e `focus()`
> nele **não lança erro** — simplesmente não faz nada, e o foco cai no `<body>`. O sintoma é
> idêntico ao de não ter escrito a linha, e nenhum teste que verifique "a linha existe" o
> distingue. O que distingue é afirmar `document.activeElement` **depois** da limpeza.

**Tamanho:** P — duas horas.

---

### F5 — Verificação `[portão]`

**Objetivo:** provar que nada regrediu, e fechar os dois portões que sobram.

| # | Tarefa | Ref. |
|---|---|---|
| T-921 | `e2e/limpar.spec.ts` com os casos da ESPEC 015 §8.1, incluindo o de `R-LMP-03` — clicar *Limpar* **não** produz requisição a `/reports` | ESPEC 015 §8.1 |
| T-922 | **[risco]** Estado novo em `e2e/estados.ts` **e** em `scripts/capturar-baseline.mjs`: diálogo aberto. São duas implementações separadas de propósito (`estados.ts:7-9`) e divergir faz varredura e captura falarem de estados diferentes | `R-LMP-13` |
| T-923 | `axe` e contraste limpos nos **cinco** estados, nas duas larguras | **P3** |
| T-924 | **[risco]** Reforçar o passo 4 de `a11y-teclado.spec.ts`: ele afirma hoje só `toBe("button")`, sem nome. Com dois botões na tela, "algum botão" deixou de ser afirmação — passaria com o botão errado | §5.3 |
| T-925 | `node scripts/capturar-baseline.mjs depois` e `comparar-baseline.mjs referencia depois`. O resultado tem de bater **exatamente** com a previsão da §5.4 | **P3** |
| T-926 | **P2** — em Chromium e Firefox: limpar, reescolher o mesmo arquivo nos dois cartões, e a seleção reaparecer | **P2**, `K-10` |
| T-927 | As seis suítes verdes; `tsc --noEmit`, `next lint` e `next build` limpos; backend **não tocado**, contagem de testes idêntica | **P3** |

**Verificação:** P2 e P3.

> **A T-925 é a que pode "passar" errado.** O comparador relata diferença; quem julga se ela é a
> prevista é uma pessoa. Diferença em `inicial` ou em `processando` **reprova** — são os dois
> estados que `R-LMP-02` e `D-02` garantem idênticos, e são a asserção mais barata deste plano.
> Diferença de **altura** em `pronto` a 390 px é o caso limítrofe: ver §5.4.

**Tamanho:** M — meio dia, a maior parte em espera de gerações reais.

---

### F6 — Documentação

| # | Tarefa |
|---|---|
| T-928 | **ESPEC 015:** status → implementada; `P2` da espec registrado como **automatizado** (§6.1); §8.3 corrigida |
| T-929 | **ESPEC 008:** emenda em `R-ACE-18` — a âncora da liberação, com o defeito de §2.2 nomeado. É a espec onde a regra mora, e é a conduta da ESPEC 007 §13 |
| T-930 | **ESPEC 007:** §10 ponto 4 e §347 ponto 3 marcados como decididos, apontando para a ESPEC 015 |
| T-931 | CHANGELOG e README: o botão, e o vazamento corrigido |
| T-932 | TASKS 015 com resultado e desvios |

**Tamanho:** P — duas horas.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3 ──► F4 ──► F5 ──► F6
 │     (falha)  P1                   P2 P3
 │
 └─ irrecuperável se pulada
```

Linear, e sem paralelização útil: são quatro arquivos de frontend, três deles tocados por mais
de uma fase. Duas pessoas disputariam `page.tsx`.

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | 1 a 1,5 dia |

**F2 é o único corte de entrega possível.** Ela fecha um defeito real, não depende de nada
adiante e não muda um pixel — se a prioridade mudar no meio, para-se ali com o repositório em
estado melhor que o inicial.

A estimativa é maior que o "meio dia" da ESPEC 015 §11 por uma razão só, e ela está em §6.2.

---

## 5. A regressão que já está escrita

Lida no repositório, não presumida.

### 5.1 O que **não** quebra, e é bom saber por quê

| Asserção existente | Sobrevive? | Por quê |
|---|---|---|
| `smoke.spec.ts` — `getByRole("button", { name: "Gerar relatório" })` | **Sim** | Nome exato. *Limpar* não colide |
| `estados.ts` e `timeout.spec.ts` — `{ name: /Gerar relat/ }` | **Sim** | A regex não casa *Limpar* |
| `capturar-baseline.mjs` — mesma regex, quatro vezes | **Sim** | Idem |
| `a11y-teclado` passos 1–3 | **Sim** | Link de pulo e os dois cartões, sem arquivo escolhido |
| `a11y-teclado` passo 4 | **Sim, e por sorte** | Ver §5.3 |
| `a11y-teclado` passo 5 | **Sim** | `escolherArquivos` faz *Limpar* aparecer, mas o foco é posto por `.focus()` explícito no primário, e durante `processando` o novo botão some (`D-02`) |
| `a11y-teclado` passos 6–8 | **Sim** | O botão novo mora no `<form>`, **antes** do painel de resultado. Nada entra entre o `<h2>` e *Baixar DOCX*, que é o intervalo que o passo 7 percorre |
| `a11y-contraste` nos quatro estados | **Sim, e passa a cobrir o botão novo de graça** | Ele varre `document.body.querySelectorAll("*")` e mede todo nó de texto visível. O rótulo *Limpar* entra na conta em `pronto`, `erro` e `bloqueado` sem uma linha de teste nova — desde que o estilo secundário passe 4,5:1 |
| `analise.spec.ts` e `a11y-estrutura.spec.ts` | **Sim** | Painel de análise e estrutura de cabeçalhos; nenhum é tocado |
| Suíte de backend | **Sim** | Nenhum arquivo de `backend/` entra em tarefa nenhuma |

**Nenhuma suíte quebra.** É um ponto de partida raro neste projeto, e ele tem um custo: significa
que **tudo o que esta entrega pode quebrar, ela quebra em silêncio**. Daí a §5.4 e o P3.

### 5.2 O diálogo fechado não polui as varreduras — verificado

`<dialog>` sem `open` computa `display: none`. Isso importa em dois lugares:

- `a11y-contraste` pula o que é invisível pela função `invisivel()`, que testa `display` e a
  caixa de 1 px. O texto do diálogo fechado **não** entra na medição dos outros estados.
- `axe` não reprova conteúdo não renderizado.

Consequência: o diálogo **só é verificado se alguém montar o estado com ele aberto**. É a T-922,
e é por isso que ela é a tarefa de risco da F5 — um modal fora do inventário é a forma mais comum
de conformidade presumida.

### 5.3 O passo 4 do teclado passa por sorte, e a sorte deve ser removida

```ts
await test.step("4 — o botão é alcançável mesmo indisponível", async () => {
    await page.keyboard.press("Tab");
    const el = await ativo(page);
    expect(el?.tag, "o botão desabilitado é pulado pela tabulação").toBe("button");
});
```

A asserção é sobre a **etiqueta**, não sobre o nome. Ela sobrevive porque naquele ponto do
percurso nenhum arquivo foi escolhido e `R-LMP-02` mantém *Limpar* fora da tela — mas
sobreviveria igual se *Limpar* estivesse lá, e o percurso da ESPEC 008 §6 estaria medindo outro
controle.

É o padrão do PLANO 013 §1: **o teste que guardava o desenho antigo guarda uma intenção que
continua valendo**, e a reescrita tem de sair mais forte. A T-924 acrescenta o nome. Custa uma
linha e é a diferença entre afirmar o percurso e afirmar que há um botão em algum lugar.

### 5.4 A previsão de captura — e o que reprova

Dez capturas, cinco estados em duas larguras. A previsão, derivada das regras:

| Estado | 1366 px | 390 px | Por quê |
|---|---|---|---|
| `inicial` | **idêntico** | **idêntico** | Sem arquivo escolhido não há botão — `R-LMP-02` |
| `processando` | **idêntico** | **idêntico** | O botão some durante a geração — `D-02` |
| `pronto` | botão novo | botão novo, **ver abaixo** | Arquivos escolhidos e relatório na tela |
| `erro` | botão novo | botão novo | Arquivos escolhidos |
| `bloqueado` | botão novo | botão novo | Arquivos escolhidos |

**Quatro capturas idênticas e seis com a diferença sancionada.** Qualquer coisa fora disso
reprova o P3 — em especial diferença em `inicial` ou `processando`, que são a prova de que
`R-LMP-02` e `D-02` foram implementadas e não apenas escritas.

**O caso limítrofe é a altura a 390 px.** *Gerar relatório* mede ~150 px e *Limpar* somará ~90 px
com o `gap`; a 390 px o `<main>` tem 342 px úteis descontado o `px-6`. Os dois cabem na mesma
linha **por pouco**, e um rótulo mais longo ou um `gap` maior os faria quebrar — o comparador
relataria `reflui`, que é o vocabulário dele para mudança de altura.

Se acontecer, há duas saídas e a escolha é do momento: encolher o secundário, ou **declarar a
quebra como quinta exceção de aparência**, na linha do que a TASKS 008 §1.1 fez com as quatro
primeiras. O que não se faz é registrar `reflui` e seguir — a ESPEC 008 §14.4 mostra o que passa
por essa porta: uma regressão de rolagem horizontal no celular que nenhuma varredura pegou e que
só a largura da imagem denunciou.

### 5.5 O que **nada** pega

| # | O que | Por quê |
|---|---|---|
| 1 | **O texto da confirmação estar mal calibrado** | Nenhum teste julga se um aviso é lido. `K-11` |
| 2 | **A escuta do anúncio de limpeza** | Mesmo impedimento do `P2` da ESPEC 008, aberto desde 2026-08-07. `K-10` |
| 3 | **A hierarquia visual do secundário** (`R-LMP-12`) | Contraste é medido, proeminência não. Um *Limpar* tão chamativo quanto *Gerar relatório* passa em tudo |

O item 2 não é novo e não é desta entrega — é a mesma dívida. Mas é a segunda espec seguida a
depender dele, e isso é registro, não desculpa.

---

## 6. Dois acertos à ESPEC 015

Seguindo a conduta da ESPEC 007 §13.

### 6.1 O `P2` da espec é automatizável, e por isso muda de natureza

A espec afirmou:

> *"Não há asserção automatizada para isto — a ESPEC 008 §14 já registrou por quê —, então é
> verificação humana ou não é verificação."*

**O raciocínio herdou uma premissa que não se aplica.** A ESPEC 008 falava de *memória retida*,
que de fato a suíte não vê. Aqui a pergunta é outra e é discreta: *aquele identificador ainda
resolve?* Depois de `revokeObjectURL`, não resolve — e o `href` do link de download **é** o
identificador, exposto no DOM.

Consequência prática, e é a maior mudança deste plano em relação à espec: o vazamento sai do fim
da entrega, onde seria conferido por inspeção e por boa vontade, e vai para o **começo**, como o
teste que tem de falhar primeiro (F1) e como o primeiro portão a fechar (F2).

Emenda a aplicar na T-928. O portão humano continua existindo como **conferência**, não como
única prova.

### 6.2 O esforço da espec não contava a verificação

A ESPEC 015 §11 estimou **meio dia**, somando seis fases de PP e P. A conta está certa para o
código: quatro arquivos, um deles novo, nenhuma dependência.

O que ela não somou foi a F0 e a F5. Capturar dez referências exige gerar relatórios de verdade
— `pronto` e `erro` sozinhos são quatro gerações de ~25 s cada, mais a subida do ambiente —, e a
F5 as gera de novo. **A verificação desta entrega custa mais que a implementação dela**, o que
não é anomalia: foi exatamente o que a ESPEC 008 §12 registrou, com a fase F respondendo por boa
parte de um dia.

Daí 1 a 1,5 dia em §4. Não é discordância da espec: é a parte da conta que ela não fez.

---

## 7. O que pode dar errado, e o que pega

| O que pode dar errado | O que pega | Quando |
|---|---|---|
| **Pular a captura de referência** e perder o "antes" para sempre | Nada, e é irreversível. Só a disciplina da T-901 — §1 | F0 |
| O instrumento do vazamento nascer verde e não provar nada | **T-904**, que exige a reprovação contra o código atual | F1 |
| O instrumento reprovar por motivo errado (CSP, rede, URL malformada) | **T-903**, que exige acerto nos dois lados | F1 |
| `descartar()` chamado **depois** de `setEstado` em `selecionar` | Funcionaria por acidente, pela closure. T-907 e a revisão | F2 |
| **`type` omitido no botão** — *Limpar* gera relatório | T-921 afirma que nenhuma requisição sai. É o defeito de uma palavra que revisão não pega | F3, F5 |
| Botão presente durante `processando`, lido como cancelar | T-912, e a captura de `processando` que tem de sair **idêntica** — §5.4 | F3, F5 |
| `Esc` ou o botão de fechar limparem sem confirmação | T-915, com caso próprio para `Esc`: é outro caminho no `<dialog>` | F3 |
| **Foco perdido no `<body>`** ao confirmar, por `ref` para nó destruído pela remontagem | T-918 e T-920, afirmando `document.activeElement` **depois** da limpeza. Uma verificação de "a linha existe" não distingue | F4 |
| **A limpeza não anunciar nada** — região viva esvaziando | T-919 verifica a presença da mensagem. Que ela seja **ouvida**, só `K-10` | F4 |
| O diálogo ficar fora das varreduras | T-922. E se `estados.ts` e `capturar-baseline.mjs` divergirem, varredura e captura passam a falar de estados diferentes — o script avisa disso na linha 7 | F5 |
| **Reflui a 390 px** por dois botões que não cabem | O comparador relata altura diferente. A decisão é humana e tem duas saídas legítimas — §5.4 | F5 |
| O mesmo arquivo reescolhido não voltar | **P2** / T-926, em dois motores. É o beco que `R-LMP-04` existe para evitar | F5 |
| O texto da confirmação exagerar e treinar o clique automático | **Nada automático** — `K-11` | F3 |
| *Limpar* competir visualmente com *Gerar relatório* | **Nada automático.** Contraste é medido, proeminência não — §5.5 | F3 |

As três linhas de "nada automático" são humanas e baratas: são um texto para ler e uma tela para
olhar. O caro é lembrar de fazê-las.

---

## 8. Insumos

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **K-10** | **Leitor de tela** (NVDA ou Narrator) para ouvir o anúncio de `R-LMP-10` | T-919 | O anúncio fica **verificado por presença, não por escuta** — o mesmo estado honesto em que a ESPEC 008 §14.5 deixou o `P2` dela. Não bloqueia a entrega; bloqueia declará-la ouvida |
| **K-11** | **Aceite dos dois textos** de confirmação (`D-04`) | T-914 | O código segue com os textos propostos, marcados para revisão. Texto de tela é decisão de produto, como a `K-06` do PLANO 012 |
| **K-12** | **Firefox instalado** para o `P2` | T-926 | `P2` fecha só em Chromium, e a §2.3 da espec continua sem resposta para o outro motor. `npx playwright install firefox` resolve |

`K-10` é o mesmo impedimento do `P2` da ESPEC 008. Não custa dinheiro nem licença: custa alguém
abrir o NVDA uma vez.

> **Correção de 2026-08-12.** Esta passagem afirmava que o `K-10` era *"o mesmo `K-01` da
> ESPEC 009"* e *"terceira espec seguida"*. **É falso**: o `K-01` da ESPEC 009 é *"arquivo aberto no
> Excel"*. São duas famílias de dívida que compartilham o **padrão** e não o **insumo** — e o quadro
> real é pior: **quatro portões abertos em quatro especs**. Ver
> [ESPEC 016](../specs/016-verificacao-por-tecnologia-assistiva.md) §2.1.

---

## 9. O que este plano não faz

- **Não cancela a geração em curso.** ESPEC 015 `D-02`, apoiado na ESPEC 012 §10: `run_sync` não
  é cancelável e a réplica fica ocupada até o fim. Esconder o botão é a única leitura honesta.
- **Não toca o backend.** Nenhum arquivo de `backend/`. A contagem de testes de lá é a mesma
  antes e depois, e é a T-927 quem confere.
- **Não toca a barra nem o painel de resultado.** `R-CAB-05` preservada — a ESPEC 008 §13.3 já
  avisou que uma espec nova seria o pretexto fácil para furá-la.
- **Não toca `lib/types.ts` nem `lib/api.ts`.** `inicial` já existe em `Estado`; limpar é uma
  transição para um estado que a tela já sabe renderizar.
- **Não introduz dependência.** `<dialog>` é do navegador, e `D-07` recusou `window.confirm()`
  por quatro motivos, sendo o decisivo que ele fica fora do DOM e, portanto, fora do `axe` e da
  captura.
- **Não limpa um cartão de cada vez.** `I-14`, fora do escopo por §4.2 da espec.
- **Não implementa desfazer.** Não há onde guardar o relatório descartado — a aplicação é sem
  estado (ESPEC 001 §7.2). A defesa contra o engano é a confirmação.
- **Não resolve o `I-16`** — se o relatório deveria sobreviver à troca de um arquivo. É
  comportamento anterior a esta espec, e mudá-lo aqui misturaria duas decisões.
- **Não fecha o `P2` da ESPEC 008.** A escuta continua devendo, agora com uma regra a mais
  dependendo dela.