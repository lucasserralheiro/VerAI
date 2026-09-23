import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { podeVerCliente } from '@/lib/visibilidade'
import {
  competenciaTexto,
  data,
  definirFerramenta,
  esquemaCompetencia,
  esquemaLimite,
  filtroDeClientes,
  moeda,
  NAO_ENCONTRADO,
  sei,
} from './comum'

function partes(competencia: string): [number, number] {
  const [ano, mes] = competencia.split('-').map(Number)
  return [ano, mes]
}

export function filtroCompetencia(de?: string, ate?: string): Prisma.FaturamentoWhereInput[] {
  const filtros: Prisma.FaturamentoWhereInput[] = []
  if (de) {
    const [ano, mes] = partes(de)
    filtros.push({ OR: [{ competenciaAno: { gt: ano } }, { competenciaAno: ano, competenciaMes: { gte: mes } }] })
  }
  if (ate) {
    const [ano, mes] = partes(ate)
    filtros.push({ OR: [{ competenciaAno: { lt: ano } }, { competenciaAno: ano, competenciaMes: { lte: mes } }] })
  }
  return filtros
}

const contem = (valor: string) => ({ contains: valor, mode: 'insensitive' as const })

export const faturamentos = definirFerramenta({
  descricao:
    'Faturamentos mensais de um cliente (opcionalmente de um contrato e de um período): valor, situação, SEI, se foi enviado ao cliente/GFP e as notas fiscais. Mais recentes primeiro, com a soma do período.',
  entrada: z.object({
    clienteId: z.string().min(1),
    contratoId: z.string().optional(),
    de: esquemaCompetencia.optional(),
    ate: esquemaCompetencia.optional(),
    limite: esquemaLimite,
  }),
  async executar({ clienteId, contratoId, de, ate, limite }, { usuario }) {
    if (!(await podeVerCliente(usuario, clienteId))) return NAO_ENCONTRADO
    const where: Prisma.FaturamentoWhereInput = { AND: [{ clienteId }, contratoId ? { contratoId } : {}, ...filtroCompetencia(de, ate)] }
    const [totais, lista] = await Promise.all([
      prisma.faturamento.aggregate({ where, _count: { _all: true }, _sum: { valor: true } }),
      prisma.faturamento.findMany({
        where,
        orderBy: [{ competenciaAno: 'desc' }, { competenciaMes: 'desc' }],
        take: limite,
        select: {
          id: true, competenciaAno: true, competenciaMes: true, valor: true, situacao: true, sei: true,
          enviadoCliente: true, enviadoGfp: true, observacao: true, pdfNomeArquivo: true,
          contrato: { select: { numeroTermo: true } },
          notasFiscais: { select: { numero: true, servico: true, valor: true, dataEmissao: true } },
        },
      }),
    ])
    return {
      total: totais._count._all,
      valorTotalPeriodo: moeda(totais._sum.valor),
      faturamentos: lista.map((f) => ({
        competencia: competenciaTexto(f.competenciaAno, f.competenciaMes),
        contrato: f.contrato.numeroTermo,
        valor: moeda(f.valor),
        situacao: f.situacao,
        sei: sei(f.sei),
        enviadoCliente: f.enviadoCliente,
        enviadoGfp: f.enviadoGfp,
        observacao: f.observacao,
        pdf: f.pdfNomeArquivo,
        notasFiscais: f.notasFiscais.map((n) => ({ numero: n.numero, servico: n.servico, valor: moeda(n.valor), emissao: data(n.dataEmissao) })),
        href: `/clientes/${clienteId}/faturamentos/${f.id}`,
      })),
    }
  },
})

export const demandas = definirFerramenta({
  descricao:
    'Demandas/documentos (ofícios, pedidos) de um cliente ou de todos: assunto, tipo, responsável, situação, SEI e o último trâmite. `busca` procura em assunto, tipo de assunto, documento, SEI e responsável.',
  entrada: z.object({
    clienteId: z.string().optional(),
    situacao: z.string().optional(),
    busca: z.string().optional(),
    limite: esquemaLimite,
  }),
  async executar({ clienteId, situacao, busca, limite }, { usuario }) {
    const filtro = await filtroDeClientes(usuario)
    const where: Prisma.DemandaWhereInput = {
      AND: [
        filtro ? { clienteId: filtro } : {},
        clienteId ? { clienteId } : {},
        situacao ? { situacao: contem(situacao) } : {},
        busca
          ? { OR: [{ assunto: contem(busca) }, { tipoAssunto: contem(busca) }, { documento: contem(busca) }, { sei: contem(busca) }, { responsavel: contem(busca) }] }
          : {},
      ],
    }
    const [total, lista] = await Promise.all([
      prisma.demanda.count({ where }),
      prisma.demanda.findMany({
        where,
        orderBy: { dataAbertura: { sort: 'desc', nulls: 'last' } },
        take: limite,
        select: {
          id: true, assunto: true, tipo: true, tipoAssunto: true, responsavel: true, situacao: true, dataAbertura: true,
          sei: true, documento: true, cliente: { select: { nome: true } },
          tramites: { orderBy: { data: { sort: 'desc', nulls: 'last' } }, take: 1, select: { data: true, posicao: true, acao: true, responsavelAtual: true } },
        },
      }),
    ])
    return {
      total,
      demandas: lista.map((d) => ({
        id: d.id,
        cliente: d.cliente.nome,
        assunto: d.assunto,
        tipo: d.tipo,
        tipoAssunto: d.tipoAssunto,
        documento: d.documento,
        responsavel: d.responsavel,
        situacao: d.situacao,
        abertura: data(d.dataAbertura),
        sei: sei(d.sei),
        ultimoTramite: d.tramites[0]
          ? { data: data(d.tramites[0].data), posicao: d.tramites[0].posicao, acao: d.tramites[0].acao, responsavel: d.tramites[0].responsavelAtual }
          : null,
        href: `/demandas/${d.id}`,
      })),
    }
  },
})

export const tramitesDaDemanda = definirFerramenta({
  descricao: 'Linha do tempo completa (trâmites) de uma demanda.',
  entrada: z.object({ demandaId: z.string().min(1) }),
  async executar({ demandaId }, { usuario }) {
    const demanda = await prisma.demanda.findUnique({
      where: { id: demandaId },
      select: {
        clienteId: true,
        assunto: true,
        tramites: {
          orderBy: { data: { sort: 'asc', nulls: 'first' } },
          select: { data: true, posicao: true, acao: true, observacao: true, responsavelAtual: true, dataRetorno: true, assinado: true },
        },
      },
    })
    if (!demanda || !(await podeVerCliente(usuario, demanda.clienteId))) return NAO_ENCONTRADO
    return {
      assunto: demanda.assunto,
      tramites: demanda.tramites.map((t) => ({
        data: data(t.data),
        posicao: t.posicao,
        acao: t.acao,
        observacao: t.observacao,
        responsavel: t.responsavelAtual,
        retorno: data(t.dataRetorno),
        assinado: t.assinado,
      })),
      href: `/demandas/${demandaId}`,
    }
  },
})

export const solicitacoes = definirFerramenta({
  descricao: 'Solicitações/chamados de TI (RDM, solicitação) de um cliente ou de todos: número, tipo, descrição, situação e datas.',
  entrada: z.object({
    clienteId: z.string().optional(),
    situacao: z.string().optional(),
    busca: z.string().optional(),
    limite: esquemaLimite,
  }),
  async executar({ clienteId, situacao, busca, limite }, { usuario }) {
    const filtro = await filtroDeClientes(usuario)
    const where: Prisma.SolicitacaoWhereInput = {
      AND: [
        filtro ? { clienteId: filtro } : {},
        clienteId ? { clienteId } : {},
        situacao ? { situacao: contem(situacao) } : {},
        busca ? { OR: [{ descricao: contem(busca) }, { numero: contem(busca) }, { tipo: contem(busca) }, { observacao: contem(busca) }] } : {},
      ],
    }
    const [total, lista] = await Promise.all([
      prisma.solicitacao.count({ where }),
      prisma.solicitacao.findMany({
        where,
        orderBy: { dataAbertura: { sort: 'desc', nulls: 'last' } },
        take: limite,
        select: {
          numero: true, tipo: true, descricao: true, situacao: true, dataAbertura: true, dataFinal: true, comVisita: true,
          observacao: true, cliente: { select: { nome: true } },
        },
      }),
    ])
    return {
      total,
      solicitacoes: lista.map((s) => ({
        cliente: s.cliente.nome,
        numero: s.numero,
        tipo: s.tipo,
        descricao: s.descricao,
        situacao: s.situacao,
        abertura: data(s.dataAbertura),
        final: data(s.dataFinal),
        comVisita: s.comVisita,
        observacao: s.observacao,
      })),
      href: '/solicitacoes',
    }
  },
})

export const fornecedores = definirFerramenta({
  descricao: 'Fornecedores (acordo, CNPJ, SEI), seus contratos de operacionalização (CO) e termos de confirmação com os clientes.',
  entrada: z.object({ busca: z.string().optional(), limite: esquemaLimite }),
  async executar({ busca, limite }, { usuario }) {
    const filtro = await filtroDeClientes(usuario)
    const lista = await prisma.fornecedor.findMany({
      where: busca ? { OR: [{ razaoSocial: contem(busca) }, { acordo: contem(busca) }, { cnpj: contem(busca) }] } : {},
      orderBy: { razaoSocial: 'asc' },
      take: limite,
      select: {
        id: true, razaoSocial: true, cnpj: true, contato: true, acordo: true, numeroAcordo: true, dataAssinatura: true, sei: true,
        contratosOperacionalizacao: { select: { numero: true, dataInicio: true, dataFim: true, valor: true, sei: true } },
        termosConfirmacao: {
          where: filtro ? { clienteId: filtro } : {},
          select: { numero: true, valor: true, vigenciaInicio: true, vigenciaFim: true, sei: true, cliente: { select: { nome: true } } },
        },
      },
    })
    return {
      total: lista.length,
      fornecedores: lista.map((f) => ({
        razaoSocial: f.razaoSocial,
        cnpj: f.cnpj,
        contato: f.contato,
        acordo: f.acordo,
        numeroAcordo: f.numeroAcordo,
        assinatura: data(f.dataAssinatura),
        sei: sei(f.sei),
        contratosOperacionalizacao: f.contratosOperacionalizacao.map((c) => ({ numero: c.numero, inicio: data(c.dataInicio), fim: data(c.dataFim), valor: moeda(c.valor), sei: sei(c.sei) })),
        termosConfirmacao: f.termosConfirmacao.map((t) => ({ cliente: t.cliente.nome, numero: t.numero, valor: moeda(t.valor), inicio: data(t.vigenciaInicio), fim: data(t.vigenciaFim), sei: sei(t.sei) })),
        href: `/fornecedores/${f.id}`,
      })),
    }
  },
})
