import type { ContratoOperacionalizacao, Fornecedor } from '@prisma/client'
import { z } from 'zod'
import { dataOpcional, decimalOpcional, textoObrigatorio, textoOpcional } from '@/lib/relatorios-clientes/validacao'

/** Corpo de criação/edição de `Fornecedor` — POST em `/api/fornecedores` e PATCH em
 *  `/api/fornecedores/[id]`. */
export const esquemaFornecedor = z.object({
  razaoSocial: textoObrigatorio,
  cnpj: textoOpcional,
  contato: textoOpcional,
  acordo: textoOpcional,
  numeroAcordo: textoOpcional,
  dataAssinatura: dataOpcional,
  sei: textoOpcional,
})

export const ROTULOS_FORNECEDOR = {
  razaoSocial: 'Razão social',
  dataAssinatura: 'Data de assinatura',
}

/** Corpo de criação/edição de `ContratoOperacionalizacao` — o `fornecedorId` vem da URL no POST e
 *  não muda no PATCH. A regra "fim ≥ início" fica nas rotas (`vigenciaInvalida`), porque no PATCH
 *  parcial uma das duas datas pode vir do registro já gravado. */
export const esquemaCo = z.object({
  numero: textoOpcional,
  dataInicio: dataOpcional,
  dataFim: dataOpcional,
  valor: decimalOpcional,
  sei: textoOpcional,
})

export const ROTULOS_CO = {
  dataInicio: 'Início da vigência',
  dataFim: 'Fim da vigência',
  valor: 'Valor',
}

export const ERRO_VIGENCIA = 'Fim da vigência: não pode ser antes do início'

export function vigenciaInvalida(inicio: Date | null | undefined, fim: Date | null | undefined): boolean {
  return !!inicio && !!fim && fim.getTime() < inicio.getTime()
}

export const SELECT_CO = {
  id: true,
  fornecedorId: true,
  numero: true,
  dataInicio: true,
  dataFim: true,
  valor: true,
  sei: true,
} as const

export const SELECT_FORNECEDOR = {
  id: true,
  razaoSocial: true,
  cnpj: true,
  contato: true,
  acordo: true,
  numeroAcordo: true,
  dataAssinatura: true,
  sei: true,
} as const

type CoSelecionado = Pick<ContratoOperacionalizacao, keyof typeof SELECT_CO>

/** `Decimal` sai como string no JSON (convenção das Tasks 3–8). */
export function serializarCo(co: CoSelecionado) {
  return { ...co, valor: co.valor === null ? null : co.valor.toString() }
}

export type FornecedorSelecionado = Pick<Fornecedor, keyof typeof SELECT_FORNECEDOR>
