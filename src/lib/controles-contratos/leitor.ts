import type { PrismaClient } from '@prisma/client'
import type { ArquivoDaArea, LeitorDeArea } from '@/lib/biblioteca/leitores'
import { chaveNumerica } from '@/lib/relatorios-clientes/vincular-itens'
import { lerControle, type ControleLido, type TabelaLida } from './leitura'
import { chaveDoContratoTexto, chaveSemNumero, contratoDoNome, mesDoCaminho, siglaCompativel } from './nome'
import { linhasDoPdf as linhasDoPdfPadrao } from './pdf'

// Leitor da área CONTROLES_CONTRATOS (spec docs/superpowers/specs/2026-09-29-controles-de-contratos-design.md
// §4–5): um PDF por contrato por mês. Lê o que é novo ou mudou (pelo sha256 guardado), casa o contrato e grava
// totais + linhas. Totais e linhas só das tabelas conferidas pela soma.

interface Deps {
  linhasDoPdf: typeof linhasDoPdfPadrao
  agora: () => Date
}

type ContratoAchado = { id: string; clienteId: string }
type Candidato = ContratoAchado & { sigla: string | null; nome: string }

export interface MapasDeContratos {
  /** "SIGLA|nº ano" → contratos (a chave do SharePoint e, sem ela, sigla + nº do termo). */
  porChave: Map<string, ContratoAchado[]>
  /** "nº ano" → contratos de qualquer cliente — para a sigla escrita de outro jeito no nome do arquivo. */
  porNumero: Map<string, Candidato[]>
  siglas: Set<string>
}

export async function mapaDeContratos(prisma: PrismaClient): Promise<MapasDeContratos> {
  const contratos = await prisma.contrato.findMany({
    select: { id: true, clienteId: true, chaveSharepoint: true, numeroTermo: true, cliente: { select: { siglaLegado: true, nome: true } } },
  })
  const porChave = new Map<string, ContratoAchado[]>()
  const porNumero = new Map<string, Candidato[]>()
  const guardar = <T extends ContratoAchado>(mapa: Map<string, T[]>, chave: string | null, c: T) => {
    if (!chave) return
    const lista = mapa.get(chave) ?? []
    if (!lista.some((x) => x.id === c.id)) lista.push(c)
    mapa.set(chave, lista)
  }
  const siglas = new Set<string>()
  for (const c of contratos) {
    const alvo = { id: c.id, clienteId: c.clienteId }
    const sigla = c.cliente.siglaLegado?.toUpperCase() ?? null
    if (sigla) siglas.add(sigla)
    guardar(porChave, c.chaveSharepoint, alvo)
    const numero = chaveNumerica(c.numeroTermo) ?? chaveSemNumero(c.numeroTermo)
    if (sigla && numero) guardar(porChave, `${sigla}|${numero}`, alvo)
    const doSharepoint = c.chaveSharepoint?.split('|')[1] ?? null
    for (const n of [numero, doSharepoint]) guardar(porNumero, n, { ...alvo, sigla, nome: c.cliente.nome })
  }
  return { porChave, porNumero, siglas }
}

/**
 * Só quando o casamento é único — na dúvida, "sem contrato no VerAI". Primeiro pela sigla do nome do arquivo;
 * se essa sigla não é de cliente nenhum ("SPURB", "SUB-Guainazes"), pelo nº e ano entre os clientes de sigla ou
 * nome compatível (`siglaCompativel`).
 */
export function acharContrato(nome: string, contratoTexto: string | null, mapas: MapasDeContratos): ContratoAchado | null {
  const { sigla, chave } = contratoDoNome(nome)
  const chaves = [chave, chaveDoContratoTexto(contratoTexto), chaveSemNumero(nome.replace(/\s*-\s*\d{4}\.\d{2}\.pdf$/i, '')), chaveSemNumero(contratoTexto)]
  for (const k of chaves) {
    const achados = k ? mapas.porChave.get(`${sigla}|${k}`) : undefined
    if (achados?.length === 1) return achados[0]
  }
  if (mapas.siglas.has(sigla)) return null
  for (const k of chaves) {
    const achados = (k ? (mapas.porNumero.get(k) ?? []) : []).filter((c) => siglaCompativel(sigla, c))
    if (achados.length === 1) return { id: achados[0].id, clienteId: achados[0].clienteId }
  }
  return null
}

const totalConferido = (t: TabelaLida | null) => (t?.conferida ? t.total : null)

async function gravar(prisma: PrismaClient, a: ArquivoDaArea, lido: ControleLido, contrato: ContratoAchado | null, agora: Date) {
  const mes = mesDoCaminho(a.caminho)!
  const dados = {
    sha256: a.sha256,
    mesAno: mes.ano,
    mesMes: mes.mes,
    sigla: contratoDoNome(a.nome).sigla,
    contratoTexto: lido.contratoTexto,
    contratoId: contrato?.id ?? null,
    clienteId: contrato?.clienteId ?? null,
    termoTexto: lido.termoTexto,
    vigenciaTexto: lido.vigenciaTexto,
    vigenciaInicio: lido.vigenciaInicio,
    vigenciaFim: lido.vigenciaFim,
    previstoTotal: totalConferido(lido.previsto),
    faturadoTotal: totalConferido(lido.faturado),
    // O saldo do documento fica como veio: a tela compara com previsto − faturado e avisa se diferir.
    saldoTotal: lido.saldo?.total ?? null,
    previstoConferido: !!lido.previsto?.conferida,
    faturadoConferido: !!lido.faturado?.conferida,
    avisos: lido.avisos,
    lidoEm: agora,
  }
  await prisma.$transaction(async (tx) => {
    const controle = await tx.controleContrato.upsert({ where: { arquivoId: a.id }, create: { arquivoId: a.id, ...dados }, update: dados })
    await tx.controleContratoLinha.deleteMany({ where: { controleId: controle.id } })
    const linhas = (['previsto', 'faturado', 'saldo'] as const).flatMap((tipo) => {
      const tabela = lido[tipo]
      return (tabela?.conferida ? tabela.linhas : []).map((l, posicao) => ({
        controleId: controle.id,
        tipo,
        posicao,
        rotulo: l.rotulo,
        inicio: l.inicio,
        fim: l.fim,
        valor: l.valor,
      }))
    })
    if (linhas.length > 0) await tx.controleContratoLinha.createMany({ data: linhas })
  })
  await prisma.arquivoBiblioteca.updateMany({
    where: { id: { in: [a.id] } },
    data: {
      leituraStatus: lido.previsto?.conferida && lido.faturado?.conferida ? 'ok' : 'parcial',
      leituraMensagem: lido.avisos.join(' · ') || null,
      lidoEm: agora,
    },
  })
}

export function criarLeitorDosControles(deps: Deps): LeitorDeArea {
  return async ({ prisma, todos, releitura, ler }) => {
    const pdfs = todos.filter((a) => a.extensao === 'pdf' && mesDoCaminho(a.caminho))
    const existentes = new Map((await prisma.controleContrato.findMany({ select: { arquivoId: true, sha256: true } })).map((c) => [c.arquivoId, c.sha256]))
    const alvo = releitura ? pdfs : pdfs.filter((a) => existentes.get(a.id) !== a.sha256)
    const contratos = await mapaDeContratos(prisma)
    const r = { lidos: 0, previsto: 0, faturado: 0, semContrato: 0, falhas: 0, religados: 0 }
    for (const a of alvo) {
      try {
        const lido = lerControle(await deps.linhasDoPdf(await ler(a)))
        const contrato = acharContrato(a.nome, lido.contratoTexto, contratos)
        await gravar(prisma, a, lido, contrato, deps.agora())
        r.lidos++
        if (lido.previsto?.conferida) r.previsto++
        if (lido.faturado?.conferida) r.faturado++
        if (!contrato) r.semContrato++
      } catch (erro) {
        r.falhas++
        await prisma.arquivoBiblioteca.updateMany({
          where: { id: { in: [a.id] } },
          data: { leituraStatus: 'erro', leituraMensagem: (erro instanceof Error ? erro.message : String(erro)).slice(0, 500), lidoEm: deps.agora() },
        })
      }
    }
    // Controle já lido e ainda sem contrato: tenta de novo (o contrato pode ter entrado no VerAI depois, ou a
    // regra de casamento melhorou) — sem reler o PDF.
    const lidosAgora = new Set(alvo.map((a) => a.id))
    const nomes = new Map(pdfs.map((a) => [a.id, a.nome]))
    for (const s of await prisma.controleContrato.findMany({ where: { contratoId: null }, select: { id: true, arquivoId: true, contratoTexto: true } })) {
      const nome = nomes.get(s.arquivoId)
      if (!nome || lidosAgora.has(s.arquivoId)) continue
      const contrato = acharContrato(nome, s.contratoTexto ?? null, contratos)
      if (!contrato) continue
      await prisma.controleContrato.update({ where: { id: s.id }, data: { contratoId: contrato.id, clienteId: contrato.clienteId } })
      r.religados++
    }
    // Controle de arquivo que saiu da pasta sai junto (o arquivo fica registrado como removido na origem).
    const removidos = (await prisma.controleContrato.deleteMany({ where: { arquivoId: { notIn: pdfs.map((a) => a.id) } } })).count
    return `controles de contratos: ${r.lidos} lidos · previsto conferido ${r.previsto} · faturado conferido ${r.faturado} · sem contrato no VerAI ${r.semContrato}${r.religados ? ` · religados ${r.religados}` : ''} · removidos ${removidos}${r.falhas ? ` · falhas ${r.falhas}` : ''}`
  }
}

export const lerControlesDeContratos: LeitorDeArea = criarLeitorDosControles({ linhasDoPdf: linhasDoPdfPadrao, agora: () => new Date() })
