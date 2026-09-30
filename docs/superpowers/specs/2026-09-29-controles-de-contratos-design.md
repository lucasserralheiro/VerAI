# Controles de Contratos (faturamento por contrato) no VerAI — design

**Status:** aprovado pelo usuário em 29/09/2026 ("pode continuar" — passa na frente de Links MPLS e do
calendário). Depende da base `2026-09-29-biblioteca-documentos-prodam-design.md` (já no dev).

## 1. Pedido e achado

Ao abrir a pasta FATURAMENTO SERVIÇOS PRODAM para os links, apareceu a subpasta **"Controles de
Contratos"**: um PDF por contrato **por mês** (06.2026, 07.2026, 08.2026 — 269 PDFs, ~90 por mês, 110
contratos distintos), feito pela equipe do faturamento. Cada um traz, para o período vigente do contrato:

- cabeçalho: contrato, termo e vigência ("CO 16/CGM/2024 - T.A. 02 - Vigência: 15/10/2025 à 14/10/2026");
- **previsão de faturamento** (cronograma físico-financeiro, mês a mês, e o TOTAL = valor do período);
- **faturado** mês a mês e o TOTAL;
- **saldo a faturar**.

É a fonte **atualizada todo mês** que faltava para o pedido original (valor, vigência e "bater com o
financeiro") — a planilha de contratos parou em jan/2026 e o Protheus ainda não tem acesso.

## 2. Hoje × depois

| | Hoje | Depois |
|---|---|---|
| Quanto já foi faturado de um contrato | abrir o PDF do mês no SharePoint | no detalhe do contrato: previsto, faturado, saldo e % do período |
| Visão de todos os contratos | não existe | tela "Controle de faturamento": todos os contratos, com % faturado e saldo, ordenáveis |
| De onde veio o número | — | "controle do faturamento de ago/2026", com o PDF a um clique |
| PDF que não fecha a conta | — | aparece com o PDF e o aviso "leitura não conferida" — nunca um número errado |

**O que não muda:** o faturamento lançado no VerAI (`Faturamento`/`NotaFiscal`), o saldo que o VerAI já
calcula e a regra do contrato (`consolidarContratos()`). O controle entra **ao lado**, com a origem escrita —
usar o controle como fonte do valor/vigência do cadastro é do spec `2026-09-29-valor-vigencia-contratos`.

## 3. O que a varredura mediu (29/09/2026, 269 PDFs)

- 258 de uma página; 11 com 2 a 5 páginas.
- Vigência no cabeçalho em 259. Formatos: "Vigência: 15/10/2025 à 14/10/2026", "VIGÊNCIA - 21/11/2025 à
  20/10/2026", "Vigência: 24/09/2025 ate 23/09/2026".
- Períodos das linhas em três formatos: "MÊS 01"/"MÊS 1-16DD", "NOV/2025"/"OUT/25-16DD", "01/12/2025 à
  31/12/2025"/"24/09/25 a 20/10/25-27Dias".
- Títulos das tabelas: "PREVISÃO DE FATURAMENTO" ou "PREVISTO"; "FATURADO"; "SALDO A FATURAR". O título
  fica **acima** da tabela; no texto extraído pode vir no fim — a leitura é por posição.
- **Erros do próprio documento** (planilha feita à mão): ano trocado na vigência ("18/11/2026 à 17/11/2026"),
  datas de período com ano errado ("21/01/2025 à 20/02/2025" num contrato de 2025–2026), TOTAL de uma
  coluna de grupo somando 10 meses quando a coluna total soma 11, saldo com 13 períodos contra 12 meses.
- **Prova "soma dos meses = TOTAL"** (coluna total, a última da linha), com o protótipo: previsto fecha em
  240, faturado em 235, **os dois em 212 (79%)**.
- Contrato pelo nome do arquivo (`SIGLA - CO-16-CGM-2024 (…) - 2026.08.pdf`): 89 dos 110 casam direto com o
  VerAI; os demais são quase todos ano com 2 dígitos ("CO-086-21").

## 4. Regras de leitura

1. **Área** nova `CONTROLES_CONTRATOS`: caminho `FATURAMENTO SERVIÇOS PRODAM/Controles de Contratos/…`.
   `areaDoCaminho` passa a olhar o 2º nível dentro de FATURAMENTO SERVIÇOS (Controles × Links MPLS). A
   sincronização corrige a área de arquivo já registrado quando a regra muda (e o leitor da área nova roda).
2. **Mês do controle** = a pasta (`08.2026` → ago/2026). O controle **vigente** de um contrato é o do mês
   mais recente; os anteriores ficam como histórico.
3. **Contrato**: sigla = antes do primeiro " - " do nome; número = `chaveNumerica` do resto (sem o que está
   entre parênteses e sem o `AAAA.MM` final), com **ano de 2 dígitos virando 4** (21 → 2021). Casamento com
   `Contrato` do VerAI pela chave `SIGLA|nº ano` (a mesma do SharePoint) e, se não achar, pelo nº do termo
   do cabeçalho ("CO 16/CGM/2024"); **só quando é único**. Sem casamento → "sem contrato no VerAI" (só admin).
4. **Linhas por posição**: itens do PDF agrupados por linha (mesmo y), na ordem da página; as páginas em
   sequência. Uma linha de cabeçalho com "Vigência" define termo e vigência para as tabelas seguintes; um
   título define o tipo (previsto/faturado/saldo); linha que começa com um período é linha da tabela;
   **TOTAL** fecha a tabela. O valor da linha é o **último número** (a coluna total).
5. **Prova**: cada tabela só vale se a soma das linhas = TOTAL (tolerância de 5 centavos). Tabela que não
   fecha → "leitura não conferida": o controle aparece, o PDF abre, mas os números dela não entram em tela
   nenhuma.
6. **Várias tabelas do mesmo tipo** (termo anterior + atual no mesmo PDF): vale a **última** de cada tipo — a
   do período vigente.
7. **Saldo**: guardado como está no documento; a tela mostra previsto − faturado **calculado** e, se o
   saldo do documento for diferente, um aviso ("o controle informa saldo de R$ X") — não escolhe em
   silêncio.
8. **Datas**: período e vigência guardam o texto lido e as datas interpretadas; data fora de ±1 ano da
   vigência vira "data não confiável" (o texto fica, a data não).

## 5. Banco (só tabelas novas)

- `ControleContrato`: `arquivoId` (único, `ArquivoBiblioteca`), `mesAno`/`mesMes` (da pasta), `sigla`,
  `contratoTexto`, `contratoId?` (sem FK obrigatória), `clienteId?`, `termoTexto?`, `vigenciaTexto?`,
  `vigenciaInicio?`, `vigenciaFim?`, `previstoTotal?`, `faturadoTotal?`, `saldoTotal?` (do documento),
  `previstoConferido`, `faturadoConferido`, `avisos Json`, `lidoEm`.
- `ControleContratoLinha`: `controleId` (cascade), `tipo` (previsto|faturado|saldo), `posicao`, `rotulo`,
  `inicio?`, `fim?`, `valor Decimal`.
- Migração nova, escrita à mão; guarda pela migração dela na etapa do agendador (o leitor da área só roda
  com a tabela existindo).

## 6. Telas

### 6.1 Detalhe do contrato (`/clientes/[id]/contratos/[contratoId]`)

Cartão **"Controle do faturamento"** ao lado do "Saldo":
- "Controle de ago/2026 · T.A. 02 · vigência 15/10/2025 a 14/10/2026";
- três números grandes: **Previsto** R$ 6,11 mi · **Faturado** R$ 5,05 mi (**83%**) · **Saldo** R$ 1,06 mi;
  barra de progresso;
- tabela mês a mês (período · previsto · faturado · saldo), meses sem faturamento em cinza;
- "Abrir o controle (PDF)"; avisos (leitura não conferida, saldo do documento diferente, data não confiável).
- Sem controle: o cartão não aparece.

### 6.2 "Controle de faturamento" (`/controle-faturamento`, subitem de Relatórios dos clientes)

- Topo com "Atualizado em …" da biblioteca; filtro de mês do controle (padrão: o mais recente), cliente e
  busca.
- Cartões: contratos no controle, previsto total, faturado total, % geral, contratos com leitura não
  conferida.
- Tabela por contrato: cliente, contrato (link para o detalhe), termo, vigência, previsto, faturado, %,
  saldo, "último mês faturado"; ordenável; faturado acima do previsto em laranja.
- Linhas "sem contrato no VerAI" (só admin), com o texto lido.
- Permissão por cliente (`clienteIdsPermitidos`); PDF por `/api/biblioteca/[id]` com a mesma regra.

## 7. API

- `GET /api/controle-faturamento?mes=AAAA-MM&clienteId=` → linhas da tabela 6.2 (filtradas por permissão).
- `GET /api/contratos/[id]/controle` → o controle vigente do contrato + linhas + avisos (403/404 pelo cliente).
- `/api/biblioteca/[id]` passa a aceitar `CONTROLES_CONTRATOS` pelo cliente do controle
  (`verificarAcessoCliente`); sem contrato, só admin.

## 8. Testes

- Leitura com linhas reais (CGM, ADESAMPA, SF, SMDET — os quatro formatos de período e de título; PDF de
  várias páginas; tabela que não fecha; saldo diferente; ano trocado).
- Contrato pelo nome (ano de 2 dígitos, sem contrato, ambíguo).
- Área: `Controles de Contratos` × `Links MPLS` dentro da mesma pasta; troca de área de arquivo já registrado.
- Rotas: permissão por cliente; tela: números, %, avisos, estados vazios.
- **Régua**: `scripts/regua-controles.ts` roda a leitura nos PDFs reais e mostra quantos fecham por tipo —
  antes e depois de mexer em regra (meta inicial: ≥ 79% das duas tabelas, igual ao protótipo).

## 9. Fora do escopo

- Usar o controle como fonte do valor/vigência do cadastro (spec do valor/vigência, que ganha esta fonte).
- Colunas por grupo (A/B/C/E/H): as células vazias somem no texto do PDF; só a coluna total é confiável
  sem leitura de coluna por posição x — fica para depois, se alguém pedir.
- Assistente de IA consultar o controle (depois, com a régua do assistente).

## 10. Riscos

- **Formato novo de planilha** → a tabela não fecha e fica "não conferida" (seguro); a régua mostra a queda.
- **Contrato casado errado** → só casa quando é único; na dúvida, "sem contrato no VerAI".
- **Controle desatualizado** (a equipe deixa de mandar) → a tela mostra o mês do controle em destaque.

## 11. Faturado só até o mês do controle (30/09/2026, pedido do usuário: "os dados sempre reais")

A tabela do faturado do PDF traz, em parte dos controles, **meses que ainda não aconteceram** (previsão da
equipe): no dev, 34 de 237 controles conferidos; em ago/2026, 8 contratos, R$ 189.840,03. Somar tudo como
"faturado" inflava o faturado e o % e escondia o saldo real. Regra (`src/lib/controles-contratos/meses.ts`):

- **Mês de cada linha** pelo rótulo como está no PDF: período com datas vale pelo **fim** (é como a própria
  equipe nomeia: "MAR/26 - 21/02/2026 A 20/03/2026"); sem datas, o nome do mês com ano; "MÊS n" pelo início da
  vigência do próprio controle. Rótulo ilegível ("FEV/265", "MAR/6") = mês desconhecido.
- **Erro de digitação do documento** (a tabela é cronológica): vale a **maior sequência de meses em ordem**; a
  linha fora dela vira mês desconhecido e é apontada como aviso ("mês fora de ordem no documento"). Mais de uma
  sequência possível → faturado até o mês **não é mostrado** (aviso; a linha fica "leitura não conferida").
- **Faturado** = linhas até o mês da pasta do controle (e desconhecidas no meio delas). Depois do mês →
  **"à frente"**, mostrado à parte com valor e períodos, fora do faturado, do % e do saldo. Desconhecida depois
  do último mês faturado, com valor → fora do faturado, com aviso (não dá pra provar que já aconteceu).
- A prova da leitura não muda: a tabela inteira ainda tem de fechar pela soma = TOTAL; o faturado até o mês é
  soma de linhas conferidas. O TOTAL do PDF segue guardado (`faturadoDocumento`).
- Avisos do documento (vigência trocada, saldo que não bate com as contas do próprio PDF, mês fora de ordem)
  aparecem na **lista** (ícone na linha) e no cartão do contrato. O cartão não recalcula mais o saldo por conta
  própria (dava aviso falso quando há lançamento à frente).

Medido no dev (237 controles): 34 com lançamento à frente, 18 com mês fora de ordem resolvido, 0 sem ordem
identificável, 0 lançamento sem mês fora do faturado.
