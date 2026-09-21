# ESPEC 032 — A frase que virou a página

| | |
|---|---|
| **Status** | **Implementada** — 2026-08-20. Backend **1.404 → 1.422 passed**, zero falhas; navegador **119 de 120**, com uma intermitente que passa isolada. Três descrições completas, **nenhum valor numérico movido** — conferido no conjunto inteiro dos três documentos — e nenhuma contagem alterada |
| **Versão** | 1.0 — 2026-08-20 |
| **Depende de** | [ESPEC 017](017-grade-do-contrato-derivada-do-documento.md) — a grade derivada do documento, implementada. É dela que saem as fronteiras que esta espec usa como crivo |
| **Revisa** | [ESPEC 001](001-mvp-analise-medicao.md) §9.4, que tratou **metade** deste defeito. O limite sintético de `montar_grade` resolve a linha que fica abaixo da última borda **da sua própria página**; a que continua **na página seguinte** ficou sem dono |
| **Não toca** | Nenhuma quantidade, preço, mês ou total. Nenhuma ordem de item. `Contract.posicao_de`, `Contract.aplicar`, `quantidade_para`, `V-CTR-03`, e toda a leitura da aba `Levantamento` |
| **Referência normativa** | `backend/tests/fixtures/contrato.pdf` (2 itens afetados), `contrato_pgm.pdf` (1) e `aditivo_pgm.pdf` (nenhum — e é ele que prova que a regra não é frouxa) |
| **Origem** | Conferência manual de quem fatura: *"12.074.00005.00 — Apresenta descrição incompleta. 14.048.00008.00 — Apresenta descrição incompleta."* O terceiro caso, no PGM, não estava no relato nem na análise inicial: apareceu ao medir por estrutura em vez de por texto (§2.2) |

---

## 1. Problema

Três itens saem do contrato com a descrição cortada no meio:

| Documento | Código | Descrição extraída hoje |
|---|---|---|
| `contrato.pdf` | `12.074.00005.00` | `DISPONIBILIZAÇÃO DE EQUIPAMENTO CPE-SD-WAN TIPO 1 (PARA LOCAIS ATÉ 50 USUÁRIOS E THROUGHPUT DE` |
| `contrato.pdf` | `14.048.00008.00` | `PLATAFORMA DE BANCO DE DADOS - SQL SERVER - PERFIL` |
| `contrato_pgm.pdf` | `12.074.00005.00` | `DISPONIBILIZAÇÃO DE EQUIPAMENTO CPE-SD-WAN TIPO` |

**As três chegam ao documento que vai ao órgão** — duas no piloto e uma no PGM, medido no `Report`
de cada par. A `R-REL-07` manda usar a designação contratual, e é ela que sai cortada.

Onde o corte cai importa mais do que o corte:

- o `14.048.00008.00` termina em **`PERFIL`**, antes da letra. É exatamente o item cujo perfil
  contratado (`D`) difere do medido (`C`) — a divergência que a ESPEC 021 trouxe à tela pela
  primeira vez, vinte especs depois de a ESPEC 001 §9.3 declará-la perda aceita. O documento apaga
  a informação que a tornaria conferível;
- o `12.074.00005.00` perde a capacidade — `150 MBPS` —, que é o que distingue o TIPO 1 dos TIPOS 2
  e 3 do mesmo contrato.

**Nenhum número se perde**, e é o que separa este defeito do da ESPEC 031: quantidade, preço, meses
e total ficam todos na primeira linha visual da célula e são lidos corretamente. `V-CTR-03` fecha
hoje e fecharia sem esta correção. O que sai errado é texto, em peça de cobrança.

## 2. O que foi levantado no código

### 2.1 Onde a palavra se perde

`ler_celulas` ([grid.py:349-374](../../backend/src/infrastructure/contract/grid.py#L349-L374))
distribui cada palavra pela posição do seu centro:

```python
linha = _indice(centro_y, grade.horizontais)
coluna = _indice(centro_x, grade.verticais)
if linha is not None and coluna is not None:
    celulas[linha][coluna].append(palavra)
```

`_indice` devolve `None` para o que cai fora das fronteiras, e o `if` **descarta em silêncio**.

Uma linha de item que atravessa a quebra de página tem a cauda impressa no **topo da página
seguinte**, acima de `horizontais[0]`. No piloto:

```
p.26 fim:   y=801,4  'USUÁRIOS' 'E' 'THROUGHPUT' 'DE'
─────────────── quebra de página ───────────────
p.27 topo:  y= 36,4  '150' 'MBPS' 'SIMULTÂNEO' 'NOS'
            y= 49,9  'SERVIÇOS' 'DE' 'SEGURANÇA)'
            ↑ horizontais[0] da p.27 = 55,5
```

O extrator lê **uma página por vez** (`_linhas`, `montar_grade`, `ler_celulas` recebem `pagina`).
Ao processar a 27, aquele pedaço não pertence a linha nenhuma da 27 — e não há quem o devolva à 26.

### 2.2 O raio de alcance, medido antes de escrever código

Todas as páginas dos três PDFs, procurando texto **dentro da faixa horizontal da tabela** e **acima
de `horizontais[0]`**:

| Documento · página | palavras soltas | linhas | fora da coluna de descrição | O que é |
|---|---|---|---|---|
| `contrato.pdf` p27 | 7 | 2 | **0** | cauda do `12.074.00005.00` |
| `contrato.pdf` p28 | 10 | 2 | **0** | cauda do `14.048.00008.00` |
| `contrato_pgm.pdf` p23 | 16 | 4 | **0** | cauda do `12.074.00005.00` |
| `contrato.pdf` p25 | 177 | 28 | **110** | prosa sobre SOA |
| `contrato_pgm.pdf` p22 | 214 | 24 | **117** | marcadores sobre VPN |
| `aditivo_pgm.pdf` p6 | 138 | 12 | **93** | título de seção `E5.10` mais explicação |

**Três continuações e três armadilhas.** A relação entre elas é o que decide o desenho.

### 2.3 A correção óbvia introduz um defeito pior

A leitura direta do §2.1 é *"as palavras acima de `horizontais[0]`, dentro da faixa da tabela,
pertencem à última linha da página anterior"*. Aplicada assim, ela **cola 177 palavras de prosa
sobre SOA** na descrição de um item do contrato do piloto, e 214 no do PGM.

Trocaria uma descrição cortada por uma descrição adulterada, num documento que vai ao órgão. É pior
que o defeito atual, e por isso a regra precisa de crivo.

### 2.4 O crivo: continuação ocupa uma coluna, prosa atravessa a página

O discriminador está na tabela do §2.2 e é limpo: **zero palavras fora da coluna de descrição nos
três casos verdadeiros; 93, 110 e 117 nos três falsos.** Nenhum valor intermediário.

É estrutural — não olha conteúdo, fonte nem tamanho — e usa as fronteiras que a ESPEC 017 já
derivou do próprio documento. A coluna de descrição é `verticais[1]..verticais[2]`, por
`COL_DESCRICAO = 1`.

**O critério por limiar de posição foi descartado.** *"A tabela começa perto do topo, logo o que
está acima é continuação"* funciona nos números de hoje — 55,5 e 55,5 contra 624,7, 430,7 e 329,2 —
mas o PGM já tem `topo = 78,5`, e a fronteira entre 78,5 e 329,2 é um número que ninguém escolheu.
É a espécie de constante que envelhece sem avisar (`D-01`).

### 2.5 O caso duvidoso, conferido

O topo da p6 do aditivo **parece** descrição de item:

```
ADICIONAL DE VOLUMETRIA DE BANCO DE DADOS - ADICIONAL DE VOLUMETRIA - SQL SERVER - ATÉ 2.819,79…
```

Não é. É o título da seção `E5.10` seguido de parágrafos explicativos sobre cobrança por faixa, e o
item `14.048.00027.00` **já sai completo hoje**. O crivo o rejeita — 93 palavras fora da coluna — e
está certo ao rejeitar.

É o caso que impede a regra de ser escrita de forma frouxa, e por isso o aditivo entra na referência
normativa desta espec sem ter item afetado nenhum.

### 2.6 Existe um oráculo externo, e ele é gratuito

A aba `Levantamento` traz, para o `12.074.00005.00`, **exatamente** o texto que a reconstrução tem
de produzir — nos dois pares:

```
DISPONIBILIZAÇÃO DE EQUIPAMENTO CPE-SD-WAN TIPO 1 (PARA LOCAIS ATÉ 50 USUÁRIOS E
THROUGHPUT DE 150 MBPS SIMULTÂNEO NOS SERVIÇOS DE SEGURANÇA)
```

Outra fonte, outro sistema (GRC), mesma cadeia. É conferência **independente do código**, e é o que
transforma *"o texto parece completo"* em asserção (`R-CON-06`).

Para o `14.048.00008.00` a aba **não** serve como oráculo de texto: ela diz
`PERFIL IV(D) - DE 200GB ATÉ 500GB` e o contrato dirá `PERFIL D - Base de dados acima de 200GB até
500GB`. Redações diferentes, mesmo perfil — corrobora o sentido, não a cadeia.

**Mas há um oráculo interno para ele, achado na `T-2168`.** O contrato do PGM traz o
`14.048.00009.00` — o **mesmo item, outro perfil** —, e a linha dele não cai numa quebra de página:

```
PGM  14.048.00009.00  p24
'PLATAFORMA DE BANCO DE DADOS - SQL SERVER - PERFIL F - Base de dados acima de 1.000GB até 3.000GB'
```

A forma completa da família está extraída e versionada há incrementos, em
`fixtures/linhas_do_documento.json`. O alvo do `14.048.00008.00` é essa forma com `D` no lugar de
`F` e a faixa correspondente — e isso não é leitura minha do PDF: é o que o próprio extrator produz
quando a linha cabe na página.

### 2.7 Quem lê a descrição do contrato

- `GenerateMeasurementReport._descricao`
  ([generate_measurement_report.py:196](../../backend/src/application/use_cases/generate_measurement_report.py#L196))
  — `R-REL-07`, a designação que o documento leva ao órgão. É o consumidor que importa;
- `DivergenciaDeFonte.descricao` — a mesma designação, na tabela de divergências de contratado;
- **não** a `LinhaDerivada`, que usa a descrição da aba por `R-PER-03` — e foi justamente o corte do
  `14.048.00008.00` que decidiu aquela regra (ESPEC 021 `D-01`).

## 3. Objetivo

Que a descrição contratual chegue inteira ao documento, inclusive quando a linha da tabela atravessa
uma quebra de página — e que nada além de descrição se mova.

**Não é objetivo:** mexer em quantidade, preço, mês, total ou ordem; tratar continuação em coluna
que não seja a de descrição; nem reconciliar a redação do contrato com a da aba.

## 4. Escopo

### 4.1 Dentro do escopo

- A cauda da última linha de uma página, quando ela está no topo da página seguinte.
- O crivo que a distingue de prosa de outra seção.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Continuação em outra coluna | `D-03` — nenhum caso real nos três documentos, e a coluna de descrição é a única larga o bastante para quebrar |
| A redação da aba contra a do contrato | `R-REL-07` decidiu que vale a contratual. Esta espec a completa; não a substitui |
| Qualquer valor numérico | `D-04` — os quatro ficam na primeira linha visual da célula, e `V-CTR-03` prova que nenhum item se perde |
| A prosa que o crivo rejeita | `D-02` — ela não é da tabela, e não tem por que entrar em lugar nenhum |
| A ordem editorial do modelo GRC | Decisão fechada da ESPEC 018 `R-REL-03` |

## 5. Regras

| ID | Regra |
|---|---|
| `R-CON-01` | Texto que fica **acima de `horizontais[0]`** e **dentro da faixa `verticais[0]..verticais[-1]`** é candidato a cauda da última linha da página anterior |
| `R-CON-02` | **O crivo é a coluna.** Só é continuação quando **todas** as palavras candidatas caem na coluna de descrição (`verticais[1]..verticais[2]`). Uma única fora, e **nada** é tomado — a página inteira volta a ser ignorada, como hoje |
| `R-CON-03` | A cauda é anexada **ao fim da célula de descrição** da última linha da página anterior, separada por um espaço, na ordem de leitura: `top` e depois `x0` — a mesma de `ler_celulas` |
| `R-CON-04` | **Nenhuma outra célula é tocada.** Código, unidade, preço, quantidade, meses e total continuam saindo da página onde a linha começa |
| `R-CON-05` | Não havendo página anterior com linha de item — a primeira página da tabela —, o texto é ignorado, e `V-CTR-06` o registra. É anomalia, não caminho normal |
| `R-CON-06` | A reconstrução do `12.074.00005.00` é conferida contra a **descrição da aba**, nos dois pares, caractere por caractere (`§2.6`) |
| `R-CON-07` | O conjunto de descrições reconstruídas é **invariante mantido**, afirmado por extenso: `12.074.00005.00` e `14.048.00008.00` no piloto, `12.074.00005.00` no PGM, **nenhuma** no aditivo |

### 5.1 Validação nova

| ID | Severidade | Quando dispara |
|---|---|---|
| `V-CTR-06` | `AVISA` | Candidata a cauda que satisfaz `R-CON-02` e **não tem linha anterior** a que se anexar (`R-CON-05`). Não dispara em nenhum dos três documentos |

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **O crivo é por coluna, não por limiar de posição** | Limiar funciona nos números de hoje e não tem dono: entre o `topo = 78,5` de uma continuação real e o `329,2` da prosa mais próxima não há fronteira que alguém tenha escolhido. A coluna é fato do documento, derivado pela ESPEC 017, e separa 0 de 93 sem valor intermediário |
| `D-02` | **Tudo ou nada por página** (`R-CON-02`) | Tomar *"as palavras que estão na coluna"* e descartar o resto seria pior que rejeitar: colaria metade de um parágrafo de prosa. Havendo qualquer palavra fora, o que está acima da grade não é cauda de linha — é outra coisa, e outra coisa não entra |
| `D-03` | **Só a coluna de descrição** | Limite declarado. Não há caso real de outra coluna quebrando, e não haveria: unidade, preço e quantidade são curtos por natureza. Generalizar agora seria escrever código para um caso que não existe |
| `D-04` | **A reconstrução é de texto, e só** | Os quatro valores numéricos ficam na primeira linha visual da célula — medido nos três casos. Tocá-los seria alargar o defeito para o lado onde `V-CTR-03` já garante correção |
| `D-05` | **A regra mora na leitura da página, não no caso de uso** | É defeito de extração, e o caso de uso não sabe o que é página. Corrigi-lo lá exigiria passar geometria de PDF por três camadas para servir a um consumidor |
| `D-06` | **A tabela de âncoras desta espec é provisória até o inventário** | Lição da ESPEC 031: a tabela escrita de cabeça previu 17 âncoras e a medição achou 24, e seis outras só apareceram na suíte completa. Aqui o §8.3 diz o que **deve** mudar; **quais testes** afirmam isso é trabalho da primeira fase, e o resultado dela manda nesta tabela |

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `infrastructure/contract/grid.py` | Função nova que devolve a cauda de uma página, ou vazio — o crivo de `R-CON-02` |
| `infrastructure/contract/pdfplumber_extractor.py` | `_linhas` passa a conhecer a página anterior; a cauda é anexada à célula de descrição da última linha dela (`R-CON-03`) |
| `infrastructure/validations/contract_validations.py` | `v_ctr_06_cauda_sem_linha_anterior` |
| `infrastructure/di/container.py` | Registro da validação nova |
| `domain/` | **Nenhuma.** `ContractItem.descricao` já é o campo; o que muda é o texto que chega nele |
| `application/`, `api/`, `frontend/` | **Nenhuma.** A descrição já viaja inteira por todos eles |

## 8. Testes e critério de aceite

### 8.1 As regras

| Regra | Verificação |
|---|---|
| `R-CON-01` · `R-CON-03` | As três descrições saem completas, com o texto por extenso no teste |
| `R-CON-02` | As três armadilhas do §2.2 continuam rejeitadas. **`aditivo_pgm.pdf` é o caso decisivo**: o texto rejeitado ali parece descrição de item |
| `R-CON-04` | Nos três documentos, **todos** os valores numéricos de **todos** os itens idênticos aos de hoje. Não é amostra: é o conjunto |
| `R-CON-05` | Cenário construído — página de tabela sem linha anterior. Nenhum documento real o exercita |
| `R-CON-06` | A descrição reconstruída do `12.074.00005.00` **é igual** à da aba, nos dois pares, caractere por caractere |
| `R-CON-07` | Conjunto reconstruído afirmado por extenso, e **vazio** no aditivo |

### 8.2 Regressão

- `V-CTR-03` — o checksum por peça continua fechando. É a prova de que nenhum item se perdeu, e ele
  não depende de descrição;
- `test_extractor_contract` — as quantidades ancoradas por código não se movem;
- `test_linhas_derivadas` — a descrição da **aba** do `14.048.00008.00` continua terminando em
  `PERFIL IV(D) - DE 200GB ATÉ 500GB`. É a `R-PER-03`, e esta espec não a toca.

### 8.3 O delta esperado — provisório até o inventário (`D-06`)

**Três descrições mudam, e nada mais.** Duas no `.docx` do piloto, uma no do PGM.

| Âncora | Esperado |
|---|---|
| Descrições do `Contract` | 3 mudam; todas as demais idênticas |
| Valores numéricos, os quatro, todos os itens | **inalterados** |
| `.docx` do piloto e do PGM | `word/document.xml` muda; nenhuma outra entrada do pacote |
| `test_capa.CORPO_DO_PILOTO_*` | contagem de textos e `sha256` — **a medir**, não a prever |
| `fixtures/linhas_do_documento.json` | as três linhas correspondentes; regravado **por derivação** |
| Contagens de linha, divergência, situações | **inalteradas** — esta espec não move número nenhum |

**Critério de aceite:** qualquer valor numérico que se mova reprova a entrega. Qualquer descrição
além das três reprova a entrega.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Colar prosa de outra seção numa descrição contratual | `R-CON-02` e `D-02`, com as três armadilhas do §2.2 como teste — a do aditivo é a que pega crivo frouxo |
| A regra deixar de reconhecer uma continuação real, e o corte voltar em silêncio | `R-CON-07` como invariante mantido. **Alcança só os arquivos conhecidos**, e é limitação declarada em `I-02` |
| Alguém generalizar para outras colunas numa refatoração | `D-03` e o teste de `R-CON-04`: os quatro valores de todos os itens, conjunto inteiro |
| Reancorar às cegas | `D-06` — o inventário manda na tabela, e o delta é provado desligando só esta regra |
| Confundir a redação do contrato com a da aba | `R-CON-06` usa a aba como oráculo **onde as duas coincidem**, e o §2.6 registra que no `14.048.00008.00` elas não coincidem |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | A descrição reconstruída do `14.048.00008.00` fica `PLATAFORMA DE BANCO DE DADOS - SQL SERVER - PERFIL D - Base de dados acima de 200GB até 500GB`, misturando maiúsculas do contrato com a caixa mista da continuação. É o que o PDF traz. Normalizar? | Não. Normalizar seria editar o contrato; o documento cita o instrumento |
| `I-02` | O invariante de `R-CON-07` cobre os três arquivos conhecidos. Um contrato novo com quebra em outra geometria não teria guarda | Não. Nenhum número está em risco, e descrição cortada é visível a quem lê o relatório — ao contrário do defeito da ESPEC 031, que era invisível |
| `I-03` | A `V-CTR-06` nunca dispara hoje. Vale mantê-la? | Não bloqueia. Precedente da `V-MED-04` (ESPEC 031): guarda de anomalia que não se paga em ruído |

## 11. Relação com a ESPEC 001 §9.4

Aquela seção registrou que `12.074.00005.00` e `14.048.00008.00` *"se perderam nas abordagens
anteriores"* — os **mesmos dois códigos** desta espec. A correção de lá foi o limite sintético de
`montar_grade` ([grid.py:322-330](../../backend/src/infrastructure/contract/grid.py#L322-L330)):
a moldura não fecha no rodapé, e sem ele a última linha de cada página era descartada inteira.

Aquilo resolveu o **rodapé**: a parte da linha que fica abaixo da última borda **da sua própria
página**. Ficou o **cabeçalho** — a parte que foi parar na página seguinte.

Antes da ESPEC 001, a linha inteira sumia. Depois dela, sobra a cauda da descrição. Esta espec fecha
a outra metade, e é por isso que os dois códigos são os mesmos: eles são simplesmente os itens que
caem no fim da página nestes contratos.

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Inventário de âncoras e delta medido, antes de qualquer código (`D-06`) | PP |
| B | Testes escritos antes, com as três reconstruções e as três armadilhas por extenso | P |
| C | O crivo em `grid.py` e a costura em `_linhas` | PP |
| D | `V-CTR-06` e registro no contêiner | PP |
| E | Reancoragem, com o delta provado desligando só esta regra | P |

**Estimativa: meio dia.** O crivo é curto e já foi medido; o trabalho está em A e E, e é trabalho
de prova.