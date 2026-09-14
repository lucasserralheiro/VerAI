import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NovaPropostaComercialPage from './page'

const pushMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }))

jest.mock('@vercel/blob/client', () => ({ upload: jest.fn() }))
import { upload } from '@vercel/blob/client'

function soltarArquivo(nome: string, conteudo = 'conteudo') {
  const file = new File([conteudo], nome, { type: 'application/pdf' })
  const dropzone = screen.getByRole('button', { name: /Clique para enviar/ })
  fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
  return file
}

/** Upload em 2 passos: o navegador sobe o arquivo DIRETO pro Vercel Blob
 *  (bypassa o limite de 4,5 MB de corpo de requisição de função serverless
 *  da Vercel — caso real: PDF de ~6 MB batendo 413) e só manda a URL
 *  resultante pro `POST /api/propostas-comerciais`, não o arquivo em si. */
describe('NovaPropostaComercialPage', () => {
  beforeEach(() => {
    pushMock.mockClear()
    ;(upload as jest.Mock).mockClear()
    global.fetch = jest.fn()
  })

  it('sobe o arquivo direto pro Blob (não manda o binário pro /api/propostas-comerciais)', async () => {
    ;(upload as jest.Mock).mockResolvedValue({ url: 'https://blob.exemplo/tmp/proposta.pdf' })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'p1' }),
    })

    render(<NovaPropostaComercialPage />)
    soltarArquivo('proposta.pdf')
    fireEvent.click(screen.getByRole('button', { name: /Enviar proposta/ }))

    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
    const [, , opcoes] = (upload as jest.Mock).mock.calls[0]
    expect(opcoes).toEqual(expect.objectContaining({ handleUploadUrl: '/api/propostas-comerciais/upload-token' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const corpo = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(corpo.arquivos).toEqual([
      expect.objectContaining({ nomeArquivo: 'proposta.pdf', url: 'https://blob.exemplo/tmp/proposta.pdf' }),
    ])
  })

  it('depois do upload, redireciona pra proposta criada', async () => {
    ;(upload as jest.Mock).mockResolvedValue({ url: 'https://blob.exemplo/tmp/proposta.pdf' })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'p1' }),
    })

    render(<NovaPropostaComercialPage />)
    soltarArquivo('proposta.pdf')
    fireEvent.click(screen.getByRole('button', { name: /Enviar proposta/ }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/propostas-comerciais/p1'))
  })

  it('falha no upload pro Blob mostra o erro, sem chamar /api/propostas-comerciais', async () => {
    ;(upload as jest.Mock).mockRejectedValue(new Error('arquivo grande demais'))

    render(<NovaPropostaComercialPage />)
    soltarArquivo('proposta.pdf')
    fireEvent.click(screen.getByRole('button', { name: /Enviar proposta/ }))

    expect(await screen.findByText('arquivo grande demais')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
