import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { podeVerCliente } from '@/lib/visibilidade'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { SELECAO_ANEXOS } from '@/lib/relatorios-clientes/anexos-historico'
import { digitosDoSei } from '@/lib/relatorios-clientes/sei'
import { situacaoVencimento } from '@/lib/relatorios-clientes/vencimento'
import { SELECT_CONTRATO } from '@/app/api/contratos/esquema'
import {
  avisosDoContrato,
  data,
  definirFerramenta,
  esquemaLimite,
  filtroDeClientes,
  LIMITE_PADRAO,
  moeda,
  NAO_ENCONTRADO,
  resumirContrato,
  sei,
  type ContratoResumido,
} from './comum'
import { compactar, tabela } from './compacto'

export const detalheDoContrato = definirFerramenta({
  descricao:
    'Detalhe completo de UM contrato: cabeçalho, SEI, valor/saldo consolidados e a linha do tempo do histórico (contrato, aditivos, prorrogações, rescisão, prospecção) com objeto, proposta, valor e datas, e se os PDFs anexados podem ser lidos. Informe contratoId, ou o número (parcial) + clienteId.',
  entrada: z
    .object({
      contratoId: z.string().optional(),
      numero: z.string().optional().describe('número do termo, pode ser parcial, ex.: "031/2023"'),
      clienteId: z.string().optional(),
    })
    .refine((e) => e.contratoId || e.numero, 'informe contratoId ou numero'),
  async executar(entrada, { usuario, hoje }) {
    const filtro = await filtroDeClientes(usuario)
    const contratos = await prisma.contrato.findMany({
      where: {
        AND: [
          entrada.contratoId ? { id: entrada.contratoId } : { numeroTermo: { contains: entrada.numero!, mode: 'insensitive' } },
          entrada.clienteId ? { clienteId: entrada.clienteId } : {},
          filtro ? { clienteId: filtro } : {},
        ],
      },
      select: {
        ...SELECT_CONTRATO,
        cliente: { select: { nome: true } },
        _count: { select: { itens: true } },
        historico: {
          orderBy: [{ data: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true, tipo: true, numero: true, data: true, valor: true, objeto: true, proposta: true, situacao: true,
            dataInicio: true, dataVencimento: true, observacao: true,
            // PC/PA e TC/TA vêm do repositório (`propostaArquivo`/`termoArquivo`) — as colunas antigas
            // `propostaPdfNome`/`termoPdfNome` foram zeradas pela migração do repositório de arquivos.
            ...SELECAO_ANEXOS,
          },
        },
      },
      take: 5,
    })
    if (contratos.length === 0) return NAO_ENCONTRADO
    if (contratos.length > 1) {
      return { ambiguo: true, opcoes: contratos.map((c) => ({ id: c.id, numero: c.numeroTermo, cliente: c.cliente.nome })) }
    }
    const [contrato] = contratos
    const [consolidados, indices] = await Promise.all([
      consolidarContratos([contrato], hoje),
      prisma.indiceDocumento.findMany({
        where: { origem: { in: ['HISTORICO_PROPOSTA', 'HISTORICO_TERMO'] }, origemId: { in: contrato.historico.map((h) => h.id) } },
        select: { origem: true, origemId: true, status: true },
      }),
    ])
    const leitura = (origem: string, id: string) => indices.find((i) => i.origem === origem && i.origemId === id)?.status ?? 'nao_indexado'
    return {
      cliente: contrato.cliente.nome,
      ...resumirContrato(contrato, consolidados.get(contrato.id)!),
      historico: contrato.historico.map((h) => ({
        tipo: h.tipo,
        numero: h.numero,
        assinadoEm: data(h.data),
        valor: h.valor === null ? null : moeda(h.valor),
        objeto: h.objeto,
        proposta: h.proposta,
        situacao: h.situacao,
        inicio: data(h.dataInicio),
        vencimento: data(h.dataVencimento),
        observacao: h.observacao,
        pdfProposta: h.propostaArquivo ? { nome: h.propostaArquivo.nome, leitura: leitura('HISTORICO_PROPOSTA', h.id) } : null,
        pdfTermo: h.termoArquivo ? { nome: h.termoArquivo.nome, leitura: leitura('HISTORICO_TERMO', h.id) } : null,
      })),
      itens: contrato._count.itens,
    }
  },
  compactar(saida) {
    type Pdf = { nome: string; leitura: string } | null
    const r = saida as ContratoResumido & { historico?: (Record<string, unknown> & { pdfProposta: Pdf; pdfTermo: Pdf })[] }
    if (!r.historico) return compactar(saida)
    const { historico, situacaoDesatualizada, prorrogacaoEmAndamento, vencimento, ...cabecalho } = r
    const pdf = (p: Pdf) => (p ? `${p.nome} (${p.leitura})` : null)
    return [
      compactar({ ...cabecalho, avisos: avisosDoContrato({ situacaoDesatualizada, prorrogacaoEmAndamento, vencimento }) }),
      tabela('historico', historico.map((h) => ({ ...h, pdfProposta: pdf(h.pdfProposta), pdfTermo: pdf(h.pdfTermo) }))),
    ].join('\n')
  },
})

export const itensDoContrato = definirFerramenta({
  descricao: 'Itens de um contrato (descrição, quantidade, valor unitário e total). Use `busca` para filtrar pela descrição.',
  entrada: z.object({ contratoId: z.string().min(1), busca: z.string().optional(), limite: esquemaLimite }),
  async executar({ contratoId, busca, limite }, { usuario }) {
    const contrato = await prisma.contrato.findUnique({ where: { id: contratoId }, select: { clienteId: true } })
    if (!contrato || !(await podeVerCliente(usuario, contrato.clienteId))) return NAO_ENCONTRADO
    const where: Prisma.ItemContratoWhereInput = { contratoId, ...(busca ? { descricao: { contains: busca, mode: 'insensitive' } } : {}) }
    const [total, itens] = await Promise.all([
      prisma.itemContrato.count({ where }),
      prisma.itemContrato.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: limite,
        select: { descricao: true, quantidade: true, valorUnitario: true, valorTotal: true },
      }),
    ])
    return {
      total,
      itens: itens.map((i) => ({
        descricao: i.descricao,
        quantidade: i.quantidade === null ? null : i.quantidade.toString(),
        valorUnitario: i.valorUnitario === null ? null : moeda(i.valorUnitario),
        valorTotal: moeda(i.valorTotal),
      })),
    }
  },
})

export const contratosVencendo = definirFerramenta({
  descricao:
    'Contratos (de todos os clientes que o usuário vê, ou de um cliente) cujo fim de vigência efetivo cai até a data informada, os que vencem primeiro no topo. Não inclui rescindidos.',
  entrada: z.object({
    ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('data limite AAAA-MM-DD'),
    clienteId: z.string().optional(),
    incluirVencidos: z.boolean().default(false).describe('incluir os que já venceram'),
    limite: esquemaLimite.default(50),
  }),
  async executar({ ate, clienteId, incluirVencidos, limite }, { usuario, hoje }) {
    const filtro = await filtroDeClientes(usuario)
    const contratos = await prisma.contrato.findMany({
      where: { AND: [filtro ? { clienteId: filtro } : {}, clienteId ? { clienteId } : {}] },
      select: { ...SELECT_CONTRATO, cliente: { select: { nome: true } } },
    })
    const consolidados = await consolidarContratos(contratos, hoje)
    // Regra única de vencimento (dias de calendário em America/Sao_Paulo) vem de
    // situacaoVencimento/consolidarContratos — nunca recomputada a partir do Date bruto (senão um
    // contrato que vence HOJE fica excluído por horas da tarde, ou a virada de dia em UTC erra o
    // limite). `ate` (AAAA-MM-DD) vira "dias até `ate`" pela mesma função, com meio-dia UTC pra
    // cair no dia certo dentro de diaDoVencimento.
    const diasAte = situacaoVencimento(new Date(`${ate}T00:00:00Z`), hoje).dias!
    const lista = contratos
      .map((contrato) => ({ contrato, consolidado: consolidados.get(contrato.id)! }))
      .filter(({ consolidado: k }) => {
        if (k.vazio || k.rescindido || k.vencimento.dias === null) return false
        return k.vencimento.dias <= diasAte && (incluirVencidos || k.vencimento.dias >= 0)
      })
      .sort((a, b) => a.consolidado.vencimento.dias! - b.consolidado.vencimento.dias!)
    return {
      total: lista.length,
      contratos: lista.slice(0, limite).map(({ contrato, consolidado }) => ({
        cliente: contrato.cliente.nome,
        ...resumirContrato(contrato, consolidado),
      })),
    }
  },
  compactar(saida) {
    const r = saida as { total?: number; contratos?: (ContratoResumido & { cliente: string })[] }
    if (!r.contratos) return compactar(saida)
    return tabela(
      'contratos',
      r.contratos.map((c) => ({
        cliente: c.cliente, numero: c.numero, id: c.id, fim: c.fimVigencia, dias: c.diasParaVencer, valor: c.valorContratado, saldo: c.saldo,
        avisos: avisosDoContrato(c),
      })),
      { total: r.total }
    )
  },
})

interface OcorrenciaSei {
  tipo: 'contrato' | 'faturamento' | 'demanda' | 'fornecedor' | 'termo'
  id: string
  clienteId: string | null
  rotulo: string | null
  sei: string | null
}

function hrefDaOcorrencia(o: OcorrenciaSei): string {
  switch (o.tipo) {
    case 'contrato':
      return `/clientes/${o.clienteId}/contratos/${o.id}`
    case 'faturamento':
      return `/clientes/${o.clienteId}/faturamentos/${o.id}`
    case 'demanda':
      return `/demandas/${o.id}`
    case 'fornecedor':
      return `/fornecedores/${o.id}`
    case 'termo':
      return `/clientes/${o.clienteId}`
  }
}

const soDigitos = (coluna: Prisma.Sql) => Prisma.sql`regexp_replace(coalesce(${coluna}, ''), '[^0-9]', '', 'g')`

export const buscarPorSei = definirFerramenta({
  descricao: 'Onde um número de processo SEI aparece: contratos, faturamentos, demandas, fornecedores e termos de confirmação. Aceita o número com ou sem pontuação, inteiro ou parcial (6+ dígitos).',
  entrada: z.object({ numero: z.string().min(4) }),
  async executar({ numero }, { usuario }) {
    const digitos = digitosDoSei(numero)
    if (digitos.length < 6) return { erro: 'informe ao menos 6 dígitos do SEI' }
    const padrao = `%${digitos}%`
    const filtro = await filtroDeClientes(usuario)
    // Filtro de cliente DENTRO do SQL, antes do LIMIT: filtrar em JS depois do LIMIT 50 podia
    // esconder do usuário restrito um resultado que existe (empurrado pra fora dos 50 primeiros
    // por linhas de clientes que ele nem vê) — falso "não encontrado".
    const condCliente = filtro ? Prisma.sql`WHERE sub."clienteId" IS NULL OR sub."clienteId" IN (${Prisma.join(filtro.in)})` : Prisma.empty
    const linhas = await prisma.$queryRaw<OcorrenciaSei[]>(Prisma.sql`
      SELECT * FROM (
        SELECT 'contrato' AS tipo, c.id, c."clienteId", c."numeroTermo" AS rotulo, coalesce(c."seiCliente", c."seiProdam") AS sei
          FROM "Contrato" c WHERE ${soDigitos(Prisma.sql`c."seiCliente"`)} LIKE ${padrao} OR ${soDigitos(Prisma.sql`c."seiProdam"`)} LIKE ${padrao}
        UNION ALL
        SELECT 'faturamento', f.id, f."clienteId", concat(lpad(f."competenciaMes"::text, 2, '0'), '/', f."competenciaAno"), f.sei
          FROM "Faturamento" f WHERE ${soDigitos(Prisma.sql`f.sei`)} LIKE ${padrao}
        UNION ALL
        SELECT 'demanda', d.id, d."clienteId", d.assunto, d.sei
          FROM "Demanda" d WHERE ${soDigitos(Prisma.sql`d.sei`)} LIKE ${padrao}
        UNION ALL
        SELECT 'fornecedor', fo.id, NULL, fo."razaoSocial", fo.sei
          FROM "Fornecedor" fo WHERE ${soDigitos(Prisma.sql`fo.sei`)} LIKE ${padrao}
        UNION ALL
        SELECT 'termo', t.id, t."clienteId", t.numero, t.sei
          FROM "TermoConfirmacao" t WHERE ${soDigitos(Prisma.sql`t.sei`)} LIKE ${padrao}
      ) sub
      ${condCliente}
      LIMIT 50`)
    return {
      total: linhas.length,
      ocorrencias: linhas.slice(0, LIMITE_PADRAO).map((l) => ({ tipo: l.tipo, rotulo: l.rotulo, sei: sei(l.sei), href: hrefDaOcorrencia(l) })),
    }
  },
})
