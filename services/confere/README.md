# Análise de Medição Contratual — MVP

Compara o que foi **contratado** com o que foi **medido** e gera o relatório de
comprovação que instrui o faturamento.

**Dois arquivos entram, dois saem**: o `.docx` de ~41 páginas sobre o papel
timbrado da PRODAM, que instrui o faturamento, e o
`Relatorio_Analise_Medição.xlsx`, que classifica cada item por gravidade.
Serviço sem estado: nada é persistido.

---

## 📋 Visão Geral

O Confere compara o que foi **contratado** com o que foi **medido** num
contrato de prestação de serviços e gera o relatório de comprovação que
instrui o faturamento. Dois arquivos entram — o contrato em PDF e a planilha
de medição em XLSX — e dois saem: o `.docx` sobre o papel timbrado da PRODAM,
que segue para o órgão, e o `Relatorio_Analise_Medição.xlsx`, que classifica
cada item por gravidade. Serviço sem estado: nada é persistido entre uma
execução e outra.

## ✨ Características Principais

### 📄 Leitura dos documentos de entrada
- Extração do contrato em PDF: código, descrição e quantidade contratada de
  cada item, com a grade de colunas derivada do próprio documento
- Leitura da planilha de medição (XLSX): quantidade medida por código, a
  partir da aba `Levantamento`
- Verificação de identidade do par: antes de processar, o sistema confere se
  contrato e planilha declaram o mesmo instrumento contratual — e pergunta ao
  usuário quando há divergência, em vez de assumir
- Aditivos contratuais: `Inclusão`, `Exclusão`, `Aumento` e `Redução` de
  itens, aplicados em sequência sobre a proposta original

### 📊 Análise da medição
- Classificação automática de cada item em quatro situações: crítico, sem
  medição, parcial e conforme
- Regra do desconto de desenvolvimento aplicada por bloco: onde a planilha
  repete o mesmo código, prevalece o valor que desconta recursos de
  desenvolvimento
- Itens sem cobertura contratual (medidos mas ausentes do contrato) aparecem
  à parte, sem serem escondidos
- Item com as duas quantidades zeradas (sem contratado e sem medido) não
  entra no relatório final, pois não prova nem desmente nada

### 📑 Geração de relatórios
- Relatório `.docx` sobre o papel timbrado institucional, com capa derivada
  da peça submetida (cliente, contrato e propostas)
- 19 anexos de detalhamento (~41 páginas), reproduzindo orientação, largura
  de coluna, altura de linha e figuras do relatório GRC de origem
- Relatório `Relatorio_Analise_Medição.xlsx`, com cinco abas classificando
  cada item por gravidade
- Avisos e bloqueios com título em português e ação recomendada, não apenas
  código técnico

### 🖥️ Interface web
- Grid de divergências na tela, na mesma ordem do relatório final
- Resposta responsiva durante a geração do documento (o servidor não fica
  mudo enquanto processa)
- Verificação de acessibilidade da camada de interação

## 📖 Uso — Fluxo Básico

1. **Envie os dois arquivos**: o contrato em PDF e a planilha de medição em
   XLSX
2. **Confirme a identidade do par**, se o sistema perguntar (contrato e
   planilha declaram instrumentos diferentes)
3. **Acompanhe a extração**: o sistema lê o contrato e a aba `Levantamento`,
   item a item
4. **Revise no grid de divergências**: os itens aparecem classificados por
   situação (crítico, sem medição, parcial, conforme)
5. **Baixe o relatório**: `.docx` timbrado, pronto para instruir o
   faturamento, e o `Relatorio_Analise_Medição.xlsx` com o detalhamento por
   gravidade

---

| Documento | |
|---|---|
| Especificação | [ESPEC 001](docs/specs/001-mvp-analise-medicao.md) — MVP, implementada |
| Incremento 002 | [ESPEC 002](docs/specs/002-painel-de-divergencias.md) — grid de divergências, implementada |
| Incremento 003 | [ESPEC 003](docs/specs/003-relatorio-em-docx.md) — relatório em DOCX, implementada |
| Incremento 004 | [ESPEC 004](docs/specs/004-anexos-de-detalhamento.md) — anexos de detalhamento, implementada |
| Incremento 005 | [ESPEC 005](docs/specs/005-identidade-confere.md) — a marca Confere na interface, implementada |
| Incremento 006 | [ESPEC 006](docs/specs/006-rodape-institucional.md) — rodapé institucional, implementada |
| Incremento 007 | [ESPEC 007](docs/specs/007-barra-de-aplicacao.md) — barra de aplicação, implementada com uma regra em aberto |
| Incremento 008 | [ESPEC 008](docs/specs/008-acessibilidade-da-interacao.md) — acessibilidade da camada de interação, implementada com um portão pendente de insumo |
| Incremento 009 | [ESPEC 009](docs/specs/009-analise-da-medicao.md) — análise da medição: classificação em quatro situações, painel na tela e `Relatorio_Analise_Medição.xlsx`, implementada com um portão pendente de insumo |
| Incremento 010 | [ESPEC 010](docs/specs/010-cor-das-faixas-do-grid.md) — cor das faixas do grid, implementada |
| Incremento 012 | [ESPEC 012](docs/specs/012-responsividade-durante-a-geracao.md) — responsividade durante a geração: o servidor deixa de ficar mudo enquanto trabalha, implementada |
| Incremento 013 | [ESPEC 013](docs/specs/013-quantidade-em-coluna-unica.md) — a quantidade volta a ocupar uma coluna no XLSX, com a grafia vindo do formato de célula, implementada com um portão pendente de insumo |
| Incremento 014 | [ESPEC 014](docs/specs/014-bordas-nas-areas-vazias-do-anexo.md) — sem bordas onde o anexo não tem conteúdo: a tabela termina onde o conteúdo dela termina e a linha de respiro perde a moldura, implementada |
| Plano | [PLANO 001](docs/plans/001-plano-implementacao-mvp.md) · [PLANO 003](docs/plans/003-plano-relatorio-em-docx.md) · [PLANO 004](docs/plans/004-plano-anexos-de-detalhamento.md) · [PLANO 008](docs/plans/008-plano-acessibilidade-da-interacao.md) · [PLANO 009](docs/plans/009-plano-analise-da-medicao.md) |
| Backlog | [TASKS 001](docs/tasks/001-tasks-implementacao-mvp.md) · [TASKS 002](docs/tasks/002-tasks-grid-divergencias.md) · [TASKS 003](docs/tasks/003-tasks-relatorio-em-docx.md) · [TASKS 004](docs/tasks/004-tasks-anexos-de-detalhamento.md) · [TASKS 008](docs/tasks/008-tasks-acessibilidade-da-interacao.md) · [TASKS 009](docs/tasks/009-tasks-analise-da-medicao.md) |
| Incremento 015 | [ESPEC 015](docs/specs/015-limpar-para-recomecar.md) · [PLANO 015](docs/plans/015-plano-limpar-para-recomecar.md) · [TASKS 015](docs/tasks/015-tasks-limpar-para-recomecar.md) — limpar para recomeçar: botão com confirmação que devolve a tela ao início sem recarregar, e a correção do vazamento dos dois documentos em memória. Implementada; aceite do texto pendente |
| Incremento 016 | [ESPEC 016](docs/specs/016-verificacao-por-tecnologia-assistiva.md) · [PLANO 016](docs/plans/016-plano-verificacao-por-tecnologia-assistiva.md) · [TASKS 016](docs/tasks/016-tasks-verificacao-por-tecnologia-assistiva.md) — verificação por tecnologia assistiva: o que é mecanismo vira teste, o que é percepção vira roteiro de cinco minutos. **Proposta** |
| Incremento 017 | [ESPEC 017](docs/specs/017-grade-do-contrato-derivada-do-documento.md) · [PLANO 017](docs/plans/017-plano-grade-do-contrato-derivada-do-documento.md) · [TASKS 017](docs/tasks/017-tasks-grade-do-contrato-derivada-do-documento.md) — a grade da tabela de itens é derivada do documento, implementada |
| Incremento 018 | [ESPEC 018](docs/specs/018-o-relatorio-segue-o-contrato.md) · [PLANO 018](docs/plans/018-plano-o-relatorio-segue-o-contrato.md) · [TASKS 018](docs/tasks/018-tasks-o-relatorio-segue-o-contrato.md) — o relatório segue o levantamento, ordenado pelo contrato; o catálogo sai, implementada |
| Incremento 019 | [ESPEC 019](docs/specs/019-contrato-e-aditivos.md) — aditivos: o que entra e o que sai da proposta — `Inclusão`, `Exclusão`, `Aumento` e `Redução`, aplicados em sequência, implementada |
| Incremento 020 | [ESPEC 020](docs/specs/020-capa-do-documento.md) · [PLANO 020](docs/plans/020-plano-capa-do-documento.md) · [TASKS 020](docs/tasks/020-tasks-capa-do-documento.md) — a capa é do contrato que o documento comprova: cliente, contrato e propostas passam a sair da peça submetida, implementada com um portão pendente de conferência no Word |
| Incremento 021 | [ESPEC 021](docs/specs/021-a-celula-que-virou-1-1.md) · [PLANO 021](docs/plans/021-plano-a-celula-que-virou-1-1.md) · [TASKS 021](docs/tasks/021-tasks-a-celula-que-virou-1-1.md) — a célula que virou 1/1: a inferência de perfil ou pacote passa a ser visível, com o que a planilha trazia ao lado do que o sistema emitiu, implementada com um portão pendente de insumo |
| Incremento 022 | [ESPEC 022](docs/specs/022-o-contratado-e-a-proposta-mais-os-aditivos.md) · [PLANO 022](docs/plans/022-plano-o-contratado-e-a-proposta-mais-os-aditivos.md) · [TASKS 022](docs/tasks/022-tasks-o-contratado-e-a-proposta-mais-os-aditivos.md) — o contratado é a proposta **mais** os seus aditivos: os quatro rótulos passam a valer, e a lista de supressão da `V-REC-01` sai, implementada |
| Incremento 023 | [ESPEC 023](docs/specs/023-o-aviso-que-diz-o-que-fazer.md) · [PLANO 023](docs/plans/023-plano-o-aviso-que-diz-o-que-fazer.md) · [TASKS 023](docs/tasks/023-tasks-o-aviso-que-diz-o-que-fazer.md) — o aviso que diz o que fazer: a divergência entre contrato e planilha ganha origem, sinal e ação, implementada com um portão pendente de insumo |
| Incremento 024 | [ESPEC 024](docs/specs/024-o-asterisco-que-explica-o-bloco-final.md) · [PLANO 024](docs/plans/024-plano-o-asterisco-que-explica-o-bloco-final.md) · [TASKS 024](docs/tasks/024-tasks-o-asterisco-que-explica-o-bloco-final.md) — o asterisco que explica o bloco final, implementada |
| Incremento 025 | [ESPEC 025](docs/specs/025-o-arquivo-que-nao-e-a-proposta.md) · [PLANO 025](docs/plans/025-plano-o-arquivo-que-nao-e-a-proposta.md) · [TASKS 025](docs/tasks/025-tasks-o-arquivo-que-nao-e-a-proposta.md) — o arquivo que não é a proposta: o bloqueio passa a nomear a peça e a dizer qual enviar, implementada com um portão pendente de insumo |
| Incremento 026 | [ESPEC 026](docs/specs/026-o-mesmo-documento-em-um-quinto-do-tempo.md) · [PLANO 026](docs/plans/026-plano-o-mesmo-documento-em-um-quinto-do-tempo.md) · [TASKS 026](docs/tasks/026-tasks-o-mesmo-documento-em-um-quinto-do-tempo.md) — o mesmo documento em um quinto do tempo: o XML das células passa a ser montado em vez de pedido, com identidade de bytes conferida por teste, implementada *(o cabeçalho da própria ESPEC ainda diz "Proposta" — é o texto que está defasado, não o código)* |
| Incremento 027 | [ESPEC 027](docs/specs/027-a-planilha-que-o-confere-nao-leu.md) · [PLANO 027](docs/plans/027-plano-a-planilha-que-o-confere-nao-leu.md) · [TASKS 027](docs/tasks/027-tasks-a-planilha-que-o-confere-nao-leu.md) — a planilha que o Confere não leu: sessenta achados para uma causa viram um, implementada |
| Incremento 028 | [ESPEC 028](docs/specs/028-a-linha-que-nao-diz-nada.md) · [PLANO 028](docs/plans/028-plano-a-linha-que-nao-diz-nada.md) · [TASKS 028](docs/tasks/028-tasks-a-linha-que-nao-diz-nada.md) — a linha que não diz nada: o bloco final do `.docx` deixa de desenhar a linha sem quantidade contratada nem medida, implementada |
| Incremento 029 | [ESPEC 029](docs/specs/029-o-par-que-nao-e-do-mesmo-contrato.md) · [PLANO 029](docs/plans/029-plano-o-par-que-nao-e-do-mesmo-contrato.md) · [TASKS 029](docs/tasks/029-tasks-o-par-que-nao-e-do-mesmo-contrato.md) — o par que não é do mesmo contrato: o Confere pergunta, antes de processar, se os arquivos falam do mesmo instrumento — e aceita a resposta de quem confere, implementada |
| Incremento 030 | [ESPEC 030](docs/specs/030-o-vermelho-que-virou-paisagem.md) · [PLANO 030](docs/plans/030-plano-o-vermelho-que-virou-paisagem.md) · [TASKS 030](docs/tasks/030-tasks-o-vermelho-que-virou-paisagem.md) — o vermelho que virou paisagem: dez testes de tela reancorados contra a fonte, e duas regras revistas por terem perdido a premissa, implementada |
| Incremento 031 | [ESPEC 031](docs/specs/031-o-zero-que-a-planilha-nao-escreveu.md) · [PLANO 031](docs/plans/031-plano-o-zero-que-a-planilha-nao-escreveu.md) · [TASKS 031](docs/tasks/031-tasks-o-zero-que-a-planilha-nao-escreveu.md) — o zero que a planilha não escreveu: a apuração que desconta desenvolvimento passa a valer pela seção inteira, e o código que ela omite mede zero. **O único item crítico do piloto era artefato de leitura**, implementada |
| Incremento 032 | [ESPEC 032](docs/specs/032-a-frase-que-virou-a-pagina.md) · [PLANO 032](docs/plans/032-plano-a-frase-que-virou-a-pagina.md) · [TASKS 032](docs/tasks/032-tasks-a-frase-que-virou-a-pagina.md) — a frase que virou a página: a linha de item que atravessa a quebra de página deixa de perder a cauda da descrição, e o crivo de coluna impede que prosa de outra seção entre no lugar dela, implementada |
| Incremento 033 | [ESPEC 033](docs/specs/033-as-tres-tabelas-na-mesma-folha.md) · [PLANO 033](docs/plans/033-plano-as-tres-tabelas-na-mesma-folha.md) · [TASKS 033](docs/tasks/033-tasks-as-tres-tabelas-na-mesma-folha.md) — as três tabelas na mesma folha: cada linha da tabela passa a ser lida com as divisórias **da tabela a que pertence**, e não com as da página. O aditivo do SMUL, que era recusado com `422`, extrai 16 itens em três blocos — e os dez documentos que já liam saem com as tuplas de item idênticas, `sha` por `sha`, implementada |
| Incremento 034 | [ESPEC 034](docs/specs/034-o-orgao-que-vem-antes-da-frase.md) · [PLANO 034](docs/plans/034-plano-o-orgao-que-vem-antes-da-frase.md) · [TASKS 034](docs/tasks/034-tasks-o-orgao-que-vem-antes-da-frase.md) — o órgão que vem antes da frase: o nome do cliente passa a ser derivado do **sintagma institucional cortado na sigla**, e não de uma frase-gatilho fixa. Duas peças reais que não derivavam passam a derivar, e a peça é identificada pelo código que declara, seja aditivo ou proposta comercial, implementada |
| Incremento 035 | [ESPEC 035](docs/specs/035-a-linha-que-ficou-acima-da-moldura.md) · [PLANO 035](docs/plans/035-plano-a-linha-que-ficou-acima-da-moldura.md) · [TASKS 035](docs/tasks/035-tasks-a-linha-que-ficou-acima-da-moldura.md) — a linha que ficou acima da moldura: a extração passa a **contar** o que a grade descarta, e `V-CTR-03` deixa de dizer só *quanto* falta para dizer também *onde*; e o traço que separa o nome do órgão da sigla passa a ser uma classe — hífen, travessões e sinal de menos —, não o hífen ASCII literal. e a fronteira superior da grade passa a ser sintetizada quando há linha de item acima da moldura desenhada — o espelho da síntese de rodapé que existe desde a ESPEC 001. Os oito documentos do corpus saem com as tuplas de item idênticas, `sha` por `sha`, implementada |
| Incremento 038 | [ESPEC 038](docs/specs/038-o-aviso-que-ficou-embaixo-de-tres-tabelas.md) · [PLANO 038](docs/plans/038-plano-o-aviso-que-ficou-embaixo-de-tres-tabelas.md) · [TASKS 038](docs/tasks/038-tasks-o-aviso-que-ficou-embaixo-de-tres-tabelas.md) — o aviso que ficou embaixo de três tabelas: no estado *pronto*, o bloco âmbar sai do fim da página e entra logo abaixo da faixa de resultado, com cabeçalho próprio e a contagem que estava na faixa. Aviso é achado de validação, não ressalva — chegava quarenta linhas depois do botão que baixa o documento que ele ressalva. Nenhuma linha de `backend/`; as ressalvas (linhas derivadas e divergência de fonte) não se movem, implementada |
| Incremento 040 | [ESPEC 040](docs/specs/040-o-mes-que-veio-com-dias.md) · [PLANO 040](docs/plans/040-plano-o-mes-que-veio-com-dias.md) · [TASKS 040](docs/tasks/040-tasks-o-mes-que-veio-com-dias.md) — o mês que veio com dias: `meses` deixa de ser campo bloqueante na extração — célula como "2 meses e 14 dias" (a cauda de um contrato que não fecha em mês cheio) passa a virar aviso (`V-CTR-07`), em vez de recusar a submissão inteira. Não é consumido em lugar nenhum do backend. Os dez documentos do corpus saem com as tuplas de item idênticas, implementada com um segundo defeito, independente, registrado em aberto (`I-04`) |
| Incremento 041 | [ESPEC 041](docs/specs/041-a-regua-da-tabela-errada.md) · [PLANO 041](docs/plans/041-plano-a-regua-da-tabela-errada.md) — a régua da tabela errada: uma linha sem faixa própria de oito só é lida pelas divisórias da página quando elas forem uma geometria de item que o documento realmente usa, não por padrão. Corrige a leitura de uma linha de tabela de escopo como se fosse item de preço; os dez documentos do corpus saem com as tuplas de item idênticas, implementada com um ponto em aberto (total declarado em prosa, `I-01`) |
| Incremento 042 | [ESPEC 042](docs/specs/042-o-total-que-nao-tinha-total.md) · [PLANO 042](docs/plans/042-plano-o-total-que-nao-tinha-total.md) · [TASKS 042](docs/tasks/042-tasks-o-total-que-nao-tinha-total.md) — o total que não tinha TOTAL:: quando a linha `TOTAL:` não existe, o total do contrato passa a ser encontrado cruzando a frase em prosa com a linha `TOTAL` do cronograma físico-financeiro — só aceita quando as duas concordam, nunca uma fonte só. Os dez documentos do corpus não se movem, implementada com um ponto em aberto (a ordem de colunas do aditivo real da CGM, `I-01`) |
| Incremento 043 | [ESPEC 043](docs/specs/043-o-cartao-sem-titulo.md) · [PLANO 043](docs/plans/043-plano-o-cartao-sem-titulo.md) · [TASKS 043](docs/tasks/043-tasks-o-cartao-sem-titulo.md) — o cartão sem título: sete avisos (`V-CTR-04`, `V-CTR-06`, `V-CTR-07`, `V-ADT-02`, `V-ADT-04`, `V-MED-03`, `V-MED-04`) passam a exibir título em português e ação, com o técnico recolhido — mesmo formato que a ESPEC 025 já usa nos bloqueios. `V-CAP-01`, `V-CTR-05` e as validações de bloqueio ficam para entregas próprias, implementada |
| Incremento 044 | [ESPEC 044](docs/specs/044-as-duas-que-sobraram.md) · [PLANO 044](docs/plans/044-plano-as-duas-que-sobraram.md) · [TASKS 044](docs/tasks/044-tasks-as-duas-que-sobraram.md) — as duas que sobraram: `V-CAP-01` e `V-CTR-05` — os dois avisos que originaram a série — ganham título em português e ação, fechando a Fase B da ESPEC 043. `CartaoAgregado` (texto fixo, hoje só para `V-CTR-05`) segue como decisão em aberto, implementada |
| Incremento 045 | [ESPEC 045](docs/specs/045-a-ordem-que-nao-era-regra.md) · [PLANO 045](docs/plans/045-plano-a-ordem-que-nao-era-regra.md) · [TASKS 045](docs/tasks/045-tasks-a-ordem-que-nao-era-regra.md) — a ordem que não era regra: a ordem de preço, quantidade e período deixa de ser fixa por documento e passa a ser lida do cabeçalho de cada seção — a mesma geometria pode hospedar ordens diferentes, e o `PA-CGM-250912-127 v4.0` hospeda duas. Fecha o `I-01` da ESPEC 042: o aditivo real da CGM extrai 27 itens e o checksum fecha em R$ 6.110.655,79. Os nove documentos do corpus não se movem, implementada |
| Incremento 046 | [ESPEC 046](docs/specs/046-o-aditivo-que-virou-proposta.md) · [PLANO 046](docs/plans/046-plano-o-aditivo-que-virou-proposta.md) · [TASKS 046](docs/tasks/046-tasks-o-aditivo-que-virou-proposta.md) — o aditivo que virou proposta: `V-ADT-03` deixa de bloquear aditivo com bloco único sem rótulo — passa a ser tratado igual à proposta, sem checagem. **Remoção deliberada de proteção, não correção de bug**: esse aditivo agora é aceito e seus itens desaparecem do relatório sem aviso — decisão explícita do usuário, com o risco registrado e sem mitigação, implementada |
| Incremento 047 | [ESPEC 047](docs/specs/047-o-mes-que-virou-data-cheia.md) · [PLANO 047](docs/plans/047-plano-o-mes-que-virou-data-cheia.md) · [TASKS 047](docs/tasks/047-tasks-o-mes-que-virou-data-cheia.md) — o mês que virou data cheia: célula de data de anexo cujo formato do Excel não tem dia (só mês e/ou ano, como `mmm/aa`) passa a sair no `.docx` sem dia também, em vez de `dd/mm/aaaa` com um dia inventado. Completa a `R-ANX-07` da ESPEC 004 para o caso que a implementação nunca cobriu. Data completa continua fixa; nenhuma das 19 abas hoje configuradas tem célula no formato novo, implementada |
| Incremento 048 | [ESPEC 048](docs/specs/048-o-next-que-ficou-vinte-e-um-patches-atras.md) · [PLANO 048](docs/plans/048-plano-o-next-que-ficou-vinte-e-um-patches-atras.md) · [TASKS 048](docs/tasks/048-tasks-o-next-que-ficou-vinte-e-um-patches-atras.md) — o Next.js que ficou vinte e um patches atrás: `next`/`eslint-config-next` de `15.5.4` para `15.5.25`, fechando duas RCEs não autenticadas e as demais vulnerabilidades altas do `pnpm audit` (40 → 7 achados, zero críticas). Suíte E2E completa (127 casos) sem regressão, comparada antes e depois do bump, implementada |
| Incremento 049 | [ESPEC 049](docs/specs/049-o-respiro-maior-que-a-linha-de-dado.md) · [PLANO 049](docs/plans/049-plano-o-respiro-maior-que-a-linha-de-dado.md) · [TASKS 049](docs/tasks/049-tasks-o-respiro-maior-que-a-linha-de-dado.md) — o respiro maior que a linha de dado: célula de anexo sem texto passa a receber a mesma normalização de parágrafo que uma célula com texto já recebia, em vez de herdar o padrão do documento (8pt de espaço depois do parágrafo, fonte 12pt) — o que fazia o respiro entre faixas de título sair bem maior que a planilha de origem (medido: 25,4pt → 17,4pt na aba `Internet`, contrato CGM). Moveu deliberadamente o `.docx` do piloto e do PGM, e por isso reancorou `test_identidade_dos_artefatos.py` (`R-DES-01`), implementada |
| Incremento 051 | [ESPEC 051](docs/specs/051-o-cabecalho-que-ficou-pequeno-para-a-tabela.md) · [PLANO 051](docs/plans/051-plano-o-cabecalho-que-ficou-pequeno-para-a-tabela.md) · [TASKS 051](docs/tasks/051-tasks-o-cabecalho-que-ficou-pequeno-para-a-tabela.md) — o cabeçalho que ficou pequeno para a tabela: `Servidores` e `ServidoresSemDesenv` têm uma segunda tabela, de forma diferente, empilhada na mesma aba (resumo de 11 colunas seguido de um detalhe de 15) — o leitor só reconhecia a primeira, e a fileira de cabeçalho repetida a cada página saía com 4 de 15 colunas em branco. `cabecalhos_adicionais`, em `anexos.json`, declara âncoras extras, cada uma virando seu próprio corte com sua própria repetição de cabeçalho. Moveu deliberadamente o `.docx` do piloto e do PGM — os dois já carregavam o defeito —, e por isso reancorou `test_identidade_dos_artefatos.py` nos dois pacotes, implementada |
| Incremento 052 | [ESPEC 052](docs/specs/052-o-numero-que-foi-para-a-esquerda.md) · [PLANO 052](docs/plans/052-plano-o-numero-que-foi-para-a-esquerda.md) — o número que foi para a esquerda: célula de anexo passa a herdar o alinhamento horizontal declarado na aba (`left`/`center`/`right`) ou, sem ele, o comportamento "Geral" do Excel decidido pelo tipo do valor (número e data à direita, texto à esquerda) — em vez de sair sempre à esquerda, não importa o que a planilha dissesse. Medido em duas capturas de tela reais (aba `NAS`, contrato SMIT Sustentação): `Usado(GB)`/`Alocado(GB)` saíam coladas à esquerda no `.docx`, à direita na planilha. Moveu deliberadamente o `.docx` do piloto e do PGM, e por isso reancorou `test_identidade_dos_artefatos.py` nos dois pacotes, implementada |
| Incremento 053 | [ESPEC 053](docs/specs/053-a-marca-do-paragrafo-que-herdou-12pt.md) · [PLANO 053](docs/plans/053-plano-a-marca-do-paragrafo-que-herdou-12pt.md) · [TASKS 053](docs/tasks/053-tasks-a-marca-do-paragrafo-que-herdou-12pt.md) — a marca do parágrafo que herdou 12pt: `ooxml.escrever` passa a montar também a marca do parágrafo (`w:pPr/w:rPr`), não só a execução — sem ela, uma célula de anexo vazia (ou o separador entre segmentos de tabela) herdava os 12pt do documento para calcular a altura da linha, em vez do corpo do próprio anexo. Visível em `Comunicação Dados` (corpo 3,5pt, o menor dos 19): vãos medidos no Word real caíram de 17,47pt/linha para 5,45pt/linha, e de 30,94pt para 3,39pt. Moveu deliberadamente o `.docx` do piloto e do PGM, e por isso reancorou `test_identidade_dos_artefatos.py` nos dois pacotes, implementada |
| Incremento 054 | [ESPEC 054](docs/specs/054-o-cabecalho-errado-que-se-repetia-no-wifi.md) · [PLANO 054](docs/plans/054-plano-o-cabecalho-errado-que-se-repetia-no-wifi.md) — o cabeçalho errado que se repetia no WIFI: `WIFI` ganha `cabecalhos_adicionais` em `anexos.json` (o mesmo mecanismo da ESPEC 051, sem código novo) — a tabela `TIPO de TC` (21 linhas no piloto) passa a repetir o próprio cabeçalho ao quebrar página, em vez do cabeçalho do resumo (`Unidade | Quantidade Medida`). Moveu deliberadamente o `.docx` do piloto; o PGM não — achado na execução: a aba `WIFI` do PGM tem layout diferente e não estoura página, então não tem o defeito. Reancorou `test_identidade_dos_artefatos.py` só no piloto, implementada |
| Incremento 056 | [ESPEC 056](docs/specs/056-o-logo-do-rodape-que-virou-link-para-o-portal.md) · [PLANO 056](docs/plans/056-plano-o-logo-do-rodape-que-virou-link-para-o-portal.md) · [TASKS 056](docs/tasks/056-tasks-o-logo-do-rodape-que-virou-link-para-o-portal.md) — o rodapé que ganhou link no logo e nos ícones sociais: a marca PRODAM passa a linkar `https://portal.prodam.sp.gov.br/`, o ícone do Instagram `https://www.instagram.com/prodamsp/` e o do LinkedIn `https://br.linkedin.com/company/prodamsp`, os três em nova aba com `rel="noopener noreferrer"` e nome acessível próprio. O texto `/prodamsp` continua sem link — um único texto não pode apontar para dois destinos (revisa a ESPEC 006, D-06 e §10 ponto 1). Suíte e2e completa 131 passed (127 + 4 novos), implementada |
| Não implementadas | [ESPEC 011](docs/specs/011-ordenacao-pela-proposta.md) — ordenação das páginas 2 a 4 pela proposta comercial. **Proposta**, superada pela ESPEC 018 |
| Mudanças de rumo | [CHANGELOG](docs/CHANGELOG.md) |
| Referência de arquitetura | [TRIADE](docs/triade_referencia/README.md) |

---

## Estado atual

| Capacidade | Situação |
|---|---|
| Extração do contrato (PDF) | ✅ **dois contratos reais**, de geometrias diferentes, com checksum exato — grade derivada do documento |
| Leitura da medição (XLSX) | ✅ 74 itens, regra do desconto aplicada **por bloco** (ESPEC 031 `R-APU-02`): o código que a apuração descontada omite mede zero |
| Universo do relatório | ✅ a aba `Levantamento`, ordenada pelo contrato — **sem catálogo** |
| Reconciliação e validações | ✅ **58 linhas** no piloto e 58 no PGM, sem agrupamento |
| Geração do DOCX | ✅ **os dois pares reais geram**, com timbrado e com a **capa derivada da peça submetida** — cliente, contrato e propostas (ESPEC 020 `R-CAP-03`). Só a arte é do modelo |
| Anexos de detalhamento | ✅ 19 anexos, ~41 páginas, com **orientação, largura de coluna, altura de linha e figuras do GRC** |
| Grid de divergências na tela | ✅ **37 de 58 itens**, na ordem do relatório. Sem faixas de seção desde a ESPEC 018: a ordem passou a ser a do contrato, que não as tem (ESPEC 030 `D-07`) |
| Bloco final do documento | ✅ omite a linha que zera contratada **e** medida (ESPEC 028 `R-ZER-01`) — o dado continua no grid, na análise e na API. **No piloto ele esvaziou** com a ESPEC 031, e a `R-ZER-04` apaga faixa, asterisco e nota |
| Identidade do par submetido | ✅ contrato, levantamento e aditivos conferidos pelo **contrato que cada um declara**; par divergente **pergunta antes de emitir** (ESPEC 029 `R-IDT-10`) |
| Análise da medição | ✅ **58 itens em quatro situações** — **0 críticos**, 20 sem medição, 16 parciais, 22 conformes. *(Os três últimos números estavam defasados desde a ESPEC 018: eram 56/20/16/19 no texto e 58/1/20/16/21 na medição.)* |
| Relatório de análise em XLSX | ✅ cinco abas, 12,5 KB — **não conferido no Excel**, ver "Limitações" |
| API e interface web | ✅ operantes |
| Empacotamento em container | ✅ construído e publicado — ver "Hospedagem" |
| Hospedagem em Azure Container Apps | ✅ no ar, com *probes* e escala por concorrência |

---

## Executar

### Com Docker

```bash
docker compose up --build
```

Interface em <http://localhost:3000>, API em <http://localhost:8000>,
documentação interativa em <http://localhost:8000/docs>.

### Localmente, no Windows

```powershell
.\scripts\run_backend.ps1     # em um terminal
.\scripts\run_frontend.ps1    # em outro
```

Depois, abra <http://localhost:3000>. Use `localhost` e não `127.0.0.1`: são
origens distintas para o navegador, e abrir pelo endereço errado faz a tela
não reagir, sem erro visível.

### Localmente, comandos avulsos

**Backend** — requer [uv](https://docs.astral.sh/uv/):

```bash
cd backend
uv sync
uv run uvicorn api.main:app --reload --port 8000
```

Sem `PYTHONPATH` e sem `--app-dir`: o `uv sync` instala os pacotes de `src/` no
ambiente, então os imports resolvem sozinhos. Ver o porquê em
`backend/pyproject.toml`.

**Frontend** — requer Node 20+ e pnpm (`corepack enable pnpm`):

```bash
cd frontend
pnpm install
pnpm dev
```

### Sem interface

Para gerar o relatório direto dos arquivos de exemplo:

```bash
cd backend
uv run python ../scripts/gerar_relatorio.py     # saida/relatorio.docx
```

Dois arquivos, e só: o contrato e o levantamento.

---

## Hospedagem

Azure Container Apps, grupo de recursos `rg-confere-des`, região `eastus`.

| Recurso | Nome |
|---|---|
| Container App — backend | `ca-confere-backend` · 1 vCPU / 2 GiB · mín. 1, máx. 3 réplicas |
| Container App — frontend | `ca-confere-frontend` · 0,5 vCPU / 1 GiB |
| Environment | `cae-confere-des` (Consumption) |
| Container Registry | `acrconferedes` (Basic) |
| Log Analytics | `log-confere-des` |

As imagens são construídas **no servidor do ACR**, sem daemon Docker local:

```bash
az acr build -r acrconferedes -t confere-backend:v5 -f backend/Dockerfile ./backend
az acr build -r acrconferedes -t confere-frontend:v5 -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://ca-confere-backend.<dominio>/ ./frontend
```

**O `--build-arg` do frontend não é opcional.** `NEXT_PUBLIC_API_URL` é embutida
no pacote do cliente em tempo de build, e o `Dockerfile` tem `http://localhost:8000`
como padrão — correto para o `docker compose`, errado no Azure. Esquecê-lo produz
uma imagem que compila, sobe e desenha a tela inteira, e só falha quando alguém
clica. Conferir o valor no *chunk* servido faz parte de publicar.

**Tags são imutáveis.** Cada publicação usa uma nova (`v1`, `v3`, `v4`…), porque
os apps estão em `activeRevisionsMode: Single` e a revisão anterior é desativada:
o rollback é republicar a tag anterior, não redistribuir tráfego.

```bash
az containerapp update -g rg-confere-des -n ca-confere-backend \
  --image acrconferedes.azurecr.io/confere-backend:v3
```

O backend tem *readiness* e *liveness* em `/health`, e escala por concorrência
com alvo **1** — cada réplica processa uma geração por vez. As duas coisas
dependem da [ESPEC 012](docs/specs/012-responsividade-durante-a-geracao.md): antes
dela o `/health` não respondia durante a geração, e um *liveness* teria matado o
container no meio do relatório.

Custo aproximado: **US$ 40/mês**, quase todo consequência do `min-replicas 1`.
Com escala a zero cairia para ~US$ 6 (só o ACR), ao preço de *cold start*.

**Pendências da hospedagem:** não há autenticação nas duas URLs; o ACR é acessado
por senha de administrador, e não por identidade gerenciada — a `id-confere-des`
existe mas não recebeu `AcrPull`, porque a conta usada não tem permissão em
`Microsoft.Authorization`.

---

## Entradas

| Arquivo | Formato | O que a aplicação consome |
|---|---|---|
| **Contrato** | PDF | Código, descrição e **quantidade contratada**, da tabela de itens |
| **Levantamento** | XLSX | Código e **quantidade medida**, apenas da aba `Levantamento` |

### De onde sai cada coisa

**O universo é a aba `Levantamento`** ([ESPEC 018](docs/specs/018-o-relatorio-segue-o-contrato.md)).
Todo código que ela traz vira linha; o contrato dá a **ordem** e a designação
contratual. Não há catálogo, cadastro nem terceiro arquivo.

| O que | De onde vem |
|---|---|
| Quais itens entram | aba `Levantamento`, um por código |
| Quantidade contratada e medida | aba `Levantamento` |
| Ordem das linhas | aparição na tabela de itens do contrato |
| Descrição e unidade | contrato, onde ele conhece o código; da aba no bloco final |
| Perfil ou pacote (`1 / 1`) | medida não numérica na aba |

O que a aba traz e o contrato não conhece sai ao final, sob
**`DEMAIS ITENS DO LEVANTAMENTO`**. O consumo sem cobertura contratual, que o
desenho anterior escondia, aparece — e ali a única linha que não sai é a que
**zera as duas quantidades**: sem nada contratado e sem nada medido, ela não
prova nem desmente coisa alguma. Ela continua na tela e na análise, que existem
para conferir; o documento é que vai ao órgão.

A única exclusão é a **família `10.050`** — especialista/analista e consultoria
de BI, faturados por outro instrumento. Ela vive numa constante nomeada, porque
não varia por contrato, e fica fora do documento e **dentro** da comparação.

**A regra do desconto de desenvolvimento vale sempre.** Onde a aba repete o
mesmo código em dois blocos, prevalece o que desconta recursos de
desenvolvimento: o cliente não paga por servidor de desenvolvimento.

---

## Testes

```bash
cd backend
uv run python -m pytest                                  # 1.422 testes, cerca de 15 minutos
uv run python -m pytest tests/test_anchor_por_codigo.py  # o teste-âncora do documento
uv run python -m pytest tests/test_anchor_analise.py     # o teste-âncora da análise

cd ../frontend
pnpm exec playwright test          # 79 casos no navegador (backend precisa estar no ar)
```

**`python -m pytest`, e não `pytest` direto.** O `-m` põe o diretório atual no
`sys.path`, e `tests/test_divergencia_de_fonte.py` importa de
`tests.test_quantitativo_consolidado` — um módulo de teste que empresta cenário a
outro. Sem o `-m`, a coleta para com `ModuleNotFoundError: No module named
'tests'` e **nove casos não rodam**, com a suíte relatando sucesso no resto.
Mover o cenário compartilhado para o `conftest.py` dispensaria o `-m`; enquanto
não move, é o `-m` que faz a suíte rodar inteira.

### O teste-âncora

`tests/test_anchor_por_codigo.py` gera o relatório dos dois pares reais e o
compara **por código** com as páginas 2 e 3 do relatório modelo. É o critério de
aceite do projeto.

Era uma comparação célula a célula, posicional. Com o documento seguindo a ordem
do contrato e sem agrupamento, a forma posicional deixou de ser aplicável — o
que o modelo continua provando é que **os números estão certos e nenhuma linha
se perdeu**.

O teste é parametrizado por renderizador. Foi assim que o DOCX substituiu o PDF
sem que o projeto ficasse um instante sem garantia de fidelidade: a rede passou
a aceitar os dois formatos **antes** de qualquer substituição, e o PDF só saiu
depois de o DOCX passar.

A 55ª é uma divergência real, declarada no teste: ver "Limitações".

### Qualidade

```bash
cd backend
uv run ruff check . && uv run mypy src/ && uv run bandit -ll -r src/
```

O hook de pré-commit roda auditoria de dependências e SAST, e **bloqueia** o
commit da planilha de medição íntegra. Ele **não** roda `ruff`, `mypy` nem a
suíte: os três ficam por conta de quem edita, e nada os cobra antes do merge.
Ative-o uma vez após clonar:

```bash
./scripts/install-hooks.sh
```

Não há pipeline de CI: essa é a primeira lacuna de processo a fechar quando a
ferramenta sair da demonstração. É ela que explica por que o lint consegue
quebrar sem que ninguém veja — e por que a suíte de 15 minutos, que não cabe num
hook de pré-commit, hoje custa quinze minutos de atenção de alguém.

---

## Limitações conhecidas

**A quantidade do certificado digital diverge do modelo.** O item
`11.027.00001.00` sai com **10** — o que o contrato, o texto do aditivo e a
planilha afirmam — enquanto o relatório modelo grafa **6**. O aditivo altera
três itens que aparecem no relatório; dois trazem o valor novo e só este traz o
antigo, o que indica que o modelo não incorporou o aumento. Pende de confirmação
do negócio (insumo `I-01`).

**Consumo sem previsão contratual não entra no PDF** — mas **aparece na tela**.
Itens medidos sem contrapartida no relatório são omitidos do documento, que
reproduz o modelo. No piloto isso seria `14.049.00054.00`, **medido 2 e ausente
do contrato**. O grid de divergências o exibe em bloco próprio
([ESPEC 002](docs/specs/002-painel-de-divergencias.md) §5), resolvendo a
limitação da ESPEC 001 §9.2 sem alterar o documento formal.

**Itens de perfil perdem informação.** Perfis e pacotes entram como `1 / 1`, e
com isso o banco de dados **contratado no perfil D e medido no perfil C** aparece
sem diferença. Ver ESPEC 001 §9.3.

**A quebra de página não coincide com a do modelo.** As alturas de linha diferem,
então a virada cai em item diferente. Não afeta o conteúdo.

**O arquivo da análise nunca foi aberto no Excel.** O
`Relatorio_Analise_Medição.xlsx` é gerado, relido e conferido célula a célula
contra o modelo por teste automatizado — mas `openpyxl` relê perfeitamente o que
ele mesmo escreveu. É a cegueira que deixou seis defeitos de DOCX passarem por
toda a suíte até alguém abrir o Word (ESPEC 003). Pende do insumo `K-01`.

**A geração leva cerca de 22 segundos** — medido em produção, no Azure, com os
arquivos do piloto. Eram 3 s antes dos anexos: são 25 mil células a mais, e
emiti-las célula a célula tem custo. Dois terços do tempo estão na renderização
do DOCX (19 s de 29 s numa medição por fase); a planilha da análise custa 0,16 s.
Fica abaixo do limite de 40 s a partir do qual a otimização deixaria de ser
opcional — e a otimização segue sendo o alvo óbvio, registrado como insumo `I-09`
na [ESPEC 012](docs/specs/012-responsividade-durante-a-geracao.md) §4.2.

**Os dezenove anexos dependem do nome da aba.** `anexos.json` fixa os nomes —
`Detalhes`, `Servidores`, `BD`, `Office365`, `ServicosVcloud`… — e
`medidas_grc.json` fixa a geometria de cada um, medida no relatório GRC. Aba
configurada e ausente do arquivo vira **anexo vazio, não erro**, e a razão é boa
para uma aba faltante numa competência: o PGM não contratou colocation, e três
das dezenove abas simplesmente não existem na planilha dele.

Desde a [ESPEC 036](docs/specs/036-a-pagina-que-so-diz-que-nao-tem-nada.md), o
anexo sem conteúdo **não vira página**: nem seção, nem título, nem a observação
que ele imprimia. E o sinal que aquelas páginas carregavam sem querer — *"esta
planilha pode ter as abas com outro nome"* — passou a sair como achado:
`V-ANX-01` avisa quando **nenhuma** das abas configuradas traz conteúdo. Um
achado, não dezenove (`R-GRD-06`). **Ausência parcial não avisa**, e é decisão:
para um órgão de escopo estável ela é fato de contrato, e o aviso seria ruído
mensal.

**Qual linha é o cabeçalho vem dos rótulos, não de um número.** Até a
[ESPEC 037](docs/specs/037-a-linha-de-dados-que-virou-cabecalho.md),
`anexos.json` dizia *"em `Office365` o cabeçalho é a linha 17"* — medido na
planilha do SMIT. Mas o preâmbulo daquelas abas cresce com o escopo do órgão: no
PGM a 17 é uma linha de resumo, e num terceiro contrato era o **4º usuário**,
repetido no topo de cada página do anexo com nome, RF e e-mail. Agora cada anexo
declara os primeiros rótulos do seu cabeçalho e a linha é localizada por eles.
Quando não são encontrados, o anexo sai **sem repetição** — nunca com "a linha
que estiver lá" — e `V-ANX-02` avisa quais abas.

**Uma aba pode ter mais de um cabeçalho — [ESPEC 051](docs/specs/051-o-cabecalho-que-ficou-pequeno-para-a-tabela.md).**
`Servidores` e `ServidoresSemDesenv` empilham duas tabelas na mesma aba, de
formas diferentes: um resumo de 11 colunas seguido, mais adiante, de um
detalhe por servidor de 15. O leitor só reconhecia a primeira âncora, e a
fileira que o Word repetia a cada página saía com as 4 colunas do detalhe em
branco — visível só quando a tabela atravessa uma quebra de página, que o
GRC nunca precisou fazer porque a aba cabe numa folha só ali. Agora um anexo
pode declarar `cabecalhos_adicionais`: cada âncora extra vira o seu próprio
corte, com a sua própria repetição de cabeçalho.

O que continua em aberto é o lado simétrico: **aba presente na planilha e
ausente de `anexos.json`** — o PGM traz `Alta Plataforma`, `Impressao` e `ETL` —
é descartada em silêncio. Incluir uma exige medir a geometria dela no GRC, e é
espec própria.

**A coluna de descrição é 24 pt mais estreita que no modelo.** No DOCX cada
célula tem margem interna, e a soma delas empurrava a tabela para fora da área
útil — a coluna "Quantidade Medida" saía cortada. As outras quatro colunas
mantêm a medida do GRC.

**Um único contrato por execução.** Consolidar contrato original mais aditivos em
ordem cronológica está fora do escopo.

**A aplicação não tem autenticação.** Ela é publicada com *ingress* externo nos
dois containers, e quem tiver o endereço usa. É a pendência mais séria da
hospedagem — ver "Hospedagem".

**Regras derivadas de um único caso.** Todas as regras vieram de uma competência
de um contrato. Um segundo par de arquivos — o do PGM — passou a rodar de ponta
a ponta com a ESPEC 018, mas um terceiro é que provaria o desenho.

> **Parcialmente endereçado em 2026-08-12** ([ESPEC 017](docs/specs/017-grade-do-contrato-derivada-do-documento.md)).
> A **extração** já não depende de um único caso: um segundo contrato real —
> `PA-PGM-251015-159`, de outro órgão e outra geometria de tabela — entrou na
> suíte, e os dois são lidos pelo mesmo código sem parâmetro de layout, ambos
> com o checksum fechando exato.
>
> **Fechado em 2026-08-14** ([ESPEC 018](docs/specs/018-o-relatorio-segue-o-contrato.md)).
> O catálogo era a metade que faltava: semeado de um contrato só, bloqueava um
> contrato de escopo diferente com 26 `V-CTR-02`. Ele saiu, e o `PA-PGM` gera
> documento com **0 bloqueantes**.

---

## Estrutura

```
backend/
  src/
    api/              FastAPI: POST /reports, POST /reports/conferencia-previa,
                      GET /health
    application/      caso de uso, dirigido pela aba `Levantamento`
    domain/           entidades, value objects e ports — sem framework
    infrastructure/   annex/ contract/ measurement/ report/ validations/ di/
                      report/ traz o modelo institucional e o renderizador DOCX
  tests/              1.422 testes, incluindo os dois testes-âncora
frontend/
  src/app/            shell fino + components/
  e2e/                79 casos em 15 arquivos (Playwright)
scripts/              sanitize_fixture · gerar_relatorio · gerar_fixtures_desconto · hooks
docs/                 specs/ plans/ tasks/ triade_referencia/
```

O domínio não importa framework, biblioteca de I/O nem infraestrutura, e isso é
verificado por teste (`tests/test_architecture.py`), não por convenção.

---

## Dados pessoais

A planilha de medição original traz **duas** abas com registro nominal de
servidor público: `Usuários`, com 1.021 linhas, e `Office365`, com 363 — login,
nome completo e e-mail institucional. A planilha do PGM traz 997 em `Usuários`.

**No repositório, o tratamento é fechado.** O arquivo íntegro nunca é versionado:
`docs/documentos/` está no `.gitignore` e o hook de pré-commit bloqueia o commit
da planilha. A fixture de teste é gerada por `scripts/sanitize_fixture.py`, que
**não remove as abas** — elas são dois dos dezenove anexos, e removê-las deixaria
sem cobertura justamente os dois maiores em volume e paginação (`R-ANX-10`). Elas
ficam com **dado sintético**: mesma estrutura, mesma contagem de linhas e colunas,
mesma formatação e mesmas mesclagens, só as colunas identificadoras substituídas.
A substituição é determinística e o script confere a si mesmo.

**Em execução, o tratamento não existe.** As duas abas são anexos, então o `.docx`
gerado **carrega os registros nominais** — como o relatório GRC que ele reproduz.
Hoje isso acontece numa aplicação sem autenticação, com *ingress* externo, sem
registro de acesso e sem retenção declarada. Não é defeito de código, é decisão
de negócio pendente, e ela precisa ser tomada antes de a ferramenta sair da
demonstração. Ver "Hospedagem".
