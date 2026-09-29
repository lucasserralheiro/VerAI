import type { PrismaClient } from '@prisma/client'
import type { ArquivoDaArea, LeitorDeArea } from '@/lib/biblioteca/leitores'
import { conferirItens, resumoDaConferencia } from './conferencia'
import { lerInformativo, precosNoPdf, textoCorrido } from './pdf'
import { lerPlanilhaDePrecos } from './planilha'
import { dataDoNome, numeroDoInformativo, papelDoArquivo, versaoDoNome, type VersaoTabela } from './versao'

// Leitor da área TABELA_PRECOS da biblioteca Documentos (spec 2026-09-29-tabela-de-precos §4–5): uma versão
// = planilha + PDF oficial + publicação + informativo. Relê todas as versões a cada mudança na pasta (são
// uma ou duas; é barato e fica sempre igual ao que está lá).

export interface ConjuntoDaVersao {
  versao: VersaoTabela
  planilha: ArquivoDaArea
  pdf?: ArquivoDaArea
  publicacao?: ArquivoDaArea
  informativo?: ArquivoDaArea
}

/** Mais nova primeiro. Só vira versão o que tem planilha (a fonte estruturada). */
export function agruparPorVersao(todos: ArquivoDaArea[]): ConjuntoDaVersao[] {
  const conjuntos = new Map<string, ConjuntoDaVersao>()
  for (const a of todos) {
    const v = papelDoArquivo(a.nome) === 'planilha' ? versaoDoNome(a.nome) : null
    if (v) conjuntos.set(v.versao, { versao: v, planilha: a })
  }
  const lista = [...conjuntos.values()].sort((x, y) => y.versao.ordem - x.versao.ordem)
  for (const a of todos) {
    const papel = papelDoArquivo(a.nome)
    if (papel === 'pdf') {
      const v = versaoDoNome(a.nome)
      const c = v ? conjuntos.get(v.versao) : undefined
      if (c) c.pdf = a
    } else if (papel === 'informativo') {
      const numero = numeroDoInformativo(a.nome)
      const c = lista.find((x) => x.versao.numero === numero)
      if (c) c.informativo = a
    }
  }
  // A publicação no DOC não traz a versão no nome: fica com a mais nova; a sem "Tabela" no nome ganha.
  const publicacoes = todos.filter((a) => papelDoArquivo(a.nome) === 'publicacao')
  if (lista[0] && publicacoes.length > 0) lista[0].publicacao = publicacoes.find((p) => !/tabela/i.test(p.nome)) ?? publicacoes[0]
  return lista
}

interface Deps {
  lerPlanilha: typeof lerPlanilhaDePrecos
  textoDoPdf: (conteudo: Buffer) => Promise<string>
  agora: () => Date
}

const arquivosDo = (c: ConjuntoDaVersao) => [c.planilha, c.pdf, c.publicacao, c.informativo].filter((a): a is ArquivoDaArea => !!a)

async function marcar(prisma: PrismaClient, arquivos: ArquivoDaArea[], status: 'ok' | 'erro', mensagem: string | null, agora: Date) {
  await prisma.arquivoBiblioteca.updateMany({
    where: { id: { in: arquivos.map((a) => a.id) } },
    data: { leituraStatus: status, leituraMensagem: mensagem, lidoEm: agora },
  })
}

async function lerVersao(prisma: PrismaClient, c: ConjuntoDaVersao, ler: (a: ArquivoDaArea) => Promise<Buffer>, deps: Deps): Promise<string> {
  const agora = deps.agora()
  const planilha = await deps.lerPlanilha(await ler(c.planilha))
  if ('erro' in planilha) {
    await marcar(prisma, [c.planilha], 'erro', planilha.erro, agora)
    return `tabela de preços ${c.versao.versao}: planilha não lida — ${planilha.erro}`
  }
  const precos = c.pdf ? precosNoPdf(await deps.textoDoPdf(await ler(c.pdf))) : null
  const informativo = c.informativo ? lerInformativo(await deps.textoDoPdf(await ler(c.informativo))) : null
  const itens = conferirItens(planilha.itens, precos, informativo)
  const resumo = resumoDaConferencia(itens)
  const dados = {
    ano: c.versao.ano,
    numero: c.versao.numero,
    ordem: c.versao.ordem,
    publicadaEm: informativo?.publicadaEm ?? (c.publicacao ? dataDoNome(c.publicacao.nome) : null),
    arquivoPlanilhaId: c.planilha.id,
    arquivoPdfId: c.pdf?.id ?? null,
    arquivoPublicacaoId: c.publicacao?.id ?? null,
    arquivoInformativoId: c.informativo?.id ?? null,
    totalItens: itens.length,
    divergencias: resumo.diverge,
    lidaEm: agora,
  }
  await prisma.$transaction(async (tx) => {
    const tabela = await tx.tabelaPrecos.upsert({ where: { versao: c.versao.versao }, create: { versao: c.versao.versao, ...dados }, update: dados })
    await tx.itemTabelaPrecos.deleteMany({ where: { tabelaId: tabela.id } })
    await tx.itemTabelaPrecos.createMany({
      data: itens.map((i, posicao) => ({
        tabelaId: tabela.id,
        posicao,
        grupo: i.grupo,
        secoes: i.secoes,
        codigo: i.codigo,
        descricao: i.descricao,
        unidade: i.unidade,
        preco: i.preco,
        sobDemanda: i.sobDemanda,
        precoTexto: i.precoTexto,
        conferencia: i.conferencia,
        precoNoPdf: i.precoNoPdf,
      })),
    })
  })
  await marcar(prisma, arquivosDo(c), 'ok', null, agora)
  const extra = [
    planilha.repetidos.length ? `códigos repetidos ignorados: ${planilha.repetidos.join(', ')}` : '',
    c.pdf ? '' : 'SEM PDF oficial para conferir',
  ].filter(Boolean)
  return `tabela de preços ${c.versao.versao}: ${itens.length} serviços · conferem ${resumo.confere} · alterados pelo informativo ${resumo['alterado-pelo-informativo']} · fora do PDF ${resumo['fora-do-pdf']} · divergem ${resumo.diverge}${extra.length ? ` · ${extra.join(' · ')}` : ''}`
}

export function criarLeitorDaTabela(deps: Deps): LeitorDeArea {
  return async ({ prisma, todos, ler }) => {
    const versoes = agruparPorVersao(todos)
    if (versoes.length === 0) return 'tabela de preços: nenhuma "Memória de Cálculo <ano> v<n>.xlsx" na pasta — nada lido'
    const linhas: string[] = []
    for (const c of versoes) {
      try {
        linhas.push(await lerVersao(prisma, c, ler, deps))
      } catch (erro) {
        const mensagem = (erro instanceof Error ? erro.message : String(erro)).slice(0, 500)
        await marcar(prisma, arquivosDo(c), 'erro', mensagem, deps.agora())
        linhas.push(`tabela de preços ${c.versao.versao}: falhou — ${mensagem}`)
      }
    }
    return linhas.join('\n  ')
  }
}

export const lerTabelaDePrecos: LeitorDeArea = criarLeitorDaTabela({ lerPlanilha: lerPlanilhaDePrecos, textoDoPdf: textoCorrido, agora: () => new Date() })
