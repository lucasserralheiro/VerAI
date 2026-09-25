# ConfereAI — o levantamento busca o contrato no cadastro (design)

**Status**: Desenho aprovado com o usuário em 25/09/2026 (fluxo de tela, regra de busca e escolha,
parte técnica). **Implementado no mesmo dia** — plano
`docs/superpowers/plans/2026-09-25-confere-contrato-do-cadastro.md`, commits `d4b526a`…`b5776af`,
migração `20260925120000_confere_execucao_contrato` aplicada no banco de desenvolvimento. Falta: o
teste na tela pelo usuário (o servidor de desenvolvimento precisa reiniciar para carregar o Prisma
Client novo) e a produção (§11).
**Data**: 25/09/2026
**Substitui**: a §3.6 e o item "Fase 3" da §7.4 de
`docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md` (lá o fluxo começava
por escolher Cliente → Contrato → Competência; aqui começa pela planilha).
**Revê**: a §3.7 de `docs/superpowers/specs/2026-09-21-integracao-confere-design.md` ("sem vínculo
com Cliente nem competência") — a geração continua sem estado, mas o preenchimento passa a vir do
cadastro e o histórico passa a dizer de qual contrato foi.

---

## 1. Objetivo

Pedido do usuário (25/09/2026): *"quando o usuario colocar a planilha ele precisa ja buscar o
contrato que esta no banco de dados dos clientes [...] alem de colocar upload, ter isso tbm"*, e,
sobre o que preencher: *"preciso que o documento ache o contratos e aditivos se tiver mas se nao
tiver ou da sugestão"*.

Hoje a pessoa seleciona três ou mais arquivos (proposta, levantamento e cada aditivo, na ordem certa)
e precisa saber sozinha quais PDFs usar. Depois desta mudança ela seleciona **só o levantamento**:
o VerAI lê de qual contrato e de qual competência a planilha é, acha o contrato no cadastro do
cliente e preenche **Contrato** e **Aditivos** com os PDFs que a sincronização do SharePoint já
guardou, mostrando de onde veio cada um. Quando não acha — ou acha mais de um —, sugere. Enviar do
computador continua possível em todos os campos.

## 2. O que foi medido (25/09/2026, banco de desenvolvimento)

### 2.1 A planilha diz de qual contrato é

As duas planilhas reais do Confere (`services/confere/backend/tests/fixtures/levantamento.xlsx`,
SMIT, e `levantamento_pgm.xlsx`) trazem, nas primeiras linhas da aba `Levantamento`:

| Linha | SMIT (piloto) | PGM |
|---|---|---|
| 1 | `LEVANTAMENTO - COMPROVAÇÃO SMIT SUSTENTAÇÃO - CATÁLOGO DE SERVIÇOS DIT` | `LEVANTAMENTO - COMPROVAÇÃO PGM TC 015 - CATÁLOGO DE SERVIÇOS DIT` |
| 3 | `Data do Levantamento : 15/07/2026` | `Data do Levantamento : 23/07/2026` |
| 4 | `*Valores conforme contrato : TC 52/SMIT/2024` | `*Valores conforme contrato : TC 015/PGM/2024` |

São os mesmos dois campos que o Confere lê em `levantamento_reader._ler_cabecalho` (`_DATA`,
`_CONTRATO`) e compara em `identidade_contratual.py` (ESPEC 029). A competência do Confere é o mês
da "Data do Levantamento" (`competencia_por_extenso`).

Nos seis levantamentos reais da pasta Downloads do usuário (medido já na implementação), a referência
vem em **três formas** — só a primeira é a que o Confere reconhece:

| Levantamento | "conforme contrato :" | Forma | Contrato no cadastro |
|---|---|---|---|
| PGM, CGM, SMIT | `TC 015/PGM/2024`, `TC 16/CGM/2024`, `TC 52/SMIT/2024` | número/órgão/ano | chave exata |
| FTM | `TC 094/FTMSP/2024` | número/órgão/ano | `FTM\|94 2024` — sigla parecida |
| SMDET | `TC 07/2024/SMDET` | número/ano/órgão | `SMDET\|7 2024` |
| HSPM | `TC 387/2024` | número/ano, sem órgão | `HSPM\|387 2024` — órgão tirado do título ("COMPROVAÇÃO HSPM") |

Os seis foram achados, com a base e os aditivos esperados, em 20–50 ms cada contra o banco de
desenvolvimento (§6.1).

**O exceljs não abre essas planilhas**: `workbook.xlsx.load` estoura em `reconcile` (`Cannot read
properties of undefined (reading 'anchors')` — desenhos na planilha), e no teste o leitor em
streaming não trouxe o nome das abas (emitiu `Sheet1`). Lendo o XLSX como zip (workbook.xml → rels → a folha `Levantamento` +
sharedStrings), o cabeçalho sai em **7–18 ms**.

### 2.2 O cadastro tem os documentos

| | Total | Com a proposta (PC/PA) no repositório |
|---|---|---|
| Linhas `CONTRATO` do histórico | 239 | 229 |
| Linhas `ADITIVO` | 141 | 70 |
| Linhas `PRORROGACAO` | 278 | 157 |

Os 456 PDFs de proposta ligados ao histórico estão **todos no R2** (`urlBlob` com `r2:`), nenhum
removido — não dependem do Vercel Blob suspenso.

O número que a planilha escreve bate com a chave do contrato (`Contrato.chaveSharepoint`,
`<sigla>|<nº> <ano>`): `TC 52/SMIT/2024` ↔ `SMIT|52 2024`, `TC 16/CGM/2024` ↔ `CGM|16 2024`,
`TC 015/PGM/2024` ↔ `PGM|15 2024`. Há sigla que diverge do órgão escrito no número:
`TC 027/FTMSP/2021` é do cliente `FTM` (`FTM|27 2021`). 231 dos 244 contratos têm a chave; os 13
restantes (legado) só têm `numeroTermo`.

### 2.3 Quais propostas mandar — a regra da última renovação

O Confere monta "o contratado" com uma proposta-base mais os aditivos, e um aditivo só muda algo
quando traz blocos `Inclusão`/`Exclusão` (ESPEC 019). A proposta de **renovação** (prorrogação)
reapresenta o escopo inteiro num bloco único sem rótulo — e, enviada como aditivo, **é ignorada
sem aviso** (ESPEC 046, `R-ADT-03-rev`).

Nos dois casos documentados, a equipe do Confere usou como base a proposta da última renovação:

| Caso | Base usada | Aditivos | No cadastro |
|---|---|---|---|
| PGM, julho/2026 (ESPEC 019) | `PA-PGM-251015-159 v5.0` | `PA-PGM-260304-715` | TA 04 = prorrogação desde 01/12/2025; TA 05 = aditivo de 30/04/2026 |
| SMIT, julho/2026 (piloto) | `PA-SMIT-260319-739` | — | TA 02 = prorrogação desde 01/07/2026 |

No teste do CGM de 24/09 (agosto/2026) foi usada a PC `PC-CGM-240603-82` com a renovação
`PA-CGM-250912-127` como aditivo — que o Confere ignora; na prática o relatório saiu só com a PC,
sem as mudanças do TA 01.

### 2.4 Simulação nos 69 contratos em vigor em setembro/2026

Simulação de leitura no banco de desenvolvimento, com a regra da §5 simplificada (sem os motivos de
exclusão por situação).

| | Contratos |
|---|---|
| Proposta-base achada sozinha | 66 (23 pela renovação, 43 pela PC) |
| Sem proposta nenhuma no cadastro (continuam por upload) | 3 |
| Com aditivo depois da base | 10 |
| Com aditivo em vigor **sem PA** no cadastro | 6 |
| Com termo aditivo/prorrogação **sem data** nenhuma | 10 |
| Regra da última renovação × "PC + todas as PAs" dão conjuntos diferentes | 23 |

## 3. Decisões (com o usuário, 25/09/2026)

1. **A planilha dispara a busca.** Escolher o levantamento lê o cabeçalho e preenche Contrato e
   Aditivos. Enviar do computador continua em todos os campos.
2. **A ordem dos cartões não muda** (*"Manter a ordem original"*): Contrato à esquerda, Levantamento
   à direita, Aditivos embaixo — o formulário continua a cópia do Confere; muda o que os campos
   mostram.
3. **Acha quando há, sugere quando não há.** Preenchimento automático pela regra da última
   renovação (§5), sempre explicado na tela e trocável; sem contrato achado, sugestões.
4. **Aviso de fora da vigência — sim** (*"Avisar fora da vigência"*), com o motivo quando o cadastro
   tem termo sem data de fim (§5.4). Não impede a geração.
5. **O histórico passa a dizer contrato e competência** (*"Seguir, com contrato"*).
6. **Os arquivos de entrada continuam não guardados** — nem a planilha. Vale a decisão de 21/09; o
   que muda é que Contrato e Aditivos podem vir do cadastro por referência.

## 4. A tela

Esboço aprovado na conversa de 25/09 (com a ordem original dos cartões).

### 4.1 Texto de abertura

O subtítulo (texto do VerAI desde a remoção da barra do Confere) passa a dizer por onde começar:
*"Envie o levantamento da competência: o contrato e os aditivos são buscados no cadastro do
cliente — ou envie os arquivos do computador. A aplicação compara o contratado com o medido e
devolve o relatório de comprovação."*

### 4.2 Ao escolher o levantamento

1. O cartão Levantamento mostra o nome do arquivo (como hoje) e "Lendo o levantamento…" enquanto a
   rota de identificação responde (§7.1).
2. Entre a linha dos dois cartões e o cartão de Aditivos aparece a **faixa de identificação**
   (`role="status"`, `id` próprio, como `identidade-aviso`):
   - **encontrado**: *"Contrato TC 015/PGM/2024 · Procuradoria Geral do Município · competência
     julho/2026 · abrir contrato · trocar contrato"* — "abrir contrato" leva a
     `/clientes/{clienteId}/contratos/{contratoId}` em nova aba;
   - **mais de um candidato**: a lista, para escolher — nunca escolhe sozinho entre dois;
   - **não encontrado**: caixa âmbar *"O contrato TC 99/SMIT/2026 não está no cadastro"* com as
     sugestões (§6.3), a busca e "enviar do computador";
   - **planilha sem o número do contrato**: caixa âmbar *"Não achamos o número do contrato neste
     levantamento"* com a busca.
3. **Contrato** mostra o PDF escolhido e a origem — *"Do cadastro · TA 04, renovação desde
   01/12/2025"* — com **Ver PDF** (`/api/arquivos/{id}?modo=inline`, nova aba) e **Trocar**: as
   outras propostas daquele contrato (PC e PAs, com tipo e data) e "Enviar do computador…" (abre o
   seletor de arquivo que já existe).
4. **Aditivos** vira uma lista em ordem de aplicação; cada item com nome, origem ("do cadastro · TA
   05, aditivo de 30/04/2026" ou "do computador") e **remover**. Embaixo: **+ Adicionar do
   cadastro** (propostas do contrato fora da lista) e **+ Enviar do computador** (entra no fim da
   lista). Vazia: *"nenhum aditivo depois da proposta-base"*.
5. **Como os documentos foram escolhidos** (recolhido, `<details>`): cada linha do histórico do
   contrato com o papel que recebeu (base, aditivo) ou o motivo de ter ficado fora (§5.3).
6. **Avisos** (caixa âmbar da tela, `role="status"`), só quando há: aditivo sem PA, termo sem data,
   fora da vigência, contrato sem proposta (§5.4).

### 4.3 Regras de convivência com o envio manual

- **Escolha manual nunca é substituída.** O preenchimento só ocupa campo vazio ou campo que ele
  mesmo preencheu. Se a pessoa já tinha enviado a proposta do computador, a faixa oferece "Usar os
  documentos do cadastro" (substitui só com o clique).
- **Trocar a planilha** refaz a identificação: campos preenchidos pelo cadastro são trocados pelos
  do novo contrato; os manuais ficam.
- **Trocar contrato** (faixa) abre a busca (§6.4); escolhido, os campos do cadastro são refeitos
  para aquele contrato na mesma competência.
- **Limpar** apaga também a identificação (mesmo diálogo de hoje).
- **Gerar relatório** continua exigindo contrato e levantamento. A conferência prévia
  (`conferirIdentidade`, hoje 404 no VerAI) é **pulada** quando o contrato veio do cadastro — o par
  já foi casado pelo número; no caminho manual fica como está.
- O aviso da `R-DOC-08` (planilha no campo Contrato) continua valendo para o envio manual.

## 5. A regra de escolha dos documentos

Função pura, sem banco: `escolherDocumentos(linhas, competencia)` em
`src/lib/confere/documentos-do-contrato.ts`. Entrada: as linhas do histórico do contrato (tipo,
número, "Assinada em" = `data`, `dataInicio`, `dataVencimento`, `situacao`, `proposta`, `createdAt`
e a PC/PA — `propostaArquivoId` + nome). Saída: `{ base, aditivos, fora, avisos }`.

### 5.1 Quando um termo vale na competência

- **Início** da linha = `dataInicio`; sem ela, `data` ("Assinada em"); sem as duas, a **data da
  proposta**, lida do código (`PA-SF-250806-091` → 06/08/2025; aceita o espaço de
  `PA-CGM- 250912-127`), da coluna `proposta` ou do nome do PDF. Usar a data da proposta gera o
  aviso `termo-sem-data`. Sem nenhuma das três, a linha fica fora com esse aviso.
- **Vale** = início até o último dia do mês da competência.
- **Nunca entram**: `RESCISAO`, `PROSPECCAO`, e linha com situação de cancelado, não efetivado, em
  elaboração, pendente ou não assinado — é assim que a sincronização grava termo que "não virou"
  (`Cancelado (não efetivado)`) e termo sem número ainda sem assinatura (`Em elaboração`).
- A linha `CONTRATO` vale sempre (é a base de último recurso).
- Ordem: início, depois `createdAt`.

### 5.2 Base e aditivos

- **Base (campo Contrato)** = a PA da **última `PRORROGACAO` que vale** na competência; sem
  renovação com PA, a **PC da linha `CONTRATO`**; sem nenhuma das duas, **sem base** (sugestões,
  §6.3).
- **Aditivos** = as PAs das linhas `ADITIVO` que valem e **vêm depois da base na ordem da §5.1**
  (todas, se a base é a PC), nessa ordem.
- Aditivo que vale e **não tem PA** não entra na lista: vira o aviso `aditivo-sem-pa`.

Verificação com os casos reais (testes obrigatórios): PGM julho/2026 → base TA 04, aditivos [TA 05];
SMIT julho/2026 → base TA 02, sem aditivos; SMIT maio/2026 → base TA 01 (a TA 02 só começa em
01/07/2026); CGM agosto/2026 → base TA 02, sem aditivos (o TA 01 fica fora, "já está dentro da
renovação TA 02").

### 5.3 Motivos de ficar fora (texto de "Como os documentos foram escolhidos")

- "já está dentro da renovação TA 04" — linha anterior à base de renovação (inclui a PC e as
  renovações mais antigas);
- "começa depois da competência (01/08/2026)";
- "cancelado ou não efetivado", "em elaboração";
- "rescisão", "prospecção";
- "sem proposta (PA) no cadastro" — aditivo (vira também o aviso `aditivo-sem-pa`);
- "prorrogação sem proposta (PA) no cadastro — a base continua a anterior" — só informativo: 121
  das 278 prorrogações não têm PA, e prorrogação só de prazo não precisa de uma.

### 5.4 Avisos

| Código | Quando | Texto (o que a implementação escreve) |
|---|---|---|
| `aditivo-sem-pa` | aditivo que vale sem PA | "TA 03 (aditivo de 30/10/2025): sem a proposta (PA) no cadastro — o relatório sai sem ele. Anexe a PA na linha do histórico do contrato ou envie o arquivo aqui." |
| `termo-sem-data` | linha posicionada pela data da proposta, ou deixada fora por não ter data nenhuma | "TA 02: sem data de início nem de assinatura no cadastro — posicionado pela data da proposta (06/08/2025). Confira." |
| `fora-da-vigencia` | competência começa depois do fim de vigência, ou termina antes do início do contrato | "Julho/2026 está depois do fim de vigência cadastrado (30/11/2025)." + quando houver renovação que vale e não tem `dataVencimento`: "TA 04 (renovação desde 01/12/2025) está sem data de fim no cadastro." + "Confira." |
| `sem-proposta` | sem base | "Este contrato não tem proposta (PC) nem renovação com proposta (PA) no cadastro — escolha uma das propostas do cliente ou envie do computador." |

O rótulo vem primeiro, sem artigo ("TA 03: …"), porque o número do termo pode ser qualquer coisa
("TA 590-2025", "TAP 01", "Aditivo sem número").

Fim de vigência = `vigenciaFim` do `consolidarContratos()` (regra única do CLAUDE.md); início =
`dataInicio` do cabeçalho ou da linha `CONTRATO`. É por isso que o aviso explica a TA sem data de
fim: com o cadastro de hoje, o PGM de julho/2026 aparece vencido desde 30/11/2025.

## 6. A busca do contrato

`src/lib/confere/localizar-contrato.ts`. **Só contratos de clientes que a pessoa pode ver**
(`clienteIdsPermitidos`); contrato de cliente sem permissão é tratado como inexistente (não vaza
que existe).

### 6.1 Leitura da referência

`src/lib/confere/identidade.ts`, três formas, nesta ordem (medidas nos levantamentos reais, §2.1):

1. **A do Confere** (`IdentidadeContratual.de_referencia_da_aba`): `número[-sufixo]/ÓRGÃO/ano` —
   `TC 52/SMIT/2024` → 52, `SMIT`, 2024. O sufixo (`52-A`) é o mesmo contrato e não entra na busca.
2. **Órgão no fim**: `número/ano/ÓRGÃO` — `TC 07/2024/SMDET`, `TC 107/2025/SMS-1` (o órgão são as
   letras; o `-1` fica de fora).
3. **Sem órgão**: `número/ano` — `TC 387/2024`; o órgão sai do título da aba ("LEVANTAMENTO -
   COMPROVAÇÃO HSPM - …"). Sem título que diga, busca só por número e ano — e só escolhe sozinho se
   houver um contrato só com eles.

Referência de peça (`PA-SMIT-260319-739`) não casa em nenhuma, como no Confere. As formas 2 e 3 o
Confere não reconhece: para esses levantamentos o portão de identidade dele fica em silêncio
(`R-IDT-06`), e quem casa o par é a busca do VerAI.

Nas três formas o órgão pode vir **em partes** (`04/SP/REGULA/2022`, `30/SMC/G/2025`,
`65/SMSUB/COGEL/2025`, `01/SUB-ITP/2026`), o ano da forma 1 pode ter **dois dígitos**
(`103/SIURB/24` → 2024) e a forma 3 aceita **hífen** (`050-2024`). O órgão é comparado só por letras e
números (`SP/REGULA` = `SPREGULA`, `SUB/IT` começa `SUB-ITP`) — a mesma regra vale para a sigla do
cliente e a da chave do SharePoint.

### 6.1.1 Cobertura medida (25/09/2026, banco de desenvolvimento)

Para cada um dos **122 contratos em vigor** (39 clientes), simulando a planilha com o número do termo
como está no cadastro e o título "COMPROVAÇÃO <sigla>":

| Resultado | Contratos |
|---|---|
| Acha o próprio contrato | **115** (também quando a planilha não diz o órgão) |
| Cadastro duplicado — acha o registro do SharePoint, que tem a proposta | 2 (SEGES 24/2025: dois registros do legado com os faturamentos e um do SharePoint) |
| Número com erro no cadastro (`TC 54460/2022`) | 1 |
| Sem número no cadastro (`IntegraçãoBenefícios`, `Novo Sustenta`, `SGM -IntegrBenef`, `TC SN/2024`) | 4 |
| Achado, mas sem proposta nenhuma no cadastro (sugere as do cliente) | 2 (SME 505/2024, SGM 028/2026) |
| Com aviso de aditivo sem PA | 9 |
| Com termo posicionado pela data da proposta | 23 |

A primeira versão (só as três formas, sem órgão em partes/ano curto/hífen) achava 98. Os que não
são achados caem nas sugestões e na busca, nunca num contrato errado.

### 6.2 Ordem da busca

1. **Chave exata**: `chaveSharepoint = "<ÓRGÃO>|<número> <ano>"`.
2. **Mesmo número e ano, sigla parecida**: contratos com chave terminando em `|<número> <ano>`, ou
   sem chave com `chaveNumerica(numeroTermo) = "<número> <ano>"`, filtrados pelo órgão — a sigla do
   cliente começa com o órgão ou o órgão começa com a sigla (`FTMSP`/`FTM`), ou o `numeroTermo`
   contém o órgão (`chaveExata`). Um só → encontrado; mais de um → lista para escolher.
3. **Nada** → sugestões (§6.3).

### 6.3 Sugestões

- Contratos do cliente cuja sigla casa com o órgão, **ativos** pelo `consolidarContratos()`;
- contratos com o mesmo número e ano em outro cliente visível ("mesmo número em outro cliente");
- a busca livre (§6.4) e "enviar do computador".
- Contrato achado **sem proposta nenhuma**: as `ArquivoCliente` do cliente com categoria
  `PROPOSTA_COMERCIAL`/`PROPOSTA_ADITIVO`, não removidas, mais recentes primeiro — o que a §7.4 do
  desenho do repositório já previa.

### 6.4 Busca livre ("trocar contrato")

Texto livre sobre número do termo (`chaveExata`) e nome/sigla do cliente; até 20 contratos visíveis,
com número, cliente, descrição, vigência e se está ativo — do `consolidarContratos()`.

### 6.5 Competência sem data na planilha

Sem "Data do Levantamento", a competência de referência para escolher os aditivos é o **mês atual**,
com a nota "competência não lida na planilha — usamos o mês atual". O Confere segue com a regra dele.

## 7. Por dentro

### 7.1 Rotas novas (só leitura)

| Rota | O que faz |
|---|---|
| `POST /api/confere/levantamento` (multipart `levantamento`) | Lê o cabeçalho (§2.1), localiza (§6), escolhe os documentos (§5). Devolve `{ leitura: { competencia, referencia, titulo }, situacao: 'encontrado' \| 'ambiguo' \| 'nao-encontrado' \| 'sem-referencia' \| 'ilegivel', contrato?, documentos?, candidatos?, sugestoes? }` |
| `GET /api/confere/contratos?busca=` | Busca livre (§6.4) |
| `GET /api/confere/contratos/[id]/documentos?competencia=AAAA-MM` | §5 para um contrato escolhido à mão; `exigirAcessoCliente` |

Documento devolvido ao navegador: `{ arquivoId, nome, origem: { tipo, numero, inicio } }` — **nunca
`urlBlob`**.

### 7.2 A rota da geração aceita o cadastro

`POST /api/confere/reports` continua multipart e com o mesmo contrato de resposta
(200 / 422 com `bloqueantes` / erro com `detail`). Muda a entrada:

- `levantamento`: arquivo (obrigatório, como hoje);
- **ou** `contrato` (arquivo) **ou** `contrato_arquivo_id` (texto) — exatamente um;
- `aditivos`, repetido, **em ordem**: cada entrada é um arquivo ou o texto `cadastro:<arquivoId>` —
  `formData.getAll('aditivos')` preserva a ordem e mistura os dois;
- `contrato_id` (opcional): o contrato identificado ou escolhido, para o histórico.

Para cada id do cadastro o servidor confere: `ArquivoCliente` existe, não foi removido, é PDF e
`podeVerCliente` no cliente dele; com `contrato_id`, o arquivo tem de ser **do mesmo cliente** do
contrato. Baixa com `getUpload(urlBlob)` (R2). O orçamento de tempo não muda: o download acontece
antes da chamada ao Confere e já é descontado de `tempoLimiteMs`. A rota passa a exigir o usuário
(`exigirUsuario`) — o middleware já exige sessão; aqui é para ter o usuário na checagem.

Efeito colateral bom: no caminho do cadastro só a planilha (~0,5–0,7 MB) viaja no corpo, então o
limite de 4,5 MB da Vercel (a pendência "envio acima de 4,5 MB" do design do Confere) deixa de valer
nesse caminho. No envio manual continua valendo.

### 7.3 Leitura da planilha

`src/lib/confere/levantamento.ts`: abre o XLSX com `jszip` (hoje instalado como dependência do
exceljs; passa a ser dependência direta, mesma versão), acha a folha `Levantamento` pelo
`workbook.xml` + rels, lê as 10 primeiras linhas (sharedStrings, inlineStr, entidades XML) e aplica
`_DATA`/`_CONTRATO` do Confere. Sem a aba: a mesma frase do Confere — *"planilha sem a aba
'Levantamento' — verifique se o arquivo é o levantamento"*. Não usa exceljs (§2.1).

### 7.4 Histórico

`ConfereExecucao` ganha `contratoId String?` (FK para `Contrato`, `onDelete: SetNull`, índice),
`competenciaAno Int?` e `competenciaMes Int?` (convenção do schema). A competência é a que o servidor
lê do levantamento na geração (não a que o navegador manda). Excluir cliente apaga os contratos
(`deleteMany`) e o `SetNull` — que é do banco, na FK da migração `20260925120000` — solta a
execução, que continua com os nomes; `excluir-cliente.ts` não muda. Mesclar cliente move os
contratos e o vínculo continua válido.

`/api/confere/execucoes` devolve número do termo, cliente e competência; `/confere/historico` ganha
a coluna **Contrato · competência** com link para o contrato (a página do contrato aplica a
permissão dela). Continua "todos veem tudo", como hoje. Execuções antigas ficam sem contrato.

A execução **não** guarda referência aos arquivos de entrada: `usosDosArquivos` não muda, e o PDF
do cadastro continua podendo sair do SharePoint normalmente.

### 7.5 Tela

- `src/app/confere/lib/types.ts`: a entrada de Contrato e de cada aditivo vira
  `{ tipo: 'arquivo', arquivo: File } | { tipo: 'cadastro', arquivoId, nome, origem }`, com a marca
  de quem preencheu (pessoa × cadastro) para a regra da §4.3.
- `src/app/confere/lib/api.ts`: `identificarLevantamento`, `documentosDoContrato`,
  `buscarContratos`; `gerarRelatorio` monta o multipart da §7.2.
- `src/app/confere/page.tsx` e `components/UploadForm.tsx`: estado e campos; componentes novos para
  a faixa de identificação, a busca/sugestões e a lista de aditivos. Mantém os padrões de
  acessibilidade do Confere (`type="button"` dentro do `<form>`, foco, regiões `status` com `id`).

## 8. Erros

| Situação | O que a tela mostra |
|---|---|
| Planilha que não abre ou sem a aba `Levantamento` | a frase do Confere, e o caminho manual segue |
| Planilha sem a linha "conforme contrato" | "Não achamos o número do contrato neste levantamento" + busca |
| Falha na rota de identificação (rede, 500) | "Não foi possível buscar o contrato agora — escolha o contrato ou envie os arquivos do computador"; nada bloqueia |
| Na geração, PDF do cadastro não baixa | 502 com `detail`: "Não foi possível ler a proposta *X* do cadastro — tente de novo ou envie o arquivo do computador." |
| Id sem permissão, removido ou de outro cliente | 403/409/400 com `detail` dizendo qual arquivo |

## 9. Testes

- **Leitura** (`levantamento.test.ts`): as duas planilhas reais do Confere; casos sintéticos (sem a
  aba, sem a linha, `52-A/SMIT/2024`, `015/PGM/2024`, referência de peça que não casa, entidades
  XML, texto rico no sharedStrings).
- **Regra** (`documentos-do-contrato.test.ts`): PGM julho/2026, SMIT julho e maio/2026, CGM
  agosto/2026; termo sem data (posicionado pela proposta e sem data nenhuma), aditivo sem PA,
  cancelado, em elaboração, rescisão, contrato sem PC.
- **Busca** (`localizar-contrato.test.ts`): chave exata, sigla parecida (FTMSP/FTM), empate, cliente
  sem permissão, sugestões, contrato sem proposta.
- **Rotas**: identificação, busca, documentos; geração com ids (ordem mista, permissão, removido,
  outro cliente, falha do R2, histórico com contrato e competência) — no padrão de
  `src/app/api/confere/reports/route.test.ts`.
- **Tela**: preenche ao escolher o levantamento; Trocar; remover e adicionar aditivo; escolha manual
  não é substituída; não encontrado → sugestões; planilha trocada refaz; Limpar zera.
- **No navegador, em desenvolvimento**: PGM e SMIT de ponta a ponta com o Confere do Render.

## 10. Fora de escopo

- Guardar a planilha ou qualquer entrada no repositório do cliente.
- Reordenar aditivos arrastando — os do cadastro vêm em ordem; os do computador entram no fim.
- Descobrir pelo conteúdo do PDF se a PA é renovação completa (é o `I-01` da ESPEC 046).
- Conferência prévia no VerAI (Task 6 do plano do Confere).
- Levantamento vindo do cadastro (`MEDICAO`: 1 arquivo hoje).
- Upload direto ao R2 dos arquivos enviados do computador — plano do R2, à parte.

## 11. Riscos e dependências

- **Resultado diferente do que já foi gerado.** Em 23 dos 69 contratos a base passa a ser a
  renovação; o CGM de agosto/2026 sai com `PA-CGM-250912-127` como base, não com a PC do teste de
  24/09. É a regra que a equipe do Confere usou; a tela mostra a escolha e permite trocar.
- **PA de prorrogação que não tem tabela de itens** (só prazo) viraria base e o Confere devolveria
  erro de extração — a pessoa troca pela PC em "Trocar". Não medido nos 23 casos; a verificação no
  navegador deve incluir um contrato com renovação além do PGM.
- **Cadastro errado** (PA na linha errada) — o portão de identidade do Confere (`V-IDT-01/02/03`)
  continua perguntando; a origem de cada arquivo fica visível.
- **Produção**: depende do deploy do main (migrações pendentes, push bloqueado pelo hook
  `pre-push`) e da primeira sincronização do SharePoint em produção (Task 14 do plano
  `2026-09-23-sharepoint-lugar-certo`). Em desenvolvimento funciona com o que já está sincronizado.
- **Blob suspenso**: PDF anexado à mão no repositório (fora do R2) não baixa enquanto durar a
  suspensão — cai no erro da §8. Os do SharePoint estão no R2.

## 12. O que atualizar junto da implementação

- `CLAUDE.md`, seção "Integração do Confere": "sem vínculo com Cliente nem competência" → o
  levantamento busca o contrato no cadastro; histórico com contrato e competência.
- `2026-09-21-integracao-confere-design.md`: adendo apontando para este documento.
- `2026-09-23-repositorio-documentos-cliente-design.md`: §3.6 e §7.4 (Fase 3) marcadas como
  substituídas por este documento.
- `docs/superpowers/plans/2026-09-21-integracao-confere.md`: task nova apontando para o plano desta
  mudança.

## 13. Referências

- Confere: `services/confere/backend/src/infrastructure/measurement/levantamento_reader.py`,
  `services/confere/backend/src/domain/value_objects/identidade_contratual.py`,
  `services/confere/backend/src/infrastructure/validations/identity_validations.py`, ESPECs 019, 029
  e 046 em `services/confere/docs/specs/`.
- VerAI: `src/app/confere/`, `src/app/api/confere/reports/route.ts`, `src/lib/confere/cliente.ts`,
  `src/lib/relatorios-clientes/contratos-consolidados.ts`, `src/lib/relatorios-clientes/regras.ts`,
  `src/lib/relatorios-clientes/vincular-itens.ts` (`chaveExata`, `chaveNumerica`),
  `src/lib/importacao-sharepoint/estrutura.ts` e `importar.ts`, `src/lib/visibilidade.ts`,
  `src/app/api/arquivos/[id]/route.ts`.
