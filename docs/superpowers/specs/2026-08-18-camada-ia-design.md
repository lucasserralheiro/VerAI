# VerAI — Camada de IA (design)

**Módulo**: Camada de IA (seção 4.3 / 9 do mapeamento geral do VerAI)
**Status**: Aprovado para implementação
**Data**: 18/08/2026

---

## 1. Objetivo

Gerar a análise estruturada de um documento (resumo, pontos críticos, pontos
positivos, métricas-chave) sem acoplar o restante do sistema a um provedor de
IA específico. Trocar de provedor (ou de modelo) deve ser uma mudança de
configuração (`.env`), não de código.

Requisitos que guiaram o desenho:
- **Não amarrado a um provedor** — nenhuma parte do sistema fora da camada de
  IA conhece Anthropic/OpenAI/Google etc.
- **Chave e modelo vêm do `.env`** — a função recebe o token via variável de
  ambiente, nunca hardcoded.
- **Barato e simples** — volume interno pequeno, sem fila, sem cache de
  prompt, sem infraestrutura de custo/monitoramento. Simplicidade de código
  prevalece sobre flexibilidade que ainda não é necessária (YAGNI).

---

## 2. Arquitetura

Um único arquivo concentra a camada de IA — não há justificativa, no volume
atual, para separar schema/prompt/provider/chamada em arquivos diferentes.

```
lib/ia/
└── analisar.ts   → schema Zod + montagem de prompt + chamada ao modelo
```

### `lib/ia/analisar.ts`

```ts
import { generateObject } from 'ai';
import { z } from 'zod';

const schema = z.object({
  resumo: z.string(),
  pontosCriticos: z.array(z.object({
    texto: z.string(),
    severidade: z.enum(['alto', 'medio', 'baixo']),
  })),
  pontosPositivos: z.array(z.object({ texto: z.string() })),
  metricasChave: z.array(z.object({
    label: z.string(),
    valor: z.string(),
  })).optional(),
});

function getModel() {
  // Único ponto do sistema que conhece provedores de IA.
  // Trocar/adicionar provedor = adicionar um `case` + instalar o pacote
  // `@ai-sdk/<provedor>` correspondente.
  switch (process.env.AI_PROVIDER) {
    case 'anthropic':
      return anthropic(process.env.AI_MODEL!, { apiKey: process.env.AI_API_KEY });
    default:
      throw new Error(`AI_PROVIDER "${process.env.AI_PROVIDER}" não suportado`);
  }
}

export async function analisarDocumento(conteudoExtraido: string, promptVersion: string) {
  const { object } = await generateObject({
    model: getModel(),
    schema,
    prompt: montarPrompt(conteudoExtraido),
  });
  return { ...object, promptVersion };
}
```

`analisarDocumento()` é a única função que o resto do sistema (rota de
upload, processamento síncrono) chama. Ela recebe o conteúdo já extraído
(seção 4.2 do mapeamento geral — colunas, tipos, amostra de linhas,
estatísticas — nunca o arquivo cru) e devolve o objeto já validado contra o
schema, pronto para persistir em `Analise`.

---

## 3. Stack

| Pacote | Papel |
|---|---|
| `ai` (Vercel AI SDK) | Interface única (`generateObject`) — abstrai o provedor |
| `zod` | Schema da saída estruturada, validado antes de persistir |
| `@ai-sdk/<provider>` | Só o pacote do provedor efetivamente escolhido |

Sem client HTTP manual, sem lib própria de retry, sem fila. Encaixa sem
conflito na stack já definida do VerAI (Next.js + Prisma/PostgreSQL +
NextAuth + exceljs + Puppeteer + SMTP/Resend).

---

## 4. Configuração (`.env`)

Nomes genéricos, não amarrados a um provedor:

```
AI_PROVIDER=
AI_API_KEY=
AI_MODEL=
```

Documentadas (vazias) em `.env.example`. Preenchidas quando o provedor for
decidido — nenhum outro ponto do sistema muda.

**Custo controlado por construção, não por infraestrutura extra:**
- O prompt recebe conteúdo já resumido pela etapa de extração (4.2), não o
  documento inteiro — isso já corta a maior parte do custo em tokens.
- `AI_MODEL` fica em `.env`, permitindo apontar para o tier mais barato do
  provedor (ex: modelo "mini"/"flash"/"haiku") sem tocar em código —
  adequado para uma tarefa de extração estruturada.

---

## 5. Erros e retry

- Saída fora do schema Zod → `generateObject` já faz retry automático
  internamente antes de falhar. Não há retry manual na camada de IA.
- Falha definitiva (erro de API, retry esgotado, `AI_PROVIDER` não
  suportado) → a exceção sobe para quem chamou `analisarDocumento()`, que é
  responsável por marcar `Documento.status = 'erro'` e preencher
  `mensagemErro` (comportamento já definido na seção 7 do mapeamento geral).
- Reprocessamento (botão "reprocessar" da seção 7) simplesmente chama
  `analisarDocumento()` de novo — nenhuma lógica extra necessária aqui.

---

## 6. Extensibilidade

Adicionar um segundo provedor no futuro:
1. `npm i @ai-sdk/<novo-provedor>`
2. Adicionar um `case` em `getModel()`
3. Preencher `AI_PROVIDER`/`AI_API_KEY`/`AI_MODEL` no `.env`

Nenhuma mudança em `analisarDocumento()`, no schema, no prompt, nem em
nenhum outro módulo do VerAI.

---

## 7. Testes

Como todo o acoplamento a provedor está isolado em `getModel()`, os testes
de `analisarDocumento()` mockam `generateObject` (ou o próprio `getModel`)
para não depender de chamada real de API. Teste de contrato garante que o
shape retornado bate com o schema Zod usado na persistência de `Analise`.

---

## 8. Fora de escopo (por ora)

- Múltiplos provedores ativos simultaneamente / fallback automático entre
  provedores.
- Cache de prompt, fila de processamento, monitoramento de custo/uso.
- Dynamic import por provedor (otimização de bundle desnecessária no volume
  atual).

Revisitar se o volume de uso crescer ou se surgir necessidade real de trocar
de provedor em runtime.
