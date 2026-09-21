# Mudanças de rumo

Registro das decisões que **alteraram** especificação, plano ou backlog depois de escritos. Não é
um histórico de commits — para isso existe o `git log`. Aqui ficam só as mudanças que uma pessoa
precisaria conhecer para entender por que a solução tem a forma que tem.

---

## 2026-09-14 — O logo e os ícones sociais do rodapé viram link, revisando a ESPEC 006 (ESPEC 056)

**O que mudou:** em `Rodape.tsx`, a marca PRODAM passa a linkar
`https://portal.prodam.sp.gov.br/`, o ícone do Instagram `https://www.instagram.com/prodamsp/` e o
do LinkedIn `https://br.linkedin.com/company/prodamsp` — os três em nova aba
(`target="_blank" rel="noopener noreferrer"`), cada um com nome acessível próprio. O texto
`/prodamsp` continua sem link.

**Por quê:** a ESPEC 006 (D-06) tinha decidido deliberadamente que o rodapé era "o único elemento
da interface que não faz nada: sem navegação, sem link, sem ação" — decisão correta no momento, sem
nenhum destino confirmado. Pedido direto do usuário, com as três URLs fornecidas em conversa, torna
essa decisão obsoleta para a marca e os dois ícones; o §10 ponto 1 da própria ESPEC 006 (deveria
`/prodamsp` virar link?) fica resolvido: os ícones viram link, o texto não — um único texto não pode
apontar para dois destinos diferentes (`D-08` da ESPEC 056).

**Não-regressão:** suíte e2e completa **131 passed, 0 failed** (127 herdados + 4 novos, em
`rodape.spec.ts`); `pnpm lint`/`pnpm build` limpos. Nenhuma mudança em `Barra.tsx` (logo "Confere"
do cabeçalho) nem em `frontend/package.json`/`pnpm-lock.yaml`.

**Onde:** [ESPEC 056](specs/056-o-logo-do-rodape-que-virou-link-para-o-portal.md),
[ESPEC 006](specs/006-rodape-institucional.md) D-06 e §10 ponto 1,
[PLANO 056](plans/056-plano-o-logo-do-rodape-que-virou-link-para-o-portal.md).

---

## 2026-09-10 — `WIFI` passa a repetir o cabeçalho da própria tabela, não o do resumo (ESPEC 054)

**O que mudou:** `WIFI`, em `anexos.json`, ganha `cabecalhos_adicionais: [["Seq", "TIPO de TC",
"Cod.Produto"]]` — o mesmo mecanismo de âncoras adicionais que a ESPEC 051 já criou para
`Servidores`/`ServidoresSemDesenv`, aplicado sem nenhuma linha de código nova.

**Por quê:** duas capturas de tela reais (aba `WIFI`, contrato SMIT Sustentação) mostrando o
cabeçalho `Unidade | Quantidade Medida` (o do resumo) repetido no topo de uma página cuja tabela é
`TIPO de TC` — colunas completamente diferentes. A aba tem dois cabeçalhos de coluna e só o
primeiro estava declarado; sem uma segunda âncora, a tabela larga (21 linhas no piloto) e o resumo
saíam como uma tabela só, com a marca de repetição no cabeçalho errado.

**Não-regressão:** verificado por experimento antes de tocar o repositório (configuração
alternativa em memória) e depois, com o mesmo resultado: `WIFI` passa a sair em 3 tabelas, cada uma
repetindo o próprio cabeçalho. A correção moveu deliberadamente o `.docx` do piloto —
`word/document.xml` foi a única entrada a se mover —, mas **não** o do PGM: achado na execução, a
aba `WIFI` do PGM tem layout de colunas diferente (sem `TIPO de TC`) e só 8 linhas de dado, então a
âncora nova não resolve lá e a tabela nem estoura página — o PGM não tem o defeito hoje.
`test_identidade_dos_artefatos.py` foi reancorado só no piloto, com o delta provado por
desligamento. Backend **1.626 → 1.627 passed, 0 failed**, `ruff check` e `mypy src/` limpos.

**Onde:** [ESPEC 054](specs/054-o-cabecalho-errado-que-se-repetia-no-wifi.md),
[PLANO 054](plans/054-plano-o-cabecalho-errado-que-se-repetia-no-wifi.md) §6.

---

## 2026-09-10 — A marca do parágrafo passa a herdar o corpo do anexo, não os 12pt do documento (ESPEC 053)

**O que mudou:** `ooxml.escrever` passa a montar, além do `w:rPr` da execução, também o
`w:pPr/w:rPr` — a marca do parágrafo — com o mesmo corpo e fonte. O parágrafo separador entre
segmentos de tabela (`_faixa_de_tabelas`, ESPEC 004/051) ganha a mesma marca, no seu corpo de 1pt.
O oráculo `test_escrever_reproduz_a_api_publica` (ESPEC 026 `R-DES-06`) foi estendido para cobrir o
elemento novo, copiando o `w:sz` que a própria API pública já calcula para a execução.

**Por quê:** duas capturas de tela reais (aba `Comunicação Dados`, contrato SMIT Sustentação)
mostrando o espaçamento entre linhas maior no `.docx` do que na planilha. Medição no Word real
(automação COM + PDF) isolou a causa: um parágrafo sem execução visível (célula de anexo vazia, ou
o separador entre segmentos) usa a formatação da **marca do parágrafo** para calcular a altura da
linha — e, sem override, ela herda os 12pt do documento, não o corpo do anexo (3,5pt em
`Comunicação Dados`, o menor dos 19). A ESPEC 049 já normalizava a execução, mas nunca a marca — o
efeito era pequeno demais para notar na aba que ela testou (`Internet`, corpo 11pt, a 1pt dos 12pt
herdados).

**Não-regressão:** medição isolada, fora do pipeline inteiro, provou que a marca não muda a altura
de uma linha com texto (três medições estatisticamente idênticas, com e sem a marca). Ponta a
ponta, os vãos de `Comunicação Dados` caíram de 17,47pt/linha para 5,45pt/linha, e de 30,94pt para
3,39pt — medidos no Word real, antes e depois. A correção moveu deliberadamente o `.docx` do piloto
e do PGM — `word/document.xml` foi de novo a única entrada a se mover, nos dois —, e
`test_identidade_dos_artefatos.py` foi reancorado, com o delta provado por desligamento. Medido
antes da correção: zero célula vazia na tabela de comprovação nos dois pacotes, então o alcance
ficou restrito às páginas de anexo. Backend **1.624 → 1.626 passed, 0 failed**, `ruff check` e
`mypy src/` limpos.

**Onde:** [ESPEC 053](specs/053-a-marca-do-paragrafo-que-herdou-12pt.md),
[PLANO 053](plans/053-plano-a-marca-do-paragrafo-que-herdou-12pt.md) §8,
[TASKS 053](tasks/053-tasks-a-marca-do-paragrafo-que-herdou-12pt.md).

---

## 2026-09-10 — Célula de anexo passa a herdar o alinhamento da aba (ESPEC 052)

**O que mudou:** `CelulaAnexo` ganha o campo `alinhamento` (`"left"`/`"center"`/`"right"`), lido em
`AbaReader._alinhamento`: o valor explícito da célula quando a aba o declara, e — sem ele — o
comportamento "Geral" do Excel decidido pelo tipo do valor original (número e data à direita, texto
à esquerda, booleano centralizado). `_celula_do_anexo` passa a repassar esse valor a
`ooxml.escrever`, que já sabia emiti-lo.

**Por quê:** duas capturas de tela reais (aba `NAS`, contrato SMIT Sustentação) mostrando a mesma
tabela nos dois lados: na planilha, as colunas `Usado(GB)`/`Alocado(GB)` saem à direita e o
cabeçalho centralizado; no `.docx`, tudo saía à esquerda. Medição direta com `openpyxl` confirmou
que a aba declara o alinhamento explicitamente célula a célula, e que `_celula_do_anexo` nunca lia
esse dado — toda célula de todo anexo, nas 19 abas, saía com o padrão `"left"` de `ooxml.escrever`,
não importa o que a planilha dissesse.

**Não-regressão:** sonda sem renderizar (`AbaReader().ler(...)`) confirmou os quatro cantos da aba
`NAS` antes de qualquer documento; o teste ponta a ponta foi confirmado por caracterização (reprova
sem a correção, passa com ela). A correção moveu deliberadamente o `.docx` do piloto e do PGM — a
aba `NAS` tem célula `right`/`center` real, e entra nos dois —, e `word/document.xml` foi de novo a
única entrada a se mover nos dois pacotes, com o delta provado por desligamento (revertendo só a
passagem do alinhamento em `_celula_do_anexo`, os dois voltam ao hash de antes, entrada por
entrada). Backend **1.613 → 1.624 passed, 0 failed**, `ruff check` e `mypy src/` limpos.

**Onde:** [ESPEC 052](specs/052-o-numero-que-foi-para-a-esquerda.md),
[PLANO 052](plans/052-plano-o-numero-que-foi-para-a-esquerda.md) §8.

---

## 2026-09-10 — Anexo com duas tabelas empilhadas ganha um cabeçalho para cada (ESPEC 051)

**O que mudou:** `Anexo.corte` (`int | None`, um corte por aba) virou `Anexo.cortes` (`tuple[int,
...]`, um por cabeçalho reconhecido). Um anexo passa a poder declarar `cabecalhos_adicionais` em
`anexos.json` — âncoras extras, além da primária —, cada uma resolvida pela mesma
`localizar_cabecalho` da ESPEC 037 e cada uma abrindo o seu próprio segmento, com a sua própria
marca `w:tblHeader`. `docx_renderer.py::_faixa_de_tabelas` foi generalizada de "no máximo duas
tabelas" para "uma por segmento"; `_tabela_do_anexo` e `ooxml.py` não mudaram.

**Por quê:** submissão real com capturas do `.docx` mostrando colunas de cabeçalho em branco após
quebra de página. Investigação achou a causa em `Servidores` e `ServidoresSemDesenv`: a aba tem duas
tabelas empilhadas, de formas diferentes — um resumo de 11 colunas seguido, mais adiante, de um
detalhe por servidor de 15 —, e o leitor só reconhecia a primeira âncora. A fileira marcada para
repetir a cada página saía com as 4 colunas do detalhe em branco. O defeito já estava nos **dois**
pacotes de referência hoje versionados, não só no arquivo da submissão — medido antes de qualquer
linha de código mudar.

**Não-regressão:** os 17 anexos sem âncora adicional saem com XML idêntico, byte a byte — só
`Servidores` e `ServidoresSemDesenv` ganharam uma tabela a mais cada (2 → 3), nos dois pacotes.
Como o defeito estava nos dois, a correção moveu deliberadamente o `.docx` do piloto **e** do PGM —
diferente das reancoragens anteriores, em que o piloto ficava parado como régua —, e
`test_identidade_dos_artefatos.py` foi reancorado nos dois, com o delta provado por desligamento
(`cabecalhos_adicionais` revertido devolve os dois pacotes ao hash de antes, entrada por entrada).
Backend **1.608 → 1.613 passed**, cinco testes novos, nenhum removido. Um teste pré-existente
(`test_t2293_o_documento_do_pgm_perde_tres_secoes_e_nenhuma_tabela`, ESPEC 036) tinha uma contagem
de tabelas do documento completo do PGM hardcoded em 34, fora do inventário original desta entrega —
achado só ao rodar a suíte inteira, corrigido para 36 e medido com o container real, não estimado.

**Onde:** [ESPEC 051](specs/051-o-cabecalho-que-ficou-pequeno-para-a-tabela.md),
[PLANO 051](plans/051-plano-o-cabecalho-que-ficou-pequeno-para-a-tabela.md),
[TASKS 051](tasks/051-tasks-o-cabecalho-que-ficou-pequeno-para-a-tabela.md) §10.

---

## 2026-09-09 — Célula de anexo sem texto ganha a mesma normalização de parágrafo (ESPEC 049)

**O que mudou:** uma célula sem texto, dentro de uma tabela de anexo — a linha de respiro entre
faixas de título, por exemplo —, passa a receber a mesma normalização de parágrafo que uma célula
com texto já recebia (espaçamento zerado, corpo de fonte do próprio anexo). Antes, ela herdava o
padrão do documento (8pt de espaço depois do parágrafo, fonte 12pt), maior que o mínimo declarado
para a linha, e saía visivelmente mais alta do que a planilha de origem mostrava.

**Por quê:** print real da aba `Internet` (contrato CGM, julho/2026): o espaço entre as faixas
`INTERNET - CGM` e `INTERNET` saiu bem maior no `.docx` do que na planilha. A hipótese inicial —
perda da altura de linha do Excel — foi descartada por leitura do XML bruto de dois arquivos reais
(o do CGM e o que está atrás do PDF de referência do GRC): nenhuma linha tem altura customizada nos
dois. A causa real estava em `_celula_do_anexo`: só a célula com texto chamava `ooxml.escrever`, que
é a única função que zera o espaçamento do parágrafo.

**Não-regressão:** medido no Word real (automação COM + PDF): os dois vãos da aba `Internet` caem de
25,4/25,5pt para 17,4/17,5pt — redução de 8,0pt nos dois, exatamente o `w:after="160"` que deixou de
ser herdado. A correção moveu deliberadamente o `.docx` do piloto e do PGM, e por isso
`test_identidade_dos_artefatos.py` precisou ser reancorado (ESPEC 026 `R-DES-01`) — confirmado por
script que só `word/document.xml` mudou nos dois pacotes, e provado por desligamento que é esta
mudança, e só ela, que os move. Backend **1.607 → 1.608 passed** — um teste novo
(`R-CEL-01`), zero teste existente mudando de resultado.

**Onde:** ESPEC 049 · PLANO 049 · TASKS 049

---

## 2026-09-09 — Next.js atualizado de 15.5.4 para 15.5.25, fechando duas RCEs não autenticadas (ESPEC 048)

**O que mudou:** `next` e `eslint-config-next` saem de `15.5.4` para `15.5.25` — 21 versões de
patch, sem mudança de Node, React ou `Dockerfile`.

**Por quê:** uma revisão de segurança do projeto apontou 40 vulnerabilidades no frontend
(`pnpm audit`), 3 críticas — duas delas RCE não autenticada em `next@15.5.4` (hospedagem Windows e
Image Optimization API com AVIF), já corrigidas rio acima. Como as duas URLs de produção não têm
autenticação (README §"Hospedagem"), isso era superfície de ataque ativa, não teórica.

**Não-regressão:** suíte E2E completa (127 casos) rodada antes e depois do bump, comparada caso a
caso (ESPEC 048 `R-DEP-05`) — **127/127** nas duas medições. `pnpm audit` pós-bump: **40 → 7**
achados, zero críticas, zero relacionados a `next`/`eslint-config-next` — os sete restantes são
dependências de build fora do escopo (`postcss` interno ao `next`, `nanoid`, `sharp`, `js-yaml`).

**Onde:** [ESPEC 048](specs/048-o-next-que-ficou-vinte-e-um-patches-atras.md),
[PLANO 048](plans/048-plano-o-next-que-ficou-vinte-e-um-patches-atras.md),
[TASKS 048](tasks/048-tasks-o-next-que-ficou-vinte-e-um-patches-atras.md).

---

## 2026-09-09 — Data sem dia deixa de ganhar um dia inventado nos anexos (ESPEC 047)

**O que mudou:** célula de data de uma aba de anexo cujo formato do Excel não tem dia — só mês e/ou
ano, como `mmm/aa` — passa a sair no `.docx` do mesmo jeito, sem dia (`"dez/26"`). Antes, `AbaReader`
sempre formatava qualquer data como `dd/mm/aaaa`, inventando um dia (geralmente o 1º) que a planilha
nunca mostrou.

**Por quê:** a [ESPEC 004](specs/004-anexos-de-detalhamento.md) `R-ANX-07` já manda "valores numéricos
e datas usa[rem] a formatação da planilha" — a implementação nunca cumpriu essa regra para o caso sem
dia. Achado a partir de um print real da aba `CertificadosDigitais` (contrato CGM): uma coluna de
alerta de renovação, formatada `mmm/aa`, saía como `01/12/2026` no relatório.

**Não-regressão:** data completa continua fixa em `dd/mm/aaaa`, por decisão (ESPEC 047 `D-01`) — só o
caso sem dia muda. Nenhuma das 19 abas hoje configuradas em `anexos.json` tem célula nesse formato em
nenhuma fixture de teste (medido antes da implementação). Backend **1.601 → 1.607 passed** — seis
testes novos, zero teste existente mudando de resultado.

**Onde:** ESPEC 047 · PLANO 047 · TASKS 047

---

## 2026-09-08 — Aditivo com bloco único sem rótulo deixa de bloquear (ESPEC 046)

**O que mudou:** `V-ADT-03` deixa de bloquear quando um aditivo tem um único bloco sem rótulo
(`Inclusão`/`Redução`/`Aumento`/`Exclusão`). Esse formato passa a ser tratado exatamente como uma
proposta já era — sem checagem nenhuma.

**Atenção — isto NÃO é uma correção de bug, é a remoção deliberada de uma proteção.**
`Contract.aplicar()` continua ignorando, em silêncio, todo bloco sem rótulo — isso não mudou e não é
o que esta entrega toca. O que mudou é que, antes, o sistema **avisava e recusava** submeter esse
aditivo; agora ele é aceito, e os itens dele **desaparecem do relatório sem nenhum sinal**. Não há
`AVISA` no lugar do `BLOQUEIA` removido — foi decisão explícita, não uma omissão a corrigir depois.

**Por quê:** pedido direto do usuário, depois de confirmado o comportamento em detalhe nesta
conversa: peças reais como `PA-CGM-250912-127 v4.0` (uma renovação de contrato que restabelece o
escopo inteiro, sem movimentar item por item) sempre produzem essa forma e sempre seriam recusadas no
campo do aditivo — mesmo sendo, pela própria capa, aditivos genuínos (`PROPOSTA DE ADITIVO AO
CONTRATO...`). A alternativa mais segura (distinguir esse caso pela declaração da capa e ao menos
avisar, em vez de calar) foi levantada e ficou registrada como caminho não escolhido (ESPEC 046 `I-01`),
não descartada.

**Não-regressão:** a primeira forma de `V-ADT-03` (peça repetida) não foi tocada — mesmo código, mesmo
teste, verde sem alteração. Backend **1.601 → 1.601 passed** — nenhum teste novo, nenhum removido, só
um comportamento invertido.

**Onde:** ESPEC 046 · PLANO 046 · TASKS 046

---

## 2026-09-08 — A ordem de preço, quantidade e período passa a ser lida do cabeçalho (ESPEC 045)

**O que mudou:** `_montar_item` deixa de ler `quantidade`, `preço unitário` e `período` por posição
fixa (`COL_PRECO=3`/`COL_QUANTIDADE=4`/`COL_MESES=5`). A ordem passa a ser resolvida, por geometria, a
partir do vocabulário do cabeçalho de cada seção (`PREÇO`/`UNITÁRIO`, `QTDE`/`QUANTIDADE`,
`PERÍODO`/`MÊS`) — e muda ao vivo, ao longo da leitura, sempre que um cabeçalho novo aparece. Sem
cabeçalho resolvível, o padrão é a ordem de hoje: comportamento idêntico para todo documento que não
declare uma ordem diferente. Nova validação `V-CTR-08` (`AVISA`) avisa quando isso ocorre.

**Por quê:** o aditivo `PA-CGM-250912-127 v4.0` declara a ordem canônica em "5.2 Redes e
Conectividades"/"5.3 Serviços de Comunicação" e a **invertida** — quantidade, período, preço — em "5.4
Data Center", na mesma geometria. A maioria dos itens de "5.4" passava calada, com preço e quantidade
trocados entre si (período inteiro parseia como `Decimal` em qualquer posição); só
`14.049.00039.00`, cujo período é escrito por extenso ("2 meses e 16 dias"), estourava
`ExtractionError` — e foi essa mensagem que abriu a investigação.

**Fecha o `I-01` da ESPEC 042.** Aquela espec já havia medido a mesma ordem trocada em 2026-09-03 e a
deixado deliberadamente de fora ("corrigir a ordem de colunas do `PA-CGM-250912-127` — outra causa, e
bloqueia a extração antes de chegar a `total_declarado`"). Com esta correção e a `_total_por_convergencia`
da própria ESPEC 042 (sem nenhuma mudança nela), `aditivo_cgm.pdf` extrai **27 itens, zero erro**,
soma dos totais `R$ 6.110.655,79` — igual ao total declarado. `V-CTR-03` não bloqueia mais essa peça.

**Não-regressão:** os nove documentos de `backend/tests/fixtures/` não se movem — zero troca de papel
registrada em nenhum, e as tuplas de item de `test_extractor_aditivo_smul.py::REGUA` idênticas, `sha`
por `sha`. Backend **1.575 → 1.601 passed** (26 testes novos), zero falhas reais — uma reprovação de
`test_desempenho.py` (custo de mesclagem de anexo, área não tocada por esta entrega) foi ruído de
carga sob a suíte completa, confirmada isolada em seguida.

**Onde:** ESPEC 045 · PLANO 045 · TASKS 045

---

## 2026-09-04 — Os dois avisos originais ganham título, causa e ação (ESPEC 044)

**O que mudou:** `V-CAP-01` (nome do órgão não derivado da proposta) e `V-CTR-05` (código do
contrato sem registro no levantamento) passam a usar o mesmo formato das sete validações da
ESPEC 043 — título em português, causa, ação em um passo, sigla técnica recolhida.

**Por quê:** são os dois avisos que originaram toda esta série de investigações. A ESPEC 043 os
separou para uma "Fase B" por cautela — a estimativa de risco de teste (7 arquivos cada) usada para
essa decisão contava `__pycache__`, não só código-fonte. Remedido: 3 e 4 arquivos reais,
respectivamente, e nenhum lê `.mensagem`. O risco era zero.

**Efeito colateral:** toda validação `AVISA` do sistema agora tem `titulo` — o que remove o
pré-requisito técnico para generalizar `CartaoAgregado` (hoje com texto fixo, escrito só para
`V-CTR-05`). Permanece como decisão em aberto, não desta entrega.

**Onde:** ESPEC 044 · PLANO 044 · TASKS 044

---

## 2026-09-03 — Sete avisos ganham título, causa e ação (ESPEC 043)

**O que mudou:** os cartões de `V-CTR-04`, `V-CTR-06`, `V-CTR-07`, `V-ADT-02`, `V-ADT-04`, `V-MED-03`
e `V-MED-04` deixam de mostrar a sigla técnica colada na frase crua. Passam a usar o mesmo formato
que a ESPEC 025 já criou para os bloqueios — título em linguagem simples, causa, uma ação em um
passo, e o texto técnico recolhido em "Detalhes técnicos (para o suporte)".

**Por quê:** o próprio código já documentava a lacuna — "onze validações ainda mandam só `mensagem`"
— e o alcance real, medido, era treze. Esta entrega fecha as sete de menor risco de teste; `V-CAP-01`
e `V-CTR-05` (maior alcance), a generalização do card agregado e as quatro validações de bloqueio
ficam para entregas próprias.

**Nenhuma linha de frontend.** `ResultadoPanel.tsx` já sabia desenhar o card em quatro partes desde
a ESPEC 025 — esta entrega só passou a alimentá-lo em mais sete lugares.

**Onde:** ESPEC 043 · PLANO 043 · TASKS 043

---

## 2026-09-03 — O total sem `TOTAL:` passa a ser encontrado em prosa e no cronograma (ESPEC 042)

**O que mudou:** quando a extração não encontra a linha `TOTAL:` que normalmente declara o total do
contrato, o extrator passa a procurar o mesmo valor em duas outras fontes do documento — a frase "O
Valor total dos Serviços... é estimado em R$ X" e a linha `TOTAL` da seção "6. CRONOGRAMA
FÍSICO-FINANCEIRO". Só usa o valor quando **as duas** existem e concordam entre si.

**Por quê:** a família de propostas CGM não desenha `TOTAL:` em nenhuma página — declara o total só
dessas duas formas. `V-CTR-03` bloqueava com "total do contrato não localizado" mesmo quando a soma
dos itens batia exata com o que o documento já afirmava duas vezes.

**Por que exigir as duas fontes, e não uma só:** medido no `aditivo_pgm.pdf` — um aditivo de ajuste
quantitativo —, o `TOTAL` do cronograma físico-financeiro sozinho é o total absoluto do contrato
**depois** do aditivo, não o delta que aquela peça declara. Usar essa fonte isolada teria produzido
um `total_declarado` errado para esse tipo de peça, não apenas ausente. A frase de prosa só existe
quando a peça declara um total próprio (proposta, ou aditivo que declara um período inteiro) — e é a
ausência dela, não uma classificação de "tipo de aditivo", que protege o `aditivo_pgm.pdf`.

**O que fica de fora:** o aditivo real da CGM (`PA-CGM-250912-127`) tem outro defeito — ordem de
colunas trocada na tabela de itens — que impede a extração de chegar a este ponto. Continua sem
fixture de teste completo; a prova desta espec sobre aditivo usa os valores reais em caso construído.

**Onde:** ESPEC 042 · PLANO 042 · TASKS 042

---

## 2026-09-03 — A linha de escopo deixa de ser lida pela régua da tabela de preços (ESPEC 041)

**O que mudou:** uma linha sem faixa própria de oito divisórias — e sem herança de uma faixa
anterior — só é lida pelas divisórias da página quando essas divisórias forem, de fato, uma
geometria de item que o documento usa. Antes, era lida por padrão; se a linha tivesse código de
serviço na primeira coluna por acidente de coordenada, a extração tentava tratá-la como item e
falhava exigindo preço e total que ela nunca teve.

**Por quê:** o `PC-CGM-240603-82` tem, na mesma página, uma tabela de escopo (código, descrição,
unidade, quantidade — sem preço) e, mais abaixo, a tabela de preços. A linha de escopo do
`14.023.00002.00` não tem faixa própria de oito nem herda de nenhuma, e caía no degrau de reserva
que a ESPEC 033 preservou para o `contrato_pgm.pdf` — "as divisórias da página" — só que a página,
aqui, tinha duas tabelas de formato diferente.

**A comparação é contra a união de todas as geometrias que o documento usa para item, não contra
uma única geometria.** Medido: duas linhas do `aditivo_pgm.pdf` têm traços que não batem com a
geometria escolhida como gabarito, mas pertencem a uma segunda geometria legitimamente admitida na
mesma página — comparar só contra uma delas as teria rejeitado incorretamente.

**Resultado:** `contrato_cgm.pdf` extrai 33 itens, com soma batendo exata com o valor que a proposta
declara em prosa. Os dois códigos que bloqueavam a extração (`14.023.00002.00`, `15.069.00001.00`)
passam a aparecer com o preço real de uma segunda ocorrência, na tabela de preços — a leitura falsa
da tabela de escopo simplesmente não produz mais item nenhum.

**O que fica de fora:** `total_declarado` desse contrato continua `None` — o valor total é expresso
em prosa, não numa linha `TOTAL:`, e é outro mecanismo, outra causa, registrado como ponto em aberto
(`I-01`) para investigação própria.

**Onde:** ESPEC 041 · PLANO 041

---

## 2026-09-03 — `meses` deixa de bloquear a extração (ESPEC 040)

**O que mudou:** a célula de período de um item — a coluna que declara em quantos meses o serviço é
prestado — deixou de ser campo obrigatório na extração do contrato. Uma célula que não parseia como
número (`"2 meses e 14 dias"`, a cauda de um contrato que não fecha em mês cheio) passa a virar
aviso (`V-CTR-07`), não `ExtractionError`: o relatório é gerado, com o texto original preservado
para conferência manual.

**Por quê:** `meses` não sustenta o checksum de `V-CTR-03` — que soma `total_declarado`, não
`preço × quantidade × meses` — nem é consultado em nenhum outro ponto do backend. Bloquear a
submissão inteira por um campo nunca lido era desproporcional ao que ele de fato sustenta.

**O que fica de fora, por decisão:** `preço unitário`, `quantidade` e `valor total` continuam
bloqueantes sem alteração — são eles que sustentam o checksum. E há um segundo defeito, independente,
na mesma página do documento real que originou a espec (`14.023.00002.00`, uma linha de escopo lida
pela geometria da tabela de preços via `R-FXA-04`, ESPEC 033): ele segue bloqueando, corretamente, e
é registrado como ponto em aberto (`I-04`) — não é desta entrega.

**Onde:** ESPEC 040 · PLANO 040 · TASKS 040

---

## 2026-09-02 — A legenda do grid passa a ser condicional (ESPEC 039)

**O que mudou:** a legenda abaixo do título do grid de divergências — que explica as marcas `perfil`
e `-1` — passou a mostrar só as entradas que correspondem a algo que de fato ocorre no relatório.
Antes, as duas frases apareciam sempre, mesmo quando nenhuma linha tinha saldo negativo ou nenhum
item era de perfil.

**Por quê:** um par real de arquivos (`PA-SMIT-260319-739 Q-00739-7.pdf` /
`SMIT SUSTENTAÇÃO_Levantamento_05969_TC 52SMIT2024_15072026_101414_V2.0.xlsx`) gerou um relatório com
divergência, mas sem nenhuma linha negativa — e a legenda continuava afirmando "Saldo negativo:
medido acima do contratado", levando quem confere a procurar uma linha que não estava lá.

**A `R-UI-04` (ESPEC 002) fica revisada, e a `D-05` (ESPEC 008) tem o alcance precisado, nenhuma
revogada.** A explicação continua fora do `title`, continua numa legenda única e visível — isso não
mudou. O que passou a valer é que cada entrada da legenda só aparece quando o relatório tem ao menos
um item com a condição que ela descreve (`R-LEG-01`, ESPEC 039).

**Sem plano nem tasks própria.** Duas mudanças em `frontend/`, nenhuma em `backend/`, seguindo o
mesmo padrão de revisão pontual já usado pela ESPEC 010.

---

## 2026-09-01 — O contador de avisos sai da faixa, e o bloco sobe (ESPEC 038)

**O que mudou:** na tela de resultado, o bloco âmbar de avisos era o **último** elemento da página.
Passou a ficar logo abaixo da faixa de resultado, com cabeçalho próprio (`2 avisos`) e uma frase que
diz que o relatório foi gerado assim mesmo. O contador que a faixa exibia — `· 2 aviso(s)
registrado(s)` — saiu de lá e virou esse cabeçalho.

**Por quê:** o aviso chegava depois de três tabelas e quarenta linhas de rolagem, e o botão que baixa
o documento fica no topo. A `V-MED-03` que originou a espec diz que uma linha do relatório pode ter
vindo da ocorrência errada da planilha — informação que só serve **antes** de a pessoa usar o
documento. Havia ainda um defeito de acesso: o bloco era o único da tela **sem cabeçalho**, e quem
navega por títulos não chegava nele.

**Duas regras ficam revistas, e nenhuma revogada.** A `R-FON-10` da ESPEC 023 pedia que o contador da
faixa *"contasse o que é exibido"*; a quarenta linhas de distância ele cumpria a letra e não a
intenção, e agora conta de perto (ESPEC 038 `D-03`). A `D-07` da ESPEC 021 e a `D-08` da 023 diziam
que as seções delas ficam *"onde o bloco âmbar está"* — era marco geográfico, e as duas seções **não
se moveram** (`D-05`).

**O produto não andou para trás em nada mais.** Nenhuma linha de `backend/`; `ListaDeAchados` e os
dois cartões intocados; o estado `bloqueado`, onde os avisos já ficavam no topo, igual. A ordem dos
demais blocos é a mesma, com uma única diferença — o bloco âmbar mudou de lugar.

**O estado que ninguém varria passou a ser varrido.** Não havia dublê de `pronto` com avisos: o
piloto não emite nenhum nesse caminho e os dois dublês existentes zeravam a lista. Por isso o bloco
nunca esteve sob teste nem sob `axe`, e foi assim que a posição atravessou seis especs.

---

## 2026-08-31 — O cabeçalho do anexo deixa de ser um número e passa a ser um rótulo (ESPEC 037)

**O que mudou:** `anexos.json` dizia, para cada anexo, **qual linha da aba** é o cabeçalho que se
repete no topo de cada página. Passou a dizer **quais são os primeiros rótulos** desse cabeçalho, e
a linha é localizada por eles em cada planilha. `linha_cabecalho` continua no arquivo, agora como a
medição do GRC e oráculo de um teste, não como entrada da renderização.

**Por quê:** o número foi medido numa planilha só, a do piloto. O que vem antes do cabeçalho
naquelas abas é um bloco de resumo, e ele **cresce com o escopo do órgão** — há um por secretaria
atendida. Então a linha 17 de `Office365` é o cabeçalho no SMIT, uma linha de resumo no PGM, e num
terceiro contrato era o **4º usuário** — repetido, com nome, RF e e-mail, no topo de cada página do
anexo, em posição de rótulo, num documento que vai ao órgão como peça de cobrança.

**A troca é de categoria, e é o que torna a correção estrutural.** Orientação e corpo de fonte
descrevem como o GRC **imprime** a aba: não variam entre planilhas, e podem ser um valor fixo. O
número da linha descreve **um arquivo**. Pôr os três lado a lado na mesma configuração foi o erro —
a ESPEC 004 §4.2 chega perto de vê-lo ao explicar que o cabeçalho está na 8ª linha *"porque antes
dela vêm título, resumo e subtítulo"*, e para uma linha antes: se é por isso, então o que identifica
o cabeçalho é o que ele é.

**O defeito já estava no par versionado do PGM, em cinco anexos, e nenhum teste o via.** `Servidores`
repetia `D84V50I | 1 | 2 | 80…`; `Office365` repetia `PERFIL POWER BI PRO | 10 | 5…`. Três testes já
olhavam a marca `w:tblHeader`, e os três afirmavam **posição** — que ela cai na primeira fileira da
tabela —, nenhum afirmava **identidade**. A rede nova afirma uma relação entre o documento e o
catálogo: toda fileira marcada traz rótulos declarados. É o que vale para a planilha do mês que vem.

**Duas decisões saíram da medição, não do gosto**, e as duas existem porque a alternativa quebraria
abas hoje corretas. A comparação é por **prefixo** e não por igualdade — `BD` tem uma coluna a mais
no PGM. E vale a **primeira** ocorrência, não a única — `NAS` e `OutrosServicos` repetem o cabeçalho
num segundo bloco da mesma aba.

**`V-ANX-02` entrou na mesma entrega, pela razão que a `V-ANX-01` estabeleceu.** Antes, uma planilha
com o cabeçalho renomeado produzia uma linha errada em cada página: errado, e **visível**. Depois da
correção produziria um anexo sem repetição: correto, discreto e mudo. Entregar a correção sem o
achado teria trocado um defeito ruidoso por um silencioso.

---

## 2026-08-31 — A página que só dizia que não tinha nada sai, e o aviso toma o lugar dela (ESPEC 036)

**O que mudou:** anexo sem conteúdo deixou de virar página. Até aqui, aba configurada e ausente da
planilha produzia uma seção inteira com o nome da aba e a frase *"A planilha não trouxe conteúdo
para este anexo."* — três páginas no documento do PGM, cinco no que originou a espec. Agora ela é
omitida: nem seção, nem título, nem observação. E `V-ANX-01` passou a avisar quando **nenhuma** das
dezenove abas configuradas traz conteúdo.

**Por quê:** o documento vai ao órgão como peça de cobrança, e o anexo ausente já é visível pela
ausência. A página transformava um fato mudo em ruído impresso.

**A decisão que a `T-317` tomou estava certa no fim e errada no meio.** Ela pedia que anexo vazio
*"não quebrasse"*, e a página com a frase foi o meio escolhido — num incremento em que só existia a
planilha do piloto, onde nenhuma aba configurada falta. Com o PGM a página deixou de ser hipótese, e
o que se vê é que ela não protege nada: quem protege é o `AnexoReader` devolver forma vazia em vez
de estourar. O fim continua valendo; o teste passou a afirmá-lo pela **ausência** de seção.

**A supressão sozinha teria saído pior que o defeito, e é o ponto que decidiu o desenho.** Aquelas
dezenove páginas eram feias e eram **sinal**: o único aviso de que a planilha podia ter as abas com
outro nome. O README registrava a lacuna desde a ESPEC 004 — *"em silêncio, sem achado e sem aviso…
falta uma validação que acuse quando nenhuma aba configurada é reconhecida"*. `V-ANX-01` é essa
validação, e ela entrou **na mesma entrega**, não na seguinte.

**Ausência parcial não avisa, e é decisão de negócio.** O PGM não tem `Colocation`,
`Comunicação Dados` nem `CertificadosDigitais` porque não contratou aqueles serviços: são 3 de 19 em
toda competência. Avisar sobre elas todo mês transformaria um fato estável em ruído — e `R-GRD-06`
manda relatar a causa, não a consequência.

**O critério de "vazio" mudou de pergunta, e isso fechou dois defeitos que ninguém tinha visto.**
Era `not self.linhas` — se a aba trouxe linhas, não se o que ela trouxe é conteúdo. Uma aba com
resquício de formatação chegava com linhas e nenhuma célula útil, e saía como **página em branco**,
sem sequer a frase; uma aba só com figura ancorada era declarada vazia e **perdia a figura**, que o
`blocos()` sempre soube emitir. O critério novo é o `_tem_conteudo` da ESPEC 014 — texto ou
preenchimento, borda não conta — aplicado ao anexo inteiro, mais a presença de figura.

**A entrega foi partida em duas fases com riscos opostos, e o portão do meio é o que vale
registrar.** O critério pode errar em silêncio nos dois sentidos; a omissão é mecânica. Como os
vereditos dos dois pares versionados são conhecidos — piloto 0 vazios de 19, PGM 3 de 19 —, o
critério novo tinha de ser **documentariamente inerte**: os quatro pacotes byte a byte idênticos com
ele aplicado e a omissão ainda ausente. Foram, e é isso que dá dono ao delta da fase seguinte.

**O hash do piloto é o único oráculo do falso positivo.** `V-ANX-01` pega a planilha inteira
trocada; nada pega **um** anexo legítimo classificado como vazio — a não ser o `PACOTE_DO_PILOTO`,
que cobre 19 anexos reais e 15.955 células. Ele não se moveu, e não podia.

**Reancorado só o PGM, e por desligamento.** `word/document.xml` foi a única entrada a mudar;
`docProps/app.xml`, candidato natural, ficou parado. Com as duas linhas revertidas o pacote voltou a
`67b31124…` entrada por entrada, e religadas voltou ao valor novo — a prova que a ESPEC 028
estabeleceu. **34 tabelas antes e 34 depois**: as páginas omitidas não continham tabela nenhuma, e é
essa igualdade, não a contagem de seções, que prova que nada de conteúdo saiu junto.

---

## 2026-08-31 — A grade passa a contar o que descarta, e o traço deixa de ser um caractere (ESPEC 035)

**O que mudou:** a extração conta, por página, as palavras que caem no vão da tabela e não são
atribuídas a linha nenhuma, e `V-CTR-03` passa a nomear a página quando o checksum não fecha. E o
separador entre o nome do órgão e a sigla passou de hífen ASCII literal para uma **classe de
traços** — hífen, hifens tipográficos, en dash, em dash e sinal de menos.

**Por quê:** o aditivo `PA-FTM-251001-143`, da Fundação Theatro Municipal, foi recusado com dois
achados. `V-CTR-03` bloqueou por `51.676,20` — exatamente uma linha da tabela, a primeira da página
7 — e `V-CAP-01` avisou que o órgão não derivou, porque a capa escreve
`Fundação Theatro Municipal – FTMSP` com **en dash** (U+2013).

**O achado estrutural, e é o que explica a espec inteira:** `montar_grade` sintetiza uma fronteira
**no rodapé** desde a ESPEC 001 §9.4 — foi assim que `12.074.00005.00` e `14.048.00008.00` deixaram
de se perder. **A metade de cima nunca foi escrita**, e não por decisão: nenhuma peça da amostra
tinha linha de item acima da primeira fronteira desenhada. A assimetria entre topo e rodapé era
ausência de caso, não escolha.

**E o descarte não deixava rastro nenhum.** `ler_celulas` joga fora em silêncio a palavra cujo
centro cai fora de `[horizontais[0], horizontais[-1]]`. O diagnóstico contava páginas, bordas,
geometrias candidatas e caudas órfãs — nunca *o que a grade viu e não guardou*. Por isso o único
sintoma disponível foi um número de reais, e a página só apareceu por subtração sobre o valor
declarado.

**O que a medição corrigiu na régua.** O backlog pedia *"o corpus acusa zero palavra descartada"*, e
está errado: nove páginas do corpus imprimem prosa acima da tabela — 177 na página 25 do piloto, 214
na 22 do PGM — e descartá-la está **certo**. A régua virou a **impressão digital** do descarte,
página a página, que é mais forte que zero: é ela que pega uma fronteira sintetizada onde não devia,
**antes** de qualquer `sha` se mover. O que o corpus tem zero é *páginas com código de serviço entre
as órfãs*, e esse é o crivo da correção, não do contador.

**E o contador provou o seu valor antes mesmo de a correção existir.** Ele entrou primeiro, de
propósito: entregue sozinho, o FTM continuava bloqueando, mas a mensagem passou a dizer *"a grade
descartou 93 palavras nas páginas 6 (77), 7 (16)"*. **Dezesseis é o número exato de palavras da
linha `14.031.00018.00`** — duas grandezas independentes, reais e palavras, apontando a mesma linha.
Foi assim que o mecanismo saiu de *estabelecido por eliminação* para *medido*, sem script e sem o
binário. A fronteira superior (`R-GRD-11`) foi escrita depois disso, e não antes.

**O que ficou aberto.** A confirmação positiva — *o FTM lê 10 itens e fecha em `185.316,73`* — ainda
não foi feita: o PDF não está no repositório, e ela exige o binário ou uma submissão pela tela. A
não-regressão, essa é integral: os oito `sha`, os oito `geom`, os oito nomes de órgão e a impressão
digital do descarte, idênticos.

---

## 2026-08-27 — O nome do órgão deixa de depender de uma frase (ESPEC 034)

**O que mudou:** o cliente da capa passa a ser derivado do **sintagma institucional** da primeira
página — a palavra de órgão seguida do nome, cortada na **sigla** —, e não mais de
`prestação de serviços para <órgão>` com captura até o ponto. E `_PROPOSTA` passou a aceitar
`Proposta Comercial:` além de `Proposta de Aditivo:`.

**Por quê:** o par SMUL saía com `SMUL` na capa em vez de
`SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO`. A cascata de `R-CAP-10` funcionava — o aviso
`V-CAP-01` disparava e a capa caía para o subtítulo da aba —, mas a derivação falhava num documento
que **diz o nome do órgão por extenso na primeira página**.

**O achado que explica a regra ter nascido estreita:** as duas peças sobre as quais a ESPEC 020
calibrou `R-CAP-04` — `contrato.pdf` e `contrato_pgm.pdf` — **são aditivos**, apesar do nome do
arquivo. Um aditivo *refere-se* a um contrato e nomeia o órgão como destinatário; uma proposta
comercial inicial *constitui* o contrato e nomeia as **duas partes**. O `PC-SMUL-240916-136` é a
primeira proposta comercial inicial a entrar no campo de contrato em toda a história do repositório.

**E o defeito não era do SMUL.** Entre as sete peças reais, **duas** falhavam: o
`PA-PGM-260818-201` escreve `prestação de serviços de sustentação de TIC para a Procuradoria…`, com
o objeto entre `serviços` e `para a`. Ele entrou como fixture — sem ele a regra voltaria a valer por
um documento só. As sete peças escrevem a mesma informação de quatro maneiras, e a regra reconhecia
uma.

**A decisão que decidiu o desenho:** o terminador do nome é a **sigla**, não o ponto. O `\s*\.` de
antes só funcionava porque no aditivo o órgão fecha a frase; na proposta comercial ele não fecha, e
capturar até o ponto produziria
`SECRETARIA … - SMUL E A EMPRESA TECNOLOGIA … (PRODAM) PARA A PRESTAÇÃO DE SERVIÇOS DE …` — a
**contratada dentro do nome do cliente**, na capa de um documento que vai ao órgão. Foi medido antes
de escrita a espec, e virou teste.

**Ambiguidade não escolhe:** dois órgãos distintos na mesma página não derivam nenhum — cai para
`R-CAP-10`, e `V-CAP-01` avisa. E **`V-CAP-01` continua no código** mesmo deixando de disparar em
documento conhecido: é o alarme do dia em que aparecer um órgão fora do vocabulário, que é lista
fechada por decisão (`D-04`).

**O que não mudou:** os quatorze campos de capa do piloto e do PGM, congelados antes da primeira
linha de código; os sete `sha` de extração da ESPEC 033; e nenhum artefato reancorado — o `git diff`
de `backend/tests/` traz arquivos novos e inserções.

**Onde:** ESPEC 034 `R-CAP-11` a `R-CAP-15` e `R-DOC-11` · `_CLIENTE` · `_PROPOSTA` ·
`_VOCABULARIO_DE_ORGAO`

---

## 2026-08-27 — A leitura da grade desce da página para a linha (ESPEC 033)

**O que mudou:** cada linha da tabela de itens passa a ser lida com as divisórias **desenhadas na
faixa que a cobre**, e não com as da geometria da página. A linha `TOTAL:`, que é desenhada com
células mescladas e traz dois traços em vez de oito, herda as da tabela acima — e só quando os seus
traços pertencem àquele conjunto. `para_decimal` passou a normalizar o espaço entre o sinal e os
dígitos.

**Por quê:** o `PA-SMUL-250314-22` era recusado com `422` — *"item 12.030.00002.00 (página 4) sem
preço unitário, meses"*. A página 4 dele tem **três** tabelas de itens de larguras diferentes na
mesma folha, mais o cronograma. A ESPEC 019 já fizera a **descoberta** da geometria por faixa; a
**leitura** continuou por página, e a premissa *uma tabela por folha* sobreviveu três especs porque
no aditivo do PGM as três geometrias estavam em páginas diferentes. Foi a amostra, não a regra.

**O que não mudou — e nesta entrega é a parte longa.** Os dez documentos que já extraíam saem com as
**mesmas tuplas de item**, `sha` por `sha`, com os mesmos totais, blocos e geometrias admitidas.
**Nenhum artefato foi reancorado:** `CORPO_DO_PILOTO_*`, `test_identidade_dos_artefatos`,
`linhas_do_documento.json` e as âncoras de `.xlsx` estão intocados, e o `git diff` de
`backend/tests/` traz arquivos novos e uma linha de `@parametrize` expandida. Backend **1.422 →
1.458 passed**.

**A decisão que decidiu o desenho:** a herança da linha `TOTAL:` é **por subconjunto, não por
proximidade**. Os dois traços do `Redução TOTAL:` são `428,7` e `516,9`, e `516,9` não existe no
conjunto da `Inclusão` — que é a tabela imediatamente acima na folha. *"Vale a última linha que teve
divisórias"* passaria em todos os documentos de hoje e levaria o bloco `Redução` para dentro do
`Aumento`, com o checksum ainda fechando.

**O que a execução corrigiu na espec.** A v1.0 atribuía o encaixe da grade da `Inclusão` sobre a
`Redução` a três folgas de 0,6 pt dentro de `TOLERANCIA = 1.5`. Medido na `T-2198`: **não há folga
nenhuma** — as 22 candidatas verticais da página são a união das quatro tabelas, e nela toda coluna
de toda geometria casa **exata**. A tolerância nunca é exercida. A espec foi para v1.1; a correção
não mudou.

**A tentação registrada, com número:** aplicar a leitura por faixa também ao crivo de admissão de
geometrias faria o crivo aprovar **todas** as candidatas — 2 de 2 no piloto, 2 de 2 no PGM, 4 de 4
no aditivo do PGM, 5 de 5 no SMUL —, inclusive a do cronograma que a ESPEC 019 §2.5 barrou. Por isso
`ler_celulas` recebe a leitura por faixa **sob bandeira**, com o padrão de hoje, e `_linhas` não a
passa.

**Onde:** ESPEC 033 `R-FXA-01` a `R-FXA-08` e `R-NUM-01` · `grid.verticais_por_linha` ·
`scripts/medir_extracao.py`

---

## 2026-08-20 — A metade que faltava da correção da ESPEC 001 §9.4 (ESPEC 032)

**O que mudou:** a linha de item que atravessa a quebra de página deixa de perder a cauda da
descrição. Três itens em dois contratos saíam cortados — um deles na palavra `PERFIL`, **antes da
letra**, justamente no item cujo perfil contratado difere do medido.

**Por quê:** a ESPEC 001 §9.4 corrigiu o **rodapé** — a parte da linha que fica abaixo da última
borda da sua própria página — com o limite sintético de `montar_grade`. O **cabeçalho** ficou: a
parte impressa no topo da página seguinte não pertence a linha nenhuma daquela página, e não havia
quem a devolvesse à anterior. Os dois códigos são os mesmos daquela seção porque são os que caem no
fim da página nestes contratos.

**O que não mudou:** nenhuma quantidade, preço, mês ou total — conferidos no conjunto inteiro dos
três documentos, e `V-CTR-03` fecha nas três peças. Nenhuma contagem de linha, divergência ou
situação. `CORPO_DO_PILOTO_TEXTOS` e `_CODIGOS` também não: a descrição sai num único `<w:t>`, e
completá-la não acrescenta elemento nenhum.

**A decisão que decidiu o desenho:** a regra ingênua — *"o que está acima da grade pertence à linha
anterior"* — colaria **177 palavras de prosa sobre SOA** numa descrição contratual. O crivo é a
**coluna**: zero palavras fora da de descrição nos três casos verdadeiros, 93 / 110 / 117 nos três
falsos, sem valor intermediário. É tudo ou nada — a p6 do aditivo **tem** palavras na coluna, e é o
único teste que reprova crivo frouxo.

**Onde:** ESPEC 032 `R-CON-01` a `R-CON-07` · `V-CTR-06` · `grid.cauda_da_pagina`

---

## 2026-08-20 — A regra do desconto sobe de código para bloco (ESPEC 031)

A `R-MED-02` manda prevalecer, entre duas ocorrências do mesmo código, a que desconta recursos de
desenvolvimento. Estava implementada **por código**: `item_para` procurava uma ocorrência descontada
daquele código e, não achando, caía no atalho *"vale a última lida"*.

O que a planilha expressa é regra **por bloco**. A apuração descontada de uma seção é um
restabelecimento completo dela, e um código que ela omite mediu zero — quem monta a planilha
expressa esse zero **apagando a linha**, não escrevendo `0`. O Confere lia o silêncio como
*"não há variante"* e devolvia a quantidade bruta.

- **Dois códigos em 120**, nos dois pares reais: o `14.049.00054.00` no piloto, medindo 2, e o
  `14.049.00037.00` no PGM, medindo 1. Ambos com contratada `0` — eram servidores de
  desenvolvimento, que não se cobram do cliente.
- **O único item crítico do piloto era artefato de leitura.** O documento que vai ao órgão afirmava
  consumo de dois servidores sem cobertura contratual. É afirmação errada em peça de faturamento, e
  pior que um aviso a mais na tela: uma acusação sem base.
- **Um exemplo da ESPEC 028 caiu junto.** A §1 daquela espec usou o `14.049.00054.00` como *"o
  contraste que fecha o argumento"* da `R-ZER-01` — e escolheu, entre os quatro itens do bloco final
  do piloto, justamente o único que o sistema fabricava. O argumento continua correto; o exemplo
  evaporou, e a §1.1 de lá registra isso.
- **A `R-ZER-04` ganhou o seu primeiro caso real, sem ninguém pedir.** O `…00054.00` era a única
  linha que a `R-ZER-01` ainda desenhava no bloco final do piloto; zerada, o bloco esvaziou e o
  documento perdeu faixa, asterisco e nota. A alternativa — afirmar *"nenhum item fora do contrato
  teve movimento"* — foi oferecida a quem pediu e recusada: o documento não ganha conteúdo novo.
- **`V-MED-04` é a única validação do projeto que protege contra o que não aparece como vermelho.**
  O pareamento é por título; uma planilha futura que grafe a marca de outro jeito desligaria a regra
  sozinha e em silêncio, devolvendo o defeito. Ela é calada nos dois pares reais, e é assim que tem
  de ser.
- **A suíte passou a abrir os arquivos de produção.** Até aqui ela tocava só `tests/fixtures/`, e foi
  esse o buraco da ESPEC 018 §2.8. O marcador `producao` é o segundo do projeto.
- **O `.xlsx` não é byte-estável entre execuções**, e ninguém sabia: duas renderizações do mesmo
  relatório diferem no `dcterms:modified` de `docProps/core.xml`. A ESPEC 031 v1.0 inventou uma
  âncora de arquivo inteiro que era irreprodutível; o critério passou a ser por entrada do pacote —
  o método que `test_identidade_dos_artefatos.py` já documentava e ninguém tinha aplicado ao `.xlsx`.
- **O inventário de âncoras veio curto pela terceira vez neste projeto**, apesar de seis buscas
  nomeadas. Faltou a sétima: as contagens de **divergência** (`== 37`), enquanto a busca feita
  cobria as de **linha** (`== 5x`). Seis testes apareceram só na suíte completa — todos afirmando
  números que a espec já previa.

---

## 2026-08-20 — Duas regras da tela perdem a premissa (ESPEC 030)

A ESPEC 018 mudou o universo e a ordem do relatório, e duas regras de interface escritas antes dela
deixaram de fazer sentido. Ficam revistas — não porque envelheceram, mas porque o chão delas saiu.

### `R-DIV-03` (ESPEC 002) — o agrupamento por seção

- **A regra pedia duas coisas na mesma frase**, e não por acaso: *"as linhas mantêm o agrupamento
  por seção **e a ordem do relatório**"*. O agrupamento **era** a ordem — as seções `A`, `B`, `C`
  são da planilha, e o relatório seguia a planilha.
- **A `R-REL-03` trocou a ordem** pela da tabela de itens do contrato, que não tem seções.
  Reordenando por ele, itens de seções diferentes se intercalam: não há faixa possível numa lista
  que não está mais na ordem delas.
- **O `.docx` concorda** — zero faixas de seção nas âncoras do documento. A tela está consistente
  com o entregável.
- **Isto foi classificado como defeito antes de ser conferido.** A pergunta *"nenhuma regra remove
  as faixas?"* tinha resposta certa e era a pergunta errada; a certa era *"alguma regra as tornou
  impossíveis?"*. Uma ESPEC 031 chegou a ser proposta sobre essa premissa não verificada, e foi
  cancelada.
- **Se o agrupamento fizer falta, é entrega nova e é escolha**: o que ganha, a ordem do contrato ou
  as seções da planilha.

## 2026-08-20 — `R-PAN-07` fica revista: o item crítico aparece nas duas vistas (ESPEC 030)

A ESPEC 009 exigia que o item medido sem previsão contratual aparecesse **uma única vez na tela**.
Deixa de valer, e o motivo é que a premissa dela deixou de existir.

- **A regra era sobre uma exceção.** Quando foi escrita, o item estava fora do universo do
  relatório e o grid tinha um bloco no topo só para ele. `R-PAN-07` tirou o bloco e mandou o item
  para *Item crítico*, para que ele não ficasse nos dois lugares.
- **A ESPEC 018 `R-REL-01` o tornou linha comum.** O universo passou a ser a aba; ele é impresso no
  `.docx` que vai ao órgão. Linha que diverge aparece no grid de divergências, como todas.
- **Nenhuma soma é inflada, e foi isso que decidiu.** O cabeçalho conta 37 divergências em 58
  linhas; o painel conta 58 itens em quatro situações. O item entra uma vez em cada — contagens
  distintas, cada uma somando o universo inteiro.
- **A alternativa custava mais do que resolvia:** escondê-lo do grid faria o cabeçalho dizer 37 com
  36 linhas na tela, e a tela mostraria menos do que o documento entregue.
- **A preocupação original não morreu** — alguém ler o mesmo item como dois achados. Ela deixou de
  ser resolvida por omissão e passou a depender de as vistas se nomearem. Fica como `I-05`.

Decidido pelo dono do produto, sobre a evidência medida por componente.

## 2026-08-20 — O primeiro portão que **pergunta** em vez de trancar (ESPEC 029)

`Severity` tinha dois valores desde a ESPEC 001, e os dois eram sobre **gravidade**: `BLOQUEIA` e
`AVISA`. O terceiro, `PERGUNTA`, é sobre outra coisa — **de quem é a decisão**.

- **A decisão foi do negócio, e é melhor do que a proposta.** A ESPEC 029 v1.0 propunha bloquear
  quando o órgão do contrato divergisse do órgão do levantamento. A resposta ao `I-04` foi *"o
  sistema deve avisar e perguntar se deseja continuar"* — e a razão sustenta: o sistema **não sabe**
  qual dos dois arquivos está errado, só sabe que não combinam. Trancar seria decidir com
  informação parcial o que quem confere decide com informação inteira.
- **O que não se abriu mão:** sem resposta, não sai documento. O aviso passivo já foi medido e não
  funciona — o par trocado produzia **dezenove** avisos e um `.docx` com a capa de um órgão e o
  cabeçalho de outro.
- **Perguntar exigiu inverter a ordem do trabalho.** Perguntar depois do processamento custaria
  ~30 s para fazer a pergunta e mais ~30 s para refazer tudo ao ouvir *sim*. O
  `POST /reports/conferencia-previa` lê **só** a primeira página de cada peça e dez linhas da aba:
  responde em 0,9 s. É o primeiro caminho do projeto que abre um arquivo sem querer extraí-lo.
- **E exigiu uma regra de resiliência**: o portão **falha aberto** (`R-IDT-12`). Ele existe para
  economizar trinta segundos, e não pode virar a razão pela qual alguém não fatura.
- **A identidade sai de prosa, e é a segunda vez** — depois do nome do órgão na capa (ESPEC 020
  `D-05`). O que limita o dano é a assimetria: ausência de declaração é **silêncio**, nunca
  acusação, e o pior desfecho de um engano do sistema é uma pergunta a mais.
- **O sufixo do aditivamento não divide o contrato** (`I-03`). `52-A/SMIT/2024` e `52/SMIT/2024`
  são o mesmo instrumento; quem compara é a base numérica. Sem isso, todo contrato renumerado
  perguntaria à toa — e é justamente o contrato aditivado que mais passa pelo Confere.

## 2026-08-19 — A ESPEC 018 `D-04` ganha a sua primeira exceção (ESPEC 028)

*"Nada mais é omitido"* deixou de ser literal. A linha do bloco final que a aba zera **nas duas
colunas** não é mais desenhada no `.docx`.

- **A `D-04` não estava errada, estava larga demais.** Ela nasceu contra a `R-DIV-05`, que deixava
  de fora **todo** item sem previsão contratual — inclusive os medidos, que eram o achado. O
  princípio que ela defendia é *"o que tem o que dizer aparece"*, e é ele que continua valendo:
  `0 / 2` e `5 / 0` seguem no documento, e só some o `0 / 0`, que não afirma nem desmente nada.
- **O modelo GRC já fazia essa economia — e mais.** Nenhum dos quatro códigos do bloco final do
  piloto aparece nas páginas de comprovação do modelo, inclusive o `0 / 2`. A ESPEC 018 acertou ao
  trazer os quatro de volta; esta espec devolve à omissão os três que não diziam nada.
- **A omissão é do documento, nunca do dado** (`R-ZER-05`, `D-01`). O grid, o `.xlsx` de análise e
  a API continuam com o bloco inteiro — eles existem para conferir, e conferir é o oposto de
  omitir. Um teste dedicado afirma as duas coisas ao mesmo tempo: `demais_itens` com 4 e 13
  códigos, `.docx` com 1 e 6.
- **O predicado é do domínio; a decisão de não desenhar é da apresentação** (`D-02`). *"Esta linha
  não afirma quantidade nenhuma"* vale onde quer que ela seja lida; *"logo, não desenhe"* vale num
  documento só.
- **Célula vazia continua não sendo zero** (`R-ZER-03`, T-1272). Onde a aba nada afirma sobre o
  contratado não há dois zeros — há um zero e um silêncio, e a linha fica.
- **A regra do TASKS 026 §9.10 foi exercida na primeira oportunidade.** Duas mudanças de documento
  conviveram na árvore — o `*` da ESPEC 024 v1.1 e esta —, e as quatro âncoras ficaram vermelhas
  de propósito por um dia até que a segunda ficasse pronta. A reancoragem foi única, com os dois
  deltas provados em separado e a aritmética do corpo do piloto fechando por dois caminhos
  independentes (16.029 → 16.017 textos, 79 → 76 códigos).

## 2026-08-18 — O bloco final passa a explicar o que é (ESPEC 024)

O título `DEMAIS ITENS DO LEVANTAMENTO` ganhou um asterisco e uma frase que diz o que ele
significa. É a menor entrega do projeto até aqui, e o que ela ensinou é maior do que ela.

- **O título era neutro e mudo.** A ESPEC 018 `D-06` o escreveu neutro de propósito — a ausência do
  código pode ser do contrato submetido ou da extração do PDF, e a aplicação não tem elementos para
  distinguir. A neutralidade estava certa; o que faltava era dizer **o mecanismo**. Quem lê o
  documento sem conhecer o sistema não tinha como saber que "demais itens" quer dizer *código sem
  correspondência na tabela de itens do contrato analisado*.
- **`R-NOT-05` — a frase explica, não julga.** Continuação direta da `D-06`: descreve o mecanismo e
  não atribui a ausência a lado nenhum. O documento vai ao órgão.
- **Asterisco no título e nota junto ao rodapé, em vez de nota inline** (`D-01`). A faixa do título
  é linha de tabela com altura e largura medidas do modelo GRC; prosa ali arriscaria quebra numa
  medida que não foi dimensionada para isso. O rodapé já é o lugar da metainformação.
- **A nota é condicional** (`R-NOT-03`, `D-04`): sem bloco final, nada aparece. Mesmo raciocínio da
  `R-PER-10` da ESPEC 021 — texto permanente sobre algo que não existe naquele documento é ruído.
- **Não é nota de rodapé nativa do Word** (`D-03`). `python-docx` não expõe API para isso, e
  manipular XML bruto do OOXML não se paga por uma frase que um parágrafo de corpo resolve.
- **O asterisco não precisou de condicional.** O renderizador já só usava o título quando o bloco
  final existe. Terceira vez que uma previsão dessa espécie se confirma, depois da `T-1533` da
  ESPEC 021 e da `T-1710` da ESPEC 023.
- **O plano inventariou as âncoras pelo nome do arquivo, e errou.** O portão `P1` nomeava
  `test_docx_formatacao.py` e `test_docx_estrutura.py`; os dois fecharam verdes e a suíte completa
  reprovou em `test_capa.py::test_t1408` — âncora **total** do corpo do `.docx` (contagem de
  `<w:t>`, contagem de códigos e `sha256`), que mora num arquivo cujo nome fala da capa e cuja
  asserção mais forte é sobre tudo o que *não* é a capa. **O critério que passa a valer: inventário
  de âncoras se faz por o que o teste afirma, não por onde ele mora.**
- **A âncora acertou; o risco estava em reancorá-la.** Um `sha256` só pode vir da saída do código —
  não há fonte externa de onde transcrevê-lo —, e colá-lo às cegas faria o teste afirmar *"o código
  faz o que o código faz"*. Em vez disso ficou provado que desfazer **apenas** as duas mudanças
  previstas reproduz o hash anterior caractere a caractere. `CORPO_DO_PILOTO_CODIGOS` permanecer em
  79 é a confirmação independente de que nenhuma linha de item se moveu.
- Suíte de backend **556 → 559**, verde. `ruff` e `mypy` limpos nos arquivos tocados. Nada no
  frontend, na API, no XLSX de análise ou nas regras de quais códigos entram no bloco final.

---

## 2026-08-18 — O aviso de divergência vira tabela, em dois estados (ESPEC 023)

A `V-REC-01` deixou de ser cinco frases âmbar e passou a ser uma tabela com a diferença que
endereça o aditivo faltante — e, pela primeira vez, com **dois diagnósticos distintos**.

- **A ESPEC 022 mudou o significado do aviso, e a tela exibia a frase do significado antigo.** Com
  o contratado somando os aditivos, a mesma divergência passou a valer duas coisas opostas: *sem
  aditivo anexado* é provavelmente peça faltante, e a ação é anexá-la; *com aditivo anexado* os
  números não fecham nem com a peça, e isso é o mais próximo de dado errado que o sistema detecta.
  A tela era idêntica nos dois casos.
- **`R-FON-02` — dois estados, com o eixo de severidade da ESPEC 009**, sem cor nova:
  `MAIOR_RELEVANCIA` para o primeiro, `CRITICO` para o segundo. É o conteúdo da entrega; sem ele o
  que sobra é uma tabela mais bonita.
- **A coluna de diferença é a razão de a tabela existir** (`D-03`). No PGM ela dá `+1.100,00`,
  `+2.900,89`, `+554,01`, `+5,00` e `−80,00` — que são, número a número, o conteúdo dos blocos
  `Aumento` e `Redução` da peça não submetida. Transforma *"algo está diferente"* em *"procure por
  554,01 no aditivo"*.
- **O rótulo da coluna varia com o estado** (`R-FON-03`): *"Na proposta"* sem aditivo aplicado,
  *"Contratado vigente"* com ele, e a decomposição `proposta 200,00 + aditivo 1.100,00` embaixo —
  que é o que prova ao leitor que a soma foi feita.
- **`V-REC-01` deixa de ser achado** (`R-FON-09`), pelo precedente da `R-PER-08`. A informação não
  foi descartada: foi promovida de uma frase para um registro com nove campos.
- **A validação devolve em vez de registrar** (`I-29`). O precedente da ESPEC 021 moveu a `V-REC-02`
  para o caso de uso porque a derivação já acontecia lá; aqui a comparação **é** a validação, e
  movê-la a dissolveria como unidade nomeada com arquivo e teste próprios.
- **Seis âncoras mudaram de fonte sem mudar de sentido.** A mais delicada é a `test_t1605`, da
  ESPEC 022 — a única evidência viva de que a cegueira da `V-REC-01` fechou. Reancorada em
  `avisos == []` ficaria verde e provaria o contrário do que foi escrita para provar; foi
  reancorada no campo novo **mais** a severidade, e saiu mais forte do que entrou.
- Suíte de backend **547 → 556**, contagem reconciliada. `divergencia.spec.ts` 7/7; `axe` 14/14 nas
  duas larguras, com os dois estados novos entrando na varredura parametrizada sem linha extra.
  `ruff`, `mypy`, `bandit -ll`, `tsc --noEmit`, `next lint` e `next build` limpos.
- **O `.docx` e o `.xlsx` não mudaram**, pela âncora diferencial da ESPEC 022 — que cobriu
  `R-FON-13` sem uma linha nova.
- **Portão `P5` fica aberto:** exige duas pessoas do faturamento diante das telas, e nenhum teste o
  substitui.

### O que esta entrega encontrou e não corrigiu

**O andaime reintroduziu na tela o defeito que o teste procura.** O dublê de resposta continuava
injetando `V-REC-01` em `avisos` depois de o backend ter parado de emiti-la, e o teste da sigla
reprovou por causa do próprio instrumento. O docstring do dublê previa a remoção em letras e ela
não foi executada — registrado em §11.1 do TASKS 023 como lição para o próximo backlog desta
forma: **a tarefa de remoção tem de listar os dublês, não só o código de produção.**

**`next build` com o `pnpm dev` no ar derruba o servidor de desenvolvimento**, que passa a devolver
500 por chunk ausente. Armadilha de ambiente, não do projeto.

---

## 2026-08-18 — O contratado passa a somar os aditivos (ESPEC 022)

`Contract.aplicar` aplicava só `Inclusão` e `Exclusão`; `Aumento` e `Redução` eram descartados
(`R-ADT-06`), e a `V-REC-01` comparava a proposta **sem os deltas** contra a planilha. Para não
acusar cinco divergências falsas no PGM, a ESPEC 019 `D-08` a fazia **calar** sobre os códigos que
aqueles blocos tocavam.

- **O silêncio era cego, e isso não estava medido.** Naqueles cinco códigos nada era conferido.
  Com a aba declarando `1.400` onde o contratado consolidado é `1.300`, o sistema anterior acusava
  **zero**. Com os deltas somados, acusa aquele código — e só ele.
- **Os quatro rótulos passam a ser aplicados** (`R-QTD-01`). `quantidade_para` já somava as várias
  linhas de um código na proposta, e soma a do aditivo pelo mesmo caminho.
- **O sinal vem do documento, não do rótulo** (`R-QTD-02` / `D-02`). A `Redução` do PGM é extraída
  `-80,00`, com o total do bloco em `-897.734,40`. Derivar o sinal de `RotuloDeBloco` criaria uma
  segunda fonte de verdade para a mesma informação.
- **O delta só é aplicado a código já presente** (`R-QTD-03` / `D-03`), e `presentes` é recalculado
  dentro do laço para preservar a ordem de `R-ADT-07`. É o único caminho pelo qual esta regra
  alcançaria o `.docx`: um `Aumento` órfão ganharia posição no contrato e sairia do bloco final
  para o corpo ordenado.
- **O `.docx` e o `.xlsx` não mudam** (`R-QTD-05`), e não é promessa de cadeia de chamadas: os
  artefatos foram comparados parte a parte dentro do zip, e o objeto `Report` que os alimenta
  também. A única diferença era `dcterms:modified`, o carimbo de hora — a parte foi aberta antes de
  ser excluída da comparação.
- **A âncora ficou diferencial, não instantânea** (desvio da `T-1601`). Hashes armazenados
  prenderiam a suíte à saída atual do renderizador; a implementação compara dois consolidados que
  diferem só nas quantidades e exige artefatos idênticos. Afirma a regra, não o layout.
- **Um teste foi partido, não apagado.** `test_t1320_aumento_e_reducao_nao_mudam_nada` afirmava a
  regra revogada e se anunciava como *"o coração da espec"*. Metade das suas asserções continua
  valendo — e é a que protege o documento. Virou
  `test_t1320_aumento_e_reducao_nao_criam_codigo`.
- **`codigos_ignorados()` ficou** (`R-QTD-07`). Parecia existir só para alimentar o `explicados`;
  é o insumo de `V-ADT-04`, e removê-la derrubaria uma validação sem relação com esta espec.
- **A `V-ADT-02` mudou de texto, não de predicado** (`R-QTD-08` / `D-06`). Aditivo só de
  quantitativo passou a ter **um** efeito e não **nenhum**: o documento sai igual, a conferência
  muda.
- Suíte de backend **537 → 547**, contagem reconciliada tarefa a tarefa. `ruff`, `mypy` e
  `bandit -ll` limpos. **Nenhum arquivo de `frontend/` alterado.**

### O que esta entrega encontrou e não corrigiu

**O manual ensina o oposto do que o sistema faz.** Três dos quatro trechos que citam `V-REC-01` em
`scripts/conteudo_do_manual.py` afirmam *"o relatório usa a do contrato"* — falso desde a ESPEC 018
`D-05`, três especs atrás. Não corrigido aqui (`K-29`): emendar três linhas dentro de um documento
com o defeito medido em `I-22` daria a impressão de que ele está em dia.

**O comentário do `contratada_texto` mentia havia três especs**, e no domínio — que é onde alguém
lê para descobrir de onde vem o número do documento. Corrigido de passagem (`T-1625`). Ele e as
três linhas do manual têm a mesma origem, e nenhuma auditoria os pegou porque comentário e prosa
não quebram teste.

**A `R-CTR-01` ficou disponível, e não foi tomada.** A ESPEC 018 `D-05` a revogou com uma premissa
explícita — *o PDF é de 11/11/2025 e a aba é de 23/07/2026, o contrato está defasado*. Com os
aditivos aplicados essa premissa cai. Registrado em `I-26`; mexer nela muda o entregável, e o
pedido de origem foi categórico sobre não tocá-lo.

---

## 2026-08-18 — A célula da planilha vai à tela, e a `V-REC-02` sai (ESPEC 021)

As linhas que saem `1 / 1` por derivação (`R-REL-08`) deixaram de ser cinco frases amarelas e
passaram a ser uma tabela com o conteúdo das duas células, o número da linha na aba e o que o
documento recebeu.

- **`V-REC-02` deixa de ser achado** (`R-PER-08`). Não é informação descartada: é a mesma
  informação promovida de uma frase para um registro de seis campos, na linha do precedente
  `R-REL-13` da ESPEC 018 com a `V-CTR-04`. O piloto passa a não ter **nenhum** aviso.
- **A perda de informação declarada na ESPEC 001 §9.3 aparece na tela pela primeira vez.** O
  `14.048.00008.00` do piloto está contratado no perfil `D` e medido no `C`; a frase antiga
  mostrava só o `C`. Vinte especs depois, as duas letras ficam lado a lado.
- **Um `2` que virava `1` em silêncio.** O `14.025.00011.00` do piloto tem quantidade contratada
  `2` e medida `PACOTE`. Nem documento, nem grid, nem painel de análise diziam isso.
- **A descrição da tabela vem da aba, não do contrato** (`D-01`). Medido: a descrição contratual
  do `14.048.00008.00` **termina na palavra `PERFIL`**, cortada antes da letra — justamente no
  item cujo perfil contratado difere do medido.
- **`R-PER-02` foi emendada na execução.** Prometia *"texto bruto da célula"*; o que existe é o
  texto normalizado na leitura pela `_texto()`. Para as nove células medidas não muda nada, e a
  emenda impede a leitura literal que mandaria reabrir a planilha.
- **A linha do `V-REC-02` saiu do manual** em vez de ser corrigida: descrever como validação o que
  já não é validação mandaria o leitor procurar um aviso âmbar inexistente. O comportamento ganhou
  a §8.3 do manual.
- Suíte de backend **522 → 537**; navegador **78 de 88**, com as mesmas dez falhas anteriores à
  entrega e nenhuma nova. O `.docx` e o `.xlsx` não mudaram — provado por âncora de invariância
  capturada antes da primeira linha de código.
- **Portão `P5` fica aberto:** exige uma pessoa do faturamento diante da tela, e nenhum teste o
  substitui.

### O que esta entrega encontrou e não corrigiu

A suíte de navegador estava **vermelha antes dela**: 74 de 84, medidos contra o código intocado.
As dez falhas rastreiam para trabalho não commitado das ESPECs 018 e 019 — quatro pelo terceiro
campo de upload, cinco por contagens, e uma por colisão de desenho que ninguém decidiu (o item sem
cobertura contratual deve aparecer uma vez ou duas?).

**Causa raiz:** a `T-1280` do TASKS 018 — *"ajustar os seletores que dependem de cabeçalho de
seção"* — foi executada ao pé da letra, num arquivo só. `smoke` e `analise` ficaram porque a
quebra deles é de **contagem**, não de seletor. O `§0 Resultado` daquele backlog declara, na mesma
tabela, o número que o `smoke.spec.ts` ainda exige — e fecha reportando só *"Testes de backend
405 → 423"*. As ESPECs 019 e 020 não mencionam navegador em linha nenhuma, e o `§14` que o TASKS
018 promete não existe.

A lição, que é a mesma da ESPEC 020 §6 por outro caminho: **mediu-se o backend e concluiu-se sobre
a entrega**. Fica como `K-26` no TASKS 021, e a recomendação é que a definição de pronto do
frontend passe a incluir a suíte de navegador, com o `§0 Resultado` reportando os dois números.

---

## 2026-08-14 — O relatório passa a seguir o levantamento (ESPEC 018)

O catálogo saiu. O universo do relatório é a aba `Levantamento`, ordenado pelos
códigos do contrato, sem agrupamento e sem terceiro arquivo.

- `PA-PGM-251015-159` deixa de bloquear: de **26 achados bloqueantes para 0**, e
  passa a gerar documento de 58 linhas.
- **Defeito de produção corrigido**: a regra do desconto de recursos de
  desenvolvimento (`R-MED-02`) estava desligada nos **dois** pares reais. As
  faixas de bloco são células mescladas, e o crivo exigia texto só na primeira
  coluna — 1 de 35 faixas reconhecidas no piloto, 1 de 38 no PGM. O valor saía
  certo por coincidência, porque o desconto está listado por último nos dois.
- A geração da fixture **normalizava a mesclagem** e escondia esse defeito da
  suíte inteira. O `sanitize_fixture.py` passou a preservar a forma do insumo.
- `V-REC-01` passa a avaliar todo código do contrato: no PGM sai de 3 para 5
  divergências visíveis, incluindo 554,01 horas de especialista e 1.100 GB de
  volumetria SQL.
- Nada mais é omitido do documento: o que só a aba conhece sai em
  `DEMAIS ITENS DO LEVANTAMENTO`, ao final.

## 2026-08-12 — A grade do contrato deixa de ser uma coordenada e passa a ser um achado

**O que mudou:** a aplicação lê contratos de qualquer órgão. Até aqui lia **um**.

**O sintoma foi 57 mensagens de erro numa tela só.** Ao submeter o `PA-PGM-251015-159`, o
processamento bloqueou com um `V-CTR-01`, um `V-CTR-03` e **55** `V-CTR-02` — um por entrada
visível do catálogo. Havia um defeito, e 56 das mensagens eram consequência aritmética dele: com
`Contract.itens` vazio, nenhum código do catálogo resolve e nenhum total é encontrado. A única
mensagem acionável saía da área visível na nona linha.

**A causa vale registrar porque o código a denunciava por escrito.** O cabeçalho do extrator
declarava o princípio certo — *"a tabela é localizada por âncora de conteúdo e nunca por número de
página fixo: um aditivo com uma página a mais deslocaria tudo"* — enquanto a grade era localizada
por **coordenada absoluta**: oito posições *x* medidas no contrato-piloto, com tolerância de
1,5 pt. É uma dependência mais frágil do que o número de página que o comentário rejeitava. A
tabela do `PA-PGM` está 17 pt à direita, e nada foi lido.

**Eram dois defeitos, e o segundo não estava no diagnóstico.** Corrigir só o gabarito extraía 42
dos 47 itens e ainda devolvia total nulo: o filtro guardava **toda** candidata perto de alguma
coluna e depois exigia que sobrassem oito, e na página do quadro de totais havia uma divisória a
**0,7 pt** de uma coluna da tabela de itens. Nove candidatas, página descartada, `TOTAL:` junto. O
mesmo defeito já estava armado no piloto — a página 29 só escapa porque suas divisórias vizinhas
estão a 3,0 pt, o dobro da tolerância.

**A correção não trocou uma constante calibrada por outra**, que era o risco óbvio. O gabarito
passou a ser derivado do próprio documento, por duas propriedades do negócio: a tabela de itens
tem sete colunas, e é onde estão os códigos de serviço. A ligação entre as duas é a repetição — o
conjunto de oito divisórias aparece **idêntico, valor por valor**, nas páginas que a tabela ocupa.
Igualdade exata, nada a calibrar. O desempate por código de serviço é o que separa a tabela certa
da página 30 do piloto, que tem oito divisórias, 85% da largura e nenhum código.

**A lição é sobre o que uma suíte de um-só-documento consegue ver.** Ela passava 100% enquanto o
produto falhava em campo, e não por descuido: todo teste do extrator estava certo, e nenhum podia
falhar, porque o acoplamento à geometria do piloto era invisível de dentro dele. O que mudou isso
não foi um teste novo — foi um **segundo contrato real** na suíte, com o teste exigido a reprovar
antes de qualquer correção. Hoje são dois contratos, de órgãos e geometrias diferentes, extraídos
pelo mesmo código sem parâmetro de layout, os dois com checksum fechando em `0,00`.

**Duas coisas mudam para quem usa:** um contrato ilegível relata **uma** causa em vez de 57
consequências, com o que foi observado no documento — páginas, páginas com borda, divisórias
encontradas —; e um contrato de geometria diferente da de referência sai com aviso `V-CTR-04`,
porque quem confere merece saber disso antes de assinar.

**O que continua bloqueando o `PA-PGM` não é defeito.** Lida a tabela, restam 26 `V-CTR-02`
legítimos: o catálogo padrão foi semeado do contrato SMIT, e aquele é outro contrato, com outro
escopo. A saída é subir o catálogo correspondente — é insumo, não código.

---

## 2026-08-12 — Limpar para recomeçar, e o vazamento que o botão obrigou a corrigir

**O que mudou:** a tela ganhou um botão **Limpar**, com confirmação, que devolve a aplicação
ao estado inicial sem recarregar a página. E, junto, a liberação dos documentos em memória
mudou de âncora.

**A pergunta que originou foi de quem usa:** *"para submeter novos arquivos é necessário
atualizar a página"*. A premissa estava **parcialmente** certa, e a diferença decidiu o
escopo: trocar um arquivo por **outro** já funcionava; o que era impossível era voltar à tela
vazia. Só que o caminho que funcionava tinha um defeito.

**O botão não acrescentou uma disposição de recurso — ele obrigou a corrigir a que existia.**
`R-ACE-18` mandava liberar cada *blob* "quando substituído por outro", e a implementação
ancorou isso **no envio**, com um comentário que dizia: *"liberar no envio basta: qualquer
transição para `erro` ou `bloqueado` passa por aqui"*. A frase estava certa sobre `erro` e
`bloqueado` e **omitia o caminho que não passa**: escolher outro arquivo leva `pronto →
inicial` sem tocar no envio. Três caminhos abandonam `pronto`; a âncora cobria **um**. Cada
troca de arquivo retinha ~3,8 MB pela sessão inteira, e o defeito atravessou duas especs sem
que nada acusasse.

**A lição principal é sobre o que a suíte consegue ver.** A espec declarou a verificação
**humana**, herdando da ESPEC 008 a afirmação de que *"não há asserção de memória na suíte"*.
A premissa está certa e a conclusão não era: **liberar um blob não é medir memória, é revogar
um identificador** — e identificador revogado é observável, porque um `fetch` sobre a URL
revogada falha. O `href` do botão *Baixar DOCX* **é** esse identificador, exposto no DOM.

Com isso o portão mudou de natureza: saiu do fim da entrega, onde seria conferido por boa
vontade, e virou o teste que **tinha de falhar primeiro**. Contra o código anterior ele
reprovou com `[true, true]` onde exigia `[false, false]`. É o registro que interessa guardar:
*"a suíte não vê memória"* não implica *"a suíte não vê o defeito"*.

**Limpar a tela não é limpar o formulário.** Zerar o estado do React devolve o rótulo
`escolher arquivo…` e deixa o `<input type="file">` carregando a seleção anterior — a tela diz
uma coisa e o formulário contém outra. A limpeza remonta os dois campos, e isso foi verificado
em **Chromium e Firefox** justamente porque se reescolher o mesmo arquivo dispara um novo
evento é dependente de motor: a decisão foi **não depender disso**.

**O botão não entrou na barra, e não se chama "Novo relatório".** As duas coisas estavam
propostas desde a ESPEC 007 e foram recusadas: *Novo relatório* promete gerar, e ele descarta;
e a barra só mostra dado real, disciplina que uma espec nova seria o pretexto fácil para
furar. Ele mora no formulário, ao lado do primário, e **some durante a geração** — presente
ali seria lido como cancelar, e a geração não é cancelável.

---

## 2026-08-11 — A quantidade volta a ocupar uma coluna na planilha

**O que mudou:** no `Relatorio_Analise_Medição.xlsx`, cada quantidade ocupava **duas**
colunas — uma de texto, com a grafia do relatório, e uma numérica, para somar. Passou a
ocupar **uma**, numérica, com a grafia vindo do formato de exibição da célula.

**A pergunta que originou foi de quem usa:** *"por que o XLSX tem colunas duplicadas?"* — e
o Excel ainda marcava as de texto com o triângulo verde de *"número armazenado como texto"*.
A planilha parecia ter erro de montagem, e quem recebia não sabia qual coluna era a boa.

**`R-XLS-05` estava certa no argumento e errada na conclusão.** Ela dizia, com razão, que
*"uma coluna de texto que parece número é o defeito clássico de relatório em planilha"* — e
concluiu que seriam duas colunas. O que ela não considerou é que **o Excel guarda um número
e o exibe com outra grafia**: é para isso que serve o formato de célula. Texto e número não
são mutuamente exclusivos numa célula.

**O gabarito sempre teve uma coluna.** Ao medir o artefato de referência que a ESPEC 009
adotou como alvo de fidelidade, ele traz `Contratado`, `Medido` e `Saldo` uma vez cada, e
numéricas. A duplicação era acréscimo nosso — a mudança **aproxima** do gabarito, e a
intuição dizia o contrário antes de alguém abrir o arquivo.

**A grafia ficou idêntica ao relatório, e isso foi medido.** O formato `#,##0.##` reproduz
`Quantity.formatar()` porque o `#` omite dígito ausente: `4` sai `4`, e não `4,00`. Contra o
arranjo anterior o comparador acusava **141 células** divergentes — todos inteiros grafados
`4,00`. Depois, zero. Sobrou um caso teórico, `4,50` exibindo `4,5`, que não ocorre no piloto
e está declarado com teste próprio.

**A lição que atravessa a entrega é sobre índice.** Dos onze testes do arquivo, três
quebraram e oito sobreviveram — e a diferença não foi o que cada um garante, foi **como cada
um estava escrito**. Os que localizavam coluna por posição (`linha[5:8]`) quebraram; os que
localizavam por característica — tipo do dado, última coluna — passaram sem uma linha
alterada. O mesmo valia para o mapa de larguras, que era por letra e já errava antes desta
espec: dava 24 à coluna de marca numa aba e 13 noutra, onde o valor é `Sim — perfil ou
pacote`. Passou a ser por nome.

---

## 2026-08-11 — A coluna `Perfil ou pacote` sai do XLSX, e o que ela avisava some com ela

**O que mudou:** a aba `Sem Divergência` deixa de ter a coluna `Perfil ou pacote`. Suas
colunas passam a ser `Código`, `Descrição`, `Contratado`, `Medido` — exatamente as do
gabarito. `R-XLS-03` da ESPEC 009 foi revisada (§17.8).

**O gabarito decidiu.** A coluna era acréscimo nosso, como a duplicação de quantidades
que a ESPEC 013 já tinha removido pelo mesmo argumento. O artefato de referência não a
tem, e o critério de fidelidade do projeto é ele.

**O que se perde está medido, e é registrado aqui porque muda o que o documento afirma.**
Cinco das dezenove linhas conformes entram como `1/1` por `R-REC-04` — a planilha traz
`Perfil D` ou `PACOTE` onde os outros itens trazem número, e não há o que comparar. Uma
delas, `14.048.00008.00`, é o banco de dados **contratado no perfil D e medido no perfil
C**: perfis diferentes, listados como sem divergência. A aba passa a apresentá-los como
conformes sem nada que diga que aquela igualdade é convenção.

A ressalva continua na tela (`R-PAN-06`) e na resposta da API (`perfis_ou_pacotes`), que é
onde ela nasceu; `SituacaoDaAnalise.perfis_ou_pacotes` segue no domínio e testado. O que
saiu foi o portador no arquivo.

**A decisão é de quem recebe o arquivo, e foi tomada com o custo à vista.** O registro
existe para que reabrir o assunto não custe redescobrir o motivo. Um teste dedicado —
`test_t519_o_arquivo_nao_diz_nada_sobre_perfil_ou_pacote` — afirma a ausência **e** o
caso do perfil D/C, e é ele que cai no dia em que a marca voltar. A asserção de cabeçalho
é de **igualdade** com o gabarito, não de ausência da coluna: foi assim que a primeira
coluna nossa entrou sem ninguém notar.

**A `Sem previsão contratual` de `Itens Críticos` fica.** Mesmo status, decisão oposta —
ali a marca não desmente a classificação, reforça-a.

---

## 2026-08-11 — A vírgula pendurada: o instrumento errou junto com o código

**O que mudou:** a planilha de análise exibia `10,` onde o relatório grafa `10`. Os
formatos `#,##0.##` e `0.##` deram lugar a **quatro** códigos — `#,##0`, `#,##0.00`, `0`
e `0.00` —, escolhidos por célula. `R-NUM-06` foi revogada e `I-10` fechado de tabela.

**O truque de formatação não existia.** A ESPEC 013 escolheu `.##` com o raciocínio de
que `#` "omite o dígito ausente" e portanto faria a casa decimal sumir nos inteiros.
Omite o **dígito**; o separador é literal e fica. O defeito atingiu **52 das 56 linhas**
— exatamente a maioria que a escolha pretendia servir, enquanto a minoria decimal saía
certa. Um código de formato não sabe responder *"é redondo?"*: quem sabe é quem tem o
valor. Mover a condição para o renderizador custou quatro constantes e um `if`.

**Por que a suíte estava verde, que é a parte que importa.** A ESPEC 013 criou
`tests/grafia.py` justamente como o instrumento que percebe o que os testes de valor não
percebem — a célula guarda o número certo e **mostra** outra coisa. Ele implementou `.##`
fazendo `rstrip("0")` e, quando sobrava vazio, devolvia o inteiro **sem** a vírgula: a
mesma suposição do renderizador, escrita duas vezes. Instrumento que repete a hipótese do
objeto medido não mede — confirma. O comparador acusava zero divergências sobre um
arquivo com 52 linhas erradas.

**A correção traz uma asserção que não depende do instrumento:** nenhum formato do
arquivo contém `.#`. É estrutural, e vale mesmo se o comparador errar de novo. A ESPEC
013 §11 já dizia que abrir no Excel não era opcional *"porque formato de célula é
precisamente o que só o Excel mostra"* — a frase estava certa, e ainda assim a espec
confiou num truque de formatação. Quem achou o defeito foi a fase D.

---

## 2026-08-11 — A largura da tabela do anexo passa a ser do bloco, não da aba

**O que mudou:** cada tabela de anexo passa a ter as colunas que o seu próprio recorte
de linhas usa, e a linha sem conteúdo sai sem moldura. Oito das 37 tabelas encolhem, 58
colunas ao todo; 21 linhas em branco perdem a caixa vazia. Nenhuma linha nasce ou morre,
e o teste-âncora das páginas 2–3 não se moveu.

**A regra óbvia estava errada, e a medição foi quem disse.** "Aparar as colunas do fim
sem texto nem preenchimento" é o que qualquer um escreveria. O `openpyxl` deixa **vazias
as células cobertas por uma mesclagem** — o valor mora só na âncora —, então uma faixa de
título mesclada de ponta a ponta se lê como uma coluna com texto seguida de colunas
vazias. Essa regra apararia o cabeçalho de **8 dos 19 anexos**: `WIFI` iria de 4 colunas
para 1. E o defeito não sumiria de vista — a faixa continuaria lá, com um quarto da
largura, que é o tipo de coisa que atravessa a suíte inteira. A correção é contar a
cobertura da mesclagem como conteúdo, e ela entrou na espec **antes** do código.

**"Passa sem alteração" era previsão, não fato.** A ESPEC 014 §8 previa que
`test_docx_anexos` passaria inteiro. Três testes de largura quebraram, e por um motivo
que devia ter sido óbvio ao escrevê-los: eles mediam **todas** as tabelas de um anexo
contra a mesma largura total, e a largura por bloco é exatamente o que deixou de ser
uniforme. Dois ficaram mais fortes ao ser reescritos — a comparação passou a exigir que
as colunas de uma tabela aparada sejam um **prefixo** da medição do GRC, o que impede o
corte de virar redistribuição de largura.

**Duas causas, e só uma explicada pelo modelo.** A linha em branco emoldurada é fiel: a
aba **declara** borda nela e `R-ANX-06` manda copiar. Já a grade nas colunas sem
cabeçalho não é — o XML gerado já pedia `w:val="none"` naquelas células, e a grade
aparecia assim mesmo. Daí a forma da correção: **não criar a coluna**, em vez de pedir com
mais ênfase que a borda não seja desenhada. Coluna que não existe não depende de como o
Word resolve conflito de borda. A pergunta de por que aparecia continua aberta (`I-12`) e
não bloqueia — a única regra que ainda depende dela, `R-BRD-03`, não tem nenhum caso no
piloto e é coberta por teste construído.

---

## 2026-08-11 — O servidor deixa de ficar mudo enquanto trabalha

**O que mudou:** o trabalho pesado de `POST /reports` — extração, reconciliação e os
dois renderizadores — saiu do *event loop* para uma thread. Uma função extraída e um
`await`, em um arquivo. A resposta da API não mudou um byte, e os 16 testes que
afirmam a forma dela continuam verdes sem terem sido abertos.

**A ausência de *probes* era sintoma, não esquecimento.** Ao hospedar a aplicação no
Azure Container Apps, o backend ficou sem *readiness* e sem *liveness* enquanto o
frontend recebeu os dois. Não foi descuido: o endpoint era `async def` mas executava
~30 s de CPU dentro do *event loop*, e nesse período o processo não respondia mais
nada — nem o `/health`. Um *liveness* apontado para ele **mataria o container no meio
de um relatório**, e o sintoma para quem usa seria uma requisição que morre sem erro.

Medido em produção antes de corrigir: das seis sondas emitidas durante uma geração,
**duas não obtiveram resposta** em 5 s e uma levou 1,73 s, contra 0,13 s em repouso.
Depois: dez sondas, todas em ~0,15 s.

**A mudança de rumo é de método, não de código.** O critério de aceite foi escrito
**antes** da correção e exigiu-se que ele reprovasse — porque um teste de concorrência
que não sobrepõe de verdade fica verde contra o código quebrado, e ninguém percebe. O
registro do modo de falha (`folga de -0,00s`: a sonda atendida no mesmo instante do fim
da geração) virou o gabarito para julgar o verde que veio depois (`+26,33s`). Sem esse
registro, "o teste passou" não distinguiria correção de teste vazio.

**O que isto não faz: acelerar.** Threads devolvem responsividade, não vazão — o
trabalho é Python puro sob o GIL. Os 19 s de renderização do DOCX, dois terços do
tempo total, continuam onde estavam. A vazão vem de réplicas, com concorrência 1 por
réplica, e a serialização virou escolha explícita no código (`CapacityLimiter(1)`) em
vez de efeito colateral do defeito.

**Três suposições caíram no contato com o código**, e estão registradas em vez de
contornadas: a indicação de progresso que a espec pedia **já existia** desde a
ESPEC 008; o *timeout* de 180 s precisou virar configurável para caber no limite de
120 s por teste do Playwright, sem o que o caminho do estouro seria intestável; e o
*rollback* não é por revisão — os apps estão em `activeRevisionsMode: Single`, então
se volta republicando a *tag* anterior. Esta última valida a disciplina de nunca
sobrescrever *tag*, adotada por outro motivo.

---

## 2026-08-10 — As faixas do grid deixam de imitar o PDF

**O que mudou:** as faixas de grupo e de seção do grid saíram do navy e passaram a
`teal-700` `#0E3D47` e `teal-500` `#1B616D` — a paleta da própria aplicação. Três
classes trocadas num arquivo; nenhum token novo, nada no backend.

**A `R-UI-01` foi revisada, e essa é a mudança de rumo.** Ela dizia que as faixas
usam "o mesmo navy do relatório, para que a correspondência com o PDF seja
imediata". Ao medir, essa correspondência **não existia**: o DOCX pinta título,
cabeçalho e seção com um único `#222854`; a tela usava dois navies, `#0B2235` e
`#17416B`; os três são valores diferentes. A regra descrevia uma intenção que a
implementação nunca seguiu, e ninguém percebeu porque ninguém põe a tela e o
documento lado a lado medindo pixel.

**O que a repintura ensinou:** a pergunta que originou o incremento era sobre
matiz — "dá para ser verde?" — e matiz é a parte que não importa. O que faz a
faixa de seção ler como subordinada à de grupo é o **degrau de luminância** entre
as duas, 1,55× no navy e 1,68× agora. A regra nova (`R-COR-03`) fixa a faixa
numérica desse degrau em vez de fixar uma cor: qualquer repintura futura é
aceitável se cair dentro dela.

**Uma versão verde foi implementada, testada e revertida no mesmo dia.** Passava
em contraste e no `axe`. Caiu por duas razões: exigia dois tokens novos para um
problema que a paleta já resolvia, e verde saturado nesta tela já significa
"confere" — o selo da barra. Os tons precisavam ser dessaturados para não mentir,
e cor que precisa ser desfigurada para não mentir é a família errada.

**O custo assumido:** `teal-500` é a cor do botão "Baixar DOCX", que fica logo
acima do grid. Faixa não-clicável com o preenchimento do botão enfraquece a regra
"esta cor é clicável". Fica de pé porque a faixa é de canto reto, largura total e
sem `hover` (`R-COR-05`), e porque só um dos dois níveis coincide com o botão. Se
o grid ganhar linha clicável ou seção recolhível, revisitar.

**Onde:** [ESPEC 010](specs/010-cor-das-faixas-do-grid.md) ·
[ESPEC 002](specs/002-painel-de-divergencias.md) §13 ·
`frontend/src/app/components/DivergenciaGrid.tsx`

---

## 2026-08-10 — A aplicação passa a discordar do gabarito, e por escrito

**O que mudou:** cada item da competência passou a ser classificado em quatro
situações — crítico, divergente de maior relevância, divergente e sem divergência
— exibidas num painel acima do grid e num `Relatorio_Analise_Medição.xlsx` que
sai junto com o `.docx`.

**A mudança de rumo não é a funcionalidade. É `D-01`.** Existia um artefato de
referência, montado fora desta aplicação sobre o relatório modelo, com a estrutura
exata que se pediu. Ele declara **zero itens críticos**. E existe um item crítico:
o `14.049.00054.00`, medido 2 sem qualquer cobertura contratual.

Os dois estão certos, cada um no seu universo. O gabarito foi derivado das 55
linhas do relatório, e `R-REC-01` omite do relatório exatamente esse item. A
aplicação passou a analisar **56** — as 55 mais os medidos sem previsão
contratual —, e com isso afirma que existe um item crítico onde o gabarito afirma
que não há nenhum.

**Por que valeu discordar:** um relatório de análise cuja única categoria vazia é
justamente a que contém o achado mais grave inverte o próprio propósito. O `.docx`
não mudou uma linha — a omissão é do documento formal, que reproduz o modelo, e o
teste-âncora continua em 54 de 55.

**A decisão foi construída para ser revertida.** O universo mora numa função só, o
teste do invariante é parametrizado pelos dois universos desde o primeiro commit, e
a remoção do bloco no grid é uma tarefa isolada. Se o negócio responder "são 55"
(insumo `I-06`), o custo é um parâmetro.

**O que o portão P1 ensinou, e não estava previsto:** comparar com o gabarito
expôs que ele tem **menos precisão** que a aplicação — grava `117,29` onde a
planilha de medição traz `117,2889788312131` — e **descrição reescrita à mão**:
`ARMAZENAMENTO DE DADOS - NAS` contra a nossa, que vem do contrato e preserva até
o erro de digitação dele. Nenhuma das duas é divergência de classificação, e as
duas saíram do escopo da comparação com o motivo escrito.

**Onde:** [ESPEC 009](specs/009-analise-da-medicao.md) ·
[PLANO 009](plans/009-plano-analise-da-medicao.md) ·
[TASKS 009](tasks/009-tasks-analise-da-medicao.md) ·
[ESPEC 002](specs/002-painel-de-divergencias.md) §13

---

## 2026-08-07 — A interação passa a ser acessível, e o `title` sai do grid

**O que mudou:** a camada de interação — formulário, painel de resultado e grid —
ganhou conformidade WCAG 2.1 AA. Foco visível, região viva que anuncia, tabelas
com `scope` e nome, rolagem alcançável por teclado, e um token de cor escurecido.

**Por que não tinha:** não foi negligência. As ESPECs 005, 006 e 007 mediram
contraste, recusaram imagem por causa do leitor de tela e discutiram nome
acessível — mas todas tratavam da **marca**. O formulário e o grid vieram das
ESPECs 001 e 002, que trataram de domínio e de correspondência com o PDF. Onde
não houve espec, não houve régua.

**A `R-UI-04` foi revisada, e essa é a mudança de rumo.** Ela dizia "com
explicação **ao passar o cursor**" — instituía o `title` como mecanismo. Mas a
ressalva de perfil/pacote é justamente a que impede concluir "confere" quando o
perfil contratado não é o medido, e `title` não abre por teclado, não existe em
toque e é lido de forma inconsistente. A explicação virou **legenda visível**,
exibida uma vez para todas as linhas: informação idêntica em todas as linhas não
pertence à linha. Pendente do aceite registrado como `K-02`.

**O pior defeito da entrega foi introduzido por uma correção de acessibilidade.**
Os trechos `sr-only` acrescentados nas células da tabela são `position:
absolute`; sem ancestral posicionado eles escaparam do contêiner que rola e
levaram o `scrollWidth` da página de 390 para 845 px a 390 px de largura —
rolagem horizontal do documento no celular. Nenhum teste quebrava e o `axe` não
via, porque a marcação estava correta. Quem pegou foi a comparação de captura de
tela, pela largura da imagem.

**O que isso ensinou:** `axe` acusou **duas** regras sobre o código quebrado.
Não acusou `scope` ausente, tabela sem nome, região viva ausente nem foco
perdido ao desabilitar — nenhuma é marcação inválida. Ferramenta de
acessibilidade mede sintaxe; operabilidade continua exigindo teclado e fone.

**Onde:** [ESPEC 008](specs/008-acessibilidade-da-interacao.md) §14 ·
[ESPEC 002](specs/002-painel-de-divergencias.md) §12 · `frontend/src/`

---

## 2026-08-06 — As figuras das abas entram no documento

**O que mudou:** o gráfico de custos de `ServicosEmNuvem` e a figura de
`Internet` passaram a sair no `.docx`. Antes sumiam.

**Por que sumiam:** o leitor lia **células**, e uma figura não é célula. Ela fica
em `xl/media/` como arquivo próprio do pacote, ligada à aba por uma cadeia de
relações que guarda sobre qual linha ela flutua. Um leitor de células não tem
como vê-la — e não havia sintoma: nenhum teste falhava, e a página saía completa
menos o gráfico.

**Por que não pelo openpyxl:** ele expõe as figuras em `ws._images`, mas obter os
bytes passa por Pillow, que não é dependência deste projeto. Pedir uma
biblioteca de imagem para copiar bytes de dentro de um ZIP seria caro pelo
motivo errado. O `figuras.py` percorre as relações do pacote direto.

**O tamanho vem do GRC.** O PNG de `ServicosEmNuvem` tem 1.238 pixels de
largura, que a 96 dpi dariam 928 pt — mais que o dobro da página. O GRC o
imprime com 516 pt. A âncora de duas células, que é a destas duas figuras, não
declara extensão; reconstruí-la exigiria somar largura de coluna e altura de
linha em EMU, célula a célula. A medida impressa resolve sem isso.

**Onde a figura entra:** em `Internet` ela está ancorada na linha 15 de uma aba
de 13 — vai para o fim, que é onde está. Em `ServicosEmNuvem` ela se apoia na
linha 6, sobre a faixa vazia que vai até a 18: essas linhas existem para abrir
espaço, e a figura **toma o lugar delas**. Emiti-las junto deixaria um vão em
branco de 6 cm e empurraria o gráfico para depois das 29 linhas que ele resume.

**Onde:** [ESPEC 004](specs/004-anexos-de-detalhamento.md) `R-ANX-13` ·
`infrastructure/measurement/figuras.py`

---

## 2026-08-06 — Os anexos passam a ter a geometria do GRC

**O que mudou:** largura de coluna e altura de linha dos anexos deixaram de ser
derivadas da planilha e passaram a ser **extraídas do PDF de referência**, pelo
`scripts/medir_anexos_grc.py`. Dezessete dos dezenove têm fronteira de coluna
legível e usam a medida direta; nos outros dois a proporção da planilha é
esticada até a largura total medida, que é inequívoca.

**Por quê:** as colunas da planilha são medidas em caracteres, e a razão entre
elas não é a razão entre as larguras impressas. Proporcionalizar aproximava; a
medição reproduz.

**O defeito que a medição encontrou:** três anexos saíam com colunas que o GRC
não imprime — `Usuários` com **15 em vez de 8**, e mais duas abas com uma a
mais. São colunas sem texto e sem preenchimento, que só existem por um resquício
de formatação; o `max_column` do openpyxl as conta e o Excel não as imprime. Em
`Usuários` isso espremia as oito reais em pouco mais da metade da página.

Descobrir a regra certa exigiu medir de novo: as sete colunas sobrando **têm
borda**, numa única linha — a 1021, uma faixa mesclada e vazia no rodapé da aba.
Usar a borda como sinal de conteúdo as manteria todas.

**O que custou:** as margens laterais dos anexos foram de 1,4 para 1,2 cm. Três
anexos têm tabela mais larga que a área útil anterior, por 0,6 a 1,4 mm.
Encolher a tabela para caber seria trocar a fidelidade — que é o critério de
aceite do projeto — por uma margem redonda.

**A altura é mínimo, não valor exato.** O Word quebra linha onde o Excel não
quebrava; altura exata cortaria o texto excedente. Num documento que instrui
faturamento, a linha crescer é melhor que o dado sumir.

**O que não mudou:** o teste-âncora segue em 54 de 55 linhas. A tabela de
comprovação conserva as margens de 1,4 cm — as novas valem só para os anexos.

**Onde:** [ESPEC 004](specs/004-anexos-de-detalhamento.md) `R-ANX-12` ·
`scripts/medir_anexos_grc.py` · `infrastructure/annex/medidas_grc.json`

---

## 2026-08-06 — Os 19 anexos de detalhamento entram no documento

**O que mudou:** o `.docx` passou de 3 para cerca de 41 páginas. Depois da tabela
de comprovação vêm os 19 anexos que sustentam as quantidades medidas, cada um
numa seção própria, na orientação que o GRC usa — 14 em retrato, 5 em paisagem.

**Por quê:** o documento afirmava que 1.012 usuários acessaram a rede sem dizer
quais. Conferir uma quantidade exigia voltar à planilha de 22 abas.

**A medição que mudou o desenho:** o que o GRC mostra é **a aba impressa**.
Título, resumo, subtítulos, mesclagens e cores são linhas e formatação da própria
planilha. O renderizador não precisa saber o que é título e o que é dado — ele
despeja a aba preservando a forma, e a apresentação aparece por consequência. Por
isso a configuração de cada anexo tem quatro campos, e um anexo novo é uma
entrada de JSON.

**Uma restrição do Word que virou desenho:** a repetição de cabeçalho entre
páginas (`R-ANX-11`) só vale nas primeiras fileiras de uma tabela. Em `Usuários`
o cabeçalho é a 8ª linha da aba, e marcá-lo no meio de uma tabela única não
produziria efeito nenhum — o teste passaria e o documento sairia errado. Cada
anexo com preâmbulo é renderizado em **duas tabelas**, e a segunda começa no
cabeçalho.

**Dados pessoais, estratégia trocada:** as abas `Usuários` e `Office365` eram
removidas da fixture. Com os anexos elas viraram dois dos dezenove — e logo os
dois mais difíceis —, então passaram a ficar **com dados sintéticos**: mesma
estrutura, mesma contagem, nomes e logins gerados. Removê-las teria deixado sem
teste exatamente o que pode quebrar.

**O que quase matou o incremento:** `Table.cell(i, j)` e `linha.cells` remontam a
grade inteira da tabela a cada acesso. Com 15 mil células em `Usuários` e 698
mesclagens em `Office365`, a primeira versão levava **cinco minutos** e a suíte
não terminava. Resolver a grade uma vez por tabela levou a geração para 36 s.

**O que não mudou:** a capa, a tabela de comprovação e a tela. O teste-âncora
segue em 54 de 55 linhas, sem uma linha alterada, e `api/` e `frontend/` não
foram tocados (ESPEC 004 §3.4).

**Correção de passagem:** a linha de resumo da ESPEC 004 §3 dizia "13 retrato, 6
paisagem". A tabela por anexo da própria spec, medida no GRC, sempre disse 14 e
5 — o resumo é que estava errado, e a medição o corrigiu.

**Onde:** [ESPEC 004](specs/004-anexos-de-detalhamento.md) ·
[PLANO 004](plans/004-plano-anexos-de-detalhamento.md) ·
[TASKS 004](tasks/004-tasks-anexos-de-detalhamento.md)

---

## 2026-08-06 — O relatório passa a ser DOCX

**O que mudou:** o entregável deixou de ser um PDF montado do zero e passou a ser
um `.docx` gerado a partir do modelo institucional da PRODAM — capa, papel
timbrado, fontes embutidas. Três páginas: a capa em retrato, e a tabela em
paisagem sobre o timbrado. O ReportLab saiu do projeto.

**Por quê:** o PDF reproduzia a tabela mas não carregava a identidade visual, e
um documento gerado por código não é editável — um documento que instrui
faturamento passa por revisão.

**Como, sem perder a rede:** trocar o renderizador é substituir justamente o
componente que o teste-âncora protege. A ordem foi: primeiro a rede passou a
aceitar os dois formatos, depois o DOCX nasceu e foi provado, e só então o PDF
saiu. Em nenhum momento houve janela sem garantia de fidelidade.

**O que a arquitetura entregou:** a diferença em `domain/`, `application/` e
`infrastructure/validations/` ao longo de todo o incremento foi **um
comentário**. O port `IReportRenderer` sustentou a troca inteira — foi uma
substituição de adaptador, como o plano apostava.

**O que a conferência visual pegou, e nenhum teste pegaria:** página em branco
herdada do modelo, coluna cortada pela margem interna das células, timbrado
ancorado à direita, faixa navy cobrindo linha demais e borda faltando no bloco
de título. Cinco defeitos, todos com as 55 linhas corretas. O insumo `J-02` do
plano existia exatamente para isso.

**Onde:** [ESPEC 003](specs/003-relatorio-em-docx.md) ·
[PLANO 003](plans/003-plano-relatorio-em-docx.md) ·
[TASKS 003](tasks/003-tasks-relatorio-em-docx.md)

---

## 2026-08-05 — Grid de divergências na tela

**O que mudou:** após gerar o relatório, a tela exibe um grid com a mesma estrutura do relatório —
faixas de seção e as cinco colunas — contendo **apenas os itens em que a quantidade contratada
difere da medida**. No piloto: 36 de 55 itens, em 16 das 22 seções.

`POST /reports` passou a devolver JSON com as linhas e o PDF em base64, no lugar do PDF binário.

**Por quê:** o PDF responde "quanto foi contratado e medido"; não responde "onde não bateu". Essa
leitura estava sendo feita percorrendo 55 linhas com o olho — o mesmo trabalho manual que o MVP
eliminou na montagem da tabela, sobrevivendo na etapa seguinte.

**O achado que apareceu:** ao implementar `R-DIV-05` descobri que `14.049.00054.00` não tem apenas
quantidade contratada zero — ele **não consta do contrato**. Foi medido 2 sem qualquer cobertura
contratual, e o relatório modelo o esconde por construção. O grid o exibe em bloco separado.

**O que não mudou:** o PDF. O teste-âncora continua em 54 de 55 linhas idênticas ao modelo — é a
garantia de que o entregável formal ficou intacto.

**Rótulo do bloco:** *"não constam no Contrato"*, e não *"não constam do PDF"*. O que importa a
quem confere é a ausência no contrato, não em qual documento o item deixou de aparecer.

**Desvio de processo:** a ESPEC 002 foi implementada **sem backlog prévio**, ao contrário da
ESPEC 001. O [TASKS 002](tasks/002-tasks-grid-divergencias.md) foi escrito depois, registrando o
que foi feito — e as duas correções de rumo que a implementação exigiu.

**Onde:** [ESPEC 002](specs/002-painel-de-divergencias.md) · [TASKS 002](tasks/002-tasks-grid-divergencias.md)

---

## 2026-08-05 — Catálogo embutido na aplicação

**O que mudou:** a tela pedia três arquivos e passou a pedir dois. O catálogo — que define seções,
ordem e apresentação — deixou de ser enviado e passou a acompanhar o código, em
`backend/src/infrastructure/catalog/catalogo_padrao.json`.

**Por quê:** o terceiro campo pedia um arquivo que o usuário não tem e não sabe o que é. O problema
apareceu quando o solicitante testou a aplicação pela primeira vez.

**A razão de fundo:** o catálogo **não participa da comparação**. Quantidade contratada vem do
contrato, medida vem da planilha; o catálogo governa apenas a apresentação. Como o objetivo
declarado é reproduzir o relatório de comprovação atual, essa apresentação é conhecida de antemão e
não muda entre competências.

Verificado nos dados antes de decidir: todo código do relatório existe no contrato **e** na
planilha; a interseção é de 57 códigos, o relatório mostra 54, e os 3 de fora são exatamente a
Seção A.

**O que não mudou:** a API ainda aceita um catálogo por upload, como campo opcional, para um
contrato com apresentação diferente da do piloto. Saiu da tela, não do produto.

**Onde:** ESPEC 001 §3.1, §4.3 e Anexo B (revisão 14) · TASKS 001 T-67

---

## 2026-08-05 — Formatação numérica por item

**O que mudou:** `R-MED-04` deixou de ser uma regra global de formatação e passou a ser um atributo
de cada item, na coluna `formato_quantidade` do catálogo.

**Por quê:** a regra original — sempre pt-BR com separador de milhar — está **errada**. O relatório
modelo grafa `1500` e `4.000` na mesma página, e uma regra única produziria `1.500`, reprovando o
teste-âncora.

**Onde:** ESPEC 001 `R-MED-04` e Anexo B (revisão 15) · PLANO 001 D-02 e §10

---

## 2026-08-05 — Descrições vêm do catálogo, não do contrato

**O que mudou:** a semente do catálogo passou a preencher `descricao_exibicao` em todas as linhas
visíveis, e não apenas numa.

**Por quê:** o teste-âncora revelou que as descrições do modelo divergem **sistematicamente** das do
contrato, em caixa, pontuação e tipo de travessão — `PERFIL OFFICE365 - EXECUTIVE 1 (E1)` contra
`PERFIL OFFICE 365 – EXECUTIVE E1`. A redação editorial pertence ao catálogo.

`R-CTR-03` segue valendo: sem sobrescrita, prevalece a descrição do contrato — o que atende um
contrato novo, sem relatório modelo de origem.

**Onde:** `scripts/seed_catalog.py`

---

## 2026-08-05 — Checksum pela soma dos totais declarados

**O que mudou:** a validação `V-CTR-03` soma os **totais declarados linha a linha**, em vez de
recalcular `preço × quantidade × meses` como previa o PLANO D-03.

**Por quê:** a fórmula do total **varia por item**. Em `HORA/HOMEM` a quantidade já é o total do
período e os meses não multiplicam; em serviços mensais, multiplicam. Somar o que o documento
afirma dispensa interpretar a regra de preço — que está fora do escopo — e prova igualmente que
nenhuma linha se perdeu.

**Onde:** PLANO 001 D-03 e §13

---

## 2026-08-05 — Extração pela grade desenhada no PDF

**O que mudou:** o extrator do contrato usa as bordas da tabela — retângulos de 0,7 pt — para
reconstruir as células, em vez da extração por coordenada de palavra prevista na ESPEC §9.4. A
conferência cruzada com `extract_tables()` (T-20) ficou superada.

**Por quê:** a grade já está desenhada no PDF; usá-la faz a descrição multilinha cair naturalmente
numa única célula, sem heurística de continuação. E o checksum é prova mais forte que comparar
contra uma estratégia que sabidamente perde duas linhas.

**Resultado:** 60 de 60 linhas, checksum exato em `BRL 10.637.425,00`.

**Onde:** ESPEC 001 §9.4 (marcada como resolvida) · TASKS 001 T-20
