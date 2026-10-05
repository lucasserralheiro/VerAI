# Assistente de IA — interface (fase 3 de 3) (design)

**Status**: Desenho escrito em 25/09/2026, a partir do brainstorm com o usuário (print do painel
aberto na ficha da SP Regula). Aguarda revisão do usuário. Implementação não iniciada.
**Data**: 25/09/2026
**Fases**: `2026-09-25-assistente-base-economica-design.md` (1) →
`2026-09-25-assistente-senior-design.md` (2) → esta spec (3).
**Depende**: da fase 1 (objeto estruturado das ferramentas no stream, links `tipo:id`) e da fase 2
(alertas no resumo inicial, quadros de fichas e de normas). Se a fase 2 atrasar, o resumo inicial sai
só com os números e as consultas rápidas.

---

## 1. Objetivo

Pedido do usuário (25/09/2026): *"eu preciso melhorar a ui e ux desse agente de IA"*, sem gastar mais
token.

Princípios:

1. **O que dá para mostrar sem IA, a tela mostra**: resumo ao abrir, quadros de dados e consultas
   rápidas. Custo zero.
2. **A IA comenta e recomenda**; não reescreve tabela. Menos token de saída, que é o mais caro, e
   nenhum número copiado à mão.
3. **Mostrar de onde veio**: cada consulta feita fica visível.

| | Hoje | Depois |
|---|---|---|
| Abrir o painel num cliente | 3 sugestões fixas e mais da metade do painel vazia | resumo do cliente: números, até 5 alertas com "Como resolver?" e consultas rápidas, sem gastar token |
| "Vencimentos em 90 dias" | pergunta à IA (~10 mil tokens) | consulta rápida: quadro na hora, 0 token |
| Lista de contratos na resposta | a IA escreve a tabela | a tela desenha o quadro; a IA comenta em poucas linhas |
| De onde veio a resposta | não aparece | "Como cheguei aqui", com cada consulta |
| Resposta ruim | nada a fazer | 👎 com motivo; o admin vê a lista |
| Conversa antiga | não dá para apagar | apagar, filtrar pelo título, agrupada por data |
| Tabela larga | rolagem lateral em 420 px | painel expande para 760 px |
| Nome do cliente no chip | quebra em duas linhas | sigla, com o nome completo ao passar o mouse |

## 2. Diagnóstico (print do usuário e código, 25/09/2026)

- O chip de contexto usa o nome completo do cliente (`descreverContexto`) e quebra em duas linhas.
- A tela vazia tem 3 sugestões fixas por tipo de rota (`sugestoes()` em `painel-assistente.tsx`) e
  deixa mais da metade do painel em branco.
- O campo de pergunta não cresce (`rows={1}`, sem ajuste de altura), não mostra a dica de Enter e
  fica travado enquanto a resposta chega.
- A resposta é só markdown. Tabela larga vira rolagem lateral. Não há copiar, avaliar nem refazer, e
  o que foi consultado só aparece durante a resposta, na linha "Consultando…".
- O histórico é uma lista simples: sem apagar (a rota `DELETE` existe, a tela não usa), sem filtro,
  sem agrupamento. Contexto removido só volta ao trocar de tela.
- O botão flutuante é só um ícone; o atalho Ctrl+K aparece só no `title`.

## 3. Layout

```
┌ Assistente VerAI ────────────────────── [⟲] [+] [⤢] [×] ┐
│ SMIT › TC 45/SMIT/2023                          [tirar] │  chip curto; nome completo no title
├──────────────────────────────────────────────────────────┤
│ RESUMO · sem IA                                          │  estado vazio (§4.1)
│ 12 ativos · próximo vencimento em 28 dias · saldo R$ …   │
│ ● Crítico  Vence em 28 dias sem prorrogação              │
│            [Como resolver?]  [Abrir contrato]            │
│ ● Atenção  Faturamento 08/2026 não enviado ao GFP        │
│ Consultas rápidas: [Vencimentos 90 dias] [Alertas]       │
│                    [Faturamento 6 meses]                 │
├──────────────────────────────────────────────────────────┤
│                  Quais contratos vencem até dezembro? ▌  │  pergunta
│ ┌ Contratos vencendo (28) ───────────────────────────┐   │  quadro desenhado pela tela (§4.3)
│ │ TC 45/SMIT/2023  ● atenção  31/10/2026  37 dias …  │   │
│ │ … 10 linhas                        [ver todas (28)] │   │
│ └─────────────────────────────────────────────────────┘   │
│ Dois vencem em menos de 30 dias sem prorrogação…         │  texto curto da IA
│ Próximo passo: …                                         │
│ ▸ Como cheguei aqui (2 consultas)                        │  §4.4
│ [copiar] [👍] [👎]                                        │  §4.6
│ [Quais já têm prorrogação?] [Alertas da carteira]        │  continuação sem IA (§4.5)
├──────────────────────────────────────────────────────────┤
│ ┌ Pergunte ao assistente…                             ┐ ➤ │
│ └──────────────────────────────────────────────────────┘ │
│ Enter envia · Shift+Enter quebra linha                   │
└──────────────────────────────────────────────────────────┘
```

## 4. Decisões

### 4.1 Resumo inicial, sem IA

- `GET /api/assistente/resumo?rota=` devolve o contexto da tela, os números do consolidado, até 5
  alertas (fase 2, `alertasDosContratos()`), a contagem por tipo de alerta e as consultas rápidas
  que cabem naquela tela.
- **Na ficha do cliente**: contratos ativos, próximo vencimento, saldo somado dos que têm valor
  (mesma regra de `resumoDoCliente`) e os alertas do cliente.
- **No contrato**: situação, vigência, valor, saldo e % faturado, com as barras do
  `indicadores-contrato`, mais os alertas do contrato.
- **Sem contexto**: "Sua carteira": contagem por tipo de alerta nos clientes visíveis e os 5 mais
  graves.
- Cada alerta tem **"Como resolver?"** e **"Abrir"** (link). "Como resolver?" manda à IA uma pergunta
  pronta. A bolha mostra o título do alerta e o contrato; o corpo da requisição leva
  `alerta: { codigo, contratoId }`, que o servidor recalcula (confere permissão e existência) e põe no
  contexto. A IA já recebe o alerta e os ids, sem precisar procurar.
- Custo: zero token até alguém clicar em "Como resolver?".

### 4.2 Consultas rápidas, sem IA

- `POST /api/assistente/conversas/[id]/consultas` com `{ ferramenta, entrada, rotulo }`. Lista
  fechada: `contratosVencendo`, `alertas`, `faturamentos`, `resumoDoCliente`, `buscarPorSei`. A
  entrada é validada pelo zod da própria ferramenta e roda pelo mesmo `executarComSeguranca`, com o
  usuário por closure (mesma permissão).
- Grava na conversa a pergunta (`rotulo`, ex.: "Vencimentos nos próximos 90 dias") e a resposta, com
  `origem: 'consulta'` e 0 token. A resposta guarda a saída (§4.3), e o texto é um resumo curto e
  determinístico (até 600 caracteres, cortado por linha do texto compacto da fase 1). É esse texto
  que vai no histórico para a IA, para a pergunta seguinte poder falar da consulta.
- **Não conta no limite de 30 perguntas por hora**, que passa a contar só `origem: 'ia'`.
- Sem conversa aberta, o painel cria uma (mesmo `POST /api/assistente/conversas`, com o rótulo como
  título).

### 4.3 Quadros desenhados pela tela

- O stream já traz a saída estruturada de cada ferramenta (`tool-<nome>` em `output-available`). O
  painel desenha um quadro por consulta, acima do texto da IA, na ordem em que terminaram.

  | Ferramenta | Quadro |
  |---|---|
  | `resumoDoCliente`, `contratosVencendo` | tabela de contratos: número (link), nível, fim, dias, valor, saldo, % |
  | `detalheDoContrato` | cartão do contrato (barras de vigência e saldo) e linha do tempo do histórico |
  | `faturamentos` | competência, contrato, valor, situação, enviado ao cliente e ao GFP |
  | `alertas` | lista por nível, com "Abrir" |
  | `buscarPorSei` | onde o SEI aparece, com link |
  | `buscarNosDocumentos`, `buscarNasNormas` | fontes: arquivo, página e citação (recolhida) |
  | `fichasDoContrato` | comparação lado a lado: campo × termo, com a página |
  | demais listas (demandas, solicitações, itens, fornecedores, propostas, ConfereAI) | tabela genérica das colunas devolvidas |
  | `buscarClientes`, `consultarManual`, `tramitesDaDemanda`, `analisesDeDocumentos` | sem quadro; só em "Como cheguei aqui" |

- Regras comuns: até 10 linhas, com "ver todas (N)"; números alinhados à direita; SEI pelo `SeiLink`;
  link por linha; nível com as cores do semáforo das telas (`indicadores-contrato`: crítico
  `red-crit`, atenção `orange`, ok `green-ok`; info em cinza).
- **Regra nova na instrução** (fixa): *"O usuário vê, acima do seu texto, um quadro com o resultado de
  cada consulta (exceto a busca de cliente). Não reescreva tabela nem liste item por item: diga o que
  importa, o que fazer, e cite linhas por link."*
- **Saída guardada**: `MensagemAssistente.ferramentas` passa a ter a `saida` de cada consulta com
  quadro, para a conversa reabrir com os quadros. Teto de 20 mil caracteres por mensagem; o que não
  couber fica marcado `saidaOmitida`.
- **Retenção de 30 dias**: o cron diário que já existe (`/api/assistente/indexar/cron`) passa a
  também tirar a `saida` das mensagens com mais de 30 dias. O texto fica. O quadro expirado mostra
  "Consultar de novo" (consulta rápida com a mesma entrada, 0 token) quando a ferramenta está na lista
  do §4.2; senão, "quadro expirado". Estimativa: ~15 MB fixos para 10 pessoas com 10 perguntas por dia.
- **Id da resposta**: o servidor gera o id antes do stream (`generateMessageId` do
  `toUIMessageStreamResponse`) e grava a mensagem com esse id. O painel recebe o id no começo do
  stream e o usa para avaliar (§4.6).

### 4.4 Como cheguei aqui

Recolhido por padrão. Lista as consultas em ordem, com o rótulo de `ROTULOS_FERRAMENTAS` e um resumo
da entrada ("cliente SMIT", "até 31/12/2026"). Para admin, mostra também os tokens da resposta
(entrada, cache, saída). Enquanto a resposta chega, vira uma linha do tempo ao vivo (✓ feita,
⟳ rodando).

### 4.5 Sugestões de continuação, sem IA

Um mapa fixo, da última consulta para 2 ou 3 próximos passos, com os ids da resposta. Sempre que
possível é uma consulta rápida (0 token). Aparecem só abaixo da última resposta.

| Depois de | Sugestões |
|---|---|
| `resumoDoCliente` | Alertas deste cliente · Faturamento dos últimos 6 meses · Vencimentos em 120 dias |
| `detalheDoContrato` | Alertas deste contrato · O que mudou nos aditivos? (IA) · Faturamento deste contrato |
| `contratosVencendo` | Quais já têm prorrogação em andamento? (IA) · Alertas da carteira |
| `alertas` | Como resolver o mais grave? (IA) · Vencimentos em 90 dias |
| `faturamentos` | Algum lançamento sem envio? (IA) · Saldo dos contratos deste cliente |
| `buscarPorSei` | Detalhe do primeiro resultado (IA) |

### 4.6 Ações da resposta

- **Copiar**: o texto da resposta, sem a sintaxe dos links.
- **👍 / 👎**: `PATCH /api/assistente/mensagens/[id]/avaliacao` com `{ avaliacao: 1 | -1 | null,
  motivo? }`. O 👎 abre motivos de um clique: "número errado", "não entendeu", "faltou dado", "outro".
  Só o dono da conversa avalia, e só resposta do assistente.
- **Refazer**: reenvia a mesma pergunta.
- `/admin/assistente` ganha o "% de respostas úteis (30 dias)" e a lista das 20 últimas 👎, com
  pergunta, resposta e motivo. Resposta errada vira pergunta nova da régua.

### 4.7 Histórico

Agrupado em Hoje, Ontem, Últimos 7 dias e Anteriores; filtro pelo título (no navegador, sobre as
conversas carregadas, com o teto da rota subindo de 30 para 50); apagar com confirmação na própria
linha, pela rota `DELETE` existente; conversa aberta destacada.

### 4.8 Painel e campo

- **Largura**: 420 px ↔ 760 px, pelo botão ⤢, lembrada no `localStorage` (leitura e escrita dentro de
  `try/catch`: sem storage, abre em 420). No celular continua tela cheia.
- **Chip**: `sigla › contrato` (ex.: `SMIT › TC 45/SMIT/2023`), com o nome completo no `title`.
  `descreverContexto` passa a devolver `rotulo` (curto) e `rotuloCompleto`. Depois de "tirar", a
  barra mostra "Usar esta tela", que devolve o contexto.
- **Campo**: cresce até 6 linhas; dica "Enter envia · Shift+Enter quebra linha"; dá para digitar
  enquanto a resposta chega (o envio fica bloqueado e o botão vira "Parar"); contador só acima de
  1.800 caracteres.
- **Teclado e leitura**: foco no campo ao abrir; Esc fecha; `aria-live="polite"` na linha de status;
  rolagem automática só quando a pessoa já está no fim da conversa.
- **Botão flutuante**: rótulo visível ao passar o mouse ou focar ("Assistente · Ctrl+K"). Sem selo
  nem contador (§9).
- **Estilo**: tokens e classes que já existem (`BTN_*`, `LINK_NAVY`, `INPUT_BASE`, paleta
  `navy`/`orange`).

## 5. Componentes

`painel-assistente.tsx` (196 linhas hoje) vira o orquestrador. As partes ficam em arquivos próprios em
`src/components/assistente/`: `cabecalho-painel.tsx`, `chip-contexto.tsx`, `resumo-inicial.tsx`,
`historico-conversas.tsx`, `mensagem-resposta.tsx` (texto, quadros, como cheguei, ações, sugestões),
`quadros/` (um arquivo por quadro, mais o mapa ferramenta → quadro), `como-cheguei.tsx`,
`acoes-resposta.tsx`, `continuacoes.ts` (o mapa do §4.5) e `campo-pergunta.tsx`.

`use-conversa-assistente.ts` passa a guardar, por mensagem, o id do servidor, a `origem` e as partes
de ferramenta (`nome`, `entrada`, `estado`, `saida`), não só o texto. Ganha também `consultar()` (§4.2)
e `avaliar()` (§4.6).

No servidor: `src/lib/assistente/resumo-inicial.ts` (monta o §4.1) e
`src/lib/assistente/consultas-diretas.ts` (lista fechada, validação e texto curto do §4.2).

## 6. Dados e rotas

**Migração** em `MensagemAssistente`: `origem String @default("ia")` (`ia` | `consulta`), `avaliacao
Int?`, `motivoAvaliacao String?`. `ferramentas` (Json) passa a aceitar `saida` e `saidaOmitida`.

| Rota | Função |
|---|---|
| `GET /api/assistente/resumo?rota=` | resumo inicial (§4.1) |
| `POST /api/assistente/conversas/[id]/consultas` | consulta rápida (§4.2) |
| `PATCH /api/assistente/mensagens/[id]/avaliacao` | 👍/👎 (§4.6) |
| `POST /api/assistente/conversas/[id]/mensagens` | aceita `alerta` opcional (§4.1); gera o id da resposta antes do stream |
| `GET /api/assistente/conversas/[id]` | devolve também `origem`, `ferramentas` (com `saida`) e `avaliacao` |
| `GET /api/assistente/conversas` | teto de 30 → 50 |

## 7. Erros

| Situação | Comportamento |
|---|---|
| Resumo inicial falha | estado vazio de hoje (sugestões fixas) |
| Consulta rápida falha | mensagem de erro na conversa com "tentar de novo" |
| Saída de formato antigo ou inesperado | sem quadro; a consulta aparece só em "Como cheguei aqui" |
| Alerta de "Como resolver?" não existe mais | a pergunta segue sem o alerta no contexto, e a IA consulta `alertas` |
| `localStorage` indisponível | painel abre em 420 px, sem lembrar |

## 8. Testes

1. Rotas: resumo com cliente, com contrato, sem contexto e com erro; consulta rápida (conversa alheia
   404, ferramenta fora da lista 400, entrada inválida 400, grava `origem: 'consulta'` com 0 token, não
   conta no limite); avaliação (só o dono, só resposta do assistente, valores válidos); id da resposta
   igual no stream e no banco.
2. Quadros (Testing Library): cada tipo a partir de uma saída de exemplo; 10 linhas e "ver todas";
   SEI vira `SeiLink`; saída inesperada não quebra.
3. Painel: chip curto com `title`; "Usar esta tela"; expandir lembra (e `localStorage` quebrado não
   derruba); Esc fecha; digitar durante a resposta; campo cresce; histórico agrupado com datas fixas;
   apagar chama `DELETE` e tira a linha.
4. Régua (fase 1) com a regra nova dos quadros: tokens de saída das perguntas 1, 3 e 8 (as de lista)
   pelo menos 40% menores que na rodada do fim da fase 2.
5. Verificação no navegador (preview): resumo na ficha do cliente, no contrato e sem contexto; uma
   resposta de lista com quadro; painel expandido; apagar do histórico. Com captura de tela.

## 9. Fora de escopo

Selo ou contador no botão flutuante, notificações, modo "análise aprofundada" com modelo de
raciocínio, voz, anexar arquivo na pergunta, exportar conversa, painel acoplado que empurra a página,
editar o título da conversa.

## 10. Ordem (para o plano)

1. Migração e rotas novas (consultas, avaliação, resumo; `generateMessageId`).
2. Hook guardando as partes de ferramenta e o id do servidor.
3. Quadros e o mapa ferramenta → quadro; regra nova na instrução.
4. Como cheguei aqui, ações e sugestões de continuação.
5. Resumo inicial (usa os alertas da fase 2).
6. Histórico e painel (largura, chip, campo, teclado).
7. Retenção no cron e tela de admin (% úteis, lista das 👎).
8. Régua e verificação no navegador; atualizar o CLAUDE.md e esta spec.
