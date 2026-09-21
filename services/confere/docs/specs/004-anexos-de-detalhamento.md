# ESPEC 004 — Anexos de Detalhamento no DOCX

| | |
|---|---|
| **Status** | **Implementada** |
| **Versão** | 1.6 — 2026-08-06 |
| **Depende de** | [ESPEC 003](003-relatorio-em-docx.md) — implementada |
| **Referência de apresentação** | Páginas 4 a 41 do relatório GRC |
| **Fonte dos dados** | 19 abas da planilha de levantamento |

---

## 1. Problema

O documento gerado tem três páginas: a capa e a tabela de comprovação. O relatório
GRC tem **41** — as outras 38 são os **anexos de detalhamento**, que mostram de onde
cada quantidade medida veio.

Sem eles, o documento afirma que 1.012 usuários acessaram a rede, mas não diz quais.
A conferência de uma quantidade depende de poder abrir o detalhamento por trás dela,
e hoje isso exige voltar à planilha de 22 abas.

---

## 2. Objetivo

Acrescentar ao documento os **19 anexos**, cada um começando numa página nova, na
ordem definida, **reproduzindo a apresentação do GRC** — inclusive a orientação de
página, que alterna entre retrato e paisagem conforme o anexo.

A capa e a tabela de comprovação **não mudam**. Os anexos vêm depois.

---

## 3. O mapeamento, medido no GRC

Cada linha desta tabela foi extraída do documento de referência e da planilha, não
estimada.

| # | Aba | Páginas GRC | Orientação | Linhas | Colunas | Corpo | Título |
|---:|---|---:|---|---:|---:|---:|:---:|
| 1 | `Detalhes` | 4 | retrato | 54 | 16 | 4,8 | — |
| 2 | `DetalhesSemDesenv` | 5 | retrato | 41 | 16 | 4,6 | — |
| 3 | `Servidores` | 6 | retrato | 84 | 15 | 4,3 | sim |
| 4 | `ServidoresSemDesenv` | 7 | retrato | 63 | 15 | 4,4 | sim |
| 5 | `BD` | 8 | retrato | 24 | 7 | 6,7 | sim |
| 6 | **`Usuários`** | **9–24** | paisagem | **1.021** | 15 | 5,6 | sim |
| 7 | `NAS` | 25 | retrato | 42 | 7 | 6,4 | sim |
| 8 | `Central de Servicos` | 26 | retrato | 7 | 3 | 11,0 | sim |
| 9 | `Colocation` | 27 | retrato | 10 | 3 | 11,0 | sim |
| 10 | `Comunicação Dados` | 28 | paisagem | 13 | **22** | **3,5** | sim |
| 11 | `SDWAN` | 29 | paisagem | 11 | 19 | 4,1 | sim |
| 12 | `WIFI` | 30 | paisagem | 31 | 10 | 5,8 | sim |
| 13 | `CertificadosDigitais` | 31 | retrato | 13 | 4 | 11,0 | sim |
| 14 | `Internet` | 32 | retrato | 13 | 3 | 11,0 | sim |
| 15 | `SOA` | 33–34 | retrato | 56 | 5 | 11,0 | sim |
| 16 | `OutrosServicos` | 35 | retrato | 12 | 3 | 11,0 | sim |
| 17 | **`Office365`** | **36–39** | paisagem | **363** | 16 | 4,0 | sim |
| 18 | `ServicosVcloud` | 40 | retrato | 42 | 7 | 8,9 | sim |
| 19 | `ServicosEmNuvem` | 41 | retrato | 47 | 3 | 10,2 | sim |

**14 anexos em retrato, 5 em paisagem. 38 páginas.**

### 3.1 A estrutura e a formatação já estão na aba

Medição decisiva, feita antes de escrever as regras: **o que o GRC mostra é a aba
impressa**. Cada anexo tem título, bloco-resumo, subtítulo e cabeçalho de colunas —
e todos são **linhas da própria planilha**, em células mescladas.

O anexo `Usuários` no GRC começa assim:

```
USUÁRIOS SMIT SUSTENTAÇÃO                    ← linha 1 da aba, mesclada A1:C1
Descrição | Qtde                             ← linha 2
Login(s) de Acesso a Rede (Usuários) | 1012  ← linha 3
                                             ← linhas 4-6 vazias
USUÁRIOS DE REDE - SMIT                      ← linha 7, mesclada A7:H7
Nº | Secretaria | Login | Nome | ...         ← linha 8, cabeçalho
1 | SMIT | x062020 | ...                     ← dados
```

**As cores também vêm da planilha.** Os preenchimentos medidos no PDF — `A52A2A`,
`6A5ACD`, `0000FF` — são exatamente os das células. O mesmo vale para o negrito.

**Consequência de projeto:** o renderizador não precisa saber o que é título, o que é
resumo e o que é dado. Ele despeja a aba preservando valores, mesclagens,
preenchimentos e negrito — e a apresentação do GRC aparece por consequência. Um anexo
novo não exige código nem configuração de estrutura.

### 3.2 O que **não** vem da aba

Duas coisas, e as duas vêm da impressão:

**A orientação.** Todas as abas medidas declaram `portrait` na configuração de
impressão, mas o GRC mostra `Usuários`, `Comunicação Dados`, `SDWAN`, `WIFI` e
`Office365` em paisagem. A orientação do GRC é a que vale, e está na tabela de §3.

**O corpo de fonte.** Na planilha ele é uniforme — 10 ou 11 pt em todas as abas. A
variação de 3,5 a 11 pt no PDF é **escala de impressão**: o `NAS` está declarado a
64%, e 10 pt × 0,64 dá exatamente os 6,4 pt medidos. Um DOCX não escala página, então
o tamanho efetivo passa a ser declarado por anexo.

São essas duas — e só essas — que justificam uma configuração por anexo.

### 3.3 Duas leituras que o mapeamento resolve

**"Uma aba por página" é uma aba por *início* de página** — confirmado pelo
solicitante e pela medição. `Usuários` ocupa 16 páginas no GRC, `Office365` ocupa 4 e
`SOA`, 2. O que a regra fixa é que nenhum anexo começa no meio da página de outro.

**Dois anexos não têm faixa de título.** `Detalhes` e `DetalhesSemDesenv` começam
direto no cabeçalho de colunas — e isso também vem da aba, sem precisar ser
declarado.

### 3.4 Os anexos ficam fora da tela

A tela responde *"onde contratado e medido não bateram"* — 36 de 55 itens. Os anexos
respondem outra coisa: *"de onde veio a quantidade medida"*.

**Levá-los para a tela seria pagar o custo sem o benefício.** São 25 mil células: a
resposta da API cresceria em megabytes, o navegador teria de desenhar 25 mil
elementos, e ninguém rola 1.021 linhas de usuários procurando alguma coisa.

O que teria valor é outra funcionalidade: **clicar num item divergente e ver o
detalhamento por trás dele** — `14.023.00002.00` mostra 1.500 contratados e 1.012
medidos; clicar abriria as 1.012 linhas da aba `Usuários` que sustentam esse número.

Isso é um incremento próprio, e depende de um insumo que hoje não existe: **o
mapeamento entre item de serviço e anexo**. A planilha não o traz — a aba `Usuários`
não declara que corresponde ao item `14.023.00002.00`. Alguém precisaria relacionar
os 55 itens aos 19 anexos, e isso é decisão de negócio, não dedução. Fica registrado
em §12.

---

## 4. Regras

| ID | Regra |
|---|---|
| `R-ANX-01` | Os anexos vêm **depois** da tabela de comprovação. A capa e as páginas atuais não mudam |
| `R-ANX-02` | Cada anexo **começa em página nova**, na ordem de §3. Um anexo ocupa quantas páginas seu conteúdo exigir |
| `R-ANX-03` | A orientação de cada anexo é a que o GRC usa — §3. O documento passa a ter cerca de 20 seções |
| `R-ANX-04` | O corpo de fonte é o medido no GRC, declarado por anexo |
| `R-ANX-12` | A **largura de cada coluna** e a **altura de linha** também são as do GRC, extraídas do PDF de referência. Onde a medição for ambígua, vale a proporção da planilha esticada até a largura total medida. A altura é mínimo, não valor exato — ver §4.3 |
| `R-ANX-05` | O conteúdo vem **integralmente** da aba: todas as linhas e todas as colunas, sem filtro e sem interpretação. Título, resumo e subtítulos são linhas da planilha, e aparecem por consequência (§3.1) |
| `R-ANX-13` | As **figuras coladas na aba** também entram, no tamanho com que o GRC as imprime. Uma figura ancorada sobre linhas vazias ocupa o lugar delas — é o espaço que a planilha abriu para ela |
| `R-ANX-06` | São preservados da aba: **valores, mesclagens de célula, preenchimento, negrito, cor da fonte, bordas e alinhamento horizontal**. É o que reproduz a apresentação do GRC sem declarar nada por anexo. *Cor da fonte e bordas entraram na implementação: os cabeçalhos têm texto branco sobre `A52A2A` e sairiam ilegíveis, e as linhas de respiro entre blocos não têm grade — desenhá-la criaria caixas vazias que o GRC não mostra. Alinhamento horizontal entrou pela ESPEC 052: a implementação original nunca lia o alinhamento da célula, e todo anexo saía com texto e número alinhados à esquerda, mesmo onde a aba declarava centro ou direita* |
| `R-ANX-07` | Células vazias saem vazias. Valores numéricos e datas usam a formatação da planilha |
| `R-ANX-08` | As abas `Capa`, `Levantamento` e `Comunicação Dados Histórico` **não entram**: a primeira é decorativa, a segunda já é a tabela de comprovação, a terceira está vazia |
| `R-ANX-09` | O teste-âncora sobre as páginas 2–3 **continua valendo sem alteração**. Os anexos não podem deslocar nem alterar a tabela de comprovação |
| `R-ANX-10` | Nenhum teste do repositório depende de dado pessoal real — ver §5 |
| `R-ANX-11` | A linha de cabeçalho de colunas **se repete no topo de cada página** do anexo. É a única divergência deliberada em relação ao GRC — ver §4.2. **Qual é essa linha passou a ser decidido pelos rótulos declarados em `anexos.json`, e não pelo número da linha** — [ESPEC 037](037-a-linha-de-dados-que-virou-cabecalho.md) `R-CAB-01`. **Uma aba pode ter mais de um cabeçalho, um por tabela empilhada** — [ESPEC 051](051-o-cabecalho-que-ficou-pequeno-para-a-tabela.md) `R-SEG-01` |

### 4.1 A configuração dos anexos

Cada anexo declara **nome da aba, ordem, orientação, corpo de fonte e qual linha é o
cabeçalho a repetir** — o que não está na planilha (§3.2) mais a escolha de §4.2. Todo
o resto vem da aba.

É o mesmo tipo de informação que o projeto já mantém fora do código, no catálogo
padrão.

Segue o mesmo padrão: um **JSON versionado** ao lado do código, em
`backend/src/infrastructure/report/anexos.json`. Diffável na revisão, e um anexo
novo não exige alterar o renderizador.

### 4.2 A única divergência deliberada em relação ao GRC

O GRC **não** repete o cabeçalho de colunas: verificado nas páginas 10, 11 e 24 de
`Usuários`, que começam direto em linha de dados. Quem confere a página 18 vê oito
colunas de datas sem saber qual é qual, e precisa voltar à página 9.

`R-ANX-11` repete. **O critério de fidelidade do projeto existe para proteger os
números** — é o que o teste-âncora guarda nas páginas 2 e 3. Aqui nenhum dado muda; o
que muda é que as mesmas 1.021 linhas passam a ser conferíveis sem folhear.

No DOCX isso é o atributo `w:tblHeader` na linha de cabeçalho — não é código novo, e
o Word cuida da repetição ao paginar.

**Qual linha é o cabeçalho** varia por anexo: em `Usuários` é a 8ª da aba, em `NAS` é
a 7ª, porque antes dela vêm título, resumo e subtítulo (§3.1). O número da linha entra
na configuração, ao lado da orientação e do corpo de fonte.

> **A última frase deixou de valer — [ESPEC 037](037-a-linha-de-dados-que-virou-cabecalho.md).**
> Orientação e corpo descrevem como o GRC **imprime** a aba, e não variam entre planilhas.
> O número da linha descreve **um arquivo**: ele depende de quantos blocos de resumo aquele
> órgão tem antes do cabeçalho. Pôr os três lado a lado foi uma troca de categoria, e o
> preço apareceu no PGM — cinco anexos marcando uma linha de dados como cabeçalho — e num
> terceiro contrato, onde a 17ª linha de `Office365` era o **4º usuário**, repetido no topo
> de cada página. O parágrafo acima chega perto de dizer isso: se o cabeçalho está na 8ª
> **porque** há três coisas antes dele, então o que o identifica é o que ele é, e o número é
> só onde ele calhou de estar naquela planilha. Hoje cada anexo declara `cabecalho` — os
> primeiros rótulos da fileira —, e `linha_cabecalho` fica como a medição do GRC e oráculo
> da `R-CAB-06`.

Fica reversível: um anexo que não deva repetir declara isso no `anexos.json` — hoje, com
uma âncora vazia (`R-CAB-04`).

> **Um anexo pode ter mais de um cabeçalho — [ESPEC 051](051-o-cabecalho-que-ficou-pequeno-para-a-tabela.md).**
> `Servidores` e `ServidoresSemDesenv` têm uma segunda tabela, de forma diferente, empilhada
> na mesma aba: um resumo de 11 colunas seguido, mais adiante, de um detalhe por servidor de
> 15. A âncora primária só reconhecia a primeira; a fileira que o Word repetia a cada página
> saía com as 4 colunas do detalhe em branco. `cabecalhos_adicionais`, em `anexos.json`,
> declara âncoras extras — cada uma vira o seu próprio corte, com a sua própria marca de
> repetição, resolvida pela mesma `R-CAB-01`/`R-CAB-03`.

---

## 5. Dados pessoais

**É o ponto que mais afeta o desenho, e precisa estar visível.**

| Aba | Registros | Conteúdo |
|---|---:|---|
| `Usuários` | 1.021 | login, nome completo, datas de acesso |
| `Office365` | 363 | nome completo, login, e-mail institucional |

O relatório GRC **já publica esses dados** — são as páginas 9–24 e 36–39 do documento
que hoje circula. Reproduzi-los no DOCX não amplia exposição: é o mesmo conteúdo, no
mesmo documento, para os mesmos destinatários.

O que muda é a **estratégia de teste**. A fixture do repositório é sanitizada
justamente por remover essas duas abas (`PLANO 001` D-04), e o hook de pré-commit
bloqueia o commit da planilha íntegra. Com os anexos, a fixture sanitizada deixa de
cobrir dois dos dezenove.

**Decisão:** a fixture passa a trazer as duas abas com **dados sintéticos** — mesma
estrutura, mesma contagem de linhas e colunas, nomes e logins gerados. Os testes
verificam forma, contagem e paginação, que é o que precisam verificar; nenhum dado
pessoal entra no repositório.

`R-ANX-10` — Nenhum teste do repositório depende de dado pessoal real. A geração da
fixture sintética é reproduzível por script, ao lado de `sanitize_fixture.py`.

---

## 6. Desempenho — medido, não estimado

Emitir célula a célula com formatação direta tem custo, e o volume aqui é outro:

| Volume | Tempo de montagem |
|---|---:|
| 1.500 células (100 × 15) | 1,2 s |
| 15.315 células (`Usuários`) | **12,8 s** |

Os 19 anexos somam cerca de **25 mil células**, o que projeta **20 a 25 segundos**
por requisição. Hoje o documento sai em cerca de 3 s.

**Consequência:** uma requisição síncrona de 25 s é ruim numa tela — o usuário fica
sem resposta e navegadores e proxies costumam ter tempo limite abaixo disso.

Três saídas, na ordem em que eu tentaria:

1. **Aceitar.** A operação é mensal, e a tela pode exibir progresso. Custo zero de
   engenharia, e é a escolha certa se 25 s for tolerável para quem usa.
2. **Emitir o XML das tabelas grandes diretamente**, em vez de célula a célula pelo
   `python-docx`. O gargalo é a criação de objetos por célula; montar o XML da tabela
   como texto é uma ordem de grandeza mais rápido. Contido, mas é código novo.
3. **Tornar a geração assíncrona**, com identificador e busca posterior. Resolve de
   vez e **traz estado de volta** — contraria a ESPEC 001 §7.2 e é o último recurso.

A spec assume a opção 1 e registra a 2 como saída, se a medição no uso real
incomodar. Ver §9 e o ponto em aberto nº 2.

---

## 7. Onde o código muda

| Camada | Mudança |
|---|---|
| `domain/` | Uma entidade `Anexo` — nome, orientação, corpo de fonte, cabeçalho e linhas |
| `application/` | O caso de uso passa a montar os anexos junto com o relatório |
| `infrastructure/measurement/` | Um leitor genérico de aba: lê qualquer aba inteira, sem conhecer seu conteúdo |
| `infrastructure/report/` | `anexos.json`; o renderizador ganha uma seção por anexo |
| `api/` · `frontend/` | **Nenhuma.** O documento continua saindo em `docx_base64`, e a tela não muda (§3.4) |

O leitor genérico é a peça nova mais importante: as 19 abas têm de 3 a 22 colunas e
nenhuma semântica em comum. Ele lê **forma**, não significado — e é por isso que um
anexo novo não exige código.

---

## 8. Testes

| Nível | Cobertura |
|---|---|
| Leitor de aba | Devolve todas as linhas e colunas, com mesclagens, preenchimentos e negrito, preservando vazios |
| Configuração | As 19 entradas, na ordem, com a orientação e o corpo do GRC |
| Estrutura | O documento tem ~20 seções, com a orientação de cada anexo |
| Formatação | Mesclagens, preenchimentos e negrito da aba chegam ao documento (`R-ANX-06`) |
| Paginação | A linha de cabeçalho traz `w:tblHeader` e se repete a cada página (`R-ANX-11`) |
| Volume | `Usuários` produz 1.021 linhas de dados no documento |
| **Regressão** | **O teste-âncora continua em 54 de 55 linhas** — os anexos não tocam a tabela de comprovação (`R-ANX-09`) |
| Dados pessoais | Nenhuma fixture do repositório contém nome, login ou e-mail reais |

O teste-âncora é de novo a rede: este incremento acrescenta páginas depois da
tabela, e se ele quebrar é porque algo foi deslocado.

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| **Tempo de geração de ~25 s** | §6. Medido, com duas saídas conhecidas. É o risco de maior probabilidade |
| Tabelas de 22 colunas ficarem ilegíveis | O corpo de 3,5 pt é o que o GRC usa. Ilegível ou não, é o documento que circula hoje |
| Dado pessoal entrar no repositório por descuido | Fixture sintética (`R-ANX-10`) e o hook de pré-commit, que já bloqueia a planilha íntegra |
| Uma aba mudar de forma entre competências | O leitor é genérico: lê o que houver. Mudança de coluna aparece no documento, não em erro |
| O documento crescer demais | 38 páginas de tabela em XML comprimido acrescentam pouco ao pacote de 3,3 MB, quase todo do modelo. A resposta em base64 cresce junto |
| Anexo com aba vazia | `Comunicação Dados Histórico` já mostra que existem. Anexo sem linha deve sair com o título e a observação, não quebrar. **Revisto pela [ESPEC 036](036-a-pagina-que-so-diz-que-nao-tem-nada.md):** o fim continua valendo — a geração não cai —, mas o meio mudou. O anexo sem conteúdo é **omitido**, e a `V-ANX-01` avisa quando nenhuma aba é reconhecida |

---

## 10. Pontos em aberto

| # | Questão | Situação |
|---|---|---|
| 1 | "Uma aba por página" significa começar em página nova | ✅ **Confirmado** pelo solicitante e pela medição |
| 2 | 25 s por requisição é tolerável | ✅ **Confirmado.** A otimização de §6 fica fora do escopo, registrada como saída se o uso real incomodar |
| 3 | Os anexos devem aparecer no grid da tela | ✅ **Confirmado: só no documento.** A tela segue respondendo "onde não bateu"; o detalhamento fica no `.docx` — ver §3.4 |
| 4 | Repetir o cabeçalho de colunas a cada página | ✅ **Confirmado: repetir.** É a única divergência deliberada em relação ao GRC, justificada em §4.2 |

---

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Leitor genérico de aba — valores, mesclagens, preenchimentos e negrito | M |
| B | `anexos.json` com as 19 entradas medidas | P |
| C | Fixture sintética para `Usuários` e `Office365` | M |
| D | Renderização: uma seção por anexo, com orientação e corpo variáveis | G |
| E | Mesclagens, cabeçalho repetido e comportamento de aba vazia | M |
| F | Testes de volume e regressão do âncora | M |

**Total: 3 a 5 dias.** A otimização de desempenho ficou **fora do escopo** — 25 s foi
confirmado como tolerável.

---

## 12. Evolução prevista

**Detalhamento sob demanda na tela.** Clicar num item divergente e ver as linhas do
anexo que sustentam a quantidade medida — ver §3.4.

O insumo que falta é o **mapeamento entre item de serviço e anexo**: qual das 19 abas
detalha cada um dos 55 itens. Não está na planilha e não é dedutível; precisa vir do
negócio. Com ele, o incremento é pequeno, porque os dados já estarão sendo lidos.

O que sustenta a estimativa é que **nada disso é novo em natureza**: o projeto já lê
planilha, já emite tabela com formatação direta e já alterna orientação por seção.
O que muda é a escala — 19 anexos em vez de 22 seções de uma tabela só.
