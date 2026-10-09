# Ponte VerAI ⇄ AIBertinho — design

> **Substituído em 08/10/2026** por `2026-10-08-api-plataforma-design.md` (API de plataforma: aplicativos com chave e escopo, webhooks assinados, fontes externas). Mantido como histórico da decisão.

**Data:** 07/10/2026 · **Sistemas:** VerAI (`C:\projeto\VerAI`, Next 15 + Prisma/Postgres) e AIBertinho,
o dashboard da DRM (`C:\projeto\dashboard\dashboard`, Next 16 + Drizzle/Turso).
Este arquivo existe **igual** nos dois repositórios — mudou um, copie para o outro.

## 1. Problema

Os dois sistemas falam dos mesmos clientes e gerências, cada um sabendo uma metade:

| Quem é a fonte | O quê |
|---|---|
| **VerAI** | cadastro do cliente e da carteira (gerência), contrato com prova (vigência efetiva, valor do último termo assinado, faturado, saldo, SEI — `consolidarContratos()`), vencimentos, alertas, documentos |
| **AIBertinho** | gerente responsável (GRC/KAM), meta e contratado do ano, pipeline de oportunidades, propostas do CRM (Q-xxxxx), tarefas e bloqueios do CX (Planner), visitas |

Hoje cada lado copia à mão um pedaço do outro (o AIBertinho importa contratos de planilha; o VerAI
não vê pipeline nem CX). As cópias divergem.

## 2. Decisões

1. **Cada dado tem um dono; o outro guarda um ESPELHO somente-leitura** (revisto em 07/10/2026 a
   pedido do usuário — a primeira versão era só leitura sob demanda). Os dois trocam **tudo** do domínio
   comercial sempre, independentemente de quem vai usar: cada lado publica um feed por entidade e o outro
   guarda a cópia em uma tabela genérica (`EspelhoRegistro` no VerAI, `espelho_registro` no AIBertinho).
   A cópia **nunca é editada** — só a sincronização escreve nela, sempre sobrescrevendo com a fonte —, e
   é isso que impede a divergência que cópia à mão causava. Detalhes no §9. As rotas sob demanda do §4
   continuam valendo para quem precisa do dado "agora" do outro lado.
2. **API REST versionada, só leitura, nos dois sentidos**, com envelope único
   `{ versao: 1, geradoEm, dados }` e erro `{ versao: 1, erro, ... }`. Campo novo pode entrar;
   renomear/remover campo = `v2` em rota nova, nunca mudança em silêncio.
3. **Um token por sentido**, só no servidor (o navegador nunca vê). Sem a variável, a ponte fica
   **desligada** (503/`nao-configurado`), nunca aberta.
4. **O outro sistema fora do ar não derruba ninguém.** Os clientes (`aibertinho.ts` no VerAI,
   `verai.ts` no AIBertinho) nunca lançam: devolvem `{ ok: false, motivo }` e a tela mostra
   "indisponível". Tempo-limite 8–10 s.
5. **Casamento só quando é único** (regra de ouro do VerAI). Sigla que casa com dois clientes → 409
   com candidatos; contrato com dois candidatos → `ambiguo`. Nunca se escolhe por conta.
6. **Quem resolve número de contrato é o VerAI** — ele já tem a regra (`identidadeDoContrato` +
   `localizarContrato`, a mesma do Confere). O AIBertinho manda o número como escreve
   ("17/2025-SGM") e a sigla do cliente.

## 3. Identidade (as chaves de casamento)

Os sistemas não compartilham id. As chaves:

- **Cliente → sigla.** VerAI: `Cliente.siglaLegado`. AIBertinho: `contrato.cliente`, `cx.cliente`,
  `projects.orgao` e o `servedClients` do gerente ("SMIT (Secretaria …)", "SGM - Secretaria …").
  Comparação por `siglaComparavel` (sem acento, maiúscula, só letras e números: "SP REGULA" =
  "SP-REGULA"). Proposta do CRM (nome por extenso) casa pela sigla citada em maiúsculas
  ("… - PGM") ou pelo nome completo do `servedClients`.
- **Gerência → `chaveDaGerencia`**: "GRC-4", "grc4-beatriz", "KAM 2", "GRC-C" → "GRC4", "GRC4",
  "KAM2", "GRCC".
- **Contrato → número**, resolvido no VerAI (§2.6).

`siglaComparavel` e `chaveDaGerencia` existem nos dois repositórios (`src/lib/integracao/chaves.ts`)
com **os mesmos casos de teste**. Mudou num, muda no outro.

## 4. Rotas

### 4.1 VerAI expõe — `/api/integracao/v1/*`

Porta: `Authorization: Bearer $INTEGRACAO_DASHBOARD_TOKEN` (público no middleware; o token é a
única porta, como os crons). Dinheiro em string decimal, data só-dia "AAAA-MM-DD". Todo número de
contrato sai de `consolidarContratos()`; totais de `carregarPainelCarteiras()`.

| Rota | Devolve |
|---|---|
| `GET /saude` | `{ sistema: 'VerAI', ok: true }` |
| `GET /carteiras` | uma linha por gerência: `id, nome, sigla, chave, gerentes[], totais` |
| `GET /clientes[?carteira=GRC-4\|sem]` | `id, nome, sigla, carteira{nome,sigla,chave}, totais, url` |
| `GET /clientes/:sigla` | o cliente + `contratos[]` consolidados + `alertas[]` (até 20). 404 sem cliente; 409 sigla ambígua com `candidatos` |
| `GET /contratos/localizar?numero=&cliente=` | um `{ numero, resultado: encontrado\|ambiguo\|nenhum\|ilegivel, contrato?\|candidatos? }` |
| `POST /contratos/localizar` `{ contratos: [{numero, cliente?}] }` | o mesmo, em lote (até 500, uma leitura do banco) |

`totais` = `TotaisCarteira` do painel (clientes, contratos ativos, sem valor, valor contratado,
faturado, saldo, % faturado, vencidos, vencem em 30/90 dias). Contrato: `id, numero, descricao,
situacao, seiProdam, seiCliente, ativo, rescindido, vigenciaFim, vencimento{nivel,dias},
valorContratado, faturado, saldo, percentualFaturado, avisos[], url`.

Código: `src/lib/integracao/` (`autenticacao.ts`, `chaves.ts`, `consultas.ts`, `tipos.ts`) e
`src/app/api/integracao/v1/`.

### 4.2 AIBertinho expõe — `/api/external/v1/verai/*`

Porta: `Authorization: Bearer $VERAI_INBOUND_KEY` — chave **própria**, separada da
`EXTERNAL_API_KEY` dos bots (troca uma sem derrubar a outra). Valores em `number` (como estão no
banco do AIBertinho).

| Rota | Devolve |
|---|---|
| `GET /saude` | `{ sistema: 'AIBertinho', ok: true }` |
| `GET /carteiras` | gerentes visíveis: `id, nome, gerencia, chave, ano, meta, metaNovosNegocios, contratado, contratadoNoAno, pipelineAberto, forecast, clientes[{sigla,nome}]` |
| `GET /clientes/:sigla/relacionamento` | `sigla, nome, gerentes[], pipeline{aberto, contratado, oportunidades[]}, propostas[], cx{abertos, bloqueiosAbertos, resolvidos, itens[] (só abertos, crítica primeiro)}, visitas[] (até 20, que citam a sigla), url`. 404 quando nada no AIBertinho fala do cliente |

Pipeline exclui `historico` e `perdido`. Código: `src/lib/integracao/` (`chaves.ts`,
`relacionamento.ts`, `resposta.ts`), `fetchLinhasParaRelacionamento` em `src/db/queries.ts` e
`src/app/api/external/v1/verai/`.

### 4.3 Clientes (quem consome)

- VerAI → `aibertinho.relacionamento(sigla)`, `aibertinho.carteiras()` (`src/lib/integracao/aibertinho.ts`).
- AIBertinho → `verai.saude/carteiras/clientes/cliente/localizarContratos` (`src/lib/integracao/verai.ts`).

## 5. Segurança e visibilidade

- Server-to-server; token comparado em tempo constante no VerAI. Gere com
  `openssl rand -base64 32`, um valor por sentido, e cadastre nas variáveis da Vercel dos dois projetos.
- A ponte do VerAI consulta como `USUARIO_INTEGRACAO`. Desde 02/10/2026 todo usuário do VerAI vê
  todos os clientes (`clienteIdsPermitidos` → `null`) e o AIBertinho é da DRM, então a ponte vê tudo.
  **Se a visibilidade do VerAI voltar a ser por cliente, a ponte precisa de decisão própria** antes.
- Só leitura nos dois sentidos. Escrita cruzada (ex.: abrir bloqueio de CX a partir de um alerta do
  VerAI) fica para uma v2 com desenho próprio.

## 6. Variáveis

| Projeto | Variável | Papel | Par |
|---|---|---|---|
| VerAI | `INTEGRACAO_DASHBOARD_TOKEN` | aceita chamadas do AIBertinho | = `VERAI_API_TOKEN` do AIBertinho |
| VerAI | `DASHBOARD_API_URL` | URL base do AIBertinho | — |
| VerAI | `DASHBOARD_API_TOKEN` | chama o AIBertinho | = `VERAI_INBOUND_KEY` do AIBertinho |
| AIBertinho | `VERAI_INBOUND_KEY` | aceita chamadas do VerAI | = `DASHBOARD_API_TOKEN` do VerAI |
| AIBertinho | `VERAI_API_URL` | URL base do VerAI | — |
| AIBertinho | `VERAI_API_TOKEN` | chama o VerAI | = `INTEGRACAO_DASHBOARD_TOKEN` do VerAI |

## 7. Fases

1. **Ponte (feito em 07/10/2026)** — rotas, clientes, chaves, testes, documentação.
1b. **Espelho (feito em 07/10/2026)** — feed por entidade nos dois lados, aviso a cada mudança, cópia
   somente-leitura, passadas de segurança (§9).
2. **Consumo nas telas** — VerAI: cartão "Relacionamento DRM" na ficha do cliente (gerente, pipeline,
   propostas, bloqueios abertos) e ferramenta somente-leitura `relacionamentoDrm` no assistente
   (`definirFerramenta` + rótulo + teste de permissão). AIBertinho: aba Clients do gerente mostra
   contratos/vencimentos do VerAI; ferramenta do assistente AIBertinho consulta `verai.cliente()`.
3. **Aposentar a planilha de contratos do AIBertinho** — `verai.localizarContratos()` em lote sobre
   os 100 `contrato.numeroContrato`; relatório de divergência (valor, fim de vigência) antes de trocar
   a fonte. Só troca depois do relatório zerado ou explicado — o Protheus continua do AIBertinho.

## 8. Riscos conhecidos

- **Sigla escrita diferente** nos dois lados ("SPTuris"/"SPTURIS" casa; "Sec. Fazenda de Palmas" não
  tem sigla) — o que não casa aparece como 404/`nenhum`, nunca como dado de outro cliente.
- **Visitas** não têm campo de cliente no AIBertinho: só entram as que citam a sigla em maiúsculas.
- **Cold start** de qualquer lado na Vercel: o cache de 5 min e o tempo-limite seguram a tela.

## 9. Espelho — troca contínua de tudo (07/10/2026)

Decisão do usuário: "fazer sempre uma troca de informação independente do que o outro precisa". Escolhas
dele: **espelho gravado**, **a cada mudança + passada periódica de segurança**, **tudo do domínio comercial**.

### 9.1 O que cada lado publica (feed)

| VerAI publica (`/api/integracao/v1/feed/:entidade`) | AIBertinho publica (`/api/external/v1/verai/feed/:entidade`) |
|---|---|
| `clientes` (cadastro, carteira, totais do painel) | `gerentes` (meta, contratado, contratado no ano, pipeline aberto, forecast, clientes atendidos) |
| `gerencias` (membros, clientes da carteira, totais) | `oportunidades` (pipeline completo, com histórico) |
| `contratos` (consolidados: vigência efetiva, valor, faturado, saldo, avisos, SEI) | `propostas` (CRM, Q-xxxxx) |
| `historico` (linhas do histórico do contrato) | `contratos` (tabela do AIBertinho, com Protheus) |
| `faturamentos` (com notas fiscais) | `cx` (tarefas e bloqueios, com a ficha, coluna e responsável) |
| `alertas` | `cx-comentarios` (com anexos) e `cx-contatos` |
| `demandas` (com trâmites) e `solicitacoes` | `visitas`, `store`, `organograma` |

Fica de fora de propósito: usuários/senhas, conversas de IA, configurações, documentos/PDFs do VerAI.

Formato de uma página: `{ entidade, hash, total, pagina, paginas, registros: [{ id, chaveCliente,
chaveGerencia, hash, dados }] }` dentro do envelope v1. Páginas de 1000 registros (teto de 4,5 MB de
resposta da Vercel). `hash` do registro = SHA-256 do JSON canônico (`canonico.ts`, igual nos dois);
`hash` da entidade = hash da lista "id:hash" — **igual ao da última vez = nada mudou**, e o consumidor
para na primeira página. `chaveCliente`/`chaveGerencia` são as chaves do §3, calculadas pelo produtor
(no AIBertinho, proposta e visita resolvem o cliente pelo `servedClients`, só quando é único).

### 9.2 Onde a cópia fica

Uma tabela genérica de cada lado — campo novo do outro sistema entra em `dados` sem migração:

- VerAI: `EspelhoRegistro(origem='aibertinho', entidade, idOrigem, chaveCliente, chaveGerencia, dados Json,
  hash)` + `EspelhoEstado(origem, entidade, hash, total, sincronizadoEm, tentativaEm, erro)` — migração
  `20261007200000_espelho_aibertinho` (só tabelas novas).
- AIBertinho: `espelho_registro` / `espelho_estado` (migração `0023_espelho_verai.sql`, `dados` em JSON texto).

Aplicação: carrega `(idOrigem, hash)` gravados, grava só novo/mudado, apaga o que sumiu, numa transação.
Se a entidade muda entre a página 1 e a N, a passada é abortada (não mistura dois momentos) e fica para a
próxima. Leitura: `espelhoDoCliente(sigla)` / `espelhoDaGerencia(gerencia)` nos dois lados.

### 9.3 "A cada mudança" — o aviso

A detecção é **na camada do banco**, para nenhuma tela ou rota precisar lembrar:

- VerAI: o `prisma` de `src/lib/prisma.ts` liga o evento `query` e entrega cada SQL a `observarSql`
  (`src/lib/integracao/aviso.ts`); INSERT/UPDATE/DELETE em tabela do domínio comercial vira a lista de
  entidades afetadas. O tipo exportado continua `PrismaClient`.
- AIBertinho: o cliente LibSQL de `src/db/index.ts` é um Proxy que entrega cada SQL (inclusive de
  transação e batch) ao `observarSql` dele.
- O lote da requisição sai **depois da resposta** (`after`), já com a escrita gravada, como
  `POST .../espelho/avisar { entidades }` para o outro lado — que responde 202 e puxa só aquelas
  entidades no `after` dele. Tabela do espelho não está no mapa: **sem eco** entre os dois.
- O script do SharePoint (PC do Lucas) usa o próprio `PrismaClient`; avisa explicitamente no fim, com
  `--aplicar` (sem `DASHBOARD_API_URL` no `.env` de lá, é no-op).

### 9.4 Rede de segurança

Aviso pode se perder (deploy, timeout, o outro dormindo). Por isso:

- VerAI: `sincronizarEspelhoSeVelho()` no carregamento da lista de clientes (`/api/clientes/painel`, via
  `after`, no máximo a cada 15 min por entidade) + cron diário `/api/integracao/v1/espelho/cron`
  (`CRON_SECRET`, 10:30 UTC).
- AIBertinho: `sincronizarEspelhoSeVelho()` no carregamento do dashboard (`fetchDashboardManagers`, via
  `after`, `VERAI_SYNC_THROTTLE_MINUTES`, padrão 15) — sem cron, mesma regra do Planner.
- Situação: `GET /api/integracao/v1/espelho` (VerAI) e `GET /api/external/v1/verai/espelho` (AIBertinho)
  mostram o que cada lado publica e hash/total/última sincronização/último erro da cópia.

### 9.5 Regras que não se negociam

- **Ninguém escreve na cópia** além do `espelho.ts`. Tela que quiser "corrigir" um dado do outro sistema
  corrige na fonte.
- **Número de contrato continua vindo do `consolidarContratos()`** no feed do VerAI — o AIBertinho não
  recalcula ativo, vigência, valor nem saldo a partir do histórico espelhado.
- Entidade nova no feed: carregador no `feed.ts` do produtor + nome na lista `ENTIDADES_DO_*` do
  consumidor + tabelas no mapa do `aviso.ts` do produtor. Sem isso ela não troca.

## 10. O admin escolhe o que envia (07/10/2026)

Decisão do usuário: "quero controlar o que mando na API", **por tipo de dado**, numa **tela de admin**.

- **Telas:** VerAI `/admin/integracao` (card na página Administração); AIBertinho `/settings/integracao`
  (item "Integração VerAI" na lateral do painel admin). Só admin nos dois.
- **Cada tela tem:** situação da conexão (variáveis preenchidas ou não, "Testar conexão" que chama o
  `/saude` do outro lado), **uma chave liga/desliga por tipo de dado que ESTE sistema envia** (com quem e
  quando mudou) e a tabela do que RECEBE (registros, última sincronização em laranja depois de 1 h,
  erro, "o outro lado não envia"), com o botão **"Sincronizar agora"**.
- **Tudo nasce DESLIGADO.** Com as variáveis preenchidas e nenhuma chave ligada, nada sai.
- **Onde fica a escolha:** VerAI na tabela `IntegracaoPublicacao(entidade, ativa, alteradoEm, alteradoPor)`
  (mesma migração do espelho); AIBertinho em `system_settings`, chave `integracao_publicacao` (JSON).
- **Efeito de desligar um tipo:** o feed dele sai **vazio** com `publicada: false`; o outro lado aplica a
  lista vazia e **apaga a cópia** daquele tipo, e marca `publicadaNaOrigem = false` (a tela mostra
  "o outro lado não envia"). As consultas sob demanda (§4) respeitam a mesma escolha: rota de um tipo
  desligado responde 403; o detalhe do cliente (VerAI) e o relacionamento (AIBertinho) saem sem as
  partes desligadas.
- **Ligar/desligar avisa o outro lado na hora** (ele puxa ou apaga). O aviso automático de mudança só
  sai para tipos ligados.
- Código: `src/lib/integracao/publicacao.ts` nos dois lados (`ROTULOS_DO_*`, `entidadesPublicadas`,
  `exigirPublicada`, `definirPublicacao`). Tipo novo no feed entra também em `ROTULOS_DO_*` — é dali que
  sai a lista de chaves da tela.
