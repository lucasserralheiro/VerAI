import { lerCalendarioDeFaturamento } from '@/lib/calendario/leitor'
import { lerControlesDeContratos } from '@/lib/controles-contratos/leitor'
import { lerLinksMpls } from '@/lib/links-mpls/leitor'
import { lerPlanilhaDeContratosArea } from '@/lib/planilha-contratos/leitor'
import { lerTabelaDePrecos } from '@/lib/tabela-precos/leitor'
import type { AreaBiblioteca } from './areas'
import type { LeitorDeArea } from './leitores'

/** Leitor de cada área da biblioteca Documentos. Área sem leitor: o arquivo só é guardado. */
export const LEITORES: Partial<Record<AreaBiblioteca, LeitorDeArea>> = {
  TABELA_PRECOS: lerTabelaDePrecos,
  CONTROLES_CONTRATOS: lerControlesDeContratos,
  PLANILHA_CONTRATOS: lerPlanilhaDeContratosArea,
  LINKS_MPLS: lerLinksMpls,
  CALENDARIO: lerCalendarioDeFaturamento,
}
