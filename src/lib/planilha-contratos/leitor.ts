import type { PrismaClient } from '@prisma/client'
import type { ArquivoDaArea, LeitorDeArea } from '@/lib/biblioteca/leitores'
import { lerPlanilhaDeContratos } from './leitura'

// Leitor da área PLANILHA_CONTRATOS da biblioteca Documentos (spec 2026-09-29-valor-vigencia-contratos §0.5):
// as linhas de cada .xlsx vão para LinhaPlanilhaContratos, trocadas inteiras quando o arquivo muda.

interface Deps {
  lerPlanilha: typeof lerPlanilhaDeContratos
  agora: () => Date
}

async function marcar(prisma: PrismaClient, a: ArquivoDaArea, status: 'ok' | 'erro', mensagem: string | null, agora: Date) {
  await prisma.arquivoBiblioteca.updateMany({ where: { id: { in: [a.id] } }, data: { leituraStatus: status, leituraMensagem: mensagem, lidoEm: agora } })
}

export function criarLeitorDaPlanilha(deps: Deps): LeitorDeArea {
  return async ({ prisma, todos, mudados, releitura, ler }) => {
    const planilhas = todos.filter((a) => a.extensao === 'xlsx')
    const jaLidos = new Set((await prisma.linhaPlanilhaContratos.findMany({ distinct: ['arquivoId'], select: { arquivoId: true } })).map((l) => l.arquivoId))
    const alvo = planilhas.filter((a) => releitura || mudados.includes(a.id) || !jaLidos.has(a.id))
    let linhas = 0
    let arquivos = 0
    const falhas: string[] = []
    for (const a of alvo) {
      try {
        const lido = await deps.lerPlanilha(await ler(a))
        if ('erro' in lido) {
          falhas.push(`${a.nome}: ${lido.erro}`)
          await marcar(prisma, a, 'erro', lido.erro, deps.agora())
          continue
        }
        await prisma.$transaction(async (tx) => {
          await tx.linhaPlanilhaContratos.deleteMany({ where: { arquivoId: a.id } })
          if (lido.linhas.length > 0) await tx.linhaPlanilhaContratos.createMany({ data: lido.linhas.map((l) => ({ ...l, arquivoId: a.id })) })
        })
        await marcar(prisma, a, 'ok', null, deps.agora())
        linhas += lido.linhas.length
        arquivos++
      } catch (erro) {
        const mensagem = (erro instanceof Error ? erro.message : String(erro)).slice(0, 500)
        falhas.push(`${a.nome}: ${mensagem}`)
        await marcar(prisma, a, 'erro', mensagem, deps.agora())
      }
    }
    await prisma.linhaPlanilhaContratos.deleteMany({ where: { arquivoId: { notIn: planilhas.map((a) => a.id) } } })
    return `planilha de contratos: ${linhas} linhas de ${arquivos} arquivo(s)${falhas.length ? ` · ${falhas.join(' · ')}` : ''}`
  }
}

export const lerPlanilhaDeContratosArea: LeitorDeArea = criarLeitorDaPlanilha({ lerPlanilha: lerPlanilhaDeContratos, agora: () => new Date() })
