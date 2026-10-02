import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { respostaErroPrisma } from '@/lib/relatorios-clientes/erros-prisma'
import { lerPlanilhaItens } from '@/lib/relatorios-clientes/importar-itens'
import { CONTRATO_NAO_ENCONTRADO, carregarContratoComAcesso } from '../../../carregar'

type Contexto = { params: Promise<{ id: string }> }

const TAMANHO_MAXIMO = 2 * 1024 * 1024

/** Importação em lote de itens por planilha (.xlsx/.csv), em dois passos com o mesmo endpoint:
 *  sem `confirmar` só valida e devolve a prévia; com `confirmar=1` grava. Tudo ou nada — qualquer
 *  linha com erro impede a gravação, pra planilha e banco nunca divergirem em silêncio. */
export async function POST(request: NextRequest, { params }: Contexto) {
  const { id: contratoId } = await params
  const carregado = await carregarContratoComAcesso(request, contratoId, 'editar')
  if ('erro' in carregado) return carregado.erro

  let formulario: FormData
  try {
    formulario = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Envie o arquivo como multipart/form-data.' }, { status: 400 })
  }
  const arquivo = formulario.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return NextResponse.json({ error: 'Arquivo: campo obrigatório' }, { status: 400 })
  }
  if (!/\.(xlsx|csv)$/i.test(arquivo.name)) {
    return NextResponse.json({ error: 'Envie um arquivo .xlsx ou .csv.' }, { status: 400 })
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json({ error: 'Arquivo maior que 2 MB.' }, { status: 413 })
  }

  const { linhas, erros } = await lerPlanilhaItens(Buffer.from(await arquivo.arrayBuffer()), arquivo.name)
  const confirmar = formulario.get('confirmar') === '1'

  // Linha igual a um item que o contrato JÁ tem (mesma descrição, quantidade, unitário e total) não
  // entra de novo: importar a mesma planilha duas vezes dobrava o valor contratado. Conta por
  // ocorrência — se o contrato tem o item 2×, as 2 primeiras iguais da planilha são as repetidas.
  const existentes = await prisma.itemContrato.findMany({
    where: { contratoId },
    select: { descricao: true, quantidade: true, valorUnitario: true, valorTotal: true },
  })
  const restantes = new Map<string, number>()
  for (const item of existentes) {
    const chave = chaveItem(item)
    restantes.set(chave, (restantes.get(chave) ?? 0) + 1)
  }
  const repetidas: number[] = []
  const novas = linhas.filter((linha) => {
    const chave = chaveItem(linha)
    const sobra = restantes.get(chave) ?? 0
    if (sobra === 0) return true
    restantes.set(chave, sobra - 1)
    repetidas.push(linha.linha)
    return false
  })

  if (!confirmar || erros.length > 0) {
    return NextResponse.json({ confirmado: false, linhas, erros, itensExistentes: existentes.length, repetidas })
  }

  try {
    await prisma.itemContrato.createMany({
      data: novas.map(({ descricao, quantidade, valorUnitario, valorTotal }) => ({
        contratoId,
        descricao,
        quantidade,
        valorUnitario,
        valorTotal,
      })),
    })
    return NextResponse.json(
      { confirmado: true, criados: novas.length, ignoradas: repetidas.length, linhas: [], erros: [] },
      { status: 201 }
    )
  } catch (erro) {
    return respostaErroPrisma(erro, CONTRATO_NAO_ENCONTRADO)
  }
}

type Decimalish = { toString(): string } | string | null

function chaveItem(item: { descricao: string | null; quantidade: Decimalish; valorUnitario: Decimalish; valorTotal: Decimalish }): string {
  const numero = (v: Decimalish) => (v === null ? '' : new Prisma.Decimal(v.toString()).toFixed(2))
  const texto = (item.descricao ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
  return [texto, numero(item.quantidade), numero(item.valorUnitario), numero(item.valorTotal)].join('|')
}
