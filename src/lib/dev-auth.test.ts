/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { devAuthEnabled, getImpersonatorId, IMPERSONATOR_COOKIE_NAME } from './dev-auth'

describe('devAuthEnabled', () => {
  const originalValue = process.env.DEV_AUTH_ENABLED

  afterEach(() => {
    process.env.DEV_AUTH_ENABLED = originalValue
  })

  it('retorna false quando a variável não está definida', () => {
    delete process.env.DEV_AUTH_ENABLED
    expect(devAuthEnabled()).toBe(false)
  })

  it('retorna false para qualquer valor diferente de "1"', () => {
    process.env.DEV_AUTH_ENABLED = 'true'
    expect(devAuthEnabled()).toBe(false)
  })

  it('retorna true quando a variável é "1"', () => {
    process.env.DEV_AUTH_ENABLED = '1'
    expect(devAuthEnabled()).toBe(true)
  })
})

describe('getImpersonatorId', () => {
  it('retorna null quando não há cookie de impersonação', () => {
    const request = new NextRequest('http://localhost/api/qualquer')
    expect(getImpersonatorId(request)).toBeNull()
  })

  it('retorna o id gravado no cookie de impersonação', () => {
    const request = new NextRequest('http://localhost/api/qualquer', {
      headers: { cookie: `${IMPERSONATOR_COOKIE_NAME}=admin-1` },
    })
    expect(getImpersonatorId(request)).toBe('admin-1')
  })
})
