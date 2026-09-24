import type { Prisma, PrismaClient, TipoHistoricoContrato } from '@prisma/client'
import { buildHistoricoContratoPdfPath, putUpload } from '@/lib/storage'
import { normalizarChave, resolverCliente, type ClientePorSigla, type MapaPastas } from '@/lib/arquivos/sharepoint/regras'
import { chaveExata, chaveNumerica, vincularItensOrfaos } from '@/lib/relatorios-clientes/vincular-itens'
import { TAMANHO_MAXIMO_PDF_BYTES } from '@/lib/relatorios-clientes/pdfs-existentes'
import type { ContratoPasta, TermoPasta } from './estrutura'
import { somarMeses, type CamposTermo } from './texto'

// Aplica a árvore lida do SharePoint no fluxo de cliente: Cliente → Contrato → linhas do histórico
// (contrato inicial, aditivos, prorrogações, rescisão) com os PDFs de termo e de proposta anexados.
// Spec docs/superpowers/specs/2026-09-24-sincronizacao-sharepoint-contratos-design.md §8.
//
// Regras que não se negociam (mesmas do importador do GRC-1 — CLAUDE.md, "Consistência"):
//   - NÃO sobrescreve: campo já preenchido (digitado na tela ou vindo do legado) fica como está;
//     a importação só preenche o que está vazio. PDF já anexado na linha não é trocado.
//   - Casamento com o que já existe é por identidade (`chaveSharepoint`) e, na primeira vez, pelo
//     número tolerante (`chaveNumerica`/`chaveExata`) — e só quando o casamento é ÚNICO.
//   - Cliente novo só pela sigla da pasta (ou do mapa); nunca por nome.

export interface TermoLido extends TermoPasta {
  campos: CamposTermo | null
}

export interface ContratoLido extends Omit<ContratoPasta, 'termos'> {
  termos: TermoLido[]
}

export interface OpcoesImportacao {
  aplicar: boolean
  contratos: ContratoLido[]
  mapa: MapaPastas
  /** Sigla → nome oficial, pra criar cliente novo e corrigir cliente cujo nome é só a sigla. */
  nomes: Record<string, string>
  lerArquivo: (caminho: string) => Promise<Buffer>
  gravarBlob?: (caminho: string, conteudo: Buffer, contentType: string) => Promise<string>
}

export interface ResultadoImportacao {
  clientesCriados: string[]
  clientesRenomeados: string[]
  contratosCriados: number
  contratosCompletados: number
  linhasCriadas: number
  linhasCompletadas: number
  pdfsAnexados: number
  pastasIgnoradas: string[]
  semNomeOficial: string[]
  avisos: string[]
}

type Db = PrismaClient

function nomeSemExtensao(caminho: string | null): string | null {
  if (!caminho) return null
  return caminho.split('/').pop()!.replace(/\.[^.]+$/, '')
}

function umDiaDepois(d: Date): Date {
  return new Date(d.getTime() + 24 * 60 * 60 * 1000)
}

/** Só os campos vazios do registro recebem o valor novo (e só valor novo não-nulo). */
function soOsVazios<T extends Record<string, unknown>>(atual: Record<string, unknown>, novo: T): Partial<T> {
  const saida: Partial<T> = {}
  for (const [campo, valor] of Object.entries(novo)) {
    if (valor === null || valor === undefined) continue
    const antes = atual[campo]
    if (antes === null || antes === undefined || antes === '') (saida as Record<string, unknown>)[campo] = valor
  }
  return saida
}

/** Número de termo aditivo pra comparar: "TA 01" e "TA 001" → "ta 1"; "TAP 003-2023" → "tap 3 2023". */
function chaveTermo(numero: string | null): string | null {
  return chaveExata(numero)
}

/** Tipo final da linha: aditivo "sem rótulo" cujo texto prorroga a vigência vira prorrogação. */
function tipoDaLinha(termo: TermoLido): TipoHistoricoContrato {
  if (termo.tipo === 'ADITIVO' && !/\bTAP\b/i.test(termo.numero ?? '') && termo.campos?.prorrogaVigencia && (termo.campos.meses || termo.campos.fim)) {
    return 'PRORROGACAO'
  }
  return termo.tipo
}

export async function importarContratos(prisma: Db, opcoes: OpcoesImportacao): Promise<ResultadoImportacao> {
  const { aplicar, contratos, mapa, nomes, lerArquivo } = opcoes
  const gravarBlob = opcoes.gravarBlob ?? putUpload
  const r: ResultadoImportacao = {
    clientesCriados: [],
    clientesRenomeados: [],
    contratosCriados: 0,
    contratosCompletados: 0,
    linhasCriadas: 0,
    linhasCompletadas: 0,
    pdfsAnexados: 0,
    pastasIgnoradas: [],
    semNomeOficial: [],
    avisos: [],
  }

  // 1) Clientes: um por pasta (ou pelo mapa). Cria o que falta; corrige nome que é só a sigla.
  const existentes = await prisma.cliente.findMany({ where: { siglaLegado: { not: null } }, select: { id: true, nome: true, siglaLegado: true } })
  const clientes: ClientePorSigla = new Map(existentes.map((c) => [normalizarChave(c.siglaLegado!), { id: c.id, nome: c.nome }]))
  const nomesPorSigla = new Map(Object.entries(nomes).map(([s, n]) => [normalizarChave(s), n]))
  const idPorPasta = new Map<string, string>()

  for (const pasta of [...new Set(contratos.map((c) => c.pastaCliente))].sort()) {
    let resolvido = resolverCliente(pasta, clientes, mapa)
    if (resolvido.tipo === 'ignorar') {
      r.pastasIgnoradas.push(pasta)
      continue
    }
    if (resolvido.tipo === 'sem-cliente') {
      const doMapa = Object.entries(mapa).find(([k]) => normalizarChave(k) === normalizarChave(pasta))?.[1]
      const sigla = normalizarChave(doMapa ?? pasta)
      const nome = nomesPorSigla.get(sigla)
      if (!nome) r.semNomeOficial.push(sigla)
      r.clientesCriados.push(`${sigla} — ${nome ?? sigla}`)
      const id = aplicar
        ? (await prisma.cliente.create({ data: { nome: nome ?? sigla, siglaLegado: sigla }, select: { id: true } })).id
        : `simulado:${sigla}`
      clientes.set(sigla, { id, nome: nome ?? sigla })
      resolvido = { tipo: 'cliente', clienteId: id, nome: nome ?? sigla }
    }
    idPorPasta.set(pasta, resolvido.clienteId)
  }
  for (const c of existentes) {
    const sigla = normalizarChave(c.siglaLegado!)
    const oficial = nomesPorSigla.get(sigla)
    if (oficial && normalizarChave(c.nome) === sigla) {
      r.clientesRenomeados.push(`${c.nome} → ${oficial}`)
      if (aplicar) await prisma.cliente.update({ where: { id: c.id }, data: { nome: oficial } })
    }
  }

  // 2) Contratos e histórico.
  for (const contrato of contratos) {
    const clienteId = idPorPasta.get(contrato.pastaCliente)
    if (!clienteId) continue
    try {
      await importarContrato(prisma, contrato, clienteId, { aplicar, lerArquivo, gravarBlob }, r)
    } catch (erro) {
      r.avisos.push(`${contrato.chave}: ${erro instanceof Error ? erro.message : String(erro)}`)
    }
  }
  return r
}

async function importarContrato(
  prisma: Db,
  contrato: ContratoLido,
  clienteId: string,
  ctx: { aplicar: boolean; lerArquivo: (c: string) => Promise<Buffer>; gravarBlob: (c: string, b: Buffer, t: string) => Promise<string> },
  r: ResultadoImportacao
) {
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

  // Contrato existente: pela identidade da importação; senão pelo número tolerante, se for único.
  let existente = await prisma.contrato.findUnique({ where: { chaveSharepoint: contrato.chave } })
  if (!existente) {
    const [numero, ano] = contrato.chave.split('|')[1].split(' ')
    const alvo = numero === 'sn' ? null : `${numero} ${ano}`
    if (alvo) {
      const candidatos = (await prisma.contrato.findMany({ where: { clienteId, chaveSharepoint: null } })).filter(
        (c) => chaveNumerica(c.numeroTermo) === alvo
      )
      if (candidatos.length === 1) existente = candidatos[0]
      else if (candidatos.length > 1) r.avisos.push(`${contrato.chave}: ${candidatos.length} contratos com o mesmo número no cliente — criado à parte, revise`)
    }
  }

  let contratoId: string
  if (existente) {
    const completar = soOsVazios(existente, dadosContrato)
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

  const linhas = ctx.aplicar || existente ? await prisma.historicoContrato.findMany({ where: { contratoId } }) : []
  let vencimentoAnterior: Date | null = fimContrato

  for (const termo of contrato.termos) {
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
      situacao: naoValeu ? 'Cancelado (não efetivado)' : termo.aviso === 'sem-numero' && !assinatura ? 'Em elaboração' : null,
      dataInicio: inicio,
      dataVencimento: fim,
    }

    // Linha existente: identidade; senão, a mesma linha vinda do legado (única).
    let linha = linhas.find((l) => l.chaveSharepoint === termo.chave)
    if (!linha) {
      const livres = linhas.filter((l) => !l.chaveSharepoint)
      const iguais =
        tipo === 'CONTRATO'
          ? livres.filter((l) => l.tipo === 'CONTRATO')
          : termo.numero
            ? livres.filter((l) => l.tipo !== 'CONTRATO' && chaveTermo(l.numero) === chaveTermo(termo.numero))
            : []
      if (iguais.length === 1) linha = iguais[0]
    }

    let linhaId: string
    if (linha) {
      const completar = soOsVazios(linha, { ...dados, tipo: undefined })
      if (Object.keys(completar).length > 0 || !linha.chaveSharepoint) {
        r.linhasCompletadas++
        if (ctx.aplicar) await prisma.historicoContrato.update({ where: { id: linha.id }, data: { ...completar, chaveSharepoint: termo.chave } })
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

    // PDFs: só em coluna vazia; cópia própria no caminho da linha (mesmo padrão da tela).
    for (const [coluna, caminho] of [
      ['termo', termo.termoPdf],
      ['proposta', termo.propostaPdf],
    ] as const) {
      if (!caminho) continue
      const jaTem = coluna === 'termo' ? linha?.termoPdfUrl : linha?.propostaPdfUrl
      if (jaTem) continue
      r.pdfsAnexados++
      if (!ctx.aplicar) continue
      const conteudo = await ctx.lerArquivo(caminho)
      if (conteudo.length > TAMANHO_MAXIMO_PDF_BYTES) {
        r.pdfsAnexados--
        r.avisos.push(`${caminho}: PDF acima do limite da linha do histórico — fica só no repositório de documentos`)
        continue
      }
      const url = await ctx.gravarBlob(buildHistoricoContratoPdfPath(linhaId, coluna), conteudo, 'application/pdf')
      const nome = caminho.split('/').pop()!
      const data: Prisma.HistoricoContratoUpdateInput =
        coluna === 'termo' ? { termoPdfUrl: url, termoPdfNome: nome } : { propostaPdfUrl: url, propostaPdfNome: nome }
      await prisma.historicoContrato.update({ where: { id: linhaId }, data })
    }

    if (fim && (tipo === 'CONTRATO' || assinatura) && (!vencimentoAnterior || fim > vencimentoAnterior)) vencimentoAnterior = fim
    if (termo.campos?.semTexto && termo.termoPdf) r.avisos.push(`${termo.termoPdf}: PDF escaneado (sem texto) — datas e valor ficam pra preencher na tela`)
  }

  if (ctx.aplicar && !existente) await vincularItensOrfaos(prisma, { contratoId })
}
