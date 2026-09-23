import { useEffect, useState } from 'react'
import { chaveDoSei } from './sei'

/**
 * Links de SEI cadastrados pelos usuários (tabela `LinkSei`, por número). Um mapa só, buscado uma
 * vez por carga de página e compartilhado por todos os `SeiLink` da tela: cadastrar o link de um
 * número atualiza na hora todo lugar onde ele aparece.
 */
let cache: Record<string, string> | null = null
let pendente: Promise<void> | null = null
const ouvintes = new Set<() => void>()

function notificar() {
  ouvintes.forEach((ouvinte) => ouvinte())
}

function carregar() {
  if (cache !== null || pendente) return
  pendente = fetch('/api/sei-links', { cache: 'no-store' })
    .then(async (response) => {
      const corpo = response.ok ? await response.json().catch(() => null) : null
      cache = corpo && typeof corpo === 'object' ? (corpo as Record<string, string>) : {}
    })
    .catch(() => {
      cache = {}
    })
    .finally(() => {
      pendente = null
      notificar()
    })
}

/** Link cadastrado pra este número SEI, ou `null`. */
export function useLinkSei(numero: string | null | undefined): string | null {
  const [, atualizar] = useState(0)
  useEffect(() => {
    const ouvinte = () => atualizar((n) => n + 1)
    ouvintes.add(ouvinte)
    carregar()
    return () => {
      ouvintes.delete(ouvinte)
    }
  }, [])
  return numero ? (cache?.[chaveDoSei(numero)] ?? null) : null
}

/** Salva (ou, com `url` vazia, remove) o link do número. Devolve a mensagem de erro, ou `null` se deu certo. */
export async function salvarLinkSei(numero: string, url: string): Promise<string | null> {
  try {
    const response = await fetch('/api/sei-links', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero, url }),
    })
    const corpo = await response.json().catch(() => null)
    if (!response.ok) return corpo?.error ?? 'Falha ao salvar o link.'
    cache = { ...(cache ?? {}) }
    if (corpo?.url) cache[corpo.chave] = corpo.url
    else delete cache[chaveDoSei(numero)]
    notificar()
    return null
  } catch {
    return 'Falha de conexão ao salvar o link.'
  }
}
