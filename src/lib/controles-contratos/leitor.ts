import type { PrismaClient } from '@prisma/client'
import type { ArquivoDaArea, LeitorDeArea } from '@/lib/biblioteca/leitores'
import { chaveNumerica } from '@/lib/relatorios-clientes/vincular-itens'
import { lerControle, type ControleLido, type TabelaLida } from './leitura'
import { chaveDoContratoTexto, contratoDoNome, mesDoCaminho } from './nome'
import { linhasDoPdf as linhasDoPdfPadrao } from './pdf'

// Leitor da área CONTROLES_CONTRATOS (spec docs/superpowers/specs/2026-09-29-controles-de-contratos-design.md
// §4–5): um PDF por contrato por mês. Lê o que é novo ou mudou (pelo sha256 guardado), casa o contrato e grava
// totais + linhas. Totais e linhas só das tabelas conferidas pela soma.

interface Deps {
  linhasDoPdf: typeof linhasDoPdfPadrao
  agora: () => Date
}

type ContratoAchado = { id: string; clienteId: string }

/** Chave "SIGLA|nº ano" → contratos (a chave do SharePoint e, sem ela, sigla + nº do termo). */
export async function mapaDeContratos(prisma: PrismaClient): Promise<Map<string, ContratoAchado[]>> {
  const contratos = await prisma.contrato.findMany({
    select: { id: true, clienteId: true, chaveSharepoint: true, numeroTermo: true, cliente: { select: { siglaLegado: true } } },
  })
  const mapa = new Map<string, ContratoAchado[]>()
  const guardar = (chave: string | null, c: ContratoAchado) => {
    if (!chave) return
    const lista = mapa.get(chave) ?? []
    if (!lista.some((x) => x.id === c.id)) lista.push(c)
    mapa.set(chave, lista)
  }
  for (const c of contratos) {
    const alvo = { id: c.id, clienteId: c.clienteId }
    guardar(c.chaveSharepoint, alvo)
    const sigla = c.cliente.siglaLegado?.toUpperCase()
    const numero = chaveNumerica(c.numeroTermo)
    if (sigla && numero) guardar(`${sigla}|${numero}`, alvo)
  }
  return mapa
}

/** Só quando o casamento é único — na dúvida, "sem contrato no VerAI". */
function acharContrato(a: ArquivoDaArea, lido: ControleLido, contratos: Map<string, ContratoAchado[]>): ContratoAchado | null {
  const { sigla, chave } = contratoDoNome(a.nome)
  for (const k of [chave, chaveDoContratoTexto(lido.contratoTexto)]) {
    const achados = k ? contratos.get(`${sigla}|${k}`) : undefined
    if (achados?.length === 1) return achados[0]
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
    const contratos = alvo.length > 0 ? await mapaDeContratos(prisma) : new Map<string, ContratoAchado[]>()
    const r = { lidos: 0, previsto: 0, faturado: 0, semContrato: 0, falhas: 0 }
    for (const a of alvo) {
      try {
        const lido = lerControle(await deps.linhasDoPdf(await ler(a)))
        const contrato = acharContrato(a, lido, contratos)
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
    // Controle de arquivo que saiu da pasta sai junto (o arquivo fica registrado como removido na origem).
    const removidos = (await prisma.controleContrato.deleteMany({ where: { arquivoId: { notIn: pdfs.map((a) => a.id) } } })).count
    return `controles de contratos: ${r.lidos} lidos · previsto conferido ${r.previsto} · faturado conferido ${r.faturado} · sem contrato no VerAI ${r.semContrato} · removidos ${removidos}${r.falhas ? ` · falhas ${r.falhas}` : ''}`
  }
}

export const lerControlesDeContratos: LeitorDeArea = criarLeitorDosControles({ linhasDoPdf: linhasDoPdfPadrao, agora: () => new Date() })
