import { tool, type ToolSet } from 'ai'
import { limitarResultado, type ContextoFerramenta, type Ferramenta } from './comum'
import { buscarClientes, resumoDoCliente } from './clientes'
import { buscarPorSei, contratosVencendo, detalheDoContrato, itensDoContrato } from './contratos'
import { demandas, faturamentos, fornecedores, solicitacoes, tramitesDaDemanda } from './operacao'
import { analisesDeDocumentos, buscarNosDocumentos, execucoesConfere, propostasComerciais } from './conteudo'

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
} as Record<string, Ferramenta>

export async function executarComSeguranca(
  nome: string,
  ferramenta: Ferramenta,
  entrada: unknown,
  contexto: ContextoFerramenta
): Promise<unknown> {
  try {
    return limitarResultado(await ferramenta.executar(entrada as never, contexto))
  } catch (erro) {
    console.error(`[assistente] ferramenta ${nome} falhou`, erro)
    return { erro: `falha ao consultar ${nome}` }
  }
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
      }),
    ])
  )
}
