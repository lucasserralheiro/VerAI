# ESPEC 048 — O Next.js que ficou vinte e um patches atrás

| | |
|---|---|
| **Status** | **Implementada e publicada** — 2026-09-09. Bump aplicado (`next`/`eslint-config-next` `15.5.4` → `15.5.25`). `pnpm audit`: **40 → 7** achados, **zero críticas**, zero achados de `next`/`eslint-config-next` — restam só os fora de escopo do `D-03` (`postcss`/`nanoid`/`sharp`/`js-yaml`). Suíte E2E pós-bump: **127/127** (25,0 min, nenhum caso perto do limite de 120s) — igual à linha de base. `pnpm lint`, `tsc --noEmit` e `pnpm build` limpos. Build Docker local validado: builda, sobe, responde `200` em `/`. Portões `P0`-`P3` fechados. Publicada em produção a pedido direto do usuário, fora do `PLANO 048` (§12) |
| **Versão** | 1.4 — 2026-09-09 |
| **Depende de** | Nada — primeira especificação desta série sobre dependência de terceiros. Não há ESPEC anterior de hospedagem ou de cadeia de suprimentos a revisar |
| **Revisa** | Nada de decisão anterior. `next@15.5.4` foi a versão escolhida na implantação inicial (README §"Hospedagem"); esta espec não questiona a escolha do Next.js, só o atraso de patch acumulado desde então |
| **Não toca** | Migração para Next 16, migração para React 19, o *pin* interno de `postcss@8.4.31` que o próprio `next` carrega (não muda com este bump — `D-03`), as vulnerabilidades de `sharp`/`nanoid`/`js-yaml` (dependências de build, não de execução), e a pendência de autenticação/rede da hospedagem (README linhas 186-189, tratada em decisão separada) |
| **Referência normativa** | `pnpm audit` rodado em `frontend/` nesta revisão; GHSA-955p-x3mx-jcvp e os demais advisories listados em §2.2; `frontend/Dockerfile`, `frontend/package.json` |
| **Origem** | Revisão de segurança do projeto solicitada em conversa: `pnpm audit` apontou 40 vulnerabilidades no frontend, das quais 3 críticas e 20 altas — a maioria em `next@15.5.4`, incluindo duas execuções remotas de código não autenticadas já corrigidas rio acima |

---

## 1. Problema

**`next@15.5.4` está 21 versões de patch atrás da série 15.5.x, incluindo duas correções de execução remota de código não autenticada.**

O frontend (`frontend/package.json:13`) fixa `next` em `15.5.4` desde a implantação inicial. Entre essa versão e `15.5.25` (a mais recente da mesma série major, sem saltar para a 16 ainda em canary) o projeto Next.js publicou correções para, entre outras: uma RCE não autenticada em hospedagem Windows, uma RCE não autenticada na API de otimização de imagem ao processar AVIF, múltiplos SSRF em Server Actions e *rewrites*, DoS por exaustão de conexão, e *bypass* de *middleware*.

Isoladamente, isso já seria uma pendência de rotina. O que eleva a prioridade é a hospedagem: as duas URLs do Container Apps (`ca-confere-backend`, `ca-confere-frontend`) estão publicamente acessíveis **sem autenticação** (README §"Hospedagem", "Pendências da hospedagem"). Um serviço sem autenticação, exposto publicamente, rodando um servidor com RCE não autenticada conhecida e corrigida rio acima, é superfície de ataque ativa — não teórica.

## 2. O que foi levantado no código

### 2.1 Compatibilidade de ambiente

`next@15.5.25` exige (`pnpm view next@15.5.25 engines`):

```
node: ^18.18.0 || ^19.8.0 || >= 20.0.0
```

`frontend/Dockerfile:2,19,38` usa `node:20-alpine` nos três estágios — dentro da faixa aceita, nenhuma mudança de imagem base é necessária.

Como *peer dependency* (`pnpm view next@15.5.25 peerDependencies`):

```
react: ^18.2.0 || 19.0.0-rc-... || ^19.0.0
react-dom: ^18.2.0 || 19.0.0-rc-... || ^19.0.0
```

`frontend/package.json` traz `react@^18.3.1` e `react-dom@^18.3.1` — dentro da faixa aceita. **Não é preciso migrar para React 19** para fechar as vulnerabilidades do Next.

`eslint-config-next@15.5.25` exige `eslint: ^7.23.0 || ^8.0.0 || ^9.0.0` e `typescript: >=3.3.1` — o projeto tem `eslint@^8` e `typescript@^5`, também dentro da faixa.

### 2.2 O que o `pnpm audit` aponta hoje

40 vulnerabilidades no total (3 críticas, 20 altas, 15 moderadas, 2 baixas). As que dependem diretamente de `next@15.5.4` e desaparecem com o bump:

| Severidade | Achado | Corrigido em |
|---|---|---|
| Crítica | RCE não autenticada em servidores hospedados no Windows | `>=15.5.24` |
| Crítica | RCE não autenticada na Image Optimization API ao processar AVIF | `>=15.5.24` |
| Crítica | RCE no protocolo React Flight | `>=15.5.7` |
| Alta | DoS em App Router usando Server Actions | `>=15.5.21` |
| Alta | SSRF em Server Actions em servidor customizado | `>=15.5.21` |
| Alta | SSRF em *rewrites* via hostname de destino controlado pelo atacante | `>=15.5.21` |
| Alta | *Bypass* de Middleware/Proxy (App Router, *segment-prefetch*, i18n, parâmetro de rota dinâmica) | `>=15.5.16` a `>=15.5.18` (conforme o achado) |
| Alta | SSRF em upgrades de WebSocket | `>=15.5.16` |
| Alta | *Cache poisoning* em respostas de React Server Component | `>=15.5.16` |
| — | (mais ~8 achados altos/moderados de DoS, exposição de código-fonte de Server Functions e *cache confusion*) | entre `15.5.7` e `15.5.24` |

`next@15.5.25` cobre todos os itens acima — é a versão estável mais recente da série 15.5.x na data desta espec.

### 2.3 O que o bump **não** resolve

`next@15.5.25` fixa `postcss` em `8.4.31` **exato**, igual à versão hoje resolvida em `frontend/pnpm-lock.yaml` — o achado de `postcss` no `pnpm audit` (precisa de `>=8.5.23`) é interno ao próprio pacote `next`, não ao `package.json` do projeto, e **não muda com este bump**. Corrigi-lo exigiria uma sobrescrita (`pnpm.overrides`) forçando uma versão de `postcss` que o `next` não testou — decisão separada, registrada em `I-01`.

`sharp`, `nanoid` e `js-yaml` (achados altos do audit) são dependências de build/desenvolvimento — `sharp` é `devDependency` direta do projeto (`frontend/package.json`), as outras duas são transitivas de ferramental (ESLint/ferramentas de build). Nenhuma roda em produção; não fazem parte do escopo desta espec (`D-03`).

## 3. Objetivo

Atualizar `next` e `eslint-config-next` de `15.5.4` para `15.5.25` — a versão estável mais recente da série 15.5.x —, fechando as duas RCEs críticas e as demais vulnerabilidades altas listadas em §2.2, sem exigir mudança de Node, de React ou do `Dockerfile`.

**Não é objetivo:** migrar para Next 16 (ainda em canary, sem *release* estável — `D-01`), migrar para React 19 (não exigido pelo bump — `D-02`), resolver o `postcss` interno do `next` nem as dependências de build `sharp`/`nanoid`/`js-yaml` (§2.3, `D-03`), ou tratar a ausência de autenticação/rede na hospedagem (pendência distinta, já registrada no README e discutida à parte).

## 4. Escopo

### 4.1 Dentro do escopo

- `frontend/package.json`: `next` e `eslint-config-next` de `15.5.4` para `15.5.25`;
- `frontend/pnpm-lock.yaml`: regenerado por `pnpm install` a partir do `package.json` atualizado;
- validação local: `pnpm install`, `pnpm lint`, `tsc --noEmit`, `pnpm build`, suíte E2E completa (`frontend/e2e`, 127 casos em 16 arquivos — contagem medida em 2026-09-09; o README cita 79, desatualizado) rodada antes **e** depois do bump, e novo `pnpm audit` conferindo que os achados críticos/altos do `next` saem da lista;
- validação de que a imagem Docker (`frontend/Dockerfile`) constrói sem mudança, com o `pnpm-lock.yaml` novo.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Migração para Next 16 | Ainda em *canary*, sem *release* estável — trocaria CVE conhecida por instabilidade não testada (`D-01`) |
| Migração para React 19 | Não exigida pelo *peer dependency* do `next@15.5.25` (§2.1); mudança maior, desnecessária para fechar as CVEs |
| `postcss@8.4.31` (pino interno do `next`) | Não muda com o bump (§2.3); corrigir exige `pnpm.overrides`, decisão separada (`I-01`) |
| `sharp`, `nanoid`, `js-yaml` | Dependências de build/desenvolvimento, não expostas em produção (`D-03`) |
| Autenticação/restrição de rede na hospedagem | Pendência distinta, já registrada no README §"Hospedagem"; discutida em separado |
| Pipeline de CI / auditoria automática de `frontend/pnpm-lock.yaml` no pre-commit | Gap de processo que permitiu esta desatualização passar despercebida; vale uma decisão própria, não faz parte de aplicar o bump |

## 5. Regras

| ID | Regra |
|---|---|
| `R-DEP-01` | `next` e `eslint-config-next` fixam exatamente `15.5.25` (sem `^`/`~`), na mesma convenção de versão exata já usada hoje para as duas entradas — mantém as duas sincronizadas em toda atualização futura |
| `R-DEP-02` | `frontend/pnpm-lock.yaml` é regenerado por `pnpm install` e commitado junto — o build (`pnpm install --frozen-lockfile` no `Dockerfile`) usa o lockfile commitado, nunca resolve versões na hora |
| `R-DEP-03` | `pnpm lint` e `tsc --noEmit` passam sem erro novo antes do commit — regra de lint nova trazida pelo `eslint-config-next` é ajuste pontual, não motivo para reverter a atualização de segurança |
| `R-DEP-04` | `pnpm audit` após a atualização não lista mais as três vulnerabilidades críticas nem as altas específicas de `next` enumeradas em §2.2 |
| `R-DEP-05` | A suíte E2E (`frontend/e2e/`, 127 casos em 16 arquivos) roda **antes** do bump (linha de base, com `next@15.5.4`) e **depois** (com `next@15.5.25`, backend no ar em `http://127.0.0.1:8000`). Nenhum caso que passava antes pode falhar depois — divergência bloqueia a publicação até investigada, mesmo que pareça não relacionada ao Next. Linha de base medida em 2026-09-09: **127/127**, depois de corrigido `T-543` (§12) |

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **Vai para `15.5.25`, não para a última `16.x` (canary)** | Next 16 não tem *release* estável na data desta espec. Adotar uma *canary* num serviço que processa dados de servidores públicos trocaria um risco de CVE conhecido e corrigido por um risco de instabilidade não testada — pior negócio |
| `D-02` | **Mantém React 18, não migra para 19** | `next@15.5.25` aceita as duas como *peer* (§2.1); migrar o React é mudança de escopo maior (possíveis quebras de API, necessidade de re-testar toda a árvore de componentes) e não é pré-requisito para fechar as CVEs do Next |
| `D-03` | **Não mexe em `postcss`/`sharp`/`nanoid`/`js-yaml` nesta entrega** | `postcss` vem fixado *dentro* do `next` (§2.3) — corrigi-lo aqui exigiria sobrescrever uma versão que o próprio Next não testou, risco desproporcional ao ganho, já que o uso é em tempo de build, não de execução. `sharp`/`nanoid`/`js-yaml` são dependências de desenvolvimento, sem exposição em produção. Registrado como pendência aberta (`I-01`), não como bloqueio |

## 7. O que muda no código

| Arquivo | Mudança |
|---|---|
| [`frontend/package.json`](../../frontend/package.json) | `"next": "15.5.4"` → `"15.5.25"` (linha 13); `"eslint-config-next": "15.5.4"` → `"15.5.25"` (linha 26) |
| [`frontend/pnpm-lock.yaml`](../../frontend/pnpm-lock.yaml) | Regenerado por `pnpm install` |
| `frontend/Dockerfile`, `frontend/next.config.mjs`, backend (qualquer arquivo) | **Nenhuma.** Compatibilidade de Node e React já cobre a versão nova (§2.1) |

## 8. Testes e critério de aceite

| Verificação | Como |
|---|---|
| Instalação sem intervenção manual | `pnpm install` não pede aprovação de novo script de build (`pnpm-workspace.yaml` `onlyBuiltDependencies` não muda — `next`/`eslint-config-next` não trazem binário nativo novo) |
| Lint | `pnpm lint` limpo |
| Tipos | `pnpm exec tsc --noEmit` limpo |
| Build | `pnpm build` completa e gera a saída `standalone` |
| Regressão funcional | `pnpm exec playwright test` — suíte completa, 127 casos em 16 arquivos (`frontend/e2e/`), backend no ar — **obrigatória**, comparada contra a linha de base pré-bump (`R-DEP-05`) |
| Vulnerabilidades fechadas | `pnpm audit` não lista mais as 3 críticas nem as altas de `next` enumeradas em §2.2 |
| Build de produção | `docker build` a partir de `frontend/Dockerfile` completa; container sobe e serve a aplicação, que segue chamando a API do backend normalmente (checagem visual do fluxo de upload) |

**Baseline e comparação.** A suíte E2E roda duas vezes: uma **antes** do bump (com `next@15.5.4`, para registrar a contagem de referência) e outra **depois** (com `next@15.5.25`). O critério de aceite não é "a suíte passa" isoladamente — é que o resultado depois seja igual ou melhor que antes, caso a caso: nenhum dos 127 casos que passava antes pode falhar depois. Uma falha nova, mesmo que pareça não relacionada ao Next, bloqueia a publicação até ser explicada (`R-DEP-05`).

A linha de base foi medida em 2026-09-09, ainda com `next@15.5.4`: rodou **127**, com **1 falha** — `T-543` (`e2e/a11y-estrutura.spec.ts:252`), um teste desatualizado desde a ESPEC 031 (o item `14.049.00054.00` deixou de ser crítico naquela espec, e a asserção nunca foi ajustada — não é regressão de aplicação nem efeito deste bump; reproduziu 3/3 em execução isolada, então não é *flakiness*). Corrigido nesta sessão (§12); a suíte volta a fechar **127/127** antes de qualquer mudança no Next entrar.

**Critério de aceite:** todas as verificações acima passam, a suíte E2E fecha **127/127 → 127/127** (linha de base medida em 2026-09-09) sem nenhum caso que passava antes e passou a falhar depois, e o `pnpm audit` pós-atualização não lista nenhuma das vulnerabilidades críticas ou altas hoje atribuídas a `next@15.5.4`.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| 21 versões de patch entre `15.5.4` e `15.5.25` podem incluir mudança de comportamento não anunciada como *breaking* | `R-DEP-05` — suíte E2E completa rodada antes e depois, comparada caso a caso; qualquer novo caso falho bloqueia a publicação até investigado |
| `eslint-config-next@15.5.25` introduzir regra de lint nova que quebre o build | `R-DEP-03` — corrige-se o apontamento pontualmente; não é motivo para adiar a atualização de segurança |
| Alguém rodar `pnpm install` sem `--frozen-lockfile` depois desta entrega, divergindo do lockfile commitado | Já é o padrão do projeto — `frontend/Dockerfile` usa `pnpm install --frozen-lockfile`; nenhuma mudança adicional necessária |
| A RCE crítica ser explorada antes da publicação em produção | A hospedagem hoje está sem autenticação (pendência distinta) — publicar esta atualização o quanto antes reduz a janela de exposição, mesmo sem a pendência de rede resolvida |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | Vale abrir uma decisão separada para sobrescrever `postcss` via `pnpm.overrides`, fechando o achado que este bump não resolve (§2.3)? | Não — `postcss` roda em tempo de build, risco real baixo |
| `I-02` | A pendência de autenticação/rede na hospedagem (README, "Pendências da hospedagem") segue em aberto fora desta espec — mas ela é o que eleva a severidade prática das RCEs enquanto não for resolvida | Não bloqueia esta atualização; é a razão para não adiá-la |
| `I-03` | Vale estender o `pre-commit` (`scripts/git-hooks/pre-commit`) para auditar também `frontend/pnpm-lock.yaml`, hoje só cobre o backend (§4.2)? | Não — gap de processo distinto, decisão própria |
| `I-04` | `T-543` ficou desatualizado por 19 dias (desde a ESPEC 031, 2026-08-20/21) sem que a suíte completa rodasse para expor isso — vale um item de processo para rodar `pnpm exec playwright test` com regularidade, não só quando uma spec de dependência força a medição? | Não bloqueia esta espec — já corrigido (§12); é achado de processo, registrado para decisão à parte |

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Bump de versão em `package.json` e `pnpm install` | PP |
| B | Validação local — lint, tipos, build, `pnpm audit`, suíte E2E rodada duas vezes (linha de base antes do bump, comparação depois — `R-DEP-05`) | PP |
| C | Build da imagem Docker e publicação (`az acr build`, conforme README §"Hospedagem") | PP |

**Estimativa: menos de meio dia** — é atualização de dependência sem mudança de código de aplicação; a maior parte do tempo é validação, não implementação.

## 12. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-09-09 | Redação inicial, a partir da revisão de segurança desta sessão (`pnpm audit` no frontend) |
| 1.1 | 2026-09-09 | Linha de base da suíte E2E medida (`R-DEP-05`): **127 casos em 16 arquivos**, não 79 como o README desatualizado indicava. A primeira medição trouxe 126 passados e 1 falha — `T-543` (`e2e/a11y-estrutura.spec.ts:252`), reproduzida 3/3 isolada (não é *flakiness*). Investigada: o item `14.049.00054.00` deixou de ser crítico na ESPEC 031 (2026-08-20/21), e o commit `90dcd6d` atualizou o teste vizinho (`T-542`) para essa mudança mas esqueceu `T-543`, que ainda exigia o item em duas vistas da tela. Sem relação com este bump. Corrigido: `T-543` passou a exigir uma ocorrência, não duas, com o comentário explicando por que a regra das duas vistas segue válida para itens críticos — só não há, hoje, nenhum no piloto. Suíte volta a fechar 127/127 |
| 1.2 | 2026-09-09 | Bump executado (PLANO 048/TASKS 048). `next`/`eslint-config-next` → `15.5.25`; `pnpm install`, `pnpm lint`, `tsc --noEmit` e `pnpm build` limpos. Primeira tentativa da suíte E2E pós-bump travou aos ~90 min com CPU quase zero e a porta 3000 sem responder — causa: um processo `next dev` órfão de muito antes na sessão, reaproveitado pelo `reuseExistingServer: true` do `playwright.config.ts`, que tinha ficado inconsistente. Sem relação com o bump. Processo encerrado, suíte relançada com servidor limpo: **127/127 em 25,0 min**, nenhum caso perto do limite de 120s — confirma `R-DEP-05`. `pnpm audit`: **40 → 7**, zero críticas, zero achados de `next`/`eslint-config-next` (`R-DEP-04`). Validação de build Docker local (`T-2723`) pendente — Docker Desktop não estava de pé no momento |
| 1.3 | 2026-09-09 | `T-2723` concluída: `docker build -f frontend/Dockerfile` builda limpo (confirma `Next.js 15.5.25` no log); teste de fumaça — container sobe, responde `200` em `/`, encerrado. Portões `P0`-`P3` fechados; commit `50427ed` (`fix(T-2714…2725)`) fecha `TASKS 048`. Publicação em Azure (`az acr build`/`az containerapp update`) segue fora do escopo desta ESPEC, por decisão do `PLANO 048` |
| 1.4 | 2026-09-09 | Publicada em produção, a pedido direto do usuário — fora do `PLANO 048`, que parava no commit local. `az acr build -r acrconferedes -t confere-frontend:v10`: o cliente local do `az` travou ao exibir o log (`UnicodeEncodeError`, `cp1252` do console do Windows não representa um caractere do log), mas o build remoto (`run caj`) seguiu e fechou `Succeeded` — confirmado por `az acr task list-runs`, não pela saída do comando que travou. Tag `v10` publicada no ACR. `az containerapp update -g rg-confere-des -n ca-confere-frontend --image acrconferedes.azurecr.io/confere-frontend:v10` — revisão `v9` → `v10` (`activeRevisionsMode: Single`, sem paralelo). Smoke test em produção: `https://ca-confere-frontend.wittybush-99db4533.eastus.azurecontainerapps.io/` → `200`; `https://ca-confere-backend.wittybush-99db4533.eastus.azurecontainerapps.io/health` → `{"status":"ok"}` |
