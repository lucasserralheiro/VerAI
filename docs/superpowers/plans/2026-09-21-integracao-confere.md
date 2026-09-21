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

**Status:** Não iniciada. Não é código — é configuração de infraestrutura.

- [ ] Criar Web Service no Render (free tier), Root Directory apontando para
      `services/confere/backend` (ou onde o `Dockerfile` ficar após o subtree)
- [ ] Configurar `CONFERE_SHARED_SECRET` como env var no Render
- [ ] Validar com uma chamada fria real (depois de 15+ min sem tráfego): cold-start + `POST /reports`
      completo sem erro, dentro de um tempo aceitável — registrar o tempo medido no design doc
- [ ] Decidir e documentar: fica no free tier, ou sobe direto pro Starter (remove spin-down)?

### Task 4: Model Prisma novo — detalhamento pendente

**Status:** Não iniciada. Antes de escrever a migração: ler
`services/confere/backend/src/api/schemas.py` (`RespostaRelatorio`, `RespostaBloqueada`) para saber
exatamente o formato que o Confere devolve, e decidir o nome final do model (sugestão de trabalho:
`AnaliseMedicaoContratual`).

- [ ] Definir campos: ligação a `Cliente` + competência (ano/mês, mesmo formato de
      `AnaliseConsolidada`), referências aos arquivos de entrada (contrato PDF, planilha XLSX,
      aditivos opcionais), referências aos arquivos de saída (`.docx`, `.xlsx`), status
      (concluído/bloqueado — espelhando o 422 do Confere), timestamps
- [ ] Escrever a migração manualmente (mesmo padrão de
      `prisma/migrations/20260916120000_add_conferencia_totais_proposta/migration.sql`)
- [ ] `npm run dev:generate` + `npm run dev:migrate`
- [ ] Commit

### Task 5: Rota de geração — detalhamento pendente

**Status:** Não iniciada. Depende da Task 4 (model) e de confirmar o formato exato da resposta do
Confere (Task 4's leitura de schemas.py).

- [ ] `POST /api/clientes/[id]/competencias/[competencia]/analise-medicao` (nome espelhando
      `/analise-consolidada` e `/analise-evolucao` já existentes)
- [ ] Multipart para o Confere (`POST /reports`), incluindo o header do segredo (Task 2)
- [ ] Decodifica o base64 da resposta, salva os dois arquivos via `putUpload` (mesmo padrão das
      rotas `/relatorio`)
- [ ] Trata o caso bloqueado (422 do Confere) — grava status "bloqueado" com os achados, não trata
      como erro genérico
- [ ] `maxDuration` explícito na rota (folga sobre cold-start do Render + ~30s de geração)
- [ ] Testes seguindo o padrão de `conferir-totais/route.test.ts` (mocks de fetch/prisma/storage)
- [ ] Commit

### Task 6: Endpoint de pré-checagem (opcional, mas barato)

**Status:** Não iniciada.

- [ ] Expor `POST /reports/conferencia-previa` do Confere como um passo de confirmação antes da
      geração pesada — decidir se entra nesta leva ou fica para depois
- [ ] Commit

### Task 7: Quarta aba em `clientes/[id]/[competencia]/page.tsx`

**Status:** Não iniciada. Depende da Task 5 (rota) estar pronta.

- [ ] Adicionar `'medicao'` (ou nome equivalente) ao tipo `Aba` e ao array `TABS`
- [ ] Upload de dois arquivos (contrato PDF + planilha XLSX), seguindo o padrão visual do upload já
      existente na aba "Documentos" desta mesma página
- [ ] Botão "Gerar relatório de medição" com loading/erro no mesmo padrão de
      `handleGerarConsolidada`
- [ ] Card de resultado: classificação por gravidade (crítico/sem medição/parcial/conforme) +
      links de download (`.docx` e `.xlsx`)
- [ ] Histórico de gerações anteriores da competência, mesmo padrão de "Ver histórico" da aba
      consolidada
- [ ] Testes (`page.test.tsx`)
- [ ] Commit

### Task 8: Atualizar os docs deste plano

**Status:** Contínua — fazer ao final de cada task acima.

- [ ] Marcar cada task como concluída neste arquivo conforme for terminando
- [ ] Registrar no design doc qualquer decisão nova tomada durante a implementação que não estava
      prevista (ex.: nome final do model, tempo real de cold-start medido)
