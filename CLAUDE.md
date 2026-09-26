# VerAI — guia para sessões de IA

Plataforma Next.js/TypeScript (App Router) + Prisma/Postgres, multi-tenant, para produtos de
inteligência sobre documentos da PRODAM-SP. Qualquer sessão de IA que abrir este repositório deve
ler este arquivo primeiro.

## Convenções do projeto

- **Fluxo de planejamento**: mudança não trivial passa por um plano em
  `docs/superpowers/plans/AAAA-MM-DD-nome.md`, geralmente acompanhado de um design em
  `docs/superpowers/specs/AAAA-MM-DD-nome-design.md`. Os planos são tarefa por tarefa, TDD
  (teste falhando → implementação → teste passando → commit) — ver qualquer arquivo existente em
  `docs/superpowers/plans/` como referência de formato antes de escrever um novo.
- **Stack**: Next.js 15 (App Router, Turbopack), React 19, Prisma 6/Postgres, Tailwind 4,
  Jest + Testing Library, `@react-pdf/renderer` para relatórios em PDF, Vercel Blob para storage
  de upload (`src/lib/storage.ts`).
- **Domínios principais hoje**: `Cliente` → `Documento`/`Analise` (análise por IA de um documento
  isolado), `AnaliseConsolidada` e `AnaliseEvolucao` (comparações dentro/entre competências —
  vivem como abas em `src/app/clientes/[id]/[competencia]/page.tsx`), `PropostaComercial`
  (checagem de propostas comerciais: conferência determinística de totais + checagem por IA).
- **Padrão de relatório**: toda geração de relatório segue o mesmo desenho — campo
  `caminhoRelatorioPdf`/`relatorioGeradoEm` no model, serve do cache se o arquivo ainda existir no
  storage, senão gera e atualiza; grava acesso em `AcessoDocumento`. Ver
  `src/app/api/documentos/[id]/relatorio/route.ts`,
  `src/app/api/analises-consolidadas/[id]/relatorio/route.ts` e
  `src/app/api/analises-evolucao/[id]/relatorio/route.ts` como referência antes de criar uma rota
  de relatório nova.

## Reparo da camada de texto do PDF

PDF impresso via **"Microsoft: Print To PDF"** (em vez de exportado pelo Word)
vem com a tabela `ToUnicode` das fontes errada: o desenho na página está certo,
mas o texto extraído troca letras (`licenşas`, `confìrmação`, `execuçáo`). Não é
bug da nossa extração — qualquer biblioteca e o próprio Ctrl+C do Acrobat
devolvem o mesmo. `src/lib/extracao/repararTextoPdf.ts` conserta isso de forma
determinística (três regras: glifo impossível em português, padrão ortográfico
impossível, auto-consistência do documento), aplicado em `converterPdfParaHtml`
logo depois de `extractTextItems`.

Invariante que não se negocia: **token com dígito nunca é alterado** — valor,
código de serviço e data passam intactos sempre; glifo estranho dentro de número
vira alerta pra conferência humana, nunca correção. PDF são sai byte a byte
igual à entrada.

Antes de mexer nisso, leia
`docs/superpowers/specs/2026-09-21-reparo-camada-texto-pdf-design.md` — inclui a
causa raiz medida, o que ficou fora (tabela) e a recomendação de processo
(receber `.docx` em vez de PDF impresso).

## Régua da conversão

Antes de mexer em QUALQUER heurística de `src/lib/extracao` (tabela, título,
corredor, sublinhado), rode `npm run diag:pdf -- ./arquivos-teste-conversao`
antes e depois, nos mesmos arquivos, e compare. Defeito de conversão anda junto
com o GERADOR do PDF (`Microsoft: Print To PDF` quebra de um jeito, o
`wkhtmltopdf` do SEI de outro), e é por gerador que a régua agrega. Ajustar
constante no olho em cima do exemplar da vez conserta aquele documento e quebra
outros três.

O conversor NÃO deve ramificar por gerador: cada decisão sai da evidência do
próprio documento. O gerador serve pra medir e avisar.

## Integração do Confere

O serviço **Confere** (Python/FastAPI separado, mantido pela PRODAM, deploy em
`https://confere-backend.onrender.com` — plano free: ~23 s pra acordar e 70–135 s de geração,
medidos em 24/09/2026) compara contrato × medição
e gera relatório de comprovação (DOCX + XLSX). Dentro do VerAI ele vive em `/confere`
(`src/app/confere/`): **cópia fiel do frontend próprio do Confere**
(`services/confere/frontend/`, copiado wholesale nesta integração — mantido no repo só como
referência/fonte, não faz parte do build do VerAI), não uma tela redesenhada no estilo
institucional do VerAI. Mesmo texto, mesmo layout, mesma paleta (tokens `confere-*` em
`src/app/globals.css`, namespaced pra não colidir com a paleta institucional `navy`/`orange`).

**Decisão de arquitetura (2026-09-21, revista no mesmo dia — ver "Nota de processo" no design
doc):** a primeira versão desta integração (Tasks 3–7 do plano) entrou como uma quarta aba dentro
de `src/app/clientes/[id]/[competencia]/page.tsx`, com um model `AnaliseMedicaoContratual` no
Prisma vinculado a `Cliente` + competência, upload dedicado e upsert por competência. **Essa
versão foi removida no mesmo dia**, a pedido explícito do usuário: "não vamos vincular a cliente e
nada do tipo" + "ele precisa ficar a cópia do Confere, do mesmo jeito". A versão atual:

- **Área solta no menu, mas o levantamento busca o contrato no cadastro** (25/09/2026) — `/confere`
  continua fora do fluxo de cliente (como "Proposta Comercial"), só que escolher a planilha lê o
  cabeçalho ("conforme contrato : TC 52/SMIT/2024", "Data do Levantamento") e preenche Contrato e
  Aditivos com as PC/PA que o SharePoint guardou: base = PA da **última renovação** em vigor na
  competência (senão a PC), aditivos = PAs depois dela. Sem contrato achado, sugere e busca; envio pelo
  computador continua em todos os campos e a escolha manual nunca é trocada sozinha. Regras em
  `src/lib/confere/` (`levantamento.ts` lê o XLSX pelo zip — o exceljs não abre esses arquivos;
  `identidade.ts`, `localizar-contrato.ts`, `documentos-do-contrato.ts`, `cadastro.ts`). Design
  `docs/superpowers/specs/2026-09-25-confere-contrato-do-cadastro-design.md`, plano
  `docs/superpowers/plans/2026-09-25-confere-contrato-do-cadastro.md`. A janela **"Pastas do
  cliente"** (`JanelaDePastas`, `GET /api/confere/clientes/[clienteId]/pastas`,
  `src/lib/confere/pastas.ts`) navega nas pastas do SharePoint para escolher proposta e aditivos —
  só lê `ArquivoSharepoint.caminho`, nenhuma pasta nova no VerAI —, e os cartões aceitam arrastar e
  soltar do seu tipo (`useSoltarArquivos`). Design
  `docs/superpowers/specs/2026-09-25-confere-ux-pastas-design.md`.
- **Geração sem estado, com histórico ao lado** — a aplicação portada continua sem estado: sobe os
  arquivos, gera, baixa DOCX/XLSX. As duas tabelas da primeira versão foram revertidas por migração
  (`prisma/migrations/20260921160000_remove_analise_medicao_contratual/`). O que existe hoje é um
  **registro do que passou pela ferramenta**, adicionado depois a pedido do usuário
  (`model ConfereExecucao`, migração `20260921180000_add_confere_execucao`): o **nome** dos
  arquivos submetidos (contrato, levantamento e aditivos — os arquivos de entrada **não** são
  guardados em lugar nenhum) e os dois documentos gerados, no Vercel Blob, pra rebaixar sem repetir
  a geração. Desde 25/09/2026 guarda também o **contrato** (`contratoId`, `SetNull`) e a
  **competência** lida da planilha, e a listagem mostra os dois. A gravação é **best-effort** dentro
  do proxy: o relatório já está no corpo da resposta, e falha de storage ou de banco não derruba a
  entrega. A listagem vive em `/confere/historico` (sub-item do grupo "ConfereAI" no menu), servida
  por `/api/confere/execucoes`.
- **É a porta de entrada do sistema** — login e o middleware redirecionam para `/confere` (não
  mais `/clientes`), e é o terceiro grupo do menu lateral, depois de "Relatórios dos clientes" e "Proposta Comercial"
  (`src/components/nav-bar.tsx`) — a posição no menu é a do ambiente local, não a primeira.
- **Proxy próprio** (`src/app/api/confere/reports/route.ts`) — o navegador nunca fala direto com o
  Confere nem conhece `CONFERE_SHARED_SECRET`; a rota recebe o mesmo multipart que o Confere
  espera, chama `chamarConfere()` (`src/lib/confere/cliente.ts`, construído em Task 5 e reaproveitado
  sem mudanças) e devolve a resposta dele quase sem tocar. É também onde a execução é registrada no
  histórico, no caminho de sucesso e só nele. Contrato e aditivos podem vir **por id do cadastro**
  (`contrato_arquivo_id`, `aditivos=cadastro:<id>`): a rota confere o acesso e baixa o PDF do R2 —
  `urlBlob` nunca vai ao navegador, e o corpo da requisição fica só com a planilha.
- **Orçamento de tempo em cadeia** — `maxDuration = 300` (teto do Hobby com Fluid, e já o padrão);
  o Confere recebe o que sobra menos 30 s e o estouro vira 504 **com `detail`**; o navegador espera
  310 s, mais que o proxy. **Não baixe esses números sem medir o Confere antes**: com 120 a Vercel
  matava a função no meio da geração (o 504 de 24/09/2026 — adendo no design doc).

- **Sem faixa de marca própria** — a barra de aplicação do Confere (logo + "Confere o contratado. /
  Confere o utilizado.") e o rodapé institucional da Prodam foram removidos: dentro do VerAI a
  identificação do produto é a barra lateral, e repetir marca em cima e embaixo roubava ~180 px de
  altura útil. A tela abre com um `<h1>` de texto ("ConfereAI") no padrão das outras páginas, e a
  referência do contrato + competência, que viviam na barra, ficam no cartão "Relatório gerado".

- **Design/decisões**: `docs/superpowers/specs/2026-09-21-integracao-confere-design.md`
- **Plano de execução**: `docs/superpowers/plans/2026-09-21-integracao-confere.md`

Qualquer sessão que for mexer nisso lê os dois documentos acima antes de tocar em código — eles
são a fonte de verdade sobre o que já foi decidido e o que falta. Ao avançar o trabalho, atualize
os dois (marque tarefa concluída, registre decisão nova) em vez de deixar o código divergir do que
está escrito ali.

## Relatórios dos clientes — regra única de contrato e SEI

**Contrato tem UMA definição, em `src/lib/relatorios-clientes/contratos-consolidados.ts`.** Ficha do
cliente (cartões), aba Contratos, detalhe do contrato, relatórios de vencimento, valor total e status
de faturamento chamam `consolidarContratos()` — nenhuma rota recalcula "ativo", vencimento, valor ou
saldo por conta própria (foi isso que fazia as telas divergirem). A regra: fim de vigência = maior
vencimento entre o cabeçalho e as linhas do histórico **assinadas** (`vigenciaEfetiva`/`linhaAssinada`
em `regras.ts` — aditivo/prorrogação sem "Assinada em" nem situação assinada não estende; vira o aviso
`prorrogacaoEmAndamento`); ativo = não rescindido + situação sem encerramento + (situação "Ativo" OU
vigência que não passou) — "Ativo" com prazo vencido segue ativo com o aviso `situacaoDesatualizada`;
valor contratado = valor do último termo assinado do histórico (nunca rescisão nem prospecção), senão
soma dos itens, senão `null` (fora das somas, as telas avisam); saldo e % faturado usam essa mesma base,
e faturamento **Cancelado** não entra no faturado (`situacao-faturamento.ts`). Um lançamento
**principal** por contrato + competência; complementar à parte. Rota nova que mostra contrato **usa o consolidado**, não `contratoAtivo`/`saldosDosContratos` direto.

**Item de contrato nunca fica solto de propósito.** `vincularItensOrfaos()` (`vincular-itens.ts`) liga
por casamento tolerante (caixa, acento, zero à esquerda, SEI, nº do histórico) e só quando é único; roda
no importador e ao criar/editar contrato e histórico. `npx dotenv -e .env.development -- npx tsx
scripts/reconciliar-clientes.ts [--aplicar] [--detalhe] [--integridade]` lista/corrige o que sobrou.

**SEI sempre pelo componente `SeiLink`** (`src/components/relatorios-clientes/sei-link.tsx`): número
com máscara, clicável em qualquer tela (abre o processo se houver link cadastrado ou o modelo
`NEXT_PUBLIC_SEI_URL_TEMPLATE`; senão o clique copia o número). Nunca renderizar `contrato.sei…` como
texto puro. Link é **por número** (tabela `LinkSei`): `Contrato.linkSei` do legado é o do SEI do
cliente e foi migrado pra lá (migração `20260924130000`) — não passar `link={contrato.linkSei}` pro SEI PRODAM. Formatação/URL em `src/lib/relatorios-clientes/sei.ts`.

## Repositório de documentos do cliente

**Arquivo de cliente existe num lugar só: `ArquivoCliente`** (aba Documentos da ficha,
`src/app/clientes/[id]/abas/aba-documentos.tsx`; serviço em `src/lib/arquivos/`). Quem usa um
arquivo guarda `...ArquivoId` — nunca URL própria nem cópia do blob. Upload sempre direto ao Blob
(`/api/arquivos/upload-token`, caminho `tmp-arquivos/`) e registro servidor a servidor
(`registrarArquivo`: hash SHA-256, sem duplicado no cliente); entrega sempre por
`/api/arquivos/[id]` (checa `podeVerCliente`, grava `AcessoArquivo`) — `urlBlob` nunca vai pro
navegador. Remoção é lógica e bloqueada enquanto `usosDosArquivos` achar uso; módulo novo que
referencia arquivo **acrescenta sua fonte em `usosDosArquivos`**.

Contrato e competência **não** são do arquivo: cada uso (`UsoArquivo`, em `src/lib/arquivos/tipos.ts`)
traz o seu `contrato`/`competencia`, e a aba deriva as colunas e os filtros daí — fonte nova de uso
precisa preencher os dois.

Design e fases:
`docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md`.

Toda migração gerada daqui em diante deve ser conferida — se aparecer `DROP INDEX
"ArquivoCliente_clienteId_sha256_ativo_key"`, remova a linha (o índice é único parcial, criado à mão
em `20260924100000_repositorio_arquivos_cliente`).

## Sincronização com o SharePoint (ContratosReceita)

A biblioteca ContratosReceita (lida pela pasta do OneDrive no PC do Lucas) é a **fonte** de duas
coisas, numa passada só de `scripts/sincronizar-sharepoint.ts` (Agendador do Windows, instalado por
`scripts/agendador-sharepoint.ps1` — a cada 30 min, do PC do Lucas): (1) a aba **Documentos** de
cada cliente tem **todos** os arquivos da pasta dele — `WORK/` incluída, qualquer extensão; publicação da pasta
`1. PUBLICAÇÕES NO DOC` vai pro cliente da sigla no nome (`rotearPeloNome`); (2) a aba **Contratos**
recebe cada pasta de termo na linha certa do histórico, com SEI, datas, vigência e valor lidos do PDF
do termo. Cliente só nasce de pasta de cliente (`garantirClientes`, pela sigla ou
`scripts/sharepoint-clientes.json`), nunca por nome. Estado por caminho em `ArquivoSharepoint` (com
`contratoId`/`historicoId` de onde o arquivo caiu); código em `src/lib/arquivos/sharepoint/` e
`src/lib/importacao-sharepoint/`.

Regras que não se negociam (spec `docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md`,
que revisa `2026-09-24-sincronizacao-sharepoint-contratos-design.md`):
- **Identidade estável** (`src/lib/importacao-sharepoint/identidade.ts`): contrato = `sigla|nº ano`;
  termo → linha por mesmo caminho → tipo+número → conteúdo. Mover pra "Contratos Finalizados",
  renomear `TA XX`→`TA 03` ou pasta repetida **nunca** duplica. Não volte a usar caminho como chave
  (`HistoricoContrato.chaveSharepoint` é só pista e marca de origem).
- **PC/PA e TC/TA por referência** (`propostaArquivoId`/`termoArquivoId`): a coluna preenchida pelo
  SharePoint (`*DoSharepoint`) acompanha o SharePoint; a anexada à mão nunca é trocada. A API devolve
  `*PdfUrl` calculado (`anexosDaLinha`, `src/lib/relatorios-clientes/anexos-historico.ts`), apontando
  pra `/api/arquivos/[id]`. Gravar coluna sempre por `dadosDaColuna`.
- Campo do termo só preenche o que está vazio (marcadores `TA XX`/`Em elaboração` contam como vazios).
- Sumiu do SharePoint: coluna do SharePoint esvazia e o arquivo sai (remoção lógica), a não ser que
  algo do VerAI o use (análise, anexo à mão) — aí fica marcado "fora do SharePoint".
- Cada execução com `--aplicar` termina com **conferência** por cliente (caminhos no SharePoint × no
  VerAI); divergência sai no log e o script termina com código 2. Depois vem a **auditoria das contas**
  (`src/lib/importacao-sharepoint/auditoria.ts`, pelo `consolidarContratos()`) dos clientes tocados:
  finalizado com vigência correndo, ativo sem valor, contrato inicial/termo/contrato duplicado. Só
  aponta, não corrige — tipo de achado novo entra lá, com teste.
- Nada grava sem `--aplicar`; `--clientes=` restringe listagem **e** remoção (use em dev: dev e
  produção dividem o mesmo bucket do Cloudflare R2). Antes da primeira execução num banco:
  `scripts/migrar-sharepoint-lugar-certo.ts` (a sincronização recusa rodar com migração pendente).
- **Automação**: roda sempre do PC do Lucas, a cada 30 min, pelo Agendador do Windows — sem e-mail,
  painel ou selo na tela (decisão do usuário). `scripts\agendador-sharepoint.ps1 -Estado` mostra a
  última execução. O Agendador só enxerga o `conhost --headless` (o que evita a janela), que devolve
  sempre 0: o código de verdade o `.bat` grava no log (`[fim … - codigo N]`) e o `-Estado` lê dali —
  não troque isso pelo "resultado" do Agendador. Spec
  `docs/superpowers/specs/2026-09-24-sharepoint-automacao-design.md`, plano
  `docs/superpowers/plans/2026-09-24-sharepoint-automacao.md` — leia antes de mexer no agendador.
- **Régua da leitura**: antes de mexer em regra de estrutura ou identidade (`estrutura.ts`,
  `identidade.ts`, `regras.ts`, `scripts/sharepoint-clientes.json`), rode
  `npx tsx scripts/regua-sharepoint.ts --salvar`; depois da mudança, rode sem `--salvar`. Ela relê a
  **mesma** lista de arquivos com o código novo e lista, por cliente, cada pasta que passou a ser lida
  de outro jeito. Consertar o exemplar da vez sem olhar a régua quebra outro cliente (tirar "apostil"
  do aditivo muda SMTUR e SMUL, por exemplo).

## Consistência de números e vínculos (varredura de 23/09/2026)

- **Uma regra só pra ler valor digitado**: `src/lib/relatorios-clientes/numero.ts`
  (`normalizarDecimal`). Tela (validação das rotas), planilha de itens e importador do GRC-1 usam a
  mesma — "1.500" é ambíguo e é recusado em todo lugar; célula numérica do Excel entra como número.
  Não escrever parser de valor novo.
- **Reimportar o GRC-1 não sobrescreve** o que já existe (valor digitado, item vinculado à mão,
  demanda trocada de cliente...). `--sobrescrever` força a origem por cima de tudo — só de propósito.
- **Item do legado nunca vai pra contrato de outro cliente**, nem no vínculo manual
  (`PATCH /api/itens-contrato/[id]` recusa; a busca `?contratoId=` só lista os do cliente).
- **Contrato com itens ou termos não é excluído** (409), nem CO com termos — a FK deles é `SET NULL` e
  soltaria tudo em silêncio. Nº do termo repetido no mesmo cliente (chave tolerante) é recusado.
- **Excluir cliente tem UMA regra** (`src/lib/relatorios-clientes/excluir-cliente.ts`), só admin, usada
  pela ficha e por "Gerenciar clientes". Model novo ligado a cliente entra lá (e no mesclar).
- **Arquivo do repositório não guarda contrato nem competência** e pode servir a vários contratos
  (decisão do usuário, 23/09) — quem diz contrato/competência é quem usa o arquivo. Ver §7 de
  `docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md`.
- Achados ainda abertos e a ordem de correção: `docs/superpowers/plans/2026-09-23-consistencia-contratos.md`.

## Assistente de IA (botão flutuante)

Chat em todas as telas (`src/components/assistente/`, montado no `layout.tsx`, Ctrl+K) que responde
sobre tudo do VerAI usando **ferramentas somente-leitura** (`src/lib/assistente/ferramentas/`) —
nunca SQL livre, nunca escrita. Toda ferramenta recebe o usuário por closure e filtra por
permissão; contrato sempre via `consolidarContratos()`. Ferramenta nova: um `definirFerramenta` +
registro em `ferramentas/index.ts` + rótulo em `ferramentas/rotulos.ts` + teste de permissão.

Texto dos documentos: `TrechoDocumento` (full-text do Postgres, `unaccent`), mantido por
**sincronização** banco × índice (`sincronizarIndice`) — sob demanda na busca, cron diário
(`/api/assistente/indexar/cron`), botão em `/admin/assistente` e
`npx dotenv -e .env.development -- npx tsx scripts/indexar-documentos.ts [--reindexar]`. Origem de
arquivo nova = mais um caso em `indexacao/fontes.ts` (e em `hrefDoTrecho`/`linkDoTrecho`), sem gancho
em rota de upload. Além das origens antigas há `ARQUIVO_CLIENTE` (arquivo do repositório que não é
PC/PA/TC/TA do histórico nem `Documento`). A sincronização do SharePoint com `--aplicar` termina
indexando até 200 arquivos (não muda o código de saída); erro é tentado de novo depois de 24 h; acima
de 80 MB em `TrechoDocumento` a indexação para e a decisão é do usuário. PDF escaneado fica
`sem_texto` (OCR do projeto roda no navegador).

**O modelo recebe texto compacto, a tela recebe o objeto** (`ferramentas/compacto.ts`, via
`toModelOutput`): tabela com cabeçalho uma vez, sem vazios nem `href`, corte por linha a 8.000
caracteres. Ferramenta nova devolve o objeto de sempre e, se o genérico não servir, um `compactar`.
Links que a IA escreve são `tipo:id` e passam por `/ir/[tipo]/[id]` (confere permissão; o
`urlTransform` do markdown deixa esses esquemas e `sei:` passarem). Cliente e contrato citados na
pergunta — e os ids usados nas últimas 3 respostas — entram no contexto antes da IA
(`entidades.ts`, `preparar.ts`), nunca no `system`. Antes e depois de mexer em ferramenta, formato
ou instrução, rode a **régua**: `npx dotenv -e <env> -- npx tsx scripts/regua-assistente.ts
[--com-ia] [--salvar] --comparar=<rodada salva em .superpowers/regua-assistente/>`.

Modelo: `ASSISTENTE_AI_*` (fallback `AI_*`), `deepseek-chat`. Instrução do sistema é fixa
(`instrucoes.ts`) para o cache do DeepSeek — data, tela aberta e "Já identificados" vão na mensagem,
não nela. Nunca pôr número real (SEI, id) como exemplo na instrução: a IA copia.

**Analista sênior (fase 2) — a senioridade fica no código, não no prompt:**
- **Alertas** em `src/lib/relatorios-clientes/alertas.ts` (regra pura, fora do assistente — as telas
  podem usar) + `alertas-banco.ts`; limiares num objeto só, `LIMIARES` (aprovados pelo usuário em
  26/09). Tipo novo de alerta entra lá, com teste. Ferramenta `alertas`.
- **Manual da equipe** em `src/lib/assistente/manual/` (um arquivo por tema, `status` rascunho ×
  validado; a equipe valida trocando o `status`). Rascunho não é regra; artigo de lei só com
  `[confirmar]`. Ferramenta `consultarManual`.
- **Textos oficiais** (`DocumentoReferencia`, origem `REFERENCIA`, cortados por artigo) entram por
  `scripts/referencias-assistente.ts --pasta=… [--aplicar]`; `buscarNasNormas` busca só neles e
  `buscarNosDocumentos` os exclui.
- **Fichas** (`FichaDocumento`) de cada PDF do histórico: regra → IA uma vez por versão → verificação
  literal (trecho na página citada, números do valor dentro do trecho; o que falha fica "não
  confirmado"). `scripts/fichas-documentos.ts` (sem `--aplicar` é a régua de cobertura das regras —
  rode antes e depois de mexer em `fichas/regras.ts`). Ferramenta `fichasDoContrato`.
- A sincronização do SharePoint com `--aplicar` termina com índice e fichas, cada etapa com guarda pela
  própria migração (`MIGRACAO_DO_INDICE`, `MIGRACAO_DAS_FICHAS`): o agendador roda o código da pasta
  contra produção, que pode estar num deploy anterior.

- **Design**: `docs/superpowers/specs/2026-09-23-assistente-ia-design.md`; fase 1 da melhoria (texto
  compacto, identificação, links curtos, índice): `docs/superpowers/specs/2026-09-25-assistente-base-economica-design.md`;
  fase 2 (analista sênior): `docs/superpowers/specs/2026-09-25-assistente-senior-design.md`
- **Plano**: `docs/superpowers/plans/2026-09-23-assistente-ia.md`; fase 1:
  `docs/superpowers/plans/2026-09-25-assistente-base-economica.md`; fase 2:
  `docs/superpowers/plans/2026-09-26-assistente-senior.md`
