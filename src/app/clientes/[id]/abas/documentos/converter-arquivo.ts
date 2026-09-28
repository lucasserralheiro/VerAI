'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ArquivoRepositorio } from './tipos'

/** Extensões que a conversão da Proposta Comercial aceita (`/api/propostas-comerciais`). */
const CONVERSIVEIS = new Set(['pdf', 'xlsx', 'csv', 'docx'])

export const podeConverter = (arquivo: ArquivoRepositorio) => CONVERSIVEIS.has(arquivo.extensao)

/** Conversão já feita deste arquivo, se houver — aí o atalho abre ela em vez de converter de novo. */
export const conversaoDoArquivo = (arquivo: ArquivoRepositorio) =>
  arquivo.usos.find((uso) => uso.tipo === 'conversao-markdown')

// Mesma conversão da tela "Proposta Comercial › Nova conversão", só que a partir do arquivo que já
// está guardado — sem novo upload. Termina abrindo o documento convertido.
export function useConverterArquivo() {
  const router = useRouter()
  const [convertendoId, setConvertendoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function converter(arquivo: ArquivoRepositorio) {
    setErro(null)
    setConvertendoId(arquivo.id)
    const response = await fetch('/api/propostas-comerciais', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arquivosCliente: [arquivo.id] }),
    }).catch(() => null)
    const corpo = await response?.json().catch(() => null)
    if (!response?.ok || !corpo?.id) {
      setConvertendoId(null)
      return setErro(corpo?.error ?? 'Falha ao converter o arquivo.')
    }
    router.push(`/propostas-comerciais/${corpo.id}`)
  }

  return { converter, convertendoId, erro, setErro }
}
