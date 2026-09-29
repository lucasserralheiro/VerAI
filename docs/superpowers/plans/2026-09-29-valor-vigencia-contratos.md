# Valor, vigência e assinatura com prova — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O VerAI preenche sozinho o valor, a vigência e a evidência de assinatura das linhas do histórico que estão vazias — só quando há prova (termo em PDF + outra fonte independente, ou controle do faturamento para a vigência) — e mostra de onde veio cada número.

**Architecture:** Três fontes já no dev (fichas dos termos/propostas, controles do faturamento, biblioteca Documentos) + a planilha de contratos, que passa a ser lida pelo leitor da área `PLANILHA_CONTRATOS` (`LinhaPlanilhaContratos`). Regras puras (`categoria`, `extenso`, `decidir`) decidem linha a linha; `aplicarValoresProvados` coleta, decide e grava **só em campo vazio**, registrando a origem em `OrigemCampoHistorico` (tabela nova). Roda no fim do agendador (guarda pela migração) e por script (com simulação). A seção do histórico no detalhe do contrato mostra a origem.

**Tech Stack:** Prisma 6/Postgres, Next.js 15, React 19, Jest, exceljs.

## Andamento

- (preencher ao executar)

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-29-valor-vigencia-contratos-design.md` — **o §0 prevalece**.
- Direto na `main`; commit com `"$TEMP/claude-varredura/commit.sh" "<mensagem>" <arquivos…>` (índice próprio). **Mensagem sem `Co-Authored-By` nem menção a IA** (regra do usuário).
- **Só tabelas novas** (agendador contra produção com o cliente Prisma da pasta). Migração `20260929170000_valor_vigencia`; `MIGRACAO_DA_BIBLIOTECA` e `MIGRACAO_DOS_VALORES` apontam para ela. Conferência do SQL só com banco descartável.
- **Nunca troca campo preenchido**: toda gravação é `updateMany` com a condição "campo ainda vazio".
- Dinheiro: string decimal; comparação em centavos.
- Linha ↔ termo: CONTRATO = termo nº 0; ADITIVO/PRORROGACAO = primeiro número do `numero` ("TA 02", "TA 002/2025" → 2). Casamento só quando único.

---

### Task 1: Banco

**Files:** `prisma/schema.prisma`; `prisma/migrations/20260929170000_valor_vigencia/migration.sql`; `src/lib/biblioteca/etapa.ts` (`MIGRACAO_DA_BIBLIOTECA`).

- [ ] Models:

```prisma
// Planilha "Contratos Receita" (biblioteca Documentos, área PLANILHA_CONTRATOS) — uma linha por termo, como
// está na aba BaseContratos. Fonte de prova do valor/vigência (spec 2026-09-29-valor-vigencia-contratos §0).
model LinhaPlanilhaContratos {
  id                 String    @id @default(cuid())
  arquivoId          String
  linha              Int
  sigla              String
  contratoTexto      String
  // "SIGLA|nº ano" — a mesma chave da sincronização do SharePoint.
  chave              String?
  termoTexto         String?
  // 0 = contrato inicial; n = nº do termo; null = sem número.
  termoNumero        Int?
  tipoTermo          String?
  valor              Decimal?  @db.Decimal(14, 2)
  inicio             DateTime?
  fim                DateTime?
  statusFormalizacao String?

  @@index([chave])
  @@index([arquivoId])
}

// De onde veio o valor/vigência/assinatura que o VerAI gravou sozinho numa linha do histórico. Tabela à parte
// (e não colunas em HistoricoContrato) porque o agendador roda contra produção com o cliente Prisma da pasta.
model OrigemCampoHistorico {
  id          String   @id @default(cuid())
  historicoId String
  // valor | vigencia | assinatura
  campo       String
  origem      String
  prova       Json
  gravadoEm   DateTime @default(now())

  @@unique([historicoId, campo])
  @@index([historicoId])
}
```

- [ ] SQL correspondente (CREATE TABLE + índices; sem FK). `prisma validate`; `migrate diff` contra `verai_shadow_valores` (descartável) → vazio; `migrate deploy` no dev; `generate`.
- [ ] `MIGRACAO_DA_BIBLIOTECA = '20260929170000_valor_vigencia'` (o leitor da planilha grava na tabela nova).
- [ ] `npx jest src/lib/biblioteca` → PASS. Commit `feat(valores): tabelas da planilha de contratos e da origem dos campos do histórico`.

### Task 2: Leitor da planilha de contratos

**Files:** `src/lib/planilha-contratos/leitura.ts` + `.test.ts`; `src/lib/planilha-contratos/leitor.ts` + `.test.ts`; `src/lib/biblioteca/registro-leitores.ts`.

**Interfaces:** `lerPlanilhaDeContratos(conteudo: Buffer): Promise<{ linhas: LinhaPlanilhaLida[] } | { erro: string }>`; `LinhaPlanilhaLida { linha; sigla; contratoTexto; chave: string | null; termoTexto: string | null; termoNumero: number | null; tipoTermo: string | null; valor: string | null; inicio: Date | null; fim: Date | null; statusFormalizacao: string | null }`; `criarLeitorDaPlanilha(deps)`/`lerPlanilhaDeContratosArea: LeitorDeArea`.

Regras: aba achada pelo cabeçalho (`CLIENTE`, `CONTRATO`, `TERMO ADITIVO`, `TIPO DE TERMO`, `INICIO CONTRATO`, `TERMINO CONTRATO`, `VALOR ADITIVO / CONTRATO…`, `STATUS FORMALIZACAO` — comparação sem acento e sem caixa; `CLIENTE` por igualdade para não pegar "Cliente Antes"). Termo "-"/vazio: tipo com "inicial" → 0, senão `null`. Valor: número → 2 casas; texto "442.774,40 " → `valorBr`. Datas → UTC meia-noite. Chave = `SIGLA|chaveNumerica(contrato)`.

Testes (planilha mínima montada com exceljs): contrato inicial (termo 0, chave "SMTUR|1 2023"), aditivo "TA 01" (termo 1, valor numérico), valor em texto brasileiro, "Cliente Antes" ignorado, aba achada pelo cabeçalho, erro sem cabeçalho. Leitor: grava as linhas do arquivo (apaga as anteriores do mesmo arquivo), relê só arquivo novo/mudado ou em releitura, apaga linhas de arquivo que saiu; linha do log `planilha de contratos: <n> linhas de <m> arquivo(s)`.

- [ ] TDD; `npx jest src/lib/planilha-contratos`; carga real: a planilha real tem de dar **1.377 linhas**. Commit `feat(valores): leitor da planilha de contratos na biblioteca Documentos`.

### Task 3: Regras puras — categoria, extenso e decisão

**Files:** `src/lib/valores-contratos/categoria.ts`, `extenso.ts`, `decidir.ts` + testes.

**Interfaces:**
- `categoriaDoValor(trecho: string, valor: string, tipoLinha: string): 'total' | 'novo-total' | 'periodo' | 'diferenca' | 'mensal' | 'inicial' | 'ambiguo'` — janela de até 120 caracteres **antes** da primeira ocorrência do número no trecho; vale a palavra-chave **mais próxima** do número. `aceitaCategoria(tipoLinha, categoria)`: CONTRATO → total; PRORROGACAO → total, novo-total, periodo; ADITIVO → novo-total.
- `extensoDoTrecho(trecho: string, valor: string): 'igual' | 'diferente' | null` — acha "(… reais …)" logo depois do número e compara (null quando não há extenso ou não dá para ler).
- `decidirLinha(e: EntradaLinha): DecisaoLinha` com
  - `EntradaLinha { tipo; atual: { valor: string | null; dataInicio: Date | null; dataVencimento: Date | null; data: Date | null; situacao: string | null }; ficha: { valor: string; trecho: string | null; pagina: number | null } | null; fichaFim: Date | null; proposta: string | null; planilha: { valor: string | null; inicio: Date | null; fim: Date | null; concluida: boolean; simples: boolean; linha: number } | null; controle: { previsto: string; inicio: Date | null; fim: Date | null; mes: string; arquivoId: string } | null; anterior: string | null }`
  - `DecisaoLinha { valor?: Gravacao<string>; vigencia?: Gravacao<{ inicio: Date | null; fim: Date }>; assinatura?: Gravacao<string>; avisos: string[] }`, `Gravacao<T> { dado: T; origem: string; prova: Record<string, unknown> }`.

Regras (spec §0 e §5):
- **valor** (só se `atual.valor` vazio): com `ficha` e categoria aceita → provas = extenso igual, planilha simples igual, controle igual, proposta igual (CONTRATO), cadeia ("passa de X" = `anterior`); contradição = extenso diferente ou planilha simples diferente → não grava + aviso; ≥1 prova e sem contradição → grava, origem `TERMO+<PROVAS>`. Sem ficha (ou categoria recusada): planilha simples **e** controle iguais → grava, origem `PLANILHA+CONTROLE`. Controle diferente do valor gravado/lido → aviso "o faturamento usa R$ X (controle de <mês>)".
- **vigencia** (só se `atual.dataVencimento` vazio): controle com fim → se `fichaFim` existe e difere → aviso; senão grava `{ inicio: atual.dataInicio ?? controle.inicio, fim: controle.fim }`, origem `CONTROLE` (+`TERMO` se `fichaFim` igual). Sem controle: planilha com fim (mesmo termo) → mesma regra, origem `PLANILHA`.
- **assinatura** (só ADITIVO/PRORROGACAO, `data` e `situacao` vazios): controle → "Assinado (controle do faturamento)"; planilha concluída → "Assinado (planilha: contratação concluída)".

Testes com trechos reais (da varredura): "VALOR TOTAL ESTIMADO DA SUPRESSÃO: R$ 72.032,85" → diferenca (não grava); "o valor do contrato passa para R$ 97.181,62 (noventa e quatro mil…)" → novo-total mas extenso diferente → aviso e não grava; "O valor mensal … perfazendo o valor total de R$ 2.881.634,64" → total; "VALOR INICIAL DO CONTRATO: R$ 169.348,90" em prorrogação → inicial; prorrogação "para o período ora prorrogado … é de R$ 3.151.984,05" + planilha igual → grava `TERMO+PLANILHA`; controle diferente → aviso; escaneado com planilha = controle → `PLANILHA+CONTROLE`; vigência pelo controle; vigência bloqueada por fim diferente na ficha; assinatura pelo controle e pela planilha; campo preenchido nunca é decidido.

- [ ] TDD. Commit `feat(valores): categoria do valor, extenso e decisão por linha`.

### Task 4: Aplicação, simulação e etapa no agendador

**Files:** `src/lib/valores-contratos/aplicar.ts` + `.test.ts`; `scripts/valores-contratos.ts`; `scripts/sincronizar-sharepoint.ts` (depois da etapa da biblioteca).

**Interfaces:** `aplicarValoresProvados(prisma, { aplicar: boolean }): Promise<ResumoValores>`; `ResumoValores { linhas: number; valor: number; vigencia: number; assinatura: number; avisos: { contrato: string; linha: string; aviso: string }[]; gravacoes: { contrato: string; linha: string; campo: string; dado: string; origem: string }[] }`; `MIGRACAO_DOS_VALORES = '20260929170000_valor_vigencia'`; `etapaDosValores(prisma, { aplicar }, deps?)` → linhas do log, nunca lança, nunca muda o código de saída.

Coleta (poucas consultas): contratos (chave `chaveSharepoint` ou sigla + nº do termo), linhas do histórico, fichas `HISTORICO_TERMO`/`HISTORICO_PROPOSTA` (valorTotal, vigenciaFim), `LinhaPlanilhaContratos` por chave, controle vigente conferido por contrato (mês mais recente). Linha da planilha e do controle casam pelo nº do termo (único). `anterior` = valor da linha assinada imediatamente anterior (por data/dataInicio). Gravação: `historicoContrato.updateMany({ where: { id, valor: null }, data: { valor } })` (idem datas e `situacao` com `OR: [{situacao: null}, {situacao: ''}]`), e `origemCampoHistorico.upsert`.

Script: sem `--aplicar` = simulação (lista o que gravaria e os avisos); `--detalhe` lista linha a linha.

- [ ] TDD (fake do prisma como nos leitores); simulação no dev; registrar os números; aplicar no dev; rodar de novo → 0 gravações. Etapa no script do agendador (um Edit só) + guarda. Commit `feat(valores): aplicação com prova no agendador e simulação por script`.

### Task 5: Ordem do "valor atual" sem data de assinatura

**Files:** `src/lib/relatorios-clientes/resumo-historico.ts` + teste; `contratos-consolidados.ts` (select `dataInicio`).

- [ ] `LinhaResumoHistorico` ganha `dataInicio?: Date | null`; `maisRecenteQue` usa `data ?? dataInicio`. Teste: prorrogação sem data mas com início 2026 vence o contrato datado de 2024. Commit `fix(contratos): linha sem data de assinatura ordena pelo início da vigência`.

### Task 6: Origem na tela

**Files:** `src/app/api/contratos/[id]/origens/route.ts` + teste; `src/lib/valores-contratos/texto-origem.ts` + teste; `src/app/clientes/[id]/contratos/[contratoId]/secao-historico.tsx` (marca ao lado do valor e do vencimento).

- [ ] `GET /api/contratos/[id]/origens` (acesso pelo contrato) → `{ [historicoId]: { valor?, vigencia?, assinatura? } }`. `textoDaOrigem(campo, origem, prova)` → "Lido do termo (pág. 2); confere com o extenso e com o controle do faturamento de ago/2026". Marca: ícone `ShieldCheck` pequeno com `title` e `aria-label`. Commit `feat(valores): origem do valor e da vigência no histórico do contrato`.

### Task 7: Conferência e documentação

- [ ] Suítes tocadas + `tsc`; antes × depois no dev (ativos, ativos com valor, ativos sem fim de vigência, linhas assinadas); 3 contratos conferidos à mão contra o PDF; CLAUDE.md; Andamento. Commit `docs(valores): CLAUDE.md e andamento do valor e vigência com prova`.
