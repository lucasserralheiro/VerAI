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

// jsdom não implementa a Fetch API (fetch/Request/Response/Headers) — testes de componente que
// mockam `global.fetch` devolvendo `new Response(...)` (painel do assistente, Task 12) quebram
// com "Response is not defined". `undici` é a implementação que o próprio Node usa por baixo do
// pano pro fetch nativo; já está em node_modules como dependência transitiva de vários pacotes
// (ex.: `ai`), então não precisa virar dependência direta só pra isso.
// `undici` também espera MessagePort/MessageChannel (globais do Node, ausentes no jsdom) só
// pra carregar o módulo — sem uso real nos testes daqui.
const { MessageChannel, MessagePort } = require('node:worker_threads')
if (!global.MessageChannel) global.MessageChannel = MessageChannel
if (!global.MessagePort) global.MessagePort = MessagePort

const { fetch, Headers, Request, Response } = require('undici')
if (!global.fetch) global.fetch = fetch
if (!global.Headers) global.Headers = Headers
if (!global.Request) global.Request = Request
if (!global.Response) global.Response = Response
