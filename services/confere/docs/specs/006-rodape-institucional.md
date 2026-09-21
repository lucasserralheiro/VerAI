# ESPEC 006 — Rodapé institucional na interface

| | |
|---|---|
| **Status** | **Implementada** |
| **Versão** | 1.1 — 2026-08-06 — altura da faixa medida e ajustada (D-06) |
| **Revisada por** | [ESPEC 056](056-o-logo-do-rodape-que-virou-link-para-o-portal.md) — a marca e os dois ícones sociais (D-06, abaixo) ganham link, em nova aba. O §10, ponto 1, fica resolvido: os ícones viram link, o texto `/prodamsp` continua texto |
| **Depende de** | [ESPEC 005](005-identidade-confere.md) — implementada |
| **Modelo** | `docs/documentos/Papel de Carta e Capa de Apostila.docx`, rodapé das páginas 2+ |
| **Ativos** | `docs/logos_prodam/` |

---

## 1. Problema

A tela termina no conteúdo. Não há rodapé, e com isso a aplicação **não diz de quem ela é**.

Isso importa mais aqui do que num software comum. O que a ferramenta produz instrui faturamento de
contrato público, e quem responde pelo documento é a PRODAM. A tela hoje não carrega essa
atribuição em lugar nenhum — só o documento gerado carrega.

---

## 2. Objetivo

Um rodapé que reproduza, em tela, o padrão do rodapé institucional do modelo — o que aparece a
partir da página 2, sobre o papel timbrado.

---

## 3. O rodapé do modelo — medição

Extraído do pacote OOXML, não reproduzido de memória:

| Aspecto | Constatação |
|---|---|
| Partes de rodapé | **Uma só** — `word/footer1.xml` |
| Referência em `document.xml` | `w:type="default"`, `rId11` |
| `titlePg` | **Ausente** — o mesmo rodapé vale para todas as páginas, inclusive a capa |
| Texto no XML | **Nenhum** (`<w:t>` não ocorre) |
| Conteúdo | **Uma única imagem**, `media/image3.png` |
| Dimensão renderizada | 20,98 × 2,22 cm |
| Imagem | 1190 × 126 px, RGBA sem alfa útil |
| Fundo | `#0E3E5E`, opaco de borda a borda |
| Laranja da marca | `#FF671D` |
| Texto | Branco puro — **11,23:1** de contraste sobre o fundo |

### 3.1 Por que "a partir da página 2"

Não há `titlePg`: tecnicamente o rodapé está em todas as páginas. Na página 1 ele fica **coberto pela
imagem de capa**, que ocupa a página inteira. A leitura do solicitante — "a partir da página 2" — é
o que se vê, e descreve o comportamento visível corretamente.

### 3.2 Blocos internos, por medição de coluna

| Bloco | Posição x | Faixa | Conteúdo |
|---|---|---|---|
| 1 | 40–118 px | 3,4% – 10,0% | Símbolo PRODAM — pontos laranja e "P" branco |
| — | ~150 px | — | Divisor vertical fino, claro |
| 2 | 187–667 px | 15,7% – 56,1% | `Prodam — Empresa de Tecnologia da Informação` / `e Comunicação do Município de São Paulo`, em duas linhas |
| 3 | 865–1149 px | 72,7% – 96,6% | Endereço em caixa alta, em duas linhas; abaixo, ícones Instagram e LinkedIn com `/prodamsp` |

Respiros: 40 px à esquerda, 41 px à direita, 26 px no topo, 29 px na base.

O padrão é, portanto: **faixa escura de borda a borda, marca à esquerda, identificação
institucional ao centro-esquerda, endereço e redes à direita.**

---

## 4. Regras

| ID | Regra |
|---|---|
| `R-ROD-01` | O rodapé é **faixa de borda a borda** em `#0E3E5E`, com o conteúdo interno alinhado ao mesmo `max-w-4xl` do corpo da página |
| `R-ROD-02` | O conteúdo é **texto vivo e SVG**, nunca a imagem do modelo. Ver §6/D-01 |
| `R-ROD-03` | A marca usa o **SVG oficial** de `docs/logos_prodam/`, na variante para fundo escuro. Ver §6/D-02 |
| `R-ROD-04` | O endereço é escrito em **caixa mista no HTML** e apresentado em caixa alta por CSS. Ver §6/D-03 |
| `R-ROD-05` | O endereço fica em `<address>` com `not-italic` — é o elemento semântico do endereço de contato |
| `R-ROD-06` | O divisor vertical é **decorativo** (`aria-hidden`) e some quando os blocos empilham |
| `R-ROD-07` | Em telas estreitas os três blocos **empilham** e o alinhamento à direita vira à esquerda |
| `R-ROD-08` | O rodapé fica **colado à base** quando o conteúdo não preenche a janela, sem nunca cobrir conteúdo |
| `R-ROD-09` | O handle `/prodamsp` é **texto, não link**. Ver §10, ponto 1 |
| `R-ROD-10` | O rodapé **não leva marca Confere, versão nem informação da aplicação**. Ele é institucional |
| `R-ROD-11` | A faixa ocupa **no máximo ~13% da altura** em 1366 × 768, a tela de referência. Ver §6/D-06 |

### 4.1 Relação com a ESPEC 005 §4.1

A ESPEC 005 afirmou que as duas identidades não se misturam. Este incremento coloca a marca PRODAM
na mesma tela que a marca Confere, e por isso a regra precisa ser dita com mais precisão do que
estava:

> O **documento** é da PRODAM e não leva marca de ferramenta (`R-MRC-08`, inalterada).
> A **tela** tem as duas, em papéis distintos e em lugares distintos: o cabeçalho diz **qual é a
> ferramenta**, o rodapé diz **de quem é a casa**.

Não há competição visual: as marcas ficam em extremos opostos da página, em fundos opostos, e não
disputam a mesma âncora de leitura. É a convenção de qualquer produto corporativo — produto no topo,
instituição na base.

`R-ROD-10` é o que sustenta a separação: no momento em que o rodapé ganhasse "Confere v1.0", as duas
identidades passariam a disputar o mesmo bloco.

---

## 5. Estrutura

```
┌─ <footer> — faixa #0E3E5E, borda a borda ───────────────────────────────┐
│                                                                          │
│   ┌── conteúdo, max-w-4xl, alinhado ao corpo da página ──────────────┐   │
│   │                                                                   │   │
│   │  ●●●        │  Prodam — Empresa de Tecnologia      RUA LÍBERO…    │   │
│   │  ●● prodam  │  da Informação e Comunicação do      CEP: 01009-905 │   │
│   │  ● govtech  │  Município de São Paulo                             │   │
│   │             │                                       ⬚ ⬚ /prodamsp │   │
│   └───────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘

     ↑ marca         ↑ divisor    ↑ identificação        ↑ endereço e redes
```

Abaixo de `sm`, os três blocos empilham na ordem de leitura, o divisor sai e o bloco da direita
passa a alinhar à esquerda.

---

## 6. Decisões de engenharia

### D-01 — Texto vivo, e não a imagem do rodapé

A imagem tem 1190 px de largura por 126 de altura — proporção de **9,44:1**. Numa janela de 390 px
ela renderizaria com 41 px de altura, e o endereço, que ocupa cerca de 1/40 da altura da arte,
ficaria com menos de 4 px. Ilegível.

Pior: endereço e razão social viram pixels. Não se seleciona, não se copia, não se lê por software,
e o `alt` teria de repetir o texto inteiro para não perder a informação.

O padrão a reproduzir é a **composição** — faixa escura, marca à esquerda, endereço à direita —, não
o arquivo. É a mesma decisão tomada na ESPEC 005/D-03 para a assinatura, pela mesma razão.

**Alternativa descartada:** usar a imagem com `alt` descritivo. Resolveria o leitor de tela e
deixaria o problema de legibilidade intacto para todo mundo que enxerga.

### D-02 — O SVG oficial, não o símbolo recortado do modelo

O símbolo dentro do rodapé do modelo tem **79 × 52 px**. Numa tela 2× ele já apareceria macio, e não
há origem de resolução maior — a arte inteira tem 1190 px.

A pasta `docs/logos_prodam/` traz o logo oficial em **SVG**, `viewBox="0 0 1630 428"`, na variante
`Colorida_Branca`: 15 preenchimentos em `#FF671D` e 7 em branco, sem script nem referência externa.
É a variante desenhada para fundo escuro, e é vetor — nítido em qualquer densidade.

**Consequência assumida:** o logo oficial é o lockup atual — pontos, `prodam` e `govtech sp` —,
enquanto o modelo usa um símbolo compacto com o "P". **A marca no rodapé da tela não é idêntica à do
rodapé do documento.** É deliberado: entre reproduzir um recorte de 79 px e usar o ativo oficial que
a própria instituição distribuiu, o segundo é o correto. Registrado em §10, ponto 2, caso a
fidelidade literal seja preferida.

### D-03 — Caixa alta por CSS, não no texto

No modelo o endereço está em caixa alta. Escrevê-lo assim no HTML faria leitor de tela soletrar sigla
por sigla em alguns motores, e obrigaria quem copiasse a corrigir a caixa à mão.

O texto vai em caixa mista e a apresentação sai de `uppercase`. Mesmo resultado visual, texto íntegro
por baixo.

### D-04 — Rodapé colado à base, via layout de coluna

A aplicação é uma página só, e o estado inicial — antes de qualquer upload — é curto. Sem
tratamento, o rodapé subiria para o meio da tela.

O `<body>` passa a `flex flex-col` e o `<main>` recebe `flex-1`. O rodapé encosta na base quando o
conteúdo é curto e é empurrado para baixo quando o grid de divergências cresce.

**Alternativa descartada:** `position: fixed`. Cobriria conteúdo em telas baixas, justamente onde o
grid é mais difícil de ler.

### D-05 — Ícones sociais em SVG inline

Instagram e LinkedIn entram como SVG inline herdando `currentColor`, pelo mesmo motivo dos selos da
assinatura: dois arquivos a menos para servir, cor controlada por CSS e nitidez em qualquer tamanho.

### D-06 — A altura da faixa, medida em três janelas

A primeira versão usava `py-7` e a faixa saiu com **117 px**. Medição em navegador:

| Janela | Rodapé | % da altura | `main` | Proporção da faixa |
|---|---|---|---|---|
| Desktop 1280 × 900 | 117 px | 13,0% | 719 px | 10,98:1 |
| **Notebook 1366 × 768** | 117 px | **15,2%** | 587 px | 11,72:1 |
| Mobile 390 × 844 | 222 px | 26,3% | 699 px | 1,76:1 |

A proporção no desktop já era **mais esbelta que a do modelo** (9,44:1), então o problema não era
fidelidade — era orçamento de tela.

O critério que decidiu foi o do notebook 1366 × 768, que é onde esta ferramenta roda. Ali o rodapé
levava 15,2% da altura para um bloco **sem função nenhuma**: sem navegação, sem link, sem ação. É o
único elemento da interface que não faz nada, e era o terceiro em altura.

> **Revisado pela ESPEC 056.** A frase acima descrevia o rodapé no momento em que foi escrita — não
> vale mais para a marca nem para os dois ícones sociais, que passaram a ser link. Continua valendo
> para o resto: endereço, divisor e o texto `/prodamsp` (`D-08` da ESPEC 056).

`py-7` → `py-5`, e no estreito o vão entre blocos cai de 24 para 16 px:

| Janela | Rodapé | % da altura | `main` | Ganho |
|---|---|---|---|---|
| Desktop 1280 × 900 | **101 px** | 11,2% | 735 px | +16 px de conteúdo |
| **Notebook 1366 × 768** | **101 px** | **13,1%** | 603 px | +16 px de conteúdo |
| Mobile 390 × 844 | **198 px** | 23,4% | 699 px | +24 px |

**Sobre o mobile, um não-objetivo declarado.** 23,4% ainda é muito, e abaixo de `sm` a composição já
deixou de ser faixa — a proporção cai para 1,97:1, ou seja, virou bloco empilhado. Nenhum ajuste
razoável conserta isso sem descaracterizar o rodapé.

E não deve ser perseguido: a aplicação exige subir um PDF e um XLSX que vivem em **estação de
trabalho**. Uso por celular é improvável, e otimizar um quarto de uma tela que não será usada é
esforço que não se paga. O rodapé em telas estreitas é legível, empilha na ordem de leitura e não
cobre nada — o suficiente.

---

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `domain/` · `application/` · `infrastructure/` · `api/` | **Nenhuma** |
| `frontend/public/prodam-branca.svg` | Entra — cópia do oficial de `docs/logos_prodam/` |
| `frontend/src/app/components/Rodape.tsx` | Entra — o componente |
| `frontend/src/app/layout.tsx` | `<body>` vira coluna flex; o rodapé é montado aqui, fora da página |
| `frontend/src/app/page.tsx` | `<main>` recebe `flex-1` |
| `frontend/tailwind.config.ts` | Entram `prodam.navy` `#0E3E5E` e `prodam.orange` `#FF671D` |

O rodapé vive no `layout`, e não na página: ele vale para a aplicação inteira, inclusive para o
`not-found`.

---

## 8. Testes e critério de aceite

| Nível | Cobertura |
|---|---|
| Estrutura | Existe um `<footer>`; contém `<address>`; o divisor é `aria-hidden` |
| Conteúdo | Razão social, endereço e `/prodamsp` estão no **DOM como texto** (`R-ROD-02`) |
| Cor | Fundo computado `rgb(14, 62, 94)`; texto branco — 11,23:1, o mesmo do modelo |
| Marca | `prodam-branca.svg` responde 200 e tem `alt` não vazio |
| Base | Com a tela no estado inicial, a borda inferior do rodapé encosta na base da janela (`R-ROD-08`) |
| Responsivo | A 390 px os blocos empilham e o divisor não é exibido |
| **Altura** | 101 px em 1280 × 900 e em 1366 × 768 — **13,1%** na tela de referência (`R-ROD-11`) |
| Regressão | Os dois `input[type=file]` e o botão "Gerar relatório" seguem presentes — âncoras do teste de fumaça |
| Container | `public/` já é copiado no `Dockerfile` desde a ESPEC 005 §9.1 |

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| A marca do rodapé da tela diferir da do documento | D-02, decisão consciente. §10, ponto 2 |
| O endereço envelhecer | É texto em um componente, não pixels. Corrigir é uma linha |
| O rodapé competir com o cabeçalho | `R-ROD-10` e §4.1: extremos opostos, sem marca de produto na base |
| Contraste insuficiente no divisor e nos ícones | São decorativos; o texto, que carrega a informação, está em 11,23:1 |
| A faixa escura desequilibrar uma página curta | O rodapé é enxuto e a faixa só aparece na base. Verificação visual em §8 |

---

## 10. Pontos em aberto

| # | Questão | Impacto |
|---|---|---|
| 1 | ~~`/prodamsp` deve virar link para Instagram e LinkedIn?~~ **Resolvido pela ESPEC 056.** Os dois ícones (Instagram, LinkedIn) viraram link, cada um para sua URL; o texto `/prodamsp` continua texto — um único texto não pode apontar para dois destinos (`D-08` da ESPEC 056) | Navegação |
| 2 | A marca deve ser o símbolo compacto do modelo, em vez do SVG oficial? Ver D-02 | Fidelidade |
| 3 | O rodapé deve trazer o telefone ou o e-mail de suporte? O modelo não traz | Conteúdo |
| 4 | Deve haver uma linha de rodapé secundária com versão da aplicação? `R-ROD-10` diz que não neste incremento | Escopo |

Nenhum bloqueia a implementação.

---

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Medição do rodapé do modelo e escolha do ativo | feita — §3 e D-02 |
| B | Componente `Rodape`, tokens e ícones | feita |
| C | Layout de coluna para colar o rodapé à base | feita |
| D | Verificação em navegador — cor, empilhamento, base, altura | feita |

Nada no backend mudou; o teste-âncora não foi tocado.

---

## 12. Histórico

| Versão | Mudança |
|---|---|
| 1.0 | Espec escrita antes da implementação, a partir da medição do rodapé do modelo |
| 1.1 | `R-ROD-11` e D-06: altura medida em três janelas e reduzida de 117 para 101 px. Registrado o não-objetivo de otimizar o rodapé em telas estreitas |
