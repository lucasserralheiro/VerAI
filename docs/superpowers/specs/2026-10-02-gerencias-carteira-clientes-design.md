# Gerências e carteira de clientes — design

Data: 02/10/2026. Status: aprovado em conversa (brainstorming), aguardando revisão do arquivo.

## 0. Decisões do usuário (prevalecem sobre o resto)

1. **Todo usuário logado vê todos os clientes.** A liberação cliente a cliente (`Usuario.clientesPermitidos`)
   deixa de existir.
2. Cada cliente pertence a **uma gerência** (ou "kan") — a **carteira**. Só a **equipe dessa gerência** edita o
   cliente; o **admin** faz tudo.
3. Papéis na gerência: **manager** e **usuário**. Os dois editam os clientes da carteira; o manager, além disso,
   põe e tira gente da equipe. Uma pessoa pode estar em mais de uma gerência (manager de várias, inclusive).
4. Criar/renomear/desativar gerência, **mover cliente** entre gerências e nomear manager: **só admin**.
5. O foco é o **cliente**. Confere, Proposta Comercial, Reajuste, biblioteca (tabela de preços, calendário,
   links, controles) e cadastros comuns (fornecedor, CO, link SEI) **não** entram nesta regra.
6. **O login por token (`DEV_AUTH_TOKEN`, tela "Token de acesso") continua entrando como o usuário admin** e,
   portanto, fazendo tudo. Enquanto todo mundo entrar pelo token, ninguém perde edição; a regra da gerência vale
   para quem tiver login próprio não admin (e é testável pela troca de usuário do admin, `/api/dev-auth/switch`).

## 1. Como é hoje (varredura de 02/10/2026)

- `Usuario.role`: `uploader | responsavel | admin`, gravado no JWT (`src/lib/auth.ts`). O middleware só separa
  `/admin` e `/api/admin` (admin) do resto.
- **Ver cliente**: uma função só, `clienteIdsPermitidos()` (`src/lib/visibilidade.ts`) — admin = sem restrição;
  os demais = `clientesPermitidos` (relação `UsuarioClientes`). Telas, rotas e ferramentas do assistente usam ela
  (direto ou por `podeVerCliente`/`clientesVisiveisWhere`).
- **Não existe "ver × editar"**: quem vê o cliente edita. ~38 rotas de gravação de cliente checam acesso por cinco
  caminhos: `exigirAcessoCliente`, `verificarAcessoCliente`, `podeVerCliente`, `carregarContratoComAcesso`
  (`src/app/api/contratos/carregar.ts`) e ajudantes próprios (faturamento, histórico, trâmite). Só criar e excluir
  cliente são de admin.
- Admin já tem área: `/admin/usuarios` (inclui liberar clientes um a um), `/admin/clientes`, `/admin/assistente`,
  `/admin/regras-notificacao`.
- Dev: 46 clientes, 5 usuários (3 uploader, 1 responsavel, 1 admin), quase nenhum cliente liberado.
- A sincronização do SharePoint cria cliente sozinha (`garantirClientes`) e grava como sistema, sem usuário.

## 2. Dados — só tabelas novas

O agendador do SharePoint roda o cliente Prisma desta pasta contra produção: coluna nova em model que ele já usa
(`Cliente`, `Usuario`) quebra a sincronização até a migração subir. Por isso **nenhuma coluna em model
existente**; a migração sobe antes do `prisma generate` mesmo assim.

```prisma
model Gerencia {
  id        String   @id @default(cuid())
  nome      String   @unique
  sigla     String?  @unique
  ativa     Boolean  @default(true)
  createdAt DateTime @default(now())
  membros   MembroGerencia[]
  carteira  CarteiraCliente[]
}

model MembroGerencia {
  id         String   @id @default(cuid())
  gerenciaId String
  usuarioId  String
  papel      String   // manager | usuario
  createdAt  DateTime @default(now())
  @@unique([gerenciaId, usuarioId])
  @@index([usuarioId])
}

model CarteiraCliente {
  clienteId   String   @id          // um cliente, uma gerência
  gerenciaId  String
  movidoEm    DateTime @default(now())
  movidoPorId String?
  @@index([gerenciaId])
}

model MovimentoCarteira {
  id             String   @id @default(cuid())
  clienteId      String
  deGerenciaId   String?  // null = estava sem gerência
  paraGerenciaId String?  // null = saiu da carteira
  porId          String?
  em             DateTime @default(now())
  @@index([clienteId])
}
```

As FKs (Gerencia, Usuario, Cliente) ficam declaradas só do lado das tabelas novas, com relação de volta nos
models existentes apenas como campo virtual do Prisma (não gera coluna). `Usuario` excluído → some da equipe
(`Cascade`); gerência só é excluída vazia (`Restrict`).

## 3. Regra — um arquivo só

`src/lib/gerencias/permissao.ts`, funções puras + versão com banco; nenhuma rota decide por conta própria.

| Ação | Quem pode |
|---|---|
| Ver qualquer cliente | todo usuário logado |
| Editar dados do cliente (contrato, histórico, itens, faturamento, NF, demanda, trâmite, solicitação, termo, responsável, arquivo, documento, análises consolidada/evolução, dados cadastrais) | admin, ou membro (manager/usuário) da gerência dona do cliente |
| Cliente sem carteira | só admin edita |
| Pôr/tirar pessoa da equipe, trocar papel | admin, ou manager daquela gerência; o último manager não sai nem vira usuário (só o admin) |
| Criar/renomear/desativar gerência, mover cliente, nomear manager | só admin |
| Criar/excluir cliente | só admin (como hoje) |

- `clienteIdsPermitidos()` passa a devolver `null` (sem restrição) para todos → leitura liberada em telas, rotas e
  assistente de uma vez. As funções de leitura ficam com o nome que têm.
- Em `src/lib/relatorios-clientes/acesso.ts` entram `podeEditarCliente(usuario, clienteId)` e
  `exigirEdicaoCliente(request, clienteId)` / `verificarEdicaoCliente(usuario, clienteId)`, ao lado das de
  leitura. 403 com mensagem: "Somente leitura: este cliente é da <gerência>." ou "Cliente sem gerência: só o
  administrador edita."
- `carregarContratoComAcesso` ganha o modo edição (usado só nos métodos de gravação).
- Papéis `uploader`/`responsavel`/`admin` continuam valendo só como admin × não admin; a regra própria de
  documento (`documentosVisiveisWhere`/`podeVerDocumento`: uploader vê o que enviou, regras de notificação) **não
  muda**.
- `excluir-cliente.ts` e o mesclar de clientes tratam `CarteiraCliente` e `MovimentoCarteira` (regra do CLAUDE.md
  para model novo ligado a cliente).

## 4. Telas

**`/admin/gerencias`** (item no grupo admin do menu)
- Lista: nome, sigla, nº de clientes, managers; "Nova gerência", renomear, desativar (só vazia).
- Cartão **"Clientes sem gerência"** no topo, com contagem — é onde caem os 46 de hoje e os criados pelo SharePoint.
- Detalhe da gerência, duas colunas:
  - **Carteira**: clientes; "Adicionar clientes" abre lista com busca e seleção múltipla; cliente de outra gerência
    aparece "está na Gerência Y — mover para cá?". Remover da carteira = volta a "sem gerência".
  - **Equipe**: pessoa + papel; adicionar, trocar papel, remover.
  - **Movimentos**: "SMIT veio da Gerência Y em 02/10 por Lucas".

**"Minha gerência" / "Minhas gerências"** (menu, só para quem é manager): o mesmo detalhe, carteira só leitura,
equipe editável. Rotas fora de `/admin` (o middleware barra não admin lá): `/gerencias/[id]` e
`/api/gerencias/...`, checando a regra do §3.

**Ficha e lista de clientes**
- Selo "Carteira: <gerência>" ou "Sem gerência"; filtro por gerência na lista.
- A API do cliente devolve `podeEditar`; as telas escondem editar/novo/excluir/enviar quando é `false` e mostram
  "Somente leitura — este cliente é da <gerência>". Tela nenhuma decide pelo `role`.

**`/admin/usuarios`**: sai a liberação de clientes; entra a coluna "Gerências" ("Gerência X — manager").

## 4a. Menu "Administração"

O grupo **"Configuração"** do rodapé do menu (`CONFIG_LINKS`, `src/components/nav-bar.tsx`, só admin) vira um
grupo **"Administração"** no corpo do menu, só para admin, com página inicial **`/admin`** (painel com um cartão
por área: o que é, números rápidos — nº de usuários, gerências, clientes sem gerência — e o link). Submenus:

1. Usuários (`/admin/usuarios`) — com a coluna "Gerências"
2. Gerências e carteiras (`/admin/gerencias`) — §4
3. Clientes (`/admin/clientes`) — criar, editar, excluir, mesclar; atalho para "sem gerência"
4. Regras de notificação (`/admin/regras-notificacao`)
5. Assistente de IA (`/admin/assistente`)

**Endereços não mudam** — só o lugar do link. Ficam para rodadas seguintes (uma tela por vez, cada uma com a sua
régua): SharePoint (estado da última sincronização, conferência e auditoria), integridade dos clientes
(`reconciliar-clientes.ts`), valores e duplicatas de contratos, índice IPC-Fipe, registro de acessos.

## 4b. Nada do que funciona hoje deixa de funcionar

- Endereços, token de acesso (entra como admin, faz tudo), agendador do SharePoint (só tabelas novas), Confere,
  Proposta, Reajuste, biblioteca, scripts e réguas: inalterados.
- Mudanças **de propósito**, e só estas: Fase A — não admin passa a **ver** todos os clientes; Fase B — não admin
  fora da gerência do cliente perde a **edição** daquele cliente.
- Prova: suíte inteira (`jest --runInBand`) antes e depois de cada fase; `nav-bar.test.tsx` confere que todo link
  antigo continua no menu; régua das rotas (Fase B); conferência na tela no dev como admin e como usuário comum
  (troca de usuário) antes de subir.
- `nav-bar.tsx`/`nav-bar.test.tsx` tinham mudança sem commit de outra sessão em 02/10: o menu só é mexido depois
  que esse trabalho estiver commitado.

## 5. Subida em duas fases

| Fase | Entra | Efeito no uso |
|---|---|---|
| **A — estrutura** | tabelas, regra (§3) com teste, menu "Administração" + painel `/admin` (§4a), `/admin/gerencias`, "Minha gerência", selo e filtro, leitura liberada | todos veem todos os clientes; **ninguém perde edição ainda**; o admin monta as gerências e distribui os clientes pela tela |
| **B — regra de edição** | `exigirEdicaoCliente` nas rotas de gravação de cliente, `podeEditar` nas telas, teste-régua das rotas, saída da liberação em `/admin/usuarios` | vale "só a gerência edita" — sobe **depois** das carteiras montadas na produção |

Depois da B validada, migração própria remove a relação `UsuarioClientes`.

Distribuição inicial: pela tela (seleção múltipla), sem script de carga — 46 clientes cabem em minutos e cada
movimento fica na trilha.

## 6. Testes

- Regra pura: cada linha da tabela do §3 (admin, manager, usuário da gerência, membro de outra gerência, sem
  vínculo, cliente sem carteira, último manager).
- Rotas de gerência/carteira/equipe: admin × manager × usuário × sem vínculo.
- Rota de cliente de gravação devolve 403 com a mensagem certa; leitura passa para qualquer logado.
- **Régua das rotas** (Fase B): percorre `src/app/api/**/route.ts` e falha se um POST/PUT/PATCH/DELETE das rotas de
  cliente (lista explícita de prefixos: `clientes`, `contratos`, `historico-contrato`, `itens-contrato`,
  `faturamentos`, `notas-fiscais`, `demandas`, `tramites-demanda`, `solicitacoes`, `termos-confirmacao`,
  `responsaveis`, `arquivos`, `documentos`) não chamar uma verificação de edição.
- Exclusão e mesclagem de cliente levam carteira e movimentos.

## 7. Fora deste trabalho

- Restringir leitura por gerência (decisão 1: todos veem).
- Regras para Confere, Proposta, Reajuste, biblioteca e cadastros comuns.
- Login individual para todos (hoje o token entra como admin — decisão 6).
- Script de carga de carteiras.
- Telas de admin que hoje são script (SharePoint, integridade, valores/duplicatas, IPC-Fipe, acessos) — §4a.
