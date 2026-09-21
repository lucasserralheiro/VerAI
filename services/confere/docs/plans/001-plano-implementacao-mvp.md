# PLANO 001 — Implementação do MVP de Análise de Medição Contratual

| | |
|---|---|
| **Especificação** | [ESPEC 001](../specs/001-mvp-analise-medicao.md) |
| **Referência de arquitetura** | [TRIADE](../triade_referencia/README.md) |
| **Versão** | 1.1 — 2026-08-05 |
| **Estado inicial** | Repositório sem código; apenas `docs/` e os arquivos do caso-piloto |
| **Estado atual** | **Executado.** Ver §13 para o resultado de cada portão e o que se provou errado |

---

## 1. Como ler este plano

O plano é organizado em **fases (F0–F7)**, cada uma entregável e verificável isoladamente. Toda
fase declara objetivo, tarefas (`T-nn`), critério de verificação e dependências. A verificação é
sempre um comando que passa ou falha — nunca "está pronto".

Tarefas marcadas **[risco]** concentram incerteza técnica e devem ser atacadas cedo. Tarefas
marcadas **[paralelo]** não bloqueiam o caminho crítico.

O sequenciamento segue um princípio: **provar o mais difícil primeiro**. Se a extração da tabela
do contrato não atingir 100% de cobertura, todo o resto perde sentido — logo ela vem antes da
interface, do empacotamento e de qualquer polimento.

---

## 2. Decisões de engenharia tomadas neste plano

A ESPEC 001 deixou pontos técnicos em aberto. Como engenheiro responsável, tomo as decisões
abaixo para destravar a implementação. Todas são revisáveis, e cada uma traz a alternativa
descartada.

### D-01 — ReportLab para a geração do PDF

**Decisão:** gerar o PDF programaticamente com ReportLab, como previsto na ESPEC 001 §7.3.

**Alternativa descartada:** preencher um template XLSX e converter com LibreOffice *headless*.
Daria fidelidade visual superior — cores, bordas e sombreamento viriam prontos do template — mas
custa uma imagem de container acima de 1 GB, exige fixar a fonte usada sob pena de deslocamento
silencioso de colunas, e transforma o container em dependência da suíte de testes.

**Razão:** o critério de aceite da ESPEC 001 §10 é **identidade de conteúdo célula a célula**, não
equivalência de pixels. ReportLab satisfaz o critério com container leve e testes rápidos. A rota
do template fica registrada como contingência em §9.

### D-02 — Formatação numérica declarada por item

**Decisão:** acrescentar a coluna `formato_quantidade` ao catálogo, com valores `MILHAR` ou
`SIMPLES`, e formatar cada célula conforme a entrada correspondente.

**Motivo:** o relatório modelo **é inconsistente**. Na página 3 convivem:

```
14.023.00002.00  ACESSO A REDE PRODAM ...   USUÁRIO/MÊS     1500    1012      ← sem separador
14.024.00006.00  ARMAZENAMENTO ... NAS      GB/MÊS         4.000   3.265,64   ← com separador
```

A regra `R-MED-04` da ESPEC 001 — sempre pt-BR com separador de milhar — produziria `1.500` e
**reprovaria o teste-âncora**. Como o objetivo declarado é reproduzir o documento atual, a
formatação precisa ser um atributo do item, não uma regra global.

**Emenda proposta à ESPEC 001:** substituir `R-MED-04` pelo texto acima. Registrada em §10.

### D-03 — Conferência da extração por checksum do contrato

**Decisão:** a validação `V-CTR-03` verifica a extração contra o **total declarado no próprio
contrato**. A tabela de itens encerra com uma linha `TOTAL: BRL 10.637.425,00`, e cada linha traz
preço unitário, quantidade e meses. Recalcular `Σ (preço × quantidade × meses)` e comparar com o
total declarado prova a extração de ponta a ponta.

**Razão:** é a diferença entre "extraí alguma coisa" e "extraí tudo, corretamente". Uma linha
perdida por quebra de célula altera o total e a validação falha alto — exatamente o que a ESPEC
001 §9.4 exige ao proibir zeros silenciosos.

### D-04 — Fixture sem a aba `Usuários`

**Decisão:** a planilha versionada como fixture de teste é gerada a partir da original **removendo
a aba `Usuários`**, que contém 1.021 linhas de registros nominais de servidores públicos. A
planilha íntegra permanece fora do repositório.

**Razão:** o MVP lê exclusivamente a aba `Levantamento` (ESPEC 001 §4.2), então nada se perde para
os testes. Commitar dados pessoais os fixa permanentemente no histórico do Git, e um repositório é
o pior lugar para exercer direito de exclusão.

### D-05 — Semente do catálogo derivada do relatório modelo

**Decisão:** o catálogo do contrato-piloto **não será digitado à mão**. Um script de uso único
extrai as 55 linhas das páginas 2–3 do relatório modelo — que já trazem ordem, grupo, seção,
código, descrição e unidade — e emite o XLSX de catálogo. Restam três colunas para revisão humana:
`qualificador`, `tipo_quantidade` e `formato_quantidade`.

**Razão:** a ESPEC 001 §11 tratou o catálogo como trabalho manual de preenchimento. Não é: a
informação já existe estruturada no PDF modelo. Isso reduz o insumo de 55 linhas digitadas para
uma revisão de três colunas, e elimina a classe de erro mais provável — erro de digitação de código.

### D-06 — Toolchain espelhando o TRIADE

| Camada | Escolha |
|---|---|
| Python | 3.12, gerenciado por `uv` com `uv.lock` versionado |
| Qualidade | `ruff` (lint), `mypy` (tipos), `pytest` (testes), `bandit` (SAST) |
| Frontend | Next.js 15 + TypeScript + Tailwind, `pnpm` |
| Hook local | `pre-commit` versionado em `scripts/git-hooks/`, instalado por script |
| Container | Um Dockerfile por *deployable*, multi-estágio no frontend |

**Razão:** coerência de portfólio e reaproveitamento direto do design system. Sem PostgreSQL,
Alembic, Entra ID ou serviços Azure — a ESPEC 001 §7.2 os excluiu.

---

## 3. Portões de decisão

Três pontos onde o plano para e exige avaliação antes de seguir.

| Portão | Momento | Critério | Resultado |
|---|---|---|---|
| **P1 — Fidelidade** | Fim da F0 | Amostra aceita pelo negócio como visualmente equivalente ao modelo | ⏳ **Em aberto.** A amostra existe (`saida/amostra-p1.pdf`) e a geometria foi medida no modelo, não arbitrada — página, colunas, fonte e cores conferem. Falta o aceite humano (insumo `I-03`) |
| **P2 — Extração** | Fim da F2 | Checksum confere e todas as linhas foram extraídas | ✅ **Fechado.** 60 de 60 linhas; soma = `BRL 10.637.425,00` = total declarado |
| **P3 — Aceite** | Fim da F5 | Teste-âncora com 54 de 55 linhas idênticas | ✅ **Fechado.** E com o catálogo embutido, sem upload |

---

## 4. Fases

### F0 — Fundação e prova de fidelidade

**Objetivo:** repositório operante e a dúvida visual resolvida antes de qualquer investimento.

| # | Tarefa | Obs. |
|---|---|---|
| T-01 | `git init`, `.gitignore`, `README.md`, estrutura `backend/` e `frontend/` | |
| T-02 | `pyproject.toml` com dependências e grupo `dev`; `uv.lock` | D-06 |
| T-03 | Configurar `ruff`, `mypy`, `pytest` (`pythonpath = ["src"]`) e `bandit` | |
| T-04 | Hook `pre-commit` + `scripts/install-hooks.sh` | |
| T-05 | Gerar a fixture sanitizada da planilha, sem a aba `Usuários` | D-04 |
| T-06 | Versionar contrato e relatório modelo como fixtures | |
| T-07 | **[risco]** Amostra em ReportLab: 3 seções, 8 linhas, cabeçalho e rodapé | **P1** |

**Verificação:** `uv run pytest` e `uv run ruff check` executam em repositório limpo; o PDF de
amostra é gerado e submetido à avaliação do negócio.

**Tamanho:** P — 2 a 3 dias.

---

### F1 — Domínio

**Objetivo:** o vocabulário do problema expresso em código, sem nenhuma dependência técnica.

| # | Tarefa |
|---|---|
| T-08 | `ServiceCode` — *value object* que valida o formato `NN.NNN.NNNNN.NN` |
| T-09 | `Quantity` — decimal com formatação `MILHAR`/`SIMPLES` (D-02) |
| T-10 | Entidades `ContractItem`, `MeasurementItem`, `CatalogEntry` |
| T-11 | Agregados `Report`, `ReportSection`, `ReportLine` |
| T-12 | *Ports*: `IContractExtractor`, `IMeasurementReader`, `ICatalogReader`, `IReportRenderer`, `IValidation` |
| T-13 | `ValidationFinding` com severidade `BLOQUEIA`/`AVISA` |

**Verificação:** testes de domínio passam; `grep -r "infrastructure\|fastapi\|pdfplumber" src/domain/`
não retorna nada.

**Tamanho:** P — 2 dias. **Depende de:** F0.

---

### F2 — Extrator do contrato ⚠️ caminho crítico

**Objetivo:** transformar as páginas 26–29 do PDF em itens confiáveis. É a fase de maior risco da
ESPEC 001 (§9.4) e concentra o esforço.

| # | Tarefa | Obs. |
|---|---|---|
| T-14 | Localizar a tabela de itens por âncora de conteúdo, não por número de página fixo | |
| T-15 | **[risco]** Extração por coordenada de palavra: derivar as fronteiras de coluna e atribuir cada palavra a uma coluna por posição X | núcleo |
| T-16 | **[risco]** Reconstrução de células multilinha: uma linha de item começa no padrão de código; linhas seguintes sem código são continuação e concatenam nas colunas correspondentes | |
| T-17 | Tratar item dividido entre páginas | |
| T-18 | Converter números no padrão pt-BR (`4.000,00` → `4000.00`) com `Decimal`, nunca `float` | |
| T-19 | Discriminar linhas de mesmo código pelo sufixo da descrição, produzindo a chave `(codigo, qualificador)` | `R-CTR-02` |
| T-20 | Conferência cruzada com `extract_tables()`; divergência vira achado | |
| T-21 | **Checksum:** `Σ (preço × quantidade × meses)` contra o `TOTAL` declarado | D-03, `V-CTR-03` |
| T-22 | `V-CTR-01` e `V-CTR-02` | |
| T-23 | Testes de integração contra o PDF real | **P2** |

**Verificação:** todas as linhas de item extraídas com código, descrição, unidade e quantidade
completos; checksum confere; `10.050.00001.00` soma 4.780 (300 + 4.000 + 480) e
`14.025.00011.00` produz duas entradas distintas, `IT0101` e `SG0721`.

**Tamanho:** G — 4 a 6 dias. **Depende de:** F1.

> **Por que esta fase é grande.** As duas abordagens óbvias falham no arquivo real: regex sobre
> linhas de texto resolve 15 de 60 linhas, e `extract_tables()` resolve 55 de 57, perdendo
> `12.074.00005.00` e `14.048.00008.00` por quebra de célula. A medição está na ESPEC 001 §9.4.
> A meta é 100%, e é o checksum de T-21 que a torna verificável.

---

### F3 — Leitores da medição e do catálogo

**Objetivo:** as outras duas entradas, ambas de risco baixo.

| # | Tarefa | Obs. |
|---|---|---|
| T-24 | Percorrer a aba `Levantamento` identificando blocos de seção e linhas de item | |
| T-25 | Localizar o código **por padrão em qualquer coluna** da linha, nunca por posição fixa | ESPEC §4.2 |
| T-26 | Preservar o texto bruto da célula ao lado do valor convertido, para não perder `PACOTE` e `Perfil D` | `R-REC-04` |
| T-27 | **Desempate de duplicidade:** prevalece a ocorrência cujo título do bloco **ou** descrição contenha `DESCONTANDO RECURSOS DE DESENVOLVIMENTO` | `R-MED-02` |
| T-28 | Extrair data do levantamento e contrato de referência do cabeçalho | |
| T-29 | Leitor do catálogo com validação de esquema e de duplicidade | `V-CAT-01` |
| T-30 | `V-MED-01` e `V-MED-02` | |
| T-31 | Testes contra a planilha real | |
| T-32 | **[paralelo]** Script de semente do catálogo a partir do relatório modelo | D-05 |
| T-33 | **[paralelo]** Revisão humana das colunas `qualificador`, `tipo_quantidade` e `formato_quantidade` | insumo de negócio |

**Verificação:** `14.049.00047.00` retorna **2** e não 4; `14.024.00005.00` retorna **762,55** e
não 1.097,55; o catálogo semente carrega com as 55 entradas visíveis e as 3 da Seção A marcadas
como não exibidas.

**Tamanho:** M — 3 a 4 dias. **Depende de:** F1. **Paralela a:** F2.

---

### F4 — Reconciliação e validações

**Objetivo:** as três fontes viram um relatório em memória.

| # | Tarefa | Obs. |
|---|---|---|
| T-34 | Caso de uso `GenerateMeasurementReport`, dirigido pelo catálogo | `R-CAT-01` |
| T-35 | Resolver quantidade contratada: somar quando não houver qualificador, casar quando houver | `R-CTR-02` |
| T-36 | Resolver quantidade medida, com `0` e aviso quando ausente | `R-MED-03` |
| T-37 | Aplicar `tipo_quantidade = PERFIL_PACOTE` como 1/1 | `R-REC-04` |
| T-38 | Omitir itens com quantidade contratada 0 | `R-REC-01` |
| T-39 | Suprimir seções que ficarem vazias | `R-CAT-02` |
| T-40 | Aplicar `descricao_exibicao` quando presente | `R-CTR-03` |
| T-41 | `V-CAT-02`, `V-CAT-03`, `V-REC-01`, `V-REC-02` | uma validação por arquivo |
| T-42 | Container de injeção de dependências | |
| T-43 | Testes: uma regra `R-*` por teste, uma validação `V-*` por teste | |

**Verificação:** com as três entradas do piloto, o relatório em memória tem **22 seções e 55
linhas** na ordem do catálogo; `V-REC-01` acusa a divergência de `11.027.00001.00` (contrato 10,
planilha 10, modelo 6).

**Tamanho:** M — 3 a 4 dias. **Depende de:** F2 e F3.

---

### F5 — Renderização do PDF

**Objetivo:** o entregável.

| # | Tarefa | Obs. |
|---|---|---|
| T-44 | Cabeçalho com título, data do levantamento e contrato de referência, repetido por página | ESPEC §8 |
| T-45 | Faixas de grupo e de seção, com cabeçalho de colunas repetido a cada seção | |
| T-46 | Tabela de 5 colunas com larguras fixas e quebra de descrições longas | |
| T-47 | Formatação numérica por item | D-02 |
| T-48 | Rodapé com contrato, proposta de origem e carimbo de geração | `R-CTR-05` |
| T-49 | Determinismo: sem data no conteúdo comparado, sem identificador aleatório | ESPEC §10 CA-7 |
| T-50 | **Teste-âncora**: extrair as linhas do PDF gerado e comparar célula a célula com as páginas 2–3 do modelo | **P3** |

**Verificação:** teste-âncora com **54 de 55 linhas idênticas** em código, descrição, unidade e as
duas quantidades; a 55ª é a divergência declarada em `11.027.00001.00`. Duas execuções produzem
PDFs de conteúdo idêntico.

**Tamanho:** M — 4 a 5 dias. **Depende de:** F4 e do portão P1.

---

### F6 — API e interface

**Objetivo:** o fluxo utilizável por quem não abre terminal.

| # | Tarefa |
|---|---|
| T-51 | `POST /reports` — recebe contrato e levantamento em *multipart* (mais o catálogo, opcional), devolve o PDF ou os achados de validação |
| T-52 | `GET /health` |
| T-53 | Cabeçalhos de segurança e CORS sem curinga, no padrão do TRIADE |
| T-54 | Limite de tamanho de upload e verificação de tipo por assinatura de arquivo, não por extensão |
| T-55 | **[paralelo]** Tela única com três campos de upload |
| T-56 | **[paralelo]** Painel de achados, separando o que bloqueia do que apenas avisa |
| T-57 | **[paralelo]** Download do PDF e tratamento de erro legível |
| T-58 | Teste de ponta a ponta pela API |

**Verificação:** o fluxo completo roda no navegador; enviar um arquivo corrompido produz mensagem
clara e **nenhum PDF**.

**Tamanho:** M — 3 a 4 dias. **Depende de:** F5 (backend) e F0 (frontend, paralelizável desde já).

---

### F7 — Empacotamento e entrega

| # | Tarefa |
|---|---|
| T-59 | `Dockerfile` do backend, com `uv` e imagem enxuta |
| T-60 | `Dockerfile` do frontend, multi-estágio, `output: standalone`, usuário não-root |
| T-61 | `docker-compose.yml` para subir os dois com um comando |
| T-62 | `README.md` com execução local, formato do catálogo e limitações conhecidas |
| T-63 | Roteiro de demonstração para a apresentação ao cliente |

**Verificação:** em máquina limpa, `docker compose up` sobe a aplicação e processa os arquivos do
piloto.

**Tamanho:** P — 2 dias. **Depende de:** F6.

---

## 5. Caminho crítico e paralelização

```
F0 ──► F1 ──┬──► F2 (extrator do contrato) ──┬──► F4 ──► F5 ──► F6 ──► F7
            └──► F3 (medição + catálogo) ────┘
                    │
                    └── T-32/T-33 catálogo semente ── [paralelo, insumo de negócio]

F0 ──► T-55/T-56/T-57 frontend ───────────────────────────► F6
```

**Caminho crítico:** F0 → F1 → **F2** → F4 → F5 → F6 → F7.

| Alocação | Duração estimada |
|---|---|
| 1 desenvolvedor | 23 a 30 dias úteis — 5 a 6 semanas |
| 2 desenvolvedores | 15 a 19 dias úteis — 3 a 4 semanas |

Com dois desenvolvedores, a divisão natural é **F2 para um** e **F3 + frontend para o outro**,
convergindo na F4. A estimativa pressupõe dedicação integral e cobre implementação e testes, não
homologação com o cliente.

---

## 6. Estrutura final

```
Faturamento_v3/
├── backend/
│   ├── pyproject.toml · uv.lock · Dockerfile
│   ├── src/
│   │   ├── api/            main.py · routers/reports.py · schemas.py
│   │   ├── application/    use_cases/generate_measurement_report.py · dtos/
│   │   ├── domain/         entities/ · value_objects/ · interfaces/
│   │   └── infrastructure/ contract/ · measurement/ · catalog/ · report/
│   │                       validations/ · di/
│   └── tests/              test_extractor_contract.py · test_reader_measurement.py
│                           test_catalog.py · test_reconciliation.py
│                           test_validations.py · test_report_render.py
│                           test_anchor_fidelity.py · fixtures/
├── frontend/               src/app/page.tsx · src/design-system/ · Dockerfile
├── scripts/                install-hooks.sh · git-hooks/pre-commit
│                           seed_catalog.py   (uso único, D-05)
├── docs/                   specs/ · plans/ · triade_referencia/ · documentos/
└── docker-compose.yml
```

---

## 7. Estratégia de testes

| Nível | Alvo | Onde |
|---|---|---|
| Unitário | Cada `R-*` e cada `V-*` isoladamente | `test_reconciliation.py`, `test_validations.py` |
| Integração | Extratores contra os arquivos reais | `test_extractor_contract.py`, `test_reader_measurement.py` |
| Contrato de camada | `domain/` não importa framework nem infraestrutura | `test_architecture.py` |
| Ponta a ponta | Dois arquivos → PDF pela API | `test_api_e2e.py` |
| **Âncora** | PDF gerado × páginas 2–3 do modelo, célula a célula | `test_anchor_fidelity.py` |

O teste-âncora é o coração do aceite. Ele nasce com **uma divergência esperada e declarada** —
`11.027.00001.00` — e qualquer outra diferença reprova a suíte. Se a divergência for resolvida
pelo negócio (§8, insumo I-01), a expectativa some do teste e o aceite passa a exigir 55 de 55.

**Convenção:** nenhuma regra de negócio entra sem teste que a exercite pelo identificador da
ESPEC 001. Um teste por regra torna o rastro requisito → código → teste navegável, no padrão de
*guardrails* do TRIADE.

---

## 8. Insumos necessários do negócio

Itens que a engenharia não resolve sozinha. Nenhum bloqueia o início.

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **I-01** | Decisão sobre `11.027.00001.00`: 10 do contrato ou 6 do modelo | F5 | O teste-âncora mantém a divergência declarada e o relatório exibe 10 |
| **I-02** | Revisão das três colunas de julgamento do catálogo semente (T-33) | F4 | F4 roda com valores propostos pela engenharia, sujeitos a retrabalho |
| **I-03** | Aceite visual da amostra da F0 (portão P1) | F5 | Risco de refazer a renderização depois de pronta |
| **I-04** | Identidade visual: nome do produto, logotipo e rodapé | F5 | Renderização com cabeçalho neutro |
| **I-05** | Um segundo par contrato + levantamento, de outra competência ou contrato | F6 | A generalização do catálogo fica sem prova real |
| **I-06** | Destino de hospedagem | F7 | Entrega fica em `docker compose`, executável em rede interna |

---

## 9. Riscos e contingências

### 9.1 Fidelidade visual insuficiente (portão P1)

Se o negócio recusar a amostra em ReportLab, a contingência é a rota do template: reproduzir as
páginas 2–3 em XLSX, preencher as células com `openpyxl` e converter com LibreOffice *headless*
em container. Custa uma imagem acima de 1 GB, exige fixar a fonte sob pena de deslocamento
silencioso de colunas, e depende de obter o arquivo que originou o relatório modelo.

**Impacto se acionada:** +4 a 6 dias e um item novo em §8 (obter o XLSX de origem). Por isso o
portão fica na F0 — decidir cedo custa pouco, decidir na F5 custa a fase inteira.

### 9.2 Demais riscos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Extração do contrato não atinge 100% | Média | **Alto** | Checksum de T-21; portão P2; extração por coordenada em vez de texto |
| Layout da planilha varia entre competências | Média | Médio | Ancoragem por rótulo e código, nunca por número de linha (T-25) |
| Catálogo desatualizado após novo aditivo | Alta | Baixo | `V-CAT-02` avisa sobre código do contrato ausente do catálogo |
| Divergências adicionais entre modelo e fontes | Média | Médio | O teste-âncora expõe cada uma nominalmente, em vez de mascarar |
| Regras derivadas de um único caso-piloto | **Alta** | Médio | I-05: um segundo contrato antes de declarar o MVP generalizável |

O último merece franqueza: **todas as regras da ESPEC 001 foram derivadas de uma única
competência de um único contrato.** O catálogo isola boa parte da variação, mas só um segundo par
de arquivos prova que o desenho generaliza.

---

## 10. Emenda proposta à ESPEC 001

Uma alteração de especificação decorre deste plano e precisa ser incorporada:

> ✅ **Aplicada à ESPEC 001 em 2026-08-05** (Anexo B, revisão 15).
>
> **`R-MED-04` (revisada).** A formatação de cada quantidade é definida pela coluna
> `formato_quantidade` do catálogo: `MILHAR` aplica separador de milhar e duas casas decimais
> quando houver parte fracionária; `SIMPLES` omite o separador de milhar. O separador decimal é
> sempre a vírgula. A regra anterior — sempre pt-BR com separador — é incompatível com o relatório
> modelo, que grafa `1500` e `4.000` na mesma página.

Acompanha a inclusão da coluna `formato_quantidade` na tabela do catálogo em §4.3 da ESPEC 001.

---

## 11. Definição de pronto

O MVP está pronto quando, cumulativamente:

1. `uv run pytest` passa integralmente, incluindo o teste-âncora.
2. `uv run ruff check`, `uv run mypy src/` e `uv run bandit -ll -r src/` passam sem apontamentos.
3. O relatório gerado reproduz **54 das 55 linhas** do modelo célula a célula, com a única
   divergência declarada e rastreável a `I-01`.
4. Duas execuções com as mesmas entradas produzem PDFs de conteúdo idêntico.
5. Toda regra `R-*` e toda validação `V-*` da ESPEC 001 tem teste que a exercita pelo identificador.
6. `docker compose up` sobe a aplicação em máquina limpa e processa os arquivos do piloto.
7. Entrada inválida produz mensagem clara e nenhum PDF.
8. O `README.md` documenta execução, formato do catálogo e limitações conhecidas.

---

## 12. Ação imediata

Ordem de partida, sem depender de nenhum insumo externo:

1. **T-01 a T-06** — repositório, toolchain, hook e fixtures. Meio dia.
2. **T-07** — a amostra em ReportLab. Abre o portão P1 e é o insumo da conversa com o negócio.
3. **T-32** — o script de semente do catálogo, que produz o insumo I-02 e o coloca em revisão cedo.
4. **F1** — o domínio, que destrava F2 e F3 em paralelo.

A conversa com o negócio sobre `I-01` (a divergência do certificado) deve começar **agora**: é a
única pendência capaz de alterar o critério de aceite, e responder cedo evita reescrever o
teste-âncora depois de pronto.

---

## 13. Fechamento — o que o plano acertou e o que errou

*Acrescentado em 2026-08-05, após a execução completa.*

### Resultado

As oito fases foram executadas, com **169 testes de backend e 2 de navegador**. A estimativa era de
23 a 30 dias úteis para um desenvolvedor; o esforço real não é comparável, por ter sido executado em
condições diferentes das previstas.

### O que se confirmou

| Previsão | Resultado |
|---|---|
| **F2 é o caminho crítico e concentra o risco** | Confirmado. Foi a fase que exigiu investigar a estrutura do PDF antes de escrever qualquer linha |
| **D-01 — ReportLab basta** | Confirmado. A contingência §9.1 não foi acionada: página, colunas, fonte e cores conferem com o modelo |
| **D-02 — formatação por item** | Confirmado, e essencial. Uma regra global reprovaria o teste-âncora |
| **D-03 — checksum** | Confirmado, e foi o que fechou o portão P2 |
| **D-05 — catálogo derivado, não digitado** | Confirmado. Reduziu 55 linhas de digitação a 8 células de julgamento |

### O que se provou errado

**A fórmula do checksum estava errada em D-03.** O plano previa `Σ (preço × quantidade × meses)`,
mas a fórmula **varia por item**: em `HORA/HOMEM` a quantidade já é o total do período e os meses
não multiplicam; em serviços mensais, multiplicam. A soma dos **totais declarados linha a linha**
dispensa interpretar a regra de preço e prova o mesmo.

**A mitigação de §9.4 não era a melhor.** O plano previa extração por coordenada de palavra com
`extract_tables()` como conferência cruzada. A grade da tabela, porém, **está desenhada no PDF** —
usá-la é mais direto e faz a descrição multilinha cair naturalmente numa célula. A conferência
cruzada ficou superada pelo checksum.

**T-44 supunha cabeçalho repetido em todas as páginas.** O modelo não o repete: a página 3 começa
direto nas linhas de item.

**A ESPEC §11 tratava o catálogo como insumo de negócio permanente.** Era, enquanto ele fosse
enviado por upload. Ao virar embutido (ESPEC Anexo B, revisão 14), deixou de ser insumo recorrente.

### O que faltou prever

**A experiência de uso do catálogo.** O plano cuidou de onde o catálogo viveria — SQLite, YAML,
upload — e não de **quem o entregaria na hora de usar**. O resultado foi uma tela pedindo um arquivo
que o usuário não tem e não sabe o que é. O erro só apareceu quando o solicitante testou.

**A tradução de erros de biblioteca.** Nenhuma tarefa previa converter `BadZipFile` e
`PDFSyntaxError` em erro de domínio, e sem isso um arquivo corrompido escapava como erro 500.

**Uma tarefa de fixtures.** T-05 e T-06 criavam os arquivos, mas nada os ligava ao pytest — o
`conftest.py` entrou depois, como T-65.

### Pendências

| # | Pendência | Onde |
|---|---|---|
| `I-01` | Confirmar a quantidade do certificado digital: 10 ou 6 | §8 |
| `I-03` | Aceite visual da amostra — **portão P1 segue aberto** | §8 |
| `I-05` | Segundo par de arquivos, para provar a generalização | §8 |
| — | `docker compose up` nunca executado: não havia daemon no ambiente | §11, item 6 |
