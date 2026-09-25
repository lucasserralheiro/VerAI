// Stub de teste: react-markdown é ESM puro. Renderiza o texto cru — os testes de componente
// verificam fluxo e estado, não a formatação do markdown.
export default function ReactMarkdown({ children }: { children?: string }) {
  return <div data-testid="markdown">{children}</div>
}

// Mesma regra do defaultUrlTransform do react-markdown: sem esquema, ou http(s)/irc(s)/mailto/xmpp.
export const defaultUrlTransform = (url: string) => {
  const doisPontos = url.indexOf(':')
  const relativo = doisPontos === -1 || [url.indexOf('?'), url.indexOf('#'), url.indexOf('/')].some((i) => i !== -1 && doisPontos > i)
  return relativo || /^(https?|ircs?|mailto|xmpp)$/i.test(url.slice(0, doisPontos)) ? url : ''
}
