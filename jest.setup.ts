import '@testing-library/jest-dom'

// jsdom's own Blob (usado como `global.Blob` no testEnvironment) não
// implementa `.text()`/`.arrayBuffer()` — troca pelo Blob nativo do Node
// (que implementa a spec completa), senão qualquer teste que leia de volta
// o conteúdo de um Blob (ex.: `new Blob([html]).text()`) quebra com
// "Blob.text is not a function".
global.Blob = require('node:buffer').Blob

// jsdom não expõe TransformStream/ReadableStream/WritableStream (globais do Node desde a v18).
// O SDK `ai` (Task 10, `src/lib/assistente/`) depende deles no carregamento do módulo — mesmo
// em testes com `testEnvironment: 'jsdom'` (padrão do projeto) — via `eventsource-parser`
// (`class EventSourceParserStream extends TransformStream`, avaliado ao importar o módulo).
// Sem isso, qualquer teste que importe `@/lib/ia/modelo` ou `@/lib/assistente/*` sem
// `@jest-environment node` quebra com "TransformStream is not defined".
const { ReadableStream, WritableStream, TransformStream } = require('node:stream/web')
if (!global.ReadableStream) global.ReadableStream = ReadableStream
if (!global.WritableStream) global.WritableStream = WritableStream
if (!global.TransformStream) global.TransformStream = TransformStream

// Mesma lacuna do jsdom pra TextEncoder/TextDecoder — `@ai-sdk/provider-utils` instancia um
// `new TextDecoder()` no escopo do módulo (suporte a WebSocket).
const { TextEncoder, TextDecoder } = require('node:util')
if (!global.TextEncoder) global.TextEncoder = TextEncoder
if (!global.TextDecoder) global.TextDecoder = TextDecoder
