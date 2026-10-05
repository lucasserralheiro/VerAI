# Pesquisa de satisfação → VerAI — mapa dos pedidos e roteiro

> Documento de roteiro, não de implementação. Cada onda abaixo vira, na hora de executar, um
> design (`docs/superpowers/specs/`) e um plano TDD (`docs/superpowers/plans/`) próprios, como manda
> o `CLAUDE.md`.

## 1. Objetivo

Pegar as 10 respostas da pesquisa de satisfação (setembro/2026), separar o que é do VerAI, agrupar
pedidos que na verdade são a mesma coisa, e definir a ordem de construção a partir do que o sistema
já tem hoje — sem prometer o que depende de dado que ainda não existe.

## 1.1 Escopo: as 8 GRCs

A PRODAM tem **8 gerências de relacionamento com clientes (GRC-1 a GRC-8)**, e a ideia é trazer
**todas** para dentro do VerAI. Hoje está entrando só a **GRC-1** (Access `ControleGEN-1.accdb`,
`scripts/importar-grc1.ts`). Os pedidos da pesquisa vêm de gente de várias GRCs (o Paulo é da GRC-2),
então quase todo o roteiro só entrega valor de verdade quando a GRC do solicitante estiver carregada.

O modelo de dados hoje assume **uma** origem. Antes de carregar a segunda GRC:

| Ponto | Hoje | Problema com 8 GRCs | Ajuste |
|---|---|---|---|
| `legacyId Int? @unique` em todo model migrado | chave de idempotência da importação | cada Access tem autonumeração própria: o `Contrato` 12 da GRC-2 colide com o 12 da GRC-1 | chave composta `(origemLegado, legacyId)` — ex. `origemLegado = 'GRC-2'` |
| Gerência | não existe; permissão é por `Cliente` (`usuariosPermitidos`) | sem saber de qual GRC é cada cliente | `Cliente.gerencia` (GRC-1..8) como **atributo e filtro**, não como barreira. As 8 GRCs são da **DRM** e o objetivo é centralizar: todo usuário da DRM vê todas as gerências. Permissão cliente a cliente fica só para quem é de fora da DRM |
| `Cliente.nome` e `siglaLegado` `@unique` | ok para uma base | mesmo cliente pode aparecer em mais de uma GRC? (verificar) | se sim: cliente único, contratos por gerência; se não: manter |
| `importar-grc1.ts` | específico da GRC-1 | 7 cópias do script | generalizar para `importar-grc.ts --gerencia N`, **se** os Access tiverem o mesmo schema (verificar um de cada) |
| Demandas sem cliente → SMS | decisão de 22/09 para a GRC-1 | não serve para outras GRCs | fallback por gerência |
| Itens de contrato "aguardando" (`clienteSiglaLegado`) | `T_ItensContrato` já cita 37 siglas, a maioria fora da GRC-1 | — | **ajuda**: esses itens devem se ligar sozinhos quando a GRC dona do cliente for carregada |

Consequência para o roteiro: a **carga das GRCs vira um trilho paralelo às ondas** (§5.1). O
comparativo de preços (C5) é o que mais ganha — com as 8 GRCs, compara contra toda a carteira da PRODAM.

## 2. Os pedidos

| # | Quem | Pedido (resumo) | Capacidade (§3) |
|---|---|---|---|
| 1 | Andrea J. C. Barroso | Licenças de ChatGPT/IA | — fora |
| 2 | Maria Amorim | Sala de descanso | — fora |
| 3 | Tadahiro Filho | Contratado × medido × faturado por cliente > contrato > item, saldo p/ aditivo; ligado a Protheus e medição DIT/GDP | C3, C4 |
| 4 | Viviane Boaretti | Minuta de proposta do Salesforce → SEI | — fora (integração Salesforce↔SEI) |
| 5 | Viviane Boaretti | Saldo por item de contrato e por valor | C2, C3 |
| 6 | Debora Silva | Diagnóstico de cada prefeitura (estrutura, TI, necessidades, LOA) | C7 |
| 7 | Marcilio Rossi | Catálogo de sistemas corporativos e responsáveis | — fora (outro produto) |
| 8 | Oscarlino Silva | Minuta de contrato (Lei 14.133) = proposta PDF + modelo .docx | C6 |
| 9 | Andrea Radaelli | (a) portal/BI de contratos com saldos, reajustes, aditivos; (b) comparativo de preços com outros clientes | C2, C3, C4, C5 |
| 10 | Paulo Tavares (gerência GRC-2) | (a) conferência de faturamento; (b) chat dos contratos; (c) RDM (abertura de chamado) pré-preenchida | C1, C3, C8 |

**Sinal principal:** #3, #5, #9 e #10 — quatro pessoas de áreas diferentes — pedem a mesma cadeia
**item contratado → medido → faturado → saldo**. É o eixo do roteiro.

## 3. Capacidades e estado atual

| Cap. | O que é | Atende | Estado hoje (23/09/2026) |
|---|---|---|---|
| C1 | Assistente de IA (chat sobre contratos e PDFs) | #10b, consulta do #9a | **Em construção.** Índice, trechos, busca full-text com permissão e sincronização prontos (`ca4710b`…`c542d2e`). Faltam agente/ferramentas, rota de chat e UI — `plans/2026-09-23-assistente-ia.md` |
| C2 | Contrato consolidado (portal por contrato) | #9a, #5 (valor) | **Existe.** Vigência, ativo, valor atual, aditivos na linha do tempo, saldo e % faturado em R$ por contrato via `consolidarContratos()`. Pendências em `plans/2026-09-23-consistencia-contratos.md` |
| C3 | Cadeia por item: contratado × medido × faturado × saldo | #3, #5, #9a, #10a | **Não existe.** `ItemContrato` tem quantidade/valor mas parte está órfã; `NotaFiscal` não liga a item; não há medição no banco |
| C4 | Reajuste e aditivo por item | #3, #9a | **Não existe.** Aditivo só como valor total em `HistoricoContrato`; nenhum model de reajuste |
| C5 | Comparativo de preços entre clientes | #9b | **Não existe.** Depende de C3 (item com chave de serviço) e C4 (preço reajustado) |
| C6 | Geração de minuta de contrato | #8 | **Não existe.** Reaproveita extração de PDF da Proposta Comercial; geração de .docx é nova |
| C7 | Diagnóstico de prefeitura | #6 | **Não existe.** Depende de fonte externa (IBGE, transparência, LOA) |
| C8 | RDM pré-preenchida (abertura de chamado) | #10c | **Não existe.** O VerAI monta o rascunho do chamado com os dados do contrato; depende de saber em qual sistema o chamado é aberto e se ele aceita abertura por API/e-mail ou só colar o texto |

## 4. Etapa 0 — Descoberta (antes de construir C3 em diante)

Conversas curtas, uma por pessoa. A resposta decide se o passo vira integração ou importação de planilha.

| Com quem | Perguntar |
|---|---|
| Andrea Radaelli | De onde saem hoje os reajustes (planilha? SEI? Protheus?) e em que granularidade (contrato ou item)? Que relatório ela tira hoje e de onde? Mostrar C2 como já está. |
| Tadahiro Filho | O sistema de medição da DIT/GDP exporta o quê (planilha, API, banco)? O Protheus dá faturado por item ou só por nota? Qual a chave que liga os três (código de serviço?) |
| Viviane Boaretti | Saldo "por item" = por código de serviço do contrato? Mostrar C2. |
| Paulo Tavares (GRC-2) | A GRC-2 tem um Access com o mesmo schema do GRC-1? (vale perguntar o mesmo às 8 GRCs.) Os clientes/contratos da GRC-2 **não estão no VerAI hoje**. Em qual sistema a RDM (chamado) é aberta, quais campos ela pede e quais ele sempre precisa ir buscar em contrato. Como a conferência de faturamento é feita hoje. |
| Oscarlino Silva (+ André, equipe Dennis Paul) | Modelo de minuta vigente, quais campos vêm da proposta, quem assina a revisão. |
| Debora Silva | Quais informações ela já junta à mão e de onde. |

**Decisões pendentes do próprio usuário** que afetam saldo (herdadas de `consistencia-contratos`):
faturamento cancelado abate saldo? aditivo não assinado estende vigência? rescisão com valor conta
como valor do contrato? mais de um lançamento por contrato+competência? — **precisam estar decididas
antes da Onda 2**, senão o saldo por item nasce com a mesma divergência do saldo por contrato.

## 5. Ondas

### Onda 1 — Entregar o que já está quase pronto
- Terminar C1 (assistente), já planejado.
- Preparar o modelo para várias GRCs (§1.1) antes de carregar a segunda.
- Fechar as pendências 1–8 de `consistencia-contratos` (valor, SEI, ordenação, faturado sem duplicado).
- Demonstrar C2 para Andrea Radaelli, Viviane e Paulo; coletar o que falta na tela por contrato.
- **Critério de pronto:** o assistente responde vigência, valor, aditivos, SEI e saldo em R$ de um
  contrato citando a fonte; os números batem com a ficha do cliente.
- **Atende:** #10b inteiro, #9a e #5 no nível do contrato.

### Onda 2 — Base por item
- Zerar itens órfãos (`scripts/reconciliar-clientes.ts`) ou marcar os irrecuperáveis.
- Definir a **chave do item** (código de serviço normalizado) — é o que permite somar medido/faturado
  por item e comparar entre clientes.
- Ligar `NotaFiscal` (serviço + quantidade) ao `ItemContrato` pela chave.
- Model de **reajuste** (contrato, período de referência, índice/%, aplicado s/n, data) e de
  **alteração de item por aditivo** (item, aditivo, nova quantidade/valor).
- Tela do item: valor inicial → aditivos → reajustes → valor atual.
- **Atende:** C4 inteiro; base de C3.

### Onda 3 — Medido e saldo por item
- Model de **medição por item e competência**.
- Entrada, nesta ordem de preferência conforme a Etapa 0:
  1. importar a planilha de medição (`MEDICAO`) que já passa pelo ConfereAI — com a Fase 3 do
     repositório (`specs/2026-09-23-repositorio-documentos-cliente-design.md` §3.6) ela fica ligada a
     contrato + competência; **verificar** se o XLSX gerado pelo Confere já traz medido por item
     aproveitável;
  2. importação periódica do export da DIT/GDP/Protheus;
  3. integração direta, só se houver API.
- Painel contratado × medido × faturado × saldo (quantidade e R$) por cliente > contrato > item,
  com filtro "medido e não faturado".
- Conferência de faturamento (#10a): divergência medido × faturado por competência, somada ao
  relatório do Confere.
- **Atende:** #3, #5, #9a e #10a.

### Onda 4 — IA em cima da base
- C5 comparativo de preços: tabela determinística por chave de serviço, preço reajustado à mesma
  data-base; IA só para casar descrições sem chave e redigir o quadro. Nenhum número vem da IA.
- C8 RDM pré-preenchida (se a Etapa 0 mostrar que é viável).
- C6 minuta de contrato: extração da proposta (já existe) + preenchimento de modelo .docx + revisão humana.

### 5.1 Trilho paralelo — carga das GRCs
1. **GRC-1** — em andamento.
2. **Preparação** — chave `(origemLegado, legacyId)`, `Gerencia`, importador genérico (§1.1).
3. **GRC-2 primeiro** entre as demais — é a do Paulo, que mais pediu e já quer usar o chat.
4. **GRC-3 a GRC-8** — uma por vez, cada uma com cópia de teste, dry-run, `reconciliar-clientes.ts`
   e conferência com o gerente antes de valer.

Cada GRC nova recebe automaticamente o que as ondas já entregaram (chat, portal, saldo).

### Backlog — C7 diagnóstico de prefeitura
Fora das ondas até existir fonte de dados definida. Candidato a módulo separado dentro de `Cliente`.

## 6. Dependências

```
Etapa 0 ─┬─> Onda 2 ──> Onda 3 ──> C5 (Onda 4)
         │     ▲
Onda 1 ──┘  decisões de saldo
Preparação multi-GRC ──> GRC-2 ──> GRC-3..8   (paralelo às ondas)
C1 (Onda 1) ── ganha ferramentas novas a cada onda (item, medido, reajuste)
C6, C8 ── independentes, dependem só da Etapa 0
```

## 7. Devolutiva para quem respondeu

| Pessoa | Resposta |
|---|---|
| Paulo (GRC-2) | Chat dos contratos: assim que a GRC-2 for carregada (§5.1). Conferência de faturamento: Onda 3. RDM (chamado pré-preenchido): Onda 4, sujeita a saber em qual sistema o chamado é aberto. |
| Andrea Radaelli | Portal por contrato: já existe (Onda 1). Itens, reajustes e saldos: Ondas 2–3. Comparativo: Onda 4. |
| Viviane | Saldo por valor: já existe. Por item: Onda 3. Salesforce→SEI: fora do VerAI. |
| Tadahiro | Onda 3; depende do formato dos dados da DIT/GDP/Protheus. |
| Oscarlino | Onda 4. |
| Debora | Backlog. |
| Andrea J. C. Barroso, Maria, Marcilio | Fora do escopo do VerAI — encaminhar a quem cabe. |

## 8. Riscos

- **Dado, não código, é o gargalo** de C3: sem export da medição e do faturado por item, a Onda 3 não sai.
- **Chave de serviço inexistente** no legado: se não houver código comum, o casamento vira manual/IA e
  o saldo por item perde confiabilidade.
- **Só a GRC-1 está no VerAI.** Quem é das outras 7 GRCs não vê nada do que for entregue até a gerência dele ser carregada — carregar a segunda GRC sem a chave composta de `legacyId` sobrescreve registros da primeira.
- **Schemas diferentes entre os Access** das GRCs multiplicam o trabalho de importação — checar um arquivo de cada antes de estimar.
- **Comparativo de preços** mostra o preço de um cliente ao lado do de outro. Dentro da DRM todos veem tudo; o cuidado é o quadro que vai para o cliente não expor o nome dos outros clientes.
