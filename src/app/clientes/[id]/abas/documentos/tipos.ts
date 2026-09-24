import type { CategoriaArquivo } from '@prisma/client'
import type { UsoArquivo } from '@/lib/arquivos/tipos'

export type { UsoArquivo } from '@/lib/arquivos/tipos'

/** Forma que GET /api/clientes/[clienteId]/arquivos devolve (sem `urlBlob`). */
export interface ArquivoRepositorio {
  id: string
  clienteId: string
  categoria: CategoriaArquivo
  nome: string
  extensao: string
  contentType: string
  tamanhoBytes: number
  sha256: string
  origem: 'upload' | 'gerado' | 'migrado' | 'sharepoint'
  createdAt: string
  enviadoPor: { nome: string } | null
  usos: UsoArquivo[]
}
