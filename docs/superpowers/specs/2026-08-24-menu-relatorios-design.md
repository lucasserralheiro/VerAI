# "Relatórios" como nome da solução no menu

## Contexto

O VerAI vai deixar de ser tratado como um produto único e passar a ser pensado como um
conjunto de soluções — hoje só existe uma (análise de documentos), mas o vocabulário do menu
deve já refletir isso, sem construir mecanismo nenhum de troca entre soluções (não existe uma
segunda ainda).

Hoje a sidebar (`src/components/nav-bar.tsx`) agrupa os itens de uso corrente sob o cabeçalho
de seção "Análise de Documentos", com o link "Clientes" levando pra `/clientes` — uma lista
somente leitura (cadastrar cliente só existe em `/admin/clientes`, admin-only). O breadcrumb
dentro do cliente (`src/app/clientes/[id]/page.tsx` e
`src/app/clientes/[id]/[competencia]/page.tsx`) espelha esse cabeçalho, começando também com
"Análise de Documentos" (decisão do spec
[`2026-08-21-relatorio-consolidado-navegacao-design.md`](2026-08-21-relatorio-consolidado-navegacao-design.md)).

## Objetivo

Renomear o cabeçalho da seção e o item "Clientes" pra vocabulário de "Relatórios", e dar à
página de clientes uma forma própria de cadastrar cliente — sem depender de ir até
`/admin/clientes` pra isso.

## 1. Menu lateral (`nav-bar.tsx`)

- Cabeçalho de seção: `"Análise de Documentos"` → `"Relatórios"`.
- `TOP_LINKS`: o item `{ href: '/clientes', label: 'Clientes', icon: Building2 }` passa a ser
  `{ href: '/clientes', label: 'Relatórios dos clientes', icon: Building2 }` — mesmo link,
  mesmo ícone, só o rótulo muda.
- "Todos os documentos", "Notificações" e a seção "Configuração" (admin): sem mudança nenhuma.

## 2. Página `/clientes`

- Título H1: `"Clientes"` → `"Relatórios dos clientes"`. O eyebrow `"Painel"` acima do título
  não muda (não está ligado ao nome da seção).
- A página passa a buscar `/api/auth/me` no mount (hoje ela não busca usuário nenhum) só pra
  saber se quem está vendo é admin.
- **Novo bloco "+ Novo cliente", visível só pra admin**: um campo de nome + botão "Criar
  cliente", reaproveitando o mesmo endpoint que `/admin/clientes` já usa
  (`POST /api/admin/clientes`, que só aceita `{ nome }` e já é protegido pelo middleware —
  `/api/admin/*` exige `role === 'admin'`). Ao criar com sucesso, a lista de clientes recarrega
  na hora (mesmo padrão de recarregar-após-mutação que `admin/clientes/page.tsx` já usa).
- Erro de criação (ex: nome duplicado) aparece inline, mesmo padrão visual (`AlertCircle` +
  fundo `bg-red-crit-light`) já usado em `admin/clientes/page.tsx`.
- Estado vazio (`clientes.length === 0`) fica condicional:
  - **Admin**: em vez do texto atual, mostra o formulário "+ Novo cliente" como conteúdo
    principal do estado vazio (a instrução "peça a um admin pra cadastrar em /admin/clientes"
    fica redundante pra quem já pode cadastrar ali mesmo).
  - **Não-admin**: continua exatamente como hoje, sem nenhuma mudança de texto ou
    comportamento.
- `/admin/clientes` continua existindo sem mudança — mesclar cliente e excluir cliente
  continuam só lá. A novidade em `/clientes` é exclusivamente criar.

## 3. Breadcrumb dentro do cliente

- Primeiro segmento do breadcrumb: `"Análise de Documentos"` → `"Relatórios"`, em:
  - `src/app/clientes/[id]/page.tsx` (linha do `<span>Análise de Documentos</span>`)
  - `src/app/clientes/[id]/[competencia]/page.tsx` (mesma estrutura)
  - Os testes correspondentes que hoje verificam o texto `"Análise de Documentos"`
    (`clientes/[id]/page.test.tsx`, `clientes/[id]/[competencia]/page.test.tsx`) passam a
    verificar `"Relatórios"`.
- O segmento seguinte do breadcrumb **continua dizendo "Clientes"** (o link pra `/clientes`),
  mesmo com o item do menu agora dizendo "Relatórios dos clientes" — evita o breadcrumb virar
  `Relatórios › Relatórios dos clientes › Nome do cliente` (redundante). O rótulo mais
  descritivo fica reservado pro menu, que é onde cabe explicar melhor o que é o link; o
  breadcrumb continua enxuto.
- `src/app/clientes/[id]/page.tsx` tem, no momento deste spec, uma mudança não commitada e não
  relacionada a este trabalho (47 inserções / 136 remoções). A implementação deve tocar
  **somente** a linha do breadcrumb nesse arquivo, preservando o restante do diff pendente
  intocado.

## Fora de escopo

- Qualquer mecanismo de "rail" ou painel pra trocar entre soluções — não existe uma segunda
  solução ainda pra justificar construir isso agora; fica para quando houver uma.
- Mudança de permissão de quem enxerga `/clientes` ou quais clientes aparecem — continua
  regido por `clientesVisiveisWhere` (`src/lib/visibilidade.ts`): admin vê todos,
  uploader/responsável só os permitidos. Sem mudança.
- Qualquer alteração na página de detalhe do cliente além da linha do breadcrumb — a lista de
  competências/relatórios dentro dela já existe hoje e não muda nesta rodada.
- Mover ou duplicar mesclagem/exclusão de cliente para `/clientes` — continuam exclusivas de
  `/admin/clientes`.
- Renomear o eyebrow `"Painel"` em `/clientes` ou qualquer outro texto não citado acima.
