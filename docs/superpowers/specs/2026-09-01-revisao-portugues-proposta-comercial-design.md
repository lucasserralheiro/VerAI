# Revisão de português na Proposta Comercial

## Contexto

A Proposta Comercial (Conversão SEI) converte arquivos enviados em um único
Markdown de forma **100% determinística, sem nenhuma etapa de IA** — o conteúdo
final tem que ser idêntico ao original, só reformatado (ver
`src/app/api/propostas-comerciais/route.ts` e o módulo desativado
`src/lib/ia/consolidarProposta.ts`).

Este design abre **uma** exceção controlada a essa regra: uma revisão de
português **sob demanda**, acionada pelo usuário na tela de proposta final, que
propõe apenas correções de ortografia e acentuação. A IA nunca altera o
conteúdo silenciosamente — ela só sugere trocas de palavra que o usuário revisa
num diff e aceita (ou recusa) explicitamente.

## Princípio

- A IA corrige **somente** ortografia, acentuação e erros óbvios de digitação e
  concordância em português.
- **Não** reescreve frases, não reordena, não resume, não traduz, não adiciona
  nem remove conteúdo.
- Preserva exatamente: todo número, data, valor monetário, nome próprio, e toda
  a estrutura Markdown (títulos, listas, tabelas, quebras de linha).
- O resultado nunca é aplicado automaticamente. O usuário vê o que mudou e
  decide.

## Arquitetura

### Backend — endpoint stateless

**`POST /api/propostas-comerciais/[id]/revisao-portugues`**

Arquivo: `src/app/api/propostas-comerciais/[id]/revisao-portugues/route.ts`

Fluxo:

1. `getAuthUser` — 401 se não autenticado.
2. Busca a `PropostaComercial` por `id` — 404 se não existir; 400 se
   `conteudoMarkdown` for null/vazio.
3. Chama `revisarPortugues(conteudoMarkdown)` (módulo novo, abaixo).
4. Roda o **guardrail** comparando `original` × `corrigido`:
   - mesma quantidade de linhas totais (`split('\n').length`);
   - mesma quantidade de linhas que começam com `#` (títulos);
   - mesma quantidade de linhas de tabela (linhas que contêm `|`);
   - mesma quantidade de itens de lista (linhas que casam `/^\s*([-*]|\d+\.)\s/`);
   - toda sequência de dígitos (`/\d+/g`) presente no original continua
     presente no corrigido, na mesma contagem por token.
   - Se qualquer checagem falhar → responde **422** com
     `{ error: 'a revisão alterou mais que ortografia — não é seguro aplicar automaticamente' }`.
5. Sucesso → **200** com `{ original, corrigido }`.

Nada é persistido. Nenhuma migration. Clicar de novo roda de novo.

### Backend — módulo de IA

Arquivo: `src/lib/ia/revisarPortugues.ts`

```ts
export async function revisarPortugues(markdown: string): Promise<string>
```

- Usa `generateText` (não `generateObject` — queremos o Markdown cru de volta)
  com `getModel()` (mesma infra de `src/lib/ia/modelo.ts`).
- System/prompt restrito, em português, deixando explícito:
  - papel: revisor ortográfico, não editor de texto;
  - corrigir apenas ortografia, acentuação, concordância e digitação;
  - proibido reescrever, reordenar, resumir, traduzir, adicionar ou remover
    qualquer conteúdo;
  - preservar literalmente todo número, data, valor, sigla, nome próprio e toda
    a marcação Markdown (`#`, `**`, `|`, `-`, quebras de linha);
  - responder **somente** com o Markdown corrigido, sem comentários, sem cercas
    de código ao redor.
- Faz um trim de cercas ```` ```markdown ```` / ```` ``` ```` que o modelo
  eventualmente adicione ao redor da resposta.

### Frontend — abas na tela final

Arquivo: `src/app/propostas-comerciais/[id]/proposta-final.tsx`

`PropostaFinal` passa a ter um seletor de abas no topo:
**Visualizar** | **Correção da IA**.

Os botões **"Editar novamente"** e **"Copiar formatado"** continuam onde estão
(fora das abas).

**Aba Visualizar:** o preview renderizado atual
(`renderizarMarkdownProposta`), sem mudança.

**Aba Correção da IA** — estados:

| Estado | Conteúdo |
|---|---|
| inicial | Linha explicando o que a revisão faz + botão **"Revisar português"**. |
| carregando | Spinner + "Revisando..." enquanto o `POST` roda. |
| erro de rede / 5xx | Mensagem de falha + botão "Tentar de novo". |
| 422 (guardrail) | Aviso: "A revisão alterou mais que ortografia — não é seguro aplicar. Revise o texto manualmente em 'Editar novamente'." + botão "Voltar". |
| sem mudanças | "Nenhum erro de português encontrado." + botão "Voltar". |
| com mudanças | Documento renderizado com as trocas destacadas inline (ver abaixo) + legenda + botões **"Usar correções"** e **"Manter original"**. |

Ações:

- **"Usar correções"** → chama o handler que faz
  `PATCH /api/propostas-comerciais/[id]` com `conteudoMarkdown` = versão
  corrigida, recarrega a proposta e volta pra aba Visualizar.
- **"Manter original"** / **"Voltar"** → volta a aba pro estado inicial, sem
  nenhuma chamada.

Arquivo: `src/app/propostas-comerciais/[id]/page.tsx` — passa um
`onUsarCorrecoes(markdown)` que reusa a lógica de `handleSalvar` (PATCH +
`carregar()`), mantendo `status: 'concluido'`.

### Frontend — diff renderizado inline

Arquivo: `src/lib/diffPropostaRenderizada.ts`

```ts
export function diffPropostaRenderizada(original: string, corrigido: string): string
```

- Renderiza `original` e `corrigido` para HTML com `renderizarMarkdownProposta`.
- Como o guardrail garante estrutura idêntica, percorre os **nós de texto** das
  duas árvores em paralelo (via `DOMParser`).
- Para cada par de nós de texto correspondentes, aplica `diffWords` (do pacote
  `diff`) e reconstrói o nó com:
  - trecho igual → texto puro;
  - removido → `<del>…</del>`;
  - inserido → `<ins>…</ins>`.
- Nós de texto sem diferença passam intactos.
- Retorna o `innerHTML` resultante, exibido no mesmo container
  `.markdown-preview` da aba Visualizar.
- Se as duas árvores divergirem em contagem de nós de texto (não deveria, pós
  guardrail), cai num fallback seguro: mostra só a versão corrigida renderizada,
  sem marcação de diff.

Estilos em `src/app/globals.css` (escopados em `.markdown-preview`):

- `del` — texto riscado, cor/apagado suave;
- `ins` — sem sublinhado padrão, fundo destacado (verde/amarelo suave),
  `text-decoration: none`.

Legenda abaixo do documento: um exemplo de `del` e um de `ins` com rótulo
("removido" / "adicionado").

### Dependência nova

`diff` (jsdiff) — pacote pequeno e consolidado. Usado só para `diffWords`.

## Componentes e responsabilidades

| Unidade | O que faz | Depende de |
|---|---|---|
| `revisarPortugues.ts` | Manda o Markdown pro modelo e devolve o Markdown corrigido, sem cercas. | `ai`, `modelo.ts` |
| `route.ts` (revisao-portugues) | Auth, carga da proposta, chama `revisarPortugues`, roda o guardrail, responde. | `prisma`, `auth`, `revisarPortugues.ts` |
| `diffPropostaRenderizada.ts` | Original + corrigido → HTML renderizado com `<ins>`/`<del>` inline. | `diff`, `renderizarMarkdownProposta.ts` |
| `proposta-final.tsx` | Abas + estados da aba de correção + chamadas ao endpoint. | `diffPropostaRenderizada.ts`, endpoint |
| `page.tsx` | Fornece `onUsarCorrecoes` (PATCH + recarrega). | endpoint PATCH existente |

O guardrail vive **no route**, não no módulo de IA — o módulo de IA só fala com
o modelo; a política de "isso é seguro aplicar?" é do endpoint.

## Testes (TDD, jest — padrão existente do repo)

**`src/lib/ia/revisarPortugues.test.ts`** (mock do modelo):
- remove cercas ```` ``` ```` ao redor da resposta do modelo;
- devolve o texto do modelo intacto quando não há cercas.

**`src/app/api/propostas-comerciais/[id]/revisao-portugues/route.test.ts`**
(mock de `revisarPortugues` e `prisma`):
- 401 sem auth;
- 404 proposta inexistente;
- 400 quando `conteudoMarkdown` é null;
- 200 `{ original, corrigido }` no caminho feliz (correção só de acento);
- 422 quando o corrigido muda um número;
- 422 quando o corrigido some com uma linha de tabela / título;
- 200 quando corrigido == original (sem mudanças).

**`src/lib/diffPropostaRenderizada.test.ts`**:
- palavra trocada vira `<del>`+`<ins>` dentro do parágrafo renderizado;
- texto idêntico não gera nenhuma marcação;
- estrutura (título, tabela) é preservada no HTML de saída;
- fallback quando as árvores divergem em nós de texto.

**`src/app/propostas-comerciais/[id]/proposta-final.test.tsx`** (novo):
- troca de aba Visualizar ↔ Correção da IA;
- "Revisar português" → estado carregando → diff exibido;
- "Usar correções" chama `onUsarCorrecoes` com a versão corrigida;
- "Manter original" volta ao estado inicial sem chamar nada;
- resposta 422 mostra o aviso do guardrail;
- resposta sem mudanças mostra "Nenhum erro de português encontrado".

## Fora de escopo

- Rodar a revisão automaticamente na geração da proposta.
- Persistir a versão corrigida ou o diff no banco.
- Aceitar/recusar correções item a item.
- Editor rich-text para substituir a `textarea` de Markdown (o editor de
  rascunho atual permanece como está).
- Revisão de português em qualquer outra parte do sistema.
