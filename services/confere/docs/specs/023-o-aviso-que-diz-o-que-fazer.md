# ESPEC 023 — O aviso que diz o que fazer

| | |
|---|---|
| **Status** | **Implementada com ressalva** — 2026-08-18. Portões `P0` a `P4` e `P6` fechados; **`P5` aberto** — exige duas pessoas do faturamento diante das telas, e é humano. Backend 547 → **556**; navegador 7/7 no spec novo e `axe` 14/14 |
| **Versão** | 1.0 — 2026-08-18 |
| **Depende de** | [ESPEC 008](008-acessibilidade-da-interacao.md), [ESPEC 009](009-analise-da-medicao.md), [ESPEC 021](021-a-celula-que-virou-1-1.md) e [ESPEC 022](022-o-contratado-e-a-proposta-mais-os-aditivos.md) — implementadas |
| **Revisa** | `V-REC-01` como achado de texto. É o `I-25` da ESPEC 022, e segue o precedente da `R-PER-08` |
| **Não toca** | O `.docx`, o `.xlsx` e as regras `R-QTD-01` a `R-QTD-08`. Esta espec muda **o que se vê sobre** uma comparação que já está correta |
| **Referência visual** | [Proposta de tela](https://claude.ai/code/artifact/7f326d40-8de6-4bc6-a1d0-4cfc381d388c) — os três painéis, com o estado de hoje ao lado dos dois propostos |
| **Referência normativa** | `backend/tests/fixtures/contrato_pgm.pdf`, `aditivo_pgm.pdf` e `levantamento_pgm.xlsx` |
| **Origem** | *"Agindo como especialista nas regras de negócio e engenheiro de software sênior além de especialista em ux e ui, como sugere melhorar a apresentação"* |

---

## 1. Problema

A ESPEC 022 mudou o **significado** da `V-REC-01`, e a tela continua exibindo a frase que
descrevia o significado antigo.

Antes dela, o lado esquerdo da comparação era a proposta original, sem os aditivos. A divergência
era ambígua por construção — podia ser peça faltante, podia ser erro de dado — e o sistema não
tinha como distinguir. Daí a mensagem descrever o **mecanismo**, *"quantidade contratada diverge
entre as fontes"*, e não um diagnóstico: não havia diagnóstico a dar.

Agora o lado esquerdo é o contratado **vigente**. Isso parte o aviso em dois casos com causas,
gravidades e ações opostas:

| Situação | Diagnóstico | Ação |
|---|---|---|
| Nenhum aditivo anexado, e há divergência | Provavelmente **falta uma peça** — e o sistema sabe exatamente quanto falta | Anexar o aditivo e gerar de novo |
| Aditivo anexado, e **ainda** diverge | Os números não fecham nem com a peça. Falta outra, ou um dado está errado | Conferir os documentos antes de encaminhar |

**A tela é hoje idêntica nos dois casos.** É informação que a implementação da ESPEC 022 produziu
e que a interface descarta.

Somam-se a isso quatro defeitos de apresentação que a `R-PER-08` já resolveu para a irmã desta
validação, e que aqui permaneceram por não terem sido tocados:

* cinco frases quase idênticas treinam o olho a pular o bloco — a patologia que a `R-REL-13`
  eliminou da `V-CTR-04`;
* os números estão presos dentro de orações, e quem lê tem de fazer a subtração de cabeça, uma
  frase por vez;
* a única informação que vale para todas as linhas — *"O relatório usa a do levantamento"* —
  aparece repetida cinco vezes, no fim de cada frase, que é onde o olho já saiu;
* `V-REC-01` é vocabulário do sistema, e quem lê é quem confere faturamento.

---

## 2. O que foi medido

Execução sobre `feature/evolucao` **depois** da ESPEC 022 implementada.

### 2.1 A tela de hoje, no par do PGM sem aditivo

```
V-REC-01  código 10.050.00001.00: quantidade contratada diverge entre as fontes
          — contrato 42260.00, levantamento 42814.01. O relatório usa a do levantamento
```
…e mais quatro iguais. Cinco frases, 58 palavras repetidas, cinco números úteis.

### 2.2 A diferença aritmética **é** o conteúdo do aditivo

Esta é a medição que decide o desenho da tabela:

| código | na proposta | na planilha | diferença | bloco do aditivo |
|---|---:|---:|---:|---:|
| `14.048.00027.00` | 200,00 | 1.300,00 | **+1.100,00** | `Aumento` 1.100,00 |
| `14.024.00006.00` | 6.100,00 | 9.000,89 | **+2.900,89** | `Aumento` 2.900,89 |
| `10.050.00001.00` | 42.260,00 | 42.814,01 | **+554,01** | `Aumento` 554,01 |
| `14.031.00020.00` | 5,00 | 10,00 | **+5,00** | `Aumento` 5,00 |
| `12.030.00001.00` | 150,00 | 70,00 | **−80,00** | `Redução` −80,00 |

**Correspondência exata, cinco de cinco.** A coluna de diferença não é derivada decorativa: ela é,
número a número, o que está escrito nos blocos `Aumento` e `Redução` da peça que falta. Quem abrir
o PDF do aditivo vai encontrar `554,01` lá.

É o que transforma o aviso de *"algo está diferente"* em *"procure por 554,01 no aditivo"*.

### 2.3 Os dois estados, medidos

Da ESPEC 022 §2.4, com a `V-REC-01` já somando os deltas:

| cenário | avisos | o que a tela mostra hoje |
|---|---:|---|
| sem aditivo | 5 | cinco frases âmbar |
| com aditivo, fontes concordam | 0 | nada |
| com aditivo, aba adulterada em um código | 1 | **uma frase âmbar, igual às outras cinco** |

A terceira linha é o problema desta espec. Aquele aviso único é a situação mais grave que a
validação sabe produzir — os números não fecham nem com a peça aplicada — e chega ao usuário com
a mesma tarja, a mesma cor e a mesma redação do caso rotineiro.

### 2.4 O rótulo *"contrato"* é impreciso, e de um jeito específico

Na frase de hoje, `contrato 42260.00` é a quantidade **da proposta**. Quando nenhum aditivo foi
submetido, é tudo o que o sistema conhece e a palavra é defensável. Quando um aditivo **foi**
submetido e o código ainda diverge, o mesmo campo passa a trazer o consolidado — e a frase não
tem como dizer que a soma foi feita.

O leitor não tem, em nenhum dos dois casos, como saber qual dos dois números está vendo.

### 2.5 O manual afirma o oposto, e desde antes disto

Varredura da `T-1626` sobre `scripts/conteudo_do_manual.py`. Três dos quatro trechos que citam
`V-REC-01` afirmam *"o relatório usa a do contrato"* — falso desde a ESPEC 018 `D-05`, três especs
atrás.

Não é escopo desta espec (`I-22`), e é registrado aqui porque muda o risco: **a única descrição
escrita deste aviso, hoje, ensina o contrário do que ele faz.** Enquanto a tela não se explicar
sozinha, é no documento errado que a pessoa vai procurar.

---

## 3. Objetivo

Que a tela diga **o que aconteceu e o que fazer**, e que distinga o caso rotineiro do caso grave —
sem tocar no que é entregue.

Não-objetivo: mudar a validação, o que ela avalia ou quando dispara. `R-QTD-06` decidiu isso, e a
comparação já está correta.

---

## 4. Escopo

### 4.1 Dentro do escopo

- Um payload estruturado para a divergência de contratado, no lugar da frase;
- Os dois estados na tela, com severidades distintas;
- A ação de anexar aditivo a partir do aviso;
- `V-REC-01` deixa de ser emitida como achado de texto.

### 4.2 Fora do escopo

- O `.docx` e o `.xlsx` — nem uma célula;
- A `R-CTR-01` (`I-26`), que continua revogada;
- A auditoria do manual (`I-22`), que é maior que esta entrega e anterior a ela;
- Validação nova. Nada passa a bloquear que não bloqueava.

---

## 5. Regras

| ID | Regra |
|---|---|
| `R-FON-01` | A divergência de contratado é apresentada em **tabela**, com: código, descrição, unidade, quantidade do contrato, quantidade da planilha e a diferença |
| `R-FON-02` | **Dois estados, com severidades distintas.** Sem aditivo aplicado, a severidade é a de `MAIOR_RELEVANCIA` da ESPEC 009; com aditivo aplicado e divergência remanescente, é a de `CRITICO`. A distinção é do domínio, não da tela |
| `R-FON-03` | O rótulo da coluna do contrato **varia com o estado**: *"Na proposta"* sem aditivo aplicado àquele código, *"Contratado vigente"* com ele |
| `R-FON-04` | Havendo aditivo aplicado, a linha exibe a **decomposição** — proposta mais delta —, que é o que prova que a soma foi feita |
| `R-FON-05` | A coluna de diferença traz o valor **e** a variação percentual. É a coluna que responde *isto é grave?*, e é a única que hoje não existe em lugar nenhum |
| `R-FON-06` | A ordem é por **magnitude relativa decrescente**. Não é a ordem do contrato: quem lê está triando, não percorrendo |
| `R-FON-07` | O estado sem aditivo traz **uma ação** — anexar aditivo —, que devolve o foco ao campo de aditivos do formulário |
| `R-FON-08` | Uma frase precede a tabela, dizendo o que aconteceu e o que fazer, **sem sigla de validação e sem vocabulário do sistema** (`R-PER-07`) |
| `R-FON-09` | `V-REC-01` **deixa de ser emitida como achado**. A informação passa a viajar estruturada (`R-PER-08`) |
| `R-FON-10` | O contador de avisos da faixa de resultado passa a contar o que é exibido (`R-PER-09`). **Revista pela ESPEC 038 `D-03`:** o contador saiu da faixa e virou o cabeçalho do próprio bloco. A regra não foi revogada — foi cumprida. Contar na faixa o que estava quarenta linhas abaixo satisfazia a letra e não a intenção; no cabeçalho, o número e o conteúdo são a mesma coisa vista de perto |
| `R-FON-11` | A seção só existe **quando há divergência**. O caso normal, com o aditivo anexado, é não haver nada — e uma seção permanente treina a pessoa a ignorá-la (`R-PER-10`) |
| `R-FON-12` | No estado com aditivo, o rodapé da tabela declara que **os demais fecharam**. O silêncio precisa ser dito, senão é lido como omissão |
| `R-FON-13` | Nada muda no `.docx` nem no `.xlsx` |
| `R-FON-14` | A tabela obedece à régua da ESPEC 008 §13.4: contêiner rolável focável (`R-ACE-05`), cabeçalhos com `scope`, nada comunicado só por cor (`R-ACE-02`) |

---

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **Os dois estados são distinguidos no backend, não na tela** | Saber se um código teve delta aplicado exige `Contract.blocos` e a lista de aditivos, que a tela não tem e não deve ter. Um `tem_aditivo_aplicado: bool` por linha custa nada e evita que o frontend reconstitua uma decisão de domínio — a mesma razão pela qual `LinhaDoGrid` traz quantidade já formatada |
| `D-02` | **A severidade sai do eixo da ESPEC 009**, e não de uma cor nova | O projeto já tem um eixo de severidade com contraste verificado (`critico`, `maior`, `conforme`). Criar um par de cores para este aviso acrescentaria um segundo vocabulário visual de gravidade à mesma tela |
| `D-03` | **A coluna de diferença é a razão de a tabela existir** | §2.2 — ela é, número a número, o conteúdo do aditivo que falta. Sem ela a tabela é um extrato reformatado; com ela, é um endereço. Se alguma coluna tiver de sair por espaço, não é esta |
| `D-04` | **O rótulo da coluna varia** em vez de um rótulo neutro que sirva aos dois | Um rótulo único teria de ser vago — *"quantidade contratada"* — e é justamente a vagueza que §2.4 aponta como defeito. O leitor precisa saber se está vendo o pré-aditivo ou o consolidado, e a coluna é onde ele olha |
| `D-05` | **A ação devolve o foco ao campo, e não reenvia sozinha** | Reenviar exigiria guardar os arquivos entre duas chamadas, e a aplicação é sem estado (ESPEC 001 §7.2). Devolver o foco é o que o produto já sabe fazer — mesmo mecanismo de `R-ACE-15` — e mantém a decisão com quem confere |
| `D-06` | **`V-REC-01` sai de `avisos`**, em vez de continuar sendo emitida e filtrada na tela | Precedente literal da `R-PER-08`. Filtrar por `validacao === "V-REC-01"` num componente põe identificador de backend dentro de condicional de React, e deixa o mesmo fato na resposta duas vezes, em duas formas, para divergirem depois |
| `D-07` | **O rodapé do estado com aditivo declara o silêncio** | É a entrega da ESPEC 022 tornada visível: *"os outros quatro fecharam e por isso não aparecem"*. Sem essa frase, uma tabela de uma linha parece um relatório incompleto — e o leitor não tem como saber que os outros foram conferidos |
| `D-08` | **A seção fica onde o bloco âmbar está**: depois do grid e das linhas derivadas | Ordem de leitura da ESPEC 009 `R-PAN-01` — gravidade, depois seções, depois ressalvas. Mantém o hábito de quem já usa a tela. **A âncora saiu; a decisão fica** — ESPEC 038 `D-05`: o bloco âmbar subiu para junto da faixa, esta seção **não se moveu**, e passou a ser descrita pelo que é — a última da tela — em vez da vizinha que se mudou |

---

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `domain/entities/report.py` | **Novo** `DivergenciaDeFonte` (frozen): código, descrição, unidade, quantidade do contrato, do aditivo (opcional), da planilha, diferença e variação |
| `application/use_cases/generate_measurement_report.py` | Acumula as divergências no mesmo padrão de `derivadas`. `ReportResult` ganha o campo **por último e com padrão** — o caminho bloqueado retorna antes |
| `infrastructure/validations/reconciliation_validations.py` | `v_rec_01_...` deixa de registrar achado e passa a devolver as divergências, ou é substituída pela acumulação no caso de uso (ver `I-29`) |
| `infrastructure/di/container.py` | A chamada acompanha a mudança de forma |
| `api/schemas.py` · `routers/reports.py` | O schema espelho e a conversão, com as quantidades **formatadas no backend** |
| `frontend/src/lib/types.ts` | O tipo espelho e o campo novo |
| `frontend/src/app/components/DivergenciaDeFonte.tsx` | **Novo.** A tabela e os dois estados, nos moldes de `LinhasDerivadas.tsx` |
| `frontend/src/app/components/ResultadoPanel.tsx` | A seção entra; `ListaDeAchados` **não muda** — deixa de receber `V-REC-01` porque ele não vem mais |
| `frontend/src/app/components/UploadForm.tsx` | Um alvo de foco no campo de aditivos, para `R-FON-07` |
| `infrastructure/report/` | **Nenhuma** (`R-FON-13`) |

---

## 8. Testes e critério de aceite

### 8.1 Backend

| Regra | Verificação |
|---|---|
| `R-FON-01` | PGM sem aditivo: **5** divergências, com os valores de §2.2 |
| `R-FON-02` | Sem aditivo, todas em `MAIOR_RELEVANCIA`. Com aditivo e aba adulterada, a única sai em `CRITICO` |
| `R-FON-04` | Com aditivo, a linha do `14.048.00027.00` traz proposta `200,00` **e** delta `1.100,00` — os dois |
| `R-FON-05` | A diferença do `10.050.00001.00` é `+554,01`, e bate com o bloco `Aumento` da peça |
| `R-FON-06` | A sequência sai `14.048`, `14.031`, `12.030`, `14.024`, `10.050` — magnitude relativa, não ordem de contrato |
| `R-FON-09` | `V-REC-01` **não aparece** em `achados.avisos` em nenhum dos pares. No PGM com aditivo, `avisos == []` |
| `R-FON-13` | `.docx` e `.xlsx` idênticos parte a parte — reaproveita a âncora diferencial da `T-1601` |

### 8.2 Playwright

| Regra | Verificação |
|---|---|
| `R-FON-07` | Clicar na ação move o foco para o campo de aditivos |
| `R-FON-09` | A cadeia `V-REC-01` **não ocorre em lugar nenhum da tela** |
| `R-FON-11` | Com o par completo do PGM, a seção não é renderizada |
| `R-FON-12` | Com a aba adulterada, o rodapé declara que os demais fecharam |
| `R-FON-14` | `axe` sem violações A/AA em 1366 e 390 |

### 8.3 Portões

| ID | Portão | Fecha quando |
|---|---|---|
| `P1` | **A pessoa acha o aditivo** | Alguém do faturamento, sem explicação prévia, recebe a tela do estado A e conclui que precisa anexar o aditivo. É o único portão que mede o objetivo |
| `P2` | **Os dois estados se distinguem** | A mesma pessoa, vendo o estado B, entende que ali é diferente e mais grave. Se não distinguir, a espec entregou uma tabela mais bonita e nada mais |
| `P3` | **O entregável não se mexeu** | `R-FON-13`, pela âncora que já existe |

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| **A tabela virar mais uma tabela**, ignorada como as frases | `R-FON-11` — só existe quando há o que mostrar, e com o aditivo anexado o caso normal é não haver nada |
| **Os dois estados colapsarem em um** na implementação, por parecerem parecidos | `R-FON-02` e o teste de severidade em §8.1. É a decisão da espec inteira; sem ela, sobra reformatação |
| **A coluna de diferença ser cortada** por espaço em telas estreitas | `D-03` a declara insacrificável. A rolagem horizontal do contêiner (`R-ACE-05`) é a saída, e o `DivergenciaGrid` já resolve isso |
| **O percentual do `10.050.00001.00` (+1%) sugerir que é irrelevante** | É pequeno em proporção e são 554 horas. A coluna de valor absoluto vem antes da de percentual, e as duas ficam visíveis |
| **A ação prometer o que não faz** — o usuário clicar esperando reenvio | `D-05`. O rótulo diz *"anexar aditivo e gerar de novo"*, em duas etapas explícitas |
| **Perder `V-REC-01` como rastro** | `D-06` assume, com o precedente da `R-PER-08`. O identificador permanece nas especs; a informação fica mais completa |
| **O manual continuar ensinando o oposto** | Fora do escopo e registrado em §2.5. É risco real e anterior a esta espec — `I-22` |

---

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-29` | A `V-REC-01` deve virar função que **devolve** divergências, ou a acumulação passa ao caso de uso, como fez a `R-PER-08` com a `V-REC-02`? A segunda é o precedente; a primeira preserva a validação como unidade nomeada com teste próprio | Não. Decide-se na implementação; as duas satisfazem as regras |
| `I-30` | A divergência de contratado merece coluna ou aba no XLSX de análise? Ele é o papel de trabalho, e é o que sai da tela para o e-mail | Não. Mesma pergunta que o `I-21` fez das linhas derivadas, e a resposta deveria ser a mesma para as duas |
| `I-31` | Um aviso de estado B deveria **bloquear**? Hoje nada bloqueia por divergência de fonte, e o caso *"não fecha nem com o aditivo"* é o mais próximo de dado errado que o sistema detecta | Não. Mudaria a régua da ESPEC 001 §6 e merece decisão de negócio própria |
| `I-32` | Com dois ou mais aditivos, a decomposição de `R-FON-04` deve nomear **qual peça** trouxe o delta? No PGM há uma só, e a pergunta não aparece | Não. Registrado porque o campo `no_aditivo` nasce sem essa informação, e acrescentá-la depois muda o schema |

---

## 11. Relação com as especs anteriores

### 11.1 ESPEC 021 — o mesmo movimento, na validação irmã

A `R-PER-08` tirou a `V-REC-02` de `avisos` e promoveu a informação a registro estruturado. Esta
espec faz o mesmo com a `V-REC-01`, e por isso as regras se parecem: `R-FON-08` a `R-FON-11` são
as `R-PER-07` a `R-PER-10` aplicadas ao caso vizinho.

A diferença está em `R-FON-02`. A ESPEC 021 tinha um estado só a exibir; aqui são dois, e a
distinção é o conteúdo novo.

### 11.2 ESPEC 022 — a razão de esta espec ser possível agora

Uma tabela com a coluna *"no contrato"* mostrando `200,00` para um item aditivado seria uma
apresentação melhor de um número errado. A ESPEC 022 §12.4 registrou exatamente isso ao explicar
por que **não** seguiu o precedente da 021: consertar o dado antes de decidir como exibi-lo.

Esta é a segunda metade daquele par.

### 11.3 ESPEC 009 `R-PAN-01` — a ordem de leitura, intacta

Gravidade, depois seções, depois ressalvas. A seção entra onde o bloco âmbar está, e o eixo de
severidade que `R-FON-02` usa é o daquela espec, sem cor nova.
