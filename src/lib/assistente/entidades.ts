import { prisma } from '@/lib/prisma'
import type { AuthUser } from '@/lib/auth'
import { clienteIdsPermitidos } from '@/lib/visibilidade'
import { chaveNumerica } from '@/lib/relatorios-clientes/vincular-itens'
import { apelidosDoCliente, PALAVRAS_DE_LIGACAO } from './apelidos'

export interface EntidadesIdentificadas {
  clientes: { id: string; nome: string; sigla: string | null }[]
  contratos: { id: string; numero: string; clienteId: string }[]
  /** Contratos que casam com o assunto mas não são únicos: a IA pergunta ou escolhe. */
  possiveis: { id: string; numero: string; descricao: string }[]
  /** Único contrato achado pelo assunto (não por número): a IA usa e avisa qual considerou. */
  provavel: { id: string; numero: string; descricao: string } | null
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
  // Sigla, apelido após " - " e nome completo valem mais que o apelido tirado do nome ("saúde"):
  // se algum cliente foi citado por essas vias, os citados só por apelido são ignorados.
  const fortes = visiveis.filter((c) => cita(entrada.pergunta, c.siglaLegado) || cita(entrada.pergunta, apelido(c.nome)) || cita(entrada.pergunta, c.nome))
  const citados = fortes.length > 0 ? fortes : visiveis.filter((c) => apelidosDoCliente(c).some((a) => cita(entrada.pergunta, a)))
  const cliente = citados.length === 1 ? citados[0] : null

  const chaves = [...new Set((entrada.pergunta.match(NUMERO_DE_CONTRATO) ?? []).map(numeroEAno).filter((c): c is string => c !== null))]
  const filtroCliente = cliente ? cliente.id : permitidos === null ? undefined : { in: permitidos }
  let contrato: { id: string; numeroTermo: string | null; clienteId: string } | null = null
  let possiveis: EntidadesIdentificadas['possiveis'] = []
  let provavel: EntidadesIdentificadas['provavel'] = null
  if (chaves.length === 1) {
    const candidatos = await prisma.contrato.findMany({
      where: filtroCliente ? { clienteId: filtroCliente } : {},
      select: { id: true, numeroTermo: true, clienteId: true },
    })
    const casados = candidatos.filter((c) => numeroEAno(c.numeroTermo) === chaves[0])
    contrato = casados.length === 1 ? casados[0] : null
  }

  // Contrato pelo assunto ("o contrato de nuvem da SMIT"): só com cliente certo e sem número na pergunta.
  if (cliente && !contrato && chaves.length === 0) {
    const termos = palavras(entrada.pergunta).trim().split(' ')
      .filter((t) => t.length >= 4 && !PALAVRAS_DE_LIGACAO.has(t))
      .filter((t) => ![cliente.siglaLegado, cliente.nome, ...apelidosDoCliente(cliente)].some((a) => a && palavras(a).includes(` ${t} `)))
    if (termos.length > 0) {
      const doCliente = await prisma.contrato.findMany({
        where: { clienteId: cliente.id },
        select: { id: true, numeroTermo: true, clienteId: true, descricao: true, situacao: true },
      })
      const casados = doCliente.filter((c) => c.descricao && termos.some((t) => palavras(c.descricao!).includes(` ${t} `)))
      // "Ativo" aqui é só filtro de candidato: ativo de verdade continua sendo do consolidado.
      const ativos = casados.filter((c) => !/encerr|rescin|finaliz/i.test(c.situacao ?? ''))
      if (ativos.length === 1) provavel = { id: ativos[0].id, numero: ativos[0].numeroTermo ?? '(sem número)', descricao: ativos[0].descricao! }
      else if (ativos.length > 1) possiveis = ativos.slice(0, 5).map((c) => ({ id: c.id, numero: c.numeroTermo ?? '(sem número)', descricao: c.descricao! }))
    }
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
  const textos = [
    partes.length ? `Já identificados (use estes ids, não procure de novo): ${partes.join('; ')}.` : null,
    provavel ? `Contrato provável pelo assunto: ${provavel.numero} (contratoId: ${provavel.id}) – ${provavel.descricao}. Use-o e diga na resposta qual contrato considerou.` : null,
    possiveis.length ? `Contratos possíveis: ${possiveis.map((c) => `${c.numero} (contratoId: ${c.id}) – ${c.descricao}`).join('; ')}.` : null,
  ].filter((t): t is string => t !== null)
  return { clientes, contratos, possiveis, provavel, texto: textos.length ? textos.join(' ') : null }
}
