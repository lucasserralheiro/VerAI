# Reorganização da NavBar: itens admin dentro de "Configuração"

## Contexto

A `NavBar` (`src/components/nav-bar.tsx`) hoje lista 6 itens em uma lista plana, com um
separador visual antes dos 3 itens `adminOnly`:

1. Clientes
2. Todos os documentos
3. Notificações
4. Usuários *(admin)*
5. Gerenciar clientes *(admin)*
6. Regras de notificação *(admin)*

Isso deixa a sidebar cheia para usuários admin e mistura navegação do dia a dia (Clientes,
Documentos, Notificações) com telas de administração do sistema.

## Objetivo

Agrupar os 3 itens administrativos dentro de uma seção **"Configuração"**, deixando os itens
de uso corrente (Clientes, Todos os documentos, Notificações) soltos no topo da sidebar.

Notificações **não** entra em Configuração: é a caixa de entrada pessoal do usuário (com
contador de não lidas) e, futuramente, cada usuário — não só admin — vai ver suas próprias
notificações ali. Por isso continua como item de topo, independente de papel.

## Estrutura de navegação

- **Itens de topo** (visíveis a qualquer usuário logado): Clientes, Todos os documentos,
  Notificações.
- Uma linha divisória (já existe hoje).
- **"Configuração"**: item do tipo *accordion trigger*, com ícone de engrenagem (`Settings`,
  de `lucide-react`) — visível somente quando `role === 'admin'` (mesma checagem usada hoje
  para os itens `adminOnly`). Não é um link — não navega, só expande/recolhe.
  - Ao lado do rótulo, um chevron (`ChevronDown` quando fechado / `ChevronUp` quando aberto)
    indica o estado.
  - Quando aberto, revela uma lista indentada com os 3 sublinks, na mesma ordem de hoje:
    Usuários, Gerenciar clientes, Regras de notificação.

## Comportamento do accordion

- **Estado inicial por rota**: a cada mount/navegação, o accordion nasce aberto se
  `pathname` for uma das 3 rotas admin (`/admin/usuarios`, `/admin/clientes`,
  `/admin/regras-notificacao`); caso contrário nasce fechado.
- **Sem persistência em localStorage**: diferente do estado `expandida` da sidebar (que usa
  `verai:nav-expandida`), o estado aberto/fechado do accordion não é salvo — é recalculado a
  partir da rota a cada carregamento de página. Isso evita conflito com a regra de
  auto-abertura por rota.
- **Toggle manual**: com a sidebar expandida, clicar em "Configuração" alterna
  aberto/fechado in-line, sem afetar mais nada.
- **Sidebar recolhida (modo só ícones)**: clicar no ícone de Configuração dispara a mesma
  ação já existente `alternarExpandida()` (expande a sidebar inteira para o modo texto+ícone)
  e também abre o accordion, revelando os 3 sublinks de uma vez. Não existe modo flyout/popover
  separado.
- **Item ativo**: a barra lateral laranja que marca o link ativo continua funcionando nos 3
  sublinks (`pathname === link.href`), igual aos itens de topo hoje.

## Fora de escopo

- Mudança de permissões de quem vê Notificações (continua igual: todo usuário logado já vê
  hoje; a menção a "futuramente cada usuário vê a própria notificação" é sobre o *conteúdo*
  da lista, não sobre onde o link fica na nav — nenhuma mudança de backend aqui).
- Qualquer novo item de menu além dos 6 já existentes.
- Mudanças visuais/tema fora da própria NavBar.
