# TASKS 001 — Backlog de Implementação do MVP

| | |
|---|---|
| **Plano** | [PLANO 001](../plans/001-plano-implementacao-mvp.md) |
| **Especificação** | [ESPEC 001](../specs/001-mvp-analise-medicao.md) |
| **Versão** | 1.1 — 2026-08-05 |
| **Total** | 67 tarefas de engenharia + 6 insumos de negócio |
| **Status** | **67 concluídas.** Ver §2 e as notas de desvio |

---

## 1. Convenções

**Identificadores.** `T-nn` são tarefas de engenharia e mantêm a numeração do PLANO 001 — o
rastro plano → backlog → commit é direto. `I-nn` são insumos cujo dono é o solicitante, não a
engenharia.

**Tamanhos.** `P` até 2 h · `M` meia jornada · `G` uma jornada · `GG` duas jornadas.
Total estimado: **≈ 221 h ≈ 28 dias úteis** para um desenvolvedor em dedicação integral —
dentro da faixa de 23 a 30 dias prevista no PLANO 001 §5.

**Marcadores.** `[risco]` concentra incerteza técnica · `[paralelo]` não bloqueia o caminho
crítico · `[portão]` encerra um portão de decisão do plano.

**Definição de pronto de qualquer tarefa.** Código e teste na mesma entrega; `ruff`, `mypy` e
`pytest` verdes; nenhuma regra de negócio sem teste que a exercite pelo identificador da ESPEC
001; comentário explicando o *porquê* onde a escolha não for óbvia.

**Convenção de commit.** `<tipo>(T-nn): descrição` — ex.: `feat(T-15): extração por coordenada de palavra`.

---

## 2. Quadro geral

| Épico | Tarefas | Status |
|---|---|---|
| **E0** Fundação e prova de fidelidade | T-01 … T-07 | ✅ |
| **E1** Domínio | T-08 … T-13, T-64, T-65 | ✅ |
| **E2** Extrator do contrato ⚠️ | T-14 … T-23 | ✅ portão P2 fechado |
| **E3** Leitores de medição e catálogo | T-24 … T-33 | ✅ |
| **E4** Reconciliação e validações | T-34 … T-43 | ✅ |
| **E5** Renderização do PDF | T-44 … T-50 | ✅ portão P3 fechado |
| **E6** API e interface | T-51 … T-58, T-66, **T-67** | ✅ |
| **E7** Empacotamento e entrega | T-59 … T-63 | ⚠️ T-61 não verificado |

### Desvios do backlog original

| Tarefa | O que mudou | Por quê |
|---|---|---|
| **T-19** | A chave `(código, qualificador)` é resolvida na entidade `Contract`, não no extrator | Só o catálogo sabe se um código deve ser somado ou desdobrado. Sem ele, o extrator adivinharia |
| **T-20** | **Superada.** A conferência cruzada com `extract_tables()` não foi implementada | O checksum de T-21 é prova exata; comparar contra uma estratégia que perde duas linhas geraria ruído |
| **T-44** | O cabeçalho **não** é repetido em todas as páginas | Verificado no modelo: a página 3 começa direto nas linhas de item |
| **T-49** | Antecipada para a F0 | O teste de determinismo do renderer apanhou data de criação e ID aleatório no PDF |
| **T-33** | Deixou de ser insumo recorrente | Com o catálogo embutido (T-67), a revisão passa a valer por contrato, não por execução |
| **T-61** | **Não verificado** | Não havia daemon Docker no ambiente. Único critério de pronto em aberto |

**Caminho crítico:** E0 → E1 → **E2** → E4 → E5 → E6 → E7.
**Paralelizável desde já:** E3 (com E2), frontend T-55 a T-57 (com tudo), T-32 e os insumos `I-*`.

---

## 3. Épico E0 — Fundação e prova de fidelidade

#### T-01 — Esqueleto do repositório
**Tamanho:** P · **Depende de:** —

Inicializar o Git, criar `.gitignore` (ignorando `.venv/`, `node_modules/`, `__pycache__/`,
`*.pyc`, `.next/`, e a pasta de arquivos íntegros com dados pessoais), `README.md` inicial e a
estrutura `backend/` + `frontend/` + `scripts/`.

**Pronto quando:** `git status` limpo com a estrutura criada e nenhum artefato de build rastreado.

---

#### T-02 — Dependências do backend
**Tamanho:** P · **Depende de:** T-01 · **Ref:** PLANO D-06

`pyproject.toml` com Python 3.12, `fastapi`, `uvicorn`, `pydantic`, `pdfplumber`, `openpyxl`,
`reportlab`, `python-multipart`; grupo `dev` com `pytest`, `ruff`, `mypy`, `bandit`. Gerar e
versionar `uv.lock`.

**Pronto quando:** `uv sync` reproduz o ambiente do zero e `uv run python -c "import pdfplumber, openpyxl, reportlab"` executa.

---

#### T-03 — Configuração de qualidade
**Tamanho:** P · **Depende de:** T-02

Configurar `ruff`, `mypy`, `bandit` (excluindo `tests/`) e `pytest` com `pythonpath = ["src"]`.

**Pronto quando:** os quatro comandos rodam e passam em repositório vazio.

---

#### T-04 — Hook de pré-commit
**Tamanho:** P · **Depende de:** T-03

`scripts/git-hooks/pre-commit` executando auditoria de dependências quando o lockfile mudar e
`bandit` nos `.py` alterados; `scripts/install-hooks.sh` configurando `core.hooksPath`.

**Pronto quando:** após rodar o instalador, um commit com `.py` alterado dispara o hook; a saída
diz como corrigir e como pular pontualmente.

---

#### T-05 — Fixture sanitizada da planilha
**Tamanho:** M · **Depende de:** T-01 · **Ref:** PLANO D-04

Script que gera a fixture de teste a partir da planilha original **removendo a aba `Usuários`**
(1.021 linhas de registros nominais de servidores). Só a fixture sanitizada é versionada.

**Pronto quando:** a fixture abre no `openpyxl`, contém a aba `Levantamento` íntegra, **não**
contém a aba `Usuários`, e o caminho da planilha original consta do `.gitignore`.

---

#### T-06 — Fixtures do contrato e do modelo
**Tamanho:** P · **Depende de:** T-01

Versionar o PDF do contrato e o PDF do relatório modelo em `backend/tests/fixtures/`. Ambos são
documentos públicos de contratação, sem dado pessoal.

**Pronto quando:** os arquivos estão versionados e um teste trivial os abre.

---

#### T-07 — Amostra de fidelidade em ReportLab `[risco] [portão]`
**Tamanho:** G · **Depende de:** T-02 · **Ref:** PLANO P1, D-01

Gerar um PDF de amostra com **três seções e oito linhas**, escolhidas para cobrir os três casos de
layout: grupo simples (`B`), grupo com subseção (`C2`) e linha com decimal (`E5.1`). Incluir
cabeçalho, faixas de seção, cabeçalho de colunas e rodapé.

**Pronto quando:** o PDF é gerado e impresso lado a lado com a página 2 do modelo, pronto para o
aceite do `I-03`. **Encerra o portão P1.**

---

> **CI adiada.** Um pipeline de integração contínua foi considerado e **deliberadamente deixado
> fora do MVP**. A barreira de qualidade fica no hook de pré-commit (T-04) e na execução local.
> Ao passar de demonstração para uso recorrente, essa é a primeira lacuna de processo a fechar —
> é a mesma que identifiquei como o principal gap do TRIADE.

---

## 4. Épico E1 — Domínio

> Regra transversal do épico: nenhum arquivo sob `src/domain/` importa framework, biblioteca de
> I/O ou módulo de `infrastructure/`.

#### T-08 — `ServiceCode`
**Tamanho:** P · **Depende de:** T-03

*Value object* que valida e normaliza o código no formato `NN.NNN.NNNNN.NN`.

**Pronto quando:** códigos válidos são aceitos, inválidos levantam erro de domínio, e a igualdade
funciona como chave de dicionário.

---

#### T-09 — `Quantity`
**Tamanho:** M · **Depende de:** T-08 · **Ref:** PLANO D-02, ESPEC `R-MED-04` revisada

Quantidade em `Decimal` — nunca `float` — com formatação `MILHAR` ou `SIMPLES`. Separador decimal
sempre vírgula; `MILHAR` aplica ponto de milhar, `SIMPLES` não.

**Pronto quando:** `1500` renderiza `1500` em `SIMPLES` e `1.500` em `MILHAR`; `3265.64` renderiza
`3.265,64`; `117.2889788312131` renderiza `117,29`.

---

#### T-10 — Entidades de entrada
**Tamanho:** M · **Depende de:** T-08, T-09

`ContractItem` (código, qualificador, descrição, unidade, quantidade, preço, meses),
`MeasurementItem` (código, descrição, bloco, texto bruto e valor da medida) e `CatalogEntry` com
todas as colunas da ESPEC 001 §4.3 mais `formato_quantidade`.

**Pronto quando:** as três são imutáveis, tipadas, e `MeasurementItem` preserva o texto bruto ao
lado do valor convertido — sem isso `PACOTE` e `Perfil D` se perdem.

---

#### T-11 — Agregado do relatório
**Tamanho:** M · **Depende de:** T-10

`ReportLine`, `ReportSection` e `Report`, com a ordenação vinda do catálogo e a supressão de
seções vazias como comportamento do agregado.

**Pronto quando:** um `Report` montado à mão com duas seções, uma delas vazia, expõe apenas uma.

---

#### T-12 — Ports
**Tamanho:** P · **Depende de:** T-11

`IContractExtractor`, `IMeasurementReader`, `ICatalogReader`, `IReportRenderer`, `IValidation`.

**Pronto quando:** as interfaces existem e nenhuma menciona `pdfplumber`, `openpyxl` ou `reportlab`.

---

#### T-13 — `ValidationFinding`
**Tamanho:** P · **Depende de:** T-12 · **Ref:** ESPEC §6

Achado com identificador da validação, severidade `BLOQUEIA`/`AVISA`, mensagem e item associado.

**Pronto quando:** um conjunto de achados sabe responder se há algum bloqueante.

---

#### T-64 — Teste de contrato de camada
**Tamanho:** P · **Depende de:** T-12 · **Ref:** PLANO §7

`test_architecture.py` que percorre os módulos de `src/domain/` e falha se algum importar
framework, biblioteca de I/O ou módulo de `infrastructure/`. A regra de dependência da Clean
Architecture vira teste, não convenção.

**Pronto quando:** o teste passa; introduzir um `import fastapi` em qualquer arquivo do domínio o
faz falhar.

---

#### T-65 — `conftest.py` e fixtures compartilhadas
**Tamanho:** P · **Depende de:** T-05, T-06

Fixtures do pytest que carregam o contrato, a planilha sanitizada, o relatório modelo e o catálogo
semente, com escopo de sessão para não reabrir os arquivos a cada teste.

**Pronto quando:** qualquer teste declara `contrato`, `levantamento`, `modelo` ou `catalogo` como
parâmetro e recebe o objeto pronto.

---

## 5. Épico E2 — Extrator do contrato ⚠️ caminho crítico

> A tabela de itens ocupa as páginas 26 a 29 do PDF, tem sete colunas e **células com quebra de
> linha**. As abordagens ingênuas falham: regex sobre linhas de texto resolve 15 de 60 linhas;
> `extract_tables()` resolve 55 de 57. A meta é 100%, e T-21 é o que a torna verificável.

#### T-14 — Localizar a tabela por âncora de conteúdo
**Tamanho:** M · **Depende de:** T-12

Encontrar o início e o fim da tabela pelo padrão de código e pela linha `TOTAL:`, **nunca** por
número de página fixo.

**Pronto quando:** a tabela é localizada sem nenhuma constante de página no código.

---

#### T-15 — Extração por coordenada de palavra `[risco]`
**Tamanho:** GG · **Depende de:** T-14 · **Ref:** ESPEC §9.4

Núcleo do extrator. Obter as palavras com posição, derivar as fronteiras de coluna a partir do
cabeçalho da tabela e atribuir cada palavra à sua coluna pela posição X, com folga tolerante.

**Pronto quando:** uma página inteira é reconstruída em sete colunas e a comparação manual com o
PDF confere linha a linha.

---

#### T-16 — Reconstrução de células multilinha `[risco]`
**Tamanho:** GG · **Depende de:** T-15

Uma linha de item **começa** onde há código; linhas seguintes sem código são continuação e devem
concatenar no campo da coluna correspondente.

**Pronto quando:** `12.074.00005.00` e `14.048.00008.00` — os dois itens que `extract_tables()`
perde — são extraídos com descrição, unidade e quantidade completas.

---

#### T-17 — Item dividido entre páginas
**Tamanho:** M · **Depende de:** T-16

Tratar o caso em que a continuação de um item cai na página seguinte, ignorando cabeçalho e
rodapé de página no meio da tabela.

**Pronto quando:** nenhum item da fronteira entre as páginas 26 e 27 é perdido ou duplicado.

---

#### T-18 — Conversão numérica pt-BR
**Tamanho:** P · **Depende de:** T-16

Converter `4.000,00` e `BRL 229,02` em `Decimal`. Proibido `float` em qualquer ponto do caminho.

**Pronto quando:** os testes cobrem valor com milhar, com decimal, com ambos e com prefixo `BRL`;
`grep -r "float(" src/infrastructure/contract/` não retorna nada.

---

#### T-19 — Chave `(código, qualificador)`
**Tamanho:** M · **Depende de:** T-16 · **Ref:** ESPEC `R-CTR-02`

Quando um código aparece em várias linhas, derivar o qualificador do sufixo da descrição.

**Pronto quando:** `14.025.00011.00` produz **duas** entradas distintas, `IT0101` e `SG0721`, e
`10.050.00001.00` produz três linhas que somam **4.780** (300 + 4.000 + 480).

---

#### T-20 — Conferência cruzada
**Tamanho:** M · **Depende de:** T-19

Rodar `extract_tables()` em paralelo e comparar. Divergência entre as duas estratégias vira achado
de `V-CTR-03`, não exceção silenciosa.

**Pronto quando:** a comparação roda e reporta as diferenças conhecidas sem interromper a extração.

---

#### T-21 — Checksum do contrato
**Tamanho:** M · **Depende de:** T-18 · **Ref:** PLANO D-03, ESPEC `V-CTR-03`

Recalcular `Σ (preço × quantidade × meses)` e comparar com o `TOTAL` declarado ao fim da tabela —
`BRL 10.637.425,00` no contrato-piloto.

**Pronto quando:** o total calculado bate com o declarado; remover artificialmente uma linha faz o
teste falhar. **É esta tarefa que prova que nenhuma linha se perdeu.**

---

#### T-22 — Validações `V-CTR-01` e `V-CTR-02`
**Tamanho:** P · **Depende de:** T-21

Tabela localizada com ao menos uma linha; todo código do catálogo com `exibir = S` resolvido no
contrato. Ambas bloqueantes.

**Pronto quando:** cada validação tem teste de caso feliz e de falha.

---

#### T-23 — Testes de integração do extrator `[portão]`
**Tamanho:** M · **Depende de:** T-22 · **Ref:** PLANO P2

Suíte contra o PDF real, com asserções nominais dos itens de fronteira.

**Pronto quando:** todas as linhas de item extraídas com os quatro campos completos e checksum
conferindo. **Encerra o portão P2.**

---

## 6. Épico E3 — Leitores de medição e catálogo

#### T-24 — Percorrer a aba `Levantamento`
**Tamanho:** M · **Depende de:** T-12

Identificar blocos de seção, linhas de cabeçalho e linhas de item ao longo das 166 linhas da aba.
Ignorar as outras 21 abas.

**Pronto quando:** os blocos são identificados com seus títulos e a contagem de itens é estável.

---

#### T-25 — Código em qualquer coluna
**Tamanho:** M · **Depende de:** T-24 · **Ref:** ESPEC §4.2

O layout varia entre blocos: em uns o código está na coluna B, em outros na C. Localizar por
padrão na linha, **jamais** por posição fixa.

**Pronto quando:** blocos com e sem coluna de unidade são lidos pelo mesmo caminho de código.

---

#### T-26 — Preservar o texto bruto da célula
**Tamanho:** M · **Depende de:** T-25 · **Ref:** ESPEC `R-REC-04`

Guardar o texto original ao lado do valor convertido, para que `PACOTE`, `Perfil D` e `Perfil C`
sobrevivam até a reconciliação.

**Pronto quando:** ler `14.048.00008.00` devolve o texto `D` e `C` sem tentar convertê-los em número.

---

#### T-27 — Desempate por "descontando desenvolvimento"
**Tamanho:** M · **Depende de:** T-26 · **Ref:** ESPEC `R-MED-02`

Quando o mesmo código aparece mais de uma vez, prevalece a ocorrência cujo **título do bloco ou
descrição da linha** contenha `DESCONTANDO RECURSOS DE DESENVOLVIMENTO`.

**Pronto quando:** `14.049.00047.00` devolve **2** e não 4; `14.024.00005.00` devolve **762,55**
e não 1.097,55; `14.049.00005.00` devolve **121,29** e não 130,25.

---

#### T-28 — Cabeçalho da planilha
**Tamanho:** P · **Depende de:** T-24

Extrair a data do levantamento e o contrato de referência do topo da aba.

**Pronto quando:** devolve `15/07/2026` e `TC 52/SMIT/2024` no arquivo-piloto.

---

#### T-29 — Leitor do catálogo
**Tamanho:** M · **Depende de:** T-10 · **Ref:** ESPEC `V-CAT-01`

Ler o XLSX de catálogo, validar o esquema de colunas, rejeitar `(codigo, qualificador)` duplicado
e `ordem` repetida.

**Pronto quando:** um catálogo válido carrega; um com duplicidade falha com mensagem que aponta a
linha.

---

#### T-30 — Validações `V-MED-01` e `V-MED-02`
**Tamanho:** P · **Depende de:** T-28

Aba `Levantamento` presente e estruturada (bloqueia); cabeçalho localizado (avisa).

**Pronto quando:** cada validação tem teste de caso feliz e de falha.

---

#### T-31 — Testes de integração dos leitores
**Tamanho:** M · **Depende de:** T-30

Suíte contra a fixture sanitizada, com asserções nominais dos casos de T-27.

**Pronto quando:** a suíte roda sem depender da planilha original.

---

#### T-32 — Script de semente do catálogo `[paralelo]`
**Tamanho:** M · **Depende de:** T-06 · **Ref:** PLANO D-05

Script de uso único em `scripts/seed_catalog.py` que extrai as 55 linhas das páginas 2–3 do
relatório modelo — ordem, grupo, seção, código, descrição e unidade já vêm estruturados — e emite
o XLSX de catálogo. Preencher com proposta as oito células de julgamento:

- `tipo_quantidade = PERFIL_PACOTE` em `14.048.00008.00`, `14.046.00010.00`, `14.070.00002.00` e nas duas linhas de `14.025.00011.00`
- `qualificador` `IT0101` e `SG0721` nas duas linhas de `14.025.00011.00`
- `descricao_exibicao` em `15.076.00005.00` — o modelo grafa "acima de 1.000.001", o contrato grafa "de 1.000.001 a 2.000.000"
- `formato_quantidade = SIMPLES` em `14.023.00002.00`; `MILHAR` em `14.024.00005.00` e `14.024.00006.00`; indiferente nos demais

Acrescentar as três linhas da Seção A (`10.050.*`) com `exibir = N`.

**Pronto quando:** o XLSX gerado tem 58 linhas — 55 visíveis e 3 ocultas — e carrega sem erro no
leitor de T-29.

---

#### T-33 — Revisão do catálogo `[paralelo]` — **dono: solicitante**
**Tamanho:** — · **Depende de:** T-32 · **Ref:** `I-02`

Conferência humana das oito células de julgamento propostas por T-32. Não é tarefa de engenharia.

**Pronto quando:** as oito células estão confirmadas ou corrigidas.

---

## 7. Épico E4 — Reconciliação e validações

#### T-34 — Caso de uso `GenerateMeasurementReport`
**Tamanho:** M · **Depende de:** T-23, T-31 · **Ref:** ESPEC `R-CAT-01`

Orquestrar os três leitores, montar o relatório **dirigido pelo catálogo** e devolver relatório
mais achados. Sem `import` de infraestrutura.

**Pronto quando:** o caso de uso roda com dublês dos três ports.

---

#### T-35 — Resolver quantidade contratada
**Tamanho:** M · **Depende de:** T-34 · **Ref:** ESPEC `R-CTR-01`, `R-CTR-02`

Sem qualificador no catálogo, **somar** as linhas do contrato com aquele código; com qualificador,
**casar** a linha correspondente sem somar.

**Pronto quando:** a Plataforma de BI gera duas linhas de quantidade 1, e um código multi-linha
sem qualificador soma corretamente.

---

#### T-36 — Resolver quantidade medida
**Tamanho:** P · **Depende de:** T-35 · **Ref:** ESPEC `R-MED-03`

Código do catálogo ausente da planilha recebe **0** e gera aviso — nunca falha silenciosa.

**Pronto quando:** o aviso é emitido e a linha aparece zerada.

---

#### T-37 — Perfis e pacotes como 1/1
**Tamanho:** P · **Depende de:** T-36 · **Ref:** ESPEC `R-REC-04`

Entradas com `tipo_quantidade = PERFIL_PACOTE` entram sempre como 1 contratado e 1 medido,
qualquer que seja o conteúdo da planilha.

**Pronto quando:** `14.048.00008.00` sai como 1/1 mesmo com perfil D contratado e C medido; o
literal `PACOTE` de `14.070.00002.00` também.

---

#### T-38 — Omitir quantidade contratada zero
**Tamanho:** P · **Depende de:** T-35 · **Ref:** ESPEC `R-REC-01`

**Pronto quando:** `14.049.00054.00` — contratada 0 e medida 2 — **não** aparece no relatório, e o
teste registra em comentário que a omissão é deliberada (ESPEC §9.2).

---

#### T-39 — Suprimir seções vazias
**Tamanho:** P · **Depende de:** T-38 · **Ref:** ESPEC `R-CAT-02`

**Pronto quando:** a Seção A, com todas as entradas `exibir = N`, não gera cabeçalho algum.

---

#### T-40 — Sobrescrita de descrição
**Tamanho:** P · **Depende de:** T-35 · **Ref:** ESPEC `R-CTR-03`

**Pronto quando:** `15.076.00005.00` sai com a descrição do catálogo, não a do contrato.

---

#### T-41 — Validações de reconciliação
**Tamanho:** M · **Depende de:** T-40 · **Ref:** ESPEC §6

`V-CAT-02` (código do contrato ausente do catálogo), `V-CAT-03` (código do catálogo ausente da
planilha), `V-REC-01` (divergência de quantidade contratada entre contrato e planilha) e
`V-REC-02` (valor não numérico onde se espera número). Uma validação por arquivo.

**Pronto quando:** `V-REC-01` acusa nominalmente `11.027.00001.00` — contrato 10, planilha 10,
modelo 6.

---

#### T-42 — Container de injeção de dependências
**Tamanho:** P · **Depende de:** T-41

IoC manual com cache de singletons, no padrão do TRIADE.

**Pronto quando:** o caso de uso é montado por uma única factory.

---

#### T-43 — Suíte de regras e validações
**Tamanho:** M · **Depende de:** T-42

Um teste por `R-*` e um por `V-*`, nomeados pelo identificador da ESPEC 001.

**Pronto quando:** com as três entradas do piloto o relatório em memória tem **22 seções e 55
linhas** na ordem do catálogo.

---

## 8. Épico E5 — Renderização do PDF

#### T-44 — Cabeçalho do relatório
**Tamanho:** M · **Depende de:** T-43, T-07 · **Ref:** ESPEC §8

Título, data do levantamento e contrato de referência, repetidos em todas as páginas.

**Pronto quando:** as duas páginas trazem o cabeçalho idêntico ao modelo.

---

#### T-45 — Faixas de grupo e de seção
**Tamanho:** G · **Depende de:** T-44

Faixa de grupo, faixa de seção e **cabeçalho de colunas repetido a cada seção**, como no modelo.

**Pronto quando:** as 22 seções são emitidas na ordem do catálogo, com os títulos corretos.

---

#### T-46 — Tabela de cinco colunas
**Tamanho:** G · **Depende de:** T-45

Larguras fixas, alinhamento das quantidades à direita e quebra de descrições longas sem estourar
a coluna.

**Pronto quando:** nenhuma das 55 linhas transborda a célula nem invade a coluna vizinha.

---

#### T-47 — Formatação numérica por item
**Tamanho:** P · **Depende de:** T-46 · **Ref:** PLANO D-02

**Pronto quando:** `14.023.00002.00` sai `1500` e `14.024.00006.00` sai `4.000`, reproduzindo a
inconsistência do modelo.

---

#### T-48 — Rodapé
**Tamanho:** P · **Depende de:** T-46 · **Ref:** ESPEC `R-CTR-05`

Contrato, proposta que originou as quantidades e carimbo de geração.

**Pronto quando:** o rodapé nomeia a proposta lida do contrato.

---

#### T-49 — Determinismo da saída
**Tamanho:** P · **Depende de:** T-48

Nenhum identificador aleatório e nenhuma data variável no conteúdo comparado.

**Pronto quando:** duas execuções com as mesmas entradas produzem conteúdo idêntico.

---

#### T-50 — Teste-âncora de fidelidade `[portão]`
**Tamanho:** G · **Depende de:** T-49 · **Ref:** PLANO P3, ESPEC §10

Extrair as linhas do PDF gerado e comparar **célula a célula** com as páginas 2–3 do modelo, em
código, descrição, unidade e as duas quantidades.

**Pronto quando:** **54 das 55 linhas idênticas**, com a única divergência esperada e declarada em
`11.027.00001.00`. Qualquer outra diferença reprova. Se `I-01` for resolvido a favor do contrato,
a exceção sai do teste e o critério vira 55 de 55. **Encerra o portão P3.**

---

## 9. Épico E6 — API e interface

#### T-51 — `POST /reports`
**Tamanho:** M · **Depende de:** T-50

Recebe contrato, medição e catálogo em *multipart*; devolve o PDF ou, havendo achado bloqueante, a
lista de achados.

**Pronto quando:** o caminho feliz devolve PDF e o caminho bloqueado devolve os achados com
severidade — nunca um PDF parcial.

---

#### T-52 — `GET /health`
**Tamanho:** P · **Depende de:** T-51

---

#### T-53 — Cabeçalhos de segurança e CORS
**Tamanho:** P · **Depende de:** T-51

`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, HSTS e `Permissions-Policy`. CORS
sem curinga, com origem por variável de ambiente.

**Pronto quando:** um teste verifica os cabeçalhos e a ausência de `*` na origem.

---

#### T-54 — Limites e verificação de upload
**Tamanho:** M · **Depende de:** T-51

Limite de tamanho e verificação de tipo **por assinatura de arquivo**, não por extensão.

**Pronto quando:** um `.pdf` que na verdade é ZIP é rejeitado.

---

#### T-55 — Tela de upload `[paralelo]`
**Tamanho:** M · **Depende de:** T-01

Rota única com três campos de upload, usando o design system do TRIADE.

---

#### T-56 — Painel de achados `[paralelo]`
**Tamanho:** M · **Depende de:** T-55

Separar visualmente o que bloqueia do que apenas avisa.

**Pronto quando:** um achado bloqueante impede o download na interface, não só na API.

---

#### T-57 — Download e tratamento de erro `[paralelo]`
**Tamanho:** M · **Depende de:** T-56

**Pronto quando:** falha de rede e erro do servidor produzem mensagem legível, sem tela branca.

---

#### T-58 — Teste de ponta a ponta
**Tamanho:** M · **Depende de:** T-54, T-57

**Pronto quando:** os dois arquivos entram pela API e o PDF sai; arquivo corrompido produz
mensagem clara e nenhum PDF.

---

#### T-66 — Teste de fumaça do frontend
**Tamanho:** M · **Depende de:** T-57, T-58

Um teste de navegador com Playwright cobrindo o caminho feliz de ponta a ponta: abrir a tela,
enviar os dois arquivos do piloto, aguardar o processamento e confirmar que o PDF é baixado. Mais
um caso de erro: entrada inválida exibe o painel de achados e **não** oferece download.

Escopo deliberadamente mínimo — dois casos. O objetivo é pegar regressão de integração entre tela
e API, que os testes de backend não enxergam; não é cobrir a interface.

**Pronto quando:** os dois casos passam contra a aplicação subida localmente por `docker compose`.

---

#### T-67 — Catálogo embutido na aplicação
**Tamanho:** M · **Depende de:** T-29, T-32 · **Ref:** ESPEC 001 Anexo B, revisão 14

*Acrescentada em 2026-08-05, depois que o solicitante testou a tela.*

O terceiro campo pedia um arquivo que o usuário não tem e não sabe o que é. O catálogo não
participa da comparação — governa só a apresentação, que é conhecida de antemão. Passa a viver em
`src/infrastructure/catalog/catalogo_padrao.json` e acompanha o código no deploy.

JSON e não XLSX: um aditivo que altere o catálogo aparece linha a linha no diff. Carregado uma vez
por processo e devolvido como tupla, para que uma mutação não contamine execuções seguintes.

O upload segue disponível como campo **opcional** da API, para um contrato com apresentação
diferente da do piloto — fora da tela do uso corrente.

**Pronto quando:** a tela pede dois arquivos; o teste-âncora passa **sem upload**; e um teste prova
que embutido e upload produzem o mesmo relatório — mesmas linhas, quantidades e ordem.

---

## 10. Épico E7 — Empacotamento e entrega

#### T-59 — Dockerfile do backend
**Tamanho:** M · **Depende de:** T-58

Imagem enxuta com `uv`, instalação a partir do lockfile, sem grupo `dev`.

---

#### T-60 — Dockerfile do frontend
**Tamanho:** M · **Depende de:** T-58

Multi-estágio, `output: standalone`, usuário não-root.

---

#### T-61 — Composição
**Tamanho:** P · **Depende de:** T-59, T-60

**Pronto quando:** `docker compose up` sobe backend e frontend em máquina limpa.

---

#### T-62 — Documentação
**Tamanho:** M · **Depende de:** T-61

`README.md` com execução local, **formato do catálogo** e limitações conhecidas — em especial as
três da ESPEC 001 §9.2, §9.3 e a divergência de `I-01`.

---

#### T-63 — Roteiro de demonstração
**Tamanho:** P · **Depende de:** T-62

Roteiro da apresentação ao cliente: arquivos de entrada, o que mostrar na tela, o PDF gerado lado
a lado com o modelo e a lista honesta do que ainda não faz.

---

## 11. Insumos — dono: solicitante

Não são tarefas de engenharia. Nenhum bloqueia o início; todos têm alternativa se não chegarem.

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **I-01** | Decisão sobre `11.027.00001.00`: 10 do contrato ou 6 do modelo | T-50 | O teste-âncora mantém a divergência declarada |
| **I-02** | Revisão das oito células de julgamento do catálogo (T-33) | — | ⏳ Deixou de bloquear: com o catálogo embutido, a revisão vale por contrato e não por execução |
| **I-03** | Aceite visual da amostra de T-07 | — | ⏳ Pendente. **Portão P1 segue aberto** — a renderização já está pronta, então o risco agora é de retrabalho |
| **I-04** | Nome do produto, logotipo e rodapé | T-48 | ⏳ Pendente. Segue com cabeçalho neutro |
| **I-05** | Segundo par contrato + levantamento — competência anterior do mesmo contrato | — | ⏳ Pendente. A generalização segue sem prova real |
| **I-06** | Destino de hospedagem | T-61 | ⏳ Pendente. Entrega em `docker compose`, ainda não executado |

**Sobre o `I-01`:** o aditivo altera três itens presentes no relatório modelo. Dois deles —
`12.030.00001.00` (130 → 60) e `14.070.00001.00` (107 → 120) — aparecem no modelo com o valor
**novo**. Só `11.027.00001.00` (6 → 10) aparece com o valor **antigo**. O modelo é internamente
inconsistente, o que torna a pergunta ao negócio fechada: *confirma que a quantidade correta é 10?*

---

## 12. Ordem de execução sugerida

| Lote | Tarefas | Objetivo |
|---|---|---|
| **1** | T-01 … T-06 | Repositório operante e fixtures no lugar |
| **2** | T-07 + T-32 | Abrir o portão P1 e colocar o catálogo em revisão cedo — os dois insumos que dependem de terceiros |
| **3** | T-08 … T-13, T-64, T-65 | Domínio pronto e andaime de testes no lugar, destravando E2 e E3 em paralelo |
| **4** | T-14 … T-23 ‖ T-24 … T-31 | Extratores; se houver dois desenvolvedores, um por trilha |
| **5** | T-34 … T-43 | Reconciliação — o primeiro momento em que existe um relatório |
| **6** | T-44 … T-50 | Renderização e o teste-âncora |
| **7** | T-51 … T-58, T-66 | API e interface, com o frontend já adiantado desde o lote 1 |
| **8** | T-59 … T-63 | Empacotamento e demonstração |

O lote 2 é o mais importante do ponto de vista de risco: **T-07 e T-32 produzem os insumos que
dependem de resposta de terceiros**, e quanto antes saírem, menor a chance de virarem espera no
fim do projeto.

---

## 13. Definição de pronto global

1. `uv run pytest` passa integralmente, incluindo o teste-âncora de T-50.
2. `ruff`, `mypy` e `bandit -ll -r src/` passam sem apontamentos.
3. O relatório reproduz **54 das 55 linhas** do modelo célula a célula, com a divergência única
   declarada e rastreável a `I-01`.
4. Duas execuções com as mesmas entradas produzem PDFs de conteúdo idêntico.
5. Toda regra `R-*` e toda validação `V-*` da ESPEC 001 tem teste que a exercita pelo identificador.
6. `docker compose up` sobe a aplicação em máquina limpa e processa os arquivos do piloto.
7. Entrada inválida produz mensagem clara e nenhum PDF.
8. Nenhum dado pessoal versionado — a fixture não contém a aba `Usuários`.
