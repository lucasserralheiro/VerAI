import type { PrismaClient } from '@prisma/client'

// Contrato dos leitores por área (spec 2026-09-29-biblioteca-documentos-prodam §5.3): chamado uma vez
// por área quando algum arquivo dela entrou, mudou ou saiu. Grava os próprios dados e devolve a linha do
// log. Idempotente.

export interface ArquivoDaArea {
  id: string
  caminho: string
  nome: string
  extensao: string
  sha256: string
  modificadoEm: Date
}

export interface EntradaLeitor {
  prisma: PrismaClient
  /** Todos os arquivos ativos da área. */
  todos: ArquivoDaArea[]
  /** Ids dos arquivos que entraram ou mudaram nesta passada (de qualquer área). */
  mudados: string[]
  /** Releitura pedida (--reler): o leitor relê tudo, não só o que mudou. */
  releitura: boolean
  ler(arquivo: ArquivoDaArea): Promise<Buffer>
}

export type LeitorDeArea = (entrada: EntradaLeitor) => Promise<string>
