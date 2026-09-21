# TASKS 009 — Backlog da Análise da Medição

| | |
|---|---|
| **Especificação** | [ESPEC 009](../specs/009-analise-da-medicao.md) v1.0 |
| **Plano** | [PLANO 009](../plans/009-plano-analise-da-medicao.md) v1.0 |
| **Versão** | 1.0 — 2026-08-10 |
| **Total** | 58 tarefas · 4 insumos |
| **Status** | **Concluído** — 57 tarefas · **P1 e P3 fechados** · **P2 pendente de `K-01`** · `K-02`, `K-03` e `K-04` pendentes |

> Escrito **antes** da implementação, como o TASKS 003, o TASKS 004 e o TASKS 008.

---

## 1. Convenções

**Identificadores** `T-5nn` seguem a numeração do PLANO 009. `K-nn` são insumos do
solicitante. `T-553` a `T-557` entraram depois da primeira redação do plano, com a §5.4;
`T-558` nasce neste backlog e está registrada como emenda em §2.2 — por isso não estão em
ordem dentro dos épicos. **O identificador é nome, não posição.**

**Definição de pronto — backend:** código e teste na mesma entrega; `ruff check`,
`mypy src/` e `bandit -ll -r src/` limpos; `pytest` verde; comentário explicando o *porquê*
onde a escolha não for óbvia.

**Definição de pronto — frontend:** `tsc --noEmit`, `next lint` e `playwright test` verdes;
`axe` sem violação nova.

**Convenção de commit** `<tipo>(T-5nn): descrição`.

### 1.1 Cinco regras que atravessam o backlog

**1 — O `.docx` não é tocado. Em nenhuma tarefa.** Estes quatro arquivos são somente
leitura durante todo o backlog:

```
backend/src/infrastructure/report/docx_renderer.py
backend/src/infrastructure/report/layout.py
backend/src/infrastructure/report/modelo.py
backend/src/infrastructure/report/ooxml.py
```

Se uma tarefa parecer exigir mudança em qualquer um deles, **pare**. O critério de aceite
da ESPEC 001 é reproduzir o documento atual, `R-REC-01` continua omitindo o item sem
previsão contratual do documento formal, e a T-546 é quem cobra.

**2 — `application/` também não é tocado.** A ESPEC 009 §11 previu que o caso de uso
passasse a devolver a análise. **Não precisa**, e o próprio código mostra por quê: o
`routers/reports.py` já chama `relatorio.apenas_divergencias()` — uma derivação de domínio
— sobre o `Report` que o caso de uso devolveu. A análise é a mesma espécie de derivação.

Uma fábrica de domínio (`T-509`) chamada do mesmo lugar entrega o mesmo resultado sem
atravessar uma camada que não tem decisão nenhuma a tomar aqui. Emenda registrada em §2.2.

**3 — Toda quantidade sai formatada do backend.** Nenhuma formatação de número em
TypeScript, em tarefa nenhuma. `MILHAR` e `SIMPLES` são atributo do item (`R-MED-04`), e
duplicar essa regra em duas linguagens é mantê-la em dois lugares (`D-04`).

**4 — Cor não carrega informação sozinha.** Vale para as quatro situações, para a tarja de
gravidade e para os selos de contagem. O rótulo por escrito é o portador; a cor é
redundância (`R-ACE-02`). Se a distinção entre duas situações depender de enxergar a
diferença entre dois tons, **pare**.

**5 — Tela e arquivo saem do mesmo agregado.** Nenhuma tarefa recalcula categoria,
contagem ou saldo do lado do consumidor. Se duas tarefas precisarem da mesma soma, a soma
é do domínio (`R-XLS-02`, verificada na T-557).

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Situação |
|---|---|---|---|
| **E0** A referência vira instrumento | T-501 … T-505 | — | ✅ |
| **E1** Classificação e agregado no domínio | T-506 … T-514 · T-553 | **P1** | ✅ |
| **E2** O renderizador XLSX | T-515 … T-523 · T-554 · T-555 | **P2** | ✅ automático · ⬜ T-523 (`K-01`) |
| **E3** A resposta da API | T-524 … T-529 | — | ✅ |
| **E4** O painel na tela | T-558 · T-530 … T-539 · T-556 | — | ✅ |
| **E5** Revisão do grid e verificação do conjunto | T-540 … T-547 · T-557 | **P3** | ✅ |
| **E6** Documentação | T-548 … T-552 | — | ✅ |

**Ordem de execução:** E0 → E1 → { E2 ‖ E3 → E4 } → E5 → E6. E2 e E3+E4 tocam arquivos
disjuntos e são a única paralelização útil (PLANO 009 §4).

### Resultado

| O que | Antes | Depois |
|---|---|---|
| Itens analisados | — | **56** — 1 crítico · 20 sem medição · 16 parciais · 19 conformes |
| Diferenças contra o gabarito | — | **2**, ambas declaradas (`I-06` e `I-01`) |
| Entregáveis por execução | 1 (`.docx`) | **2** (`.docx` + `.xlsx`) |
| Tamanho da resposta | 5.032,7 KB | **5.064,4 KB** (+31,6 KB — o `.xlsx` tem 12,5 KB) |
| Tempo de ponta a ponta | ~36 s | **34,8 s** — limite de 40 s intacto |
| Grid de divergências | 36 linhas · 22 seções | **36 linhas · 22 seções, intacto** |
| Teste-âncora do `.docx` | 54 de 55 | **54 de 55, intacto** |
| Camadas tocadas | — | domínio · infraestrutura · API · frontend. **`application/` não** |
| Dependências novas | — | **nenhuma** — `openpyxl` já lia a planilha de medição |
| Testes de backend | 308 | **365** |
| Testes de navegador | 26 | **37** |
| Violações `axe` · 4 estados × 2 larguras | 0 | **0** |
| Nós de texto abaixo de 4,5:1 | 0 | **0** |

### Os três portões

| Portão | Resultado |
|---|---|
| **P1 — a classificação reproduz o gabarito** | ✅ A diferença é **exatamente a linha vermelha da T-505**: o item crítico a mais e o `11.027.00001.00` com 10 no lugar de 6. Uma terceira apareceu e **não era divergência** — ver §12.3 |
| **P2 — o arquivo confere e abre** | ✅ **automático** — cinco abas, célula a célula contra o gabarito, coluna numérica com tipo numérico e `Decimal` sem perda. ⬜ **humano** — ninguém abriu no Excel (`K-01`). O arquivo está em `saida/Relatorio_Analise_Medicao.xlsx` |
| **P3 — o conjunto não regrediu** | ✅ Âncora do `.docx` intacto, grid com 36 linhas em 22 seções, o item sem previsão contratual aparece **uma vez**, `axe` verde nos quatro estados nas duas larguras |

### Desvios

| Tarefa | O que mudou | Por quê |
|---|---|---|
| **T-509** | `application/` não foi tocada, contra a ESPEC 009 §11 | O router já chamava `apenas_divergencias()` sobre o `Report` pronto. A análise é a mesma espécie de derivação, e a camada não tinha decisão nenhuma a tomar. Emenda em ESPEC 009 §17.1 |
| **T-510** | A marca de origem ficou em `ItemClassificado`, não em `ReportLine` | Não é atributo da linha: é atributo de **onde ela estava** no relatório. E pô-la em `ReportLine` exigiria mexer no caso de uso, contra §1.1 regra 2 |
| **T-521** | A **descrição** saiu do escopo da comparação | O gabarito traz descrição reescrita à mão. A nossa vem do contrato e preserva até o erro de digitação dele — ver §12.2 |
| **T-521** | A comparação passou a arredondar para duas casas | O gabarito tem menos precisão que a aplicação — ver §12.3 |
| **T-527** | Uma asserção **de backend** quebrou, e não estava prevista | `test_api_e2e.py` afirma o **conjunto exato** de chaves de `LinhaDoGrid`; o campo aditivo a derrubou. A asserção continua sendo de conjunto exato de propósito — ver §12.1 |
| **T-542** | Uma asserção **do teste de fumaça** quebrou, e também não estava prevista | `smoke.spec.ts` procurava o rótulo do bloco que a T-540 removeu — ver §12.1 |
| **T-556** | O dublê mudou de estratégia: gera de verdade, captura a resposta e reemite modificada | `route.fetch()` reenvia o corpo, e o corpo é multipart com dois binários. Volta corrompido: `400 'contrato' não é um arquivo PDF válido` — ver §12.4 |
| **T-534** | Bloco vazio passou a nascer **aberto** | Nascia recolhido, e "nenhum item crítico" — o resultado que quem confere mais quer ler — ficava atrás de um clique. Quem pegou foi o teste da T-556 |
| **T-538** | Precisou limpar o cache do `.next` | Ver §12.5 — e é a lição mais barata e mais assustadora da entrega |
| **T-533** | **`D-03` revisada: os quatro blocos nascem fechados** | Abrir os dois primeiros comprava visibilidade enquanto o quadro-resumo existia. Com a contagem no cabeçalho de cada bloco (§17.4), `1 item` em *Item crítico* já é o achado — e abrir dois passou a custar ~92 linhas empurrando o grid para fora da primeira tela (ESPEC 009 §17.5) |
| **T-532** | O **quadro-resumo em tabela saiu da tela**, depois da revisão | Redundante palavra por palavra com o cabeçalho dos quatro blocos. O total ficou, na linha de identificação: é o invariante de `R-ANA-05` visível. A aba `Resumo Executivo` do `.xlsx` **não** mudou — lá o arquivo circula sem os blocos (ESPEC 009 §17.4) |

### 2.1 Pontos de não retorno

**Um, e ele não está no plano — é a T-558.** A linha de base de captura mora em
`frontend/test-results/`, que não é versionada e que o Playwright **apaga a cada
execução** (foi o que aconteceu na T-401 do TASKS 008). A partir da primeira tarefa do E4
não existe mais "antes" para comparar.

Fora dela, o backlog é inteiramente reversível: nada é substituído, o `.docx` não é
tocado, os campos da API são aditivos, e reverter é `git revert` do épico.

**Duas tarefas são desenhadas para serem revertidas**, não por engano mas por projeto:
a **T-508** (universo da análise) e a **T-540** (remoção do bloco no grid). Ambas dependem
do `K-03`, e o custo de reverter cada uma é uma linha e um parâmetro de teste. Ver §2.3.

### 2.2 Dois desvios já conhecidos, antes de começar

Registrados agora, não contornados — é a conduta da ESPEC 007 §13.

**1 — `application/` fica fora, contra a ESPEC 009 §11.** Motivo em §1.1 regra 2. O
`ReportResult` já carrega o `Report`, e o `Report` já é a fonte da análise. Emenda a
aplicar na T-549.

**2 — Falta uma tarefa no PLANO 009: a captura do "antes".** A T-544 refaz a linha de
base, mas o plano não previu **preservar a atual** antes de o E4 mexer na tela. Sem isso,
`R-PAN-09` — *"o grid de divergências não muda em mais nada"* — vira leitura de diff em
vez de medição.

A T-558 fecha a lacuna. E a natureza da comparação aqui é diferente da do TASKS 008:
lá a pergunta era *"nada moveu?"*; aqui é *"moveu só o que devia?"* — o painel **é**
mudança de layout pretendida. A régua está em §2.4.

### 2.3 As duas tarefas reversíveis, e o que as governa

| Tarefa | Se `K-03` responder **56** | Se responder **55** |
|---|---|---|
| **T-508** — universo | Fica como está | Uma linha: o universo passa a ser `Report.linhas` |
| **T-540** — bloco do grid | Removido; o item vive no bloco crítico | **Não removida**; a T-542 não é reescrita e o bloco fica onde está |
| **T-553 · T-556** | Caso construído continua necessário | Continua necessário — e passa a haver categoria vazia no piloto |

**Regra de ouro, na ausência de resposta:** o item `14.049.00054.00` **não sai de onde
está**. Entre exibi-lo duas vezes e não exibi-lo, exibe-se duas vezes. A T-543 muda de
"exatamente uma vez" para "ao menos uma vez" enquanto o insumo não vier.

### 2.4 A régua do E5 — o que pode mudar de pixel

O painel é mudança pretendida. Abaixo dele, **nada é**. A T-547 compara a captura da T-558
com a nova e toda diferença tem de ser atribuível a esta lista:

| Onde | Delta esperado | Tarefa |
|---|---|---|
| Acima do grid | O painel inteiro — resumo mais quatro blocos | E4 |
| Faixa de resultado | Um segundo botão | T-536 |
| Título do grid | `Divergências` → `Divergências, na ordem do relatório` | T-541 |
| Topo do grid | O bloco `#sem-previsao` **desaparece** | T-540 |
| Corpo do grid | **Nenhum.** Mesmas 36 linhas, mesmas 22 seções, mesmas faixas | — |

Se aparecer uma quinta diferença, **pare**. É a mesma disciplina da §1.1 do TASKS 008,
que fechou com cinco exceções tendo nascido com quatro — e a lição de lá vale aqui:
escrever a lista antes de medir subestima.

#### A evidência — T-547

Dez capturas, antes contra depois, mesma máquina, mesmo navegador.

| Captura | Resultado |
|---|---|
| `inicial` · `erro` · `bloqueado` — ambas larguras | **idênticas**, 6 de 10 |
| `pronto-1366` | 4948 → **7078 px** de altura (+2130) — o painel |
| `pronto-390` | 5519 → **7926 px** de altura (+2407) — o painel |
| `processando` — ambas larguras | 143 px numa caixa de **16 × 16** — ver abaixo |

**O corpo do grid não mudou um pixel.** Como a página ficou mais alta, a comparação
direta não serve; alinhando **pela base** — onde o rodapé e as seções encostam —, os
últimos 4000 px trazem **8 pixels** diferentes, todos em `x 259–260` e `x 1105–1106`
numa mesma linha: as duas bordas arredondadas de uma seção, antialiasing de composição
da captura de página inteira. As 36 linhas e as 22 seções conferem.

**A quinta diferença apareceu, e não era mudança de layout.** No `processando`, a caixa
de 16 × 16 px coincide com o indicador de atividade da T-421, que **gira**: cada captura
o pega num ângulo. O script de contraste já congelava `animation` desde a T-403 pelo
mesmo motivo; o de captura não. Corrigido — vale das capturas seguintes em diante, já
que a linha de base do "antes" foi tirada sem o congelamento e é irreproduzível.

---

## 3. Épico E0 — A referência vira instrumento

> **Nenhum arquivo de `src/` é tocado neste épico.** O gabarito é lido, não perseguido.

#### T-501 — A referência vira fixture
**Tamanho:** P · **Ref:** PLANO 009 F0

Copiar `docs/documentos/Relatorio_Analise_Medição.xlsx` para
`backend/tests/fixtures/analise_referencia.xlsx`. Nome ASCII, como `contrato.pdf`,
`levantamento.xlsx` e `modelo.pdf` — o acento no nome atravessa três sistemas de arquivos
e um `pytest -k` sem necessidade nenhuma.

**Conferir antes de versionar:** a planilha traz código, descrição e quantidade nas cinco
abas, e **nenhuma aba de usuários**. É o oposto do `levantamento.xlsx`, que exigiu
`sanitize_fixture.py`. Conferir, não presumir — o hook de pré-commit não conhece este
arquivo.

**Pronto quando:** a fixture existe, o `git status` a mostra como adição única, e as cinco
abas abrem com os nomes originais.

---

#### T-502 — Leitor da referência
**Tamanho:** M · **Ref:** ESPEC 009 §2

Lê as cinco abas e devolve estrutura normalizada: categoria, código, descrição,
contratado, medido, saldo. Vive em `backend/tests/`, **não em `src/`** — é instrumento de
teste, não código de produção, e nada da aplicação depende dele.

Dois cuidados que o leitor ingênuo não tem:

| Cuidado | Por quê |
|---|---|
| As três primeiras linhas de cada aba são título, linha vazia e cabeçalho | Ler a partir da linha 1 traz `"Código"` como se fosse um código de serviço |
| A aba `Sem Divergência` tem **4** colunas, as outras **5** | Ler saldo onde não há devolve `None` e envenena a comparação |

**Pronto quando:** o leitor devolve 0 + 20 + 16 + 19 linhas nas quatro abas de detalhe.

---

#### T-503 — A referência é internamente coerente
**Tamanho:** P · **Ref:** ESPEC 009 §2.3

Teste sobre a fixture, **antes** de qualquer comparação com a aplicação: o quadro da aba
`Resumo Executivo` declara 0 / 20 / 16 / 19, e as abas de detalhe **contêm** esse número
de linhas. Total 55.

O gabarito foi montado fora deste projeto. Antes de tratá-lo como verdade, saber que ele
não se contradiz custa um teste — e evita perseguir no código um defeito que está no
arquivo.

**Pronto quando:** o teste passa e falha se qualquer linha da fixture for alterada.

---

#### T-504 — O comparador
**Tamanho:** M · **Ref:** PLANO 009 §2 · **Portão P1**

Recebe uma classificação e a referência; devolve a **lista nomeada de diferenças** —
código, categoria esperada, categoria obtida, quantidade esperada, quantidade obtida.
Nunca um booleano: diferença sem nome não orienta correção.

Três espécies de diferença, e as três precisam sair distinguidas: **item a mais**, **item
a menos**, **mesma linha em categoria diferente**.

**Pronto quando:** alimentado com classificação vazia, o comparador acusa **55**
diferenças, todas da espécie "item a menos". Se acusar menos, ele não compara o que diz
comparar.

---

#### T-505 — A linha vermelha
**Tamanho:** P · **Ref:** ESPEC 009 §2 · **Portão P1**

Documento com as **duas** divergências esperadas, por código, com motivo e insumo:

| Código | Esperado na referência | Esperado da aplicação | Motivo | Insumo |
|---|---|---|---|---|
| `14.049.00054.00` | ausente | **crítico**, 0 × 2 | `R-REC-01` o omite do relatório; `D-01` o traz para a análise | `I-06` |
| `11.027.00001.00` | contratado **6** | contratado **10** | Contrato, aditivo e planilha dizem 10; o modelo grafa 6 | `I-01` |

É contra esta tabela que a T-514 é lida. Qualquer terceira diferença reprova P1.

**Pronto quando:** a tabela está no teste, como constante nomeada, e não no comentário.

---

## 4. Épico E1 — Classificação e agregado no domínio `[portão P1]`

#### T-506 — `Classificacao`
**Tamanho:** P · **Ref:** ESPEC 009 §5

`StrEnum` com `CRITICO`, `MAIOR_RELEVANCIA`, `DIVERGENTE`, `SEM_DIVERGENCIA`, na ordem de
gravidade. `StrEnum` e não `Enum` pelo mesmo motivo de `NumberFormat`: o valor serializa
sozinho na resposta da API.

**Pronto quando:** os quatro membros existem e a ordem de declaração é a de gravidade — é
dela que a apresentação depende, não de uma lista paralela.

---

#### T-507 — `ReportLine.classificacao`
**Tamanho:** P · **Ref:** `R-ANA-01` a `R-ANA-06`

Propriedade sobre `contratada.valor` e `medida.valor`, ao lado de `tem_divergencia` e
`saldo`, que já vivem ali.

```
c < m                → CRITICO
c > m  e  m == 0     → MAIOR_RELEVANCIA
c > m  e  m != 0     → DIVERGENTE
c == m               → SEM_DIVERGENCIA
```

**Comparar `Decimal`, nunca `formatar()`.** É a mesma armadilha que `tem_divergencia`
documenta: a formatação arredonda para duas casas, e `117,29` contra `117,2889…` sairia
como igual.

**Pronto quando:** a propriedade existe, o comentário registra o porquê da comparação
decimal, e `tem_divergencia` continua funcionando — as duas coexistem e não se substituem.

---

#### T-508 — O universo da análise `[reversível]`
**Tamanho:** P · **Ref:** `R-ANA-07`, `D-01` · **Insumo `K-03`**

`Report.universo_da_analise()` devolve `linhas` **mais** `sem_previsao_contratual`,
**numa função só**.

A concentração é o requisito, não um detalhe de estilo: `D-01` depende de decisão do
negócio que ainda não veio, e a resposta "são 55" não pode custar mais que trocar o corpo
desta função. Espalhar a soma por três camadas transformaria um insumo em refatoração.

**Pronto quando:** existe exatamente **um** lugar no código onde os dois conjuntos são
unidos, e o comentário aponta para `I-06`.

---

#### T-509 — `AnaliseDaMedicao`
**Tamanho:** M · **Ref:** ESPEC 009 §11, `R-API-01`

`domain/entities/analysis.py`: agregado com identificação, resumo e as **quatro**
situações, sempre as quatro, na ordem de gravidade, cada uma com suas linhas.

Fábrica `de_relatorio(report)` — é ela que o router chama, no mesmo lugar em que hoje
chama `apenas_divergencias()` (§1.1 regra 2). Sem import de framework, sem `Path`, sem
`openpyxl`: `tests/test_architecture.py` continua valendo sem alteração.

**Pronto quando:** o agregado devolve quatro situações para qualquer entrada, inclusive
para um relatório vazio, e `test_architecture.py` passa.

---

#### T-510 — A marca de origem sobrevive até a apresentação
**Tamanho:** P · **Ref:** `R-PAN-05`, `R-XLS-04`

A linha que veio de `sem_previsao_contratual` chega ao consumidor identificada. Dentro da
situação *crítico* ela é o caso mais grave de todos, e é a marca que a distingue de um
excesso sobre item que ao menos **tem** cobertura contratual.

**Pronto quando:** a marca existe no agregado e não depende de o consumidor comparar
listas para redescobri-la.

---

#### T-511 — Fronteiras da classificação
**Tamanho:** M · **Ref:** `R-ANA-06`, ESPEC 009 §5.1

Um teste por fronteira, com nome que diz a regra:

| Caso | Esperado |
|---|---|
| `c < m` | `CRITICO` |
| `c > m`, `m = 0` | `MAIOR_RELEVANCIA` |
| `c > m`, `m ≠ 0` | `DIVERGENTE` |
| `c = m` | `SEM_DIVERGENCIA` |
| `c = m = 0` | `SEM_DIVERGENCIA` — fronteira sem caso real, §5.1 |
| `117,29` × `117,2889…` | `DIVERGENTE` — **o teste que pega a comparação por texto** |

**Pronto quando:** os seis passam, e o de `117,2889…` **falha** se a implementação trocar
`.valor` por `.formatar()`. Verificar essa falha de propósito, uma vez.

---

#### T-512 — O invariante da soma
**Tamanho:** P · **Ref:** `R-ANA-05`

A soma das quatro contagens é o total do universo. Sobre o piloto **e** sobre casos
construídos.

**Parametrizado pelos dois universos — 56 e 55 — desde agora**, não quando o `K-03`
chegar. É o que torna a T-508 barata de reverter.

**Pronto quando:** o teste passa nos dois universos e falha se qualquer linha ficar sem
situação.

---

#### T-513 — Perfil e pacote caem em *sem divergência*
**Tamanho:** P · **Ref:** `R-ANA-08`, ESPEC 009 §6.4

As **cinco** linhas `1/1` — `14.048.00008.00`, `14.046.00010.00`, `14.025.00011.00` (duas)
e `14.070.00002.00` — caem em *sem divergência* e chegam marcadas.

O teste não existe para confirmar que a regra funciona: existe para que, no dia em que
alguém "corrigir" `R-REC-04`, a marca não desapareça em silêncio de uma categoria que
afirma conformidade.

**Pronto quando:** as cinco são encontradas por código e todas trazem a marca.

---

#### T-553 — Situação vazia no agregado
**Tamanho:** P · **Ref:** `R-API-01`, PLANO 009 §5.4

Caso **construído**: um relatório em que uma das quatro situações não tem item. O agregado
devolve as quatro, com `linhas` vazia onde não há.

**O piloto não percorre este caminho** — com o universo de `D-01` as quatro situações têm
itens (1/20/16/19). A única categoria vazia que este projeto conhece é a `Itens Críticos`
do artefato de referência, e ela está vazia por engano.

**Pronto quando:** o teste usa dado construído, não fixture, e cobre pelo menos duas
situações vazias diferentes.

---

#### T-514 — O comparador sobre o domínio
**Tamanho:** P · **Ref:** PLANO 009 §2 · **Portão P1**

Roda a classificação sobre os dois arquivos reais e compara com a referência pela T-504.

**Pronto quando:** a lista de diferenças tem **exatamente dois itens**, e os dois são os
da T-505. Qualquer terceiro reprova o portão — e reprova antes de existir renderizador,
API ou tela.

---

## 5. Épico E2 — O renderizador XLSX `[portão P2]`

#### T-515 — Port `IAnaliseRenderer`
**Tamanho:** P · **Ref:** ESPEC 009 §11

Em `domain/interfaces/ports.py`, ao lado de `IReportRenderer`, com a mesma forma:
`renderizar(analise, destino) -> Path`.

O domínio não menciona `openpyxl` — é o que permitiu trocar PDF por DOCX sem tocar no
núcleo, e é o que permitirá um segundo formato de análise se um dia ele for pedido.

**Pronto quando:** o protocolo existe e `test_architecture.py` continua verde.

---

#### T-516 — As cinco abas
**Tamanho:** M · **Ref:** `R-XLS-01`

`infrastructure/report/xlsx_analise_renderer.py`, com os nomes do artefato de referência:
`Resumo Executivo`, `Itens Críticos`, `Divergências Maior Relevância`, `Divergências`,
`Sem Divergência`.

**As cinco existem sempre**, inclusive vazias — só com título e cabeçalho. Aba ausente
obriga quem recebe a distinguir "não havia itens" de "o relatório não gerou a aba", e essa
dúvida numa conferência é cara.

**Pronto quando:** as cinco abas saem na ordem, com os nomes exatos.

---

#### T-517 — A aba `Resumo Executivo`
**Tamanho:** M · **Ref:** `R-RES-01` a `R-RES-04`

Identificação — contrato, proposta, competência — e o quadro das quatro situações com o
total.

**A identificação sai do dado da aplicação, não do gabarito.** A referência grafa
`TC 52/SMIT/2024 - TA 02` e uma proposta `PC-SMIT-240402-53 V1.0` que não existem em
nenhuma das duas fontes lidas. Ver PLANO 009 §6.2 — inventá-las para casar com o gabarito
gravaria no código um dado que a aplicação não tem como saber.

**Pronto quando:** o quadro traz as quatro situações e a linha de total, e o total é a
soma — calculada, não escrita.

---

#### T-518 — Quantidade em duas colunas `[risco]`
**Tamanho:** M · **Ref:** `R-XLS-05`

Cada quantidade ocupa duas colunas: o **texto formatado**, para conferir contra o `.docx`,
e o **valor numérico**, para a planilha somar.

`openpyxl` aceita `Decimal` nativamente — `NUMERIC_TYPES` inclui `Decimal`, verificado no
ambiente do projeto. **O valor não passa por `float`**: este é um relatório que instrui
faturamento, e é a mesma razão pela qual `Quantity` recusa `float` no construtor.

**Pronto quando:** a célula numérica tem tipo numérico na planilha — verificado por
`cell.data_type`, não pela aparência.

---

#### T-519 — As marcas viajam dentro do arquivo
**Tamanho:** P · **Ref:** `R-XLS-03`, `R-XLS-04`

Coluna própria para a marca de perfil ou pacote na aba `Sem Divergência`, e para a marca
de sem previsão contratual na aba `Itens Críticos`.

O arquivo circula **sem a legenda da tela**. Se a ressalva de §6.4 não estiver dentro
dele, a aba `Sem Divergência` afirma conformidade que ninguém verificou — em cinco das
dezenove linhas.

**Pronto quando:** as duas colunas existem e trazem valor legível por humano, não `TRUE`.

---

#### T-520 — Registro no container
**Tamanho:** P · **Ref:** ESPEC 009 §11

Método `renderizador_de_analise()` no `DIContainer`, ao lado de `renderizador()`, com o
mesmo cache de singleton.

**Pronto quando:** o container devolve a mesma instância em duas chamadas, como os demais.

---

#### T-521 — Teste-âncora da análise
**Tamanho:** G · **Ref:** ESPEC 009 §13 · **Portão P2**

Gera o arquivo dos dois arquivos reais e o compara **célula a célula** com a fixture da
T-501, nas cinco abas, no formato de `test_anchor_fidelity.py`.

Escopo da comparação, e o que fica de fora com motivo declarado:

| Parte | Comparação |
|---|---|
| Quatro abas de detalhe | **Célula a célula**, com as duas divergências da T-505 |
| Quadro do resumo | Contagens, célula a célula |
| Identificação do resumo | **Não comparada** com a referência — PLANO 009 §6.2 |

**Pronto quando:** o teste passa com as duas exceções **nomeadas como constantes**, como o
âncora do `.docx` faz com `DIVERGENCIA_ESPERADA`. Exceção anônima vira exceção esquecida.

---

#### T-522 — Determinismo
**Tamanho:** P · **Ref:** `R-DOC-10` (ESPEC 003)

Duas execuções produzem arquivos idênticos. Atenção ao carimbo de data que o `openpyxl`
grava nas propriedades do pacote — se ele entrar, o teste compara conteúdo de célula, não
bytes, e o motivo fica no comentário.

**Pronto quando:** duas gerações seguidas conferem.

---

#### T-554 — A aba vazia
**Tamanho:** P · **Ref:** `R-XLS-01`, PLANO 009 §5.4

Sem item na situação, a aba sai **só com título e cabeçalho** — e sai.

Caso construído: o piloto não o percorre. É, literalmente, o estado em que o artefato de
referência entrega a aba `Itens Críticos`.

**Pronto quando:** a aba existe, tem cabeçalho e tem zero linhas de dado.

---

#### T-555 — A competência por extenso
**Tamanho:** P · **Ref:** `R-RES-03`

`15/07/2026` vira `julho/2026`.

**Tabela própria de meses, nunca `locale`.** `%B` depende da configuração do sistema
operacional: devolve `July` num container em inglês e falha em outro sem `pt_BR` instalado
— e a aplicação roda em Docker, onde a configuração regional não é dada.

**Pronto quando:** o teste passa com os doze meses e não depende de nada fora do processo.

---

#### T-523 — O arquivo aberto no Excel
**Tamanho:** P · **Ref:** PLANO 009 §2 · **Portão P2** · **Insumo `K-01`**

Verificação humana, não teste:

1. As cinco abas abrem, **sem aviso de reparo**.
2. `=SOMA()` sobre a coluna numérica devolve número, não zero.
3. Os acentos dos títulos saem corretos.

`openpyxl` relê perfeitamente o que ele mesmo escreveu — é a mesma cegueira que deixou
seis defeitos de DOCX passarem por toda a suíte na ESPEC 003, até alguém abrir o Word.

**Pronto quando:** os três pontos conferidos por pessoa, e o resultado registrado aqui.

---

## 6. Épico E3 — A resposta da API

#### T-524 — Schemas
**Tamanho:** P · **Ref:** `R-API-02`

`SituacaoDaAnalise`, `Analise`, e `LinhaDoGrid.sem_previsao_contratual` com padrão
`false`.

**Campo aditivo, nada renomeado.** `LinhaDoGrid` é reusada pelas quatro situações e pelo
grid: o padrão `false` é o que mantém o grid de divergências intacto sem uma segunda
classe quase igual.

**Pronto quando:** o `/docs` da API mostra os tipos novos e os antigos inalterados.

---

#### T-525 — O router monta a análise
**Tamanho:** M · **Ref:** `R-API-03`, `R-XLS-06`

Chama a fábrica da T-509 e o renderizador da T-520 **na mesma passagem** do `.docx`,
dentro do mesmo `TemporaryDirectory` — e lê os bytes antes de a pasta sumir, como o
documento já faz.

Reusar `_linha()`, que já existe e já formata. Uma segunda função de conversão seria a
primeira porta para tela e arquivo divergirem (§1.1 regra 5).

**Pronto quando:** uma requisição devolve os dois campos novos preenchidos.

---

#### T-526 — Bloqueio não traz análise
**Tamanho:** P · **Ref:** `R-API-04`

`422` continua devolvendo achados e mais nada. Análise de número possivelmente errado é
pior que análise nenhuma: ela **classifica** — e classificar errado é afirmar mais do que
o dado sustenta.

**Pronto quando:** a resposta de bloqueio não tem `analise` nem `analise_xlsx_base64`.

---

#### T-527 — Teste de API
**Tamanho:** M · **Ref:** `R-API-01`, `R-API-04`

Três asserções: os dois campos novos existem; `situacoes` traz **as quatro**, inclusive
com `quantidade: 0`; o `422` não traz análise.

**Pronto quando:** as três passam, e a das quatro situações usa contagem, não presença.

---

#### T-528 — O tamanho da resposta
**Tamanho:** P · **Ref:** PLANO 009 §6.3

Medir, com e sem a análise. A ESPEC 002 §6 registrou o limite e a saída — cache curto com
identificador — e o número medido é o que diz se ele está perto.

**Pronto quando:** os dois números estão registrados aqui, em KB.

---

#### T-529 — O tempo de ponta a ponta
**Tamanho:** P · **Ref:** PLANO 009 §6.3

Comparar com os ~36 s de hoje. Acima de **40 s**, a otimização da ESPEC 004 §6 deixa de
ser opcional — registrar, não decidir sozinho.

**Pronto quando:** o número está aqui, e no README pela T-550.

---

## 7. Épico E4 — O painel na tela

#### T-558 — A captura do "antes" `[ponto de não retorno]`
**Tamanho:** P · **Ref:** §2.2 · **Primeira tarefa do épico**

Linha de base nos quatro estados, nas duas larguras, com
`frontend/scripts/capturar-baseline.mjs`, **antes de qualquer edição em
`frontend/src/`**.

`test-results/` não é versionada e o Playwright a apaga a cada execução — foi assim que a
linha de base do TASKS 008 se perdeu. Guardar fora dela, e conferir que as imagens existem
antes de seguir.

**Pronto quando:** as oito imagens existem e a de `pronto` mostra o bloco `#sem-previsao`
no topo do grid — é ele que a T-540 vai remover.

---

#### T-530 — Tipos do frontend
**Tamanho:** P · **Ref:** ESPEC 009 §11

`lib/types.ts` espelhando os schemas novos. `Estado.pronto` passa a carregar **duas** URLs
de blob — renomear `url` para nomes que digam qual é qual, porque a partir daqui "a url"
é ambígua.

**Pronto quando:** `tsc --noEmit` limpo e nenhum `any`.

---

#### T-531 — O segundo blob, e as duas liberações `[risco]`
**Tamanho:** P · **Ref:** `R-ACE-18`, PLANO 009 §5.1

Segunda URL com o MIME de XLSX
(`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) — sem ele o
navegador entrega binário genérico e o Excel não abre com dois cliques.

**E o `revoke` das duas.** `page.tsx` hoje libera uma só:

```tsx
if (estado.situacao === "pronto") URL.revokeObjectURL(estado.url);
```

Deixar essa linha como está retém um `.xlsx` por geração, pela sessão inteira. **Nenhum
teste pega** — não há asserção de memória na suíte, e o sintoma só aparece em uso
prolongado. É o mesmo modo de falha da D-03 do PLANO 008: código correto para o mundo
anterior, silencioso no novo.

**Pronto quando:** as duas URLs são liberadas no mesmo ponto, e o comentário diz que são
duas — para que a terceira, se vier, não seja esquecida.

---

#### T-532 — `AnaliseMedicaoPanel.tsx`
**Tamanho:** G · **Ref:** `R-PAN-01` a `R-PAN-03`

Identificação, quadro-resumo e os quatro blocos. Colunas iguais às do grid, para que a
mesma linha seja reconhecível nos três lugares; *sem divergência* omite Saldo.

**Pronto quando:** o painel reproduz o protótipo revisado no `K-02`.

---

#### T-533 — Blocos recolhíveis
**Tamanho:** P · **Ref:** `D-03`

`<details>`/`<summary>` nativos. Crítico e maior relevância **abertos**; os outros dois
recolhidos.

Nativo por acessibilidade, não por economia: já é focável, operável por teclado e
anunciado com estado — três coisas que nenhuma implementação própria ganha de graça.
E não é filtro: não esconde de quem não pediu (`R-UI-05`).

**Pronto quando:** os quatro blocos abrem e fecham por teclado, sem uma linha de ARIA.

---

#### T-534 — Situação vazia aparece
**Tamanho:** P · **Ref:** `R-PAN-04`

Contagem zero, sem tabela, com texto próprio. **"Nenhum item crítico" é resultado**, e é o
resultado que o conferente mais quer ler.

**Pronto quando:** o bloco aparece sem itens e não vira tabela de zero linhas.

---

#### T-535 — As duas marcas na tela
**Tamanho:** P · **Ref:** `R-PAN-05`, `R-PAN-06`

Sem previsão contratual, na linha, dentro do bloco crítico. Perfil ou pacote, na linha,
mais a **contagem sob o título** do bloco *sem divergência* — cinco de dezenove, dito por
escrito.

**Pronto quando:** as duas marcas têm portador textual e não dependem de cor (§1.1
regra 4).

---

#### T-536 — O segundo download
**Tamanho:** P · **Ref:** `R-ACE-19`

`confere-analise-<contrato>-<aaaa-mm>.xlsx`, pela mesma função que já higieniza a
referência do contrato para nome de arquivo.

**Pronto quando:** o nome sai com contrato e competência, e o `suggestedFilename()` casa
`/^confere-analise-.+\.xlsx$/`.

---

#### T-537 — Acessibilidade das tabelas novas
**Tamanho:** M · **Ref:** `R-ACE-05`, `R-ACE-09`

`scope="col"` em todo `<th>`, nome acessível em toda `<table>`, contêiner de rolagem
focável com nome — **inclusive o quadro-resumo**, que também é `<table>`.

As asserções da ESPEC 008 varrem a página inteira: `th:not([scope])` = 0 e
`table:not([aria-labelledby]):not([aria-label])` = 0. Toda tabela nova entra nessa conta.

**Pronto quando:** as duas asserções existentes continuam em zero com o painel na tela.

---

#### T-538 — Tokens de severidade
**Tamanho:** M · **Ref:** `R-ACE-01`, PLANO 009 §6.3

Quatro cores para as quatro situações, no `tailwind.config.ts`, com o contraste medido em
comentário — como a ESPEC 005 fez com `brand`.

Duas ressalvas que já estão medidas:

| Ressalva | Consequência |
|---|---|
| `brand.green` `#00805F` dá **4,6:1** e o próprio config o declara só para ícone e traço | Serve como **tarja** (3:1 basta); **não serve como texto** — o rótulo usa `brand.green-ink` |
| O âmbar de *maior relevância* não pode ser o âmbar da marca `perfil` | Duas coisas diferentes com a mesma cor, a vinte pixels de distância |

**Pronto quando:** o script de contraste da T-403 fica verde com os tokens novos.

---

#### T-539 — O painel entra na tela
**Tamanho:** P · **Ref:** `R-PAN-01`

`ResultadoPanel.tsx` monta o painel **entre** a faixa de resultado e o grid, por dentro do
invólucro `aria-live` que já existe — não um segundo.

**Pronto quando:** a ordem no DOM é faixa → painel → grid, e a asserção da região viva
única continua passando.

---

#### T-556 — Situação vazia, no navegador
**Tamanho:** P · **Ref:** `R-PAN-04`, PLANO 009 §5.4

Resposta sintética por `page.route`, como `estados.ts` já monta o `bloqueado`: uma situação
sem itens, e a tela mostrando contagem zero sem tabela.

O piloto não produz esse estado. Sem o dublê, `R-PAN-04` fica sem teste — e é a regra que
faz a categoria mais importante aparecer justamente quando está vazia.

**Pronto quando:** o estado sintético entra em `estados.ts` e o teste passa.

---

## 8. Épico E5 — Revisão do grid e verificação do conjunto `[portão P3]`

#### T-540 — O bloco sai do grid `[reversível]`
**Tamanho:** P · **Ref:** `R-PAN-07` · **Insumo `K-03`**

Remover o bloco de sem previsão contratual do `DivergenciaGrid` — o item já está no bloco
crítico do painel, acima.

`R-DIV-05` **não muda**: a coleta continua, o dado continua na resposta da API, o critério
de entrada continua o mesmo. Muda a posição, como a ESPEC 008 `D-07` já mudou uma vez.

**Sem resposta ao `K-03`, esta tarefa não é executada** — §2.3.

**Pronto quando:** o bloco saiu e o item aparece uma vez só (T-543).

---

#### T-541 — O grid muda de título
**Tamanho:** P · **Ref:** `R-PAN-08`

`Divergências` → **`Divergências, na ordem do relatório`**.

Com o painel acima, dois títulos "Divergências" na mesma tela designariam recortes
diferentes — 16 itens contra 36 — com a mesma palavra.

**Pronto quando:** o título mudou e nenhum seletor de teste quebrou em silêncio.

---

#### T-542 — O teste do bloco é reescrito, não apagado
**Tamanho:** P · **Ref:** ESPEC 008 `D-07`

`e2e/a11y-estrutura.spec.ts` › *"o bloco sem previsão contratual vem antes das seções"*
procura `#sem-previsao` e o compara com a primeira `[id^="secao-"]`. Com a T-540, o
elemento deixa de existir e o teste falha **por `null`**, não por regressão.

A pergunta muda de *"o bloco está antes das seções?"* para *"o item aparece uma vez, e
antes das seções?"*. A intenção da D-07 permanece: o achado de maior consequência não fica
depois de 22 seções.

**Apagar o teste seria perder a garantia. Mantê-lo como está seria travar a entrega num
seletor.**

**Pronto quando:** o teste passa contra a tela nova e falha se o item voltar para o fim.

---

#### T-543 — O item aparece exatamente uma vez
**Tamanho:** P · **Ref:** PLANO 009 §2 · **Portão P3**

`14.049.00054.00` no DOM do estado `pronto`: **uma** ocorrência.

Enquanto o `K-03` não vier, a asserção é "ao menos uma" — §2.3. A regra de ouro é que ele
nunca desapareça, não que ele apareça uma vez.

**Pronto quando:** o teste conta ocorrências, não presença.

---

#### T-544 — Nova linha de base
**Tamanho:** P · **Ref:** ESPEC 008 §9.2

Refazer a captura nos quatro estados, agora com o painel. É contra ela que a próxima
entrega vai comparar.

**Pronto quando:** as oito imagens novas existem, e as da T-558 foram **preservadas** até
a T-547 terminar.

---

#### T-545 — `axe` e teclado
**Tamanho:** M · **Ref:** `R-ACE-04` a `R-ACE-09`

Varredura verde nos quatro estados, nas duas larguras. Percurso de teclado alcançando os
blocos recolhidos: abrir, tabular para dentro da tabela, alcançar a coluna **Saldo**.

O painel acrescenta paradas de tabulação — uma por `<details>`, mais uma por região de
rolagem. É custo previsto, e é o preço da WCAG 2.1.1.

**Pronto quando:** zero violação nova e o percurso completo sem mouse.

---

#### T-546 — Regressão do conjunto
**Tamanho:** P · **Ref:** PLANO 009 §2 · **Portão P3**

**Teste-âncora do `.docx` intacto** — 54 de 55, como hoje. Os 308 testes de backend mais
os novos. `tsc --noEmit` e `next build` limpos.

O documento **não é tocado** por tarefa nenhuma deste backlog (§1.1 regra 1). Se o âncora
quebrar, algo foi entendido errado — e a resposta não é ajustar o âncora.

**Pronto quando:** tudo verde, com os números registrados aqui.

---

#### T-547 — O grid não mudou de pixel
**Tamanho:** M · **Ref:** `R-PAN-09` · **Portão P3**

Comparar a captura da T-558 com a da T-544. Toda diferença tem de estar na lista de §2.4 —
painel, segundo botão, título do grid, bloco removido. **No corpo do grid, nenhuma.**

**Pronto quando:** as 36 linhas em 22 seções conferem, e a quinta diferença não existe.

---

#### T-557 — Tela e arquivo não divergem
**Tamanho:** P · **Ref:** `R-XLS-02`, PLANO 009 §5.4

Numa mesma execução: as contagens das quatro situações na resposta da API e as linhas das
quatro abas de detalhe do arquivo são iguais.

"Os dois saem do mesmo agregado" é verdade **hoje**. Basta alguém formatar a quantidade
num lugar e não no outro para deixar de ser — e argumento de arquitetura não é teste de
regressão.

**Pronto quando:** o teste compara os dois lados na mesma chamada, não em duas execuções.

---

## 9. Épico E6 — Documentação

#### T-548 — ESPEC 002
**Tamanho:** P

Registrar a revisão de `R-UI-03` — a **posição** do bloco de sem previsão contratual,
condicionada ao `K-03`, no formato que a §12 daquela espec já usou uma vez.

**Pronto quando:** a §12 traz a terceira revisão, com a condicional escrita.

---

#### T-549 — ESPEC 009 e PLANO 009
**Tamanho:** M

**Na espec:** status → implementada; §2.3 com os números **medidos**; §13 com o resultado
do âncora da análise; e a emenda 1 de §2.2 — `application/` fora do escopo, contra o que a
§11 previu.

**No plano:** a emenda 2 — a captura do "antes" é tarefa (T-558) e é o único ponto de não
retorno do backlog. O plano nasceu sem ela.

**Pronto quando:** nenhuma afirmação da espec contradiz o que foi entregue. Onde
contradisser, é a espec que se emenda — não a implementação que se ajusta ao texto.

---

#### T-550 — README
**Tamanho:** P

Capacidade nova na tabela de estado, o segundo entregável, o tempo de geração medido na
T-529 e a contagem de testes.

**Pronto quando:** os números vêm da medição, não da estimativa.

---

#### T-551 — CHANGELOG
**Tamanho:** P

O incremento, a decisão `D-01` e **o que ela contraria no artefato de referência**. É a
mudança de rumo desta entrega: a aplicação passa a afirmar que existe um item crítico onde
o gabarito afirma que há zero, e a razão precisa sobreviver a quem ler daqui a um ano.

**Pronto quando:** a entrada explica a discordância, não só a funcionalidade.

---

#### T-552 — Este backlog
**Tamanho:** P

Resultado, desvios e o que a implementação ensinou — como o TASKS 008 fez.

**Pronto quando:** os desvios estão escritos com o motivo, e não como lista de ajustes.

---

## 10. Insumos

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **K-01** | **Arquivo aberto no Excel**: cinco abas, sem aviso de reparo, `=SOMA()` funcionando | T-523 | **P2 não fecha.** É a única verificação de que o entregável novo é utilizável |
| **K-02** | **Aceite visual do painel** — tokens de severidade, blocos recolhíveis, grid retitulado | E4 | Risco de refazer a linha de base da T-544 depois de a T-547 já ter comparado |
| **K-03** | **Resposta ao `I-06`** — universo 56 ou 55 | T-540 | Não bloqueia E1–E4. **Bloqueia T-540**: sem resposta, o item não sai de onde está |
| **K-04** | Rótulos das quatro situações (`I-07`) | T-532 | Rótulo é dado de apresentação; muda em uma linha |

`K-03` é o único que trava uma tarefa, e trava a tarefa certa: a que remove um achado da
tela.

---

## 11. O que este backlog não faz

- **Não toca o `.docx`** — §1.1 regra 1. Quatro arquivos em somente leitura.
- **Não toca `application/`** — §1.1 regra 2, emenda registrada.
- **Não altera a reconciliação, o catálogo nem as validações.** A classificação lê
  `contratada` e `medida` como já saem.
- **Não introduz dependência nova.** `openpyxl` já está no `pyproject.toml`, para ler a
  planilha de medição.
- **Não calcula valor financeiro, percentual nem saldo agregado.** ESPEC 009 §4.2.
- **Não unifica os dois grids.** A duplicação dos 36 itens é consciente e está na ESPEC 009
  §14. Se o grid por seção deixar de ser consultado, isso é espec nova.
- **Não resolve `I-01`.** O `11.027.00001.00` continua com 10, e a divergência continua
  declarada — agora em dois âncoras.

---

## 12. O que a implementação ensinou

### 12.1 Foram **cinco** regressões, não três

O PLANO 009 §5 listou três testes existentes que este incremento quebraria, todos no
frontend. **Quebraram cinco, e as duas não previstas são de outra natureza:**

| Onde | O que quebrou | Previsto? |
|---|---|---|
| `page.tsx` | `revokeObjectURL` de um blob só | ✅ §5.1 |
| `a11y-estrutura.spec.ts` | o bloco `#sem-previsao` deixou de existir | ✅ §5.2 |
| `a11y-contraste.spec.ts` | tokens novos sem fundo | ✅ implicitamente (T-538) |
| **`test_api_e2e.py`** | **conjunto exato de chaves de `LinhaDoGrid`** | ❌ |
| **`smoke.spec.ts`** | **rótulo do bloco removido** | ❌ |

As duas não previstas têm a mesma origem: o plano procurou regressão **no frontend**,
porque era lá que a tela mudava. A asserção de contrato da API e a do teste de fumaça
estavam a uma camada de distância do que se estava olhando.

A de backend merece nota: ela afirma o **conjunto exato** de campos da resposta, e por
isso um campo aditivo a derruba. Isso é qualidade, não fragilidade — foi ela que fez o
campo novo aparecer na revisão em vez de entrar despercebido no contrato da API. Foi
atualizada mantendo o conjunto exato.

### 12.2 O gabarito tem descrição reescrita à mão

Descoberto ao montar o comparador. `ARMAZENAMENTO DE DADOS - NAS` no gabarito,
`ARMAZENAMENTO DE DADOS - BAIXA PLATAFORMA - NAS` na aplicação; `NUVEM PLANO II
WINDOWS` contra `NUVEM - PLANO II - WINDOWS 2012/2016`.

A nossa vem do contrato por `R-CTR-03` e chega a preservar o erro de digitação dele —
`DISPONIBLIZACAO DE vRAM ADICIONAL`. **Ajustar a nossa ao gabarito seria reescrever o
contrato.** A descrição saiu da comparação, com o motivo escrito no módulo do
comparador.

### 12.3 O portão P1 acusou uma terceira diferença — e ela não era divergência

O `14.070.00001.00` sai da aplicação com `117,2889788312131`, o valor da planilha de
medição. O gabarito gravou `117,29` — a precisão do relatório **impresso**, que é de
onde ele foi derivado.

Os dois lados classificam igual, e **o lado exato é o nosso**. A comparação passou a
arredondar para duas casas; a classificação continua no valor cheio (`R-ANA-06`).

Vale como aviso ao próximo âncora contra artefato externo: **o gabarito pode saber
menos que a aplicação**, e nesse caso a régua é o que ele podia saber — não o que ele
escreveu.

### 12.4 `route.fetch()` corrompe upload binário

O dublê da T-556 nasceu interceptando a chamada e reemitindo o corpo com `rota.fetch()`.
A resposta veio `400 'contrato' não é um arquivo PDF válido` — a verificação de
assinatura da T-54 pegando o corpo multipart reencodado.

O sintoma na tela do teste foi `analise` indefinida, que não tem nada a ver com a causa.
A estratégia virou: gerar de verdade, capturar a resposta boa, reemitir a versão
modificada. De quebra, não paga uma segunda geração de ~35 s.

### 12.5 O `axe` ficou verde sobre CSS quebrado, e o script de contraste não

Os tokens de severidade da T-538 saíram **transparentes** na tela: o dev server servia
CSS compilado antes da mudança de configuração, e nem reiniciar resolveu — o cache do
`.next` sobrevive ao reinício. `bg-severidade-critico` não existia, então o selo do
bloco crítico era **branco sobre branco**.

- **`axe` passou**, nas duas larguras, nos quatro estados.
- **O script de contraste da T-403 reprovou**, com contraste 1,00 e o seletor exato.

É literalmente o caso que o docstring daquele script antecipa: *"quando não consegue
determinar o fundo, o `axe` devolve incomplete, não violation — silêncio vira
aprovação"*. A ferramenta de acessibilidade mediu sintaxe; o instrumento próprio mediu
o pixel.

E há uma segunda lição, sobre o instrumento e não sobre o defeito: **um teste que
depende de build serve tanto para acusar código errado quanto build velho**, e os dois
se parecem. Só a comparação com a saída do `tailwindcss` direto separou um do outro.

---

## 13. O que ainda não foi verificado

**O arquivo no Excel.** O portão **P2** exige abrir o `.xlsx`, conferir as cinco abas
sem aviso de reparo e somar a coluna numérica com `=SOMA()`. Depende do `K-01`. O
arquivo gerado dos dois arquivos reais está em
`saida/Relatorio_Analise_Medicao.xlsx`.

A parte automática está verificada nas duas direções: o teste de tipo falha se a
coluna numérica virar texto, e o de precisão falha se o `Decimal` passar por `float`.
**Isso não é o mesmo que o arquivo abrir** — `openpyxl` relê perfeitamente o que ele
mesmo escreveu, e foi essa cegueira que deixou seis defeitos de DOCX passarem por
toda a suíte na ESPEC 003.

**O aceite visual do painel** (`K-02`), **a resposta ao `I-06`** (`K-03`) e **os
rótulos das quatro situações** (`K-04`).

Enquanto o `K-03` não vier, vale a regra de ouro de §2.3: o `14.049.00054.00` está
**uma vez** na tela, dentro de *Item crítico*. Se a resposta for "o universo são as
55 linhas", a T-540 é revertida e o bloco volta ao topo do grid — a T-542 registra o
seletor antigo no comentário justamente para isso.

**Este backlog é reversível.** O `.docx` não foi tocado, `application/` não foi
tocada, os campos da API são aditivos e nenhuma dependência entrou. O único ponto de
não retorno foi a T-558, e ela foi executada antes de qualquer edição em
`frontend/src`.
