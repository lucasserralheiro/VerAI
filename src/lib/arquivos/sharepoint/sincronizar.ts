import type { PrismaClient } from '@prisma/client'
import { garantirClientes } from '@/lib/importacao-sharepoint/clientes'
import { montarEstrutura, type ContratoPasta, type TermoPasta, type TipoTermo } from '@/lib/importacao-sharepoint/estrutura'
import { importarContratos, type ContratoLido, type TermoLido } from '@/lib/importacao-sharepoint/importar'
import type { CamposTermo } from '@/lib/importacao-sharepoint/texto'
import type { Achado } from '@/lib/importacao-sharepoint/auditoria'
import { configR2, putR2 } from '@/lib/r2'
import { registrarConteudo } from '../registrar-conteudo'
import { sha256Hex, usosDosArquivos, type UsoArquivo } from '../servico'
import { conferir, type LinhaConferencia } from './conferencia'
import {
  categoriaSharepoint,
  clienteDoArquivo,
  motivoIgnorar,
  mudouPorMetadado,
  normalizarChave,
  siglaDaPasta,
  type MapaPastas,
  type PapelArquivo,
} from './regras'

// Sincronização da biblioteca ContratosReceita → VerAI, numa passada só (spec
// docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md §3.5):
//   1. listagem  2. clientes  3. estrutura (só nomes)  4. arquivos → repositório e estado
//   5. termos que mudaram  6. contratos e linhas (importar.ts)  7. onde cada arquivo caiu
//   8. ausentes (colunas do SharePoint soltas, remoção lógica)  9. conferência.
// A FONTE é injetada: hoje a pasta sincronizada pelo OneDrive (scripts/sincronizar-sharepoint.ts),
// amanhã o Microsoft Graph — o resto não muda.

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
  fonte: FonteArquivos
  mapa?: MapaPastas
  nomes?: Record<string, string>
  /** Pastas que não são cliente: cada arquivo vai para a sigla do próprio nome (publicações do DOC). */
  rotearPeloNome?: string[]
  /** Só estes clientes (siglas): listagem E remoção restritas a eles. Para testar sem a biblioteca inteira. */
  clientes?: string[]
  /** Processa todos os contratos (em vez de só os que mudaram). */
  relerTudo?: boolean
  /** Lê os campos do PDF do termo; sem ela os contratos entram só com a estrutura. */
  lerCampos?: (conteudo: Buffer, tipo: TipoTermo) => Promise<CamposTermo>
  /** Onde o conteúdo é gravado. Padrão: Cloudflare R2 (spec §11) — o Vercel Blob fica para os uploads da tela. */
  gravarBlob?: (caminho: string, conteudo: Buffer, contentType: string) => Promise<string>
  buscarUsos?: (ids: string[]) => Promise<Map<string, UsoArquivo[]>>
  importar?: typeof importarContratos
  /** Auditoria das contas dos contratos dos clientes da execução (só com `aplicar`). O script passa
   *  `auditarNoBanco`; sem ela, não audita. */
  auditar?: (clienteIds: string[]) => Promise<Achado[]>
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
  anexosSoltos: number
  removidos: number
  mantidosEmUso: Array<{ arquivoId: string; motivo: string }>
  falhas: Array<{ caminho: string; motivo: string }>
  remocaoSuspensa: string | null
  clientes: { criados: string[]; renomeados: string[]; semNomeOficial: string[] }
  contratos: {
    processados: number
    contratosCriados: number
    contratosCompletados: number
    linhasCriadas: number
    linhasCompletadas: number
    anexosLigados: number
    avisos: string[]
  }
  /** `null` sem `--aplicar` (não há o que conferir no banco). */
  conferencia: LinhaConferencia[] | null
  /** Distorções nas contas dos contratos (auditoria.ts); `null` sem `--aplicar` ou sem `auditar`. */
  auditoria: Achado[] | null
}

interface ItemListado extends ArquivoFonte {
  segmentos: string[]
  clienteId: string
  rotuloCliente: string
  publicacao: boolean
}

/** Abaixo disso a listagem é tratada como falha da fonte (OneDrive pausado, pasta desmontada) e nada
 *  sai — melhor não apagar do que apagar tudo por engano. */
const FRACAO_MINIMA_LISTADA = 0.5

const pastaDe = (caminho: string) => caminho.slice(0, caminho.lastIndexOf('/'))

/** A sincronização nova só roda depois de scripts/migrar-sharepoint-lugar-certo.ts (spec §6). Cópia de
 *  linha vinda do SharePoint não conta: a própria sincronização religa a coluna ao arquivo original. */
export async function pendenciasDeMigracao(prisma: PrismaClient): Promise<string[]> {
  const pendencias: string[] = []
  const anexos = await prisma.historicoContrato.count({
    where: {
      chaveSharepoint: null,
      OR: [{ propostaPdfUrl: { not: null }, propostaArquivoId: null }, { termoPdfUrl: { not: null }, termoArquivoId: null }],
    },
  })
  if (anexos > 0) pendencias.push(`${anexos} linha(s) do histórico com PDF anexado à mão ainda sem referência ao repositório`)
  const contratos = await prisma.contrato.findMany({
    where: { chaveSharepoint: { not: null } },
    select: { chaveSharepoint: true, cliente: { select: { siglaLegado: true } } },
  })
  const antigos = contratos.filter((c) => c.chaveSharepoint!.split('|')[0] !== normalizarChave(c.cliente.siglaLegado ?? ''))
  if (antigos.length > 0) pendencias.push(`${antigos.length} contrato(s) com a chave antiga (pasta em vez de sigla)`)
  return pendencias
}

export async function sincronizarSharepoint(prisma: PrismaClient, opcoes: OpcoesSincronizacao): Promise<ResultadoSincronizacao> {
  const { aplicar, fonte, mapa = {}, nomes = {}, rotearPeloNome = [], relerTudo = false } = opcoes
  const buscarUsos = opcoes.buscarUsos ?? usosDosArquivos
  const importar = opcoes.importar ?? importarContratos
  const agora = opcoes.agora ?? new Date()
  if (aplicar && !opcoes.gravarBlob && !configR2()) {
    throw new Error('Cloudflare R2 não configurado — defina R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY antes de gravar')
  }
  const gravarBlob = opcoes.gravarBlob ?? ((caminho: string, conteudo: Buffer, contentType: string) => putR2(caminho, conteudo, contentType))

  const pendencias = await pendenciasDeMigracao(prisma)
  if (pendencias.length > 0) {
    throw new Error(`rode scripts/migrar-sharepoint-lugar-certo.ts --aplicar antes: ${pendencias.join('; ')}`)
  }

  const r: ResultadoSincronizacao = {
    listados: 0,
    novos: 0,
    reaproveitados: 0,
    conteudoTrocado: 0,
    inalterados: 0,
    ignorados: {},
    semCliente: {},
    sumiramDaOrigem: 0,
    anexosSoltos: 0,
    removidos: 0,
    mantidosEmUso: [],
    falhas: [],
    remocaoSuspensa: null,
    clientes: { criados: [], renomeados: [], semNomeOficial: [] },
    contratos: { processados: 0, contratosCriados: 0, contratosCompletados: 0, linhasCriadas: 0, linhasCompletadas: 0, anexosLigados: 0, avisos: [] },
    conferencia: null,
    auditoria: null,
  }
  const contar = (grupo: Record<string, number>, chave: string) => (grupo[chave] = (grupo[chave] ?? 0) + 1)

  // 1) Listagem; fora só o que não é documento.
  const arquivos = (await fonte.listar()).map((a) => ({ ...a, caminho: a.caminho.normalize('NFC') }))
  arquivos.sort((a, b) => a.caminho.localeCompare(b.caminho))
  r.listados = arquivos.length
  const listados = new Set(arquivos.map((a) => a.caminho))
  const validos = arquivos.filter((a) => {
    const motivo = motivoIgnorar(a.caminho.split('/'), a.tamanhoBytes)
    if (motivo) contar(r.ignorados, motivo)
    return !motivo
  })

  // 2) Clientes: cria os das pastas de cliente que faltam; depois resolve o cliente de cada arquivo.
  const filtro = opcoes.clientes ? new Set(opcoes.clientes.map(normalizarChave)) : null
  const roteada = (pasta: string) => rotearPeloNome.some((p) => normalizarChave(p) === normalizarChave(pasta))
  const pastasCliente = [...new Set(validos.map((a) => a.caminho.split('/')[0]))].filter(
    (p) => !roteada(p) && (!filtro || filtro.has(siglaDaPasta(p, mapa) ?? ''))
  )
  const rc = await garantirClientes(prisma, { aplicar, pastas: pastasCliente, mapa, nomes })
  r.clientes = { criados: rc.criados, renomeados: rc.renomeados, semNomeOficial: rc.semNomeOficial }
  const idsFiltro = filtro ? new Set([...filtro].map((s) => rc.clientes.get(s)?.id).filter((id): id is string => !!id)) : null

  const itens: ItemListado[] = []
  for (const a of validos) {
    const segmentos = a.caminho.split('/')
    const { resolucao, roteadoPeloNome, rotulo } = clienteDoArquivo(segmentos, rc.clientes, mapa, rotearPeloNome)
    if (resolucao.tipo === 'ignorar') {
      contar(r.ignorados, 'pasta ignorada no mapa')
      continue
    }
    if (resolucao.tipo === 'sem-cliente') {
      if (!filtro) contar(r.semCliente, rotulo)
      continue
    }
    if (idsFiltro && !idsFiltro.has(resolucao.clienteId)) continue
    itens.push({ ...a, segmentos, clienteId: resolucao.clienteId, rotuloCliente: resolucao.nome, publicacao: roteadoPeloNome })
  }

  // 3) Estrutura (só nomes): papel de cada arquivo e a que termo ele pertence.
  const estrutura = montarEstrutura(
    itens.filter((i) => !i.publicacao).map((i) => i.caminho),
    (pasta) => siglaDaPasta(pasta, mapa) ?? normalizarChave(pasta)
  )
  const lugarDe = new Map<string, { contrato: ContratoPasta; termo: TermoPasta }>()
  for (const contrato of estrutura) for (const termo of contrato.termos) for (const c of termo.arquivos) lugarDe.set(c, { contrato, termo })

  // 4) Arquivos → repositório e estado.
  const estados = new Map(
    (await prisma.arquivoSharepoint.findMany({ include: { arquivo: { select: { clienteId: true } } } })).map((e) => [e.caminho, e])
  )
  const noEscopo = (e: { arquivo: { clienteId: string } | null }) => !idsFiltro || (!!e.arquivo && idsFiltro.has(e.arquivo.clienteId))
  const ativo = new Map<string, { arquivoId: string | null; ativo: boolean }>(
    [...estados.values()].map((e) => [e.caminho, { arquivoId: e.arquivoId, ativo: e.removidoNaOrigemEm === null }])
  )
  const arquivoIdPorCaminho = new Map<string, string>()
  const hashPorCaminho = new Map<string, string>()
  const mudaram = new Set<string>()
  const candidatosRemocao = new Set<string>()
  const simulados = new Map<string, string>()

  for (const item of itens) {
    const estado = estados.get(item.caminho)
    const estadoAtivo = estado !== undefined && estado.removidoNaOrigemEm === null && estado.arquivoId !== null
    if (estadoAtivo && !mudouPorMetadado(estado, item)) {
      r.inalterados++
      arquivoIdPorCaminho.set(item.caminho, estado.arquivoId!)
      hashPorCaminho.set(item.caminho, estado.sha256)
      continue
    }
    try {
      const conteudo = await fonte.ler(item.caminho)
      const sha256 = sha256Hex(conteudo)
      hashPorCaminho.set(item.caminho, sha256)

      if (estadoAtivo && estado.sha256 === sha256) {
        // Só a data mudou (OneDrive regravou, alguém abriu e salvou igual).
        r.inalterados++
        arquivoIdPorCaminho.set(item.caminho, estado.arquivoId!)
        if (aplicar) {
          await prisma.arquivoSharepoint.update({ where: { id: estado.id }, data: { tamanhoBytes: conteudo.length, modificadoEm: item.modificadoEm, vistoEm: agora } })
        }
        continue
      }

      const nome = item.segmentos[item.segmentos.length - 1]
      const lugar = lugarDe.get(item.caminho)
      const papel: PapelArquivo = !lugar ? 'outro' : lugar.termo.termoPdf === item.caminho ? 'termo' : lugar.termo.propostaPdf === item.caminho ? 'proposta' : 'outro'
      const categoria = categoriaSharepoint(nome, { papel, inicial: lugar?.termo.tipo === 'CONTRATO', publicacao: item.publicacao })

      let arquivoId: string
      if (aplicar) {
        const registrado = await registrarConteudo(
          prisma,
          { clienteId: item.clienteId, nome, conteudo, sha256, categoria, origem: 'sharepoint', enviadoPorId: null },
          { gravarBlob }
        )
        if (registrado.novo) r.novos++
        else r.reaproveitados++
        arquivoId = registrado.id
      } else {
        arquivoId = await simularRegistro(prisma, item.clienteId, sha256, simulados, (novo) => (novo ? r.novos++ : r.reaproveitados++))
      }

      mudaram.add(item.caminho)
      arquivoIdPorCaminho.set(item.caminho, arquivoId)
      if (estadoAtivo) {
        r.conteudoTrocado++
        if (estado.arquivoId !== arquivoId) candidatosRemocao.add(estado.arquivoId!)
      }
      ativo.set(item.caminho, { arquivoId, ativo: true })

      if (aplicar) {
        const dados = { tamanhoBytes: conteudo.length, modificadoEm: item.modificadoEm, sha256, arquivoId, vistoEm: agora, removidoNaOrigemEm: null }
        await prisma.arquivoSharepoint.upsert({ where: { caminho: item.caminho }, create: { caminho: item.caminho, ...dados }, update: dados })
      }
    } catch (erro) {
      // Falha não é "sumiu": o estado fica como está e a próxima execução tenta de novo.
      r.falhas.push({ caminho: item.caminho, motivo: erro instanceof Error ? erro.message : String(erro) })
    }
  }

  // 5) Termos que mudaram: arquivo novo/trocado/movido, arquivo que sumiu da mesma pasta, ou arquivo
  //    que ainda não caiu em linha nenhuma.
  const ausentes = [...estados.values()].filter((e) => e.removidoNaOrigemEm === null && !listados.has(e.caminho) && noEscopo(e))
  const pastasComAusente = new Set(ausentes.map((e) => pastaDe(e.caminho)))
  const jaNoLugar = new Set([...estados.values()].filter((e) => e.historicoId !== null && e.removidoNaOrigemEm === null).map((e) => e.caminho))
  const processar = estrutura.filter(
    (c) => relerTudo || c.termos.some((t) => t.arquivos.some((a) => mudaram.has(a) || !jaNoLugar.has(a) || pastasComAusente.has(pastaDe(a))))
  )

  // 6) Contratos e linhas (campos lidos do PDF do termo de cada termo dos contratos processados).
  const contratosLidos: ContratoLido[] = []
  for (const contrato of processar) {
    const termos: TermoLido[] = []
    for (const termo of contrato.termos) {
      let campos: CamposTermo | null = null
      if (termo.termoPdf && opcoes.lerCampos && arquivoIdPorCaminho.has(termo.termoPdf)) {
        try {
          campos = await opcoes.lerCampos(await fonte.ler(termo.termoPdf), termo.tipo)
        } catch (erro) {
          r.contratos.avisos.push(`não li ${termo.termoPdf}: ${erro instanceof Error ? erro.message : String(erro)}`)
        }
      }
      termos.push({ ...termo, campos, hashes: termo.arquivos.map((a) => hashPorCaminho.get(a)).filter((h): h is string => !!h) })
    }
    contratosLidos.push({ ...contrato, termos })
  }
  const ri = await importar(prisma, { aplicar, contratos: contratosLidos, clientes: rc.clientes, arquivoIdPorCaminho })
  r.contratos = {
    processados: contratosLidos.length,
    contratosCriados: ri.contratosCriados,
    contratosCompletados: ri.contratosCompletados,
    linhasCriadas: ri.linhasCriadas,
    linhasCompletadas: ri.linhasCompletadas,
    anexosLigados: ri.anexosLigados,
    avisos: [...r.contratos.avisos, ...ri.avisos],
  }

  // 7) Onde cada arquivo caiu — só dos contratos processados (os outros não mudaram).
  if (aplicar) {
    for (const contrato of processar) {
      for (const termo of contrato.termos) {
        for (const caminho of termo.arquivos) {
          if (!arquivoIdPorCaminho.has(caminho)) continue // falhou: não tem estado novo
          await prisma.arquivoSharepoint.update({
            where: { caminho },
            data: { contratoId: ri.contratoPorCaminho.get(caminho) ?? null, historicoId: ri.linhaPorCaminho.get(caminho) ?? null },
          })
        }
      }
    }
  }

  // 8) Ausentes — com a trava contra listagem vazia.
  const ativosNoEscopo = [...estados.values()].filter((e) => e.removidoNaOrigemEm === null && noEscopo(e)).length
  if (ativosNoEscopo > 0 && itens.length < ativosNoEscopo * FRACAO_MINIMA_LISTADA) {
    r.remocaoSuspensa = `a pasta listou ${itens.length} arquivos e o estado tem ${ativosNoEscopo} ativos — remoção suspensa (OneDrive pausado ou pasta fora do ar?)`
  } else {
    for (const estado of ausentes) {
      r.sumiramDaOrigem++
      ativo.set(estado.caminho, { arquivoId: estado.arquivoId, ativo: false })
      if (estado.arquivoId) candidatosRemocao.add(estado.arquivoId)
      if (aplicar) await prisma.arquivoSharepoint.update({ where: { id: estado.id }, data: { removidoNaOrigemEm: agora } })
    }
  }

  const referenciados = new Set([...ativo.values()].filter((m) => m.ativo && m.arquivoId).map((m) => m.arquivoId!))
  const soltos = [...candidatosRemocao].filter((id) => !referenciados.has(id))
  if (soltos.length > 0) {
    // 8a) Coluna PC/PA–TC/TA do SharePoint apontando pra arquivo que não está mais na biblioteca: esvazia.
    //     (Objetos explícitos por coluna — chave calculada não passa no tipo do Prisma.)
    const soltar = [
      { where: { propostaArquivoId: { in: soltos }, propostaDoSharepoint: true }, data: { propostaArquivoId: null, propostaDoSharepoint: false } },
      { where: { termoArquivoId: { in: soltos }, termoDoSharepoint: true }, data: { termoArquivoId: null, termoDoSharepoint: false } },
    ]
    for (const { where, data } of soltar) {
      r.anexosSoltos += aplicar ? (await prisma.historicoContrato.updateMany({ where, data })).count : await prisma.historicoContrato.count({ where })
    }
    // 8b) Remoção lógica: só o que veio do SharePoint (ou das cópias migradas) e que nada do VerAI usa.
    const candidatos = await prisma.arquivoCliente.findMany({
      where: { id: { in: soltos }, origem: { in: ['sharepoint', 'migrado'] }, removidoEm: null },
      select: { id: true },
    })
    const usos = await buscarUsos(candidatos.map((a) => a.id))
    for (const { id } of candidatos) {
      const doVerai = (usos.get(id) ?? []).filter((u) => !u.daSincronizacao)
      if (doVerai.length > 0) {
        r.mantidosEmUso.push({ arquivoId: id, motivo: doVerai.map((u) => u.rotulo).join('; ') })
        continue
      }
      r.removidos++
      if (aplicar) await prisma.arquivoCliente.update({ where: { id }, data: { removidoEm: agora } })
    }
  }

  // 9) Conferência: a pasta contra o que ficou gravado.
  if (aplicar) {
    const gravados = await prisma.arquivoSharepoint.findMany({
      where: { removidoNaOrigemEm: null, arquivo: { removidoEm: null } },
      select: { caminho: true },
    })
    r.conferencia = conferir(new Map(itens.map((i) => [i.caminho, i.rotuloCliente])), new Set(gravados.map((g) => g.caminho)))
  }

  // 10) Auditoria das contas dos contratos dos clientes da execução (mesma regra das telas).
  if (aplicar && opcoes.auditar) {
    const ids = idsFiltro ? [...idsFiltro] : [...rc.clientes.values()].map((c) => c.id)
    r.auditoria = await opcoes.auditar(ids.filter((id) => !id.startsWith('simulado:')))
  }
  return r
}

/** Modo listagem: prevê se seria arquivo novo ou reaproveitado, sem gravar. */
async function simularRegistro(
  prisma: PrismaClient,
  clienteId: string,
  sha256: string,
  simulados: Map<string, string>,
  contar: (novo: boolean) => void
): Promise<string> {
  const existente = await prisma.arquivoCliente.findFirst({ where: { clienteId, sha256, removidoEm: null }, select: { id: true } })
  if (existente) {
    contar(false)
    return existente.id
  }
  const chave = `${clienteId}:${sha256}`
  const simulado = simulados.get(chave)
  contar(!simulado)
  if (simulado) return simulado
  const id = `simulado:${chave}`
  simulados.set(chave, id)
  return id
}
