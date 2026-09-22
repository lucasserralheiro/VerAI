import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  booleanoOpcional,
  dataObrigatoria,
  dataOpcional,
  textoObrigatorio,
  textoOpcional,
} from '@/lib/relatorios-clientes/validacao'

/** Quantos valores distintos cada `<datalist>` de sugestão recebe (os mais usados primeiro). */
const LIMITE_SUGESTOES = 30

/** `situacao`, `tipo`, `posicao`, `acao`... seguem texto livre (os dados importados têm formatos
 *  variados); a tela oferece como sugestão os valores que já existem no banco — resolve o minor da
 *  Task 1 sobre valores enum-like sem documentação. */
function valoresMaisUsados(grupos: Array<Record<string, unknown>>, campo: string): string[] {
  return grupos.map((grupo) => grupo[campo]).filter((valor): valor is string => typeof valor === 'string' && valor.trim() !== '')
}

// ---------------------------------------------------------------------------
// Demanda
// ---------------------------------------------------------------------------

const camposDemanda = {
  tipoAssunto: textoOpcional,
  tipo: textoOpcional,
  responsavel: textoOpcional,
  situacao: textoOpcional,
  dataAbertura: dataOpcional,
  documento: textoOpcional,
  sei: textoOpcional,
}

export const esquemaNovaDemanda = z.object({ clienteId: textoObrigatorio, assunto: textoObrigatorio, ...camposDemanda })

/** No PATCH o cliente pode ser trocado — é como se corrige uma demanda que o import atribuiu à SMS. */
export const esquemaEdicaoDemanda = z.object({
  clienteId: textoObrigatorio.optional(),
  assunto: textoObrigatorio.optional(),
  ...camposDemanda,
})

export const ROTULOS_DEMANDA = {
  clienteId: 'Cliente',
  assunto: 'Assunto',
  dataAbertura: 'Data de abertura',
}

export const SELECT_DEMANDA = {
  id: true,
  clienteId: true,
  assunto: true,
  tipoAssunto: true,
  tipo: true,
  responsavel: true,
  situacao: true,
  dataAbertura: true,
  documento: true,
  sei: true,
  notaImportacao: true,
  cliente: { select: { id: true, nome: true, siglaLegado: true } },
} satisfies Prisma.DemandaSelect

export async function sugestoesDemanda() {
  const [situacao, tipo, tipoAssunto, responsavel] = await Promise.all([
    prisma.demanda.groupBy({ by: ['situacao'], _count: { situacao: true }, orderBy: { _count: { situacao: 'desc' } }, take: LIMITE_SUGESTOES }),
    prisma.demanda.groupBy({ by: ['tipo'], _count: { tipo: true }, orderBy: { _count: { tipo: 'desc' } }, take: LIMITE_SUGESTOES }),
    prisma.demanda.groupBy({ by: ['tipoAssunto'], _count: { tipoAssunto: true }, orderBy: { _count: { tipoAssunto: 'desc' } }, take: LIMITE_SUGESTOES }),
    prisma.demanda.groupBy({ by: ['responsavel'], _count: { responsavel: true }, orderBy: { _count: { responsavel: 'desc' } }, take: LIMITE_SUGESTOES }),
  ])
  return {
    situacao: valoresMaisUsados(situacao, 'situacao'),
    tipo: valoresMaisUsados(tipo, 'tipo'),
    tipoAssunto: valoresMaisUsados(tipoAssunto, 'tipoAssunto'),
    responsavel: valoresMaisUsados(responsavel, 'responsavel'),
  }
}

// ---------------------------------------------------------------------------
// Trâmite da demanda
// ---------------------------------------------------------------------------

const camposTramite = {
  posicao: textoOpcional,
  acao: textoOpcional,
  observacao: textoOpcional,
  responsavelAtual: textoOpcional,
  dataRetorno: dataOpcional,
  comApresentacao: booleanoOpcional,
  assinado: booleanoOpcional,
}

export const esquemaNovoTramite = z.object({ data: dataObrigatoria, ...camposTramite })
export const esquemaEdicaoTramite = z.object({ data: dataObrigatoria.optional(), ...camposTramite })

export const ROTULOS_TRAMITE = {
  data: 'Desde',
  dataRetorno: 'Retorno',
}

export const SELECT_TRAMITE = {
  id: true,
  demandaId: true,
  data: true,
  posicao: true,
  acao: true,
  observacao: true,
  responsavelAtual: true,
  dataRetorno: true,
  comApresentacao: true,
  assinado: true,
} satisfies Prisma.TramiteDemandaSelect

export async function sugestoesTramite() {
  const [responsavelAtual, acao] = await Promise.all([
    prisma.tramiteDemanda.groupBy({
      by: ['responsavelAtual'],
      _count: { responsavelAtual: true },
      orderBy: { _count: { responsavelAtual: 'desc' } },
      take: LIMITE_SUGESTOES,
    }),
    prisma.tramiteDemanda.groupBy({ by: ['acao'], _count: { acao: true }, orderBy: { _count: { acao: 'desc' } }, take: LIMITE_SUGESTOES }),
  ])
  return {
    responsavelAtual: valoresMaisUsados(responsavelAtual, 'responsavelAtual'),
    // Ação e posição são frases longas na origem; só as curtas servem de sugestão.
    acao: valoresMaisUsados(acao, 'acao').filter((valor) => valor.length <= 60),
  }
}

// ---------------------------------------------------------------------------
// Solicitação
// ---------------------------------------------------------------------------

const camposSolicitacao = {
  tipo: textoOpcional,
  numero: textoOpcional,
  situacao: textoOpcional,
  dataAbertura: dataOpcional,
  dataFinal: dataOpcional,
  comVisita: booleanoOpcional,
  observacao: textoOpcional,
}

export const esquemaNovaSolicitacao = z.object({ clienteId: textoObrigatorio, descricao: textoObrigatorio, ...camposSolicitacao })
export const esquemaEdicaoSolicitacao = z.object({
  clienteId: textoObrigatorio.optional(),
  descricao: textoObrigatorio.optional(),
  ...camposSolicitacao,
})

export const ROTULOS_SOLICITACAO = {
  clienteId: 'Cliente',
  descricao: 'Assunto',
  numero: 'Nº do chamado',
  dataAbertura: 'Abertura',
  dataFinal: 'Conclusão',
}

export const SELECT_SOLICITACAO = {
  id: true,
  clienteId: true,
  tipo: true,
  numero: true,
  descricao: true,
  situacao: true,
  dataAbertura: true,
  dataFinal: true,
  comVisita: true,
  observacao: true,
  cliente: { select: { id: true, nome: true, siglaLegado: true } },
} satisfies Prisma.SolicitacaoSelect

export async function sugestoesSolicitacao() {
  const [tipo, situacao] = await Promise.all([
    prisma.solicitacao.groupBy({ by: ['tipo'], _count: { tipo: true }, orderBy: { _count: { tipo: 'desc' } }, take: LIMITE_SUGESTOES }),
    prisma.solicitacao.groupBy({ by: ['situacao'], _count: { situacao: true }, orderBy: { _count: { situacao: 'desc' } }, take: LIMITE_SUGESTOES }),
  ])
  return { tipo: valoresMaisUsados(tipo, 'tipo'), situacao: valoresMaisUsados(situacao, 'situacao') }
}
