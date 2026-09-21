import { EmDesenvolvimento } from '@/components/em-desenvolvimento'
import { ListaClientes } from './lista-clientes'

// Liberado em 2026-09-21. Flag preservada (não removida) pra poder voltar a
// esconder rapidamente se aparecer algum problema, sem precisar de deploy
// que mexa em mais nada.
const EM_DESENVOLVIMENTO = false

export default function ClientesPage() {
  if (!EM_DESENVOLVIMENTO) return <ListaClientes />
  return <EmDesenvolvimento titulo="Relatórios dos clientes" />
}
