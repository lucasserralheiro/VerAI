import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { clienteIdsPermitidos, podeVerCliente } from '@/lib/visibilidade'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { controleDoContrato, listarControles } from '@/lib/controles-contratos/consultas'
import { nomeDoMes, type ControleSerializado } from '@/lib/controles-contratos/tipos'
import { SELECT_CONTRATO } from '@/app/api/contratos/esquema'
import { definirFerramenta, moeda, NAO_ENCONTRADO } from './comum'

// Controle do faturamento (PDF mensal da equipe; spec 2026-09-29-controles-de-contratos). Faturado = só até o
// mês da pasta (`separarFaturado`, já aplicado); tabela que não fecha fica sem número.

const NAO_CONFERIDA = 'leitura não conferida — confira no PDF'

/** Os números lidos do controle, ou `null` quando a tabela não foi conferida. */
const numerosDoControle = (c: ControleSerializado) =>
  !c.conferido || c.previsto === null || c.faturado === null
    ? null
    : {
        previsto: moeda(c.previsto),
        faturadoAteOMes: moeda(c.faturado),
        saldo: moeda(c.saldoCalculado),
        percentual: c.percentual === null ? null : `${c.percentual}%`,
        ...(c.aFrente ? { lancadoAFrente: `${moeda(c.aFrente.total)} (${c.aFrente.periodos.join(', ')}) — previsão, fora do faturado` } : {}),
      }

function diferenca(controle: string, verai: string): string {
  const d = Math.round(Number(controle) * 100) - Math.round(Number(verai) * 100)
  if (d === 0) return 'igual ao VerAI'
  return `o controle tem ${moeda((Math.abs(d) / 100).toFixed(2))} a ${d > 0 ? 'mais' : 'menos'} que o VerAI`
}

export const controleDoFaturamento = definirFerramenta({
  descricao:
    'Controle do faturamento (PDF mensal da equipe do faturamento por contrato): previsto, faturado até o mês do controle, saldo e o lançado à frente, lado a lado com o faturado e o saldo do VerAI ("bate com o sistema?", "quanto o faturamento diz que foi pago"). Com contratoId: o controle mais recente do contrato. Com clienteId: os controles do mês (padrão: o mais recente) dos contratos do cliente.',
  entrada: z
    .object({ contratoId: z.string().optional(), clienteId: z.string().optional(), mes: z.string().regex(/^\d{4}-\d{2}$/).optional() })
    .refine((e) => e.contratoId || e.clienteId, 'informe contratoId ou clienteId'),
  async executar({ contratoId, clienteId, mes }, { usuario, hoje }) {
    if (contratoId) {
      const c = await prisma.contrato.findUnique({ where: { id: contratoId }, select: SELECT_CONTRATO })
      if (!c || !(await podeVerCliente(usuario, c.clienteId))) return NAO_ENCONTRADO
      const achado = await controleDoContrato(contratoId)
      if (!achado) return { erro: 'nenhum controle do faturamento lido para este contrato' }
      const { controle } = achado
      const saldo = (await consolidarContratos([c], hoje)).get(c.id)?.saldo
      const numeros = numerosDoControle(controle)
      return {
        contrato: c.numeroTermo,
        mesDoControle: nomeDoMes(controle.mes),
        conferido: controle.conferido,
        controle: numeros ?? NAO_CONFERIDA,
        verai: saldo
          ? { faturado: moeda(saldo.faturado), saldo: saldo.saldo === null ? null : moeda(saldo.saldo), percentual: saldo.percentualFaturado === null ? null : `${saldo.percentualFaturado}%` }
          : null,
        ...(numeros && saldo ? { diferencaFaturado: diferenca(controle.faturado!, saldo.faturado.toString()) } : {}),
        avisos: controle.avisos,
        pdf: `arquivo da biblioteca ${controle.arquivoId}`,
      }
    }
    if (!(await podeVerCliente(usuario, clienteId!))) return NAO_ENCONTRADO
    const lista = await listarControles({ mes, clienteIds: await clienteIdsPermitidos(usuario) })
    const doCliente = lista.controles.filter((c) => c.clienteId === clienteId)
    if (doCliente.length === 0) return { erro: `nenhum controle do faturamento deste cliente em ${lista.mes ? nomeDoMes(lista.mes) : 'nenhum mês'}` }
    return {
      mesDoControle: lista.mes ? nomeDoMes(lista.mes) : null,
      controles: doCliente.map((c) => ({
        contrato: c.contratoTexto,
        contratoId: c.contratoId,
        ...(numerosDoControle(c) ?? { leitura: NAO_CONFERIDA }),
        avisos: c.avisos.length,
      })),
    }
  },
})
