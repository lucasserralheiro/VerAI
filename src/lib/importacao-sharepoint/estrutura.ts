import { motivoIgnorar, normalizarChave, type PapelArquivo } from '@/lib/arquivos/sharepoint/regras'

// Lê a ÁRVORE da biblioteca ContratosReceita e monta cliente → contrato → termo, só pelos nomes de
// pasta e de arquivo (spec docs/superpowers/specs/2026-09-24-sincronizacao-sharepoint-contratos-design.md
// §8). Nada de banco nem de conteúdo de PDF aqui — isso é `texto.ts` e `importar.ts`.
//
// A árvore é feita à mão pelo financeiro, então as regras são tolerantes:
//   <cliente>/TC 073-2019 - Acesso a Rede/2) TC 073-2019 - TA 01-2020 - acréscimo/arquivo.pdf
//   <cliente>/Contratos Finalizados - X/TC .../N) termo/arquivo.pdf          (finalizado)
//   <cliente>/TC 06-2023 - Centralização Pagamentos/arquivo.pdf               (sem pasta de termo)
//   <cliente>/2) TC SN-2024 - TA 02 - Prorrogação/arquivo.pdf                (termo solto no cliente)
// O contrato é identificado pela CHAVE (número + ano), não pela pasta: termo solto ou pasta repetida
// ("SUB-ITP" e "SUB-ITAM PAULISTA" com o mesmo TC) caem no mesmo contrato.

export type TipoTermo = 'CONTRATO' | 'ADITIVO' | 'PRORROGACAO' | 'RESCISAO'

export interface TermoPasta {
  /** Identidade estável do termo: `${chaveContrato}|${caminho da pasta do termo}`. */
  chave: string
  pasta: string
  ordem: number | null
  tipo: TipoTermo
  /** "TA 01", "TAP 003-2023", "TA 304-FTMSP-2022"; `null` no contrato inicial. */
  numero: string | null
  /** O que sobra do nome da pasta depois do número — "Prorrogação 12m", "acréscimo". */
  rotulo: string
  meses: number | null
  /** Pasta diz que o termo não valeu ("não virou", "substituído") ou ainda não tem número ("TA XX"). */
  aviso: 'nao-efetivado' | 'sem-numero' | null
  termoPdf: string | null
  propostaPdf: string | null
  outros: string[]
  /** Todos os arquivos da pasta do termo, inclusive `WORK/` — é o que a aba Documentos liga a este termo. */
  arquivos: string[]
}

export interface ContratoPasta {
  /** `${sigla do cliente}|${número normalizado} ${ano}` — ex. "ADESAMPA|73 2019", "SUB-ITP|1 2026". Duas
   *  pastas do mesmo cliente caem no mesmo contrato (spec lugar-certo §3.3). */
  chave: string
  pastaCliente: string
  /** "TC 073/2019" — pela pasta; o importador prefere o número impresso no termo, se houver. */
  numeroTermo: string
  descricao: string | null
  /** TODAS as pastas do contrato estão em "Contratos Finalizados". Com qualquer pasta ativa, é ativo. */
  finalizado: boolean
  /** Tem pasta ativa E aparece também em "Contratos Finalizados" (cópia arquivada) — aviso pra arrumar. */
  tambemEmFinalizados: boolean
  pastas: string[]
  termos: TermoPasta[]
}

const PREFIXO_ORDEM = /^\s*(\d+)\)\s*/
const GRUPO = /^contratos?\s+(finalizad|encerrad)/i

/** Nome de pasta feito à mão: espaço e hífen repetidos ("TC  010--SP-URB-2026") viram um só. */
function limparNome(nome: string): string {
  return nome.replace(/\s+/g, ' ').replace(/-{2,}/g, '-')
}

/** Número + ano de um nome de pasta: "TC 073-2019" → {numero:"73", ano:"2019"}; "TC 11-PGM-23" →
 *  2023; "TC SN-2024" → "sn"; "385-2023 - Contrato" (sem TC) também vale. */
export function chaveDoNome(nome: string): { numero: string; ano: string } | null {
  const semOrdem = limparNome(nome).replace(PREFIXO_ORDEM, '')
  const m =
    /^\s*(?:TC\s*)?(SN|\d{1,6})\s*[-/.]\s*(?:[A-Za-z][A-Za-z.]*(?:[-.][A-Za-z]+)*\s*[-/.]\s*)?(\d{4}|\d{2})(?!\d)/i.exec(semOrdem) ??
    /^\s*(?:TC\s*)?(SN|\d{1,6})\s*[-/.]\s*(\d{4}|\d{2})(?!\d)/i.exec(semOrdem)
  if (!m) return null
  const numero = /^sn$/i.test(m[1]) ? 'sn' : String(Number(m[1]))
  const ano = m[2].length === 2 ? `20${m[2]}` : m[2]
  return { numero, ano }
}

function numeroTermoDe(nome: string): string | null {
  const semOrdem = limparNome(nome).replace(PREFIXO_ORDEM, '')
  const m = /^\s*(?:TC\s*)?((?:SN|\d{1,6})(?:\s*[-/.]\s*[A-Za-z0-9.]+)*?)(?=\s+-\s|\s*$|-\s)/i.exec(semOrdem)
  if (!m) return null
  return `TC ${m[1].replace(/\s+/g, '').replace(/-/g, '/')}`
}

/** Descrição do contrato = o que vem depois do número na pasta do contrato. */
function descricaoDe(nome: string): string | null {
  const semOrdem = limparNome(nome).replace(PREFIXO_ORDEM, '')
  const i = semOrdem.search(/\s-\s*|-\s+/)
  const resto = i >= 0 ? semOrdem.slice(i).replace(/^\s*-\s*/, '').trim() : ''
  return resto || null
}

/** Classifica a pasta do termo pelo nome. */
export function classificarTermo(nomePasta: string): Pick<TermoPasta, 'ordem' | 'tipo' | 'numero' | 'rotulo' | 'meses' | 'aviso'> {
  const ordem = PREFIXO_ORDEM.exec(nomePasta)
  const semOrdem = limparNome(nomePasta).replace(PREFIXO_ORDEM, '').trim()
  // Tira o "TC 073-2019 - " do começo, fica "TA 01-2020 - acréscimo".
  const resto = semOrdem.replace(/^\s*(?:TC\s*)?(?:SN|\d{1,6})(?:\s*[-/.]\s*[A-Za-z0-9.]+)*?(?:\s+-\s*|\s*-\s+|$)/i, '').trim()

  // "TA 01-2020", "TA 304-FTMSP-2022", "TAP 003", "TA XX". Sufixo só colado no número (sem espaço)
  // e sigla em MAIÚSCULA — senão "TA 02 - 12m" viraria "TA 02-12".
  const termo = /\b(TAP|TRA|TA)\b\s*(\d+|XX)?((?:-[A-Z][A-Z.]+)?-\d{4}|-\d{4})?/.exec(resto.replace(/\b(tap|tra|ta)\b/gi, (t) => t.toUpperCase()))
  const numero = termo ? [termo[1], termo[2] ? termo[2] + (termo[3] ?? '') : ''].filter(Boolean).join(' ') : null
  const rotulo = (termo ? resto.slice(termo.index + termo[0].length) : resto).replace(/^\s*-\s*/, '').trim()
  const meses = /(\d+)\s*(?:m\b|meses|m[eê]s)/i.exec(resto)

  let tipo: TipoTermo
  if (/\bTRA\b|rescis|indeniza/i.test(resto)) tipo = 'RESCISAO'
  else if (!termo && (resto === '' || /contrato\s+inicial/i.test(resto))) tipo = 'CONTRATO'
  else if (/prorrog|alt\.?\s*vig|\d+\s*(?:m\b|meses|m[eê]s)/i.test(resto)) tipo = 'PRORROGACAO'
  else if (termo || /aditivo|apostil|acr[eé]sc|redu[cç]|reajust|remanej|cronograma|inclus|sub-?roga/i.test(resto)) tipo = 'ADITIVO'
  else tipo = 'CONTRATO'

  let aviso: TermoPasta['aviso'] = null
  if (/n[aã]o\s+virou|substitu[ií]d|cancelad/i.test(resto)) aviso = 'nao-efetivado'
  else if (termo && /^XX$/i.test(termo[2] ?? '')) aviso = 'sem-numero'

  return {
    ordem: ordem ? Number(ordem[1]) : null,
    tipo,
    numero: tipo === 'CONTRATO' ? null : numero,
    rotulo: rotulo || resto,
    meses: meses ? Number(meses[1]) : null,
    aviso,
  }
}

/** PDF do termo (TC/TA/TAP/TRA, "termo", "assinado") e PDF da proposta (PC/PA). Publicação do DOC,
 *  ordem de início e termo de confidencialidade citam o TC no nome, mas não são o termo. */
export function papelDoArquivo(nome: string): PapelArquivo {
  if (!/\.pdf$/i.test(nome)) return 'outro'
  const base = nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/^DOC\s|ordem de inicio|confidencialidade/i.test(base)) return 'outro'
  if (/^(PC|PA)[\s_\-.]/i.test(base) || /\bproposta\b/i.test(base)) return 'proposta'
  if (/^(TC|TAP|TRA|TA|\d+\s*[ºo°]?\s*TA)\b/i.test(base) || /\btermo\b|assinad|aditamento|apostil/i.test(base)) return 'termo'
  // "SF TA 02 ao TC 37-2019.pdf", "TA125-2023 ao TC 312_2021.pdf", "TC004-SMPED-2020 - TA 001-2020.pdf"
  if (/\bT(?:AP|RA|A|C)\s*\d/i.test(base) || /^T(?:AP|RA|A|C)\d/i.test(base)) return 'termo'
  return 'outro'
}

function escolherTermo(candidatos: string[]): string | null {
  if (candidatos.length === 0) return null
  const assinado = candidatos.find((c) => /assinad/i.test(c))
  return assinado ?? [...candidatos].sort((a, b) => a.length - b.length)[0]
}

export function montarEstrutura(caminhos: string[], siglaDaPastaCliente: (pasta: string) => string = normalizarChave): ContratoPasta[] {
  const contratos = new Map<string, ContratoPasta>()
  const arquivosPorTermo = new Map<string, string[]>()
  const presencaPorContrato = new Map<string, { emFinalizados: boolean; emAtivos: boolean }>()

  for (const caminho of caminhos) {
    const segmentos = caminho.split('/')
    if (motivoIgnorar(segmentos, 1)) continue
    const [pastaCliente, ...resto] = segmentos
    const pastasAll = resto.slice(0, -1).filter((p) => normalizarChave(p) !== 'WORK')
    const finalizado = pastasAll.some((p) => GRUPO.test(p))
    const pastas = pastasAll.filter((p) => !GRUPO.test(p))
    if (pastas.length === 0) continue // arquivo solto na pasta do cliente

    // Contrato = primeira pasta com chave; termo = pasta mais funda. Termo inicial com chave PRÓPRIA
    // diferente (contrato novo aninhado num aditivo) vira contrato à parte.
    const pastaContrato = pastas[0]
    let chave = chaveDoNome(pastaContrato)
    // Uma pasta só: com "N) " na frente é termo solto no cliente; sem, é pasta de contrato sem
    // subpasta de termo (os arquivos dela são o contrato inicial).
    const pastaTermo: string | null =
      pastas.length > 1 ? pastas[pastas.length - 1] : PREFIXO_ORDEM.test(pastaContrato) ? pastaContrato : null
    let contratoAninhado = false
    if (pastaTermo && pastas.length > 2) {
      const propria = chaveDoNome(pastaTermo)
      if (propria && chave && (propria.numero !== chave.numero || propria.ano !== chave.ano) && classificarTermo(pastaTermo).tipo === 'CONTRATO') {
        chave = propria
        contratoAninhado = true
      }
    }
    if (!chave && pastaTermo) chave = chaveDoNome(pastaTermo)
    if (!chave) continue

    const chaveContrato = `${siglaDaPastaCliente(pastaCliente)}|${chave.numero} ${chave.ano}`
    let contrato = contratos.get(chaveContrato)
    const ehPastaDeContrato = pastaTermo !== pastaContrato && !contratoAninhado
    if (!contrato) {
      contrato = {
        chave: chaveContrato,
        pastaCliente,
        numeroTermo: numeroTermoDe(ehPastaDeContrato ? pastaContrato : pastaTermo ?? pastaContrato) ?? `TC ${chave.numero}/${chave.ano}`,
        descricao: ehPastaDeContrato ? descricaoDe(pastaContrato) : null,
        finalizado: false,
        tambemEmFinalizados: false,
        pastas: [],
        termos: [],
      }
      contratos.set(chaveContrato, contrato)
    }
    // Resolvido no fim: finalizado só se NENHUM arquivo do contrato estiver fora de "Contratos Finalizados"
    // (SMIT TC 52/2024 tem cópia arquivada dentro de outro contrato finalizado e pasta própria ativa).
    const presenca = presencaPorContrato.get(chaveContrato) ?? { emFinalizados: false, emAtivos: false }
    if (finalizado) presenca.emFinalizados = true
    else presenca.emAtivos = true
    presencaPorContrato.set(chaveContrato, presenca)
    if (!contrato.descricao && ehPastaDeContrato) contrato.descricao = descricaoDe(pastaContrato)
    const caminhoPastaContrato = [pastaCliente, ...pastasAll.slice(0, pastasAll.indexOf(pastaContrato) + 1)].join('/')
    if (ehPastaDeContrato && !contrato.pastas.includes(caminhoPastaContrato)) contrato.pastas.push(caminhoPastaContrato)

    // Sem pasta de termo: os arquivos da pasta do contrato são o contrato inicial.
    const caminhoTermo = pastaTermo
      ? segmentos.slice(0, segmentos.indexOf(pastaTermo, 1) + 1).join('/')
      : `${caminhoPastaContrato}#inicial`
    const chaveTermo = `${chaveContrato}|${caminhoTermo}`
    if (!contrato.termos.some((t) => t.chave === chaveTermo)) {
      const classe = pastaTermo ? classificarTermo(pastaTermo) : classificarTermo('')
      contrato.termos.push({ chave: chaveTermo, pasta: caminhoTermo, ...classe, termoPdf: null, propostaPdf: null, outros: [], arquivos: [] })
    }
    arquivosPorTermo.set(chaveTermo, [...(arquivosPorTermo.get(chaveTermo) ?? []), caminho])
  }

  for (const contrato of contratos.values()) {
    const presenca = presencaPorContrato.get(contrato.chave)
    contrato.finalizado = !!presenca?.emFinalizados && !presenca.emAtivos
    contrato.tambemEmFinalizados = !!presenca?.emFinalizados && !!presenca.emAtivos
    for (const termo of contrato.termos) {
      const arquivos = arquivosPorTermo.get(termo.chave) ?? []
      const nome = (c: string) => c.split('/').pop()!
      // Rascunho (WORK/) nunca é o termo nem a proposta da linha — mas entra nos arquivos do termo.
      const candidatos = arquivos.filter((a) => !a.split('/').some((s) => normalizarChave(s) === 'WORK'))
      termo.termoPdf = escolherTermo(candidatos.filter((a) => papelDoArquivo(nome(a)) === 'termo'))
      termo.propostaPdf = escolherTermo(candidatos.filter((a) => papelDoArquivo(nome(a)) === 'proposta'))
      termo.outros = arquivos.filter((a) => a !== termo.termoPdf && a !== termo.propostaPdf)
      termo.arquivos = arquivos
      // Pasta de contrato sem subpasta e sem PDF de termo: pode ser só proposta — continua CONTRATO.
    }
    contrato.termos.sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || a.pasta.localeCompare(b.pasta))
  }

  return [...contratos.values()].sort((a, b) => a.chave.localeCompare(b.chave))
}
