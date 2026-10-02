/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: { anexoAssistente: { create: jest.fn(), findMany: jest.fn() } } }))
jest.mock('@/lib/r2', () => ({ PREFIXO_R2: 'r2:', getR2: jest.fn(), deleteR2: jest.fn() }))
jest.mock('./extrair', () => ({ paginasDoAnexo: jest.fn(), htmlDoAnexo: jest.fn() }))
jest.mock('../entidades', () => ({ identificarEntidades: jest.fn() }))

import { prisma } from '@/lib/prisma'
import { deleteR2, getR2 } from '@/lib/r2'
import { identificarEntidades } from '../entidades'
import { htmlDoAnexo, paginasDoAnexo } from './extrair'
import { textoDaFicha } from './ficha'
import { AnexoForaDoR2, apagarAnexosDaConversa, chaveDoAnexo, enderecoValido, registrarAnexo } from './registrar'

const UUID = '0b1c2d3e-4f50-4617-8899-aabbccddeeff'
const usuario = { id: 'u1', nome: 'U', email: 'u@x', role: 'responsavel' } as never
const endereco = `r2:assistente/conv1/${UUID}.pdf`
const textoLongo = 'Proposta comercial de serviços de nuvem para a secretaria, valor global conforme planilha.'

beforeEach(() => {
  jest.clearAllMocks()
  ;(getR2 as jest.Mock).mockResolvedValue(new Response(Buffer.from('%PDF-1.4 conteudo')))
  ;(htmlDoAnexo as jest.Mock).mockResolvedValue('')
  ;(identificarEntidades as jest.Mock).mockResolvedValue({ clientes: [], contratos: [], possiveis: [], provavel: null, texto: null })
  ;(prisma.anexoAssistente.create as jest.Mock).mockResolvedValue({ id: 'a1' })
})

describe('chaveDoAnexo / enderecoValido', () => {
  it('monta a chave na pasta da conversa', () => {
    expect(chaveDoAnexo('conv1', 'pdf', UUID)).toBe(`assistente/conv1/${UUID}.pdf`)
    expect(chaveDoAnexo('conv1', 'eml')).toMatch(/^assistente\/conv1\/[0-9a-f-]{36}\.eml$/)
  })

  it('aceita só endereço da mesma conversa, com uuid e formato da lista', () => {
    expect(enderecoValido(endereco, 'conv1')).toEqual({ chave: `assistente/conv1/${UUID}.pdf`, formato: 'pdf' })
    expect(enderecoValido(endereco, 'conv2')).toBeNull()
    expect(enderecoValido(`r2:tmp-uploads/${UUID}.pdf`, 'conv1')).toBeNull()
    expect(enderecoValido(`r2:assistente/conv1/${UUID}.exe`, 'conv1')).toBeNull()
    expect(enderecoValido(`r2:assistente/conv1/../conv2/${UUID}.pdf`, 'conv1')).toBeNull()
    expect(enderecoValido(`r2:assistente/../${UUID}.pdf`, '..')).toBeNull()
    expect(enderecoValido(`r2:assistente/conv1/x.pdf`, 'conv1')).toBeNull()
    expect(enderecoValido(`assistente/conv1/${UUID}.pdf`, 'conv1')).toBeNull()
  })
})

describe('registrarAnexo', () => {
  it('PDF com texto: grava ok, páginas e ficha; devolve o texto da ficha', async () => {
    ;(paginasDoAnexo as jest.Mock).mockResolvedValue({ paginas: [{ pagina: 1, texto: textoLongo }, { pagina: 2, texto: textoLongo }], anexosDoEmail: [] })
    const r = await registrarAnexo({ conversaId: 'conv1', usuario, endereco, nome: 'proposta.pdf' })
    expect(getR2).toHaveBeenCalledWith(`assistente/conv1/${UUID}.pdf`)
    const data = (prisma.anexoAssistente.create as jest.Mock).mock.calls[0][0].data
    expect(data).toMatchObject({
      conversaId: 'conv1', nome: 'proposta.pdf', formato: 'pdf', chaveR2: `assistente/conv1/${UUID}.pdf`,
      status: 'ok', ocr: false, paginas: 2,
      paginasTexto: { create: [{ pagina: 1, texto: textoLongo }, { pagina: 2, texto: textoLongo }] },
    })
    expect(data.ficha).toEqual(r.anexo.ficha)
    expect(r.anexo).toMatchObject({ id: 'a1', nome: 'proposta.pdf', status: 'ok' })
    expect(r.texto).toBe(textoDaFicha('proposta.pdf', r.anexo.ficha!))
  })

  it('nome gravado sem caminho', async () => {
    ;(paginasDoAnexo as jest.Mock).mockResolvedValue({ paginas: [{ pagina: 1, texto: textoLongo }], anexosDoEmail: [] })
    const r = await registrarAnexo({ conversaId: 'conv1', usuario, endereco, nome: 'C:\\pasta/sub\\proposta.pdf' })
    expect((prisma.anexoAssistente.create as jest.Mock).mock.calls[0][0].data.nome).toBe('proposta.pdf')
    expect(r.anexo.nome).toBe('proposta.pdf')
  })

  it('PDF sem camada de texto + OCR do navegador: usa o OCR e marca página vazia como ilegível', async () => {
    ;(paginasDoAnexo as jest.Mock).mockResolvedValue({ paginas: [{ pagina: 1, texto: '' }, { pagina: 2, texto: ' ' }], anexosDoEmail: [] })
    const r = await registrarAnexo({
      conversaId: 'conv1', usuario, endereco, nome: 'scan.pdf',
      paginasOcr: [{ pagina: 1, texto: textoLongo }, { pagina: 2, texto: '  ' }],
    })
    const data = (prisma.anexoAssistente.create as jest.Mock).mock.calls[0][0].data
    expect(data).toMatchObject({ status: 'ok', ocr: true, paginas: 1, paginasTexto: { create: [{ pagina: 1, texto: textoLongo }] } })
    expect(r.anexo.ficha!.avisos).toContain('página 2 ilegível')
  })

  it('PDF sem texto e sem OCR: sem_texto, com aviso', async () => {
    ;(paginasDoAnexo as jest.Mock).mockResolvedValue({ paginas: [{ pagina: 1, texto: '' }], anexosDoEmail: [] })
    const r = await registrarAnexo({ conversaId: 'conv1', usuario, endereco, nome: 'scan.pdf' })
    const data = (prisma.anexoAssistente.create as jest.Mock).mock.calls[0][0].data
    expect(data).toMatchObject({ status: 'sem_texto', ocr: false, paginas: 0, paginasTexto: { create: [] } })
    expect(r.anexo.status).toBe('sem_texto')
    expect(r.anexo.ficha!.avisos).toContain('não foi possível ler o texto deste arquivo')
  })

  it('extração lança: status erro e texto curto', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(paginasDoAnexo as jest.Mock).mockRejectedValue(new Error('pdf quebrado'))
    const r = await registrarAnexo({ conversaId: 'conv1', usuario, endereco, nome: 'quebrado.pdf' })
    expect((prisma.anexoAssistente.create as jest.Mock).mock.calls[0][0].data).toMatchObject({ status: 'erro', chaveR2: `assistente/conv1/${UUID}.pdf` })
    expect(r).toEqual({ anexo: { id: 'a1', nome: 'quebrado.pdf', status: 'erro', ficha: null }, texto: 'Não consegui ler quebrado.pdf.' })
  })

  it('endereço de outra conversa: recusa antes de baixar', async () => {
    await expect(registrarAnexo({ conversaId: 'conv2', usuario, endereco, nome: 'x.pdf' })).rejects.toThrow('endereço do anexo inválido')
    expect(getR2).not.toHaveBeenCalled()
    expect(prisma.anexoAssistente.create).not.toHaveBeenCalled()
  })

  it('arquivo que não chegou ao R2: erro sem registro', async () => {
    ;(getR2 as jest.Mock).mockResolvedValue(new Response('nao', { status: 404 }))
    await expect(registrarAnexo({ conversaId: 'conv1', usuario, endereco, nome: 'x.pdf' })).rejects.toBeInstanceOf(AnexoForaDoR2)
    jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(getR2 as jest.Mock).mockRejectedValue(new Error('rede'))
    await expect(registrarAnexo({ conversaId: 'conv1', usuario, endereco, nome: 'x.pdf' })).rejects.toBeInstanceOf(AnexoForaDoR2)
    expect(prisma.anexoAssistente.create).not.toHaveBeenCalled()
  })

  it('entidades: primeiros 3000 caracteres; cliente e contrato únicos entram, provável não', async () => {
    const grande = 'A'.repeat(2500)
    ;(paginasDoAnexo as jest.Mock).mockResolvedValue({ paginas: [{ pagina: 1, texto: grande }, { pagina: 2, texto: 'B'.repeat(2500) }], anexosDoEmail: [] })
    ;(identificarEntidades as jest.Mock).mockResolvedValue({
      clientes: [{ id: 'c1', nome: 'Secretaria de Inovação', sigla: 'SMIT' }],
      contratos: [{ id: 'k1', numero: '52/2024', clienteId: 'c1' }],
      possiveis: [], provavel: { id: 'k9', numero: '9/2020', descricao: 'nuvem' }, texto: null,
    })
    const r = await registrarAnexo({ conversaId: 'conv1', usuario, endereco, nome: 'p.pdf' })
    const chamada = (identificarEntidades as jest.Mock).mock.calls[0][0]
    expect(chamada.usuario).toBe(usuario)
    expect(chamada.recentes).toEqual([])
    expect(chamada.pergunta).toHaveLength(3000)
    expect(chamada.pergunta.startsWith(grande)).toBe(true)
    expect(r.anexo.ficha).toMatchObject({ clienteId: 'c1', cliente: 'SMIT – Secretaria de Inovação', contratoId: 'k1', contrato: '52/2024' })
  })

  it('entidades ambíguas (dois clientes) não entram; provável sozinho também não', async () => {
    ;(paginasDoAnexo as jest.Mock).mockResolvedValue({ paginas: [{ pagina: 1, texto: textoLongo }], anexosDoEmail: [] })
    ;(identificarEntidades as jest.Mock).mockResolvedValue({
      clientes: [{ id: 'c1', nome: 'A', sigla: null }, { id: 'c2', nome: 'B', sigla: null }],
      contratos: [], possiveis: [], provavel: { id: 'k9', numero: '9/2020', descricao: 'nuvem' }, texto: null,
    })
    const r = await registrarAnexo({ conversaId: 'conv1', usuario, endereco, nome: 'p.pdf' })
    expect(r.anexo.ficha).toMatchObject({ clienteId: null, cliente: null, contratoId: null, contrato: null })
  })
})

describe('apagarAnexosDaConversa', () => {
  it('apaga cada chave no R2 e engole erro', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(prisma.anexoAssistente.findMany as jest.Mock).mockResolvedValue([{ chaveR2: 'assistente/c1/a.pdf' }, { chaveR2: 'assistente/c1/b.txt' }])
    ;(deleteR2 as jest.Mock).mockRejectedValueOnce(new Error('falhou')).mockResolvedValueOnce(undefined)
    await expect(apagarAnexosDaConversa('c1')).resolves.toBeUndefined()
    expect(prisma.anexoAssistente.findMany).toHaveBeenCalledWith({ where: { conversaId: 'c1' }, select: { chaveR2: true } })
    expect(deleteR2).toHaveBeenCalledWith('assistente/c1/a.pdf')
    expect(deleteR2).toHaveBeenCalledWith('assistente/c1/b.txt')
    expect(console.error).toHaveBeenCalled()
  })
})
