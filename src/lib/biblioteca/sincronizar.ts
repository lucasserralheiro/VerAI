import type { PrismaClient } from '@prisma/client'
import { putR2 } from '@/lib/r2'
import { sha256Hex } from '@/lib/arquivos/servico'
import { contentTypeDe, extensaoDe } from '@/lib/arquivos/tipos'
import { motivoIgnorar } from '@/lib/arquivos/sharepoint/regras'
import type { FonteArquivos } from '@/lib/arquivos/sharepoint/sincronizar'
import { areaDoCaminho, BIBLIOTECA_DOCUMENTOS, chaveR2Biblioteca, type AreaBiblioteca } from './areas'
import type { ArquivoDaArea, LeitorDeArea } from './leitores'

// Biblioteca "Documentos" do SharePoint → VerAI (spec
// docs/superpowers/specs/2026-09-29-biblioteca-documentos-prodam-design.md §5): listagem, arquivo
// novo/mudado para o R2 pelo conteúdo, remoção lógica, leitor por área e conferência. A fonte é
// injetada, como na ContratosReceita.

export interface ConferenciaArea {
  area: AreaBiblioteca
  noSharepoint: number
  noVerai: number
  faltando: string[]
}

export interface ResultadoBiblioteca {
  listados: number
  ignorados: number
  novos: number
  mudados: number
  iguais: number
  removidos: number
  falhas: { caminho: string; motivo: string }[]
  leituras: string[]
  /** `null` em só listagem. */
  conferencia: ConferenciaArea[] | null
  remocaoSuspensa: string | null
}

export interface OpcoesBiblioteca {
  aplicar: boolean
  fonte: FonteArquivos
  leitores?: Partial<Record<AreaBiblioteca, LeitorDeArea>>
  /** Áreas cujo leitor roda mesmo sem mudança (`--reler=`). */
  relerAreas?: AreaBiblioteca[]
  /** Padrão: Cloudflare R2. Devolve o endereço guardado em `chave`. */
  gravar?: (chave: string, conteudo: Buffer, contentType: string) => Promise<string>
  agora?: Date
}

/** Abaixo disso a listagem é falha da fonte (OneDrive pausado) — melhor não remover nada. */
const FRACAO_MINIMA_LISTADA = 0.5

const nomeDe = (caminho: string) => caminho.slice(caminho.lastIndexOf('/') + 1)
const mensagem = (erro: unknown) => (erro instanceof Error ? erro.message : String(erro)).slice(0, 500)

export async function sincronizarBiblioteca(prisma: PrismaClient, opcoes: OpcoesBiblioteca): Promise<ResultadoBiblioteca> {
  const { aplicar, fonte, leitores = {}, relerAreas = [] } = opcoes
  const gravar = opcoes.gravar ?? putR2
  const agora = opcoes.agora ?? new Date()
  const r: ResultadoBiblioteca = {
    listados: 0,
    ignorados: 0,
    novos: 0,
    mudados: 0,
    iguais: 0,
    removidos: 0,
    falhas: [],
    leituras: [],
    conferencia: null,
    remocaoSuspensa: null,
  }

  const lista = (await fonte.listar()).filter((a) => {
    const ignorar = motivoIgnorar(a.caminho.split('/'), a.tamanhoBytes)
    if (ignorar) r.ignorados++
    return !ignorar
  })
  r.listados = lista.length

  const estado = await prisma.arquivoBiblioteca.findMany({ where: { biblioteca: BIBLIOTECA_DOCUMENTOS } })
  const porCaminho = new Map(estado.map((e) => [e.caminho, e]))
  const tocadas = new Set<AreaBiblioteca>(relerAreas)
  const mudados: string[] = []
  const iguais: string[] = []

  for (const a of lista) {
    const e = porCaminho.get(a.caminho)
    const ativo = e && !e.removidoNaOrigemEm ? e : null
    // Mesmo tamanho e data: nem lê (ler baixa o arquivo do OneDrive).
    if (ativo && ativo.tamanhoBytes === a.tamanhoBytes && ativo.modificadoEm.getTime() === a.modificadoEm.getTime()) {
      r.iguais++
      iguais.push(ativo.id)
      continue
    }
    if (!aplicar) {
      if (ativo) r.mudados++
      else r.novos++
      continue
    }
    try {
      const conteudo = await fonte.ler(a.caminho)
      const sha256 = sha256Hex(conteudo)
      if (ativo && ativo.sha256 === sha256) {
        await prisma.arquivoBiblioteca.update({
          where: { id: ativo.id },
          data: { tamanhoBytes: a.tamanhoBytes, modificadoEm: a.modificadoEm, vistoEm: agora },
        })
        r.iguais++
        continue
      }
      const nome = nomeDe(a.caminho)
      const extensao = extensaoDe(nome)
      const contentType = contentTypeDe(nome)
      const area = areaDoCaminho(a.caminho)
      const chave = await gravar(chaveR2Biblioteca(sha256, extensao), conteudo, contentType)
      const dados = {
        area,
        nome,
        extensao,
        contentType,
        tamanhoBytes: a.tamanhoBytes,
        sha256,
        chave,
        modificadoEm: a.modificadoEm,
        vistoEm: agora,
        removidoNaOrigemEm: null,
        leituraStatus: null,
        leituraMensagem: null,
        lidoEm: null,
      }
      const salvo = e
        ? await prisma.arquivoBiblioteca.update({ where: { id: e.id }, data: dados })
        : await prisma.arquivoBiblioteca.create({ data: { biblioteca: BIBLIOTECA_DOCUMENTOS, caminho: a.caminho, ...dados } })
      if (ativo) r.mudados++
      else r.novos++
      mudados.push(salvo.id)
      tocadas.add(area)
    } catch (erro) {
      r.falhas.push({ caminho: a.caminho, motivo: mensagem(erro) })
    }
  }

  const naPasta = new Set(lista.map((a) => a.caminho))
  const ativos = estado.filter((e) => !e.removidoNaOrigemEm)
  const sumiram = ativos.filter((e) => !naPasta.has(e.caminho))
  if (ativos.length > 0 && lista.length < ativos.length * FRACAO_MINIMA_LISTADA) {
    r.remocaoSuspensa = `listagem com ${lista.length} arquivo(s) contra ${ativos.length} registrados — remoção suspensa (OneDrive pausado?)`
  } else {
    r.removidos = sumiram.length
    if (aplicar && sumiram.length > 0) {
      await prisma.arquivoBiblioteca.updateMany({ where: { id: { in: sumiram.map((e) => e.id) } }, data: { removidoNaOrigemEm: agora } })
      for (const e of sumiram) tocadas.add(areaDoCaminho(e.caminho))
    }
  }
  if (!aplicar) return r

  if (iguais.length > 0) await prisma.arquivoBiblioteca.updateMany({ where: { id: { in: iguais } }, data: { vistoEm: agora } })

  for (const area of tocadas) {
    const leitor = leitores[area]
    if (!leitor) continue
    try {
      const todos: ArquivoDaArea[] = await prisma.arquivoBiblioteca.findMany({
        where: { biblioteca: BIBLIOTECA_DOCUMENTOS, area, removidoNaOrigemEm: null },
        select: { id: true, caminho: true, nome: true, extensao: true, sha256: true, modificadoEm: true },
      })
      r.leituras.push(await leitor({ prisma, todos, mudados, ler: (arquivo) => fonte.ler(arquivo.caminho) }))
    } catch (erro) {
      r.leituras.push(`${area}: leitura falhou — ${mensagem(erro)}`)
    }
  }

  const gravados = await prisma.arquivoBiblioteca.findMany({
    where: { biblioteca: BIBLIOTECA_DOCUMENTOS, removidoNaOrigemEm: null },
    select: { caminho: true },
  })
  const noVerai = new Set(gravados.map((g) => g.caminho))
  const porArea = new Map<AreaBiblioteca, ConferenciaArea>()
  for (const a of lista) {
    const area = areaDoCaminho(a.caminho)
    const linha = porArea.get(area) ?? { area, noSharepoint: 0, noVerai: 0, faltando: [] }
    linha.noSharepoint++
    if (noVerai.has(a.caminho)) linha.noVerai++
    else linha.faltando.push(a.caminho)
    porArea.set(area, linha)
  }
  r.conferencia = [...porArea.values()]
  return r
}
