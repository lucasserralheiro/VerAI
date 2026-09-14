---
description: Roda testes, build de produção e sobe as mudanças pro Vercel (git push + deploy)
---

# Deploy pra produção (VerAI)

Roteiro testado nesta sessão. Siga na ordem — cada passo existe por causa de um problema real que já aconteceu (comentado). Pare e avise o usuário sempre que um passo pedir autorização explícita; não pule silenciosamente.

## 1. Ver o que mudou

```
git status --short
```

**Nunca** inclua a pasta `_to_delete/` (se existir) num commit — é lixo/backup solto no projeto, não faz parte do código. Ao dar `git add`, liste os arquivos explicitamente ou use `git add -A -- . ':(exclude)_to_delete'`.

## 2. Testes

```
npx jest
```

`src/lib/copiarMarkdownFormatado.test.ts` (7 testes) falha por um gap de ambiente pré-existente, sem relação com mudança nenhuma — `Blob.prototype.text()` não implementado no jsdom deste projeto. **Ignore só essa suíte especificamente.** Qualquer OUTRA suíte falhando precisa ser investigada e corrigida antes de continuar — nunca empurre teste quebrado pra produção.

## 3. Build de produção

Antes de rodar o build, confira se há um `npm run dev` ativo — ele prende o `.dll` do Prisma Client e o `prisma generate` quebra com `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`.

```
tasklist | grep -i node
```

Se houver processo de dev rodando, pare (`Stop-Process` no PowerShell, ou `taskkill //F //PID <pid>`), rode o build, e **lembre de reiniciar o dev depois** (`npm run dev` em background — `run_in_background: true`).

```
npm run build
```

(= `prisma generate && next build --turbopack`.) Tem que compilar limpo, sem erro de tipo nem de lint. Não prossiga se falhar.

## 4. Migração de banco pendente?

```
git diff --stat main^..main -- prisma/schema.prisma prisma/migrations
```

Se `schema.prisma` ou algo em `prisma/migrations/` mudou nesta leva de commits, **PARE e pergunte ao usuário antes de aplicar em produção** — rodar `prisma migrate deploy` contra o banco de produção é uma ação que pede autorização explícita a cada vez, mesmo quando a migração parece segura (aditiva, `IF NOT EXISTS`). Pular esse passo silenciosamente é como o app já quebrou uma vez: rota dando 500 (`P2022: column does not exist`) porque o build da Vercel só roda `prisma generate` (client), nunca `prisma migrate deploy` (banco de verdade) sozinho.

Se autorizado:

```
npx vercel env pull /tmp/prod.env --environment=production --yes
```

Bash:
```
set -a && source /tmp/prod.env && set +a && npx prisma migrate deploy
```

Apague `/tmp/prod.env` logo depois — tem a connection string do banco de produção em texto puro.

## 5. Commit e push

Comite só os arquivos relevantes (nunca `_to_delete/`), com mensagem explicando O QUÊ mudou e POR QUÊ (não só "fix bug") — termine com as linhas de atribuição de commit do sistema desta sessão.

```
git push origin main
```

## 6. Deploy

```
npx vercel --prod --yes
```

Builda remotamente na própria Vercel e promove pra produção — mais garantido que só confiar no auto-deploy do GitHub, que pode demorar ou (raro) falhar silenciosamente sem avisar aqui.

## 7. Fumaça (smoke test) — obrigatório, não pule

Deploy "Ready" não significa "funciona". Bata numa rota real depois do deploy:

```
curl -s -c /tmp/cookies.txt -X POST https://verai-virid.vercel.app/api/auth/dev-login \
  -H "Content-Type: application/json" -d '{"token":"<DEV_AUTH_TOKEN — pergunte ao usuário se não tiver>"}'
curl -s -b /tmp/cookies.txt https://verai-virid.vercel.app/api/propostas-comerciais
```

Nunca escreva o valor real de `DEV_AUTH_TOKEN` num arquivo do repositório — é um bypass de senha em produção; pergunte ao usuário na hora ou leia de onde ele já estiver disponível na sessão. Apague `/tmp/cookies.txt` no final.

## 8. Avisar

Resuma pro usuário: o que mudou, o que foi testado (e o que ficou de fora, tipo `copiarMarkdownFormatado`, e por quê), se precisou de migração, e o link do deploy. Nunca declare "está funcionando" sem ter batido numa rota de verdade no passo 7.
