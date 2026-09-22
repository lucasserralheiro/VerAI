import { z } from 'zod'
import { emailOpcional, textoObrigatorio, textoOpcional } from '@/lib/relatorios-clientes/validacao'

/** Corpo de criação/edição de `ResponsavelCliente` — compartilhado pelo POST em
 *  `/api/clientes/[clienteId]/responsaveis` e pelo PATCH em `/api/responsaveis/[id]`. */
export const esquemaResponsavel = z.object({
  nome: textoObrigatorio,
  area: textoOpcional,
  email: emailOpcional,
  telefone: textoOpcional,
  celular: textoOpcional,
})
