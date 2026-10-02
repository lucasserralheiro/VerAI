import type { PapelGerencia } from './permissao'

export interface GerenciaResumo {
  id: string
  nome: string
  sigla: string | null
  ativa: boolean
  clientes: number
  managers: string[]
}
export interface MembroSerializado {
  usuarioId: string
  nome: string
  email: string
  papel: PapelGerencia
}
export interface ClienteCarteira {
  id: string
  nome: string
  siglaLegado: string | null
}
export interface MovimentoSerializado {
  id: string
  cliente: string
  de: string | null
  para: string | null
  por: string | null
  em: string
}
export interface GerenciaDetalhe extends GerenciaResumo {
  carteira: ClienteCarteira[]
  membros: MembroSerializado[]
  movimentos: MovimentoSerializado[]
}

export class ErroGerencia extends Error {
  constructor(mensagem: string, readonly status: 400 | 404 | 409) {
    super(mensagem)
    this.name = 'ErroGerencia'
  }
}
