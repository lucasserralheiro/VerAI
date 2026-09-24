# Repositório de documentos do cliente (design)

**Status**: Desenho aprovado com o usuário em 23/09/2026. **Fase 1 concluída** (plano
`docs/superpowers/plans/2026-09-24-repositorio-documentos-fase-1.md`) e **ajuste da §7 concluído**
(plano `docs/superpowers/plans/2026-09-24-repositorio-documentos-ajuste-s7.md`) — contrato e
competência vêm dos usos. Fases 2–4 não iniciadas. **A §7 manda sobre §3.2, §3.3, §3.5 e §3.6.**
**Data**: 23/09/2026

---

## 1. Objetivo

A aba **Documentos** da ficha do cliente (`/clientes/[id]?aba=documentos`) deixa de ser o fluxo de
competência + análise por IA e passa a ser **o repositório de todos os arquivos do cliente** —
proposta, termo, aditivo, medição, fatura, planilha, ofício, relatório gerado etc.

O objetivo de fundo, nas palavras do usuário: deixar os documentos do cliente "organizado[s] e
fácil[is] de acessar para futuramente conseguir navegar em outros módulos do VerAI sem ter que fazer
upload de novo". Ou seja: **um arquivo sobe uma vez e todo módulo (contratos, faturamento,
ConfereAI, Proposta Comercial, análise por IA) usa dali.**

## 2. Contexto — varredura de 23/09/2026

Hoje arquivo de cliente vive em seis lugares, com seis jeitos diferentes de guardar, servir e
proteger:

| Onde | Tipos | Ligado a cliente? | Como é servido |
|---|---|---|---|
| `Documento` (upload por competência, com análise por IA) | xlsx, csv, pdf, docx | sim, por competência | rota autenticada `/api/documentos/[id]/original`, grava `AcessoDocumento` |
| Relatórios de análise (individual, consolidada, evolução) | PDF gerado | sim, pela competência | rota autenticada de relatório |
| `Faturamento.pdfUrl` (em andamento, sem commit) | PDF | sim | **link direto ao Blob** (`href={faturamento.pdfUrl}`), sem checar permissão nem auditar |
| `HistoricoContrato.propostaPdfUrl`/`termoPdfUrl` (em andamento, sem commit) | PDF | sim, pelo contrato | idem |
| `PropostaComercialArquivo` | pdf, xlsx, csv, docx | **não** | rota autenticada |
| `ConfereExecucao` (DOCX/XLSX gerados; entradas não são guardadas) | docx, xlsx | **não** (decisão de 21/09, revista aqui — §3.6) | rota autenticada |

Problemas encontrados na varredura, que este desenho resolve:

1. **Arquivo duplicado.** O "copiar PDF existente" do histórico do contrato
   (`src/lib/relatorios-clientes/pdfs-existentes.ts`, rota `/api/historico-contrato/[id]/pdf/[tipo]/copiar`)
   copia o blob da Proposta Comercial ou de outra linha — o mesmo termo aditivo fica guardado 2–3
   vezes. É o sintoma de não haver repositório.
2. **Limite de 4,5 MB.** Função serverless da Vercel recusa corpo de requisição acima de 4,5 MB.
   O PDF do faturamento/histórico (declara 15 MB) e o **proxy do ConfereAI**
   (`/api/confere/reports`, recebe contrato + levantamento + aditivos em multipart) passam o arquivo
   pelo corpo — quebram em produção com PDF grande. Só a Proposta Comercial faz certo (upload direto
   ao Blob via `/api/propostas-comerciais/upload-token`, servidor busca depois).
3. **Segurança e auditoria desiguais.** O Blob é `access: 'public'` (URL não adivinhável). Parte das
   telas entrega pela rota autenticada, parte linka a URL crua. `AcessoDocumento` só cobre `Documento`.
4. **Permissão do `Documento` não serve a repositório.** O papel `uploader` só vê o que ele mesmo
   subiu (`documentosVisiveisWhere`); o resto de "Relatórios dos clientes" usa `podeVerCliente`.

## 3. Decisões

### 3.1 Fluxo de competência + IA sai da ficha (decisão do usuário)

A ficha para de mostrar "Competências". **Nada é apagado**: as páginas `/clientes/[id]/[competencia]`
(análise individual, consolidada, evolução) e "Todos os documentos" (`/`) continuam funcionando e
são alcançadas pelo "onde é usado" de cada arquivo (§3.5). Transformar "analisar com IA" numa ação
sobre um arquivo do repositório fica fora de escopo (§5).

### 3.2 `ArquivoCliente` — o único lugar onde arquivo de cliente existe

| Campo | Observação |
|---|---|
| `id` | UUID gerado pelo serviço (`randomUUID`) |
| `clienteId` | obrigatório |
| `contratoId?` | **removido — §7.1** (vem dos usos) |
| `competenciaAno?`, `competenciaMes?` | **removido — §7.1** (vem dos usos) |
| `categoria` | enum `CategoriaArquivo` (abaixo), obrigatória |
| `nome` | nome original do arquivo |
| `extensao`, `contentType`, `tamanhoBytes` | |
| `sha256` | hash do conteúdo, calculado pelo servidor |
| `urlBlob` | **nunca** serializada para o navegador |
| `origem` | enum `upload` \| `gerado` \| `migrado` |
| `enviadoPorId?` | `Usuario`; nulo para `gerado`/`migrado` sem autor conhecido |
| `createdAt`, `removidoEm?` | remoção é lógica |

`CategoriaArquivo`: `PROPOSTA_COMERCIAL`, `PROPOSTA_ADITIVO`, `TERMO_CONTRATO`, `TERMO_ADITIVO`,
`MEDICAO`, `FATURA_NF`, `PLANILHA`, `OFICIO_SEI`, `RELATORIO_GERADO`, `OUTRO`.
Proposta e termo são categorias separadas porque o ConfereAI precisa da **proposta** (PC/PA), não do
termo (TC/TA) — a mesma distinção das colunas do histórico do contrato.

Índices: `(clienteId, createdAt)`, `(clienteId, categoria)`, `(contratoId)`, e unicidade de
`(clienteId, sha256)` entre os não removidos (índice único parcial na migração SQL,
`WHERE "removidoEm" IS NULL` — o Prisma não expressa isso no schema; fica comentado lá).

### 3.3 Quem usa o arquivo guarda a referência

A FK fica no **consumidor**, não no arquivo. "Onde este arquivo é usado" vira uma consulta, e nenhum
módulo precisa conhecer os outros.

| Consumidor | Referência | Substitui |
|---|---|---|
| `HistoricoContrato` | `propostaArquivoId?`, `termoArquivoId?` | `propostaPdfUrl/Nome`, `termoPdfUrl/Nome` (em andamento) |
| `Faturamento` | `arquivoId?` | `pdfUrl`, `pdfNomeArquivo` (em andamento) |
| `Documento` | `arquivoId?` | — (convive com `caminhoOriginal`, que continua sendo a fonte do fluxo antigo) |
| `PropostaComercial` / `PropostaComercialArquivo` | `clienteId?` / `arquivoClienteId?` | — |
| `ConfereExecucao` | `clienteId?`, `contratoId?`, competência, `contratoArquivoId?`, `levantamentoArquivoId?`, `docxArquivoId?`, `xlsxArquivoId?`; aditivos em `ConfereExecucaoAditivo (execucaoId, ordem, arquivoId)` | — (`caminhoDocx/Xlsx` viram opcionais; execuções sem cliente continuam usando) |

### 3.4 Regras que não se negociam

1. **Sem duplicado dentro do cliente.** Mesmo `sha256` no mesmo cliente = mesmo registro. "Anexar"
   em qualquer lugar é apontar para um `ArquivoCliente`, nunca copiar blob.
2. **Arquivo em uso não é removido.** "Remover" só marca `removidoEm` quando nenhuma referência de
   §3.3 aponta para ele; se aponta, a API responde 409 com a lista de usos e a tela explica. Relatório
   já gerado nunca perde a entrada.
3. **Entrega só por `/api/arquivos/[id]`** (`?modo=inline` para pré-visualização, padrão download):
   confere `podeVerCliente`, grava `AcessoArquivo`, devolve o conteúdo com `Content-Type` e
   `Content-Disposition`. `urlBlob` nunca chega ao navegador.
4. **Upload sempre direto ao Blob.** Generaliza o padrão do `upload-token` da Proposta: o navegador
   sobe para um caminho temporário (expira em 1h), o servidor registra — baixa do Blob servidor a
   servidor, calcula o hash, move para o caminho final `clientes/{clienteId}/{arquivoId}/{nome}`.
   Nenhum arquivo passa pelo corpo de uma requisição do VerAI.
5. **Permissão = `podeVerCliente`** para ler, enviar, classificar e remover. A regra do `uploader`
   continua valendo só no fluxo antigo de `Documento`.

### 3.5 A aba Documentos

- **Topo**: total de arquivos e tamanho; botão **Enviar arquivos**.
- **Envio**: vários arquivos de uma vez (reusa `src/components/multi-file-dropzone.tsx`). Cada arquivo
  vira uma linha a classificar antes de confirmar: categoria (obrigatória), contrato e competência
  (opcionais). Categoria **sugerida pelo nome**, sempre confirmada pelo usuário: `PC_…` → proposta
  comercial, `PA_…` → proposta de aditivo, `TC_…` → termo de contrato, `TA_…` → termo aditivo,
  `.xlsx` com "medi"/"levant" no nome → medição, resto → outro.
- **Duplicado**: o navegador calcula o SHA-256 (`crypto.subtle`) **antes de subir** e pergunta ao
  servidor; se o cliente já tem o arquivo, a linha mostra "já está no repositório como *X*" e não
  envia. O servidor recalcula ao registrar (não confia no hash do navegador).
- **Lista**: tabela única, mais recentes primeiro; filtros por categoria, contrato, competência e
  tipo; busca por nome. Colunas: nome (ícone pelo tipo), categoria, contrato, competência, tamanho,
  enviado por/em, **usado em** (contador).
- **Painel do arquivo** (clique na linha): pré-visualização de PDF, metadados editáveis (categoria,
  contrato, competência), **onde é usado** com link para cada lugar (linha do histórico do contrato,
  faturamento, execução do ConfereAI, proposta comercial, análise antiga), **Baixar** e **Remover**
  (desabilitado enquanto em uso, com o motivo).
- **Auditoria**: model `AcessoArquivo` (`arquivoId`, `usuarioId`, `acao`: `visualizou` | `baixou`,
  `createdAt`), gravado pela rota de entrega. `AcessoDocumento` continua para o fluxo antigo.

### 3.6 ConfereAI com cliente (revisa a decisão de 21/09)

O ConfereAI pede três arquivos, e cada um tem lugar natural no domínio de contratos:

| Campo do Confere | O que é (texto da própria tela) | Preenchimento automático | Sem candidato ou mais de um |
|---|---|---|---|
| Contrato (`.pdf`) | "Proposta comercial em PDF, com a tabela de itens" | PC da linha `Contrato` do histórico | lista das `PROPOSTA_COMERCIAL` do contrato |
| Aditivos (`.pdf`, vários, em ordem de aplicação) | "aplicados na ordem em que forem selecionados" | PA das linhas `Aditivo` com `data` até o último dia da competência, em ordem cronológica (`data`, depois `createdAt`) | usuário remove/reordena |
| Levantamento (`.xlsx`) | "Planilha de medição da competência" | `MEDICAO` do contrato + competência | lista para escolher — nunca escolhe sozinho entre dois |

- **Tela**: o formulário continua a cópia fiel do Confere (nenhum campo, texto ou layout muda).
  Entra um componente **novo, do VerAI**, acima dele — "Buscar do cliente (opcional)": Cliente →
  Contrato → Competência. Campo preenchido mostra o nome e a origem ("do repositório · TC 012/2020")
  com **Trocar**. Soltar arquivo do computador continua possível em qualquer campo; com cliente
  escolhido, o arquivo entra no repositório já classificado (contrato → `PROPOSTA_COMERCIAL`, aditivo
  → `PROPOSTA_ADITIVO`, levantamento → `MEDICAO`, com contrato e competência).
- **Envio por referência, sempre** (com ou sem cliente): rota nova recebe JSON
  cada um dos três campos é `{ arquivoId }` (um `ArquivoCliente` — obrigatório quando há
  `clienteId`) ou `{ uploadTemporario }` (o caminho devolvido pelo upload direto; o servidor só aceita
  caminhos sob o prefixo temporário). Corpo: `{ clienteId?, contratoId?, competencia?, contrato,
  levantamento, aditivos[] (em ordem), identidadeConfirmada }`. O servidor baixa do Blob e chama o
  `chamarConfere()` de sempre; a resposta mantém o contrato atual (200 / 422 com `bloqueantes` /
  erro). A conferência prévia (`/reports/conferencia-previa`) segue o mesmo caminho. Isso elimina o
  limite de 4,5 MB do Confere nos dois modos.
- **Sem cliente**: uploads temporários, **não entram no repositório**, `ConfereExecucao` grava como
  hoje (nomes + `caminhoDocx/Xlsx`). Continua sendo a ferramenta sem estado de antes.
- **Com cliente**: DOCX e XLSX gerados entram no repositório como `RELATORIO_GERADO`, origem
  `gerado`, com cliente/contrato/competência; `ConfereExecucao` guarda as referências de §3.3.
  `/confere/historico` ganha coluna e filtro de cliente/contrato, e cada execução abre as entradas.
- **Evitar repetição**: se já existe execução com os mesmos arquivos (mesmos ids, mesma ordem de
  aditivos), a tela avisa "já gerado em dd/mm — abrir resultado" antes de gastar os ~25 s; gerar de
  novo continua possível.
- **O que muda do que estava decidido** (atualizar `2026-09-21-integracao-confere-design.md` e o
  `CLAUDE.md` junto com a fase 3): "sem vínculo com cliente" → vínculo opcional; "entradas não são
  guardadas" → continua valendo sem cliente; "cópia fiel" → o formulário continua fiel, o bloco
  "Buscar do cliente" é acréscimo do VerAI, fora dos arquivos copiados do Confere.

### 3.7 Migração do que já existe

| Origem | Tratamento |
|---|---|
| `Documento` | Script (`scripts/migrar-documentos-para-repositorio.ts`, lista por padrão, `--aplicar` grava, idempotente) cria um `ArquivoCliente` por documento com **a mesma URL** (sem copiar blob), origem `migrado`, categoria `PLANILHA` para xlsx/csv e `OUTRO` para o resto, competência aproveitada, `enviadoPorId` = `uploadedById`; preenche `Documento.arquivoId`. Documentos com o mesmo hash no mesmo cliente apontam para o mesmo registro. |
| Anexos de histórico/faturamento | Ainda não estão em produção: **mudam antes de entrar** — as colunas `*PdfUrl` viram `*ArquivoId` (fase 2). |
| Proposta Comercial (52, sem cliente) | Sem vínculo automático. A tela da proposta ganha "Cliente (opcional)"; preenchido, os arquivos dela entram no repositório por referência (mesmo blob). |
| `ConfereExecucao` existentes (5) | Ficam sem cliente. |

### 3.8 Fases — um plano por fase, cada uma entregável sozinha

1. **Fundação + aba** — `ArquivoCliente`, `AcessoArquivo`, serviço `src/lib/arquivos/` (token de
   upload genérico, registrar com hash e deduplicação, entregar autenticado, usos de um arquivo,
   remover com checagem de uso), rotas `/api/arquivos/*` e `/api/clientes/[clienteId]/arquivos`,
   aba nova, script de migração dos `Documento`.
2. **Anexos de contrato e faturamento por referência** — PC/PA/TC/TA do histórico e o PDF do
   faturamento apontam para o repositório; "copiar PDF existente" vira "escolher do repositório";
   o link direto `pdfUrl` some. **Depende de combinar com a sessão que está criando esses anexos.**
3. **ConfereAI com cliente** (§3.6). Depois da 2, porque o preenchimento automático lê PC/PA do
   histórico.
4. **Proposta Comercial com cliente.**

## 4. Riscos

- **Sessão paralela.** Os anexos de PDF de histórico e faturamento estão sendo criados agora, sem
  commit, com colunas de URL. Se forem para produção antes da fase 2, a fase 2 vira migração de dados.
  Combinar antes do commit.
- **Blob público.** Continua `public` com URL não adivinhável; a garantia passa a ser "a URL nunca
  sai do servidor". Blob privado de verdade fica como melhoria futura.
- **Premissas do Confere** mudam (§3.6) — documentos de referência precisam ser atualizados na fase 3.

## 5. Fora de escopo

- "Analisar com IA" como ação sobre um arquivo do repositório (substituto do fluxo por competência).
- Texto extraído cacheado no `ArquivoCliente` para reuso entre módulos.
- Pastas livres, versões de um mesmo documento, assinatura digital.
- Vínculo automático das propostas comerciais existentes a cliente.

## 6. Referências

- Varredura e decisões: conversa de 23/09/2026.
- `src/lib/storage.ts`, `src/app/api/propostas-comerciais/upload-token/route.ts` (padrão de upload
  direto), `src/app/api/documentos/[id]/original/route.ts` (padrão de entrega autenticada).
- `src/lib/relatorios-clientes/pdfs-existentes.ts` (o "copiar" que a fase 2 substitui).
- `src/app/confere/lib/types.ts` (`CAMPOS`, `CAMPO_ADITIVOS`), `src/app/api/confere/reports/route.ts`,
  `src/lib/confere/cliente.ts`.
- `docs/superpowers/specs/2026-09-21-integracao-confere-design.md`,
  `docs/superpowers/specs/2026-09-22-relatorios-clientes-design.md`.

## 7. Revisão de 23/09/2026 (fim da tarde) — decisões do usuário que mudam §3.2, §3.3 e §3.6

Vêm da varredura de consistência de contrato/cliente feita no mesmo dia (tudo que liga a cliente,
contrato, proposta e aditivo tem que ter UMA fonte). **Onde conflitam com as seções acima, valem estas.**

### 7.1 Decisão 1 — contrato e competência ficam SÓ em quem usa o arquivo

`ArquivoCliente` **não guarda** `contratoId` nem `competenciaAno/Mes`. Quem diz "este arquivo é do
contrato X, competência Y" é o consumidor (§3.3): a linha do histórico (pelo contrato dela), o
faturamento (contrato + competência dele), a execução do ConfereAI (contrato + competência dela), o
`Documento` (competência dele). Motivo: com o dado nos dois lados nada impede que divirjam (arquivo
"do contrato A" pendurado no faturamento do contrato B), e a aba mostraria o contrato errado.

- `ArquivoCliente` fica com: cliente, **categoria** (o que o arquivo É — proposta, termo, medição…),
  nome, tipo, tamanho, hash, origem, quem enviou, datas.
- "Contrato" e "competência" na lista, nos filtros e no painel da aba Documentos são **derivados dos
  usos** (`usosDosArquivos`): um arquivo pode aparecer em vários contratos/competências; arquivo ainda
  sem uso aparece como "não usado".
- O envio pela aba classifica só a **categoria**. Ligar a contrato/competência é anexar no lugar certo
  (linha do histórico, faturamento, ConfereAI) — escolhendo do repositório.
- Reclassificação (`PATCH /api/arquivos/[id]`) muda só a categoria.

### 7.2 Decisão 2 — o mesmo arquivo pode servir a vários contratos

Consequência direta da 7.1: como o arquivo não tem "um contrato", o mesmo PDF pode ser o PA de um
aditivo no contrato A e estar no histórico do contrato B, sem cópia e sem registro duplicado. A regra
§3.4.1 (mesmo hash no mesmo cliente = mesmo registro) continua; ela deixa de ter o efeito colateral de
"voltar com a classificação antiga".

### 7.3 O que muda no que já foi feito (Fase 1, Tasks 1–7) — ajuste antes da Fase 2

1. Migração: remover `contratoId`, `competenciaAno`, `competenciaMes` e o índice `(contratoId)` de
   `ArquivoCliente` (e a relação `Contrato.arquivos`).
2. `src/app/api/clientes/[clienteId]/arquivos/esquema.ts` e `route.ts`, `src/app/api/arquivos/[id]/route.ts`,
   `src/lib/arquivos/servico.ts` (`SELECT_ARQUIVO`, `DadosRegistro`): sem contrato/competência.
3. `usosDosArquivos` passa a devolver contrato e competência de cada uso (hoje só `Documento`); a aba
   filtra por eles.
4. Envio na aba (Task 7): tirar os campos contrato e competência de cada linha.
5. Script de migração dos `Documento` (Task 8): não copia competência pro arquivo — ela já está no
   `Documento`.

Concluído em 24/09/2026 (migração 20260924140000_arquivo_cliente_sem_contrato_competencia).
A migração descarta de vez a classificação por contrato/competência gravada no arquivo; no banco
local havia 0 arquivos (`0|0|0` — com contrato | com competência | total) e a Fase 1 não foi para
produção, então nada se perdeu. Em qualquer banco onde a Fase 1 tenha rodado com uso real, contar
antes de aplicar.

### 7.4 Fases 2 e 3 com a decisão

- **Fase 2**: as colunas `propostaPdfUrl/termoPdfUrl/pdfUrl` **já foram commitadas** (`b46541a`), então a
  fase 2 inclui migrar os anexos existentes (um `ArquivoCliente` por blob, dedup por hash, preencher
  `*ArquivoId`) antes de apagar as colunas. **E o índice do assistente de IA**
  (`src/lib/assistente/indexacao/fontes.ts`, origens `HISTORICO_PROPOSTA`, `HISTORICO_TERMO`,
  `FATURAMENTO_PDF`) lê essas colunas: migrar junto, trocando para a origem `ARQUIVO_CLIENTE` ou
  lendo pelo `*ArquivoId`.
- **Fase 3 (ConfereAI)**: candidatos de "Contrato" = PC das linhas `CONTRATO` do histórico do contrato;
  sem candidato, lista das `PROPOSTA_COMERCIAL` **do cliente**. "Levantamento" = `MEDICAO` já usada numa
  execução daquele contrato + competência; senão, lista das `MEDICAO` do cliente para escolher. A
  execução gravada é que passa a dizer contrato + competência do arquivo.
