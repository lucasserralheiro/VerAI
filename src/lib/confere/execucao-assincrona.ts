import { createHmac, timingSafeEqual } from 'node:crypto'

import type { Competencia } from '@/lib/confere/tipos-cadastro'

/**
 * O que a geração assíncrona do Confere precisa lembrar entre o envio e a
 * consulta (20/10/2026 — docs/superpowers/specs/2026-09-21-integracao-confere-design.md,
 * adendo "geração assíncrona").
 *
 * O envio (`POST /api/confere/reports`) devolve à tela um **bilhete** e cada
 * consulta (`GET /api/confere/reports/<bilhete>`) o traz de volta. Ele carrega o
 * id do job no Confere e o que o histórico vai precisar quando a geração terminar
 * — sem tabela nova e sem gravar nada antes da hora: o envio e a consulta podem
 * cair em instâncias diferentes da função na Vercel, e o bilhete é a única coisa
 * que as duas têm em comum.
 *
 * **Assinado** (HMAC-SHA256): a tela não pode trocar o contrato do histórico
 * nem consultar o job de outra pessoa — `usuarioId` é conferido na consulta.
 * Não é segredo: só diz respeito a quem enviou.
 */
export interface ExecucaoAssincrona {
  /** id do job no Confere. */
  job: string
  /** id da linha de `ConfereExecucao` que o histórico vai criar. */
  execucao: string
  usuarioId: string
  contratoId: string | null
  competencia: Competencia | null
  nomes: { contrato: string; levantamento: string; aditivos: string[] }
  /** As entradas já guardadas no storage no envio — o histórico só as cita. */
  entradas: { papel: 'contrato' | 'aditivo' | 'levantamento'; nome: string; caminho: string }[]
  /** Quando foi emitido (ms). Bilhete velho não vale: o Confere guarda o
   *  resultado por 20 min depois de pronto. */
  emitidoEm: number
}

/** Folga sobre o pior caso (fila + geração longa + resultado guardado). */
const VALIDADE_MS = 2 * 60 * 60 * 1000

function chave(): string {
  const segredo = process.env.CONFERE_SHARED_SECRET || process.env.JWT_SECRET
  if (!segredo) throw new Error('CONFERE_SHARED_SECRET ou JWT_SECRET precisa estar configurado')
  return segredo
}

function assinatura(conteudo: string): string {
  return createHmac('sha256', chave()).update(`confere-execucao.${conteudo}`).digest('base64url')
}

export function emitirBilhete(execucao: ExecucaoAssincrona): string {
  const conteudo = Buffer.from(JSON.stringify(execucao), 'utf8').toString('base64url')
  return `${conteudo}.${assinatura(conteudo)}`
}

/** O bilhete, se for autêntico, ainda válido e da pessoa; senão `null`. */
export function lerBilhete(bilhete: string, usuarioId: string, agora = Date.now()): ExecucaoAssincrona | null {
  const [conteudo, assinado, ...resto] = bilhete.split('.')
  if (!conteudo || !assinado || resto.length > 0) return null
  const esperado = Buffer.from(assinatura(conteudo))
  const recebido = Buffer.from(assinado)
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null
  let execucao: ExecucaoAssincrona
  try {
    execucao = JSON.parse(Buffer.from(conteudo, 'base64url').toString('utf8')) as ExecucaoAssincrona
  } catch {
    return null
  }
  if (execucao.usuarioId !== usuarioId) return null
  if (typeof execucao.emitidoEm !== 'number' || agora - execucao.emitidoEm > VALIDADE_MS) return null
  return execucao
}
