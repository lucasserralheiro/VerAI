'use client'

import Link from 'next/link'
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { SeiLink } from '@/components/relatorios-clientes/sei-link'
import { LINK_NAVY } from '@/lib/ui'
import { RODAPE_GERAL, separarBlocos, TITULO_GERAL } from '@/lib/assistente/blocos'
import { destinoDoLink, ESQUEMA_PROPRIO } from './links'

/** O `urlTransform` padrão do react-markdown apaga qualquer esquema fora de http/mailto — `sei:` e
 *  `contrato:` chegavam vazios e o link virava texto. `destinoDoLink` valida o resto. */
export const transformarUrl = (url: string) => (ESQUEMA_PROPRIO.test(url) ? url : defaultUrlTransform(url))

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
    if (destino.tipo === 'aviso') return <span title="não confirmado no VerAI" className="text-orange">⚠</span>
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

const escaparRegex = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Acrescenta ⚠ (link `aviso:`) depois de cada ocorrência de número não confirmado. */
export function marcarNaoConfirmados(texto: string, naoConfirmados: string[] = []): string {
  return naoConfirmados.reduce((t, n) => (n ? t.replace(new RegExp(escaparRegex(n), 'g'), `${n} [⚠](aviso:nao-confirmado)`) : t), texto)
}

function Markdown({ texto }: { texto: string }) {
  return (
    <div className="prose-assistente space-y-2 text-sm leading-relaxed text-foreground [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border-grey [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border-grey [&_th]:bg-navy/[0.04] [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={componentesMarkdown} urlTransform={transformarUrl}>
        {texto}
      </ReactMarkdown>
    </div>
  )
}

/** Sem HTML cru (react-markdown não renderiza HTML por padrão). Blocos `:::geral` saem numa caixa
 *  à parte (conhecimento geral da IA, fora dos documentos); ⚠ só nos trechos do VerAI. */
export function RespostaMarkdown({ texto, naoConfirmados }: { texto: string; naoConfirmados?: string[] }) {
  return (
    <div className="space-y-2">
      {separarBlocos(texto).map((b, i) =>
        b.tipo === 'geral' ? (
          <aside key={i} className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm dark:border-sky-700 dark:bg-sky-950/40">
            <p className="mb-1 text-xs font-semibold text-sky-800 dark:text-sky-300">
              <span aria-hidden>🌐 </span>
              {TITULO_GERAL}
            </p>
            <Markdown texto={b.texto} />
            <p className="mt-1 text-xs text-sky-700 dark:text-sky-400">{RODAPE_GERAL}</p>
          </aside>
        ) : (
          <Markdown key={i} texto={marcarNaoConfirmados(b.texto, naoConfirmados)} />
        )
      )}
    </div>
  )
}
