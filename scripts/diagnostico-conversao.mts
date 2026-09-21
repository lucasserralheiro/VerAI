/**
 * Régua da conversão PDF → HTML.
 *
 *   npm run diag:pdf -- <pasta-com-pdfs | arquivo.pdf ...>
 *   npm run diag:pdf -- ./arquivos-teste-conversao --json > antes.json
 *
 * ## Por que isto existe
 *
 * As heurísticas de `src/lib/extracao` (título, justificado, tabela,
 * sublinhado, figura) são calibradas contra documento real, e a Proposta
 * Comercial recebe documento de origem MUITO variada. Cada gerador de PDF
 * quebra de um jeito diferente — medido até agora:
 *
 *   Microsoft: Print To PDF  (Word impresso)  camada de texto com letra
 *                                             trocada + borda de tabela
 *                                             desenhada pela metade
 *   wkhtmltopdf / Qt         (SEI da PMSP)    texto são, tabela boa, mas
 *                                             primeira coluna gruda com a
 *                                             segunda em célula multi-linha
 *
 * Ajustar uma constante no olho em cima do exemplar da vez conserta AQUELE
 * documento e quebra outros três sem ninguém perceber. Este script transforma
 * "ficou melhor?" em número: rode antes e depois de mexer em qualquer
 * heurística, nos MESMOS arquivos, e compare.
 *
 * ## O que cada número quer dizer
 *
 *   gerador              Producer/Creator do PDF. É o eixo de classificação:
 *                        defeito de conversão anda junto com o gerador, não
 *                        com o cliente nem com o tipo de proposta.
 *   correções            trocas do reparo determinístico da camada de texto
 *                        (`repararTextoPdf.ts`). Alto = o ARQUIVO veio com
 *                        letra trocada, não é defeito nosso.
 *   alertas              glifo estranho dentro de número ou caractere
 *                        desconhecido — nunca corrigido, sempre reportado.
 *                        QUALQUER valor acima de zero pede olho humano.
 *   tabelas              quantas tabelas o HTML tem, e quantas colunas cada
 *                        uma. Tabela de 1 coluna é tabela que não foi
 *                        reconhecida: virou parede de texto.
 *   linhas irregulares   linha de tabela com número de células diferente da
 *                        maioria das linhas daquela tabela. É o sinal de
 *                        CÉLULA MULTI-LINHA quebrada — o defeito mais caro,
 *                        porque desloca valor de coluna em silêncio.
 *   código grudado       célula que começa com código de serviço
 *                        (12.074.00005.00) e continua com texto. A coluna CÓD.
 *                        comeu o começo do PRODUTO.
 *   valor solto          bloco de texto comum com 3+ valores monetários
 *                        dentro. Sinal de tabela que não foi reconhecida:
 *                        preço, quantidade e total viraram um parágrafo só.
 *   soma confere         para cada tabela com coluna de total: a soma das
 *                        linhas bate com a linha de TOTAL? É a régua de ouro
 *                        numa proposta comercial, e é objetiva — não depende
 *                        de julgamento sobre layout.
 *   prosa em tabela      linha de tabela que acaba no meio da frase e continua
 *                        na linha de baixo: texto corrido picado em colunas.
 *                        Deveria ficar em zero.
 *   blocos gigantes      parágrafo comum grande demais e cheio de dígito —
 *                        outra cara de "tabela não reconhecida".
 *   OCR pendente         páginas sem camada de texto, que dependem de OCR.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { getDocumentProxy } from 'unpdf'
import { converterPdfParaHtml } from '../src/lib/extracao/pdfHtml.js'

/** Valor monetário brasileiro: "R$ 1.234,56", "BRL 681,69", "-7.948,25". */
const REGEX_VALOR = /(?:R\$|BRL)?\s*-?\d{1,3}(?:\.\d{3})*,\d{2}\b/g
/** Código de serviço da PRODAM: 12.074.00005.00 */
const REGEX_CODIGO_SERVICO = /^\s*\d{2}\.\d{3}\.\d{5}\.\d{2}\s+\S/
/** Fim de frase — mesmo critério que o conversor usa pra fechar parágrafo. */
const REGEX_PONTUACAO_FINAL = /[.:;!?]["'”)\]]?$/
const REGEX_CONTINUACAO = /^[a-zà-ú(]/
/** Linha de tabela que acaba em valor/percentual/rótulo entre parênteses é um
 *  registro fechado, não frase cortada. Sem isto o cronograma inteiro era
 *  acusado de "prosa em tabela". */
const REGEX_VALOR_FINAL = /[\d%)\]]$/
/** Acima disso, um parágrafo comum cheio de dígito é tabela não reconhecida. */
const TAMANHO_BLOCO_GIGANTE = 400
const FRACAO_DIGITOS_BLOCO_GIGANTE = 0.08
/** Tolerância da conferência aritmética, em reais — arredondamento de centavo
 *  na origem não é erro de conversão. */
const TOLERANCIA_SOMA = 0.02

interface Metricas {
  arquivo: string
  paginas: number
  gerador: string
  correcoes: number
  alertas: number
  tabelas: number
  colunas: number[]
  precoNaoReconhecido: number
  molduraViradaTabela: number
  linhasAritmeticaOk: number
  linhasAritmeticaQuebrada: number
  exemploAritmetica: string | null
  linhasIrregulares: number
  codigosGrudados: number
  valoresSoltos: number
  somasConferidas: number
  somasQuebradas: number
  exemploSomaQuebrada: string | null
  prosaEmTabela: number
  blocosGigantes: number
  ocrPendente: number
  milissegundos: number
}

function textoSemTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function celulasDaLinha(linha: string): string[] {
  return [...linha.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((m) => textoSemTags(m[1]))
}

/**
 * Valor monetário de uma célula, COM SINAL. O menos costuma vir separado do
 * número por espaço e, em proposta de aditivo, até antes da moeda:
 * "BRL - 7.948,25", "- R$ 1.200,00", "(1.200,00)" na notação contábil.
 * Ignorar isso faz uma Redução ser lida como Inclusão — e proposta de aditivo
 * é feita exatamente de somar e subtrair. (O `conferirTotais.ts` do sistema
 * tem hoje esse mesmo furo: o regex dele não captura o menos.)
 */
/** Número de uma célula que é só número: valor BR com 2 a 4 casas
 *  ("334,9700" — preço unitário de licença costuma ter 4), ou inteiro puro
 *  ("12", a coluna PERÍODO). `null` em qualquer outra coisa, inclusive código
 *  de serviço ("12.074.00005.00"), que tem ponto demais pra ser valor. */
function numeroSimples(texto: string): number | null {
  const limpo = texto.replace(/(?:R\$|BRL)/gi, '').trim()
  if (/^-?\d{1,3}(?:\.\d{3})*,\d{2,4}$/.test(limpo)) {
    return Number(limpo.replace(/\./g, '').replace(',', '.'))
  }
  if (/^-?\d{1,4}$/.test(limpo)) return Number(limpo)
  return null
}

/** Índices das colunas de uma tabela de preço, achados pelo cabeçalho.
 *  `null` quando a tabela não tem essa cara — a maioria não tem, e tudo bem. */
function colunasDePreco(cabecalho: string[]): { preco: number; quant: number; periodo: number; total: number } | null {
  const acha = (padrao: RegExp) => cabecalho.findIndex((c) => padrao.test(c))
  const preco = acha(/PRE[ÇC]O/i)
  const quant = acha(/QUANT/i)
  const periodo = acha(/PER[ÍI]ODO/i)
  const total = acha(/TOTAL/i)
  return preco >= 0 && quant >= 0 && total >= 0 ? { preco, quant, periodo, total } : null
}

function numeroDoTexto(texto: string): number | null {
  const achado = texto.match(/(-\s*)?(?:R\$|BRL)?\s*(-\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/)
  if (!achado) return null
  const valor = Number(achado[3].replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(valor)) return null
  const negativo = Boolean(achado[1] || achado[2]) || /^\s*\(.*\)\s*$/.test(texto)
  return negativo ? -valor : valor
}

/**
 * Conferência aritmética de uma tabela: acha a coluna cujo rótulo é TOTAL,
 * soma as linhas de dado e compara com a linha que se declara total (a que
 * tem "TOTAL" numa célula de texto). Devolve `null` quando a tabela não tem
 * essa estrutura — a maioria não tem, e isso não é problema.
 */
/**
 * Confere a aritmética de CADA LINHA de uma tabela de preço:
 * PREÇO × QUANT × PERÍODO = TOTAL.
 *
 * Esta é a régua que se sustenta sozinha. A versão anterior somava a coluna
 * TOTAL e comparava com a linha de total — e dava alarme falso o tempo todo,
 * porque nestas propostas a linha de total quase nunca soma as linhas da
 * MESMA tabela: ela diz "Elementos Originais TOTAL" (o contrato inteiro) ou
 * "A - SISTEMAS DE INFORMAÇÃO TOTAL" (a seção), e a tabela costuma estar
 * partida entre páginas. Medido no corpus real: 10 das 12 "somas quebradas"
 * eram isso, e uma era arredondamento de 4 centavos em 13 parcelas.
 *
 * A conferência por linha não depende de nada disso, e testa exatamente o que
 * interessa: se cada coluna foi lida na posição certa. Coluna deslocada
 * quebra o produto na hora.
 */
function conferirAritmeticaDasLinhas(linhas: string[][]): { ok: number; quebradas: number; exemplo: string | null } {
  const colunas = colunasDePreco(linhas[0] ?? [])
  if (!colunas) return { ok: 0, quebradas: 0, exemplo: null }

  let ok = 0
  let quebradas = 0
  let exemplo: string | null = null

  for (const linha of linhas.slice(1)) {
    const preco = numeroSimples(linha[colunas.preco] ?? '')
    const quant = numeroSimples(linha[colunas.quant] ?? '')
    const total = numeroSimples(linha[colunas.total] ?? '')
    if (preco === null || quant === null || total === null) continue
    // O PERÍODO não é procurado pela posição da coluna: em arquivo que
    // deslocou célula (o caso do iLovePDF, com 11 códigos grudados no nome do
    // produto), o índice achado pelo cabeçalho cai em cima de outra coluna e a
    // régua acusa linha certa como quebrada. Em vez disso, qualquer inteiro
    // pequeno presente na PRÓPRIA linha vale como candidato a período — a
    // pergunta que interessa é "os números desta linha são coerentes entre
    // si?", não "a coluna PERÍODO está no índice tal".
    const periodos = [
      1,
      ...linha
        .map((c) => numeroSimples(c))
        .filter((n): n is number => n !== null && Number.isInteger(n) && n > 1 && n <= 120),
    ]

    // DUAS convenções convivem nas propostas da PRODAM, e nenhuma é errada:
    // às vezes QUANT já é a quantidade do período inteiro (41.260 horas em 12
    // meses -> TOTAL = PREÇO × QUANT, e a coluna PERÍODO é informativa), às
    // vezes QUANT é por mês (1 equipamento -> TOTAL = PREÇO × QUANT × PERÍODO).
    // Medido no corpus: as duas aparecem, e em arquivos do MESMO gerador.
    // Exigir uma só acusava 28 de 104 linhas do Word 365 como quebradas —
    // todas certas. A linha conta como consistente se bater com QUALQUER uma
    // das duas; coluna lida na posição errada não bate com nenhuma, que é
    // exatamente o que esta métrica existe pra pegar.
    if (periodos.some((periodo) => Math.abs(preco * quant * periodo - total) <= TOLERANCIA_SOMA)) ok++
    else {
      quebradas++
      exemplo ??=
        `${preco} × ${quant} não fecha ${total.toFixed(2)} com período nenhum da linha ` +
        `(${periodos.join(', ')}) — linha: ${linha.map((c) => c.slice(0, 18)).join(' | ')}`
    }
  }

  return { ok, quebradas, exemplo }
}

/**
 * Soma da coluna de total × linha de total, SÓ quando o rótulo dessa linha é
 * um total simples ("TOTAL", "Total", "VALOR TOTAL") — nunca um total de
 * seção ("Elementos Originais TOTAL:"), que se refere a conteúdo que não está
 * naquela tabela. Tolerância cresce com o número de parcelas: arredondamento
 * de centavo na origem se acumula, e 4 centavos em 13 linhas é a origem
 * arredondando, não a conversão errando.
 */
function conferirSomaDaColuna(linhas: string[][]): { confere: boolean; detalhe: string } | null {
  if (linhas.length < 3) return null
  const colunaTotal = linhas[0].findIndex((c) => /\bTOTAL\b/i.test(c))
  if (colunaTotal === -1) return null

  const corpo = linhas.slice(1)
  const linhaTotal = corpo.find((l) => l.some((c) => /^(?:valor\s+)?total:?$/i.test(c.trim())))
  if (!linhaTotal) return null
  const declarado = numeroDoTexto(linhaTotal[colunaTotal] ?? '')
  if (declarado === null) return null

  const parcelas = corpo.filter((l) => l !== linhaTotal).map((l) => numeroDoTexto(l[colunaTotal] ?? '') ?? 0)
  const soma = parcelas.reduce((a, b) => a + b, 0)
  const tolerancia = TOLERANCIA_SOMA + 0.01 * parcelas.length

  return {
    confere: Math.abs(soma - declarado) <= tolerancia,
    detalhe: `soma ${soma.toFixed(2)} × total declarado ${declarado.toFixed(2)}`,
  }
}

async function medir(caminho: string): Promise<Metricas> {
  const inicio = Date.now()
  const buffer = await readFile(caminho)
  const resultado = await converterPdfParaHtml(buffer)

  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const metadados = await pdf.getMetadata().catch(() => null)
  const info = (metadados?.info ?? {}) as { Producer?: string; Creator?: string }
  const gerador = [info.Creator, info.Producer].filter(Boolean).join(' / ') || '(sem metadado)'

  const blocos = resultado.html.split('\n\n')
  const tabelas = resultado.html.match(/<table[\s\S]*?<\/table>/g) ?? []

  const colunas: number[] = []
  let precoNaoReconhecido = 0
  let molduraViradaTabela = 0
  let linhasAritmeticaOk = 0
  let linhasAritmeticaQuebrada = 0
  let exemploAritmetica: string | null = null
  let linhasIrregulares = 0
  let codigosGrudados = 0
  let prosaEmTabela = 0
  let somasConferidas = 0
  let somasQuebradas = 0
  let exemploSomaQuebrada: string | null = null

  for (const tabela of tabelas) {
    const linhas = (tabela.match(/<tr>[\s\S]*?<\/tr>/g) ?? []).map(celulasDaLinha)
    if (linhas.length === 0) continue

    const contagens = linhas.map((l) => l.length)
    const moda = [...contagens].sort(
      (a, b) => contagens.filter((c) => c === b).length - contagens.filter((c) => c === a).length
    )[0]
    colunas.push(moda)
    // Tabela de 1 coluna é tabela que NÃO foi reconhecida: as células viraram
    // uma parede de texto só. Sem esta contagem a régua aprovava documento com
    // a tabela de preço destruída ("nenhum sinal de problema") — foi
    // exatamente o que aconteceu no PC-SPTURIS na primeira rodada desta régua.
    // Tabela de 1 coluna é tabela que NÃO foi reconhecida — mas são dois
    // casos muito diferentes, e juntá-los escondia o grave atrás do leve
    // (medido no corpus: 3 dos 4 casos eram moldura, não preço).
    if (moda <= 1) {
      const valores = (textoSemTags(tabela).match(REGEX_VALOR) ?? []).length
      if (valores >= 3) precoNaoReconhecido++
      else molduraViradaTabela++
    }
    linhasIrregulares += contagens.filter((c) => c !== moda).length

    for (const linha of linhas) {
      for (const celula of linha) if (REGEX_CODIGO_SERVICO.test(celula)) codigosGrudados++
    }

    for (let i = 0; i < linhas.length - 1; i++) {
      const fim = linhas[i].join(' ').trim()
      const comeco = linhas[i + 1].join(' ').trim()
      if (!REGEX_PONTUACAO_FINAL.test(fim) && !REGEX_VALOR_FINAL.test(fim) && REGEX_CONTINUACAO.test(comeco)) {
        prosaEmTabela++
      }
    }

    const aritmetica = conferirAritmeticaDasLinhas(linhas)
    linhasAritmeticaOk += aritmetica.ok
    linhasAritmeticaQuebrada += aritmetica.quebradas
    exemploAritmetica ??= aritmetica.exemplo

    const soma = conferirSomaDaColuna(linhas)
    if (soma) {
      if (soma.confere) somasConferidas++
      else {
        somasQuebradas++
        exemploSomaQuebrada ??= soma.detalhe
      }
    }
  }

  let valoresSoltos = 0
  let blocosGigantes = 0
  for (const bloco of blocos) {
    if (bloco.includes('<table')) continue
    const texto = textoSemTags(bloco)
    if ((texto.match(REGEX_VALOR) ?? []).length >= 3) valoresSoltos++
    const digitos = (texto.match(/\d/g) ?? []).length
    if (texto.length > TAMANHO_BLOCO_GIGANTE && digitos / texto.length > FRACAO_DIGITOS_BLOCO_GIGANTE) {
      blocosGigantes++
    }
  }

  return {
    arquivo: basename(caminho),
    paginas: resultado.paginasConvertidas.length + resultado.paginasImagem.length,
    gerador,
    correcoes: resultado.correcoesDeTexto.length,
    alertas: resultado.alertasDeTexto.length,
    tabelas: tabelas.length,
    colunas,
    precoNaoReconhecido,
    molduraViradaTabela,
    linhasAritmeticaOk,
    linhasAritmeticaQuebrada,
    exemploAritmetica,
    linhasIrregulares,
    codigosGrudados,
    valoresSoltos,
    somasConferidas,
    somasQuebradas,
    exemploSomaQuebrada,
    prosaEmTabela,
    blocosGigantes,
    ocrPendente: resultado.paginasImagem.length,
    milissegundos: Date.now() - inicio,
  }
}

async function listarPdfs(alvos: string[]): Promise<string[]> {
  const encontrados: string[] = []
  for (const alvo of alvos) {
    const caminho = resolve(alvo)
    const informacao = await stat(caminho)
    if (informacao.isDirectory()) {
      const nomes = await readdir(caminho)
      encontrados.push(
        ...nomes.filter((n) => extname(n).toLowerCase() === '.pdf').map((n) => join(caminho, n))
      )
    } else if (extname(caminho).toLowerCase() === '.pdf') {
      encontrados.push(caminho)
    }
  }
  return encontrados.sort()
}

function imprimir(todas: Metricas[]) {
  for (const m of todas) {
    const problemas =
      m.precoNaoReconhecido +
      m.molduraViradaTabela +
      m.linhasAritmeticaQuebrada +
      m.linhasIrregulares +
      m.codigosGrudados +
      m.valoresSoltos +
      m.somasQuebradas +
      m.prosaEmTabela +
      m.blocosGigantes
    console.log(`\n${'─'.repeat(78)}`)
    console.log(`${m.arquivo}   ${m.paginas} pág.   ${m.milissegundos}ms`)
    console.log(`gerador: ${m.gerador}`)
    console.log(
      `  camada de texto   ${m.correcoes} correção(ões), ${m.alertas} alerta(s)` +
        (m.ocrPendente ? `, ${m.ocrPendente} página(s) dependendo de OCR` : '')
    )
    console.log(`  tabelas           ${m.tabelas}${m.colunas.length ? ` (colunas: ${m.colunas.join(', ')})` : ''}`)
    console.log(`  preço NÃO reconh. ${m.precoNaoReconhecido}  (tabela de valores que saiu com 1 coluna)`)
    console.log(`  moldura ⇒ tabela  ${m.molduraViradaTabela}  (bloco de texto emoldurado virou célula única)`)
    console.log(
      `  aritmética linha  ${m.linhasAritmeticaOk} ok, ${m.linhasAritmeticaQuebrada} quebrada(s)` +
        (m.exemploAritmetica ? ` — ${m.exemploAritmetica}` : '')
    )
    console.log(`  linhas irregular. ${m.linhasIrregulares}`)
    console.log(`  código grudado    ${m.codigosGrudados}`)
    console.log(`  valor solto       ${m.valoresSoltos}`)
    console.log(
      `  soma confere      ${m.somasConferidas} ok, ${m.somasQuebradas} quebrada(s)` +
        (m.exemploSomaQuebrada ? ` — ${m.exemploSomaQuebrada}` : '')
    )
    console.log(`  prosa em tabela   ${m.prosaEmTabela}`)
    console.log(`  blocos gigantes   ${m.blocosGigantes}`)
    console.log(`  ${problemas === 0 ? 'nenhum sinal de problema' : `${problemas} sinal(is) de problema`}`)
  }

  const porGerador = new Map<string, Metricas[]>()
  for (const m of todas) porGerador.set(m.gerador, [...(porGerador.get(m.gerador) ?? []), m])

  console.log(`\n${'═'.repeat(78)}`)
  console.log('RESUMO POR GERADOR — é aqui que o padrão aparece')
  for (const [gerador, arquivos] of [...porGerador.entries()].sort()) {
    const soma = (f: (m: Metricas) => number) => arquivos.reduce((a, m) => a + f(m), 0)
    console.log(`\n  ${gerador}  (${arquivos.length} arquivo[s])`)
    console.log(
      `    correções ${soma((m) => m.correcoes)} | alertas ${soma((m) => m.alertas)} | ` +
        `preço não reconhecido ${soma((m) => m.precoNaoReconhecido)} | ` +
        `moldura⇒tabela ${soma((m) => m.molduraViradaTabela)} | ` +
        `aritmética quebrada ${soma((m) => m.linhasAritmeticaQuebrada)}/${soma((m) => m.linhasAritmeticaOk + m.linhasAritmeticaQuebrada)} | ` +
        `linhas irregulares ${soma((m) => m.linhasIrregulares)} | código grudado ${soma((m) => m.codigosGrudados)} | ` +
        `valor solto ${soma((m) => m.valoresSoltos)} | somas quebradas ${soma((m) => m.somasQuebradas)} | ` +
        `prosa em tabela ${soma((m) => m.prosaEmTabela)} | blocos gigantes ${soma((m) => m.blocosGigantes)}`
    )
  }
  console.log()
}

const argumentos = process.argv.slice(2)
const json = argumentos.includes('--json')
const alvos = argumentos.filter((a) => a !== '--json')

if (alvos.length === 0) {
  console.error('uso: npm run diag:pdf -- <pasta-com-pdfs | arquivo.pdf ...> [--json]')
  process.exit(1)
}

const pdfs = await listarPdfs(alvos)
if (pdfs.length === 0) {
  console.error('nenhum PDF encontrado nos caminhos informados')
  process.exit(1)
}

const medidas: Metricas[] = []
for (const pdf of pdfs) {
  try {
    medidas.push(await medir(pdf))
  } catch (erro) {
    console.error(`falhou em ${basename(pdf)}:`, erro instanceof Error ? erro.message : erro)
  }
}

if (json) console.log(JSON.stringify(medidas, null, 2))
else imprimir(medidas)
