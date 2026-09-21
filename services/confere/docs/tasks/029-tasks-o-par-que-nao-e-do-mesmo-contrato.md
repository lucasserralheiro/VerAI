# TASKS 029 — Backlog de "O par que não é do mesmo contrato"

| | |
|---|---|
| **Especificação** | [ESPEC 029](../specs/029-o-par-que-nao-e-do-mesmo-contrato.md) v1.2 |
| **Plano** | [PLANO 029](../plans/029-plano-o-par-que-nao-e-do-mesmo-contrato.md) v1.0 |
| **Versão** | 1.0 — 2026-08-20 |
| **Total** | 38 tarefas planejadas · **39 executadas** — a `T-2111` nasceu da execução (§11.6) · 8 portões · 0 insumos em aberto |
| **Status** | **Concluído** — 2026-08-20. **Os oito portões fechados.** Backend `1.383 passed`; navegador `110 passed, 10 failed`, e as dez são as pré-existentes que a ESPEC 030 herda — zero regressão desta entrega. Backend **1.342 → 1.383**: 40 testes novos desta entrega e `+1` que o `test_architecture.py` ganhou sozinho, ao adotar o objeto de valor novo da camada de domínio |

> **Escrito antes da implementação**, como os TASKS 020 a 023 e o 027 — e ao contrário dos 024 e
> 028, cujo §9 registrou o desvio. A §10 deste documento é a que vai receber o que a execução
> ensinar.

---

## 1. Convenções

**Identificadores** `T-20nn`, continuando a numeração: o TASKS 028 fechou em `T-2072`.

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`python -m pytest` verde — **`python -m pytest`, e não `pytest`**: a coleta do backend quebra sem o
`-m` (TASKS 028 §9.1); comentário explicando o *porquê* onde a escolha não for óbvia.

**Convenção de commit** `<tipo>(T-20nn): descrição`.

**Linha de base** 1.342 testes de backend (TASKS 028). `T-2073` remede antes de começar: qualquer
divergência é ruído de árvore, e é melhor descobri-la agora que na `T-2106`.

### 1.1 Quatro regras que atravessam este backlog

**1 — O oráculo se mede no arquivo, nunca no *parser*.** As identidades das cinco peças e das três
planilhas entram nos testes **por extenso**, copiadas da leitura da `T-2073`. Derivá-las de
`IdentidadeContratual.de_texto` faria o teste afirmar *"o código concorda com o código"* — o modo
de falha que o PLANO 021 §1 nomeou.

*O sinal no diff:* uma chamada a `de_texto` do lado **esperado** de um `assert`.

**2 — Campo novo do `Contract` mora em três lugares, não em um.** `identidade` e `processo` são
preenchidos nos **dois** pontos de construção de `extrair` (o caminho sem tabela e o normal) e
entram na **lista fixa** de `Contract.aplicar`. Faltando qualquer um, o dado some em silêncio no
caminho que menos se testa — foi o defeito da `T-1420`, com `cliente`, e levou um mês.

*O sinal no diff:* alteração em `pdfplumber_extractor.py` sem alteração correspondente em
`contract.py`, ou vice-versa.

**3 — A severidade sobe por último, e uma vez só.** As validações nascem `AVISA` (`T-2090`) e só
viram `PERGUNTA` na `T-2104`, depois de o ciclo da tela existir e ter teste (`T-2105`). Subir antes
publica a tranca que o negócio recusou em `I-04`.

*O sinal no diff:* a constante `SEVERIDADE_DA_DIVERGENCIA` valendo `PERGUNTA` num commit que não
seja o da `T-2104`.

**4 — Mecanismo de anúncio novo entra no inventário, escrito da regra e não do DOM.** A caixa do
portão é um `role="status"`; sem entrada em `e2e/inventario-de-anuncios.ts` a suíte de navegador
reprova de propósito. E uma entrada preenchida olhando o DevTools transforma a varredura em
tautologia (TASKS 016 §1.1, regra 2).

*O sinal no diff:* entrada no inventário sem a regra que a exige na coluna de origem.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** O oráculo da identidade | T-2073 … T-2076 | **P0** | F0 |
| **E1** Os testes, escritos antes | T-2077 … T-2081 | **P4** | F1 |
| **E2** O objeto de valor | T-2082 … T-2084 | **P4** | F2 |
| **E3** A identidade nas peças | T-2085 … T-2088 | **P0** | F3 |
| **E4** As três validações | T-2089 … T-2092 | **P1 P2 P3** | F4 |
| **E5** A API: campo, 422 e prévia | T-2093 … T-2098 | **P6** | F5 |
| **E6** A tela | T-2099 … T-2105 | **P5** | F6 |
| **E7** O conjunto | T-2106 … T-2110 | **P7** | F7 |

### 2.1 A régua da entrega — o que pode mudar de comportamento

| Muda | Não muda |
|---|---|
| Par com identidades divergentes passa a produzir **um** achado nomeado | O `.docx` e o `.xlsx` dos dois pares reais, byte a byte |
| `Contract` ganha `identidade` e `processo` | `Measurement` — `contrato_referencia` já era lido |
| `Severity` ganha `PERGUNTA`; `bloqueado` passa a incluí-la | O que **as onze validações existentes** registram |
| `POST /reports` aceita `identidade_confirmada`; o 422 ganha `confirmaveis` | O contrato do 200 e do 400; o grid, a análise, o rodapé |
| Nasce `POST /reports/conferencia-previa` | O caminho de geração: a prévia não é chamada por ele |
| O `UploadForm` mostra a caixa também por resposta do servidor | A caixa de `R-DOC-08` pelo nome do arquivo, que segue igual |

---

## 3. Épico E0 — O oráculo da identidade `[portão P0]`

> **Nenhum arquivo de `src/` é tocado neste épico.** A saída é conhecimento medido, que só depois
> vira constante.

#### T-2073 — Remedir a linha de base
**Tamanho:** PP · **Ref:** PLANO §3 F0

`python -m pytest` na árvore intocada. Confirmar 1.342, ou registrar aqui o número real e a razão
da diferença antes de escrever qualquer código.

**Pronto quando:** o número está neste documento, e a árvore está limpa.

#### T-2074 — A identidade das oito fontes, por extenso
**Tamanho:** PP · **Ref:** ESPEC §2.1, §2.2

Extrair e listar, para as cinco peças (`contrato.pdf`, `contrato_pgm.pdf`, `aditivo_pgm.pdf`,
`modelo.pdf`, `amostra_sem_tabela.pdf`) e as três planilhas: **o texto cru** de onde a identidade
sai, e as quatro partes que ele rende.

O texto cru importa tanto quanto o resultado: é ele que vai para o teste do objeto de valor, e é
ele que prova que a regex casa no documento real e não numa string idealizada.

**Pronto quando:** a tabela existe, com `52/SMIT/2024`, `15/PGM/2024`, `TC 015/PGM/2024` e os dois
`—` das peças que não declaram nada.

#### T-2075 — A contagem de achados de hoje, por par e por validação
**Tamanho:** PP · **Ref:** ESPEC §10.2, **P0**

Rodar `DIContainer.gerar` nos dois pares reais e nos dois cruzamentos, e tabelar
`{validacao: quantidade}`. Os cruzamentos já são conhecidos — 19 e 14 `V-CTR-05` — e servem de
conferência da medição; os pares reais são a linha de base de `P0`.

**Pronto quando:** os quatro números estão registrados. Qualquer diferença na `T-2106` é achado
novo, e achado novo em par real é escopo vazado.

#### T-2076 — Inventariar as âncoras, backend e navegador
**Tamanho:** P · **Ref:** ESPEC §10.3, PLANO §1 riscos 2 e 3

Duas varreduras, e **por o que o teste afirma, não por onde ele mora** (PLANO 024 §7):

* **backend** — `sha256`, constante de contagem e `assert len(` em `tests/`. São os quatro pacotes
  de `test_identidade_dos_artefatos.py`, as constantes de `test_capa.py` e as de
  `test_anchor_por_codigo.py`;
* **navegador** — as cinco entradas de `e2e/inventario-de-anuncios.ts` e **todos** os
  `page.route("**/reports"…)` do `e2e/`, com o arquivo e a linha de cada um.

O inventário do navegador é o que o PLANO §1 chama de risco mais caro: o *endpoint* novo não casa
com `**/reports`, e sem esta lista a descoberta viria como uma suíte vermelha sem explicação.

**Pronto quando:** as duas listas existem, com arquivo e linha.

> **O inventário de âncoras falhou nas duas últimas entregas** (TASKS 028 §9.6, PLANO 024 §7).
> Nas duas o motivo foi o mesmo: varrer por nome de arquivo em vez de por asserção.

---

## 4. Épico E1 — Os testes, escritos antes `[portão P4]`

#### T-2077 — `test_identidade_contratual.py`, o objeto de valor
**Tamanho:** P · **Ref:** `R-IDT-01` a `R-IDT-04`, **P4**

Módulo novo. Sem abrir arquivo nenhum: entra a **string** medida na `T-2074`, sai a identidade.

| Caso | Entrada | Esperado |
|---|---|---|
| Peça real, piloto | `Contrato Nº 52/SMIT/2024` | `52 · SMIT · 2024` |
| Peça real, PGM | `Contrato N° 15/PGM/2024` | `15 · PGM · 2024` |
| Aba, com prefixo e zero à esquerda | `TC 015/PGM/2024` | `15 · PGM · 2024` |
| Igualdade entre os dois formatos | as duas acima | **iguais** |
| Sufixo (`I-03`) | `52-A/SMIT/2024` vs `52/SMIT/2024` | **iguais** |
| Caixa | `52/smit/2024` | igual a `52/SMIT/2024` |
| Sem identidade | primeira página de `modelo.pdf` | `None` |

**Pronto quando:** o módulo existe e reprova por `ImportError` — a classe ainda não existe.

#### T-2078 — Os quatro cruzamentos, hoje silenciosos
**Tamanho:** P · **Ref:** `V-IDT-01`, **P1**

Para cada um dos quatro pares cruzados: `container.gerar` devolve hoje `bloqueado=False` e **zero**
achado de identidade. O teste afirma o oposto — **um** achado `V-IDT-01` — e portanto reprova.

Usar as fixtures de sessão do `conftest`. **Nenhuma fixture nova nesta entrega.**

**Pronto quando:** os quatro reprovam por achado ausente, e a mensagem de falha diz qual par.

#### T-2079 — O aditivo de outro contrato
**Tamanho:** P · **Ref:** `V-IDT-03`, **P2**

`contrato.pdf` como proposta e `aditivo_pgm.pdf` como aditivo. Duas asserções, e a segunda é a que
guarda a **ordem** no container: além do achado, o consolidado **não** contém os sete códigos do
aditivo.

Sem a segunda, a validação poderia ser chamada depois de `aplicar` e o teste continuaria verde —
com os itens já somados ao escopo.

**Pronto quando:** reprova pelas duas asserções.

#### T-2080 — Os três negativos de `R-IDT-06`
**Tamanho:** PP · **Ref:** `R-IDT-06`, **P3**

`modelo.pdf` e `amostra_sem_tabela.pdf` no campo Contrato, e
`levantamento_codigos_deslocados.xlsx` no campo Levantamento: nenhum achado de identidade, e as
contagens de `V-DOC-01` e `V-MED-01` inalteradas.

**Estes passam antes de existir código novo, e é resultado, não folga.** Descrevem o que **não**
muda; se algum reprovasse aqui, a premissa de que a regra é estreita estaria errada.

**Pronto quando:** os três passam contra o `HEAD`.

#### T-2081 — `[portão]` Rodar contra o `HEAD`
**Tamanho:** PP · **Ref:** **P4** (primeira metade)

`T-2077` reprova por importação; `T-2078` e `T-2079` por achado ausente; `T-2080` passa.

**Pronto quando:** cada reprovação é **pelo motivo previsto** — reprovação por outro motivo é
teste errado, não código faltando.

---

## 5. Épico E2 — O objeto de valor `[portão P4]` `[publicável sozinho]`

#### T-2082 — `IdentidadeContratual`
**Tamanho:** P · **Ref:** `R-IDT-01`, `R-IDT-02`, `R-IDT-03`

`backend/src/domain/value_objects/identidade_contratual.py`. Congelado, quatro campos — `base: int`,
`sufixo: str`, `orgao: str`, `ano: str` —, dois construtores de classe (`de_texto`,
`de_referencia_da_aba`) e `__str__`.

No domínio, e não na infraestrutura: não conhece PDF nem planilha, e é o que permite exercitar os
degraus sem fixture — mesmo lugar e mesmo espírito de `causa_provavel` e `causa_da_leitura_vazia`.

**As quatro partes ficam separadas de propósito.** Guardar `"52/SMIT/2024"` normalizado como texto
funcionaria em tudo o que foi medido e falharia no primeiro sufixo, que o negócio confirmou existir.

**Pronto quando:** as sete linhas da tabela da `T-2077` passam.

#### T-2083 — A comparação de `R-IDT-04`
**Tamanho:** PP · **Ref:** `R-IDT-04`, `I-03`

Igualdade e `__hash__` por `(base, orgao, ano)`. **O sufixo fica fora** — é informação para o
detalhe técnico, nunca critério.

**Pronto quando:** `52-A/SMIT/2024 == 52/SMIT/2024`, e `str()` de cada um continua devolvendo o
que o documento escreveu.

#### T-2084 — `[portão]` `P4`
**Tamanho:** PP · **Ref:** **P4**

`T-2077` inteira verde, com as oito strings reais da `T-2074`.

**Pronto quando:** verde, e o diff do teste **não** contém `de_texto` do lado esperado (regra 1).

---

## 6. Épico E3 — A identidade nas peças `[portão P0]`

#### T-2085 — Os dois campos no `Contract`
**Tamanho:** PP · **Ref:** `R-IDT-09`

`identidade: IdentidadeContratual | None = None` e `processo: str = ""`, **por último e com
padrão**, pela razão já escrita em `diagnostico`: dezenas de construções parciais na suíte
quebrariam com campo obrigatório.

**Pronto quando:** a suíte segue verde sem nenhuma edição de teste existente.

#### T-2086 — A derivação, nos **dois** pontos de construção
**Tamanho:** P · **Ref:** `R-IDT-02`, `R-IDT-05`, ESPEC §2.8

Duas regexes no extrator, sobre o `texto_da_capa` que já circula desde a `T-2014` — **nenhuma
página aberta de novo**. Preencher `Contract` no caminho sem tabela (~L90) **e** no normal (~L157).

O caminho sem tabela é o que mais precisa: é a peça sobre a qual a tela vai ter de dizer alguma
coisa.

**Pronto quando:** as três peças reais rendem a identidade da `T-2074`, e as duas que não declaram
rendem `None`.

#### T-2087 — Os dois campos na lista fixa de `aplicar`
**Tamanho:** PP · **Ref:** `R-IDT-09`, `T-1420`

`Contract.aplicar` monta um objeto novo campo a campo. O que não entrar na lista some no caminho
com aditivo — em silêncio.

**Pronto quando:** o consolidado do par PGM tem `identidade` e `processo` preenchidos.

#### T-2088 — `[portão]` Os dois testes que a `T-1420` escreveu para nós
**Tamanho:** PP · **Ref:** **P0**

Um para o caminho sem tabela (`amostra_sem_tabela.pdf`), um para o consolidado com aditivo. Três
linhas cada.

E `P0` reconferido: os dois pares reais sem achado novo, artefatos intocados.

**Pronto quando:** verdes, e as âncoras da `T-2076` intactas.

---

## 7. Épico E4 — As três validações `[portões P1, P2, P3]` `[publicável como AVISA]`

#### T-2089 — `identity_validations.py`
**Tamanho:** M · **Ref:** `V-IDT-01` a `V-IDT-03`, ESPEC §9

Módulo novo, três funções, no padrão de guardrails do TRIADE — uma unidade nomeada por
identificador de espec, com arquivo e teste próprios.

Todas por `registrar_em_partes`: título, causa, ação, detalhe. Os textos são os do ESPEC §9, **com
a frase da consequência** — *"se seguir assim mesmo, o relatório sairá com…"* —, que é o que
`D-02` exige para que *Gerar assim mesmo* não seja um botão sem consequência declarada.

`V-IDT-03` compara **contra a proposta**, nunca peça contra peça (`D-08`), e o papel vai no
título: *1º aditivo*, *2º aditivo*.

**Pronto quando:** `T-2078` e `T-2079` verdes.

#### T-2090 — A severidade numa constante, iniciada em `AVISA`
**Tamanho:** PP · **Ref:** PLANO §1, §7

`SEVERIDADE_DA_DIVERGENCIA = Severity.AVISA`, no topo do módulo, com o comentário dizendo **por
que** e **quando** ela sobe — `T-2104`, depois do ciclo da tela.

Constante e não bandeira de configuração: o projeto não tem nenhuma, e a pergunta *"o portão está
ligado?"* precisa ter resposta no código (PLANO §7).

**Pronto quando:** existe, com o comentário, e é o único lugar que decide a severidade das três.

#### T-2091 — As chamadas no container, sob as guardas
**Tamanho:** P · **Ref:** `R-GRD-06`, ESPEC §7.2, **P2**

* `V-IDT-03` dentro do laço dos aditivos, sob o `if aditivo.itens`, **antes** de
  `proposta.aplicar(aditivos)`;
* `V-IDT-01` e `V-IDT-02` depois de `v_med_01_aba_reconhecida`, **dentro do `if medicao.itens`**.

Fora dessa guarda, uma planilha ilegível seria acusada de *"ser de outro contrato"* — consequência
descrita como causa, que é o que `R-GRD-06` proíbe desde os 57 achados do `PA-PGM`.

As guardas ficam no container, e não dentro das validações, para que elas não precisem saber em
que ordem são chamadas.

**Pronto quando:** `T-2080` continua verde — é ela que prova que a guarda funciona.

#### T-2092 — `[portão]` `P1`, `P2`, `P3`
**Tamanho:** PP · **Ref:** **P1**, **P2**, **P3**

Os quatro cruzamentos com **um** achado cada; o aditivo cruzado acusado antes de consolidar; os
três negativos calados; os dois pares reais com a contagem da `T-2075`.

**Pronto quando:** os quatro conjuntos fecham. **Aqui a entrega já paga** — e pode parar, sem
prejuízo.

---

## 8. Épico E5 — A API: campo, 422 e prévia `[portão P6]`

#### T-2093 — `Severity.PERGUNTA`
**Tamanho:** P · **Ref:** `R-IDT-10`

Valor novo no `enum`; `bloqueado` passa a ser `BLOQUEIA or PERGUNTA`; `confirmaveis` ao lado de
`bloqueantes` e `avisos`.

`bloqueado` continua significando exatamente o que significava — *não sai documento* —, e é o que
mantém o caso de uso, a leitura de anexos e o status HTTP sem edição.

**Pronto quando:** a suíte segue verde. Nenhum teste existente deve se mover nesta tarefa.

#### T-2094 — `[portão]` Nenhuma validação existente registra `PERGUNTA`
**Tamanho:** PP · **Ref:** PLANO §5, risco 1

Teste que roda as onze validações de hoje nos cenários que a suíte já cobre e afirma que a
severidade de cada achado é `BLOQUEIA` ou `AVISA`.

**Quatro linhas, e é o teste mais importante do épico.** É a única mudança da entrega que alcança
código que ninguém está olhando, e o sintoma dela — bloqueio permanente e falso — é o que a ESPEC
025 §1 levou meses para diagnosticar.

**Pronto quando:** verde, e falha se alguém trocar a severidade de qualquer validação antiga.

#### T-2095 — `identidade_confirmada`, e a ausência que não confirma
**Tamanho:** P · **Ref:** `R-IDT-10`

Campo em `Entradas` e no `POST /reports`, padrão `False`. Decide **a severidade do achado**, nunca
a sua existência: confirmado, o achado desce a `AVISA` com o texto no passado (`R-IDT-11`).

Teste obrigatório: envio **sem** o campo em par divergente → 422 com `confirmaveis`, nenhum
documento. Ausência de confirmação não é confirmação.

**Pronto quando:** os dois caminhos têm teste, e o texto do achado confirmado é o do ESPEC §9.4.

#### T-2096 — `identificar()` nos dois leitores
**Tamanho:** P · **Ref:** `D-10`

* extrator: abre o PDF, lê **a página 1**, devolve identidade e processo;
* leitor da aba: `read_only`, **dez linhas**, devolve a identidade.

`extrair` e `ler` ficam **intocados**. É a única concessão arquitetural da entrega — um método a
mais no *port* —, e ela é aditiva: o fluxo de geração não chama nenhum dos dois.

**Pronto quando:** cada um responde com a identidade da `T-2074`, e há teste de que o do PDF **não**
abre a página 2.

#### T-2097 — `POST /reports/conferencia-previa`
**Tamanho:** M · **Ref:** `I-05`, `R-IDT-10`

Recebe os mesmos arquivos do `POST /reports` — **aditivos inclusive** — e responde
`RespostaDaConferencia`: se batem, e não batendo, as duas identidades e o cartão do ESPEC §9.

Reusa `api/uploads.gravar`: a conferência de assinatura e o limite de 40 MB valem aqui igual.

**Pronto quando:** os dois pares reais respondem *batem*; os quatro cruzamentos respondem o cartão.

#### T-2098 — `[portão]` `P6`
**Tamanho:** PP · **Ref:** **P6**

Contrato + 1 aditivo + levantamento **abaixo de 2 s** — limiar folgado sobre os 0,65 s medidos, para
não virar teste instável em CI. E um teste que afirma que a prévia **não** extrai a tabela de itens.

Se a prévia custar como a extração, ela perde a razão de existir.

**Pronto quando:** os dois passam.

---

## 9. Épico E6 — A tela `[portão P5]`

#### T-2099 — A chamada à prévia, falhando aberto
**Tamanho:** P · **Ref:** `R-IDT-12`

Antes do envio. Erro de rede, resposta inválida ou demora acima de **3 s** → o envio segue para
`POST /reports`, e quem barra é a validação de dentro do fluxo.

Falhar fechado poria a emissão do relatório na dependência de um caminho que existe só para
economizar trinta segundos.

**Pronto quando:** há teste de navegador com a prévia derrubada, e o fluxo completa.

#### T-2100 — A caixa do portão, reusando `R-DOC-08`
**Tamanho:** M · **Ref:** `R-IDT-10`, ESPEC §2.9, §9

A mesma caixa âmbar do `UploadForm`, com `role="status"` — **não `alert`**: não é erro, é ressalva
sobre escolha reversível (`R-ACE-13`).

Muda a fonte do juízo, não a forma: lá é o nome do arquivo, decidido no navegador; aqui é a
resposta do servidor. Os dois avisos coexistem, e o `id` de cada um é próprio — o inventário
resolve por `id`, e dois `status` sem distinção quebrariam a varredura (nota da ESPEC 025).

Botões: **Trocar arquivo** e *Gerar assim mesmo*, `type="button"` nos dois — dentro de um `<form>`
o padrão do HTML é `submit`, e sem isso *Trocar arquivo* geraria o relatório com o arquivo errado
(`R-LMP-03`).

**Pronto quando:** os quatro cruzamentos mostram a caixa com o texto do ESPEC §9.1.

#### T-2101 — A confirmação no envio, e o aviso que sobra
**Tamanho:** P · **Ref:** `R-IDT-11`

*Gerar assim mesmo* envia com `identidade_confirmada=true`. O relatório sai, e o achado aparece na
lista de ressalvas com o texto no passado.

Um portão que some ao ser atravessado não deixa rastro de que existiu.

**Pronto quando:** o aviso aparece no `ResultadoPanel` junto do relatório.

#### T-2102 — A entrada no inventário de anúncios
**Tamanho:** PP · **Ref:** TASKS 016 §1.1, regra 4 do §1.1

Entrada nova em `e2e/inventario-de-anuncios.ts`, com a **regra que a exige** — `R-IDT-10` — na
coluna de origem, e a espécie correta.

Escrita da regra, não do DOM: preencher olhando o DevTools faz a varredura passar por construção e
o teste deixar de afirmar qualquer coisa.

**Pronto quando:** `anuncio.spec.ts` passa a cobrir a região nova, e a varredura DOM → inventário
fecha.

#### T-2103 — As interceptações do `e2e/`
**Tamanho:** P · **Ref:** PLANO §5, risco 2

`**/reports/conferencia-previa` interceptado em `e2e/estados.ts`, e os arquivos da lista da
`T-2076` revisados um a um: `**/reports` **não** casa com o caminho novo.

Com `R-IDT-12` no lugar, o pior caso já é degradação e não travamento — mas um teste que espera 3 s
de *timeout* a cada clique é um teste que ninguém vai querer rodar.

**Pronto quando:** a suíte de navegador roda no tempo de sempre.

#### T-2104 — A severidade sobe
**Tamanho:** PP · **Ref:** PLANO §1, §7

`SEVERIDADE_DA_DIVERGENCIA = Severity.PERGUNTA`. **Uma linha**, e é a que fecha a entrega.

Vem depois de `T-2105` estar escrita: subir antes publica a tranca que `I-04` recusou.

**Pronto quando:** o teste que guarda a troca é verde, e `T-2095` continua provando que ausência
não confirma.

#### T-2105 — `[portão]` O ciclo ponta a ponta
**Tamanho:** P · **Ref:** **P5**

Playwright: par divergente → caixa com a pergunta → *Gerar assim mesmo* → documento com o aviso de
`R-IDT-11`. E o caminho da recusa: *Trocar arquivo* volta ao formulário sem ter processado nada.

**Pronto quando:** os dois caminhos passam.

---

## 10. Épico E7 — O conjunto `[portão P7]`

#### T-2106 — A suíte de backend
**Tamanho:** PP · **Ref:** **P7**

Contagem reconciliada: a linha de base da `T-2073` mais os testes desta entrega, um a um. Número
que não fecha é teste perdido ou teste duplicado.

**Pronto quando:** verde, com a aritmética escrita aqui.

#### T-2107 — A suíte de navegador
**Tamanho:** PP · **Ref:** **P7**

Nenhuma falha nova além das pré-existentes, que ficam nomeadas.

#### T-2108 — `ruff` e `mypy`
**Tamanho:** PP · **Ref:** **P7**

Limpos nos arquivos tocados.

#### T-2109 — `[portão]` As âncoras, uma a uma
**Tamanho:** P · **Ref:** **P0**, **P7**

Cada âncora da `T-2076` reconferida. **Nenhuma reancoragem é legítima nesta entrega**: ao contrário
da ESPEC 028, não há delta de documento previsto. Âncora vermelha aqui é defeito.

**Pronto quando:** todas verdes sem edição.

#### T-2111 — A `V-CTR-05` sob a guarda da identidade `[nascida da execução]`
**Tamanho:** P · **Ref:** ESPEC 029 `D-07`, `R-GRD-06`, §11.6

Não estava no plano, e devia estar: a `D-07` da espec descrevia esta ordem em prosa, e o backlog
não a transformou em tarefa. O resultado foi a promessa central da entrega falhar na primeira
execução real.

`v_ctr_05_codigo_contratado_ausente_da_aba` passa para **depois** das validações de identidade, sob
o predicado `_sob_pergunta_de_identidade`. Confirmado o envio, ela volta.

**Pronto quando:** o par cruzado produz `["V-IDT-01"]` e mais nada; confirmado, produz
`{"V-IDT-01", "V-CTR-05"}` e o relatório.

**A lição está em §11.6, e é sobre o teste, não sobre o código:** todas as asserções da entrega
diziam *"o achado aparece"*; nenhuma dizia *"e mais nada aparece"*.

#### T-2110 — A documentação
**Tamanho:** PP · **Ref:** —

`README.md` com a linha da ESPEC 029; a ESPEC para **Implementada**, com data e resultado dos
portões; este backlog com o §11 preenchido.

---

## 11. O que a implementação ensinou

### 11.1 O oráculo achou um defeito que a espec não previa `[achado]`

`T-2075` mediu os quatro pares e um quinto que não estava no plano: **proposta do SMIT com o
aditivo da PGM**, o par que a `V-IDT-03` existe para pegar. O resultado de hoje:

| Par | Bloqueia? | Linhas | Achados |
|---|---|---|---|
| Piloto | não | 58 | **0** |
| PGM | não | 58 | **0** |
| PGM + aditivo | não | 58 | **0** |
| SMIT × levantamento PGM | não | 58 | 19 × `V-CTR-05` |
| PGM × levantamento SMIT | não | 58 | 14 × `V-CTR-05` |
| **SMIT + aditivo da PGM** | **não** | **58** | 1 × `V-ADT-04`, 2 × `V-CTR-05` |

A última linha é pior do que a §1 da espec descrevia. Um aditivo de **outro contrato** entrava no
escopo produzindo **três avisos**, nenhum deles sobre contrato, e um documento de 58 linhas. O
`V-ADT-04` dizia *"o aditivo altera a quantidade de um código que não consta do contrato"* — que é
verdade, e é o sintoma, não a causa.

### 11.2 O `Nº` em caixa baixa quebrou o padrão na primeira execução `[desvio]`

`T-2082` nasceu com `[Cc]ontrato\s*N?[º°o]?` — a caixa alternava só na primeira letra. As três
peças reais grafam `Contrato Nº`, e o padrão passou nelas; quem reprovou foi o teste de caixa da
`T-2077`, escrito **antes**, com `contrato nº 52/smit/2024`.

É a defesa da F1 funcionando: o caso que a fixture real não tem foi o que achou o defeito. O
padrão passou a `(?:[Nn][º°o]?\.?)?`.

### 11.3 A falha aberta abria um buraco na tela, e ele só apareceu na revisão `[achado]`

A primeira implementação concatenava `confirmaveis` em `bloqueantes` no `api.ts`: um balde a menos
no `Estado`, e o caminho *"quase nunca é visto"* — o portão pergunta antes, e quem chega ao 422 é
quem chamou a API direto ou quem passou por uma falha aberta.

**Quase nunca não é nunca, e o caminho tinha um defeito.** Nesse cenário a pessoa recebia, na tela
de bloqueio, uma mensagem terminando em *"ou gere assim mesmo, se a divergência for conhecida"* —
e **nenhum botão que fizesse isso**. A `R-IDT-12` existe para que uma indisponibilidade não vire
impossibilidade de faturar; concatenar as listas fazia exatamente o contrário, em silêncio.

O conserto: `Estado.bloqueado` ganhou `confirmaveis`, e `page.tsx` repõe a pergunta na caixa do
formulário quando ela chega pelo 422. Havendo **só** confirmáveis, a tela volta ao formulário e a
caixa é a mensagem inteira — repetir o texto no painel de bloqueio seriam duas mensagens para uma
causa, que é o que as ESPECs 025 e 027 passaram duas entregas eliminando.

A lição é sobre ordem de leitura: o defeito não estava em nenhuma das duas pontas, e sim na
**combinação** de uma regra de resiliência do backend com uma simplificação de estado do frontend.
Nenhum teste de unidade dos dois lados o teria mostrado.

### 11.4 O portão custa 0,9 s, e não 0,65 s

§2.7 mediu as leituras isoladas e somou: 0,65 s. O portão inteiro, pelo container, custa **0,92 s**
no par real e **1,15 s** com aditivo — a diferença é a construção dos objetos e as outras derivações
da primeira página, que `identificar` faz junto.

O limiar de `P6` continua em 2 s, e continua folgado. Vale registrar que a soma das partes
subestimou o todo em 40 %.

### 11.5 O risco nº 2 do plano era real — e estava numa forma que o inventário não procurou `[defeito]`

O PLANO §1 nomeou como risco mais caro os treze `page.route("**/reports")` que não alcançam o
*endpoint* novo. `T-2103` os tratou. **E onze testes reprovaram assim mesmo**, esperando por
*"Relatório gerado"* que nunca aparecia.

O mesmo perigo existia numa segunda forma:

```ts
page.waitForResponse((r) => r.url().includes("/reports") && r.status() === 200)
```

`includes`, não `endsWith`. `POST /reports/conferencia-previa` **contém** `/reports` e responde
**antes** da geração: a espera capturava o corpo do portão, e o dublê o devolvia no lugar do
relatório. A tela nunca virava `pronto`.

**O erro do inventário foi de método, e é o mesmo que o TASKS 028 §9.6 registrou.** Varri por
*mecanismo* — `page.route` — quando a regra 2 do §1.1 deste próprio backlog manda varrer por **o
que o teste afirma**. `waitForResponse` afirma sobre a mesma resposta que `page.route` intercepta,
e escapou por não se parecer com o que eu procurava.

A varredura certa é por **URL do endpoint**, não por nome de API do Playwright:
`grep -rn '/reports' e2e/` acha as três formas.

E a `R-IDT-12` continua valendo pelo motivo dela: sem backend no ar o portão falha aberto e a suíte
passaria — o que seria pior que falhar, porque o teste passaria a depender de o backend estar
*fora* do ar para exercitar o caminho certo.

### 11.6 A promessa central da espec falhou na primeira execução real `[defeito]`

O `P5` foi dado como fechado com a suíte de tela verde, e **estava vermelho no requisito que a
espec existe para entregar**. Um `POST /reports` com o par cruzado devolvia:

| | antes do conserto | depois |
|---|---|---|
| `bloqueantes` | 0 | 0 |
| `avisos` | **19 × `V-CTR-05`** | **0** |
| `confirmaveis` | 1 × `V-IDT-01` | 1 × `V-IDT-01` |

A §1 desta espec abre denunciando dezenove cartões que são fragmentos de uma frase que ninguém
escreveu. A implementação acrescentou a frase **e manteve os dezenove** — trocou dezenove
mensagens por vinte.

A causa é de uma linha: no container, `v_ctr_05_codigo_contratado_ausente_da_aba` estava **antes**
de `v_idt_01`, dentro da mesma guarda. A `D-07` já dizia o que fazer — *"os 19 cartões não chegam à
tela pela ordem das guardas"* —, e a ordem escrita não era a ordem dita.

O conserto (`T-2111`) inverte as duas e põe a `V-CTR-05` sob um predicado nomeado,
`_sob_pergunta_de_identidade`. Confirmado o envio, ela volta: a guarda é sobre **o par estar em
questão**, não sobre gravidade.

**Por que os testes não pegaram.** Todos os desta entrega afirmavam *"o achado `V-IDT-01`
aparece"*; nenhum afirmava *"e mais nada aparece"*. Cardinalidade de mensagem era o assunto da
espec inteira e não estava em asserção nenhuma — só na prosa. As duas asserções que faltavam agora
existem, e a primeira delas é `== ["V-IDT-01"]`, não `in`.

### 11.7 A regressão era de **quatorze**, não de treze `[correção de contagem]`

A execução de fechamento devolveu ao verde um teste que a primeira leitura tinha classificado como
falha antiga: `analise :: R-PAN-04`. Ele quebrava com `TypeError: … reading 'situacoes'` — sintoma
de dublê com forma errada — e a causa era a mesma dos outros treze: `situacaoVazia` também usava
`includes("/reports")`, e recebia o corpo do portão no lugar do relatório.

**Sintoma de forma, causa de rede.** É o tipo de erro de classificação que o `P0` da ESPEC 030
existe para impedir: classificar durante uma execução suja atribui a causa errada, e a atribuição
errada vira decisão errada na fase seguinte.

Placar final: **14 regressões desta entrega**, todas corrigidas aqui, e **10 falhas anteriores**,
que a ESPEC 030 herda com dono próprio.

### 11.8 O `ruff` já estava vermelho antes desta entrega `[achado alheio]`

`tests/test_divergencia_de_fonte.py` tem um `I001` (bloco de importação fora de ordem) no código
**commitado**, sem relação com esta entrega. Não foi corrigido aqui de propósito: um arquivo tocado
fora do escopo suja o diff da espec. Fica registrado para quem abrir a próxima.

---

### 11.9 A aritmética da suíte, reconciliada

| | |
|---|---|
| Linha de base (`T-2073`) | 1.342 |
| `test_architecture.py`, que se parametriza sobre os arquivos do domínio | **+1** |
| `test_identidade_contratual.py` | **+40** |
| **Total** | **1.383** ✔ |

O `+1` não foi escrito por ninguém: o teste de arquitetura varre a camada de domínio e adotou o
`identidade_contratual.py` no instante em que ele apareceu. É o guardrail da casa confirmando que
o objeto de valor ficou na camada certa — sem uma linha de teste a mais.

---

## 12. Rastreabilidade

| Regra | Tarefas |
|---|---|
| `R-IDT-01` | T-2077, T-2082 |
| `R-IDT-02` | T-2074, T-2077, T-2082, T-2086 |
| `R-IDT-03` | T-2074, T-2077, T-2082 |
| `R-IDT-04` | T-2077, T-2083, T-2084 |
| `R-IDT-05` | T-2074, T-2086, T-2089 |
| `R-IDT-06` | T-2080, T-2091, T-2092 |
| `R-IDT-07` | T-2089 |
| `R-IDT-08` | T-2079, T-2089, T-2091 |
| `R-IDT-09` | T-2085, T-2087, T-2088 |
| `R-IDT-10` | T-2090, T-2093, T-2095, T-2100, T-2104 |
| `R-IDT-11` | T-2095, T-2101 |
| `R-IDT-12` | T-2099, T-2103 |
| `V-IDT-01` | T-2078, T-2089, T-2092, T-2100 |
| `V-IDT-02` | T-2089, T-2092 |
| `V-IDT-03` | T-2079, T-2089, T-2091, T-2092 |
| `V-IDT-04` | — nenhuma: adiada por `D-06` |
| `D-07` (a ordem das guardas) | **T-2111** — a única tarefa nascida da execução |

---

## 13. O que este backlog não faz

* **Não toca o `.docx` nem o `.xlsx`** — nem no caminho confirmado (`I-06`). `T-2109` é quem prova.
* **Não implementa `V-IDT-04`** (vigência). `D-06`.
* **Não usa a cobertura de códigos** como sinal. `D-05`, fechado por `I-01`.
* **Não persiste a confirmação nem registra quem confirmou.** `I-07`.
* **Não acrescenta fixture.** O cenário de erro é o cruzamento das fixtures reais que já existem —
  e é o que torna esta entrega barata de testar.
* **Não acrescenta dependência**, nem no backend nem no frontend.
* **Não introduz configuração de comportamento.** PLANO §7.
