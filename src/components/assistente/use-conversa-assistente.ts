'use client'

import { useCallback, useRef, useState } from 'react'
import { DefaultChatTransport, readUIMessageStream, type UIMessage } from 'ai'
import { lerMensagemDoStream, mensagemDeErro } from './mensagem-stream'

export interface MensagemTela {
  id: string
  papel: 'usuario' | 'assistente'
  conteudo: string
}

export type EstadoConversa = 'pronto' | 'respondendo' | 'erro'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export function useConversaAssistente() {
  const [conversaId, setConversaId] = useState<string | null>(null)
  const [mensagens, setMensagens] = useState<MensagemTela[]>([])
  const [estado, setEstado] = useState<EstadoConversa>('pronto')
  const [erro, setErro] = useState<string | null>(null)
  const [ferramentaAtual, setFerramentaAtual] = useState<string | null>(null)
  const controle = useRef<AbortController | null>(null)
  const ultimaPergunta = useRef<string | null>(null)

  const responder = useCallback(async (id: string, pergunta: string, rota: string) => {
    const idResposta = `r-${Date.now()}`
    setMensagens((atual) => [...atual, { id: idResposta, papel: 'assistente', conteudo: '' }])
    setEstado('respondendo')
    setErro(null)
    const abort = new AbortController()
    controle.current = abort
    try {
      const transporte = new DefaultChatTransport<UIMessage>({
        api: `/api/assistente/conversas/${id}/mensagens`,
        prepareSendMessagesRequest: () => ({ body: { pergunta, rota } }),
      })
      const stream = await transporte.sendMessages({
        chatId: id,
        messages: [],
        abortSignal: abort.signal,
        trigger: 'submit-message',
        messageId: undefined,
      })
      for await (const parcial of readUIMessageStream({ stream })) {
        const { texto, ferramenta } = lerMensagemDoStream(parcial)
        setFerramentaAtual(ferramenta)
        setMensagens((atual) => atual.map((m) => (m.id === idResposta ? { ...m, conteudo: texto } : m)))
      }
      setEstado('pronto')
    } catch (e) {
      setMensagens((atual) => atual.filter((m) => m.id !== idResposta || m.conteudo))
      if (abort.signal.aborted) {
        setEstado('pronto')
      } else {
        setErro(mensagemDeErro(e))
        setEstado('erro')
      }
    } finally {
      setFerramentaAtual(null)
      controle.current = null
    }
  }, [])

  const enviar = useCallback(
    async (pergunta: string, rota: string) => {
      const texto = pergunta.trim()
      if (!texto || estado === 'respondendo') return
      ultimaPergunta.current = texto
      setMensagens((atual) => [...atual, { id: `p-${Date.now()}`, papel: 'usuario', conteudo: texto }])
      let id = conversaId
      if (!id) {
        const resposta = await fetch('/api/assistente/conversas', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ pergunta: texto, rota }) })
        if (!resposta.ok) {
          setErro(mensagemDeErro(new Error(await resposta.text())))
          setEstado('erro')
          return
        }
        id = ((await resposta.json()) as { id: string }).id
        setConversaId(id)
      }
      await responder(id, texto, rota)
    },
    [conversaId, estado, responder]
  )

  const tentarDeNovo = useCallback(
    async (rota: string) => {
      if (conversaId && ultimaPergunta.current) await responder(conversaId, ultimaPergunta.current, rota)
    },
    [conversaId, responder]
  )

  const parar = useCallback(() => controle.current?.abort(), [])

  const novaConversa = useCallback(() => {
    controle.current?.abort()
    setConversaId(null)
    setMensagens([])
    setErro(null)
    setEstado('pronto')
  }, [])

  const abrirConversa = useCallback(async (id: string) => {
    controle.current?.abort()
    const resposta = await fetch(`/api/assistente/conversas/${id}`)
    if (!resposta.ok) return
    const dados = (await resposta.json()) as { mensagens: MensagemTela[] }
    setConversaId(id)
    setMensagens(dados.mensagens)
    setErro(null)
    setEstado('pronto')
  }, [])

  return { conversaId, mensagens, estado, erro, ferramentaAtual, enviar, parar, tentarDeNovo, novaConversa, abrirConversa }
}
