/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({
  prisma: { contrato: { findUnique: jest.fn() }, itemContrato: { findMany: jest.fn() } },
}))
jest.mock('@/lib/assistente/anexos/acesso', () => ({ anexoDoUsuario: jest.fn() }))
jest.mock('@/lib/visibilidade', () => ({ podeVerCliente: jest.fn() }))
jest.mock('@/lib/relatorios-clientes/contratos-consolidados', () => ({ consolidarContratos: jest.fn() }))
jest.mock('@/lib/r2', () => ({ getR2: jest.fn() }))
jest.mock('@/lib/assistente/anexos/extrair', () => ({ htmlDoAnexo: jest.fn() }))
jest.mock('@/lib/assistente/anexos/itens', () => ({
  ...jest.requireActual('@/lib/assistente/anexos/itens'),
  itensDasTabelas: jest.fn(),
}))

import { prisma } from '@/lib/prisma'
import { anexoDoUsuario } from '@/lib/assistente/anexos/acesso'
import { podeVerCliente } from '@/lib/visibilidade'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { getR2 } from '@/lib/r2'
import { htmlDoAnexo } from '@/lib/assistente/anexos/extrair'
import { itensDasTabelas } from '@/lib/assistente/anexos/itens'
import { compararAnexoComContrato } from './anexo-contrato'
import { textoParaModelo } from './index'

/* eslint-disable @typescript-eslint/no-explicit-any */
const ctx = { usuario: { id: 'u1', nome: 'U', email: 'u@x', role: 'uploader' as const }, hoje: new Date('2026-10-02'), conversaId: 'c1' }
const acesso = anexoDoUsuario as jest.Mock
const achar = prisma.contrato.findUnique as jest.Mock
const itensDb = prisma.itemContrato.findMany as jest.Mock
const consolidar = consolidarContratos as jest.Mock
const pode = podeVerCliente as jest.Mock
const r2 = getR2 as jest.Mock
const html = htmlDoAnexo as jest.Mock
const itensAnexo = itensDasTabelas as jest.Mock

const ficha = (extra: any = {}) => ({
  tipo: 'termo', clienteId: 'cl1', cliente: 'SMIT', contratoId: 'ct1', contrato: 'TC 1/2024',
  campos: {}, itens: 0, somaItens: null, conversa: null, anexosDoEmail: [], sugestoes: [], avisos: [], ...extra,
})
const anexo = (f: any = ficha()) => ({ id: 'a1', nome: 'aditivo.pdf', formato: 'pdf', status: 'ok', ficha: f, conversaId: 'c1', chaveR2: 'assistente/c1/x.pdf' })
const contrato = (extra: any = {}) => ({
  id: 'ct1', clienteId: 'cl1', numeroTermo: 'TC 1/2024', descricao: 'Serviços de rede', dataInicio: new Date('2024-01-10T12:00:00Z'), ...extra,
})
const consolidado = (extra: any = {}) => ({ valorBase: '18530.00', vigenciaFim: new Date('2026-12-31T12:00:00Z'), ...extra })

beforeEach(() => {
  for (const m of [acesso, achar, itensDb, consolidar, pode, r2, html, itensAnexo]) m.mockReset()
  pode.mockResolvedValue(true)
  itensDb.mockResolvedValue([])
  achar.mockResolvedValue(contrato())
  consolidar.mockResolvedValue(new Map([['ct1', consolidado()]]))
})

const linha = (r: any, campo: string) => r.linhas.find((l: any) => l.campo === campo)

describe('compararAnexoComContrato', () => {
  it('anexo alheio ou inexistente', async () => {
    acesso.mockResolvedValue(null)
    expect(await compararAnexoComContrato.executar({ anexoId: 'a1' }, ctx)).toEqual({ erro: 'não encontrado' })
  })
  it('sem contrato informado nem na ficha', async () => {
    acesso.mockResolvedValue(anexo(ficha({ contratoId: null })))
    expect(await compararAnexoComContrato.executar({ anexoId: 'a1' }, ctx)).toEqual({
      erro: 'diga qual contrato comparar (não achei o contrato no documento)',
    })
  })
  it('contratoId informado vence o da ficha', async () => {
    acesso.mockResolvedValue(anexo())
    await compararAnexoComContrato.executar({ anexoId: 'a1', contratoId: 'outro' }, ctx)
    expect(achar.mock.calls[0][0].where).toEqual({ id: 'outro' })
  })
  it('sem permissão no cliente ou contrato inexistente', async () => {
    acesso.mockResolvedValue(anexo())
    pode.mockResolvedValue(false)
    expect(await compararAnexoComContrato.executar({ anexoId: 'a1' }, ctx)).toEqual({ erro: 'não encontrado' })
    pode.mockResolvedValue(true)
    achar.mockResolvedValue(null)
    expect(await compararAnexoComContrato.executar({ anexoId: 'a1' }, ctx)).toEqual({ erro: 'não encontrado' })
  })
  it('valor igual com formato diferente; fim pela vigência efetiva', async () => {
    acesso.mockResolvedValue(anexo(ficha({ campos: {
      valorTotal: { valor: 'R$ 18.530,00', pagina: 1 },
      vigenciaInicio: { valor: '10/01/2024', pagina: 1 },
      vigenciaFim: { valor: '31/12/2026', pagina: 1 },
    } })))
    const r = (await compararAnexoComContrato.executar({ anexoId: 'a1' }, ctx)) as any
    expect(linha(r, 'Valor')).toMatchObject({ anexo: 'R$ 18.530,00', situacao: 'igual' })
    expect(linha(r, 'Início').situacao).toBe('igual')
    expect(linha(r, 'Fim').situacao).toBe('igual')
    expect(r.contrato).toBe('TC 1/2024')
  })
  it('valor e fim diferentes', async () => {
    acesso.mockResolvedValue(anexo(ficha({ campos: {
      valorTotal: { valor: '18.530,01', pagina: 1 },
      vigenciaFim: { valor: '30/06/2027', pagina: 1 },
    } })))
    const r = (await compararAnexoComContrato.executar({ anexoId: 'a1' }, ctx)) as any
    expect(linha(r, 'Valor').situacao).toBe('diferente')
    expect(linha(r, 'Fim')).toMatchObject({ anexo: '30/06/2027', verai: '31/12/2026', situacao: 'diferente' })
  })
  it('campo ausente de um lado', async () => {
    acesso.mockResolvedValue(anexo(ficha({ campos: { vigenciaInicio: { valor: '10/01/2024', pagina: 1 } } })))
    consolidar.mockResolvedValue(new Map([['ct1', consolidado({ valorBase: null, vigenciaFim: null })]]))
    achar.mockResolvedValue(contrato({ dataInicio: null }))
    const r = (await compararAnexoComContrato.executar({ anexoId: 'a1' }, ctx)) as any
    expect(linha(r, 'Início').situacao).toBe('só no anexo')
    acesso.mockResolvedValue(anexo(ficha({ campos: { valorTotal: { valor: '1,00', pagina: 1 } } })))
    const r2_ = (await compararAnexoComContrato.executar({ anexoId: 'a1' }, ctx)) as any
    expect(linha(r2_, 'Valor').situacao).toBe('só no anexo')
    expect(linha(r2_, 'Objeto').situacao).toBe('só no VerAI')
  })
  it('objeto: igual só normalizado; parecido pelas palavras específicas; senão diferente', async () => {
    const com = async (objeto: string, descricao: string) => {
      acesso.mockResolvedValue(anexo(ficha({ campos: { objeto: { valor: objeto, pagina: 1 } } })))
      achar.mockResolvedValue(contrato({ descricao }))
      return linha((await compararAnexoComContrato.executar({ anexoId: 'a1' }, ctx)) as any, 'Objeto').situacao
    }
    expect(await com('Prestação de Serviços de REDE, metropolitana.', 'prestacao de servicos de rede metropolitana')).toBe('igual')
    expect(await com('Prestação de serviços de tecnologia da informação', 'Prestação de serviços de tecnologia da informação e comunicação – fornecimento de links MPLS')).toBe('diferente')
    expect(await com('Serviços de REDE', 'Contratação de serviços de rede metropolitana')).toBe('diferente')
    expect(await com('Locação de equipamentos de videoconferência para salas de reunião do gabinete', 'Locação de equipamentos de videoconferência para salas de reunião da secretaria')).toBe('parecido')
    expect(await com('Locação de equipamentos de videoconferência para salas de reunião do gabinete', 'Locação de equipamentos de impressão para salas de auditório do gabinete')).toBe('diferente')
  })
  it('objeto longo é cortado em 200 caracteres', async () => {
    acesso.mockResolvedValue(anexo(ficha({ campos: { objeto: { valor: 'a'.concat('b'.padEnd(500, 'c')), pagina: 1 } } })))
    const r = (await compararAnexoComContrato.executar({ anexoId: 'a1' }, ctx)) as any
    expect(linha(r, 'Objeto').anexo.length).toBeLessThanOrEqual(201)
  })
  it('itens: por código, unitário em decimal', async () => {
    acesso.mockResolvedValue(anexo(ficha({ itens: 3 })))
    r2.mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })
    html.mockResolvedValue('<table/>')
    itensAnexo.mockReturnValue([
      { codigo: '01.001.00001.01', descricao: 'a', quantidade: '1', unitario: '100.00', total: '100.00', linha: 1 },
      { codigo: '01.001.00002.01', descricao: 'b', quantidade: '1', unitario: '50.00', total: '50.00', linha: 2 },
      { codigo: '01.001.00004.01', descricao: 'd', quantidade: '1', unitario: '7.00', total: '7.00', linha: 3 },
    ])
    itensDb.mockResolvedValue([
      { descricao: '01.001.00001.01 - Link', valorUnitario: '100', quantidade: '1', valorTotal: '100' },
      { descricao: '01.001.00002.01 - Outro', valorUnitario: '60', quantidade: '1', valorTotal: '60' },
      { descricao: '01.001.00003.01 - Só aqui', valorUnitario: '9', quantidade: '1', valorTotal: '9' },
    ])
    const r = (await compararAnexoComContrato.executar({ anexoId: 'a1' }, ctx)) as any
    const por = (c: string) => [...r.itensDivergentes, { codigo: '01.001.00001.01', situacao: 'igual' }].find((i: any) => i.codigo === c)
    expect(por('01.001.00001.01').situacao).toBe('igual')
    expect(por('01.001.00002.01')).toMatchObject({ anexo: 'R$ 50,00', verai: 'R$ 60,00', situacao: 'diferente' })
    expect(por('01.001.00003.01').situacao).toBe('só no VerAI')
    expect(por('01.001.00004.01').situacao).toBe('só no anexo')
    expect(r.itensIguais).toBe(1)
  })
  it('sem itens na ficha não lê o R2', async () => {
    acesso.mockResolvedValue(anexo())
    const r = (await compararAnexoComContrato.executar({ anexoId: 'a1' }, ctx)) as any
    expect(r2).not.toHaveBeenCalled()
    expect(r.itensDivergentes).toBeUndefined()
  })
  it('falha ao reler o arquivo vira aviso', async () => {
    acesso.mockResolvedValue(anexo(ficha({ itens: 2 })))
    r2.mockRejectedValue(new Error('r2 fora'))
    const r = (await compararAnexoComContrato.executar({ anexoId: 'a1' }, ctx)) as any
    expect(r.itensDivergentes).toBeUndefined()
    expect(r.avisos).toContain('itens não comparados')
  })
  it('corte em 8.000: avisos reais e primeira divergência ficam; o fim é cortado', async () => {
    const cod = (n: number) => `01.001.${String(n).padStart(5, '0')}.01`
    acesso.mockResolvedValue(anexo(ficha({ itens: 502 })))
    r2.mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })
    html.mockResolvedValue('<table/>')
    const item = (n: number, unitario: string | null) => ({ codigo: cod(n), descricao: 'Descrição longa do serviço '.repeat(5), quantidade: '1', unitario, total: null, linha: n + 1 })
    itensAnexo.mockReturnValue([
      ...Array.from({ length: 500 }, (_, i) => item(i, i < 400 ? '11.00' : '10.00')),
      item(0, '11.00'), // código repetido no anexo
      item(1000, null), // valor ilegível
    ])
    itensDb.mockResolvedValue(Array.from({ length: 500 }, (_, i) => ({ descricao: `${cod(i)} - item`, valorUnitario: '10', quantidade: '1', valorTotal: '10' })))
    const r = (await compararAnexoComContrato.executar({ anexoId: 'a1' }, ctx)) as any
    expect(r.itensDivergentes.length).toBeGreaterThanOrEqual(400)
    expect(r.avisos).toEqual(expect.arrayContaining([`1 códigos repetidos (comparado o primeiro): ${cod(0)}`, '1 item(ns) do anexo com valor ilegível']))
    // os mais graves vêm antes do aviso de código repetido
    expect(r.avisos.findIndex((a: string) => a.includes('ilegível'))).toBeLessThan(r.avisos.findIndex((a: string) => a.includes('repetidos')))

    const completo = compararAnexoComContrato.compactar!(r)
    expect(completo.length).toBeGreaterThan(8000)
    const texto = textoParaModelo('compararAnexoComContrato', r)
    expect(texto.length).toBeLessThanOrEqual(8000)
    expect(texto).toContain('1 item(ns) do anexo com valor ilegível')
    expect(texto).toContain(`1 códigos repetidos (comparado o primeiro): ${cod(0)}`)
    expect(texto).toContain(`\n${cod(0)}|`)
    expect(texto).not.toContain(`\n${cod(399)}|`)
    expect(texto).toMatch(/mostrando \d+ de \d+ linhas/)
  })
  it('código repetido do lado do VerAI avisa e usa o primeiro', async () => {
    acesso.mockResolvedValue(anexo(ficha({ itens: 1 })))
    r2.mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })
    html.mockResolvedValue('<table/>')
    itensAnexo.mockReturnValue([{ codigo: '01.001.00001.01', descricao: 'a', quantidade: '1', unitario: '5.00', total: null, linha: 1 }])
    itensDb.mockResolvedValue([
      { descricao: '01.001.00001.01 - x', valorUnitario: '5', quantidade: '1', valorTotal: '5' },
      { descricao: '01.001.00001.01 - y', valorUnitario: '9', quantidade: '1', valorTotal: '9' },
    ])
    const r = (await compararAnexoComContrato.executar({ anexoId: 'a1' }, ctx)) as any
    expect(r.itensIguais).toBe(1)
    expect(r.itensDivergentes).toEqual([])
    expect(r.avisos).toContain('1 códigos repetidos (comparado o primeiro): 01.001.00001.01')
  })
  it('valor de item ilegível vira null com aviso', async () => {
    acesso.mockResolvedValue(anexo(ficha({ itens: 1 })))
    r2.mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })
    html.mockResolvedValue('<table/>')
    itensAnexo.mockReturnValue([{ codigo: '01.001.00001.01', descricao: 'a', quantidade: '1', unitario: null, total: null, linha: 1 }])
    itensDb.mockResolvedValue([{ descricao: '01.001.00001.01 - x', valorUnitario: '5', quantidade: '1', valorTotal: '5' }])
    const r = (await compararAnexoComContrato.executar({ anexoId: 'a1' }, ctx)) as any
    expect(r.itensDivergentes[0]).toMatchObject({ anexo: null, situacao: 'diferente' })
    expect(r.avisos).toContain('1 item(ns) do anexo com valor ilegível')
  })
})
