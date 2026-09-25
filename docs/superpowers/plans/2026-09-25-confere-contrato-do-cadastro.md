# ConfereAI — o levantamento busca o contrato no cadastro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao escolher o levantamento no ConfereAI, o VerAI lê de qual contrato e competência a planilha é, acha o contrato no cadastro do cliente e preenche Contrato e Aditivos com as propostas (PC/PA) que o SharePoint já guardou — sugerindo quando não acha —, sem tirar o envio pelo computador.

**Architecture:** Três módulos puros em `src/lib/confere/` (ler o cabeçalho do XLSX pelo zip, identificar o contrato, escolher os documentos pela regra da última renovação) e um serviço de banco (`cadastro.ts`) que os junta com `consolidarContratos()` e a visibilidade de clientes. Três rotas só de leitura servem a tela; a rota da geração passa a aceitar id do cadastro (o servidor baixa o PDF do R2). A tela mantém o formulário do Confere na ordem de hoje e ganha a faixa de identificação, "Trocar", a lista de aditivos e a busca. O histórico grava contrato e competência.

**Tech Stack:** Next.js 15 (App Router, route handlers), React 19, Prisma 6/Postgres, Jest 30 + Testing Library, `jszip` 3.10.1.

**Desenho:** `docs/superpowers/specs/2026-09-25-confere-contrato-do-cadastro-design.md` (fonte de verdade — ler antes).

## Global Constraints

- Contrato mostrado em tela (número, vigência, ativo) sai **sempre** do `consolidarContratos()` (`src/lib/relatorios-clientes/contratos-consolidados.ts`) — CLAUDE.md, "regra única de contrato".
- `urlBlob` nunca vai para o navegador; PDF do cadastro abre por `/api/arquivos/{id}?modo=inline`.
- Só contratos/arquivos de clientes que a pessoa pode ver (`clienteIdsPermitidos`, `src/lib/visibilidade.ts`); cliente sem permissão = inexistente.
- Os arquivos de entrada continuam **não guardados** (nem a planilha). A execução guarda nomes + `contratoId` + competência.
- Nada em `services/confere/` muda.
- Estilo: `src/app/confere/**` é cópia do frontend do Confere — **tabs, aspas duplas, ponto e vírgula**. `src/lib/**` e `src/app/api/**` — **2 espaços, aspas simples, sem ponto e vírgula**.
- Testes de servidor com `/** @jest-environment node */` na primeira linha. Rodar com `npx jest <caminho>`.
- Migração escrita à mão; conferir que não aparece `DROP INDEX "ArquivoCliente_clienteId_sha256_ativo_key"`.
- Commits: `git add` só dos arquivos da task (há trabalho de outras frentes no repositório — nunca `git add -A`). **Não dar push** (hook `pre-push` bloqueia; deploy suspenso).
- Mensagens de commit terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/confere/tipos-cadastro.ts` (novo) | Tipos das respostas + formatação pura (vai para o navegador) |
| `src/lib/confere/levantamento.ts` (novo) | Cabeçalho da aba `Levantamento` pelo zip; competência |
| `src/lib/confere/identidade.ts` (novo) | Número/órgão/ano da referência (3 formas + órgão do título) |
| `src/lib/confere/documentos-do-contrato.ts` (novo) | Regra da última renovação, decisões, avisos, vigência |
| `src/lib/confere/localizar-contrato.ts` (novo) | Casar a identidade com os contratos visíveis |
| `src/lib/confere/cadastro.ts` (novo) | Banco: identificar, documentos, busca, arquivos para a geração |
| `src/app/api/confere/levantamento/route.ts` (novo) | POST — identificação |
| `src/app/api/confere/contratos/route.ts` (novo) | GET — busca livre |
| `src/app/api/confere/contratos/[id]/documentos/route.ts` (novo) | GET — documentos de um contrato |
| `src/app/api/confere/reports/route.ts` | Aceita id do cadastro; histórico com contrato/competência |
| `prisma/schema.prisma` + migração `20260925120000_confere_execucao_contrato` | `ConfereExecucao.contratoId/competenciaAno/competenciaMes` |
| `src/app/api/confere/execucoes/route.ts`, `src/app/confere/historico/page.tsx` | Coluna Contrato · competência |
| `src/app/confere/lib/{types,api,cadastro}.ts` | `Peca`, chamadas novas, textos da origem |
| `src/app/confere/components/{FaixaDoContrato,BuscaDeContrato,MenuDeDocumentos}.tsx` (novos), `UploadForm.tsx`, `page.tsx` | Tela |

---

### Task 1: Ler o cabeçalho do levantamento e a identidade do contrato

**Files:**
- Create: `src/lib/confere/tipos-cadastro.ts`, `src/lib/confere/levantamento.ts`, `src/lib/confere/identidade.ts`
- Test: `src/lib/confere/levantamento.test.ts`, `src/lib/confere/identidade.test.ts`
- Modify: `package.json`, `package-lock.json` (jszip direto)

**Interfaces:**
- Produces: `lerCabecalhoDoLevantamento(conteudo: ArrayBuffer | Uint8Array): Promise<CabecalhoDoLevantamento>` (`{ titulo, dataLevantamento: 'AAAA-MM-DD' | null, contratoReferencia }`), `LevantamentoIlegivel`, `MENSAGEM_SEM_ABA`, `MENSAGEM_NAO_ABRE`, `competenciaDaData(iso: string | null): Competencia | null`, `identidadeDoContrato(referencia: string | null, titulo?: string | null): IdentidadeDoContrato | null` (`{ base: number; orgao: string | null; ano: string }`); em `tipos-cadastro.ts`: todos os tipos de resposta, `nomeDaCompetencia`, `dataIsoParaTexto`, `PREFIXO_DO_CADASTRO`.

- [ ] **Step 1: jszip como dependência direta**

Run: `npm install jszip@3.10.1 --save --no-audit --no-fund`
Expected: `package.json` ganha `"jszip": "^3.10.1"` em `dependencies` (já estava em `node_modules` pelo exceljs).

- [ ] **Step 2: Criar `src/lib/confere/tipos-cadastro.ts`**

```ts
/**
 * O que as rotas do ConfereAI devolvem sobre o cadastro dos clientes — compartilhado entre o
 * servidor (`src/lib/confere/cadastro.ts`) e a tela (`src/app/confere/`). Este arquivo vai para o
 * navegador: só tipos e formatação pura, sem importar nada do servidor.
 *
 * Desenho: docs/superpowers/specs/2026-09-25-confere-contrato-do-cadastro-design.md.
 */

export type TipoDaLinha = 'CONTRATO' | 'ADITIVO' | 'PRORROGACAO' | 'RESCISAO' | 'PROSPECCAO'

/** Aditivo do cadastro no multipart da geração: `aditivos=cadastro:<arquivoId>`. */
export const PREFIXO_DO_CADASTRO = 'cadastro:'

export interface Competencia {
  ano: number
  /** 1 a 12. */
  mes: number
}

export interface OrigemNoCadastro {
  tipo: TipoDaLinha
  numero: string | null
  /** "AAAA-MM-DD" — início da linha (ou a assinatura, ou a data da proposta). */
  inicio: string | null
}

export interface DocumentoDoCadastro {
  arquivoId: string
  nome: string
  /** `null` quando é uma proposta do cliente que não está em nenhuma linha do histórico. */
  origem: OrigemNoCadastro | null
}

export interface ResumoDoContrato {
  id: string
  clienteId: string
  clienteNome: string
  clienteSigla: string | null
  numeroTermo: string | null
  descricao: string | null
  /** "AAAA-MM-DD" — fim de vigência efetivo, do `consolidarContratos()`. */
  vigenciaFim: string | null
  ativo: boolean
}

export type CodigoDoAviso = 'aditivo-sem-pa' | 'termo-sem-data' | 'fora-da-vigencia' | 'sem-proposta'

export interface AvisoDoCadastro {
  codigo: CodigoDoAviso
  texto: string
}

export interface DecisaoDoCadastro {
  /** "Contrato inicial", "TA 04". */
  rotulo: string
  papel: 'base' | 'aditivo' | 'fora'
  /** Por que ficou fora; `null` para base e aditivo. */
  motivo: string | null
}

export interface DocumentosDoContrato {
  contrato: ResumoDoContrato
  competencia: Competencia & { lidaDaPlanilha: boolean }
  /** A proposta do campo Contrato; `null` quando o contrato não tem nenhuma no cadastro. */
  base: DocumentoDoCadastro | null
  /** Em ordem de aplicação. */
  aditivos: DocumentoDoCadastro[]
  /** Todas as propostas do contrato — e, quando ele não tem nenhuma, as soltas do cliente —, para
   *  "Trocar" e "+ Adicionar do cadastro". */
  alternativas: DocumentoDoCadastro[]
  decisoes: DecisaoDoCadastro[]
  avisos: AvisoDoCadastro[]
}

export interface LeituraDoLevantamento {
  /** O que a planilha escreveu depois de "conforme contrato :". */
  referencia: string | null
  /** O mês da "Data do Levantamento" — `null` quando a planilha não tem a data. */
  competencia: Competencia | null
}

export type RespostaDaIdentificacao =
  | { situacao: 'ilegivel'; mensagem: string }
  | { situacao: 'sem-referencia'; leitura: LeituraDoLevantamento }
  | { situacao: 'encontrado'; leitura: LeituraDoLevantamento; documentos: DocumentosDoContrato }
  | { situacao: 'ambiguo'; leitura: LeituraDoLevantamento; candidatos: ResumoDoContrato[] }
  | { situacao: 'nao-encontrado'; leitura: LeituraDoLevantamento; sugestoes: ResumoDoContrato[] }

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** `{ ano: 2026, mes: 7 }` → "julho/2026" — o formato da competência no relatório do Confere. */
export function nomeDaCompetencia({ ano, mes }: Competencia): string {
  return `${MESES[mes - 1]}/${ano}`
}

/** "2025-12-01" → "01/12/2025". */
export function dataIsoParaTexto(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}
```

- [ ] **Step 3: Escrever os testes que falham**

`src/lib/confere/identidade.test.ts`:

```ts
/** @jest-environment node */
import { identidadeDoContrato } from './identidade'

describe('identidadeDoContrato', () => {
  // As formas medidas nos levantamentos reais de 25/09/2026 (Downloads do usuário e fixtures do Confere).
  it.each([
    ['TC 52/SMIT/2024', null, { base: 52, orgao: 'SMIT', ano: '2024' }],
    ['TC 015/PGM/2024', null, { base: 15, orgao: 'PGM', ano: '2024' }],
    ['TC 16/CGM/2024', null, { base: 16, orgao: 'CGM', ano: '2024' }],
    ['TC 094/FTMSP/2024', null, { base: 94, orgao: 'FTMSP', ano: '2024' }],
    ['52-A/SMIT/2024', null, { base: 52, orgao: 'SMIT', ano: '2024' }],
    ['TC 07/2024/SMDET', null, { base: 7, orgao: 'SMDET', ano: '2024' }],
    ['TC 107/2025/SMS-1', null, { base: 107, orgao: 'SMS', ano: '2025' }],
    ['TC 387/2024', 'LEVANTAMENTO - COMPROVAÇÃO HSPM - CATÁLOGO DE SERVIÇOS DIT', { base: 387, orgao: 'HSPM', ano: '2024' }],
    ['TC 387/2024', null, { base: 387, orgao: null, ano: '2024' }],
    ['52 / smit / 2024', null, { base: 52, orgao: 'SMIT', ano: '2024' }],
  ])('%s', (referencia, titulo, esperado) => {
    expect(identidadeDoContrato(referencia, titulo)).toEqual(esperado)
  })

  it('peça sozinha não rende identidade (como no Confere)', () => {
    expect(identidadeDoContrato('PA-SMIT-260319-739')).toBeNull()
  })

  it('sem referência', () => {
    expect(identidadeDoContrato(null)).toBeNull()
    expect(identidadeDoContrato('')).toBeNull()
  })
})
```

`src/lib/confere/levantamento.test.ts`:

```ts
/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import JSZip from 'jszip'

import {
  competenciaDaData,
  lerCabecalhoDoLevantamento,
  LevantamentoIlegivel,
  MENSAGEM_NAO_ABRE,
  MENSAGEM_SEM_ABA,
} from './levantamento'

const FIXTURES = path.join(process.cwd(), 'services/confere/backend/tests/fixtures')

/** XLSX mínimo, só com as partes que o leitor abre. `linhas[i][j]` vai para a linha i+1, coluna j. */
async function planilha(opcoes: {
  linhas: string[][]
  aba?: string
  alvo?: string
  inline?: boolean
}): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file(
    'xl/workbook.xml',
    `<workbook xmlns:r="r"><sheets><sheet name="Capa" sheetId="1" r:id="rId1"/><sheet name="${opcoes.aba ?? 'Levantamento'}" sheetId="2" r:id="rId2"/></sheets></workbook>`
  )
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="${opcoes.alvo ?? 'worksheets/sheet2.xml'}"/></Relationships>`
  )
  const textos: string[] = []
  const linhas = opcoes.linhas
    .map((celulas, i) => {
      const xml = celulas
        .map((valor, j) => {
          if (!valor) return ''
          const referencia = `${String.fromCharCode(65 + j)}${i + 1}`
          if (opcoes.inline) return `<c r="${referencia}" t="inlineStr"><is><t>${valor}</t></is></c>`
          textos.push(valor)
          return `<c r="${referencia}" t="s"><v>${textos.length - 1}</v></c>`
        })
        .join('')
      return `<row r="${i + 1}">${xml}</row>`
    })
    .join('')
  zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData/></worksheet>')
  zip.file('xl/worksheets/sheet2.xml', `<worksheet><sheetData>${linhas}</sheetData></worksheet>`)
  zip.file('xl/sharedStrings.xml', `<sst>${textos.map((t) => `<si><t>${t}</t></si>`).join('')}</sst>`)
  return zip.generateAsync({ type: 'uint8array' })
}

const CABECALHO_CGM = [
  ['LEVANTAMENTO - COMPROVAÇÃO CGM'],
  [],
  ['Data do Levantamento : 03/08/2026', '', '', 'Quantidade', 'Quantidade'],
  ['*Valores conforme contrato : TC 16/CGM/2024', '', '', 'Contratada*', 'Medida'],
]

describe('lerCabecalhoDoLevantamento', () => {
  it('lê o levantamento real do SMIT (piloto do Confere)', async () => {
    const cabecalho = await lerCabecalhoDoLevantamento(readFileSync(path.join(FIXTURES, 'levantamento.xlsx')))
    expect(cabecalho).toEqual({
      titulo: 'LEVANTAMENTO - COMPROVAÇÃO SMIT SUSTENTAÇÃO - CATÁLOGO DE SERVIÇOS DIT',
      dataLevantamento: '2026-07-15',
      contratoReferencia: 'TC 52/SMIT/2024',
    })
  })

  it('lê o levantamento real do PGM', async () => {
    const cabecalho = await lerCabecalhoDoLevantamento(readFileSync(path.join(FIXTURES, 'levantamento_pgm.xlsx')))
    expect(cabecalho).toMatchObject({ dataLevantamento: '2026-07-23', contratoReferencia: 'TC 015/PGM/2024' })
  })

  it('aceita o caminho relativo do Excel e o absoluto do openpyxl', async () => {
    for (const alvo of ['worksheets/sheet2.xml', '/xl/worksheets/sheet2.xml']) {
      const bytes = await planilha({ alvo, linhas: CABECALHO_CGM })
      await expect(lerCabecalhoDoLevantamento(bytes)).resolves.toEqual({
        titulo: 'LEVANTAMENTO - COMPROVAÇÃO CGM',
        dataLevantamento: '2026-08-03',
        contratoReferencia: 'TC 16/CGM/2024',
      })
    }
  })

  it('texto inline e entidades XML', async () => {
    const bytes = await planilha({
      inline: true,
      linhas: [['COMPROVA&#199;&#195;O HSPM &amp; CIA'], [], ['Data do Levantamento : 17/08/2026'], ['*Valores conforme contrato : TC 387/2024']],
    })
    await expect(lerCabecalhoDoLevantamento(bytes)).resolves.toEqual({
      titulo: 'COMPROVAÇÃO HSPM & CIA',
      dataLevantamento: '2026-08-17',
      contratoReferencia: 'TC 387/2024',
    })
  })

  it('texto rico: junta as corridas e ignora a leitura fonética', async () => {
    const zip = new JSZip()
    zip.file('xl/workbook.xml', '<workbook><sheets><sheet name="Levantamento" sheetId="1" r:id="rId1"/></sheets></workbook>')
    zip.file('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>')
    zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="4"><c r="A4" t="s"><v>0</v></c></row></sheetData></worksheet>')
    zip.file(
      'xl/sharedStrings.xml',
      '<sst><si><r><t xml:space="preserve">*Valores conforme contrato : </t></r><r><rPr><b/></rPr><t>TC 52/SMIT/2024</t></r><rPh><t>ふりがな</t></rPh></si></sst>'
    )
    const cabecalho = await lerCabecalhoDoLevantamento(await zip.generateAsync({ type: 'uint8array' }))
    expect(cabecalho.contratoReferencia).toBe('TC 52/SMIT/2024')
  })

  it('só olha as dez primeiras linhas, como o Confere', async () => {
    const linhas: string[][] = Array.from({ length: 10 }, () => [''])
    linhas.push(['*Valores conforme contrato : TC 16/CGM/2024'])
    await expect(lerCabecalhoDoLevantamento(await planilha({ linhas }))).resolves.toMatchObject({ contratoReferencia: null })
  })

  it('data impossível não vira data', async () => {
    const bytes = await planilha({ linhas: [['x'], ['Data do Levantamento : 31/02/2026']] })
    await expect(lerCabecalhoDoLevantamento(bytes)).resolves.toMatchObject({ dataLevantamento: null })
  })

  it('sem a aba Levantamento: a mesma frase do Confere', async () => {
    const bytes = await planilha({ aba: 'Plan1', linhas: [['x']] })
    await expect(lerCabecalhoDoLevantamento(bytes)).rejects.toThrow(MENSAGEM_SEM_ABA)
  })

  it('arquivo que não é xlsx', async () => {
    const promessa = lerCabecalhoDoLevantamento(new TextEncoder().encode('não é zip'))
    await expect(promessa).rejects.toBeInstanceOf(LevantamentoIlegivel)
    await expect(lerCabecalhoDoLevantamento(new TextEncoder().encode('não é zip'))).rejects.toThrow(MENSAGEM_NAO_ABRE)
  })
})

describe('competenciaDaData', () => {
  it('mês e ano da data do levantamento', () => {
    expect(competenciaDaData('2026-08-03')).toEqual({ ano: 2026, mes: 8 })
  })

  it('sem data', () => {
    expect(competenciaDaData(null)).toBeNull()
  })
})
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx jest src/lib/confere/levantamento.test.ts src/lib/confere/identidade.test.ts`
Expected: FAIL — `Cannot find module './levantamento'` / `'./identidade'`.

- [ ] **Step 5: Implementar `src/lib/confere/identidade.ts`**

```ts
// De que contrato é o levantamento — número, órgão e ano, a partir do que a planilha escreveu em
// "conforme contrato :". A primeira forma é a do Confere (`IdentidadeContratual.de_referencia_da_aba`,
// services/confere/backend/src/domain/value_objects/identidade_contratual.py — ESPEC 029):
// `52/SMIT/2024`, `52-A/SMIT/2024`. As outras duas foram medidas nos levantamentos reais de
// 25/09/2026 e o Confere não as reconhece (fica em silêncio, `R-IDT-06`): `07/2024/SMDET` (órgão no
// fim) e `387/2024` sem órgão (HSPM) — aí o órgão sai do título da aba ("LEVANTAMENTO -
// COMPROVAÇÃO HSPM - ...").

export interface IdentidadeDoContrato {
  /** O número como valor: `015` e `15` são o mesmo contrato. */
  base: number
  /** Em maiúsculas; `null` quando nem a referência nem o título dizem o órgão. */
  orgao: string | null
  ano: string
}

const LETRAS = 'A-Za-zÀ-Úà-ú'
const ORGAO_NO_MEIO = new RegExp(`(\\d{1,4})(?:\\s*-\\s*([A-Za-z0-9]{1,3}))?\\s*/\\s*([${LETRAS}]{2,12})\\s*/\\s*(\\d{4})`)
const ORGAO_NO_FIM = new RegExp(`(\\d{1,4})\\s*/\\s*(\\d{4})\\s*/\\s*([${LETRAS}]{2,12})`)
const SEM_ORGAO = /(\d{1,4})\s*\/\s*(\d{4})(?!\d)/
const ORGAO_DO_TITULO = new RegExp(`COMPROVA[ÇC][ÃA]O\\s+([${LETRAS}]{2,12})`, 'i')

export function identidadeDoContrato(referencia: string | null, titulo: string | null = null): IdentidadeDoContrato | null {
  if (!referencia) return null
  const texto = referencia.replace(/\s+/g, ' ')
  const noMeio = ORGAO_NO_MEIO.exec(texto)
  if (noMeio) return { base: Number(noMeio[1]), orgao: noMeio[3].toUpperCase(), ano: noMeio[4] }
  const noFim = ORGAO_NO_FIM.exec(texto)
  if (noFim) return { base: Number(noFim[1]), orgao: noFim[3].toUpperCase(), ano: noFim[2] }
  const semOrgao = SEM_ORGAO.exec(texto)
  if (!semOrgao) return null
  const doTitulo = titulo ? ORGAO_DO_TITULO.exec(titulo) : null
  return { base: Number(semOrgao[1]), orgao: doTitulo ? doTitulo[1].toUpperCase() : null, ano: semOrgao[2] }
}
```

- [ ] **Step 6: Implementar `src/lib/confere/levantamento.ts`**

```ts
import JSZip from 'jszip'

import type { Competencia } from './tipos-cadastro'

// Lê o cabeçalho da aba `Levantamento` — título, "Data do Levantamento" e o contrato de referência
// ("conforme contrato :") — sem abrir a planilha inteira. Espelha `levantamento_reader._ler_cabecalho`
// do Confere (services/confere/backend/src/infrastructure/measurement/levantamento_reader.py): as
// mesmas dez primeiras linhas e cinco colunas, as mesmas expressões. Se um lado mudar, o outro muda
// junto.
//
// Não usa o exceljs: `workbook.xlsx.load` estoura nos levantamentos reais (desenhos na planilha —
// medido em 25/09/2026). Um XLSX é um zip de XML: a aba sai do workbook.xml + rels, e o texto das
// células, do sharedStrings.

export const MENSAGEM_SEM_ABA = "planilha sem a aba 'Levantamento' — verifique se o arquivo é o levantamento"
export const MENSAGEM_NAO_ABRE = 'não foi possível abrir a planilha — verifique se o arquivo é um .xlsx'

const ABA = 'Levantamento'
const LINHAS_DO_CABECALHO = 10
const COLUNAS_LIDAS = 5
const DATA = /Data do Levantamento\s*:\s*(\d{2}\/\d{2}\/\d{4})/
const CONTRATO = /conforme contrato\s*:\s*(.+?)\s*$/

export class LevantamentoIlegivel extends Error {}

export interface CabecalhoDoLevantamento {
  titulo: string | null
  /** "AAAA-MM-DD". */
  dataLevantamento: string | null
  /** O que vem depois de "conforme contrato :" — "TC 52/SMIT/2024". */
  contratoReferencia: string | null
}

function decodificar(texto: string): string {
  return texto
    .replace(/&#x([0-9a-f]+);/gi, (_, hexadecimal: string) => String.fromCodePoint(parseInt(hexadecimal, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function atributo(tag: string | undefined, nome: string): string | null {
  if (!tag) return null
  const achado = new RegExp(`\\s${nome}="([^"]*)"`).exec(tag)
  return achado ? decodificar(achado[1]) : null
}

function abertura(elemento: string): string {
  return elemento.slice(0, elemento.indexOf('>') + 1)
}

/** O texto de todos os `<t>` — texto rico chega em várias corridas. A leitura fonética (`<rPh>`)
 *  também usa `<t>` e não é texto visível. */
function textoDosT(xml: string): string {
  const semFonetica = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')
  const partes = semFonetica.match(/<t(?:\s[^>]*)?>[\s\S]*?<\/t>/g) ?? []
  return partes.map((parte) => decodificar(parte.replace(/<[^>]+>/g, ''))).join('')
}

function indiceDaColuna(referencia: string): number {
  const letras = /^[A-Z]+/.exec(referencia)?.[0] ?? ''
  let indice = 0
  for (const letra of letras) indice = indice * 26 + (letra.charCodeAt(0) - 64)
  return indice - 1
}

function valorDaCelula(celula: string, textos: string[]): string {
  const tipo = atributo(abertura(celula), 't')
  if (tipo === 'inlineStr') return textoDosT(celula).trim()
  const bruto = /<v>([\s\S]*?)<\/v>/.exec(celula)?.[1]
  if (bruto === undefined) return ''
  if (tipo === 's') return (textos[Number(bruto)] ?? '').trim()
  if (tipo === 'b') return bruto === '1' ? 'True' : 'False'
  if (tipo === 'str' || tipo === 'e') return decodificar(bruto).trim()
  // Número: vírgula decimal, como o `_texto` do Confere. O cabeçalho só usa texto.
  return bruto.replace('.', ',')
}

/** As dez primeiras linhas, cinco colunas cada — o que o Confere lê em `identificar`. */
function linhasDoCabecalho(folha: string, textos: string[]): string[][] {
  const linhas = Array.from({ length: LINHAS_DO_CABECALHO }, () => Array<string>(COLUNAS_LIDAS).fill(''))
  let anterior = 0
  for (const [bloco] of folha.matchAll(/<row\b[^>]*\/>|<row\b[^>]*>[\s\S]*?<\/row>/g)) {
    const numero = Number(atributo(abertura(bloco), 'r') ?? anterior + 1)
    anterior = numero
    if (numero > LINHAS_DO_CABECALHO) break
    let colunaAnterior = -1
    for (const [celula] of bloco.matchAll(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g)) {
      const referencia = atributo(abertura(celula), 'r')
      const coluna = referencia ? indiceDaColuna(referencia) : colunaAnterior + 1
      colunaAnterior = coluna
      if (coluna >= 0 && coluna < COLUNAS_LIDAS) linhas[numero - 1][coluna] = valorDaCelula(celula, textos)
    }
  }
  return linhas
}

function paraIso(data: string): string | null {
  const [dia, mes, ano] = data.split('/').map(Number)
  const valida = new Date(Date.UTC(ano, mes - 1, dia))
  if (valida.getUTCMonth() !== mes - 1 || valida.getUTCDate() !== dia) return null
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export async function lerCabecalhoDoLevantamento(conteudo: ArrayBuffer | Uint8Array): Promise<CabecalhoDoLevantamento> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(conteudo)
  } catch {
    throw new LevantamentoIlegivel(MENSAGEM_NAO_ABRE)
  }
  const livro = await zip.file('xl/workbook.xml')?.async('string')
  if (!livro) throw new LevantamentoIlegivel(MENSAGEM_NAO_ABRE)

  const aba = (livro.match(/<sheet\b[^>]*>/g) ?? []).find((tag) => atributo(tag, 'name') === ABA)
  const relacao = atributo(aba, 'r:id')
  const relacoes = (await zip.file('xl/_rels/workbook.xml.rels')?.async('string')) ?? ''
  const alvo = (relacoes.match(/<Relationship\b[^>]*>/g) ?? []).find(
    (tag) => relacao !== null && atributo(tag, 'Id') === relacao
  )
  const destino = atributo(alvo, 'Target')
  // "/xl/worksheets/sheet2.xml" (openpyxl) ou "worksheets/sheet2.xml" (Excel, relativo a xl/).
  const caminho = destino ? (destino.startsWith('/') ? destino.slice(1) : `xl/${destino}`) : null
  const folha = caminho ? await zip.file(caminho)?.async('string') : undefined
  if (!folha) throw new LevantamentoIlegivel(MENSAGEM_SEM_ABA)

  const compartilhados = (await zip.file('xl/sharedStrings.xml')?.async('string')) ?? ''
  const textos = (compartilhados.match(/<si(?:\s[^>]*)?>[\s\S]*?<\/si>|<si\s*\/>/g) ?? []).map(textoDosT)
  const linhas = linhasDoCabecalho(folha, textos)

  let dataLevantamento: string | null = null
  let contratoReferencia: string | null = null
  for (const celulas of linhas) {
    const data = dataLevantamento === null ? DATA.exec(celulas.join(' ')) : null
    if (data) dataLevantamento = paraIso(data[1])
    const contrato = contratoReferencia === null ? CONTRATO.exec(celulas[0]) : null
    if (contrato) contratoReferencia = contrato[1].trim()
  }
  return { titulo: linhas[0][0] || null, dataLevantamento, contratoReferencia }
}

/** A competência do Confere é o mês da "Data do Levantamento" (`competencia_por_extenso`). */
export function competenciaDaData(dataIso: string | null): Competencia | null {
  if (!dataIso) return null
  const [ano, mes] = dataIso.split('-').map(Number)
  return { ano, mes }
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npx jest src/lib/confere/levantamento.test.ts src/lib/confere/identidade.test.ts`
Expected: PASS (todos).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/lib/confere/tipos-cadastro.ts src/lib/confere/levantamento.ts src/lib/confere/levantamento.test.ts src/lib/confere/identidade.ts src/lib/confere/identidade.test.ts
git commit -m "feat(confere): lê contrato e competência do cabeçalho do levantamento"
```

---

### Task 2: Regra de escolha dos documentos (última renovação)

**Files:**
- Create: `src/lib/confere/documentos-do-contrato.ts`
- Test: `src/lib/confere/documentos-do-contrato.test.ts`

**Interfaces:**
- Consumes: tipos e formatação de `tipos-cadastro.ts` (Task 1).
- Produces: `LinhaDoHistorico`, `EscolhaDeDocumentos`, `escolherDocumentos(linhas, competencia)`, `avisoDeVigencia(competencia, { vigenciaFim, inicio }, linhas): AvisoDoCadastro | null`, `dataDaProposta(codigo)`, `rotuloDaLinha(linha)`.

- [ ] **Step 1: Escrever os testes que falham** — `src/lib/confere/documentos-do-contrato.test.ts`

```ts
/** @jest-environment node */
import type { TipoDaLinha } from './tipos-cadastro'
import {
  avisoDeVigencia,
  dataDaProposta,
  escolherDocumentos,
  type LinhaDoHistorico,
} from './documentos-do-contrato'

let sequencia = 0
const d = (iso: string) => new Date(`${iso}T00:00:00Z`)

function linha(tipo: TipoDaLinha, campos: Omit<Partial<LinhaDoHistorico>, 'pdf'> & { pdf?: string } = {}): LinhaDoHistorico {
  sequencia += 1
  const { pdf, ...resto } = campos
  return {
    id: `l${sequencia}`,
    tipo,
    numero: null,
    data: null,
    dataInicio: null,
    dataVencimento: null,
    situacao: null,
    proposta: null,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, sequencia)),
    pdf: pdf ? { arquivoId: pdf, nome: `${pdf}.pdf` } : null,
    ...resto,
  }
}

// Os três contratos do cadastro de desenvolvimento (25/09/2026), na ordem em que o banco devolve.
const PGM = [
  linha('ADITIVO', { numero: 'TA 05', data: d('2026-04-30'), proposta: 'PA-PGM-260304-715 - Q-00715-5', pdf: 'pa-05' }),
  linha('CONTRATO', { numero: 'TC 015/PGM/2024', data: d('2024-11-29'), dataInicio: d('2024-12-01'), dataVencimento: d('2025-11-30'), pdf: 'pc' }),
  linha('ADITIVO', { numero: 'TA 03', data: d('2025-10-30'), pdf: 'pa-03' }),
  linha('ADITIVO', { numero: 'TA 01', data: d('2025-03-28'), pdf: 'pa-01' }),
  linha('ADITIVO', { numero: 'TA 02', data: d('2025-04-30'), pdf: 'pa-02' }),
  linha('PRORROGACAO', { numero: 'TA 04', dataInicio: d('2025-12-01'), proposta: 'PA-PGM-251015-159 v5.0', pdf: 'pa-04' }),
]
const SMIT = [
  linha('CONTRATO', { numero: 'TC 52/SMIT/2024', data: d('2024-06-11'), dataInicio: d('2024-07-01'), dataVencimento: d('2025-06-30'), pdf: 'pc' }),
  linha('PRORROGACAO', { numero: 'TA 01', data: d('2025-06-30'), dataInicio: d('2025-07-01'), dataVencimento: d('2026-06-30'), pdf: 'pa-01' }),
  linha('PRORROGACAO', { numero: 'TA 02', data: d('2026-06-30'), dataInicio: d('2026-07-01'), dataVencimento: d('2027-06-30'), pdf: 'pa-02' }),
]
const CGM = [
  linha('ADITIVO', { numero: 'TA 01', data: d('2025-04-29'), proposta: 'PA-CGM-250403-035 v1.0', pdf: 'pa-01' }),
  linha('PRORROGACAO', { numero: 'TA 02', data: d('2025-10-14'), dataInicio: d('2025-10-15'), dataVencimento: d('2026-10-14'), pdf: 'pa-02' }),
  linha('CONTRATO', { numero: 'TC 16/CGM/2024', pdf: 'pc' }),
]

describe('escolherDocumentos — os casos reais', () => {
  it('PGM, julho/2026: base na renovação TA 04 e o aditivo TA 05 (como a equipe do Confere montou)', () => {
    const escolha = escolherDocumentos(PGM, { ano: 2026, mes: 7 })
    expect(escolha.base).toEqual({
      arquivoId: 'pa-04',
      nome: 'pa-04.pdf',
      origem: { tipo: 'PRORROGACAO', numero: 'TA 04', inicio: '2025-12-01' },
    })
    expect(escolha.aditivos.map((a) => a.arquivoId)).toEqual(['pa-05'])
    expect(escolha.decisoes).toEqual([
      { rotulo: 'Contrato inicial', papel: 'fora', motivo: 'já está dentro da renovação TA 04' },
      { rotulo: 'TA 01', papel: 'fora', motivo: 'já está dentro da renovação TA 04' },
      { rotulo: 'TA 02', papel: 'fora', motivo: 'já está dentro da renovação TA 04' },
      { rotulo: 'TA 03', papel: 'fora', motivo: 'já está dentro da renovação TA 04' },
      { rotulo: 'TA 04', papel: 'base', motivo: null },
      { rotulo: 'TA 05', papel: 'aditivo', motivo: null },
    ])
    expect(escolha.avisos).toEqual([])
  })

  it('SMIT, julho/2026: base na TA 02, que começa em 01/07/2026', () => {
    const escolha = escolherDocumentos(SMIT, { ano: 2026, mes: 7 })
    expect(escolha.base?.arquivoId).toBe('pa-02')
    expect(escolha.aditivos).toEqual([])
  })

  it('SMIT, maio/2026: a TA 02 ainda não vale — base na TA 01', () => {
    const escolha = escolherDocumentos(SMIT, { ano: 2026, mes: 5 })
    expect(escolha.base?.arquivoId).toBe('pa-01')
    expect(escolha.decisoes).toContainEqual({ rotulo: 'TA 02', papel: 'fora', motivo: 'começa depois da competência (01/07/2026)' })
  })

  it('CGM, agosto/2026: base na renovação TA 02; o TA 01 já está dentro dela', () => {
    const escolha = escolherDocumentos(CGM, { ano: 2026, mes: 8 })
    expect(escolha.base?.arquivoId).toBe('pa-02')
    expect(escolha.aditivos).toEqual([])
    expect(escolha.decisoes).toContainEqual({ rotulo: 'TA 01', papel: 'fora', motivo: 'já está dentro da renovação TA 02' })
  })

  it('HSPM: renovação sem PA não vira base — continua a PC, e o aditivo depois dela entra', () => {
    const hspm = [
      linha('CONTRATO', { numero: 'TC 387/2024/HSPM', dataInicio: d('2024-10-11'), pdf: 'pc' }),
      linha('ADITIVO', { numero: 'TA 590-2025', dataInicio: d('2026-03-23'), pdf: 'pa-590' }),
      linha('PRORROGACAO', { numero: 'TA 521-2025', dataInicio: d('2025-11-01') }),
    ]
    const escolha = escolherDocumentos(hspm, { ano: 2026, mes: 8 })
    expect(escolha.base?.arquivoId).toBe('pc')
    expect(escolha.aditivos.map((a) => a.arquivoId)).toEqual(['pa-590'])
    expect(escolha.decisoes).toContainEqual({
      rotulo: 'TA 521-2025',
      papel: 'fora',
      motivo: 'prorrogação sem proposta (PA) no cadastro — a base continua a anterior',
    })
  })
})

describe('escolherDocumentos — bordas', () => {
  it('aditivo sem PA: fica fora e avisa', () => {
    const escolha = escolherDocumentos(
      [linha('CONTRATO', { pdf: 'pc' }), linha('ADITIVO', { numero: 'TA 03', data: d('2025-10-30') })],
      { ano: 2026, mes: 1 }
    )
    expect(escolha.aditivos).toEqual([])
    expect(escolha.avisos).toEqual([
      {
        codigo: 'aditivo-sem-pa',
        texto: 'TA 03 (aditivo de 30/10/2025): sem a proposta (PA) no cadastro — o relatório sai sem ele. Anexe a PA na linha do histórico do contrato ou envie o arquivo aqui.',
      },
    ])
  })

  it('termo sem data no cadastro: posicionado pela data da proposta, com aviso', () => {
    const escolha = escolherDocumentos(
      [linha('CONTRATO', { pdf: 'pc' }), linha('ADITIVO', { numero: 'TA 02', proposta: 'PA-SF-250806-091 v1.0', pdf: 'pa-02' })],
      { ano: 2026, mes: 1 }
    )
    expect(escolha.aditivos.map((a) => a.arquivoId)).toEqual(['pa-02'])
    expect(escolha.avisos[0]).toEqual({
      codigo: 'termo-sem-data',
      texto: 'TA 02: sem data de início nem de assinatura no cadastro — posicionado pela data da proposta (06/08/2025). Confira.',
    })
  })

  it('termo sem data nenhuma: fica fora, com aviso', () => {
    const escolha = escolherDocumentos([linha('CONTRATO', { pdf: 'pc' }), linha('ADITIVO', { numero: 'TA 09', pdf: 'x' })], { ano: 2026, mes: 1 })
    expect(escolha.aditivos).toEqual([])
    expect(escolha.decisoes).toContainEqual({ rotulo: 'TA 09', papel: 'fora', motivo: 'sem data no cadastro' })
    expect(escolha.avisos[0].codigo).toBe('termo-sem-data')
  })

  it('cancelado, em elaboração, rescisão e prospecção nunca entram', () => {
    const escolha = escolherDocumentos(
      [
        linha('CONTRATO', { pdf: 'pc' }),
        linha('ADITIVO', { numero: 'TA 01', data: d('2025-01-10'), situacao: 'Cancelado (não efetivado)', pdf: 'a' }),
        linha('ADITIVO', { numero: 'TA XX', dataInicio: d('2025-02-10'), situacao: 'Em elaboração', pdf: 'b' }),
        linha('RESCISAO', { numero: 'TRA 01', data: d('2025-03-10'), pdf: 'c' }),
        linha('PROSPECCAO', { data: d('2025-03-10'), pdf: 'e' }),
      ],
      { ano: 2026, mes: 1 }
    )
    expect(escolha.aditivos).toEqual([])
    expect(escolha.decisoes.map((x) => x.motivo)).toEqual([
      null,
      'cancelado ou não efetivado',
      'em elaboração',
      'rescisão',
      'prospecção',
    ])
  })

  it('a mesma PA em duas linhas vai uma vez só (o Confere bloqueia peça repetida)', () => {
    const escolha = escolherDocumentos(
      [
        linha('CONTRATO', { pdf: 'pc' }),
        linha('ADITIVO', { numero: 'TA 02', data: d('2025-01-10'), pdf: 'pa' }),
        linha('ADITIVO', { numero: 'TA 03', data: d('2025-02-10'), pdf: 'pa' }),
      ],
      { ano: 2026, mes: 1 }
    )
    expect(escolha.aditivos.map((a) => a.arquivoId)).toEqual(['pa'])
    expect(escolha.decisoes).toContainEqual({ rotulo: 'TA 03', papel: 'fora', motivo: 'mesma proposta de TA 02' })
    expect(escolha.alternativas.map((a) => a.arquivoId)).toEqual(['pc', 'pa'])
  })

  it('sem PC e sem renovação com PA: base vazia, aviso e os aditivos mesmo assim', () => {
    const escolha = escolherDocumentos(
      [linha('CONTRATO'), linha('ADITIVO', { numero: 'TA 01', data: d('2025-01-10'), pdf: 'pa' })],
      { ano: 2026, mes: 1 }
    )
    expect(escolha.base).toBeNull()
    expect(escolha.aditivos.map((a) => a.arquivoId)).toEqual(['pa'])
    expect(escolha.avisos.map((a) => a.codigo)).toEqual(['sem-proposta'])
    expect(escolha.decisoes[0]).toEqual({ rotulo: 'Contrato inicial', papel: 'fora', motivo: 'sem proposta (PC) no cadastro' })
  })
})

describe('dataDaProposta', () => {
  it.each([
    ['PA-SF-250806-091 v1.0', '2025-08-06'],
    ['PA-CGM- 250912-127 v4.0', '2025-09-12'],
    ['PC-SMT-210603-64 - v4.0', '2021-06-03'],
    ['PA-SUB-ITP-250101-12', '2025-01-01'],
    ['PA-PGM-260304-715 - Q-00715-5.pdf', '2026-03-04'],
  ])('%s', (codigo, iso) => {
    expect(dataDaProposta(codigo)?.toISOString().slice(0, 10)).toBe(iso)
  })

  it('sem código ou data impossível', () => {
    expect(dataDaProposta('proposta final.pdf')).toBeNull()
    expect(dataDaProposta('PA-SF-251345-091')).toBeNull()
    expect(dataDaProposta(null)).toBeNull()
  })
})

describe('avisoDeVigencia', () => {
  it('PGM, julho/2026: fora da vigência cadastrada, e diz qual renovação está sem data de fim', () => {
    const aviso = avisoDeVigencia({ ano: 2026, mes: 7 }, { vigenciaFim: d('2025-11-30'), inicio: d('2024-12-01') }, PGM)
    expect(aviso).toEqual({
      codigo: 'fora-da-vigencia',
      texto: 'Julho/2026 está depois do fim de vigência cadastrado (30/11/2025). TA 04 (renovação desde 01/12/2025) está sem data de fim no cadastro. Confira.',
    })
  })

  it('dentro da vigência: nada', () => {
    expect(avisoDeVigencia({ ano: 2026, mes: 7 }, { vigenciaFim: d('2027-06-30'), inicio: d('2024-07-01') }, SMIT)).toBeNull()
  })

  it('antes do início do contrato', () => {
    expect(avisoDeVigencia({ ano: 2024, mes: 5 }, { vigenciaFim: null, inicio: d('2024-12-01') }, [])).toEqual({
      codigo: 'fora-da-vigencia',
      texto: 'Maio/2024 é anterior ao início do contrato (01/12/2024). Confira.',
    })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/confere/documentos-do-contrato.test.ts`
Expected: FAIL — `Cannot find module './documentos-do-contrato'`.

- [ ] **Step 3: Implementar `src/lib/confere/documentos-do-contrato.ts`**

```ts
import {
  dataIsoParaTexto,
  nomeDaCompetencia,
  type AvisoDoCadastro,
  type Competencia,
  type DecisaoDoCadastro,
  type DocumentoDoCadastro,
  type TipoDaLinha,
} from './tipos-cadastro'

// Quais propostas do cadastro vão para o Confere numa competência — a regra da última renovação
// (docs/superpowers/specs/2026-09-25-confere-contrato-do-cadastro-design.md §5). Função pura: quem
// chama carrega o histórico do contrato.
//
// Por que a última renovação é a base: a proposta de prorrogação reapresenta o escopo inteiro num
// bloco sem rótulo, e o Confere ignora esse bloco quando ele chega como aditivo (ESPEC 046). Foi assim
// que a equipe do Confere montou o PGM (ESPEC 019) e o piloto do SMIT.

export interface LinhaDoHistorico {
  id: string
  tipo: TipoDaLinha
  numero: string | null
  /** "Assinada em". */
  data: Date | null
  dataInicio: Date | null
  dataVencimento: Date | null
  situacao: string | null
  /** Código da proposta digitado na linha ("PA-CGM-250403-035 v1.0"). */
  proposta: string | null
  createdAt: Date
  /** A PC/PA ligada à linha, se ainda está no repositório. */
  pdf: { arquivoId: string; nome: string } | null
}

export interface EscolhaDeDocumentos {
  base: DocumentoDoCadastro | null
  aditivos: DocumentoDoCadastro[]
  alternativas: DocumentoDoCadastro[]
  decisoes: DecisaoDoCadastro[]
  avisos: AvisoDoCadastro[]
}

// É assim que a sincronização do SharePoint grava termo que "não virou" ("Cancelado (não
// efetivado)") e termo sem número ainda sem assinatura ("Em elaboração").
const NAO_VALEU = /cancel|n[aã]o\s+efetiv/i
const EM_ANDAMENTO = /elabora|pendente|n[aã]o\s+assinad/i
// "PA-SF-250806-091", "PA-CGM- 250912-127", "PA-SUB-ITP-250101-12": a data da proposta é o AAMMDD.
const CODIGO_DA_PROPOSTA = /\bP[AC]\s*-\s*[A-Z0-9-]*?-\s*(\d{2})(\d{2})(\d{2})\s*-\s*\d+/i

const ROTULO_SEM_NUMERO: Record<TipoDaLinha, string> = {
  CONTRATO: 'Contrato inicial',
  ADITIVO: 'Aditivo sem número',
  PRORROGACAO: 'Prorrogação sem número',
  RESCISAO: 'Rescisão',
  PROSPECCAO: 'Prospecção',
}

export function rotuloDaLinha(linha: Pick<LinhaDoHistorico, 'tipo' | 'numero'>): string {
  if (linha.tipo === 'CONTRATO') return ROTULO_SEM_NUMERO.CONTRATO
  return linha.numero?.trim() || ROTULO_SEM_NUMERO[linha.tipo]
}

function iso(data: Date): string {
  return data.toISOString().slice(0, 10)
}

function texto(data: Date): string {
  return dataIsoParaTexto(iso(data))
}

function naoVale(situacao: string | null): string | null {
  if (situacao && NAO_VALEU.test(situacao)) return 'cancelado ou não efetivado'
  if (situacao && EM_ANDAMENTO.test(situacao)) return 'em elaboração'
  return null
}

/** "PA-SF-250806-091 v1.0" → 06/08/2025. `null` sem código ou com data impossível. */
export function dataDaProposta(codigo: string | null | undefined): Date | null {
  const achado = codigo ? CODIGO_DA_PROPOSTA.exec(codigo) : null
  if (!achado) return null
  const [ano, mes, dia] = [2000 + Number(achado[1]), Number(achado[2]), Number(achado[3])]
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  return data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia ? data : null
}

interface Posicionada {
  linha: LinhaDoHistorico
  /** Quando a linha passa a valer; `null` na linha CONTRATO (vale sempre) e na sem data nenhuma. */
  inicio: Date | null
  /** Posicionada pela data do código da proposta, não pelo cadastro. */
  pelaProposta: boolean
}

function posicionar(linha: LinhaDoHistorico): Posicionada {
  if (linha.tipo === 'CONTRATO') return { linha, inicio: null, pelaProposta: false }
  const doCadastro = linha.dataInicio ?? linha.data
  if (doCadastro) return { linha, inicio: doCadastro, pelaProposta: false }
  const daProposta = dataDaProposta(linha.proposta) ?? dataDaProposta(linha.pdf?.nome)
  return { linha, inicio: daProposta, pelaProposta: daProposta !== null }
}

/** Contrato inicial primeiro; depois pelo início; sem data nenhuma, no fim. */
function porOrdem(a: Posicionada, b: Posicionada): number {
  const chave = (p: Posicionada) => (p.linha.tipo === 'CONTRATO' ? -Infinity : (p.inicio?.getTime() ?? Infinity))
  return chave(a) - chave(b) || a.linha.createdAt.getTime() - b.linha.createdAt.getTime()
}

function documento(p: Posicionada): DocumentoDoCadastro {
  const inicio = p.inicio ?? p.linha.dataInicio ?? p.linha.data
  return {
    arquivoId: p.linha.pdf!.arquivoId,
    nome: p.linha.pdf!.nome,
    origem: { tipo: p.linha.tipo, numero: p.linha.numero, inicio: inicio ? iso(inicio) : null },
  }
}

export function escolherDocumentos(linhas: LinhaDoHistorico[], competencia: Competencia): EscolhaDeDocumentos {
  // Vale o que começou até o último dia do mês: compara com o primeiro dia do mês seguinte.
  const fimDaCompetencia = Date.UTC(competencia.ano, competencia.mes, 1)
  const ordenadas = linhas.map(posicionar).sort(porOrdem)
  const avisos: AvisoDoCadastro[] = []
  const fora = new Map<Posicionada, string>()

  for (const p of ordenadas) {
    const { linha } = p
    const rotulo = rotuloDaLinha(linha)
    if (linha.tipo === 'RESCISAO' || linha.tipo === 'PROSPECCAO') {
      fora.set(p, linha.tipo === 'RESCISAO' ? 'rescisão' : 'prospecção')
    } else if (linha.tipo === 'CONTRATO') {
      continue
    } else if (naoVale(linha.situacao)) {
      fora.set(p, naoVale(linha.situacao)!)
    } else if (!p.inicio) {
      fora.set(p, 'sem data no cadastro')
      avisos.push({
        codigo: 'termo-sem-data',
        texto: `${rotulo}: sem data de início nem de assinatura no cadastro, e sem data no código da proposta — ficou fora. Confira.`,
      })
    } else if (p.inicio.getTime() >= fimDaCompetencia) {
      fora.set(p, `começa depois da competência (${texto(p.inicio)})`)
    } else if (p.pelaProposta) {
      avisos.push({
        codigo: 'termo-sem-data',
        texto: `${rotulo}: sem data de início nem de assinatura no cadastro — posicionado pela data da proposta (${texto(p.inicio)}). Confira.`,
      })
    }
  }

  const valem = ordenadas.filter((p) => !fora.has(p))
  const renovacoes = valem.filter((p) => p.linha.tipo === 'PRORROGACAO' && p.linha.pdf)
  const base = renovacoes.at(-1) ?? valem.find((p) => p.linha.tipo === 'CONTRATO' && p.linha.pdf) ?? null
  const baseEhRenovacao = base?.linha.tipo === 'PRORROGACAO'
  const posicaoDaBase = base ? valem.indexOf(base) : -1

  const aditivos: DocumentoDoCadastro[] = []
  const usadoEm = new Map<string, string>()
  if (base) usadoEm.set(base.linha.pdf!.arquivoId, rotuloDaLinha(base.linha))

  valem.forEach((p, posicao) => {
    if (p === base) return
    const { linha } = p
    const rotulo = rotuloDaLinha(linha)
    if (baseEhRenovacao && posicao < posicaoDaBase) {
      fora.set(p, `já está dentro da renovação ${rotuloDaLinha(base!.linha)}`)
    } else if (linha.tipo === 'CONTRATO') {
      fora.set(p, linha.pdf ? 'outra linha de contrato inicial no cadastro' : 'sem proposta (PC) no cadastro')
    } else if (linha.tipo === 'PRORROGACAO') {
      fora.set(p, 'prorrogação sem proposta (PA) no cadastro — a base continua a anterior')
    } else if (!linha.pdf) {
      fora.set(p, 'sem proposta (PA) no cadastro')
      avisos.push({
        codigo: 'aditivo-sem-pa',
        texto: `${rotulo} (aditivo de ${texto(p.inicio!)}): sem a proposta (PA) no cadastro — o relatório sai sem ele. Anexe a PA na linha do histórico do contrato ou envie o arquivo aqui.`,
      })
    } else if (usadoEm.has(linha.pdf.arquivoId)) {
      fora.set(p, `mesma proposta de ${usadoEm.get(linha.pdf.arquivoId)}`)
    } else {
      usadoEm.set(linha.pdf.arquivoId, rotulo)
      aditivos.push(documento(p))
    }
  })

  if (!base) {
    avisos.push({
      codigo: 'sem-proposta',
      texto: 'Este contrato não tem proposta (PC) nem renovação com proposta (PA) no cadastro — escolha uma das propostas do cliente ou envie do computador.',
    })
  }

  const decisoes: DecisaoDoCadastro[] = ordenadas.map((p) => ({
    rotulo: rotuloDaLinha(p.linha),
    papel: p === base ? 'base' : fora.has(p) ? 'fora' : 'aditivo',
    motivo: fora.get(p) ?? null,
  }))

  const alternativas: DocumentoDoCadastro[] = []
  const vistas = new Set<string>()
  for (const p of ordenadas) {
    if (!p.linha.pdf || vistas.has(p.linha.pdf.arquivoId)) continue
    vistas.add(p.linha.pdf.arquivoId)
    alternativas.push(documento(p))
  }

  return { base: base ? documento(base) : null, aditivos, alternativas, decisoes, avisos }
}

/** Competência fora da vigência do contrato (decisão do usuário, 25/09/2026). Não impede nada; quando
 *  o motivo provável é cadastro incompleto — renovação sem data de fim —, diz qual. */
export function avisoDeVigencia(
  competencia: Competencia,
  contrato: { vigenciaFim: Date | null; inicio: Date | null },
  linhas: LinhaDoHistorico[]
): AvisoDoCadastro | null {
  const primeiroDia = Date.UTC(competencia.ano, competencia.mes - 1, 1)
  const fimDaCompetencia = Date.UTC(competencia.ano, competencia.mes, 1)
  const nome = nomeDaCompetencia(competencia)
  const nomeMaiusculo = nome.charAt(0).toUpperCase() + nome.slice(1)

  if (contrato.vigenciaFim && primeiroDia > contrato.vigenciaFim.getTime()) {
    const renovacaoSemFim = linhas.find((linha) => {
      const inicio = linha.dataInicio ?? linha.data
      return (
        linha.tipo === 'PRORROGACAO' &&
        !linha.dataVencimento &&
        inicio !== null &&
        inicio.getTime() < fimDaCompetencia &&
        !naoVale(linha.situacao)
      )
    })
    const detalhe = renovacaoSemFim
      ? ` ${rotuloDaLinha(renovacaoSemFim)} (renovação desde ${texto((renovacaoSemFim.dataInicio ?? renovacaoSemFim.data)!)}) está sem data de fim no cadastro.`
      : ''
    return {
      codigo: 'fora-da-vigencia',
      texto: `${nomeMaiusculo} está depois do fim de vigência cadastrado (${texto(contrato.vigenciaFim)}).${detalhe} Confira.`,
    }
  }
  if (contrato.inicio && fimDaCompetencia <= contrato.inicio.getTime()) {
    return { codigo: 'fora-da-vigencia', texto: `${nomeMaiusculo} é anterior ao início do contrato (${texto(contrato.inicio)}). Confira.` }
  }
  return null
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/lib/confere/documentos-do-contrato.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/confere/documentos-do-contrato.ts src/lib/confere/documentos-do-contrato.test.ts
git commit -m "feat(confere): regra da última renovação para escolher proposta e aditivos"
```

---

### Task 3: Localizar o contrato da planilha

**Files:**
- Create: `src/lib/confere/localizar-contrato.ts`
- Test: `src/lib/confere/localizar-contrato.test.ts`

**Interfaces:**
- Consumes: `IdentidadeDoContrato` (Task 1); `chaveExata` (`src/lib/relatorios-clientes/vincular-itens.ts`); `chaveDoNome` (`src/lib/importacao-sharepoint/estrutura.ts`).
- Produces: `ContratoParaBusca` (`{ id, clienteId, clienteNome, clienteSigla, numeroTermo, chaveSharepoint }`), `ResultadoDaLocalizacao` (`encontrado | ambiguo | nenhum{ mesmoNumero, doOrgao }`), `localizarContrato(identidade, contratos)`, `siglaParecida(orgao, contrato)`.

- [ ] **Step 1: Escrever os testes que falham** — `src/lib/confere/localizar-contrato.test.ts`

```ts
/** @jest-environment node */
import { localizarContrato, type ContratoParaBusca } from './localizar-contrato'

function contrato(id: string, sigla: string | null, numeroTermo: string | null, chaveSharepoint: string | null): ContratoParaBusca {
  return { id, clienteId: `cl-${sigla}`, clienteNome: `Cliente ${sigla}`, clienteSigla: sigla, numeroTermo, chaveSharepoint }
}

// Recorte do cadastro de desenvolvimento (25/09/2026): números que se repetem entre clientes.
const CADASTRO = [
  contrato('pgm-15', 'PGM', 'TC 015/PGM/2024', 'PGM|15 2024'),
  contrato('smit-15', 'SMIT', 'TC 15/SMIT/2024', 'SMIT|15 2024'),
  contrato('cgm-16', 'CGM', 'TC 16/CGM/2024', 'CGM|16 2024'),
  contrato('spurb-16', 'SPURBANISMO', 'TC 16/2024', 'SPURBANISMO|16 2024'),
  contrato('ftm-94', 'FTM', 'TC 094/FTMSP/2024', 'FTM|94 2024'),
  contrato('hspm-387', 'HSPM', 'TC 387/2024/HSPM', 'HSPM|387 2024'),
  contrato('sf-10', 'SF', 'TC 010/2024', 'SF|10 2024'),
  contrato('seme-31', 'SEME', '031/SEME/2017', null),
  contrato('smit-52', 'SMIT', 'TC 52/SMIT/2024', 'SMIT|52 2024'),
]

describe('localizarContrato', () => {
  it('chave exata, com zero à esquerda, sem confundir o mesmo número de outro cliente', () => {
    expect(localizarContrato({ base: 15, orgao: 'PGM', ano: '2024' }, CADASTRO)).toEqual({ tipo: 'encontrado', contrato: CADASTRO[0] })
    expect(localizarContrato({ base: 16, orgao: 'CGM', ano: '2024' }, CADASTRO)).toEqual({ tipo: 'encontrado', contrato: CADASTRO[2] })
  })

  it('sigla parecida: FTMSP na planilha, FTM no cadastro', () => {
    expect(localizarContrato({ base: 94, orgao: 'FTMSP', ano: '2024' }, CADASTRO)).toEqual({ tipo: 'encontrado', contrato: CADASTRO[4] })
  })

  it('sigla curta não casa por prefixo (SF não é SFM)', () => {
    expect(localizarContrato({ base: 10, orgao: 'SFM', ano: '2024' }, CADASTRO)).toEqual({
      tipo: 'nenhum',
      mesmoNumero: [CADASTRO[6]],
      doOrgao: [],
    })
  })

  it('sem órgão: um só com o número e o ano', () => {
    expect(localizarContrato({ base: 387, orgao: null, ano: '2024' }, CADASTRO)).toEqual({ tipo: 'encontrado', contrato: CADASTRO[5] })
  })

  it('sem órgão e mais de um: lista para escolher', () => {
    expect(localizarContrato({ base: 16, orgao: null, ano: '2024' }, CADASTRO)).toEqual({
      tipo: 'ambiguo',
      candidatos: [CADASTRO[2], CADASTRO[3]],
    })
  })

  it('contrato do legado, sem chave do SharePoint', () => {
    expect(localizarContrato({ base: 31, orgao: 'SEME', ano: '2017' }, CADASTRO)).toEqual({ tipo: 'encontrado', contrato: CADASTRO[7] })
  })

  it('chave repetida no cadastro: não escolhe sozinho', () => {
    const duplicado = contrato('smit-52-b', 'SMIT', 'TC 52/SMIT/2024', 'SMIT|52 2024')
    expect(localizarContrato({ base: 52, orgao: 'SMIT', ano: '2024' }, [...CADASTRO, duplicado])).toEqual({
      tipo: 'ambiguo',
      candidatos: [CADASTRO[8], duplicado],
    })
  })

  it('não achou: os contratos do órgão ficam como sugestão', () => {
    expect(localizarContrato({ base: 99, orgao: 'SMIT', ano: '2026' }, CADASTRO)).toEqual({
      tipo: 'nenhum',
      mesmoNumero: [],
      doOrgao: [CADASTRO[1], CADASTRO[8]],
    })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/confere/localizar-contrato.test.ts`
Expected: FAIL — `Cannot find module './localizar-contrato'`.

- [ ] **Step 3: Implementar `src/lib/confere/localizar-contrato.ts`**

```ts
import { chaveDoNome } from '@/lib/importacao-sharepoint/estrutura'
import { chaveExata } from '@/lib/relatorios-clientes/vincular-itens'

import type { IdentidadeDoContrato } from './identidade'

// Qual contrato do cadastro é o da planilha (desenho §6.2). Regra de ouro do projeto: só escolhe
// sozinho quando o candidato é ÚNICO — dois candidatos viram lista para a pessoa escolher. Quem chama
// passa só os contratos de clientes que a pessoa pode ver.

export interface ContratoParaBusca {
  id: string
  clienteId: string
  clienteNome: string
  clienteSigla: string | null
  numeroTermo: string | null
  chaveSharepoint: string | null
}

export type ResultadoDaLocalizacao =
  | { tipo: 'encontrado'; contrato: ContratoParaBusca }
  | { tipo: 'ambiguo'; candidatos: ContratoParaBusca[] }
  | { tipo: 'nenhum'; mesmoNumero: ContratoParaBusca[]; doOrgao: ContratoParaBusca[] }

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()
}

/** "SMIT|52 2024" → "52 2024"; sem chave, o número e o ano do nº do termo ("031/SEME/2017" → "31 2017"). */
function numeroEAno(contrato: ContratoParaBusca): string | null {
  if (contrato.chaveSharepoint) return contrato.chaveSharepoint.split('|')[1] ?? null
  const chave = contrato.numeroTermo ? chaveDoNome(contrato.numeroTermo) : null
  return chave ? `${chave.numero} ${chave.ano}` : null
}

/** O órgão escrito na planilha é o do cliente: sigla igual; uma começando com a outra, com pelo menos
 *  3 letras ("FTMSP"/"FTM" — "SF" não casa com "SFM"); ou o nº do termo citando o órgão. */
export function siglaParecida(orgao: string, contrato: ContratoParaBusca): boolean {
  const o = normalizar(orgao)
  const sigla = normalizar(contrato.clienteSigla ?? '')
  if (sigla && sigla === o) return true
  const menor = Math.min(sigla.length, o.length)
  if (menor >= 3 && (sigla.startsWith(o) || o.startsWith(sigla))) return true
  return (chaveExata(contrato.numeroTermo) ?? '').split(' ').includes(o.toLowerCase())
}

export function localizarContrato(identidade: IdentidadeDoContrato, contratos: ContratoParaBusca[]): ResultadoDaLocalizacao {
  const alvo = `${identidade.base} ${identidade.ano}`
  const mesmoNumero = contratos.filter((c) => numeroEAno(c) === alvo)

  if (!identidade.orgao) {
    if (mesmoNumero.length === 1) return { tipo: 'encontrado', contrato: mesmoNumero[0] }
    if (mesmoNumero.length > 1) return { tipo: 'ambiguo', candidatos: mesmoNumero }
    return { tipo: 'nenhum', mesmoNumero: [], doOrgao: [] }
  }

  const orgao = identidade.orgao
  const chave = normalizar(`${orgao}|${alvo}`)
  const exatos = contratos.filter((c) => c.chaveSharepoint !== null && normalizar(c.chaveSharepoint) === chave)
  if (exatos.length === 1) return { tipo: 'encontrado', contrato: exatos[0] }
  if (exatos.length > 1) return { tipo: 'ambiguo', candidatos: exatos }

  const parecidos = mesmoNumero.filter((c) => siglaParecida(orgao, c))
  if (parecidos.length === 1) return { tipo: 'encontrado', contrato: parecidos[0] }
  if (parecidos.length > 1) return { tipo: 'ambiguo', candidatos: parecidos }

  return { tipo: 'nenhum', mesmoNumero, doOrgao: contratos.filter((c) => siglaParecida(orgao, c)) }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/lib/confere/localizar-contrato.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/confere/localizar-contrato.ts src/lib/confere/localizar-contrato.test.ts
git commit -m "feat(confere): acha o contrato da planilha no cadastro — só escolhe sozinho quando é único"
```

---

### Task 4: Serviço do cadastro (banco)

**Files:**
- Create: `src/lib/confere/cadastro.ts`
- Test: `src/lib/confere/cadastro.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3; `consolidarContratos` (`src/lib/relatorios-clientes/contratos-consolidados.ts`); `clienteIdsPermitidos` (`src/lib/visibilidade.ts`); `getUpload` (`src/lib/storage.ts`); `AuthUser` (`src/lib/auth.ts`).
- Produces: `identificarLevantamento(usuario, conteudo, hoje?)`, `documentosDoContrato(usuario, contratoId, competencia, lidaDaPlanilha)`, `buscarContratos(usuario, texto)`, `competenciaAtual(hoje?)`, `contratoDoUsuario(usuario, contratoId): Promise<{ id: string; clienteId: string } | null>`, `carregarArquivosDoCadastro(usuario, ids, clienteId): Promise<Map<string, ArquivoBaixado>>`, `ArquivoBaixado` (`{ nome: string; bytes: Buffer }`), `ArquivoDoCadastroRecusado` (`.status`).

- [ ] **Step 1: Escrever os testes que falham** — `src/lib/confere/cadastro.test.ts`

```ts
/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    contrato: { findMany: jest.fn(), findFirst: jest.fn() },
    historicoContrato: { findMany: jest.fn() },
    arquivoCliente: { findMany: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/relatorios-clientes/contratos-consolidados', () => ({ consolidarContratos: jest.fn() }))
jest.mock('@/lib/storage', () => ({ getUpload: jest.fn() }))

import { prisma } from '@/lib/prisma'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { getUpload } from '@/lib/storage'

import {
  ArquivoDoCadastroRecusado,
  buscarContratos,
  carregarArquivosDoCadastro,
  documentosDoContrato,
  identificarLevantamento,
} from './cadastro'
import { MENSAGEM_NAO_ABRE } from './levantamento'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const d = (iso: string) => new Date(`${iso}T00:00:00Z`)
const LEVANTAMENTO_SMIT = readFileSync(path.join(process.cwd(), 'services/confere/backend/tests/fixtures/levantamento.xlsx'))

const CONTRATO_SMIT = {
  id: 'ct-smit',
  clienteId: 'cl-smit',
  numeroTermo: 'TC 52/SMIT/2024',
  chaveSharepoint: 'SMIT|52 2024',
  descricao: 'Sustentação',
  situacao: null,
  dataInicio: null,
  dataVencimento: null,
  cliente: { nome: 'Secretaria Municipal de Inovação e Tecnologia', siglaLegado: 'SMIT' },
}
const CONTRATO_OUTRO = { ...CONTRATO_SMIT, id: 'ct-12', numeroTermo: 'TC 12/SMIT/2025', chaveSharepoint: 'SMIT|12 2025', descricao: null }

function linhaSmit(id: string, tipo: string, numero: string | null, inicio: string, pdf: string) {
  return {
    id, tipo, numero, data: null, dataInicio: d(inicio), dataVencimento: null, situacao: null, proposta: null,
    createdAt: d(inicio), propostaArquivo: { id: pdf, nome: `${pdf}.pdf`, removidoEm: null },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([CONTRATO_SMIT, CONTRATO_OUTRO])
  ;(prisma.historicoContrato.findMany as jest.Mock).mockResolvedValue([
    linhaSmit('l1', 'CONTRATO', 'TC 52/SMIT/2024', '2024-07-01', 'pc-smit'),
    linhaSmit('l2', 'PRORROGACAO', 'TA 01', '2025-07-01', 'pa-smit-01'),
    linhaSmit('l3', 'PRORROGACAO', 'TA 02', '2026-07-01', 'pa-smit-02'),
  ])
  ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([])
  ;(consolidarContratos as jest.Mock).mockImplementation(
    async (lista: Array<{ id: string }>) => new Map(lista.map((c) => [c.id, { vigenciaFim: d('2027-06-30'), ativo: true }]))
  )
})

describe('identificarLevantamento', () => {
  it('planilha real do SMIT: acha o contrato e escolhe a renovação TA 02 para julho/2026', async () => {
    const resposta = await identificarLevantamento(admin, LEVANTAMENTO_SMIT)
    expect(resposta.situacao).toBe('encontrado')
    if (resposta.situacao !== 'encontrado') return
    expect(resposta.leitura).toEqual({ referencia: 'TC 52/SMIT/2024', competencia: { ano: 2026, mes: 7 } })
    expect(resposta.documentos.contrato).toMatchObject({ id: 'ct-smit', numeroTermo: 'TC 52/SMIT/2024', vigenciaFim: '2027-06-30', ativo: true })
    expect(resposta.documentos.competencia).toEqual({ ano: 2026, mes: 7, lidaDaPlanilha: true })
    expect(resposta.documentos.base?.arquivoId).toBe('pa-smit-02')
    expect(prisma.historicoContrato.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { contratoId: 'ct-smit' } }))
  })

  it('só procura entre os clientes que a pessoa pode ver', async () => {
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([])
    const resposta = await identificarLevantamento(comum, LEVANTAMENTO_SMIT)
    expect(prisma.contrato.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { clienteId: { in: [] } } }))
    expect(resposta).toMatchObject({ situacao: 'nao-encontrado', sugestoes: [] })
  })

  it('planilha que não abre', async () => {
    await expect(identificarLevantamento(admin, new TextEncoder().encode('x'))).resolves.toEqual({
      situacao: 'ilegivel',
      mensagem: MENSAGEM_NAO_ABRE,
    })
  })
})

describe('documentosDoContrato', () => {
  it('contrato que a pessoa não vê (ou não existe): null', async () => {
    ;(prisma.contrato.findFirst as jest.Mock).mockResolvedValue(null)
    await expect(documentosDoContrato(admin, 'ct-x', { ano: 2026, mes: 7 }, true)).resolves.toBeNull()
  })

  it('contrato sem proposta nenhuma: as propostas soltas do cliente entram como alternativa', async () => {
    ;(prisma.contrato.findFirst as jest.Mock).mockResolvedValue(CONTRATO_SMIT)
    ;(prisma.historicoContrato.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([{ id: 'solta', nome: 'PC-SMIT-solta.pdf' }])
    const documentos = await documentosDoContrato(admin, 'ct-smit', { ano: 2026, mes: 7 }, false)
    expect(documentos?.base).toBeNull()
    expect(documentos?.alternativas).toEqual([{ arquivoId: 'solta', nome: 'PC-SMIT-solta.pdf', origem: null }])
    expect(documentos?.competencia).toEqual({ ano: 2026, mes: 7, lidaDaPlanilha: false })
    expect(documentos?.avisos.map((a) => a.codigo)).toContain('sem-proposta')
  })
})

describe('buscarContratos', () => {
  it('cada palavra casa com o começo de alguma palavra do contrato ou do cliente', async () => {
    const achados = await buscarContratos(admin, '52 smit')
    expect(achados.map((c) => c.id)).toEqual(['ct-smit'])
  })

  it('busca vazia não consulta', async () => {
    await expect(buscarContratos(admin, '  ')).resolves.toEqual([])
    expect(prisma.contrato.findMany).not.toHaveBeenCalled()
  })
})

describe('carregarArquivosDoCadastro', () => {
  const PC = { id: 'pc', clienteId: 'cl-smit', nome: 'PC.pdf', extensao: 'pdf', urlBlob: 'r2:x', removidoEm: null }

  it('baixa os PDFs pedidos', async () => {
    ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([PC])
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('%PDF'))
    const arquivos = await carregarArquivosDoCadastro(admin, ['pc', 'pc'], 'cl-smit')
    expect(arquivos.get('pc')).toEqual({ nome: 'PC.pdf', bytes: Buffer.from('%PDF') })
    expect(getUpload).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['removido', { ...PC, removidoEm: new Date() }, 409],
    ['não é PDF', { ...PC, extensao: 'xlsx' }, 400],
    ['de outro cliente', { ...PC, clienteId: 'cl-outro' }, 400],
  ])('recusa arquivo %s', async (_caso, arquivo, status) => {
    ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([arquivo])
    await expect(carregarArquivosDoCadastro(admin, ['pc'], 'cl-smit')).rejects.toMatchObject({ status })
  })

  it('arquivo de cliente sem permissão é tratado como inexistente', async () => {
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'cl-outro' }] })
    ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([PC])
    await expect(carregarArquivosDoCadastro(comum, ['pc'], null)).rejects.toMatchObject({ status: 404 })
  })

  it('falha no storage vira 502 com o nome do arquivo', async () => {
    ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([PC])
    ;(getUpload as jest.Mock).mockRejectedValue(new Error('R2 fora'))
    const promessa = carregarArquivosDoCadastro(admin, ['pc'], null)
    await expect(promessa).rejects.toBeInstanceOf(ArquivoDoCadastroRecusado)
    await expect(carregarArquivosDoCadastro(admin, ['pc'], null)).rejects.toMatchObject({ status: 502, message: expect.stringContaining('PC.pdf') })
  })

  it('sem ids, nem consulta', async () => {
    await expect(carregarArquivosDoCadastro(admin, [], null)).resolves.toEqual(new Map())
    expect(prisma.arquivoCliente.findMany).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/confere/cadastro.test.ts`
Expected: FAIL — `Cannot find module './cadastro'`.

- [ ] **Step 3: Implementar `src/lib/confere/cadastro.ts`**

```ts
import type { Prisma } from '@prisma/client'

import type { AuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { chaveExata } from '@/lib/relatorios-clientes/vincular-itens'
import { getUpload } from '@/lib/storage'
import { clienteIdsPermitidos } from '@/lib/visibilidade'

import { avisoDeVigencia, escolherDocumentos, type LinhaDoHistorico } from './documentos-do-contrato'
import { identidadeDoContrato } from './identidade'
import { competenciaDaData, lerCabecalhoDoLevantamento, LevantamentoIlegivel } from './levantamento'
import { localizarContrato, type ContratoParaBusca } from './localizar-contrato'
import type {
  Competencia,
  DocumentoDoCadastro,
  DocumentosDoContrato,
  RespostaDaIdentificacao,
  ResumoDoContrato,
} from './tipos-cadastro'

// O lado do banco de "o levantamento busca o contrato" (docs/superpowers/specs/2026-09-25-confere-
// contrato-do-cadastro-design.md): acha o contrato entre os que a pessoa pode ver, resume pelo
// `consolidarContratos()` (regra única de contrato — CLAUDE.md) e carrega o histórico para a regra de
// escolha. Só leitura; `carregarArquivosDoCadastro` baixa os PDFs pedidos na geração.

const SELECAO_CONTRATO = {
  id: true,
  clienteId: true,
  numeroTermo: true,
  chaveSharepoint: true,
  descricao: true,
  situacao: true,
  dataInicio: true,
  dataVencimento: true,
  cliente: { select: { nome: true, siglaLegado: true } },
} satisfies Prisma.ContratoSelect

type ContratoCarregado = Prisma.ContratoGetPayload<{ select: typeof SELECAO_CONTRATO }>

const SELECAO_LINHA = {
  id: true,
  tipo: true,
  numero: true,
  data: true,
  dataInicio: true,
  dataVencimento: true,
  situacao: true,
  proposta: true,
  createdAt: true,
  propostaArquivo: { select: { id: true, nome: true, removidoEm: true } },
} satisfies Prisma.HistoricoContratoSelect

const MAXIMO_DE_SUGESTOES = 12
const MAXIMO_DA_BUSCA = 20

async function filtroDeClientes(usuario: AuthUser): Promise<Prisma.ContratoWhereInput> {
  const ids = await clienteIdsPermitidos(usuario)
  return ids === null ? {} : { clienteId: { in: ids } }
}

function paraBusca(contrato: ContratoCarregado): ContratoParaBusca {
  return {
    id: contrato.id,
    clienteId: contrato.clienteId,
    clienteNome: contrato.cliente.nome,
    clienteSigla: contrato.cliente.siglaLegado,
    numeroTermo: contrato.numeroTermo,
    chaveSharepoint: contrato.chaveSharepoint,
  }
}

function iso(data: Date | null | undefined): string | null {
  return data ? data.toISOString().slice(0, 10) : null
}

/** Número, cliente, vigência e se está ativo — sempre pelo `consolidarContratos()`. */
async function resumir(contratos: ContratoCarregado[]): Promise<ResumoDoContrato[]> {
  if (contratos.length === 0) return []
  const consolidados = await consolidarContratos(
    contratos.map((c) => ({ id: c.id, situacao: c.situacao, dataVencimento: c.dataVencimento }))
  )
  return contratos.map((c) => ({
    id: c.id,
    clienteId: c.clienteId,
    clienteNome: c.cliente.nome,
    clienteSigla: c.cliente.siglaLegado,
    numeroTermo: c.numeroTermo,
    descricao: c.descricao,
    vigenciaFim: iso(consolidados.get(c.id)?.vigenciaFim),
    ativo: consolidados.get(c.id)?.ativo ?? false,
  }))
}

/** Ativos primeiro; depois pelo número do termo. */
function porNumero(a: ResumoDoContrato, b: ResumoDoContrato): number {
  return (
    Number(b.ativo) - Number(a.ativo) ||
    (a.numeroTermo ?? '').localeCompare(b.numeroTermo ?? '', 'pt-BR', { numeric: true })
  )
}

/** As propostas do cliente fora do histórico deste contrato — para o contrato sem nenhuma (§6.3). */
async function propostasSoltas(clienteId: string, jaListadas: DocumentoDoCadastro[]): Promise<DocumentoDoCadastro[]> {
  const listadas = new Set(jaListadas.map((d) => d.arquivoId))
  const arquivos = await prisma.arquivoCliente.findMany({
    where: {
      clienteId,
      removidoEm: null,
      extensao: 'pdf',
      categoria: { in: ['PROPOSTA_COMERCIAL', 'PROPOSTA_ADITIVO'] },
    },
    select: { id: true, nome: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  return arquivos.filter((a) => !listadas.has(a.id)).map((a) => ({ arquivoId: a.id, nome: a.nome, origem: null }))
}

async function carregarDocumentos(
  contrato: ContratoCarregado,
  competencia: Competencia,
  lidaDaPlanilha: boolean
): Promise<DocumentosDoContrato> {
  const [brutas, [resumo]] = await Promise.all([
    prisma.historicoContrato.findMany({ where: { contratoId: contrato.id }, select: SELECAO_LINHA }),
    resumir([contrato]),
  ])
  const linhas: LinhaDoHistorico[] = brutas.map(({ propostaArquivo, ...linha }) => ({
    ...linha,
    pdf: propostaArquivo && !propostaArquivo.removidoEm ? { arquivoId: propostaArquivo.id, nome: propostaArquivo.nome } : null,
  }))
  const escolha = escolherDocumentos(linhas, competencia)
  const inicio = contrato.dataInicio ?? linhas.find((l) => l.tipo === 'CONTRATO')?.dataInicio ?? null
  const vigenciaFim = resumo.vigenciaFim ? new Date(`${resumo.vigenciaFim}T00:00:00Z`) : null
  const vigencia = avisoDeVigencia(competencia, { vigenciaFim, inicio }, linhas)
  const alternativas = escolha.base
    ? escolha.alternativas
    : [...escolha.alternativas, ...(await propostasSoltas(contrato.clienteId, escolha.alternativas))]
  return {
    contrato: resumo,
    competencia: { ...competencia, lidaDaPlanilha },
    base: escolha.base,
    aditivos: escolha.aditivos,
    alternativas,
    decisoes: escolha.decisoes,
    avisos: vigencia ? [...escolha.avisos, vigencia] : escolha.avisos,
  }
}

/** Sem "Data do Levantamento", a competência de referência é o mês atual (desenho §6.5). */
export function competenciaAtual(hoje: Date = new Date()): Competencia {
  return { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 }
}

/** Contrato escolhido à mão (empate, sugestão, "trocar contrato"). `null` quando não existe ou é de
 *  cliente que a pessoa não vê. */
export async function documentosDoContrato(
  usuario: AuthUser,
  contratoId: string,
  competencia: Competencia,
  lidaDaPlanilha: boolean
): Promise<DocumentosDoContrato | null> {
  const contrato = await prisma.contrato.findFirst({
    where: { id: contratoId, ...(await filtroDeClientes(usuario)) },
    select: SELECAO_CONTRATO,
  })
  return contrato ? carregarDocumentos(contrato, competencia, lidaDaPlanilha) : null
}

export async function identificarLevantamento(
  usuario: AuthUser,
  conteudo: ArrayBuffer | Uint8Array,
  hoje: Date = new Date()
): Promise<RespostaDaIdentificacao> {
  let cabecalho
  try {
    cabecalho = await lerCabecalhoDoLevantamento(conteudo)
  } catch (erro) {
    if (erro instanceof LevantamentoIlegivel) return { situacao: 'ilegivel', mensagem: erro.message }
    throw erro
  }
  const competenciaLida = competenciaDaData(cabecalho.dataLevantamento)
  const leitura = { referencia: cabecalho.contratoReferencia, competencia: competenciaLida }
  const identidade = identidadeDoContrato(cabecalho.contratoReferencia, cabecalho.titulo)
  if (!identidade) return { situacao: 'sem-referencia', leitura }

  const contratos = await prisma.contrato.findMany({ where: await filtroDeClientes(usuario), select: SELECAO_CONTRATO })
  const porId = new Map(contratos.map((c) => [c.id, c]))
  const carregados = (lista: ContratoParaBusca[]) => lista.map((c) => porId.get(c.id)!)
  const resultado = localizarContrato(identidade, contratos.map(paraBusca))

  if (resultado.tipo === 'encontrado') {
    const documentos = await carregarDocumentos(
      porId.get(resultado.contrato.id)!,
      competenciaLida ?? competenciaAtual(hoje),
      competenciaLida !== null
    )
    return { situacao: 'encontrado', leitura, documentos }
  }
  if (resultado.tipo === 'ambiguo') {
    return { situacao: 'ambiguo', leitura, candidatos: (await resumir(carregados(resultado.candidatos))).sort(porNumero) }
  }
  const doOrgao = new Set(resultado.doOrgao.map((c) => c.id))
  const outros = resultado.mesmoNumero.filter((c) => !doOrgao.has(c.id))
  const resumos = await resumir(carregados([...resultado.doOrgao, ...outros]))
  const sugestoes = [
    ...resumos.filter((r) => doOrgao.has(r.id) && r.ativo).sort(porNumero),
    ...resumos.filter((r) => !doOrgao.has(r.id)).sort(porNumero),
  ]
  return { situacao: 'nao-encontrado', leitura, sugestoes: sugestoes.slice(0, MAXIMO_DE_SUGESTOES) }
}

/** Busca livre (desenho §6.4): cada palavra digitada casa com o começo de alguma palavra do número,
 *  da sigla, do nome do cliente ou da descrição. */
export async function buscarContratos(usuario: AuthUser, texto: string): Promise<ResumoDoContrato[]> {
  const termos = (chaveExata(texto) ?? '').split(' ').filter(Boolean)
  if (termos.length === 0) return []
  const contratos = await prisma.contrato.findMany({ where: await filtroDeClientes(usuario), select: SELECAO_CONTRATO })
  const achados = contratos.filter((c) => {
    const palavras = (
      chaveExata(
        [c.numeroTermo, c.chaveSharepoint?.replace('|', ' '), c.cliente.siglaLegado, c.cliente.nome, c.descricao]
          .filter(Boolean)
          .join(' ')
      ) ?? ''
    ).split(' ')
    return termos.every((termo) => palavras.some((palavra) => palavra.startsWith(termo)))
  })
  return (await resumir(achados)).sort(porNumero).slice(0, MAXIMO_DA_BUSCA)
}

export class ArquivoDoCadastroRecusado extends Error {
  constructor(
    mensagem: string,
    readonly status: number
  ) {
    super(mensagem)
  }
}

export interface ArquivoBaixado {
  nome: string
  bytes: Buffer
}

/** O contrato informado na geração, se a pessoa pode vê-lo. */
export async function contratoDoUsuario(usuario: AuthUser, contratoId: string): Promise<{ id: string; clienteId: string } | null> {
  return prisma.contrato.findFirst({
    where: { id: contratoId, ...(await filtroDeClientes(usuario)) },
    select: { id: true, clienteId: true },
  })
}

/** Os PDFs do cadastro pedidos na geração, conferidos e baixados do storage (R2). Com `clienteId` (o
 *  do contrato escolhido), arquivo de outro cliente é recusado. Arquivo de cliente sem permissão é
 *  tratado como inexistente — a mensagem não revela o nome. */
export async function carregarArquivosDoCadastro(
  usuario: AuthUser,
  ids: string[],
  clienteId: string | null
): Promise<Map<string, ArquivoBaixado>> {
  const unicos = [...new Set(ids)]
  if (unicos.length === 0) return new Map()
  const [arquivos, permitidos] = await Promise.all([
    prisma.arquivoCliente.findMany({
      where: { id: { in: unicos } },
      select: { id: true, clienteId: true, nome: true, extensao: true, urlBlob: true, removidoEm: true },
    }),
    clienteIdsPermitidos(usuario),
  ])
  const porId = new Map(arquivos.map((a) => [a.id, a]))
  for (const id of unicos) {
    const arquivo = porId.get(id)
    if (!arquivo || (permitidos !== null && !permitidos.includes(arquivo.clienteId))) {
      throw new ArquivoDoCadastroRecusado('Um dos arquivos do cadastro não existe mais — busque o contrato de novo.', 404)
    }
    if (arquivo.removidoEm) {
      throw new ArquivoDoCadastroRecusado(`O arquivo ${arquivo.nome} foi removido do cadastro — busque o contrato de novo ou envie do computador.`, 409)
    }
    if (arquivo.extensao !== 'pdf') throw new ArquivoDoCadastroRecusado(`O arquivo ${arquivo.nome} não é PDF.`, 400)
    if (clienteId && arquivo.clienteId !== clienteId) {
      throw new ArquivoDoCadastroRecusado(`O arquivo ${arquivo.nome} é de outro cliente.`, 400)
    }
  }
  const baixados = await Promise.all(
    unicos.map(async (id): Promise<[string, ArquivoBaixado]> => {
      const arquivo = porId.get(id)!
      try {
        return [id, { nome: arquivo.nome, bytes: await getUpload(arquivo.urlBlob) }]
      } catch {
        throw new ArquivoDoCadastroRecusado(
          `Não foi possível ler a proposta ${arquivo.nome} do cadastro — tente de novo ou envie o arquivo do computador.`,
          502
        )
      }
    })
  )
  return new Map(baixados)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/lib/confere/cadastro.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/confere/cadastro.ts src/lib/confere/cadastro.test.ts
git commit -m "feat(confere): serviço do cadastro — identifica a planilha, carrega documentos e busca contratos"
```

---

### Task 5: Rotas de leitura (identificação, busca, documentos)

**Files:**
- Create: `src/app/api/confere/levantamento/route.ts`, `src/app/api/confere/contratos/route.ts`, `src/app/api/confere/contratos/[id]/documentos/route.ts`
- Test: `src/app/api/confere/levantamento/route.test.ts`, `src/app/api/confere/contratos/route.test.ts`, `src/app/api/confere/contratos/[id]/documentos/route.test.ts`

**Interfaces:**
- Consumes: `identificarLevantamento`, `buscarContratos`, `documentosDoContrato`, `competenciaAtual` (Task 4); `exigirUsuario` (`src/lib/relatorios-clientes/acesso.ts`).
- Produces: `POST /api/confere/levantamento` (multipart `levantamento`) → `RespostaDaIdentificacao`; `GET /api/confere/contratos?busca=` → `ResumoDoContrato[]`; `GET /api/confere/contratos/[id]/documentos?competencia=AAAA-MM` → `DocumentosDoContrato` | 404.

- [ ] **Step 1: Testes que falham**

`src/app/api/confere/levantamento/route.test.ts`:

```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/confere/cadastro', () => ({ identificarLevantamento: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { identificarLevantamento } from '@/lib/confere/cadastro'
import { POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }

function requisicao(campos: Record<string, File | string>) {
  const formData = new FormData()
  for (const [chave, valor] of Object.entries(campos)) formData.append(chave, valor)
  return new NextRequest('http://localhost/api/confere/levantamento', { method: 'POST', body: formData })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
})

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await POST(requisicao({ levantamento: new File(['x'], 'l.xlsx') }))).status).toBe(401)
})

it('400 sem a planilha', async () => {
  expect((await POST(requisicao({}))).status).toBe(400)
  expect(identificarLevantamento).not.toHaveBeenCalled()
})

it('devolve a identificação feita com os bytes da planilha', async () => {
  const resposta = { situacao: 'sem-referencia', leitura: { referencia: null, competencia: null } }
  ;(identificarLevantamento as jest.Mock).mockResolvedValue(resposta)
  const r = await POST(requisicao({ levantamento: new File(['conteudo'], 'l.xlsx') }))
  expect(r.status).toBe(200)
  expect(await r.json()).toEqual(resposta)
  const [usuario, bytes] = (identificarLevantamento as jest.Mock).mock.calls[0]
  expect(usuario).toEqual(admin)
  expect(Buffer.from(bytes).toString()).toBe('conteudo')
})
```

`src/app/api/confere/contratos/route.test.ts`:

```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/confere/cadastro', () => ({ buscarContratos: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { buscarContratos } from '@/lib/confere/cadastro'
import { GET } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
})

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(new NextRequest('http://localhost/api/confere/contratos?busca=cgm'))).status).toBe(401)
})

it('repassa o texto da busca', async () => {
  ;(buscarContratos as jest.Mock).mockResolvedValue([{ id: 'ct-1' }])
  const r = await GET(new NextRequest('http://localhost/api/confere/contratos?busca=16%20cgm'))
  expect(await r.json()).toEqual([{ id: 'ct-1' }])
  expect(buscarContratos).toHaveBeenCalledWith(admin, '16 cgm')
})
```

`src/app/api/confere/contratos/[id]/documentos/route.test.ts`:

```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/confere/cadastro', () => ({
  documentosDoContrato: jest.fn(),
  competenciaAtual: jest.fn(() => ({ ano: 2026, mes: 9 })),
}))

import { getAuthUser } from '@/lib/auth'
import { documentosDoContrato } from '@/lib/confere/cadastro'
import { GET } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const contexto = { params: Promise.resolve({ id: 'ct-1' }) }
const url = (consulta = '') => new NextRequest(`http://localhost/api/confere/contratos/ct-1/documentos${consulta}`)

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
})

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(url('?competencia=2026-07'), contexto)).status).toBe(401)
})

it('competência da planilha', async () => {
  ;(documentosDoContrato as jest.Mock).mockResolvedValue({ base: null })
  const r = await GET(url('?competencia=2026-07'), contexto)
  expect(r.status).toBe(200)
  expect(documentosDoContrato).toHaveBeenCalledWith(admin, 'ct-1', { ano: 2026, mes: 7 }, true)
})

it('sem competência (ou inválida): o mês atual, marcado como não lido', async () => {
  ;(documentosDoContrato as jest.Mock).mockResolvedValue({ base: null })
  await GET(url('?competencia=2026-13'), contexto)
  expect(documentosDoContrato).toHaveBeenCalledWith(admin, 'ct-1', { ano: 2026, mes: 9 }, false)
})

it('404 quando o contrato não existe ou não é visível', async () => {
  ;(documentosDoContrato as jest.Mock).mockResolvedValue(null)
  expect((await GET(url(), contexto)).status).toBe(404)
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/app/api/confere/levantamento src/app/api/confere/contratos`
Expected: FAIL — rotas não existem.

- [ ] **Step 3: Implementar as três rotas**

`src/app/api/confere/levantamento/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'

import { identificarLevantamento } from '@/lib/confere/cadastro'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'

/** Lê o cabeçalho do levantamento e acha o contrato no cadastro — só leitura, a planilha não é
 *  guardada (docs/superpowers/specs/2026-09-25-confere-contrato-do-cadastro-design.md §7.1). */
export async function POST(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const levantamento = (await request.formData()).get('levantamento')
  if (!(levantamento instanceof File)) {
    return NextResponse.json({ detail: 'levantamento é obrigatório' }, { status: 400 })
  }
  const resposta = await identificarLevantamento(autenticado.usuario, new Uint8Array(await levantamento.arrayBuffer()))
  return NextResponse.json(resposta)
}
```

`src/app/api/confere/contratos/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'

import { buscarContratos } from '@/lib/confere/cadastro'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'

/** Busca livre do "trocar contrato" do ConfereAI — só contratos de clientes que a pessoa vê. */
export async function GET(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  const busca = request.nextUrl.searchParams.get('busca') ?? ''
  return NextResponse.json(await buscarContratos(autenticado.usuario, busca))
}
```

`src/app/api/confere/contratos/[id]/documentos/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'

import { competenciaAtual, documentosDoContrato } from '@/lib/confere/cadastro'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'

const COMPETENCIA = /^(\d{4})-(0[1-9]|1[0-2])$/

/** Proposta-base, aditivos e avisos de um contrato escolhido à mão, na competência da planilha
 *  (`?competencia=AAAA-MM`); sem ela, o mês atual. 404 para contrato inexistente ou fora do acesso. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const { id } = await params
  const achado = COMPETENCIA.exec(request.nextUrl.searchParams.get('competencia') ?? '')
  const competencia = achado ? { ano: Number(achado[1]), mes: Number(achado[2]) } : competenciaAtual()
  const documentos = await documentosDoContrato(autenticado.usuario, id, competencia, achado !== null)
  if (!documentos) return NextResponse.json({ detail: 'contrato não encontrado' }, { status: 404 })
  return NextResponse.json(documentos)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/app/api/confere/levantamento src/app/api/confere/contratos`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/confere/levantamento src/app/api/confere/contratos
git commit -m "feat(confere): rotas de identificação da planilha, busca e documentos do contrato"
```

---

### Task 6: Histórico com contrato e competência (schema, migração, listagem)

**Files:**
- Modify: `prisma/schema.prisma` (model `ConfereExecucao` e `Contrato`)
- Create: `prisma/migrations/20260925120000_confere_execucao_contrato/migration.sql`
- Modify: `src/app/api/confere/execucoes/route.ts`, `src/app/confere/historico/page.tsx`
- Test: `src/app/api/confere/execucoes/route.test.ts` (novo)

**Interfaces:**
- Produces: colunas `ConfereExecucao.contratoId` (FK `Contrato`, `SetNull`), `competenciaAno`, `competenciaMes`; a listagem devolve também `contratoId`, `clienteId`, `numeroTermo`, `competenciaAno`, `competenciaMes`.

- [ ] **Step 1: Teste que falha** — `src/app/api/confere/execucoes/route.test.ts`

```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: jest.fn() } }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(new NextRequest('http://localhost/api/confere/execucoes'))).status).toBe(401)
})

it('lista com contrato e competência junto com a execução', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', nome: 'A', email: 'a@x', role: 'admin' })
  const linha = {
    id: 'e1', nomeContrato: 'PA.pdf', nomeLevantamento: 'L.xlsx', nomesAditivos: [], temResultado: true,
    createdAt: '2026-09-25T12:00:00.000Z', contratoId: 'ct-1', clienteId: 'cl-1', numeroTermo: 'TC 16/CGM/2024',
    competenciaAno: 2026, competenciaMes: 8,
  }
  ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([linha])
  const r = await GET(new NextRequest('http://localhost/api/confere/execucoes'))
  expect(await r.json()).toEqual([linha])
  const sql = (prisma.$queryRaw as jest.Mock).mock.calls[0][0].join('?')
  expect(sql).toContain('LEFT JOIN "Contrato"')
  expect(sql).toContain('"competenciaAno"')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/app/api/confere/execucoes/route.test.ts`
Expected: FAIL — o SQL ainda não tem `LEFT JOIN "Contrato"`.

- [ ] **Step 3: Schema** — em `prisma/schema.prisma`, no model `ConfereExecucao`, trocar o comentário "Sem vínculo com Cliente nem competência…" e acrescentar os campos e o índice:

```prisma
// Sem vínculo com Cliente: o contrato (quando a planilha achou um, ou a pessoa escolheu) e a
// competência lida do levantamento dizem de que foi o relatório
// (docs/superpowers/specs/2026-09-25-confere-contrato-do-cadastro-design.md §7.4). Os dois são
// opcionais — execuções antigas e envios sem contrato ficam sem. Excluir o contrato solta a
// execução (SetNull), que continua com os nomes.
model ConfereExecucao {
  id               String   @id
  // ... (campos existentes sem mudança) ...
  contratoId       String?
  contrato         Contrato? @relation(fields: [contratoId], references: [id], onDelete: SetNull)
  competenciaAno   Int?
  competenciaMes   Int?
  createdAt        DateTime @default(now())

  @@index([createdAt])
  @@index([contratoId])
}
```

E no model `Contrato`, junto das outras relações: `confereExecucoes ConfereExecucao[]`.

- [ ] **Step 4: Migração** — `prisma/migrations/20260925120000_confere_execucao_contrato/migration.sql`

```sql
-- ConfereExecucao passa a dizer de qual contrato e competência foi o relatório
-- (docs/superpowers/specs/2026-09-25-confere-contrato-do-cadastro-design.md §7.4).
ALTER TABLE "ConfereExecucao" ADD COLUMN "contratoId" TEXT;
ALTER TABLE "ConfereExecucao" ADD COLUMN "competenciaAno" INTEGER;
ALTER TABLE "ConfereExecucao" ADD COLUMN "competenciaMes" INTEGER;

CREATE INDEX "ConfereExecucao_contratoId_idx" ON "ConfereExecucao"("contratoId");

ALTER TABLE "ConfereExecucao" ADD CONSTRAINT "ConfereExecucao_contratoId_fkey"
  FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

Conferir o diff do schema contra o banco (não pode aparecer `DROP INDEX "ArquivoCliente_clienteId_sha256_ativo_key"` nem nada além destas colunas):

Run: `npx dotenv -e .env.development -- npx prisma migrate deploy` e depois `npx dotenv -e .env.development -- npx prisma migrate status`
Expected: a migração `20260925120000_confere_execucao_contrato` aplicada; "Database schema is up to date!".

Run: `npm run dev:generate`
Expected: Prisma Client regerado. **No Windows, com `next dev` rodando, falha com EPERM na DLL do engine — parar o servidor, gerar e subir de novo.**

- [ ] **Step 5: Listagem** — `src/app/api/confere/execucoes/route.ts`, trocar o `$queryRaw`:

```ts
  const execucoes = await prisma.$queryRaw<
    Array<{
      id: string
      nomeContrato: string
      nomeLevantamento: string
      nomesAditivos: unknown
      temResultado: boolean
      createdAt: Date
      contratoId: string | null
      clienteId: string | null
      numeroTermo: string | null
      competenciaAno: number | null
      competenciaMes: number | null
    }>
  >`
    SELECT
      e."id",
      e."nomeContrato",
      e."nomeLevantamento",
      e."nomesAditivos",
      e."resultado" IS NOT NULL AS "temResultado",
      e."createdAt",
      e."contratoId",
      e."competenciaAno",
      e."competenciaMes",
      c."clienteId",
      c."numeroTermo"
    FROM "ConfereExecucao" e
    LEFT JOIN "Contrato" c ON c."id" = e."contratoId"
    ORDER BY e."createdAt" DESC
  `
```

- [ ] **Step 6: Página do histórico** — `src/app/confere/historico/page.tsx`:
  - `interface ConfereExecucao` ganha `contratoId: string | null; clienteId: string | null; numeroTermo: string | null; competenciaAno: number | null; competenciaMes: number | null`.
  - `import { nomeDaCompetencia } from '@/lib/confere/tipos-cadastro'`.
  - Cabeçalho: nova primeira coluna `<th>Contrato</th>`; a coluna que mostra `nomeContrato` passa a se chamar `<th>Proposta</th>`.
  - Nova primeira célula de cada linha:

```tsx
                    <td>
                      {execucao.contratoId && execucao.clienteId ? (
                        <Link
                          href={`/clientes/${execucao.clienteId}/contratos/${execucao.contratoId}`}
                          className="font-medium text-navy transition-colors hover:text-orange hover:underline"
                        >
                          {execucao.numeroTermo ?? 'Contrato'}
                        </Link>
                      ) : (
                        <span className="text-mid-grey">—</span>
                      )}
                      {execucao.competenciaAno && execucao.competenciaMes ? (
                        <span className="block text-xs text-mid-grey">
                          {nomeDaCompetencia({ ano: execucao.competenciaAno, mes: execucao.competenciaMes })}
                        </span>
                      ) : null}
                    </td>
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npx jest src/app/api/confere/execucoes`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260925120000_confere_execucao_contrato src/app/api/confere/execucoes/route.ts src/app/api/confere/execucoes/route.test.ts src/app/confere/historico/page.tsx
git commit -m "feat(confere): histórico mostra contrato e competência de cada relatório"
```

---

### Task 7: A geração aceita as propostas do cadastro

**Files:**
- Modify: `src/app/api/confere/reports/route.ts`
- Test: `src/app/api/confere/reports/route.test.ts`

**Interfaces:**
- Consumes: `carregarArquivosDoCadastro`, `contratoDoUsuario`, `ArquivoDoCadastroRecusado`, `ArquivoBaixado` (Task 4); `lerCabecalhoDoLevantamento`, `competenciaDaData` (Task 1); `PREFIXO_DO_CADASTRO` (Task 1); `exigirUsuario`.
- Produces: multipart aceito — `levantamento` (arquivo), `contrato` (arquivo) **ou** `contrato_arquivo_id`, `aditivos` repetido (arquivo ou `cadastro:<id>`, em ordem), `contrato_id` opcional, `identidade_confirmada`. Histórico com `contratoId` e competência.

- [ ] **Step 1: Ajustar os mocks do teste existente e escrever os testes novos** — em `src/app/api/confere/reports/route.test.ts`:

Acrescentar, junto dos `jest.mock` do topo:

```ts
jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/confere/cadastro', () => ({
  ...jest.requireActual('@/lib/confere/cadastro'),
  carregarArquivosDoCadastro: jest.fn(),
  contratoDoUsuario: jest.fn(),
}))
```

e os imports:

```ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getAuthUser } from '@/lib/auth'
import { ArquivoDoCadastroRecusado, carregarArquivosDoCadastro, contratoDoUsuario } from '@/lib/confere/cadastro'
import { prisma } from '@/lib/prisma'
```

No `beforeEach` existente, depois do `jest.clearAllMocks()`:

```ts
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' })
    ;(carregarArquivosDoCadastro as jest.Mock).mockResolvedValue(new Map())
    ;(contratoDoUsuario as jest.Mock).mockResolvedValue({ id: 'ct-1', clienteId: 'cl-1' })
```

Testes novos, dentro do `describe`:

```ts
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    const resposta = await POST(requisicao({ contrato: arquivo('c.pdf'), levantamento: arquivo('l.xlsx') }))
    expect(resposta.status).toBe(401)
    expect(chamarConfere).not.toHaveBeenCalled()
  })

  it('proposta e aditivos do cadastro por referência, na ordem pedida, misturados com os do computador', async () => {
    ;(chamarConfere as jest.Mock).mockResolvedValue({ tipo: 'erro', mensagem: 'irrelevante' })
    ;(carregarArquivosDoCadastro as jest.Mock).mockResolvedValue(
      new Map([
        ['pc', { nome: 'PC.pdf', bytes: Buffer.from('pc') }],
        ['pa1', { nome: 'PA1.pdf', bytes: Buffer.from('pa1') }],
        ['pa2', { nome: 'PA2.pdf', bytes: Buffer.from('pa2') }],
      ])
    )

    await POST(
      requisicao({
        contrato_arquivo_id: 'pc',
        levantamento: arquivo('l.xlsx'),
        aditivos: ['cadastro:pa1', arquivo('manual.pdf'), 'cadastro:pa2'] as unknown as File[],
        contrato_id: 'ct-1',
      })
    )

    expect(carregarArquivosDoCadastro).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), ['pc', 'pa1', 'pa2'], 'cl-1')
    expect(chamarConfere).toHaveBeenCalledWith(
      expect.objectContaining({
        contrato: expect.objectContaining({ nome: 'PC.pdf' }),
        aditivos: [
          expect.objectContaining({ nome: 'PA1.pdf' }),
          expect.objectContaining({ nome: 'manual.pdf' }),
          expect.objectContaining({ nome: 'PA2.pdf' }),
        ],
      }),
      expect.anything()
    )
  })

  it('arquivo do cadastro recusado: devolve o status e o motivo, sem chamar o Confere', async () => {
    ;(carregarArquivosDoCadastro as jest.Mock).mockRejectedValue(new ArquivoDoCadastroRecusado('O arquivo X foi removido do cadastro', 409))
    const resposta = await POST(requisicao({ contrato_arquivo_id: 'pc', levantamento: arquivo('l.xlsx') }))
    expect(resposta.status).toBe(409)
    expect(await resposta.json()).toEqual({ detail: 'O arquivo X foi removido do cadastro' })
    expect(chamarConfere).not.toHaveBeenCalled()
  })

  it('contrato informado fora do acesso: 403', async () => {
    ;(contratoDoUsuario as jest.Mock).mockResolvedValue(null)
    const resposta = await POST(requisicao({ contrato: arquivo('c.pdf'), levantamento: arquivo('l.xlsx'), contrato_id: 'ct-x' }))
    expect(resposta.status).toBe(403)
    expect(chamarConfere).not.toHaveBeenCalled()
  })

  it('o histórico grava o contrato e a competência lida da planilha', async () => {
    ;(chamarConfere as jest.Mock).mockResolvedValue({ tipo: 'concluido', resposta: { docx_base64: 'AA==', analise_xlsx_base64: 'BB==' } })
    const planilha = new File(
      [readFileSync(path.join(process.cwd(), 'services/confere/backend/tests/fixtures/levantamento.xlsx'))],
      'levantamento.xlsx'
    )
    await POST(requisicao({ contrato: arquivo('c.pdf'), levantamento: planilha, contrato_id: 'ct-1' }))
    expect(prisma.confereExecucao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ contratoId: 'ct-1', competenciaAno: 2026, competenciaMes: 7 }),
    })
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/app/api/confere/reports/route.test.ts`
Expected: FAIL nos testes novos (401, referência, recusa, 403, histórico).

- [ ] **Step 3: Implementar** — em `src/app/api/confere/reports/route.ts`:

Imports novos:

```ts
import {
  ArquivoDoCadastroRecusado,
  carregarArquivosDoCadastro,
  contratoDoUsuario,
  type ArquivoBaixado,
} from '@/lib/confere/cadastro'
import { competenciaDaData, lerCabecalhoDoLevantamento } from '@/lib/confere/levantamento'
import { PREFIXO_DO_CADASTRO, type Competencia } from '@/lib/confere/tipos-cadastro'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
```

`registrarNoHistorico` ganha o vínculo (terceiro parâmetro) e o grava:

```ts
async function registrarNoHistorico(
  resposta: RespostaRelatorioConfere,
  nomes: { contrato: string; levantamento: string; aditivos: string[] },
  vinculo: { contratoId: string | null; competencia: Competencia | null }
): Promise<void> {
  // ... (corpo existente) ...
    await prisma.confereExecucao.create({
      data: {
        id,
        nomeContrato: nomes.contrato,
        nomeLevantamento: nomes.levantamento,
        nomesAditivos: nomes.aditivos,
        caminhoDocx,
        caminhoXlsx,
        contratoId: vinculo.contratoId,
        competenciaAno: vinculo.competencia?.ano ?? null,
        competenciaMes: vinculo.competencia?.mes ?? null,
        resultado: resultado as unknown as Prisma.InputJsonValue,
      },
    })
```

`paraArquivo` passa a devolver `ArquivoBaixado` (mesma forma `{ nome, bytes }`):

```ts
async function paraArquivo(arquivo: File): Promise<ArquivoBaixado> {
  return { nome: arquivo.name, bytes: Buffer.from(await arquivo.arrayBuffer()) }
}

/** O que a planilha diz ser a competência — só para o histórico; planilha ilegível fica sem. */
async function competenciaDoLevantamento(bytes: Buffer): Promise<Competencia | null> {
  try {
    return competenciaDaData((await lerCabecalhoDoLevantamento(bytes)).dataLevantamento)
  } catch {
    return null
  }
}
```

Corpo do `POST`, do início até a chamada ao Confere (substitui o trecho entre `const formData = …` e `const resultado = await chamarConfere(…)`), e o registro:

```ts
export async function POST(request: NextRequest) {
  const inicio = Date.now()
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  const { usuario } = autenticado
  const formData = await request.formData()

  // Contrato: arquivo do computador **ou** id de uma proposta do cadastro (desenho §7.2).
  const levantamento = formData.get('levantamento')
  const contratoEnviado = formData.get('contrato')
  const contratoIdDoArquivo = formData.get('contrato_arquivo_id')
  const contratoDoCadastro = typeof contratoIdDoArquivo === 'string' && contratoIdDoArquivo !== '' ? contratoIdDoArquivo : null
  if (!(levantamento instanceof File) || (!(contratoEnviado instanceof File) && !contratoDoCadastro)) {
    return NextResponse.json({ detail: 'contrato e levantamento são obrigatórios' }, { status: 400 })
  }

  // Aditivos em ordem de aplicação: cada entrada é um arquivo ou `cadastro:<id>`.
  const entradas = formData
    .getAll('aditivos')
    .filter((valor): valor is File | string => valor instanceof File || (typeof valor === 'string' && valor.startsWith(PREFIXO_DO_CADASTRO)))
  const idDoCadastro = (entrada: string) => entrada.slice(PREFIXO_DO_CADASTRO.length)
  const identidadeConfirmada = formData.get('identidade_confirmada') === 'true'

  const contratoIdInformado = formData.get('contrato_id')
  const contratoId = typeof contratoIdInformado === 'string' && contratoIdInformado !== '' ? contratoIdInformado : null
  const contratoEscolhido = contratoId ? await contratoDoUsuario(usuario, contratoId) : null
  if (contratoId && !contratoEscolhido) {
    return NextResponse.json({ detail: 'Sem acesso ao contrato escolhido.' }, { status: 403 })
  }

  let doCadastro: Map<string, ArquivoBaixado>
  try {
    doCadastro = await carregarArquivosDoCadastro(
      usuario,
      [
        ...(contratoDoCadastro ? [contratoDoCadastro] : []),
        ...entradas.filter((entrada): entrada is string => typeof entrada === 'string').map(idDoCadastro),
      ],
      contratoEscolhido?.clienteId ?? null
    )
  } catch (erro) {
    if (erro instanceof ArquivoDoCadastroRecusado) return NextResponse.json({ detail: erro.message }, { status: erro.status })
    throw erro
  }

  const planilha = await paraArquivo(levantamento)
  const parametros = {
    contrato: contratoEnviado instanceof File ? await paraArquivo(contratoEnviado) : doCadastro.get(contratoDoCadastro!)!,
    levantamento: planilha,
    aditivos: await Promise.all(
      entradas.map((entrada) => (entrada instanceof File ? paraArquivo(entrada) : Promise.resolve(doCadastro.get(idDoCadastro(entrada))!)))
    ),
    identidadeConfirmada,
  }
  // Desistir do Confere **antes** de a Vercel desistir da função é o que
  // garante que a tela receba uma resposta nossa, com `detail`. O download do
  // cadastro já está descontado: aconteceu dentro do mesmo relógio.
  const tempoLimiteMs = maxDuration * 1000 - FOLGA_DEPOIS_DO_CONFERE_MS - (Date.now() - inicio)
  const resultado = await chamarConfere(parametros, { tempoLimiteMs })

  if (resultado.tipo === 'concluido') {
    // (manter o comentário existente sobre o `await`)
    await registrarNoHistorico(
      resultado.resposta,
      {
        contrato: parametros.contrato.nome,
        levantamento: levantamento.name,
        aditivos: parametros.aditivos.map((arquivo) => arquivo.nome),
      },
      { contratoId: contratoEscolhido?.id ?? null, competencia: await competenciaDoLevantamento(planilha.bytes) }
    )
    return NextResponse.json(resultado.resposta, { status: 200 })
  }
  // ... (resto sem mudança: bloqueado → 422, tempo-esgotado → 504, erro → 502)
}
```

Atualizar o comentário do `POST` ("recebe o mesmo multipart que o Confere espera") para dizer que Contrato e aditivos também podem vir por id do cadastro, baixados aqui do R2.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/app/api/confere/reports/route.test.ts`
Expected: PASS (os 13 testes: 8 existentes + 5 novos).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/confere/reports/route.ts src/app/api/confere/reports/route.test.ts
git commit -m "feat(confere): geração aceita proposta e aditivos do cadastro por referência"
```

---

### Task 8: Tela — tipos, chamadas e textos da origem

**Files:**
- Modify: `src/app/confere/lib/types.ts`, `src/app/confere/lib/api.ts`, `src/app/confere/lib/api.test.ts`
- Create: `src/app/confere/lib/cadastro.ts`, `src/app/confere/lib/cadastro.test.ts`

**Interfaces:**
- Consumes: tipos de `@/lib/confere/tipos-cadastro` (Task 1).
- Produces: `Peca` (`{ tipo: "arquivo"; arquivo: File } | { tipo: "cadastro"; documento: DocumentoDoCadastro }`), `nomeDaPeca(peca)`, `Identificacao`; `identificarLevantamento(levantamento): Promise<RespostaDaIdentificacao | null>`, `documentosDoContrato(contratoId, competencia): Promise<DocumentosDoContrato | null>`, `buscarContratos(texto): Promise<ResumoDoContrato[]>`, `EntradaDaGeracao`, `gerarRelatorio(entrada, identidadeConfirmada?)`; `textoDaOrigem(origem)`, `textoDoContrato(contrato)`.

- [ ] **Step 1: Testes que falham**

`src/app/confere/lib/cadastro.test.ts`:

```ts
import { textoDaOrigem, textoDoContrato } from "./cadastro";

describe("textoDaOrigem", () => {
	it.each([
		[{ tipo: "PRORROGACAO", numero: "TA 04", inicio: "2025-12-01" }, "TA 04, renovação desde 01/12/2025"],
		[{ tipo: "ADITIVO", numero: "TA 05", inicio: "2026-04-30" }, "TA 05, aditivo de 30/04/2026"],
		[{ tipo: "CONTRATO", numero: "TC 52/SMIT/2024", inicio: "2024-07-01" }, "contrato inicial, desde 01/07/2024"],
		[{ tipo: "CONTRATO", numero: null, inicio: null }, "contrato inicial"],
		[null, "proposta do cliente, fora do histórico do contrato"],
	] as const)("%j", (origem, texto) => {
		expect(textoDaOrigem(origem)).toBe(texto);
	});
});

describe("textoDoContrato", () => {
	it("número · sigla · descrição, e avisa quando encerrado", () => {
		const base = {
			id: "c", clienteId: "cl", clienteNome: "Controladoria", clienteSigla: "CGM",
			numeroTermo: "TC 16/CGM/2024", descricao: "Sustentação", vigenciaFim: null, ativo: true,
		};
		expect(textoDoContrato(base)).toBe("TC 16/CGM/2024 · CGM · Sustentação");
		expect(textoDoContrato({ ...base, descricao: null, ativo: false })).toBe("TC 16/CGM/2024 · CGM · encerrado");
	});
});
```

Em `src/app/confere/lib/api.test.ts`: trocar o import e a constante do topo, e acrescentar dois `describe` no fim.

```ts
import { gerarRelatorio, identificarLevantamento, type EntradaDaGeracao } from "./api";

// Contrato e levantamento do computador — o caminho de sempre.
const ENTRADA: EntradaDaGeracao = {
	levantamento: new File(["xlsx"], "levantamento.xlsx"),
	contrato: { tipo: "arquivo", arquivo: new File(["%PDF"], "contrato.pdf") },
	aditivos: [],
};
```

(e em todos os testes existentes, `gerarRelatorio(ARQUIVOS)` vira `gerarRelatorio(ENTRADA)`)

```ts
describe("gerarRelatorio — propostas do cadastro", () => {
	it("manda os ids do cadastro na ordem da lista, com o contrato escolhido", async () => {
		const espiao = jest.spyOn(global, "fetch").mockResolvedValue(Response.json({ detail: "x" }, { status: 502 }));
		const documento = (arquivoId: string) => ({ arquivoId, nome: `${arquivoId}.pdf`, origem: null });

		await gerarRelatorio({
			levantamento: new File(["xlsx"], "l.xlsx"),
			contrato: { tipo: "cadastro", documento: documento("pa-04") },
			aditivos: [
				{ tipo: "cadastro", documento: documento("pa-05") },
				{ tipo: "arquivo", arquivo: new File(["%PDF"], "manual.pdf") },
			],
			contratoId: "ct-pgm",
		});

		const corpo = espiao.mock.calls[0][1]?.body as FormData;
		expect(corpo.get("contrato")).toBeNull();
		expect(corpo.get("contrato_arquivo_id")).toBe("pa-04");
		const aditivos = corpo.getAll("aditivos");
		expect(aditivos[0]).toBe("cadastro:pa-05");
		expect((aditivos[1] as File).name).toBe("manual.pdf");
		expect(corpo.get("contrato_id")).toBe("ct-pgm");
	});
});

describe("identificarLevantamento", () => {
	it("falha da busca vira null — a tela segue pelo envio manual", async () => {
		jest.spyOn(global, "fetch").mockResolvedValue(new Response("x", { status: 500 }));
		await expect(identificarLevantamento(new File(["x"], "l.xlsx"))).resolves.toBeNull();
		jest.spyOn(global, "fetch").mockRejectedValue(new TypeError("rede"));
		await expect(identificarLevantamento(new File(["x"], "l.xlsx"))).resolves.toBeNull();
	});
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/app/confere/lib`
Expected: FAIL — `./cadastro` não existe; `EntradaDaGeracao`/`identificarLevantamento` não exportados.

- [ ] **Step 3: Implementar**

`src/app/confere/lib/cadastro.ts`:

```ts
import {
	dataIsoParaTexto,
	type OrigemNoCadastro,
	type ResumoDoContrato,
} from "@/lib/confere/tipos-cadastro";

/** De onde veio a proposta, como a tela escreve: "TA 04, renovação desde 01/12/2025". */
export function textoDaOrigem(origem: OrigemNoCadastro | null): string {
	if (!origem) return "proposta do cliente, fora do histórico do contrato";
	const data = origem.inicio ? dataIsoParaTexto(origem.inicio) : null;
	switch (origem.tipo) {
		case "CONTRATO":
			return data ? `contrato inicial, desde ${data}` : "contrato inicial";
		case "PRORROGACAO":
			return `${origem.numero ?? "prorrogação"}, renovação${data ? ` desde ${data}` : ""}`;
		case "ADITIVO":
			return `${origem.numero ?? "aditivo"}, aditivo${data ? ` de ${data}` : ""}`;
		default:
			return origem.numero ?? origem.tipo.toLowerCase();
	}
}

/** "TC 16/CGM/2024 · CGM · Sustentação" — e "encerrado" quando o contrato não está ativo. */
export function textoDoContrato(contrato: ResumoDoContrato): string {
	return [
		contrato.numeroTermo ?? "sem número",
		contrato.clienteSigla ?? contrato.clienteNome,
		contrato.descricao,
		contrato.ativo ? null : "encerrado",
	]
		.filter(Boolean)
		.join(" · ");
}
```

`src/app/confere/lib/types.ts` — acrescentar no topo o import e, no fim, os tipos; e trocar a descrição dos aditivos:

```ts
import type { DocumentoDoCadastro, RespostaDaIdentificacao } from "@/lib/confere/tipos-cadastro";
```

```ts
/** O conteúdo do campo Contrato ou de um aditivo: arquivo enviado do computador ou proposta do
 *  cadastro do cliente (docs/superpowers/specs/2026-09-25-confere-contrato-do-cadastro-design.md). */
export type Peca =
	| { tipo: "arquivo"; arquivo: File }
	| { tipo: "cadastro"; documento: DocumentoDoCadastro };

export function nomeDaPeca(peca: Peca): string {
	return peca.tipo === "arquivo" ? peca.arquivo.name : peca.documento.nome;
}

/** O que a tela sabe sobre a planilha escolhida: nada ainda, lendo, a resposta da rota ou a falha. */
export type Identificacao =
	| { situacao: "ociosa" }
	| { situacao: "lendo" }
	| { situacao: "falhou" }
	| RespostaDaIdentificacao;
```

Em `CAMPO_ADITIVOS`: `descricao: "Opcional. Um ou mais PDFs, aplicados na ordem da lista",` (a ordem agora é a da lista, que mistura cadastro e computador).

`src/app/confere/lib/api.ts` — imports:

```ts
import {
	PREFIXO_DO_CADASTRO,
	type Competencia,
	type DocumentosDoContrato,
	type RespostaDaIdentificacao,
	type ResumoDoContrato,
} from "@/lib/confere/tipos-cadastro";

import type { Estado, NomeDoCampo, Peca, RespostaBloqueada, RespostaDaConferencia, RespostaRelatorio } from "./types";
```

Funções novas (antes de `gerarRelatorio`):

```ts
/** Lê o cabeçalho do levantamento e busca o contrato no cadastro. `null` quando a busca não
 *  respondeu — a tela segue pelo envio manual, nada bloqueia. */
export async function identificarLevantamento(levantamento: File): Promise<RespostaDaIdentificacao | null> {
	const corpo = new FormData();
	corpo.append("levantamento", levantamento);
	try {
		const resposta = await fetch(`${API_BASE_URL}/levantamento`, { method: "POST", body: corpo });
		return resposta.ok ? ((await resposta.json()) as RespostaDaIdentificacao) : null;
	} catch {
		return null;
	}
}

/** Os documentos de um contrato escolhido à mão, na competência da planilha. */
export async function documentosDoContrato(
	contratoId: string,
	competencia: Competencia | null,
): Promise<DocumentosDoContrato | null> {
	const parametro = competencia
		? `?competencia=${competencia.ano}-${String(competencia.mes).padStart(2, "0")}`
		: "";
	try {
		const resposta = await fetch(`${API_BASE_URL}/contratos/${encodeURIComponent(contratoId)}/documentos${parametro}`);
		return resposta.ok ? ((await resposta.json()) as DocumentosDoContrato) : null;
	} catch {
		return null;
	}
}

export async function buscarContratos(texto: string): Promise<ResumoDoContrato[]> {
	try {
		const resposta = await fetch(`${API_BASE_URL}/contratos?busca=${encodeURIComponent(texto)}`);
		return resposta.ok ? ((await resposta.json()) as ResumoDoContrato[]) : [];
	} catch {
		return [];
	}
}

export interface EntradaDaGeracao {
	levantamento: File;
	contrato: Peca;
	/** Em ordem de aplicação. */
	aditivos: readonly Peca[];
	/** O contrato achado ou escolhido no cadastro — vai para o histórico. */
	contratoId?: string | null;
}
```

`gerarRelatorio` — nova assinatura e montagem do corpo (o resto da função fica igual):

```ts
export async function gerarRelatorio(
	entrada: EntradaDaGeracao,
	identidadeConfirmada = false,
): Promise<Estado> {
	const corpo = new FormData();
	// Proposta do cadastro vai por id: o servidor baixa do R2, e o corpo da
	// requisição fica só com a planilha — longe do limite de 4,5 MB da Vercel.
	if (entrada.contrato.tipo === "arquivo") corpo.append("contrato", entrada.contrato.arquivo);
	else corpo.append("contrato_arquivo_id", entrada.contrato.documento.arquivoId);
	corpo.append("levantamento", entrada.levantamento);
	if (identidadeConfirmada) {
		corpo.append("identidade_confirmada", "true");
	}
	for (const aditivo of entrada.aditivos) {
		corpo.append(
			"aditivos",
			aditivo.tipo === "arquivo" ? aditivo.arquivo : `${PREFIXO_DO_CADASTRO}${aditivo.documento.arquivoId}`,
		);
	}
	if (entrada.contratoId) corpo.append("contrato_id", entrada.contratoId);
	// ... (resto igual: AbortController, fetch, tratamento das respostas) ...
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/app/confere/lib`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/confere/lib/types.ts src/app/confere/lib/api.ts src/app/confere/lib/api.test.ts src/app/confere/lib/cadastro.ts src/app/confere/lib/cadastro.test.ts
git commit -m "feat(confere): tela fala com o cadastro — identificação, busca e geração por referência"
```

---

### Task 9: Tela — faixa do contrato, Trocar, lista de aditivos e a página

**Files:**
- Create: `src/app/confere/components/MenuDeDocumentos.tsx`, `src/app/confere/components/BuscaDeContrato.tsx`, `src/app/confere/components/FaixaDoContrato.tsx`
- Modify: `src/app/confere/components/UploadForm.tsx`, `src/app/confere/page.tsx`
- Test: `src/app/confere/components/FaixaDoContrato.test.tsx`, `src/app/confere/page.test.tsx`

**Interfaces:**
- Consumes: Task 8 (`Peca`, `nomeDaPeca`, `Identificacao`, `identificarLevantamento`, `documentosDoContrato`, `buscarContratos`, `gerarRelatorio(entrada)`, `textoDaOrigem`, `textoDoContrato`).
- Produces: `MenuDeDocumentos({ rotulo, documentos, onEscolher, onEnviarDoComputador? })`, `BuscaDeContrato({ onEscolher })`, `ListaDeContratos({ contratos, onEscolher })`, `FaixaDoContrato({ identificacao, documentos?, contratoDoComputador, onEscolherContrato, onUsarDoCadastro })`.

- [ ] **Step 1: Testes que falham**

`src/app/confere/components/FaixaDoContrato.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";

import { FaixaDoContrato } from "./FaixaDoContrato";

const leitura = { referencia: "TC 99/SMIT/2026", competencia: { ano: 2026, mes: 7 } };
const sugestao = {
	id: "ct-52", clienteId: "cl", clienteNome: "SMIT", clienteSigla: "SMIT",
	numeroTermo: "TC 52/SMIT/2024", descricao: "Sustentação", vigenciaFim: null, ativo: true,
};

function renderizar(identificacao: Parameters<typeof FaixaDoContrato>[0]["identificacao"]) {
	const onEscolherContrato = jest.fn();
	render(
		<FaixaDoContrato
			identificacao={identificacao}
			contratoDoComputador={false}
			onEscolherContrato={onEscolherContrato}
			onUsarDoCadastro={jest.fn()}
		/>,
	);
	return { onEscolherContrato };
}

it("nada antes da planilha", () => {
	const { container } = render(
		<FaixaDoContrato identificacao={{ situacao: "ociosa" }} contratoDoComputador={false} onEscolherContrato={jest.fn()} onUsarDoCadastro={jest.fn()} />,
	);
	expect(container).toBeEmptyDOMElement();
});

it("não encontrado: diz o número lido e oferece as sugestões", () => {
	const { onEscolherContrato } = renderizar({ situacao: "nao-encontrado", leitura, sugestoes: [sugestao] });
	expect(screen.getByText(/O contrato TC 99\/SMIT\/2026 não está no cadastro/)).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: /TC 52\/SMIT\/2024/ }));
	expect(onEscolherContrato).toHaveBeenCalledWith("ct-52");
	expect(screen.getByRole("searchbox", { name: "Buscar contrato no cadastro" })).toBeInTheDocument();
});

it("empate: lista para escolher", () => {
	const { onEscolherContrato } = renderizar({ situacao: "ambiguo", leitura, candidatos: [sugestao] });
	fireEvent.click(screen.getByRole("button", { name: /TC 52\/SMIT\/2024/ }));
	expect(onEscolherContrato).toHaveBeenCalledWith("ct-52");
});

it("Enter na busca busca — e cancela o padrão, que submeteria o formulário de fora", () => {
	const espiao = jest.spyOn(global, "fetch").mockResolvedValue(Response.json([]));
	renderizar({ situacao: "sem-referencia", leitura });
	const busca = screen.getByRole("searchbox", { name: "Buscar contrato no cadastro" });
	fireEvent.change(busca, { target: { value: "cgm" } });
	// `fireEvent` devolve `false` quando o handler chamou `preventDefault()`.
	expect(fireEvent.keyDown(busca, { key: "Enter" })).toBe(false);
	expect(String(espiao.mock.calls[0][0])).toContain("/api/confere/contratos?busca=cgm");
	jest.restoreAllMocks();
});
```

`src/app/confere/page.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import ConferePage from "./page";

const PA_04 = { arquivoId: "pa-04", nome: "PA-PGM-251015-159 v5.0.pdf", origem: { tipo: "PRORROGACAO", numero: "TA 04", inicio: "2025-12-01" } };
const PA_05 = { arquivoId: "pa-05", nome: "PA-PGM-260304-715.pdf", origem: { tipo: "ADITIVO", numero: "TA 05", inicio: "2026-04-30" } };
const PC = { arquivoId: "pc", nome: "PC-PGM-240715-100 v7.0.pdf", origem: { tipo: "CONTRATO", numero: "TC 015/PGM/2024", inicio: "2024-12-01" } };
const DOCUMENTOS = {
	contrato: {
		id: "ct-pgm", clienteId: "cl-pgm", clienteNome: "Procuradoria Geral do Município", clienteSigla: "PGM",
		numeroTermo: "TC 015/PGM/2024", descricao: null, vigenciaFim: "2025-11-30", ativo: true,
	},
	competencia: { ano: 2026, mes: 7, lidaDaPlanilha: true },
	base: PA_04,
	aditivos: [PA_05],
	alternativas: [PC, PA_04, PA_05],
	decisoes: [
		{ rotulo: "Contrato inicial", papel: "fora", motivo: "já está dentro da renovação TA 04" },
		{ rotulo: "TA 04", papel: "base", motivo: null },
		{ rotulo: "TA 05", papel: "aditivo", motivo: null },
	],
	avisos: [{ codigo: "fora-da-vigencia", texto: "Julho/2026 está depois do fim de vigência cadastrado (30/11/2025). Confira." }],
};

let espiao: jest.SpyInstance;

beforeEach(() => {
	espiao = jest.spyOn(global, "fetch").mockImplementation(async (entrada) => {
		const url = String(entrada);
		if (url.endsWith("/health")) return Response.json({ dormindo: false });
		if (url.endsWith("/levantamento")) {
			return Response.json({
				situacao: "encontrado",
				leitura: { referencia: "TC 015/PGM/2024", competencia: { ano: 2026, mes: 7 } },
				documentos: DOCUMENTOS,
			});
		}
		return Response.json({ detail: "falha simulada" }, { status: 502 });
	});
});

afterEach(() => jest.restoreAllMocks());

function escolher(rotulo: string, ...arquivos: File[]) {
	fireEvent.change(screen.getByLabelText(rotulo), { target: { files: arquivos } });
}

function corpoDaGeracao(): FormData {
	const chamada = espiao.mock.calls.find(([url]) => String(url).endsWith("/reports"));
	return chamada?.[1]?.body as FormData;
}

it("escolher o levantamento preenche Contrato e Aditivos com as propostas do cadastro", async () => {
	render(<ConferePage />);
	escolher("Levantamento", new File(["x"], "PGM_Levantamento.xlsx"));

	expect(await screen.findByText("PA-PGM-251015-159 v5.0.pdf")).toBeInTheDocument();
	expect(screen.getByText(/Do cadastro · TA 04, renovação desde 01\/12\/2025/)).toBeInTheDocument();
	// O item da lista de aditivos — o mesmo nome aparece também no menu "Trocar".
	expect(screen.getByText(/^1\. PA-PGM-260304-715\.pdf/)).toBeInTheDocument();
	expect(screen.getByText(/Contrato TC 015\/PGM\/2024/)).toBeInTheDocument();
	expect(screen.getByText(/fim de vigência cadastrado/)).toBeInTheDocument();
});

it("proposta enviada do computador não é trocada pela do cadastro", async () => {
	render(<ConferePage />);
	escolher("Contrato", new File(["%PDF"], "minha-proposta.pdf"));
	escolher("Levantamento", new File(["x"], "PGM_Levantamento.xlsx"));

	expect(await screen.findByRole("button", { name: /Usar a proposta do cadastro/ })).toBeInTheDocument();
	expect(screen.getByText("minha-proposta.pdf")).toBeInTheDocument();
});

it("gera mandando as propostas do cadastro por referência", async () => {
	render(<ConferePage />);
	escolher("Levantamento", new File(["x"], "PGM_Levantamento.xlsx"));
	await screen.findByText("PA-PGM-251015-159 v5.0.pdf");

	fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));

	await waitFor(() => expect(corpoDaGeracao()).toBeDefined());
	expect(corpoDaGeracao().get("contrato_arquivo_id")).toBe("pa-04");
	expect(corpoDaGeracao().getAll("aditivos")).toEqual(["cadastro:pa-05"]);
	expect(corpoDaGeracao().get("contrato_id")).toBe("ct-pgm");
});

it("remover o aditivo tira ele do envio", async () => {
	render(<ConferePage />);
	escolher("Levantamento", new File(["x"], "PGM_Levantamento.xlsx"));
	await screen.findByText("PA-PGM-251015-159 v5.0.pdf");

	fireEvent.click(screen.getByRole("button", { name: "Remover PA-PGM-260304-715.pdf" }));
	fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));

	await waitFor(() => expect(corpoDaGeracao()).toBeDefined());
	expect(corpoDaGeracao().getAll("aditivos")).toEqual([]);
});

it("Trocar põe outra proposta do contrato no campo Contrato", async () => {
	render(<ConferePage />);
	escolher("Levantamento", new File(["x"], "PGM_Levantamento.xlsx"));
	await screen.findByText("PA-PGM-251015-159 v5.0.pdf");

	// A PC aparece também em "+ Adicionar do cadastro": escolher dentro do "Trocar".
	const trocar = screen.getByText("Trocar").closest("details") as HTMLElement;
	fireEvent.click(within(trocar).getByRole("button", { name: /PC-PGM-240715-100 v7\.0\.pdf/ }));

	expect(screen.getByText("PC-PGM-240715-100 v7.0.pdf")).toBeInTheDocument();
	expect(screen.getByText(/Do cadastro · contrato inicial, desde 01\/12\/2024/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/app/confere/page.test.tsx src/app/confere/components/FaixaDoContrato.test.tsx`
Expected: FAIL — componentes não existem; a página não busca o contrato.

- [ ] **Step 3: `src/app/confere/components/MenuDeDocumentos.tsx`**

```tsx
"use client";

import { useRef } from "react";

import type { DocumentoDoCadastro } from "@/lib/confere/tipos-cadastro";
import { textoDaOrigem } from "../lib/cadastro";

interface Props {
	rotulo: string;
	documentos: readonly DocumentoDoCadastro[];
	onEscolher: (documento: DocumentoDoCadastro) => void;
	/** Quando existe, o menu termina com "Enviar do computador…". */
	onEnviarDoComputador?: () => void;
}

/** "Trocar" e "+ Adicionar do cadastro": as propostas do cadastro e, se couber, o envio pelo
 *  computador. `<details>` e não um popover próprio — abre, fecha e anda pelo teclado sem código.
 *  Mora dentro do `<form>` do `UploadForm`: todo botão aqui é `type="button"` (`R-LMP-03`). */
export function MenuDeDocumentos({ rotulo, documentos, onEscolher, onEnviarDoComputador }: Props) {
	const menu = useRef<HTMLDetailsElement>(null);

	function fechar() {
		if (menu.current) menu.current.open = false;
	}

	return (
		<details ref={menu} className="relative">
			<summary className="cursor-pointer font-semibold text-confere-teal-600 underline">{rotulo}</summary>
			<ul className="absolute left-0 z-10 mt-1 w-max max-w-md space-y-0.5 rounded-md border border-confere-line bg-white p-1 shadow-sm">
				{documentos.map((documento) => (
					<li key={documento.arquivoId}>
						<button
							type="button"
							onClick={() => {
								fechar();
								onEscolher(documento);
							}}
							className="w-full rounded px-2 py-1 text-left text-confere-navy-600 hover:bg-confere-navy-50"
						>
							{documento.nome}
							<span className="text-confere-navy-300"> · {textoDaOrigem(documento.origem)}</span>
						</button>
					</li>
				))}
				{onEnviarDoComputador && (
					<li>
						<button
							type="button"
							onClick={() => {
								fechar();
								onEnviarDoComputador();
							}}
							className="w-full rounded px-2 py-1 text-left font-semibold text-confere-teal-600 hover:bg-confere-navy-50"
						>
							Enviar do computador…
						</button>
					</li>
				)}
			</ul>
		</details>
	);
}
```

- [ ] **Step 4: `src/app/confere/components/BuscaDeContrato.tsx`**

```tsx
"use client";

import { useState } from "react";

import type { ResumoDoContrato } from "@/lib/confere/tipos-cadastro";
import { buscarContratos } from "../lib/api";
import { textoDoContrato } from "../lib/cadastro";

/** Lista de contratos para escolher — sugestões, empate e resultado da busca. */
export function ListaDeContratos({
	contratos,
	onEscolher,
}: {
	contratos: readonly ResumoDoContrato[];
	onEscolher: (contratoId: string) => void;
}) {
	return (
		<ul className="mt-2 grid gap-1">
			{contratos.map((contrato) => (
				<li key={contrato.id}>
					<button
						type="button"
						onClick={() => onEscolher(contrato.id)}
						className="w-full rounded border border-confere-line bg-white px-3 py-1.5 text-left text-xs text-confere-navy-600 transition hover:border-confere-teal-400"
					>
						{textoDoContrato(contrato)}
					</button>
				</li>
			))}
		</ul>
	);
}

/** Busca livre de contrato no cadastro — por número, órgão ou nome do cliente.
 *
 *  Mora dentro do `<form>` do `UploadForm`, e Enter num campo de texto submete o formulário de fora —
 *  o que aqui **geraria o relatório**. O `keyDown` segura o Enter e busca. */
export function BuscaDeContrato({ onEscolher }: { onEscolher: (contratoId: string) => void }) {
	const [texto, setTexto] = useState("");
	const [resultados, setResultados] = useState<ResumoDoContrato[] | null>(null);
	const [buscando, setBuscando] = useState(false);

	async function buscar() {
		if (!texto.trim()) return;
		setBuscando(true);
		setResultados(await buscarContratos(texto));
		setBuscando(false);
	}

	return (
		<div className="text-xs">
			<div className="flex gap-2">
				<input
					type="search"
					value={texto}
					onChange={(evento) => setTexto(evento.target.value)}
					onKeyDown={(evento) => {
						if (evento.key !== "Enter") return;
						evento.preventDefault();
						void buscar();
					}}
					placeholder="Número do contrato, órgão ou cliente"
					aria-label="Buscar contrato no cadastro"
					className="h-8 flex-1 rounded border border-confere-line bg-white px-2 text-confere-navy-600"
				/>
				<button
					type="button"
					onClick={() => void buscar()}
					className="rounded-md border border-confere-line bg-white px-3 font-semibold text-confere-navy-600 transition hover:bg-confere-navy-50"
				>
					{buscando ? "Buscando…" : "Buscar"}
				</button>
			</div>
			{resultados !== null &&
				(resultados.length === 0 ? (
					<p className="mt-2">Nenhum contrato encontrado.</p>
				) : (
					<ListaDeContratos contratos={resultados} onEscolher={onEscolher} />
				))}
		</div>
	);
}
```

- [ ] **Step 5: `src/app/confere/components/FaixaDoContrato.tsx`**

```tsx
"use client";

import { useState } from "react";

import { nomeDaCompetencia, type DocumentosDoContrato } from "@/lib/confere/tipos-cadastro";
import type { Identificacao } from "../lib/types";
import { BuscaDeContrato, ListaDeContratos } from "./BuscaDeContrato";

interface Props {
	identificacao: Identificacao;
	/** O contrato em uso — achado pela planilha ou escolhido aqui. */
	documentos?: DocumentosDoContrato;
	/** O campo Contrato está com arquivo do computador: a proposta do cadastro vira oferta (§4.3). */
	contratoDoComputador: boolean;
	onEscolherContrato: (contratoId: string) => void;
	onUsarDoCadastro: () => void;
}

const CAIXA_AMBAR = "mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900";

/** A faixa entre os dois cartões e o de aditivos: de qual contrato a planilha é, o que foi escolhido
 *  e por quê — ou, sem contrato, as sugestões e a busca
 *  (docs/superpowers/specs/2026-09-25-confere-contrato-do-cadastro-design.md §4.2).
 *
 *  `role="status"` com `id` próprio pelo mesmo motivo do `identidade-aviso`: o inventário de
 *  anúncios da tela resolve por `id`. */
export function FaixaDoContrato({
	identificacao,
	documentos,
	contratoDoComputador,
	onEscolherContrato,
	onUsarDoCadastro,
}: Props) {
	const [buscando, setBuscando] = useState(false);

	const busca = (
		<BuscaDeContrato
			onEscolher={(contratoId) => {
				setBuscando(false);
				onEscolherContrato(contratoId);
			}}
		/>
	);

	if (identificacao.situacao === "lendo") {
		return (
			<p id="contrato-identificado" role="status" className="mt-4 text-sm text-confere-navy-600">
				Lendo o levantamento e buscando o contrato no cadastro…
			</p>
		);
	}

	if (documentos) {
		const { contrato, competencia } = documentos;
		return (
			<div
				id="contrato-identificado"
				role="status"
				className="mt-4 rounded-md border border-confere-teal-100 bg-confere-teal-50/40 p-4 text-sm text-confere-navy-600"
			>
				<p>
					<strong>Contrato {contrato.numeroTermo ?? "sem número"}</strong> · {contrato.clienteNome} ·
					competência {nomeDaCompetencia(competencia)} ·{" "}
					<a
						href={`/clientes/${contrato.clienteId}/contratos/${contrato.id}`}
						target="_blank"
						rel="noreferrer"
						className="font-semibold text-confere-teal-600 underline"
					>
						abrir contrato
					</a>{" "}
					·{" "}
					<button
						type="button"
						onClick={() => setBuscando((aberto) => !aberto)}
						className="font-semibold text-confere-teal-600 underline"
					>
						trocar contrato
					</button>
				</p>
				{!competencia.lidaDaPlanilha && (
					<p className="mt-1 text-xs">Competência não lida na planilha — usamos o mês atual para escolher os aditivos.</p>
				)}
				{contratoDoComputador && documentos.base && (
					<p className="mt-2 text-xs">
						O campo Contrato está com o arquivo enviado do computador.{" "}
						<button type="button" onClick={onUsarDoCadastro} className="font-semibold text-confere-teal-600 underline">
							Usar a proposta do cadastro ({documentos.base.nome})
						</button>
					</p>
				)}
				{buscando && <div className="mt-3">{busca}</div>}
				{documentos.avisos.length > 0 && (
					<ul className="mt-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
						{documentos.avisos.map((aviso) => (
							<li key={aviso.texto}>{aviso.texto}</li>
						))}
					</ul>
				)}
				{documentos.decisoes.length > 0 && (
					<details className="mt-3 text-xs">
						<summary className="cursor-pointer">Como os documentos foram escolhidos</summary>
						<ul className="mt-2 space-y-0.5">
							{documentos.decisoes.map((decisao, indice) => (
								<li key={`${decisao.rotulo}-${indice}`}>
									<strong>{decisao.rotulo}</strong>:{" "}
									{decisao.papel === "base"
										? "proposta-base (campo Contrato)"
										: decisao.papel === "aditivo"
											? "aplicado como aditivo"
											: decisao.motivo}
								</li>
							))}
						</ul>
					</details>
				)}
			</div>
		);
	}

	switch (identificacao.situacao) {
		case "ambiguo":
			return (
				<div id="contrato-identificado" role="status" className={CAIXA_AMBAR}>
					<p>
						<strong>Mais de um contrato com o número {identificacao.leitura.referencia}.</strong> Escolha qual:
					</p>
					<ListaDeContratos contratos={identificacao.candidatos} onEscolher={onEscolherContrato} />
				</div>
			);
		case "nao-encontrado":
			return (
				<div id="contrato-identificado" role="status" className={CAIXA_AMBAR}>
					<p>
						<strong>O contrato {identificacao.leitura.referencia} não está no cadastro.</strong> Escolha um dos
						contratos sugeridos, busque outro, ou envie a proposta do computador.
					</p>
					{identificacao.sugestoes.length > 0 && (
						<ListaDeContratos contratos={identificacao.sugestoes} onEscolher={onEscolherContrato} />
					)}
					<div className="mt-3">{busca}</div>
				</div>
			);
		case "sem-referencia":
			return (
				<div id="contrato-identificado" role="status" className={CAIXA_AMBAR}>
					<p>
						<strong>Não achamos o número do contrato neste levantamento.</strong> Busque o contrato ou envie a
						proposta do computador.
					</p>
					<div className="mt-3">{busca}</div>
				</div>
			);
		case "ilegivel":
			return (
				<div id="contrato-identificado" role="status" className={CAIXA_AMBAR}>
					<p>
						<strong>{identificacao.mensagem}.</strong> Escolha o contrato ou envie os arquivos do computador.
					</p>
					<div className="mt-3">{busca}</div>
				</div>
			);
		case "falhou":
			return (
				<div id="contrato-identificado" role="status" className={CAIXA_AMBAR}>
					<p>
						<strong>Não foi possível buscar o contrato agora.</strong> Escolha o contrato ou envie os arquivos do
						computador.
					</p>
					<div className="mt-3">{busca}</div>
				</div>
			);
		default:
			return null;
	}
}
```

- [ ] **Step 6: `src/app/confere/components/UploadForm.tsx`**

Imports:

```tsx
import type { DocumentoDoCadastro } from "@/lib/confere/tipos-cadastro";
import { textoDaOrigem } from "../lib/cadastro";
import { pareceLevantamento } from "../lib/documento";
import { type Achado, CAMPO_ADITIVOS, CAMPOS, type NomeDoCampo, nomeDaPeca, type Peca } from "../lib/types";
import { MenuDeDocumentos } from "./MenuDeDocumentos";
```

`Props` — trocar `arquivos` e `aditivos: readonly File[]` por:

```tsx
	/** O levantamento escolhido — o campo que só aceita arquivo do computador e dispara a busca. */
	levantamento?: File;
	/** O campo Contrato: arquivo do computador ou proposta do cadastro. */
	contrato?: Peca;
	onSelecionar: (campo: NomeDoCampo, arquivo: File | undefined) => void;
	/** Todas as propostas do contrato em uso — para "Trocar" e "+ Adicionar do cadastro". */
	alternativas: readonly DocumentoDoCadastro[];
	onTrocarContrato: (documento: DocumentoDoCadastro) => void;
	/** Em ordem de aplicação; mistura cadastro e computador. */
	aditivos: readonly Peca[];
	/** A seleção do computador **acrescenta** no fim da lista (a lista é da tela, não do `<input>`). */
	onSelecionarAditivos: (escolhidos: readonly File[]) => void;
	onRemoverAditivo: (indice: number) => void;
	onAdicionarAditivo: (documento: DocumentoDoCadastro) => void;
	/** O texto do campo de aditivos vazio. */
	semAditivos: string;
	/** A faixa de identificação do contrato — entre os dois cartões e o de aditivos. */
	faixa?: React.ReactNode;
	/** Remonta só o campo Contrato (zera o `<input>` quando o cadastro volta a ocupá-lo). */
	chaveContrato: number;
	/** Remonta só o campo de aditivos (zera o `<input>` a cada seleção acrescentada). */
	chaveAditivos: number;
```

No corpo:

```tsx
	const completo = contrato !== undefined && levantamento !== undefined;
	const bloqueado = !completo || processando;
	const contratoDoComputador = contrato?.tipo === "arquivo" ? contrato.arquivo : undefined;
	const contratoDoCadastro = contrato?.tipo === "cadastro" ? contrato.documento : undefined;
	const naLista = new Set(
		aditivos.flatMap((peca) => (peca.tipo === "cadastro" ? [peca.documento.arquivoId] : [])),
	);
	const paraAdicionar = alternativas.filter(
		(documento) => documento.arquivoId !== contratoDoCadastro?.arquivoId && !naLista.has(documento.arquivoId),
	);
```

e `avisarLevantamento` passa a usar `contratoDoComputador` no lugar de `arquivos.contrato`:

```tsx
	const avisarLevantamento =
		contratoDoComputador !== undefined &&
		pareceLevantamento(contratoDoComputador.name) &&
		contratoDoComputador.name !== nomeDispensado;
```

(e no botão "Usar assim mesmo": `setNomeDispensado(contratoDoComputador?.name ?? null)`).

Os dois cartões: o `<label>` deixa de ser o cartão — o cartão vira um `<div>` com as mesmas classes de borda/fundo/anel, e o `<label>` (título, descrição, input, estado) fica dentro, com `flex cursor-pointer flex-col gap-2`. O que é do cadastro fica **fora** do `<label>` (botão dentro de rótulo abre o seletor junto — mesmo motivo do aviso da `R-DOC-08`):

```tsx
				{CAMPOS.map((campo, indice) => {
					const nome = campo.nome === "contrato" ? (contrato ? nomeDaPeca(contrato) : undefined) : levantamento?.name;
					return (
						<div
							key={`${chave}-${campo.nome}-${campo.nome === "contrato" ? chaveContrato : 0}`}
							className="flex flex-col gap-2 rounded-md border border-confere-teal-100 bg-confere-teal-50/40 p-4 transition hover:border-confere-teal-400 has-[:focus-visible]:border-confere-teal-400 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-confere-teal-500 has-[:focus-visible]:ring-offset-2"
						>
							<label className="flex cursor-pointer flex-col gap-2">
								{/* (spans do rótulo e da descrição, e o <input> — iguais aos de hoje) */}
								<span
									id={`${campo.nome}-estado`}
									className={`mt-1 truncate rounded border px-2 py-1 text-xs ${
										nome
											? "border-confere-teal-400 bg-white text-confere-teal-600"
											: "border-confere-line bg-white text-confere-navy-300"
									}`}
								>
									{nome ?? "escolher arquivo…"}
								</span>
							</label>
							{campo.nome === "contrato" && contratoDoCadastro && (
								<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
									<span className="text-confere-teal-600">
										Do cadastro · {textoDaOrigem(contratoDoCadastro.origem)}
									</span>
									<a
										href={`/api/arquivos/${contratoDoCadastro.arquivoId}?modo=inline`}
										target="_blank"
										rel="noreferrer"
										className="font-semibold text-confere-teal-600 underline"
									>
										Ver PDF
									</a>
									<MenuDeDocumentos
										rotulo="Trocar"
										documentos={alternativas.filter((d) => d.arquivoId !== contratoDoCadastro.arquivoId)}
										onEscolher={onTrocarContrato}
										onEnviarDoComputador={() => refPrimeiroCampo.current?.click()}
									/>
								</div>
							)}
						</div>
					);
				})}
```

Logo depois do `</div>` do grid, antes do aviso `R-DOC-08`: `{faixa}`.

O cartão de aditivos (substitui o `<label>` inteiro de hoje):

```tsx
			<div
				key={`${chave}-${CAMPO_ADITIVOS.nome}-${chaveAditivos}`}
				className="mt-4 flex flex-col gap-2 rounded-md border border-confere-line bg-white p-4 transition hover:border-confere-teal-400 has-[:focus-visible]:border-confere-teal-400 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-confere-teal-500 has-[:focus-visible]:ring-offset-2"
			>
				<label className="flex cursor-pointer flex-col gap-2">
					<span className="text-sm font-semibold text-confere-navy-600">{CAMPO_ADITIVOS.rotulo}</span>
					<span id={`${CAMPO_ADITIVOS.nome}-descricao`} className="text-xs text-confere-navy-300">
						{CAMPO_ADITIVOS.descricao}
					</span>
					<input
						type="file"
						multiple
						ref={refAditivos}
						accept={CAMPO_ADITIVOS.aceita}
						disabled={processando}
						className="sr-only"
						aria-label={CAMPO_ADITIVOS.rotulo}
						aria-describedby={`${CAMPO_ADITIVOS.nome}-descricao ${CAMPO_ADITIVOS.nome}-estado`}
						onChange={(evento) => onSelecionarAditivos(Array.from(evento.target.files ?? []))}
					/>
					{aditivos.length === 0 && (
						<span
							id={`${CAMPO_ADITIVOS.nome}-estado`}
							className="mt-1 rounded border border-confere-line bg-white px-2 py-1 text-xs text-confere-navy-300"
						>
							{semAditivos}
						</span>
					)}
				</label>
				{/* Os nomes, e não a contagem: a ordem de envio é a ordem de aplicação
				    (`R-ADT-07`), e quem confere precisa vê-la — e de onde veio cada um. */}
				{aditivos.length > 0 && (
					<ol id={`${CAMPO_ADITIVOS.nome}-estado`} className="space-y-1">
						{aditivos.map((peca, posicao) => (
							<li
								key={`${posicao}-${nomeDaPeca(peca)}`}
								className="flex items-center justify-between gap-2 rounded border border-confere-teal-400 bg-white px-2 py-1 text-xs text-confere-teal-600"
							>
								<span className="truncate">
									{posicao + 1}. {nomeDaPeca(peca)}
									<span className="text-confere-navy-300">
										{" · "}
										{peca.tipo === "cadastro" ? `do cadastro · ${textoDaOrigem(peca.documento.origem)}` : "do computador"}
									</span>
								</span>
								<button
									type="button"
									onClick={() => onRemoverAditivo(posicao)}
									disabled={processando}
									aria-label={`Remover ${nomeDaPeca(peca)}`}
									className="shrink-0 rounded px-1.5 font-semibold text-confere-navy-600 hover:bg-confere-navy-50"
								>
									×
								</button>
							</li>
						))}
					</ol>
				)}
				<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
					{paraAdicionar.length > 0 && (
						<MenuDeDocumentos rotulo="+ Adicionar do cadastro" documentos={paraAdicionar} onEscolher={onAdicionarAditivo} />
					)}
					<button
						type="button"
						onClick={() => refAditivos.current?.click()}
						disabled={processando}
						className="font-semibold text-confere-teal-600 underline"
					>
						+ Enviar do computador
					</button>
				</div>
			</div>
```

- [ ] **Step 7: `src/app/confere/page.tsx`**

Imports:

```tsx
import type { DocumentoDoCadastro, DocumentosDoContrato } from "@/lib/confere/tipos-cadastro";
import { ConfirmarLimpeza } from "./components/ConfirmarLimpeza";
import { FaixaDoContrato } from "./components/FaixaDoContrato";
import { ProgressoDaGeracao } from "./components/ProgressoDaGeracao";
import { ResultadoPanel } from "./components/ResultadoPanel";
import { UploadForm } from "./components/UploadForm";
import {
	aquecerServico,
	conferirIdentidade,
	documentosDoContrato,
	gerarRelatorio,
	identificarLevantamento,
} from "./lib/api";
import { type Achado, CAMPOS, type Estado, type Identificacao, type NomeDoCampo, type Peca } from "./lib/types";
```

Estado — `aditivos` vira `readonly Peca[]` e entram:

```tsx
	// O campo Contrato vindo do cadastro. Fica à parte de `arquivos` porque o
	// arquivo do computador **prevalece** (a escolha manual nunca é trocada
	// sozinha — desenho §4.3) e a proposta do cadastro continua disponível para
	// "Usar a proposta do cadastro".
	const [contratoDoCadastro, setContratoDoCadastro] = useState<DocumentoDoCadastro | undefined>(undefined);
	const [identificacao, setIdentificacao] = useState<Identificacao>({ situacao: "ociosa" });
	const [documentos, setDocumentos] = useState<DocumentosDoContrato | undefined>(undefined);
	const [chaveContrato, setChaveContrato] = useState(0);
	const [chaveAditivos, setChaveAditivos] = useState(0);
	// Numera os pedidos de identificação: resposta de uma planilha já trocada
	// não pode preencher os campos da nova.
	const pedidoDeIdentificacao = useRef(0);

	const contrato: Peca | undefined = arquivos.contrato
		? { tipo: "arquivo", arquivo: arquivos.contrato }
		: contratoDoCadastro
			? { tipo: "cadastro", documento: contratoDoCadastro }
			: undefined;
```

Funções novas (junto de `selecionar`):

```tsx
	/** Qualquer mudança nas entradas invalida o resultado anterior — a mesma
	 *  sequência de `selecionar`, na mesma ordem (ver o comentário de lá). */
	function entradaMudou() {
		descartar(estado);
		setEstado({ situacao: "inicial" });
		setAviso("");
		setPergunta(undefined);
	}

	/** Os documentos do contrato em uso. Os aditivos do cadastro são refeitos;
	 *  os enviados do computador ficam, no fim da lista (desenho §4.3). */
	function aplicarDocumentos(novos: DocumentosDoContrato) {
		setDocumentos(novos);
		setContratoDoCadastro(novos.base ?? undefined);
		setAditivos((atual) => [
			...novos.aditivos.map((documento): Peca => ({ tipo: "cadastro", documento })),
			...atual.filter((peca) => peca.tipo === "arquivo"),
		]);
	}

	function limparDoCadastro() {
		setDocumentos(undefined);
		setContratoDoCadastro(undefined);
		setAditivos((atual) => atual.filter((peca) => peca.tipo === "arquivo"));
	}

	async function identificar(arquivo: File | undefined) {
		const pedido = ++pedidoDeIdentificacao.current;
		if (!arquivo) {
			setIdentificacao({ situacao: "ociosa" });
			limparDoCadastro();
			return;
		}
		setIdentificacao({ situacao: "lendo" });
		const resposta = await identificarLevantamento(arquivo);
		if (pedido !== pedidoDeIdentificacao.current) return;
		if (!resposta) {
			setIdentificacao({ situacao: "falhou" });
			limparDoCadastro();
			return;
		}
		setIdentificacao(resposta);
		if (resposta.situacao === "encontrado") aplicarDocumentos(resposta.documentos);
		else limparDoCadastro();
	}

	async function escolherContrato(contratoId: string) {
		const competencia = "leitura" in identificacao ? identificacao.leitura.competencia : null;
		const novos = await documentosDoContrato(contratoId, competencia);
		if (!novos) {
			setIdentificacao({ situacao: "falhou" });
			return;
		}
		entradaMudou();
		aplicarDocumentos(novos);
	}

	function trocarContrato(documento: DocumentoDoCadastro) {
		entradaMudou();
		setContratoDoCadastro(documento);
		setArquivos((atual) => ({ ...atual, contrato: undefined }));
		setChaveContrato((n) => n + 1);
	}

	function usarDoCadastro() {
		entradaMudou();
		setContratoDoCadastro(documentos?.base ?? undefined);
		setArquivos((atual) => ({ ...atual, contrato: undefined }));
		setChaveContrato((n) => n + 1);
	}

	function removerAditivo(posicao: number) {
		entradaMudou();
		setAditivos((atual) => atual.filter((_, i) => i !== posicao));
	}

	function adicionarAditivo(documento: DocumentoDoCadastro) {
		entradaMudou();
		setAditivos((atual) => [...atual, { tipo: "cadastro", documento }]);
	}
```

`selecionar` — acrescentar no fim: `if (campo === "levantamento") void identificar(arquivo);`

`selecionarAditivos` — passa a acrescentar (atualizar o comentário `R-ADT-10`: a lista agora é da tela):

```tsx
	/** `R-ADT-10`, revisto (desenho de 25/09/2026 §4.2) — a lista deixou de ser a
	 *  do `<input>`: mistura propostas do cadastro e arquivos do computador. A
	 *  seleção **acrescenta** no fim, e a chave zera o `<input>` para que escolher
	 *  o mesmo arquivo de novo volte a disparar. */
	function selecionarAditivos(escolhidos: readonly File[]) {
		if (escolhidos.length === 0) return;
		entradaMudou();
		aquecer();
		setAditivos((atual) => [...atual, ...escolhidos.map((arquivo): Peca => ({ tipo: "arquivo", arquivo }))]);
		setChaveAditivos((n) => n + 1);
	}
```

`confirmarLimpeza` — acrescentar:

```tsx
		pedidoDeIdentificacao.current += 1;
		setIdentificacao({ situacao: "ociosa" });
		setDocumentos(undefined);
		setContratoDoCadastro(undefined);
```

`enviar`:

```tsx
	async function enviar(identidadeConfirmada = false) {
		const levantamento = arquivos.levantamento;
		// `D-10` — a exigência continua sendo contrato e levantamento. Os aditivos
		// são opcionais, e o piloto, que não tem nenhum, segue submissível.
		if (!contrato || !levantamento) return;

		// ESPEC 029 `R-IDT-10` — (manter o comentário existente sobre o portão).
		// Só no envio todo do computador: com proposta do cadastro o par já foi
		// casado pelo número do contrato — e o portão, hoje, dá 404 no VerAI.
		const tudoDoComputador =
			contrato.tipo === "arquivo" && aditivos.every((peca) => peca.tipo === "arquivo");
		if (!identidadeConfirmada && contrato.tipo === "arquivo" && tudoDoComputador) {
			const conferencia = await conferirIdentidade(
				{ contrato: contrato.arquivo, levantamento },
				aditivos.flatMap((peca) => (peca.tipo === "arquivo" ? [peca.arquivo] : [])),
			);
			if (conferencia && !conferencia.combinam && conferencia.achados[0]) {
				setPergunta(conferencia.achados[0]);
				return;
			}
		}

		setPergunta(undefined);
		descartar(estado);
		setAviso("");
		setEstado({ situacao: "processando" });
		const resultado = await gerarRelatorio(
			{ levantamento, contrato, aditivos, contratoId: documentos?.contrato.id ?? null },
			identidadeConfirmada,
		);
		// ... (resto igual) ...
	}
```

`podeLimpar`:

```tsx
	const podeLimpar =
		estado.situacao !== "processando" &&
		(CAMPOS.some((campo) => arquivos[campo.nome]) ||
			contratoDoCadastro !== undefined ||
			aditivos.length > 0 ||
			identificacao.situacao !== "ociosa" ||
			estado.situacao !== "inicial");
```

Subtítulo (texto do VerAI — desenho §4.1):

```tsx
				<p className="mt-2 mb-8 text-sm text-confere-navy-600">
					Envie o levantamento da competência: o contrato e os aditivos são buscados no cadastro do
					cliente — ou envie os arquivos do computador. A aplicação compara o contratado com o medido e
					devolve o relatório de comprovação.
				</p>
```

`UploadForm`:

```tsx
				<UploadForm
					levantamento={arquivos.levantamento}
					contrato={contrato}
					onSelecionar={selecionar}
					alternativas={documentos?.alternativas ?? []}
					onTrocarContrato={trocarContrato}
					aditivos={aditivos}
					onSelecionarAditivos={selecionarAditivos}
					onRemoverAditivo={removerAditivo}
					onAdicionarAditivo={adicionarAditivo}
					semAditivos={documentos ? "nenhum aditivo depois da proposta-base — opcional" : "nenhum aditivo — opcional"}
					faixa={
						<FaixaDoContrato
							identificacao={identificacao}
							documentos={documentos}
							contratoDoComputador={arquivos.contrato !== undefined}
							onEscolherContrato={(contratoId) => void escolherContrato(contratoId)}
							onUsarDoCadastro={usarDoCadastro}
						/>
					}
					onEnviar={() => void enviar()}
					processando={estado.situacao === "processando"}
					chave={chave}
					chaveContrato={chaveContrato}
					chaveAditivos={chaveAditivos}
					podeLimpar={podeLimpar}
					onLimpar={() => setConfirmando(true)}
					refLimpar={limpar}
					refPrimeiroCampo={primeiroCampo}
					refAditivos={campoDeAditivos}
					perguntaDeIdentidade={pergunta}
					onGerarAssimMesmo={() => void enviar(true)}
					onDescartarPergunta={() => setPergunta(undefined)}
				/>
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx jest src/app/confere`
Expected: PASS (página, faixa, lib).

- [ ] **Step 9: Tipos**

Run: `npx tsc --noEmit`
Expected: sem erros (depende do `npm run dev:generate` da Task 6).

- [ ] **Step 10: Commit**

```bash
git add src/app/confere/components/MenuDeDocumentos.tsx src/app/confere/components/BuscaDeContrato.tsx src/app/confere/components/FaixaDoContrato.tsx src/app/confere/components/FaixaDoContrato.test.tsx src/app/confere/components/UploadForm.tsx src/app/confere/page.tsx src/app/confere/page.test.tsx
git commit -m "feat(confere): escolher o levantamento preenche contrato e aditivos pelo cadastro"
```

---

### Task 10: Verificação de ponta a ponta e documentação

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-09-25-confere-contrato-do-cadastro-design.md`, `docs/superpowers/specs/2026-09-21-integracao-confere-design.md`, `docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md`, `docs/superpowers/plans/2026-09-21-integracao-confere.md`, este plano (marcar tasks)

- [ ] **Step 1: Suíte do ConfereAI e tipos**

Run: `npx jest src/lib/confere src/app/confere src/app/api/confere`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 2: Os seis levantamentos reais contra o banco de desenvolvimento** — script de leitura (não fica no repositório), rodado com `npx dotenv -e .env.development -- npx tsx <script>`: para cada planilha de `C:\Users\p017886\Downloads\*Levantamento*.xlsx`, `identificarLevantamento(admin, bytes)` e imprimir situação, contrato, base e aditivos.
Expected (medido no protótipo de 25/09/2026): PGM → TA 04 + [TA 05]; CGM → TA 02; FTM → TA 529-FMTSP-2025; HSPM → PC + [TA 590-2025]; SMDET → TA 01 + [TA 02]; SMIT → TA 02.

- [ ] **Step 3: No navegador** — `localhost:3000/confere`, logado: escolher o levantamento do CGM → Contrato mostra `PA-CGM- 250912-127 v4.0.pdf` "Do cadastro · TA 02, renovação desde 15/10/2025"; faixa com "Contrato TC 16/CGM/2024 · … · competência agosto/2026"; gerar e conferir que o relatório sai e o histórico mostra "TC 16/CGM/2024 · agosto/2026".

- [ ] **Step 4: Documentação**
  - `CLAUDE.md`, seção "Integração do Confere": trocar "Sem vínculo com Cliente nem competência" por um parágrafo dizendo que o levantamento busca o contrato no cadastro (regra da última renovação; envio pelo computador continua; histórico com contrato e competência), apontando o design `2026-09-25-confere-contrato-do-cadastro-design.md` e este plano.
  - Design desta mudança: §2.1 ganha os seis levantamentos reais e as três formas da referência; §6.1 descreve as três formas + órgão do título; §7.4 corrige "um teste que prova isso" (o `SetNull` é do banco); status "implementado".
  - `2026-09-21-integracao-confere-design.md`: adendo curto apontando para o design novo.
  - `2026-09-23-repositorio-documentos-cliente-design.md`: §3.6 e o item "Fase 3" da §7.4 marcados como substituídos pelo design novo.
  - `docs/superpowers/plans/2026-09-21-integracao-confere.md`: "Task 11" apontando para este plano.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-25-confere-contrato-do-cadastro-design.md docs/superpowers/specs/2026-09-21-integracao-confere-design.md docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md docs/superpowers/plans/2026-09-21-integracao-confere.md docs/superpowers/plans/2026-09-25-confere-contrato-do-cadastro.md
git commit -m "docs(confere): o levantamento busca o contrato no cadastro — implementado"
```
