# VerAI — Notificação (design)

**Módulo**: 6 de 8 do roteiro de sub-projetos do VerAI (Notificação)
**Depende de**: módulos 2, 3
**Status**: Aprovado para implementação
**Data**: 18/08/2026

---

## 1. Objetivo

Disparar notificação (dashboard + e-mail) quando um documento termina de
processar, com base em regras configuráveis (`RegraNotificacao`) — não
hardcoded. Inclui o CRUD de regras (`/admin/regras-notificacao`), já que
pertence naturalmente a este módulo.

Sem testes automatizados, mesma linha dos módulos anteriores.

---

## 2. Disparo — `src/lib/notificacao.ts`

`dispararNotificacoes(documento)`, chamada ao final do processamento (nos
dois pontos que já existem: `POST /api/documentos` e
`POST /api/documentos/[id]/reprocessar`, módulo 3), depois que
`status` vira `concluido` ou `erro`:

1. Busca `RegraNotificacao` que batem: `criterioTipo: "tipoDocumento"` e
   `criterioValor === documento.tipo`, OU `criterioTipo: "palavraChaveNome"`
   e `documento.nomeArquivo` contém `criterioValor` (case-insensitive)
2. Junta os `destinatarios` (e-mails) de todas as regras que bateram,
   sem duplicar
3. Pra cada destinatário, cria duas `Notificacao`: uma `canal: "dashboard"`
   e uma `canal: "email"` (os dois canais do mapeamento original)
4. Tenta enviar o e-mail de verdade (seção 3). Falha no envio não derruba
   o resto — só fica registrado, a notificação em `canal: "dashboard"`
   continua valendo

---

## 3. E-mail — `src/lib/email.ts`

Usa `resend` (pacote novo), configurado por env:
```
RESEND_API_KEY=
EMAIL_FROM=
```
Se `RESEND_API_KEY` não estiver configurado, não tenta enviar — só loga
`[email] RESEND_API_KEY não configurado, pulando envio` (mesmo padrão do
`AI_PROVIDER` vazio). Corpo do e-mail: link direto pra
`/documentos/[id]`.

---

## 4. Backend

**`GET /api/notificacoes`** (substitui stub) — lista `Notificacao` do
usuário logado (`destinatario === usuario.email`, `canal: "dashboard"`),
ordenada por mais recente, incluindo `documento.nomeArquivo`.

**`PATCH /api/notificacoes`** (substitui stub) — body `{ id }`, marca uma
notificação como lida (`lida: true`); 404 se não for do usuário.

**`GET/POST/PATCH/DELETE /api/admin/regras-notificacao`** (substitui
stubs) — CRUD simples de `RegraNotificacao` (só admin, já garantido pelo
middleware).

---

## 5. Frontend

**`/notificacoes`** (deixa de ser esqueleto): lista as notificações do
usuário, link pro documento, botão "marcar como lida" por item.

**`/admin/regras-notificacao`** (deixa de ser esqueleto): tabela de
regras + formulário simples de criação (tipo de critério, valor,
destinatários separados por vírgula) + botão excluir.

**Nav bar**: badge com a contagem de não lidas ao lado de "Notificações".

---

## 6. Fora de escopo (por ora)

- Edição de regra existente (só criar/excluir por ora)
- Template de e-mail rico (HTML/branding) — corpo em texto simples
- Testes automatizados desta leva
