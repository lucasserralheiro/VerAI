# PLANO 012 — Implementação da Responsividade durante a Geração

| | |
|---|---|
| **Especificação** | [ESPEC 012](../specs/012-responsividade-durante-a-geracao.md) v1.0 |
| **Versão** | 1.0 — 2026-08-11 |
| **Estado inicial** | Aplicação hospedada em Azure Container Apps (`rg-confere-des`), backend `confere-backend:v3` e frontend `confere-frontend:v3`, ambos `Running`. Frontend com *readiness* e *liveness probes*; **backend sem nenhum**. Escala do backend com `concurrentRequests: 1`, mínimo 1 e máximo 3 réplicas. 29,03 s de geração medidos na máquina de desenvolvimento; **nunca medidos em produção** |

---

## 1. O princípio que ordena este plano

A mudança de fonte desta espec é pequena: uma função extraída e um `await`. Se o plano fosse
dirigido pelo tamanho do diff, seria um parágrafo.

Ele não é, porque o que está sendo corrigido é um comportamento **concorrente**, e teste de
concorrência tem uma propriedade traiçoeira que teste de valor não tem:

> **Um teste de concorrência que não sobrepõe de verdade passa contra o código quebrado.**

Se as duas requisições do teste não estiverem realmente em voo ao mesmo tempo, `GET /health`
responde `200` — porque a geração já terminou, ou porque nem começou. O teste fica verde, o
defeito continua lá, e a espec é declarada implementada sem nunca ter sido exercida.

Há duas maneiras concretas de cair nisso neste repositório, e as duas foram verificadas (§5.1
e §5.2). Daí o princípio:

> **O teste que define a espec tem de falhar primeiro — e falhar pelo motivo certo.**

A F1 escreve o teste de `R-RSP-02` e o roda contra o código **atual**, exigindo que ele falhe
por bloqueio do *event loop*. Só depois a F2 corrige. Um teste que já nasce verde contra o
código quebrado não é critério de aceite: é decoração.

E antes de tudo isso, a F0 mede em produção — porque `D-05` fixa um *timeout* e o único número
que este projeto tem foi medido noutra máquina.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P1 — Medir em produção** | Fim da F0 | Uma geração real no `ca-confere-backend`, com 1 vCPU, cronometrada de ponta a ponta. Produz um número, não uma impressão | Não fixar `D-05` por estimativa. Sem o número, o *timeout* do frontend é chute |
| **P2 — Responsividade** | Fim da F4 | Com uma geração em curso **no Azure**, `GET /health` responde `200` | Não instalar *probe* nenhum. É a condição que a ESPEC 012 §1 identificou como impedimento |
| **P3 — *Probes* instalados** | Fim da F4 | *Readiness* e *liveness* aplicados ao `ca-confere-backend`, com uma geração completa atravessando o *liveness* **sem reinício** | Reverter os *probes*. Réplica reiniciada no meio de um relatório é pior que réplica sem *probe* |

**P1 é medição, não verificação** — vem antes da implementação e não pode reprovar nada. Os
outros dois reprovam.

**P2 antes de P3, e a ordem é o ponto inteiro da espec.** Instalar o *probe* antes de provar a
responsividade seria cometer exatamente o erro que a ESPEC 012 existe para não cometer: um
*liveness* apontado para um `/health` que não responde durante a geração mata o container no
meio do relatório.

---

## 3. Fases

### F0 — Medir em produção `[portão]`

**Objetivo:** substituir o número da máquina de desenvolvimento pelo número real. **Nenhum
arquivo é tocado nesta fase.**

| # | Tarefa | Ref. |
|---|---|---|
| T-700 | Gerar um relatório completo pela interface publicada, com os dois arquivos do piloto, cronometrando do envio à resposta | §2.3, **P1** |
| T-701 | Registrar o tempo, e registrar também o comportamento observado do `/health` **durante** a geração — hoje a expectativa é que não responda. É a evidência do defeito em produção, e o "antes" de `P2` | `R-RSP-02` |
| T-702 | Confrontar com os 29,03 s da espec §2 e com os ~36 s do README, e **fixar o valor de `D-05`** | `D-05` |

**Verificação:** existe um número medido em produção, e existe evidência registrada de que
`/health` não responde durante a geração.

> **A T-701 é o que torna `P2` demonstrável.** Sem o "antes", provar depois que `/health`
> responde não prova que alguma coisa mudou — prova apenas que responde. O defeito precisa ser
> visto vivo, no ambiente onde ele importa, antes de ser corrigido.

**Tamanho:** PP — uma hora. **Encerra:** P1.

---

### F1 — O teste que falha

**Objetivo:** ter o critério de aceite escrito e **reprovando**, contra o código atual.

| # | Tarefa | Ref. |
|---|---|---|
| T-703 | **[risco]** Teste de `R-RSP-02` com `httpx.AsyncClient` sobre `ASGITransport`, com as duas requisições em tarefas concorrentes no **mesmo** *event loop*. **Não usar `TestClient`** — ver §5.1 | `R-RSP-02`, **P2** |
| T-704 | **Provar que o teste falha contra o código atual**, e que falha por bloqueio — não por erro de fixture, importação ou *timeout* de infraestrutura de teste | §1 |
| T-705 | Prova de sobreposição: um teste que verifica que a segunda requisição de fato parte **enquanto** a primeira está em voo. Sem ele, T-703 pode ficar verde sem nunca ter sobreposto | §1, §5.2 |
| T-706 | Teste de `R-RSP-04`: duas gerações simultâneas produzem duas respostas corretas, e a segunda não começa antes de a primeira terminar | `R-RSP-04`, `D-02` |

**Verificação:** T-703 **reprova** contra `main`. T-705 passa (ela mede o teste, não a
aplicação). O restante da suíte segue verde — nada de `src/` foi tocado.

> **T-704 é uma tarefa, não uma formalidade.** O registro do modo de falha é o que distingue
> "o teste ficou verde porque corrigimos" de "o teste ficou verde porque parou de sobrepor". Na
> F2 esse registro é o gabarito.

**Tamanho:** M — meio dia. O custo está no primeiro teste assíncrono do projeto: a suíte hoje é
toda síncrona sobre `TestClient`, e `anyio.pytest_plugin` já está disponível (`pytest-asyncio`
**não** está, e não é necessário).

---

### F2 — A troca de thread

**Objetivo:** o *event loop* livre durante a geração, sem que nada mais mude.

| # | Tarefa | Ref. |
|---|---|---|
| T-707 | Extrair para função de módulo tudo entre `get_container()` e a leitura dos *bytes* — [`reports.py:130-166`](../../backend/src/api/routers/reports.py). **Movimento puro**, sem alterar uma linha de lógica | `R-RSP-01`, `D-01` |
| T-708 | Rodar a suíte com a função extraída e **ainda chamada de forma síncrona**. Verde aqui prova que a extração não mudou comportamento, antes de a concorrência entrar | `R-RSP-05` |
| T-709 | `_UMA_POR_REPLICA = anyio.CapacityLimiter(1)` no nível do módulo — verificado que funciona fora de *event loop*, ver §6.3 | `R-RSP-04`, `D-02` |
| T-710 | Trocar a chamada por `await anyio.to_thread.run_sync(..., limiter=_UMA_POR_REPLICA)`, com o `try/except` existente passando a envolver o `await` | `R-RSP-01`, `R-RSP-03` |
| T-711 | Conferir que `ExtractionError` continua saindo `422` e exceção inesperada continua saindo `500` com `logger.exception` — exceção levantada em thread propaga para o `await` | `R-RSP-03` |
| T-712 | T-703 passa. Comparar o modo de falha registrado na T-704: o teste ficou verde **por responsividade**, não por deixar de sobrepor | **P2** (local) |
| T-713 | Suíte completa verde, incluindo os dois âncoras. `ruff`, `mypy` e `bandit` limpos | `R-RSP-05` |

**Verificação:** T-712 e T-713. **`P2` ainda não fecha aqui** — a espec exige verificação no
Azure, e ela acontece na F4.

> **T-707 e T-708 andam juntas e nessa ordem.** Extrair e paralelizar no mesmo passo torna
> impossível saber a qual dos dois atribuir uma regressão. A extração é movimento de código com
> a suíte inteira como rede; a troca de thread é a mudança de verdade, e merece chegar sozinha.

**Tamanho:** P — três horas.

---

### F3 — O *timeout* do frontend

**Objetivo:** a tela deixar de esperar para sempre.

| # | Tarefa | Ref. |
|---|---|---|
| T-714 | `AbortController` no `fetch` de [`lib/api.ts`](../../frontend/src/lib/api.ts), com o *timeout* fixado na T-702 | `R-RSP-06`, `D-05` |
| T-715 | Distinguir `AbortError` de falha de rede: hoje o único `catch` devolve *"Não foi possível falar com o servidor"*, que numa geração longa culparia o servidor errado | `R-RSP-07` |
| T-716 | **[risco]** Revisar a frase *"Pode levar até um minuto"* do `UploadForm` à luz do número da T-700 — ver §6.2 | `R-RSP-07` |
| T-717 | Teste de navegador do `AbortError`, com `page.route` atrasando a resposta além do *timeout*: a mensagem de demora aparece e é distinta da de rede | `R-RSP-06`, `07` |
| T-718 | `tsc --noEmit` e `next build` limpos; `axe` verde nos quatro estados | ESPEC 008 |

**Verificação:** T-717 passa; a mensagem de demora foi lida por uma pessoa.

> **`R-RSP-08` não aparece nesta fase porque já está pronto** — ver §6.1. Esta fase é menor do
> que a espec previu, e a diferença está registrada, não absorvida em silêncio.

**Tamanho:** P — duas horas.

---

### F4 — Azure: publicar, provar e instalar `[portão]`

**Objetivo:** o defeito visto curado onde ele apareceu.

| # | Tarefa | Ref. |
|---|---|---|
| T-719 | Construir `confere-backend:v4` e `confere-frontend:v4` com `az acr build`, e publicar nos dois Container Apps | — |
| T-720 | **Repetir a T-700 e a T-701 em produção**: com uma geração em curso, `GET /health` responde `200`. É o "depois" do par | **P2** |
| T-721 | Aplicar os *probes* de [ESPEC 012 §8](../specs/012-responsividade-durante-a-geracao.md) ao `ca-confere-backend` — *readiness* e *liveness* em `/health`. Via YAML: as *flags* de *probe* não existem no `az containerapp update` | **P3** |
| T-722 | **[risco]** Uma geração completa atravessando o *liveness* **sem reinício**: conferir a contagem de reinícios da réplica antes e depois | **P3** |
| T-723 | Medir de novo o tempo de geração e confirmar que a troca de thread não o piorou de forma relevante | `D-03` |
| T-724 | Registrar a revisão ativa e a receita de *rollback* — as revisões anteriores continuam disponíveis no Container Apps | — |

**Verificação:** os critérios de `P2` e `P3`.

> **T-722 é o portão que mais importa e o mais fácil de dar por certo sem olhar.** *Probe*
> aplicado não é *probe* validado: o modo de falha desta espec é justamente uma réplica
> reiniciada silenciosamente no meio de um relatório, e o sintoma que o usuário vê é uma
> requisição que morre sem erro. Conferir a contagem de reinícios é a única forma de saber.

**Tamanho:** M — meio dia. **Encerra:** P2 e P3.

---

### F5 — Documentação

| # | Tarefa |
|---|---|
| T-725 | **ESPEC 012:** status → implementada; §2.3 preenchida com o tempo **medido em produção**; §6 com as emendas de §6 deste plano |
| T-726 | README: a limitação *"os containers não foram verificados"* já não vale — registrar o estado real da hospedagem, os *probes* e o tempo medido |
| T-727 | CHANGELOG: a correção de disponibilidade e o que ela habilitou |
| T-728 | TASKS 012 com o resultado e os desvios |

**Tamanho:** P — duas horas.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──┬──► F4 ──► F5
 P1     (falha)    │    P2 P3
                   └─ F3 (frontend, em paralelo)
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | 1,5 a 2 dias |
| 2 desenvolvedores | 1 dia — F3 em paralelo com F2 |

**F2 e F3 tocam arquivos disjuntos** — `backend/src/api/routers/` contra `frontend/src/lib/` —
e a F3 depende apenas do número que a F0 produziu, não do código da F2. É a única
paralelização útil.

---

## 5. A regressão que já está escrita

Lido no repositório, não presumido.

### 5.1 O `TestClient` pode mascarar o defeito

`test_api_e2e.py` importa `TestClient` na linha 18, define a fixture `cliente` nas linhas 36-37
e já tem um `test_saude` na linha 146 — é o único arquivo da suíte que usa `TestClient`, e o
`conftest.py` fornece apenas fixtures de caminho. O reflexo natural é escrever `R-RSP-02` ali:
disparar a geração numa *thread* e chamar `cliente.get("/health")` da *thread* principal.

**Não serve.** O `TestClient` executa a aplicação ASGI num *portal* próprio, com seu próprio
*event loop*, e a serialização que ele impõe é dele — não da aplicação. Um teste assim pode
ficar vermelho contra código correto, ou verde contra código quebrado, e em nenhum dos dois
casos estará medindo o que a espec descreve.

Daí a T-703 exigir `httpx.AsyncClient` sobre `ASGITransport`, com as duas requisições como
tarefas concorrentes do **mesmo** *event loop* — que é a topologia real do uvicorn em produção.
`httpx` já é dependência de desenvolvimento (`pyproject.toml:42`) e `anyio.pytest_plugin` já
está instalado: **nenhuma dependência nova**, nem em produção nem em teste.

### 5.2 O teste pode passar sem nunca ter sobreposto

Mesmo com o cliente certo, se a segunda requisição partir depois de a primeira ter terminado, o
`200` não significa nada. Não há nada no `pytest` que perceba isso: o teste fica verde e o
defeito segue vivo.

É por isso que a T-705 existe como tarefa própria, e por isso a T-704 exige registrar o **modo**
de falha. Na F2, o gabarito de "corrigimos" é a comparação com esse registro.

### 5.3 O que **não** quebra, e é bom saber por quê

| Asserção existente | Sobrevive? | Por quê |
|---|---|---|
| Os 16 testes de `test_api_e2e.py` sobre a forma da resposta | **Sim** | `R-RSP-05` — a resposta não muda um byte. **Se algum quebrar, esta espec errou**, e é o melhor sinal que a suíte tem |
| Teste-âncora do `.docx` e da análise | **Sim** | Nenhum renderizador é tocado |
| `test_architecture.py` | **Sim** | `domain/`, `application/` e `infrastructure/` não são tocados. A mudança mora onde o HTTP encontra o trabalho |
| `test_saude` (linha 146) | **Sim** | Continua testando `/health` em repouso. O teste novo é aditivo, e as duas perguntas são diferentes |
| `smoke.spec.ts`, `analise.spec.ts`, as quatro suítes de `a11y` | **Sim** | Usam `page.route`/`fulfill`, que responde na hora. Um `AbortController` de 180 s nunca dispara nelas |
| A mensagem de erro de rede em `api.ts` | **Sim** | **Nenhum teste fixa esse texto** — verificado. A F3 pode reescrevê-lo sem quebrar nada, e por isso mesmo precisa de revisão humana: não há rede |

### 5.4 O caminho que nenhum teste percorre

`R-RSP-04` diz "uma geração por réplica". A T-706 prova a serialização **dentro de um
processo**. O que nenhum teste deste plano prova é o comportamento com **três réplicas**, que é
a configuração de produção.

Não é lacuna corrigível aqui: exigiria orquestrar carga contra o ambiente hospedado, e o valor
não paga o custo com o uso atual. Fica registrado como o ponto cego conhecido, e é o que o
insumo `I-08` da espec decide.

---

## 6. Três acertos à ESPEC 012

Seguindo a conduta da ESPEC 007 §13 e do PLANO 009 §6.

### 6.1 `R-RSP-08` já está implementado

A espec pede indicação de progresso indeterminado como se não existisse. **Existe, e completa**
— `UploadForm.tsx` traz um `<Giro />`, o rótulo `"Processando…"`, `aria-busy={processando}` no
botão e `disabled={processando}` nos *inputs*. Veio da ESPEC 008 e foi verificado no código.

Consequência: a F3 é menor do que a espec previu. Restam `R-RSP-06` e `R-RSP-07` — o
`AbortController` e a distinção entre demora e falha de rede. **`R-RSP-08` nasce fechada.**

Proposta de emenda a `R-RSP-08`, a aplicar na T-725: a regra passa a **registrar** o
comportamento existente em vez de pedi-lo.

### 6.2 A tela já promete um minuto, e `D-05` fixa três

O `UploadForm` diz hoje, durante o processamento:

> *"Extraindo o contrato, reconciliando e montando os anexos. Pode levar até um minuto."*

`D-05` propõe *timeout* de **180 s**. Os dois números não se contradizem — um é promessa ao
usuário, o outro é limite técnico — mas ficam estranhos juntos se a geração em produção passar
de um minuto: a tela terá prometido algo que ela mesma não cumpre, e continuará esperando mais
dois minutos em silêncio.

A T-700 decide. Se o tempo real ficar acima de 60 s, a frase precisa mudar junto com o
*timeout*, e é isso que a T-716 cobra. A espec não previu essa amarração porque foi escrita
antes de alguém ler o texto da tela.

### 6.3 O `CapacityLimiter` no nível de módulo funciona — verificado

O esboço da espec §7 cria `anyio.CapacityLimiter(1)` no nível do módulo, fora de qualquer
*event loop*. Em anyio isso é motivo clássico de erro, porque primitivas de sincronização
costumam exigir um *backend* ligado.

**Não é o caso aqui:** o anyio 4.14.2 devolve um `CapacityLimiterAdapter`, que adia a ligação
para o primeiro uso. Testado no interpretador do projeto. O esboço da espec é válido como está,
e a T-709 pode segui-lo sem contorno.

Registro porque a alternativa — descobrir isso na F2 e inventar um *singleton* preguiçoso —
custaria código pior por medo de um problema que não existe.

---

## 7. O que pode dar errado, e o que pega

| O que pode dar errado | O que pega | Quando |
|---|---|---|
| **O teste de aceite passar sem sobrepor** | T-704 e T-705, e a comparação do modo de falha na T-712. É o risco central deste plano — §1 | F1, F2 |
| Escrever o teste com `TestClient` e medir o portal, não a aplicação | §5.1, e a T-703 já nomeia o cliente correto | F1 |
| Extração e paralelização no mesmo passo, sem saber a quem atribuir regressão | T-708 — a suíte verde com a função ainda síncrona | F2 |
| `ExtractionError` deixar de virar `422` ao atravessar a *thread* | T-711, mais os testes de erro já existentes em `test_api_e2e.py` | F2 |
| **A resposta mudar** | Os 16 testes de forma de `test_api_e2e.py`, que não são tocados — §5.3 | F2 |
| O GIL não liberar o suficiente e `/health` responder devagar | T-720 mede no Azure. `R-RSP-02` exige `200`, não latência; se a latência incomodar, `D-03` reabre **com dado** | F4 |
| **O *liveness* reiniciar a réplica durante a geração** — o defeito que a espec existe para evitar | T-722, conferindo a contagem de reinícios. **Nada automático pega isso**: o sintoma é uma requisição que morre sem erro | F4 |
| *Timeout* de 180 s ficar incoerente com a promessa de um minuto na tela | T-716, amarrada ao número da T-700 — §6.2 | F0, F3 |
| A mensagem nova de demora ficar confusa | **Nada automático** — nenhum teste fixa esse texto (§5.3). Só revisão humana | F3 |
| Publicar e descobrir regressão só em produção | T-724, com a receita de *rollback*. As revisões anteriores seguem disponíveis no Container Apps | F4 |
| Três réplicas se comportarem diferente de um processo | **Nada.** Ponto cego declarado — §5.4, insumo `I-08` | — |

As três linhas de "nada automático" são as mais caras de descobrir tarde, e duas delas vivem na
F4 — no ambiente onde não há suíte, só observação.

---

## 8. Insumos

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **K-05** | **Janela para gerar um relatório real em produção**, com os dois arquivos do piloto | T-700 | **P1 não fecha.** Sem ele, `D-05` vira estimativa e a T-716 não tem critério |
| **K-06** | **Aceite do texto** da mensagem de demora e, se for o caso, da frase revisada do `UploadForm` | T-716 | Texto de tela é decisão de produto. O código pode seguir com o texto proposto, marcado para revisão |
| **K-07** | Confirmação de que reiniciar réplica em desenvolvimento é aceitável durante a T-722 | T-722 | A validação do *liveness* pode ser feita fora de horário de uso; o ambiente é `des` |

`K-05` é o único que trava uma fase inteira, e trava a **primeira** — de propósito. Medir custa
uma hora e decide um parâmetro que, errado, só apareceria com o usuário na frente.

---

## 9. O que este plano não faz

- **Não acelera a geração.** Os 19 s de renderização do DOCX (ESPEC 012 §2.1) continuam onde
  estão. É o alvo óbvio de otimização e está fora do escopo por §4.2 da espec, registrado como
  insumo `I-09`.
- **Não muda a resposta da API.** `R-RSP-05`, e os 16 testes de forma são quem cobra.
- **Não introduz o padrão de job.** `D-04` — exigiria estado externo e derrubaria a ESPEC 001
  §7.2. Reabre se a T-700 mostrar tempo próximo do limite de *ingress*.
- **Não toca `domain/`, `application/` nem `infrastructure/`.** A regra de dependência não é
  exercitada, e `test_architecture.py` passa sem alteração.
- **Não adiciona dependência.** `anyio` já vem do FastAPI; `httpx` e `anyio.pytest_plugin` já
  estão no ambiente de desenvolvimento. Verificado.
- **Não resolve a autenticação nem a identidade gerenciada do ACR.** São pendências da
  hospedagem registradas fora desta espec, e misturá-las aqui faria uma correção de
  disponibilidade carregar uma mudança de segurança.
- **Não prova o comportamento com três réplicas.** §5.4.

---

## 10. Emendas da execução — 2026-08-11

### 10.1 Faltava conferir a URL da API no *bundle*

Este plano mandou construir o frontend com `--build-arg NEXT_PUBLIC_API_URL=...` (T-719) e não
previu **conferir que o valor chegou lá**. `frontend/Dockerfile` declara
`ARG NEXT_PUBLIC_API_URL=http://localhost:8000`: esquecer o argumento não produz erro nenhum —
a imagem compila, sobe, responde `200`, a tela desenha inteira, e o `fetch` aponta para um
servidor que não existe no navegador do usuário.

A lacuna foi encontrada ao escrever o backlog e fechada pela **T-729**, entre a T-719 e a
T-720. Ela pegou algo já na primeira execução, embora não o defeito para o qual foi escrita —
ver §10.2.

### 10.2 A T-729 só é válida com a revisão estabilizada

Rodada imediatamente após o `az containerapp update`, a T-729 não achou **nem** o FQDN **nem**
`localhost` nos *chunks* — resultado impossível, já que um dos dois tem de estar lá.

A causa era a transição da revisão: o HTML e os *chunks* vinham de revisões diferentes durante
o *rollout*. Repetida com a revisão estabilizada, a conferência passou — o *bundle* traz
`"https://ca-confere-backend…"` concatenado com `"/reports"`, e zero ocorrências de
`localhost`.

**A lição é sobre o instrumento, não sobre o defeito:** uma verificação de conteúdo servido
mede a revisão que está no ar, e durante um *rollout* não existe uma só. O "resultado
impossível" é o sinal — se a T-729 não achar nenhum dos dois, ela mediu cedo demais.

### 10.3 O *rollback* é por *tag*, não por revisão

A §2.1 afirmou que as revisões anteriores seguem ativas e recebem tráfego com um comando. Os
dois Container Apps estão em `activeRevisionsMode: Single`, que desativa a anterior a cada
publicação. O *rollback* real é republicar a *tag* anterior. Ver ESPEC 012 §12.4.

A §2.1 continua correta no essencial — **não há ponto de não retorno** — mas pelo motivo certo:
o que preserva a volta são as *tags* imutáveis no ACR, não as revisões.

### 10.4 A §5.3 supôs uma suíte verde, e ela não estava

A tabela da §5.3 afirmou que `smoke.spec.ts`, `analise.spec.ts` e as quatro suítes de `a11y`
sobreviveriam a esta entrega — *"usam `page.route`/`fulfill`, que responde na hora"*. A previsão
estava certa sobre o efeito desta espec e **errada sobre o ponto de partida**: o
`smoke.spec.ts` já falhava antes de qualquer linha ser alterada.

A causa eram as emendas §17.4 e §17.5 da ESPEC 009 (ver ESPEC 009 §17.6). Corrigido junto,
como entrega separada.

**O que faltou ao plano foi a captura do "antes"** — o equivalente à T-558 do PLANO 009, que
aquele plano também nasceu sem e cuja ausência o TASKS 009 §10.1 registrou. Sem ela, a única
forma de saber de quem era a falha foi `git stash` do `api.ts` e uma segunda execução.

**É a segunda vez que a lacuna aparece neste projeto, e a segunda vez que custa uma
investigação.** Para o próximo plano, como regra e não como lembrete: **se existe suíte que a
entrega pode quebrar, rodá-la é a primeira tarefa** — o "antes" custa uma execução e evita
descobrir, no meio da entrega, que se está perseguindo um defeito alheio.