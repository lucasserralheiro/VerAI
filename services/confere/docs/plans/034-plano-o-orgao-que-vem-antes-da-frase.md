# PLANO 034 — Implementação de "O órgão que vem antes da frase"

| | |
|---|---|
| **Especificação** | [ESPEC 034](../specs/034-o-orgao-que-vem-antes-da-frase.md) v1.0 |
| **Versão** | 1.0 — 2026-08-27 — **executado** em 2026-08-27. A emenda está no §9 |
| **Backlog** | TASKS 034, a escrever. Numeração continua de `T-2222`, a última da ESPEC 033 |
| **Estado inicial** | **A árvore NÃO está limpa.** Ela carrega a ESPEC 033 inteira — 15 arquivos, **não commitados**: a leitura da grade por faixa, a normalização do sinal, duas fixtures, dois módulos de teste, um script e quatro documentos. Backend nesta árvore: **1.458 passed**, zero falhas. Navegador: **119 passed, 1 failed**, com o vermelho pré-existente do `I-06` do TASKS 033 |
| **Colisão conhecida** | **Real, e no mesmo arquivo.** A ESPEC 033 alterou `pdfplumber_extractor.py` no laço de extração; esta altera `_CLIENTE` e `_PROPOSTA`, no topo do mesmo arquivo. Funções diferentes, sem conflito semântico — mas o `git diff` daquele arquivo passa a misturar duas entregas. **Ver §7** |
| **Instrumento existente** | A âncora foi medida antes da espec: acerta **7 de 7** peças (ESPEC §2.5), e o alargamento do identificador muda **1 de 7** (§2.6). A régua de capa dos dois pares está congelada no §3, `T-4`. `V-CAP-01` é o oráculo: ele diz, sozinho, se a derivação passou a funcionar |

---

## 1. O que este plano tem de diferente dos anteriores

> **A linha de base é ESTA árvore, e não o `HEAD` — pela primeira vez desde o PLANO 032.**
> A ESPEC 033 está inteira aqui e não foi commitada. Medir "antes" contra `git show HEAD:` mediria
> um mundo onde o aditivo do SMUL nem sequer extrai. É a regra 4 do TASKS 032, e ela custou uma
> medição falsa naquela entrega.

> **A recomendação, dita de frente: commitar a ESPEC 033 antes de começar esta.**
> As duas tocam `pdfplumber_extractor.py`. Não brigam — uma mexe no laço de extração, a outra em
> dois padrões do topo —, mas empilhá-las no mesmo diff faz o revisor conferir duas entregas de uma
> vez, e faz um eventual `revert` levar a errada junto. Não é bloqueio; é higiene, e o custo de
> ignorá-la aparece só depois.

> **O risco aqui não é mover um número. É pôr o nome errado na capa.**
> Nenhum item, quantidade ou total é tocado — a régua de `sha` da 033 é invariante trivial nesta
> entrega. O que está em jogo é o campo mais visível do documento que vai ao órgão. E o modo de
> falha tem nome e foi medido: o alargamento ingênuo põe **`PRODAM` dentro do nome do cliente**
> (ESPEC §2.4).

> **A ordem das duas correções é, de novo, um instrumento.**
> `R-DOC-11` (o identificador) vem **primeiro**. Feito só ele, o `V-CAP-01` **continua disparando** —
> e passa a nomear a peça: *"não foi derivado da proposta **PC-SMUL-240916-136**"*. Isso é um portão
> observável: prova que o identificador foi corrigido **antes** de o aviso desaparecer. Fizesse a
> ordem inversa, o aviso sumiria e a correção do identificador ficaria sem testemunha.

> **`V-CAP-01` deixa de disparar e NÃO deve ser removida.**
> É a tentação natural de quem fecha esta entrega: *"não dispara mais em documento nenhum, para que
> serve?"*. Serve para o dia em que aparecer um órgão fora do vocabulário — e a `D-04` da espec
> declara que esse dia vem. Guarda de anomalia que não se paga em ruído, no precedente da `V-MED-04`
> e da `V-CTR-06`.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Inventário, régua de capa congelada, testes reprovando pelo motivo certo** | Fim da `F1` | As **cinco** buscas do §8 executadas nas duas suítes. A régua do `T-4` reproduzida nesta árvore. Os testes novos reprovam: os de nome, com o nome **vazio** na mensagem; o de `PRODAM`, **passando já** | Inventário deduzido é o defeito que o projeto cometeu quatro vezes. E teste que reprova por `ImportError` onde devia reprovar por valor não é régua |
| **P1 — O identificador, com o aviso ainda de pé** | Fim da `F2` | `contrato_smul.pdf` devolve `PC-SMUL-240916-136`; as outras **seis** peças inalteradas. `V-CAP-01` **continua disparando** no par SMUL, agora nomeando a peça. Capa do piloto e do PGM idêntica à `T-4` | Reverter a `F2`. Identificador que mude em qualquer das seis outras peças é regressão, não melhoria |
| **P2 — O órgão, e a capa dos dois pares intacta** | Fim da `F3` | Os cinco nomes da ESPEC §2.5 por extenso; vazio no `aditivo_pgm` e no `modelo`; **nenhum nome contém `PRODAM`**; ambiguidade devolve vazio. `V-CAP-01` **cala** no par SMUL. Os sete campos de capa da `T-4` idênticos nos dois pares | Reverter a `F3`. Um nome errado na capa é pior que o aviso que esta espec existe para calar |
| **P3 — As duas suítes e as estáticas** | Fim da `F4` | Backend verde, **≥ 1.458**. Navegador **sem falha nova** sobre a linha de base — que já entra com o vermelho do `I-06`. `ruff` e `mypy` limpos. **Nenhum artefato reancorado** | Não entregar |

---

## 3. Fases

### F0 — Linha de base, régua e inventário `[portão]`

**Objetivo:** congelar o que não pode mudar, **nesta árvore**, antes de escrever código.

| # | Tarefa | Ref. |
|---|---|---|
| T-1 | Executar as **cinco** buscas do §8, nas duas suítes. O resultado manda na tabela da ESPEC §8.2 | §8 |
| T-2 | Linha de base do backend nesta árvore — esperado `1.458 passed` — e a lista de falhas do navegador, para separar herdado de novo | **P3** |
| T-3 | Decidir o vocabulário de `R-CAP-11` com quem conhece a carteira de clientes (`I-01`). **Não bloqueia**: palavra ausente degrada para o comportamento de hoje | ESPEC `I-01` |
| T-4 | **Congelar a régua de capa.** Medida nesta árvore, e é o "antes" desta entrega | **P1**, **P2** |
| T-5 | Canário barato: `scripts/medir_extracao.py`, os sete `sha` da ESPEC 033. Esta entrega não toca a grade, e é isso que a régua da 033 vai afirmar de graça | **P3** |

**A régua da `T-4`, medida em 2026-08-27:**

```
extração          cliente                                        proposta
  contrato.pdf      SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA  PA-SMIT-260319-739
  contrato_pgm.pdf  PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO   PA-PGM-251015-159
  aditivo_pgm.pdf   ''                                             PA-PGM-260304-715
  contrato_smul.pdf ''                                             ''
  aditivo_smul.pdf  ''                                             PA-SMUL-250314-22
  modelo.pdf        ''                                             ''
  PA-PGM-260818-201 ''                                             PA-PGM-260818-201

capa · piloto                                    capa · pgm
  cliente_da_capa   SECRETARIA MUNICIPAL DE …      PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO
  proposta_origem   PA-SMIT-260319-739             PA-PGM-251015-159 e PA-PGM-260304-715
  propostas         ('PA-SMIT-260319-739',)        ('PA-PGM-251015-159', 'PA-PGM-260304-715')
  contrato_ref      TC 52/SMIT/2024                TC 015/PGM/2024
  subtitulo_da_capa SMIT SUSTENTAÇÃO               PGM TC 015
```

**Verificação:** `P0` (primeira metade).

> **As duas linhas que a entrega vai mudar estão nessa tabela, e são as únicas:** `contrato_smul.pdf`
> ganha nome e identificador. Tudo o mais tem de sair idêntico — inclusive os dois `''` do
> `aditivo_pgm` e do `modelo`, que são **resultado**, e não ausência de medição.

**Tamanho:** PP — quarenta minutos, mais o tempo das suítes.

---

### F1 — Os testes, escritos antes `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-6 | Os cinco nomes da ESPEC §2.5, por extenso, um caso por peça — inclusive o `PA-PGM-260818-201`, que hoje falha e **não é do SMUL** | `R-CAP-11`, `R-CAP-14` |
| T-7 | Os dois vazios: `aditivo_pgm.pdf` e `modelo.pdf`. São o que impede a regra de "achar órgão" onde não há | `R-CAP-15` |
| T-8 | **O teste que pega o alargamento ingênuo:** o nome derivado do `PC-SMUL` **não contém** `PRODAM`, `Empresa` nem `Prestação`. Passa já — hoje o nome é vazio —, e é o único que reprova quem capturar até o ponto | `R-CAP-12`, ESPEC §2.4 |
| T-9 | Ambiguidade, em caso construído: duas ocorrências do **mesmo** nome derivam; dois nomes **distintos** devolvem vazio | `R-CAP-13` |
| T-10 | `R-DOC-11`: `PC-SMUL-240916-136` sai do `contrato_smul`; as seis outras inalteradas; e o cabeçalho `Proposta Comercial PRODAM/DRM/GRC-3/NRC3 Nº 668` **não** é capturado | `R-DOC-11`, `D-05` |
| T-11 | A régua de capa da `T-4` como asserção, nos dois pares | `R-CAP-15`, **P2** |
| T-12 | **[portão]** Rodar contra esta árvore: os de nome reprovam com **`''`** no lugar do nome; `T-8` e `T-11` **passam já**; `T-10` reprova só no `contrato_smul` | **P0** |

**Verificação:** `P0`.

> **`T-8` passa antes e depois, e é assim que ele funciona.** Hoje o nome do `PC-SMUL` é vazio, e
> vazio não contém `PRODAM`. Depois, o nome é o órgão, e também não contém. Quem escrever a versão
> ingênua da regra reprova **só** nele — que é exatamente o serviço que ele presta.

> **`T-6` inclui o `PA-PGM-260818-201`, que não está versionado.** Ou ele entra como fixture, ou o
> caso fica marcado e roda contra o arquivo de teste do órgão. **Decidir na `F0`** — é a única peça
> desta espec cuja disponibilidade não está resolvida.

**Tamanho:** P — uma hora e meia.

---

### F2 — O identificador, com o aviso ainda de pé `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-13 | `_PROPOSTA` passa a aceitar `Proposta Comercial:` além de `Proposta de Aditivo:`, com **dois-pontos obrigatórios** | `R-DOC-11`, `D-05` |
| T-14 | **[portão]** As seis peças inalteradas; o `contrato_smul` devolve `PC-SMUL-240916-136` | **P1** |
| T-15 | **[portão]** `V-CAP-01` **continua disparando** no par SMUL, e a mensagem passa a nomear a peça | **P1** |
| T-16 | **[portão]** Os sete campos de capa da `T-4`, nos dois pares, idênticos | **P1** |

**Verificação:** `P1`.

> **O `propostas` do par SMUL cresce nesta fase** — de `('PA-SMUL-250314-22',)` para
> `('PC-SMUL-240916-136', 'PA-SMUL-250314-22')` —, e com ele o `proposta_origem` e o rodapé de
> `R-ADT-11`. É mudança **esperada e desejada**: o rodapé passa a nomear as duas peças que formam o
> quantitativo, que é o que a regra sempre mandou. O par SMUL não tem artefato ancorado.

> **`V-ADT-03` ganha um caso de graça:** a proposta passa a ter identificador, então submetê-la duas
> vezes passa a ser detectado. Nenhum documento real o exercita; vale registrar, não vale teste
> novo — a validação já é coberta.

**Tamanho:** PP — vinte minutos.

---

### F3 — O órgão `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-17 | `_CLIENTE` passa a ser o sintagma institucional terminado na sigla; `_cliente()` ganha a regra de ambiguidade de `R-CAP-13` | `R-CAP-11` a `R-CAP-14` |
| T-18 | **[portão]** Os cinco nomes e os dois vazios; nenhum contém `PRODAM` | **P2** |
| T-19 | **[portão]** `V-CAP-01` **cala** no par SMUL; a capa dele passa a trazer `SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO` | **P2** |
| T-20 | **[portão]** Os sete campos de capa da `T-4` idênticos nos dois pares, e os sete `sha` da `T-5` idênticos | **P2** |

**Verificação:** `P2`.

> **`_SIGLA` não se mexe.** Ela já resolve a variação medida na ESPEC 020 §2.5 — `Tecnologia- SMIT`
> sem espaço, `Paulo - PGM` com — e continua sendo aplicada por padrão, nunca por separador fixo.
> Reescrevê-la aqui reabriria uma decisão que já tem caso real dos dois lados.

> **O `aditivo_smul.pdf` passa a derivar o órgão, e hoje não deriva.** É efeito colateral, não
> objetivo: nada consome o `cliente` de um aditivo — `Contract.aplicar` usa o da proposta, e a
> `T-1420` da ESPEC 020 existe justamente para isso. Vale um teste barato afirmando que o campo do
> par não muda por causa disso (`I-03`).

**Tamanho:** PP — quarenta minutos.

---

### F4 — O conjunto `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-21 | Suíte de backend completa, número declarado, comparado com a `T-2` | **P3** |
| T-22 | **Suíte de navegador completa.** Comparar contra a lista da `T-2`: falha nova reprova; o vermelho do `I-06` não | **P3** |
| T-23 | **Nenhum artefato reancorado:** `test_capa`, `test_identidade_dos_artefatos`, `test_docx_formatacao`, `pacote.py` e `linhas_do_documento.json` intocados no `git diff` | **P3** |
| T-24 | `ruff` e `mypy` nos arquivos tocados | **P3** |
| T-25 | `README.md`, `docs/CHANGELOG.md`, e o `Status` da ESPEC 034 | — |

**Verificação:** `P3`.

> **O `git diff` desta entrega tem de ser lido junto com o da ESPEC 033 se ela não tiver sido
> commitada** (§7). É o que a `T-23` precisa distinguir: arquivo que aparece por causa da 033 não é
> reancoragem desta.

**Tamanho:** PP — trinta minutos, mais ~35 de suítes.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3 ──► F4
P0     P0     P1     P2     P3
              │      │
              │      └─ o aviso CALA; capa dos dois pares intacta
              └──────── o aviso AINDA dispara, agora nomeando a peça
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~3h30, mais duas execuções de suíte |

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| Pôr a contratada no nome do cliente | `T-8`. É o defeito que o alargamento por `entre a` causaria, medido na ESPEC §2.4 |
| Escolher o órgão errado numa página que cite dois | `T-9` e `R-CAP-13`: ambiguidade devolve vazio e cai na cascata |
| Mexer em `_SIGLA` "de passagem" | Os dois casos da ESPEC 020 §2.5 já estão na suíte, com separadores diferentes |
| `R-DOC-11` capturar o cabeçalho institucional | `T-10`, que afirma a não-captura por extenso |
| Mover um campo de capa do piloto ou do PGM | `T-11`, e os portões `P1` e `P2` a reexecutam |
| Remover `V-CAP-01` por ela deixar de disparar | §1, e o precedente da `V-MED-04` e da `V-CTR-06` |
| Confundir o diff da 033 com o desta entrega | §7 e `T-23` |
| Confundir vermelho herdado com vermelho novo no navegador | `T-2`; a suíte já entra com o `I-06` |

---

## 6. O que este plano não faz

- **Não remove a cascata de `R-CAP-10`** (`D-07`). Ela fica sendo a saída segura.
- **Não remove `V-CAP-01`**, mesmo deixando de disparar em documento conhecido.
- **Não abre o vocabulário** para um casamento genérico (`D-04`): palavra ausente degrada, nunca erra.
- **Não toca a grade nem a extração de itens.** O `sha` da ESPEC 033 é canário, não alvo.
- **Não resolve o `I-06` do TASKS 033** — a contradição entre `a11y-estrutura.spec.ts:252` e
  `analise.spec.ts:183`, que é de outra entrega.
- **Não trata o `I-04`** — o hook de pré-commit preso ao nome `SMIT`.

---

## 7. A árvore carrega outra entrega, e isso muda três coisas

A ESPEC 033 está aqui, inteira e não commitada. Consequências práticas, e nenhuma é teórica:

1. **A linha de base é esta árvore.** A `T-4` mede aqui. Comparar contra `git show HEAD:` compararia
   com um mundo em que o `aditivo_smul.pdf` nem sequer extrai — e a régua de capa do par SMUL nem
   existiria.
2. **O `git diff` de `pdfplumber_extractor.py` mistura duas entregas.** As mudanças não conflitam —
   a 033 mexeu na linha do laço (`ler_celulas(..., por_faixa=True)`), esta mexe em `_CLIENTE` e
   `_PROPOSTA`, no topo. Mas quem revisar vê as duas de uma vez, e um `revert` da 034 pode levar a
   033 junto se o commit for único.
3. **A recomendação é commitar a 033 primeiro.** Ela está fechada: 30 de 30 tarefas, portões `P0` a
   `P4`, backend `1.458 passed`. Não é bloqueio para começar esta — é o que faz as duas continuarem
   separáveis depois.

É a regra 4 do TASKS 032 outra vez, e a terceira entrega seguida em que ela vale. Vale escrevê-la
como convenção: **antes de medir "antes", perguntar de que árvore o "antes" é.**

---

## 8. O inventário, e as cinco buscas

Sobre `backend/tests/`:

| # | Busca | O que acha | O que já se sabe |
|---|---|---|---|
| 1 | `_cliente`, `cliente_da_capa`, `R-CAP-04` | quem afirma o nome derivado | `test_capa.py:373` (piloto e PGM), `:380` (`aditivo_pgm == ""`), `:421-462` (a cascata) |
| 2 | `V-CAP-01` | quem afirma o aviso | `test_capa.py:481` e `test_t1425_…_nao_dispara_nos_dois_pares`; `test_documento_submetido.py:85` cita em comentário |
| 3 | `_proposta`, `proposta_origem`, `propostas` | quem afirma o identificador | doze módulos, entre eles `test_capa`, `test_consolidacao_aditivos`, `test_extractor_aditivo`, `test_grade_contrato` |
| 4 | `sha256` | as âncoras de pacote e de corpo, que **não** podem se mover | `pacote.py`, `test_capa.py`, `test_docx_formatacao.py`, `test_identidade_dos_artefatos.py` |

Sobre `frontend/e2e/`:

| # | Busca | O que acha | O que já se sabe |
|---|---|---|---|
| 5 | `SECRETARIA`, `PROCURADORIA`, `PA-SMIT`, `PA-PGM`, `propostas` | asserção de tela sobre a capa ou sobre a origem | `documento.spec.ts` e `estados.ts` citam `propostas`; os estados são montados sobre o piloto, que não se move — **e isso é hipótese, não medição** |

**O resultado das cinco manda na tabela da ESPEC §8.2**, e não o contrário.

> **A busca 3 tem doze módulos, e a maioria não é âncora.** A citação de `propostas` costuma ser
> construção de cenário, não asserção. Distinguir uma da outra exige abrir o arquivo — foi o que a
> `T-2168` da ESPEC 032 fez com o `derivadas.spec.ts`, e foi o que evitou um falso positivo. A busca
> sozinha não decide.

---

## 9. Emenda de execução

**2026-08-27.** Executado em ~2h30, contra a estimativa de ~3h30.

**O que o plano acertou.** As cinco fases correram na ordem e os quatro portões fecharam. A régua de
capa congelada na `F0` foi o instrumento certo: verde antes do código, reexecutada em `P1` e `P2`, e
nunca se moveu. E o `P1` — terminar com o `V-CAP-01` **ainda de pé**, nomeando a peça — provou a
primeira correção antes de a segunda a apagar.

**O que o plano não previu.** A `T-2231` foi escrita com um texto que a regra antiga não casava, e
passava sem provar nada. O plano mandava *"reprova contra esta árvore por a regra não existir"* — e
essa expectativa foi o que denunciou o problema, ao não se cumprir. **Escrever no plano o vermelho
esperado de cada teste vale exatamente por isso.**

**O que o plano subestimou de novo.** A `T-2244` era `PP`, *rodar e comparar*, e voltou com duas
falhas. Uma já era conhecida; a outra exigiu execução isolada para se confirmar intermitente. E a
armadilha da porta — que o plano herdou da ESPEC 033 e registrou — **aconteceu outra vez**, agora com
o mecanismo identificado: um worker `multiprocessing` órfão segura o socket depois de o pai morrer, e
a porta responde `200` servindo o código anterior.

Se este plano tivesse uma sexta regra, seria a que a `T-2244` acabou escrevendo: **conferir o log do
servidor, e não a porta.** Porta que responde não prova que responde o seu código.

**O que ficou aberto.** O `I-01` — o vocabulário de órgãos — segue com quem conhece a carteira. A
entrega não esperou por ele porque a `D-04` garante degradação segura, e é o que a `T-2225`
registra.
