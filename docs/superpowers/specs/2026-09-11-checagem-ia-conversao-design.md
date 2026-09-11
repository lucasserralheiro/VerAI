# Checagem por IA da conversão PDF → Markdown (Proposta Comercial)

**Data:** 2026-09-11
**Status:** aprovado

## Contexto

A Proposta Comercial (Conversão SEI) converte PDF/Excel/Word em Markdown de forma **100%
determinística, sem IA** (spec original `2026-08-25-proposta-comercial-design.md`), com uma exceção
já aberta: a revisão ortográfica sob demanda (`revisarPortugues.ts`), que só troca palavra por
palavra, nunca reescreve estrutura.

Duas lacunas motivam esta revisão:

1. **Página-imagem sem texto.** Quando um PDF vem escaneado (ou tem um trecho colado como imagem), o
   conversor não extrai texto nenhum daquele ponto — a imagem simplesmente entra como figura no
   Markdown, ou o documento inteiro falha (`status: 'erro'`). Já existe um design aprovado pra isso,
   `2026-08-31-ocr-fallback-proposta-comercial-design.md`, usando **tesseract.js local no
   navegador** — nunca foi implementado. Esta revisão **retoma esse plano tal como está desenhado**,
   sem mudança: é a fonte do texto bruto de página-imagem que a Etapa 2 abaixo consome.
2. **Sem sinal de confiabilidade da conversão.** A heurística determinística (fonte, posição, traços
   vetoriais — ver `2026-08-25-proposta-comercial-design.md` seção 4) é boa mas *best-effort*: célula
   mesclada, layout incomum ou tabela sem borda ainda podem sair errados, e hoje nada aponta isso —
   a pessoa só descobre relendo o documento inteiro contra o PDF original.

**Por que a checagem compara texto, não imagem.** A DeepSeek só lê imagem por um modelo
**experimental** separado (`deepseek-v4-flash-vision-exp`, lançado em agosto/2026), que redimensiona
a página pra ~800×800px com um teto de 384 tokens pra parte visual — pouco pra uma página densa de
texto, com risco real de inventar/errar trecho. Isso contraria o princípio central do módulo ("sem
inventar nem um caractere") e a decisão já tomada no design de OCR de manter dado sensível fora da
nuvem. Por isso a checagem por IA desta revisão é **só texto**: compara o texto bruto já extraído
(via `pdf.js`, ou via tesseract quando a página é imagem) contra o Markdown final — nunca manda a
imagem da página pra IA. Usa o mesmo `getModel()` já abstraído em `src/lib/ia/modelo.ts` (hoje
configurado pra DeepSeek via `AI_PROVIDER`), sem hard-code de provedor — mesma decisão já tomada em
`2026-09-09-provedor-deepseek-design.md`.

## Escopo

- Só **PDF** entra na checagem por IA — é onde a heurística de posição/fonte pode errar. `.xlsx`/
  `.docx` usam conversão estrutural direta (mammoth / planilha), sem heurística de posição, risco bem
  menor — fora de escopo por ora (YAGNI).
- Score e trechos suspeitos são **só informativos** — nunca bloqueiam `rascunho`→`concluido` (esse
  gate continua existindo só pra OCR pendente, como já desenhado).
- Sem coluna nova no banco: nada disso é persistido — roda em cache de sessão do navegador (mesmo
  padrão da revisão de português) e é recalculado se a página recarregar.

## Fluxo revisado

```
Upload → conversão determinística (sem IA, como hoje) → editor abre imediatamente
                                                              │
                                    (se há :::ocr-pendente)   │
                                    ┌─────────────────────────┘
                                    ▼
                         ETAPA 1 — OCR local (tesseract.js)
                         design já aprovado (2026-08-31), retomado sem mudança:
                         botão "Rodar OCR" → conferência lado a lado → texto aceito
                                    │
                                    ▼ (assim que não sobra nenhum :::ocr-pendente)
                         ETAPA 2 — Checagem por IA (nova)
                         roda sozinha, sem botão — painel mostra "Verificando com IA..."
                                    │
                                    ▼
                    score geral (%, nunca 100%) + lista de trechos suspeitos
```

Documento sem página-imagem pula direto pra Etapa 2 ao abrir o editor. As duas etapas vivem no
**mesmo painel** (seção "UI" abaixo) — a pessoa vê um fluxo só, não dois recursos separados pra
entender a relação entre eles.

## Etapa 1 — OCR local (sem mudança de design)

Implementa exatamente `2026-08-31-ocr-fallback-proposta-comercial-design.md`: detecção de
página-imagem em `pdfMarkdown.ts`/`pdfTracos.ts`, marcador `:::ocr-pendente` no texto,
`tesseract.js` carregado sob demanda no navegador, conferência lado a lado obrigatória, gate de
`status` no `PATCH`. Essa spec já está aprovada — aqui só é referenciada como pré-requisito da Etapa
2, que precisa do texto de página-imagem já aceito pela pessoa antes de rodar a checagem daquela
página.

## Etapa 2 — Checagem por IA

**O que compara, por página do PDF:** o texto bruto extraído pelo `pdf.js` daquela página (o que
`pdfMarkdown.ts` já extrai antes de formatar) contra o trecho do `conteudoMarkdown` salvo
correspondente. `converterPdfParaMarkdown` (que a Etapa 1 já muda pra devolver
`{ markdown, paginasImagem }`) passa a devolver também o texto bruto por página e a posição de cada
página dentro do Markdown final — a mesma passada `Linha.pagina` que a função já percorre, sem
segunda extração. A checagem roda recalculando essa mesma função sobre o PDF original (buffer já
disponível via `storage.ts`, igual ao modal "Ver PDF original") — determinística, então bate com o
que está salvo desde que a pessoa ainda não tenha editado manualmente aquela página. **A checagem
audita a conversão automática, não edições manuais feitas depois** — por isso ela roda uma vez, ao
abrir o editor, e não fica recalculando a cada tecla digitada.

**Página que passou por OCR fica de fora da checagem por IA.** O `pdf.js` não extrai texto nenhum de
página escaneada — comparar isso contra o Markdown (que ali tem o texto reconhecido pelo tesseract)
sempre pareceria uma divergência enorme, gerando falso positivo garantido em toda página de OCR. E o
marcador `:::ocr-pendente` é removido exatamente na conferência (Etapa 1), então na hora da Etapa 2
não sobra como isolar "qual trecho veio de OCR" dentro do Markdown pra tratar diferente. Como essas
páginas já passam por conferência humana obrigatória lado a lado com a imagem — um gate mais forte
que uma auditoria de IA —, a Etapa 2 simplesmente **pula toda página que apareceu em
`paginasImagem`**, sem tentar checá-la.

**Chamada de IA** — mesmo padrão de `src/lib/ia/revisarPortugues.ts`: `generateObject` com schema
Zod, um bloco por página (ou agrupamento de páginas curtas), `Promise.allSettled` pra um bloco ruim
não derrubar a checagem inteira.

```ts
const schemaBloco = z.object({
  scoreConfianca: z.number().min(0).max(1),
  trechosSuspeitos: z.array(z.object({
    pagina: z.number(),
    trecho: z.string(), // trecho do Markdown final, pra localizar no texto
    motivo: z.string(),  // curto, em português
  })),
})
```

Prompt: compara texto original da página com o Markdown gerado; aponta só **divergência real de
conteúdo** (texto sumido, número/data trocado, célula de tabela faltando) — nunca estilo, escolha de
formatação Markdown ou reordenação cosmética.

**Agregação do score** — feita no código, não pela IA: `scoreDocumento = média dos scoreConfianca de
todos os blocos avaliados`. Documento onde toda página é de OCR (nenhum bloco pra checar) não tem
score — o painel mostra só "Sem páginas de texto nativo pra checar automaticamente; revise o conteúdo
de OCR manualmente" em vez de um número.

## Score — "nunca 100%"

Garantia estrutural, não de prompt (não dá pra confiar que o modelo "obedeça" um teto dentro do
JSON):

```ts
const scoreExibido = Math.min(Math.round(scoreDocumento * 100), 99)
```

Mesmo que todo bloco volte `1.0`, o teto no código impede "100%" de aparecer. Um texto fixo de
disclaimer acompanha sempre o score (ex.: "87% de confiabilidade (estimativa da IA) — confira os
trechos abaixo antes de finalizar"), reforçando que é estimativa, nunca garantia.

## UI — painel único no editor e na tela final

Novo componente `painel-checagem-conversao.tsx`, reaproveitando internamente o `ocr-runner.tsx` (
Etapa 1) e um novo bloco de resultado (Etapa 2). Cache de sessão em
`src/lib/checagemIaEmAndamento.ts`, no mesmo padrão de `revisaoPortuguesEmAndamento.ts`
(`Map<propostaId, ...>`, promise em andamento sobrevive a trocar de aba) — só que **inicia sozinho**
ao montar, em vez de esperar clique.

- **Há `:::ocr-pendente`:** mostra o runner de OCR (fluxo já desenhado). A Etapa 2 não inicia
  enquanto sobrar marcador.
- **Sem marcador (de início, ou assim que o último trecho é conferido):** dispara a checagem
  automaticamente — "Verificando com IA... pode sair desta aba, continua rodando" (mesmo texto-guia
  já usado na revisão de português).
- **Pronta:** score + disclaimer fixo + lista de trechos suspeitos (página, trecho, motivo) — só
  aponta, não corrige automaticamente (diferente da revisão de português: aqui não existe um "Markdown
  corrigido" pra aceitar, é a pessoa que edita à mão se concordar com o apontamento).
- **Erro:** mesmo padrão visual das outras checagens de IA do módulo.
- Aparece **sempre visível** (não atrás de aba escondida) tanto no editor (`rascunho`) quanto na tela
  final (`concluido`) — mesmo espírito do "Editar novamente" já existente: a pessoa não precisa
  reabrir nada pra ver o resultado.

## Arquivos afetados

**Extração**
- `src/lib/extracao/pdfMarkdown.ts` — `converterPdfParaMarkdown` passa a devolver também texto bruto
  por página e posição de cada página no Markdown final, além de `paginasImagem` (já previsto na
  Etapa 1).

**IA**
- `src/lib/ia/checarConversao.ts` *(novo)* — orquestração `generateObject` por bloco/página,
  agregação de score, teto de 99%. Espelha `revisarPortugues.ts`.
- `src/lib/ia/checarConversao.test.ts` *(novo)*.

**API**
- `src/app/api/propostas-comerciais/[id]/checagem-ia/route.ts` *(novo)* — `POST`, mesmo formato de
  `revisao-portugues/route.ts`: busca o(s) PDF(s) original(is) via `storage.ts`, recalcula texto
  bruto por página, chama `checarConversao`, devolve score + trechos.

**UI**
- `src/app/propostas-comerciais/[id]/painel-checagem-conversao.tsx` *(novo)* — compõe OCR (Etapa 1)
  + resultado da checagem (Etapa 2) num painel só.
- `src/lib/checagemIaEmAndamento.ts` *(novo)* — cache de sessão, início automático.
- `src/app/propostas-comerciais/[id]/editor-markdown.tsx` — monta o painel novo (substitui o lugar
  onde o runner de OCR isolado entraria).
- `src/app/propostas-comerciais/[id]/proposta-final.tsx` — mostra o mesmo painel (modo resultado, sem
  OCR) na tela final.

**Dependências**
- `tesseract.js` (Etapa 1, já previsto no design de OCR — entra em `dependencies` agora).

## Testes

- `pdfMarkdown.test.ts` — novo retorno com texto bruto por página e posição no Markdown.
- `checarConversao.test.ts` — bloco com divergência real → `trechosSuspeitos` preenchido; bloco
  idêntico → score alto, lista vazia; um bloco falhando não derruba os outros
  (`Promise.allSettled`); agregação de score; teto de 99% mesmo com `scoreConfianca: 1`.
- `painel-checagem-conversao.test.tsx` — estados (OCR pendente → verificando → pronto/erro),
  recuperação ao trocar de aba (mock do cache de sessão).
- `checagem-ia/route.test.ts` — mesmo padrão de `revisao-portugues/route.test.ts`.
- Testes da Etapa 1 (`rodarOcr.test.ts`, `pdfTracos.test.ts` etc.) seguem como já especificados em
  `2026-08-31-ocr-fallback-proposta-comercial-design.md`.

## Risco conhecido

- **Falso positivo/negativo.** A IA pode apontar um trecho correto como suspeito, ou deixar passar
  uma divergência real — por isso é só informativo, nunca um gate, e o disclaimer fixo deixa isso
  explícito.
- **JSON mode da DeepSeek** é menos rigoroso que tool-mode de Anthropic/Google (risco já registrado em
  `2026-09-09-provedor-deepseek-design.md`) — mesmo tratamento: `.nullable()` nos campos e
  `Promise.allSettled` por bloco absorvem falha de validação isolada sem derrubar a checagem inteira.
- **Custo/tempo.** Um documento de muitas páginas dispara um bloco de IA por página — mais chamadas
  que a revisão de português (que agrupa por ~6000 caracteres). Ajuste fino de agrupamento fica pro
  plano de implementação, seguindo o mesmo `dividirEmBlocos` já existente, adaptado pra respeitar
  fronteira de página em vez de só parágrafo.

## Fora de escopo

- Ler a imagem da página diretamente por IA (vision) — decisão explícita desta revisão, ver seção
  "Contexto".
- Checagem de `.xlsx`/`.docx` — YAGNI, ver "Escopo".
- Score bloqueando finalização — decisão explícita: só informativo.
- Persistir score/trechos no banco — recalculado por sessão, sem coluna nova.
- Reescrita automática do trecho suspeito pela IA — a pessoa decide e edita à mão; a IA só aponta.
- Recalcular a checagem após edição manual — roda uma vez ao abrir o editor (ou ao terminar o OCR),
  não a cada alteração no texto.
