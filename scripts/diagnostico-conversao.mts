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
 *   fidelidade           palavras e NÚMEROS do texto do PDF que sumiram,
 *                        apareceram ou mudaram de ordem no HTML
 *                        (`src/lib/extracao/regua/fidelidade.ts`). Número
 *                        perdido ou a mais deveria ser sempre zero.
 *
 * Para o corpus inteiro do SharePoint (centenas de propostas, antes × depois
 * arquivo por arquivo), use `npm run regua:conversao` — ver
 * `scripts/regua-conversao.ts`.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { getDocumentProxy } from 'unpdf'
import { converterPdfParaHtml } from '../src/lib/extracao/pdfHtml.js'
import { medirConversao, type MetricasConversao } from '../src/lib/extracao/regua/metricas.js'

/** As métricas moram em `src/lib/extracao/regua/metricas.ts` — a mesma
 *  definição da régua do corpus do SharePoint (`npm run regua:conversao`). */
interface Metricas extends MetricasConversao {
  arquivo: string
  gerador: string
  milissegundos: number
}

async function medir(caminho: string): Promise<Metricas> {
  const inicio = Date.now()
  const buffer = await readFile(caminho)
  const resultado = await converterPdfParaHtml(buffer)

  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const metadados = await pdf.getMetadata().catch(() => null)
  const info = (metadados?.info ?? {}) as { Producer?: string; Creator?: string }
  const gerador = [info.Creator, info.Producer].filter(Boolean).join(' / ') || '(sem metadado)'

  return {
    arquivo: basename(caminho),
    gerador,
    ...medirConversao(resultado),
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
      m.blocosGigantes +
      m.numerosPerdidos +
      m.numerosSobrando
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
    console.log(
      `  fidelidade        ${m.palavrasPerdidas} palavra(s) perdida(s), ${m.palavrasSobrando} a mais, ` +
        `${m.ordemMedida ? `${m.palavrasForaDeOrdem} fora de ordem` : 'ordem não medida'} (de ${m.palavrasNoPdf})`
    )
    console.log(
      `  números           ${m.numerosPerdidos} perdido(s), ${m.numerosSobrando} a mais (de ${m.numerosNoPdf})` +
        (m.exemploNumerosPerdidos.length ? ` — perdidos: ${m.exemploNumerosPerdidos.join(' ')}` : '') +
        (m.exemploNumerosSobrando.length ? ` — a mais: ${m.exemploNumerosSobrando.join(' ')}` : '')
    )
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
        `prosa em tabela ${soma((m) => m.prosaEmTabela)} | blocos gigantes ${soma((m) => m.blocosGigantes)} | ` +
        `números perdidos ${soma((m) => m.numerosPerdidos)} | números a mais ${soma((m) => m.numerosSobrando)}`
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
