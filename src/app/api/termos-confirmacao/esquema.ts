import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { dataOpcional, decimalOpcional, textoObrigatorio, textoOpcional } from '@/lib/relatorios-clientes/validacao'

const camposTermo = {
  contratoId: textoOpcional,
  contratoOperacionalizacaoId: textoOpcional,
  numero: textoOpcional,
  valor: decimalOpcional,
  vigenciaInicio: dataOpcional,
  vigenciaFim: dataOpcional,
  sei: textoOpcional,
  observacao: textoOpcional,
}

/** POST em `/api/termos-confirmacao`: fornecedor e cliente obrigatórios. */
export const esquemaNovoTermo = z.object({
  fornecedorId: textoObrigatorio,
  clienteId: textoObrigatorio,
  ...camposTermo,
})

/** PATCH em `/api/termos-confirmacao/[id]`: o termo não muda de cliente (o acesso é checado por
 *  ele); fornecedor pode ser trocado. */
export const esquemaEdicaoTermo = z.object({
  fornecedorId: textoObrigatorio.optional(),
  ...camposTermo,
})

export const ROTULOS_TERMO = {
  fornecedorId: 'Fornecedor',
  clienteId: 'Cliente',
  contratoId: 'Contrato',
  contratoOperacionalizacaoId: 'CO',
  valor: 'Valor',
  vigenciaInicio: 'Início da vigência',
  vigenciaFim: 'Fim da vigência',
}

export const SELECT_TERMO = {
  id: true,
  fornecedorId: true,
  clienteId: true,
  contratoId: true,
  contratoOperacionalizacaoId: true,
  numero: true,
  valor: true,
  vigenciaInicio: true,
  vigenciaFim: true,
  sei: true,
  observacao: true,
  fornecedor: { select: { id: true, razaoSocial: true } },
  cliente: { select: { id: true, nome: true, siglaLegado: true } },
  contrato: { select: { id: true, numeroTermo: true } },
  contratoOperacionalizacao: { select: { id: true, numero: true } },
} satisfies Prisma.TermoConfirmacaoSelect

type TermoSelecionado = Prisma.TermoConfirmacaoGetPayload<{ select: typeof SELECT_TERMO }>

/** `Decimal` sai como string no JSON (convenção das Tasks 3–8). */
export function serializarTermo(termo: TermoSelecionado) {
  return { ...termo, valor: termo.valor === null ? null : termo.valor.toString() }
}
