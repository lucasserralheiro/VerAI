/** @jest-environment node */
jest.mock('@/lib/assistente/busca', () => ({ buscarTrechos: jest.fn() }))

import { buscarTrechos } from '@/lib/assistente/busca'
import type { ContextoFerramenta } from './comum'
import { buscarNasNormas } from './normas'

const ctx: ContextoFerramenta = { usuario: { id: 'u', nome: 'U', email: 'u@x', role: 'responsavel' }, hoje: new Date() }
const rodar = (entrada: unknown) => buscarNasNormas.executar(buscarNasNormas.entrada.parse(entrada), ctx)

beforeEach(() => jest.clearAllMocks())

it('busca só nos textos oficiais e cita o artigo', async () => {
  ;(buscarTrechos as jest.Mock).mockResolvedValue([
    { origem: 'REFERENCIA', origemId: 'r1', clienteId: null, contratoId: null, nomeArquivo: 'Lei 14.133/2021', pagina: null, texto: '[Lei 14.133/2021 — Art. 107] Art. 107. Os contratos de serviços contínuos poderão ser prorrogados…' },
  ])
  const r = await rodar({ consulta: 'prorrogação serviço contínuo' })
  expect(buscarTrechos).toHaveBeenCalledWith({ consulta: 'prorrogação serviço contínuo', origens: ['REFERENCIA'], limite: 8 }, ctx.usuario)
  expect(buscarNasNormas.compactar!(r)).toBe(
    'normas (total 1):\n"[Lei 14.133/2021 — Art. 107] Art. 107. Os contratos de serviços contínuos poderão ser prorrogados…"'
  )
})

it('sem resultado: avisa que não está na base', async () => {
  ;(buscarTrechos as jest.Mock).mockResolvedValue([])
  expect(await rodar({ consulta: 'licitação deserta' })).toEqual({ total: 0, trechos: [], aviso: 'Não está na base de normas do VerAI.' })
})
