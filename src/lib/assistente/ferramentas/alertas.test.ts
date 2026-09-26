/** @jest-environment node */
jest.mock('@/lib/visibilidade', () => ({ clienteIdsPermitidos: jest.fn(), podeVerCliente: jest.fn() }))
jest.mock('@/lib/relatorios-clientes/alertas-banco', () => ({ alertasDosContratos: jest.fn() }))

import { clienteIdsPermitidos, podeVerCliente } from '@/lib/visibilidade'
import { alertasDosContratos } from '@/lib/relatorios-clientes/alertas-banco'
import type { Alerta } from '@/lib/relatorios-clientes/alertas'
import type { ContextoFerramenta } from './comum'
import { alertas } from './alertas'

const ctx: ContextoFerramenta = { usuario: { id: 'u', nome: 'U', email: 'u@x', role: 'responsavel' }, hoje: new Date('2026-09-26T15:00:00Z') }
const rodar = (entrada: unknown) => alertas.executar(alertas.entrada.parse(entrada), ctx)
const alerta = (codigo: string, nivel: Alerta['nivel']): Alerta => ({
  codigo: codigo as Alerta['codigo'], nivel, clienteId: 'c1', cliente: 'SMIT', contratoId: 'k1', contrato: 'TC 45/SMIT/2023',
  titulo: 'Vence em 20 dias sem prorrogação', detalhe: 'Fim em 16/10/2026 | sem aditivo', acao: 'Decidir.', temaManual: 'prorrogacao', dias: 20,
})

beforeEach(() => {
  jest.clearAllMocks()
  ;(clienteIdsPermitidos as jest.Mock).mockResolvedValue(['c1'])
  ;(podeVerCliente as jest.Mock).mockImplementation(async (_u, id) => id === 'c1')
  ;(alertasDosContratos as jest.Mock).mockResolvedValue([alerta('vence-sem-prorrogacao', 'critico'), alerta('situacao-desatualizada', 'atencao'), alerta('termo-sem-pdf', 'info')])
})

it('carteira do usuário: passa os clientes permitidos', async () => {
  const r = (await rodar({})) as { total: number; porCodigo: Record<string, number> }
  expect(alertasDosContratos).toHaveBeenCalledWith({ clienteIds: ['c1'], clienteId: undefined, contratoId: undefined }, ctx.hoje)
  expect(r.total).toBe(3)
  expect(r.porCodigo).toEqual({ 'vence-sem-prorrogacao': 1, 'situacao-desatualizada': 1, 'termo-sem-pdf': 1 })
})

it('cliente sem permissão: não encontrado, sem calcular', async () => {
  expect(await rodar({ clienteId: 'c9' })).toEqual({ erro: 'não encontrado' })
  expect(alertasDosContratos).not.toHaveBeenCalled()
})

it('nivelMinimo corta os de baixo', async () => {
  const r = (await rodar({ nivelMinimo: 'atencao' })) as { alertas: Alerta[] }
  expect(r.alertas.map((a) => a.nivel)).toEqual(['critico', 'atencao'])
})

it('compacto: contagem por código e tabela com colunas fixas', async () => {
  const texto = alertas.compactar!(await rodar({}))
  const linhas = texto.split('\n')
  expect(linhas[0]).toBe('por código: vence-sem-prorrogacao 1 · situacao-desatualizada 1 · termo-sem-pdf 1')
  expect(linhas[1]).toBe('alertas (total 3, mostrando 3):')
  expect(linhas[2]).toBe('nivel|cliente|contrato|contratoId|titulo|detalhe|acao|tema')
  expect(linhas[3]).toBe('critico|SMIT|TC 45/SMIT/2023|k1|Vence em 20 dias sem prorrogação|Fim em 16/10/2026 / sem aditivo|Decidir.|prorrogacao')
})
