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
do dia pode passar de 1min30. **Validar com uma chamada fria real antes de depender disso em
produção.** Se incomodar na prática, o plano pago "Starter" do Render remove o spin-down — upgrade
pontual, não bloqueia começar no free.

### 3.4 Chamada síncrona, sem fila/polling

App interno, baixo volume — não há cenário de concorrência que justifique um pipeline
assíncrono (status `processando` → polling). O botão "gerar relatório" chama a rota do VerAI, que
chama o Confere e espera a resposta (~30s + eventual cold-start do Render).

Isso é seguro no Vercel: **correção em relação ao que se pensava antes** — com Fluid compute
(padrão em todo projeto Vercel hoje), a duração padrão de uma function já é 300s mesmo no plano
Hobby, não é preciso Pro só por causa da duração. A rota que chama o Confere deve declarar
`maxDuration` explícito (ex.: 120) para ter folga sobre cold-start + geração.

### 3.5 Segurança: segredo compartilhado, com uma pequena adição ao Confere

Como o Confere fica publicamente alcançável (Render não tem IP fixo de saída do lado do VerAI para
allowlist funcionar), a proteção é um header secreto verificado antes de processar qualquer
requisição. Isso exige uma pequena adição ao `main.py` do Confere (um middleware, no mesmo padrão
do `_cabecalhos_de_seguranca` que já existe ali) — é a única exceção deliberada a "não mexer no
Confere": é aditiva, não toca nenhuma regra de negócio nem teste existente, e é necessária porque
não há VM/proxy dedicado para fazer essa checagem por fora.

Motivo: o relatório gerado carrega nome/e-mail de servidor público, e o Confere sobe sem
autenticação por design (documentado como pendência de negócio do próprio Confere).

### 3.6 Onde entra no domínio do VerAI: nova aba, não área nova

Vira uma quarta aba em `src/app/clientes/[id]/[competencia]/page.tsx` (tipo `Aba`, array `TABS`),
ao lado de "Relatório consolidado" e "Relatório de evolução" — não uma área de navegação nova
(descartada a ideia inicial de espelhar `propostas-comerciais`). Um novo model no Prisma, ligado a
`Cliente` + competência (mesmo formato de `AnaliseConsolidada`/`AnaliseEvolucao`), guarda os
arquivos de entrada (contrato PDF + planilha XLSX), os dois de saída (docx + xlsx) e um status que
reflete o retorno do próprio Confere (concluído / bloqueado — ele já devolve 422 quando bloqueia).

A rota de geração segue o mesmo padrão das três rotas `/relatorio` existentes (campo
`caminhoRelatorioPdf`-like de cache, `putUpload`/`getUpload`, registro em `AcessoDocumento`), só
que em vez de renderizar localmente, faz `fetch` multipart para o Confere e decodifica o base64 que
volta.

O endpoint `POST /reports/conferencia-previa` do Confere (checagem rápida de identidade do par
contrato/planilha, ~0,9s) pode virar um passo de confirmação na UI antes de disparar a geração
pesada — o Confere já foi desenhado para ser usado assim.

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
