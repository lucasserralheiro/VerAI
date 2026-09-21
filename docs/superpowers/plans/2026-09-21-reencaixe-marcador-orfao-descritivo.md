# Marcador de lista órfão no DESCRITIVO — plano

**Goal:** Corrigir o defeito por trás da reclamação recorrente "o descritivo some" na conversão
de Proposta Comercial: marcador de lista ("•") que o PDF desenha separado do rótulo vira parágrafo
vazio, e o rótulo sem marcador vira título falso ou fica grudado num parágrafo vizinho.

**Design:** `docs/superpowers/specs/2026-09-21-reencaixe-marcador-orfao-descritivo-design.md` —
causa raiz medida item a item no PDF real, decisão de reencaixar o marcador na linha seguinte da
mesma página antes de título/lista serem avaliados, e o que fica de fora (rótulo de campo
promovido a título por outro motivo, sem marcador nenhum envolvido).

**Tech Stack:** TypeScript puro, `src/lib/extracao/pdfHtml.ts` + `pdfHtml.test.ts` (Jest).

---

### Task 1: `reencaixarMarcadoresOrfaos` em `pdfHtml.ts`

**Status:** ✅ Concluída em 21/09/2026 (commit pendente).

- [x] Reproduzido o defeito com `extractTextItems` direto no PDF real
      (`SEI_147453498_Proposta_Comercial_934.pdf`) — confirmado que todo marcador do documento
      sai como trecho de um caractere só, longe do rótulo na ordem do content stream, mesmo Y
- [x] Escrito teste falhando em `pdfHtml.test.ts` reproduzindo o formato exato medido (3
      marcadores órfãos seguidos dos respectivos rótulos, mesma página)
- [x] Escrito teste de guarda: marcador órfão no fim de uma página não funde com a primeira linha
      da página seguinte
- [x] Implementado `reencaixarMarcadoresOrfaos` + `ehMarcadorOrfao`, chamado logo após
      `agruparEmLinhas` rodar em todas as páginas, antes de `calcularTamanhoCorpo`/`montarHtml`
- [x] Verificado no PDF real: parágrafo-só-marcador 10→0, `<li>` 81→115, `<h2>` 37→24
- [x] Régua completa no corpus (11 arquivos + o novo) — zero regressão, confirmado também pelo
      usuário rodando localmente
- [x] `tsc --noEmit` — nenhum erro novo (os 179 pré-existentes são todos em `services/confere/` e
      `src/app/confere/`, fora de escopo)
- [ ] Testes executados via Jest — não rodou nesta sessão (binário nativo do SWC ausente na ponte
      Linux; `node_modules` instalado no Windows). Usuário roda localmente antes do commit.
- [ ] Commit (aguardando confirmação do usuário)

**Pendência registrada, fora do escopo desta task** (ver design doc, seção "O que este design NÃO
resolve"): rótulo de campo do descritivo (ex. "Disponibilidade", "Suporte ao Serviço") que nunca
teve marcador e vira `<h2>` só porque repete menos de 3 vezes no documento inteiro — mecanismo
diferente, precisa de investigação própria.
