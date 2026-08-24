import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DevLoginForm } from './dev-login-form'

const pushMock = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

describe('DevLoginForm', () => {
  beforeEach(() => {
    pushMock.mockClear()
    global.fetch = jest.fn()
  })

  it('renderiza o campo de token', () => {
    render(<DevLoginForm />)
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('verai_2026')).toBeInTheDocument()
  })

  it('redireciona para /clientes quando o token é aceito', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
    render(<DevLoginForm />)

    fireEvent.change(screen.getByPlaceholderText('verai_2026'), { target: { value: 'verai_2026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/clientes'))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/dev-login',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ token: 'verai_2026' }) })
    )
  })

  it('mostra mensagem de erro quando o token é inválido', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false })
    render(<DevLoginForm />)

    fireEvent.change(screen.getByPlaceholderText('verai_2026'), { target: { value: 'errado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(screen.getByText('Token inválido')).toBeInTheDocument())
  })
})
