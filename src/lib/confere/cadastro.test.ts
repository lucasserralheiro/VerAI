/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    contrato: { findMany: jest.fn(), findFirst: jest.fn() },
    historicoContrato: { findMany: jest.fn() },
    arquivoCliente: { findMany: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/relatorios-clientes/contratos-consolidados', () => ({ consolidarContratos: jest.fn() }))
jest.mock('@/lib/storage', () => ({ getUpload: jest.fn() }))

import { prisma } from '@/lib/prisma'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { getUpload } from '@/lib/storage'

import {
  ArquivoDoCadastroRecusado,
  buscarContratos,
  carregarArquivosDoCadastro,
  documentosDoContrato,
  identificarLevantamento,
} from './cadastro'
import { MENSAGEM_NAO_ABRE } from './levantamento'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const d = (iso: string) => new Date(`${iso}T00:00:00Z`)
const LEVANTAMENTO_SMIT = readFileSync(path.join(process.cwd(), 'services/confere/backend/tests/fixtures/levantamento.xlsx'))

const CONTRATO_SMIT = {
  id: 'ct-smit',
  clienteId: 'cl-smit',
  numeroTermo: 'TC 52/SMIT/2024',
  chaveSharepoint: 'SMIT|52 2024',
  descricao: 'Sustentação',
  situacao: null,
  dataInicio: null,
  dataVencimento: null,
  cliente: { nome: 'Secretaria Municipal de Inovação e Tecnologia', siglaLegado: 'SMIT' },
}
const CONTRATO_OUTRO = { ...CONTRATO_SMIT, id: 'ct-12', numeroTermo: 'TC 12/SMIT/2025', chaveSharepoint: 'SMIT|12 2025', descricao: null }

function linhaSmit(id: string, tipo: string, numero: string | null, inicio: string, pdf: string) {
  return {
    id,
    tipo,
    numero,
    data: null,
    dataInicio: d(inicio),
    dataVencimento: null,
    situacao: null,
    proposta: null,
    createdAt: d(inicio),
    propostaArquivo: { id: pdf, nome: `${pdf}.pdf`, removidoEm: null },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([CONTRATO_SMIT, CONTRATO_OUTRO])
  ;(prisma.historicoContrato.findMany as jest.Mock).mockResolvedValue([
    linhaSmit('l1', 'CONTRATO', 'TC 52/SMIT/2024', '2024-07-01', 'pc-smit'),
    linhaSmit('l2', 'PRORROGACAO', 'TA 01', '2025-07-01', 'pa-smit-01'),
    linhaSmit('l3', 'PRORROGACAO', 'TA 02', '2026-07-01', 'pa-smit-02'),
  ])
  ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([])
  ;(consolidarContratos as jest.Mock).mockImplementation(
    async (lista: Array<{ id: string }>) => new Map(lista.map((c) => [c.id, { vigenciaFim: d('2027-06-30'), ativo: true }]))
  )
})

describe('identificarLevantamento', () => {
  it('planilha real do SMIT: acha o contrato e escolhe a renovação TA 02 para julho/2026', async () => {
    const resposta = await identificarLevantamento(admin, LEVANTAMENTO_SMIT)
    expect(resposta.situacao).toBe('encontrado')
    if (resposta.situacao !== 'encontrado') return
    expect(resposta.leitura).toEqual({ referencia: 'TC 52/SMIT/2024', competencia: { ano: 2026, mes: 7 } })
    expect(resposta.documentos.contrato).toMatchObject({
      id: 'ct-smit',
      numeroTermo: 'TC 52/SMIT/2024',
      vigenciaFim: '2027-06-30',
      ativo: true,
    })
    expect(resposta.documentos.competencia).toEqual({ ano: 2026, mes: 7, lidaDaPlanilha: true })
    expect(resposta.documentos.base?.arquivoId).toBe('pa-smit-02')
    expect(prisma.historicoContrato.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { contratoId: 'ct-smit' } }))
  })

  it('procura entre todos os clientes, sem restrição de vínculo (leitura liberada)', async () => {
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([])
    const resposta = await identificarLevantamento(comum, LEVANTAMENTO_SMIT)
    expect(prisma.contrato.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
    expect(resposta).toMatchObject({ situacao: 'nao-encontrado', sugestoes: [] })
  })

  it('planilha que não abre', async () => {
    await expect(identificarLevantamento(admin, new TextEncoder().encode('x'))).resolves.toEqual({
      situacao: 'ilegivel',
      mensagem: MENSAGEM_NAO_ABRE,
    })
  })
})

describe('documentosDoContrato', () => {
  it('contrato que a pessoa não vê (ou não existe): null', async () => {
    ;(prisma.contrato.findFirst as jest.Mock).mockResolvedValue(null)
    await expect(documentosDoContrato(admin, 'ct-x', { ano: 2026, mes: 7 }, true)).resolves.toBeNull()
  })

  it('contrato sem proposta nenhuma: as propostas soltas do cliente entram como alternativa', async () => {
    ;(prisma.contrato.findFirst as jest.Mock).mockResolvedValue(CONTRATO_SMIT)
    ;(prisma.historicoContrato.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([{ id: 'solta', nome: 'PC-SMIT-solta.pdf' }])
    const documentos = await documentosDoContrato(admin, 'ct-smit', { ano: 2026, mes: 7 }, false)
    expect(documentos?.base).toBeNull()
    expect(documentos?.alternativas).toEqual([{ arquivoId: 'solta', nome: 'PC-SMIT-solta.pdf', origem: null }])
    expect(documentos?.competencia).toEqual({ ano: 2026, mes: 7, lidaDaPlanilha: false })
    expect(documentos?.avisos.map((a) => a.codigo)).toContain('sem-proposta')
  })
})

describe('buscarContratos', () => {
  it('cada palavra casa com o começo de alguma palavra do contrato ou do cliente', async () => {
    const achados = await buscarContratos(admin, '52 smit')
    expect(achados.map((c) => c.id)).toEqual(['ct-smit'])
  })

  it('busca vazia não consulta', async () => {
    await expect(buscarContratos(admin, '  ')).resolves.toEqual([])
    expect(prisma.contrato.findMany).not.toHaveBeenCalled()
  })
})

describe('carregarArquivosDoCadastro', () => {
  const PC = { id: 'pc', clienteId: 'cl-smit', nome: 'PC.pdf', extensao: 'pdf', urlBlob: 'r2:x', removidoEm: null }

  it('baixa os PDFs pedidos', async () => {
    ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([PC])
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('%PDF'))
    const arquivos = await carregarArquivosDoCadastro(admin, ['pc', 'pc'], 'cl-smit')
    expect(arquivos.get('pc')).toEqual({ nome: 'PC.pdf', bytes: Buffer.from('%PDF') })
    expect(getUpload).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['removido', { ...PC, removidoEm: new Date() }, 409],
    ['não é PDF', { ...PC, extensao: 'xlsx' }, 400],
    ['de outro cliente', { ...PC, clienteId: 'cl-outro' }, 400],
  ])('recusa arquivo %s', async (_caso, arquivo, status) => {
    ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([arquivo])
    await expect(carregarArquivosDoCadastro(admin, ['pc'], 'cl-smit')).rejects.toMatchObject({ status })
  })

  it('arquivo de cliente sem vínculo com o usuário também baixa (leitura liberada)', async () => {
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'cl-outro' }] })
    ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([PC])
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('%PDF'))
    const arquivos = await carregarArquivosDoCadastro(comum, ['pc'], null)
    expect(arquivos.get('pc')).toEqual({ nome: 'PC.pdf', bytes: Buffer.from('%PDF') })
  })

  it('falha no storage vira 502 com o nome do arquivo', async () => {
    ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([PC])
    ;(getUpload as jest.Mock).mockRejectedValue(new Error('R2 fora'))
    await expect(carregarArquivosDoCadastro(admin, ['pc'], null)).rejects.toBeInstanceOf(ArquivoDoCadastroRecusado)
    await expect(carregarArquivosDoCadastro(admin, ['pc'], null)).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining('PC.pdf'),
    })
  })

  it('sem ids, nem consulta', async () => {
    await expect(carregarArquivosDoCadastro(admin, [], null)).resolves.toEqual(new Map())
    expect(prisma.arquivoCliente.findMany).not.toHaveBeenCalled()
  })
})
