import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import { deleteUpload, putUpload } from '@/lib/storage'
import { caminhoFinalArquivo } from '../caminhos'
import { sha256Hex, usosDosArquivos, type UsoArquivo } from '../servico'
import { contentTypeDe, extensaoDe, sugerirCategoria } from '../tipos'
import { motivoIgnorar, mudouPorMetadado, normalizarChave, pastaContratoDe, resolverCliente, type MapaPastas } from './regras'

// Sincronização da biblioteca ContratosReceita → repositório do cliente (spec
// docs/superpowers/specs/2026-09-24-sincronizacao-sharepoint-contratos-design.md §4). A FONTE é
// injetada: hoje a pasta sincronizada pelo OneDrive (scripts/sincronizar-sharepoint.ts), amanhã o
// Microsoft Graph — estado, regras e gravação não mudam.

export interface ArquivoFonte {
  /** Relativo à raiz da biblioteca, separado por "/". */
  caminho: string
  tamanhoBytes: number
  modificadoEm: Date
}

export interface FonteArquivos {
  listar(): Promise<ArquivoFonte[]>
  ler(caminho: string): Promise<Buffer>
}

export interface OpcoesSincronizacao {
  aplicar: boolean
  incluirWork?: boolean
  mapa?: MapaPastas
  fonte: FonteArquivos
  gravarBlob?: (caminho: string, conteudo: Buffer, contentType: string) => Promise<string>
  buscarUsos?: (ids: string[]) => Promise<Map<string, UsoArquivo[]>>
  agora?: Date
}

export interface ResultadoSincronizacao {
  listados: number
  novos: number
  reaproveitados: number
  conteudoTrocado: number
  inalterados: number
  ignorados: Record<string, number>
  semCliente: Record<string, number>
  sumiramDaOrigem: number
  removidos: number
  mantidosEmUso: Array<{ arquivoId: string; motivo: string }>
  falhas: Array<{ caminho: string; motivo: string }>
  remocaoSuspensa: string | null
}

interface EstadoMemoria {
  arquivoId: string | null
  ativo: boolean
}

/** Abaixo disso a listagem é tratada como falha da fonte (OneDrive pausado, pasta desmontada) e
 *  nada é removido — melhor não apagar do que apagar tudo por engano. */
const FRACAO_MINIMA_LISTADA = 0.5

export async function sincronizarSharepoint(prisma: PrismaClient, opcoes: OpcoesSincronizacao): Promise<ResultadoSincronizacao> {
  const { aplicar, incluirWork = false, mapa = {}, fonte } = opcoes
  const gravarBlob = opcoes.gravarBlob ?? putUpload
  const buscarUsos = opcoes.buscarUsos ?? usosDosArquivos
  const agora = opcoes.agora ?? new Date()

  const r: ResultadoSincronizacao = {
    listados: 0,
    novos: 0,
    reaproveitados: 0,
    conteudoTrocado: 0,
    inalterados: 0,
    ignorados: {},
    semCliente: {},
    sumiramDaOrigem: 0,
    removidos: 0,
    mantidosEmUso: [],
    falhas: [],
    remocaoSuspensa: null,
  }

  const clientes = new Map(
    (await prisma.cliente.findMany({ where: { siglaLegado: { not: null } }, select: { id: true, nome: true, siglaLegado: true } })).map(
      (c) => [normalizarChave(c.siglaLegado!), { id: c.id, nome: c.nome }] as const
    )
  )
  const estados = new Map((await prisma.arquivoSharepoint.findMany()).map((e) => [e.caminho, e]))
  const memoria = new Map<string, EstadoMemoria>(
    [...estados.values()].map((e) => [e.caminho, { arquivoId: e.arquivoId, ativo: e.removidoNaOrigemEm === null }])
  )

  const arquivos = (await fonte.listar()).map((a) => ({ ...a, caminho: a.caminho.normalize('NFC') }))
  arquivos.sort((a, b) => a.caminho.localeCompare(b.caminho))
  r.listados = arquivos.length
  const listados = new Set(arquivos.map((a) => a.caminho))

  const candidatosRemocao = new Set<string>()
  const simulados = new Map<string, string>() // `${clienteId}:${sha}` → id simulado (modo listagem)

  // 1) Presentes. Primeiro todos eles, depois os ausentes (§4 item 8): mover de pasta não apaga.
  for (const arquivo of arquivos) {
    const segmentos = arquivo.caminho.split('/')
    const motivo = motivoIgnorar(segmentos, arquivo.tamanhoBytes, incluirWork)
    if (motivo) {
      r.ignorados[motivo] = (r.ignorados[motivo] ?? 0) + 1
      continue
    }
    const cliente = resolverCliente(segmentos[0], clientes, mapa)
    if (cliente.tipo === 'ignorar') {
      r.ignorados['pasta ignorada no mapa'] = (r.ignorados['pasta ignorada no mapa'] ?? 0) + 1
      continue
    }
    if (cliente.tipo === 'sem-cliente') {
      r.semCliente[segmentos[0]] = (r.semCliente[segmentos[0]] ?? 0) + 1
      continue
    }

    const estado = estados.get(arquivo.caminho)
    const estadoAtivo = estado && estado.removidoNaOrigemEm === null && estado.arquivoId !== null
    if (estadoAtivo && !mudouPorMetadado(estado, arquivo)) {
      r.inalterados++
      continue
    }

    try {
      const conteudo = await fonte.ler(arquivo.caminho)
      const sha256 = sha256Hex(conteudo)
      const nome = segmentos[segmentos.length - 1]

      if (estadoAtivo && estado.sha256 === sha256) {
        // Só a data mudou (OneDrive regravou, alguém abriu e salvou igual).
        r.inalterados++
        if (aplicar) {
          await prisma.arquivoSharepoint.update({
            where: { id: estado.id },
            data: { tamanhoBytes: conteudo.length, modificadoEm: arquivo.modificadoEm, vistoEm: agora },
          })
        }
        continue
      }

      const arquivoId = await gravarOuReaproveitar(prisma, {
        aplicar,
        clienteId: cliente.clienteId,
        nome,
        conteudo,
        sha256,
        gravarBlob,
        simulados,
        contar: (novo) => (novo ? r.novos++ : r.reaproveitados++),
      })

      if (estadoAtivo) {
        r.conteudoTrocado++
        if (estado.arquivoId && estado.arquivoId !== arquivoId) candidatosRemocao.add(estado.arquivoId)
      }
      memoria.set(arquivo.caminho, { arquivoId, ativo: true })

      if (aplicar) {
        const dados = {
          pastaContrato: pastaContratoDe(segmentos),
          tamanhoBytes: conteudo.length,
          modificadoEm: arquivo.modificadoEm,
          sha256,
          arquivoId,
          vistoEm: agora,
          removidoNaOrigemEm: null,
        }
        await prisma.arquivoSharepoint.upsert({
          where: { caminho: arquivo.caminho },
          create: { caminho: arquivo.caminho, ...dados },
          update: dados,
        })
      }
    } catch (erro) {
      r.falhas.push({ caminho: arquivo.caminho, motivo: erro instanceof Error ? erro.message : String(erro) })
      // Falha não é "sumiu": mantém o estado como está pra tentar de novo na próxima execução.
    }
  }

  // 2) Ausentes: não aparecem em lugar nenhum da listagem (ignorados/sem cliente continuam "presentes").
  const ativosAntes = [...estados.values()].filter((e) => e.removidoNaOrigemEm === null).length
  if (ativosAntes > 0 && arquivos.length < ativosAntes * FRACAO_MINIMA_LISTADA) {
    r.remocaoSuspensa = `a pasta listou ${arquivos.length} arquivos e o estado tem ${ativosAntes} ativos — remoção suspensa (OneDrive pausado ou pasta fora do ar?)`
  } else {
    for (const estado of estados.values()) {
      if (estado.removidoNaOrigemEm !== null || listados.has(estado.caminho)) continue
      r.sumiramDaOrigem++
      memoria.set(estado.caminho, { arquivoId: estado.arquivoId, ativo: false })
      if (estado.arquivoId) candidatosRemocao.add(estado.arquivoId)
      if (aplicar) {
        await prisma.arquivoSharepoint.update({ where: { id: estado.id }, data: { removidoNaOrigemEm: agora } })
      }
    }
  }

  // 3) Remoção lógica: só arquivo que veio do SharePoint, sem outro caminho ativo apontando e sem uso.
  const referenciados = new Set([...memoria.values()].filter((m) => m.ativo && m.arquivoId).map((m) => m.arquivoId!))
  const ids = [...candidatosRemocao].filter((id) => !referenciados.has(id))
  if (ids.length > 0) {
    const doSharepoint = await prisma.arquivoCliente.findMany({
      where: { id: { in: ids }, origem: 'sharepoint', removidoEm: null },
      select: { id: true },
    })
    const usos = await buscarUsos(doSharepoint.map((a) => a.id))
    for (const { id } of doSharepoint) {
      const emUso = usos.get(id) ?? []
      if (emUso.length > 0) {
        r.mantidosEmUso.push({ arquivoId: id, motivo: emUso.map((u) => u.rotulo).join('; ') })
        continue
      }
      r.removidos++
      if (aplicar) await prisma.arquivoCliente.update({ where: { id }, data: { removidoEm: agora } })
    }
  }

  return r
}

async function gravarOuReaproveitar(
  prisma: PrismaClient,
  p: {
    aplicar: boolean
    clienteId: string
    nome: string
    conteudo: Buffer
    sha256: string
    gravarBlob: (caminho: string, conteudo: Buffer, contentType: string) => Promise<string>
    simulados: Map<string, string>
    contar: (novo: boolean) => void
  }
): Promise<string> {
  const chave = `${p.clienteId}:${p.sha256}`
  const existente = await prisma.arquivoCliente.findFirst({
    where: { clienteId: p.clienteId, sha256: p.sha256, removidoEm: null },
    select: { id: true },
  })
  if (existente) {
    p.contar(false)
    return existente.id
  }
  if (!p.aplicar) {
    const simulado = p.simulados.get(chave)
    p.contar(!simulado)
    if (simulado) return simulado
    const id = `simulado:${chave}`
    p.simulados.set(chave, id)
    return id
  }

  const id = randomUUID()
  const contentType = contentTypeDe(p.nome)
  const urlBlob = await p.gravarBlob(caminhoFinalArquivo(p.clienteId, id, p.nome), p.conteudo, contentType)
  try {
    await prisma.arquivoCliente.create({
      data: {
        id,
        clienteId: p.clienteId,
        categoria: sugerirCategoria(p.nome),
        nome: p.nome,
        extensao: extensaoDe(p.nome),
        contentType,
        tamanhoBytes: p.conteudo.length,
        sha256: p.sha256,
        urlBlob,
        origem: 'sharepoint',
        enviadoPorId: null,
      },
    })
    p.contar(true)
    return id
  } catch (erro) {
    // O blob recém-gravado nunca foi referenciado: apaga (best-effort), como em registrarArquivo.
    await deleteUpload(urlBlob).catch(() => {})
    // Mesmo conteúdo gravado por outro caminho ao mesmo tempo (upload na tela): índice único parcial.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
      const outro = await prisma.arquivoCliente.findFirst({
        where: { clienteId: p.clienteId, sha256: p.sha256, removidoEm: null },
        select: { id: true },
      })
      if (outro) {
        p.contar(false)
        return outro.id
      }
    }
    throw erro
  }
}
