import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DevLoginForm } from './dev-login-form'

const pushMock = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

function preencherEEnviar(token: string) {
  fireEvent.change(screen.getByLabelText('Token de acesso'), { target: { value: token } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('DevLoginForm', () => {
  beforeEach(() => {
    pushMock.mockClear()
    global.fetch = jest.fn()
  })

  it('pede o token de acesso num campo de senha, vazio', () => {
    render(<DevLoginForm />)
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    const campo = screen.getByLabelText('Token de acesso')
    expect(campo).toHaveAttribute('type', 'password')
    expect(campo).toHaveValue('')
    expect(screen.getByText(/em desenvolvimento/)).toBeInTheDocument()
  })

  it('envia o token digitado pro servidor e redireciona para /clientes', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 })
    render(<DevLoginForm />)

    preencherEEnviar('qualquer-token')

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/clientes'))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/dev-login',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ token: 'qualquer-token' }) })
    )
  })

  it('mostra "Token inválido" e limpa o campo quando o servidor recusa', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 })
    render(<DevLoginForm />)

    preencherEEnviar('errado')

    await waitFor(() => expect(screen.getByText('Token inválido')).toBeInTheDocument())
    expect(screen.getByLabelText('Token de acesso')).toHaveValue('')
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('mostra erro genérico quando o acesso falha por outro motivo', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 })
    render(<DevLoginForm />)

    preencherEEnviar('qualquer-token')

    await waitFor(() => expect(screen.getByText('Não foi possível entrar')).toBeInTheDocument())
  })
})
