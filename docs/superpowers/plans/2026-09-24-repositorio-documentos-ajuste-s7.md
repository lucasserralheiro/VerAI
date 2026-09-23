# Repositório de documentos — ajuste da §7 (contrato e competência vêm dos usos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar `contratoId`/`competenciaAno`/`competenciaMes` do `ArquivoCliente` e fazer contrato e competência aparecerem na aba Documentos derivados de onde cada arquivo é usado — spec §7.1–7.3 (itens 1–4; o item 5 já foi feito na Fase 1).

**Architecture:** Spec: `docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md` — ler §3.3, §3.4 e **§7** (a §7 manda sobre as seções anteriores). Migração remove as três colunas, o índice e a relação; servidor (`servico.ts`, esquemas e rotas) passa a tratar só **categoria**; `UsoArquivo` vira um tipo único e estruturado (com `contrato` e `competencia`) em `src/lib/arquivos/tipos.ts`; a aba deriva as colunas e os filtros de contrato/competência dos usos, e o envio/painel classificam só a categoria.

**Tech Stack:** Next.js 15 (App Router), React 19, Prisma 6/Postgres, zod 4, Jest + Testing Library.

## Global Constraints

- `ArquivoCliente` **não guarda** `contratoId` nem `competenciaAno/Mes` (spec §7.1). Quem diz "este arquivo é do contrato X, competência Y" é o consumidor (§3.3).
- "Contrato" e "competência" na lista, nos filtros e no painel da aba Documentos são **derivados dos usos** (`usosDosArquivos`); um arquivo pode aparecer em vários contratos/competências; arquivo sem uso aparece como **"não usado"** (§7.1).
- O envio pela aba classifica só a **categoria**. Reclassificação (`PATCH /api/arquivos/[id]`) muda só a categoria (§7.1).
- Continuam valendo da Fase 1: `urlBlob` nunca sai em JSON; entrega só por `GET /api/arquivos/[id]`; sem duplicado por `(clienteId, sha256)` entre não removidos; remoção lógica só sem uso; permissão = `podeVerCliente`.
- **Índice único parcial `ArquivoCliente_clienteId_sha256_ativo_key`**: toda migração gerada deve ser conferida — se aparecer `DROP INDEX "ArquivoCliente_clienteId_sha256_ativo_key"`, remova a linha (CLAUDE.md, seção "Repositório de documentos do cliente").
- Outra sessão trabalha na mesma árvore e commita na `main`: **nunca** `git add -A`/`git add .`/`git stash`/`git checkout --`/`git reset --hard`; adicionar só os arquivos da task. Se um arquivo da task tiver hunks alheios não commitados (`git diff <arquivo>` mostra algo que não é seu), monte a versão do índice a partir de `git show HEAD:<arquivo>` + só as suas mudanças e use `git update-index --cacheinfo 100644,$(git hash-object -w <copia>),<arquivo>`.
- A suíte completa (`npx jest`) tem falhas pré-existentes do trabalho da outra sessão. Cada task roda os testes focados listados nela (têm que passar) + `npx tsc --noEmit` (erros fora dos arquivos da task são da outra sessão: reportar, não consertar).
- Mensagens de commit em português terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Migração + servidor só com categoria

**Files:**
- Modify: `prisma/schema.prisma` (model `ArquivoCliente`, model `Contrato`)
- Create: `prisma/migrations/20260924140000_arquivo_cliente_sem_contrato_competencia/migration.sql`
- Modify: `src/lib/arquivos/servico.ts` (+ `servico.test.ts`)
- Modify (reescrever): `src/app/api/clientes/[clienteId]/arquivos/esquema.ts`
- Modify: `src/app/api/clientes/[clienteId]/arquivos/route.ts` (+ `route.test.ts`)
- Modify: `src/app/api/arquivos/[id]/route.ts` (+ `route.test.ts`)

**Interfaces:**
- Produces: `SELECT_ARQUIVO` sem `contratoId`, `competenciaAno`, `competenciaMes`, `contrato`; `DadosRegistro = { clienteId, urlTemporaria, nome, categoria, enviadoPorId }`; `esquemaRegistro = { urlTemporaria, nome, categoria }`; `esquemaEdicao = { categoria }` (obrigatória); `ROTULOS_ARQUIVO = { urlTemporaria: 'Arquivo', nome: 'Nome', categoria: 'Categoria' }`.

- [ ] **Step 1: Contar o que vai ser descartado (registro)**

Docker de pé (`docker start verai-postgres`). Run:
```bash
docker exec verai-postgres psql -U verai_user -d verai -At -c 'select count(*) filter (where "contratoId" is not null), count(*) filter (where "competenciaAno" is not null), count(*) from "ArquivoCliente"'
```
Anote os três números no relatório (classificação que a migração descarta; é esperado sair `0|0|n` no banco local).

- [ ] **Step 2: Testes falhando (servidor)**

Em `src/lib/arquivos/servico.test.ts`:
- no objeto `dados`, **remover** as linhas `contratoId: 'k1',`, `competenciaAno: null,`, `competenciaMes: null,`;
- no teste "arquivo novo: copia pro caminho final…", **remover** `contratoId: 'k1',` do `toMatchObject` e acrescentar logo depois dele:
```ts
    expect(data).not.toHaveProperty('contratoId')
    expect(data).not.toHaveProperty('competenciaAno')
    expect(data).not.toHaveProperty('competenciaMes')
```

Em `src/app/api/clientes/[clienteId]/arquivos/route.test.ts`:
- remover `contrato: { findUnique: jest.fn() },` do mock do prisma e a linha `;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c1' })` do `beforeEach`;
- trocar `const valido = { urlTemporaria: tmp, nome: 'PC 01.pdf', categoria: 'PROPOSTA_COMERCIAL', contratoId: 'k1' }` por `const valido = { urlTemporaria: tmp, nome: 'PC 01.pdf', categoria: 'PROPOSTA_COMERCIAL' }`;
- no `it.each` de 400, **remover** as duas linhas de competência (`'Competência: informe mês e ano juntos'` e `'Mês: deve ser um número inteiro entre 1 e 12'`);
- **remover** o teste `'400 quando o contrato é de outro cliente'`;
- substituir o teste `'201 registra com o usuário como autor'` por:
```ts
  it('201 registra com o usuário como autor — contrato/competência enviados são ignorados', async () => {
    const resposta = await POST(post({ ...valido, contratoId: 'k1', competenciaAno: 2026, competenciaMes: 8 }), contexto())

    expect(resposta.status).toBe(201)
    expect(registrarArquivo).toHaveBeenCalledWith({
      clienteId: 'c1',
      urlTemporaria: tmp,
      nome: 'PC 01.pdf',
      categoria: 'PROPOSTA_COMERCIAL',
      enviadoPorId: 'u1',
    })
    await expect(resposta.json()).resolves.toEqual({ arquivo: { id: 'a1', usos: [] }, duplicado: false })
  })
```
- no teste `'200 quando o conteúdo já estava no cliente'`, trocar `post({ ...valido, contratoId: '' })` por `post(valido)` e **remover** a linha `expect((registrarArquivo as jest.Mock).mock.calls[0][0].contratoId).toBeNull()`.

Em `src/app/api/arquivos/[id]/route.test.ts`:
- remover `contrato: { findUnique: jest.fn() },` do mock e `;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c1' })` do `beforeEach`;
- **remover** os testes `'400 contrato de outro cliente'` e `'contratoId "" desvincula'`;
- substituir `'atualiza só o que veio e devolve com usos'` por:
```ts
  it('atualiza só a categoria — contrato/competência enviados são ignorados — e devolve com usos', async () => {
    const resposta = await PATCH(patch({ categoria: 'MEDICAO', contratoId: 'k1', competenciaAno: 2026, competenciaMes: 8 }), contexto)

    expect(resposta.status).toBe(200)
    expect(prisma.arquivoCliente.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a1' }, data: { categoria: 'MEDICAO' } })
    )
    await expect(resposta.json()).resolves.toEqual({ id: 'a1', categoria: 'MEDICAO', usos: [] })
  })

  it('400 sem categoria', async () => {
    const resposta = await PATCH(patch({}), contexto)
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Categoria: categoria inválida' })
  })
```
> Se a mensagem real do zod para campo ausente no `z.enum(..., { error: 'categoria inválida' })` for outra, ajuste **só a asserção** para a mensagem real (o `error` customizado costuma valer também para ausente).

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx jest src/lib/arquivos/servico "src/app/api/arquivos" "src/app/api/clientes/\[clienteId\]/arquivos"`
Expected: FAIL (o código ainda grava/valida contrato e competência).

- [ ] **Step 4: Schema**

Em `prisma/schema.prisma`, no `model ArquivoCliente`, **remover** as linhas:
```prisma
  contratoId     String?
  contrato       Contrato?        @relation(fields: [contratoId], references: [id])
  competenciaAno Int?
  competenciaMes Int?
```
e o índice `@@index([contratoId])`. Acrescentar, no comentário de cabeçalho da seção do repositório (acima de `enum CategoriaArquivo`), a linha:
```prisma
// Contrato e competência NÃO ficam no arquivo (spec §7.1): vêm de quem usa (histórico, faturamento,
// ConfereAI, Documento) — ver usosDosArquivos em src/lib/arquivos/servico.ts.
```
No `model Contrato`, **remover** a linha `arquivos          ArquivoCliente[]`.

Run: `npx prisma validate` → válido.

- [ ] **Step 5: Gerar a migração e conferir**

Run:
```bash
mkdir -p prisma/migrations/20260924140000_arquivo_cliente_sem_contrato_competencia
npx dotenv -e .env.development -- bash -c 'npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script' > prisma/migrations/20260924140000_arquivo_cliente_sem_contrato_competencia/migration.sql
cat prisma/migrations/20260924140000_arquivo_cliente_sem_contrato_competencia/migration.sql
```
Expected: `DROP CONSTRAINT "ArquivoCliente_contratoId_fkey"`, `DROP INDEX "ArquivoCliente_contratoId_idx"`, `ALTER TABLE "ArquivoCliente" DROP COLUMN "competenciaAno", DROP COLUMN "competenciaMes", DROP COLUMN "contratoId"` — **e nada mais**, exceto possivelmente `DROP INDEX "ArquivoCliente_clienteId_sha256_ativo_key"`: **remova essa linha** (índice parcial feito à mão). Se aparecer qualquer coisa de outra tabela, o banco local está atrasado em migrações de outra sessão: **PARE e reporte BLOCKED** com o conteúdo do arquivo (não rode `migrate deploy` para "alcançar").

- [ ] **Step 6: Aplicar no banco local e regerar o client**

Run: `npx dotenv -e .env.development -- npx prisma migrate deploy && npx prisma generate`
Expected: aplica `20260924140000_arquivo_cliente_sem_contrato_competencia`. (Se `prisma generate` falhar com EPERM no Windows, há um `next dev` segurando a DLL: reporte em vez de matar processos.)

Conferir que o índice parcial continua lá:
```bash
docker exec verai-postgres psql -U verai_user -d verai -At -c "select indexname from pg_indexes where tablename='ArquivoCliente'"
```
Expected: inclui `ArquivoCliente_clienteId_sha256_ativo_key`.

- [ ] **Step 7: Servidor**

`src/app/api/clientes/[clienteId]/arquivos/esquema.ts` (substitui o arquivo inteiro):
```ts
import { CategoriaArquivo } from '@prisma/client'
import { z } from 'zod'
import { textoObrigatorio } from '@/lib/relatorios-clientes/validacao'
import { urlTemporariaValida } from '@/lib/arquivos/caminhos'

// Contrato e competência não são do arquivo (spec §7.1): o envio e a reclassificação tratam só a
// categoria. Campos a mais no corpo são ignorados (o zod descarta chave desconhecida).

const categoria = z.enum(CategoriaArquivo, { error: 'categoria inválida' })

/** POST: registro de um arquivo que o navegador acabou de subir pro caminho temporário. */
export const esquemaRegistro = z.object({
  urlTemporaria: z.string().refine(urlTemporariaValida, 'upload inválido'),
  nome: textoObrigatorio,
  categoria,
})

/** PATCH /api/arquivos/[id]: reclassificação — só a categoria. */
export const esquemaEdicao = z.object({ categoria })

export const ROTULOS_ARQUIVO = {
  urlTemporaria: 'Arquivo',
  nome: 'Nome',
  categoria: 'Categoria',
}
```

`src/lib/arquivos/servico.ts`:
- em `SELECT_ARQUIVO`, remover `contratoId: true,`, `competenciaAno: true,`, `competenciaMes: true,` e `contrato: { select: { id: true, numeroTermo: true } },`;
- em `DadosRegistro`, remover `contratoId`, `competenciaAno`, `competenciaMes`;
- no `prisma.arquivoCliente.create` de `registrarArquivo`, remover `contratoId: dados.contratoId,`, `competenciaAno: dados.competenciaAno,`, `competenciaMes: dados.competenciaMes,`.

`src/app/api/clientes/[clienteId]/arquivos/route.ts` (POST):
- remover o import de `contratoForaDoCliente` e o bloco `if (dados.contratoId) { … }`;
- a chamada vira:
```ts
    ;({ arquivo, duplicado } = await registrarArquivo({
      clienteId,
      urlTemporaria: dados.urlTemporaria,
      nome: dados.nome,
      categoria: dados.categoria,
      enviadoPorId: acesso.usuario.id,
    }))
```

`src/app/api/arquivos/[id]/route.ts` (PATCH):
- remover o import de `contratoForaDoCliente`, o bloco `if (corpo.dados.contratoId) { … }` e a linha do `Object.fromEntries(...)`;
- o update vira:
```ts
  const arquivo = await prisma.arquivoCliente.update({
    where: { id },
    data: { categoria: corpo.dados.categoria },
    select: SELECT_ARQUIVO,
  })
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx jest src/lib/arquivos "src/app/api/arquivos" "src/app/api/clientes/\[clienteId\]/arquivos" && npx tsc --noEmit`
Expected: testes PASS. O `tsc` **vai acusar** os componentes da aba (`src/app/clientes/[id]/abas/documentos/*`, `aba-documentos.tsx`) só se eles dependerem de tipos do servidor — eles usam a interface local `ArquivoRepositorio`, então não devem quebrar; se quebrarem, reporte (a Task 3 reescreve essa parte). Erros em arquivos de outras áreas são da outra sessão.

- [ ] **Step 9: Commit**

`prisma/schema.prisma` pode ter hunks da outra sessão: rode `git diff prisma/schema.prisma`. Se houver algo além das suas remoções/comentário, monte a versão do índice (ver Global Constraints). Depois:
```bash
git add prisma/migrations/20260924140000_arquivo_cliente_sem_contrato_competencia/migration.sql src/lib/arquivos/servico.ts src/lib/arquivos/servico.test.ts "src/app/api/clientes/[clienteId]/arquivos/esquema.ts" "src/app/api/clientes/[clienteId]/arquivos/route.ts" "src/app/api/clientes/[clienteId]/arquivos/route.test.ts" "src/app/api/arquivos/[id]/route.ts" "src/app/api/arquivos/[id]/route.test.ts"
# + prisma/schema.prisma (git add, ou update-index se tiver hunk alheio)
git diff --cached --stat
git commit -m "refactor(arquivos): contrato e competência saem do ArquivoCliente — só categoria (ajuste §7, Task 1)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `UsoArquivo` estruturado e único

**Files:**
- Modify: `src/lib/arquivos/tipos.ts` (+ `tipos.test.ts` se precisar)
- Modify: `src/lib/arquivos/servico.ts` (+ `servico.test.ts`)
- Modify: `src/app/clientes/[id]/abas/documentos/tipos.ts`

**Interfaces:**
- Produces (em `src/lib/arquivos/tipos.ts`, seguro para o navegador):
```ts
export interface UsoArquivo {
  tipo: 'analise-documento'
  rotulo: string
  href: string
  /** Contrato a que este uso liga o arquivo; `null` quando o uso não é de contrato. */
  contrato: { id: string; numeroTermo: string | null } | null
  /** Competência deste uso; `null` quando não se aplica. */
  competencia: { ano: number; mes: number } | null
}
```
`servico.ts` passa a `import type { UsoArquivo } from './tipos'` e re-exporta (`export type { UsoArquivo } from './tipos'`) para não quebrar quem importa de lá. `documentos/tipos.ts` deixa de declarar `UsoArquivo` e faz `export type { UsoArquivo } from '@/lib/arquivos/tipos'`.

- [ ] **Step 1: Teste falhando**

Em `src/lib/arquivos/servico.test.ts`, no teste `'Documento antigo vira "Análise por IA" com link pra competência'`, trocar o `toEqual` por:
```ts
    expect(usos.get('a1')).toEqual([
      {
        tipo: 'analise-documento',
        rotulo: 'Análise por IA · Junho/2026',
        href: '/clientes/c1/2026-06',
        contrato: null,
        competencia: { ano: 2026, mes: 6 },
      },
    ])
```

Run: `npx jest src/lib/arquivos/servico.test.ts` → FAIL (faltam `contrato`/`competencia`).

- [ ] **Step 2: Implementar**

Em `src/lib/arquivos/tipos.ts`, acrescentar a interface `UsoArquivo` do bloco **Interfaces** acima (depois de `formatarTamanho`), com o comentário:
```ts
/** Um lugar onde o arquivo é usado. Contrato e competência do arquivo são SEMPRE derivados daqui
 *  (spec §7.1) — o `ArquivoCliente` não guarda nenhum dos dois. Fases 2–4 acrescentam tipos. */
```

Em `src/lib/arquivos/servico.ts`: apagar a `interface UsoArquivo` local; acrescentar `import type { UsoArquivo } from './tipos'` e `export type { UsoArquivo } from './tipos'`; no `push` de `usosDosArquivos`, acrescentar:
```ts
      contrato: null,
      competencia: { ano: doc.competenciaAno, mes: doc.competenciaMes },
```

Em `src/app/clientes/[id]/abas/documentos/tipos.ts`: apagar a `interface UsoArquivo` local e acrescentar no topo `export type { UsoArquivo } from '@/lib/arquivos/tipos'` + `import type { UsoArquivo } from '@/lib/arquivos/tipos'` (o `ArquivoRepositorio` usa o tipo).

- [ ] **Step 3: Rodar e ver passar**

Run: `npx jest src/lib/arquivos "src/app/api/arquivos" "src/app/api/clientes/\[clienteId\]/arquivos" && npx tsc --noEmit`
Expected: PASS. Testes de rota que comparam `usos` exatos (ex.: o 409 do DELETE em `src/app/api/arquivos/[id]/route.test.ts`) passam a esperar também `contrato: null, competencia: { ano: 2026, mes: 6 }` — **ajuste essas asserções** para a forma nova (é consequência direta da interface, não mudança de comportamento).

- [ ] **Step 4: Commit**

```bash
git add src/lib/arquivos/tipos.ts src/lib/arquivos/servico.ts src/lib/arquivos/servico.test.ts "src/app/clientes/[id]/abas/documentos/tipos.ts" "src/app/api/arquivos/[id]/route.test.ts"
git commit -m "refactor(arquivos): UsoArquivo único e estruturado, com contrato e competência (ajuste §7, Task 2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
(Inclua no `git add` só os arquivos de teste que você de fato alterou.)

---

### Task 3: Aba Documentos — contrato/competência derivados dos usos; envio e painel só com categoria

**Files:**
- Create: `src/app/clientes/[id]/abas/documentos/derivados.ts` (+ `derivados.test.ts`)
- Modify: `src/app/clientes/[id]/abas/documentos/tipos.ts` (tirar campos do `ArquivoRepositorio`, tirar `OpcaoContrato`)
- Modify: `src/app/clientes/[id]/abas/documentos/lista-arquivos.tsx`
- Modify: `src/app/clientes/[id]/abas/documentos/painel-arquivo.tsx`
- Modify: `src/app/clientes/[id]/abas/documentos/envio-arquivos.tsx` (+ `envio-arquivos.test.tsx`)
- Modify: `src/app/clientes/[id]/abas/aba-documentos.tsx` (+ `aba-documentos.test.tsx`)

**Interfaces:**
- Consumes: `UsoArquivo` (Task 2); API sem contrato/competência no arquivo (Task 1).
- Produces (`derivados.ts`):
  - `interface ContratoDoUso { id: string; numeroTermo: string | null }`
  - `contratosDoArquivo(a: Pick<ArquivoRepositorio, 'usos'>): ContratoDoUso[]` — distintos por `id`, na ordem em que aparecem
  - `competenciasDoArquivo(a: Pick<ArquivoRepositorio, 'usos'>): Array<{ ano: number; mes: number }>` — distintas, mais recente primeiro
  - `rotuloContratos(a): string` — `numeroTermo ?? '(sem número)'` unidos por `', '`; `'—'` quando nenhum
  - `rotuloCompetencias(a): string` — `nomeCompetencia(ano, mes)` unidos por `', '`; `'—'` quando nenhuma
  - `opcoesDeContrato(arquivos: Array<Pick<ArquivoRepositorio, 'usos'>>): ContratoDoUso[]` — distintos entre todos os arquivos, ordenados por `numeroTermo` (`localeCompare` pt-BR, sem número por último)
- `ArquivoRepositorio` perde `contratoId`, `competenciaAno`, `competenciaMes`, `contrato`. `EnvioArquivos` e `PainelArquivo` e `ListaArquivos` perdem a prop `contratos`.

- [ ] **Step 1: Teste falhando dos derivados**

`src/app/clientes/[id]/abas/documentos/derivados.test.ts`:
```ts
import {
  competenciasDoArquivo,
  contratosDoArquivo,
  opcoesDeContrato,
  rotuloCompetencias,
  rotuloContratos,
} from './derivados'
import type { UsoArquivo } from './tipos'

const uso = (contrato: UsoArquivo['contrato'], competencia: UsoArquivo['competencia']): UsoArquivo => ({
  tipo: 'analise-documento',
  rotulo: 'r',
  href: 'h',
  contrato,
  competencia,
})
const k1 = { id: 'k1', numeroTermo: 'TC 012/2020' }
const k2 = { id: 'k2', numeroTermo: 'TC 003/2024' }
const k3 = { id: 'k3', numeroTermo: null }

describe('derivados dos usos', () => {
  it('contratos distintos, na ordem dos usos', () => {
    const a = { usos: [uso(k1, null), uso(k2, null), uso(k1, { ano: 2026, mes: 6 })] }
    expect(contratosDoArquivo(a)).toEqual([k1, k2])
    expect(rotuloContratos(a)).toBe('TC 012/2020, TC 003/2024')
  })

  it('competências distintas, mais recente primeiro', () => {
    const a = { usos: [uso(null, { ano: 2026, mes: 6 }), uso(k1, { ano: 2026, mes: 8 }), uso(null, { ano: 2026, mes: 6 })] }
    expect(competenciasDoArquivo(a)).toEqual([
      { ano: 2026, mes: 8 },
      { ano: 2026, mes: 6 },
    ])
    expect(rotuloCompetencias(a)).toBe('Agosto/2026, Junho/2026')
  })

  it('sem usos: traço', () => {
    expect(rotuloContratos({ usos: [] })).toBe('—')
    expect(rotuloCompetencias({ usos: [] })).toBe('—')
  })

  it('opções de contrato de todos os arquivos, por número, sem número por último', () => {
    const arquivos = [{ usos: [uso(k1, null), uso(k3, null)] }, { usos: [uso(k2, null), uso(k1, null)] }]
    expect(opcoesDeContrato(arquivos)).toEqual([k2, k1, k3])
    expect(rotuloContratos({ usos: [uso(k3, null)] })).toBe('(sem número)')
  })
})
```

Run: `npx jest "src/app/clientes/\[id\]/abas/documentos/derivados"` → FAIL (módulo não existe).

- [ ] **Step 2: Implementar os derivados**

`src/app/clientes/[id]/abas/documentos/derivados.ts`:
```ts
import { nomeCompetencia } from '@/lib/competencia'
import type { ArquivoRepositorio } from './tipos'

// Contrato e competência de um arquivo são derivados de onde ele é usado (spec §7.1) — o arquivo
// em si não guarda nenhum dos dois, e pode estar em vários contratos/competências.

export interface ContratoDoUso {
  id: string
  numeroTermo: string | null
}

type ComUsos = Pick<ArquivoRepositorio, 'usos'>

export function contratosDoArquivo(arquivo: ComUsos): ContratoDoUso[] {
  const vistos = new Map<string, ContratoDoUso>()
  for (const uso of arquivo.usos) if (uso.contrato && !vistos.has(uso.contrato.id)) vistos.set(uso.contrato.id, uso.contrato)
  return [...vistos.values()]
}

export function competenciasDoArquivo(arquivo: ComUsos): Array<{ ano: number; mes: number }> {
  const vistas = new Map<number, { ano: number; mes: number }>()
  for (const uso of arquivo.usos) if (uso.competencia) vistas.set(uso.competencia.ano * 100 + uso.competencia.mes, uso.competencia)
  return [...vistas.entries()].sort(([a], [b]) => b - a).map(([, c]) => c)
}

export function rotuloContratos(arquivo: ComUsos): string {
  const contratos = contratosDoArquivo(arquivo)
  return contratos.length ? contratos.map((c) => c.numeroTermo ?? '(sem número)').join(', ') : '—'
}

export function rotuloCompetencias(arquivo: ComUsos): string {
  const competencias = competenciasDoArquivo(arquivo)
  return competencias.length ? competencias.map((c) => nomeCompetencia(c.ano, c.mes)).join(', ') : '—'
}

export function opcoesDeContrato(arquivos: ComUsos[]): ContratoDoUso[] {
  const todos = new Map<string, ContratoDoUso>()
  for (const arquivo of arquivos) for (const c of contratosDoArquivo(arquivo)) todos.set(c.id, c)
  return [...todos.values()].sort((a, b) => {
    if (a.numeroTermo === null) return b.numeroTermo === null ? 0 : 1
    if (b.numeroTermo === null) return -1
    return a.numeroTermo.localeCompare(b.numeroTermo, 'pt-BR')
  })
}
```

Em `documentos/tipos.ts`: remover do `ArquivoRepositorio` as linhas `contratoId`, `competenciaAno`, `competenciaMes`, `contrato`; remover a interface `OpcaoContrato`.

Run: `npx jest "src/app/clientes/\[id\]/abas/documentos/derivados"` → PASS.

- [ ] **Step 3: Testes da aba e do envio falhando**

Em `src/app/clientes/[id]/abas/aba-documentos.test.tsx`:
- no objeto `PROPOSTA`, **remover** `contratoId: 'k1',`, `competenciaAno: null,`, `competenciaMes: null,`, `contrato: { id: 'k1', numeroTermo: 'TC 012/2020' },` e trocar `usos: [],` por:
```ts
  usos: [
    { tipo: 'analise-documento', rotulo: 'Histórico do TC 012/2020', href: '/clientes/c1/contratos/k1', contrato: { id: 'k1', numeroTermo: 'TC 012/2020' }, competencia: null },
  ],
```
- no objeto `MEDICAO`, **remover** `contratoId: null,`, `contrato: null,`, `competenciaAno: 2026,`, `competenciaMes: 6,` e trocar os `usos` por:
```ts
  usos: [{ tipo: 'analise-documento', rotulo: 'Análise por IA · Junho/2026', href: '/clientes/c1/2026-06', contrato: null, competencia: { ano: 2026, mes: 6 } }],
```
- acrescentar um terceiro arquivo sem uso e incluí-lo na lista mutável do `mockApi` (`let lista = [PROPOSTA, MEDICAO, SOLTO]`):
```ts
const SOLTO = { ...MEDICAO, id: 'a3', nome: 'oficio.pdf', extensao: 'pdf', categoria: 'OFICIO_SEI', usos: [] }
```
- remover do `mockApi` a resposta de `/api/clientes/c1/contratos` (a aba não busca mais contratos) e acrescentar no primeiro teste `expect(global.fetch).not.toHaveBeenCalledWith('/api/clientes/c1/contratos')`;
- no primeiro teste, o resumo vira `'3 arquivos · 6 KB'`, e acrescentar:
```ts
    expect(within(screen.getByText('oficio.pdf').closest('tr')!).getByText('não usado')).toBeInTheDocument()
```
- no teste de filtros, depois do filtro de competência, acrescentar o de contrato:
```ts
    fireEvent.change(screen.getByLabelText('Filtrar por competência'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Filtrar por contrato'), { target: { value: 'k1' } })
    expect(screen.getByText('PC_SMS_012.pdf')).toBeInTheDocument()
    expect(screen.queryByText('medicao-junho.xlsx')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Filtrar por contrato'), { target: { value: '' } })
```
(ajuste a sequência para que o filtro por nome que já existe continue funcionando depois);
- no teste do painel da PROPOSTA (e em qualquer outro que clique nela), o arquivo agora **tem uso**, então "Remover" fica desabilitado: troque o teste `'remove arquivo sem uso após confirmação inline'` para usar `SOLTO` (`oficio.pdf`, id `a3`): clicar em `oficio.pdf`, painel `complementary` com nome `oficio.pdf`, esperar que `oficio.pdf` suma e `expect(global.fetch).toHaveBeenCalledWith('/api/arquivos/a3', { method: 'DELETE' })` — e no `mockApi` o `DELETE` passa a ser de `/api/arquivos/a3` (filtrando `a3` da lista);
- no teste `'reclassifica pelo painel'`, o corpo esperado do PATCH vira `{ categoria: 'TERMO_CONTRATO' }` e o painel não tem mais os campos Contrato/Competência: acrescentar `expect(within(painel).queryByLabelText('Contrato')).not.toBeInTheDocument()`; o botão passa a se chamar **"Salvar categoria"**.

Em `src/app/clientes/[id]/abas/documentos/envio-arquivos.test.tsx`:
- em todo `render(<EnvioArquivos ... />)`, remover a prop `contratos={...}`;
- no teste `'arquivo novo: upload direto…'`, remover as duas linhas que mudam `Contrato` e `Competência`, e o corpo esperado do POST vira:
```ts
    expect(JSON.parse(post[1].body)).toEqual({ urlTemporaria: TMP, nome: 'PC_SMS_012.pdf', categoria: 'PROPOSTA_COMERCIAL' })
```
- no teste `'sugere a categoria pelo nome e deixa trocar'`, acrescentar a troca de fato:
```ts
    fireEvent.change(within(linha).getByLabelText('Categoria'), { target: { value: 'TERMO_CONTRATO' } })
    expect(within(linha).getByLabelText('Categoria')).toHaveValue('TERMO_CONTRATO')
    expect(within(linha).queryByLabelText('Contrato')).not.toBeInTheDocument()
    expect(within(linha).queryByLabelText('Competência')).not.toBeInTheDocument()
```

Run: `npx jest "src/app/clientes/\[id\]/abas/aba-documentos" "src/app/clientes/\[id\]/abas/documentos"` → FAIL.

- [ ] **Step 4: Implementar a aba**

`lista-arquivos.tsx`:
- imports: trocar `import type { ArquivoRepositorio, OpcaoContrato } from './tipos'` por `import type { ArquivoRepositorio } from './tipos'` e acrescentar `import { competenciasDoArquivo, contratosDoArquivo, opcoesDeContrato, rotuloCompetencias, rotuloContratos } from './derivados'`; remover o import de `nomeCompetencia` e a função `competenciaDoArquivo`;
- props: remover `contratos`; dentro do componente, `const contratos = opcoesDeContrato(arquivos)`;
- o `filter` de `visiveis` vira:
```ts
  const visiveis = arquivos.filter(
    (a) =>
      (!categoria || a.categoria === categoria) &&
      (!contratoId || contratosDoArquivo(a).some((c) => c.id === contratoId)) &&
      (!tipo || a.extensao === tipo) &&
      (!competencia || competenciasDoArquivo(a).some((c) => c.ano === anoFiltro && c.mes === mesFiltro)) &&
      (!termo || a.nome.toLowerCase().includes(termo))
  )
```
- células: Contrato → `<td className="font-mono text-xs">{rotuloContratos(a)}</td>`; Competência → `<td>{rotuloCompetencias(a)}</td>`; Usado em → `<td className="font-mono text-xs">{a.usos.length || <span className="font-sans text-mid-grey">não usado</span>}</td>`.

`painel-arquivo.tsx`:
- import de tipos: só `ArquivoRepositorio`; remover `mesAno`, os estados `contratoId`/`competencia`, a prop `contratos` e os dois `<label>` de Contrato e Competência;
- o PATCH manda `JSON.stringify({ categoria })`; o botão vira `Salvar categoria`;
- acima de "Onde é usado", nada muda — os usos já levam o link.

`envio-arquivos.tsx`:
- `Classificacao` vira `{ categoria: CategoriaArquivo }`; `aoMudarArquivos` cria `{ categoria: sugerirCategoria(file.name) }`; `classificar(id, valor: CategoriaArquivo)` atualiza só a categoria;
- remover a prop `contratos`, o import de `OpcaoContrato`, e os dois `<label>` de Contrato e Competência; o `fieldset` passa a `sm:grid-cols-2`;
- o POST manda `JSON.stringify({ urlTemporaria: blob.url, nome: file.name, categoria: c.categoria })`.

`aba-documentos.tsx`:
- remover o estado `contratos`, o `fetch` de `/api/clientes/${clienteId}/contratos` (o `useEffect` fica só com `carregar()`), o import de `OpcaoContrato` e a prop `contratos` passada a `EnvioArquivos`, `ListaArquivos` e `PainelArquivo`.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx jest "src/app/clientes/\[id\]/abas/aba-documentos" "src/app/clientes/\[id\]/abas/documentos" src/lib/arquivos && npx tsc --noEmit`
Expected: PASS; nenhum erro de tipo em `src/app/clientes/[id]/abas/**` nem em `src/lib/arquivos/**`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/clientes/[id]/abas/documentos/derivados.ts" "src/app/clientes/[id]/abas/documentos/derivados.test.ts" "src/app/clientes/[id]/abas/documentos/tipos.ts" "src/app/clientes/[id]/abas/documentos/lista-arquivos.tsx" "src/app/clientes/[id]/abas/documentos/painel-arquivo.tsx" "src/app/clientes/[id]/abas/documentos/envio-arquivos.tsx" "src/app/clientes/[id]/abas/documentos/envio-arquivos.test.tsx" "src/app/clientes/[id]/abas/aba-documentos.tsx" "src/app/clientes/[id]/abas/aba-documentos.test.tsx"
git commit -m "feat(clientes): aba Documentos deriva contrato e competência dos usos; envio e painel só com categoria (ajuste §7, Task 3)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Documentação

**Files:**
- Modify: `docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md`
- Modify: `CLAUDE.md` (seção "Repositório de documentos do cliente")

- [ ] **Step 1: Spec**

Rode `git diff docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md`. Se o diff for **só** a seção `## 7.` inteira (acrescentada pela outra sessão com decisões do usuário) — ou se ela já estiver commitada —, faça:
- trocar a linha de **Status** por:
```markdown
**Status**: Desenho aprovado com o usuário em 23/09/2026. **Fase 1 concluída** (plano
`docs/superpowers/plans/2026-09-24-repositorio-documentos-fase-1.md`) e **ajuste da §7 concluído**
(plano `docs/superpowers/plans/2026-09-24-repositorio-documentos-ajuste-s7.md`) — contrato e
competência vêm dos usos. Fases 2–4 não iniciadas. **A §7 manda sobre §3.2, §3.3, §3.5 e §3.6.**
```
- no fim de `### 7.3`, acrescentar: `Concluído em 24/09/2026 (migração 20260924140000_arquivo_cliente_sem_contrato_competencia).`
- trocar, na tabela de §3.2, a linha `| \`id\` | cuid |` por `| \`id\` | UUID gerado pelo serviço (\`randomUUID\`) |`.

Se o diff tiver **outra coisa** além da §7 (edição em andamento da outra sessão fora dela), **não commite o spec** — reporte como concern e siga.

- [ ] **Step 2: CLAUDE.md**

Na seção "Repositório de documentos do cliente", depois da frase que termina em "acrescenta sua fonte em `usosDosArquivos`**.", acrescentar:
```markdown
Contrato e competência **não** são do arquivo: cada uso (`UsoArquivo`, em `src/lib/arquivos/tipos.ts`)
traz o seu `contrato`/`competencia`, e a aba deriva as colunas e os filtros daí — fonte nova de uso
precisa preencher os dois.
```
`CLAUDE.md` costuma ter hunks de outra sessão: use o procedimento de índice das Global Constraints.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md   # só se o Step 1 permitiu
# CLAUDE.md via update-index se tiver hunk alheio; senão git add CLAUDE.md
git diff --cached --stat
git commit -m "docs(arquivos): spec e CLAUDE.md com contrato/competência derivados dos usos (ajuste §7, Task 4)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
