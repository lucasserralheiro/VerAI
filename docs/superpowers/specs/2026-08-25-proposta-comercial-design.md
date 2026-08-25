# Revisão do módulo "Documento SEI" → "Proposta Comercial (Conversão SEI)"

## Contexto

O módulo "Documento SEI" (spec original: `2026-08-25-documento-sei-design.md`) já foi implementado
por completo: upload de PDF vinculado a um cliente, extração determinística (sem IA) pra Markdown
preservando negrito/título/lista/tabela, editor com preview lado a lado, e uma tela final com
Markdown cru + "Copiar tudo". Essa revisão ajusta esse módulo já existente em seis pontos que a
pessoa que usa no dia a dia apontou como problema, sem alterar o objetivo geral (converter proposta
em PDF pra colar no SEI):

1. Nome confuso — vira "Proposta Comercial (Conversão SEI)".
2. Hoje vive como sub-item dentro do grupo "Relatórios" — precisa ser um módulo à parte no menu.
3. Vínculo obrigatório com cliente e com usuário (uploader) — não faz sentido pro caso de uso,
   sai por completo.
4. Fidelidade da conversão fica aquém do Markdown puro atual (sem itálico, sublinhado,
   alinhamento; tabela erra fácil quando o texto não alinha perfeitamente em colunas).
5. O que se copia hoje é Markdown cru — cola no editor rich text do SEI como texto literal
   (`**assim**`), não como formatação de verdade.
6. Depois de salvo (`concluido`), não dá pra voltar e ajustar o conteúdo.

## 1. Renomeação

Renomeação completa, por fora e por dentro:

- Nome de produto: **"Proposta Comercial (Conversão SEI)"** — título das páginas, label do menu.
- Model Prisma: `DocumentoSei` → `PropostaComercial`.
- Rotas de API: `/api/documentos-sei/**` → `/api/propostas-comerciais/**`.
- Rotas de página: `/documentos-sei/**` → `/propostas-comerciais/**`.
- Arquivos/pastas correspondentes (`src/app/documentos-sei/**`, `src/app/api/documentos-sei/**`)
  seguem a mesma renomeação de pasta.
- `src/lib/extracao/pdfMarkdown.ts` mantém o nome — a função converte pra Markdown/HTML
  independente do nome do módulo que a usa, não é específica de "SEI".

## 2. Navegação no menu

Sai do grupo "Relatórios" (`RELATORIOS_SUBLINKS` em `src/components/nav-bar.tsx`) e vira um
**grupo expansível próprio**, no mesmo padrão visual de "Relatórios dos clientes" (link principal
em negrito + seta pra abrir/fechar), preparado pra ganhar mais itens no futuro:

```
Relatórios dos clientes ˅
  Todos os documentos
Proposta Comercial (Conversão SEI) ˅
  Histórico
Notificações
```

- Link principal do grupo: mesmo texto do grupo, sem rota própria de "página do grupo" (diferente
  de "Relatórios dos clientes", que aponta pra `/clientes`) — só abre/fecha o sub-item.
- Único item dentro por enquanto: **"Histórico"** → `/propostas-comerciais` (a listagem de
  conversões). "Nova conversão" continua sendo um botão dentro da própria página de histórico, não
  um item de menu.
- Estado de aberto/fechado do grupo segue o mesmo padrão dos outros grupos (`useState` local,
  reabre sozinho se a rota atual cair dentro dele).

## 3. Desvinculação de cliente e usuário

`PropostaComercial` perde os campos `clienteId`/`cliente` e `uploadedById`/`uploadedBy` por
completo — vira um espaço de trabalho compartilhado: qualquer pessoa autenticada vê e edita
qualquer conversão, sem trilha de autoria e sem relação com nenhum cliente.

- **Model**: remove `clienteId`, `cliente`, `uploadedById`, `uploadedBy`, `@@index([clienteId])`.
  Remove também as relações inversas `documentosSei DocumentoSei[]` em `Usuario` e `Cliente`
  (viram só `documentos Documento[]`, sem a contraparte de proposta comercial).
- **Migration**: renomeia a tabela e dropa as colunas/FKs/índice acima — perda da associação
  histórica de cliente/uploader nos registros já existentes é esperada e aceitável (dado de baixo
  valor pra esse módulo, como já decidido).
- **Permissões**: `documentosSeiVisiveisWhere` e `podeVerDocumentoSei` (`src/lib/visibilidade.ts`)
  são removidas por completo. As rotas continuam exigindo login (`getAuthUser`), mas não fazem
  mais nenhuma checagem de cliente ou de quem subiu o arquivo.
- **Telas**:
  - `/propostas-comerciais/novo`: formulário fica só com o campo de arquivo PDF — sem seletor de
    cliente.
  - `/propostas-comerciais` (histórico): tabela perde as colunas "Cliente" e "Quem subiu" — fica
    Arquivo, Data, Status, Ações. Sem filtro de cliente (não existe mais).
  - `/propostas-comerciais/[id]`: cabeçalho da página perde a linha "Cliente · enviado por
    Fulano".

## 4. Extração fiel — heurística melhorada (continua sem IA)

Mantém a decisão original de não usar IA na extração — o ganho de fidelidade vem de ler mais sinal
do PDF (fonte, posição **e agora também os traços vetoriais desenhados na página**), não de trocar
a abordagem determinística por um modelo:

- **Itálico**: `fontFamily` contendo `italic`/`oblique`/`itálico` → `*texto*` (combina com negrito
  quando os dois batem no mesmo trecho: `***texto***`).
- **Sublinhado**: PDF não marca sublinhado como atributo de fonte — é um retângulo fino desenhado
  sob o texto. Passa a ler a lista de operações de desenho da página (via o `pdfjs` que já está
  por baixo do `unpdf`, acessado com `getResolvedPDFJS()`/`page.getOperatorList()`), procurando
  retângulos finos logo abaixo da linha de base de um trecho de texto, com largura parecida —
  quando bate, o trecho vira `<u>texto</u>` (HTML embutido no Markdown, já que Markdown puro não
  tem sublinhado nativo). **Best-effort**: sublinhado decorativo, tracejado ou desenhado de forma
  incomum pode não ser detectado.
- **Alinhamento**: compara a posição de cada linha com as margens do corpo do documento — linha
  com folga parecida dos dois lados e que não ocupa a largura toda vira `<p align="center">texto
  </p>` (título centralizado, por exemplo); parágrafo que toca as duas margens vira
  `<p align="justify">texto</p>`. Título/lista/tabela não passam por essa checagem de alinhamento.
- **Tabela — nova detecção por bordas**: em vez de só agrupar por posição X do texto (heurística
  atual, que erra quando o texto não alinha em colunas de forma perfeita), passa a ler as
  **linhas/bordas vetoriais** desenhadas no PDF (mesmo mecanismo do sublinhado) pra montar a grade
  real da tabela e encaixar cada trecho de texto na célula correspondente — bem mais confiável
  pra tabelas com bordas visíveis, que é a maioria em propostas comerciais. Quando a tabela não
  tem bordas desenhadas (só espaçamento entre colunas), cai de volta na heurística de posição X
  atual como *fallback*.
- Continua **best-effort**, como o módulo já assume desde a spec original: célula mesclada ou
  layout muito incomum ainda pode sair imperfeito — a edição manual do Markdown antes de copiar
  continua sendo o mecanismo de correção. É uma melhoria real de fidelidade (mais tipos de
  formatação detectados, tabela mais confiável), não uma promessa de fidelidade perfeita em
  qualquer PDF.

## 5. Preview, cópia formatada e reabertura para edição

- **Editor** (rascunho): mantém textarea de Markdown + preview renderizado lado a lado, e o modal
  "Ver PDF original". O preview passa a renderizar itálico, sublinhado, alinhamento e tabela com
  bordas corretamente — reflexo direto da heurística melhorada (o `marked` já repassa HTML puro
  sem sanitizar, então `<u>`/`<p align>` embutidos no Markdown renderizam sem trabalho extra).
- **Tela final** (concluído): o bloco de Markdown cru some — mostra **só o preview renderizado**,
  com um botão **"Copiar formatado"** que usa `navigator.clipboard.write` com um `ClipboardItem`
  carregando dois formatos: `text/html` (o HTML renderizado do preview) e `text/plain` (texto
  simples extraído do mesmo HTML, como *fallback* pra quem cola num campo que só aceita texto
  puro). Colando no editor rich text do SEI, negrito/título/tabela/sublinhado saem formatados de
  verdade — não como sintaxe Markdown literal. O botão "Copiar tudo" (Markdown cru) sai dessa
  tela.
- **Reabertura para edição**: a tela final ganha um botão **"Editar novamente"**, que troca a
  visão local da página pro editor de novo (mesmo componente do rascunho), permitindo ajustar o
  Markdown e salvar de novo. Não cria um status novo nem endpoint separado: a rota `PATCH`
  deixa de recusar atualização quando o registro já está `concluido` — só grava o novo
  `conteudoMarkdown` e mantém `status: 'concluido'`. Deixa de existir, na prática, a regra de "só
  edita uma vez".

## 6. Fluxo de telas revisado

1. **`/propostas-comerciais/novo`**: escolhe só o PDF e envia (`POST /api/propostas-comerciais`,
   multipart com `arquivo`). Ao concluir, redireciona pro editor em `/propostas-comerciais/[id]`.
   Falha de extração (PDF escaneado/corrompido) continua criando o registro com
   `status: 'erro'` e mensagem explicativa, sem avançar pro editor.
2. **Editor** (`status: 'rascunho'`, ou reaberto a partir de um `concluido` via "Editar
   novamente"): textarea + preview lado a lado, modal do PDF original, botão "Salvar"
   (`PATCH /api/propostas-comerciais/[id]`) grava o Markdown e marca `status: 'concluido'`.
3. **Tela final** (`status: 'concluido'`, fora do modo de reabertura): preview renderizado +
   "Copiar formatado" + "Editar novamente".
4. **`/propostas-comerciais`**: histórico com Arquivo, Data, Status, Ações — clicar numa linha
   `concluido` abre a tela final; numa linha `rascunho`, volta pro editor; numa `erro`, mostra só
   a mensagem de erro.

## 7. Testes afetados

- `src/lib/extracao/pdfMarkdown.test.ts`: ganha casos novos pra itálico, sublinhado (via retângulo
  vetorial simulado), alinhamento centralizado/justificado, e tabela detectada por bordas
  vetoriais (além do fallback por posição já coberto).
- Componente de editor (renomeado junto do módulo): testes existentes ajustados pra remover
  qualquer referência a cliente.
- Componente da tela final: novo teste cobrindo o botão "Copiar formatado" (mock de
  `navigator.clipboard.write`/`ClipboardItem`) e o botão "Editar novamente" alternando a visão
  pro editor.
- `nav-bar.test.tsx`: teste do link "Documento SEI" dentro de "Relatórios" é substituído por um
  teste do link "Histórico" dentro do novo grupo "Proposta Comercial (Conversão SEI)".
- Rotas de API sem teste dedicado, mesmo padrão já adotado no módulo original.

## Fora de escopo

- OCR de PDF escaneado (sem camada de texto) — mesma exclusão da spec original.
- Uso de IA na extração/conversão — decisão reafirmada nesta revisão: a melhoria de fidelidade
  vem de ler mais sinal determinístico do PDF (fonte, posição, traços vetoriais), não de trocar
  por um modelo.
- Fidelidade perfeita em qualquer PDF — tabela com células mescladas ou layout muito incomum, e
  sublinhado desenhado de forma não padrão, continuam podendo sair errados; a correção manual no
  editor continua sendo o mecanismo esperado.
- Indicador de progresso/etapas (1. Upload > 2. Editar > 3. Finalizado) e breadcrumbs — não
  pedidos nesta revisão.
- Tornar cliente opcional (meio-termo) — decisão foi remover por completo, não deixar como campo
  opcional.
- Exclusão de registros, limite de tamanho de arquivo novo, autosave durante edição — seguem fora
  de escopo, como na spec original.
