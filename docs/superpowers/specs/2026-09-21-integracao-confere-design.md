# Integração do Confere no VerAI (design)

**Status**: Em discussão — decisões de arquitetura fechadas, detalhamento de código pendente.
**Data**: 21/09/2026

---

## 1. Objetivo

Trazer o **Confere** — sistema Python/FastAPI mantido pela PRODAM, que compara o que foi
**contratado** (contrato em PDF) com o que foi **medido** (planilha de medição em XLSX) e gera um
relatório de comprovação (`.docx` timbrado) + uma análise por gravidade (`.xlsx`) — para dentro do
VerAI, como uma nova aba na página de cliente/competência, **sem alterar a lógica de negócio do
Confere**.

O Confere já é maduro (56 specs, mais de 100 arquivos de teste, dois contratos reais validados) e
já roda como serviço HTTP sem estado, sem banco e sem autenticação (por design — ver
`services/confere/docs/passagem-conhecimento/visao-de-negocio-confere.md` depois do import via
subtree). Nada disso muda.

## 2. Contexto

O VerAI já tem um domínio de "relatório" maduro (três rotas `/relatorio` funcionando — ver
`CLAUDE.md`), mas nenhum domínio equivalente a "contrato × medição". A página
`src/app/clientes/[id]/[competencia]/page.tsx` já mostra, para um cliente numa competência, três
abas: Documentos, Relatório consolidado (`AnaliseConsolidada`) e Relatório de evolução
(`AnaliseEvolucao`) — ambas ligadas a `Cliente` + competência (ano/mês), no mesmo formato que o
Confere precisa.

## 3. Decisões

### 3.1 O Confere não muda — nem código, nem stack

Ele continua Python/FastAPI, chamado como serviço HTTP externo (`POST /reports` e
`POST /reports/conferencia-previa`, já existentes). O VerAI só orquestra a chamada e guarda o
resultado. Razão: o Confere tem um renderizador de `.docx` (manipulação fina de OOXML — bordas,
células mescladas, 19 anexos derivados de planilha) que é caro e arriscado de reescrever, e uma
malha de regras de negócio (aditivos em sequência, desconto de desenvolvimento, identidade do par
contrato/planilha) já validada em produção. Reescrever isso em TypeScript teria custo/risco alto
sem ganho correspondente.

### 3.2 Monorepo — cópia direta, não `git subtree`

**Correção em relação ao que se pensava antes**: o plano original era importar via `git subtree`
para preservar o histórico de commits do Confere. Na hora de executar (Task 1), verificamos que
`confere-main` **não era um repositório git** — era só uma pasta local, sem `.git`. Não havia
histórico de commits a preservar, então `git subtree` não se aplicava.

O código entrou em `services/confere/` por cópia direta + um commit único
(`abb0cdd feat: importa o Confere (Python/FastAPI) para services/confere/`, 21/09/2026). Isso não é
uma perda: a documentação de decisões (56 specs, plans, tasks, CHANGELOG) continua intacta nos
próprios arquivos — o valor daquele histórico sempre esteve no conteúdo escrito, não em commits do
git. Segue sendo só organização de código-fonte: não muda como o Confere roda (continua um deploy
separado, em `services/confere/backend`).

### 3.3 Hospedagem: Render (free tier), Docker, sem VM própria

VerAI está no Vercel (serverless — não hospeda processo Python persistente). Sem VM própria
disponível para o Confere. Solução: subir o `Dockerfile` que o Confere já tem, sem modificar, como
Web Service no **Render**, plano gratuito (512 MB RAM, suporta Docker, variáveis de
ambiente/segredos — suficiente para o volume de uso interno esperado).

**Risco conhecido e aceito por ora**: o plano free do Render desliga o serviço após 15 min de
inatividade e leva ~1 min para acordar. Somado aos ~30 s de geração do Confere, a primeira chamada
do dia pode passar de 1min30. Se incomodar na prática, o plano pago "Starter" do Render remove o
spin-down — upgrade pontual, não bloqueia começar no free.

**Status (2026-09-21): implantado e validado.** Deploy em `https://confere-backend.onrender.com`
(Docker, Root Directory `services/confere/backend`, source commit `c851c60`). `GET /health` e o
bloqueio via `X-Confere-Secret` (`POST /reports` sem header → 401) confirmados em produção, fora
dos ambientes de automação (cujo allowlist de rede bloqueia `onrender.com`). **Medido em
24/09/2026**: ~23 s de despertar (`/health` depois de 15+ min parado) — e a geração em si é bem
mais lenta do que se supunha aqui, 69–134 s. Ver o adendo "o 504 de 24/09/2026" no fim.

### 3.4 Chamada síncrona, sem fila/polling

App interno, baixo volume — não há cenário de concorrência que justifique um pipeline
assíncrono (status `processando` → polling). O botão "gerar relatório" chama a rota do VerAI, que
chama o Confere e espera a resposta (~30s + eventual cold-start do Render).

Isso é seguro no Vercel: **correção em relação ao que se pensava antes** — com Fluid compute
(padrão em todo projeto Vercel hoje), a duração padrão de uma function já é 300s mesmo no plano
Hobby, não é preciso Pro só por causa da duração. A rota que chama o Confere deve declarar
`maxDuration` explícito (ex.: 120) para ter folga sobre cold-start + geração.

**Correção (24/09/2026):** o raciocínio acima se contradiz — se o padrão já é 300 s, declarar 120
*reduz* o prazo. Foi a causa do 504 de produção. Ver o adendo "o 504 de 24/09/2026" no fim.

### 3.5 Segurança: segredo compartilhado, com uma pequena adição ao Confere

Como o Confere fica publicamente alcançável (Render não tem IP fixo de saída do lado do VerAI para
allowlist funcionar), a proteção é um header secreto verificado antes de processar qualquer
requisição. Isso exige uma pequena adição ao `main.py` do Confere (um middleware, no mesmo padrão
do `_cabecalhos_de_seguranca` que já existe ali) — é a única exceção deliberada a "não mexer no
Confere": é aditiva, não toca nenhuma regra de negócio nem teste existente, e é necessária porque
não há VM/proxy dedicado para fazer essa checagem por fora.

Motivo: o relatório gerado carrega nome/e-mail de servidor público, e o Confere sobe sem
autenticação por design (documentado como pendência de negócio do próprio Confere).

### 3.6 Onde entra no domínio do VerAI — histórico da decisão (revista em 3.7)

**Versão original (implementada nas Tasks 4 e 5, do mesmo dia — depois removida, ver 3.7):** virou
uma quarta aba em `src/app/clientes/[id]/[competencia]/page.tsx` (tipo `Aba`, array `TABS`), ao
lado de "Relatório consolidado" e "Relatório de evolução" — não uma área de navegação nova
(descartada, então, a ideia inicial de espelhar `propostas-comerciais`). Um model no Prisma,
ligado a `Cliente` + competência (mesmo formato de `AnaliseConsolidada`/`AnaliseEvolucao`), guardava
os arquivos de entrada (contrato PDF + planilha XLSX), os dois de saída (docx + xlsx) e um status
que refletia o retorno do próprio Confere (concluído / bloqueado — ele já devolve 422 quando
bloqueia). Decisão tomada na hora com o usuário: os arquivos de entrada seriam upload **dedicado**
dessa análise — não reaproveitariam o model `Documento` (que já carrega o pipeline de análise por
IA, semântica diferente). Modelo final daquela versão: `AnaliseMedicaoContratual` +
`AnaliseMedicaoContratualArquivo`, com `resultado Json?` guardando a `RespostaRelatorio`
estruturada do Confere e `achadosBloqueio Json?` para o caso bloqueado. A rota de geração
(`/api/clientes/[clienteId]/competencias/[competencia]/analise-medicao`) seguia o mesmo padrão de
cache/storage das três rotas `/relatorio` existentes, com `fetch` multipart pro Confere em vez de
renderizar localmente. Cada `POST` sobrescrevia o estado da competência (upsert único por
`clienteId`+competência): sempre a tentativa mais recente, sem histórico de tentativas anteriores.

**Essa versão foi revertida no mesmo dia** — ver 3.7 pra decisão atual e o porquê da mudança.

### 3.7 Revisão (2026-09-21, mesmo dia): cópia solta do Confere, sem vínculo com cliente, porta de entrada do sistema

O usuário pediu, em sequência, três mudanças que juntas revertem a decisão da 3.6:

1. *"vamos deixar logo de cara em vez de clientes e etc... vamos deixar a pagina logo do confere
   ai"* — o Confere deixa de ser um passo dentro do fluxo de cliente e vira a tela que abre quando
   o VerAI abre.
2. *"nao vamos vincular a cliente e nada do tipo"* — sem `clienteId`, sem competência, sem
   `AnaliseMedicaoContratual` nenhuma.
3. *"ele precisa ficar a copia do confere ai do mesmo jeito"* / *"precisa ficar assim"* (com print
   do frontend de verdade do Confere, hospedado à parte em
   `https://ca-confere-frontend.wittybush-99db4533.eastus.azurecontainerapps.io`) — não uma tela
   redesenhada no estilo institucional do VerAI: o mesmo texto, o mesmo layout, a mesma paleta do
   app original.

**O que isso implicou, na prática:**

- **Cópia literal do frontend do Confere.** `services/confere/frontend/src/app/{page,layout}.tsx` +
  `components/*` + `lib/{types,documento}.ts` foram copiados quase byte a byte pra
  `src/app/confere/` — só caminhos de import mudaram (`@/lib/X` → relativo) e as classes de cor
  ganharam o prefixo `confere-` (`src/app/globals.css`, tokens `--color-confere-*`), porque a
  paleta do Confere (`teal`/`navy` como escala 50–800, `severidade-*`, `brand-*`, `prodam-*`) não
  existe no VerAI e o nome `navy` já tem outro significado lá (cor única, não escala). Os
  comentários originais (ESPEC/TASKS, decisões de acessibilidade) foram preservados — documentam
  por que o código é como é, mesmo citando um repositório diferente do VerAI.
- **`lib/api.ts` muda só o `API_BASE_URL`** — de `NEXT_PUBLIC_API_URL` (apontando pro Confere
  direto) para `/api/confere` (rota própria do VerAI). O resto do arquivo — timeouts, extração de
  blob, tratamento de 422 com/sem `bloqueantes` — é idêntico ao original, porque o contrato da
  nova rota é o contrato do Confere, repassado sem alteração.
- **Proxy sem estado** (`src/app/api/confere/reports/route.ts`): recebe o multipart, chama
  `chamarConfere()` (`src/lib/confere/cliente.ts`, de Task 5 — reaproveitado sem mudanças) e
  devolve a resposta dele quase crua (200 com o relatório completo, 422 com `bloqueantes`,
  qualquer outra coisa vira `{ detail }`). **Não grava nada** — nem banco, nem Vercel Blob: a
  aplicação portada é sem estado, como o Confere original (ver comentário de `urlDoDocumento` em
  `lib/api.ts` — "o backend os embute na resposta porque a aplicação é sem estado").
- **`POST /reports/conferencia-previa` (Task 6) continua sem endpoint próprio no VerAI** — decisão
  mantida. `conferirIdentidade()` (em `src/app/confere/lib/api.ts`) chama
  `/api/confere/reports/conferencia-previa`, que não existe: dá 404, e o código já trata isso como
  falha aberta (`R-IDT-12` no comentário original) — segue pra geração sem perguntar. Funcional,
  só sem o atalho de ~0,9s que evita rodar a geração completa quando os documentos já divergem
  visivelmente. Fica como próximo passo natural se algum dia importar.
- **Reversão completa da 3.6**: migração
  `prisma/migrations/20260921160000_remove_analise_medicao_contratual/` derruba as duas tabelas;
  `AnaliseMedicaoContratual`/`AnaliseMedicaoContratualArquivo` saíram do `schema.prisma`; a rota
  antiga (`/api/clientes/[clienteId]/competencias/[competencia]/analise-medicao`) e a aba
  "Medição contratual" dentro de `clientes/[id]/[competencia]/page.tsx` foram removidas por
  completo (com os testes correspondentes).
- **Porta de entrada**: `src/middleware.ts` (redirect de rota admin negada) e os dois formulários
  de login (`src/app/login/{login-form,dev-login-form}.tsx`) apontam pra `/confere` em vez de
  `/clientes`. `src/components/nav-bar.tsx` ganhou um link "Confere" solto, fora do grupo
  "Relatórios" (não é sub-item de nada — é a primeira coisa no menu), e a marca no topo da barra
  lateral também passou a levar pra `/confere`.

## 4. Fora de escopo / pendente

- Nome exato do model Prisma e dos campos — detalhar na hora de escrever o plano de implementação.
- Schema exato da resposta do Confere (`RespostaRelatorio`, em
  `services/confere/backend/src/api/schemas.py`, depois do import) — ler antes de implementar a
  rota.
- Decisão final sobre manter `confere-main` como pasta separada por um tempo (backup) antes de
  arquivar, após o `git subtree add`.
- Validação real de cold-start no Render antes de considerar isso pronto para produção.

## 5. Referências

- Visão de negócio do Confere: `services/confere/docs/passagem-conhecimento/visao-de-negocio-confere.md`
  (após o import — hoje em `confere-main/docs/passagem-conhecimento/`)
- Rotas de relatório existentes no VerAI: `src/app/api/documentos/[id]/relatorio/route.ts` e as
  duas equivalentes de `analises-consolidadas`/`analises-evolucao`
- Página onde a aba nova entra: `src/app/clientes/[id]/[competencia]/page.tsx`

---

## Adendo — histórico do ConfereAI (2026-09-21, fim do dia)

A §3.7 decidiu **sem persistência**, e essa decisão continua valendo para a *geração*: o Confere é
um serviço sem estado, o proxy não guarda os arquivos de entrada e a tela não tem sessão. O que foi
acrescentado depois, a pedido explícito do usuário — *"vamos colocar o histórico do confereai igual
os outros"* — é um **registro do que passou pela ferramenta**, no mesmo formato de grupo de menu da
Proposta Comercial.

**O que é guardado** (escopo definido pelo usuário: *"só o título dos documentos inseridos, e a
saída dele processado"*):

- o **nome** do contrato, do levantamento e de cada aditivo, na ordem de aplicação;
- os **dois documentos gerados** (DOCX e XLSX), no Vercel Blob.

**O que não é guardado**: os arquivos de entrada, a referência do contrato, a competência, o placar
de divergências e o usuário que gerou. Nada disso foi pedido, e cada campo a mais é um campo a
manter — o registro existe para reencontrar e rebaixar, não para consultar resultado.

**Decisões:**

- **`model ConfereExecucao`, sem relação com `Cliente` nem competência** (migração
  `20260921180000_add_confere_execucao`). É a mesma razão da §3.7: `/confere` é ferramenta solta, e
  amarrar o histórico a cliente reintroduziria pela porta dos fundos o vínculo que a primeira versão
  removeu.
- **A gravação vive no proxy** (`src/app/api/confere/reports/route.ts`), no caminho de sucesso e só
  nele. Envio bloqueado por validação (422) não vira linha: não houve relatório.
- **Best-effort, com `await`.** O relatório já está no corpo da resposta quando a gravação começa —
  derrubar a entrega por falha de storage cobraria de novo os ~25s por causa de um registro que é
  conveniência. A falha vai para o log. O `await` é necessário apesar disso: numa função serverless
  a resposta encerra a invocação, e trabalho pendente depois dela pode ser cortado no meio, o que
  faria o histórico gravar *às vezes* — pior que não gravar.
- **O `id` é gerado antes do `create`** (`randomUUID`), porque o caminho no Blob depende dele e as
  duas colunas de caminho são obrigatórias. Criar a linha vazia para atualizar depois deixaria
  registro pela metade se o segundo upload falhasse.
- **O download passa por rota própria** (`/api/confere/execucoes/[id]/arquivo?tipo=docx|xlsx`), e
  não por redirecionamento para a URL pública do Blob: é o que permite exigir sessão e devolver o
  `Content-Disposition` com nome derivado do contrato. O caminho no storage é posicional
  (`relatorio.docx`), então sem o cabeçalho toda execução baixaria com o mesmo nome — a mesma
  preocupação da `R-ACE-19`.
- **Excluir apaga os blobs antes da linha**, para não deixar arquivo órfão no bucket sem nada no
  banco apontando para ele.
- **Todos veem tudo**, como no histórico da Proposta Comercial: o registro é do que passou pela
  ferramenta, não de quem passou.

## Adendo — remoção da marca própria (2026-09-21)

A barra de aplicação da ESPEC 007 (logo `/logo-confere.png` + assinatura *"Confere o contratado. /
Confere o utilizado."*) e o rodapé institucional da ESPEC 006 foram removidos da porta portada.
Os dois existiam porque o Confere era uma aplicação solta, com identidade própria; dentro do VerAI
a identificação é a barra lateral, e repetir marca no topo e no rodapé custava ~180 px de altura
útil em 1366×768 — além de o PNG do logo não existir neste deploy, o que rendia caixa de imagem
quebrada no topo de toda visita.

`Barra.tsx`, `Rodape.tsx` e `public/logo-confere.png` foram apagados. A tela abre com um `<h1>` de
texto no padrão institucional (necessário também porque o link "Pular para o conteúdo" precisa de
um destino com título). O que a barra tinha de informação real — referência do contrato e
competência (`R-CAB-05`/`R-CAB-06`) — passou para o cartão "Relatório gerado" do `ResultadoPanel`,
onde o dado nasce.

## Adendo — o 504 de 24/09/2026 (orçamento de tempo do proxy)

**Sintoma.** Gerar o relatório com um contrato real (PC-CGM-240603-82 + aditivo PA-CGM-250912-127
+ levantamento CGM de 08/2026) terminava, em produção, em *"Falha no processamento (HTTP 504)."*

**Causa raiz, medida.** A §3.4 supôs ~30 s de geração e mandou declarar um `maxDuration` "com
folga" (120). As duas suposições estavam erradas:

- No Render free (0,1 CPU) o Confere é de 3 a 6 vezes mais lento que no Container Apps onde os
  22,8 s foram medidos. Chamando o serviço direto, com o serviço **já acordado**: **69 s** no piloto
  (conjunto B, sem aditivo) e **132–134 s** no contrato CGM com 1 aditivo (duas medições). O
  despertar soma **~23 s**.
- Com Fluid compute (ligado neste projeto, plano Hobby — conferido pela API da Vercel), o padrão
  **já é** 300 s, que é também o teto do Hobby. Declarar 120 *reduziu* o prazo: a Vercel matava a
  função aos 120 s e devolvia o 504 dela (`FUNCTION_INVOCATION_TIMEOUT`, corpo em texto). Sem
  `detail` no corpo, `api.ts` caía na mensagem genérica com o código cru.

O log de runtime da Vercel no Hobby dura ~1 h: o POST que deu o 504 já não aparecia quando a
investigação começou. A causa foi reconstruída pela medição direta no Render com os mesmos
arquivos, pela documentação da Vercel e pelo código — o proxy nunca devolve 504 sozinho.

**Correção — orçamento em cadeia, cada elo desiste antes do de fora:**

| Elo | Teto | Por quê |
|---|---|---|
| Rota do proxy | `maxDuration = 300` | teto do Hobby; acima disso o deploy é recusado |
| Chamada ao Confere | o que sobrar de 300 s, menos 30 s | a folga cobre o histórico (2 uploads + 1 insert) e o envio dos ~5 MB; estourou → `tempo-esgotado` → **504 com `detail`** |
| Navegador | 310 s | precisa esperar **mais** que o proxy para receber a resposta dele; fica só para conexão pendurada |

- `chamarConfere` ganhou `tempoLimiteMs` (`AbortSignal.timeout`, que cobre também a leitura do
  corpo) e o resultado `tempo-esgotado`. Também deixou de aceitar um 200 com corpo ilegível como
  sucesso: a tela leria os base64 de `null`, a promessa rejeitaria sem tratamento e o modal de
  progresso ficaria aberto para sempre.
- `api.ts`: erro **sem** `detail` vem da plataforma (o proxy e o Confere sempre mandam um); 504 e
  413 viram frases que dizem o que houve e o que fazer. Desvio consciente da cópia fiel: o frontend
  original não tinha uma função serverless no meio do caminho.
- Testes: `src/lib/confere/cliente.test.ts`, `src/app/api/confere/reports/route.test.ts` (inclui a
  regressão: o orçamento do Confere cabe no pior caso medido, ≥ 160 s, e acaba ≥ 20 s antes do
  `maxDuration`) e `src/app/confere/lib/api.test.ts` (novo).

**O que continua em aberto:**

- **Folga fina no plano free.** 134 s + 23 s de despertar cabem nos 270 s, mas um contrato com mais
  aditivos, ou duas gerações ao mesmo tempo (0,1 CPU dividido — e uma geração abandonada continua
  ocupando o serviço até o fim), passam. O `Starter` do Render (0,5 CPU, sem hibernação) é o que
  resolve de verdade. Decisão de custo, do usuário.
- **Resposta de ~5 MB × limite de 4,5 MB da Vercel.** As duas respostas medidas têm ~5,1 MB por
  causa dos dois base64. A Vercel limita o corpo de resposta de função a 4,5 MB
  (`FUNCTION_RESPONSE_PAYLOAD_TOO_LARGE`), mas resposta em streaming não tem esse limite, e
  streaming é o padrão de toda função Node.js em conta Hobby desde 08/07/2024 (changelog da
  Vercel). Improvável que bata — a prova final é o primeiro teste real depois do deploy. Se
  aparecer *"Falha no processamento (HTTP 500)"*, é isso, e o caminho é devolver os dois
  documentos por URL (o histórico já os guarda) em vez de base64.
- **Envio acima de 4,5 MB.** O mesmo limite vale para o corpo da requisição: contrato + levantamento
  + aditivos somando mais de 4,5 MB recebem 413 da Vercel antes de chegar ao código (a tela agora
  explica). Resolver de verdade é upload direto ao Blob, como o repositório de documentos faz.
- **Painel de progresso** calibrado nos ~25 s do piloto no Container Apps. Não mente (regra 3 do
  componente), mas estima curto no plano free; recalibrar depois de decidir o plano do Render.
- **Vercel Blob suspenso (achado da mesma investigação).** O teste de ponta a ponta local gerou o
  relatório, mas o histórico não gravou: `Vercel Blob: This store has been suspended`. A API da
  Vercel mostra o store `verai-uploads` (o mesmo em dev e produção) como
  `limits-exceeded-suspended`, com ~1,03 GB, acima da cota de 1 GB do Hobby; leitura pública dos
  arquivos dá 403. A geração do ConfereAI não depende do Blob e segue funcionando — o histórico e
  os downloads de execuções antigas, sim. O problema é do VerAI inteiro (tudo que passa por
  `putUpload`/`abrirUpload` fora do R2), não só do ConfereAI. No Hobby, estourar a cota **suspende
  o Blob por 30 dias** — apagar arquivo não destrava antes; só o Pro. 87% do store (890,6 MB, 790
  arquivos) são as cópias antigas de PDF do histórico (`historico-contrato/`), que
  `scripts/migrar-sharepoint-lugar-certo.ts --apagar-copias` já prevê apagar depois do deploy do
  main e da sincronização. **Decisão do usuário (25/09/2026): os uploads vão para o R2** (o
  projeto já o usa para o SharePoint, com 10 GB) — a desenhar e planejar à parte.
