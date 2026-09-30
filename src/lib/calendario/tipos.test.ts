import { hojeEmBrasilia, proximosPrazos, quandoTexto, type DataSerializada } from './tipos'

const d = (inicio: string, tipo: DataSerializada['tipo'], fim = inicio): DataSerializada => ({ inicio: `${inicio}T00:00:00.000Z`, fim: `${fim}T00:00:00.000Z`, tipo, descricao: tipo })
const datas = [
  d('2026-10-01', 'EMISSAO_NFSE', '2026-10-02'),
  d('2026-10-05', 'EMISSAO_NFSE', '2026-10-07'),
  d('2026-10-08', 'ENCERRAMENTO'),
  d('2026-10-12', 'FERIADO'),
  d('2026-10-14', 'ENVIO_RELATORIO'),
  d('2026-10-23', 'RECEBIMENTO_CONTRATOS'),
]

it('hoje em Brasília: 30/09 às 23h de Brasília ainda é 30/09', () => {
  expect(hojeEmBrasilia(new Date('2026-10-01T02:00:00Z')).toISOString()).toBe('2026-09-30T00:00:00.000Z')
})

it('próximos prazos: o em curso conta, feriado não é prazo, dias úteis sem fim de semana e feriado', () => {
  const hoje = new Date('2026-10-06T00:00:00Z')
  const p = proximosPrazos(datas, hoje, 3)
  expect(p.map((x) => x.tipo)).toEqual(['EMISSAO_NFSE', 'ENCERRAMENTO', 'ENVIO_RELATORIO'])
  expect(p[0]).toMatchObject({ emDias: 0 })
  expect(p[1]).toMatchObject({ emDias: 2, emDiasUteis: 2 })
  // 06/10 → 14/10: 07, 08, 09, 13, 14 (10–11 fim de semana, 12 feriado).
  expect(p[2]).toMatchObject({ emDias: 8, emDiasUteis: 5 })
  expect(quandoTexto(p[0])).toBe('hoje')
  expect(quandoTexto({ emDias: 1 })).toBe('amanhã')
  expect(quandoTexto(p[2])).toBe('em 8 dias')
})
