/** @jest-environment node */
// O registro puxa a cadeia inteira (busca → indexação → unpdf, que é ESM); nenhuma ferramenta roda aqui.
jest.mock('unpdf', () => ({}))
// `ai` (pacote real) é ESM-only (sem build CJS) — o Jest não transforma node_modules por padrão,
// então importar o pacote de verdade quebra com "Cannot use import statement outside a module".
// Nenhum teste aqui chama `criarFerramentas`/`tool`, então um stub basta.
jest.mock('ai', () => ({ tool: jest.fn((config: unknown) => config) }))
import { z } from 'zod'
import { definirFerramenta } from './comum'
import { criarFerramentas, executarComSeguranca, FERRAMENTAS, ROTULOS_FERRAMENTAS, textoParaModelo } from './index'

const ctx = { usuario: { id: 'u', nome: 'U', email: 'u@x', role: 'admin' as const }, hoje: new Date() }

type FerramentaStub = { description: string; inputSchema: unknown; execute: (entrada: unknown) => Promise<unknown> }

it('registra as ferramentas, todas com rótulo de progresso', () => {
  expect(Object.keys(FERRAMENTAS).sort()).toEqual(
    [
      'analisesDeDocumentos', 'buscarClientes', 'buscarNosDocumentos', 'buscarPorSei', 'contratosVencendo', 'demandas',
      'detalheDoContrato', 'execucoesConfere', 'faturamentos', 'fornecedores', 'itensDoContrato', 'propostasComerciais',
      'resumoDoCliente', 'solicitacoes', 'tramitesDaDemanda', 'alertas', 'consultarManual', 'buscarNasNormas', 'fichasDoContrato',
    ].sort()
  )
  for (const nome of Object.keys(FERRAMENTAS)) expect(ROTULOS_FERRAMENTAS[nome]).toBeTruthy()
})

it('erro da ferramenta vira { erro } para a IA, sem lançar', async () => {
  const quebrada = definirFerramenta({ descricao: 'x', entrada: z.object({}), executar: async () => { throw new Error('banco fora') } })
  expect(await executarComSeguranca('quebrada', quebrada, {}, ctx)).toEqual({ erro: 'falha ao consultar quebrada' })
})

it('executarComSeguranca não corta mais o objeto (a tela recebe tudo)', async () => {
  const grande = definirFerramenta({ descricao: 'x', entrada: z.object({}), executar: async () => ({ s: 'x'.repeat(9000) }) })
  expect(await executarComSeguranca('grande', grande, {}, ctx)).toEqual({ s: 'x'.repeat(9000) })
})

it('textoParaModelo: compacto, cortado por linha, erro como linha', () => {
  expect(textoParaModelo('buscarClientes', { total: 1, clientes: [{ id: 'c1', nome: 'SMIT', href: '/clientes/c1' }] })).toBe(
    'clientes (total 1, mostrando 1):\nid|nome\nc1|SMIT'
  )
  expect(textoParaModelo('buscarClientes', { erro: 'não encontrado' })).toBe('erro: não encontrado')
  const muitas = { total: 2000, clientes: Array.from({ length: 2000 }, (_, i) => ({ id: `c${i}`, nome: 'Secretaria '.repeat(3) })) }
  expect(textoParaModelo('buscarClientes', muitas)).toMatch(/… mostrando \d+ de 2002 linhas/)
})

it('criarFerramentas liga o toModelOutput ao texto compacto', async () => {
  const ferramentas = criarFerramentas(ctx) as unknown as Record<string, { toModelOutput: (o: { output: unknown }) => unknown }>
  expect(await ferramentas.buscarClientes.toModelOutput({ output: { total: 0, clientes: [] } })).toEqual({ type: 'text', value: 'total: 0' })
})

describe('criarFerramentas', () => {
  it('expõe as ferramentas com description/inputSchema vindos de cada Ferramenta', () => {
    const ferramentas = criarFerramentas(ctx) as unknown as Record<string, FerramentaStub>
    expect(Object.keys(ferramentas).sort()).toEqual(Object.keys(FERRAMENTAS).sort())
    for (const [nome, ferramenta] of Object.entries(FERRAMENTAS)) {
      expect(ferramentas[nome].description).toBe(ferramenta.descricao)
      expect(ferramentas[nome].inputSchema).toBe(ferramenta.entrada)
    }
  })

  it('execute() invoca a ferramenta.executar com o MESMO objeto de contexto passado a criarFerramentas — a entrada não pode smugglar outro usuário', async () => {
    const espiao = jest.spyOn(FERRAMENTAS.buscarClientes, 'executar').mockResolvedValue({ total: 0, clientes: [] })
    try {
      const ferramentas = criarFerramentas(ctx) as unknown as Record<string, FerramentaStub>
      const entrada = { termo: 'x', usuario: { role: 'admin' } }
      await ferramentas.buscarClientes.execute(entrada)
      expect(espiao).toHaveBeenCalledTimes(1)
      const [entradaRecebida, contextoRecebido] = espiao.mock.calls[0]
      expect(entradaRecebida).toBe(entrada) // não é reescrita — o "usuario" dentro dela é só um campo qualquer pro zod, nunca vira o contexto
      expect(contextoRecebido).toBe(ctx) // mesma referência: o usuário real entra por closure, não pela entrada da ferramenta
      expect(contextoRecebido.usuario).toBe(ctx.usuario)
      expect(contextoRecebido.usuario).not.toEqual(entrada.usuario)
    } finally {
      espiao.mockRestore()
    }
  })

  it('erro lançado dentro de executar chega em execute() como { erro } (via executarComSeguranca)', async () => {
    const espiao = jest.spyOn(FERRAMENTAS.buscarClientes, 'executar').mockRejectedValue(new Error('banco fora'))
    try {
      const ferramentas = criarFerramentas(ctx) as unknown as Record<string, FerramentaStub>
      const resultado = await ferramentas.buscarClientes.execute({ termo: 'x' })
      expect(resultado).toEqual({ erro: 'falha ao consultar buscarClientes' })
    } finally {
      espiao.mockRestore()
    }
  })
})
