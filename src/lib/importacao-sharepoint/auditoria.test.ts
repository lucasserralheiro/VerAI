import { auditarContratos, type ContratoParaAuditar } from './auditoria'

const hoje = new Date('2026-09-24T12:00:00Z')
const contrato = (c: Partial<ContratoParaAuditar>): ContratoParaAuditar => ({
  cliente: 'SMIT',
  numeroTermo: 'TC 1/SMIT/2024',
  situacao: null,
  ativo: true,
  vazio: false,
  vigenciaFim: new Date('2027-01-01'),
  valorBase: '100.00',
  linhas: [{ tipo: 'CONTRATO', numero: 'TC 1/SMIT/2024' }],
  ...c,
})

it('contrato sem nada estranho não gera achado', () => {
  expect(auditarContratos([contrato({})], hoje)).toEqual([])
})

it('"Finalizado" com vigência ainda correndo (SMIT TC 52/2024 antes da correção, SVMA TC 074/2022)', () => {
  const [a] = auditarContratos([contrato({ numeroTermo: 'TC 52/SMIT/2024', situacao: 'Finalizado', ativo: false, vigenciaFim: new Date('2027-06-30') })], hoje)
  expect(a).toMatchObject({ tipo: 'finalizado-vigente', cliente: 'SMIT', contrato: 'TC 52/SMIT/2024' })
  expect(a.detalhe).toMatch(/2027-06-30/)
})

it('ativo sem valor fica fora da soma — avisa pra digitar (termo escaneado)', () => {
  expect(auditarContratos([contrato({ valorBase: null })], hoje)).toEqual([expect.objectContaining({ tipo: 'ativo-sem-valor' })])
})

it('duas linhas de contrato inicial no mesmo contrato (apostila lida como contrato inicial)', () => {
  const linhas = [
    { tipo: 'CONTRATO', numero: 'TC 001/2023' },
    { tipo: 'CONTRATO', numero: 'TC 001/2023' },
  ]
  expect(auditarContratos([contrato({ linhas })], hoje)).toEqual([expect.objectContaining({ tipo: 'contrato-inicial-duplicado' })])
})

it('mesmo aditivo duas vezes no contrato (SMDHC "TA 001" ×2)', () => {
  const linhas = [
    { tipo: 'CONTRATO', numero: 'TC 001/SMJ/2021' },
    { tipo: 'ADITIVO', numero: 'TA 001' },
    { tipo: 'ADITIVO', numero: 'TA 1' },
  ]
  expect(auditarContratos([contrato({ linhas })], hoje)).toEqual([expect.objectContaining({ tipo: 'termo-duplicado', detalhe: expect.stringMatching(/TA 001/) })])
})

it('mesmo contrato cadastrado duas vezes no cliente (SUB-ITP em duas pastas)', () => {
  const achados = auditarContratos(
    [contrato({ cliente: 'SUB-ITP', numeroTermo: 'TC 001/SUB/IT/2026' }), contrato({ cliente: 'SUB-ITP', numeroTermo: 'TC 1/SUB-IT/2026' })],
    hoje
  )
  expect(achados).toEqual([expect.objectContaining({ tipo: 'contrato-duplicado', cliente: 'SUB-ITP' })])
})

it('contrato vazio do legado e contrato inativo sem valor não geram aviso', () => {
  expect(auditarContratos([contrato({ vazio: true, valorBase: null }), contrato({ ativo: false, situacao: 'Rescindido', valorBase: null, vigenciaFim: new Date('2020-01-01') })], hoje)).toEqual([])
})
