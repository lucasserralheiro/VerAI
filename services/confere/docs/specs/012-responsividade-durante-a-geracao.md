# ESPEC 012 — Responsividade durante a geração

| | |
|---|---|
| **Status** | **Implementada** — 2026-08-11. Portões P1, P2 e P3 fechados |
| **Versão** | 1.1 — 2026-08-11 — implementada, com quatro emendas em §12 |
| **Depende de** | [ESPEC 001](001-mvp-analise-medicao.md), [ESPEC 003](003-relatorio-em-docx.md), [ESPEC 009](009-analise-da-medicao.md) — implementadas |
| **Afeta** | Nenhum requisito funcional. A resposta da API não muda um byte — ver `R-RSP-05` |
| **Origem** | Hospedagem em Azure Container Apps, 2026-08-11: a configuração de *probes* do backend foi deixada de fora por impedimento técnico, e este é o impedimento |

---

## 1. Problema

`POST /reports` é declarado `async def`, mas executa dentro do *event loop* três operações
síncronas e longas: `container.gerar()`, o renderizador do DOCX e o da análise
([`reports.py:130-166`](../../backend/src/api/routers/reports.py)).

Enquanto elas rodam, **o processo inteiro não atende mais nada**. Não é lentidão de uma
requisição: é indisponibilidade de todas. O `/health` não responde, uma segunda requisição
não é sequer lida do socket, e o servidor não tem como dizer que está vivo.

A consequência prática apareceu na hospedagem. O Azure Container Apps ignora o `HEALTHCHECK`
do `Dockerfile` e usa *probes* próprios. **Nenhum foi configurado no backend**, e não por
esquecimento: um *liveness probe* apontado para `/health` mataria o container **no meio da
geração de um relatório** — o processo está trabalhando, mas é indistinguível de um processo
travado. O frontend, que não tem o problema, recebeu seus dois *probes* normalmente.

Ou seja: a aplicação não pode ter verificação de saúde no backend enquanto o *event loop*
estiver bloqueado. A ausência de *probes* é sintoma, não causa.

---

## 2. O que foi medido

Geração completa sobre os dois arquivos do piloto (`backend/tests/fixtures/`), com as três
fases cronometradas isoladamente, na máquina de desenvolvimento:

| Fase | Tempo | Fatia |
|---|---|---|
| `gerar()` — extração do PDF, leitura do XLSX, reconciliação e validações | 9,79 s | 34% |
| Renderizar o `.docx` | **19,08 s** | **66%** |
| Renderizar o `.xlsx` da análise | 0,16 s | 0,5% |
| **Total síncrono** | **29,03 s** | |

Saída: `.docx` de **3.766 KB**, `.xlsx` de 12 KB.

Três leituras deste quadro dirigem a espec.

### 2.1 A renderização do DOCX é dois terços do bloqueio

O custo está onde a ESPEC 004 previu: emitir ~25 mil células dos anexos, uma a uma. Nada aqui
propõe otimizá-lo — ver §4.2. O ponto é que **19 dos 29 segundos** de surdez do servidor vêm de
uma única chamada, e é ela que precisa sair do *event loop* antes de qualquer outra.

### 2.2 O renderizador da análise não agravou nada

A ESPEC 009 acrescentou uma terceira chamada síncrona, e a suspeita ao hospedar foi que a
janela de bloqueio tivesse crescido de forma relevante. **Não cresceu: 0,16 s.** A ESPEC 009
§14 previu isso corretamente ao argumentar que ~60 linhas em cinco abas são outra ordem de
grandeza que ~25 mil células. Fica registrado para que a suspeita não se repita.

### 2.3 Os 29 s não são o número de produção — e a produção é mais rápida

A medição acima é de máquina de desenvolvimento. Em produção cada réplica tem **1 vCPU**
(`ca-confere-backend`, Azure Container Apps), e o trabalho é Python puro — a expectativa era
que o tempo fosse **maior**, não menor. O README registra ~36 s, medido antes da ESPEC 009.

**A expectativa estava errada.** Medido em produção pelo portão P1, com os dois arquivos do
piloto:

| Momento | Tempo de geração |
|---|---|
| Antes da correção (T-700) | **22,76 s** |
| Depois da correção (T-720) | **21,04 s** |
| Depois, com *probes* ativos (T-722) | **27,99 s** |

A vCPU do Container Apps é mais rápida que a máquina de desenvolvimento deste projeto, e a
variação entre execuções (21 a 28 s) é maior que qualquer custo da troca de thread. **A
correção não mudou o tempo**, como `D-03` previu: ela não acelera nem desacelera trabalho de
CPU. O que mudou está em §2.5.

### 2.5 A evidência do defeito, e a da cura

O portão P1 sondou `GET /health` a cada 2 s durante uma geração real, antes e depois.

| | Antes (T-701) | Depois (T-720) |
|---|---|---|
| Sondas emitidas | 6 | 10 |
| Responderam `200` | 4 | **10** |
| Sem resposta (`ReadTimeout` de 5 s) | **2** | **0** |
| Pior latência observada | **1,73 s** | 0,45 s |

Entre t+5,5 s e t+21 s o servidor ficou mudo ou 13× mais lento que em repouso. Depois, dez
sondas seguidas em ~0,15 s, com a geração em curso o tempo todo.

Nenhuma decisão desta espec depende do valor exato, mas `D-05` depende da ordem de grandeza.
Por isso o portão **P1** (§9) mede em produção antes de fixar o *timeout* do frontend.

### 2.4 A resposta carrega quase 5 MB

O `.docx` de 3.766 KB viaja em base64 dentro do JSON, o que o leva a ~5.020 KB, e nesse
instante coexistem em memória os *bytes*, a *string* base64 e o JSON serializado. Com 2 GiB
por réplica há folga, e **isto não é objeto desta espec** — mas é o número que decidirá, um
dia, se a ESPEC 002 §6 precisa da saída que ela mesma já registrou (cache curto com
identificador). Fica medido.

---

## 3. Objetivo

Devolver o *event loop* ao servidor durante a geração, para que o backend continue atendendo
`/health` e demais requisições enquanto trabalha.

**Não é acelerar a geração.** Os 29 s continuam 29 s. O que muda é que deixam de ser 29 s de
servidor surdo.

---

## 4. Escopo

### 4.1 Dentro do escopo

- Executar o bloco síncrono fora do *event loop*, numa única troca de thread.
- Limitar explicitamente a uma geração por réplica.
- Configurar *readiness* e *liveness probes* no backend em produção.
- `AbortController` com *timeout* no `fetch` do frontend, e indicação de progresso.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Acelerar a renderização do DOCX | São os 19 s de §2.1 e é o alvo óbvio de otimização — mas é outro problema, com outro critério de aceite (o teste-âncora) e outro risco. Misturar as duas coisas faria uma mudança de desempenho passar de carona numa correção de disponibilidade |
| Paralelismo real dentro de uma réplica | O trabalho é Python puro sob o GIL. Threads devolvem responsividade, **não vazão** — ver `D-03`. Vazão vem de réplicas, já configuradas |
| Padrão de job (`202` + *polling*) | Exigiria estado externo (Redis ou Storage) e quebraria a ESPEC 001 §7.2, que é decisão declarada do projeto, não omissão. Ver `D-04` |
| *Workers* do uvicorn por réplica | Com 1 vCPU por réplica, mais *workers* disputam a mesma CPU. Escalar por réplica é mais limpo e já está feito |
| Streaming ou download por URL | Depende de armazenamento, mesmo impedimento de `D-04` |
| Mudar a resposta da API | `R-RSP-05` — esta espec é invisível para quem consome a API |

---

## 5. Regras

| ID | Regra |
|---|---|
| `R-RSP-01` | Todo o trabalho síncrono de `POST /reports` roda **fora do event loop**, numa **única** troca de thread — não uma por chamada |
| `R-RSP-02` | Durante uma geração em curso, `GET /health` responde `200`. É o critério observável da espec inteira |
| `R-RSP-03` | O mapeamento de erros não muda: `ExtractionError` continua saindo `422`, exceção inesperada continua saindo `500` com `logger.exception`. Exceções levantadas na thread propagam para o `await` e são tratadas onde já eram |
| `R-RSP-04` | **Uma geração por réplica**, imposta no código e não só pela configuração de escala. Ver `D-02` |
| `R-RSP-05` | A resposta de `POST /reports` é **idêntica à de hoje** — mesmos campos, mesmos valores, mesmos bytes de documento. Verificado por regressão, não por inspeção |
| `R-RSP-06` | O `fetch` do frontend usa `AbortController` com *timeout* explícito. Hoje não usa nenhum: em `lib/api.ts` a chamada não tem `signal`, e uma conexão pendurada deixa a tela esperando **para sempre**, sem erro |
| `R-RSP-07` | Esgotado o *timeout*, a mensagem distingue **demora** de **falha de rede**. Hoje o único `catch` devolve *"Não foi possível falar com o servidor"*, que numa geração longa culparia o servidor errado |
| `R-RSP-08` | Enquanto a requisição está em curso, a tela indica progresso **indeterminado** — não percentual. O backend não emite etapa, e barra de percentual que não mede nada é mentira de interface |
| `R-RSP-09` | Nenhuma dependência nova. `anyio` (4.14.2) já está no `uv.lock` como dependência transitiva do FastAPI |

---

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **Uma troca de thread para o bloco inteiro**, extraindo as três chamadas para uma função síncrona própria — não `to_thread` em cada uma | Três trocas custariam três vezes o mesmo *overhead* e, pior, devolveriam o controle ao *event loop* entre as fases, dando a falsa impressão de que o problema é intermitente. O bloco é um trabalho só e sai como um |
| `D-02` | **`CapacityLimiter(1)`**: uma geração por réplica, explícita no código | Verifiquei que `DocxRenderer` e `XlsxAnaliseRenderer` **não atribuem a `self` fora do `__init__`** — são sem estado, e concorrência seria segura. Mas *segura por inspeção* não é *testada*: hoje o bloqueio do *event loop* serializa tudo por acidente, e tirá-lo passaria a permitir concorrência que o projeto nunca exercitou. A configuração do Container Apps usa `concurrentRequests: 1`, que é **alvo de escala, não limite rígido** — duas requisições podem cair na mesma réplica. O limitador preserva exatamente a semântica de hoje e torna a serialização uma escolha visível, revogável numa linha |
| `D-03` | **Threads, não processos** | Sob o GIL, uma thread não dá vazão para trabalho de CPU em Python puro. Mas o interpretador libera o GIL periodicamente, e isso basta para o *event loop* atender `/health` — que é o objetivo (§3). Vazão viria de processos, e a resposta a vazão neste projeto são réplicas, já configuradas com máximo 3 |
| `D-04` | **Não adotar o padrão de job** | É a resposta de livro para trabalho longo em HTTP. Exige estado compartilhado, e a ESPEC 001 §7.2 decidiu que a aplicação é sem estado — decisão que atravessa o projeto inteiro e que uma espec de disponibilidade não deve derrubar de lado. Reavaliar se `P1` mostrar tempo próximo do limite de ingress, ou se aparecerem usuários simultâneos |
| `D-05` | *Timeout* do frontend em **180 s** | Acima de qualquer geração plausível (29 s medidos, ~36 s no README, margem larga para 1 vCPU) e abaixo do limite de requisição do ingress do Container Apps, para que o erro chegue à tela como *timeout* nosso, com mensagem nossa, e não como conexão cortada pela plataforma. Valor confirmado no portão `P1` |
| `D-06` | O `get_container()` e o `_obter()` do DI **ficam como estão** | Ambos fazem verifica-e-cria sem trava, o que com `D-02` nunca chega a ser exercitado em concorrência — e, mesmo sem ele, o pior caso é construir duas vezes um objeto sem estado e descartar um. Pôr trava aqui seria proteger contra um problema que `D-02` já impede |

---

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `api/routers/reports.py` | Extrair para uma função de módulo tudo o que hoje roda entre `container = get_container()` e a leitura dos *bytes*, e chamá-la com `anyio.to_thread.run_sync` sob o limitador de `D-02`. O `try/except` que mapeia `422` e `500` passa a envolver o `await` |
| `frontend/src/lib/api.ts` | `AbortController` com *timeout* de `D-05`; distinguir `AbortError` de falha de rede (`R-RSP-07`) |
| `frontend/src/app/components/UploadForm.tsx` | Indicação de progresso indeterminado (`R-RSP-08`) |
| **Infraestrutura** | *Probes* do `ca-confere-backend` — §8. Não é código do repositório; é configuração do Container Apps |

**Nada muda em `domain/`, `application/` ou `infrastructure/`.** A regra de dependência não é
tocada e `tests/test_architecture.py` continua valendo sem alteração. Esta espec mexe onde o
HTTP encontra o trabalho, que é exatamente onde o defeito mora.

Esboço do núcleo, para fixar a forma e não a sintaxe:

```python
_UMA_POR_REPLICA = anyio.CapacityLimiter(1)  # D-02


def _processar(entradas: Entradas, destino: Path) -> tuple[...]:
    """Tudo o que é síncrono e pesado. Roda fora do event loop (R-RSP-01)."""
    container = get_container()
    resultado = container.gerar(entradas)
    if resultado.bloqueado or resultado.relatorio is None:
        return resultado, None, None, None
    documento = container.renderizador().renderizar(resultado.relatorio, destino / NOME_DA_SAIDA)
    analise = AnaliseDaMedicao.de_relatorio(resultado.relatorio)
    planilha = container.renderizador_de_analise().renderizar(analise, destino / NOME_DA_ANALISE)
    return resultado, analise, documento.read_bytes(), planilha.read_bytes()
```

E no endpoint, dentro do `try` que já existe:

```python
resultado, analise, conteudo, conteudo_da_analise = await anyio.to_thread.run_sync(
    _processar, entradas, destino, limiter=_UMA_POR_REPLICA
)
```

---

## 8. O que isto habilita na infraestrutura

Fechada `R-RSP-02`, o backend passa a poder ter os *probes* que o frontend já tem:

| Probe | Caminho | Configuração | Papel |
|---|---|---|---|
| *Readiness* | `/health` | atraso 5 s, período 10 s, *timeout* 5 s, 3 falhas | Não mandar tráfego para réplica que ainda não subiu |
| *Liveness* | `/health` | atraso 20 s, período 30 s, *timeout* 5 s, 3 falhas | Reiniciar réplica realmente travada |

O *liveness* é o que hoje é proibido, e é o que mais importa: sem ele, uma réplica travada de
verdade fica travada até alguém perceber. Com o *event loop* livre, `/health` volta a
significar o que o nome diz.

Os limiares acima toleram ~90 s de indisponibilidade antes de reiniciar. Isso é margem
deliberada sobre `R-RSP-02`, não desconfiança dela: se algo escapar do limitador de `D-02`, o
*probe* não deve ser o primeiro a punir.

---

## 9. Testes e critério de aceite

| Nível | Cobertura |
|---|---|
| **Aceite** | `R-RSP-02` — com uma geração em curso, `GET /health` responde `200`. É o teste que define a espec: hoje ele **falha**, e é preciso vê-lo falhar antes de corrigir |
| Regressão | `R-RSP-05` — o teste-âncora do `.docx` e o da análise continuam passando, sem alteração. Se a resposta mudar, esta espec errou |
| Regressão | `R-RSP-03` — arquivo ilegível continua `422` com a mensagem de `ExtractionError`; achado bloqueante continua `422` sem documento e sem análise |
| Unitário | `R-RSP-04` — duas requisições simultâneas produzem duas respostas corretas, e a segunda não começa antes de a primeira terminar |
| Frontend | `R-RSP-06` / `R-RSP-07` — requisição que estoura o *timeout* produz mensagem de demora, distinta da de rede indisponível |
| Navegador | `R-RSP-08` — o progresso aparece durante a espera e some ao fim; `axe` sem violações novas |

### Portões

| ID | Portão | Fecha quando |
|---|---|---|
| `P1` | **Medir em produção** | Uma geração real no `ca-confere-backend`, cronometrada, com 1 vCPU. Confirma ou corrige `D-05` e diz se `D-04` precisa ser reaberta |
| `P2` | **Responsividade** | `R-RSP-02` verificado **no Azure**, não só localmente: `/health` respondendo durante uma geração real |
| `P3` | ***Probes* instalados** | §8 aplicado ao `ca-confere-backend`, com uma geração completa atravessando o *liveness* sem reinício |

`P1` vem antes da implementação — é medição, não verificação. `P2` e `P3` vêm depois, nesta
ordem: instalar *probe* antes de provar `R-RSP-02` seria repetir o erro que esta espec existe
para não cometer.

---

## 10. Riscos

| Risco | Mitigação |
|---|---|
| **Tirar o bloqueio expõe concorrência nunca exercitada** — os renderizadores são sem estado por inspeção, não por teste | `D-02`: o limitador mantém a serialização de hoje. O risco é adiado de propósito, e removê-lo passa a ser uma decisão explícita com teste próprio |
| **O GIL não liberar o suficiente e `/health` continuar lento** | `R-RSP-02` mede `200`, não latência. Se a latência incomodar, a saída é processo em vez de thread — e aí `D-03` é reaberta com dado, não com suposição |
| **`run_sync` não é cancelável**: cliente que desiste deixa a thread terminando o trabalho | Aceito. Com `D-02` a réplica fica ocupada até o fim, o que já é o comportamento de hoje. Cancelamento exigiria cooperação do renderizador, que é síncrono e de terceiros |
| **O *timeout* de `D-05` ficar curto para um contrato maior que o piloto** | `P1` mede antes de fixar. E o valor é uma constante, não uma decisão de arquitetura |
| **O *liveness probe* reiniciar durante geração**, o defeito que a espec quer evitar | §8 tolera ~90 s, bem acima dos 29 s medidos, e `P3` exige uma geração completa atravessando o *probe* antes de dar a espec por fechada |

---

## 11. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-08` | Quantas conferências simultâneas o uso real produz? Uma pessoa por vez, ou vários analistas na mesma competência? | Não bloqueia. Decide se `D-02` (uma por réplica, máximo 3) é suficiente ou se `D-04` precisa ser reaberta |
| `I-09` | Os 19 s de renderização do DOCX (§2.1) são aceitáveis como estão, ou há apetite para uma espec de desempenho? | Não. Fora do escopo por §4.2, registrado aqui para não se perder |

---

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | `P1` — medir em produção | PP |
| B | Extrair `_processar` e chamar com `to_thread`, sob o limitador | P |
| C | Teste de aceite de `R-RSP-02` e regressões | P |
| D | `AbortController`, mensagens e progresso no frontend | P |
| E | `P2` e `P3` — verificar no Azure e instalar os *probes* | PP |

**Total: meio a um dia.** O que torna barato é o tamanho da mudança de fonte — um `await` e
uma função extraída, sem tocar em domínio, aplicação ou infraestrutura, e sem dependência
nova. O que custa é a verificação, que precisa acontecer **no Azure** e não só na máquina de
desenvolvimento: é lá que o defeito se manifestou e é lá que ele tem de ser visto curado.

---

## 12. Emendas da implementação — 2026-08-11

Quatro afirmações desta espec não sobreviveram ao contato com o código. Registradas aqui, não
contornadas — é a conduta da ESPEC 007 §13.

### 12.1 `R-RSP-08` já estava pronta

A regra pede indicação de progresso indeterminado como se não existisse. **Existia, completa**,
desde a ESPEC 008: `UploadForm.tsx` traz um `<Giro />`, o rótulo `"Processando…"`,
`aria-busy` no botão e `disabled` nos *inputs*.

`R-RSP-08` passa a **registrar** o comportamento existente em vez de pedi-lo. A frente de
frontend desta espec ficou sendo `R-RSP-06` e `R-RSP-07` — o `AbortController` e a distinção
entre demora e queda.

### 12.2 A promessa de um minuto sobreviveu à medição

A §6.2 do PLANO 012 levantou que o `UploadForm` promete *"pode levar até um minuto"* enquanto
`D-05` fixa 180 s, e amarrou a revisão da frase ao número medido.

**O número a manteve válida:** 22,76 s em produção, bem abaixo do minuto prometido. A frase
fica como está. O `timeout` de 180 s continua sendo teto técnico, não expectativa — e a
distância entre os dois é folga, não incoerência.

### 12.3 O *timeout* precisou virar configurável para poder ser testado

`D-05` fixou 180 s. O limite por teste do Playwright é **120 s**: com o valor gravado no
código, o caminho do estouro seria **intestável**, e `R-RSP-06` ficaria sem prova.

`TIMEOUT_MS` passou a ler `NEXT_PUBLIC_TIMEOUT_MS`, com padrão 180 s. A suíte de navegador sobe
o servidor com 3 s (`playwright.config.ts`); em produção vale o padrão. Os demais casos usam
`route.fulfill`, que responde na hora, e não são afetados.

É costura de testabilidade, não configuração de produto — mas é superfície pública nova, e por
isso está registrada em vez de introduzida em silêncio.

### 12.4 O *rollback* não é por revisão: é por *tag*

A §2.1 do PLANO 012 afirmou que *"as revisões anteriores seguem ativas e recebem tráfego com um
comando"*. **Não seguem.** Os dois Container Apps estão em `activeRevisionsMode: Single`, que
desativa a revisão anterior a cada publicação — verificado, e não presumido.

O *rollback* real é por imagem:

```
az containerapp update -g rg-confere-des -n ca-confere-backend \
  --image acrconferedes.azurecr.io/confere-backend:v3
```

Isso **valida** a disciplina de nunca sobrescrever *tag*, adotada desde a primeira publicação
por outro motivo (rastreabilidade). No ACR seguem `v1`, `v3` e `v4` do backend e `v1` a `v4` do
frontend. Se as *tags* fossem mutáveis, não haveria para onde voltar.

### 12.5 A suíte de navegador achou um defeito que não era desta espec

Rodar a suíte completa — exigência de `R-RSP-05` — expôs uma falha no `smoke.spec.ts` que
**não vinha desta entrega**: verificado por `git stash` do `api.ts`, ela se reproduz idêntica
no código anterior.

A causa estava nas emendas §17.4 e §17.5 da [ESPEC 009](009-analise-da-medicao.md), que
mudaram a tela depois de o teste ter sido ajustado a ela. Diagnóstico e correção ficaram
registrados na ESPEC 009 §17.6, que é onde a decisão mora.

Fica aqui porque a espec de disponibilidade foi quem o encontrou, e por um motivo que vale
guardar: **a exigência de "a suíte inteira verde" tem valor mesmo quando a mudança não toca
nada do que ela cobre.** `R-RSP-05` pediu a suíte para provar que a resposta da API não mudou;
o que ela devolveu foi um defeito de tela de dois incrementos atrás.

---

## 13. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-08-11 | Redação inicial, com as três fases medidas em §2 |
| 1.1 | 2026-08-11 | Implementada. §2.3 e §2.5 com os números de produção; quatro emendas em §12 |
