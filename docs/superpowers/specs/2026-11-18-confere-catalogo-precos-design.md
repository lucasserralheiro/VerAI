# Confere lê o catálogo de preços do VerAI — design

**Data:** 18/11/2026. Decisão do usuário, nascida da varredura que corrigiu `65bab28` (medida `-` virando
"perfil medido" em `services/confere/backend`). Esta é a continuação pedida: dar ao Confere uma fonte de
verdade sobre os códigos de catálogo, pra pegar código usado no motor/família errada — automático, sem
exportação manual, repetindo o padrão que o VerAI já usa pra outros sistemas lerem seus dados.

## 1. Problema

O Confere hoje só lê texto livre: PDF do contrato (`pdfplumber_extractor.py` / `header_grid.py`) e planilha de
medição (`levantamento_reader.py`). Nunca cruza o `codigo` do serviço (`14.048.00010.00`) com o catálogo
oficial da PRODAM — que o VerAI já lê e guarda em `ItemTabelaPrecos` (`src/lib/tabela-precos/`), com
`codigo`, `descricao`, `grupo`, `secoes`, `unidade`, por versão da "Memória de Cálculo". Sem essa fonte, um
código digitado errado ou usado pro motor de banco errado só é pego se alguém perceber lendo o relatório —
exatamente o tipo de defeito que motivou `65bab28`.

## 2. Decisão

Reaproveitar a **API de plataforma** que já existe (`docs/superpowers/specs/2026-10-08-api-plataforma-design.md`,
hoje usada pelo AIBertinho): o Confere passa a ser, para o VerAI, **mais um `ApiApp`** que lê um recurso — sem
mecanismo novo de autenticação, sem endpoint fora do padrão `/api/v1/<recurso>`.

Alternativas descartadas:
- **Webhook avisando mudança na tabela de preços** — mais peças (endpoint receptor no Confere, storage local
  no Render) pra um dado que muda poucas vezes por ano (nova "Memória de Cálculo"). Polling com cache de 10 min
  já é rápido o suficiente e não exige o Confere guardar estado entre reinícios do processo.
- **Arquivo JSON comitado em `services/confere/backend`** — simples, mas não é automático: alguém precisa
  lembrar de regenerar e dar deploy a cada tabela nova. Descartado por não atender o pedido ("sempre automático
  igual o VerAI").

## 3. Lado VerAI

- **Recurso novo** `tabelaPrecos` em `RECURSOS_DO_VERAI` (`src/lib/integracao/feed.ts`): carregador busca a
  versão vigente de `TabelaPrecos` (maior `ordem`) e devolve um `RegistroDoFeed` por `ItemTabelaPrecos` dela —
  `chaveCliente: null`, `chaveGerencia: null` (dado global, não por cliente; mesmo padrão de `null` que
  `gerencias` já usa), `dados: { codigo, descricao, grupo, secoes, unidade }`.
- Nenhuma rota nova: `/api/v1/tabelaPrecos` já existe genérica para qualquer recurso cadastrado.
- **`ApiApp` novo**, criado em `/admin/api` pelo usuário: nome "Confere", escopo `tabelaPrecos:ler`. A chave
  (`vrai_…`) é copiada **uma vez** pro Render, como env var `VERAI_API_KEY` do serviço `confere-backend` — o
  único passo manual, feito uma vez; depois disso a leitura é sozinha.

## 4. Lado Confere

- Módulo novo `infrastructure/catalogo/verai_cliente.py`: `GET {VERAI_BASE_URL}/api/v1/tabelaPrecos` com
  `Authorization: Bearer {VERAI_API_KEY}`, pagina até esgotar (mesmo formato `pagina/paginas` da API de
  plataforma), monta `dict[codigo, ItemCatalogo]`. Cache em memória do processo, TTL 10 min (`time.monotonic`,
  sem lock extra — pior caso é buscar duas vezes em paralelo, inofensivo).
- **Nunca derruba a geração do relatório.** `VERAI_API_KEY`/`VERAI_BASE_URL` ausentes, timeout, 401, 5xx —
  todos capturados e logados; a função devolve cache vazio e a validação do catálogo simplesmente não roda
  naquela geração (mesmo princípio dos outros avisos do Confere: incerteza não é bloqueio).
- Timeout de rede curto (3 s) — a chamada entra no orçamento de tempo em cadeia que já existe (`maxDuration`
  300 s do proxy do VerAI, teto de fase de 240 s no Confere); 3 s é ruído nisso.

## 5. Validação `V-CAT-01` — o que vira aviso

Depois da reconciliação de hoje, para cada `ReportLine` com catálogo disponível:

- **Código fora do catálogo vigente** (não existe em `ItemTabelaPrecos`) → aviso: *"código `<codigo>` não
  encontrado na tabela de preços vigente — confira se não foi descontinuado ou digitado errado"*.
- **Letra de perfil incoerente**: a planilha/contrato atribuem uma letra de perfil (`_letra_de_perfil`, já
  usado em `generate_measurement_report.py`) a este código, mas a `descricao` oficial do catálogo pra esse
  código **não cita essa letra** (regex `PERFIL\s+([A-E])\b` sobre a descrição oficial) → aviso: *"perfil
  `<letra>` não corresponde à descrição oficial do catálogo para este código: `<descrição oficial>`"*.

Igual a toda validação do Confere hoje: **só soma `ValidationReport.avisos`, nunca bloqueia e nunca altera
quantidade, classificação ou `perfil_ou_pacote`** — o documento sai idêntico ao de hoje; quem confere vê o
aviso a mais, no mesmo lugar dos demais.

Sem catálogo em cache (VerAI fora, chave não configurada) a validação não roda — e não aparece achado
nenhum por isso, porque ausência de dado não é evidência de problema.

## 6. Testes

- **VerAI**: teste do carregador `tabelaPrecos` em `feed.ts` (formato do `RegistroDoFeed`, `chaveCliente`/
  `chaveGerencia` nulos); teste de que `/api/v1/tabelaPrecos` exige o escopo certo (mesmo padrão dos recursos
  existentes, sem caso novo de autenticação).
- **Confere**: `test_verai_cliente.py` — cache respeitado dentro da janela de 10 min, timeout/401/5xx não
  propagam exceção, resposta paginada é concatenada corretamente. `test_catalogo_validations.py` — código no
  catálogo e coerente (sem aviso), código fora do catálogo (aviso), letra divergente da descrição oficial
  (aviso), catálogo ausente (nenhum aviso, nenhuma exceção, relatório sai igual ao de hoje).

## 7. Fora de escopo

- O achado assimétrico levantado na varredura anterior (contratada `-` + medida com letra saindo `1/1`) fica
  de fora deste design — depende de confirmar em corpus real antes de decidir a semântica, questão separada
  da catalogação.
- Nenhuma mudança em `generate_measurement_report.py` além de ler o resultado da nova validação: a derivação
  de quantidade/classificação continua exatamente como `65bab28` deixou.
