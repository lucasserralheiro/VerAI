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
    const motivoDaSituacao = naoVale(linha.situacao)
    if (linha.tipo === 'RESCISAO' || linha.tipo === 'PROSPECCAO') {
      fora.set(p, linha.tipo === 'RESCISAO' ? 'rescisão' : 'prospecção')
    } else if (linha.tipo === 'CONTRATO') {
      continue
    } else if (motivoDaSituacao) {
      fora.set(p, motivoDaSituacao)
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
      texto:
        'Este contrato não tem proposta (PC) nem renovação com proposta (PA) no cadastro — escolha uma das propostas do cliente ou envie do computador.',
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
    return {
      codigo: 'fora-da-vigencia',
      texto: `${nomeMaiusculo} é anterior ao início do contrato (${texto(contrato.inicio)}). Confira.`,
    }
  }
  return null
}
