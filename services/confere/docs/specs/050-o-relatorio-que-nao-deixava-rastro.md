# ESPEC 050 — O relatório que não deixava rastro

| | |
|---|---|
| **Status** | **Proposta** — 2026-09-09 |
| **Versão** | 1.4 — 2026-09-09 |
| **Depende de** | [ESPEC 001](001-mvp-analise-medicao.md) — implementada |
| **Revisa** | [ESPEC 001](001-mvp-analise-medicao.md) §7.2, na parte em que exclui deliberadamente **PostgreSQL e Alembic** e conclui *"o que sobra é um serviço sem estado: recebe arquivos, devolve PDF, nada persiste"*. As demais exclusões daquele parágrafo — Entra ID, Azure OpenAI, Document Intelligence, Blob Storage, multi-*tenancy*, *background tasks*, trilha de auditoria — **não são revistas** por esta espec |
| **Não toca** | A extração do contrato, a leitura do levantamento, a reconciliação, o `.docx`, o `.xlsx`, a ausência de autenticação (README §"Pendências da hospedagem"), qualquer conteúdo de arquivo enviado |
| **Referência normativa** | `backend/src/api/routers/reports.py`, `backend/src/api/schemas.py`, `backend/pyproject.toml`, `README.md` §"Hospedagem", `docs/triade_referencia/README.md` §2.1/§3.4/§4.1, `docs/dados/Padrão de Nomenclatura - Modelo de Dados - PRODAM.pdf` |
| **Origem** | Conversa em que se avaliou usar o Google Analytics para responder *"quantos contratos/processos foram feitos através do Confere"*, descartado por depender de um terceiro e por exigir chamada de rede a um host externo num ambiente de órgão público; e o Log Analytics já provisionado (`log-confere-des`), descartado por ter retenção finita. Decisão: *"Vamos usar um banco de dados postgresql"*, com nomenclatura no padrão PRODAM. Escopo ampliado a partir de duas perguntas diretas: *"A solução irá registrar sempre que alguém clicar em 'Gerar Relatório' e o relatório for gerado com sucesso? Irá gravar também quando não for gerado com sucesso e a causa do erro?"* — respondida, entre as opções apresentadas, por **sucesso + bloqueio + erro** |

---

## 1. Problema

**O Confere não sabe quantos contratos já processou — nem quantas tentativas não viraram
relatório, nem por quê.**

A aplicação é sem estado por decisão explícita (ESPEC 001 §7.2): cada chamada a `POST /reports`
lê dois arquivos e devolve um resultado — relatório, bloqueio ou erro — sem escrever nada em lugar
nenhum. Fechada a resposta HTTP, não sobra rastro de qual dos três aconteceu.

Nem os logs ajudam hoje: o único `logger` chamado em `reports.py` é `logger.exception`, no caminho
de erro inesperado ([reports.py:361](../../backend/src/api/routers/reports.py)) — e mesmo esse não
é estruturado nem consultável além do texto livre da exceção. Uma geração **bem-sucedida** não
deixa linha nenhuma. Um **bloqueio** — arquivo que não parece ser o levantamento certo, identidade
de contrato divergente, achado que impede a emissão — também não. Dos três desfechos possíveis de
um clique em "Gerar relatório", nenhum é observável depois que a resposta HTTP é entregue.

A pergunta que motivou esta espec começou como *"quantos contratos foram processados pelo
Confere"* e, ao ser aprofundada, revelou uma pergunta irmã igualmente sem resposta hoje: *quantas
tentativas não viraram relatório, e por quê*. As duas nascem do mesmo problema — nada do que
acontece num `POST /reports` sobrevive à resposta — e esta espec resolve as duas com o mesmo
mecanismo.

### 1.1 Por que as duas alternativas mais óbvias foram descartadas

Registradas aqui porque a próxima pessoa vai propor as duas de novo:

* **Google Analytics** — resolveria a métrica, mas manda um evento de uso do Confere para um
  serviço de terceiro fora do tenant Azure/PRODAM, contrariando o próprio motivo de a ESPEC 001
  §7.2 ter riscado "dado sensível persistido" do escopo. Um ambiente de órgão público também tende
  a ter regra de saída de rede que pode bloquear ou atrasar justamente esse tipo de chamada — o
  oposto de confiabilidade.
* **Log estruturado no Log Analytics já provisionado** (`log-confere-des`, README §"Hospedagem")
  — não exige infraestrutura nova e usa o mesmo cano que já carrega os erros de hoje, mas Log
  Analytics tem retenção finita por desenho e existe para diagnóstico operacional, não como
  registro permanente de uma métrica de negócio. Resolveria tendência recente; não resolve
  "quantos, desde sempre".

A decisão tomada — um banco próprio — é a única das três opções em que o dado fica sob controle do
projeto, sem prazo de validade e sem sair do tenant.

---

## 2. O que foi levantado

### 2.1 Os campos disponíveis no caminho de sucesso

`gerar_relatorio` monta a resposta de sucesso com estes campos já calculados
([reports.py:391-417](../../backend/src/api/routers/reports.py); tipos em
[schemas.py:208-212](../../backend/src/api/schemas.py)):

| Campo em memória | Origem | Linha |
|---|---|---|
| `relatorio.contrato_referencia` | número do contrato | `reports.py:399` |
| `analise.competencia` | mês por extenso, ex. `"julho/2026"` | `schemas.py:195` |
| `relatorio.total_linhas` | linhas do documento | `reports.py:400` |
| `relatorio.total_divergencias` | linhas exibidas no grid | `reports.py:401` |
| `identidade_confirmada` | parâmetro já recebido pelo *endpoint* (ESPEC 029 `R-IDT-10`) | `reports.py:303-311` |

Nenhum arquivo precisa ser reaberto e nenhuma extração precisa ser refeita.

### 2.2 Os campos disponíveis nos caminhos de bloqueio e erro

`gerar_relatorio` tem três saídas além do sucesso, todas em `reports.py:350-389`:

| Saída | Gatilho | O que já está em memória naquele ponto |
|---|---|---|
| `422`, erro de leitura conhecido | `except ExtractionError` (`reports.py:357-359`) | a exceção em si — sua classe é `ExtractionError` |
| `422`, achado bloqueante ou pendente de confirmação | `resultado.bloqueado` (`reports.py:369-389`) | `resultado.achados.bloqueantes` e `.confirmaveis` — cada um com `validacao` (ex. `"V-IDT-01"`) |
| `500`, erro inesperado | `except Exception` (`reports.py:360-364`) | a exceção em si — sua classe (ex. `Exception`, ou a subclasse real) |

Em nenhuma das três saídas `resultado.relatorio` ou `analise` chegam a existir — é por isso que
`resultado.bloqueado or resultado.relatorio is None` é a própria condição que decide a saída
([reports.py:369-375](../../backend/src/api/routers/reports.py)). Não há `contrato_referencia` nem
`competencia` disponíveis nesses três casos **sem refazer extração** — e refazer extração só para
popular uma métrica violaria a mesma regra que already existe para o caminho de sucesso (§2.1,
`R-USO-02`).

### 2.3 Não existe autenticação, e isso simplifica o que se grava

O Confere não tem login (README §"Pendências da hospedagem"). Não há "quem tentou" para registrar
— nenhuma coluna de usuário, nenhum IP, nenhum identificador de sessão.

### 2.4 A organização já opera Postgres/SQLAlchemy/Alembic em produção

O documento de referência técnica do TRIADE (`docs/triade_referencia/README.md`) descreve o mesmo
padrão que esta espec adota: PostgreSQL com driver `psycopg2-binary`, SQLAlchemy 2.x no estilo
`Mapped[]`/`mapped_column`, migrações por Alembic com nome `phase_NN_descricao.py`
(`triade_referencia/README.md` §2.1, §4.1). Não é escolha nova — é reuso de uma decisão já validada
em outro projeto da PRODAM, na mesma stack Python/FastAPI.

### 2.5 O que muda na hospedagem

Hoje `rg-confere-des` tem `ca-confere-backend`, `ca-confere-frontend`, `cae-confere-des`,
`acrconferedes` e `log-confere-des` (README §"Hospedagem") — nenhum banco de dados. Esta espec é a
primeira a exigir um recurso novo de dados no grupo de recursos.

### 2.6 O padrão de nomenclatura de dados da PRODAM, aplicado

`docs/dados/Padrão de Nomenclatura - Modelo de Dados - PRODAM.pdf` define regras separadas por
família de SGBD. O Confere usa PostgreSQL, família **"SQLServer/MySQL/Sybase/PostgreSQL"** do
documento (não DB2/Oracle, que usa prefixo `T99999_` e maiúsculas):

* **Entidade/tabela** (§4.1, §4.2 do padrão): singular, minúsculas, sem acento, sem caractere
  especial, palavras separadas por `_` no físico, sem prefixo. A entidade *"tentativa geracao"*
  vira a tabela **`tentativa_geracao`**.
* **Atributo/coluna** (§5.1, §5.3 do padrão): `base abreviada + complemento(s) não abreviado(s)`,
  minúsculas, base sempre a primeira palavra, tirada da tabela fechada de bases/naturezas (§5.2 do
  padrão).

| Coluna física | Base usada | Por quê essa base | Nulidade |
|---|---|---|---|
| `cd_tentativa_geracao` | `codigo` (`cd`) — identificação do objeto | chave própria da linha | `not null` |
| `dt_tentativa` | `data` (`dt`) — representa o tempo | instante da chamada a `POST /reports`, sucesso ou não — gravado em UTC (`R-USO-10`) | `not null` |
| `tp_desfecho` | `tipo` (`tp`) — reúne características comuns | domínio fechado de três valores — §2.2 | `not null` |
| `nr_contrato` | `numero` (`nr`) — indicador de ordem/série | é o que `contrato_referencia` guarda (ex. `52/SMIT/2024`) | só em `gerado` |
| `pr_competencia` | `periodo` (`pr`) — período fora do formato de data | competência é texto por extenso, não uma data | só em `gerado` |
| `qt_linha` | `quantidade` (`qt`) | linhas do documento | só em `gerado` |
| `qt_divergencia` | `quantidade` (`qt`) | divergências do grid | só em `gerado` |
| `in_identidade_confirmada` | `indicador` (`in`) — domínio binário | é exatamente o que o parâmetro é | `not null` — conhecido em qualquer desfecho |
| `sg_achado` | `sigla` (`sg`) — abreviatura de uma denominação | o código do achado (`"V-IDT-01"`) é uma sigla | só em `bloqueado` |
| `dc_erro` | `descricao` (`dc`) — descreve algo sucintamente | a classe da exceção, não a mensagem — `D-09` | só em `erro` |

Nenhuma dessas colunas precisou de uma base fora da lista fechada do padrão.

---

## 3. Objetivo

Que cada chamada a `POST /reports` — **tenha gerado relatório, sido bloqueada ou falhado** — deixe
um registro durável, sob controle do projeto, nomeado no padrão que a PRODAM já usa, suficiente
para responder, a qualquer momento e sem depender de terceiro:

1. quantos relatórios o Confere gerou num período, e quantos contratos distintos isso representa
   (`nr_contrato` × `pr_competencia`, só preenchidos em sucesso);
2. quantas tentativas foram bloqueadas, e por qual achado com mais frequência;
3. quantas tentativas falharam por erro inesperado, e de que natureza.

**Não é objetivo desta espec**: construir o painel de consulta (o mockup publicado nesta conversa é
só ilustração, não parte desta entrega), adicionar autenticação, gravar a lista completa de achados
de cada tentativa bloqueada (`D-10`), ou gravar a mensagem de uma exceção (`D-09`).

---

## 4. Escopo

### 4.1 Dentro do escopo

* Dependência nova: `sqlalchemy`, `psycopg2-binary`, `alembic` (`backend/pyproject.toml`).
* Uma tabela, `tentativa_geracao`, com as colunas de §2.6, e o modelo mapeado correspondente.
* A migração inicial (Alembic).
* A gravação de uma linha por chamada a `POST /reports`, nos **quatro** pontos de saída de
  `gerar_relatorio` (sucesso, bloqueio de achado, `ExtractionError`, exceção genérica).
* A variável de ambiente `DATABASE_URL` e a configuração mínima de conexão.
* O recurso de banco em si no Azure (Postgres Flexible Server), dentro de `rg-confere-des`.

### 4.2 Fora do escopo

* Qualquer tela ou *endpoint* de consulta sobre os dados gravados.
* A lista completa de achados de uma tentativa bloqueada — só o achado principal entra
  (`sg_achado`, `D-10`); uma trilha completa é entrega própria, se um dia for necessária.
* A mensagem de texto de uma exceção — só a classe (`dc_erro`, `D-09`).
* Autenticação, multi-*tenancy*, e qualquer outra peça do TRIADE que ESPEC 001 §7.2 excluiu.
* Retenção/expurgo automático da tabela (`I-01`).
* Mudar o formato de resposta da API — `RespostaRelatorio` e `RespostaBloqueada` não ganham campo
  novo.
* Homologação formal do modelo junto à Administração de Dados da PRODAM (`I-05`).

---

## 5. Regras

**`R-USO-01` — Um registro por chamada a `POST /reports`, qualquer que seja o desfecho.** Grava-se
sempre: sucesso (`200`, `tp_desfecho = 'gerado'`), achado bloqueante ou pendente de confirmação
(`422`, `tp_desfecho = 'bloqueado'`), e erro — tanto o de leitura conhecida quanto o inesperado
(`422`/`500`, `tp_desfecho = 'erro'`).

**`R-USO-02` — Só os campos que já estão em memória em cada desfecho.** Nenhum arquivo é reaberto e
nenhuma extração é refeita para popular a tabela — nem para o caminho de sucesso, nem para
enriquecer um bloqueio ou erro com dado que só o sucesso produziria.

**`R-USO-03` — Nenhum dado pessoal, nenhum conteúdo de arquivo.** Sem nome de arquivo, sem IP, sem
identificador de usuário — porque não existe autenticação (§2.3) — e sem mensagem de exceção, que
pode citar nome de arquivo ou trecho do que foi lido (`D-09`).

**`R-USO-04` — A gravação é de melhor esforço, nos quatro pontos.** Falhar ao gravar (banco fora do
ar, tabela ausente, erro de rede) **não impede, não atrasa de forma perceptível e não aparece**
para quem usa a tela — em nenhum dos três desfechos possíveis da resposta HTTP. O relatório, o
bloqueio e o erro são o que o Confere já devolvia; o registro é telemetria sobre isso, nunca
requisito para isso existir. Mesma filosofia de `R-IDT-12` (ESPEC 029).

**`R-USO-05` — Append-only.** Nenhuma linha é atualizada ou apagada pela aplicação.

**`R-USO-06` — A tabela não é fonte de verdade de domínio nenhum.** Não é lida por
`GenerateMeasurementReport`, não influencia nenhuma validação, não aparece em nenhum `.docx` ou
`.xlsx`.

**`R-USO-07` — Nome de tabela e de coluna seguem o padrão de nomenclatura da PRODAM**, sem exceção
e sem abreviação fora da tabela fechada de bases do documento — §2.6 é a derivação completa.

**`R-USO-08` — A taxonomia do desfecho é fechada e vive só nesta tabela.** `tp_desfecho` aceita
exatamente `'gerado'`, `'bloqueado'` ou `'erro'`, garantido por `CHECK` na própria coluna — não por
uma entidade `tipo desfecho` separada (`D-08`).

**`R-USO-09` — Campo que só um desfecho produz fica nulo nos outros, nunca com valor placeholder.**
`nr_contrato`, `pr_competencia`, `qt_linha`, `qt_divergencia` são `null` fora de `'gerado'`;
`sg_achado` só existe em `'bloqueado'`; `dc_erro` só em `'erro'`. Nenhum `""`, nenhum `0` fingindo
"não se aplica".

**`R-USO-10` — `dt_tentativa` é gravado em UTC, sempre.** O servidor não grava fuso horário
separado nem hora local. Qualquer agrupamento por "dia" — incluindo um recorte como "hoje" — é
decisão de quem consulta, aplicada no momento da consulta com o fuso do usuário
(`America/Sao_Paulo`), nunca decidida na gravação (`D-11`).

---

## 6. Decisões

### `D-01` — Por que um banco próprio, e não Google Analytics nem o Log Analytics existente

Já justificado em §1.1. Das três opções, só o banco próprio deixa o dado sob controle do projeto,
sem depender da retenção de um serviço de observabilidade configurado para outro propósito, e sem
sair do tenant Azure/PRODAM.

### `D-02` — Esta espec reverte ESPEC 001 §7.2 só na parte de persistência

A ESPEC 001 excluiu PostgreSQL/Alembic **junto** com Entra ID, Azure OpenAI, Document Intelligence,
Blob Storage, multi-*tenancy* e trilha de auditoria, como um pacote. Esta espec resolve **um**
problema novo — a métrica de uso (sucesso **e** falha) não tem onde morar — e traz só a peça mínima
que o resolve. As outras exclusões continuam de pé.

### `D-03` — Append-only, e não uma tabela de contadores por contrato

`count(*)` filtrado por `tp_desfecho` dá volume por desfecho; `count(distinct (nr_contrato,
pr_competencia))` dá contratos distintos gerados. Uma tabela de contadores perderia a diferença
entre "gerado uma vez" e "gerado quatro vezes porque a pessoa corrigiu e reprocessou".

### `D-04` — A gravação nunca pode bloquear a entrega da resposta, seja ela qual for

O relatório, o bloqueio e o erro são o que o Confere já devolve; o registro de uso é secundário a
isso por definição, nos três casos. Mesmo raciocínio de `R-IDT-12` (ESPEC 029): falhar fechado
trocaria uma indisponibilidade momentânea de banco por indisponibilidade da funcionalidade real —
inclusive a de **dizer por que um bloqueio aconteceu**, que é a própria informação que o usuário
está esperando naquele momento.

### `D-05` — SQLAlchemy 2.x + Alembic, e não um driver cru

Padrão que a organização já opera em produção no TRIADE (`docs/triade_referencia/README.md` §2.1,
§4.1), na mesma stack Python/FastAPI.

### `D-06` — O recurso de banco é dimensionado pelo volume real

Dezenas de linhas por dia (README §"Hospedagem": ~22s por geração, um processo por réplica) — mais
as tentativas bloqueadas/erradas, que tendem a ser uma fração pequena do mesmo volume. SKU mínimo
de Postgres Flexible Server. Dimensionamento exato é `I-02`.

### `D-07` — Tabela e colunas seguem o padrão PRODAM desde a primeira versão publicada

O rascunho inicial usava nomes livres (`relatorios_gerados`, `contrato_referencia`); foi reescrito
para nascer conforme, em vez de anexar uma tabela de conversão depois.

### `D-08` — Sem uma entidade `tipo desfecho` separada

O padrão PRODAM sugere o prefixo `tipo` para **domínios de atributos reutilizáveis por mais de uma
entidade** (ex. `tipo terreno`, referenciado por várias tabelas do modelo). `tp_desfecho` tem três
valores fixos, conhecidos em tempo de código, usados por uma única tabela — sem candidato a
crescer nem a ser reaproveitado. Um `CHECK` na própria coluna garante a mesma integridade sem o
custo de uma tabela e um `JOIN` para três valores estáticos. Se uma segunda tabela vier a precisar
do mesmo domínio, a extração para uma entidade `tipo` vira a decisão certa — não antes.

### `D-09` — `dc_erro` grava a classe da exceção, nunca a mensagem

A mensagem de `ExtractionError` pode citar nome de arquivo ou detalhe do que foi lido do arquivo
enviado — exatamente o que `R-USO-03` proíbe. A classe (`ExtractionError`, `Exception` ou a
subclasse real) é uma string fixa, controlada pelo próprio código, nunca dado do usuário, e ainda
distingue "erro de leitura conhecido" de "erro inesperado" — o suficiente para a métrica de
"quantas tentativas falharam e de que natureza", sem abrir uma exceção à regra de não gravar
conteúdo de arquivo.

### `D-10` — `sg_achado` guarda só o achado principal, não a lista inteira

Esta tabela é uma métrica agregada, não uma trilha de auditoria (`R-USO-06`, mesmo espírito). Saber
"qual validação bloqueou com mais frequência" pede o achado principal — o primeiro bloqueante, ou,
na ausência de bloqueante, o primeiro confirmável pendente — não a lista completa de cada tentativa.
Uma trilha completa, se um dia for necessária, é tabela própria.

### `D-11` — `dt_tentativa` em UTC; "dia" é conceito de consulta, não de gravação

O mockup do painel ganhou um recorte "Hoje", ao lado de "7/30/90 dias" — e "hoje" só tem resposta
correta se alguém souber, no momento da consulta, **o fuso de quem pergunta**. Gravar já convertido
para horário de Brasília pareceria mais simples e é a armadilha clássica: o servidor não sabe, no
instante do `POST /reports`, se quem vai consultar depois estará no mesmo fuso, e converter cedo
demais perde o instante real por trás da conversão.

`dt_tentativa` grava sempre em UTC — é o que `timestamptz` do Postgres já faz por padrão, sem
esforço extra. O corte do "dia" (`date_trunc('day', dt_tentativa at time zone 'America/Sao_Paulo')`
ou equivalente) é responsabilidade de quem constrói a consulta, no momento em que a constrói — a
mesma tabela serve "hoje" em qualquer fuso que um consumidor futuro venha a precisar, sem reprocessar
nada.

---

## 7. O que muda no código

| Arquivo | Mudança |
|---|---|
| `backend/pyproject.toml` | acrescenta `sqlalchemy>=2.0`, `psycopg2-binary`, `alembic` |
| `backend/alembic.ini`, `backend/alembic/` | **novo** — `phase_01_tentativa_geracao.py`, criando a tabela `tentativa_geracao` com as colunas de §2.6 e o `CHECK` de `R-USO-08` |
| `backend/src/infrastructure/database/models.py` | **novo** — classe `TentativaGeracao` (SQLAlchemy `Mapped[]`), atributo Python descritivo mapeado à coluna física via `mapped_column("nr_contrato", ...)` etc. |
| `backend/src/infrastructure/database/engine.py` | **novo** — *engine*/sessão a partir de `DATABASE_URL` |
| `backend/src/infrastructure/di/container.py` | novo método para obter a sessão e persistir um `TentativaGeracao` |
| `backend/src/api/routers/reports.py` | um helper `_registrar_tentativa(desfecho, ...)` — sob `try/except` que só loga (`R-USO-04`) — chamado nos **quatro** pontos de saída: antes do `return RespostaRelatorio(...)` ([reports.py:392](../../backend/src/api/routers/reports.py)), antes do `return JSONResponse` de bloqueio ([reports.py:386-389](../../backend/src/api/routers/reports.py)), e dentro dos dois `except` ([reports.py:357-364](../../backend/src/api/routers/reports.py)) |
| `backend/tests/test_registro_de_uso.py` | **novo** |
| `README.md` §"Hospedagem" | nova linha de recurso (Postgres Flexible Server) e a variável `DATABASE_URL` |

**Não muda**: `RespostaRelatorio`, `RespostaBloqueada`, o contrato da API, qualquer arquivo de
domínio, qualquer renderizador.

---

## 8. Testes e portões

* **`P0`** — sucesso grava uma linha com `tp_desfecho = 'gerado'` e `nr_contrato`,
  `pr_competencia`, `qt_linha`, `qt_divergencia`, `in_identidade_confirmada` corretos; `sg_achado`
  e `dc_erro` nulos.
* **`P1`** — achado bloqueante grava uma linha com `tp_desfecho = 'bloqueado'` e `sg_achado` igual
  ao `validacao` do primeiro bloqueante; os quatro campos exclusivos de sucesso, nulos.
* **`P2`** — achado só confirmável (sem bloqueante, ESPEC 029) grava `tp_desfecho = 'bloqueado'`
  com `sg_achado` do primeiro confirmável.
* **`P3`** — `ExtractionError` grava `tp_desfecho = 'erro'`, `dc_erro = 'ExtractionError'`.
* **`P4`** — exceção genérica grava `tp_desfecho = 'erro'`, `dc_erro` igual ao nome da classe real.
* **`P5`** — banco indisponível não impede nenhuma das respostas (`200`, `422` de bloqueio, `422`
  de `ExtractionError`, `500`) — prova de `R-USO-04` nos quatro caminhos.
* **`P6`** — `alembic upgrade head` aplica limpo em banco vazio, com os nomes de coluna de §2.6
  exatamente.
* **`P7`** — suíte de regressão inteira (backend e navegador) permanece verde, sem achado novo em
  teste existente.

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Custo de infraestrutura nova | SKU mínimo de Postgres Flexible Server, volume baixo (`D-06`) |
| Gravação acrescentar latência perceptível | *Insert* único, sem índice além da chave primária, fora do caminho crítico |
| Reversão parcial de "sem estado" confundir leitura futura do projeto | Esta espec revisa ESPEC 001 §7.2 explicitamente (`D-02`) |
| Credencial de banco exposta sem Key Vault/identidade gerenciada | Mesma classe de pendência já registrada no README para o ACR (`I-03`) |
| `dc_erro` vazar detalhe de arquivo via mensagem de exceção | Só a classe é gravada, nunca a mensagem (`D-09`) |
| Um quinto ponto de saída (refatoração futura de `gerar_relatorio`) sair sem instrumentação | Helper único chamado nos quatro pontos, um teste por desfecho (`P0`-`P4`) — uma saída nova sem chamada correspondente falha o teste do seu próprio caminho, não um guard genérico |
| Falha de gravação silenciosa nunca ser percebida | `logger.exception` no `except` de `R-USO-04` — silenciosa para quem usa a tela, não para quem opera |

---

## 10. Pontos em aberto

* **`I-01`** — por quanto tempo os registros ficam retidos? Fica a retenção padrão do banco até
  haver decisão em contrário.
* **`I-02`** — dimensionamento exato do Postgres Flexible Server — depende de quem provisiona o
  recurso em `rg-confere-des`.
* **`I-03`** — a *connection string* migra para Key Vault/identidade gerenciada desde o início, ou
  entra como variável de ambiente simples com a pendência registrada? Mesma decisão em aberto que o
  README já registra para o `AcrPull` do ACR.
* **`I-04`** — quando (e como) os dados gravados aqui passam a ser consultáveis? É a espec seguinte,
  não esta — mas o acesso já tem direção decidida: **rota própria dentro do Confere, atrás de um
  portão simples na borda** (não uma tela pública como o resto do app), porque o público do painel
  (quem acompanha o uso) não é o público do Confere (quem sobe contrato e levantamento). Isso é a
  **primeira autenticação do Confere**, deliberadamente restrita a essa rota — não uma reversão de
  ESPEC 001 §7.2 sobre o resto do app. Ainda em aberto, dentro dessa direção: `Basic Auth` na rota
  (aplicação) ou restrição de IP para a rede da PRODAM na borda do Container App (infraestrutura,
  recurso nativo de *ingress* do Container Apps) — a escolha depende de a rede da PRODAM permitir um
  *allowlist* de IP limpo, o que só quem administra a rede sabe responder. O mockup já testa presets
  diários (Hoje/7/30/90 dias); a consulta real herda `D-11` — o corte do dia aplica o fuso no
  momento da consulta, nunca gravado na linha.
* **`I-05`** — o padrão da PRODAM descreve um processo formal de homologação do modelo de dados
  pela área de Administração de Dados (ER/Studio, código de subsistema `SS9999`). Esta espec aplica
  as **regras de nome** do documento, mas não passou por esse processo — não há hoje um modelo do
  Confere registrado no repositório ER/Studio da PRODAM. Fica em aberto se uma tabela deste porte
  precisa do processo completo antes de produção, e com quem essa conversa deve acontecer.

---

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Dependências, `engine.py`, modelo `TentativaGeracao`, migração inicial | P |
| B | O helper de gravação e as quatro chamadas em `reports.py`, sob `R-USO-04` (`P0`-`P5`) | M |
| C | Provisionamento do recurso no Azure e `DATABASE_URL` em produção | P — depende de acesso à assinatura |
| D | Regressão (`P7`) e documentação (README) | PP |

---

## 12. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-09-09 | Redação inicial, a partir da decisão de usar PostgreSQL em vez de Google Analytics ou do Log Analytics já provisionado |
| 1.1 | 2026-09-09 | Nomes de tabela e coluna reescritos para o padrão de nomenclatura da PRODAM — `relatorios_gerados` → `relatorio_gerado`, campos livres → `nr_contrato`, `pr_competencia`, `qt_linha`, `qt_divergencia`, `in_identidade_confirmada`, `dt_geracao`. §2.5/§2.6 e `R-USO-07` acrescentadas; `I-05` registra a homologação formal como ponto em aberto (`D-07`) |
| 1.2 | 2026-09-09 | **Escopo ampliado**: passa a gravar também bloqueio e erro, não só sucesso — decisão explícita em resposta às perguntas *"registra sempre que gerar com sucesso?"* e *"grava também quando não for gerado e a causa?"*. Tabela renomeada de `relatorio_gerado` para `tentativa_geracao`; `dt_geracao` → `dt_tentativa`; colunas novas `tp_desfecho`, `sg_achado`, `dc_erro`; quatro pontos de gravação em vez de um; `R-USO-01`, `R-USO-02`, `R-USO-04` revistas; `R-USO-08`, `R-USO-09`, `D-08`, `D-09`, `D-10` acrescentadas |
| 1.3 | 2026-09-09 | O mockup do painel ganhou um recorte "Hoje" além de "7/30/90 dias" — o que expôs uma decisão que a spec ainda não registrava: em que fuso horário "dia" é contado. `R-USO-10` e `D-11` acrescentadas: `dt_tentativa` grava sempre em UTC, e o corte por dia é decisão de quem consulta, não de quem grava. `I-04` atualizada para herdar essa decisão |
| 1.4 | 2026-09-09 | `I-04` ganha direção de acesso ao futuro painel: rota própria dentro do Confere, atrás de portão simples (Basic Auth ou restrição de IP) — não a mesma tela pública do resto do app, porque o público do painel não é o público do Confere. É a primeira autenticação do Confere, deliberadamente restrita a essa rota. Mecanismo exato (Basic Auth vs. IP) segue em aberto, dependente de quem administra a rede da PRODAM |
