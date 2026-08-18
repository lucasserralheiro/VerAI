/**
 * @jest-environment node
 */
import { AUTH_COOKIE_NAME } from '@/lib/auth'
import { POST } from './route'

describe('POST /api/auth/logout', () => {
  it('limpa o cookie de sessão', async () => {
    const response = await POST()
    expect(response.status).toBe(200)
    expect(response.cookies.get(AUTH_COOKIE_NAME)?.value).toBe('')
  })
})
