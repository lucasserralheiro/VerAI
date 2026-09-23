import { EmDesenvolvimento } from '@/components/em-desenvolvimento'

// Liberado em 2026-09-22 (a página já tinha sido liberada em 2026-09-21, mas
// esta chave ficou ligada e continuava escondendo tudo). Mesmo tratamento que
// "Todos os documentos" (src/app/page.tsx): o aviso de `EmDesenvolvimento`
// ocupa o lugar do conteúdo, mantendo o cabeçalho da página. Pra liberar,
// troque pra false.
//
// Vive no layout da seção, e não em cada página, porque `/clientes`,
// `/clientes/[id]` e `/clientes/[id]/[competencia]` precisam ficar cobertas
// pela mesma chave — espalhar a condição pelas três deixaria uma delas
// alcançável pela URL no dia em que alguém esquecesse de replicar, e é por
// URL direta que se entra numa área que sumiu do menu.
const EM_DESENVOLVIMENTO = false

export default function ClientesLayout({ children }: { children: React.ReactNode }) {
  if (!EM_DESENVOLVIMENTO) return <>{children}</>
  return <EmDesenvolvimento titulo="Relatórios dos clientes" />
}
