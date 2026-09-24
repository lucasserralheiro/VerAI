'use client'

import Link from 'next/link'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { SeiLink } from '@/components/relatorios-clientes/sei-link'
import { LINK_NAVY } from '@/lib/ui'
import { destinoDoLink } from './links'

/** Componentes do markdown da resposta: tabela (GFM), link interno navega sem fechar o painel,
 *  SEI vira SeiLink, link externo só https e em outra aba, imagem NUNCA carrega — texto gerado
 *  por IA pode trazer uma URL de imagem só pra funcionar de rastreador (o `<img>` dispara a
 *  requisição sozinho, sem clique); vira o texto alternativo, ou nada.
 *  Exportado à parte (não só usado inline no `RespostaMarkdown`) porque o stub de teste do
 *  `react-markdown` (ESM, mapeado em `jest.config.ts`) não repassa `components` pra nada — dá pra
 *  testar o renderer de imagem direto, sem depender do stub. */
export const componentesMarkdown: Components = {
  a: ({ href, children }) => {
    const destino = destinoDoLink(href)
    if (destino.tipo === 'sei') return <SeiLink numero={destino.numero} />
    if (destino.tipo === 'interno') return <Link href={destino.href} className={LINK_NAVY}>{children}</Link>
    if (destino.tipo === 'externo') {
      return (
        <a href={destino.href} target="_blank" rel="noopener noreferrer" className={LINK_NAVY}>
          {children}
        </a>
      )
    }
    return <span>{children}</span>
  },
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table>{children}</table>
    </div>
  ),
  img: ({ alt }) => (alt ? <span>{alt}</span> : null),
}

/** Sem HTML cru (react-markdown não renderiza HTML por padrão). */
export function RespostaMarkdown({ texto }: { texto: string }) {
  return (
    <div className="prose-assistente space-y-2 text-sm leading-relaxed text-foreground [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border-grey [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border-grey [&_th]:bg-navy/[0.04] [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={componentesMarkdown}>
        {texto}
      </ReactMarkdown>
    </div>
  )
}
