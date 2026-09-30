import type { PrismaClient } from '@prisma/client'
import type { ArquivoDaArea, LeitorDeArea } from '@/lib/biblioteca/leitores'
import { acharContratoPorSigla, mapaDeContratos, type MapasDeContratos } from '@/lib/controles-contratos/leitor'
import { chaveDoContratoTexto, chaveSemNumero } from '@/lib/controles-contratos/nome'
import { categoriaDoCaminho, competenciaDoCaminho, contratoDoArquivo, siglaDoArquivo } from './caminho'
import { lerRelatorioLinks, type RelatorioLido } from './leitura'
import { itensDoPdf as itensDoPdfPadrao } from './pdf'

// Leitor da área LINKS_MPLS (spec docs/superpowers/specs/2026-09-29-links-mpls-design.md §4–5): um PDF por
// contrato, categoria e mês. Lê o que é novo ou mudou (sha256), confere pela prova dos totais, casa o contrato
// (a mesma regra dos controles, só quando é único) e grava. Links só de relatório conferido.

interface Deps {
  itensDoPdf: typeof itensDoPdfPadrao
  agora: () => Date
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** Chaves "nº ano" candidatas: contrato das linhas (o mais comum), do cabeçalho e do nome do arquivo. */
function chavesDoRelatorio(nome: string, lido: Pick<RelatorioLido, 'contratoTexto' | 'links'>): (string | null)[] {
  const contagem = new Map<string, number>()
  for (const l of lido.links) if (l.contratoTexto) contagem.set(l.contratoTexto, (contagem.get(l.contratoTexto) ?? 0) + 1)
  const dasLinhas = [...contagem].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const textos = [dasLinhas, lido.contratoTexto, contratoDoArquivo(nome)]
  return textos.flatMap((t) => [chaveDoContratoTexto(t), chaveSemNumero(t)])
}

export function acharContratoDoRelatorio(nome: string, lido: Pick<RelatorioLido, 'contratoTexto' | 'links'>, mapas: MapasDeContratos) {
  return acharContratoPorSigla(siglaDoArquivo(nome), chavesDoRelatorio(nome, lido), mapas)
}

async function gravar(prisma: PrismaClient, a: ArquivoDaArea, lido: RelatorioLido, contrato: { id: string; clienteId: string } | null, agora: Date) {
  const comp = competenciaDoCaminho(a.caminho)!
  const avisos = [...lido.avisos]
  if (lido.titulo && (lido.titulo.mes !== comp.mes || lido.titulo.ano !== comp.ano)) {
    avisos.push(`título diz ${MESES[lido.titulo.mes - 1]}/${lido.titulo.ano}; a pasta é de ${MESES[comp.mes - 1]}/${comp.ano}`)
  }
  const sigla = siglaDoArquivo(a.nome)
  if (lido.titulo?.sigla && lido.titulo.sigla !== sigla) avisos.push(`título diz "${lido.titulo.sigla}"; o arquivo é de ${sigla}`)
  const conta = (s: 'ATIVOS' | 'CANCELADOS') => (lido.conferido ? lido.links.filter((l) => (l.situacao ?? 'ATIVOS') === s).length : null)
  const dados = {
    sha256: a.sha256,
    ano: comp.ano,
    mes: comp.mes,
    categoria: categoriaDoCaminho(a.caminho),
    sigla,
    contratoTexto: lido.contratoTexto ?? lido.links.find((l) => l.contratoTexto)?.contratoTexto ?? contratoDoArquivo(a.nome),
    contratoId: contrato?.id ?? null,
    clienteId: contrato?.clienteId ?? null,
    servico: lido.servico,
    ativos: conta('ATIVOS'),
    cancelados: conta('CANCELADOS'),
    conferido: lido.conferido,
    avisos,
    lidoEm: agora,
  }
  await prisma.$transaction(async (tx) => {
    const r = await tx.relatorioLinks.upsert({ where: { arquivoId: a.id }, create: { arquivoId: a.id, ...dados }, update: dados })
    await tx.linkMpls.deleteMany({ where: { relatorioId: r.id } })
    if (lido.conferido && lido.links.length > 0) {
      await tx.linkMpls.createMany({
        data: lido.links.map((l, posicao) => ({
          relatorioId: r.id,
          posicao,
          situacao: l.situacao === 'CANCELADOS' ? 'CANCELADO' : 'ATIVO',
          codigo: l.codigo,
          kbps: l.kbps,
          redundancia: l.redundancia,
          dataAceite: l.dataAceite,
          dataCancelamento: l.dataCancelamento,
          entidade: l.entidade,
          tipoLogradouro: l.tipoLogradouro,
          endereco: l.endereco,
          numero: l.numero,
        })),
      })
    }
  })
  await prisma.arquivoBiblioteca.updateMany({
    where: { id: { in: [a.id] } },
    data: { leituraStatus: lido.conferido ? 'ok' : 'parcial', leituraMensagem: avisos.join(' · ') || null, lidoEm: agora },
  })
}

export function criarLeitorDosLinks(deps: Deps): LeitorDeArea {
  return async ({ prisma, todos, releitura, ler }) => {
    const pdfs = todos.filter((a) => a.extensao === 'pdf' && competenciaDoCaminho(a.caminho))
    const existentes = new Map((await prisma.relatorioLinks.findMany({ select: { arquivoId: true, sha256: true } })).map((r) => [r.arquivoId, r.sha256]))
    const alvo = releitura ? pdfs : pdfs.filter((a) => existentes.get(a.id) !== a.sha256)
    const mapas = await mapaDeContratos(prisma)
    const r = { lidos: 0, conferidos: 0, semContrato: 0, falhas: 0, religados: 0 }
    for (const a of alvo) {
      try {
        const lido = lerRelatorioLinks(await deps.itensDoPdf(await ler(a)))
        const contrato = acharContratoDoRelatorio(a.nome, lido, mapas)
        await gravar(prisma, a, lido, contrato, deps.agora())
        r.lidos++
        if (lido.conferido) r.conferidos++
        if (!contrato) r.semContrato++
      } catch (erro) {
        r.falhas++
        await prisma.arquivoBiblioteca.updateMany({
          where: { id: { in: [a.id] } },
          data: { leituraStatus: 'erro', leituraMensagem: (erro instanceof Error ? erro.message : String(erro)).slice(0, 500), lidoEm: deps.agora() },
        })
      }
    }
    // Relatório já lido e ainda sem contrato: tenta de novo sem reler o PDF (o contrato pode ter entrado depois).
    const lidosAgora = new Set(alvo.map((a) => a.id))
    const nomes = new Map(pdfs.map((a) => [a.id, a.nome]))
    const semContrato = await prisma.relatorioLinks.findMany({
      where: { contratoId: null },
      select: { id: true, arquivoId: true, contratoTexto: true },
    })
    for (const s of semContrato) {
      const nome = nomes.get(s.arquivoId)
      if (!nome || lidosAgora.has(s.arquivoId)) continue
      const contrato = acharContratoDoRelatorio(nome, { contratoTexto: s.contratoTexto, links: [] }, mapas)
      if (!contrato) continue
      await prisma.relatorioLinks.update({ where: { id: s.id }, data: { contratoId: contrato.id, clienteId: contrato.clienteId } })
      r.religados++
    }
    const removidos = (await prisma.relatorioLinks.deleteMany({ where: { arquivoId: { notIn: pdfs.map((a) => a.id) } } })).count
    return `links MPLS: ${r.lidos} lidos · conferidos ${r.conferidos} · sem contrato no VerAI ${r.semContrato}${r.religados ? ` · religados ${r.religados}` : ''} · removidos ${removidos}${r.falhas ? ` · falhas ${r.falhas}` : ''}`
  }
}

export const lerLinksMpls: LeitorDeArea = criarLeitorDosLinks({ itensDoPdf: itensDoPdfPadrao, agora: () => new Date() })
