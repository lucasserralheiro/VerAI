# PLANO 050 — Implementação de "O relatório que não deixava rastro"

| | |
|---|---|
| **Especificação** | [ESPEC 050](../specs/050-o-relatorio-que-nao-deixava-rastro.md) v1.4 |
| **Versão** | 1.0 — 2026-09-11 |
| **Backlog** | TASKS 050, a escrever. A última numeração usada no projeto é `T-2807`, do PLANO 054 (na árvore, não commitado) — os `T-` deste plano começam em **`T-2808`** |
| **Estado inicial** | Ramo `feature/evolucao`, `HEAD` em `293eb67`, **árvore suja** — ver "Colisão conhecida" abaixo. Medido em 2026-09-11: backend **1.627 testes coletados** (`uv run python -m pytest --collect-only -q`) |
| **Colisão conhecida** | **Sim, mas sem sobreposição de arquivo.** A árvore tem trabalho não commitado de outra entrega (ESPECs 053/054 — espaçamento de parágrafo e cabeçalho repetido no `.docx`), tocando `docx_renderer.py`, `ooxml.py`, `anexos.json` e quatro arquivos de teste, além de `README.md` e `docs/CHANGELOG.md` **modificados**. Nenhum desses arquivos é tocado por este plano — mas `README.md` e `CHANGELOG.md` **serão**, na Fase D das ESPECs 053/054, o que faz este plano **evitar as duas fases que tocariam os mesmos arquivos** (ver §6) até aquele trabalho commitar. Verificado: `container.py`, `reports.py`, `pyproject.toml` — os três arquivos de produção que este plano toca — não aparecem no `git status` |
| **Instrumento existente** | `docs/triade_referencia/README.md` §2.1/§4.1 — o padrão SQLAlchemy 2.x + Alembic já validado em produção noutro projeto da casa, replicado aqui sem adaptação. `backend/tests/conftest.py` — a convenção de fixture do projeto, a seguir para a sessão de banco de teste |

---

## 1. O que este plano tem de diferente dos anteriores

> **É a primeira entrega desta série que introduz um banco de dados.** Não há precedente de
> migração, de *engine*, de sessão. O risco não é de regra de negócio — é de **acoplamento**: um
> banco fora do ar não pode, sob nenhuma circunstância, impedir a entrega de um relatório que já
> era o produto do Confere antes de este plano existir (`R-USO-04` da ESPEC).

> **Este plano entrega código, não infraestrutura.** Não há acesso à assinatura Azure para
> provisionar o Postgres Flexible Server (`I-02` da ESPEC), então a Fase C do esforço da ESPEC —
> provisionamento do recurso e `DATABASE_URL` em produção — **fica fora deste plano**, registrada em
> §6. O que se entrega é testável de ponta a ponta sem um Postgres real: a suíte roda contra SQLite
> em memória, e a troca para Postgres em produção é só a *connection string* — nenhuma linha muda.

> **Quatro pontos de gravação, um helper só.** `reports.py` tem quatro saídas (sucesso, bloqueio,
> `ExtractionError`, exceção genérica). A armadilha mais provável desta entrega é escrever a
> gravação **inline** nas quatro, produzindo quatro pontos para divergir. Um helper único,
> parametrizado por desfecho, é o que a `T-2814` testa por caminho.

> **`README.md` e `CHANGELOG.md` não são tocados nesta entrega**, mesmo a ESPEC prevendo isso na
> Fase D do esforço (§11 da ESPEC). Os dois já estão modificados por outra entrega não commitada — a
> Fase de documentação deste plano fica **bloqueada** até aquele commit acontecer, para não misturar
> dois `diff`s no mesmo arquivo (§6, §9).

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Linha de base** | Fim da `F0` | Backend: **1.627** coletados, suíte completa verde antes de tocar qualquer arquivo. `git status` dos três arquivos de produção-alvo (`container.py`, `reports.py`, `pyproject.toml`) confirmado limpo | Vermelho prévio se classifica antes de seguir — mesma disciplina da ESPEC 030 `R-SUI-02` |
| **P1 — O esqueleto, sem tocar o fluxo** | Fim da `F1` | `TentativaGeracao` mapeada, `alembic upgrade head` aplica limpo contra SQLite **e** contra Postgres (se disponível localmente), com as colunas de ESPEC §2.6 exatamente. **Nenhuma linha de `reports.py` mudou** | Reverter o modelo até bater com §2.6 coluna a coluna |
| **P2 — A gravação, nos quatro caminhos** | Fim da `F2` | `P0`-`P5` da ESPEC (§8) verdes: sucesso grava `gerado`; achado bloqueante e achado confirmável gravam `bloqueado` com `sg_achado` correto; `ExtractionError` e exceção genérica gravam `erro` com `dc_erro` = nome da classe; banco indisponível não muda nenhuma das quatro respostas HTTP | Qualquer resposta HTTP que mude de conteúdo ou código com o banco fora do ar é `R-USO-04` violada — reverter a chamada, não a exceção |
| **P3 — O conjunto** | Fim da `F3` | Suíte completa: **1.627 + os novos de `test_registro_de_uso.py`**, verde. `mypy --strict`, `ruff`, `bandit` limpos nos arquivos novos | Não entregar |

---

## 3. Fases

### F0 — Linha de base `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2808 | `uv run python -m pytest --collect-only -q` → **1.627**, e a suíte completa rodada uma vez, verde | **P0** |
| T-2809 | Confirmar `git status --short -- backend/src/infrastructure/di/container.py backend/src/api/routers/reports.py backend/pyproject.toml` vazio | **P0** |

**Verificação:** `P0`. **Tamanho:** PP.

---

### F1 — O esqueleto: dependências, modelo, migração `[portão]`

**Objetivo:** a tabela existe, mapeada, migrável — e nada mais. `reports.py` **não é tocado** nesta
fase; é o que deixa `P1` isolar qualquer defeito de esquema de qualquer defeito de gravação.

| # | Tarefa | Ref. |
|---|---|---|
| T-2810 | `backend/pyproject.toml`: acrescenta `sqlalchemy>=2.0`, `psycopg2-binary`, `alembic`; `uv lock` | ESPEC §7 |
| T-2811 | `backend/src/infrastructure/database/engine.py` — *engine*/sessão a partir de `DATABASE_URL`. **Sem valor padrão apontando para produção**: ausente a variável, falha no boot do módulo de banco, nunca em silêncio | ESPEC §7 |
| T-2812 | `backend/src/infrastructure/database/models.py` — `TentativaGeracao` (SQLAlchemy `Mapped[]`), atributo Python descritivo mapeado à coluna física via `mapped_column("nr_contrato", ...)` etc., para as dez colunas de ESPEC §2.6, com o `CHECK` de `tp_desfecho` (`R-USO-08`) | ESPEC §2.6, `R-USO-07`, `R-USO-08` |
| T-2813 | `backend/alembic.ini` + `backend/alembic/env.py` + `backend/alembic/versions/phase_01_tentativa_geracao.py` (nome no padrão do TRIADE, `triade_referencia/README.md` §4.1) | ESPEC `D-05` |
| T-2814 | **[portão]** `alembic upgrade head` contra um SQLite descartável **e** o `CHECK` recusa um `tp_desfecho` fora do domínio fechado — testado com `sqlalchemy.exc.IntegrityError` esperado | **P1** |

**Verificação:** `P1`. **Tamanho:** P.

---

### F2 — A gravação: o helper e os quatro caminhos `[portão]`

**Objetivo:** um registro por chamada a `POST /reports`, nos quatro pontos de saída, sob
`R-USO-04` — e só isso.

| # | Tarefa | Ref. |
|---|---|---|
| T-2815 | `container.py`: método `registrar_tentativa(desfecho, ...)` — abre sessão, monta `TentativaGeracao`, `commit`; **sob `try/except Exception` que só loga** (`logger.exception`) e nunca propaga. Assinatura aceita os campos opcionais de cada desfecho (`nr_contrato=None`, `sg_achado=None`, `dc_erro=None`, ...) | `R-USO-04`, ESPEC §7 |
| T-2816 | `reports.py`: a chamada no caminho de sucesso, logo antes do `return RespostaRelatorio(...)` (linha ~392) — `tp_desfecho="gerado"`, os cinco campos de ESPEC §2.1 | ESPEC `R-USO-01` |
| T-2817 | `reports.py`: a chamada no caminho de bloqueio, antes do `return JSONResponse` (linhas ~386-389) — `tp_desfecho="bloqueado"`, `sg_achado` = `validacao` do primeiro bloqueante ou, na ausência, do primeiro confirmável (`D-10` da ESPEC) | ESPEC `R-USO-01`, `D-10` |
| T-2818 | `reports.py`: a chamada nos dois `except` (linhas ~357-364) — `tp_desfecho="erro"`, `dc_erro = type(erro).__name__` (nunca `str(erro)`, `D-09`) | ESPEC `R-USO-01`, `D-09` |
| T-2819 | `backend/tests/test_registro_de_uso.py` — `P0` a `P5` da ESPEC §8: sucesso, bloqueante, confirmável, `ExtractionError`, exceção genérica, banco indisponível. Sessão de teste em SQLite (`sqlite:///:memory:`, ou arquivo temporário se `:memory:` colidir com conexões concorrentes do `TestClient`) | ESPEC §8 |
| T-2820 | **[portão]** Os seis testes verdes. Simulação de banco indisponível: sessão que levanta em `commit()` — as quatro respostas HTTP (`200`, `422` bloqueio, `422` `ExtractionError`, `500`) permanecem **byte a byte** as de antes desta entrega | **P2** |

**Verificação:** `P2`. **Tamanho:** M.

---

### F3 — O conjunto `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2821 | Suíte completa do backend, verde: **1.627 + os de `test_registro_de_uso.py`**, número declarado | **P3** |
| T-2822 | `mypy --strict`, `ruff`, `bandit -ll` nos arquivos novos e nos três tocados | **P3** |
| T-2823 | Emenda de execução (§9) — o que este plano não previu | — |

**Verificação:** `P3`. **Tamanho:** PP.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3
P0     P1     P2     P3

F0  linha de base, três arquivos-alvo confirmados limpos
F1  tabela mapeada e migrável — reports.py intocado
F2  o helper, os quatro pontos de gravação, R-USO-04 provada com banco fora do ar
F3  suíte completa, tipos, lint, SAST
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~1 dia — a maior parte em `F2`, onde os quatro caminhos precisam de teste isolado cada |

**Bloqueios que não são deste plano:** provisionamento do Postgres em produção (`I-02` da ESPEC,
depende de acesso à assinatura Azure) e a decisão de acesso ao futuro painel (`I-04`, ainda sem
mecanismo escolhido entre Basic Auth e restrição de IP). Nenhum dos dois impede este plano — o
código entregue aqui roda contra qualquer Postgres compatível assim que `DATABASE_URL` existir.

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| Gravação inline nos quatro pontos, cada uma um pouco diferente | `T-2815`: um helper só; `T-2820` testa os quatro caminhos contra o mesmo helper |
| `dc_erro` acabar gravando `str(erro)` em vez de `type(erro).__name__` | `T-2818` e o teste correspondente em `T-2819` — asserta a **classe**, nunca aceita mensagem |
| Banco fora do ar mudando o código ou o corpo de alguma resposta HTTP | `T-2820`, comparação byte a byte com a resposta de antes da entrega |
| `alembic upgrade head` funcionar em SQLite e falhar em Postgres real (tipos incompatíveis) | `T-2814` roda contra os dois se houver Postgres local disponível; sem ele, fica risco aceito e registrado aqui — só se fecha de fato no dia do provisionamento (`I-02`) |
| Editar `README.md` ou `CHANGELOG.md` por hábito e colidir com o trabalho não commitado das ESPECs 053/054 | Fase de documentação **fora deste plano** (§6) — nada aqui toca os dois arquivos |
| `CHECK` do `tp_desfecho` divergir do texto da ESPEC por erro de digitação | `T-2814` — o teste do `IntegrityError` usa os três literais exatos (`'gerado'`, `'bloqueado'`, `'erro'`) |
| Sessão de teste em SQLite mascarar um comportamento específico do Postgres (ex.: `timestamptz`) | Registrado como risco aceito, não resolvido: SQLite não tem tipo de fuso nativo — `dt_tentativa` precisa ser testado quanto à **presença** do valor, não quanto ao comportamento de fuso, que só um Postgres real prova (`R-USO-10` da ESPEC) |

---

## 6. O que este plano não faz

- **Não provisiona o Postgres Flexible Server no Azure**, nem grava `DATABASE_URL` em produção —
  `I-02` da ESPEC, fora de alcance sem acesso à assinatura.
- **Não toca `README.md` nem `docs/CHANGELOG.md`** — os dois já estão modificados por trabalho não
  commitado (ESPECs 053/054); tocá-los agora misturaria dois `diff`s no mesmo arquivo. A
  documentação desta entrega (linha de recurso, `DATABASE_URL`, "Incremento 050") é a primeira
  tarefa de um plano seguinte, depois daquele commit.
- **Não implementa o painel de consulta** — é a ESPEC seguinte (`I-04`), que ainda depende da
  escolha entre Basic Auth e restrição de IP.
- **Não homologa o modelo junto à Administração de Dados da PRODAM** (`I-05` da ESPEC).
- **Não decide retenção nem exportação da tabela** (`I-01` da ESPEC).

---

## 7. Inventário

Sobre `backend/`:

| # | Busca | O que acha | O que já se sabe |
|---|---|---|---|
| 1 | `logger` em `reports.py` | os pontos que já logam hoje | Só `logger.exception` na linha ~361 — nenhum outro `logger.*` existe no arquivo hoje |
| 2 | `DATABASE_URL`, `sqlalchemy`, `alembic` em `backend/` | qualquer uso prévio | Nenhum — confirma que este é o primeiro ponto de contato do projeto com banco de dados |
| 3 | `conftest.py` em `backend/tests/` | fixtures compartilhadas a reaproveitar | A seguir na `F2`, antes de escrever `test_registro_de_uso.py`, para não duplicar fixture de cliente HTTP já existente |

Sobre `frontend/`: **nenhuma.** Este plano não tem uma linha de `frontend/`.

---

## 8. Convenção de commit

`<tipo>(T-28nn): descrição`. Dependência e esqueleto (`F1`) são `feat(...)`; o helper e as quatro
chamadas (`F2`) também `feat(...)`; os testes são `test(...)`. **Nunca dois tipos no mesmo commit.**
ESPEC e PLANO já commitados nesta sessão como `docs(...)`, fora deste backlog de código.

---

## 9. Emenda de execução

*A preencher na execução, com o que o plano não previu.*
