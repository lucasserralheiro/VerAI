import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // services/confere/ é o serviço Python copiado (Task 1 da integração —
  // docs/superpowers/specs/2026-09-21-integracao-confere-design.md). Tem
  // testes próprios: Python (pytest, roda separado) e Playwright e2e
  // (frontend/e2e/*.spec.ts) — este último bate no testMatch padrão do Jest
  // sem ser um teste do VerAI, e precisa de @playwright/test, que não é
  // dependência daqui. Ignorar a pasta inteira.
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/services/confere/'],
}

export default createJestConfig(config)
