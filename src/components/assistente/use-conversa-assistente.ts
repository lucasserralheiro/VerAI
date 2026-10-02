'use client'

import { useCallback, useRef, useState } from 'react'
import { DefaultChatTransport, readUIMessageStream, type UIMessage } from 'ai'
import { lerMensagemDoStream, mensagemDeErro } from './mensagem-stream'
import { motivoDeRecusa, type EstadoAnexo } from './anexos/enviar-anexo'
import { useAnexos } from './anexos/use-anexos'

export interface MensagemTela {
  id: string
  papel: 'usuario' | 'assistente'
  conteudo: string
  /** Números da resposta que nenhuma consulta confirmou (marcados com ⚠ na tela). */
  naoConfirmados?: string[]
}

export type EstadoConversa = 'pronto' | 'respondendo' | 'erro'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/** Anexo já registrado, como volta de `GET /api/assistente/conversas/[id]`. */
interface AnexoRegistrado {
  id: string
  nome: string
  status: string
}

function cartaoDoRegistrado(a: AnexoRegistrado): EstadoAnexo {
  if (a.status === 'ok') return { id: a.id, anexoId: a.id, nome: a.nome, etapa: 'pronto' }
  return { id: a.id, anexoId: a.id, nome: a.nome, etapa: 'erro', erro: a.status === 'sem_texto' ? 'sem texto legível' : 'não foi possível ler' }
}

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
  /** Espelho de `conversaId` lido na hora: o painel anexa o texto colado e logo em seguida envia a
   *  pergunta, na mesma volta — pelo estado, a pergunta ainda veria `null` e criaria outra conversa. */
  const idAtual = useRef<string | null>(null)
  /** Criação em curso de conversa para anexo: anexos e pergunta que chegam junto esperam por ela. */
  const criandoParaAnexo = useRef<Promise<string | null> | null>(null)

  const definirConversa = useCallback((id: string | null) => {
    idAtual.current = id
    setConversaId(id)
  }, [])

  /** A ficha do anexo (já gravada no servidor como resposta direta) entra como mensagem do assistente. */
  const aoFicha = useCallback((texto: string, anexoId: string) => {
    setMensagens((atual) => [...atual, { id: `anexo-${anexoId}`, papel: 'assistente', conteudo: texto }])
  }, [])
  const { anexos, anexar: anexarNaFila, registrarFalha, reiniciar: reiniciarAnexos } = useAnexos({ aoFicha })

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
    definirConversa(corpo.id)
    return corpo.id
  }, [definirConversa])

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
      const id = idAtual.current ?? (criandoParaAnexo.current ? await criandoParaAnexo.current : null)
      await executarEnvio(texto, rota, true, id)
    },
    [executarEnvio]
  )

  /** Reenvia a mesma pergunta pela rota de mensagens (registra a pergunta de novo) — aceitável, e
   *  vale tanto pra um erro no meio de uma conversa quanto pra um erro no POST que cria a
   *  primeira: sem `conversaId` ainda, refaz a criação, sem duplicar a bolha do usuário. */
  const tentarDeNovo = useCallback(
    async (rota: string) => {
      if (!ultimaPergunta.current) return
      await executarEnvio(ultimaPergunta.current, rota, false, idAtual.current)
    },
    [executarEnvio]
  )

  const parar = useCallback(() => controle.current?.abort(), [])

  const novaConversa = useCallback(() => {
    geracao.current += 1
    controle.current?.abort()
    controle.current = null
    emAndamento.current = false
    criandoParaAnexo.current = null
    reiniciarAnexos()
    definirConversa(null)
    setMensagens([])
    setErro(null)
    setEstado('pronto')
  }, [reiniciarAnexos, definirConversa])

  const abrirConversa = useCallback(async (id: string) => {
    geracao.current += 1
    controle.current?.abort()
    controle.current = null
    emAndamento.current = false
    criandoParaAnexo.current = null
    reiniciarAnexos()
    const minhaGeracao = geracao.current
    const resposta = await fetch(`/api/assistente/conversas/${id}`)
    if (!resposta.ok || geracao.current !== minhaGeracao) return
    const dados = (await resposta.json()) as { mensagens: MensagemTela[]; anexos?: AnexoRegistrado[] }
    if (geracao.current !== minhaGeracao) return
    definirConversa(id)
    setMensagens(dados.mensagens)
    reiniciarAnexos((dados.anexos ?? []).map(cartaoDoRegistrado))
    setErro(null)
    setEstado('pronto')
  }, [reiniciarAnexos, definirConversa])

  /** Cria a conversa só para receber anexos (título = nome do primeiro arquivo; sem pergunta à IA). */
  const criarParaAnexo = useCallback(
    async (nome: string, rota: string, minhaGeracao: number): Promise<string | null> => {
      try {
        const resposta = await fetch('/api/assistente/conversas', {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ pergunta: nome.slice(0, 2000), rota, somenteCriar: true }),
        })
        if (!resposta.ok) return null
        const { id } = (await resposta.json()) as { id: string }
        if (geracao.current !== minhaGeracao) return null
        definirConversa(id)
        return id
      } catch {
        return null
      }
    },
    [definirConversa]
  )

  /** Anexa arquivos à conversa aberta (criando uma, se não houver). Resolve `true` quando todos
   *  ficaram prontos — o painel só manda a pergunta do texto colado depois disso. */
  const anexar = useCallback(
    async (arquivos: File[], rota: string): Promise<boolean> => {
      // Formato e tamanho antes de tudo: arquivo recusado não cria conversa vazia.
      const validos: File[] = []
      for (const arquivo of arquivos) {
        const recusa = motivoDeRecusa(arquivo)
        if (recusa) registrarFalha([arquivo], recusa)
        else validos.push(arquivo)
      }
      if (validos.length === 0) return false
      const todosValidos = validos.length === arquivos.length
      const minhaGeracao = geracao.current
      let id = idAtual.current
      if (!id) {
        if (!criandoParaAnexo.current) {
          const criacao = criarParaAnexo(validos[0].name, rota, minhaGeracao)
          criandoParaAnexo.current = criacao
          void criacao.finally(() => {
            if (criandoParaAnexo.current === criacao) criandoParaAnexo.current = null
          })
        }
        id = await criandoParaAnexo.current
      }
      if (geracao.current !== minhaGeracao) return false
      if (!id) {
        registrarFalha(validos, 'não foi possível criar a conversa')
        return false
      }
      const prontos = await anexarNaFila(validos, id)
      return prontos && todosValidos
    },
    [anexarNaFila, registrarFalha, criarParaAnexo]
  )

  return {
    conversaId,
    mensagens,
    estado,
    erro,
    ferramentaAtual,
    anexos,
    enviar,
    anexar,
    parar,
    tentarDeNovo,
    novaConversa,
    abrirConversa,
  }
}
