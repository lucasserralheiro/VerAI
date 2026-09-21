# VerAI — guia para sessões de IA

Plataforma Next.js/TypeScript (App Router) + Prisma/Postgres, multi-tenant, para produtos de
inteligência sobre documentos da PRODAM-SP. Qualquer sessão de IA que abrir este repositório deve
ler este arquivo primeiro.

## Convenções do projeto

- **Fluxo de planejamento**: mudança não trivial passa por um plano em
  `docs/superpowers/plans/AAAA-MM-DD-nome.md`, geralmente acompanhado de um design em
  `docs/superpowers/specs/AAAA-MM-DD-nome-design.md`. Os planos são tarefa por tarefa, TDD
  (teste falhando → implementação → teste passando → commit) — ver qualquer arquivo existente em
  `docs/superpowers/plans/` como referência de formato antes de escrever um novo.
- **Stack**: Next.js 15 (App Router, Turbopack), React 19, Prisma 6/Postgres, Tailwind 4,
  Jest + Testing Library, `@react-pdf/renderer` para relatórios em PDF, Vercel Blob para storage
  de upload (`src/lib/storage.ts`).
- **Domínios principais hoje**: `Cliente` → `Documento`/`Analise` (análise por IA de um documento
  isolado), `AnaliseConsolidada` e `AnaliseEvolucao` (comparações dentro/entre competências —
  vivem como abas em `src/app/clientes/[id]/[competencia]/page.tsx`), `PropostaComercial`
  (checagem de propostas comerciais: conferência determinística de totais + checagem por IA).
- **Padrão de relatório**: toda geração de relatório segue o mesmo desenho — campo
  `caminhoRelatorioPdf`/`relatorioGeradoEm` no model, serve do cache se o arquivo ainda existir no
  storage, senão gera e atualiza; grava acesso em `AcessoDocumento`. Ver
  `src/app/api/documentos/[id]/relatorio/route.ts`,
  `src/app/api/analises-consolidadas/[id]/relatorio/route.ts` e
  `src/app/api/analises-evolucao/[id]/relatorio/route.ts` como referência antes de criar uma rota
  de relatório nova.

## Iniciativa em andamento: integração do Confere

Em planejamento — **nenhum código ainda foi escrito**. Objetivo: trazer o serviço **Confere**
(sistema Python/FastAPI separado, mantido pela PRODAM, que compara contrato × medição e gera
relatório de comprovação) para dentro deste produto, como uma quarta aba em
`src/app/clientes/[id]/[competencia]/page.tsx`.

- **Design/decisões**: `docs/superpowers/specs/2026-09-21-integracao-confere-design.md`
- **Plano de execução**: `docs/superpowers/plans/2026-09-21-integracao-confere.md`

Qualquer sessão que for mexer nisso lê os dois documentos acima antes de tocar em código — eles
são a fonte de verdade sobre o que já foi decidido e o que falta. Ao avançar o trabalho, atualize
os dois (marque tarefa concluída, registre decisão nova) em vez de deixar o código divergir do que
está escrito ali.
