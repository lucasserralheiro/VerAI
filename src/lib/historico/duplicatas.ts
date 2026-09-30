import type { Prisma, PrismaClient } from '@prisma/client'
import { dataBr, valorBr } from '@/lib/controles-contratos/leitura'
import { chaveNumerica } from '@/lib/relatorios-clientes/vincular-itens'
import { numeroDoValor } from '@/lib/valores-contratos/categoria'
import { migracaoAplicada } from '@/lib/migracao-aplicada'
import { termoDoTexto } from '@/lib/valores-contratos/aplicar'
import { MIGRACAO_DOS_VALORES } from '@/lib/valores-contratos/etapa'

// Linhas duplicadas do histórico — o mesmo termo do legado ("TA 001/2025") e da pasta do SharePoint ("TA 01")
// (spec docs/superpowers/specs/2026-09-30-juntar-linhas-duplicadas-design.md). Só junta com prova: mesma
// identidade, nada se contradiz e ao menos um campo (ou o PDF do termo) confirma. Fica a linha do SharePoint.

export interface LinhaHistorico {
  id: string
  contratoId: string
  tipo: string
  numero: string | null
  data: Date | null
  dataInicio: Date | null
  dataVencimento: Date | null
  valor: string | null
  situacao: string | null
  objeto: string | null
  proposta: string | null
  observacao: string | null
  legacyId: number | null
  propostaArquivoId: string | null
  termoArquivoId: string | null
  /** Nasceu ou é mantida pela sincronização do SharePoint (chave da pasta ou arquivo ligado). */
  doSharepoint: boolean
}

/** O que o PDF do termo (ficha verificada) diz. */
export interface FichaResumo {
  fim: Date | null
  valor: string | null
}

export interface ParDuplicado {
  fica: LinhaHistorico
  sai: LinhaHistorico
  provas: string[]
}

const TIPOS = new Set(['CONTRATO', 'ADITIVO', 'PRORROGACAO'])
const EM_ELABORACAO = 'Em elaboração'
const dia = (d: Date) => d.toISOString().slice(0, 10)
const centavos = (v: string) => Math.round(Number(v) * 100)

const CAMPOS: { nome: string; valor: (l: LinhaHistorico) => string | null }[] = [
  { nome: 'tipo', valor: (l) => l.tipo },
  { nome: 'data de assinatura', valor: (l) => (l.data ? dia(l.data) : null) },
  { nome: 'início', valor: (l) => (l.dataInicio ? dia(l.dataInicio) : null) },
  { nome: 'vencimento', valor: (l) => (l.dataVencimento ? dia(l.dataVencimento) : null) },
  { nome: 'valor', valor: (l) => (l.valor !== null ? String(centavos(l.valor)) : null) },
]

/** Resumo da ficha do termo (`FichaDocumento.campos`) no formato da regra. */
export function resumoDaFicha(campos: unknown): FichaResumo {
  const c = (campos ?? {}) as Record<string, { valor?: string } | undefined>
  const numero = c.valorTotal?.valor ? numeroDoValor(c.valorTotal.valor) : null
  return { fim: c.vigenciaFim?.valor ? dataBr(c.vigenciaFim.valor) : null, valor: numero ? valorBr(numero) : null }
}

/**
 * `planilha`: período da linha da planilha de contratos por `contratoId|identidade` (única no contrato) — prova
 * quando início E fim batem com os da linha do legado.
 */
export function acharDuplicatas(
  linhas: LinhaHistorico[],
  fichas: Map<string, FichaResumo>,
  planilha: Map<string, { inicio: Date | null; fim: Date | null }> = new Map()
): { pares: ParDuplicado[]; avisos: { contratoId: string; linha: string; aviso: string }[] } {
  const pares: ParDuplicado[] = []
  const avisos: { contratoId: string; linha: string; aviso: string }[] = []
  const grupos = new Map<string, LinhaHistorico[]>()
  for (const l of linhas) {
    if (!TIPOS.has(l.tipo)) continue
    const termo = termoDoTexto(l.numero, l.tipo === 'CONTRATO')
    if (!termo) continue
    const chave = `${l.contratoId}|${termo}`
    grupos.set(chave, [...(grupos.get(chave) ?? []), l])
  }
  for (const [chave, grupo] of grupos) {
    if (grupo.length !== 2) continue
    const fica = grupo.find((l) => l.doSharepoint)
    const sai = grupo.find((l) => !l.doSharepoint)
    if (!fica || !sai) continue
    const rotulo = `${sai.numero ?? sai.tipo} × ${fica.numero ?? fica.tipo}`
    const contradicoes = CAMPOS.filter((c) => c.valor(fica) !== null && c.valor(sai) !== null && c.valor(fica) !== c.valor(sai)).map((c) => c.nome)
    if (contradicoes.length > 0) {
      avisos.push({ contratoId: fica.contratoId, linha: rotulo, aviso: `possível duplicata não juntada: ${contradicoes.join(', ')} diferente(s)` })
      continue
    }
    const provas = CAMPOS.filter((c) => c.nome !== 'tipo' && c.valor(fica) !== null && c.valor(fica) === c.valor(sai)).map((c) => c.nome)
    const ficha = fichas.get(fica.id)
    if (ficha?.fim && sai.dataVencimento && dia(ficha.fim) === dia(sai.dataVencimento)) provas.push('fim no PDF do termo')
    if (ficha?.valor && sai.valor && centavos(ficha.valor) === centavos(sai.valor)) provas.push('valor no PDF do termo')
    const p = planilha.get(chave)
    if (p?.inicio && p.fim && sai.dataInicio && sai.dataVencimento && dia(p.inicio) === dia(sai.dataInicio) && dia(p.fim) === dia(sai.dataVencimento)) {
      provas.push('período na planilha de contratos')
    }
    if (provas.length === 0) {
      avisos.push({ contratoId: fica.contratoId, linha: rotulo, aviso: 'possível duplicata não juntada: nenhum campo nem o PDF do termo confirma que é o mesmo termo' })
      continue
    }
    pares.push({ fica, sai, provas })
  }
  return { pares, avisos }
}

/** Dados que a linha que fica recebe da que sai — só campo vazio. */
export function dadosDaJuncao(fica: LinhaHistorico, sai: LinhaHistorico): { dados: Prisma.HistoricoContratoUncheckedUpdateInput; campos: string[] } {
  const dados: Prisma.HistoricoContratoUncheckedUpdateInput = {}
  const campos: string[] = []
  const vazio = (v: unknown) => v === null || v === ''
  const levar = <K extends keyof LinhaHistorico & keyof Prisma.HistoricoContratoUncheckedUpdateInput>(k: K) => {
    if (vazio(fica[k]) && !vazio(sai[k])) {
      ;(dados as Record<string, unknown>)[k] = sai[k]
      campos.push(k)
    }
  }
  for (const k of ['valor', 'data', 'dataInicio', 'dataVencimento', 'objeto', 'proposta', 'legacyId'] as const) levar(k)
  if ((vazio(fica.situacao) || fica.situacao === EM_ELABORACAO) && !vazio(sai.situacao)) {
    dados.situacao = sai.situacao
    campos.push('situacao')
  }
  // PDF anexado à mão na linha que sai: continua anexado à mão (nunca trocado pela sincronização).
  if (!fica.propostaArquivoId && sai.propostaArquivoId) {
    Object.assign(dados, { propostaArquivoId: sai.propostaArquivoId, propostaDoSharepoint: false })
    campos.push('proposta (PDF)')
  }
  if (!fica.termoArquivoId && sai.termoArquivoId) {
    Object.assign(dados, { termoArquivoId: sai.termoArquivoId, termoDoSharepoint: false })
    campos.push('termo (PDF)')
  }
  const notas = [fica.observacao, sai.observacao && sai.observacao !== fica.observacao ? sai.observacao : null]
  if (sai.numero && sai.numero !== fica.numero) notas.push(`também registrado como ${sai.numero}`)
  const observacao = notas.filter(Boolean).join(' · ') || null
  if (observacao !== fica.observacao) dados.observacao = observacao
  return { dados, campos }
}

export interface ResumoJuncao {
  pares: { contrato: string; linhas: string; provas: string[]; campos: string[] }[]
  avisos: { contrato: string; linha: string; aviso: string }[]
}

/** Acha e (com `aplicar`) junta os pares. Uma transação por par; o que sai deixa de existir. */
export async function juntarDuplicatas(prisma: PrismaClient, opcoes: { aplicar: boolean }): Promise<ResumoJuncao> {
  const [brutas, fichas, contratos, linhasPlanilha] = await Promise.all([
    prisma.historicoContrato.findMany({
      select: {
        id: true, contratoId: true, tipo: true, numero: true, data: true, dataInicio: true, dataVencimento: true, valor: true,
        situacao: true, objeto: true, proposta: true, observacao: true, legacyId: true, chaveSharepoint: true,
        propostaArquivoId: true, termoArquivoId: true, _count: { select: { arquivosSharepoint: true } },
      },
    }),
    prisma.fichaDocumento.findMany({ where: { origem: 'HISTORICO_TERMO' }, select: { origemId: true, campos: true } }),
    prisma.contrato.findMany({ select: { id: true, numeroTermo: true, chaveSharepoint: true, cliente: { select: { siglaLegado: true, nome: true } } } }),
    prisma.linhaPlanilhaContratos.findMany({ select: { chave: true, termoTexto: true, termoNumero: true, inicio: true, fim: true } }),
  ])
  // Planilha por contrato + identidade do termo (a mesma regra do valor/vigência), só a identidade única.
  const contratoDaChave = new Map<string, string>()
  for (const c of contratos) {
    const sigla = c.cliente.siglaLegado?.toUpperCase()
    const chave = c.chaveSharepoint ?? (sigla && chaveNumerica(c.numeroTermo) ? `${sigla}|${chaveNumerica(c.numeroTermo)}` : null)
    if (chave) contratoDaChave.set(chave, c.id)
  }
  const planilha = new Map<string, { inicio: Date | null; fim: Date | null }>()
  const repetidas = new Set<string>()
  for (const p of linhasPlanilha) {
    const contratoId = p.chave ? contratoDaChave.get(p.chave) : undefined
    const termo = p.termoNumero === 0 ? 'TC0' : p.termoNumero === null ? null : termoDoTexto(p.termoTexto)
    if (!contratoId || !termo) continue
    const k = `${contratoId}|${termo}`
    if (planilha.has(k)) repetidas.add(k)
    planilha.set(k, { inicio: p.inicio, fim: p.fim })
  }
  for (const k of repetidas) planilha.delete(k)
  const linhas: LinhaHistorico[] = brutas.map(({ chaveSharepoint, _count, valor, ...l }) => ({
    ...l,
    valor: valor === null ? null : valor.toString(),
    doSharepoint: chaveSharepoint !== null || _count.arquivosSharepoint > 0,
  }))
  const nome = new Map(contratos.map((c) => [c.id, `${c.cliente.siglaLegado ?? c.cliente.nome} ${c.numeroTermo ?? '(sem número)'}`]))
  const { pares, avisos } = acharDuplicatas(linhas, new Map(fichas.map((f) => [f.origemId, resumoDaFicha(f.campos)])), planilha)
  const r: ResumoJuncao = { pares: [], avisos: avisos.map((a) => ({ contrato: nome.get(a.contratoId) ?? a.contratoId, linha: a.linha, aviso: a.aviso })) }

  for (const { fica, sai, provas } of pares) {
    const { dados, campos } = dadosDaJuncao(fica, sai)
    if (opcoes.aplicar) {
      const origensFica = new Set((await prisma.origemCampoHistorico.findMany({ where: { historicoId: fica.id }, select: { campo: true } })).map((o) => o.campo))
      // Origem acompanha o valor que foi levado; o resto da origem da linha que sai vai junto com ela.
      const levadas = [campos.includes('valor') && 'valor', campos.includes('dataVencimento') && 'vigencia', campos.includes('situacao') && 'assinatura'].filter(
        (c): c is string => !!c && !origensFica.has(c)
      )
      await prisma.$transaction(async (tx) => {
        if (sai.legacyId !== null && campos.includes('legacyId')) await tx.historicoContrato.update({ where: { id: sai.id }, data: { legacyId: null } })
        if (Object.keys(dados).length > 0) await tx.historicoContrato.update({ where: { id: fica.id }, data: dados })
        await tx.arquivoSharepoint.updateMany({ where: { historicoId: sai.id }, data: { historicoId: fica.id } })
        if (levadas.length > 0) await tx.origemCampoHistorico.updateMany({ where: { historicoId: sai.id, campo: { in: levadas } }, data: { historicoId: fica.id } })
        await tx.origemCampoHistorico.deleteMany({ where: { historicoId: sai.id } })
        await tx.historicoContrato.delete({ where: { id: sai.id } })
      })
    }
    r.pares.push({
      contrato: nome.get(fica.contratoId) ?? fica.contratoId,
      linhas: `${sai.numero ?? sai.tipo} → ${fica.numero ?? fica.tipo}`,
      provas,
      campos,
    })
  }
  return r
}

/** Etapa do agendador, antes da dos valores; mesma guarda (em produção só depois da migração). Nunca lança. */
export async function etapaDasDuplicatas(
  prisma: PrismaClient,
  opcoes: { aplicar: boolean },
  deps = { bancoPronto: () => migracaoAplicada(prisma, MIGRACAO_DOS_VALORES), juntar: juntarDuplicatas }
): Promise<string[]> {
  try {
    if (!(await deps.bancoPronto())) return [`linhas duplicadas do histórico: pulado — migração ${MIGRACAO_DOS_VALORES} não aplicada neste banco`]
    return linhasDaJuncao(await deps.juntar(prisma, opcoes), opcoes.aplicar)
  } catch (erro) {
    return [`linhas duplicadas do histórico: falhou — ${erro instanceof Error ? erro.message : String(erro)} (a próxima rodada tenta de novo)`]
  }
}

export function linhasDaJuncao(r: ResumoJuncao, aplicar: boolean, limite = 20): string[] {
  const linhas = [`linhas duplicadas do histórico: ${r.pares.length} ${aplicar ? 'juntada(s)' : 'a juntar'} · avisos ${r.avisos.length}`]
  for (const p of r.pares.slice(0, limite)) {
    linhas.push(`  ${p.contrato}: ${p.linhas} — prova: ${p.provas.join(', ')}${p.campos.length ? ` · leva ${p.campos.join(', ')}` : ''}`)
  }
  if (r.pares.length > limite) linhas.push(`  … e mais ${r.pares.length - limite}`)
  for (const a of r.avisos.slice(0, limite)) linhas.push(`  aviso ${a.contrato} ${a.linha}: ${a.aviso}`)
  if (r.avisos.length > limite) linhas.push(`  … e mais ${r.avisos.length - limite} aviso(s)`)
  return linhas
}
