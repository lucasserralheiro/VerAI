/**
 * Régua da conversão PDF → HTML sobre o corpus do SharePoint — todas as propostas (PC/PA) da
 * biblioteca ContratosReceita, mais a pasta `arquivos-teste-conversao`. É o `npm run diag:pdf` em
 * escala: rode ANTES e DEPOIS de mexer em qualquer heurística de `src/lib/extracao`, nos MESMOS
 * arquivos, e veja arquivo por arquivo o que melhorou e o que piorou. Só lê — não grava no banco.
 *
 *   npm run regua:conversao -- --salvar        # ANTES: converte o corpus e guarda a base
 *   npm run regua:conversao                    # DEPOIS: reconverte os MESMOS PDFs e compara
 *   npm run regua:conversao -- --detalhe=CGM   # + diff do HTML dos arquivos cujo nome tem "CGM"
 *
 * Iteração rápida (subconjunto da base): --filtro=<trecho do caminho>, --gerador=<trecho do gerador>,
 * --por-gerador=N (N arquivos de cada gerador). Com filtro, --salvar só atualiza esses arquivos na base.
 *
 * Documentos REAIS dos usuários: --do-sistema baixa (uma vez, com cache) o original de toda conversão
 * de PDF feita na tela "Nova conversão" e põe no corpus — o que os usuários sobem vira caso de teste.
 * Precisa do banco e do R2 do ambiente (o de produção é onde estão as conversões reais):
 *   npx dotenv -e .env.production.local -- npm run regua:conversao -- --salvar --do-sistema
 * Ficam em logs/regua-conversao/sistema/ (fora do Git). Original que ainda está no Vercel Blob suspenso
 * não baixa e é só contado.
 *
 * Outras opções: --pasta="C:\...\rede.sp - ContratosReceita" (padrão: a da sincronização),
 * --extra=<pasta> (repetível; padrão ./arquivos-teste-conversao, todos os PDFs dela), --sem-extra,
 * --todos-pdfs (termos e o resto também, não só proposta), --tempo=<segundos por arquivo, padrão 120>,
 * --arquivo=logs/regua-conversao.json.
 *
 * Saída 1 quando algum arquivo piorou (ou passou a falhar). Piora esperada pela mudança: confira o
 * diff (--detalhe) e salve de novo; inesperada: a heurística quebrou outro gerador.
 * O HTML de cada arquivo fica em logs/regua-conversao/{base,agora}/<sha>.html pra abrir no navegador.
 * Spec: docs/superpowers/specs/2026-10-07-regua-conversao-sharepoint-design.md.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { createTwoFilesPatch } from 'diff'
import { getDocumentProxy } from 'unpdf'
import { pastaPadraoDaBiblioteca } from '../src/lib/arquivos/sharepoint/fonte-pasta'
import { converterPdfParaHtml } from '../src/lib/extracao/pdfHtml'
import {
  compararRodadas,
  fidelidadePercentual,
  INDICADORES,
  pontuacao,
  resumirPorGerador,
  type ComparacaoArquivo,
  type MedidaArquivo,
} from '../src/lib/extracao/regua/comparar'
import { familiaDoGerador, pareceProposta } from '../src/lib/extracao/regua/corpus'
import { medirConversao } from '../src/lib/extracao/regua/metricas'

interface BaseSalva {
  quando: string
  pastas: string[]
  /** Todo caminho visto na listagem (inclusive cópia idêntica de outro) — o que não está aqui é novo. */
  caminhosVistos: string[]
  medidas: MedidaArquivo[]
}

interface Candidato {
  caminho: string
  nome: string
}

// ─── argumentos ───────────────────────────────────────────────────────────────

function argumento(nome: string): string | undefined {
  return argumentos(nome)[0]
}
function argumentos(nome: string): string[] {
  return process.argv.filter((a) => a.startsWith(`--${nome}=`)).map((a) => a.slice(nome.length + 3).replace(/^"|"$/g, ''))
}
const tem = (nome: string) => process.argv.includes(`--${nome}`)

const ARQUIVO_BASE = argumento('arquivo') ?? 'logs/regua-conversao.json'
const PASTA_HTML = path.join(path.dirname(ARQUIVO_BASE), 'regua-conversao')
const TEMPO_MS = Number(argumento('tempo') ?? 120) * 1000
const FILTRO = argumento('filtro')?.toLowerCase()
const FILTRO_GERADOR = argumento('gerador')?.toLowerCase()
const POR_GERADOR = argumento('por-gerador') ? Number(argumento('por-gerador')) : null
const DETALHE = argumento('detalhe')?.toLowerCase()
const TEM_FILTRO = Boolean(FILTRO || FILTRO_GERADOR || POR_GERADOR)
const PASTA_SISTEMA = path.join(PASTA_HTML, 'sistema')

const formatoNumero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const n = (valor: number) => formatoNumero.format(valor)
const pct = (valor: number) => `${formatoNumero.format(valor * 100)}%`

// ─── corpus ───────────────────────────────────────────────────────────────────

async function listarPdfs(raiz: string, filtroNome: (nome: string) => boolean, prefixo: string): Promise<Candidato[]> {
  const saida: Candidato[] = []
  async function andar(relativo: string[]) {
    for (const e of await readdir(path.join(raiz, ...relativo), { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name.startsWith('~$')) continue
      const proximo = [...relativo, e.name]
      if (e.isDirectory()) await andar(proximo)
      else if (e.isFile() && filtroNome(e.name)) {
        saida.push({ caminho: path.join(raiz, ...proximo), nome: [prefixo, ...proximo].filter(Boolean).join('/').normalize('NFC') })
      }
    }
  }
  await andar([])
  return saida.sort((a, b) => a.nome.localeCompare(b.nome))
}

/**
 * Baixa o original de cada conversão de PDF feita no sistema para `logs/regua-conversao/sistema/`.
 * Arquivo já baixado não baixa de novo. Banco e storage só são carregados aqui — sem `--do-sistema`
 * a régua roda sem `.env` nenhum.
 */
async function baixarDoSistema(): Promise<void> {
  const { prisma } = await import('../src/lib/prisma')
  const { getUpload } = await import('../src/lib/storage')
  mkdirSync(PASTA_SISTEMA, { recursive: true })
  const arquivos = await prisma.propostaComercialArquivo.findMany({
    where: { tipo: 'pdf' },
    select: { id: true, nomeArquivo: true, caminhoOriginal: true },
    orderBy: { createdAt: 'asc' },
  })
  let baixados = 0
  const falhas: string[] = []
  for (const arquivo of arquivos) {
    const nome = `${arquivo.id} - ${arquivo.nomeArquivo.replace(/[\\/:*?"<>|]+/g, '_')}`.slice(0, 180)
    const destino = path.join(PASTA_SISTEMA, /\.pdf$/i.test(nome) ? nome : `${nome}.pdf`)
    if (existsSync(destino)) continue
    try {
      writeFileSync(destino, await getUpload(arquivo.caminhoOriginal))
      baixados++
    } catch (erro) {
      falhas.push(`${arquivo.nomeArquivo}: ${erro instanceof Error ? erro.message : String(erro)}`.slice(0, 160))
    }
  }
  await prisma.$disconnect()
  console.error(
    `Do sistema: ${arquivos.length} PDF(s) convertidos pelos usuários, ${baixados} baixado(s) agora` +
      (falhas.length ? `, ${falhas.length} sem acesso ao original (ex.: ${falhas[0]})` : '')
  )
}

async function listarCorpus(): Promise<{ pastas: string[]; candidatos: Candidato[] }> {
  const biblioteca = argumento('pasta') ?? pastaPadraoDaBiblioteca()
  const extras = tem('sem-extra') ? [] : argumentos('extra').length ? argumentos('extra') : ['arquivos-teste-conversao']
  // Os documentos reais já baixados entram sempre que a pasta existe — não só na rodada do --do-sistema.
  if (existsSync(PASTA_SISTEMA)) extras.push(PASTA_SISTEMA)
  const candidatos: Candidato[] = []
  const pastas: string[] = []

  if (existsSync(biblioteca)) {
    const filtroNome = tem('todos-pdfs') ? (nome: string) => /\.pdf$/i.test(nome) : pareceProposta
    candidatos.push(...(await listarPdfs(biblioteca, filtroNome, '')))
    pastas.push(biblioteca)
  } else {
    console.error(`aviso: biblioteca do SharePoint não encontrada em ${biblioteca} — use --pasta=`)
  }
  for (const extra of extras) {
    const raiz = path.resolve(extra)
    if (!existsSync(raiz)) continue
    candidatos.push(...(await listarPdfs(raiz, (nome) => /\.pdf$/i.test(nome), path.basename(raiz))))
    pastas.push(raiz)
  }
  return { pastas, candidatos }
}

function passaNoFiltro(nome: string, gerador?: string): boolean {
  if (FILTRO && !nome.toLowerCase().includes(FILTRO)) return false
  if (FILTRO_GERADOR && gerador !== undefined && !gerador.toLowerCase().includes(FILTRO_GERADOR)) return false
  return true
}

/** As N primeiras de cada gerador (ordem do nome) — amostra que cobre todos os jeitos de quebrar. */
function amostraPorGerador(medidas: MedidaArquivo[]): MedidaArquivo[] {
  if (!POR_GERADOR) return medidas
  const contagem = new Map<string, number>()
  return medidas.filter((m) => {
    const vistos = contagem.get(m.gerador) ?? 0
    contagem.set(m.gerador, vistos + 1)
    return vistos < POR_GERADOR
  })
}

// ─── medição ──────────────────────────────────────────────────────────────────

const sha = (dados: Buffer | string) => createHash('sha256').update(dados).digest('hex')

async function geradorDoPdf(buffer: Buffer): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const info = ((await pdf.getMetadata().catch(() => null))?.info ?? {}) as { Producer?: string; Creator?: string }
    await pdf.cleanup?.()
    return familiaDoGerador(info.Creator, info.Producer)
  } catch {
    return '(PDF ilegível)'
  }
}

function comTempo<T>(promessa: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promessa,
    new Promise<T>((_, rejeitar) => setTimeout(() => rejeitar(new Error(`passou de ${ms / 1000} s`)), ms).unref()),
  ])
}

async function medirArquivo(candidato: Candidato, buffer: Buffer, hash: string): Promise<{ medida: MedidaArquivo; html: string | null }> {
  const inicio = Date.now()
  const gerador = await geradorDoPdf(buffer)
  try {
    // Sem `salvarImagem`: imagem não entra no HTML (como no diag:pdf) — a régua mede texto e tabela.
    const resultado = await comTempo(converterPdfParaHtml(buffer), TEMPO_MS)
    return {
      medida: {
        sha256: hash,
        caminho: candidato.caminho,
        nome: candidato.nome,
        gerador,
        milissegundos: Date.now() - inicio,
        falha: null,
        metricas: medirConversao(resultado),
        htmlSha256: sha(resultado.html),
      },
      html: resultado.html,
    }
  } catch (erro) {
    return {
      medida: {
        sha256: hash,
        caminho: candidato.caminho,
        nome: candidato.nome,
        gerador,
        milissegundos: Date.now() - inicio,
        falha: erro instanceof Error ? erro.message.slice(0, 200) : String(erro).slice(0, 200),
        metricas: null,
        htmlSha256: null,
      },
      html: null,
    }
  }
}

function caminhoHtml(lado: 'base' | 'agora', hash: string) {
  return path.join(PASTA_HTML, lado, `${hash.slice(0, 16)}.html`)
}

function gravarHtml(lado: 'base' | 'agora', medida: MedidaArquivo, html: string | null) {
  if (html === null) return
  mkdirSync(path.join(PASTA_HTML, lado), { recursive: true })
  // Cabeçalho mínimo pra abrir no navegador com acento certo e saber de que arquivo é.
  const pagina = `<!doctype html><meta charset="utf-8"><title>${medida.nome.split('/').pop()}</title>\n<!-- ${medida.nome} -->\n${html}`
  writeFileSync(caminhoHtml(lado, medida.sha256), pagina)
}

function progresso(i: number, total: number, medida: MedidaArquivo) {
  const lento = medida.milissegundos > 15_000
  if (medida.falha || lento || i === total || i % 10 === 0) {
    const marca = medida.falha ? `FALHOU: ${medida.falha}` : lento ? `lento (${n(medida.milissegundos / 1000)} s)` : ''
    console.error(`[${i}/${total}] ${medida.nome} ${marca}`.trimEnd())
  }
}

// ─── impressão ────────────────────────────────────────────────────────────────

function linhaDeProblemas(totais: Record<string, number>): string {
  const partes = INDICADORES.filter((i) => i.sentido === 'menor' && totais[i.rotulo] > 0).map(
    (i) => `${i.rotulo} ${n(totais[i.rotulo])}`
  )
  return partes.length ? partes.join(' · ') : 'nenhum sinal de problema'
}

function imprimirPanorama(medidas: MedidaArquivo[]) {
  const convertidos = medidas.filter((m) => m.metricas && !m.falha)
  const fidelidadeMedia = convertidos.reduce((s, m) => s + fidelidadePercentual(m.metricas!), 0) / Math.max(1, convertidos.length)
  const numerosPdf = convertidos.reduce((s, m) => s + m.metricas!.numerosNoPdf, 0)
  const numerosErrados = convertidos.reduce((s, m) => s + m.metricas!.numerosPerdidos + m.metricas!.numerosSobrando, 0)
  const semDefeitoDeNumero = convertidos.filter((m) => m.metricas!.numerosPerdidos + m.metricas!.numerosSobrando === 0).length

  console.log(`\n${'═'.repeat(90)}`)
  console.log(
    `PANORAMA — ${medidas.length} PDF(s), ${medidas.length - convertidos.length} falha(s) · fidelidade média das palavras ${pct(fidelidadeMedia)} · ` +
      `números: ${n(numerosErrados)} errado(s) em ${n(numerosPdf)} · ${semDefeitoDeNumero} arquivo(s) com todos os números certos`
  )

  console.log('\nPOR GERADOR (pior primeiro — é aqui que o padrão aparece)')
  for (const g of resumirPorGerador(medidas)) {
    console.log(`\n  ${g.gerador}  —  ${g.arquivos} arquivo(s)${g.falhas ? `, ${g.falhas} falha(s)` : ''}, fidelidade ${pct(g.fidelidade)}`)
    console.log(`    ${linhaDeProblemas(g.totais)}`)
  }

  const piores = [...medidas].sort((a, b) => pontuacao(b) - pontuacao(a)).filter((m) => pontuacao(m) > 0).slice(0, 15)
  if (piores.length) {
    console.log('\nPIORES ARQUIVOS (onde olhar primeiro)')
    piores.forEach((m, i) => {
      console.log(`\n  ${i + 1}. ${m.nome}`)
      console.log(`     ${m.gerador} · pontuação ${n(pontuacao(m))}`)
      if (m.falha || !m.metricas) {
        console.log(`     conversão falhou: ${m.falha}`)
        return
      }
      const met = m.metricas
      const totais: Record<string, number> = {}
      for (const ind of INDICADORES) totais[ind.rotulo] = met[ind.campo]
      console.log(`     ${linhaDeProblemas(totais)}`)
      if (met.exemploNumerosPerdidos.length) console.log(`     números perdidos, ex.: ${met.exemploNumerosPerdidos.join('  ')}`)
      if (met.exemploNumerosSobrando.length) console.log(`     números a mais, ex.: ${met.exemploNumerosSobrando.join('  ')}`)
      if (met.exemploAritmetica) console.log(`     aritmética: ${met.exemploAritmetica}`)
      console.log(`     HTML: ${caminhoHtml('agora', m.sha256)}`)
    })
  }
}

function descreverMudancas(arquivo: ComparacaoArquivo): string {
  return arquivo.mudancas
    .map((m) => `${m.melhor ? '▲' : '▼'} ${m.rotulo} ${typeof m.antes === 'number' ? n(m.antes) : m.antes}→${typeof m.agora === 'number' ? n(m.agora) : m.agora}`)
    .join(', ')
}

function imprimirDiff(medida: MedidaArquivo) {
  const antes = caminhoHtml('base', medida.sha256)
  const agora = caminhoHtml('agora', medida.sha256)
  if (!existsSync(antes) || !existsSync(agora)) return
  // Um bloco do conversor por linha: o diff aponta o parágrafo/tabela que mudou, não a página inteira.
  const blocos = (arquivo: string) => readFileSync(arquivo, 'utf8').split('\n').slice(2).join('\n').split('\n\n').join('\n')
  const patch = createTwoFilesPatch('base', 'agora', blocos(antes), blocos(agora), '', '', { context: 1 })
  const todas = patch.split('\n')
  const linhas = todas.slice(Math.max(0, todas.findIndex((l) => l.startsWith('@@'))))
  if (!linhas[0]?.startsWith('@@')) return
  console.log(`\n  ── diff ${medida.nome}`)
  for (const linha of linhas.slice(0, 120)) console.log(`  ${linha.length > 300 ? `${linha.slice(0, 300)}…` : linha}`)
  if (linhas.length > 120) console.log(`  … (${linhas.length - 120} linha(s) a mais — abra os dois HTML)`)
}

// ─── modos ────────────────────────────────────────────────────────────────────

function lerBase(): BaseSalva | null {
  return existsSync(ARQUIVO_BASE) ? (JSON.parse(readFileSync(ARQUIVO_BASE, 'utf8')) as BaseSalva) : null
}

async function salvar() {
  if (tem('do-sistema')) await baixarDoSistema()
  const { pastas, candidatos } = await listarCorpus()
  const anterior = TEM_FILTRO ? lerBase() : null
  const escolhidos = candidatos.filter((c) => passaNoFiltro(c.nome))
  const vistosPorConteudo = new Set<string>()
  const medidas: MedidaArquivo[] = []

  console.error(`Convertendo ${escolhidos.length} PDF(s)…`)
  let i = 0
  for (const candidato of escolhidos) {
    i++
    const buffer = await readFile(candidato.caminho)
    const hash = sha(buffer)
    if (vistosPorConteudo.has(hash)) continue // cópia idêntica de outra pasta: conta uma vez só
    vistosPorConteudo.add(hash)
    const { medida, html } = await medirArquivo(candidato, buffer, hash)
    if (!passaNoFiltro(medida.nome, medida.gerador)) continue
    medidas.push(medida)
    gravarHtml('base', medida, html)
    progresso(i, escolhidos.length, medida)
  }

  const finais = amostraPorGerador(medidas)
  const base: BaseSalva = anterior
    ? {
        quando: new Date().toISOString(),
        pastas: anterior.pastas,
        caminhosVistos: [...new Set([...anterior.caminhosVistos, ...candidatos.map((c) => c.caminho)])],
        medidas: [...anterior.medidas.filter((m) => !finais.some((f) => f.sha256 === m.sha256)), ...finais],
      }
    : { quando: new Date().toISOString(), pastas, caminhosVistos: candidatos.map((c) => c.caminho), medidas: finais }

  mkdirSync(path.dirname(ARQUIVO_BASE), { recursive: true })
  writeFileSync(ARQUIVO_BASE, JSON.stringify(base, null, 1))
  imprimirPanorama(finais)
  console.log(
    `\nBase ${anterior ? 'atualizada' : 'salva'} em ${ARQUIVO_BASE}: ${base.medidas.length} PDF(s) distintos ` +
      `(${candidatos.length - vistosPorConteudo.size} cópia(s) idênticas ignoradas nesta listagem).`
  )
  console.log('Agora mude a heurística e rode de novo sem --salvar.')
}

async function comparar() {
  const base = lerBase()
  if (!base) throw new Error(`sem base em ${ARQUIVO_BASE} — rode com --salvar ANTES de mudar a heurística`)

  const selecionadas = amostraPorGerador(base.medidas.filter((m) => passaNoFiltro(m.nome, m.gerador)))
  const agora: MedidaArquivo[] = []
  const mudaramNaOrigem: string[] = []
  const sumiram: string[] = []

  console.error(`Reconvertendo ${selecionadas.length} PDF(s) da base de ${base.quando}…`)
  let i = 0
  for (const anterior of selecionadas) {
    i++
    if (!existsSync(anterior.caminho)) {
      sumiram.push(anterior.nome)
      continue
    }
    const buffer = await readFile(anterior.caminho)
    const hash = sha(buffer)
    if (hash !== anterior.sha256) {
      mudaramNaOrigem.push(anterior.nome)
      continue
    }
    const { medida, html } = await medirArquivo({ caminho: anterior.caminho, nome: anterior.nome }, buffer, hash)
    agora.push(medida)
    gravarHtml('agora', medida, html)
    progresso(i, selecionadas.length, medida)
  }

  const resultado = compararRodadas(selecionadas, agora)
  const grupos = (situacoes: string[]) => resultado.arquivos.filter((a) => situacoes.includes(a.situacao))
  const pioraram = grupos(['piorou', 'misto'])
  const melhoraram = grupos(['melhorou'])
  const soHtml = grupos(['só o HTML mudou'])

  imprimirPanorama(agora)

  console.log(`\n${'═'.repeat(90)}`)
  console.log(`ANTES × AGORA — base de ${base.quando}, ${agora.length} PDF(s) comparados`)
  console.log(`\n  ${'indicador'.padEnd(26)}${'antes'.padStart(10)}${'agora'.padStart(10)}`)
  for (const t of resultado.totais) {
    if (t.antes === 0 && t.agora === 0) continue
    const melhor = t.sentido === 'menor' ? t.agora < t.antes : t.agora > t.antes
    const seta = t.antes === t.agora ? ' ' : melhor ? '▲' : '▼'
    console.log(`  ${t.rotulo.padEnd(26)}${n(t.antes).padStart(10)}${n(t.agora).padStart(10)}  ${seta}`)
  }
  if (resultado.falhasAntes || resultado.falhasAgora) {
    console.log(`  ${'falhas de conversão'.padEnd(26)}${String(resultado.falhasAntes).padStart(10)}${String(resultado.falhasAgora).padStart(10)}`)
  }

  console.log(
    `\n  ${melhoraram.length} melhoraram · ${pioraram.length} pioraram (ou misto) · ${soHtml.length} mudaram só o HTML · ` +
      `${resultado.arquivos.length - melhoraram.length - pioraram.length - soHtml.length} iguais`
  )

  const imprimirGrupo = (titulo: string, lista: ComparacaoArquivo[], limite: number) => {
    if (!lista.length) return
    console.log(`\n${titulo}`)
    for (const a of lista.slice(0, limite)) console.log(`  ${a.nome}  [${a.gerador}]\n    ${descreverMudancas(a) || '(métricas iguais)'}`)
    if (lista.length > limite) console.log(`  … mais ${lista.length - limite}`)
  }
  imprimirGrupo('PIORARAM — confira antes de commitar (▼ = piorou, ▲ = melhorou)', pioraram, 60)
  imprimirGrupo('MELHORARAM', melhoraram, 30)
  imprimirGrupo('SÓ O HTML MUDOU (nenhuma métrica mexeu — dê uma olhada com --detalhe)', soHtml, 20)

  if (DETALHE) {
    const alvo = agora.filter((m) => m.nome.toLowerCase().includes(DETALHE))
    console.log(`\nDIFF DO HTML (${alvo.length} arquivo[s] com "${DETALHE}")`)
    for (const m of alvo) imprimirDiff(m)
  }

  if (mudaramNaOrigem.length) console.log(`\n${mudaramNaOrigem.length} PDF(s) mudaram no SharePoint desde a base (fora da comparação): ${mudaramNaOrigem.slice(0, 5).join(', ')}`)
  if (sumiram.length) console.log(`${sumiram.length} PDF(s) da base não existem mais: ${sumiram.slice(0, 5).join(', ')}`)
  if (!TEM_FILTRO) {
    const { candidatos } = await listarCorpus()
    const vistos = new Set(base.caminhosVistos)
    const novos = candidatos.filter((c) => !vistos.has(c.caminho))
    if (novos.length) console.log(`${novos.length} PDF(s) novo(s) no corpus desde a base — rode --salvar para incluí-los.`)
  }

  if (pioraram.length) process.exitCode = 1
}

;(tem('salvar') ? salvar() : comparar()).catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro)
  process.exitCode = 1
})
