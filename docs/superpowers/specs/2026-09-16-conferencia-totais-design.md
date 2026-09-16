# Conferência rápida de totais (Proposta Comercial)

**Data:** 2026-09-16
**Status:** aprovado

## Contexto

A checagem por IA (`2026-09-11-checagem-ia-conversao-design.md`) já audita, letra por letra e número
por número, se o texto de cada página do PDF está correto e completo em algum lugar do documento —
inclusive número de tabela. Mesmo assim, sempre falta alguma coisa: o score nunca é 100%, e a revisão
humana final continua sendo ler o documento inteiro contra o PDF original.

Numa proposta comercial, os números que mais importam — "Total Geral", "Valor Total", "Subtotal" de
tabela de preço/cronograma — são também os de maior risco financeiro se saírem errados na conversão, e
são poucos por documento. Faz sentido dar à pessoa um jeito de **bater o olho** nesses números
especificamente, rápido, sem esperar a checagem por IA (que roda página por página, via chamada de
modelo, e pode levar dezenas de segundos) nem ler o documento inteiro.

Esta é uma conferência **complementar** à checagem por IA existente — não substitui o score nem a
lista de trechos suspeitos, é um atalho a mais focado no que tem maior risco.

## Escopo

- Só linhas de **total/resultado geral** (rótulo tipo "total", "subtotal", "valor total", "total
  geral", "resultado geral" perto de um valor monetário) — não cada célula de tabela. Célula a célula
  já é coberto (com IA) pela checagem existente; duplicar isso aqui seria escopo redundante.
- **100% determinístico, sem IA** — mesma filosofia do resto do módulo (`calcularCoberturaPagina`,
  `correcaoEhSegura` etc. em `checarConversao.ts`): regex/parsing de texto, nunca uma chamada de
  modelo. Rápido, grátis, sem risco de alucinação — e não compete por escopo com a checagem por IA.
- Confirma que o valor existe **em algum lugar** do documento (mesma escolha de design já feita pra
  texto em `checarConversao.ts` — não valida posição/seção). **Limitação conhecida e aceita**: um
  total pode coincidir com o valor de outra seção errada; a pessoa vê o contexto ao lado antes de
  confiar. Não é resolvido agora (YAGNI) — se motivar problema real, revisita depois com guarda-rail
  específico, como `trocaConteudoSobRotuloAmbiguo` já faz para texto.
- Só PDF (mesmo escopo de origem da checagem por IA — `.xlsx`/`.docx` não entram).
- Nunca bloqueia nada — puramente informativo, mesmo princípio do resto do módulo.

## Extração e verificação (`src/lib/conferirTotais.ts`)

Reaproveita o mesmo `PaginaParaChecar` (página + texto original, já extraído por
`converterPdfParaHtml`) que a checagem por IA usa — nenhuma extração de PDF nova.

1. **Detecção do rótulo**: para cada página, varre linhas do texto original procurando um rótulo de
   total (regex tolerante a acento/caixa: `total`, `subtotal`, `valor total`, `total geral`,
   `resultado geral`) na mesma linha de um valor monetário.
2. **Filtro de valor monetário**: só considera número com vírgula decimal + exatamente 2 dígitos
   (`,\d{2}`) — formato BR (`R$ 279.663,46`, `1.234,56`). Esse filtro sozinho já descarta "total de 45
   páginas", "12 itens" etc., sem precisar de lista de exceções.
3. **Normalização**: remove símbolo de moeda e separador de milhar, mantém a vírgula decimal —
   `"R$ 279.663,46"` → `"279663,46"`.
4. **Índice do documento (uma passada só)**: extrai TODOS os números em formato monetário do HTML do
   documento inteiro, normalizados do mesmo jeito, numa única varredura — não repete a varredura por
   total encontrado (evitaria O(totais × tamanho do documento) num documento grande).
5. **Correspondência exata**: cada total do PDF é conferido contra esse índice por **igualdade exata**
   do número normalizado — não por `includes`/substring (evita `663,46` casar dentro de
   `279.663,46`, um risco real com números que este módulo tem que evitar diferente do texto livre).
6. **Dedupe**: mesmo rótulo + valor repetido em páginas diferentes (resumo/cabeçalho repetido) conta
   uma vez só — mesmo padrão de `dedupeTrechos` em `checarConversao.ts`.

```ts
export interface TotalConferido {
  pagina: number
  rotulo: string // ex.: "Total Geral"
  valorNoPdf: string // como aparece no PDF, ex.: "R$ 279.663,46"
  encontradoNoDocumento: boolean
  ocorrenciasNoDocumento: number
}

export function conferirTotais(paginas: PaginaParaChecar[], documentoAtual: string): TotalConferido[]
```

## Integração — endpoint separado, sem esperar a IA

**Novo endpoint** `POST /api/propostas-comerciais/[id]/conferir-totais`:

- Recalcula `paginasConvertidas` (igual à rota de checagem-ia — mesmo `converterPdfParaHtml`), roda
  `conferirTotais` e devolve na hora. Não chama IA, não depende da checagem por IA terminar.
- **Cache por `documentoHash`**: reaproveita a mesma lógica de `mesmoDocumento`/`documentoHash` já
  usada em `checagem-ia/route.ts` — recalcula só quando os PDFs ou o documento salvo mudaram desde a
  última conferência. Persistido na proposta do mesmo jeito que `checagemIa` hoje (campo novo,
  `conferenciaTotais`).
- Dispara sozinho ao abrir a proposta (mesmo padrão de `checagemIaAtual`/`iniciarChecagemIa` — cache de
  módulo no cliente, não duplica chamada se o painel remontar). Como o cálculo é quase instantâneo, o
  card já chega pronto sem a pessoa precisar clicar em nada.
- **Por que endpoint separado, não dentro de `checagem-ia/route.ts`**: a checagem por IA é o gargalo
  real (chamada de modelo por página). Se a conferência de totais ficasse na mesma resposta, a pessoa
  esperaria o mesmo tempo pra ver os dois, mesmo a conferência de totais sendo praticamente grátis —
  isso anula o ganho de "bater o olho rápido" que é o objetivo desta funcionalidade.

## UI

**Card compacto no painel** (`painel-checagem-conversao.tsx`), acima da checagem por IA:

- "N totais conferidos" — se houver divergência, destaque visual (ex.: "1 de 3 totais não bate"),
  mesmo tratamento de urgência que o resto do painel já usa (laranja/vermelho pra pendência).
- Sem total detectado no PDF: mensagem neutra "Nenhum total detectado automaticamente — confira o
  documento manualmente" — nunca um erro, mesmo padrão de `scoreExibido === null` hoje.

**Clique abre `JanelaRevisao`** (reaproveita o componente existente, mesmo padrão de
`TrechosParaConferir`) com uma tabela:

| Página | Rótulo | Valor no PDF | Achado no documento |
|---|---|---|---|

- Cada linha não encontrada tem botão "Ver no PDF" (reaproveita `onVerPagina`, já usado pra abrir a
  página destacada no visualizador).

## Testes (`conferirTotais.test.ts`)

- Total simples achado e não achado.
- Dedupe de total repetido em várias páginas (mesmo valor/rótulo).
- Formatos: "R$" com/sem símbolo, milhar com ponto, sem milhar.
- Rejeita rótulo sem valor monetário (ex.: "total de 45 páginas", "total de 12 itens" — sem
  vírgula decimal).
- Correspondência exata não deve casar substring (`663,46` dentro de `279.663,46` é um NÃO-match).
- Pelo menos um caso calibrado com texto real de uma proposta existente (não só fixture sintética) —
  rótulos de total variam bastante de layout pra layout, regex genérico demais ou frágil demais só
  aparece com exemplo real.

## Fora de escopo (YAGNI)

- Checar célula a célula de tabela (já coberto, com IA, pela checagem existente).
- Validar que o total está na seção/posição certa do documento (limitação conhecida, ver acima).
- Correção automática de total divergente — é só um aviso pra revisão humana, igual o resto do
  módulo trata tudo que não tem correção 100% segura ancorada no original.
