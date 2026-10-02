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
const item = (codigo: string, preco: string | null, extra: any = {}) => ({ codigo, preco, sobDemanda: false, precoTexto: null, unidade: 'mês', ...extra })
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
    expect(por('01.001.00002.01')).toMatchObject({ preco: 'diferente', detalhe: 'tabela R$ 10,00 por mês', conta: 'confere' })
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
  it('linha sem total: avisa e não confere a conta por linha', async () => {
    acesso.mockResolvedValue(anexo())
    html.mockResolvedValue(`<table><tr><th>Código</th><th>Descrição</th><th>Quantidade</th><th>Valor unitário</th></tr>${tr('01.001.00001.01', 'A', '12', '150,25')}</table>`)
    const r = await rodar()
    expect(r.avisos).toContain('1 linha(s) sem total — conta por linha não conferida')
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
  it('anexo alheio: confere o usuário; anexo não lido vira erro', async () => {
    acesso.mockResolvedValue(null)
    await rodar()
    expect(acesso).toHaveBeenCalledWith('a1', ctx.usuario)
    acesso.mockResolvedValue({ ...anexo(), status: 'erro' })
    expect(await rodar()).toEqual({ erro: 'não consegui ler este anexo' })
    expect(r2).not.toHaveBeenCalled()
  })
  it('soma mensal × total anual: não conferida, com aviso', async () => {
    acesso.mockResolvedValue(anexo(ficha({ valorTotal: { valor: 'R$ 3.123,00' } })))
    html.mockResolvedValue(tabelaHtml(['01.001.00001.01', 'A', '1', '150,25', '150,25'], ['01.001.00002.01', 'B', '11', '10,00', '110,00']))
    const r = await rodar()
    expect(r.soma).toBe('não conferida')
    expect(r.avisos).toContain('o total declarado parece anual (12 × a soma mensal das linhas)')
    expect(r.avisos).toContain('a soma considera só os itens com código de serviço')
  })
  it('soma diferente e não múltipla: não confere, com os dois valores', async () => {
    acesso.mockResolvedValue(anexo(ficha({ valorTotal: { valor: 'R$ 999,00' } })))
    html.mockResolvedValue(tabelaHtml(['01.001.00001.01', 'A', '1', '150,25', '150,25']))
    const r = await rodar()
    expect(r.soma).toBe('não confere')
    expect(r.avisos).toContain('soma das linhas R$ 150,25 × total declarado R$ 999,00')
  })
  it('modelo: avisos reais e primeiros problemas antes; corte de 60 exercido', async () => {
    acesso.mockResolvedValue(anexo(ficha({ valorTotal: { valor: 'R$ 1,00' } })))
    const linhas = Array.from({ length: 300 }, (_, i) => [cod(i + 10), 'x', '1', i < 100 ? '10,00' : '11,00', i === 150 ? '' : '10,00'])
    tabelaOficial.mockResolvedValue({ tabela: { versao: 'v' }, itens: linhas.slice(0, 100).map((l) => item(l[0], '10.00')) })
    html.mockResolvedValue(tabelaHtml(...linhas))
    const r = await rodar()
    expect(Object.keys(r).slice(0, 4)).toEqual(['anexo', 'tabela', 'avisos', 'resumo'])
    expect(r.avisos).toContain('1 linha(s) sem total — conta por linha não conferida')
    const texto = textoParaModelo('conferirPrecosDoAnexo', r)
    expect(texto).toContain('1 linha(s) sem total')
    expect(texto).toContain('soma das linhas')
    expect(texto).toContain('itensOk: 100')
    expect(texto).toContain(cod(110))
    expect(texto).toMatch(/… e mais \d+ itens com problema/)
    expect(texto.indexOf('avisos:')).toBeLessThan(texto.indexOf('itensComProblema'))
    expect(texto.length).toBeLessThanOrEqual(8000)
    // sem o corte de 60, o texto passaria de 8.000
    const semCorte = r.itens.filter((i: any) => i.preco !== 'igual' || i.conta === 'não confere').map((i: any) => `${i.linha}|${i.codigo}|${i.unitario}|${i.tabelaOficial}|${i.preco}|${i.conta}|${i.detalhe ?? ''}`).join('\n')
    expect(semCorte.length).toBeGreaterThan(8000)
  })
})
