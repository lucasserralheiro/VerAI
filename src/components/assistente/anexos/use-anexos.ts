'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { enviarAnexo, type EstadoAnexo } from './enviar-anexo'

type ItemDaFila = { id: string; arquivo: File; conversaId: string; resolver: (ok: boolean) => void }

/**
 * Cartões e fila dos anexos da conversa aberta. Envia UM arquivo por vez (o OCR de vários PDFs ao
 * mesmo tempo estoura a memória do navegador) e entrega cada ficha a `aoFicha`, que a acrescenta como
 * mensagem do assistente.
 *
 * Um `AbortController` por lote: `reiniciar` (trocar de conversa, "Nova conversa") e desmontar (fechar
 * o painel) abortam o que está em curso — envio, OCR (o worker do tesseract é encerrado) — e o anexo
 * em curso não é registrado; os da fila nem saem.
 */
export function useAnexos({ aoFicha }: { aoFicha: (texto: string, anexoId: string) => void }) {
  const [anexos, setAnexos] = useState<EstadoAnexo[]>([])
  const fila = useRef<ItemDaFila[]>([])
  const lote = useRef(new AbortController())
  const rodando = useRef(false)
  const contador = useRef(0)
  const ultimoAoFicha = useRef(aoFicha)
  useEffect(() => {
    ultimoAoFicha.current = aoFicha
  }, [aoFicha])

  const novoId = () => `anexo-local-${++contador.current}`

  /** Aborta o lote atual e esvazia a fila; quem esperava por um anexo da fila recebe `false`. */
  const abortarLote = useCallback(() => {
    lote.current.abort()
    for (const item of fila.current) item.resolver(false)
    fila.current = []
    lote.current = new AbortController()
    rodando.current = false
  }, [])

  useEffect(() => {
    // Em StrictMode o efeito desmonta e monta de novo: o lote abortado na limpeza é trocado aqui.
    if (lote.current.signal.aborted) lote.current = new AbortController()
    return abortarLote
  }, [abortarLote])

  const processar = useCallback(async () => {
    if (rodando.current) return
    rodando.current = true
    const controle = lote.current
    try {
      while (fila.current.length > 0 && !controle.signal.aborted) {
        const item = fila.current.shift()!
        const resultado = await enviarAnexo(
          item.arquivo,
          item.conversaId,
          (mudanca) => {
            if (controle.signal.aborted) return
            setAnexos((atual) => atual.map((a) => (a.id === item.id ? { ...a, ...mudanca } : a)))
          },
          { signal: controle.signal }
        )
        if (controle.signal.aborted) {
          item.resolver(false)
          break
        }
        if (resultado) ultimoAoFicha.current(resultado.texto, resultado.anexoId)
        item.resolver(resultado !== null)
      }
    } finally {
      // Lote abortado: quem manda em `rodando` agora é o lote novo.
      if (lote.current === controle) rodando.current = false
    }
  }, [])

  /** Põe os arquivos na fila da conversa; resolve `true` quando todos ficaram prontos. */
  const anexar = useCallback(
    (arquivos: File[], conversaId: string): Promise<boolean> => {
      const itens = arquivos.map((arquivo) => {
        let resolver!: (ok: boolean) => void
        const pronto = new Promise<boolean>((r) => (resolver = r))
        return { item: { id: novoId(), arquivo, conversaId, resolver }, pronto }
      })
      setAnexos((atual) => [...atual, ...itens.map(({ item }) => ({ id: item.id, nome: item.arquivo.name, etapa: 'fila' as const }))])
      fila.current.push(...itens.map(({ item }) => item))
      void processar()
      return Promise.all(itens.map(({ pronto }) => pronto)).then((oks) => oks.every(Boolean))
    },
    [processar]
  )

  /** Cartões de erro para arquivos que nem chegaram à fila (ex.: a conversa não pôde ser criada). */
  const registrarFalha = useCallback((arquivos: File[], erro: string) => {
    setAnexos((atual) => [...atual, ...arquivos.map((a) => ({ id: novoId(), nome: a.name, etapa: 'erro' as const, erro }))])
  }, [])

  /** Troca de conversa: aborta o lote e mostra os anexos já registrados da conversa aberta. */
  const reiniciar = useCallback(
    (iniciais: EstadoAnexo[] = []) => {
      abortarLote()
      setAnexos(iniciais)
    },
    [abortarLote]
  )

  return { anexos, anexar, registrarFalha, reiniciar }
}
