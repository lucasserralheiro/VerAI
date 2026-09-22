import { Prisma, TipoHistoricoContrato } from '@prisma/client'
import { z } from 'zod'
import {
  booleanoOpcional,
  dataOpcional,
  decimalOpcional,
  textoObrigatorio,
  textoOpcional,
} from '@/lib/relatorios-clientes/validacao'
import type { Saldo } from '@/lib/relatorios-clientes/saldo'
import { situacaoVencimento } from '@/lib/relatorios-clientes/vencimento'

// ---------------------------------------------------------------------------
// Contrato (cabeçalho)
// ---------------------------------------------------------------------------

/** POST em /api/clientes/[clienteId]/contratos e PATCH em /api/contratos/[id]. `numeroTermo` é
 *  obrigatório pela tela (o import aceita nulo). */
export const esquemaContrato = z.object({
  numeroTermo: textoObrigatorio,
  descricao: textoOpcional,
  seiCliente: textoOpcional,
  seiProdam: textoOpcional,
  situacao: textoOpcional,
  dataInicio: dataOpcional,
  dataVencimento: dataOpcional,
  vigente: booleanoOpcional,
  linkSei: textoOpcional,
})

export const ROTULOS_CONTRATO = {
  numeroTermo: 'Nº do termo',
  dataInicio: 'Início',
  dataVencimento: 'Vencimento',
}

export const SELECT_CONTRATO = {
  id: true,
  clienteId: true,
  numeroTermo: true,
  descricao: true,
  seiCliente: true,
  seiProdam: true,
  situacao: true,
  dataInicio: true,
  dataVencimento: true,
  vigente: true,
  linkSei: true,
} satisfies Prisma.ContratoSelect

type ContratoSelecionado = Prisma.ContratoGetPayload<{ select: typeof SELECT_CONTRATO }>

export function serializarContrato(contrato: ContratoSelecionado, saldo: Saldo, hoje = new Date()) {
  return { ...contrato, saldo, vencimento: situacaoVencimento(contrato.dataVencimento, hoje) }
}

// ---------------------------------------------------------------------------
// Histórico (linha do tempo única — design doc §3.5)
// ---------------------------------------------------------------------------

const camposHistorico = {
  numero: textoOpcional,
  data: dataOpcional,
  valor: decimalOpcional,
  objeto: textoOpcional,
  proposta: textoOpcional,
  situacao: textoOpcional,
  dataInicio: dataOpcional,
  dataVencimento: dataOpcional,
  dataEnvio: dataOpcional,
  observacao: textoOpcional,
}

const tipoHistorico = z.enum(TipoHistoricoContrato, { error: 'tipo inválido' })

export const esquemaNovoHistorico = z.object({ tipo: tipoHistorico, ...camposHistorico })
export const esquemaEdicaoHistorico = z.object({ tipo: tipoHistorico.optional(), ...camposHistorico })

export const ROTULOS_HISTORICO = {
  tipo: 'Tipo',
  data: 'Assinada em',
  valor: 'Valor',
  dataInicio: 'Início',
  dataVencimento: 'Vencimento',
  dataEnvio: 'Envio',
}

export const SELECT_HISTORICO = {
  id: true,
  contratoId: true,
  tipo: true,
  numero: true,
  data: true,
  valor: true,
  objeto: true,
  proposta: true,
  situacao: true,
  dataInicio: true,
  dataVencimento: true,
  dataEnvio: true,
  observacao: true,
} satisfies Prisma.HistoricoContratoSelect

type HistoricoSelecionado = Prisma.HistoricoContratoGetPayload<{ select: typeof SELECT_HISTORICO }>

export function serializarHistorico(linha: HistoricoSelecionado) {
  return { ...linha, valor: linha.valor?.toString() ?? null }
}

// ---------------------------------------------------------------------------
// Itens do contrato
// ---------------------------------------------------------------------------

const camposItem = {
  descricao: textoOpcional,
  quantidade: decimalOpcional,
  valorUnitario: decimalOpcional,
  valorTotal: decimalOpcional,
}

export const esquemaNovoItem = z.object(camposItem)
/** No PATCH o item pode ser (re)vinculado a um contrato — é a reconciliação dos itens importados
 *  sem vínculo. `null`/`''` desvincula. */
export const esquemaEdicaoItem = z.object({ ...camposItem, contratoId: textoOpcional })

export const ROTULOS_ITEM = {
  descricao: 'Descrição',
  quantidade: 'Quantidade',
  valorUnitario: 'Valor unitário',
  valorTotal: 'Valor total',
  contratoId: 'Contrato',
}

export const ERRO_VALOR_TOTAL = 'Valor total: campo obrigatório (ou informe quantidade e valor unitário)'

/** `valorTotal` informado vence; senão, `quantidade × valorUnitario` quando os dois vierem (em
 *  centavos, pra não perder precisão); senão `null`. */
export function valorTotalDoItem(dados: {
  quantidade?: string | null
  valorUnitario?: string | null
  valorTotal?: string | null
}): string | null {
  if (dados.valorTotal) return dados.valorTotal
  if (!dados.quantidade || !dados.valorUnitario) return null
  return new Prisma.Decimal(dados.quantidade).times(dados.valorUnitario).toDecimalPlaces(2).toString()
}

export const SELECT_ITEM = {
  id: true,
  contratoId: true,
  contratoTextoLegado: true,
  descricao: true,
  quantidade: true,
  valorUnitario: true,
  valorTotal: true,
} satisfies Prisma.ItemContratoSelect

type ItemSelecionado = Prisma.ItemContratoGetPayload<{ select: typeof SELECT_ITEM }>

export function serializarItem(item: ItemSelecionado) {
  return {
    ...item,
    quantidade: item.quantidade?.toString() ?? null,
    valorUnitario: item.valorUnitario?.toString() ?? null,
    valorTotal: item.valorTotal.toString(),
  }
}
