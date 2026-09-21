/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/confere/cliente', () => ({ chamarConfere: jest.fn() }))

// O caminho de sucesso registra a execução no histórico (`ConfereExecucao`).
// É best-effort e não muda o que a rota devolve — o que estes testes medem —,
// mas sem os dois dublês ela tentaria falar com o Blob e com o banco.
jest.mock('@/lib/storage', () => ({
  buildConfereExecucaoPath: jest.fn(() => 'caminho/no/blob'),
  putUpload: jest.fn(async () => 'https://blob.local/arquivo'),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { confereExecucao: { create: jest.fn(async () => ({})) } },
}))

import { chamarConfere } from '@/lib/confere/cliente'
import { POST } from './route'

function requisicao(campos: Record<string, string | File | File[]>) {
  const formData = new FormData()
  for (const [chave, valor] of Object.entries(campos)) {
    if (Array.isArray(valor)) {
      for (const item of valor) formData.append(chave, item)
    } else {
      formData.append(chave, valor)
    }
  }
  return new NextRequest('http://localhost/api/confere/reports', { method: 'POST', body: formData })
}

function arquivo(nome: string, conteudo = 'conteudo'): File {
  return new File([conteudo], nome)
}

describe('POST /api/confere/reports', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('retorna 400 quando falta o contrato ou o levantamento', async () => {
    const resposta = await POST(requisicao({ levantamento: arquivo('l.xlsx') }))
    expect(resposta.status).toBe(400)
    expect(chamarConfere).not.toHaveBeenCalled()
  })

  it('repassa contrato, levantamento e aditivos pro chamarConfere, na ordem certa', async () => {
    ;(chamarConfere as jest.Mock).mockResolvedValue({
      tipo: 'concluido',
      resposta: { docx_base64: 'AA==', analise_xlsx_base64: 'BB==' },
    })

    await POST(
      requisicao({
        contrato: arquivo('contrato.pdf'),
        levantamento: arquivo('levantamento.xlsx'),
        aditivos: [arquivo('aditivo1.pdf'), arquivo('aditivo2.pdf')],
        identidade_confirmada: 'true',
      })
    )

    expect(chamarConfere).toHaveBeenCalledWith(
      expect.objectContaining({
        contrato: expect.objectContaining({ nome: 'contrato.pdf' }),
        levantamento: expect.objectContaining({ nome: 'levantamento.xlsx' }),
        aditivos: [
          expect.objectContaining({ nome: 'aditivo1.pdf' }),
          expect.objectContaining({ nome: 'aditivo2.pdf' }),
        ],
        identidadeConfirmada: true,
      })
    )
  })

  it('devolve 200 com o relatório completo quando concluído', async () => {
    const relatorio = { docx_base64: 'AA==', analise_xlsx_base64: 'BB==', total_divergencias: 3 }
    ;(chamarConfere as jest.Mock).mockResolvedValue({ tipo: 'concluido', resposta: relatorio })

    const resposta = await POST(
      requisicao({ contrato: arquivo('c.pdf'), levantamento: arquivo('l.xlsx') })
    )

    expect(resposta.status).toBe(200)
    expect(await resposta.json()).toEqual(relatorio)
  })

  it('devolve 422 com o corpo de bloqueio quando bloqueado', async () => {
    const bloqueio = { bloqueantes: [{ validacao: 'V-1', mensagem: 'erro' }], avisos: [], confirmaveis: [] }
    ;(chamarConfere as jest.Mock).mockResolvedValue({ tipo: 'bloqueado', resposta: bloqueio })

    const resposta = await POST(
      requisicao({ contrato: arquivo('c.pdf'), levantamento: arquivo('l.xlsx') })
    )

    expect(resposta.status).toBe(422)
    expect(await resposta.json()).toEqual(bloqueio)
  })

  it('devolve erro com "detail" quando o chamarConfere falha', async () => {
    ;(chamarConfere as jest.Mock).mockResolvedValue({ tipo: 'erro', mensagem: 'Confere fora do ar' })

    const resposta = await POST(
      requisicao({ contrato: arquivo('c.pdf'), levantamento: arquivo('l.xlsx') })
    )

    expect(resposta.status).toBe(502)
    expect(await resposta.json()).toEqual({ detail: 'Confere fora do ar' })
  })
})
