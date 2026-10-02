# Links MPLS no VerAI — design

**Status:** implementado no dev em 30/09/2026 ("pode fazer todos"). Depende da base
`2026-09-29-biblioteca-documentos-prodam-design.md`.

**Revisão de 30/09 — tela geral retirada.** A tela entrou "porque a pasta estava lá", sem pedido da equipe, e
não apoia decisão (sem R$, sem cruzar com o faturado). O total geral enganava (1.431 links em jan/2025 → 248 em
set/2026, acompanhando 40 → 17 relatórios na pasta, sem dizer se é rede encolhendo ou PDF faltando) e o
"cancelados no mês" era a lista acumulada do PDF (SMADS out/2025: 4 "cancelados", 1 saiu de fato). Ficou: a
leitura no agendador, o cartão no detalhe do contrato e `/links-mpls/contrato/[id]` (evolução, entraram/saíram,
PDF); a lista de cancelados aparece como "lista do relatório — inclui meses anteriores". Saíram: o item do menu,
`/links-mpls`, `GET /api/links-mpls` e `listarLinks`. Os relatórios sem contrato no VerAI (SEGES 24/2025) deixam
de ter tela. A §6.1 abaixo é histórica. Volta a ter tela geral se cruzar links × tabela de preços (§10).

**Decisões da execução (30/09):**
- **Prova por seção**: um PDF pode ter "LINKS ATIVOS" e "LINKS CANCELADOS", cada um com o próprio "Total Geral"
  e "TOTAL ="; cada seção confere com os seus códigos. O título da seção se repete no topo de cada página — seção
  nova só quando a situação muda. Régua (`scripts/regua-links.ts`, 30/09): **601 de 628 (96%)** conferidos,
  14.706 links; os 27 que não fecham são, em quase todos, o próprio PDF dizendo dois totais diferentes (ex.:
  "Total Geral 110" e "TOTAL = 107"; resumo 86 e tabela com 53) — aparecem "leitura não conferida", sem número.
- Campos por **formato** (código, contrato, Kbit/s, redundância, datas) e por **posição** só onde precisa
  (entidade, tipo, endereço, número — pela posição do cabeçalho de cada página).
- Contrato pela mesma regra dos controles (`acharContratoPorSigla`: sigla do arquivo + nº/ano das linhas, do
  cabeçalho e do nome; sigla escrita de outro jeito e "S.N" casam; só único). Dev: 5 sem contrato, todos do SEGES
  24/2025, que não está no cadastro. Religa a cada rodada sem reler o PDF.
- Na ficha: cartão "Links MPLS: N ativos em <mês>" no **detalhe do contrato** (ao lado do controle do faturamento),
  em vez de uma coluna na aba Contratos — uma chamada por contrato aberto, não uma por linha da lista.
- PDF do relatório abre para quem vê o cliente do relatório (`/api/biblioteca/[id]`); sem cliente, só admin.

## 1. Pedido

Tela **Links MPLS** dentro de "Relatórios dos clientes", estruturada a partir da pasta FATURAMENTO
SERVIÇOS PRODAM do SharePoint ("Links MPLS - Relatórios para Faturamento"), atualizada pelo agendador.

## 2. Hoje × depois

| | Hoje | Depois |
|---|---|---|
| Quantos links um contrato tem | abrir o PDF do mês do cliente | número na tela, por contrato, mês a mês |
| O que mudou de um mês para o outro | comparar dois PDFs no olho | "entraram 2, saíram 1", com quais links |
| Onde está o relatório de um cliente | navegar ano → mês → categoria → arquivo | filtro por cliente e mês; o PDF a um clique |
| Relatório com erro (título de outro cliente, total que não fecha) | ninguém percebe | aviso no relatório |
| No contrato do cliente | nada | "Links MPLS: 12 ativos em set/2026", levando para a tela |

## 3. Fonte (29/09/2026)

`FATURAMENTO SERVIÇOS PRODAM/Links MPLS - Relatórios para Faturamento/<ano>/<AAAA.MM - Relatórios de
<Mês> de <ano>>/<categoria>/<SIGLA MM-AAAA - … - TC …>.pdf` — **628 relatórios**, jan/2025 a set/2026,
de 17 a ~40 por mês.

Cada PDF (uma página na amostra) traz:

- título "LINKS - CGM Setembro-2026" (categoria, sigla, mês);
- resumo por velocidade × redundância e "Total Geral N";
- tabela: `[Data Cancelamento] | CÓD MPLS (ID) | Contrato PRODAM | Kbit/s | Tipo de Redundância | Data
  Aceite | Entidade de Instalação | Tipo | Endereço | Número`;
- "TOTAL = N";
- rodapé "CONTRATO CGM Nº 16/CGM/2024", o serviço ("LINKS MPLS - SERVIÇO DE LINK", "… DE
  GERENCIAMENTO", "… DE GERENCIAMENTO DE LINK SOCIAL") e a situação ("LINKS ATIVOS" ou "LINKS
  CANCELADOS").

**Erros reais no material** (medidos em 29/09):

- **Mês:** em 77 dos 628, o mês do nome do arquivo não é o da pasta (ex.: pasta 2025.01 com arquivos
  "02-2025"; ano 2024 em vez de 2025).
- **Categoria:** a pasta tem nove grafias para três categorias ("Gerencimento de Links", "Link
  Social", "Links - Solução"…).
- **Título:** o do relatório da CGM de ago/2026 diz "SMSUB".

## 4. Regras de leitura

1. **Competência = a pasta do mês** (`AAAA.MM`). O nome do arquivo é ignorado para isso (é o que mais
   erra). O mês do título do PDF é conferido: se for outro, aviso "título diz agosto/2026".
2. **Categoria** normalizada da pasta: `GERENCIAMENTO` (gerenc…), `SOLUCAO` (…solução), `SOCIAL`
   (…social/sociais); conferida com o serviço do rodapé. Pasta desconhecida → `OUTRA` + aviso.
3. **Situação**: `ATIVOS` ou `CANCELADOS`, do rodapé; relatório de cancelados tem "Data Cancelamento".
4. **Contrato**: sai da coluna "Contrato PRODAM" das linhas (e do rodapé "CONTRATO … Nº"), **nunca do
   título**. Casamento com o `Contrato` do VerAI pela sigla + `chaveNumerica` do número (mesma regra de
   `vincular-itens.ts`); **só quando é único**. Sem casamento → relatório "sem contrato no VerAI" (só
   admin vê, com aviso).
5. **Linhas**: leitura pela **posição** das colunas (as posições x do cabeçalho da tabela), não por
   expressão regular sobre o texto achatado — entidade e endereço quebram linha ("STIC - CONTROLADORIA
   … (BKP REDE AURA)"). Uma linha começa no código MPLS (`[A-Z]\d{5}[A-Z]?/\d{2}`); o texto até o
   próximo código pertence a ela, na coluna da sua posição x.
6. **Prova de leitura**: nº de linhas lidas = "TOTAL = N" = "Total Geral N" do resumo. Bateu →
   relatório **conferido**. Não bateu → "leitura não conferida": o relatório aparece com o PDF, mas os
   números dele não entram em totais nem gráficos.
7. Mudança entre meses (entraram/saíram) é por **código MPLS** dentro do mesmo contrato e categoria.

## 5. Banco

- `RelatorioLinks`: `arquivoId` (`ArquivoBiblioteca`), `ano`, `mes`, `categoria`, `situacao`,
  `contratoTexto`, `contratoId?`, `clienteId?` (do contrato), `total`, `conferido`, `avisos Json`, `lidoEm`.
  Único por `arquivoId`.
- `LinkMpls`: `relatorioId`, `codigo`, `kbps`, `redundancia`, `dataAceite`, `dataCancelamento?`,
  `entidade`, `tipoLogradouro`, `endereco`, `numero`.

## 6. Telas

### 6.1 `/links-mpls` — visão geral

- Topo: "Links MPLS" · "Links ativos por contrato, pelos relatórios de faturamento" · "Atualizado em …".
- Filtros: **competência** (padrão: a mais recente com relatórios), cliente, categoria (Solução, Social,
  Gerenciamento).
- Cartões do mês: links ativos (total), por categoria, **entraram / saíram** em relação ao mês anterior,
  relatórios com aviso.
- Tabela por cliente → contrato: categoria, ativos, variação (▲2 ▼1), cancelados no mês, situação da
  leitura, PDF. Ordenável; em tela estreita vira cartões.
- Linha "sem contrato no VerAI" (só admin) com o texto lido do PDF.

### 6.2 `/links-mpls/contrato/[contratoId]` — um contrato

- Cabeçalho com cliente, contrato (link para a ficha do cliente) e SEI (`SeiLink`).
- **Evolução**: barras mês a mês de links ativos por categoria, em SVG simples (o projeto não tem
  biblioteca de gráfico e não precisa de uma para isso): uma cor por categoria, legenda direta, valor no
  topo da barra, sem 3D.
- Mês escolhido: lista dos links (código, velocidade, redundância, entidade, endereço, data de aceite),
  busca por endereço ou entidade; blocos **entraram** e **saíram** em relação ao mês anterior.
- Botões para os PDFs do mês.

### 6.3 Na ficha do cliente

Aba Contratos, na linha do contrato que tem relatório: "Links MPLS · 12 em set/2026", levando a §6.2. Só
aparece para quem já vê o cliente.

## 7. Permissão

Por cliente: o usuário vê os relatórios dos contratos dos clientes que ele pode ver
(`verificarAcessoCliente`), nas listas e no PDF (`GET /api/biblioteca/[id]`). Relatório sem contrato
identificado: só admin.

## 8. API

- `GET /api/links-mpls?ano=&mes=&clienteId=&categoria=` → resumo por contrato (filtrado por permissão).
- `GET /api/links-mpls/contrato/[contratoId]` → série mês a mês + links do mês pedido + diferenças.
- `GET /api/links-mpls/competencias` → meses com relatório.

## 9. Testes

- Leitura com textos reais das amostras (ativos; cancelados com data; entidade em duas linhas; título com
  cliente errado → contrato certo e aviso; total que não bate → não conferido).
- Competência pela pasta com nome de arquivo errado; categoria das nove grafias reais.
- Casamento do contrato (único, ambíguo, inexistente).
- Diferença entre meses por código MPLS.
- Permissão: usuário com um cliente só não vê o outro, nem o PDF.

## 10. Fora do escopo

- Valor em R$ dos links: os relatórios não têm preço. Multiplicar pela tabela de preços (velocidade ×
  código do serviço) é uma conferência de faturamento com design próprio, depois da tabela de preços.
- Bater com o faturamento real (Protheus).
- Mapa dos endereços.

## 11. Riscos

- **Relatório de várias páginas** (cliente com muitos links): a leitura por posição junta as páginas; a
  prova do total (§4.6) pega qualquer falha.
- **Formato muda** (coluna nova): a leitura se orienta pelo cabeçalho; coluna desconhecida é ignorada,
  mas a prova do total continua valendo — se não fechar, o relatório fica "não conferido" e aparece no
  log.
