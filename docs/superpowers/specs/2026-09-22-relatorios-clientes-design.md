# Relatórios dos clientes — migração do GRC-1 (design)

**Status**: Decisões de escopo e arquitetura fechadas, detalhamento de código pendente.
**Data**: 22/09/2026

---

## 1. Objetivo

Trazer para dentro do VerAI, na área "Relatórios dos clientes" (primeiro grupo do menu — ver
`CLAUDE.md`), tudo que hoje vive no sistema legado **GRC-1** (Microsoft Access,
`ControleGEN-1.accdb`): cadastro de clientes, fornecedores, contratos (com aditivos/prorrogações/
rescisões), itens de contrato, faturamento, notas fiscais, demandas e solicitações de TI.

**Não é um espelho de leitura.** O objetivo final é a descontinuação completa do Access: a partir
de um corte, todo cadastro novo — contrato novo, aditivo, faturamento, fornecedor, demanda,
solicitação — é feito dentro do VerAI. Cada tela precisa de cadastro completo (criar/editar), não
só consulta.

## 2. Contexto

O usuário (Coordenador de Processos na Gerência de Inovação da PRODAM) recebeu o pedido de
reproduzir, dentro do VerAI, um relatório de clientes parecido com um diagrama desenhado à mão
(Cliente → Contratos → SEI/Propostas/Aditivos → Faturamento/Saldo do item).

Levantamento feito em 22/09/2026 (usuário compartilhou os dois arquivos `.accdb` do sistema e deu
acesso ao computador para navegar pelas telas ao vivo) mostrou que esse diagrama é uma simplificação
de um sistema Access completo já em uso na PRODAM — **GRC-1**, "Gerência de Relacionamento com
Clientes" — com ~29 tabelas e mais de 20 telas, organizadas em 6 grupos: **Clientes, Fornecedores,
Contratos, Acompanhamento de Demandas, Faturamento e Relatórios**.

Durante a conversa, o usuário decidiu expandir o escopo de "replicar o diagrama" para "migrar o
sistema inteiro", porque o Access vai ser desligado — não pode sobrar nenhuma área só de leitura,
sem outro lugar pra cadastrar o dado novo.

Registro completo do levantamento (telas abertas, achados) no §6.

## 3. Decisões

### 3.1 Escopo: sistema inteiro, não só o diagrama original

Os 6 grupos do GRC-1 entram todos, com CRUD completo (criar + editar; exclusão fica em aberto,
ver §5):

- **Clientes** — cadastro de cliente + responsáveis de contato
- **Fornecedores** — cadastro de fornecedor + contratos de operacionalização (CO) + termos de
  confirmação (a ponte fornecedor ↔ cliente)
- **Contratos** — contrato de receita (cabeçalho), histórico do contrato (aditivo/prorrogação/
  rescisão/prospecção como linhas do tempo, não entidades separadas — ver §3.5), itens de contrato
- **Acompanhamento de Demandas** — demandas/documentos (com trâmite) + solicitações de TI
- **Faturamento** — faturamento mensal + notas fiscais
- **Relatórios** — telas de consulta que cruzam os domínios acima (contratos por cliente,
  vencimento, valor total, SEI por cliente, status de faturamento)

### 3.2 Migração de corte único, não sincronização periódica

Decisão original (antes do escopo virar "sistema inteiro") era reimportar o `.accdb` periodicamente,
como um espelho de leitura. Com o Access sendo descontinuado, isso não se sustenta: depois do corte,
quem escreve é o VerAI. O `.accdb` serve para a **carga inicial** (uma vez, ou algumas vezes durante
uma eventual transição em paralelo, se a equipe continuar usando os dois sistemas por um tempo) — não
para sincronização contínua.

Script de importação (Task 2 do plano) precisa ser **idempotente** (rodar mais de uma vez sem
duplicar), usando os IDs do Access (`ID_Cliente`, `ID_ContrReceit`, `ID_Proposta`, `ID_Aditivo`,
`ID_Faturamento`, `ID_NotaFiscal`, `ID_Doc`, `Nº` da Solicitação, `ID_Fornecedor`) como `legacyId` de
cada model novo, para suportar reimportações de ajuste antes do corte final.

### 3.3 Leitura do `.accdb`: `mdbtools`, sem precisar de Access/Windows

Confirmado na investigação: `mdbtools` (Linux, `apt install mdbtools`) lê o `.accdb` inteiro —
tabelas, schema e até os relacionamentos declarados (`MSysRelationships`) — sem precisar do Access
nem de driver ODBC do Windows. O script de importação (Task 2) roda em qualquer ambiente Linux com
o arquivo em mãos; não depende do computador do usuário nem do Access instalado.

**Revisão (22/09/2026, Task 2):** na prática, a máquina onde a Task 2 foi executada é **Windows**,
sem `mdbtools`/`apt` disponível e sem toolchain de build nativo (sem Python/`node-gyp`) pra
compilar uma lib npm nativa tipo `node-odbc`. O mecanismo efetivamente escolhido foi **PowerShell +
OleDb** (`Microsoft.ACE.OLEDB.16.0`, já registrado no Windows): `scripts/importar-grc1.ts` chama
`powershell.exe -EncodedCommand` via `child_process.execFileSync`, sem dependência nova no
`package.json`. Dois detalhes de codificação (comando via `-EncodedCommand` em vez de `.ps1` em
disco, resultado escrito em arquivo UTF-8 sem BOM em vez de lido do stdout) foram necessários pra
identificador e valor acentuado (`T_Responsável`, `Solicitação`, ...) não corromperem — ver
cabeçalho do script e `task-2-report.md` (Step 1) pro detalhe completo. `queryAccess()` é a única
função presa a este mecanismo; em outro ambiente (Linux, com `mdbtools` instalado) só ela precisaria
ser reescrita.

### 3.4 Mapeamento Cliente legado ↔ `Cliente` do VerAI: campo de sigla

`Cliente` do VerAI ganha um campo `siglaLegado String? @unique` guardando a sigla do GRC-1 (`SMS`,
`SME`, `SF`, `SGM`, `SEGES`, `SMT` — os 6 clientes hoje cadastrados no legado). O script de
importação casa por essa sigla; se não houver `Cliente` correspondente no VerAI, cria um novo. Não
casa por nome (frágil a divergência de grafia — ex. "SECRETARIA MUNICIPAL DA SAÚDE" vs. o nome que
já estiver salvo no VerAI).

### 3.5 Histórico do contrato é uma tabela só, com campo `Tipo` — não entidades separadas

O diagrama original sugeria `Contrato → [Propostas, Aditivos]` como duas listas separadas. A tela
real de cadastro (`FT_ContratosReceita`, subform "Histórico do Contrato") mostrou que não é assim:
é **uma lista única**, cronológica, onde cada linha tem um campo `Tipo` com os valores **Contrato,
Aditivo, Prorrogação, Rescisão, Prospecção**. `HistoricoContrato` no VerAI segue esse mesmo desenho
— um enum `Tipo`, não uma entidade por tipo. A tabela antiga só de aditivo (`T_Aditivo`) está vazia
no legado (0 linhas) — foi substituída na prática pelo campo `Tipo` em `T_Propostas`; não é migrada
como entidade própria.

### 3.6 Saldo do item: calculado no nível de contrato, não de item

Não existe, hoje, nenhuma query ou tela no GRC-1 que calcule saldo por item de contrato (procurado
nas duas crosstabs existentes, `XC_FaturamentoMensal_Cliente` e `XC_Total` — nenhuma cruza
`T_ItensContrato` com o faturado). É uma conta nova do VerAI, decidida no nível mais simples que já
é viável com o dado existente: **saldo do contrato = soma de `ItemContrato.valorTotal` do contrato
− soma de `NotaFiscal.valor` dos faturamentos daquele contrato**. Cálculo por item específico ficou
fora de escopo por enquanto — exigiria criar um vínculo Nota Fiscal → Item que não existe no legado
(`NotaFiscal` liga só a `Faturamento`, que liga a `Contrato` como um todo, não a um item).

**Revisão (22/09/2026, Task 2):** a Task 2 (script de importação) investigou o vínculo
`T_ItensContrato` → `T_ContratoReceita` que o saldo acima pressupõe e não encontrou **nenhuma
chave de junção confiável nos dados reais**: `T_ItensContrato` não tem FK declarada no `.accdb`
pra `T_ContratoReceita` (conferido via `OleDbSchemaGuid.Foreign_Keys`), e o texto livre da coluna
`Contrato` (ex. `"031/SEME/2017"`) não bate com nenhum campo identificador de `T_ContratoReceita`
(`Nº do Termo`, `Documento`, `SEI`) mesmo escopando por cliente — **0 de 146** linhas checadas
manualmente na cópia de teste. A coluna `Cliente` de `T_ItensContrato` cita 37 siglas distintas, a
maioria fora dos 6 clientes deste GRC-1, sugerindo que é uma tabela de itens/produtos mais ampla da
PRODAM, não escopada a este sistema — consistente com o achado acima de que o próprio legado nunca
cruza as duas tabelas.

Decisão do usuário (fix round 1 da Task 2): em vez de descartar a linha sem vínculo,
`ItemContrato.contratoId` virou **opcional** e ganhou `contratoTextoLegado` (texto bruto da coluna
`Contrato` quando não casou) — migração `20260922143856_item_contrato_contrato_opcional`. O script
importa as 879 linhas de `T_ItensContrato` da cópia de teste mesmo assim; na prática, **nenhuma**
delas casou com um `Contrato` conhecido (0/879 com `contratoId` preenchido). **Consequência direta
pro saldo deste parágrafo:** hoje ele só soma itens com `contratoId` preenchido, que é
essencialmente nenhum — o saldo por contrato precisa ser exibido com uma ressalva explícita
("sem itens reconciliados") até a reconciliação manual acontecer. A tela de reconciliação é a
própria edição de `ItemContrato` pra setar seu `Contrato` (Task 5, cadastro de itens) — não há
tela dedicada nova prevista só pra isso.

### 3.7 Navegação: sub-áreas dentro de "Relatórios dos clientes"

Proposta (a confirmar com o usuário antes da Task de navegação): o grupo de menu "Relatórios dos
clientes" (já existe, primeiro grupo, antes de "Proposta Comercial" — `src/components/nav-bar.tsx`)
ganha sub-itens para os 6 domínios, no mesmo padrão de sub-item que "ConfereAI" já usa para
"Histórico". Rotas propostas (a validar):

- `/clientes` — lista de clientes (tela já existente, ganha os campos novos)
- `/clientes/[id]` — ficha do cliente: contratos, faturamento, demandas daquele cliente
- `/fornecedores` — cadastro de fornecedores + CO + termos de confirmação
- `/demandas` — demandas/documentos + trâmite
- `/solicitacoes` — solicitações de TI
- Relatórios cross-cliente (vencimento, valor total, SEI) — a definir se viram views dentro de
  `/clientes` ou uma área própria `/relatorios`

## 4. Modelo de dados — legado → VerAI

| Tabela Access (GRC-1) | Model VerAI | Observação |
|---|---|---|
| `T_Cliente` | `Cliente` (existente, estendido) | + `siglaLegado`, `endereco`, `numero`, `bairro` |
| `T_Responsável` | `ResponsavelCliente` | nome, área, e-mail, telefone, celular |
| `T_Fornecedor` | `Fornecedor` | |
| `T_CO_Operacionalização` | `ContratoOperacionalizacao` | lado do fornecedor |
| `T_TermoConfirmação` | `TermoConfirmacao` | ponte fornecedor ↔ cliente, via `Contrato` |
| `T_ContratoReceita` | `Contrato` | cabeçalho: Nº Termo, SEI Cliente/PRODAM, situação |
| `T_Propostas` | `HistoricoContrato` | linha do tempo, campo `tipo` (§3.5) |
| `T_Aditivo` | *(não migrada — 0 linhas, substituída por `HistoricoContrato.tipo`)* | |
| `T_ItensContrato` | `ItemContrato` | base do cálculo de saldo (§3.6) |
| `T_Faturamentos` | `Faturamento` | |
| `T_NotaFiscal` | `NotaFiscal` | liga a `Faturamento`, não a `ItemContrato` |
| `T_Documento` | `Demanda` | assunto, tipo, responsável |
| `T_Trâmite` | `TramiteDemanda` | histórico de posição/ação de uma `Demanda` |
| `T_Solicitação` | `Solicitacao` | chamados de TI (RDM/Solicitação) |

Todo model novo carrega um campo `legacyId Int? @unique` (ID original do Access) para a importação
idempotente (§3.2).

## 5. Fora de escopo / pendente

- **Exclusão de registros** — não decidido ainda se cada CRUD novo tem "excluir" ou só
  criar/editar (o Access legado tem exclusão em algumas telas, não em todas — verificar tela por
  tela na hora de detalhar cada task).
- **Validação de campo por tela** — o Access valida via VBA, que não é extraível por ferramenta
  nenhuma usada no levantamento; cada regra (formato de SEI, transições de `Situação`, campo
  obrigatório) precisa ser definida com o usuário na hora de detalhar cada task do plano.
- **Período de transição em paralelo** — se a equipe usar Access e VerAI ao mesmo tempo por um
  tempo antes do corte final, o script de importação (idempotente, §3.2) permite reimportações de
  ajuste; não decidido ainda se/quando isso acontece.
- **Navegação exata** (§3.7) — proposta, não confirmada.
- **Dado sensível em texto livre** — `Observação`/`OBS`/`Trâmite` guardam nome de pessoa e
  anotação informal solta; migra como está, sem tratamento automático.

## 6. Levantamento realizado (registro)

Levantamento feito em 22/09/2026, em duas etapas:

1. **Leitura direta dos `.accdb`** (`mdbtools`, sem Access): schema de todas as tabelas relevantes,
   relacionamentos declarados (`MSysRelationships`), contagem de linhas (`T_Cliente`: 6,
   `T_ContratoReceita`: 45, `T_ItensContrato`: 879, `T_Propostas`: 5.368, `T_Aditivo`: 0,
   `T_Faturamentos`: 635, `T_NotaFiscal`: 158, `T_Documento`: 138), lista de queries salvas (23,
   incluindo as duas crosstabs `XC_FaturamentoMensal_Cliente` e `XC_Total`).
2. **Navegação ao vivo no Access** (acesso de computador concedido pelo usuário): todas as ~20
   telas dos 6 grupos do painel principal, confirmando campos reais exibidos, valores de exemplo
   (cliente SMS) e a descoberta do §3.5 (campo `Tipo` no histórico do contrato).

## 7. Referências

- Plano de implementação: `docs/superpowers/plans/2026-09-22-relatorios-clientes.md`
- Padrão de relatório já existente no VerAI (cache/storage/auditoria): `CLAUDE.md`,
  `src/app/api/documentos/[id]/relatorio/route.ts`
- Modelo `Cliente` atual: `prisma/schema.prisma`
