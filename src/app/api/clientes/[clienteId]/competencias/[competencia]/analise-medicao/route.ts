import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerCliente } from '@/lib/visibilidade'
import { parseCompetencia } from '@/lib/competencia'
import { buildArquivoMedicaoPath, buildRelatorioMedicaoPath, putUpload } from '@/lib/storage'
import { chamarConfere } from '@/lib/confere/cliente'

// Cold-start do Render (free tier, ~1min) + geração do Confere (~30s) —
// ver docs/superpowers/specs/2026-09-21-integracao-confere-design.md §3.4.
export const maxDuration = 120

const TIPO_CONTEUDO_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const TIPO_CONTEUDO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clienteId: string; competencia: string }> }
) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { clienteId, competencia } = await params
  const parsed = parseCompetencia(competencia)
  if (!parsed) {
    return NextResponse.json({ error: 'competência inválida (esperado AAAA-MM)' }, { status: 400 })
  }

  const podeVer = await podeVerCliente(usuario, clienteId)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  const analise = await prisma.analiseMedicaoContratual.findUnique({
    where: {
      clienteId_competenciaAno_competenciaMes: {
        clienteId,
        competenciaAno: parsed.ano,
        competenciaMes: parsed.mes,
      },
    },
    include: { arquivos: true },
  })

  return NextResponse.json(analise)
}

function arquivoDeCampo(formData: FormData, campo: string): File | null {
  const valor = formData.get(campo)
  return valor instanceof File ? valor : null
}

interface EntradaParaSalvar {
  papel: string
  nome: string
  buffer: Buffer
  ordem: number
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clienteId: string; competencia: string }> }
) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { clienteId, competencia } = await params
  const parsed = parseCompetencia(competencia)
  if (!parsed) {
    return NextResponse.json({ error: 'competência inválida (esperado AAAA-MM)' }, { status: 400 })
  }

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } })
  if (!cliente) {
    return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  }

  const podeVer = await podeVerCliente(usuario, clienteId)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  const formData = await request.formData().catch(() => null)
  const contrato = formData ? arquivoDeCampo(formData, 'contrato') : null
  const levantamento = formData ? arquivoDeCampo(formData, 'levantamento') : null
  if (!contrato || !levantamento) {
    return NextResponse.json({ error: '"contrato" e "levantamento" são obrigatórios' }, { status: 400 })
  }
  const aditivos = formData!.getAll('aditivos').filter((valor): valor is File => valor instanceof File)
  const identidadeConfirmada = formData!.get('identidadeConfirmada') === 'true'

  const contratoBuffer = Buffer.from(await contrato.arrayBuffer())
  const levantamentoBuffer = Buffer.from(await levantamento.arrayBuffer())
  const aditivosBuffers = await Promise.all(
    aditivos.map(async (arquivo) => ({ nome: arquivo.name, bytes: Buffer.from(await arquivo.arrayBuffer()) }))
  )

  const resultado = await chamarConfere({
    contrato: { nome: contrato.name, bytes: contratoBuffer },
    levantamento: { nome: levantamento.name, bytes: levantamentoBuffer },
    aditivos: aditivosBuffers,
    identidadeConfirmada,
  })

  // Arquivos de ENTRADA sobem sempre, qualquer que seja o resultado — é
  // auditoria do que foi submetido nesta tentativa, não prova de proveniência
  // de um relatório específico (ver storage.ts `buildArquivoMedicaoPath`).
  const entradas: EntradaParaSalvar[] = [
    { papel: 'contrato', nome: contrato.name, buffer: contratoBuffer, ordem: 0 },
    { papel: 'levantamento', nome: levantamento.name, buffer: levantamentoBuffer, ordem: 0 },
    ...aditivosBuffers.map((arquivo, indice) => ({
      papel: 'aditivo',
      nome: arquivo.nome,
      buffer: arquivo.bytes,
      ordem: indice + 1,
    })),
  ]
  const arquivosParaSalvar = await Promise.all(
    entradas.map(async (entrada) => {
      const caminho = buildArquivoMedicaoPath(
        clienteId,
        parsed.ano,
        parsed.mes,
        entrada.papel,
        entrada.ordem,
        entrada.nome
      )
      const url = await putUpload(caminho, entrada.buffer)
      return {
        papel: entrada.papel,
        nomeArquivo: entrada.nome,
        tamanhoBytes: entrada.buffer.length,
        caminhoOriginal: url,
        ordem: entrada.ordem,
      }
    })
  )

  let dados: Prisma.AnaliseMedicaoContratualUncheckedCreateInput
  let statusResposta: number

  if (resultado.tipo === 'concluido') {
    const docxBuffer = Buffer.from(resultado.resposta.docx_base64, 'base64')
    const xlsxBuffer = Buffer.from(resultado.resposta.analise_xlsx_base64, 'base64')
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { docx_base64, analise_xlsx_base64, ...resultadoEstruturado } = resultado.resposta

    const caminhoDocx = buildRelatorioMedicaoPath(clienteId, parsed.ano, parsed.mes, 'docx')
    const caminhoXlsx = buildRelatorioMedicaoPath(clienteId, parsed.ano, parsed.mes, 'xlsx')
    const [urlDocx, urlXlsx] = await Promise.all([
      putUpload(caminhoDocx, docxBuffer, TIPO_CONTEUDO_DOCX),
      putUpload(caminhoXlsx, xlsxBuffer, TIPO_CONTEUDO_XLSX),
    ])

    statusResposta = 200
    dados = {
      clienteId,
      competenciaAno: parsed.ano,
      competenciaMes: parsed.mes,
      status: 'concluido',
      mensagemErro: null,
      identidadeConfirmada,
      resultado: resultadoEstruturado as unknown as Prisma.InputJsonValue,
      achadosBloqueio: Prisma.JsonNull,
      caminhoRelatorioDocx: urlDocx,
      caminhoRelatorioXlsx: urlXlsx,
      relatorioGeradoEm: new Date(),
    }
  } else if (resultado.tipo === 'bloqueado') {
    statusResposta = 422
    dados = {
      clienteId,
      competenciaAno: parsed.ano,
      competenciaMes: parsed.mes,
      status: 'bloqueado',
      mensagemErro: null,
      identidadeConfirmada,
      resultado: Prisma.JsonNull,
      achadosBloqueio: resultado.resposta as unknown as Prisma.InputJsonValue,
      caminhoRelatorioDocx: null,
      caminhoRelatorioXlsx: null,
      relatorioGeradoEm: null,
    }
  } else {
    statusResposta = 502
    dados = {
      clienteId,
      competenciaAno: parsed.ano,
      competenciaMes: parsed.mes,
      status: 'erro',
      mensagemErro: resultado.mensagem,
      identidadeConfirmada,
      resultado: Prisma.JsonNull,
      achadosBloqueio: Prisma.JsonNull,
      caminhoRelatorioDocx: null,
      caminhoRelatorioXlsx: null,
      relatorioGeradoEm: null,
    }
  }

  const analise = await prisma.analiseMedicaoContratual.upsert({
    where: {
      clienteId_competenciaAno_competenciaMes: {
        clienteId,
        competenciaAno: parsed.ano,
        competenciaMes: parsed.mes,
      },
    },
    create: { ...dados, arquivos: { create: arquivosParaSalvar } },
    update: { ...dados, arquivos: { deleteMany: {}, create: arquivosParaSalvar } },
    include: { arquivos: true },
  })

  return NextResponse.json(analise, { status: statusResposta })
}
