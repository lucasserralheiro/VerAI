# Envio da Proposta Comercial pelo R2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Nova conversão" da Proposta Comercial volta a funcionar: o navegador sobe o arquivo direto pro Cloudflare R2 (link pré-assinado) em vez do Vercel Blob suspenso.

**Architecture:** `POST /api/propostas-comerciais/envio` devolve um PUT pré-assinado (SigV4 por query string, feito em `src/lib/r2.ts` sem SDK) pra `tmp-uploads/<uuid>.<ext>`; o navegador faz o PUT e manda o endereço `r2:tmp-uploads/…` pro `POST /api/propostas-comerciais`, que só aceita esse formato, grava o original em `propostas-comerciais/<id>/<indice>/original.<ext>` no R2 e apaga o temporário.

**Tech Stack:** Next.js 15 route handlers, React 19, `node:crypto` (SigV4), Jest + Testing Library.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-28-envio-proposta-r2-design.md`. Divergiu, pare e pergunte.
- Sem dependência nova (nada de `@aws-sdk/*`): assinatura com `node:crypto`, como o resto de `r2.ts`.
- Link de envio vale **15 min**; teto **50 MB**; extensões `pdf`, `xlsx`, `csv`, `docx`.
- Endereço vindo do navegador: só `^r2:tmp-uploads/<uuid>\.(pdf|xlsx|csv|docx)$`.
- Dev e produção dividem o **mesmo bucket** R2: teste real só em `tmp-uploads/` e apagando depois.
- Outras sessões deixaram alterações não commitadas em `src/app/api/propostas-comerciais/route.ts`,
  `route.test.ts`, `[id]/route.ts`, `[id]/route.test.ts` e `[id]/arquivos/[arquivoId]/route.ts`
  ("Converter em Markdown" + imagens no R2). Nunca `git add -A`/`commit -a`; commit com índice próprio
  (`GIT_INDEX_FILE`) e só dos nossos arquivos — os que misturam trabalho alheio ficam para o commit
  combinado com o usuário.
- Push e deploy (Task 6) só com autorização explícita do usuário.
- Comentários e textos em português, no estilo dos arquivos vizinhos.

---

### Task 1: Link pré-assinado no `r2.ts`

**Files:**
- Modify: `src/lib/r2.ts`
- Test: `src/lib/r2.test.ts`

**Interfaces:**
- Produces: `assinarUrlSigV4(p: PedidoDeUrlAssinada): string`;
  `urlDeEnvioR2(chave: string, envio: { contentType: string; tamanhoBytes: number; expiraEmSegundos: number }, cfg?: ConfigR2, quando?: Date): string`.

- [x] **Step 1: Testes falhando** — em `r2.test.ts`:

```ts
describe('assinarUrlSigV4', () => {
  // Exemplo oficial da AWS ("Authenticating Requests: Using Query Parameters").
  it('bate com o exemplo da documentação da AWS', () => {
    const url = assinarUrlSigV4({
      metodo: 'GET',
      host: 'examplebucket.s3.amazonaws.com',
      caminho: '/test.txt',
      cabecalhos: {},
      expiraEmSegundos: 86400,
      chaveId: 'AKIAIOSFODNN7EXAMPLE',
      segredo: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      regiao: 'us-east-1',
      servico: 's3',
      quando: new Date('2013-05-24T00:00:00Z'),
    })
    expect(url).toBe(
      'https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404'
    )
  })
})

describe('urlDeEnvioR2', () => {
  const cfg = { contaId: 'conta', bucket: 'verai-documentos', chaveId: 'id', segredo: 'segredo' }
  it('PUT no endpoint da conta, assinando tipo e tamanho', () => {
    const url = new URL(urlDeEnvioR2('tmp-uploads/a b.pdf', { contentType: 'application/pdf', tamanhoBytes: 1234, expiraEmSegundos: 900 }, cfg, new Date('2026-09-28T12:00:00Z')))
    expect(url.origin + url.pathname).toBe('https://conta.r2.cloudflarestorage.com/verai-documentos/tmp-uploads/a%20b.pdf')
    expect(url.searchParams.get('X-Amz-Credential')).toBe('id/20260928/auto/s3/aws4_request')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900')
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host')
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
  })
})
```

- [x] **Step 2:** `npx jest src/lib/r2.test.ts` → FAIL (funções não existem).
- [x] **Step 3: Implementar** — extrair `chaveDeAssinatura(segredo, dia, regiao, servico)`, `hostR2(cfg)`, `caminhoR2(cfg, chave)` e `codificar(texto)` (o encoder de segmento que `codificarChave` já usa), reaproveitados por `assinarSigV4`/`pedirR2`, e acrescentar:

```ts
export interface PedidoDeUrlAssinada {
  metodo: string
  host: string
  /** Caminho já codificado (`codificarChave`). */
  caminho: string
  /** Cabeçalhos a assinar além de `host` — quem usar a URL tem que mandar exatamente esses. */
  cabecalhos: Record<string, string>
  expiraEmSegundos: number
  chaveId: string
  segredo: string
  regiao: string
  servico: string
  quando: Date
}

/** URL pré-assinada (AWS SigV4 por query string, corpo não assinado — `UNSIGNED-PAYLOAD`). */
export function assinarUrlSigV4(p: PedidoDeUrlAssinada): string {
  const amzDate = dataAmz(p.quando)
  const dia = amzDate.slice(0, 8)
  const escopo = `${dia}/${p.regiao}/${p.servico}/aws4_request`
  const todos: Record<string, string> = {
    ...Object.fromEntries(Object.entries(p.cabecalhos).map(([nome, valor]) => [nome.toLowerCase(), valor.trim()])),
    host: p.host,
  }
  const nomes = Object.keys(todos).sort()
  const assinados = nomes.join(';')
  const parametros: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${p.chaveId}/${escopo}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(p.expiraEmSegundos),
    'X-Amz-SignedHeaders': assinados,
  }
  const consulta = Object.keys(parametros).sort().map((n) => `${codificar(n)}=${codificar(parametros[n])}`).join('&')
  const requisicaoCanonica = [p.metodo, p.caminho, consulta, nomes.map((n) => `${n}:${todos[n]}\n`).join(''), assinados, 'UNSIGNED-PAYLOAD'].join('\n')
  const assinatura = createHmac('sha256', chaveDeAssinatura(p.segredo, dia, p.regiao, p.servico))
    .update(['AWS4-HMAC-SHA256', amzDate, escopo, sha256(requisicaoCanonica)].join('\n'))
    .digest('hex')
  return `https://${p.host}${p.caminho}?${consulta}&X-Amz-Signature=${assinatura}`
}

/** Link pro NAVEGADOR gravar direto no R2 (PUT pré-assinado). Assina `content-type` e
 *  `content-length`: com ele só se grava aquele tipo e aquele tamanho, naquela chave. */
export function urlDeEnvioR2(
  chave: string,
  envio: { contentType: string; tamanhoBytes: number; expiraEmSegundos: number },
  cfg: ConfigR2 = exigirConfig(),
  quando: Date = new Date()
): string {
  return assinarUrlSigV4({
    metodo: 'PUT',
    host: hostR2(cfg),
    caminho: caminhoR2(cfg, chave),
    cabecalhos: { 'content-type': envio.contentType, 'content-length': String(envio.tamanhoBytes) },
    expiraEmSegundos: envio.expiraEmSegundos,
    chaveId: cfg.chaveId,
    segredo: cfg.segredo,
    regiao: 'auto',
    servico: 's3',
    quando,
  })
}
```

- [x] **Step 4:** `npx jest src/lib/r2.test.ts` → PASS (incluindo os testes antigos de `assinarSigV4`/`putR2`).
- [x] **Step 5: Prova real contra o R2** (script no scratchpad, fora do repo): gerar link pra
  `tmp-uploads/<uuid>.pdf`, `fetch(url, { method: 'PUT', headers: { 'content-type': 'application/pdf' }, body })`
  → 200; o mesmo link com corpo de outro tamanho → 403; `getR2` devolve o conteúdo; `deleteR2` no fim.
  Se o R2 recusar `content-length` assinado, parar e registrar no spec antes de seguir.
- [x] **Step 6: Commit** (índice próprio): `src/lib/r2.ts`, `src/lib/r2.test.ts` —
  `feat(r2): link pre-assinado de envio pro navegador`.

---

### Task 2: Regras do envio + rota do link

**Files:**
- Create: `src/lib/propostas/envio.ts`, `src/lib/propostas/envio.test.ts`
- Create: `src/app/api/propostas-comerciais/envio/route.ts`, `…/envio/route.test.ts`
- Delete: `src/app/api/propostas-comerciais/upload-token/route.ts`, `…/upload-token/route.test.ts`

**Interfaces:**
- Consumes: `urlDeEnvioR2`, `configR2`, `PREFIXO_R2` (Task 1).
- Produces: `TIPOS_DE_ENVIO: Record<'pdf'|'xlsx'|'csv'|'docx', string>`, `TAMANHO_MAXIMO_ENVIO`,
  `VALIDADE_DO_LINK_S`, `extensaoDeEnvio(nome): ExtensaoDeEnvio | null`,
  `chaveDeEnvio(ext, id?): string`, `ehEnderecoDeEnvio(endereco): boolean`,
  `chaveOriginalProposta(propostaId, indice, ext): string`,
  `chaveDoOriginalNoR2(endereco, propostaId): string | null`;
  rota `POST /api/propostas-comerciais/envio` `{ nome, tamanhoBytes }` → `{ url, endereco, contentType }`.

- [x] **Step 1: Testes falhando** — `envio.test.ts`:

```ts
/** @jest-environment node */
import { chaveDeEnvio, chaveDoOriginalNoR2, chaveOriginalProposta, ehEnderecoDeEnvio, extensaoDeEnvio } from './envio'

const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e'

it('extensão aceita, sem diferença de caixa', () => {
  expect(extensaoDeEnvio('Proposta Final.PDF')).toBe('pdf')
  expect(extensaoDeEnvio('itens.xlsx')).toBe('xlsx')
  expect(extensaoDeEnvio('malware.exe')).toBeNull()
  expect(extensaoDeEnvio('sem-extensao')).toBeNull()
})

it('chave temporária só com uuid e extensão — o nome do arquivo não entra no caminho', () => {
  expect(chaveDeEnvio('pdf', UUID)).toBe(`tmp-uploads/${UUID}.pdf`)
  expect(chaveDeEnvio('docx')).toMatch(/^tmp-uploads\/[0-9a-f-]{36}\.docx$/)
})

it('endereço do navegador: só o temporário do envio', () => {
  expect(ehEnderecoDeEnvio(`r2:tmp-uploads/${UUID}.pdf`)).toBe(true)
  expect(ehEnderecoDeEnvio(`r2:tmp-uploads/${UUID}.exe`)).toBe(false)
  expect(ehEnderecoDeEnvio('r2:clientes/c1/TC 1.pdf')).toBe(false)
  expect(ehEnderecoDeEnvio(`r2:tmp-uploads/../clientes/${UUID}.pdf`)).toBe(false)
  expect(ehEnderecoDeEnvio('https://blob.vercel-storage.com/tmp-uploads/a.pdf')).toBe(false)
})

it('original da proposta mora ao lado das imagens dela', () => {
  expect(chaveOriginalProposta('p1', 0, 'pdf')).toBe('propostas-comerciais/p1/0/original.pdf')
  expect(chaveDoOriginalNoR2('r2:propostas-comerciais/p1/0/original.pdf', 'p1')).toBe('propostas-comerciais/p1/0/original.pdf')
  expect(chaveDoOriginalNoR2('r2:propostas-comerciais/p10/0/original.pdf', 'p1')).toBeNull()
  expect(chaveDoOriginalNoR2('r2:clientes/c1/pc.pdf', 'p1')).toBeNull()
  expect(chaveDoOriginalNoR2('https://blob/2026/09/p1/0/original.pdf', 'p1')).toBeNull()
})
```

`envio/route.test.ts` (ambiente node; mocka só `@/lib/auth`; `R2_*` fictícias em `process.env` no `beforeEach`):
401 sem login; 400 pra `malware.exe`; 400 pra `tamanhoBytes` 0, negativo, não inteiro ou ausente;
400 acima de 50 MB; 503 sem `R2_*`; 200 com `{ url, endereco, contentType }` onde `endereco` casa
`ehEnderecoDeEnvio`, `contentType` é `application/pdf` e `url` começa com
`https://<conta>.r2.cloudflarestorage.com/<bucket>/tmp-uploads/` e tem
`X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost`.

- [x] **Step 2:** `npx jest src/lib/propostas/envio.test.ts src/app/api/propostas-comerciais/envio` → FAIL.
- [x] **Step 3: Implementar** `envio.ts`:

```ts
import { randomUUID } from 'node:crypto'

// Envio da "Nova conversão" direto do navegador pro Cloudflare R2 (spec
// docs/superpowers/specs/2026-09-28-envio-proposta-r2-design.md). O arquivo cai num caminho
// temporário; a conversão só aceita endereço desse formato e grava o original ao lado das imagens.

export const TIPOS_DE_ENVIO = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const
export type ExtensaoDeEnvio = keyof typeof TIPOS_DE_ENVIO

export const TAMANHO_MAXIMO_ENVIO = 50 * 1024 * 1024
export const VALIDADE_DO_LINK_S = 15 * 60

export function extensaoDeEnvio(nome: string): ExtensaoDeEnvio | null {
  const ext = nome.toLowerCase().split('.').pop() ?? ''
  return nome.includes('.') && ext in TIPOS_DE_ENVIO ? (ext as ExtensaoDeEnvio) : null
}

export const chaveDeEnvio = (extensao: ExtensaoDeEnvio, id: string = randomUUID()) => `tmp-uploads/${id}.${extensao}`

const ENDERECO_DE_ENVIO = /^r2:tmp-uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|xlsx|csv|docx)$/

/** Endereço que o navegador pode mandar pra conversão: só o temporário do envio. Qualquer outro
 *  deixaria ler (e depois apagar) arquivo alheio do bucket. */
export const ehEnderecoDeEnvio = (endereco: string) => ENDERECO_DE_ENVIO.test(endereco)

export const chaveOriginalProposta = (propostaId: string, indice: number, extensao: string) =>
  `propostas-comerciais/${propostaId}/${indice}/original.${extensao}`

/** Chave no R2 do original gravado por esta proposta — `null` pra arquivo antigo (Blob) ou de fora dela. */
export function chaveDoOriginalNoR2(endereco: string, propostaId: string): string | null {
  const prefixo = `r2:propostas-comerciais/${propostaId}/`
  return endereco.startsWith(prefixo) ? endereco.slice('r2:'.length) : null
}
```

  e a rota `envio/route.ts` (login → extensão → tamanho inteiro > 0 e ≤ 50 MB → `configR2()` ou 503 →
  `urlDeEnvioR2(chaveDeEnvio(ext), { contentType, tamanhoBytes, expiraEmSegundos: VALIDADE_DO_LINK_S }, cfg)`),
  com comentário de cabeçalho explicando o porquê (4,5 MB da Vercel, Blob suspenso). Apagar a rota
  `upload-token` da proposta e o teste dela.
- [x] **Step 4:** mesmos testes → PASS.
- [x] **Step 5: Commit** (índice próprio): os arquivos novos + remoção do `upload-token` —
  `feat(propostas): link de envio direto pro R2`.

---

### Task 3: Conversão aceita só o envio temporário e grava o original no R2

**Files:**
- Modify: `src/app/api/propostas-comerciais/route.ts`
- Test: `src/app/api/propostas-comerciais/route.test.ts`

**Interfaces:**
- Consumes: `ehEnderecoDeEnvio`, `chaveOriginalProposta`, `TIPOS_DE_ENVIO` (Task 2); `putR2`.

- [x] **Step 1: Testes** — trocar `jest.mock('@/lib/r2', …)` por `({ ...jest.requireActual('@/lib/r2'), putR2: jest.fn(async (chave: string) => \`r2:${chave}\`) })`;
  URLs dos testes do primeiro `describe` viram `r2:tmp-uploads/<UUID>.pdf`; novos casos:
  - endereço fora de `tmp-uploads` (`r2:clientes/c1/pc.pdf`) ou URL do Blob → 400, `getUpload` e
    `prisma.propostaComercial.create` não chamados;
  - original gravado com `putR2('propostas-comerciais/p1/0/original.pdf', buffer, 'application/pdf')`,
    `caminhoOriginal: 'r2:propostas-comerciais/p1/0/original.pdf'`, `putUpload` nunca chamado;
  - temporário apagado com `deleteUpload('r2:tmp-uploads/<UUID>.pdf')`;
  - `putR2` do original falhando → 201 com `status: 'erro'` e a mensagem, sem 500.
- [x] **Step 2:** `npx jest src/app/api/propostas-comerciais/route.test.ts` → FAIL nos novos.
- [x] **Step 3: Implementar** — logo depois de `bruto.filter(arquivoRecebidoValido)`:

```ts
  // Do navegador só entra o temporário do envio (`/api/propostas-comerciais/envio`) — a rota baixa e
  // depois APAGA esse endereço, então qualquer outro deixaria mexer em arquivo alheio do bucket.
  if (arquivosEnviados.some((a) => !ehEnderecoDeEnvio(a.url))) {
    return NextResponse.json({ error: 'endereço de envio inválido' }, { status: 400 })
  }
```

  e a cópia pro caminho final:

```ts
    let url = arquivo.url
    if (!arquivo.arquivoClienteId) {
      try {
        url = await putR2(chaveOriginalProposta(proposta.id, indice, tipo), buffer, TIPOS_DE_ENVIO[tipo])
      } catch (error) {
        falhaConversao = error instanceof Error ? error.message : String(error)
        continue
      }
      await deleteUpload(arquivo.url).catch(() => {})
    }
```

  Tirar `buildUploadPath`/`putUpload` do import se ficarem sem uso; atualizar os comentários que falam
  de "Vercel Blob"/`upload-token` para o envio pelo R2.
- [x] **Step 4:** mesmo teste → PASS; `npx tsc --noEmit` limpo nos arquivos tocados.
- [x] **Step 5: Sem commit próprio** — o arquivo tem trabalho não commitado de outra sessão
  ("Converter em Markdown"). Fica para o commit combinado com o usuário (ver Task 5).

---

### Task 4: Excluir a proposta apaga o original no R2

**Files:**
- Modify: `src/app/api/propostas-comerciais/[id]/route.ts`
- Test: `src/app/api/propostas-comerciais/[id]/route.test.ts`

- [x] **Step 1: Teste falhando** — `findUnique` devolve arquivos
  `[{ caminhoOriginal: 'r2:propostas-comerciais/p1/0/original.pdf', arquivoClienteId: null, conteudoExtraido: null }, { caminhoOriginal: 'r2:clientes/c1/pc.pdf', arquivoClienteId: 'ac1', conteudoExtraido: null }]`
  → `deleteR2` chamado com `propostas-comerciais/p1/0/original.pdf` e **nunca** com `clientes/c1/pc.pdf`.
- [x] **Step 2:** `npx jest "src/app/api/propostas-comerciais/\[id\]/route.test.ts"` → FAIL.
- [x] **Step 3: Implementar** — `select` dos arquivos ganha `caminhoOriginal` e `arquivoClienteId`, e:

```ts
  const originais = proposta.arquivos.flatMap((a) => {
    const chave = a.arquivoClienteId ? null : chaveDoOriginalNoR2(a.caminhoOriginal, proposta.id)
    return chave ? [chave] : []
  })
  await Promise.allSettled([...chaves, ...originais].map((chave) => deleteR2(chave)))
```

- [x] **Step 4:** → PASS.
- [x] **Step 5: Sem commit próprio** (mesmo motivo da Task 3).

---

### Task 5: Tela envia pelo R2 + verificação

**Files:**
- Create: `src/lib/envio-r2-navegador.ts`, `src/lib/envio-r2-navegador.test.ts`
- Modify: `src/app/propostas-comerciais/novo/page.tsx`, `page.test.tsx`
- Modify: `CLAUDE.md` (parágrafo do storage), spec (andamento), memória `vercel-blob-suspenso`

**Interfaces:**
- Produces: `enviarParaR2(arquivo: File, rota: string): Promise<string>` (devolve o `endereco`).

- [x] **Step 1: Testes falhando** — `envio-r2-navegador.test.ts` (fetch mockado): pede o link à rota
  com `{ nome, tamanhoBytes }`; faz `PUT` no `url` com `Content-Type` = `contentType` e `body` = o
  arquivo; devolve `endereco`. Erros: rota com `{ error }` → lança essa mensagem; PUT com rede
  quebrada (CORS) → `Não foi possível enviar "<nome>" para o armazenamento.`; PUT 403 →
  `O armazenamento recusou "<nome>" (403).`
  `page.test.tsx`: mocka `@/lib/envio-r2-navegador`; espera `enviarParaR2(file, '/api/propostas-comerciais/envio')`
  e o corpo do `POST /api/propostas-comerciais` com `url: 'r2:tmp-uploads/…'`; erro do envio aparece e
  não chama a conversão.
- [x] **Step 2:** → FAIL.
- [x] **Step 3: Implementar**

```ts
/** Sobe um arquivo do navegador direto pro Cloudflare R2: pede o link de envio à `rota` (que confere
 *  login, tipo e tamanho) e faz o PUT nele. Devolve o endereço `r2:…` pra mandar à rota que processa o
 *  arquivo — o binário nunca passa por função da Vercel (que recusa corpo acima de 4,5 MB). */
export async function enviarParaR2(arquivo: File, rota: string): Promise<string> {
  const pedido = await fetch(rota, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: arquivo.name, tamanhoBytes: arquivo.size }),
  })
  const link = (await pedido.json().catch(() => null)) as { url?: string; endereco?: string; contentType?: string; error?: string } | null
  if (!pedido.ok || !link?.url || !link.endereco) throw new Error(link?.error ?? `Falha ao preparar o envio de "${arquivo.name}".`)

  let envio: Response
  try {
    envio = await fetch(link.url, { method: 'PUT', headers: { 'Content-Type': link.contentType ?? '' }, body: arquivo })
  } catch {
    throw new Error(`Não foi possível enviar "${arquivo.name}" para o armazenamento.`)
  }
  if (!envio.ok) throw new Error(`O armazenamento recusou "${arquivo.name}" (${envio.status}).`)
  return link.endereco
}
```

  Na página: trocar `upload(...)` por `enviarParaR2(file, '/api/propostas-comerciais/envio')` e o
  comentário do "por quê" (R2 no lugar do Blob).
- [x] **Step 4:** → PASS; rodar todas as suítes tocadas + `npx tsc --noEmit`.
- [x] **Step 5: Verificação no navegador** (depois que o usuário configurar o CORS): localhost:3000 →
  Proposta Comercial → Nova conversão → enviar um PDF de teste → abre a proposta convertida; conferir
  no R2 que `tmp-uploads/` não ficou com o arquivo; excluir a proposta de teste.
- [x] **Step 6: Docs** — `CLAUDE.md` (Stack: "Nova conversão" já no R2), andamento no spec, memória.
- [x] **Step 7: Commit** (índice próprio) dos arquivos só nossos (helper, página, docs). Os de
  `route.ts`/`[id]/route.ts` e testes: perguntar ao usuário se entram junto com o "Converter em
  Markdown" da outra sessão.

---

### Task 6: Produção (só com autorização do usuário)

**Files (worktree novo a partir de `hotfix/confere-504`, branch `hotfix/proposta-r2`):**
- `src/lib/r2.ts` (+teste) — inteiro do main.
- `src/lib/storage.ts` — só `abrirUpload`/`getUpload`/`deleteUpload` entendendo `r2:`.
- `src/lib/propostas/imagens.ts` (+teste) e `src/app/api/propostas-comerciais/[id]/imagens/[indice]/[nome]/route.ts` (+teste).
- `src/lib/propostas/envio.ts`, rota `envio`, `src/lib/envio-r2-navegador.ts`, página `novo` (+testes).
- `src/app/api/propostas-comerciais/route.ts` — imagens no R2, validação do endereço e original no R2
  (**sem** `arquivosCliente`, que depende de migração); `[id]/route.ts` — exclusão no R2.

- [ ] **Step 1:** `git worktree add ../VerAI-hotfix-proposta-r2 -b hotfix/proposta-r2 hotfix/confere-504`;
  `node_modules` como junction pro do projeto (só jest/tsc lá — nunca `npm install` nem `prisma generate`).
- [ ] **Step 2:** portar os arquivos acima; `npx jest` das suítes portadas + `npx tsc --noEmit` → verde.
- [ ] **Step 3:** conferir que produção tem as 4 `R2_*` e o CORS inclui `https://verai-virid.vercel.app`.
- [ ] **Step 4:** **parar e pedir autorização** pra push/deploy, mostrando o diff contra `hotfix/confere-504`.
- [ ] **Step 5:** depois do deploy, enviar uma proposta de teste em produção junto com o usuário.
