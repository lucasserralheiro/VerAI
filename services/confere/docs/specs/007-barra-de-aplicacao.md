# ESPEC 007 — Barra de aplicação

| | |
|---|---|
| **Status** | **Implementada, com uma regra não atendida — ver §13** |
| **Versão** | 1.1 — 2026-08-06 — implementada; marca empilhada (D-07) e desvio da `R-CAB-08` |
| **Depende de** | [ESPEC 005](005-identidade-confere.md) e [ESPEC 006](006-rodape-institucional.md) — implementadas |
| **Revisa** | `R-MRC-05` da ESPEC 005 — ver §12 |

A barra está implementada. A `R-CAB-08` — o orçamento vertical — **não foi atendida**, e o motivo
está registrado em §13: não é falha de execução, é consequência de uma decisão de desenho tomada
depois de a espec ser escrita.

---

## 1. Problema

A aplicação ganhou rodapé antes de ganhar cabeçalho, e a assimetria ficou evidente: o rodapé é uma
**faixa de borda a borda**, com chrome próprio; o topo é **conteúdo solto dentro do `main`**. A tela
tem base, não tem moldura.

Mas o problema de identidade visual é o menor dos três.

### 1.1 A tela descarta o que a API manda

`RespostaRelatorio` devolve três campos que a interface **nunca exibe**:

| Campo | Situação |
|---|---|
| `contrato_referencia` | Declarado em `lib/types.ts`. **Zero usos** na interface |
| `data_levantamento` | Declarado em `lib/types.ts`. **Zero usos** na interface |
| `titulo` | Declarado em `lib/types.ts`. **Zero usos** na interface |

O documento gerado sabe de qual contrato e de qual competência ele é. **A tela não diz.** Quem gerou
dois relatórios seguidos não tem como saber, olhando, qual dos dois está vendo — e o único jeito de
confirmar é baixar o `.docx` e abrir.

Isso é grave num produto cujo propósito é conferir números: a tela mostra `36 de 55 itens com
divergência` sem dizer **divergência de quê**.

### 1.2 O topo custa 30% da tela e não faz nada

Medição em 1366 × 768, a tela de referência fixada na ESPEC 006:

| Elemento | Altura | Posição |
|---|---|---|
| `padding-top` do `main` | 48 px | y = 0 |
| Bloco de marca (logo, assinatura, `<hr>`, instrução) | **153 px** | y = 48 |
| Margem inferior do bloco | 32 px | — |
| **Primeiro campo de upload** | — | **y = 233** |
| Rodapé | 101 px | y = 667 |

**233 px — 30,3% da altura — antes do primeiro elemento acionável.** Somando o rodapé, 334 px de
moldura para 434 px de área de trabalho: 43,5% da tela é chrome, e o chrome de cima é o que menos
justifica seu tamanho, porque some assim que o usuário rola.

---

## 2. Objetivo

Substituir o bloco de marca por uma **barra de aplicação** fixa no topo que:

1. carregue a identidade Confere em formato compacto;
2. exiba, **quando houver relatório**, de qual contrato e competência é o que está na tela;
3. devolva altura ao conteúdo.

---

## 3. Não-objetivos

O que **não** entra, e por quê:

| Fora | Motivo |
|---|---|
| Navegação | Não há para onde ir. A aplicação é uma página só |
| Menu de usuário, avatar | Não há autenticação (ESPEC 001 §7.2) |
| Busca | Não há acervo — nada é persistido |
| Configurações | A única configuração é o catálogo, que é embutido e não pertence à tela do dia a dia |
| Versão da aplicação | Ver `R-CAB-06` |

Um cabeçalho com navegação inventada é **pior que nenhum**: promete estrutura que não existe e gasta
o clique do usuário para descobrir isso. A disciplina aqui é o principal valor da proposta.

---

## 4. Regras

| ID | Regra |
|---|---|
| `R-CAB-01` | A barra é **faixa de borda a borda**, com o conteúdo alinhado ao mesmo `max-w-4xl` do corpo — a contraparte superior do rodapé |
| `R-CAB-02` | Fundo **claro**, com borda inferior de 1 px. Ver §6/D-05 |
| `R-CAB-03` | A barra é **fixa no topo** (`sticky`) e permanece visível durante a rolagem do grid |
| `R-CAB-04` | À esquerda, o lockup Confere a ~28 px de altura. A assinatura acompanha a partir de `md` e some abaixo disso |
| `R-CAB-05` | À direita, o **slot de contexto**. Ele só existe quando há relatório na tela — nos estados inicial, processando, bloqueado e erro, **fica vazio** |
| `R-CAB-06` | O slot exibe **apenas dado real vindo da API**: `contrato_referencia`, competência de `data_levantamento` e o placar de divergências. Nada de versão, ambiente ou rótulo decorativo |
| `R-CAB-07` | A marca da barra **não é link** — não há destino |
| `R-CAB-08` | Com a barra, o primeiro campo de upload começa **acima de y = 140** em 1366 × 768. É critério de aceite, não estimativa |
| `R-CAB-09` | O bloco de marca do corpo **sai**. A marca aparece uma vez por tela |
| `R-CAB-10` | Em telas estreitas o slot de contexto quebra para uma segunda linha ou some, sem espremer a marca |

---

## 5. Estrutura

**Estado inicial** — sem relatório, slot vazio:

```
┌─ <header> — faixa clara, borda inferior, sticky ────────────────────────┐
│  ◎ Confere   ⊘ Confere o contratado. ⊘ Confere o utilizado.             │
└──────────────────────────────────────────────────────────────────────────┘
   Envie o contrato e o levantamento da competência. […]

   ┌──────────────────────┐ ┌──────────────────────┐
   │  Contrato (PDF)      │ │  Levantamento (XLSX) │
   └──────────────────────┘ └──────────────────────┘
```

**Com relatório** — o slot preenchido, e a barra acompanha a rolagem:

```
┌─ <header> ──────────────────────────────────────────────────────────────┐
│  ◎ Confere            TC 52/SMIT/2024 · 07/2026 · 36 de 55 divergem     │
└──────────────────────────────────────────────────────────────────────────┘
   [ Relatório gerado ]                              [ Baixar DOCX ]
   ┌─ grid de divergências, 22 seções ───────────────────────────────┐
   │  … a barra continua visível enquanto isto rola …                │
```

---

## 6. Decisões de engenharia

### D-01 — Barra, e não bloco dentro do conteúdo

O topo passa a ter o mesmo tratamento do rodapé: faixa de borda a borda, conteúdo interno alinhado ao
`max-w-4xl`. A página deixa de ser um documento com um título e passa a ser uma aplicação com
moldura.

O ganho não é só estético. Uma faixa de ~56 px substitui 185 px de bloco, e o `R-CAB-08` transforma
isso em critério verificável em vez de promessa.

### D-02 — Fixa no topo, porque o grid é longo

O grid tem **22 seções e 36 itens divergentes**, e cresce com o contrato. Rolando, o usuário perde de
vista qualquer referência do que está olhando — e o que ele está olhando são números que serão
faturados.

Com a barra fixa, `TC 52/SMIT/2024 · 07/2026` fica visível durante toda a leitura. É a diferença entre
conferir números e conferir números **de um contrato identificado**.

**Alternativa descartada:** barra estática que rola junto. Custa o mesmo espaço e perde exatamente o
benefício que justifica a mudança.

### D-03 — O contexto usa dado que já existe

Os três campos já viajam na resposta e já são tipados no frontend. **A proposta não pede nada do
backend** — nenhum endpoint, nenhum campo, nenhuma migração. É consumir o que já chega e hoje é
descartado.

A competência sai de `data_levantamento`, que o backend já formata como `dd/mm/aaaa`; na barra vira
`mm/aaaa`.

### D-04 — O slot é vazio quando não há o que dizer

Nos estados inicial, processando, bloqueado e erro, o slot **não mostra nada**. Não há "aguardando
arquivos", não há barra de progresso falsa, não há badge de ambiente.

Um slot que só se preenche quando tem conteúdo real ensina o usuário a confiar nele. Um slot sempre
cheio vira ruído que se aprende a ignorar — e aí, no dia em que ele traz a informação que importa,
ninguém lê.

### D-05 — A barra é clara, e isso não é escolha estética

O rodapé é `#0E3E5E`, e a simetria pediria uma barra navy. **Não é possível hoje:** o lockup Confere
é tinta navy `#00255B` sobre transparência — sobre fundo navy ele **desaparece**.

Uma barra escura exigiria uma variante reversa da marca, que não existe entre os ativos recebidos.
Fica em §10, ponto 1.

O contraste entre topo claro e base escura também tem lógica própria: o topo é área de trabalho e
pede leveza; a base é assinatura institucional e pede peso.

### D-07 — A marca é empilhada: logo em cima, assinatura embaixo

Decidido durante a implementação, revendo D-06.

A espec previa logo e assinatura **lado a lado**, com a assinatura saindo abaixo de `md`. Renderizado,
o arranjo lia errado: ao lado do logo a assinatura parecia **legenda da imagem**, um texto que
acompanha a marca. Ela não é isso — as duas orações **são** a marca, e é assim que aparecem no ativo
original recebido.

Empilhadas e alinhadas à esquerda do logo, elas voltam a ler como o que são.

Duas consequências, ambas assumidas:

- **A assinatura deixa de sumir em tela estreita.** O corte previsto em D-06 fazia sentido quando ela
  disputava a largura com a marca; empilhada, ela não disputa mais. A 390 px as duas orações ainda
  cabem em uma linha, com o divisor recolhido.
- **A faixa fica mais alta:** 73 px em vez dos ~56 px estimados. É o que custa a decisão, e é o que
  faz a `R-CAB-08` não fechar — ver §13.

### D-06 — A assinatura some abaixo de `md`

*(superada por D-07 — mantida como registro do raciocínio original)*

Na barra a assinatura ocupa largura que a marca e o contexto disputam. Abaixo de `md` ela sai, e a
marca continua dizendo o nome.

A assinatura não se perde do produto — ela permanece no `<title>` e na `description` dos metadados
(ESPEC 005), que é onde ela trabalha para quem chega de fora.

---

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `domain/` · `application/` · `infrastructure/` · `api/` | **Nenhuma** |
| `frontend/src/app/components/Barra.tsx` | Entra — a barra, com o slot de contexto |
| `frontend/src/app/page.tsx` | Sai o bloco de marca; o estado passa a alimentar o slot |
| `frontend/src/app/layout.tsx` | A barra entra acima de `{children}`, como o rodapé entrou abaixo |
| `frontend/src/lib/types.ts` | **Nenhuma** — os campos já estão tipados |

**Um detalhe de arquitetura:** o rodapé é estático e mora no `layout`. A barra **depende do estado da
página** — precisa saber se há relatório. Ou o estado sobe para um contexto compartilhado, ou a barra
fica na página e o `layout` cede o topo. A segunda é mais simples e não introduz contexto global por
causa de uma linha de texto; é a recomendada.

---

## 8. Testes e critério de aceite

| Nível | Cobertura |
|---|---|
| Estrutura | Existe um único landmark `<header>`; a marca não é link (`R-CAB-07`) |
| Estado inicial | O slot de contexto está **ausente do DOM**, não apenas invisível (`R-CAB-05`) |
| Estado pronto | O slot traz `contrato_referencia` e a competência, com o texto vindo da resposta |
| **Orçamento** | O primeiro `input[type=file]` começa acima de **y = 140** em 1366 × 768 (`R-CAB-08`) |
| Fixação | Após rolar 400 px com o grid na tela, a barra continua visível (`R-CAB-03`) |
| Marca única | Existe exatamente **uma** ocorrência do lockup na página (`R-CAB-09`) |
| Responsivo | A 390 px a marca não é comprimida e a assinatura não é exibida |
| Regressão | Os dois `input[type=file]` e o botão "Gerar relatório" seguem presentes — âncoras do teste de fumaça |

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Barra fixa comer altura em telas baixas | ~56 px contra os 185 px que ela substitui. `R-CAB-08` é o teto |
| Sobreposição da barra sobre o cabeçalho da tabela do grid | O grid não tem cabeçalho fixo próprio hoje. Se ganhar, os dois precisam ser empilhados na mesma pilha de `z-index` |
| O contexto ficar longo e quebrar a barra | `R-CAB-10`: quebra ou some, nunca espreme a marca |
| Duplicação da marca se `R-CAB-09` for esquecido | Teste de marca única em §8 |
| A barra clara enfraquecer a simetria com o rodapé | D-05, decisão consciente. Reversível quando houver marca reversa |

---

## 10. Pontos em aberto

| # | Questão | Impacto |
|---|---|---|
| 1 | Deve existir uma **variante reversa** do logo Confere, em branco, para fundo escuro? Ela liberaria a barra navy e simetria plena com o rodapé | Identidade |
| 2 | O slot deve trazer também a contagem de avisos, ou só o placar de divergências? | Densidade |
| 3 | O `titulo` do relatório deve aparecer em algum lugar, já que continuará descartado? | Conteúdo |
| 4 | ~~A barra deve ganhar um botão "Novo relatório" que limpa o estado?~~ **Decidido pela [ESPEC 015](015-limpar-para-recomecar.md), 2026-08-12 — e contra esta proposta em dois pontos.** O botão existe, chama-se **Limpar** (`D-01`: *Novo relatório* promete gerar, e ele descarta) e **não** fica na barra (`D-03`): `R-CAB-05` mantém o slot de contexto só para dado real, e o controle precisa existir também quando não há relatório. Ele mora no formulário, ao lado do primário | Escopo |

O ponto 4 é o único que muda o desenho. Os demais são incrementais.

---

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Componente `Barra` com marca e slot | P |
| B | Ligação com o estado da página e remoção do bloco de marca | P |
| C | Verificação — orçamento, fixação, marca única, responsivo | P |

**Total: poucas horas.** Nada no backend muda e o teste-âncora não é tocado.

---

## 12. Relação com a ESPEC 005

A `R-MRC-05` dizia que o nome acessível do `<h1>` é `Confere`, vindo do `alt` do lockup. Com a marca
migrando para a barra, a proposta é **revisá-la**:

> A marca na barra é identidade de aplicação, não título de página. O `<h1>` passa a descrever a
> tarefa — *Análise de medição contratual* —, e o lockup vira imagem com `alt` dentro da barra.

O ganho é de acessibilidade e de correção semântica: quem navega por cabeçalhos ouve o que a página
**faz**, e não como ela se chama, que já está no `<title>`. A `R-MRC-05` só deve ser alterada se esta
espec for aprovada.

As demais regras da ESPEC 005 seguem intactas — em especial `R-MRC-06`, o verde que não é cor de
texto, e `R-MRC-08`, a marca que não entra no documento.

**O que foi efetivamente feito:** a `R-MRC-05` **não foi alterada**. O `<h1>` continua na barra, com o
nome acessível `Confere` vindo do `alt`. A revisão acima segue sendo proposta, pendente de decisão —
ver §14, ponto 1.

---

## 13. Verificação, e a regra que não fechou

Medido em navegador, sobre o *build* de produção:

| Verificação | Resultado | |
|---|---|---|
| Altura da barra | **73 px** — 9,5% em 1366 × 768 | — |
| Ocorrências do lockup na página | **1** | `R-CAB-09` ✅ |
| Slot de contexto no estado inicial | **ausente do DOM** | `R-CAB-05` ✅ |
| Nome acessível do `<h1>` | `Confere` | `R-MRC-05` ✅ |
| Erros de console e respostas ≥ 400 | nenhum | ✅ |
| Formulário e botão "Gerar relatório" | presentes | regressão ✅ |
| **Topo do formulário em 1366 × 768** | **y = 185** | `R-CAB-08` ❌ **exige < 140** |

### O desvio, sem maquiagem

A `R-CAB-08` foi escrita quando a barra projetada tinha ~56 px, com a assinatura ao lado do logo. A
D-07 empilhou a marca por uma razão de leitura, e isso custou 17 px de faixa. Com `py-10` no `main` e
a instrução acima do formulário, o topo do formulário fica em **y = 185**, e não abaixo de 140.

O ganho real sobre o estado anterior existe e é relevante — **de y = 233 para y = 185, 48 px, 20%** —,
mas é metade do que a regra pedia.

**Não reescrevi a regra para caber no resultado.** Um critério de aceite que se ajusta ao que foi
entregue deixa de ser critério. Há três saídas, e a escolha é do solicitante:

| Saída | Efeito |
|---|---|
| Relaxar a `R-CAB-08` para < 190, registrando D-07 como a causa | Assume o custo da marca empilhada. Nada muda no código |
| Reduzir `py-10` → `py-8` no `main` e a margem da instrução | Leva a ~y = 169. Continua acima de 140 |
| Voltar a assinatura para o lado do logo | Fecha a regra e desfaz D-07 |

Enquanto não houver decisão, a espec fica com a regra **não atendida e declarada**, que é o estado
honesto.

---

## 14. Pontos em aberto após a implementação

| # | Questão |
|---|---|
| 1 | A `R-MRC-05` deve ser revisada, com o `<h1>` passando a descrever a tarefa? Ver §12 |
| 2 | Qual das três saídas da `R-CAB-08` adotar? Ver §13 |
| 3 | ~~Entra o botão "Novo relatório"?~~ **Entrou como *Limpar*, e fora da barra** — [ESPEC 015](015-limpar-para-recomecar.md), 2026-08-12. Ver §10, ponto 4 |
| 4 | O `<hr>` que separava marca e instrução **foi removido**: a borda inferior da barra passou a fazer esse trabalho. Confirmar |
