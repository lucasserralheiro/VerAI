import type { CategoriaArquivo } from '@prisma/client'
import type { UsoArquivo } from '@/lib/arquivos/tipos'

export type { UsoArquivo } from '@/lib/arquivos/tipos'

/** Forma que GET /api/clientes/[clienteId]/arquivos devolve (sem `urlBlob`). */
export interface ArquivoRepositorio {
  id: string
  clienteId: string
  contratoId: string | null
  competenciaAno: number | null
  competenciaMes: number | null
  categoria: CategoriaArquivo
  nome: string
  extensao: string
  contentType: string
  tamanhoBytes: number
  sha256: string
  origem: 'upload' | 'gerado' | 'migrado'
  createdAt: string
  enviadoPor: { nome: string } | null
  contrato: { id: string; numeroTermo: string | null } | null
  usos: UsoArquivo[]
}

export interface OpcaoContrato {
  id: string
  numeroTermo: string | null
}
