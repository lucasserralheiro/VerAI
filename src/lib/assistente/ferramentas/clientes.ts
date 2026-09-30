import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { podeVerCliente } from '@/lib/visibilidade'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { SELECT_CONTRATO } from '@/app/api/contratos/esquema'
import {
  avisosDoContrato,
  definirFerramenta,
  filtroDeClientes,
  LIMITE_PADRAO,
  moeda,
  NAO_ENCONTRADO,
  resumirContrato,
  semAcento,
  type ContratoResumido,
} from './comum'
import { compactar, emLinha, tabela } from './compacto'

export const buscarClientes = definirFerramenta({
  descricao:
    'Encontra clientes (secretarias/órgãos) pelo nome ou sigla, ex.: "smit", "saúde", "SMS". Use antes de qualquer outra ferramenta quando o usuário citar um cliente pelo nome.',
  entrada: z.object({ termo: z.string().min(1).max(100).describe('nome ou sigla, parcial') }),
  async executar({ termo }, { usuario }) {
    const filtro = await filtroDeClientes(usuario)
    const clientes = await prisma.cliente.findMany({
      where: filtro ? { id: filtro } : {},
      select: { id: true, nome: true, siglaLegado: true, _count: { select: { contratos: true } } },
      orderBy: { nome: 'asc' },
    })
    const alvo = semAcento(termo)
    const achados = clientes.filter((c) => semAcento(c.nome).includes(alvo) || semAcento(c.siglaLegado ?? '').includes(alvo))
    return {
      total: achados.length,
      clientes: achados.slice(0, LIMITE_PADRAO).map((c) => ({
        id: c.id,
        nome: c.nome,
        sigla: c.siglaLegado,
        contratos: c._count.contratos,
        href: `/clientes/${c.id}`,
      })),
    }
  },
})

export const resumoDoCliente = definirFerramenta({
  descricao:
    'Visão geral de um cliente: endereço, responsáveis, TODOS os contratos (número, SEI, ativo, vigência, valor, saldo, % faturado) e totais. Ponto de partida para "me fale tudo do cliente X". Serve para "como está o cliente", "situação", "carteira do cliente".',
  entrada: z.object({ clienteId: z.string().min(1) }),
  async executar({ clienteId }, { usuario, hoje }) {
    if (!(await podeVerCliente(usuario, clienteId))) return NAO_ENCONTRADO
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
      select: {
        id: true,
        nome: true,
        siglaLegado: true,
        endereco: true,
        numero: true,
        bairro: true,
        responsaveis: { select: { nome: true, area: true, email: true, telefone: true, celular: true } },
        contratos: { select: SELECT_CONTRATO },
        _count: { select: { demandas: true, solicitacoes: true, faturamentos: true } },
      },
    })
    if (!cliente) return NAO_ENCONTRADO
    const [consolidados, faturado] = await Promise.all([
      consolidarContratos(cliente.contratos, hoje),
      prisma.faturamento.aggregate({ where: { clienteId }, _sum: { valor: true } }),
    ])
    const contratos = cliente.contratos
      .map((contrato) => ({ contrato, consolidado: consolidados.get(contrato.id)! }))
      .filter(({ consolidado }) => !consolidado.vazio)
      .map(({ contrato, consolidado }) => resumirContrato(contrato, consolidado))
    return {
      id: cliente.id,
      nome: cliente.nome,
      sigla: cliente.siglaLegado,
      endereco: [cliente.endereco, cliente.numero, cliente.bairro].filter(Boolean).join(', ') || null,
      responsaveis: cliente.responsaveis,
      contratos,
      totais: {
        contratos: contratos.length,
        ativos: contratos.filter((c) => c.ativo).length,
        faturadoTotal: moeda(faturado._sum.valor),
        demandas: cliente._count.demandas,
        solicitacoes: cliente._count.solicitacoes,
        faturamentos: cliente._count.faturamentos,
      },
      href: `/clientes/${cliente.id}`,
    }
  },
  compactar(saida) {
    const r = saida as {
      id?: string
      nome?: string
      sigla?: string | null
      endereco?: string | null
      responsaveis?: Record<string, unknown>[]
      contratos?: ContratoResumido[]
      totais?: Record<string, unknown>
    }
    if (!r.contratos) return compactar(saida)
    const ativos = r.contratos.filter((c) => c.ativo)
    const encerrados = r.contratos.filter((c) => !c.ativo)
    return [
      `cliente: ${r.nome}${r.sigla ? ` (${r.sigla})` : ''} id: ${r.id}`,
      r.endereco ? `endereco: ${r.endereco}` : null,
      r.responsaveis?.length ? tabela('responsaveis', r.responsaveis) : null,
      tabela(
        'contratos ativos',
        ativos.map((c) => ({
          numero: c.numero, id: c.id, descricao: c.descricao, seiCliente: c.seiCliente, seiProdam: c.seiProdam, situacao: c.situacao,
          inicio: c.inicio, fim: c.fimVigencia, dias: c.diasParaVencer, valor: c.valorContratado, faturado: c.faturado, saldo: c.saldo,
          '%': c.percentualFaturado, aditivos: c.aditivos, prorrogacoes: c.prorrogacoes, avisos: avisosDoContrato(c),
        }))
      ),
      tabela('contratos encerrados', encerrados.map((c) => ({ numero: c.numero, id: c.id, situacao: c.situacao, fim: c.fimVigencia, valor: c.valorContratado }))),
      `totais: ${emLinha(r.totais)}`,
    ]
      .filter(Boolean)
      .join('\n')
  },
})
