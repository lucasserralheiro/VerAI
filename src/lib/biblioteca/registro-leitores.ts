import type { AreaBiblioteca } from './areas'
import type { LeitorDeArea } from './leitores'

/** Leitor de cada área da biblioteca Documentos. Área sem leitor: o arquivo só é guardado. */
export const LEITORES: Partial<Record<AreaBiblioteca, LeitorDeArea>> = {}
