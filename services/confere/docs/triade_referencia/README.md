# TRIADE — Documento de Referência Técnica

> Análise de engenharia do repositório `C:\GIT\pn1015-triade`, realizada em 2026-08-05.
> Objetivo: registrar **stacks**, **arquitetura** e **padronização** do projeto TRIADE como
> material de referência para outros times/projetos.

---

## 1. Identificação do Projeto

| Item | Valor |
|---|---|
| **Nome** | TRIADE — Triagem, Revisão e Análise Inteligente de Documentos |
| **Domínio** | Validação automatizada de documentos de credenciamento/habilitação (licitações) |
| **Organização** | PRODAM / Prefeitura de São Paulo |
| **Marco atual** | v6.0 — "Aderência à Rotina Licitatória e Conformidade" |
| **Natureza** | Monorepo com dois deployables (backend API + frontend web), multi-tenant |
| **Licença** | Proprietário — PRODAM |

**Proposta de valor central** (extraída de `.planning/PROJECT.md` / `STATE.md`):

> Plataforma de validação configurável e *organization-aware* — novos editais, tipos de
> documento, regras, prompts, organizações e acessos são geridos **por dados e telas de admin,
> não por deploy de código**.

Essa é a decisão arquitetural mais influente do projeto: praticamente tudo que seria
"regra de negócio hardcoded" está modelado como linha de banco (tipos de documento, regras,
prompts de classificação e de análise, limites de capacidade, preços de token).

---

## 2. Stacks

### 2.1 Backend — Python / FastAPI

| Camada | Tecnologia | Versão / Observação |
|---|---|---|
| Linguagem | Python | `requires-python = ">=3.10"`; imagem Docker usa **3.12-slim** |
| Gerenciador de pacotes | **uv** (Astral) | `uv.lock` versionado; binário pinado `ghcr.io/astral-sh/uv:0.11.13` |
| Framework web | FastAPI + Uvicorn | `fastapi>=0.111`, `uvicorn>=0.30` |
| Validação / DTOs | Pydantic v2 | `pydantic>=2.0` |
| ORM | SQLAlchemy 2.x | estilo `Mapped[]` / `mapped_column` |
| Banco | PostgreSQL | driver `psycopg2-binary` |
| Migrações | Alembic | `backend/alembic/versions/` |
| Autenticação | `fastapi-azure-auth` + `msal` + `python-jose` | Microsoft Entra ID (OIDC) |
| LLM | `openai` (Azure OpenAI) | modelo GPT-5.1 via deployment Azure |
| OCR | `azure-ai-documentintelligence` | Azure Document Intelligence (ADI) |
| Storage | `azure-storage-blob` | Azure Blob Storage |
| PDF | `pypdf`, `pypdfium2`, `reportlab`, `Pillow` | leitura, render de páginas e geração com *highlights* |
| Rate limiting | `slowapi` | aplicado na API de integração |
| Cripto | `cryptography` (Fernet), HMAC | segredos de integração e assinatura de callbacks |
| Testes | pytest | **70 arquivos** em `backend/tests/` |
| Lint / tipos / SAST | **ruff**, **mypy**, **bandit** | grupo `dev` do `pyproject.toml` |

**Observação importante:** não há LangChain nem qualquer framework de orquestração de LLM.
As chamadas ao Azure OpenAI são feitas diretamente pelo adapter
`infrastructure/llm/azure_openai_adapter.py`. (A doc interna `.planning/codebase/STACK.md`
cita LangChain — está desatualizada; ver §6.)

### 2.2 Frontend — Next.js / TypeScript

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | **Next.js 15.5.18** (App Router) | *não* 14, apesar do README |
| Runtime UI | React 18 + React DOM | `^18` |
| Linguagem | TypeScript | `^5` |
| Gerenciador de pacotes | **pnpm** | `pnpm-lock.yaml` com bloco `overrides` de segurança |
| Estilo | Tailwind CSS 3.4 + CSS Variables | `darkMode: "class"` |
| Primitivas de UI | `@base-ui/react` + shadcn (`style: base-nova`) | `components.json` presente |
| Ícones | `lucide-react` | |
| Data fetching | **SWR 2.4** | wrapper próprio `useApi` |
| Autenticação | **NextAuth v5 beta** (`5.0.0-beta.30`) | provider Microsoft Entra ID |
| PDF | `react-pdf` (pdf.js) | `canvas`/`encoding` desabilitados no webpack |
| Gráficos | `recharts` 3.x | dashboards operacionais |
| Busca client-side | `fuse.js` | |
| Utilitários | `clsx`, `tailwind-merge`, `class-variance-authority`, `tw-animate-css` | |
| Lint | ESLint + `eslint-config-next` | |

### 2.3 Infraestrutura & DevOps

| Item | Solução |
|---|---|
| Containerização | Docker — `backend/Dockerfile` (single-stage, uv) e `frontend/Dockerfile` (3 estágios, `output: standalone`, usuário não-root) |
| Hospedagem | **Azure Container Apps** |
| Deploy | `deploy.sh` (~32 KB, bash + `az` CLI + `docker` + `jq`); alvos `all` / `backend` / `frontend`; `destroy.sh` para teardown |
| Migrações em produção | Executadas por um **Container Apps Job** antes do rollout (orquestrado pelo `deploy.sh`) |
| Config de deploy | `deploy/.env` (a partir de `deploy/.env.example`) |
| Atualização de dependências | **Dependabot** semanal (`uv` p/ backend, `npm` p/ frontend, `github-actions`), com agrupamento minor+patch |
| Pipeline de CI | **Ausente** — não há `.github/workflows/`; existe apenas um documento de projeto `ci_cd_agent.md` |
| Gate local de qualidade | **Git hook `pre-commit`** versionado em `scripts/git-hooks/`, ativado por `./scripts/install-hooks.sh` (`core.hooksPath`) |

### 2.4 Serviços Azure consumidos

- **Azure OpenAI** — classificação e validação de documentos (GPT-5.1), geração de parecer final.
- **Azure Document Intelligence** — OCR com layout, coordenadas e detecção de manuscritos.
- **Azure Blob Storage** — arquivos originais e PDFs anotados.
- **Microsoft Entra ID** — autenticação (OIDC) e **Microsoft Graph** para convites B2B.
- **Azure Retail Prices API** — sincronização diária de preços para o módulo de custo de IA.

---

## 3. Arquitetura

### 3.1 Visão macro

```
┌────────────────────┐        Bearer id_token (Entra ID)
│  Next.js 15 (App   │        + X-Organization-Id
│  Router) — SWR     │ ─────────────────────────────────────┐
└────────────────────┘                                      │
         ▲ NextAuth v5 (Entra ID)                           ▼
         │                                    ┌─────────────────────────┐
   ┌─────┴──────┐                             │   FastAPI (Clean Arch)  │
   │  Usuário   │                             │  api / application /    │
   └────────────┘                             │  domain / infrastructure│
                                              └─────────────────────────┘
   ┌────────────────────┐  API Key + HMAC        │    │      │       │
   │ Sistema externo    │ ──────────────────────►│    │      │       │
   │ (portal parceiro)  │ ◄── callback assinado  │    │      │       │
   └────────────────────┘                        ▼    ▼      ▼       ▼
                                          PostgreSQL  ADI  Azure   Blob
                                                          OpenAI  Storage
```

### 3.2 Clean Architecture no backend

Quatro pastas sob `backend/src/`, com a regra de dependência apontando para dentro:

```
api/                 ← Interface HTTP (FastAPI): routers, schemas, middleware, tasks
  routers/           ← 21 routers (documents, submissions, participants, stats,
                       integration, health_entra, auth_me + 11 routers admin_*)
  middleware/        ← IntegrationBatchSizeLimitMiddleware
  tasks.py           ← Orquestração do pipeline (BackgroundTasks)

application/         ← Orquestração; sem detalhe de framework
  use_cases/         ← ValidateDocumentUseCase, CreateSubmissionUseCase,
                       use_cases/integration/ (5 casos de uso do fluxo externo)
  services/          ← PromptBuilderService, FinalReportService, AutoFinalizeService,
                       CallbackDispatchService, DashboardMetricsService
  dtos/              ← ValidationRequest, ValidationResponse

domain/              ← Regra de negócio pura, sem dependência de framework
  entities/          ← Document, DocumentIdentification, ValidationResult, ValidationRule
  value_objects/     ← DocumentType, Confidence, ValidationStatus, CNPJ
  interfaces/        ← Ports: ILLMClient, IGuardrailEngine, IDocumentTypeRepository,
                       IRuleRepository, IEvidenceValidator, IEventLogger

infrastructure/      ← Todo I/O e detalhe técnico (adapters dos ports acima)
  database/  llm/  ocr/  storage/  pdf/  auth/  entra/  repositories/
  guardrails/        ← Motor de validação em 2 etapas
  segmentation/      ← Stage 0: segmentação automática de PDFs consolidados
  integration/       ← API externa: HMAC, Fernet, rate limit, callbacks com retry
  audit/  locking/  logging/  observability/  validation/  config/  di/
```

Pontos notáveis da implementação:

- **Ports & Adapters explícitos.** `domain/interfaces/` define os contratos; cada adapter em
  `infrastructure/` os implementa (ex.: `GuardrailEngineAdapter`, `EventLoggerAdapter`,
  `StringEvidenceValidator`, `DocumentTypeRepositoryAdapter`).
- **DI container manual** (`infrastructure/di/container.py`) com cache de singletons e um
  factory `create_validation_use_case()`. Não há biblioteca de DI — é um IoC container
  escrito à mão, cobrindo o caminho de validação de documentos.
- **`api/` fora de `infrastructure/`.** A documentação (README/CLAUDE.md) descreve
  `infrastructure/api/`, mas o código real tem `src/api/` como camada irmã — o que é, na
  prática, mais fiel à Clean Architecture (camada de *interface adapters*).
- **PYTHONPATH aponta para `src/`.** Todos os imports são absolutos a partir de `src/`
  (`from infrastructure.database.models import ...`), inclusive no Dockerfile (`ENV PYTHONPATH=/app/src`).

### 3.3 Pipeline de validação

O processamento é assíncrono, disparado por `BackgroundTasks` do FastAPI e orquestrado por
`api/tasks.py::process_submission_task`.

**Stage 0 — Segmentação automática** (`infrastructure/segmentation/`)
Detecta a forma do upload: *um arquivo por tipo* (fluxo legado) ou *um PDF consolidado*, que é
fatiado automaticamente em documentos-filho. Estratégia **"OCR uma vez, depois fatia"**: o ADI é
chamado uma única vez sobre o PDF consolidado e o texto de cada segmento é extraído dos
marcadores `--- PÁGINA N ---`, eliminando re-chamadas de OCR por segmento. Componentes:
`boundary_detector`, `coverage_repair`, `page_digest`, `gate`, `stage0_prompt_builder`.
Roda como tarefa de background separada e enfileira cada segmento direto no Stage 1.

**Stage 1 — Identificação** (`guardrails/validators/etapa1/`)

| Guardrail | Função |
|---|---|
| G0 | Qualidade do OCR |
| G1 | Classificação do tipo de documento |
| G2 | Confiança mínima |
| G3 | Presença de evidências |
| G4 | Evidências validadas contra o texto extraído |
| G7 | Detecção de *prompt injection* |

**Stage 2 — Validação de regras** (`guardrails/validators/etapa2/`)

| Guardrail | Função |
|---|---|
| G1 | Citação literal de evidência |
| G2 | CNPJ (checksum + contexto) |
| G3 | Certidão negativa (blacklist de termos) |
| G4 | *Template matching* de declarações |
| G5 | Assinatura |
| G6 | Validade de data (inclui detecção de data futura falsa) |
| G8 | Emissor esperado |
| G9 | Razão social / papel timbrado (verso) |
| G10 | Anti-manuscrito |
| G11 | Endereço |

Cada guardrail é um arquivo próprio (`gN_nome_em_pt.py`) — o padrão de nomenclatura codifica o
identificador do guardrail, o que torna rastreável a ligação entre requisito, teste e código.

**Pós-pipeline:** cobertura documental, *parecer* final (manual, híbrido ou automático via
`AutoFinalizeService`), registro de consumo/custo de IA e disparo de callback ao sistema externo.

**Resiliência:** como o pipeline roda em memória (`BackgroundTasks`) e não sobrevive ao restart
do processo, o `lifespan` do FastAPI executa `_recover_stuck_submissions()` no boot, reenfileirando
sequencialmente submissões travadas em `PROCESSANDO/EXTRAINDO/VALIDANDO`. O processamento
sequencial é intencional, para não saturar os serviços Azure.

**Tarefas de background permanentes** (registradas no `lifespan`):
sincronização diária de preços Azure, *retry loop* de callbacks, sincronização de convites B2B
do Entra e a recuperação de submissões travadas.

### 3.4 Modelo de dados

PostgreSQL, ~27 tabelas em `infrastructure/database/models.py` (728 linhas). **Todas as PKs são
UUID em string.** Convenção central: **atributos Python em inglês mapeados para colunas em
português**.

```python
name: Mapped[str] = mapped_column("nome", String, nullable=False)
```

| Domínio | Tabelas |
|---|---|
| Configuração de edital | `mesas_analise`, `tipos_documentos`, `regras`, `grupos_documentais` |
| Participantes | `participantes`, `participantes_historico`, `consorcios`, `consorcio_membros` |
| Processamento | `submissoes`, `documentos`, `pareceres`, `confirmacoes_regras` |
| Integração externa | `perfis_integracao`, `chaves_integracao`, `entregas_callback_integracao` |
| Identidade / tenancy | `usuarios`, `organizacoes`, `usuario_organizacoes`, `limites_capacidade_org` |
| Custos de IA | `configuracao_precos_ia`, `consumo_ia` |
| Biblioteca (LIB) | `biblioteca_documentos`, `biblioteca_regras` |
| Auditoria | `logs_pipeline`, `logs_auditoria` |

Decisões de modelagem relevantes:

- **Biblioteca com *copy-on-import*:** importar um documento/regra da biblioteca faz *deep copy*
  de todos os campos (incluindo prompts e texto do artigo) para as tabelas da mesa. Não há FK em
  cascata de volta — as regras do edital ficam congeladas na publicação.
- **Consórcio com *upsert-or-link*:** o cadastro de membro procura primeiro um `Participante`
  existente por `(organization_id, document_number)`; nunca cria participante duplicado.
- **Soft delete** com filtragem no pipeline; `hard_delete.py` isolado para remoção definitiva.

### 3.5 Multi-tenancy e autorização

O escopo de organização é resolvido **a cada request** em
`infrastructure/auth/dependencies.py::resolve_organization_scope`:

1. O frontend envia o header **`X-Organization-Id`** junto do `Authorization: Bearer <id_token>`.
2. O backend valida o token no Entra ID, carrega o usuário e **verifica a associação ativa** do
   usuário àquela organização (`usuario_organizacoes`).
3. Contexto de *admin global* é permitido apenas se o usuário estiver em uma *allowlist* de
   e-mails; toda negação gera um evento de auditoria (`_record_denied_audit_event`).
4. `require_role(*roles)` faz o gate por perfil nos endpoints.

**Princípio de segurança aplicado no NextAuth:** no callback `jwt` com `trigger === "update"`, o
cliente pode *solicitar* um contexto (organização ou admin global), mas todos os campos que
carregam privilégio (`isGlobalAdmin`, `organizationPerfil`) são **re-resolvidos contra o backend**
via `/auth/me/organizations`. O payload de sessão vindo do cliente nunca é fonte de verdade para
decisão de autorização. O `middleware.ts` complementa forçando `/org-select` quando não há
contexto resolvido e re-login quando o *refresh* do token falha.

### 3.6 API de integração externa

Superfície separada (`/integration/*`) para sistemas parceiros, com contrato flexível de lote:

- **Autenticação por API Key** com segredo cifrado em **Fernet**; perfis de integração
  configuráveis por tela de admin (`perfis_integracao`).
- **Callbacks assinados com HMAC**, com validação de URL de destino
  (`callback_url_validator.py`, defesa contra SSRF), *retry* com agenda própria
  (`retry_schedule.py`) e worker dedicado (`callback_worker.py`).
- **Rate limiting** (`slowapi`) e **limite de tamanho de lote** via middleware registrado
  *antes* do CORS.
- Endpoints: criação de submissão/lote, upload de documento, `start`, consulta de status
  (contrato estável em `status_contract.py`), consulta por documento e *delete*.

### 3.7 Frontend

Next.js App Router com **12 rotas**: `/`, `/mesas`, `/participantes`, `/analysis-desk/[id]`,
`/submission/[id]`, `/admin`, `/admin/[deskId]`, `/org-select`, `/login`, `/como-utilizar`,
`/design-system`, `/styleguide`.

- **Predominantemente client-side:** 100 de 129 arquivos `.tsx` são `"use client"`. O carregamento
  de dados é feito por **SWR** através de `useApi()`, e não por Server Components.
- **`fetchWithTimeout` / `fetchJSON`** é o único ponto de saída HTTP: resolve a sessão, injeta
  `Authorization` e `X-Organization-Id`, aplica timeout e trata 401 de sessão expirada/revogada
  disparando `signOut` com o motivo na URL de login.
- **Co-location por rota:** cada página tem `components/` (ou `_components/`), `_hooks/`,
  `*-types.ts` e `*-utils.ts` ao lado do `page.tsx`.
- **Observabilidade de performance:** o backend expõe `X-Process-Time-Ms` em toda resposta,
  agrega percentis por *route template* em `perf_stats` e loga requests acima de 1 s;
  o router `admin_perf` expõe essas estatísticas.

---

## 4. Padronização

### 4.1 Código — Backend

| Regra | Detalhe |
|---|---|
| Regra de dependência | `domain/` não importa `application/` nem `infrastructure/` |
| Nomenclatura | `snake_case` para arquivos/funções/variáveis; `PascalCase` para classes |
| Imports | Absolutos a partir de `src/` — nunca relativos entre camadas |
| Schemas | Pydantic v2 para todo contrato de API (`api/schemas.py`, `api/admin_schemas.py`, `api/admin_integration_schemas.py`, `api/auth_schemas.py`) |
| Modelos | SQLAlchemy 2.x com `Mapped[]` + alias PT-BR de coluna; **sempre usar o atributo Python no código** |
| Migrações | Nome no padrão `phase_NN_descricao.py` em `alembic/versions/` |
| Endpoints admin | Sempre autenticados e prefixados `/admin/` |
| Guardrails | Um arquivo por guardrail, `gN_<nome>.py`, dentro de `etapa1/` ou `etapa2/` |
| Comentários | Em português, explicando o **porquê** (há vários exemplos de comentários que justificam decisões — sequencialidade do reprocessamento, exclusão do CSP em `/docs`, ausência de default `*` no CORS) |
| Ferramentas | `ruff` (lint), `mypy` (tipos), `bandit` (SAST, excluindo `tests/`) |

### 4.2 Código — Frontend

Convenções explicitadas em `CLAUDE.md` e observadas no código:

- **Page shells finas:** `page.tsx` com ~100–200 linhas, cuidando apenas de rota, sessão e estado
  de aba. Nenhuma definição de componente inline.
- **Extração de componentes:** toda seção distinta (aba, painel, formulário) vive em arquivo
  próprio sob `components/` adjacente ao `page.tsx`.
- **Tipos co-localizados:** interfaces de resposta de API em `*-types.ts` (ex.: `admin-types.ts`).
- **Formatadores compartilhados:** funções de data/rótulo em `*-utils.ts`, não inline.
- **Design system obrigatório:** usar `@/design-system/triade.components`, `triade.dialog` e
  `triade.toast`. **Não criar primitivas de UI ad-hoc.**
- **Nomenclatura:** arquivos de componentes em `PascalCase.tsx`; hooks e utilitários em
  `camelCase.ts`.
- **TypeScript first:** props e estados tipados.

### 4.3 Design System

Fonte de verdade em `frontend/src/design-system/`:

| Arquivo | Conteúdo |
|---|---|
| `triade.tokens.ts` | Tokens de cor, tipografia, espaçamento — paleta extraída do logo oficial |
| `triade.components.tsx` | Primitivas: `Button`, `Badge`, `Input`, `Card`, `Divider`, `Spinner`, `Avatar`, `Tooltip`, `Tag`, `EmptyState`, `Text` |
| `triade.dialog.tsx` | Diálogos/modais |
| `triade.toast.tsx` | Notificações |
| `triade.design-system.tsx` | Composições e documentação viva |

Paleta: **teal** (primária, `#1B616D` no passo 500), **navy** (secundária, `#17416B` no 600),
neutros derivados e escalas semânticas (`success`/`warning`/`error`/`info`). Os mesmos valores são
espelhados como CSS custom properties em `globals.css` e consumidos pelo Tailwind via
`var(--...)` em `tailwind.config.ts` — ou seja, **tokens em um lugar, três formas de consumo**
(TS, CSS var, classe utilitária).

As rotas `/design-system` e `/styleguide` funcionam como *living style guide* navegável.

### 4.4 Segurança (padrão aplicado consistentemente)

**Backend (`api/main.py`):**
- Cabeçalhos de segurança em todas as respostas: `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, HSTS de 2 anos, `Permissions-Policy` restritiva.
- **CSP estrito** (`default-src 'none'; frame-ancestors 'none'`) em respostas de API, com isenção
  explícita e comentada para `/docs`, `/redoc` e `/openapi.json`.
- **CORS sem curinga:** `CORS_ORIGINS` obrigatório em produção; default de dev é apenas
  `http://localhost:3000` — nunca `*`, pois `allow_credentials=True` com `*` é inseguro.

**Frontend (`next.config.mjs`):** mesmo conjunto de headers; CSP deliberadamente omitido e o
motivo documentado (App Router usa scripts/estilos inline e exigiria nonces).

**Cadeia de suprimentos:**
- `pyproject.toml` traz um bloco `[tool.uv] constraint-dependencies` com pins de transitivas
  e **um comentário por CVE**, incluindo o caso sem correção disponível (`ecdsa`/PYSEC-2026-1325)
  com a justificativa de por que o risco não se aplica.
- `package.json` traz `pnpm.overrides` com o mesmo propósito no lado Node.
- **Hook `pre-commit`** bloqueia o commit em: `pnpm audit` (nível moderate) quando lockfile do
  frontend muda, `pip-audit` via `uv export` quando lockfile do backend muda, e `bandit -ll`
  nos `.py` alterados. Mensagem de erro instrui a correção e menciona `--no-verify` como escape
  desencorajado.

### 4.5 Testes

- **70 arquivos** de teste em `backend/tests/`, com `conftest.py` compartilhado.
- Nomenclatura `test_<área>_<aspecto>.py`, cobrindo API admin, escopo de organização,
  autenticação/hardening, ciclo de vida de mesas, integração externa (auth, batch, callback,
  retry, HMAC, Fernet, rate limit, e2e), custos de IA, auditoria, guardrails específicos
  (`test_g6_data_futura_reversa.py`, `test_g8_emissor_esperado.py`) e *smoke* do pipeline.
- `pythonpath = ["src"]` configurado em `[tool.pytest.ini_options]`.
- Não há suíte automatizada no frontend.

### 4.6 Processo de desenvolvimento — `.planning/`

O repositório adota um método de desenvolvimento *spec-driven* versionado junto ao código.
É, provavelmente, o ativo mais reaproveitável do projeto:

```
.planning/
  PROJECT.md / REQUIREMENTS.md / ROADMAP.md / MILESTONES.md / STATE.md / RETROSPECTIVE.md
  codebase/     ← ARCHITECTURE, STACK, STRUCTURE, CONVENTIONS, INTEGRATIONS, TESTING, CONCERNS
  milestones/   ← v2.0, v4.0, v5.0 (REQUIREMENTS + ROADMAP por marco)
  phases/       ← ~20 fases numeradas (19 … 35, 999.1)
  quick/        ← ~30 tarefas rápidas, nomeadas AAMMDD-<hash>-<slug>
  research/ debug/ seeds/ retired-phases/
```

**Estrutura de uma fase** (ex.: `35-seg-automatic-segmentation-stage-0-pipeline/`):

| Artefato | Papel |
|---|---|
| `NN-CONTEXT.md` | Contexto e problema |
| `NN-RESEARCH.md` | Investigação prévia |
| `NN-DISCUSSION-LOG.md` | Decisões e trade-offs discutidos |
| `NN-PATTERNS.md` | Padrões a seguir na fase |
| `NN-0X-PLAN.md` / `NN-0X-SUMMARY.md` | Plano e resumo por incremento |
| `NN-VALIDATION.md` / `NN-VERIFICATION.md` / `NN-REVIEW.md` | Verificação técnica |
| `NN-HUMAN-UAT.md` | Aceite humano |

`STATE.md` mantém *front matter* YAML com marco, status, progresso e um bloco de
**"Accumulated Context"** — decisões acumuladas com data e justificativa, incluindo riscos
explicitamente aceitos (ex.: ausência de confirmação humana na segmentação, com a mitigação e o
racional jurídico registrados). Tarefas pequenas fora do fluxo de fases entram em `quick/` com
o mesmo rigor reduzido.

**Instruções de agente versionadas:** `CLAUDE.md` (Claude Code) e `AGENTS.md` (Codex) contêm o
mesmo conteúdo de projeto, garantindo comportamento consistente independentemente da ferramenta.

---

## 5. Referência rápida de comandos

```bash
# ── Backend ───────────────────────────────────────────────────────────────
cd backend
./run_server.sh                                  # dev server :8000
export PYTHONPATH="$PWD/src:$PYTHONPATH"         # obrigatório se rodar manualmente
uv run uvicorn src.api.main:app --reload --port 8000

uv run pytest tests/ -v                          # todos os testes
uv run pytest tests/test_admin_api.py -v         # um arquivo

uv run alembic upgrade head                      # aplica migrações
uv run alembic revision --autogenerate -m "..."  # gera migração

# ── Frontend ──────────────────────────────────────────────────────────────
cd frontend
pnpm install && pnpm dev                         # :3000
pnpm build                                       # build de produção
pnpm lint

# ── Setup do repositório ──────────────────────────────────────────────────
./scripts/install-hooks.sh                       # ativa o pre-commit de segurança

# ── Deploy (Azure Container Apps) ─────────────────────────────────────────
cp deploy/.env.example deploy/.env               # preencher antes
./deploy.sh all | backend | frontend
```

**Variáveis de ambiente principais**

*Backend (`backend/.env`)*: `DATABASE_URL`, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`,
`AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`, `AZURE_DOCUMENT_INTELLIGENCE_KEY`,
`AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER`, `CORS_ORIGINS`.

*Frontend (`frontend/.env.local`)*: `AUTH_MICROSOFT_ENTRA_ID_ID`,
`AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID`, `AUTH_SECRET`,
`NEXT_PUBLIC_API_URL` (injetada em *build time* via `--build-arg`).

---

## 6. Divergências entre documentação e código

Levantadas durante a análise — relevantes para quem for usar este repositório como referência.

| # | Documento | Afirma | Realidade no código |
|---|---|---|---|
| 1 | `README.md`, `CLAUDE.md`, `AGENTS.md`, `.planning/codebase/STACK.md` | Next.js **14** | `package.json`: **15.5.18** |
| 2 | `.planning/codebase/STACK.md` | Usa **LangChain** | Nenhuma ocorrência; chamadas diretas ao SDK `openai` |
| 3 | `README.md`, `CLAUDE.md` | `infrastructure/api/` | A camada real é `src/api/`, irmã de `infrastructure/` |
| 4 | `.planning/codebase/CONVENTIONS.md` | Preferir **Server Components** e arquivos em `kebab-case` | 100 de 129 `.tsx` são `"use client"`, dados via SWR; componentes em `PascalCase.tsx` |
| 5 | `README.md` | Estrutura contém `triade_refatoracao/` | Diretório não existe |
| 6 | `README.md` | Aponta `RESTRUCTURE_GUIDE.md` na raiz | Arquivo não existe |
| 7 | `pyproject.toml` | `requires-python = ">=3.10"`; nome do pacote `poc-mvp-sme` | Dockerfile usa Python **3.12**; o nome do pacote ainda reflete a fase de PoC |
| 8 | `.planning/codebase/STACK.md` | CI/CD em **GitHub Actions** | Não há `.github/workflows/`; só `dependabot.yml` (que inclusive comenta "pronto para quando o workflow de CI for adicionado") |

**Observações adicionais de engenharia:**

- **Duas famílias de UI convivem.** `src/design-system/` (TRIADE DS, obrigatório por convenção) e
  `src/components/ui/` (15 primitivas shadcn/base-ui). A convenção declara o TRIADE DS como fonte
  única, mas a camada shadcn permanece no repositório. Vale decidir e consolidar.
- **DI container cobre apenas o caminho de validação.** Routers e services fora desse caminho
  instanciam dependências diretamente (ex.: `_build_auto_finalize_service()` em `tasks.py`, com
  import tardio). É uma inconsistência consciente, não um defeito, mas quebra a uniformidade.
- **Pipeline em memória.** Rodar via `BackgroundTasks` (em vez de uma fila durável como Celery/
  Service Bus) é a razão de existir o `_recover_stuck_submissions()`. Funciona, mas é o ponto
  mais frágil da arquitetura sob escala ou múltiplas réplicas — reprocessar do zero após restart
  custa OCR + LLM novamente.
- **`api/tasks.py` com 1.098 linhas** concentra orquestração que, pela própria Clean Architecture
  do projeto, pertenceria a `application/use_cases/`.
- **Ausência de CI automatizado** é o maior gap de processo: existem 70 arquivos de teste, lint,
  type check e SAST configurados, mas a execução depende de hook local e disciplina do
  desenvolvedor. O `dependabot.yml` já está preparado para o dia em que o workflow existir.

---

## 7. O que vale replicar em outros projetos

1. **Configuração por dados, não por deploy.** Tipos de documento, regras, prompts e limites
   como linhas de banco editáveis por admin — muda o custo de atender um novo edital/cliente.
2. **Guardrails como unidades nomeadas e versionadas.** `G0…G11`, um arquivo por guardrail, com
   teste dedicado e rastreabilidade requisito → código → teste.
3. **Tokens de design em uma fonte, três consumos** (TS, CSS var, Tailwind).
4. **Privilégio sempre re-resolvido no servidor.** O cliente pede contexto; o backend decide.
5. **Pins de segurança comentados por CVE**, incluindo o caso sem correção e por que é aceitável.
6. **`pre-commit` versionado no repositório** com instalação por script — audit de dependências
   e SAST antes do commit.
7. **`.planning/` como método.** Fases com contexto, pesquisa, plano, resumo, verificação e UAT;
   `STATE.md` com decisões acumuladas, datadas e com riscos aceitos registrados explicitamente.
8. **Comentários que explicam o porquê**, especialmente onde a escolha parece errada à primeira
   vista (sequencialidade, isenções de CSP, ausência de curinga no CORS).

---

*Documento gerado a partir da análise estática do repositório em 2026-08-05. As divergências da
§6 refletem o estado do código naquele momento e devem ser reconfirmadas antes de qualquer uso
normativo.*
