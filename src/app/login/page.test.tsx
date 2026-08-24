jest.mock('@/lib/dev-auth', () => ({ devAuthEnabled: jest.fn() }))
jest.mock('./login-form', () => ({ LoginForm: () => <div>login-form</div> }))
jest.mock('./dev-login-form', () => ({ DevLoginForm: () => <div>dev-login-form</div> }))

import { render, screen } from '@testing-library/react'
import { devAuthEnabled } from '@/lib/dev-auth'
import LoginPage from './page'

describe('LoginPage', () => {
  it('renderiza o formulário normal quando o modo dev está desligado', () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(false)
    render(<LoginPage />)
    expect(screen.getByText('login-form')).toBeInTheDocument()
    expect(screen.queryByText('dev-login-form')).not.toBeInTheDocument()
  })

  it('renderiza o formulário de token quando o modo dev está ligado', () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    render(<LoginPage />)
    expect(screen.getByText('dev-login-form')).toBeInTheDocument()
    expect(screen.queryByText('login-form')).not.toBeInTheDocument()
  })
})
