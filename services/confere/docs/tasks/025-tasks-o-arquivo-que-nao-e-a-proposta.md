# TASKS 025 — Backlog de "O arquivo que não é a proposta"

| | |
|---|---|
| **Especificação** | [ESPEC 025](../specs/025-o-arquivo-que-nao-e-a-proposta.md) v1.0 |
| **Plano** | [PLANO 025](../plans/025-plano-o-arquivo-que-nao-e-a-proposta.md) v1.0 |
| **Versão** | 1.0 — 2026-08-18 |
| **Total** | 38 tarefas · 8 portões · **0 insumos** |
| **Status** | **Concluído** — 2026-08-18. Portões `P0` a `P5` e `P7` fechados; **`P6` aberto** — exige alguém do faturamento diante da tela, e é humano. Backend 559 → **578 passed** em 26min36. Navegador: os 6 casos novos verdes. **Quatro desvios**, em §10 |

> **Escrito *antes* da implementação**, como os TASKS 020 a 023 e ao contrário do 024. A §10 —
> *o que a implementação ensinou* — nasce vazia e é preenchida ao fechar.

---

## 1. Convenções

**Identificadores** `T-19nn`, continuando a numeração: a ESPEC 024 fechou em `T-1809`.

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`pytest` verde; comentário explicando o *porquê* onde a escolha não for óbvia.

**Convenção de commit** `<tipo>(T-19nn): descrição`.

### 1.1 Três regras que atravessam este backlog

**1 — Sem diagnóstico, a peça é proposta.** `parece_proposta` só pode ser `False` quando há
`DiagnosticoDaGrade` **e** os dois sinais da `R-DOC-02` falharam. Trinta e tantos pontos da suíte
constroem `Contract(proposta="X")` sem diagnóstico, e a
`test_t1121_sem_diagnostico_a_mensagem_e_a_de_sempre` já existe para guardar essa fronteira. Uma
implementação que inverta o padrão não deixa a suíte vermelha de forma útil: ela **apaga o caminho
`V-ADT-01`** de todos os testes de unidade, e nada diz que isso aconteceu.

O sinal no diff é `v_doc_01` registrando sem consultar `diagnostico is None`.

**2 — Asserção sobre conjunto, nunca sobre índice.** Esta entrega **remove e acrescenta** achados
na mesma lista. `achados.bloqueantes[0].validacao == "X"` fica verde tendo removido a validação
errada, e não há como perceber. Todo teste de achado deste backlog compara conjuntos —
`{a.validacao for a in ...}` — ou contagens explícitas.

O sinal no diff é `bloqueantes[0]` em teste novo.

**3 — Os textos são autorais, e entram por extenso.** As mensagens da ESPEC §9 nascem da própria
espec; não há planilha nem PDF de onde transcrevê-las. Os testes citam as cadeias **literalmente**,
e nunca via a constante que a implementação define — comparar contra ela provaria só que o código
concorda com ele mesmo. É a regra 1 do TASKS 024, pelo mesmo motivo.

O sinal no diff é um teste que asserte `mensagens.V_DOC_01_TITULO` em vez do texto.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** A âncora que reproduz a tela | T-1900 … T-1904 | **P0** | F0 |
| **E1** O aviso do formulário | T-1905 … T-1908 | **P1** | F1 |
| **E2** O nome do arquivo e o fim da cascata | T-1909 … T-1914 | **P2** | F2 |
| **E3** Os sinais e a função pura da causa | T-1915 … T-1920 | **P3** | F3 |
| **E4** `V-DOC-01` entra, `V-ADT-01` se restringe | T-1921 … T-1927 | **P4** | F4 |
| **E5** O achado estruturado e o cartão | T-1928 … T-1933 | **P5** | F5 |
| **E6** A pessoa e o conjunto | T-1934 … T-1937 | **P6**, **P7** | F6 |

**E1 e E2 são publicáveis sozinhos.** E4 também, com a mensagem concatenada.

### 2.1 A régua da entrega — o que pode mudar de comportamento

| Muda | Não muda |
|---|---|
| Os achados do `modelo.pdf` como contrato: **3 → 1** | O texto das validações `V-CTR-01` e `V-CAP-01` |
| `V-ADT-01` passa a exigir `parece_proposta`, e o texto vira o da ESPEC §9.3 | Quando `V-CTR-01` e `V-CAP-01` disparam **fora** de peça bloqueada |
| `V-CTR-01` e `V-CAP-01` deixam de ser **registradas** sobre peça bloqueada | A extração (`R-GRD-*`, `R-ADT-*`) e a consolidação (`R-QTD-*`) |
| `Entradas` carrega o nome original dos arquivos | O caminho **em disco**, que continua posicional (`R-ADT-10`) |
| `Achado` ganha quatro campos, opcionais | `V-CTR-03`, `V-CTR-04`, `V-CTR-05`, `V-ADT-02` a `V-ADT-04` e `V-MED-01` a `03` |
| O cabeçalho da tela de bloqueio | O `.docx` e o `.xlsx`, byte a byte |

---

## 3. Épico E0 — A âncora que reproduz a tela `[portão P0]`

> **Nenhum arquivo de `src/` é tocado neste épico.**

#### T-1900 — A âncora dos três achados `[portão P0]`
**Tamanho:** P · **Ref:** ESPEC §1

`backend/tests/test_documento_submetido.py`, novo. Submete o par que reproduz a tela:

```python
resultado = DIContainer().gerar(
    Entradas(contrato=caminho_modelo, levantamento=caminho_levantamento)
)
assert {a.validacao for a in resultado.achados.achados} == {
    "V-ADT-01", "V-CTR-01", "V-CAP-01",
}
```

Sobre o **conjunto** (regra 2 do §1.1). Com índice, a E2 ficaria verde tendo removido a validação
errada, e o portão `P2` não valeria nada.

`caminho_modelo` já existe em `conftest.py:95` — o arquivo é o mesmo
`SMIT_SUSTENTACAO_Levantamento_…_GRC.pdf` da ESPEC §2.1, MD5 `67f340c5c9002a410f31e795bcd780f7`.

**Pronto quando:** passa **hoje**, contra o código intocado, encontrando os três.

---

#### T-1901 — O custo, medido antes de multiplicar
**Tamanho:** PP · **Ref:** PLANO §6

`modelo.pdf` custa ~17 s de extração. A E4 vai pedi-lo de novo (`T-1924`), e a E3 pede outros três
PDFs. Medir agora e decidir: fixture de sessão no padrão de `fontes_caras`, ou pagar por teste.

**Recomendado: fixture de sessão** já a partir da `T-1900` — o `Contract` devolvido é lido, não
mutado, e a decisão fica tomada antes de a E4 duplicar o custo por descuido.

**Pronto quando:** a decisão está no docstring da fixture, com o número medido ao lado.

---

#### T-1902 — A afirmação caduca de `estados.ts`
**Tamanho:** PP · **Ref:** PLANO §1

`estados.ts:47` diz *"nenhuma combinação das fixtures do repositório produz achado bloqueante"*.
Deixou de ser verdade com a `T-1900`. Corrigir o comentário e registrar que o dublê de 422
permanece **por escolha** — 17 s por teste de navegador seria caro —, e não por impossibilidade.

**Pronto quando:** o comentário descreve o repositório de hoje.

---

#### T-1903 — Inventário de *"Processamento bloqueado"*
**Tamanho:** PP · **Ref:** PLANO §5.4

Seis ocorrências, em quatro arquivos: `ResultadoPanel.tsx:125`, `estados.ts:56` e `:79`,
`anuncio.spec.ts:80` e `:129`, `inventario-de-anuncios.ts:136`.

O último é o que a suíte de acessibilidade compara: mudar o componente e esquecer o inventário
deixa a `a11y` vermelha **por texto**, e o tempo se perde procurando defeito onde não há.

Registrar a lista no cabeçalho da `documento.spec.ts` que a E1 cria, para que a E5 a encontre.

**Pronto quando:** as seis estão listadas, com arquivo e linha.

---

#### T-1904 — O canário do padrão conservador `[risco]`
**Tamanho:** PP · **Ref:** §1.1 regra 1, `R-DOC-02`

```python
achados = ValidationReport()
v_doc_01_peca_nao_e_proposta(Contract(proposta="X"), "contrato", achados)
assert achados.achados == []
```

Escrito **agora**, contra função que ainda não existe: fica vermelho por `ImportError` até a
`T-1921`, e é intencional. Marcar com `pytest.importorskip` **não** é aceitável — o vermelho é a
mensagem.

Irmão da `test_t1121_sem_diagnostico_a_mensagem_e_a_de_sempre`, que faz o mesmo pela `V-CTR-01`, e
o docstring deve dizer isso.

**Pronto quando:** existe e reprova por import.

---

**Verificação do E0:** `P0` — a `T-1900` passa com os três achados.

---

## 4. Épico E1 — O aviso do formulário `[portão P1]` `[publicável sozinho]`

> **Nenhum arquivo de backend é tocado neste épico.**

#### T-1905 — O aviso pelo nome do arquivo
**Tamanho:** P · **Ref:** `R-DOC-08`

`UploadForm`: ao escolher arquivo no campo Contrato, comparar o nome, sem acento e em minúsculas,
contra o vocabulário de levantamento — `levantamento`, `_grc`, `comprovacao`. Havendo casamento,
aviso inline abaixo do campo.

O vocabulário é **do frontend**, e é a única regra de negócio que esta espec deixa em TypeScript.
Justifica-se por `D-07`: o aviso existe para não pagar a viagem ao servidor, e uma regra que
precise do servidor não serve para isso. Comentar essa exceção onde a constante for declarada.

**Pronto quando:** o aviso aparece e some conforme o arquivo escolhido.

---

#### T-1906 — O aviso é `status`, não `alert`
**Tamanho:** PP · **Ref:** ESPEC 008 `R-ACE-13`

`role="status"`: não interrompe leitura em curso, porque não é erro — é ressalva sobre uma escolha
ainda reversível. Entra no `inventario-de-anuncios.ts` com a fala esperada, como todo anúncio da
aplicação.

**Pronto quando:** o inventário tem a entrada e a `a11y` a encontra.

---

#### T-1907 — O portão: avisa **sem** requisição `[portão P1]`
**Tamanho:** P · **Ref:** `R-DOC-08`

`frontend/e2e/documento.spec.ts`, novo. Escolher um arquivo com `levantamento` no nome faz o aviso
surgir, e `page.route("**/reports", …)` **não** é chamada.

A asserção sobre a ausência da requisição é o teste inteiro: um aviso que apareça depois do POST
não economiza os 16,6 s, que é a razão de a tarefa existir.

**Pronto quando:** verde, com a rota provadamente não acionada.

---

#### T-1908 — O aviso não impede
**Tamanho:** PP · **Ref:** `R-DOC-08`, `D-07`

*Enviar assim mesmo* segue o fluxo normal; o botão Gerar continua habilitado o tempo todo; o campo
não é limpo.

`proposta_do_levantamento_2026.pdf` é nome legítimo e dispara o aviso. **A saída barata é o que
torna o falso positivo aceitável** — sem ela, a `T-1905` não deveria existir.

**Pronto quando:** o caminho *Enviar assim mesmo* está coberto no `documento.spec.ts`.

---

**Verificação do E1:** `P1`. **Publicável sozinho.**

---

## 5. Épico E2 — O nome do arquivo e o fim da cascata `[portão P2]` `[publicável sozinho]`

> **`V-DOC-01` ainda não existe.** Ao final deste épico o usuário vê **uma** mensagem — ainda a
> antiga, ainda confusa, mas uma. É ganho publicável.

#### T-1909 — `Entradas` carrega os nomes originais
**Tamanho:** P · **Ref:** `R-DOC-06`

`reports.py` descarta o `filename` em `gravar(contrato, destino, "pdf", "contrato")`. Acrescentar
os nomes originais a `Entradas`, ao lado dos caminhos.

**O caminho em disco continua posicional.** A renomeação existe porque dois aditivos homônimos se
sobrescreveriam (`R-ADT-10`), e essa razão não mudou: o nome original é **só para exibição**.
Comentar isso onde o campo for declarado, ou alguém vai "simplificar" juntando os dois.

**Pronto quando:** o nome chega às validações; teste de API confirma que o arquivo em disco não
mudou de nome.

---

#### T-1910 — `V-ADT-01` nomeia o arquivo
**Tamanho:** PP · **Ref:** `R-DOC-06`

`v_adt_01_peca_sem_itens` troca *"(sem identificação)"* pelo nome do arquivo quando
`peca.proposta` está vazio. Com `proposta` preenchida, o texto não muda — é o identificador formal,
e é melhor que o nome do arquivo.

**Pronto quando:** a `T-1900` reancorada mostra o nome; a `T-1330` continua verde com `PA-VAZIO`.

---

#### T-1911 — A guarda de `V-CTR-01`
**Tamanho:** P · **Ref:** `R-DOC-07`

Em `container.gerar`, `v_ctr_01_tabela_localizada` só é chamada quando **todas** as peças renderam
itens.

A guarda vive no orquestrador, e não dentro da validação, pela razão que o próprio container já
registra: *"para que elas não precisem saber em que ordem são chamadas"* (`R-GRD-06`, ESPEC 019
`D-06`). **O texto da `V-CTR-01` não muda** — a `T-1121` continua verde, e é para continuar.

**Pronto quando:** `modelo.pdf` não produz mais `V-CTR-01`; consolidado vazio por outra razão ainda
produz.

---

#### T-1912 — A guarda de `V-CAP-01`
**Tamanho:** PP · **Ref:** `R-DOC-07`

Idem, para `v_cap_01_cliente_nao_derivado`: só quando a proposta tem itens.

Sem a guarda, a tela promete *"a capa identificará o cliente pelo título do levantamento"* num
caminho em que não haverá capa nenhuma. **O texto da validação não muda**; a `T-1425` continua
verde.

**Pronto quando:** `modelo.pdf` não produz mais `V-CAP-01`.

---

#### T-1913 — O portão: um achado `[portão P2]`
**Tamanho:** PP · **Ref:** PLANO `P2`

A `T-1900` reancorada: `{"V-ADT-01"}`, com o nome do arquivo na mensagem.

Reancorar aqui é trocar um conjunto de três por um de um — não há `sha256` nem valor colado da
saída, e por isso não vale a ressalva do PLANO 021. O conjunto novo é **decidido pela espec**, não
lido do código.

**Pronto quando:** verde, com o conjunto de um elemento.

---

#### T-1914 — O contrapeso: a supressão não é por gravidade `[risco]`
**Tamanho:** PP · **Ref:** `R-DOC-07`

Proposta legítima **sem** cliente derivado continua produzindo `V-CAP-01`. A `T-1425` já é esse
teste; confirmar verde e citá-la no docstring da guarda.

O passo seguinte natural — *"esconder todo aviso quando há bloqueio"* — apagaria informação
legítima. `R-DOC-07` é sobre **consequência da mesma peça**, e não sobre gravidade. Esta tarefa é o
que impede a leitura errada de virar código na próxima espec.

**Pronto quando:** a `T-1425` está verde e citada.

---

**Verificação do E2:** `P2`. Contagem de backend reconciliada. **Publicável sozinho.**

---

## 6. Épico E3 — Os sinais e a função pura da causa `[portão P3]`

> **Nada muda na tela nem na API neste épico.**

#### T-1915 — Os três campos do diagnóstico
**Tamanho:** P · **Ref:** `R-DOC-01`

`DiagnosticoDaGrade` ganha `geometrias_candidatas: int`, `codigos_nas_candidatas: tuple[int, ...]`
e `parece_proposta: bool` — **por último e com padrão**, pela razão que o campo `diagnostico` do
`Contract` já registra: dezenas de construções parciais nos testes quebrariam com campo
obrigatório.

**Pronto quando:** os campos existem; a suíte continua verde sem uma linha alterada.

---

#### T-1916 — Quem preenche, e o padrão
**Tamanho:** P · **Ref:** `R-DOC-02`, §1.1 regra 1

`analisar_geometria` já tem `candidatos` na mão — `len` e a tupla de `c.codigos` saem de graça.
`parece_proposta` é `_PROPOSTA` na p.1 **ou** alguma candidata com código, e é o extrator quem o
compõe, porque só ele lê a página 1.

**Sem diagnóstico não há `parece_proposta` falso**: a ausência do objeto é a ausência da evidência,
e a leitura conservadora é *é proposta*.

**Pronto quando:** os quatro PDFs da `T-1920` produzem os valores da ESPEC §2.3.

---

#### T-1917 — As referências citadas na página 1
**Tamanho:** PP · **Ref:** `R-DOC-01`, ESPEC §2.4

`_REFERENCIA = re.compile(r"\b(?:PC|PA)-[A-Z]+-[\d-]+")`, aplicada à **mesma string** que
`_proposta()` e `_cliente()` já percorrem. Nenhuma leitura nova de PDF — é a `R-DOC-01`.

Ordenadas e sem repetição, para que a mensagem seja determinística. No `modelo.pdf` são três:
`PC-SMIT-240402-53`, `PA-SMIT-250220-15`, `PA-SMIT-260319-739`.

**Pronto quando:** as três saem, nessa ordem, do arquivo real.

---

#### T-1918 — `causa_provavel`, função pura
**Tamanho:** P · **Ref:** `R-DOC-03`, `D-04`

Recebe `DiagnosticoDaGrade` e devolve o degrau. Sem PDF, sem I/O, sem `Contract` — no lugar e no
espírito de `_escolher_gabarito`, que existe para que `R-GRD-02` possa ser provada sem abrir
arquivo.

A ordem dos degraus é a da `R-DOC-03` e importa: *sem texto* vem antes de *sem tabela*, porque um
PDF digitalizado também não tem tabela, e dizer *"não há tabela"* a quem escaneou o documento manda
a pessoa para o lado errado.

**Pronto quando:** existe, com os quatro degraus, e nada nela importa `pdfplumber`.

---

#### T-1919 — Os quatro degraus, sem abrir PDF `[portão P3]`
**Tamanho:** P · **Ref:** ESPEC `P2`

Sobre `DiagnosticoDaGrade` construído à mão, como a `_diagnostico()` de
`test_cascata_de_validacoes.py` já faz.

Inclui o degrau 1 — *sem camada de texto* —, para o qual **não há fixture no repositório**. É a
razão de a `D-04` exigir função pura: o degrau que não se pode montar em arquivo é exatamente o que
a função pura torna testável.

**Pronto quando:** os quatro passam, e nenhum abre arquivo.

---

#### T-1920 — O gabarito dos sinais nos quatro PDFs `[risco]`
**Tamanho:** P · **Ref:** `R-DOC-02`, ESPEC §2.3

| arquivo | `parece_proposta` |
|---|---|
| `contrato.pdf` | `True` |
| `contrato_pgm.pdf` | `True` |
| `aditivo_pgm.pdf` | `True` |
| `modelo.pdf` | `False` |

É a medição da espec virando teste. **Escrita aqui, é gabarito; escrita depois da E4, seria
confirmação** — e confirmação de uma regra já implementada não prova que ela não recusa proposta
legítima.

**Pronto quando:** os quatro valores batem, com os `codigos_nas_candidatas` da ESPEC §2.3 na
mensagem de falha.

---

**Verificação do E3:** `P3`. A tela e a API não mudaram.

---

## 7. Épico E4 — `V-DOC-01` entra, `V-ADT-01` se restringe `[portão P4]` `[publicável sozinho]`

#### T-1921 — `v_doc_01_peca_nao_e_proposta`
**Tamanho:** M · **Ref:** `R-DOC-03`

Monta o texto da ESPEC §9.2 a partir de `causa_provavel` e das referências: título fixo com o papel
e o nome do arquivo, causa por degrau, ação fixa mais a frase das referências quando houver.

No degrau 1 a **ação** também muda — *"envie o PDF original, não a versão escaneada"* —, porque o
conserto é outro. É a única exceção à ação fixa, e merece comentário.

Guarda da regra 1 do §1.1: sem diagnóstico, não registra.

**Pronto quando:** existe; a `T-1904` fica verde.

---

#### T-1922 — `V-ADT-01` muda de dono
**Tamanho:** P · **Ref:** `R-DOC-04`

Só registra quando `parece_proposta`. O texto vira o da ESPEC §9.3, com **"Não é erro no seu
envio"** por extenso e a ação dirigida ao suporte.

A frase é o conteúdo da tarefa, não enfeite: sem ela, quem recebe a mensagem tenta outros arquivos
até desistir, que é o comportamento que a espec existe para evitar.

**Pronto quando:** a `T-1330` continua verde; peça reconhecida e vazia produz o texto novo.

---

#### T-1923 — A ordem no container `[risco]`
**Tamanho:** P · **Ref:** `R-DOC-03`

`V-DOC-01` antes de `V-ADT-01`, por peça, com o papel — *Contrato*, *1º aditivo*, *2º aditivo* —
que a mensagem usa.

As duas descrevem o **mesmo silêncio** por motivos diferentes. Se ambas puderem registrar na mesma
peça, esta entrega terá trocado três mensagens por duas, e o portão `P2` não pega — ele conta o
conjunto **depois** da E2.

**Pronto quando:** nenhuma peça produz as duas; a asserção de conjunto da `T-1924` confirma.

---

#### T-1924 — O positivo: o `modelo.pdf` acusado `[portão P4]`
**Tamanho:** P · **Ref:** ESPEC `P0`

`{"V-DOC-01"}`, e a mensagem contém as três referências da `T-1917` e a causa do degrau 3 — *"as
três tabelas de sete colunas deste PDF não trazem códigos de serviço"*.

Cadeias por extenso (regra 3 do §1.1).

**Pronto quando:** verde, com o conjunto de um elemento.

---

#### T-1925 — Os três negativos `[portão P4]` `[risco]`
**Tamanho:** P · **Ref:** ESPEC `P1`

`contrato.pdf`, `contrato_pgm.pdf` e `aditivo_pgm.pdf` **não** produzem `V-DOC-01`.

**É o portão que a pressa pula.** O caso feliz é o que dá prazer escrever; estes três são o que
impede a entrega de recusar proposta legítima — o pior resultado possível desta espec, e o único
que ninguém descobre em teste de mesa.

**Pronto quando:** os três passam, em `parametrize`, com o nome do arquivo na falha.

---

#### T-1926 — O degrau mais baixo `[portão P4]`
**Tamanho:** PP · **Ref:** ESPEC `P3`, §2.5

`saida/amostra-p1.pdf` — uma folha, sem tabela de sete colunas, sem referência citada — produz
`V-DOC-01` com a parte fixa e **nenhuma** linha de evidência acrescentada.

É o PDF aleatório da ESPEC §2.5, e o teste que prova a `D-06`: a mensagem não depende de o sistema
reconhecer o documento.

**Decidir aqui:** copiar o arquivo para `fixtures/` ou lê-lo de `saida/`. **Recomendado: copiar** —
`saida/` é diretório de trabalho e nada garante que ele sobreviva.

**Pronto quando:** verde, e o arquivo está onde a suíte o encontra sempre.

---

#### T-1927 — O canário fecha
**Tamanho:** PP · **Ref:** §1.1 regra 1

A `T-1904` verde: sem diagnóstico, nada de `V-DOC-01`, e `V-ADT-01` segue como sempre.

**Pronto quando:** verde sem `importorskip` nem `xfail`.

---

**Verificação do E4:** `P4`. **Publicável sozinho** — a mensagem sai concatenada e já diz o que
fazer.

---

## 8. Épico E5 — O achado estruturado e o cartão `[portão P5]`

#### T-1928 — Os quatro campos no achado
**Tamanho:** P · **Ref:** `R-DOC-05`

`ValidationFinding` ganha `titulo`, `causa`, `acao`, `detalhe`, opcionais. `mensagem` passa a ser
`f"{titulo} — {causa} {acao}"` quando eles existem, e continua literal quando não.

Manter `mensagem` é o que torna a E5 reversível e o que deixa as outras **onze** validações intactas — `V-CTR-01`, `03`, `04`, `05`, `V-ADT-02` a `04`, `V-CAP-01` e `V-MED-01` a `03`.

**Pronto quando:** as 11 asserções de `.mensagem` do backend continuam verdes.

---

#### T-1929 — O schema
**Tamanho:** PP · **Ref:** `R-DOC-05`

`Achado` ganha os quatro, opcionais. Achado antigo continua chegando só com `mensagem` — é
compatível para frente e para trás, e o `test_api_e2e` não muda.

**Pronto quando:** `mypy` limpo e o contrato de API continua válido para os clientes de hoje.

---

#### T-1930 — `CartaoDeAchado`
**Tamanho:** M · **Ref:** `D-05`, ESPEC §9

Substitui `ListaDeAchados`: título, causa, ação e `<details>` com o detalhe e botão *Copiar*. **Um
cartão por peça**, não por validação.

O `▸` é onde o colchete de diagnóstico vai morar: o texto não se perde, muda de altura. É o que a
`R-GRD-07` pedia para o suporte, sem custar a leitura de quem confere.

**Pronto quando:** o cartão renderiza as quatro partes e o botão copia o detalhe.

---

#### T-1931 — O cabeçalho, nos seis pontos
**Tamanho:** P · **Ref:** ESPEC §9.1

*"Não foi possível gerar o relatório"*, com o subtítulo por contagem. Nos **seis** pontos da
`T-1903` — inclusive `inventario-de-anuncios.ts`, que é o que a `a11y` compara.

**Pronto quando:** a suíte de acessibilidade está verde e a fala anunciada é a nova.

---

#### T-1932 — Achado sem campos novos continua aparecendo `[risco]`
**Tamanho:** PP · **Ref:** `R-DOC-05`

Onze validações continuam mandando só `mensagem`. Se o cartão exigir os quatro campos, elas somem
da tela — e o teste que pegaria isso é o da `V-CTR-03`, que ninguém vai lembrar de rodar contra a
tela.

Dublê de 422 com um achado só de `mensagem`, e a asserção de que ele é exibido.

**Pronto quando:** verde, com um achado no formato antigo.

---

#### T-1933 — O portão da tela `[portão P5]`
**Tamanho:** P · **Ref:** PLANO `P5`

`documento.spec.ts`: o dublê com os campos novos exibe as quatro partes; o colchete de diagnóstico
**não** aparece no corpo da frase; o nome do arquivo está visível.

`axe` A/AA no cartão novo, em 1366 e 390.

**Pronto quando:** verde, com o `axe` limpo.

---

**Verificação do E5:** `P5`.

---

## 9. Épico E6 — A pessoa e o conjunto `[portões P6 e P7]`

#### T-1934 — A pessoa do faturamento `[portão P6]`
**Tamanho:** P · **Ref:** ESPEC `P8`

Alguém do faturamento, **sem explicação prévia**, vê a tela do `modelo.pdf` e diz qual arquivo deve
enviar.

Falhando, não é defeito de código: é redação da ESPEC §9. Corrigir o texto e repetir — e registrar
na §10 o que a pessoa leu diferente do esperado, que é o dado mais caro deste backlog.

**Pronto quando:** a pessoa acerta o arquivo sem ajuda.

---

#### T-1935 — Suíte e contagem reconciliada `[portão P7]`
**Tamanho:** P · **Ref:** PLANO `P7`

559 → o número novo, tarefa a tarefa. Uma diferença não explicada é teste apagado por acidente, e é
assim que se descobre.

**Pronto quando:** a soma fecha e está escrita aqui.

---

#### T-1936 — Ferramentas e navegador `[portão P7]`
**Tamanho:** P · **Ref:** PLANO `P7`

`ruff`, `mypy src/`, `tsc --noEmit`, `next lint`, `next build`; navegador completo; `axe` A/AA em
1366 e 390.

**Pronto quando:** tudo limpo.

---

#### T-1937 — Fechamento documental
**Tamanho:** PP · **Ref:** —

ESPEC e PLANO 025 marcados como implementados; este backlog com o status final e a **§10 — o que a
implementação ensinou** preenchida, inclusive com o que saiu diferente do plano.

**Pronto quando:** os documentos refletem o que foi feito.

---

## 10. O que a implementação ensinou

### 10.1 O sinal da página 1 não era o que o plano supunha `[desvio]`

A `R-DOC-02` fala em *"a página 1 casa `Proposta Comercial` ou `Proposta de Aditivo:`"*, e o
PLANO §2.3 mediu esse sinal com `_PROPOSTA` — a regex que o extrator já tinha. **São coisas
diferentes**, e a diferença só apareceu ao escrever a `T-1916`: `_PROPOSTA` extrai o
**identificador de um aditivo**, e uma proposta comercial inicial não traz `Proposta de Aditivo:`
em lugar nenhum.

Os três PDFs reais do repositório são todos aditivos, então os dois sinais coincidem neles e a
medição da espec continua válida. Mas a primeira proposta de um contrato novo — que o repositório
não tem — dependeria apenas dos códigos nas candidatas, com metade da redundância que a
`R-DOC-02` promete.

Entrou `_DECLARA_PROPOSTA`, mais larga e com propósito próprio: `_PROPOSTA` responde *"qual
aditivo é este?"*, e a nova responde *"isto é uma proposta?"*. Duas perguntas, duas regexes.

**Lição:** medir um sinal pela função que já existe é medir a função, não o sinal. A espec descreve
o que se quer saber; o código descreve o que alguém precisou saber antes.

### 10.2 A entrada do inventário não podia usar `[role="status"]` `[desvio]`

A `T-1906` previa a entrada com o seletor de papel, como as outras. Reprovaria: `page.tsx` monta um
`role="status"` **desde o primeiro render** para a `R-LMP-10`, e o teste `T-1029` afirma
`toHaveCount(1)`.

O aviso ganhou `id="contrato-aviso"`, e a entrada aponta para ele. A varredura no sentido
DOM → inventário continua fechando: cada elemento precisa casar com **algum** seletor declarado, e
os dois casam com os seus.

**Lição:** seletor por papel só é único enquanto aquele papel for único. O inventário da ESPEC 016
já tinha duas entradas dividindo `aria-live="polite"`; esta é a primeira a dividir `status`.

### 10.3 O rótulo do botão mudou, e o motivo é de ordem de tabulação `[desvio]`

A ESPEC §9.5 escreve *Enviar assim mesmo*. Implementado como **Usar assim mesmo**, que dispensa o
aviso sem submeter.

O formulário tem **um** botão de envio, e a ordem de tabulação da ESPEC 008 §6 o coloca como última
parada. Um segundo caminho de submissão dentro do aviso criaria duas formas de fazer a mesma coisa
e uma parada nova antes de *Gerar relatório* — preço alto para uma palavra. O comportamento que a
`T-1908` exige — não impedir, não limpar o campo, não desabilitar nada — está inteiro.

### 10.4 `registrar_em_partes` em vez de estender `registrar`

`registrar` é chamada por onze validações com `mensagem` posicional. Acrescentar quatro parâmetros
opcionais a ela deixaria a assinatura ambígua — *quem passa `mensagem` e quem passa partes?* — e a
composição da `mensagem` teria de adivinhar a intenção.

Um segundo método resolve sem tocar em nenhuma chamada existente, e a composição fica num lugar só:
`" ".join` das três primeiras partes, **nunca** do `detalhe`. Recolocar o técnico na `mensagem`
desfaria a entrega para quem consome só ela.

### 10.5 O que o plano acertou

* **A `T-1904` pagou-se.** Escrita na F0, vermelha por `ImportError` durante quatro épicos, verde na
  `T-1927`. Sem ela, o predicado da `V-DOC-01` teria sido escrito sem a guarda de `diagnostico is
  None`, e as trinta e tantas construções à mão da suíte teriam parado de exercitar `V-ADT-01` **em
  silêncio**.
* **As três âncoras do §5.2 não se mexeram**, exatamente como previsto: `test_cascata_de_validacoes`
  `:75` e `:86` e `test_capa:452` chamam as validações direto, e a entrega mudou **onde** elas são
  registradas, não o que dizem.
* **A `T-1900` sobre conjunto**, e não sobre índice, reprovou três vezes ao longo da entrega — uma
  por épico que mexeu no conjunto —, e cada reprovação foi informação.
* **A contagem fechou na primeira tentativa**: 559 → 578, e 578 − 559 = 19, que é exatamente o
  tamanho de `test_documento_submetido.py`. Nenhum teste foi perdido no caminho, e nenhum dos onze
  pontos que leem `.mensagem` precisou de uma linha.

### 10.6 Duas notas operacionais

* `next build` grava em `.next/`, o mesmo diretório que um servidor de desenvolvimento em execução
  usa. Rodar o build com `pnpm dev` no ar deixa o servidor com cache inválido
  (`Cannot find module './827.js'`) até ser reiniciado. A suíte de navegador desta entrega rodou em
  porta própria para não interferir num servidor que já estava no ar.
* `backend/tests/test_divergencia_de_fonte.py` — arquivo **não versionado**, anterior a esta
  entrega — tem um `I001` de `ruff` (bloco de imports fora de ordem). Não foi tocado: não é desta
  espec, e corrigi-lo misturaria diffs.

---

## 11. O que este backlog não faz

- **Não muda a extração nem a consolidação.** `R-GRD-*`, `R-ADT-*` e `R-QTD-*` continuam decidindo
  exatamente o que decidem hoje — o `modelo.pdf` já era recusado pelo motivo certo.
- **Não toca o `.docx` nem o `.xlsx`.** As âncoras `test_anchor_*`, `test_docx_estrutura` e
  `test_docx_formatacao` não devem precisar de uma linha; qualquer uma delas acusando é sinal de
  que o escopo vazou.
- **Não classifica o documento.** Prova-se que não é proposta (`D-02`); não se afirma o que ele é.
- **Não reaproveita o arquivo no campo certo** (`D-03`).
- **Não resolve o PDF grande e alheio** (`I-01`): a causa continua sendo apurada depois da varredura
  de geometria.
- **Não estende `V-DOC-01` ao campo Levantamento** (`I-02`), nem leva `causa`/`acao` ao `.docx`
  (`I-03`).
