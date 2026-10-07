// Definição única das abas da ficha do cliente (/clientes/[id]) — cada aba é o
// componente `aba-<nome>.tsx` correspondente. Id, rótulo e ícone vêm de `abas-meta.ts`
// (também usado pelo menu lateral).

import type { ComponentType } from 'react'
import { AbaContratos } from './aba-contratos'
import { AbaControle } from './aba-controle'
import { AbaDemandas } from './aba-demandas'
import { AbaDocumentos } from './aba-documentos'
import { AbaFaturamento } from './aba-faturamento'
import { AbaFornecedores } from './aba-fornecedores'
import { AbaResponsaveis } from './aba-responsaveis'
import { AbaSolicitacoes } from './aba-solicitacoes'
import { ABAS_META, ABA_PADRAO, type IdAba } from './abas-meta'

export { ABA_PADRAO, type IdAba }

export interface PropsAba {
  clienteId: string
}

const COMPONENTES: Record<IdAba, ComponentType<PropsAba>> = {
  documentos: AbaDocumentos,
  contratos: AbaContratos,
  faturamento: AbaFaturamento,
  controle: AbaControle,
  fornecedores: AbaFornecedores,
  demandas: AbaDemandas,
  solicitacoes: AbaSolicitacoes,
  responsaveis: AbaResponsaveis,
}

export const ABAS = ABAS_META.map((meta) => ({ ...meta, Componente: COMPONENTES[meta.id] }))

export function abaPorId(id: string | null) {
  return ABAS.find((aba) => aba.id === id) ?? ABAS.find((aba) => aba.id === ABA_PADRAO)!
}
