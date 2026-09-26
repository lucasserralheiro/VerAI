# Assistente de IA — sênior em contratos (fase 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O assistente aponta o que precisa de ação na carteira (alertas calculados), responde norma e processo pelo manual da equipe e pelos textos oficiais indexados, e compara documentos por fichas lidas uma vez de cada PDF do histórico.

**Architecture:** Regras de analista viram código: `alertas.ts` (ao lado do consolidado, fora do assistente) calcula os alertas e a projeção de saldo sem IA. O manual é um arquivo TS por tema; os textos oficiais entram numa tabela própria (`DocumentoReferencia`) e no índice com a origem `REFERENCIA`, cortados por artigo. Cada PDF do histórico ganha uma `FichaDocumento`: primeiro por regra, depois IA uma vez só para o que faltou, com verificação literal do trecho. Quatro ferramentas novas (`alertas`, `consultarManual`, `buscarNasNormas`, `fichasDoContrato`) e instrução nova.

**Tech Stack:** Next.js 15, AI SDK 7 (`generateObject`, `tool().toModelOutput`), Prisma 6/Postgres, Jest 30, tsx.

**Desenho:** `docs/superpowers/specs/2026-09-25-assistente-senior-design.md` (respostas do usuário no §10.4). Base: fase 1 (`docs/superpowers/plans/2026-09-25-assistente-base-economica.md`).

## Andamento

- (preencher ao concluir cada task)

## Global Constraints

- Limiares (§10.1, aprovados): vencimento crítico 30 / atenção 90 dias; saldo crítico se acaba em até 60 dias; janela da projeção 6 competências, mínimo 3 com lançamento; envio atrasado: lançamento criado há mais de 10 dias; competência sem faturamento a partir do dia 15 do mês seguinte. Todos num objeto só, `LIMIARES`.
- Ativo, vigência, valor, faturado e saldo vêm **só** de `consolidarContratos()`; faturamento **Cancelado** (`faturamentoCancelado`) fora de toda soma.
- Norma nunca de memória: só manual (`status: 'validado'` é regra; `rascunho` vai com aviso) e textos `REFERENCIA`. Rascunhos do manual marcam toda afirmação de norma com **[confirmar]** e não citam artigo que não esteja num texto oficial indexado.
- Ficha: texto integral pode ir à DeepSeek, uma vez por versão do PDF (decisão do usuário, §10.4). Todo campo da IA passa pela verificação literal (trecho na página citada; todo número do valor dentro do trecho) — senão é descartado ("não confirmado"). Número nunca vem de fora do texto.
- `buscarNosDocumentos` **exclui** `REFERENCIA`; `buscarNasNormas` busca **só** `REFERENCIA`.
- Produção roda deploy antigo: toda etapa nova no script do SharePoint só roda se a migração dela estiver aplicada no banco (mesmo desenho da guarda `MIGRACAO_DO_INDICE` da fase 1). Nada vai a produção sem deploy (decisão do usuário: "tudo menos o deploy").
- Migrações escritas à mão, carimbo maior que `20260925190000`; nunca `--shadow-database-url` apontando para banco de `.env*`. No `schema.prisma` (a outra sessão tem mudanças sem commit ali), colocar no stage só os próprios trechos (`git show HEAD:… | edição | git hash-object -w | git update-index --cacheinfo`).
- Estilo `src/lib/**`, `src/app/**`, `scripts/**`: 2 espaços, aspas simples, sem ponto e vírgula. Testes de servidor com `/** @jest-environment node */`.
- Commits só com os arquivos da task; sem push; mensagem termina com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Régua (`scripts/regua-assistente.ts`) antes e depois de mudar instrução ou ferramentas.

---

### Task 1: Regras dos alertas e projeção de saldo (puras)

**Files:**
- Create: `src/lib/assistente/manual/temas.ts`, `src/lib/relatorios-clientes/alertas.ts`, `src/lib/relatorios-clientes/alertas.test.ts`

**Interfaces:**
- Produces: `TEMAS_MANUAL` (8 temas) e `type TemaManual`; `LIMIARES`; `type CodigoAlerta`; `interface Alerta { codigo; nivel: 'critico'|'atencao'|'info'; clienteId; cliente; contratoId: string|null; contrato: string|null; titulo; detalhe; acao; temaManual: TemaManual|null; dias: number|null }`; `competenciasEncerradas(hoje: Date, n: number): { ano: number; mes: number }[]` (da mais recente para a mais antiga; a primeira é o mês anterior ao atual em São Paulo) e `diaEmSaoPaulo(hoje): number`; `projetarSaldo(entrada: { saldo: number; vigenciaFim: Date; faturamentos: FaturamentoAlerta[]; hoje: Date }): Projecao | null`; `alertasDoContrato(d: DadosAlerta, hoje: Date): Alerta[]`; `ordenarAlertas(a: Alerta[]): Alerta[]`.
- `FaturamentoAlerta = { competenciaAno: number|null; competenciaMes: number|null; valor: string|null; situacao: string|null; enviadoCliente: boolean|null; enviadoGfp: boolean|null; createdAt: Date }`.
- `DadosAlerta = { clienteId; cliente; contratoId; contrato: string|null; consolidado: Pick<ContratoConsolidado, 'ativo'|'rescindido'|'vazio'|'vigenciaFim'|'vencimento'|'situacaoDesatualizada'|'prorrogacaoEmAndamento'|'valorBase'|'saldo'>; faturamentos: FaturamentoAlerta[]; termosAssinadosSemPdf: number; termosSemTexto: number }`.

- [ ] **Step 1: Testes que falham** — `alertas.test.ts`, com `hoje = new Date('2026-09-26T15:00:00Z')` (última competência encerrada 08/2026) e um construtor `dados(over)` de `DadosAlerta` ativo, vigência 31/12/2027, `valorBase: '1200000'`, `saldo: { valorItens: '0', faturado: '0', saldo: '1200000', percentualFaturado: '0' }`, `vencimento: { nivel: 'ok', dias: 461 }`. Casos:
  - `competenciasEncerradas(hoje, 3)` → `[{2026,8},{2026,7},{2026,6}]`; `new Date('2026-10-01T02:00:00Z')` (ainda 30/09 em SP) → primeira é 08/2026.
  - `vence-sem-prorrogacao`: dias 30 → crítico; 31 → atenção; 90 → atenção; 91 → nada; com `prorrogacaoEmAndamento` → não sai este, sai `prorrogacao-sem-assinatura` (crítico em 20 dias); `rescindido` → nada; inativo → nada; `vazio` → nenhum alerta de nenhum tipo.
  - `situacao-desatualizada` (atenção, tema null); `ativo-sem-valor` (valorBase null); `faturado-acima-do-contratado` (saldo `'-5000.00'`, crítico, tema `aditivo-valor`).
  - Projeção: 5 competências de 03 a 07/2026 com R$ 120.000 (08/2026 sem lançamento), saldo R$ 480.000, vigência 30/06/2027 → `saldo-acaba-antes-da-vigencia`, atenção, detalhe exatamente `No ritmo de R$ 120.000,00/mês (média de 5 competências, 03/2026–07/2026), o saldo de R$ 480.000,00 dura ~4 meses, até ~01/2027, antes do fim da vigência (30/06/2027).`; saldo R$ 200.000 → crítico (dura < 60 dias); só 2 competências com lançamento → sem projeção; lançamento `Cancelado` não conta; vigência 30/11/2026 com saldo que dura 4 meses → nada.
  - `faturamento-nao-enviado`: lançamento de 08/2026 criado em 10/09/2026 sem `enviadoGfp` → atenção, tema `faturamento`, detalhe cita `08/2026`; criado em 20/09 (6 dias) → nada; cancelado → nada.
  - `competencia-sem-faturamento`: faturou 02–07/2026 (6 de 6), nada em 08/2026, hoje 26/09 → atenção; hoje 10/09 → nada (antes do dia 15); faturou só 2 das 6 → nada.
  - `termo-sem-pdf` (2 → info, detalhe "2 termos assinados sem PDF"); `termo-sem-texto` (1 → info).
  - `ordenarAlertas`: crítico antes de atenção antes de info; mesmo nível, menor `dias` primeiro (`null` por último); depois cliente.

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/lib/relatorios-clientes/alertas.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 3: Implementação**

`src/lib/assistente/manual/temas.ts`:

```ts
/** Temas do manual da equipe (spec fase 2 §4.1). Sem import: usado também pelas regras de alertas. */
export const TEMAS_MANUAL = ['prorrogacao', 'aditivo-valor', 'reajuste', 'apostilamento', 'rescisao', 'faturamento', 'sei', 'confere'] as const
export type TemaManual = (typeof TEMAS_MANUAL)[number]
```

`src/lib/relatorios-clientes/alertas.ts` — pontos obrigatórios:

```ts
export const LIMIARES = {
  venceCriticoDias: 30,
  venceAtencaoDias: 90,
  saldoCriticoDias: 60,
  janelaCompetencias: 6,
  minimoCompetenciasComLancamento: 3,
  envioAtrasadoDias: 10,
  competenciasParaEnvio: 3,
  diaCobrancaCompetencia: 15,
} as const

const MES_MEDIO_DIAS = 30.44
const DIA_MS = 86_400_000

export function diaEmSaoPaulo(hoje: Date): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(hoje).split('-').map(Number)
  return { ano, mes, dia }
}

export function competenciasEncerradas(hoje: Date, n: number): { ano: number; mes: number }[] {
  const { ano, mes } = diaEmSaoPaulo(hoje)
  return Array.from({ length: n }, (_, i) => {
    const total = ano * 12 + (mes - 1) - (i + 1)
    return { ano: Math.floor(total / 12), mes: (total % 12) + 1 }
  })
}
```

`projetarSaldo`: janela = `competenciasEncerradas(hoje, 6)`; soma por competência dos não cancelados; `comLancamento` = competências com soma > 0; se `< 3` → `null`; `ritmo = soma / comLancamento`; `meses = saldo / ritmo`; `fim = hoje + meses * 30.44 dias`; devolve `{ ritmo, competencias: comLancamento, de, ate, meses, fim, antesDaVigencia: fim < vigenciaFim, critico: meses * 30.44 <= 60 }` (`de`/`ate` = competência mais antiga/mais recente COM lançamento). Detalhe com `formatarMoeda` (`src/lib/relatorios-clientes/formatacao.ts`), meses arredondado (`Math.round`), `~mm/aaaa` do `fim`, vigência `dd/mm/aaaa` (`formatarData`).

`alertasDoContrato`: nada se `consolidado.vazio`; demais regras na ordem da tabela do §3.2 da spec, com os títulos:
`Vence em N dias sem prorrogação` · `Prorrogação sem assinatura — vence em N dias` · `Situação desatualizada no cadastro` · `Ativo sem valor cadastrado` · `Faturado acima do contratado` · `Saldo acaba antes do fim da vigência` · `Faturamento não enviado` · `Competência MM/AAAA sem faturamento` · `Termo assinado sem PDF` · `Termo escaneado (sem texto)`; e as ações do §3.2 (em `prorrogacao-sem-assinatura`, `Conseguir a assinatura antes de dd/mm/aaaa: sem ela a vigência não estende.` com a `vigenciaFim`). `dias`: vencimento para as regras de prazo; `Math.round(meses*30.44)` na projeção; `null` nas demais.

- [ ] **Step 4: Rodar e ver passar** — mesmo comando → PASS; `npx tsc --noEmit -p .` sem erro novo.
- [ ] **Step 5: Commit** — `git add src/lib/assistente/manual/temas.ts src/lib/relatorios-clientes/alertas.ts src/lib/relatorios-clientes/alertas.test.ts` · `feat(alertas): regras da carteira e projeção de saldo, sem IA`.

---

### Task 2: Alertas a partir do banco e ferramenta `alertas`

**Files:**
- Create: `src/lib/relatorios-clientes/alertas-banco.ts`, `src/lib/relatorios-clientes/alertas-banco.test.ts`, `src/lib/assistente/ferramentas/alertas.ts`, `src/lib/assistente/ferramentas/alertas.test.ts`
- Modify: `src/lib/assistente/ferramentas/index.ts`, `ferramentas/rotulos.ts`, `ferramentas/index.test.ts`

**Interfaces:**
- Consumes: Task 1; `consolidarContratos`; `auditarNoBanco(prisma, clienteIds, hoje)`; `linhaAssinada`.
- Produces: `alertasDosContratos(filtro: { clienteIds: string[] | null; clienteId?: string; contratoId?: string }, hoje: Date): Promise<Alerta[]>` (já ordenados); `alertasDaAuditoria(achados: Achado[], contratos: { id; clienteId; cliente; contrato: string|null }[]): Alerta[]`; ferramenta `alertas` com entrada `{ clienteId?, contratoId?, nivelMinimo?: 'critico'|'atencao'|'info' }`.

- [ ] **Step 1: Testes que falham**
  - `alertas-banco.test.ts` (mocks de `@/lib/prisma`, `consolidarContratos`, `auditarNoBanco`): filtra por `clienteIds` no `where` (`null` = sem filtro); consulta faturamentos só das 7 competências encerradas mais recentes; conta `termosAssinadosSemPdf` com `linhaAssinada` nas linhas CONTRATO/ADITIVO/PRORROGACAO sem `termoArquivoId`; conta `termosSemTexto` pelos `IndiceDocumento` `HISTORICO_TERMO` `sem_texto`; `alertasDaAuditoria` gera `cadastro-contrato-duplicado` etc. ligando ao contrato por `sigla|numeroTermo`, e **ignora** `ativo-sem-valor`; resultado ordenado.
  - `ferramentas/alertas.test.ts`: usuário restrito passa `clienteIds` de `clienteIdsPermitidos`; `clienteId` sem permissão → `{ erro: 'não encontrado' }`; `nivelMinimo: 'critico'` filtra; saída `{ total, porCodigo: Record<string, number>, alertas: Alerta[] (20 primeiros) }`; `compactar` produz `alertas (total N, mostrando M):` e cabeçalho `nivel|cliente|contrato|contratoId|titulo|detalhe|acao|tema`, mais a linha `por código: vence-sem-prorrogacao 3 · …`.
  - `index.test.ts`: lista de ferramentas ganha `alertas` (16).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementação** — `alertas-banco.ts` faz as 4 consultas (contratos com `cliente.siglaLegado`/`nome` e `historico { id, tipo, data, situacao, termoArquivoId }`; `consolidarContratos`; faturamentos `{ contratoId, competenciaAno, competenciaMes, valor, situacao, enviadoCliente, enviadoGfp, createdAt }` com `OR` das 7 competências; índices `sem_texto`) e `auditarNoBanco(prisma, idsDosClientes, hoje)` com os clientes dos contratos carregados; junta, chama `alertasDoContrato` por contrato + `alertasDaAuditoria`, e `ordenarAlertas`. Ferramenta em `ferramentas/alertas.ts` com `definirFerramenta`, descrição: `Alertas da carteira já calculados (vencimento sem prorrogação, prorrogação sem assinatura, saldo que acaba antes da vigência, faturamento não enviado ou faltando, cadastro a revisar), do mais grave ao menos grave, com o próximo passo. Sem cliente, cobre toda a carteira do usuário. Use para "o que precisa de ação", risco, pendência.` Registrar em `index.ts` e rótulo `Conferindo os alertas`.
- [ ] **Step 4: Rodar e ver passar** — `npx jest src/lib/relatorios-clientes/alertas src/lib/assistente/ferramentas`.
- [ ] **Step 5: Conferir no dev** — script descartável em `.superpowers/tmp/alertas.ts` imprimindo `textoParaModelo('alertas', …)` para SMIT e para a carteira (admin), com `npx dotenv -e .env.development -- npx tsx`. Ler 5 alertas contra a tela do contrato (vencimento, saldo, faturamentos).
- [ ] **Step 6: Commit** — `feat(assistente): ferramenta alertas com a carteira do usuário`.

---

### Task 3: Manual da equipe e `consultarManual`

**Files:**
- Create: `src/lib/assistente/manual/index.ts`, `src/lib/assistente/manual/manual.test.ts`, um arquivo por tema em `src/lib/assistente/manual/` (`prorrogacao.ts`, `aditivo-valor.ts`, `reajuste.ts`, `apostilamento.ts`, `rescisao.ts`, `faturamento.ts`, `sei.ts`, `confere.ts`), `src/lib/assistente/ferramentas/manual.ts`, `src/lib/assistente/ferramentas/manual.test.ts`
- Modify: `ferramentas/index.ts`, `ferramentas/rotulos.ts`, `ferramentas/index.test.ts`

**Interfaces:**
- Produces: `interface TemaDoManual { tema: TemaManual; titulo: string; palavrasChave: string[]; status: 'rascunho' | 'validado'; validadoPor: string | null; validadoEm: string | null; texto: string }`; `MANUAL: Record<TemaManual, TemaDoManual>`; ferramenta `consultarManual({ tema })` com `tema: z.enum(TEMAS_MANUAL)`.

- [ ] **Step 1: Testes que falham** — `manual.test.ts`: cada tema de `TEMAS_MANUAL` está em `MANUAL` com `tema` igual à chave, `titulo` e `palavrasChave` não vazios, `texto` ≤ 3.000 caracteres, `status` válido; `rascunho` ⇒ `validadoPor`/`validadoEm` nulos; todo `Art.`/`art.` citado no texto vem marcado `[confirmar]` na mesma frase. `ferramentas/manual.test.ts`: tema em rascunho devolve `{ tema, titulo, status: 'rascunho', aviso: 'rascunho em validação — não cite como regra', texto }`; validado devolve `validadoPor`/`validadoEm` e sem aviso; tema fora da lista falha no `entrada.parse`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementação** — cada arquivo de tema exporta `const tema: TemaDoManual` com `status: 'rascunho'`. Conteúdo de cada rascunho (markdown, ≤ 3.000 caracteres), escrito a partir do que o VerAI já sabe (regras do CLAUDE.md, das telas e do consolidado), com estas seções: **O que é**; **Como o VerAI trata** (regras do sistema, sem [confirmar] — são do código: ex. prorrogação só estende assinada, `linhaAssinada`, "prorrogação sem assinatura"; faturamento cancelado fora do faturado; principal × complementar; SEI por `SeiLink`); **Passo a passo na PRODAM** (itens de processo marcados **[confirmar]**); **Norma** (só a menção à lei/tema, com **[confirmar]** e sem número de artigo até o texto oficial estar indexado); **Onde fazer no VerAI** (tela). `index.ts` monta `MANUAL` a partir dos 8 imports. Ferramenta `consultarManual`, descrição: `Manual da equipe sobre processo e norma de um tema (prorrogação, aditivo de valor, reajuste, apostilamento, rescisão, faturamento, trâmite no SEI, ConfereAI). Tema em rascunho não é regra.`; rótulo `Consultando o manual`.
- [ ] **Step 4: Rodar e ver passar** — `npx jest src/lib/assistente/manual src/lib/assistente/ferramentas`.
- [ ] **Step 5: Commit** — `feat(assistente): manual da equipe em rascunho e consultarManual`.

---

### Task 4: Textos oficiais — tabela, origem `REFERENCIA`, corte por artigo e `buscarNasNormas`

**Files:**
- Create: `prisma/migrations/20260926100000_assistente_referencias/migration.sql`, `src/lib/assistente/ferramentas/normas.ts`, `src/lib/assistente/ferramentas/normas.test.ts`, `scripts/referencias-assistente.ts`
- Modify: `prisma/schema.prisma` (model `DocumentoReferencia`, enum `OrigemTrecho` + `REFERENCIA`), `src/lib/assistente/indexacao/fontes.ts` (+ teste), `src/lib/assistente/indexacao/trechos.ts` (+ teste, `cortarPorArtigo`), `src/lib/assistente/indexacao/sincronizar.ts` (usa `cortarPorArtigo` na `REFERENCIA`), `src/lib/assistente/busca.ts` (+ teste, `origens`/`excluirOrigens`), `src/lib/assistente/ferramentas/conteudo.ts` (+ teste: exclui `REFERENCIA`, `hrefDoTrecho`/`linkDoTrecho`), `ferramentas/index.ts`, `rotulos.ts`, `index.test.ts`

**Interfaces:**
- Produces: `DocumentoReferencia { id cuid; titulo; nomeArquivo; urlBlob; sha256 @unique; contentType; tamanhoBytes; createdAt; removidoEm? }`; `FiltroBusca.origens?: OrigemTrecho[]` e `excluirOrigens?: OrigemTrecho[]`; `cortarPorArtigo(paginas: PaginaDeTexto[], titulo: string): Trecho[] | null` (`null` = menos de 5 artigos, usar corte normal); ferramenta `buscarNasNormas({ consulta })`.

- [ ] **Step 1: Migração e schema** — SQL:

```sql
-- Textos oficiais (leis, decretos, regulamentos) consultados pelo assistente (spec fase 2 §4.2).
ALTER TYPE "OrigemTrecho" ADD VALUE 'REFERENCIA';
CREATE TABLE "DocumentoReferencia" (
  "id" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "nomeArquivo" TEXT NOT NULL,
  "urlBlob" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "tamanhoBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removidoEm" TIMESTAMP(3),
  CONSTRAINT "DocumentoReferencia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DocumentoReferencia_sha256_key" ON "DocumentoReferencia"("sha256");
```

`npx dotenv -e .env.development -- npx prisma migrate deploy` e `npm run dev:generate` (DLL em uso só falha na troca da DLL; conferir `grep REFERENCIA node_modules/.prisma/client/index.d.ts`).

- [ ] **Step 2: Testes que falham**
  - `trechos.test.ts`: texto com `Art. 1º …` a `Art. 6º …` vira um trecho por artigo com prefixo `[Lei 14.133/2021 — Art. 3º]`; artigo com mais de 1.500 caracteres é repartido mantendo o prefixo em cada parte; texto com 4 artigos → `null`.
  - `fontes.test.ts`: `documentoReferencia.findMany({ where: { removidoEm: null } })` vira fonte `REFERENCIA` com `clienteId`/`contratoId` nulos, `tipo` pela extensão (`pdf|docx|html|txt`), `nomeArquivo` = `titulo`; com `clienteId` no filtro, não consulta referências.
  - `busca.test.ts`: `origens: ['REFERENCIA']` gera `AND t.origem IN (...)`; `excluirOrigens: ['REFERENCIA']` gera `AND t.origem NOT IN (...)`.
  - `conteudo.test.ts`: `buscarNosDocumentos` chama `buscarTrechos` com `excluirOrigens: ['REFERENCIA']`; `hrefDoTrecho` de `REFERENCIA` é `''` e `linkDoTrecho` é `null`.
  - `normas.test.ts`: `buscarNasNormas` chama `buscarTrechos` com `origens: ['REFERENCIA']` e limite 8; compacto em blocos `[<título — Art. N>]` + citação; sem resultado → `total: 0` e `aviso: 'Não está na base de normas do VerAI.'`.
- [ ] **Step 3: Rodar e ver falhar.**
- [ ] **Step 4: Implementação** — `cortarPorArtigo`: junta as páginas; separa em `/(?=^\s*Art\.\s*\d+)/m`; se < 5 partes com `Art.`, `null`; cada artigo `[titulo — Art. N]` + texto, partido por `cortarEmTrechos` quando > 1.500 (reaplicando o prefixo); `pagina` = página onde o artigo começa. Em `indexarFonte`, `fonte.origem === 'REFERENCIA'` tenta `cortarPorArtigo(paginas, fonte.nomeArquivo)` antes do corte normal. `montarConsultaTrechos` acrescenta as duas condições com `Prisma.join` e cast `::"OrigemTrecho"`. `buscarNasNormas` descrição: `Procura nos textos oficiais indexados (leis, decretos, regulamento interno da PRODAM) e devolve o artigo citável. Use para prazo, limite, prorrogação, reajuste, rescisão. Se não achar, a norma não está na base.`; rótulo `Consultando as normas`.
  `scripts/referencias-assistente.ts --pasta=<pasta> [--aplicar]` (carrega `.env.local` como o do SharePoint): lista `pdf|docx|html|txt` da pasta; título = nome sem extensão; por arquivo calcula sha256; novo → `putR2('referencias/<id>-<nomeSeguro>', buffer, contentType)` e `create`; sha existente removido → reativa; arquivo que sumiu da pasta → `removidoEm = now()`. Sem `--aplicar` só lista. Com `--aplicar`, termina com `sincronizarIndice({ limite: 100 })` e imprime o resumo.
- [ ] **Step 5: Rodar e ver passar** — `npx jest src/lib/assistente`.
- [ ] **Step 6: Commit** — schema só com os próprios trechos (ver Global Constraints) + migração + arquivos da task · `feat(assistente): textos oficiais indexados por artigo e buscarNasNormas`.

---

### Task 5: Fichas — texto das páginas, regras de palavra-chave e verificação literal

**Files:**
- Create: `src/lib/assistente/fichas/campos.ts`, `fichas/paginas.ts`, `fichas/regras.ts`, `fichas/verificar.ts` e os testes `fichas/paginas.test.ts`, `fichas/regras.test.ts`, `fichas/verificar.test.ts`

**Interfaces:**
- Produces: `NOMES_CAMPOS = ['objeto','valorTotal','vigenciaInicio','vigenciaFim','vigenciaMeses','reajusteIndice','reajustePeriodicidade','garantia','multas','prazoPagamento','medicao','alteracoes'] as const`; `type NomeCampo`; `interface CampoFicha { valor: string; pagina: number | null; trecho: string | null; fonte: 'regra' | 'ia' }`; `type CamposFicha = Partial<Record<NomeCampo, CampoFicha>>`; `juntarTrechos(trechos: { pagina: number|null; ordem: number; texto: string }[]): PaginaDeTexto[]` (desfaz a sobreposição de 200 caracteres); `camposPorRegra(paginas: PaginaDeTexto[], tipoLinha: string): CamposFicha`; `verificarCampo(campo: CampoFicha, paginas: PaginaDeTexto[]): boolean`.

- [ ] **Step 1: Testes que falham**
  - `paginas.test.ts`: `cortarEmTrechos` de uma página de 4.000 caracteres seguido de `juntarTrechos` devolve o texto limpo original; páginas separadas continuam separadas e em ordem.
  - `regras.test.ts` (trechos reais curtos, sem PDF): `reajusteIndice` acha `IPC-FIPE`, `IPCA-E` (antes de `IPCA`), `IGP-M`, `ICTI`, `IST` com página e janela de até 200 caracteres; `garantia` acha `caução de 5%` → `valor: 'caução, 5%'`; `prazoPagamento` acha `em até 30 (trinta) dias … pagamento` → `'30 dias'`; objeto/valor/vigência vêm de `extrairCampos` (`src/lib/importacao-sharepoint/texto.ts`) com `valor` do `valorTotal` como `R$ 4.874.940,85` e o trecho achado na página; texto sem nada → `{}`.
  - `verificar.test.ts`: trecho presente na página (espaços normalizados) e números do valor dentro do trecho → `true`; trecho em outra página → `false`; valor `R$ 1.200,00` com trecho que diz `R$ 1.300,00` → `false`; campo de regra com `trecho: null` → `true` (regra determinística); campo da IA sem trecho → `false`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementação** — `juntarTrechos`: agrupa por página em ordem; ao juntar o seguinte, procura a maior sobreposição (até 250 caracteres) entre o fim do acumulado e o início do próximo e cola sem repetir. Regras com janela `texto.slice(max(0,i-100), i+100)` para o `trecho`. `verificarCampo`: `normalizar = s.replace(/\s+/g, ' ').trim()`; página certa (ou qualquer página quando `pagina` null e fonte regra); `digitos(valor)` = grupos `\d+` do valor; todos presentes em `digitos(trecho)`.
- [ ] **Step 4: Rodar e ver passar** — `npx jest src/lib/assistente/fichas`.
- [ ] **Step 5: Régua de cobertura (sem gravar)** — script descartável `.superpowers/tmp/cobertura-fichas.ts`: para cada `IndiceDocumento` `ok` de `HISTORICO_*` no dev, lê `TrechoDocumento`, `juntarTrechos`, `camposPorRegra`, e imprime por campo `achado por regra × faltando`. Anotar no Andamento.
- [ ] **Step 6: Commit** — `feat(assistente): fichas por regra com trecho e verificação literal`.

---

### Task 6: Fichas — IA uma vez, gravação e scripts

**Files:**
- Create: `prisma/migrations/20260926110000_assistente_fichas/migration.sql`, `src/lib/assistente/fichas/ia.ts`, `fichas/gerar.ts`, testes `fichas/ia.test.ts`, `fichas/gerar.test.ts`, `scripts/fichas-documentos.ts`
- Modify: `prisma/schema.prisma` (model `FichaDocumento`), `src/lib/assistente/indexacao/apos-sincronizacao.ts` (+ teste: etapa das fichas com guarda própria), `scripts/sincronizar-sharepoint.ts`

**Interfaces:**
- Consumes: Task 5; `modeloDoAssistente()`; `configuracaoDoAssistente()`.
- Produces: `FichaDocumento { id cuid; origem OrigemTrecho; origemId; versao String?; campos Json; status String /* ok|parcial|sem_texto|erro */; mensagem String?; modelo String?; tokensEntrada Int?; tokensSaida Int?; geradaEm DateTime @default(now()) @updatedAt? — usar @default(now()) e atualizar à mão; @@unique([origem, origemId]) }`; `lerComIa(entrada: { paginas: PaginaDeTexto[]; faltando: NomeCampo[]; tipoLinha: string; modelo?: LanguageModel }): Promise<{ campos: CamposFicha; tokensEntrada?: number; tokensSaida?: number }>`; `gerarFichasPendentes(opcoes: { limite?: number; comIa?: boolean; modelo?: LanguageModel }): Promise<{ porRegra: number; comIa: number; parciais: number; semTexto: number; erros: number; tokens: number; restantes: number }>`; `MIGRACAO_DAS_FICHAS = '20260926110000_assistente_fichas'`; `atualizarFichasDoAssistente(deps?)` com a mesma forma de `atualizarIndiceDoAssistente` (nunca lança, guarda pela migração).

- [ ] **Step 1: Migração e schema** — `CREATE TABLE "FichaDocumento" (…)` com os campos acima, `"campos" JSONB NOT NULL`, `"origem" "OrigemTrecho" NOT NULL`, índice único `("origem","origemId")`. Aplicar no dev e gerar o client.
- [ ] **Step 2: Testes que falham**
  - `ia.test.ts` com `MockLanguageModelV4` (`doGenerate` devolvendo JSON): pede só os campos `faltando`; texto até 60.000 caracteres vai inteiro; acima disso vão as páginas 1–2 mais as páginas com as palavras-chave dos campos faltantes (`reajust`, `garanti`, `multa`, `pagamento`, `mediç`, `vigênc`); campo que não passa em `verificarCampo` é descartado; a instrução é constante (o texto vai na mensagem, não no `system`).
  - `gerar.test.ts` (mocks de prisma e `lerComIa`): índice `ok` sem ficha → gera; ficha com `versao` igual à do índice → não refaz; versão nova → refaz; índice `sem_texto` → ficha `sem_texto` sem chamar IA; todos os campos por regra → não chama IA; `comIa: false` → `parcial` sem IA; erro da IA → `erro` com mensagem e segue o lote; respeita `limite` e conta `restantes`.
  - `apos-sincronizacao.test.ts`: `atualizarFichasDoAssistente` pula com `fichas: pulado — migração 20260926110000_assistente_fichas não aplicada neste banco`; sem chave de IA roda só regras e avisa `(sem IA: chave não configurada)`; linha `fichas: por regra N · com IA M · parciais P · sem texto S · erros E · tokens T · pendentes R`.
- [ ] **Step 3: Rodar e ver falhar.**
- [ ] **Step 4: Implementação** — `ia.ts` com `generateObject({ model, system: INSTRUCAO_FICHA, prompt, schema })`, `schema` zod com um objeto por campo faltante `{ valor: string, pagina: number, trecho: string }.nullable()` (`alteracoes`: `valor` com até 5 itens curtos separados por `; `); `INSTRUCAO_FICHA` fixa: extrair só o que está escrito, trecho copiado literalmente (até 200 caracteres), página do marcador `=== página N ===`, `null` quando não achar. `gerar.ts`: busca índices `HISTORICO_PROPOSTA`/`HISTORICO_TERMO` com status `ok`/`sem_texto` e as fichas existentes; tipo da linha por `historicoContrato.findMany({ id in origemIds })`; texto por `trechoDocumento.findMany({ where: { origem, origemId }, orderBy: [{ pagina }, { ordem }] })` → `juntarTrechos`; `camposPorRegra`; `faltando` = campos sem valor (e `alteracoes` só em ADITIVO/PRORROGACAO); `lerComIa` quando `comIa` e há `faltando`; `status`: `ok` se nada falta, `parcial` se falta algo; `upsert` com `versao` do índice, `modelo` (`configuracaoDoAssistente()?.modelo`), tokens e `geradaEm: new Date()`.
  `scripts/fichas-documentos.ts [--sem-ia] [--limite=N] [--aplicar]`: carrega `.env.local`; sem `--aplicar` roda a cobertura por campo sem gravar (mesma saída da Task 5 Step 5); com `--aplicar` chama `gerarFichasPendentes` em rodadas de 50 até `restantes = 0`, imprimindo cada rodada e o total de tokens.
  `sincronizar-sharepoint.ts`: depois da linha do índice, `console.log(await atualizarFichasDoAssistente())` (só com `--aplicar`).
- [ ] **Step 5: Rodar e ver passar** — `npx jest src/lib/assistente`.
- [ ] **Step 6: Commit** — schema só com os próprios trechos · `feat(assistente): ficha de cada PDF do histórico, IA uma vez com verificação`.
- [ ] **Step 7: Carga no dev** — `npx dotenv -e .env.development -- npx tsx scripts/fichas-documentos.ts --aplicar` (`run_in_background`; ~800 PDFs, estimativa ~5 mil tokens de entrada cada para os que chegam à IA). Anotar no Andamento: por regra, com IA, parciais, erros, tokens. Conferir 5 fichas à mão contra o PDF (valor, vigência, reajuste, página).

---

### Task 7: Ferramenta `fichasDoContrato`

**Files:**
- Create: `src/lib/assistente/ferramentas/fichas.ts`, `src/lib/assistente/ferramentas/fichas.test.ts`
- Modify: `ferramentas/index.ts`, `rotulos.ts`, `index.test.ts`

**Interfaces:**
- Produces: ferramenta `fichasDoContrato({ contratoId })` → `{ contrato, linhas: { tipo, numero, assinadoEm, proposta: FichaResumo, termo: FichaResumo }[] }` com `FichaResumo = { arquivo: string; situacao: 'ok'|'parcial'|'sem ficha'|'escaneado'|'erro'; campos: Record<string, { valor; pagina }>; naoConfirmados: string[] } | null`.

- [ ] **Step 1: Testes que falham** — permissão (cliente não visível → `não encontrado`); linhas na ordem do histórico (data, createdAt); PDF sem ficha → `sem ficha`; índice `sem_texto` → `escaneado`; campo ausente de ficha `parcial` → em `naoConfirmados`; compacto por linha: `ADITIVO 2 (assinado 10/05/2025) — termo TA_02.pdf: valorTotal R$ 1.200.000,00 (p. 2) · vigenciaFim 30/06/2027 (p. 3) · não confirmado: multas`; `index.test.ts` passa a listar **19** ferramentas (as 15 + `alertas`, `consultarManual`, `buscarNasNormas`, `fichasDoContrato`; a spec §7 fala em 18 — registrar a diferença no Andamento).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementação** — `contrato.findUnique` com `clienteId`, `numeroTermo` e `historico` (ordem `data asc, createdAt asc`, `SELECAO_ANEXOS`); `podeVerCliente`; `fichaDocumento.findMany` e `indiceDocumento.findMany` pelos ids das linhas nas duas origens; monta e compacta. Descrição: `Fichas já lidas dos PDFs do histórico de UM contrato (proposta e termo de cada linha: objeto, valor, vigência, reajuste, garantia, multas, pagamento, medição e, em aditivo, o que mudou), com página. Use para "o que mudou", comparar proposta × termo ou aditivos. Para o texto exato da cláusula, use buscarNosDocumentos.`; rótulo `Lendo as fichas do contrato`.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `feat(assistente): fichasDoContrato para comparar termos e aditivos`.

---

### Task 8: Instrução nova

**Files:**
- Modify: `src/lib/assistente/instrucoes.ts`, `src/lib/assistente/agente.test.ts`

- [ ] **Step 1: Teste que falha** — em `agente.test.ts`: `INSTRUCOES_SISTEMA` tem até 4.000 caracteres; cita `alertas`, `consultarManual`, `buscarNasNormas`, `fichasDoContrato`, `buscarNosDocumentos`; tem `Atenção` e `Próximo passo`; mantém `Já identificados`, `tipo:id` e `sei:`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementação** — o texto do §6 da spec, acrescido do que a fase 1 já garante: resultados em texto compacto (`|`); regra 4 com "Já identificados"; links `[texto](tipo:id)` com a lista de tipos e "link pronto: copie sem trocar o tipo"; regra 3 com os avisos em palavras. Instrução continua constante (cache).
- [ ] **Step 4: Rodar e ver passar** — `npx jest src/lib/assistente`.
- [ ] **Step 5: Commit** — `feat(assistente): instrução de analista sênior (atenção, próximo passo, fontes)`.

---

### Task 9: Régua com as perguntas novas e documentação

**Files:**
- Modify: `scripts/regua-assistente.ts`, `CLAUDE.md` (seção do assistente — só o próprio trecho no stage), `docs/superpowers/specs/2026-09-25-assistente-senior-design.md` (Status), este plano (Andamento)

- [ ] **Step 1: Perguntas** — acrescentar a `PERGUNTAS`: `O que precisa de ação no SMIT?`, `O contrato TC 52/SMIT/2024 corre risco de faltar saldo?`, `Posso prorrogar o TC 45/SMIT/2023 mais uma vez?`, `O que o último aditivo do TC 13/SMIT/2024 mudou?` (índices 8–11; a pergunta 5 continua sendo a continuação da 4).
- [ ] **Step 2: Rodar no dev** — `npx dotenv -e .env.development -- npx tsx scripts/regua-assistente.ts --com-ia --salvar --comparar=.superpowers/regua-assistente/2026-09-25T23-36-28-957Z-com-ia.json` (a comparação cobre as 8 primeiras). Conferir: a 9 chama `alertas`; a 10 traz a conta da projeção; a 11 chama `consultarManual` e diz que o tema está em rascunho e/ou que a norma não está na base (sem referências carregadas); a 12 chama `fichasDoContrato` e cita página. Custo das 8 antigas não pode subir mais de 10% na mediana.
- [ ] **Step 3: CLAUDE.md** — na seção do assistente: alertas em `src/lib/relatorios-clientes/alertas.ts` (regra única, limiares em `LIMIARES`, telas podem usar); manual em `src/lib/assistente/manual/` (rascunho × validado; a equipe valida trocando o `status`); textos oficiais por `scripts/referencias-assistente.ts --pasta=… --aplicar` (origem `REFERENCIA`, fora de `buscarNosDocumentos`); fichas (`FichaDocumento`, regra → IA uma vez → verificação literal; `scripts/fichas-documentos.ts`; etapa no fim da sincronização com guarda pela migração). Design/plano da fase 2.
- [ ] **Step 4: Spec e plano** — Status da spec: implementada no dev, com os números; Andamento do plano com commits, cobertura das fichas, tokens gastos e régua.
- [ ] **Step 5: Commit** — `docs(assistente): fase 2 — alertas, manual, normas e fichas`.

**Pendências que não são desta implementação:** arquivos oficiais (equipe) → rodar `scripts/referencias-assistente.ts`; validação dos 8 temas do manual (equipe); produção junto com o deploy (migrações `20260926100000` e `20260926110000`, fichas em produção ~6 milhões de tokens uma vez).
