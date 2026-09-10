# Adicionar DeepSeek como provedor de IA

**Data:** 2026-09-09
**Status:** aprovado

## Objetivo

Passar a usar a DeepSeek (`deepseek-chat` / V3) como provedor de IA ativo,
no lugar do Google AI Studio (`gemini-2.5-flash`) atualmente configurado.

## Contexto

A camada de IA (`src/lib/ia/`) já isola o provedor atrás de `getModel()` em
`src/lib/ia/modelo.ts`, escolhido em runtime pela env `AI_PROVIDER`. Hoje
suporta `anthropic`, `google`, `vertex` e `groq`. Todos os consumidores reais
(`analisar`, `consolidar`, `evoluir`, `revisarPortugues`) chamam
`generateObject` com schema Zod, então o provedor precisa suportar saída JSON
estruturada. `deepseek-chat` suporta (`response_format: json_object`);
`deepseek-reasoner` não de forma confiável — por isso o modelo padrão é
`deepseek-chat`.

## Escopo

- **Só ativar DeepSeek**: os demais provedores continuam no `switch` como
  opções; muda apenas `AI_PROVIDER` no `.env`.
- Não remover os outros provedores nem suas dependências.
- Não alterar prompts.
- Não tocar no fluxo da Proposta Comercial (Conversão SEI), que é 100%
  determinístico e sem IA.

## Mudanças

### 1. Dependência

`npm i @ai-sdk/deepseek` — linha `4.x`, par do `@ai-sdk/provider@4.0.7` já
instalado.

### 2. `src/lib/ia/modelo.ts`

Novo `case` no `switch`, no mesmo formato do `groq`:

```ts
case 'deepseek':
  // DeepSeek (platform.deepseek.com/api_keys) — OpenAI-compatible,
  // deepseek-chat suporta saída JSON estruturada.
  return createDeepSeek({ apiKey: process.env.AI_API_KEY })(nomeModelo)
```

mais o `import { createDeepSeek } from '@ai-sdk/deepseek'`.

### 3. `.env.development`

```
AI_PROVIDER=deepseek
AI_API_KEY=<chave DeepSeek>
AI_MODEL=deepseek-chat
AI_REVISAO_MODEL=deepseek-chat
```

### 4. `.env.example`

Adicionar `deepseek` à linha de comentário que lista os provedores.

### 5. Testes

- `analisar.test.ts`, `consolidar.test.ts`, `evoluir.test.ts`: adicionar
  `jest.mock('@ai-sdk/deepseek', ...)` junto aos mocks existentes.
- `analisar.test.ts`: novo caso `it('usa o DeepSeek quando AI_PROVIDER=deepseek')`
  espelhando o caso do Groq.
- `revisarPortugues.test.ts`: nenhuma mudança (mocka `./modelo` inteiro).

## Risco conhecido

O JSON mode da DeepSeek é menos rigoroso que o tool-mode de Gemini/Anthropic.
Se `generateObject` falhar em validar o schema em produção, o ajuste é de
prompt/retry, não de arquitetura. Os `.nullable()` já aplicados nos schemas
(por causa do modo estrito OpenAI-compatible) ajudam.

## Segurança

A chave da DeepSeek foi exposta em chat durante o pedido e deve ser revogada e
regerada. `.env.development` e `.env.local` não são commitados.
