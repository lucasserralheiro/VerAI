import { NextRequest, NextResponse } from 'next/server'

import { consultarNoConfere, resultadoDoConfere } from '@/lib/confere/cliente'
import { lerBilhete } from '@/lib/confere/execucao-assincrona'
import { registrarNoHistorico } from '@/lib/confere/historico'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'

/** Cada consulta é curta; o fim (buscar ~5 MB e gravar o histórico) é o mais
 *  longo, e cabe com folga. */
export const maxDuration = 120

/**
 * Consulta de uma geração assíncrona do Confere (20/10/2026) — a tela chama a
 * cada poucos segundos com o bilhete que `POST /api/confere/reports` devolveu.
 *
 * - **202** `{ situacao, fase, posicao, segundos }`: ainda na fila ou processando.
 * - **200 / 422 / erro**: o mesmo que o envio síncrono devolveria — relatório
 *   (com `historico_salvo`), bloqueio, ou `{ detail }`. A tela trata igual.
 * - **410** `{ detail }`: o Confere não tem mais este job (reiniciou, ou o
 *   resultado expirou). Esperar não adianta; a tela pede um novo envio.
 *
 * O histórico é gravado aqui, na primeira consulta que encontra o resultado
 * pronto — e só ela grava: `registrarNoHistorico` não duplica a linha.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ execucao: string }> }) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  const { execucao: bilhete } = await params

  const execucao = lerBilhete(decodeURIComponent(bilhete), autenticado.usuario.id)
  if (!execucao) {
    return NextResponse.json({ detail: 'Esta geração não pertence a você ou o link expirou.' }, { status: 404 })
  }

  const consulta = await consultarNoConfere(execucao.job)
  if (consulta.tipo === 'andamento') {
    const { tipo: _tipo, ...andamento } = consulta
    return NextResponse.json(andamento, { status: 202, headers: { 'Cache-Control': 'no-store' } })
  }
  if (consulta.tipo === 'perdido') {
    return NextResponse.json({ detail: consulta.mensagem }, { status: 410 })
  }
  if (consulta.tipo === 'erro') {
    // Falha de uma consulta não é falha da geração: a tela tenta de novo.
    return NextResponse.json({ detail: consulta.mensagem, transitorio: true }, { status: 503 })
  }

  const resultado = await resultadoDoConfere(execucao.job)
  if (resultado.tipo === 'concluido') {
    const salvo = await registrarNoHistorico(
      resultado.resposta,
      execucao.nomes,
      { contratoId: execucao.contratoId, competencia: execucao.competencia },
      execucao.entradas,
      execucao.execucao
    )
    return NextResponse.json({ ...resultado.resposta, historico_salvo: salvo }, { status: 200 })
  }
  if (resultado.tipo === 'bloqueado') {
    return NextResponse.json(resultado.resposta, { status: 422 })
  }
  if (resultado.tipo === 'tempo-esgotado') {
    return NextResponse.json({ detail: 'O resultado demorou a chegar. Tente de novo.', transitorio: true }, { status: 503 })
  }
  return NextResponse.json({ detail: resultado.mensagem }, { status: 502 })
}
