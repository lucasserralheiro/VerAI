/** @jest-environment node */
jest.mock('@/lib/assistente/contexto-pagina', () => ({
  interpretarRota: jest.fn(() => ({ clienteId: 'c1' })),
  descreverContexto: jest.fn(async () => ({ texto: 'Tela aberta: SMIT', rotulo: 'SMIT' })),
}))
jest.mock('./entidades', () => ({ identificarEntidades: jest.fn(async () => ({ clientes: [], contratos: [], texto: null })) }))

import { descreverContexto } from '@/lib/assistente/contexto-pagina'
import { identificarEntidades } from './entidades'
import { prepararContexto } from './preparar'

const usuario = { id: 'u', nome: 'U', email: 'u@x', role: 'admin' as const }

it('data e tela aberta numa linha só', async () => {
  const texto = await prepararContexto({ usuario, pergunta: 'oi', rota: '/clientes/c1', recentes: [], hoje: new Date('2026-09-25T15:00:00Z') })
  expect(texto).toBe('Hoje é 25/09/2026. Tela aberta: SMIT')
})

it('sem rota, só a data', async () => {
  ;(descreverContexto as jest.Mock).mockResolvedValueOnce(null)
  const texto = await prepararContexto({ usuario, pergunta: 'oi', rota: null, recentes: [], hoje: new Date('2026-09-25T15:00:00Z') })
  expect(texto).toBe('Hoje é 25/09/2026.')
})

it('acrescenta os já identificados ao fim da linha', async () => {
  ;(identificarEntidades as jest.Mock).mockResolvedValueOnce({ clientes: [], contratos: [], texto: 'Já identificados (…): cliente SMIT.' })
  const texto = await prepararContexto({ usuario, pergunta: 'saldo do SMIT', rota: null, recentes: [['x']], hoje: new Date('2026-09-25T15:00:00Z') })
  expect(texto).toBe('Hoje é 25/09/2026. Tela aberta: SMIT Já identificados (…): cliente SMIT.')
  expect(identificarEntidades).toHaveBeenCalledWith({ pergunta: 'saldo do SMIT', usuario, recentes: [['x']] })
})
