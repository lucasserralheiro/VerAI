# Rodapé de página não atravessa página — plano

**Goal:** Corrigir o defeito por trás de "tem como fazer pra nao pegar o rodape da pagina quando
for nem cabeçalho": rodapé de paginação (nunca termina em pontuação final) arrastava pro mesmo
bloco a primeira linha/linha de tabela da página SEGUINTE, engolindo o título ou início de tabela
que deveria abrir aquela página.

**Design:** `docs/superpowers/specs/2026-09-21-rodape-nao-atravessa-pagina-design.md` — causa raiz
medida no PDF real que originou o pedido, decisão de replicar em `absorverBloco` e
`absorverTabelaPorPosicao` a guarda de página que `detectarTabelaPorBordas` já tinha, achado
adicional (duas tabelas fantasma eliminadas de brinde num arquivo diferente) e o que fica de fora
(fusão de rodapé/título DENTRO da mesma página — mecanismo diferente, não corrigido aqui).

**Tech Stack:** TypeScript puro, `src/lib/extracao/pdfHtml.ts` + `pdfHtml.test.ts` (Jest).

---

### Task 1: guarda de página em `absorverBloco` e `absorverTabelaPorPosicao`

**Status:** ✅ Concluída em 21/09/2026 (commit pendente).

- [x] Reproduzido o defeito no PDF real que motivou o pedido (`SEI_147453498_Proposta_Comercial_
      934.pdf`) — confirmado via HTML gerado que rodapé sem pontuação final funde com o título da
      página seguinte no mesmo `<p>`
- [x] Confirmado que `detectarTabelaPorBordas` já tinha a guarda equivalente
      (`pdfTabelas.ts`) — usado como precedente, não reinventado
- [x] Escrito teste falhando em `pdfHtml.test.ts` para `absorverBloco` (rodapé sem pontuação final
      não funde com a primeira linha da página seguinte)
- [x] Escrito teste falhando em `pdfHtml.test.ts` para `absorverTabelaPorPosicao` (linha de vão
      largo no fim de uma página não forma tabela com linha de vão largo do início da seguinte)
- [x] Implementada a guarda em `absorverBloco` (checada antes de qualquer outra condição de
      parada do loop de continuação)
- [x] Implementada a guarda em `absorverTabelaPorPosicao` (na condição de crescimento do `while`),
      generalização proativa pedida explicitamente pelo usuário ("visando os outros arquivos q o
      usuario pode colocar") — mesma classe de defeito, função irmã
- [x] Verificado no PDF real: as três seções que abriam página grudadas no rodapé da anterior (C4.
      CONEXÃO INTERNET, DIMENSIONAMENTO E PREÇO DOS SERVIÇOS, ALOCAÇÃO DE RISCOS) saem cada uma em
      parágrafo próprio
- [x] Régua completa no corpus (20 arquivos), comparação controlada com/sem a guarda — zero
      diferença em qualquer métrica fora de `blocos gigantes`/`tabelas`; as duas que mudaram foram
      inspecionadas arquivo por arquivo (ver design doc) — nenhuma regressão de conteúdo
      encontrada, incluindo duas tabelas fantasma adicionais eliminadas de brinde em
      `SEI_162636771_Proposta_Comercial_1068 VN.pdf`
- [x] `tsc --noEmit` — nenhum erro novo (179 pré-existentes, todos em `services/confere/` e
      `src/app/confere/`, fora de escopo)
- [ ] Testes executados via Jest — não rodou nesta sessão (binário nativo do SWC ausente na ponte
      Linux; `node_modules` instalado no Windows). Usuário roda localmente antes do commit.
- [ ] Commit (aguardando confirmação do usuário)

**Pendência registrada, fora do escopo desta task** (ver design doc, seção "O que este design NÃO
resolve"):
1. Fusão de rodapé com título de seção DENTRO da mesma página (ex. "C7. SD-WAN" + "C7.3. ..." +
   rodapé da própria página 2 de `SEI_162636771...VN.pdf`, todos no mesmo `<p>`) — mecanismo
   diferente (nenhum dos três termina em pontuação final nem bate no heurístico de título atual),
   precisa de investigação própria, provavelmente reconhecimento do padrão literal do rodapé
   institucional como parada válida em qualquer posição do bloco.
2. Blocos de texto densos em dígito sem separador de coluna (listas de "Perfil A/B/C.../TIPO
   A/B/C..." em `PA-HSPM-260821-925 v2.pdf` e `Q-00910-20260916-1049 1.pdf`) que cruzaram o limiar
   de "bloco gigante" da régua por deslocamento de fronteira, não por mistura de conteúdo — pré-
   existente, é problema de heurística de lista/tabela sem vão largo, não desta task.
