# PLANO 016 — Implementação da Verificação por Tecnologia Assistiva

| | |
|---|---|
| **Especificação** | [ESPEC 016](../specs/016-verificacao-por-tecnologia-assistiva.md) v1.1 |
| **Versão** | 1.0 — 2026-08-12 |
| **Estado inicial** | 66 testes de navegador verdes · 379 de backend · `axe` e contraste limpos em cinco estados × duas larguras · **cinco mecanismos de anúncio, zero escutados** · `P2` da ESPEC 008 aberto desde 2026-08-07 · T-416 afirmando a constante `1` |

---

## 1. O princípio que ordena este plano

Este plano não entrega funcionalidade: entrega **instrumento**. E instrumento tem um modo de falha
que funcionalidade não tem — ele não quebra, ele **aprova**.

O projeto já pagou por isso uma vez. O TASKS 013 §12.1 registrou um comparador que nasceu cego e
devolvia zero divergências sobre um arquivo visivelmente errado; se o portão não exigisse vê-lo
reprovar, ele teria entrado na entrega aprovando qualquer coisa.

**Aqui o modo de falha é específico e tem nome:**

> Se o inventário for escrito **a partir do DOM**, as duas direções de `R-TA-10` passam por
> construção. "Todo mecanismo do DOM tem entrada" e "toda entrada tem mecanismo" viram tautologias,
> e o teste inteiro não afirma nada.

O inventário tem de ser escrito **a partir das regras** — `R-ACE-13`, `R-ACE-14`, `R-ACE-16`,
`R-LMP-10` — que dizem o que **deve** ser anunciado. O DOM é a outra ponta da comparação, nunca a
fonte. Onde os dois discordarem, isso é achado — possivelmente defeito real.

E há um segundo ordenamento, que a ESPEC 016 §8.4 já inverteu e que este plano leva às últimas
consequências:

> **A escuta vem primeiro porque é a única fase que pode mudar o desenho das outras.**

A §6 mostra que ela já mudou: lendo o código para planejar, a estrutura de regiões vivas revelou-se
diferente da que a espec descreveu, e a regra central (`R-TA-02`) **não se aplica a dois dos cinco
mecanismos**. Automatizar antes de ouvir seria escrever meio dia de teste sobre uma premissa.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P1 — a escuta, uma vez** | Fim da F0 | Os cinco passos da ESPEC 016 §8.3, com o par leitor+navegador registrado. Produz **observações**, não só um "passou" | Se algum passo for silêncio, há defeito de anúncio — e ele vira entrega própria (`I-20`), não conserto de passagem |
| **P2 — instrumento verificado** | Fim da F2 | `R-TA-02`, `R-TA-10` e `R-TA-11` verdes — **e vistos reprovar** contra o defeito que cada um vigia | Instrumento que nasce verde não prova nada. Corrigir o instrumento antes de confiar nele |
| **P3 — nada regrediu** | Fim da F4 | A tabela inteira da ESPEC 016 §8.2, **numa única execução**. Captura **idêntica** em todos os estados | Não entregar. Uma spec de verificação que muda um pixel deixou de ser uma spec de verificação |

**`P1` não pode reprovar a entrega** — ele é medição, como o `P1` do PLANO 012. Mas pode
**redesenhá-la**, e é por isso que vem antes.

---

## 3. Fases

### F0 — A escuta `[portão]` `[nenhum arquivo é tocado]`

**Objetivo:** ouvir a aplicação pela primeira vez. Cinco minutos que estão pendentes desde
2026-08-07.

| # | Tarefa | Ref. |
|---|---|---|
| T-1000 | Ligar o leitor e **registrar o par** — `Ctrl+Win+Enter` para o Narrador, ou NVDA se disponível | `R-TA-03`, `D-01` |
| T-1001 | Percorrer os cinco passos da ESPEC 016 §8.3, anotando **o que se ouviu**, não só se houve som | `R-TA-04`, **P1** |
| T-1002 | **[risco]** Responder a pergunta que a §6.2 abriu: o `role="alert"` **aninhado** dentro da região `polite` é anunciado uma vez, duas, ou nenhuma? | §6.2 |
| T-1003 | Registrar as observações em TASKS 016, incluindo o que soou **errado sem ser silêncio** — texto truncado, ordem trocada, leitura dupla | **P1** |

**Verificação:** existe um registro escrito do que foi ouvido, passo a passo, com o leitor nomeado.

> **A T-1003 é a que se perde com mais facilidade.** O portão pergunta *"ouviu?"*, e a resposta
> natural é "sim" ou "não". Mas o achado caro desta fase não é o silêncio — silêncio é óbvio e a
> automação da F2 o pegaria. O achado caro é o anúncio que **acontece e está errado**: lido pela
> metade, na ordem trocada, ou duas vezes. Nada automatizado distingue isso de sucesso.

> **Quem escutar nunca mais será ingênuo.** Depois da primeira sessão a pessoa já sabe o que
> esperar ouvir, e passa a ouvir o que espera. A anotação da T-1001 vale mais na primeira vez do
> que em qualquer repetição — é o `I-18` da espec noutra roupa.

**Tamanho:** PP — cinco minutos, mais o registro. **Encerra:** P1. **Insumo:** `K-13`.

---

### F1 — O inventário, escrito das regras

**Objetivo:** ter a lista do que **deve** ser anunciado, independente do que o DOM faz.

| # | Tarefa | Ref. |
|---|---|---|
| T-1004 | **[risco]** Escrever `e2e/inventario-de-anuncios.ts` **a partir das regras** — `R-ACE-13`, `R-ACE-14`, `R-ACE-16` e `R-LMP-10`. **Não abrir o DevTools para preenchê-lo** — §1 | `R-TA-01`, `D-06` |
| T-1005 | Cada entrada declara: mecanismo, estado que dispara, **espécie** (`mutada` ou `inserida` — ver §6.1), fala esperada e se é automatizável | `R-TA-01`, `R-TA-06` |
| T-1006 | Confrontar o inventário com o DOM **à mão, uma vez**, e registrar as divergências. Divergência é achado, não erro de digitação a corrigir em silêncio | §1 |
| T-1007 | A lista de entradas **não automatizáveis** tem de coincidir com os passos da §8.3 da espec. Se divergir, um dos dois está desatualizado | `R-TA-06` |

**Verificação:** o inventário existe, foi escrito das regras, e as divergências contra o DOM estão
nomeadas — não absorvidas.

> **A T-1004 é onde este plano mais pode falhar em silêncio.** Preencher o inventário olhando o DOM
> é o caminho de menor resistência, produz um arquivo que parece certo, e faz `R-TA-10` passar sem
> afirmar nada. O sintoma é ausência de sintoma: nenhum teste fica vermelho, e o instrumento nasce
> inútil. É o defeito da T-801 do PLANO 013 com outro rosto.

**Tamanho:** P — duas horas.

---

### F2 — Os testes de mecanismo `[portão]`

**Objetivo:** distinguir mutação de inserção, para as entradas em que isso importa.

| # | Tarefa | Ref. |
|---|---|---|
| T-1008 | `e2e/anuncio.spec.ts` — identidade de nó para as entradas de espécie **`mutada`** | `R-TA-02` |
| T-1009 | **[risco]** Para as entradas de espécie **`inserida`** (`role="alert"`), asserir o que de fato importa: a região aparece, tem o papel certo e traz a mensagem. **Não** aplicar identidade de nó — §6.1 | `R-TA-02`, §6.1 |
| T-1010 | **Ver o teste reprovar**: mover a região viva para dentro do retorno condicional e conferir que a T-1008 fica vermelha, pelo motivo certo | **P2** |
| T-1011 | `R-TA-10` nos dois sentidos, varrendo os **cinco** estados de `estados.ts` | `R-TA-10` |
| T-1012 | **Ver o `R-TA-10` reprovar** nas duas direções: remover uma entrada do inventário, e acrescentar uma entrada fantasma | **P2** |
| T-1013 | **[risco]** Conter o custo: `pronto` e `erro` custam ~30 s de geração real cada. Reaproveitar a resposta capturada, como `estados.ts::situacaoVazia` já faz, em vez de gerar por teste | §5.3 |

**Verificação:** P2 fecha com os quatro modos de falha vistos — T-1010 e T-1012.

> **A T-1009 é a correção que a §6.1 obriga**, e ela é contraintuitiva: para `role="alert"`,
> **inserir é o comportamento correto**. Aplicar identidade de nó ali afirmaria o oposto do que a
> norma prevê, e o teste ficaria vermelho contra código certo — o modo de falha que corrói mais
> rápido a confiança numa suíte.

**Tamanho:** M — meio dia.

---

### F3 — A T-416 sem número mágico

**Objetivo:** a contagem passar a vir do inventário.

| # | Tarefa | Ref. |
|---|---|---|
| T-1014 | Reescrever a T-416 de [`a11y-estrutura.spec.ts:19-23`](../../frontend/e2e/a11y-estrutura.spec.ts#L19-L23): a constante `1` sai, a contagem do inventário entra | `R-TA-11`, ESPEC 016 §12.3 |
| T-1015 | **A reescrita tem de sair mais forte.** Hoje ela passa com uma região viva no lugar errado, desde que seja uma. Depois: cada região existe, é a declarada, e está no estado declarado | ESPEC 016 §12.3 |
| T-1016 | Decidir o destino do `R-LMP-13` da ESPEC 015 — o teste que registrou por que o anúncio da limpeza usa `role="status"`. Absorver ou manter; **manter é a escolha conservadora** | ESPEC 016 §12.3 |

**Verificação:** a T-416 falha se uma região viva declarada sumir, e **não** falha quando uma
região legítima nova é acrescentada ao inventário.

> **A tentação da T-1015 é trocar `toHaveCount(1)` por `toHaveCount(inventario.length)` e chamar de
> feito.** Isso troca uma constante por outra igualmente cega: continuaria passando com as regiões
> certas em número e erradas em identidade. O que a reescrita tem de afirmar é a **correspondência**,
> não a cardinalidade.

**Tamanho:** PP — uma hora.

---

### F4 — Regressão `[portão]`

**Objetivo:** provar que um plano que não toca `src/` de fato não mudou nada.

| # | Tarefa | Ref. |
|---|---|---|
| T-1017 | Capturar a linha de base **antes da F1** — `capturar-baseline.mjs referencia-016`. **Irrecuperável se pulada** — §5.4 | **P3** |
| T-1018 | A tabela inteira da ESPEC 016 §8.2, **numa única execução**: nove suítes, backend intocado, `tsc`/`lint`/`build` | **P3** |
| T-1019 | Captura "depois" e comparação: **idêntica em todos os estados, nas duas larguras**. Zero exceções sancionadas | **P3** |
| T-1020 | Conferir a saúde do ambiente **imediatamente antes** da execução longa: backend `200`, frontend `200` **e o conteúdo servido**, não só o status | §5.5 |

**Verificação:** P3.

> **A T-1017 pertence à F4 e roda antes da F1.** Está listada aqui porque é do portão P3, e roda
> lá atrás porque a captura não é versionada — depois da primeira linha alterada, a referência é
> irrecuperável. A F0 não conta: ela não toca arquivo nenhum.

**Tamanho:** P — três horas, quase todas de espera.

---

### F5 — Documentação

| # | Tarefa |
|---|---|
| T-1021 | **ESPEC 016:** status → implementada; §2.2 corrigida com a estrutura real das regiões (§6.1 e §6.2); `R-TA-02` emendada para distinguir espécie |
| T-1022 | **ESPEC 008:** `P2` **fechado**, com o registro do que foi ouvido e do par usado. É a pendência mais antiga do projeto |
| T-1023 | **ESPEC 015:** `K-10` fechado; destino do `R-LMP-13` registrado |
| T-1024 | CHANGELOG: o que a primeira escuta revelou — e é isso que vale registrar, não o instrumento |
| T-1025 | TASKS 016 com resultado, desvios e as observações da T-1003 |

**Tamanho:** P — duas horas.

---

## 4. Sequência

```
T-1017 ──► F0 ──► F1 ──► F2 ──► F3 ──► F4 ──► F5
(captura)   P1    (das    P2                  P3
            │     regras)
            └─ pode redesenhar F1 e F2
```

Linear, e a dependência da F0 é de **conteúdo**, não de ordem técnica: as observações dela mudam o
que o inventário declara e o que os testes afirmam.

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | 1 a 1,5 dia |

**A F0 custa cinco minutos e trava tudo o mais.** Não por ser cara, mas por ser a única que pode
invalidar o desenho das outras — e por depender de uma pessoa (`K-13`).

---

## 5. A regressão que já está escrita

Lida no repositório, não presumida.

### 5.1 O que quebra — e é **um** teste, de propósito

| Asserção | Quebra? | Por quê |
|---|---|---|
| T-416 — `toHaveCount(1)` | **Sim, e é o objeto da F3** | É a constante que `R-TA-11` aposenta |
| `R-LMP-13` da ESPEC 015 | **Não quebra**, mas fica redundante | T-1016 decide. Ele afirma que existe um `[aria-live="polite"]`; com a contagem vinda do inventário, deixa de ser a única defesa |

### 5.2 O que **não** quebra, e é bom saber por quê

| Asserção existente | Sobrevive? | Por quê |
|---|---|---|
| As 8 outras suítes de navegador | **Sim** | `frontend/src/` não é tocado. **Se alguma quebrar, este plano saiu do escopo que declarou** — é o melhor sinal que a suíte tem |
| `axe`, contraste, teclado | **Sim** | Consomem `ESTADOS`, que não muda |
| `limpar.spec.ts` · `vazamento.spec.ts` | **Sim** | A ESPEC 015 não é tocada, salvo o `R-LMP-13` da T-1016 |
| 379 testes de backend | **Sim** | Nenhum arquivo de `backend/` entra em tarefa nenhuma |
| Comparação de captura | **Sim, idêntica** | Nenhuma mudança de aparência — é o critério de §8.2 da espec |

### 5.3 O custo escondido: os testes novos geram relatório de verdade

`estados.ts::pronto` e `::erro` disparam geração real, ~30 s cada. Um `anuncio.spec.ts` ingênuo —
um teste por entrada do inventário, cada um montando seu estado — acrescentaria **três a quatro
gerações**, ~2 min à suíte.

Não é proibitivo, e é evitável: `estados.ts::situacaoVazia` já demonstra o padrão de **gerar uma
vez e reemitir a resposta capturada** com `route.fulfill`. A T-1013 o aplica.

Registrado porque a suíte já leva 20,5 min, e crescimento de tempo de suíte é o custo que ninguém
mede até ele doer.

### 5.4 A captura de referência é irrecuperável

`capturar-baseline.mjs:8` registra que as capturas **não são versionadas**. A pasta `referencia`
existente é da ESPEC 015 e foi tirada num `.next` anterior — a §12.3 do TASKS 015 mostra que ela já
acumulou deriva de ambiente (logo e rodapé, `next/image`).

**Uma referência nova é obrigatória**, e tem de ser tirada antes da F1. É a T-1017.

### 5.5 O ambiente derrubou duas execuções na entrega anterior

O TASKS 015 §12.2 registra dois casos em que a suíte falhou por ambiente e o sintoma foi
indistinguível de defeito da entrega: `.next` corrompido (`GET / 500`) e backend encerrado junto
com a sessão.

A T-1020 é a emenda de procedimento: conferir **o conteúdo servido**, não só o `200`. Um `200`
sozinho não distingue "subiu" de "subiu quebrada".

---

## 6. Dois acertos à ESPEC 016 — e o primeiro invalida uma regra

Seguindo a conduta da ESPEC 007 §13. Os dois saíram de ler
[`ResultadoPanel.tsx:70-120`](../../frontend/src/app/components/ResultadoPanel.tsx#L70-L120) para
planejar, e nenhum estava visível quando a spec foi escrita.

### 6.1 `R-TA-02` não vale para dois dos cinco mecanismos

A regra diz: *"toda região viva tem teste mecânico de que ela é **mutada, não inserida**"*.

**Para `role="alert"` isso é o oposto do correto.** Um `alert` é uma região viva assertiva e atômica
cujo padrão de uso **é** aparecer: ele existe para interromper. Aplicar identidade de nó aos
mecanismos 2 e 3 do inventário afirmaria que eles não podem ser inseridos — e o teste ficaria
vermelho contra código certo, que é o modo de falha que mais rápido ensina a ignorar uma suíte.

Emenda proposta a `R-TA-02`, a aplicar na T-1021:

> Toda região viva declara sua **espécie**. As de espécie `mutada` — `aria-live="polite"`,
> `role="status"` — têm teste de identidade de nó. As de espécie `inserida` — `role="alert"` — têm
> teste de que aparecem com o papel e a mensagem certos.

A T-1005 e a T-1009 já nascem com a correção.

### 6.2 As regiões estão **aninhadas**, e ninguém sabe o que isso produz

A §2.2 da espec listou cinco mecanismos numa lista plana. A estrutura real não é plana:

```
<div aria-live="polite" aria-atomic="false">     ← região 1, sempre montada
    inicial      → (vazio)
    processando  → <p sr-only>…</p>              ← mutação da região 1
    erro         → <section role="alert">        ← região ANINHADA na 1
    bloqueado    → <section role="alert">        ← região ANINHADA na 1
    pronto       → <section>…</section>          ← mutação da região 1
</div>

<p role="status">                                ← região 2, independente (page.tsx)
```

São **duas** regiões vivas de topo e **duas aninhadas**, não cinco irmãs.

E o aninhamento levanta uma pergunta que nenhum teste deste plano responde: **um `role="alert"`
(assertivo, atômico) inserido dentro de uma região `polite` não-atômica é anunciado uma vez, duas,
ou nenhuma?** O comportamento varia entre leitores, e ninguém deste projeto jamais ouviu.

É a T-1002, e é o argumento mais forte para a escuta vir primeiro: **é uma pergunta de estrutura,
levantada ao planejar, que só a F0 responde.** Se a resposta for "duas vezes", há defeito real na
tela — e ele é anterior a esta spec.

---

## 7. O que pode dar errado, e o que pega

| O que pode dar errado | O que pega | Quando |
|---|---|---|
| **O inventário ser escrito a partir do DOM** — `R-TA-10` vira tautologia | **Nada automático.** Só a disciplina da T-1004 e a revisão. É o risco central — §1 | F1 |
| Instrumento nascer verde e aprovar qualquer coisa | T-1010 e T-1012, que exigem ver reprovar nos **quatro** modos | F2 |
| Aplicar identidade de nó a `role="alert"` | §6.1. Teste vermelho contra código certo — e a resposta errada seria "afrouxar o teste" | F2 |
| A reescrita da T-416 sair **mais fraca** | Revisão da T-1015. Trocar uma constante por outra passa despercebido | F3 |
| **A escuta ser adiada uma terceira vez** | `K-13`. `D-02` da espec já diagnosticou: o portão foi adiado por ser ilimitado, e agora tem cinco passos | F0 |
| A escuta achar defeito e virar conserto de passagem | `I-20` da espec: defeito vira entrega própria. Uma spec de verificação que corrige perde o critério de "captura idêntica" | F0 |
| Pular a captura de referência | **Nada, e é irreversível** — §5.4 | antes da F1 |
| Ambiente cair no meio da execução longa | T-1020, conferindo conteúdo servido — §5.5 | F4 |
| A suíte engordar sem ninguém medir | T-1013, com o padrão de `situacaoVazia` — §5.3 | F2 |
| Alguma das 8 outras suítes quebrar | Elas mesmas. **Não deveria acontecer**: `src/` não é tocado. Se acontecer, o escopo declarado foi furado | F4 |

A primeira linha é a única sem rede automática, e é a mais importante do plano.

---

## 8. Insumos

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **K-13** | **Uma pessoa e cinco minutos** com o Narrador (`Ctrl+Win+Enter`) ou NVDA | T-1000 | **P1 não fecha, e o plano não começa.** É a quarta vez que este insumo é pedido; as três anteriores foram adiadas |
| **K-14** | Resposta ao `I-17` — JAWS entra? | — | Não bloqueia. `D-01` fixa um par gratuito |
| **K-15** | Decisão sobre `I-18` — a escuta deveria ser feita por uma pessoa cega usuária | — | Não bloqueia, e a resposta provavelmente é sim. Quem escreveu a fala é a pior pessoa para julgar se ela basta |

`K-13` é o único bloqueante, custa cinco minutos, não custa licença nem instalação — e é o motivo
de quatro portões estarem abertos em quatro especs.

---

## 9. O que este plano não faz

- **Não toca `frontend/src/`.** Nenhum arquivo, nenhuma tarefa. É a garantia que sustenta o P3, e
  a captura idêntica é quem cobra.
- **Não toca o backend.** 379 testes, contagem idêntica antes e depois.
- **Não corrige defeito que a escuta achar.** `I-20` — vira entrega própria. Misturar verificação e
  correção destrói o critério que mantém esta entrega honesta.
- **Não amplia a conformidade.** Nenhuma regra WCAG nova. O que muda é o instrumento, não a régua.
- **Não resolve a família "abrir no Excel"** — `P2` da ESPEC 009 e da 013, `I-19`. Mesmo padrão de
  adiamento, outro instrumento e outro avaliador.
- **Não simula leitor de tela.** `D-04` da espec: asserir a árvore de acessibilidade mede o que o
  navegador expõe, não o que o leitor fala — e a distância entre os dois é onde moram os defeitos
  que esta spec existe para pegar.
- **Não introduz dependência.** Nenhuma.