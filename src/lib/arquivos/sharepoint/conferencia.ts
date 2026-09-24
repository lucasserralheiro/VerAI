// Conferência de cada execução (spec docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md
// §3.5 item 5): por cliente, os CAMINHOS válidos da biblioteca × os caminhos com estado ativo e arquivo
// ativo no VerAI. Por caminho, não por arquivo — o dedup junta dois caminhos com o mesmo conteúdo num
// arquivo só.

export interface LinhaConferencia {
  cliente: string
  noSharepoint: number
  noVerai: number
  faltando: string[]
}

export function conferir(esperados: Map<string, string>, gravados: Set<string>): LinhaConferencia[] {
  const porCliente = new Map<string, LinhaConferencia>()
  for (const [caminho, cliente] of esperados) {
    const linha = porCliente.get(cliente) ?? { cliente, noSharepoint: 0, noVerai: 0, faltando: [] }
    linha.noSharepoint++
    if (gravados.has(caminho)) linha.noVerai++
    else linha.faltando.push(caminho)
    porCliente.set(cliente, linha)
  }
  return [...porCliente.values()].sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR'))
}
