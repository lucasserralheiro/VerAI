# Aviso de imagem embutida na checagem por IA

**Data:** 2026-09-11
**Status:** aprovado

## Contexto

Rodando a checagem por IA (`docs/superpowers/specs/2026-09-11-checagem-ia-conversao-design.md`) numa proposta
real, ela achou várias divergências de texto de verdade — rodapé de página grudado em item de lista, parágrafo
inteiro faltando, linha que devia estar separada saindo unida. Ao ver o resultado, apareceu um risco que a
checagem atual **não cobre**: uma tabela ou gráfico que o PDF trouxe como imagem (em vez de texto) vira só
`![Imagem da página N](url)` no Markdown — nem a detecção de página-imagem (Etapa 1, só dispara em página quase
sem texto nenhum) nem a checagem por IA (Etapa 2, compara texto do `pdf.js`, que não vê imagem) percebem esse
caso numa página que tem bastante texto normal *e* uma figura no meio.

Cogitou-se também fazer a IA **corrigir** os trechos divergentes (não só apontar), no mesmo padrão de
`revisarPortugues.ts` ({antes, depois} + diff). Decisão: **fica de fora desta rodada** — o foco agora é deixar a
checagem mais completa (cobrir o buraco da imagem), não gerar correção automática. Continuação natural pra uma
spec futura, se fizer sentido depois.

## Mudança

Determinística, sem IA nova — o dado já existe em `converterPdfParaMarkdown`, só não era exposto.

### 1. `src/lib/extracao/pdfMarkdown.ts`

`ResultadoConversaoPdf` ganha:

```ts
export interface ResultadoConversaoPdf {
  markdown: string
  paginasImagem: number[]
  paginasConvertidas: PaginaConvertida[]
  /** Páginas (1-indexadas) com pelo menos uma imagem de CONTEÚDO embutida
   *  (![Imagem da página N]) — pode ser tabela, gráfico ou diagrama que o
   *  PDF trouxe como figura em vez de texto. Exclui página que já está em
   *  `paginasImagem` (essa já tem fluxo próprio de OCR). Ordenado, sem
   *  repetição. */
  paginasComImagem: number[]
}
```

Calculado a partir de `imagensFiltradas` (a lista de imagens já filtrada — descarta logo/rodapé/moldura via
`pdfImagens.ts`, e já exclui página de OCR): `[...new Set(imagensFiltradas.map(i => i.pagina + 1))].sort(...)`.

### 2. `POST /api/propostas-comerciais/[id]/checagem-ia`

Agrega `paginasComImagem` de todos os arquivos PDF da proposta (igual já faz com `paginasConvertidas`) e devolve
junto da resposta:

```ts
{ scoreExibido: number | null; trechosSuspeitos: TrechoSuspeito[]; paginasComImagem: number[] }
```

### 3. `src/lib/checagemIaEmAndamento.ts`

`ResultadoChecagemIa` ganha `paginasComImagem: number[]`. Normalização defensiva na borda (mesmo padrão já
aplicado pra `scoreExibido`/`trechosSuspeitos`): `Array.isArray(corpo?.paginasComImagem) ? corpo.paginasComImagem : []`.

### 4. `src/app/propostas-comerciais/[id]/painel-checagem-conversao.tsx`

Quando `paginasComImagem.length > 0`, mostra um aviso junto do score (mesma seção, sem sumir com o score nem
com a lista de trechos suspeitos — são informações independentes, as duas ficam):

> ⚠️ Página 8, 14 têm imagem embutida — pode ser uma tabela ou gráfico que não virou texto. Confira o PDF
> original nesses pontos.

## Testes

- `pdfMarkdown.test.ts`: página com imagem de conteúdo → `paginasComImagem` inclui a página; página sem imagem →
  não inclui; imagem numa página que também está em `paginasImagem` (OCR) → não duplica em `paginasComImagem`
  (já vem de `imagensFiltradas`, que já exclui essas páginas).
- `checagem-ia/route.test.ts`: agrega `paginasComImagem` de múltiplos arquivos PDF.
- `checagemIaEmAndamento.test.ts`: resposta sem o campo (ex.: mock antigo) não quebra — vira `[]`.
- `painel-checagem-conversao.test.tsx`: aviso aparece com `paginasComImagem` não vazio; some quando vazio; convive
  com score e trechos suspeitos na mesma tela.

## Fora de escopo

- IA corrigindo automaticamente os trechos divergentes — decisão explícita desta rodada, ver "Contexto".
- IA olhando a imagem pra dizer se é tabela de verdade — mantém a decisão já tomada (vision da DeepSeek é
  experimental/limitado demais); o aviso só aponta a página, quem confere é a pessoa.
