/** SHA-256 (hex) de um arquivo, no navegador — pra perguntar ao servidor se o cliente já tem esse
 *  conteúdo antes de subir. O servidor recalcula no registro; isto é só atalho. */
export async function sha256DoArquivo(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
