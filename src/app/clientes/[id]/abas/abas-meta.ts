// Metadados das abas da ficha do cliente (id, rótulo, ícone) — sem os componentes, para o menu lateral
// poder listar as abas do cliente aberto sem carregar o código de todas. `abas.tsx` junta cada uma ao
// seu componente; a ordem daqui é a ordem na ficha e no menu.

import { ClipboardList, FileSignature, FileText, Inbox, Receipt, ReceiptText, Truck, Users, type LucideIcon } from 'lucide-react'

export const ABAS_META = [
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'contratos', label: 'Contratos', icon: FileSignature },
  { id: 'faturamento', label: 'Faturamento', icon: Receipt },
  { id: 'controle', label: 'Controle do faturamento', icon: ReceiptText },
  { id: 'fornecedores', label: 'Fornecedores', icon: Truck },
  { id: 'demandas', label: 'Demandas', icon: ClipboardList },
  { id: 'solicitacoes', label: 'Solicitações', icon: Inbox },
  { id: 'responsaveis', label: 'Responsáveis', icon: Users },
] as const satisfies ReadonlyArray<{ id: string; label: string; icon: LucideIcon }>

export type IdAba = (typeof ABAS_META)[number]['id']

/** Aba aberta quando `?aba=` está ausente ou não bate com nenhuma aba. */
export const ABA_PADRAO: IdAba = 'documentos'
