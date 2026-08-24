# Login por token e "Simular usuário" no header (modo DEV_AUTH)

## Contexto

O app já tem autenticação de verdade: `src/lib/auth.ts` (JWT em cookie httpOnly
`token-verai`, senha com bcrypt), `POST /api/auth/login` com email+senha, e
`src/middleware.ts` protegendo rotas por sessão e por `role` (`uploader | responsavel |
admin`). `prisma/seed.ts` hoje só cria um usuário `admin`.

Para acelerar o dia a dia de desenvolvimento e o período de teste do MVP, entrar sempre com
email+senha e trocar de conta pra ver como a tela fica para um `uploader` ou `responsavel` é
lento — hoje isso exige logout/login manual toda vez.

Este spec cobre dois recursos, ambos temporários (existem só enquanto um modo de
desenvolvimento estiver ligado, ver "Gate de ambiente"):

1. Login por token na tela `/login`, que entra direto como o admin semeado.
2. Um seletor no header que troca a sessão atual para a de outro usuário real do banco
   ("ver como"), sem precisar sair e logar de novo.

## Fora de escopo

- Qualquer mudança no fluxo de login por email+senha em si (continua existindo e funcionando
  igual, é só escondido da tela `/login` enquanto o modo dev estiver ligado).
- Impersonação em produção real — o design assume que o recurso desliga antes disso (ver
  gate de ambiente).
- Encadear simulações (simular um usuário e, a partir dele, pular direto pra outro sem voltar
  pro admin) — decidido que não, ver "Sessão e impersonação".
- Revisão visual do header em si (cores, espaçamento) além de encaixar os novos elementos nos
  padrões já usados (pill, sem sombra, raio modesto) — ajuste fino de estilo fica pra quando o
  componente for implementado, seguindo o que já existe no restante da nav.

## Gate de ambiente

Duas variáveis novas, documentadas em `.env.example` (sem valor real commitado):

```
DEV_AUTH_ENABLED=      # "1" liga o modo dev; vazio/ausente = desligado (produção real)
DEV_AUTH_TOKEN=        # ex: verai_2026 — token aceito pelo login-por-token
```

Um novo módulo `src/lib/dev-auth.ts` concentra:
- `devAuthEnabled()` — lê `DEV_AUTH_ENABLED`.
- `IMPERSONATOR_COOKIE_NAME` — nome do cookie que guarda o admin original durante uma
  simulação (ver abaixo).

Nenhum outro arquivo lê `process.env.DEV_AUTH_ENABLED`/`DEV_AUTH_TOKEN` diretamente — tudo
passa por esse módulo, para manter um único ponto de verdade.

Quando `DEV_AUTH_ENABLED` estiver ausente/`0`: a tela `/login` mostra só o formulário
email+senha de sempre, o header não mostra nenhum seletor, e todas as rotas novas (abaixo)
respondem 403/404 recusando a ação.

## Login por token

- Nova rota `POST /api/auth/dev-login`, ao lado de `POST /api/auth/login`. Corpo
  `{ token: string }`.
  - Se `!devAuthEnabled()` ou `token !== DEV_AUTH_TOKEN`: `401` com mensagem genérica
    ("token inválido"), sem indicar se o modo dev está ligado ou não.
  - Busca o usuário com `role: 'admin'` no banco (assume que existe, via seed). Se não achar,
    `500` com mensagem orientando rodar o seed.
  - Cria a sessão do mesmo jeito que o login normal (`criarSessao`, mesmo cookie
    `token-verai`, mesmos atributos) e responde com os dados do usuário — mesmo formato de
    `POST /api/auth/login`.
- `src/app/login/page.tsx` vira **server component**: lê `devAuthEnabled()` direto (sem round
  trip de fetch, sem flash do formulário errado) e renderiza:
  - `DEV_AUTH_ENABLED` ligado → só um campo de token + botão "Entrar" (chama
    `dev-login`). Substitui a tela inteira — formulário email+senha some enquanto o modo
    estiver ligado.
  - Desligado → o formulário email+senha atual, sem nenhuma mudança de comportamento.
  - A parte interativa de cada formulário fica em client components próprios (`login-form.tsx`
    e um novo `dev-login-form.tsx`); o restante da página (branding, layout) continua como
    está hoje.

## Sessão e impersonação ("Simular usuário")

A troca é uma **sessão real**, não uma troca visual: o cookie `token-verai` passa a conter o
JWT do usuário simulado, então toda a lógica de permissão que já existe (middleware,
`clientesPermitidos` por usuário, etc.) funciona sem nenhuma mudança — o que aparece na tela
é exatamente o que aquele usuário veria.

Um segundo cookie httpOnly, `dev-impersonando` (nome vindo de
`IMPERSONATOR_COOKIE_NAME`), guarda o id do admin original só enquanto uma simulação está
ativa. Mesmos atributos de segurança do cookie de sessão (httpOnly, `secure` em produção,
`sameSite: lax`), mesmo `maxAge` de 8h.

Duas rotas novas, **não** listadas em `PUBLIC_API_PREFIXES` — o middleware já exige uma
sessão válida pra chegar nelas:

- `POST /api/dev-auth/switch { userId: string }`
  - `403` se `!devAuthEnabled()`.
  - `403` se a sessão atual não for `role === 'admin'`.
  - `403` se o cookie `dev-impersonando` já estiver presente (só o admin de verdade troca;
    não dá pra pular de um usuário simulado direto pra outro — precisa voltar pro admin
    primeiro).
  - Busca o `userId` alvo; `404` se não existir.
  - Troca `token-verai` pela sessão do usuário alvo e grava `dev-impersonando` com o id do
    admin original.
- `POST /api/dev-auth/restore`
  - `403` se `!devAuthEnabled()`.
  - `403` se `dev-impersonando` não estiver presente (não há simulação ativa pra desfazer).
  - Restaura `token-verai` para a sessão do admin original (lido do cookie) e apaga
    `dev-impersonando`.

## Status para a UI

`GET /api/auth/dev-status` (rota pública, precisa funcionar tanto na tela de login sem
sessão quanto no header já logado):

```
{
  enabled: boolean,
  impersonating: boolean,
  users: Array<{ id, nome, email, role }>  // só preenchido quando enabled && sessão atual
                                            // é admin real (não impersonando); lista só
                                            // usuários uploader/responsavel
}
```

## Header (nav-bar)

`NavBar` (`src/components/nav-bar.tsx`) passa a buscar `/api/auth/dev-status` junto do
`/api/auth/me` que já existe hoje. Três estados, perto do bloco de Sair/Configuração:

1. **`enabled: false`** — nada muda, zero rastro visual.
2. **Admin real, `impersonating: false`** — um seletor "Simular usuário" listando
   nome + role de cada usuário em `users`. Ao escolher, chama `switch` e recarrega a página
   inteira (`window.location.reload()`) — garante que toda a UI e todo dado já carregado
   reflitam o novo usuário, sem precisar caçar cada componente que lê `role`.
3. **`impersonating: true`** — vira uma pílula "Vendo como {nome} ({role}) · Voltar para
   admin". O botão chama `restore` e recarrega a página.

## Dados de teste

`prisma/seed.ts` ganha dois usuários fixos além do admin:

- `uploader-teste@verai.dev`, `role: 'uploader'`
- `responsavel-teste@verai.dev`, `role: 'responsavel'`

Ambos com senha própria (mesmo padrão bcrypt do admin), então também dá pra logar neles pelo
formulário normal fora do modo dev. Isso garante que o seletor já nasça com opções pra
simular assim que o recurso for implementado.

## Testes

Seguindo o padrão do repo (rota → `route.test.ts`, componente → `.test.tsx`):

- `dev-login/route.test.ts`: token certo loga como admin; token errado ou `DEV_AUTH_ENABLED`
  off rejeita; sem admin no banco retorna erro orientando o seed.
- `dev-status/route.test.ts`: reflete `enabled`/`impersonating`/`users` corretamente nos
  três estados (desligado, admin real, impersonando).
- `dev-auth/switch/route.test.ts` e `dev-auth/restore/route.test.ts`: casos de borda listados
  acima (fora de ordem, sem permissão, flag desligada, usuário inexistente).
- `nav-bar.test.tsx`: cobre os três estados do seletor descritos em "Header (nav-bar)".
