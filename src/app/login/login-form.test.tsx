import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginForm } from './login-form'

const pushMock = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

describe('LoginForm', () => {
  beforeEach(() => {
    pushMock.mockClear()
    global.fetch = jest.fn()
  })

  it('renderiza o formulário de login', () => {
    render(<LoginForm />)
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('admin ou voce@empresa.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  })

  it('redireciona para /clientes após login bem-sucedido', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
    render(<LoginForm />)

    fireEvent.change(screen.getByPlaceholderText('admin ou voce@empresa.com'), {
      target: { value: 'admin@verai.local' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'admin123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/clientes'))
  })

  it('mostra mensagem de erro quando o login falha', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false })
    render(<LoginForm />)

    fireEvent.change(screen.getByPlaceholderText('admin ou voce@empresa.com'), {
      target: { value: 'admin@verai.local' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'errada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(screen.getByText('Credenciais inválidas')).toBeInTheDocument())
  })
})
