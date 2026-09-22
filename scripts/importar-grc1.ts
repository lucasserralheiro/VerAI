/**
 * Importação de corte único do legado GRC-1 (Access, `ControleGEN-1.accdb`) para os 12 models
 * novos do Prisma (Task 1 da migração — ver
 * docs/superpowers/specs/2026-09-22-relatorios-clientes-design.md e
 * docs/superpowers/plans/2026-09-22-relatorios-clientes.md).
 *
 *   npx tsx scripts/importar-grc1.ts <caminho-para-o.accdb>
 *
 * Rode contra `.env.development` (Postgres local) pra testar:
 *   npx dotenv -e .env.development -- npx tsx scripts/importar-grc1.ts C:\caminho\ControleGEN-1.accdb
 *
 * Sem `dotenv -e`, usa o `DATABASE_URL` que já estiver no ambiente (ou `.env.local`, carregado
 * como fallback abaixo) — é o mesmo `DATABASE_URL` que o resto do app usa.
 *
 * ## Step 1 — mecanismo de leitura do `.accdb` (decisão registrada)
 *
 * Esta máquina é Windows, sem `mdbtools` (o design doc pressupõe Linux/`apt`) e sem toolchain de
 * build nativo (sem Python/`node-gyp`), então instalar algo como `node-odbc` é arriscado. O que
 * existe e funciona: o provedor OLEDB `Microsoft.ACE.OLEDB.16.0` registrado no Windows. Rota
 * escolhida: `child_process.execFileSync('powershell.exe', ['-EncodedCommand', ...])` rodando um
 * script curto que abre `System.Data.OleDb.OleDbConnection` contra o `.accdb`, roda a query e
 * grava o resultado em JSON — SEM depender de nenhuma dependência nova no `package.json`.
 *
 * Dois detalhes de codificação, achados na prática (não é só teoria — quebrou de verdade antes de
 * eu corrigir):
 *   - O SCRIPT PowerShell não pode ir para um arquivo `.ps1` em disco: o Windows PowerShell 5.1 lê
 *     `.ps1` sem BOM usando o codepage do sistema, e qualquer identificador acentuado no SQL
 *     (`T_Responsável`, `T_Solicitação`, `Nº do Termo`, ...) vira lixo e a tabela não é encontrada.
 *     Por isso o comando vai inteiro por `-EncodedCommand` (Base64 de UTF-16LE) — não passa por
 *     nenhuma conversão de codepage no caminho.
 *   - O RESULTADO também não pode voltar pelo stdout capturado por `execFileSync`: mesmo com
 *     `-EncodedCommand`, o stdout do console do PowerShell 5.1 sai no codepage do console, não em
 *     UTF-8, e valores com acento (`Solicitação`, `Prorrogação`, ...) voltam com `�`. Por isso o
 *     PowerShell escreve o JSON num arquivo temporário com
 *     `[System.IO.File]::WriteAllText(path, json, [System.Text.UTF8Encoding]::new($false))`
 *     (UTF-8 sem BOM) e o Node só lê esse arquivo.
 *
 * ## Achados de dado real que mudaram o mapeamento em relação ao design doc
 *
 * Levantados rodando contra a CÓPIA DE TESTE do usuário (não é o arquivo de produção) — ver
 * `.superpowers/sdd/2026-09-22-relatorios-clientes/task-2-report.md` para os números completos:
 *
 *   1. `Solicitacao.legacyId` NÃO pode vir do "Nº" da solicitação como o comentário do schema
 *      (Task 1) sugeria: "Nº" É um inteiro puro (isso está OK), mas NÃO é único — duas
 *      solicitações diferentes (`ID_Solicitações` diferente) legitimamente compartilham o mesmo
 *      "Nº" de chamado (2 pares de duplicata em 112 linhas da cópia de teste). Como
 *      `Solicitacao.legacyId` é `@unique` no schema, usar "Nº" quebraria a importação na segunda
 *      ocorrência. Decisão (não mudei o schema da Task 1 — é decisão de controller/usuário se um
 *      campo dedicado pro "Nº" precisa entrar no schema): uso `ID_Solicitações` (autonumber do
 *      Access, garantidamente único) como `legacyId`, e preservo o "Nº" original como prefixo de
 *      `descricao` (`"Nº 1615977 — <assunto>"`) pra não perder a informação.
 *   2. `T_ItensContrato` NÃO tem nenhuma chave de junção confiável para `T_ContratoReceita` nos
 *      dados reais — ver `importarItensContrato()` abaixo e o relatório da Task 2 pra detalhe
 *      completo. Reportado como concern no relatório inicial da Task 2; decisão do usuário depois
 *      (Fix round 1): `ItemContrato.contratoId` virou opcional no schema (migração
 *      `20260922143856_item_contrato_contrato_opcional`), ganhou `contratoTextoLegado`, e a linha
 *      sem casamento confiável é importada mesmo assim (`contratoId: null` +
 *      `contratoTextoLegado` com o texto original) em vez de pulada — reconciliação manual fica
 *      pra depois. Ver docs/superpowers/specs/2026-09-22-relatorios-clientes-design.md §3.6.
 *   3. `importarClientes()` casa Cliente **só por `siglaLegado`** — nunca por `nome` (design doc
 *      §3.4: nome é frágil a divergência de grafia com o legado). Uma versão anterior (Fix round 1)
 *      tinha um fallback de casamento por `nome` que não estava no design nem coberto por teste;
 *      removido no Fix round 2. Quando a linha não casa por `siglaLegado` e criar um `Cliente` novo
 *      colidiria com o `nome` `@unique` de um `Cliente` já existente no VerAI (cadastrado à mão,
 *      sem `siglaLegado`), a linha é PULADA — nunca anexada nem criada por baixo do pano — e uma
 *      mensagem acionável é impressa no fim da função pra alguém preencher o `siglaLegado` manualmente
 *      e rodar o import de novo.
 */

import { PrismaClient, TipoHistoricoContrato, Prisma } from '@prisma/client'
import { execFileSync } from 'node:child_process'
import { readFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { config } from 'dotenv'

if (!process.env.DATABASE_URL) {
  config({ path: '.env.local' })
}

const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Leitura do .accdb via OLEDB/PowerShell (ver Step 1 no cabeçalho do arquivo)
// ---------------------------------------------------------------------------

let dbPath = ''

function queryAccess(sql: string): Record<string, unknown>[] {
  const outPath = join(tmpdir(), `grc1-import-${randomUUID()}.json`)
  const escapedOut = outPath.replace(/\\/g, '\\\\')
  const escapedDb = dbPath.replace(/\\/g, '\\\\')
  const ps = `
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
try {
  $conn = New-Object System.Data.OleDb.OleDbConnection('Provider=Microsoft.ACE.OLEDB.16.0;Data Source=${escapedDb};Persist Security Info=False;')
  $conn.Open()
  $cmd = $conn.CreateCommand()
  $cmd.CommandText = @'
${sql}
'@
  $reader = $cmd.ExecuteReader()
  $cols = @()
  for ($i = 0; $i -lt $reader.FieldCount; $i++) { $cols += $reader.GetName($i) }
  $rows = New-Object System.Collections.ArrayList
  while ($reader.Read()) {
    $obj = [ordered]@{}
    foreach ($c in $cols) {
      $v = $reader[$c]
      if ($v -is [DBNull]) { $v = $null }
      $obj[$c] = $v
    }
    [void]$rows.Add([PSCustomObject]$obj)
  }
  $reader.Close()
  $conn.Close()
  $json = $rows | ConvertTo-Json -Depth 5
  if ($null -eq $json) { $json = '[]' }
  [System.IO.File]::WriteAllText('${escapedOut}', $json, [System.Text.UTF8Encoding]::new($false))
} catch {
  $errObj = @{ error = $_.Exception.Message } | ConvertTo-Json
  [System.IO.File]::WriteAllText('${escapedOut}', $errObj, [System.Text.UTF8Encoding]::new($false))
}
`
  const b64 = Buffer.from(ps, 'utf16le').toString('base64')
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', b64], {
    encoding: 'utf8',
    maxBuffer: 200 * 1024 * 1024,
  })
  const raw = readFileSync(outPath, 'utf8')
  unlinkSync(outPath)
  const parsed = JSON.parse(raw)
  if (parsed && !Array.isArray(parsed) && typeof parsed === 'object' && 'error' in parsed) {
    throw new Error(`Falha na query Access: ${(parsed as { error: string }).error}\nSQL: ${sql}`)
  }
  if (parsed === null) return []
  return Array.isArray(parsed) ? parsed : [parsed]
}

// ---------------------------------------------------------------------------
// Helpers de conversão
// ---------------------------------------------------------------------------

/** O PowerShell serializa DateTime do Access como "/Date(<ms>)/" (formato do antigo
 *  JavaScriptSerializer do .NET). */
function parseAccessDate(v: unknown): Date | null {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === 'string') {
    const m = v.match(/^\/Date\((-?\d+)\)\/$/)
    if (m) return new Date(Number(m[1]))
    const d = new Date(v)
    if (!Number.isNaN(d.getTime())) return d
  }
  return null
}

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Valor monetário guardado como TEXTO no Access ("R$ 1.234,56", "1234,56", "1234.56") → string
 *  pronta pro Decimal do Prisma, ou null quando não parece número. Com vírgula, a vírgula é o
 *  decimal e os pontos são milhar; sem vírgula, o ponto é decimal. */
function parseValorTexto(v: string | null): string | null {
  if (!v) return null
  let t = v.replace(/R\$/gi, '').replace(/\s/g, '')
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  return /^\d+(\.\d+)?$/.test(t) ? t : null
}

function normSigla(v: unknown): string | null {
  const s = toStr(v)
  return s ? s.toUpperCase() : null
}

/** Remove acento pra comparação tolerante (ex.: "Prorrogação" vs "prorrogacao"). */
function foldAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function mapTipoHistorico(v: unknown): TipoHistoricoContrato | null {
  const s = toStr(v)
  if (!s) return null
  const f = foldAccents(s)
  if (f === 'contrato') return TipoHistoricoContrato.CONTRATO
  if (f === 'aditivo') return TipoHistoricoContrato.ADITIVO
  if (f === 'prorrogacao') return TipoHistoricoContrato.PRORROGACAO
  if (f === 'rescisao') return TipoHistoricoContrato.RESCISAO
  if (f === 'prospeccao') return TipoHistoricoContrato.PROSPECCAO
  return null
}

// ---------------------------------------------------------------------------
// Contadores pro relatório final
// ---------------------------------------------------------------------------

type TabelaStats = { lidas: number; importadas: number; puladas: number; motivos: Record<string, number> }

const stats: Record<string, TabelaStats> = {}

function novaStat(tabela: string): TabelaStats {
  const s: TabelaStats = { lidas: 0, importadas: 0, puladas: 0, motivos: {} }
  stats[tabela] = s
  return s
}

function pular(s: TabelaStats, motivo: string) {
  s.puladas++
  s.motivos[motivo] = (s.motivos[motivo] || 0) + 1
}

// Mapas legacyId (Access) -> id (VerAI/Postgres), construídos durante a importação, na ordem de
// FK pedida no brief: Cliente/Fornecedor primeiro → Contrato/ContratoOperacionalizacao →
// HistoricoContrato/ItemContrato/TermoConfirmacao/Faturamento/Demanda → NotaFiscal/TramiteDemanda.
const clienteByLegacyId = new Map<number, string>()
const clienteBySigla = new Map<string, string>()
const fornecedorByLegacyId = new Map<number, string>()
const contratoByLegacyId = new Map<number, string>()
const coByLegacyId = new Map<number, string>()
const faturamentoByLegacyId = new Map<number, string>()
const demandaByLegacyId = new Map<number, string>()

// ---------------------------------------------------------------------------
// 1. Cliente (casamento SÓ por siglaLegado — design doc §3.4, "não casa por nome") +
//    ResponsavelCliente
// ---------------------------------------------------------------------------

async function importarClientes() {
  const s = novaStat('T_Cliente')
  const rows = queryAccess(
    'SELECT [ID_Cliente], Sigla, Nome, [Endereço], [Nº], Bairro FROM [T_Cliente]'
  )
  s.lidas = rows.length

  // Colisões de `nome` (Cliente novo bateria no @unique de um Cliente já existente no VerAI, sem
  // siglaLegado) são coletadas e reportadas no fim, nunca resolvidas silenciosamente — casamento é
  // só por siglaLegado (design doc §3.4).
  const colisoesNome: string[] = []

  for (const row of rows) {
    const idCliente = toNum(row['ID_Cliente'])
    const sigla = normSigla(row['Sigla'])
    if (idCliente === null || !sigla) {
      pular(s, 'sem ID_Cliente ou Sigla')
      continue
    }
    const nome = toStr(row['Nome'])
    const endereco = toStr(row['Endereço'])
    const numero = row['Nº'] === null || row['Nº'] === undefined ? null : String(row['Nº'])
    const bairro = toStr(row['Bairro'])

    const existente = await prisma.cliente.findUnique({ where: { siglaLegado: sigla } })

    let cliente
    if (existente) {
      cliente = await prisma.cliente.update({
        where: { id: existente.id },
        data: { siglaLegado: sigla, endereco, numero, bairro },
      })
    } else {
      if (nome) {
        const colisao = await prisma.cliente.findUnique({ where: { nome } })
        if (colisao) {
          pular(s, 'nome colide com Cliente existente sem siglaLegado')
          colisoesNome.push(
            `Cliente "${nome}" (sigla ${sigla}) já existe no VerAI sem sigla — preencha siglaLegado=${sigla} nesse cliente (tela do cliente) e rode o import de novo`
          )
          continue
        }
      }
      cliente = await prisma.cliente.create({
        data: { nome: nome ?? sigla, siglaLegado: sigla, endereco, numero, bairro },
      })
    }
    clienteByLegacyId.set(idCliente, cliente.id)
    clienteBySigla.set(sigla, cliente.id)
    s.importadas++
  }

  for (const msg of colisoesNome) {
    console.warn(`  ! ${msg}`)
  }
}

async function importarResponsaveis() {
  const s = novaStat('T_Responsável')
  const rows = queryAccess(
    "SELECT [ID_Responsável], Cliente, [Nome Responsável], [e-mail], Telefone, Celular, [área] FROM [T_Responsável]"
  )
  s.lidas = rows.length

  for (const row of rows) {
    const legacyId = toNum(row['ID_Responsável'])
    const idCliente = toNum(row['Cliente'])
    if (legacyId === null) {
      pular(s, 'sem ID_Responsável')
      continue
    }
    const clienteId = idCliente !== null ? clienteByLegacyId.get(idCliente) : undefined
    if (!clienteId) {
      pular(s, 'Cliente não resolvido')
      continue
    }
    const data = {
      clienteId,
      nome: toStr(row['Nome Responsável']) ?? '(sem nome)',
      area: toStr(row['área']),
      email: toStr(row['e-mail']),
      telefone: toStr(row['Telefone']),
      celular: toStr(row['Celular']),
    }
    await prisma.responsavelCliente.upsert({
      where: { legacyId },
      create: { legacyId, ...data },
      update: data,
    })
    s.importadas++
  }
}

// ---------------------------------------------------------------------------
// 2. Fornecedor + ContratoOperacionalizacao
// ---------------------------------------------------------------------------

async function importarFornecedores() {
  const s = novaStat('T_Fornecedor')
  const rows = queryAccess(
    'SELECT [ID_Fornecedor], Fornecedor, Acordo, [Nº Acordo], DataAssinatura, [Processo SEI] FROM [T_Fornecedor]'
  )
  s.lidas = rows.length

  for (const row of rows) {
    const legacyId = toNum(row['ID_Fornecedor'])
    if (legacyId === null) {
      pular(s, 'sem ID_Fornecedor')
      continue
    }
    const data = {
      razaoSocial: toStr(row['Fornecedor']) ?? `Fornecedor legado #${legacyId}`,
      acordo: toStr(row['Acordo']),
      numeroAcordo: toStr(row['Nº Acordo']),
      dataAssinatura: parseAccessDate(row['DataAssinatura']),
      sei: toStr(row['Processo SEI']),
    }
    const fornecedor = await prisma.fornecedor.upsert({
      where: { legacyId },
      create: { legacyId, ...data },
      update: data,
    })
    fornecedorByLegacyId.set(legacyId, fornecedor.id)
    s.importadas++
  }
}

/** Parser tolerante pra "Vigência" (texto livre no Access) tentando extrair uma data; devolve
 *  null quando o campo não parece uma data (ex.: "12 meses"). Não é usado pra nada além de
 *  `dataInicio` de ContratoOperacionalizacao — não há coluna equivalente a valor/dataFim na
 *  origem, ver nota no relatório da Task 2. */
function tentarParseData(v: unknown): Date | null {
  const parsed = parseAccessDate(v)
  return parsed
}

async function importarContratoOperacionalizacao() {
  const s = novaStat('T_CO_Operacionalização')
  const rows = queryAccess(
    "SELECT [ID_Operacionalização], Fornecedor, Acordo, [Nº Contrato], [Vigência], SEI FROM [T_CO_Operacionalização]"
  )
  s.lidas = rows.length

  for (const row of rows) {
    const legacyId = toNum(row['ID_Operacionalização'])
    if (legacyId === null) {
      pular(s, 'sem ID_Operacionalização')
      continue
    }
    // Tanto "Fornecedor" quanto "Acordo" estão declarados como FK pra T_Fornecedor no .accdb
    // (achado do Step 1/exploração) — na prática, algumas linhas só preenchem um dos dois.
    const fornecedorLegacyId = toNum(row['Fornecedor']) ?? toNum(row['Acordo'])
    const fornecedorId = fornecedorLegacyId !== null ? fornecedorByLegacyId.get(fornecedorLegacyId) : undefined
    if (!fornecedorId) {
      pular(s, 'Fornecedor não resolvido')
      continue
    }
    const data = {
      fornecedorId,
      numero: toStr(row['Nº Contrato']),
      dataInicio: tentarParseData(row['Vigência']),
      dataFim: null as Date | null,
      valor: null as Prisma.Decimal | null,
      sei: toStr(row['SEI']),
    }
    const co = await prisma.contratoOperacionalizacao.upsert({
      where: { legacyId },
      create: { legacyId, ...data },
      update: data,
    })
    coByLegacyId.set(legacyId, co.id)
    s.importadas++
  }
}

// ---------------------------------------------------------------------------
// 3. Contrato (T_ContratoReceita) + HistoricoContrato (T_Propostas)
// ---------------------------------------------------------------------------

async function importarContratos() {
  const s = novaStat('T_ContratoReceita')
  const rows = queryAccess(
    "SELECT [ID_ContrReceit], Cliente, [Nº do Termo], Situação, SEI, [SEI PRODAM] FROM [T_ContratoReceita]"
  )
  s.lidas = rows.length

  for (const row of rows) {
    const legacyId = toNum(row['ID_ContrReceit'])
    const idCliente = toNum(row['Cliente'])
    if (legacyId === null) {
      pular(s, 'sem ID_ContrReceit')
      continue
    }
    const clienteId = idCliente !== null ? clienteByLegacyId.get(idCliente) : undefined
    if (!clienteId) {
      pular(s, 'Cliente não resolvido')
      continue
    }
    const data = {
      clienteId,
      numeroTermo: toStr(row['Nº do Termo']),
      seiCliente: toStr(row['SEI']),
      seiProdam: toStr(row['SEI PRODAM']),
      situacao: toStr(row['Situação']),
    }
    const contrato = await prisma.contrato.upsert({
      where: { legacyId },
      create: { legacyId, ...data },
      update: data,
    })
    contratoByLegacyId.set(legacyId, contrato.id)
    s.importadas++
  }
}

async function importarHistoricoContrato() {
  const s = novaStat('T_Propostas')
  // Exclui DocProposta/TA (objetos OLE embutidos — Word inteiro por linha, GBs em produção) e
  // Envio/Objeto (não usados no mapeamento).
  const rows = queryAccess(
    "SELECT [ID_Proposta], Tipo, Contrato, Proposta, Termo, [Assinada em], Valor, [Situação] FROM [T_Propostas]"
  )
  s.lidas = rows.length

  for (const row of rows) {
    const legacyId = toNum(row['ID_Proposta'])
    if (legacyId === null) {
      pular(s, 'sem ID_Proposta')
      continue
    }
    const idContrato = toNum(row['Contrato'])
    const contratoId = idContrato !== null ? contratoByLegacyId.get(idContrato) : undefined
    if (!contratoId) {
      pular(s, 'Contrato não resolvido')
      continue
    }
    const tipo = mapTipoHistorico(row['Tipo'])
    if (!tipo) {
      pular(s, 'Tipo nulo/não mapeado')
      continue
    }
    const situacao = toStr(row['Situação'])
    const proposta = toStr(row['Proposta'])
    const observacao =
      [situacao ? `Situação: ${situacao}` : null, proposta ? `Proposta: ${proposta}` : null]
        .filter(Boolean)
        .join(' | ') || null
    const data = {
      contratoId,
      tipo,
      numero: toStr(row['Termo']),
      data: parseAccessDate(row['Assinada em']),
      valor: toNum(row['Valor']),
      observacao,
    }
    await prisma.historicoContrato.upsert({
      where: { legacyId },
      create: { legacyId, ...data },
      update: data,
    })
    s.importadas++
  }
}

// ---------------------------------------------------------------------------
// 4. ItemContrato (T_ItensContrato) — ver concern grande no relatório da Task 2.
//
// T_ItensContrato NÃO tem nenhuma FK declarada no .accdb pra T_ContratoReceita (confirmado via
// OleDbSchemaGuid.Foreign_Keys), e a coluna "Contrato" (texto livre, ex. "031/SEME/2017") não bate
// com NENHUM campo de T_ContratoReceita pros contratos dos mesmos 6 clientes ("Nº do Termo",
// "Documento", "SEI" testados — 0/146 batem, mesmo restringindo aos itens cujo Cliente já é um dos
// 6 clientes conhecidos). Além disso a coluna "Cliente" de T_ItensContrato cita 37 siglas
// distintas, 33 delas fora dos 6 clientes deste GRC-1 (ex. SMDHC, TCM, IPREM, PGM) — é
// aparentemente uma tabela de itens/produtos ampla da PRODAM, não escopada a este sistema.
//
// Decisão do usuário (Fix round 1, depois do relatório inicial da Task 2): importar as 879 linhas
// mesmo sem vínculo — `ItemContrato.contratoId` virou opcional (migração
// `20260922143856_item_contrato_contrato_opcional`) e ganhou `contratoTextoLegado` pra guardar o
// texto bruto da coluna "Contrato" quando não é possível casar. O script TENTA o casamento
// pretendido (Cliente da linha ↔ Cliente conhecido, texto do campo "Contrato" ↔
// `Contrato.numeroTermo` do mesmo cliente) e preenche `contratoId` nos poucos casos em que bate;
// no resto (a imensa maioria, pelo levantamento acima), grava `contratoId: null` +
// `contratoTextoLegado` com o valor original, em vez de pular a linha. Nenhuma linha é mais
// descartada só por falta de vínculo — só por falta do próprio `legacyId`.
// ---------------------------------------------------------------------------

async function importarItensContrato() {
  const s = novaStat('T_ItensContrato')
  const rows = queryAccess(
    "SELECT [Identificação], Contrato, Cliente, [Descrição Produto], Qtd, [Vl Unit], [Vl Total] FROM [T_ItensContrato]"
  )
  s.lidas = rows.length

  // contratoLegacyId não serve aqui (a origem não expõe o ID interno do contrato pro item) —
  // casamento é feito por texto (Contrato.numeroTermo) escopado ao Cliente da linha, quando dá.
  const contratos = await prisma.contrato.findMany({ select: { id: true, clienteId: true, numeroTermo: true } })
  const porClienteETermo = new Map<string, string>()
  for (const c of contratos) {
    if (!c.numeroTermo) continue
    porClienteETermo.set(`${c.clienteId}::${c.numeroTermo.trim().toLowerCase()}`, c.id)
  }

  let semVinculo = 0
  let fallbackValorTotal = 0

  for (const row of rows) {
    const legacyId = toNum(row['Identificação'])
    if (legacyId === null) {
      pular(s, 'sem Identificação')
      continue
    }
    const textoContrato = toStr(row['Contrato'])
    const sigla = normSigla(row['Cliente'])
    const clienteId = sigla ? clienteBySigla.get(sigla) : undefined
    const contratoId =
      clienteId && textoContrato ? porClienteETermo.get(`${clienteId}::${textoContrato.toLowerCase()}`) ?? null : null

    if (!contratoId) semVinculo++

    let valorTotal = toNum(row['Vl Total'])
    if (valorTotal === null) {
      fallbackValorTotal++
      valorTotal = 0
    }
    const data = {
      contratoId,
      // Só grava o texto legado quando NÃO conseguiu casar — quando casou, o vínculo estruturado
      // (`contratoId`) já é a fonte de verdade e não precisa do texto bruto ao lado.
      contratoTextoLegado: contratoId ? null : textoContrato,
      descricao: toStr(row['Descrição Produto']),
      quantidade: toNum(row['Qtd']),
      valorUnitario: toNum(row['Vl Unit']),
      valorTotal,
    }
    await prisma.itemContrato.upsert({
      where: { legacyId },
      create: { legacyId, ...data },
      update: data,
    })
    s.importadas++
  }

  if (semVinculo > 0) {
    console.log(`  · ItemContrato: ${semVinculo}/${s.importadas} importados sem contratoId (contratoTextoLegado preenchido)`)
  }
  if (fallbackValorTotal > 0) {
    console.warn(`  ! ItemContrato: ${fallbackValorTotal} linha(s) com "Vl Total" ausente, usando fallback 0`)
  }
}

// ---------------------------------------------------------------------------
// 5. TermoConfirmacao (T_TermoConfirmação) — vazia na cópia de teste (0 linhas), implementado
//    de forma genérica mesmo assim.
// ---------------------------------------------------------------------------

async function importarTermosConfirmacao() {
  const s = novaStat('T_TermoConfirmação')
  const rows = queryAccess(
    "SELECT [ID_TC], ContratoDespesa, [Nº TC], Valor, [Data Início], [Data Fim], Cliente, [Contrato Receita], [Processo SEI] FROM [T_TermoConfirmação]"
  )
  s.lidas = rows.length

  for (const row of rows) {
    const legacyId = toNum(row['ID_TC'])
    if (legacyId === null) {
      pular(s, 'sem ID_TC')
      continue
    }
    const idCo = toNum(row['ContratoDespesa'])
    const co = idCo !== null ? coByLegacyId.get(idCo) : undefined
    let fornecedorId: string | undefined
    if (co) {
      const coRow = await prisma.contratoOperacionalizacao.findUnique({ where: { id: co }, select: { fornecedorId: true } })
      fornecedorId = coRow?.fornecedorId
    }
    if (!fornecedorId) {
      pular(s, 'Fornecedor (via ContratoDespesa) não resolvido')
      continue
    }
    const idCliente = toNum(row['Cliente'])
    const clienteId = idCliente !== null ? clienteByLegacyId.get(idCliente) : undefined
    if (!clienteId) {
      pular(s, 'Cliente não resolvido')
      continue
    }
    // "Contrato Receita" e "Valor" são TEXTO no Access (Task 4). Contrato casa quando o texto é o
    // ID numérico de T_ContratoReceita; o que não casar/parsear vai pra `observacao` com o texto
    // original, pra reconciliação manual — nunca descartado.
    const contratoTexto = toStr(row['Contrato Receita'])
    const idContrato = toNum(contratoTexto)
    const contratoId = idContrato !== null ? contratoByLegacyId.get(idContrato) ?? null : null
    const valorTexto = toStr(row['Valor'])
    const valor = parseValorTexto(valorTexto)
    const notas = [
      !contratoId && contratoTexto ? `Contrato Receita (legado): ${contratoTexto}` : null,
      valorTexto && valor === null ? `Valor (legado): ${valorTexto}` : null,
    ].filter(Boolean)
    const data = {
      fornecedorId,
      clienteId,
      contratoId,
      numero: toStr(row['Nº TC']),
      valor,
      vigenciaInicio: parseAccessDate(row['Data Início']),
      vigenciaFim: parseAccessDate(row['Data Fim']),
      sei: toStr(row['Processo SEI']),
      observacao: notas.length > 0 ? notas.join(' · ') : null,
    }
    await prisma.termoConfirmacao.upsert({
      where: { legacyId },
      create: { legacyId, ...data },
      update: data,
    })
    s.importadas++
  }
}

// ---------------------------------------------------------------------------
// 6. Faturamento (T_Faturamentos) + NotaFiscal (T_NotaFiscal)
// ---------------------------------------------------------------------------

async function importarFaturamentos() {
  const s = novaStat('T_Faturamentos')
  const rows = queryAccess(
    "SELECT [ID_Faturamento], Cliente, Contrato, [Mês], Ano FROM [T_Faturamentos]"
  )
  s.lidas = rows.length

  for (const row of rows) {
    const legacyId = toNum(row['ID_Faturamento'])
    if (legacyId === null) {
      pular(s, 'sem ID_Faturamento')
      continue
    }
    const idCliente = toNum(row['Cliente'])
    const clienteId = idCliente !== null ? clienteByLegacyId.get(idCliente) : undefined
    const idContrato = toNum(row['Contrato'])
    const contratoId = idContrato !== null ? contratoByLegacyId.get(idContrato) : undefined
    if (!clienteId || !contratoId) {
      pular(s, !clienteId ? 'Cliente não resolvido' : 'Contrato não resolvido')
      continue
    }
    const anoStr = toStr(row['Ano'])
    const data = {
      clienteId,
      contratoId,
      competenciaAno: anoStr ? parseInt(anoStr, 10) : null,
      competenciaMes: toNum(row['Mês']),
      // Não há campo de valor em T_Faturamentos na origem — o valor vive em T_NotaFiscal, ligado
      // 1:N a este faturamento (ver §3.6 do design doc). Fica null de propósito.
      valor: null as number | null,
      situacao: null as string | null,
    }
    const fat = await prisma.faturamento.upsert({
      where: { legacyId },
      create: { legacyId, ...data },
      update: data,
    })
    faturamentoByLegacyId.set(legacyId, fat.id)
    s.importadas++
  }
}

async function importarNotasFiscais() {
  const s = novaStat('T_NotaFiscal')
  const rows = queryAccess(
    "SELECT [ID_NotaFiscal], Faturamento, [DataEmissão], Valor FROM [T_NotaFiscal]"
  )
  s.lidas = rows.length

  for (const row of rows) {
    const legacyId = toNum(row['ID_NotaFiscal'])
    if (legacyId === null) {
      pular(s, 'sem ID_NotaFiscal')
      continue
    }
    const idFat = toNum(row['Faturamento'])
    const faturamentoId = idFat !== null ? faturamentoByLegacyId.get(idFat) : undefined
    if (!faturamentoId) {
      pular(s, 'Faturamento não resolvido')
      continue
    }
    const data = {
      faturamentoId,
      // Não há coluna de "número da NF" na origem — só o ID interno do Access.
      numero: null as string | null,
      valor: toNum(row['Valor']),
      dataEmissao: parseAccessDate(row['DataEmissão']),
    }
    await prisma.notaFiscal.upsert({
      where: { legacyId },
      create: { legacyId, ...data },
      update: data,
    })
    s.importadas++
  }
}

// ---------------------------------------------------------------------------
// 7. Demanda (T_Documento) + TramiteDemanda (T_Trâmite)
// ---------------------------------------------------------------------------

async function importarDemandas() {
  const s = novaStat('T_Documento')
  const rows = queryAccess(
    "SELECT [ID_Doc], [Data Início], Cliente, TipoAssunto, Assunto, [Tipo Documento], [Concluído], [Responsável] FROM [T_Documento]"
  )
  s.lidas = rows.length

  for (const row of rows) {
    const legacyId = toNum(row['ID_Doc'])
    if (legacyId === null) {
      pular(s, 'sem ID_Doc')
      continue
    }
    const idCliente = toNum(row['Cliente'])
    const clienteId = idCliente !== null ? clienteByLegacyId.get(idCliente) : undefined
    if (!clienteId) {
      pular(s, 'Cliente não resolvido (ou ausente na origem)')
      continue
    }
    const tipoAssunto = toStr(row['TipoAssunto'])
    const assuntoBase = toStr(row['Assunto'])
    const assunto = tipoAssunto && assuntoBase ? `[${tipoAssunto}] ${assuntoBase}` : assuntoBase
    const data = {
      clienteId,
      assunto,
      tipo: toStr(row['Tipo Documento']),
      responsavel: toStr(row['Responsável']),
      situacao: row['Concluído'] === true ? 'Concluído' : row['Concluído'] === false ? 'Em andamento' : null,
      dataAbertura: parseAccessDate(row['Data Início']),
    }
    const demanda = await prisma.demanda.upsert({
      where: { legacyId },
      create: { legacyId, ...data },
      update: data,
    })
    demandaByLegacyId.set(legacyId, demanda.id)
    s.importadas++
  }
}

async function importarTramites() {
  const s = novaStat('T_Trâmite')
  const rows = queryAccess(
    "SELECT [ID_Tram], [ID_Doc], Documento, [Responsável Atual], Desde, [Observação], [Ação], [Posição] FROM [T_Trâmite]"
  )
  s.lidas = rows.length

  for (const row of rows) {
    const legacyId = toNum(row['ID_Tram'])
    if (legacyId === null) {
      pular(s, 'sem ID_Tram')
      continue
    }
    // "Documento" é a coluna confiável (só 3 nulos em 369 na cópia de teste); "ID_Doc" está nulo
    // na maioria das linhas (308/369) mas nunca diverge de "Documento" quando as duas existem —
    // achado da exploração do Step 1/2, não do design doc.
    const idDoc = toNum(row['Documento']) ?? toNum(row['ID_Doc'])
    const demandaId = idDoc !== null ? demandaByLegacyId.get(idDoc) : undefined
    if (!demandaId) {
      pular(s, 'Demanda não resolvida')
      continue
    }
    const observacaoBase = toStr(row['Observação'])
    const respAtual = toStr(row['Responsável Atual'])
    const observacao =
      [observacaoBase, respAtual ? `Responsável atual: ${respAtual}` : null].filter(Boolean).join(' | ') || null
    const data = {
      demandaId,
      data: parseAccessDate(row['Desde']),
      posicao: toStr(row['Posição']),
      acao: toStr(row['Ação']),
      observacao,
    }
    await prisma.tramiteDemanda.upsert({
      where: { legacyId },
      create: { legacyId, ...data },
      update: data,
    })
    s.importadas++
  }
}

// ---------------------------------------------------------------------------
// 8. Solicitacao (T_Solicitação)
//
// legacyId vem de ID_Solicitações (autonumber do Access), NÃO do "Nº" do chamado — ver nota
// grande no cabeçalho do arquivo (achado #1) e o relatório da Task 2. O "Nº" é preservado como
// prefixo de `descricao` pra não perder a informação, já que o schema (Task 1) não tem um campo
// dedicado pra ele.
// ---------------------------------------------------------------------------

async function importarSolicitacoes() {
  const s = novaStat('T_Solicitação')
  const rows = queryAccess(
    "SELECT [ID_Solicitações], [Nº], Tipo, Assunto, Secretaria, DataAbertura, Status FROM [T_Solicitação]"
  )
  s.lidas = rows.length

  for (const row of rows) {
    const legacyId = toNum(row['ID_Solicitações'])
    if (legacyId === null) {
      pular(s, 'sem ID_Solicitações')
      continue
    }
    const sigla = normSigla(row['Secretaria'])
    const clienteId = sigla ? clienteBySigla.get(sigla) : undefined
    if (!clienteId) {
      pular(s, 'Secretaria não resolvida (ou fora dos 6 clientes conhecidos)')
      continue
    }
    const numero = toNum(row['Nº'])
    const assunto = toStr(row['Assunto'])
    const descricao = [numero !== null ? `Nº ${numero}` : null, assunto].filter(Boolean).join(' — ') || null
    const data = {
      clienteId,
      tipo: toStr(row['Tipo']),
      descricao,
      situacao: toStr(row['Status']),
      dataAbertura: parseAccessDate(row['DataAbertura']),
    }
    await prisma.solicitacao.upsert({
      where: { legacyId },
      create: { legacyId, ...data },
      update: data,
    })
    s.importadas++
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.error('Uso: npx tsx scripts/importar-grc1.ts <caminho-para-o.accdb>')
    process.exit(1)
  }
  dbPath = arg

  console.log(`Importando GRC-1 de: ${dbPath}`)
  console.log(`DATABASE_URL aponta pra: ${(process.env.DATABASE_URL || '').replace(/:[^:@]+@/, ':***@')}`)
  console.log('')

  // Ordem de FK — ver brief da Task 2 e comentário de cada bloco acima.
  await importarClientes()
  await importarResponsaveis()
  await importarFornecedores()
  await importarContratoOperacionalizacao()
  await importarContratos()
  await importarHistoricoContrato()
  await importarItensContrato()
  await importarTermosConfirmacao()
  await importarFaturamentos()
  await importarDemandas()
  await importarNotasFiscais()
  await importarTramites()
  await importarSolicitacoes()

  console.log('\n=== Resultado ===')
  for (const [tabela, s] of Object.entries(stats)) {
    console.log(`${tabela}: lidas=${s.lidas} importadas=${s.importadas} puladas=${s.puladas}`)
    for (const [motivo, n] of Object.entries(s.motivos)) {
      console.log(`  - ${motivo}: ${n}`)
    }
  }

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('✗ Erro:', err)
  await prisma.$disconnect()
  process.exit(1)
})
