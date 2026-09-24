import type { Prisma, PrismaClient, TipoHistoricoContrato } from '@prisma/client'
import type { ClientePorSigla } from '@/lib/arquivos/sharepoint/regras'
import { COLUNAS_ANEXO, dadosDaColuna } from '@/lib/relatorios-clientes/anexos-historico'
import { chaveNumerica, vincularItensOrfaos } from '@/lib/relatorios-clientes/vincular-itens'
import { chaveDoNome, type ContratoPasta, type TermoPasta } from './estrutura'
import { agruparTermos, resolverLinhas, type LinhaConhecida } from './identidade'
import { somarMeses, type CamposTermo } from './texto'

// Aplica a árvore lida do SharePoint no fluxo de cliente: Contrato → linhas do histórico (contrato
// inicial, aditivos, prorrogações, rescisão), com PC/PA e TC/TA POR REFERÊNCIA ao repositório do
// cliente. Specs: 2026-09-24-sincronizacao-sharepoint-contratos-design.md §8 e
// 2026-09-23-sharepoint-lugar-certo-design.md §3.2–3.4. Chamado pela sincronização
// (src/lib/arquivos/sharepoint/sincronizar.ts), só para os contratos que mudaram.
//
// Regras que não se negociam:
//   - NÃO sobrescreve campo preenchido (digitado ou do legado) — só os marcadores que a própria
//     importação grava ("TA XX", "Em elaboração") contam como vazios;
//   - linha certa pela identidade estável (identidade.ts) — mover/renomear pasta nunca duplica;
//   - coluna PC/PA–TC/TA preenchida pelo SharePoint acompanha o SharePoint; anexada à mão, nunca.

export interface TermoLido extends TermoPasta {
  campos: CamposTermo | null
  /** SHA-256 dos arquivos da pasta (os que foram lidos com sucesso). */
  hashes: string[]
}

export interface ContratoLido extends Omit<ContratoPasta, 'termos'> {
  termos: TermoLido[]
}

export interface OpcoesImportacao {
  aplicar: boolean
  contratos: ContratoLido[]
  clientes: ClientePorSigla
  /** Caminho de cada arquivo presente → `ArquivoCliente` (depois da etapa de arquivos). */
  arquivoIdPorCaminho: Map<string, string>
}

export interface ResultadoImportacao {
  contratosCriados: number
  contratosCompletados: number
  linhasCriadas: number
  linhasCompletadas: number
  anexosLigados: number
  avisos: string[]
  /** Onde cada arquivo caiu — a sincronização grava em `ArquivoSharepoint.contratoId/historicoId`. */
  contratoPorCaminho: Map<string, string>
  linhaPorCaminho: Map<string, string>
}

type Db = PrismaClient

const SELECAO_LINHA = {
  id: true,
  tipo: true,
  numero: true,
  data: true,
  valor: true,
  objeto: true,
  proposta: true,
  situacao: true,
  dataInicio: true,
  dataVencimento: true,
  chaveSharepoint: true,
  propostaArquivoId: true,
  propostaDoSharepoint: true,
  termoArquivoId: true,
  termoDoSharepoint: true,
  propostaArquivo: { select: { sha256: true } },
  termoArquivo: { select: { sha256: true } },
  arquivosSharepoint: { select: { caminho: true, sha256: true } },
} satisfies Prisma.HistoricoContratoSelect

type LinhaAtual = Prisma.HistoricoContratoGetPayload<{ select: typeof SELECAO_LINHA }>

const EM_ELABORACAO = 'Em elaboração'

function nomeSemExtensao(caminho: string | null): string | null {
  if (!caminho) return null
  return caminho.split('/').pop()!.replace(/\.[^.]+$/, '')
}

function umDiaDepois(d: Date): Date {
  return new Date(d.getTime() + 24 * 60 * 60 * 1000)
}

/** Valor que a própria importação grava enquanto o termo não está pronto — conta como vazio. */
function ehMarcador(campo: string, valor: unknown): boolean {
  if (campo === 'numero') return typeof valor === 'string' && /\bXX\b/i.test(valor)
  if (campo === 'situacao') return valor === EM_ELABORACAO
  return false
}

function mesmoValor(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  return a !== null && a !== undefined && String(a) === String(b)
}

/** Só os campos vazios (ou com marcador) recebem o valor novo, e só valor novo não-nulo. */
function soOsVazios<T extends Record<string, unknown>>(atual: Record<string, unknown>, novo: T): Partial<T> {
  const saida: Partial<T> = {}
  for (const [campo, valor] of Object.entries(novo)) {
    if (valor === null || valor === undefined) continue
    const antes = atual[campo]
    const vazio = antes === null || antes === undefined || antes === '' || ehMarcador(campo, antes)
    if (vazio && !mesmoValor(antes, valor)) (saida as Record<string, unknown>)[campo] = valor
  }
  return saida
}

/** Tipo final da linha: aditivo "sem rótulo" cujo texto prorroga a vigência vira prorrogação. */
function tipoDaLinha(termo: TermoLido): TipoHistoricoContrato {
  if (termo.tipo === 'ADITIVO' && !/\bTAP\b/i.test(termo.numero ?? '') && termo.campos?.prorrogaVigencia && (termo.campos.meses || termo.campos.fim)) {
    return 'PRORROGACAO'
  }
  return termo.tipo
}

function linhaConhecida(l: LinhaAtual): LinhaConhecida {
  return {
    id: l.id,
    tipo: l.tipo,
    numero: l.numero,
    caminhos: l.arquivosSharepoint.map((a) => a.caminho),
    // `chaveSharepoint` = `<sigla ou pasta>|<nº ano>|<pasta do termo>` (a pasta não tem "|": o Windows não deixa).
    pastaAntiga: l.chaveSharepoint ? l.chaveSharepoint.split('|').slice(2).join('|') || null : null,
    hashes: [...l.arquivosSharepoint.map((a) => a.sha256), l.propostaArquivo?.sha256, l.termoArquivo?.sha256].filter((h): h is string => !!h),
  }
}

export async function importarContratos(prisma: Db, opcoes: OpcoesImportacao): Promise<ResultadoImportacao> {
  const r: ResultadoImportacao = {
    contratosCriados: 0,
    contratosCompletados: 0,
    linhasCriadas: 0,
    linhasCompletadas: 0,
    anexosLigados: 0,
    avisos: [],
    contratoPorCaminho: new Map(),
    linhaPorCaminho: new Map(),
  }
  for (const contrato of opcoes.contratos) {
    const cliente = opcoes.clientes.get(contrato.chave.split('|')[0])
    if (!cliente) continue
    try {
      await importarContrato(prisma, contrato, cliente.id, opcoes, r)
    } catch (erro) {
      r.avisos.push(`${contrato.chave}: ${erro instanceof Error ? erro.message : String(erro)}`)
    }
  }
  return r
}

async function importarContrato(prisma: Db, contrato: ContratoLido, clienteId: string, ctx: OpcoesImportacao, r: ResultadoImportacao) {
  const inicial = contrato.termos.find((t) => t.tipo === 'CONTRATO' && t.campos && !t.campos.semTexto) ?? contrato.termos.find((t) => t.tipo === 'CONTRATO')
  const k = inicial?.campos ?? null
  const qualquer = (campo: 'seiCliente' | 'seiProdam') => k?.[campo] ?? contrato.termos.find((t) => t.campos?.[campo])?.campos?.[campo] ?? null

  const inicioContrato = k?.inicio ?? (k?.inicioNaAssinatura ? k.assinaturaEm : null)
  const mesesContrato = k?.meses ?? inicial?.meses ?? null
  const fimContrato = k?.fim ?? (inicioContrato && mesesContrato ? somarMeses(inicioContrato, mesesContrato) : null)
  const rescindido = contrato.termos.some((t) => t.tipo === 'RESCISAO' && t.aviso !== 'nao-efetivado')

  const dadosContrato = {
    numeroTermo: contrato.numeroTermo,
    descricao: contrato.descricao,
    seiCliente: qualquer('seiCliente'),
    seiProdam: qualquer('seiProdam'),
    dataInicio: inicioContrato,
    dataVencimento: fimContrato,
    situacao: contrato.finalizado ? 'Finalizado' : rescindido ? 'Rescindido' : null,
  }

  // Contrato: pela identidade (sigla|nº ano); na primeira vez, pelo número e ano do legado — só se único.
  // Número e ano pela MESMA leitura das pastas (`chaveDoNome`): "TC 105/2025/SMS-1/CONTRATOS" é 105/2025
  // (o "1" da sigla não entra — `chaveNumerica` juntava todos os números e criava contrato duplicado).
  let existente = await prisma.contrato.findUnique({ where: { chaveSharepoint: contrato.chave } })
  if (!existente) {
    const [numero, ano] = contrato.chave.split('|')[1].split(' ')
    if (numero !== 'sn') {
      const candidatos = (await prisma.contrato.findMany({ where: { clienteId, chaveSharepoint: null } })).filter((c) => {
        const chave = chaveDoNome(c.numeroTermo ?? '')
        return chave !== null ? chave.numero === numero && chave.ano === ano : chaveNumerica(c.numeroTermo) === `${numero} ${ano}`
      })
      if (candidatos.length === 1) existente = candidatos[0]
      else if (candidatos.length > 1) r.avisos.push(`${contrato.chave}: ${candidatos.length} contratos com o mesmo número no cliente — criado à parte, revise`)
    }
  }

  if (contrato.tambemEmFinalizados) {
    r.avisos.push(`${contrato.chave}: tem pasta ativa e também aparece em "Contratos Finalizados" — tratado como ativo; arrume a pasta no SharePoint`)
  }

  let contratoId: string
  if (existente) {
    if (contrato.finalizado && existente.situacao && !/finaliz|encerr|rescind/i.test(existente.situacao)) {
      r.avisos.push(`${contrato.chave}: está em "Contratos Finalizados" no SharePoint, mas a situação no VerAI é "${existente.situacao}" — mantida`)
    }
    const completar: Record<string, unknown> = soOsVazios(existente, dadosContrato)
    // "Finalizado" é o que a própria importação grava pela pasta: com pasta ativa, deixa de valer — mas só
    // em contrato que nasceu da importação (o do legado GRC-1 pode ter sido encerrado de verdade).
    if (!contrato.finalizado && existente.situacao === 'Finalizado') {
      if (existente.legacyId === null) {
        completar.situacao = null
        r.avisos.push(`${contrato.chave}: estava "Finalizado", mas tem pasta ativa no SharePoint — situação limpa (volta a contar como ativo)`)
      } else {
        r.avisos.push(`${contrato.chave}: tem pasta ativa no SharePoint, mas a situação no VerAI (legado) é "Finalizado" — mantida, revise`)
      }
    }
    if (Object.keys(completar).length > 0 || !existente.chaveSharepoint) {
      r.contratosCompletados++
      if (ctx.aplicar) await prisma.contrato.update({ where: { id: existente.id }, data: { ...completar, chaveSharepoint: contrato.chave } })
    }
    contratoId = existente.id
  } else {
    r.contratosCriados++
    contratoId = ctx.aplicar
      ? (await prisma.contrato.create({ data: { clienteId, ...dadosContrato, chaveSharepoint: contrato.chave }, select: { id: true } })).id
      : `simulado:${contrato.chave}`
  }

  const linhas: LinhaAtual[] = existente ? await prisma.historicoContrato.findMany({ where: { contratoId }, select: SELECAO_LINHA }) : []
  const { grupos, avisos } = agruparTermos(
    contrato.termos.map((t) => ({ pasta: t.pasta, tipo: t.tipo, numero: t.numero, arquivos: t.arquivos, hashes: t.hashes }))
  )
  r.avisos.push(...avisos.map((a) => `${contrato.chave}: ${a}`))
  const alvos = resolverLinhas(grupos, linhas.map(linhaConhecida))

  let vencimentoAnterior: Date | null = fimContrato

  for (const [i, grupo] of grupos.entries()) {
    const termos = grupo.pastas.map((p) => contrato.termos.find((t) => t.pasta === p.pasta)!)
    const termo = termos.find((t) => t.termoPdf) ?? termos[0]
    const c = termo.campos
    const tipo = tipoDaLinha(termo)
    const naoValeu = termo.aviso === 'nao-efetivado'
    const assinatura = naoValeu ? null : (c?.assinaturaEm ?? null)
    const meses = c?.meses ?? termo.meses

    let inicio: Date | null = null
    let fim: Date | null = null
    if (tipo === 'CONTRATO') {
      inicio = inicioContrato
      fim = fimContrato
    } else if (tipo === 'PRORROGACAO') {
      inicio = c?.inicio ?? (vencimentoAnterior ? umDiaDepois(vencimentoAnterior) : null)
      fim = c?.fim ?? (inicio && meses ? somarMeses(inicio, meses) : null)
    } else if (tipo === 'ADITIVO') {
      fim = c?.fim ?? null
    }

    const dados = {
      tipo,
      numero: tipo === 'CONTRATO' ? contrato.numeroTermo : termo.numero,
      data: assinatura,
      valor: tipo === 'RESCISAO' ? null : (c?.valor ?? null),
      objeto: tipo === 'CONTRATO' ? (c?.objeto ?? contrato.descricao) : termo.rotulo || null,
      proposta: nomeSemExtensao(termo.propostaPdf),
      situacao: naoValeu ? 'Cancelado (não efetivado)' : termo.aviso === 'sem-numero' && !assinatura ? EM_ELABORACAO : null,
      dataInicio: inicio,
      dataVencimento: fim,
    }

    const linha = alvos[i] ? linhas.find((l) => l.id === alvos[i]) : undefined
    let linhaId: string
    if (linha) {
      const completar: Record<string, unknown> = soOsVazios(linha, { ...dados, tipo: undefined })
      // "Em elaboração" era marcador: o termo ficou pronto (tem número e/ou assinatura) → sai.
      if (linha.situacao === EM_ELABORACAO && dados.situacao === null) completar.situacao = null
      if (Object.keys(completar).length > 0 || !linha.chaveSharepoint) {
        r.linhasCompletadas++
        if (ctx.aplicar) {
          await prisma.historicoContrato.update({ where: { id: linha.id }, data: { ...completar, chaveSharepoint: linha.chaveSharepoint ?? termo.chave } })
        }
      }
      linhaId = linha.id
    } else {
      r.linhasCriadas++
      linhaId = ctx.aplicar
        ? (
            await prisma.historicoContrato.create({
              data: { contratoId, ...dados, observacao: `Importado do SharePoint: ${termo.pasta}`, chaveSharepoint: termo.chave },
              select: { id: true },
            })
          ).id
        : `simulado:${termo.chave}`
    }

    // Colunas PC/PA e TC/TA: referência ao arquivo do repositório (spec lugar-certo §3.4).
    for (const coluna of ['proposta', 'termo'] as const) {
      const caminho = coluna === 'termo' ? termo.termoPdf : termo.propostaPdf
      if (!caminho) continue
      const arquivoId = ctx.arquivoIdPorCaminho.get(caminho)
      if (!arquivoId) continue // falhou na etapa de arquivos — tenta de novo na próxima execução
      const col = COLUNAS_ANEXO[coluna]
      const atual = linha ? linha[col.arquivoId] : null
      const doSharepoint = linha ? linha[col.doSharepoint] : false
      if (atual === arquivoId) continue
      if (atual && !doSharepoint) {
        r.avisos.push(`${caminho}: a linha já tem ${col.rotulo} anexado à mão — mantido (o do SharePoint está na aba Documentos)`)
        continue
      }
      r.anexosLigados++
      if (ctx.aplicar) await prisma.historicoContrato.update({ where: { id: linhaId }, data: dadosDaColuna(coluna, arquivoId, true) })
    }

    for (const t of termos) {
      for (const caminho of t.arquivos) {
        r.linhaPorCaminho.set(caminho, linhaId)
        r.contratoPorCaminho.set(caminho, contratoId)
      }
    }

    if (fim && (tipo === 'CONTRATO' || assinatura) && (!vencimentoAnterior || fim > vencimentoAnterior)) vencimentoAnterior = fim
    if (termo.campos?.semTexto && termo.termoPdf) r.avisos.push(`${termo.termoPdf}: PDF escaneado (sem texto) — datas e valor ficam pra preencher na tela`)
  }

  if (ctx.aplicar && !existente) await vincularItensOrfaos(prisma, { contratoId })
}
