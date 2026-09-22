// Definição única das abas da ficha do cliente (/clientes/[id]) — cada aba é o
// componente `aba-<nome>.tsx` correspondente.

import type { ComponentType } from 'react'
import { ClipboardList, FileSignature, FileText, Receipt, Truck, Users, type LucideIcon } from 'lucide-react'
import { AbaContratos } from './aba-contratos'
import { AbaDemandas } from './aba-demandas'
import { AbaDocumentos } from './aba-documentos'
import { AbaFaturamento } from './aba-faturamento'
import { AbaFornecedores } from './aba-fornecedores'
import { AbaResponsaveis } from './aba-responsaveis'

export interface PropsAba {
  clienteId: string
}

export const ABAS = [
  { id: 'documentos', label: 'Documentos', icon: FileText, Componente: AbaDocumentos },
  { id: 'contratos', label: 'Contratos', icon: FileSignature, Componente: AbaContratos },
  { id: 'faturamento', label: 'Faturamento', icon: Receipt, Componente: AbaFaturamento },
  { id: 'fornecedores', label: 'Fornecedores', icon: Truck, Componente: AbaFornecedores },
  { id: 'demandas', label: 'Demandas', icon: ClipboardList, Componente: AbaDemandas },
  { id: 'responsaveis', label: 'Responsáveis', icon: Users, Componente: AbaResponsaveis },
] as const satisfies ReadonlyArray<{ id: string; label: string; icon: LucideIcon; Componente: ComponentType<PropsAba> }>

export type IdAba = (typeof ABAS)[number]['id']

/** Aba aberta quando `?aba=` está ausente ou não bate com nenhuma aba. */
export const ABA_PADRAO: IdAba = 'documentos'

export function abaPorId(id: string | null) {
  return ABAS.find((aba) => aba.id === id) ?? ABAS.find((aba) => aba.id === ABA_PADRAO)!
}
