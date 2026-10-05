# Reajuste por IPC-Fipe — design

Data: 30/09/2026. Status: implementado no dev em 30/09/2026 (testes verdes; sem verificação no navegador, a pedido do usuário). Produção: subir as migrações `20260930100000_indice_ipc_fipe` e `20260930110000_reajuste_execucao` e fazer deploy.

## 0. O que o usuário quer

Na renovação de um contrato, corrigir valores pelo IPC-Fipe acumulado. O usuário escolhe um arquivo
(planilha, PDF ou DOCX), confere o período sugerido (e muda, se quiser), marca os valores e baixa o
resultado. Tudo fica guardado com histórico. Área própria no menu lateral.

Decisões tomadas na conversa:

- **Grupo próprio no menu** "Reajuste IPC-Fipe": o cabeçalho abre a correção (`/reajuste`);
  sub-itens "Histórico" (`/reajuste/historico`) e "Tabela do índice" (`/reajuste/indice`).
- **Período editável.** Sugestão ao abrir: mês da renovação = mês atual; período = os **últimos 12
  meses publicados**. O usuário muda mês inicial e final à vontade; o que sai no arquivo e no histórico
  é exatamente o que ele escolheu.
- **Planilha + PDF/DOCX.** Planilha volta corrigida; PDF/DOCX volta como **planilha de comparação**
  (original × corrigido) — o documento em si nunca é reescrito.
- **Guardar original e resultado no R2**, com histórico para rebaixar (não usa o Vercel Blob,
  suspenso).

## 1. Índice

### 1.1 Fonte

API pública do Banco Central (SGS), sem cadastro:
`https://api.bcb.gov.br/dados/serie/bcdata.sgs.<codigo>/dados?formato=json` → `[{ data: "01/08/2026",
valor: "0.35" }]` (variação % do mês). Série **193** = IPC-Fipe, variação mensal — **confirmada em
30/09/2026**: começa em 02/1939 (início do IPC-Fipe) e os 13 meses de ago/2025 a ago/2026 batem um a
um com os divulgados pela Fipe; acumulado set/2025–ago/2026 = fator 1,035543 (3,55 %), que vira caso de
teste. Não precisa de chave. A API exige `User-Agent` (sem ele devolve página de bloqueio em HTML) e
já oscilou (502 na mesma manhã) — por isso a tabela local e a recusa de resposta que não é JSON. A
primeira tarefa do plano ainda confirma o acesso **a partir da Vercel**. O código da série fica numa
constante só.

### 1.2 Tabela `IndiceIpcFipe` (nova)

| campo | tipo | nota |
|---|---|---|
| `mes` | `DateTime @id` | dia 1 do mês, UTC |
| `variacao` | `Decimal(9,4)` | % do mês, como veio |
| `fonte` | `String` | URL da série |
| `buscadoEm` | `DateTime` | última vez que a fonte confirmou o valor |

Tabela nova apenas (regra do agendador no CLAUDE.md não é afetada — o agendador não usa esta tabela).

### 1.3 Sincronização — `src/lib/reajuste/indice.ts`

- `sincronizarIpcFipe()` busca a série inteira (ou desde 2000), grava os meses que faltam e atualiza
  `buscadoEm` dos que batem.
- **Nunca sobrescreve em silêncio**: mês já gravado com valor diferente não é trocado — vira aviso
  devolvido pela função e mostrado na "Tabela do índice". Resolver é decisão humana (fora do escopo:
  sem tela de resolução; o aviso diz qual mês e os dois valores).
- Resposta fora do formato (HTML de bloqueio, JSON sem `data`/`valor`, valor não numérico) → erro com
  mensagem clara, nada gravado.
- Disparo: **cron diário** da Vercel (segundo cron do `vercel.json`, rota
  `/api/reajuste/indice/cron`, `Authorization: Bearer $CRON_SECRET`, pública no middleware como a do
  assistente) e botão **"Atualizar agora"** na Tabela do índice (`POST /api/reajuste/indice`, usuário
  logado).

### 1.4 Cálculo — `src/lib/reajuste/calculo.ts` (puro)

- Entrada: meses do período (inicial e final, inclusive) + variações conhecidas.
- `fator = ∏ (1 + variacao/100)` com precisão decimal (`Prisma.Decimal`/decimal.js, sem `number`).
- Mês do período sem índice → **não calcula**; devolve quais meses faltam ("setembro/2026 ainda não
  publicado").
- Valor corrigido = `original × fator`, arredondado a 2 casas (meio para cima) só no fim. O fator é
  mostrado com 6 casas e o acumulado em % com 2; o cálculo usa o fator completo.
- `periodoSugerido(hoje, ultimoPublicado)` → 12 meses terminando no último publicado.

## 2. Telas

### 2.1 Menu

Grupo novo em `src/components/nav-bar.tsx`, no mesmo formato de ConfereAI/Proposta Comercial
(cabeçalho + sub-itens), depois do ConfereAI. Ícone lucide `TrendingUp`.

### 2.2 `/reajuste` — corrigir

1. **Arquivo** — XLSX, CSV, PDF ou DOCX do computador, até 50 MB, subido direto ao R2 com
   `enviarParaR2` (rota `POST /api/reajuste/envio`, que reexporta `/api/propostas-comerciais/envio`,
   caminho `tmp-uploads/`).
2. **Período** — mês da renovação e período sugeridos; seletores de mês inicial e final; tabela dos
   meses com % de cada um, acumulado e fator, recalculados na hora (a tela recebe o índice inteiro da
   API, são ~300 linhas).
3. **Valores** — `POST /api/reajuste/leitura` lê o arquivo do R2 e devolve os candidatos:
   - **Planilha**: por aba, as colunas com valores numéricos (célula numérica ou texto em formato de
     moeda), com cabeçalho e 3 exemplos. Colunas com cara de valor ("valor", "preço", "total", "R$")
     vêm marcadas; o usuário marca/desmarca.
   - **PDF/DOCX**: cada valor em formato de moeda achado no texto (`extrairPaginas` de
     `src/lib/assistente/indexacao/extrair.ts`, que já repara a camada de texto), com página e ~60
     caracteres de cada lado. Só entra `R$ 1.234,56`, `1.234,56` ou `1234,56` (vírgula decimal com 2
     casas) — número sem centavos (processo, ano, quantidade) não entra. Todos vêm marcados; o usuário
     desmarca. PDF sem camada de texto (`semCamadaDeTexto`) → mensagem "PDF escaneado, sem texto".
   - Leitura de valor pelo parser do projeto (`normalizarDecimal`), nunca parser novo.
4. **Gerar** — `POST /api/reajuste` recebe endereço do arquivo, período e seleção; recalcula tudo no
   servidor (não confia no navegador), gera o resultado, grava no R2 e no histórico, devolve o id.
   Download por `/api/reajuste/[id]/arquivo/{original|resultado}`.

### 2.3 Resultado

- **Planilha (XLSX/CSV)**: mesma planilha (exceljs); para cada coluna marcada, uma coluna nova
  "<cabeçalho> corrigido" **depois da última coluna usada da aba** — nenhuma coluna existente muda de
  lugar, então fórmulas do arquivo não quebram. Célula não numérica na coluna fica vazia na corrigida.
  Aba nova "Reajuste IPC-Fipe": período, cada mês com %, acumulado, fator, data e usuário. CSV sai como
  XLSX. Planilha que o exceljs não abre → erro claro ("não foi possível abrir a planilha").
- **PDF/DOCX**: XLSX com colunas página, trecho, valor original, valor corrigido, diferença; mais a
  mesma aba "Reajuste IPC-Fipe".

### 2.3.1 Fórmulas — regra do IPC na memória de cálculo (05/10/2026)

Conferido com a memória de cálculo real da PRODAM (`arquivos-teste-reajuste/memoria-calculo-sustentacao-seges.xlsx`:
preço unitário × qtde × meses, subtotais por grupo, total da proposta e cronograma em outra aba).
O reajuste corrige o **preço unitário** (× fator, 2 casas); o resto sai da conta da própria planilha.

- **Valor digitado** na coluna marcada → `valor × fator`, 2 casas.
- **Fórmula** na coluna marcada que cita coluna marcada (inclusive de outra aba) → a coluna corrigida
  recebe a **mesma fórmula** com as referências trocadas pelas colunas corrigidas
  (`ROUND(E6*F6*G6,2)` → `ROUND(L6*F6*G6,2)`, `SUM(H6:H9)` → `SUM(M6:M9)`,
  `'Memória Cálculo'!H5` → `'Memória Cálculo'!M5`). Qtde e meses continuam os originais. O arquivo sai
  com `fullCalcOnLoad` pra o Excel calcular ao abrir. (`src/lib/reajuste/formulas.ts`)
- Fórmula que não cita coluna marcada, ou intervalo que mistura coluna marcada e não marcada → resultado × fator.
- Por que não `total × fator`: dá centavos (às vezes milhares de reais) de diferença e subtotal que não
  bate com a soma — no exemplo, `0,15 × fator = 0,16` no crédito de 3,9 milhões; total corrigido certo
  R$ 109.679.570,51 contra R$ 109.661.082,61 do total × fator.
- **Leitura**: título mesclado (B2:H2) conta uma vez só (antes virava o cabeçalho de todas as colunas e
  sugeria CÓDIGO, QTDE e PERÍODO); código com pontos (`10.050.00001.00`) não é valor; nome de coluna por
  palavra inteira ("CUSTOMIZADOS" não é custo). Vem sugerida também a coluna cuja fórmula usa uma
  sugerida e a coluna somada no mesmo intervalo por uma sugerida (cronograma inteiro + VALOR TOTAL).
- A prévia marca célula de fórmula com "≈" (o número final vem da fórmula refeita).

### 2.4 `/reajuste/historico`

Lista de todos (como o histórico do ConfereAI: o registro é do que passou pela ferramenta): data,
usuário, arquivo, período, acumulado, quantidade de valores; download do original e do resultado.

### 2.5 `/reajuste/indice`

Todos os meses (mais recente em cima): mês, variação, acumulado em 12 meses; data da última
atualização; avisos de divergência; botão "Atualizar agora".

## 3. Histórico — `ReajusteExecucao` (tabela nova)

`id`, `usuarioId`, `nomeArquivo`, `tipoArquivo`, `chaveOriginal`, `chaveResultado` (R2, prefixo
`reajustes/<id>/`), `mesInicial`, `mesFinal`, `fator` (Decimal 12,8), `meses` (Json: mês + variação
usados — prova do cálculo mesmo se a tabela do índice mudar), `quantidadeValores`, `createdAt`.
O arquivo temporário em `tmp-uploads/` é apagado depois de copiado para `reajustes/<id>/original.<ext>`.

Permissão: qualquer usuário logado usa e vê o histórico. Sem exclusão nesta versão.

## 4. Erros

- API do Banco Central fora: a correção continua com o que está no banco; a Tabela do índice mostra a
  data da última atualização (maior `buscadoEm`); o botão mostra o erro na hora; o do cron vai para o
  log da Vercel.
- Período com mês faltando: botão Gerar desabilitado, mensagem com o mês.
- Nenhum valor marcado: Gerar desabilitado.
- Falha ao gravar no R2/banco na geração: erro 500 com mensagem; nada parcial fica no histórico.

## 5. Testes

- `calculo.ts`: fator conhecido (12 meses reais conferidos na mão), mês faltando, arredondamento,
  período de 1 mês, período sugerido na virada do ano.
- `indice.ts`: grava novos, não sobrescreve divergente, recusa HTML/JSON inválido (fetch simulado).
- Leitura: planilha com colunas mistas; texto com `R$ 1.500,00`, `1.500` (não entra), `2026` (não
  entra), valor quebrado por linha.
- Geração de planilha: coluna nova depois da última, aba "Reajuste IPC-Fipe", fórmula existente
  intacta.
- Rotas: 401 sem login, cron sem segredo 401, período inválido 400.

## 6. Fora do escopo

Reescrever o PDF/DOCX; escolher arquivo do repositório do cliente; vínculo com contrato/cliente;
outros índices (IPCA, IGP-M) — a tabela e o cálculo não impedem, mas não entram agora.
