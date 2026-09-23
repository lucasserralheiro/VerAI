import { NextRequest, NextResponse } from 'next/server'
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
  const carregado = await carregarContratoComAcesso(request, contratoId)
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

  if (!confirmar || erros.length > 0) {
    const itensExistentes = await prisma.itemContrato.count({ where: { contratoId } })
    return NextResponse.json({ confirmado: false, linhas, erros, itensExistentes })
  }

  try {
    await prisma.itemContrato.createMany({
      data: linhas.map(({ descricao, quantidade, valorUnitario, valorTotal }) => ({
        contratoId,
        descricao,
        quantidade,
        valorUnitario,
        valorTotal,
      })),
    })
    return NextResponse.json({ confirmado: true, criados: linhas.length, linhas: [], erros: [] }, { status: 201 })
  } catch (erro) {
    return respostaErroPrisma(erro, CONTRATO_NAO_ENCONTRADO)
  }
}
