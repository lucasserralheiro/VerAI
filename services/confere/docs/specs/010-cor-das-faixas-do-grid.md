# ESPEC 010 — Cor das faixas do grid de divergências

| | |
|---|---|
| **Status** | **Implementada** |
| **Versão** | 1.0 — 2026-08-10 — escrita depois da implementação, registrando a iteração descartada |
| **Depende de** | [ESPEC 002](002-painel-de-divergencias.md), [ESPEC 005](005-identidade-confere.md), [ESPEC 008](008-acessibilidade-da-interacao.md) — todas implementadas |
| **Revisa** | `R-UI-01` da ESPEC 002 — ver §7 |
| **Referência normativa** | WCAG 2.1 nível AA, via `R-ACE-01` da ESPEC 008 |

---

## 1. Problema

As faixas de grupo e de seção do grid eram o **último elemento da interface no eixo navy puro**. Todo
o resto da tela já havia migrado: o botão primário é `teal-500`, o selo "Confere o utilizado" é
`brand.green`, a coluna **Quantidade Medida** é `teal-50`, o anel de foco é `teal-500`. As faixas
ficaram para trás porque vieram da ESPEC 002, que tratou de correspondência com o PDF, e não da
linha de ESPECs 005–008, que tratou da identidade em tela.

A `R-UI-01` justificava o navy assim:

> As faixas de seção usam o mesmo navy do relatório, **para que a correspondência com o PDF seja
> imediata**.

A justificativa é boa. O problema é que **ela não descrevia o que foi implementado** — ver §2.1. As
faixas pagavam o custo de um eixo de cor estranho ao restante da tela sem recolher o benefício que
esse custo comprava.

---

## 2. O que foi medido

### 2.1 A correspondência que a `R-UI-01` afirmava não existia

O documento e a tela foram lidos no código, não de memória.

| Onde | Faixa | Valor | Origem |
|---|---|---|---|
| **DOCX** | título, cabeçalho **e** seção — as três | `#222854` | `layout.py:63`, constante `NAVY` |
| Tela | grupo | `#0B2235` | token `navy-800` |
| Tela | seção | `#17416B` | token `navy-600` |

Dois achados:

1. **O relatório usa uma cor só.** A hierarquia de dois níveis da tela — faixa de grupo mais escura
   que a de seção — **não existe no documento**. É invenção da tela, e é uma boa invenção: em papel
   a página inteira está à vista, na tela a seção rola sozinha e precisa dizer a que grupo pertence.
2. **Nenhum dos dois navies da tela é o navy do documento.** `navy-800` está a 1,16× de `#222854` em
   luminância e `navy-600` a 1,34×. A correspondência era de **família**, nunca de valor.
3. **`navy-600` `#17416B` é a cor secundária da paleta TRIADE**, o design system de referência do
   projeto. A faixa de seção não vinha do relatório: vinha do design system, e a `R-UI-01` atribuía
   ao PDF uma escolha que já era da paleta.

Ou seja: a `R-UI-01` foi escrita descrevendo uma intenção que a implementação não seguiu, e ninguém
percebeu porque ninguém põe a tela e o DOCX lado a lado medindo pixel.

### 2.2 O que a estrutura de duas faixas realmente usava

| Faixa | Token | Hex | Branco sobre ele |
|---|---|---|---|
| Grupo | `navy-800` | `#0B2235` | 16,22:1 |
| Seção | `navy-600` | `#17416B` | 10,47:1 |

**Degrau de luminância entre as duas: 1,55×.** Este número é o achado central desta espec — ver D-01.

---

## 3. O critério

Três restrições que qualquer cor candidata precisa satisfazer. Elas valem independentemente do matiz
escolhido, e é por isso que estão numa seção própria e não dentro da decisão.

| # | Restrição | Régua |
|---|---|---|
| 1 | A hierarquia de dois níveis sobrevive | Degrau de luminância entre as faixas próximo de 1,55× |
| 2 | O texto branco passa AA | ≥ 4,5:1 sobre cada faixa, sem isenção de texto grande (`R-ACE-01`) |
| 3 | Nenhuma colisão semântica | O grid já usa âmbar (sem previsão contratual), vermelho (saldo negativo), `teal-50` (coluna medida) e `brand.green` (selo "confere") |

A restrição 3 é a menos óbvia e a que mais restringe. Este grid existe para mostrar **o que não
bateu**; cor que já significa "ok" nesta tela não pode virar o cromo dele.

---

## 4. Regras

| ID | Regra |
|---|---|
| `R-COR-01` | As faixas do grid usam a **paleta da aplicação**, não a do documento. A correspondência com o PDF é de **estrutura** — mesma ordem de seções, mesmas colunas —, não de cor |
| `R-COR-02` | A faixa de **seção** é `teal-500` `#1B616D`; a de **grupo** é `teal-700` `#0E3D47` |
| `R-COR-03` | O degrau de luminância entre as duas faixas fica entre **1,5× e 1,8×**. É ele, e não o matiz, que sustenta a hierarquia. Ver D-01 |
| `R-COR-04` | Texto branco sobre qualquer faixa cumpre **≥ 4,5:1**, medido pelo `a11y-contraste.spec.ts` |
| `R-COR-05` | As faixas **não recebem `hover`, cursor de ponteiro nem canto arredondado**. Elas compartilham cor com o botão primário e é a forma que as separa dele. Ver D-03 |
| `R-COR-06` | A cor da faixa **não é usada para transmitir informação** — não distingue seção "com mais divergência", não codifica severidade. Ela é estrutura. WCAG 1.4.1 |

---

## 5. A cor

| Faixa | Token | Hex | Branco sobre ele | Exemplo do piloto |
|---|---|---|---|---|
| Grupo | `teal-700` | `#0E3D47` | **11,82:1** | `C7 - SD-WAN` |
| Seção | `teal-500` | `#1B616D` | **7,05:1** | `C7.3 SERVIÇO DE COMUNICAÇÃO DE DADOS…` |

**Degrau: 1,68×** — contra 1,55× do navy que saiu. A hierarquia não só sobrevive como fica
marginalmente mais legível.

Seções sem grupo — `grupo_titulo` vazio no catálogo, como `B - SERVIÇOS DE REDES E CONECTIVIDADES` —
levam só a faixa de seção, em `teal-500`. A faixa escura significa **"existe um nível acima"**, não
"isto é um grupo".

---

## 6. Decisões de engenharia

### D-01 — O requisito é o degrau de luminância; o matiz é livre

A pergunta que originou este incremento foi sobre **matiz** ("dá para ser verde?"). A resposta
técnica é que matiz é a parte que não importa.

O que faz a faixa `C7.3` ler como subordinada à faixa `C7` é a diferença de luminância entre as
duas. Duas faixas do mesmo matiz e luminância parecida — por mais bonito que fosse o matiz — viram
um listrado sem hierarquia, e o grid perde a capacidade de dizer onde um grupo termina.

Por isso `R-COR-03` fixa uma **faixa numérica**, não uma cor. Qualquer proposta futura de repintura
é aceitável se cair dentro dela, e é o único requisito que uma repintura não pode negociar.

### D-02 — Alternativa descartada: o verde da marca nas faixas

A primeira implementação deste incremento usou o eixo verde da marca (`brand.green` `#00805F`,
H≈165°), rebaixado em dois tons dessaturados para servir de cromo:

| Faixa | Hex | Branco sobre ele |
|---|---|---|
| Grupo | `#04291F` | 15,65:1 |
| Seção | `#08503C` | 9,45:1 |

Degrau 1,66×, contraste folgado, `a11y-contraste` e `a11y-axe` passando — **tecnicamente correta, e
descartada mesmo assim.** Duas razões:

1. **Introduzia dois tokens novos** (`brand.green.band`, `brand.green.deep`) para um problema que a
   paleta existente já resolvia. Toda cor nova num design system é uma decisão que alguém terá de
   defender depois.
2. **Verde saturado nesta tela já significa "confere"** — é o selo da barra. Os tons escolhidos
   eram dessaturados justamente para escapar disso, o que é sinal de que a família estava errada:
   uma cor que precisa ser desfigurada para não mentir não é a cor certa.

`teal-500` não tem esse problema. Ele é a cor de **ação** da aplicação, não de status, e é um
azul-esverdeado — fica no eixo verde que a marca ocupa sem herdar o significado do selo.

**Registro honesto:** a versão verde chegou a ser implementada, testada e revertida no mesmo dia. O
`tailwind.config.ts` voltou byte a byte ao estado anterior.

### D-03 — A faixa de grupo não repete `teal-500`

`teal-500` é a cor do botão "Baixar DOCX", que fica **imediatamente acima do grid** no painel de
resultado. Preenchimento idêntico entre um botão e um cabeçalho não-clicável encostados enfraquece a
regra "esta cor é clicável" — é ambiguidade de afordância, e é o custo real desta escolha.

Três coisas seguram a distinção, e é por isso que o custo é aceitável:

| Botão | Faixa |
|---|---|
| Canto arredondado, largura do conteúdo | Canto reto, largura total do bloco |
| `hover` que escurece para `teal-600` | Sem `hover` |
| `<a>` com `download` | `<h3>` / `<h4>` |

A faixa de grupo em `teal-700` garante que **só um dos dois níveis** coincida exatamente com o
botão. É o que `R-COR-05` protege: no dia em que a faixa ganhar `hover` ou canto arredondado, a
ambiguidade deixa de ser teórica.

### D-04 — O cabeçalho de colunas fica neutro

Tingir o cabeçalho de colunas (`bg-neutral-50` + `text-navy-300`) de verde-claro amarraria o bloco
visualmente. Foi calculado e recusado: `navy-300` `#4E747E` sobre um tint `#E6F4EF` dá **4,50:1** —
exatamente em cima da régua da `R-ACE-01`, sem margem para arredondamento de nenhum motor.

Ganho estético pequeno, risco de reprovar o teste de contraste por duas casas decimais. O cabeçalho
segue neutro.

### D-05 — Nenhum token novo

`teal-500` e `teal-700` já existiam no `tailwind.config.ts`: vêm da paleta TRIADE, o design system
de referência do projeto, onde `teal` é a **primária** e `#1B616D` é o passo 500
(`docs/triade_referencia/README.md`). A ESPEC 005 §174 já havia recusado promover o verde do logo a
cor de ação exatamente para não criar um segundo acento competindo com o teal — esta espec segue a
mesma linha, um incremento adiante.

A implementação inteira são **três classes trocadas em um arquivo**; o arquivo de tokens não foi
tocado.

Isto não é economia de digitação: um incremento de cor que não mexe na paleta é um incremento que
não pode quebrar cor de nenhum outro componente.

---

## 7. Revisão da `R-UI-01` — ESPEC 002 §7

Nova redação:

> `R-UI-01` — As faixas do grid usam a **paleta da aplicação**. A correspondência com o relatório é
> de **estrutura** — mesma ordem de grupos e seções, mesmos títulos, mesmas colunas —, e é ela que
> torna a conferência linha a linha possível. A cor não participa dessa correspondência.

**O que se perde:** nada verificável. §2.1 mostrou que a correspondência cromática que a regra
invocava nunca foi implementada — a tela usava dois navies, o documento usa um, e os três são
diferentes.

**O que se ganha:** a tela passa a ter um eixo de cor só. E a regra passa a dizer o que de fato
sustenta a conferência: quem confere procura `C7.3` na tela e `C7.3` no PDF pelo **título e pela
posição**, não pelo tom da faixa.

**O que continua valendo integralmente:** a estrutura. Mesma ordem, mesmo agrupamento, mesmos
rótulos, mesmas seis colunas. `R-DIV-05` e o bloco de itens sem previsão contratual não foram
tocados.

---

## 8. O que muda no código

| Camada | Mudança |
|---|---|
| `domain/` · `application/` · `infrastructure/` · `api/` | **Nenhuma** |
| `backend/src/infrastructure/report/layout.py` | **Nenhuma** — o DOCX segue em `#222854`. Ver §11, ponto 3 |
| `frontend/tailwind.config.ts` | **Nenhuma** — ver D-05 |
| `frontend/src/app/components/DivergenciaGrid.tsx` | `bg-navy-800` → `bg-teal-700`; `bg-navy-600` → `bg-teal-500`, nos **dois** ramos do condicional de nível de heading |

O condicional de nível — `<h3>` quando não há grupo, `<h4>` quando há — vem da ESPEC 008 `R-ACE-10` e
não foi alterado. As duas ocorrências de `bg-navy-600` estavam nos dois ramos, e trocar só um
produziria seções de cores diferentes conforme o catálogo trouxesse ou não `grupo_titulo`.

---

## 9. Testes e critério de aceite

| Nível | Cobertura | Resultado |
|---|---|---|
| Contraste | `a11y-contraste.spec.ts`, quatro estados de tela | **4 passed** |
| Marcação | `a11y-axe.spec.ts`, quatro estados × 1366 e 390 px | **8 passed** na versão anterior desta iteração; a mudança final é só de valor de `background-color` |
| Hierarquia | Degrau de 1,68× entre as faixas, dentro de `R-COR-03` | Calculado, §5 |
| Regressão | O grid segue exibindo `B - SERVIÇOS DE REDES E CONECTIVIDADES` — âncora do teste de fumaça | Intacto |
| Documento | O teste-âncora do DOCX não é tocado: nenhum arquivo de backend mudou | Intacto |

O `a11y-contraste.spec.ts` é o portão que importa aqui. Ele mede a cor **computada no navegador** e
compõe fundos com alfa — é o único teste do projeto que pega uma repintura que reprove AA.

---

## 10. Riscos

| Risco | Mitigação |
|---|---|
| Faixa confundida com botão, por compartilhar `teal-500` | D-03 e `R-COR-05`: canto reto, sem `hover`, largura total. Só um dos dois níveis coincide com o botão |
| Tela e documento divergirem em cor | `R-COR-01` assume a divergência explicitamente. §2.1 mostra que ela já existia sem estar escrita |
| Repintura futura destruir a hierarquia | `R-COR-03` fixa a faixa numérica do degrau, que é o requisito real |
| O verde do portal ser outro | §11, ponto 1. Nenhum hex do portal foi amostrado nesta espec |

---

## 11. Pontos em aberto

| # | Questão | Impacto |
|---|---|---|
| 1 | **O verde institucional do portal não foi amostrado.** Os tons desta espec vêm da paleta TRIADE já no projeto. Se o portal tiver hex próprio, `R-COR-03` permite adotá-lo desde que o degrau caia entre 1,5× e 1,8× | Fidelidade de marca |
| 2 | Se o grid ganhar linha clicável ou seção recolhível, a coincidência de cor com o botão precisa ser revisitada — aí a ambiguidade de D-03 deixa de ser teórica | Afordância |
| 3 | O DOCX segue em `#222854`. A tela e o documento agora divergem **por decisão registrada**, não por acidente. O documento deve acompanhar? Esta espec diz que não: ele reproduz um modelo institucional, e o critério de aceite da ESPEC 001 é reproduzi-lo | Escopo |
| 4 | O cabeçalho de colunas poderia ganhar tint se `navy-300` fosse escurecido mais um passo. Não foi feito: o token tem oito usos e escurecê-lo é decisão de paleta, não de grid | Coesão visual |
| 5 | A [ESPEC 009](009-analise-da-medicao.md) acrescenta um painel de análise **acima** deste grid, com quatro blocos de situação. As `R-COR-01` a `R-COR-06` valem para ele: paleta da aplicação, degrau de luminância entre níveis, e cor que não carrega informação sozinha — que é a mesma exigência que a ESPEC 009 já registra citando `R-ACE-02` | Coerência entre incrementos |

Nenhum bloqueia a implementação — ela já está entregue.

---

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Medição da paleta em uso, no DOCX e na tela | feita — §2 |
| B | Iteração no eixo verde da marca, implementada e revertida | feita — D-02 |
| C | Troca para `teal-700` / `teal-500` | feita — três classes |
| D | Portão de contraste em navegador | feita — §9 |

Nada no backend mudou; o teste-âncora não foi tocado.

---

## 13. Histórico

| Versão | Mudança |
|---|---|
| 1.0 | Espec escrita **depois** da implementação, a pedido, registrando a medição de §2.1, a iteração verde descartada (D-02) e a revisão da `R-UI-01` |
