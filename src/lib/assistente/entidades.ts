import { prisma } from '@/lib/prisma'
import type { AuthUser } from '@/lib/auth'
import { clienteIdsPermitidos } from '@/lib/visibilidade'
import { chaveNumerica } from '@/lib/relatorios-clientes/vincular-itens'

export interface EntidadesIdentificadas {
  clientes: { id: string; nome: string; sigla: string | null }[]
  contratos: { id: string; numero: string; clienteId: string }[]
  texto: string | null
}

const semAcento = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
/** Palavras separadas por um espaço, com espaço nas pontas: casa palavra inteira com `includes`. */
const palavras = (texto: string) => ` ${semAcento(texto).toLowerCase().replace(/[^a-z0-9-]+/g, ' ').trim()} `
const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function cita(pergunta: string, termo: string | null | undefined): boolean {
  const alvo = palavras(termo ?? '').trim()
  if (!alvo) return false
  if (alvo.replace(/[^a-z0-9]/g, '').length <= 3) {
    // Sigla curta ("SF", "SME") só em maiúsculas: em minúscula é palavra comum.
    const exato = escapar(semAcento(termo!.trim()).toUpperCase())
    return new RegExp(`(^|[^A-Za-z0-9-])${exato}($|[^A-Za-z0-9-])`).test(semAcento(pergunta))
  }
  return palavras(pergunta).includes(` ${alvo} `)
}

/** "Empresa de Cinema … - SPCine" → "SPCine". */
const apelido = (nome: string) => (nome.includes(' - ') ? nome.slice(nome.lastIndexOf(' - ') + 3) : null)

/** "45/2023", "TC 45/SMIT/2023", "032/2025/SEHAB" — nunca pedaço de SEI ("6018.2023/0122629-0") nem data. */
const NUMERO_DE_CONTRATO = /(?<![\d./])\d{1,4}\s*\/\s*(?:[A-Za-zÀ-ú]+\s*\/\s*)?\d{4}(?:\s*\/\s*[A-Za-zÀ-ú]+)?(?![\d/])/g

/** Número + ano: o cadastro traz sufixo ("TC 105/2025/SMS/1/CONTRATOS" → "105 2025 1") que ninguém digita. */
const numeroEAno = (texto: string | null | undefined) => chaveNumerica(texto)?.split(' ').slice(0, 2).join(' ') ?? null

function idsDaMemoria(recentes: unknown[]): { clientes: string[]; contratos: string[] } {
  const clientes = new Set<string>()
  const contratos = new Set<string>()
  for (const ferramentas of recentes) {
    if (!Array.isArray(ferramentas)) continue
    for (const chamada of ferramentas) {
      const entrada = (chamada as { entrada?: Record<string, unknown> } | null)?.entrada
      if (typeof entrada?.clienteId === 'string') clientes.add(entrada.clienteId)
      if (typeof entrada?.contratoId === 'string') contratos.add(entrada.contratoId)
    }
  }
  return { clientes: [...clientes], contratos: [...contratos] }
}

const semRepetir = <T extends { id: string }>(itens: (T | null | undefined)[]): T[] => [
  ...new Map(itens.filter((i): i is T => !!i).map((i) => [i.id, i])).values(),
]

/**
 * Cliente e contrato citados na pergunta (ou usados nas últimas respostas), achados sem IA — poupa
 * uma chamada inteira ao modelo só para descobrir o id (spec 2026-09-25-assistente-base-economica §5).
 * Só entra o que é único e visível ao usuário.
 */
export async function identificarEntidades(entrada: { pergunta: string; usuario: AuthUser; recentes: unknown[] }): Promise<EntidadesIdentificadas> {
  const permitidos = await clienteIdsPermitidos(entrada.usuario)
  const visiveis = await prisma.cliente.findMany({
    where: permitidos === null ? {} : { id: { in: permitidos } },
    select: { id: true, nome: true, siglaLegado: true },
  })
  const citados = visiveis.filter((c) => cita(entrada.pergunta, c.siglaLegado) || cita(entrada.pergunta, apelido(c.nome)) || cita(entrada.pergunta, c.nome))
  const cliente = citados.length === 1 ? citados[0] : null

  const chaves = [...new Set((entrada.pergunta.match(NUMERO_DE_CONTRATO) ?? []).map(numeroEAno).filter((c): c is string => c !== null))]
  const filtroCliente = cliente ? cliente.id : permitidos === null ? undefined : { in: permitidos }
  let contrato: { id: string; numeroTermo: string | null; clienteId: string } | null = null
  if (chaves.length === 1) {
    const candidatos = await prisma.contrato.findMany({
      where: filtroCliente ? { clienteId: filtroCliente } : {},
      select: { id: true, numeroTermo: true, clienteId: true },
    })
    const casados = candidatos.filter((c) => numeroEAno(c.numeroTermo) === chaves[0])
    contrato = casados.length === 1 ? casados[0] : null
  }

  const memoria = idsDaMemoria(entrada.recentes)
  const lembrados = memoria.contratos.length
    ? await prisma.contrato.findMany({
        where: { id: { in: memoria.contratos }, ...(permitidos === null ? {} : { clienteId: { in: permitidos } }) },
        select: { id: true, numeroTermo: true, clienteId: true },
      })
    : []

  const porId = new Map(visiveis.map((c) => [c.id, c]))
  const clientes = semRepetir([cliente, ...memoria.clientes.map((id) => porId.get(id))]).map((c) => ({ id: c.id, nome: c.nome, sigla: c.siglaLegado }))
  const contratos = semRepetir([contrato, ...lembrados]).map((c) => ({ id: c.id, numero: c.numeroTermo ?? '(sem número)', clienteId: c.clienteId }))

  const partes = [
    ...clientes.map((c) => `cliente ${c.sigla ? `${c.sigla} – ` : ''}${c.nome} (clienteId: ${c.id})`),
    ...contratos.map((c) => `contrato ${c.numero} (contratoId: ${c.id})`),
  ]
  return { clientes, contratos, texto: partes.length ? `Já identificados (use estes ids, não procure de novo): ${partes.join('; ')}.` : null }
}
