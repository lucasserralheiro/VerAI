# ESPEC 025 — O arquivo que não é a proposta

| | |
|---|---|
| **Status** | **Implementada com ressalva** — 2026-08-18. Portões `P0` a `P5` e `P7` fechados; **`P6` aberto** — exige alguém do faturamento diante da tela, e é humano. Backend 559 → **578**; navegador 6/6 no spec novo e 20/20 no de anúncios |
| **Versão** | 1.0 — 2026-08-18 |
| **Depende de** | [ESPEC 017](017-grade-do-contrato-derivada-do-documento.md), [ESPEC 019](019-contrato-e-aditivos.md), [ESPEC 020](020-capa-do-documento.md) e [ESPEC 023](023-o-aviso-que-diz-o-que-fazer.md) — implementadas |
| **Revisa** | `V-ADT-01` como mensagem única para dois problemas de donos opostos; a cascata de `V-CTR-01` e `V-CAP-01` sobre peça já bloqueada |
| **Não toca** | A extração (`R-GRD-*`, `R-ADT-*`), a consolidação (`R-QTD-*`), o `.docx`, o `.xlsx`. Esta espec muda **o que se diz** sobre uma extração que já decidiu certo |
| **Referência normativa** | `backend/tests/fixtures/modelo.pdf` (o relatório GRC), `contrato.pdf`, `contrato_pgm.pdf`, `aditivo_pgm.pdf`, `saida/amostra-p1.pdf` |
| **Origem** | *"Agindo como especialista nas regras de negócio do confere e engenheiro de software sênior e especialista em ux e ui, há como propor mensagens mais claras para o cenário da imagem"* |

---

## 1. Problema

Um usuário submeteu, no campo **Contrato**, o PDF do relatório de levantamento GRC. A tela devolveu
três mensagens:

```
V-ADT-01  contrato (sem identificação): nenhum item extraído [41 páginas, 40 com
          borda desenhada, 41 com texto, no máximo 23 divisórias verticais numa página]
V-CTR-01  tabela de itens não localizada no contrato — verifique se o PDF é a proposta
          comercial completa [41 páginas, 40 com borda desenhada, 41 com texto, …]
V-CAP-01  o nome do órgão não foi derivado da proposta — a capa identificará o cliente
          pelo título do levantamento
```

São **três mensagens para uma causa**, e nenhuma delas a nomeia. As três descrevem o mecanismo
interno — grade, divisórias, capa — enquanto a causa real cabe numa linha e o usuário podia
resolvê-la em dez segundos.

E há um problema mais grave que a redação: **`V-ADT-01` cobre dois casos com donos opostos.**
*"Nenhum item extraído"* pode ser *você enviou o arquivo errado* — dono: o usuário, conserto
imediato — ou *este layout eu não sei ler* — dono: a engenharia, conserto por suporte. Hoje os dois
produzem o mesmo texto, e quem lê não tem como saber se a bola é dele. Nenhuma reescrita de frase
resolve isso: a mensagem não pode ser clara sobre uma distinção que o sistema não fez.

---

## 2. O que foi medido

Execução sobre `feature/evolucao`, com os PDFs reais do repositório.

### 2.1 O arquivo submetido é o `modelo.pdf` da própria suíte

A assinatura da tela — *41 páginas, 40 com borda, 41 com texto, máx. 23 divisórias* — bate com
`docs/documentos/SMIT_SUSTENTACAO_Levantamento_05969_TC_52SMIT2024_….pdf`, que é byte a byte o
mesmo arquivo de `backend/tests/fixtures/modelo.pdf` (MD5 `67f340c5c9002a410f31e795bcd780f7`): o
**relatório GRC de referência**, origem do teste-âncora da `T-50`.

O engano é natural, e vale registrar por quê: o relatório GRC é o documento que quem confere
conhece melhor — é o que o Confere **produz**. Submetê-lo como entrada é o erro mais provável que
existe nesta tela, e a fixture dele já está no repositório.

### 2.2 O documento tem tabelas de sete colunas, e nenhuma delas é a tabela de itens

`analisar_geometria` acha **três** geometrias candidatas, e as três passam por `R-GRD-02`. As três
são listas de matrícula:

```
['SMIT', 'x599276', 'ANA LAURA DA COSTA FRI…', '01/06/2026', '08/07/2026', '08/07/2026 15:06:37', 'Ativo']
```

`_geometrias_de_itens` (ESPEC 019 `D-05`) filtra as três, corretamente, e o contrato sai vazio.
**A decisão está certa; o que se perde é a razão dela.**

### 2.3 O discriminador já é calculado, e separa os quatro documentos sem exceção

| arquivo | `p.1` traz `Proposta Comercial` / `Proposta de Aditivo:` | códigos de serviço por geometria candidata |
|---|---|---|
| `contrato.pdf` (proposta SMIT) | **sim** | `[57, 6]` |
| `contrato_pgm.pdf` (proposta PGM) | **sim** | `[46, 5]` |
| `aditivo_pgm.pdf` (aditivo PGM) | **sim** | `[5, 5, 2, 2]` |
| `modelo.pdf` (relatório GRC) | **não** | `[0, 0, 0]` |

Dois sinais independentes, os dois já pagos pela extração de hoje — `_proposta()` lê a página 1, e
`_Candidato.codigos` é contado dentro de `analisar_geometria`. Ambos separam limpo, e concordam. A
regra pode exigir que **os dois** falhem antes de acusar, e ainda assim acerta.

### 2.4 A página 1 diz qual arquivo o usuário deveria ter enviado

```
Contrato : TC 52/SMIT/2024 - TA 02
Proposta : PC-SMIT-240402-53 V1.0 / PA-SMIT-250220-15 V 1.4 /
           PA-SMIT-260319-739
```

E `PA-SMIT-260319-739` é exatamente o arquivo que existe ao lado dele em `docs/documentos/`, que
extrai **60 itens**, total `10.637.425,00`, em 5,9 s. O sistema tem, no texto que já leu — a mesma
string que `_proposta()` e `_cliente()` percorrem —, o nome do arquivo certo.

### 2.5 A evidência degrada em degraus, e o degrau mais baixo ainda serve

O relatório GRC é o engano *provável*. Mas o campo aceita qualquer PDF, e a mensagem não pode
depender de sorte:

| arquivo | páginas com texto | geometrias candidatas | `Proposta` na p.1 | propostas citadas |
|---|---|---|---|---|
| `modelo.pdf` (relatório GRC) | 41/41 | `[0, 0, 0]` | não | **3** |
| `saida/relatorio.pdf` (saída do Confere) | 2/2 | `[]` | não | 1 |
| `saida/amostra-p1.pdf` (uma folha solta) | 1/1 | `[]` | não | **nenhuma** |

A última linha é o pior caso realista, e é o do PDF aleatório: nenhum sinal positivo, nada a citar.
**A mensagem continua correta e acionável** porque a sua âncora não é *o que o documento é* — é *o
que o campo exige*, que se sabe sempre (`D-06`).

### 2.6 Diagnóstico caro está descartado por medição

Varrer o documento inteiro atrás de códigos de serviço — o reforço óbvio — custa **16,7 s** neste
PDF, quase dobrando um caminho de falha que já leva 16,6 s. E não é preciso: §2.3 mostra que os
sinais gratuitos bastam. Fica registrado para não ser reproposto.

---

## 3. Objetivo

Que a tela de bloqueio diga **qual arquivo**, **por que ele não serve** e **o que enviar no lugar**
— e que separe o erro de quem envia do limite de quem programa, porque as ações são diferentes.

---

## 4. Escopo

### 4.1 Dentro do escopo

* Nova validação `V-DOC-01` — a peça submetida não é uma proposta.
* `V-ADT-01` restrita ao caso que sobra: é proposta, e ainda assim não rendeu itens.
* Supressão de `V-CTR-01` e `V-CAP-01` sobre peça já bloqueada.
* Achado estruturado (`titulo`, `causa`, `acao`, `detalhe`) e o cartão que o renderiza.
* O nome do arquivo submetido, hoje descartado, identificando a peça.
* Aviso no formulário, antes de processar.

### 4.2 Fora do escopo

* Classificar *o que o documento é*. Prova-se que **não é proposta**; não se afirma que é
  levantamento (`D-02`).
* Reaproveitar o arquivo no campo certo automaticamente (`D-03`).
* Qualquer mudança na extração, na consolidação, no `.docx` ou no `.xlsx`.

---

## 5. Regras

* `R-DOC-01` — A identidade da peça é apurada **com o que a extração já pagou**. Nenhuma leitura
  adicional do PDF.
* `R-DOC-02` — A peça é reconhecida como proposta quando a página 1 casa `Proposta Comercial` ou
  `Proposta de Aditivo:` **ou** alguma geometria candidata contém código de serviço. Basta um dos
  dois (§2.3).
* `R-DOC-03` — Não reconhecida e sem itens, `V-DOC-01` **bloqueia**. A mensagem tem uma parte fixa
  — o que o campo exige e o que o arquivo não tem — e acrescenta, **quando houver**, a evidência do
  degrau alcançado:

  | degrau | evidência disponível | acréscimo |
  |---|---|---|
  | 1 | nenhuma página com texto | "este PDF é uma imagem digitalizada" |
  | 2 | nenhuma tabela de sete colunas | "não há tabela de preços neste PDF" |
  | 3 | tabelas de sete colunas, sem código de serviço | "as tabelas deste PDF não trazem códigos de serviço" |
  | 4 | propostas citadas na página 1 | "este PDF cita as propostas *X*, *Y*, *Z* — envie uma delas" |

  Nenhum acréscimo é obrigatório. A parte fixa sozinha já diz o que fazer (`D-06`).
* `R-DOC-04` — Reconhecida como proposta e ainda assim sem itens, vale `V-ADT-01`, com a ação
  dirigida ao **suporte**: é limite do sistema, não erro do usuário.
* `R-DOC-05` — Todo achado carrega `titulo`, `causa`, `acao` e `detalhe`. `mensagem` continua
  existindo, como concatenação, para quem já a consome.
* `R-DOC-06` — O nome do arquivo submetido identifica a peça na tela.
* `R-DOC-07` — Peça bloqueada não gera achado que descreva consequência sua. Extensão da
  `R-GRD-06` a `V-CTR-01` e `V-CAP-01`.
* `R-DOC-08` — O formulário avisa, **antes de processar**, quando o arquivo do campo Contrato
  aparenta não ser proposta pelo nome. Aviso, nunca impedimento.

---

## 6. Decisões

### `D-01` — Diagnosticar com o que já foi pago

§2.6 mediu a alternativa: 16,7 s por um reforço que §2.3 torna dispensável. O caminho de falha não
pode ficar mais lento que o de sucesso.

### `D-02` — Provar, não classificar

A mensagem afirma o que a evidência sustenta — *não é uma proposta*, *estas propostas são citadas*
— e não *isto é um levantamento*. Classificar por prosa é a fonte que mais muda sem avisar, e a
ESPEC 020 `D-05` já paga esse preço numa única regra, declaradamente. Não se pagam duas.

### `D-03` — Não corrigir em silêncio

Reaproveitar o arquivo no campo certo seria adivinhar, num sistema que instrui faturamento.
Pergunta-se; não se conserta.

### `D-04` — A causa é decidida no domínio

O React renderiza `titulo`/`causa`/`acao`/`detalhe`. Decidir a causa em TypeScript poria regra de
negócio em duas linguagens — o mesmo motivo pelo qual `DivergenciaDeFonte` já chega formatada.

A causa é **função pura do diagnóstico**, no espírito de `_escolher_gabarito` (ESPEC 017): decide
sobre dados simples, e por isso os quatro degraus da `R-DOC-03` são testáveis sem abrir PDF nenhum
— inclusive o degrau 1, para o qual o repositório não tem fixture digitalizada.

### `D-05` — Uma peça, um cartão

A unidade da tela passa a ser o arquivo submetido, e não a validação. É o que faz três mensagens
virarem uma sem esconder nada.

### `D-06` — A âncora da mensagem é o campo, não o documento

O sistema não precisa saber *o que* o arquivo é para dizer algo útil: ele sabe *o que o campo
Contrato exige* — o PDF com a tabela de itens, com códigos e preços. Essa frase é verdadeira para
todo arquivo recusado, do relatório GRC ao PDF sem relação nenhuma.

É o que faz `R-DOC-03` degradar sem quebrar (§2.5): as evidências são acréscimos, e a ausência de
todas elas ainda deixa uma mensagem correta e acionável. O contrário — construir a mensagem a
partir da identificação do documento — só funciona quando a identificação funciona, e falha
justamente no caso mais estranho, que é onde a ajuda mais falta.

### `D-07` — O aviso do formulário é independente, e vale mais

`R-DOC-08` são dezessete segundos economizados e uma tela de erro evitada, por uma comparação de
string. Entra separado, e não depende de nada acima.

---

## 7. O que muda no código

| Arquivo | Mudança |
|---|---|
| `domain/entities/contract.py` | `DiagnosticoDaGrade` ganha `geometrias_candidatas`, `codigos_nas_candidatas` e `parece_proposta` |
| `domain/entities/validation_finding.py` | campos `titulo`, `causa`, `acao`, `detalhe`; `mensagem` derivada |
| `infrastructure/contract/pdfplumber_extractor.py` | preenche os três campos e coleta as referências de proposta da p.1 (`_REFERENCIA = \b(?:PC\|PA)-[A-Z]+-[\d-]+`); nenhuma leitura nova de PDF |
| `infrastructure/validations/contract_validations.py` | `v_doc_01_peca_nao_e_proposta` e a função pura da causa; `v_adt_01` passa a exigir `parece_proposta` |
| `infrastructure/di/container.py` | ordem e guardas da `R-DOC-07` |
| `api/routers/reports.py` e `Entradas` | carrega o `filename` original, hoje descartado em `gravar(..., "contrato")` |
| `api/schemas.py` | `Achado` ganha os quatro campos, opcionais |
| `frontend/src/app/components/ResultadoPanel.tsx` | `ListaDeAchados` → `CartaoDeAchado` |
| formulário do frontend | aviso da `R-DOC-08` |

**Faseamento** — três entregas independentes, do maior retorno por linha para o menor:

1. `R-DOC-08` — o aviso do formulário. Uma comparação de string; não toca no backend.
2. `R-DOC-06` + `R-DOC-07` — nome do arquivo e fim da cascata. Derruba duas das três mensagens da
   §1 sem mexer em contrato de API.
3. `V-DOC-01` + achado estruturado + cartão. O resto.

---

## 8. Validações

**Entra** — `V-DOC-01` (BLOQUEIA): a peça submetida não é uma proposta.

**Muda** — `V-ADT-01` passa a valer só para peça reconhecida como proposta, e a ação vira suporte.
`V-CTR-01` e `V-CAP-01` deixam de ser registradas sobre peça já bloqueada (`R-DOC-07`).

**Intactas** — `V-CTR-03`, `V-CTR-04`, `V-CTR-05`, `V-ADT-02` a `V-ADT-04`, `V-MED-*`, `V-REC-01`.

---

## 9. Catálogo de mensagens

Todo achado tem quatro partes (`R-DOC-05`), e o cartão as empilha nesta ordem:

| parte | papel | tom |
|---|---|---|
| `titulo` | **o que houve**, no vocabulário de quem confere | afirmativo, sem código de validação |
| `causa` | **como o sistema concluiu** — a evidência, para que o leitor possa discordar | factual |
| `acao` | **o que fazer agora** | imperativo, um passo só |
| `detalhe` | os números da extração, recolhido em `▸` | técnico, para o suporte |

`mensagem` continua existindo como `f"{titulo} — {causa} {acao}"`, para quem já a consome.

### 9.1 Cabeçalho da tela

> ### Não foi possível gerar o relatório
> *(um bloqueio)* Corrija o ponto abaixo e envie novamente.
> *(mais de um)* Corrija os N pontos abaixo e envie novamente.

Substitui *"Processamento bloqueado — nenhum relatório foi gerado"*: *processamento* é vocabulário
do sistema, e *nenhum relatório foi gerado* repete no subtítulo o que o título já disse.

### 9.2 `V-DOC-01` — o arquivo não é uma proposta

Título e ação são fixos; a causa é o degrau alcançado (`R-DOC-03`), e a ação ganha uma segunda
frase no degrau 4.

**Título** — `{papel}` é *Contrato*, *1º aditivo*, *2º aditivo*…:

> **O arquivo enviado no campo {papel} não é uma proposta comercial.**
> `{nome-do-arquivo.pdf}`

**Causa**, por degrau:

| degrau | texto |
|---|---|
| 1 | Este PDF é uma imagem digitalizada: não há texto em nenhuma das {N} páginas. |
| 2 | Não há tabela de preços neste PDF: nenhuma das {N} páginas traz uma tabela de sete colunas. |
| 3 | As {K} tabelas de sete colunas deste PDF não trazem códigos de serviço, e a primeira página não traz "Proposta Comercial" nem "Proposta de Aditivo:". |

**Ação** — a primeira frase é fixa; a segunda só aparece no degrau 4:

> Envie no campo {papel} o PDF da proposta comercial — o documento com a tabela de itens, com
> códigos de serviço e preços.
> *(degrau 4)* Este PDF cita as propostas do contrato {contrato}: **{refs}**. Envie uma delas.

No degrau 1 a ação é outra, porque o conserto é outro:

> Envie o PDF original da proposta, gerado pelo sistema — não a versão escaneada.

**Detalhe** — `V-DOC-01` · {N} páginas · {texto} com texto · {borda} com bordas · {K} geometrias de
7 colunas, {códigos} códigos em cada · 0 tabelas com linha de preço completa

### 9.3 `V-ADT-01` — é proposta, e não conseguimos ler

O caso que sobra depois da `R-DOC-04`. **Muda de dono**: aqui o usuário não errou, e a mensagem
precisa dizer isso com todas as letras — senão ele fica tentando arquivos até desistir.

> **Não conseguimos ler a tabela de itens da proposta {identificação}.**
> `{nome-do-arquivo.pdf}`
>
> Este PDF é uma proposta — a primeira página a identifica —, mas a tabela de itens está num
> formato que o Confere ainda não lê.
>
> **Não é erro no seu envio.** Encaminhe este arquivo ao suporte com os detalhes técnicos abaixo.
>
> ▸ `V-ADT-01` · {diagnóstico}

### 9.4 O caso da origem, renderizado

> **O arquivo enviado no campo Contrato não é uma proposta comercial.**
> `SMIT_SUSTENTACAO_Levantamento_05969_….pdf`
>
> As três tabelas de sete colunas deste PDF não trazem códigos de serviço, e a primeira página não
> traz "Proposta Comercial" nem "Proposta de Aditivo:".
>
> Envie no campo Contrato o PDF da proposta comercial — o documento com a tabela de itens, com
> códigos de serviço e preços. Este PDF cita as propostas do contrato TC 52/SMIT/2024:
> **PC-SMIT-240402-53**, **PA-SMIT-250220-15**, **PA-SMIT-260319-739**. Envie uma delas.
>
> ▸ *Detalhes técnicos (para o suporte)* — `V-DOC-01` · 41 páginas · 41 com texto · 40 com bordas ·
> 3 geometrias de 7 colunas, 0 códigos em cada · 0 tabelas com linha de preço completa

Três achados viram um, e o único que fica diz qual arquivo procurar.

### 9.5 O aviso do formulário (`R-DOC-08`)

Antes de processar, e portanto sem os 16,6 s:

> ⚠️ **Este arquivo parece ser um levantamento.** O campo Contrato espera a proposta comercial em
> PDF. — *Enviar assim mesmo* · *Trocar arquivo*

### 9.6 O que some da tela

* `V-CTR-01` sobre peça já bloqueada — é o mesmo fato visto no consolidado (`R-DOC-07`).
* `V-CAP-01` sobre peça já bloqueada — promete uma capa que não vai existir (`R-DOC-07`).
* O colchete de diagnóstico no meio da frase — vira `detalhe`, recolhido.

---

## 10. Testes e portões

* `P0` — `modelo.pdf` como contrato produz **um** bloqueante, `V-DOC-01`, com as três referências
  de proposta na mensagem.
* `P1` — `contrato.pdf`, `contrato_pgm.pdf` e `aditivo_pgm.pdf` **não** disparam `V-DOC-01` — §2.3
  é o gabarito.
* `P2` — os quatro degraus da `R-DOC-03` são exercitados sobre `DiagnosticoDaGrade` construído à
  mão, sem abrir PDF (`D-04`).
* `P3` — `saida/amostra-p1.pdf` (nenhum sinal positivo, nada citado) produz `V-DOC-01` com a parte
  fixa e nenhuma linha de evidência — e a mensagem continua dizendo o que enviar.
* `P4` — proposta reconhecida e sem itens continua em `V-ADT-01`, com ação de suporte.
* `P5` — peça bloqueada não gera `V-CTR-01` nem `V-CAP-01`.
* `P6` — a suíte de hoje passa, sem mudança de comportamento nos casos verdes.
* `P7` — `axe` limpo no cartão novo; foco no `h2` e `role="alert"` preservados (ESPEC 008).
* `P8` — humano: uma pessoa do faturamento lê a tela e diz qual arquivo enviar, sem ajuda.

---

## 11. Riscos

* **Proposta futura sem a frase na página 1 e com tabela sem código nas candidatas** cairia em
  `V-DOC-01` com a mensagem errada. Exige os **dois** sinais da `R-DOC-02` falharem ao mesmo tempo;
  e hoje esse arquivo já bloqueia, com mensagem pior. Risco em queda, não em alta.
* **`_PROPOSTA` é regex sobre prosa**, com a fragilidade que a ESPEC 020 `D-05` já documenta —
  mitigada por `R-DOC-02` aceitar o outro sinal sozinho.
* **A `R-DOC-08` julga pelo nome do arquivo**, que é fraco por natureza. Por isso é aviso com saída
  — *Enviar assim mesmo* — e nunca impedimento.

---

## 12. Pontos em aberto

* `I-01` — **PDF aleatório e grande.** A causa é apurada depois da varredura de geometria, que é
  proporcional ao número de páginas — 16,6 s em 41. Um PDF alheio de 400 páginas faria o usuário
  esperar minutos por um *"este arquivo não serve"* que a primeira página já sugeria. Uma saída
  antecipada é possível, mas custa a evidência dos degraus 2 e 3, e nenhum arquivo real do
  repositório exercita esse caso. Registrado, não resolvido.
* `I-02` — Vale estender `V-DOC-01` ao campo **Levantamento**? O engano simétrico (PDF onde se
  espera XLSX) já é barrado pela extensão, mas o levantamento de outro contrato não é.
* `I-03` — O `.docx` deve exibir `causa`/`acao`, ou continua com `mensagem`? Esta espec não o toca;
  a decisão pode esperar.

---

## 13. Relação com as especs anteriores

### 13.1 ESPEC 017 `R-GRD-06` — a regra que esta tela estava violando

*"A tela relata a causa, não a consequência"* nasceu dos 57 achados do `PA-PGM`, e a `T-1118` a
mede. A cascata da §1 é a mesma patologia em escala menor: `V-CTR-01` e `V-CAP-01` são consequência
aritmética de `V-ADT-01`. `R-DOC-07` é a `R-GRD-06` aplicada onde ela ainda não tinha chegado.

### 13.2 ESPEC 017 `R-GRD-07` — o diagnóstico, meio caminho andado

O `DiagnosticoDaGrade` foi criado para que `V-CTR-01` deixasse de dizer apenas *"não localizada"*, e
resolveu o problema **do suporte**. Esta espec faz a outra metade: o mesmo diagnóstico, lido por
quem confere, vira causa e ação — e o texto cru desce para o `▸`, onde o suporte continua a
encontrá-lo.

### 13.3 ESPEC 019 `D-05` — o filtro que já sabia a resposta

`_geometrias_de_itens` foi criada para não confundir cronograma com tabela de itens. É ela que, no
`modelo.pdf`, rejeita as três geometrias — e é o seu resultado, hoje descartado, que sustenta o
degrau 3 da `R-DOC-03`. A informação existia desde a ESPEC 019; faltava contá-la.

### 13.4 ESPEC 023 — o precedente direto

*"O aviso que diz o que fazer"* fez, para a `V-REC-01`, exatamente o que esta espec faz para a
`V-ADT-01`: partiu um achado ambíguo em dois casos com ações diferentes, e trocou a descrição do
mecanismo por um diagnóstico. Esta é a mesma operação, um andar acima — lá o relatório saía e a
frase estava vaga; aqui o relatório não sai e a frase está em vocabulário de máquina.
