# ESPEC 005 — A marca Confere na interface

| | |
|---|---|
| **Status** | **Implementada** |
| **Versão** | 1.0 — 2026-08-06 |
| **Depende de** | [ESPEC 002](002-painel-de-divergencias.md) — implementada |
| **Ativo de origem** | `docs/logo_confere/logo_confere.png` |

Esta espec é **retroativa**: descreve o que já está no código. Foi escrita depois da implementação
para registrar as medições e as decisões que a sustentam, que de outro modo ficariam só no diff.

---

## 1. Problema

A aplicação não tinha nome. A tela abria com `Análise de Medição Contratual` — a descrição da
função, não a identidade do produto —, e o mesmo texto servia de título de página, de nome de pacote
e de rótulo da API.

Isso resolve enquanto o software é um piloto interno. Não resolve na hora de apresentá-lo: um
produto que se chama pela própria descrição não é lembrado nem citado, e não tem como ser pedido
pelo nome.

---

## 2. Objetivo

Dar nome, marca e assinatura à aplicação, na tela.

| Elemento | Decisão |
|---|---|
| **Nome** | **Confere** |
| **Assinatura** | *Confere o contratado. Confere o utilizado.* |
| **Marca** | Lockup horizontal — símbolo + logotipo |
| **Alcance** | **Somente a interface web.** O documento gerado não é tocado |

O alcance é a parte mais importante do objetivo, e está detalhado em `R-MRC-08`.

---

## 3. O ativo recebido — medição, não suposição

Inspeção do PNG entregue, com Pillow e NumPy:

| Aspecto | Constatação |
|---|---|
| Dimensões | 1536 × 1024 px |
| Modo | **RGB — sem canal alfa** |
| Cor do fundo | `#FDFFFF`, opaco |
| Área com tinta | x 123–1417 · y 319–655 — **67% da arte é margem vazia** |
| Vão entre símbolo e logotipo | x 456–490 (35 px) |
| Faixa do logotipo | y 384–570 (altura 187) |
| **Faixa da assinatura** | y 611–651 — **altura de 41 px, embutida na imagem** |

### 3.1 Os dois defeitos do ativo para uso em tela

**A assinatura está embutida.** Num cabeçalho de 48 px, a faixa de 41 px de uma arte de 1024 px de
altura renderiza a **cerca de 2 px**. Seria ilegível, não selecionável, ausente do DOM e invisível
para leitor de tela.

**O fundo é branco opaco.** O fundo da aplicação é `surface #F4F7F8`. Sem canal alfa, a marca
apareceria dentro de um retângulo branco visível.

Nenhum dos dois é defeito do desenho — são consequências de o ativo ter sido produzido como arte
única, para uso impresso ou em apresentação. Para a tela, ele precisa ser decomposto.

---

## 4. Regras

| ID | Regra |
|---|---|
| `R-MRC-01` | O nome da aplicação é **Confere**. Vale para o título da página, o `<h1>` e os metadados |
| `R-MRC-02` | O lockup exibido **não contém a assinatura**. Ele é símbolo + logotipo, e só |
| `R-MRC-03` | A assinatura é **texto vivo** — selecionável, presente no DOM e legível em qualquer zoom. Reproduz o tratamento do ativo original: dois selos, "Confere" em negrito nas duas cores, divisor entre as orações |
| `R-MRC-04` | Os ativos de tela têm **fundo transparente**, com o alfa extraído por *unmultiply* para não deixar halo nas bordas suavizadas |
| `R-MRC-05` | O nome acessível do `<h1>` é `Confere`, vindo do `alt` da imagem. Leitor de tela anuncia o nome, nunca "imagem" |
| `R-MRC-06` | O **verde da marca não é cor de texto**. Em texto vale `brand.green-ink`. Ver §6/D-04 |
| `R-MRC-07` | O divisor da assinatura é **decorativo** (`aria-hidden`) e some em telas estreitas, onde as orações empilham |
| `R-MRC-08` | **A marca não entra no documento gerado.** O `.docx` carrega a identidade da PRODAM (ESPEC 003) e é comparado célula a célula pelo teste-âncora |
| `R-MRC-09` | Os ativos derivados vivem em `frontend/public/` e são **copiados para o container** explicitamente |

### 4.1 Por que `R-MRC-08` existe

As duas identidades não se misturam, e a razão é de negócio antes de ser de design.

O `.docx` é peça de processo administrativo: instrui faturamento e é lido por fiscal de contrato,
controle interno e órgão de fiscalização. Quem o assina é a PRODAM. Marca de ferramenta ali seria
ruído em documento formal — e, no plano prático, quebraria o teste-âncora, que compara o documento
gerado com o modelo GRC célula a célula.

A marca Confere identifica **quem produziu**, não **o que foi produzido**. Ela vive na tela.

---

## 5. Estrutura do cabeçalho

```
┌─ <header> ──────────────────────────────────────────────────────────────┐
│                                                                          │
│  <h1>  [ ◎ Confere ]        lockup PNG, alt="Confere"                    │
│         h-10 (40 px) · sm:h-12 (48 px)                                   │
│                                                                          │
│  ⊘ Confere o contratado.  │  ⊘ Confere o utilizado.                      │
│  └ texto vivo, selos em SVG inline, divisor decorativo                   │
│                                                                          │
│  ──────────────────────────────────────────────────────  <hr>            │
│                                                                          │
│  Envie o contrato e o levantamento da competência. […]                   │
│  └ instrução de uso                                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

O `<hr>` separa duas coisas de natureza diferente: acima, **quem é** a aplicação; abaixo, **o que
fazer** nela.

Em telas estreitas o lockup cai para 40 px, as duas orações da assinatura empilham e o divisor sai.

---

## 6. Decisões de engenharia

Todas verificadas sobre o ativo real, antes de escrever esta espec.

### D-01 — O lockup é recomposto, não recortado

O símbolo ocupa y 319–655 e a assinatura y 611–651: eles **se sobrepõem verticalmente**. Nenhum corte
retangular separa um do outro. O lockup é montado — símbolo e logotipo extraídos por *bounding box*
próprio e recolados em tela transparente, com centros alinhados e respiro de 16% da largura do
símbolo.

Resultado: símbolo 333 × 337, logotipo 927 × 187, lockup **1313 × 337**.

**Alternativa descartada:** exibir a arte inteira, grande o bastante para a assinatura embutida ficar
legível. Exigiria cerca de 600 px de largura só de cabeçalho, numa página de conteúdo com
`max-w-4xl` — e ainda entregaria texto que não se seleciona nem se lê por software.

### D-02 — Branco convertido em alfa por *unmultiply*

Limiar simples sobre o branco deixaria halo nas bordas suavizadas. O alfa é derivado do canal mais
escuro e a cor é desmultiplicada:

```
a = 1 − min(R,G,B)/255
c = (observado − 255·(1−a)) / a
```

### D-03 — A assinatura é remontada em HTML

Os selos são SVG inline — círculo e *check* em traço, herdando `currentColor`. O "Confere" em negrito
e o divisor reproduzem o ativo original.

Ganho além da acessibilidade: a assinatura passa a ser **conteúdo**, não arte. Mudar uma palavra é
editar uma linha de JSX, sem repassar por ferramenta de imagem.

### D-04 — Dois verdes, por contraste

Cores medianas amostradas dos pixels sólidos do próprio logo, e contraste WCAG contra `#F4F7F8`:

| Token | Hex | Contraste | Uso |
|---|---|---|---|
| `brand.navy` | `#00255B` | **13,78:1** | Texto, sem ressalva |
| `brand.green` | `#00805F` | **4,59:1** | **Só ícone e traço** — como elemento de interface a exigência é 3:1 |
| `brand.green-ink` | `#006E52` | **5,82:1** | O mesmo verde aprofundado, para texto |

O verde da marca passa AA para texto por **0,09** de margem. Margem dessa ordem não sobrevive a uma
mudança de fundo nem a um monitor ruim. Daí o terceiro token, e daí `R-MRC-06`.

A regra está escrita como comentário no `tailwind.config.ts`, onde quem for usar o token vai lê-la.

### D-05 — O verde não se espalha pela interface

A paleta do projeto é a TRIADE — teal primário `#1B616D`, navy secundário. O verde do logo não
pertence a ela, e promovê-lo a cor de ação criaria um segundo acento competindo com o teal.

O verde fica **contido na marca e na assinatura**. Botões, links e estados continuam na paleta
existente.

---

## 7. O que mudou no código

| Camada | Mudança |
|---|---|
| `domain/` · `application/` · `infrastructure/` | **Nenhuma** |
| `api/` | **Nenhuma** |
| `frontend/public/` | Entra a pasta, com `logo-confere.png` (lockup) e `marca-confere.png` (símbolo) |
| `frontend/src/app/icon.png` | Símbolo em 512 × 512 — o App Router o adota como favicon sozinho |
| `frontend/src/app/page.tsx` | Cabeçalho: lockup no `<h1>`, assinatura em texto vivo, componente `Selo`, `<hr>` |
| `frontend/src/app/layout.tsx` | `title` e `description` |
| `frontend/tailwind.config.ts` | Os três tokens de `brand`, com a regra de uso em comentário |
| `frontend/Dockerfile` | `COPY` de `public/` — ver §9.1 |

O backend não foi tocado. A aplicação continua se identificando como `analise-medicao` no
`pyproject.toml` e no título da API — ver §10, ponto 1.

---

## 8. Verificação

Executada em navegador real (Chromium, `deviceScaleFactor` 2), sobre o *build* de produção.

| Nível | Resultado |
|---|---|
| Tipos | `tsc --noEmit` limpo |
| Build | `next build` limpo, 5 rotas |
| Renderização | Lockup em **187 × 48** no desktop e **156 × 40** em 390 px de largura |
| Acessibilidade | Nome acessível do `<h1>` = `Confere`, vindo do `alt` |
| Cor | Cor computada do segundo "Confere" = `rgb(0, 110, 82)` — o `green-ink` de D-04 |
| Favicon | `/icon.png` responde 200 e o `<link rel="icon">` é emitido |
| Ativos | `/logo-confere.png` responde 200 |
| Console | Nenhum erro; nenhuma resposta ≥ 400 |
| Regressão | Os dois `input[type=file]` e o botão "Gerar relatório" seguem presentes — são as âncoras do teste de fumaça |

O teste-âncora do documento **não foi afetado**: nada no backend mudou (`R-MRC-08`).

---

## 9. Riscos

### 9.1 O ativo sumiria só no container

A saída `output: "standalone"` do Next **não inclui `public/`**, e o `Dockerfile` não a copiava —
não precisava, porque a pasta não existia. Com o logo dentro dela, o cabeçalho funcionaria em
desenvolvimento e sairia 404 **apenas no container**.

Corrigido com um `COPY` explícito. Fica registrado porque a classe do problema é a pior que existe:
falha que não aparece onde se desenvolve. Os containers seguem não verificados (README,
"Limitações"), então a correção está escrita e não exercitada.

### 9.2 Demais riscos

| Risco | Mitigação |
|---|---|
| A derivação dos ativos não é reproduzível no repositório | **Aberto.** Ver §10, ponto 2 |
| O ativo é rasterizado, não vetorial | A 1313 px de largura, atende com folga o uso a 48 px, inclusive em telas 2×. Uma aplicação em tamanho grande pediria SVG |
| A assinatura na tela divergir da do logo | Hoje as duas dizem "utilizado". Mudar uma exige mudar a outra — ver §10, ponto 3 |
| O verde virar cor de ação por descuido | `R-MRC-06` e o comentário no `tailwind.config.ts`. Não há verificação automática |
| A marca vazar para o documento | `R-MRC-08`. O teste-âncora reprovaria a tentativa |

---

## 10. Pontos em aberto

| # | Questão | Impacto |
|---|---|---|
| 1 | O backend deve adotar o nome? `pyproject.toml`, título da API e prefixo de diretório temporário seguem como `analise-medicao`. Renomear o pacote invalida o `uv.lock` e exige `uv lock` | Coerência interna |
| 2 | A derivação dos ativos deve virar `scripts/derivar_logo.py`? O projeto já trata artefato derivado assim — `seed_catalog.py`, `sanitize_fixture.py`. Hoje os PNGs em `public/` não têm como ser regerados do original | Reprodutibilidade |
| 3 | A assinatura diz "utilizado". A aplicação compara o contratado com o **medido** — a entrada é a aba `Levantamento` e a coluna do relatório é "Quantidade Medida". Itens de perfil entram como `1 / 1` independentemente do uso (ESPEC 001 §9.3), o que torna medido e utilizado comprovadamente distintos | Precisão do texto público |
| 4 | O README e o `CHANGELOG` devem passar a chamar o produto de Confere? | Documentação |

Nenhum bloqueia nada. O ponto 3 é o único com conteúdo de negócio: é escolha do solicitante, tomada
com a distinção posta.

---

## 11. Esforço

Implementado em uma sessão. A distribuição é atípica e vale registrar:

| Fase | Conteúdo | Peso |
|---|---|---|
| A | Medição do ativo e decomposição em símbolo, logotipo e lockup | **G** |
| B | Amostragem de cor e cálculo de contraste | M |
| C | Cabeçalho, assinatura em texto vivo e tokens | P |
| D | `Dockerfile`, favicon e verificação em navegador | P |

O código foi a parte pequena. O trabalho esteve em **descobrir o que o ativo era** — que a assinatura
estava embutida, que não havia canal alfa e que o verde não passava em texto. Nenhuma das três coisas
aparece olhando o arquivo; as três apareceram medindo.
