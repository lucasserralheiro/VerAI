# VerAI — Suporte a Word e análise de IA como especialista (design)

**Módulo**: 10 (novo) do roteiro do VerAI — depende dos módulos 1-9 (já implementados)
**Status**: Aprovado para implementação
**Data**: 19/08/2026

---

## 1. Objetivo

Dois problemas relatados sobre a análise de documentos (Excel, PDF, e agora Word):

1. **Word (.docx) não é aceito** — foi deixado de fora de propósito no módulo 3
   original ("Suporte a Word" ficou como extensão futura). Precisa passar a
   funcionar, no mesmo padrão de Excel/PDF (upload, extração, análise,
   preview, download, relatório PDF).
2. **Análise da IA está rasa** — hoje descreve estrutura do documento
   ("a planilha tem X linhas e Y colunas") em vez de interpretar como um
   especialista de negócio leria. Precisa virar leitura de gestor de
   faturamento sênior — profunda, fundamentada 100% no conteúdo real do
   documento, sem generalizar ou presumir contexto que não está lá.

Vale pros três tipos de documento (Excel, PDF, Word), já que os três passam
pela mesma função de análise (`analisarDocumento`).

---

## 2. Suporte a Word (.docx)

### 2.1 Extração — `src/lib/extracao/docx.ts`

Nova dependência: `mammoth` (extração de texto/HTML de `.docx`, sem
dependência de binário externo — mesmo espírito de `exceljs`/`unpdf` já
usados no projeto).

```
src/lib/extracao/
└── docx.ts → extrairDocx(buffer): Promise<string>
              converterDocxParaHtml(buffer): Promise<string>
```

- `extrairDocx()`: usa `mammoth.extractRawText({ buffer })`, texto truncado
  em ~60.000 caracteres (mesmo limite já usado em `pdf.ts`, controle de
  custo de tokens) — vai pra IA.
- `converterDocxParaHtml()`: usa `mammoth.convertToHtml({ buffer })`, devolve
  o HTML gerado (`.value`) — só pra pré-visualização na tela, nunca pra IA.

`extrairConteudo()` (`src/lib/extracao/index.ts`) ganha o `case 'docx'`.

### 2.2 Upload

`TIPOS_SUPORTADOS` em `POST /api/documentos` ganha `'docx'`. Input de
upload em `/clientes/[id]/[competencia]` ganha `.docx` no `accept`.

### 2.3 Download do original

`CONTENT_TYPES` em `GET /api/documentos/[id]/original` ganha
`docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'`.

### 2.4 Preview na tela

`.docx` não renderiza nativo no navegador. `GET /api/documentos/[id]/preview`
ganha um branch pra `tipo === 'docx'`: lê o arquivo, chama
`converterDocxParaHtml()`, devolve o HTML direto (`Content-Type: text/html`)
em vez do JSON estruturado usado por xlsx/csv.

Em `documentos/[id]/page.tsx`, o componente `DocumentoOriginal` ganha um
branch pra `docx`: mesmo padrão de `<iframe>` já usado pra PDF, só que
apontando pra `/api/documentos/[id]/preview` (que agora devolve HTML) em vez
de `/original?modo=preview`.

### 2.5 Fora de escopo

- Formatos antigos do Word (`.doc` binário, pré-2007) — só `.docx`
  (Office Open XML), mesmo critério que Excel só aceita `.xlsx` (não `.xls`
  binário antigo, apesar do tipo `xls` existir no schema por precaução).
- Preservar formatação rica na pré-visualização além do que `mammoth`
  já converte por padrão (títulos, parágrafos, listas, negrito) — sem
  CSS customizado.

---

## 3. Análise de IA como especialista

Reescreve `montarPrompt()` em `src/lib/ia/analisar.ts` — mesma função usada
pelos três tipos de documento, então a melhoria vale pra Excel, PDF e Word
de uma vez. **Sem mudança de schema** (`resumo`, `pontosCriticos`,
`pontosPositivos`, `metricasChave`, `recomendacoes` continuam iguais) —
só a qualidade do conteúdo gerado.

Mudanças no prompt:

1. **Persona explícita** no início: gestor de faturamento sênior,
   especialista em contratos com o setor público (SEI, secretarias,
   fornecedores como Microsoft/Azure), lendo o documento como parte do
   trabalho real — não um resumo acadêmico de conteúdo.

2. **Regra de fundamentação reforçada** (já existia, fica mais explícita e
   com exemplo concreto): toda afirmação numérica ou factual tem que vir
   literalmente do conteúdo extraído — citar valor/linha/nome como aparece.
   Proibido generalizar ou presumir contexto que o documento não sustente
   (ex: não afirmar "cresceu X%" se não há comparação no próprio
   documento — isso é papel da análise de evolução do módulo 9, não da
   análise individual).

3. **RESUMO vira briefing executivo**: proibido abrir descrevendo estrutura
   do arquivo ("a planilha tem X linhas e Y colunas") — tem que abrir com o
   que aquilo significa pro contrato/orçamento/operação.

4. **PONTOS CRÍTICOS viram riscos de negócio reais**: risco de estourar
   teto contratual, concentração anômala num item, incompatibilidade
   quantidade×preço, campo obrigatório faltando, inconsistência entre
   seções do documento — não observação genérica de baixo valor tipo
   "poucos itens na planilha". Se não houver risco real, é válido ter
   menos pontos críticos (não preencher por preencher).

5. **Profundidade ≠ volume**: cobrir tudo que for relevante no documento
   (não parar no primeiro óbvio), mas sem inflar repetindo a mesma ideia de
   formas diferentes só pra parecer mais completo.

`lib/ia/consolidar.ts` e `lib/ia/evoluir.ts` (módulo 9) já abrem com
"Você é um analista sênior de faturamento" — mantém como está, sem
mudança nesta leva (fora de escopo, ver seção 4).

---

## 4. Fora de escopo (por ora)

- Reescrever os prompts de `consolidar.ts`/`evoluir.ts` (módulo 9) — já
  têm a régua de "nunca recalcular, só interpretar números prontos"; se a
  qualidade deles também precisar de ajuste, é um ciclo separado.
- Trocar o modelo de IA configurado (`AI_MODEL`) — problema relatado é de
  prompt, não de capacidade do modelo.
- Testes automatizados pro prompt em si (natureza qualitativa, não dá pra
  asserir com precisão em teste unitário) e pra `docx.ts` — nem `excel.ts`
  nem `pdf.ts` têm teste hoje, `docx.ts` segue a mesma linha.
