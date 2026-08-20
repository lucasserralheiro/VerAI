# VerAI — Persona generalista nos prompts de análise de IA (design)

**Módulo**: ajuste no módulo 10 (análise de IA como especialista) — mesmos 3 prompts
**Status**: Aprovado para implementação
**Data**: 20/08/2026

---

## 1. Objetivo

Os três prompts de IA do VerAI (`analisar.ts`, `consolidar.ts`, `evoluir.ts`) abrem
fixando a persona como "gestor/analista sênior de **faturamento**, especialista em
**contratos com o setor público**" (SEI, secretarias, Microsoft/Azure). Como não há
garantia de que os documentos enviados são sempre desse universo, essa persona fixa
está causando dois problemas:

1. Documentos que não são de faturamento/contrato saem com leitura forçada ou pobre
   (a IA tenta encaixar tudo numa lente financeira/contratual que não se aplica).
2. Mesmo em documentos que são de faturamento, a lista fechada de exemplos de "ponto
   crítico" (teto contratual, SEI, fornecedores específicos) faz a análise ficar
   centrada só nesses achados, ignorando outras informações relevantes do documento.

**Objetivo**: trocar "especialista fixo num assunto" por "especialista sênior que
primeiro identifica do que o documento trata, e lê com o rigor que o especialista
daquela área teria" — mantendo tudo que já funciona bem (fundamentação 100% no
conteúdo real, resumo como briefing e não descrição de estrutura, "profundidade ≠
volume", proibição de generalidade vazia).

**Sem mudança de schema** (zod) em nenhum dos três arquivos — só o texto dos prompts.
**Sem testes novos** — mesmo critério do ciclo anterior (natureza qualitativa, não dá
pra asserir com precisão em teste unitário).

---

## 2. `src/lib/ia/analisar.ts` — leitura individual do documento

Reescreve `montarPrompt()`. Abaixo, cada trecho que muda (o resto — regra de ouro de
fundamentação, seção de MÉTRICAS-CHAVE, parágrafo final "profundidade não é volume" —
fica exatamente como está, já é genérico).

### 2.1 Persona (abertura)

De:

> Você é um gestor de faturamento sênior, especialista em contratos com o setor
> público (SEI, secretarias, fornecedores como Microsoft/Azure). Você está lendo ESTE
> documento como parte do seu trabalho real — uma decisão de negócio que vai embasar
> cobrança, renovação de contrato ou envio pro SEI — não um exercício de resumir
> conteúdo pra quem não vai ler o original.

Para:

> Você é um analista sênior multidisciplinar — do tipo que uma empresa chama quando
> precisa que alguém realmente leia um documento antes de uma decisão real, não que
> resuma pra quem não vai ler o original. Antes de escrever qualquer coisa, identifique
> do que este documento trata (financeiro, contratual, técnico, operacional, jurídico,
> RH, ou qualquer outro assunto) e leia com o rigor que o especialista sênior daquela
> área teria — a mesma pessoa que um gestor chamaria pra dar parecer sobre ESSE tipo
> específico de documento. Você está lendo ESTE documento como parte do seu trabalho
> real — uma decisão que vai embasar uma ação concreta do cliente sobre ele — não um
> exercício de resumir conteúdo pra quem não vai ler o original. Não force uma leitura
> financeira ou contratual em documento que não seja sobre isso.

### 2.2 RESUMO

Troca só a referência ao que o resumo precisa comunicar:

De: "Abra direto com o que os dados significam pro contrato, orçamento ou operação do
cliente — é isso que um gestor de faturamento quer saber no primeiro parágrafo".

Para: "Abra direto com o que os dados significam pro negócio, operação ou decisão que
depende deste documento — é isso que o especialista identificado acima quer saber no
primeiro parágrafo".

### 2.3 PONTOS CRÍTICOS

De:

> riscos de negócio reais que um gestor de faturamento experiente flagraria — risco de
> estourar teto contratual, concentração anômala de custo num único item,
> incompatibilidade entre quantidade e preço unitário, campo obrigatório faltando,
> inconsistência entre seções do próprio documento.

Para:

> riscos, inconsistências ou problemas reais que o especialista identificado acima
> flagraria — a categoria depende do assunto real do documento, por exemplo: risco
> financeiro/contratual (estouro de teto, concentração anômala de custo,
> incompatibilidade quantidade×preço), inconsistência técnica, informação obrigatória
> faltando, contradição entre seções do próprio documento, prazo ou etapa em risco.
> Essas são exemplos possíveis, não uma lista fechada — adapte à natureza real do
> documento, não force uma categoria que não se aplica.

O resto do item (proibição de generalidade vazia, especificidade, critério de
severidade) fica igual.

### 2.4 PONTOS POSITIVOS

De: "destaque o que está consistente/bem sob a ótica de quem audita faturamento
(dados completos, preços dentro do esperado, sem duplicidade)".

Para: "destaque o que está consistente/bem sob a ótica do especialista identificado
acima (dados completos, valores dentro do esperado, sem duplicidade ou contradição —
o que fizer sentido pro assunto do documento)".

### 2.5 RECOMENDAÇÕES

De: "o que ajustar antes de mandar pro SEI".

Para: "o que ajustar antes do próximo passo natural pra esse tipo de documento —
aprovação, envio, publicação, execução, o que fizer sentido".

---

## 3. `src/lib/ia/consolidar.ts` — análise consolidada de vários documentos

Só a linha de abertura muda; o resto (aviso de "nunca recalcular, só interpretar
números prontos", estrutura das 4 seções) fica igual, já é genérico.

De:

> Você é um analista sênior de faturamento revisando um CONJUNTO de documentos do
> mesmo cliente e mesma competência (mês) que precisam ser consolidados num só
> relatório.

Para:

> Você é um analista sênior multidisciplinar revisando um CONJUNTO de documentos do
> mesmo cliente e mesma competência (mês) que precisam ser consolidados num só
> relatório — leia com o rigor que o especialista sênior do assunto real desses
> documentos teria, sem presumir de antemão que é um assunto financeiro/contratual.

---

## 4. `src/lib/ia/evoluir.ts` — comparação entre competências (meses)

Mesma lógica, só a linha de abertura muda.

De:

> Você é um analista sênior de faturamento comparando duas competências (meses)
> consecutivas do mesmo cliente: {anterior} vs. {atual}.

Para:

> Você é um analista sênior multidisciplinar comparando duas competências (meses)
> consecutivas do mesmo cliente: {anterior} (anterior) vs. {atual} (atual) — leia com
> o rigor que o especialista sênior do assunto real desses dados teria, sem presumir
> de antemão que é um assunto financeiro/contratual.

---

## 5. Fora de escopo

- Mudança de schema (zod) nos três arquivos — campos e tipos continuam iguais.
- Troca do modelo de IA configurado (`AI_MODEL`) — ajuste é de prompt, não de
  capacidade do modelo.
- Testes automatizados pro prompt em si — mesma justificativa do ciclo anterior
  (natureza qualitativa).
- Validação empírica com documentos reais de domínios variados — fica pra quem usar
  o sistema no dia a dia reportar se a leitura generalista está funcionando bem;
  não há um conjunto de documentos de teste de domínios diferentes disponível agora.
