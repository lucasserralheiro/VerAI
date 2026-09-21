# PLANO 009 — Implementação da Análise da Medição

| | |
|---|---|
| **Especificação** | [ESPEC 009](../specs/009-analise-da-medicao.md) v1.0 |
| **Versão** | 1.1 — 2026-08-10 — executado; duas emendas em §10 |
| **Estado inicial** | 308 testes de backend verdes; teste-âncora em 54 de 55; grid com 36 linhas em 22 seções; 4 suítes de acessibilidade no navegador; ~36 s por geração |

---

## 1. O princípio que ordena este plano

A ESPEC 009 §16 diz, com razão, que **este incremento não calcula nada novo**. Quatro comparações
entre dois `Decimal` que já existem em memória. Se o plano fosse dirigido pela dificuldade da
classificação, caberia numa tarde.

Ele não é. O trabalho está em três lugares que a classificação não toca:

1. **Existe um artefato de referência produzido fora da aplicação**, e ele **discorda** do que a
   aplicação produz — em dois pontos, ambos conhecidos e nenhum acidental (ESPEC 009 §2).
2. **Um formato de saída novo entra no projeto.** Até hoje a infraestrutura de escrita produzia um
   `.docx`; passa a produzir também um `.xlsx`.
3. **A tela cresce ~92 linhas acima de um grid de 36**, e o grid perde um bloco que **hoje tem teste
   escrito cobrando que ele exista**.

Daí o princípio:

> **A referência vira instrumento antes de virar alvo.**

A F0 lê o `Relatorio_Analise_Medição.xlsx`, congela suas quatro categorias como fixture e monta o
comparador — **antes de existir classificação, renderizador ou tela**. A F1 implementa a
classificação e o comparador roda contra o domínio, em memória. O portão P1 exige que a diferença
seja **exatamente duas**: o item crítico a mais e o `11.027.00001.00`.

Se a diferença for outra — uma linha a mais numa categoria, uma a menos noutra — a leitura das
regras `R-ANA-01` a `R-ANA-04` está errada, e está errada **antes** de custar um renderizador, uma
resposta de API e um painel. É a mesma inversão do PLANO 008, com uma vantagem que aquele não tinha:
aqui o instrumento não precisa ser construído do zero, porque **o gabarito já existe em disco**.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P1 — A classificação reproduz o gabarito** | Fim da F1 | O comparador roda sobre o domínio e a diferença contra a referência é **exatamente duas**: o item crítico de `D-01` e o `11.027.00001.00` com 10 no lugar de 6. Nem uma linha a mais, nem uma a menos | As regras foram lidas errado. Corrigir antes de escrever renderizador, API ou tela |
| **P2 — O arquivo confere e abre** | Fim da F2 | As cinco abas conferem célula a célula com a referência, com as duas divergências declaradas; o arquivo **abre no Excel** e a coluna numérica **soma** | Não seguir para a API com um formato que ninguém abriu |
| **P3 — O conjunto não regrediu** | Fim da F5 | Teste-âncora do `.docx` intacto; grid com **36 linhas em 22 seções**; o item sem previsão contratual aparece **exatamente uma vez** na tela; `axe` verde nos quatro estados; tempo medido | Não entregar |

**P1 é o portão barato que protege os caros.** Ele custa meia hora de execução e responde a única
pergunta que, respondida errado, invalida tudo o que vem depois.

**P2 existe por causa da ESPEC 003.** Lá, seis defeitos de documento passaram por toda a suíte e só
apareceram quando alguém abriu o Word. Um `.xlsx` que o `openpyxl` relê perfeitamente pode ser o
mesmo arquivo que o Excel recusa a abrir, ou que abre com todas as quantidades como texto — o
defeito clássico de relatório em planilha, e o motivo de `R-XLS-05` existir.

---

## 3. Fases

### F0 — A referência vira instrumento

**Objetivo:** poder provar a classificação contra um gabarito externo. **Nenhum arquivo de `src/` é
tocado nesta fase.**

| # | Tarefa | Ref. |
|---|---|---|
| T-501 | Copiar `docs/documentos/Relatorio_Analise_Medição.xlsx` para `backend/tests/fixtures/analise_referencia.xlsx` — nome ASCII, como as demais fixtures. **Conferir que não há dado pessoal**: a planilha traz código, descrição e quantidade, e nenhuma aba de usuários | §2 |
| T-502 | Leitor da referência: as cinco abas viram estrutura normalizada — categoria, código, descrição, contratado, medido, saldo | §2 |
| T-503 | Teste de auto-conferência do leitor: a referência tem **0 / 20 / 16 / 19**, soma **55**, e o resumo declarado bate com as linhas contadas nas abas | §2.3 |
| T-504 | O comparador: recebe uma classificação e a referência, devolve a **lista de diferenças** — não um booleano. Diferença sem nome não orienta correção | **P1** |
| T-505 | Registrar a linha vermelha: as duas divergências esperadas, por código, com o motivo e o insumo que as sustenta | **P1** |

**Verificação:** a T-503 passa sobre a fixture, e o comparador da T-504, alimentado com uma
classificação vazia, acusa **55 diferenças** — se acusar menos, ele não está comparando o que diz
comparar.

> **T-503 antes do T-504.** O gabarito é um arquivo que ninguém deste projeto gerou. Antes de
> comparar contra ele, é preciso saber que ele é internamente coerente: que a aba de resumo não
> afirma um número que as abas de detalhe não sustentam. Custa um teste e evita perseguir um defeito
> inexistente no próprio código.

**Tamanho:** M — meio dia.

---

### F1 — Classificação e agregado no domínio `[portão]`

**Objetivo:** a taxonomia da ESPEC 009 §5, sem framework e sem I/O.

| # | Tarefa | Ref. |
|---|---|---|
| T-506 | `Classificacao` como `StrEnum` — `CRITICO`, `MAIOR_RELEVANCIA`, `DIVERGENTE`, `SEM_DIVERGENCIA` | §5 |
| T-507 | `ReportLine.classificacao`, comparando `Decimal` e nunca texto formatado | `R-ANA-01` a `06` |
| T-508 | **[reversível]** `Report.universo_da_analise()` — as linhas do relatório **mais** `sem_previsao_contratual`, **numa função só**. Ver §6.1 | `R-ANA-07`, `D-01` |
| T-509 | `domain/entities/analysis.py`: `AnaliseDaMedicao` com resumo e as quatro situações, sempre as quatro, na ordem de gravidade | `R-API-01`, §8 |
| T-510 | Marca de origem na linha: item vindo de `sem_previsao_contratual` chega identificado até a apresentação | `R-PAN-05`, `R-XLS-04` |
| T-511 | Testes de fronteira: `c<m`, `c>m ∧ m=0`, `c>m ∧ m≠0`, `c=m`, `c=m=0`, e **`117,29` contra `117,2889…`** classificando como divergente | `R-ANA-06`, §5.1 |
| T-512 | Teste do invariante: a soma das quatro contagens é o total do universo — sobre o piloto **e** sobre casos construídos | `R-ANA-05` |
| T-513 | Teste de perfil/pacote: as **cinco** linhas `1/1` caem em *sem divergência* e chegam marcadas | `R-ANA-08`, §6.4 |
| T-553 | Teste da **situação vazia** no agregado: `AnaliseDaMedicao` devolve as quatro situações com `linhas: []` onde não há item. Caso construído — ver §5.4 | `R-API-01` |
| T-514 | **O comparador da F0 rodando sobre o domínio** | **P1** |

**Verificação:** T-514 devolve **duas** diferenças, com os códigos previstos na T-505. Os 308 testes
seguem verdes — nada do que existe é tocado nesta fase.

> **A T-508 é a única tarefa deste plano desenhada para ser revertida.** Ela materializa `D-01`,
> que depende do insumo `I-06`. Se o negócio decidir que o universo são as 55 linhas do relatório,
> a mudança tem de ser **um parâmetro, não uma refatoração** — e é isso que a exigência de "numa
> função só" compra. O teste da T-512 é parametrizado pelos dois universos desde o início.

**Tamanho:** P — três horas. **Encerra:** P1.

---

### F2 — O renderizador XLSX `[portão]`

**Objetivo:** o `Relatorio_Analise_Medição.xlsx`, fiel à referência e legítimo como planilha.

| # | Tarefa | Ref. |
|---|---|---|
| T-515 | Port `IAnaliseRenderer` em `domain/interfaces/ports.py`, ao lado de `IReportRenderer` — o domínio não conhece `openpyxl` | §11 |
| T-516 | `infrastructure/report/xlsx_analise_renderer.py`: as cinco abas, com os nomes do artefato de referência, **sempre presentes, inclusive vazias** | `R-XLS-01` |
| T-517 | Aba `Resumo Executivo`: identificação e o quadro de §8, com a competência por extenso em pt-BR | `R-RES-01` a `04` |
| T-518 | **[risco]** Quantidade em duas colunas — texto formatado e valor numérico. `openpyxl` aceita `Decimal` nativamente, então o valor **não passa por `float`** | `R-XLS-05`, §6.2 |
| T-519 | Marca de perfil/pacote em coluna própria na aba `Sem Divergência`, e marca de sem previsão contratual na aba `Itens Críticos` — o arquivo circula sem a legenda da tela | `R-XLS-03`, `R-XLS-04` |
| T-520 | Registro no `DIContainer`, ao lado de `renderizador()` | §11 |
| T-521 | **Teste-âncora da análise**: célula a célula contra a fixture da T-501, com as duas divergências declaradas no próprio teste, no formato do `test_anchor_fidelity.py` | §13, **P2** |
| T-522 | Teste de determinismo: duas execuções produzem arquivos idênticos | `R-DOC-10` (ESPEC 003) |
| T-554 | Teste da **aba vazia**: sem item na situação, a aba sai só com título e cabeçalho. É o caminho que o piloto não percorre — ver §5.4 | `R-XLS-01` |
| T-555 | Teste da competência: `15/07/2026` → `julho/2026`, com o mês vindo de **tabela própria**, nunca do `locale` do sistema | `R-RES-03` |
| T-523 | **Abrir o arquivo no Excel**: cinco abas, sem aviso de reparo, e a coluna numérica **somando** com `=SOMA()` | **P2**, insumo `K-01` |

**Verificação:** T-521 e T-522 passam; T-523 é conferida por pessoa, não por teste.

> **A T-518 é o ponto em que este arquivo deixa de ser uma imagem da tela e vira planilha.** Uma
> coluna de texto que parece número passa em qualquer comparação célula a célula e falha na primeira
> vez que alguém tenta somá-la — e somar é exatamente o que se faz com uma análise de medição.

**Tamanho:** G — um dia. **Encerra:** P2.

---

### F3 — A resposta da API

**Objetivo:** levar análise e arquivo até a tela, sem quebrar o que já existe.

| # | Tarefa | Ref. |
|---|---|---|
| T-524 | `schemas.py`: `SituacaoDaAnalise`, `Analise`, e `LinhaDoGrid.sem_previsao_contratual` com padrão `false` — **campo aditivo, nada renomeado** | `R-API-02` |
| T-525 | `routers/reports.py`: monta a análise e embute o XLSX em base64, na **mesma passagem** do `.docx`, dentro do mesmo diretório temporário | `R-API-03`, `R-XLS-06` |
| T-526 | Achado bloqueante devolve `422` **sem documento e sem análise** | `R-API-04` |
| T-527 | Teste de API: os dois campos novos existem; `situacoes` traz **as quatro**, inclusive com `quantidade: 0`; o `422` não traz análise | `R-API-01`, `04` |
| T-528 | Medir o **tamanho real** da resposta, com e sem a análise | §6.3 |
| T-529 | Medir o **tempo de ponta a ponta** e comparar com os ~36 s de hoje | §6.3 |

**Verificação:** T-527 passa; T-528 e T-529 produzem números, não impressões.

**Tamanho:** P — três horas.

---

### F4 — O painel na tela

**Objetivo:** o que o protótipo mostra, em código de produção.

| # | Tarefa | Ref. |
|---|---|---|
| T-530 | `lib/types.ts` espelhando os schemas novos; `Estado.pronto` passa a carregar **duas** URLs de blob | §11 |
| T-531 | **[risco]** `api.ts`: segunda URL de blob com o MIME de XLSX; **e o `revoke` das duas** — ver §5.1 | `R-ACE-18` |
| T-532 | `AnaliseMedicaoPanel.tsx`: identificação, quadro-resumo e os quatro blocos | `R-PAN-01` a `04` |
| T-533 | Blocos em `<details>` nativo — crítico e maior relevância abertos | `D-03` |
| T-534 | Situação vazia aparece com contagem zero e sem tabela: "nenhum item crítico" é resultado | `R-PAN-04` |
| T-535 | Marcas: perfil no bloco *sem divergência*, com a contagem sob o título; sem previsão contratual no bloco *crítico* | `R-PAN-05`, `R-PAN-06` |
| T-536 | Segundo botão de download, com nome de arquivo por contrato e competência | `R-ACE-19` |
| T-537 | Tabelas com `scope="col"`, nome acessível e contêiner de rolagem focável — **inclusive o quadro-resumo** | `R-ACE-05`, `09` |
| T-538 | Tokens de severidade na paleta, com o contraste medido em comentário, como a ESPEC 005 fez com `brand` | `R-ACE-01`, §6.2 |
| T-539 | `ResultadoPanel.tsx` monta o painel **entre** a faixa e o grid | `R-PAN-01` |
| T-556 | Teste de **situação vazia na tela**, com resposta sintética por `page.route`, como `estados.ts` já monta o `bloqueado`: contagem zero, sem tabela, bloco presente | `R-PAN-04`, §5.4 |

**Verificação:** a tela reproduz o protótipo revisado; `axe` verde no estado `pronto`; o script de
contraste verde com os tokens novos.

**Tamanho:** G — um dia.

---

### F5 — A revisão do grid e a verificação do conjunto `[portão]`

**Objetivo:** o item sem previsão contratual aparecer **uma vez**, e provar que nada regrediu.

| # | Tarefa | Ref. |
|---|---|---|
| T-540 | **[reversível]** Remover do `DivergenciaGrid` o bloco de sem previsão contratual — ele já está no bloco crítico | `R-PAN-07`, §6.1 |
| T-541 | Retitular o grid para **"Divergências, na ordem do relatório"** | `R-PAN-08` |
| T-542 | **Reescrever** `a11y-estrutura.spec.ts` › "o bloco sem previsão contratual vem antes das seções": o alvo muda, a intenção não — ver §5.2 | ESPEC 008 D-07 |
| T-543 | Teste: o código `14.049.00054.00` aparece **exatamente uma vez** no DOM do estado `pronto` | **P3** |
| T-544 | Nova linha de base de captura nos quatro estados, com `scripts/capturar-baseline.mjs` | ESPEC 008 §9.2 |
| T-545 | `axe` verde nos quatro estados; percurso de teclado alcançando os blocos recolhidos | `R-ACE-04` a `09` |
| T-546 | **Teste-âncora do `.docx` intacto**, 308 testes verdes mais os novos, `tsc --noEmit` e `next build` limpos | **P3** |
| T-547 | Grid com **36 linhas em 22 seções**, inalterado | `R-PAN-09`, **P3** |
| T-557 | Teste de **coerência tela × arquivo**: na mesma execução, as contagens das quatro situações na resposta da API e as linhas das quatro abas de detalhe são iguais | `R-XLS-02` |

**Verificação:** os quatro critérios de P3.

> **T-540 e T-542 andam juntas ou não andam.** O teste que a T-542 reescreve foi escrito para
> garantir a decisão D-07 da ESPEC 008 — que o achado de maior consequência não ficasse depois de 22
> seções. A decisão continua valendo; o que muda é onde o item mora. Apagar o teste seria perder a
> garantia; mantê-lo como está seria travar a entrega num locator.

**Tamanho:** M — meio dia. **Encerra:** P3.

---

### F6 — Documentação

| # | Tarefa |
|---|---|
| T-548 | **ESPEC 002:** registrar a revisão de `R-UI-03` — a posição do bloco, condicionada a `I-06`, como a §12 já fez uma vez |
| T-549 | **ESPEC 009:** status → implementada; §2.3 preenchida com os números **medidos**; §13 com o resultado do âncora da análise |
| T-550 | README: a capacidade nova, o segundo entregável e o tempo de geração medido |
| T-551 | CHANGELOG: o incremento, a decisão `D-01` e o que ela contraria no artefato de referência |
| T-552 | TASKS 009 com o resultado e os desvios |

**Tamanho:** P — duas horas.

---

## 4. Sequência

```
                              ┌─► F2 (XLSX) ──────────────┐
F0 ──► F1 ────────────────────┤                    P2     ├──► F5 ──► F6
   (gabarito)  P1             └─► F3 (API) ─► F4 (tela) ──┘    P3
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | 4 a 5 dias |
| 2 desenvolvedores | 3 dias — F2 em paralelo com F3+F4 |

**F2 e F3+F4 tocam arquivos disjuntos** — `infrastructure/report/` contra `api/` e `frontend/` — e
dependem só do domínio que a F1 entrega. É a única paralelização útil: F0 é pré-requisito de P1, e
a F5 precisa das duas pontas prontas para poder afirmar que o item aparece uma vez só.

---

## 5. A regressão que já está escrita

Este é o ponto em que o plano mais pode se enganar sozinho. A ESPEC 009 §4.2 promete não alterar o
grid — e **três testes existentes quebram assim mesmo**, dois deles por acerto e um por descuido
possível. Foram lidos no repositório, não presumidos.

### 5.1 O `revokeObjectURL` passa a ter dois blobs

`page.tsx` hoje libera **um** blob antes de cada novo envio:

```tsx
if (estado.situacao === "pronto") URL.revokeObjectURL(estado.url);
```

`R-ACE-18` existe porque ~41 páginas de DOCX retidas por geração, pela sessão inteira, foi defeito
real. Com a T-531, `Estado.pronto` passa a carregar **duas** URLs, e esta linha continuaria
liberando uma. **Nenhum teste pega isso** — não há asserção de memória na suíte, e o sintoma só
aparece em uso prolongado.

É o mesmo modo de falha do PLANO 008 D-03: código correto para o mundo anterior, silencioso no novo.

### 5.2 O teste que cobra o bloco que vai sair

`e2e/a11y-estrutura.spec.ts` afirma:

> `expect(ordem, "medir o que não foi contratado é o achado de maior consequência").toBe("antes")`

Ele procura `#sem-previsao` e o compara com a primeira `[id^="secao-"]`. Com `R-PAN-07`, o elemento
`#sem-previsao` **deixa de existir** e o teste falha por `null`, não por regressão. A T-542 o
reescreve para a nova pergunta — *o item aparece uma vez, e antes das seções?* — que é a pergunta
que a decisão D-07 sempre quis fazer.

### 5.3 O que **não** quebra, e é bom saber por quê

| Asserção existente | Sobrevive? | Por quê |
|---|---|---|
| `th:not([scope])` = 0 e tabela sem nome = 0 | **Sim, se a T-537 for feita** | Vale para as tabelas novas também, inclusive o quadro-resumo |
| Nenhum salto de nível de cabeçalho | **Sim** | `h1` → `h2` (resultado) → `h2` (análise) → `h3` (situações) → `h2` (grid) → `h3`/`h4`. Nenhum degrau maior que 1 |
| Toda rolagem horizontal focável e nomeada | **Sim, se a T-537 for feita** | Tabela dentro de `<details>` fechado tem `clientWidth` zero e não entra na varredura — some do teste sem falseá-lo |
| `body [title]` = 0 | **Sim** | O painel não usa `title` em lugar nenhum |
| Região viva montada desde o primeiro render | **Sim** | O painel entra **dentro** do invólucro que já existe |
| Teste-âncora do `.docx` | **Sim** | `R-REC-01` não é tocada. Se quebrar, algo foi entendido errado |

### 5.4 O caminho que o piloto não percorre

Todo teste deste plano, do P1 ao P3, roda sobre **um** par de arquivos. É a limitação que o README
já registra como insumo `I-05`, e aqui ela produz um ponto cego específico e verificável:

> **Com o universo de `D-01`, as quatro situações do piloto têm itens — 1, 20, 16 e 19.** Nenhum
> teste alimentado pelo piloto executa o caminho da **situação vazia**.

E situação vazia não é caso de borda decorativo: são **três regras** que só existem para ela.
`R-PAN-04` diz que "nenhum item crítico" é resultado e tem de aparecer; `R-XLS-01` manda a aba
existir mesmo sem linha; `R-API-01` manda as quatro situações virem sempre. As três descrevem
comportamento que o piloto **nunca aciona** — e a única categoria vazia que este projeto conhece é
a `Itens Críticos` do artefato de referência, que está vazia por engano (§2.1).

Daí T-553, T-554 e T-556 usarem caso **construído**, e não amostrado. É a mesma escolha da T-302 do
PLANO 004: quando o dado real não cobre o caminho, o caminho se cobre com dado feito para isso —
não se declara coberto.

A T-557 fecha o par restante. `R-XLS-02` exige que tela e arquivo não discordem, e o argumento de
que "os dois saem do mesmo agregado" é verdadeiro **hoje**: basta alguém formatar a quantidade num
lugar e não no outro para deixar de ser. Argumento de arquitetura não é teste de regressão.

---

## 6. Três acertos à ESPEC 009

Três afirmações da espec não sobrevivem ao contato com o repositório. Registro em vez de contornar,
seguindo a conduta da ESPEC 007 §13 e do PLANO 008 §6.

### 6.1 `D-01` não é uma decisão de implementação, e o plano não pode fingir que é

A espec recomenda o universo de 56 e registra `I-06` como não bloqueante. **Está certa**, e é
justamente por isso que o plano precisa tornar a reversão barata: a T-508 concentra a decisão numa
função, e a T-512 é parametrizada pelos dois universos **desde o primeiro teste**.

Sem essa disciplina, a resposta "são 55" chegaria depois da F4 e custaria domínio, API, tela e
âncora. Com ela, custa um parâmetro e a T-540 revertida.

### 6.2 O cabeçalho do `Resumo Executivo` **não** pode ser comparado literalmente

A referência grafa, no alto da aba de resumo:

```
Contrato : TC 52/SMIT/2024 - TA 02
Proposta : PC-SMIT-240402-53 V1.0 / PA-SMIT-260319-739
```

A aplicação produz `contrato_referencia = "TC 52/SMIT/2024"` e `proposta_origem =
"PA-SMIT-260319-739"` — **verificado na execução**. O `- TA 02` e o `PC-SMIT-240402-53 V1.0` não
existem em nenhuma das duas fontes que a aplicação lê: vieram de quem montou a planilha à mão.

Consequência para a T-521: o âncora compara **as quatro abas de detalhe célula a célula e as
contagens do resumo**, e compara a identificação por **conteúdo da aplicação**, não por igualdade
com a referência. A alternativa — inventar o `- TA 02` para casar com o gabarito — seria gravar no
código um dado que a aplicação não tem como saber, e é o mesmo erro que a ESPEC 003 §9.1 já
registrou na capa.

Proposta de emenda a `R-RES-03`, a aplicar na T-549.

### 6.3 A paleta ganha um eixo de severidade, e isso é decisão de identidade

A espec trata as quatro situações como dado. Na tela elas precisam de **quatro cores**, e o projeto
não tem eixo de severidade: tem teal, navy, `brand`, `prodam`, mais o vermelho e o âmbar que a
ESPEC 002 introduziu pontualmente no saldo negativo e na marca de perfil.

Duas ressalvas concretas, medidas:

- `brand.green` `#00805F` dá **4,6:1** e o próprio `tailwind.config.ts` o declara **só para ícone e
  traço**. Como tarja de severidade ele é elemento de interface — exigência de 3:1, e sobra folga.
  **Como texto, não serve**: o rótulo usa `brand.green-ink`.
- O âmbar da categoria *maior relevância* não pode ser o mesmo âmbar da marca `perfil`, que já
  significa outra coisa no grid logo abaixo.

Por isso a T-538 é tarefa própria, passa pelo script de contraste da T-403 e entra no insumo `K-02`.
`R-ACE-02` continua valendo: **a cor não carrega a informação sozinha** — o rótulo por escrito
carrega, e a tarja é redundância.

---

## 7. O que pode dar errado, e o que pega

| O que pode dar errado | O que pega | Quando |
|---|---|---|
| Ler as regras de classificação errado — trocar o limite de `m = 0` | **P1**, com a lista nomeada de diferenças | F1 |
| Comparar quantidades formatadas em vez de `Decimal` — `117,29` virar *sem divergência* | T-511, caso explícito | F1 |
| **`I-06` responder 55 depois da F4** | Nada automático. **T-508 é o preço pago para isso custar um parâmetro** | F1 |
| Quantidade sair como texto no XLSX | T-518 e a soma conferida à mão na **T-523** | F2 |
| O arquivo abrir com aviso de reparo do Excel | **Nada automático.** `openpyxl` relê o que ele mesmo escreveu | F2 |
| **O segundo blob não ser liberado** | **Nada automático** — ver §5.1. Só revisão de código na T-531 | F4 |
| O teste do bloco extracontratual falhar por `null` | T-542, reescrita junto com a T-540 | F5 |
| O painel empurrar o grid e a captura acusar "mudança de layout" | É mudança **pretendida**: a T-544 refaz a linha de base | F5 |
| Contraste dos tokens de severidade abaixo de AA | Script de contraste da T-403, já existente | F4 |
| A resposta crescer além do razoável | T-528, medida — não estimada | F3 |
| O tempo passar de 40 s | T-529. Acima disso, a otimização da ESPEC 004 §6 deixa de ser opcional | F3 |
| **Teste-âncora do `.docx` quebrar** | T-546 — mas o documento **não é tocado**. Se quebrar, algo foi entendido errado | F5 |
| Duas leituras da mesma linha na tela divergirem | **T-557**, na mesma execução. Até ela existir, o que garante isso é argumento de arquitetura, não teste — §5.4 | F5 |
| **Situação vazia quebrar em produção** — a aba, o bloco ou o campo que o piloto nunca produz | T-553, T-554 e T-556, com caso **construído**. Nenhum dado real do projeto percorre esse caminho | F1, F2, F4 |

As linhas de "nada automático" são três, e são as três mais caras de descobrir tarde. Duas delas
— o blob e o arquivo no Excel — repetem a lição que este projeto já aprendeu duas vezes: **os testes
garantem forma e conteúdo, não aparência nem consumo de memória.**

---

## 8. Insumos

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **K-01** | **Aceite do arquivo aberto no Excel** — cinco abas, soma funcionando | T-523 | **P2 não fecha.** É a única verificação de que o entregável novo é utilizável |
| **K-02** | **Aceite visual do painel**, com os tokens de severidade e o grid retitulado | F4 | Risco de refazer a linha de base da T-544 depois de a F5 já ter comparado contra ela |
| **K-03** | **Resposta ao `I-06`** — universo 56 ou 55 | T-540 | Não bloqueia F1–F4. Bloqueia a remoção do bloco no grid: sem resposta, o item **não pode** sair de onde está |
| **K-04** | Confirmação dos rótulos das quatro situações (`I-07` da espec) | T-532 | Rótulo é dado de apresentação; muda em uma linha |

`K-03` é o único que trava uma tarefa específica, e trava a tarefa **certa**: a que remove um achado
da tela. Na dúvida entre exibir duas vezes e não exibir, o plano exibe duas vezes.

---

## 9. O que este plano não faz

- **Não altera o `.docx`.** Nenhum arquivo de `infrastructure/report/docx_renderer.py`,
  `layout.py`, `modelo.py` ou `ooxml.py`. `R-REC-01` continua omitindo o item sem previsão
  contratual do documento formal — é a ESPEC 001 que manda, e a T-546 é quem cobra.
- **Não altera a reconciliação.** A classificação lê `contratada` e `medida` como já saem; nenhuma
  regra de extração, leitura ou catálogo é tocada.
- **Não calcula valor financeiro nem percentual.** ESPEC 009 §4.2.
- **Não introduz filtro, busca ou ordenação no painel.** `R-UI-05` e ESPEC 008 §4 recusaram, e a
  categorização é o que torna o filtro desnecessário. `<details>` não é filtro: não esconde nada de
  quem não pediu.
- **Não persiste nada.** A aplicação segue sem estado (ESPEC 001 §7.2); o XLSX viaja embutido pelo
  mesmo motivo que o `.docx`.
- **Não resolve o `I-01`.** O `11.027.00001.00` continua saindo com 10, e a divergência continua
  declarada — agora em dois âncoras em vez de um.
- **Não unifica os dois grids.** A duplicação dos 36 itens entre painel e grid é consciente
  (ESPEC 009 §14). Se o uso mostrar que o grid por seção deixou de ser consultado, isso é espec
  nova — e é decisão de negócio, não limpeza de código.

---

## 10. Emendas da execução — 2026-08-10

### 10.1 Faltava a captura do "antes" — e era o único ponto de não retorno

Este plano previu **refazer** a linha de base (T-544) e não previu **preservar a
atual** antes de o E4 mexer na tela. Sem ela, `R-PAN-09` — *"o grid não muda em mais
nada"* — viraria leitura de diff em vez de medição.

A lacuna foi encontrada ao escrever o backlog, e fechada pela **T-558**, primeira
tarefa do E4. A linha de base mora em `frontend/test-results/`, que não é versionada e
que o Playwright apaga a cada execução — foi assim que a do TASKS 008 se perdeu.

A evidência que ela permitiu está em [TASKS 009](../tasks/009-tasks-analise-da-medicao.md)
§2.4: seis das dez capturas idênticas, o `pronto` mais alto pelo painel, e **8 pixels**
de antialiasing no corpo do grid quando alinhado pela base.

### 10.2 A §5 subestimou: foram **cinco** regressões, não três

A §5 listou três testes existentes que este incremento quebraria — todos no frontend,
porque era lá que a tela mudava. Quebraram cinco:

| Onde | Previsto? |
|---|---|
| `page.tsx` — `revokeObjectURL` de um blob só | ✅ §5.1 |
| `a11y-estrutura.spec.ts` — o bloco `#sem-previsao` | ✅ §5.2 |
| `a11y-contraste.spec.ts` — tokens novos | ✅ implicitamente |
| **`test_api_e2e.py`** — conjunto exato de chaves de `LinhaDoGrid` | ❌ |
| **`smoke.spec.ts`** — rótulo do bloco removido | ❌ |

As duas não previstas estavam **a uma camada de distância** do que a §5 olhou: uma é
asserção de contrato da API, a outra é do teste de fumaça. A lição para o próximo
plano: quando um campo entra na resposta, procurar também quem afirma a **forma** da
resposta — não só quem consome o conteúdo.

### 10.3 Três tarefas mudaram depois da revisão da tela

O plano foi escrito antes de haver tela para olhar. Com ela pronta, duas decisões
caíram — a segunda por causa da primeira — e três tarefas deste plano descrevem algo
que não existe mais. **O texto das tarefas fica como está**, e a correção mora aqui,
pela mesma conduta da §10.1: plano ajustado depois do fato não é plano.

| Tarefa | O plano diz | O que ficou |
|---|---|---|
| **T-532** | *"identificação, **quadro-resumo** e os quatro blocos"* | Sem quadro-resumo. Ele repetia, palavra por palavra, o cabeçalho dos quatro blocos. Ficou a identificação, com o **total** ao lado — ESPEC 009 §17.4 |
| **T-533** | *"crítico e maior relevância **abertos**"* | Os quatro nascem **fechados**. Só foi possível porque a contagem passou para o cabeçalho do bloco quando o quadro saiu: `1 item` em *Item crítico* já é o achado — ESPEC 009 §17.5 |
| **T-537** | *"inclusive o quadro-resumo"* | Sem alvo. As demais tabelas do painel seguem com `scope`, nome acessível e contêiner focável, e §5.3 continua verde |

**A ordem importa e é a lição.** A segunda mudança não teria sido possível sem a
primeira: enquanto o quadro-resumo existia, fechar os quatro blocos esconderia as
contagens. Foi ele sair que transformou o cabeçalho de cada bloco no portador do
resultado — e só então "tudo fechado" deixou de custar informação.

Nenhuma das duas tocou o `.xlsx`: lá a aba `Resumo Executivo` continua, porque o
arquivo circula sem os blocos.
