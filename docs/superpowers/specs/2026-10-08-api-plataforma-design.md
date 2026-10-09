# API de plataforma — VerAI e AIBertinho — design

**Data:** 08/10/2026 · **Substitui** a ponte ponto a ponto de
`2026-10-07-integracao-verai-aibertinho-design.md` (rotas `/api/integracao/v1` e `/api/external/v1/verai`, tokens
em variável de ambiente, escolha global do que publicar). Este arquivo existe **igual** nos dois repositórios.

## 1. Problema e decisão

A primeira versão ligava os dois sistemas um ao outro: tokens fixos em `.env`, rotas com o nome do outro sistema,
uma chave liga/desliga global. Um terceiro sistema obrigaria a duplicar tudo. Decisão do usuário (08/10/2026):
**fazer como todo app faz API** — e **nos dois projetos juntos**, com **chave de API** (não OAuth).

Cada sistema passa a ter a **mesma API de plataforma**:

- **Aplicativos**: quem quer ler os dados é cadastrado pelo admin, recebe uma **chave própria** (só o hash fica
  guardado) e **escopos por recurso** (`contratos:ler`). Desativar o app ou girar a chave corta o acesso na hora.
- **Recursos REST** iguais para qualquer consumidor: `/api/v1/<recurso>` (lista paginada, filtros) e
  `/api/v1/<recurso>/<id>`, com **descoberta** em `/api/v1` e **OpenAPI** em `/api/v1/openapi.json`.
- **Webhooks assinados** por aplicativo: o sistema avisa *o que mudou*; o app busca os dados pela API.
- **Fontes externas**: o lado que consome. Cadastra-se a URL e a chave que o outro sistema emitiu; o espelho
  (cópia somente-leitura, §6) usa só a API pública do outro lado.

O AIBertinho é, para o VerAI, **um aplicativo** (que lê) e **uma fonte** (de onde se recebe) — e vice-versa.
Nenhum código cita o outro sistema pelo nome.

## 2. Telas

- VerAI: **`/admin/api`** ("API e integrações" no menu Administração e no painel /admin).
- AIBertinho: **`/settings/api`** ("API e integrações" na lateral do painel admin).
- Três abas iguais: **Aplicativos** (criar, escopos, ativar, girar chave, excluir; webhooks com segredo, "Testar"
  e as últimas entregas), **Fontes externas** (testar URL+chave e ver o que a chave libera, escolher recursos,
  "Atualizar agora", endereço de webhook para copiar, segredo do webhook, excluir) e **Documentação**.
- A chave aparece **uma vez** (criar/girar). O segredo do webhook fica visível na tela (precisa ser copiado).

## 3. Autenticação e escopo

`Authorization: Bearer <chave>`. VerAI emite `vrai_…`, AIBertinho emite `aib_…` (32 caracteres aleatórios).
Guardado: SHA-256 da chave + prefixo para exibição. App inexistente, desativado ou chave girada → **401**
`chave_invalida`; recurso sem o escopo `<recurso>:ler` → **403** `sem_permissao`. `ultimoUsoEm` atualiza no
máximo 1×/min. A `EXTERNAL_API_KEY` dos bots do AIBertinho (`/api/external/v1`) continua separada.

## 4. Formato

Sucesso: `{ objeto: 'api' | 'lista' | 'registro' | 'recebido', ... }`. Erro: `{ erro: { codigo, mensagem } }`.

- `GET /api/v1` → `{ objeto:'api', sistema, versao:1, app:{nome}, documentacao, recursos:[{recurso, rotulo, descricao, permitido}] }`
- `GET /api/v1/<recurso>?pagina&limite(≤1000, padrão 100)&cliente=<sigla>&gerencia=<GRC-4>` →
  `{ objeto:'lista', recurso, hash, total, pagina, paginas, limite, data:[{ id, chaveCliente, chaveGerencia, hash, dados }] }`
  — `hash` do conjunto: igual ao da última leitura = nada mudou.
- `GET /api/v1/<recurso>/<id>` → `{ objeto:'registro', recurso, data }`
- VerAI: `POST /api/v1/acoes/localizar-contratos` `{ contratos:[{numero, cliente?}] }` (escopo `contratos:ler`).

Recursos — VerAI: `clientes, gerencias, contratos, historico, faturamentos, alertas, demandas, solicitacoes`.
AIBertinho: `gerentes, oportunidades, propostas, contratos, cx, cx-comentarios, cx-contatos, visitas, store, organograma`.
Catálogo em `src/lib/integracao/feed.ts` (`RECURSOS_DO_*` + carregadores); o OpenAPI sai dele.

Chaves de casamento (`src/lib/integracao/chaves.ts`, cópia idêntica nos dois, mesmos testes): `chaveCliente` =
`siglaComparavel` da sigla; `chaveGerencia` = `chaveDaGerencia` ("GRC-4" → "GRC4").

## 5. Webhooks

```
POST <url cadastrada no aplicativo>
Content-Type: application/json
X-Webhook-Id: <uuid>       X-Webhook-Origem: verai | aibertinho
X-Webhook-Assinatura: t=<unix>,v1=<hex HMAC-SHA256(segredo, "<t>.<corpo>")>

{ "id": "<uuid>", "tipo": "recursos.alterados" | "ping", "origem": "...", "recursos": ["contratos"], "ocorridoEm": "<ISO>" }
```

- **Disparo automático**: a escrita é detectada **na camada do banco** (VerAI: evento `query` do Prisma em
  `src/lib/prisma.ts`, com o observador ligado por `src/instrumentation.ts` só no runtime Node — o middleware Edge
  importa o Prisma e não pode carregar `node:crypto`; AIBertinho: Proxy do cliente LibSQL em `src/db/index.ts`) → `observarSql` mapeia a tabela
  para recursos (`src/lib/integracao/aviso.ts`) → depois da resposta (`after`), `dispararWebhooks` avisa cada
  webhook ativo de app ativo que assina o recurso **e tem o escopo dele**. Script do SharePoint (PrismaClient
  próprio) avisa explicitamente no fim.
- O aviso **não carrega dado** — só o nome dos recursos. Quem recebe busca pela API com a própria chave.
- Entregas registradas (status, erro, duração), as 50 últimas por webhook. Sem nova tentativa automática: a
  passada periódica de quem consome cobre aviso perdido.
- **Receber**: `POST /api/v1/webhooks/<slug-da-fonte>` confere a assinatura com o segredo da fonte (janela de
  5 min contra replay), responde 202 e sincroniza os recursos citados no `after`. `ping` só confirma.

## 6. Espelho (fontes externas)

- Tabelas: `FonteExterna`/`fontes_externas` (slug, nome, url, chave do outro lado em claro, segredo do webhook,
  recursos escolhidos, ativa) e o espelho genérico já existente (`EspelhoRegistro`/`espelho_registro` com
  `origem = slug`, `EspelhoEstado`/`espelho_estado`).
- Sincronização por recurso: lê as páginas de 1000; se o `hash` não mudou, para na primeira; se mudou no meio da
  leitura, aborta (não mistura dois momentos); grava só novo/mudado e apaga o que sumiu, numa transação.
- **403 da fonte** (escopo retirado) → a cópia daquele recurso é apagada e a tela mostra "a fonte não libera mais".
- Desmarcar um recurso ou excluir a fonte apaga a cópia correspondente.
- Disparos: webhook da fonte; "Atualizar agora"; passada de 15 min (VerAI: `/api/clientes/painel`; AIBertinho:
  `fetchDashboardManagers`); VerAI também tem o cron diário `/api/integracoes/cron` (`CRON_SECRET`).
- Leitura: `espelhoDoCliente(sigla)` / `espelhoDaGerencia(gerencia)` → `{ [fonte]: { [recurso]: dados[] } }`.
- **Ninguém escreve na cópia** além do `espelho.ts`.

## 7. Configurar VerAI ⇄ AIBertinho (exemplo)

1. **VerAI → Aplicativos → Novo**: "AIBertinho", marque o que ele pode ler, copie a chave `vrai_…`.
2. **AIBertinho → Fontes → Adicionar**: nome "VerAI", URL do VerAI, a chave `vrai_…` → Testar → escolha → Salvar.
   A tela mostra o endereço de webhook desta fonte (`<url do AIBertinho>/api/v1/webhooks/verai`).
3. **VerAI → app AIBertinho → Adicionar webhook** com esse endereço; copie o segredo `whsec_…` e cole na fonte
   "VerAI" do AIBertinho. "Testar" deve dar "Ping entregue".
4. Repita no sentido contrário (app "VerAI" no AIBertinho, fonte "AIBertinho" no VerAI).

Em dev: VerAI em `http://localhost:3000`, AIBertinho em `http://localhost:6001` (a 6000 é bloqueada pelo `fetch`).

## 8. Migrações

- VerAI `20261008120000_api_plataforma` — tabelas novas (`ApiApp`, `ApiWebhook`, `ApiWebhookEntrega`,
  `FonteExterna`) e remove `IntegracaoPublicacao` (da versão anterior).
- AIBertinho `0024_api_plataforma.sql` — `api_apps`, `api_webhooks`, `api_webhook_entregas`, `fontes_externas`.
- Nenhuma variável de ambiente nova. As da versão anterior (`INTEGRACAO_DASHBOARD_TOKEN`, `DASHBOARD_API_*`,
  `VERAI_API_*`, `VERAI_INBOUND_KEY`) não são mais lidas.

## 9. Regras que não se negociam

- Recurso novo: carregador + rótulo em `feed.ts` + tabelas no mapa do `aviso.ts`. Sem isso não sai nem avisa.
- Campo novo em `dados` pode entrar; renomear/remover campo ou mudar o envelope = `/api/v2`.
- Número de contrato do VerAI sai sempre de `consolidarContratos()`.
- Chave nunca em log, nunca devolvida depois de criada. Escopo novo só de recurso que existe (`escoposValidos`).

## 10. Fora desta versão

Escrita pela API, limite de requisições por app, nova tentativa automática de webhook, OAuth. Entram quando
houver um consumidor que precise.
