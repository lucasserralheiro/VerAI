import { configuracaoDoAssistente } from './configuracao'

const ENV = process.env
beforeEach(() => {
  process.env = { ...ENV }
  for (const k of ['ASSISTENTE_AI_PROVIDER', 'ASSISTENTE_AI_MODEL', 'ASSISTENTE_AI_API_KEY', 'AI_PROVIDER', 'AI_MODEL', 'AI_API_KEY']) delete process.env[k]
})
afterAll(() => (process.env = ENV))

it('usa as variáveis próprias do assistente', () => {
  Object.assign(process.env, { ASSISTENTE_AI_PROVIDER: 'deepseek', ASSISTENTE_AI_MODEL: 'deepseek-chat', ASSISTENTE_AI_API_KEY: 'k', AI_PROVIDER: 'google', AI_MODEL: 'g', AI_API_KEY: 'gk' })
  expect(configuracaoDoAssistente()).toEqual({ provedor: 'deepseek', modelo: 'deepseek-chat', apiKey: 'k' })
})

it('cai para AI_* quando as próprias estão vazias', () => {
  Object.assign(process.env, { AI_PROVIDER: 'deepseek', AI_MODEL: 'deepseek-chat', AI_API_KEY: 'k' })
  expect(configuracaoDoAssistente()).toEqual({ provedor: 'deepseek', modelo: 'deepseek-chat', apiKey: 'k' })
})

it('null quando falta provedor, modelo ou chave (exceto vertex)', () => {
  expect(configuracaoDoAssistente()).toBeNull()
  Object.assign(process.env, { ASSISTENTE_AI_PROVIDER: 'deepseek', ASSISTENTE_AI_MODEL: 'deepseek-chat' })
  expect(configuracaoDoAssistente()).toBeNull()
  Object.assign(process.env, { ASSISTENTE_AI_PROVIDER: 'vertex' })
  expect(configuracaoDoAssistente()).toEqual({ provedor: 'vertex', modelo: 'deepseek-chat', apiKey: undefined })
})
