// Stub de teste: react-markdown é ESM puro. Renderiza o texto cru — os testes de componente
// verificam fluxo e estado, não a formatação do markdown.
export default function ReactMarkdown({ children }: { children?: string }) {
  return <div data-testid="markdown">{children}</div>
}
