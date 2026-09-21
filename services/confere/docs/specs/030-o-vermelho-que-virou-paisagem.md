# ESPEC 030 — O vermelho que virou paisagem

| | |
|---|---|
| **Status** | **Proposta** |
| **Versão** | 1.4 — 2026-08-20 |
| **Depende de** | [ESPEC 019](019-contrato-e-aditivos.md), [ESPEC 009](009-analise-da-medicao.md), [ESPEC 015](015-limpar-para-recomecar.md), [ESPEC 016](016-verificacao-por-tecnologia-assistiva.md), [ESPEC 029](029-o-par-que-nao-e-do-mesmo-contrato.md) — implementadas |
| **Revisa** | **`R-PAN-07`** (ESPEC 009) e **`R-DIV-03`** (ESPEC 002), cujas premissas a ESPEC 018 desfez — `D-06` e `D-07`. Fora isso, nada do produto: revisa **o que a suíte de navegador afirma**, que em dez pontos descreve uma tela que não existe mais |
| **Não toca** | O backend, o `.docx`, o `.xlsx`, e **qualquer comportamento decidido por espec posterior ao teste que o acusa** — `R-SUI-01` |
| **Referência normativa** | A execução completa de `e2e/` em 2026-08-20, com backend no ar: **120 testes, 110 verdes, 10 vermelhos** |
| **Origem** | A entrega da ESPEC 029 encontrou 24 testes vermelhos ao rodar a suíte inteira. **Quatorze eram regressão dela**, e foram corrigidos lá; **dez já estavam vermelhos antes** |

---

## 1. Problema

**Uma suíte com vermelho crônico deixa de ser sinal e vira paisagem.**

A suíte de navegador tem 120 testes, e 10 deles falham há tempo suficiente para ninguém mais
olhar. Nenhum deles falha porque o produto está errado: falham porque o produto **mudou de
propósito** e as asserções ficaram para trás. O terceiro campo do formulário entrou na ESPEC 019;
o teste de tabulação continua contando até o botão como se houvesse dois campos.

Isso custaria pouco se fosse só ruído. Mas custou caro, e a conta chegou na entrega passada:

> A ESPEC 029 declarou o portão `P5` fechado com a suíte verde nos testes dela — e o requisito
> central da espec estava **vermelho**: a tela continuava emitindo os dezenove cartões que a §1
> daquele documento abriu denunciando (TASKS 029 §11.6).

Não foram estes dez que esconderam aquele defeito — mas eles ensinam o hábito que o escondeu:
**ler "falhou" e seguir em frente**. Numa suíte onde o vermelho é normal, o vermelho novo não
chama atenção. E há um caso, entre os dez, que pode ser exatamente isso: um defeito real
esperando há meses no meio do ruído (§2.5).

Há ainda o efeito prático: a suíte leva **32 minutos**. Ninguém roda 32 minutos para receber uma
resposta que já sabe que virá suja.

---

## 2. O que foi medido

Execução completa em 2026-08-20, com o backend no ar: **120 testes, 110 verdes, 10 vermelhos** —
depois de corrigidos os **quatorze** que a ESPEC 029 havia quebrado.

### 2.1 Família A — o terceiro campo do formulário · 4 testes

| Teste | O que afirma | O que recebe |
|---|---|---|
| `a11y-estrutura` — o nome acessível é o rótulo | `["Contrato", "Levantamento"]` | `+ "Aditivos da proposta"` |
| `a11y-teclado` — percurso completo | 4º `Tab` cai num `button` | cai num `input` |
| `limpar` — `R-LMP-01` confirma descarta tudo | dois campos vazios | **três** |
| `limpar` — `R-LMP-04` a limpeza zera o elemento | todo campo preenchido | o de aditivos está vazio |

**Dono nomeado: ESPEC 019 `R-ADT-10`**, que acrescentou o campo de aditivos ao formulário. Os
quatro testes varrem `input[type="file"]` sem filtro e contam até o botão sem prever um terceiro
campo. A tela está **certa**; as asserções são de antes.

### 2.2 Família B — os números da análise · 4 testes

| Teste | Afirma | Recebe |
|---|---|---|
| as quatro situações | `Sem divergência: 19 itens` | `21 itens` |
| `R-RES-02` — total visível | `56 itens analisados` | não encontrado |
| abre e fecha por teclado | `56 itens analisados` | não encontrado |
| `R-PAN-06` — perfis na 4ª situação | `5 desses itens são de perfil ou pacote` | não encontrado |

Os números da ESPEC 009 valiam para o piloto de então. **O dono é a ESPEC 018**, e está escrito no
próprio backend:

* `R-REL-01` — o universo do relatório passou a ser a aba `Levantamento`, e o piloto foi de **56
  para 58** itens. Os dois que entraram são conformes, o que leva *Sem divergência* de 19 a 21 e
  deixa as outras três situações intactas — que é exatamente o que o `diff` do teste mostra;
* `D-01` — o `14.025.00011.00` deixou de contar duas vezes. O `test_anchor_analise.py` documenta a
  troca em uma frase: *"eram cinco: o `14.025.00011.00` contava duas vezes, desdobrado por
  qualificador"*.

**O backend foi reancorado quando isso mudou; a suíte de tela, não.** É a assimetria que esta
espec existe para desfazer.

### 2.3 Família C — o número do resumo · 1 teste

`smoke` procura `36 … de 55 itens com divergência`.

**A frase está intacta** — `ResultadoPanel.tsx:257` escreve exatamente
`{total_divergencias} de {total_linhas} itens com divergência entre contratado e medido`. O que
mudou foi **só o número**: `total_linhas` é **58**, e o teste procura 55.

*(A v1.0 desta espec afirmava que a frase também havia mudado. Estava errado: o `Barra.tsx` diz
`… divergem`, mas o `smoke` nunca falou dele. Corrigido na v1.2 — e é o segundo erro de
classificação desta espec cometido **antes** de a §5 exigir que se classifique com evidência.)*

### 2.4 O que **não** entra: as quatorze da ESPEC 029

`a11y-axe` (4), `a11y-contraste` (2), `divergencia` (7) e `analise :: R-PAN-04` (1) falhavam porque
`waitForResponse` usava `url().includes("/reports")`, que casa também com o
`POST /reports/conferencia-previa`. Foi regressão da ESPEC 029, corrigida lá (TASKS 029 §11.5).
Ficam citadas para que ninguém as conte duas vezes.

**O `R-PAN-04` entrou nesta lista tarde, e ensina algo.** Ele quebrava com
`TypeError: … reading 'situacoes'`, e a primeira leitura o pôs na família B — *"dublê com forma
defasada"*. Estava errado: o dublê recebia o corpo do **portão** no lugar do relatório, e por isso
não tinha `analise`. Sintoma de forma, causa de rede. A execução seguinte, já com o `endsWith`
corrigido, o devolveu verde — e é por isso que `P0` desta espec exige classificar **depois** de
uma execução limpa, não durante uma bagunçada.

### 2.5 O candidato a defeito · 1 teste

```
a11y-estrutura :: T-543 — 14.049.00054.00 aparece exatamente uma vez na tela
  duas vezes é ruído; nenhuma é o achado perdido
  Expected: 1   Received: 2
```

**Este não se parece com os outros.** Os nove anteriores afirmam sobre a *forma* da tela — quantos
campos, que texto, que número. Este afirma sobre **conteúdo duplicado**.

**Veredito (2026-08-20): deriva, com regra revista.** A medição por componente mostrou uma
ocorrência no grid de divergências e uma no bloco *Item crítico* do painel. A regra que exigia uma
só — `R-PAN-07` — foi escrita quando o item era exceção fora do relatório; a ESPEC 018 o tornou
linha comum. `D-06` registra a revisão, e o teste passou a afirmar **duas**, nomeando cada vista.

**E a investigação achou um segundo caso, que não é deriva** — §2.6.

### 2.6 O defeito que estava escondido atrás de um vermelho · descoberto na execução

Corrigido o número do `smoke`, apareceu a asserção seguinte, que nunca chegava a ser avaliada:

```
getByText('B - SERVIÇOS DE REDES E CONECTIVIDADES')  →  não encontrado
```

**O grid perdeu as faixas de seção.** Medido: zero faixas na tela. A prova é estrutural — o
`LinhaDoGrid` da API não tem campo de seção, e o `DivergenciaGrid.tsx` não menciona faixa.

E há regra: `R-DIV-03` (ESPEC 002) — *"as linhas mantêm o agrupamento por seção e a ordem do
relatório"* —, revisada na cor pela ESPEC 010 §7. Nenhuma regra as remove; a ESPEC 018, única
candidata, afirma o contrário: *"manter as faixas nunca exigiu catálogo"*.

**Veredito corrigido (2026-08-20): deriva, com regra revista.** A primeira leitura o chamou de
defeito por *"nenhuma regra remove as faixas"*. Faltou perguntar o inverso: alguma regra as tornou
**impossíveis**? Tornou — `R-REL-03`, ao reordenar pelo contrato (`D-07`). A asserção sai, com a
razão escrita no lugar dela.

---

## 3. Objetivo

Que a suíte de navegador volte a ser **sinal**: verde quando o produto está certo, vermelha quando
não está — e nunca vermelha por hábito.

Três consequências:

1. Os dez são classificados, com dono nomeado, um a um.
2. O que é deriva reancora **o teste**; o que é defeito conserta **o produto**.
3. A suíte termina verde, e a próxima pessoa que a vir vermelha sabe que aquilo é novo.

---

## 4. Escopo

### 4.1 Dentro do escopo

* A classificação dos dez, com a espec e a regra que moveram cada comportamento.
* A reancoragem dos testes cujo comportamento mudou por decisão registrada.
* A investigação do `14.049.00054.00`, e o conserto **se** ele for defeito.

### 4.2 Fora do escopo

* **Qualquer alteração de comportamento do produto para satisfazer teste antigo** (`R-SUI-01`).
* O backend, os artefatos, as validações. Nenhum arquivo de `backend/src/` é tocado.
* O tempo de execução da suíte — 32 minutos é um problema real e é outro (`I-02`).
* Acrescentar cobertura nova. Esta espec **não escreve teste que não existia**; ela devolve
  crédito aos que existem.

---

## 5. Regras

**`R-SUI-01` — O produto não anda para trás.** Nenhuma correção desta espec altera comportamento
que uma espec posterior decidiu. O campo de aditivos fica; as 58 linhas ficam; a frase da faixa
fica. Um teste vermelho é uma **afirmação desatualizada**, e a resposta a ela nunca é desfazer a
entrega que a desatualizou.

É a regra mais importante do documento, porque é a mais fácil de violar sem perceber: o caminho
curto para o verde é sempre fazer o produto voltar a dizer o que o teste espera.

**`R-SUI-02` — Todo vermelho é classificado antes de tocado.** Duas classes, e só duas:

* **deriva** — o produto mudou porque alguém decidiu que mudasse;
* **defeito** — o produto mudou sem que ninguém decidisse.

**`R-SUI-03` — A classificação nomeia espec e regra.** *"É deriva"* sem `ESPEC nnn R-XXX-nn` ao
lado não é classificação, é palpite. **Sem dono nomeado, é defeito** — a ausência de decisão é o
achado, não um detalhe de procedimento.

**`R-SUI-04` — Deriva reancora o teste; defeito conserta o produto.** Nunca o contrário, e nunca
os dois no mesmo commit: quem lê o histórico precisa distinguir *"a asserção envelheceu"* de
*"o programa estava errado"*.

**`R-SUI-05` — Reancoragem é contra a regra, não contra a saída.** O número novo vem da espec que
o decidiu ou da fonte que o produz — nunca de copiar o que o programa imprime hoje. Colar a saída
faz o teste afirmar *"o código concorda com o código"*, que é o modo de falha que o PLANO 021 §1
nomeou e o TASKS 028 §9.7 exercitou.

**`R-SUI-06` — Teste que afirma número de conteúdo declara a fonte.** `56 itens analisados` e
`19 itens` são números do piloto, e o teste tem de dizer de onde saíram. Sem isso, a próxima
mudança legítima produz outro vermelho sem dono.

**`R-SUI-07` — A suíte termina verde.** Falha conhecida e tolerada não existe: ou está consertada,
ou está reancorada, ou a espec não fechou. Vermelho tolerado é como esta espec começou.

**`R-SUI-08` — Varredura por URL, não por API de teste.** Quando um caminho de rede novo aparecer,
a varredura é `grep -rn '/reports' e2e/`, e não a busca por `page.route`. É a lição da ESPEC 029
§11.5, onde `waitForResponse` escapou de um inventário feito por mecanismo.

---

## 6. Decisões

### `D-01` — Entrega separada da ESPEC 029, e não junto

Os onze são anteriores àquela entrega. Corrigi-los no mesmo diff misturaria *"a ESPEC 029 quebrou
isto"* com *"isto já estava quebrado"* — e a distinção é justamente o que a próxima pessoa vai
precisar. As treze regressões reais da 029 foram corrigidas lá, e só elas.

### `D-02` — O ônus da prova é do "é só deriva"

`R-SUI-03` inverte o instinto: o padrão não é *"deve ser coisa antiga"*, é *defeito até que se
nomeie quem decidiu*. Dez testes vermelhos há meses são, por definição, dez afirmações que
ninguém conferiu — e uma delas fala de conteúdo duplicado na tela.

### `D-03` — Nenhum teste é apagado

Reancorar é atualizar o que ele afirma; apagar é deixar de afirmar. Excluir um teste vermelho é a
forma mais barata de esconder um defeito, e a mais difícil de detectar depois. Se algum deles
tiver perdido o objeto — o comportamento que ele guardava deixou de existir por decisão —, isso é
`I-01`, e é decisão de espec, não de execução.

### `D-04` — Os quatro da família A se resolvem no seletor, não na contagem

Os testes varrem `input[type="file"]` e assumem dois. A correção não é trocar `2` por `3`: é
**nomear o que se quer** — os dois campos obrigatórios — para que o quarto campo, no dia em que
existir, não os quebre de novo. Um teste que conta elementos anônimos volta a envelhecer na
próxima entrega.

### `D-07` — `R-DIV-03` fica revista: não há agrupamento possível fora da ordem dele

A `R-DIV-03` pedia duas coisas na mesma frase: *"as linhas mantêm o agrupamento por seção **e a
ordem do relatório**"*. Não era coincidência de redação — **o agrupamento era a ordem**: as seções
`A`, `B`, `C` são da planilha, e o relatório seguia a planilha.

A ESPEC 018 `R-REL-03` trocou a ordem pela da tabela de itens do **contrato**, que não tem seções.
Reordenando por ele, itens de seções diferentes se intercalam — e não há faixa possível numa lista
que não está mais na ordem delas.

**O `.docx` concorda**: zero faixas de seção nas âncoras do documento. A tela está consistente com
o entregável, que é o critério que importa.

Isto **corrige um veredito desta própria espec**. A v1.3 classificou o caso como defeito, e a
classificação estava errada por não ter conferido a premissa: eu li *"nenhuma regra remove as
faixas"* sem perguntar se alguma regra as **tornou impossíveis**. A ESPEC 018 não precisou removê-las
— bastou mudar a ordem.

O resíduo fica anotado: a segunda metade da `R-DIV-03` — *"seções que ficarem sem linha divergente
não aparecem"* — perdeu o objeto junto com as seções.

**Se o agrupamento fizer falta, é entrega nova**, e sobre uma escolha: o que ganha, a ordem do
contrato ou as seções da planilha. Não é conserto — `I-04`.

*Corrigido em 2026-08-20, depois de a pergunta "para que a ESPEC 031?" expor a premissa não
verificada.*

### `D-06` — `R-PAN-07` fica revista: o item crítico aparece nas duas vistas

A `R-PAN-07` da ESPEC 009 exigia que o item sem previsão contratual aparecesse **uma única vez na
tela**, no bloco de itens críticos. A razão era boa: ele era uma **exceção**, fora do universo do
relatório, e o grid tinha um bloco no topo só para ele. A regra existia para o item não ser lido
como dois achados.

**A ESPEC 018 `R-REL-01` desfez a premissa.** O universo do relatório passou a ser a aba, e o item
deixou de ser exceção: virou linha comum, impressa no `.docx` que vai ao órgão. Linha comum que
diverge aparece no grid de divergências, como todas as outras.

O que decidiu, e é medido: **nenhuma soma é inflada**. O cabeçalho conta 37 divergências em 58
linhas; o painel conta 58 itens em quatro situações. O item entra **uma vez em cada** — são
contagens distintas, cada uma somando o universo inteiro. Aparecer nas duas *vistas* — a lista
completa e a triagem por gravidade — é o que elas existem para fazer.

A alternativa era escondê-lo do grid, e ela custava duas coisas: o cabeçalho passaria a dizer 37
com 36 linhas na tela, e a tela mostraria **menos** do que o documento entregue.

**A preocupação original não envelheceu** — alguém ler o mesmo item como dois problemas. O que
mudou é que ela deixou de ser resolvida por omissão e passou a depender de as duas vistas se
nomearem: *Divergências, na ordem do relatório* e *Item crítico*. Fica como `I-05`.

*Decidido pelo dono do produto em 2026-08-20.*

### `D-05` — A suíte ganha um portão de contagem

Ao fim, `120 passed` vira número declarado. Assim, teste que desaparecer por engano — renomeado,
não coletado, excluído sem querer — aparece como diferença, e não como silêncio. É o que o backend
já faz desde o TASKS 026, e a suíte de tela nunca teve.

---

## 7. O que muda no código

| Arquivo | Mudança | Família |
|---|---|---|
| `e2e/a11y-estrutura.spec.ts` | seletor nomeado no lugar da varredura anônima; investigação do `14.049.00054.00` | A, D |
| `e2e/a11y-teclado.spec.ts` | o percurso passa a prever o campo de aditivos, na posição que `R-ADT-10` lhe deu | A |
| `e2e/limpar.spec.ts` | `valoresDosCampos` distingue os obrigatórios do opcional | A |
| `e2e/analise.spec.ts` | os quatro números reancorados **contra a fonte**, com `R-SUI-06` cumprida | B |
| `e2e/smoke.spec.ts` | a frase e o número da faixa | C |
| `frontend/src/…` | **só se `14.049.00054.00` for defeito** | D |

Nenhum arquivo de `backend/` é tocado. Nenhum arquivo de `frontend/src/` é tocado, **exceto** no
caso de `D-02` se confirmar.

---

## 8. Testes e portões

* **`P0` — A classificação, antes de qualquer edição.** Os dez com espec e regra ao lado, ou
  marcados como defeito por ausência de dono. É o portão que impede a espec de virar um mutirão de
  colar números.
* **`P1` — Nenhuma linha de `frontend/src/` mudou por causa da família A, B ou C.** É `R-SUI-01`
  transformado em verificação: se o produto se moveu para satisfazer teste antigo, esta espec
  falhou no que ela tem de mais importante.
* **`P2` — O `14.049.00054.00` tem veredito**, com a evidência: quantas vezes aparece, em que
  blocos, e qual espec decidiu que assim fosse — ou o conserto.
* **`P3` — A suíte inteira verde**, `120 passed`, com o número declarado (`D-05`).
* **`P4` — O backend intocado**: `git diff --stat backend/` vazio.

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Reancorar colando a saída atual | `R-SUI-05`, e `P0` antes de qualquer edição |
| "Consertar" o produto para o teste passar | `R-SUI-01` e o portão `P1` |
| Um defeito real ser classificado como deriva por preguiça | `R-SUI-03` — sem dono nomeado, é defeito |
| Os mesmos testes envelhecerem de novo na próxima entrega | `D-04` — nomear o que se quer, não contar o que existe |
| A suíte de 32 min desencorajar a execução | Fora do escopo; `I-02` |

---

## 10. Pontos em aberto

* **`I-01`** — algum dos dez perdeu o objeto, isto é, guarda comportamento que uma espec
  posterior removeu de propósito? Se sim, a remoção do teste é decisão de espec (`D-03`).
* **`I-02`** — os 32 minutos da suíte. Provavelmente há geração real repetida onde um dublê
  bastaria, como o `beforeAll` de `anuncio.spec.ts` já faz. É entrega própria.
* **`I-03`** — vale um portão de contagem também no inventário de anúncios e nas âncoras de
  documento, pelo mesmo motivo de `D-05`?
* **`I-04`** — **o agrupamento por seção faz falta?** Não é conserto: é escolha entre a ordem do
  contrato (`R-REL-03`) e as seções da planilha. Só vira entrega se a resposta for sim.
* **`I-05`** — as duas vistas do item crítico se nomeiam o suficiente para ninguém contá-lo duas
  vezes? É a preocupação da `R-PAN-07` sobrevivendo à revisão de `D-06`.

---

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | `P0` — classificar os dez, com dono | P |
| B | Família A: os quatro do terceiro campo (`D-04`) | P |
| C | Família B: os quatro da análise, reancorados contra a fonte | M |
| D | Família C: a faixa | PP |
| E | `P2` — o veredito do `14.049.00054.00` | P a M, conforme o veredito |
| F | `P3`, `P4` e o portão de contagem | PP |

**Total: meio dia**, se os dez forem deriva. O `14.049.00054.00` é a única incógnita de tamanho —
e é justamente a que justifica a espec existir.

---

## 12. Relação com as especs anteriores

### 12.1 ESPEC 029 — quem acendeu a luz

A 029 não criou este problema: ela rodou a suíte inteira, coisa que fazia tempo não se fazia, e o
número apareceu. Também deixou a lição de método de `R-SUI-08`, e o exemplo, em §11.6, do que
custa ler "verde" sem perguntar *"verde no quê?"*.

### 12.2 ESPEC 016 — o precedente de tratar teste como entregável

Aquela espec estabeleceu que mecanismo de anúncio sem entrada no inventário **reprova de
propósito**, e que entrada escrita a partir do DOM é tautologia. É a mesma disciplina desta:
o teste afirma sobre a regra, nunca sobre o que o programa faz.

### 12.3 TASKS 026 §9.10 e TASKS 028 §9.3 — a regra da reancoragem

*"Reancorar contra uma implementação em andamento grava um número que muda no dia seguinte."* O
backend já tem essa disciplina escrita e exercida duas vezes. `R-SUI-05` é ela, aplicada à suíte
de tela, que nunca a teve.

---

## 13. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.4 | 2026-08-20 | **Um veredito meu, corrigido.** As faixas de seção não são defeito: a `R-DIV-03` pedia agrupamento **e** ordem da planilha, e a ESPEC 018 `R-REL-03` trocou a ordem pela do contrato, que não tem seções. `D-07` registra a revisão; a ESPEC 031 fica cancelada; `I-04` vira pergunta de produto |
| 1.3 | 2026-08-20 | **Os dois vereditos da E4.** O item crítico é deriva, e `R-PAN-07` fica revista (`D-06`, decidido pelo dono do produto). As faixas de seção são **defeito**, com regra nomeada e conserto fora de escopo — §2.6, `I-04` |
| 1.2 | 2026-08-20 | **A classificação (`P0`) fechou.** Nove dos dez são deriva com regra nomeada — ESPEC 019 `R-ADT-10` e ESPEC 018 `R-REL-01`/`D-01`; o décimo é o `14.049.00054.00`, e vai a veredito na F4. §2.3 corrigida: a frase da tela nunca mudou, só o número |
| 1.1 | 2026-08-20 | **Onze viraram dez.** A execução de fechamento da ESPEC 029 devolveu `R-PAN-04` ao verde: ele era colateral da regressão daquela entrega, não deriva antiga (§2.4). Suíte: 110 verdes, 10 vermelhos |
| 1.0 | 2026-08-20 | Redação inicial, a partir da execução completa da suíte durante a entrega da ESPEC 029. `R-SUI-01` nasce de uma exigência explícita do dono do produto: *"não pode regredir as evoluções que vieram depois"* |
