# Valor, vigência e assinatura dos contratos com prova — design

**Status:** rascunho para revisão do usuário (29/09/2026). Decisões tomadas na conversa de 28–29/09
("como sênior", o usuário delegou as escolhas); medições no banco de dev, com a biblioteca
ContratosReceita inteira sincronizada.

## 1. Pedido

O usuário quer os valores e os dados dos contratos preenchidos a partir do que já está no SharePoint,
de um jeito **barato, funcional e que não erre**, e que as telas de relatório **batam sempre**. A ideia
de partida dele era "OCR de todo PDF → JSON → categorizar o valor". Critérios de "resolvido" que ele
marcou (29/09): valor certo nas telas, cadastro completo, bater com o financeiro, **sem trabalho
manual**.

## 2. Hoje × depois

| | Hoje | Depois |
|---|---|---|
| Valor dos contratos ativos | 50 de 122 com o valor do último termo (41%) | ~91 de 122 com valor **provado** (75%), gravado sozinho |
| O que não tem prova | valor velho ou vazio, sem ninguém saber | vazio com aviso "valor não lido — ver termo", nunca um número chutado |
| Fim de vigência | 63 dos 122 "ativos" sem data de fim | a maioria preenchida (planilha + termo) |
| "Ativos" | contrato sem data conta como ativo | **a contagem cai**: até 37 desses 63 já venceram (§8) |
| Aditivo/prorrogação sem data de assinatura | 156 linhas não contam para prazo nem valor | 83 passam a contar pela planilha ("contratação concluída") |
| De onde veio o número | ninguém sabe | etiqueta em cada valor: termo, planilha + termo, só planilha, digitado, Access |
| % faturado | faturamento de todos os anos contra o valor do período atual | só o faturamento do período vigente |
| Trabalho manual | — | nenhum obrigatório; o que sobra aparece avisado |

**O que não muda:** a regra de "contrato" continua uma só (`consolidarContratos()`); campo que alguém
digitou nunca é trocado; o valor do contrato continua sendo o **valor vigente** (§4.1).

**O que este trabalho não resolve:** bater com o financeiro — o valor faturado oficial está no Protheus,
e o usuário ainda não tem acesso (§10).

## 3. O que a varredura mediu (dev, 28–29/09/2026)

### 3.1 O valor já é lido — só não chega ao cadastro

- As **fichas** do assistente (`FichaDocumento`, spec `2026-09-25-assistente-senior-design.md` §5) já
  guardam, por PDF, o valor lido com página e trecho conferido literalmente: 403 dos 461 termos com
  texto (161 por regra, 242 pela IA). Custo já pago: 6,1 M tokens no DeepSeek para 1.080 PDFs.
- 122 contratos ativos; em **68** o termo assinado mais recente não tem valor gravado. Motivo: em 52 a
  ficha já tem o valor; 8 são PDF escaneado; 8 têm texto e nada foi lido.

### 3.2 O risco não é ler o número, é saber qual número é

- Trechos reais lidos como "valor total": "VALOR TOTAL ESTIMADO DA **SUPRESSÃO**: R$ 72.032,85",
  "VALOR DO **APOSTILAMENTO**: R$ 20.039,52", "VALOR **INICIAL** DO CONTRATO" numa prorrogação, valor
  **mensal**. Dos 403: ~36 são claramente diferença/mensal/inicial; 162 sem rótulo claro.
- Proposta de aditivo traz a **diferença** e o termo traz o **novo total**:
  25.757.866,28 − 165.300,00 = 25.592.566,28 (SGM TC 17/2025). Prorrogação: a proposta traz o
  "valor principal", 4–7% abaixo do termo — não serve de prova direta.
- **O próprio documento erra**: 4 dos 313 valores com extenso têm número ≠ extenso (ex.:
  "R$ 97.181,62 (noventa e quatro mil trezentos e trinta e seis reais…)"). Nenhuma leitura resolve —
  nunca grava sozinho.

### 3.3 Provas independentes que funcionam

| Prova | Resultado |
|---|---|
| Número × extenso no mesmo trecho | 307 de 313 batem |
| Contrato inicial: termo × proposta | 121 de 123 iguais |
| Contrato inicial: termo × planilha | 121 de 124 iguais |
| Prorrogação: termo × planilha | 95 de 116 iguais |
| Aditivo: termo × planilha | mais divergem que batem — a planilha mistura diferença e novo total |

### 3.4 A planilha "Contratos Receita"

`rede.sp - Documentos\PLANILHA DE CONTRATOS DE RECEITA PRODAM\2026.01 - Contratos Receita.xlsx`, aba
`BaseContratos`: 1.377 termos, 423 contratos, 53 clientes; uma linha por termo com tipo do termo
(~80 grafias), valor, início/término, SEI PRODAM/cliente, status de formalização, código do contrato no
**Protheus** (1.373 linhas). **Parada em 23/01/2026** (maior "Data última atualização"; termo mais novo
começa em 16/01/2026). Na coluna "Valor Aditivo / Contrato" os aditivos às vezes trazem a diferença
(ALESP TC 743/2023 TA 01: 1.146.995,85) e às vezes o novo total (CGM TC 16/2024 TA 01: 5.460.171,11).

## 4. Decisões

1. **Valor do contrato = valor vigente** — o que o último termo assinado diz (numa prorrogação, o valor
   do período). É a regra de hoje e a do Access; é o único número escrito no documento, logo provável.
   Valor acumulado fica fora (§10).
2. **Sem fila de conferência.** O sistema grava sozinho só o que está provado (§5); o resto fica vazio
   **com aviso** onde o número aparece. Ninguém é obrigado a confirmar nada.
3. **Fonte única só entra quando o vazio já é um erro.** Valor vazio é honesto (sai da soma, a tela
   avisa) → valor só da planilha **não** grava. Vigência vazia é um erro (o contrato conta como ativo
   para sempre) → vigência só da planilha **grava, com etiqueta** (§5.4).
4. **Planilha: carga única + gabarito.** Não há integração permanente — está parada há 8 meses, o nome
   tem data e o tipo é texto livre. Se alguém voltar a mantê-la, a mesma carga roda de novo (só
   preenche vazio).
5. **Protheus depois.** Quando houver acesso, entra como mais uma fonte, na mesma estrutura (§6.1),
   sem refazer nada.
6. **Ordem dos projetos** com as outras pastas de `rede.sp - Documentos`: (1) este; (2) tabela de
   preços × proposta; (3) links MPLS × faturamento. Calendário de faturamento: ver depois. Cada um com
   o seu design.

## 5. Regras

### 5.1 Categoria do valor lido

Função pura `categoriaDoValor(trecho, tipoLinha)` — **código, não IA** — roda sobre o trecho que a
ficha já guarda (sem gerar ficha de novo):

| Categoria | Exemplos de trecho |
|---|---|
| `total` | "valor do contrato", "valor global/total/estimado do contrato", "preço total do presente contrato" |
| `novo-total` | "passa a ser", "passa para", "passando … para", "valor atualizado do contrato", "totalizando" |
| `periodo` | "para o período (ora prorrogado)", "valor do aditamento/do termo" **em prorrogação** |
| `diferenca` | acréscimo, supressão, redução, complementar, apostilamento, "valor do reajuste" |
| `mensal` / `inicial` / `unitario` | "valor mensal", "valor inicial", "preço unitário" |
| `ambiguo` | nenhuma das anteriores, ou mais de uma |

Categorias aceitas como valor da linha, por tipo:

- `CONTRATO`: `total`.
- `PRORROGACAO`: `total`, `novo-total`, `periodo`.
- `ADITIVO`: só `novo-total`. "Valor do aditivo/termo" num aditivo é ambíguo (pode ser a diferença).
- `RESCISAO` / `PROSPECCAO`: nunca.

### 5.2 Provas

| Prova | Como |
|---|---|
| Literal | trecho está na página citada e contém o número (já é a regra da ficha, `verificarCampo`) |
| Extenso | o valor por extenso do mesmo trecho, convertido em número, é igual ao número |
| Planilha | a linha da planilha do **mesmo termo** tem o mesmo valor (só para linha da planilha "Contrato inicial" ou "Prorrogação") |
| Cadeia | "passa de X para Y": X = valor gravado da linha anterior; ou anterior ± diferença (planilha/proposta) = Y |
| Proposta | contrato inicial: valor da proposta (PC) = valor do termo |

**Contradição** (bloqueia): extenso presente e diferente; planilha do mesmo termo com outro valor; cadeia
que não fecha.

### 5.3 Quando o valor grava sozinho

Todas as condições:

1. o campo `valor` da linha está vazio (nunca troca o que existe);
2. prova **literal** ok;
3. categoria aceita para o tipo da linha (§5.1);
4. **pelo menos uma** outra prova (extenso, planilha, cadeia ou proposta);
5. nenhuma contradição.

Estimativa no dev (medida com uma versão mais simples da categoria; o número final sai da régua, §7):
+25 contratos ativos por planilha + termo, +16 pelo termo com prova forte → 91 de 122. Sobram 31
vazios com aviso (16 só na planilha, 15 sem nada).

### 5.4 Vigência (início e fim da linha)

- **Planilha = termo** (datas iguais): grava, etiqueta "planilha + termo".
- **Termo sozinho**: grava se a ficha leu início **e** prazo e fim = início + meses − 1 dia (prova
  interna); a regra do importador (`extrairCampos`) continua valendo como hoje.
- **Planilha sozinha**: grava com etiqueta "só planilha", **só** se o VerAI não tiver termo desse
  contrato mais novo que o último termo da planilha. Com termo mais novo, a vigência dele tem que vir
  do PDF.
- Datas diferentes entre planilha e termo: não grava, aviso "datas divergem".

Dev: dos 63 ativos sem fim, a planilha tem a data de 50, a ficha de 25; com as duas, 17 iguais e 5
diferentes; 10 sem nada.

### 5.5 Assinatura (a linha vale?)

Regra do usuário (23/09): aditivo/prorrogação só vale assinado (`linhaAssinada`). Hoje 156 dessas
linhas não contam; 152 têm o PDF do termo, 99 escaneados.

- Planilha com "CONTRATAÇÃO CONCLUÍDA" para o mesmo termo — último estágio da lista dela, depois de
  "Pendência Recebimento Termo" — é evidência de termo recebido assinado: `situacao` vazia recebe
  "Assinado (planilha: contratação concluída)". **83 linhas.**
- `data` (Assinada em) continua vindo só do PDF (assinatura eletrônica do SEI, regra de hoje).
- Consequência na ordem: `resumirHistorico` hoje põe linha sem `data` atrás de qualquer linha datada,
  então uma prorrogação que passou a valer pela planilha perderia o "valor atual" para um termo mais
  antigo. A ordem de "mais recente" passa a ser `data` e, sem ela, `dataInicio` da linha; sem nenhuma
  das duas, como hoje (ordem de criação).
- Sem planilha: 45 escaneados (dependem de OCR, §10), 20 com texto sem assinatura lida, 4 sem PDF —
  continuam não contando, como hoje.

## 6. Peças

### 6.1 Banco

- `HistoricoContrato`: `valorOrigem String?`, `valorProva Json?`, `vigenciaOrigem String?`,
  `vigenciaProva Json?`.
  - Origens: `DIGITADO`, `LEGADO`, `TERMO`, `PLANILHA_E_TERMO`, `PLANILHA` (e `PROTHEUS` no futuro).
  - Prova: `{ arquivoId, pagina, trecho, provas: ['extenso', 'planilha', …], planilha: { linha, arquivoSha } }`.
- Carga inicial da origem: linhas com `legacyId` e valor → `LEGADO`; o resto fica `null` ("sem origem
  registrada"). Não dá para saber hoje quem digitou o quê.
- Model `LinhaPlanilhaContratos`: `arquivoSha256`, `linha`, `sigla`, `contrato`, `termo`, `tipoTermo`,
  `valor`, `inicio`, `fim`, `seiProdam`, `seiCliente`, `statusFormalizacao`, `protheus`, `lidaEm`.
  A planilha é a fonte da carga e da régua.
- Migração escrita à mão (nunca `migrate diff` com o banco de dev de shadow).
- **Ordem obrigatória por causa do agendador**: ele roda o código desta pasta contra produção a cada 30
  min e usa `HistoricoContrato` (importador). Coluna nova no model entra no cliente do Prisma no
  `prisma generate`, e toda consulta sem `select` passa a pedir a coluna — em produção, sem a migração,
  a sincronização quebraria. Então: **a migração (colunas novas, todas opcionais) sobe em produção
  antes** de gerar o cliente novo nesta pasta. Coluna opcional a mais não afeta o site no deploy antigo.

### 6.2 Código

- `src/lib/relatorios-clientes/valores/` (regras puras, testadas):
  - `categoria.ts` — §5.1;
  - `extenso.ts` — número por extenso → valor; tolerante a erro de digitação no extenso, e na dúvida
    "não confere", nunca "confere";
  - `provas.ts` — §5.2;
  - `decidir.ts` — §5.3–5.5; devolve `{ grava, origem, prova, aviso }` por linha.
- `src/lib/relatorios-clientes/valores/aplicar.ts` — lê fichas, planilha e histórico; grava só o que
  `decidir` manda e só em campo vazio; relatório por contrato.
- `scripts/planilha-contratos.ts --arquivo=… [--aplicar]` — lê a aba `BaseContratos` (o `exceljs` abre
  este arquivo), grava `LinhaPlanilhaContratos` e guarda uma cópia do `.xlsx` no R2
  (`fontes/planilha-contratos-receita/<sha256>.xlsx`, 578 KB) — a prova de "veio da linha N" não
  depende do SharePoint. Idempotente por `sha256`. Por padrão lê
  `~/rede.sp/rede.sp - Documentos/PLANILHA DE CONTRATOS DE RECEITA PRODAM/`. Se a base da biblioteca
  Documentos (`2026-09-29-biblioteca-documentos-prodam-design.md`) já estiver pronta, a planilha já está
  registrada lá (área `PLANILHA_CONTRATOS`) e esta carga vira o leitor dessa área, sem cópia própria.
- `scripts/sincronizar-sharepoint.ts` — com `--aplicar`, depois das fichas: `aplicarValoresProvados()`,
  com guarda pela própria migração (`MIGRACAO_DOS_VALORES`), como o índice e as fichas: o agendador
  roda o código da pasta contra produção. Não muda o código de saída.
- `src/lib/relatorios-clientes/resumo-historico.ts` — ordem de "mais recente" com `dataInicio` quando
  falta `data` (§5.5).
- `PATCH /api/historico-contrato/[id]` — mudou `valor` → `valorOrigem = DIGITADO` e prova
  `{ usuarioId, em }`; mesma coisa para as datas.
- Auditoria (`importacao-sharepoint/auditoria.ts`), tipos novos com teste:
  `valor-desatualizado` (termo assinado mais novo que a linha do valor, sem valor),
  `cadastro-diverge-do-termo` (valor gravado ≠ valor provado do PDF), `aditivo-nao-fecha` (cadeia),
  `documento-contraditorio` (número ≠ extenso).

### 6.3 Telas

- Aba Contratos (`ValorContrato` em `aba-contratos.tsx`): a dica passa a dizer a origem ("conforme TA 03
  de 12/03/2026 — lido do termo, pág. 2, confere com o extenso"). Sem valor provado: "—" com aviso
  "valor não lido — ver termo"; valor de linha anterior a um termo assinado mais novo: "pode estar
  desatualizado".
- Relatórios (valor total, vencimentos): linha "N contratos ativos sem valor ou com valor que pode
  estar desatualizado · M com vigência só da planilha", com link para a lista. **Não é painel novo**: é
  um aviso na tela que já existe.
- Vigência com origem "só planilha": marca discreta na data.

### 6.4 % faturado no mesmo período

`consolidarContrato` passa a calcular o faturado só das competências dentro do **período vigente**:
do `dataInicio` da linha `CONTRATO`/`PRORROGACAO` assinada mais recente até o fim da vigência efetiva.
Sem início conhecido: comportamento de hoje, com aviso "faturado de todo o contrato". Hoje não gera
saldo negativo no dev (só 24 contratos têm faturamento), mas distorce assim que os valores vigentes
entrarem.

## 7. Régua

`scripts/regua-valores.ts [--salvar]` — antes e depois de qualquer mudança nas regras de §5:

- por contrato ativo: valor provado / vazio com aviso / só planilha; vigência preenchida por origem;
- **acerto contra o gabarito**: para as linhas que gravariam por "termo com prova forte" e que têm
  linha da planilha "Contrato inicial"/"Prorrogação", o valor precisa ser igual. **Meta: zero
  divergência**; cada divergência é investigada antes de ligar a gravação;
- lista do que mudou por contrato em relação à rodada salva (como `regua-sharepoint.ts`).

## 8. Efeitos que o usuário precisa saber antes de aplicar

- **"Ativos" vai cair.** Dos 63 ativos sem data de fim, até 37 têm, pela planilha ou pelo termo, fim
  já passado. Parte pode ter sido prorrogada depois de jan/2026 sem estar na planilha — por isso a
  vigência "só planilha" não vale quando o VerAI tem termo mais novo (§5.4). Relatório de vencimentos
  e valor total mudam junto.
- **Valor total muda** (entram valores que hoje estão fora da soma; valores velhos são trocados só
  onde estavam vazios — a linha nova ganha o valor, a antiga fica como está).
- A régua (§7) roda no dev e o resultado é mostrado ao usuário **antes** de rodar em produção.

## 9. Testes

- Unidade: `categoria` (todos os trechos reais citados em §3.2 entram como caso), `extenso` (inclusive
  os 4 documentos contraditórios e erros de grafia como "QUERENTA"), `provas`, `decidir` (cada linha
  das tabelas de §5.3–5.5), leitura da planilha com uma planilha mínima de fixture.
- Integração: `aplicar` nunca troca campo preenchido; nunca grava com contradição; idempotente (rodar
  duas vezes = mesma coisa).
- Consolidação: faturado por período (§6.4) com e sem início conhecido.
- Arquitetura: teste que falha se alguma rota em `src/app/api/relatorios/` ou nas abas ler
  `HistoricoContrato.valor`/`dataVencimento` sem passar por `consolidarContratos()`.

## 10. Fora do escopo

- **Protheus** (bater com o financeiro): sem acesso ainda. Entra como origem `PROTHEUS` quando houver —
  idealmente um relatório agendado numa pasta do SharePoint, lido pelo mesmo agendador.
- **OCR** dos escaneados: 45 linhas sem assinatura e 8 contratos sem valor dependem dele. Próximo passo
  natural (`tesseract.js` já está no projeto, roda no PC na sincronização), com o seu design.
- Valor acumulado; fila de conferência manual; tabela de preços; links MPLS; calendário de faturamento.
- Integração permanente com a planilha.

## 11. Riscos

- **Categoria errada** num trecho novo que a regra não conhece → cai em `ambiguo` e não grava (erro para
  o lado seguro). A régua mostra quantos ficam de fora.
- **Planilha errada** num contrato inicial/prorrogação → só grava se o termo disser o mesmo número;
  sozinha, a planilha só preenche vigência, e com etiqueta.
- **Produção**: a mesma migração e a carga da planilha rodam em produção só com o ok do usuário, passo
  a passo (como a subida de 28/09). Dev e produção dividem o bucket do R2 — a chave por `sha256` não
  colide.
