# VerAI — Permissões (design)

**Módulo**: 8 de 8 do roteiro de sub-projetos do VerAI (Permissões) — último módulo
**Depende de**: módulos 2, 4, 6
**Status**: Aprovado para implementação
**Data**: 18/08/2026

---

## 1. Objetivo

Dois pontos que ficaram provisórios nos módulos anteriores:

1. **Regra real de visibilidade do "responsável"** — desde o módulo 4,
   `responsavel` era tratado como `admin` (via todos os documentos) porque
   o módulo 6 (regras de notificação) ainda não existia. Agora existe:
   hora de trocar pela regra de verdade — vê os documentos que batem nas
   `RegraNotificacao` onde ele é destinatário (mais os que ele mesmo
   subiu).
2. **CRUD de usuários** (`/admin/usuarios`, `/api/admin/usuarios`) — único
   CRUD que ainda faltava.

Sem testes automatizados, mesma linha dos módulos anteriores.

---

## 2. `src/lib/visibilidade.ts` (novo)

Substitui `podeVerTodosDocumentos` (que sai de `lib/auth.ts`):

- `documentosVisiveisWhere(usuario): Promise<Prisma.DocumentoWhereInput>`
  — usado em `GET /api/documentos` (listagem/filtros)
- `podeVerDocumento(usuario, documento): Promise<boolean>` — usado nas
  rotas de documento único (detalhe, original, preview, relatório)

Regra por perfil:
- `admin`: vê tudo
- `uploader`: só os que ele mesmo subiu
- `responsavel`: os que ele mesmo subiu **+** os que batem em alguma
  `RegraNotificacao` onde o e-mail dele está em `destinatarios` (mesmo
  critério de match do módulo 6: `tipoDocumento` ou `palavraChaveNome`)

---

## 3. Rotas atualizadas (trocam `podeVerTodosDocumentos` por `podeVerDocumento`/`documentosVisiveisWhere`)

- `GET /api/documentos`
- `GET /api/documentos/[id]`
- `GET /api/documentos/[id]/original`
- `GET /api/documentos/[id]/preview`
- `GET /api/documentos/[id]/relatorio`

---

## 4. `GET/POST/PATCH/DELETE /api/admin/usuarios` (substitui stub)

CRUD simples (só admin, já garantido pelo middleware):
- `GET`: lista `{ id, nome, email, role, createdAt }` (sem `senhaHash`)
- `POST`: `{ nome, email, senha, role }` → hash via `hashSenha` (módulo 2)
- `PATCH`: `{ id, nome?, email?, role?, senha? }` — se vier `senha`, faz
  novo hash
- `DELETE`: `?id=`

---

## 5. Frontend — `/admin/usuarios` (deixa de ser esqueleto)

Mesmo padrão visual de `/admin/regras-notificacao`: tabela + formulário
de criação (nome, e-mail, senha, role) + excluir.

---

## 6. Limpeza

Os testes `dashboard-skeleton.test.tsx` e `stub-routes.test.ts` perdem o
sentido — todas as páginas esqueleto e rotas stub que restavam são
implementadas neste módulo. Removidos.

---

## 7. Fora de escopo (por ora)

- Edição de senha própria (perfil do usuário logado)
- Testes automatizados desta leva
