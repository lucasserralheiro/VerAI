# Integração do Confere no VerAI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. **Este plano está em grão de tarefa — várias tasks
> precisam de uma passada de detalhamento (ler o schema real do Confere, decidir nomes de campo)
> antes de virarem passo a passo com testes, como as tasks completas em
> `docs/superpowers/plans/2026-09-16-conferencia-totais.md` fazem. Não pule essa passada.**

**Goal:** Dar à pessoa que revisa um contrato/medição de um cliente um jeito de gerar, direto do
VerAI, o relatório de comprovação (`.docx`) e a análise por gravidade (`.xlsx`) que hoje só o
Confere produz — sem sair do VerAI, sem duplicar a lógica de negócio do Confere.

**Architecture:** Ver `docs/superpowers/specs/2026-09-21-integracao-confere-design.md` — resumo:
Confere entra no repo via `git subtree` (código intocado, deploy separado no Render), VerAI ganha
um model novo ligado a `Cliente` + competência e uma quarta aba em
`src/app/clientes/[id]/[competencia]/page.tsx` que chama o Confere de forma síncrona e guarda o
resultado.

**Tech Stack:** Next.js (App Router, route handlers), Prisma/Postgres, React (client component),
Jest + Testing Library — do lado do VerAI. Python/FastAPI do lado do Confere (`services/confere/`,
inalterado exceto pela Task 2).

## Global Constraints

- **Nenhuma regra de negócio do Confere é reimplementada no VerAI.** O VerAI só chama, guarda e
  exibe o que o Confere devolve.
- A chamada ao Confere é **síncrona** (sem fila/status/polling) — decisão registrada no design doc
  §3.4, revisitar só se o volume de uso real justificar.
- Segue o mesmo padrão de cache/storage/auditoria das três rotas `/relatorio` já existentes — não
  inventar um padrão novo.
- Referência completa: `docs/superpowers/specs/2026-09-21-integracao-confere-design.md`.

---

### Task 1: Importar o Confere para `services/confere/`

**Status:** ✅ Concluída em 21/09/2026 — commit `abb0cdd`.

- [x] Verificado: `confere-main` não era um repositório git (sem `.git`) — não havia histórico de
      commits a preservar, então `git subtree` não se aplicava (ver design doc §3.2, correção)
- [x] Cópia direta de `confere-main` para `services/confere/` (22 MB, sem `node_modules`/`.venv`/
      `__pycache__` — já vinham limpos)
- [x] `.gitignore` do VerAI ganhou os padrões de artefato Python (`__pycache__/`, `.venv/`,
      `venv/`, `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`, `*.egg-info/`)
- [x] Commit isolado (`git add services/confere .gitignore` — não tocou nos outros arquivos já
      modificados no repo)
- [x] `uv sync` roda limpo na nova localização (fetch automático do Python 3.14, já que o
      sistema só tinha 3.10 e o projeto exige `>=3.12`)
- [x] Testes-âncora passam sem nenhuma mudança de código: `uv run python -m pytest
      tests/test_anchor_por_codigo.py tests/test_anchor_analise.py` → 22 passed em 39,63s
      (**não** a suíte completa — 1.422 testes / ~15min, documentados no README do Confere; rodar
      a suíte inteira antes de considerar isso pronto pra produção)
- [x] Nota de invocação: usar sempre `python -m pytest`, nunca `pytest` direto — vários testes
      importam `tests.outro_teste` como pacote, e só `-m` põe o diretório no `sys.path` (já
      documentado no README original do Confere, `services/confere/README.md`)
- [x] `.venv`/`__pycache__` gerados pelo `uv sync` já caem no `.gitignore` ajustado — `git status`
      confirma zero novidade em `services/confere/` além do que já estava commitado

### Task 2: Segredo compartilhado no Confere (única mudança de código nele)

**Status:** ✅ Concluída em 21/09/2026 — commit `50665dc`.

- [x] Env var `CONFERE_SHARED_SECRET` (não configurada = falha aberta, é o caso de dev local e
      da suíte de testes; obrigatória em produção no Render)
- [x] Middleware `_verificar_segredo_compartilhado` em `main.py`, mesmo padrão do
      `_cabecalhos_de_seguranca` já existente — header `X-Confere-Secret`, comparação em tempo
      constante (`hmac.compare_digest`), `/health` isento (health check da plataforma)
- [x] `tests/test_segredo_compartilhado.py` — 5 testes: sem segredo não bloqueia, com segredo
      rejeita sem header, rejeita header errado, aceita header certo, `/health` sempre isento
- [x] Suíte completa de `main.py`/`app` sem regressão: `test_api_e2e.py`,
      `test_identidade_contratual.py`, `test_responsividade.py`, `test_architecture.py` — 96
      testes, todos passando
- [x] Commit isolado (`50665dc`), mensagem registrando que é a única exceção a "Confere não
      muda"

### Task 3: Deploy do Confere no Render

**Status:** ✅ Concluída (2026-09-21).

- [x] Web Service criado no Render (free tier, Docker), Root Directory =
      `services/confere/backend`, Branch = `main`, source = commit `c851c60`
- [x] `CONFERE_SHARED_SECRET` configurado como env var no Render (mesmo valor usado nos testes de
      `test_segredo_compartilhado.py`); env var `PORT` (auto-preenchida pelo Render ao detectar o
      projeto, não usada pelo Dockerfile do Confere) removida
- [x] Deploy bem-sucedido — "Your service is live"; URL: `https://confere-backend.onrender.com`
- [x] Validado em produção via PowerShell do usuário (fora dos ambientes de automação, que têm
      allowlist de rede bloqueando `onrender.com`):
      - `GET /health` sem header → `200 {"status":"ok"}`
      - `POST /reports` sem header → `401 Não Autorizado` (confirma o middleware do segredo
        compartilhado ativo em produção, não só nos 5 testes locais)
- [ ] Pendente: medir o tempo real de cold-start (depois de 15+ min sem tráfego) numa chamada real
      de `POST /reports` — só vai acontecer organicamente quando a Task 5 estiver pronta e o VerAI
      fizer a primeira chamada de verdade; registrar o tempo medido aqui quando acontecer
- [ ] Pendente: decidir e documentar se fica no free tier ou sobe pro Starter (remove spin-down) —
      decisão adiada até sentir o impacto real do cold-start no uso

### Task 4: Model Prisma novo

**Status:** ⛔ Revertida (2026-09-21, mesmo dia — ver Task 9). Ficou concluída por algumas horas; o usuário pediu depois pra tirar o vínculo com cliente ("não vamos vincular a cliente e nada do tipo"), o que torna este model inteiro sem uso — a versão final não persiste nada. Migração de reversão:
`prisma/migrations/20260921160000_remove_analise_medicao_contratual/`. Detalhe fica abaixo, como registro histórico.

~~**Status:** ✅ Concluída (2026-09-21).~~ Model, migração escritos aqui; aplicados pelo usuário no
próprio terminal (este ambiente de automação não tem `docker` nem alcança `binaries.prisma.sh` —
mesma restrição de rede que bloqueou `onrender.com` na Task 3). Confirmado via
`npx prisma migrate status`: 13 migrações, banco em dia.

Decisão tomada (perguntada ao usuário): arquivos de entrada (contrato, levantamento, aditivos) são
upload **dedicado** nesta análise, sem reaproveitar o model `Documento` — mais simples, não mistura
com o pipeline de análise por IA que já está ligado a `Documento`.

- [x] Nome final: `AnaliseMedicaoContratual` (+ `AnaliseMedicaoContratualArquivo` para os arquivos
      de entrada, um por contrato/levantamento/aditivo — papel guardado em `papel`)
- [x] Campos definidos: ligação a `Cliente` + competência (ano/mês, `@@unique` por competência,
      mesmo formato de `AnaliseEvolucao`), `resultado Json?` guardando a `RespostaRelatorio`
      estruturada do Confere (grid, análise por gravidade, linhas derivadas/zeradas, divergências
      de fonte — tudo, menos os `*_base64`), `achadosBloqueio Json?` para o caso bloqueado
      (`RespostaBloqueada`), `identidadeConfirmada Boolean` espelhando o parâmetro do Confere,
      `status` (`processando | concluido | bloqueado | erro`), `caminhoRelatorioDocx`/
      `caminhoRelatorioXlsx`/`relatorioGeradoEm` para os dois arquivos gerados
- [x] Migração escrita manualmente em
      `prisma/migrations/20260921130000_add_analise_medicao_contratual/migration.sql` (mesmo
      padrão de `.../20260916120000_add_conferencia_totais_proposta/migration.sql`)
- [x] Usuário rodou `npm run dev:generate` + `npm run dev:migrate` — aplicado sem drift
- [x] Commit (`445ed41`)

### Task 5: Rota de geração

**Status:** ⚠️ Parcialmente revertida (2026-09-21, mesmo dia — ver Task 9). `src/lib/confere/cliente.ts` (`chamarConfere()`) sobreviveu inteiro e é reaproveitado pela rota nova. A rota `/api/clientes/[clienteId]/competencias/[competencia]/analise-medicao` em si, e tudo que dependia do model da Task 4 (persistência, `putUpload`, upsert por competência), foi removido e substituído pela rota sem estado da Task 9. Detalhe fica abaixo, como registro histórico.

~~**Status:** ✅ Concluída (2026-09-21).~~

- [x] `src/lib/confere/cliente.ts` — `chamarConfere()`: multipart pro Confere (`POST /reports`),
      header `X-Confere-Secret` (Task 2), devolve um tipo discriminado
      (`concluido | bloqueado | erro`) — resolve a diferença entre os dois formatos de 422 do
      Confere (bloqueio estruturado x falha de extração) antes de chegar na rota. 7 testes
      (commit `b1b91cb`)
- [x] `POST /api/clientes/[clienteId]/competencias/[competencia]/analise-medicao` (nome espelhando
      `/analise-consolidada` e `/analise-evolucao` já existentes)
- [x] Decodifica o base64 da resposta, salva os dois arquivos via `putUpload`
      (`buildRelatorioMedicaoPath`, novo em `storage.ts`)
- [x] Trata o caso bloqueado (422 do Confere) — grava `achadosBloqueio` com status "bloqueado",
      devolve 422 (espelha o Confere); erro de infraestrutura (rede, 401, 500, 422 de extração)
      devolve 502 com `mensagemErro`
- [x] Arquivos de ENTRADA (contrato/levantamento/aditivos) sobem pro Blob sempre, qualquer que
      seja o resultado — auditoria da tentativa; cada POST sobrescreve o estado da competência
      (upsert único, reflete sempre a tentativa mais recente — decisão tomada aqui, não estava no
      plano original)
- [x] `maxDuration = 120` explícito na rota
- [x] Testes seguindo o padrão de `conferir-totais/route.test.ts` (mocks de auth/prisma/
      visibilidade/storage/confere) — 12 testes
- [x] `jest.config.ts` ganhou `testPathIgnorePatterns` pra `services/confere/` — os e2e Playwright
      copiados na Task 1 batiam no testMatch padrão do Jest sem ser testes do VerAI
- [x] Suíte inteira confirmada sem regressão pelo usuário: 66 suítes, 485 testes
- [x] Commits (`b1b91cb` cliente do Confere, `b064ed7` rota + jest.config)

### Task 6: Endpoint de pré-checagem (opcional, mas barato)

**Status:** Não iniciada.

- [ ] Expor `POST /reports/conferencia-previa` do Confere como um passo de confirmação antes da
      geração pesada — decidir se entra nesta leva ou fica para depois
- [ ] Commit

### Task 7: Quarta aba em `clientes/[id]/[competencia]/page.tsx`

**Status:** ⛔ Revertida (2026-09-21, mesmo dia — ver Task 9). O usuário pediu que o Confere deixasse de ser um passo dentro do fluxo de cliente e virasse a tela de entrada do sistema, sem vínculo com cliente nenhum — a aba inteira (tipo `Aba`, entrada em `TABS`, estados, `handleGerarMedicao`, o bloco JSX e os 3 testes) foi removida. Detalhe fica abaixo, como registro histórico.

~~**Status:** ✅ Concluída (2026-09-21).~~

- [x] `'medicao'` adicionado ao tipo `Aba` e ao array `TABS` (label "Medição contratual")
- [x] Upload de contrato (PDF) + levantamento (XLSX) + aditivos (PDF, opcional, múltiplos)
- [x] Botão "Gerar análise de medição" com loading/erro no mesmo padrão de
      `handleGerarConsolidada`/`handleGerarEvolucao`
- [x] Três estados tratados: bloqueado (achados + checkbox "confirmo mesmo assim" quando
      `pode_prosseguir`, reenviando os mesmos arquivos), erro (mensagemErro), concluído (resumo +
      links de download `.docx`/`.xlsx` — URLs públicas do Blob direto, sem rota de proxy)
- [x] Testes (`page.test.tsx`) — 3 novos
- [x] Commit (`961f3b8`)
- [ ] **Não implementado, fora do escopo desta leva**: histórico de gerações anteriores da
      competência. A Task 5 decidiu um registro único por competência (cada `POST` sobrescreve) —
      sem histórico não tem o que listar; virar histórico exigiria mudar esse modelo de dados
      (não fazer upsert, manter uma linha por tentativa) — decisão consciente de simplicidade,
      revisitar se o usuário sentir falta na prática

### Task 9: Revisão — cópia solta do Confere, porta de entrada do sistema (substitui Tasks 4/5/7)

**Status:** ✅ Concluída (2026-09-21, mesmo dia das Tasks 4/5/7). Ver design doc §3.7 pro porquê —
resumo: o usuário pediu, em sequência, pra tirar o vínculo com cliente, virar a tela de entrada, e
ficar "a cópia do Confere, do mesmo jeito" (com print do frontend de verdade do Confere).

- [x] `src/app/confere/` — cópia de `services/confere/frontend/src/app/{page,layout}.tsx` +
      `components/*` (9 arquivos) + `lib/{types,documento}.ts`, import paths ajustados pra
      relativo, classes de cor prefixadas `confere-*`
- [x] `src/app/globals.css` — tokens `--color-confere-*`/`--confere-*` (paleta TRIADE do Confere:
      teal, navy em escala, severidade, brand, prodam) + regra `dialog::backdrop` (usada pelo
      `<dialog>` nativo de `ConfirmarLimpeza.tsx`)
- [x] `public/logo-confere.png` + `public/prodam-branca.svg` copiados de
      `services/confere/frontend/public/`
- [x] `src/app/confere/lib/api.ts` — só `API_BASE_URL` mudou, de `NEXT_PUBLIC_API_URL` pra
      `/api/confere` (o resto do arquivo é idêntico ao original)
- [x] `src/app/api/confere/reports/route.ts` — proxy sem estado, reaproveita `chamarConfere()` da
      Task 5, devolve a resposta do Confere quase sem tocar (200/422/erro); `maxDuration = 120`.
      6 testes (`route.test.ts`)
- [x] `POST /reports/conferencia-previa` **não** tem proxy próprio (Task 6 continua não
      implementada) — `conferirIdentidade()` recebe 404 do próprio VerAI e segue por falha aberta
      (comportamento já previsto no código original, `R-IDT-12`)
- [x] Removido por completo: rota antiga (Task 5), aba "medicao" (Task 7), models
      `AnaliseMedicaoContratual`/`AnaliseMedicaoContratualArquivo` + relação em `Cliente` (Task 4),
      `buildRelatorioMedicaoPath`/`buildArquivoMedicaoPath` (`storage.ts`, sem uso), migração de
      reversão `20260921160000_remove_analise_medicao_contratual`
- [x] `src/middleware.ts` + `src/app/login/{login-form,dev-login-form}.tsx` redirecionam pra
      `/confere` em vez de `/clientes`; testes atualizados
- [x] `src/components/nav-bar.tsx` — grupo "ConfereAI" (com sub-item "Histórico"), terceiro do menu,
      depois de "Relatórios dos clientes" e "Proposta Comercial"; marca do topo também leva pra
      `/confere`; testes novos
- [ ] **Pendente (usuário ainda não rodou):** `npx prisma migrate dev`/`migrate deploy` (aplicar a
      migração de reversão), `npx tsc --noEmit`, suíte completa do Jest, `npm run dev` pra
      conferir visualmente contra o print que o usuário mandou
- [ ] Commit

### Task 8: Atualizar os docs deste plano

**Status:** Contínua — fazer ao final de cada task acima.

- [ ] Marcar cada task como concluída neste arquivo conforme for terminando
- [ ] Registrar no design doc qualquer decisão nova tomada durante a implementação que não estava
      prevista (ex.: nome final do model, tempo real de cold-start medido)
