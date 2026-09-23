import { EmDesenvolvimento } from '@/components/em-desenvolvimento'
import { ListaDocumentos } from './lista-documentos'

// Liberado em 2026-09-22. Flag preservada (não removida) pra poder voltar a
// esconder rapidamente se aparecer algum problema, sem precisar de deploy
// que mexa em mais nada.
const EM_DESENVOLVIMENTO = false

export default function DashboardPage() {
  if (!EM_DESENVOLVIMENTO) return <ListaDocumentos />
  return <EmDesenvolvimento titulo="Documentos" />
}
