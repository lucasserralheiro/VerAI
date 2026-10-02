# Gerências e carteira de clientes — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cada cliente numa carteira de gerência; todos veem todos os clientes, só a equipe da gerência (manager e
usuário) edita; admin cria gerência, move cliente e nomeia manager, num menu "Administração" com painel `/admin`.

**Architecture:** quatro tabelas novas (`Gerencia`, `MembroGerencia`, `CarteiraCliente`, `MovimentoCarteira`),
migração escrita à mão. Regra pura em `src/lib/gerencias/permissao.ts`; consulta de edição `podeEditarCliente` ao
lado de `podeVerCliente` (`src/lib/visibilidade.ts`); `verificarAcessoCliente`/`exigirAcessoCliente` e os cinco
carregadores ganham o modo `'editar'`, usado em todo método de gravação de cliente (uma régua de teste garante).
Serviço `src/lib/gerencias/servico.ts`; rotas finas em `/api/admin/gerencias` (admin) e `/api/gerencias` (equipe);
telas `/admin`, `/admin/gerencias`, `/gerencias/[id]`; permissão do cliente por um provider no layout da ficha.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma 6/Postgres, Tailwind 4, Jest + Testing Library, zod.

**Spec:** `docs/superpowers/specs/2026-10-02-gerencias-carteira-clientes-design.md` (o §0 prevalece; o §5 traz o
ajuste da transição).

## Global Constraints

- Todo usuário logado **vê** todos os clientes. **Edita** cliente: admin; membro (`manager` ou `usuario`) da
  gerência **ativa** dona do cliente; e, **só até a Fase B**, quem tem o cliente em `clientesPermitidos`.
- Cliente sem carteira: só admin edita.
- Criar/renomear/desativar gerência, mover cliente, nomear/tirar manager, trocar papel: só admin. Manager da
  gerência põe e tira pessoa com papel `usuario`.
- Login por token (`DEV_AUTH_TOKEN`) continua entrando como admin — não mexer em `src/app/api/auth/dev-login`.
- 403 de edição: `{ error: 'acesso negado', motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.' }`.
- Fora do escopo: Confere, Proposta Comercial, Reajuste, biblioteca, fornecedor, CO, link SEI, regra de documento
  por papel (`documentosVisiveisWhere`/`podeVerDocumento` continuam iguais).
- **Só tabelas novas** — nenhuma coluna em model existente (o agendador do SharePoint roda o cliente Prisma desta
  pasta contra produção). Relação de volta em `Usuario`/`Cliente` é campo virtual do Prisma (não gera coluna).
- Migração escrita à mão. **Nunca** `prisma migrate dev` nem `migrate diff` com shadow apontando para qualquer
  `.env*`. Conferir com `prisma validate` e `migrate diff --from-schema-datamodel … --to-schema-datamodel …
  --script` (schema × schema, sem banco). Aplicar no dev: `npx dotenv -e .env.development -- npx prisma migrate
  deploy` e depois `npx prisma generate`.
- Endereços existentes não mudam (`/admin/usuarios`, `/admin/clientes`, `/admin/regras-notificacao`,
  `/admin/assistente`).
- Jest: `npx jest <caminho> --runInBand`; suíte inteira `npx jest --runInBand --forceExit`.
- Não rodar `next build` com o dev server de pé.
- Commits **sem** `Co-Authored-By` de IA. Na main, com índice próprio porque outras sessões commitam ao mesmo
  tempo. Em todo passo "Commit", rode (trocando `ARQS` e a mensagem):
  ```bash
  ARQS="arquivo1 arquivo2"; MSG="feat(gerencias): ..."
  IDX="$TEMP/idx-ger"; PAI=$(git rev-parse HEAD); rm -f "$IDX"
  GIT_INDEX_FILE="$IDX" git read-tree $PAI
  for F in $ARQS; do
    if [ -e "$F" ]; then GIT_INDEX_FILE="$IDX" git update-index --add --cacheinfo 100644,$(git hash-object -w --path="$F" "$F"),"$F"
    else GIT_INDEX_FILE="$IDX" git update-index --force-remove "$F"; fi
  done
  NOVO=$(printf '%s\n' "$MSG" | git commit-tree $(GIT_INDEX_FILE="$IDX" git write-tree) -p $PAI)
  git update-ref refs/heads/main $NOVO $PAI && git reset -q -- $ARQS && git log --oneline -1
  ```
  Arquivo que outra sessão também mudou (aparece no `git status` antes de você tocar): pare e pergunte.
- Textos de tela em pt-BR, padrão das páginas existentes (`<h1>` `text-navy`, classes de `src/lib/ui.ts`:
  `BTN_PRIMARY`, `BTN_OUTLINE`, `BTN_OUTLINE_SM`, `INPUT_BASE`, `LINK_NAVY`, `LINK_DANGER`).

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `prisma/schema.prisma` | 4 models novos + relações virtuais em `Usuario` e `Cliente` |
| `prisma/migrations/20261002120000_gerencias_carteira/migration.sql` | SQL das 4 tabelas |
| `src/lib/gerencias/permissao.ts` | regra pura: edição, equipe, detalhe |
| `src/lib/gerencias/servico.ts` | consultas e gravações de gerência, equipe, carteira |
| `src/lib/gerencias/tipos.ts` | tipos serializados que telas e rotas compartilham |
| `src/lib/visibilidade.ts` | `podeEditarCliente` (+ leitura liberada na Task 8) |
| `src/lib/relatorios-clientes/acesso.ts` | modo `'editar'`, `exigirAdmin`, `MOTIVO_SOMENTE_LEITURA` |
| `src/app/api/{contratos,historico-contrato,faturamentos,demandas,arquivos}/carregar.ts` | modo `'editar'` |
| `src/app/api/regua-edicao.test.ts` | régua: todo método de gravação de cliente pede `'editar'` |
| `src/app/api/admin/gerencias/**` | rotas do admin |
| `src/app/api/gerencias/**` | rotas da equipe (manager) |
| `src/app/api/admin/resumo/route.ts` | números do painel `/admin` |
| `src/app/api/clientes/[clienteId]/permissao/route.ts` | `{ gerencia, podeEditar }` para a ficha |
| `src/components/gerencias/detalhe-gerencia.tsx` | detalhe (carteira, equipe, movimentos), modo admin/manager |
| `src/app/admin/page.tsx`, `src/app/admin/gerencias/page.tsx`, `src/app/admin/gerencias/[id]/page.tsx` | telas admin |
| `src/app/gerencias/page.tsx`, `src/app/gerencias/[id]/page.tsx` | "Minha(s) gerência(s)" |
| `src/app/clientes/[id]/layout.tsx`, `src/app/clientes/[id]/permissao-cliente.tsx` | provider + faixa "Somente leitura" |
| `src/components/nav-bar.tsx` | grupo "Administração" + link "Minha gerência" |

---

# FASE A — estrutura (ninguém perde edição)

### Task 1: Tabelas novas e migração

**Files:**
- Modify: `prisma/schema.prisma` (models `Usuario` linha ~10, `Cliente` linha ~26; models novos no fim)
- Create: `prisma/migrations/20261002120000_gerencias_carteira/migration.sql`

**Interfaces:**
- Produces: models Prisma `gerencia`, `membroGerencia`, `carteiraCliente`, `movimentoCarteira`; `Usuario.gerencias:
  MembroGerencia[]`; `Cliente.carteira: CarteiraCliente?`; `Cliente.movimentosCarteira: MovimentoCarteira[]`.

- [ ] **Step 1: Guardar o schema atual para comparar**

```bash
git show HEAD:prisma/schema.prisma > "$TEMP/schema-antes.prisma"
```

- [ ] **Step 2: Acrescentar ao `Usuario`** (dentro do model, depois de `reajustes`)

```prisma
  gerencias          MembroGerencia[]
```

- [ ] **Step 3: Acrescentar ao `Cliente`** (depois de `arquivos`)

```prisma
  carteira             CarteiraCliente?
  movimentosCarteira   MovimentoCarteira[]
```

- [ ] **Step 4: Models novos no fim do schema**

```prisma
// ---------------------------------------------------------------------------
// Gerências e carteira de clientes — docs/superpowers/specs/2026-10-02-gerencias-carteira-clientes-design.md.
// Só tabelas novas: o agendador do SharePoint roda este cliente Prisma contra produção.
// ---------------------------------------------------------------------------

model Gerencia {
  id        String            @id @default(cuid())
  nome      String            @unique
  sigla     String?           @unique
  ativa     Boolean           @default(true)
  createdAt DateTime          @default(now())
  membros   MembroGerencia[]
  carteira  CarteiraCliente[]
}

model MembroGerencia {
  id         String   @id @default(cuid())
  gerenciaId String
  gerencia   Gerencia @relation(fields: [gerenciaId], references: [id])
  usuarioId  String
  usuario    Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  papel      String // manager | usuario
  createdAt  DateTime @default(now())

  @@unique([gerenciaId, usuarioId])
  @@index([usuarioId])
}

model CarteiraCliente {
  clienteId   String   @id
  cliente     Cliente  @relation(fields: [clienteId], references: [id], onDelete: Cascade)
  gerenciaId  String
  gerencia    Gerencia @relation(fields: [gerenciaId], references: [id])
  movidoEm    DateTime @default(now())
  movidoPorId String?

  @@index([gerenciaId])
}

// Trilha de "quem mudou o cliente de carteira e quando". Gerências nunca são apagadas (só desativadas),
// então de/para são ids simples, resolvidos para nome na leitura.
model MovimentoCarteira {
  id             String   @id @default(cuid())
  clienteId      String
  cliente        Cliente  @relation(fields: [clienteId], references: [id], onDelete: Cascade)
  deGerenciaId   String?
  paraGerenciaId String?
  porId          String?
  em             DateTime @default(now())

  @@index([clienteId])
}
```

- [ ] **Step 5: Escrever a migração à mão** — `prisma/migrations/20261002120000_gerencias_carteira/migration.sql`

```sql
-- Gerências e carteira de clientes (spec 2026-10-02-gerencias-carteira-clientes-design.md). Só tabelas novas.
CREATE TABLE "Gerencia" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Gerencia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MembroGerencia" (
    "id" TEXT NOT NULL,
    "gerenciaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MembroGerencia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CarteiraCliente" (
    "clienteId" TEXT NOT NULL,
    "gerenciaId" TEXT NOT NULL,
    "movidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "movidoPorId" TEXT,
    CONSTRAINT "CarteiraCliente_pkey" PRIMARY KEY ("clienteId")
);

CREATE TABLE "MovimentoCarteira" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "deGerenciaId" TEXT,
    "paraGerenciaId" TEXT,
    "porId" TEXT,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimentoCarteira_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Gerencia_nome_key" ON "Gerencia"("nome");
CREATE UNIQUE INDEX "Gerencia_sigla_key" ON "Gerencia"("sigla");
CREATE INDEX "MembroGerencia_usuarioId_idx" ON "MembroGerencia"("usuarioId");
CREATE UNIQUE INDEX "MembroGerencia_gerenciaId_usuarioId_key" ON "MembroGerencia"("gerenciaId", "usuarioId");
CREATE INDEX "CarteiraCliente_gerenciaId_idx" ON "CarteiraCliente"("gerenciaId");
CREATE INDEX "MovimentoCarteira_clienteId_idx" ON "MovimentoCarteira"("clienteId");

ALTER TABLE "MembroGerencia" ADD CONSTRAINT "MembroGerencia_gerenciaId_fkey" FOREIGN KEY ("gerenciaId") REFERENCES "Gerencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MembroGerencia" ADD CONSTRAINT "MembroGerencia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CarteiraCliente" ADD CONSTRAINT "CarteiraCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CarteiraCliente" ADD CONSTRAINT "CarteiraCliente_gerenciaId_fkey" FOREIGN KEY ("gerenciaId") REFERENCES "Gerencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MovimentoCarteira" ADD CONSTRAINT "MovimentoCarteira_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 6: Conferir schema × SQL sem banco**

```bash
npx prisma validate
npx prisma migrate diff --from-schema-datamodel "$TEMP/schema-antes.prisma" --to-schema-datamodel prisma/schema.prisma --script
```
Expected: `validate` ok; o diff só tem `CREATE TABLE`/`CREATE INDEX`/`ADD CONSTRAINT` das 4 tabelas, os mesmos do
SQL acima. **Nenhum `ALTER TABLE "Usuario"`/`"Cliente"` com coluna**, nenhum `DROP` (se aparecer `DROP INDEX
"ArquivoCliente_clienteId_sha256_ativo_key"`, é o índice parcial conhecido — não vai para a migração).

- [ ] **Step 7: Aplicar no dev e gerar o cliente**

```bash
npx dotenv -e .env.development -- npx prisma migrate deploy
npx prisma generate
```
Expected: "1 migration applied" (`20261002120000_gerencias_carteira`).

- [ ] **Step 8: Commit** — `ARQS="prisma/schema.prisma prisma/migrations/20261002120000_gerencias_carteira/migration.sql"`,
  `MSG="feat(gerencias): tabelas de gerência, equipe e carteira de clientes"`.

---

### Task 2: Regra pura de permissão

**Files:**
- Create: `src/lib/gerencias/permissao.ts`
- Test: `src/lib/gerencias/permissao.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type PapelGerencia = 'manager' | 'usuario'
  export const PAPEIS: readonly PapelGerencia[]
  export interface Vinculo { gerenciaId: string; papel: PapelGerencia }
  export const TRANSICAO_CLIENTES_PERMITIDOS: boolean // true na Fase A; a Task 15 remove
  export function decidirEdicao(s: { ehAdmin: boolean; membroDaGerenciaDoCliente: boolean; liberadoNoModeloAntigo: boolean }): boolean
  export function podeVerDetalheGerencia(ehAdmin: boolean, vinculos: Vinculo[], gerenciaId: string): boolean
  export type Decisao = { ok: true } | { ok: false; motivo: string }
  export function decidirMudancaNaEquipe(s: { ehAdmin: boolean; vinculos: Vinculo[]; gerenciaId: string; papelAtual: PapelGerencia | null; papelNovo: PapelGerencia | null }): Decisao
  ```

- [ ] **Step 1: Teste falhando**

```ts
import { decidirEdicao, decidirMudancaNaEquipe, podeVerDetalheGerencia } from './permissao'

describe('decidirEdicao', () => {
  const base = { ehAdmin: false, membroDaGerenciaDoCliente: false, liberadoNoModeloAntigo: false }
  it('admin edita qualquer cliente', () => expect(decidirEdicao({ ...base, ehAdmin: true })).toBe(true))
  it('membro da gerência dona edita', () => expect(decidirEdicao({ ...base, membroDaGerenciaDoCliente: true })).toBe(true))
  it('quem não é da gerência não edita', () => expect(decidirEdicao(base)).toBe(false))
  it('na transição, liberado do jeito antigo ainda edita', () =>
    expect(decidirEdicao({ ...base, liberadoNoModeloAntigo: true })).toBe(true))
})

describe('podeVerDetalheGerencia', () => {
  it('admin vê qualquer uma', () => expect(podeVerDetalheGerencia(true, [], 'g1')).toBe(true))
  it('membro vê a sua', () => expect(podeVerDetalheGerencia(false, [{ gerenciaId: 'g1', papel: 'usuario' }], 'g1')).toBe(true))
  it('de fora não vê', () => expect(podeVerDetalheGerencia(false, [{ gerenciaId: 'g2', papel: 'manager' }], 'g1')).toBe(false))
})

describe('decidirMudancaNaEquipe', () => {
  const manager = [{ gerenciaId: 'g1', papel: 'manager' as const }]
  const s = (x: Partial<Parameters<typeof decidirMudancaNaEquipe>[0]>) =>
    decidirMudancaNaEquipe({ ehAdmin: false, vinculos: manager, gerenciaId: 'g1', papelAtual: null, papelNovo: 'usuario', ...x })

  it('admin faz qualquer mudança, inclusive nomear manager', () =>
    expect(s({ ehAdmin: true, vinculos: [], papelNovo: 'manager' })).toEqual({ ok: true }))
  it('manager põe usuário', () => expect(s({})).toEqual({ ok: true }))
  it('manager tira usuário', () => expect(s({ papelAtual: 'usuario', papelNovo: null })).toEqual({ ok: true }))
  it('manager não nomeia manager', () =>
    expect(s({ papelNovo: 'manager' })).toEqual({ ok: false, motivo: 'Só o administrador nomeia ou tira manager.' }))
  it('manager não tira manager', () =>
    expect(s({ papelAtual: 'manager', papelNovo: null })).toEqual({ ok: false, motivo: 'Só o administrador nomeia ou tira manager.' }))
  it('usuário da gerência não mexe na equipe', () =>
    expect(s({ vinculos: [{ gerenciaId: 'g1', papel: 'usuario' }] })).toEqual({
      ok: false,
      motivo: 'Só o manager desta gerência ou o administrador mexe na equipe.',
    }))
  it('manager de outra gerência não mexe', () =>
    expect(s({ gerenciaId: 'g2' }).ok).toBe(false))
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/lib/gerencias/permissao.test.ts --runInBand` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

```ts
// Regra única de gerência e carteira (spec docs/superpowers/specs/2026-10-02-gerencias-carteira-clientes-design.md §3).
// Pura: quem consulta o banco é `podeEditarCliente` (visibilidade.ts) e o serviço de gerências.

export type PapelGerencia = 'manager' | 'usuario'
export const PAPEIS: readonly PapelGerencia[] = ['manager', 'usuario']

export interface Vinculo {
  gerenciaId: string
  papel: PapelGerencia
}

/** Fase A: quem tinha o cliente em `clientesPermitidos` continua editando até as carteiras estarem montadas. A
 *  Fase B (Task 15 do plano) apaga esta constante e o campo `liberadoNoModeloAntigo`. */
export const TRANSICAO_CLIENTES_PERMITIDOS = true

export function decidirEdicao(s: {
  ehAdmin: boolean
  membroDaGerenciaDoCliente: boolean
  liberadoNoModeloAntigo: boolean
}): boolean {
  if (s.ehAdmin || s.membroDaGerenciaDoCliente) return true
  return TRANSICAO_CLIENTES_PERMITIDOS && s.liberadoNoModeloAntigo
}

export function podeVerDetalheGerencia(ehAdmin: boolean, vinculos: Vinculo[], gerenciaId: string): boolean {
  return ehAdmin || vinculos.some((v) => v.gerenciaId === gerenciaId)
}

export type Decisao = { ok: true } | { ok: false; motivo: string }

/** `papelAtual` null = a pessoa ainda não está na equipe; `papelNovo` null = sai da equipe. */
export function decidirMudancaNaEquipe(s: {
  ehAdmin: boolean
  vinculos: Vinculo[]
  gerenciaId: string
  papelAtual: PapelGerencia | null
  papelNovo: PapelGerencia | null
}): Decisao {
  if (s.ehAdmin) return { ok: true }
  const ehManager = s.vinculos.some((v) => v.gerenciaId === s.gerenciaId && v.papel === 'manager')
  if (!ehManager) return { ok: false, motivo: 'Só o manager desta gerência ou o administrador mexe na equipe.' }
  if (s.papelAtual === 'manager' || s.papelNovo === 'manager') {
    return { ok: false, motivo: 'Só o administrador nomeia ou tira manager.' }
  }
  return { ok: true }
}
```

- [ ] **Step 4: Rodar e ver passar** — mesmo comando → PASS.

- [ ] **Step 5: Commit** — `ARQS="src/lib/gerencias/permissao.ts src/lib/gerencias/permissao.test.ts"`,
  `MSG="feat(gerencias): regra pura de edição e de equipe"`.

---

### Task 3: `podeEditarCliente` e o modo `'editar'` nas verificações de acesso

**Files:**
- Modify: `src/lib/visibilidade.ts`
- Modify: `src/lib/relatorios-clientes/acesso.ts`
- Modify: `src/app/api/contratos/carregar.ts`, `src/app/api/historico-contrato/carregar.ts`,
  `src/app/api/faturamentos/carregar.ts`, `src/app/api/demandas/carregar.ts`, `src/app/api/arquivos/carregar.ts`
- Test: `src/lib/visibilidade.test.ts` (criar se não existir), `src/lib/relatorios-clientes/acesso.test.ts`

**Interfaces:**
- Consumes: `decidirEdicao` (Task 2).
- Produces:
  ```ts
  // visibilidade.ts
  export async function podeEditarCliente(usuario: AuthUser, clienteId: string): Promise<boolean>
  // acesso.ts
  export type ModoAcesso = 'ver' | 'editar'
  export const MOTIVO_SOMENTE_LEITURA = 'Somente leitura: só a equipe da gerência deste cliente edita.'
  export async function verificarAcessoCliente(usuario: AuthUser, clienteId: string, modo?: ModoAcesso): Promise<NextResponse | null>
  export async function exigirAcessoCliente(request: NextRequest, clienteId: string, modo?: ModoAcesso): Promise<Resultado>
  export async function exigirAdmin(request: NextRequest): Promise<Resultado>
  // cada carregar.ts: carregarXComAcesso(request, id, modo: ModoAcesso = 'ver')
  ```

- [ ] **Step 1: Teste falhando de `podeEditarCliente`** — em `src/lib/visibilidade.test.ts`:

```ts
/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: { usuario: { findUnique: jest.fn() } } }))
import { prisma } from '@/lib/prisma'
import { podeEditarCliente } from './visibilidade'

const comum = { id: 'u2', nome: 'C', email: 'c@x', role: 'responsavel' as const }
const achar = prisma.usuario.findUnique as jest.Mock
beforeEach(() => jest.clearAllMocks())

describe('podeEditarCliente', () => {
  it('admin edita sem consultar', async () => {
    await expect(podeEditarCliente({ ...comum, role: 'admin' }, 'c1')).resolves.toBe(true)
    expect(achar).not.toHaveBeenCalled()
  })
  it('membro da gerência dona edita', async () => {
    achar.mockResolvedValue({ clientesPermitidos: [], gerencias: [{ gerenciaId: 'g1' }] })
    await expect(podeEditarCliente(comum, 'c1')).resolves.toBe(true)
  })
  it('liberado do jeito antigo edita na transição', async () => {
    achar.mockResolvedValue({ clientesPermitidos: [{ id: 'c1' }] })
    await expect(podeEditarCliente(comum, 'c1')).resolves.toBe(true)
  })
  it('liberado para OUTRO cliente não edita', async () => {
    achar.mockResolvedValue({ clientesPermitidos: [{ id: 'outro' }], gerencias: [] })
    await expect(podeEditarCliente(comum, 'c1')).resolves.toBe(false)
  })
  it('consulta só gerências ativas que têm o cliente', async () => {
    achar.mockResolvedValue(null)
    await podeEditarCliente(comum, 'c1')
    expect(achar.mock.calls[0][0].select.gerencias.where).toEqual({ gerencia: { ativa: true, carteira: { some: { clienteId: 'c1' } } } })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/lib/visibilidade.test.ts --runInBand` → FAIL (não exportado).

- [ ] **Step 3: Implementar em `visibilidade.ts`** (abaixo de `podeVerCliente`; importar `decidirEdicao`)

```ts
/** Edição de cliente (spec 2026-10-02-gerencias §3): admin; membro da gerência ativa dona do cliente; e, na
 *  transição da Fase A, quem tem o cliente em `clientesPermitidos`. Uma consulta só. Os mocks antigos de rota
 *  devolvem `clientesPermitidos` sem filtro — por isso a conferência por id, e não só pelo tamanho da lista. */
export async function podeEditarCliente(usuario: AuthUser, clienteId: string): Promise<boolean> {
  if (usuario.role === 'admin') return true
  const registro = await prisma.usuario.findUnique({
    where: { id: usuario.id },
    select: {
      clientesPermitidos: { where: { id: clienteId }, select: { id: true } },
      gerencias: {
        where: { gerencia: { ativa: true, carteira: { some: { clienteId } } } },
        select: { gerenciaId: true },
      },
    },
  })
  return decidirEdicao({
    ehAdmin: false,
    membroDaGerenciaDoCliente: (registro?.gerencias ?? []).length > 0,
    liberadoNoModeloAntigo: (registro?.clientesPermitidos ?? []).some((c) => c.id === clienteId),
  })
}
```

- [ ] **Step 4: Rodar e ver passar** — mesmo comando → PASS.

- [ ] **Step 5: Testes falhando do modo `'editar'` e de `exigirAdmin`** — acrescentar em `acesso.test.ts`
  (o mock de `@/lib/prisma` já existe com `usuario.findUnique`):

```ts
describe('modo editar', () => {
  it('403 com motivo quando vê mas não edita', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [], gerencias: [] })
    const resultado = await exigirAcessoCliente(requisicao(), 'c1', 'editar')
    if (!('erro' in resultado)) throw new Error('esperava erro')
    expect(resultado.erro.status).toBe(403)
    await expect(resultado.erro.json()).resolves.toEqual({ error: 'acesso negado', motivo: MOTIVO_SOMENTE_LEITURA })
  })
  it('ok para membro da gerência', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [], gerencias: [{ gerenciaId: 'g1' }] })
    await expect(exigirAcessoCliente(requisicao(), 'c1', 'editar')).resolves.toEqual({ usuario: comum })
  })
})

describe('exigirAdmin', () => {
  it('403 para quem não é admin', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    const r = await exigirAdmin(requisicao())
    if (!('erro' in r)) throw new Error('esperava erro')
    expect(r.erro.status).toBe(403)
  })
  it('ok para admin', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
    await expect(exigirAdmin(requisicao())).resolves.toEqual({ usuario: admin })
  })
})
```
  Importar `exigirAdmin` e `MOTIVO_SOMENTE_LEITURA` no topo. Rodar → FAIL.

- [ ] **Step 6: Implementar em `acesso.ts`**

```ts
import { podeEditarCliente, podeVerCliente } from '@/lib/visibilidade'

export type ModoAcesso = 'ver' | 'editar'
export const MOTIVO_SOMENTE_LEITURA = 'Somente leitura: só a equipe da gerência deste cliente edita.'

export async function exigirAdmin(request: NextRequest): Promise<Resultado> {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado
  if (autenticado.usuario.role !== 'admin') {
    return { erro: NextResponse.json({ error: 'acesso negado' }, { status: 403 }) }
  }
  return autenticado
}

/** 403 pronto quando o usuário não pode `modo` o cliente; `null` quando pode. `'editar'` é obrigatório em todo
 *  método de gravação de cliente (régua em src/app/api/regua-edicao.test.ts). */
export async function verificarAcessoCliente(
  usuario: AuthUser,
  clienteId: string,
  modo: ModoAcesso = 'ver'
): Promise<NextResponse | null> {
  if (modo === 'editar') {
    if (await podeEditarCliente(usuario, clienteId)) return null
    return NextResponse.json({ error: 'acesso negado', motivo: MOTIVO_SOMENTE_LEITURA }, { status: 403 })
  }
  if (await podeVerCliente(usuario, clienteId)) return null
  return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
}

export async function exigirAcessoCliente(request: NextRequest, clienteId: string, modo: ModoAcesso = 'ver'): Promise<Resultado> {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado
  const negado = await verificarAcessoCliente(autenticado.usuario, clienteId, modo)
  return negado ? { erro: negado } : autenticado
}
```

- [ ] **Step 7: Modo nos cinco carregadores** — em cada `carregar.ts`, acrescentar o parâmetro e repassar. Exemplo
  (`src/app/api/contratos/carregar.ts`; os outros quatro iguais, trocando o nome da função e o campo do cliente —
  `linha.contrato.clienteId` no histórico, `faturamento.clienteId`, `demanda.clienteId`, `arquivo.clienteId`):

```ts
import { exigirUsuario, verificarAcessoCliente, type ModoAcesso } from '@/lib/relatorios-clientes/acesso'

export async function carregarContratoComAcesso(request: NextRequest, id: string, modo: ModoAcesso = 'ver') {
  // ...igual até a verificação:
  const negado = await verificarAcessoCliente(autenticado.usuario, contrato.clienteId, modo)
  return negado ? { erro: negado } : { usuario: autenticado.usuario, contrato }
}
```

- [ ] **Step 8: Rodar** — `npx jest src/lib/relatorios-clientes/acesso.test.ts src/lib/visibilidade.test.ts src/app/api/contratos src/app/api/historico-contrato src/app/api/faturamentos src/app/api/demandas src/app/api/arquivos --runInBand` → PASS (o padrão `'ver'` não muda nada nas rotas).

- [ ] **Step 9: Commit** — `ARQS` = os 9 arquivos acima, `MSG="feat(gerencias): verificação de edição de cliente (modo editar)"`.

---

### Task 4: Régua das rotas de gravação

**Files:**
- Create: `src/app/api/regua-edicao.test.ts`

**Interfaces:**
- Consumes: convenção da Task 3 — método de gravação de cliente contém a string `'editar'` (em
  `verificarAcessoCliente`, `exigirAcessoCliente` ou `carregarXComAcesso`) ou chama `exigirAdmin`, ou a checagem
  `role !== 'admin'`.

- [ ] **Step 1: Escrever a régua** (vai falhar até as Tasks 5–7)

```ts
/** @jest-environment node */
// Régua da spec 2026-10-02-gerencias §6: todo POST/PUT/PATCH/DELETE das rotas de cliente pede edição. Rota nova
// de cliente entra sozinha (pelo prefixo); exceção só com motivo escrito em EXCECOES.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const API = join(process.cwd(), 'src', 'app', 'api')
const PREFIXOS = [
  'clientes', 'contratos', 'historico-contrato', 'itens-contrato', 'faturamentos', 'notas-fiscais', 'demandas',
  'tramites-demanda', 'solicitacoes', 'termos-confirmacao', 'responsaveis', 'arquivos', 'documentos',
]
const EXCECOES: Record<string, string> = {
  'arquivos/upload-token/route.ts POST': 'só emite o token do Blob; o registro (clientes/[clienteId]/arquivos POST) confere a edição',
}
const PROVA = /'editar'|exigirAdmin\(|role !== 'admin'/

function rotas(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return rotas(caminho)
    return nome === 'route.ts' ? [caminho] : []
  })
}

function metodosDeGravacao(fonte: string): Array<{ metodo: string; corpo: string }> {
  const marcas = [...fonte.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)]
  return marcas
    .map((m, i) => ({ metodo: m[1], corpo: fonte.slice(m.index!, marcas[i + 1]?.index ?? fonte.length) }))
    .filter((m) => m.metodo !== 'GET')
}

const alvos = PREFIXOS.flatMap((p) => rotas(join(API, p)))

it('acha as rotas de cliente', () => expect(alvos.length).toBeGreaterThan(25))

it.each(alvos.map((a) => [relative(API, a).split(sep).join('/'), a]))('%s pede edição em toda gravação', (rel, caminho) => {
  const sem = metodosDeGravacao(readFileSync(caminho, 'utf8'))
    .filter((m) => !PROVA.test(m.corpo) && !EXCECOES[`${rel} ${m.metodo}`])
    .map((m) => m.metodo)
  expect(sem).toEqual([])
})
```

- [ ] **Step 2: Rodar e anotar o que falta** — `npx jest src/app/api/regua-edicao.test.ts --runInBand` → FAIL;
  a lista de falhas é o trabalho das Tasks 5–7. Não commitar ainda (fica junto com a Task 7).

---

### Task 5: Gravações das rotas `clientes/**`, `documentos/**` e análises

**Files (Modify):**
- `src/app/api/clientes/[clienteId]/route.ts` (PATCH → `exigirAcessoCliente(request, clienteId, 'editar')`; DELETE já é admin)
- `src/app/api/clientes/[clienteId]/arquivos/route.ts`, `.../contratos/route.ts`, `.../faturamentos/route.ts`,
  `.../responsaveis/route.ts` (POST → `'editar'`)
- `src/app/api/clientes/[clienteId]/competencias/[competencia]/analise-consolidada/route.ts` e
  `.../analise-evolucao/route.ts` (nos métodos de gravação, trocar `podeVerCliente(usuario, clienteId)` por
  `podeEditarCliente(usuario, clienteId)` e devolver o mesmo 403 com `motivo: MOTIVO_SOMENTE_LEITURA`)
- `src/app/api/documentos/route.ts` (POST: idem, `podeEditarCliente`)
- `src/app/api/documentos/[id]/route.ts` (DELETE: antes da regra admin/quem enviou, `const negado = await
  verificarAcessoCliente(usuario, documento.clienteId, 'editar'); if (negado) return negado`)
- `src/app/api/documentos/[id]/reprocessar/route.ts` (POST: idem, depois de carregar o documento)
- Tests: os `route.test.ts` de cada pasta

- [ ] **Step 1: Teste falhando por rota** — em cada `route.test.ts` tocado, acrescentar um caso para o método de
  gravação. Modelo (contratos; ajustar corpo/params à rota):

```ts
it('POST 403 com motivo para quem vê mas não é da gerência', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
  ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [], gerencias: [] })
  const resposta = await POST(requisicaoPost(corpoValido), contexto('c1'))
  expect(resposta.status).toBe(403)
  await expect(resposta.json()).resolves.toMatchObject({ motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.' })
})
```
  Se o teste da rota mocka `@/lib/visibilidade`, acrescentar `podeEditarCliente: jest.fn()` ao mock e usar
  `mockResolvedValue(false)` neste caso (e `true` onde o teste já espera sucesso).

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/app/api/clientes src/app/api/documentos --runInBand` → os casos novos FAIL.

- [ ] **Step 3: Trocar as chamadas** conforme a lista de arquivos acima.

- [ ] **Step 4: Rodar** — mesmo comando → PASS; e `npx jest src/app/api/regua-edicao.test.ts --runInBand` →
  `clientes/**` e `documentos/**` saem da lista de falhas.

- [ ] **Step 5: Commit** — `ARQS` = rotas e testes tocados, `MSG="feat(gerencias): gravação de cliente, documento e análise pede edição"`.

---

### Task 6: Gravações de contrato, histórico e itens

**Files (Modify):**
- `src/app/api/contratos/[id]/route.ts`, `.../historico/route.ts`, `.../itens/route.ts`, `.../itens/importar/route.ts`
  (métodos de gravação: `carregarContratoComAcesso(request, id, 'editar')`)
- `src/app/api/historico-contrato/[id]/route.ts`, `.../pdf/[tipo]/route.ts`, `.../pdf/[tipo]/copiar/route.ts`
  (gravação: `carregarHistoricoComAcesso(request, id, 'editar')`)
- `src/app/api/itens-contrato/[id]/route.ts` (gravação: `verificarAcessoCliente(usuario, clienteId, 'editar')`)
- Tests: os `route.test.ts` dessas pastas

- [ ] **Step 1: Teste falhando** — mesmo modelo da Task 5 Step 1, um caso por método de gravação (PATCH/DELETE do
  contrato, POST do histórico, POST/importar de itens, PATCH/DELETE da linha do histórico, PUT/DELETE de PDF, POST
  de copiar, PATCH/DELETE do item).
- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/app/api/contratos src/app/api/historico-contrato src/app/api/itens-contrato --runInBand`.
- [ ] **Step 3: Trocar as chamadas** — só nos métodos de gravação; GET continua com o padrão `'ver'`.
- [ ] **Step 4: Rodar** — mesmo comando → PASS; régua sem essas pastas na lista.
- [ ] **Step 5: Commit** — `MSG="feat(gerencias): gravação de contrato, histórico e itens pede edição"`.

---

### Task 7: Gravações de faturamento, NF, demanda, trâmite, solicitação, termo, responsável e arquivo

**Files (Modify):**
- `src/app/api/faturamentos/[id]/route.ts`, `.../notas/route.ts`, `.../pdf/route.ts` (`carregarFaturamentoComAcesso(request, id, 'editar')`)
- `src/app/api/notas-fiscais/[id]/route.ts`, `src/app/api/responsaveis/[id]/route.ts`,
  `src/app/api/solicitacoes/route.ts`, `src/app/api/solicitacoes/[id]/route.ts`,
  `src/app/api/termos-confirmacao/route.ts`, `src/app/api/termos-confirmacao/[id]/route.ts`,
  `src/app/api/tramites-demanda/[id]/route.ts`, `src/app/api/demandas/route.ts`, `src/app/api/demandas/[id]/route.ts`
  (`verificarAcessoCliente(usuario, clienteId, 'editar')` / `exigirAcessoCliente(..., 'editar')`)
- `src/app/api/demandas/[id]/tramites/route.ts` (`carregarDemandaComAcesso(request, demandaId, 'editar')`)
- `src/app/api/arquivos/[id]/route.ts` (PATCH/DELETE: `carregarArquivoComAcesso(request, id, 'editar')`)
- Tests: os `route.test.ts` dessas pastas; `src/app/api/regua-edicao.test.ts`

- [ ] **Step 1: Teste falhando** — modelo da Task 5 Step 1, um caso por método de gravação.
- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/app/api/faturamentos src/app/api/notas-fiscais src/app/api/responsaveis src/app/api/solicitacoes src/app/api/termos-confirmacao src/app/api/tramites-demanda src/app/api/demandas src/app/api/arquivos --runInBand`.
- [ ] **Step 3: Trocar as chamadas.**
- [ ] **Step 4: Régua inteira verde** — `npx jest src/app/api/regua-edicao.test.ts --runInBand` → PASS. Se sobrar
  método que não grava dado de cliente, ele entra em `EXCECOES` com o motivo — nunca afrouxar `PROVA`.
- [ ] **Step 5: Suíte da API** — `npx jest src/app/api --runInBand --forceExit` → PASS.
- [ ] **Step 6: Commit** — `ARQS` = rotas, testes e `src/app/api/regua-edicao.test.ts`,
  `MSG="feat(gerencias): demais gravações de cliente pedem edição + régua das rotas"`.

---

### Task 8: Leitura liberada para todos

**Files:**
- Modify: `src/lib/visibilidade.ts` (`clienteIdsPermitidos`)
- Modify: testes que esperam 403 de **leitura** para quem não tem o cliente liberado (lista do `grep` abaixo) e
  testes de ferramenta do assistente que esperam cliente filtrado
- Test: `src/lib/visibilidade.test.ts`

**Interfaces:**
- Produces: `clienteIdsPermitidos()` sempre `null`; `podeVerCliente()` sempre `true`; `clientesVisiveisWhere()` sempre `{}`.

- [ ] **Step 1: Teste falhando** — em `visibilidade.test.ts`:

```ts
describe('leitura liberada (spec 2026-10-02-gerencias §0.1)', () => {
  it('quem não é admin vê todos os clientes', async () => {
    await expect(clienteIdsPermitidos(comum)).resolves.toBeNull()
    await expect(podeVerCliente(comum, 'qualquer')).resolves.toBe(true)
    await expect(clientesVisiveisWhere(comum)).resolves.toEqual({})
  })
})
```
  Rodar → FAIL.

- [ ] **Step 2: Implementar**

```ts
/** `null` = sem restrição. Desde 02/10/2026 todo usuário logado vê todos os clientes (spec
 *  2026-10-02-gerencias §0.1); quem edita decide `podeEditarCliente`. */
export async function clienteIdsPermitidos(_usuario: AuthUser): Promise<string[] | null> {
  return null
}
```

- [ ] **Step 3: Rodar a suíte e listar os testes de leitura que quebraram**

```bash
npx jest --runInBand --forceExit 2>&1 | grep -E "✕|FAIL" | head -80
```
  Para cada caso que esperava 403/lista filtrada **num GET** (ou numa ferramenta do assistente) para usuário sem o
  cliente liberado: trocar o caso para "usuário logado sem vínculo vê" (200 / cliente presente). Caso que espera
  403 numa **gravação** não deve quebrar — se quebrar, é rota que a Task 5–7 deixou com `'ver'`: corrija a rota,
  não o teste.

- [ ] **Step 4: Suíte inteira verde** — `npx jest --runInBand --forceExit` → PASS.
- [ ] **Step 5: Commit** — `MSG="feat(gerencias): todo usuário logado vê todos os clientes"`.

---

### Task 9: Exclusão e mesclagem de cliente levam a carteira

**Files:**
- Modify: `src/lib/relatorios-clientes/excluir-cliente.ts`
- Modify: `src/app/api/admin/clientes/[id]/mesclar/route.ts`
- Test: `src/lib/relatorios-clientes/excluir-cliente.test.ts`, `src/app/api/admin/clientes/[id]/mesclar/route.test.ts` (criar se não existir)

- [ ] **Step 1: Testes falhando**
  - `excluir-cliente.test.ts`: o mock de `prisma` ganha `carteiraCliente: { deleteMany: jest.fn() }` e
    `movimentoCarteira: { deleteMany: jest.fn() }`; novo caso: `operacoesExcluirCliente('c1')` chama os dois
    `deleteMany({ where: { clienteId: 'c1' } })` **antes** de `cliente.delete`.
  - `mesclar/route.test.ts`: origem com carteira na gerência g1 e destino sem carteira → a transação inclui
    `movimentoCarteira.updateMany({ where: { clienteId: origem }, data: { clienteId: destino } })` e cria
    `carteiraCliente` do destino na g1; destino **com** carteira → mantém a dele (nenhum `carteiraCliente.create`).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar**
  - `excluir-cliente.ts`, antes de `prisma.cliente.delete(...)`:
    ```ts
    // Gerência e carteira (spec 2026-10-02-gerencias): a FK já é Cascade; explícito para a regra ficar à vista.
    prisma.movimentoCarteira.deleteMany({ where: doCliente }),
    prisma.carteiraCliente.deleteMany({ where: doCliente }),
    ```
  - `mesclar/route.ts`: antes da transação, ler `prisma.carteiraCliente.findUnique({ where: { clienteId: id } })` e a
    do destino; na transação, antes de apagar a origem, acrescentar `prisma.movimentoCarteira.updateMany(mover)` e,
    quando a origem tem carteira e o destino não, `prisma.carteiraCliente.create({ data: { clienteId:
    destinoClienteId, gerenciaId: daOrigem.gerenciaId, movidoPorId: null } })`. As duas operações entram na
    transação **antes** de `prisma.cliente.delete({ where: { id } })`: a carteira da origem some no Cascade desse delete.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `MSG="feat(gerencias): excluir e mesclar cliente levam carteira e movimentos"`.

---

### Task 10: Serviço de gerências

**Files:**
- Create: `src/lib/gerencias/tipos.ts`, `src/lib/gerencias/servico.ts`
- Test: `src/lib/gerencias/servico.test.ts`

**Interfaces:**
- Consumes: `PapelGerencia`, `Vinculo` (Task 2).
- Produces:
  ```ts
  // tipos.ts
  export interface GerenciaResumo { id: string; nome: string; sigla: string | null; ativa: boolean; clientes: number; managers: string[] }
  export interface MembroSerializado { usuarioId: string; nome: string; email: string; papel: PapelGerencia }
  export interface ClienteCarteira { id: string; nome: string; siglaLegado: string | null }
  export interface MovimentoSerializado { id: string; cliente: string; de: string | null; para: string | null; por: string | null; em: string }
  export interface GerenciaDetalhe extends GerenciaResumo { carteira: ClienteCarteira[]; membros: MembroSerializado[]; movimentos: MovimentoSerializado[] }
  export class ErroGerencia extends Error { constructor(mensagem: string, readonly status: 400 | 404 | 409) }
  // servico.ts
  export async function listarGerencias(): Promise<GerenciaResumo[]>
  export async function detalheGerencia(id: string): Promise<GerenciaDetalhe | null>
  export async function criarGerencia(d: { nome: string; sigla?: string | null }): Promise<GerenciaResumo>
  export async function atualizarGerencia(id: string, d: { nome?: string; sigla?: string | null; ativa?: boolean }): Promise<void>
  export async function clientesSemGerencia(): Promise<ClienteCarteira[]>
  export async function moverClientes(clienteIds: string[], paraGerenciaId: string | null, porId: string): Promise<{ movidos: number }>
  export async function vinculosDoUsuario(usuarioId: string): Promise<Array<Vinculo & { nome: string }>>
  export async function papelNaGerencia(gerenciaId: string, usuarioId: string): Promise<PapelGerencia | null>
  export async function gravarMembro(gerenciaId: string, usuarioId: string, papel: PapelGerencia): Promise<void>
  export async function removerMembro(gerenciaId: string, usuarioId: string): Promise<void>
  export async function gerenciaDoCliente(clienteId: string): Promise<{ id: string; nome: string } | null>
  ```

- [ ] **Step 1: Testes falhando** (prisma mockado; um caso por regra de negócio do serviço)

```ts
/** @jest-environment node */
jest.mock('@/lib/prisma', () => {
  const tx = (ops: unknown[]) => Promise.all(ops)
  return {
    prisma: {
      $transaction: jest.fn(tx),
      gerencia: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      carteiraCliente: { findMany: jest.fn(), count: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
      movimentoCarteira: { create: jest.fn(), findMany: jest.fn() },
      membroGerencia: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn(), delete: jest.fn() },
      cliente: { findMany: jest.fn() },
      usuario: { findMany: jest.fn() },
    },
  }
})
import { prisma } from '@/lib/prisma'
import { atualizarGerencia, moverClientes } from './servico'
import { ErroGerencia } from './tipos'
const p = prisma as unknown as Record<string, Record<string, jest.Mock>>
beforeEach(() => jest.clearAllMocks())

describe('moverClientes', () => {
  it('grava carteira e movimento só de quem muda de lugar', async () => {
    p.gerencia.findUnique.mockResolvedValue({ id: 'g2', ativa: true })
    p.carteiraCliente.findMany.mockResolvedValue([{ clienteId: 'c1', gerenciaId: 'g1' }, { clienteId: 'c2', gerenciaId: 'g2' }])
    await expect(moverClientes(['c1', 'c2', 'c3'], 'g2', 'u1')).resolves.toEqual({ movidos: 2 })
    expect(p.movimentoCarteira.create).toHaveBeenCalledWith({ data: { clienteId: 'c1', deGerenciaId: 'g1', paraGerenciaId: 'g2', porId: 'u1' } })
    expect(p.movimentoCarteira.create).toHaveBeenCalledWith({ data: { clienteId: 'c3', deGerenciaId: null, paraGerenciaId: 'g2', porId: 'u1' } })
    expect(p.movimentoCarteira.create).toHaveBeenCalledTimes(2)
  })
  it('para = null tira da carteira', async () => {
    p.carteiraCliente.findMany.mockResolvedValue([{ clienteId: 'c1', gerenciaId: 'g1' }])
    await moverClientes(['c1'], null, 'u1')
    expect(p.carteiraCliente.deleteMany).toHaveBeenCalledWith({ where: { clienteId: { in: ['c1'] } } })
  })
  it('recusa gerência desativada', async () => {
    p.gerencia.findUnique.mockResolvedValue({ id: 'g2', ativa: false })
    await expect(moverClientes(['c1'], 'g2', 'u1')).rejects.toThrow(new ErroGerencia('Gerência desativada não recebe clientes.', 409))
  })
})

describe('atualizarGerencia', () => {
  it('não desativa gerência com cliente', async () => {
    p.carteiraCliente.count.mockResolvedValue(3)
    await expect(atualizarGerencia('g1', { ativa: false })).rejects.toThrow('Tire os 3 clientes da carteira antes de desativar.')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/lib/gerencias/servico.test.ts --runInBand`.

- [ ] **Step 3: Implementar `tipos.ts`** (interfaces da seção Interfaces, mais):

```ts
export class ErroGerencia extends Error {
  constructor(mensagem: string, readonly status: 400 | 404 | 409) {
    super(mensagem)
    this.name = 'ErroGerencia'
  }
}
```

- [ ] **Step 4: Implementar `servico.ts`** — trechos com regra (o resto é `findMany`/`select` direto):

```ts
import { prisma } from '@/lib/prisma'
import type { PapelGerencia, Vinculo } from './permissao'
import { ErroGerencia, type ClienteCarteira, type GerenciaDetalhe, type GerenciaResumo } from './tipos'

const SELECT_CLIENTE = { id: true, nome: true, siglaLegado: true } as const

export async function moverClientes(clienteIds: string[], paraGerenciaId: string | null, porId: string) {
  if (paraGerenciaId) {
    const destino = await prisma.gerencia.findUnique({ where: { id: paraGerenciaId }, select: { id: true, ativa: true } })
    if (!destino) throw new ErroGerencia('Gerência não encontrada.', 404)
    if (!destino.ativa) throw new ErroGerencia('Gerência desativada não recebe clientes.', 409)
  }
  const atuais = await prisma.carteiraCliente.findMany({ where: { clienteId: { in: clienteIds } }, select: { clienteId: true, gerenciaId: true } })
  const deOnde = new Map(atuais.map((a) => [a.clienteId, a.gerenciaId]))
  const mudam = clienteIds.filter((id) => (deOnde.get(id) ?? null) !== paraGerenciaId)
  if (mudam.length === 0) return { movidos: 0 }

  const gravar = paraGerenciaId
    ? mudam.map((clienteId) =>
        prisma.carteiraCliente.upsert({
          where: { clienteId },
          create: { clienteId, gerenciaId: paraGerenciaId, movidoPorId: porId },
          update: { gerenciaId: paraGerenciaId, movidoPorId: porId, movidoEm: new Date() },
        })
      )
    : [prisma.carteiraCliente.deleteMany({ where: { clienteId: { in: mudam } } })]
  const trilha = mudam.map((clienteId) =>
    prisma.movimentoCarteira.create({
      data: { clienteId, deGerenciaId: deOnde.get(clienteId) ?? null, paraGerenciaId, porId },
    })
  )
  await prisma.$transaction([...gravar, ...trilha])
  return { movidos: mudam.length }
}

export async function atualizarGerencia(id: string, d: { nome?: string; sigla?: string | null; ativa?: boolean }) {
  if (d.ativa === false) {
    const clientes = await prisma.carteiraCliente.count({ where: { gerenciaId: id } })
    if (clientes > 0) throw new ErroGerencia(`Tire os ${clientes} clientes da carteira antes de desativar.`, 409)
  }
  await prisma.gerencia.update({ where: { id }, data: d })
}

export async function listarGerencias(): Promise<GerenciaResumo[]> {
  const linhas = await prisma.gerencia.findMany({
    orderBy: [{ ativa: 'desc' }, { nome: 'asc' }],
    select: {
      id: true, nome: true, sigla: true, ativa: true,
      _count: { select: { carteira: true } },
      membros: { where: { papel: 'manager' }, select: { usuario: { select: { nome: true } } } },
    },
  })
  return linhas.map((g) => ({
    id: g.id, nome: g.nome, sigla: g.sigla, ativa: g.ativa,
    clientes: g._count.carteira, managers: g.membros.map((m) => m.usuario.nome),
  }))
}

export async function clientesSemGerencia(): Promise<ClienteCarteira[]> {
  return prisma.cliente.findMany({ where: { carteira: null }, orderBy: { nome: 'asc' }, select: SELECT_CLIENTE })
}

export async function vinculosDoUsuario(usuarioId: string): Promise<Array<Vinculo & { nome: string }>> {
  const linhas = await prisma.membroGerencia.findMany({
    where: { usuarioId, gerencia: { ativa: true } },
    select: { gerenciaId: true, papel: true, gerencia: { select: { nome: true } } },
    orderBy: { gerencia: { nome: 'asc' } },
  })
  return linhas.map((l) => ({ gerenciaId: l.gerenciaId, papel: l.papel as PapelGerencia, nome: l.gerencia.nome }))
}

export async function gravarMembro(gerenciaId: string, usuarioId: string, papel: PapelGerencia) {
  await prisma.membroGerencia.upsert({
    where: { gerenciaId_usuarioId: { gerenciaId, usuarioId } },
    create: { gerenciaId, usuarioId, papel },
    update: { papel },
  })
}
```
  `detalheGerencia` junta `gerencia.findUnique` (com `_count`, managers), `carteira` (`select: { cliente: { select:
  SELECT_CLIENTE } }`, ordenado por nome), `membros` (`usuario: { select: { id, nome, email } }`) e os 50 últimos
  `movimentoCarteira` **dos clientes da gerência ou com `deGerenciaId`/`paraGerenciaId` = id**, resolvendo de/para
  pelo mapa de nomes de `gerencia.findMany({ select: { id, nome } })` e `por` por `usuario.findMany` dos `porId`;
  datas em ISO. `criarGerencia` traduz `P2002` em `ErroGerencia('Já existe gerência com esse nome ou sigla.', 409)`.
  `papelNaGerencia`, `removerMembro`, `gerenciaDoCliente` são `findUnique`/`delete` diretos.

- [ ] **Step 5: Rodar e ver passar.**
- [ ] **Step 6: Commit** — `MSG="feat(gerencias): serviço de gerência, equipe e carteira"`.

---

### Task 11: Rotas do admin e da equipe

**Files:**
- Create: `src/app/api/admin/gerencias/route.ts` (GET lista + `semGerencia` (número); POST cria)
- Create: `src/app/api/admin/gerencias/[id]/route.ts` (PATCH nome/sigla/ativa)
- Create: `src/app/api/admin/gerencias/carteira/route.ts` (POST `{ clienteIds: string[], gerenciaId: string | null }`)
- Create: `src/app/api/admin/gerencias/sem-gerencia/route.ts` (GET clientes sem carteira)
- Create: `src/app/api/admin/resumo/route.ts` (GET `{ usuarios, gerencias, clientes, semGerencia }`)
- Create: `src/app/api/gerencias/minhas/route.ts` (GET vínculos do usuário logado)
- Create: `src/app/api/gerencias/[id]/route.ts` (GET detalhe — admin ou membro)
- Create: `src/app/api/gerencias/[id]/membros/route.ts` (POST `{ usuarioId, papel }`, DELETE `?usuarioId=`)
- Create: `src/app/api/gerencias/[id]/candidatos/route.ts` (GET usuários `{ id, nome, email }` fora da equipe — admin ou manager)
- Create: `src/app/api/clientes/[clienteId]/permissao/route.ts` (GET `{ gerencia, podeEditar }`)
- Test: um `route.test.ts` ao lado de cada uma

**Interfaces:**
- Consumes: `exigirAdmin`, `exigirUsuario` (Task 3); serviço (Task 10); `podeVerDetalheGerencia`,
  `decidirMudancaNaEquipe`, `PAPEIS` (Task 2); `podeEditarCliente` (Task 3).
- Produces (JSON): `GET /api/admin/gerencias` → `{ gerencias: GerenciaResumo[], semGerencia: number }`;
  `GET /api/gerencias/[id]` → `GerenciaDetalhe & { podeGerirEquipe: boolean; podeNomearManager: boolean }`;
  `GET /api/gerencias/minhas` → `Array<{ gerenciaId, papel, nome }>`;
  `GET /api/clientes/[clienteId]/permissao` → `{ gerencia: { id, nome } | null, podeEditar: boolean }`.

- [ ] **Step 1: Testes falhando** — para cada rota, mockar `@/lib/auth` (`getAuthUser`) e `@/lib/gerencias/servico`
  (não o prisma), como em `acesso.test.ts`. Casos obrigatórios:
  - admin/*: 403 para não admin; POST gerência sem nome → 400 `{ error: 'Nome: obrigatório' }` (via `lerCorpo` com
    `{ nome: 'Nome', sigla: 'Sigla' }`); `ErroGerencia` vira `{ error: mensagem }` com o `status` dela.
  - carteira: `clienteIds` vazio → 400; repassa `porId` = usuário logado.
  - `gerencias/[id]` GET: membro 200 com `podeGerirEquipe` (true só para manager/admin) e `podeNomearManager`
    (true só para admin); de fora 403; inexistente 404.
  - membros POST: manager põe `usuario` → 200; manager põe `manager` → 403 `{ error: 'Só o administrador nomeia ou
    tira manager.' }`; usuário da gerência → 403; papel inválido → 400. DELETE: manager tira `usuario` → 200; tira
    `manager` → 403.
  - permissao: devolve `gerenciaDoCliente` + `podeEditarCliente`; 401 sem login.
- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/app/api/admin/gerencias src/app/api/admin/resumo src/app/api/gerencias src/app/api/clientes/[clienteId]/permissao --runInBand`.
- [ ] **Step 3: Implementar** — rotas finas. Modelo da rota de membros:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { decidirMudancaNaEquipe, PAPEIS, type PapelGerencia } from '@/lib/gerencias/permissao'
import { gravarMembro, papelNaGerencia, removerMembro, vinculosDoUsuario } from '@/lib/gerencias/servico'

type Contexto = { params: Promise<{ id: string }> }
const esquema = z.object({ usuarioId: z.string().min(1), papel: z.enum(PAPEIS as [PapelGerencia, ...PapelGerencia[]]) })

async function decidir(request: NextRequest, gerenciaId: string, usuarioId: string, papelNovo: PapelGerencia | null) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado
  const { usuario } = autenticado
  const decisao = decidirMudancaNaEquipe({
    ehAdmin: usuario.role === 'admin',
    vinculos: usuario.role === 'admin' ? [] : await vinculosDoUsuario(usuario.id),
    gerenciaId,
    papelAtual: await papelNaGerencia(gerenciaId, usuarioId),
    papelNovo,
  })
  return decisao.ok ? autenticado : { erro: NextResponse.json({ error: decisao.motivo }, { status: 403 }) }
}

export async function POST(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const corpo = await lerCorpo(request, esquema, { usuarioId: 'Pessoa', papel: 'Papel' })
  if ('erro' in corpo) return corpo.erro
  const ok = await decidir(request, id, corpo.dados.usuarioId, corpo.dados.papel)
  if ('erro' in ok) return ok.erro
  await gravarMembro(id, corpo.dados.usuarioId, corpo.dados.papel)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const usuarioId = request.nextUrl.searchParams.get('usuarioId')
  if (!usuarioId) return NextResponse.json({ error: 'Pessoa: obrigatório' }, { status: 400 })
  const ok = await decidir(request, id, usuarioId, null)
  if ('erro' in ok) return ok.erro
  await removerMembro(id, usuarioId)
  return NextResponse.json({ ok: true })
}
```
  As de `/api/admin/**` começam por `exigirAdmin(request)` (o middleware já barra, mas a rota não depende disso).
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `MSG="feat(gerencias): rotas do admin, da equipe e permissão do cliente"`.

---

### Task 12: Telas de gerência (admin e manager)

**Files:**
- Create: `src/components/gerencias/detalhe-gerencia.tsx` (+ `detalhe-gerencia.test.tsx`)
- Create: `src/app/admin/gerencias/page.tsx` (+ `page.test.tsx`)
- Create: `src/app/admin/gerencias/[id]/page.tsx`
- Create: `src/app/gerencias/page.tsx`, `src/app/gerencias/[id]/page.tsx`

**Interfaces:**
- Consumes: rotas da Task 11; tipos da Task 10.
- Produces: `export function DetalheGerencia({ gerenciaId, modo }: { gerenciaId: string; modo: 'admin' | 'manager' })`.

- [ ] **Step 1: Testes falhando** (Testing Library, `global.fetch` mockado como nos testes de tela existentes):
  - `detalhe-gerencia.test.tsx`: modo `admin` mostra "Adicionar clientes" e o seletor de papel com "Manager";
    modo `manager` com `podeGerirEquipe: true, podeNomearManager: false` **não** mostra "Adicionar clientes", mostra
    "Adicionar pessoa" e o seletor só com "Usuário"; `podeGerirEquipe: false` não mostra botão nenhum; a lista de
    movimentos mostra "SMIT · Gerência Y → Gerência X · Lucas · 02/10/2026".
  - `admin/gerencias/page.test.tsx`: cartão "Clientes sem gerência (46)"; criar gerência faz POST e recarrega;
    selecionar 2 clientes soltos + escolher gerência faz POST em `/api/admin/gerencias/carteira` com os dois ids.
- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/components/gerencias src/app/admin/gerencias --runInBand`.
- [ ] **Step 3: Implementar**
  - `/admin/gerencias`: `<h1>Gerências e carteiras</h1>`; formulário "Nova gerência" (nome, sigla); tabela (nome,
    sigla, clientes, managers, situação, link "Abrir"); cartão "Clientes sem gerência (N)" que abre a lista com
    busca por nome/sigla, caixas de seleção, "Mover para" (select das gerências ativas) e botão "Mover".
  - `DetalheGerencia`: cabeçalho (nome, sigla, renomear/desativar só no modo admin); coluna **Carteira** (lista;
    no modo admin, "Adicionar clientes" abre lista de todos os clientes com busca e seleção, cliente de outra
    gerência rotulado "está na <nome> — mover para cá"; "Tirar da carteira" por linha); coluna **Equipe** (nome,
    e-mail, papel; "Adicionar pessoa" lista `/api/gerencias/[id]/candidatos`; trocar papel e remover conforme
    `podeGerirEquipe`/`podeNomearManager`); seção **Movimentos**. Erro de rota aparece com o `error` da resposta.
  - `/admin/gerencias/[id]` → `<DetalheGerencia modo="admin" />`; `/gerencias/[id]` → `modo="manager"`;
    `/gerencias` busca `/api/gerencias/minhas` e lista as gerências (uma só → `router.replace` para ela; nenhuma →
    "Você não está em nenhuma gerência.").
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `MSG="feat(gerencias): telas de gerência para admin e manager"`.

---

### Task 13: Menu "Administração", painel `/admin` e coluna de gerências em usuários

**Files:**
- Modify: `src/components/nav-bar.tsx`, `src/components/nav-bar.test.tsx`
- Create: `src/app/admin/page.tsx` (+ `page.test.tsx`)
- Modify: `src/app/api/admin/usuarios/route.ts` (GET inclui `gerencias: { select: { papel, gerencia: { select: { nome } } } }`)
- Modify: `src/app/admin/usuarios/page.tsx` (coluna "Gerências": "GCR — manager, GTI — usuário")

- [ ] **Step 0: Conferir que ninguém está mexendo no menu** — `git status --short src/components/nav-bar.tsx src/components/nav-bar.test.tsx`.
  Se aparecer `M`, **pare e pergunte** ao usuário (em 02/10 havia mudança sem commit de outra sessão).
- [ ] **Step 1: Testes falhando** em `nav-bar.test.tsx`:
  - admin vê o grupo "Administração" com os sublinks, nesta ordem: Usuários (`/admin/usuarios`), Gerências e
    carteiras (`/admin/gerencias`), Clientes (`/admin/clientes`), Regras de notificação (`/admin/regras-notificacao`),
    Assistente de IA (`/admin/assistente`); o link do grupo é `/admin`.
  - aparece mesmo com `MENU_SIMPLIFICADO` (é o caso hoje).
  - não admin não vê "Administração".
  - quem é manager (mock de `/api/gerencias/minhas` com `papel: 'manager'`) vê "Minha gerência" (`/gerencias`);
    com duas gerências, "Minhas gerências".
  - todos os `href` que o menu tinha antes continuam presentes para o admin (lista fixa no teste).
  - `src/app/admin/page.test.tsx`: mostra os quatro números de `/api/admin/resumo` e um cartão por submenu.
- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/components/nav-bar.test.tsx src/app/admin/page.test.tsx --runInBand`.
- [ ] **Step 3: Implementar**
  - `nav-bar.tsx`: `ADMIN_LINK = { href: '/admin', label: 'Administração', icon: ShieldCheck }` e `ADMIN_SUBLINKS`
    (os cinco acima; `Building` para gerências); render com `<GrupoMenu>` (o mesmo de ConfereAI) num bloco próprio,
    `{ehAdmin && (...)}` **fora** do `!MENU_SIMPLIFICADO`, com estado `adminAberto` aberto quando a rota começa
    com `/admin`. O bloco antigo `CONFIG_LINKS` sai (os links agora vivem em `ADMIN_SUBLINKS`).
    "Minha(s) gerência(s)": `fetch('/api/gerencias/minhas')` junto do `/api/auth/me`; se houver vínculo `manager`,
    `<LinkMenu href="/gerencias" icon={Building} …>`.
  - `/admin/page.tsx`: `<h1>Administração</h1>`, linha de números (usuários, gerências, clientes, clientes sem
    gerência — este em laranja quando > 0, com link para `/admin/gerencias`), grade de cartões (título, uma frase,
    link) para os cinco submenus.
  - `/admin/usuarios`: coluna "Gerências" (a liberação de clientes continua até a Task 15).
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `MSG="feat(admin): menu Administração, painel e gerências na lista de usuários"`.

---

### Task 14: Ficha e lista de clientes — selo, filtro e "Somente leitura"

**Files:**
- Create: `src/app/clientes/[id]/permissao-cliente.tsx` (+ `.test.tsx`)
- Create: `src/app/clientes/[id]/layout.tsx`
- Modify: `src/app/api/clientes/route.ts` (GET inclui `carteira: { select: { gerencia: { select: { id, nome } } } }`
  e devolve `gerencia: { id, nome } | null`)
- Modify: `src/app/clientes/lista-clientes.tsx` (selo + filtro "Gerência": Todas / Sem gerência / cada uma)
- Modify (esconder gravação quando `!podeEditar`): `src/app/clientes/[id]/page.tsx`,
  `src/app/clientes/[id]/abas/aba-contratos.tsx`, `aba-demandas.tsx`, `aba-documentos.tsx`, `aba-faturamento.tsx`,
  `aba-fornecedores.tsx`, `aba-responsaveis.tsx`, `abas/documentos/envio-arquivos.tsx`,
  `abas/documentos/lista-arquivos.tsx`, `abas/documentos/painel-arquivo.tsx`,
  `contratos/[contratoId]/page.tsx`, `secao-historico.tsx`, `secao-itens.tsx`, `importar-planilha-itens.tsx`,
  `seletor-pdf.tsx`, `faturamentos/[faturamentoId]/page.tsx`, `secao-notas.tsx`, `src/app/clientes/[id]/[competencia]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/clientes/[clienteId]/permissao` (Task 11).
- Produces:
  ```ts
  export function PermissaoClienteProvider({ clienteId, children }: { clienteId: string; children: React.ReactNode })
  export function usePermissaoCliente(): { carregando: boolean; podeEditar: boolean; gerencia: { id: string; nome: string } | null }
  export function SeloCarteira({ gerencia }: { gerencia: { id: string; nome: string } | null })
  ```
  Sem provider (componente usado fora da ficha), `usePermissaoCliente()` devolve `podeEditar: true` — a API continua
  sendo quem barra.

- [ ] **Step 1: Testes falhando**
  - `permissao-cliente.test.tsx`: com `/permissao` → `{ gerencia: { id: 'g1', nome: 'GCR' }, podeEditar: false }`,
    o layout mostra "Somente leitura: este cliente é da GCR." e `SeloCarteira` mostra "Carteira: GCR"; com
    `gerencia: null, podeEditar: false` → "Somente leitura: cliente sem gerência — só o administrador edita.";
    enquanto carrega, `podeEditar` é `false` (nada de botão piscando).
  - Em cada arquivo modificado com teste existente, um caso `podeEditar: false` → os botões de gravação somem
    (procure-os por `grep -nE "method: '(POST|PATCH|PUT|DELETE)'"` no arquivo: cada `fetch` desses tem um botão,
    link ou área de soltar que o dispara — é esse elemento que some). Arquivo sem teste ganha um teste com esse caso.
  - `lista-clientes`: filtro "Sem gerência" mostra só quem tem `gerencia: null`.
- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/app/clientes --runInBand`.
- [ ] **Step 3: Implementar**
  - `layout.tsx` (client): `use(params)` → `<PermissaoClienteProvider clienteId={id}>`, faixa "Somente leitura" no
    topo quando `!carregando && !podeEditar`, depois `{children}`.
  - Em cada arquivo da lista: `const { podeEditar } = usePermissaoCliente()` e `{podeEditar && (…)}` em volta de
    cada elemento que dispara gravação. Nenhum `role === 'admin'` novo; os que existem para documento (`[competencia]/page.tsx:566`)
    passam a ser `podeEditar && (usuario.role === 'admin' || usuario.id === doc.uploadedById)`.
  - Ficha (`page.tsx`): `SeloCarteira` ao lado do nome.
- [ ] **Step 4: Rodar e ver passar** — `npx jest src/app/clientes --runInBand`, depois a suíte inteira
  `npx jest --runInBand --forceExit`.
- [ ] **Step 5: Conferir na tela (dev)** — `npm run dev`; como admin (token): criar "Gerência Teste", mover SMIT
  para ela, abrir SMIT (botões presentes, selo "Carteira: Gerência Teste"). Pela troca de usuário do admin, entrar
  como um `uploader` **fora** da gerência: SMIT mostra "Somente leitura" e nenhum botão de gravação; colocar esse
  usuário como `usuario` da gerência e recarregar: botões voltam. Voltar para admin.
- [ ] **Step 6: Commit** — `MSG="feat(gerencias): selo da carteira, filtro e somente leitura na ficha do cliente"`.

**Marco da Fase A**: subir para produção (migração antes do deploy, conforme `docs/superpowers/plans/2026-09-28-subida-main-producao.md` — passos de produção o usuário roda) e o admin monta as carteiras pela tela. A Fase B só começa com o "ok" do usuário de que as carteiras estão montadas.

---

# FASE B — só a gerência edita

### Task 15: Tirar a transição `clientesPermitidos`

**Files:**
- Modify: `src/lib/gerencias/permissao.ts` (+ teste), `src/lib/visibilidade.ts` (+ teste)
- Modify: `src/app/api/admin/usuarios/route.ts` (PATCH deixa de aceitar `clientesPermitidos`; GET deixa de devolver)
- Modify: `src/app/admin/usuarios/page.tsx` (sai a liberação de clientes)
- Modify: testes de rota que esperam sucesso de gravação por `clientesPermitidos`

- [ ] **Step 1: Teste falhando** — em `permissao.test.ts`, trocar o caso "na transição…" por:
  ```ts
  it('liberação antiga não dá edição', () => expect(decidirEdicao({ ehAdmin: false, membroDaGerenciaDoCliente: false })).toBe(false))
  ```
  e em `visibilidade.test.ts` o caso "liberado do jeito antigo" passa a esperar `false`. Rodar → FAIL.
- [ ] **Step 2: Implementar** — `permissao.ts`: apagar `TRANSICAO_CLIENTES_PERMITIDOS` e o campo
  `liberadoNoModeloAntigo`; `decidirEdicao({ ehAdmin, membroDaGerenciaDoCliente })` = `ehAdmin || membroDaGerenciaDoCliente`.
  `visibilidade.ts`: tirar `clientesPermitidos` do `select` de `podeEditarCliente`.
- [ ] **Step 3: Rodar a suíte** — `npx jest --runInBand --forceExit`; cada teste de rota que esperava 200/201 numa
  gravação com mock `{ clientesPermitidos: [{ id: 'c1' }] }` passa a usar `{ gerencias: [{ gerenciaId: 'g1' }] }`
  (troca de mock, não de expectativa). Teste que esperava 403 continua 403.
- [ ] **Step 4: `/admin/usuarios`** — remover o seletor de clientes e o envio de `clientesPermitidos`; a rota PATCH
  ignora o campo. Teste da página: não existe mais "Clientes liberados".
- [ ] **Step 5: Suíte inteira verde** e conferência na tela (dev) como na Task 14 Step 5, agora com um usuário que
  tinha cliente liberado e não é da gerência: só leitura.
- [ ] **Step 6: Commit** — `MSG="feat(gerencias): só a equipe da gerência edita (fim da liberação por cliente)"`.

A relação `UsuarioClientes` fica no banco; a migração que a remove é trabalho à parte, depois da Fase B validada em produção.

---

### Task 16: Documentação

**Files:**
- Modify: `CLAUDE.md` (seção nova "Gerências e carteira de clientes", depois de "Relatórios dos clientes — regra única de contrato e SEI")
- Modify: `docs/superpowers/specs/2026-10-02-gerencias-carteira-clientes-design.md` (status: implementado; marcar Fase A/B)

- [ ] **Step 1: Escrever a seção do CLAUDE.md**

```markdown
## Gerências e carteira de clientes

Todo usuário logado **vê** todos os clientes; **edita** só o admin e a equipe (manager ou usuário) da gerência
ativa dona do cliente (`CarteiraCliente`, um cliente → uma gerência). Regra pura em `src/lib/gerencias/permissao.ts`,
consulta em `podeEditarCliente` (`src/lib/visibilidade.ts`). **Todo método de gravação de cliente usa o modo
`'editar'`** (`verificarAcessoCliente`/`exigirAcessoCliente`/`carregarXComAcesso(..., 'editar')`) — a régua
`src/app/api/regua-edicao.test.ts` falha se uma rota nova esquecer. Tela decide botão por `usePermissaoCliente()`
(`src/app/clientes/[id]/permissao-cliente.tsx`), nunca por `role`. Admin: menu "Administração" (`/admin`),
`/admin/gerencias` (criar, mover cliente, nomear manager); manager põe e tira `usuario` em `/gerencias/[id]`.
Cliente criado pelo SharePoint nasce sem gerência (só admin edita até entrar numa carteira). Só tabelas novas
(`Gerencia`, `MembroGerencia`, `CarteiraCliente`, `MovimentoCarteira`). Spec
`docs/superpowers/specs/2026-10-02-gerencias-carteira-clientes-design.md`, plano
`docs/superpowers/plans/2026-10-02-gerencias-carteira-clientes.md`.
```
- [ ] **Step 2: Commit** — `ARQS="CLAUDE.md docs/superpowers/specs/2026-10-02-gerencias-carteira-clientes-design.md"`.
  `CLAUDE.md` tinha mudança sem commit de outra sessão em 02/10: se ainda tiver, use o procedimento do índice próprio
  com blob = `HEAD` + só a seção nova (`git show HEAD:CLAUDE.md`, acrescentar a seção, `hash-object -w --stdin`),
  sem levar a mudança alheia.
