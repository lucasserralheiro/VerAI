import { MANUAL } from '@/lib/assistente/manual'
import type { ContextoFerramenta } from './comum'
import { AVISO_RASCUNHO, consultarManual } from './manual'

const ctx: ContextoFerramenta = { usuario: { id: 'u', nome: 'U', email: 'u@x', role: 'responsavel' }, hoje: new Date() }
const rodar = (entrada: unknown) => consultarManual.executar(consultarManual.entrada.parse(entrada), ctx)

it('tema em rascunho vai com o aviso', async () => {
  const r = await rodar({ tema: 'prorrogacao' })
  expect(r).toEqual({ tema: 'prorrogacao', titulo: 'Prorrogação de vigência', status: 'rascunho', aviso: AVISO_RASCUNHO, texto: MANUAL.prorrogacao.texto })
  expect(consultarManual.compactar!(r).split('\n')[0]).toBe(`Prorrogação de vigência — rascunho: ${AVISO_RASCUNHO}`)
})

it('tema validado traz quem validou e não traz aviso', async () => {
  const original = MANUAL.sei
  MANUAL.sei = { ...original, status: 'validado', validadoPor: 'Equipe de contratos', validadoEm: '2026-10-01' }
  try {
    const r = await rodar({ tema: 'sei' })
    expect(r).toMatchObject({ status: 'validado', validadoPor: 'Equipe de contratos', validadoEm: '2026-10-01' })
    expect(r).not.toHaveProperty('aviso')
    expect(consultarManual.compactar!(r).split('\n')[0]).toBe('Processo SEI: trâmite interno — validado por Equipe de contratos em 2026-10-01')
  } finally {
    MANUAL.sei = original
  }
})

it('tema fora da lista é recusado na entrada', () => {
  expect(() => consultarManual.entrada.parse({ tema: 'licitacao' })).toThrow()
})
