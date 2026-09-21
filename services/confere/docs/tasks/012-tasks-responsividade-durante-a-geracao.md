# TASKS 012 — Backlog da Responsividade durante a Geração

| | |
|---|---|
| **Especificação** | [ESPEC 012](../specs/012-responsividade-durante-a-geracao.md) v1.0 |
| **Plano** | [PLANO 012](../plans/012-plano-responsividade-durante-a-geracao.md) v1.0 |
| **Versão** | 1.0 — 2026-08-11 |
| **Total** | 30 tarefas · 3 insumos |
| **Status** | **Concluído** — 2026-08-11. 30 tarefas · **P1, P2 e P3 fechados** |

> Escrito **antes** da implementação, como o TASKS 003, o TASKS 004, o TASKS 008 e o
> TASKS 009.

---

## 1. Convenções

**Identificadores** `T-7nn` seguem a numeração do PLANO 012, que começa em T-700 porque o
PLANO 011 fechou em T-649. A **T-729 nasce neste backlog** e está registrada como emenda em
§2.2 — por isso está fora de ordem dentro do épico. **O identificador é nome, não posição.**

**Definição de pronto — backend:** código e teste na mesma entrega; `ruff check`,
`mypy src/` e `bandit -ll -r src/` limpos; `pytest` verde; comentário explicando o *porquê*
onde a escolha não for óbvia.

**Definição de pronto — frontend:** `tsc --noEmit`, `next lint` e `playwright test` verdes;
`axe` sem violação nova.

**Definição de pronto — infraestrutura:** o recurso no estado esperado **verificado por
consulta**, não pela saída do comando que o alterou. Ver §1.1 regra 5.

**Convenção de commit** `<tipo>(T-7nn): descrição`.

### 1.1 Cinco regras que atravessam o backlog

**1 — A resposta da API não muda um byte.** É `R-RSP-05`, e quem cobra são os **16 testes**
de `backend/tests/test_api_e2e.py`, que não são tocados por tarefa nenhuma deste backlog.

Se algum deles quebrar, **pare**. Não é regressão a ajustar: é sinal de que esta espec fez
mais do que se propôs. O melhor resultado possível para esses 16 testes é continuarem verdes
sem que ninguém os abra.

**2 — `domain/`, `application/` e `infrastructure/` não são tocados. Em nenhuma tarefa.**
Este backlog inteiro mexe em dois arquivos de produção:

```
backend/src/api/routers/reports.py
frontend/src/lib/api.ts
```

Mais o texto de `frontend/src/app/components/UploadForm.tsx` na T-716, se o `K-06` mandar.
`tests/test_architecture.py` continua valendo sem alteração — e se ele quebrar, a mudança
saiu do lugar onde o defeito mora, que é onde o HTTP encontra o trabalho.

**3 — Nenhuma dependência nova, nem em produção nem em teste.** Verificado no ambiente do
projeto: `anyio` 4.14.2 já vem do FastAPI e está no `uv.lock`; `httpx` já é dependência de
desenvolvimento (`pyproject.toml:42`); `anyio.pytest_plugin` já está instalado. `pytest-asyncio`
**não** está — e não é necessário.

Se uma tarefa parecer exigir instalação, **pare**: quase certamente é o caminho errado para o
mesmo objetivo.

**4 — Nenhum *probe* no backend antes de `P2` fechar.** É a espec inteira. Um *liveness*
apontado para um `/health` que não responde durante a geração mata o container no meio do
relatório — e o sintoma que o usuário vê é uma requisição que morre sem erro.

A ordem `P2` → `P3` não é preferência de sequenciamento. É a correção sendo aplicada.

**5 — Estado de infraestrutura se confere por consulta, nunca pela resposta do comando.**
Aprendido nesta hospedagem: o `az containerapp update` devolveu `concurrentRequests: ""` para
uma regra que **estava gravada corretamente** como `1`. A resposta da chamada de alteração não
reflete o estado persistido de forma confiável.

Toda tarefa de infraestrutura deste backlog termina com um `az ... show` separado.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Situação |
|---|---|---|---|
| **E0** Medir em produção | T-700 … T-702 | **P1** | ⬜ |
| **E1** O teste que falha | T-703 … T-706 | — | ⬜ |
| **E2** A troca de thread | T-707 … T-713 | — | ⬜ |
| **E3** O *timeout* do frontend | T-714 … T-718 | — | ⬜ |
| **E4** Azure: publicar, provar e instalar | T-719 · T-729 · T-720 … T-724 | **P2** · **P3** | ⬜ |
| **E5** Documentação | T-725 … T-728 | — | ⬜ |

**Ordem de execução:** E0 → E1 → { E2 ‖ E3 } → E4 → E5. E2 e E3 tocam arquivos disjuntos —
`backend/src/api/routers/` contra `frontend/src/lib/` — e a E3 depende apenas do número que a
E0 produziu, não do código da E2 (PLANO 012 §4).

### Resultado

| O que | Antes | Depois |
|---|---|---|
| `/health` durante a geração | **2 de 6 sondas sem resposta**; pior latência 1,73 s | **10 de 10 em ~0,15 s** |
| Tempo de geração em produção | nunca medido → **22,76 s** | **21,04 s** · 27,99 s com *probes* |
| *Probes* no backend | **nenhum** | *readiness* + *liveness* em `/health` |
| *Timeout* no `fetch` do frontend | **nenhum** — espera para sempre | **180 s**, com mensagem própria |
| Testes de backend | 365 | **368** |
| Testes de navegador | 40 (39 ✅ · **1 ❌ pré-existente**) | **42, todos ✅** — a falha herdada foi corrigida |
| Resposta da API | 5.026,3 KB | **5.026,3 KB — inalterada** |
| Camadas tocadas | — | **`api/` e `frontend/lib/`**. Domínio, aplicação e infraestrutura **não** |
| Dependências novas | — | **nenhuma** |

Dois arquivos de produção mudaram: `backend/src/api/routers/reports.py` e
`frontend/src/lib/api.ts`.

### Os três portões

| Portão | Resultado |
|---|---|
| **P1 — medir em produção** | ✅ 22,76 s com 1 vCPU. A expectativa da espec §2.3 — de que produção fosse **mais lenta** que a máquina de desenvolvimento — estava errada: é mais rápida |
| **P2 — responsividade** | ✅ Dez sondas seguidas em ~0,15 s com a geração em curso. Antes, duas não obtiveram resposta em 5 s |
| **P3 — *probes* instalados** | ✅ *Readiness* e *liveness* ativos; uma geração completa atravessou o *liveness* com **zero reinícios** nas duas réplicas |

### Desvios

| Tarefa | O que mudou | Por quê |
|---|---|---|
| **T-707** | `_processar` sinaliza bloqueio devolvendo `None` nos três últimos campos, em vez de montar a resposta | O caso bloqueado fazia `return JSONResponse` de dentro do bloco extraído. Decidir status HTTP é do router, não de uma função que só sabe gerar |
| **T-711** | A verificação de bloqueio passou a testar os **quatro** campos | É o que deixa o `mypy` estreitar os tipos sem `assert` — e `assert` em código de produção é ruído que o `bandit` cobra |
| **T-714** | **A costura de testabilidade mudou de forma no meio do caminho** — ver §12.1 | A primeira versão, por variável de ambiente, **abortava toda geração real da suíte aos 3 s** |
| **T-716** | A frase *"pode levar até um minuto"* **não mudou** | O número a manteve válida: 22,76 s. A tarefa previa revisá-la se a medição passasse de 60 s |
| **T-724** | O *rollback* é por **tag**, não por revisão | `activeRevisionsMode: Single` desativa a revisão anterior a cada publicação — ver ESPEC 012 §12.4 |
| **T-729** | Só é válida com a **revisão estabilizada** | Rodada durante o *rollout*, devolveu resultado impossível: nem o FQDN nem `localhost` — ver PLANO 012 §10.2 |

### 2.1 Pontos de não retorno

**Nenhum.** É a característica mais confortável deste backlog e vale dizer por quê:

| Frente | Como se reverte |
|---|---|
| Código do backend | `git revert` da E2. A função extraída volta a ser chamada de forma síncrona |
| Código do frontend | `git revert` da E3. O `fetch` volta a não ter *timeout* |
| Imagens no ACR | As *tags* `v3` continuam no registry. Nada é sobrescrito — a E4 publica `v4` |
| Container Apps | As revisões anteriores seguem ativas e recebem tráfego com um comando (T-724) |
| *Probes* | Removíveis pelo mesmo YAML que os instalou |

**A ausência de ponto de não retorno é o que permite a E4 experimentar em `des`.** Se a T-722
mostrar réplica reiniciando no meio de um relatório, o custo de voltar é um comando — e é
exatamente esse custo baixo que torna aceitável validar o *liveness* com uma geração real em
vez de com raciocínio.

### 2.2 Um desvio já conhecido, antes de começar

Registrado agora, não contornado — é a conduta da ESPEC 007 §13 e do TASKS 009 §2.2.

**Falta uma tarefa no PLANO 012: conferir a URL da API embutida no *bundle*.**

A T-719 manda construir `confere-frontend:v4` com `az acr build --build-arg
NEXT_PUBLIC_API_URL=...`. O que o plano não registra é que
`frontend/Dockerfile` declara:

```dockerfile
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Esquecer o `--build-arg` não produz erro nenhum.** A imagem compila, sobe, responde `200`, a
tela desenha inteira — e o `fetch` aponta para `localhost:8000`, que no navegador do usuário
não é servidor nenhum. O sintoma aparece só quando alguém clica em *Gerar relatório*, e se
parece com falha de rede.

É a mesma espécie de defeito da §12.1 do TASKS 009: **código correto para o mundo anterior,
silencioso no novo** — só que aqui o mundo anterior é o `docker compose` local, para o qual
esse *default* está certo.

A **T-729** fecha a lacuna, entre a T-719 e a T-720. Emenda a aplicar no PLANO 012 pela T-726.

### 2.3 A tarefa que governa todas as outras

**A T-704.** Ela não entrega código nem configuração: entrega o **registro do modo de falha**
do teste de aceite contra o código atual.

Sem esse registro, a E2 não tem gabarito. Quando a T-712 vir o teste verde, a única forma de
saber se ele ficou verde **por responsividade** ou **por ter deixado de sobrepor** é comparar
com o que a T-704 escreveu. Um teste de concorrência que não sobrepõe passa contra o código
quebrado — e é o risco central deste backlog (PLANO 012 §1).

| Se a T-704 registrar | Então a T-712 espera |
|---|---|
| `/health` não respondeu dentro do prazo, com as duas requisições sobrepostas | O mesmo teste, mesma sobreposição, respondendo `200` |
| Qualquer outra coisa — erro de fixture, import, *timeout* do próprio `pytest` | **Pare.** O teste não está medindo o defeito, e corrigir o código não vai provar nada |

### 2.4 A régua da E4 — o que pode mudar em produção

A troca de thread não deve mudar nada observável além da responsividade. Toda diferença
medida na E4 tem de ser atribuível a esta lista:

| Onde | Delta esperado | Tarefa |
|---|---|---|
| `/health` durante a geração | **não responde → `200`** | T-720 |
| *Probes* do backend | nenhum → *readiness* + *liveness* | T-721 |
| Tempo de geração | **nenhum relevante.** A thread não acelera nem desacelera trabalho de CPU | T-723 |
| Resposta de `POST /reports` | **nenhum.** §1.1 regra 1 | — |
| Reinícios de réplica | **nenhum** | T-722 |
| Tela | *timeout* e mensagem nova de demora; o resto igual | E3 |

Se o tempo da T-723 subir de forma relevante, **pare**: a troca de thread não deveria custar
mais que o *overhead* de uma. `D-03` reabre com dado, não com suposição.

---

## 3. Épico E0 — Medir em produção `[portão P1]`

> **Nenhum arquivo é tocado neste épico.** Mede-se o que existe, antes de mudá-lo.

#### T-700 — O tempo real, com 1 vCPU
**Tamanho:** P · **Ref:** PLANO 012 F0 · **Portão P1** · **Insumo `K-05`**

Gerar um relatório completo pela interface publicada, com os dois arquivos do piloto,
cronometrando do envio à resposta.

O único número que este projeto tem — 29,03 s — foi medido na máquina de desenvolvimento, e a
réplica de produção tem **1 vCPU**. Trabalho Python puro em uma vCPU tende a ser mais lento,
não mais rápido. O README registra ~36 s, medido antes da ESPEC 009.

**Pronto quando:** o número está registrado aqui, com a data e a revisão do Container App que
o produziu.

---

#### T-701 — O "antes" do `/health`
**Tamanho:** P · **Ref:** `R-RSP-02` · **Portão P1**

Durante a geração da T-700, chamar `GET /health` e registrar o que acontece. A expectativa é
que **não responda**.

Esta é a evidência do defeito vivo, no ambiente onde ele importa. Sem ela, provar depois que
`/health` responde não prova que alguma coisa mudou — prova apenas que responde. É o mesmo
papel que a T-558 do TASKS 009 teve para a captura de tela: o "antes" de um par.

**Pronto quando:** o comportamento está descrito aqui — respondeu, demorou, ou não respondeu —
com o tempo observado.

---

#### T-702 — Fixar o *timeout* de `D-05`
**Tamanho:** P · **Ref:** `D-05`

Confrontar o número da T-700 com os 29,03 s da espec §2 e os ~36 s do README, e **fixar** o
valor do *timeout* do frontend.

A proposta da espec é 180 s: acima de qualquer geração plausível e abaixo do limite de
requisição do *ingress* do Container Apps, para que o erro chegue à tela como *timeout* nosso,
com mensagem nossa, e não como conexão cortada pela plataforma.

**Pronto quando:** o valor está decidido e escrito aqui, com o número que o justifica. Se a
geração real passar de 60 s, a T-716 herda uma segunda decisão — ver §2.2 do PLANO 012 §6.2.

---

## 4. Épico E1 — O teste que falha

> **Nenhum arquivo de `src/` é tocado neste épico.** Escreve-se o critério de aceite, e
> exige-se que ele **reprove**.

#### T-703 — O teste de `R-RSP-02` `[risco]`
**Tamanho:** M · **Ref:** `R-RSP-02` · **Portão P2**

`GET /health` responde `200` com uma geração em curso.

**Não usar `TestClient`.** `test_api_e2e.py` importa `TestClient` na linha 18 e define a
fixture `cliente` nas linhas 36-37 — é o único arquivo da suíte que o usa, e o reflexo natural
é escrever este teste ali. Não serve: o `TestClient` executa a aplicação num *portal* próprio,
com seu próprio *event loop*, e a serialização que ele impõe é **dele**, não da aplicação. Um
teste assim pode ficar vermelho contra código correto ou verde contra código quebrado.

Usar `httpx.AsyncClient` sobre `ASGITransport`, com as duas requisições como tarefas
concorrentes do **mesmo** *event loop* — que é a topologia real do uvicorn em produção.
`anyio.pytest_plugin` já está disponível; `pytest-asyncio` não é necessário.

Será o **primeiro teste assíncrono do projeto**. A suíte hoje é toda síncrona.

**Pronto quando:** o teste existe e roda. Verde ou vermelho é assunto da T-704.

---

#### T-704 — Ver o teste falhar, e registrar como
**Tamanho:** P · **Ref:** PLANO 012 §1 · **Governa a E2**

Rodar a T-703 contra `main`, sem nenhuma alteração de `src/`, e **registrar o modo de falha**.

Tem de falhar **por bloqueio do *event loop*** — não por erro de fixture, de importação, ou
por *timeout* da própria infraestrutura de teste. Um teste que já nasce verde contra o código
quebrado não é critério de aceite: é decoração.

Este registro é o gabarito da T-712. Ver §2.3.

**Pronto quando:** o modo de falha está escrito aqui, com a mensagem exata, e é atribuível ao
bloqueio.

---

#### T-705 — Prova de que o teste sobrepõe
**Tamanho:** P · **Ref:** PLANO 012 §1, §5.2

Um teste que verifica que a segunda requisição de fato parte **enquanto** a primeira está em
voo — carimbando o instante em que cada uma entra e sai.

Ele mede o **teste**, não a aplicação. Sem ele, a T-703 pode ficar verde na E2 sem nunca ter
sobreposto, e não há nada no `pytest` que perceba: o teste fica verde e o defeito segue vivo.

**Pronto quando:** o teste passa, e falha se as duas requisições forem serializadas pelo
próprio arranjo do teste.

---

#### T-706 — `R-RSP-04`: uma por réplica
**Tamanho:** P · **Ref:** `R-RSP-04`, `D-02`

Duas gerações simultâneas produzem duas respostas corretas, e a segunda não começa antes de a
primeira terminar.

Este teste **passa hoje**, por acidente: o bloqueio do *event loop* serializa tudo. Escrevê-lo
agora é o que garante que continue passando depois — quando a serialização passar a ser
escolha explícita do `CapacityLimiter` em vez de efeito colateral do defeito.

**Pronto quando:** o teste passa contra `main` **e** o motivo pelo qual ele passa hoje está no
comentário. É a única forma de a T-709 não parecer supérflua a quem ler depois.

---

## 5. Épico E2 — A troca de thread

#### T-707 — Extrair `_processar`
**Tamanho:** P · **Ref:** `R-RSP-01`, `D-01`

Extrair para função de módulo tudo entre `get_container()` e a leitura dos *bytes* —
[`reports.py:130-166`](../../backend/src/api/routers/reports.py).

**Movimento puro.** Nenhuma linha de lógica alterada, nenhuma ordem trocada, nenhum nome
melhorado de passagem. A função devolve `resultado`, `analise`, `conteudo` e
`conteudo_da_analise` — os quatro, porque `analise` é usada depois do bloco `with`, na
montagem da resposta.

**Pronto quando:** a função existe, ainda é chamada de forma síncrona, e o diff não contém
nada além de recuo e assinatura.

---

#### T-708 — A suíte verde antes da concorrência
**Tamanho:** P · **Ref:** `R-RSP-05`

Rodar a suíte completa com a função extraída e **ainda chamada de forma síncrona**.

Verde aqui prova que a extração não mudou comportamento, **antes** de a concorrência entrar.
Extrair e paralelizar no mesmo passo torna impossível saber a qual dos dois atribuir uma
regressão — e a extração tem a suíte inteira como rede, enquanto a troca de thread não tem.

**Pronto quando:** os 365 testes verdes, incluindo os 16 de `test_api_e2e.py` e os dois
âncoras.

---

#### T-709 — O limitador
**Tamanho:** P · **Ref:** `R-RSP-04`, `D-02`

`_UMA_POR_REPLICA = anyio.CapacityLimiter(1)` no nível do módulo.

**Verificado que funciona fora de *event loop*:** o anyio 4.14.2 devolve um
`CapacityLimiterAdapter`, que adia a ligação ao *backend* para o primeiro uso. Testado no
interpretador do projeto (PLANO 012 §6.3). Não inventar *singleton* preguiçoso por medo de um
problema que não existe.

O comentário precisa dizer **por que o limitador existe**, e não o que ele faz: os
renderizadores são sem estado por inspeção — nenhum deles atribui a `self` fora do `__init__`
— mas *seguro por inspeção* não é *testado*, e o `concurrentRequests: 1` do Container Apps é
alvo de escala, não limite rígido.

**Pronto quando:** o limitador existe e o comentário aponta para `D-02` e para `I-08`.

---

#### T-710 — A troca de thread
**Tamanho:** P · **Ref:** `R-RSP-01`, `R-RSP-03`

```python
resultado, analise, conteudo, conteudo_da_analise = await anyio.to_thread.run_sync(
    _processar, entradas, destino, limiter=_UMA_POR_REPLICA
)
```

O `try/except` que já existe passa a envolver o `await`.

**Pronto quando:** a chamada é assíncrona e o `import anyio` entrou.

---

#### T-711 — Os erros continuam saindo iguais
**Tamanho:** P · **Ref:** `R-RSP-03`

`ExtractionError` continua `422` com a mensagem original; exceção inesperada continua `500`
com `logger.exception`.

Exceção levantada em *thread* propaga para o `await` — mas o **traceback** atravessa a
fronteira, e é ele que o `logger.exception` grava. Conferir que o log continua útil, não só
que o código de status está certo.

**Pronto quando:** os testes de erro já existentes em `test_api_e2e.py` passam sem alteração,
e um log de falha inesperada foi lido por uma pessoa ao menos uma vez.

---

#### T-712 — O teste fica verde, e pelo motivo certo
**Tamanho:** P · **Ref:** PLANO 012 §1 · **Portão P2** (local)

A T-703 passa. **Comparar com o registro da T-704** e confirmar que a mudança de resultado é
atribuível à responsividade, não a o teste ter deixado de sobrepor — a T-705 continua verde.

**Pronto quando:** os dois testes passam juntos, e a comparação com a T-704 está escrita aqui.
`P2` **não fecha nesta tarefa**: a espec exige verificação no Azure, e ela é a T-720.

---

#### T-713 — Regressão do conjunto
**Tamanho:** P · **Ref:** `R-RSP-05`

Suíte completa verde, incluindo os dois âncoras. `ruff`, `mypy` e `bandit` limpos.
`test_architecture.py` sem alteração.

**Pronto quando:** tudo verde, com os números registrados aqui. Se algum dos 16 testes de
`test_api_e2e.py` quebrar, §1.1 regra 1: **pare**.

---

## 6. Épico E3 — O *timeout* do frontend

> **`R-RSP-08` não está neste épico porque já está pronto** — `UploadForm.tsx` traz `<Giro />`,
> o rótulo `"Processando…"`, `aria-busy` no botão e `disabled` nos *inputs*, herdados da
> ESPEC 008. A emenda está no PLANO 012 §6.1 e vira texto de espec na T-725.

#### T-714 — `AbortController`
**Tamanho:** P · **Ref:** `R-RSP-06`, `D-05`

`AbortController` no `fetch` de [`lib/api.ts`](../../frontend/src/lib/api.ts), com o valor
fixado na T-702.

Hoje a chamada não tem `signal`. Uma conexão pendurada deixa a tela esperando **para sempre**,
sem erro e sem saída — e o `<Giro />` girando indefinidamente é pior que uma mensagem, porque
promete que algo ainda vai acontecer.

**Pronto quando:** o `signal` está na chamada e o temporizador é limpo nos dois caminhos —
sucesso e falha.

---

#### T-715 — Demora não é falha de rede
**Tamanho:** P · **Ref:** `R-RSP-07`

Distinguir `AbortError` das demais falhas. Hoje o único `catch` devolve:

> *"Não foi possível falar com o servidor. Verifique se o backend está no ar."*

Numa geração longa essa frase **culpa o servidor errado**: ele está no ar e trabalhando. Quem
lê vai conferir a infraestrutura em vez de tentar de novo.

**Pronto quando:** as duas situações têm mensagem própria, e a de demora não sugere que o
backend caiu.

---

#### T-716 — A promessa da tela `[risco]`
**Tamanho:** P · **Ref:** `R-RSP-07` · **Insumo `K-06`**

O `UploadForm` diz hoje, durante o processamento:

> *"Extraindo o contrato, reconciliando e montando os anexos. Pode levar até um minuto."*

`D-05` propõe *timeout* de 180 s. Os dois números não se contradizem — um é promessa ao
usuário, o outro é limite técnico — mas ficam **estranhos juntos** se a T-700 medir mais de
60 s: a tela terá prometido algo que ela mesma não cumpre, e continuará esperando mais dois
minutos em silêncio.

A T-700 decide. Se o tempo real ficar acima de um minuto, a frase muda junto com o *timeout*.

**Pronto quando:** a frase é coerente com o número medido, ou está registrado aqui que o
número medido a manteve válida.

---

#### T-717 — O teste do *timeout*
**Tamanho:** M · **Ref:** `R-RSP-06`, `R-RSP-07`

`page.route` atrasando a resposta além do *timeout*: a mensagem de demora aparece, e é
distinta da de rede indisponível.

As suítes existentes usam `page.route`/`fulfill`, que responde na hora — um `AbortController`
de 180 s nunca dispara nelas, e por isso nenhuma quebra. Este teste precisa **atrasar de
propósito**, e o valor do atraso vem do que a T-702 fixou, não de uma constante repetida.

**Pronto quando:** o teste passa e falha se o `AbortController` for removido.

---

#### T-718 — Regressão do frontend
**Tamanho:** P · **Ref:** ESPEC 008

`tsc --noEmit` e `next build` limpos; `axe` verde nos quatro estados, nas duas larguras; os
40 testes de navegador verdes.

**Nenhum teste fixa o texto da mensagem de erro** — verificado. Isso é liberdade na T-715 e
risco aqui: a mensagem nova não tem rede, e só revisão humana a pega.

**Pronto quando:** tudo verde, e a mensagem nova foi lida por uma pessoa.

---

## 7. Épico E4 — Azure: publicar, provar e instalar `[portões P2 e P3]`

#### T-719 — Construir e publicar `v4`
**Tamanho:** P · **Ref:** PLANO 012 F4

`az acr build` das duas imagens como `confere-backend:v4` e `confere-frontend:v4`, e
publicação nos dois Container Apps de `rg-confere-des`.

*Tag* nova, nunca sobrescrever a `v3` — é o que preserva o rollback da T-724.

Dois detalhes operacionais desta hospedagem, aprendidos e não presumidos:

| Detalhe | Consequência |
|---|---|
| O `az` quebra ao imprimir os *logs* do ACR neste console — `cp1252` contra os acentos dos comentários do Dockerfile | Usar `--no-logs` e consultar o estado depois. **O build não é afetado**: roda no servidor |
| `az containerapp show -o yaml 2>&1` mistura o aviso da extensão dentro do YAML | Redirecionar o `stderr` separadamente, ou o arquivo sai inválido |

**Pronto quando:** as duas *tags* existem no ACR e os dois Container Apps apontam para elas —
verificado por `az containerapp show`, não pela saída do `update` (§1.1 regra 5).

---

#### T-729 — A URL da API no *bundle* `[risco]` `[nasce neste backlog]`
**Tamanho:** P · **Ref:** §2.2 · **Entre a T-719 e a T-720**

Conferir que o *chunk* JavaScript servido pelo frontend `v4` contém o FQDN real do backend, e
**nenhuma ocorrência de `localhost:8000`**.

`frontend/Dockerfile` declara `ARG NEXT_PUBLIC_API_URL=http://localhost:8000`. Esquecer o
`--build-arg` na T-719 **não produz erro nenhum**: a imagem compila, sobe, responde `200`, a
tela desenha inteira — e o `fetch` aponta para um servidor que não existe no navegador do
usuário. O sintoma aparece só quando alguém clica em *Gerar relatório*, e se parece com falha
de rede.

Pior: com a T-715 entregue, ele vai se parecer com a mensagem **certa** para o problema
**errado**.

O *default* não é bug — está certo para o `docker compose` local. É por isso que ele é
perigoso: é o valor correto do mundo anterior.

**Pronto quando:** o FQDN foi encontrado no *chunk* servido e `localhost:8000` não aparece em
nenhum deles.

---

#### T-720 — O "depois" do `/health` `[portão P2]`
**Tamanho:** P · **Ref:** `R-RSP-02` · **Portão P2**

Repetir a T-700 e a T-701 em produção: com uma geração em curso, `GET /health` responde `200`.

É o "depois" do par que a T-701 abriu. **Fecha `P2`** — e é o critério observável da espec
inteira, no ambiente em que o defeito foi encontrado.

**Pronto quando:** o `200` está registrado aqui, ao lado do que a T-701 registrou, e a
diferença entre os dois é a espec.

---

#### T-721 — Instalar os *probes* `[portão P3]`
**Tamanho:** M · **Ref:** ESPEC 012 §8 · **Portão P3**

*Readiness* e *liveness* em `/health` no `ca-confere-backend`, com os limiares da espec §8:
atraso 5 s / período 10 s / 3 falhas para o *readiness*; atraso 20 s / período 30 s / 3 falhas
para o *liveness*.

**Via YAML.** As *flags* de *probe* não existem no `az containerapp update` — foi assim que os
*probes* do frontend foram instalados nesta hospedagem. Exportar, editar, aplicar, e conferir
por `show` (§1.1 regra 5).

Os limiares toleram ~90 s de indisponibilidade. É margem deliberada sobre `R-RSP-02`, não
desconfiança dela: se algo escapar do limitador da T-709, o *probe* não deve ser o primeiro a
punir.

**Só executar com `P2` fechado** — §1.1 regra 4.

**Pronto quando:** os dois *probes* aparecem em `az containerapp show`, e a réplica subiu
saudável com eles.

---

#### T-722 — Uma geração atravessa o *liveness* `[risco]` `[portão P3]`
**Tamanho:** P · **Ref:** PLANO 012 §7 · **Portão P3** · **Insumo `K-07`**

Uma geração completa com os *probes* ativos, conferindo a **contagem de reinícios da réplica
antes e depois**.

*Probe* aplicado não é *probe* validado. O modo de falha desta espec é justamente uma réplica
reiniciada em silêncio no meio de um relatório, e o sintoma que o usuário vê é uma requisição
que morre sem erro — que a T-715 agora vai rotular como demora, escondendo a causa ainda mais.

**Nada automático pega isso.** É a tarefa mais fácil de dar por certa sem olhar, e a mais cara
de descobrir tarde.

**Pronto quando:** a contagem de reinícios é a mesma antes e depois, e o relatório saiu
inteiro.

---

#### T-723 — O tempo não piorou
**Tamanho:** P · **Ref:** `D-03`, §2.4

Medir de novo e comparar com a T-700.

A troca de thread não acelera nem desacelera trabalho de CPU: o esperado é **nenhuma diferença
relevante**, só o *overhead* de uma troca. Se subir de forma perceptível, **pare** — `D-03`
reabre com dado.

**Pronto quando:** os dois números estão lado a lado aqui.

---

#### T-724 — A receita de *rollback*
**Tamanho:** P · **Ref:** §2.1

Registrar a revisão ativa de cada Container App e o comando que devolve o tráfego à anterior.

Custa cinco minutos agora e vale uma hora no dia em que alguém precisar dela sob pressão —
que é sempre o dia em que ninguém lembra o nome da revisão.

**Pronto quando:** os nomes das revisões e o comando estão escritos aqui, testados ao menos
uma vez em `des`.

---

## 8. Épico E5 — Documentação

#### T-725 — ESPEC 012
**Tamanho:** M

Status → implementada. §2.3 com o tempo **medido em produção** (T-700). §6 com as três emendas
do PLANO 012: `R-RSP-08` já estava pronta, a promessa de um minuto contra o *timeout* de três,
e o `CapacityLimiter` no nível de módulo verificado.

**`R-RSP-08` passa a registrar** o comportamento existente em vez de pedi-lo.

**Pronto quando:** nenhuma afirmação da espec contradiz o que foi entregue. Onde contradisser,
é a espec que se emenda — não a implementação que se ajusta ao texto.

---

#### T-726 — PLANO 012
**Tamanho:** P

A emenda da §2.2: a conferência da URL no *bundle* é tarefa (T-729), e o plano nasceu sem ela.

**Pronto quando:** o plano registra a lacuna e por que ela era invisível.

---

#### T-727 — README e CHANGELOG
**Tamanho:** M

**No README:** a limitação *"os containers não foram verificados"* **já não vale** — eles
foram construídos, publicados e estão no ar. Registrar o estado real da hospedagem, os
*probes* e o tempo medido em produção.

**No CHANGELOG:** a correção de disponibilidade e o que ela habilitou. A entrada precisa
explicar que a ausência de *probes* era sintoma, não esquecimento.

**Pronto quando:** os números vêm da medição, não da estimativa, e o README não afirma mais
algo que deixou de ser verdade.

---

#### T-728 — Este backlog
**Tamanho:** P

Resultado, desvios e o que a implementação ensinou — como o TASKS 008 e o TASKS 009 fizeram.

**Pronto quando:** os desvios estão escritos com o motivo, e não como lista de ajustes.

---

## 9. Insumos

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **K-05** | **Janela para gerar um relatório real em produção**, com os dois arquivos do piloto | T-700 | **P1 não fecha.** Sem ele, `D-05` vira estimativa e a T-716 fica sem critério |
| **K-06** | **Aceite do texto** da mensagem de demora e, se for o caso, da frase revisada do `UploadForm` | T-716 | Texto de tela é decisão de produto. O código pode seguir com o texto proposto, marcado para revisão |
| **K-07** | Confirmação de que **reiniciar réplica em `des` é aceitável** durante a validação do *liveness* | T-722 | A validação pode ir para fora de horário de uso. O ambiente é `des`, e §2.1 mostra que tudo se reverte |

`K-05` é o único que trava uma fase inteira, e trava a **primeira** — de propósito. Medir custa
uma hora e decide um parâmetro que, errado, só apareceria com o usuário na frente.

---

## 10. O que este backlog não faz

- **Não acelera a geração.** Os 19,08 s de renderização do DOCX — 66% do tempo — continuam
  onde estão. É o alvo óbvio de otimização e está fora do escopo por ESPEC 012 §4.2, registrado
  como insumo `I-09`.
- **Não muda a resposta da API.** §1.1 regra 1, e os 16 testes de `test_api_e2e.py` são quem
  cobra.
- **Não toca `domain/`, `application/` nem `infrastructure/`.** §1.1 regra 2. Dois arquivos de
  produção no total.
- **Não introduz o padrão de job.** `D-04` — exigiria estado externo e derrubaria a ESPEC 001
  §7.2. Reabre se a T-700 mostrar tempo próximo do limite de *ingress*.
- **Não introduz dependência nova.** §1.1 regra 3, verificado.
- **Não resolve a autenticação nem a identidade gerenciada do ACR.** São pendências da
  hospedagem registradas fora desta espec. Misturá-las aqui faria uma correção de
  disponibilidade carregar uma mudança de segurança.
- **Não prova o comportamento com três réplicas.** A T-706 prova a serialização **dentro de um
  processo**; produção tem até três. Exigiria orquestrar carga contra o ambiente hospedado, e o
  valor não paga o custo com o uso atual. Ponto cego declarado — PLANO 012 §5.4, insumo `I-08`.
- **Não altera `min-replicas` nem o custo.** Os ~US$ 40/mês do ambiente são consequência do
  `min-replicas 1`, e mudá-lo é decisão de operação, não desta espec.

---

## 11. O que ainda não foi verificado

Tudo. Este backlog está escrito antes da implementação, e os três portões estão abertos.

O que **já se sabe** e não precisa ser redescoberto, tudo verificado nesta sessão:

| Fato | Como se sabe |
|---|---|
| Os renderizadores são sem estado | Nenhum atribui a `self` fora do `__init__` |
| `anyio.CapacityLimiter(1)` funciona no nível de módulo | Testado no interpretador do projeto — `CapacityLimiterAdapter` |
| Nenhuma dependência é necessária | `anyio` no `uv.lock`, `httpx` em `pyproject.toml:42`, `anyio.pytest_plugin` instalado |
| `R-RSP-08` já está pronta | `<Giro />`, `"Processando…"`, `aria-busy`, `disabled` — ESPEC 008 |
| O `fetch` não tem `signal` nem `AbortController` | `lib/api.ts` |
| Nenhum teste fixa o texto da mensagem de erro | Busca em `frontend/` |
| As três fases custam 9,79 s + 19,08 s + 0,16 s | Medido sobre os *fixtures* do piloto |

O que **falta saber**, e cada um tem tarefa: o tempo em produção (T-700), se `/health` de fato
não responde hoje no Azure (T-701), se o teste falha pelo motivo certo (T-704), e se o
*liveness* deixa uma geração passar inteira (T-722).

> **Todas as quatro foram respondidas na execução.** Ver §12.

---

## 12. O que a implementação ensinou

### 12.1 A costura de testabilidade quebrou a suíte inteira, e o teste dela passava

`R-RSP-06` precisava exercitar o estouro do *timeout*, e 180 s não cabem no limite de 120 s por
teste do Playwright. A primeira solução foi encurtar o teto por variável de ambiente no
`webServer` do `playwright.config.ts`.

**Ela valia para todos os casos.** Os estados `pronto` levam ~30 s de geração real, e passaram
a ser **abortados aos 3 s** — 21 dos 42 casos da suíte dependem desse estado.

O que torna o episódio instrutivo é o que *passou*: o `timeout.spec.ts`, rodado isolado, ficou
verde nos dois casos. Ele usa `route.fulfill`, que responde na hora, e por isso era o único
teste da suíte **imune ao defeito que ele mesmo introduziu**. Rodá-lo sozinho deu falsa
confiança; foi a suíte completa que pegou.

A correção troca o alcance da costura: `addInitScript` encurta o teto **por página**, e só na
do teste do estouro. O `playwright.config.ts` voltou ao original.

**A lição é sobre alcance, não sobre a técnica.** Uma costura de teste que vale para o processo
inteiro é indistinguível de uma mudança de comportamento — e o teste que a justifica costuma
ser justamente o que não a sente.

### 12.2 Faltou a captura do "antes" — de novo, e a §5 não previu

Ao ver `smoke.spec.ts:41` falhar, não havia como saber se a falha era desta entrega. **Nenhuma
execução da suíte de navegador foi feita antes de a primeira linha ser alterada.**

A resposta veio por `git stash` do `api.ts`: a falha se reproduz **idêntica** no código
original. É pré-existente em `f1f6ea6`, anterior a esta espec.

**Diagnosticada e corrigida como entrega separada.** As emendas §17.4 e §17.5 da ESPEC 009
mudaram a tela depois de a T-542 já ter ajustado o `smoke.spec.ts`, e ele não foi reexecutado:
uma asserção exigia visibilidade de conteúdo que passou a nascer dentro de bloco fechado, outra
procurava o rótulo de um quadro-resumo que saiu da tela. Nenhuma regra foi violada — o teste
seguia o **arranjo** em vez da intenção. Registro completo na ESPEC 009 §17.6.

O TASKS 009 teve uma tarefa exatamente para isso — a T-558, *"a captura do antes"*, que aquele
plano também nasceu sem. **É a segunda vez que a lacuna aparece, e a segunda vez que é
descoberta em execução.** Para o próximo backlog: se existe suíte que a entrega pode quebrar,
a primeira tarefa é rodá-la — o "antes" custa uma execução e vale uma investigação.

### 12.3 A produção é mais rápida que a máquina de desenvolvimento

A espec §2.3 argumentou que 1 vCPU tornaria a geração **mais lenta** que os 29,03 s medidos
localmente, e condicionou `D-05` a isso. Medido: **22,76 s**.

O raciocínio estava certo na forma — medir antes de fixar o parâmetro — e errado na conclusão.
Foi barato porque a espec não decidiu nada com base na estimativa: mandou medir.

Efeito colateral bom: a frase *"pode levar até um minuto"* da tela, que a §6.2 do plano
suspeitava incoerente com o teto de 180 s, ficou válida sem mudança.

### 12.4 O `TestClient` teria escondido tudo

A §5.1 do plano previu que escrever `R-RSP-02` sobre `TestClient` mediria o *portal* dele, não
a aplicação. A previsão não chegou a ser testada — o teste nasceu com `ASGITransport` —, mas o
cuidado seguinte foi o que valeu: **a asserção é sobre instantes, não sobre latência.**

Com o *event loop* bloqueado, a tarefa da sonda não chega a partir; quando enfim roda, o
cronômetro dela começa naquele momento e mede uma latência **pequena**. Latência sozinha faria
o teste passar contra o código quebrado. O que separa os dois mundos é *quando a sonda responde
em relação ao fim da geração*:

| | Antes (T-704) | Depois (T-712) |
|---|---|---|
| Geração | 30,37 s | 28,76 s |
| Sonda respondeu | 30,37 s — **no fim** | **2,42 s** |
| Folga | **−0,00 s** | **+26,33 s** |

O `-0,00 s` é a assinatura do defeito: a sonda atendida no mesmo instante em que o trabalho
acabou. É esse número que a T-704 existiu para registrar, e é contra ele que o verde da T-712
foi julgado.

### 12.5 A suíte de navegador leva 15,7 minutos, e 21 gerações explicam por quê

Medido ao investigar a demora: 18 chamadas diretas a `pronto(page)` mais 3 casos da varredura
por estado. **Cada uma regenera o relatório do zero**, ~30 s, contra o backend local — a mesma
saída de 5 MB, recalculada 21 vezes.

Não é problema desta espec e não foi tocado. Fica registrado como alvo: um estado `pronto`
capturado uma vez e reemitido por `page.route` — técnica que a T-556 do TASKS 009 já usa para
o estado vazio — derrubaria a suíte de ~16 min para ~1 min.

---

## 13. O que ainda não foi verificado

**A suíte de navegador está inteira verde** — 42 de 42. A falha herdada foi diagnosticada e
corrigida (§12.2, ESPEC 009 §17.6), então nada resta em aberto do lado dos testes.

**As pendências da hospedagem seguem abertas**, e são anteriores a esta espec: não há
autenticação nas duas URLs, e o ACR é acessado por senha de administrador em vez da identidade
gerenciada `id-confere-des`, que existe mas não recebeu `AcrPull` — a conta usada não tem
permissão em `Microsoft.Authorization`.

**O comportamento com três réplicas** continua sem prova: a T-706 verifica a serialização
dentro de **um** processo. Ponto cego declarado desde o plano (§5.4), insumo `I-08`.

**Os `~US$ 40/mês`** seguem sendo consequência do `min-replicas 1`. Fora do escopo desta espec,
e decisão de operação.