# TASKS 015 — Backlog do Limpar para Recomeçar

| | |
|---|---|
| **Especificação** | [ESPEC 015](../specs/015-limpar-para-recomecar.md) v1.0 |
| **Plano** | [PLANO 015](../plans/015-plano-limpar-para-recomecar.md) v1.0 |
| **Versão** | 1.0 — 2026-08-11 |
| **Total** | 35 tarefas · 3 insumos |
| **Status** | **Concluído** — 2026-08-12. **P1, P2 e P3 fechados.** 66 testes de navegador verdes (20,5 min) · 379 de backend intocados. `K-10` e `K-11` em aberto, nenhum bloqueia |

> Escrito **antes** da implementação, como o TASKS 003, o TASKS 004, o TASKS 008, o TASKS 009, o
> TASKS 012 e o TASKS 013.

---

## 1. Convenções

**Identificadores** `T-9nn` seguem a numeração do PLANO 015, que começa em T-900 porque o
PLANO 013 fechou em T-823. A **T-933 e a T-934 nascem neste backlog** e estão registradas como
emendas em §2.2.

**Definição de pronto — frontend:** código e teste de navegador na mesma entrega; `tsc --noEmit`,
`next lint` e `next build` limpos; comentário explicando o *porquê* onde a escolha não for óbvia
— é a convenção observada em `page.tsx`, `api.ts` e `UploadForm.tsx`, onde praticamente todo
bloco não trivial carrega a razão dele.

**Convenção de commit** `<tipo>(T-9nn): descrição`.

### 1.1 Cinco regras que atravessam o backlog

**1 — O backend não é tocado. Em nenhuma tarefa.** Toda a pasta fica somente leitura:

```
backend/
```

Não é cautela genérica: é o que torna a T-927 uma asserção barata — a contagem de testes de
backend é idêntica antes e depois, e qualquer divergência é sintoma, não ajuste. Se uma tarefa
parecer exigir mudança lá, **pare**.

**2 — `lib/types.ts` e `lib/api.ts` também não são tocados.** `Estado` já tem `inicial`
(`types.ts:81`), e limpar é uma **transição para um estado que a tela já sabe renderizar**. Criar
um estado `limpo`, ou um sinalizador de "acabou de limpar", seria inventar vocabulário para
descrever o que `inicial` já descreve — e todo componente que hoje trata `inicial` passaria a ter
dois casos onde tem um.

**3 — Nenhum foco termina no `<body>`.** Todo controle que **desaparece** nesta entrega
desaparece com destino declarado: o botão *Limpar* some ao confirmar (T-920), os campos de
arquivo são destruídos e recriados pela remontagem (T-918), e o diálogo fecha nos dois caminhos
(T-917). É o modo de falha do `D-04` da ESPEC 008, e ele não lança erro — `focus()` num nó fora
do documento simplesmente não faz nada.

**4 — Região viva nunca nasce junto com o conteúdo.** É o `D-03` da ESPEC 008, e esta entrega
traz uma armadilha **nova** para ele, criada pela própria `D-08` — ver §2.2. Toda região que
anuncia é montada desde o primeiro render e **fora** de qualquer subárvore remontada.

**5 — Toda diferença de captura tem de estar prevista em §2.3.** Quatro das dez capturas têm de
sair **idênticas**, e são elas que provam `R-LMP-02` e `D-02` implementadas em vez de escritas.
Diferença fora da régua não se registra e segue: para a entrega.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Situação |
|---|---|---|---|
| **E0** O "antes" | T-900 · T-901 · T-933 | — | ⬜ |
| **E1** O instrumento do vazamento | T-902 … T-904 | **P1** | ⬜ |
| **E2** A âncora do descarte | T-905 … T-909 | **P1** | ⬜ |
| **E3** O botão e o diálogo | T-910 … T-916 | — | ⬜ |
| **E4** Foco e anúncio | T-917 … T-920 | — | ⬜ |
| **E5** Verificação | T-921 … T-927 · T-934 | **P2** · **P3** | ⬜ |
| **E6** Documentação | T-928 … T-932 | — | ⬜ |

**Ordem de execução:** E0 → E1 → E2 → E3 → E4 → E5 → E6. Linear, sem paralelização útil — são
quatro arquivos de frontend e três deles são tocados por mais de um épico (PLANO 015 §4).

### Os três portões

| Portão | Critério | Resultado |
|---|---|---|
| **P1 — o vazamento, vivo e morto** | T-904 reprova contra o código atual; T-909 aprova depois da E2 | ✅ Reprovou com `[true, true]`, passou com `[false, false]`. A T-903 provou que o instrumento não é cego |
| **P2 — o mesmo arquivo, reescolhido** | Limpar, reescolher o mesmo arquivo, e a seleção reaparecer — Chromium **e** Firefox | ✅ **Os dois motores.** `input.value` zera, os mesmos dois arquivos voltam, o botão reaparece e *Gerar* reabilita |
| **P3 — a conformidade não regrediu** | `axe` e contraste limpos nos **cinco** estados × duas larguras · percurso de teclado verde · captura conforme §2.3 · suítes verdes | ✅ **66 de 66 verdes** (20,5 min). Captura com a ressalva de §12.4 |

### Resultado

| O que | Antes | Depois |
|---|---|---|
| Formas de voltar ao estado inicial | **recarregar a página** | botão, com confirmação |
| *Blobs* retidos por troca de arquivo em `pronto` | **~3,8 MB, pela sessão** | **0** |
| Caminhos que abandonam `pronto` sem liberar | **1 de 3** (`selecionar`) | **0** |
| Estados varridos por `axe` e contraste | 4 | **5** — o diálogo não era medido em lugar nenhum |
| Testes de navegador | 45 | **66** |
| Arquivos de suíte | 7 | **9** |
| Testes de backend | 379 | **379, não tocados** |
| Camadas tocadas | — | **`frontend/src/app/`**. Backend, `lib/types.ts`, `lib/api.ts` e API **não** |
| Dependências novas | — | **nenhuma** (`<dialog>` é do navegador) |

Quatro arquivos de produção mudaram, um deles novo: `page.tsx`, `UploadForm.tsx`,
`globals.css` e `ConfirmarLimpeza.tsx`.

### Desvios

| Tarefa | O que mudou | Por quê |
|---|---|---|
| **T-900** | **Não executada como escrita** — a suíte de navegador não foi rodada antes de tocar em `src/` | Custou duas investigações, ambas com sintoma indistinguível de defeito da entrega. Ver §12.2 |
| **T-913 / T-919** | O diálogo e a região de status foram para `page.tsx`, não para o `UploadForm` | §2.2 desvio 1 — a `key` da `D-08` os destruiria no instante em que o foco é movido |
| **T-916** | A `key` foi para os **campos**, não para o formulário | Mesma razão |
| **T-914** | A redação evita a sequência *"relatório gerado"* | Fazia `getByText` resolver dois elementos e derrubava sete suítes. §12.5 item 1 |
| **T-921** | `expect.poll` + sinal de conclusão em **três** pontos | A `R-LMP-04` passou isolada e falhou em conjunto. §12.5 item 3 |
| **T-925** | Exigiu um terceiro conjunto de capturas (`controle`) | A régua acusou diferença não prevista; só a atribuição separou deriva de ambiente da mudança. §12.3 |

### 2.1 Pontos de não retorno

**Um, e não é de código.**

A **T-901 é irrecuperável se pulada**. `capturar-baseline.mjs:8` registra que as capturas **não
são versionadas** — renderização de fonte varia entre máquinas e o repositório não tem CI. A
referência de layout que a ESPEC 008 §3 exige não existe até alguém gerá-la, e depois da primeira
linha alterada ela não pode mais ser gerada: o que se capturaria seria a entrega comparada
consigo mesma.

Fora isso, a entrega é `git revert` do épico: quatro arquivos de frontend, um deles novo, nada
persistido, nenhuma migração, nenhum artefato em disco.

### 2.2 Três desvios já conhecidos, antes de começar

Registrados agora, não contornados — conduta da ESPEC 007 §13.

**1 — A `D-08` remonta demais, e remontar demais quebra a `R-LMP-10`.**

Este é o desvio que importa, e ele é uma **interação entre duas regras da própria espec**.

`D-08` decide remontar o formulário por `key` para zerar os `input[type=file]`. `R-LMP-10` exige
que a volta ao estado inicial seja **anunciada**. As duas juntas produzem o defeito exato que o
`D-03` da ESPEC 008 documentou:

> Leitores de tela anunciam a **mutação** de uma região viva já presente na árvore. Uma região que
> entra na árvore junto com seu conteúdo é **inserção**, e o anúncio não dispara.

Se a mensagem de limpeza for renderizada **dentro** do subárvore remontada, ela nasce junto com a
região que a contém, a cada limpeza. Marcação correta, comportamento nulo, **nenhum teste visual
acusa** — é a mesma armadilha, alcançada por um caminho novo.

Consequência para o backlog, e ela é estrutural:

| O quê | Onde mora | Por quê |
|---|---|---|
| A `key` que remonta | **só nos dois campos de arquivo** | É o menor escopo que zera `input.value` |
| A região que anuncia | **`page.tsx`**, montada desde o primeiro render, fora da `key` | `R-LMP-10`, `D-03` da ESPEC 008 |
| O `<dialog>` | **`page.tsx`**, fora da `key` | Remontá-lo no instante em que ele fecha é pedir para o foco se perder |

**A `D-08` fala em "remontar o formulário", e o formulário é o escopo errado.** Remontá-lo
inteiro destruiria também o botão *Limpar*, o botão primário e — se ele morasse ali — o diálogo,
no exato instante em que o foco está sendo movido. A `key` vai nos campos: `key={`${chave}-${campo.nome}`}`
no lugar do `key={campo.nome}` que `UploadForm.tsx:73` já tem.

Emenda a aplicar na T-928.

**2 — Falta uma tarefa no PLANO 015: subir o ambiente antes de capturar.**

A T-901 manda rodar `node scripts/capturar-baseline.mjs referencia`, e o script diz na linha 14:
*"Exige o backend em 127.0.0.1:8000 e o frontend em localhost:3000."* **O plano não diz quem os
sobe**, e a T-901 é a tarefa irrecuperável de §2.1 — falhar por ambiente ausente é o pior momento
possível para descobrir isso.

A **T-933** fecha a lacuna, imediatamente antes da T-901. É a mesma espécie de omissão que a
T-823 do TASKS 013 corrigiu: o plano manda usar um artefato e não diz de onde ele vem.

**3 — A `R-LMP-12` ficou sem quem a cobre.**

O PLANO 015 §5.5 lista três coisas que nada automático pega, e atribui insumo a duas: o texto da
confirmação (`K-11`) e a escuta (`K-10`). A terceira — *Limpar* competir visualmente com *Gerar
relatório* — **não tem tarefa nem insumo**. Contraste é medido pela `a11y-contraste`; proeminência
não é medida por nada.

A **T-934** a recolhe junto com a leitura do texto, num olhar só. Uma pessoa, uma tela, dois
minutos — e é o único lugar do backlog onde `R-LMP-12` existe.

### 2.3 A régua da E3 — o que pode mudar na tela

Toda diferença entre a tela de antes e a de depois tem de ser atribuível a esta lista:

| Onde | Delta esperado |
|---|---|
| Formulário, **com** arquivo escolhido ou estado ≠ `inicial` | O botão *Limpar*, ao lado do primário |
| Formulário, **sem** arquivo escolhido | **Nenhum** — `R-LMP-02` |
| Formulário, durante `processando` | **Nenhum** — `D-02` |
| Barra, rodapé, painel de resultado, grid, painel de análise | **Nenhum** |
| DOM, em todos os estados | Um `<dialog>` fechado (`display: none`) e uma região de status vazia |
| Ordem de tabulação | **+1 depois do primário**, e só quando há o que limpar |
| Resposta da API, `.docx`, `.xlsx` | **Nenhum** |

**Se aparecer uma oitava diferença, pare.** As três linhas de "nenhum" são as que sustentam a
previsão de captura da §5.4 do plano — quatro imagens idênticas de dez.

---

## 3. Épico E0 — O "antes"

> **Nenhum arquivo é tocado neste épico.** E a T-901 não pode ser feita depois — §2.1.

#### T-933 — Subir backend e frontend `[nasce neste backlog]`
**Tamanho:** PP · **Ref:** §2.2 · **Imediatamente antes da T-900**

Backend em `127.0.0.1:8000` e frontend em `localhost:3000`, e conferir que uma geração real
completa pela tela.

O plano não previu esta tarefa e ela trava as duas seguintes: a suíte de navegador precisa dos
dois, e a captura precisa deles **mais** as fixtures do piloto. Uma geração conferida à mão antes
de começar também dá o número de referência do tempo, que a T-901 vai pagar dez vezes.

**Pronto quando:** os dois no ar, e uma geração completa observada.

---

#### T-900 — A suíte de hoje, registrada
**Tamanho:** P · **Ref:** PLANO 015 §1

Rodar as **sete** suítes de navegador (`smoke`, `analise`, `timeout`, `a11y-axe`,
`a11y-contraste`, `a11y-teclado`, `a11y-estrutura`) e a de backend. Registrar aqui quantos testes
passam.

**Se alguma já estiver vermelha, ela sai desta entrega** e é investigada à parte. É a regra que o
PLANO 012 §10.4 escreveu depois de a lacuna custar duas investigações neste projeto: sem o
"antes", a única forma de saber de quem era a falha foi `git stash` e uma segunda execução.

**Pronto quando:** o número está escrito aqui, e não na memória de quem rodou.

---

#### T-901 — Dez capturas de referência `[irrecuperável]`
**Tamanho:** P · **Ref:** **Portão P3**

`node scripts/capturar-baseline.mjs referencia` — cinco estados em duas larguras.

Custa quase tudo em espera: `pronto` e `erro` geram relatório de verdade, uma vez por largura,
~25 s cada.

**É a única tarefa deste backlog que não pode ser feita depois.** As capturas não são versionadas
(`capturar-baseline.mjs:8`) e a máquina que renderiza a fonte é esta.

**Pronto quando:** existem 10 PNGs em `test-results/a11y-baseline/referencia/`.

---

## 4. Épico E1 — O instrumento do vazamento `[portão P1]`

> **Nenhum arquivo de `src/` é tocado neste épico.** O instrumento nasce antes do alvo — é a
> forma da E0 do TASKS 013, e pelo mesmo motivo.

#### T-902 — Ler e consultar a URL do *blob*
**Tamanho:** P · **Ref:** ESPEC 015 §2.2

Auxiliar de teste que lê o `href` de *Baixar DOCX* e de *Baixar análise*
([`ResultadoPanel.tsx:144`](../../frontend/src/app/components/ResultadoPanel.tsx#L144) e
[`:154`](../../frontend/src/app/components/ResultadoPanel.tsx#L154)) e devolve se cada uma **ainda
resolve**.

Dois cuidados que decidem se ele funciona:

1. O `fetch` roda por `page.evaluate`, **no contexto da página**. `blob:` é escopado por origem e
   não resolve de fora.
2. As URLs são lidas **antes** da transição. Depois dela os links não existem mais — e um
   auxiliar que lê o `href` no fim mede uma tela onde não há `href` nenhum.

**Pronto quando:** o auxiliar devolve um par de booleanos, não um booleano só. São dois *blobs*
desde a ESPEC 009, e foi exatamente essa contagem que o comentário de `page.tsx:26` registrou como
lugar de esquecimento.

---

#### T-903 — Provar que o instrumento discrimina
**Tamanho:** P · **Ref:** PLANO 015 §1

Em `pronto`, as duas URLs resolvem. Depois de um `revokeObjectURL` disparado à mão por
`page.evaluate`, **nenhuma** resolve.

`fetch` falha por muitos motivos — CSP, rede, URL malformada, erro de digitação. Um auxiliar que
devolve "não resolve" para todos eles não distingue correção de engano. Ele precisa acertar os
**dois** lados antes de valer como portão.

É a exigência da T-802 do PLANO 013 noutra roupa: lá o comparador tinha de acusar um número
verificável, aqui o auxiliar tem de acertar o positivo **e** o negativo.

**Pronto quando:** o teste falha se o auxiliar for trocado por `() => false`.

---

#### T-904 — Ver o vazamento vivo `[portão P1]`
**Tamanho:** P · **Ref:** ESPEC 015 §2.2 · **Portão P1**

Rodar contra o código **atual**, sem nenhuma alteração de `src/`: em `pronto`, trocar um arquivo
por outro e afirmar que as URLs antigas **deixaram** de resolver.

Hoje elas resolvem. **O teste tem de ficar vermelho**, e é o vazamento visto vivo — o "antes" que
torna a T-909 demonstrável. Sem ele, ficar verde depois não prova que algo mudou; prova que
resolve.

Registrar aqui o **modo** de falha, não só a cor. Na E2 esse registro é o gabarito.

**Pronto quando:** o teste reprova, e reprova porque a URL ainda resolve — não por seletor, não
por *timeout*, não por estado montado errado.

---

## 5. Épico E2 — A âncora do descarte `[portão P1]` `[entregável sozinho]`

> **Este épico corrige um defeito que existe hoje e não depende do botão.** Se a entrega for
> interrompida em qualquer ponto adiante, **esta parte fica**.

#### T-905 — `descartar()`
**Tamanho:** PP · **Ref:** `R-LMP-11`, `D-05`

Função única em [`page.tsx`](../../frontend/src/app/page.tsx), sem efeito quando o estado não é
`pronto`.

A guarda mora **dentro** da função, não em cada chamador. Três chamadores com a mesma condição
copiada são três lugares de esquecer — e §2.2 mostra que o segundo já foi esquecido uma vez.

**Pronto quando:** existe **um** lugar no código que chama `revokeObjectURL`.

---

#### T-906 — `enviar()` passa a chamá-la
**Tamanho:** PP · **Ref:** `R-LMP-11`

Substituir as duas linhas de `revokeObjectURL` que [`page.tsx:31-34`](../../frontend/src/app/page.tsx#L31-L34)
já tem.

**Nenhum teste muda de cor aqui.** É movimento de código com a suíte como rede — a mesma
separação que a T-707/T-708 do PLANO 012 impôs, e pelo mesmo motivo: extrair e corrigir no mesmo
passo torna impossível saber a qual dos dois atribuir uma regressão.

**Pronto quando:** a suíte segue verde e a T-904 segue **vermelha** — o defeito ainda está lá.

---

#### T-907 — `selecionar()` passa a chamá-la `[risco]`
**Tamanho:** PP · **Ref:** `R-LMP-11` · ESPEC 015 §2.2

É o caminho de §2.2, e é o defeito de hoje.

**A ordem importa e é contraintuitiva:** a chamada vai **antes** do `setEstado`. Escrever depois
funcionaria — em React o `estado` da *closure* ainda é o antigo — e funcionaria **por acidente**,
com uma linha que parece errada para quem ler. É mais barato escrever na ordem certa do que
explicar por que a errada funciona.

**Pronto quando:** o caminho `pronto → inicial` por troca de arquivo libera os dois *blobs*.

---

#### T-908 — O comentário que documenta o engano
**Tamanho:** PP · **Ref:** `D-05`

[`page.tsx:23-30`](../../frontend/src/app/page.tsx#L23-L30) afirma hoje: *"Liberar no envio basta:
qualquer transição para `erro` ou `bloqueado` passa por aqui."*

A frase está **certa sobre `erro` e `bloqueado`** e omite a transição que não passa por lá. Ela
documenta o raciocínio que produziu o defeito, e deixá-la convida a reintroduzi-lo — alguém lerá
"basta" e removerá a chamada da T-907 por parecer redundante.

O comentário novo diz o que a `D-05` decidiu: a âncora é *"ao deixar de haver relatório"*, e são
**três** os caminhos.

**Pronto quando:** o comentário nomeia os três caminhos, e não só o que mudou.

---

#### T-909 — O vazamento morto `[portão P1]`
**Tamanho:** PP · **Ref:** **Portão P1**

T-904 fica verde. Comparar com o modo de falha registrado nela: ficou verde **porque as URLs
deixaram de resolver**, e não porque o teste parou de encontrar os links.

É a mesma conferência que a T-712 do PLANO 012 exigiu, e pela mesma razão — um teste de estado que
muda de cor sem ninguém olhar o motivo troca um defeito por outro.

**Pronto quando:** P1 fechado, com os dois resultados lado a lado aqui.

---

## 6. Épico E3 — O botão e o diálogo

> **A régua da §2.3 governa este épico.** Quatro capturas têm de sair idênticas, e são elas que
> provam `R-LMP-02` e `D-02`.

#### T-910 — O botão *Limpar*
**Tamanho:** P · **Ref:** `R-LMP-01`, `R-LMP-12`, `D-03`

Em [`UploadForm.tsx`](../../frontend/src/app/components/UploadForm.tsx), **depois** do botão
primário no DOM, em estilo secundário.

A posição no DOM não é estética: é o que mantém a ordem de tabulação da ESPEC 008 §6 intacta —
*Limpar* entra como Tab ⑤, depois de *Gerar relatório*, e nunca antes. O secundário de referência
já existe na tela: *Baixar análise (XLSX)*, com borda e texto `teal-700`
([`ResultadoPanel.tsx:152-158`](../../frontend/src/app/components/ResultadoPanel.tsx#L152-L158)).

**Pronto quando:** o botão existe, e a `a11y-contraste` — que varre todo nó de texto visível —
segue verde nos quatro estados. Ela passa a cobrir o rótulo novo **sem uma linha de teste nova**.

---

#### T-911 — `type="button"` `[risco]`
**Tamanho:** PP · **Ref:** `R-LMP-03` · ESPEC 015 §2.4

Dentro do `<form>` que `R-ACE-07` introduziu, um `<button>` sem `type` **é `submit` por omissão do
HTML**. Clicar em *Limpar* geraria relatório.

Defeito de uma palavra, invisível em revisão de código e imediato em uso. É a tarefa mais curta do
backlog e a que tem teste próprio (T-921).

**Pronto quando:** o atributo está escrito, com o porquê ao lado — quem ler depois vai achá-lo
redundante.

---

#### T-912 — Quando o botão existe
**Tamanho:** P · **Ref:** `R-LMP-02`, `D-02`, `D-09`

Aparece com arquivo escolhido **ou** estado ≠ `inicial`. **Some** durante `processando`.

Some, não desabilita. Controle desabilitado convida a esperar que habilite, e o que ele parece
prometer — cancelar — a ESPEC 012 §10 diz que não existe: `run_sync` não é cancelável e a réplica
fica ocupada até o fim.

A condição também é o que faz `D-09` funcionar: **toda confirmação exibida corresponde a uma perda
real**, e é isso que a mantém sendo lida.

**Pronto quando:** as capturas `inicial` e `processando` saem **idênticas** à referência da T-901.
É a asserção mais barata deste backlog e a que prova duas regras de uma vez.

---

#### T-913 — `ConfirmarLimpeza.tsx`
**Tamanho:** M · **Ref:** `R-LMP-07`, `D-07`

`<dialog>` com `showModal()`, renderizado em **`page.tsx`** — fora da `key` da T-916, por §2.2.

O modal nativo traz de graça o que `R-LMP-07` pede: retenção de foco, `Esc` e inércia do fundo.
`window.confirm()` foi recusado por quatro motivos em `D-07`, sendo o decisivo que ele fica fora do
DOM — logo fora do `axe` e da captura, que são o protocolo da ESPEC 008 §9.2.

Cuidado de estilo: `<dialog>` fechado computa `display: none`, e as classes de layout do Tailwind
só valem com ele aberto. O `::backdrop` não herda nada do tema.

**Pronto quando:** o diálogo abre, retém o foco e fecha com `Esc` — **sem uma linha de ARIA
escrita à mão**. Se for preciso `role="dialog"` ou `aria-modal`, o elemento nativo não está sendo
usado como tal.

---

#### T-914 — Os dois textos `[risco]`
**Tamanho:** P · **Ref:** `R-LMP-06`, `D-04` · **Insumo `K-11`**

Com relatório gerado: a confirmação diz que ele será **descartado** e que não há como recuperá-lo
sem gerar de novo — a aplicação é sem estado (ESPEC 001 §7.2) e não há onde guardá-lo. Sem
relatório: texto mais leve, sobre os arquivos escolhidos.

**É onde o texto pode ficar pior que a ausência dele.** Um aviso que exagera no caso leve ensina a
confirmar sem ler — e aí a pessoa confirma sem ler no caso grave, que é o único que importa. Nada
automatizado julga isso: é a T-934 e o `K-11`.

**Pronto quando:** os dois textos existem e foram lidos por uma pessoa que não os escreveu.

---

#### T-915 — Só o controle de confirmação limpa
**Tamanho:** P · **Ref:** `R-LMP-05`

`Esc`, o botão de cancelar e qualquer outro fechamento **não limpam**. Tratar `close` sem o
`returnValue` de confirmação como cancelamento — o padrão seguro é "não limpa, exceto quando".

`Esc` percorre outro caminho no `<dialog>` (evento `cancel` antes do `close`), e por isso tem caso
de teste próprio na T-921. Uma implementação que trate só o clique deixa o `Esc` caindo no
caminho de sucesso — e o modo de falha é o pior possível: **limpa sem confirmar**.

**Pronto quando:** o teste com `Esc` e o teste com *Cancelar* afirmam os dois que a tela ficou
intacta — relatório, arquivos e tudo.

---

#### T-916 — A limpeza
**Tamanho:** P · **Ref:** `R-LMP-01`, `R-LMP-04`, `D-08` · §2.2

Zera `arquivos`, leva o estado a `inicial`, chama `descartar()` da T-905 e **incrementa a `chave`**
que remonta os campos.

A `key` vai **nos dois campos de arquivo**, não no formulário — §2.2 desvio 1. `UploadForm.tsx:73`
já tem `key={campo.nome}`; passa a `key={`${chave}-${campo.nome}`}`. É o menor escopo que zera
`input.value`, e é o único que não destrói o botão, o diálogo e a região que anuncia no exato
instante em que o foco está sendo movido.

**Pronto quando:** depois de limpar, `input.value` é `""` nos dois campos — **avaliado no
elemento**, não no rótulo. O rótulo lê de `arquivos` (`UploadForm.tsx:107`) e voltaria a
`escolher arquivo…` mesmo com o defeito presente.

---

## 7. Épico E4 — Foco e anúncio

> **É o épico com o defeito mais difícil de ver**, e é o que a regra 3 e a regra 4 de §1.1
> governam. Nada aqui aparece em captura, e quase nada aparece em `axe`.

#### T-917 — O foco abre no cancelar
**Tamanho:** P · **Ref:** `R-LMP-08`

Ao abrir, `document.activeElement` está **dentro** do diálogo e é o controle de cancelar.

Confirmação de descarte não pré-seleciona o descarte. É a mesma disciplina do `D-04` da ESPEC 008
noutra direção: lá o foco não podia ser perdido, aqui não pode ser entregue ao botão perigoso.

**Pronto quando:** o teste afirma qual controle, não só que o foco está no diálogo.

---

#### T-918 — Para onde o foco vai `[risco]`
**Tamanho:** M · **Ref:** `R-LMP-09`, `D-08`

Cancelado, volta ao botão *Limpar*. Confirmado, vai para o **primeiro `input[type=file]`** — que
naquele instante é um elemento **recém-criado** pela `key` da T-916, e não o de antes.

**É a armadilha de ordem desta entrega.** Um `ref` capturado antes da limpeza aponta para um nó
fora do documento, e `focus()` nele **não lança erro** — simplesmente não faz nada, e o foco cai
no `<body>`. O sintoma é idêntico ao de não ter escrito a linha, e nenhuma verificação de "a linha
existe" o distingue.

O que distingue é afirmar `document.activeElement` **depois** da limpeza, com a remontagem já
tendo acontecido.

**Pronto quando:** o teste falha se a chamada de foco for removida. Se continuar passando, ele
está medindo outra coisa.

---

#### T-919 — O anúncio da volta `[risco]`
**Tamanho:** P · **Ref:** `R-LMP-10`, `D-06` · §2.2 · **Insumo `K-10`**

Região de status em **`page.tsx`**, montada desde o primeiro render, **fora** da `key` da T-916.

Duas razões, e as duas são o mesmo mecanismo:

1. O invólucro `aria-live` de `R-ACE-13` **esvazia** nesta transição — `Conteudo` devolve `null`
   em `inicial` ([`ResultadoPanel.tsx:84`](../../frontend/src/app/components/ResultadoPanel.tsx#L84)).
   Região viva que esvazia é silêncio na maioria dos leitores.
2. Se a mensagem morasse na subárvore remontada, ela nasceria junto com a região a cada limpeza —
   inserção, não mutação, e o anúncio não dispara. É o `D-03` da ESPEC 008 alcançado por um
   caminho novo (§2.2).

O foco da T-918 ajuda e não basta: ele anuncia *"Contrato, campo de arquivo"*, que não diz que
houve limpeza.

**Pronto quando:** a mensagem está presente após a limpeza **e** a região existe no DOM no estado
inicial, antes de qualquer limpeza. Que ela seja **ouvida** é `K-10`, e é outra coisa.

---

#### T-920 — O botão que some com o foco dentro
**Tamanho:** P · **Ref:** `R-LMP-09`, `R-ACE-06`

Ao confirmar, *Limpar* desaparece — e se o foco estivesse nele, cairia no `<body>`.

No caminho da confirmação o foco está no diálogo, não no botão, então o risco é indireto: ele
aparece se alguém "simplificar" o diálogo depois. A verificação é barata e é a rede da regra 3 de
§1.1.

**Pronto quando:** em nenhum dos quatro caminhos — confirmar, cancelar, `Esc`, fechar — o foco
termina no `<body>`.

---

## 8. Épico E5 — Verificação `[portões P2 e P3]`

#### T-921 — `e2e/limpar.spec.ts`
**Tamanho:** M · **Ref:** ESPEC 015 §8.1

Os casos da §8.1 da espec, com dois obrigatórios:

- **`R-LMP-03`** — clicar *Limpar* **não** produz requisição a `/reports`. É o teste que pega o
  `type` omitido da T-911, e ele falha de forma barulhenta.
- **`R-LMP-04`** — `input.value` avaliado **no elemento**, nunca no rótulo (T-916).

**Pronto quando:** os dez casos da §8.1 existem, e o de `Esc` é separado do de *Cancelar*.

---

#### T-922 — O diálogo entra no inventário `[risco]`
**Tamanho:** P · **Ref:** `R-LMP-13`

Estado novo — diálogo aberto — em **`e2e/estados.ts`** e em **`scripts/capturar-baseline.mjs`**.

**São duas implementações separadas de propósito**, e o comentário de `estados.ts:7-9` avisa: *"Se
divergirem, a captura e as varreduras deixam de falar do mesmo estado."* Acrescentar em um e
esquecer o outro é o modo de falha natural aqui.

E há um motivo específico para o diálogo precisar de estado próprio: `<dialog>` fechado computa
`display: none`, e a `a11y-contraste` pula o invisível pela função `invisivel()`
([`a11y-contraste.spec.ts:108-115`](../../frontend/e2e/a11y-contraste.spec.ts#L108-L115)). **O
texto do diálogo não é medido em nenhum dos quatro estados de hoje.** Um modal fora do inventário
é a forma mais comum de conformidade presumida.

**Pronto quando:** `ESTADOS` tem cinco entradas e `capturar-baseline.mjs` produz **12** capturas.

---

#### T-923 — `axe` e contraste nos cinco estados `[portão P3]`
**Tamanho:** P · **Ref:** **Portão P3**

Zero violações A/AA e zero textos abaixo de 4,5:1, nos cinco estados × duas larguras.

As duas larguras não são simetria: a ESPEC 008 §14.3 registrou que a 1366 px o grid não transborda
e que uma varredura só no desktop teria dado `R-ACE-05` por cumprida.

**Pronto quando:** verde, com os números aqui.

---

#### T-924 — O passo 4 do teclado, mais forte `[risco]`
**Tamanho:** P · **Ref:** PLANO 015 §5.3

[`a11y-teclado.spec.ts:95-99`](../../frontend/e2e/a11y-teclado.spec.ts#L95-L99) afirma hoje só
`toBe("button")`, **sem nome**.

Ele sobrevive a esta entrega porque naquele ponto do percurso nenhum arquivo foi escolhido e
`R-LMP-02` mantém *Limpar* fora da tela — mas sobreviveria igual se *Limpar* estivesse lá, e o
percurso da ESPEC 008 §6 estaria medindo outro controle.

É o princípio do PLANO 013 §1: **o teste que guardava o desenho antigo guarda uma intenção que
continua valendo**, e a reescrita sai mais forte. Acrescentar o nome custa uma linha.

**Pronto quando:** o passo 4 falha se o botão alcançado for o *Limpar*.

---

#### T-925 — A captura, contra a previsão `[portão P3]`
**Tamanho:** P · **Ref:** **Portão P3** · PLANO 015 §5.4

`node scripts/capturar-baseline.mjs depois` e `comparar-baseline.mjs referencia depois`.

A previsão, e ela é falsificável:

| Estado | Esperado |
|---|---|
| `inicial` (2 larguras) | **idêntico** |
| `processando` (2 larguras) | **idêntico** |
| `pronto`, `erro`, `bloqueado` (6) | botão novo, e só |

**Quatro idênticas de dez.** Diferença em `inicial` ou `processando` **reprova** — são a prova de
`R-LMP-02` e `D-02`.

**O caso limítrofe é a altura a 390 px.** Os dois botões cabem na mesma linha por pouco; se
quebrarem, o comparador relata `reflui`. Duas saídas legítimas: encolher o secundário, ou declarar
a quebra como **quinta exceção de aparência**, na linha do que o TASKS 008 §1.1 fez com as quatro
primeiras. O que **não** se faz é registrar `reflui` e seguir — a ESPEC 008 §14.4 mostra o que
passa por essa porta.

**Pronto quando:** o resultado bate com a previsão, ou o desvio está explicado aqui.

---

#### T-926 — O mesmo arquivo, reescolhido `[portão P2]`
**Tamanho:** P · **Ref:** **Portão P2** · ESPEC 015 §2.3 · **Insumo `K-12`**

Em **Chromium e Firefox**: limpar, reescolher o mesmo arquivo nos dois cartões, e a seleção
reaparecer.

A ESPEC 015 §2.3 recusou-se a afirmar de memória se reescolher o mesmo arquivo dispara `change` —
é dependente de motor, e a espec decidiu **não depender disso**. Esta tarefa é quem verifica que a
decisão foi implementada, não só escrita.

Sem ela, o botão cria um beco: a tela diz vazio e o formulário não está.

**Pronto quando:** os dois motores conferidos, com o resultado de cada um aqui.

---

#### T-934 — A tela olhada por uma pessoa `[nasce neste backlog]`
**Tamanho:** PP · **Ref:** §2.2 · `R-LMP-12`, `R-LMP-06` · **Insumo `K-11`**

Um olhar, dois pontos:

1. **`R-LMP-12`** — *Limpar* é secundário de verdade? Não disputa atenção com *Gerar relatório*?
2. **`R-LMP-06`** — os dois textos dizem a perda sem exagerar? O leve não treina o clique
   automático, o grave nomeia o que se perde?

Nenhum dos dois tem cobertura automática: contraste é medido, **proeminência não é**; e nenhum
teste julga se um aviso é lido. O PLANO 015 §5.5 listou os dois e deixou o primeiro sem tarefa —
§2.2 desvio 3.

**Pronto quando:** conferido por pessoa, e o resultado registrado aqui.

---

#### T-927 — Regressão do conjunto `[portão P3]`
**Tamanho:** P · **Ref:** **Portão P3**

Sete suítes de navegador mais a nova, verdes. `tsc --noEmit`, `next lint` e `next build` limpos.
**Backend não tocado** — a contagem de testes é idêntica à da T-900, e qualquer divergência é
sintoma (§1.1 regra 1).

**Pronto quando:** tudo verde, com os números ao lado dos da T-900.

---

## 9. Épico E6 — Documentação

#### T-928 — ESPEC 015
**Tamanho:** P

Status → implementada. E três correções:

1. O `P2` da espec era declarado humano e **é automatizável** (PLANO 015 §6.1) — revogar de
   passagem não serve: a espec precisa dizer por que a premissa herdada da ESPEC 008 não se
   aplicava.
2. `D-08` fala em *"remontar o formulário"*, e o escopo certo são **os campos** — §2.2 desvio 1.
3. `R-LMP-10` ganha a ressalva de que a região não pode morar na subárvore remontada.

**Pronto quando:** nenhuma afirmação da espec contradiz o que foi entregue.

---

#### T-929 — ESPEC 008
**Tamanho:** P

Emenda em `R-ACE-18`, com a redação proposta na ESPEC 015 §12.2 e com o defeito de §2.2 nomeado.

**É a espec onde a regra mora**, e é lá que quem a procurar vai olhar. A conduta é a da
ESPEC 007 §13: a regra é revisada na **âncora**, não revogada — a intenção sempre esteve certa.

**Pronto quando:** a emenda diz o que continua valendo, não só o que mudou.

---

#### T-930 — ESPEC 007
**Tamanho:** PP

§10 ponto 4 e §347 ponto 3 marcados como **decididos**, apontando para a ESPEC 015 — e registrando
que a decisão foi **contra** a proposta original em dois pontos: o nome (`D-01`) e o lugar
(`D-03`, a barra descartada por `R-CAB-05`).

Pergunta aberta que fica aberta depois de respondida é a que alguém reabre.

**Pronto quando:** os dois pontos apontam para onde a resposta está.

---

#### T-931 — README e CHANGELOG
**Tamanho:** P

O botão, e o vazamento corrigido.

No CHANGELOG, o que vale registrar não é o botão — é que **o caminho de recomeço já existia pela
metade** (ESPEC 015 §2.1) e que a metade que funcionava retinha ~3,8 MB por uso.

**Pronto quando:** a entrada explica por que o defeito passou despercebido, e não só que foi
corrigido.

---

#### T-932 — Este backlog
**Tamanho:** P

Resultado, desvios e o que a implementação ensinou. Preencher a tabela de §"Resultado" e as três
linhas de portão.

**Pronto quando:** os desvios estão escritos com o motivo, e não como lista de ajustes.

---

## 10. Insumos

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **K-10** | **Leitor de tela** (NVDA ou Narrator) para ouvir o anúncio de `R-LMP-10` | T-919 | O anúncio fica **verificado por presença, não por escuta** — o mesmo estado honesto em que a ESPEC 008 §14.5 deixou o `P2` dela. Não bloqueia a entrega; bloqueia declará-la ouvida |
| **K-11** | **Aceite dos dois textos** de confirmação e do peso visual do secundário | T-914, T-934 | O código segue com os textos propostos, marcados para revisão. Texto de tela é decisão de produto, como a `K-06` do PLANO 012 |
| **K-12** | **Firefox instalado** para o `P2` | T-926 | `P2` fecha só em Chromium, e a ESPEC 015 §2.3 continua sem resposta para o outro motor. `npx playwright install firefox` resolve |

`K-10` é o mesmo impedimento do `P2` da ESPEC 008. Não custa licença nem dinheiro: custa alguém
abrir o NVDA uma vez.

> **Correção de 2026-08-12.** Esta passagem afirmava que o `K-10` era *"o mesmo `K-01` da
> ESPEC 009"* e *"terceira espec seguida"*. **É falso**: o `K-01` da ESPEC 009 é *"arquivo aberto no
> Excel"*, e nada tem de leitor de tela. A afirmação conflou duas famílias de dívida que
> compartilham o **padrão** e não o **insumo**. O quadro real é **pior**: leitor de tela bloqueia a
> ESPEC 008 e a 015; abrir no Excel bloqueia a 009 e a 013 — **quatro portões, quatro especs, 100%
> de não execução**. Apurado e tratado pela
> [ESPEC 016](../specs/016-verificacao-por-tecnologia-assistiva.md) §2.1.

---

## 11. O que este backlog não faz

- **Não toca o backend** — §1.1 regra 1. Nenhum arquivo, nenhuma tarefa.
- **Não toca `lib/types.ts` nem `lib/api.ts`** — §1.1 regra 2. `inicial` já existe.
- **Não cancela a geração em curso.** `D-02`, apoiado na ESPEC 012 §10: `run_sync` não é
  cancelável e a réplica fica ocupada até o fim. Esconder o botão é a única leitura honesta.
- **Não toca a barra nem o painel de resultado.** `R-CAB-05` preservada — a ESPEC 008 §13.3 já
  avisou que uma espec nova seria o pretexto fácil para furá-la.
- **Não implementa desfazer.** Não há onde guardar o relatório descartado; a aplicação é sem
  estado (ESPEC 001 §7.2). A defesa contra o engano é a confirmação.
- **Não limpa um cartão de cada vez.** `I-14`, fora do escopo por ESPEC 015 §4.2.
- **Não resolve o `I-15`** — se a confirmação deveria sumir quando não há relatório. `D-09` a
  mantém, e a decisão se revisa com uso, não com argumento.
- **Não resolve o `I-16`** — se o relatório deveria sobreviver à troca de um arquivo. É
  comportamento anterior a esta espec, e mudá-lo aqui misturaria duas decisões.
- **Não introduz dependência.** `<dialog>` é do navegador. O *bundle* entregue não ganha um byte,
  o que mantém válida a emenda 1 da ESPEC 008 §14.2.
- **Não fecha o `P2` da ESPEC 008.** A escuta continua devendo, agora com uma regra a mais
  dependendo dela.

---

## 12. O que a implementação ensinou

### 12.1 O portão declarado humano era automatizável — e virou o mais importante

A espec e este backlog declararam o vazamento como verificação humana, herdando da ESPEC 008 a
frase *"não há asserção de memória na suíte"*. **A premissa está certa e a conclusão não era**, e a
distinção é a lição da entrega:

> Liberar um *blob* não é **medir memória**. É **revogar um identificador** — e identificador
> revogado é observável.

Consequência prática, medida:

| Momento | T-904 |
|---|---|
| Contra o código anterior | **Reprovou** — `[true, true]` |
| Depois da E2 | **Passou** — `[false, false]` |
| O instrumento é cego? | Não — a T-903 acerta os dois lados |

Sem a T-904, a E2 teria sido escrita, teria funcionado, e ninguém saberia dizer se funcionou.

### 12.2 A T-900 não foi executada como escrita, e isso custou duas investigações

O backlog manda rodar as sete suítes **antes** de tocar em `src/`. A suíte de backend foi rodada
(**379 verdes**); a de navegador **não** — a execução foi interrompida e a implementação seguiu.

O preço apareceu duas vezes, e nas duas o sintoma foi indistinguível de defeito da entrega:

| Ocorrência | Sintoma | Causa real |
|---|---|---|
| 1 | 21 falhas, todas em 2,0 min | `.next` corrompido — `GET / 500` |
| 2 | Suíte parada 14 min no teste 7 | **Backend morto** com a sessão anterior |

Nas duas, tempo foi gasto verificando se a falha era minha. **É a terceira vez que esta lacuna
cobra neste projeto** — PLANO 012 §10.4 já a havia registrado como regra para o próximo plano.
Fica a emenda ao procedimento: além de rodar o "antes", **verificar a saúde do ambiente
imediatamente antes de cada execução longa**, e conferir o **conteúdo** servido, não só o `200`.

### 12.3 A atribuição por controle funcionou, e era necessária

A T-925 acusou diferença em `inicial-1366`, que a §2.3 previa **idêntica** — e a régua manda parar
quando isso acontece. Em vez de racionalizar, a saída foi o procedimento do PLANO 012 §10.4:
guardar as mudanças, recapturar como `controle`, comparar os três conjuntos.

| Comparação | Isola | Resultado |
|---|---|---|
| controle × referência | deriva de ambiente | 6/7 idênticas · **só `inicial-1366`** |
| controle × depois | **a mudança** | `inicial` e `processando` **idênticas nas duas larguras** |

A diferença em `inicial-1366` (faixas y 12–39 e y 698–737 — logo e rodapé, ambos `next/image`) é
**deriva do cache de imagem** reconstruído quando o `.next` foi apagado. Contra o controle,
`inicial-1366` sai idêntica.

**A previsão de §2.3 sobreviveu no que importava**: as quatro capturas que provam `R-LMP-02` e
`D-02` saíram idênticas. Sem o controle, a conclusão honesta teria sido "a régua reprovou".

### 12.4 A quinta exceção de aparência: 2 px de borda

Não prevista. O secundário tem `border` e o primário não — 1 px em cima e 1 embaixo. Em `pronto` e
`bloqueado` a página cresce 2 px; em **`erro` a 1366 px não cresce**, porque ali o conteúdo é menor
que a viewport e o `flex-1` do `<main>` absorve, produzindo diferença de pixels em 6 faixas **sem**
diferença de altura.

O caso de `erro` é contraintuitivo e vale guardar: **pixels que se movem sem a altura mudar** são
sinal de deslocamento absorvido pelo `flex-1`, não de mudança de conteúdo.

### 12.5 Quatro armadilhas que só aparecem em execução

| # | Armadilha | Como apareceu |
|---|---|---|
| 1 | **`getByText` casa por substring** | O texto *"O relatório gerado será descartado"* fez `getByText("Relatório gerado")` resolver dois elementos e derrubou `estados.ts` e `smoke.spec.ts`. Corrigida a **redação**, não o localizador |
| 2 | **`aria-live` explícito quebraria a T-416** | Ela conta `[aria-live="polite"]` esperando **um**. `role="status"` implica a região viva sem o atributo |
| 3 | **`page.evaluate` lê uma vez e não repete** | `R-LMP-04` passou isolada e reprovou na suíte completa: a leitura de `input.value` chegava antes da remontagem. Corrigido com sinal de conclusão + `expect.poll` — em **três** pontos, não só no que falhou |
| 4 | **A `key` no formulário destruiria o destino do foco** | `D-08` dizia "remontar o formulário"; o escopo certo são os **campos**. Remontar tudo mataria o botão, o diálogo e a região que anuncia no instante em que o foco é movido |

A de número 3 é a mais instrutiva: **um teste que passa isolado e falha em conjunto não é flaky —
está mal escrito**. A carga só revelou uma corrida que já existia.

### 12.6 O que continua sem verificação

| # | O quê | Por quê |
|---|---|---|
| 1 | **A escuta do anúncio** (`R-LMP-10`) | `K-10`. Verificado por **presença**, não por escuta — mesmo estado honesto do `P2` da ESPEC 008. **Terceira espec seguida** a esbarrar nisto |
| 2 | **O aceite dos dois textos** (`R-LMP-06`) | `K-11`. Decisão de produto. A T-934 conferiu a proeminência (`R-LMP-12` ✅ — o secundário não disputa com o primário) e a proporção do texto leve; o aceite é de quem responde pelo produto |