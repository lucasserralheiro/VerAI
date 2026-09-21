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

## Reparo da camada de texto do PDF

PDF impresso via **"Microsoft: Print To PDF"** (em vez de exportado pelo Word)
vem com a tabela `ToUnicode` das fontes errada: o desenho na página está certo,
mas o texto extraído troca letras (`licenşas`, `confìrmação`, `execuçáo`). Não é
bug da nossa extração — qualquer biblioteca e o próprio Ctrl+C do Acrobat
devolvem o mesmo. `src/lib/extracao/repararTextoPdf.ts` conserta isso de forma
determinística (três regras: glifo impossível em português, padrão ortográfico
impossível, auto-consistência do documento), aplicado em `converterPdfParaHtml`
logo depois de `extractTextItems`.

Invariante que não se negocia: **token com dígito nunca é alterado** — valor,
código de serviço e data passam intactos sempre; glifo estranho dentro de número
vira alerta pra conferência humana, nunca correção. PDF são sai byte a byte
igual à entrada.

Antes de mexer nisso, leia
`docs/superpowers/specs/2026-09-21-reparo-camada-texto-pdf-design.md` — inclui a
causa raiz medida, o que ficou fora (tabela) e a recomendação de processo
(receber `.docx` em vez de PDF impresso).

## Régua da conversão

Antes de mexer em QUALQUER heurística de `src/lib/extracao` (tabela, título,
corredor, sublinhado), rode `npm run diag:pdf -- ./arquivos-teste-conversao`
antes e depois, nos mesmos arquivos, e compare. Defeito de conversão anda junto
com o GERADOR do PDF (`Microsoft: Print To PDF` quebra de um jeito, o
`wkhtmltopdf` do SEI de outro), e é por gerador que a régua agrega. Ajustar
constante no olho em cima do exemplar da vez conserta aquele documento e quebra
outros três.

O conversor NÃO deve ramificar por gerador: cada decisão sai da evidência do
próprio documento. O gerador serve pra medir e avisar.

## Integração do Confere

O serviço **Confere** (Python/FastAPI separado, mantido pela PRODAM, deploy em
`https://confere-backend.onrender.com` — plano free, cold start ~1min) compara contrato × medição
e gera relatório de comprovação (DOCX + XLSX). Dentro do VerAI ele vive em `/confere`
(`src/app/confere/`): **cópia fiel do frontend próprio do Confere**
(`services/confere/frontend/`, copiado wholesale nesta integração — mantido no repo só como
referência/fonte, não faz parte do build do VerAI), não uma tela redesenhada no estilo
institucional do VerAI. Mesmo texto, mesmo layout, mesma paleta (tokens `confere-*` em
`src/app/globals.css`, namespaced pra não colidir com a paleta institucional `navy`/`orange`).

**Decisão de arquitetura (2026-09-21, revista no mesmo dia — ver "Nota de processo" no design
doc):** a primeira versão desta integração (Tasks 3–7 do plano) entrou como uma quarta aba dentro
de `src/app/clientes/[id]/[competencia]/page.tsx`, com um model `AnaliseMedicaoContratual` no
Prisma vinculado a `Cliente` + competência, upload dedicado e upsert por competência. **Essa
versão foi removida no mesmo dia**, a pedido explícito do usuário: "não vamos vincular a cliente e
nada do tipo" + "ele precisa ficar a cópia do Confere, do mesmo jeito". A versão atual:

- **Sem vínculo com Cliente nem competência** — `/confere` é uma área solta no menu (como
  "Proposta Comercial"), não um passo dentro do fluxo de cliente.
- **Geração sem estado, com histórico ao lado** — a aplicação portada continua sem estado: sobe os
  arquivos, gera, baixa DOCX/XLSX. As duas tabelas da primeira versão foram revertidas por migração
  (`prisma/migrations/20260921160000_remove_analise_medicao_contratual/`). O que existe hoje é um
  **registro do que passou pela ferramenta**, adicionado depois a pedido do usuário
  (`model ConfereExecucao`, migração `20260921180000_add_confere_execucao`): o **nome** dos
  arquivos submetidos (contrato, levantamento e aditivos — os arquivos de entrada **não** são
  guardados em lugar nenhum) e os dois documentos gerados, no Vercel Blob, pra rebaixar sem repetir
  os ~25s. Continua sem vínculo com `Cliente` nem competência. A gravação é **best-effort** dentro
  do proxy: o relatório já está no corpo da resposta, e falha de storage ou de banco não derruba a
  entrega. A listagem vive em `/confere/historico` (sub-item do grupo "ConfereAI" no menu), servida
  por `/api/confere/execucoes`.
- **É a porta de entrada do sistema** — login e o middleware redirecionam para `/confere` (não
  mais `/clientes`), e é o terceiro grupo do menu lateral, depois de "Relatórios dos clientes" e "Proposta Comercial"
  (`src/components/nav-bar.tsx`) — a posição no menu é a do ambiente local, não a primeira.
- **Proxy próprio** (`src/app/api/confere/reports/route.ts`) — o navegador nunca fala direto com o
  Confere nem conhece `CONFERE_SHARED_SECRET`; a rota recebe o mesmo multipart que o Confere
  espera, chama `chamarConfere()` (`src/lib/confere/cliente.ts`, construído em Task 5 e reaproveitado
  sem mudanças) e devolve a resposta dele quase sem tocar. É também onde a execução é registrada no
  histórico, no caminho de sucesso e só nele.

- **Sem faixa de marca própria** — a barra de aplicação do Confere (logo + "Confere o contratado. /
  Confere o utilizado.") e o rodapé institucional da Prodam foram removidos: dentro do VerAI a
  identificação do produto é a barra lateral, e repetir marca em cima e embaixo roubava ~180 px de
  altura útil. A tela abre com um `<h1>` de texto ("ConfereAI") no padrão das outras páginas, e a
  referência do contrato + competência, que viviam na barra, ficam no cartão "Relatório gerado".

- **Design/decisões**: `docs/superpowers/specs/2026-09-21-integracao-confere-design.md`
- **Plano de execução**: `docs/superpowers/plans/2026-09-21-integracao-confere.md`

Qualquer sessão que for mexer nisso lê os dois documentos acima antes de tocar em código — eles
são a fonte de verdade sobre o que já foi decidido e o que falta. Ao avançar o trabalho, atualize
os dois (marque tarefa concluída, registre decisão nova) em vez de deixar o código divergir do que
está escrito ali.
