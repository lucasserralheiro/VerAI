/** @jest-environment node */
jest.mock('@/lib/assistente/anexos/acesso', () => ({ anexoDoUsuario: jest.fn() }))
jest.mock('@/lib/r2', () => ({ getR2: jest.fn() }))
jest.mock('@/lib/assistente/anexos/extrair', () => ({ htmlDoAnexo: jest.fn() }))
jest.mock('@/lib/tabela-precos/consultas', () => ({ carregarTabela: jest.fn() }))

import { anexoDoUsuario } from '@/lib/assistente/anexos/acesso'
import { getR2 } from '@/lib/r2'
import { htmlDoAnexo } from '@/lib/assistente/anexos/extrair'
import { carregarTabela } from '@/lib/tabela-precos/consultas'
import { conferirPrecosDoAnexo } from './anexo-precos'
import { textoParaModelo } from './index'

/* eslint-disable @typescript-eslint/no-explicit-any */
const ctx = { usuario: { id: 'u1', nome: 'U', email: 'u@x', role: 'uploader' as const }, hoje: new Date('2026-10-02'), conversaId: 'c1' }
const acesso = anexoDoUsuario as jest.Mock
const r2 = getR2 as jest.Mock
const html = htmlDoAnexo as jest.Mock
const tabelaOficial = carregarTabela as jest.Mock

const ficha = (campos: any = {}) => ({ tipo: 'proposta', campos, itens: 1, avisos: [] })
const anexo = (f: any = ficha(), formato = 'pdf') => ({ id: 'a1', nome: 'proposta.pdf', formato, status: 'ok', ficha: f, conversaId: 'c1', chaveR2: 'assistente/c1/x.pdf' })
const item = (codigo: string, preco: string | null, extra: any = {}) => ({ codigo, preco, sobDemanda: false, precoTexto: null, ...extra })
const tr = (...c: string[]) => `<tr>${c.map((x) => `<td>${x}</td>`).join('')}</tr>`
const tabelaHtml = (...linhas: string[][]) =>
  `<table><tr><th>Código</th><th>Descrição</th><th>Quantidade</th><th>Valor unitário</th><th>Valor total</th></tr>${linhas.map((l) => tr(...l)).join('')}</table>`
const cod = (i: number) => `01.001.${String(i).padStart(5, '0')}.01`

beforeEach(() => {
  for (const m of [acesso, r2, html, tabelaOficial]) m.mockReset()
  r2.mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })
  tabelaOficial.mockResolvedValue({ tabela: { versao: '2026 v2' }, itens: [item('01.001.00001.01', '150.25'), item('01.001.00002.01', '10.00'), item('01.001.00004.01', null, { sobDemanda: true })] })
})

const rodar = async () => (await conferirPrecosDoAnexo.executar({ anexoId: 'a1' }, ctx)) as any

describe('conferirPrecosDoAnexo', () => {
  it('anexo alheio ou inexistente', async () => {
    acesso.mockResolvedValue(null)
    expect(await rodar()).toEqual({ erro: 'não encontrado' })
  })
  it('classifica preço, conta e soma', async () => {
    acesso.mockResolvedValue(anexo(ficha({ valorTotal: { valor: 'R$ 1.650,25' } })))
    html.mockResolvedValue(
      tabelaHtml(
        ['01.001.00001.01', 'A', '1', '150,25', '150,25'],
        ['01.001.00002.01', 'B', '10', '11,00', '110,00'],
        ['01.001.00003.01', 'C', '2', '5,00', '11,00'],
        ['01.001.00004.01', 'D', '1', '7,00', '7,00'],
      ),
    )
    const r = await rodar()
    const por = (c: string) => r.itens.find((i: any) => i.codigo === c)
    expect(por('01.001.00001.01')).toMatchObject({ preco: 'igual', conta: 'confere' })
    expect(por('01.001.00002.01')).toMatchObject({ preco: 'diferente', detalhe: 'tabela R$ 10,00', conta: 'confere' })
    expect(por('01.001.00003.01')).toMatchObject({ preco: 'código não existe', conta: 'não confere' })
    expect(por('01.001.00003.01').detalhe).toContain('quantidade × unitário = R$ 10,00')
    expect(por('01.001.00004.01').preco).toBe('sob demanda')
    expect(r.resumo).toEqual({ igual: 1, diferente: 1, inexistente: 1, contaErrada: 1 })
    expect(r.somaDasLinhas).toBe('R$ 278,25')
    expect(r.soma).toBe('não confere')
    expect(r.tabela).toBe('2026 v2')
  })
  it('soma igual ao total declarado', async () => {
    acesso.mockResolvedValue(anexo(ficha({ valorTotal: { valor: 'R$ 260,25' } })))
    html.mockResolvedValue(tabelaHtml(['01.001.00001.01', 'A', '1', '150,25', '150,25'], ['01.001.00002.01', 'B', '11', '10,00', '110,00']))
    const r = await rodar()
    expect(r.soma).toBe('confere')
    expect(r.totalDeclarado).toBe('R$ 260,25')
  })
  it('sem total declarado', async () => {
    acesso.mockResolvedValue(anexo(ficha(), 'xlsx'))
    html.mockResolvedValue(tabelaHtml(['01.001.00001.01', 'A', '1', '150,25', '150,25']))
    expect((await rodar()).soma).toBe('sem total declarado')
  })
  it('total anual: avisa e não confere a conta por linha', async () => {
    acesso.mockResolvedValue(anexo())
    html.mockResolvedValue(`<table><tr><th>Código</th><th>Descrição</th><th>Quantidade</th><th>Valor unitário</th></tr>${tr('01.001.00001.01', 'A', '12', '150,25')}</table>`)
    const r = await rodar()
    expect(r.avisos).toContain('a tabela traz só total anual; conta por linha não conferida')
    expect(r.itens[0].conta).toBe('sem dados')
  })
  it('sem itens e tabela não lida', async () => {
    acesso.mockResolvedValue(anexo())
    html.mockResolvedValue('<p>nada</p>')
    expect(await rodar()).toEqual({ erro: 'não achei tabela de itens com código de serviço neste anexo' })
    html.mockResolvedValue(tabelaHtml(['01.001.00001.01', 'A', '1', '150,25', '150,25']))
    tabelaOficial.mockResolvedValue(null)
    expect((await rodar()).erro).toMatch(/tabela de preços/)
  })
  it('modelo: avisos reais e primeiros problemas antes; iguais só contados', async () => {
    acesso.mockResolvedValue(anexo(ficha({ valorTotal: { valor: 'R$ 1,00' } })))
    const linhas = Array.from({ length: 300 }, (_, i) => [cod(i + 10), 'x', '1', i < 200 ? '10,00' : '11,00', '10,00'])
    // 300 códigos fora da tabela: todos "código não existe"; os 200 primeiros com conta ok
    tabelaOficial.mockResolvedValue({ tabela: { versao: 'v' }, itens: linhas.slice(0, 200).map((l) => item(l[0], '10.00')) })
    html.mockResolvedValue(tabelaHtml(...linhas))
    const r = await rodar()
    expect(Object.keys(r).slice(0, 4)).toEqual(['anexo', 'tabela', 'avisos', 'resumo'])
    r.avisos.push('aviso importante')
    const texto = textoParaModelo('conferirPrecosDoAnexo', r)
    expect(texto).toContain('aviso importante')
    expect(texto).toContain('itensOk: 200')
    expect(texto).toContain(cod(210))
    expect(texto.indexOf('avisos:')).toBeLessThan(texto.indexOf('itensComProblema'))
    expect(texto.length).toBeLessThan(8000)
  })
})
