# Módulo "Documento SEI"

## Contexto

O VerAI hoje tem um único fluxo de upload de documento (`Documento` + `Analise`,
`src/app/api/documentos/route.ts`): sobe xlsx/csv/pdf/docx vinculado a um cliente e uma
competência (mês/ano), extrai o conteúdo (`src/lib/extracao`) e roda uma análise de IA em cima
(`src/lib/ia/analisar.ts`). Esse modelo não serve para o caso novo: uma proposta em PDF que
**não** tem competência mensal, **não** precisa de análise/crítica de IA, e cujo objetivo final
é virar um texto em Markdown fiel ao PDF original para a pessoa copiar e colar no editor do SEI
(Sistema Eletrônico de Informações), ajustando manualmente lá.

## Objetivo

Um módulo novo, "Documento SEI", onde a pessoa sobe um PDF de proposta vinculado a um cliente,
o sistema extrai o conteúdo preservando a formatação visual do PDF (negrito, título, lista,
tabela) como um rascunho de Markdown, a pessoa edita esse Markdown num editor com preview lado a
lado, salva, e a partir daí tem uma tela com o Markdown final e um botão "Copiar tudo".

## 1. Navegação

Novo sub-item no menu lateral (`src/components/nav-bar.tsx`), ao lado de "Todos os documentos",
dentro do grupo "Relatórios" (`RELATORIOS_SUBLINKS`):

```ts
const RELATORIOS_SUBLINKS = [
  { href: '/', label: 'Todos os documentos', icon: FileText },
  { href: '/documentos-sei', label: 'Documento SEI', icon: ClipboardCopy },
]
```

Rotas de página:

- `/documentos-sei` — histórico de conversões (todas, com filtro por cliente), com botão "Novo
  documento SEI".
- `/documentos-sei/novo` — escolher cliente e subir o PDF; ao concluir o upload, redireciona
  para `/documentos-sei/[id]` já no modo editor (rascunho recém-criado).
- `/documentos-sei/[id]` — mesma rota cobre os dois estados finais de um registro: se
  `status: 'rascunho'`, mostra o editor (Markdown + preview); se `status: 'concluido'`, mostra a
  tela final (Markdown somente leitura + "Copiar tudo"). É o destino ao reabrir qualquer item do
  histórico.

## 2. Modelo de dados

Novo model no Prisma, deliberadamente separado de `Documento`/`Analise` — o formato de dados é
diferente o bastante (sem competência, sem análise de IA, com conteúdo de Markdown) para não
valer a pena forçar os dois no mesmo model:

```prisma
model DocumentoSei {
  id               String    @id @default(cuid())
  nomeArquivo      String
  tamanhoBytes     Int
  caminhoOriginal  String    // URL do PDF original no Vercel Blob
  conteudoMarkdown String?   @db.Text // null só quando status é "erro" (extração falhou)
  status           String    @default("rascunho") // rascunho | concluido | erro
  mensagemErro     String?
  uploadedById     String
  uploadedBy       Usuario   @relation(fields: [uploadedById], references: [id])
  clienteId        String
  cliente          Cliente   @relation(fields: [clienteId], references: [id])
  createdAt        DateTime  @default(now())

  @@index([clienteId])
}
```

`Usuario` e `Cliente` ganham a relação inversa (`documentosSei DocumentoSei[]`), seguindo o
mesmo padrão de `documentos Documento[]` que já existe nos dois.

## 3. Extração fiel de formatação (sem IA)

Ficou definido que a extração **não usa IA** — mesmo aceitando que o resultado automático não
seja perfeito, a pessoa corrige no editor antes de copiar. A extração pura de texto que o
`unpdf` já oferece (`src/lib/extracao/pdf.ts`, usada por `Documento`) perde toda formatação, então
o `DocumentoSei` precisa de uma extração própria, mais rica:

- Nova função `converterPdfParaMarkdown(buffer: Buffer): Promise<string>` em
  `src/lib/extracao/pdfMarkdown.ts`, construída em cima do mesmo `pdfjs` que já está por baixo do
  `unpdf` (via `getDocumentProxy`), mas lendo `getTextContent()` de cada página para obter, por
  trecho de texto: conteúdo, `fontName` e posição (x/y, via `transform`).
- Heurística de classificação, linha a linha (linhas agrupadas por proximidade de y):
  - **Negrito**: `fontName` contém "Bold"/"Negrito" → envolve o trecho em `**...**`.
  - **Título**: tamanho de fonte da linha visivelmente maior que o tamanho predominante do
    corpo do documento (calculado a partir da moda dos tamanhos no documento) → vira `#`/`##`
    conforme o degrau de tamanho (dois níveis: título e subtítulo).
  - **Lista**: linha começa com marcador (`•`, `-`, `*`) ou numeração (`1.`, `2)`) → vira
    `- item` / `1. item`.
  - **Tabela**: quando ≥2 linhas consecutivas têm trechos de texto alinhados nas mesmas posições
    X (mesmas colunas se repetindo), o bloco inteiro vira uma tabela Markdown
    (`| col1 | col2 |` com linha separadora); fora desse padrão, cai como parágrafo normal.
- É uma heurística *best-effort*, não uma extração perfeita: negrito e título são confiáveis
  (comparação direta de fonte/tamanho); tabela funciona bem em grades simples e pode sair
  desalinhada em casos complexos (célula mesclada, texto quebrando dentro da célula). É exatamente
  para corrigir esses casos que existe o passo de edição manual do Markdown antes de copiar — o
  módulo não promete fidelidade automática perfeita, promete uma base editável fiel na maioria
  dos casos reais.
- Teste unitário cobre a heurística isoladamente, com trechos de texto simulados
  (fonte/tamanho/posição controlados) verificando que geram negrito, título, lista e tabela
  corretamente — sem precisar de um PDF de verdade no teste.

## 4. Fluxo de telas

1. **`/documentos-sei/novo`**: escolhe o cliente e sobe o PDF. Ao enviar
   (`POST /api/documentos-sei`, multipart com `clienteId` + `arquivo`), redireciona para
   `/documentos-sei/[id]` (passo 2) assim que o registro é criado:
   - Salva o PDF original no Vercel Blob (mesmo `buildUploadPath`/`putUpload` que `Documento`
     usa).
   - Roda `converterPdfParaMarkdown` e cria o registro com `status: 'rascunho'` e
     `conteudoMarkdown` já preenchido com o Markdown gerado — é esse valor salvo que populam o
     editor a seguir, e também o que fica visível se a pessoa abandonar antes de salvar e
     reabrir o item depois (ver passo 5).
   - Se a extração falhar ou vier vazia (PDF escaneado sem texto), cria o registro direto com
     `status: 'erro'`, `conteudoMarkdown: null` e mensagem explicativa; a tela mostra o erro e
     não avança pro editor.
2. **Editor** (mesma página, após o upload dar certo): duas colunas — **textarea** com o
   Markdown bruto (editável) à esquerda, **preview renderizado** à direita (empilhado em telas
   estreitas). Um botão abre o **PDF original em modal** (`<iframe>` apontando pra
   `GET /api/documentos-sei/[id]/original?modo=preview`, mesmo mecanismo que
   `/api/documentos/[id]/original` já usa), para a pessoa conferir o original lado a lado
   enquanto ajusta o Markdown.
3. Botão **"Salvar"** (`PATCH /api/documentos-sei/[id]` com o Markdown editado no corpo): grava
   `conteudoMarkdown` e muda `status` para `'concluido'`, redirecionando para
   `/documentos-sei/[id]`.
4. **`/documentos-sei/[id]`**: só para itens com `status: 'concluido'`. Markdown final em bloco
   de texto somente leitura + botão **"Copiar tudo"** (`navigator.clipboard.writeText`, ícone de
   clipboard que vira check por ~2s após copiar — mesmo padrão visual do botão de copiar do
   ChatGPT). Reabrir um item concluído a partir do histórico sempre cai direto aqui — sem
   reprocessar nada.
5. **`/documentos-sei`**: lista com nome do arquivo, cliente, quem subiu, data e status
   (badge `rascunho` / `concluido` / `erro`, mesmo padrão visual de status que a listagem de
   `Documento` já usa). Clicar numa linha concluída abre a tela final (passo 4); clicar numa
   linha em `rascunho` volta pro editor (passo 2), pré-preenchido com o `conteudoMarkdown`
   salvo — não existe um "final" pra mostrar ainda. Um item em `erro` abre uma tela simples só
   com a mensagem de erro.

## 5. Permissões

Reaproveita a mesma base de `src/lib/visibilidade.ts` (`clienteIdsPermitidos`), mas com uma
regra mais simples que a de `Documento` — não existe aqui o conceito de "regra de notificação por
tipo/palavra-chave" (isso é específico do fluxo de análise financeira). Duas funções novas,
ao lado das existentes:

- `documentosSeiVisiveisWhere(usuario)`: admin e responsável enxergam todos os `DocumentoSei` dos
  clientes permitidos; uploader enxerga só os que ele mesmo subiu (`uploadedById`), dentro dos
  clientes permitidos — mesma restrição de uploader que já existe para `Documento`.
- `podeVerDocumentoSei(usuario, documentoSei)`: espelha a regra acima para checagem de um
  registro específico (usado nas rotas `GET/PATCH /api/documentos-sei/[id]` e no preview do
  original).

## 6. Erros e casos extremos

- **PDF escaneado/sem texto selecionável**: `converterPdfParaMarkdown` devolve vazio → registro
  criado direto com `status: 'erro'` e mensagem "não foi possível extrair texto deste PDF —
  parece ser um PDF escaneado sem texto selecionável". Sem OCR neste módulo.
- **PDF corrompido/inválido**: mesma tratativa de erro amigável.
- **Sem cliente selecionado**: validação no formulário antes de permitir o upload (mesmo padrão
  de validação 400 que `POST /api/documentos` já faz).
- **Tamanho de arquivo**: sem limite novo — mesmo comportamento (sem limite explícito) que o
  upload de `Documento` tem hoje.
- **Rascunho abandonado** (sobe o PDF, começa a editar, nunca clica "Salvar"): fica salvo com
  `status: 'rascunho'` e aparece no histórico com esse badge, sem exclusão automática — mesmo
  padrão do projeto hoje, que não tem limpeza automática de dados em nenhum outro módulo.

## 7. Testes

- **Unitário da heurística** (`pdfMarkdown.test.ts`): dado um conjunto simulado de trechos com
  fonte/tamanho/posição controlados, verifica que a conversão gera negrito, título, lista e
  tabela corretamente — mesmo padrão de `src/lib/extracao/excel.test.ts`.
- **Componente do editor**: textarea + preview + botão "Copiar tudo" (estado de "copiado"
  temporário), mesmo padrão de teste de componente que `src/components/nav-bar.test.tsx` já usa.
- Sem teste de rota de API dedicado — o projeto não tem esse padrão para as rotas de `Documento`
  hoje (só as rotas de auth têm `route.test.ts`).

## Fora de escopo

- OCR de PDF escaneado (sem camada de texto).
- Qualquer uso de IA na etapa de extração/conversão — decisão explícita de manter a extração
  determinística, mesmo aceitando fidelidade imperfeita em tabelas complexas.
- Limite de tamanho de arquivo novo (segue sem limite, como hoje).
- Qualquer análise/crítica automática do conteúdo da proposta (isso é o que `Documento`/`Analise`
  já fazem para outro caso de uso; `DocumentoSei` não analisa, só converte).
- Edição do Markdown depois de `status: 'concluido'` — uma vez salvo, `/documentos-sei/[id]` é
  somente leitura (copiar). Reabrir para editar de novo, se vier a ser pedido, é um incremento
  futuro.
- Exclusão de registros de `DocumentoSei` (rascunho ou concluído) — sem endpoint de delete neste
  módulo, mesmo padrão de ausência de limpeza automática já citado acima.
- Autosave durante a edição do rascunho — o `conteudoMarkdown` só é gravado no momento da
  criação (extração inicial) e no momento do "Salvar" final. Se a pessoa editar e fechar a
  aba sem salvar, reabrir o rascunho mostra o texto original extraído, não as edições
  intermediárias não salvas.
