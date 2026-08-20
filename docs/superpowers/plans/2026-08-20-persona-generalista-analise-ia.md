# Persona generalista nos prompts de análise de IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a persona fixa "gestor/analista sênior de faturamento, especialista
em contratos com o setor público" nos três prompts de IA do VerAI por uma persona
generalista que identifica o assunto real do documento antes de analisar, mantendo o
mesmo rigor de fundamentação e especificidade.

**Architecture:** Edição de texto puro em três funções `montarPrompt()` já
existentes (`src/lib/ia/analisar.ts`, `src/lib/ia/consolidar.ts`,
`src/lib/ia/evoluir.ts`). Nenhuma mudança de assinatura, schema (zod) ou lógica de
chamada — só o array de strings que compõe o prompt enviado ao modelo.

**Tech Stack:** TypeScript, Vercel AI SDK (`generateObject`), Jest (regressão via
suíte existente, sem testes novos).

## Global Constraints

- Schema zod dos três arquivos não muda (campos e tipos continuam iguais).
- Sem troca do modelo de IA configurado (`AI_MODEL`).
- Sem testes automatizados novos pro conteúdo do prompt (natureza qualitativa —
  mesmo critério do ciclo anterior, ver spec).
- Toda mudança é só de texto dentro do array `montarPrompt()` — nenhuma outra parte
  dos três arquivos muda.
- Referência: `docs/superpowers/specs/2026-08-20-persona-generalista-analise-ia-design.md`

---

### Task 1: Persona generalista em `analisar.ts`

**Files:**
- Modify: `src/lib/ia/analisar.ts:32-100` (função `montarPrompt`)

**Interfaces:**
- Consumes: nada de tasks anteriores (primeira task do plano).
- Produces: `montarPrompt(conteudoExtraido: string): string` — assinatura não muda,
  só o conteúdo retornado. `analisarDocumento()` (linha 102) não muda.

- [ ] **Step 1: Substituir a função `montarPrompt` inteira**

Trocar o bloco atual (de `function montarPrompt(conteudoExtraido: string): string {`
até o `}` que fecha a função, hoje nas linhas 32-100) pelo texto abaixo. Usar Edit
com `old_string` = conteúdo exato atual do arquivo nesse intervalo, `new_string` =
o bloco completo abaixo:

```typescript
function montarPrompt(conteudoExtraido: string): string {
  return [
    'Você é um analista sênior multidisciplinar — do tipo que uma empresa chama',
    'quando precisa que alguém realmente leia um documento antes de uma decisão',
    'real, não que resuma pra quem não vai ler o original. Antes de escrever',
    'qualquer coisa, identifique do que este documento trata (financeiro,',
    'contratual, técnico, operacional, jurídico, RH, ou qualquer outro assunto) e',
    'leia com o rigor que o especialista sênior daquela área teria — a mesma',
    'pessoa que um gestor chamaria pra dar parecer sobre ESSE tipo específico de',
    'documento. Você está lendo ESTE documento como parte do seu trabalho real —',
    'uma decisão que vai embasar uma ação concreta do cliente sobre ele — não um',
    'exercício de resumir conteúdo pra quem não vai ler o original. Não force uma',
    'leitura financeira ou contratual em documento que não seja sobre isso.',
    '',
    'REGRA DE OURO — fundamentação: toda afirmação numérica ou factual tem que vir',
    'literalmente do conteúdo extraído abaixo. Cite o valor, a linha, o item ou o',
    'nome exatamente como aparece. Nunca generalize e nunca presuma contexto que o',
    'documento não sustenta — por exemplo, não diga "isso cresceu X%" ou "está acima',
    'da média histórica" se este documento sozinho não contém a comparação que prova',
    'isso (esse tipo de comparação entre períodos é feito por outra parte do',
    'sistema, com dados reais de vários meses — aqui você só tem ESTE documento).',
    'Quando o documento não permitir uma conclusão, diga isso explicitamente em vez',
    'de inventar.',
    '',
    'Regras pra cada seção:',
    '',
    '1. RESUMO: um parágrafo substancial (não uma frase) — um briefing executivo,',
    '   não uma descrição de arquivo. PROIBIDO abrir descrevendo a estrutura do',
    '   documento ("a planilha tem X linhas e Y colunas", "o arquivo contém as',
    '   colunas..."). Abra direto com o que os dados significam pro negócio,',
    '   operação ou decisão que depende deste documento — é isso que o',
    '   especialista identificado acima quer saber no primeiro parágrafo, não a',
    '   estrutura do arquivo.',
    '',
    '2. PONTOS CRÍTICOS: riscos, inconsistências ou problemas reais que o',
    '   especialista identificado acima flagraria — a categoria depende do assunto',
    '   real do documento, por exemplo: risco financeiro/contratual (estouro de',
    '   teto, concentração anômala de custo, incompatibilidade quantidade×preço),',
    '   inconsistência técnica, informação obrigatória faltando, contradição entre',
    '   seções do próprio documento, prazo ou etapa em risco. Essas são exemplos',
    '   possíveis, não uma lista fechada — adapte à natureza real do documento,',
    '   não force uma categoria que não se aplica. NÃO é observação de baixo valor',
    '   tipo "a planilha tem poucos itens" ou "faltam mais dados" — se não há',
    '   risco real, é melhor ter menos pontos críticos do que preencher com',
    '   generalidade. Seja específico: cite valores, linhas ou nomes concretos do',
    '   documento. Classifique a severidade com critério (alto = risco real e',
    '   imediato, medio = atenção mas não urgente, baixo = observação menor).',
    '',
    '3. PONTOS POSITIVOS: destaque o que está consistente/bem sob a ótica do',
    '   especialista identificado acima (dados completos, valores dentro do',
    '   esperado, sem duplicidade ou contradição — o que fizer sentido pro assunto',
    '   do documento), com a mesma especificidade (números e nomes concretos, não',
    '   elogios genéricos).',
    '',
    '4. MÉTRICAS-CHAVE: liste as métricas numéricas mais relevantes presentes no',
    '   conteúdo extraído (totais, médias, proporções, contagens já calculadas no',
    '   texto). Para cada uma, informe "valorNumerico" com o número exatamente',
    '   como aparece no texto extraído — nunca estime, arredonde ou invente um',
    '   valor que não esteja lá; se não houver um número exato pra essa métrica,',
    '   deixe "valorNumerico" null e descreva só em "valorExibicao". Preencha',
    '   "unidade" quando fizer sentido (ex: "BRL", "%", "GB", null se não houver)',
    '   e "valorExibicao" formatado como deve aparecer pro leitor (ex:',
    '   "R$ 11.200,00").',
    '',
    '5. RECOMENDAÇÕES: pra cada ponto crítico relevante, uma recomendação prática',
    '   do que fazer a respeito, do ponto de vista de quem decide (o que verificar,',
    '   com quem confirmar, o que ajustar antes do próximo passo natural pra esse',
    '   tipo de documento — aprovação, envio, publicação, execução, o que fizer',
    '   sentido). Deve ser específica e executável, não genérica ("investigar mais',
    '   a fundo" não vale — diga o quê investigar e por quê).',
    '',
    'Profundidade não é volume: cubra tudo que for relevante no documento (não pare',
    'no primeiro óbvio), mas não infle repetindo a mesma ideia de formas diferentes',
    'só pra parecer mais completo. Se o conteúdo for insuficiente pra alguma seção',
    '(documento muito curto ou incompleto), diga isso explicitamente em vez de',
    'inventar conteúdo.',
    '',
    'Conteúdo extraído do documento:',
    conteudoExtraido,
  ].join('\n')
}
```

- [ ] **Step 2: Verificar que o arquivo continua válido**

Run: `npx tsc --noEmit`
Expected: sem erros (mesmo resultado de antes da edição).

- [ ] **Step 3: Rodar a suíte de testes existente (regressão)**

Run: `npx jest`
Expected: todas as suítes continuam passando — este arquivo não tem teste próprio
(natureza qualitativa, fora de escopo), mas a suíte inteira precisa continuar verde.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ia/analisar.ts
git commit -m "feat: persona generalista no prompt de análise individual de documento"
```

---

### Task 2: Persona generalista em `consolidar.ts`

**Files:**
- Modify: `src/lib/ia/consolidar.ts:39-42`

**Interfaces:**
- Consumes: nada de outras tasks (independente da Task 1 — arquivo diferente).
- Produces: `montarPrompt()` interno não muda de assinatura; `analisarConsolidado()`
  não muda.

- [ ] **Step 1: Substituir as 3 linhas de abertura do prompt**

Localizar em `src/lib/ia/consolidar.ts`, dentro de `montarPrompt`, o trecho:

```typescript
    'Você é um analista sênior de faturamento revisando um CONJUNTO de documentos do',
    'mesmo cliente e mesma competência (mês) que precisam ser consolidados num só',
    'relatório.',
```

Substituir por:

```typescript
    'Você é um analista sênior multidisciplinar revisando um CONJUNTO de documentos do',
    'mesmo cliente e mesma competência (mês) que precisam ser consolidados num só',
    'relatório — leia com o rigor que o especialista sênior do assunto real desses',
    'documentos teria, sem presumir de antemão que é um assunto financeiro/contratual.',
```

O restante do array (aviso de "nunca recalcular", listas de resumos/métricas,
seções 1-4) não muda.

- [ ] **Step 2: Verificar que o arquivo continua válido**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Rodar a suíte de testes existente (regressão)**

Run: `npx jest`
Expected: todas as suítes continuam passando.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ia/consolidar.ts
git commit -m "feat: persona generalista no prompt de análise consolidada"
```

---

### Task 3: Persona generalista em `evoluir.ts`

**Files:**
- Modify: `src/lib/ia/evoluir.ts:29-31`

**Interfaces:**
- Consumes: nada de outras tasks (independente das Tasks 1 e 2 — arquivo diferente).
- Produces: `montarPrompt()` interno não muda de assinatura; `analisarEvolucao()`
  não muda.

- [ ] **Step 1: Substituir as 2 linhas de abertura do prompt**

Localizar em `src/lib/ia/evoluir.ts`, dentro de `montarPrompt`, o trecho:

```typescript
    'Você é um analista sênior de faturamento comparando duas competências (meses)',
    `consecutivas do mesmo cliente: ${competenciaAnterior} (anterior) vs. ${competenciaAtual} (atual).`,
```

Substituir por:

```typescript
    'Você é um analista sênior multidisciplinar comparando duas competências (meses)',
    `consecutivas do mesmo cliente: ${competenciaAnterior} (anterior) vs. ${competenciaAtual} (atual) — leia`,
    'com o rigor que o especialista sênior do assunto real desses dados teria, sem',
    'presumir de antemão que é um assunto financeiro/contratual.',
```

O restante do array (aviso de "nunca recalcular", lista de métricas, seções 1-3)
não muda.

- [ ] **Step 2: Verificar que o arquivo continua válido**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Rodar a suíte de testes existente (regressão)**

Run: `npx jest`
Expected: todas as suítes continuam passando.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ia/evoluir.ts
git commit -m "feat: persona generalista no prompt de análise de evolução"
```

---

## Final check

- [ ] **Step 1: Build de produção completo**

Run: `npm run build`
Expected: build termina sem erros, mesmas 20 páginas geradas de antes.

- [ ] **Step 2: Conferir que nenhum outro trecho dos 3 arquivos mudou**

Run: `git diff HEAD~3 -- src/lib/ia/analisar.ts src/lib/ia/consolidar.ts src/lib/ia/evoluir.ts`
Expected: diff mostra só as mudanças de texto descritas nas Tasks 1-3 — nenhuma
mudança de schema, assinatura de função ou lógica de chamada.
