# ESPEC 024 — O asterisco que explica o bloco final

| | |
|---|---|
| **Status** | **Implementada** — 2026-08-18. Portões `P0`, `P1` e `P2` fechados. Backend 556 → **559**, suíte verde. Um desvio de plano, registrado no [TASKS 024 §6.1](../tasks/024-tasks-o-asterisco-que-explica-o-bloco-final.md) |
| **Versão** | 1.1 — 2026-08-19. Correção em `R-NOT-02`: a frase da nota nascera **sem** o `*` inicial, e o defeito foi implementado como escrito — o título remetia a uma nota sem marcador. Texto, `layout.NOTA_DEMAIS_ITENS` e o teste de `R-NOT-02` corrigidos juntos<br>1.0 — 2026-08-18 |
| **Depende de** | [ESPEC 018](018-o-relatorio-segue-o-contrato.md) `D-06` — implementada |
| **Revisa** | Nada. É aditiva ao bloco final da ESPEC 018: acompanha o título neutro de uma explicação, sem tocar em quando ele aparece ou no que ele contém |
| **Não toca** | `Contract.posicao_de`, `Contract.aplicar` e qualquer regra de quais códigos entram em `demais_itens` (ESPEC 018 / 022). Esta espec muda **apresentação**, não **critério** |
| **Referência normativa** | `backend/tests/fixtures/contrato.pdf` + `levantamento.xlsx` (piloto — 4 itens no bloco final, ESPEC 018 §8.5) |
| **Origem** | Conversa sobre por que `DEMAIS ITENS DO LEVANTAMENTO` aparece no relatório. Entre duas alternativas de tornar isso explícito ao leitor — nota inline sempre visível, ou asterisco no título com a mesma frase como nota geral do documento —, a segunda foi a escolhida: *"um asterisco no título (…) com a mesma frase como nota de rodapé geral do documento — funciona melhor se este bloco aparecer raramente e você não quiser 'gastar' espaço vertical toda vez que ele aparecer"* |

---

## 1. Problema

O bloco final existe desde a ESPEC 018 `D-06`: item que a aba `Levantamento` traz e cujo código
não tem posição no contrato consolidado (proposta mais aditivos, ESPEC 022) sai sob o título
`DEMAIS ITENS DO LEVANTAMENTO`, em vez de ser omitido.

O título foi escrito **neutro** de propósito — a ausência pode ser do contrato submetido ou da
extração do PDF, e a aplicação não tem elementos para distinguir as duas. Essa neutralidade é
correta e não é o problema.

O problema é que ela é **muda**. Quem lê o documento sem conhecer o sistema — o caso comum, já
que ele vai ao órgão — não tem como saber que "demais itens" significa especificamente *"código
sem correspondência na tabela de itens do contrato analisado"*, nem por que a "Quantidade
Contratada" de um item ali pode aparecer como `0` mesmo quando a aba o trata como contratado.

## 2. O que foi levantado no código

### 2.1 O texto de hoje

`layout.TITULO_DEMAIS_ITENS` ([layout.py:85](../../backend/src/infrastructure/report/layout.py#L85))
é a string fixa `"DEMAIS ITENS DO LEVANTAMENTO"`, escrita por `_bloco_de_linhas`
([docx_renderer.py:351-356](../../backend/src/infrastructure/report/docx_renderer.py#L351-L356))
numa única linha mesclada, sombreada em `layout.NAVY`, com o mesmo padrão visual do cabeçalho de
seção. Nenhum teste hoje verifica o texto literal dessa faixa — os testes de formatação verificam
cor e largura, não conteúdo (`test_docx_formatacao.py`).

### 2.2 Por que a explicação não cabe **dentro** da faixa do título

`ALTURA_LINHA` e `LARGURAS_COLUNAS_DOCX` são medidas fixas, tiradas do documento modelo por
`pdfplumber` (docstring de `layout.py`). A faixa do título é uma linha de tabela como qualquer
outra, com altura fixada por `ooxml.altura_fixa`. Um texto explicativo mais longo do que o título
atual arriscaria quebra de linha dentro de uma altura que não foi dimensionada para isso.

### 2.3 Onde uma frase livre já cabe, sem medida a violar

`_rodape` ([docx_renderer.py:634-655](../../backend/src/infrastructure/report/docx_renderer.py#L634-L655))
escreve, depois do bloco final e antes dos anexos, um parágrafo de corpo livre — não uma célula de
tabela — com o contrato e a proposta de origem. É texto fora da grade medida, no mesmo corpo de
fonte do documento (`layout.CORPO_FONTE`, `layout.FONTE_REGULAR`). É o único lugar do documento
que já é "nota geral", e é imediatamente adjacente ao bloco que esta espec quer explicar.

### 2.4 Isto não compete com a fidelidade ao modelo

`layout.py` declara reproduzir o documento de referência como critério de aceite. Isso não se
aplica ao bloco final: ele **não existe** no modelo GRC original — é conteúdo que a própria
ESPEC 018 `D-06` acrescentou. Uma nota sobre um bloco que já é acréscimo não abre precedente novo
de divergência do modelo.

## 3. Objetivo

Que o asterisco no título do bloco final leve a quem lê até uma frase, uma vez no documento, que
diz o que ele significa — sem ocupar espaço quando o bloco não existe, e sem competir com as
medidas fixas da tabela.

**Não é objetivo:** mudar quais códigos entram no bloco, mudar as quantidades exibidas, ou criar
nota de rodapé nativa do Word (numerada, por página). `python-docx` não expõe API para isso, e o
ganho sobre um parágrafo de corpo — que já resolve o problema — não paga o custo de manipular XML
bruto do OOXML para uma frase.

## 4. Escopo

### 4.1 Dentro do escopo

- O título do bloco final ganha um asterisco quando o bloco existe.
- Uma frase, no mesmo padrão tipográfico do rodapé, explicando o asterisco — condicionada à
  existência do bloco.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| XLSX de análise | Não tem bloco final equivalente; fora do pedido de origem |
| Manual de utilização | Hoje não menciona o bloco final em nenhuma linha — é lacuna anterior a esta espec, registrada em `I-02`, não corrigida aqui |
| Nota de rodapé nativa do Word | §3 — custo desproporcional ao ganho |
| Qualquer regra de `posicao_de` / `aplicar` | Critério de pertencimento ao bloco é decisão de negócio já fechada (ESPEC 018/022) |

## 5. Regras

| ID | Regra |
|---|---|
| `R-NOT-01` | Quando `relatorio.demais_itens` não é vazio, o título do bloco final é `"DEMAIS ITENS DO LEVANTAMENTO*"` |
| `R-NOT-02` | Nesse mesmo caso, o documento traz — uma vez, junto ao rodapé — a frase: *"\*Itens presentes na aba de levantamento sem código correspondente na tabela de itens do contrato analisado."* O `*` inicial é obrigatório: é ele que fecha o par com o asterisco de `R-NOT-01`. Sem o marcador, a faixa aponta para uma nota que nada identifica como nota |
| `R-NOT-03` | Quando `relatorio.demais_itens` é vazio, nem o asterisco nem a frase aparecem. O caso sem bloco final permanece idêntico ao de hoje |
| `R-NOT-04` | A frase usa o corpo e a fonte do rodapé institucional (`layout.CORPO_FONTE`, `layout.FONTE_REGULAR`), sem cor nova e sem negrito — para não competir visualmente com as faixas de seção |
| `R-NOT-05` | O texto da frase não atribui a ausência ao contrato nem à extração do PDF. Mantém a neutralidade da ESPEC 018 `D-06` — explica o mecanismo, não julga a causa |
| `R-NOT-06` | Nada muda em `Contract.posicao_de`, `Contract.aplicar`, nas quantidades de `ReportLine` ou no XLSX de análise |

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **Asterisco + frase junto ao rodapé**, e não subtítulo dentro da faixa do título | §2.2 — a faixa tem altura e largura medidas do modelo, sem folga para prosa. Um parágrafo livre não tem essa restrição |
| `D-02` | **A frase fica junto de `_rodape`**, não logo depois da tabela do bloco final | É o único lugar do documento que já é "nota geral" (§2.3), e mantém uma frase de metainformação por seção, em vez de duas |
| `D-03` | **Não é nota de rodapé nativa do Word** | `python-docx` não tem API para isso; implementar via XML bruto custaria desproporcionalmente mais do que uma frase condicional resolve |
| `D-04` | **A frase é condicional à existência do bloco** (`R-NOT-03`), e não fixa no rodapé | Um texto permanente sobre um bloco que não existe naquele documento seria ruído — mesmo raciocínio da `R-PER-10` da ESPEC 021: nada aparece quando não há o que explicar |
| `D-05` | **O texto não julga a causa da ausência** | Continuação direta de `D-06` da ESPEC 018: o sistema não sabe se é o contrato ou o PDF, e uma frase mais específica arriscaria afirmar o que não pode |

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `infrastructure/report/layout.py` | `TITULO_DEMAIS_ITENS` ganha o `"*"` (ou uma constante `NOTA_DEMAIS_ITENS` nova, com o texto de `R-NOT-02`, ao lado da existente) |
| `infrastructure/report/docx_renderer.py` | `_rodape` (ou um método adjacente chamado por `_gerar`) escreve a frase de `R-NOT-02` quando `relatorio.demais_itens` não é vazio |
| `domain/entities/report.py` | Nenhuma — `demais_itens` já existe como dado |
| `application/use_cases/generate_measurement_report.py` | Nenhuma |
| `api/schemas.py` · `routers/reports.py` | Nenhuma — é texto fixo do `.docx`, não campo de resposta |
| `infrastructure/report/xlsx_*` (análise) | Nenhuma (§4.2) |

## 8. Testes e critério de aceite

| Regra | Verificação |
|---|---|
| `R-NOT-01` | Par piloto (4 itens no bloco final): título da faixa do bloco final termina em `"*"` |
| `R-NOT-02` | Par piloto: a frase aparece uma vez no `.docx`, em texto de corpo (não em célula de tabela), **com o `*` inicial** — comparada por igualdade contra a cadeia literal completa. Nenhum teste podia ter pego a ausência do `*` até a v1.1: todos afirmavam contra a mesma cadeia errada, e a defesa aqui é a revisão do literal na espec, não cobertura (TASKS 024 §6.5) |
| `R-NOT-03` | Cenário construído no teste com todos os códigos do levantamento presentes no contrato consolidado: nem `"*"` nem a frase aparecem — o rodapé fica idêntico ao de hoje |
| `R-NOT-04` | O `run` da frase usa `layout.CORPO_FONTE` e `layout.FONTE_REGULAR`, sem negrito e sem cor além da cor de corpo padrão |
| Regressão | `test_docx_formatacao.py` e `test_docx_estrutura.py` continuam verdes sem alteração — nenhuma medida de faixa, cor ou largura muda |

## 9. Riscos

| Risco | Mitigação |
|---|---|
| A frase e o asterisco caírem em páginas diferentes num documento paginado | Aceito: é o custo já declarado da alternativa "mais leve" na origem desta espec, escolhida em vez da nota sempre visível junto ao título |
| A frase aparecer também quando não há bloco final | `R-NOT-03` e o teste dedicado — é a regressão mais provável de "simplificar" a condicional |
| Alguém esperar nota de rodapé de página (numerada, ao pé de cada página) | O texto do pedido de origem já chama isso de "nota de rodapé **geral do documento**" — é a frase do rodapé institucional, não a funcionalidade nativa do Word (`D-03`) |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | Se o bloco final se mostrar comum em algum órgão (não uma exceção rara), vale reconsiderar a nota inline sempre visível, descartada nesta espec por ser mais pesada? | Não. Decide-se com uso real, não agora |
| `I-02` | O manual de utilização não menciona o bloco final em nenhuma linha hoje. Deveria passar a mencionar, já que ele ganha uma frase própria no documento? | Não. É lacuna anterior a esta espec e maior que ela |

## 11. Relação com a ESPEC 018

`D-06` decidiu o título neutro e a existência do bloco. Esta espec não reabre nem afirma o que
aquela decisão deixou em aberto — só acompanha o mesmo texto neutro de uma frase que diz o
mecanismo, no lugar que o documento já reserva para metainformação.

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Constante(s) em `layout.py` | PP |
| B | Condicional em `_rodape` (ou método adjacente) no `docx_renderer.py` | PP |
| C | Testes de `R-NOT-01` a `R-NOT-04` e o cenário sem bloco final | P |

**Estimativa: menos de um dia.** Não há regra de negócio nova, nem leitura adicional de arquivo,
nem campo novo de API — só texto condicional num documento que já sabe montar texto condicional.