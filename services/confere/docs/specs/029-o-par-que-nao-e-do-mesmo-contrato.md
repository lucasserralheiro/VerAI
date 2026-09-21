# ESPEC 029 — O par que não é do mesmo contrato

| | |
|---|---|
| **Status** | **Implementada** — 2026-08-20. **Os oito portões fechados**: backend `1.383 passed`, navegador `110 passed`. O `P5` fechou **na segunda tentativa** — a primeira dava a tela por boa com os dezenove cartões ainda nela (TASKS 029 §11.6) |
| **Versão** | 1.3 — 2026-08-20 |
| **Depende de** | [ESPEC 001](001-mvp-analise-medicao.md), [ESPEC 015](015-limpar-para-recomecar.md), [ESPEC 019](019-contrato-e-aditivos.md), [ESPEC 020](020-capa-do-documento.md), [ESPEC 025](025-o-arquivo-que-nao-e-a-proposta.md), [ESPEC 027](027-a-planilha-que-o-confere-nao-leu.md) — implementadas |
| **Revisa** | Nada. **Acrescenta** o eixo que o Confere nunca teve: a pergunta *estes arquivos são do mesmo contrato?* — e, com ela, o primeiro portão do projeto que **pergunta** em vez de trancar |
| **Não toca** | A extração da tabela de itens, a leitura da aba, a consolidação de aditivos, a reconciliação, o `.docx`, o `.xlsx`. Nenhuma linha do documento muda por causa desta espec, e `P0` é quem prova |
| **Referência normativa** | `contrato.pdf`, `contrato_pgm.pdf`, `aditivo_pgm.pdf`, `levantamento.xlsx`, `levantamento_pgm.xlsx`, `modelo.pdf`, `amostra_sem_tabela.pdf`, `levantamento_codigos_deslocados.xlsx` |
| **Origem** | *"criar uma validação para emitir um alerta caso o arquivo de contrato não esteja relacionado ao arquivo de levantamento… contrato de PMG e levantamento de SMIT"* |
| **Insumos respondidos** | 2026-08-20, pelo dono do negócio: `I-01`, `I-02`, `I-03`, `I-04` e `I-06`. Nenhum insumo em aberto — §12 |

---

## 1. Problema

O Confere confere **tudo dentro de cada arquivo** e **nada entre eles**. As treze validações de
hoje perguntam se a tabela foi localizada, se o checksum fecha, se a aba tem itens, se um código
contratado aparece no levantamento, se um aditivo foi submetido duas vezes — e nenhuma delas
pergunta se o contrato e o levantamento **falam do mesmo contrato**.

O resultado de trocar os arquivos não é um erro: é um documento. Medido, rodando
`DIContainer.gerar` sobre os dois cruzamentos possíveis das fixtures reais:

| Par trocado | Bloqueia? | Documento | Capa (do PDF) | Cabeçalho (da aba) | Rodapé (do PDF) | Achados |
|---|---|---|---|---|---|---|
| `contrato.pdf` × `levantamento_pgm.xlsx` | **não** | 58 linhas | `SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA` | `TC 015/PGM/2024` | `PA-SMIT-260319-739` | 19 × `V-CTR-05` |
| `contrato_pgm.pdf` × `levantamento.xlsx` | **não** | 58 linhas | `PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO` | `TC 52/SMIT/2024` | `PA-PGM-251015-159` | 14 × `V-CTR-05` |

Sai o `.docx` de sempre, sobre papel timbrado da PRODAM, com a **capa de um órgão, o cabeçalho de
outro e o rodapé do primeiro** — as três identificações erradas umas para as outras, no mesmo
documento. Ele instrui faturamento.

E os 19 avisos `V-CTR-05` — *"código X está no contrato mas não aparece no levantamento"* — são
**19 fragmentos de uma frase que ninguém escreveu**. A evidência já está dentro do sistema; falta
quem a some.

**Isto é a ESPEC 025 §1 e a ESPEC 027 §1 pela terceira vez**: *n* mensagens para uma causa. Só que
naqueles dois casos o documento **não saía** — o defeito era de redação sobre um bloqueio correto.
Aqui não há bloqueio nenhum, e o defeito é de detecção.

Há ainda o caso pior, que é o silencioso: se as duas planilhas tivessem os mesmos códigos, não
haveria nem os 19 cartões. O par errado passaria **inteiramente calado**.

**E há a terceira entrada.** Um aditivo da PGM submetido junto de uma proposta do SMIT é
consolidado sem uma pergunta: `Contract.aplicar` soma as inclusões e os deltas de quem lhe derem,
e `V-ADT-03` examina apenas repetição e rótulo — nunca **de qual contrato** a peça é. O efeito é
aritmético e invisível: itens que o contrato não tem entram no escopo, e o documento sai maior.

---

## 2. O que foi medido

Execução sobre `feature/evolucao`, em 2026-08-20, com as fixtures do repositório.

### 2.1 A identidade está na primeira página, e sempre esteve

Prosa da página 1, sobre a **mesma string** que `_proposta()` e `_cliente()` já percorrem:

| Peça | `Contrato Nº` | `PROCESSO` | Peça (`PA-`/`PC-`) |
|---|---|---|---|
| `contrato.pdf` | `52/SMIT/2024` | `7010.2024/0004617-5` | `PA-SMIT-260319-739` |
| `contrato_pgm.pdf` | `15/PGM/2024` | `7010.2024/0009720-9` | `PA-PGM-251015-159` |
| `aditivo_pgm.pdf` | `15/PGM/2024` | `7010.2024/0009720-9` | `PA-PGM-260304-715` |
| `modelo.pdf` | — | — | — |
| `amostra_sem_tabela.pdf` | — | — | — |

**Três sinais independentes**, e os três concordam nas três peças reais. O par PGM tem contrato e
processo **idênticos** entre a proposta e o seu aditivo; o piloto difere dos dois em ambos. Os
dois documentos que não são propostas não declaram nada — e é isso que `R-IDT-06` transforma em
silêncio, não em acusação.

### 2.2 A identidade da planilha já está em memória

`Measurement.contrato_referencia` é lido desde a ESPEC 001 e hoje serve **só** ao cabeçalho do
relatório:

| Planilha | `conforme contrato :` | Título da linha 1 |
|---|---|---|
| `levantamento.xlsx` | `TC 52/SMIT/2024` | `…COMPROVAÇÃO SMIT SUSTENTAÇÃO…` |
| `levantamento_pgm.xlsx` | `TC 015/PGM/2024` | `…COMPROVAÇÃO PGM TC 015…` |
| `levantamento_codigos_deslocados.xlsx` | — | `…COMPROVAÇÃO FIXTURE DESLOCADA` |

**Nenhum arquivo é aberto de novo para a comparação de dentro do fluxo.** O lado do contrato é uma
regex a mais sobre uma string já extraída; o lado da planilha é o *parse* de um campo já
preenchido. (O portão de entrada de `R-IDT-10` é outro caminho, e paga o seu próprio custo — §2.7.)

### 2.3 A normalização não é enfeite — é o que separa acerto de falso positivo

O par **real** da PGM compara `15/PGM/2024` (PDF) com `TC 015/PGM/2024` (aba). Comparação textual
acusaria **o par certo**, no primeiro dia de uso, e a espec morreria como ruído — o mesmo destino
de todo alarme que erra na estreia.

Normalizando número por valor (`int("015") == int("15")`), sigla por caixa alta e ano por literal,
os dois lados casam. `TC`, `CT` e `Contrato Nº` são prefixos descartáveis.

**E o número pode ganhar sufixo ao ser aditivado** (`I-03`, respondido pelo negócio). `52-A/SMIT/2024`
e `52/SMIT/2024` são **o mesmo contrato**, e a comparação tem de saber disso: quem decide é a
**base numérica**, e o sufixo é informação, não divergência (`R-IDT-04`).

### 2.4 O cruzamento completo: cinco peças × três planilhas

| | `levantamento.xlsx` | `levantamento_pgm.xlsx` | `…codigos_deslocados` |
|---|---|---|---|
| `contrato.pdf` | **silêncio** ✔ | **PERGUNTA** ✔ | silêncio (sem identidade) |
| `contrato_pgm.pdf` | **PERGUNTA** ✔ | **silêncio** ✔ | silêncio (sem identidade) |
| `aditivo_pgm.pdf` | **PERGUNTA** ✔ | **silêncio** ✔ | silêncio (sem identidade) |
| `modelo.pdf` | silêncio (sem identidade) | silêncio (sem identidade) | silêncio |
| `amostra_sem_tabela.pdf` | silêncio (sem identidade) | silêncio (sem identidade) | silêncio |

**Zero falso positivo nos dois pares reais; quatro de quatro trocas detectadas.** As células de
silêncio por ausência são deliberadas (`R-IDT-06`).

Nenhum teste da suíte atual ganha achado novo: a única fixture sintética que passa por caminho de
container é `levantamento_codigos_deslocados.xlsx`, que não declara contrato e cai no silêncio.

### 2.5 Peça × peça

| Par | Contrato declarado | Processo |
|---|---|---|
| `contrato_pgm.pdf` × `aditivo_pgm.pdf` | igual ✔ | igual ✔ |
| `contrato.pdf` × `aditivo_pgm.pdf` | **diferente** ✔ | **diferente** ✔ |

O par real do PGM — o único caminho com aditivo que o repositório exercita — passa pelos **dois**
eixos. O eixo do processo é o que pega o caso que o número do contrato não pegaria: dois
instrumentos do mesmo órgão e do mesmo ano com numeração parecida.

### 2.6 O sinal de reforço, e por que ele não vira validação

Cobertura do contrato pela aba — quantos dos códigos contratados a planilha traz:

| Par | Códigos comuns | Cobertura |
|---|---|---|
| `contrato.pdf` × `levantamento.xlsx` | 57 de 57 | **100 %** |
| `contrato_pgm.pdf` × `levantamento_pgm.xlsx` | 46 de 46 | **100 %** |
| `aditivo_pgm.pdf` × `levantamento_pgm.xlsx` | 7 de 7 | **100 %** |
| `contrato.pdf` × `levantamento_pgm.xlsx` | 38 de 57 | 66,7 % |
| `contrato_pgm.pdf` × `levantamento.xlsx` | 32 de 46 | 69,6 % |
| `aditivo_pgm.pdf` × `levantamento.xlsx` | 4 de 7 | 57,1 % |

A separação é limpa — 100 % contra 57–70 % — e confirma a ESPEC 018 §2.2: *a aba contém o contrato
inteiro nos dois pares*. É a mesma informação dos 19 cartões `V-CTR-05` do §1, somada.

**E mesmo assim não vira regra**: o negócio respondeu (`I-01`) que levantamento incompleto *"não é
normal, mas pode ocorrer"*. Um sinal que erra no caso raro-porém-real acusaria a competência
legítima de ser um par trocado — e a validação que já existe para isso, `V-CTR-05`, diz a mesma
coisa sem confundir os dois diagnósticos. `D-05`.

### 2.7 Custo

| Operação | Custo |
|---|---|
| As regexes de identidade, sobre texto já em memória | **0,05 – 0,10 ms** por peça |
| Página 1 de um PDF, aberta isoladamente | **0,31 s** (307 / 328 / 309 ms nas três peças) |
| Cabeçalho da aba (10 linhas, `read_only`) | **0,08 s** (74 / 92 ms nas duas planilhas) |
| **O portão inteiro** — contrato + 1 aditivo + levantamento | **0,65 s** |
| Extração completa de um contrato (referência) | ~16,6 s |
| Fluxo completo, dois arquivos (referência) | ~30 s |
| Leitura dos anexos, hoje evitada por bloqueio | ~20 s |

**É esta tabela que decide o desenho do portão** (`R-IDT-10`): perguntar *depois* do processamento
custaria ~30 s para fazer a pergunta e mais ~30 s para refazer o trabalho ao ouvir *sim*.
Perguntar **antes**, sobre a página 1 e o cabeçalho, custa **menos de um segundo** — e quem
responder *não* nunca pagou os 30 s.

### 2.8 O `Contract` é construído em dois pontos, e os dois precisam do campo

`PdfPlumberContractExtractor.extrair` monta `Contract` **duas vezes**: no caminho em que a tabela
não é localizada (~L90) e no caminho normal (~L157). Preencher a identidade só no segundo a faria
sumir exatamente no arquivo que mais precisa dela — aquele que já falhou na extração e sobre o
qual a tela vai ter de dizer alguma coisa. É a mesma armadilha da `T-1420`, onde `cliente` sumia
no caminho com aditivo por não constar da lista fixa de campos de `Contract.aplicar`.

### 2.9 O portão de confirmação já existe na tela, e é reusado inteiro

A ESPEC 025 `R-DOC-08` construiu no `UploadForm` a caixa âmbar com `role="status"` e os dois
botões — **Trocar arquivo** e **Usar assim mesmo** — que dispensa o aviso pelo **nome** do arquivo
dispensado, para que ele volte quando a pessoa troca por outro arquivo igualmente suspeito.

É exatamente a forma que `R-IDT-10` pede. O que muda é a **fonte do juízo**: lá é o nome do
arquivo, decidido no navegador; aqui é o conteúdo dos dois documentos, e o navegador não sabe ler
PDF — por isso o portão precisa de uma resposta do servidor, e por isso ela precisa ser barata.

---

## 3. Objetivo

Que o Confere **faça a pergunta antes de responder qualquer outra**: os arquivos submetidos são do
mesmo instrumento contratual?

E que, ao encontrar divergência, ele **pergunte a quem confere** em vez de decidir sozinho —
mostrando os dois lados, em menos de um segundo, e aceitando a resposta.

Três consequências, nesta ordem de importância:

1. **Nenhum documento sai com identificações de contratos diferentes sem que alguém tenha visto e
   confirmado.**
2. **Nenhum aditivo de outro contrato é somado ao escopo em silêncio.**
3. **Quem confere lê uma causa, não dezenove sintomas.**

Fora do objetivo: adivinhar qual é o arquivo certo, corrigir o par, ou inferir o contrato de
documento que não o declara.

---

## 4. Escopo

### 4.1 Dentro do escopo

* Um objeto de valor de identidade contratual — número com sufixo opcional, órgão, ano — com
  *parse* e comparação normalizados (`R-IDT-01` a `R-IDT-04`).
* A derivação da identidade e do processo administrativo de **cada peça**, a partir do texto da
  primeira página que a extração já lê.
* O *parse* da identidade declarada pela aba `Levantamento`, do campo já lido.
* Três validações — `V-IDT-01`, `V-IDT-02`, `V-IDT-03` — no cartão de quatro partes da ESPEC 025.
* **O portão que pergunta** (`R-IDT-10`): a severidade nova, o *endpoint* barato de conferência
  prévia, a confirmação transportada no envio e registrada no resultado (`R-IDT-11`).
* No frontend, o reuso da caixa de `R-DOC-08` com a resposta do servidor no lugar do palpite pelo
  nome do arquivo.
* As guardas no orquestrador que impedem esta espec de acusar consequência de coisa já acusada
  (`R-GRD-06`).

### 4.2 Fora do escopo

* **O documento.** Nem uma linha, nem um byte: `P0` ancora os quatro pacotes dos dois pares —
  inclusive no caminho confirmado, onde o rastro fica na tela e nos achados, nunca no `.docx`
  (`I-06`).
* **A capa.** `R-CAP-04` continua derivando o cliente da proposta; esta espec não escolhe nome de
  órgão nenhum, apenas questiona o par.
* **A vigência** (`V-IDT-04`) — desenhada em §8, adiada por `D-06`.
* **A cobertura de códigos** como regra — medida em §2.6, descartada por `D-05`.
* **Persistir a confirmação.** O serviço é sem estado (ESPEC 001 §7.2), e continua: a confirmação
  vive numa requisição, não num cadastro.

---

## 5. Regras

**`R-IDT-01` — Identidade contratual.** Objeto de valor de quatro partes: **base numérica**
(inteiro), **sufixo** (letra ou termo curto, opcional), **órgão** (sigla em caixa alta) e **ano**
(quatro dígitos). Vive no domínio, sem conhecer PDF nem planilha.

**`R-IDT-02` — O contrato declara a sua identidade na primeira página.** Padrão
`Contrato Nº <número>/<órgão>/<ano>`, tolerante a `N°`, `Nº`, `No`, ao acento ausente e a espaços
em volta das barras. Vale a **primeira** ocorrência: as três peças reais repetem o mesmo número
adiante, e a introdução é onde ele é afirmado.

**`R-IDT-03` — A planilha declara a sua na linha `conforme contrato :`.** O campo já existe em
`Measurement.contrato_referencia`. Prefixos `TC`, `CT` e `Contrato` são descartados antes do
*parse*.

O negócio respondeu (`I-02`) que uma planilha pode abranger **um contrato e um aditivo dele** — o
que é **um** instrumento, não dois. Portanto: vale a primeira identidade de contrato encontrada, e
citações de peça (`PA-…`, `PC-…`) na mesma linha **não são um segundo contrato** — são as peças
daquele. Duas identidades de contratos **distintos** na mesma célula não foram observadas e caem
no silêncio de `R-IDT-06` até que apareçam.

**`R-IDT-04` — Comparação normalizada, e o sufixo não divide contrato.** Base numérica por valor
(`int("015") == int("15")`), órgão por caixa alta, ano por literal. **O sufixo não entra na
comparação**: `52-A/SMIT/2024` e `52/SMIT/2024` são o mesmo contrato (`I-03`), e a diferença
aparece só no detalhe técnico do achado, quando houver achado por outro motivo.

**`R-IDT-05` — O processo administrativo é o segundo eixo.** `PROCESSO <n>` na página 1 vale entre
**peças**, onde §2.5 o mede estável, e **não** contra a planilha, que não o traz.

**`R-IDT-06` — Sem identidade dos dois lados, silêncio.** Ausência de sinal é ausência de
evidência, não evidência do contrário — a mesma leitura conservadora do `parece_proposta`
(`R-DOC-02`). Um contrato que não declare número não pode acusar a planilha de nada.

**`R-IDT-07` — O órgão é o eixo forte.** Órgãos diferentes não têm leitura legítima. Base numérica
ou ano diferentes, com o mesmo órgão, têm leitura legítima rara — contrato sucessor, competência
de virada — e por isso pesam menos.

**`R-IDT-08` — Toda peça responde ao mesmo contrato.** A identidade da **proposta** é a de
referência; cada aditivo é conferido contra ela **antes** da consolidação, porque depois dela os
itens já estão somados e a peça de origem não é mais distinguível.

**`R-IDT-09` — A identidade acompanha o consolidado.** `Contract.aplicar` produz um objeto novo a
partir de uma lista fixa de campos; identidade e processo entram nela. Sem isso, o caminho com
aditivo perde os dois em silêncio (§2.8).

**`R-IDT-10` — O portão pergunta, não tranca.** Divergência de identidade **não emite documento e
não é erro**: é uma pergunta, com os dois lados à vista e duas saídas — *trocar o arquivo* ou
*seguir assim mesmo*. A pergunta é feita **antes** do processamento, em menos de um segundo
(§2.7), e a resposta afirmativa acompanha o envio.

Sem resposta afirmativa, nada é emitido. **A ausência de confirmação não é confirmação** — quem
chama a API sem o campo recebe o mesmo portão, e não o documento.

**`R-IDT-12` — O portão falha aberto.** A conferência prévia é conveniência, não garantia: falhando
por rede, por erro ou por demora além de três segundos, **o envio segue** para `POST /reports`, e
quem barra é a validação de dentro do fluxo, que sempre roda (`R-IDT-10`, segundo parágrafo).

Falhar fechado poria a emissão do relatório na dependência de um caminho que existe só para
economizar trinta segundos — e transformaria uma indisponibilidade momentânea em impossibilidade
de faturar.

**`R-IDT-11` — Confirmação confirmada fica registrada.** Seguindo assim mesmo, o achado **não
desaparece**: rebaixa a aviso e permanece na lista, dizendo que o par divergente foi confirmado no
envio. Um portão que some ao ser atravessado não deixa rastro de que existiu.

---

## 6. Decisões

### `D-01` — A identidade sai de prosa, e isso está dito, não escondido

É a segunda derivação por prosa do projeto, depois de `_cliente` (ESPEC 020 `D-05`), e prosa é a
fonte que mais muda sem avisar. Três coisas limitam o dano, e as três são medidas:

1. o padrão casa nas **três** peças reais, de dois órgãos e três layouts (§2.1);
2. a ausência é silêncio, nunca acusação (`R-IDT-06`, §2.4);
3. nenhum caminho termina em recusa definitiva: o pior desfecho de um engano do sistema é **uma
   pergunta a mais**, respondida em dois cliques (`R-IDT-10`).

### `D-02` — O portão pergunta, e é decisão do negócio

A ESPEC 029 v1.0 propunha bloquear no eixo do órgão e avisar no do número. **O dono do negócio
decidiu outra coisa, em 2026-08-20** (`I-04`): *"o sistema deve avisar e perguntar se deseja
continuar"*.

A decisão é melhor que a proposta, e vale escrever por quê: o sistema **não sabe** qual dos dois
arquivos está errado — só sabe que não combinam. Trancar seria decidir, com informação parcial,
uma coisa que quem confere decide com informação inteira. E o custo do engano é assimétrico: um
bloqueio indevido no dia do fechamento manda a pessoa para o suporte; uma pergunta indevida custa
dois cliques.

O que **não** se abre mão, e é o que separa *perguntar* de *só avisar*: sem resposta, não sai
documento. O aviso passivo — emitir e torcer para que alguém leia — é o que a §1 já mostrou não
funcionar: dezenove avisos não impediram nada.

### `D-03` — Não se compara o nome do cliente

`SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA` contra `LEVANTAMENTO - COMPROVAÇÃO SMIT
SUSTENTAÇÃO` não é comparação: é um nome por extenso contra uma sigla dentro de um título
editorial. A identidade `52/SMIT/2024` é estruturada, formal e tem dono; o nome do órgão é rótulo
de capa, e a ESPEC 020 `D-05` já o classificou como a derivação mais frágil do projeto. Comparar
duas coisas frágeis produz um alarme frágil ao quadrado.

### `D-04` — Não se compara o título da aba

Pela mesma razão, e por uma a mais: o título é o que o relatório leva impresso, e o par PGM prova
que ele pode grafar `PGM TC 015` onde o campo formal da mesma planilha diz `TC 015/PGM/2024`.

### `D-05` — A cobertura de códigos não vira validação

Na v1.0 esta decisão era *"ainda não, faltam dados"*. Com `I-01` respondido — levantamento
incompleto **não é normal, mas pode ocorrer** — ela vira definitiva: o sinal do §2.6 erraria
justamente no caso raro-porém-legítimo, acusando de par trocado uma competência correta.

A informação não se perde: `V-CTR-05` já nomeia exatamente esses códigos, e a ESPEC 027 `D-05` já
os agrega num cartão só. Um segundo mecanismo dizendo a mesma coisa com outro veredito
confundiria dois diagnósticos que têm donos diferentes.

### `D-06` — A vigência fica para a segunda onda

`V-IDT-04` está desenhada e medida em §8. É a regra mais dependente de prosa livre das quatro —
`aditivo_pgm.pdf` diz *"8 meses a partir da assinatura"*, sem data absoluta —, o ganho é menor, e
ela é independente das três primeiras.

### `D-07` — Nada é apagado da tela por supressão

`V-CTR-05` continua emitindo os seus cartões quando o par é legítimo e a aba não traz um código
contratado. O que muda é que, no par divergente, o portão vem **antes** — e os 19 cartões não
chegam à tela pela **ordem das guardas**, não por uma lista de exclusão. É a forma da ESPEC 027
`D-03`: calar pela peça, nunca pela gravidade.

### `D-08` — A validação de aditivo é peça contra **proposta**, não peça contra peça

`R-IDT-08` compara cada aditivo com a proposta, e não todos contra todos. Com quatro peças, a
comparação cruzada produziria seis achados para um arquivo errado; a comparação contra a
referência produz um, e nomeia o campo em que ele entrou (`R-DOC-06`).

### `D-09` — O aditivo divergente também pergunta, com outra frase

A decisão de `D-02` vale para os três achados, pelo mesmo princípio: o sistema não sabe qual
arquivo está errado. Mas a **consequência** de seguir é diferente, e a mensagem tem de dizê-la —
no caso do levantamento, o documento sai com dois números; no do aditivo, **itens de outro
instrumento entram no escopo do contrato**, e o total muda. §9.3 escreve isso com todas as
letras.

### `D-10` — O portão pergunta **antes** do trabalho, e por isso precisa de leitura barata

Perguntar depois do processamento sairia de graça em código e caro em uso: ~30 s para fazer a
pergunta, mais ~30 s para refazer tudo ao ouvir *sim* (§2.7). O portão barato custa uma leitura de
página 1 e dez linhas de planilha — **menos de um segundo** — e nunca cobra os 30 s de quem vai
responder *não*.

Isto acrescenta um método ao *port* do extrator (`identificar`), coisa que nenhuma espec precisou
fazer até aqui. É a única concessão arquitetural desta entrega, e ela é aditiva: `extrair`
continua como está, e o método novo não é chamado pelo fluxo de geração.

A validação **continua rodando dentro do fluxo completo**, com ou sem portão prévio (`R-IDT-10`,
segundo parágrafo). O portão é conveniência; a validação é a garantia.

---

## 7. O que muda no código

| Arquivo | Mudança | Tamanho |
|---|---|---|
| `domain/value_objects/identidade_contratual.py` | **novo** — `IdentidadeContratual`, `de_texto()`, `de_referencia_da_aba()`, comparação por base/órgão/ano, `__str__` | ~70 linhas |
| `domain/entities/validation_finding.py` | `Severity.PERGUNTA`; `bloqueado` passa a incluí-la; `confirmaveis` ao lado de `bloqueantes` e `avisos` | ~15 linhas |
| `domain/entities/contract.py` | dois campos **por último e com padrão** (`identidade`, `processo`); os dois entram na lista fixa de `aplicar` (`R-IDT-09`) | ~8 linhas |
| `infrastructure/contract/pdfplumber_extractor.py` | duas regexes; preenchimento **nos dois pontos de construção** (§2.8); `identificar()` — só a página 1 | ~35 linhas |
| `infrastructure/measurement/levantamento_reader.py` | `identificar()` — dez linhas da aba, `read_only` | ~15 linhas |
| `infrastructure/validations/identity_validations.py` | **novo** — as três validações, no padrão de guardrails do TRIADE | ~130 linhas |
| `infrastructure/di/container.py` | `identidade_confirmada` em `Entradas`; três chamadas, sob guarda; `conferir_identidade()` para o portão | ~30 linhas |
| `api/routers/reports.py` | `POST /reports/conferencia-previa`; o campo `identidade_confirmada`; `confirmaveis` no 422 | ~50 linhas |
| `api/schemas.py` | `RespostaDaConferencia`; `confirmaveis` em `RespostaBloqueada` | ~25 linhas |
| `frontend/src/app/components/UploadForm.tsx` | a caixa de `R-DOC-08` passa a aceitar também o aviso vindo do servidor | ~40 linhas |
| `frontend/src/app/page.tsx`, `lib/api.ts`, `lib/types.ts` | a chamada prévia e o transporte da confirmação | ~50 linhas |
| `tests/test_identidade_contratual.py` | **novo** — o objeto de valor sem abrir arquivo, e os cruzamentos com as fixtures reais | ~220 linhas |

**Não mudam**: `Measurement` (o campo já é lido), `GenerateMeasurementReport`, os renderizadores,
o `.docx`, o `.xlsx`, e o `conftest` — **nenhuma fixture nova: o cenário de erro é o cruzamento
das fixtures reais que já existem**.

### 7.1 O portão, de ponta a ponta

1. A pessoa escolhe os arquivos e clica em *Gerar relatório*.
2. O frontend chama `POST /reports/conferencia-previa` com os mesmos arquivos. O backend lê **a
   página 1 de cada PDF e dez linhas da aba** e responde em menos de um segundo.
3. **Batendo**, ou faltando identidade em algum lado (`R-IDT-06`), o fluxo segue direto para
   `POST /reports` — a pessoa não vê nada, e não perdeu tempo nenhum.
4. **Divergindo**, aparece a caixa âmbar de `R-DOC-08` com o texto de §9 e os dois botões:
   *Trocar arquivo* e *Gerar assim mesmo*.
5. *Gerar assim mesmo* chama `POST /reports` com `identidade_confirmada=true`. A validação roda de
   novo, encontra a mesma divergência, e **rebaixa a aviso** — que sai na lista de achados junto
   do relatório (`R-IDT-11`).
6. Sem a confirmação, `POST /reports` devolve 422 com `confirmaveis` preenchido e nenhum
   documento. É a rede para quem chama a API direto, e para o dia em que o passo 2 falhar.

### 7.2 A ordem no orquestrador

Dentro de `DIContainer.gerar`, três inserções:

1. **`V-IDT-03`**, no laço que já percorre os aditivos, sob o `if aditivo.itens` — e **antes** de
   `proposta.aplicar(aditivos)`, por `R-IDT-08`.
2. **`V-IDT-01` / `V-IDT-02`**, depois de `v_med_01_aba_reconhecida`, **dentro do `if
   medicao.itens`** que a ESPEC 027 `R-LEV-01` já criou. Fora dessa guarda, uma planilha ilegível
   seria acusada de *"ser de outro contrato"* — consequência descrita como causa, que é o que
   `R-GRD-06` proíbe desde os 57 achados do `PA-PGM`.
3. `identidade_confirmada` chega por `Entradas` e decide **a severidade do achado**, nunca a sua
   existência.

As guardas vivem no container, e não dentro das validações, para que elas não precisem saber em
que ordem são chamadas: é a forma já estabelecida por `v_ctr_01` e pelas três da medição.

---

## 8. Validações

| Id | Gatilho | Sem confirmação | Confirmado | Onde |
|---|---|---|---|---|
| `V-IDT-01` | os dois lados declaram identidade e o **órgão** difere | **PERGUNTA** | AVISA | contrato × levantamento |
| `V-IDT-02` | mesmo órgão, **base numérica ou ano** diferentes | **PERGUNTA** | AVISA | contrato × levantamento |
| `V-IDT-03` | peça cujo contrato **ou** processo difere do da proposta | **PERGUNTA** | AVISA | proposta × cada aditivo |
| `V-IDT-04` | competência da aba fora da vigência declarada | AVISA | — | *segunda onda* (`D-06`) |

**Nenhuma delas bloqueia em definitivo**, por `D-02`. As três impedem a emissão até que alguém
responda, e nenhuma impede que alguém responda *siga*.

**Diferença de sufixo não é gatilho de nada** (`R-IDT-04`, `I-03`).

**`V-IDT-04`**, medida e adiada: `contrato.pdf` declara `a partir de 01/07/2026` + `12 meses`, e a
aba traz `15/07/2026`; `contrato_pgm.pdf` declara `01/12/2025 até 30/11/2026`, e a aba,
`23/07/2026`. **Os dois pares reais caem dentro.** `aditivo_pgm.pdf` diz *"8 meses a partir da
assinatura"* — sem data absoluta, silêncio por `R-IDT-06`.

---

## 9. Catálogo de mensagens

O portão usa a caixa âmbar de `R-DOC-08` — `role="status"`, não `alert`: não é erro, é ressalva
sobre uma escolha ainda reversível (`R-ACE-13`). Dentro dela, as mesmas quatro partes dos achados:
o que houve, como o sistema concluiu, o que fazer, e os números recolhidos em `▸`.

### 9.1 `V-IDT-01` — o levantamento parece ser de outro contrato

> ⚠️ **Estes dois arquivos parecem ser de contratos diferentes.**
>
> O contrato enviado é o **52/SMIT/2024** (proposta `PA-SMIT-260319-739`), e o levantamento
> `PGM_Levantamento_07-2026.xlsx` declara **015/PGM/2024**.
>
> Se seguir assim mesmo, o relatório sairá com o órgão do contrato na capa e o número do
> levantamento no cabeçalho.
>
> **Trocar arquivo** · *Gerar assim mesmo*
>
> ▸ *Detalhes técnicos (para o suporte)* — `V-IDT-01` · contrato: `52/SMIT/2024` (página 1 de
> `PA-SMIT-260319-739.pdf`) · planilha: `TC 015/PGM/2024` (cabeçalho da aba Levantamento)

A terceira frase é a que `D-02` exige: **quem decide precisa saber o que vai acontecer se
decidir seguir.** Sem ela, *"gerar assim mesmo"* é um botão sem consequência declarada.

### 9.2 `V-IDT-02` — mesmo órgão, contrato diferente

> ⚠️ **O número do contrato não confere entre os dois arquivos.**
>
> O contrato enviado é o **15/PGM/2024** e o levantamento declara **20/PGM/2024**. Os dois são da
> PGM.
>
> Se seguir assim mesmo, o relatório sairá com o número do levantamento no cabeçalho e a proposta
> do contrato enviado no rodapé.
>
> **Trocar arquivo** · *Gerar assim mesmo*

Aditivo que renumerou o contrato com sufixo — `52-A/SMIT/2024` — **não chega aqui**: `R-IDT-04`
reconhece o mesmo contrato, e a tela fica calada.

### 9.3 `V-IDT-03` — o aditivo é de outro contrato

O `{papel}` é o vocabulário da ESPEC 025 — *1º aditivo*, *2º aditivo* — porque é o campo do
formulário que a pessoa vai mexer.

> ⚠️ **O {papel} parece ser de outro contrato.**
>
> A proposta é do contrato **52/SMIT/2024**, processo `7010.2024/0004617-5`; o arquivo
> `PA-PGM-260304-715` é do contrato **15/PGM/2024**, processo `7010.2024/0009720-9`.
>
> Se seguir assim mesmo, **os itens deste aditivo entrarão no escopo do contrato 52/SMIT/2024** —
> o contratado consolidado muda, e com ele a conferência.
>
> **Remover este aditivo** · *Gerar assim mesmo*
>
> ▸ *Detalhes técnicos (para o suporte)* — `V-IDT-03` · divergem: contrato e processo

Quando só um dos eixos diverge, o detalhe diz qual: `divergem: processo` é o caso de dois
instrumentos do mesmo órgão e ano cujo número foi grafado igual por engano.

### 9.4 O achado que sobra depois do *sim* (`R-IDT-11`)

Confirmado o envio, o relatório sai — e o achado desce para a lista de avisos, com o texto no
passado:

> **Par confirmado pelo usuário: o levantamento declara outro contrato.** O contrato é
> `52/SMIT/2024` e o levantamento declara `015/PGM/2024`. O documento foi emitido com esta
> divergência, confirmada no envio.

### 9.5 O que não acontece mais

* Os 19 (ou 14) `V-CTR-05` do par divergente aparecerem **sem** a frase que os explica.
* Um `.docx` de par trocado sair sem que ninguém tenha visto a divergência.
* Trinta segundos de espera para descobrir que os arquivos não combinam.

---

## 10. Testes e portões

### 10.1 Aceite

* Os quatro cruzamentos do §2.4 que declaram identidade dos dois lados: `V-IDT-01` como
  `PERGUNTA`, com o texto de §9.1, e **sem documento**.
* Os mesmos quatro com `identidade_confirmada=true`: documento emitido, achado presente **como
  aviso** (`R-IDT-11`).
* `contrato.pdf` + `aditivo_pgm.pdf`: `V-IDT-03` **antes** da consolidação — provado pelo
  consolidado não conter os códigos do aditivo.
* `V-IDT-02` em `Contract`/`Measurement` construídos em memória: mesmo órgão, base diferente →
  pergunta; **mesmo órgão, só o sufixo diferente → silêncio** (`I-03`).
* O objeto de valor, sem abrir arquivo: `015` = `15`; `smit` = `SMIT`;
  `TC 52/SMIT/2024` = `Contrato Nº 52/SMIT/2024`; `52-A/SMIT/2024` = `52/SMIT/2024`; string sem
  identidade devolve `None`.
* A conferência prévia responde em **menos de 2 s** para os dois pares reais, com um aditivo
  anexado (limiar folgado sobre os 0,65 s medidos, para não virar teste instável em CI).

### 10.2 Regressão

* Os dois pares reais: **nenhum achado novo**, contagem idêntica à de hoje.
* `modelo.pdf` e `amostra_sem_tabela.pdf` como contrato: continuam bloqueando em `V-DOC-01`, e
  **não** ganham `V-IDT-01` (`R-IDT-06`).
* `levantamento_codigos_deslocados.xlsx`: continua produzindo **um** cartão `V-MED-01`, e a guarda
  do §7.2 impede o segundo.
* O caminho com aditivo do PGM: consolidado idêntico, 58 linhas, `identidade` e `processo`
  presentes no consolidado (`R-IDT-09`).
* `identidade_confirmada` **ausente** no envio não confirma nada: 422 com `confirmaveis`.

### 10.3 As âncoras

`test_identidade_dos_artefatos.py` guarda o `sha256` por entrada dos quatro pacotes dos dois pares.
Esta espec **não pode movê-las** — nem no caminho confirmado, onde o rastro fica na tela e nos
achados e o documento sai como sempre saiu. Se ficarem vermelhas, a resposta não é reancorar: é
que a entrega alcançou o documento, o que §4.2 proíbe. Mesma disciplina da ESPEC 026 `R-DES-01`.

### 10.4 Portões

* **`P0`** — os dois pares reais geram `.docx` e `.xlsx` **idênticos parte a parte** aos de hoje,
  sem achado novo.
* **`P1`** — as quatro trocas do §2.4 param com o cartão de §9.1 e **sem documento**.
* **`P2`** — `contrato.pdf` + `aditivo_pgm.pdf` para em `V-IDT-03` antes de consolidar.
* **`P3`** — identidade ausente em qualquer dos lados não produz achado, exercitado com
  `modelo.pdf`, `amostra_sem_tabela.pdf` e `levantamento_codigos_deslocados.xlsx`.
* **`P4`** — o objeto de valor decide os degraus sem abrir arquivo, **sufixo incluído**.
* **`P5`** — o ciclo do portão de ponta a ponta: pergunta → confirmação → documento com o aviso de
  `R-IDT-11`.
* **`P6`** — a conferência prévia não abre a tabela de itens: medida abaixo de 2 s.
* **`P7`** — suíte verde, sem achado novo em teste existente e sem âncora movida.

---

## 11. Riscos

| Risco | Mitigação | Evidência |
|---|---|---|
| Contrato grafado fora do padrão → pergunta indevida | Ausência em qualquer dos lados é silêncio; e o pior caso é uma pergunta, não um bloqueio | §2.4, `D-02` |
| `015` vs `15` → pergunta indevida no par real | Normalização por base numérica | §2.3 |
| Contrato renumerado com sufixo → pergunta indevida | Sufixo fora da comparação (`R-IDT-04`) | `I-03` |
| Levantamento incompleto confundido com par trocado | A cobertura não é gatilho; `V-CTR-05` continua sendo o veículo | `I-01`, `D-05` |
| *Gerar assim mesmo* virar reflexo, clicado sem ler | A frase da consequência em §9; e o aviso que permanece no resultado (`R-IDT-11`) | ESPEC 015 `D-01` — *confirmação que exagera no caso leve ensina a confirmar sem ler* |
| A conferência prévia falhar e o fluxo travar | Ela é conveniência: falhando, o envio segue e o 422 com `confirmaveis` faz o mesmo papel | `D-10` |
| Identidade perdida no consolidado ou no caminho sem tabela | `R-IDT-09` e preenchimento nos **dois** pontos de construção | §2.8, `T-1420` |

---

## 12. Pontos em aberto

### Respondidos em 2026-08-20

* **`I-01`** — *existe caso legítimo de levantamento que não cubra 100 % dos códigos do contrato?*
  → **"Não é normal, mas pode ocorrer."** Fecha `D-05`: a cobertura não vira validação.
* **`I-02`** — *um levantamento pode consolidar mais de um contrato do mesmo órgão?* → **"Pode
  juntar um contrato e um aditivo"** — que é **um** instrumento. Fecha `R-IDT-03`: citações de
  peça na linha do contrato não são um segundo contrato.
* **`I-03`** — *a numeração muda ao ser aditivada?* → **"Sim, pode ganhar sufixo."** Muda
  `R-IDT-04`: compara-se a base numérica, e o sufixo fica fora.
* **`I-04`** — *bloquear ou avisar?* → **"Avisar e perguntar se deseja continuar."** É o
  `R-IDT-10`, e reescreveu `D-02`.

* **`I-06`** — *o documento emitido com par confirmado deve carregar rastro da confirmação?* →
  **Não** (2026-08-20). O `.docx` sai idêntico; a divergência vive na tela e na lista de
  ressalvas. Fecha §4.2 e autoriza `P0` a ancorar os pacotes também no caminho confirmado.

### Decididos na engenharia, e declarados

* **`I-05`** — a conferência prévia **inclui os aditivos**. São 0,31 s por peça, e o portão inteiro
  fica em 0,65 s (§2.7); deixar o aditivo de fora criaria a única divergência que só apareceria
  depois dos 30 s, que é exatamente o que `D-10` existe para evitar.
* **`I-07`** — a confirmação **não registra quem confirmou**. O serviço é sem estado e sem
  autenticação (ESPEC 001 §7.2); gravar um nome exigiria as duas coisas, e um campo de texto livre
  registraria o que a pessoa digitasse, não quem ela é. Reabrir no dia em que houver autenticação.

---

## 13. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | `P0` — as âncoras dos dois pares, antes de tudo | PP |
| B | O objeto de valor e os seus testes puros, sufixo incluído (`P4`) | P · **publicável sozinha** |
| C | Os campos no `Contract`, a derivação no extrator, `R-IDT-09` | P |
| D | `V-IDT-01` e `V-IDT-02`; `Severity.PERGUNTA`; o 422 com `confirmaveis` | M |
| E | `V-IDT-03` e a ordem no orquestrador (`P2`) | P |
| F | A conferência prévia: `identificar()` nos dois leitores e o *endpoint* (`P6`) | M |
| G | A tela: a caixa de `R-DOC-08` com a resposta do servidor, e a confirmação no envio (`P5`) | M |
| H | Regressão, `P3` e `P7` | PP |

**Total: dois dias.** A v1.0 estimava um; o portão que pergunta acrescenta o *endpoint* barato, a
severidade nova e o ciclo da tela. O mecanismo de cartão, guarda e caixa de confirmação continua
vindo pronto das ESPECs 015, 025 e 027 — esta espec acrescenta **um eixo de conferência e um
estado**, não um mecanismo.

---

## 14. Relação com as especs anteriores

### 14.1 ESPEC 025 e ESPEC 027 — a mesma patologia, o terceiro lugar

As duas abrem com *n* mensagens para uma causa: três no campo Contrato, sessenta no campo
Levantamento. Aqui são dezenove, e a diferença é que **naquelas duas o documento não saía**. O
mecanismo que elas construíram é reusado inteiro; o que esta acrescenta é a detecção que faltava
para haver o que dizer.

### 14.2 ESPEC 025 `R-DOC-08` — a caixa que esta espec herda

`R-DOC-08` já pergunta antes de processar — *"este arquivo parece ser um levantamento… Trocar
arquivo · Usar assim mesmo"* — e já resolve o guardar-pelo-nome para que o aviso volte na segunda
troca. `R-IDT-10` é a mesma caixa com um juízo melhor por trás: lá o palpite é o nome do arquivo,
aqui é o conteúdo dos dois documentos.

### 14.3 ESPEC 015 — o precedente da confirmação

*"Confirmação que exagera no caso leve ensina a confirmar sem ler; e aí a pessoa confirma sem
ler."* É o comentário que abre `ConfirmarLimpeza.tsx`, e é a régua desta espec: o portão só
aparece quando há divergência real de identidade, nunca por precaução.

### 14.4 ESPEC 019 — `V-ADT-03` e o eixo que ela não olha

`V-ADT-03` já bloqueia as duas formas de submeter peças erradas: a repetida e a proposta no campo
de aditivo. Ela pergunta *que forma tem esta peça*; `V-IDT-03` pergunta *de que contrato ela é*.
São perguntas independentes, e o par `contrato.pdf` + `aditivo_pgm.pdf` passa pela primeira sem
arranhão.

### 14.5 ESPEC 020 `D-05` — o precedente da derivação por prosa

`_cliente` estabeleceu que derivar de prosa é aceitável **quando o dano da falha é limitado e a
limitação é medida**. `D-01` aplica os mesmos limites, com uma diferença a favor: aqui o pior
desfecho de um engano é uma pergunta a mais.

### 14.6 ESPEC 026 e ESPEC 018 — o que esta espec tem de respeitar

As âncoras de `sha256` por entrada (`R-DES-01`) e as 58 linhas dos dois pares (ESPEC 018 §2.2).
Ambas entram como `P0` e como regressão.

---

## 15. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1 | 2026-08-20 | Análise e desenho, a pedido: *"é possível criar uma validação… contrato de PMG e levantamento de SMIT"* |
| 1.0 | 2026-08-20 | Redação completa no formato das ESPECs 025/027. §2.8 acrescentada depois de encontrar os dois pontos de construção do `Contract` |
| 1.3 | 2026-08-20 | **Implementada.** Backend verde; 40 testes novos. O portão medido em 0,9 s no par real e 1,15 s com aditivo. Quatro achados de execução, dois deles defeitos meus: a `V-CTR-05` continuava emitindo os dezenove cartões ao lado da pergunta que os explica (`D-07` não implementada), e o `waitForResponse` da suíte de tela capturava a resposta do portão no lugar da do relatório — ver TASKS 029 §11.5 e §11.6 |
| 1.2 | 2026-08-20 | `I-06` respondido — o documento não carrega rastro da confirmação, e `P0` passa a ancorar também o caminho confirmado. `I-05` e `I-07` decididos na engenharia e declarados. `R-IDT-12` acrescentada: o portão **falha aberto**, exigência descoberta ao ver que a suíte de navegador intercepta `**/reports` e não alcançaria o *endpoint* novo |
| 1.1 | 2026-08-20 | **Quatro insumos respondidos pelo negócio.** `I-04` trocou o bloqueio pelo portão que pergunta (`R-IDT-10`, `R-IDT-11`, `D-02`, `D-09`, `D-10`, §7.1, §9); `I-03` tirou o sufixo da comparação (`R-IDT-04`); `I-02` fixou que contrato + aditivo é um instrumento (`R-IDT-03`); `I-01` fechou `D-05`. §2.7 e §2.9 acrescentadas para sustentar o portão barato |
