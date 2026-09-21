# Confere — resumo funcional

| | |
|---|---|
| **Nome** | **Confere** |
| **Assinatura** | *Confere o contratado. Confere o utilizado.* |
| **O que é** | Aplicação web que confere a medição mensal de contratos de prestação de serviços de TIC e emite o relatório de comprovação que instrui o faturamento |
| **Quem responde pelo documento** | PRODAM |
| **Contratos validados** | TC 52/SMIT/2024 — SMIT Sustentação (piloto) e TC 015/PGM/2024 (`PA-PGM-251015-159`) — PGM |
| **Data deste resumo** | 2026-09-21 |

Documento de leitura funcional: descreve **o que o sistema é e o que ele faz**, sem
entrar em arquitetura. As fontes são o [README](../../README.md), as
[especificações](../specs/) 001 a 056 e o [CHANGELOG](../CHANGELOG.md). Todo dado
numérico abaixo foi conferido em código, teste ou spec com status "Implementada" —
nenhum é estimado.

---

## 1. O problema que o Confere resolve

A conferência entre o que foi **contratado** e o que foi **medido** é feita hoje à mão.
A cada competência, para cada contrato, um analista:

1. abre a proposta comercial em PDF (e seus aditivos) e localiza a tabela de itens;
2. abre a planilha de levantamento, com dezenas de abas;
3. para cada item, localiza o código no contrato, soma as linhas correspondentes da
   planilha e escolhe a variante certa da medição;
4. monta à mão a tabela de comprovação e o documento que a acompanha.

Nenhuma dessas etapas é difícil. **A soma delas é que consome o dia** — e o resultado é um
documento de processo administrativo, lido por fiscal de contrato, controle interno e órgão
de fiscalização.

O Confere automatiza esse trabalho inteiro: **dois arquivos entram, dois saem** — o
documento de comprovação (`.docx`, ~41 páginas) e um relatório de análise por gravidade
(`.xlsx`) — e a tela mostra onde os números não bateram.

---

## 2. O que entra

| Arquivo | Formato | O que o sistema consome |
|---|---|---|
| **Contrato** (proposta comercial vigente e seus aditivos) | PDF | Código do serviço, descrição, unidade e a **ordem** das linhas |
| **Levantamento** da competência | XLSX | Código, **quantidade contratada** e **quantidade medida**, da aba `Levantamento`; e as abas de detalhe, que viram anexos |

São **apenas esses dois**. Não há cadastro, não há login, não há catálogo nem arquivo de
configuração a enviar.

### Não existe mais catálogo

Até a ESPEC 018, um catálogo embutido definia a taxonomia de seções, a ordem das linhas e
quais itens apareciam — e o relatório dependia dele. Ele foi **removido**: um catálogo
semeado do piloto (SMIT) bloqueava o processamento do segundo contrato validado (PGM) com
26 avisos de código ausente, porque as duas apresentações não coincidem.

Hoje **o universo do relatório é a própria aba `Levantamento`**: todo código que ela traz
vira linha (salvo a família `10.050` — especialista/analista e consultoria de BI, faturados
por outro instrumento, excluídos do documento por regra fixa, mas mantidos na comparação). A
**ordem** das linhas continua vindo do contrato — é a única função de apresentação que ele
ainda cumpre.

### Aditivos contratuais

O contrato não é mais só a proposta original: `Inclusão`, `Exclusão`, `Aumento` e `Redução`
de itens trazidos por aditivos são aplicados **em sequência**, sobre a proposta, antes de
qualquer comparação (ESPEC 019 e 022). Isso substitui a limitação antiga ("um único PDF
vigente por execução, sem aditivos") — o que continua valendo é que **um único contrato** é
processado por vez: o sistema não consolida dois instrumentos diferentes numa mesma execução.

### Identidade do par

Antes de processar, o sistema confere se o contrato e a planilha declaram o **mesmo
instrumento contratual** (mesmo órgão, mesmo número, mesmo ano). Quando não conferem, ele
**pergunta antes de emitir qualquer documento**, em vez de assumir (ESPEC 029) — é o único
ponto do fluxo em que a decisão de prosseguir é devolvida a quem confere.

---

## 3. O que sai

### 3.1 O documento formal — `.docx`, ~41 páginas

É o entregável. Sai sobre o **modelo institucional da PRODAM**, com fontes, papel timbrado e
rodapé do modelo, em três blocos:

| Bloco | Conteúdo |
|---|---|
| **Capa** | Deriva da peça submetida — cliente, contrato e propostas saem do próprio contrato enviado (ESPEC 020). Só a arte é fixa, do modelo institucional |
| **Tabela de comprovação** | Uma linha por código da aba `Levantamento`, na ordem do contrato: Código, Descrição, Unidade, Quantidade Contratada, Quantidade Medida. **58 linhas** no piloto e 58 no PGM. Não há mais seções — a ESPEC 018 tirou o agrupamento por catálogo |
| **Anexos de detalhamento** | **19 anexos**, um por aba da planilha, reproduzindo a apresentação do relatório de referência: orientação de página, largura de coluna, altura de linha e figuras |

Os anexos existem para que a conferência de uma quantidade não exija voltar à planilha
inteira: eles mostram **de onde cada número medido veio**.

O `.docx` é editável de propósito — documento que instrui faturamento passa por revisão, e
revisar exige poder ajustar.

**A marca Confere não entra no documento.** O `.docx` carrega a identidade da PRODAM, que é
quem o assina. A marca do Confere identifica quem produziu, não o que foi produzido, e vive
apenas na tela.

### 3.2 O grid de divergências — na tela

O documento diz *quanto* foi contratado e *quanto* foi medido. Ele não responde à pergunta
seguinte: **onde os dois números não bateram**.

Após a geração, a tela exibe um grid com a mesma ordem do relatório, contendo **só os itens
em que contratada ≠ medida**, mais uma coluna que o documento não tem:

| Coluna | Origem |
|---|---|
| Código · Descrição · Unidade · Contratada · Medida | Iguais às do relatório, com a mesma formatação |
| **Saldo** | `contratada − medida`. É a subtração que o analista faz de cabeça ao ler cada linha |

No piloto: **37 itens divergentes de 58**. Saldo negativo — consumo acima do contratado — é
destacado.

O que a planilha traz e o contrato não conhece sai à parte, sob **`DEMAIS ITENS DO
LEVANTAMENTO`**, tanto no grid quanto no bloco final do documento — exceto a única linha que
não prova nem desmente nada: a que **zera as duas quantidades** (sem nada contratado e sem
nada medido). Essa linha não entra no relatório final, mas continua no grid, na análise e na
API.

### 3.3 A análise da medição — implementada

A [ESPEC 009](../specs/009-analise-da-medicao.md) acrescenta a leitura **por gravidade**, ao
lado da leitura item a item que o grid já dá. Cada item é classificado em uma de quatro
situações, exclusivas e exaustivas:

| Situação | Critério | O que significa | Piloto |
|---|---|---|---|
| **Crítico** | contratada < medida | Consumo sem cobertura contratual — o dinheiro já foi gasto | 0 |
| **Divergente de maior relevância** | contratada > medida e medida = 0 | Há contrato e nenhuma medição no período: não entregue **ou** não demandado | 20 |
| **Divergente** | contratada > medida e medida ≠ 0 | Entrega parcial, com saldo a acompanhar | 16 |
| **Sem divergência** | contratada = medida | Conformidade — com a ressalva de §5.3 | 22 |
| | | **Total analisado** | **58** |

O único item crítico que o piloto chegou a apresentar era **artefato de leitura** — corrigido
pela ESPEC 031, que passou a aplicar o desconto de desenvolvimento pela seção inteira. Hoje o
piloto fecha com zero itens críticos.

O resultado aparece em um painel acima do grid e em um segundo arquivo para download,
`Relatorio_Analise_Medição.xlsx`, com cinco abas (resumo executivo e uma por situação).

> **Ressalva conhecida:** o arquivo é gerado, relido e conferido célula a célula contra o
> modelo por teste automatizado, mas **nunca foi aberto no Excel** — `openpyxl` relê
> perfeitamente o que ele mesmo escreveu, o que não garante que o Excel o exiba igual. Pende
> do insumo `K-01`.

---

## 4. Como se usa

```
1.  Abrir a aplicação
2.  Enviar o contrato (PDF, com aditivos se houver) e o levantamento (XLSX)
3.  Confirmar a identidade do par, se o sistema perguntar
4.  Clicar em "Gerar relatório"
5.  Ler as validações — se houver bloqueio, nada é gerado
6.  Ler o grid de divergências na tela, já classificado por situação
7.  Baixar o .docx e o Relatorio_Analise_Medição.xlsx
```

A geração leva **cerca de 22 segundos**, medido em produção — dois terços do tempo estão na
renderização do `.docx`. Está abaixo do limite de 40 s a partir do qual otimizar deixaria de
ser opcional.

Nada é persistido. O serviço não guarda arquivo, resultado nem histórico: recebe, processa,
devolve e esquece. A planilha de medição original traz registros nominais de servidores
públicos (1.021 linhas em `Usuários` e 363 em `Office365` no piloto; 997 em `Usuários` no
PGM), e essa é uma das razões da decisão.

---

## 5. As regras que mudam o número

Estas são as regras de negócio com efeito visível no resultado. As demais estão na
[ESPEC 001 §5](../specs/001-mvp-analise-medicao.md) e na
[ESPEC 018](../specs/018-o-relatorio-segue-o-contrato.md).

### 5.1 De onde vem cada quantidade — regra invertida em relação ao desenho original

| Quantidade | Fonte | Observação |
|---|---|---|
| **Contratada** | Coluna "Quantidade Contratada" da aba `Levantamento` | Mudou. Até a ESPEC 018, a fonte era o contrato e a coluna da planilha era ignorada; a regra foi **revogada** (`R-CTR-01` cai, `D-05`) porque, no PGM, é a planilha que está atualizada e o contrato que está defasado — o inverso do piloto |
| **Medida** | Coluna "Quantidade Medida" da aba `Levantamento` | Sem mudança |

**O contrato continua indispensável**, mas para outra coisa: dá a **ordem** das linhas, a
**descrição** e a **unidade**, aplica os **aditivos** em sequência, e alimenta uma
**checagem cruzada** — quando a quantidade contratada que o contrato calcula diverge da que
a planilha declara, o sistema **avisa** (não corrige, não decide): é a validação `V-REC-01`,
que hoje é a única linha de defesa contra uma planilha errada nos códigos que os aditivos
tocam.

Quando o mesmo código aparece em várias linhas da planilha, as quantidades são resolvidas
pela regra do desconto de desenvolvimento (§5.2) — não há mais catálogo para tratar
qualificadores.

### 5.2 Sempre descontar recursos de desenvolvimento

Quando um código aparece mais de uma vez na planilha, prevalece a ocorrência **descontada de
recursos de desenvolvimento**. Desde a ESPEC 031, essa regra é aplicada **pela seção inteira**
da apuração, não célula a célula — o que corrigiu o único item crítico que o piloto chegava a
apresentar.

### 5.3 Itens de perfil e pacote entram como `1 / 1`

Perfis e pacotes contam por unidade contratual, não por quantidade, e entram sempre como 1
contratado e 1 medido — independentemente do conteúdo da planilha.

**Consequência que precisa ser conhecida:** o banco de dados `14.048.00008.00`, **contratado
no perfil D e medido no perfil C**, continua aparecendo como se não houvesse diferença
nenhuma. A ESPEC 021 tornou essa inferência **visível na tela**, ao lado do que a planilha
trazia — mas o resultado do relatório e da análise não muda; a ressalva pende de um insumo de
negócio para decidir se a diferença de perfil deveria contar como divergência.

### 5.4 O que o documento formal omite — e a tela mostra

| Situação | No `.docx` | Na tela |
|---|---|---|
| Item medido sem cobertura contratual (`DEMAIS ITENS DO LEVANTAMENTO`) | **Omitido** | **Exibido**, em bloco próprio |
| Item com as duas quantidades zeradas | **Omitido** (não prova nem desmente nada) | Continua no grid, na análise e na API |

O documento reproduz o modelo institucional porque é peça de processo administrativo e
precisa ser reconhecível ao lado do que já existe. **O achado não se perde: ele muda de
lugar, para a tela.**

---

## 6. As validações — o sistema avisa em vez de inventar

Antes de gerar, um conjunto de verificações nomeadas roda sobre as entradas — hoje **24
regras ativas** (identificadas `V-XXX-NN`), distribuídas por área: contrato (7), aditivo (4),
medição (4), anexo (2), identidade do par (3), reconciliação (2), órgão na capa (1), tipo de
arquivo submetido (1). Cada uma tem três efeitos possíveis:

- **BLOQUEIA** — nada é gerado. A resposta traz os achados e **nenhum documento, nenhuma
  linha**. Nunca um relatório parcial.
- **AVISA** — o documento é gerado, com a ressalva registrada e exibida, com título em
  português e ação recomendada (ESPEC 023, 043 e 044) — não apenas um código técnico.
- **PERGUNTA** — só existe para a checagem de identidade do par (ESPEC 029): quando contrato
  e planilha parecem ser de instrumentos diferentes, o sistema pede confirmação antes de
  emitir; confirmado o par, o mesmo achado é registrado como aviso, não como bloqueio.

Exemplos confirmados no código, por efeito:

| Verificação | Efeito |
|---|---|
| A tabela de itens não foi localizada no contrato | BLOQUEIA |
| A soma dos itens do contrato não bate com o `TOTAL` declarado (checksum) | BLOQUEIA |
| O arquivo submetido não é a proposta comercial | BLOQUEIA |
| Nada foi extraído da peça submetida (aditivo ou proposta) | BLOQUEIA |
| A mesma peça foi submetida mais de uma vez | BLOQUEIA |
| A aba `Levantamento` não foi encontrada ou está vazia | BLOQUEIA |
| Contrato e planilha parecem ser de contratos diferentes | PERGUNTA (AVISA após confirmação) |
| Quantidade contratada diverge entre o contrato (com aditivos) e a planilha | AVISA |
| Código do contrato sem registro de uso na planilha desta competência | AVISA |
| Aditivo lido não altera nenhum item do contrato | AVISA |
| Cabeçalho de colunas não localizado em um ou mais anexos | AVISA |
| Data do levantamento ou contrato de referência ausente no cabeçalho da aba | AVISA |

A lista completa está em `backend/src/infrastructure/validations/` (cinco módulos, por área)
e na [ESPEC 001 §6](../specs/001-mvp-analise-medicao.md). O princípio segue o mesmo:
**nenhum item pode receber quantidade zero por falha silenciosa de extração.**

---

## 7. Sem IA, e por quê

As duas entradas são geradas por sistema e legíveis por máquina. Não há documento
digitalizado, não há interpretação semântica, não há julgamento — apenas correspondência por
código de serviço exato.

Introduzir OCR ou LLM aqui adicionaria custo por execução, latência, não-determinismo e uma
superfície de erro que o problema não tem.

**O sistema é determinístico: a mesma entrada produz sempre o mesmo relatório.** Duas
execuções com os mesmos arquivos geram documentos de conteúdo idêntico — inclusive byte a
byte no XML das células dos anexos (ESPEC 026).

---

## 8. O critério de aceite, e o que ele já provou

O aceite do projeto é o **teste-âncora** (`tests/test_anchor_por_codigo.py`), que gera o
relatório a partir dos dois pares reais validados — SMIT (piloto) e PGM — e confere **por
código** contra as páginas 2 e 3 do respectivo relatório-modelo.

A comparação deixou de ser posicional (célula a célula, por linha) desde que o documento
passou a seguir a ordem do contrato sem agrupamento por seção (ESPEC 018): hoje o que o teste
prova é que **os números de cada código estão certos e nenhuma linha se perdeu**, não mais que
a linha N do modelo bate com a linha N do gerado.

Uma divergência real permanece declarada dentro do próprio teste, e é o achado que melhor
demonstra o valor da ferramenta:

| Fonte | `11.027.00001.00` — Certificado Digital SSL |
|---|---|
| Contrato, aditivo e planilha de levantamento | **10** |
| **Relatório-modelo, produzido à mão** | **6** |

O aditivo altera três itens do relatório-modelo; dois trazem o valor novo, só este traz o
antigo — indício de que o modelo não incorporou o aumento. **A conferência manual não pegou;
a ferramenta pegou.** Pende de confirmação da área de negócio (insumo `I-01`).

---

## 9. Acessibilidade

A camada que o usuário opera — formulário, painel de resultado e grid — está em conformidade
**WCAG 2.1 nível AA** (ESPEC 008): foco visível, região viva que anuncia o processamento,
tabelas com nome acessível e cabeçalhos marcados, contraste verificado token a token, nenhuma
informação dependente só de cor ou de cursor.

A verificação **por tecnologia assistiva** (leitor de tela real, não só mecanismo automático)
está descrita na [ESPEC 016](../specs/016-verificacao-por-tecnologia-assistiva.md), mas
permanece com status **Proposta** — ainda não executada.

---

## 10. O que o sistema **não** faz

| Fora do escopo | Motivo |
|---|---|
| Calcular valores financeiros | O relatório-alvo é de quantidades, não de preços |
| Consolidar **dois contratos diferentes** numa mesma execução | Um único instrumento por vez — aditivos do mesmo contrato já são consolidados automaticamente (§2) |
| Comparar **perfis** (D contratado × C medido) | O layout de duas colunas numéricas não comporta a informação — ver §5.3 |
| Guardar histórico entre competências | O serviço é sem estado, por decisão |
| Autenticação, cadastro, multiusuário | Ver §12 — hoje é pendência de negócio explícita, não só escolha de escopo |
| Recomendar ação por item divergente | Classificar por gravidade é da aplicação; decidir o que fazer é do negócio. (Avisos e bloqueios do sistema, por outro lado, já trazem ação recomendada — §6) |
| Filtro, busca ou ordenação no grid | 37 linhas cabem numa rolagem; a classificação por gravidade torna o filtro desnecessário |

---

## 11. Estado das capacidades

| Capacidade | Situação |
|---|---|
| Extração do contrato em PDF (com aditivos) | ✅ dois contratos reais, de geometrias diferentes, checksum exato |
| Leitura da medição em XLSX | ✅ 74 itens, desconto de desenvolvimento aplicado por seção |
| Universo do relatório | ✅ a aba `Levantamento`, ordenada pelo contrato — **sem catálogo** |
| Reconciliação e validações | ✅ 58 linhas no piloto, 58 no PGM, sem agrupamento por seção |
| Documento `.docx` | ✅ gerado para os dois pares reais, com capa derivada da peça submetida |
| Anexos de detalhamento | ✅ 19 anexos, ~41 páginas |
| Grid de divergências na tela | ✅ 37 de 58 itens |
| Identidade do par submetido | ✅ conferida antes de gerar; pergunta se divergir |
| Análise da medição (4 situações + XLSX) | ✅ implementada — XLSX nunca conferido no Excel (insumo `K-01`) |
| Identidade Confere e rodapé institucional | ✅ |
| Acessibilidade WCAG 2.1 AA da interação | ✅, com verificação por tecnologia assistiva ainda em proposta (ESPEC 016) |
| Empacotamento em container | ✅ construído e publicado |
| Hospedagem | ✅ no ar em Azure Container Apps, sem autenticação (§12) |

---

## 12. Limitações conhecidas

As que afetam a leitura do resultado:

1. **A quantidade do certificado digital diverge do modelo** — §8. Pende de decisão de
   negócio (`I-01`).
2. **Itens de perfil perdem informação** — §5.3. Perfil menor que o contratado é diferença
   comercialmente relevante e hoje não muda o resultado.
3. **Consumo sem previsão contratual não entra no documento** — aparece só na tela (§5.4).
4. **O relatório de análise em XLSX nunca foi aberto no Excel** — só relido e conferido por
   `openpyxl`, que relê perfeitamente o que ele mesmo escreveu. Pende do insumo `K-01`.
5. **A quebra de página não coincide com a do modelo.** As alturas de linha diferem. Não
   afeta o conteúdo.
6. **Um único contrato por execução** — sem consolidação de dois instrumentos diferentes.
7. **A aplicação não tem autenticação.** Está publicada com acesso externo direto nos dois
   containers, e o `.docx` carrega dados nominais de servidor público (login, nome, e-mail).
   É tratada como **pendência de negócio, não técnica**, e precisa ser resolvida antes de a
   ferramenta sair de demonstração.
8. **As regras vieram originalmente de um único caso**, mas isso já foi parcialmente
   endereçado: um segundo contrato real (PGM, outro órgão, outra geometria) roda de ponta a
   ponta desde a ESPEC 018. Um terceiro é que provaria de vez que o desenho generaliza.
9. **A geração leva cerca de 22 segundos** em produção — dois terços na renderização do
   `.docx`. Abaixo do limite (40 s) que tornaria uma otimização adicional obrigatória.

---

## 13. Glossário

| Termo | Significado neste sistema |
|---|---|
| **Competência** | O mês a que a medição se refere |
| **Contratada** | Quantidade "Quantidade Contratada" declarada na aba `Levantamento` da planilha (não mais o contrato — ver §5.1) |
| **Medida** | Quantidade efetivamente apurada no período, lida da aba `Levantamento` |
| **Saldo** | `contratada − medida`. Negativo significa consumo acima do contratado |
| **Divergência** | Item em que contratada ≠ medida |
| **Item crítico** | Item medido acima do contratado — consumo sem cobertura contratual |
| **Aditivo** | Alteração contratual posterior à proposta original — `Inclusão`, `Exclusão`, `Aumento` ou `Redução` de item, aplicada em sequência |
| **Identidade do par** | Checagem de que contrato e planilha declaram o mesmo instrumento contratual, antes de processar |
| **`DEMAIS ITENS DO LEVANTAMENTO`** | Bloco com os itens que a planilha traz e o contrato não conhece — sem previsão contratual |
| **Catálogo** | Mecanismo de apresentação removido pela ESPEC 018; não existe mais no sistema |
| **Relatório de comprovação** | O `.docx` que instrui o faturamento |
| **Relatório de análise** | O `Relatorio_Analise_Medição.xlsx`, que classifica os itens por gravidade |
| **Teste-âncora** | Comparação por código do documento gerado com o modelo real — o critério de aceite |

---

## 14. Para aprofundar

| Assunto | Documento |
|---|---|
| Regras de negócio completas, validações e fluxo | [ESPEC 001](../specs/001-mvp-analise-medicao.md) |
| Grid de divergências | [ESPEC 002](../specs/002-painel-de-divergencias.md) |
| Documento em DOCX e identidade PRODAM | [ESPEC 003](../specs/003-relatorio-em-docx.md) |
| Os 19 anexos | [ESPEC 004](../specs/004-anexos-de-detalhamento.md) |
| Marca, rodapé e barra de aplicação | [ESPEC 005](../specs/005-identidade-confere.md) · [006](../specs/006-rodape-institucional.md) · [007](../specs/007-barra-de-aplicacao.md) |
| Acessibilidade | [ESPEC 008](../specs/008-acessibilidade-da-interacao.md) · [016](../specs/016-verificacao-por-tecnologia-assistiva.md) (proposta) |
| Análise da medição por gravidade | [ESPEC 009](../specs/009-analise-da-medicao.md) |
| O catálogo sai, o universo passa a ser a aba | [ESPEC 018](../specs/018-o-relatorio-segue-o-contrato.md) |
| Aditivos contratuais | [ESPEC 019](../specs/019-contrato-e-aditivos.md) · [ESPEC 022](../specs/022-o-contratado-e-a-proposta-mais-os-aditivos.md) |
| Capa derivada da peça submetida | [ESPEC 020](../specs/020-capa-do-documento.md) |
| Identidade do par contrato/planilha | [ESPEC 029](../specs/029-o-par-que-nao-e-do-mesmo-contrato.md) |
| Decisões que mudaram o rumo | [CHANGELOG](../CHANGELOG.md) |
| Como executar, hospedar e testar | [README](../../README.md) |
| Apresentação a público não técnico | [Roteiro de demonstração](../roteiro-demonstracao.md) |
