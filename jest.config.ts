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

export default async () => {
  const resolvedConfig = await createJestConfig(config)()
  // `ai` (usado pelo agente do assistente — Task 10, `src/lib/assistente/agente.ts`) e os
  // pacotes `@ai-sdk/*` que ele importa são publicados só como ESM. O next/jest padrão ignora
  // node_modules por inteiro (`/node_modules/` sem exceção quando não há `transpilePackages`
  // no next.config), então `import ... from 'ai'`/`'ai/test'` quebra com "Cannot use import
  // statement outside a module" — a transform SWC do next/jest nunca chega a rodar em cima
  // desses arquivos. Não dá para só ACRESCENTAR um padrão: transformIgnorePatterns é uma lista
  // de "ignore se casar com qualquer um destes", então a entrada '/node_modules/' que o
  // next/jest já bota precisa ser SUBSTITUÍDA por uma com negative lookahead pros pacotes que
  // precisam ser transformados (deixa os demais como estavam, ignorados).
  resolvedConfig.transformIgnorePatterns = [
    '/node_modules/(?!(ai|@ai-sdk|@workflow|eventsource-parser|secure-json-parse)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ]
  return resolvedConfig
}
