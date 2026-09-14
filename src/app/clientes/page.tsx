import { EmDesenvolvimento } from '@/components/em-desenvolvimento'
import { ListaClientes } from './lista-clientes'

// A tela de relatórios dos clientes ainda não foi feita. Enquanto isso fica
// no lugar dela o aviso de "em desenvolvimento", pra ninguém achar que o que
// aparece aqui já é a funcionalidade. Pra liberar, troque pra false.
const EM_DESENVOLVIMENTO = true

export default function ClientesPage() {
  if (!EM_DESENVOLVIMENTO) return <ListaClientes />
  return <EmDesenvolvimento titulo="Relatórios dos clientes" />
}
