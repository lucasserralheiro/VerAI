# Passagem de conhecimento — Confere

> Documento de onboarding técnico para quem entra agora como analista de
> sistemas ou desenvolvedor(a) neste repositório. Não substitui o
> [README](../../README.md) nem as [ESPECs](../specs/) — é o mapa para chegar
> a eles mais rápido, com o que normalmente só se aprende perguntando a quem
> já trabalha no projeto.
>
> Escrito em 2026-09-21, a partir do estado do repositório neste commit.
> Como qualquer documento de arquitetura, ele descreve uma fotografia — em
> caso de dúvida, o código e os testes têm a palavra final.

---

## 1. O que é o Confere, em uma tela

O Confere compara o que foi **contratado** com o que foi **medido** num
contrato de prestação de serviços de TIC e gera o relatório de comprovação
que instrui o faturamento da PRODAM.

- **Entradas**: o contrato (proposta comercial) em PDF, a planilha de
  medição (levantamento) em XLSX, e opcionalmente aditivos contratuais em PDF.
- **Saídas**: um `.docx` de ~41 páginas sobre o papel timbrado institucional
  (o que segue para o órgão) e um `Relatorio_Analise_Medição.xlsx` que
  classifica cada item por gravidade.
- **Sem estado**: nada é persistido entre uma execução e outra. Não há banco
  de dados, não há login, não há histórico.
- **Sem IA**: é comparação determinística por código de serviço. As duas
  entradas são geradas por sistema e legíveis por máquina — não há OCR nem
  LLM em lugar nenhum deste projeto.

Leitura funcional mais aprofundada (o problema de negócio, as regras que
mudam o número, o critério de aceite): [`docs/resumo/resumo-funcional.md`](../resumo/resumo-funcional.md)
e [`docs/resumo/visao-de-negocio-confere.md`](../resumo/visao-de-negocio-confere.md).
Atenção: o `resumo-funcional.md` está datado de 2026-08-10 e alguns números
(itens, situações da análise) já mudaram desde então — trate como leitura de
contexto, não como fonte de números atuais.

---

## 2. Stack tecnológica

### Backend — Python

| Camada | Tecnologia | Observação |
|---|---|---|
| Linguagem | Python 3.12 | `requires-python = ">=3.12"` |
| Gerenciador de pacotes | **uv** (Astral) | `uv.lock` versionado |
| Framework web | FastAPI + Uvicorn | única rota de negócio é `api/routers/reports.py` |
| Validação / contratos | Pydantic v2 | `api/schemas.py` |
| Leitura de PDF | `pdfplumber` | extração do contrato |
| Leitura/escrita de XLSX | `openpyxl` | leitura do levantamento e geração do XLSX de análise |
| Geração de DOCX | `python-docx` (**com teto** `<2`) + `lxml` direto | ver §4 — identidade de bytes é testada |
| Segurança em XML | `defusedxml` | planilha enviada por usuário: defesa contra "billion laughs" |
| Testes | pytest | 57 arquivos, 1.422 testes |
| Lint / tipos / SAST | ruff, mypy (`strict = true`), bandit | grupo `dev` do `pyproject.toml` |

Não há banco de dados, não há ORM, não há autenticação, não há fila de
processamento assíncrono — é uma API síncrona por requisição, sem framework
de orquestração de LLM (porque não há LLM).

### Frontend — Next.js

| Camada | Tecnologia | Observação |
|---|---|---|
| Framework | Next.js 15.5.25 (App Router) | |
| UI runtime | React 18 | |
| Linguagem | TypeScript 5 | |
| Gerenciador de pacotes | pnpm 10 | `pnpm.overrides` de segurança no `package.json` |
| Estilo | Tailwind CSS 3.4 | |
| Data fetching | `fetch` direto via `src/lib/api.ts` | sem SWR/React Query — a tela tem 3 estados (envio, resultado, download), não precisa de cache |
| Testes | Playwright | 19 arquivos em `frontend/e2e/`, ~130 casos, incluindo verificação de acessibilidade com `@axe-core/playwright` |

Não há autenticação, não há chamadas a serviços de nuvem no frontend. A
única dependência externa é o backend, via `NEXT_PUBLIC_API_URL`.

### Infraestrutura

| Item | Solução |
|---|---|
| Containerização | Docker — `backend/Dockerfile` e `frontend/Dockerfile` (multi-stage, `output: standalone`) |
| Orquestração local | `docker-compose.yml` |
| Hospedagem | Azure Container Apps, grupo `rg-confere-des`, região `eastus` |
| Registro de imagens | Azure Container Registry `acrconferedes`, build no servidor (`az acr build`, sem Docker local) |
| CI | **Não existe.** Não há `.github/workflows/`. O gate de qualidade é só o hook de pré-commit local |

---

## 3. Arquitetura

### 3.1 Visão macro

```
┌───────────────────┐   POST /reports/conferencia-previa
│  Next.js (App     │   POST /reports  (multipart: contrato, levantamento, aditivos*)
│  Router), client-  │ ───────────────────────────────────────►  ┌─────────────────────┐
│  side, sem auth    │ ◄───────────────────────────────────────  │  FastAPI (síncrono,  │
└───────────────────┘   JSON (grid) + docx/xlsx em base64        │  Clean Architecture) │
                                                                  └─────────────────────┘
                          Nada é persistido — cada requisição usa um
                          diretório temporário que é apagado ao final.
```

Não há banco, não há fila, não há serviço externo (Azure OpenAI, Blob
Storage etc.) — tudo roda dentro do processo do backend, em memória e em
arquivos temporários.

### 3.2 Clean Architecture no backend

`backend/src/` tem quatro camadas, com a regra de dependência apontando
para dentro (verificada por teste, não só por convenção —
`backend/tests/test_architecture.py` faz *parsing* de AST dos módulos de
`domain/` e `application/` e falha se algum deles importar `fastapi`,
`pdfplumber`, `openpyxl`, `docx` ou `infrastructure`):

```
api/                    FastAPI: rotas, schemas Pydantic, upload de arquivos
  routers/reports.py     POST /reports, POST /reports/conferencia-previa
  schemas.py              contratos de request/response (Pydantic v2)
  uploads.py              gravação de UploadFile em disco temporário

application/            Orquestração do caso de uso — sem framework
  use_cases/
    generate_measurement_report.py   o pipeline inteiro: extrai, lê, concilia,
                                      valida, renderiza

domain/                 Regra de negócio pura — sem framework, sem I/O
  entities/               Contract, ContractItem, Measurement, MeasurementItem,
                           Report, AnaliseDaMedicao, Annex, ValidationFinding
  value_objects/          Quantity, ServiceCode, Classification, BlockLabel,
                           IdentidadeContratual
  interfaces/ports.py     Protocols: IContractExtractor, IMeasurementReader,
                           IAnnexReader, IReportRenderer, IAnaliseRenderer,
                           IValidation
  errors.py

infrastructure/         Todo I/O e detalhe técnico — implementa os ports
  contract/               extração do PDF (pdfplumber) + grade derivada do documento
  measurement/            leitura da aba `Levantamento` e das abas de anexo
  annex/                  leitor e configuração dos 19 anexos de detalhamento
  report/                 renderizador DOCX (ooxml.py monta XML das células
                           diretamente, para performance) e XLSX de análise
  validations/            as ~10 validações nomeadas (V-CTR-*, V-MED-*, V-ADT-*…)
  di/container.py         montagem manual das dependências (sem lib de DI)
  shared/                 utilitários de arquivo
```

Pontos que valem saber antes de mexer:

- **`api/` é irmã de `infrastructure/`**, não filha dela — diferente do que
  alguma documentação legada de outros projetos da casa descreve (ver §8
  sobre `docs/triade_referencia/`).
- **Ports (`domain/interfaces/ports.py`) não mencionam nenhuma biblioteca de
  I/O.** Foi isso que permitiu trocar o renderizador de PDF para DOCX
  (ESPEC 003) sem tocar em domínio, aplicação ou validação.
- **DI é manual** (`infrastructure/di/container.py`), sem biblioteca — um
  container simples que monta os adapters e expõe factories como
  `conferir_identidade()` e o caso de uso principal.
- **`report/ooxml.py`** é o ponto mais denso do código: monta o XML das
  células do DOCX diretamente com `lxml`, em vez de usar as propriedades de
  alto nível do `python-docx`, por performance (ESPEC 026 reduziu o tempo de
  geração a um quinto). Qualquer mudança aqui é sensível ao **teste-âncora**
  (§5) — a garantia de que o `.docx` sai byte a byte igual ao esperado é
  automatizada, não visual.

### 3.3 O pipeline de uma geração de relatório

`POST /reports` (implementado em `application/use_cases/generate_measurement_report.py`,
chamado por `api/routers/reports.py`):

1. Os arquivos chegam por multipart e são gravados num diretório temporário
   (`tempfile.TemporaryDirectory`) — nunca em local fixo.
2. **Extração do contrato** (PDF): código, descrição e quantidade
   contratada de cada item, com a grade de colunas **derivada do próprio
   documento** (não é uma coordenada fixa — ver ESPEC 017).
3. **Aplicação dos aditivos**, em sequência, sobre a proposta original:
   Inclusão, Exclusão, Aumento, Redução (ESPEC 019/022).
4. **Leitura da planilha** (XLSX): quantidade medida por código, a partir
   da aba `Levantamento` — que é o universo do relatório (ESPEC 018: não há
   catálogo nem cadastro externo).
5. **Verificação de identidade do par**: contrato e planilha declaram o
   mesmo instrumento contratual? Se não, e sem confirmação prévia, a API
   responde `422` com os achados **confirmáveis** em vez de assumir
   silenciosamente (ESPEC 029). O frontend tem uma rota rápida para isso
   (`POST /reports/conferencia-previa`, ~1s) para perguntar **antes** dos
   ~30s da geração completa.
6. **Reconciliação**: contratada × medida por código, com a regra do
   desconto de desenvolvimento aplicada por bloco (onde a planilha repete o
   mesmo código, prevalece o valor que desconta recursos de
   desenvolvimento — ESPEC 031).
7. **Validações** (bloqueantes ou apenas avisos) — `infrastructure/validations/`.
   Um achado bloqueante interrompe tudo: **nunca sai relatório parcial**.
8. **Classificação da medição** em quatro situações (crítico, sem medição,
   parcial, conforme — ESPEC 009).
9. **Renderização**: `.docx` (modelo institucional + 19 anexos de
   detalhamento) e `Relatorio_Analise_Medição.xlsx` (cinco abas).
10. A resposta devolve os dois documentos **embutidos em base64**, porque o
    serviço é sem estado — não há onde guardá-los entre duas chamadas.

### 3.4 Frontend

`frontend/src/app/` é um shell fino (`page.tsx`) mais componentes em
`components/`:

| Componente | Papel |
|---|---|
| `UploadForm.tsx` | envio dos arquivos, chamada à conferência prévia |
| `DivergenciaGrid.tsx` | grid de divergências na tela, mesma ordem do relatório |
| `AnaliseMedicaoPanel.tsx` | painel das quatro situações da análise |
| `DivergenciaDeFonte.tsx` | tabela de divergências entre contrato e planilha |
| `LinhasDerivadas.tsx` | linhas `1/1` inferidas por perfil/pacote, com o dado original ao lado |
| `ResultadoPanel.tsx` | tela de resultado (download, avisos) |
| `Barra.tsx` / `Rodape.tsx` | identidade visual (marca Confere na barra, PRODAM no rodapé) |
| `ConfirmarLimpeza.tsx` | botão "limpar para recomeçar" com confirmação |

`src/lib/api.ts` é o único ponto de saída HTTP; `src/lib/documento.ts` e
`src/lib/types.ts` completam a camada de acesso a dados. Não há
Server Components fazendo fetch — a aplicação é majoritariamente
client-side porque o fluxo é interativo (upload → aguardar → grid).

---

## 4. Regras de negócio essenciais (o que surpreende quem chega agora)

Isto é só o resumo do que mais frequentemente pega quem lê o código pela
primeira vez. A referência completa é sempre a [ESPEC 001](../specs/001-mvp-analise-medicao.md)
e as ESPECs subsequentes.

- **O universo do relatório é a aba `Levantamento`**, não um catálogo
  externo. Todo código que ela traz vira linha; o contrato dá a ordem.
- **A quantidade contratada vem sempre do contrato**, nunca da coluna
  homônima da planilha — que é ignorada para esse fim.
- **Quando o mesmo código se repete na planilha em blocos**, prevalece o
  bloco que desconta recursos de desenvolvimento.
- **Item com as duas quantidades zeradas não entra no relatório final** —
  não prova nem desmente nada — mas continua na tela e na análise.
- **Item medido sem cobertura contratual aparece à parte**, sob "DEMAIS
  ITENS DO LEVANTAMENTO", nunca escondido.
- **Um único contrato por execução.** Não há consolidação automática de
  aditivos anteriores; cada execução recebe o conjunto de peças relevante.
- **A família `10.050`** (especialista/analista e consultoria de BI) é
  excluída do documento por decisão de negócio, mas entra na comparação —
  vive numa constante nomeada porque não varia por contrato.

---

## 5. Testes: o que garante que o sistema não regride

```bash
cd backend
uv run python -m pytest                                   # 1.422 testes, ~15 min
uv run python -m pytest tests/test_anchor_por_codigo.py    # teste-âncora do documento
uv run python -m pytest tests/test_anchor_analise.py       # teste-âncora da análise

cd ../frontend
pnpm exec playwright test           # ~130 casos no navegador; backend precisa estar no ar
```

**Use `python -m pytest`, nunca `pytest` direto.** O `-m` põe o diretório
atual no `sys.path`; sem ele, `tests/test_divergencia_de_fonte.py` falha ao
importar de `tests.test_quantitativo_consolidado` com
`ModuleNotFoundError`, e **nove casos deixam de rodar sem que a suíte acuse
falha** — ela relata sucesso no resto. Isso já está registrado em memória de
projeto por ter mordido antes.

**O teste-âncora é o critério de aceite do projeto.** Ele gera o relatório
a partir de pares reais de arquivos (`docs/documentos/`) e compara **por
código** com o documento modelo. Não é comparação visual: é célula a célula.
Antes de mexer em `report/`, `contract/` ou `measurement/`, rodar esse teste
é o primeiro passo de validação, não o último.

Qualidade estática:

```bash
cd backend
uv run ruff check . && uv run mypy src/ && uv run bandit -ll -r src/
```

O hook de pré-commit (`./scripts/install-hooks.sh`, ativa via
`core.hooksPath`) roda auditoria de dependências e SAST e **bloqueia** o
commit da planilha de medição íntegra — mas **não** roda ruff, mypy nem a
suíte de testes. Isso fica por conta de quem edita, e nada cobra isso antes
do merge, porque **não há CI**.

---

## 6. Rodando o projeto localmente

### Com Docker

```bash
docker compose up --build
```
Interface em `http://localhost:3000`, API em `http://localhost:8000`,
documentação interativa (Swagger) em `http://localhost:8000/docs`.

### No Windows, sem Docker

```powershell
.\scripts\run_backend.ps1     # terminal 1
.\scripts\run_frontend.ps1    # terminal 2
```

Depois, abrir **`http://localhost:3000`** — nunca `127.0.0.1`. São origens
distintas para o navegador (CORS não libera uma se só a outra estiver
configurada), e abrir pelo endereço errado faz a tela simplesmente não
reagir, sem erro visível no console.

### Comandos avulsos

```bash
cd backend
uv sync
uv run uvicorn api.main:app --reload --port 8000
```
Sem `PYTHONPATH` e sem `--app-dir`: o `uv sync` instala os pacotes de `src/`
no ambiente (ver `[tool.hatch.build.targets.wheel]` no `pyproject.toml`),
então os imports resolvem sozinhos.

```bash
cd frontend
pnpm install
pnpm dev
```

### Sem interface (fluxo direto arquivo → relatório)

```bash
cd backend
uv run python ../scripts/gerar_relatorio.py     # gera saida/relatorio.docx
```

---

## 7. Deploy e hospedagem (Azure Container Apps)

| Recurso | Nome |
|---|---|
| Container App — backend | `ca-confere-backend` · 1 vCPU / 2 GiB · min 1, max 3 réplicas |
| Container App — frontend | `ca-confere-frontend` · 0,5 vCPU / 1 GiB |
| Environment | `cae-confere-des` |
| Registry | `acrconferedes` |
| Log Analytics | `log-confere-des` |

Build no servidor do ACR, sem Docker local:

```bash
az acr build -r acrconferedes -t confere-backend:v5 -f backend/Dockerfile ./backend
az acr build -r acrconferedes -t confere-frontend:v5 -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://ca-confere-backend.<dominio>/ ./frontend
```

Pontos que já causaram incidente e valem atenção redobrada:

- **`--build-arg NEXT_PUBLIC_API_URL` não é opcional.** Ela é embutida no
  pacote do cliente em tempo de build. Esquecê-la produz uma imagem que
  compila, sobe e desenha a tela inteira — e só falha quando alguém clica
  em algo que chama a API. Conferir o valor no chunk servido faz parte de
  publicar.
- **Tags são imutáveis** e os apps estão em `activeRevisionsMode: Single`:
  rollback é republicar a tag anterior, não redistribuir tráfego.
- O backend escala por concorrência com alvo **1** — cada réplica processa
  uma geração por vez, e isso depende do `/health` continuar respondendo
  durante a geração (ESPEC 012); um *liveness probe* ingênuo mataria o
  container no meio de um relatório de 30s.

**Pendências conhecidas de hospedagem:** não há autenticação nas URLs
públicas; o ACR é acessado por senha de administrador em vez de identidade
gerenciada (a `id-confere-des` existe mas não recebeu `AcrPull`).

---

## 8. Um cuidado específico: `docs/triade_referencia/`

`docs/triade_referencia/README.md` **não descreve este projeto.** É um
documento de referência técnica sobre outro sistema da PRODAM (TRIADE —
triagem de documentos de licitação, em `C:\GIT\pn1015-triade`), mantido
aqui como material de estudo/comparação de arquitetura (FastAPI + Next.js,
multi-tenant, com LLM, Postgres, Azure OpenAI etc.). Vale a leitura como
referência de padrões de outro projeto da casa, mas **nada dele — stack,
rotas, modelo de dados — se aplica ao Confere**. Já houve confusão por
semelhança de nome de pastas; ao consultar esse arquivo, é bom lembrar
disso antes de citar algo como se fosse deste repositório.

---

## 9. Dados pessoais e segurança

A planilha de medição original traz duas abas com registro nominal de
servidor público (`Usuários`, `Office365`) — mais de mil linhas com login,
nome completo e e-mail institucional.

- **No repositório**, o tratamento é fechado: o arquivo íntegro nunca é
  versionado (`docs/documentos/` no `.gitignore`), o hook de pré-commit
  bloqueia o commit da planilha, e a fixture de teste é gerada por
  `scripts/sanitize_fixture.py` com dado sintético (mesma estrutura,
  contagem e formatação — só as colunas identificadoras substituídas).
- **Em execução, o tratamento não existe**: o `.docx` gerado carrega os
  registros nominais, como o relatório de origem que reproduz. Isso roda
  hoje numa aplicação **sem autenticação**, com *ingress* externo, sem
  registro de acesso e sem retenção declarada. Não é bug — é decisão de
  negócio pendente, registrada como a pendência mais séria antes de o
  sistema sair de demonstração (ver README, seção "Hospedagem" e "Dados
  pessoais").

Quem for tocar autenticação, logging de acesso ou exposição pública deste
serviço deve tratar isso como pré-requisito, não como melhoria incremental.

---

## 10. Como o projeto é desenvolvido (processo)

Este repositório segue um método *spec-driven*, versionado junto ao
código, em `docs/`:

```
docs/
  specs/    uma ESPEC por incremento (001 a 056+), numeradas e cronológicas
  plans/    o plano técnico de implementação de cada ESPEC
  tasks/    o backlog granular de cada ESPEC
  resumo/   leituras funcionais e de negócio, sem arquitetura
  CHANGELOG.md   mudanças de rumo — o que uma entrega revisou de outra
```

Cada linha da tabela no [README](../../README.md) aponta ESPEC → PLANO →
TASKS de um incremento. O CHANGELOG é a melhor fonte para entender **por
que** uma regra é como é hoje: várias ESPECs revisam decisões de ESPECs
anteriores (a busca por `superada por` ou `revisa` nos títulos ajuda a
achar essas cadeias). Antes de "corrigir" algo que parece estranho no
código, vale procurar a ESPEC que o introduziu — boa parte do que parece
estranho é decisão deliberada e documentada, não descuido (exemplos: a
família `10.050` excluída do documento, a ESPEC 046 que removeu
deliberadamente uma proteção por decisão de negócio, o teto de versão do
`python-docx`).

Não há `CLAUDE.md`/`AGENTS.md` neste repositório com convenções à parte —
as convenções vivem no próprio código e nas ESPECs.

---

## 11. Limitações conhecidas (não é "a fazer", é estado atual documentado)

Lista resumida — a versão completa e atualizada está sempre no
[README, seção "Limitações conhecidas"](../../README.md#limitações-conhecidas):

- Divergência real de quantidade num item (certificado digital), pendente
  de confirmação do negócio.
- Consumo sem previsão contratual não entra no `.docx`, só na tela.
- Itens de perfil/pacote (`1/1`) perdem granularidade — perfil diferente
  contratado vs. medido não aparece.
- A quebra de página não coincide com o modelo (não afeta conteúdo).
- O XLSX de análise nunca foi aberto manualmente no Excel — só conferido
  programaticamente, o que já deixou passar defeitos de DOCX antes.
- Geração leva ~22s em produção; abaixo do limite de 40s que tornaria
  otimização obrigatória, mas já identificado como alvo óbvio.
- Os 19 anexos dependem do nome exato da aba na planilha (`anexos.json`).
- Um único contrato por execução — sem consolidação cronológica de
  aditivos anteriores.
- Sem autenticação (ver §9).
- Regras derivadas majoritariamente de dois casos reais (SMIT e PGM); um
  terceiro contrato de geometria diferente ainda não validou o desenho.

---

## 12. Mapa de onde procurar cada coisa

| Preciso entender... | Vou em... |
|---|---|
| O que o sistema faz, para quem, e por quê | `docs/resumo/visao-de-negocio-confere.md` |
| Regras de negócio completas e validações | `docs/specs/001-mvp-analise-medicao.md` |
| Por que uma regra específica é como é | `docs/CHANGELOG.md` (buscar pela ESPEC) |
| Como rodar, testar, empacotar, publicar | `README.md` (raiz) |
| Contrato da API | `backend/src/api/schemas.py` + `/docs` (Swagger) em runtime |
| Onde uma entidade de domínio é definida | `backend/src/domain/entities/` |
| Como um port é implementado | `backend/src/infrastructure/<área>/` |
| Como o DOCX é montado byte a byte | `backend/src/infrastructure/report/ooxml.py` + `test_anchor_por_codigo.py` |
| Componentes de tela | `frontend/src/app/components/` |
| Testes de acessibilidade | `frontend/e2e/` (arquivos com `a11y` no nome) |
