import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { EnvioArquivos } from './envio-arquivos'

jest.mock('@vercel/blob/client', () => ({ upload: jest.fn() }))
jest.mock('@/lib/arquivos/hash-navegador', () => ({ sha256DoArquivo: jest.fn() }))

import { upload } from '@vercel/blob/client'
import { sha256DoArquivo } from '@/lib/arquivos/hash-navegador'

const TMP = 'https://x.public.blob.vercel-storage.com/tmp-arquivos/u-PC_SMS_012-abc.pdf'

function resposta(ok: boolean, corpo: unknown) {
  return Promise.resolve({ ok, json: () => Promise.resolve(corpo) }) as unknown as Promise<Response>
}

function selecionar(container: HTMLElement, ...arquivos: File[]) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: arquivos } })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(sha256DoArquivo as jest.Mock).mockImplementation(async (file: File) => (file.name.startsWith('PC') ? 'a'.repeat(64) : 'b'.repeat(64)))
  ;(upload as jest.Mock).mockResolvedValue({ url: TMP })
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    if (u === `/api/clientes/c1/arquivos/existe?sha256=${'a'.repeat(64)}`) return resposta(true, { arquivo: null })
    if (u === `/api/clientes/c1/arquivos/existe?sha256=${'b'.repeat(64)}`)
      return resposta(true, { arquivo: { id: 'a-velho', nome: 'medicao antiga.xlsx' } })
    if (u === '/api/clientes/c1/arquivos' && init?.method === 'POST') return resposta(true, { arquivo: { id: 'a1' }, duplicado: false })
    return resposta(false, { error: 'inesperado' })
  }) as jest.Mock
})

describe('EnvioArquivos', () => {
  it('sugere a categoria pelo nome e deixa trocar', () => {
    const { container } = render(<EnvioArquivos clienteId="c1" contratos={[]} aoConcluir={jest.fn()} aoCancelar={jest.fn()} />)
    selecionar(container, new File(['x'], 'PC_SMS_012.pdf'))

    const linha = screen.getByRole('group', { name: 'PC_SMS_012.pdf' })
    expect(within(linha).getByLabelText('Categoria')).toHaveValue('PROPOSTA_COMERCIAL')
  })

  it('arquivo novo: upload direto no caminho temporário e registro com a classificação', async () => {
    const aoConcluir = jest.fn()
    const { container } = render(
      <EnvioArquivos clienteId="c1" contratos={[{ id: 'k1', numeroTermo: 'TC 012/2020' }]} aoConcluir={aoConcluir} aoCancelar={jest.fn()} />
    )
    selecionar(container, new File(['x'], 'PC_SMS_012.pdf'))
    const linha = screen.getByRole('group', { name: 'PC_SMS_012.pdf' })
    fireEvent.change(within(linha).getByLabelText('Contrato'), { target: { value: 'k1' } })
    fireEvent.change(within(linha).getByLabelText('Competência'), { target: { value: '2026-08' } })

    fireEvent.click(screen.getByRole('button', { name: 'Enviar 1 arquivo' }))

    await waitFor(() => expect(aoConcluir).toHaveBeenCalled())
    const [caminho, , opcoes] = (upload as jest.Mock).mock.calls[0]
    expect(caminho).toMatch(/^tmp-arquivos\/.+-PC_SMS_012\.pdf$/)
    expect(opcoes).toMatchObject({ access: 'public', handleUploadUrl: '/api/arquivos/upload-token' })
    const post = (global.fetch as jest.Mock).mock.calls.find(([, i]) => i?.method === 'POST')!
    expect(JSON.parse(post[1].body)).toEqual({
      urlTemporaria: TMP,
      nome: 'PC_SMS_012.pdf',
      categoria: 'PROPOSTA_COMERCIAL',
      contratoId: 'k1',
      competenciaAno: 2026,
      competenciaMes: 8,
    })
  })

  it('arquivo que o cliente já tem: não sobe e avisa', async () => {
    const aoConcluir = jest.fn()
    const { container } = render(<EnvioArquivos clienteId="c1" contratos={[]} aoConcluir={aoConcluir} aoCancelar={jest.fn()} />)
    selecionar(container, new File(['y'], 'medicao-junho.xlsx'))

    fireEvent.click(screen.getByRole('button', { name: 'Enviar 1 arquivo' }))

    expect(await screen.findByText('já está no repositório como “medicao antiga.xlsx”')).toBeInTheDocument()
    expect(upload).not.toHaveBeenCalled()
    expect(aoConcluir).toHaveBeenCalled()
  })

  it('falha no envio de um arquivo mostra o erro na linha e não conclui', async () => {
    ;(upload as jest.Mock).mockRejectedValue(new Error('rede caiu'))
    const aoConcluir = jest.fn()
    const { container } = render(<EnvioArquivos clienteId="c1" contratos={[]} aoConcluir={aoConcluir} aoCancelar={jest.fn()} />)
    selecionar(container, new File(['x'], 'PC_SMS_012.pdf'))

    fireEvent.click(screen.getByRole('button', { name: 'Enviar 1 arquivo' }))

    expect(await screen.findByText('rede caiu')).toBeInTheDocument()
    expect(aoConcluir).not.toHaveBeenCalled()
  })
})
