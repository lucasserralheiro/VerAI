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
import { POST, maxDuration } from './route'

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
      }),
      // O orçamento de tempo tem teste próprio, abaixo.
      expect.anything()
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

  // Quebra que pega: o próprio bug de 24/09/2026. Com `maxDuration = 120` a
  // Vercel matava a função antes de o Confere terminar — medido no Render free:
  // 134 s com o contrato CGM + 1 aditivo, serviço já acordado, mais ~23 s quando
  // ele hiberna — e a tela recebia o 504 cru da plataforma.
  it('dá ao Confere tempo para o pior caso medido, e desiste dele antes de a Vercel matar a função', async () => {
    ;(chamarConfere as jest.Mock).mockResolvedValue({ tipo: 'erro', mensagem: 'irrelevante aqui' })

    await POST(requisicao({ contrato: arquivo('c.pdf'), levantamento: arquivo('l.xlsx') }))

    const [, opcoes] = (chamarConfere as jest.Mock).mock.calls[0]
    // 134 s + ~23 s de despertar, arredondado pra cima.
    expect(opcoes?.tempoLimiteMs).toBeGreaterThanOrEqual(160_000)
    // Depois do Confere ainda vêm o histórico (2 uploads + 1 insert) e ~5 MB de
    // resposta, tudo dentro do mesmo `maxDuration`.
    expect(maxDuration * 1000 - opcoes.tempoLimiteMs).toBeGreaterThanOrEqual(20_000)
    // Teto do plano Hobby com Fluid compute: acima disso o deploy é recusado.
    expect(maxDuration).toBeLessThanOrEqual(300)
  })

  it('devolve 504 com "detail" quando o Confere não responde a tempo', async () => {
    ;(chamarConfere as jest.Mock).mockResolvedValue({ tipo: 'tempo-esgotado' })

    const resposta = await POST(
      requisicao({ contrato: arquivo('c.pdf'), levantamento: arquivo('l.xlsx') })
    )

    expect(resposta.status).toBe(504)
    const corpo = await resposta.json()
    expect(corpo.detail).toEqual(expect.any(String))
    expect(corpo.detail).not.toBe('')
  })
})
