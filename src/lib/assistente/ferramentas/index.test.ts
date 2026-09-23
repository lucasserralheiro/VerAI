/** @jest-environment node */
// O registro puxa a cadeia inteira (busca → indexação → unpdf, que é ESM); nenhuma ferramenta roda aqui.
jest.mock('unpdf', () => ({}))
// `ai` (pacote real) é ESM-only (sem build CJS) — o Jest não transforma node_modules por padrão,
// então importar o pacote de verdade quebra com "Cannot use import statement outside a module".
// Nenhum teste aqui chama `criarFerramentas`/`tool`, então um stub basta.
jest.mock('ai', () => ({ tool: jest.fn((config: unknown) => config) }))
import { z } from 'zod'
import { definirFerramenta } from './comum'
import { executarComSeguranca, FERRAMENTAS, ROTULOS_FERRAMENTAS } from './index'

const ctx = { usuario: { id: 'u', nome: 'U', email: 'u@x', role: 'admin' as const }, hoje: new Date() }

it('registra as 15 ferramentas, todas com rótulo de progresso', () => {
  expect(Object.keys(FERRAMENTAS).sort()).toEqual(
    [
      'analisesDeDocumentos', 'buscarClientes', 'buscarNosDocumentos', 'buscarPorSei', 'contratosVencendo', 'demandas',
      'detalheDoContrato', 'execucoesConfere', 'faturamentos', 'fornecedores', 'itensDoContrato', 'propostasComerciais',
      'resumoDoCliente', 'solicitacoes', 'tramitesDaDemanda',
    ].sort()
  )
  for (const nome of Object.keys(FERRAMENTAS)) expect(ROTULOS_FERRAMENTAS[nome]).toBeTruthy()
})

it('erro da ferramenta vira { erro } para a IA, sem lançar', async () => {
  const quebrada = definirFerramenta({ descricao: 'x', entrada: z.object({}), executar: async () => { throw new Error('banco fora') } })
  expect(await executarComSeguranca('quebrada', quebrada, {}, ctx)).toEqual({ erro: 'falha ao consultar quebrada' })
})

it('resultado grande é truncado', async () => {
  const grande = definirFerramenta({ descricao: 'x', entrada: z.object({}), executar: async () => ({ s: 'x'.repeat(9000) }) })
  expect(await executarComSeguranca('grande', grande, {}, ctx)).toMatchObject({ truncado: true })
})
