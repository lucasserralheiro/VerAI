# Controles de Contratos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Os PDFs mensais de "Controles de Contratos" (FATURAMENTO SERVIÇOS PRODAM) viram dados do VerAI — previsto, faturado e saldo do período de cada contrato — no detalhe do contrato e numa tela "Controle de faturamento", só com o que passou na prova "soma dos meses = TOTAL".

**Architecture:** Nova área `CONTROLES_CONTRATOS` na biblioteca Documentos (já sincronizada pelo agendador). O leitor da área lê cada PDF por posição (linhas por `y`), monta as tabelas previsto/faturado/saldo, prova cada uma pela soma e grava `ControleContrato` + `ControleContratoLinha`, casando o contrato pela chave `SIGLA|nº ano`. Rotas e telas só consultam.

**Tech Stack:** Prisma 6/Postgres, Next.js 15, React 19, Jest + Testing Library, `unpdf`.

## Andamento (29/09/2026)

- ✅ Tasks 1–7 no dev, direto na `main`. Commits: 1 `340f2d2` · 2 `4ffb519` · 3 `496bf5c` (com a régua) ·
  4 `cc905da` · 5 `7bd1bf8` · 6 `c420ef5` · 7 e 8 em seguida. A partir da Task 5 os commits saem **sem**
  `Co-Authored-By` (regra do usuário na memória, 29/09) — os anteriores ainda têm; a limpeza antes do push é
  decisão do usuário (201 dos 202 commits locais têm a linha).
- **Régua nos 269 PDFs reais**: vigência 259 · previsto fecha 244 · faturado fecha 237 · **as duas 219 (81%)** —
  acima do protótipo (212). Ganho da Task 3: mês digitado errado no rótulo ("MAR/6", "FEV/265") e o intervalo
  depois do mês ("NOV/25 - 01/11/2025 a 20/11/2025").
- **Carga no dev** (script do agendador, `--aplicar`, 23 s): `controles de contratos: 269 lidos · previsto
  conferido 244 · faturado conferido 237 · sem contrato no VerAI 12`; a correção de área (os 269 estavam como
  LINKS_MPLS) chamou o leitor sozinha; a rodada seguinte não releu nada. Código 0.
- Conferido à mão contra o PDF: CGM CO 16/2024 (T.A. 02, 15/10/2025 a 14/10/2026) — previsto 6.110.655,80,
  faturado 5.049.644,59 (82,6%), saldo 1.061.011,21, último AGO/2026 — igual ao documento. ago/2026: 93
  controles, 75 conferidos, 88 com contrato.
- Sem contrato no VerAI (só admin vê): ICI ("C.O. S.N", sem número), SPURB × SPURBANISMO, SUB-GUAINAZES ×
  SUB-GUAIANASES, SUB-ITAIM, SEGES 24/2025 (junho) — diferença de sigla/digitação; um mapa de siglas resolveria
  (fica para depois).
- Desvio: `nomeDoMes` foi para `src/lib/controles-contratos/tipos.ts` (a tela não importa de outra rota).
- Falta: ver as telas logado; produção só com o ok do usuário (migrações `20260929100000` e `20260929140000`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-29-controles-de-contratos-design.md`. Base: plano `2026-09-29-biblioteca-documentos-e-tabela-de-precos.md` (mesmas regras de commit com índice próprio, migração à mão, só tabelas novas, agendador contra produção).
- Direto na `main`, sem branch nem worktree (pedido do usuário). Commit: `"$TEMP/claude-varredura/commit.sh" "<mensagem>" <arquivos…>` (índice próprio + `update-ref`; ver o plano da base).
- Migração: `20260929140000_controles_contratos`; `MIGRACAO_DA_BIBLIOTECA` passa a apontar para ela (a mais recente de que a etapa depende — produção pula a etapa até ter as duas).
- Dinheiro: string decimal; somas em centavos inteiros.
- Números medidos com o protótipo (29/09): 269 PDFs, 110 contratos; previsto fecha em 240, faturado em 235, os dois em 212; 89 contratos casam direto. A régua (Task 5) não pode ficar abaixo disso.

---

### Task 1: Banco e área nova

**Files:**
- Modify: `prisma/schema.prisma` (models depois de `ItemTabelaPrecos`)
- Create: `prisma/migrations/20260929140000_controles_contratos/migration.sql`
- Modify: `src/lib/biblioteca/areas.ts` + `areas.test.ts` (área `CONTROLES_CONTRATOS`)
- Modify: `src/lib/biblioteca/leitores.ts` (`releitura` na entrada)
- Modify: `src/lib/biblioteca/sincronizar.ts` + `sincronizar.test.ts` (corrige a área de arquivo já registrado; passa `releitura`)
- Modify: `src/lib/biblioteca/etapa.ts` (`MIGRACAO_DA_BIBLIOTECA`)

**Interfaces:**
- Produces: `prisma.controleContrato`, `prisma.controleContratoLinha`; `AreaBiblioteca` inclui `'CONTROLES_CONTRATOS'`; `EntradaLeitor.releitura: boolean`.

- [ ] **Step 1: Models**

```prisma
// Controle do faturamento por contrato (spec docs/superpowers/specs/2026-09-29-controles-de-contratos-design.md):
// um por PDF de "FATURAMENTO SERVIÇOS PRODAM/Controles de Contratos/<MM.AAAA>/". O vigente de um contrato é o
// do mês mais recente. Totais só valem com a prova "soma das linhas = TOTAL" (…Conferido).
model ControleContrato {
  id                String                  @id @default(cuid())
  arquivoId         String                  @unique
  // sha256 do arquivo lido: releitura só quando o conteúdo muda.
  sha256            String
  mesAno            Int
  mesMes            Int
  sigla             String
  contratoTexto     String?
  contratoId        String?
  clienteId         String?
  termoTexto        String?
  vigenciaTexto     String?
  vigenciaInicio    DateTime?
  vigenciaFim       DateTime?
  previstoTotal     Decimal?                @db.Decimal(14, 2)
  faturadoTotal     Decimal?                @db.Decimal(14, 2)
  saldoTotal        Decimal?                @db.Decimal(14, 2)
  previstoConferido Boolean                 @default(false)
  faturadoConferido Boolean                 @default(false)
  avisos            Json
  lidoEm            DateTime
  linhas            ControleContratoLinha[]

  @@index([contratoId, mesAno, mesMes])
  @@index([mesAno, mesMes])
}

model ControleContratoLinha {
  id         String           @id @default(cuid())
  controleId String
  controle   ControleContrato @relation(fields: [controleId], references: [id], onDelete: Cascade)
  // previsto | faturado | saldo
  tipo       String
  posicao    Int
  rotulo     String
  inicio     DateTime?
  fim        DateTime?
  valor      Decimal          @db.Decimal(14, 2)

  @@index([controleId])
}
```

- [ ] **Step 2: Migração** — `prisma/migrations/20260929140000_controles_contratos/migration.sql`:

```sql
-- Controles de Contratos (spec 2026-09-29-controles-de-contratos). Só tabelas novas.
CREATE TABLE "ControleContrato" (
    "id" TEXT NOT NULL,
    "arquivoId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mesAno" INTEGER NOT NULL,
    "mesMes" INTEGER NOT NULL,
    "sigla" TEXT NOT NULL,
    "contratoTexto" TEXT,
    "contratoId" TEXT,
    "clienteId" TEXT,
    "termoTexto" TEXT,
    "vigenciaTexto" TEXT,
    "vigenciaInicio" TIMESTAMP(3),
    "vigenciaFim" TIMESTAMP(3),
    "previstoTotal" DECIMAL(14,2),
    "faturadoTotal" DECIMAL(14,2),
    "saldoTotal" DECIMAL(14,2),
    "previstoConferido" BOOLEAN NOT NULL DEFAULT false,
    "faturadoConferido" BOOLEAN NOT NULL DEFAULT false,
    "avisos" JSONB NOT NULL,
    "lidoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ControleContrato_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ControleContrato_arquivoId_key" ON "ControleContrato"("arquivoId");
CREATE INDEX "ControleContrato_contratoId_mesAno_mesMes_idx" ON "ControleContrato"("contratoId", "mesAno", "mesMes");
CREATE INDEX "ControleContrato_mesAno_mesMes_idx" ON "ControleContrato"("mesAno", "mesMes");

CREATE TABLE "ControleContratoLinha" (
    "id" TEXT NOT NULL,
    "controleId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "posicao" INTEGER NOT NULL,
    "rotulo" TEXT NOT NULL,
    "inicio" TIMESTAMP(3),
    "fim" TIMESTAMP(3),
    "valor" DECIMAL(14,2) NOT NULL,
    CONSTRAINT "ControleContratoLinha_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ControleContratoLinha_controleId_idx" ON "ControleContratoLinha"("controleId");
ALTER TABLE "ControleContratoLinha" ADD CONSTRAINT "ControleContratoLinha_controleId_fkey" FOREIGN KEY ("controleId") REFERENCES "ControleContrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Validar e conferir exatamente como na Task 1 da base: `npx prisma validate`; `migrate diff` contra banco **descartável** (`verai_shadow_controles`) → vazio; `migrate deploy` no dev; `prisma generate`.

- [ ] **Step 3: Testes falhando (área e sincronização)**

Em `src/lib/biblioteca/areas.test.ts`, trocar a linha de FATURAMENTO do `it.each` e acrescentar:

```ts
    ['FATURAMENTO SERVIÇOS PRODAM/Links MPLS - Relatórios para Faturamento/2026/a.pdf', 'LINKS_MPLS'],
    ['FATURAMENTO SERVIÇOS PRODAM/Controles de Contratos/08.2026/CGM - CO-16-CGM-2024 - 2026.08.pdf', 'CONTROLES_CONTRATOS'],
    ['FATURAMENTO SERVIÇOS PRODAM/outra coisa.pdf', 'LINKS_MPLS'],
```

e no teste de permissão: `expect(podeVerArea('responsavel', 'CONTROLES_CONTRATOS')).toBe(false)` (o cliente é conferido na rota).

Em `src/lib/biblioteca/sincronizar.test.ts`:

```ts
it('regra de área mudou: corrige a área do arquivo já registrado e o leitor da área nova roda', async () => {
  const CONTROLE = 'FATURAMENTO SERVIÇOS PRODAM/Controles de Contratos/08.2026/CGM - CO-16-CGM-2024 - 2026.08.pdf'
  const conteudo = Buffer.from('c')
  const prisma = prismaFake([registrado(CONTROLE, conteudo, { area: 'LINKS_MPLS' })])
  const leitor = jest.fn(async () => 'controles: 1')
  await rodar(prisma, { aplicar: true, fonte: fonte({ [CONTROLE]: conteudo }), leitores: { CONTROLES_CONTRATOS: leitor } })
  expect(prisma.linhas[0].area).toBe('CONTROLES_CONTRATOS')
  expect(leitor).toHaveBeenCalledWith(expect.objectContaining({ releitura: false }))
})

it('--reler avisa o leitor que é releitura', async () => {
  const conteudo = Buffer.from('igual')
  const prisma = prismaFake([registrado(TABELA, conteudo)])
  const leitor = jest.fn(async () => 'relido')
  await rodar(prisma, { aplicar: true, fonte: fonte({ [TABELA]: conteudo }), leitores: { TABELA_PRECOS: leitor }, relerAreas: ['TABELA_PRECOS'] })
  expect(leitor).toHaveBeenCalledWith(expect.objectContaining({ releitura: true }))
})
```

- [ ] **Step 4: Rodar e ver falhar** — `npx jest src/lib/biblioteca` → FAIL.

- [ ] **Step 5: Implementar**

`areas.ts`: `AREAS_BIBLIOTECA` ganha `'CONTROLES_CONTRATOS'` (antes de `'OUTRO'`) e, em `areaDoCaminho`:

```ts
  if (/FATURAMENTO\s+SERVICOS/.test(pasta)) {
    return /^CONTROLES?\s+DE\s+CONTRATOS/.test(semAcento(caminho.split('/')[1] ?? '')) ? 'CONTROLES_CONTRATOS' : 'LINKS_MPLS'
  }
```

`leitores.ts`: em `EntradaLeitor`, `/** Releitura pedida (--reler): o leitor relê tudo, não só o que mudou. */ releitura: boolean`.

`sincronizar.ts`: no caminho "mesmo tamanho e data", antes do `continue`:

```ts
      const areaAgora = areaDoCaminho(a.caminho)
      if (aplicar && ativo.area !== areaAgora) {
        // A regra de área mudou (ex.: Controles de Contratos saiu de Links MPLS): corrige e chama o leitor novo.
        await prisma.arquivoBiblioteca.update({ where: { id: ativo.id }, data: { area: areaAgora } })
        tocadas.add(areaAgora)
      }
```

e na chamada do leitor: `releitura: relerAreas.includes(area)`.

`etapa.ts`: `export const MIGRACAO_DA_BIBLIOTECA = '20260929140000_controles_contratos'` com o comentário "a mais recente das migrações de que a etapa depende (biblioteca, tabela de preços, controles)".

- [ ] **Step 6: Rodar e ver passar** — `npx jest src/lib/biblioteca src/lib/tabela-precos` → PASS; `npx tsc --noEmit`.

- [ ] **Step 7: Commit** — `feat(controles): tabelas e área dos Controles de Contratos` com schema, migração e os arquivos da biblioteca.

---

### Task 2: Leitura do PDF do controle (regra pura)

**Files:**
- Create: `src/lib/controles-contratos/leitura.ts` + `leitura.test.ts`

**Interfaces:**
- Produces:
  - `interface LinhaPdf { pagina: number; textos: string[] }` (ordem de leitura; textos da esquerda para a direita)
  - `type TipoTabela = 'previsto' | 'faturado' | 'saldo'`
  - `interface LinhaTabela { rotulo: string; valor: string; inicio: Date | null; fim: Date | null }`
  - `interface TabelaLida { tipo: TipoTabela; linhas: LinhaTabela[]; total: string | null; conferida: boolean }`
  - `interface ControleLido { contratoTexto: string | null; termoTexto: string | null; vigenciaTexto: string | null; vigenciaInicio: Date | null; vigenciaFim: Date | null; previsto: TabelaLida | null; faturado: TabelaLida | null; saldo: TabelaLida | null; avisos: string[] }`
  - `lerControle(linhas: LinhaPdf[]): ControleLido`
  - `valorBr(texto): string | null` ("1.254,89" → "1254.89"; "-154.131,60" → "-154131.60")
  - `dataBr(texto): Date | null` ("24/09/25" → 2025-09-24 UTC; "01/12/2025")

- [ ] **Step 1: Teste falhando** — `src/lib/controles-contratos/leitura.test.ts` (linhas copiadas dos PDFs reais de 06.2026):

```ts
import { dataBr, lerControle, valorBr, type LinhaPdf } from './leitura'

const L = (...textos: string[]): LinhaPdf => ({ pagina: 1, textos })

// ADESAMPA CO-082-2024 (06.2026): períodos por data, vigência com ano trocado no próprio documento.
const ADESAMPA: LinhaPdf[] = [
  L('CRONOGRAMA FÍSICO FINANCEIRO - ADSAMPA(Disp. Acesso a Rede)'),
  L('CO 082/2024', '- T.A. 01 - Vigência: 18/11/2026 à 17/11/2026'),
  L('PREVISÃO DE FATURAMENTO'),
  L('DATA CENTER'),
  L('PERÍODO', 'TOTAL'),
  ...Array.from({ length: 12 }, (_, i) => L(`MÊS ${String(i + 1).padStart(2, '0')}`, '1.254,89', '1.254,89')),
  L('TOTAL', '15.058,68', '15.058,68'),
  L('CRONOGRAMA FÍSICO FINANCEIRO - ADSAMPA(Disp. Acesso a Rede)'),
  L('CO 082/2024', '- T.A. 01 - Vigência: 18/11/2026 à 17/11/2026'),
  L('FATURADO'),
  L('PERÍODO', 'TOTAL'),
  L('18/11/2025 à 30/11/2025 - 12D', '388,42', '388,42'),
  L('01/12/2025 à 31/12/2025', '896,35', '896,35'),
  L('01/01/2026 à 31/01/2026', '6.791,80', '6.791,80'),
  L('01/02/2026 à 28/02/2026', '0,00'),
  L('TOTAL', '8.076,57', '8.076,57'),
  L('SALDO A FATURAR'),
  L('18/11/2025 à 30/11/2025 - 12D', '866,47', '866,47'),
  L('TOTAL', '9.237,00', '9.237,00'),
]

it('lê cabeçalho, as três tabelas e prova cada uma pela soma', () => {
  const c = lerControle(ADESAMPA)
  expect(c.contratoTexto).toBe('CO 082/2024')
  expect(c.termoTexto).toBe('T.A. 01')
  expect(c.vigenciaTexto).toBe('18/11/2026 à 17/11/2026')
  expect(c.previsto).toMatchObject({ total: '15058.68', conferida: true })
  expect(c.previsto!.linhas).toHaveLength(12)
  expect(c.faturado).toMatchObject({ total: '8076.57', conferida: true })
  expect(c.faturado!.linhas[0]).toEqual({ rotulo: '18/11/2025 à 30/11/2025 - 12D', valor: '388.42', inicio: new Date(Date.UTC(2025, 10, 18)), fim: new Date(Date.UTC(2025, 10, 30)) })
  expect(c.faturado!.linhas[3]).toMatchObject({ rotulo: '01/02/2026 à 28/02/2026', valor: '0.00' })
  expect(c.saldo).toMatchObject({ total: '9237.00', conferida: false })
})

it('vigência com fim antes do início: mantém o texto, não as datas, e avisa', () => {
  const c = lerControle(ADESAMPA)
  expect([c.vigenciaInicio, c.vigenciaFim]).toEqual([null, null])
  expect(c.avisos).toContain('vigência com datas trocadas no documento: 18/11/2026 à 17/11/2026')
})

it('saldo do documento diferente de previsto − faturado vira aviso', () => {
  expect(lerControle(ADESAMPA).avisos).toContain('o controle informa saldo de R$ 9.237,00; previsto − faturado dá R$ 6.982,11')
})

// SMDET CO 07/2024 (06.2026): título "PREVISTO", "VIGÊNCIA -", total de grupo diferente da coluna total.
it('"PREVISTO", "VIGÊNCIA -" e a coluna total (última) como valor da linha', () => {
  const c = lerControle([
    L('CO 07/2024/SMDET - T.A. 01 - VIGÊNCIA - 21/11/2025 à 20/10/2026'),
    L('PREVISTO'),
    L('PERÍODO', 'COMUNICAÇÃO', 'TOTAL'),
    ...Array.from({ length: 11 }, (_, i) => L(`MÊS ${String(i + 1).padStart(2, '0')}`, '21.546,39', '21.546,39')),
    L('TOTAL', '215.463,90', '237.010,29'),
    L('FATURADO'),
    L('20/11/2025 à 20/12/2025', '21.546,39', '21.546,39'),
    L('21/06/2025 á 20/07/2025', '0,00'),
    L('TOTAL', '21.546,39', '21.546,39'),
  ])
  expect(c.contratoTexto).toBe('CO 07/2024/SMDET')
  expect([c.vigenciaInicio, c.vigenciaFim]).toEqual([new Date(Date.UTC(2025, 10, 21)), new Date(Date.UTC(2026, 9, 20))])
  expect(c.previsto).toMatchObject({ total: '237010.29', conferida: true })
  expect(c.faturado).toMatchObject({ total: '21546.39', conferida: true })
  // "21/06/2025" num contrato de 2025–2026: data fora da vigência ± 1 ano? não — dentro; fica.
  expect(c.faturado!.linhas[1].inicio).toEqual(new Date(Date.UTC(2025, 5, 21)))
})

// CGM CO 16/2024: períodos "OUT/25-16DD", "NOV/2025"; SF: "24/09/25 a 20/10/25-27Dias", "ate".
it('períodos em mês/ano e datas de 2 dígitos com "a"/"ate"', () => {
  const c = lerControle([
    L('CO 42/2024 - T.A. 01 - Vigência: 24/09/2025 ate 23/09/2026'),
    L('FATURADO'),
    L('24/09/25 a 20/10/25-27Dias', '24.057,04', '2.871.938,09'),
    L('OUT/25-16DD', '49.333,59', '210.974,73'),
    L('NOV/2025', '93.729,36', '391.842,84'),
    L('TOTAL', '3.474.755,66'),
  ])
  expect([c.vigenciaInicio, c.vigenciaFim]).toEqual([new Date(Date.UTC(2025, 8, 24)), new Date(Date.UTC(2026, 8, 23))])
  expect(c.faturado!.linhas.map((l) => [l.rotulo, l.valor])).toEqual([
    ['24/09/25 a 20/10/25-27Dias', '2871938.09'],
    ['OUT/25-16DD', '210974.73'],
    ['NOV/2025', '391842.84'],
  ])
  expect(c.faturado!.linhas[0]).toMatchObject({ inicio: new Date(Date.UTC(2025, 8, 24)), fim: new Date(Date.UTC(2025, 9, 20)) })
  expect(c.faturado!.linhas[2]).toMatchObject({ inicio: new Date(Date.UTC(2025, 10, 1)), fim: new Date(Date.UTC(2025, 10, 30)) })
  expect(c.faturado!.conferida).toBe(true)
})

it('duas tabelas do mesmo tipo (termo anterior + atual): vale a última', () => {
  const c = lerControle([
    L('CO 1/2024 - Vigência: 01/01/2024 à 31/12/2024'),
    L('FATURADO'),
    L('JAN/2024', '10,00'),
    L('TOTAL', '10,00'),
    L('CO 1/2024 - T.A. 01 - Vigência: 01/01/2025 à 31/12/2025'),
    L('FATURADO'),
    L('JAN/2025', '20,00'),
    L('FEV/2025', '5,00'),
    L('TOTAL', '25,00'),
  ])
  expect(c.termoTexto).toBe('T.A. 01')
  expect(c.faturado).toMatchObject({ total: '25.00', conferida: true })
})

it('tabela que não fecha fica não conferida; sem TOTAL também', () => {
  const c = lerControle([L('FATURADO'), L('JAN/2026', '10,00'), L('TOTAL', '11,00'), L('PREVISTO'), L('MÊS 1', '5,00')])
  expect(c.faturado!.conferida).toBe(false)
  expect(c.previsto).toMatchObject({ total: null, conferida: false })
})

it('valorBr e dataBr', () => {
  expect(valorBr('1.254,89')).toBe('1254.89')
  expect(valorBr('-154.131,60')).toBe('-154131.60')
  expect(valorBr('0,00')).toBe('0.00')
  expect(valorBr('10.000')).toBeNull()
  expect(dataBr('24/09/25')).toEqual(new Date(Date.UTC(2025, 8, 24)))
  expect(dataBr('31/02/2026')).toBeNull()
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/lib/controles-contratos` → FAIL.

- [ ] **Step 3: Implementar** — `src/lib/controles-contratos/leitura.ts`:

```ts
// Leitura do PDF de "Controles de Contratos" (spec 2026-09-29-controles-de-contratos §4). Regra pura sobre
// as linhas do PDF (itens agrupados por y). Planilha feita à mão: cada tabela só vale com a prova "soma das
// linhas = TOTAL"; o que não fecha fica "não conferido" e não entra em tela nenhuma.

export interface LinhaPdf {
  pagina: number
  textos: string[]
}

export type TipoTabela = 'previsto' | 'faturado' | 'saldo'

export interface LinhaTabela {
  rotulo: string
  valor: string
  inicio: Date | null
  fim: Date | null
}

export interface TabelaLida {
  tipo: TipoTabela
  linhas: LinhaTabela[]
  total: string | null
  conferida: boolean
}

export interface ControleLido {
  contratoTexto: string | null
  termoTexto: string | null
  vigenciaTexto: string | null
  vigenciaInicio: Date | null
  vigenciaFim: Date | null
  previsto: TabelaLida | null
  faturado: TabelaLida | null
  saldo: TabelaLida | null
  avisos: string[]
}

const VALOR = /^(-?)(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})$/
// "à"/"á" não são \w no JS: `\b` depois deles falha — o fim do separador é "seguido de espaço".
const PERIODO = /^(M[ÊE]S\s*\d+|[A-ZÇ]{3,9}\/\d{2,4}|\d{1,2}\/\d{1,2}\/\d{2,4}\s*(?:[àáa]|at[ée])(?=\s))/i
const DATA = String.raw`(\d{1,2}\/\d{1,2}\/\d{2,4})`
const ATE = String.raw`\s*(?:[àáa]|at[ée])\s*`
const VIGENCIA = new RegExp(String.raw`Vig[êe]ncia\s*[:\-–]?\s*${DATA}${ATE}${DATA}`, 'i')
const MESES: Record<string, number> = { JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12 }

/** "1.254,89" → "1254.89"; o que não for dinheiro com centavos → null. */
export function valorBr(texto: string): string | null {
  const m = VALOR.exec(texto.trim())
  return m ? `${m[1]}${m[2].replace(/\./g, '')}.${m[3]}` : null
}

/** "24/09/25" ou "24/09/2025" → Date UTC; data impossível → null. */
export function dataBr(texto: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(texto.trim())
  if (!m) return null
  const [d, mes, a] = [Number(m[1]), Number(m[2]), m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])]
  const data = new Date(Date.UTC(a, mes - 1, d))
  return data.getUTCMonth() === mes - 1 && data.getUTCDate() === d ? data : null
}

const centavos = (valor: string) => Math.round(Number(valor) * 100)
const deCentavos = (c: number) => (c / 100).toFixed(2)
const moeda = (valor: string) => `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Período de uma linha: "01/12/2025 à 31/12/2025", "24/09/25 a 20/10/25-27Dias", "NOV/2025", "OUT/25-16DD". "MÊS n" não tem data. */
function periodo(rotulo: string): { inicio: Date | null; fim: Date | null } {
  const intervalo = new RegExp(String.raw`^${DATA}${ATE}${DATA}`, 'i').exec(rotulo)
  if (intervalo) return { inicio: dataBr(intervalo[1]), fim: dataBr(intervalo[2]) }
  const mes = /^([A-ZÇ]{3})[A-ZÇ]*\/(\d{4}|\d{2})/i.exec(rotulo)
  const numero = mes ? MESES[mes[1].toUpperCase()] : undefined
  if (!mes || !numero) return { inicio: null, fim: null }
  const ano = mes[2].length === 2 ? 2000 + Number(mes[2]) : Number(mes[2])
  return { inicio: new Date(Date.UTC(ano, numero - 1, 1)), fim: new Date(Date.UTC(ano, numero, 0)) }
}

function tipoDoTitulo(texto: string): TipoTabela | null {
  if (/SALDO\s+A\s+FATURAR/i.test(texto)) return 'saldo'
  if (/\bFATURADO\b/i.test(texto)) return 'faturado'
  if (/PREVIS[ÃA]O|PREVISTO/i.test(texto)) return 'previsto'
  return null
}

export function lerControle(linhas: LinhaPdf[]): ControleLido {
  const r: ControleLido = {
    contratoTexto: null, termoTexto: null, vigenciaTexto: null, vigenciaInicio: null, vigenciaFim: null,
    previsto: null, faturado: null, saldo: null, avisos: [],
  }
  let tipo: TipoTabela | null = null
  let aberta: TabelaLida | null = null
  const fechar = () => {
    if (!aberta) return
    const soma = aberta.linhas.reduce((s, l) => s + centavos(l.valor), 0)
    aberta.conferida = aberta.total !== null && Math.abs(soma - centavos(aberta.total)) <= 5
    r[aberta.tipo] = aberta // a última tabela de cada tipo vence (termo anterior + atual no mesmo PDF)
    aberta = null
  }
  for (const linha of linhas) {
    const texto = linha.textos.join(' ').replace(/\s+/g, ' ').trim()
    const primeiro = linha.textos[0]?.trim() ?? ''
    const vigencia = VIGENCIA.exec(texto)
    if (vigencia) {
      fechar()
      r.vigenciaTexto = `${vigencia[1]} à ${vigencia[2]}`
      r.vigenciaInicio = dataBr(vigencia[1])
      r.vigenciaFim = dataBr(vigencia[2])
      r.contratoTexto = /\bC\.?\s?O\.?\s*(\d[\w/.-]*)/i.exec(texto)?.[0].replace(/\s+/g, ' ').trim() ?? r.contratoTexto
      const termo = /\bT\.?\s?A\.?\s*(\d+)/i.exec(texto)
      r.termoTexto = termo ? `T.A. ${termo[1].padStart(2, '0')}` : null
      continue
    }
    const titulo = PERIODO.test(primeiro) || /^TOTAL\b/i.test(primeiro) ? null : tipoDoTitulo(texto)
    if (titulo) {
      fechar()
      tipo = titulo
      continue
    }
    if (!tipo) continue
    const valores = linha.textos.map(valorBr).filter((v): v is string => v !== null)
    if (valores.length === 0) continue
    if (/^TOTAL\b/i.test(primeiro)) {
      if (aberta) {
        aberta.total = valores[valores.length - 1]
        fechar()
      }
      continue
    }
    if (!PERIODO.test(primeiro)) continue
    if (!aberta) aberta = { tipo, linhas: [], total: null, conferida: false }
    const rotulo = linha.textos.filter((t) => valorBr(t) === null).join(' ').replace(/\s+/g, ' ').trim()
    aberta.linhas.push({ rotulo, valor: valores[valores.length - 1], ...periodo(rotulo) })
  }
  fechar()

  if (r.vigenciaInicio && r.vigenciaFim && r.vigenciaFim.getTime() <= r.vigenciaInicio.getTime()) {
    r.avisos.push(`vigência com datas trocadas no documento: ${r.vigenciaTexto}`)
    r.vigenciaInicio = null
    r.vigenciaFim = null
  }
  // Data de período fora da vigência ± 1 ano é erro de digitação da planilha: fica o texto, sai a data.
  if (r.vigenciaInicio && r.vigenciaFim) {
    const de = Date.UTC(r.vigenciaInicio.getUTCFullYear() - 1, r.vigenciaInicio.getUTCMonth(), r.vigenciaInicio.getUTCDate())
    const ate = Date.UTC(r.vigenciaFim.getUTCFullYear() + 1, r.vigenciaFim.getUTCMonth(), r.vigenciaFim.getUTCDate())
    const fora = (d: Date | null) => !!d && (d.getTime() < de || d.getTime() > ate)
    for (const t of [r.previsto, r.faturado, r.saldo]) {
      for (const l of t?.linhas ?? []) {
        if (fora(l.inicio) || fora(l.fim)) {
          l.inicio = null
          l.fim = null
        }
      }
    }
  }
  if (r.previsto?.conferida && r.faturado?.conferida && r.saldo?.total) {
    const calculado = centavos(r.previsto.total!) - centavos(r.faturado.total!)
    if (Math.abs(calculado - centavos(r.saldo.total)) > 5) {
      r.avisos.push(`o controle informa saldo de ${moeda(r.saldo.total)}; previsto − faturado dá ${moeda(deCentavos(calculado))}`)
    }
  }
  return r
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx jest src/lib/controles-contratos` → PASS.

- [ ] **Step 5: Commit** — `feat(controles): leitura do PDF do controle com prova pela soma`.

---

### Task 3: Linhas do PDF e contrato pelo nome

**Files:**
- Create: `src/lib/controles-contratos/pdf.ts` (`linhasDoPdf`)
- Create: `src/lib/controles-contratos/nome.ts` + `nome.test.ts`

**Interfaces:**
- Produces: `linhasDoPdf(conteudo: Buffer): Promise<LinhaPdf[]>`; `mesDoCaminho(caminho): { ano: number; mes: number } | null` (pasta `08.2026`); `contratoDoNome(nome): { sigla: string; chave: string | null }` (`chave` = "16 2024"); `chaveDoContratoTexto(texto): string | null` ("CO 07/2024/SMDET" → "7 2024").

- [ ] **Step 1: Teste falhando** — `nome.test.ts`:

```ts
import { chaveDoContratoTexto, contratoDoNome, mesDoCaminho } from './nome'

it.each([
  ['CGM - CO-16-CGM-2024 (Sust e Melhorias de TIC) - 2026.08.pdf', 'CGM', '16 2024'],
  ['HSPM - C.O.385-2023 - HSPM (Hospedagem) - 2026.08.pdf', 'HSPM', '385 2023'],
  ['COHAB - CO-086-21 (Sustentação) - 2026.06.pdf', 'COHAB', '86 2021'],
  ['SEGES - C.O. 24-SEGES-25- Sustentação - 2026.06.pdf', 'SEGES', '24 2025'],
  ['SMS - C.O.142-2021-TA 04 (Sustentação) - 2026.06.pdf', 'SMS', '142 2021'],
  ['ICI - C.O. S.N-2024 - 2026.08.pdf', 'ICI', null],
])('%s', (nome, sigla, chave) => {
  expect(contratoDoNome(nome)).toEqual({ sigla, chave })
})

it('contrato do cabeçalho e mês da pasta', () => {
  expect(chaveDoContratoTexto('CO 07/2024/SMDET')).toBe('7 2024')
  expect(chaveDoContratoTexto('CO 082/2024')).toBe('82 2024')
  expect(mesDoCaminho('FATURAMENTO SERVIÇOS PRODAM/Controles de Contratos/08.2026/x.pdf')).toEqual({ ano: 2026, mes: 8 })
  expect(mesDoCaminho('FATURAMENTO SERVIÇOS PRODAM/Controles de Contratos/x.pdf')).toBeNull()
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

`nome.ts`:

```ts
// Contrato e mês de um PDF de Controles de Contratos pelo caminho (spec 2026-09-29-controles-de-contratos §4.2–4.3).
// Chave = "nº ano" (a mesma parte numérica da chave do SharePoint "SIGLA|nº ano"); ano de 2 dígitos vira 4.

function numeroEAno(texto: string): string | null {
  const numeros = texto.split(/[^0-9]+/).filter(Boolean)
  if (numeros.length < 2) return null
  const numero = String(Number(numeros[0]))
  for (const n of numeros.slice(1)) {
    const valor = Number(n)
    if (n.length === 4 && valor >= 2000 && valor <= 2100) return `${numero} ${valor}`
    if (n.length === 2 && valor >= 10) return `${numero} ${2000 + valor}`
  }
  return null
}

export function contratoDoNome(nome: string): { sigla: string; chave: string | null } {
  const partes = nome.split(' - ')
  const sigla = (partes[0] ?? '').trim().toUpperCase()
  const resto = partes.slice(1).join(' - ').replace(/\s*-\s*\d{4}\.\d{2}\.pdf$/i, '').replace(/\([^)]*\)/g, ' ')
  return { sigla, chave: numeroEAno(resto) }
}

export function chaveDoContratoTexto(texto: string | null): string | null {
  return texto ? numeroEAno(texto) : null
}

/** Pasta "08.2026" → agosto de 2026. */
export function mesDoCaminho(caminho: string): { ano: number; mes: number } | null {
  for (const parte of caminho.split('/')) {
    const m = /^(\d{2})\.(\d{4})$/.exec(parte.trim())
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return { ano: Number(m[2]), mes: Number(m[1]) }
  }
  return null
}
```

`pdf.ts`:

```ts
import { getDocumentProxy } from 'unpdf'
import type { LinhaPdf } from './leitura'

/** Itens do PDF agrupados em linhas pela altura (y), páginas em sequência, textos da esquerda para a direita. */
export async function linhasDoPdf(conteudo: Buffer): Promise<LinhaPdf[]> {
  const pdf = await getDocumentProxy(new Uint8Array(conteudo))
  const saida: LinhaPdf[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const c = await (await pdf.getPage(p)).getTextContent()
    const itens = c.items
      .filter((i): i is typeof i & { str: string; transform: number[] } => 'str' in i && i.str.trim() !== '')
      .map((i) => ({ x: i.transform[4], y: i.transform[5], s: i.str.trim() }))
      .sort((a, b) => b.y - a.y || a.x - b.x)
    const linhas: { y: number; itens: typeof itens }[] = []
    for (const i of itens) {
      const l = linhas.find((x) => Math.abs(x.y - i.y) < 3)
      if (l) l.itens.push(i)
      else linhas.push({ y: i.y, itens: [i] })
    }
    for (const l of linhas) saida.push({ pagina: p, textos: l.itens.sort((a, b) => a.x - b.x).map((i) => i.s) })
  }
  await pdf.cleanup?.()
  return saida
}
```

- [ ] **Step 4: Rodar e ver passar.**

- [ ] **Step 5: Commit** — `feat(controles): linhas do PDF, contrato pelo nome e mês pela pasta`.

---

### Task 4: Leitor da área e régua

**Files:**
- Create: `src/lib/controles-contratos/leitor.ts` + `leitor.test.ts`
- Modify: `src/lib/biblioteca/registro-leitores.ts` (`CONTROLES_CONTRATOS: lerControlesDeContratos`)
- Create: `scripts/regua-controles.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `criarLeitorDosControles(deps: { linhasDoPdf; agora }): LeitorDeArea`; `lerControlesDeContratos: LeitorDeArea`; `mapaDeContratos(prisma): Promise<Map<string, { id: string; clienteId: string }[]>>` (chave `SIGLA|nº ano`). Linha do log: `controles de contratos: <n> lidos · previsto conferido <a> · faturado conferido <b> · sem contrato no VerAI <c> · removidos <d>`.

- [ ] **Step 1: Teste falhando** — `leitor.test.ts`:

```ts
/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import type { ArquivoDaArea } from '@/lib/biblioteca/leitores'
import { criarLeitorDosControles } from './leitor'
import type { LinhaPdf } from './leitura'

/* eslint-disable @typescript-eslint/no-explicit-any */

const arq = (id: string, nome: string, sha = id): ArquivoDaArea => ({
  id, nome, sha256: sha, extensao: 'pdf', modificadoEm: new Date(),
  caminho: `FATURAMENTO SERVIÇOS PRODAM/Controles de Contratos/08.2026/${nome}`,
})
const CGM = arq('a1', 'CGM - CO-16-CGM-2024 (Sust) - 2026.08.pdf')
const XYZ = arq('a2', 'XYZ - CO-99-2024 - 2026.08.pdf')
const L = (...textos: string[]): LinhaPdf => ({ pagina: 1, textos })
const linhasDoPdf = jest.fn(async () => [
  L('CO 16/CGM/2024 - T.A. 02 - Vigência: 15/10/2025 à 14/10/2026'),
  L('PREVISÃO DE FATURAMENTO'), L('MÊS 1', '100,00'), L('MÊS 2', '100,00'), L('TOTAL', '200,00'),
  L('FATURADO'), L('OUT/2025', '80,00'), L('NOV/2025', '0,00'), L('TOTAL', '80,00'),
])
const agora = () => new Date('2026-09-29T15:00:00Z')

function prismaFake(existentes: any[] = []) {
  const tx = {
    controleContrato: { upsert: jest.fn(async ({ create }: any) => ({ id: `c-${create.arquivoId}` })) },
    controleContratoLinha: { deleteMany: jest.fn(), createMany: jest.fn() },
  }
  return {
    tx,
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    contrato: {
      findMany: jest.fn(async () => [
        { id: 'k-cgm', clienteId: 'cl-cgm', chaveSharepoint: 'CGM|16 2024', numeroTermo: 'TC 16/CGM/2024', cliente: { siglaLegado: 'CGM' } },
      ]),
    },
    controleContrato: {
      findMany: jest.fn(async () => existentes),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
    arquivoBiblioteca: { updateMany: jest.fn() },
  }
}

it('lê o que é novo, casa o contrato, grava totais e linhas conferidas', async () => {
  const prisma = prismaFake()
  const linha = await criarLeitorDosControles({ linhasDoPdf, agora })({ prisma: prisma as any, todos: [CGM, XYZ], mudados: [], releitura: false, ler: async () => Buffer.from('pdf') })
  expect(linha).toBe('controles de contratos: 2 lidos · previsto conferido 2 · faturado conferido 2 · sem contrato no VerAI 1 · removidos 1')
  expect(prisma.tx.controleContrato.upsert).toHaveBeenCalledWith(expect.objectContaining({
    where: { arquivoId: 'a1' },
    create: expect.objectContaining({
      arquivoId: 'a1', sha256: 'a1', mesAno: 2026, mesMes: 8, sigla: 'CGM', contratoId: 'k-cgm', clienteId: 'cl-cgm',
      termoTexto: 'T.A. 02', previstoTotal: '200.00', faturadoTotal: '80.00', previstoConferido: true, faturadoConferido: true,
    }),
  }))
  expect(prisma.tx.controleContratoLinha.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([
    expect.objectContaining({ controleId: 'c-a1', tipo: 'faturado', posicao: 0, rotulo: 'OUT/2025', valor: '80.00' }),
  ]) })
  expect(prisma.controleContrato.deleteMany).toHaveBeenCalledWith({ where: { arquivoId: { notIn: ['a1', 'a2'] } } })
})

it('não relê o que já foi lido com o mesmo conteúdo, a não ser em --reler', async () => {
  const prisma = prismaFake([{ arquivoId: 'a1', sha256: 'a1' }, { arquivoId: 'a2', sha256: 'a2' }])
  linhasDoPdf.mockClear()
  await criarLeitorDosControles({ linhasDoPdf, agora })({ prisma: prisma as any, todos: [CGM, XYZ], mudados: [], releitura: false, ler: async () => Buffer.from('pdf') })
  expect(linhasDoPdf).not.toHaveBeenCalled()
  await criarLeitorDosControles({ linhasDoPdf, agora })({ prisma: prisma as any, todos: [CGM, XYZ], mudados: [], releitura: true, ler: async () => Buffer.from('pdf') })
  expect(linhasDoPdf).toHaveBeenCalledTimes(2)
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar** — `leitor.ts`:

```ts
import type { PrismaClient } from '@prisma/client'
import type { ArquivoDaArea, LeitorDeArea } from '@/lib/biblioteca/leitores'
import { chaveNumerica } from '@/lib/relatorios-clientes/vincular-itens'
import { lerControle, type ControleLido, type TabelaLida } from './leitura'
import { chaveDoContratoTexto, contratoDoNome, mesDoCaminho } from './nome'
import { linhasDoPdf as linhasDoPdfPadrao } from './pdf'

// Leitor da área CONTROLES_CONTRATOS (spec 2026-09-29-controles-de-contratos §4–5): um PDF por contrato por
// mês. Lê o que é novo ou mudou (pelo sha256 guardado), casa o contrato e grava totais + linhas.

interface Deps {
  linhasDoPdf: typeof linhasDoPdfPadrao
  agora: () => Date
}

/** Chave "SIGLA|nº ano" → contratos (a chave do SharePoint e, sem ela, sigla + nº do termo). */
export async function mapaDeContratos(prisma: PrismaClient): Promise<Map<string, { id: string; clienteId: string }[]>> {
  const contratos = await prisma.contrato.findMany({
    select: { id: true, clienteId: true, chaveSharepoint: true, numeroTermo: true, cliente: { select: { siglaLegado: true } } },
  })
  const mapa = new Map<string, { id: string; clienteId: string }[]>()
  const pôr = (chave: string | null, c: { id: string; clienteId: string }) => {
    if (!chave) return
    const lista = mapa.get(chave) ?? []
    if (!lista.some((x) => x.id === c.id)) lista.push(c)
    mapa.set(chave, lista)
  }
  for (const c of contratos) {
    const alvo = { id: c.id, clienteId: c.clienteId }
    pôr(c.chaveSharepoint, alvo)
    const sigla = c.cliente.siglaLegado?.toUpperCase()
    const numero = chaveNumerica(c.numeroTermo)
    if (sigla && numero) pôr(`${sigla}|${numero}`, alvo)
  }
  return mapa
}

const conferidoOuNulo = (t: TabelaLida | null) => (t?.conferida ? t.total : null)

export function criarLeitorDosControles(deps: Deps): LeitorDeArea {
  return async ({ prisma, todos, releitura, ler }) => {
    const pdfs = todos.filter((a) => a.extensao === 'pdf' && mesDoCaminho(a.caminho))
    const existentes = new Map(
      (await prisma.controleContrato.findMany({ select: { arquivoId: true, sha256: true } })).map((c) => [c.arquivoId, c.sha256])
    )
    const alvo = releitura ? pdfs : pdfs.filter((a) => existentes.get(a.id) !== a.sha256)
    const contratos = alvo.length ? await mapaDeContratos(prisma) : new Map()
    const r = { lidos: 0, previsto: 0, faturado: 0, semContrato: 0, falhas: 0 }
    for (const a of alvo) {
      try {
        const lido = lerControle(await deps.linhasDoPdf(await ler(a)))
        await gravar(prisma, a, lido, contratos, deps.agora())
        r.lidos++
        if (lido.previsto?.conferida) r.previsto++
        if (lido.faturado?.conferida) r.faturado++
        if (!acharContrato(a, lido, contratos)) r.semContrato++
      } catch (erro) {
        r.falhas++
        await prisma.arquivoBiblioteca.updateMany({
          where: { id: { in: [a.id] } },
          data: { leituraStatus: 'erro', leituraMensagem: (erro instanceof Error ? erro.message : String(erro)).slice(0, 500), lidoEm: deps.agora() },
        })
      }
    }
    const removidos = (await prisma.controleContrato.deleteMany({ where: { arquivoId: { notIn: pdfs.map((a) => a.id) } } })).count
    return `controles de contratos: ${r.lidos} lidos · previsto conferido ${r.previsto} · faturado conferido ${r.faturado} · sem contrato no VerAI ${r.semContrato} · removidos ${removidos}${r.falhas ? ` · falhas ${r.falhas}` : ''}`
  }
}

function acharContrato(a: ArquivoDaArea, lido: ControleLido, contratos: Map<string, { id: string; clienteId: string }[]>) {
  const { sigla, chave } = contratoDoNome(a.nome)
  for (const k of [chave, chaveDoContratoTexto(lido.contratoTexto)]) {
    const achados = k ? contratos.get(`${sigla}|${k}`) : undefined
    if (achados?.length === 1) return achados[0]
  }
  return null
}

async function gravar(prisma: PrismaClient, a: ArquivoDaArea, lido: ControleLido, contratos: Map<string, { id: string; clienteId: string }[]>, agora: Date) {
  const mes = mesDoCaminho(a.caminho)!
  const contrato = acharContrato(a, lido, contratos)
  const dados = {
    sha256: a.sha256, mesAno: mes.ano, mesMes: mes.mes, sigla: contratoDoNome(a.nome).sigla,
    contratoTexto: lido.contratoTexto, contratoId: contrato?.id ?? null, clienteId: contrato?.clienteId ?? null,
    termoTexto: lido.termoTexto, vigenciaTexto: lido.vigenciaTexto, vigenciaInicio: lido.vigenciaInicio, vigenciaFim: lido.vigenciaFim,
    previstoTotal: conferidoOuNulo(lido.previsto), faturadoTotal: conferidoOuNulo(lido.faturado), saldoTotal: lido.saldo?.total ?? null,
    previstoConferido: !!lido.previsto?.conferida, faturadoConferido: !!lido.faturado?.conferida,
    avisos: lido.avisos, lidoEm: agora,
  }
  await prisma.$transaction(async (tx) => {
    const controle = await tx.controleContrato.upsert({ where: { arquivoId: a.id }, create: { arquivoId: a.id, ...dados }, update: dados })
    await tx.controleContratoLinha.deleteMany({ where: { controleId: controle.id } })
    const linhas = (['previsto', 'faturado', 'saldo'] as const).flatMap((tipo) =>
      (lido[tipo]?.conferida ? lido[tipo]!.linhas : []).map((l, posicao) => ({ controleId: controle.id, tipo, posicao, rotulo: l.rotulo, inicio: l.inicio, fim: l.fim, valor: l.valor }))
    )
    if (linhas.length) await tx.controleContratoLinha.createMany({ data: linhas })
  })
  await prisma.arquivoBiblioteca.updateMany({
    where: { id: { in: [a.id] } },
    data: { leituraStatus: lido.previsto?.conferida && lido.faturado?.conferida ? 'ok' : 'parcial', leituraMensagem: lido.avisos.join(' · ') || null, lidoEm: agora },
  })
}

export const lerControlesDeContratos: LeitorDeArea = criarLeitorDosControles({ linhasDoPdf: linhasDoPdfPadrao, agora: () => new Date() })
```

(`saldo` só entra nas linhas quando confere; `saldoTotal` guarda o do documento para o aviso da tela.)

`scripts/regua-controles.ts`:

```ts
/**
 * Régua da leitura dos Controles de Contratos (spec 2026-09-29-controles-de-contratos §8): lê os PDFs da
 * pasta sincronizada e conta quantas tabelas fecham. Rodar antes e depois de mexer em
 * src/lib/controles-contratos/leitura.ts. Só lê — não grava nada.
 *   npx tsx scripts/regua-controles.ts [--pasta="…\Controles de Contratos"]
 */
import { readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { lerControle } from '../src/lib/controles-contratos/leitura'
import { contratoDoNome } from '../src/lib/controles-contratos/nome'
import { linhasDoPdf } from '../src/lib/controles-contratos/pdf'

async function main() {
  const pasta = process.argv.find((a) => a.startsWith('--pasta='))?.slice(8).replace(/^"|"$/g, '') ??
    path.join(homedir(), 'rede.sp', 'rede.sp - Documentos', 'FATURAMENTO SERVIÇOS PRODAM', 'Controles de Contratos')
  const r = { total: 0, vigencia: 0, previsto: 0, faturado: 0, ambos: 0, semChave: 0 }
  const falhas: string[] = []
  for (const mes of readdirSync(pasta)) {
    for (const nome of readdirSync(path.join(pasta, mes)).filter((n) => n.toLowerCase().endsWith('.pdf'))) {
      r.total++
      const c = lerControle(await linhasDoPdf(readFileSync(path.join(pasta, mes, nome))))
      if (c.vigenciaTexto) r.vigencia++
      if (c.previsto?.conferida) r.previsto++
      if (c.faturado?.conferida) r.faturado++
      if (c.previsto?.conferida && c.faturado?.conferida) r.ambos++
      else falhas.push(`${mes}/${nome}: previsto ${c.previsto ? (c.previsto.conferida ? 'ok' : 'não fecha') : 'não achado'} · faturado ${c.faturado ? (c.faturado.conferida ? 'ok' : 'não fecha') : 'não achado'}`)
      if (!contratoDoNome(nome).chave) r.semChave++
    }
  }
  console.log(`PDFs ${r.total} · vigência ${r.vigencia} · previsto fecha ${r.previsto} · faturado fecha ${r.faturado} · os dois ${r.ambos} (${Math.round((r.ambos / r.total) * 100)}%) · sem nº no nome ${r.semChave}`)
  for (const f of falhas.slice(0, 40)) console.log(`  ${f}`)
}
main()
```

- [ ] **Step 4: Rodar e ver passar** — `npx jest src/lib/controles-contratos src/lib/biblioteca` → PASS.

- [ ] **Step 5: Régua nos PDFs reais** — `npx tsx scripts/regua-controles.ts` → **os dois ≥ 212 de 269** (o protótipo). Se ficar abaixo, investigar os que caíram antes de seguir; registrar o número no Andamento.

- [ ] **Step 6: Carga no dev** — `npx dotenv -e .env.development -- npx tsx scripts/sincronizar-sharepoint.ts --aplicar` (a correção de área chama o leitor sozinha). Esperado: linha `controles de contratos: 269 lidos · previsto conferido ≥240 · faturado conferido ≥235 · …`, conferência "TUDO NO VERAI", código 0. Rodar de novo: `0 lidos`.

- [ ] **Step 7: Commit** — `feat(controles): leitor dos Controles de Contratos no agendador e régua`.

---

### Task 5: Consultas, API e permissão do PDF

**Files:**
- Create: `src/lib/controles-contratos/tipos.ts`, `src/lib/controles-contratos/consultas.ts`
- Create: `src/app/api/contratos/[id]/controle/route.ts` + `route.test.ts`
- Create: `src/app/api/controle-faturamento/route.ts` + `route.test.ts`
- Modify: `src/app/api/biblioteca/[id]/route.ts` + teste (CONTROLES_CONTRATOS pelo cliente)

**Interfaces:**
- Produces (tipos, sem import de servidor):
  - `ControleSerializado { arquivoId; mes: string /* "2026-08" */; sigla; contratoTexto; contratoId; clienteId; clienteNome: string | null; termoTexto; vigenciaTexto; vigenciaInicio: string | null; vigenciaFim: string | null; previsto: string | null; faturado: string | null; saldoCalculado: string | null; saldoDocumento: string | null; percentual: number | null; ultimoFaturado: string | null; conferido: boolean; avisos: string[] }`
  - `LinhaControle { tipo: 'previsto' | 'faturado' | 'saldo'; rotulo: string; valor: string }`
- `controleDoContrato(contratoId): Promise<{ controle: ControleSerializado; linhas: LinhaControle[] } | null>` (o de mês mais recente)
- `listarControles(filtro: { mes?: string; clienteIds: string[] | null }): Promise<{ meses: string[]; mes: string | null; controles: ControleSerializado[] }>`
- Rotas: `GET /api/contratos/[id]/controle` → 200 `{controle, linhas}` | 404 `{ error: 'sem controle' }`; `GET /api/controle-faturamento?mes=AAAA-MM` → `{ meses, mes, controles }`.

- [ ] **Step 1: Testes falhando** (padrão das rotas da tabela de preços: `jest.mock('@/lib/auth')`, `jest.mock('@/lib/controles-contratos/consultas')`):
  - `/api/contratos/[id]/controle`: 401 sem usuário; 403 para cliente não permitido (mock de `carregarContratoComAcesso`); 404 sem controle; 200 com o que `controleDoContrato` devolve.
  - `/api/controle-faturamento`: 401; passa `clienteIds` de `clienteIdsPermitidos` (admin → `null`); `?mes=2026-07` repassado.
  - `/api/biblioteca/[id]`: `CONTROLES_CONTRATOS` → 200 quando `podeVerCliente` do `clienteId` do controle é true; 404 quando não; sem controle/cliente → só admin.

```ts
// src/app/api/contratos/[id]/controle/route.test.ts
/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'

jest.mock('@/app/api/contratos/carregar', () => ({ carregarContratoComAcesso: jest.fn() }))
jest.mock('@/lib/controles-contratos/consultas', () => ({ controleDoContrato: jest.fn() }))

import { carregarContratoComAcesso } from '@/app/api/contratos/carregar'
import { controleDoContrato } from '@/lib/controles-contratos/consultas'
import { GET } from './route'

const pedido = () => new NextRequest('http://localhost/api/contratos/k1/controle')
const ctx = { params: Promise.resolve({ id: 'k1' }) }

it('repassa a recusa do acesso (401/403/404 do contrato)', async () => {
  ;(carregarContratoComAcesso as jest.Mock).mockResolvedValue({ erro: NextResponse.json({ error: 'acesso negado' }, { status: 403 }) })
  expect((await GET(pedido(), ctx)).status).toBe(403)
})

it('404 sem controle; 200 com o controle vigente', async () => {
  ;(carregarContratoComAcesso as jest.Mock).mockResolvedValue({ usuario: {}, contrato: { id: 'k1', clienteId: 'c1' } })
  ;(controleDoContrato as jest.Mock).mockResolvedValueOnce(null)
  expect((await GET(pedido(), ctx)).status).toBe(404)
  ;(controleDoContrato as jest.Mock).mockResolvedValueOnce({ controle: { mes: '2026-08' }, linhas: [] })
  await expect((await GET(pedido(), ctx)).json()).resolves.toEqual({ controle: { mes: '2026-08' }, linhas: [] })
  expect(controleDoContrato).toHaveBeenLastCalledWith('k1')
})
```

```ts
// src/app/api/controle-faturamento/route.test.ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/visibilidade', () => ({ clienteIdsPermitidos: jest.fn() }))
jest.mock('@/lib/controles-contratos/consultas', () => ({ listarControles: jest.fn(async () => ({ meses: [], mes: null, controles: [] })) }))

import { getAuthUser } from '@/lib/auth'
import { clienteIdsPermitidos } from '@/lib/visibilidade'
import { listarControles } from '@/lib/controles-contratos/consultas'
import { GET } from './route'

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(new NextRequest('http://localhost/api/controle-faturamento'))).status).toBe(401)
})

it('filtra pelos clientes do usuário e pelo mês pedido', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u', role: 'uploader' })
  ;(clienteIdsPermitidos as jest.Mock).mockResolvedValue(['c1'])
  await GET(new NextRequest('http://localhost/api/controle-faturamento?mes=2026-07'))
  expect(listarControles).toHaveBeenCalledWith({ mes: '2026-07', clienteIds: ['c1'] })
})
```

No teste de `/api/biblioteca/[id]`, acrescentar `jest.mock('@/lib/visibilidade', () => ({ podeVerCliente: jest.fn() }))`, `controleContrato: { findUnique: jest.fn() }` no mock do prisma e:

```ts
it('controle de contrato: abre para quem vê o cliente do controle', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(usuario('responsavel'))
  ;(prisma.arquivoBiblioteca.findUnique as jest.Mock).mockResolvedValue(arquivo('CONTROLES_CONTRATOS'))
  ;(prisma.controleContrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c1' })
  ;(podeVerCliente as jest.Mock).mockResolvedValue(true)
  expect((await GET(pedido(), ctx)).status).toBe(200)
  ;(podeVerCliente as jest.Mock).mockResolvedValue(false)
  expect((await GET(pedido(), ctx)).status).toBe(404)
  ;(prisma.controleContrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: null })
  expect((await GET(pedido(), ctx)).status).toBe(404)
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

`tipos.ts`: as interfaces acima.

`consultas.ts`:

```ts
import type { ControleContrato, ControleContratoLinha } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { ControleSerializado, LinhaControle } from './tipos'

// Consultas dos Controles de Contratos (spec 2026-09-29-controles-de-contratos §6–7). Totais só dos conferidos.

const mesTexto = (c: { mesAno: number; mesMes: number }) => `${c.mesAno}-${String(c.mesMes).padStart(2, '0')}`
const texto = (d: { toString(): string } | null) => (d === null ? null : d.toString())

function serializar(c: ControleContrato & { linhas?: ControleContratoLinha[] }, clienteNome: string | null): ControleSerializado {
  const previsto = texto(c.previstoTotal)
  const faturado = texto(c.faturadoTotal)
  const centavos = (v: string) => Math.round(Number(v) * 100)
  const saldo = previsto !== null && faturado !== null ? ((centavos(previsto) - centavos(faturado)) / 100).toFixed(2) : null
  const faturados = (c.linhas ?? []).filter((l) => l.tipo === 'faturado' && Number(l.valor) !== 0)
  return {
    arquivoId: c.arquivoId,
    mes: mesTexto(c),
    sigla: c.sigla,
    contratoTexto: c.contratoTexto,
    contratoId: c.contratoId,
    clienteId: c.clienteId,
    clienteNome,
    termoTexto: c.termoTexto,
    vigenciaTexto: c.vigenciaTexto,
    vigenciaInicio: c.vigenciaInicio?.toISOString() ?? null,
    vigenciaFim: c.vigenciaFim?.toISOString() ?? null,
    previsto,
    faturado,
    saldoCalculado: saldo,
    saldoDocumento: texto(c.saldoTotal),
    percentual: previsto && faturado && Number(previsto) > 0 ? Math.round((Number(faturado) / Number(previsto)) * 1000) / 10 : null,
    ultimoFaturado: faturados.length ? faturados[faturados.length - 1].rotulo : null,
    conferido: c.previstoConferido && c.faturadoConferido,
    avisos: Array.isArray(c.avisos) ? (c.avisos as string[]) : [],
  }
}

export async function controleDoContrato(contratoId: string): Promise<{ controle: ControleSerializado; linhas: LinhaControle[] } | null> {
  const c = await prisma.controleContrato.findFirst({
    where: { contratoId },
    orderBy: [{ mesAno: 'desc' }, { mesMes: 'desc' }],
    include: { linhas: { orderBy: [{ tipo: 'asc' }, { posicao: 'asc' }] } },
  })
  if (!c) return null
  return {
    controle: serializar(c, null),
    linhas: c.linhas.map((l) => ({ tipo: l.tipo as LinhaControle['tipo'], rotulo: l.rotulo, valor: l.valor.toString() })),
  }
}

export async function listarControles(filtro: { mes?: string; clienteIds: string[] | null }): Promise<{ meses: string[]; mes: string | null; controles: ControleSerializado[] }> {
  const meses = (await prisma.controleContrato.findMany({ distinct: ['mesAno', 'mesMes'], select: { mesAno: true, mesMes: true }, orderBy: [{ mesAno: 'desc' }, { mesMes: 'desc' }] })).map(mesTexto)
  const mes = filtro.mes && meses.includes(filtro.mes) ? filtro.mes : (meses[0] ?? null)
  if (!mes) return { meses, mes: null, controles: [] }
  const [ano, m] = mes.split('-').map(Number)
  const onde = filtro.clienteIds === null ? {} : { clienteId: { in: filtro.clienteIds } }
  const lista = await prisma.controleContrato.findMany({
    where: { mesAno: ano, mesMes: m, ...onde },
    include: { linhas: { where: { tipo: 'faturado' }, orderBy: { posicao: 'asc' } } },
    orderBy: [{ sigla: 'asc' }, { contratoTexto: 'asc' }],
  })
  const clientes = new Map((await prisma.cliente.findMany({ where: { id: { in: lista.map((c) => c.clienteId).filter((x): x is string => !!x) } }, select: { id: true, nome: true } })).map((c) => [c.id, c.nome]))
  return { meses, mes, controles: lista.map((c) => serializar(c, c.clienteId ? (clientes.get(c.clienteId) ?? null) : null)) }
}
```

Rotas:

```ts
// src/app/api/contratos/[id]/controle/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { carregarContratoComAcesso } from '@/app/api/contratos/carregar'
import { controleDoContrato } from '@/lib/controles-contratos/consultas'

// Controle do faturamento vigente do contrato (spec 2026-09-29-controles-de-contratos §6.1).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const carregado = await carregarContratoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro
  const controle = await controleDoContrato(id)
  return controle ? NextResponse.json(controle) : NextResponse.json({ error: 'sem controle' }, { status: 404 })
}
```

```ts
// src/app/api/controle-faturamento/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { clienteIdsPermitidos } from '@/lib/visibilidade'
import { listarControles } from '@/lib/controles-contratos/consultas'

// Tela "Controle de faturamento" (spec 2026-09-29-controles-de-contratos §6.2): só os clientes que o usuário vê.
export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const mes = request.nextUrl.searchParams.get('mes') ?? undefined
  return NextResponse.json(await listarControles({ mes, clienteIds: await clienteIdsPermitidos(usuario) }))
}
```

Em `/api/biblioteca/[id]/route.ts`, depois de achar o arquivo:

```ts
  const permitido =
    arquivo.area === 'CONTROLES_CONTRATOS' && usuario.role !== 'admin'
      ? await (async () => {
          const controle = await prisma.controleContrato.findUnique({ where: { arquivoId: id }, select: { clienteId: true } })
          return !!controle?.clienteId && (await podeVerCliente(usuario, controle.clienteId))
        })()
      : podeVerArea(usuario.role, arquivo.area)
  if (!permitido) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
```

- [ ] **Step 4: Rodar e ver passar**; `npx tsc --noEmit`.

- [ ] **Step 5: Commit** — `feat(controles): consultas e API do controle do faturamento`.

---

### Task 6: Cartão no detalhe do contrato

**Files:**
- Create: `src/app/clientes/[id]/contratos/[contratoId]/cartao-controle.tsx` + `cartao-controle.test.tsx`
- Modify: `src/app/clientes/[id]/contratos/[contratoId]/page.tsx` (`<CartaoControle contratoId={contrato.id} />` logo depois de `<CartaoSaldo …/>`)

- [ ] **Step 1: Teste falhando** — `cartao-controle.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { CartaoControle } from './cartao-controle'

const controle = {
  arquivoId: 'ab1', mes: '2026-08', sigla: 'CGM', contratoTexto: 'CO 16/CGM/2024', contratoId: 'k1', clienteId: 'c1', clienteNome: null,
  termoTexto: 'T.A. 02', vigenciaTexto: '15/10/2025 à 14/10/2026', vigenciaInicio: null, vigenciaFim: null,
  previsto: '6110655.80', faturado: '5049644.59', saldoCalculado: '1061011.21', saldoDocumento: '1061011.21', percentual: 82.6,
  ultimoFaturado: 'AGO/2026', conferido: true, avisos: ['vigência com datas trocadas no documento: x'],
}
const responder = (ok: boolean, corpo: unknown) => {
  global.fetch = jest.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(corpo) })) as jest.Mock
}

it('mostra mês do controle, termo, vigência, previsto, faturado com %, saldo, meses e avisos', async () => {
  responder(true, { controle, linhas: [{ tipo: 'previsto', rotulo: 'MÊS 1', valor: '100' }, { tipo: 'faturado', rotulo: 'OUT/25-16DD', valor: '210974.73' }] })
  render(<CartaoControle contratoId="k1" />)
  expect(await screen.findByText(/Controle de ago\/2026/)).toBeInTheDocument()
  expect(screen.getByText(/T\.A\. 02/)).toBeInTheDocument()
  expect(screen.getByText('R$ 6.110.655,80')).toBeInTheDocument()
  expect(screen.getByText('R$ 5.049.644,59')).toBeInTheDocument()
  expect(screen.getByText('82,6%')).toBeInTheDocument()
  expect(screen.getByText('R$ 1.061.011,21')).toBeInTheDocument()
  expect(screen.getByText('OUT/25-16DD')).toBeInTheDocument()
  expect(screen.getByText(/datas trocadas/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /abrir o controle/i })).toHaveAttribute('href', '/api/biblioteca/ab1')
  expect(global.fetch).toHaveBeenCalledWith('/api/contratos/k1/controle')
})

it('sem controle: não mostra nada', async () => {
  responder(false, { error: 'sem controle' })
  const { container } = render(<CartaoControle contratoId="k1" />)
  await new Promise((r) => setTimeout(r, 0))
  expect(container).toBeEmptyDOMElement()
})

it('leitura não conferida: avisa e não mostra números', async () => {
  responder(true, { controle: { ...controle, conferido: false, previsto: null, faturado: null, percentual: null, saldoCalculado: null }, linhas: [] })
  render(<CartaoControle contratoId="k1" />)
  expect(await screen.findByText(/leitura não conferida/i)).toBeInTheDocument()
  expect(screen.queryByText('R$ 6.110.655,80')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar** — `cartao-controle.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, FileText } from 'lucide-react'
import { formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import type { ControleSerializado, LinhaControle } from '@/lib/controles-contratos/tipos'

// Cartão "Controle do faturamento" no detalhe do contrato (spec 2026-09-29-controles-de-contratos §6.1): o
// controle mensal da equipe do faturamento, lido do SharePoint. Sem controle, não aparece.

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const nomeDoMes = (mes: string) => {
  const [ano, m] = mes.split('-').map(Number)
  return `${MESES[m - 1]}/${ano}`
}
const pct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

export function CartaoControle({ contratoId }: { contratoId: string }) {
  const [dados, setDados] = useState<{ controle: ControleSerializado; linhas: LinhaControle[] } | null>(null)

  useEffect(() => {
    let ativo = true
    fetch(`/api/contratos/${contratoId}/controle`)
      .then((r) => (r.ok ? r.json() : null))
      .then((corpo) => ativo && corpo?.controle && setDados(corpo))
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [contratoId])

  if (!dados) return null
  const { controle: c, linhas } = dados
  const previstos = linhas.filter((l) => l.tipo === 'previsto')
  const faturados = linhas.filter((l) => l.tipo === 'faturado')
  const lado = previstos.length === faturados.length
  return (
    <section aria-label="Controle do faturamento" className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[0.95rem] font-semibold text-navy">Controle do faturamento</h2>
          <p className="text-xs text-mid-grey">
            Controle de {nomeDoMes(c.mes)}
            {c.termoTexto ? ` · ${c.termoTexto}` : ''}
            {c.vigenciaTexto ? ` · vigência ${c.vigenciaTexto}` : ''} — planilha da equipe do faturamento, lida do SharePoint
          </p>
        </div>
        <a href={`/api/biblioteca/${c.arquivoId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-navy hover:text-orange">
          <FileText className="size-3.5" />
          Abrir o controle (PDF)
        </a>
      </div>

      {!c.conferido && (
        <p className="flex items-center gap-2 rounded-xl border border-orange/30 bg-orange/5 px-3 py-2 text-xs text-orange-dark">
          <AlertCircle className="size-4 shrink-0" />
          Leitura não conferida: as contas deste controle não fecharam — confira no PDF.
        </p>
      )}

      {c.conferido && c.previsto && c.faturado && (
        <>
          <dl className="grid grid-cols-3 gap-3">
            <div>
              <dt className="text-xs text-mid-grey">Previsto no período</dt>
              <dd className="font-mono text-sm font-semibold text-navy">{formatarMoeda(c.previsto)}</dd>
            </div>
            <div>
              <dt className="text-xs text-mid-grey">Faturado</dt>
              <dd className="font-mono text-sm font-semibold text-navy">{formatarMoeda(c.faturado)}</dd>
              {c.percentual !== null && <dd className="text-xs text-mid-grey">{pct(c.percentual)}</dd>}
            </div>
            <div>
              <dt className="text-xs text-mid-grey">Saldo a faturar</dt>
              <dd className="font-mono text-sm font-semibold text-navy">{formatarMoeda(c.saldoCalculado)}</dd>
            </div>
          </dl>
          {c.percentual !== null && (
            <div className="h-2 overflow-hidden rounded-full bg-light-grey" aria-hidden="true">
              <div className={c.percentual > 100 ? 'h-full bg-orange' : 'h-full bg-navy'} style={{ width: `${Math.min(100, c.percentual)}%` }} />
            </div>
          )}
          {faturados.length > 0 && (
            <table className="w-full text-xs">
              <thead className="text-mid-grey">
                <tr>
                  <th className="py-1 text-left font-medium">Período</th>
                  {lado && <th className="py-1 text-right font-medium">Previsto</th>}
                  <th className="py-1 text-right font-medium">Faturado</th>
                </tr>
              </thead>
              <tbody>
                {faturados.map((l, i) => (
                  <tr key={`${l.rotulo}-${i}`} className={Number(l.valor) === 0 ? 'text-mid-grey' : 'text-foreground'}>
                    <td className="py-1">{l.rotulo}</td>
                    {lado && <td className="py-1 text-right font-mono">{formatarMoeda(previstos[i].valor)}</td>}
                    <td className="py-1 text-right font-mono">{formatarMoeda(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {c.avisos.length > 0 && (
        <ul className="space-y-1 text-xs text-orange-dark">
          {c.avisos.map((a) => (
            <li key={a}>⚠ {a}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

`page.tsx`: `import { CartaoControle } from './cartao-controle'` e `<CartaoControle contratoId={contrato.id} />` depois de `<CartaoSaldo contrato={contrato} />`.

- [ ] **Step 4: Rodar e ver passar** — `npx jest "src/app/clientes/\[id\]/contratos"`.

- [ ] **Step 5: Commit** — `feat(controles): cartão do controle do faturamento no detalhe do contrato`.

---

### Task 7: Tela "Controle de faturamento" e menu

**Files:**
- Create: `src/app/controle-faturamento/page.tsx` + `page.test.tsx`
- Modify: `src/components/nav-bar.tsx` + `nav-bar.test.tsx` (subitem "Controle de faturamento", `/controle-faturamento`, ícone `Receipt`, depois de "Tabela de preços")

- [ ] **Step 1: Teste falhando** — `page.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react'
import ControleFaturamentoPage from './page'

const base = {
  arquivoId: 'a', mes: '2026-08', clienteId: 'c1', termoTexto: 'T.A. 02', vigenciaTexto: '15/10/2025 à 14/10/2026',
  vigenciaInicio: null, vigenciaFim: null, saldoDocumento: null, ultimoFaturado: 'AGO/2026', avisos: [],
}
const controles = [
  { ...base, arquivoId: 'a1', sigla: 'CGM', clienteNome: 'Controladoria', contratoTexto: 'CO 16/CGM/2024', contratoId: 'k1', previsto: '1000', faturado: '830', saldoCalculado: '170', percentual: 83, conferido: true },
  { ...base, arquivoId: 'a2', sigla: 'SF', clienteNome: 'Fazenda', contratoTexto: 'CO 42/2024', contratoId: 'k2', previsto: '100', faturado: '120', saldoCalculado: '-20', percentual: 120, conferido: true },
  { ...base, arquivoId: 'a3', sigla: 'XYZ', clienteNome: null, clienteId: null, contratoTexto: 'CO 9/2024', contratoId: null, previsto: null, faturado: null, saldoCalculado: null, percentual: null, conferido: false },
]

beforeEach(() => {
  global.fetch = jest.fn((url: RequestInfo | URL) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(String(url).startsWith('/api/controle-faturamento') ? { meses: ['2026-08', '2026-07'], mes: '2026-08', controles } : { atualizadoEm: null }) })
  ) as jest.Mock
})

it('resumo, tabela com %, faturado acima do previsto e não conferido', async () => {
  render(<ControleFaturamentoPage />)
  expect(await screen.findByText('CO 16/CGM/2024')).toBeInTheDocument()
  expect(screen.getByText('3 contratos')).toBeInTheDocument()
  expect(screen.getByText('R$ 1.100,00')).toBeInTheDocument() // previsto dos conferidos
  expect(screen.getByText('83,0%')).toBeInTheDocument()
  expect(screen.getByText('120,0%')).toHaveClass('text-orange-dark')
  const linhaXyz = screen.getByText('CO 9/2024').closest('tr')!
  expect(within(linhaXyz).getByText(/não conferida/i)).toBeInTheDocument()
  expect(within(linhaXyz).getByText(/sem contrato no VerAI/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'CO 16/CGM/2024' })).toHaveAttribute('href', '/clientes/c1/contratos/k1')
})

it('troca o mês e busca', async () => {
  render(<ControleFaturamentoPage />)
  await screen.findByText('CO 16/CGM/2024')
  fireEvent.change(screen.getByRole('searchbox', { name: /buscar/i }), { target: { value: 'fazenda' } })
  expect(screen.queryByText('CO 16/CGM/2024')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText(/mês do controle/i), { target: { value: '2026-07' } })
  expect(global.fetch).toHaveBeenLastCalledWith('/api/controle-faturamento?mes=2026-07')
})
```

No `nav-bar.test.tsx`: `expect(screen.getByRole('link', { name: 'Controle de faturamento' })).toHaveAttribute('href', '/controle-faturamento')`.

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar** — `src/app/controle-faturamento/page.tsx`:

```tsx
'use client'

// "Controle de faturamento" (spec docs/superpowers/specs/2026-09-29-controles-de-contratos-design.md §6.2): o
// controle mensal da equipe do faturamento, contrato por contrato, lido do SharePoint.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, FileText, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { INPUT_BASE } from '@/lib/ui'
import { formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import { normalizarBusca } from '@/lib/tabela-precos/busca'
import { AtualizacaoSharepoint } from '@/components/sharepoint/atualizacao-sharepoint'
import type { ControleSerializado } from '@/lib/controles-contratos/tipos'
import { nomeDoMes } from '../clientes/[id]/contratos/[contratoId]/cartao-controle'

type Carga = { estado: 'carregando' } | { estado: 'erro' } | { estado: 'ok'; meses: string[]; mes: string | null; controles: ControleSerializado[] }
const pct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
const soma = (lista: ControleSerializado[], campo: 'previsto' | 'faturado') =>
  (lista.reduce((s, c) => s + Math.round(Number(c[campo] ?? 0) * 100), 0) / 100).toFixed(2)

export default function ControleFaturamentoPage() {
  const [mes, setMes] = useState<string | null>(null)
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' })
  const [termo, setTermo] = useState('')

  useEffect(() => {
    let ativo = true
    setCarga({ estado: 'carregando' })
    fetch(mes ? `/api/controle-faturamento?mes=${mes}` : '/api/controle-faturamento')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((corpo) => ativo && setCarga({ estado: 'ok', ...corpo }))
      .catch(() => ativo && setCarga({ estado: 'erro' }))
    return () => {
      ativo = false
    }
  }, [mes])

  const visiveis = useMemo(() => {
    if (carga.estado !== 'ok') return []
    const q = normalizarBusca(termo)
    return q ? carga.controles.filter((c) => normalizarBusca(`${c.sigla} ${c.clienteNome ?? ''} ${c.contratoTexto ?? ''}`).includes(q)) : carga.controles
  }, [carga, termo])
  const conferidos = visiveis.filter((c) => c.conferido)
  const previstoTotal = soma(conferidos, 'previsto')
  const faturadoTotal = soma(conferidos, 'faturado')

  return (
    <main className="mx-auto max-w-[110rem] space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Relatórios dos clientes</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy">Controle de faturamento</span>
        </nav>
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">Controle de faturamento</h1>
          <p className="text-sm text-mid-grey">Previsto × faturado de cada contrato, pelo controle mensal da equipe do faturamento</p>
          <AtualizacaoSharepoint url="/api/biblioteca/atualizacao" className="mt-1" />
        </div>
      </div>

      {carga.estado === 'carregando' && <div className="h-96 animate-pulse rounded-2xl bg-light-grey" aria-busy="true" />}
      {carga.estado === 'erro' && <p className="text-sm text-orange-dark">Não foi possível carregar o controle agora — tente de novo em instantes.</p>}
      {carga.estado === 'ok' && !carga.mes && (
        <p className="rounded-2xl border border-dashed border-border-grey p-8 text-center text-sm text-mid-grey">
          Nenhum controle lido ainda da pasta "Controles de Contratos" do SharePoint.
        </p>
      )}
      {carga.estado === 'ok' && carga.mes && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-mid-grey">
              Mês do controle
              <select className="rounded-lg border border-border-grey bg-white px-2 py-1 text-xs text-navy" value={carga.mes} onChange={(e) => setMes(e.target.value)}>
                {carga.meses.map((m) => (
                  <option key={m} value={m}>{nomeDoMes(m)}</option>
                ))}
              </select>
            </label>
            <label className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mid-grey" aria-hidden="true" />
              <input type="search" aria-label="Buscar cliente ou contrato" placeholder="Buscar cliente ou contrato" className={cn(INPUT_BASE, 'w-full pl-9')} value={termo} onChange={(e) => setTermo(e.target.value)} />
            </label>
          </div>

          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Contratos no controle', `${visiveis.length} contratos`],
              ['Previsto (conferidos)', formatarMoeda(previstoTotal)],
              ['Faturado (conferidos)', formatarMoeda(faturadoTotal)],
              ['Faturado do previsto', Number(previstoTotal) > 0 ? pct((Number(faturadoTotal) / Number(previstoTotal)) * 100) : '—'],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="card">
                <dt className="text-xs text-mid-grey">{rotulo}</dt>
                <dd className="font-mono text-lg font-semibold text-navy">{valor}</dd>
              </div>
            ))}
          </dl>

          <div className="overflow-x-auto rounded-2xl border border-border-grey bg-white">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="bg-light-grey/60 text-[0.7rem] tracking-wide text-mid-grey uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">Contrato</th>
                  <th className="px-3 py-2 text-left">Vigência</th>
                  <th className="px-3 py-2 text-right">Previsto</th>
                  <th className="px-3 py-2 text-right">Faturado</th>
                  <th className="px-3 py-2 text-right">%</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                  <th className="px-3 py-2 text-left">Último faturado</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {visiveis.map((c) => (
                  <tr key={c.arquivoId} className="border-t border-border-grey/60">
                    <td className="px-3 py-2">
                      <span className="font-semibold text-navy">{c.sigla}</span>
                      {c.clienteNome && <span className="block text-xs text-mid-grey">{c.clienteNome}</span>}
                    </td>
                    <td className="px-3 py-2">
                      {c.contratoId && c.clienteId ? (
                        <Link href={`/clientes/${c.clienteId}/contratos/${c.contratoId}`} className="font-mono text-xs text-navy hover:text-orange hover:underline">
                          {c.contratoTexto ?? '(sem número)'}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs">{c.contratoTexto ?? '(sem número)'}</span>
                      )}
                      {c.termoTexto && <span className="block text-xs text-mid-grey">{c.termoTexto}</span>}
                      {!c.contratoId && <span className="block text-xs text-orange-dark">sem contrato no VerAI</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-mid-grey">{c.vigenciaTexto ?? '—'}</td>
                    {c.conferido ? (
                      <>
                        <td className="px-3 py-2 text-right font-mono text-xs">{formatarMoeda(c.previsto)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{formatarMoeda(c.faturado)}</td>
                        <td className={cn('px-3 py-2 text-right font-mono text-xs', (c.percentual ?? 0) > 100 ? 'text-orange-dark' : 'text-navy')}>
                          {c.percentual !== null ? pct(c.percentual) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{formatarMoeda(c.saldoCalculado)}</td>
                      </>
                    ) : (
                      <td colSpan={4} className="px-3 py-2 text-right text-xs text-orange-dark">leitura não conferida — ver o PDF</td>
                    )}
                    <td className="px-3 py-2 text-xs">{c.ultimoFaturado ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <a href={`/api/biblioteca/${c.arquivoId}`} target="_blank" rel="noreferrer" aria-label={`PDF do controle ${c.contratoTexto ?? c.sigla}`} className="text-mid-grey hover:text-orange">
                        <FileText className="size-4" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  )
}
```

`nav-bar.tsx`: `Receipt` no import do lucide e `{ href: '/controle-faturamento', label: 'Controle de faturamento', icon: Receipt },` depois de "Tabela de preços".

- [ ] **Step 4: Rodar e ver passar**; `npx tsc --noEmit`.

- [ ] **Step 5: Commit** — `feat(controles): tela Controle de faturamento em Relatórios dos clientes`.

---

### Task 8: Conferência final e documentação

- [ ] Suítes tocadas + `tsc`; régua (`scripts/regua-controles.ts`) com o número final; passada do agendador no dev com código 0.
- [ ] Números reais no dev: quantos contratos ativos do VerAI ganharam controle; 3 exemplos conferidos à mão contra o PDF (CGM 16/2024, SF 42/2024, SMDET 07/2024).
- [ ] CLAUDE.md (seção da biblioteca Documentos: área CONTROLES_CONTRATOS, prova pela soma, régua) e Andamento deste plano.
- [ ] Commit `docs(controles): CLAUDE.md e andamento dos Controles de Contratos`.
