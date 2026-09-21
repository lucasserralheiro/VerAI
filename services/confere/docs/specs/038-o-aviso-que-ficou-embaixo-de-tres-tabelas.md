# ESPEC 038 — O aviso que ficou embaixo de três tabelas

| | |
|---|---|
| **Status** | **Proposta** |
| **Versão** | 1.0 — 2026-09-01 |
| **Depende de** | [ESPEC 008](008-acessibilidade-da-interacao.md), [ESPEC 009](009-analise-da-medicao.md), [ESPEC 021](021-a-celula-que-virou-1-1.md), [ESPEC 023](023-o-aviso-que-diz-o-que-fazer.md), [ESPEC 025](025-o-arquivo-que-nao-e-a-proposta.md), [ESPEC 027](027-a-planilha-que-o-confere-nao-leu.md) — implementadas |
| **Revisa** | A **âncora de posição** da `D-07` (ESPEC 021) e da `D-08` (ESPEC 023): as duas descrevem onde as ressalvas ficam *em relação ao bloco âmbar*, e o bloco âmbar sai do rodapé. **As duas seções não se movem** — muda a frase que as localiza. E `R-FON-10` (ESPEC 023), o contador de avisos da faixa: ele não desaparece, muda de lugar (`D-03`) |
| **Não toca** | O backend, o `.docx`, o `.xlsx`, a resposta da API, **quais** achados são emitidos e com que severidade, o estado `bloqueado`, o `CartaoDeAchado`, o `CartaoAgregado`, o `agruparPorValidacao` e a paleta. Esta espec muda **onde** se lê o que já é dito, e nada do que é dito |
| **Referência normativa** | `frontend/src/app/components/ResultadoPanel.tsx` em `45ee8fb`; as âncoras do piloto/SMIT na suíte de navegador — `smoke.spec.ts:49`, `analise.spec.ts:50-73`, `derivadas.spec.ts:8` |
| **Origem** | *"Agindo como engenheiro de softwares sênior e especialista em ux e ui é possível as mensagens de aviso serem exibidas na parte de cima da tela afim de deixar mais claro para os usuários os avisos"* — com a captura de um relatório do SMUL em que o bloco âmbar é a última coisa da página |

---

## 1. Problema

**O aviso é a última coisa da tela, e chega depois da decisão que ele deveria informar.**

A captura que originou esta espec termina assim — e *termina* é literal, não há nada abaixo:

```
Os demais itens do aditivo fecharam e por isso não aparecem aqui.

V-MED-03  código 14.031.00023.00 aparece 2 vezes no levantamento sem bloco de
          desconto identificado — foi usada a última ocorrência (linha 120, medida 793)
```

Leia o que esse aviso diz. O código aparece duas vezes na planilha, nenhuma das duas ocorrências
traz a marca de desconto, e o sistema **escolheu uma delas por posição** — a última. É a rede da
`R-MED-02`, cuja razão de existir está escrita no próprio código: *"o cliente não paga por servidor
de desenvolvimento"*. O aviso informa que **um número do relatório pode ser o outro**.

Esse número já foi impresso no `.docx`. O botão que baixa o `.docx` está no topo da tela. O aviso
está no fim, depois de tudo o que a pessoa acabou de conferir.

### 1.1 O que fica entre a faixa de resultado e o bloco âmbar

Ordem de renderização hoje, `ResultadoPanel.tsx:245-327`, com as contagens do piloto ancoradas na
suíte:

| # | Bloco | Linha | Conteúdo no piloto | Âncora |
|---|---|---|---|---|
| 1 | Faixa de resultado, **com os dois botões de download** | 247 | `36 de 58 itens com divergência` | `smoke.spec.ts:49` |
| 2 | Painel de análise | 285 | 58 itens em quatro blocos, **os quatro fechados** | `analise.spec.ts:50-73`, `119-135` |
| 3 | Grid de divergências | 287 | **36 linhas** de tabela | `smoke.spec.ts:49` |
| 4 | Linhas derivadas | 302 | **4 linhas** de tabela | `derivadas.spec.ts:8` |
| 5 | Divergência de fonte | 317 | 0 a 5 linhas, conforme o aditivo | ESPEC 023 §2.3 |
| 6 | **Avisos** | **322** | **o bloco âmbar** | — |

Quarenta linhas de tabela, três contêineres de rolagem horizontal e duas seções inteiras separam o
botão de baixar do aviso sobre o que foi baixado. Os quatro blocos da análise nascem fechados
justamente por essa aritmética — o comentário do `analise.spec.ts:115-118` diz que fechados *"o
grid não é empurrado para fora da primeira tela por ~92 linhas de detalhe"*. A mesma preocupação
nunca alcançou o bloco que ficou embaixo do grid.

### 1.2 O próprio produto já faz o contrário, a dez linhas de distância

No estado `bloqueado`, `ResultadoPanel.tsx:237-238`:

```tsx
<ListaDeAchados achados={estado.bloqueantes} tom="bloqueio" />
<ListaDeAchados achados={estado.avisos} tom="aviso" />
```

Bloqueantes e **avisos**, no topo, antes de qualquer outra coisa. É o mesmo componente, a mesma
lista, o mesmo tipo `Achado` — e a posição oposta. Não há decisão registrada escolhendo as duas: o
estado `bloqueado` foi desenhado com a gravidade em cima, e o `pronto` herdou o rodapé da ESPEC 002,
quando o bloco âmbar era a única coisa que existia abaixo do grid.

### 1.3 É o único bloco da tela sem cabeçalho

Medido por leitura de `frontend/src/app/components/`:

| Bloco | Cabeçalho | `id` |
|---|---|---|
| Faixa de resultado | `h2` *Relatório gerado* | — |
| Painel de análise | `h2` | `titulo-analise` |
| Grid de divergências | `h2` *Divergências, na ordem do relatório* | `divergencias` (`h3` sr-only) |
| Linhas derivadas | `h2` | `titulo-derivadas` |
| Divergência de fonte | `h2` | `titulo-divergencia` |
| **Avisos** | **nenhum** | **nenhum** |

O bloco é um `<div>` com um `<ul>` dentro (`ResultadoPanel.tsx:322-326`). Duas consequências, e a
segunda não é estética:

* quem lê com os olhos encontra um cartão amarelo solto, sem nada que diga o que aquilo é —
  exatamente o que a captura mostra;
* **quem navega por cabeçalhos não o alcança.** A navegação por títulos é o percurso que a ESPEC 008
  §13 assume, e nesse percurso o último título da tela é *Divergência de fonte*. O que vem depois
  dele só existe para quem continuar tabulando ou rolando até o fim.

### 1.4 A contagem está em cima e o conteúdo embaixo

A faixa escreve, em `ResultadoPanel.tsx:259-260`:

```
36 de 58 itens com divergência entre contratado e medido · 2 aviso(s) registrado(s)
```

O leitor é informado no topo de que **existem** dois avisos e precisa procurá-los no fim da página.
O contador é a `R-FON-10` da ESPEC 023, e ela está certa no que quis — *contar o que é exibido* —,
mas o que ela produziu foi um índice remissivo sem página de destino. O `aviso(s)`, de quebra, é o
plural entre parênteses que a `R-PER-07` proíbe no resto da tela.

---

## 2. O que foi levantado

### 2.1 O bloco não é raro

Treze validações podem emitir `Severity.AVISA` (varredura em `backend/src/infrastructure/validations/`):

| Arquivo | Validações |
|---|---|
| `contract_validations.py` | `V-CTR-04`, `V-CTR-05`, `V-CTR-06`, `V-CAP-01`, `V-ADT-02`, `V-ADT-04` |
| `measurement_validations.py` | `V-MED-02`, `V-MED-03`, `V-MED-04` |
| `annex_validations.py` | `V-ANX-01`, `V-ANX-02` |
| `identity_validations.py` | `V-IDT-01`, `V-IDT-03` |

Nenhuma delas impede a geração — todas convivem com o estado `pronto`, que é o estado em que o
bloco está no rodapé.

### 2.2 Nenhum teste de navegador exercita o bloco no estado `pronto`

As duas afirmações que a suíte faz sobre avisos — `achados-agregados.spec.ts` e o dublê de
`estados.ts:140-170` — são no estado **bloqueado**, onde o bloco já está no topo. Os dois dublês que
montam um `pronto` sintético zeram a lista de propósito (`estados.ts:435`, `corpo.avisos = []`,
pela `R-FON-09`).

Não é falha de cobertura a corrigir aqui: é o motivo de a posição ter atravessado seis especs sem
ninguém tropeçar nela. E é o que o portão `P0` desta espec passa a exigir.

### 2.3 Mover bloco por ordem de leitura é precedente do projeto

O `DivergenciaGrid.tsx:199-209` registra o caso anterior, sobre o item sem previsão contratual:

> *"Muda a **posição**, como a ESPEC 008 `D-07` já mudou uma vez — naquela ela veio do fim do grid
> para o topo, nesta vai para a categoria que a nomeia."*

Um bloco já subiu do fim para o topo neste produto, pela mesma razão: o achado de maior consequência
não pode vir depois da lista inteira.

---

## 3. Objetivo

Que o aviso seja lido **antes** de o relatório ser usado, e não depois — no mesmo campo visual do
botão que baixa o documento que ele ressalva.

Não-objetivo: mudar o texto dos avisos, quais são emitidos, sua severidade ou sua ordem interna.
Nada do que é dito muda; muda onde se lê.

---

## 4. Escopo

### 4.1 Dentro do escopo

* A posição do bloco de avisos no estado `pronto`;
* Um cabeçalho e uma frase de contexto para o bloco, que hoje não tem nenhum dos dois;
* A contagem, que sai da faixa e vai para o cabeçalho do bloco;
* Os dois comentários de `ResultadoPanel.tsx` que localizam as ressalvas *pelo bloco âmbar* e
  passariam a mentir.

### 4.2 Fora do escopo

* **O backend inteiro.** Nenhum arquivo de `backend/src/` é tocado, e o portão `P3` mede isso;
* O estado `bloqueado`, onde a ordem já é a desta espec;
* O formato dos cartões — oito das treze validações da §2.1 ainda mandam só `mensagem`, e é a
  entrega inacabada da ESPEC 025 `R-DOC-05` (`I-01`), não esta;
* A posição de `LinhasDerivadas` e `DivergenciaDeFonte`, que não se movem (`R-AVI-06`);
* Cor, token ou severidade nova (`R-AVI-08`).

---

## 5. Regras

| ID | Regra |
|---|---|
| `R-AVI-01` | No estado `pronto`, o bloco de avisos é renderizado **imediatamente abaixo da faixa de resultado e acima do painel de análise**. É o primeiro conteúdo depois dos botões de download |
| `R-AVI-02` | O bloco tem **cabeçalho próprio**, com a contagem, e uma frase que diz o que ele é. Sem cabeçalho ele é inalcançável por navegação de títulos (§1.3) |
| `R-AVI-03` | O bloco **só existe quando há aviso**. Seção permanente com "nenhum aviso" treina a pessoa a ignorar o lugar — precedente da `R-FON-11` e da `R-PER-10` |
| `R-AVI-04` | A contagem aparece **uma vez**. Saindo da faixa (`R-FON-10` revista) e indo para o cabeçalho, ela passa a ficar a zero pixels do que conta |
| `R-AVI-05` | A frase de contexto diz que **o relatório foi gerado assim mesmo**. Bloco âmbar no topo, ao lado de um botão de download, precisa desfazer a leitura de bloqueio que a posição nova cria (`D-06`) |
| `R-AVI-06` | `LinhasDerivadas` e `DivergenciaDeFonte` **não se movem**. A ordem da `R-PAN-01` — gravidade, depois seções, depois ressalvas — é preservada, e reforçada: o aviso é gravidade, não ressalva |
| `R-AVI-07` | O bloco **não** ganha `role="alert"`. O painel inteiro já está dentro de uma região `aria-live="polite"` (`R-ACE-13`), e um papel de alerta ali produziria anúncio duplo e interrupção. O cabeçalho entra na hierarquia **sem salto de nível** — `h2`, irmão dos demais títulos de seção |
| `R-AVI-08` | Nenhuma cor, token ou severidade nova. O âmbar do `CartaoDeAchado` é o mesmo, e a distinção bloqueio/aviso continua sendo a única do eixo |
| `R-AVI-09` | O estado `bloqueado` fica exatamente como está |

---

## 6. Decisões

### `D-01` — O bloco sobe inteiro, e não um resumo com link

A alternativa barata era deixar o bloco onde está e pôr, na faixa, *"2 avisos — ver abaixo"* com
âncora. Ela custa o que a `D-06` da ESPEC 023 nomeou: o mesmo fato na tela duas vezes, em duas
formas, para divergirem depois. E não resolve o problema — continua exigindo que a pessoa vá até o
fim para saber **o que** o aviso diz, que é a única coisa que importa.

### `D-02` — Acima do painel de análise, e não entre o painel e o grid

O painel de análise é a triagem do relatório: ele classifica os 58 itens por gravidade. O aviso é
sobre **a leitura que produziu esses 58 itens** — o `V-MED-03` diz que uma linha pode ter vindo da
ocorrência errada. Ele antecede a triagem porque qualifica a triagem inteira.

O argumento decisivo, porém, é outro: **os botões de download estão na faixa.** O caminho mais curto
da tela é gerar e baixar, e nesse caminho o aviso tem de estar adjacente ao botão que ele ressalva.
Um bloco entre o painel e o grid já estaria fora da primeira tela.

### `D-03` — A contagem muda de lugar, e a `R-FON-10` fica cumprida, não revogada

A `R-FON-10` pediu que o contador da faixa *"contasse o que é exibido"*. Com o bloco a quarenta
linhas de distância, o contador cumpria a letra e não a intenção: dizia quantos existem sem mostrar
nenhum. No cabeçalho do bloco, o número e o conteúdo são a mesma coisa vista de perto — e o
`aviso(s)` entre parênteses morre junto, resolvido pelo singular e pelo plural de verdade.

Deixar os dois seria contar duas vezes o que agora está a um palmo de distância.

### `D-04` — Cabeçalho `h2`, e não `h3`

Ele é irmão de *Relatório gerado*, do painel de análise, do grid e das duas seções finais — todos
`h2`. Um `h3` afirmaria subordinação a algum deles, que não existe. E o teste de hierarquia
(`a11y-estrutura.spec.ts:141`) proíbe salto de nível: entre dois `h2`, um `h2` entra sem salto e um
`h3` também — mas só o `h2` diz a verdade sobre a estrutura.

### `D-05` — As `D-07` (021) e `D-08` (023) perdem a âncora, não a decisão

As duas dizem que a seção delas *"ocupa o lugar do bloco âmbar"*. Era uma frase sobre **posição
relativa**, num tempo em que o bloco âmbar era o último elemento da tela — servia como marco
geográfico, não como decisão sobre o bloco.

O que aquelas decisões quiseram continua valendo, e sem uma vírgula de mudança: ressalva vem depois
do que ela ressalva. `LinhasDerivadas` fica depois do grid; `DivergenciaDeFonte` fica depois dela.
O que muda é que as duas passam a ser descritas pelo que **são** — as últimas seções da tela — e não
pela vizinha que se mudou.

Os dois comentários entram no mesmo `diff`. Comentário que aponta para uma âncora que saiu é a forma
mais barata de a próxima pessoa reconstituir a ordem errada.

### `D-06` — A frase de contexto existe para desfazer a leitura de bloqueio

É o risco que esta mudança cria, e ele é real: âmbar, no topo, encostado num botão — a gramática
visual disso, na tela de bloqueio do mesmo produto, significa *não baixe*. A frase resolve dizendo o
que **não** é antes de dizer o que é: o relatório foi gerado, nada aqui o impede, e ainda assim
convém conferir antes de faturar.

Sem ela, a entrega troca um aviso que ninguém lê por um aviso que assusta — que é pior.

### `D-07` — Sem `role="alert"`, contra o instinto

Alerta interrompe. Aviso que não impede nada não interrompe ninguém, e a região `aria-live="polite"`
que envolve o painel desde a ESPEC 008 já anuncia o conteúdo quando ele chega. Acrescentar o papel
faria o leitor de tela ouvir a mesma coisa duas vezes, uma delas cortando o que estivesse sendo
lido.

---

## 7. O que muda no código

| Arquivo | Mudança |
|---|---|
| `frontend/src/app/components/ResultadoPanel.tsx` | O bloco de avisos sai da linha 322 e entra depois da faixa, com `<section aria-labelledby>`, `h2` com contagem e frase de contexto; a faixa perde o sufixo do contador; os comentários das linhas 293-301 e 309-316 deixam de citar o bloco âmbar como âncora |
| `frontend/e2e/estados.ts` | Um dublê `prontoComAvisos`, no molde do `comDivergencias` (`estados.ts:414-447`): intercepta o corpo real de 200 e injeta a lista de avisos |
| `frontend/e2e/` | O spec novo do portão `P0` |
| `backend/`, `frontend/src/lib/`, demais componentes | **Nenhuma** |

Nenhum tipo muda: `RespostaRelatorio.avisos` já é o que é.

---

## 8. Testes e portões

* **`P0` — A ordem, afirmada.** Teste novo: com avisos presentes, o cabeçalho do bloco precede
  `#titulo-analise` no documento. A técnica é a que a suíte já usa em `analise.spec.ts:84-99` e em
  `a11y-estrutura.spec.ts:208-230` — `compareDocumentPosition`, não coordenada de pixel.
* **`P1` — O bloco é alcançável por cabeçalho.** `getByRole("heading")` o encontra, e a hierarquia
  continua sem salto (`a11y-estrutura.spec.ts:141`, já existente, tem de seguir verde).
* **`P2` — A contagem aparece uma vez.** Duas ocorrências do número na tela é a `R-AVI-04`
  violada — e é o modo de falha mais provável de uma entrega feita às pressas.
* **`P3` — `git diff --stat backend/` vazio.**
* **`P4` — `axe` verde** no estado `pronto` **com** avisos, que hoje nenhuma varredura cobre (§2.2).
  O dublê novo entra em `ESTADOS` (`estados.ts:459`) e a varredura o pega pelo caminho
  parametrizado que a ESPEC 023 abriu.
* **`P5` — `smoke` verde.** A faixa perde só o sufixo; `/36.*de 58 itens com divergência/`
  (`smoke.spec.ts:49`) não é tocado. Se este reprovar, a faixa mudou mais do que devia.

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Âmbar no topo ser lido como bloqueio | `R-AVI-05` e `D-06` — a frase diz que o relatório foi gerado antes de dizer o que conferir |
| Muitos avisos empurrarem o relatório para fora da primeira tela | A agregação da `R-LEV-08` já reduz *n* achados da mesma validação a um cartão. Acima de um punhado, é `I-02` — e é problema que só existe porque o bloco passou a ser visto |
| Os comentários das ressalvas ficarem apontando para uma âncora que saiu | `D-05` — os dois entram no mesmo `diff` |
| A entrega virar redesenho do cartão | §4.2 e `I-01`. O formato dos cartões não é tocado nesta espec |
| Duplicar a contagem por esquecer de tirá-la da faixa | Portão `P2` |

---

## 10. Pontos em aberto

* **`I-01`** — oito das treze validações da §2.1 usam `registrar` e não `registrar_em_partes`: seus
  cartões saem sem título, com a sigla `V-MED-03` visível e o texto técnico no meio da frase, que é
  exatamente o que a ESPEC 025 §1 removeu dos outros. Subir o bloco torna isso **mais** visível, e é
  entrega própria — a `R-DOC-05` aplicada às que ficaram para trás.
* **`I-02`** — há um número de avisos a partir do qual o bloco deve recolher-se (`<details>`, como
  os quatro da análise)? Só se responde com um par real que produza muitos.
* **`I-03`** — a `Barra` fixa mostra o placar de divergências e não menciona avisos. Vale um
  indicador ali, agora que a contagem saiu da faixa? É `R-CAB-05`/`R-CAB-06`, e é outra decisão.
* **`I-04`** — o manual (`scripts/conteudo_do_manual.py`) descreve a tela com o bloco no fim? A
  ESPEC 023 §2.5 já achou o manual desatualizado uma vez, e não foi conferido nesta.

---

## 11. Relação com as especs anteriores

### 11.1 ESPEC 009 `R-PAN-01` — a regra é cumprida, não contrariada

*"Gravidade, depois seções, depois ressalvas."* O bloco âmbar no rodapé era a exceção não declarada:
um achado de validação — a mesma coisa que o estado `bloqueado` põe em primeiro lugar — servido
depois das seções e das ressalvas. Esta espec não muda a ordem; põe o aviso no degrau que ele já
tinha.

### 11.2 ESPEC 021 `D-07` e ESPEC 023 `D-08` — âncora, não decisão

§6 `D-05`. As duas seções ficam onde estão.

### 11.3 ESPEC 008 `D-07` — o precedente literal

Um bloco já subiu do fim do grid para o topo, e pela mesma razão (§2.3). Aquela mudança foi
registrada no código que a executou e sobreviveu a duas revisões de posição desde então.

### 11.4 ESPEC 025 e 027 — o que elas fizeram com o cartão, esta faz com o bloco

A 025 tirou o vocabulário do sistema de dentro do cartão; a 027 juntou *n* cartões de uma validação
em um. As duas trabalharam a **peça**. Nenhuma olhou para onde a pilha estava.

---

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | `ResultadoPanel.tsx`: posição, cabeçalho, frase, contador e os dois comentários | PP |
| B | Dublê `prontoComAvisos` e entrada em `ESTADOS` | PP |
| C | O spec do `P0`/`P1`/`P2` e a varredura `axe` do `P4` | P |

**Total: meio período.** É uma entrega pequena de propósito — o risco dela não está no tamanho, está
em `D-06`.

---

## 13. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-09-01 | Redação inicial, a partir da captura de um relatório do SMUL em que o `V-MED-03` é o último elemento da página. A investigação achou dois fatos que a pergunta original não continha: o bloco é o único da tela **sem cabeçalho** (§1.3), e o mesmo componente já põe avisos no topo no estado `bloqueado` (§1.2) |
