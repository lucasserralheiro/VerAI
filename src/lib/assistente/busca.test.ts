/** @jest-environment node */
import { montarConsultaTrechos } from './busca'

const texto = (sql: { sql: string }) => sql.sql.replace(/\s+/g, ' ')

describe('montarConsultaTrechos', () => {
  it('admin: sem filtro de cliente, só full-text', () => {
    const q = montarConsultaTrechos({ consulta: 'reajuste IPCA' }, { clienteIds: null, documentoIds: ['d1'] })
    expect(texto(q)).toContain("websearch_to_tsquery('portuguese', unaccent(")
    expect(texto(q)).not.toContain('"clienteId" IN')
    expect(q.values).toContain('reajuste IPCA')
    expect(q.values).toContain(6)
  })

  it('usuário restrito: só clientes liberados ou trecho sem cliente', () => {
    const q = montarConsultaTrechos({ consulta: 'x' }, { clienteIds: ['c1', 'c2'], documentoIds: [] })
    expect(texto(q)).toContain('t."clienteId" IS NULL OR t."clienteId" IN')
    expect(q.values).toEqual(expect.arrayContaining(['c1', 'c2']))
    expect(texto(q)).toContain(`t.origem <> 'DOCUMENTO'`)
  })

  it('usuário sem nenhum cliente: só trecho sem cliente', () => {
    const q = montarConsultaTrechos({ consulta: 'x' }, { clienteIds: [], documentoIds: [] })
    expect(texto(q)).toContain('t."clienteId" IS NULL')
    expect(texto(q)).not.toContain('IN ()')
  })

  it('número (SEI, nº de contrato) também casa por dígitos sem pontuação', () => {
    const q = montarConsultaTrechos({ consulta: 'processo 6018.2023/0001234-5' }, { clienteIds: null, documentoIds: [] })
    expect(texto(q)).toContain(`regexp_replace(t.texto, '[./-]', '', 'g') LIKE ANY`)
    expect(q.values).toContain('%6018202300012345%')
  })

  it('caractere de wildcard do LIKE (%, _) na consulta não vaza pro padrão — só dígito sobra', () => {
    const q = montarConsultaTrechos({ consulta: '601820%2300_01234-5' }, { clienteIds: null, documentoIds: [] })
    expect(q.values).toContain('%6018202300012345%')
    expect(q.values).not.toContain('%601820%2300_01234-5%')
  })

  it('admin (clienteIds null): não monta a lista IN de documentos, condDocumento vira TRUE', () => {
    const q = montarConsultaTrechos({ consulta: 'x' }, { clienteIds: null, documentoIds: ['d1', 'd2', 'd3'] })
    expect(texto(q)).not.toContain('"origemId" IN')
    expect(q.values).not.toContain('d1')
  })

  it('filtra por cliente e contrato quando pedido', () => {
    const q = montarConsultaTrechos({ consulta: 'x', clienteId: 'c1', contratoId: 'k1', limite: 3 }, { clienteIds: null, documentoIds: [] })
    expect(q.values).toEqual(expect.arrayContaining(['c1', 'k1', 3]))
  })
})

describe('filtro por origem', () => {
  it('origens restringe e excluirOrigens tira', () => {
    const so = montarConsultaTrechos({ consulta: 'x', origens: ['REFERENCIA'] }, { clienteIds: null, documentoIds: [] })
    expect(texto(so)).toContain('AND t.origem IN (')
    expect(so.values).toContain('REFERENCIA')
    const sem = montarConsultaTrechos({ consulta: 'x', excluirOrigens: ['REFERENCIA'] }, { clienteIds: null, documentoIds: [] })
    expect(texto(sem)).toContain('AND t.origem NOT IN (')
  })
})
