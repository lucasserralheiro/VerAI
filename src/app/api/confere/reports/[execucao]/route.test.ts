/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/confere/cliente', () => ({ consultarNoConfere: jest.fn(), resultadoDoConfere: jest.fn() }))
jest.mock('@/lib/storage', () => ({
  buildConfereExecucaoPath: jest.fn(() => 'caminho/no/blob'),
  putUpload: jest.fn(async () => 'https://blob.local/arquivo'),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { confereExecucao: { create: jest.fn(async () => ({})), findUnique: jest.fn(async () => null) } },
}))
jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { consultarNoConfere, resultadoDoConfere } from '@/lib/confere/cliente'
import { emitirBilhete, type ExecucaoAssincrona } from '@/lib/confere/execucao-assincrona'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

describe('GET /api/confere/reports/[execucao]', () => {
  const OLD_ENV = process.env
  const execucao: ExecucaoAssincrona = {
    job: 'job-1',
    execucao: 'exec-1',
    usuarioId: 'u1',
    contratoId: 'ct-1',
    competencia: { ano: 2026, mes: 9 },
    nomes: { contrato: 'c.pdf', levantamento: 'l.xlsx', aditivos: [] },
    entradas: [{ papel: 'contrato', nome: 'c.pdf', caminho: 'https://blob.local/entrada-0.pdf' }],
    emitidoEm: Date.now(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...OLD_ENV, CONFERE_SHARED_SECRET: 'segredo-de-teste' }
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' })
  })
  afterAll(() => {
    process.env = OLD_ENV
  })

  function consultar(bilhete = emitirBilhete(execucao)) {
    return GET(new NextRequest(`http://localhost/api/confere/reports/${bilhete}`), {
      params: Promise.resolve({ execucao: bilhete }),
    })
  }

  it('em andamento: 202 com a fase', async () => {
    ;(consultarNoConfere as jest.Mock).mockResolvedValue({
      tipo: 'andamento',
      situacao: 'processando',
      fase: 'Lendo o aditivo 1 de 2',
      posicao: 0,
      segundos: 40,
    })

    const resposta = await consultar()

    expect(resposta.status).toBe(202)
    expect(await resposta.json()).toEqual({
      situacao: 'processando',
      fase: 'Lendo o aditivo 1 de 2',
      posicao: 0,
      segundos: 40,
    })
    expect(resultadoDoConfere).not.toHaveBeenCalled()
  })

  it('pronto: devolve o relatório e grava o histórico com o id e as entradas do bilhete', async () => {
    ;(consultarNoConfere as jest.Mock).mockResolvedValue({ tipo: 'pronto' })
    ;(resultadoDoConfere as jest.Mock).mockResolvedValue({
      tipo: 'concluido',
      resposta: { docx_base64: 'AA==', analise_xlsx_base64: 'BB==', total_divergencias: 1 },
    })

    const resposta = await consultar()

    expect(resposta.status).toBe(200)
    expect(await resposta.json()).toEqual({
      docx_base64: 'AA==',
      analise_xlsx_base64: 'BB==',
      total_divergencias: 1,
      historico_salvo: true,
    })
    expect(prisma.confereExecucao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'exec-1',
        contratoId: 'ct-1',
        competenciaAno: 2026,
        competenciaMes: 9,
        arquivosEntrada: execucao.entradas,
      }),
    })
  })

  it('segunda consulta do mesmo resultado não duplica o histórico', async () => {
    ;(consultarNoConfere as jest.Mock).mockResolvedValue({ tipo: 'pronto' })
    ;(resultadoDoConfere as jest.Mock).mockResolvedValue({
      tipo: 'concluido',
      resposta: { docx_base64: 'AA==', analise_xlsx_base64: 'BB==' },
    })
    ;(prisma.confereExecucao.findUnique as jest.Mock).mockResolvedValue({ id: 'exec-1' })

    const resposta = await consultar()

    expect(resposta.status).toBe(200)
    expect(prisma.confereExecucao.create).not.toHaveBeenCalled()
  })

  it('bloqueado: 422 com o corpo do bloqueio', async () => {
    const bloqueio = { bloqueantes: [{ validacao: 'V-1', mensagem: 'x' }], avisos: [], confirmaveis: [] }
    ;(consultarNoConfere as jest.Mock).mockResolvedValue({ tipo: 'pronto' })
    ;(resultadoDoConfere as jest.Mock).mockResolvedValue({ tipo: 'bloqueado', resposta: bloqueio })

    const resposta = await consultar()

    expect(resposta.status).toBe(422)
    expect(await resposta.json()).toEqual(bloqueio)
  })

  it('o Confere perdeu o job (reiniciou): 410, para a tela pedir novo envio', async () => {
    ;(consultarNoConfere as jest.Mock).mockResolvedValue({ tipo: 'perdido', mensagem: 'não está mais no Confere' })

    const resposta = await consultar()

    expect(resposta.status).toBe(410)
    expect(await resposta.json()).toEqual({ detail: 'não está mais no Confere' })
  })

  it('bilhete de outra pessoa: 404, sem consultar o Confere', async () => {
    const resposta = await consultar(emitirBilhete({ ...execucao, usuarioId: 'outro' }))

    expect(resposta.status).toBe(404)
    expect(consultarNoConfere).not.toHaveBeenCalled()
  })
})
