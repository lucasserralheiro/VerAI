'use client'

import { useCallback, useRef, useState } from 'react'
import { DefaultChatTransport, readUIMessageStream, type UIMessage } from 'ai'
import { lerMensagemDoStream, mensagemDeErro } from './mensagem-stream'

export interface MensagemTela {
  id: string
  papel: 'usuario' | 'assistente'
  conteudo: string
  /** Números da resposta que nenhuma consulta confirmou (marcados com ⚠ na tela). */
  naoConfirmados?: string[]
}

export type EstadoConversa = 'pronto' | 'respondendo' | 'erro'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export function useConversaAssistente() {
  const [conversaId, setConversaId] = useState<string | null>(null)
  const [mensagens, setMensagens] = useState<MensagemTela[]>([])
  const [estado, setEstado] = useState<EstadoConversa>('pronto')
  const [erro, setErro] = useState<string | null>(null)
  const [ferramentaAtual, setFerramentaAtual] = useState<string | null>(null)
  /** Controller da cadeia de envio em voo INTEIRA — cobre o POST de criação da conversa (se
   *  houver) e o stream da resposta, pra `parar()` cancelar os dois, não só o stream. */
  const controle = useRef<AbortController | null>(null)
  const ultimaPergunta = useRef<string | null>(null)
  /** Guarda de envio em voo: `estado` só muda de verdade no próximo render, então checá-lo pra
   *  barrar um segundo Enter/clique disparado na mesma volta síncrona (antes do React repintar)
   *  deixa passar os dois. Ref lê e escreve na hora — não depende de re-render. */
  const emAndamento = useRef(false)
  /** Identidade da cadeia de envio atual (POST de criação + resposta). `novaConversa` e
   *  `abrirConversa` incrementam ao abandonar o que estava em voo — quando a cadeia velha
   *  finalmente resolve (ou rejeita, abortada ou não), ela se vê com uma geração velha e para de
   *  mexer em estado: senão a resposta de uma conversa abandonada aparece dentro da conversa nova
   *  que o usuário abriu depois, ou a guarda de envio em voo de uma cadeia nova é liberada por
   *  engano pela cadeia velha terminando por último. */
  const geracao = useRef(0)

  const responder = useCallback(
    async (id: string, pergunta: string, rota: string, abort: AbortController, minhaGeracao: number) => {
      if (geracao.current !== minhaGeracao) return
      const idResposta = `r-${Date.now()}`
      setMensagens((atual) => [...atual, { id: idResposta, papel: 'assistente', conteudo: '' }])
      setEstado('respondendo')
      setErro(null)
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
          if (geracao.current !== minhaGeracao) return
          const { texto, ferramenta, conferencia } = lerMensagemDoStream(parcial)
          setFerramentaAtual(ferramenta)
          setMensagens((atual) => atual.map((m) => (m.id === idResposta ? { ...m, conteudo: texto, naoConfirmados: conferencia?.naoConfirmados } : m)))
        }
        if (geracao.current !== minhaGeracao) return
        setEstado('pronto')
      } catch (e) {
        if (geracao.current !== minhaGeracao) return
        setMensagens((atual) => atual.filter((m) => m.id !== idResposta || m.conteudo))
        if (abort.signal.aborted) {
          setEstado('pronto')
        } else {
          setErro(mensagemDeErro(e))
          setEstado('erro')
        }
      } finally {
        if (geracao.current === minhaGeracao) {
          setFerramentaAtual(null)
          if (controle.current === abort) controle.current = null
        }
      }
    },
    []
  )

  /** POST de criação da conversa (primeira pergunta). Devolve o id em caso de sucesso, ou `null`
   *  se o erro já foi tratado (POST recusado, rede caiu, JSON inválido, abortado) ou se a cadeia
   *  foi abandonada no meio (geração ficou velha) — nesse último caso não mexe em estado nenhum. */
  const criarConversa = useCallback(async (pergunta: string, rota: string, abort: AbortController, minhaGeracao: number): Promise<string | null> => {
    let resposta: Response
    try {
      resposta = await fetch('/api/assistente/conversas', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ pergunta, rota }),
        signal: abort.signal,
      })
    } catch (e) {
      if (geracao.current !== minhaGeracao) return null
      if (abort.signal.aborted) setEstado('pronto')
      else {
        setErro(mensagemDeErro(e))
        setEstado('erro')
      }
      return null
    }
    if (geracao.current !== minhaGeracao) return null
    if (!resposta.ok) {
      setErro(mensagemDeErro(new Error(await resposta.text())))
      setEstado('erro')
      return null
    }
    let corpo: { id: string }
    try {
      corpo = (await resposta.json()) as { id: string }
    } catch (e) {
      if (geracao.current !== minhaGeracao) return null
      setErro(mensagemDeErro(e))
      setEstado('erro')
      return null
    }
    if (geracao.current !== minhaGeracao) return null
    setConversaId(corpo.id)
    return corpo.id
  }, [])

  /** Núcleo comum de `enviar`/`tentarDeNovo`: cria a conversa se preciso (sem `idExistente`) e
   *  encadeia a resposta, sob a guarda de envio em voo e a identidade de geração. */
  const executarEnvio = useCallback(
    async (pergunta: string, rota: string, comBolhaUsuario: boolean, idExistente: string | null) => {
      if (!pergunta || emAndamento.current) return
      emAndamento.current = true
      const minhaGeracao = geracao.current
      const abort = new AbortController()
      controle.current = abort
      setEstado('respondendo')
      setErro(null)
      ultimaPergunta.current = pergunta
      if (comBolhaUsuario) {
        setMensagens((atual) => [...atual, { id: `p-${Date.now()}`, papel: 'usuario', conteudo: pergunta }])
      }
      try {
        const id = idExistente ?? (await criarConversa(pergunta, rota, abort, minhaGeracao))
        if (!id) return
        await responder(id, pergunta, rota, abort, minhaGeracao)
      } finally {
        if (geracao.current === minhaGeracao) emAndamento.current = false
      }
    },
    [criarConversa, responder]
  )

  const enviar = useCallback(
    async (pergunta: string, rota: string) => {
      const texto = pergunta.trim()
      await executarEnvio(texto, rota, true, conversaId)
    },
    [executarEnvio, conversaId]
  )

  /** Reenvia a mesma pergunta pela rota de mensagens (registra a pergunta de novo) — aceitável, e
   *  vale tanto pra um erro no meio de uma conversa quanto pra um erro no POST que cria a
   *  primeira: sem `conversaId` ainda, refaz a criação, sem duplicar a bolha do usuário. */
  const tentarDeNovo = useCallback(
    async (rota: string) => {
      if (!ultimaPergunta.current) return
      await executarEnvio(ultimaPergunta.current, rota, false, conversaId)
    },
    [executarEnvio, conversaId]
  )

  const parar = useCallback(() => controle.current?.abort(), [])

  const novaConversa = useCallback(() => {
    geracao.current += 1
    controle.current?.abort()
    controle.current = null
    emAndamento.current = false
    setConversaId(null)
    setMensagens([])
    setErro(null)
    setEstado('pronto')
  }, [])

  const abrirConversa = useCallback(async (id: string) => {
    geracao.current += 1
    controle.current?.abort()
    controle.current = null
    emAndamento.current = false
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
