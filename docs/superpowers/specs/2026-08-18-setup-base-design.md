# VerAI — Setup base (design)

**Módulo**: 2 de 8 do roteiro de sub-projetos do VerAI (Setup base do projeto)
**Depende de**: módulo 1 — [Camada de IA](2026-08-18-camada-ia-design.md)
**Status**: Aprovado para implementação
**Data**: 18/08/2026

---

## 1. Objetivo

Colocar de pé o esqueleto do VerAI — projeto Next.js, banco de dados,
autenticação, storage local e o mapa de páginas/rotas do dashboard — para
que os módulos seguintes (ingestão, listagem, visualização, notificação,
relatório PDF, permissões) tenham uma base comum pra plugar em cima.

**Fora de escopo aqui**: a lógica de negócio de cada tela (upload real,
parsing, geração de PDF, envio de e-mail etc.) — isso é implementado nos
módulos 3–8, cada um com seu próprio ciclo de brainstorming.

Decisão importante que guiou o desenho: o VerAI é um projeto **totalmente
independente do SPDF** — não compartilha código, banco, usuários nem
integra com ele de forma alguma. As tecnologias/padrões usados no SPDF
(Next.js, Prisma, Tailwind+shadcn, JWT em cookie) servem só como referência
de convenção já validada pela equipe, replicados do zero num projeto novo.

---

## 2. Stack e scaffold

- **Next.js 15** (App Router) + TypeScript + React 19
- **Tailwind 4** + shadcn/radix-ui
- **npm** como package manager
- **Prisma + PostgreSQL**, subindo local via `docker-compose` (banco próprio
  do VerAI, container e porta isolados de qualquer outro projeto)

---

## 3. Autenticação

Login/senha simples, isolado — sem NextAuth, sem SSO, sem qualquer relação
com o SPDF:

- Senha com hash `bcrypt`
- Sessão via JWT assinado (`jose`) num cookie `httpOnly` (`token-verai`)
- Rotas: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- Helper `getAuthUser()` (lê cookie → valida JWT → busca `Usuario` no
  Prisma), usado nas rotas protegidas e nas Server Components
- Sem cadastro público — usuários são criados por um admin

---

## 4. Schema Prisma

```prisma
model Usuario {
  id         String   @id @default(cuid())
  nome       String
  email      String   @unique
  senhaHash  String
  role       String   // uploader | responsavel | admin
  createdAt  DateTime @default(now())
  documentos Documento[]
  acessos    AcessoDocumento[]
}

model Documento {
  id              String    @id @default(cuid())
  nomeArquivo     String
  tipo            String    // xlsx, csv, pdf, docx
  caminhoOriginal String
  tamanhoBytes    Int
  status          String    @default("processando") // processando | concluido | erro
  mensagemErro    String?
  uploadedById    String
  uploadedBy      Usuario   @relation(fields: [uploadedById], references: [id])
  createdAt       DateTime  @default(now())
  analise         Analise?
  acessos         AcessoDocumento[]
}

model Analise {
  id                  String    @id @default(cuid())
  documentoId         String    @unique
  documento           Documento @relation(fields: [documentoId], references: [id])
  resumo              String    @db.Text
  pontosCriticos      Json
  pontosPositivos     Json
  metricasChave       Json?
  promptVersion       String
  caminhoRelatorioPdf String?
  relatorioGeradoEm   DateTime?
  createdAt           DateTime  @default(now())
}

model RegraNotificacao {
  id            String @id @default(cuid())
  criterioTipo  String // tipoDocumento | palavraChaveNome
  criterioValor String
  destinatarios Json
}

model Notificacao {
  id           String   @id @default(cuid())
  documentoId  String
  destinatario String
  canal        String   // email | dashboard
  lida         Boolean  @default(false)
  createdAt    DateTime @default(now())
}

model AcessoDocumento {
  id          String    @id @default(cuid())
  documentoId String
  documento   Documento @relation(fields: [documentoId], references: [id])
  usuarioId   String
  usuario     Usuario   @relation(fields: [usuarioId], references: [id])
  acao        String    // visualizou | baixou_original | baixou_relatorio
  createdAt   DateTime  @default(now())
}
```

---

## 5. Storage local

- `UPLOAD_DIR` (ex: `./uploads`) e `UPLOAD_BASE_URL` em `.env`
- Path: `uploads/{ano}/{mes}/{documentoId}/original.{ext}`
- Pasta `uploads/` no `.gitignore`

---

## 6. Configuração de ambiente (dev)

`.env.development` (carregado quando `NODE_ENV=development`), banco e
segredo próprios do VerAI — porta do Postgres em `5433` para não colidir
com outros projetos rodando na mesma máquina:

```dotenv
NODE_ENV=development

# Database (Development)
DATABASE_URL="postgresql://verai_user:verai_pass@localhost:5433/verai"
POSTGRES_DB=verai
POSTGRES_USER=verai_user
POSTGRES_PASSWORD=verai_pass

# Auth
JWT_SECRET="<gerar com: openssl rand -hex 32>"

# Upload local
UPLOAD_DIR=./uploads
UPLOAD_BASE_URL=http://localhost:3000/api/uploads

# Camada de IA (módulo 1 — vazio até decidir o provedor)
AI_PROVIDER=
AI_API_KEY=
AI_MODEL=
```

`.env.example` mantém as mesmas chaves sem valores, versionado no git.
`.env.development` entra no `.gitignore` (tem segredo, mesmo que só local).

`docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: verai-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    ports:
      - "127.0.0.1:5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
    driver: local
```

`package.json` scripts no mesmo espírito: `dev:db:up`, `dev:migrate`,
`dev:studio`, todos usando `dotenv -e .env.development`.

---

## 7. Estrutura de pastas

```
verai/
├── src/
│   ├── app/
│   │   ├── login/page.tsx
│   │   ├── page.tsx                          → listagem/histórico
│   │   ├── documentos/[id]/page.tsx           → detalhe (split view)
│   │   ├── notificacoes/page.tsx
│   │   ├── admin/usuarios/page.tsx
│   │   ├── admin/regras-notificacao/page.tsx
│   │   └── api/...                            → ver seção 8
│   ├── lib/
│   │   ├── auth.ts        → hash/verify senha, sign/verify JWT, getAuthUser()
│   │   ├── prisma.ts       → client singleton
│   │   ├── storage.ts      → helpers de path de upload
│   │   └── ia/analisar.ts   → módulo 1
│   ├── components/          → shadcn ui
│   └── middleware.ts         → ver seção 8
├── prisma/schema.prisma
├── docs/superpowers/specs/
├── uploads/                  (gitignored)
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## 8. Páginas e rotas do dashboard

**Rotas públicas**

| Rota | Descrição |
|---|---|
| `/login` | Formulário de login |

**Dashboard (autenticado — qualquer role)**

| Rota | Descrição | Visibilidade |
|---|---|---|
| `/` | Listagem/histórico (tabela, filtros, busca, upload) | Uploader: só os seus • Responsável: os que batem na regra de notificação dele • Admin: todos |
| `/documentos/[id]` | Detalhe — split view documento original × análise da IA, ações (baixar original, baixar relatório, reprocessar) | Mesma regra acima; toda visita grava `AcessoDocumento` |
| `/notificacoes` | Lista de notificações in-app, badge de não lida | Só as próprias |

**Admin-only**

| Rota | Descrição |
|---|---|
| `/admin/usuarios` | CRUD de usuários e roles |
| `/admin/regras-notificacao` | CRUD de `RegraNotificacao` |

**API routes**

```
/api/auth/{login,logout,me}
/api/documentos                     GET (lista, filtros) · POST (upload)
/api/documentos/[id]                 GET (detalhe)
/api/documentos/[id]/original         GET (preview/download do original)
/api/documentos/[id]/relatorio         GET (gera/baixa PDF, cacheado)
/api/documentos/[id]/reprocessar       POST (dispara nova análise)
/api/notificacoes                    GET (lista) · PATCH (marcar lida)
/api/admin/usuarios                   GET/POST/PATCH/DELETE
/api/admin/regras-notificacao          GET/POST/PATCH/DELETE
```

**Proteção de rotas**: `middleware.ts` valida o JWT em toda rota fora de
`/login` e `/api/auth/*`; rotas `/admin/*` e `/api/admin/*` checam
adicionalmente `role === 'admin'` (403 se não for). A regra de "quem vê
qual documento" (uploader/responsável/admin) é aplicada na query do Prisma
dentro de cada rota — é regra de dado, não de rota, então não entra no
middleware.

---

## 9. Fora de escopo (por ora)

- Lógica de upload/parsing real (módulo 3 — ingestão + extração)
- Conteúdo funcional das telas de listagem, detalhe e notificação (módulos
  4, 5, 6) — aqui só as rotas/páginas existem como esqueleto
- Geração de PDF (módulo 7), CRUD funcional de regras/usuários (módulo 8)
- SSO / Azure AD — pode ser revisitado depois se a necessidade surgir; a
  camada de auth foi isolada em `lib/auth.ts` para permitir troca sem
  afetar o resto do sistema
