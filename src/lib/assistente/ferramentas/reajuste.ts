import { z } from 'zod'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { podeVerCliente } from '@/lib/visibilidade'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { normalizarDecimal } from '@/lib/relatorios-clientes/numero'
import { lerIndiceGravado } from '@/lib/reajuste/indice'
import { calcularPeriodo, corrigirValor, fatorCompleto, periodoSugerido } from '@/lib/reajuste/calculo'
import { SELECT_CONTRATO } from '@/app/api/contratos/esquema'
import { data, definirFerramenta, esquemaLimite, moeda, NAO_ENCONTRADO } from './comum'

// IPC-Fipe e reajuste (spec 2026-09-30-reajuste-ipc-fipe). Conta SÓ pelo código da tela (decimal.js,
// arredonda no fim); a IA nunca multiplica.

const mesBr = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`
const pct = (v: string) => `${v.replace('.', ',')}%`
const fatorBr = (v: string) => v.replace('.', ',')
const esquemaMes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)

async function periodo(mesInicial?: string, mesFinal?: string) {
  const { meses, atualizadoEm } = await lerIndiceGravado()
  const ultimo = meses.at(-1)?.mes
  if (!ultimo) return { erro: 'o IPC-Fipe ainda não foi sincronizado' } as const
  const sugerido = periodoSugerido(ultimo)
  const inicial = mesInicial ?? sugerido.inicial
  const final = mesFinal ?? sugerido.final
  const calculo = calcularPeriodo(inicial, final, new Map(meses.map((m) => [m.mes, m.variacao])))
  if (!calculo.ok) {
    if ('faltando' in calculo) return { erro: `sem índice publicado para ${calculo.faltando.map(mesBr).join(', ')} — o período não pode ser calculado` } as const
    return { erro: calculo.erro } as const
  }
  return { calculo, inicial, final, ultimo, atualizadoEm }
}

export const indiceIpcFipe = definirFerramenta({
  descricao:
    'IPC-Fipe mensal (Banco Central, série 193) guardado no VerAI: variação de cada mês e o acumulado do período ("quanto deu o IPC", "índice de reajuste", "inflação acumulada"). Sem período: os últimos 12 meses publicados. "Últimos N meses" = os N últimos publicados: omita mesInicial e mesFinal e a ferramenta escolhe; só passe período com meses explícitos do usuário.',
  entrada: z.object({ mesInicial: esquemaMes.optional().describe('AAAA-MM'), mesFinal: esquemaMes.optional().describe('AAAA-MM') }),
  async executar({ mesInicial, mesFinal }) {
    const p = await periodo(mesInicial, mesFinal)
    if ('erro' in p) return p
    return {
      periodo: `${mesBr(p.inicial)} a ${mesBr(p.final)}`,
      ultimoPublicado: mesBr(p.ultimo),
      atualizadoEm: p.atualizadoEm ? data(new Date(p.atualizadoEm)) : null,
      acumulado: pct(p.calculo.acumuladoPct),
      fator: fatorBr(p.calculo.fator),
      meses: p.calculo.meses.map((m) => ({ mes: mesBr(m.mes), variacao: pct(m.variacao) })),
    }
  },
})

export const simularReajuste = definirFerramenta({
  descricao:
    'Simula o reajuste pelo IPC-Fipe ("quanto fica reajustado", "quanto sobe o contrato"): informe o valor (ex.: "R$ 250.000,00") OU o contratoId (usa o valor contratado consolidado) e o período; sem período, os últimos 12 meses publicados. "Últimos N meses" = os N últimos publicados: omita mesInicial e mesFinal e a ferramenta escolhe; só passe período com meses explícitos do usuário. A conta é do mesmo código da tela de Reajuste. Não grava nada.',
  entrada: z
    .object({
      valor: z.string().optional().describe('valor com vírgula nos centavos, ex.: "250.000,00"'),
      contratoId: z.string().optional(),
      mesInicial: esquemaMes.optional(),
      mesFinal: esquemaMes.optional(),
    })
    .refine((e) => e.valor || e.contratoId, 'informe valor ou contratoId'),
  async executar({ valor, contratoId, mesInicial, mesFinal }, { usuario, hoje }) {
    let original: string
    let contrato: string | undefined
    if (contratoId) {
      const c = await prisma.contrato.findUnique({ where: { id: contratoId }, select: SELECT_CONTRATO })
      if (!c || !(await podeVerCliente(usuario, c.clienteId))) return NAO_ENCONTRADO
      const base = (await consolidarContratos([c], hoje)).get(c.id)?.valorBase
      if (base === null || base === undefined) return { erro: 'contrato sem valor cadastrado — informe o valor' }
      original = base.toString()
      contrato = c.numeroTermo ?? undefined
    } else {
      const lido = normalizarDecimal(valor!)
      if ('erro' in lido) return lido
      original = lido.valor
    }
    const p = await periodo(mesInicial, mesFinal)
    if ('erro' in p) return p
    const corrigido = corrigirValor(original, fatorCompleto(p.calculo.meses))
    return {
      ...(contrato ? { contrato } : {}),
      periodo: `${mesBr(p.inicial)} a ${mesBr(p.final)}`,
      valorOriginal: moeda(original),
      acumulado: pct(p.calculo.acumuladoPct),
      fator: fatorBr(p.calculo.fator),
      valorCorrigido: moeda(corrigido),
      diferenca: moeda(new Decimal(corrigido).minus(original).toFixed(2)),
    }
  },
})

export const reajustesCalculados = definirFerramenta({
  descricao: 'Reajustes já calculados na tela Reajuste IPC-Fipe (arquivo, período, acumulado, quantos valores, quando, quem). Admin vê todos; os demais, só os seus.',
  entrada: z.object({ mes: esquemaMes.optional().describe('mês do cálculo AAAA-MM'), limite: esquemaLimite }),
  async executar({ mes, limite }, { usuario }) {
    const where = {
      ...(usuario.role === 'admin' ? {} : { usuarioId: usuario.id }),
      ...(mes
        ? { createdAt: { gte: new Date(`${mes}-01T00:00:00.000Z`), lt: new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 1)) } }
        : {}),
    }
    const lista = await prisma.reajusteExecucao.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limite,
      select: { nomeArquivo: true, mesInicial: true, mesFinal: true, acumuladoPct: true, quantidadeValores: true, createdAt: true, usuario: { select: { nome: true } } },
    })
    return {
      total: lista.length,
      reajustes: lista.map((r) => ({
        arquivo: r.nomeArquivo,
        periodo: `${mesBr(r.mesInicial.toISOString().slice(0, 7))} a ${mesBr(r.mesFinal.toISOString().slice(0, 7))}`,
        acumulado: pct(r.acumuladoPct.toString()),
        valores: r.quantidadeValores,
        em: data(r.createdAt),
        por: r.usuario.nome,
      })),
    }
  },
})
