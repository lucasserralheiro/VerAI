# ESPEC 034 — O órgão que vem antes da frase

| | |
|---|---|
| **Status** | **Implementada** — 2026-08-27. Backend **1.458 → 1.482 passed**, zero falhas. As duas peças que não derivavam o órgão passam a derivar — `contrato_smul.pdf` e `aditivo_pgm_2.pdf` —, e a capa do par SMUL traz `SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO`. Os quatorze campos de capa do piloto e do PGM **intactos**; nenhum artefato reancorado |
| **Versão** | 1.0 — 2026-08-27 |
| **Depende de** | [ESPEC 020](020-capa-do-documento.md) — a capa e a cascata de `R-CAP-10`, implementada. É a `R-CAP-04` dela que esta espec substitui |
| **Revisa** | [ESPEC 020](020-capa-do-documento.md) `R-CAP-04` e a `_PROPOSTA` da [ESPEC 025](025-o-arquivo-que-nao-e-a-proposta.md). As duas foram calibradas sobre peças que são **aditivos**, e a redação de aditivo não é a de proposta comercial (§2.3) |
| **Não toca** | A cascata de `R-CAP-10`, que continua sendo a rede de segurança. Nenhum item, quantidade, preço ou total. A leitura da aba `Levantamento`, a grade da ESPEC 033 e a consolidação de aditivos |
| **Referência normativa** | `contrato_smul.pdf` e `PA-PGM-260818-201` (as duas que falham) · `contrato.pdf`, `contrato_pgm.pdf`, `aditivo_pgm.pdf`, `aditivo_smul.pdf`, `modelo.pdf` (a não-regressão) |
| **Origem** | Aviso observado ao gerar o par SMUL, registrado na ESPEC 033 §8.4: *"o nome do órgão não foi derivado da proposta — a capa identificará o cliente pelo título do levantamento"* |

---

## 1. Problema

A capa do relatório do par SMUL identifica o cliente como **`SMUL`**, e não como
`SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO`.

Não é defeito de renderização: é a cascata de `R-CAP-10` funcionando. A derivação do órgão falhou,
`V-CAP-01` avisou, e a capa caiu para o miolo do título da aba — medido:

```python
Report.cliente = ''                    →  cliente_da_capa = 'SMUL'
```

**O aviso está certo ao disparar**, e a saída é segura: nunca põe o nome de outro órgão. O que está
errado é a derivação ter falhado num documento que **diz o nome do órgão na primeira página, por
extenso**.

E o defeito não é do SMUL: entre as sete peças reais disponíveis, **duas** falham hoje (§2.1).

## 2. O que foi levantado no código

Tudo nesta seção foi medido nas peças reais, com o extrator de produção.

### 2.1 Cinco redações de capa, e a regra reconhece uma

`_CLIENTE` ([pdfplumber_extractor.py:70](../../backend/src/infrastructure/contract/pdfplumber_extractor.py#L70)):

```python
_CLIENTE = re.compile(r"presta[çc][ãa]o de servi[çc]os para a?o?s?\s+(.+?)\s*\.", re.I)
```

Exige `prestação de serviços para` **seguido do órgão**. Medido nas sete peças:

| peça | como a capa nomeia o órgão | deriva hoje? |
|---|---|---|
| `contrato.pdf` (`PA-SMIT-260319-739`) | …na **prestação de serviços para a** Secretaria Municipal de Inovação e Tecnologia**- SMIT**. | ✅ |
| `contrato_pgm.pdf` (`PA-PGM-251015-159`) | …na **prestação de serviços para a** Procuradoria Geral do Município de São Paulo **- PGM** | ✅ |
| `PA-PGM-260818-201` | …na prestação de serviços **de sustentação de TIC** para a Procuradoria Geral do Município de São Paulo | ❌ |
| `contrato_smul.pdf` (`PC-SMUL-240916-136`) | …**entre a** Secretaria Municipal de Urbanismo e Licenciamento **- SMUL** e a Empresa … (PRODAM) **para a Prestação de Serviços de** "Sustentação de Infraestrutura de TIC". | ❌ |
| `aditivo_smul.pdf` (`PA-SMUL-250314-22`) | …até o seu vencimento 31/10/2025 **à** Secretaria Municipal de Urbanismo e Licenciamento **- SMUL**. | ❌ (indiferente) |
| `aditivo_pgm.pdf` (`PA-PGM-260304-715`) | *não nomeia órgão nenhum na página 1* | — |
| `modelo.pdf` | *não é proposta* | — |

Três falhas, e **as três por razões diferentes**:

- **`PA-PGM-260818-201`** — a frase existe, mas com o objeto no meio: `serviços de sustentação de
  TIC para a`. O padrão exige `serviços para` colados;
- **`contrato_smul.pdf`** — a frase existe, mas **invertida**: o órgão vem antes, introduzido por
  `entre a`, e depois de `para a Prestação de Serviços` vem **`de <objeto>`**, não o órgão;
- **`aditivo_smul.pdf`** — a frase não existe; o órgão é o destinatário, regido por `à`.

### 2.2 A inversão do SMUL não é erro de redação — é outro tipo de documento

```
O objetivo deste documento é constituir uma proposta técnica comercial para 12 (doze) meses,
a partir de 01/11/24, entre a Secretaria Municipal de Urbanismo e Licenciamento - SMUL e a
Empresa Tecnologia da Informação e Comunicação do Município de São Paulo (PRODAM) para a
Prestação de Serviços de "Sustentação de Infraestrutura de TIC".
```

Um aditivo **refere-se** a um contrato que existe, e por isso nomeia o órgão como destinatário do
serviço. Uma proposta comercial inicial **constitui** o contrato, e por isso nomeia as **duas
partes**. A gramática segue a natureza da peça.

### 2.3 As duas peças que calibraram a regra são aditivos

É o achado estrutural desta espec, e explica por que a regra nasceu estreita:

```
_proposta()   contrato.pdf      → 'PA-SMIT-260319-739'   "apresentar a Proposta de Aditivo Contratual…"
              contrato_pgm.pdf  → 'PA-PGM-251015-159'    "apresentar a Proposta de Aditivo Contratual…"
              contrato_smul.pdf → ''                     "constituir uma proposta técnica comercial…"
```

A ESPEC 020 §2.4 mediu a frase em **duas peças do mesmo tipo** — e o tipo não é o que o nome do
arquivo sugere. `contrato.pdf` e `contrato_pgm.pdf` são propostas de **aditivo**, submetidas no
campo de contrato porque é a peça que traz o escopo resultante (ESPEC 019 `D-03`).

O `PC-SMUL-240916-136` é a **primeira proposta comercial inicial** a entrar naquele campo em toda a
história do repositório. A `R-CAP-04` nunca viu uma.

### 2.4 O alargamento óbvio é o perigoso, e foi medido

A leitura natural de §2.2 é *"o órgão vem depois de `entre a`"*. Aplicada:

```
entre a?o?s?\s+(.+?)\s*\.   →   'Secretaria Municipal de Urbanismo e Licenciamento - SMUL
                                 e a Empresa Tecnologia da Informação e Comunicação do
                                 Município de São Paulo (PRODAM) para a Prestação de
                                 Serviços de "Sustentação de Infraestrutura de TIC"'
```

**Poria a contratada dentro do nome do cliente**, na capa de um documento que vai ao órgão. É pior
que o aviso de hoje, e é a mesma armadilha que a ESPEC 032 §2.3 mediu na cauda de descrição: a
correção ingênua troca *degradado* por *errado*.

A causa da armadilha é o terminador. O `\s*\.` de hoje funciona porque **no aditivo o órgão fecha a
frase**; no SMUL ele não fecha — tem mais meia frase depois.

### 2.5 A âncora que funciona: o sintagma institucional, cortado na sigla

Em **todas** as peças que nomeiam o órgão, ele é um sintagma que começa por uma palavra
institucional e termina na sigla — `- SMIT`, `- PGM`, `- SMUL`. A sigla já é fato conhecido do
código: `_SIGLA` existe desde a ESPEC 020 para removê-la.

A regra passa a ser *"ache o sintagma institucional e corte na sigla"*, em vez de *"capture depois
da frase até o ponto"*. Medido, sem uma linha de produção alterada:

| peça | esperado | derivado pela âncora |
|---|---|---|
| `contrato.pdf` | `SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA` | **igual** (2 ocorrências, 1 nome) |
| `contrato_pgm.pdf` | `PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO` | **igual** |
| `PA-PGM-260818-201` | `PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO` | **igual** ← hoje falha |
| `contrato_smul.pdf` | `SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO` | **igual** ← hoje falha |
| `aditivo_smul.pdf` | `SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO` | **igual** |
| `aditivo_pgm.pdf` | *(nenhum)* | **vazio** |
| `modelo.pdf` | *(nenhum)* | **vazio** |

**7 de 7.** E o `(PRODAM)` do SMUL **não** é capturado: o sintagma dele começa em `Empresa`, que não
está no vocabulário — a contratada fica de fora por construção, e não por corte de string.

### 2.6 O segundo sintoma: o identificador vazio

A mensagem do aviso sai com um buraco no meio:

```
o nome do órgão não foi derivado da proposta  — a capa identificará o cliente pelo título…
                                            ↑ vazio
```

`_PROPOSTA` ([linha 41](../../backend/src/infrastructure/contract/pdfplumber_extractor.py#L41)) só
casa `Proposta de Aditivo:`, e a `PC-SMUL` declara `Proposta Comercial: PC-SMUL-240916-136`. É a
mesma premissa de §2.3, em outro campo — e a ESPEC 025 **já sabia disso**: criou `_DECLARA_PROPOSTA`
justamente porque *"uma proposta comercial inicial não traz `Proposta de Aditivo:` em lugar
nenhum"*. Só que alargou o **detector**, e não o **extrator do identificador**.

O alargamento candidato, medido nas sete peças:

```python
r"Proposta (?:Comercial|de(?: \d+[ºo°])? Aditivo):\s*([A-Z]{2}-[A-Z]+-[\d-]+)"
```

| peça | hoje | com o alargamento |
|---|---|---|
| `contrato_smul.pdf` | `''` | **`PC-SMUL-240916-136`** |
| as outras seis | inalteradas | inalteradas |

**Exige os dois-pontos, e é o que o mantém seguro:** o cabeçalho institucional traz
`Proposta Comercial PRODAM/DRM/GRC-3/NRC3 Nº 668`, sem dois-pontos e sem código no formato.

### 2.7 O que muda na capa, e o que não muda

| campo | hoje (par SMUL) | com esta espec |
|---|---|---|
| `cliente_da_capa` | `SMUL` | `SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO` |
| `proposta_origem` | `''` | `PC-SMUL-240916-136` |
| `propostas` | `('PA-SMUL-250314-22',)` | `('PC-SMUL-240916-136', 'PA-SMUL-250314-22')` |
| `V-CAP-01` | dispara | **cala** |

**Nos pares do piloto e do PGM, nada muda** — os quatro campos já derivam hoje, e a §2.5 e a §2.6
medem que continuam saindo iguais.

## 3. Objetivo

Que a capa nomeie o órgão sempre que a primeira página o nomear — nas quatro redações medidas —, e
que a peça seja identificada pelo código que ela declara, seja aditivo ou proposta comercial.

**Não é objetivo:** adivinhar o órgão onde ele não está escrito; nomear a contratada; nem remover a
cascata de `R-CAP-10`, que continua sendo a saída segura.

## 4. Escopo

### 4.1 Dentro do escopo

- A derivação do órgão na primeira página, pelas quatro redações medidas.
- O identificador da peça, quando ela se declara `Proposta Comercial:`.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| A cascata de `R-CAP-10` | É a rede de segurança, e esta espec **aumenta** o número de casos em que ela não é necessária. Removê-la seria trocar degradação por vazio |
| `V-CAP-01` | Continua existindo e continua avisando. Muda **quando** dispara, não o que faz |
| Órgão fora do vocabulário | `D-04` — degrada para `R-CAP-10`, como hoje. Nunca nome errado |
| A sigla como nome curto na capa | A capa quer o nome por extenso; a sigla já chega pelo subtítulo |
| A redação da aba `Levantamento` | Outra fonte, outra regra (`R-CAP-05`) |

## 5. Regras

| ID | Regra |
|---|---|
| `R-CAP-11` | O órgão é derivado do **sintagma institucional** da primeira página: uma palavra do vocabulário de órgão (`Secretaria`, `Procuradoria`, …) seguida do nome e **terminada pela sigla** que o acompanha |
| `R-CAP-12` | O sintagma **não atravessa** ponto nem ponto-e-vírgula, e tem no máximo 90 caracteres entre a palavra institucional e a sigla. É o que impede o nome de comer a meia frase que vem depois no `PC-SMUL` (`§2.4`) |
| `R-CAP-13` | **Havendo mais de um órgão distinto na página, não deriva nenhum.** Cai para `R-CAP-10` e `V-CAP-01` avisa. A ambiguidade é caso de aviso, nunca de escolha |
| `R-CAP-14` | O nome sai **sem a sigla** e em caixa alta, como hoje — `_SIGLA` continua sendo quem a remove, e continua sendo por padrão e não por separador fixo (`- SMIT` sem espaço, ` - PGM` com) |
| `R-CAP-15` | **Invariante afirmado por extenso:** os nomes derivados das sete peças são os da tabela do `§2.5`, e os dois documentos que não nomeiam órgão continuam devolvendo vazio |
| `R-DOC-11` | O identificador da peça é o código que ela **declara**, em `Proposta Comercial:` ou `Proposta de Aditivo:`, com os dois-pontos obrigatórios (`§2.6`) |

### 5.1 Validações

**Nenhuma validação nova.** `V-CAP-01` fica como está — muda apenas o conjunto de documentos que a
fazem disparar, que passa de dois para zero entre as peças conhecidas.

**E ela não deve ser removida**, mesmo deixando de disparar: é ela que avisa quando um órgão novo
não está no vocabulário (`D-04`), e esse é exatamente o dia em que alguém precisa saber.

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **A âncora é o sintagma, não a frase que o introduz** | Medido: as quatro redações introduzem o órgão de quatro maneiras — `para a`, `de <objeto> para a`, `entre a`, `à`. Enumerar preposições é perseguir uma lista que não fecha; o sintagma é o mesmo nas quatro |
| `D-02` | **O terminador é a sigla, não o ponto** | O `\s*\.` de hoje só funciona porque no aditivo o órgão fecha a frase. No `PC-SMUL` ele não fecha, e capturar até o ponto traz a PRODAM junto (`§2.4`) |
| `D-03` | **Ambiguidade não escolhe** (`R-CAP-13`) | Duas ocorrências do **mesmo** nome são normais — o piloto tem duas. Dois nomes **distintos** significam que a página fala de mais de um órgão, e aí a regra não sabe qual é o cliente. `R-CAP-10` sabe menos e erra menos |
| `D-04` | **O vocabulário é uma lista fechada, e isso é limitação declarada** | Só `Secretaria` e `Procuradoria` são exercidas por documento real. As outras entram por antecipação, e um órgão fora da lista **degrada para o comportamento de hoje** — `V-CAP-01` avisa e a capa usa o subtítulo. O custo do vocabulário incompleto é o de hoje; o de um vocabulário aberto seria nome errado |
| `D-05` | **`R-DOC-11` exige os dois-pontos** | Sem eles, o cabeçalho `Proposta Comercial PRODAM/DRM/GRC-3/NRC3 Nº 668` entraria na busca. Medido: com os dois-pontos, seis das sete peças saem idênticas |
| `D-06` | **As duas correções entram na mesma espec** | Têm a mesma causa — regras calibradas sobre aditivos — e o mesmo documento as expõe. Separá-las faria a segunda parecer arbitrária |
| `D-07` | **A cascata fica** | Esta espec reduz a frequência da degradação; não a elimina. Um PDF digitalizado, um órgão novo ou uma capa reescrita voltam a cair nela |

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `infrastructure/contract/pdfplumber_extractor.py` | `_CLIENTE` passa a ser o sintagma institucional (`R-CAP-11` a `R-CAP-13`); `_PROPOSTA` aceita `Proposta Comercial:` (`R-DOC-11`). `_cliente()` ganha a regra da ambiguidade |
| `domain/`, `application/`, `api/`, `frontend/` | **Nenhuma.** `Contract.cliente` e `Contract.proposta` já são os campos; muda o que chega neles |
| `infrastructure/validations/` | **Nenhuma.** `V-CAP-01` não muda de forma |

## 8. Testes e critério de aceite

### 8.1 As regras

| Regra | Verificação |
|---|---|
| `R-CAP-11` · `R-CAP-14` | Os cinco nomes do `§2.5` por extenso, um teste por peça |
| `R-CAP-12` | **O teste que pega o alargamento ingênuo:** o nome derivado do `PC-SMUL` **não contém** `PRODAM` nem `Prestação` |
| `R-CAP-13` | Caso construído, sem PDF: duas ocorrências do mesmo nome derivam; dois nomes distintos devolvem vazio |
| `R-CAP-15` | Invariante por extenso, com os dois vazios afirmados |
| `R-DOC-11` | `PC-SMUL-240916-136` sai do `contrato_smul.pdf`; as outras seis peças inalteradas; e o cabeçalho `Proposta Comercial PRODAM/DRM/…` **não** é capturado |

### 8.2 Regressão

O inventário de âncoras foi levantado antes desta espec, nas duas suítes:

| Âncora | Efeito previsto |
|---|---|
| `test_capa.py:373` — cliente do piloto e do PGM | **inalterado** (`§2.5`) |
| `test_capa.py:380` — `aditivo_pgm.cliente == ""` | **inalterado**: a página 1 dele não nomeia órgão |
| `test_capa.py:481` e `test_t1425_…_nao_dispara_nos_dois_pares` | **inalterados**: `V-CAP-01` não muda de forma |
| `test_grade_contrato`, `test_extractor_aditivo`, `test_extractor_contrato_pgm` — identificadores | **inalterados** (`§2.6`) |
| `.docx` e `.xlsx` do piloto e do PGM, `CORPO_DO_PILOTO_*`, `linhas_do_documento.json` | **inalterados** — nenhum campo de capa daqueles dois pares se move |
| `frontend/e2e/documento.spec.ts`, `estados.ts` | a confirmar na execução; os estados são montados sobre o piloto, que não se move |

**Como na ESPEC 033, o delta sobre artefato é zero** — mas por outra razão: aqui a mudança só
alcança documentos cuja derivação **falha** hoje, e nenhum deles tem artefato ancorado.

### 8.3 O delta esperado

**Muda:** os quatro campos de capa do par SMUL (`§2.7`) e o silêncio de `V-CAP-01` nele.

**Não muda:** nada do piloto, nada do PGM, nenhum item, nenhuma contagem, nenhum `sha` de extração —
esta espec não toca a grade.

**Critério de aceite:** qualquer campo de capa do piloto ou do PGM que se mova reprova a entrega.
Qualquer nome derivado que contenha `PRODAM` reprova a entrega.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Pôr a contratada no nome do cliente | `R-CAP-12` e o teste de `§8.1` que proíbe `PRODAM` no nome. É o defeito que o alargamento ingênuo causaria, medido em `§2.4` |
| Escolher o órgão errado numa página que cite dois | `R-CAP-13` não escolhe: cai para `R-CAP-10`, que é o comportamento de hoje |
| Vocabulário incompleto envelhecer em silêncio | `D-04`, e `V-CAP-01` é justamente o alarme. A degradação é a de hoje, e é visível |
| `R-DOC-11` capturar o cabeçalho institucional | `D-05` — os dois-pontos são obrigatórios, e a medição de `§2.6` mostra seis de sete inalteradas |
| O `propostas` do rodapé crescer e mudar o `.docx` de alguém | Só cresce onde hoje está vazio — o par SMUL, que não tem artefato ancorado (`§8.2`) |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | O vocabulário cobre `Secretaria` e `Procuradoria` com documento real; as outras sete palavras entram por antecipação. Quais órgãos a PRODAM atende que não começam por nenhuma delas? | Não. Sem a palavra, `V-CAP-01` avisa e a capa usa o subtítulo — o comportamento de hoje |
| `I-02` | Existe capa em que o órgão apareça **sem** sigla? Aí `R-CAP-11` não fecha o sintagma | Não. Nenhuma das sete; e o resultado seria o de hoje |
| `I-03` | O `aditivo_smul.pdf` passa a derivar o órgão, e hoje não deriva. Nada consome o `cliente` de um aditivo (`aplicar` usa o da proposta) — vale afirmar isso como invariante? | Não bloqueia. Vale um teste, e ele é barato |

## 11. Relação com as ESPECs 020 e 025

**Com a ESPEC 020**, esta é a segunda metade de `R-CAP-04`. Aquela espec descobriu que *"o que
parecia dado editorial é derivável"* e mediu a frase em dois documentos. Os dois eram aditivos, e a
regra ficou com a gramática de aditivo. A cascata de `R-CAP-10` — escrita na mesma espec — é o que
fez a limitação custar um aviso, e não um erro.

**Com a ESPEC 025**, é a mesma premissa em outro campo. Aquela espec **enunciou** que uma proposta
comercial inicial não traz `Proposta de Aditivo:` e criou `_DECLARA_PROPOSTA` por causa disso — mas
deixou `_PROPOSTA` como estava. `R-DOC-11` fecha a metade que ficou.

É o padrão que a ESPEC 033 §11 já havia registrado: uma correção resolve o lado que a amostra
mostra, e o lado restante espera o documento que o exiba.

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Inventário de âncoras nas duas suítes e a régua de capa dos dois pares que não podem mudar | PP |
| B | Testes escritos antes: os cinco nomes por extenso, os dois vazios, a proibição de `PRODAM` e a ambiguidade | P |
| C | `_CLIENTE` e a regra de ambiguidade | PP |
| D | `R-DOC-11` | PP |
| E | Suítes e conferência de que nenhum campo de capa do piloto ou do PGM se moveu | PP |

**Estimativa: meio dia.** A âncora já está medida; o trabalho está em A, B e E.
