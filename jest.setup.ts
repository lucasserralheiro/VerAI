import '@testing-library/jest-dom'

// jsdom's own Blob (usado como `global.Blob` no testEnvironment) não
// implementa `.text()`/`.arrayBuffer()` — troca pelo Blob nativo do Node
// (que implementa a spec completa), senão qualquer teste que leia de volta
// o conteúdo de um Blob (ex.: `new Blob([html]).text()`) quebra com
// "Blob.text is not a function".
global.Blob = require('node:buffer').Blob
