import { EmDesenvolvimento } from '@/components/em-desenvolvimento'
import { ListaDocumentos } from './lista-documentos'

// A tela "Todos os documentos" ainda não foi feita. Enquanto isso fica no
// lugar dela o aviso de "em desenvolvimento", pra ninguém achar que o que
// aparece aqui já é a funcionalidade. Pra liberar, troque pra false.
const EM_DESENVOLVIMENTO = true

export default function DashboardPage() {
  if (!EM_DESENVOLVIMENTO) return <ListaDocumentos />
  return <EmDesenvolvimento titulo="Documentos" />
}
