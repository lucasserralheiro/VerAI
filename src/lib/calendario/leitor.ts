import type { LeitorDeArea } from '@/lib/biblioteca/leitores'
import { lerCalendario } from './leitura'
import { desenhoDoCalendario as desenhoPadrao } from './pdf'

// Leitor da área CALENDARIO (spec docs/superpowers/specs/2026-09-29-calendario-faturamento-design.md §4–5): um
// calendário por ano; o PDF mais novo do ano vale. Prazos só com a prova (status "ok"); sem ela, só feriados.

interface Deps {
  desenho: typeof desenhoPadrao
  agora: () => Date
}

export function criarLeitorDoCalendario(deps: Deps): LeitorDeArea {
  return async ({ prisma, todos, releitura, ler }) => {
    const pdfs = todos.filter((a) => a.extensao === 'pdf').sort((a, b) => a.modificadoEm.getTime() - b.modificadoEm.getTime())
    const existentes = new Map((await prisma.calendarioFaturamento.findMany({ select: { arquivoId: true, sha256: true } })).map((c) => [c.arquivoId, c.sha256]))
    const alvo = releitura ? pdfs : pdfs.filter((a) => existentes.get(a.id) !== a.sha256)
    const linhas: string[] = []
    for (const a of alvo) {
      try {
        const { retangulos, textos } = await deps.desenho(await ler(a))
        const lido = lerCalendario(retangulos, textos)
        if (!lido.ano) {
          linhas.push(`${a.nome}: ano não achado — ignorado`)
          continue
        }
        const dados = { arquivoId: a.id, sha256: a.sha256, status: lido.status, avisos: lido.avisos, lidoEm: deps.agora() }
        await prisma.$transaction(async (tx) => {
          const c = await tx.calendarioFaturamento.upsert({ where: { ano: lido.ano! }, create: { ano: lido.ano!, ...dados }, update: dados })
          await tx.dataFaturamento.deleteMany({ where: { calendarioId: c.id } })
          if (lido.datas.length > 0) {
            await tx.dataFaturamento.createMany({ data: lido.datas.map((d) => ({ calendarioId: c.id, inicio: d.inicio, fim: d.fim, tipo: d.tipo, descricao: d.descricao })) })
          }
        })
        await prisma.arquivoBiblioteca.updateMany({
          where: { id: { in: [a.id] } },
          data: { leituraStatus: lido.status === 'ok' ? 'ok' : 'parcial', leituraMensagem: lido.avisos.join(' · ') || null, lidoEm: deps.agora() },
        })
        linhas.push(`${lido.ano}: ${lido.status === 'ok' ? 'prazos lidos com prova' : 'só feriados'}${lido.avisos.length ? ` (${lido.avisos.join(' · ')})` : ''}`)
      } catch (erro) {
        await prisma.arquivoBiblioteca.updateMany({
          where: { id: { in: [a.id] } },
          data: { leituraStatus: 'erro', leituraMensagem: (erro instanceof Error ? erro.message : String(erro)).slice(0, 500), lidoEm: deps.agora() },
        })
        linhas.push(`${a.nome}: falhou — ${erro instanceof Error ? erro.message : String(erro)}`)
      }
    }
    const removidos = (await prisma.calendarioFaturamento.deleteMany({ where: { arquivoId: { notIn: pdfs.map((a) => a.id) } } })).count
    return `calendário de faturamento: ${alvo.length} lido(s)${removidos ? ` · removidos ${removidos}` : ''}${linhas.length ? ` · ${linhas.join(' · ')}` : ''}`
  }
}

export const lerCalendarioDeFaturamento: LeitorDeArea = criarLeitorDoCalendario({ desenho: desenhoPadrao, agora: () => new Date() })
