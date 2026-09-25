import type { Prisma } from '@prisma/client'

import type { AuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { chaveExata } from '@/lib/relatorios-clientes/vincular-itens'
import { getUpload } from '@/lib/storage'
import { clienteIdsPermitidos } from '@/lib/visibilidade'

import { avisoDeVigencia, escolherDocumentos, type LinhaDoHistorico } from './documentos-do-contrato'
import { identidadeDoContrato } from './identidade'
import { competenciaDaData, lerCabecalhoDoLevantamento, LevantamentoIlegivel } from './levantamento'
import { localizarContrato, type ContratoParaBusca } from './localizar-contrato'
import type {
  Competencia,
  DocumentoDoCadastro,
  DocumentosDoContrato,
  RespostaDaIdentificacao,
  ResumoDoContrato,
} from './tipos-cadastro'

// O lado do banco de "o levantamento busca o contrato" (docs/superpowers/specs/2026-09-25-confere-
// contrato-do-cadastro-design.md): acha o contrato entre os que a pessoa pode ver, resume pelo
// `consolidarContratos()` (regra única de contrato — CLAUDE.md) e carrega o histórico para a regra de
// escolha. Só leitura; `carregarArquivosDoCadastro` baixa os PDFs pedidos na geração.

const SELECAO_CONTRATO = {
  id: true,
  clienteId: true,
  numeroTermo: true,
  chaveSharepoint: true,
  descricao: true,
  situacao: true,
  dataInicio: true,
  dataVencimento: true,
  cliente: { select: { nome: true, siglaLegado: true } },
} satisfies Prisma.ContratoSelect

type ContratoCarregado = Prisma.ContratoGetPayload<{ select: typeof SELECAO_CONTRATO }>

const SELECAO_LINHA = {
  id: true,
  tipo: true,
  numero: true,
  data: true,
  dataInicio: true,
  dataVencimento: true,
  situacao: true,
  proposta: true,
  createdAt: true,
  propostaArquivo: { select: { id: true, nome: true, removidoEm: true } },
} satisfies Prisma.HistoricoContratoSelect

const MAXIMO_DE_SUGESTOES = 12
const MAXIMO_DA_BUSCA = 20

async function filtroDeClientes(usuario: AuthUser): Promise<Prisma.ContratoWhereInput> {
  const ids = await clienteIdsPermitidos(usuario)
  return ids === null ? {} : { clienteId: { in: ids } }
}

function paraBusca(contrato: ContratoCarregado): ContratoParaBusca {
  return {
    id: contrato.id,
    clienteId: contrato.clienteId,
    clienteNome: contrato.cliente.nome,
    clienteSigla: contrato.cliente.siglaLegado,
    numeroTermo: contrato.numeroTermo,
    chaveSharepoint: contrato.chaveSharepoint,
  }
}

function iso(data: Date | null | undefined): string | null {
  return data ? data.toISOString().slice(0, 10) : null
}

/** Número, cliente, vigência e se está ativo — sempre pelo `consolidarContratos()`. */
async function resumir(contratos: ContratoCarregado[]): Promise<ResumoDoContrato[]> {
  if (contratos.length === 0) return []
  const consolidados = await consolidarContratos(
    contratos.map((c) => ({ id: c.id, situacao: c.situacao, dataVencimento: c.dataVencimento }))
  )
  return contratos.map((c) => ({
    id: c.id,
    clienteId: c.clienteId,
    clienteNome: c.cliente.nome,
    clienteSigla: c.cliente.siglaLegado,
    numeroTermo: c.numeroTermo,
    descricao: c.descricao,
    vigenciaFim: iso(consolidados.get(c.id)?.vigenciaFim),
    ativo: consolidados.get(c.id)?.ativo ?? false,
  }))
}

/** Ativos primeiro; depois pelo número do termo. */
function porNumero(a: ResumoDoContrato, b: ResumoDoContrato): number {
  return (
    Number(b.ativo) - Number(a.ativo) ||
    (a.numeroTermo ?? '').localeCompare(b.numeroTermo ?? '', 'pt-BR', { numeric: true })
  )
}

/** As propostas do cliente fora do histórico deste contrato — para o contrato sem nenhuma (§6.3). */
async function propostasSoltas(clienteId: string, jaListadas: DocumentoDoCadastro[]): Promise<DocumentoDoCadastro[]> {
  const listadas = new Set(jaListadas.map((d) => d.arquivoId))
  const arquivos = await prisma.arquivoCliente.findMany({
    where: {
      clienteId,
      removidoEm: null,
      extensao: 'pdf',
      categoria: { in: ['PROPOSTA_COMERCIAL', 'PROPOSTA_ADITIVO'] },
    },
    select: { id: true, nome: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  return arquivos.filter((a) => !listadas.has(a.id)).map((a) => ({ arquivoId: a.id, nome: a.nome, origem: null }))
}

async function carregarDocumentos(
  contrato: ContratoCarregado,
  competencia: Competencia,
  lidaDaPlanilha: boolean
): Promise<DocumentosDoContrato> {
  const [brutas, [resumo]] = await Promise.all([
    prisma.historicoContrato.findMany({ where: { contratoId: contrato.id }, select: SELECAO_LINHA }),
    resumir([contrato]),
  ])
  const linhas: LinhaDoHistorico[] = brutas.map(({ propostaArquivo, ...linha }) => ({
    ...linha,
    pdf: propostaArquivo && !propostaArquivo.removidoEm ? { arquivoId: propostaArquivo.id, nome: propostaArquivo.nome } : null,
  }))
  const escolha = escolherDocumentos(linhas, competencia)
  const inicio = contrato.dataInicio ?? linhas.find((l) => l.tipo === 'CONTRATO')?.dataInicio ?? null
  const vigenciaFim = resumo.vigenciaFim ? new Date(`${resumo.vigenciaFim}T00:00:00Z`) : null
  const vigencia = avisoDeVigencia(competencia, { vigenciaFim, inicio }, linhas)
  const alternativas = escolha.base
    ? escolha.alternativas
    : [...escolha.alternativas, ...(await propostasSoltas(contrato.clienteId, escolha.alternativas))]
  return {
    contrato: resumo,
    competencia: { ...competencia, lidaDaPlanilha },
    base: escolha.base,
    aditivos: escolha.aditivos,
    alternativas,
    decisoes: escolha.decisoes,
    avisos: vigencia ? [...escolha.avisos, vigencia] : escolha.avisos,
  }
}

/** Sem "Data do Levantamento", a competência de referência é o mês atual (desenho §6.5). */
export function competenciaAtual(hoje: Date = new Date()): Competencia {
  return { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 }
}

/** Contrato escolhido à mão (empate, sugestão, "trocar contrato"). `null` quando não existe ou é de
 *  cliente que a pessoa não vê. */
export async function documentosDoContrato(
  usuario: AuthUser,
  contratoId: string,
  competencia: Competencia,
  lidaDaPlanilha: boolean
): Promise<DocumentosDoContrato | null> {
  const contrato = await prisma.contrato.findFirst({
    where: { id: contratoId, ...(await filtroDeClientes(usuario)) },
    select: SELECAO_CONTRATO,
  })
  return contrato ? carregarDocumentos(contrato, competencia, lidaDaPlanilha) : null
}

export async function identificarLevantamento(
  usuario: AuthUser,
  conteudo: ArrayBuffer | Uint8Array,
  hoje: Date = new Date()
): Promise<RespostaDaIdentificacao> {
  let cabecalho
  try {
    cabecalho = await lerCabecalhoDoLevantamento(conteudo)
  } catch (erro) {
    if (erro instanceof LevantamentoIlegivel) return { situacao: 'ilegivel', mensagem: erro.message }
    throw erro
  }
  const competenciaLida = competenciaDaData(cabecalho.dataLevantamento)
  const leitura = { referencia: cabecalho.contratoReferencia, competencia: competenciaLida }
  const identidade = identidadeDoContrato(cabecalho.contratoReferencia, cabecalho.titulo)
  if (!identidade) return { situacao: 'sem-referencia', leitura }

  const contratos = await prisma.contrato.findMany({ where: await filtroDeClientes(usuario), select: SELECAO_CONTRATO })
  const porId = new Map(contratos.map((c) => [c.id, c]))
  const carregados = (lista: ContratoParaBusca[]) => lista.map((c) => porId.get(c.id)!)
  const resultado = localizarContrato(identidade, contratos.map(paraBusca))

  if (resultado.tipo === 'encontrado') {
    const documentos = await carregarDocumentos(
      porId.get(resultado.contrato.id)!,
      competenciaLida ?? competenciaAtual(hoje),
      competenciaLida !== null
    )
    return { situacao: 'encontrado', leitura, documentos }
  }
  if (resultado.tipo === 'ambiguo') {
    return { situacao: 'ambiguo', leitura, candidatos: (await resumir(carregados(resultado.candidatos))).sort(porNumero) }
  }
  const doOrgao = new Set(resultado.doOrgao.map((c) => c.id))
  const outros = resultado.mesmoNumero.filter((c) => !doOrgao.has(c.id))
  const resumos = await resumir(carregados([...resultado.doOrgao, ...outros]))
  const sugestoes = [
    ...resumos.filter((r) => doOrgao.has(r.id) && r.ativo).sort(porNumero),
    ...resumos.filter((r) => !doOrgao.has(r.id)).sort(porNumero),
  ]
  return { situacao: 'nao-encontrado', leitura, sugestoes: sugestoes.slice(0, MAXIMO_DE_SUGESTOES) }
}

/** Busca livre (desenho §6.4): cada palavra digitada casa com o começo de alguma palavra do número,
 *  da sigla, do nome do cliente ou da descrição. */
export async function buscarContratos(usuario: AuthUser, texto: string): Promise<ResumoDoContrato[]> {
  const termos = (chaveExata(texto) ?? '').split(' ').filter(Boolean)
  if (termos.length === 0) return []
  const contratos = await prisma.contrato.findMany({ where: await filtroDeClientes(usuario), select: SELECAO_CONTRATO })
  const achados = contratos.filter((c) => {
    const palavras = (
      chaveExata(
        [c.numeroTermo, c.chaveSharepoint?.replace('|', ' '), c.cliente.siglaLegado, c.cliente.nome, c.descricao]
          .filter(Boolean)
          .join(' ')
      ) ?? ''
    ).split(' ')
    return termos.every((termo) => palavras.some((palavra) => palavra.startsWith(termo)))
  })
  return (await resumir(achados)).sort(porNumero).slice(0, MAXIMO_DA_BUSCA)
}

export class ArquivoDoCadastroRecusado extends Error {
  constructor(
    mensagem: string,
    readonly status: number
  ) {
    super(mensagem)
  }
}

export interface ArquivoBaixado {
  nome: string
  bytes: Buffer
}

/** O contrato informado na geração, se a pessoa pode vê-lo. */
export async function contratoDoUsuario(
  usuario: AuthUser,
  contratoId: string
): Promise<{ id: string; clienteId: string } | null> {
  return prisma.contrato.findFirst({
    where: { id: contratoId, ...(await filtroDeClientes(usuario)) },
    select: { id: true, clienteId: true },
  })
}

/** Os PDFs do cadastro pedidos na geração, conferidos e baixados do storage (R2). Com `clienteId` (o
 *  do contrato escolhido), arquivo de outro cliente é recusado. Arquivo de cliente sem permissão é
 *  tratado como inexistente — a mensagem não revela o nome. */
export async function carregarArquivosDoCadastro(
  usuario: AuthUser,
  ids: string[],
  clienteId: string | null
): Promise<Map<string, ArquivoBaixado>> {
  const unicos = [...new Set(ids)]
  if (unicos.length === 0) return new Map()
  const [arquivos, permitidos] = await Promise.all([
    prisma.arquivoCliente.findMany({
      where: { id: { in: unicos } },
      select: { id: true, clienteId: true, nome: true, extensao: true, urlBlob: true, removidoEm: true },
    }),
    clienteIdsPermitidos(usuario),
  ])
  const porId = new Map(arquivos.map((a) => [a.id, a]))
  for (const id of unicos) {
    const arquivo = porId.get(id)
    if (!arquivo || (permitidos !== null && !permitidos.includes(arquivo.clienteId))) {
      throw new ArquivoDoCadastroRecusado('Um dos arquivos do cadastro não existe mais — busque o contrato de novo.', 404)
    }
    if (arquivo.removidoEm) {
      throw new ArquivoDoCadastroRecusado(
        `O arquivo ${arquivo.nome} foi removido do cadastro — busque o contrato de novo ou envie do computador.`,
        409
      )
    }
    if (arquivo.extensao !== 'pdf') throw new ArquivoDoCadastroRecusado(`O arquivo ${arquivo.nome} não é PDF.`, 400)
    if (clienteId && arquivo.clienteId !== clienteId) {
      throw new ArquivoDoCadastroRecusado(`O arquivo ${arquivo.nome} é de outro cliente.`, 400)
    }
  }
  const baixados = await Promise.all(
    unicos.map(async (id): Promise<[string, ArquivoBaixado]> => {
      const arquivo = porId.get(id)!
      try {
        return [id, { nome: arquivo.nome, bytes: await getUpload(arquivo.urlBlob) }]
      } catch {
        throw new ArquivoDoCadastroRecusado(
          `Não foi possível ler a proposta ${arquivo.nome} do cadastro — tente de novo ou envie o arquivo do computador.`,
          502
        )
      }
    })
  )
  return new Map(baixados)
}
