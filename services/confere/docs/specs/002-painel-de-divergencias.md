# ESPEC 002 — Grid de Divergências

| | |
|---|---|
| **Status** | **Implementada** — 2026-08-05 |
| **Versão** | 2.1 — 2026-08-05 |
| **Depende de** | [ESPEC 001](001-mvp-analise-medicao.md) — implementada |

---

## 1. Problema

O MVP entrega um PDF com 55 linhas. O documento é fiel ao relatório de comprovação e instrui o
faturamento — mas **não responde à pergunta seguinte**: onde o contratado e o medido não bateram.

Hoje essa leitura é feita percorrendo as 55 linhas do PDF com o olho. É o mesmo trabalho manual que
o MVP eliminou na montagem da tabela, sobrevivendo na etapa seguinte.

**Os dados já existem.** A reconciliação da ESPEC 001 produz cada linha com quantidade contratada e
medida; falta apenas filtrar e exibir.

---

## 2. Objetivo

Após gerar o relatório, exibir na tela um grid **com a mesma aparência do relatório**, contendo
apenas os itens em que a quantidade contratada difere da medida.

O PDF continua sendo o entregável formal, íntegro e inalterado. O grid é a leitura de trabalho.

### Números do caso-piloto

Contrato TC 52/SMIT/2024, competência de julho/2026:

| | Itens |
|---|---|
| Total no relatório | 55 |
| **Com divergência — exibidos no grid** | **36** |
| Sem divergência — ocultos | 19 |

---

## 3. Escopo

### 3.1 Dentro do escopo

- Grid com as cinco colunas do relatório — Código, Descrição, Unidade, Quantidade Contratada e
  Quantidade Medida — mais uma sexta, **Saldo**, que não existe no relatório.
- Título **"Divergências"** identificando o grid.
- Exibição apenas dos itens em que `contratada ≠ medida`.
- Agrupamento por seção, igual ao do relatório.
- Exposição das linhas na resposta da API, junto com o PDF.

### 3.2 Fora do escopo

| Item | Motivo |
|---|---|
| Coluna de percentual | Saldo e proporção contam histórias diferentes: a SAN tem o maior saldo absoluto (2.737) e o perfil de correio a maior proporção (84%). A proporção pode ser acrescentada depois, se a leitura pedir |
| Classificação por categoria | Idem. A divergência é binária: ou bate, ou não |
| Exportar em Excel ou CSV | O PDF é o entregável formal |
| Alterar o PDF | O critério de aceite da ESPEC 001 é reproduzir o documento atual. O teste-âncora protege isso |
| Histórico entre competências | Depende de persistência, que a ESPEC 001 §7.2 excluiu |

---

## 4. Regras

| ID | Regra |
|---|---|
| `R-DIV-01` | Uma linha entra no grid quando `quantidade contratada ≠ quantidade medida`. A comparação é entre os valores decimais, não entre os textos formatados |
| `R-DIV-02` | As cinco primeiras colunas são as do relatório, com **o mesmo conteúdo e a mesma formatação** — inclusive `MILHAR` e `SIMPLES` por item (`R-MED-04`). Uma linha do grid tem de ser reconhecível ao lado da mesma linha no PDF |
| `R-DIV-08` | **Saldo** é a sexta coluna: `quantidade contratada − quantidade medida`, na mesma formatação do item. É a única coluna que não existe no relatório, e existe porque a subtração é o que o analista faz de cabeça ao ler cada linha |
| `R-DIV-09` | O saldo é **negativo** quando o medido supera o contratado. O sinal é preservado e destacado: saldo negativo significa consumo acima do contratado, o achado de maior consequência. No bloco de itens sem previsão contratual todo saldo é negativo, por construção |
| `R-DIV-03` | As linhas mantêm o agrupamento por seção e a ordem do relatório. Seções que ficarem sem linha divergente **não aparecem** |
| `R-DIV-04` | Itens de perfil ou pacote entram como `1/1` (`R-REC-04`) e portanto nunca divergem. A tela **sinaliza** essa condição, porque o banco de dados contratado no perfil D e medido no perfil C aparece como se não houvesse diferença (ESPEC 001 §9.3) |
| `R-DIV-05` | **O grid exibe o que foi medido e não tem contrapartida no relatório**, em bloco próprio ao final. Duas situações levam a isso: o código está no catálogo com quantidade contratada zero, e `R-REC-01` o mantém fora do PDF; ou o código **não existe no contrato** e por isso não tem entrada de catálogo nenhuma. Só entram itens com medição maior que zero — ver §5 |
| `R-DIV-06` | O grid não altera o PDF, em conteúdo nem em layout |

### 5. Itens medidos sem previsão contratual

`R-REC-01` omite do relatório os itens com quantidade contratada zero, reproduzindo o modelo. No
caso-piloto isso esconde `14.049.00054.00` — **medido 2 e ausente do contrato**.

Verificado na implementação: o item não está apenas com quantidade zero, ele **não consta da tabela
de itens do contrato**. Foi medido sem qualquer cobertura contratual — o achado de maior
consequência possível numa conferência, e o que o relatório modelo esconde por construção.

O grid o exibe em bloco separado, ao final, com o rótulo:

> ⚠ N item(ns) medido(s) sem previsão contratual — não constam no Contrato

Não entra no PDF: o critério de aceite da ESPEC 001 permanece intacto. Isso resolve a limitação
registrada em ESPEC 001 §9.2 sem tocar no documento formal.

**Ressalva do rótulo.** A regra cobre duas situações, e o texto é exato para a segunda — a única
que ocorre no piloto. Se um dia entrar um item da primeira situação (código presente no contrato,
mas com quantidade contratada zero), o rótulo ficará impreciso: o item *consta* do contrato, com
quantidade zero. Nesse caso o bloco deve ser dividido em dois, com rótulos próprios.

---

## 6. Contrato da API

> **Superado em parte pela [ESPEC 003](003-relatorio-em-docx.md):** o campo `pdf_base64` passou a
> `docx_base64` e o entregável deixou de ser PDF. A forma da resposta — grid mais documento
> embutido — permanece como descrita aqui.

`POST /reports` passa a devolver **JSON** com as linhas divergentes e o documento embutido:

```jsonc
{
  "titulo": "LEVANTAMENTO - COMPROVAÇÃO SMIT SUSTENTAÇÃO - CATÁLOGO DE SERVIÇOS DIT",
  "data_levantamento": "15/07/2026",
  "contrato_referencia": "TC 52/SMIT/2024",
  "total_linhas": 55,
  "total_divergencias": 36,
  "secoes": [
    {
      "grupo_titulo": "",
      "secao_titulo": "B - SERVIÇOS DE REDES E CONECTIVIDADES",
      "linhas": [
        {
          "codigo": "11.051.00012.00",
          "descricao": "CONSULTORIA TÉCNICA - INFRAESTRUTURA DE REDE",
          "unidade": "HORA/HOMEM",
          "contratada": "100",
          "medida": "0",
          "saldo": "100",
          "perfil_ou_pacote": false
        }
      ]
    }
  ],
  "sem_previsao_contratual": [ /* mesma forma das linhas, ver §5 */ ],
  "avisos": [ /* achados de severidade AVISA, como hoje */ ],
  "pdf_base64": "JVBERi0xLjQK..."   // renomeado para `docx_base64` pela ESPEC 003
}
```

**Por que o PDF vai embutido.** A aplicação é sem estado (ESPEC 001 §7.2), então não há onde guardar
o PDF entre duas chamadas. As alternativas seriam processar duas vezes — o dobro do custo pelo mesmo
resultado — ou introduzir cache com identificador, o que traria estado de volta. O PDF do piloto tem
~70 KB, que em base64 viram ~93 KB: irrelevante para uma operação mensal.

`R-DIV-10` — A resposta de bloqueio permanece como está: achado bloqueante devolve `422` com os
achados e **nenhum PDF, nenhuma linha**.

**Compatibilidade:** a mudança quebra o contrato atual, que devolvia `application/pdf`. O único
consumidor é o frontend deste repositório e a aplicação não está em produção — versionar a API seria
cerimônia sem beneficiário.

---

## 7. Interface

O grid aparece **junto com o botão de download**, não no lugar dele, e reproduz a estrutura do
relatório: faixa de seção, cabeçalho de colunas, linhas.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Relatório gerado · 36 de 55 itens com divergência      [ Baixar DOCX ]      │
└──────────────────────────────────────────────────────────────────────────────┘

  Divergências
  36 itens em que a quantidade medida difere da contratada

┌ B - SERVIÇOS DE REDES E CONECTIVIDADES ──────────────────────────────────────┐
├─────────────────┬────────────────────────┬────────────┬───────┬───────┬──────┤
│ Código          │ Descrição              │ Unidade    │ Contr.│ Medida│ Saldo│
├─────────────────┼────────────────────────┼────────────┼───────┼───────┼──────┤
│ 11.051.00012.00 │ CONSULTORIA TÉCNICA …  │ HORA/HOMEM │   100 │     0 │  100 │
│ 11.027.00001.00 │ DISPONIBILIZAÇÃO DE …  │ VÁLIDO P…  │    10 │     0 │   10 │
└─────────────────┴────────────────────────┴────────────┴───────┴───────┴──────┘
┌ C2 - GERENCIAMENTO DE COMUNICAÇÃO DE DADOS (SOLUÇÃO: ACESSOS E GESTÃO) ──────┐
├─────────────────┼────────────────────────┼────────────┼───────┼───────┼──────┤
│ 12.029.00080.00 │ GERENCIAMENTO DA SOL…  │ GERENCIA…  │    15 │     0 │   15 │
└─────────────────┴────────────────────────┴────────────┴───────┴───────┴──────┘

⚠ 1 item(ns) medido(s) sem previsão contratual — não constam no Contrato
┌─────────────────┬────────────────────────┬────────────┬───────┬───────┬──────┐
│ 14.049.00054.00 │ HOSPEDAGEM DE APLICA…  │            │     0 │     2 │   -2 │
└─────────────────┴────────────────────────┴────────────┴───────┴───────┴──────┘
```

| ID | Requisito |
|---|---|
| `R-UI-01` | As faixas de seção usam o mesmo navy do relatório, para que a correspondência com o PDF seja imediata |
| `R-UI-02` | Quantidades e saldo alinhados à direita, na formatação do item |
| `R-UI-07` | O grid é identificado pelo título **"Divergências"**, com a contagem logo abaixo. Sem ele, a tabela flutua sem dizer o que é |
| `R-UI-08` | **Saldo negativo é destacado** — consumo acima do contratado é o achado de maior consequência e não pode se confundir com os demais números. O destaque **não é só cromático**: o saldo negativo carrega portador textual acessível (ESPEC 008 `R-ACE-02`) |
| `R-UI-03` | O bloco de "sem previsão contratual" só aparece quando houver itens. O rótulo diz **"não constam no Contrato"** — ver a ressalva em §5 |
| `R-UI-04` | Itens de perfil ou pacote trazem marcação, com a explicação em **legenda visível** junto ao grid (`R-DIV-04`). A explicação não depende de cursor, de foco nem de toque — ver §12 |
| `R-UI-05` | Sem paginação e sem busca: 36 linhas cabem numa rolagem |
| `R-UI-06` | Nenhuma divergência encontrada produz mensagem explícita, não um grid vazio |

---

## 8. Onde o código muda

| Camada | Mudança |
|---|---|
| `domain/` | `ReportLine.tem_divergencia`; `Report.apenas_divergencias()` devolvendo as seções filtradas |
| `application/` | Itens de `R-DIV-05`, hoje descartados na reconciliação, passam a ser coletados |
| `api/` | Resposta JSON com PDF embutido; *schemas* novos |
| `frontend/` | `DivergenciaGrid.tsx` sob `src/app/components/` |

A regra de dependência não muda: o filtro é lógica de domínio e não conhece HTTP.

---

## 9. Testes

| Nível | Cobertura |
|---|---|
| Unitário | `R-DIV-01` nas fronteiras: iguais, medida zero, contratada zero, decimais próximos |
| Domínio | `R-DIV-03` — seção sem linha divergente não aparece |
| Reconciliação | Com o piloto: **36 linhas divergentes de 55**, e 1 item sem previsão contratual |
| API | A resposta traz as seções filtradas e o documento embutido em base64 |
| **Regressão** | **O teste-âncora continua passando** — a prova de que o PDF não mudou |
| Navegador | O grid aparece após a geração e o download continua funcionando |

---

## 10. Riscos

| Risco | Mitigação |
|---|---|
| O grid virar o entregável e o PDF deixar de ser conferido | Nenhuma técnica. Se acontecer, é sinal de que o grid deveria estar no PDF |
| Perfil/pacote nunca diverge, escondendo diferença real de perfil | `R-DIV-04` marca esses itens. A solução completa exige mudar o layout de duas colunas, fora deste escopo |
| Resposta em base64 crescer com PDFs maiores | §6 registra o limite e a saída — cache curto com identificador |

---

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Filtro no domínio, com testes | P |
| B | Itens sem previsão contratual coletados na reconciliação | P |
| C | Resposta da API em JSON com PDF embutido | M |
| D | Grid na tela | M |
| E | Ajuste do teste de navegador | P |

**Total: 1 a 2 dias.** O que torna barato é que a comparação já está pronta e provada: este
incremento não calcula nada novo — filtra e exibe o que a reconciliação já produz.

---

## 12. Revisão pela ESPEC 008 — 2026-08-07

Duas regras da §7 foram revisadas pela [ESPEC 008](008-acessibilidade-da-interacao.md)
§13.1, e o código já reflete a nova redação.

### `R-UI-04` — a explicação saiu do cursor

A redação original era *"com explicação **ao passar o cursor**"*. Ela instituía o
mecanismo, e o mecanismo era o problema: `title` não abre por teclado, não existe em
toque e é lido de forma inconsistente por leitor de tela.

Isso importa mais aqui do que pareceria. `R-DIV-04` criou a marcação porque **um banco de
dados contratado no perfil D e medido no perfil C aparece como se não houvesse
diferença** — é a ressalva que impede concluir "confere" quando não confere. Deixá-la num
mecanismo que boa parte dos usuários nunca aciona era o oposto do que a regra pretendia.

A explicação passou para uma **legenda visível** abaixo do título do grid, exibida uma vez
para todas as linhas. Informação idêntica em todas as linhas não pertence à linha.

### `R-UI-08` — o destaque deixou de ser só cor

O destaque do saldo negativo existia e estava correto; era **exclusivamente cromático**,
o que reprova a WCAG 1.4.1. Ganhou portador textual acessível, sem alteração visual.

### O que **não** mudou

`R-DIV-05` segue intacta: o bloco de itens sem previsão contratual continua em bloco
próprio, com o mesmo critério de entrada e o mesmo rótulo. A ESPEC 008 D-07 mudou apenas
a **posição** — ele passou a vir antes das seções, porque medir o que não foi contratado
é o achado que mais compromete o faturamento e estava depois de 22 seções. A expressão
"ao final" em `R-DIV-05` descrevia arranjo, não requisito.

`R-UI-05` — nenhuma paginação, nenhuma busca — segue intacta e reforçada: a ESPEC 008 §4
recusou filtro e ordenação pelo mesmo motivo.

> **Pendente de aceite.** Estas duas revisões correspondem ao insumo `K-02` do
> [PLANO 008](../plans/008-plano-acessibilidade-da-interacao.md). O código foi entregue
> com a nova redação porque mantê-lo obedecendo à redação antiga significaria manter o
> `title`; se o aceite não vier, é a implementação que volta atrás, não a regra que se
> ajusta ao que foi feito.

---

## 13. Revisão pela ESPEC 010 — 2026-08-10

A `R-UI-01` da §7 foi revisada pela [ESPEC 010](010-cor-das-faixas-do-grid.md) §7, e o
código já reflete a nova redação.

### `R-UI-01` — a correspondência com o PDF é de estrutura, não de cor

A redação original era *"as faixas de seção usam o mesmo navy do relatório, **para que a
correspondência com o PDF seja imediata**"*. A medição da ESPEC 010 §2.1 mostrou que essa
correspondência **nunca foi implementada**: o documento pinta título, cabeçalho e seção com
um único navy `#222854`, enquanto a tela usava dois — `navy-800` na faixa de grupo e
`navy-600` na de seção —, e nenhum dos três é o mesmo valor.

A hierarquia de dois níveis da tela, aliás, **não existe no documento** e é invenção
correta: em papel a página inteira está à vista; na tela a seção rola sozinha e precisa
dizer a que grupo pertence.

A nova redação diz o que de fato sustenta a conferência linha a linha — mesma ordem de
grupos e seções, mesmos títulos, mesmas seis colunas. As faixas passaram a `teal-700` e
`teal-500`, a paleta da própria aplicação.

### O que **não** mudou

Nada além da cor. Ordem, agrupamento, rótulos, colunas e o bloco de `R-DIV-05` estão
intactos, e nenhum arquivo de backend foi tocado — o DOCX segue em `#222854`.

---

## 13. Revisão pela ESPEC 009 — 2026-08-10

Uma regra da §7 foi revisada pela [ESPEC 009](009-analise-da-medicao.md) `R-PAN-07` e
`R-PAN-08`, e o código já reflete a nova redação.

### `R-UI-03` — o bloco mudou de lugar, pela segunda vez

A redação original põe o bloco de itens medidos sem previsão contratual **dentro deste
grid**. Ele saiu daqui e passou para dentro de *Item crítico*, no painel de análise que
agora fica acima.

**`R-DIV-05` segue intacta em tudo o que ela decide:** o critério de entrada é o mesmo, a
coleta na reconciliação é a mesma, o dado continua na resposta da API
(`sem_previsao_contratual`). Muda a posição de exibição — e é a segunda vez: a ESPEC 008
`D-07` já a moveu do fim do grid para o topo, com o argumento de que medir o que não foi
contratado é o achado que mais compromete o faturamento. O argumento agora leva o mesmo
item mais um passo, para a categoria que o nomeia.

O que **não** pode acontecer em hipótese nenhuma é o item aparecer duas vezes na mesma
tela, ou nenhuma. Há teste para isso, contando ocorrências e não presença.

### O título do grid mudou

Este grid passa a se chamar **"Divergências, na ordem do relatório"** (`R-PAN-08`). Com o
painel de análise acima, dois títulos "Divergências" na mesma tela designariam recortes
diferentes — 16 itens contra 36 — com a mesma palavra. O grid sempre foi o da ordem do
relatório; o título passou a dizer isso.

### O que **não** mudou

As 36 linhas, as 22 seções, o agrupamento, as faixas, a legenda, as seis colunas e a
formatação por item. `R-PAN-09` fez disso critério de aceite, e a comparação de captura
antes-contra-depois é quem o cobra.

> **Pendente de aceite.** A saída do bloco corresponde ao insumo `K-03` do
> [TASKS 009](../tasks/009-tasks-analise-da-medicao.md). Se o negócio decidir que o
> universo da análise são as 55 linhas do relatório, o bloco **volta** para cá como
> estava — a tarefa foi escrita para ser revertida.

---

## 14. Revisão pela ESPEC 039 — 2026-09-02

A `R-UI-04` foi revisada pela [ESPEC 039](039-a-legenda-que-descrevia-o-que-nao-aconteceu.md), a
partir de um relatório real em que o grid tinha divergência mas nenhuma linha negativa.

### `R-UI-04` — a legenda passa a ser condicional

Redação original: a explicação das duas marcas (`perfil`, saldo negativo) fica numa legenda visível,
sempre que há alguma divergência na tela. Isso fazia a legenda descrever **as marcas que a
aplicação sabe produzir**, não as que ocorrem no relatório em mãos — uma entrada podia apontar para
uma condição ausente.

Nova redação: cada entrada da legenda só aparece quando o relatório tem ao menos um item com a
condição correspondente (`R-LEG-01`, ESPEC 039). Perfil e saldo negativo passam a ser verificados de
fontes diferentes — o primeiro nunca cruza este grid, por nunca divergir (`R-DIV-04`) — e a legenda
some por completo se nenhum dos dois ocorrer.

**O que continua igual:** a legenda continua fora do `title` (ESPEC 008 `D-05`), continua visível e
continua explicando as duas marcas uma vez só, nunca por linha.
