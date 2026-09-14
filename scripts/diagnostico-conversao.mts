/**
 * Régua da conversão PDF → Markdown.
 *
 * As heurísticas de `src/lib/extracao` (título, justificado, tabela, sublinhado,
 * figura) são calibradas contra documento real. Calibrar no olho em cima de um
 * exemplar leva a ajuste que conserta aquele documento e quebra outros três sem
 * ninguém perceber — e a Proposta Comercial vive de receber documento de origem
 * variada. Este script transforma "ficou melhor?" em número: rode antes e
 * depois de mexer em qualquer constante e compare.
 *
 *   npx tsx scripts/diagnostico-conversao.mts <pasta-com-pdfs | arquivo.pdf ...>
 *   npx tsx scripts/diagnostico-conversao.mts ./pdfs --json > antes.json
 *
 * O que cada número quer dizer:
 *
 *   tabelas              quantas tabelas o Markdown tem.
 *   prosa-em-tabela      linha de tabela que acaba no meio da frase e continua
 *                        na linha de baixo. É o sinal de TABELA FALSA: texto
 *                        corrido picado em colunas. Numa tabela de verdade cada
 *                        linha é um registro que se fecha em si, então isso
 *                        deveria ficar em zero.
 *   paragrafos-cortados  bloco que termina sem pontuação final e é seguido de
 *                        bloco começando em minúscula — parágrafo partido no
 *                        meio pela detecção de tabela ou de título.
 *   imagens              figuras que entraram no Markdown.
 *   descartadas          imagens que ficaram de fora, agrupadas por motivo.
 *   blocos-gigantes      parágrafo/item de lista comum (não tabela) grande
 *                        demais e cheio de dígito — sinal de TABELA QUE NÃO
 *                        FOI RECONHECIDA: várias linhas do PDF (código, valor,
 *                        quantidade) viraram um bloco só de texto corrido, sem
 *                        coluna nenhuma. É exatamente o "parede de texto"
 *                        ilegível ao colar no SEI. Bandeira vermelha pra olhar
 *                        na mão, não uma classificação definitiva.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { getDocumentProxy } from 'unpdf'
import { converterPdfParaMarkdown } from '../src/lib/extracao/pdfMarkdown.js'
import { diagnosticarImagens, type MotivoDeDescarte } from '../src/lib/extracao/pdfImagens.js'

/** Fim de frase — mesmo critério que o conversor usa pra fechar parágrafo. */
const REGEX_PONTUACAO_FINAL = /[.:;!?]["'”)\]]?$/
/** Começo de continuação de frase: minúscula ou abre-parênteses. */
const REGEX_CONTINUACAO = /^[a-zà-ú(]/
/** Linha de tabela que acaba em VALOR — número, percentual ou um rótulo entre
 *  parênteses como "(R$)" — é um registro fechado, não uma frase cortada no
 *  meio. Sem isto, a tabela do cronograma inteira era acusada de "prosa em
 *  tabela": o cabeçalho acaba em "TOTAL (R$)" e a linha seguinte começa com o
 *  mês em minúscula ("out/26"), que casa com `REGEX_CONTINUACAO` por acaso. */
const REGEX_VALOR_FINAL = /[\d%)\]]$/

interface Metricas {
  arquivo: string
  paginas: number
  blocos: number
  tabelas: number
  prosaEmTabela: number
  exemploProsaEmTabela: string | null
  paragrafosCortados: number
  exemploParagrafoCortado: string | null
  blocosGigantes: number
  exemploBlocoGigante: string | null
  imagens: number
  descartadas: Record<string, number>
  milissegundos: number
}

async function listarPdfs(alvos: string[]): Promise<string[]> {
  const encontrados: string[] = []
  for (const alvo of alvos) {
    const caminho = resolve(alvo)
    const informacao = await stat(caminho)
    if (informacao.isDirectory()) {
      const nomes = await readdir(caminho)
      encontrados.push(
        ...nomes.filter((nome) => extname(nome).toLowerCase() === '.pdf').map((nome) => join(caminho, nome))
      )
    } else if (extname(caminho).toLowerCase() === '.pdf') {
      encontrados.push(caminho)
    }
  }
  return encontrados.sort()
}

/**
 * Tabela falsa: texto corrido picado em colunas. O sinal não é "célula longa"
 * — tabela de verdade tem coluna "Justificativa" com parágrafo inteiro dentro.
 * O sinal é a PROSA CONTINUAR de uma linha da tabela pra seguinte: a linha
 * acaba no meio da frase e a de baixo começa em minúscula. Numa tabela real
 * cada linha é um registro que se fecha em si.
 */
function medirTabelas(blocos: string[]) {
  const tabelas = blocos.filter((bloco) => bloco.startsWith('|'))
  let prosaEmTabela = 0
  let exemplo: string | null = null

  for (const tabela of tabelas) {
    const textoDasLinhas = tabela
      .split('\n')
      .filter((linha) => !/^\|\s*---/.test(linha))
      .map((linha) =>
        linha
          .split('|')
          .map((celula) => celula.trim())
          .filter(Boolean)
          .join(' ')
      )

    for (let i = 0; i < textoDasLinhas.length - 1; i++) {
      const atual = textoDasLinhas[i]
      const proxima = textoDasLinhas[i + 1]
      if (REGEX_PONTUACAO_FINAL.test(atual) || REGEX_VALOR_FINAL.test(atual)) continue
      if (!REGEX_CONTINUACAO.test(proxima)) continue
      prosaEmTabela++
      exemplo ??= `…${atual.slice(-45)} ⟂ ${proxima.slice(0, 45)}…`
    }
  }

  return { tabelas: tabelas.length, prosaEmTabela, exemplo }
}

/** Bloco "gigante": parágrafo ou item de lista comum (não tabela, título ou
 *  imagem) grande demais e com muito dígito — sinal de que a tabela de origem
 *  não foi detectada (nem por borda, nem por corredor — ver `iniciaTabela` em
 *  `pdfMarkdown.ts`) e várias linhas do PDF colapsaram num bloco só de texto
 *  corrido. Os dois limiares abaixo NÃO são medidos como as constantes de
 *  `pdfMarkdown.ts` — são heurística de bandeira vermelha pra achar candidato
 *  a olhar na mão, calibre com documento real se disparar demais/de menos. */
const LIMIAR_PALAVRAS_BLOCO_GIGANTE = 60
const LIMIAR_FRACAO_DIGITOS_BLOCO_GIGANTE = 0.15

function medirBlocosGigantes(blocos: string[]) {
  let gigantes = 0
  let exemplo: string | null = null

  for (const bloco of blocos) {
    if (bloco.startsWith('|') || bloco.startsWith('#') || bloco.startsWith('![') || bloco.startsWith(':::')) continue

    const texto = bloco.replace(/<[^>]+>/g, '').trim()
    const palavras = texto.split(/\s+/).filter(Boolean)
    if (palavras.length < LIMIAR_PALAVRAS_BLOCO_GIGANTE) continue

    const digitos = (texto.match(/\d/g) ?? []).length
    if (digitos / texto.length < LIMIAR_FRACAO_DIGITOS_BLOCO_GIGANTE) continue

    gigantes++
    exemplo ??= `${texto.slice(0, 90)}… (${palavras.length} palavras)`
  }

  return { gigantes, exemplo }
}

/** Parágrafo cortado: um bloco de texto que para no meio da frase e o bloco
 *  seguinte continua em minúscula. */
function medirParagrafosCortados(blocos: string[]) {
  let cortados = 0
  let exemplo: string | null = null

  for (let i = 0; i < blocos.length - 1; i++) {
    const atual = blocos[i]
    const proximo = blocos[i + 1]
    if (atual.startsWith('|') || atual.startsWith('#') || atual.startsWith('![')) continue
    if (proximo.startsWith('|') || proximo.startsWith('#') || proximo.startsWith('![')) continue

    const textoAtual = atual.replace(/<[^>]+>/g, '').trim()
    const textoProximo = proximo.replace(/<[^>]+>/g, '').trim()
    if (textoAtual.length === 0 || textoProximo.length === 0) continue
    if (/[.:;!?]["'”)\]]?$/.test(textoAtual)) continue
    if (!/^[a-zà-ú]/.test(textoProximo)) continue

    cortados++
    exemplo ??= `…${textoAtual.slice(-50)} ⟂ ${textoProximo.slice(0, 50)}…`
  }

  return { cortados, exemplo }
}

async function medir(caminho: string): Promise<Metricas> {
  const buffer = await readFile(caminho)
  const inicio = Date.now()

  const { markdown } = await converterPdfParaMarkdown(buffer, {
    // Não grava nada: o diagnóstico só precisa saber que a figura entrou e onde.
    salvarImagem: async (imagem) => `imagens/${imagem.nomeArquivo}`,
  })

  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { descartadas } = await diagnosticarImagens(pdf, pdf.numPages)

  const blocos = markdown.split('\n\n')
  const { tabelas, prosaEmTabela, exemplo } = medirTabelas(blocos)
  const { cortados, exemplo: exemploCorte } = medirParagrafosCortados(blocos)
  const { gigantes, exemplo: exemploGigante } = medirBlocosGigantes(blocos)

  const porMotivo: Record<string, number> = {}
  for (const imagem of descartadas) {
    const motivo: MotivoDeDescarte = imagem.motivo
    porMotivo[motivo] = (porMotivo[motivo] ?? 0) + 1
  }

  return {
    arquivo: basename(caminho),
    paginas: pdf.numPages,
    blocos: blocos.length,
    tabelas,
    prosaEmTabela,
    exemploProsaEmTabela: exemplo,
    paragrafosCortados: cortados,
    exemploParagrafoCortado: exemploCorte,
    blocosGigantes: gigantes,
    exemploBlocoGigante: exemploGigante,
    imagens: blocos.filter((bloco) => bloco.startsWith('![')).length,
    descartadas: porMotivo,
    milissegundos: Date.now() - inicio,
  }
}

function imprimirTabela(medicoes: Metricas[]): void {
  const colunas: [string, (m: Metricas) => string][] = [
    ['arquivo', (m) => m.arquivo.slice(0, 42)],
    ['pág.', (m) => String(m.paginas)],
    ['blocos', (m) => String(m.blocos)],
    ['tabelas', (m) => String(m.tabelas)],
    ['prosa-em-tabela', (m) => String(m.prosaEmTabela)],
    ['pár-cortados', (m) => String(m.paragrafosCortados)],
    ['blocos-gigantes', (m) => String(m.blocosGigantes)],
    ['imagens', (m) => String(m.imagens)],
    ['ms', (m) => String(m.milissegundos)],
  ]

  const linhas = [colunas.map(([titulo]) => titulo), ...medicoes.map((m) => colunas.map(([, ler]) => ler(m)))]
  const larguras = colunas.map((_, i) => Math.max(...linhas.map((linha) => linha[i].length)))
  for (const [indice, linha] of linhas.entries()) {
    console.log(linha.map((celula, i) => celula.padEnd(larguras[i])).join('  '))
    if (indice === 0) console.log(larguras.map((largura) => '-'.repeat(largura)).join('  '))
  }
}

function imprimirDetalhes(medicoes: Metricas[]): void {
  for (const m of medicoes) {
    const descartes = Object.entries(m.descartadas)
      .sort((a, b) => b[1] - a[1])
      .map(([motivo, quantas]) => `${motivo}=${quantas}`)
      .join(' ')
    if (!descartes && !m.exemploProsaEmTabela && !m.exemploParagrafoCortado && !m.exemploBlocoGigante) continue

    console.log(`\n${m.arquivo}`)
    if (descartes) console.log(`  imagens descartadas: ${descartes}`)
    if (m.exemploProsaEmTabela) console.log(`  prosa dentro de tabela: "${m.exemploProsaEmTabela}"`)
    if (m.exemploParagrafoCortado) console.log(`  parágrafo cortado: "${m.exemploParagrafoCortado}"`)
    if (m.exemploBlocoGigante) console.log(`  bloco gigante (tabela não reconhecida?): "${m.exemploBlocoGigante}"`)
  }
}

const argumentos = process.argv.slice(2)
const comoJson = argumentos.includes('--json')
const alvos = argumentos.filter((argumento) => !argumento.startsWith('--'))

if (alvos.length === 0) {
  console.error('uso: npx tsx scripts/diagnostico-conversao.mts <pasta-com-pdfs | arquivo.pdf ...> [--json]')
  process.exit(1)
}

const arquivos = await listarPdfs(alvos)
if (arquivos.length === 0) {
  console.error('nenhum PDF encontrado nos caminhos informados')
  process.exit(1)
}

const medicoes: Metricas[] = []
for (const arquivo of arquivos) {
  try {
    medicoes.push(await medir(arquivo))
  } catch (erro) {
    console.error(`FALHOU ${basename(arquivo)}: ${erro instanceof Error ? erro.message : String(erro)}`)
  }
}

if (comoJson) {
  console.log(JSON.stringify(medicoes, null, 2))
} else {
  imprimirTabela(medicoes)
  imprimirDetalhes(medicoes)

  const total = (ler: (m: Metricas) => number) => medicoes.reduce((soma, m) => soma + ler(m), 0)
  console.log(
    `\n${medicoes.length} documento(s): ${total((m) => m.tabelas)} tabelas, ` +
      `${total((m) => m.prosaEmTabela)} linhas de prosa dentro de tabela, ` +
      `${total((m) => m.paragrafosCortados)} parágrafos cortados, ` +
      `${total((m) => m.blocosGigantes)} blocos gigantes (candidato a tabela não reconhecida), ` +
      `${total((m) => m.imagens)} imagens.`
  )
}
