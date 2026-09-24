# SharePoint → VerAI: tudo no lugar certo, sempre

**Data**: 23/09/2026 · **Status**: implementado em dev (Tasks 1–12, 24/09/2026); produção pendente (Task 14) ·
**Plano**: `docs/superpowers/plans/2026-09-23-sharepoint-lugar-certo.md`

**Revisa** `docs/superpowers/specs/2026-09-24-sincronizacao-sharepoint-contratos-design.md`: onde
conflitam, vale este. Muda lá §4 itens 2 (o que é ignorado), 4 (arquivo sem contrato), 7 e 8 (troca e
remoção com uso), §5 (modelo) e §8.3 (identidade de contrato e de linha). Antecipa, **só para o
histórico do contrato**, a Fase 2 de
`docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md` (§3.8 item 2 e §7.4).

## 1. Pedido

> "todas as pastas [precisam ser] organizadas do sharepoint dentro do cliente mesmo se tiver várias
> subpastas [...] toda vez que alguém atualizar o sharepoint o arquivo precisa entender e ir sempre
> pro lugar certo"
>
> "o verai já tem os clientes, as rotas, os lugares certos — precisa estruturar para as pastas
> ficarem nessa estrutura"
>
> "na aba documentos precisa ter todos, exatamente sempre todos que tem na pasta do sharepoint mesmo
> que seja atualizado; os demais precisa organizar igual tem"

Traduzindo em duas regras:

1. **Aba Documentos do cliente = todos os arquivos da pasta do cliente no SharePoint**, sempre iguais
   a ela (inclusive subpastas e `WORK/`), mais o que foi enviado à mão.
2. **As outras abas continuam organizadas como já são** (Contratos → contrato → histórico com PC/PA e
   TC/TA) e são alimentadas pelo SharePoint — sem árvore de pastas paralela.

## 2. Medição (23/09/2026, pasta `C:\Users\p017886\rede.sp\rede.sp - ContratosReceita`)

- 48 pastas na raiz, 936 pastas, **1.170 arquivos, 1,15 GB** (maior: 27 MB). 1.147 PDF, 14 xlsx,
  6 docx, 1 doc, 1 html. Profundidade até 6 níveis.
- Forma: `cliente / [Contratos Finalizados…] / TC contrato / N) termo / [WORK] / arquivo`. Exceções
  reais: contrato inteiro guardado dentro do aditivo de outro (SMIT TC 52/2024 dentro do TC 12/2023),
  termo solto na pasta do cliente (ICI, SUB-ITAM PAULISTA), duas pastas do mesmo cliente
  (`SUB-ITP` e `SUB-ITAM PAULISTA`; `SGM` e `SGM - CASA CIVIL`), mesmo contrato em ativos e em
  finalizados (SMSUB TC 01/2026).
- `montarEstrutura` põe 1.104 de 1.121 arquivos válidos em contrato + termo. Ficam fora: 15 da pasta
  `1. PUBLICAÇÕES NO DOC` (publicações de vários clientes, sigla no nome: `2026.09.17 - SIURB - …`),
  2 da SPURBANISMO (`TC  010--SP-URB-2026`: espaço e hífen dobrados), e 46 dentro de `WORK/` (regra).
- `WORK/` não é só rascunho: memória de cálculo, levantamento, despacho/extrato publicado no DOC,
  parecer jurídico, e-mail, proposta em `.docx`. As publicações do DOC chegam primeiro na pasta
  `1. PUBLICAÇÕES NO DOC` e depois são movidas para o `WORK/` do termo.
- Banco de desenvolvimento: o importador já rodou (231 contratos e 518 linhas com `chaveSharepoint`,
  845 PDFs **copiados** para as linhas); a sincronização de arquivos **nunca rodou** (0
  `ArquivoCliente`, 0 `ArquivoSharepoint`); não há tarefa no Agendador. Produção não foi lida.
- Duplicados já criados pela identidade atual: `SUB-ITP|1 2026` e `SUB-ITAM PAULISTA|1 2026` (dois
  contratos para o mesmo TC); TC 52/2024 da SMIT com duas linhas "contrato inicial".

## 3. Decisões

### 3.1 Aba Documentos tem tudo

- **Entra todo arquivo** da biblioteca. Fica de fora só lixo técnico: nome começando com `~$` (trava
  do Office) ou `.` (oculto), `desktop.ini`, `Thumbs.db`, arquivo vazio. `WORK/` entra. Extensão
  fora de `CONTENT_TYPES` entra como `application/octet-stream` (baixa, não pré-visualiza). Acima de
  50 MB continua fora e vai para o relatório (hoje não existe nenhum).
- **Publicações do DOC**: pastas listadas em `rotearPeloNome` de `scripts/sharepoint-clientes.json`
  (hoje `1. PUBLICAÇÕES NO DOC`) não são cliente; cada arquivo vai para o cliente cuja **sigla está
  no nome** — o trecho entre o primeiro e o segundo ` - ` (`2026.09.17 - SIURB - Sust. de TIC -
  Despacho.pdf` → `SIURB`), resolvido pelo mesmo `resolverCliente` (mapa `pastas` vale). Sigla que não
  casa (`SUB-ST`) **não cria cliente**: vai para o relatório.
- **Categoria** na criação do `ArquivoCliente`: pelo papel na pasta do termo (PDF do termo →
  `TERMO_CONTRATO` no contrato inicial, `TERMO_ADITIVO` nos demais; PDF da proposta →
  `PROPOSTA_COMERCIAL` / `PROPOSTA_ADITIVO`); publicação do DOC (pasta roteada ou nome começando com
  `DOC `) → **`PUBLICACAO_DOC`** (categoria nova, "Publicação no DOC"); senão `sugerirCategoria`,
  planilha → `PLANILHA`. Reclassificação feita na tela **nunca** é desfeita pela sincronização.
- **Onde está no SharePoint** vira um uso (`UsoArquivo` tipo `sharepoint`) com contrato e termo
  resolvidos (§3.3) — o filtro por contrato da aba já funciona com isso, e o painel do arquivo mostra
  o caminho. Continua valendo §7 do repositório: o `ArquivoCliente` não guarda contrato.
- Mesmo conteúdo em dois caminhos do mesmo cliente = **um** arquivo com os dois lugares (dedup por
  SHA-256, como hoje).
- **Removido do SharePoint** (e não reaparecido em outro caminho na mesma execução): sai da aba
  (remoção lógica). Se um módulo **do VerAI** o usa (análise por IA, ConfereAI, anexo feito à mão na
  linha do histórico), o registro fica — por causa desse uso — e a aba o mostra com a marca "fora do
  SharePoint". O uso `sharepoint` e os anexos que vieram do próprio SharePoint (§3.4) **não** seguram
  o arquivo.

### 3.2 Aba Contratos organizada como já é

| SharePoint | VerAI |
|---|---|
| pasta do cliente | `Cliente` (sigla ou mapa `pastas`; cria cliente como hoje, §8.3 do spec anterior) |
| `Contratos Finalizados…` | `Contrato.situacao = "Finalizado"` (só se vazio; divergência vira aviso) |
| pasta `TC …` | `Contrato` |
| pasta `N) termo` | linha do histórico (`HistoricoContrato`) |
| PDF do termo (TC/TA/TAP/TRA) | coluna TC/TA da linha |
| PDF da proposta (PC/PA) | coluna PC/PA da linha |
| demais arquivos da pasta do termo (inclusive `WORK/`) | só na aba Documentos, com contrato e termo |

Campos lidos do PDF (SEI, datas, valor, objeto) continuam **só preenchendo o que está vazio**, com uma
exceção: marcadores que a **própria importação** grava enquanto o termo não está pronto — número com
`XX` e situação `Em elaboração` — contam como vazios e são trocados quando a pasta/PDF trazem o dado.
O termo é **relido sempre que um arquivo da pasta dele muda** (não só quando o termo é novo), então o
TA assinado que chega depois completa a linha.

### 3.3 Identidade estável — mover ou renomear pasta nunca duplica

**Contrato** = `sigla do cliente | número | ano` (antes: nome da pasta do cliente). Duas pastas do
mesmo cliente caem no mesmo contrato. Na primeira vez, casa com contrato do legado pelo
`chaveNumerica`, só se único (como hoje).

**Termo → linha**, em ordem, parando no primeiro que resolve:

1. **Agrupar** as pastas de termo presentes no contrato por (tipo, número tolerante — `chaveExata`).
   Duas pastas no mesmo grupo são o mesmo termo **só se compartilham ao menos um arquivo por
   conteúdo** (SMIT TC 52, SUB-ITP); sem conteúdo em comum ficam separadas e geram aviso (SMDHC tem
   dois "TA 001" diferentes). Pasta sem número (`TA XX`, `TRA` sem nº) é grupo sozinha.
2. **Pasta conhecida**: algum `ArquivoSharepoint` num caminho da pasta já aponta para a linha
   (`historicoId`), ou a linha tem `chaveSharepoint` terminando no caminho da pasta (linhas criadas
   pelo importador antes desta revisão).
3. **Mesmo tipo e número** no contrato, entre as linhas que nenhum outro grupo presente reivindicou
   nesta execução — só se único. Cobre mover para "Contratos Finalizados", mudar o rótulo, e a linha
   do legado.
4. **Mesmo conteúdo**: linhas ligadas (por `ArquivoSharepoint.historicoId` antigo ou pelas colunas
   PC/PA–TC/TA) a algum arquivo da pasta, não reivindicadas — só se única. Cobre `TA XX` → `TA 03`.
   Vem **depois** do número porque o mesmo PA aparece repetido em TA 02 e TA 03.
5. Senão, **linha nova**.

`HistoricoContrato.chaveSharepoint` deixa de ser identidade: é pista (passo 2) e marca de origem.
Linha ou contrato excluído na tela **volta** na próxima execução enquanto a pasta existir — a fonte é
o SharePoint.

### 3.4 PC/PA e TC/TA apontam para o arquivo (sem cópia)

- `HistoricoContrato` ganha `propostaArquivoId` / `termoArquivoId` (→ `ArquivoCliente`) e
  `propostaDoSharepoint` / `termoDoSharepoint`. As colunas `propostaPdfUrl/Nome` e `termoPdfUrl/Nome`
  saem depois da migração dos dados (§6).
- Coluna preenchida **pelo SharePoint acompanha o SharePoint**: PDF trocado → a coluna passa a apontar
  para o novo; PDF removido da pasta → a coluna esvazia.
- Coluna preenchida **à mão** nunca é trocada pela sincronização: diferença vira aviso no relatório.
- Tela do histórico: "anexar" continua pela rota da linha (`POST /api/historico-contrato/[id]/pdf/[tipo]`,
  mesmo limite de hoje), mas o PDF é **registrado no repositório** (`registrarConteudo`, dedup por
  hash) e a linha guarda a referência; "escolher PDF já cadastrado" lista os PDFs do repositório do
  cliente e os da tela Propostas comerciais (este é registrado no repositório ao ser escolhido);
  "remover" solta a referência (o arquivo continua no repositório); a visualização usa
  `/api/arquivos/[id]?modo=inline` (a URL do Blob não vai mais ao navegador e o acesso fica em
  `AcessoArquivo`). A API continua devolvendo `propostaPdfUrl/Nome` e `termoPdfUrl/Nome` — calculados
  a partir da referência — para a tela não mudar de forma.
- Coluna vinda do SharePoint removida na tela **volta** na próxima sincronização (a fonte é o
  SharePoint); o visualizador avisa isso. Para trocar de vez, anexa-se outro PDF: anexo manual nunca é
  substituído.
- API e leitores (`esquema.ts`, `resumo-historico.ts`, `contratos-consolidados.ts`, índice do
  assistente em `src/lib/assistente/indexacao/fontes.ts`) leem pela referência.
- `usosDosArquivos` ganha o uso `historico-contrato` (contrato + rótulo da linha).

### 3.5 Uma execução, automática

`scripts/sincronizar-sharepoint.ts` passa a fazer tudo numa passada (o importador vira biblioteca
chamada por ela; `importar-sharepoint-contratos.ts` fica só para releitura completa, `--reler-tudo`):

1. Lista a biblioteca; resolve cliente de cada arquivo (pasta ou nome).
2. Arquivos → repositório e estado (novo, conteúdo trocado, movido, inalterado), como hoje.
3. Estrutura (só nomes) de tudo; **termos sujos** = com arquivo novo/trocado/movido/removido nesta
   execução, ou ainda sem linha. Para eles: contrato e linha (§3.3), leitura do PDF do termo se ele
   mudou, colunas PC/PA–TC/TA (§3.4), `ArquivoSharepoint.contratoId/historicoId` dos arquivos.
4. Ausentes, nesta ordem: caminho marcado `removidoNaOrigemEm`; colunas PC/PA–TC/TA **do
   SharePoint** que apontavam para arquivo sem nenhum caminho ativo esvaziam; o arquivo sai (remoção
   lógica) se nada do VerAI o usa (§3.1). Continua a trava atual: listagem com menos da metade do
   estado ativo → nada disso acontece.
5. **Conferência**: por cliente, **caminhos** válidos no SharePoint × caminhos ativos no estado cujo
   `ArquivoCliente` está ativo (por caminho, não por arquivo — o dedup juntaria dois caminhos num
   arquivo só). Qualquer diferença sai no relatório como `DIVERGÊNCIA`.

Agendador do Windows a cada 30 min chamando `scripts/sincronizar-sharepoint.bat` (um comando só).
Sem `--aplicar` nada é gravado, como em todos os scripts.

## 4. Modelo

```prisma
enum CategoriaArquivo { … PUBLICACAO_DOC }

model ArquivoSharepoint {
  // … campos atuais (pastaContrato sai: substituído por contratoId)
  contratoId  String?
  contrato    Contrato?          @relation(fields: [contratoId], references: [id], onDelete: SetNull)
  historicoId String?
  historico   HistoricoContrato? @relation(fields: [historicoId], references: [id], onDelete: SetNull)
  @@index([contratoId])
  @@index([historicoId])
}

model HistoricoContrato {
  // … campos atuais
  propostaArquivoId    String?
  propostaArquivo      ArquivoCliente? @relation("PropostaDaLinha", fields: [propostaArquivoId], references: [id], onDelete: SetNull)
  propostaDoSharepoint Boolean         @default(false)
  termoArquivoId       String?
  termoArquivo         ArquivoCliente? @relation("TermoDaLinha", fields: [termoArquivoId], references: [id], onDelete: SetNull)
  termoDoSharepoint    Boolean         @default(false)
}
```

Migrações com carimbo **depois** de `20260924160000` (a sequência do repositório está adiantada em
relação ao relógio). Conferir o `DROP INDEX "ArquivoCliente_clienteId_sha256_ativo_key"` gerado e
removê-lo (CLAUDE.md). Excluir/mesclar cliente: nada a acrescentar — as FKs novas são `SET NULL` e o
`ArquivoCliente` já está nas duas regras.

## 5. O que acontece em cada mudança no SharePoint

| No SharePoint | Aba Documentos | Aba Contratos |
|---|---|---|
| Arquivo novo numa pasta de termo | entra, com contrato e termo | se for o PDF do termo/proposta e a coluna estiver vazia ou for do SharePoint: aponta para ele; relê o termo |
| PDF do termo trocado (mesmo caminho) | o novo entra, o anterior sai (se nada do VerAI o usa) | coluna do SharePoint passa para o novo; relê; campos só onde vazio |
| Pasta de termo nova | entra | linha nova (ou a do legado, §3.3) |
| Contrato movido para "Contratos Finalizados" | só muda o lugar | mesma linha; situação "Finalizado" se vazia |
| `TA XX` renomeada para `TA 03` | só muda o lugar | mesma linha (conteúdo); número e situação atualizados (marcadores) |
| Rótulo da pasta alterado | só muda o lugar | mesma linha (número) |
| Arquivo movido de `1. PUBLICAÇÕES NO DOC` para o `WORK/` do termo | mesmo arquivo, ganha contrato e termo | — |
| Arquivo apagado | sai (fica marcado "fora do SharePoint" se algo do VerAI o usa) | coluna do SharePoint esvazia |
| Pasta de termo apagada | arquivos saem | linha fica (histórico); colunas do SharePoint esvaziam |
| Pasta de cliente nova | entra | cliente criado pela sigla (nome oficial em `nomes`) |

## 6. Migração do que já existe

Script `scripts/migrar-sharepoint-lugar-certo.ts` (lista; `--aplicar` grava), idempotente, rodado
**antes** da primeira sincronização nova, em dev e depois em produção:

1. `Contrato.chaveSharepoint` → nova chave (`sigla|número ano`). Colisão (SUB-ITP): se o contrato
   duplicado só tem o que a importação criou (sem item, faturamento, CO, termo de confirmação, sem
   campo digitado), as linhas dele passam para o sobrevivente (linha igual por tipo+número+conteúdo é
   fundida) e ele é apagado; senão, aviso para revisão manual.
2. Linhas duplicadas no mesmo contrato com o mesmo tipo+número e o mesmo PDF (SMIT TC 52): funde,
   mantendo a que tem mais campos preenchidos.
3. Anexos copiados (`propostaPdfUrl`/`termoPdfUrl`): baixa o blob, SHA-256, `ArquivoCliente` do
   cliente do contrato (dedup; `origem = migrado`), grava `*ArquivoId`. Linha com `chaveSharepoint`
   → `*DoSharepoint = true`; senão `false` (anexo feito à mão). Blobs das cópias apagados **só
   depois** de todas as linhas migradas; as colunas de URL saem numa migração seguinte.

## 7. Fora do escopo

- PDF do faturamento (`Faturamento.pdfUrl`) e ConfereAI por referência — resto da Fase 2/3 do
  repositório.
- Microsoft Graph (delta + webhook, sem depender do PC do Lucas) — troca só a fonte
  (`FonteArquivos`) quando a TI liberar `Sites.Selected`.
- Tela de acompanhamento da sincronização (continua o log em `logs/`).
- Linha do histórico mostrar "demais documentos" do termo — ficam na aba Documentos (decisão do
  usuário: "os demais precisa organizar igual tem").

## 8. Riscos

- **Blob**: 1,15 GB entram de uma vez; as 845 cópias do importador saem na migração (§6.3). Conferir
  o limite do plano Vercel antes da primeira carga em produção.
- **OneDrive sob demanda**: a primeira carga lê tudo. Marcar a pasta como "Sempre manter neste
  dispositivo".
- **Produção não foi lida** nesta análise: o plano começa a parte de produção com listagem (sem
  `--aplicar`) e só aplica com o relatório conferido.
- **Outra sessão commitando na `main`**: commits só com os caminhos da tarefa (nunca `git add -A`).

## 9. Testes

- Regras puras com casos tirados da pasta real: `TC  010--SP-URB-2026`, publicação com sigla no nome
  (inclusive o `-2026.09.18 - SMDHC` com hífen na frente), `WORK/`, `.html`, `~$`, papel do arquivo
  (`SF TA 02 ao TC 37-2019.pdf`, `TA125-2023 ao TC 312_2021.pdf`, `Proposta PC-SF-…`).
- Resolução de identidade (§3.3) com cada linha da tabela §5, SMIT TC 52 aninhado, SUB-ITP em duas
  pastas, SMDHC com dois "TA 001", PA repetido em TA 02 e TA 03.
- Sincronização com fonte falsa (padrão de `sincronizar.test.ts`): execução 1 → mudança → execução 2,
  conferindo Documentos e Contratos.
- Em dev, contra a pasta real: listagem, `--aplicar`, conferência com **zero divergência**, segunda
  execução sem nenhuma mudança (idempotência).

## 11. Decisão de 24/09/2026 — os arquivos do SharePoint vão para o Cloudflare R2

Com o Vercel Blob no limite (§10), foram avaliados: link para o SharePoint (abre fora do VerAI e exige
permissão na biblioteca), Neon (0,5 GB grátis e, estourado, trava TODA gravação do banco), Vercel pago,
Backblaze B2 e **Cloudflare R2** — escolhido pelo usuário porque o PDF abre **dentro do VerAI**, sem
administrador, grátis até 10 GB (a biblioteca tem 1,15 GB). Onde conflitar com §3.1/§3.4, vale isto:

- Arquivo que a sincronização grava (`origem = sharepoint`) vai para o bucket R2 **privado**
  `verai-documentos` (conta do usuário). `ArquivoCliente.urlBlob` guarda `r2:<caminho>` (mesmo caminho
  `clientes/<clienteId>/<arquivoId>/<nome>` do Blob). Nunca vai ao navegador.
- `src/lib/storage.ts` passa a entender o prefixo `r2:`: `getUpload`, `deleteUpload` e o novo
  `abrirUpload` (streaming) leem/apagam no R2; o resto continua no Vercel Blob. A rota
  `/api/arquivos/[id]`, o anexo do histórico e o índice do assistente não mudam de forma.
- Acesso ao R2 pela API S3 com assinatura AWS SigV4 feita com `node:crypto` (`src/lib/r2.ts`), sem
  dependência nova. Configuração: `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY` (`.env.local` e variáveis da Vercel). Sem elas a sincronização com
  `--aplicar` recusa rodar.
- Uploads feitos na tela continuam no Vercel Blob. As 849 MB de cópias antigas (`historico-contrato/`)
  viram lixo depois da primeira sincronização (`migrar-sharepoint-lugar-certo.ts --apagar-copias`, quem
  roda é o usuário).
- Arquivo excluído junto com o cliente fica órfão no R2 (limpeza fora do escopo). Governança: contratos
  numa conta Cloudflare do usuário — a chefia deve ficar ciente.

## 10. Execução em dev (24/09/2026) — o que se descobriu

- **Vercel Blob no limite do plano Hobby (1 GB).** 980 MB ocupados; 849 MB (`historico-contrato/`) são as
  cópias de PDF que o importador antigo gravou a partir do dev em 23/09. Desde então toda leitura pública
  devolve 403 e toda gravação falha com "Storage quota exceeded for Hobby plan (1GB maximum)". O mesmo
  armazenamento (token de `.env.local`) é, muito provavelmente, o da produção. A biblioteca inteira
  (1,15 GB) não cabe no Hobby nem com o armazenamento vazio: a primeira carga exige plano maior (ou outro
  armazenamento) — decisão do usuário.
- **O importador antigo parou no meio de 53 contratos** quando o Blob lotou: criou o contrato inicial e
  perdeu os aditivos. A sincronização nova recupera (na amostra de 5 clientes: 17 linhas).
- **Todas as 462 linhas com cópia vieram do SharePoint** (nenhuma anexada à mão). Por isso a migração
  deixou de baixar essas cópias: a sincronização religa cada coluna ao arquivo original da biblioteca, e
  as cópias viram lixo apagável (`--apagar-copias`, depois da sincronização). §6.3 fica valendo só para
  anexo feito à mão.
- **Fusão de duplicados**: além do mesmo PDF por referência, vale o mesmo nome de PDF da cópia (antes da
  sincronização ainda não há referência), e contrato inicial é um só por contrato — duas linhas dele vindas
  do SharePoint se fundem, salvo PDFs diferentes (vai pra revisão). Aplicado em dev: SUB-ITP (contrato e
  linha) e SMIT TC 52.

### 10.1 Com o R2 (24/09/2026, tarde)

- Conexão com o R2 validada (gravar, ler, apagar). A assinatura SigV4 bate com o exemplo oficial da AWS.
- **Amostra** (`--clientes=SMSUB,SMIT,SUB-ITP,SPURBANISMO,SMDHC`, `--aplicar`, 276 s): 279 arquivos
  (266 novos, 13 conteúdo repetido), 0 falhas; 53 contratos processados, 1 novo (SPURBANISMO TC 010/2026),
  17 linhas novas (aditivos perdidos pelo importador antigo), 218 PDFs ligados; conferência **TUDO NO
  VERAI**. Segunda execução: 5 s, 279 inalterados, 0 contratos processados (idempotente).
- **Cenário de mudança** numa cópia da pasta da SMSUB: contrato TC 211/2022 movido para "Contratos
  finalizados" (23 arquivos), aditivo do TC 36/2022 renomeado (11 arquivos), 1 arquivo de `WORK/`
  apagado → 0 arquivos novos, 34 reconhecidos pelo conteúdo, 0 linhas novas (TC 211 seguiu com 4 linhas,
  TC 36 com 5, todas com PDF), TC 211 marcado "Finalizado", arquivo apagado removido, conferência TUDO NO
  VERAI. As 2 publicações do DOC da SMSUB também saíram (não estavam na cópia — comportamento certo).
  Volta à pasta real: tudo restaurado, conferência OK. Observação: contrato que volta de "Contratos
  Finalizados" continua "Finalizado" no VerAI (só preenche vazio) — corrigir à mão se acontecer.

### 10.2 Biblioteca inteira em dev (24/09/2026)

- Carga completa (830 s): 878 arquivos novos no R2; 1 falha transitória do R2 (502 "try again"), que a
  conferência acusou e a execução seguinte recuperou. 178 contratos processados, **91 aditivos recuperados**
  (perdidos pelo importador antigo quando o Blob lotou), 855 PDFs ligados por referência.
- Achados e correções: (1) contrato com pasta ativa e cópia em "Contratos Finalizados" era marcado
  "Finalizado" — SMIT TC 52/2024 (R$ 9,26 mi, vigente até 30/06/2027) e SMSUB TC 01/2026; agora só é
  finalizado se TODAS as pastas estão lá (aviso pra arrumar a pasta), e "Finalizado" gravado pela importação
  sai; (2) byte 0 no texto de PDF (SEME TC 25/2024, SME TC 378/2024) derrubava a gravação; (3) pasta
  "Apostila…/Apostilamento" virava segunda linha de contrato inicial (SMTUR TC 001/2023, SMUL TC 07/2023).
- Reprocessamento (`--reler-tudo`, 103 s): 231 contratos, conferência **1.171/1.171 — TUDO NO VERAI**.
- Auditoria das contas (todos os clientes): 125 contratos ativos, R$ 1,16 bi; SMIT 3 ativos / R$ 9,44 mi.
  35 ativos sem valor (termo escaneado — valor a digitar). Para revisar à mão: contratos do legado GRC-1
  "Finalizado" com pasta ativa no SharePoint (SGM 17/2025, SMS 138/2021, 142/2021, 203/2023 — este com
  vigência até 2032, a conferir) e SVMA TC 074/2022 (todas as pastas em finalizados, mas vigência lida até
  2028-01-08).

### 10.3 Proteção contra erro novo (24/09/2026, noite)

- **Auditoria automática** a cada `--aplicar` (`src/lib/importacao-sharepoint/auditoria.ts` +
  `auditoria-banco.ts`, pelo `consolidarContratos()`), só dos clientes tocados na execução: finalizado com
  vigência correndo, ativo sem valor, contrato inicial duplicado, termo duplicado (mesmo número), contrato
  duplicado (mesmo número e ano). Só aponta — sai no log e em `logs/sharepoint-sincronizacao.json`.
- A primeira rodada achou SMS TC 105/2025 e 107/2025 em dobro: o casamento com o contrato do legado usava
  `chaveNumerica`, que pegava o "1" de "SMS-1" (`TC 105/2025/SMS-1/CONTRATOS`). Agora casa por
  `chaveDoNome` (número + ano); e `fundirComLegado` (etapa 2b da migração) funde a cópia criada pelo
  SharePoint no contrato do legado quando o candidato é único e a cópia não tem item, faturamento nem termo.
  Auditoria: 41 → 37 pontos (33 ativos sem valor; SMS 203/2023 e SVMA 074/2022 finalizado × vigência;
  SMDHC "TA 001" ×2 com PDFs diferentes; SEGES TC 024/2025 ×3, dois deles no legado — decisão humana).
- **Régua da leitura** (`src/lib/importacao-sharepoint/regua.ts`, `scripts/regua-sharepoint.ts`): fotografa
  como cada pasta vira contrato/termo (tipo, número, aviso, PDF do termo, PDF da proposta, nº de arquivos)
  e guarda a lista de arquivos junto; depois de mudar regra, relê a **mesma** lista com o código novo e
  mostra, por cliente, o que mudou. Sem banco, sem PDF, ~9 s na biblioteca inteira (1.174 arquivos → 231
  contratos, 631 pastas de termo). Validada quebrando uma regra de propósito (tirar "apostil" do aditivo):
  acusou exatamente SMTUR TC 001/2023 e SMUL TC 07/2023.
