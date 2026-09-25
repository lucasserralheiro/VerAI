# Assistente de IA — base econômica e completa (fase 1 de 3) (design)

**Status**: Implementada e validada no dev em 25/09/2026 (commits `80f0e37`…`58a5271`; plano
`docs/superpowers/plans/2026-09-25-assistente-base-economica.md`, seção Andamento). Régua no dev,
antes × depois nos mesmos dados: nenhum resultado cortado, entrada −28% na mediana e −35% no total,
saída +6%; índice com todos os PDFs do histórico. Produção depende do deploy (migração + carga do
índice).
**Data**: 25/09/2026
**Fases**: esta spec (1) → `2026-09-25-assistente-senior-design.md` (2) →
`2026-09-25-assistente-interface-design.md` (3). A 2 e a 3 dependem desta.
**Revê**: de `2026-09-23-assistente-ia-design.md`, as medidas de economia (§3.2), o formato do
resultado das ferramentas (§6) e o momento da indexação (§10 item 1). O resto daquela spec continua
valendo.

---

## 1. Objetivo

Pedido do usuário (25/09/2026): *"eu preciso melhorar a ui e ux desse agente de IA, e eu preciso q
ele seja senior em contratos e tudo que tem dentro do verai, para ele me trazer solucoes, mas tbm
preciso pensar em metodo de nao gastar tanto tokens"*. E, sobre o método: *"usar algum convertedor
por baixo dos panos ja q os contratos ja fica salvo e fazer apenas umas query para evitar custo de
ia"*.

Esta fase **não muda a tela**. Ela faz o assistente receber os dados inteiros, gastar menos token
por pergunta e conseguir ler os PDFs de contrato. É a base das fases 2 e 3.

| | Hoje | Depois |
|---|---|---|
| "Me fale tudo do SMIT" | a IA recebe 11 dos 30 contratos, sem os totais | recebe os 30, com os totais |
| Tokens por pergunta | ~11 mil de entrada (média medida) | ~7–8 mil (estimativa; a régua mede) |
| "E quando ele vence?" (pergunta seguinte) | procura o contrato de novo | usa o id que a conversa já achou |
| Pergunta sobre cláusula de contrato | não tem o que ler (0 PDFs de contrato indexados) | lê os PDFs do histórico |
| PDF que falhou ao indexar | nunca é tentado de novo | tentado de novo no dia seguinte |

## 2. Diagnóstico (varredura de 25/09/2026, banco de dev)

Medições com scripts descartáveis em `.superpowers/tmp/` (git-ignorado).

- **Gasto real**: 5 respostas gravadas, média de 11.447 tokens de entrada (74% em cache) e 692 de
  saída, com 2 ou 3 chamadas ao modelo por pergunta. No roteiro de verificação de 24/09 (§12 da spec
  de 23/09), de 6,7 mil a 27,7 mil de entrada.
- **Parte fixa**: instrução com 2.142 caracteres e catálogo das 15 ferramentas com 7.854 (~3 mil
  tokens). Vai em toda chamada, mas quase sempre sai do cache, que é barato.
- **O que pesa**: o resultado das ferramentas, que entra como texto novo a preço cheio, e o texto da
  resposta (token de saída é o mais caro).
- **Corte**: `limitarResultado` corta o JSON serializado em 6.000 caracteres e entrega o pedaço como
  string (`parcial`), que é JSON quebrado.

  | Ferramenta | JSON | O que a IA vê |
  |---|---|---|
  | `resumoDoCliente` SMIT | 17.115 | 11 de 30 contratos, sem `totais` |
  | `resumoDoCliente` SGM | 9.162 | 9 de 14, sem `totais` |
  | `resumoDoCliente` SMS | 9.020 | 9 de 13, sem `totais` |
  | `contratosVencendo` até 31/12/2026 | 13.385 | cortado |

- **Formato**: o JSON repete o nome de cada campo em cada linha e manda campos vazios (`null`,
  `false`, `"—"`) e `href` longos. O mesmo resumo do SMIT como tabela (cabeçalho uma vez, sem
  vazios, sem `href`) ocupa 4.152 caracteres (−76%).
- **Id do cliente**: em 3 das 5 respostas, uma chamada inteira ao modelo serviu só para achar o id
  (`buscarClientes`).
- **Índice**: 1.083 PDFs de PC/PA/TC/TA ligados ao histórico (1.067 arquivos distintos, 1,1 GB no
  R2) e **nenhum indexado**. Só as 55 propostas comerciais estão no índice (3.102 trechos). O cron da
  Vercel indexa 30 arquivos por dia (`maxDuration` 60 s). Uns 78 arquivos do repositório do cliente
  (publicações do DOC, `WORK/`...) não são fonte do índice.
- **Falha permanente**: `sincronizarIndice()` só refaz um arquivo quando a URL ou a versão mudam.
  Os 4 `DOCUMENTO` em `erro` no dev ("No blob credentials found": o ambiente que indexou não tinha o
  token do Vercel Blob) nunca voltam sozinhos.
- **Tamanho**: banco de dev com 32,9 MB. `TrechoDocumento` ocupa 14,0 MB para 4,2 MB de texto
  (fator 3,3, somando `tsvector` e índices). Amostra de 14 PDFs do histórico lidos do R2: média de
  ~16 mil caracteres (8 a 10 páginas), 1 em cada 7 escaneado. Estimativa para os 1.067: **~50 MB**.

## 3. Decisões

### 3.1 Converte uma vez, consulta sempre (decisão do usuário)

O texto do PDF é extraído uma vez, sem IA (`unpdf` + `repararTextoPdf`, que já existem), e fica no
índice. A pergunta vira consulta ao banco. O PDF continua no R2; o banco guarda só o texto.

### 3.2 O modelo recebe texto compacto; a tela continua recebendo o objeto

Cada ferramenta segue devolvendo o objeto estruturado de hoje, que o stream já manda ao navegador e
que a fase 3 vai desenhar como quadro. O **modelo** passa a receber só uma versão em texto compacto,
pelo `toModelOutput` do `tool()` do AI SDK v7 (confirmado em `@ai-sdk/provider-utils`:
`toModelOutput({ toolCallId, input, output }) => { type: 'text', value }`). Formato no §4.

### 3.3 Corte por linha, nunca no meio

Teto de **8.000 caracteres** no texto compacto que vai ao modelo, contra os 6.000 do JSON de hoje: o
resumo do SMIT inteiro, com ids, dá ~5 mil. Se passar, ficam as primeiras linhas inteiras e o texto
termina com `… mostrando N de M. Para ver o resto, use filtro ou limite menor.` O objeto que vai à
tela não é cortado (as ferramentas já têm `limite` de 1 a 100).

`limitarResultado` deixa de ser aplicado sobre o objeto e vira o corte do texto compacto.

### 3.4 Cliente e contrato identificados antes da IA

Uma função determinística (§5) acha na pergunta a sigla, o apelido ou o nome de um cliente (todos
os 45 clientes têm `siglaLegado`) e o número de um contrato (pela `chaveNumerica`, a mesma do vínculo
de itens). Só entra o que for **único** e **visível** ao usuário. Vai na mensagem do usuário, junto de
"Hoje é…" e da tela aberta, nunca na instrução do sistema (cache).

### 3.5 A conversa lembra os ids

Os `clienteId`/`contratoId` usados pelas ferramentas nas últimas 3 respostas (já gravados em
`MensagemAssistente.ferramentas`) entram na mesma linha de contexto, com o nome. A pergunta seguinte
não precisa chamar `buscarClientes` de novo.

### 3.6 Links curtos

O modelo recebe só o `id` de cada linha (sem `href`) e escreve `[TC 45/SMIT/2023](contrato:ID)`. O
painel converte os esquemas `cliente:`, `contrato:`, `faturamento:`, `demanda:`, `documento:`,
`proposta:`, `confere:` e `fornecedor:` em link interno para `/ir/[tipo]/[id]`, que acha o registro,
confere a permissão e redireciona para a tela certa. `sei:` continua como está. Isso economiza ~55
caracteres por linha de tabela.

### 3.7 Indexação no fim da sincronização do SharePoint

A sincronização já roda a cada 30 min no PC do Lucas, sem o limite de tempo da Vercel e com acesso ao
R2 (`.env.local`). Ao final de uma execução com `--aplicar`, ela chama `sincronizarIndice()` (§7). O
cron diário da Vercel fica como rede de segurança. A carga inicial dos ~1.067 PDFs é feita uma vez à
parte (`scripts/indexar-documentos.ts`), antes de ligar essa etapa, para as rodadas de 30 min só
cuidarem das mudanças.

### 3.8 Nova origem `ARQUIVO_CLIENTE`

Todo arquivo ativo do repositório do cliente que **não** é PC/PA/TC/TA de uma linha do histórico nem
um `Documento` (esses já têm origem própria) vira fonte do índice. `clienteId` é o do arquivo e
`contratoId` fica `null`: arquivo não tem contrato (CLAUDE.md, §7 da spec do repositório). Se um
arquivo passar a ser usado numa linha do histórico, a fonte `ARQUIVO_CLIENTE` some (órfã, removida)
e a `HISTORICO_*` aparece (indexada de novo). Acontece pouco.

### 3.9 Falha é tentada de novo

Índice com `status = 'erro'` e `indexadoEm` com mais de 24 h volta a ser pendente. Assim o erro não
fica para sempre, e um arquivo que continua falhando é tentado no máximo uma vez por dia.

### 3.10 O que não muda

Modelo `deepseek-chat`; instrução fixa no início do prompt (cache); 4 passos; 6 mensagens de
histórico; `maxOutputTokens` 1.500; permissões; `consolidarContratos()` como fonte única de ativo,
vigência, valor e saldo.

## 4. Formato compacto

`src/lib/assistente/ferramentas/compacto.ts`, uma função genérica usada por todas as ferramentas, com
ajustes por ferramenta onde fizer diferença.

Regras da função genérica:

1. Objeto vira linhas `chave: valor`.
2. Somem `null`, `undefined`, `false`, `''`, `'—'` e listas vazias. `true` vira `sim`.
3. Lista de objetos vira tabela: `contratos (total 30, mostrando 30):`, depois o cabeçalho
   `numero|id|fim|…` e uma linha por item. Só entram colunas que têm valor em algum item; a célula
   vazia fica vazia; `|` dentro de um valor vira `/`.
4. `href` nunca vai. `id` vai onde a ferramenta precisa dele para o passo seguinte.
5. O corte do §3.3 é por linha.

Ajustes por ferramenta:

| Ferramenta | Ajuste |
|---|---|
| `resumoDoCliente` | Duas tabelas: **ativos**, com todas as colunas, e **encerrados**, só com número, id, situação, fim e valor. Totais no fim. |
| `contratosVencendo` | Colunas cliente, número, id, fim, dias, valor, saldo e avisos. |
| `detalheDoContrato` | Cabeçalho em linhas; histórico como tabela; PDFs como `proposta: nome (leitura)`. |
| `faturamentos` | Uma linha por competência; NFs resumidas como `2 NFs, R$ X`. |
| `buscarNosDocumentos` | Não vira tabela: cada trecho em bloco `[arquivo, p. N]` seguido da citação entre aspas. |

Os avisos do consolidado (`situacaoDesatualizada`, `prorrogacaoEmAndamento`, vencimento `vencido` ou
`critico`) viram uma coluna `avisos` com palavras curtas ("situação desatualizada", "prorrogação sem
assinatura"). A regra 3 da instrução passa a citar esses textos em vez dos nomes de campo.

Exemplo do formato (números fictícios; o real do SMIT tinha 17.115 caracteres cortados em 6.000):

```
cliente: Secretaria Municipal de Inovação e Tecnologia (SMIT) id:… 
contratos ativos (total 12, mostrando 12):
numero|id|fim|dias|valor|faturado|saldo|%|avisos
TC 45/SMIT/2023|ck…|31/12/2026|97|R$ 1.234.567,00|R$ 500.000,00|R$ 734.567,00|40%|
…
contratos encerrados (total 18, mostrando 18):
numero|id|situacao|fim|valor
…
totais: contratos 30 · ativos 12 · faturado R$ … · demandas 40 · solicitações 12
```

## 5. Identificação antes da IA

`src/lib/assistente/entidades.ts`:

```ts
identificarEntidades(entrada: { pergunta: string; usuario: AuthUser; conversaId?: string }):
  Promise<{ clientes: { id; nome; sigla }[]; contratos: { id; numero; clienteId }[]; texto: string | null }>
```

- **Clientes**: os visíveis ao usuário (`clienteIdsPermitidos`). Para cada um, três termos: a
  sigla, o apelido (o que vem depois do último " - " no nome, ex.: "SPCine") e o nome completo.
  Comparação sem acento e sem diferenciar maiúscula, por palavra inteira: pergunta e termo
  normalizados, com tudo que não é letra, dígito ou hífen virando espaço. **Sigla com até 3 letras
  só casa se estiver escrita em maiúsculas na pergunta** ("SF", "SME", "ICI", "SES"), para não
  confundir com palavra comum.
- **Contratos**: trechos no formato número/ano, com ou sem sigla no meio ("45/2023", "TC
  45/SMIT/2023", "032/2025/SEHAB"), passam pela `chaveNumerica` e são comparados com a
  `chaveNumerica(numeroTermo)` dos contratos visíveis. Se um cliente foi identificado, a busca fica
  restrita a ele.
- **Memória**: ids de `entrada.clienteId`/`entrada.contratoId` nas `ferramentas` das últimas 3
  respostas da conversa, com o nome buscado no banco (só os visíveis).
- **Único ou nada**: se dois ou mais clientes (ou contratos) casam, não entra nenhum daquele tipo, e
  a IA segue a regra de perguntar qual é.
- **Texto**: acrescentado à linha de contexto da mensagem do usuário:
  `Já identificados (use estes ids, não procure de novo): cliente SMIT – Secretaria Municipal de
  Inovação e Tecnologia (clienteId: …); contrato TC 45/SMIT/2023 (contratoId: …).`
- A regra 4 da instrução passa a dizer: "Se o contexto já traz o id do cliente ou do contrato, use-o.
  Se não traz, chame buscarClientes."

## 6. Links curtos

- `links.ts`: `destinoDoLink` aceita `^(cliente|contrato|faturamento|demanda|documento|proposta|confere|fornecedor):([a-z0-9]{20,40})$`
  e devolve `{ tipo: 'interno', href: '/ir/<tipo>/<id>' }`. Id fora do padrão vira texto puro. Os
  links `/clientes/...` das conversas antigas continuam aceitos.
- `src/app/ir/[tipo]/[id]/route.ts` (GET): exige usuário, busca o registro, confere
  `podeVerCliente` (ou `documentosVisiveisWhere` para documento) e redireciona:
  contrato → `/clientes/[c]/contratos/[id]`; faturamento → `/clientes/[c]/faturamentos/[id]`;
  cliente → `/clientes/[id]`; demanda → `/demandas/[id]`; documento → `/documentos/[id]`;
  proposta → `/propostas-comerciais/[id]`; confere → `/confere/historico/[id]`;
  fornecedor → `/fornecedores/[id]`. Sem registro ou sem permissão: 404, igual para os dois.
- Regra 7 da instrução: "Cite a fonte com link [texto](tipo:id), usando o id devolvido pela
  ferramenta." A regra 8 (SEI) não muda.

## 7. Indexação

1. **Na sincronização** (`scripts/sincronizar-sharepoint.ts`): depois da auditoria, se `--aplicar`,
   chama `sincronizarIndice({ limite: 200 })`. Com `--clientes=`, roda uma vez por cliente
   (`clienteId`). Imprime no log:
   `índice do assistente: indexados N · sem texto S · removidos R · erros E · pendentes P`.
   Erro de indexação sai no log e **não muda o código de saída**, porque o `-Estado` do agendador lê
   esse código para falar da sincronização (spec `2026-09-24-sharepoint-automacao-design.md`). A
   rodada seguinte tenta de novo.
2. **`listarFontes()`**: mais uma origem, `ARQUIVO_CLIENTE` (§3.8), com as extensões que
   `extrairPaginas` lê (pdf, docx, xlsx, csv). `hrefDoTrecho` leva à aba Documentos
   (`/clientes/[id]?aba=documentos`).
3. **Falha**: regra do §3.9 dentro de `sincronizarIndice()`.
4. **Carga inicial**: `scripts/indexar-documentos.ts` uma vez no banco de dev e depois no de
   produção. **Produção só com o ok do usuário**, porque lê ~1,1 GB do R2 e grava ~50 MB no Neon.
5. **Tamanho**: a régua (§8) mostra o tamanho de `TrechoDocumento`. Se passar de 80 MB, a execução
   para e a decisão volta ao usuário (ex.: indexar só contratos ativos, 494 arquivos, ~25 MB).

## 8. Régua do assistente

`scripts/regua-assistente.ts`, no mesmo espírito da régua do SharePoint e do `diag:pdf`: medir antes
e depois nos mesmos dados.

- **`--sem-ia` (padrão, custo zero)**: para cada cliente, roda `resumoDoCliente`,
  `contratosVencendo` (hoje + 365 dias) e `faturamentos` (12 meses) como admin, e lista o tamanho do
  texto que iria ao modelo, se foi cortado e quantas linhas foram mostradas de quantas. Mostra também
  o estado do índice (origem × status) e o tamanho de `TrechoDocumento`.
- **`--com-ia`**: 8 perguntas fixas feitas por `executarAgente()` com um admin real e o modelo de
  verdade. Grava pergunta, tokens (entrada, cache, saída), ferramentas chamadas e resposta em
  `.superpowers/regua-assistente/<data-hora>.json`. `--comparar=<arquivo>` mostra a diferença para
  uma rodada anterior. Custo estimado: ~100 mil tokens por rodada.
- **Perguntas fixas**:
  1. "Me fale tudo do cliente SMIT"
  2. "Quais contratos do SMS estão ativos e quanto falta faturar?"
  3. "Quais contratos vencem até 31/12/2026?"
  4. "Qual o saldo do TC 45/SMIT/2023?"
  5. "E quando ele vence?" (na mesma conversa da 4: testa a memória de ids)
  6. "Onde aparece o SEI 6018.2023/0122629-0?"
  7. "O que diz o termo do contrato TC 13/SMIT/2024 sobre reajuste?" (depende do índice)
  8. "Faturamento do SGM nos últimos 6 meses"
- A **linha de base** (`--com-ia --salvar` e `--sem-ia`) é tirada **antes** de qualquer mudança —
  primeira tarefa do plano.

## 9. Critérios de aceite (medidos na régua)

1. Sem IA: nenhum resultado cortado nos 45 clientes; SMIT com 30 de 30 contratos e os totais.
2. Com IA: mediana de tokens de entrada das 8 perguntas **pelo menos 30% menor** que a linha de base,
   e tokens de saída não maiores.
3. Pergunta 5 sem `buscarClientes` e sem busca de contrato por número.
4. Números das respostas 1 a 4 iguais aos de `consolidarContratos()` (mesmo cruzamento do §12 da spec
   de 23/09).
5. Índice: nenhum PDF do histórico pendente depois da carga; escaneados como `sem_texto`; pergunta 7
   citando arquivo e página.
6. `TrechoDocumento` no banco de dev até 80 MB.

## 10. Erros e riscos

| Situação | Comportamento |
|---|---|
| Sigla casa por engano | Só entra quando é único, palavra inteira e (se curta) em maiúsculas. O texto diz "já identificados", e a IA pode pedir confirmação se não fizer sentido. |
| Modelo não entende a tabela | Tabela com `\|` é formato comum para modelos. A régua compara as respostas antes × depois. |
| Instrução e catálogo mudam | O cache recomeça uma vez. Irrelevante no custo. |
| Link antigo em conversa salva | `/clientes/...` continua aceito. |
| Indexação atrasa a sincronização | Teto de 200 arquivos por rodada; a carga grande é feita à parte, antes. |
| Arquivo ainda no Vercel Blob (suspenso) | Fica `erro` e é tentado de novo a cada 24 h (§3.9). Mudar o armazenamento desses arquivos fica fora. |

## 11. Testes (TDD, Jest)

1. `compacto.test.ts`: somem os vazios; lista vira tabela com cabeçalho uma vez; coluna sem valor
   some; `|` no valor; `href` nunca aparece; corte por linha com o aviso; nada cortado abaixo do teto.
2. Ferramentas: `toModelOutput` do resumo com 30 contratos cabe inteiro; valores iguais ao
   consolidado (os testes atuais passam a olhar o texto compacto além do objeto).
3. `entidades.test.ts`: SMS × SMSU × SMSUB; sigla curta só em maiúsculas; apelido; nome sem acento;
   contrato pela `chaveNumerica` (zero à esquerda, sigla no meio); dois candidatos não entram; cliente
   sem permissão não entra; memória das 3 últimas respostas.
4. `links.test.ts`: novos esquemas viram `/ir/...`; id inválido vira texto; `sei:` e `/clientes/...`
   continuam.
5. `/ir/[tipo]/[id]`: redireciona certo por tipo; 404 sem permissão igual a inexistente; 401 sem
   usuário.
6. `fontes.test.ts`: `ARQUIVO_CLIENTE` só para arquivo ativo sem uso no histórico nem em `Documento`.
7. `sincronizar.test.ts`: `erro` com mais de 24 h volta a pendente; com menos, não.
8. `agente.test.ts`: "Já identificados" vai na última mensagem do usuário, nunca no `system`.

## 12. Fora de escopo

- Qualquer mudança na tela (fase 3).
- Alertas, manual, normas e fichas de documento (fase 2).
- Trocar de modelo, embeddings, OCR no servidor.
- Levar para o R2 os arquivos que ainda estão no Vercel Blob (`Documento`, PDF de faturamento).

## 13. Ordem (para o plano)

1. Régua e linha de base (antes de tudo).
2. Formato compacto, `toModelOutput` e corte por linha.
3. Links curtos e `/ir/[tipo]/[id]`.
4. Identificação de entidades e memória de ids.
5. Instrução atualizada (regras 3, 4 e 7).
6. `ARQUIVO_CLIENTE`, nova tentativa de erro e indexação na sincronização.
7. Carga inicial no dev; régua depois × antes; carga em produção com o ok do usuário.
8. Atualizar o CLAUDE.md (seção do assistente) e marcar nesta spec o que foi feito.
