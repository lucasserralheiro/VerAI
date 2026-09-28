import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NovaPropostaComercialPage from './page'

const pushMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }))

jest.mock('@/lib/envio-r2-navegador', () => ({ enviarParaR2: jest.fn() }))
import { enviarParaR2 } from '@/lib/envio-r2-navegador'

const ENDERECO = 'r2:tmp-uploads/0f8fad5b-d9cb-469f-a165-70867728950e.pdf'

function soltarArquivo(nome: string, conteudo = 'conteudo') {
  const file = new File([conteudo], nome, { type: 'application/pdf' })
  const dropzone = screen.getByRole('button', { name: /Clique para enviar/ })
  fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
  return file
}

/** Envio em 2 passos: o navegador sobe o arquivo DIRETO pro R2
 *  (bypassa o limite de 4,5 MB de corpo de requisição de função serverless
 *  da Vercel — caso real: PDF de ~6 MB batendo 413) e só manda o endereço
 *  resultante pro `POST /api/propostas-comerciais`, não o arquivo em si. */
describe('NovaPropostaComercialPage', () => {
  beforeEach(() => {
    pushMock.mockClear()
    ;(enviarParaR2 as jest.Mock).mockReset()
    global.fetch = jest.fn()
  })

  it('sobe o arquivo direto pro R2 (não manda o binário pro /api/propostas-comerciais)', async () => {
    ;(enviarParaR2 as jest.Mock).mockResolvedValue(ENDERECO)
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'p1' }),
    })

    render(<NovaPropostaComercialPage />)
    const arquivo = soltarArquivo('proposta.pdf')
    fireEvent.click(screen.getByRole('button', { name: /Enviar proposta/ }))

    await waitFor(() => expect(enviarParaR2).toHaveBeenCalledTimes(1))
    expect(enviarParaR2).toHaveBeenCalledWith(arquivo, '/api/propostas-comerciais/envio')

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const [rota, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(rota).toBe('/api/propostas-comerciais')
    expect(JSON.parse(init.body).arquivos).toEqual([
      { nomeArquivo: 'proposta.pdf', url: ENDERECO, tamanhoBytes: arquivo.size },
    ])
  })

  it('depois do upload, redireciona pra proposta criada', async () => {
    ;(enviarParaR2 as jest.Mock).mockResolvedValue(ENDERECO)
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'p1' }),
    })

    render(<NovaPropostaComercialPage />)
    soltarArquivo('proposta.pdf')
    fireEvent.click(screen.getByRole('button', { name: /Enviar proposta/ }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/propostas-comerciais/p1'))
  })

  it('falha no envio pro R2 mostra o erro, sem chamar /api/propostas-comerciais', async () => {
    ;(enviarParaR2 as jest.Mock).mockRejectedValue(new Error('arquivo grande demais'))

    render(<NovaPropostaComercialPage />)
    soltarArquivo('proposta.pdf')
    fireEvent.click(screen.getByRole('button', { name: /Enviar proposta/ }))

    expect(await screen.findByText('arquivo grande demais')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
