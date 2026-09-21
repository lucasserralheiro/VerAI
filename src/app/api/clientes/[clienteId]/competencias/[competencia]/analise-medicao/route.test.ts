/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: { findUnique: jest.fn() },
    analiseMedicaoContratual: { findUnique: jest.fn(), upsert: jest.fn() },
  },
}))
jest.mock('@/lib/visibilidade', () => ({ podeVerCliente: jest.fn() }))
jest.mock('@/lib/storage', () => ({
  putUpload: jest.fn(),
  buildArquivoMedicaoPath: jest.fn(() => 'caminho/entrada'),
  buildRelatorioMedicaoPath: jest.fn(() => 'caminho/relatorio'),
}))
jest.mock('@/lib/confere/cliente', () => ({ chamarConfere: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { podeVerCliente } from '@/lib/visibilidade'
import { putUpload } from '@/lib/storage'
import { chamarConfere } from '@/lib/confere/cliente'
import { GET, POST } from './route'

const contexto = { params: Promise.resolve({ clienteId: 'c1', competencia: '2026-09' }) }

function requisicaoGet() {
  return new NextRequest('http://localhost/api/clientes/c1/competencias/2026-09/analise-medicao')
}

function requisicaoPost(campos: Record<string, string | File | File[]>) {
  const formData = new FormData()
  for (const [chave, valor] of Object.entries(campos)) {
    if (Array.isArray(valor)) {
      for (const item of valor) formData.append(chave, item)
    } else {
      formData.append(chave, valor)
    }
  }
  return new NextRequest('http://localhost/api/clientes/c1/competencias/2026-09/analise-medicao', {
    method: 'POST',
    body: formData,
  })
}

function arquivo(nome: string, conteudo = 'conteudo'): File {
  return new File([conteudo], nome)
}

describe('GET /api/clientes/[clienteId]/competencias/[competencia]/analise-medicao', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
    ;(podeVerCliente as jest.Mock).mockResolvedValue(true)
  })

  it('retorna 401 sem autenticação', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(requisicaoGet(), contexto)).status).toBe(401)
  })

  it('retorna 400 com competência inválida', async () => {
    const contextoInvalido = { params: Promise.resolve({ clienteId: 'c1', competencia: '2026-9' }) }
    expect((await GET(requisicaoGet(), contextoInvalido)).status).toBe(400)
  })

  it('retorna 403 sem acesso ao cliente', async () => {
    ;(podeVerCliente as jest.Mock).mockResolvedValue(false)
    expect((await GET(requisicaoGet(), contexto)).status).toBe(403)
  })

  it('devolve null quando ainda não existe análise pra essa competência', async () => {
    ;(prisma.analiseMedicaoContratual.findUnique as jest.Mock).mockResolvedValue(null)
    const resposta = await GET(requisicaoGet(), contexto)
    expect(resposta.status).toBe(200)
    expect(await resposta.json()).toBeNull()
  })

  it('devolve a análise existente, com os arquivos de entrada', async () => {
    ;(prisma.analiseMedicaoContratual.findUnique as jest.Mock).mockResolvedValue({
      id: 'a1',
      status: 'concluido',
      arquivos: [{ papel: 'contrato', nomeArquivo: 'c.pdf' }],
    })
    const resposta = await GET(requisicaoGet(), contexto)
    const corpo = await resposta.json()
    expect(corpo.id).toBe('a1')
    expect(corpo.arquivos).toHaveLength(1)
  })
})

describe('POST /api/clientes/[clienteId]/competencias/[competencia]/analise-medicao', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
    ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', nome: 'Cliente 1' })
    ;(podeVerCliente as jest.Mock).mockResolvedValue(true)
    ;(putUpload as jest.Mock).mockResolvedValue('https://blob/arquivo')
    ;(prisma.analiseMedicaoContratual.upsert as jest.Mock).mockImplementation(
      async ({ create }) => ({ id: 'a1', ...create })
    )
  })

  it('retorna 401 sem autenticação', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    const resposta = await POST(requisicaoPost({}), contexto)
    expect(resposta.status).toBe(401)
  })

  it('retorna 404 quando o cliente não existe', async () => {
    ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue(null)
    const resposta = await POST(
      requisicaoPost({ contrato: arquivo('c.pdf'), levantamento: arquivo('l.xlsx') }),
      contexto
    )
    expect(resposta.status).toBe(404)
  })

  it('retorna 403 sem acesso ao cliente', async () => {
    ;(podeVerCliente as jest.Mock).mockResolvedValue(false)
    const resposta = await POST(
      requisicaoPost({ contrato: arquivo('c.pdf'), levantamento: arquivo('l.xlsx') }),
      contexto
    )
    expect(resposta.status).toBe(403)
  })

  it('retorna 400 quando falta "contrato" ou "levantamento"', async () => {
    const resposta = await POST(requisicaoPost({ contrato: arquivo('c.pdf') }), contexto)
    expect(resposta.status).toBe(400)
    expect(chamarConfere).not.toHaveBeenCalled()
  })

  it('sucesso: chama o Confere, sobe os dois arquivos gerados e salva status "concluido"', async () => {
    ;(chamarConfere as jest.Mock).mockResolvedValue({
      tipo: 'concluido',
      resposta: {
        titulo: 'Relatório',
        docx_base64: Buffer.from('docx').toString('base64'),
        analise_xlsx_base64: Buffer.from('xlsx').toString('base64'),
      },
    })

    const resposta = await POST(
      requisicaoPost({
        contrato: arquivo('contrato.pdf'),
        levantamento: arquivo('levantamento.xlsx'),
        aditivos: [arquivo('aditivo1.pdf')],
        identidadeConfirmada: 'true',
      }),
      contexto
    )

    expect(resposta.status).toBe(200)
    expect(chamarConfere).toHaveBeenCalledWith(
      expect.objectContaining({ identidadeConfirmada: true, aditivos: expect.arrayContaining([expect.anything()]) })
    )
    // 2 arquivos de entrada (contrato + levantamento) + 1 aditivo + docx + xlsx = 5
    expect(putUpload).toHaveBeenCalledTimes(5)

    const upsertArgs = (prisma.analiseMedicaoContratual.upsert as jest.Mock).mock.calls[0][0]
    expect(upsertArgs.create.status).toBe('concluido')
    expect(upsertArgs.create.caminhoRelatorioDocx).toBe('https://blob/arquivo')
    expect(upsertArgs.create.resultado.titulo).toBe('Relatório')
    expect(upsertArgs.create.resultado.docx_base64).toBeUndefined()
    expect(upsertArgs.update.arquivos.deleteMany).toEqual({})
  })

  it('bloqueado: retorna 422 e salva achadosBloqueio, sem gerar relatório', async () => {
    ;(chamarConfere as jest.Mock).mockResolvedValue({
      tipo: 'bloqueado',
      resposta: { bloqueantes: [{ validacao: 'V-1', severidade: 'BLOQUEIA', mensagem: 'x' }], avisos: [], confirmaveis: [], pode_prosseguir: false },
    })

    const resposta = await POST(
      requisicaoPost({ contrato: arquivo('c.pdf'), levantamento: arquivo('l.xlsx') }),
      contexto
    )

    expect(resposta.status).toBe(422)
    const upsertArgs = (prisma.analiseMedicaoContratual.upsert as jest.Mock).mock.calls[0][0]
    expect(upsertArgs.create.status).toBe('bloqueado')
    expect(upsertArgs.create.caminhoRelatorioDocx).toBeNull()
    expect(upsertArgs.create.achadosBloqueio.bloqueantes).toHaveLength(1)
    // só os 2 arquivos de entrada sobem - nenhum relatório gerado
    expect(putUpload).toHaveBeenCalledTimes(2)
  })

  it('erro do Confere (rede/serviço fora): retorna 502 e salva mensagemErro', async () => {
    ;(chamarConfere as jest.Mock).mockResolvedValue({ tipo: 'erro', mensagem: 'Confere indisponível' })

    const resposta = await POST(
      requisicaoPost({ contrato: arquivo('c.pdf'), levantamento: arquivo('l.xlsx') }),
      contexto
    )

    expect(resposta.status).toBe(502)
    const upsertArgs = (prisma.analiseMedicaoContratual.upsert as jest.Mock).mock.calls[0][0]
    expect(upsertArgs.create.status).toBe('erro')
    expect(upsertArgs.create.mensagemErro).toBe('Confere indisponível')
  })
})
