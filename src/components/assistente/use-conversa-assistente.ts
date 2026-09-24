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
  /** Guarda de envio em voo: `estado` só muda de verdade no próximo render, então checá-lo pra
   *  barrar um segundo Enter/clique disparado na mesma volta síncrona (antes do React repintar)
   *  deixa passar os dois. Ref lê e escreve na hora — não depende de re-render. */
  const emAndamento = useRef(false)

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

  /** Cria a conversa (primeira pergunta) e encadeia a resposta. Fica de fora de `enviar` porque
   *  `tentarDeNovo` também precisa disso — sem `conversaId` (POST anterior falhou), tentar de novo
   *  tem que refazer a criação, não só reenviar pra uma conversa que nunca existiu. */
  const criarConversaEResponder = useCallback(
    async (pergunta: string, rota: string) => {
      const resposta = await fetch('/api/assistente/conversas', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ pergunta, rota }) })
      if (!resposta.ok) {
        setErro(mensagemDeErro(new Error(await resposta.text())))
        setEstado('erro')
        return
      }
      const id = ((await resposta.json()) as { id: string }).id
      setConversaId(id)
      await responder(id, pergunta, rota)
    },
    [responder]
  )

  const enviar = useCallback(
    async (pergunta: string, rota: string) => {
      const texto = pergunta.trim()
      if (!texto || emAndamento.current) return
      emAndamento.current = true
      setEstado('respondendo')
      setErro(null)
      ultimaPergunta.current = texto
      setMensagens((atual) => [...atual, { id: `p-${Date.now()}`, papel: 'usuario', conteudo: texto }])
      try {
        if (conversaId) await responder(conversaId, texto, rota)
        else await criarConversaEResponder(texto, rota)
      } finally {
        emAndamento.current = false
      }
    },
    [conversaId, responder, criarConversaEResponder]
  )

  const tentarDeNovo = useCallback(
    async (rota: string) => {
      if (!ultimaPergunta.current || emAndamento.current) return
      emAndamento.current = true
      setEstado('respondendo')
      setErro(null)
      try {
        if (conversaId) await responder(conversaId, ultimaPergunta.current, rota)
        else await criarConversaEResponder(ultimaPergunta.current, rota)
      } finally {
        emAndamento.current = false
      }
    },
    [conversaId, responder, criarConversaEResponder]
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
