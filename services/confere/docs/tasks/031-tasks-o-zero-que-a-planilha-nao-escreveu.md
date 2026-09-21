# TASKS 031 — Backlog de "O zero que a planilha não escreveu"

| | |
|---|---|
| **Especificação** | [ESPEC 031](../specs/031-o-zero-que-a-planilha-nao-escreveu.md) **v1.1** |
| **Plano** | [PLANO 031](../plans/031-plano-o-zero-que-a-planilha-nao-escreveu.md) v1.0 |
| **Versão** | 1.0 — 2026-08-20 |
| **Total** | **35** tarefas · 6 portões · 3 insumos em aberto — a `T-2159b` não estava prevista e nasceu da `T-2134` |
| **Status** | **Concluído** — 2026-08-20. **35 de 35 tarefas**, portões `P0` a `P5` fechados. Backend **1.383 → 1.404 passed**, zero falhas. Navegador **119 de 120**, com uma falha intermitente que passa isolada e não é desta entrega (`I-05`) |

> **Escrito antes da implementação**, como os TASKS 020 a 023, 027 e 030. A §9 é a única seção que
> não pode ser escrita agora, e é a que a próxima entrega vai ler.

---

## 1. Convenções

**Identificadores** `T-21nn`, continuando de `T-2133`, a última da ESPEC 030.

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`python -m pytest` verde — **com o `-m`**, sem o qual a coleta quebra em
`ModuleNotFoundError: No module named 'tests'` (PLANO 028 §8); comentário explicando o *porquê*
onde a escolha não for óbvia.

**Convenção de commit** `<tipo>(T-21nn): descrição`. Reancoragem é `test(...)`; mudança de
comportamento é `feat(...)` ou `fix(...)`. **Nunca os dois no mesmo commit** — é a `R-SUI-04` da
ESPEC 030, e é o que permite ler o histórico depois.

**Não passar `--timeout` ao pytest.** O plugin não está instalado neste projeto, e o erro sai como
`unrecognized arguments` **depois** do cabeçalho — em `pipe` para `tail`, com código de saída 0.
Custou uma execução na preparação deste backlog.

### 1.1 Quatro regras que atravessam este backlog

**1 — O oráculo se mede na planilha, nunca no predicado.** Os dois códigos que a `R-APU-03` zera
entram nos testes **por extenso**. Derivá-los de `omitido_da_apuracao_descontada` faria o teste
afirmar *"o código concorda com o código"* — o modo de falha que o PLANO 021 §1 nomeou e que o
TASKS 028 §1.1 repetiu.

*O sinal no diff:* uma compreensão de lista chamando o predicado novo dentro de arquivo de teste.

**2 — `medida_texto` não se adultera.** A `R-PER-02` foi emendada na ESPEC 021 sobre a promessa de
que aquele campo guarda o conteúdo da célula. A zeragem produz uma **linha emitida** com medida
zero; não produz um `MeasurementItem` com a célula reescrita. Toda tarefa que toque a medida tem de
poder responder *"e a célula?"* — e a resposta é sempre *"intacta, e é o que o `LinhaZerada`
mostra"*.

*O sinal no diff:* `replace(item, medida_texto=...)`, ou qualquer construção de `MeasurementItem`
fora do leitor.

**3 — Toda âncora é inventariada antes de o número mudar**, e **por o que o teste afirma, não por
onde ele mora** (PLANO 024 §7). O PLANO 028 §8 registrou que o critério não foi aplicado até o fim
e que duas âncoras apareceram depois de 14 minutos de suíte. Seria a terceira vez: as seis buscas
do PLANO 031 §8 são a `T-2134`, e o resultado delas **manda na tabela da ESPEC §8.4**, nunca o
contrário.

*O sinal no diff:* constante de contagem ou de `sha256` alterada sem a cadeia dos estados ao lado.

**4 — A árvore carrega trabalho de outras três especs.** `container.py` e
`test_identidade_contratual.py` têm a `T-2111` da ESPEC 029; seis arquivos de `frontend/e2e/` têm a
ESPEC 030; os documentos das duas estão modificados ou não versionados. **Nenhum commit deste
backlog toca esses arquivos**, com uma exceção nomeada: o `container.py` da `T-2153`, que registra
a `V-MED-04` no mesmo bloco que a `T-2111` alterou — e por isso é escrito **sobre o estado atual do
arquivo**, não sobre o do `HEAD`.

*O sinal no diff:* qualquer alteração em `frontend/e2e/` ou em `test_identidade_contratual.py`.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** Inventário e oráculo | T-2134 … T-2138 | **P0** | F0 |
| **E1** Os testes, escritos antes | T-2139 … T-2145 | **P0** | F1 |
| **E2** O domínio, e o instante em que nada mudou | T-2146 … T-2149 | **P1** | F2 |
| **E3** A emissão | T-2150 … T-2153 | **P2** | F3 |
| **E4** A reancoragem | T-2154 … T-2159, T-2159b | **P3** | F4 |
| **E5** A tela e a API | T-2160 … T-2162 | **P4** | F5 |
| **E6** O conjunto | T-2163 … T-2167 | **P5** | F6 |

### 2.1 A régua da entrega — o que pode mudar de comportamento

| Muda | Não muda |
|---|---|
| `14.049.00054.00` do piloto: medida **2 → 0** | `item_para`, `contratada_para`, `codigos_em_ordem` |
| `14.049.00037.00` do PGM: medida **1 → 0** | Quais códigos entram no relatório, e em que ordem |
| `.docx`: piloto **55 → 54** linhas; PGM **51 → 50** | `total_linhas` — **58** nos dois pares |
| Críticos: piloto **1 → 0**; PGM **4 → 3** | Os 22 códigos repetidos — `CONGELADOS_PILOTO` e `CONGELADOS_PGM` intactos |
| Cinco constantes de âncora e o `.json` da `T-1507` | `R-ZER-01`, `R-REL-08`, `R-REL-06`, `V-MED-03` |
| ESPEC 028 §1, `README.md`, `CHANGELOG.md` | `docx_renderer.py`, `xlsx_analise_renderer.py`, `layout.py`, `Contract` inteiro |

---

## 3. Épico E0 — Inventário e oráculo `[portão P0]`

> **Nenhum arquivo de `src/` é tocado neste épico.** A saída é conhecimento medido, que só depois
> vira constante.

#### T-2134 — As seis buscas, e o inventário de âncoras `[risco]`
**Tamanho:** PP · **Ref:** PLANO §8, regra 3

Executar sobre `backend/tests/` inteiro: `sha256`; `assert len(`; `ANCORA\s*=` e `Path(.*\.json`;
`== 5[0-9]\b`; `14\.049\.0005[0-9]` e `14\.049\.0003[0-9]`; `CRITICO` e `Item crítico`.

Comparar o resultado com a tabela da ESPEC §8.4 (dezessete linhas na v1.0). **Aparecendo âncora que ela
não previu, a tabela é emendada aqui** — antes de qualquer código, e nunca ajustando valor esperado
a valor obtido.

Duas coisas já se sabem, e estão registradas para não custarem uma suíte de 14 minutos:
`test_desconto_desenvolvimento.py` não precisa de edição, e `test_analise.py` também não (seus cenários de crítico constroem `ReportLine` à
mão).

**Pronto quando:** o inventário está fechado por escrito, com cada âncora nomeada por arquivo,
linha e o que ela afirma.

> **Executada — 2026-08-20. A ESPEC foi emendada para a v1.1.** As seis buscas acharam **24
> âncoras contra as 17 que a v1.0 previa de cabeça**, e sete delas eram invisíveis sem a busca:
> `total_divergencias` (37 → 36 e 27 → 26), a lavanda de `test_docx_formatacao`, as linhas do
> `.docx` embutido no e2e, e quatro asserções sobre o `14.049.00054.00` espalhadas por
> `test_divergences`, `test_reconciliation` e `test_xlsx_analise`.
>
> **E acharam uma cascata que nenhuma busca por constante pegaria** — registrada na ESPEC §2.7. O
> `14.049.00054.00` era a **única** linha do bloco final do piloto que a `R-ZER-01` ainda
> desenhava; zerando-a, o bloco esvazia e a `R-ZER-04` dispara: somem a faixa, o asterisco e a
> nota. Isso revoga o `16.013` previsto para `CORPO_DO_PILOTO_TEXTOS` e cria a `T-2159b`.
>
> O número foi obtido aplicando a regra por *monkeypatch*, sem tocar `src/` — a regra 1 deste
> backlog vale para o oráculo, e a previsão do delta é outra coisa.

---

#### T-2135 — A linha de base da suíte `[risco]`
**Tamanho:** PP · **Ref:** PLANO, Estado inicial

`python -m pytest -q` completo. Registrar: quantos passam, quantos falham, e **quais falham por
trabalho não commitado de outras especs**.

São **1.383 testes coletados**. O número de aprovados é o que esta tarefa mede, e é ele que
distingue *"a suíte estava vermelha"* de *"a minha mudança quebrou"* — a confusão que o PLANO 028
§8 pagou caro.

**Pronto quando:** o número está registrado aqui, com a lista das falhas pré-existentes, se houver.

> **Executada — 2026-08-20: `1383 passed, 1 warning in 783.67s` (13min03).** Nenhuma falha
> pré-existente, apesar de a árvore carregar trabalho de três especs. **Todo vermelho depois da
> `F3` é desta entrega**, e a regra 4 deste backlog fica sendo sobre não *tocar* aqueles arquivos,
> não sobre tolerar falhas herdadas.

---

#### T-2136 — Remedir o conjunto tocado
**Tamanho:** PP · **Ref:** `R-APU-09`, ESPEC §2.4

Rodar o simulador sobre os sete arquivos: os dois pares reais, as quatro fixtures de levantamento e
a de códigos deslocados. Confirmar **2 códigos em 120**, **4 blocos pareados**, **0 sem par**.

**Da planilha, não do predicado** (regra 1). O simulador aplica a regra sem tocar `src/`, e é por
isso que ele pode ser o oráculo.

Conferir também que fixture e arquivo real concordam nos dois pares — mesmos códigos, mesmas linhas
59 e 45. Foi a divergência entre os dois que manteve a `R-MED-02` desligada em produção por vários
incrementos sem que a suíte notasse (ESPEC 018 §2.8).

**Pronto quando:** os dois conjuntos estão escritos por extenso: `{14.049.00054.00}` e
`{14.049.00037.00}`.

> **Executada — 2026-08-20.** 2 códigos em 120; 4 blocos pareados, 0 sem par; as duas fixtures de
> borda intocadas — `blocos_invertidos` **pareia e não toca nada**, que é o comportamento correto.
> Fixture e arquivo real concordam nos dois pares, linhas 59 e 45.

---

#### T-2137 — Confirmar que a `R-MED-02` não será tocada
**Tamanho:** PP · **Ref:** `R-APU-02`

Conferir código a código que **nenhum dos dois congelados traz o órfão do seu próprio par**:
`14.049.00054.00` não está em `CONGELADOS_PILOTO` (13 entradas), e `14.049.00037.00` não está em
`CONGELADOS_PGM` (9).

**Cuidado com a leitura apressada, e ela é fácil de fazer:** `14.049.00037.00` **está** em
`CONGELADOS_PILOTO`. Ali ele não é órfão — no piloto aparece nos dois blocos, medindo 1 nos dois.
Órfão ele é **no PGM**, e é lá que a sua ausência importa.

É a prova mais direta de que a regra do desconto não se move: aquele módulo tem os valores lidos da
planilha, congelados na ESPEC 018, e passa **sem edição** nesta entrega. Se precisar de edição, a
`R-APU-02` está errada.

**Pronto quando:** a conferência está feita e o fato registrado como critério do `P2`.

> **Executada — 2026-08-20.** `14.049.00054.00` ausente de `CONGELADOS_PILOTO`;
> `14.049.00037.00` ausente de `CONGELADOS_PGM`. `test_desconto_desenvolvimento.py` passa sem
> edição, e a `R-MED-02` não se move.

---

#### T-2138 — Capturar a linha de base dos quatro artefatos `[portão]`
**Tamanho:** PP · **Ref:** **P1**, ESPEC §8.4

Gerar `.docx` e `.xlsx` de análise dos dois pares e conferir contra os hashes que a espec registrou:
`c1e48db289162009` e `fd5d9c36d4b18e84` (piloto), `7da1a1a8f433bac4` e `26221d456ff97cbb` (PGM).

**Divergindo, o backlog para.** A árvore mudou desde a escrita da espec, e todo o valor do `P1`
está em comparar contra um número verdadeiro **agora**, não ontem.

**Pronto quando:** os quatro batem, ou a divergência está explicada e os hashes, atualizados em
toda a cadeia — espec, plano e este documento.

> **Executada — 2026-08-20, e ela reprovou como escrita.** Duas capturas do mesmo relatório, sem
> nada mudar entre elas: os dois `.docx` bateram; os dois `.xlsx` **não**. Um byte de diferença em
> cada, e o byte é o `dcterms:modified` de `docProps/core.xml`.
>
> Não é defeito desta entrega nem do renderizador: é que **o `.xlsx` nunca foi ancorado por
> arquivo** neste projeto, e a ESPEC v1.0 inventou uma âncora que não existia. O `.docx` é estável
> porque a `R-DOC-10` o normaliza; o `.xlsx` não tem regra equivalente, e não precisa ter.
>
> **Corrigido:** o critério passa a ser `sha256` **por entrada do pacote, com `docProps/core.xml`
> fora** — o método que `test_identidade_dos_artefatos.py` já documenta e que
> `tests/pacote.py` já implementa. Reconferido: os quatro estáveis entre execuções.
>
> | | `.docx` | `.xlsx` |
> |---|---|---|
> | Piloto | `d7829ee0af3cb50f` | `0a0b779902f1d6ed` |
> | PGM | `a1df03d46f3e5cc2` | `d4ef7185adf8fe47` |
>
> A ESPEC §8.4 e o `P1` do plano foram emendados. **Os quatro valores da v1.0 ficam revogados** —
> dois deles eram irreprodutíveis, e teriam feito o `P1` reprovar sem causa na `F2`.

**Verificação:** `P0` (primeira metade).

---

## 4. Épico E1 — Os testes, escritos antes `[portão P0]`

#### T-2139 — A fixture mínima `[risco]`
**Tamanho:** P · **Ref:** `R-APU-03`

Planilha nova e pequena: bloco bruto com 3 códigos, apuração descontada com 2, títulos na forma
real — o de baixo é o de cima mais ` - DESCONTANDO RECURSOS DE DESENVOLVIMENTO`.

**A faixa tem de chegar ao leitor como no arquivo real.** A ESPEC 018 §2.8 registra que `openpyxl`,
ao regravar, guarda a mesclagem e apaga as células não-âncora: a faixa sai de 5/5 preenchidas no
arquivo de produção para 1/5 na fixture, e **nessa forma o crivo antigo funcionava**. A suíte
testou por meses uma forma que a produção nunca via.

Conferir a fixture recém-gerada com o mesmo `_e_titulo_de_bloco` que o leitor usa, e afirmar que a
faixa é reconhecida.

**Pronto quando:** a fixture existe, o leitor enxerga os dois blocos, e o teste que os pareia
reprova por medida `2` onde espera `0`.

> **Executada — 2026-08-20.** `levantamento_apuracao_incompleta.xlsx`, gerada por
> `gerar_apuracao_incompleta()` — função nova **no gerador que já existia**, e
> não num script novo. As duas fixtures antigas **não foram regravadas**:
> regravá-las produziria bytes novos com conteúdo idêntico, e o `git status`
> mostraria mudança onde não houve nenhuma.
>
> Conferida com o **mesmo** `_e_titulo_de_bloco` do leitor: as duas faixas
> reconhecidas, com 5/5 células preenchidas — a forma da produção, e não a que
> `openpyxl` produz ao regravar uma mesclagem. E ela reproduz o defeito: hoje
> `item_para('14.049.00092.00')` devolve a linha 8, medindo `2`.

---

#### T-2140 — Módulo `test_apuracao_descontada.py`
**Tamanho:** P · **Ref:** `R-APU-01`, `R-APU-03`

O pareamento dos quatro blocos reais; título com marca abreviada ou separador trocado **não**
pareia; ausência de código na apuração descontada rende zero.

**Pronto quando:** o módulo existe e reprova contra o `HEAD`, cada asserção na mensagem esperada.

---

#### T-2141 — O limite declarado, e a contratada
**Tamanho:** PP · **Ref:** `R-APU-04`, `R-APU-06`, `D-05`

`14.024.00005.00` do piloto, que é o caso duplo: a marca está na **descrição** e não no título, o
bloco `E5.1` não é apuração descontada, e nada nele é zerado. E a contratada continua `3500`,
lida da ocorrência primária.

Este é o defeito **simétrico** ao que a espec corrige: ler a contratada da variante descontada
produziria `0` onde a planilha afirma 3.500, e um item conforme viraria consumo sem cobertura.

**Pronto quando:** o teste existe e **passa já** contra o `HEAD` — é invariante, não mudança.

---

#### T-2142 — O teste que reprova o atalho da camada errada `[risco]`
**Tamanho:** PP · **Ref:** `D-03`, `R-APU-08`, regra 2

Duas asserções, e elas são o único ponto da suíte que pega o atalho:

1. `Measurement.item_para('14.049.00054.00')` devolve a ocorrência bruta **intacta**, com
   `medida_texto == '2'`;
2. o `LinhaZerada` correspondente traz `medida_texto == '2'` — o que a planilha diz —, e não o zero
   emitido.

O atalho é pôr a zeragem dentro de `item_para`, devolvendo o item com `medida_texto` trocado por
`'0'`. Sai em duas linhas, o número fica certo, e o registro de conferência passa a mostrar o que o
sistema inventou em vez do que a célula tem.

**Pronto quando:** as duas asserções existem; a primeira passa já, a segunda reprova por o
`LinhaZerada` ainda não existir.

---

#### T-2143 — Os cenários construídos das regras sem caso real
**Tamanho:** PP · **Ref:** `R-APU-05`, `R-APU-07`

Duas situações que nenhum arquivo real exercita:

- bloco com a marca no título cujo bruto **não** existe — nada muda, e `V-MED-04` dispara;
- ocorrência bruta com medida `PACOTE`, ausente da apuração descontada — sai `1 / 1` pela
  `R-REL-08`, com `V-MED-04`.

A segunda é a que a guarda de medida numérica da `T-2151` existe para atender, e **nenhum par real
acusaria** se ela fosse esquecida.

**Pronto quando:** os dois cenários existem, montados à mão.

---

#### T-2144 — As âncoras de conjunto
**Tamanho:** PP · **Ref:** `R-APU-09`

Em `test_anchor_por_codigo.py`: `14.049.00054.00` entra em `ZERADOS_DO_PILOTO` (3 → 4) e
`14.049.00037.00` em `ZERADOS_DO_PGM` (7 → 8). `BLOCO_FINAL_DO_PILOTO` e `BLOCO_FINAL_DO_PGM`
**seguem inteiros** — são o conteúdo de `demais_itens`, e o que muda é quantos deles chegam ao
`.docx`.

Cada entrada nova ganha comentário dizendo de onde veio: bloco bruto, ausência da apuração
descontada, número da linha na aba.

**Pronto quando:** as duas constantes estão atualizadas e o teste reprova por linha exibida a mais.

---

#### T-2145 — O teste dos arquivos reais, e o portão `[portão]`
**Tamanho:** PP · **Ref:** ESPEC §8.3, **P0**

Teste marcado que abre `docs/documentos/` — os dois levantamentos de produção — e confere contagem
de pares (2 em cada) e conjunto tocado.

Hoje a suíte toca **apenas** `backend/tests/fixtures/`. Foi esse o buraco da ESPEC 018: a fixture
era faithful em forma e não em detalhe, e a regra ficou inerte em produção sem que nada acusasse.
A `T-2136` conferiu à mão que hoje elas concordam; conferência de agosto não é garantia em
novembro.

Ao fim do épico, rodar tudo contra o `HEAD` e conferir a tabela: os de zeragem reprovam, os de
`R-APU-04`, `R-APU-05` e `R-APU-06` **passam já**.

> **Os que passam antes de qualquer código novo são resultado, não folga.** Eles descrevem o que
> **não** muda. Reprovando aqui, a premissa de que a regra é estreita estaria errada antes de
> começar.

**Pronto quando:** a tabela do `P0` está preenchida, teste a teste, com a asserção que cada um
acusou.

> **Executada — 2026-08-20. `P0` cumprido.** Contra o código intocado:
>
> | Módulo | Verde | Vermelho | Como reprova |
> |---|---|---|---|
> | `test_apuracao_descontada.py` (novo, 20 testes) | 3 | 17 | **2 por asserção comportamental** — `assert Decimal('2') == 0` no piloto e `assert Decimal('1') == 0` no PGM; 15 por `AttributeError`, que é o mecanismo ainda não existir |
> | `test_anchor_por_codigo.py` | 9 | 5 | `assert {'14.049.00054.00'} == set()` e `assert {'14.049.00037.00'} == set()` — os dois ainda desenhados no `.docx` |
>
> **Os três verdes são os invariantes**, e é resultado e não folga: o pareamento
> não ser por posição (`D-02`), a contratada não ser arrastada (`R-APU-04`) e
> `item_para` devolver a ocorrência bruta intacta (`D-03`). Reprovando algum
> deles, a premissa de que a regra é estreita estaria errada antes de a `E2`
> começar.
>
> **Sobre os 15 `AttributeError`.** É vermelho legítimo — API que não existe —,
> e é vermelho **fraco**: não diz qual número está errado hoje. Por isso os dois
> testes de fluxo foram acrescentados ao módulo: eles passam pelo caso de uso
> inteiro, com a API pública de sempre, e trazem o valor de produção na mensagem.
> São eles que provam que o defeito é real e que a correção o alcança.
>
> `test_r_apu_06` reprova por `AttributeError` na **última** asserção; a primeira
> — a de que o bloco `E5.1` é um só — passa. O limite declarado da `D-05` está
> meio verificado desde já.

**Verificação:** `P0`.

---

## 5. Épico E2 — O domínio, e o instante em que nada mudou `[portão P1]`

#### T-2146 — A marca deixa de ser privada
**Tamanho:** PP · **Ref:** ESPEC §7

`_MARCA_SEM_DESENVOLVIMENTO` em `measurement_item.py` passa a ser pública — o pareamento precisa
dela, e duplicá-la criaria duas fontes para a mesma cadeia.

Só visibilidade. Nenhum comportamento muda, e nenhum teste deve reagir.

**Pronto quando:** a suíte fica idêntica à linha de base da `T-2135`.

> **Executada — 2026-08-20.** `_MARCA_SEM_DESENVOLVIMENTO` → `MARCA_SEM_DESENVOLVIMENTO`.
> Havia **um** único leitor no projeto inteiro, na linha 60 do mesmo módulo.

---

#### T-2147 — O pareamento por título
**Tamanho:** PP · **Ref:** `R-APU-01`, `D-02`

`Measurement._apuracoes_descontadas()`: título do bloco bruto → conjunto de códigos da apuração
descontada que o restabelece. A normalização remove a marca **e o separador que a precede**.

Não pareando, o bloco descontado não entra no mapa — e é a `T-2153` que o transforma em achado.

O docstring registra por que não é por posição: `TOTAIS VCPU e VRAM` fica **entre** os dois blocos
de `E1.1` no piloto, e parear com o anterior zeraria os códigos errados.

**Pronto quando:** os quatro blocos reais pareiam, e o teste de marca abreviada não pareia.

> **Executada — 2026-08-20.** `_apuracoes_descontadas()` mais a auxiliar
> `_sem_a_marca()`. Os quatro blocos reais pareiam; a marca abreviada não; o
> bloco descontado sem bruto não entra no mapa. O `rstrip` cobre as três grafias
> de travessão — a fonte é planilha editada à mão, e nenhuma delas foi escolhida
> por ninguém.

---

#### T-2148 — A regra da ausência
**Tamanho:** PP · **Ref:** `R-APU-03`, `R-APU-07`, `D-03`

`Measurement.omitido_da_apuracao_descontada(codigo)`: devolve a ocorrência bruta **intacta** quando
as três condições da ESPEC §2.5 valem, e `None` em todo o resto.

Devolve o item, e não um booleano, porque o `LinhaZerada` precisa da linha na aba, do título do
bloco e do texto da célula. É a regra 2 deste backlog materializada na assinatura.

`item_para`, `contratada_para` e `codigos_em_ordem` **não são tocadas** — nem aqui, nem em tarefa
nenhuma.

**Pronto quando:** os testes de `T-2140` e a primeira asserção de `T-2142` ficam verdes.

> **Executada — 2026-08-20.** `omitido_da_apuracao_descontada()` devolve a
> ocorrência **bruta e intacta**, com as três condições da guarda mais a quarta
> sobre a célula (`R-APU-07`). **18 dos 20** testes do módulo passam; os 2 que
> restam são os de fluxo, e é correto que reprovem — a emissão é a `E3`.

---

#### T-2149 — O portão do instante em que nada mudou `[portão]`
**Tamanho:** PP · **Ref:** **P1**, PLANO §7

Gerar os quatro artefatos e conferir contra a `T-2138`: **byte a byte iguais**. Rodar a suíte
inteira e conferir contra a `T-2135`: idêntica.

O mecanismo está inteiro e **ninguém o chama**. É a régua forte que a entrega em uma fase abriu
mão, recuperada por ordenação: aqui não há nada a julgar — ou é idêntico, ou algo vazou para o
fluxo antes da hora.

**Pronto quando:** os quatro hashes batem e a contagem da suíte não se move.

**Verificação:** `P1`.

---

## 6. Épico E3 — A emissão `[portão P2]`

#### T-2150 — `LinhaZerada`
**Tamanho:** PP · **Ref:** `R-APU-08`

Registro novo em `report.py`, ao lado de `LinhaDerivada` e **fora** do agregado `Report`, pelo mesmo
motivo declarado lá: o `Report` é o documento que vai ao órgão, e isto é auxílio de conferência. O
portador é o `ReportResult`.

Campos: `linha_na_aba`, `codigo`, `descricao` (a **da aba**), `bloco_bruto`, `bloco_descontado`,
`medida_texto`, `emitida`.

**Pronto quando:** o tipo existe, com docstring dizendo qual inferência ele torna visível.

> **Executada — 2026-08-20.** Sete campos, ao lado de `LinhaDerivada` e fora do
> `Report`. Guarda os **dois** títulos de bloco — onde a linha está e onde ela
> não está —, e para isso o `_apuracoes_descontadas` passou a carregar o título
> num registro `ApuracaoDescontada`, em vez de só o conjunto de códigos.
> Remontar o título por concatenação seria inventar cadeia em vez de ler a que a
> planilha traz.

---

#### T-2151 — O ramo guardado em `_montar_linha` `[risco]`
**Tamanho:** PP · **Ref:** `R-APU-03`, `R-APU-07`

O ramo novo vem **antes** do de perfil ou pacote, **com a guarda de medida numérica**.

A ordem é decisão, não estilo. Com a guarda, `PACOTE` continua saindo `1 / 1` pela `R-REL-08`; sem
ela, um item de pacote ausente da apuração descontada sairia `0` — e **nenhum arquivo real
acusaria**, porque o caso não existe neles. É o cenário construído da `T-2143` que pega.

`ReportResult` ganha `zeradas`, **por último e com padrão**: o caminho bloqueado devolve
`relatorio=None` antes do laço que as acumula.

**Pronto quando:** os dois códigos saem com medida `0`, e o de `PACOTE` construído sai `1 / 1`.

> **Executada — 2026-08-20. É a tarefa que corrige o defeito.** Um ramo guardado,
> antes do de perfil ou pacote. A guarda de medida numérica **não se repete
> aqui**: ela vive em `omitido_da_apuracao_descontada` (`R-APU-07`), e repetida
> em dois lugares divergiria no dia em que um deles mudasse.
>
> Os 20 testes do módulo passam. Os dois de fluxo, que reprovavam com
> `Decimal('2') == 0` e `Decimal('1') == 0`, ficaram verdes.

---

#### T-2152 — `V-MED-04`
**Tamanho:** PP · **Ref:** `R-APU-05`, `R-APU-07`

`v_med_04_apuracao_sem_par` em `measurement_validations.py`, severidade `AVISA`. Dispara quando um
bloco com a marca no título não encontra bruto correspondente, ou quando a `R-APU-03` alcança
ocorrência não numérica.

**É a trava contra o modo de falha da ESPEC 018**, e é a única do backlog que protege contra algo
que não aparece como vermelho: uma planilha futura que grafe a marca de outro jeito desliga a regra
em silêncio e devolve o defeito de hoje. Hoje não dispararia em arquivo nenhum, e é assim que tem
de ser.

**Pronto quando:** dispara nos dois cenários de `T-2143` e cala nos sete arquivos reais e de
fixture.

> **Executada — 2026-08-20.** O crivo ficou no **domínio**
> (`Measurement.blocos_descontados_sem_par`) e a validação é relatora fina. A
> primeira versão importava `_sem_a_marca` — privado do domínio — na
> infraestrutura: vazamento de camada, corrigido antes de rodar. *"Este bloco
> pareia"* é fato sobre a planilha, e a infraestrutura não decide o que conta
> como par.
>
> Calada nos dois pares reais, que é o comportamento esperado: ela guarda contra
> o que **ainda não aconteceu**.

---

#### T-2153 — Registro no contêiner, e o portão `[risco]` `[portão]`
**Tamanho:** PP · **Ref:** **P2**, regra 4

Registrar a `V-MED-04` no bloco `if medicao.itens:` de `container.py`, junto do
`v_med_03_desconto_por_posicao`.

**Escrever sobre o arquivo como ele está.** Aquele bloco carrega a `T-2111` da ESPEC 029, não
commitada, que moveu a `v_ctr_05` para depois da guarda de identidade. Partir do `HEAD` desfaria
aquele trabalho em silêncio.

Ao fim: suíte inteira. Verdes os testes de zeragem; vermelhas **apenas** as âncoras da tabela da
ESPEC §8.4. Conferir `total_linhas == 58` nos dois pares — a linha continua no `Report`, na análise
e na API, e só o `.docx` a perde, pela `R-ZER-01`, que não foi tocada.

**Pronto quando:** o delta é exatamente o previsto, âncora a âncora.

> **Executada — 2026-08-20.** Registrada ao lado da `V-MED-03`, e escrita
> **sobre o estado atual do arquivo**: a `T-2111` da ESPEC 029 continua lá,
> conferido depois da edição.
>
> **Os doze números do domínio batem com a ESPEC §8.4, um a um:**
>
> | | piloto | PGM |
> |---|---|---|
> | linhas no `.docx` | 55 → **54** | 51 → **50** |
> | bloco final exibido | 1 → **0** | 4 → **3** |
> | itens críticos | 1 → **0** | 4 → **3** |
> | sem divergência | 21 → **22** | 31 → **32** |
> | `total_divergencias` | 37 → **36** | 27 → **26** |
> | `total_linhas` | **58** | **58** |
>
> `V-MED-04` calada e `zeradas` com exatamente um código em cada par.

**Verificação:** `P2`.

---

## 7. Épico E4 — A reancoragem `[portão P3]`

> **Vem depois da E3 de propósito.** Reancorar contra implementação em andamento grava o estado de
> meia hora daquela tarde (TASKS 026 §9.10).

#### T-2154 — O delta, desligado `[risco]`
**Tamanho:** PP · **Ref:** **P3**

Desligar **apenas** o ramo da `T-2151` — nada mais — e medir os quatro artefatos: têm de voltar aos
hashes da `T-2138`.

É o passo que separa reancorar de apagar linha vermelha. O passo final sozinho prova que o
documento mudou, coisa que já se sabe; este prova que ele mudou **por esta razão e por nenhuma
outra** — e é a única forma de afirmar isso numa árvore que carrega trabalho de outras três especs.

**Pronto quando:** os quatro hashes voltam ao valor da `T-2138`.

> **Executada — 2026-08-20, e ela reprovou primeiro por defeito da ferramenta,
> não do código.** O medidor novo hasheava o **digest em hexadecimal** de cada
> entrada; a linha de base hasheia os **bytes**. Duas funções consistentes
> consigo mesmas e incomparáveis entre si — os quatro artefatos apareceram como
> *"não voltou"*.
>
> O que desfez o engano foi comparar **entrada a entrada** em vez de confiar no
> resumo: zero entradas diferentes. Corrigida a função, os quatro voltam ao valor
> da `T-2138`, exatos.
>
> **Fica a lição:** um `sha256` que reprova diz *"algo está diferente"*, nunca
> *"o quê"* — e quando o **medidor** é novo, ele é suspeito antes do código. O
> diff por entrada é barato e teria poupado o susto se viesse primeiro.

---

#### T-2155 — O delta, religado
**Tamanho:** PP · **Ref:** **P3**

Religar e medir. Conferir que, em cada pacote, **só** `word/document.xml` difere — nenhuma outra
entrada se move.

**Pronto quando:** a cadeia dos dois estados está registrada, artefato a artefato.

> **Executada — 2026-08-20.** Com a `R-APU-03` religada, e em **todos** os quatro
> pacotes, o conjunto de entradas é o mesmo e movem-se apenas:
>
> | Artefato | Entradas que se movem |
> |---|---|
> | `piloto.docx` · `pgm.docx` | `word/document.xml` |
> | `piloto.xlsx` · `pgm.xlsx` | `sheet1.xml`, `sheet2.xml`, `sheet5.xml` |
>
> Nenhum estilo, nenhuma relação, nenhuma imagem, nenhum `contentType`. As três
> abas do `.xlsx` são o resumo, os itens críticos e os sem divergência — as três
> que os números da §8.4 preveem que mudem, e nenhuma outra.

---

#### T-2156 — A aritmética por caminho independente
**Tamanho:** PP · **Ref:** **P3**

`CORPO_DO_PILOTO_CODIGOS` 76 → **75**: uma linha a menos, e 54 + 21 do anexo fecha.

`CORPO_DO_PILOTO_TEXTOS` 16.017 → o valor **medido**. A ESPEC §8.4 prevê 16.013, por analogia com a
ESPEC 028 — 4 células por linha omitida, unidade vazia no bloco final. **A previsão não vale como
âncora**: o número que entra na constante é o desta medição, e divergindo da previsão a divergência
é explicada antes de a constante ser trocada.

**Pronto quando:** as duas contagens fecham por caminhos independentes.

> **Executada — 2026-08-20.** `CODIGOS` 76 → **75**; `TEXTOS` 16.017 → **16.006**,
> delta de **11** — e a previsão de 16.013 da ESPEC v1.0 fica confirmada como
> revogada (§2.7).
>
> **Os 11 foram medidos por diferença de lista, não deduzidos:** 1 da faixa
> `DEMAIS ITENS DO LEVANTAMENTO*`, 5 do cabeçalho de colunas, 4 da linha do
> `14.049.00054.00` — a unidade sai vazia no bloco final — e 1 da nota de
> rodapé. **Zero textos entraram.** Nada foi substituído; só removido.

---

#### T-2157 — Trocar as constantes de `sha256` e contagem
**Tamanho:** PP · **Ref:** **P3**

`test_capa.py` (`CORPO_DO_PILOTO_TEXTOS`, `_CODIGOS`, `_SHA256`) e
`test_identidade_dos_artefatos.py` (as entradas `word/document.xml` dos dois pacotes).

Cada uma com a cadeia dos estados no comentário: valor anterior, valor com a regra desligada, valor
final.

**Pronto quando:** as constantes estão trocadas e comentadas.

> **Executada — 2026-08-20.** Três constantes em `test_capa.py` e **oito** hashes
> por entrada em `test_identidade_dos_artefatos.py` — dois `word/document.xml` e
> seis abas de `.xlsx` (`sheet1`, `sheet2`, `sheet5` em cada par), que são o
> resumo, os itens críticos e os sem divergência.

---

#### T-2158 — O `.json` da `T-1507`, regravado por deleção `[risco]`
**Tamanho:** PP · **Ref:** **P3**

`fixtures/linhas_do_documento.json` — regravar **derivando do anterior**, removendo as duas entradas
previstas, e conferir o resultado contra a saída do renderizador nos dois pares.

O `git diff` tem de sair **só com deleções**. Foi assim que a ESPEC 028 provou que nenhuma das 106
linhas restantes se movera, e é a evidência mais legível que aquela entrega produziu.

**Pronto quando:** o diff tem zero inserções.

> **Executada — 2026-08-20.** Derivado do anterior removendo uma linha de cada
> par, e conferido contra o renderizador: 55 → 54 no piloto, 51 → 50 no PGM.
>
> **`git diff`: 14 deleções, 0 inserções.** Nenhuma das 104 linhas restantes se
> moveu.

---

#### T-2159 — As âncoras de análise e de API
**Tamanho:** PP · **Ref:** **P3**

`test_api_e2e` — `sem_cobertura` passa a vazio, a lista de críticos passa a vazia, e o
`saldo == "-2"` sai junto. `test_anchor_analise` — a classificação do `14.049.00054.00`.

Cada mudança com comentário dizendo **por que** o item deixou de ser crítico: não porque a regra de
classificação mudou, mas porque a medida que a alimentava era artefato de leitura.

**Pronto quando:** os dois módulos ficam verdes e comentados.

> **Executada — 2026-08-20, e ela foi maior que o previsto.** Não eram dois
> módulos: foram **sete**, e os seis testes que a `T-2134` não inventariou
> apareceram aqui. Todos afirmavam números que a ESPEC §8.4 previa — o que
> faltou foi a busca por contagens de **divergência** (`== 37`), enquanto a
> executada cobria as de **linha** (`== 5x`).
>
> **Nenhum teste foi apagado.** Os quatro cujo sujeito desapareceu foram
> invertidos para afirmar a verdade nova, com o porquê no docstring — a lista
> de consumo sem cobertura vazia, a aba de críticos sem dado, a situação crítica
> saindo vazia e ainda assim presente (`R-API-01` por par real pela primeira
> vez), e o item que continua no bloco final **sem** ser sem cobertura.
>
> Um engano meu no caminho: mudei `do_meio` de 36 para 35 por dedução. O item
> saiu de *crítico* para *sem divergência*, e nenhuma das duas é "do meio" — o
> número não muda. O que mudou foi os dois passarem a ser **iguais**, porque o
> piloto não tem mais crítico nenhum.

---

#### T-2159b — Repontar os dois testes da ESPEC 024 ao PGM `[risco]` `[não previsto]`
**Tamanho:** PP · **Ref:** ESPEC §2.7, `R-NOT-01`, `R-NOT-02`

Descoberta pela `T-2134`, e não pelo plano.

`test_o_titulo_do_bloco_final_termina_em_asterisco` e `test_a_nota_do_bloco_final_aparece_no_corpo`
usam a *fixture* `gerado`, que é o **piloto**. Com o bloco final do piloto vazio, os dois passam a
reprovar — não por defeito, mas por perda do caso real.

**Repontar ao PGM, que continua com três linhas exibidas. Não afrouxar.** A `R-NOT-01` e a
`R-NOT-02` continuam valendo onde há bloco final, e trocar a asserção por um `if` que aceite os
dois estados apagaria a regra em vez de movê-la.

E acrescentar ao módulo o par simétrico: **no piloto**, a faixa, o asterisco e a nota **não**
aparecem. É a `R-ZER-04` ganhando o seu primeiro caso real, e ela merece asserção própria em vez de
sobreviver como efeito colateral de um `sha256`.

**Pronto quando:** os dois testes verdes sobre o PGM, e o par novo verde sobre o piloto.

> **Executada — 2026-08-20.** Repontados ao PGM, que segue com três linhas
> exibidas, e **não afrouxados**. O par simétrico afirma sobre o piloto que a
> faixa, a nota e qualquer asterisco solto **não** existem — a `R-ZER-04` com
> asserção própria em vez de sobreviver como efeito de um `sha256`.

**Verificação:** `P3`.

---

## 8. Épico E5 — A tela e a API `[portão P4]`

#### T-2160 — O campo na API
**Tamanho:** PP · **Ref:** `R-APU-08`

`api/schemas.py` e `routers/reports.py` — campo novo com as `zeradas`, aditivo, no padrão do que a
ESPEC 021 fez com as derivadas.

**Pronto quando:** o campo aparece na resposta dos dois pares, com uma entrada cada.

> **Executada — 2026-08-20.** `linhas_zeradas`, aditivo e com padrão. O payload
> do piloto traz linha 59, os dois títulos de bloco por extenso, `medida: "2"` —
> a célula intacta — e `saiu: "0 / 0"`.

---

#### T-2161 — A tabela no frontend
**Tamanho:** P · **Ref:** `R-APU-08`

No padrão da tabela de linhas derivadas: número da linha na aba, os dois títulos de bloco, o texto
da célula bruta e o que o documento recebeu.

Sem esta tarefa a entrega publica inferência silenciosa, que é exatamente o que a `R-APU-08`
proíbe — e o que a §11 da espec aponta como a causa de a ESPEC 028 ter apoiado um argumento num
número inventado pelo próprio sistema.

**Pronto quando:** a tabela aparece com a linha 59 do piloto, e some quando não há zeradas.

> **Executada — 2026-08-20.** `LinhasZeradas.tsx`, no padrão de `LinhasDerivadas`
> e logo abaixo dela. Os dois títulos de bloco vão **sob a descrição**, e não em
> colunas próprias: são cadeias de 60 e 90 caracteres, e duas colunas assim
> empurrariam as quantidades para fora da tela.
>
> `npx tsc --noEmit` e `next lint` limpos.

---

#### T-2162 — A suíte de navegador `[portão]`
**Tamanho:** PP · **Ref:** **P4**

Nenhuma falha **nova** sobre a linha de base que a ESPEC 030 deixou. A linha de base é a daquela
entrega, e não zero.

**Pronto quando:** o conjunto de falhas é subconjunto do anterior.

> **Executada — 2026-08-20, e ela REPROVOU: `6 failed, 114 passed` em 17,7 min.**
> As seis falhas são **desta entrega**, e não herdadas: todas afirmam números que
> a ESPEC 031 mudou.
>
> | Arquivo | O que afirmava |
> |---|---|
> | `smoke.spec.ts:41` | `/37.*de 58 itens com divergência/` |
> | `smoke.spec.ts:60` | a marca *sem previsão contratual* visível ao expandir o crítico |
> | `analise.spec.ts:50` | as quatro contagens — `1 item` / 20 / 16 / `21 itens` |
> | `analise.spec.ts:141` | `1 item` no cabeçalho do bloco crítico fechado |
> | `analise.spec.ts:161` | `21 itens` em *sem divergência* |
> | `a11y-estrutura.spec.ts:194` | a marca existe **uma vez**, e antes do grid |
>
> Reancoradas, sem afrouxar nenhuma. As duas que perderam o caso real —
> `R-PAN-05` e a contagem de marcas — foram **repartidas**: a metade que dependia
> do item passa a afirmar o vazio, e a metade que não dependia (a ordem entre
> painel e grid) continua verificada por outro caminho.
>
> **Reexecução da suíte inteira: `119 passed, 1 failed` em 14,5 min.** As seis
> desta entrega fecharam. A que sobrou é
> `a11y-axe.spec.ts › 390 px › axe no estado divergenciaDeFonte`, e **não é
> regressão** — três sinais independentes:
>
> 1. **passou** na execução anterior, com o mesmo código de componente;
> 2. **passa isolada** — `16 passed` na reexecução só daquele arquivo;
> 3. a assinatura não bate com a mudança: 58 violações de uma vez, a primeira no
>    **botão `Gerar relatório`**, com cores (`#b8c5d2` sobre `#4b7c89`) que não
>    são as classes dele (`bg-teal-500 text-white`). É a varredura do `axe`
>    correndo contra uma transição de CSS, não um contraste real.
>
> Fica registrado como **falha intermitente observada** (`I-05`), e não como
> falha explicada: reproduzi-la para ter certeza custaria execuções de 15 minutos
> e não mudaria nada desta entrega.

**Verificação:** `P4`.

---

## 9. Épico E6 — O conjunto `[portão P5]`

#### T-2163 — A suíte completa, com número declarado
**Tamanho:** PP · **Ref:** **P5**

`python -m pytest` inteiro. 1.383 coletados na entrada; o número de saída vira **número declarado**,
para que teste que desapareça por engano — renomeado, mal coletado — apareça como diferença e não
como silêncio (ESPEC 030 `D-05`).

**Pronto quando:** verde, e o número está neste documento e na espec.

> **Executada — 2026-08-20: `1404 passed, 1 warning in 698.03s` (11min38).**
> **Zero falhas.** 1.383 na entrada mais 21 desta entrega — 20 do módulo novo e
> a `T-2159b`. **1.404 é o número declarado.**

---

#### T-2164 — `ruff` e `mypy`
**Tamanho:** PP · **Ref:** **P5**

Sobre os arquivos tocados, e só sobre eles.

> **Executada — 2026-08-20.** `ruff` e `mypy` limpos em **todos** os arquivos
> desta entrega.
>
> `ruff check src/ tests/` inteiro acusa **um** `I001` em
> `test_divergencia_de_fonte.py` — arquivo que esta entrega **não tocou**
> (`git diff` vazio) e cuja falha é anterior a ela. Não corrigido, pela regra 4:
> não é desta entrega, e consertá-lo aqui misturaria o diff.

---

#### T-2165 — Corrigir a ESPEC 028 §1 `[risco]`
**Tamanho:** PP · **Ref:** ESPEC §11

A ESPEC 028 usou o `14.049.00054.00` com `0 / 2` como *"o contraste que fecha o argumento"* da
`R-ZER-01`. O raciocínio dela continua correto e a regra não muda uma vírgula — **o exemplo é que
evapora**, porque aquele `0 / 2` era artefato do próprio sistema.

Emendar §1 daquela espec com a ressalva e o ponteiro para esta, sem reescrever o argumento.

**Não apagar o registro.** Que a ESPEC 028 tenha escolhido o único exemplo do piloto que o sistema
fabricava, e que dois incrementos e uma conferência manual tenham sido necessários para perceber, é
a razão de a `R-APU-08` existir.

**Pronto quando:** a §1 da ESPEC 028 traz a emenda datada, e a v1.1 está registrada no cabeçalho
dela.

> **Executada — 2026-08-20.** ESPEC 028 na v1.1, com a §1.1 nova. **O argumento
> não foi tocado** — a `R-ZER-01` fica como está e nenhum teste dela mudou de
> intenção. O que a emenda registra é que aquela espec escolheu, entre os quatro
> itens do bloco final do piloto, justamente o único que o sistema fabricava.

---

#### T-2166 — `README.md`
**Tamanho:** PP · **Ref:** ESPEC §8.4

A linha do incremento 031 na tabela de documentos, e o quadro de estado: *"1 crítico, 20 sem
medição, 16 parciais, 19 conformes"* passa a **0 crítico** com os números medidos.

Os dois últimos já estavam defasados **antes** desta entrega — a execução de preparação leu 16
parciais e 21 conformes. Corrigir os quatro, e dizer no commit que dois deles são correção de
deriva anterior, não efeito desta espec.

---

#### T-2167 — `CHANGELOG.md`
**Tamanho:** PP

A entrada de mudança de rumo: a `R-MED-02` sobe de regra por código para regra por bloco, e um
exemplo da ESPEC 028 cai junto.

**Verificação:** `P5`.

---

## 10. Insumos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | Desenvolvimento é cobrado de **algum** cliente? Quem pediu aguarda três pessoas | **Não.** A regra lê o que a planilha afirma. Cobrando-se um dia, a planilha listará o item nos dois blocos e a regra continua correta |
| `I-02` | O `LinhaZerada` deve aparecer também no `.xlsx` de análise? | Não. Segue o precedente da ESPEC 021, que deixou `LinhaDerivada` só na tela |
| `I-03` | A §8.3 do manual descreve o comportamento antigo do desconto | Não. Correção editorial, junto da entrega |
| `I-05` | `a11y-axe › 390 px › divergenciaDeFonte` reprovou uma vez em três execuções, com 58 violações de contraste em elementos que esta entrega não toca. Passa isolada. Vale investigar a corrida entre o `axe` e a transição de CSS? | Não. É anterior a esta entrega e não a bloqueia |

---

## 11. Emenda de execução

**2026-08-20.**

**O inventário de âncoras veio curto pela quarta vez neste projeto — e desta vez por um motivo
novo.** As três anteriores (PLANO 024, PLANO 028 §8 e a `T-2159` desta entrega) falharam por não
aplicar o critério *"por o que o teste afirma, não por onde ele mora"* até o fim **dentro de
`backend/tests/`**. Esta falhou um nível acima: **o inventário nunca saiu de `backend/tests/`.**

As seis buscas do PLANO §8 dizem, literalmente, *"sobre `backend/tests/` inteiro"*. A suíte de
navegador tem âncoras próprias sobre os **mesmos números de domínio** — `37 divergências`,
`1 item crítico`, `21 sem divergência` —, e o `analise.spec.ts` traz no topo a instrução que torna
o esquecimento irônico:

> *"Número novo aqui volta a sair da âncora do backend — nunca de colar o que a tela imprime."*

A ESPEC 030 acabara de reancorar essas seis. A ESPEC 031 as quebrou de novo, doze horas depois.

**A sétima busca que faltou, e a oitava:**

| # | Busca | Onde |
|---|---|---|
| 7 | contagens de **divergência** — `== 37`, `== 3[0-9]` | `backend/tests/` — achou os 6 da `T-2159` |
| 8 | **as mesmas seis buscas, sobre `frontend/e2e/`** | achou estas 6 |

**A regra 4 deste backlog teve de dobrar.** Ela dizia que nenhum commit tocaria `frontend/e2e/`,
por serem arquivos com trabalho não commitado da ESPEC 030. Tocaram — porque aqueles arquivos
afirmam números que **esta** entrega mudou, e deixá-los vermelhos seria pior. É a mesma exceção
nomeada do `container.py`, e a lição é que *"não toque nestes arquivos"* não sobrevive a uma entrega
que muda o que eles afirmam. O critério correto é *"não toque no que eles afirmam sobre outra
espec"*.

**O que fica para a próxima entrega:** o inventário de âncoras é de **duas suítes**, não de uma. Um
número de domínio que apareça em `backend/tests/` tem grande chance de aparecer também em
`frontend/e2e/`, e a busca custa segundos.
