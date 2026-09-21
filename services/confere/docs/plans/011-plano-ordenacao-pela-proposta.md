# PLANO 011 — Implementação da ordenação pela proposta

| | |
|---|---|
| **Especificação** | [ESPEC 011](../specs/011-ordenacao-pela-proposta.md) v1.0 |
| **Versão** | 1.0 — 2026-08-10 |
| **Estado inicial** | 365 testes de backend coletados; teste-âncora em 54 de 55; documento com 22 seções, 55 linhas e 109 fileiras na tabela de comprovação; 4 suítes de acessibilidade no navegador |

---

## 1. O princípio que ordena este plano

A ESPEC 011 §13 estima 1 a 2 dias, e a estimativa está certa: a mudança de produção é uma **chave de
ordenação**. `Contract.itens` já sai em ordem de documento, o renderizador não é tocado, o catálogo
não é tocado. Escrita como código, cabe numa manhã.

O que não cabe numa manhã é **provar que está certa**. E o risco aqui tem uma forma específica, que
não é a dos incrementos anteriores:

> **Este incremento não acrescenta comportamento. Ele troca um gabarito por outro.**

Nos PLANOS 003, 004 e 009 havia sempre um documento externo dizendo qual era o resultado certo, e o
trabalho era chegar nele. Aqui o documento externo que o projeto usa há três incrementos — o
relatório GRC — **deixa de ser a autoridade sobre ordem**. Se a substituição for feita de qualquer
jeito, o projeto passa de um estado em que a ordem é provada para um estado em que a ordem é
*afirmada por quem a implementou*.

Daí os dois princípios que ordenam as fases:

> **1. A ordem nova é provada contra o PDF, nunca contra uma lista escrita à mão.**
>
> **2. O "antes" é congelado antes de existir o "depois".**

O primeiro governa a F0. A tentação óbvia é gravar no teste os 55 códigos na ordem esperada — e isso
não prova nada: é escrever o resultado duas vezes e conferir uma cópia com a outra. Pior, se a chave
de ordenação de produção for usada também no teste, o teste passa a demonstrar que a função é igual a
si mesma. **O instrumento da F0 lê `Q-00739-7.pdf` por um caminho próprio** — texto das páginas 26 a
29 —, sem passar por `PdfPlumberContractExtractor`. Se os dois caminhos concordarem, a ordem está
certa; se discordarem, um dos dois está errado e o portão diz qual.

O segundo princípio é a lição do PLANO 009 §10.1, e aqui ela é mais cara. `R-ORD-07` promete que
`ordenacao=GRC` reproduz o documento atual **byte a byte** — e essa promessa só é verificável contra
um documento gerado **antes** da mudança. Depois de a chave de ordenação existir, o "antes" não pode
mais ser produzido. É o único ponto de não retorno deste plano, e ele cai na primeira tarefa.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — O "antes" está congelado** | Fim da F0 | Existe em `tests/fixtures/` o hash do `.docx` de hoje, gerado sem anexos, e um teste que o confere. Ele passa **antes** de qualquer arquivo de `src/` ser tocado | **Não seguir.** Depois da F1 esse artefato não pode mais ser produzido |
| **P1 — A ordem é a da proposta** | Fim da F1 | Os 55 códigos do agregado, na ordem `PROPOSTA`, batem com a sequência lida do PDF pelo instrumento independente da F0 — **inclusive o par `SG0721` / `IT0101`** | A chave de ordenação está errada. Corrigir antes de faixas, âncora, API e tela |
| **P2 — `GRC` não regrediu** | Fim da F1 | Com `ordenacao=GRC` o documento sai **byte a byte** igual ao congelado em P0 | `R-ORD-07` está quebrada: a segunda ordem virou ficção e o plano perdeu a reversibilidade |
| **P3 — As faixas e a estrutura** | Fim da F2 | 22 seções contíguas; `C` sobre `C2`, `E` sobre `E5.7`, `C7` sobre `C7.3`; `E2` e `E5` ausentes; 107 fileiras | Não seguir para a API com um documento cuja estrutura ninguém conferiu |
| **P4 — O conjunto não regrediu** | Fim da F5 | Âncora re-chaveado em 54 de 55; âncora da análise intacto; 365 testes mais os novos; `axe` verde nos quatro estados; documento aberto no Word | Não entregar |

**P0 é o portão de meia hora que compra a reversibilidade do incremento inteiro.** Todos os outros
são verificações; ele é o único que, pulado, não pode ser recuperado depois.

**P2 existe porque `GRC` é a opção que ninguém vai usar no dia a dia.** Opção sem teste apodrece em
silêncio, e esta em particular é a rede que permite voltar atrás se a ordem nova não agradar em
revisão.

---

## 3. Fases

### F0 — O instrumento e o congelamento do "antes" `[portão]`

**Objetivo:** poder provar a ordem contra o PDF, e poder provar depois que a ordem antiga sobreviveu.
**Nenhum arquivo de `src/` é tocado nesta fase.**

| # | Tarefa | Ref. |
|---|---|---|
| T-601 | **[não retorno]** Gerar o `.docx` de hoje com `relatorio.anexos = []`, como faz o `test_docx_formatacao`, e congelar o **sha256** em `tests/fixtures/docx_ordem_grc.sha256`. Registrar no arquivo a data e o commit de origem | **P0**, `R-ORD-07` |
| T-602 | Teste que confere o hash congelado contra uma geração nova. **Passa hoje, antes de qualquer mudança** — é o que prova que o instrumento mede o que diz medir | **P0** |
| T-603 | `tests/leitura_proposta.py`: lê a tabela de itens de `contrato.pdf` **por caminho próprio** — texto das páginas 26 a 29, regex de código —, sem importar `PdfPlumberContractExtractor`. Devolve a sequência de `(código, descrição)` na ordem do documento | §1, **P1** |
| T-604 | Teste de auto-conferência do instrumento: **60 itens**, o primeiro é `10.050.00001.00`, o último é `15.076.00005.00`, e `14.025.00011.00` aparece duas vezes com `SG0721` **antes** de `IT0101` | ESPEC 011 §2.2, §2.5 |
| T-605 | Teste de coerência entre os dois caminhos de leitura: a sequência de códigos do instrumento é **idêntica** à de `Contract.itens`. É o que autoriza produção a usar o extrator e o teste a usar o instrumento | §1 |

**Verificação:** T-602 verde sobre o código intocado; T-604 e T-605 verdes.

> **A T-605 é o que impede o teste de virar tautologia.** Sem ela, ou o teste usa o extrator — e prova
> que a função é igual a si mesma — ou usa o instrumento sem nunca ter conferido que os dois leem o
> mesmo PDF do mesmo jeito. Com ela, os dois caminhos são comparados **uma vez**, explicitamente, e
> daí em diante cada um serve ao seu lado.

**Tamanho:** M — meio dia. **Encerra:** P0.

---

### F1 — A ordenação no domínio e no caso de uso `[portão]`

**Objetivo:** as 55 linhas na ordem da proposta, e a ordem antiga preservada. Sem tocar renderizador,
API nem tela.

| # | Tarefa | Ref. |
|---|---|---|
| T-606 | `domain/value_objects/ordering.py`: `Ordenacao` como `StrEnum` — `PROPOSTA`, `GRC` | `R-ORD-06` |
| T-607 | `Contract.posicao_de(codigo, qualificador) -> int \| None`, irmã de `quantidade_para` e `descricao_para`, **com a mesma regra de casamento por qualificador** — `alvo in descricao.upper()` | `R-ORD-01`, `R-REC-02` |
| T-608 | Teste da T-607: casa `SG0721` e `IT0101` em posições **diferentes**; devolve `None` para código ausente; casa sem qualificador pela primeira ocorrência | `R-ORD-02` |
| T-609 | `GenerateMeasurementReport.executar(..., ordenacao=Ordenacao.PROPOSTA)`. A chave do laço deixa de ser `entrada.ordem` fixo. **A montagem da linha não muda uma vírgula** | `R-ORD-06`, D-04 |
| T-610 | **[risco]** Chave de ordenação **total e determinística**: `(posição, ordem_do_catálogo)`. O segundo termo não é decoração — é o que garante `R-ORD-09` quando a posição empata ou falta | `R-ORD-09` |
| T-611 | Item sem correspondência na proposta vai para o **fim**, preservando entre si a ordem do catálogo | `R-ORD-08` |
| T-612 | **Portão P1**: os 55 códigos em `PROPOSTA` batem com a sequência do instrumento da T-603, restrita a `exibir = S` | **P1** |
| T-613 | Teste das 7 seções que mudam por dentro, código a código, como a ESPEC 011 §5.2 as lista | §5.2 |
| T-614 | Teste da ordem das 22 seções, como a §5.1 a lista | `R-ORD-04`, §5.1 |
| T-615 | **[reversível]** `Entradas.ordenacao` no `DIContainer`, repassada ao caso de uso | §7 |
| T-616 | **Portão P2**: `ordenacao=GRC` reproduz o hash congelado na T-601 | **P2**, `R-ORD-07` |

**Verificação:** P1 e P2 fecham. O `test_docx_estrutura`, o `test_docx_formatacao` e o
`test_docx_anexos` seguem verdes — nenhum deles depende de ordem (§5.3).

> **A T-610 é a tarefa que se parece com detalhe e não é.** `sorted` é estável, então uma chave que
> empate devolve a ordem de entrada — que aqui é a do catálogo, e é aceitável. O problema é a chave
> **faltante**: `None` não compara com `int`, e um item fora da proposta levantaria `TypeError` no meio
> da geração. `R-ORD-08` manda ele sair no fim, não derrubar o relatório.

**Tamanho:** P — três horas. **Encerra:** P1 e P2.

---

### F2 — As faixas por contiguidade e as validações `[portão]`

**Objetivo:** `R-ORD-05` implementada onde ela pode ser testada sem gerar documento.

| # | Tarefa | Ref. |
|---|---|---|
| T-617 | **[decisão]** A regra das faixas é aplicada **na montagem do agregado**, não no renderizador: `ReportSection.grupo_titulo` chega vazio nas seções que não lideram bloco contíguo. Ver §6.3 | `R-ORD-05`, D-04 |
| T-618 | Cálculo dos blocos: para cada `grupo_titulo` distinto, as seções que o carregam no catálogo formam bloco contíguo na ordem vigente? Se sim, emite na primeira; se não, não emite | `R-ORD-05` |
| T-619 | Teste sobre o piloto: `C` sobre `C2`, `E` sobre `E5.7`, `C7` sobre `C7.3`; `E2` e `E5` **ausentes** | §5.3, **P3** |
| T-620 | Teste sobre o piloto em `GRC`: as cinco faixas nos lugares de hoje. É a metade que prova que a regra nova não alterou a ordem antiga | `R-ORD-07` |
| T-621 | Teste de **caso construído**: faixa cujas seções não são contíguas é emitida **uma vez**, na primeira. Ver §5.4 | `R-ORD-05` |
| T-622 | `V-ORD-01` — seção não contígua sob a ordem escolhida, severidade `AVISA` | §8 da espec |
| T-623 | `V-ORD-02` — item exibível ausente da proposta, severidade `AVISA` | `R-ORD-08` |
| T-624 | Teste das duas validações com **caso construído**: nenhuma dispara no piloto, e ambas disparam quando a condição existe. Ver §5.4 | §5.4 |
| T-625 | **Portão P3**: o documento gerado tem 22 seções contíguas e **107 fileiras** na tabela de comprovação | **P3**, ESPEC 011 §2.7 |

**Verificação:** os quatro critérios de P3.

> **T-619 e T-620 andam juntas.** Uma regra de faixas que acertasse a ordem nova e errasse a antiga
> passaria em metade dos testes e quebraria `R-ORD-07` sem que o hash da T-616 acusasse — porque o
> hash é do documento **inteiro** e diria apenas "mudou", não "mudou a faixa `E5`".

**Tamanho:** M — meio dia. **Encerra:** P3.

---

### F3 — O âncora re-chaveado

**Objetivo:** trocar o gabarito de **ordem** sem perder o gabarito de **conteúdo**. É a fase de maior
consequência do plano.

| # | Tarefa | Ref. |
|---|---|---|
| T-626 | `test_anchor_fidelity.py`: `test_a_ordem_dos_codigos_e_a_mesma` → `test_a_ordem_segue_a_proposta`, comparando com o instrumento da T-603. **O GRC deixa de ser gabarito de ordem, e só de ordem** | ESPEC 011 §9.1 |
| T-627 | **[risco]** `test_54_das_55_linhas_sao_identicas`: o `zip(nosso, modelo, strict=True)` passa a casar **por código**, não por posição. Ver §5.1 | ESPEC 011 §9.1 |
| T-628 | O casamento por código precisa de chave `(código, ocorrência)` — `14.025.00011.00` aparece duas vezes. **Reaproveitar `_chavear` de `leitura_analise.py`** em vez de escrever a segunda | §5.1 |
| T-629 | Teste de guarda do próprio âncora: o casamento por código encontra **55 pares**, sem sobra dos dois lados. Sem isso, um código digitado errado viraria "linha ausente" silenciosa em vez de falha | §5.1 |
| T-630 | `test_reconciliation.py::test_ordem_das_linhas_segue_o_catalogo`: **reescrever, não apagar.** Parametrizar pelas duas ordenações — `GRC` mantém `["11.051…", "11.027…"]`, `PROPOSTA` afirma o inverso. Ver §5.2 | §5.2 |
| T-631 | Rodar o âncora e confirmar **54 de 55**, com a divergência do certificado no mesmo lugar | **P4** |

**Verificação:** o âncora fecha em 54 de 55; a divergência declarada continua sendo a de
`11.027.00001.00` e nenhuma outra.

> **A T-627 é a tarefa mais fácil de fazer errado do plano inteiro.** O caminho curto é relaxar a
> asserção até ela passar. O caminho certo é trocar **o casamento** e manter a asserção: 54 linhas
> idênticas célula a célula, uma divergência nomeada. Se depois da T-627 o âncora aceitar 50 de 55, a
> tarefa foi feita errado e o projeto perdeu a rede que tem desde a ESPEC 001.

**Tamanho:** M — meio dia.

---

### F4 — A API e a tela

**Objetivo:** a ordenação chegar à borda, com `PROPOSTA` como padrão.

| # | Tarefa | Ref. |
|---|---|---|
| T-632 | `POST /reports` ganha o campo de formulário `ordenacao`, opcional, padrão `proposta` | `R-ORD-06`, D-06 |
| T-633 | Valor inválido devolve **422 com mensagem**, nunca silêncio nem `PROPOSTA` por engano | §9.2 da espec |
| T-634 | Teste de API: ausência do campo ⇒ `proposta`; `grc` ⇒ a ordem antiga; valor inválido ⇒ 422 | §9.2 |
| T-635 | Teste de API: `len(secoes) == 16` e 36 linhas divergentes **nas duas ordenações** — a ordem muda, a contagem não | §5.3 |
| T-636 | `lib/types.ts` e `api.ts`: o campo novo no envio | §7 |
| T-637 | Seletor de ordenação no `UploadForm`, com `proposta` pré-selecionada, rótulo e `<fieldset>` acessível | ESPEC 008 `R-ACE-05` |
| T-638 | E2E: o grid sai na mesma ordem do `.docx` baixado — a correspondência que a `R-UI-01` sustenta | §10 da espec |

**Verificação:** T-634 e T-635 verdes; `axe` verde no estado `pronto` com o controle novo.

**Tamanho:** M — meio dia.

---

### F5 — Verificação do conjunto `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-639 | **Âncora da análise intacto** — `test_anchor_analise.py` sem uma linha alterada. Se quebrar, a mudança vazou. Ver §6.1 | **P4** |
| T-640 | 365 testes mais os novos verdes; `tsc --noEmit` e `next build` limpos | **P4** |
| T-641 | `axe` verde nos quatro estados; nova linha de base de captura com `scripts/capturar-baseline.mjs` | ESPEC 008 §9.2 |
| T-642 | **[insumo L-01]** Abrir o `.docx` no Word: conferir as páginas 2 a 4 na ordem da §5.1, as faixas da §5.3, e que nenhuma faixa ficou órfã no pé de página | **P4** |
| T-643 | Conferir que os **19 anexos** seguem intactos, na ordem de `anexos.json` | §9.3 da espec |

**Verificação:** os cinco critérios de P4.

**Tamanho:** P — três horas. **Encerra:** P4.

---

### F6 — Documentação

| # | Tarefa |
|---|---|
| T-644 | **ESPEC 011:** status → implementada; §5 confirmada com o documento gerado; §12 com os pontos que a execução respondeu |
| T-645 | **ESPEC 001:** registrar que a ordem de exibição deixou de vir só do catálogo — `R-CAT-01` ganha a ressalva de `R-ORD-01` |
| T-646 | **ESPEC 003:** §8 — o critério de aceite do teste-âncora, com o casamento por código |
| T-647 | **CHANGELOG:** a mudança de rumo. Não é a funcionalidade — é o **gabarito de ordem trocando de documento**, três incrementos depois de o GRC ter sido eleito autoridade |
| T-648 | README: a opção de ordenação e o que ela significa para quem confere |
| T-649 | TASKS 011 com o resultado e os desvios |

**Tamanho:** P — duas horas.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3 ──┐
   P0     P1        P3    ├──► F5 ──► F6
          P2    F4 ───────┘    P4
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | 2 a 3 dias |
| 2 desenvolvedores | 2 dias — F4 em paralelo com F3 |

**F3 e F4 tocam arquivos disjuntos** — `tests/` contra `api/` e `frontend/` — e dependem só do que a
F2 entrega. É a única paralelização útil: F0 é pré-requisito de tudo, e a F5 precisa das duas pontas.

Não há como paralelizar F1 e F2: a regra das faixas depende da ordem já estar decidida, porque
contiguidade é propriedade **da ordem**.

---

## 5. A regressão que já está escrita

Aqui é onde este plano mais pode se enganar sozinho. A ESPEC 011 §7 promete que o renderizador não é
tocado — e é verdade —, e daí é fácil concluir que os testes de documento sobrevivem. Sobrevivem
quase todos. Os que quebram foram lidos no repositório, não presumidos.

### 5.1 O âncora quebra em **dois** lugares, não em um

A ESPEC 011 §9.1 mostra a asserção de ordem trocando de gabarito. Ela não é a única:

```python
# test_anchor_fidelity.py:109
diferentes = [(n, m) for n, m in zip(nosso, modelo, strict=True) if n != m]
```

Este `zip` casa **por posição**. Medido: 41 das 55 posições passam a ter código diferente. O teste
não falharia por uma linha errada — falharia por 41, e a mensagem de erro seria ilegível.

É a diferença entre *"a ordem está diferente"* e *"o conteúdo está errado"*, duas falhas que hoje o
mesmo `assert` confunde porque nunca precisou distingui-las. A T-627 e a T-628 as separam, e a T-629
garante que a separação não afrouxou o teste: **55 pares, sem sobra dos dois lados.**

### 5.2 O teste cujo nome é a regra que está sendo trocada

`tests/test_reconciliation.py`:

```python
def test_ordem_das_linhas_segue_o_catalogo(resultado):
    """Na seção B o modelo lista 11.051 antes de 11.027, invertendo contrato e planilha."""
    primeiros = [str(linha.codigo) for linha in resultado.relatorio.linhas[:2]]
    assert primeiros == ["11.051.00012.00", "11.027.00001.00"]
```

**O docstring descreve exatamente a inversão que esta espec desfaz** — e diz, com todas as letras, que
o catálogo inverte contrato e planilha. Era a intenção documentada; deixa de ser.

Apagar o teste seria perder a única asserção direta sobre origem de ordem no projeto. A T-630 o
parametriza pelas duas ordenações: `GRC` continua afirmando `11.051` antes de `11.027`, `PROPOSTA`
afirma o inverso. O teste passa a provar **as duas** regras em vez de uma.

### 5.3 O que **não** quebra, e é bom saber por quê

| Asserção existente | Sobrevive? | Por quê |
|---|---|---|
| `test_docx_estrutura.py` inteiro | **Sim** | Roda sobre `relatorio_vazio` — sem seções, sem linhas, sem ordem |
| `test_docx_formatacao.py` — lavanda em **55** células | **Sim** | Lavanda marca a coluna de medida de cada **item**. São 55 itens antes e depois; as faixas que somem não são itens |
| `test_docx_formatacao.py` — larguras, grade, `tblLayout` | **Sim** | Iteram sobre as tabelas de 5 colunas sem contar fileiras. As faixas somem de dentro de duas tabelas, não somem tabelas |
| `test_docx_formatacao.py` — navy do bloco de rótulo | **Sim** | Roda sobre `tables[0]`, o bloco de título, que esta espec não toca |
| `test_docx_anexos.py` | **Sim** | Os 19 anexos vêm de `anexos.json` e a proposta não os menciona |
| `test_default_catalog.py` · `test_catalog_seed.py` | **Sim** | `R-ORD-07`: o catálogo não é reordenado |
| `test_api_e2e.py` — `len(secoes) == 16`, 36 linhas | **Sim** | `apenas_divergencias()` filtra as mesmas seções, na ordem nova. Muda a ordem, não o conjunto |
| `test_domain.py` · `test_divergences.py` | **Sim** | Dado construído no próprio teste |
| `smoke.spec.ts` — `B - SERVIÇOS DE REDES E CONECTIVIDADES` visível | **Sim** | `B` continua sendo a primeira seção nas duas ordens |
| `a11y-estrutura.spec.ts` — `[id^="secao-"]` | **Sim** | Pega a primeira seção genericamente, sem código gravado |
| **`test_anchor_analise.py`** | **Sim** | Por construção, e vale explicar — §6.1 |

### 5.4 O caminho que o piloto não percorre

Três regras deste incremento **não são acionadas pelos arquivos reais**, e é a mesma limitação que o
README registra como insumo `I-05`:

| Regra | Por que o piloto não a aciona |
|---|---|
| `R-ORD-05`, ramo "não contíguo" | ESPEC 011 §2.4 mediu: as 22 seções ficam contíguas. O ramo que **não** emite a faixa nunca roda |
| `V-ORD-01` | Mesma razão |
| `R-ORD-08` / `V-ORD-02` | ESPEC 011 §2.3 mediu: as 55 linhas têm todas correspondência. O caminho do item órfão nunca roda |

As três descrevem comportamento que só existe para o dia em que um aditivo mudar o par
catálogo + contrato — que é precisamente o dia em que ninguém estará olhando.

Daí T-621 e T-624 usarem caso **construído**, e não amostrado. É a mesma escolha da T-553 do PLANO 009
e da T-302 do PLANO 004: quando o dado real não cobre o caminho, o caminho se cobre com dado feito
para isso — não se declara coberto.

---

## 6. Três acertos à ESPEC 011

Três afirmações da espec não sobrevivem ao contato com o repositório, ou sobrevivem por razão
diferente da que ela dá. Registro em vez de contornar, seguindo a conduta do PLANO 009 §6.

### 6.1 O âncora da análise sobrevive — mas não pelo motivo que a espec sugere

A ESPEC 011 §9.3 afirma que `test_anchor_analise.py` passa sem alteração. **Passa**, e a razão é mais
específica do que "a classificação não muda": está em `tests/leitura_analise.py`.

```python
def _chavear(itens): ...          # chave (código, ocorrência)
for chave, (...) in sorted(de_referencia.items()): ...
```

O comparador **chaveia por código e ordena a própria iteração**. Ele é indiferente à ordem das listas
que recebe, por construção — e foi escrito assim para outro problema, o do código repetido.

Há um detalhe que a espec não viu e que vale registrar: sob a ordem da proposta, a **ocorrência 0** de
`14.025.00011.00` deixa de ser `IT0101` e passa a ser `SG0721`. O comparador não percebe porque `Item`
carrega só `(código, contratado, medido)` e as duas linhas são `1/1`.

> **Fica registrado como fragilidade latente:** no dia em que as duas linhas de `14.025.00011.00`
> tiverem quantidades diferentes, uma reordenação passa a quebrar o âncora da análise sem que nada de
> errado tenha acontecido. Não é problema deste incremento e não vale corrigir agora — vale estar
> escrito, para que a falha futura seja reconhecida em vez de investigada do zero.

### 6.2 A espec listou uma regressão; são **três**

A §9 da ESPEC 011 trata da asserção de ordem do âncora. O repositório tem três testes que a mudança
reprova, e a espec só previu um:

| Onde | Previsto na espec? |
|---|---|
| `test_anchor_fidelity.py` — asserção de ordem | ✅ §9.1 |
| **`test_anchor_fidelity.py` — `zip(..., strict=True)` posicional** | ❌ §5.1 |
| **`test_reconciliation.py::test_ordem_das_linhas_segue_o_catalogo`** | ❌ §5.2 |

As duas não previstas estão **a uma camada de distância** do que a espec olhou: uma é o mecanismo de
comparação do mesmo teste, a outra é uma asserção de reconciliação que ninguém associaria a
"documento". A lição repete a do PLANO 009 §10.2: **quando uma ordem muda, procurar também quem
afirma a ordem indiretamente** — por índice, por `zip`, por fatia.

### 6.3 A espec não disse **onde** a regra das faixas mora, e o lugar não é óbvio

A ESPEC 011 §7 põe "emissão de faixas por contiguidade" em `application/use_cases/`, e D-04 promete
que o renderizador não é tocado. As duas coisas juntas determinam o desenho, mas a espec não o
explicita — e o desenho errado é o mais natural de escrever.

Hoje a faixa é emitida por `DocxRenderer._bloco_secao`, que testa `secao.grupo_titulo`:

```python
faixas = [t for t in (secao.grupo_titulo, secao.secao_titulo) if t]
```

O renderizador não decide nada: ele imprime o que o agregado traz. Segue daí que **a regra tem de
apagar `grupo_titulo` nas seções que não lideram bloco contíguo**, na montagem do agregado. É o que a
T-617 faz, e tem três consequências que o caminho alternativo não teria:

1. **`R-ORD-05` fica testável sem gerar documento** — é asserção sobre `ReportSection`, não sobre XML.
2. **A tela acompanha de graça.** O grid da ESPEC 002 lê o mesmo `grupo_titulo`; a faixa some da tela
   e do documento pela mesma linha de código, e a §10 da espec continua verdadeira.
3. **O renderizador continua burro**, que é o que D-04 comprou.

O caminho alternativo — ensinar a regra ao `DocxRenderer` — quebraria as três: exigiria gerar um
`.docx` para testar contiguidade, deixaria a tela com faixas que o documento não tem, e colocaria
lógica de ordenação no adaptador.

---

## 7. O que pode dar errado, e o que pega

| O que pode dar errado | O que pega | Quando |
|---|---|---|
| **Gravar os 55 códigos à mão no teste** e provar que a implementação é igual a si mesma | **T-603 e T-605.** O instrumento lê o PDF por caminho próprio, e os dois caminhos são conferidos uma vez | F0 |
| **Perder o "antes" e não poder mais provar `R-ORD-07`** | **T-601, primeira tarefa do plano.** Depois da F1 não há como produzir o artefato | F0 |
| Ordenar por valor de código em vez de posição — e inverter `SG0721`/`IT0101` | T-608 e T-612, com o par explícito | F1 |
| `TypeError` na geração por chave `None` de item fora da proposta | T-610 e T-611 | F1 |
| A regra de faixas acertar a ordem nova e errar a antiga | **T-620.** O hash da T-616 diria "mudou", não "mudou a faixa `E5`" | F2 |
| **Afrouxar o âncora para ele passar** | **Nada automático.** T-629 exige 55 pares sem sobra, mas quem escreve a T-627 pode relaxar a asserção. **É revisão de código, não teste** | F3 |
| O âncora da análise quebrar | T-639 — mas ele **não deve** quebrar (§6.1). Se quebrar, a mudança vazou para onde não devia | F5 |
| Uma faixa órfã no pé da página, sem linha embaixo | **Nada automático.** `R-ORD-05` garante a faixa certa, não a paginação. **T-642, no Word, por pessoa** | F5 |
| A numeração fora de sequência ser recusada em revisão | **Nada automático.** É o ponto 1 da §12 da espec, e o insumo `L-02` | F5 |
| Os anexos entrarem na reordenação | T-643. Eles vêm de `anexos.json` e não passam pelo catálogo | F5 |
| A opção `GRC` apodrecer | T-616 e T-620, na suíte. Quebra o build, não o usuário | F1, F2 |

As três linhas de "nada automático" são as caras de descobrir tarde, e **duas delas são de revisão
humana, não de cobertura**. A do âncora afrouxado é a pior: um teste relaxado não falha nunca mais, e
o projeto perde a rede sem que apareça um sinal vermelho em lugar nenhum.

---

## 8. Insumos

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **L-01** | **Aceite do documento aberto no Word** — páginas 2 a 4 na ordem nova, faixas nos lugares da §5.3 | T-642 | **P4 não fecha.** É a única verificação de que a ordem nova é legível em papel |
| **L-02** | **Resposta ao ponto 1 da ESPEC 011 §12** — a numeração fora de sequência (`C2` antes de `C1`) é aceitável? | F5 | Não bloqueia F0–F4. Bloqueia a entrega: se a resposta for "renumerar", é espec nova |
| **L-03** | **Resposta ao ponto 2 da §12** — as faixas `E2` e `E5` podem sumir? | T-617 | Bloqueia a F2. É o único insumo que, respondido ao contrário, **muda o desenho** e não só um rótulo |
| **L-04** | Decisão sobre o seletor na tela (§12, ponto 5) | T-637 | Não bloqueia. Sem ele, `PROPOSTA` fica fixo e a F4 encolhe para o campo de API |

`L-03` é o que merece ser perguntado **antes da F2**, e não durante. Se as faixas `E2` e `E5` forem
consideradas essenciais, a saída é agrupar por elas antes de ordenar pela proposta — o que
reintroduz parte da ordem do GRC e é decisão de negócio, não de implementação.

---

## 9. O que este plano não faz

- **Não toca o renderizador.** Nenhuma linha de `docx_renderer.py`, `layout.py`, `modelo.py` ou
  `ooxml.py`. D-04 é o que sustenta a estimativa de 2 a 3 dias, e a T-616 é quem cobra.
- **Não reordena o catálogo.** `R-ORD-07`. É o que faz a ordenação `GRC` continuar existindo sem uma
  segunda fonte de dados.
- **Não toca os 19 anexos.** Eles seguem na ordem das páginas 4 a 41 do GRC, declarada em
  `anexos.json`, e a proposta não os menciona.
- **Não renumera as seções.** `C2` continua se chamando `C2` mesmo aparecendo antes de `C1`. O rótulo
  é o vínculo com o GRC e com a tela — ESPEC 011 §12, ponto 1.
- **Não altera a reconciliação, a classificação nem as quantidades.** Ordenar não reclassifica: as
  quatro situações da ESPEC 009 continuam com 1 / 20 / 16 / 19.
- **Não resolve a paginação.** A tabela continua ocupando as páginas 2 a 4 onde o GRC usa 2 e 3
  (ESPEC 011 §2.7). Não é objeto desta espec.
- **Não resolve o `I-01`.** O `11.027.00001.00` continua saindo com 10, e a divergência continua
  declarada nos dois âncoras.
- **Não abandona o GRC como gabarito de conteúdo.** Só a **ordem** troca de autoridade. A comparação
  célula a célula das 55 linhas continua sendo contra o relatório de referência, e é justamente a T-627
  que a preserva.
