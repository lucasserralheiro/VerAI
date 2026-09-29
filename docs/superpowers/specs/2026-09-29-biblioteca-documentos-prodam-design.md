# Biblioteca "Documentos" do SharePoint no VerAI (base) — design

**Status:** rascunho para revisão do usuário (29/09/2026). Base comum de três telas com design próprio:
`2026-09-29-tabela-de-precos-design.md`, `2026-09-29-links-mpls-design.md` e
`2026-09-29-calendario-faturamento-design.md`.

## 1. Pedido

A biblioteca **Documentos** do SharePoint da PRODAM tem quatro pastas — CALENDÁRIO FATURAMENTO,
FATURAMENTO SERVIÇOS PRODAM, PLANILHA DE CONTRATOS DE RECEITA PRODAM, TABELA DE PREÇOS PRODAM-SP. O
usuário quer isso **dentro do VerAI**, "estruturado igual foi feito no clientes, com UI e UX boas", nos
menus **embaixo de "Relatórios dos clientes"**, e atualizado **pelo mesmo agendador de tarefas que já
funciona**.

## 2. Hoje × depois

| | Hoje | Depois |
|---|---|---|
| Onde ver | só no SharePoint, pasta por pasta | três telas no VerAI, dentro de "Relatórios dos clientes" |
| Formato | PDF e planilha soltos | dados organizados: preços pesquisáveis, links por contrato e mês, prazos de faturamento |
| Atualização | — | a cada 30 min, na mesma passada que já traz os contratos |
| Quem vê | quem tem acesso à pasta no SharePoint | por tela: preços e calendário para todos; links só dos clientes de cada usuário |

**O que não muda:** a sincronização da ContratosReceita, o código de saída que o agendador lê e a aba
Documentos de cada cliente (os arquivos desta biblioteca não são do repositório do cliente).

## 3. O que tem na biblioteca (29/09/2026)

Sincronizada pelo OneDrive em `C:\Users\p017886\rede.sp\rede.sp - Documentos\`, ao lado de
`rede.sp - ContratosReceita`.

| Pasta | Conteúdo | Vira |
|---|---|---|
| TABELA DE PREÇOS PRODAM-SP | tabela 2026 v3.0 (PDF, 19 págs), publicação no DOC de 21/09/2026, informativo de alterações, "Memória de Cálculo 2026 v3.0.xlsx" com os 315 serviços | tela **Tabela de preços** |
| FATURAMENTO SERVIÇOS PRODAM | `Links MPLS - Relatórios para Faturamento/<ano>/<AAAA.MM …>/<categoria>/…pdf`, ~600 relatórios de uma página, de jan/2025 a set/2026 | tela **Links MPLS** |
| CALENDÁRIO FATURAMENTO | "Calendário de Faturamento PRODAM 2026.pdf" (uma página, prazos marcados por cor, feriados em texto) | tela **Calendário de faturamento** |
| PLANILHA DE CONTRATOS DE RECEITA PRODAM | "2026.01 - Contratos Receita.xlsx", parada em 23/01/2026 | **sem tela**: os dados entram nos contratos (spec `2026-09-29-valor-vigencia-contratos-design.md`) |

**Por que a planilha não tem tela:** está parada há 8 meses; uma tela mostraria dado velho como se fosse
atual. O conteúdo aparece onde é usado, nos contratos, com a etiqueta de origem.

## 4. Menu

Subitens de **Relatórios dos clientes** (`src/components/nav-bar.tsx`, `RELATORIOS_SUBLINKS`), depois dos
que já existem — a ordem atual não muda:

```
Relatórios dos clientes
  Fornecedores · Demandas · Solicitações · Relatórios · Todos os documentos
  Tabela de preços            /tabela-de-precos          ícone Tags
  Links MPLS                  /links-mpls                ícone Network
  Calendário de faturamento   /calendario-faturamento    ícone CalendarDays
```

Cada item só aparece quando a sua tela está pronta (entregas separadas, §9).

## 5. Sincronização

### 5.1 Mesmo agendador, mesma passada

`scripts/sincronizar-sharepoint.ts` — o mesmo que o `.bat` e o Agendador do Windows já rodam a cada 30
min — ganha uma segunda etapa, **depois** da ContratosReceita e antes do índice e das fichas:

1. lista `~/rede.sp/rede.sp - Documentos` (opção `--pasta-documentos=` e `SHAREPOINT_PASTA_DOCUMENTOS`,
   como a pasta de hoje);
2. arquivo novo ou mudado (tamanho + data, depois `sha256` — mesma regra de `mudouPorMetadado`) sobe para
   o R2 e é registrado;
3. arquivo que sumiu: remoção lógica (`removidoNaOrigemEm`), nunca apaga do R2 — dev e produção dividem
   o bucket;
4. cada arquivo novo ou mudado passa pelo **leitor da sua área** (§5.3);
5. **conferência**: arquivos na pasta × registrados, por área. Divergência sai no log e o código de
   saída vira 2, como na ContratosReceita.

A etapa roda **isolada**: erro nela não desfaz nem esconde a passada dos contratos (log próprio,
`[documentos] …`). Com `--clientes=` (teste em dev) ela é pulada; `--sem-documentos` pula de propósito.

### 5.2 Guarda pela migração

Como o índice e as fichas: o agendador roda o código da pasta contra produção, que pode estar num deploy
anterior. Sem a migração desta base aplicada (`MIGRACAO_DA_BIBLIOTECA`), a etapa escreve "biblioteca
Documentos: aguardando migração" e não faz nada. **Nunca muda o código de saída** por isso.

### 5.3 Leitores por área

A área sai do primeiro nível do caminho (`areaDoCaminho()`, regra pura, tolerante a caixa e acento):

| Pasta | Área | Leitor |
|---|---|---|
| TABELA DE PREÇOS… | `TABELA_PRECOS` | spec da tabela de preços |
| FATURAMENTO SERVIÇOS… | `LINKS_MPLS` | spec dos links |
| CALENDÁRIO FATURAMENTO | `CALENDARIO` | spec do calendário |
| PLANILHA DE CONTRATOS… | `PLANILHA_CONTRATOS` | spec do valor e vigência (carga da planilha) |
| outra | `OUTRO` | nenhum — só guarda |

Contrato de um leitor: `ler(arquivo, conteudo) → { status: 'ok' | 'parcial' | 'erro', avisos }`, gravando
os próprios dados. É **idempotente por `sha256`**: o mesmo conteúdo lido duas vezes dá o mesmo
resultado. Erro num arquivo não para os outros e fica em `leituraStatus`/`leituraMensagem`. Mudou a regra
de um leitor → `--reler=<area>` relê só aquela área.

### 5.4 Data na tela

`AtualizacaoSharepoint` ganha `biblioteca` (`CONTRATOS_RECEITA` para o que já existe,
`DOCUMENTOS` para esta). A regra de "passada completa" (spec `2026-09-28-sharepoint-atualizado-em`) vale
para cada biblioteca separadamente. As três telas mostram "Atualizado em …" com o mesmo componente
`<AtualizacaoSharepoint biblioteca="DOCUMENTOS" />` (laranja depois de 2 h).

## 6. Banco

- `ArquivoBiblioteca`: `id`, `biblioteca` (`DOCUMENTOS`), `caminho` (único por biblioteca), `area`,
  `nome`, `extensao`, `contentType`, `tamanhoBytes`, `sha256`, `chave` (`r2:biblioteca-documentos/<sha256>.<ext>`
  — pelo conteúdo, então dev e produção não colidem e arquivo repetido não duplica), `modificadoEm`,
  `vistoEm`, `removidoNaOrigemEm`, `leituraStatus`, `leituraMensagem`, `lidoEm`.
- **Não é `ArquivoCliente`**: esses arquivos não são de um cliente (preço e calendário são de todos; o
  relatório de links pertence a um contrato, e isso fica no dado lido, não no arquivo). A regra "arquivo
  de cliente existe num lugar só" continua valendo para os arquivos de cliente.
- `AtualizacaoSharepoint.biblioteca` (§5.4).
- Migração escrita à mão (nunca `migrate diff` com o banco de dev como shadow).

## 7. Entrega do arquivo

`GET /api/biblioteca/[id]` — lê do R2 e devolve com `Content-Disposition: inline`. A chave do R2 nunca vai
ao navegador (mesma regra de `urlBlob`). Permissão por área: `TABELA_PRECOS` e `CALENDARIO` para
qualquer usuário logado; `LINKS_MPLS` pelo cliente do contrato do relatório (`verificarAcessoCliente`),
sem contrato identificado só admin; `PLANILHA_CONTRATOS` e `OUTRO`, só admin.

## 8. Padrão de tela (vale para as três)

Mesmo desenho das telas de "Relatórios dos clientes" (paleta institucional `navy`/`orange`, `<h1>` de
texto no topo):

- topo: título, uma linha do que é a tela e "Atualizado em …" (§5.4);
- carregando: esqueleto com a forma do conteúdo, nunca tela em branco;
- vazio: explica por quê ("a pasta ainda não tem o calendário de 2027") e não um "nenhum resultado";
- erro de leitura de um arquivo: o arquivo aparece com "não foi possível ler — abrir o PDF", nunca some;
- todo número lido tem o caminho para o documento de origem (abrir o PDF);
- funciona em tela de 360 px (tabela vira lista de cartões) e por teclado (busca com `/`, `Esc` limpa).

## 9. Entregas

1. **Base** (este documento) + **Tabela de preços** — a tela de dados mais limpos e mais usada.
2. **Links MPLS.**
3. **Calendário de faturamento** — depende do teste da leitura por cor (spec do calendário, §4).

Cada entrega tem o seu plano e vai para produção com o ok do usuário.

## 10. Testes

- `areaDoCaminho()` com os nomes reais e variações de caixa/acento.
- Sincronização com fonte falsa (`FonteArquivos` injetada, como a de hoje): novo, mudado, igual (não relê),
  sumiu (remoção lógica), leitor com erro (os outros seguem), conferência com divergência (código 2),
  guarda sem migração (não faz nada e não muda o código).
- `GET /api/biblioteca/[id]`: cada área × perfil de usuário.

## 11. Fora do escopo

- Escrever de volta no SharePoint (o VerAI só lê).
- Tela da planilha de contratos (§3).
- Microsoft Graph no lugar da pasta do OneDrive — a fonte continua injetada, então dá para trocar depois.

## 12. Riscos

- **OneDrive "sob demanda"**: arquivo que ainda não baixou é lido na hora (mais lento). Marcar a pasta
  `rede.sp - Documentos` como "Sempre manter neste dispositivo".
- **PC desligado**: vale o mesmo da ContratosReceita — a tela mostra a data da última passada, em laranja
  depois de 2 h.
- **Renomear pasta no SharePoint** muda a área: `areaDoCaminho` é tolerante e a área desconhecida vira
  `OUTRO` (guarda, não lê) e aparece no log.
