/** Sobe um arquivo do navegador direto pro Cloudflare R2: pede o link de envio à `rota` (que confere
 *  login, tipo e tamanho) e faz o PUT nele. Devolve o endereço `r2:…` pra mandar à rota que processa o
 *  arquivo — o binário nunca passa por função da Vercel, que recusa corpo acima de 4,5 MB. Substitui o
 *  `upload()` do Vercel Blob, suspenso por cota desde 24/09/2026. */
export async function enviarParaR2(arquivo: File, rota: string): Promise<string> {
  const pedido = await fetch(rota, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: arquivo.name, tamanhoBytes: arquivo.size }),
  })
  const link = (await pedido.json().catch(() => null)) as {
    url?: string
    endereco?: string
    contentType?: string
    error?: string
  } | null
  if (!pedido.ok || !link?.url || !link.endereco) {
    throw new Error(link?.error ?? `Falha ao preparar o envio de "${arquivo.name}".`)
  }

  // O link amarra o tipo: o Content-Type tem que ser exatamente o que a rota assinou.
  let envio: Response
  try {
    envio = await fetch(link.url, { method: 'PUT', headers: { 'Content-Type': link.contentType ?? '' }, body: arquivo })
  } catch {
    // Erro de rede aqui é quase sempre o bucket sem CORS pra esta origem.
    throw new Error(`Não foi possível enviar "${arquivo.name}" para o armazenamento.`)
  }
  if (!envio.ok) throw new Error(`O armazenamento recusou "${arquivo.name}" (${envio.status}).`)
  return link.endereco
}
