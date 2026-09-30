import { randomUUID } from 'node:crypto'
import Decimal from 'decimal.js'
import { NextRequest, NextResponse } from 'next/server'
import { extrairPaginas } from '@/lib/assistente/indexacao/extrair'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TIPOS_DE_ENVIO, ehEnderecoDeEnvio } from '@/lib/propostas/envio'
import { deleteR2, putR2 } from '@/lib/r2'
import { CONTENT_TYPE_XLSX, chaveDoOriginal, chaveDoResultado, chaveDoTemporario, lerDoR2 } from '@/lib/reajuste/arquivos'
import { calcularPeriodo, fatorCompleto } from '@/lib/reajuste/calculo'
import { lerIndiceGravado } from '@/lib/reajuste/indice'
import { abrirPlanilha, valoresNoTexto } from '@/lib/reajuste/leitura'
import { dataParaMes, mesParaData } from '@/lib/reajuste/meses'
import { planilhaCorrigida, planilhaDeComparacao } from '@/lib/reajuste/resultado'
import { ArquivoIlegivel, type TipoArquivoReajuste } from '@/lib/reajuste/tipos'

export const maxDuration = 120

const MES = /^\d{4}-(0[1-9]|1[0-2])$/

interface Pedido {
  endereco?: unknown
  nomeArquivo?: unknown
  inicial?: unknown
  final?: unknown
  colunas?: Array<{ aba: string; coluna: number; linhaCabecalho: number }>
  valores?: number[]
}

/** Histórico: todo mundo vê tudo, como no ConfereAI (spec §2.4). */
export async function GET(request: NextRequest) {
  if (!(await getAuthUser(request))) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const linhas = await prisma.reajusteExecucao.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { usuario: { select: { nome: true } } },
  })
  return NextResponse.json(
    linhas.map((l) => ({
      id: l.id,
      nomeArquivo: l.nomeArquivo,
      tipoArquivo: l.tipoArquivo,
      mesInicial: dataParaMes(l.mesInicial),
      mesFinal: dataParaMes(l.mesFinal),
      acumuladoPct: l.acumuladoPct.toString(),
      fator: l.fator.toFixed(6),
      quantidadeValores: l.quantidadeValores,
      usuario: l.usuario.nome,
      createdAt: l.createdAt.toISOString(),
    }))
  )
}

/** Gera o reajuste: recalcula tudo aqui (não confia no navegador), grava original e resultado no R2
 *  e o registro no histórico. Nada entra no histórico se algo falhar antes do `create`. */
export async function POST(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const p = ((await request.json().catch(() => null)) ?? {}) as Pedido
  const endereco = typeof p.endereco === 'string' ? p.endereco : ''
  const nomeArquivo = typeof p.nomeArquivo === 'string' && p.nomeArquivo.trim() ? p.nomeArquivo.trim() : 'arquivo'
  if (!ehEnderecoDeEnvio(endereco)) return NextResponse.json({ error: 'arquivo inválido' }, { status: 400 })
  if (typeof p.inicial !== 'string' || typeof p.final !== 'string' || !MES.test(p.inicial) || !MES.test(p.final)) {
    return NextResponse.json({ error: 'período inválido' }, { status: 400 })
  }
  const tipo = endereco.split('.').pop() as TipoArquivoReajuste
  const ehPlanilha = tipo === 'xlsx' || tipo === 'csv'
  const colunas = Array.isArray(p.colunas) ? p.colunas : []
  const indices = new Set(Array.isArray(p.valores) ? p.valores.filter(Number.isInteger) : [])
  if ((ehPlanilha && colunas.length === 0) || (!ehPlanilha && indices.size === 0)) {
    return NextResponse.json({ error: 'marque ao menos um valor para corrigir' }, { status: 400 })
  }

  const indice = await lerIndiceGravado()
  const calculo = calcularPeriodo(p.inicial, p.final, new Map(indice.meses.map((m) => [m.mes, m.variacao])))
  if (!calculo.ok) {
    const error = 'faltando' in calculo ? `índice ainda não publicado: ${calculo.faltando.join(', ')}` : calculo.erro
    return NextResponse.json({ error }, { status: 400 })
  }

  const temporario = chaveDoTemporario(endereco)
  const original = await lerDoR2(temporario)
  const resumo = {
    meses: calculo.meses,
    fator: calculo.fator,
    acumuladoPct: calculo.acumuladoPct,
    usuario: usuario.nome,
    geradoEm: new Date(),
    arquivo: nomeArquivo,
  }
  let resultado: { buffer: Buffer; quantidade: number }
  try {
    if (ehPlanilha) {
      resultado = await planilhaCorrigida(await abrirPlanilha(original, tipo), colunas, resumo)
    } else {
      const valores = valoresNoTexto(await extrairPaginas(original, tipo)).filter((v) => indices.has(v.indice))
      resultado = await planilhaDeComparacao(valores, resumo)
    }
  } catch (erro) {
    if (erro instanceof ArquivoIlegivel) return NextResponse.json({ error: erro.message }, { status: 422 })
    throw erro
  }

  const id = randomUUID()
  await putR2(chaveDoOriginal(id, tipo), original, TIPOS_DE_ENVIO[tipo])
  await putR2(chaveDoResultado(id), resultado.buffer, CONTENT_TYPE_XLSX)
  await prisma.reajusteExecucao.create({
    data: {
      id,
      usuarioId: usuario.id,
      nomeArquivo,
      tipoArquivo: tipo,
      chaveOriginal: chaveDoOriginal(id, tipo),
      chaveResultado: chaveDoResultado(id),
      mesInicial: mesParaData(p.inicial),
      mesFinal: mesParaData(p.final),
      fator: fatorCompleto(calculo.meses).toFixed(8, Decimal.ROUND_HALF_UP),
      acumuladoPct: calculo.acumuladoPct,
      meses: calculo.meses,
      quantidadeValores: resultado.quantidade,
    },
  })
  // Temporário que sobra não quebra nada: o original já está guardado.
  await deleteR2(temporario).catch(() => {})
  return NextResponse.json({ id })
}
