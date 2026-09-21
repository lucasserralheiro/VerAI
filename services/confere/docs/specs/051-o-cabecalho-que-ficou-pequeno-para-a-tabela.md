# ESPEC 051 — O cabeçalho que ficou pequeno para a tabela

| | |
|---|---|
| **Status** | **Implementada** — 2026-09-10. Backend **1.608 → 1.613 passed** (5 testes novos, nenhum removido), suíte isolada em 23min23s. `ruff` e `mypy` limpos nos arquivos tocados. `Servidores` e `ServidoresSemDesenv` saem com três tabelas cada nos dois pacotes de referência (piloto 38 → 40 tabelas; PGM 32 → 34 nos anexos, 34 → 36 no documento completo com aditivo), nenhuma fileira `w:tblHeader` com célula vazia. Os dois pacotes **reancorados** — `word/document.xml`, piloto e PGM —, com o delta provado por desligamento (`cabecalhos_adicionais` revertido volta ao hash de antes, entrada por entrada) |
| **Versão** | 1.0 — 2026-09-10 |
| **Depende de** | [ESPEC 004](004-anexos-de-detalhamento.md) — os 19 anexos de detalhamento, implementada. [ESPEC 037](037-a-linha-de-dados-que-virou-cabecalho.md) — implementada; é dela que vêm `localizar_cabecalho`, a família `R-CAB-*` e o `Anexo.corte` que esta espec generaliza |
| **Revisa** | [ESPEC 004](004-anexos-de-detalhamento.md) `R-ANX-11` — mais uma vez — e a [ESPEC 037](037-a-linha-de-dados-que-virou-cabecalho.md) `D-04`, que deixou registrado *"a correção mora na leitura; o renderizador não muda"*. Desta vez o renderizador muda também, porque o defeito não é mais um índice errado — é uma forma que o renderizador nunca soube que existia |
| **Não toca** | A tabela de comprovação, a capa, o teste-âncora, o `.xlsx` da análise, a resposta da API, a tela. Os **17** anexos cujo cabeçalho ocorre uma única vez na aba. `NAS` e `OutrosServicos` — a repetição de cabeçalho **secundário** deles é o `I-01` da ESPEC 037, e continua em aberto: é um problema parecido, mas não é este (§2.5) |
| **Referência normativa** | `backend/tests/fixtures/levantamento.xlsx` (piloto/SMIT) e `levantamento_pgm.xlsx` (PGM) — o defeito **já está nos dois pacotes hoje versionados**, medido no `.docx` que eles geram (§2.4); e o arquivo real que originou a submissão, `docs/documentos/SMIT SUSTENTAÇÃO_Levantamento_05969_TC 52SMIT2024_15072026_101414_V2.0.xlsx` |
| **Origem** | Submissão real, com capturas de tela do `.docx`: *"ao copiar a aba do xlsx, ServidoresSemDesenv, [...] ao quebrar a página o cabeçalho de algumas colunas não foi copiado"* |

---

## 1. Problema

Nos anexos `Servidores` e `ServidoresSemDesenv`, quando a tabela atravessa uma quebra de página, a
fileira que o Word repete no topo da página seguinte tem **células em branco onde deveria haver
rótulo de coluna** — `USO`, `Tipo VM`, `Sistema Operacional`, `Gerenciado`, entre outras, ficam sem
texto, exatamente nas colunas onde a página mostra dado de verdade.

Reproduzido com o arquivo que originou a submissão e lido o XML do `.docx` gerado pelo pipeline de
produção (`AnexoReader` + `DocxRenderer`, sem nenhuma alteração de código):

```
tabela 2 (ServidoresSemDesenv), fileira 0, w:tblHeader presente, 15 células de grade:

  Servidor | vCPU | Qtde RAM(GB) | Qtde DISCO(GB) | Armazenamento SAN (GB) |
  VCPU Adicional | VRAM Adicional | Função | Tipo VM | Sistema Operacional |
  Ambiente | (vazia) | (vazia) | (vazia) | (vazia)
```

Onze rótulos, com texto. Quatro células, sem nenhum — não é espaço em branco por formatação, é
ausência de conteúdo no `<w:t>`. O mesmo acontece em `Servidores`.

## 2. O que foi levantado no código

### 2.1 A aba tem duas tabelas, de formas diferentes

Lendo `ServidoresSemDesenv` com `openpyxl` diretamente sobre o arquivo da submissão:

| Linha (Excel, 1-based) | O que é | Colunas | Rótulos |
|---|---|---|---|
| 12 | cabeçalho da tabela de **resumo** | 11 | `Servidor \| vCPU \| Qtde RAM(GB) \| Qtde DISCO(GB) \| Armazenamento SAN (GB) \| VCPU Adicional \| VRAM Adicional \| Função \| Tipo VM \| Sistema Operacional \| Ambiente` |
| 41 | cabeçalho da tabela de **detalhe** | 15 | `Servidor \| Serviço \| Nome do Serviço \| Tipo de Servidor \| vCPU \| RAM(MB) \| DISCO(MB) \| RAM(GB) \| SAN(GB) \| VCPU Adicional \| VRAM Adicional \| USO \| Tipo VM \| Sistema Operacional \| Gerenciado` |

São **duas tabelas empilhadas na mesma aba**, com número de colunas e rótulos diferentes — a
primeira é um resumo agregado; a segunda é o detalhe por servidor, com colunas que a primeira não
tem (`Serviço`, `Nome do Serviço`, `USO`, `Gerenciado`...). O mesmo padrão, nas mesmas duas abas, com
os mesmos rótulos, está em `Servidores` (linhas 13 e 52).

### 2.2 O leitor só reconhece uma tabela por aba

`localizar_cabecalho` ([cabecalho.py:25](../../backend/src/infrastructure/annex/cabecalho.py#L25))
devolve a **primeira** fileira cujos rótulos começam pela âncora configurada
(`["Servidor", "vCPU", "Qtde RAM(GB)"]`, em `anexos.json`). É a linha 12 — certa, é o cabeçalho da
maior tabela da aba, exatamente o que a `R-CAB-03` pede. A linha 41 não casa essa âncora (começa por
`Servidor, Serviço, ...`, não por `Servidor, vCPU, ...`) e **nunca é considerada cabeçalho**: para o
leitor, ela é só mais uma linha de dados.

`Anexo.corte` ([annex.py:172](../../backend/src/domain/entities/annex.py#L172)) parte a aba em no
**máximo duas** tabelas — o preâmbulo, e um único bloco de corpo do índice do cabeçalho até o fim da
aba. Não há um terceiro corte para a segunda tabela, porque o modelo (`int | None`) só guarda um
índice.

### 2.3 A largura do bloco é a do intervalo inteiro, não a do cabeçalho que o abre

`forma_do_bloco` ([annex.py:199](../../backend/src/domain/entities/annex.py#L199)) calcula quantas
colunas um bloco usa pelo **máximo de colunas com conteúdo em qualquer linha do intervalo**. O bloco
de corpo de `ServidoresSemDesenv` vai da linha 11 (0-based) até o fim — 52 linhas —, e como a segunda
tabela (a partir da linha 40, 0-based) usa 15 colunas, o bloco inteiro nasce com 15 colunas de grade.

`_tabela_do_anexo` ([docx_renderer.py:511](../../backend/src/infrastructure/report/docx_renderer.py#L511))
marca `w:tblHeader` só na fileira 0 desse bloco — a linha 11 original, que só tem 11 rótulos. As
quatro colunas que sobram (`grade[base+coluna]` de 11 a 14) existem na grade, foram escritas com
`escrever(celula, "")` pelas linhas do **resumo** (que não têm conteúdo ali) e nunca são reescritas
pelo cabeçalho, porque o cabeçalho está fora da fileira marcada.

### 2.4 O defeito já está nos dois pacotes hoje versionados

Gerado o `.docx` a partir de `levantamento.xlsx` (piloto) e `levantamento_pgm.xlsx`, sem alteração de
código, e lida toda fileira com `w:tblHeader`:

| Pacote | Anexo | Fileira marcada | Células vazias |
|---|---|---|---|
| Piloto | `Servidores` | `Servidor \| vCPU \| ... \| Ambiente \| · \| · \| · \| ·` | 4 de 15 |
| Piloto | `ServidoresSemDesenv` | idem | 4 de 15 |
| PGM | `Servidores` | idem | 4 de 15 |
| PGM | `ServidoresSemDesenv` | idem | 4 de 15 |

**Os dois pacotes de referência já carregam o defeito.** Não é peculiaridade do arquivo da submissão;
é o comportamento de hoje, medido contra as próprias fixtures que a suíte usa como régua.

### 2.5 Por que isto não é o `I-01` da ESPEC 037

A ESPEC 037 já documentou abas com cabeçalho que casa a âncora **mais de uma vez** — `NAS` (linhas 7
e 40) e `OutrosServicos` (linhas 3, 7 e 11) — e decidiu, deliberadamente, não repetir o cabeçalho dos
blocos secundários (`I-01`, "fora do escopo... exigiria N tabelas por anexo"). Medido com o mesmo
método desta espec, nos dois pacotes de referência:

| Aba | Ocorrências da âncora | Formato |
|---|---|---|
| `NAS` | 2 (piloto), 2 (PGM) | **idêntico** nas duas — mesmos 7 rótulos |
| `OutrosServicos` | 1 (piloto), 3 (PGM) | **idêntico** nas três — mesmos 2 rótulos |
| `Servidores` / `ServidoresSemDesenv` | 1 ocorrência da âncora configurada | a segunda tabela **não casa a âncora** — é um cabeçalho diferente, nunca visto pelo leitor |

No caso de `NAS`/`OutrosServicos`, a segunda ocorrência tem o **mesmo** formato da primeira: mesmo
que ela não seja marcada, o texto que aparece ali já é correto — só não se repete a cada página. É
inconveniente, não é uma célula em branco onde deveria haver rótulo. É por isso que passou 34 dias
sem ninguém notar.

Aqui a segunda tabela tem um formato **diferente**: colunas que a primeira não tem. Quando ela
"empresta" a largura para o bloco marcado como cabeçalho, sobra grade sem rótulo — e é isso que a
pessoa vê em branco na tela. **Esta espec não resolve o `I-01`** — `NAS` e `OutrosServicos` não são
tocados — e resolve um problema vizinho, medido separadamente: uma aba com **duas tabelas de forma
diferente**, e não apenas um cabeçalho repetido.

### 2.6 Por que nenhum teste pegou isto

`test_t2323_toda_fileira_marcada_do_piloto_e_um_cabecalho`
([test_cabecalho_do_anexo.py:105](../../backend/tests/test_cabecalho_do_anexo.py#L105)) é a rede que
a própria ESPEC 037 escreveu para este tipo de defeito — e ela passa, hoje, nos dois pacotes, com o
problema presente. A razão está em `_rotulos_da_fileira`
([test_cabecalho_do_anexo.py:44](../../backend/tests/test_cabecalho_do_anexo.py#L44)): ela **descarta
as células vazias** antes de comparar com a âncora, de propósito — é o que permite reconhecer
cabeçalho mesclado (`Nome | · | · | ·` vira `Nome`). O mesmo descarte que resolve a mesclagem apaga o
sintoma deste defeito: os 11 rótulos que sobram, sem as 4 células vazias, batem exatamente com a
âncora configurada. O teste enxerga o que está certo e não vê o que falta.

Nenhum outro teste em `test_docx_anexos.py` lê o **texto** da fileira marcada — os três testes que já
olhavam `w:tblHeader` antes da ESPEC 037 (§2.2 daquela espec) afirmam só **posição**.

No GRC a aba cabe numa página só (`"paginas_grc": "7"`), então a segunda tabela nunca precisa repetir
cabeçalho nenhum — ela aparece uma vez, no meio do fluxo, com seus próprios 15 rótulos, e ninguém
percebe as quatro colunas fantasmas que a tabela de resumo carrega sem borda por baixo dela (`R-BRD-02`
já as esconde). É a mesma classe de causa que a ESPEC 037 §2.7 e a ESPEC 033 §2.7 registraram: **o
defeito só aparece quando o `.docx` faz algo que o GRC nunca precisou fazer** — ali, ler várias
páginas com a mesma geometria; aqui, quebrar de página uma tabela que no papel de referência nunca
quebrou.

## 3. Objetivo

Que toda fileira marcada para repetição no topo de página tenha **texto em todas as suas colunas** —
o cabeçalho da tabela a que ela pertence, não o de outra tabela da mesma aba.

**Não é objetivo:** resolver o `I-01` da ESPEC 037 (repetir cabeçalho de `NAS`/`OutrosServicos`);
detectar cabeçalho sem âncora declarada, por heurística de forma (a ESPEC 037 `D-01` já mediu que
isso erra em silêncio, e a decisão continua valendo aqui); mudar largura, corpo, orientação ou
mesclagem de qualquer anexo além do necessário para separar as duas tabelas.

## 4. Escopo

### 4.1 Dentro do escopo

- Um anexo poder declarar **mais de uma âncora** de cabeçalho, cada uma resolvida pela mesma regra
  da `R-CAB-03` (prefixo, primeira ocorrência).
- Cada âncora resolvida virar um corte independente — uma tabela nova, com seu próprio `w:tblHeader`.
- A largura de cada segmento ser calculada só com as linhas daquele segmento.
- As duas âncoras de `Servidores` e `ServidoresSemDesenv`, medidas nos dois pacotes de referência e
  no arquivo da submissão.
- Um teste que faz o que o `test_t2323_*` não faz: conferir que a fileira marcada não tem célula
  vazia dentro da própria largura.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| `NAS` e `OutrosServicos` (`I-01` da ESPEC 037) | §2.5 — problema vizinho, não este. Repeti-los é decisão própria, com risco próprio (mudar o que hoje é cosmeticamente correto) |
| Detectar cabeçalho sem âncora declarada | ESPEC 037 `D-01`, medido: preenchimento e forma reprovam em cabeçalhos legítimos. Continua sendo o rótulo declarado, e mais nenhuma outra coisa |
| Qualquer anexo além de `Servidores` e `ServidoresSemDesenv` | São os únicos dois, dos 19, com uma segunda tabela de forma diferente na mesma aba — medido nos dois pacotes (§2.4) e no arquivo real |
| A tabela de comprovação | Usa o mesmo `repetir_cabecalho`, mas o cabeçalho dela é **construído** por `layout.CABECALHO_COLUNAS`, não lido de planilha — não há segunda tabela a descobrir |

## 5. Regras

| ID | Regra |
|---|---|
| `R-SEG-01` | Um anexo pode declarar, além da âncora primária (`cabecalho`), uma lista de **âncoras adicionais** (`cabecalhos_adicionais`). Cada uma é resolvida pelas mesmas `R-CAB-01` a `R-CAB-04` — prefixo, primeira ocorrência, `None` se não achar |
| `R-SEG-02` | Cada âncora resolvida — primária ou adicional — vira um **corte independente**, sob a mesma guarda de hoje: não corta se uma região mesclada atravessar o índice (a guarda de `Anexo.corte`, generalizada por índice) |
| `R-SEG-03` | A largura de cada **segmento** — o intervalo entre dois cortes consecutivos, ou entre um corte e o fim do bloco — é calculada só com as linhas daquele segmento. `forma_do_bloco` passa a ser chamada por segmento, nunca mais pelo bloco de `blocos()` inteiro quando ele contém mais de um corte |
| `R-SEG-04` | Todo segmento cujo início é uma linha de cabeçalho resolvida recebe seu **próprio** `w:tblHeader`, independente dos demais segmentos do mesmo anexo — cada tabela nova, separada pelo mesmo parágrafo de 1 pt que já separa preâmbulo e corpo hoje |
| `R-SEG-05` | Anexo **sem** âncoras adicionais tem exatamente um corte — o de hoje — e produz XML **idêntico, byte a byte**, ao que produz antes desta espec. É a regra de não regressão para os 17 anexos não tocados |
| `R-SEG-06` | Cortes são ordenados pela linha; duas âncoras que resolvam para o mesmo índice colapsam em um só corte (nunca um segmento vazio) |
| `R-SEG-07` | Só `Servidores` e `ServidoresSemDesenv` recebem `cabecalhos_adicionais` nesta entrega — os dois medidos com uma segunda tabela de forma diferente (§2.1, §2.4) |

### 5.1 Validações

Nenhuma validação nova. `V-ANX-02` (ESPEC 037) continua cobrindo a âncora primária não localizada; as
âncoras adicionais que não resolvem simplesmente não geram corte extra (o anexo sai como hoje, com o
defeito que esta espec corrige presente só onde a âncora adicional existir e resolver) — não é
condição de erro, é "esta aba não tem uma segunda tabela conhecida".

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **Campo novo e aditivo em `anexos.json`**, não mudança de tipo do campo `cabecalho` | `cabecalhos_adicionais: list[list[str]] = []`. Os 17 anexos que não declaram o campo continuam com uma tupla vazia — zero mudança de comportamento e zero mudança de leitura para eles (`R-SEG-05`) |
| `D-02` | **`Anexo.corte: int \| None` vira `Anexo.cortes: tuple[int, ...]`** | Generalização mínima: com uma âncora só, `cortes` tem no máximo um elemento e o comportamento é o de hoje. `docx_renderer.py` passa a iterar em vez de comparar com `None` |
| `D-03` | **`forma_do_bloco` passa a ser chamada por segmento** | É a mudança que de fato corrige o defeito. Marcar a fileira certa como cabeçalho (o que a ESPEC 037 já fazia) não adianta se a grade da tabela continuar sendo a do bloco inteiro — o problema nunca esteve na marca, estava na largura (§2.3) |
| `D-04` | **Sem detectar quantas tabelas uma aba tem** | Cada âncora adicional é medida e declarada à mão, no mesmo espírito da `R-CAB-01`: rótulo declarado, não adivinhado. Adivinhar "onde começa uma tabela nova" por mudança de largura erraria em qualquer aba cuja última coluna simplesmente fique vazia em algumas linhas — que é comportamento normal, não uma tabela nova |
| `D-05` | **`NAS` e `OutrosServicos` não recebem âncora adicional nesta entrega** | O mecanismo os atenderia se configurados, mas fazer isso muda um resultado hoje correto (mesmo texto, só não marcado) por um ganho cosmético, sem o defeito visível que motivou esta espec. Fica registrado como consequência possível, não como parte da entrega (`I-01` segue em aberto, agora com o mecanismo pronto para resolvê-lo quando alguém decidir que vale a pena) |
| `D-06` | **Os dois pacotes de referência serão reancorados — piloto e PGM** | Diferente das reancoragens anteriores (036, 037, 049), em que o piloto era a régua parada porque a medição foi feita nele: aqui **o próprio piloto tem o defeito** (§2.4), então corrigi-lo move o piloto também. Não é uma medição errada da correção — é a prova de que o defeito não era exclusivo do arquivo da submissão |

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `infrastructure/annex/anexos.json` | Campo novo `cabecalhos_adicionais` em `Servidores` e `ServidoresSemDesenv`: `[["Servidor", "Serviço", "Nome do Serviço"]]`. As outras 17 entradas ficam como estão |
| `infrastructure/annex/configuracao.py` | `ConfiguracaoDeAnexo.cabecalhos_adicionais: tuple[tuple[str, ...], ...] = ()` |
| `infrastructure/annex/cabecalho.py` | `localizar_cabecalho` **não muda** — já é a função pura reaproveitada por âncora. Só é chamada mais vezes |
| `infrastructure/annex/anexo_reader.py` | `_anexo` resolve cada âncora adicional com `localizar_cabecalho`, filtra os `None` e monta `linhas_cabecalho_adicionais` |
| `domain/entities/annex.py` | `Anexo.linhas_cabecalho_adicionais: tuple[int, ...] = ()`. `Anexo.corte` (propriedade) vira `Anexo.cortes` — mesma guarda de mesclagem, aplicada por índice, resultado ordenado e sem repetição |
| `infrastructure/report/docx_renderer.py` | `_faixa_de_tabelas` itera `anexo.cortes` dentro da faixa e emite uma tabela por segmento (hoje: no máximo duas; passa a: `len(cortes) + 1`, exceto quando `cortes` está vazio — uma tabela só, como hoje). `_tabela_do_anexo` não muda de assinatura; passa a ser chamada uma vez por segmento |
| `tests/test_anexos_configuracao.py` | Teste novo: `cabecalhos_adicionais` só existe para `Servidores` e `ServidoresSemDesenv` |
| `tests/test_cabecalho_do_anexo.py` | Teste novo: nas fileiras marcadas desses dois anexos, nenhuma célula vazia dentro da própria largura |
| `tests/test_docx_anexos.py` | Contagem de tabelas dos dois anexos afetados passa de duas para três; os testes existentes que contam tabelas por anexo são atualizados com o número medido, não estimado |
| `tests/test_identidade_dos_artefatos.py` | Reancoragem de **`word/document.xml`**, piloto e PGM (`D-06`), com o texto explicando o delta, no mesmo formato das reancoragens anteriores |
| `application/`, `api/`, `frontend/` | **Nenhuma** |

## 8. Testes e critério de aceite

### 8.1 As regras

| Regra | Verificação |
|---|---|
| `R-SEG-01` a `R-SEG-03` | Aba sintética com duas tabelas de formas diferentes (11 e 15 colunas, como `ServidoresSemDesenv`): duas fileiras marcadas, cada uma com a largura da sua própria tabela, nenhuma célula vazia |
| `R-SEG-04` | As duas fileiras marcadas de `ServidoresSemDesenv` e de `Servidores`, nos dois pacotes, batem exatamente com as duas âncoras declaradas — reforço do `test_t2323_*`, que passa a considerar as âncoras adicionais |
| `R-SEG-05` | Para os 17 anexos sem âncora adicional, o XML produzido **não muda** — verificado pela mesma suíte de hash de `test_identidade_dos_artefatos.py`, entrada por entrada, exceto `word/document.xml` |
| `R-SEG-06` | Aba sintética em que a âncora primária e uma adicional resolvem na mesma linha: um corte só, sem segmento vazio |
| `R-SEG-07` | `cabecalhos_adicionais` não vazio só em `Servidores` e `ServidoresSemDesenv`, nos dois catálogos (config e teste) |

### 8.2 A rede que fica

**O teste que teria pego este defeito, e a ESPEC 037 não escreveu porque não sabia dele:**

> Em `Servidores` e `ServidoresSemDesenv`, nos dois pacotes de referência, toda fileira marcada com
> `w:tblHeader` não tem nenhuma célula vazia dentro da sua própria largura de grade.

Hoje ele reprova nos dois pacotes, nos dois anexos (§2.4). Depois da correção, passa nos dois — e
continua valendo para a planilha do mês que vem, porque afirma uma propriedade do documento, não um
número.

### 8.3 Regressão

- `test_docx_anexos.py` — 19 seções continuam saindo; a contagem de tabelas por anexo muda **só** em
  `Servidores` e `ServidoresSemDesenv` (duas → três), medido, não estimado;
- `test_cabecalho_do_anexo.py` — os testes de `R-CAB-01` a `R-CAB-07` continuam valendo sem alteração:
  a resolução por âncora não muda, só passa a rodar mais de uma vez por anexo quando há âncora
  adicional;
- `test_anexos_configuracao.py` — as contagens de orientação (14/5) e as validações de âncora
  primária (`test_a_ancora_tem_de_um_a_tres_rotulos` etc.) não se movem: `cabecalhos_adicionais` é
  campo novo, não substitui `cabecalho`;
- os dois `.xlsx` de análise: **byte a byte inalterados** — esta espec não toca leitura de
  `Levantamento`, nem geração de planilha;
- `test_desempenho.py` — a resolução de âncora adicional é, no pior caso, mais uma varredura linear
  por anexo (dois anexos, uma âncora a mais cada). Medido antes/depois, esperado dentro do ruído já
  registrado pela ESPEC 026.

### 8.4 Critério de aceite

1. Qualquer hash da §7 que se mova **fora** de `word/document.xml`, nos dois pacotes, reprova a
   entrega;
2. `Servidores` e `ServidoresSemDesenv` saem, nos dois pacotes, com três tabelas cada (preâmbulo,
   resumo, detalhe), cada uma com sua fileira de cabeçalho sem célula vazia;
3. os outros 17 anexos saem com a mesma contagem de tabelas e seções de hoje;
4. a suíte completa fecha sem novas falhas, com os testes novos de §8.1 e §8.2 como rede permanente.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Uma âncora adicional casar, por acaso, uma linha de dados comum | Mesma defesa da `R-CAB-06`: a âncora é medida contra o piloto e o PGM antes de entrar em `anexos.json`, e o teste de §8.1 trava o catálogo |
| Reancorar às cegas os dois pacotes | Prova por desligamento, no rito das ESPECs 028/036/037: revertendo `cabecalhos_adicionais` para vazio, os dois pacotes voltam ao hash de hoje, entrada por entrada |
| A separação em três tabelas mudar a paginação de outros anexos por engano | `R-SEG-05` mais o portão da §8.4 item 3 — qualquer anexo fora do escopo que mude de contagem de tabelas reprova a entrega |
| Alguém estender `cabecalhos_adicionais` para `NAS`/`OutrosServicos` sem medir o impacto | Fica registrado aqui e na ESPEC 037 (`I-01`) que isso é decisão própria — o mecanismo permite, a configuração de hoje não pede |
| A guarda de mesclagem (`R-SEG-02`) não bloquear um corte que deveria, numa aba futura com mesclagem atravessando um cabeçalho adicional | Mesma guarda que `Anexo.corte` já tem, só generalizada por índice — não é lógica nova, é a mesma aplicada mais vezes |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | Vale estender `cabecalhos_adicionais` a `NAS` e `OutrosServicos`, agora que o mecanismo existe, fechando o `I-01` da ESPEC 037? | Não. É decisão própria — muda um resultado hoje correto, precisa de medição visual antes (`D-05`) |
| `I-02` | Existe alguma outra aba, em alguma planilha de algum órgão ainda não versionada, com uma terceira tabela empilhada? | Não bloqueia. `R-SEG-01` é genérica — qualquer anexo pode ganhar mais de uma âncora adicional quando medido, sem mudar código |
| `I-03` | O `medidas_grc.json` de `Servidores`/`ServidoresSemDesenv` tem 15 larguras, medidas pela tabela de detalhe. A tabela de resumo, com 11 colunas, usa as 11 primeiras — é a largura certa, ou o GRC mede a tabela de resumo com proporção diferente? | Não bloqueia a entrega — é o comportamento de hoje (a tabela de resumo já usa essas larguras, só que com 4 colunas fantasmas a mais). Vale conferir contra o PDF do GRC na fase de medição |

## 11. Relação com a ESPEC 037

A ESPEC 037 corrigiu **qual linha** é o cabeçalho — trocou um número medido numa planilha só por uma
resolução por rótulo. Ela deixou dito, na `D-04`, que a correção morava inteira na leitura, e o
renderizador não precisava mudar — e não precisava, para o defeito que ela resolvia: uma linha de
dados marcada no lugar errado, dentro de um anexo que continuava tendo **uma** tabela de corpo.

Esta espec resolve o defeito seguinte, que só aparece quando a aba tem **mais de uma** tabela: aí não
basta saber qual linha marcar — é preciso também saber que existe uma segunda tabela, com sua própria
largura, e o renderizador precisa aprender a desenhar mais de duas tabelas por anexo. O `I-01` daquela
espec já via essa fronteira — *"exigiria uma tabela por bloco secundário"* — e a deixou para uma spec
própria. Esta é essa spec, escrita a partir do caso que a tornou visível.

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | `cabecalhos_adicionais` em `anexos.json` para os dois anexos, medido nos dois pacotes e no arquivo da submissão | P |
| B | Testes escritos antes: a aba sintética de duas tabelas (§8.1) e a rede da §8.2, que têm de reprovar antes da correção | P |
| C | `Anexo.cortes`, a resolução no `AnexoReader` e a generalização de `_faixa_de_tabelas` | PP |
| D | Reancoragem dos dois pacotes, com o delta provado por desligamento | P |
| E | Suíte completa e conferência de que nenhum anexo fora do escopo mudou de forma | PP |

**Estimativa: um dia.** Maior que a ESPEC 037 (meio dia) porque desta vez o renderizador muda — a
generalização de `_faixa_de_tabelas` de "no máximo duas tabelas" para "uma por segmento" é o item de
maior risco, e é onde a fase E concentra o trabalho de prova.

## 13. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-09-10 | Redação inicial, a partir de uma submissão real com capturas do `.docx` mostrando colunas de cabeçalho em branco após quebra de página. A investigação mediu o mesmo defeito, sem alteração de código, nos dois pacotes de referência já versionados (§2.4), e o distinguiu do `I-01` da ESPEC 037, com o qual poderia ser confundido (§2.5) |
