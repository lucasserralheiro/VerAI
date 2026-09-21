# ESPEC 009 — Análise da Medição

| | |
|---|---|
| **Status** | **Implementada** — 2026-08-10. Portões P1 e P3 fechados; **P2 pendente do insumo `K-01`** |
| **Versão** | 1.2 — 2026-08-11 — implementada, com oito emendas em §17 |
| **Depende de** | [ESPEC 001](001-mvp-analise-medicao.md), [ESPEC 002](002-painel-de-divergencias.md), [ESPEC 003](003-relatorio-em-docx.md), [ESPEC 008](008-acessibilidade-da-interacao.md) — todas implementadas |
| **Revisa** | `R-UI-03` da ESPEC 002 — a **posição** do bloco de itens sem previsão contratual, ver §9 |
| **Artefato de referência** | `docs/documentos/Relatorio_Analise_Medição.xlsx` — produzido fora da aplicação, ver §2 |

---

## 1. Problema

O relatório de comprovação diz **quanto** foi contratado e **quanto** foi medido. O grid de
divergências diz **onde** os dois números não bateram — 36 linhas de 55, na ordem do relatório.

Nenhum dos dois diz **quão grave é cada diferença**, e as diferenças não são da mesma espécie:

- medir **acima** do contratado é consumo sem cobertura, e o dinheiro já foi gasto;
- medir **zero** onde há contrato é serviço contratado e não entregue — ou não demandado;
- medir **a menor** é entrega parcial, com saldo a acompanhar;
- medir **igual** é conformidade — exceto onde a igualdade é artefato de apresentação (§6.4).

Hoje essa leitura é feita percorrendo o grid com o olho e separando as linhas mentalmente em
categorias. É a mesma forma de trabalho que a ESPEC 002 eliminou uma etapa antes, sobrevivendo na
etapa seguinte — e, de novo, **os dados já existem**: a reconciliação da ESPEC 001 produz cada
linha com contratada e medida, e a ESPEC 002 já calcula o saldo. Falta classificar e somar.

---

## 2. O artefato de referência, e o que ele revelou

Existe em `docs/documentos/Relatorio_Analise_Medição.xlsx` uma planilha com exatamente a estrutura
pedida: aba de resumo executivo mais quatro abas de detalhe. Ela **não foi produzida por esta
aplicação** — foi gerada fora dela, sobre o relatório modelo, como prova de conceito da ideia.

Ela cumpre o papel do relatório modelo da ESPEC 001: é o alvo de fidelidade. Comparar o que a
aplicação produz hoje com o que a planilha afirma expôs três fatos que dirigem esta espec.

### 2.1 A planilha declara zero itens críticos — e há um

A aba de resumo traz `Itens Críticos: 0`, e o total das quatro categorias é **55**. É coerente com a
origem: ela foi derivada das 55 linhas do relatório, e `R-REC-01` omite do relatório os itens com
quantidade contratada zero.

O item omitido é `14.049.00054.00` — **contratado 0, medido 2, ausente da tabela de itens do
contrato** (ESPEC 002 §5). Pelo critério da própria classificação, `contratado < medido` é item
crítico: **ele é o único item crítico da competência, e a planilha de referência o exibe como
inexistente.**

Um relatório de análise cuja única categoria vazia é justamente a que contém o achado mais grave
inverte o próprio propósito. Daí a decisão `D-01` (§7).

### 2.2 A quantidade do certificado digital continua divergindo

A planilha grafa `11.027.00001.00` com contratado **6**; a aplicação produz **10** — o valor do
contrato, do aditivo e da planilha de medição. É a limitação conhecida do projeto, pendente do
insumo `I-01`.

**A classificação não muda com a resposta**: 6 > 0 e 10 > 0 caem os dois em `contratado > medido,
medido = 0`. O insumo altera um número de célula, não uma categoria — e é isso que permite entregar
esta espec com `I-01` ainda em aberto.

### 2.3 As contagens conferem

Rodada a classificação sobre as 55 linhas que a aplicação produz hoje, com os dois arquivos reais do
piloto:

| Categoria | Aplicação | Planilha de referência |
|---|---|---|
| Item crítico | 0 | 0 |
| Divergente de maior relevância | 20 | 20 |
| Divergente | 16 | 16 |
| Sem divergência | 19 | 19 |
| **Total** | **55** | **55** |

Os 20 + 16 somam os **36 divergentes** da ESPEC 002. A taxonomia nova não contradiz a antiga: ela a
particiona.

---

## 3. Objetivo

Classificar cada item da competência em uma de quatro situações, e apresentar o resultado em dois
lugares:

1. **Na tela**, num painel acima do grid de divergências — quadro-resumo primeiro, detalhe depois.
2. **Em arquivo**, o `Relatorio_Analise_Medição.xlsx`, para baixar junto com o `.docx`.

O `.docx` continua sendo o entregável formal, íntegro e inalterado. O grid de divergências continua
sendo a leitura por seção. A análise é a leitura **por gravidade**.

---

## 4. Escopo

### 4.1 Dentro do escopo

- Classificação de cada item em uma das quatro situações de §5.
- Quadro-resumo com a contagem por situação e o total.
- Detalhamento dos itens de cada situação, com as colunas do grid de divergências.
- Painel na tela, **acima** do grid de divergências.
- Geração do `Relatorio_Analise_Medição.xlsx` e download.
- Exposição da análise na resposta da API.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Saldo agregado por categoria | Somar `HORA/HOMEM` com `GB` e `LICENÇA` produz um número sem significado. O saldo continua por linha, onde tem unidade |
| Valor financeiro da divergência | A aplicação não lê preço. O contrato traz a tabela de itens sem valor unitário nas colunas que o extrator consome (ESPEC 001) |
| Percentual de execução por item | Mesma recusa da ESPEC 002 §3.2, e pelo mesmo motivo: proporção e saldo contam histórias diferentes, e nenhuma das duas foi pedida |
| Filtro, busca e ordenação no painel | ESPEC 002 `R-UI-05` e ESPEC 008 §4 recusaram, e a categorização é justamente o que torna o filtro desnecessário |
| Alterar o `.docx` ou o grid de divergências | O teste-âncora da ESPEC 001 e as regras da ESPEC 002 permanecem. Esta espec **acrescenta**, não substitui |
| Histórico entre competências | Depende de persistência, excluída pela ESPEC 001 §7.2 |
| Recomendação de ação por item | Classificar é da aplicação; decidir o que fazer com a classificação é do negócio |

---

## 5. Regras de classificação

Sejam `c` a quantidade contratada e `m` a quantidade medida do item.

| ID | Regra |
|---|---|
| `R-ANA-01` | **Item crítico** — `c < m`. Foi medido mais do que se contratou: consumo sem cobertura contratual |
| `R-ANA-02` | **Divergente de maior relevância** — `c > m` **e** `m = 0`. Há contrato e não houve medição nenhuma no período |
| `R-ANA-03` | **Divergente** — `c > m` **e** `m ≠ 0`. Houve medição, abaixo do contratado |
| `R-ANA-04` | **Sem divergência** — `c = m` |
| `R-ANA-05` | As quatro situações são **exclusivas e exaustivas**: todo item cai em exatamente uma. A soma das quatro contagens é igual ao total de itens do universo (`R-ANA-07`), e isso é **invariante verificado por teste**, não observação |
| `R-ANA-06` | A comparação é entre os valores decimais, **não entre os textos formatados** — a mesma exigência de `R-DIV-01`. Comparar texto faria `117,29` e `117,2889…` parecerem iguais, e classificaria como *sem divergência* um item divergente |
| `R-ANA-07` | O universo da análise é o das 55 linhas do relatório **mais** os itens medidos sem previsão contratual (`R-DIV-05`). Ver `D-01` em §7 |
| `R-ANA-08` | Itens de perfil ou pacote entram como `1/1` (`R-REC-04`) e por isso caem **sempre** em *sem divergência*. Eles carregam marca própria em toda exibição — ver §6.4 |
| `R-ANA-09` | A ordem dentro de cada situação é a do relatório (ordem do catálogo), preservando a correspondência linha a linha com o `.docx` e com o grid de divergências |
| `R-ANA-10` | O saldo exibido é o de `R-DIV-08` — `c − m`, na formatação do item. Em item crítico ele é sempre negativo, e o sinal é preservado (`R-DIV-09`) |
| `R-ANA-11` | A situação *sem divergência* **não** exibe coluna de saldo: ele é zero por definição da própria situação |

### 5.1 As fronteiras, explicitamente

`c = m = 0` cai em *sem divergência* por `R-ANA-04` — e não ocorre no piloto, porque `R-REC-01`
mantém fora do relatório os itens com contratada zero, e `R-DIV-05` só coleta os medidos maiores que
zero. É fronteira sem caso real, e por isso mesmo precisa estar escrita: sem a regra, um item assim
não teria situação nenhuma e quebraria `R-ANA-05`.

---

## 6. As quatro situações, do ponto de vista de quem confere

O nome da categoria vira ação. Vale dizer que ação é.

### 6.1 Item crítico — `c < m`

**O achado de maior consequência possível numa conferência.** Foi consumido mais do que o contrato
prevê, e não há linha contratual que sustente a diferença. No piloto é um item, e é o item que o
relatório modelo esconde por construção.

Não há saldo a acompanhar: há excesso a justificar. Por isso o painel abre com esta situação, e por
isso ela aparece **mesmo vazia** (`R-PAN-04`) — "nenhum item crítico" é informação, e informação boa.

### 6.2 Divergente de maior relevância — `c > m`, `m = 0`

Contratado e **nada medido**. São 20 dos 55 itens do piloto — a maior das quatro categorias.

A relevância é de valor: é aqui que está o item integralmente não entregue, ou integralmente não
demandado. **A categoria não acusa**: num contrato de sustentação é normal haver item sob demanda
sem consumo no mês, e a aplicação não tem como distinguir "não entregue" de "não demandado" — essa
distinção não está nem no contrato nem na planilha. O rótulo descreve o fato (`contratado sem
medição no período`) e a leitura é de quem conhece o contrato.

### 6.3 Divergente — `c > m`, `m ≠ 0`

Entrega parcial: 16 itens no piloto. É a situação de acompanhamento — o saldo por linha diz quanto
falta, e é onde a coluna **Saldo** da ESPEC 002 rende mais.

### 6.4 Sem divergência — `c = m`

19 itens, e **a situação que mais merece cuidado nesta espec**, porque é a única cuja leitura
natural é "não preciso olhar".

Cinco dessas 19 linhas são itens de perfil ou pacote, que entram como `1/1` por `R-REC-04`
independentemente do conteúdo da planilha: `14.048.00008.00`, `14.046.00010.00`, `14.025.00011.00`
(duas linhas) e `14.070.00002.00`. O primeiro é o caso conhecido — **banco de dados contratado no
perfil D e medido no perfil C**, que aparece como se não houvesse diferença nenhuma (ESPEC 001
§9.3).

Ou seja: **mais de um quarto da categoria "sem divergência" está lá por construção da apresentação,
não por conferência bem-sucedida.** Um relatório que afirme conformidade sem ressalvar isso afirma
mais do que sabe. Daí `R-ANA-08` e `R-PAN-06`.

---

## 7. Decisões

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **O universo da análise é 56, não 55**: as 55 linhas do relatório mais o item medido sem previsão contratual. Ele entra como **item crítico**, marcado como tal | É o único item crítico da competência. Mantê-lo fora produziria um relatório de análise que declara zero críticos existindo um — exatamente o defeito do artefato de referência (§2.1). O `.docx` **não muda**: `R-REC-01` e o teste-âncora seguem intactos, porque a omissão é do documento formal, não da análise |
| `D-02` | O arquivo é **XLSX**, com as cinco abas do artefato de referência | O formato do modelo é XLSX, e a análise é planilha de trabalho — quem a recebe filtra e ordena. O `.docx` é o documento formal e permanece o único. `openpyxl` já é dependência do projeto (leitura da medição): nenhuma biblioteca nova |
| `D-03` | O painel na tela mostra o **quadro-resumo sempre aberto** e as quatro situações em blocos recolhíveis nativos (`<details>`), com **crítico e maior relevância abertos** por padrão | Somando as quatro categorias a tela teria ~92 linhas acima de um grid de 36. O recolhimento nativo é do usuário, não é filtro nem paginação — `R-UI-05` e ESPEC 008 §4 recusaram **esconder** conteúdo do usuário, não permitir que ele o dobre. `<details>` é operável por teclado e anunciado por leitor de tela sem uma linha de ARIA |
| `D-04` | As quantidades vão para a tela e para o XLSX **já formatadas pelo backend**, como em `LinhaDoGrid` | Mesma razão da ESPEC 002: a escolha entre `MILHAR` e `SIMPLES` é por item (`R-MED-04`) e duplicá-la em TypeScript duplicaria a regra em duas linguagens. No XLSX o valor vai também como número, em coluna própria de tipo numérico, para que a planilha possa ser somada — ver `R-XLS-05` |
| `D-05` | O rótulo da categoria na tela é o do negócio — *Item crítico*, *Divergente de maior relevância*, *Divergente*, *Sem divergência* | É o vocabulário do pedido. A colisão com o título do grid existente é resolvida em `R-PAN-08` |

---

## 8. O quadro-resumo

Cabeçalho com contrato, proposta e competência, e a contagem por situação.

```
Análise da medição
Contrato TC 52/SMIT/2024 · Proposta PA-SMIT-260319-739 · Competência julho/2026

┌────────────────────────────────────────────────┬────────────┐
│ Situação                                       │ Itens      │
├────────────────────────────────────────────────┼────────────┤
│ Item crítico — medido acima do contratado      │          1 │
│ Divergente de maior relevância — sem medição   │         20 │
│ Divergente — medido abaixo do contratado       │         16 │
│ Sem divergência                                │         19 │
├────────────────────────────────────────────────┼────────────┤
│ Total de itens analisados                      │         56 │
└────────────────────────────────────────────────┴────────────┘
```

| ID | Regra |
|---|---|
| `R-RES-01` | O quadro traz as **quatro** situações, inclusive as de contagem zero |
| `R-RES-02` | A linha de total é exibida e é a soma das quatro — a verificação de `R-ANA-05` fica visível na tela, não só no teste |
| `R-RES-03` | Contrato, proposta e competência vêm do relatório (`contrato_referencia`, `proposta_origem`, `data_levantamento`). A competência é o mês por extenso em pt-BR derivado da data do levantamento — `15/07/2026` → `julho/2026` |
| `R-RES-04` | Sem coluna de percentual e sem saldo agregado — §4.2 |

---

## 9. O painel na tela

Fica **entre a faixa "Relatório gerado" e o grid de divergências**.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Relatório gerado · 36 de 55 itens com divergência   [Baixar DOCX] [Análise] │
└──────────────────────────────────────────────────────────────────────────────┘

  Análise da medição
  Contrato TC 52/SMIT/2024 · Proposta PA-SMIT-260319-739 · Competência julho/2026

  ┌ quadro-resumo (§8) ───────────────────────────────────────────────────────┐
  └───────────────────────────────────────────────────────────────────────────┘

  ▼ Item crítico · 1 item                                          [aberto]
  ┌─────────────────┬───────────────────────┬──────────┬───────┬───────┬──────┐
  │ 14.049.00054.00 │ HOSPEDAGEM …  ⚠ sem   │          │     0 │     2 │   -2 │
  │                 │ previsão contratual   │          │       │       │      │
  └─────────────────┴───────────────────────┴──────────┴───────┴───────┴──────┘

  ▼ Divergente de maior relevância · 20 itens                      [aberto]
  ┌ … contratado sem medição no período … ────────────────────────────────────┐

  ▶ Divergente · 16 itens                                       [recolhido]

  ▶ Sem divergência · 19 itens                                  [recolhido]
    5 desses itens são de perfil ou pacote — ver legenda

  Divergências, na ordem do relatório
  36 itens em que a quantidade medida difere da contratada
  ┌ … o grid da ESPEC 002, inalterado … ──────────────────────────────────────┐
```

| ID | Regra |
|---|---|
| `R-PAN-01` | O painel fica **acima** do grid de divergências e **abaixo** da faixa de resultado |
| `R-PAN-02` | Cada situação é um bloco com título, contagem e a tabela de itens, na ordem de `R-ANA-09` |
| `R-PAN-03` | As colunas são as do grid de divergências (`R-DIV-02`) — Código, Descrição, Unidade, Contratada, Medida, Saldo — para que a mesma linha seja reconhecível nos três lugares. *Sem divergência* omite Saldo (`R-ANA-11`) |
| `R-PAN-04` | Situação sem itens aparece **mesmo assim**, com a contagem zero e sem tabela. "Nenhum item crítico" é resultado, não ausência de resultado |
| `R-PAN-05` | O item vindo de `R-DIV-05` traz, na linha, a marca **sem previsão contratual** — dentro da situação *crítico* ele é o caso mais grave de todos, e a marca é o que o distingue de um excesso sobre item contratado |
| `R-PAN-06` | O bloco *sem divergência* traz, sob o título, a contagem de itens de perfil ou pacote e a remissão à legenda. As linhas mantêm a marca `perfil` do grid (`R-UI-04`). Sem isso a categoria afirma conformidade que não verificou (§6.4) |
| `R-PAN-07` | O item sem previsão contratual aparece **uma única vez na tela**: no bloco de itens críticos. O bloco homônimo do topo do grid de divergências **sai** — ver §9.1 |
| `R-PAN-08` | O grid da ESPEC 002 passa a se intitular **"Divergências, na ordem do relatório"**. Com o painel acima, dois títulos "Divergências" na mesma tela designariam recortes diferentes com a mesma palavra |
| `R-PAN-09` | O grid de divergências não muda em mais nada: mesmas linhas, mesmo agrupamento por seção, mesma legenda |
| `R-PAN-10` | Recolher ou expandir um bloco não altera o quadro-resumo nem o grid |

### 9.1 O que esta espec revisa na ESPEC 002

`R-DIV-05` — a **coleta** dos itens medidos sem previsão contratual — permanece intacta: mesmo
critério de entrada, mesmo dado na resposta da API.

Muda a **posição de exibição**, que é arranjo e não requisito. É a segunda vez: a ESPEC 008 `D-07` já
moveu o bloco do fim para o topo do grid, com o argumento de que medir o que não foi contratado é o
achado que mais compromete o faturamento e estava depois de 22 seções. O argumento agora leva o
mesmo item mais um passo, para dentro da categoria que o nomeia. `R-UI-03` fica revisada nessa
extensão.

> **Condicional ao insumo `I-06`.** Se o negócio decidir que o universo da análise são as 55 linhas
> do relatório (`D-01` recusada), o bloco **volta** para o topo do grid de divergências como está
> hoje. O que não pode acontecer em nenhuma das duas hipóteses é o item desaparecer da tela.

### 9.2 Acessibilidade

A ESPEC 008 vale integralmente para o painel, e três regras dela têm efeito direto aqui:

| Regra | Efeito |
|---|---|
| `R-ACE-05` | Cada tabela do painel transborda a 390 px como as do grid: o contêiner que rola é focável e tem nome acessível |
| `R-ACE-09` | Toda tabela tem nome acessível; todo `<th>` de coluna tem `scope="col"` |
| `R-ACE-10` / `R-ACE-12` | A hierarquia continua contínua: `<h2>` "Análise da medição", `<h3>` por situação — e o grid abaixo mantém seu `<h2>` e seus `<h3>`/`<h4>` |
| `R-ACE-02` | O que distingue as situações não pode ser só cor. Cada bloco é nomeado por escrito, e a marca de `R-PAN-05` é texto |
| `R-ACE-19` | O arquivo baixado identifica contrato e competência: `confere-analise-TC-52-SMIT-2024-2026-07.xlsx` |

O `<summary>`/`<details>` de `D-03` é escolha de acessibilidade tanto quanto de layout: recolhimento
nativo já é focável, operável por teclado e anunciado com estado — nenhuma das três coisas sai de
graça numa implementação própria.

---

## 10. O arquivo `Relatorio_Analise_Medição.xlsx`

Cinco abas, na ordem e com os nomes do artefato de referência.

| Aba | Conteúdo |
|---|---|
| `Resumo Executivo` | Título, contrato, proposta, competência e o quadro de §8 |
| `Itens Críticos` | Código, Descrição, Contratado, Medido, Saldo |
| `Divergências Maior Relevância` | idem |
| `Divergências` | idem |
| `Sem Divergência` | Código, Descrição, Contratado, Medido |

| ID | Regra |
|---|---|
| `R-XLS-01` | As abas existem **sempre**, inclusive vazias — só com título e cabeçalho, como faz o artefato de referência na aba `Itens Críticos` |
| `R-XLS-02` | O conteúdo é o mesmo do painel: mesmas linhas, mesma ordem, mesma classificação. Tela e arquivo não podem discordar |
| `R-XLS-03` | **Revisada em 2026-08-11 — ver §17.8.** A aba `Sem Divergência` não traz Saldo (`R-ANA-11`) e ~~traz a marca de perfil ou pacote em coluna própria~~ **não traz coluna de marca**: as suas colunas são as do gabarito — `Código`, `Descrição`, `Contratado`, `Medido`. A ressalva de §6.4 fica na tela e na resposta da API, e **não** viaja no arquivo |
| `R-XLS-04` | Itens sem previsão contratual saem na aba `Itens Críticos`, com a marca de `R-PAN-05` em coluna própria |
| `R-XLS-05` | Cada quantidade ocupa **duas colunas**: o texto formatado, para conferência contra o `.docx`, e o valor numérico, para que a planilha some. Uma coluna de texto que parece número é o defeito clássico de relatório em planilha |
| `R-XLS-06` | O arquivo é gerado na mesma passagem do `.docx` e vai embutido na resposta — §11 |

---

## 11. Contrato da API

`POST /reports` ganha dois campos. Nada é removido nem renomeado.

```jsonc
{
  // … tudo o que a ESPEC 002 §6 já devolve, inalterado …
  "total_linhas": 55,
  "total_divergencias": 36,
  "secoes": [ /* … */ ],
  "sem_previsao_contratual": [ /* … */ ],

  "analise": {
    "contrato_referencia": "TC 52/SMIT/2024",
    "proposta_origem": "PA-SMIT-260319-739",
    "competencia": "julho/2026",
    "total_itens": 56,
    "situacoes": [
      {
        "classificacao": "CRITICO",
        "rotulo": "Item crítico",
        "quantidade": 1,
        "linhas": [
          {
            "codigo": "14.049.00054.00",
            "descricao": "HOSPEDAGEM DE APLICAÇÃO TIPO D NÃO GERENCIADA",
            "unidade": "",
            "contratada": "0",
            "medida": "2",
            "saldo": "-2",
            "perfil_ou_pacote": false,
            "sem_previsao_contratual": true
          }
        ]
      }
      // MAIOR_RELEVANCIA, DIVERGENTE, SEM_DIVERGENCIA — mesma forma
    ]
  },

  "analise_xlsx_base64": "UEsDBBQABgAI…"
}
```

| ID | Regra |
|---|---|
| `R-API-01` | `situacoes` traz as **quatro**, na ordem de gravidade, mesmo com `quantidade: 0` e `linhas: []` — a tela não decide quais existem |
| `R-API-02` | As linhas reusam `LinhaDoGrid`, acrescida de `sem_previsao_contratual: bool`. Campo novo com padrão `false`: o grid de divergências não muda |
| `R-API-03` | O XLSX vai embutido pelo mesmo motivo do `.docx` (ESPEC 002 §6): a aplicação é sem estado e processar duas vezes custaria o dobro pelo mesmo resultado. O arquivo do piloto tem ~20 KB, ~27 KB em base64 — irrelevante ao lado dos ~41 páginas de `.docx` que já viajam |
| `R-API-04` | Achado bloqueante continua devolvendo `422` sem documento e **sem análise** (`R-DIV-10`). Análise de número possivelmente errado é pior que análise nenhuma: ela classifica |

---

## 12. Onde o código muda

| Camada | Mudança |
|---|---|
| `domain/` | `Classificacao` (`StrEnum`) e `ReportLine.classificacao`; `domain/entities/analysis.py` com `AnaliseDaMedicao` — resumo e situações, montada a partir de `Report.linhas` **mais** `Report.sem_previsao_contratual`; porta do renderizador de análise em `domain/interfaces/` |
| `application/` | O caso de uso passa a devolver a análise junto do relatório. Nenhuma leitura nova de arquivo: a classificação é função das duas quantidades que já existem |
| `infrastructure/` | `report/xlsx_analise_renderer.py` com `openpyxl`; registro no `di/container.py` |
| `api/` | `schemas.py`: `LinhaDoGrid.sem_previsao_contratual`, `SituacaoDaAnalise`, `Analise`; `routers/reports.py` preenche os dois campos novos |
| `frontend/` | `components/AnaliseMedicaoPanel.tsx`; `lib/types.ts`; `ResultadoPanel.tsx` monta o painel antes do grid e ganha o segundo botão de download; `DivergenciaGrid.tsx` perde o bloco de `R-PAN-07` e muda de título (`R-PAN-08`) |

A regra de dependência não muda: classificar é lógica de domínio e não conhece HTTP nem planilha.
`tests/test_architecture.py` continua valendo sem alteração.

---

## 13. Testes

| Nível | Cobertura |
|---|---|
| Unitário | As quatro regras nas fronteiras: `c<m`, `c>m ∧ m=0`, `c>m ∧ m≠0`, `c=m`, `c=m=0`, e decimais próximos — `117,29` contra `117,2889…` classificando como *divergente* e não *sem divergência* (`R-ANA-06`) |
| Invariante | `R-ANA-05` — a soma das quatro contagens é o total do universo, sobre o piloto e sobre casos construídos |
| Domínio | `R-ANA-07` / `D-01` — o item de `sem_previsao_contratual` entra como crítico e chega marcado |
| Domínio | `R-ANA-08` — as cinco linhas de perfil/pacote caem em *sem divergência* e chegam marcadas |
| Piloto | **1 crítico, 20 de maior relevância, 16 divergentes, 19 sem divergência, 56 no total** |
| **Construído** | `R-API-01` / `R-XLS-01` / `R-PAN-04` — situação **sem itens**: a resposta traz `linhas: []`, o arquivo traz a aba só com título e cabeçalho, e a tela traz a contagem zero sem tabela. **O piloto não exercita esse caminho** — com o universo de `D-01` as quatro situações têm itens, e a única categoria vazia que se conhece é a que o artefato de referência exibe por engano (§2.1). Caso construído, não amostrado |
| Unitário | `R-RES-03` — `15/07/2026` vira `julho/2026`, com o nome do mês vindo de tabela própria e **não do `locale` do sistema**, que varia por máquina e por container |
| Coerência | `R-XLS-02` — numa mesma execução, as contagens das quatro situações na resposta da API e as linhas das quatro abas de detalhe do arquivo são **iguais**. Tela e arquivo saem do mesmo agregado, e é isso que o teste fixa |
| **Âncora da análise** | Comparação **célula a célula** com `docs/documentos/Relatorio_Analise_Medição.xlsx`, nas cinco abas, com **duas divergências declaradas no próprio teste**: o item crítico, que a referência não traz (`D-01`/`I-06`), e `11.027.00001.00` com 10 em vez de 6 (`I-01`). Divergência declarada é divergência que o teste enxerga; o resto é fidelidade exata |
| **Regressão** | O teste-âncora do `.docx` continua passando — a prova de que o documento formal não mudou. O grid de divergências continua com **36 linhas em 22 seções** |
| API | Os dois campos novos aparecem, `situacoes` traz as quatro mesmo vazias, e o `422` bloqueante não traz análise |
| Navegador | O painel aparece acima do grid; o quadro-resumo soma o total; os dois downloads funcionam; `axe` sem violações novas; a hierarquia de cabeçalhos segue contínua; recolher um bloco não muda o resumo |

O teste-âncora da análise é o critério de aceite desta espec, pela mesma razão que o da ESPEC 001 é o
do projeto: existe um documento que o negócio já reconhece como correto, e a aplicação tem de
reproduzi-lo — inclusive onde discorda dele, e aí por escrito.

---

## 14. Riscos

| Risco | Mitigação |
|---|---|
| **A tela fica longa**: quatro blocos somando ~92 linhas acima de um grid de 36 | `D-03` — resumo sempre visível, blocos recolhíveis, os dois mais graves abertos. Se ainda assim a rolagem incomodar, o candidato a sair é o bloco *sem divergência*, cujo conteúdo o XLSX já carrega |
| **Os mesmos 36 itens aparecem duas vezes na tela** — por situação e por seção | Consciente. São duas perguntas diferentes: *quão grave?* e *onde no relatório?*. Se o uso mostrar que o grid por seção deixou de ser consultado, a conclusão será que ele pode sair — e essa é uma espec futura, não um ajuste agora |
| **"Sem divergência" ser lido como "conferido"**, incluindo os cinco itens `1/1` | `R-ANA-08` e `R-PAN-06` — a ressalva aparece na tela e na resposta da API. **Desde 2026-08-11 ela não viaja mais no arquivo** (§17.8): quem conferir só pelo XLSX não tem como saber que aquele `1 = 1` é convenção. Continua sendo o risco mais sério desta espec, e agora está menos coberto |
| **A categoria "maior relevância" ser lida como acusação** onde o item é sob demanda | §6.2 — o rótulo descreve o fato (`contratado sem medição no período`) e não imputa causa. A aplicação não tem o dado que distinguiria "não entregue" de "não demandado" |
| **`I-01` mover uma célula do XLSX** | §2.2 — a classificação não depende da resposta, e a divergência está declarada no teste-âncora |
| **Uma segunda base64 na resposta** | `R-API-03` — ~27 KB ao lado de um `.docx` de ~41 páginas. O limite e a saída (cache curto com identificador) continuam registrados na ESPEC 002 §6 |
| **A geração passar dos 40 s** | O XLSX são ~60 linhas em cinco abas, contra as ~25 mil células dos anexos: a ordem de grandeza é outra. Ainda assim, o tempo total é medido na entrega e comparado com os ~36 s de hoje |

---

## 15. Insumos pendentes

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-06` | O universo da análise inclui os itens medidos sem previsão contratual (56), ou são as 55 linhas do relatório, como faz o artefato de referência? | **Não bloqueia a implementação**, mas decide `D-01`, `R-ANA-07` e `R-PAN-07`. A recomendação técnica é 56, com o motivo em §2.1. Se a resposta for 55, o item volta ao topo do grid de divergências |
| `I-01` | A quantidade contratada de `11.027.00001.00` é 10 (contrato e aditivo) ou 6 (relatório modelo)? | Não. Já registrado no projeto; aqui só se pede que a resposta seja refletida também no XLSX |
| `I-07` | Os rótulos das quatro situações são os desta espec, ou o negócio usa outros nomes na comunicação com a contratante? | Não. Rótulo é dado de apresentação e muda em uma linha |

---

## 16. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Classificação no domínio, com as fronteiras e o invariante | P |
| B | `AnaliseDaMedicao` montada sobre relatório + itens sem previsão | P |
| C | Renderizador XLSX das cinco abas | M |
| D | Resposta da API com análise e arquivo embutido | P |
| E | Painel na tela, com resumo, blocos recolhíveis e o segundo download | M |
| F | Teste-âncora da análise contra o artefato de referência | M |
| G | Ajuste do grid (`R-PAN-07`, `R-PAN-08`) e do teste de navegador | P |

**Total: 2 a 3 dias.** O que torna barato é o mesmo de sempre neste projeto: a comparação já está
pronta e provada. Esta espec **não calcula nada novo** — ela nomeia, agrupa e conta o que a
reconciliação já produz. O que custa é a fase C, porque um formato de saída novo entra no projeto, e
a fase F, porque fidelidade a artefato externo se prova célula a célula.

---

## 17. Emendas da implementação — 2026-08-10

Três afirmações desta espec não sobreviveram ao contato com o código. Registradas
aqui, não contornadas — é a conduta da ESPEC 007 §13.

### 17.1 `application/` não foi tocada, contra a §11

A §11 previu que *"o caso de uso passa a devolver a análise junto do relatório"*.
**Não precisou.** O `routers/reports.py` já chamava `relatorio.apenas_divergencias()`
— uma derivação de domínio — sobre o `Report` que o caso de uso devolvera. A análise
é a mesma espécie de derivação, e `AnaliseDaMedicao.de_relatorio()` é chamada do
mesmo lugar.

Atravessar `application/` acrescentaria uma camada sem decisão nenhuma a tomar. A §11
fica valendo com esta correção: **domínio, infraestrutura, API e frontend** mudaram;
`application/` não.

### 17.2 A descrição do artefato de referência **não** é comparável

A §13 pedia comparação célula a célula com o gabarito. Ao implementar, a descrição
teve de sair do escopo: o gabarito traz descrição **reescrita à mão** —
`ARMAZENAMENTO DE DADOS - NAS` contra a nossa `ARMAZENAMENTO DE DADOS - BAIXA
PLATAFORMA - NAS`, `NUVEM PLANO II WINDOWS` contra `NUVEM - PLANO II - WINDOWS
2012/2016`.

A nossa vem do contrato (`R-CTR-03`) e chega a preservar o erro de digitação dele:
`DISPONIBLIZACAO DE vRAM ADICIONAL`. Ajustar a nossa ao gabarito seria reescrever o
contrato. O âncora compara **código, categoria e quantidades**; descrição e
identificação ficam declaradamente de fora (esta última já estava, pelo PLANO 009
§6.2).

### 17.3 O gabarito tem menos precisão que a aplicação

O portão P1 acusou uma **terceira** diferença, e ela não é divergência: o
`14.070.00001.00` sai da aplicação com `117,2889788312131` — o valor da planilha de
medição — e o gabarito gravou `117,29`, a precisão do relatório **impresso**.

Os dois lados classificam igual, e o lado exato é o nosso: quem perdeu informação foi
quem transcreveu o relatório. A comparação com o gabarito passou a arredondar para
duas casas; a **classificação** continua usando o valor cheio, que é o que `R-ANA-06`
exige. Não é uma terceira divergência declarada — é o reconhecimento de que o gabarito
nunca teve como conhecer a terceira casa decimal.

### 17.4 O quadro-resumo saiu da tela — e continua no arquivo

A §8 e a `R-PAN-02` puseram na tela um **quadro-resumo em tabela** acima dos quatro
blocos. Na revisão da tela pronta ele se mostrou **redundante palavra por palavra**:
rótulo, glosa e contagem já estavam no cabeçalho de cada bloco, e com os blocos
recolhidos a lista **é** o resumo — com menos moldura e menos rolagem.

O que o quadro tinha de próprio era o **total**, e o total ficou: passou para a linha
de identificação, como `56 itens analisados`. Ele não é repetição de nada — é o
invariante de `R-ANA-05` (a soma das quatro é o universo) visível para quem lê, e é o
primeiro número que se olha numa conferência. `R-RES-02` continua honrada.

**A mudança é de tela, e só de tela.** A aba `Resumo Executivo` do
`Relatorio_Analise_Medição.xlsx` permanece exatamente como `R-XLS-01` e `R-RES-01` a
`R-RES-04` descrevem: lá o arquivo circula **sem os blocos**, para quem não tem a tela
à frente, e o gabarito tem essa aba. `R-RES-01` passa a valer para o arquivo; na tela,
quem cumpre o papel são os quatro blocos, que já traziam as quatro situações,
inclusive as vazias (`R-PAN-04`).

### 17.5 `D-03` revisada — os quatro blocos nascem fechados

A `D-03` abria *Item crítico* e *Divergente de maior relevância*, para que o achado
grave não ficasse atrás de um clique. **O argumento caiu com a §17.4.**

Quando o quadro-resumo saiu da tela, a contagem passou a viver no **cabeçalho de cada
bloco** — e `1 item` em *Item crítico* já é o achado, aberto ou fechado. Abrir dois
blocos deixou de comprar visibilidade e passou a custar o que `D-03` queria evitar:
~92 linhas de detalhe empurrando o grid para fora da primeira tela.

Os quatro passam a nascer **fechados**. A árvore inteira — quatro situações, quatro
contagens, o total ao lado — cabe num relance, e expandir é do usuário.

`R-PAN-04` continua valendo, com o portador mudado: a situação vazia aparece com
`0 itens` no cabeçalho, que **é** o resultado; a frase "Nenhum item nesta situação."
fica dentro, para quem abrir. `R-UI-05` também: recolher não é filtro, e nada some de
quem não pediu.

### 17.6 As duas emendas anteriores quebraram o teste de fumaça — descoberto na ESPEC 012

**Registrado em 2026-08-11**, ao rodar a suíte de navegador durante a implementação da
[ESPEC 012](012-responsividade-durante-a-geracao.md).

As §17.4 e §17.5 mudaram a tela **depois** de a T-542 já ter ajustado o
`smoke.spec.ts` ao arranjo anterior, e o teste não foi reexecutado. Duas asserções
ficaram descrevendo uma tela que deixou de existir:

| Asserção | Por que parou de valer |
|---|---|
| `getByText("sem previsão contratual")` **visível** | A §17.5 fechou os quatro blocos. A marca está no DOM, dentro do `<details>` de *Item crítico*, e conteúdo em bloco fechado não é visível |
| `getByText("Total de itens analisados")` | A §17.4 removeu o quadro-resumo da tela. O total ficou na linha de identificação, como `56 itens analisados` — sem a palavra "Total" |

**Nenhuma regra foi violada.** `R-PAN-05` segue honrada — a marca existe e é
alcançável; `R-RES-02` também — o total continua visível. O que mudou foi o
**arranjo**, e o teste seguia o arranjo em vez da intenção.

A correção expande o bloco antes de asserir, o que de quebra exercita o `<details>`
que a `D-03` escolheu por ser operável sem uma linha de ARIA, e passa a casar o total
por `/\d+ itens analisados/` — segue o número, não a moldura que o continha.

**A lição é a mesma da §12.1 do [TASKS 009](../tasks/009-tasks-analise-da-medicao.md),
noutra camada.** Lá foi *"quando um campo entra na resposta, procurar quem afirma a
forma da resposta"*. Aqui: **emenda de tela feita depois do teste exige rodar o teste
de novo** — e as §17.4 e §17.5 nasceram justamente de uma revisão visual, o momento em
que ninguém está olhando para a suíte.

### 17.7 `R-XLS-05` é revisada pela ESPEC 013 — a intenção fica, o meio muda

**Registrado em 2026-08-11**, com a implementação da
[ESPEC 013](013-quantidade-em-coluna-unica.md).

`R-XLS-05` mandava cada quantidade ocupar **duas** colunas: o texto formatado, para
conferir contra o `.docx`, e o valor numérico, para a planilha somar. O argumento
continua inteiramente válido — *"uma coluna de texto que parece número é o defeito
clássico de relatório em planilha"*.

O que a regra não considerou é que **o Excel guarda um número e o exibe com outra
grafia**: é para isso que serve o formato de célula. Ela tratou texto e número como
mutuamente exclusivos numa célula, e no Excel não são.

A partir da ESPEC 013 cada quantidade ocupa **uma** coluna, numérica, com o valor
cheio e um formato de exibição escolhido por célula — `#,##0` e `#,##0.00` para
`MILHAR`, `0` e `0.00` para `SIMPLES`. A célula do `14.070.00001.00` guarda
`117,2889788312131` e mostra `117,29`.

> A primeira versão da ESPEC 013 usou `#,##0.##` e `0.##`, supondo que `#` fizesse a
> casa decimal sumir nos inteiros. Omite o **dígito**, não o separador: `10` saía `10,`.
> Corrigido na ESPEC 013 v1.2 (`R-NUM-08`).

Duas coisas que a revisão devolveu, e que valem registro:

| | |
|---|---|
| **O gabarito sempre teve uma coluna** | E ela é numérica. A duplicação era acréscimo nosso, e a ESPEC 013 aproxima do artefato de referência em vez de afastar |
| **A grafia ficou idêntica ao relatório** | Medido: contra o arranjo anterior, o comparador de grafia acusava **141** células divergentes — todos inteiros grafados `4,00` onde o `.docx` grafa `4`. Depois, zero |

`R-XLS-01` a `R-XLS-04` e `R-XLS-06` seguem valendo sem alteração. `R-XLS-02` — *tela e
arquivo não podem discordar* — ganhou um guarda a mais, porque agora a grafia do arquivo
é verificada contra a do relatório item a item.

---

### 17.8 `R-XLS-03` é revisada — a coluna `Perfil ou pacote` sai do arquivo

**Registrado em 2026-08-11**, a pedido de quem usa a planilha.

`R-XLS-03` mandava a aba `Sem Divergência` trazer, em coluna própria, a marca dos itens
que entram como `1/1` por `R-REC-04`. O argumento era o de §14: *"o arquivo circula sem a
legenda da tela, e a ressalva de §6.4 precisa viajar com ele"*.

**O gabarito não tem essa coluna**, e foi isso que decidiu:

```
GABARITO  → Sem Divergência: Código | Descrição | Contratado | Medido
NOSSO     → Sem Divergência: Código | Descrição | Contratado | Medido | Perfil ou pacote
```

Era acréscimo nosso, como a duplicação de colunas que a §17.7 registra. Retirá-la aproxima
do artefato de referência, que é o critério de fidelidade do projeto.

**O que se perde está medido, e não é pequeno.** Cinco das dezenove linhas conformes
entram como `1/1` independentemente da planilha, e uma delas — `14.048.00008.00` — é o
banco de dados **contratado no perfil D e medido no perfil C**. Ela fica na aba
`Sem Divergência`, com `1` e `1`, sem nada no arquivo que avise que aquela igualdade é
convenção e não conferência.

A ressalva continua em dois lugares, e nenhum deles é o arquivo:

| Onde | O quê |
|---|---|
| A tela | `R-PAN-06` — o bloco *sem divergência* exibe a contagem e a ressalva |
| A resposta da API | `perfis_ou_pacotes` por situação, com a descrição em `schemas.py` |

`SituacaoDaAnalise.perfis_ou_pacotes` **continua no domínio** e continua testada: ela é a
fonte dos dois. O que saiu foi só o portador no XLSX.

A decisão é de quem recebe o arquivo, e está registrada aqui em vez de num comentário
porque muda o que o documento **afirma**: a aba `Sem Divergência` passa a listar como
conformes cinco itens cuja conformidade ninguém verificou. Há um teste dedicado a dizer
isto em voz alta — `test_t519_o_arquivo_nao_diz_nada_sobre_perfil_ou_pacote` —, e é ele
que cai no dia em que a marca voltar.

**A `Sem previsão contratual` de `Itens Críticos` fica.** Tem o mesmo status — acréscimo
nosso, ausente do gabarito —, e a decisão foi mantê-la: ali a marca não desmente a
classificação, reforça-a.
