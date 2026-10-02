import { tool, type ToolSet } from 'ai'
import type { ContextoFerramenta, Ferramenta } from './comum'
import { compactar, cortarPorLinha } from './compacto'
import { buscarClientes, resumoDoCliente } from './clientes'
import { buscarPorSei, contratosVencendo, detalheDoContrato, itensDoContrato } from './contratos'
import { demandas, faturamentos, fornecedores, solicitacoes, tramitesDaDemanda } from './operacao'
import { analisesDeDocumentos, buscarNosDocumentos, execucoesConfere, propostasComerciais } from './conteudo'
import { alertas } from './alertas'
import { consultarManual } from './manual'
import { buscarNasNormas } from './normas'
import { fichasDoContrato } from './fichas'
import { consultarTabelaDePrecos } from './precos'
import { calendarioFaturamento } from './calendario'
import { indiceIpcFipe, reajustesCalculados, simularReajuste } from './reajuste'
import { controleDoFaturamento } from './controles'
import { linksMpls } from './links'
import { anexosDaConversa, lerAnexo } from './anexos'

export { ROTULOS_FERRAMENTAS } from './rotulos'

export const FERRAMENTAS: Record<string, Ferramenta> = {
  buscarClientes,
  resumoDoCliente,
  detalheDoContrato,
  itensDoContrato,
  contratosVencendo,
  buscarPorSei,
  faturamentos,
  demandas,
  tramitesDaDemanda,
  solicitacoes,
  fornecedores,
  propostasComerciais,
  analisesDeDocumentos,
  execucoesConfere,
  buscarNosDocumentos,
  alertas,
  consultarManual,
  buscarNasNormas,
  fichasDoContrato,
  consultarTabelaDePrecos,
  calendarioFaturamento,
  indiceIpcFipe,
  simularReajuste,
  reajustesCalculados,
  controleDoFaturamento,
  linksMpls,
  anexosDaConversa,
  lerAnexo,
} as Record<string, Ferramenta>

export async function executarComSeguranca(
  nome: string,
  ferramenta: Ferramenta,
  entrada: unknown,
  contexto: ContextoFerramenta
): Promise<unknown> {
  try {
    return await ferramenta.executar(entrada as never, contexto)
  } catch (erro) {
    console.error(`[assistente] ferramenta ${nome} falhou`, erro)
    return { erro: `falha ao consultar ${nome}` }
  }
}

const temErro = (saida: unknown): saida is { erro: string } =>
  typeof saida === 'object' && saida !== null && typeof (saida as { erro?: unknown }).erro === 'string'

/** O que o modelo recebe de uma ferramenta. A régua mede por aqui, antes e depois. */
export function textoParaModelo(nome: string, saida: unknown): string {
  if (temErro(saida)) return `erro: ${saida.erro}`
  const ferramenta = FERRAMENTAS[nome]
  return cortarPorLinha(ferramenta?.compactar ? ferramenta.compactar(saida) : compactar(saida))
}

/** O usuário entra por closure: a IA nunca escolhe em nome de quem a consulta roda. */
export function criarFerramentas(contexto: ContextoFerramenta): ToolSet {
  return Object.fromEntries(
    Object.entries(FERRAMENTAS).map(([nome, ferramenta]) => [
      nome,
      tool({
        description: ferramenta.descricao,
        inputSchema: ferramenta.entrada,
        execute: async (entrada: unknown) => executarComSeguranca(nome, ferramenta, entrada, contexto),
        // A tela recebe o objeto (stream); o modelo, só o texto compacto.
        toModelOutput: ({ output }) => ({ type: 'text', value: textoParaModelo(nome, output) }),
      }),
    ])
  )
}
